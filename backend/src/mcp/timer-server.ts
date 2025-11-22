/**
 * MCP Timer Server
 * Handles cooking timers with direct PostgreSQL access
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
    name: 'yorijori-timer-server',
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
        name: 'start_timer',
        description: 'Start a cooking timer with specified duration',
        inputSchema: {
          type: 'object',
          properties: {
            session_id: {
              type: 'string',
              description: 'The cooking session ID',
            },
            duration_minutes: {
              type: 'number',
              description: 'Timer duration in minutes',
            },
            label: {
              type: 'string',
              description: 'Optional label for the timer (e.g., "Boil water")',
            },
          },
          required: ['session_id', 'duration_minutes'],
        },
      },
      {
        name: 'stop_timer',
        description: 'Stop the currently running timer',
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
        name: 'check_timer',
        description: 'Check the status of the current timer',
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
      case 'start_timer':
        return await handleStartTimer(
          args.session_id as string,
          args.duration_minutes as number,
          args.label as string | undefined
        );

      case 'stop_timer':
        return await handleStopTimer(args.session_id as string);

      case 'check_timer':
        return await handleCheckTimer(args.session_id as string);

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
// Timer Logic
// ============================================================================

async function handleStartTimer(
  sessionId: string,
  durationMinutes: number,
  label?: string
) {
  const client = await pool.connect();

  try {
    // Validate duration
    if (durationMinutes <= 0) {
      throw new Error('Duration must be greater than 0');
    }

    // Get current session and step
    const sessionResult = await client.query(
      'SELECT current_step_index FROM cooking_sessions WHERE session_id = $1',
      [sessionId]
    );

    if (sessionResult.rows.length === 0) {
      throw new Error('Session not found');
    }

    const { current_step_index } = sessionResult.rows[0];

    const durationSeconds = Math.round(durationMinutes * 60);
    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + durationSeconds * 1000);

    // Log timer start
    await client.query(
      `INSERT INTO session_states (session_id, state_type, state_data)
       VALUES ($1, $2, $3)`,
      [
        sessionId,
        'timer_event',
        JSON.stringify({
          action: 'start',
          duration_minutes: durationMinutes,
          duration_seconds: durationSeconds,
          label: label || `Step ${current_step_index + 1} Timer`,
          step: current_step_index,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          timestamp: new Date().toISOString(),
        }),
      ]
    );

    console.log(
      `[MCP Timer] Started: ${durationMinutes}min (${durationSeconds}s) - "${label || 'Timer'}"`
    );

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            action: 'timer_started',
            duration_minutes: durationMinutes,
            duration_seconds: durationSeconds,
            label: label || `Step ${current_step_index + 1} Timer`,
            start_time: startTime.toISOString(),
            end_time: endTime.toISOString(),
            step_index: current_step_index,
          }),
        },
      ],
    };
  } finally {
    client.release();
  }
}

async function handleStopTimer(sessionId: string) {
  const client = await pool.connect();

  try {
    // Get current session
    const sessionResult = await client.query(
      'SELECT current_step_index FROM cooking_sessions WHERE session_id = $1',
      [sessionId]
    );

    if (sessionResult.rows.length === 0) {
      throw new Error('Session not found');
    }

    const { current_step_index } = sessionResult.rows[0];

    // Get most recent timer
    const timerResult = await client.query(
      `SELECT state_data FROM session_states
       WHERE session_id = $1 AND state_type = 'timer_event'
       ORDER BY created_at DESC LIMIT 1`,
      [sessionId]
    );

    if (timerResult.rows.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: 'No timer found',
            }),
          },
        ],
      };
    }

    const lastTimer = timerResult.rows[0].state_data;

    // Check if timer was already stopped
    if (lastTimer.action === 'stop') {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: 'Timer already stopped',
            }),
          },
        ],
      };
    }

    const stopTime = new Date();

    // Log timer stop
    await client.query(
      `INSERT INTO session_states (session_id, state_type, state_data)
       VALUES ($1, $2, $3)`,
      [
        sessionId,
        'timer_event',
        JSON.stringify({
          action: 'stop',
          label: lastTimer.label,
          step: current_step_index,
          stop_time: stopTime.toISOString(),
          original_duration_seconds: lastTimer.duration_seconds,
          timestamp: new Date().toISOString(),
        }),
      ]
    );

    console.log(`[MCP Timer] Stopped: "${lastTimer.label}"`);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            action: 'timer_stopped',
            label: lastTimer.label,
            stop_time: stopTime.toISOString(),
            step_index: current_step_index,
          }),
        },
      ],
    };
  } finally {
    client.release();
  }
}

async function handleCheckTimer(sessionId: string) {
  const client = await pool.connect();

  try {
    // Get current session
    const sessionResult = await client.query(
      'SELECT current_step_index FROM cooking_sessions WHERE session_id = $1',
      [sessionId]
    );

    if (sessionResult.rows.length === 0) {
      throw new Error('Session not found');
    }

    // Get most recent timer
    const timerResult = await client.query(
      `SELECT state_data, created_at FROM session_states
       WHERE session_id = $1 AND state_type = 'timer_event'
       ORDER BY created_at DESC LIMIT 1`,
      [sessionId]
    );

    if (timerResult.rows.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              timer_active: false,
              message: 'No timer found',
            }),
          },
        ],
      };
    }

    const lastTimer = timerResult.rows[0].state_data;

    // If last event was stop, no active timer
    if (lastTimer.action === 'stop') {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              timer_active: false,
              last_timer: {
                label: lastTimer.label,
                stopped_at: lastTimer.stop_time,
              },
            }),
          },
        ],
      };
    }

    // Timer is active
    const now = new Date();
    const startTime = new Date(lastTimer.start_time);
    const endTime = new Date(lastTimer.end_time);
    const elapsed = Math.floor((now.getTime() - startTime.getTime()) / 1000);
    const remaining = Math.max(0, Math.floor((endTime.getTime() - now.getTime()) / 1000));
    const isExpired = now >= endTime;

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            timer_active: !isExpired,
            timer: {
              label: lastTimer.label,
              duration_seconds: lastTimer.duration_seconds,
              elapsed_seconds: elapsed,
              remaining_seconds: remaining,
              is_expired: isExpired,
              start_time: lastTimer.start_time,
              end_time: lastTimer.end_time,
              step_index: lastTimer.step,
            },
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
  console.error('[MCP Timer Server] Started successfully');
}

main().catch((error) => {
  console.error('[MCP Timer Server] Fatal error:', error);
  process.exit(1);
});
