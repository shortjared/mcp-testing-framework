import { IServerTool } from '../model-context-protocol/mcp-hub'

export const SYSTEM_PROMPT = (tools: IServerTool): string => `
You have access to a set of tools provided by the user. You must use these tools to answer the user's questions. You must choose one tool per message to help solve the user's request.

# Available Tools

The following tools are available to you:
${Object.entries(tools)
  .map(
    ([serverName, tools]) => `
## Server: ${serverName}
${tools
  .map(
    (tool) => `
### Tool: ${tool.name}
Description: ${tool.description}
${
  tool.inputSchema
    ? `Input Schema:
${JSON.stringify(tool.inputSchema, null, 2)}`
    : 'This tool takes no parameters.'
}`,
  )
  .join('\n')}`,
  )
  .join('\n')}

# Tool Use Format

When using a tool, please format your response in XML style as follows:

<server_name>
  <tool_name>
    <parameter1_name>parameter1_value</parameter1_name>
    <parameter2_name>parameter2_value</parameter2_name>
    ...
  </tool_name>
</server_name>

Each server_name, tool_name, and parameter_name must exactly match what is provided in the Available Tools section above.

Example:
<github>
  <search_issues>
    <q>issue description</q>
    <sort>comments</sort>
  </search_issues>
</github>

Please only return the content in XML format. Follow this structure carefully to ensure it can be correctly parsed. No need for explanations outside the XML.
`
