import { FileSystem } from '@rushstack/node-core-library'
import path from 'path'
import yaml from 'js-yaml'

import { logger } from './logger'
import { IMcpTestingFrameworkConfig, IModelSpec } from '../types/evaluate'

const CONFIG_FILE_NAME: 'mcp-testing-framework.yaml' =
  'mcp-testing-framework.yaml'

export function parseModelSpec(modelSpec: string): IModelSpec {
  const [provider, model] = modelSpec.split(':')
  if (!provider || !model) {
    throw new Error(
      `Invalid model specification: ${modelSpec}. Expected format: provider:model`,
    )
  }
  return { provider, model }
}

export async function findConfigFile(
  startPath: string,
): Promise<string | undefined> {
  let currentDir = startPath

  while (await FileSystem.existsAsync(currentDir)) {
    const configPath = path.join(currentDir, CONFIG_FILE_NAME)

    if (await FileSystem.existsAsync(configPath)) {
      return configPath
    }

    // Stop if we've reached the root directory
    const parentDir = path.dirname(currentDir)
    if (parentDir === currentDir) {
      break
    }

    currentDir = parentDir
  }

  return undefined
}

/**
 * Reads and parses the MCP Testing Framework configuration file
 */
export async function readConfig(
  startPath: string = process.cwd(),
): Promise<IMcpTestingFrameworkConfig | undefined> {
  const filePath = await findConfigFile(startPath)

  if (!filePath) {
    logger.writeWarningLine(
      `Configuration file '${CONFIG_FILE_NAME}' not found in the project directory or its parents.`,
    )
    return undefined
  }

  const content = await FileSystem.readFileAsync(filePath)
  const config = yaml.load(content) as IMcpTestingFrameworkConfig
  return config
}
