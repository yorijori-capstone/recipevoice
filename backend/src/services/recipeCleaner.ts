/**
 * Recipe Cleaner
 * Manages cleaned recipes with pre-processed planning results
 */

import OpenAI from 'openai';
import { pool } from '../db/pool.js';

// ============================================================================
// Interfaces
// ============================================================================

// New schema interfaces for Phase 2
export interface RecipeMeta {
  title: string;
  description: string;
  servings: number;
  time_estimate: number; // minutes
  difficulty: 'Easy' | 'Medium' | 'Hard';
}

export interface IngredientItem {
  name: string;
  amount: number;
  unit: string;
  notes?: string;
  usage?: string; // for sub ingredients
}

export interface IngredientData {
  main: IngredientItem[];
  sub: IngredientItem[];
}

export interface ProcessStep {
  phase: 'preparation' | 'cooking' | 'finishing';
  step_index: number;
  action_type: 'wash' | 'cut' | 'boil' | 'fry' | 'mix' | 'simmer' | 'season' | 'glaze' | 'drain' | 'bake' | 'steam' | 'grill' | 'roast' | 'slice' | 'chop' | 'mince' | 'peel' | 'grate' | 'blend' | 'whisk' | 'knead' | 'roll' | 'spread' | 'stuff' | 'wrap' | 'layer' | 'stir' | 'soak';
  description: string;
  ingredients_needed: string[];
  tools_needed: string[];
  heat_level: 'High' | 'Medium' | 'Low' | 'Off' | null;
  timer_seconds: number | null;
  tip?: string;
}

export interface PlanningOutput {
  meta: RecipeMeta;
  ingredients: IngredientData;
  tools: string[];
  process: ProcessStep[];
}

// Legacy interfaces for backward compatibility (will be removed later)
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

export interface RecipeInput {
  title: string;
  ingredients: Array<{ name: string; quantity: string }>;
  steps: Array<{ order: number; instruction: string }>;
}

export interface Ingredient {
  name: string;
  quantity: string;
}

export interface CleanedRecipe {
  id: number;
  recipe_id: string;
  title: string;
  opening_remark: string;
  closing_remark: string;
  planned_steps: PlannedStep[];  // Legacy - for backward compatibility
  planning_result: PlanningOutput;  // 🆕 Main data source
  process: ProcessStep[];  // 🆕 Direct access to process array
  cleaned_at: Date;
  ingredients: Ingredient[];  // 🆕 재료 목록 추가
}

// ============================================================================
// Planning Prompt
// ============================================================================

// Phase 2: New Recipe Data Standardization Prompt
const SYSTEM_PROMPT = `# System Prompt: Recipe Data Standardization

## Role

You are an expert "Recipe Data Structuring Specialist" and "Chef". Your goal is to convert raw recipe data (unstructured text, HTML, JSON, or transcripts) into a strictly defined "Interactive Cooking Schema" JSON format.

## Objective

Transform the provided RAW_DATA into a structured JSON object.

**CRITICAL:** Regardless of the input language, ALL string values in the output (titles, descriptions, ingredient names, tips) MUST be in **Korean (한국어)**.

**ROBUST PROCESSING RULES (IMPORTANT):**
- If any information is missing or unclear in the input, use your culinary knowledge to infer reasonable values.
- **CRITICAL - Title Generation**: If the title is missing, empty, or unclear, analyze the ingredients and cooking methods to generate an appropriate Korean dish name. For example, if you see "김치, 돼지고기, 끓이기" → generate "김치찌개". If you see "연근, 조림" → generate "연근조림". Always create a meaningful, descriptive dish name based on the main ingredients and cooking technique.
- **CRITICAL - Description Generation**: If the description is missing or empty, analyze the ingredients and cooking steps to create a one-line Korean summary. Describe the dish's main characteristics, key ingredients, and cooking style. For example: "돼지고기와 김치를 넣어 끓인 얼큰한 찌개" or "연근을 달콤하게 조린 반찬".
- If servings/time/difficulty are not specified, estimate based on the recipe content (e.g., typical servings: 2-4, time: 20-60 minutes, difficulty: Medium).
- If ingredients are unclear or incomplete, extract what you can and use empty arrays for missing parts.
- If steps are incomplete or vague, create logical steps based on the available information and common cooking practices.
- Always provide complete JSON structure even if some fields need to be inferred from context.
- When in doubt, choose reasonable defaults rather than leaving fields empty or null (except where null is explicitly allowed).

## Output Schema Structure

You must strictly follow this JSON structure:

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
      "phase": "String - MUST be exactly one of: preparation, cooking, finishing (lowercase). CRITICAL: This is the COOKING STAGE, NOT the action. Examples: If action_type='drain' happens before cooking → phase='preparation', if during cooking → phase='cooking'. DO NOT put action_type values (like 'drain', 'mix', 'cut') in phase field.",
      "step_index": Integer (1부터 시작, 숫자 타입),
      "action_type": "String - MUST be exactly one of these lowercase verbs: wash, cut, boil, fry, mix, simmer, season, glaze, drain, bake, steam, grill, roast, slice, chop, mince, peel, grate, blend, whisk, knead, roll, spread, stuff, wrap, layer, stir, soak. CRITICAL MAPPING RULES: Use 'mix' for adding/combining ingredients, placing items, serving, or transferring. Use 'drain' for removing liquids. Use 'soak' for soaking/pre-soaking. If you're unsure about the action_type, use 'mix' as a safe default. DO NOT use 'add', 'serve', 'place', 'put', 'transfer', 'remove' - they must be mapped to valid actions.",
      "description": "String (사용자에게 지시할 구체적인 행동, 한국어 경어체)",
      "ingredients_needed": ["String (이 단계에 쓰이는 재료명, 한국어)"] - MUST be array, use [] if empty,
      "tools_needed": ["String (이 단계에 쓰이는 도구명, 한국어)"] - MUST be array, use [] if empty,
      "heat_level": "String - MUST be exactly: High, Medium, Low, Off (capitalized) or null (not 'None', not empty string)",
      "timer_seconds": Integer (추정 소요 시간(초), 불확실하면 null - 숫자 또는 null, 문자열 금지),
      "tip": "String (주의사항이나 꿀팁, 한국어, 선택사항)"
    }
  ]
}
\`\`\`

## Transformation Rules (CRITICAL)

### Language Enforcement (Korean Only):
- Keys of the JSON must be in English.
- Values (content) must be translated or refined into natural Korean (한국어).
- Example: Input "Boil the water" -> Output Description "물을 끓여주세요."

### Granularity (Atomic Steps):
- Split complex sentences into single atomic actions.
- Example: "Wash and cut the carrots." -> Step 1 (Wash), Step 2 (Cut).
- Each step represents one clear instruction for the user.

### Inference (Hidden Context):
- **Tools**: If the text says "끓이세요(Boil)", you MUST add "냄비(Pot)" to tools and tools_needed. If it says "채 썰어주세요", add "칼(Knife)" and "도마(Cutting Board)".
- **Time**: Estimate timer_seconds based on culinary knowledge if not explicitly stated (e.g., boiling spinach ≈ 30-60s).
- **Heat**: Infer heat_level (High/Medium/Low) from context (e.g., "팔팔 끓으면" = High, "뭉근하게" = Low).

### Phase Classification (CRITICAL - DO NOT CONFUSE WITH action_type):
- **preparation**: Washing, peeling, cutting, pre-soaking, draining (before cooking starts).
- **cooking**: Heating, frying, boiling, simmering, mixing sauce, draining (during active cooking).
- **finishing**: Plating, garnishing, final seasoning, serving.
- **IMPORTANT DISTINCTION**: 
  - phase = The STAGE of cooking (preparation/cooking/finishing)
  - action_type = The SPECIFIC ACTION (drain/mix/cut/fry/etc.)
  - Example: action_type="drain" can be in phase="preparation" (draining soaked beans) OR phase="cooking" (draining pasta water), depending on WHEN it happens in the recipe flow.

### Data Cleaning:
- Remove personal chatter (e.g., "My husband loves this!").
- Convert vague units (e.g., "a little") to standard approximations or keep as "약간".
- Ensure numbers are floats or integers (e.g., "1/2" -> 0.5).

### CRITICAL: Preserve Unique Values
- **DO NOT modify or translate recipe title (meta.title)** - Use the exact title from input
- **DO NOT modify author/copyright information** - Preserve original author names
- Extract these values directly from the input without modification

## STRICT JSON FORMATTING RULES (MUST FOLLOW EXACTLY)

**CRITICAL - Your output will be validated and MUST pass these checks:**

1. **action_type**: MUST be lowercase English verb from allowed list. NO variations, NO capital letters, NO -ing forms.
   - ✅ Correct: "fry", "mix", "layer", "stir"
   - ❌ Wrong: "Fry", "frying", "Frying", "mix-ing", "add", "serve", "place", "put", "transfer", "remove"
   - **Mapping Rules**: "add" → "mix", "serve" → "mix", "place" → "mix", "put" → "mix", "transfer" → "mix", "remove" → "drain"

2. **phase**: MUST be exactly "preparation", "cooking", or "finishing" (lowercase).
   - ✅ Correct: "cooking"
   - ❌ Wrong: "Cooking", "COOKING", "Cook"

3. **difficulty**: MUST be exactly "Easy", "Medium", or "Hard" (capitalized first letter).
   - ✅ Correct: "Medium"
   - ❌ Wrong: "medium", "MEDIUM", "Medium "

4. **heat_level**: MUST be exactly "High", "Medium", "Low", "Off" (capitalized), or null (not "None", not "", not undefined).
   - ✅ Correct: "High", null
   - ❌ Wrong: "high", "HIGH", "None", "", undefined

5. **Numbers**: servings, time_estimate, step_index, timer_seconds, amount MUST be numbers (not strings).
   - ✅ Correct: 2, 30, 1, 300, 200
   - ❌ Wrong: "2", "30", "1", "300", "200"

6. **Arrays**: ingredients_needed, tools_needed, tools, main, sub MUST be arrays (even if empty: []).
   - ✅ Correct: [], ["재료1"], ["도구1", "도구2"]
   - ❌ Wrong: null, undefined, "재료1"

7. **step_index**: MUST start from 1 and increment by 1 (1, 2, 3, ...).

**EXAMPLE OF CORRECT FORMAT:**
\`\`\`json
{
  "meta": {
    "title": "김치찌개",
    "description": "돼지고기와 김치를 넣어 끓인 얼큰한 찌개",
    "servings": 2,
    "time_estimate": 30,
    "difficulty": "Medium"
  },
  "ingredients": {
    "main": [
      { "name": "돼지고기", "amount": 200, "unit": "g", "notes": "" }
    ],
    "sub": [
      { "name": "김치", "amount": 1, "unit": "컵", "usage": "" }
    ]
  },
  "tools": ["프라이팬", "냄비", "국자"],
  "process": [
    {
      "phase": "cooking",
      "step_index": 1,
      "action_type": "fry",
      "description": "돼지고기를 프라이팬에 넣고 볶아주세요.",
      "ingredients_needed": ["돼지고기"],
      "tools_needed": ["프라이팬"],
      "heat_level": "Medium",
      "timer_seconds": 300,
      "tip": "고기가 갈색이 될 때까지 볶아주세요"
    },
    {
      "phase": "cooking",
      "step_index": 2,
      "action_type": "mix",
      "description": "김치를 넣고 함께 볶아주세요.",
      "ingredients_needed": ["김치"],
      "tools_needed": ["프라이팬"],
      "heat_level": "Medium",
      "timer_seconds": 120,
      "tip": ""
    }
  ]
}
\`\`\`

Output Format: Respond ONLY with valid JSON. No other explanations needed.`;

// ============================================================================
// RecipeCleaner Class
// ============================================================================

export class RecipeCleaner {
  private openai: OpenAI;

  constructor(apiKey: string) {
    // OpenAI client
    this.openai = new OpenAI({ apiKey });

    console.log('[RecipeCleaner] Initialized');
  }

  // ==========================================================================
  // Public Methods
  // ==========================================================================

  /**
   * Get cleaned recipe (already planned)
   */
  async getCleanedRecipe(recipeId: string): Promise<CleanedRecipe | null> {
    try {
      console.log(`[RecipeCleaner] Getting cleaned recipe: ${recipeId}`);

      const recipeResult = await pool.query(
        'SELECT * FROM cleaned_recipes WHERE recipe_id = $1',
        [recipeId]
      );

      if (recipeResult.rows.length === 0) {
        console.log(`[RecipeCleaner] Cleaned recipe not found: ${recipeId}`);
        return null;
      }

      const recipe = recipeResult.rows[0];

      // Parse planning_result JSONB
      let planning_result: PlanningOutput = recipe.planning_result;
      if (typeof planning_result === 'string') {
        planning_result = JSON.parse(planning_result);
      }

      // 🆕 Get process array directly from planning_result
      const process: ProcessStep[] = planning_result?.process || [];

      // Get steps (Legacy - for backward compatibility)
      const stepsResult = await pool.query(
        'SELECT * FROM cleaned_steps WHERE cleaned_recipe_id = $1 ORDER BY step_order ASC',
        [recipe.id]
      );

      const planned_steps: PlannedStep[] = stepsResult.rows.map((row: any) => ({
        order: row.step_order,
        script: row.script,
        retry_script: row.retry_script,
        fallback_script: row.fallback_script,
        pause_hint: row.pause_hint,
        estimated_time_sec: row.estimated_time_sec,
        timer_required: row.timer_required,
        timer_message: row.timer_message
      }));

      // 🆕 Get ingredients from planning_result (no need to query raw DB)
      const allIngredients = [
        ...(planning_result.ingredients.main || []),
        ...(planning_result.ingredients.sub || [])
      ];
      
      const ingredients: Ingredient[] = allIngredients.map((ing) => ({
        name: ing.name,
        quantity: `${ing.amount}${ing.unit}`.trim()
      }));

      return {
        id: recipe.id,
        recipe_id: recipe.recipe_id,
        title: recipe.title,
        opening_remark: recipe.opening_remark,
        closing_remark: recipe.closing_remark,
        planned_steps,  // Legacy
        planning_result,  // Full planning result
        process,  // 🆕 Direct access to process array
        cleaned_at: recipe.cleaned_at,
        ingredients  // 🆕 재료 목록 포함
      };
    } catch (error) {
      console.error('[RecipeCleaner] Failed to get cleaned recipe:', error);
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
      console.error('[RecipeCleaner] Failed to check cleaned status:', error);
      throw error;
    }
  }

  /**
   * Clean and plan recipe (main function)
   */
  async cleanAndPlanRecipe(recipeId: string): Promise<CleanedRecipe> {
    try {
      console.log(`[RecipeCleaner] Starting cleaning for recipe: ${recipeId}`);

      // Check if already cleaned
      const alreadyCleaned = await this.isRecipeCleaned(recipeId);
      if (alreadyCleaned) {
        console.log(`[RecipeCleaner] Recipe already cleaned: ${recipeId}`);
        const existing = await this.getCleanedRecipe(recipeId);
        if (existing) return existing;
      }

      // Step 1: Fetch raw recipe
      const rawRecipe = await this.fetchRawRecipe(recipeId);

      // Step 2: Call OpenAI Planning
      const planningResult = await this.callPlanningAPI(rawRecipe);

      // Step 3: Save to cleaned_recipes + cleaned_steps
      const cleanedRecipe = await this.saveCleanedRecipe(recipeId, planningResult);

      console.log(`[RecipeCleaner] Successfully cleaned recipe: ${recipeId}`);
      return cleanedRecipe;
    } catch (error) {
      console.error(`[RecipeCleaner] Failed to clean recipe ${recipeId}:`, error);
      throw error;
    }
  }

  /**
   * Delete cleaned recipe (for re-planning)
   */
  async deleteCleanedRecipe(recipeId: string): Promise<void> {
    try {
      console.log(`[RecipeCleaner] Deleting cleaned recipe: ${recipeId}`);

      await pool.query('DELETE FROM cleaned_recipes WHERE recipe_id = $1', [recipeId]);

      console.log(`[RecipeCleaner] Deleted cleaned recipe: ${recipeId}`);
    } catch (error) {
      console.error('[RecipeCleaner] Failed to delete cleaned recipe:', error);
      throw error;
    }
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Fetch raw recipe from database (raw_data 원문 그대로 가져오기)
   */
  private async fetchRawRecipe(recipeId: string): Promise<any> {
    try {
      // Get recipe with raw_data
      const recipeResult = await pool.query(
        'SELECT raw_data, title, copyright FROM recipes WHERE recipe_id = $1',
        [recipeId]
      );

      if (recipeResult.rows.length === 0) {
        throw new Error(`Recipe not found: ${recipeId}`);
      }

      const recipe = recipeResult.rows[0];

      // raw_data가 있으면 파싱, 없으면 빈 객체
      let rawData = {};
      if (recipe.raw_data) {
        if (typeof recipe.raw_data === 'string') {
          rawData = JSON.parse(recipe.raw_data);
        } else {
          // 이미 JSONB로 파싱된 경우
          rawData = recipe.raw_data;
        }
      }

      // GPT에 전달할 때는 raw_data 원문과 메타데이터 함께 전달
      return {
        raw_data: rawData,
        title: recipe.title || '',
        copyright: recipe.copyright || '',
        author: recipe.copyright || ''
      };
    } catch (error) {
      console.error('[RecipeCleaner] Failed to fetch raw recipe:', error);
      throw error;
    }
  }

  /**
   * Call OpenAI Planning API with automatic retry on length errors
   */
  private async callPlanningAPI(recipe: RecipeInput, retryCount: number = 0): Promise<PlanningOutput> {
    const MAX_RETRIES = 3;
    const RETRY_DELAY_MS = 2000; // 2초 대기

    try {
      if (retryCount > 0) {
        console.log(`[RecipeCleaner] Retrying API call (attempt ${retryCount + 1}/${MAX_RETRIES})...`);
        // 재시도 전 잠시 대기
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
      } else {
      console.log('[RecipeCleaner] Calling OpenAI Planning API...');
      }

      const userPrompt = this.createPlanningPrompt(recipe);

      const response = await this.openai.chat.completions.create({
        model: 'gpt-5-nano',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        max_completion_tokens: 128000,
        response_format: { type: 'json_object' }
      });

      // 디버깅: 응답 구조 확인 (간소화 - 중복 제거)
      console.log('[RecipeCleaner] Response received:', {
        choicesCount: response.choices?.length || 0,
        finishReason: response.choices?.[0]?.finish_reason,
        contentLength: response.choices?.[0]?.message?.content?.length || 0
      });

      const content = response.choices[0]?.message?.content;
      const finishReason = response.choices[0]?.finish_reason;

      // finish_reason이 'length'이고 content가 비어있으면 재시도
      if (finishReason === 'length' && (!content || content.length === 0)) {
        if (retryCount < MAX_RETRIES) {
          console.warn(`[RecipeCleaner] Response truncated (length), retrying... (${retryCount + 1}/${MAX_RETRIES})`);
          return this.callPlanningAPI(recipe, retryCount + 1);
        } else {
          console.error('[RecipeCleaner] Max retries reached for length error');
          throw new Error(`Empty response from OpenAI after ${MAX_RETRIES} retries. Finish reason: length`);
        }
      }

      if (!content) {
        // 더 자세한 오류 정보
        console.error('[RecipeCleaner] Empty response details:', {
          response: JSON.stringify(response, null, 2),
          choices: response.choices,
          finishReason: response.choices[0]?.finish_reason
        });
        throw new Error(`Empty response from OpenAI. Finish reason: ${response.choices[0]?.finish_reason || 'unknown'}`);
      }

      const planData = JSON.parse(content);
      this.validatePlanData(planData);

      if (retryCount > 0) {
        console.log(`[RecipeCleaner] Planning API call successful after ${retryCount} retries`);
      } else {
      console.log('[RecipeCleaner] Planning API call successful');
      }
      return planData as PlanningOutput;
    } catch (error) {
      // length 오류가 아니거나 재시도 횟수를 초과한 경우에만 에러 throw
      if (error instanceof Error && error.message.includes('length') && retryCount < MAX_RETRIES) {
        console.warn(`[RecipeCleaner] Length error caught, retrying... (${retryCount + 1}/${MAX_RETRIES})`);
        return this.callPlanningAPI(recipe, retryCount + 1);
      }
      console.error('[RecipeCleaner] Planning API call failed:', error);
      throw error;
    }
  }

  /**
   * Create planning prompt for new schema (Phase 2) - raw_data 원문 사용
   */
  private createPlanningPrompt(recipe: any): string {
    // raw_data를 JSON 문자열로 변환하여 GPT에 전달
    const rawDataText = JSON.stringify(recipe.raw_data, null, 2);
    const originalTitle = recipe.title || '';
    const originalAuthor = recipe.copyright || recipe.author || '';
    
    // 디버깅: 입력 데이터 확인
    console.log('[RecipeCleaner] Input recipe data:', {
      title: originalTitle,
      author: originalAuthor,
      rawDataKeys: recipe.raw_data ? Object.keys(recipe.raw_data) : [],
      rawDataSize: rawDataText.length
    });
    
    // Check if title needs to be generated
    const needsTitleGeneration = !originalTitle || originalTitle.trim() === '' || 
                                 originalTitle === '레시피' || originalTitle === '요리' ||
                                 originalTitle.toLowerCase() === 'recipe' || originalTitle.toLowerCase() === 'dish';

    return `Transform the following RAW_DATA into the Interactive Cooking Schema JSON format.

⚠️ CRITICAL RULES:
${needsTitleGeneration 
  ? `1. **GENERATE TITLE**: The title "${originalTitle}" is missing or generic. Analyze the raw data below to generate an appropriate Korean dish name based on ingredients and cooking methods.`
  : `1. Preserve the EXACT recipe title: "${originalTitle}" - DO NOT translate or modify it`}
2. Preserve author information if provided: "${originalAuthor}"
3. Parse the raw_data JSON below to extract ALL information (ingredients, steps, metadata)
4. The raw_data may have various structures (ingredients, ingredients_struct, steps, instructions, process, etc.) - extract from ALL available fields
5. All output text must be in Korean (한국어)

⚠️ CRITICAL FORMATTING REQUIREMENTS (Your output will be validated):
- **action_type**: MUST be lowercase (e.g., "fry" not "Fry" or "frying")
- **phase**: MUST be lowercase (e.g., "cooking" not "Cooking")
- **difficulty**: MUST be capitalized (e.g., "Medium" not "medium")
- **heat_level**: MUST be capitalized or null (e.g., "High" not "high", null not "None")
- **All numbers**: MUST be numbers, not strings (e.g., 2 not "2", 30 not "30")
- **All arrays**: MUST be arrays, not null (use [] for empty arrays)
- **step_index**: MUST start from 1 and increment sequentially (1, 2, 3, ...)

RAW_DATA (Original JSON - Parse this to extract all information):
${rawDataText}

Instructions:
1. **Parse the raw_data JSON above**:
   - Extract title, author, servings, cook_time, difficulty from the JSON
   - Extract ALL ingredients from any field (ingredients, ingredients_struct, etc.)
   - Handle both array formats and object formats
   - Extract ALL cooking steps from any field (steps, instructions, process, etc.)
   - Handle both string arrays and object arrays
2. **Title Processing**: 
   - If the title "${originalTitle}" is provided and meaningful, preserve it exactly.
   - If the title is missing, empty, unclear, or just says "레시피"/"요리", analyze the ingredients and cooking methods in raw_data to generate an appropriate Korean dish name.
   - Example: Ingredients "김치, 돼지고기" + Method "끓이기" → Generate "김치찌개"
   - Example: Ingredients "연근" + Method "조림" → Generate "연근조림"
3. **Description Processing**:
   - If a description is provided in raw_data, refine it into a one-line Korean summary.
   - If no description is provided, analyze the ingredients and cooking steps in raw_data to create a descriptive one-line summary.
   - Describe the dish's main characteristics: key ingredients, cooking style, and flavor profile.
4. **Ingredient Extraction**:
   - Parse ingredients from raw_data (may be in ingredients, ingredients_struct, or other fields)
   - Handle various formats: arrays of strings, arrays of objects with name/qty/amount/desc fields
   - Categorize into main and sub ingredients
   - Extract amounts and units, convert to numbers where possible
5. **Step Extraction**:
   - Parse steps from raw_data (may be in steps, instructions, process, or other fields)
   - Handle various formats: arrays of strings, arrays of objects with description/instruction fields
   - Break down into atomic actions with proper phase classification
6. **Tool Inference**: Infer required tools from cooking steps (e.g., "끓이세요" → add "냄비")
7. **Action Type**: Use correct action_type from allowed list (lowercase: wash, cut, boil, fry, mix, simmer, season, glaze, drain, bake, steam, grill, roast, slice, chop, mince, peel, grate, blend, whisk, knead, roll, spread, stuff, wrap, layer, stir, soak)
8. **Heat Level & Timer**: Infer heat_level (High/Medium/Low/Off or null), timer_seconds (number or null), and tools_needed from context
9. All descriptions must be in Korean using respectful form (경어체)
10. Ensure step_index starts from 1 and increments by 1

Output the JSON following the exact schema structure and formatting rules provided in the system prompt.`;
  }

  /**
   * Validate plan data structure for new schema (Phase 2)
   */
  private validatePlanData(data: any): void {
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

    // Validate meta (ROBUST: Provide defaults for missing fields)
    const meta = data.meta || {};
    
    // ROBUST: Title - LLM should have generated it from ingredients/methods, but validate
    if (typeof meta.title !== 'string' || !meta.title.trim() || meta.title === '레시피' || meta.title === '요리') {
      // If still empty or generic, try to infer from ingredients (last resort)
      const mainIngredients = data.ingredients?.main?.slice(0, 2).map((ing: any) => ing.name).filter(Boolean).join(', ') || '';
      if (mainIngredients) {
        meta.title = `${mainIngredients} 요리`;
        console.warn(`[RecipeCleaner] Title was empty/generic, inferred from ingredients: "${meta.title}"`);
      } else {
        meta.title = '레시피';
        console.warn(`[RecipeCleaner] Title was empty and couldn't infer, using default: "${meta.title}"`);
      }
    }

    // ROBUST: Description - LLM should have generated it, but validate
    if (typeof meta.description !== 'string' || !meta.description.trim() || meta.description === '맛있는 요리입니다.') {
      // If still empty or generic, try to infer from ingredients and process (last resort)
      const mainIngredients = data.ingredients?.main?.slice(0, 2).map((ing: any) => ing.name).filter(Boolean).join(', ') || '';
      const cookingMethods = data.process?.slice(0, 3).map((step: any) => step.action_type).filter(Boolean).join(', ') || '';
      if (mainIngredients) {
        meta.description = `${mainIngredients}을(를) 사용한 요리입니다.`;
        console.warn(`[RecipeCleaner] Description was empty/generic, inferred from ingredients: "${meta.description}"`);
      } else {
        meta.description = '맛있는 요리입니다.';
        console.warn(`[RecipeCleaner] Description was empty and couldn't infer, using default`);
      }
    }

    // ROBUST: Servings - default to 2 if invalid
    if (typeof meta.servings === 'string') {
      const parsed = parseInt(meta.servings, 10);
      if (!isNaN(parsed) && parsed > 0) {
        meta.servings = parsed;
      } else {
        meta.servings = 2;
        console.warn(`[RecipeCleaner] Invalid servings "${meta.servings}", defaulting to 2`);
      }
    } else if (typeof meta.servings !== 'number' || meta.servings <= 0) {
      meta.servings = 2;
      console.warn(`[RecipeCleaner] Invalid servings, defaulting to 2`);
    }

    // ROBUST: Time estimate - default to 30 minutes if invalid
    if (typeof meta.time_estimate === 'string') {
      const parsed = parseInt(meta.time_estimate, 10);
      if (!isNaN(parsed) && parsed > 0) {
        meta.time_estimate = parsed;
      } else {
        meta.time_estimate = 30;
        console.warn(`[RecipeCleaner] Invalid time_estimate "${meta.time_estimate}", defaulting to 30 minutes`);
      }
    } else if (typeof meta.time_estimate !== 'number' || meta.time_estimate <= 0) {
      meta.time_estimate = 30;
      console.warn(`[RecipeCleaner] Invalid time_estimate, defaulting to 30 minutes`);
    }

    // ROBUST: Difficulty - default to 'Medium' if invalid
    if (typeof meta.difficulty === 'string') {
      const lower = meta.difficulty.toLowerCase().trim();
      if (lower === 'easy') {
        meta.difficulty = 'Easy';
      } else if (lower === 'medium') {
        meta.difficulty = 'Medium';
      } else if (lower === 'hard') {
        meta.difficulty = 'Hard';
      } else {
        meta.difficulty = 'Medium';
        console.warn(`[RecipeCleaner] Unknown difficulty "${meta.difficulty}", defaulting to "Medium"`);
      }
    } else {
      meta.difficulty = 'Medium';
      console.warn(`[RecipeCleaner] Missing difficulty, defaulting to "Medium"`);
    }

    // ROBUST: Ingredients - ensure arrays exist
    if (!data.ingredients) {
      data.ingredients = { main: [], sub: [] };
      console.warn(`[RecipeCleaner] Missing ingredients, using empty arrays`);
    }
    if (!data.ingredients.main || !Array.isArray(data.ingredients.main)) {
      data.ingredients.main = [];
      console.warn(`[RecipeCleaner] Missing main ingredients, using empty array`);
    }
    if (!data.ingredients.sub || !Array.isArray(data.ingredients.sub)) {
      data.ingredients.sub = [];
    }

    // Validate and normalize ingredient items
    for (const ing of [...data.ingredients.main, ...data.ingredients.sub]) {
      if (ing && typeof ing === 'object') {
        // Normalize amount (convert string to number if needed)
        if (ing.amount !== undefined && ing.amount !== null) {
          if (typeof ing.amount === 'string') {
            const trimmed = ing.amount.trim();
            if (trimmed === '' || trimmed.toLowerCase() === 'null') {
              ing.amount = 0;
            } else {
              const parsed = parseFloat(trimmed);
              if (!isNaN(parsed)) {
                ing.amount = parsed;
              } else {
                ing.amount = 0;
              }
            }
          } else if (typeof ing.amount === 'number') {
            // Already a number
            if (isNaN(ing.amount) || ing.amount < 0) {
              ing.amount = 0;
            }
          }
        } else {
          ing.amount = 0;
        }
        
        // Ensure unit is a string
        if (ing.unit !== undefined && ing.unit !== null) {
          ing.unit = String(ing.unit);
        } else {
          ing.unit = '';
        }
      }
    }

    // ROBUST: Tools - ensure array exists
    if (!data.tools || !Array.isArray(data.tools)) {
      data.tools = [];
      console.warn(`[RecipeCleaner] Missing tools, using empty array`);
    }
    // Ensure all items are strings
    data.tools = data.tools.map((tool: any) => {
      if (tool === null || tool === undefined) return '';
      return String(tool).trim();
    }).filter((tool: string) => tool.length > 0);

    // ROBUST: Process - ensure array exists and has at least one step
    if (!Array.isArray(data.process)) {
      data.process = [];
      console.warn(`[RecipeCleaner] Missing process, using empty array`);
    }

    if (data.process.length === 0) {
      // ROBUST: Add a default step if process is empty
      data.process = [{
        phase: 'cooking',
        step_index: 1,
        action_type: 'mix',
        description: '재료를 준비하고 조리해주세요.',
        ingredients_needed: [],
        tools_needed: [],
        heat_level: null,
        timer_seconds: null,
        tip: ''
      }];
      console.warn(`[RecipeCleaner] Empty process array, adding default step`);
    }

    // Validate step_index sequence (must be 1, 2, 3, ...)
    const stepIndices = data.process.map((step: any) => step.step_index).filter((idx: any) => typeof idx === 'number');
    if (stepIndices.length > 0) {
      const sorted = [...stepIndices].sort((a, b) => a - b);
      for (let i = 0; i < sorted.length; i++) {
        if (sorted[i] !== i + 1) {
          throw new Error(`step_index must be sequential starting from 1 (found: ${sorted.join(', ')})`);
        }
      }
    }

    // Validate each process step
    const requiredProcessFields = [
      'phase',
      'step_index',
      'action_type',
      'description',
      'ingredients_needed',
      'tools_needed',
      'heat_level',
      'timer_seconds'
    ];

    const validPhases = ['preparation', 'cooking', 'finishing'];
    // Extended action types list (matching system prompt)
    const validActionTypes = [
      'wash', 'cut', 'boil', 'fry', 'mix', 'simmer', 'season', 'glaze', 'drain',
      'bake', 'steam', 'grill', 'roast', 'slice', 'chop', 'mince', 'peel', 'grate',
      'blend', 'whisk', 'knead', 'roll', 'spread', 'stuff', 'wrap', 'layer', 'stir',
      'soak'
    ];
    const validHeatLevels = ['High', 'Medium', 'Low', 'Off', null];
    
    // Simple mapping for common variations (minimal fallback)
    const actionTypeMapping: Record<string, string> = {
      // -ing forms
      'layering': 'layer',
      'stirring': 'stir',
      'mixing': 'mix',
      'cutting': 'cut',
      'chopping': 'chop',
      'slicing': 'slice',
      'washing': 'wash',
      'boiling': 'boil',
      'frying': 'fry',
      'simmering': 'simmer',
      'seasoning': 'season',
      'glazing': 'glaze',
      'draining': 'drain',
      'baking': 'bake',
      'steaming': 'steam',
      'grilling': 'grill',
      'roasting': 'roast',
      'mincing': 'mince',
      'peeling': 'peel',
      'grating': 'grate',
      'blending': 'blend',
      'whisking': 'whisk',
      'kneading': 'knead',
      'rolling': 'roll',
      'spreading': 'spread',
      'stuffing': 'stuff',
      'wrapping': 'wrap',
      // Cooking method variations
      'sauté': 'fry',
      'sautéing': 'fry',
      'saute': 'fry',
      'sauteing': 'fry',
      'braise': 'simmer',
      'braising': 'simmer',
      'poach': 'boil',
      'poaching': 'boil',
      // Common invalid actions -> valid mappings
      'add': 'mix',
      'adding': 'mix',
      'serve': 'mix',
      'serving': 'mix',
      'place': 'mix',
      'placing': 'mix',
      'put': 'mix',
      'transfer': 'mix',
      'transferring': 'mix',
      'combine': 'mix',
      'combining': 'mix',
      'incorporate': 'mix',
      'incorporating': 'mix',
      'remove': 'drain',
      'removing': 'drain',
      'take': 'mix',
      'taking': 'mix',
      'arrange': 'layer',
      'arranging': 'layer',
      'assemble': 'layer',
      'assembling': 'layer',
      'fold': 'mix',
      'folding': 'mix',
      'toss': 'mix',
      'tossing': 'mix',
      'coat': 'season',
      'coating': 'season',
      'marinate': 'season',
      'marinating': 'season',
      'brush': 'glaze',
      'brushing': 'glaze',
      'drizzle': 'glaze',
      'drizzling': 'glaze',
      'pour': 'mix',
      'pouring': 'mix',
      'set': 'mix',
      'setting': 'mix',
      'prepare': 'cut',
      'preparing': 'cut',
      'trim': 'cut',
      'trimming': 'cut',
      'clean': 'wash',
      'cleaning': 'wash',
      'dice': 'cut',
      'dicing': 'cut',
      'julienne': 'cut',
      'julienning': 'cut',
      // Soaking related
      'soak': 'soak',
      'soaking': 'soak',
      'presoak': 'soak',
      'presoaking': 'soak',
      'immerse': 'soak',
      'immersing': 'soak',
      'submerge': 'soak',
      'submerging': 'soak'
    };

    for (let i = 0; i < data.process.length; i++) {
      const step = data.process[i];

      // ROBUST: Ensure all required fields exist with defaults
      if (!('phase' in step)) {
        step.phase = 'cooking';
        console.warn(`[RecipeCleaner] Missing phase in step ${i + 1}, defaulting to "cooking"`);
      }
      if (!('step_index' in step)) {
        step.step_index = i + 1;
        console.warn(`[RecipeCleaner] Missing step_index in step ${i + 1}, defaulting to ${i + 1}`);
      }
      if (!('action_type' in step)) {
        step.action_type = 'mix';
        console.warn(`[RecipeCleaner] Missing action_type in step ${i + 1}, defaulting to "mix"`);
      }
      if (!('description' in step) || !step.description || typeof step.description !== 'string' || !step.description.trim()) {
        step.description = '다음 단계를 진행해주세요.';
        console.warn(`[RecipeCleaner] Missing or empty description in step ${i + 1}, using default`);
      }
      if (!('ingredients_needed' in step)) {
        step.ingredients_needed = [];
      }
      if (!('tools_needed' in step)) {
        step.tools_needed = [];
      }
      if (!('heat_level' in step)) {
        step.heat_level = null;
      }
      if (!('timer_seconds' in step)) {
        step.timer_seconds = null;
      }
      if (!('tip' in step)) {
        step.tip = '';
      }

      // ROBUST: Validate phase - default to 'cooking' if invalid
      if (typeof step.phase === 'string') {
        const lower = step.phase.toLowerCase().trim();
        if (validPhases.includes(lower)) {
          step.phase = lower;
        } else {
          // Check if LLM confused phase with action_type
          const validActionTypes = [
            'wash', 'cut', 'boil', 'fry', 'mix', 'simmer', 'season', 'glaze', 'drain',
            'bake', 'steam', 'grill', 'roast', 'slice', 'chop', 'mince', 'peel', 'grate',
            'blend', 'whisk', 'knead', 'roll', 'spread', 'stuff', 'wrap', 'layer', 'stir', 'soak'
          ];
          if (validActionTypes.includes(lower)) {
            // ROBUST: Auto-correct - infer phase from action_type
            if (['wash', 'cut', 'peel', 'slice', 'chop', 'soak'].includes(lower)) {
              step.phase = 'preparation';
            } else if (['boil', 'fry', 'simmer', 'bake', 'steam', 'grill', 'roast'].includes(lower)) {
              step.phase = 'cooking';
            } else {
              step.phase = 'cooking'; // Default
            }
            console.warn(`[RecipeCleaner] Phase "${step.phase}" was action_type "${lower}" in step ${i + 1}, inferred phase from action`);
          } else {
            // ROBUST: Default to 'cooking' for unknown values
            step.phase = 'cooking';
            console.warn(`[RecipeCleaner] Unknown phase "${step.phase}" in step ${i + 1}, defaulting to "cooking"`);
          }
        }
      } else {
        step.phase = 'cooking';
        console.warn(`[RecipeCleaner] Invalid phase type in step ${i + 1}, defaulting to "cooking"`);
      }
      
      // Final check (should always pass now)
      if (!validPhases.includes(step.phase)) {
        step.phase = 'cooking';
        console.warn(`[RecipeCleaner] Phase validation failed in step ${i + 1}, forced to "cooking"`);
      }

      // ROBUST: Validate step_index - auto-correct if invalid
      if (typeof step.step_index === 'string') {
        const parsed = parseInt(step.step_index, 10);
        if (!isNaN(parsed) && parsed > 0) {
          step.step_index = parsed;
        } else {
          step.step_index = i + 1;
          console.warn(`[RecipeCleaner] Invalid step_index "${step.step_index}" in step ${i + 1}, defaulting to ${i + 1}`);
        }
      } else if (typeof step.step_index !== 'number' || step.step_index < 1) {
        step.step_index = i + 1;
        console.warn(`[RecipeCleaner] Invalid step_index in step ${i + 1}, defaulting to ${i + 1}`);
      }

      // Validate action_type (should be correct from LLM, but map common variations)
      // ROBUST: Auto-fallback to 'mix' for unknown action types
      if (typeof step.action_type === 'string') {
        const lower = step.action_type.toLowerCase().trim();
        if (validActionTypes.includes(lower)) {
          step.action_type = lower;
        } else if (actionTypeMapping[lower]) {
          const originalValue = step.action_type;
          step.action_type = actionTypeMapping[lower];
          console.warn(`[RecipeCleaner] Mapped action_type "${originalValue}" → "${step.action_type}" in step ${i + 1}`);
        } else {
          // ROBUST FALLBACK: Unknown action_type → default to 'mix'
          const originalValue = step.action_type;
          step.action_type = 'mix';
          console.warn(`[RecipeCleaner] Unknown action_type "${originalValue}" in step ${i + 1}, defaulting to "mix"`);
        }
      } else if (!step.action_type) {
        // Missing action_type → default to 'mix'
        step.action_type = 'mix';
        console.warn(`[RecipeCleaner] Missing action_type in step ${i + 1}, defaulting to "mix"`);
      }
      
      // Final validation (should always pass now due to fallback)
      if (!validActionTypes.includes(step.action_type)) {
        // This should never happen due to fallback, but keep as safety check
        step.action_type = 'mix';
        console.warn(`[RecipeCleaner] Invalid action_type in step ${i + 1}, forced to "mix"`);
      }

      if (typeof step.description !== 'string' || !step.description.trim()) {
        throw new Error(`Process step ${i + 1}: description must be a non-empty string`);
      }

      // Normalize ingredients_needed (ensure it's an array)
      if (!step.ingredients_needed || !Array.isArray(step.ingredients_needed)) {
        step.ingredients_needed = [];
      }
      // Ensure all items are strings
      step.ingredients_needed = step.ingredients_needed.map((ing: any) => {
        if (ing === null || ing === undefined) return '';
        return String(ing).trim();
      }).filter((ing: string) => ing.length > 0);

      // Normalize tools_needed (ensure it's an array)
      if (!step.tools_needed || !Array.isArray(step.tools_needed)) {
        step.tools_needed = [];
      }
      // Ensure all items are strings
      step.tools_needed = step.tools_needed.map((tool: any) => {
        if (tool === null || tool === undefined) return '';
        return String(tool).trim();
      }).filter((tool: string) => tool.length > 0);

      // Validate heat_level (should be correct from LLM, but normalize capitalization)
      if (step.heat_level !== null && step.heat_level !== undefined) {
        if (typeof step.heat_level === 'string') {
          const lower = step.heat_level.toLowerCase().trim();
          if (lower === 'high') {
            step.heat_level = 'High';
          } else if (lower === 'medium') {
            step.heat_level = 'Medium';
          } else if (lower === 'low') {
            step.heat_level = 'Low';
          } else if (lower === 'off') {
            step.heat_level = 'Off';
          } else if (lower === '' || lower === 'none' || lower === 'null') {
            step.heat_level = null;
          }
        } else if (typeof step.heat_level === 'number') {
          step.heat_level = null;
        }
      } else {
        step.heat_level = null;
      }
      
      if (!validHeatLevels.includes(step.heat_level)) {
        throw new Error(`Process step ${i + 1}: heat_level must be one of: High, Medium, Low, Off, or null (got: ${step.heat_level}). Please use the exact format specified in the prompt.`);
      }

      // Validate timer_seconds (should be number or null from LLM, but convert if string)
      if (step.timer_seconds !== null && step.timer_seconds !== undefined) {
        if (typeof step.timer_seconds === 'string') {
          const trimmed = step.timer_seconds.trim();
          if (trimmed === '' || trimmed.toLowerCase() === 'null' || trimmed.toLowerCase() === 'none') {
            step.timer_seconds = null;
          } else {
            const parsed = parseInt(trimmed, 10);
            if (!isNaN(parsed)) {
              step.timer_seconds = parsed;
            } else {
              throw new Error(`Process step ${i + 1}: timer_seconds must be a number or null (got: ${step.timer_seconds}). Please use numeric format, not string.`);
            }
          }
        } else if (typeof step.timer_seconds === 'number') {
          if (step.timer_seconds < 0) {
            step.timer_seconds = 0;
          }
        }
      } else {
        step.timer_seconds = null;
      }
      
      if (step.timer_seconds !== null && (typeof step.timer_seconds !== 'number' || step.timer_seconds < 0)) {
        throw new Error(`Process step ${i + 1}: timer_seconds must be a non-negative integer or null (got: ${step.timer_seconds})`);
      }
    }
  }

  /**
   * Save cleaned recipe to database (Phase 2 - new schema)
   * Public method for saving PlanningOutput directly (e.g., from RecipeCreator)
   */
  async saveCleanedRecipe(
    recipeId: string,
    planningResult: PlanningOutput
  ): Promise<CleanedRecipe> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Extract title from meta for backward compatibility
      const title = planningResult.meta.title;
      const description = planningResult.meta.description;

      // Create opening and closing remarks from meta for backward compatibility
      const opening_remark = `안녕하세요! 지금부터 ${title} 만들기를 시작하겠습니다. ${description}`;
      const closing_remark = `${title} 만들기가 완료되었습니다. 맛있게 드세요!`;

      // Insert into cleaned_recipes
      // Note: planning_result JSONB stores the full new schema structure
      const recipeInsertResult = await client.query(
        `INSERT INTO cleaned_recipes (recipe_id, planning_result, title, opening_remark, closing_remark)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (recipe_id) DO UPDATE SET
           planning_result = EXCLUDED.planning_result,
           title = EXCLUDED.title,
           opening_remark = EXCLUDED.opening_remark,
           closing_remark = EXCLUDED.closing_remark,
           updated_at = CURRENT_TIMESTAMP
         RETURNING *`,
        [
          recipeId,
          JSON.stringify(planningResult),
          title,
          opening_remark,
          closing_remark
        ]
      );

      const cleanedRecipeId = recipeInsertResult.rows[0].id;

      // Delete existing steps for this recipe
      await client.query(
        'DELETE FROM cleaned_steps WHERE cleaned_recipe_id = $1',
        [cleanedRecipeId]
      );

      // Insert process steps into cleaned_steps table
      // Map new schema to existing table structure for backward compatibility
      for (const processStep of planningResult.process) {
        // Convert process step to cleaned_steps format
        const timer_required = processStep.timer_seconds !== null && processStep.timer_seconds > 0;
        const estimated_time_sec = processStep.timer_seconds || 0;
        const timer_message = timer_required 
          ? `${processStep.timer_seconds}초 동안 ${processStep.description.split('.')[0]}`
          : '';

        // Use description as main script
        const script = processStep.description;
        const retry_script = `${processStep.description} 다시 한 번 천천히 설명드리겠습니다.`;
        const fallback_script = `간단히 말씀드리면, ${processStep.description}`;
        const pause_hint = `잠시 멈췄습니다. 준비되시면 계속이라고 말씀해주세요.`;

        await client.query(
          `INSERT INTO cleaned_steps (
            cleaned_recipe_id, step_order, script, retry_script, fallback_script, pause_hint,
            estimated_time_sec, timer_required, timer_message
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            cleanedRecipeId,
            processStep.step_index,
            script,
            retry_script,
            fallback_script,
            pause_hint,
            estimated_time_sec,
            timer_required,
            timer_message
          ]
        );
      }

      await client.query('COMMIT');

      console.log(`[RecipeCleaner] Saved cleaned recipe to database: ${recipeId}`);

      // Get ingredients for the return value
      const ingredientsResult = await pool.query(
        'SELECT name, quantity FROM ingredients WHERE recipe_id = $1 ORDER BY display_order ASC',
        [recipeId]
      );

      const ingredients: Ingredient[] = ingredientsResult.rows.map((row: any) => ({
        name: row.name,
        quantity: row.quantity || ''
      }));

      // Convert new schema to legacy format for return value (backward compatibility)
      const legacyPlannedSteps: PlannedStep[] = planningResult.process.map((step) => ({
        order: step.step_index,
        script: step.description,
        retry_script: `${step.description} 다시 한 번 천천히 설명드리겠습니다.`,
        fallback_script: `간단히 말씀드리면, ${step.description}`,
        pause_hint: '잠시 멈췄습니다. 준비되시면 계속이라고 말씀해주세요.',
        estimated_time_sec: step.timer_seconds || 0,
        timer_required: step.timer_seconds !== null && step.timer_seconds > 0,
        timer_message: step.timer_seconds 
          ? `${step.timer_seconds}초 동안 ${step.description.split('.')[0]}`
          : ''
      }));

      return {
        id: cleanedRecipeId,
        recipe_id: recipeId,
        title: title,
        opening_remark: opening_remark,
        closing_remark: closing_remark,
        planned_steps: legacyPlannedSteps,
        planning_result: planningResult as any, // Store new schema in planning_result
        process: planningResult.process, // 🆕 Direct access to process array
        cleaned_at: new Date(),
        ingredients
      };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('[RecipeCleaner] Failed to save cleaned recipe:', error);
      throw error;
    } finally {
      client.release();
    }
  }
}
