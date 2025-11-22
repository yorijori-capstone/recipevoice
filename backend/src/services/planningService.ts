/**
 * Planning Service
 * Recipe to voice conversation script conversion using OpenAI
 */

import OpenAI from 'openai';

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

export class PlanningService {
  private openai: OpenAI;

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  /**
   * Generate planning output from recipe
   */
  async generatePlan(recipe: RecipeInput): Promise<PlanningOutput> {
    try {
      console.log('[PlanningService] Generating plan for:', recipe.title);

      const userPrompt = this.createPlanningPrompt(recipe);

      const response = await this.openai.chat.completions.create({
        model: 'gpt-5-nano',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        max_completion_tokens: 4096,
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error('Empty response from OpenAI');
      }

      const planData = JSON.parse(content);
      this.validatePlanData(planData);

      console.log('[PlanningService] Plan generated successfully');
      return planData as PlanningOutput;
    } catch (error) {
      console.error('[PlanningService] Failed to generate plan:', error);
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

    const stepsText = recipe.steps
      .map((step) => `${step.order}. ${step.instruction}`)
      .join('\n');

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
  "opening_remark": "안녕하세요! 지금부터 ${recipe.title} 만들기를 시작하겠습니다.",
  "planned_steps": [
    {
      "order": 1,
      "script": "첫 번째 단계입니다. 간결한 설명.",
      "retry_script": "다시 설명드릴게요. 더 상세하고 천천히 설명.",
      "fallback_script": "쉬운 말로 다시 설명드릴게요.",
      "estimated_time_sec": 120,
      "timer_required": true,
      "timer_message": "이 분 타이머를 시작할게요."
    },
    {
      "order": 2,
      "script": "다음 단계입니다.",
      "retry_script": "다시 설명드릴게요.",
      "fallback_script": "쉬운 말로 설명드릴게요.",
      "estimated_time_sec": 60,
      "timer_required": false,
      "timer_message": ""
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
   * Handle control commands
   */
  handleControlCommand(
    command: 'pause' | 'resume' | 'retry' | 'clarify',
    currentStep: PlannedStep
  ): { command: string; message: string; action: string } {
    const response: any = {
      command,
      message: '',
      action: ''
    };

    switch (command) {
      case 'pause':
        response.message = currentStep.pause_hint;
        response.action = 'TTS를 일시정지하고 사용자 입력 대기';
        break;

      case 'resume':
        response.message = `다시 시작할게요. ${currentStep.script}`;
        response.action = '현재 단계 script를 처음부터 다시 재생';
        break;

      case 'retry':
        response.message = currentStep.retry_script;
        response.action = 'retry_script를 재생';
        break;

      case 'clarify':
        response.message = currentStep.fallback_script;
        response.action = 'fallback_script를 재생';
        break;
    }

    return response;
  }
}
