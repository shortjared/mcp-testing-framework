import { Command } from 'commander'
import path from 'path'

import { VERSION } from './constants'
import { initProject } from './commands/init'
import { evaluateTests } from './commands/evaluate'
import { logger } from './utilities/logger'
import { loadEnv } from './utilities/env'

loadEnv()

const program: Command = new Command()

program
  .name('mcp-testing-framework')
  .description('MCP Testing Framework CLI')
  .version(VERSION)

program
  .command('init [dir]')
  .description('Initialize a new MCP Testing Framework project')
  .option('--example <example>', 'Initialize project with a predefined example')
  .action(async (dir = '.', options) => {
    const targetDir = path.resolve(process.cwd(), dir)
    await initProject(targetDir, options.example)
  })

program
  .command('evaluate [prefix]')
  .description(
    'Execute tests and evaluate results. Optional prefix to filter test suites.',
  )
  .option(
    '--prompt <filter>',
    'Filter test cases by prompt content (case-insensitive contains)',
  )
  .option('--html', 'Generate HTML report in addition to JSON report')
  .option('--open', 'Open HTML report in default browser after generation')
  .action(
    (
      prefix?: string,
      options?: { prompt?: string; html?: boolean; open?: boolean },
    ) => evaluateTests(prefix, options?.prompt, options?.html, options?.open),
  )

// Run the program
;(async () => {
  program.parse(process.argv)
})().catch((error: unknown) => {
  logger.writeErrorLine(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
