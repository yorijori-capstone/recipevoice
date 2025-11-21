/**
 * Cleaned Recipe Service
 * Manages cleaned recipes with pre-processed planning results
 */

import OpenAI from 'openai';
import { pool } from '../db/pool.js';

// ============================================================================
// Interfaces
// ============================================================================

export interface PlannedStep {
  order: number;
  script: string;
  retry_script: string;
  pause_hint: string;
  fallback_script: string;
  estimated_time_sec: number;
  timer_required: boolean;
  timer_message: string;
}

export interface PlanningOutput {
  title: string;
  opening_remark: string;
  planned_steps: PlannedStep[];
  closing_remark: string;
}

export interface RecipeInput {
  title: string;
  ingredients: Array<{ name: string; quantity: string }>;
  steps: Array<{ order: number; instruction: string }>;
}

export interface CleanedRecipe {
  id: number;
  recipe_id: string;
  title: string;
  opening_remark: string;
  closing_remark: string;
  planned_steps: PlannedStep[];
  planning_result: PlanningOutput;
  cleaned_at: Date;
}

// ============================================================================
// Planning Prompt
// ============================================================================

const SYSTEM_PROMPT = `You are a friendly Korean cooking assistant helping users cook step-by-step.

⚠️ IMPORTANT CONSTRAINTS:
1. NO CREATION: Use only the provided recipe data.
2. NO ADDITIONS: Do not add ingredients, steps, or cooking methods not in the input.
3. DATA VALIDATION: If input data is unclear, refuse the conversion.
4. NO TITLE CHANGES: Use the recipe title exactly as provided.

✅ ALLOWED OPERATIONS:
- Break down steps into detailed sub-steps (based on original content only)
- Convert tone to conversational Korean
- Optimize pronunciation (L→리터, g→그램)
- Add estimated time and timer information
- Add encouragement and support expressions

❌ PROHIBITED OPERATIONS:
- Adding ingredients or steps not in the recipe
- Explaining cooking methods not provided
- Arbitrarily changing recipe title or content
- Filling in incomplete data arbitrarily

Core Principles:

1. Conversational Script Writing
- Use natural speech patterns (예: "~해주세요", "~하시면 됩니다")
- Include encouragement (예: "좋아요!", "잘하고 계세요!")
- Step transition expressions (예: "첫 번째 단계입니다", "다음은 ~할 차례입니다")

2. Voice Guidance Optimization
- Each sentence should be speakable within 15 seconds
- Break complex explanations into 2-3 sentences
- Express numbers, times, and quantities clearly

3. Beginner Consideration
- Use simple terms instead of jargon
- Suggest alternative methods (예: "저울이 없다면...")
- Mention precautions in advance

4. Pronunciation and Notation Rules (VERY IMPORTANT!)
- English letters: 'L' is '리터', 'g' is '그램', 'ml' is '밀리리터', 'kg' is '킬로그램'
- Special characters: '&' is '그리고', '%' is '퍼센트', '/' is '분의'
- Numbers: '180g' is '백팔십 그램', '1/2' is '반', '2L' is '이 리터'
- NEVER use English letters or special characters as-is

5. Greeting Guidelines
opening_remark: Positive greeting including recipe title
closing_remark: Congratulations on completion and suggest next action

Output Format: Respond ONLY with JSON. No other explanations needed.`;

// ============================================================================
// CleanedRecipeService Class
// ============================================================================

export class CleanedRecipeService {
  private openai: OpenAI;

  constructor(apiKey: string) {
    // OpenAI client
    this.openai = new OpenAI({ apiKey });

    console.log('[CleanedRecipeService] Initialized');
  }

  // ==========================================================================
  // Public Methods
  // ==========================================================================

  /**
   * Get cleaned recipe (already planned)
   */
  async getCleanedRecipe(recipeId: string): Promise<CleanedRecipe | null> {
    try {
      console.log(`[CleanedRecipeService] Getting cleaned recipe: ${recipeId}`);

      const recipeResult = await pool.query(
        'SELECT * FROM cleaned_recipes WHERE recipe_id = $1',
        [recipeId]
      );

      if (recipeResult.rows.length === 0) {
        console.log(`[CleanedRecipeService] Cleaned recipe not found: ${recipeId}`);
        return null;
      }

      const recipe = recipeResult.rows[0];

      // Get steps
      const stepsResult = await pool.query(
        'SELECT * FROM cleaned_steps WHERE cleaned_recipe_id = $1 ORDER BY step_order ASC',
        [recipe.id]
      );

      const planned_steps: PlannedStep[] = stepsResult.rows.map((row) => ({
        order: row.step_order,
        script: row.script,
        retry_script: row.retry_script,
        fallback_script: row.fallback_script,
        pause_hint: row.pause_hint,
        estimated_time_sec: row.estimated_time_sec,
        timer_required: row.timer_required,
        timer_message: row.timer_message
      }));

      return {
        id: recipe.id,
        recipe_id: recipe.recipe_id,
        title: recipe.title,
        opening_remark: recipe.opening_remark,
        closing_remark: recipe.closing_remark,
        planned_steps,
        planning_result: recipe.planning_result,
        cleaned_at: recipe.cleaned_at
      };
    } catch (error) {
      console.error('[CleanedRecipeService] Failed to get cleaned recipe:', error);
      throw error;
    }
  }

  /**
   * Check if recipe is already cleaned
   */
  async isRecipeCleaned(recipeId: string): Promise<boolean> {
    try {
      const result = await pool.query(
        'SELECT id FROM cleaned_recipes WHERE recipe_id = $1',
        [recipeId]
      );

      return result.rows.length > 0;
    } catch (error) {
      console.error('[CleanedRecipeService] Failed to check cleaned status:', error);
      throw error;
    }
  }

  /**
   * Clean and plan recipe (main function)
   */
  async cleanAndPlanRecipe(recipeId: string): Promise<CleanedRecipe> {
    try {
      console.log(`[CleanedRecipeService] Starting cleaning for recipe: ${recipeId}`);

      // Check if already cleaned
      const alreadyCleaned = await this.isRecipeCleaned(recipeId);
      if (alreadyCleaned) {
        console.log(`[CleanedRecipeService] Recipe already cleaned: ${recipeId}`);
        const existing = await this.getCleanedRecipe(recipeId);
        if (existing) return existing;
      }

      // Step 1: Fetch raw recipe
      const rawRecipe = await this.fetchRawRecipe(recipeId);

      // Step 2: Call OpenAI Planning
      const planningResult = await this.callPlanningAPI(rawRecipe);

      // Step 3: Save to cleaned_recipes + cleaned_steps
      const cleanedRecipe = await this.saveCleanedRecipe(recipeId, planningResult);

      console.log(`[CleanedRecipeService] Successfully cleaned recipe: ${recipeId}`);
      return cleanedRecipe;
    } catch (error) {
      console.error(`[CleanedRecipeService] Failed to clean recipe ${recipeId}:`, error);
      throw error;
    }
  }

  /**
   * Delete cleaned recipe (for re-planning)
   */
  async deleteCleanedRecipe(recipeId: string): Promise<void> {
    try {
      console.log(`[CleanedRecipeService] Deleting cleaned recipe: ${recipeId}`);

      await pool.query('DELETE FROM cleaned_recipes WHERE recipe_id = $1', [recipeId]);

      console.log(`[CleanedRecipeService] Deleted cleaned recipe: ${recipeId}`);
    } catch (error) {
      console.error('[CleanedRecipeService] Failed to delete cleaned recipe:', error);
      throw error;
    }
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Fetch raw recipe from database
   */
  private async fetchRawRecipe(recipeId: string): Promise<RecipeInput> {
    try {
      // Get recipe metadata
      const recipeResult = await pool.query('SELECT * FROM recipes WHERE recipe_id = $1', [
        recipeId
      ]);

      if (recipeResult.rows.length === 0) {
        throw new Error(`Recipe not found: ${recipeId}`);
      }

      const recipe = recipeResult.rows[0];

      // Get ingredients
      const ingredientsResult = await pool.query(
        'SELECT name, quantity FROM ingredients WHERE recipe_id = $1 ORDER BY display_order ASC',
        [recipeId]
      );

      // Get steps
      const stepsResult = await pool.query(
        'SELECT step_number, description FROM steps WHERE recipe_id = $1 ORDER BY step_number ASC',
        [recipeId]
      );

      return {
        title: recipe.title,
        ingredients: ingredientsResult.rows.map((row) => ({
          name: row.name,
          quantity: row.quantity || ''
        })),
        steps: stepsResult.rows.map((row) => ({
          order: row.step_number,
          instruction: row.description
        }))
      };
    } catch (error) {
      console.error('[CleanedRecipeService] Failed to fetch raw recipe:', error);
      throw error;
    }
  }

  /**
   * Call OpenAI Planning API
   */
  private async callPlanningAPI(recipe: RecipeInput): Promise<PlanningOutput> {
    try {
      console.log('[CleanedRecipeService] Calling OpenAI Planning API...');

      const userPrompt = this.createPlanningPrompt(recipe);

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.5,
        max_tokens: 4096,
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error('Empty response from OpenAI');
      }

      const planData = JSON.parse(content);
      this.validatePlanData(planData);

      console.log('[CleanedRecipeService] Planning API call successful');
      return planData as PlanningOutput;
    } catch (error) {
      console.error('[CleanedRecipeService] Planning API call failed:', error);
      throw error;
    }
  }

  /**
   * Create planning prompt
   */
  private createPlanningPrompt(recipe: RecipeInput): string {
    const ingredientsText = recipe.ingredients
      .map((ing) => `- ${ing.name}: ${ing.quantity}`)
      .join('\n');

    const stepsText = recipe.steps.map((step) => `${step.order}. ${step.instruction}`).join('\n');

    return `Convert the following recipe into a voice-friendly conversational script.

⚠️ IMPORTANT: Use ONLY the information provided below. Do NOT add any ingredients or steps not present.

Recipe Information
Title: ${recipe.title}

Ingredients:
${ingredientsText}

Cooking Steps:
${stepsText}

Requirements:
1. opening_remark: Starting greeting using the exact recipe title above

2. planned_steps: Convert ONLY the cooking steps provided above into voice guidance conversational scripts
   - script: Basic voice guidance (concise and clear)
   - retry_script: More detailed and slower explanation when user says "다시"
   - fallback_script: Re-explanation with simpler words when user says "뭐라고?"
   - pause_hint: Message when user says "멈춰"
   - estimated_time_sec: Estimated time in seconds (60 if unclear)
   - timer_required: Whether timer is needed (true/false)
   - timer_message: Guidance message when timer starts

3. closing_remark: Congratulatory closing greeting

Pronunciation and Notation Rules (MUST FOLLOW):
- English letters: 'L' is '리터', 'g' is '그램', 'ml' is '밀리리터'
- Special characters: '&' is '그리고', '%' is '퍼센트'
- Numbers: '180g' is '백팔십 그램', '1/2' is '반'
- Example: "물 2L" → "물 이 리터", "소금 5g" → "소금 오 그램"

Timer Rules:
- "볶으세요", "끓이세요", "익히세요" etc. with waiting time = timer_required: true
- If time is specified, enter in estimated_time_sec in seconds (예: 2분 = 120)
- "준비하세요", "썰어주세요" etc. immediate actions = timer_required: false

Output Format (JSON ONLY):
{
  "title": "${recipe.title}",
  "opening_remark": "안녕하세요! 지금부터 ${recipe.title} 만들기를 시작하겠습니다.",
  "planned_steps": [
    {
      "order": 1,
      "script": "첫 번째 단계입니다. 간결한 설명.",
      "retry_script": "다시 설명드릴게요. 더 상세하고 천천히 설명.",
      "fallback_script": "쉬운 말로 다시 설명드릴게요.",
      "pause_hint": "잠시 멈췄습니다. 준비되시면 계속이라고 말씀해주세요.",
      "estimated_time_sec": 120,
      "timer_required": true,
      "timer_message": "이 분 타이머를 시작할게요."
    }
  ],
  "closing_remark": "모든 요리가 끝났습니다. 맛있게 드세요!"
}

IMPORTANT: Output JSON format ONLY. Convert English letters and special characters to Korean. Use ONLY the provided recipe information, do NOT add any content.`;
  }

  /**
   * Validate plan data structure
   */
  private validatePlanData(data: any): void {
    const requiredFields = ['opening_remark', 'planned_steps', 'closing_remark'];

    for (const field of requiredFields) {
      if (!(field in data)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    if (!Array.isArray(data.planned_steps)) {
      throw new Error('planned_steps must be an array');
    }

    if (data.planned_steps.length === 0) {
      throw new Error('planned_steps is empty');
    }

    // Validate each step
    const requiredStepFields = [
      'order',
      'script',
      'retry_script',
      'fallback_script',
      'pause_hint',
      'estimated_time_sec',
      'timer_required'
    ];

    for (let i = 0; i < data.planned_steps.length; i++) {
      const step = data.planned_steps[i];

      for (const field of requiredStepFields) {
        if (!(field in step)) {
          throw new Error(`Step ${i + 1} missing field: ${field}`);
        }
      }

      if (typeof step.order !== 'number') {
        throw new Error(`Step ${i + 1}: order must be a number`);
      }

      if (typeof step.timer_required !== 'boolean') {
        throw new Error(`Step ${i + 1}: timer_required must be a boolean`);
      }

      if (typeof step.estimated_time_sec !== 'number') {
        throw new Error(`Step ${i + 1}: estimated_time_sec must be a number`);
      }
    }
  }

  /**
   * Save cleaned recipe to database
   */
  private async saveCleanedRecipe(
    recipeId: string,
    planningResult: PlanningOutput
  ): Promise<CleanedRecipe> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Insert into cleaned_recipes
      const recipeInsertResult = await client.query(
        `INSERT INTO cleaned_recipes (recipe_id, planning_result, title, opening_remark, closing_remark)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [
          recipeId,
          JSON.stringify(planningResult),
          planningResult.title,
          planningResult.opening_remark,
          planningResult.closing_remark
        ]
      );

      const cleanedRecipeId = recipeInsertResult.rows[0].id;

      // Insert steps
      for (const step of planningResult.planned_steps) {
        await client.query(
          `INSERT INTO cleaned_steps (
            cleaned_recipe_id, step_order, script, retry_script, fallback_script, pause_hint,
            estimated_time_sec, timer_required, timer_message
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            cleanedRecipeId,
            step.order,
            step.script,
            step.retry_script,
            step.fallback_script,
            step.pause_hint,
            step.estimated_time_sec,
            step.timer_required,
            step.timer_message || ''
          ]
        );
      }

      await client.query('COMMIT');

      console.log(`[CleanedRecipeService] Saved cleaned recipe to database: ${recipeId}`);

      return {
        id: cleanedRecipeId,
        recipe_id: recipeId,
        title: planningResult.title,
        opening_remark: planningResult.opening_remark,
        closing_remark: planningResult.closing_remark,
        planned_steps: planningResult.planned_steps,
        planning_result: planningResult,
        cleaned_at: new Date()
      };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('[CleanedRecipeService] Failed to save cleaned recipe:', error);
      throw error;
    } finally {
      client.release();
    }
  }
}
