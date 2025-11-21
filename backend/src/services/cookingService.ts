/**
 * Cooking Service
 * Manages cooking sessions and coordinates with database
 */

import { pool } from '../db/pool.js';
import { CookingAgent } from '../agents/cookingAgent.js';

export interface RecipeData {
  recipe_id: string;
  title: string;
  servings?: string;
  cook_time?: string;
  difficulty?: string;
  ingredients: Array<{
    name: string;
    quantity: string;
    description?: string;
  }>;
  steps: Array<{
    step_number: number;
    description: string;
    image_url?: string;
    duration?: string;
  }>;
}

/**
 * Cooking Service
 * Single service instance managing cooking sessions
 */
export class CookingService {
  private apiKey: string;
  private initialized: boolean = false;
  private agents: Map<string, CookingAgent> = new Map();

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Initialize service
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.log('[CookingService] Already initialized');
      return;
    }

    try {
      console.log('[CookingService] Initializing...');
      this.initialized = true;
      console.log('[CookingService] Initialized successfully');
    } catch (error) {
      console.error('[CookingService] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Shutdown service
   */
  async shutdown(): Promise<void> {
    if (!this.initialized) return;

    console.log('[CookingService] Shutting down...');
    this.initialized = false;
    console.log('[CookingService] Shutdown complete');
  }

  /**
   * Create a new cooking agent for a session
   */
  createAgent(): CookingAgent {
    if (!this.initialized) {
      throw new Error('CookingService not initialized. Call initialize() first.');
    }

    return new CookingAgent(this.apiKey);
  }

  /**
   * Fetch recipe data from database
   */
  async getRecipeData(recipeId: string): Promise<RecipeData> {
    try {
      console.log(`[CookingService] Fetching recipe: ${recipeId}`);

      // Fetch recipe details
      const recipeQuery = `
        SELECT recipe_id, title, servings, cook_time, difficulty
        FROM recipes
        WHERE recipe_id = $1
      `;
      const recipeResult = await pool.query(recipeQuery, [recipeId]);

      if (recipeResult.rows.length === 0) {
        throw new Error(`Recipe not found: ${recipeId}`);
      }

      const recipe = recipeResult.rows[0];

      // Fetch ingredients
      const ingredientsQuery = `
        SELECT name, quantity, description
        FROM ingredients
        WHERE recipe_id = $1
        ORDER BY display_order
      `;
      const ingredientsResult = await pool.query(ingredientsQuery, [recipeId]);

      // Fetch steps
      const stepsQuery = `
        SELECT step_number, description, image_url, duration
        FROM steps
        WHERE recipe_id = $1
        ORDER BY step_number
      `;
      const stepsResult = await pool.query(stepsQuery, [recipeId]);

      const recipeData: RecipeData = {
        recipe_id: recipe.recipe_id,
        title: recipe.title,
        servings: recipe.servings,
        cook_time: recipe.cook_time,
        difficulty: recipe.difficulty,
        ingredients: ingredientsResult.rows,
        steps: stepsResult.rows
      };

      console.log(`[CookingService] Recipe fetched: ${recipe.title}`);
      return recipeData;
    } catch (error) {
      console.error('[CookingService] Failed to fetch recipe:', error);
      throw error;
    }
  }

  /**
   * Register an agent with its session
   */
  registerAgent(sessionId: string, agent: CookingAgent): void {
    this.agents.set(sessionId, agent);
    console.log(`[CookingService] Agent registered for session: ${sessionId}`);
  }

  /**
   * Get session by sessionId
   */
  getSession(sessionId: string): any {
    const agent = this.agents.get(sessionId);
    if (!agent) {
      return null;
    }
    return agent.getSession(sessionId);
  }

  /**
   * Check if service is ready
   */
  isReady(): boolean {
    return this.initialized;
  }
}

// Global service instance
let cookingServiceInstance: CookingService | null = null;

/**
 * Get or create cooking service instance
 */
export function getCookingService(apiKey?: string): CookingService {
  if (!cookingServiceInstance) {
    if (!apiKey) {
      throw new Error('API key required for first initialization');
    }
    cookingServiceInstance = new CookingService(apiKey);
  }
  return cookingServiceInstance;
}

/**
 * Shutdown global service instance
 */
export async function shutdownCookingService(): Promise<void> {
  if (cookingServiceInstance) {
    await cookingServiceInstance.shutdown();
    cookingServiceInstance = null;
  }
}
