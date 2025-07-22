import { FileSystem } from '@rushstack/node-core-library'
import path from 'path'
import yaml from 'js-yaml'

import { logger } from './logger'
import { expandEnvironmentVariablesInObject } from './env-expansion'
import {
  IMcpTestingFrameworkConfig,
  IModelSpec,
  ISuiteInfo,
} from '../types/evaluate'

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
  const configFileName = 'mcp-testing-framework.yaml'

  while (await FileSystem.existsAsync(currentDir)) {
    const configPath = path.join(currentDir, configFileName)

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
 * Validates if a YAML content is a valid MCP Testing Framework configuration
 */
function isValidMcpConfig(content: any): content is IMcpTestingFrameworkConfig {
  if (!content || typeof content !== 'object') {
    return false
  }

  // Check required arrays
  if (
    !Array.isArray(content.modelsToTest) ||
    !Array.isArray(content.testCases) ||
    !Array.isArray(content.mcpServers)
  ) {
    return false
  }

  // Validate test cases have required fields (with backward compatibility)
  for (const testCase of content.testCases) {
    if (!testCase.prompt) {
      return false
    }

    // Must have either expectedToolUsage or expectedOutput (backward compatibility)
    const hasExpectedToolUsage =
      testCase.expectedToolUsage &&
      typeof testCase.expectedToolUsage === 'object'
    const hasExpectedOutput =
      testCase.expectedOutput && typeof testCase.expectedOutput === 'object'

    if (!hasExpectedToolUsage && !hasExpectedOutput) {
      return false
    }

    // If expectedResults provided, validate it has content
    if (
      testCase.expectedResults &&
      (!testCase.expectedResults.content ||
        typeof testCase.expectedResults.content !== 'string')
    ) {
      return false
    }

    // Validate grading prompt if provided
    if (testCase.gradingPrompt && typeof testCase.gradingPrompt !== 'string') {
      return false
    }
  }

  // Validate MCP servers
  for (const server of content.mcpServers) {
    if (!server.name || typeof server.name !== 'string') {
      return false
    }

    // Must have either command or url
    if (!server.command && !server.url) {
      return false
    }

    // Validate headers if provided
    if (server.headers && typeof server.headers !== 'object') {
      return false
    }
  }

  // Validate optional top-level fields
  if (
    content.executeTools !== undefined &&
    typeof content.executeTools !== 'boolean'
  ) {
    return false
  }

  if (
    content.gradingPrompt !== undefined &&
    typeof content.gradingPrompt !== 'string'
  ) {
    return false
  }

  // Validate retry config if provided
  if (content.retryConfig !== undefined) {
    if (typeof content.retryConfig !== 'object') {
      return false
    }

    const retry = content.retryConfig
    if (
      retry.maxRetries !== undefined &&
      (typeof retry.maxRetries !== 'number' || retry.maxRetries < 0)
    ) {
      return false
    }
    if (
      retry.baseDelay !== undefined &&
      (typeof retry.baseDelay !== 'number' || retry.baseDelay < 0)
    ) {
      return false
    }
    if (
      retry.maxDelay !== undefined &&
      (typeof retry.maxDelay !== 'number' || retry.maxDelay < 0)
    ) {
      return false
    }
  }

  return true
}

/**
 * Finds all YAML files in a directory, optionally filtered by prefix
 */
export async function findConfigFiles(
  directory: string,
  prefix?: string,
): Promise<string[]> {
  const configFiles: string[] = []

  if (!(await FileSystem.existsAsync(directory))) {
    return configFiles
  }

  const items = await FileSystem.readFolderAsync(directory)

  for (const item of items) {
    const fullPath = path.join(directory, item)
    const stat = await FileSystem.getStatisticsAsync(fullPath)

    if (stat.isFile() && (item.endsWith('.yaml') || item.endsWith('.yml'))) {
      if (
        !prefix ||
        item === `${prefix}.yaml` ||
        item === `${prefix}.yml` ||
        item.includes(prefix)
      ) {
        configFiles.push(fullPath)
      }
    } else if (stat.isDirectory()) {
      if (!prefix || item === prefix || item.includes(prefix)) {
        // If directory matches prefix, get all files inside without further filtering
        const subFiles = await findConfigFiles(fullPath, undefined)
        configFiles.push(...subFiles)
      } else {
        // Recurse to find matching files inside even if directory doesn't match
        const subFiles = await findConfigFiles(fullPath, prefix)
        configFiles.push(...subFiles)
      }
    }
  }

  return configFiles.sort()
}

/**
 * Reads and validates multiple configuration files
 */
export async function readConfigs(
  directory: string = process.cwd(),
  prefix?: string,
): Promise<ISuiteInfo[]> {
  const configFiles = await findConfigFiles(directory, prefix)
  const suites: ISuiteInfo[] = []

  if (configFiles.length === 0) {
    logger.writeWarningLine(
      prefix
        ? `No configuration files found matching prefix '${prefix}' in '${directory}'.`
        : `No YAML/YML configuration files found in '${directory}'.`,
    )
    return suites
  }

  for (const filePath of configFiles) {
    try {
      const content = await FileSystem.readFileAsync(filePath)
      const config = yaml.load(content)

      if (isValidMcpConfig(config)) {
        const relativePath = path.relative(directory, filePath)
        const suiteName = relativePath
          .replace(/\.(yaml|yml)$/, '')
          .replace(/[\/\\]/g, '-')

        // Expand environment variables in the entire config
        const expandedConfig = expandEnvironmentVariablesInObject(
          config,
        ) as IMcpTestingFrameworkConfig

        suites.push({
          name: suiteName,
          filePath,
          config: expandedConfig,
        })
      } else {
        logger.writeWarningLine(
          `Skipping '${filePath}' - not a valid MCP testing configuration.`,
        )
      }
    } catch (error) {
      logger.writeWarningLine(
        `Failed to parse '${filePath}': ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  return suites
}

/**
 * Reads and parses the MCP Testing Framework configuration file (deprecated)
 */
export async function readConfig(
  startPath: string = process.cwd(),
): Promise<IMcpTestingFrameworkConfig | undefined> {
  const filePath = await findConfigFile(startPath)

  if (!filePath) {
    logger.writeWarningLine(
      `Configuration file 'mcp-testing-framework.yaml' not found in the project directory or its parents.`,
    )
    return undefined
  }

  const content = await FileSystem.readFileAsync(filePath)
  const config = yaml.load(content) as IMcpTestingFrameworkConfig

  // Expand environment variables in the config
  return expandEnvironmentVariablesInObject(config)
}
