import { Colorize } from '@rushstack/terminal'

import { TestManager } from '../core/model-context-protocol/test-manager'
import { logger } from '../utilities/logger'

/**
 * Execute tests and evaluate results
 */
export async function evaluateTests(): Promise<void> {
  try {
    const testManager = await TestManager.loadFromConfiguration()

    logger.writeLine('Running evaluation tests...\n')
    await testManager.evaluate()
    logger.writeLine(Colorize.green('Evaluation completed!'))
  } catch (error) {
    logger.writeErrorLine(
      'Error during evaluation:',
      error instanceof Error ? error.message : String(error),
    )
    process.exit(1)
  }
}
