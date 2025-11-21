/**
 * LangChain Agent Pipeline
 * Handles intent detection, tool routing, and response generation
 */

import { ChatOpenAI } from '@langchain/openai';
import { CookingAgentV2 } from './cookingAgentV2.js';

// ============================================================================
// Interfaces
// ============================================================================

export type UserIntent =
  | 'NEXT_STEP'
  | 'PREVIOUS_STEP'
  | 'REPEAT_STEP'
  | 'START_TIMER'
  | 'STOP_TIMER'
  | 'CHECK_TIMER'
  | 'PAUSE_SESSION'
  | 'RESUME_SESSION'
  | 'END_SESSION'
  | 'QUESTION'
  | 'UNCLEAR';

export interface IntentDetectionResult {
  intent: UserIntent;
  confidence: number;
  entities?: {
    duration?: number; // For timer commands
    stepNumber?: number; // For "go to step X"
    question?: string; // For questions
  };
}

export interface ToolExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
  responseText?: string;
}

// ============================================================================
// LangChain Agent Class
// ============================================================================

export class LangChainAgent {
  private intentDetector: ChatOpenAI;
  private responseGenerator: ChatOpenAI;
  private cookingAgent: CookingAgentV2;

  constructor(apiKey: string, cookingAgent: CookingAgentV2) {
    // Fast model for intent detection
    this.intentDetector = new ChatOpenAI({
      openAIApiKey: apiKey,
      modelName: 'gpt-4o-mini',
      temperature: 0.1,
      maxTokens: 200
    });

    // Quality model for response generation
    this.responseGenerator = new ChatOpenAI({
      openAIApiKey: apiKey,
      modelName: 'gpt-4o-mini',
      temperature: 0.7,
      maxTokens: 500
    });

    this.cookingAgent = cookingAgent;

    console.log('[LangChainAgent] Initialized');
  }

  // ==========================================================================
  // Main Pipeline
  // ==========================================================================

  /**
   * Process user voice input through the pipeline
   */
  async processUserInput(
    sessionId: string,
    userInput: string,
    conversationHistory: Array<{ role: string; content: string }> = []
  ): Promise<ToolExecutionResult> {
    try {
      console.log(`[LangChainAgent] Processing input: "${userInput}"`);

      // Step 1: Detect intent
      const intentResult = await this.detectIntent(userInput, conversationHistory);
      console.log(`[LangChainAgent] Detected intent: ${intentResult.intent} (confidence: ${intentResult.confidence})`);

      // Step 2: Route to appropriate tool
      const executionResult = await this.executeIntent(sessionId, intentResult);

      // Step 3: Generate natural language response
      if (!executionResult.responseText) {
        executionResult.responseText = await this.generateResponse(
          intentResult,
          executionResult,
          conversationHistory
        );
      }

      return executionResult;
    } catch (error: any) {
      console.error('[LangChainAgent] Pipeline error:', error);
      return {
        success: false,
        error: error.message,
        responseText: '죄송합니다. 처리 중 오류가 발생했습니다.'
      };
    }
  }

  // ==========================================================================
  // Intent Detection Layer
  // ==========================================================================

  /**
   * Detect user intent from voice input using GPT-3.5-turbo
   */
  async detectIntent(
    userInput: string,
    conversationHistory: Array<{ role: string; content: string }>
  ): Promise<IntentDetectionResult> {
    try {
      const systemPrompt = `You are an intent classifier for a cooking voice assistant.

Available intents:
- NEXT_STEP: User wants to move to the next cooking step
  Examples: "다음", "next", "다음 단계", "계속", "이제 뭐해?"

- PREVIOUS_STEP: User wants to go back to previous step
  Examples: "이전", "전 단계", "다시", "back"

- REPEAT_STEP: User wants to hear current step again
  Examples: "다시 말해줘", "repeat", "뭐라고?", "못 들었어"

- START_TIMER: User wants to start a timer
  Examples: "타이머 시작", "start timer", "5분 재줘", "타이머 켜줘"

- STOP_TIMER: User wants to stop a timer
  Examples: "타이머 정지", "stop timer", "타이머 꺼줘"

- CHECK_TIMER: User wants to check timer status
  Examples: "타이머 확인", "남은 시간", "얼마나 남았어?"

- PAUSE_SESSION: User wants to pause cooking
  Examples: "잠깐만", "pause", "멈춰", "일시정지"

- RESUME_SESSION: User wants to resume cooking
  Examples: "다시 시작", "resume", "계속할게"

- END_SESSION: User wants to end cooking
  Examples: "종료", "그만", "끝", "나가기"

- QUESTION: User is asking a question about the recipe
  Examples: "이게 뭐야?", "왜 그래?", "어떻게 해?", "설명해줘"

- UNCLEAR: Cannot determine intent clearly

Respond with JSON only:
{
  "intent": "INTENT_NAME",
  "confidence": 0.95,
  "entities": {
    "duration": 300,  // Optional: for timer in seconds
    "question": "..."  // Optional: for questions
  }
}`;

      const userPrompt = `User said: "${userInput}"\n\nClassify the intent.`;

      const response = await this.intentDetector.invoke([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]);

      const content = response.content as string;
      const result = JSON.parse(content.trim());

      return {
        intent: result.intent as UserIntent,
        confidence: result.confidence,
        entities: result.entities || {}
      };
    } catch (error: any) {
      console.error('[LangChainAgent] Intent detection failed:', error);
      // Fallback to UNCLEAR
      return {
        intent: 'UNCLEAR',
        confidence: 0.0
      };
    }
  }

  // ==========================================================================
  // Tool Router & Execution Layer
  // ==========================================================================

  /**
   * Execute the detected intent using appropriate tools
   */
  async executeIntent(
    sessionId: string,
    intentResult: IntentDetectionResult
  ): Promise<ToolExecutionResult> {
    const { intent, entities } = intentResult;

    try {
      switch (intent) {
        case 'NEXT_STEP':
          return await this.executeNextStep(sessionId);

        case 'PREVIOUS_STEP':
          return await this.executePreviousStep(sessionId);

        case 'REPEAT_STEP':
          return await this.executeRepeatStep(sessionId);

        case 'START_TIMER':
          return await this.executeStartTimer(sessionId, entities?.duration);

        case 'STOP_TIMER':
          return await this.executeStopTimer(sessionId);

        case 'CHECK_TIMER':
          return await this.executeCheckTimer(sessionId);

        case 'PAUSE_SESSION':
          return await this.executePauseSession(sessionId);

        case 'RESUME_SESSION':
          return await this.executeResumeSession(sessionId);

        case 'END_SESSION':
          return await this.executeEndSession(sessionId);

        case 'QUESTION':
          return await this.executeQuestion(sessionId, entities?.question || '');

        case 'UNCLEAR':
        default:
          return {
            success: false,
            error: 'Intent unclear',
            responseText: '죄송합니다. 다시 한 번 말씀해 주시겠어요?'
          };
      }
    } catch (error: any) {
      console.error(`[LangChainAgent] Failed to execute intent ${intent}:`, error);
      return {
        success: false,
        error: error.message,
        responseText: '명령을 실행할 수 없습니다.'
      };
    }
  }

  // ==========================================================================
  // Tool Implementations
  // ==========================================================================

  private async executeNextStep(sessionId: string): Promise<ToolExecutionResult> {
    const nextStep = await this.cookingAgent.nextStep(sessionId);

    if (!nextStep) {
      return {
        success: false,
        error: 'Already at last step',
        responseText: '마지막 단계입니다. 요리가 완성되었습니다!'
      };
    }

    return {
      success: true,
      data: { step: nextStep },
      responseText: nextStep.script
    };
  }

  private async executePreviousStep(sessionId: string): Promise<ToolExecutionResult> {
    const previousStep = await this.cookingAgent.previousStep(sessionId);

    if (!previousStep) {
      return {
        success: false,
        error: 'Already at first step',
        responseText: '이미 첫 번째 단계입니다.'
      };
    }

    return {
      success: true,
      data: { step: previousStep },
      responseText: previousStep.script
    };
  }

  private async executeRepeatStep(sessionId: string): Promise<ToolExecutionResult> {
    const currentStep = this.cookingAgent.getCurrentStep(sessionId);

    if (!currentStep) {
      return {
        success: false,
        error: 'No current step',
        responseText: '현재 단계를 찾을 수 없습니다.'
      };
    }

    // Use retry_script for repetition
    return {
      success: true,
      data: { step: currentStep },
      responseText: currentStep.retry_script
    };
  }

  private async executeStartTimer(
    sessionId: string,
    duration?: number
  ): Promise<ToolExecutionResult> {
    const currentStep = this.cookingAgent.getCurrentStep(sessionId);

    if (!currentStep) {
      return {
        success: false,
        error: 'No current step'
      };
    }

    // Use step's default duration if not specified
    const timerDuration = duration || currentStep.estimated_time_sec;

    if (!timerDuration || timerDuration <= 0) {
      return {
        success: false,
        error: 'No timer duration available',
        responseText: '이 단계에는 타이머가 필요하지 않습니다.'
      };
    }

    await this.cookingAgent.logTimerEvent(sessionId, 'start', timerDuration);

    const minutes = Math.floor(timerDuration / 60);
    const seconds = timerDuration % 60;
    const timeText = minutes > 0 ? `${minutes}분 ${seconds}초` : `${seconds}초`;

    return {
      success: true,
      data: { duration: timerDuration },
      responseText: `${timeText} 타이머를 시작합니다.`
    };
  }

  private async executeStopTimer(sessionId: string): Promise<ToolExecutionResult> {
    await this.cookingAgent.logTimerEvent(sessionId, 'stop');

    return {
      success: true,
      responseText: '타이머를 정지했습니다.'
    };
  }

  private async executeCheckTimer(sessionId: string): Promise<ToolExecutionResult> {
    // Note: Timer state would need to be tracked in session
    // For now, just acknowledge
    return {
      success: true,
      responseText: '타이머 상태를 확인하세요.'
    };
  }

  private async executePauseSession(sessionId: string): Promise<ToolExecutionResult> {
    // Update session status to paused
    // This would be implemented in CookingAgentV2
    return {
      success: true,
      responseText: '요리를 일시정지했습니다. 다시 시작하려면 "다시 시작"이라고 말씀해주세요.'
    };
  }

  private async executeResumeSession(sessionId: string): Promise<ToolExecutionResult> {
    const currentStep = this.cookingAgent.getCurrentStep(sessionId);

    if (!currentStep) {
      return {
        success: false,
        error: 'No current step'
      };
    }

    return {
      success: true,
      data: { step: currentStep },
      responseText: `요리를 다시 시작합니다. ${currentStep.script}`
    };
  }

  private async executeEndSession(sessionId: string): Promise<ToolExecutionResult> {
    await this.cookingAgent.endSession(sessionId);

    const session = this.cookingAgent.getSession(sessionId);

    return {
      success: true,
      responseText: session?.closingRemark || '요리가 완료되었습니다. 맛있게 드세요!'
    };
  }

  private async executeQuestion(
    sessionId: string,
    question: string
  ): Promise<ToolExecutionResult> {
    const currentStep = this.cookingAgent.getCurrentStep(sessionId);
    const session = this.cookingAgent.getSession(sessionId);

    if (!currentStep || !session) {
      return {
        success: false,
        error: 'No context available'
      };
    }

    // Use GPT-4o to answer questions based on recipe context
    const answer = await this.answerQuestion(question, session.title, currentStep);

    return {
      success: true,
      data: { answer },
      responseText: answer
    };
  }

  // ==========================================================================
  // Response Generation Layer
  // ==========================================================================

  /**
   * Generate natural language response using GPT-4o
   */
  async generateResponse(
    intentResult: IntentDetectionResult,
    executionResult: ToolExecutionResult,
    conversationHistory: Array<{ role: string; content: string }>
  ): Promise<string> {
    // If execution already has a response, use it
    if (executionResult.responseText) {
      return executionResult.responseText;
    }

    // Fallback response generation
    if (!executionResult.success) {
      return '죄송합니다. 명령을 수행할 수 없습니다.';
    }

    return '네, 알겠습니다.';
  }

  /**
   * Answer user questions using GPT-4o
   */
  private async answerQuestion(
    question: string,
    recipeTitle: string,
    currentStep: any
  ): Promise<string> {
    try {
      const systemPrompt = `You are a helpful cooking assistant. Answer the user's question about their current cooking step.

Recipe: ${recipeTitle}
Current Step: ${currentStep.script}

Keep your answer concise (2-3 sentences max) and practical.
Answer in Korean.`;

      const response = await this.responseGenerator.invoke([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: question }
      ]);

      return response.content as string;
    } catch (error) {
      console.error('[LangChainAgent] Question answering failed:', error);
      return '죄송합니다. 답변을 생성할 수 없습니다.';
    }
  }
}
