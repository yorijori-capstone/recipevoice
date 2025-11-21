/**
 * Cooking API Routes V2
 * Uses new architecture with Cleaned Recipes and SessionService
 */

import express, { Request, Response } from 'express';
import { CookingServiceV2 } from '../services/cookingServiceV2.js';

const router = express.Router();

// Singleton service instance
let cookingServiceV2: CookingServiceV2 | null = null;

/**
 * Initialize CookingServiceV2
 */
async function getCookingServiceV2(): Promise<CookingServiceV2> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key not configured');
  }

  if (!cookingServiceV2) {
    cookingServiceV2 = new CookingServiceV2(apiKey);
    await cookingServiceV2.initialize();
  }

  return cookingServiceV2;
}

/**
 * POST /api/cooking/v2/start
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

    console.log(`[Cooking V2 API] Starting session for recipe: ${recipeId}`);

    const service = await getCookingServiceV2();
    const agent = service.getCookingAgent();

    // Start cooking session (loads from cleaned_recipes)
    const session = await agent.startCookingSession(recipeId);

    console.log(`[Cooking V2 API] Session started: ${session.sessionId}`);

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
        voiceMode: session.voiceMode,
        plannedSteps: session.plannedSteps,
      },
    });
  } catch (error: any) {
    console.error('[Cooking V2 API] Start session failed:', error);
    res.status(500).json({
      error: 'SERVER_ERROR',
      message: error.message || 'Failed to start cooking session',
    });
  }
});

/**
 * GET /api/cooking/v2/session/:sessionId
 * Get session info
 */
router.get('/session/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const service = await getCookingServiceV2();
    const agent = service.getCookingAgent();

    const session = agent.getSession(sessionId);
    if (!session) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Session not found',
      });
    }

    const currentStep = agent.getCurrentStep(sessionId);

    res.json({
      success: true,
      session: {
        sessionId: session.sessionId,
        recipeId: session.recipeId,
        title: session.title,
        totalSteps: session.totalSteps,
        currentStepIndex: session.currentStepIndex,
        viewingStepIndex: session.viewingStepIndex,
        status: session.status,
        currentStep,
      },
    });
  } catch (error: any) {
    console.error('[Cooking V2 API] Get session failed:', error);
    res.status(500).json({
      error: 'SERVER_ERROR',
      message: error.message || 'Failed to get session',
    });
  }
});

/**
 * POST /api/cooking/v2/session/:sessionId/next
 * Move to next step
 */
router.post('/session/:sessionId/next', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const service = await getCookingServiceV2();
    const agent = service.getCookingAgent();

    const nextStep = await agent.nextStep(sessionId);

    res.json({
      success: true,
      nextStep,
      completed: nextStep === null,
    });
  } catch (error: any) {
    console.error('[Cooking V2 API] Next step failed:', error);
    res.status(500).json({
      error: 'SERVER_ERROR',
      message: error.message || 'Failed to move to next step',
    });
  }
});

/**
 * POST /api/cooking/v2/session/:sessionId/previous
 * Move to previous step
 */
router.post('/session/:sessionId/previous', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const service = await getCookingServiceV2();
    const agent = service.getCookingAgent();

    const previousStep = await agent.previousStep(sessionId);

    res.json({
      success: true,
      previousStep,
    });
  } catch (error: any) {
    console.error('[Cooking V2 API] Previous step failed:', error);
    res.status(500).json({
      error: 'SERVER_ERROR',
      message: error.message || 'Failed to move to previous step',
    });
  }
});

/**
 * POST /api/cooking/v2/session/:sessionId/voice-mode
 * Set voice mode
 * Body: { mode: 'none' | 'auto' | 'manual' }
 */
router.post('/session/:sessionId/voice-mode', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { mode } = req.body;

    if (!mode || !['none', 'auto', 'manual'].includes(mode)) {
      return res.status(400).json({
        error: 'BAD_REQUEST',
        message: 'Invalid mode. Must be one of: none, auto, manual',
      });
    }

    const service = await getCookingServiceV2();
    const agent = service.getCookingAgent();

    await agent.setVoiceMode(sessionId, mode);

    res.json({
      success: true,
      mode,
    });
  } catch (error: any) {
    console.error('[Cooking V2 API] Set voice mode failed:', error);
    res.status(500).json({
      error: 'SERVER_ERROR',
      message: error.message || 'Failed to set voice mode',
    });
  }
});

/**
 * POST /api/cooking/v2/session/:sessionId/end
 * End cooking session
 */
router.post('/session/:sessionId/end', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const service = await getCookingServiceV2();
    const agent = service.getCookingAgent();

    await agent.endSession(sessionId);

    console.log(`[Cooking V2 API] Session ended: ${sessionId}`);

    res.json({
      success: true,
      message: 'Session ended successfully',
    });
  } catch (error: any) {
    console.error('[Cooking V2 API] End session failed:', error);
    res.status(500).json({
      error: 'SERVER_ERROR',
      message: error.message || 'Failed to end session',
    });
  }
});

/**
 * GET /api/cooking/v2/session/:sessionId/history
 * Get session state history
 */
router.get('/session/:sessionId/history', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const limit = parseInt(req.query.limit as string) || 100;

    const service = await getCookingServiceV2();
    const agent = service.getCookingAgent();

    const history = await agent.getSessionHistory(sessionId);

    res.json({
      success: true,
      history: history.slice(0, limit),
    });
  } catch (error: any) {
    console.error('[Cooking V2 API] Get history failed:', error);
    res.status(500).json({
      error: 'SERVER_ERROR',
      message: error.message || 'Failed to get session history',
    });
  }
});

/**
 * GET /api/cooking/v2/health
 * Check cooking service health
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    if (!cookingServiceV2 || !cookingServiceV2.isInitialized()) {
      return res.status(503).json({
        status: 'initializing',
      });
    }

    res.json({
      status: 'healthy',
      version: 'v2',
    });
  } catch (error: any) {
    res.status(503).json({
      status: 'unhealthy',
      reason: error.message,
    });
  }
});

export default router;
export { getCookingServiceV2 };
