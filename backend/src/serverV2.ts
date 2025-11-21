/**
 * Server V2 - Uses new architecture with CookingServiceV2
 */

import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import dotenv from 'dotenv';
import cors from 'cors';
import recipeRoutes from './routes/recipes.js';
import cookingV2Routes, { getCookingServiceV2 } from './routes/cookingV2.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend V2 is running!' });
});

// Recipe API routes
app.use('/api/recipes', recipeRoutes);

// Cooking mode API routes
app.use('/api/cooking/v2', cookingV2Routes);

const PORT = process.env.PORT || 3001;
const server = app.listen(PORT, () => {
  console.log(`🚀 Server V2 running on port ${PORT}`);
});

// ============================================================================
// WebSocket Server with RealtimeServiceV2 Integration
// ============================================================================

const wss = new WebSocketServer({ server });

wss.on('connection', (ws: WebSocket) => {
  console.log('👤 Client connected to WebSocket (V2)');

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

  // Setup event handlers for RealtimeServiceV2
  const setupRealtimeHandlers = async (sessionId: string) => {
    try {
      const service = await getCookingServiceV2();
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
        console.log('[Server V2] LangChain response:', data);

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
      console.error('[Server V2] Failed to setup realtime handlers:', error);
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
      const service = await getCookingServiceV2();
      const agent = service.getCookingAgent();

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

      // Voice mode changed
      agent.on('voice_mode_changed', (data: any) => {
        if (data.sessionId === currentSessionId) {
          ws.send(
            JSON.stringify({
              type: 'voice_mode_changed',
              sessionId: data.sessionId,
              mode: data.mode,
            })
          );
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
      console.error('[Server V2] Failed to setup agent handlers:', error);
    }
  };

  // WebSocket message handler
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message.toString());

      switch (data.type) {
        case 'init_session':
          if (data.sessionId) {
            console.log(`🔧 Initializing V2 session: ${data.sessionId}`);
            currentSessionId = data.sessionId;

            // Setup all handlers
            await setupRealtimeHandlers(data.sessionId);
            await setupAgentHandlers(data.sessionId);

            ws.send(
              JSON.stringify({
                type: 'session_initialized',
                sessionId: data.sessionId,
                version: 'v2',
              })
            );
          }
          break;

        case 'audio':
          if (currentSessionId) {
            const service = await getCookingServiceV2();
            const realtimeService = service.getRealtimeService();
            realtimeService.sendAudio(data.audio);
          }
          break;

        case 'start_streaming':
          if (currentSessionId) {
            const service = await getCookingServiceV2();
            const realtimeService = service.getRealtimeService();
            realtimeService.startStreaming();
          }
          break;

        case 'stop_streaming':
          if (currentSessionId) {
            const service = await getCookingServiceV2();
            const realtimeService = service.getRealtimeService();
            realtimeService.stopStreaming();
          }
          break;

        case 'set_vad_mode':
          if (currentSessionId) {
            const service = await getCookingServiceV2();
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
            const service = await getCookingServiceV2();
            const realtimeService = service.getRealtimeService();
            realtimeService.sendTextMessage(data.text);
          }
          break;

        // NEW: Manual step navigation from frontend
        case 'next_step':
          if (currentSessionId) {
            const service = await getCookingServiceV2();
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
            const service = await getCookingServiceV2();
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
          console.log('[Server V2] Unknown message type:', data.type);
      }
    } catch (error: any) {
      console.error('[Server V2] Error processing message:', error);
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
    console.error('[Server V2] WebSocket error:', error);
  });
});

console.log('✅ WebSocket server ready (V2 with LangChain integration)');
