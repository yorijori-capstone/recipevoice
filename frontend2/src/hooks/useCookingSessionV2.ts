/**
 * useCookingSessionV2 Hook
 * Manages cooking session state using V2 API with session recovery
 */

import { useState, useCallback, useEffect } from 'react';

export interface PlannedStep {
  order: number;
  script: string;
  retry_script: string;
  pause_hint: string;
  fallback_script: string;
  estimated_time_sec: number;
  timer_required: boolean;
  timer_message: string;
}

export interface CookingSessionV2 {
  sessionId: string;
  recipeId: string;
  cleanedRecipeId: number;
  title: string;
  openingRemark: string;
  closingRemark?: string;
  totalSteps: number;
  currentStepIndex: number;
  viewingStepIndex: number;
  status: 'active' | 'paused' | 'completed' | 'error';
  voiceMode: 'none' | 'auto' | 'manual';
  plannedSteps: PlannedStep[];
  currentStep?: PlannedStep;
}

export interface UseCookingSessionV2Return {
  session: CookingSessionV2 | null;
  loading: boolean;
  error: string | null;
  startSession: (recipeId: string) => Promise<void>;
  recoverSession: (sessionId: string) => Promise<boolean>;
  getSession: (sessionId: string) => Promise<void>;
  nextStep: () => Promise<void>;
  previousStep: () => Promise<void>;
  navigateNext: () => void;
  navigatePrevious: () => void;
  setVoiceMode: (mode: 'none' | 'auto' | 'manual') => Promise<void>;
  endSession: () => Promise<void>;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const SESSION_STORAGE_KEY = 'yorijori_current_session_id';
const SESSION_RECIPE_KEY = 'yorijori_current_recipe_id';

export function useCookingSessionV2(): UseCookingSessionV2Return {
  const [session, setSession] = useState<CookingSessionV2 | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Save session ID to localStorage for recovery
   */
  const saveSessionId = useCallback((sessionId: string, recipeId: string) => {
    localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
    localStorage.setItem(SESSION_RECIPE_KEY, recipeId);
  }, []);

  /**
   * Clear saved session ID
   */
  const clearSessionId = useCallback(() => {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    localStorage.removeItem(SESSION_RECIPE_KEY);
  }, []);

  /**
   * Start a new cooking session using V2 API
   */
  const startSession = useCallback(async (recipeId: string) => {
    setLoading(true);
    setError(null);

    try {
      console.log('[useCookingSessionV2] Starting session for recipe:', recipeId);

      const response = await fetch(`${API_BASE_URL}/api/cooking/v2/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ recipeId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to start cooking session');
      }

      const data = await response.json();
      console.log('[useCookingSessionV2] Session started:', data.session);

      setSession(data.session);
      saveSessionId(data.session.sessionId, recipeId);
    } catch (err: any) {
      console.error('[useCookingSessionV2] Start session failed:', err);
      setError(err.message || 'Failed to start cooking session');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [saveSessionId]);

  /**
   * Recover session from sessionId (for page refresh)
   */
  const recoverSession = useCallback(async (sessionId: string): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      console.log('[useCookingSessionV2] Recovering session:', sessionId);

      const response = await fetch(`${API_BASE_URL}/api/cooking/v2/session/${sessionId}`);

      if (!response.ok) {
        if (response.status === 404) {
          console.log('[useCookingSessionV2] Session not found');
          clearSessionId();
          return false;
        }
        throw new Error('Failed to recover session');
      }

      const data = await response.json();
      console.log('[useCookingSessionV2] Session recovered:', data.session);

      setSession(data.session);
      saveSessionId(sessionId, data.session.recipeId);
      return true;
    } catch (err: any) {
      console.error('[useCookingSessionV2] Recover session failed:', err);
      setError(err.message || 'Failed to recover session');
      clearSessionId();
      return false;
    } finally {
      setLoading(false);
    }
  }, [saveSessionId, clearSessionId]);

  /**
   * Get session info
   */
  const getSession = useCallback(async (sessionId: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/cooking/v2/session/${sessionId}`);

      if (!response.ok) {
        throw new Error('Failed to get session');
      }

      const data = await response.json();
      setSession(data.session);
    } catch (err: any) {
      console.error('[useCookingSessionV2] Get session failed:', err);
      setError(err.message || 'Failed to get session');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Move to next step (updates both current and viewing)
   */
  const nextStep = useCallback(async () => {
    if (!session) {
      console.error('[useCookingSessionV2] No active session');
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/cooking/v2/session/${session.sessionId}/next`,
        {
          method: 'POST',
        }
      );

      if (!response.ok) {
        throw new Error('Failed to move to next step');
      }

      const data = await response.json();

      if (data.completed) {
        console.log('[useCookingSessionV2] Recipe completed!');
        setSession((prev) =>
          prev
            ? {
                ...prev,
                status: 'completed',
              }
            : null
        );
      } else {
        // Update local state
        setSession((prev) =>
          prev
            ? {
                ...prev,
                currentStepIndex: prev.currentStepIndex + 1,
                viewingStepIndex: prev.currentStepIndex + 1,
                currentStep: data.nextStep,
              }
            : null
        );
      }
    } catch (err: any) {
      console.error('[useCookingSessionV2] Next step failed:', err);
      setError(err.message || 'Failed to move to next step');
      throw err;
    }
  }, [session]);

  /**
   * Move to previous step (updates both current and viewing)
   */
  const previousStep = useCallback(async () => {
    if (!session) {
      console.error('[useCookingSessionV2] No active session');
      return;
    }

    if (session.currentStepIndex === 0) {
      console.log('[useCookingSessionV2] Already at first step');
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/cooking/v2/session/${session.sessionId}/previous`,
        {
          method: 'POST',
        }
      );

      if (!response.ok) {
        throw new Error('Failed to move to previous step');
      }

      const data = await response.json();

      // Update local state
      setSession((prev) =>
        prev
          ? {
              ...prev,
              currentStepIndex: prev.currentStepIndex - 1,
              viewingStepIndex: prev.currentStepIndex - 1,
              currentStep: data.previousStep,
            }
          : null
      );
    } catch (err: any) {
      console.error('[useCookingSessionV2] Previous step failed:', err);
      setError(err.message || 'Failed to move to previous step');
      throw err;
    }
  }, [session]);

  /**
   * Navigate to next step (UI only - doesn't update server)
   */
  const navigateNext = useCallback(() => {
    if (!session) return;

    if (session.viewingStepIndex < session.totalSteps - 1) {
      setSession((prev) =>
        prev
          ? {
              ...prev,
              viewingStepIndex: prev.viewingStepIndex + 1,
            }
          : null
      );
    }
  }, [session]);

  /**
   * Navigate to previous step (UI only - doesn't update server)
   */
  const navigatePrevious = useCallback(() => {
    if (!session) return;

    if (session.viewingStepIndex > 0) {
      setSession((prev) =>
        prev
          ? {
              ...prev,
              viewingStepIndex: prev.viewingStepIndex - 1,
            }
          : null
      );
    }
  }, [session]);

  /**
   * Set voice mode
   */
  const setVoiceMode = useCallback(
    async (mode: 'none' | 'auto' | 'manual') => {
      if (!session) {
        console.error('[useCookingSessionV2] No active session');
        return;
      }

      try {
        const response = await fetch(
          `${API_BASE_URL}/api/cooking/v2/session/${session.sessionId}/voice-mode`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ mode }),
          }
        );

        if (!response.ok) {
          throw new Error('Failed to set voice mode');
        }

        setSession((prev) =>
          prev
            ? {
                ...prev,
                voiceMode: mode,
              }
            : null
        );

        console.log('[useCookingSessionV2] Voice mode updated:', mode);
      } catch (err: any) {
        console.error('[useCookingSessionV2] Set voice mode failed:', err);
        setError(err.message || 'Failed to set voice mode');
        throw err;
      }
    },
    [session]
  );

  /**
   * End cooking session
   */
  const endSession = useCallback(async () => {
    if (!session) return;

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/cooking/v2/session/${session.sessionId}/end`,
        {
          method: 'POST',
        }
      );

      if (!response.ok) {
        throw new Error('Failed to end session');
      }

      setSession(null);
      clearSessionId();
      console.log('[useCookingSessionV2] Session ended');
    } catch (err: any) {
      console.error('[useCookingSessionV2] End session failed:', err);
      setError(err.message || 'Failed to end session');
      throw err;
    }
  }, [session, clearSessionId]);

  /**
   * Auto-recovery on mount - DISABLED
   * Recovery is now handled by CookingMode component to check recipeId match
   */
  useEffect(() => {
    // Auto-recovery disabled - CookingMode will handle this
    // This prevents recovery of wrong recipe session when navigating between recipes
  }, []);

  return {
    session,
    loading,
    error,
    startSession,
    recoverSession,
    getSession,
    nextStep,
    previousStep,
    navigateNext,
    navigatePrevious,
    setVoiceMode,
    endSession,
  };
}
