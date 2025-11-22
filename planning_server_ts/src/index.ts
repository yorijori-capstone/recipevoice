#!/usr/bin/env node

/**
 * Planning MCP Server (TypeScript)
 * Converts recipes to voice conversation scripts using OpenAI
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// System prompt for recipe planning
const SYSTEM_PROMPT = `You are a friendly Korean cooking assistant helping users cook step-by-step.

⚠️ IMPORTANT CONSTRAINTS:
1. NO CREATION: Use only the provided recipe data.
2. NO ADDITIONS: Do not add ingredients, steps, or cooking methods not in the input.
3. DATA VALIDATION: If input data is unclear, refuse the conversion.
4. NO TITLE CHANGES: Use the recipe title exactly as provided.

Core Principles:
1. Conversational Script Writing - Use natural speech patterns
2. Voice Guidance Optimization - Each sentence speakable within 15 seconds
3. Beginner Consideration - Use simple terms
4. Pronunciation Rules - 'L'→'리터', 'g'→'그램', 'ml'→'밀리리터'
5. Output Format: JSON ONLY`;

interface RecipeInput {
  title: string;
  ingredients: Array<{ name: string; quantity: string }>;
  steps: Array<{ order: number; instruction: string }>;
}

interface PlannedStep {
  order: number;
  script: string;
  retry_script: string;
  pause_hint: string;
  fallback_script: string;
  estimated_time_sec: number;
  timer_required: boolean;
  timer_message: string;
}

interface PlanningOutput {
  opening_remark: string;
  planned_steps: PlannedStep[];
  closing_remark: string;
}

/**
 * Generate planning output from recipe
 */
async function generatePlan(recipe: RecipeInput): Promise<PlanningOutput> {
  const ingredientsText = recipe.ingredients
    .map((ing) => `- ${ing.name}: ${ing.quantity}`)
    .join('\n');

  const stepsText = recipe.steps
    .map((step) => `${step.order}. ${step.instruction}`)
    .join('\n');

  const userPrompt = `Convert the following recipe into a voice-friendly conversational script in Korean.

⚠️ Use ONLY the information provided below.

Recipe: ${recipe.title}

Ingredients:
${ingredientsText}

Steps:
${stepsText}

Output Format (JSON ONLY):
{
  "opening_remark": "안녕하세요! 지금부터 ${recipe.title} 만들기를 시작하겠습니다.",
  "planned_steps": [
    {
      "order": 1,
      "script": "첫 번째 단계입니다. 설명.",
      "retry_script": "다시 설명드릴게요. 상세 설명.",
      "fallback_script": "쉬운 말로 설명.",
      "pause_hint": "잠시 멈췄습니다. 준비되면 '계속'이라고 말씀해주세요.",
      "estimated_time_sec": 120,
      "timer_required": true,
      "timer_message": "이 분 타이머를 시작할게요."
    }
  ],
  "closing_remark": "모든 요리가 끝났습니다. 맛있게 드세요!"
}`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.5,
    max_tokens: 4096,
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0].message.content;
  if (!content) {
    throw new Error('Empty response from OpenAI');
  }

  return JSON.parse(content) as PlanningOutput;
}

/**
 * Handle control commands
 */
function handleControlCommand(
  command: 'pause' | 'resume' | 'retry' | 'clarify',
  currentStep: PlannedStep
): any {
  const response: any = {
    command,
    message: '',
    action: '',
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

// Create MCP server
const server = new Server(
  {
    name: 'planning-server-ts',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'plan_recipe',
        description:
          'Convert recipe to voice conversation script. Transforms recipe into friendly, natural Korean dialogue for cooking guidance.',
        inputSchema: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              description: 'Recipe title',
            },
            ingredients: {
              type: 'array',
              description: 'List of ingredients',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  quantity: { type: 'string' },
                },
                required: ['name', 'quantity'],
              },
            },
            steps: {
              type: 'array',
              description: 'Cooking steps',
              items: {
                type: 'object',
                properties: {
                  order: { type: 'number' },
                  instruction: { type: 'string' },
                },
                required: ['order', 'instruction'],
              },
            },
          },
          required: ['title', 'ingredients', 'steps'],
        },
      },
      {
        name: 'handle_control_command',
        description:
          'Handle control commands (pause/resume/retry/clarify) during cooking',
        inputSchema: {
          type: 'object',
          properties: {
            command: {
              type: 'string',
              enum: ['pause', 'resume', 'retry', 'clarify'],
              description: 'Control command',
            },
            current_step_order: {
              type: 'number',
              description: 'Current step number',
            },
            current_step: {
              type: 'object',
              description: 'Current step data',
            },
          },
          required: ['command', 'current_step_order', 'current_step'],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    if (request.params.name === 'plan_recipe') {
      const args = request.params.arguments as any;

      if (!args.title || !args.ingredients || !args.steps) {
        throw new Error('Missing required fields: title, ingredients, steps');
      }

      const result = await generatePlan(args as RecipeInput);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } else if (request.params.name === 'handle_control_command') {
      const args = request.params.arguments as any;

      if (!args.command || !args.current_step) {
        throw new Error('Missing required fields: command, current_step');
      }

      const result = handleControlCommand(args.command, args.current_step);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }

    throw new Error(`Unknown tool: ${request.params.name}`);
  } catch (error: any) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ error: error.message }, null, 2),
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Planning MCP Server (TypeScript) running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
