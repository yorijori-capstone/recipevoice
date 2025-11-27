/**
 * Realtime Service V3
 * V3 Architecture: MCP Tool Calling only
 */

import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { CookingAgentV3, CookingSession } from '../agents/cookingAgentV3.js';
import { MCPClientManager } from '../mcp/mcp-client.js';

interface RealtimeConfig {
  apiKey: string;
  cookingAgent: CookingAgentV3;
  mcpClient?: MCPClientManager;
  model?: string;
  voice?: string;
}

export class RealtimeServiceV3 extends EventEmitter {
  private ws: WebSocket | null = null;
  private apiKey: string;
  private model: string;
  private voice: string;
  private audioQueue: string[] = [];
  private isProcessing: boolean = false;
  private vadMode: 'server_vad' | 'none' = 'server_vad';

  // Integration with agents
  private cookingAgent: CookingAgentV3;
  private mcpClient: MCPClientManager | null = null;
  private currentSessionId: string | null = null;

  // 🆕 Timer state tracking
  private timerState: {
    isRunning: boolean;
    isCompleted: boolean;
    remainingTime: number;
    totalTime: number;
  } | null = null;

  constructor(config: RealtimeConfig) {
    super();
    this.apiKey = config.apiKey;
    this.model = config.model || 'gpt-realtime';
    this.voice = config.voice || 'alloy';
    this.cookingAgent = config.cookingAgent;
    this.mcpClient = config.mcpClient || null;

    console.log('[RealtimeServiceV3] Initialized with MCP Tool Calling');
  }

  // ==========================================================================
  // Session Management
  // ==========================================================================

  /**
   * Set active cooking session
   */
  setActiveSession(sessionId: string): void {
    this.currentSessionId = sessionId;
    this.timerState = null; // 🆕 Reset timer state on session change

    const session = this.cookingAgent.getSession(sessionId);

    if (session) {
      // Generate system prompt from cleaned recipe
      const systemPrompt = this.generateSystemPrompt(session);

      // Update session with new prompt
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.sendSessionUpdate(systemPrompt);
      }

      console.log(`[RealtimeServiceV3] Active session set: ${sessionId}`);
    }
  }

  /**
   * 🆕 Update timer state from frontend
   */
  public updateTimerState(state: {
    isRunning: boolean;
    isCompleted: boolean;
    remainingTime: number;
    totalTime: number;
  }): void {
    this.timerState = state;
    console.log(`[RealtimeServiceV3] ⏱️ Timer state updated:`, state);

    // Update AI context with new timer state
    if (this.currentSessionId && this.ws && this.ws.readyState === WebSocket.OPEN) {
      const session = this.cookingAgent.getSession(this.currentSessionId);
      if (session) {
        const updatedPrompt = this.generateSystemPrompt(session);
        this.sendSessionUpdate(updatedPrompt);
        console.log(`[RealtimeServiceV3] ✅ AI context updated with timer state`);
      }
    }
  }

  /**
   * Generate system prompt from cleaned recipe data
   * 🆕 Uses full planning_result with complete recipe context
   */
  private generateSystemPrompt(session: CookingSession): string {
    // 🆕 Get full planning_result for complete context
    const planningResult = session.planning_result;
    
    if (!planningResult) {
      console.warn('[RealtimeServiceV3] No planning_result in session, using fallback');
      // Fallback to basic info if planning_result is missing
      return this.generateFallbackPrompt(session);
    }

    // Extract full recipe information
    const meta = planningResult.meta || {};
    const ingredients = planningResult.ingredients || { main: [], sub: [] };
    const tools = planningResult.tools || [];
    const process = planningResult.process || session.process || [];
    
    // Current step information
    const currentProcessStep = process[session.currentStepIndex];
    
    if (!currentProcessStep) {
      console.warn(`[RealtimeServiceV3] No process step at index ${session.currentStepIndex}`);
      return this.generateFallbackPrompt(session);
    }

    // Timer info with real-time state from frontend
    const timerSeconds = currentProcessStep.timer_seconds;
    const timerRequired = timerSeconds !== null && timerSeconds > 0;
    
    let timerInfo: string;
    if (this.timerState) {
      if (this.timerState.isCompleted) {
        timerInfo = `⏱️ TIMER COMPLETED! (${this.timerState.totalTime}초 타이머가 종료됨)`;
      } else if (this.timerState.isRunning) {
        timerInfo = `⏱️ TIMER RUNNING: ${this.timerState.remainingTime}초 남음 (총 ${this.timerState.totalTime}초)`;
      } else {
        timerInfo = timerRequired
          ? `⏱️ TIMER REQUIRED: ${timerSeconds}초 (아직 시작 안 함)`
          : '타이머 불필요';
      }
    } else {
      timerInfo = timerRequired
        ? `⏱️ TIMER REQUIRED: ${timerSeconds}초 (${Math.floor(timerSeconds / 60)}분 ${timerSeconds % 60}초)`
        : '타이머 불필요';
    }

    // 🆕 재료 목록 생성 (main/sub 구분)
    const mainIngredients = ingredients.main?.map(ing => 
      `${ing.name} ${ing.amount}${ing.unit}${ing.notes ? ` (${ing.notes})` : ''}`
    ).join(', ') || '없음';
    
    const subIngredients = ingredients.sub?.map(ing => 
      `${ing.name} ${ing.amount}${ing.unit}${ing.usage ? ` (${ing.usage})` : ''}`
    ).join(', ') || '없음';

    // 🆕 전체 process 배열을 구조화된 형식으로 생성
    const allStepsText = process.map((step, idx) => {
      const isCurrent = idx === session.currentStepIndex;
      const marker = isCurrent ? '👉' : '  ';
      return `${marker} Step ${step.step_index}: [${step.phase}] ${step.action_type}
     ${step.description}
     ${step.ingredients_needed?.length > 0 ? `재료: ${step.ingredients_needed.join(', ')}` : ''}
     ${step.tools_needed?.length > 0 ? `도구: ${step.tools_needed.join(', ')}` : ''}
     ${step.heat_level ? `불 조절: ${step.heat_level}` : ''}
     ${step.timer_seconds ? `시간: ${step.timer_seconds}초` : ''}
     ${step.tip ? `팁: ${step.tip}` : ''}`;
    }).join('\n\n');

    // 🆕 첫 대화 여부 판단
    const isFirstStep = session.currentStepIndex === 0;

    return `You are a friendly Korean cooking assistant helping users cook "${meta.title || session.title}".

═══════════════════════════════════════════════════════════════
📋 COMPLETE RECIPE INFORMATION (전체 레시피 정보)
═══════════════════════════════════════════════════════════════

요리명: ${meta.title || session.title}
설명: ${meta.description || '맛있는 요리입니다'}
인분: ${meta.servings || 'N/A'}인분
조리 시간: ${meta.time_estimate || 'N/A'}분
난이도: ${meta.difficulty || 'Medium'}

주재료:
${mainIngredients}

양념 및 부재료:
${subIngredients}

필요한 도구:
${tools.length > 0 ? tools.join(', ') : '없음'}

═══════════════════════════════════════════════════════════════
📝 ALL COOKING STEPS (전체 조리 과정)
═══════════════════════════════════════════════════════════════

${allStepsText}

═══════════════════════════════════════════════════════════════
📍 CURRENT STEP (현재 단계)
═══════════════════════════════════════════════════════════════

Step ${session.currentStepIndex + 1} of ${session.totalSteps}
Phase: ${currentProcessStep.phase}
Action Type: ${currentProcessStep.action_type}
Description: ${currentProcessStep.description}
Heat Level: ${currentProcessStep.heat_level || 'N/A'}
Timer: ${timerInfo}
Ingredients Needed: ${currentProcessStep.ingredients_needed?.join(', ') || '없음'}
Tools Needed: ${currentProcessStep.tools_needed?.join(', ') || '없음'}
${currentProcessStep.tip ? `Tip: ${currentProcessStep.tip}` : ''}

═══════════════════════════════════════════════════════════════
🎯 YOUR ROLE
═══════════════════════════════════════════════════════════════

1. Guide users through cooking steps using the step descriptions above
2. Answer questions about ANY step (current, previous, or next) using the complete recipe information
3. Execute commands (next, previous, timer, etc.) through function calling
4. Keep responses concise and natural
5. **ALWAYS respond in Korean ONLY** - 절대 한국어로만 대답하세요

${isFirstStep ? `🎯 FIRST CONVERSATION FLOW (첫 대화 흐름 - 3단계로 진행):

📌 STEP A - 인사 대기:
사용자가 "안녕", "하이", "헬로" 같은 인사를 하기 전까지:
- 일반 질문("누구세요?", "뭐해?") → 간단히 자기소개만: "안녕하세요! 저는 요리 도우미입니다. '안녕'이라고 인사해주시면 오늘의 요리를 소개해드릴게요!"
- 레시피 관련 질문("다음", "시작", "첫번째 단계") → "먼저 '안녕'이라고 인사해주시면 요리를 시작할게요! 😊"
- ❌ 절대로 요리 제목, 재료, 단계를 먼저 말하지 마세요!

📌 STEP B - 인사 받음 → 레시피 소개:
사용자가 "안녕" 하면:
1. "안녕하세요! 오늘은 ${meta.title || session.title}을(를) 만들어 볼게요!"
2. "필요한 재료는 주재료: ${mainIngredients}, 양념 및 부재료: ${subIngredients} 입니다."
3. "재료가 준비되셨으면 '시작'이라고 말씀해주세요!"
- ❌ 아직 첫 번째 단계를 설명하지 마세요! "시작"을 기다리세요.

📌 STEP C - 시작 확인 → 요리 시작:
사용자가 "시작", "네", "응", "준비됐어", "좋아" 하면:
- 드디어 첫 번째 단계를 안내하세요!
` : ''}

IMPORTANT INSTRUCTIONS:
- Use the step descriptions from the recipe process above
- Do NOT make up cooking instructions - only use information from the recipe
- You have access to ALL steps, so you can answer questions like:
  * "다음 단계는 뭐야?" → Check the next step in the process array
  * "전체 재료는 뭐야?" → Use the complete ingredients list (main + sub)
  * "몇 단계 있어?" → Use totalSteps
  * "X단계는 뭐야?" → Find that step in the process array
- For step navigation, use the appropriate functions (navigate_next_step, navigate_previous_step, navigate_to_step)
- **TIMER INSTRUCTIONS**:
  - If timer_seconds is set for current step, PROACTIVELY call start_timer when user starts this step
  - When user says "타이머 시작", "타이머 켜줘", etc., call start_timer function
  - When user says "타이머 멈춰", "타이머 정지", etc., call stop_timer function
- Stay focused on the current cooking step, but use full recipe context for better answers
- **Only process Korean language inputs** - 한국어 입력만 처리합니다`;
  }

  /**
   * Fallback prompt when planning_result is not available
   */
  private generateFallbackPrompt(session: CookingSession): string {
    const currentProcessStep = session.process[session.currentStepIndex];
    const ingredientsList = session.ingredients && session.ingredients.length > 0
      ? session.ingredients.map(ing => `${ing.name} ${ing.quantity}`).join(', ')
      : '재료 정보 없음';

    return `You are a friendly Korean cooking assistant helping users cook "${session.title}".

RECIPE INFO:
- 요리명: ${session.title}
- 재료: ${ingredientsList}
- 총 단계: ${session.totalSteps}단계

CURRENT STATE:
- Step ${session.currentStepIndex + 1} of ${session.totalSteps}
- Current instruction: ${currentProcessStep?.description || 'Getting started'}

YOUR ROLE:
1. Guide users through cooking steps
2. Answer questions about the current step
3. Execute commands through function calling
4. **ALWAYS respond in Korean ONLY**

IMPORTANT:
- Use the provided step descriptions
- Do NOT make up cooking instructions
- For step navigation, use navigate_next_step, navigate_previous_step functions
- **Only process Korean language inputs**`;
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
        console.log('✅ Connected to OpenAI Realtime API (V3)');
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

  private async sendSessionUpdate(customPrompt?: string): Promise<void> {
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

    // 🆕 Phase 3: Get MCP tools if available
    let tools: any[] = [];
    let toolChoice: string | { type: string } = 'auto';

    if (this.mcpClient && session) {
      try {
        const mcpTools = await this.mcpClient.getToolDefinitions();
        tools = mcpTools.map((tool) => ({
          type: 'function',
          name: tool.name,
          description: tool.description,
          parameters: tool.inputSchema,
        }));
        toolChoice = 'auto'; // Let GPT decide when to use tools
        console.log(`[RealtimeServiceV3] Loaded ${tools.length} MCP tools`);
      } catch (error) {
        console.error('[RealtimeServiceV3] Failed to load MCP tools:', error);
        tools = [];
        toolChoice = 'none';
      }
    } else {
      // No MCP client or no session - disable tools
      toolChoice = 'none';
    }

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
          language: 'ko',  // 🆕 Phase 1: Korean-only STT
        },
        turn_detection: turnDetection,
        tools,  // 🆕 Phase 3: MCP tools
        tool_choice: toolChoice,  // 🆕 Phase 3: Enable tool calling
      },
    };

    this.sendToOpenAI(sessionUpdate);
    console.log(
      `📤 Session updated (VAD: ${this.vadMode}, Tools: ${tools.length}, MCP: ${this.mcpClient ? 'enabled' : 'disabled'})`
    );
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

    console.log(`💬 [RealtimeServiceV3] Sending text message: ${text}`);

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

        // 🆕 Phase 1: Filter non-Korean transcriptions
        if (!this.isKoreanText(event.transcript)) {
          console.warn(`⚠️ [Korean Filter] Rejected non-Korean input: "${event.transcript}"`);
          this.emit('user_transcription', {
            transcript: event.transcript,
            item_id: event.item_id,
            rejected: true,
            reason: 'non_korean',
          });
          // Skip processing for non-Korean inputs
          break;
        }

        this.emit('user_transcription', {
          transcript: event.transcript,
          item_id: event.item_id,
          rejected: false,
        });

        // 🆕 Phase 4: LangChain removed - GPT-4o-realtime handles tool calling directly
        // User transcript is sent to GPT, which decides if tool call is needed
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

      // 🆕 Phase 3: MCP Tool Calling
      case 'response.function_call_arguments.done':
        console.log('🔧 Tool call:', event.name);
        await this.handleToolCall(event);
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

  // 🆕 Phase 4: processUserTranscript removed - MCP Tool Calling handles everything

  /**
   * 🆕 Phase 3: Handle tool call from Realtime API
   */
  private async handleToolCall(event: any): Promise<void> {
    if (!this.currentSessionId || !this.mcpClient) {
      console.warn('[RealtimeServiceV3] No active session or MCP client for tool call');
      return;
    }

    try {
      const toolName = event.name;
      const args = JSON.parse(event.arguments);

      // Override session_id with current session (AI may send placeholder)
      const toolArgs = {
        ...args,
        session_id: this.currentSessionId, // Always use actual session ID
      };

      console.log(`[RealtimeServiceV3] Executing tool: ${toolName}`, toolArgs);

      // Execute tool via MCP Client
      const result = await this.mcpClient.executeTool(toolName, toolArgs);

      console.log(`[RealtimeServiceV3] Tool result:`, result);

      // Send tool result back to Realtime API
      const toolResponse = {
        type: 'conversation.item.create',
        item: {
          type: 'function_call_output',
          call_id: event.call_id,
          output: JSON.stringify(result),
        },
      };

      this.sendToOpenAI(toolResponse);

      // Request new response from GPT
      const createResponse = {
        type: 'response.create',
      };

      this.sendToOpenAI(createResponse);

      // 🆕 Emit tool execution event for WebSocket broadcast
      this.emit('tool_executed', {
        sessionId: this.currentSessionId,
        toolName,
        args,
        result,
      });

      // Update session prompt if step changed (navigation tools)
      if (result.success && toolName.startsWith('navigate_')) {
        // Tool changed step in DB, but in-memory session is stale
        // Need to update in-memory session from tool result
        const session = this.cookingAgent.getSession(this.currentSessionId);
        if (session && result.current_step_index !== undefined) {
          session.currentStepIndex = result.current_step_index;
          session.viewingStepIndex = result.current_step_index;

          // 🆕 Reset timer state on step change
          this.timerState = null;

          // 🆕 Emit timer reset event for frontend synchronization
          this.emit('timer_reset', {
            sessionId: this.currentSessionId,
            stepIndex: result.current_step_index,
            reason: 'step_changed'
          });

          const updatedPrompt = this.generateSystemPrompt(session);
          await this.sendSessionUpdate(updatedPrompt);
        }
      }
    } catch (error: any) {
      console.error('[RealtimeServiceV3] Tool execution error:', error);

      // Send error back to Realtime API
      const errorResponse = {
        type: 'conversation.item.create',
        item: {
          type: 'function_call_output',
          call_id: event.call_id,
          output: JSON.stringify({
            success: false,
            error: error.message,
          }),
        },
      };

      this.sendToOpenAI(errorResponse);

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

  /**
   * 🆕 Phase 1: Check if text is predominantly Korean (80% threshold)
   */
  private isKoreanText(text: string): boolean {
    if (!text || text.trim().length === 0) {
      return false;
    }

    // Remove whitespace for accurate counting
    const textWithoutSpaces = text.replace(/\s/g, '');
    if (textWithoutSpaces.length === 0) {
      return false;
    }

    // Count Korean characters (Hangul syllables: 가-힣, Jamo: ㄱ-ㅎ, ㅏ-ㅣ)
    const koreanChars = textWithoutSpaces.match(/[가-힣ㄱ-ㅎㅏ-ㅣ]/g);
    const koreanCount = koreanChars ? koreanChars.length : 0;

    const ratio = koreanCount / textWithoutSpaces.length;

    console.log(
      `[Korean Check] Text: "${text}" | Korean: ${koreanCount}/${textWithoutSpaces.length} (${(
        ratio * 100
      ).toFixed(1)}%)`
    );

    return ratio >= 0.8; // 80% threshold
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
