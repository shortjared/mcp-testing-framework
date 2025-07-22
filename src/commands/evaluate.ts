import { Colorize } from '@rushstack/terminal'

import { TestManager } from '../core/model-context-protocol/test-manager'
import { logger } from '../utilities/logger'

/**
 * Execute tests and evaluate results
 */
export async function evaluateTests(prefix?: string): Promise<void> {
  try {
    logger.writeLine(
      prefix
        ? `Running evaluation tests with prefix filter: '${prefix}'...\n`
        : 'Running evaluation tests...\n',
    )

    const result = await TestManager.executeMultiple(process.cwd(), prefix)

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
