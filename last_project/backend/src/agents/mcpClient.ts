/**
 * MCP (Model Context Protocol) Client
 * Planning Server and RAG Server connection via MCP Tools
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

export interface MCPToolCall {
  name: string;
  arguments: Record<string, any>;
}

export interface MCPToolResult {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * Planning MCP Client
 * - plan_recipe: Convert recipe to voice conversation script
 * - handle_control_command: Handle control commands (pause/resume/retry/clarify)
 */
export class PlanningMCPClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private connected: boolean = false;

  async connect(): Promise<void> {
    try {
      console.log('[Planning MCP] Connecting...');

      // Run TypeScript MCP server
      this.transport = new StdioClientTransport({
        command: 'node',
        args: ['--loader', 'tsx', 'src/index.ts'],
        cwd: 'c:\\Sogang\\last_project\\planning_server_ts'
      });

      this.client = new Client(
        {
          name: 'backend-cooking-agent',
          version: '1.0.0'
        },
        {
          capabilities: {}
        }
      );

      await this.client.connect(this.transport);
      this.connected = true;

      console.log('[Planning MCP] Connected');

      // List available tools
      const tools = await this.client.listTools();
      console.log('[Planning MCP] Available tools:', tools.tools.map((t: any) => t.name));
    } catch (error) {
      console.error('[Planning MCP] Connection failed:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.transport = null;
      this.connected = false;
      console.log('[Planning MCP] Disconnected');
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Convert recipe to voice conversation script
   */
  async planRecipe(recipe: {
    title: string;
    ingredients: Array<{ name: string; quantity: string }>;
    steps: Array<{ order: number; instruction: string }>;
  }): Promise<any> {
    if (!this.client || !this.connected) {
      throw new Error('Planning MCP not connected');
    }

    try {
      console.log('[Planning MCP] Calling plan_recipe tool...');

      const result = await this.client.callTool({
        name: 'plan_recipe',
        arguments: {
          title: recipe.title,
          ingredients: recipe.ingredients,
          steps: recipe.steps
        }
      });

      // Extract TextContent
      const content = result.content as any[];
      if (content && content.length > 0) {
        const textContent = content[0];
        if (textContent.type === 'text') {
          const planData = JSON.parse(textContent.text);
          console.log('[Planning MCP] Recipe planned successfully');
          return planData;
        }
      }

      throw new Error('Invalid response from plan_recipe');
    } catch (error) {
      console.error('[Planning MCP] plan_recipe failed:', error);
      throw error;
    }
  }

  /**
   * Handle control commands (pause/resume/retry/clarify)
   */
  async handleControlCommand(
    command: 'pause' | 'resume' | 'retry' | 'clarify',
    currentStepOrder: number,
    currentStep: any
  ): Promise<any> {
    if (!this.client || !this.connected) {
      throw new Error('Planning MCP not connected');
    }

    try {
      console.log(`[Planning MCP] Calling handle_control_command: ${command}`);

      const result = await this.client.callTool({
        name: 'handle_control_command',
        arguments: {
          command,
          current_step_order: currentStepOrder,
          current_step: currentStep
        }
      });

      // Extract TextContent
      const content = result.content as any[];
      if (content && content.length > 0) {
        const textContent = content[0];
        if (textContent.type === 'text') {
          const controlData = JSON.parse(textContent.text);
          console.log(`[Planning MCP] Control command handled: ${command}`);
          return controlData;
        }
      }

      throw new Error('Invalid response from handle_control_command');
    } catch (error) {
      console.error('[Planning MCP] handle_control_command failed:', error);
      throw error;
    }
  }
}

/**
 * RAG MCP Client
 * - search_recipes: Semantic recipe search
 * - get_recipe_detail: Get recipe detail
 */
export class RAGMCPClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private connected: boolean = false;

  async connect(): Promise<void> {
    try {
      console.log('[RAG MCP] Connecting...');

      // Run Python MCP server
      this.transport = new StdioClientTransport({
        command: 'python',
        args: ['server.py'],
        env: {
          ...process.env,
          PYTHONPATH: 'c:\\Sogang\\last_project\\rag-server'
        }
      });

      this.client = new Client(
        {
          name: 'backend-cooking-agent',
          version: '1.0.0'
        },
        {
          capabilities: {}
        }
      );

      await this.client.connect(this.transport);
      this.connected = true;

      console.log('[RAG MCP] Connected');

      // List available tools
      const tools = await this.client.listTools();
      console.log('[RAG MCP] Available tools:', tools.tools.map((t: any) => t.name));
    } catch (error) {
      console.error('[RAG MCP] Connection failed:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.transport = null;
      this.connected = false;
      console.log('[RAG MCP] Disconnected');
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Semantic recipe search
   */
  async searchRecipes(query: string, topK: number = 5): Promise<any[]> {
    if (!this.client || !this.connected) {
      throw new Error('RAG MCP not connected');
    }

    try {
      console.log(`[RAG MCP] Searching recipes: ${query}`);

      const result = await this.client.callTool({
        name: 'search_recipes',
        arguments: {
          query,
          top_k: topK
        }
      });

      // Extract TextContent
      const content = result.content as any[];
      if (content && content.length > 0) {
        const textContent = content[0];
        if (textContent.type === 'text') {
          const searchResults = JSON.parse(textContent.text);
          console.log(`[RAG MCP] Found ${searchResults.length} recipes`);
          return searchResults;
        }
      }

      return [];
    } catch (error) {
      console.error('[RAG MCP] search_recipes failed:', error);
      throw error;
    }
  }

  /**
   * Get recipe detail
   */
  async getRecipeDetail(recipeId: string): Promise<any> {
    if (!this.client || !this.connected) {
      throw new Error('RAG MCP not connected');
    }

    try {
      console.log(`[RAG MCP] Getting recipe detail: ${recipeId}`);

      const result = await this.client.callTool({
        name: 'get_recipe_detail',
        arguments: {
          recipe_id: recipeId
        }
      });

      // Extract TextContent
      const content = result.content as any[];
      if (content && content.length > 0) {
        const textContent = content[0];
        if (textContent.type === 'text') {
          const recipeDetail = JSON.parse(textContent.text);
          console.log(`[RAG MCP] Recipe detail retrieved: ${recipeDetail.title}`);
          return recipeDetail;
        }
      }

      throw new Error('Recipe not found');
    } catch (error) {
      console.error('[RAG MCP] get_recipe_detail failed:', error);
      throw error;
    }
  }
}
