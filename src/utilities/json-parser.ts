interface IParsedJson {
  serverName: string
  toolName: string
  parameters: Record<string, any>
}

/**
 * Parse the JSON string and return the server name, tool name and parameters
 * @param json - The JSON string to parse
 * @returns The server name, tool name and parameters
 *
 * Input Example:
 * {
 *   "serverName": "server_name",
 *   "toolName": "tool_name",
 *   "parameters": {
 *     "parameter1_name": "parameter1_value",
 *     "parameter2_name": "parameter2_value"
 *   }
 * }
 *
 * Output Example:
 * {
 *   serverName: 'server_name',
 *   toolName: 'tool_name',
 *   parameters: { parameter1_name: 'parameter1_value', parameter2_name: 'parameter2_value', ... }
 * }
 */
export function parseJson(json: string): IParsedJson {
  let parsed: any

  try {
    parsed = JSON.parse(json)
  } catch (error) {
    throw new Error(`Invalid JSON: ${error.message}`)
  }

  if (!parsed.serverName) {
    throw new Error('Invalid JSON: No serverName found')
  }

  if (!parsed.toolName) {
    throw new Error(
      `Invalid JSON: No toolName found for server ${parsed.serverName}`,
    )
  }

  if (!parsed.parameters) {
    throw new Error(
      `Invalid JSON: No parameters found for tool ${parsed.toolName}`,
    )
  }

  if (
    typeof parsed.parameters !== 'object' ||
    Array.isArray(parsed.parameters)
  ) {
    throw new Error(
      `Invalid JSON: Parameters must be an object for tool ${parsed.toolName}`,
    )
  }

  // Preserve original parameter types to match schema requirements
  return {
    serverName: parsed.serverName,
    toolName: parsed.toolName,
    parameters: parsed.parameters,
  }
}

// Legacy function for backward compatibility - will be removed in future versions
export async function parseXml(xml: string): Promise<IParsedJson> {
  throw new Error('XML parsing is deprecated. Please use JSON format instead.')
}
