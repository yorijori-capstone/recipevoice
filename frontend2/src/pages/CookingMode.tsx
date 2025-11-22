/**
 * CookingMode Page
 * Main cooking session interface
 */

import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCookingSessionV3 } from '../hooks/useCookingSessionV3';
import { ProgressBar } from '../components/CookingUI/ProgressBar';
import { StepDisplay } from '../components/CookingUI/StepDisplay';
import { TimerDisplay, TimerDisplayRef } from '../components/CookingUI/TimerDisplay';
import { ControlButtons } from '../components/CookingUI/ControlButtons';
import { VoiceInteraction, VoiceInteractionRef } from '../components/CookingUI/VoiceInteraction';

export function CookingMode() {
  const { recipeId } = useParams<{ recipeId: string }>();
  const navigate = useNavigate();
  const timerRef = useRef<TimerDisplayRef>(null);
  const voiceRef = useRef<VoiceInteractionRef>(null);
  const timerTTSCalledRef = useRef(false); // Prevent duplicate TTS calls
  const [timerCompleteMessage, setTimerCompleteMessage] = useState<string | null>(null);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [showOpeningRemark, setShowOpeningRemark] = useState(true);

  const {
    session,
    loading,
    error,
    startSession,
    recoverSession,
    nextStep,
    previousStep,
    navigateNext,
    navigatePrevious,
    endSession,
    updateSessionState,
  } = useCookingSessionV3();

  useEffect(() => {
    if (!recipeId) {
      alert('레시피 ID가 없습니다.');
      navigate('/');
      return;
    }

    // Check if there's a saved session
    const savedSessionId = localStorage.getItem('yorijori_current_session_id');
    const savedRecipeId = localStorage.getItem('yorijori_current_recipe_id');

    if (savedSessionId && savedRecipeId === recipeId) {
      // Same recipe - try to recover session
      console.log('[CookingMode] Recovering session for same recipe:', recipeId);
      recoverSession(savedSessionId).catch((err) => {
        console.error('[CookingMode] Recovery failed, starting new session:', err);
        startSession(recipeId);
      });
    } else {
      // Different recipe or no saved session - start new session
      if (savedSessionId) {
        console.log('[CookingMode] Different recipe detected, clearing old session');
        localStorage.removeItem('yorijori_current_session_id');
        localStorage.removeItem('yorijori_current_recipe_id');
      }
      console.log('[CookingMode] Starting new session for recipe:', recipeId);
      startSession(recipeId).catch((err) => {
        console.error('Failed to start session:', err);
        alert('요리 세션을 시작할 수 없습니다.');
        navigate(`/recipe/${recipeId}`);
      });
    }

    // Cleanup on unmount
    return () => {
      endSession();
    };
  }, [recipeId]);

  // UI 확인용 (버튼 클릭) - viewingStepIndex만 이동
  const handleNext = () => {
    navigateNext();
  };

  const handlePrevious = () => {
    navigatePrevious();
  };

  const handleVoiceCommand = async (command: string) => {
    console.log(`[CookingMode] Voice command received: ${command}`);

    switch (command) {
      case 'next':
        // 음성: 실제 진행 단계 이동 (currentStepIndex)
        try {
          await nextStep();
        } catch (err) {
          console.error('Failed to move to next step:', err);
        }
        break;
      case 'previous':
        // 음성: 실제 진행 단계 이동 (currentStepIndex)
        try {
          await previousStep();
        } catch (err) {
          console.error('Failed to move to previous step:', err);
        }
        break;
      case 'start_timer':
        if (timerRef.current) {
          console.log('[CookingMode] Starting timer via voice command');
          timerRef.current.startTimer();
        }
        break;
      case 'stop_timer':
        if (timerRef.current) {
          console.log('[CookingMode] Stopping timer via voice command');
          timerRef.current.stopTimer();
        }
        break;
      case 'reset_timer':
        if (timerRef.current) {
          console.log('[CookingMode] Resetting timer via voice command');
          timerRef.current.resetTimer();
        }
        break;
      default:
        console.log('Unknown voice command:', command);
    }
  };

  const handleTimerComplete = () => {
    // Prevent duplicate TTS calls (React StrictMode or event bubbling)
    if (timerTTSCalledRef.current) {
      console.log('[CookingMode] Timer complete already handled, skipping duplicate');
      return;
    }
    timerTTSCalledRef.current = true;

    console.log('[CookingMode] Timer completed!');
    setTimerCompleteMessage('⏰ 타이머가 완료되었습니다!');

    // 🆕 AI에게 타이머 종료 상태 전달 (컨텍스트 업데이트)
    if (voiceRef.current && viewingStep) {
      voiceRef.current.sendTimerState({
        isRunning: false,
        isCompleted: true,
        remainingTime: 0,
        totalTime: viewingStep.estimated_time_sec,
      });
    }

    // TTS: AI가 타이머 완료를 알림
    setTimeout(() => {
      if (voiceRef.current) {
        voiceRef.current.speakMessage('타이머가 종료되었습니다.');
      }
    }, 500); // 500ms 지연으로 응답 충돌 방지

    // 5초 후 메시지 제거
    setTimeout(() => {
      setTimerCompleteMessage(null);
    }, 5000);
  };

  const handleTimerStart = () => {
    console.log('[CookingMode] Timer started');
    setTimerCompleteMessage(null);
    timerTTSCalledRef.current = false; // Reset flag when timer starts
  };

  const handleEndSession = async () => {
    const confirmed = window.confirm('요리를 종료하시겠습니까?');
    if (confirmed) {
      await endSession();
      navigate('/');
    }
  };

  // V3: Handle auto step change from MCP Tool Calling
  const handleStepAutoChanged = (data: any) => {
    console.log('[CookingMode] Step auto-changed by MCP Tool:', data);

    // Update local session state from MCP tool result
    if (data?.current_step_index !== undefined) {
      console.log(`✨ Auto-moved to step: ${data.current_step_index + 1}`);
      updateSessionState({
        currentStepIndex: data.current_step_index,
        viewingStepIndex: data.current_step_index,
      });
    }
  };

  // V3: Handle session state update from Server
  const handleSessionStateUpdated = (data: any) => {
    console.log('[CookingMode] Session state updated:', data);

    // Update local session state from WebSocket event
    updateSessionState({
      currentStepIndex: data.currentStepIndex,
      viewingStepIndex: data.viewingStepIndex,
      status: data.status,
    });
  };

  // Loading state
  if (loading && !session) {
    return (
      <div className="container mt-5 text-center">
        <div className="spinner-border text-primary" role="status" style={{ width: '3rem', height: '3rem' }}>
          <span className="visually-hidden">Loading...</span>
        </div>
        <p className="mt-3 text-muted">요리 세션을 준비하는 중...</p>
      </div>
    );
  }

  // Error state
  if (error && !session) {
    return (
      <div className="container mt-5">
        <div className="alert alert-danger">
          <h4 className="alert-heading">오류가 발생했습니다</h4>
          <p>{error}</p>
          <hr />
          <button className="btn btn-primary" onClick={() => navigate('/')}>
            홈으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  // No session or session not fully loaded
  if (!session || !session.plannedSteps || session.plannedSteps.length === 0) {
    return null;
  }

  // UI 확인용 단계
  const viewingStep = session.plannedSteps[session.viewingStepIndex];
  // 현재 보고 있는 단계가 실제 진행 단계인지 확인 (음성 상호작용 기준)
  const isViewingActualStep = session.currentStepIndex === session.viewingStepIndex;

  return (
    <div className="container my-4" style={{ padding: 'var(--spacing-4)' }}>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="mb-1">{session.title}</h2>
          <p className="text-muted mb-0">음성 가이드 요리 모드</p>
        </div>
        <button
          className="btn btn-outline-danger"
          onClick={handleEndSession}
        >
          <i className="bi bi-x-lg me-2"></i>
          종료
        </button>
      </div>

      {/* Opening Remark (Show at start) */}
      {showOpeningRemark && session.openingRemark && (
        <div className="alert alert-success alert-dismissible fade show mb-4" role="alert">
          <h5 className="alert-heading">
            <i className="bi bi-chat-dots-fill me-2"></i>
            AI 요리 가이드
          </h5>
          <p className="mb-0">{session.openingRemark}</p>
          <button
            type="button"
            className="btn-close"
            onClick={() => setShowOpeningRemark(false)}
            aria-label="Close"
          ></button>
        </div>
      )}

      {/* Progress Bar - 음성 상호작용 기준 실제 진행 단계 */}
      <ProgressBar
        currentStep={session.currentStepIndex + 1}
        totalSteps={session.totalSteps}
        status={session.status}
      />

      {/* Main Content */}
      {session.status === 'completed' ? (
        <div className="card shadow-lg">
          <div className="card-body text-center py-5">
            <h1 className="display-3">🎉</h1>
            <h2 className="mb-3">요리 완료!</h2>
            {session.closingRemark && (
              <div className="alert alert-success d-inline-block mb-4">
                <i className="bi bi-chat-dots-fill me-2"></i>
                {session.closingRemark}
              </div>
            )}
            {!session.closingRemark && (
              <p className="text-muted mb-4">
                모든 단계를 성공적으로 완료했습니다.
              </p>
            )}
            <div className="d-flex gap-2 justify-content-center">
              <button
                className="btn btn-primary"
                onClick={() => navigate('/')}
              >
                홈으로
              </button>
              <button
                className="btn btn-outline-primary"
                onClick={() => navigate(`/recipe/${recipeId}`)}
              >
                레시피 다시 보기
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div>
          {/* Step & Timer - Full Width for Mobile */}
          <div className="mb-4">
            {viewingStep && (
              <>
                {/* 현재 단계 표시 (음성 상호작용 기준 단계와 일치할 때만) */}
                {isViewingActualStep && (
                  <div className="alert alert-info mb-3">
                    <strong>📝 현재 단계</strong>
                  </div>
                )}

                <StepDisplay
                  step={viewingStep}
                  stepNumber={session.viewingStepIndex + 1}
                  totalSteps={session.totalSteps}
                />
                <div className="mt-4">
                  <TimerDisplay
                    ref={timerRef}
                    estimatedTimeSec={viewingStep.estimated_time_sec}
                    timerRequired={viewingStep.timer_required}
                    isPaused={session.status === 'paused'}
                    onTimeUp={handleTimerComplete}
                    onTimerStart={handleTimerStart}
                  />
                </div>

                {/* Timer Complete Message */}
                {timerCompleteMessage && (
                  <div className="alert alert-success alert-dismissible fade show mt-3" role="alert">
                    <strong>{timerCompleteMessage}</strong>
                    <button
                      type="button"
                      className="btn-close"
                      onClick={() => setTimerCompleteMessage(null)}
                      aria-label="Close"
                    ></button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Controls - Full Width for Mobile */}
          <div>
            <div>
              <ControlButtons
                status={session.status}
                currentStepIndex={session.viewingStepIndex}
                totalSteps={session.totalSteps}
                onPrevious={handlePrevious}
                onNext={handleNext}
                loading={loading}
              />

              {/* Quick Actions */}
              <div className="card shadow mt-3">
                <div className="card-header bg-secondary text-white">
                  <h6 className="mb-0">빠른 실행</h6>
                </div>
                <div className="card-body">
                  <div className="d-grid gap-2">
                    <button
                      className="btn btn-outline-primary btn-sm"
                      onClick={() => setShowPlanModal(true)}
                    >
                      📋 Planning 결과 보기
                    </button>
                    <button
                      className="btn btn-outline-secondary btn-sm"
                      onClick={handleEndSession}
                    >
                      🏠 요리 종료
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Voice Interaction Section */}
      {session.status !== 'completed' && session.sessionId && (
        <div className="row mt-4">
          <div className="col-12">
            <VoiceInteraction
              ref={voiceRef}
              key={session.sessionId}
              sessionId={session.sessionId}
              currentStepIndex={session.currentStepIndex}
              plannedSteps={session.plannedSteps}
              onCommandDetected={handleVoiceCommand}
              onStepAutoChanged={handleStepAutoChanged}
              onSessionStateUpdated={handleSessionStateUpdated}
            />
          </div>
        </div>
      )}

      {/* Planning Result Modal - V2에서는 cleaned_recipes에 저장되어 있음 */}
      {showPlanModal && (
        <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Planning 정보</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowPlanModal(false)}
                ></button>
              </div>
              <div className="modal-body">
                <p className="text-muted">
                  이 레시피는 V2 아키텍처를 사용하여 미리 계획되었습니다.
                </p>
                <ul>
                  <li>총 단계: {session.totalSteps}개</li>
                  <li>Cleaned Recipe ID: {session.cleanedRecipeId}</li>
                  <li>음성 최적화 스크립트 준비 완료</li>
                </ul>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowPlanModal(false)}
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
