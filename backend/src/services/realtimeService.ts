import WebSocket from 'ws';
import { EventEmitter } from 'events';

interface RealtimeConfig {
  apiKey: string;
  model?: string;
  voice?: string;
  systemPrompt?: string;
}

export class RealtimeService extends EventEmitter {
  private ws: WebSocket | null = null;
  private apiKey: string;
  private model: string;
  private voice: string;
  private systemPrompt: string;
  private audioQueue: string[] = [];
  private isProcessing: boolean = false;
  
  // 🆕 VAD 모드 추가
  private vadMode: 'server_vad' | 'none' = 'server_vad';

  constructor(config: RealtimeConfig) {
    super();
    this.apiKey = config.apiKey;
    this.model = config.model || 'gpt-4o-realtime-preview-2024-10-01';
    this.voice = config.voice || 'alloy';
    this.systemPrompt = config.systemPrompt || 'You are a helpful assistant. Respond in Korean.';
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = `wss://api.openai.com/v1/realtime?model=${this.model}`;
      
      this.ws = new WebSocket(url, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'OpenAI-Beta': 'realtime=v1'
        }
      });

      this.ws.on('open', () => {
        console.log('✅ Connected to OpenAI Realtime API');
        this.sendSessionUpdate();
        resolve();
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        try {
          const event = JSON.parse(data.toString());
          this.handleServerEvent(event);
        } catch (error) {
          console.error('Error parsing message:', error);
        }
      });

      this.ws.on('error', (error: Error) => {
        console.error('WebSocket error:', error);
        this.emit('error', error);
        reject(error);
      });

      this.ws.on('close', (code, reason) => {
        console.log(`🔌 Disconnected from OpenAI Realtime API (code: ${code}, reason: ${reason || 'none'})`);
        this.emit('close');
      });
    });
  }

  // 🆕 VAD 모드 설정 메서드
  public setVADMode(mode: 'auto' | 'manual'): void {
    const newVadMode = mode === 'auto' ? 'server_vad' : 'none';
    
    if (this.vadMode !== newVadMode) {
      this.vadMode = newVadMode;
      console.log(`🎤 VAD mode changed to: ${this.vadMode}`);
      
      // 세션 업데이트 전송
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.sendSessionUpdate();
      }
    }
  }

  private sendSessionUpdate(): void {
    // 🔧 VAD 모드에 따라 turn_detection 설정
    const turnDetection = this.vadMode === 'server_vad' ? {
      type: 'server_vad',
      threshold: 0.5,
      prefix_padding_ms: 300,
      silence_duration_ms: 700
    } : null;

    const sessionUpdate = {
      type: 'session.update',
      session: {
        modalities: ['text', 'audio'],
        instructions: this.systemPrompt,
        voice: this.voice,
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        input_audio_transcription: {
          model: 'whisper-1'
        },
        turn_detection: turnDetection,  // 🔧 동적으로 설정
        tools: [
          {
            type: 'function',
            name: 'start_timer',
            description: '요리 단계의 타이머를 시작합니다. 사용자에게 타이머를 시작한다고 말할 때 이 함수를 호출하세요.',
            parameters: {
              type: 'object',
              properties: {},
              required: []
            }
          },
          {
            type: 'function',
            name: 'stop_timer',
            description: '실행 중인 타이머를 정지합니다.',
            parameters: {
              type: 'object',
              properties: {},
              required: []
            }
          }
        ],
        tool_choice: 'auto'
      }
    };

    this.sendToOpenAI(sessionUpdate);
    console.log(`📤 Session updated with VAD mode: ${this.vadMode} + Function Calling`);
  }

  public sendAudio(audioData: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('⚠️ WebSocket not ready');
      return;
    }

    const audioAppend = {
      type: 'input_audio_buffer.append',
      audio: audioData
    };

    this.sendToOpenAI(audioAppend);
  }

  /**
   * Send text message to OpenAI Realtime API for TTS
   */
  public sendTextMessage(text: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('⚠️ WebSocket not ready');
      return;
    }

    console.log(`💬 [RealtimeService] Sending text message: ${text}`);

    // Create conversation item with text
    const createItem = {
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: text
          }
        ]
      }
    };

    this.sendToOpenAI(createItem);

    // Request response generation
    const createResponse = {
      type: 'response.create',
      response: {
        modalities: ['audio', 'text']
      }
    };

    this.sendToOpenAI(createResponse);
    console.log('📤 Requested TTS response generation');
  }

  // 🆕 수동 모드에서 오디오 처리 명령
  // commitAudio 메서드 수정
  public commitAudio(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('⚠️ WebSocket not ready');
      return;
    }

    // 수동 모드에서는 명시적으로 commit 필요
    if (this.vadMode === 'none') {
      try {
        const commit = {
          type: 'input_audio_buffer.commit'
        };
        
        this.sendToOpenAI(commit);
        console.log('📤 Audio buffer committed (manual mode)');
        
        // 응답 생성 요청
        const createResponse = {
          type: 'response.create'
        };
        
        this.sendToOpenAI(createResponse);
        console.log('📤 Response creation requested');
      } catch (error) {
        console.error('❌ Error committing audio:', error);
      }
    }
  }


  // 🆕 오디오 버퍼 클리어
  public clearAudioBuffer(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const clear = {
      type: 'input_audio_buffer.clear'
    };

    this.sendToOpenAI(clear);
    console.log('🗑️ Audio buffer cleared');
  }

  public startStreaming(): void {
    console.log('🎙️ Streaming started');
    this.audioQueue = [];
    this.isProcessing = false;
    this.emit('streaming_started');
  }

  public stopStreaming(): void {
    console.log('⏸️ Streaming stopped');

    // 🆕 수동 모드일 때만 commit 실행
    if (this.vadMode === 'none') {
      // 100ms 대기 후 commit (버퍼에 데이터가 있을 때만)
      setTimeout(() => {
        this.commitAudio();
      }, 100);
    }

    this.emit('streaming_stopped');
  }

  private handleServerEvent(event: any): void {
    switch (event.type) {
      case 'session.created':
        console.log('✅ Session created');
        this.emit('session_created', event);
        break;

      case 'session.updated':
        console.log('✅ Session updated');
        this.emit('session_updated', event);
        break;

      case 'input_audio_buffer.speech_started':
        console.log('🎤 Speech started');
        this.emit('speech_started', event);
        break;

      case 'input_audio_buffer.speech_stopped':
        console.log('🔇 Speech stopped');
        this.emit('speech_stopped', event);
        break;

      case 'input_audio_buffer.committed':
        console.log('✅ Audio buffer committed');
        this.emit('audio_committed', event);
        break;

      case 'conversation.item.input_audio_transcription.completed':
        console.log('👤 [USER]:', event.transcript);
        this.emit('user_transcription', {
          transcript: event.transcript,
          item_id: event.item_id
        });
        break;

      case 'response.audio_transcript.delta':
        this.emit('assistant_transcript_delta', {
          delta: event.delta,
          item_id: event.item_id
        });
        break;

      case 'response.audio.delta':
        if (event.delta) {
          this.audioQueue.push(event.delta);
          if (!this.isProcessing) {
            this.processAudioQueue();
          }
        }
        break;

      case 'response.audio_transcript.done':
        console.log('🤖 [AI]:', event.transcript);
        this.emit('assistant_transcript_done', {
          transcript: event.transcript,
          item_id: event.item_id
        });
        break;

      case 'response.done':
        console.log('✅ Response completed');
        this.emit('response_done', event);
        break;

      case 'response.function_call_arguments.done':
        console.log('🔧 Function call:', event.name);
        this.handleFunctionCall(event);
        break;

      case 'error':
        console.error('❌ Error from server:', event.error);
        this.emit('error', event.error);
        break;

      default:
        // console.log('Unknown event:', event.type);
        break;
    }
  }

  private handleFunctionCall(event: any): void {
    const functionName = event.name;
    const callId = event.call_id;

    console.log(`🔧 [Function Call] ${functionName} (call_id: ${callId})`);

    // Emit function call event to be handled by server
    this.emit('function_call', {
      name: functionName,
      call_id: callId,
      arguments: event.arguments
    });

    // Send function call output back to OpenAI
    const functionOutput = {
      type: 'conversation.item.create',
      item: {
        type: 'function_call_output',
        call_id: callId,
        output: JSON.stringify({ success: true })
      }
    };

    this.sendToOpenAI(functionOutput);

    // Request response generation
    const createResponse = {
      type: 'response.create'
    };

    this.sendToOpenAI(createResponse);
    console.log(`✅ Function call ${functionName} handled`);
  }

  private async processAudioQueue(): Promise<void> {
    if (this.audioQueue.length === 0) {
      this.isProcessing = false;
      return;
    }

    this.isProcessing = true;
    const chunk = this.audioQueue.shift();

    if (chunk) {
      this.emit('audio_delta', chunk);
    }

    setTimeout(() => this.processAudioQueue(), 10);
  }

  private sendToOpenAI(data: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  public disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  public isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}