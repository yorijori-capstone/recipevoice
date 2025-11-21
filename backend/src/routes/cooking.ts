/**
 * Cooking API Routes
 * Endpoints for cooking mode sessions
 */

import express, { Request, Response } from 'express';
import { getCookingService } from '../services/cookingService.js';
import { CookingAgent } from '../agents/cookingAgent.js';

const router = express.Router();

// Store active agents per session
const activeAgents = new Map<string, CookingAgent>();

/**
 * POST /api/cooking/start
 * Start a new cooking session
 * Body: { recipeId: string }
 */
router.post('/start', async (req: Request, res: Response) => {
  try {
    const { recipeId } = req.body;

    if (!recipeId) {
      return res.status(400).json({
        error: 'BAD_REQUEST',
        message: 'recipeId is required'
      });
    }

    console.log(`[Cooking API] Starting session for recipe: ${recipeId}`);

    // Get cooking service
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: 'SERVER_ERROR',
        message: 'OpenAI API key not configured'
      });
    }

    const cookingService = getCookingService(apiKey);

    // Initialize if needed
    if (!cookingService.isReady()) {
      await cookingService.initialize();
    }

    // Fetch recipe data
    const recipeData = await cookingService.getRecipeData(recipeId);

    // Create agent
    const agent = cookingService.createAgent();
    await agent.connect();

    // Start cooking session
    const session = await agent.startCookingSession(recipeId, recipeData);

    // Store agent
    activeAgents.set(session.sessionId, agent);

    // Register agent in CookingService for WebSocket access
    cookingService.registerAgent(session.sessionId, agent);

    console.log(`[Cooking API] Session started: ${session.sessionId}`);
    console.log('[Cooking API] Sending session with planResult:', {
      hasPlannedResult: !!session.planResult,
      title: session.planResult?.title || session.recipe.title
    });

    res.json({
      success: true,
      session: {
        sessionId: session.sessionId,
        recipeId: session.recipeId,
        title: session.recipe.title,
        totalSteps: session.plannedSteps.length,
        currentStepIndex: session.currentStepIndex,
        status: session.status,
        plannedSteps: session.plannedSteps,
        planResult: session.planResult // Planning Service 원본 결과 포함
      }
    });
  } catch (error: any) {
    console.error('[Cooking API] Start session failed:', error);
    res.status(500).json({
      error: 'SERVER_ERROR',
      message: error.message || 'Failed to start cooking session'
    });
  }
});

/**
 * GET /api/cooking/session/:sessionId
 * Get session info
 */
router.get('/session/:sessionId', (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const agent = activeAgents.get(sessionId);
    if (!agent) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Session not found'
      });
    }

    const session = agent.getSession(sessionId);
    if (!session) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Session not found'
      });
    }

    res.json({
      success: true,
      session: {
        sessionId: session.sessionId,
        recipeId: session.recipeId,
        title: session.recipe.title,
        totalSteps: session.plannedSteps.length,
        currentStepIndex: session.currentStepIndex,
        status: session.status,
        currentStep: agent.getCurrentStep(sessionId)
      }
    });
  } catch (error: any) {
    console.error('[Cooking API] Get session failed:', error);
    res.status(500).json({
      error: 'SERVER_ERROR',
      message: error.message || 'Failed to get session'
    });
  }
});

/**
 * POST /api/cooking/session/:sessionId/next
 * Move to next step
 */
router.post('/session/:sessionId/next', (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const agent = activeAgents.get(sessionId);
    if (!agent) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Session not found'
      });
    }

    const nextStep = agent.nextStep(sessionId);

    res.json({
      success: true,
      nextStep,
      completed: nextStep === null
    });
  } catch (error: any) {
    console.error('[Cooking API] Next step failed:', error);
    res.status(500).json({
      error: 'SERVER_ERROR',
      message: error.message || 'Failed to move to next step'
    });
  }
});

/**
 * POST /api/cooking/session/:sessionId/previous
 * Move to previous step
 */
router.post('/session/:sessionId/previous', (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const agent = activeAgents.get(sessionId);
    if (!agent) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Session not found'
      });
    }

    const previousStep = agent.previousStep(sessionId);

    res.json({
      success: true,
      previousStep
    });
  } catch (error: any) {
    console.error('[Cooking API] Previous step failed:', error);
    res.status(500).json({
      error: 'SERVER_ERROR',
      message: error.message || 'Failed to move to previous step'
    });
  }
});

/**
 * POST /api/cooking/session/:sessionId/control
 * Handle control command (pause/resume/retry/clarify)
 * Body: { command: string }
 */
router.post('/session/:sessionId/control', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { command } = req.body;

    if (!command || !['pause', 'resume', 'retry', 'clarify'].includes(command)) {
      return res.status(400).json({
        error: 'BAD_REQUEST',
        message: 'Invalid command. Must be one of: pause, resume, retry, clarify'
      });
    }

    const agent = activeAgents.get(sessionId);
    if (!agent) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Session not found'
      });
    }

    const result = await agent.handleControl(sessionId, command);

    res.json({
      success: true,
      command,
      result
    });
  } catch (error: any) {
    console.error('[Cooking API] Control command failed:', error);
    res.status(500).json({
      error: 'SERVER_ERROR',
      message: error.message || 'Failed to handle control command'
    });
  }
});

/**
 * POST /api/cooking/session/:sessionId/end
 * End cooking session
 */
router.post('/session/:sessionId/end', (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const agent = activeAgents.get(sessionId);
    if (!agent) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Session not found'
      });
    }

    agent.endSession(sessionId);
    agent.disconnect();
    activeAgents.delete(sessionId);

    console.log(`[Cooking API] Session ended: ${sessionId}`);

    res.json({
      success: true,
      message: 'Session ended successfully'
    });
  } catch (error: any) {
    console.error('[Cooking API] End session failed:', error);
    res.status(500).json({
      error: 'SERVER_ERROR',
      message: error.message || 'Failed to end session'
    });
  }
});

/**
 * GET /api/cooking/health
 * Check cooking service health
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(503).json({
        status: 'unhealthy',
        reason: 'OpenAI API key not configured'
      });
    }

    const cookingService = getCookingService(apiKey);
    const isReady = cookingService.isReady();

    res.json({
      status: isReady ? 'healthy' : 'initializing',
      activeSessions: activeAgents.size
    });
  } catch (error: any) {
    res.status(503).json({
      status: 'unhealthy',
      reason: error.message
    });
  }
});

export default router;
