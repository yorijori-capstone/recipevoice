/**
 * Cooking Service V2
 * Uses new architecture with Cleaned Recipes, SessionService, and LangChain
 */

import { CookingAgentV2 } from '../agents/cookingAgentV2.js';
import { LangChainAgent } from '../agents/langchainAgent.js';
import { RealtimeServiceV2 } from './realtimeServiceV2.js';

/**
 * Cooking Service V2
 * Single service instance managing the new cooking architecture
 */
export class CookingServiceV2 {
  private apiKey: string;
  private initialized: boolean = false;

  // Core services (singleton instances)
  private cookingAgent: CookingAgentV2 | null = null;
  private langChainAgent: LangChainAgent | null = null;
  private realtimeService: RealtimeServiceV2 | null = null;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Initialize service with all components
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.log('[CookingServiceV2] Already initialized');
      return;
    }

    try {
      console.log('[CookingServiceV2] Initializing...');

      // Step 1: Create CookingAgentV2
      this.cookingAgent = new CookingAgentV2(this.apiKey);
      console.log('[CookingServiceV2] ✅ CookingAgentV2 created');

      // Step 2: Create LangChainAgent
      this.langChainAgent = new LangChainAgent(this.apiKey, this.cookingAgent);
      console.log('[CookingServiceV2] ✅ LangChainAgent created');

      // Step 3: Create RealtimeServiceV2
      this.realtimeService = new RealtimeServiceV2({
        apiKey: this.apiKey,
        cookingAgent: this.cookingAgent,
        langChainAgent: this.langChainAgent,
        model: 'gpt-4o-realtime-preview-2024-10-01',
        voice: 'alloy',
      });
      console.log('[CookingServiceV2] ✅ RealtimeServiceV2 created');

      this.initialized = true;
      console.log('[CookingServiceV2] ✅ Initialized successfully');
    } catch (error) {
      console.error('[CookingServiceV2] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Shutdown service
   */
  async shutdown(): Promise<void> {
    if (!this.initialized) return;

    console.log('[CookingServiceV2] Shutting down...');

    if (this.realtimeService?.isConnected()) {
      this.realtimeService.disconnect();
    }

    this.cookingAgent = null;
    this.langChainAgent = null;
    this.realtimeService = null;
    this.initialized = false;

    console.log('[CookingServiceV2] Shutdown complete');
  }

  /**
   * Get CookingAgentV2 instance
   */
  getCookingAgent(): CookingAgentV2 {
    if (!this.initialized || !this.cookingAgent) {
      throw new Error('CookingServiceV2 not initialized. Call initialize() first.');
    }
    return this.cookingAgent;
  }

  /**
   * Get LangChainAgent instance
   */
  getLangChainAgent(): LangChainAgent {
    if (!this.initialized || !this.langChainAgent) {
      throw new Error('CookingServiceV2 not initialized. Call initialize() first.');
    }
    return this.langChainAgent;
  }

  /**
   * Get RealtimeServiceV2 instance
   */
  getRealtimeService(): RealtimeServiceV2 {
    if (!this.initialized || !this.realtimeService) {
      throw new Error('CookingServiceV2 not initialized. Call initialize() first.');
    }
    return this.realtimeService;
  }

  /**
   * Check if service is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}
