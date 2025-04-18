import { FileSystem } from '@rushstack/node-core-library'
import { Colorize } from '@rushstack/terminal'

import { logger } from '../utilities/logger'
import { downloadDirectory } from '../utilities/download'

// Default list of available examples
const AVAILABLE_EXAMPLES: string[] = ['getting-started']

/**
 * Initialize project structure
 * @param targetDir Target directory
 * @param exampleName Example name
 */
export async function initProject(
  targetDir: string,
  exampleName: string,
): Promise<void> {
  // Create target directory if it doesn't exist
  if (!(await FileSystem.existsAsync(targetDir))) {
    await FileSystem.ensureFolderAsync(targetDir)
  }

  if (!AVAILABLE_EXAMPLES.includes(exampleName)) {
    logger.writeErrorLine(`Error: Example "${exampleName}" does not exist!`)
    logger.writeErrorLine(
      `Available examples: ${AVAILABLE_EXAMPLES.join(', ')}`,
    )
    process.exit(1)
  }

  try {
    logger.writeLine(`Downloading "${exampleName}" example to ${targetDir}...`)
    await downloadDirectory(`examples/${exampleName}`, targetDir)
    logger.writeLine(
      Colorize.green(
        `✅ Example "${exampleName}" successfully downloaded to ${targetDir}`,
      ),
    )
  } catch (error) {
    logger.writeErrorLine(
      'Error downloading example:',
      error instanceof Error ? error.message : String(error),
    )
    process.exit(1)
  }
}
