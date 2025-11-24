/**
 * Cooking Agent V3
 * V3 Architecture: MCP Tool Calling
 */

import { EventEmitter } from 'events';
import { RecipeCleaner, CleanedRecipe, PlannedStep, ProcessStep, Ingredient, PlanningOutput } from '../services/recipeCleaner.js';
import { SessionService, CookingSessionData } from '../services/sessionService.js';

// ============================================================================
// Interfaces
// ============================================================================

export interface CookingSession {
  sessionId: string;
  recipeId: string;
  cleanedRecipeId: number;
  title: string;
  openingRemark: string;
  closingRemark: string;
  plannedSteps: PlannedStep[];  // Legacy - for backward compatibility
  process: ProcessStep[];  // 🆕 Direct access to process array from planning_result
  planning_result?: PlanningOutput;  // 🆕 Full planning result with meta, ingredients, tools, process
  currentStepIndex: number;
  viewingStepIndex: number;
  totalSteps: number;
  status: 'active' | 'paused' | 'completed' | 'error';
  ingredients: Ingredient[];  // 🆕 재료 목록 추가
  startedAt: Date;
}

// ============================================================================
// CookingAgentV3 Class
// ============================================================================

export class CookingAgentV3 extends EventEmitter {
  private recipeCleaner: RecipeCleaner;
  private sessionService: SessionService;
  private sessions: Map<string, CookingSession> = new Map();

  constructor(apiKey: string) {
    super();
    this.recipeCleaner = new RecipeCleaner(apiKey);
    this.sessionService = new SessionService();

    console.log('[CookingAgentV3] Initialized');
  }

  // ==========================================================================
  // Session Management
  // ==========================================================================

  /**
   * Start cooking session (NEW: uses Cleaned Recipe)
   */
  async startCookingSession(recipeId: string): Promise<CookingSession> {
    try {
      console.log(`[CookingAgentV3] Starting session for recipe: ${recipeId}`);

      // Step 1: Load cleaned recipe (Planning already done!)
      const cleanedRecipe = await this.recipeCleaner.getCleanedRecipe(recipeId);

      if (!cleanedRecipe) {
        throw new Error(`Cleaned recipe not found: ${recipeId}. Run cleanAndPlanRecipe first.`);
      }

      // Step 2: Create session in database
      const sessionData = await this.sessionService.createSession(
        cleanedRecipe.id,
        cleanedRecipe.planned_steps.length
      );

      // Step 3: Create in-memory session
      // 🆕 Use process array from planning_result (primary source)
      const processSteps = cleanedRecipe.process || [];
      const totalSteps = processSteps.length || cleanedRecipe.planned_steps.length;
      
      const session: CookingSession = {
        sessionId: sessionData.session_id,
        recipeId,
        cleanedRecipeId: cleanedRecipe.id,
        title: cleanedRecipe.title,
        openingRemark: cleanedRecipe.opening_remark,
        closingRemark: cleanedRecipe.closing_remark,
        plannedSteps: cleanedRecipe.planned_steps,  // Legacy
        process: processSteps,  // 🆕 Direct access to process array
        planning_result: cleanedRecipe.planning_result,  // 🆕 Full planning result for realtime context
        currentStepIndex: 0,
        viewingStepIndex: 0,
        totalSteps,
        status: 'active',
        ingredients: cleanedRecipe.ingredients,  // 🆕 재료 목록 추가
        startedAt: new Date()
      };

      this.sessions.set(session.sessionId, session);

      console.log(`[CookingAgentV3] Session started: ${session.sessionId}`);
      console.log(`[CookingAgentV3] Title: ${session.title}`);
      console.log(`[CookingAgentV3] Total steps: ${session.totalSteps}`);

      // Emit session started event
      this.emit('session_started', {
        sessionId: session.sessionId,
        openingRemark: session.openingRemark,
        totalSteps: session.totalSteps
      });

      return session;
    } catch (error) {
      console.error('[CookingAgentV3] Failed to start session:', error);
      throw error;
    }
  }

  /**
   * Get session
   */
  getSession(sessionId: string): CookingSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get current step (Legacy - returns PlannedStep for backward compatibility)
   */
  getCurrentStep(sessionId: string): PlannedStep | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;

    return session.plannedSteps[session.currentStepIndex];
  }

  /**
   * 🆕 Get current process step (from planning_result.process)
   */
  getCurrentProcessStep(sessionId: string): ProcessStep | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;

    return session.process[session.currentStepIndex];
  }

  /**
   * End session
   */
  async endSession(sessionId: string): Promise<void> {
    try {
      const session = this.sessions.get(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      // Update database
      await this.sessionService.endSession(sessionId);

      // Update in-memory
      session.status = 'completed';

      console.log(`[CookingAgentV3] Session ended: ${sessionId}`);

      this.emit('session_ended', { sessionId });
    } catch (error) {
      console.error('[CookingAgentV3] Failed to end session:', error);
      throw error;
    }
  }

  // ==========================================================================
  // Step Navigation
  // ==========================================================================

  /**
   * Move to next step
   */
  async nextStep(sessionId: string): Promise<PlannedStep | null> {
    try {
      const session = this.sessions.get(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      if (session.currentStepIndex >= session.totalSteps - 1) {
        console.log('[CookingAgentV3] Already at last step');
        return null;
      }

      const previousIndex = session.currentStepIndex;
      session.currentStepIndex++;
      session.viewingStepIndex = session.currentStepIndex;

      // Update database
      await this.sessionService.updateSession(sessionId, {
        current_step_index: session.currentStepIndex,
        viewing_step_index: session.viewingStepIndex
      });

      // Log state change
      await this.sessionService.logState(sessionId, 'step_change', {
        from_step: previousIndex,
        to_step: session.currentStepIndex,
        direction: 'next',
        timestamp: new Date().toISOString()
      });

      console.log(
        `[CookingAgentV3] Moved to step ${session.currentStepIndex + 1}/${session.totalSteps}`
      );

      const currentStep = this.getCurrentStep(sessionId);

      this.emit('step_changed', {
        sessionId,
        stepIndex: session.currentStepIndex,
        step: currentStep
      });

      return currentStep || null;
    } catch (error) {
      console.error('[CookingAgentV3] Failed to move to next step:', error);
      throw error;
    }
  }

  /**
   * Move to previous step
   */
  async previousStep(sessionId: string): Promise<PlannedStep | null> {
    try {
      const session = this.sessions.get(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      if (session.currentStepIndex <= 0) {
        console.log('[CookingAgentV3] Already at first step');
        return null;
      }

      const previousIndex = session.currentStepIndex;
      session.currentStepIndex--;
      session.viewingStepIndex = session.currentStepIndex;

      // Update database
      await this.sessionService.updateSession(sessionId, {
        current_step_index: session.currentStepIndex,
        viewing_step_index: session.viewingStepIndex
      });

      // Log state change
      await this.sessionService.logState(sessionId, 'step_change', {
        from_step: previousIndex,
        to_step: session.currentStepIndex,
        direction: 'previous',
        timestamp: new Date().toISOString()
      });

      console.log(
        `[CookingAgentV3] Moved to step ${session.currentStepIndex + 1}/${session.totalSteps}`
      );

      const currentStep = this.getCurrentStep(sessionId);

      this.emit('step_changed', {
        sessionId,
        stepIndex: session.currentStepIndex,
        step: currentStep
      });

      return currentStep || null;
    } catch (error) {
      console.error('[CookingAgentV3] Failed to move to previous step:', error);
      throw error;
    }
  }

  // ==========================================================================
  // Voice Mode Management
  // ==========================================================================
  // 🆕 Phase 2: setVoiceMode() removed - Voice is now simple ON/OFF
  // ==========================================================================
  // Session State Logging
  // ==========================================================================

  /**
   * Log voice command
   */
  async logVoiceCommand(sessionId: string, command: string, transcript: string): Promise<void> {
    await this.sessionService.logState(sessionId, 'voice_command', {
      command,
      transcript,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log timer event
   */
  async logTimerEvent(
    sessionId: string,
    action: 'start' | 'stop' | 'complete',
    durationSec?: number
  ): Promise<void> {
    const session = this.sessions.get(sessionId);

    await this.sessionService.logState(sessionId, 'timer_event', {
      action,
      duration_sec: durationSec,
      step: session?.currentStepIndex,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log error
   */
  async logError(sessionId: string, errorType: string, message: string): Promise<void> {
    await this.sessionService.logState(sessionId, 'error', {
      error_type: errorType,
      message,
      timestamp: new Date().toISOString()
    });
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Get session history
   */
  async getSessionHistory(sessionId: string): Promise<any[]> {
    return await this.sessionService.getSessionStates(sessionId);
  }
}
