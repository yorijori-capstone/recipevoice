/**
 * TimerDisplay Component
 * Countdown timer for cooking steps
 */

import { useState, useEffect, useImperativeHandle, forwardRef } from 'react';

interface TimerDisplayProps {
  estimatedTimeSec: number;
  timerRequired: boolean;
  isPaused?: boolean;
  onTimeUp?: () => void;
  onTimerStart?: () => void;
}

export interface TimerDisplayRef {
  startTimer: () => void;
  stopTimer: () => void;
  resetTimer: () => void;
  isRunning: boolean;
  remainingTime: number;
}

export const TimerDisplay = forwardRef<TimerDisplayRef, TimerDisplayProps>(({
  estimatedTimeSec,
  timerRequired,
  isPaused = false,
  onTimeUp,
  onTimerStart
}, ref) => {
  const [remainingTime, setRemainingTime] = useState(estimatedTimeSec);
  const [isRunning, setIsRunning] = useState(false);

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    startTimer: () => {
      if (remainingTime > 0) {
        setIsRunning(true);
        if (onTimerStart) {
          onTimerStart();
        }
      }
    },
    stopTimer: () => setIsRunning(false),
    resetTimer: () => {
      setRemainingTime(estimatedTimeSec);
      setIsRunning(false);
    },
    isRunning,
    remainingTime
  }), [remainingTime, isRunning, estimatedTimeSec, onTimerStart]);

  // Reset timer when estimatedTimeSec changes (step change)
  useEffect(() => {
    console.log('[TimerDisplay] Step changed, resetting timer');
    setRemainingTime(estimatedTimeSec);
    setIsRunning(false);
  }, [estimatedTimeSec]);

  useEffect(() => {
    if (!isRunning || isPaused || remainingTime <= 0) {
      return;
    }

    const interval = setInterval(() => {
      setRemainingTime((prev) => {
        if (prev <= 1) {
          setIsRunning(false);
          if (onTimeUp) {
            onTimeUp();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, isPaused, remainingTime, onTimeUp]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getProgressPercentage = (): number => {
    return ((estimatedTimeSec - remainingTime) / estimatedTimeSec) * 100;
  };

  const getProgressColor = (): string => {
    const percentage = getProgressPercentage();
    if (percentage < 50) return 'bg-success';
    if (percentage < 80) return 'bg-warning';
    return 'bg-danger';
  };

  if (!timerRequired) {
    return (
      <div className="card shadow">
        <div className="card-body text-center py-4">
          <i className="bi bi-hourglass-split text-muted" style={{ fontSize: '2rem' }}></i>
          <p className="text-muted mt-2 mb-0">타이머가 필요하지 않은 단계입니다</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card shadow">
      <div className="card-header bg-info text-white">
        <h5 className="mb-0">⏱️ 타이머</h5>
      </div>
      <div className="card-body">
        {/* Timer Display */}
        <div className="text-center mb-4">
          <div
            className="display-3 fw-bold"
            style={{
              color: remainingTime <= 10 ? '#dc3545' : '#0d6efd',
              fontFamily: 'monospace'
            }}
          >
            {formatTime(remainingTime)}
          </div>
          <p className="text-muted mb-0">
            예상 시간: {formatTime(estimatedTimeSec)}
          </p>
        </div>

        {/* Progress Bar */}
        <div className="progress mb-3" style={{ height: '20px' }}>
          <div
            className={`progress-bar progress-bar-striped ${
              isRunning && !isPaused ? 'progress-bar-animated' : ''
            } ${getProgressColor()}`}
            role="progressbar"
            style={{ width: `${getProgressPercentage()}%` }}
            aria-valuenow={getProgressPercentage()}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            {Math.round(getProgressPercentage())}%
          </div>
        </div>

        {/* Controls */}
        <div className="d-grid gap-2">
          {!isRunning ? (
            <button
              className="btn btn-primary"
              onClick={() => setIsRunning(true)}
              disabled={remainingTime === 0}
            >
              <i className="bi bi-play-fill me-2"></i>
              시작
            </button>
          ) : (
            <button
              className="btn btn-warning"
              onClick={() => setIsRunning(false)}
            >
              <i className="bi bi-pause-fill me-2"></i>
              일시정지
            </button>
          )}

          <button
            className="btn btn-outline-secondary"
            onClick={() => {
              setRemainingTime(estimatedTimeSec);
              setIsRunning(false);
            }}
          >
            <i className="bi bi-arrow-clockwise me-2"></i>
            초기화
          </button>
        </div>

        {/* Status */}
        {remainingTime === 0 && (
          <div className="alert alert-success mt-3 mb-0">
            <i className="bi bi-check-circle-fill me-2"></i>
            시간이 완료되었습니다!
          </div>
        )}

        {isPaused && isRunning && (
          <div className="alert alert-warning mt-3 mb-0">
            <i className="bi bi-pause-circle-fill me-2"></i>
            타이머가 일시정지되었습니다
          </div>
        )}
      </div>
    </div>
  );
});
