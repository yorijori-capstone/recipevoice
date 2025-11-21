/**
 * useCookingSession Hook
 * Manages cooking session state and API calls
 */

import { useState, useCallback } from 'react';

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

export interface CookingSession {
  sessionId: string;
  recipeId: string;
  title: string;
  totalSteps: number;
  currentStepIndex: number; // 음성 상호작용 기준 실제 진행 단계
  viewingStepIndex: number; // UI에서 확인 중인 단계 (이전/다음 버튼으로 이동)
  status: 'planning' | 'active' | 'paused' | 'completed' | 'error';
  plannedSteps: PlannedStep[];
  planResult?: any; // Planning Service 원본 결과
  currentStep?: PlannedStep;
}

export interface UseCookingSessionReturn {
  session: CookingSession | null;
  loading: boolean;
  error: string | null;
  startSession: (recipeId: string) => Promise<void>;
  getSession: (sessionId: string) => Promise<void>;
  nextStep: () => Promise<void>; // 음성 상호작용 기준 실제 진행 (actualCurrentStepIndex 이동)
  previousStep: () => Promise<void>; // 음성 상호작용 기준 실제 진행 (actualCurrentStepIndex 이동)
  navigateNext: () => void; // UI 확인용 (viewingStepIndex만 이동)
  navigatePrevious: () => void; // UI 확인용 (viewingStepIndex만 이동)
  handleControl: (command: 'pause' | 'resume' | 'retry' | 'clarify') => Promise<void>;
  endSession: () => Promise<void>;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export function useCookingSession(): UseCookingSessionReturn {
  const [session, setSession] = useState<CookingSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Start a new cooking session
   */
  const startSession = useCallback(async (recipeId: string) => {
    setLoading(true);
    setError(null);

    try {
      console.log('[useCookingSession] Starting session for recipe:', recipeId);

      const response = await fetch(`${API_BASE_URL}/api/cooking/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ recipeId })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to start cooking session');
      }

      const data = await response.json();
      console.log('[useCookingSession] Session started:', data.session);

      // viewingStepIndex 초기화 (백엔드에 없으면 currentStepIndex로 설정)
      setSession({
        ...data.session,
        viewingStepIndex: data.session.viewingStepIndex ?? data.session.currentStepIndex
      });
    } catch (err: any) {
      console.error('[useCookingSession] Start session failed:', err);
      setError(err.message || 'Failed to start cooking session');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Get session info
   */
  const getSession = useCallback(async (sessionId: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/cooking/session/${sessionId}`);

      if (!response.ok) {
        throw new Error('Session not found');
      }

      const data = await response.json();
      setSession(data.session);
    } catch (err: any) {
      console.error('[useCookingSession] Get session failed:', err);
      setError(err.message || 'Failed to get session');
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Move to next step (음성 상호작용 기준 - actualCurrentStepIndex 이동)
   */
  const nextStep = useCallback(async () => {
    if (!session) {
      throw new Error('No active session');
    }

    if (session.currentStepIndex >= session.totalSteps - 1) {
      console.log('[useCookingSession] Already at last step');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/cooking/session/${session.sessionId}/next`,
        {
          method: 'POST'
        }
      );

      if (!response.ok) {
        throw new Error('Failed to move to next step');
      }

      const data = await response.json();

      if (data.completed) {
        // Session completed
        setSession({
          ...session,
          status: 'completed',
          currentStepIndex: session.totalSteps,
          viewingStepIndex: session.totalSteps
        });
      } else {
        // Update to next step + sync viewingStepIndex
        const newStepIndex = session.currentStepIndex + 1;
        setSession({
          ...session,
          currentStepIndex: newStepIndex,
          viewingStepIndex: newStepIndex, // 음성으로 단계 이동 시 viewing도 함께 이동
          currentStep: data.nextStep
        });
      }
    } catch (err: any) {
      console.error('[useCookingSession] Next step failed:', err);
      setError(err.message || 'Failed to move to next step');
    } finally {
      setLoading(false);
    }
  }, [session]);

  /**
   * Move to previous step (음성 상호작용 기준 - actualCurrentStepIndex 이동)
   */
  const previousStep = useCallback(async () => {
    if (!session) {
      throw new Error('No active session');
    }

    if (session.currentStepIndex <= 0) {
      console.log('[useCookingSession] Already at first step');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/cooking/session/${session.sessionId}/previous`,
        {
          method: 'POST'
        }
      );

      if (!response.ok) {
        throw new Error('Failed to move to previous step');
      }

      const data = await response.json();

      // Update to previous step with backend response + sync viewingStepIndex
      const newStepIndex = session.currentStepIndex - 1;
      setSession({
        ...session,
        currentStepIndex: newStepIndex,
        viewingStepIndex: newStepIndex, // 음성으로 단계 이동 시 viewing도 함께 이동
        currentStep: data.previousStep
      });

      console.log(`[useCookingSession] Moved to step ${newStepIndex + 1}`);
    } catch (err: any) {
      console.error('[useCookingSession] Previous step failed:', err);
      setError(err.message || 'Failed to move to previous step');
    } finally {
      setLoading(false);
    }
  }, [session]);

  /**
   * Navigate to next step (UI 확인용 - viewingStepIndex만 이동)
   */
  const navigateNext = useCallback(() => {
    if (!session) return;

    if (session.viewingStepIndex >= session.totalSteps - 1) {
      console.log('[useCookingSession] Already viewing last step');
      return;
    }

    setSession({
      ...session,
      viewingStepIndex: session.viewingStepIndex + 1
    });
    console.log(`[useCookingSession] Navigated to viewing step ${session.viewingStepIndex + 2}`);
  }, [session]);

  /**
   * Navigate to previous step (UI 확인용 - viewingStepIndex만 이동)
   */
  const navigatePrevious = useCallback(() => {
    if (!session) return;

    if (session.viewingStepIndex <= 0) {
      console.log('[useCookingSession] Already viewing first step');
      return;
    }

    setSession({
      ...session,
      viewingStepIndex: session.viewingStepIndex - 1
    });
    console.log(`[useCookingSession] Navigated to viewing step ${session.viewingStepIndex}`);
  }, [session]);

  /**
   * Handle control command
   */
  const handleControl = useCallback(
    async (command: 'pause' | 'resume' | 'retry' | 'clarify') => {
      if (!session) {
        throw new Error('No active session');
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `${API_BASE_URL}/api/cooking/session/${session.sessionId}/control`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ command })
          }
        );

        if (!response.ok) {
          throw new Error('Failed to handle control command');
        }

        const data = await response.json();
        console.log('[useCookingSession] Control command result:', data);

        // Update session status
        if (command === 'pause') {
          setSession({ ...session, status: 'paused' });
        } else if (command === 'resume') {
          setSession({ ...session, status: 'active' });
        }

        return data.result;
      } catch (err: any) {
        console.error('[useCookingSession] Control command failed:', err);
        setError(err.message || 'Failed to handle control command');
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [session]
  );

  /**
   * End cooking session
   */
  const endSession = useCallback(async () => {
    if (!session) {
      return;
    }

    try {
      await fetch(`${API_BASE_URL}/api/cooking/session/${session.sessionId}/end`, {
        method: 'POST'
      });

      setSession(null);
      setError(null);
    } catch (err: any) {
      console.error('[useCookingSession] End session failed:', err);
    }
  }, [session]);

  return {
    session,
    loading,
    error,
    startSession,
    getSession,
    nextStep,
    previousStep,
    navigateNext,
    navigatePrevious,
    handleControl,
    endSession
  };
}
