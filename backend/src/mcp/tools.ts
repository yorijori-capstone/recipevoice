/**
 * MCP Function Calling Tools
 * Provides Timer, State Management, and Navigation tools for LangChain Agent
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// ============================================================================
// Tool Implementations
// ============================================================================

/**
 * Timer Management Tools
 */
class TimerManager {
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private timerStates: Map<
    string,
    {
      sessionId: string;
      duration: number;
      startTime: number;
      remaining: number;
      status: 'running' | 'paused' | 'stopped';
    }
  > = new Map();

  startTimer(sessionId: string, duration: number): any {
    // Clear existing timer if any
    this.stopTimer(sessionId);

    const timerId = `timer_${sessionId}`;
    const startTime = Date.now();

    this.timerStates.set(timerId, {
      sessionId,
      duration,
      startTime,
      remaining: duration,
      status: 'running',
    });

    const timer = setTimeout(() => {
      this.onTimerComplete(sessionId);
    }, duration * 1000);

    this.timers.set(timerId, timer);

    console.log(`[TimerManager] Started ${duration}s timer for session ${sessionId}`);

    return {
      success: true,
      session_id: sessionId,
      duration_sec: duration,
      message: `${duration}초 타이머를 시작했습니다.`,
    };
  }

  stopTimer(sessionId: string): any {
    const timerId = `timer_${sessionId}`;
    const timer = this.timers.get(timerId);
    const state = this.timerStates.get(timerId);

    if (timer) {
      clearTimeout(timer);
      this.timers.delete(timerId);
    }

    if (state) {
      state.status = 'stopped';
      console.log(`[TimerManager] Stopped timer for session ${sessionId}`);

      return {
        success: true,
        session_id: sessionId,
        elapsed_sec: Math.floor((Date.now() - state.startTime) / 1000),
        message: '타이머를 정지했습니다.',
      };
    }

    return {
      success: false,
      message: '실행 중인 타이머가 없습니다.',
    };
  }

  getTimerStatus(sessionId: string): any {
    const timerId = `timer_${sessionId}`;
    const state = this.timerStates.get(timerId);

    if (!state) {
      return {
        success: false,
        message: '타이머가 설정되지 않았습니다.',
      };
    }

    const elapsed = Math.floor((Date.now() - state.startTime) / 1000);
    const remaining = Math.max(0, state.duration - elapsed);

    return {
      success: true,
      session_id: sessionId,
      duration_sec: state.duration,
      elapsed_sec: elapsed,
      remaining_sec: remaining,
      status: state.status,
      message: `남은 시간: ${remaining}초`,
    };
  }

  private onTimerComplete(sessionId: string): void {
    const timerId = `timer_${sessionId}`;
    const state = this.timerStates.get(timerId);

    if (state) {
      state.status = 'stopped';
      state.remaining = 0;
    }

    console.log(`[TimerManager] Timer completed for session ${sessionId}`);

    // In production, this would trigger a notification/sound
    // For now, just log completion
  }
}

/**
 * Session State Management
 */
class SessionStateManager {
  private sessionStates: Map<string, any> = new Map();

  updateSessionState(sessionId: string, stateData: any): any {
    this.sessionStates.set(sessionId, {
      ...this.sessionStates.get(sessionId),
      ...stateData,
      last_updated: new Date().toISOString(),
    });

    console.log(`[SessionStateManager] Updated state for session ${sessionId}`);

    return {
      success: true,
      session_id: sessionId,
      state: this.sessionStates.get(sessionId),
    };
  }

  getSessionState(sessionId: string): any {
    const state = this.sessionStates.get(sessionId);

    if (!state) {
      return {
        success: false,
        message: '세션을 찾을 수 없습니다.',
      };
    }

    return {
      success: true,
      session_id: sessionId,
      state,
    };
  }

  deleteSessionState(sessionId: string): any {
    const existed = this.sessionStates.has(sessionId);
    this.sessionStates.delete(sessionId);

    return {
      success: true,
      session_id: sessionId,
      deleted: existed,
    };
  }
}

/**
 * Step Navigation Tools
 */
class StepNavigator {
  private currentSteps: Map<string, number> = new Map();

  nextStep(sessionId: string, totalSteps: number): any {
    const currentStep = this.currentSteps.get(sessionId) || 0;

    if (currentStep >= totalSteps - 1) {
      return {
        success: false,
        message: '마지막 단계입니다.',
        current_step: currentStep,
      };
    }

    const newStep = currentStep + 1;
    this.currentSteps.set(sessionId, newStep);

    console.log(`[StepNavigator] Session ${sessionId}: Step ${currentStep} → ${newStep}`);

    return {
      success: true,
      session_id: sessionId,
      current_step: newStep,
      total_steps: totalSteps,
      message: `${newStep + 1}번째 단계로 이동합니다.`,
    };
  }

  previousStep(sessionId: string): any {
    const currentStep = this.currentSteps.get(sessionId) || 0;

    if (currentStep <= 0) {
      return {
        success: false,
        message: '첫 번째 단계입니다.',
        current_step: currentStep,
      };
    }

    const newStep = currentStep - 1;
    this.currentSteps.set(sessionId, newStep);

    console.log(`[StepNavigator] Session ${sessionId}: Step ${currentStep} → ${newStep}`);

    return {
      success: true,
      session_id: sessionId,
      current_step: newStep,
      message: `${newStep + 1}번째 단계로 돌아갑니다.`,
    };
  }

  getCurrentStep(sessionId: string): any {
    const currentStep = this.currentSteps.get(sessionId);

    if (currentStep === undefined) {
      return {
        success: false,
        message: '세션을 찾을 수 없습니다.',
      };
    }

    return {
      success: true,
      session_id: sessionId,
      current_step: currentStep,
    };
  }

  setCurrentStep(sessionId: string, step: number): any {
    this.currentSteps.set(sessionId, step);

    return {
      success: true,
      session_id: sessionId,
      current_step: step,
    };
  }
}

// ============================================================================
// MCP Server Setup
// ============================================================================

const timerManager = new TimerManager();
const sessionStateManager = new SessionStateManager();
const stepNavigator = new StepNavigator();

const server = new Server(
  {
    name: 'cooking-tools-mcp',
    version: '2.0.0',
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
      // ======================================================================
      // Timer Tools
      // ======================================================================
      {
        name: 'start_timer',
        description: 'Start a cooking timer for specified duration',
        inputSchema: {
          type: 'object',
          properties: {
            session_id: {
              type: 'string',
              description: 'Cooking session ID',
            },
            duration_sec: {
              type: 'number',
              description: 'Timer duration in seconds',
            },
          },
          required: ['session_id', 'duration_sec'],
        },
      },
      {
        name: 'stop_timer',
        description: 'Stop the current timer',
        inputSchema: {
          type: 'object',
          properties: {
            session_id: {
              type: 'string',
              description: 'Cooking session ID',
            },
          },
          required: ['session_id'],
        },
      },
      {
        name: 'get_timer_status',
        description: 'Get current timer status and remaining time',
        inputSchema: {
          type: 'object',
          properties: {
            session_id: {
              type: 'string',
              description: 'Cooking session ID',
            },
          },
          required: ['session_id'],
        },
      },

      // ======================================================================
      // Session State Tools
      // ======================================================================
      {
        name: 'update_session_state',
        description: 'Update session state with new data',
        inputSchema: {
          type: 'object',
          properties: {
            session_id: {
              type: 'string',
              description: 'Cooking session ID',
            },
            state_data: {
              type: 'object',
              description: 'State data to update',
            },
          },
          required: ['session_id', 'state_data'],
        },
      },
      {
        name: 'get_session_state',
        description: 'Get current session state',
        inputSchema: {
          type: 'object',
          properties: {
            session_id: {
              type: 'string',
              description: 'Cooking session ID',
            },
          },
          required: ['session_id'],
        },
      },

      // ======================================================================
      // Navigation Tools
      // ======================================================================
      {
        name: 'next_step',
        description: 'Move to next cooking step',
        inputSchema: {
          type: 'object',
          properties: {
            session_id: {
              type: 'string',
              description: 'Cooking session ID',
            },
            total_steps: {
              type: 'number',
              description: 'Total number of steps in recipe',
            },
          },
          required: ['session_id', 'total_steps'],
        },
      },
      {
        name: 'previous_step',
        description: 'Move to previous cooking step',
        inputSchema: {
          type: 'object',
          properties: {
            session_id: {
              type: 'string',
              description: 'Cooking session ID',
            },
          },
          required: ['session_id'],
        },
      },
      {
        name: 'get_current_step',
        description: 'Get current step index',
        inputSchema: {
          type: 'object',
          properties: {
            session_id: {
              type: 'string',
              description: 'Cooking session ID',
            },
          },
          required: ['session_id'],
        },
      },
      {
        name: 'set_current_step',
        description: 'Set current step index',
        inputSchema: {
          type: 'object',
          properties: {
            session_id: {
              type: 'string',
              description: 'Cooking session ID',
            },
            step: {
              type: 'number',
              description: 'Step index to set',
            },
          },
          required: ['session_id', 'step'],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params;
    let result: any;

    if (!args || typeof args !== 'object') {
      throw new Error('Invalid arguments');
    }

    const typedArgs = args as any;

    // Timer tools
    if (name === 'start_timer') {
      result = timerManager.startTimer(typedArgs.session_id, typedArgs.duration_sec);
    } else if (name === 'stop_timer') {
      result = timerManager.stopTimer(typedArgs.session_id);
    } else if (name === 'get_timer_status') {
      result = timerManager.getTimerStatus(typedArgs.session_id);
    }
    // Session state tools
    else if (name === 'update_session_state') {
      result = sessionStateManager.updateSessionState(typedArgs.session_id, typedArgs.state_data);
    } else if (name === 'get_session_state') {
      result = sessionStateManager.getSessionState(typedArgs.session_id);
    }
    // Navigation tools
    else if (name === 'next_step') {
      result = stepNavigator.nextStep(typedArgs.session_id, typedArgs.total_steps);
    } else if (name === 'previous_step') {
      result = stepNavigator.previousStep(typedArgs.session_id);
    } else if (name === 'get_current_step') {
      result = stepNavigator.getCurrentStep(typedArgs.session_id);
    } else if (name === 'set_current_step') {
      result = stepNavigator.setCurrentStep(typedArgs.session_id, typedArgs.step);
    } else {
      throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
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
  console.error('Cooking Tools MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
