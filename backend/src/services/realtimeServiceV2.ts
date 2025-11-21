/**
 * Realtime Service V2
 * Integrates with LangChain Agent and uses Cleaned Recipes
 */

import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { CookingAgentV2, CookingSession } from '../agents/cookingAgentV2.js';
import { LangChainAgent } from '../agents/langchainAgent.js';

interface RealtimeConfig {
  apiKey: string;
  cookingAgent: CookingAgentV2;
  langChainAgent: LangChainAgent;
  model?: string;
  voice?: string;
}

export class RealtimeServiceV2 extends EventEmitter {
  private ws: WebSocket | null = null;
  private apiKey: string;
  private model: string;
  private voice: string;
  private audioQueue: string[] = [];
  private isProcessing: boolean = false;
  private vadMode: 'server_vad' | 'none' = 'server_vad';

  // Integration with agents
  private cookingAgent: CookingAgentV2;
  private langChainAgent: LangChainAgent;
  private currentSessionId: string | null = null;
  private conversationHistory: Array<{ role: string; content: string }> = [];

  constructor(config: RealtimeConfig) {
    super();
    this.apiKey = config.apiKey;
    this.model = config.model || 'gpt-4o-realtime-preview-2024-10-01';
    this.voice = config.voice || 'alloy';
    this.cookingAgent = config.cookingAgent;
    this.langChainAgent = config.langChainAgent;

    console.log('[RealtimeServiceV2] Initialized with LangChain integration');
  }

  // ==========================================================================
  // Session Management
  // ==========================================================================

  /**
   * Set active cooking session
   */
  setActiveSession(sessionId: string): void {
    this.currentSessionId = sessionId;
    this.conversationHistory = [];

    const session = this.cookingAgent.getSession(sessionId);

    if (session) {
      // Generate system prompt from cleaned recipe
      const systemPrompt = this.generateSystemPrompt(session);

      // Update session with new prompt
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.sendSessionUpdate(systemPrompt);
      }

      console.log(`[RealtimeServiceV2] Active session set: ${sessionId}`);
    }
  }

  /**
   * Generate system prompt from cleaned recipe data
   */
  private generateSystemPrompt(session: CookingSession): string {
    const currentStep = session.plannedSteps[session.currentStepIndex];

    return `You are a friendly Korean cooking assistant helping users cook "${session.title}".

CURRENT STATE:
- Step ${session.currentStepIndex + 1} of ${session.totalSteps}
- Current instruction: ${currentStep?.script || 'Getting started'}

YOUR ROLE:
1. Guide users through cooking steps using the planned scripts
2. Answer questions about the current step
3. Execute commands (next, previous, timer, etc.) through function calling
4. Keep responses concise and natural
5. Always respond in Korean

IMPORTANT:
- Use the provided scripts from the recipe plan
- Do NOT make up cooking instructions
- For step navigation, use the appropriate functions
- For timer commands, use timer functions
- Stay focused on the current cooking step

Current Step Scripts:
- Main: ${currentStep?.script || 'N/A'}
- Retry: ${currentStep?.retry_script || 'N/A'}
- Pause Hint: ${currentStep?.pause_hint || 'N/A'}`;
  }

  // ==========================================================================
  // WebSocket Connection
  // ==========================================================================

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = `wss://api.openai.com/v1/realtime?model=${this.model}`;

      this.ws = new WebSocket(url, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'OpenAI-Beta': 'realtime=v1',
        },
      });

      this.ws.on('open', () => {
        console.log('✅ Connected to OpenAI Realtime API (V2)');
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
        console.log(
          `🔌 Disconnected from OpenAI Realtime API (code: ${code}, reason: ${reason || 'none'})`
        );
        this.emit('close');
      });
    });
  }

  // ==========================================================================
  // Session Configuration
  // ==========================================================================

  public setVADMode(mode: 'auto' | 'manual'): void {
    const newVadMode = mode === 'auto' ? 'server_vad' : 'none';

    if (this.vadMode !== newVadMode) {
      this.vadMode = newVadMode;
      console.log(`🎤 VAD mode changed to: ${this.vadMode}`);

      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.sendSessionUpdate();
      }
    }
  }

  private sendSessionUpdate(customPrompt?: string): void {
    const session = this.currentSessionId
      ? this.cookingAgent.getSession(this.currentSessionId)
      : null;

    const systemPrompt =
      customPrompt ||
      (session
        ? this.generateSystemPrompt(session)
        : 'You are a helpful Korean cooking assistant.');

    const turnDetection =
      this.vadMode === 'server_vad'
        ? {
            type: 'server_vad',
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: 700,
          }
        : null;

    const sessionUpdate = {
      type: 'session.update',
      session: {
        modalities: ['text', 'audio'],
        instructions: systemPrompt,
        voice: this.voice,
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        input_audio_transcription: {
          model: 'whisper-1',
        },
        turn_detection: turnDetection,
        tools: [],  // No tools - LangChain handles all logic
        tool_choice: 'none',
      },
    };

    this.sendToOpenAI(sessionUpdate);
    console.log(`📤 Session updated (VAD: ${this.vadMode}, LangChain mode)`);
  }

  // ==========================================================================
  // Audio & Text Input
  // ==========================================================================

  public sendAudio(audioData: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('⚠️ WebSocket not ready');
      return;
    }

    const audioAppend = {
      type: 'input_audio_buffer.append',
      audio: audioData,
    };

    this.sendToOpenAI(audioAppend);
  }

  public sendTextMessage(text: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('⚠️ WebSocket not ready');
      return;
    }

    console.log(`💬 [RealtimeServiceV2] Sending text message: ${text}`);

    const createItem = {
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: text,
          },
        ],
      },
    };

    this.sendToOpenAI(createItem);

    const createResponse = {
      type: 'response.create',
      response: {
        modalities: ['audio', 'text'],
      },
    };

    this.sendToOpenAI(createResponse);
    console.log('📤 Requested TTS response generation');
  }

  public commitAudio(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('⚠️ WebSocket not ready');
      return;
    }

    if (this.vadMode === 'none') {
      try {
        const commit = {
          type: 'input_audio_buffer.commit',
        };

        this.sendToOpenAI(commit);
        console.log('📤 Audio buffer committed (manual mode)');

        const createResponse = {
          type: 'response.create',
        };

        this.sendToOpenAI(createResponse);
        console.log('📤 Response creation requested');
      } catch (error) {
        console.error('❌ Error committing audio:', error);
      }
    }
  }

  public clearAudioBuffer(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const clear = {
      type: 'input_audio_buffer.clear',
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

    if (this.vadMode === 'none') {
      setTimeout(() => {
        this.commitAudio();
      }, 100);
    }

    this.emit('streaming_stopped');
  }

  // ==========================================================================
  // Event Handling with LangChain Integration
  // ==========================================================================

  private async handleServerEvent(event: any): Promise<void> {
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
          item_id: event.item_id,
        });

        // 🆕 Process user input through LangChain
        await this.processUserTranscript(event.transcript);
        break;

      case 'response.audio_transcript.delta':
        this.emit('assistant_transcript_delta', {
          delta: event.delta,
          item_id: event.item_id,
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
          item_id: event.item_id,
        });
        break;

      case 'response.done':
        console.log('✅ Response completed');
        this.emit('response_done', event);
        break;

      case 'error':
        console.error('❌ Error from server:', event.error);
        this.emit('error', event.error);
        break;

      default:
        break;
    }
  }

  /**
   * 🆕 Process user transcript through LangChain Agent
   */
  private async processUserTranscript(transcript: string): Promise<void> {
    if (!this.currentSessionId) {
      console.warn('[RealtimeServiceV2] No active session');
      return;
    }

    try {
      // Add to conversation history
      this.conversationHistory.push({
        role: 'user',
        content: transcript,
      });

      // Process through LangChain pipeline
      const result = await this.langChainAgent.processUserInput(
        this.currentSessionId,
        transcript,
        this.conversationHistory
      );

      console.log(`[RealtimeServiceV2] LangChain result:`, result);

      // Add assistant response to history
      if (result.responseText) {
        this.conversationHistory.push({
          role: 'assistant',
          content: result.responseText,
        });

        // Send response to OpenAI for TTS
        // Note: We don't use sendTextMessage here because it would create
        // a duplicate conversation item. Instead, the OpenAI Realtime API
        // will generate its own response based on the conversation context.

        // Emit event for WebSocket clients
        this.emit('langchain_response', {
          sessionId: this.currentSessionId,
          result,
        });
      }

      // Update session prompt if step changed
      if (result.success && result.data?.step) {
        const session = this.cookingAgent.getSession(this.currentSessionId);
        if (session) {
          const updatedPrompt = this.generateSystemPrompt(session);
          this.sendSessionUpdate(updatedPrompt);
        }
      }
    } catch (error: any) {
      console.error('[RealtimeServiceV2] LangChain processing error:', error);
      this.emit('error', error);
    }
  }

  // ==========================================================================
  // Audio Queue Processing
  // ==========================================================================

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

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

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
