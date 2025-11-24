/**
 * Cooking API Routes V3
 * Uses V3 architecture with MCP Tool Calling
 */

import express, { Request, Response } from 'express';
import { CookingServiceV3 } from '../services/cookingServiceV3.js';

const router = express.Router();

// Singleton service instance with initialization lock
let cookingServiceV3: CookingServiceV3 | null = null;
let initializingPromise: Promise<CookingServiceV3> | null = null;

/**
 * Initialize CookingServiceV3 (thread-safe)
 */
async function getCookingServiceV3(): Promise<CookingServiceV3> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key not configured');
  }

  // If already initialized, return immediately
  if (cookingServiceV3 && cookingServiceV3.isInitialized()) {
    return cookingServiceV3;
  }

  // If initialization is in progress, wait for it
  if (initializingPromise) {
    return initializingPromise;
  }

  // Start initialization
  initializingPromise = (async () => {
    cookingServiceV3 = new CookingServiceV3(apiKey);
    await cookingServiceV3.initialize();
    return cookingServiceV3;
  })();

  try {
    const service = await initializingPromise;
    return service;
  } finally {
    initializingPromise = null;
  }
}

/**
 * POST /api/cooking/v3/start  // v2 → v3로 주석 업데이트
 * Start a new cooking session with cleaned recipe
 * Body: { recipeId: string }
 */
router.post('/start', async (req: Request, res: Response) => {
  try {
    const { recipeId } = req.body;

    if (!recipeId) {
      return res.status(400).json({
        error: 'BAD_REQUEST',
        message: 'recipeId is required',
      });
    }

    console.log(`[Cooking V3 API] Starting session for recipe: ${recipeId}`);

    const service = await getCookingServiceV3();
    const agent = service.getCookingAgent();

    // Start cooking session (loads from cleaned_recipes)
    const session = await agent.startCookingSession(recipeId);

    console.log(`[Cooking V3 API] Session started: ${session.sessionId}`);

    res.json({
      success: true,
      session: {
        sessionId: session.sessionId,
        recipeId: session.recipeId,
        cleanedRecipeId: session.cleanedRecipeId,
        title: session.title,
        openingRemark: session.openingRemark,
        totalSteps: session.totalSteps,
        currentStepIndex: session.currentStepIndex,
        viewingStepIndex: session.viewingStepIndex,
        status: session.status,
        // 🆕 Phase 2: voiceMode removed
        plannedSteps: session.plannedSteps,
      },
    });
  } catch (error: any) {
    console.error('[Cooking V3 API] Start session failed:', error);
    res.status(500).json({
      error: 'SERVER_ERROR',
      message: error.message || 'Failed to start cooking session',
    });
  }
});

/**
 * GET /api/cooking/v3/session/:sessionId
 * Get session info (with recovery from DB if not in memory)
 */
router.get('/session/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const service = await getCookingServiceV3();
    const agent = service.getCookingAgent();

    // 먼저 메모리에서 확인
    let session = agent.getSession(sessionId);
    
    // 메모리에 없으면 DB에서 복구
    if (!session) {
      console.log(`[Cooking V3 API] Session not in memory, recovering from DB: ${sessionId}`);
      const recoveredSession = await agent.recoverSession(sessionId);
      
      if (!recoveredSession) {
        return res.status(404).json({
          error: 'NOT_FOUND',
          message: 'Session not found',
        });
      }
      
      session = recoveredSession;
    }

    const currentStep = agent.getCurrentStep(sessionId);

    res.json({
      success: true,
      session: {
        sessionId: session.sessionId,
        recipeId: session.recipeId,
        cleanedRecipeId: session.cleanedRecipeId,
        title: session.title,
        openingRemark: session.openingRemark,
        closingRemark: session.closingRemark,
        totalSteps: session.totalSteps,
        currentStepIndex: session.currentStepIndex,
        viewingStepIndex: session.viewingStepIndex,
        status: session.status,
        plannedSteps: session.plannedSteps,  // ✅ 추가
        currentStep,
      },
    });
  } catch (error: any) {
    console.error('[Cooking V3 API] Get session failed:', error);
    res.status(500).json({
      error: 'SERVER_ERROR',
      message: error.message || 'Failed to get session',
    });
  }
});

/**
 * POST /api/cooking/v3/session/:sessionId/next
 * Move to next step
 */
router.post('/session/:sessionId/next', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const service = await getCookingServiceV3();
    const agent = service.getCookingAgent();

    const nextStep = await agent.nextStep(sessionId);

    res.json({
      success: true,
      nextStep,
      completed: nextStep === null,
    });
  } catch (error: any) {
    console.error('[Cooking V3 API] Next step failed:', error);
    res.status(500).json({
      error: 'SERVER_ERROR',
      message: error.message || 'Failed to move to next step',
    });
  }
});

/**
 * POST /api/cooking/v3/session/:sessionId/previous
 * Move to previous step
 */
router.post('/session/:sessionId/previous', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const service = await getCookingServiceV3();
    const agent = service.getCookingAgent();

    const previousStep = await agent.previousStep(sessionId);

    res.json({
      success: true,
      previousStep,
    });
  } catch (error: any) {
    console.error('[Cooking V3 API] Previous step failed:', error);
    res.status(500).json({
      error: 'SERVER_ERROR',
      message: error.message || 'Failed to move to previous step',
    });
  }
});

// 🆕 Phase 2: /voice-mode endpoint removed - Voice is now simple ON/OFF

/**
 * POST /api/cooking/v3/session/:sessionId/end
 * End cooking session
 */
router.post('/session/:sessionId/end', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const service = await getCookingServiceV3();
    const agent = service.getCookingAgent();

    await agent.endSession(sessionId);

    console.log(`[Cooking V3 API] Session ended: ${sessionId}`);

    res.json({
      success: true,
      message: 'Session ended successfully',
    });
  } catch (error: any) {
    console.error('[Cooking V3 API] End session failed:', error);
    res.status(500).json({
      error: 'SERVER_ERROR',
      message: error.message || 'Failed to end session',
    });
  }
});

/**
 * GET /api/cooking/v3/session/:sessionId/history
 * Get session state history
 */
router.get('/session/:sessionId/history', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const limit = parseInt(req.query.limit as string) || 100;

    const service = await getCookingServiceV3();
    const agent = service.getCookingAgent();

    const history = await agent.getSessionHistory(sessionId);

    res.json({
      success: true,
      history: history.slice(0, limit),
    });
  } catch (error: any) {
    console.error('[Cooking V3 API] Get history failed:', error);
    res.status(500).json({
      error: 'SERVER_ERROR',
      message: error.message || 'Failed to get session history',
    });
  }
});

/**
 * GET /api/cooking/v3/health
 * Check cooking service health
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    if (!cookingServiceV3 || !cookingServiceV3.isInitialized()) {
      return res.status(503).json({
        status: 'initializing',
      });
    }

    res.json({
      status: 'healthy',
      version: 'v3',
    });
  } catch (error: any) {
    res.status(503).json({
      status: 'unhealthy',
      reason: error.message,
    });
  }
});

export default router;
export { getCookingServiceV3 };
