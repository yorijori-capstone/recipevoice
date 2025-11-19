import express from 'express';
import { WebSocketServer } from 'ws';
import dotenv from 'dotenv';
import cors from 'cors';
import { RealtimeService } from './services/realtimeService.js';
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
  console.log('👤 Client connected');

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    ws.send(JSON.stringify({ 
      type: 'error', 
      data: { message: 'OpenAI API key not configured' } 
    }));
    ws.close();
    return;
  }

  const realtimeService = new RealtimeService({
    apiKey,
    systemPrompt: 'You are a helpful cooking assistant. Respond in Korean.'
  });

  realtimeService.connect()
    .then(() => {
      console.log('✅ Realtime service connected');
      ws.send(JSON.stringify({ 
        type: 'status', 
        data: { message: 'GPT Realtime connected' } 
      }));
    })
    .catch((error) => {
      console.error('❌ Failed to connect to GPT Realtime:', error);
      ws.send(JSON.stringify({ 
        type: 'error', 
        data: { message: 'Failed to connect to GPT Realtime' } 
      }));
    });

  // 이벤트 핸들러
  realtimeService.on('user_transcription', (data: any) => {
    ws.send(JSON.stringify({
      type: 'user_transcription',
      transcript: data.transcript
    }));
  });

  realtimeService.on('assistant_transcript_delta', (data: any) => {
    ws.send(JSON.stringify({
      type: 'assistant_transcript_delta',
      delta: data.delta
    }));
  });

  realtimeService.on('assistant_transcript_done', (data: any) => {
    ws.send(JSON.stringify({
      type: 'assistant_transcript_done',
      transcript: data.transcript
    }));
  });

  realtimeService.on('audio_delta', (chunk: string) => {
    ws.send(JSON.stringify({
      type: 'audio_delta',
      audio: chunk
    }));
  });

  realtimeService.on('error', (error: any) => {
    ws.send(JSON.stringify({
      type: 'error',
      error: error.message || 'Unknown error'
    }));
  });

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message.toString());

      switch (data.type) {
        case 'audio':
          realtimeService.sendAudio(data.audio);
          break;

        case 'start_streaming':
          realtimeService.startStreaming();
          break;

        case 'stop_streaming':
          realtimeService.stopStreaming();
          break;

        // 🆕 VAD 모드 변경
        case 'set_vad_mode':
          realtimeService.setVADMode(data.mode);
          ws.send(JSON.stringify({
            type: 'vad_mode_changed',
            mode: data.mode
          }));
          console.log(`🎤 VAD mode changed to: ${data.mode}`);
          break;

        default:
          console.log('Unknown message type:', data.type);
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });

  ws.on('close', () => {
    console.log('👋 Client disconnected');
    realtimeService.disconnect();
  });

  ws.on('error', (error: Error) => {
    console.error('WebSocket error:', error);
  });
});