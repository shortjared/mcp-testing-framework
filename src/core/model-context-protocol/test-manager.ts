import { Colorize } from '@rushstack/terminal'
import { isEqual } from 'lodash'
import path from 'path'

import { createProvider, hasProvider } from '../../api/provider'
import { parseModelSpec, readConfig, readConfigs } from '../../utilities/config'
import { McpHub } from './mcp-hub'
import { IApiProvider } from '../../api/provider/provider'
import { SYSTEM_PROMPT } from '../../core/prompts/system'
import { parseXml } from '../../utilities/xml2js'
import { logger } from '../../utilities/logger'
import {
  IEvaluateResult,
  IMcpTestingFrameworkConfig,
  IMcpServer,
  ITestCase,
  IModelResponse,
  ISuiteResult,
  IMultiSuiteResult,
} from '../../types/evaluate'
import { MCP_REPORTS_FOLDER } from '../../constants'
import { MCPReport } from '../../utilities/generate-report'
import { ConcurrencyController } from '../../utilities/concurrency-controller'
import { TableFormatter } from '../../utilities/table-formatter'

export class TestManager {
  private _testRound: number
  private _passThreshold: number
  private _modelsToTest: string[]
  private _testCases: ITestCase[]
  private _mcpServers: IMcpServer[]
  private _concurrencyController: ConcurrencyController
  private _tableFormatter: TableFormatter

  private _mcpHub: McpHub
  private _mcpReport: MCPReport

  public constructor(config: IMcpTestingFrameworkConfig) {
    this._testRound = config.testRound ?? 10
    this._passThreshold = config.passThreshold ?? 0
    this._modelsToTest = config.modelsToTest
    this._testCases = config.testCases
    this._mcpServers = config.mcpServers
    this._concurrencyController = new ConcurrencyController(
      config.concurrencyLimit,
    )
    this._tableFormatter = new TableFormatter(this._modelsToTest)

    this._mcpHub = new McpHub(config.mcpServers)

    this._mcpReport = new MCPReport({
      reportDirectory: path.join(process.cwd(), MCP_REPORTS_FOLDER),
      testCases: this._testCases,
      modelsToTest: this._modelsToTest,
      passThreshold: this._passThreshold,
      testRound: this._testRound,
      mcpServers: this._mcpServers,
      concurrencyLimit: this._concurrencyController.concurrencyLimit,
    })
  }

  private _createApiProvider(provider: string, model: string): IApiProvider {
    if (hasProvider(provider)) {
      return createProvider(provider, model)
    }

    throw new Error(`Unsupported provider: ${provider}`)
  }

  private _generateTable(evaluateResults: IEvaluateResult[]): boolean {
    const prompts = evaluateResults.map((result) => result.prompt)
    const rates = evaluateResults.map((result) => result.rates)

    const { table, isAllPass } = this._tableFormatter.createResultTable(
      prompts,
      rates,
      this._passThreshold,
    )

    logger.writeLine(table.toString())
    return isAllPass
  }

  private _updateProgress(current: number, total: number): void {
    const percent = Math.floor((current / total) * 100)
    const progressBar = this._tableFormatter.createProgressBar(percent)
    process.stdout.write(`\r${progressBar} ${percent}% (${current}/${total})`)

    if (current === total) {
      process.stdout.write('\n')
    }
  }

  private _getTotalIterations(): number {
    return this._testCases.length * this._modelsToTest.length * this._testRound
  }

  private async _runSingleTest(
    testCase: ITestCase,
    modelIndex: number,
    systemPrompt: string,
    currentIteration: { value: number },
    totalIterations: number,
  ): Promise<{ passed: boolean; response: IModelResponse }> {
    let passed: boolean

    try {
      const { provider, model: modelName } = parseModelSpec(
        this._modelsToTest[modelIndex],
      )
      const apiProvider = this._createApiProvider(provider, modelName)

      const modelResponse = await apiProvider.createMessage(
        systemPrompt,
        testCase.prompt,
      )
      const parsedResponse = await parseXml(modelResponse.trim())
      passed = isEqual(testCase.expectedOutput, parsedResponse)

      const response: IModelResponse = {
        response: parsedResponse,
        passed,
      }

      return { passed, response }
    } catch (error) {
      passed = false
      const response: IModelResponse = {
        error: error.message,
        passed,
      }

      return { passed, response }
    } finally {
      currentIteration.value++
      this._updateProgress(currentIteration.value, totalIterations)
    }
  }

  public async evaluate(): Promise<IEvaluateResult[]> {
    const serverTools = await this._mcpHub.listAllServerTools()
    const systemPrompt = SYSTEM_PROMPT(serverTools)

    const totalIterations = this._getTotalIterations()
    const currentIteration = { value: 0 }

    logger.writeLine(
      `Running ${this._testRound} tests across ${this._testCases.length} prompts and ${this._modelsToTest.length} models...`,
    )
    this._updateProgress(0, totalIterations)

    const testTasks: Promise<IEvaluateResult>[] = this._testCases.map(
      async (testCase) => {
        const modelTasks: Promise<{
          passRate: number
          responses: IModelResponse[]
        }>[] = this._modelsToTest.map(async (model, modelIndex) => {
          const roundTaskFunctions = Array.from(
            { length: this._testRound },
            () => () =>
              this._runSingleTest(
                testCase,
                modelIndex,
                systemPrompt,
                currentIteration,
                totalIterations,
              ),
          )

          const roundResults =
            await this._concurrencyController.executeLimited(roundTaskFunctions)

          const passCount = roundResults.filter(
            (result) => result.passed,
          ).length
          const passRate = passCount / this._testRound

          const responses = roundResults.map((result) => result.response)

          return { passRate, responses }
        })

        const modelResults = await Promise.all(modelTasks)

        return {
          prompt: testCase.prompt,
          rates: modelResults.map((result) => result.passRate),
          modelResponses: modelResults.map((result) => result.responses),
        }
      },
    )

    const evaluateResults = await Promise.all(testTasks)

    logger.writeLine('\nResults:')
    const isAllPass = this._generateTable(evaluateResults)

    await this._mcpReport.generateReport(evaluateResults, isAllPass)

    if (isAllPass) {
      logger.writeLine(Colorize.green('All tests passed!\n'))
    } else {
      logger.writeErrorLine(Colorize.red('Some tests failed!'))
    }

    return evaluateResults
  }

  public static async loadFromConfiguration(): Promise<TestManager> {
    const config = await readConfig()
    if (!config) {
      throw new Error('Cannot find configuration file')
    }
    return new TestManager(config)
  }

  public static async loadFromDirectory(
    directory: string = process.cwd(),
    prefix?: string,
  ): Promise<TestManager[]> {
    const suites = await readConfigs(directory, prefix)

    if (suites.length === 0) {
      throw new Error(
        prefix
          ? `No valid test configurations found matching prefix '${prefix}' in '${directory}'`
          : `No valid test configurations found in '${directory}'`,
      )
    }

    return suites.map((suite) => new TestManager(suite.config))
  }

  public static async executeMultiple(
    directory: string = process.cwd(),
    prefix?: string,
  ): Promise<IMultiSuiteResult> {
    const suites = await readConfigs(directory, prefix)

    if (suites.length === 0) {
      throw new Error(
        prefix
          ? `No valid test configurations found matching prefix '${prefix}' in '${directory}'`
          : `No valid test configurations found in '${directory}'`,
      )
    }

    logger.writeLine(
      `Found ${suites.length} test suite${suites.length > 1 ? 's' : ''} to execute:\n`,
    )

    const suiteResults: ISuiteResult[] = []
    let passedSuites = 0

    for (const suite of suites) {
      logger.writeLine(
        Colorize.cyan(`\n=== Executing Suite: ${suite.name} ===`),
      )
      logger.writeLine(`File: ${suite.filePath}`)

      const testManager = new TestManager(suite.config)
      const evaluateResults = await testManager.evaluate()

      const totalTests = evaluateResults.reduce(
        (sum, result) => sum + result.rates.length,
        0,
      )
      const passedTests = evaluateResults.reduce(
        (sum, result) =>
          sum +
          result.rates.filter((rate) => rate >= testManager._passThreshold)
            .length,
        0,
      )

      const passRate = totalTests > 0 ? passedTests / totalTests : 0
      const suitePassed = passRate >= testManager._passThreshold

      if (suitePassed) {
        passedSuites++
      }

      suiteResults.push({
        suiteInfo: suite,
        evaluateResults,
        passed: suitePassed,
        passRate,
      })

      logger.writeLine(
        suitePassed
          ? Colorize.green(
              `✓ Suite '${suite.name}' passed (${(passRate * 100).toFixed(1)}%)`,
            )
          : Colorize.red(
              `✗ Suite '${suite.name}' failed (${(passRate * 100).toFixed(1)}%)`,
            ),
      )
    }

    const overallPassed = passedSuites === suites.length

    logger.writeLine(Colorize.cyan('\n=== Multi-Suite Results ==='))
    logger.writeLine(`Total suites: ${suites.length}`)
    logger.writeLine(`Passed suites: ${passedSuites}`)
    logger.writeLine(`Failed suites: ${suites.length - passedSuites}`)

    if (overallPassed) {
      logger.writeLine(Colorize.green('All test suites passed!'))
    } else {
      logger.writeLine(Colorize.red('Some test suites failed!'))
    }

    return {
      suiteResults,
      overallPassed,
      totalSuites: suites.length,
      passedSuites,
    }
  }
}
