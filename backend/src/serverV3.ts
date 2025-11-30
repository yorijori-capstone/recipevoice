/**
 * Server V3 - Uses V3 architecture with CookingServiceV3 and MCP Tool Calling
 */

import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import dotenv from 'dotenv';
import cors from 'cors';
import recipeRoutes from './routes/recipes.js';
import cookingV3Routes, { getCookingServiceV3 } from './routes/cookingV3.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend V3 is running!' });
});

// Recipe API routes
app.use('/api/recipes', recipeRoutes);

// Cooking mode API routes (V3: MCP Tool Calling)
app.use('/api/cooking/v3', cookingV3Routes);  // v2 → v3로 변경

const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = '0.0.0.0'; // Listen on all network interfaces
const server = app.listen(PORT, HOST, () => {
  console.log(`🚀 Server V3 running on ${HOST}:${PORT}`);
});

// ============================================================================
// WebSocket Server with RealtimeServiceV3 Integration
// ============================================================================

const wss = new WebSocketServer({ server });

wss.on('connection', (ws: WebSocket) => {
  console.log('👤 Client connected to WebSocket (V3)');

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    ws.send(
      JSON.stringify({
        type: 'error',
        error: 'OpenAI API key not configured',
      })
    );
    ws.close();
    return;
  }

  let currentSessionId: string | null = null;

  // ============================================================================
  // Event Handler References (for cleanup on disconnect)
  // ============================================================================
  type EventHandler = (data: any) => void;

  const eventHandlers: {
    realtimeService: Map<string, EventHandler>;
    agent: Map<string, EventHandler>;
  } = {
    realtimeService: new Map(),
    agent: new Map(),
  };

  // Cleanup function to remove all event listeners
  const cleanupEventHandlers = async () => {
    try {
      const service = await getCookingServiceV3();
      // const realtimeService = service.getRealtimeService(); // Removed
      const agent = service.getCookingAgent();

      // Remove RealtimeService listeners
      // We need to find the realtime service instance that was used.
      // Since we store handlers in a Map, we can't easily get the service instance back unless we stored it.
      // But we can get it from the session if currentSessionId is set.

      if (currentSessionId) {
        const session = agent.getSession(currentSessionId);
        if (session && session.realtimeService) {
          const realtimeService = session.realtimeService;

          eventHandlers.realtimeService.forEach((handler, eventName) => {
            realtimeService.removeListener(eventName, handler);
            console.log(`🧹 Removed realtimeService listener: ${eventName}`);
          });
        }
      }
      eventHandlers.realtimeService.clear();

      // Remove Agent listeners
      eventHandlers.agent.forEach((handler, eventName) => {
        agent.removeListener(eventName, handler);
        console.log(`🧹 Removed agent listener: ${eventName}`);
      });
      eventHandlers.agent.clear();

      console.log('✅ All event handlers cleaned up');
    } catch (error) {
      console.error('[Server V3] Error cleaning up event handlers:', error);
    }
  };

  // Setup event handlers for RealtimeServiceV3
  const setupRealtimeHandlers = async (sessionId: string) => {
    try {
      const service = await getCookingServiceV3();
      // const realtimeService = service.getRealtimeService(); // Removed
      const agent = service.getCookingAgent();

      const session = agent.getSession(sessionId);
      if (!session) {
        throw new Error(`Session not found: ${sessionId}`);
      }

      const realtimeService = session.realtimeService;
      if (!realtimeService) {
        throw new Error(`RealtimeService not found for session: ${sessionId}`);
      }

      // Set active session - No longer needed as service is session-specific
      // realtimeService.setActiveSession(sessionId);

      // Connect to OpenAI Realtime API
      if (!realtimeService.isConnected()) {
        await realtimeService.connect();
      }

      // User transcription
      const userTranscriptionHandler: EventHandler = (data) => {
        ws.send(
          JSON.stringify({
            type: 'user_transcription',
            transcript: data.transcript,
          })
        );
      };
      realtimeService.on('user_transcription', userTranscriptionHandler);
      eventHandlers.realtimeService.set('user_transcription', userTranscriptionHandler);

      // Assistant transcript delta
      const assistantDeltaHandler: EventHandler = (data) => {
        ws.send(
          JSON.stringify({
            type: 'assistant_transcript_delta',
            delta: data.delta,
          })
        );
      };
      realtimeService.on('assistant_transcript_delta', assistantDeltaHandler);
      eventHandlers.realtimeService.set('assistant_transcript_delta', assistantDeltaHandler);

      // Assistant transcript done
      const assistantDoneHandler: EventHandler = (data) => {
        ws.send(
          JSON.stringify({
            type: 'assistant_transcript_done',
            transcript: data.transcript,
          })
        );
      };
      realtimeService.on('assistant_transcript_done', assistantDoneHandler);
      eventHandlers.realtimeService.set('assistant_transcript_done', assistantDoneHandler);

      // Audio delta (TTS output)
      const audioDeltaHandler: EventHandler = (chunk) => {
        ws.send(
          JSON.stringify({
            type: 'audio_delta',
            audio: chunk,
          })
        );
      };
      realtimeService.on('audio_delta', audioDeltaHandler);
      eventHandlers.realtimeService.set('audio_delta', audioDeltaHandler);

      // 🆕 Speech started (사용자가 말하기 시작 - 프론트엔드에서 오디오 중단용)
      const speechStartedHandler: EventHandler = () => {
        ws.send(JSON.stringify({ type: 'speech_started' }));
      };
      realtimeService.on('speech_started', speechStartedHandler);
      eventHandlers.realtimeService.set('speech_started', speechStartedHandler);

      // 🆕 Response created (새 응답 시작 - 프론트엔드에서 오디오 큐 정리용)
      const responseCreatedHandler: EventHandler = () => {
        ws.send(JSON.stringify({ type: 'response.created' }));
      };
      realtimeService.on('response_created', responseCreatedHandler);
      eventHandlers.realtimeService.set('response_created', responseCreatedHandler);

      // LangChain response
      const langchainResponseHandler: EventHandler = (data) => {
        console.log('[Server V3] LangChain response:', data);

        // Send to frontend
        ws.send(
          JSON.stringify({
            type: 'langchain_response',
            sessionId: data.sessionId,
            result: data.result,
          })
        );

        // If step changed, broadcast state update
        if (data.result.success && data.result.data?.step) {
          const session = agent.getSession(sessionId);
          if (session) {
            ws.send(
              JSON.stringify({
                type: 'session_state_updated',
                sessionId: session.sessionId,
                currentStepIndex: session.currentStepIndex,
                viewingStepIndex: session.viewingStepIndex,
                status: session.status,
                currentStep: data.result.data.step,
              })
            );
          }
        }
      };
      realtimeService.on('langchain_response', langchainResponseHandler);
      eventHandlers.realtimeService.set('langchain_response', langchainResponseHandler);

      // Error handling
      const errorHandler: EventHandler = (error) => {
        ws.send(
          JSON.stringify({
            type: 'error',
            error: error.message || 'Unknown error',
          })
        );
      };
      realtimeService.on('error', errorHandler);
      eventHandlers.realtimeService.set('error', errorHandler);

      console.log(`✅ Realtime handlers setup for session: ${sessionId}`);
    } catch (error: any) {
      console.error('[Server V3] Failed to setup realtime handlers:', error);
      ws.send(
        JSON.stringify({
          type: 'error',
          error: `Failed to setup realtime: ${error.message}`,
        })
      );
    }
  };

  // Listen to CookingAgent events for state broadcasting
  const setupAgentHandlers = async (sessionId: string) => {
    try {
      const service = await getCookingServiceV3();
      const agent = service.getCookingAgent();
      // const realtimeService = service.getRealtimeService(); // Removed global access

      // Step changed
      const stepChangedHandler: EventHandler = (data) => {
        if (data.sessionId === currentSessionId) {
          ws.send(
            JSON.stringify({
              type: 'step_changed',
              sessionId: data.sessionId,
              stepIndex: data.stepIndex,
              step: data.step,
            })
          );
        }
      };
      agent.on('step_changed', stepChangedHandler);
      eventHandlers.agent.set('step_changed', stepChangedHandler);

      // We need to attach tool_executed listener to the session's realtime service
      // But this function setupAgentHandlers is called with sessionId.
      // So we can get the realtime service from the session.

      const session = agent.getSession(sessionId);
      if (session && session.realtimeService) {
        const realtimeService = session.realtimeService;

        // Tool executed (MCP)
        const toolExecutedHandler: EventHandler = (data) => {
          // ... same logic ...
          if (data.sessionId === currentSessionId) {
            console.log(`[Server V3] Tool executed: ${data.toolName}`, data.result);

            ws.send(
              JSON.stringify({
                type: 'tool_executed',
                sessionId: data.sessionId,
                tool: data.toolName,
                result: data.result,
              })
            );

            // If navigation tool, also send session state update for UI sync
            if (data.toolName.startsWith('navigate_') && data.result?.success && currentSessionId) {
              const session = agent.getSession(currentSessionId);
              if (session) {
                ws.send(
                  JSON.stringify({
                    type: 'session_state_updated',
                    sessionId: session.sessionId,
                    currentStepIndex: data.result.current_step_index,
                    viewingStepIndex: data.result.current_step_index,
                    totalSteps: data.result.total_steps,
                    status: session.status,
                  })
                );
              }
            }
          }
        };
        realtimeService.on('tool_executed', toolExecutedHandler);
        eventHandlers.realtimeService.set('tool_executed', toolExecutedHandler);

        // Timer reset event (step change)
        const timerResetHandler: EventHandler = (data) => {
          if (data.sessionId === currentSessionId) {
            console.log(`[Server V3] Timer reset: step ${data.stepIndex}, reason: ${data.reason}`);
            ws.send(
              JSON.stringify({
                type: 'timer_reset',
                sessionId: data.sessionId,
                stepIndex: data.stepIndex,
                reason: data.reason,
              })
            );
          }
        };
        realtimeService.on('timer_reset', timerResetHandler);
        eventHandlers.realtimeService.set('timer_reset', timerResetHandler);
      }

      // Session ended
      const sessionEndedHandler: EventHandler = (data) => {
        if (data.sessionId === currentSessionId) {
          ws.send(
            JSON.stringify({
              type: 'session_ended',
              sessionId: data.sessionId,
            })
          );
        }
      };
      agent.on('session_ended', sessionEndedHandler);
      eventHandlers.agent.set('session_ended', sessionEndedHandler);

      console.log(`✅ Agent handlers setup for session: ${sessionId}`);
    } catch (error: any) {
      console.error('[Server V3] Failed to setup agent handlers:', error);
    }
  };

  // WebSocket message handler
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message.toString());

      switch (data.type) {
        case 'init_session':
          if (data.sessionId) {
            console.log(`🔧 Initializing V3 session: ${data.sessionId}`);
            currentSessionId = data.sessionId;

            // Setup all handlers
            await setupRealtimeHandlers(data.sessionId);
            await setupAgentHandlers(data.sessionId);

            ws.send(
              JSON.stringify({
                type: 'session_initialized',
                sessionId: data.sessionId,
                version: 'v3',
              })
            );
          }
          break;

        case 'audio':
          if (currentSessionId) {
            const service = await getCookingServiceV3();
            // const realtimeService = service.getRealtimeService();
            const agent = service.getCookingAgent();
            const session = agent.getSession(currentSessionId);
            if (session && session.realtimeService) {
              session.realtimeService.sendAudio(data.audio);
            }
          }
          break;

        case 'start_streaming':
          if (currentSessionId) {
            const service = await getCookingServiceV3();
            const agent = service.getCookingAgent();
            const session = agent.getSession(currentSessionId);
            if (session && session.realtimeService) {
              session.realtimeService.startStreaming();
            }
          }
          break;

        case 'stop_streaming':
          if (currentSessionId) {
            const service = await getCookingServiceV3();
            const agent = service.getCookingAgent();
            const session = agent.getSession(currentSessionId);
            if (session && session.realtimeService) {
              session.realtimeService.stopStreaming();
            }
          }
          break;

        case 'set_vad_mode':
          if (currentSessionId) {
            const service = await getCookingServiceV3();
            const agent = service.getCookingAgent();
            const session = agent.getSession(currentSessionId);
            if (session && session.realtimeService) {
              const mode = data.mode === 'server_vad' ? 'auto' : 'manual';
              session.realtimeService.setVADMode(mode);

              ws.send(
                JSON.stringify({
                  type: 'vad_mode_changed',
                  mode: data.mode,
                })
              );
              console.log(`✅ VAD mode changed to: ${data.mode}`);
            }
          }
          break;

        case 'send_text':
          if (currentSessionId && data.text) {
            console.log(`💬 Received text message: ${data.text}`);
            const service = await getCookingServiceV3();
            const agent = service.getCookingAgent();
            const session = agent.getSession(currentSessionId);
            if (session && session.realtimeService) {
              session.realtimeService.sendTextMessage(data.text);
            }
          }
          break;

        // 🆕 Timer state update from frontend
        case 'timer_state_update':
          if (currentSessionId && data.timerState) {
            console.log(`⏱️ Timer state update:`, data.timerState);
            const service = await getCookingServiceV3();
            const agent = service.getCookingAgent();
            const session = agent.getSession(currentSessionId);
            if (session && session.realtimeService) {
              session.realtimeService.updateTimerState(data.timerState);
            }
          }
          break;

        // NEW: Manual step navigation from frontend
        case 'next_step':
          if (currentSessionId) {
            const service = await getCookingServiceV3();
            const agent = service.getCookingAgent();
            const nextStep = await agent.nextStep(currentSessionId);

            ws.send(
              JSON.stringify({
                type: 'step_changed',
                sessionId: currentSessionId,
                stepIndex: agent.getSession(currentSessionId)?.currentStepIndex,
                step: nextStep,
              })
            );
          }
          break;

        case 'previous_step':
          if (currentSessionId) {
            const service = await getCookingServiceV3();
            const agent = service.getCookingAgent();
            const previousStep = await agent.previousStep(currentSessionId);

            ws.send(
              JSON.stringify({
                type: 'step_changed',
                sessionId: currentSessionId,
                stepIndex: agent.getSession(currentSessionId)?.currentStepIndex,
                step: previousStep,
              })
            );
          }
          break;

        default:
          console.log('[Server V3] Unknown message type:', data.type);
      }
    } catch (error: any) {
      console.error('[Server V3] Error processing message:', error);
      ws.send(
        JSON.stringify({
          type: 'error',
          error: error.message,
        })
      );
    }
  });

  ws.on('close', async (code, reason) => {
    console.log(`👋 Client disconnected (code: ${code}, reason: ${reason || 'none'})`);

    // Cleanup all event handlers to prevent memory leaks
    await cleanupEventHandlers();

    currentSessionId = null;
  });

  ws.on('error', (error: Error) => {
    console.error('[Server V3] WebSocket error:', error);
  });
});

console.log('✅ WebSocket server ready (V3 with MCP Tool Calling)');
