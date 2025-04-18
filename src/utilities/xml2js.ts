import xml2js from 'xml2js'

interface IParsedXml {
  serverName: string
  toolName: string
  parameters: Record<string, any>
}

/**
 * Attempts to convert string to appropriate type (number or boolean)
 * @param value - The string value to convert
 * @returns Converted value or original string if conversion not applicable
 */
function convertValue(value: string): any {
  // Check if the value is a number
  if (/^-?\d+(\.\d+)?$/.test(value)) {
    return Number(value)
  }

  // Check if the value is a boolean
  if (value.toLowerCase() === 'true') {
    return true
  }
  if (value.toLowerCase() === 'false') {
    return false
  }

  // Return original string if not number or boolean
  return value
}

/**
 * Parse the XML string and return the server name, tool name and parameters
 * @param xml - The XML string to parse
 * @returns The server name, tool name and parameters
 *
 * Input Example:
 * <server_name>
 *   <tool_name>
 *     <parameter1_name>parameter1_value</parameter1_name>
 *     <parameter2_name>parameter2_value</parameter2_name>
 *     ...
 *   </tool_name>
 * </server_name>
 *
 * Output Example:
 * {
 *   serverName: 'server_name',
 *   toolName: 'tool_name',
 *   parameters: { parameter1_name: 'parameter1_value', parameter2_name: 'parameter2_value', ... }
 * }
 */
export async function parseXml(xml: string): Promise<IParsedXml> {
  const result = await xml2js.parseStringPromise(xml)

  const serverName = Object.keys(result)[0]

  if (!serverName) {
    throw new Error('Invalid XML: No server name found')
  }

  const serverContent = result[serverName]

  const toolName = Object.keys(serverContent)[0]

  if (!toolName) {
    throw new Error(`Invalid XML: No tool found for server ${serverName}`)
  }

  const toolParams = serverContent[toolName][0]
  const parameters: Record<string, any> = {}

  if (toolParams) {
    Object.keys(toolParams).forEach((key) => {
      parameters[key] = convertValue(toolParams[key][0].trim())
    })
  }

  return {
    serverName,
    toolName,
    parameters,
  }
}
