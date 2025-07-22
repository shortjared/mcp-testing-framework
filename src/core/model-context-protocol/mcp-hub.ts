import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { ToolSchema } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { Async } from '@rushstack/node-core-library'

import { VERSION } from '../../constants'
import { logger } from '../../utilities/logger'
import { IMcpServer, IToolExecutionResult } from '../../types/evaluate'

export type Tool = z.infer<typeof ToolSchema>

export interface IServerTool {
  [serverName: string]: Tool[]
}

export interface IMCPConnection {
  client: Client
  transport:
    | StdioClientTransport
    | SSEClientTransport
    | StreamableHTTPClientTransport
  server: {
    name: string
    config: IMcpServer
  }
}

export class McpHub {
  private _connections: IMCPConnection[]
  private _mcpServers: IMcpServer[]

  public constructor(mcpServers: IMcpServer[]) {
    this._connections = []
    this._mcpServers = mcpServers
  }

  private async _connectToServer(server: IMcpServer): Promise<void> {
    const client = new Client({
      name: 'MCP Testing Framework',
      version: VERSION,
    })

    let transport:
      | StdioClientTransport
      | SSEClientTransport
      | StreamableHTTPClientTransport

    if (server.command) {
      transport = new StdioClientTransport({
        command: server.command,
        args: server.args,
        env: server.env,
      })
    } else if (server.url && server.url.includes('sse')) {
      const url = new URL(server.url)
      const options: any = {}
      if (server.headers) {
        options.requestInit = { headers: server.headers }
      }
      transport = new SSEClientTransport(url, options)
    } else {
      const url = new URL(server.url!)
      const options: any = {}
      if (server.headers) {
        options.requestInit = { headers: server.headers }
      }
      transport = new StreamableHTTPClientTransport(url, options)
    }

    const connection: IMCPConnection = {
      client,
      transport,
      server: {
        name: server.name,
        config: server,
      },
    }
    this._connections.push(connection)

    await client.connect(transport)
  }

  private async _listTools(serverName: string): Promise<Tool[]> {
    const connection = this._connections.find(
      (c) => c.server.name === serverName,
    )
    if (!connection) {
      throw new Error(`Server ${serverName} not found`)
    }

    const { tools } = await connection.client.listTools()

    logger.writeLine(
      `Found ${tools.length} tools for server ${serverName}: ${tools.map((tool) => tool.name).join(', ')}\n\n`,
    )

    return tools
  }

  private async _deleteConnect(serverName: string): Promise<void> {
    const connection = this._connections.find(
      (c) => c.server.name === serverName,
    )
    if (connection) {
      try {
        await connection.transport.close()
        await connection.client.close()
      } catch (error) {
        logger.writeErrorLine(
          `Failed to close connection to server ${serverName}:`,
          error,
        )
      }
      this._connections = this._connections.filter(
        (c) => c.server.name !== serverName,
      )
    }
  }

  public async executeTool(
    serverName: string,
    toolName: string,
    parameters: Record<string, any>,
  ): Promise<IToolExecutionResult> {
    const connection = this._connections.find(
      (c) => c.server.name === serverName,
    )

    if (!connection) {
      return {
        success: false,
        error: `Server ${serverName} not connected`,
      }
    }

    try {
      const result = await connection.client.callTool({
        name: toolName,
        arguments: parameters,
      })

      return {
        success: true,
        content: result.content,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  public async connectAllServers(): Promise<void> {
    await Async.forEachAsync(this._mcpServers, async (server) => {
      try {
        await this._connectToServer(server)
        logger.writeLine(`Connected to server: ${server.name}`)
      } catch (error) {
        logger.writeErrorLine(
          `Failed to connect to server ${server.name}:`,
          error,
        )
      }
    })
  }

  public async disconnectAllServers(): Promise<void> {
    await Async.forEachAsync(this._mcpServers, async (server) => {
      await this._deleteConnect(server.name)
    })
  }

  public async listAllServerTools(
    keepConnections: boolean = false,
  ): Promise<IServerTool> {
    const serverTools: IServerTool = {}

    await Async.forEachAsync(this._mcpServers, async (server) => {
      await this._connectToServer(server)

      try {
        const tools = await this._listTools(server.name)
        serverTools[server.name] = tools
      } catch (error) {
        logger.writeErrorLine(
          `Failed to get tool list for server ${server.name}:`,
          error,
        )
      }
    })

    // Only disconnect if we're not keeping connections for tool execution
    if (!keepConnections) {
      await Async.forEachAsync(this._mcpServers, async (server) => {
        await this._deleteConnect(server.name)
      })
    }

    return serverTools
  }
}
