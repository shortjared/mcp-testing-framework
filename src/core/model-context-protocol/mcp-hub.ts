import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { ToolSchema } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { Async } from '@rushstack/node-core-library'

import { VERSION } from '../../constants'
import { logger } from '../../utilities/logger'
import { IMcpServer } from '../../types/evaluate'

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
      transport = new SSEClientTransport(new URL(server.url))
    } else {
      transport = new StreamableHTTPClientTransport(new URL(server.url!))
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

  public async listAllServerTools(): Promise<IServerTool> {
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

    await Async.forEachAsync(this._mcpServers, async (server) => {
      await this._deleteConnect(server.name)
    })

    return serverTools
  }
}
