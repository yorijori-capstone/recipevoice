/**
 * Realtime Service V3
 * V3 Architecture: MCP Tool Calling only
 */

import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { CookingAgentV3, CookingSession } from '../agents/cookingAgentV3.js';
import { MCPClientManager } from '../mcp/mcp-client.js';

// ============================================================================
// Configuration Constants
// ============================================================================
const VAD_CONFIG = {
  THRESHOLD: 0.90,            // Voice activity detection sensitivity (0-1)
  PREFIX_PADDING_MS: 200,     // Audio buffer before speech starts (ms)
  SILENCE_DURATION_MS: 300,   // Silence duration to end turn (ms)
} as const;

const AUDIO_CONFIG = {
  SAMPLE_RATE: 24000,         // Audio sample rate (Hz)
  FORMAT: 'pcm16' as const,   // Audio format
} as const;

const RECONNECT_CONFIG = {
  MAX_ATTEMPTS: 5,            // Maximum reconnection attempts
  INITIAL_DELAY_MS: 1000,     // Initial reconnection delay (ms)
} as const;

interface RealtimeConfig {
  apiKey: string;
  session: CookingSession; // 🆕 Session specific
  cookingAgent: CookingAgentV3; // Keep for DB updates/logging if needed
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

  // 🆕 인터럽트 처리를 위한 응답 상태 추적
  private isResponding: boolean = false;
  private hasGeneratedText: boolean = false; // 🆕 텍스트 생성 여부 추적

  // 🆕 중복 로그 방지를 위한 필드
  private lastTranscriptItemId: string | null = null;

  // Integration with agents
  private cookingAgent: CookingAgentV3;
  private mcpClient: MCPClientManager | null = null;
  private session: CookingSession; // 🆕 Session instance

  // 🆕 Timer state tracking
  private timerState: {
    isRunning: boolean;
    isCompleted: boolean;
    remainingTime: number;
    totalTime: number;
  } | null = null;
  
  // 🆕 이전 타이머 상태 추적 (변경 감지용)
  private previousTimerState: {
    isRunning: boolean;
    isCompleted: boolean;
  } | null = null;

  // 🆕 System prompt caching (performance optimization)
  private staticPromptCache: string | null = null;
  private lastCachedPrompt: string | null = null;
  private lastDynamicKey: string = '';

  // 🆕 재연결 관련 필드
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = RECONNECT_CONFIG.MAX_ATTEMPTS;
  private reconnectDelay: number = RECONNECT_CONFIG.INITIAL_DELAY_MS;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private shouldReconnect: boolean = true; // 수동 disconnect 시 false로 설정

  constructor(config: RealtimeConfig) {
    super();
    this.apiKey = config.apiKey;
    this.model = config.model || 'gpt-realtime';
    this.voice = config.voice || 'alloy';
    this.cookingAgent = config.cookingAgent;
    this.mcpClient = config.mcpClient || null;
    this.session = config.session; // 🆕 Set session

    console.log(`[RealtimeServiceV3] Initialized for session: ${this.session.sessionId}`);
  }

  // ==========================================================================
  // Session Management
  // ==========================================================================

  // 🆕 setActiveSession removed - session is immutable for this instance

  /**
   * 🆕 Update timer state from frontend
   */
  public updateTimerState(state: {
    isRunning: boolean;
    isCompleted: boolean;
    remainingTime: number;
    totalTime: number;
  }): void {
    // 🆕 상태 변경 감지: 시작/중지/완료 시에만 세션 업데이트
    const stateChanged = 
      !this.previousTimerState || 
      this.previousTimerState.isRunning !== state.isRunning ||
      this.previousTimerState.isCompleted !== state.isCompleted;
    
    // 이전 상태 업데이트 (다음 비교를 위해)
    this.previousTimerState = {
      isRunning: state.isRunning,
      isCompleted: state.isCompleted,
    };
    
    this.timerState = state;
    console.log(`[RealtimeServiceV3] ⏱️ Timer state updated:`, state);

    // 🆕 상태가 실제로 변경된 경우에만 세션 업데이트 (시작/중지/완료 시)
    if (stateChanged && this.ws && this.ws.readyState === WebSocket.OPEN) {
      const session = this.session;
      if (session) {
        const updatedPrompt = this.generateSystemPrompt(session);
        this.sendSessionUpdate(updatedPrompt, false); // 🆕 Background update: do not reset VAD state
        console.log(`[RealtimeServiceV3] ✅ AI context updated with timer state change (isRunning: ${state.isRunning}, isCompleted: ${state.isCompleted})`);
      }
    } else if (!stateChanged) {
      // 상태 변경이 없으면 로그만 (remainingTime만 변경된 경우)
      console.log(`[RealtimeServiceV3] ⏱️ Timer state updated (no significant change, remainingTime: ${state.remainingTime})`);
    }
  }

  /**
   * Helper: Format timer info string
   */
  private formatTimerInfo(): string {
    if (!this.timerState) {
      return 'no_timer';
    }
    if (this.timerState.isCompleted) {
      return 'completed';
    }
    if (this.timerState.isRunning) {
      return `running_${this.timerState.remainingTime}`;
    }
    return 'idle';
  }

  /**
   * Generate system prompt from cleaned recipe data (with caching)
   * 🆕 Uses full planning_result with complete recipe context
   * 🚀 Performance: Caches static content, only regenerates when step/timer changes
   */
  private generateSystemPrompt(session: CookingSession): string {
    // Generate dynamic key based on things that change
    const dynamicKey = `${session.currentStepIndex}:${this.formatTimerInfo()}`;

    // Cache hit - return cached prompt
    if (dynamicKey === this.lastDynamicKey && this.lastCachedPrompt) {
      return this.lastCachedPrompt;
    }

    // Cache miss - regenerate prompt
    console.log(`[RealtimeServiceV3] 🔄 Regenerating system prompt (key changed: ${this.lastDynamicKey} → ${dynamicKey})`);
    const fullPrompt = this.generateSystemPromptInternal(session);

    // 🆕 Prompt 길이 모니터링 (성능 디버깅)
    const promptLength = fullPrompt.length;
    const estimatedTokens = Math.ceil(promptLength / 4); // 대략적인 토큰 수 추정
    if (promptLength > 10000) {
      console.warn(`[RealtimeServiceV3] ⚠️ Long system prompt detected: ${promptLength} chars (~${estimatedTokens} tokens). This may affect performance.`);
    } else {
      console.log(`[RealtimeServiceV3] ✅ System prompt generated: ${promptLength} chars (~${estimatedTokens} tokens)`);
    }

    // Update cache
    this.lastDynamicKey = dynamicKey;
    this.lastCachedPrompt = fullPrompt;

    return fullPrompt;
  }

  /**
   * Internal: actual prompt generation logic (called only on cache miss)
   */
  private generateSystemPromptInternal(session: CookingSession): string {
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

    // 🆕 최적화: 전체 단계는 간략하게, 현재 단계 주변만 상세하게
    // 🚀 성능 최적화: 단계가 많을수록 더 간략하게 표시하여 prompt 길이 제한
    const currentIdx = session.currentStepIndex;
    const contextWindow = process.length > 10 ? 0 : 1; // 단계가 10개 이상이면 현재 단계만, 10개 이하면 주변 1단계
    const startIdx = Math.max(0, currentIdx - contextWindow);
    const endIdx = Math.min(process.length, currentIdx + contextWindow + 1);
    
    const allStepsText = process.map((step, idx) => {
      const isCurrent = idx === currentIdx;
      const isNearby = idx >= startIdx && idx < endIdx;
      const marker = isCurrent ? '👉' : '  ';
      
      // 현재 단계 주변만 상세하게, 나머지는 간략하게
      if (isNearby) {
        return `${marker} Step ${step.step_index}: [${step.phase}] ${step.action_type}
     ${step.description}
     ${step.ingredients_needed?.length > 0 ? `재료: ${step.ingredients_needed.join(', ')}` : ''}
     ${step.tools_needed?.length > 0 ? `도구: ${step.tools_needed.join(', ')}` : ''}
     ${step.heat_level ? `불 조절: ${step.heat_level}` : ''}
     ${step.timer_seconds ? `시간: ${step.timer_seconds}초` : ''}
     ${step.tip ? `팁: ${step.tip}` : ''}`;
      } else {
        // 간략 버전: 단계 번호, 설명, 재료 정보 (도구/불/타이머 등은 생략하여 길이 절약)
        const ingredients = step.ingredients_needed?.length > 0 
          ? ` (재료: ${step.ingredients_needed.join(', ')})` 
          : '';
        return `${marker} Step ${step.step_index}: ${step.description}${ingredients}`;
      }
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
${timerRequired ? `⚠️ **IMPORTANT**: This step requires a timer. You MUST ask the user first: "타이머를 설정할까요?" or "타이머를 시작할까요?" before calling start_timer. Do NOT start the timer automatically.` : ''}
Ingredients Needed: ${currentProcessStep.ingredients_needed?.join(', ') || '없음'}
Tools Needed: ${currentProcessStep.tools_needed?.join(', ') || '없음'}
${currentProcessStep.tip ? `Tip: ${currentProcessStep.tip}` : ''}

═══════════════════════════════════════════════════════════════
🎯 YOUR ROLE
═══════════════════════════════════════════════════════════════

1. Guide users through cooking steps using the step descriptions above
2. Answer questions about ANY step (current, previous, or next) using the complete recipe information
   - For steps shown in detail: Use the detailed information provided (ingredients, tools, heat level, timer, etc.)
   - For steps shown briefly: Use the step description and ingredients_needed information to answer questions accurately
   - If specific step information is not available, refer to the complete ingredient list and recipe context
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
- **CRITICAL: After calling navigate_next_step, navigate_previous_step, or navigate_to_step, you MUST immediately provide guidance about the new step**
- When the user agrees to move to the next step (e.g., "넘어가", "다음으로", "좋아", "응"), and you call navigate_next_step:
  * After the function executes successfully, you MUST immediately explain the new step
  * Example: "좋아요, 다음 단계로 넘어갈게요. 이제 [새 단계 설명]을 해주세요."
  * Do NOT remain silent after step navigation - always provide guidance about the new step
- This applies to ALL step navigation scenarios, whether the user explicitly requests it or agrees to your suggestion
- **TIMER INSTRUCTIONS (중요!)**:
  - ⚠️ **절대로 타이머를 자동으로 시작하지 마세요!** 항상 사용자에게 먼저 물어보세요.
  - 타이머가 필요한 단계(TIMER REQUIRED 표시)에서는 **반드시 먼저 사용자에게 확인**하세요:
    * 예) "이 단계는 ${timerSeconds ? `${Math.floor(timerSeconds / 60)}분` : '타이머'}가 필요해요. 타이머를 설정할까요?"
    * 예) "2분 타이머가 필요합니다. 타이머를 시작할까요?"
    * ❌ 절대로 "타이머를 시작할게요"라고 말하지 마세요! 항상 "설정할까요?" 또는 "시작할까요?"라고 물어보세요.
  
  - **🛑 CRITICAL: 사용자 거절 시 절대로 타이머를 시작하지 마세요!**
    * 사용자가 다음 중 **하나라도** 말하면 **절대로 start_timer 함수를 호출하지 마세요**:
      - "아니", "아니요", "안 해", "하지 마", "설정하지 마", "시작하지 마"
      - "괜찮아", "괜찮아요", "필요없어", "필요없어요", "안 해도 돼", "안 해도 돼요"
      - "안 할래", "안 할게", "안 해줘", "설정 안 해", "시작 안 해"
      - "아니야", "아니에요", "싫어", "싫어요", "그만", "그만해"
    * 거절 표현을 인식하면: "알겠어요, 타이머 없이 진행할게요"라고만 말하고 타이머 없이 단계를 안내하세요
    * **거절 후 start_timer를 호출하는 것은 절대 금지입니다!**
  
  - 사용자가 "응", "네", "좋아", "좋아요", "시작해", "시작해줘", "설정해", "설정해줘", "해줘", "해줘요" 등 **명확하게 긍정적으로 대답하면** 그때만 start_timer 함수를 호출하세요
  - 사용자가 직접 "타이머 시작", "타이머 켜줘", "타이머 설정해줘" 등을 명시적으로 말하면 바로 start_timer 호출
  - "타이머 멈춰", "타이머 정지", "타이머 중지" 등을 말하면 stop_timer 호출
  - **타이머가 실행 중일 때 사용자가 "다음 단계", "다음으로", "다음" 등을 말하면**:
    1. 먼저 stop_timer 함수를 호출하여 타이머를 중지하세요
    2. 그 다음 navigate_next_step 함수를 호출하여 다음 단계로 이동하세요
    3. 사용자에게 "타이머를 중지하고 다음 단계로 넘어갈게요"라고 안내하세요
- Stay focused on the current cooking step, but use full recipe context for better answers
- **Only process Korean language inputs** - 한국어 입력만 처리합니다

⚠️ **CRITICAL: 도구(함수) 호출 후 반드시 응답하세요!**
- 타이머 시작(start_timer) 후: "~분 타이머를 시작했어요" 처럼 안내
- **절대로 침묵하지 마세요!** 도구 호출 후에도 항상 사용자에게 결과를 알려주세요.
- 사용자가 말하면 반드시 응답하세요. 빈 응답은 허용되지 않습니다.`;
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

      this.ws.on('open', async () => {
        console.log('✅ Connected to OpenAI Realtime API (V3)');
        this.reconnectAttempts = 0; // 재연결 성공 시 카운터 리셋
        
        try {
          await this.sendSessionUpdate();
          
          // 🆕 session.updated 이벤트를 기다린 후 response.create 호출 (첫 연결 시)
          await new Promise<void>((resolve) => {
            const timeout = setTimeout(() => {
              console.warn('[RealtimeServiceV3] ⚠️ session.updated timeout, proceeding anyway');
              resolve();
            }, 2000); // 최대 2초 대기
            
            this.once('session_updated', () => {
              clearTimeout(timeout);
              console.log('✅ [RealtimeServiceV3] Session updated confirmed, requesting response');
              resolve();
            });
          });
          
          // 이제 안전하게 response.create 호출
          const createResponse = {
            type: 'response.create',
            response: {
              modalities: ['audio', 'text'],
            },
          };
          this.sendToOpenAI(createResponse);
          console.log('📤 [RealtimeServiceV3] First response creation requested');
        } catch (error) {
          console.error('[RealtimeServiceV3] Failed to send session update:', error);
          reject(error);
          return;
        }
        
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

        // 🆕 자동 재연결 로직
        if (this.shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff
          console.log(`🔄 Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms...`);

          this.reconnectTimer = setTimeout(async () => {
            try {
              await this.connect();
            } catch (error) {
              console.error('Reconnection failed:', error);
            }
          }, delay);
        } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          console.error('❌ Max reconnection attempts reached. Giving up.');
          this.emit('reconnect_failed');
        }

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

  /**
   * Build VAD configuration
   */
  private buildVADConfig(updateVAD: boolean): any {
    if (!updateVAD) return undefined;

    return this.vadMode === 'server_vad'
      ? {
        type: 'server_vad',
        threshold: VAD_CONFIG.THRESHOLD,
        prefix_padding_ms: VAD_CONFIG.PREFIX_PADDING_MS,
        silence_duration_ms: VAD_CONFIG.SILENCE_DURATION_MS,
        create_response: true,
      }
      : null;
  }

  /**
   * Load MCP tools
   */
  private async loadMCPTools(): Promise<{ tools: any[]; toolChoice: string }> {
    if (!this.mcpClient || !this.session) {
      return { tools: [], toolChoice: 'none' };
    }

    try {
      const mcpTools = await this.mcpClient.getToolDefinitions();
      const tools = mcpTools.map((tool) => ({
        type: 'function',
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema,
      }));
      console.log(`[RealtimeServiceV3] Loaded ${tools.length} MCP tools`);
      return { tools, toolChoice: 'auto' };
    } catch (error) {
      console.error('[RealtimeServiceV3] Failed to load MCP tools:', error);
      return { tools: [], toolChoice: 'none' };
    }
  }

  /**
   * Build session update payload
   */
  private buildSessionUpdatePayload(
    systemPrompt: string,
    turnDetection: any,
    tools: any[],
    toolChoice: string
  ): any {
    const payload: any = {
      type: 'session.update',
      session: {
        modalities: ['text', 'audio'],
        instructions: systemPrompt,
        voice: this.voice,
        input_audio_format: AUDIO_CONFIG.FORMAT,
        output_audio_format: AUDIO_CONFIG.FORMAT,
        input_audio_transcription: {
          model: 'whisper-1',
          language: 'ko',
          prompt: '한국어 요리 레시피', // 간단하게 변경 (오인식 방지)
        },
        tools,
        tool_choice: toolChoice,
        max_response_output_tokens: "inf",
      },
    };

    if (turnDetection !== undefined) {
      payload.session.turn_detection = turnDetection;
    }

    return payload;
  }

  /**
   * Send session update to OpenAI (refactored)
   */
  private async sendSessionUpdate(customPrompt?: string, updateVAD: boolean = true): Promise<void> {
    // 🆕 WebSocket 연결 상태 확인
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[RealtimeServiceV3] ⚠️ Cannot update session: WebSocket not connected');
      return;
    }

    try {
      const session = this.session;
      const systemPrompt = customPrompt ||
        (session ? this.generateSystemPrompt(session) : 'You are a helpful Korean cooking assistant.');

      const turnDetection = this.buildVADConfig(updateVAD);
      const { tools, toolChoice } = await this.loadMCPTools();
      const sessionUpdate = this.buildSessionUpdatePayload(systemPrompt, turnDetection, tools, toolChoice);

      this.sendToOpenAI(sessionUpdate);
      console.log(`📤 Session updated (VAD: ${updateVAD ? (turnDetection ? 'server_vad' : 'none') : 'unchanged'}, Tools: ${tools.length})`);
    } catch (error) {
      console.error('[RealtimeServiceV3] Error in sendSessionUpdate:', error);
      throw error; // 상위로 전파하여 호출자가 처리할 수 있도록
    }
  }


  // ==========================================================================
  // Audio & Text Input
  // ==========================================================================

  public sendAudio(audioData: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('⚠️ [RealtimeServiceV3] WebSocket not ready');
      return;
    }

    // 🆕 오디오 전송 로그 제거 (과도한 로그 방지)
    // console.log('🎤 [RealtimeServiceV3] Sending audio chunk to OpenAI, length:', audioData?.length || 0);

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

      // 🆕 응답 시작 시점 정확히 추적
      case 'response.created':
        console.log('🔄 Response started');
        this.isResponding = true;
        this.hasGeneratedText = false; // 🆕 응답 시작 시 텍스트 생성 플래그 초기화
        // 🆕 새 응답 시작 시 이전 오디오 완전히 정리 (음성 겹침 방지)
        this.audioQueue = [];
        this.emit('response_created', event);
        break;

      // 🆕 응답 취소됨 - 새 입력 준비 완료
      case 'response.cancelled':
        console.log('⏹️ Response cancelled - ready for new input');
        this.isResponding = false;
        this.audioQueue = [];
        this.lastTranscriptItemId = null; // 🆕 다음 응답을 위해 초기화
        break;

      case 'input_audio_buffer.speech_started':
        console.log('🎤 Speech started');

        // 🆕 AI 응답 중 사용자가 말하면 현재 응답 취소 (인터럽트)
        // 비활성화됨: GPT가 말하는 중에도 마이크 입력 허용
        // if (this.isResponding) {
        //   console.log('⏹️ User interrupted - cancelling current response');
        //   this.sendToOpenAI({ type: 'response.cancel' });
        //   this.isResponding = false;
        //   this.audioQueue = []; // 오디오 큐 비우기
        // }

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
        // 🆕 빈 문자열 즉시 필터링 (잡음만 감지된 경우)
        if (!event.transcript || event.transcript.trim().length === 0) {
          // 🆕 디버깅 로그 간소화: 빈 전사는 조용히 무시
          return;
        }

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

        // 🔧 중단 기능 제거 - 모든 발화를 AI에게 전달
        this.emit('user_transcription', {
          transcript: event.transcript,
          item_id: event.item_id,
          rejected: false,
        });

        // 🆕 Phase 4: LangChain removed - GPT-realtime handles tool calling directly
        // User transcript is sent to GPT, which decides if tool call is needed
        break;

      case 'response.audio_transcript.delta':
        // 🔧 [STOP] 태그 감지 제거
        this.hasGeneratedText = true; // 🆕 텍스트가 생성되었음을 표시
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
        // 🔧 중복 로그 방지: item_id로 추적하여 한 번만 로그 출력
        if (!this.lastTranscriptItemId || this.lastTranscriptItemId !== event.item_id) {
          console.log('🤖 [AI]:', event.transcript);
          this.lastTranscriptItemId = event.item_id;
        }
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
        this.isResponding = false; // 🆕 AI 응답 완료
        this.lastTranscriptItemId = null; // 🆕 다음 응답을 위해 초기화
        this.emit('response_done', event);
        break;

      case 'error':
        // "Cancellation failed" 오류는 무시 (인터럽트 시 발생)
        if (event.error?.message?.includes('Cancellation failed')) {
          console.log('ℹ️ Cancellation error ignored (no active response)');
          break;
        }
        console.error('❌ Error from server:', event.error);
        this.emit('error', event.error);
        break;

      case 'conversation.item.input_audio_transcription.failed':
        console.error('❌ [RealtimeServiceV3] Transcription failed:', {
          item_id: event.item_id,
          error: event.error
        });
        
        // Rate Limit 에러인 경우 특별 처리
        if (event.error?.message?.includes('429') || 
            event.error?.message?.includes('Too Many Requests')) {
          console.warn('⚠️ [RealtimeServiceV3] Whisper API Rate Limit exceeded. Please wait before speaking again.');
          this.emit('transcription_failed', {
            item_id: event.item_id,
            error: event.error,
            reason: 'rate_limit'
          });
        } else {
          this.emit('transcription_failed', {
            item_id: event.item_id,
            error: event.error,
            reason: 'unknown'
          });
        }
        break;

      default:
        // 🆕 디버깅: 알 수 없는 이벤트 타입 로깅
        // rate_limits, session 이벤트는 정상이므로 필터링
        if (event.type && 
            !event.type.startsWith('response.') && 
            !event.type.startsWith('rate_limits.') &&
            !event.type.startsWith('session.')) {
          console.log('🔍 [DEBUG] Unknown event type:', event.type, JSON.stringify(event, null, 2));
        }
        break;
    }
  }

  // 🆕 Phase 4: processUserTranscript removed - MCP Tool Calling handles everything

  /**
   * 🆕 Phase 3: Handle tool call from Realtime API
   */
  private async handleToolCall(event: any): Promise<void> {
    if (!this.mcpClient) {
      console.warn('[RealtimeServiceV3] No MCP client for tool call');
      return;
    }

    try {
      const toolName = event.name;
      const args = JSON.parse(event.arguments);

      // Override session_id with current session (AI may send placeholder)
      const toolArgs = {
        ...args,
        session_id: this.session.sessionId, // Always use actual session ID
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

      // 🆕 Emit tool execution event for WebSocket broadcast
      this.emit('tool_executed', {
        sessionId: this.session.sessionId,
        toolName,
        args,
        result,
      });

      // Update session prompt if step changed (navigation tools)
      if (result.success && toolName.startsWith('navigate_')) {
        if (result.current_step_index !== undefined) {
          this.session.currentStepIndex = result.current_step_index;
          this.session.viewingStepIndex = result.current_step_index;

          // 🆕 Reset timer state on step change
          this.timerState = null;
          this.previousTimerState = null; // 🆕 이전 상태도 리셋

          // 🆕 Emit timer reset event for frontend synchronization
          this.emit('timer_reset', {
            sessionId: this.session.sessionId,
            stepIndex: result.current_step_index,
            reason: 'step_changed'
          });

          try {
            const updatedPrompt = this.generateSystemPrompt(this.session);
            await this.sendSessionUpdate(updatedPrompt, false); // ✅ Context-only update, no VAD reset
            console.log('✅ Session context updated for new step');
            
            // 🆕 세션 업데이트 완료 후 짧은 지연 (OpenAI가 세션 업데이트를 처리할 시간)
            await new Promise(resolve => setTimeout(resolve, 100)); // 100ms 대기
            
            // 🆕 즉시 응답 생성 요청
            const createResponse = {
              type: 'response.create',
              response: {
                modalities: ['audio', 'text'],
              },
            };
            this.sendToOpenAI(createResponse);
            console.log('📤 [RealtimeServiceV3] Response creation requested after step change');
            
            // 🆕 응답이 없거나 텍스트가 생성되지 않으면 재요청 (침묵 방지)
            const responseCheckTimeout = setTimeout(() => {
              if (!this.hasGeneratedText) {
                console.warn('[RealtimeServiceV3] ⚠️ No text generated after 1.5 seconds, forcing retry...');
                this.sendToOpenAI(createResponse);
                
                // 🆕 2차 재시도 (1.5초 후)
                setTimeout(() => {
                  if (!this.hasGeneratedText) {
                    console.warn('[RealtimeServiceV3] ⚠️ Still no text generated, final retry...');
                    this.sendToOpenAI(createResponse);
                  }
                }, 1500);
              }
            }, 1500); // 2초 → 1.5초로 단축
            
            // 응답이 시작되면 타임아웃 취소
            const responseCreatedListener = () => {
              clearTimeout(responseCheckTimeout);
              this.removeListener('response_created', responseCreatedListener);
            };
            this.once('response_created', responseCreatedListener);
            
            // navigate_ 툴의 경우 여기서 return하여 아래 response.create 중복 방지
            return;
          } catch (error) {
            console.error('[RealtimeServiceV3] Failed to update session context:', error);
            // 에러 발생해도 응답 생성은 계속
            const createResponse = { type: 'response.create' };
            this.sendToOpenAI(createResponse);
            return;
          }
        }
      }

      // Request new response from GPT (다른 툴의 경우)
      const createResponse = {
        type: 'response.create',
      };

      this.sendToOpenAI(createResponse);
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
   * 🔧 강화된 STT 필터: 환청 방지 + 한국어 검증
   */
  private isKoreanText(text: string): boolean {
    if (!text || text.trim().length === 0) {
      return false;
    }

    const trimmed = text.trim();

    // 🆕 최소 길이 필터 (너무 짧은 것은 잡음일 수 있음)
    if (trimmed.length < 2) {
      console.warn(`⚠️ [Filter] Too short: "${trimmed}"`);
      return false;
    }

    // 🆕 특수문자만 있는 경우 필터
    if (/^[^\w가-힣]+$/.test(trimmed)) {
      console.warn(`⚠️ [Filter] Only special chars: "${trimmed}"`);
      return false;
    }

    // 🆕 반복되는 문자 필터 (예: "으으으으", "아아아아", "음음음")
    if (/^(.)\1{2,}$/.test(trimmed.replace(/\s/g, ''))) {
      console.warn(`⚠️ [Filter] Repeated chars: "${trimmed}"`);
      return false;
    }

    // 🆕 일반적인 잡음 패턴 필터
    const noisePatterns = [
      /^(음|어|으|아|흠|응)+$/,  // 감탄사 반복
      /^\.+$/,                    // 마침표만
      /^\?+$/,                    // 물음표만
      /^!+$/,                     // 느낌표만
    ];

    for (const pattern of noisePatterns) {
      if (pattern.test(trimmed.replace(/\s/g, ''))) {
        console.warn(`⚠️ [Filter] Noise pattern: "${trimmed}"`);
        return false;
      }
    }

    // Remove whitespace for accurate counting
    const textWithoutSpaces = trimmed.replace(/\s/g, '');
    if (textWithoutSpaces.length === 0) {
      return false;
    }

    // Count Korean characters (Hangul syllables: 가-힣, Jamo: ㄱ-ㅎ, ㅏ-ㅣ)
    const koreanChars = textWithoutSpaces.match(/[가-힣ㄱ-ㅎㅏ-ㅣ]/g);
    const koreanCount = koreanChars ? koreanChars.length : 0;

    const ratio = koreanCount / textWithoutSpaces.length;

    console.log(
      `[Korean Check] Text: "${trimmed}" | Korean: ${koreanCount}/${textWithoutSpaces.length} (${(
        ratio * 100
      ).toFixed(1)}%)`
    );

    // 🔧 한국어 비율 기준 강화 (80% → 60%, 하지만 최소 1글자 이상)
    return ratio >= 0.6 && koreanCount >= 1;
  }

  private sendToOpenAI(data: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  public disconnect(): void {
    this.shouldReconnect = false; // 수동 disconnect 시 재연결 방지
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  public isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}
