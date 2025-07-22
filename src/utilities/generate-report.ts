import { FileSystem } from '@rushstack/node-core-library'
import path from 'path'

import { IEvaluateResult } from '../types/evaluate'
import { logger } from './logger'
import { HtmlReportGenerator } from './html-report-generator'

export interface ITestReport {
  timestamp: string
  config: {
    testRound: number
    passThreshold: number
    modelsToTest: string[]
    executeTools: boolean
    gradingPrompt?: string
  }
  results: Array<{
    prompt: string
    expectedToolUsage: any
    expectedResults?: any
    modelResults: Array<{
      model: string
      passRate: number
      details: Array<{
        round: number
        passed: boolean
        response?: any
        error?: string
        toolExecutionResult?: {
          success: boolean
          content?: any
          error?: string
        }
        gradingResult?: {
          grade: 'PASS' | 'FAIL'
          reasoning: string
          finalMessage?: string
        }
      }>
    }>
  }>
  summary: {
    allPass: boolean
    totalTests: number
    passedTests: number
    failedTests: number
    toolExecutionTests?: number
    gradedTests?: number
  }
}

export interface IMCPReportOptions {
  reportDirectory: string
  testRound: number
  passThreshold: number
  concurrencyLimit: number
  executeTools: boolean
  gradingPrompt?: string
  modelsToTest: string[]
  testCases: any[]
  mcpServers: any[]
}

export class MCPReport {
  private _options: IMCPReportOptions

  public constructor(options: IMCPReportOptions) {
    this._options = options
  }

  public async generateReport(
    evaluateResults: IEvaluateResult[],
    isAllPass: boolean,
    generateHtml: boolean = false,
  ): Promise<string> {
    if (!(await FileSystem.existsAsync(this._options.reportDirectory))) {
      await FileSystem.ensureFolderAsync(this._options.reportDirectory)
    }

    const timestamp = new Date().toISOString().replace(/:/g, '-')
    const reportFilename = `test-report-${timestamp}.json`
    const reportPath = path.join(this._options.reportDirectory, reportFilename)

    let passedTests = 0
    let totalTests = 0

    let toolExecutionTests = 0
    let gradedTests = 0

    const report: ITestReport = {
      timestamp,
      config: {
        testRound: this._options.testRound,
        passThreshold: this._options.passThreshold,
        modelsToTest: this._options.modelsToTest,
        executeTools: this._options.executeTools || false,
        gradingPrompt: this._options.gradingPrompt,
      },
      results: [],
      summary: {
        allPass: isAllPass,
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        toolExecutionTests: 0,
        gradedTests: 0,
      },
    }

    for (let i = 0; i < evaluateResults.length; i++) {
      const result = evaluateResults[i]
      const testCase = this._options.testCases[i]

      const modelResults = result.rates.map((rate, modelIndex) => {
        const modelName = this._options.modelsToTest[modelIndex]
        const details =
          result.modelResponses?.[modelIndex]?.map((resp, roundIndex) => {
            const detail: any = {
              round: roundIndex + 1,
              passed: resp.passed,
              error: resp.error,
              response: resp.response,
            }

            if (resp.toolExecutionResult) {
              detail.toolExecutionResult = resp.toolExecutionResult
              toolExecutionTests++
            }

            if (resp.gradingResult) {
              detail.gradingResult = resp.gradingResult
              gradedTests++
            }

            return detail
          }) || []

        if (rate >= this._options.passThreshold) {
          passedTests++
        }
        totalTests++

        return {
          model: modelName,
          passRate: rate,
          details,
        }
      })

      report.results.push({
        prompt: result.prompt,
        expectedToolUsage:
          (testCase as any).expectedToolUsage ||
          (testCase as any).expectedOutput,
        expectedResults: testCase.expectedResults,
        modelResults,
      })
    }

    report.summary.totalTests = totalTests
    report.summary.passedTests = passedTests
    report.summary.failedTests = totalTests - passedTests
    report.summary.toolExecutionTests = toolExecutionTests
    report.summary.gradedTests = gradedTests

    await FileSystem.writeFileAsync(reportPath, JSON.stringify(report, null, 2))

    logger.writeLine(`\nDetailed test report saved to: ${reportPath}`)

    // Generate HTML report if requested
    if (generateHtml) {
      const htmlGenerator = new HtmlReportGenerator(report)
      await htmlGenerator.generateHtmlReport(this._options.reportDirectory)
    }

    logger.writeLine('')

    return reportPath
  }
}
