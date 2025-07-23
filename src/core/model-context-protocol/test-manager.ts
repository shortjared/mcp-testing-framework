import { Colorize } from '@rushstack/terminal'
import { isEqual } from 'lodash'
import path from 'path'

import { createProvider, hasProvider } from '../../api/provider'
import { parseModelSpec, readConfig, readConfigs } from '../../utilities/config'
import { McpHub } from './mcp-hub'
import { IApiProvider } from '../../api/provider/provider'
import { SYSTEM_PROMPT } from '../../core/prompts/system'
import { parseJson } from '../../utilities/json-parser'
import { logger } from '../../utilities/logger'
import {
  IEvaluateResult,
  IMcpTestingFrameworkConfig,
  IMcpServer,
  ITestCase,
  IModelResponse,
  ISuiteResult,
  IMultiSuiteResult,
  IToolExecutionResult,
  IGradingResult,
  IParameterConfig,
} from '../../types/evaluate'
import { MCP_REPORTS_FOLDER } from '../../constants'
import { MCPReport } from '../../utilities/generate-report'
import { ConcurrencyController } from '../../utilities/concurrency-controller'
import { TableFormatter } from '../../utilities/table-formatter'
import { GradingService } from '../../utilities/grading-service'

/**
 * Check if a parameter value is an enhanced parameter config with optional support
 */
function isParameterConfig(
  value: any,
): value is { value: any; optional?: boolean } {
  return (
    value &&
    typeof value === 'object' &&
    'value' in value &&
    typeof value.optional === 'boolean'
  )
}

/**
 * Extract the actual value from a parameter, handling both simple values and enhanced configs
 */
function getParameterValue(param: any): any {
  return isParameterConfig(param) ? param.value : param
}

/**
 * Check if a parameter is marked as optional
 */
function isParameterOptional(param: any): boolean {
  return isParameterConfig(param) && param.optional === true
}

function isParameterCaseInsensitive(param: any): boolean {
  return (
    isParameterConfig(param) &&
    (param as IParameterConfig).caseInsensitive === true
  )
}

/**
 * Perform case insensitive comparison for values
 */
function compareValuesCaseInsensitive(expected: any, actual: any): boolean {
  // Handle string values
  if (typeof expected === 'string' && typeof actual === 'string') {
    return expected.toLowerCase() === actual.toLowerCase()
  }

  // Handle arrays
  if (Array.isArray(expected) && Array.isArray(actual)) {
    if (expected.length !== actual.length) {
      return false
    }
    return expected.every((expectedItem, index) =>
      compareValuesCaseInsensitive(expectedItem, actual[index]),
    )
  }

  // Handle objects
  if (
    typeof expected === 'object' &&
    typeof actual === 'object' &&
    expected !== null &&
    actual !== null &&
    !Array.isArray(expected) &&
    !Array.isArray(actual)
  ) {
    const expectedKeys = Object.keys(expected)
    const actualKeys = Object.keys(actual)

    if (expectedKeys.length !== actualKeys.length) {
      return false
    }

    return expectedKeys.every(
      (key) =>
        actualKeys.includes(key) &&
        compareValuesCaseInsensitive(expected[key], actual[key]),
    )
  }

  // For all other types (numbers, booleans, null, etc.), use regular equality
  return expected === actual
}

/**
 * Compare parameters with optional parameter support
 */
function compareParametersWithOptional(
  expectedParams: Record<string, any>,
  actualParams: Record<string, any>,
): boolean {
  // Check that all required parameters are present and match
  for (const [key, expectedValue] of Object.entries(expectedParams)) {
    const actualValue = actualParams[key]
    const isOptional = isParameterOptional(expectedValue)
    const isCaseInsensitive = isParameterCaseInsensitive(expectedValue)
    const normalizedExpectedValue = getParameterValue(expectedValue)

    // If parameter is missing
    if (actualValue === undefined) {
      // Missing required parameter is a failure
      if (!isOptional) {
        return false
      }
      // Missing optional parameter is okay, continue
      continue
    }

    // Parameter is present, check if values match
    const valuesMatch = isCaseInsensitive
      ? compareValuesCaseInsensitive(normalizedExpectedValue, actualValue)
      : isEqual(normalizedExpectedValue, actualValue)

    if (!valuesMatch) {
      return false
    }
  }

  return true
}

/**
 * Canonicalize tool usage object by sorting parameters and standardizing format
 * This ensures that parameter order doesn't affect comparison results and
 * extracts actual values from enhanced parameter configurations
 */
function canonicalizeToolUsage(toolUsage: any): any {
  if (!toolUsage || typeof toolUsage !== 'object') {
    return toolUsage
  }

  const canonicalized = { ...toolUsage }

  // If parameters exist, sort them by key and extract values from enhanced configs
  if (
    canonicalized.parameters &&
    typeof canonicalized.parameters === 'object'
  ) {
    const sortedParams: any = {}
    Object.keys(canonicalized.parameters)
      .sort()
      .forEach((key) => {
        // Extract the actual value from enhanced parameter config
        const paramValue = canonicalized.parameters[key]
        sortedParams[key] = getParameterValue(paramValue)
      })
    canonicalized.parameters = sortedParams
  }

  return canonicalized
}

export class TestManager {
  private _testRound: number
  private _passThreshold: number
  private _executeTools: boolean
  private _gradingPrompt?: string
  private _modelsToTest: string[]
  private _testCases: ITestCase[]
  private _mcpServers: IMcpServer[]
  private _concurrencyController: ConcurrencyController
  private _tableFormatter: TableFormatter
  private _generateHtml: boolean
  private _openInBrowser: boolean

  private _mcpHub: McpHub
  private _mcpReport: MCPReport

  public constructor(
    config: IMcpTestingFrameworkConfig,
    promptFilter?: string,
    generateHtml: boolean = false,
    openInBrowser: boolean = false,
  ) {
    this._testRound = config.testRound ?? 10
    this._passThreshold = config.passThreshold ?? 0
    this._executeTools = config.executeTools ?? false
    this._gradingPrompt = config.gradingPrompt
    this._generateHtml = generateHtml
    this._openInBrowser = openInBrowser
    this._modelsToTest = config.modelsToTest
    this._testCases = promptFilter
      ? this._filterTestCases(config.testCases, promptFilter)
      : config.testCases
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
      executeTools: this._executeTools,
      gradingPrompt: this._gradingPrompt,
    })
  }

  private _filterTestCases(
    testCases: ITestCase[],
    promptFilter: string,
  ): ITestCase[] {
    const filtered = testCases.filter((testCase) =>
      testCase.prompt.toLowerCase().includes(promptFilter.toLowerCase()),
    )

    if (filtered.length === 0) {
      logger.writeWarningLine(
        `No test cases found matching prompt filter: '${promptFilter}'`,
      )
    } else {
      logger.writeLine(
        `Filtered to ${filtered.length} test case(s) matching prompt filter: '${promptFilter}'`,
      )
    }

    return filtered
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
    let passed = false
    let toolExecutionResult: IToolExecutionResult | undefined
    let gradingResult: IGradingResult | undefined

    try {
      const { provider, model: modelName } = parseModelSpec(
        this._modelsToTest[modelIndex],
      )
      const apiProvider = this._createApiProvider(provider, modelName)

      // Step 1: Get model response and parse JSON
      const modelResponse = await apiProvider.createMessage(
        systemPrompt,
        testCase.prompt,
      )
      const parsedResponse = parseJson(modelResponse.trim())

      // Step 2: Validate tool usage format (always required)
      // Support backward compatibility: check expectedToolUsage first, then expectedOutput
      const expectedToolUsage =
        (testCase as any).expectedToolUsage || (testCase as any).expectedOutput
      if (!expectedToolUsage) {
        throw new Error(
          'Test case must have expectedToolUsage or expectedOutput',
        )
      }

      // Canonicalize both expected and actual tool usage for comparison
      const canonicalExpected = canonicalizeToolUsage(expectedToolUsage)
      const canonicalActual = canonicalizeToolUsage(parsedResponse)

      // Compare with optional parameter support
      const toolUsagePassed =
        canonicalExpected.serverName === canonicalActual.serverName &&
        canonicalExpected.toolName === canonicalActual.toolName &&
        compareParametersWithOptional(
          expectedToolUsage.parameters || {},
          canonicalActual.parameters || {},
        )

      // Step 3: Execute tool if enabled OR if expectedResults are defined (which requires execution)
      const shouldExecuteTools =
        this._executeTools || !!testCase.expectedResults
      if (shouldExecuteTools && toolUsagePassed) {
        toolExecutionResult = await this._mcpHub.executeTool(
          parsedResponse.serverName,
          parsedResponse.toolName,
          parsedResponse.parameters,
        )

        // Step 4: Generate final message after tool execution
        let finalMessage: string | undefined
        if (toolExecutionResult.success) {
          try {
            // Ask the LLM to generate a final response based on tool results
            const followUpPrompt = `Based on the user's request: "${testCase.prompt}"

I executed the ${parsedResponse.toolName} tool and got these results:
${JSON.stringify(toolExecutionResult.content, null, 2)}

Please provide a helpful, natural language response to the user based on these results. Be concise and directly address what they asked for.`

            finalMessage = await apiProvider.createMessage(
              'You are a helpful assistant. Provide clear, direct responses based on tool execution results.',
              followUpPrompt,
            )
          } catch (error) {
            logger.writeWarningLine(
              `Failed to generate final message: ${error instanceof Error ? error.message : String(error)}`,
            )
          }
        }

        // Step 5: Grade results if expectedResults provided
        if (testCase.expectedResults && toolExecutionResult.success) {
          const gradingService = new GradingService(apiProvider)
          const gradingPrompt = testCase.gradingPrompt || this._gradingPrompt

          gradingResult = await gradingService.gradeResults(
            testCase.prompt,
            testCase.expectedResults.content,
            finalMessage,
            gradingPrompt,
          )

          // Include final message in grading result
          if (gradingResult) {
            gradingResult.finalMessage = finalMessage
          }
        } else if (finalMessage) {
          // Even if no expectedResults, create a grading result to store the final message
          gradingResult = {
            grade: 'PASS', // Default to pass when only capturing final message
            reasoning:
              'Final message captured (no result validation performed)',
            finalMessage,
          }
        }
      }

      // Step 6: Determine overall pass/fail
      if (testCase.expectedResults) {
        // If expectedResults provided, both tool usage AND grading must pass
        passed =
          toolUsagePassed &&
          toolExecutionResult?.success === true &&
          gradingResult?.grade === 'PASS'
      } else {
        // If no expectedResults, only tool usage format needs to pass
        passed = toolUsagePassed
      }

      const response: IModelResponse = {
        response: parsedResponse,
        passed,
        toolExecutionResult,
        gradingResult,
      }

      return { passed, response }
    } catch (error) {
      const response: IModelResponse = {
        error: error instanceof Error ? error.message : String(error),
        passed: false,
        toolExecutionResult,
        gradingResult,
      }

      return { passed: false, response }
    } finally {
      currentIteration.value++
      this._updateProgress(currentIteration.value, totalIterations)
    }
  }

  public async evaluate(): Promise<IEvaluateResult[]> {
    try {
      // Check if any test case requires tool execution (has expectedResults)
      const anyTestRequiresExecution =
        this._executeTools || this._testCases.some((tc) => !!tc.expectedResults)

      // Get server tools and optionally keep connections alive for tool execution
      const serverTools = await this._mcpHub.listAllServerTools(
        anyTestRequiresExecution,
      )

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
              await this._concurrencyController.executeLimited(
                roundTaskFunctions,
              )

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

      await this._mcpReport.generateReport(
        evaluateResults,
        isAllPass,
        this._generateHtml,
        this._openInBrowser,
      )

      if (isAllPass) {
        logger.writeLine(Colorize.green('All tests passed!\n'))
      } else {
        logger.writeErrorLine(Colorize.red('Some tests failed!'))
      }

      return evaluateResults
    } finally {
      // Disconnect from MCP servers if tool execution was used (connections were kept alive)
      const anyTestRequiredExecution =
        this._executeTools || this._testCases.some((tc) => !!tc.expectedResults)
      if (anyTestRequiredExecution) {
        await this._mcpHub.disconnectAllServers()
      }
    }
  }

  public static async loadFromConfiguration(
    promptFilter?: string,
    generateHtml?: boolean,
  ): Promise<TestManager> {
    const config = await readConfig()
    if (!config) {
      throw new Error('Cannot find configuration file')
    }
    return new TestManager(config, promptFilter, generateHtml, false)
  }

  public static async loadFromDirectory(
    directory: string = process.cwd(),
    prefix?: string,
    promptFilter?: string,
    generateHtml?: boolean,
  ): Promise<TestManager[]> {
    const suites = await readConfigs(directory, prefix)

    if (suites.length === 0) {
      throw new Error(
        prefix
          ? `No valid test configurations found matching prefix '${prefix}' in '${directory}'`
          : `No valid test configurations found in '${directory}'`,
      )
    }

    return suites.map(
      (suite) =>
        new TestManager(suite.config, promptFilter, generateHtml, false),
    )
  }

  public static async executeMultiple(
    directory: string = process.cwd(),
    prefix?: string,
    promptFilter?: string,
    generateHtml?: boolean,
    openInBrowser?: boolean,
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

      const testManager = new TestManager(
        suite.config,
        promptFilter,
        generateHtml,
        openInBrowser,
      )

      // Skip suite if no test cases match the filter
      if (testManager._testCases.length === 0) {
        logger.writeWarningLine(
          `Skipping suite '${suite.name}' - no test cases match filter`,
        )
        continue
      }

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
