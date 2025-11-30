/**
 * MCP Navigation Server
 * Handles step navigation with direct PostgreSQL access
 * Phase 3: V3 Architecture - Replace LangChain with MCP
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { pool } from '../db/pool.js';

// ============================================================================
// MCP Server Setup
// ============================================================================

const server = new Server(
  {
    name: 'yorijori-navigation-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// ============================================================================
// Tool Definitions
// ============================================================================

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'navigate_next_step',
        description: 'Move to the next cooking step',
        inputSchema: {
          type: 'object',
          properties: {
            session_id: {
              type: 'string',
              description: 'The cooking session ID',
            },
          },
          required: ['session_id'],
        },
      },
      {
        name: 'navigate_previous_step',
        description: 'Move to the previous cooking step',
        inputSchema: {
          type: 'object',
          properties: {
            session_id: {
              type: 'string',
              description: 'The cooking session ID',
            },
          },
          required: ['session_id'],
        },
      },
      {
        name: 'navigate_to_step',
        description: 'Jump to a specific cooking step by index',
        inputSchema: {
          type: 'object',
          properties: {
            session_id: {
              type: 'string',
              description: 'The cooking session ID',
            },
            step_index: {
              type: 'number',
              description: 'The target step index (0-based)',
            },
          },
          required: ['session_id', 'step_index'],
        },
      },
      {
        name: 'get_current_step',
        description: 'Get the current step information',
        inputSchema: {
          type: 'object',
          properties: {
            session_id: {
              type: 'string',
              description: 'The cooking session ID',
            },
          },
          required: ['session_id'],
        },
      },
    ],
  };
});

// ============================================================================
// Tool Handlers
// ============================================================================

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (!args) {
    throw new Error('Missing arguments');
  }

  try {
    switch (name) {
      case 'navigate_next_step':
        return await handleNextStep(args.session_id as string);

      case 'navigate_previous_step':
        return await handlePreviousStep(args.session_id as string);

      case 'navigate_to_step':
        return await handleNavigateToStep(
          args.session_id as string,
          args.step_index as number
        );

      case 'get_current_step':
        return await handleGetCurrentStep(args.session_id as string);

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error: any) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error.message,
          }),
        },
      ],
    };
  }
});

// ============================================================================
// Navigation Logic
// ============================================================================

async function handleNextStep(sessionId: string) {
  const client = await pool.connect();

  try {
    // Get current session
    const sessionResult = await client.query(
      'SELECT current_step_index, total_steps FROM cooking_sessions WHERE session_id = $1',
      [sessionId]
    );

    if (sessionResult.rows.length === 0) {
      throw new Error('Session not found');
    }

    const { current_step_index, total_steps } = sessionResult.rows[0];

    // Check if already at last step
    if (current_step_index >= total_steps - 1) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: 'Already at the last step',
              current_step_index,
              total_steps,
            }),
          },
        ],
      };
    }

    // 🆕 타이머가 실행 중이면 자동으로 중지
    const timerCheckResult = await client.query(
      `SELECT state_data, created_at FROM session_states
       WHERE session_id = $1 AND state_type = 'timer_event'
       ORDER BY created_at DESC LIMIT 1`,
      [sessionId]
    );

    if (timerCheckResult.rows.length > 0) {
      const lastTimer = timerCheckResult.rows[0].state_data;
      const now = new Date();
      const endTime = new Date(lastTimer.end_time);
      
      // 타이머가 실행 중이면 (마지막 이벤트가 start이고 아직 만료되지 않음)
      if (lastTimer.action === 'start' && now < endTime) {
        // 타이머 중지 이벤트 기록
        await client.query(
          `INSERT INTO session_states (session_id, state_type, state_data)
           VALUES ($1, $2, $3)`,
          [
            sessionId,
            'timer_event',
            JSON.stringify({
              action: 'stop',
              label: lastTimer.label,
              duration_seconds: lastTimer.duration_seconds,
              step: lastTimer.step,
              start_time: lastTimer.start_time,
              stop_time: now.toISOString(),
            }),
          ]
        );
        console.log(`[MCP Navigation] Timer stopped automatically before step change`);
      }
    }

    const newStepIndex = current_step_index + 1;

    // Update session
    await client.query(
      'UPDATE cooking_sessions SET current_step_index = $1, viewing_step_index = $1 WHERE session_id = $2',
      [newStepIndex, sessionId]
    );

    // Log state change
    await client.query(
      `INSERT INTO session_states (session_id, state_type, state_data)
       VALUES ($1, $2, $3)`,
      [
        sessionId,
        'step_change',
        JSON.stringify({
          from_step: current_step_index,
          to_step: newStepIndex,
          direction: 'next',
          timestamp: new Date().toISOString(),
        }),
      ]
    );

    // Get step details (step_order is 1-based, so newStepIndex + 1)
    const stepResult = await client.query(
      `SELECT cs.step_order, cs.script, cs.retry_script, cs.pause_hint
       FROM cleaned_steps cs
       JOIN cooking_sessions sess ON cs.cleaned_recipe_id = sess.cleaned_recipe_id
       WHERE sess.session_id = $1 AND cs.step_order = $2`,
      [sessionId, newStepIndex + 1]
    );

    const step = stepResult.rows[0];

    console.log(`[MCP Navigation] Next step: ${current_step_index} → ${newStepIndex}`);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            action: 'next_step',
            previous_step_index: current_step_index,
            current_step_index: newStepIndex,
            total_steps,
            step: step ? {
              step_order: step.step_order,
              script: step.script,
              retry_script: step.retry_script,
              pause_hint: step.pause_hint,
            } : null,
          }),
        },
      ],
    };
  } finally {
    client.release();
  }
}

async function handlePreviousStep(sessionId: string) {
  const client = await pool.connect();

  try {
    // Get current session
    const sessionResult = await client.query(
      'SELECT current_step_index, total_steps FROM cooking_sessions WHERE session_id = $1',
      [sessionId]
    );

    if (sessionResult.rows.length === 0) {
      throw new Error('Session not found');
    }

    const { current_step_index, total_steps } = sessionResult.rows[0];

    // Check if already at first step
    if (current_step_index <= 0) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: 'Already at the first step',
              current_step_index,
              total_steps,
            }),
          },
        ],
      };
    }

    const newStepIndex = current_step_index - 1;

    // Update session
    await client.query(
      'UPDATE cooking_sessions SET current_step_index = $1, viewing_step_index = $1 WHERE session_id = $2',
      [newStepIndex, sessionId]
    );

    // Log state change
    await client.query(
      `INSERT INTO session_states (session_id, state_type, state_data)
       VALUES ($1, $2, $3)`,
      [
        sessionId,
        'step_change',
        JSON.stringify({
          from_step: current_step_index,
          to_step: newStepIndex,
          direction: 'previous',
          timestamp: new Date().toISOString(),
        }),
      ]
    );

    // Get step details (step_order is 1-based, so newStepIndex + 1)
    const stepResult = await client.query(
      `SELECT cs.step_order, cs.script, cs.retry_script, cs.pause_hint
       FROM cleaned_steps cs
       JOIN cooking_sessions sess ON cs.cleaned_recipe_id = sess.cleaned_recipe_id
       WHERE sess.session_id = $1 AND cs.step_order = $2`,
      [sessionId, newStepIndex + 1]
    );

    const step = stepResult.rows[0];

    console.log(`[MCP Navigation] Previous step: ${current_step_index} → ${newStepIndex}`);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            action: 'previous_step',
            previous_step_index: current_step_index,
            current_step_index: newStepIndex,
            total_steps,
            step: step ? {
              step_order: step.step_order,
              script: step.script,
              retry_script: step.retry_script,
              pause_hint: step.pause_hint,
            } : null,
          }),
        },
      ],
    };
  } finally {
    client.release();
  }
}

async function handleNavigateToStep(sessionId: string, targetStepIndex: number) {
  const client = await pool.connect();

  try {
    // Get current session
    const sessionResult = await client.query(
      'SELECT current_step_index, total_steps FROM cooking_sessions WHERE session_id = $1',
      [sessionId]
    );

    if (sessionResult.rows.length === 0) {
      throw new Error('Session not found');
    }

    const { current_step_index, total_steps } = sessionResult.rows[0];

    // Validate target step
    if (targetStepIndex < 0 || targetStepIndex >= total_steps) {
      throw new Error(`Invalid step index: ${targetStepIndex} (total: ${total_steps})`);
    }

    // Update session
    await client.query(
      'UPDATE cooking_sessions SET current_step_index = $1, viewing_step_index = $1 WHERE session_id = $2',
      [targetStepIndex, sessionId]
    );

    // Log state change
    await client.query(
      `INSERT INTO session_states (session_id, state_type, state_data)
       VALUES ($1, $2, $3)`,
      [
        sessionId,
        'step_change',
        JSON.stringify({
          from_step: current_step_index,
          to_step: targetStepIndex,
          direction: 'jump',
          timestamp: new Date().toISOString(),
        }),
      ]
    );

    // Get step details (step_order is 1-based, so targetStepIndex + 1)
    const stepResult = await client.query(
      `SELECT cs.step_order, cs.script, cs.retry_script, cs.pause_hint
       FROM cleaned_steps cs
       JOIN cooking_sessions sess ON cs.cleaned_recipe_id = sess.cleaned_recipe_id
       WHERE sess.session_id = $1 AND cs.step_order = $2`,
      [sessionId, targetStepIndex + 1]
    );

    const step = stepResult.rows[0];

    console.log(`[MCP Navigation] Jump to step: ${current_step_index} → ${targetStepIndex}`);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            action: 'navigate_to_step',
            previous_step_index: current_step_index,
            current_step_index: targetStepIndex,
            total_steps,
            step: step ? {
              step_order: step.step_order,
              script: step.script,
              retry_script: step.retry_script,
              pause_hint: step.pause_hint,
            } : null,
          }),
        },
      ],
    };
  } finally {
    client.release();
  }
}

async function handleGetCurrentStep(sessionId: string) {
  const client = await pool.connect();

  try {
    // Get current session
    const sessionResult = await client.query(
      'SELECT current_step_index, total_steps FROM cooking_sessions WHERE session_id = $1',
      [sessionId]
    );

    if (sessionResult.rows.length === 0) {
      throw new Error('Session not found');
    }

    const { current_step_index, total_steps } = sessionResult.rows[0];

    // Get step details (step_order is 1-based, so current_step_index + 1)
    const stepResult = await client.query(
      `SELECT cs.step_order, cs.script, cs.retry_script, cs.pause_hint
       FROM cleaned_steps cs
       JOIN cooking_sessions sess ON cs.cleaned_recipe_id = sess.cleaned_recipe_id
       WHERE sess.session_id = $1 AND cs.step_order = $2`,
      [sessionId, current_step_index + 1]
    );

    const step = stepResult.rows[0];

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            current_step_index,
            total_steps,
            step: step ? {
              step_order: step.step_order,
              script: step.script,
              retry_script: step.retry_script,
              pause_hint: step.pause_hint,
            } : null,
          }),
        },
      ],
    };
  } finally {
    client.release();
  }
}

// ============================================================================
// Server Start
// ============================================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[MCP Navigation Server] Started successfully');
}

main().catch((error) => {
  console.error('[MCP Navigation Server] Fatal error:', error);
  process.exit(1);
});
