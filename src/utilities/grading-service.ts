import { IApiProvider } from '../api/provider/provider'
import { IGradingResult } from '../types/evaluate'
import { logger } from './logger'

export class GradingService {
  private _apiProvider: IApiProvider

  public constructor(apiProvider: IApiProvider) {
    this._apiProvider = apiProvider
  }

  private _buildGradingPrompt(
    customPrompt: string | undefined,
    defaultPrompt: string,
    testPrompt: string,
    expectedResults: string,
    actualResults: any,
  ): string {
    const basePrompt = customPrompt || defaultPrompt

    return `${basePrompt}

## Test Context
**Original Test Prompt:** ${testPrompt}

**Expected Results:** ${expectedResults}

**Actual AI Response:** ${actualResults}

## Instructions
Based on the comparison between expected and actual results, provide your evaluation in this EXACT format:
GRADE: [PASS or FAIL]
REASONING: [Single sentence explaining why you chose PASS or FAIL]

Be strict but fair in your evaluation. Consider semantic equivalence, not just exact text matches.`
  }

  private _parseGradingResponse(response: string): IGradingResult {
    const lines = response.trim().split('\n')

    let grade: 'PASS' | 'FAIL' | undefined
    let reasoning = ''

    for (const line of lines) {
      const trimmedLine = line.trim()
      if (trimmedLine.startsWith('GRADE:')) {
        const gradeText = trimmedLine.replace('GRADE:', '').trim().toUpperCase()
        if (gradeText === 'PASS' || gradeText === 'FAIL') {
          grade = gradeText
        }
      } else if (trimmedLine.startsWith('REASONING:')) {
        reasoning = trimmedLine.replace('REASONING:', '').trim()
      }
    }

    if (!grade) {
      // Fallback parsing - look for PASS/FAIL anywhere in response
      if (response.toUpperCase().includes('PASS')) {
        grade = 'PASS'
      } else if (response.toUpperCase().includes('FAIL')) {
        grade = 'FAIL'
      } else {
        grade = 'FAIL' // Default to fail if unparseable
      }
    }

    if (!reasoning) {
      reasoning = 'Unable to parse grading reasoning from response'
    }

    return { grade, reasoning }
  }

  public async gradeResults(
    testPrompt: string,
    expectedResults: string,
    actualResults: any,
    customGradingPrompt?: string,
  ): Promise<IGradingResult> {
    const defaultPrompt = `You are an expert evaluator for AI assistant responses. Your job is to determine if the actual AI response matches the expected response for a given test case.

You should evaluate based on:
1. Semantic correctness - does the actual response convey the same meaning as expected?
2. Information accuracy - are the key facts and values correct?
3. Response quality - is the response helpful and appropriately formatted for the user?

You should be somewhat lenient with formatting differences and minor wording variations, but strict about factual accuracy and whether the response adequately addresses the user's request.`

    try {
      const gradingPrompt = this._buildGradingPrompt(
        customGradingPrompt,
        defaultPrompt,
        testPrompt,
        expectedResults,
        actualResults,
      )

      const response = await this._apiProvider.createMessage(
        'You are a precise evaluator. Follow instructions exactly.',
        gradingPrompt,
      )

      return this._parseGradingResponse(response)
    } catch (error) {
      logger.writeErrorLine(
        'Error during result grading:',
        error instanceof Error ? error.message : String(error),
      )

      return {
        grade: 'FAIL',
        reasoning: `Grading failed due to error: ${error instanceof Error ? error.message : String(error)}`,
      }
    }
  }
}
