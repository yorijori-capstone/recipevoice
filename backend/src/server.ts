import express from 'express';
import { WebSocketServer } from 'ws';
import dotenv from 'dotenv';
import cors from 'cors';
import { RealtimeService } from './services/realtimeService.js';
import { getCookingService } from './services/cookingService.js';
import recipeRoutes from './routes/recipes.js';
import cookingRoutes from './routes/cooking.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// 헬스 체크
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend is running!' });
});

// 레시피 API 라우트
app.use('/api/recipes', recipeRoutes);

// 요리 모드 API 라우트
app.use('/api/cooking', cookingRoutes);

const PORT = process.env.PORT || 3001;
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

// WebSocket 서버 (음성 기능)
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  console.log('👤 Client connected to WebSocket');

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    ws.send(JSON.stringify({
      type: 'error',
      error: 'OpenAI API key not configured'
    }));
    ws.close();
    return;
  }

  let realtimeService: RealtimeService | null = null;
  let currentSessionId: string | null = null;

  // Helper function to setup event handlers
  const setupEventHandlers = (service: RealtimeService) => {
    service.on('user_transcription', (data: any) => {
      ws.send(JSON.stringify({
        type: 'user_transcription',
        transcript: data.transcript
      }));
    });

    service.on('assistant_transcript_delta', (data: any) => {
      ws.send(JSON.stringify({
        type: 'assistant_transcript_delta',
        delta: data.delta
      }));
    });

    service.on('assistant_transcript_done', (data: any) => {
      ws.send(JSON.stringify({
        type: 'assistant_transcript_done',
        transcript: data.transcript
      }));
    });

    service.on('audio_delta', (chunk: string) => {
      ws.send(JSON.stringify({
        type: 'audio_delta',
        audio: chunk
      }));
    });

    service.on('function_call', (data: any) => {
      console.log(`🔧 [Server] Function call received: ${data.name}`);
      ws.send(JSON.stringify({
        type: 'function_call',
        name: data.name,
        call_id: data.call_id,
        arguments: data.arguments
      }));
    });

    service.on('error', (error: any) => {
      ws.send(JSON.stringify({
        type: 'error',
        error: error.message || 'Unknown error'
      }));
    });
  };

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message.toString());

      switch (data.type) {
        case 'init_session':
          // Frontend에서 sessionId를 보내면 해당 세션의 컨텍스트로 초기화
          if (data.sessionId) {
            console.log(`🔧 Initializing session: ${data.sessionId}`);
            currentSessionId = data.sessionId;

            try {
              // CookingService에서 세션 정보 가져오기
              const cookingService = getCookingService(apiKey);
              const session = cookingService.getSession(data.sessionId);

              if (!session) {
                ws.send(JSON.stringify({
                  type: 'error',
                  error: 'Session not found'
                }));
                return;
              }

              // Planning 결과를 System Instructions에 주입
              const recipeTitle = session.planResult?.title || session.recipe?.title || '요리';
              const ingredients = session.recipe?.ingredients || [];
              const tools = session.recipe?.tools || [];

              const systemPrompt = `당신은 친절한 한국어 요리 도우미입니다.

🍳 **현재 요리 중인 레시피: ${recipeTitle}**

**재료:**
${ingredients.length > 0 ? ingredients.map((ing: any) => `- ${ing.name || ing}: ${ing.quantity || ''}`).join('\n') : '재료 정보 없음'}

**조리 도구:**
${tools.length > 0 ? tools.map((tool: any) => `- ${tool}`).join('\n') : '도구 정보 없음'}

**중요 규칙:**
1. 오직 현재 레시피("${recipeTitle}")에 대해서만 대화하세요.
2. 레시피와 무관한 질문(날씨, 뉴스, 잡담 등)은 정중히 거절하세요.
3. 사용자가 레시피 외 질문을 하면: "죄송하지만 저는 요리 가이드만 도와드릴 수 있습니다. ${recipeTitle} 요리에 대해 질문해주세요!"
4. 사용자가 재료나 도구에 대해 물어보면 위의 재료와 조리 도구 정보를 참고하여 친절히 알려주세요.

**현재 단계: ${session.currentStepIndex + 1}/${session.plannedSteps.length}**

**전체 레시피 정보:**
${JSON.stringify(session.plannedSteps, null, 2)}

**현재 진행 중인 단계:**
${JSON.stringify(session.plannedSteps[session.currentStepIndex], null, 2)}

**음성 명령어 처리:**
- "다음 단계" → 다음 단계로 이동 안내
- "다시" → retry_script 사용
- "뭐라고?" → fallback_script 사용
- "멈춰" → pause_hint 사용
- "계속" → 현재 단계 script 계속

자연스럽고 친근한 한국어로 대화하세요.`;

              // Realtime Service 초기화
              realtimeService = new RealtimeService({
                apiKey,
                systemPrompt
              });

              setupEventHandlers(realtimeService);

              await realtimeService.connect();

              console.log(`✅ Realtime service initialized for session: ${data.sessionId}`);
              ws.send(JSON.stringify({
                type: 'session_initialized',
                sessionId: data.sessionId
              }));

            } catch (error: any) {
              console.error('❌ Failed to initialize session:', error);
              ws.send(JSON.stringify({
                type: 'error',
                error: `Failed to initialize session: ${error.message}`
              }));
            }
          }
          break;

        case 'audio':
          if (realtimeService) {
            realtimeService.sendAudio(data.audio);
          }
          break;

        case 'start_streaming':
          if (realtimeService) {
            realtimeService.startStreaming();
          }
          break;

        case 'stop_streaming':
          if (realtimeService) {
            realtimeService.stopStreaming();
          }
          break;

        case 'set_vad_mode':
          if (realtimeService) {
            console.log(`🎤 Received VAD mode change request: ${data.mode}`);
            // data.mode is already 'server_vad' or 'none'
            const actualMode = data.mode === 'server_vad' ? 'auto' : 'manual';
            realtimeService.setVADMode(actualMode);
            ws.send(JSON.stringify({
              type: 'vad_mode_changed',
              mode: data.mode
            }));
            console.log(`✅ VAD mode changed to: ${data.mode} (internal: ${actualMode})`);
          }
          break;

        case 'send_text':
          if (realtimeService && data.text) {
            console.log(`💬 Received text message to speak: ${data.text}`);
            realtimeService.sendTextMessage(data.text);
          }
          break;

        default:
          console.log('Unknown message type:', data.type);
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });

  ws.on('close', (code, reason) => {
    console.log(`👋 Client disconnected (code: ${code}, reason: ${reason || 'none'})`);
    if (realtimeService) {
      console.log('🔌 Disconnecting RealtimeService due to client disconnect');
      realtimeService.disconnect();
    }
  });

  ws.on('error', (error: Error) => {
    console.error('WebSocket error:', error);
  });
});
