/**
 * Cooking Service V3
 * V3 Architecture: MCP Tool Calling only
 */

import { CookingAgentV3 } from '../agents/cookingAgentV3.js';
// import { RealtimeServiceV3 } from './realtimeServiceV3.js'; // Removed singleton
import { getMCPClient, shutdownMCPClient, MCPClientManager } from '../mcp/mcp-client.js';

/**
 * Cooking Service V3
 * Single service instance managing the V3 cooking architecture
 */
export class CookingServiceV3 {
  private apiKey: string;
  private initialized: boolean = false;

  // Core services (singleton instances)
  private cookingAgent: CookingAgentV3 | null = null;
  // private realtimeService: RealtimeServiceV3 | null = null; // Removed singleton
  private mcpClient: MCPClientManager | null = null;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Initialize service with all components
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.log('[CookingServiceV3] Already initialized');
      return;
    }

    try {
      console.log('[CookingServiceV3] Initializing...');

      // Step 1: Create CookingAgentV3
      this.cookingAgent = new CookingAgentV3(this.apiKey);
      console.log('[CookingServiceV3] ✅ CookingAgentV3 created');

      // Step 2: Initialize MCP Client
      try {
        this.mcpClient = await getMCPClient();
        console.log('[CookingServiceV3] ✅ MCP Client initialized');
      } catch (error) {
        console.warn('[CookingServiceV3] ⚠️ MCP Client failed to initialize, continuing without MCP:', error);
        this.mcpClient = null;
      }

      // Step 3: Set MCP Client on Agent
      this.cookingAgent.setMCPClient(this.mcpClient);
      console.log('[CookingServiceV3] ✅ MCP Client set on Agent');

      // RealtimeServiceV3 is now managed by CookingAgentV3 per session

      this.initialized = true;
      console.log('[CookingServiceV3] ✅ Initialized successfully (V3 Architecture - MCP Only)');
    } catch (error) {
      console.error('[CookingServiceV3] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Shutdown service
   */
  async shutdown(): Promise<void> {
    if (!this.initialized) return;

    console.log('[CookingServiceV3] Shutting down...');

    // if (this.realtimeService?.isConnected()) {
    //   this.realtimeService.disconnect();
    // }

    if (this.mcpClient) {
      await shutdownMCPClient();
    }

    this.cookingAgent = null;
    // this.realtimeService = null;
    this.mcpClient = null;
    this.initialized = false;

    console.log('[CookingServiceV3] Shutdown complete');
  }

  /**
   * Get CookingAgentV3 instance
   */
  getCookingAgent(): CookingAgentV3 {
    if (!this.initialized || !this.cookingAgent) {
      throw new Error('CookingServiceV3 not initialized. Call initialize() first.');
    }
    return this.cookingAgent;
  }

  /**
   * Get RealtimeServiceV3 instance
   */
  // getRealtimeService(): RealtimeServiceV3 {
  //   if (!this.initialized || !this.realtimeService) {
  //     throw new Error('CookingServiceV3 not initialized. Call initialize() first.');
  //   }
  //   return this.realtimeService;
  // }

  /**
   * Check if service is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}
