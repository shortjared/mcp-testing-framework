import { FileSystem } from '@rushstack/node-core-library'
import path from 'path'

import { IEvaluateResult, IMcpTestingFrameworkConfig } from '../types/evaluate'
import { logger } from './logger'

export interface ITestReport {
  timestamp: string
  config: {
    testRound: number
    passThreshold: number
    modelsToTest: string[]
  }
  results: Array<{
    prompt: string
    expectedOutput: any
    modelResults: Array<{
      model: string
      passRate: number
      details: Array<{
        round: number
        passed: boolean
        response?: any
        error?: string
      }>
    }>
  }>
  summary: {
    allPass: boolean
    totalTests: number
    passedTests: number
    failedTests: number
  }
}

export interface IMCPReportOptions
  extends Required<IMcpTestingFrameworkConfig> {
  reportDirectory: string
}

export class MCPReport {
  private _options: IMCPReportOptions

  public constructor(options: IMCPReportOptions) {
    this._options = options
  }

  public async generateReport(
    evaluateResults: IEvaluateResult[],
    isAllPass: boolean,
  ): Promise<string> {
    if (!(await FileSystem.existsAsync(this._options.reportDirectory))) {
      await FileSystem.ensureFolderAsync(this._options.reportDirectory)
    }

    const timestamp = new Date().toISOString().replace(/:/g, '-')
    const reportFilename = `test-report-${timestamp}.json`
    const reportPath = path.join(this._options.reportDirectory, reportFilename)

    let passedTests = 0
    let totalTests = 0

    const report: ITestReport = {
      timestamp,
      config: {
        testRound: this._options.testRound,
        passThreshold: this._options.passThreshold,
        modelsToTest: this._options.modelsToTest,
      },
      results: [],
      summary: {
        allPass: isAllPass,
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
      },
    }

    for (let i = 0; i < evaluateResults.length; i++) {
      const result = evaluateResults[i]
      const testCase = this._options.testCases[i]

      const modelResults = result.rates.map((rate, modelIndex) => {
        const modelName = this._options.modelsToTest[modelIndex]
        const details =
          result.modelResponses?.[modelIndex]?.map((resp, roundIndex) => ({
            round: roundIndex + 1,
            passed: resp.passed,
            error: resp.error,
            response: resp.response,
          })) || []

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
        expectedOutput: testCase.expectedOutput,
        modelResults,
      })
    }

    report.summary.totalTests = totalTests
    report.summary.passedTests = passedTests
    report.summary.failedTests = totalTests - passedTests

    await FileSystem.writeFileAsync(reportPath, JSON.stringify(report, null, 2))

    logger.writeLine(`\nDetailed test report saved to: ${reportPath}\n`)

    return reportPath
  }
}
