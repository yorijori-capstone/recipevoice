/**
 * Cooking Agent - Orchestrates cooking sessions
 * Uses OpenAI Realtime API + Planning Service
 */

import { EventEmitter } from 'events';
import { RealtimeService } from '../services/realtimeService.js';
import { PlanningService, PlannedStep } from '../services/planningService.js';

export interface CookingSession {
  sessionId: string;
  recipeId: string;
  recipe: any;
  plannedSteps: PlannedStep[];
  currentStepIndex: number;
  status: 'planning' | 'active' | 'paused' | 'completed' | 'error';
  startTime: Date;
  endTime?: Date;
}

/**
 * Cooking Agent
 * Orchestrates cooking sessions with OpenAI Realtime API + Planning Service
 */
export class CookingAgent extends EventEmitter {
  private planningService: PlanningService;
  private realtimeService: RealtimeService;
  private sessions: Map<string, CookingSession> = new Map();

  constructor(apiKey: string) {
    super();
    this.planningService = new PlanningService(apiKey);

    // Initialize Realtime Service with cooking-specific prompt
    this.realtimeService = new RealtimeService({
      apiKey,
      systemPrompt: this.getCookingSystemPrompt()
    });

    // Setup event handlers
    this.setupEventHandlers();
  }

  private getCookingSystemPrompt(): string {
    return `You are a friendly Korean cooking assistant helping users cook step-by-step.

Your role:
1. Guide users through cooking steps in a warm, encouraging tone
2. Answer questions about the recipe using available information
3. Handle control commands (pause, resume, retry, clarify)
4. Use MCP tools when needed for planning and searching

Always respond in Korean with a friendly, supportive tone.`;
  }

  private setupEventHandlers(): void {
    // Forward realtime events
    this.realtimeService.on('user_transcription', (data) => {
      this.emit('user_transcription', data);
    });

    this.realtimeService.on('assistant_transcript_delta', (data) => {
      this.emit('assistant_transcript_delta', data);
    });

    this.realtimeService.on('assistant_transcript_done', (data) => {
      this.emit('assistant_transcript_done', data);
    });

    this.realtimeService.on('audio_delta', (chunk) => {
      this.emit('audio_delta', chunk);
    });

    this.realtimeService.on('error', (error) => {
      this.emit('error', error);
    });
  }

  async connect(): Promise<void> {
    await this.realtimeService.connect();
  }

  disconnect(): void {
    this.realtimeService.disconnect();
  }

  /**
   * Start a new cooking session
   */
  async startCookingSession(recipeId: string, recipe: any): Promise<CookingSession> {
    try {
      console.log(`[CookingAgent] Starting session for recipe: ${recipe.title}`);

      const sessionId = this.generateSessionId();

      // Create session
      const session: CookingSession = {
        sessionId,
        recipeId,
        recipe,
        plannedSteps: [],
        currentStepIndex: 0,
        status: 'planning',
        startTime: new Date()
      };

      this.sessions.set(sessionId, session);

      // Plan recipe using Planning Service
      console.log('[CookingAgent] Planning recipe...');
      const planResult = await this.planningService.generatePlan({
        title: recipe.title,
        ingredients: recipe.ingredients.map((ing: any) => ({
          name: ing.name,
          quantity: ing.quantity || ''
        })),
        steps: recipe.steps.map((step: any) => ({
          order: step.step_number,
          instruction: step.description
        }))
      });

      session.plannedSteps = planResult.planned_steps;
      session.status = 'active';

      console.log(`[CookingAgent] Session ${sessionId} started with ${planResult.planned_steps.length} steps`);

      // Send opening remark
      this.emit('session_started', {
        sessionId,
        openingRemark: planResult.opening_remark,
        totalSteps: planResult.planned_steps.length
      });

      return session;
    } catch (error) {
      console.error('[CookingAgent] Failed to start session:', error);
      throw error;
    }
  }

  /**
   * Get session info
   */
  getSession(sessionId: string): CookingSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get current step for session
   */
  getCurrentStep(sessionId: string): any | null {
    const session = this.sessions.get(sessionId);
    if (!session || session.currentStepIndex >= session.plannedSteps.length) {
      return null;
    }
    return session.plannedSteps[session.currentStepIndex];
  }

  /**
   * Move to next step
   */
  nextStep(sessionId: string): any | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    session.currentStepIndex++;

    if (session.currentStepIndex >= session.plannedSteps.length) {
      session.status = 'completed';
      session.endTime = new Date();
      this.emit('session_completed', { sessionId });
      return null;
    }

    const nextStep = session.plannedSteps[session.currentStepIndex];
    this.emit('step_changed', {
      sessionId,
      stepIndex: session.currentStepIndex,
      step: nextStep
    });

    return nextStep;
  }

  /**
   * Handle control command
   */
  async handleControl(
    sessionId: string,
    command: 'pause' | 'resume' | 'retry' | 'clarify'
  ): Promise<any> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const currentStep = this.getCurrentStep(sessionId);
    if (!currentStep) {
      throw new Error('No current step');
    }

    // Call Planning Service control handler
    const result = this.planningService.handleControlCommand(command, currentStep);

    if (command === 'pause') {
      session.status = 'paused';
    } else if (command === 'resume') {
      session.status = 'active';
    }

    return result;
  }

  /**
   * End cooking session
   */
  endSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = 'completed';
      session.endTime = new Date();
      this.sessions.delete(sessionId);
      console.log(`[CookingAgent] Session ${sessionId} ended`);
    }
  }

  /**
   * Audio streaming methods (forward to RealtimeService)
   */
  sendAudio(audioData: string): void {
    this.realtimeService.sendAudio(audioData);
  }

  startStreaming(): void {
    this.realtimeService.startStreaming();
  }

  stopStreaming(): void {
    this.realtimeService.stopStreaming();
  }

  setVADMode(mode: 'auto' | 'manual'): void {
    this.realtimeService.setVADMode(mode);
  }

  isConnected(): boolean {
    return this.realtimeService.isConnected();
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
