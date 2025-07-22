import { Colorize } from '@rushstack/terminal'

import { TestManager } from '../core/model-context-protocol/test-manager'
import { logger } from '../utilities/logger'

/**
 * Execute tests and evaluate results
 */
export async function evaluateTests(
  prefix?: string,
  promptFilter?: string,
  generateHtml?: boolean,
  openInBrowser?: boolean,
): Promise<void> {
  try {
    let message = 'Running evaluation tests'
    if (prefix) {
      message += ` with prefix filter: '${prefix}'`
    }
    if (promptFilter) {
      message += ` with prompt filter: '${promptFilter}'`
    }
    logger.writeLine(`${message}...\n`)

    // If --open is used, force HTML generation
    const shouldGenerateHtml = generateHtml || openInBrowser

    const result = await TestManager.executeMultiple(
      process.cwd(),
      prefix,
      promptFilter,
      shouldGenerateHtml,
      openInBrowser,
    )

    if (result.overallPassed) {
      logger.writeLine(
        Colorize.green('All evaluations completed successfully!'),
      )
      process.exit(0)
    } else {
      logger.writeLine(Colorize.red('Some evaluations failed!'))
      process.exit(1)
    }
  } catch (error) {
    logger.writeErrorLine(
      'Error during evaluation:',
      error instanceof Error ? error.message : String(error),
    )
    process.exit(1)
  }
}
