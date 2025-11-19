/**
 * CookingMode Page
 * Main cooking session interface
 */

import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCookingSession } from '../hooks/useCookingSession';
import { Navbar } from '../components/Navbar';
import { ProgressBar } from '../components/CookingUI/ProgressBar';
import { StepDisplay } from '../components/CookingUI/StepDisplay';
import { TimerDisplay } from '../components/CookingUI/TimerDisplay';
import { ControlButtons } from '../components/CookingUI/ControlButtons';

export function CookingMode() {
  const { recipeId } = useParams<{ recipeId: string }>();
  const navigate = useNavigate();
  const {
    session,
    loading,
    error,
    startSession,
    nextStep,
    handleControl,
    endSession
  } = useCookingSession();

  useEffect(() => {
    if (!recipeId) {
      alert('레시피 ID가 없습니다.');
      navigate('/');
      return;
    }

    // Start cooking session
    startSession(recipeId).catch((err) => {
      console.error('Failed to start session:', err);
      alert('요리 세션을 시작할 수 없습니다.');
      navigate(`/recipe/${recipeId}`);
    });

    // Cleanup on unmount
    return () => {
      endSession();
    };
  }, [recipeId]);

  const handleNext = async () => {
    try {
      await nextStep();
    } catch (err) {
      console.error('Failed to move to next step:', err);
      alert('다음 단계로 이동할 수 없습니다.');
    }
  };

  const handlePause = async () => {
    try {
      await handleControl('pause');
    } catch (err) {
      console.error('Failed to pause:', err);
    }
  };

  const handleResume = async () => {
    try {
      await handleControl('resume');
    } catch (err) {
      console.error('Failed to resume:', err);
    }
  };

  const handleRetry = async () => {
    try {
      await handleControl('retry');
    } catch (err) {
      console.error('Failed to retry:', err);
    }
  };

  const handleClarify = async () => {
    try {
      await handleControl('clarify');
    } catch (err) {
      console.error('Failed to clarify:', err);
    }
  };

  const handleEndSession = async () => {
    const confirmed = window.confirm('요리를 종료하시겠습니까?');
    if (confirmed) {
      await endSession();
      navigate('/');
    }
  };

  // Loading state
  if (loading && !session) {
    return (
      <>
        <Navbar />
        <div className="container mt-5 text-center">
          <div className="spinner-border text-primary" role="status" style={{ width: '3rem', height: '3rem' }}>
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-3 text-muted">요리 세션을 준비하는 중...</p>
        </div>
      </>
    );
  }

  // Error state
  if (error && !session) {
    return (
      <>
        <Navbar />
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
      </>
    );
  }

  // No session
  if (!session) {
    return null;
  }

  const currentStep = session.plannedSteps[session.currentStepIndex];

  return (
    <>
      <Navbar />
      <div className="container my-4">
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

        {/* Progress Bar */}
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
              <p className="text-muted mb-4">
                모든 단계를 성공적으로 완료했습니다.
              </p>
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
          <div className="row">
            {/* Left Column: Step & Timer */}
            <div className="col-md-8 mb-4">
              {currentStep && (
                <>
                  <StepDisplay
                    step={currentStep}
                    stepNumber={session.currentStepIndex + 1}
                    totalSteps={session.totalSteps}
                  />
                  <div className="mt-4">
                    <TimerDisplay
                      estimatedTimeSec={currentStep.estimated_time_sec}
                      timerRequired={currentStep.timer_required}
                      isPaused={session.status === 'paused'}
                    />
                  </div>
                </>
              )}
            </div>

            {/* Right Column: Controls */}
            <div className="col-md-4">
              <div className="position-sticky" style={{ top: '20px' }}>
                <ControlButtons
                  status={session.status}
                  onPause={handlePause}
                  onResume={handleResume}
                  onRetry={handleRetry}
                  onClarify={handleClarify}
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
                        onClick={() => navigate(`/recipe/${recipeId}`)}
                      >
                        📖 레시피 보기
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
      </div>
    </>
  );
}
