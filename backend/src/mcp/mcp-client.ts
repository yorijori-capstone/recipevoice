/**
 * MCP Client Wrapper
 * Connects OpenAI Realtime API Tool Calling to MCP Servers
 * Phase 3: V3 Architecture
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// MCP Client Manager
// ============================================================================

export class MCPClientManager {
  private navigationClient: Client | null = null;
  private timerClient: Client | null = null;
  private navigationProcess: ChildProcess | null = null;
  private timerProcess: ChildProcess | null = null;

  /**
   * Initialize both MCP servers
   */
  async initialize(): Promise<void> {
    console.log('[MCP Client] Initializing MCP servers...');

    try {
      // Start Navigation Server
      await this.startNavigationServer();

      // Start Timer Server
      await this.startTimerServer();

      console.log('[MCP Client] All MCP servers initialized successfully');
    } catch (error) {
      console.error('[MCP Client] Failed to initialize MCP servers:', error);
      throw error;
    }
  }

  /**
   * Start Navigation MCP Server
   */
  private async startNavigationServer(): Promise<void> {
    // Use .ts extension and tsx for development, .js and node for production
    const isDev = __filename.endsWith('.ts');
    const serverPath = isDev
      ? path.join(__dirname, 'navigation-server.ts')
      : path.join(__dirname, 'navigation-server.js');
    
    // Windows compatibility: use .cmd extension for npx
    const isWindows = process.platform === 'win32';
    const command = isDev ? (isWindows ? 'npx.cmd' : 'npx') : 'node';
    const args = isDev ? ['tsx', serverPath] : [serverPath];

    this.navigationProcess = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
    });

    this.navigationProcess.stderr?.on('data', (data) => {
      console.log(`[Navigation Server] ${data.toString().trim()}`);
    });

    this.navigationProcess.on('error', (error) => {
      console.error('[Navigation Server] Process error:', error);
    });

    const transport = new StdioClientTransport({
      command,
      args,
    });

    this.navigationClient = new Client(
      {
        name: 'yorijori-navigation-client',
        version: '1.0.0',
      },
      {
        capabilities: {},
      }
    );

    await this.navigationClient.connect(transport);
    console.log('[MCP Client] Navigation server connected');
  }

  /**
   * Start Timer MCP Server
   */
  private async startTimerServer(): Promise<void> {
    // Use .ts extension and tsx for development, .js and node for production
    const isDev = __filename.endsWith('.ts');
    const serverPath = isDev
      ? path.join(__dirname, 'timer-server.ts')
      : path.join(__dirname, 'timer-server.js');
    
    // Windows compatibility: use .cmd extension for npx
    const isWindows = process.platform === 'win32';
    const command = isDev ? (isWindows ? 'npx.cmd' : 'npx') : 'node';
    const args = isDev ? ['tsx', serverPath] : [serverPath];

    this.timerProcess = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
    });

    this.timerProcess.stderr?.on('data', (data) => {
      console.log(`[Timer Server] ${data.toString().trim()}`);
    });

    this.timerProcess.on('error', (error) => {
      console.error('[Timer Server] Process error:', error);
    });

    const transport = new StdioClientTransport({
      command,
      args,
    });

    this.timerClient = new Client(
      {
        name: 'yorijori-timer-client',
        version: '1.0.0',
      },
      {
        capabilities: {},
      }
    );

    await this.timerClient.connect(transport);
    console.log('[MCP Client] Timer server connected');
  }

  /**
   * Execute a tool on the appropriate MCP server
   */
  async executeTool(toolName: string, args: any): Promise<any> {
    console.log(`[MCP Client] Executing tool: ${toolName}`, args);

    try {
      // Route to appropriate server
      if (this.isNavigationTool(toolName)) {
        if (!this.navigationClient) {
          throw new Error('Navigation client not initialized');
        }

        const result = await this.navigationClient.callTool({
          name: toolName,
          arguments: args,
        });

        return this.parseToolResult(result);
      } else if (this.isTimerTool(toolName)) {
        if (!this.timerClient) {
          throw new Error('Timer client not initialized');
        }

        const result = await this.timerClient.callTool({
          name: toolName,
          arguments: args,
        });

        return this.parseToolResult(result);
      } else {
        throw new Error(`Unknown tool: ${toolName}`);
      }
    } catch (error: any) {
      console.error(`[MCP Client] Tool execution failed: ${toolName}`, error);
      throw error;
    }
  }

  /**
   * Get all available tools for Realtime API
   */
  async getToolDefinitions(): Promise<any[]> {
    const tools: any[] = [];

    try {
      // Get navigation tools
      if (this.navigationClient) {
        const navTools = await this.navigationClient.listTools();
        tools.push(...navTools.tools);
      }

      // Get timer tools
      if (this.timerClient) {
        const timerTools = await this.timerClient.listTools();
        tools.push(...timerTools.tools);
      }

      console.log(`[MCP Client] Loaded ${tools.length} tools`);
      return tools;
    } catch (error) {
      console.error('[MCP Client] Failed to get tool definitions:', error);
      return [];
    }
  }

  /**
   * Check if tool is a navigation tool
   */
  private isNavigationTool(toolName: string): boolean {
    return [
      'navigate_next_step',
      'navigate_previous_step',
      'navigate_to_step',
      'get_current_step',
    ].includes(toolName);
  }

  /**
   * Check if tool is a timer tool
   */
  private isTimerTool(toolName: string): boolean {
    return ['start_timer', 'stop_timer', 'check_timer'].includes(toolName);
  }

  /**
   * Parse MCP tool result
   */
  private parseToolResult(result: any): any {
    if (!result.content || result.content.length === 0) {
      throw new Error('Empty tool result');
    }

    const content = result.content[0];

    if (content.type === 'text') {
      return JSON.parse(content.text);
    }

    throw new Error(`Unsupported content type: ${content.type}`);
  }

  /**
   * Shutdown all MCP servers
   */
  async shutdown(): Promise<void> {
    console.log('[MCP Client] Shutting down MCP servers...');

    try {
      if (this.navigationClient) {
        await this.navigationClient.close();
      }

      if (this.timerClient) {
        await this.timerClient.close();
      }

      if (this.navigationProcess) {
        this.navigationProcess.kill();
      }

      if (this.timerProcess) {
        this.timerProcess.kill();
      }

      console.log('[MCP Client] All MCP servers shut down');
    } catch (error) {
      console.error('[MCP Client] Error during shutdown:', error);
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let mcpClientInstance: MCPClientManager | null = null;

export async function getMCPClient(): Promise<MCPClientManager> {
  if (!mcpClientInstance) {
    mcpClientInstance = new MCPClientManager();
    await mcpClientInstance.initialize();
  }
  return mcpClientInstance;
}

export async function shutdownMCPClient(): Promise<void> {
  if (mcpClientInstance) {
    await mcpClientInstance.shutdown();
    mcpClientInstance = null;
  }
}
