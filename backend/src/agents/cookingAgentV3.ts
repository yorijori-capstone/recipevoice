/**
 * Cooking Agent V3
 * V3 Architecture: MCP Tool Calling
 */

import { EventEmitter } from 'events';
import { RecipeCleaner, CleanedRecipe, PlannedStep, ProcessStep, Ingredient, PlanningOutput } from '../services/recipeCleaner.js';
import { SessionService, CookingSessionData } from '../services/sessionService.js';
import { pool } from '../db/pool.js';
import { RealtimeServiceV3 } from '../services/realtimeServiceV3.js'; // 🆕 Import
import { MCPClientManager } from '../mcp/mcp-client.js'; // 🆕 Import

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
  realtimeService?: RealtimeServiceV3; // 🆕 Session specific service
}

// ============================================================================
// CookingAgentV3 Class
// ============================================================================

export class CookingAgentV3 extends EventEmitter {
  private recipeCleaner: RecipeCleaner;
  private sessionService: SessionService;
  private sessions: Map<string, CookingSession> = new Map();
  private mcpClient: MCPClientManager | null = null; // 🆕 MCP Client reference
  private apiKey: string; // 🆕 Store API Key

  constructor(apiKey: string) {
    super();
    this.apiKey = apiKey;
    this.recipeCleaner = new RecipeCleaner(apiKey);
    this.sessionService = new SessionService();

    console.log('[CookingAgentV3] Initialized');
  }

  /**
   * 🆕 Set MCP Client
   */
  setMCPClient(client: MCPClientManager | null) {
    this.mcpClient = client;
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

      // 🆕 Create RealtimeServiceV3 for this session
      session.realtimeService = new RealtimeServiceV3({
        apiKey: this.apiKey,
        session: session,
        cookingAgent: this,
        mcpClient: this.mcpClient || undefined,
        model: 'gpt-4o-realtime-preview-2024-10-01', // Use specific model
        voice: 'alloy'
      });

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
   * Recover session from database (for page refresh)
   */
  async recoverSession(sessionId: string): Promise<CookingSession | null> {
    try {
      // DB에서 세션 정보 가져오기
      const sessionData = await this.sessionService.getSession(sessionId);
      if (!sessionData) {
        return null;
      }

      // cleaned_recipes 테이블에서 recipe_id 가져오기 (cleaned_recipe_id는 id, recipe_id는 string)
      const recipeResult = await pool.query(
        `SELECT recipe_id FROM cleaned_recipes WHERE id = $1`,
        [sessionData.cleaned_recipe_id]
      );

      if (recipeResult.rows.length === 0) {
        console.error(`[CookingAgentV3] Cleaned recipe not found for id: ${sessionData.cleaned_recipe_id}`);
        return null;
      }

      const recipeId = recipeResult.rows[0].recipe_id;

      // 레시피 정보 로드
      const cleanedRecipe = await this.recipeCleaner.getCleanedRecipe(recipeId);
      if (!cleanedRecipe) {
        return null;
      }

      // 세션 객체 재구성
      const processSteps = cleanedRecipe.process || [];
      const totalSteps = processSteps.length || cleanedRecipe.planned_steps.length;

      const session: CookingSession = {
        sessionId: sessionData.session_id,
        recipeId: cleanedRecipe.recipe_id,
        cleanedRecipeId: cleanedRecipe.id,
        title: cleanedRecipe.title,
        openingRemark: cleanedRecipe.opening_remark,
        closingRemark: cleanedRecipe.closing_remark,
        plannedSteps: cleanedRecipe.planned_steps,
        process: processSteps,
        planning_result: cleanedRecipe.planning_result,
        currentStepIndex: sessionData.current_step_index,
        viewingStepIndex: sessionData.viewing_step_index,
        totalSteps,
        status: sessionData.status as 'active' | 'paused' | 'completed' | 'error',
        ingredients: cleanedRecipe.ingredients,
        startedAt: sessionData.started_at
      };

      // 🆕 Create RealtimeServiceV3 for this session
      session.realtimeService = new RealtimeServiceV3({
        apiKey: this.apiKey,
        session: session,
        cookingAgent: this,
        mcpClient: this.mcpClient || undefined,
        model: 'gpt-4o-realtime-preview-2024-10-01',
        voice: 'alloy'
      });

      // 메모리에 저장
      this.sessions.set(session.sessionId, session);

      console.log(`[CookingAgentV3] Session recovered: ${sessionId}`);
      return session;
    } catch (error) {
      console.error('[CookingAgentV3] Failed to recover session:', error);
      return null;
    }
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

      // 🆕 Disconnect RealtimeService
      if (session.realtimeService) {
        session.realtimeService.disconnect();
        session.realtimeService = undefined;
      }

      // Update in-memory
      session.status = 'completed';

      // 🆕 Remove from memory to prevent leaks
      this.sessions.delete(sessionId);

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
