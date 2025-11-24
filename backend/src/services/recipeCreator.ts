/**
 * Recipe Creator
 * AI-powered recipe generation and recommendation using GPT-5-nano
 */

import OpenAI from 'openai';
import { PlanningOutput } from './recipeCleaner.js';

// ============================================================================
// Interfaces
// ============================================================================

export interface RecipeRecommendation {
  title: string;
  reason: string;
  difficulty: string;
  cook_time: string;
}

// ============================================================================
// System Prompts
// ============================================================================

// Use the same SYSTEM_PROMPT as RecipeCleaner for consistent PlanningOutput format
const GENERATION_SYSTEM_PROMPT = `# System Prompt: Recipe Creation

## Role

You are an expert "Recipe Creator" and "Chef". Your goal is to create new recipes based on user requests (ingredients, servings, difficulty, cooking methods, etc.) and output them in the strictly defined "Interactive Cooking Schema" JSON format.

## Objective

Generate a complete, realistic Korean recipe based on the user's request. Analyze the user's input to extract:
- Desired ingredients (mentioned explicitly or implied)
- Number of servings (if specified)
- Difficulty level (if specified: easy/medium/hard)
- Cooking methods (if specified: boiling, frying, steaming, etc.)
- Any other preferences or constraints

**CRITICAL:** ALL string values in the output (titles, descriptions, ingredient names, tips) MUST be in **Korean (한국어)**.

**CREATION RULES:**
- If the user mentions specific ingredients, use them as the main ingredients
- If the user mentions a dish name (e.g., "김치찌개"), create an authentic version of that dish
- If the user mentions servings (e.g., "2인분", "4인분"), use that number
- If the user mentions difficulty (e.g., "쉬운", "어려운"), map it to Easy/Medium/Hard
- If the user mentions cooking methods, incorporate them into the process steps
- Infer reasonable values for missing information based on culinary knowledge
- Create logical, sequential cooking steps that make sense
- Include appropriate tools, heat levels, and timers based on the cooking methods

## Output Schema Structure

You must strictly follow this JSON structure (same as RecipeCleaner):

\`\`\`json
{
  "meta": {
    "title": "String (한국어 요리명)",
    "description": "String (한 줄 요약, 한국어)",
    "servings": Integer (인분 수, 숫자 타입, 문자열 금지),
    "time_estimate": Integer (총 조리 시간, 분 단위, 숫자 타입, 문자열 금지),
    "difficulty": "String - MUST be exactly: Easy, Medium, or Hard (capitalized, not lowercase)"
  },
  "ingredients": {
    "main": [
      { "name": "String (재료명, 한국어)", "amount": Number (숫자 타입, 문자열 금지), "unit": "String (단위, 한국어)", "notes": "String (손질 상태 등, 한국어, 선택사항)" }
    ],
    "sub": [
      { "name": "String (양념/부재료, 한국어)", "amount": Number, "unit": "String (단위, 한국어)", "usage": "String (용도, 예: 양념장용)" }
    ]
  },
  "tools": [
    "String (필요한 모든 도구 목록, 한국어. 문맥상 추론된 도구 포함. 예: '냄비', '도마', '체')"
  ],
  "process": [
    {
      "phase": "String - MUST be exactly one of: preparation, cooking, finishing (lowercase)",
      "step_index": Integer (1부터 시작, 숫자 타입),
      "action_type": "String - MUST be exactly one of these lowercase verbs: wash, cut, boil, fry, mix, simmer, season, glaze, drain, bake, steam, grill, roast, slice, chop, mince, peel, grate, blend, whisk, knead, roll, spread, stuff, wrap, layer, stir, soak",
      "description": "String (사용자에게 지시할 구체적인 행동, 한국어 경어체)",
      "ingredients_needed": ["String (이 단계에 쓰이는 재료명, 한국어)"] - MUST be array, use [] if empty,
      "tools_needed": ["String (이 단계에 쓰이는 도구명, 한국어)"] - MUST be array, use [] if empty,
      "heat_level": "String - MUST be exactly: High, Medium, Low, Off (capitalized) or null",
      "timer_seconds": Integer (추정 소요 시간(초), 불확실하면 null - 숫자 또는 null, 문자열 금지),
      "tip": "String (주의사항이나 꿀팁, 한국어, 선택사항)"
    }
  ]
}
\`\`\`

## STRICT JSON FORMATTING RULES (MUST FOLLOW EXACTLY)

1. **action_type**: MUST be lowercase (e.g., "fry" not "Fry")
2. **phase**: MUST be lowercase (e.g., "cooking" not "Cooking")
3. **difficulty**: MUST be capitalized (e.g., "Medium" not "medium")
4. **heat_level**: MUST be capitalized or null (e.g., "High" not "high")
5. **All numbers**: MUST be numbers, not strings (e.g., 2 not "2")
6. **All arrays**: MUST be arrays, not null (use [] for empty arrays)
7. **step_index**: MUST start from 1 and increment sequentially (1, 2, 3, ...)

Output Format: Respond ONLY with valid JSON. No other explanations needed.`;

const RECOMMENDATION_SYSTEM_PROMPT = `You are a Korean food recommendation expert.
Suggest recipes based on user preferences, dietary restrictions, or ingredients.

Guidelines:
1. Consider Korean cuisine diversity
2. Match user's skill level
3. Suggest seasonal ingredients when possible
4. Provide reasoning for each recommendation

Output Format: JSON only, no explanations.`;

// ============================================================================
// RecipeCreator Class
// ============================================================================

export class RecipeCreator {
  private openai: OpenAI;

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
    console.log('[RecipeCreator] Initialized');
  }

  // ==========================================================================
  // Public Methods
  // ==========================================================================

  /**
   * Generate recipe from natural language prompt
   * Returns PlanningOutput format (same as RecipeCleaner)
   */
  async generateRecipe(userPrompt: string): Promise<PlanningOutput> {
    try {
      console.log(`[RecipeCreator] Generating recipe for: "${userPrompt}"`);

      const prompt = this.createGenerationPrompt(userPrompt);

      const response = await this.openai.chat.completions.create({
        model: 'gpt-5-nano',
        messages: [
          { role: 'system', content: GENERATION_SYSTEM_PROMPT },
          { role: 'user', content: prompt }
        ],
        max_completion_tokens: 128000,
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error('Empty response from OpenAI');
      }

      const planningOutput = JSON.parse(content);
      this.validatePlanningOutput(planningOutput);

      console.log(`[RecipeCreator] Successfully generated recipe: ${planningOutput.meta.title}`);
      return planningOutput as PlanningOutput;
    } catch (error) {
      console.error('[RecipeCreator] Recipe generation failed:', error);
      throw error;
    }
  }

  /**
   * Recommend recipes based on preferences
   */
  async recommendRecipes(preferences: string): Promise<RecipeRecommendation[]> {
    try {
      console.log(`[RecipeCreator] Getting recommendations for: "${preferences}"`);

      const prompt = this.createRecommendationPrompt(preferences);

      const response = await this.openai.chat.completions.create({
        model: 'gpt-5-nano',
        messages: [
          { role: 'system', content: RECOMMENDATION_SYSTEM_PROMPT },
          { role: 'user', content: prompt }
        ],
        max_completion_tokens: 1024,
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error('Empty response from OpenAI');
      }

      const result = JSON.parse(content);
      const recommendations = result.recommendations || [];

      console.log(`[RecipeCreator] Generated ${recommendations.length} recommendations`);
      return recommendations as RecipeRecommendation[];
    } catch (error) {
      console.error('[RecipeCreator] Recipe recommendation failed:', error);
      throw error;
    }
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Create generation prompt
   * Analyzes user input to extract ingredients, servings, difficulty, cooking methods, etc.
   */
  private createGenerationPrompt(userPrompt: string): string {
    return `Create a complete Korean recipe based on this user request: "${userPrompt}"

Analyze the user's input and extract:
- Ingredients mentioned (use as main ingredients)
- Number of servings if specified (e.g., "2인분" → servings: 2, "4인분" → servings: 4)
- Difficulty level if specified (e.g., "쉬운", "쉽게" → Easy, "보통" → Medium, "어려운" → Hard)
- Cooking methods if specified (e.g., "끓이기" → boil, "볶기" → fry, "찌기" → steam)
- Any other preferences or constraints

If information is missing, use your culinary knowledge to infer reasonable values:
- If no servings specified, default to 2 servings
- If no difficulty specified, estimate based on the dish complexity
- If no cooking method specified, choose appropriate methods for the dish
- Create a meaningful Korean dish name based on ingredients and methods

Generate a complete recipe following the PlanningOutput schema structure:
- meta: title, description, servings (number), time_estimate (number, minutes), difficulty ("Easy"/"Medium"/"Hard")
- ingredients: main and sub arrays with name, amount (number), unit, notes/usage
- tools: array of required tools (infer from cooking methods)
- process: array of process steps with phase, step_index, action_type, description, ingredients_needed, tools_needed, heat_level, timer_seconds, tip

IMPORTANT: 
- Output ONLY valid JSON in PlanningOutput format
- All text must be in Korean
- Numbers must be numbers, not strings
- step_index must start from 1 and increment sequentially
- Use appropriate action_type (lowercase) and phase (lowercase) values
- Infer tools, heat levels, and timers based on cooking methods`;
  }

  /**
   * Create recommendation prompt
   */
  private createRecommendationPrompt(preferences: string): string {
    return `Recommend 3 Korean recipes based on these preferences: "${preferences}"

For each recommendation, provide:
1. title: Recipe name in Korean
2. reason: Why this recipe matches the preferences (in Korean)
3. difficulty: "쉬움", "보통", or "어려움"
4. cook_time: Approximate cooking time

Example Output:
{
  "recommendations": [
    {
      "title": "김치찌개",
      "reason": "매콤한 맛이 특징이며 초보자도 쉽게 만들 수 있어요",
      "difficulty": "쉬움",
      "cook_time": "30분"
    },
    {
      "title": "떡볶이",
      "reason": "고추장 베이스의 매콤달콤한 맛이 일품이에요",
      "difficulty": "쉬움",
      "cook_time": "20분"
    },
    {
      "title": "김치볶음밥",
      "reason": "간단하면서도 맛있고 매콤해요",
      "difficulty": "쉬움",
      "cook_time": "15분"
    }
  ]
}

IMPORTANT: Output JSON only. Provide exactly 3 recommendations.`;
  }

  /**
   * Validate PlanningOutput structure
   */
  private validatePlanningOutput(data: any): void {
    // Validate top-level structure
    if (!data.meta) {
      throw new Error('Missing required field: meta');
    }
    if (!data.ingredients) {
      throw new Error('Missing required field: ingredients');
    }
    if (!data.tools) {
      throw new Error('Missing required field: tools');
    }
    if (!data.process) {
      throw new Error('Missing required field: process');
    }

    // Validate meta
    const meta = data.meta;
    if (!meta.title || typeof meta.title !== 'string') {
      throw new Error('meta.title must be a non-empty string');
    }
    if (!meta.description || typeof meta.description !== 'string') {
      throw new Error('meta.description must be a non-empty string');
    }
    if (typeof meta.servings !== 'number' || meta.servings <= 0) {
      throw new Error('meta.servings must be a positive number');
    }
    if (typeof meta.time_estimate !== 'number' || meta.time_estimate <= 0) {
      throw new Error('meta.time_estimate must be a positive number');
    }
    const validDifficulties = ['Easy', 'Medium', 'Hard'];
    if (!validDifficulties.includes(meta.difficulty)) {
      throw new Error(`meta.difficulty must be one of: ${validDifficulties.join(', ')}`);
    }

    // Validate ingredients
    if (!data.ingredients.main || !Array.isArray(data.ingredients.main)) {
      throw new Error('ingredients.main must be an array');
    }
    if (!data.ingredients.sub || !Array.isArray(data.ingredients.sub)) {
      throw new Error('ingredients.sub must be an array');
    }

    // Validate tools
    if (!Array.isArray(data.tools)) {
      throw new Error('tools must be an array');
    }

    // Validate process
    if (!Array.isArray(data.process) || data.process.length === 0) {
      throw new Error('process must be a non-empty array');
    }

    // Validate each process step
    for (let i = 0; i < data.process.length; i++) {
      const step = data.process[i];
      if (typeof step.step_index !== 'number' || step.step_index !== i + 1) {
        throw new Error(`process[${i}].step_index must be ${i + 1}`);
      }
      if (!step.phase || !['preparation', 'cooking', 'finishing'].includes(step.phase)) {
        throw new Error(`process[${i}].phase must be one of: preparation, cooking, finishing`);
      }
      if (!step.action_type || typeof step.action_type !== 'string') {
        throw new Error(`process[${i}].action_type must be a string`);
      }
      if (!step.description || typeof step.description !== 'string') {
        throw new Error(`process[${i}].description must be a non-empty string`);
      }
      if (!Array.isArray(step.ingredients_needed)) {
        throw new Error(`process[${i}].ingredients_needed must be an array`);
      }
      if (!Array.isArray(step.tools_needed)) {
        throw new Error(`process[${i}].tools_needed must be an array`);
      }
    }
  }
}
