/**
 * Nano Service
 * AI-powered recipe generation and recommendation using GPT-3.5-turbo
 */

import OpenAI from 'openai';

// ============================================================================
// Interfaces
// ============================================================================

export interface GeneratedRecipe {
  title: string;
  servings: string;
  cook_time: string;
  difficulty: 'easy' | 'medium' | 'hard';
  ingredients: Array<{
    name: string;
    quantity: string;
    description?: string;
  }>;
  steps: Array<{
    order: number;
    description: string;
  }>;
  tips?: string[];
}

export interface RecipeRecommendation {
  title: string;
  reason: string;
  difficulty: string;
  cook_time: string;
}

// ============================================================================
// System Prompts
// ============================================================================

const GENERATION_SYSTEM_PROMPT = `You are a professional Korean recipe creator.
Generate detailed, authentic Korean recipes based on user requests.

Guidelines:
1. Create realistic, cookable recipes
2. Use authentic Korean cooking methods and ingredients
3. Provide specific quantities (그램, 밀리리터, 컵, 숟가락 등)
4. Break down steps clearly for beginners
5. Include helpful tips

Output Format: JSON only, no explanations.`;

const RECOMMENDATION_SYSTEM_PROMPT = `You are a Korean food recommendation expert.
Suggest recipes based on user preferences, dietary restrictions, or ingredients.

Guidelines:
1. Consider Korean cuisine diversity
2. Match user's skill level
3. Suggest seasonal ingredients when possible
4. Provide reasoning for each recommendation

Output Format: JSON only, no explanations.`;

// ============================================================================
// NanoService Class
// ============================================================================

export class NanoService {
  private openai: OpenAI;

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
    console.log('[NanoService] Initialized');
  }

  // ==========================================================================
  // Public Methods
  // ==========================================================================

  /**
   * Generate recipe from natural language prompt
   */
  async generateRecipe(userPrompt: string): Promise<GeneratedRecipe> {
    try {
      console.log(`[NanoService] Generating recipe for: "${userPrompt}"`);

      const prompt = this.createGenerationPrompt(userPrompt);

      const response = await this.openai.chat.completions.create({
        model: 'gpt-5-nano',
        messages: [
          { role: 'system', content: GENERATION_SYSTEM_PROMPT },
          { role: 'user', content: prompt }
        ],
        max_completion_tokens: 8192,  // 토큰 제한 수정: Increased for gpt-5-nano reasoning + output
        response_format: { type: 'json_object' }
      });

      console.log('[NanoService] Response received:', {
        finish_reason: response.choices[0].finish_reason,
        has_content: !!response.choices[0].message.content
      });

      const content = response.choices[0].message.content;
      if (!content) {
        console.error('[NanoService] Empty response details:', {
          finish_reason: response.choices[0].finish_reason,
          response: JSON.stringify(response, null, 2)
        });
        throw new Error('Empty response from OpenAI');
      }

      const recipe = JSON.parse(content);
      this.validateGeneratedRecipe(recipe);

      console.log(`[NanoService] Successfully generated recipe: ${recipe.title}`);
      return recipe as GeneratedRecipe;
    } catch (error) {
      console.error('[NanoService] Recipe generation failed:', error);
      throw error;
    }
  }

  /**
   * Recommend recipes based on preferences
   */
  async recommendRecipes(preferences: string): Promise<RecipeRecommendation[]> {
    try {
      console.log(`[NanoService] Getting recommendations for: "${preferences}"`);

      const prompt = this.createRecommendationPrompt(preferences);

      const response = await this.openai.chat.completions.create({
        model: 'gpt-5-nano',
        messages: [
          { role: 'system', content: RECOMMENDATION_SYSTEM_PROMPT },
          { role: 'user', content: prompt }
        ],
        max_completion_tokens: 4096,  // 토큰 제한 수정: Increased for gpt-5-nano reasoning + output
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error('Empty response from OpenAI');
      }

      const result = JSON.parse(content);
      const recommendations = result.recommendations || [];

      console.log(`[NanoService] Generated ${recommendations.length} recommendations`);
      return recommendations as RecipeRecommendation[];
    } catch (error) {
      console.error('[NanoService] Recipe recommendation failed:', error);
      throw error;
    }
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Create generation prompt
   */
  private createGenerationPrompt(userPrompt: string): string {
    return `Create a detailed Korean recipe based on this request: "${userPrompt}"

Requirements:
1. title: Recipe name in Korean
2. servings: Number of servings (예: "2인분", "4인분")
3. cook_time: Total cooking time (예: "30분", "1시간")
4. difficulty: "easy", "medium", or "hard"
5. ingredients: Array of ingredients with name, quantity, and optional description
   - Use Korean units: 그램(g), 밀리리터(ml), 컵, 큰술, 작은술
   - Be specific with quantities
6. steps: Array of cooking steps with order and description
   - Clear, step-by-step instructions
   - Use natural Korean cooking language
7. tips: Optional array of helpful cooking tips

Example Output:
{
  "title": "김치찌개",
  "servings": "2인분",
  "cook_time": "30분",
  "difficulty": "easy",
  "ingredients": [
    {
      "name": "김치",
      "quantity": "200g",
      "description": "신김치가 좋아요"
    },
    {
      "name": "돼지고기",
      "quantity": "100g"
    },
    {
      "name": "물",
      "quantity": "2컵"
    }
  ],
  "steps": [
    {
      "order": 1,
      "description": "김치를 송송 썰어주세요."
    },
    {
      "order": 2,
      "description": "냄비에 돼지고기를 넣고 볶아주세요."
    },
    {
      "order": 3,
      "description": "김치를 넣고 함께 볶아주세요."
    },
    {
      "order": 4,
      "description": "물 2컵을 넣고 끓여주세요."
    }
  ],
  "tips": [
    "신김치를 사용하면 더 맛있어요",
    "두부를 추가하면 영양이 풍부해져요"
  ]
}

IMPORTANT: Output JSON only. Create a complete, realistic Korean recipe.`;
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
   * Validate generated recipe structure
   */
  private validateGeneratedRecipe(recipe: any): void {
    const requiredFields = [
      'title',
      'servings',
      'cook_time',
      'difficulty',
      'ingredients',
      'steps'
    ];

    for (const field of requiredFields) {
      if (!(field in recipe)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    if (!Array.isArray(recipe.ingredients) || recipe.ingredients.length === 0) {
      throw new Error('Recipe must have at least one ingredient');
    }

    if (!Array.isArray(recipe.steps) || recipe.steps.length === 0) {
      throw new Error('Recipe must have at least one step');
    }

    // Validate difficulty
    const validDifficulties = ['easy', 'medium', 'hard'];
    if (!validDifficulties.includes(recipe.difficulty)) {
      throw new Error('Invalid difficulty level');
    }

    // Validate ingredients
    for (let i = 0; i < recipe.ingredients.length; i++) {
      const ing = recipe.ingredients[i];
      if (!ing.name || !ing.quantity) {
        throw new Error(`Ingredient ${i + 1} missing name or quantity`);
      }
    }

    // Validate steps
    for (let i = 0; i < recipe.steps.length; i++) {
      const step = recipe.steps[i];
      if (!step.order || !step.description) {
        throw new Error(`Step ${i + 1} missing order or description`);
      }
    }
  }
}
