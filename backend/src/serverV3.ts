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

const PORT = process.env.PORT || 3001;
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

  // Setup event handlers for RealtimeServiceV3
  const setupRealtimeHandlers = async (sessionId: string) => {
    try {
      const service = await getCookingServiceV3();
      const realtimeService = service.getRealtimeService();
      const agent = service.getCookingAgent();

      // Set active session
      realtimeService.setActiveSession(sessionId);

      // Connect to OpenAI Realtime API
      if (!realtimeService.isConnected()) {
        await realtimeService.connect();
      }

      // User transcription
      realtimeService.on('user_transcription', (data: any) => {
        ws.send(
          JSON.stringify({
            type: 'user_transcription',
            transcript: data.transcript,
          })
        );
      });

      // Assistant transcript delta
      realtimeService.on('assistant_transcript_delta', (data: any) => {
        ws.send(
          JSON.stringify({
            type: 'assistant_transcript_delta',
            delta: data.delta,
          })
        );
      });

      // Assistant transcript done
      realtimeService.on('assistant_transcript_done', (data: any) => {
        ws.send(
          JSON.stringify({
            type: 'assistant_transcript_done',
            transcript: data.transcript,
          })
        );
      });

      // Audio delta (TTS output)
      realtimeService.on('audio_delta', (chunk: string) => {
        ws.send(
          JSON.stringify({
            type: 'audio_delta',
            audio: chunk,
          })
        );
      });

      // LangChain response (NEW!)
      realtimeService.on('langchain_response', (data: any) => {
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
      });

      // Error handling
      realtimeService.on('error', (error: any) => {
        ws.send(
          JSON.stringify({
            type: 'error',
            error: error.message || 'Unknown error',
          })
        );
      });

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
      const realtimeService = service.getRealtimeService();  // 🆕 Phase 3

      // Step changed
      agent.on('step_changed', (data: any) => {
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
      });

      // 🆕 Phase 2: voice_mode_changed event removed

      // 🆕 Phase 3: Tool executed (MCP)
      realtimeService.on('tool_executed', (data: any) => {
        if (data.sessionId === currentSessionId) {
          console.log(`[Server V3] Tool executed: ${data.toolName}`, data.result);

          ws.send(
            JSON.stringify({
              type: 'tool_executed',
              sessionId: data.sessionId,
              tool: data.toolName,  // Frontend expects 'tool', not 'toolName'
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
      });

      // Session ended
      agent.on('session_ended', (data: any) => {
        if (data.sessionId === currentSessionId) {
          ws.send(
            JSON.stringify({
              type: 'session_ended',
              sessionId: data.sessionId,
            })
          );
        }
      });

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
            const realtimeService = service.getRealtimeService();
            realtimeService.sendAudio(data.audio);
          }
          break;

        case 'start_streaming':
          if (currentSessionId) {
            const service = await getCookingServiceV3();
            const realtimeService = service.getRealtimeService();
            realtimeService.startStreaming();
          }
          break;

        case 'stop_streaming':
          if (currentSessionId) {
            const service = await getCookingServiceV3();
            const realtimeService = service.getRealtimeService();
            realtimeService.stopStreaming();
          }
          break;

        case 'set_vad_mode':
          if (currentSessionId) {
            const service = await getCookingServiceV3();
            const realtimeService = service.getRealtimeService();
            const mode = data.mode === 'server_vad' ? 'auto' : 'manual';
            realtimeService.setVADMode(mode);

            ws.send(
              JSON.stringify({
                type: 'vad_mode_changed',
                mode: data.mode,
              })
            );
            console.log(`✅ VAD mode changed to: ${data.mode}`);
          }
          break;

        case 'send_text':
          if (currentSessionId && data.text) {
            console.log(`💬 Received text message: ${data.text}`);
            const service = await getCookingServiceV3();
            const realtimeService = service.getRealtimeService();
            realtimeService.sendTextMessage(data.text);
          }
          break;

        // 🆕 Timer state update from frontend
        case 'timer_state_update':
          if (currentSessionId && data.timerState) {
            console.log(`⏱️ Timer state update:`, data.timerState);
            const service = await getCookingServiceV3();
            const realtimeService = service.getRealtimeService();
            realtimeService.updateTimerState(data.timerState);
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

  ws.on('close', (code, reason) => {
    console.log(`👋 Client disconnected (code: ${code}, reason: ${reason || 'none'})`);
    currentSessionId = null;
  });

  ws.on('error', (error: Error) => {
    console.error('[Server V3] WebSocket error:', error);
  });
});

console.log('✅ WebSocket server ready (V3 with MCP Tool Calling)');
