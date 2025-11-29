/**
 * CookingMode Page
 * Main cooking session interface
 */

import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCookingSessionV3 } from '../hooks/useCookingSessionV3';
import { ProgressBar } from '../components/CookingUI/ProgressBar';
import { TimerDisplay, TimerDisplayRef } from '../components/CookingUI/TimerDisplay';
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
  }, [recipeId]); // 원래대로 recipeId만 의존성

  // UI 버튼 클릭 - 로컬 상태만 변경 (원래 방식)
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
    // Support both snake_case (current_step_index) and camelCase (stepIndex)
    const newStepIndex = data?.current_step_index ?? data?.stepIndex;
    
    if (newStepIndex !== undefined) {
      console.log(`✨ Auto-moved to step: ${newStepIndex + 1}`);
      updateSessionState({
        currentStepIndex: newStepIndex,
        viewingStepIndex: newStepIndex,
      });
    }
  };

  // V3: Handle session state update from Server
  const handleSessionStateUpdated = (data: any) => {
    console.log('[CookingMode] Session state updated:', data);

    // Update local session state from WebSocket event
    updateSessionState({
      currentStepIndex: data.currentStepIndex,
      viewingStepIndex: data.viewingStepIndex, // 별도 관리
      status: data.status,
    });
  };

  // V3: Handle timer reset from Server
  const handleTimerReset = (data: { stepIndex: number; reason: string }) => {
    console.log('[CookingMode] Timer reset:', data);
    
    // Force reset timer when step changes
    if (timerRef.current) {
      console.log('[CookingMode] Forcing timer reset due to step change');
      timerRef.current.resetTimer();
    }
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

  console.log('[CookingMode] Render State:', {
    loading,
    error,
    hasSession: !!session,
    plannedSteps: session?.plannedSteps?.length,
    viewingStepIndex: session?.viewingStepIndex
  });

  // No session or session not fully loaded
  if (!session || !session.plannedSteps || session.plannedSteps.length === 0) {
    console.log('[CookingMode] Session data missing, showing fallback UI');
    return (
      <div className="container mt-5 text-center">
        <div className="spinner-border text-secondary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p className="mt-3 text-muted">세션 정보를 불러오는 중입니다...</p>
        <button className="btn btn-outline-primary mt-3" onClick={() => window.location.reload()}>
          새로고침
        </button>
      </div>
    );
  }

  // UI 확인용 단계
  const viewingStep = session.plannedSteps[session.viewingStepIndex];

  return (
    <div className="container my-4" style={{ padding: 'var(--spacing-4)' }}>
      {/* Mode Badge - Centered at top */}
      <div className="text-center mb-3">
        <span
          className="badge"
          style={{
            background: 'rgba(242, 98, 46, 0.15)',
            color: 'var(--color-primary-dark)',
            border: '1px solid var(--color-primary)',
            padding: 'var(--spacing-2) var(--spacing-4)',
            fontSize: 'var(--font-size-base)',
            fontWeight: 'var(--font-weight-semibold)',
          }}
        >
          🎙️ 음성 가이드 요리 모드
        </span>
      </div>

      {/* Header - RecipeDetail Style */}
      <div
        className="card mb-4"
        style={{
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <div className="card-body" style={{ padding: 'var(--spacing-5)' }}>
          <h1
            className="card-title mb-0"
            style={{
              fontSize: 'var(--font-size-2xl)',
              fontWeight: 'var(--font-weight-bold)',
            }}
          >
            {session.title}
          </h1>
        </div>
      </div>

      {/* Opening Remark with Help Tips */}
      {showOpeningRemark && session.openingRemark && (
        <div className="card mb-4" style={{ borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-card)' }}>
          <div className="card-body" style={{ padding: 'var(--spacing-4)' }}>
            <h5 className="mb-3" style={{ fontWeight: 'var(--font-weight-bold)' }}>
              <i className="bi bi-chat-dots-fill me-2"></i>
              AI 요리 가이드
            </h5>
            <p className="mb-3">{session.openingRemark}</p>

            {/* Help Tips moved here */}
            {viewingStep && (
              <details>
                <summary className="text-muted" style={{ cursor: 'pointer' }}>
                  💡 추가 도움말 보기
                </summary>
                <div className="mt-3 p-3 bg-light rounded">
                  <div className="mb-2">
                    <strong>다시 듣고 싶을 때:</strong>
                    <p className="mb-0 text-muted">{viewingStep.retry_script}</p>
                  </div>
                  <div className="mb-2">
                    <strong>이해가 어려울 때:</strong>
                    <p className="mb-0 text-muted">{viewingStep.fallback_script}</p>
                  </div>
                  <div>
                    <strong>잠시 멈출 때:</strong>
                    <p className="mb-0 text-muted">{viewingStep.pause_hint}</p>
                  </div>
                </div>
              </details>
            )}

            <button
              type="button"
              className="btn-close position-absolute top-0 end-0 m-3"
              onClick={() => setShowOpeningRemark(false)}
              aria-label="Close"
            ></button>
          </div>
        </div>
      )}

      {/* Voice Interaction Section */}
      {session.sessionId && (
        <div className="mb-4">
          <VoiceInteraction
            ref={voiceRef}
            key={session.sessionId}
            sessionId={session.sessionId}
            currentStepIndex={session.currentStepIndex}
            plannedSteps={session.plannedSteps}
            onCommandDetected={handleVoiceCommand}
            onStepAutoChanged={handleStepAutoChanged}
            onSessionStateUpdated={handleSessionStateUpdated}
            onTimerReset={handleTimerReset}
          />
        </div>
      )}

      {/* Progress Bar - UI 보기 기준 단계 */}
      <ProgressBar
        currentStep={session.viewingStepIndex + 1}
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
              <div className="alert d-inline-block mb-4" style={{ backgroundColor: 'rgba(242, 98, 46, 0.1)', borderColor: 'rgba(242, 98, 46, 0.2)', color: 'var(--color-primary-dark)' }}>
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
          {/* Voice Interaction Section - moved above */}

          {/* Step Display with Controls */}
          {viewingStep && (
            <div className="card shadow-lg mb-4">
              <div className="card-header text-white" style={{ background: 'var(--color-primary)' }}>
                <h4 className="mb-0" style={{ fontWeight: 'var(--font-weight-bold)' }}>
                  📝 현재 단계
                </h4>
              </div>
              <div className="card-body">
                <div className="mb-4">
                  <p className="fs-5 lh-lg">{viewingStep.script}</p>
                </div>

                {viewingStep.timer_required && (
                  <div className="alert d-flex align-items-center mb-4" style={{ backgroundColor: 'rgba(242, 98, 46, 0.1)', borderColor: 'rgba(242, 98, 46, 0.2)', color: 'var(--color-primary-dark)' }}>
                    <i className="bi bi-clock-fill me-2"></i>
                    <div>
                      <strong>예상 시간:</strong> {Math.floor(viewingStep.estimated_time_sec / 60)}분 {viewingStep.estimated_time_sec % 60}초
                      {viewingStep.timer_message && (
                        <div className="mt-1">
                          <small>{viewingStep.timer_message}</small>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Navigation Buttons */}
                <div className="d-flex gap-2 mb-3">
                  <button
                    className="btn btn-outline-secondary btn-lg flex-grow-1"
                    onClick={handlePrevious}
                    disabled={loading || session.viewingStepIndex === 0}
                  >
                    <i className="bi bi-chevron-left me-2"></i>
                    이전
                  </button>
                  <button
                    className="btn btn-primary btn-lg flex-grow-1"
                    onClick={handleNext}
                    disabled={loading || session.viewingStepIndex >= session.totalSteps - 1}
                  >
                    다음
                    <i className="bi bi-chevron-right ms-2"></i>
                  </button>
                </div>

                {/* Step Counter */}
                <div className="text-center mt-3">
                  <small className="text-muted">
                    {session.viewingStepIndex + 1} / {session.totalSteps} 단계
                  </small>
                </div>
              </div>
            </div>
          )}

          {/* Timer */}
          {viewingStep && (
            <div className="mb-4">
              <TimerDisplay
                ref={timerRef}
                estimatedTimeSec={viewingStep.estimated_time_sec}
                timerRequired={viewingStep.timer_required}
                isPaused={session.status === 'paused'}
                onTimeUp={handleTimerComplete}
                onTimerStart={handleTimerStart}
              />
            </div>
          )}

          {/* Timer Complete Message */}
          {timerCompleteMessage && (
            <div className="alert alert-dismissible fade show" role="alert" style={{ backgroundColor: 'rgba(242, 98, 46, 0.1)', borderColor: 'rgba(242, 98, 46, 0.2)', color: 'var(--color-primary-dark)' }}>
              <strong>{timerCompleteMessage}</strong>
              <button
                type="button"
                className="btn-close"
                onClick={() => setTimerCompleteMessage(null)}
                aria-label="Close"
              ></button>
            </div>
          )}
        </div>
      )}

      {/* End Session Button */}
      {session.status !== 'completed' && (
        <div className="text-center mt-4">
          <button
            className="btn btn-outline-secondary btn-lg"
            onClick={() => navigate(`/recipe/${recipeId}`)}
          >
            🏠 음성 안내 종료
          </button>
        </div>
      )}





      {/* Planning Result Modal - V3에서는 cleaned_recipes에 저장되어 있음 */}
      {
        showPlanModal && (
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
                    이 레시피는 V3 아키텍처(MCP Tool Calling)를 사용하여 미리 계획되었습니다.
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
        )
      }
    </div >
  );
}
