/**
 * TimerDisplay Component
 * Countdown timer for cooking steps
 */

import { useState, useEffect, useImperativeHandle, forwardRef, useRef } from 'react';

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

// Dramatic alarm sound using Web Audio API
const playAlarmSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

    // Play a note with specified parameters
    const playNote = (startTime: number, frequency: number, duration: number, volume: number = 0.5, type: OscillatorType = 'sine') => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = frequency;
      oscillator.type = type;

      gainNode.gain.setValueAtTime(volume, startTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

      oscillator.start(startTime);
      oscillator.stop(startTime + duration);
    };

    const now = audioContext.currentTime;

    // 🎵 Dramatic Victory Fanfare! (약 2초)
    // Part 1: Rising arpeggio (C-E-G-C)
    playNote(now, 523.25, 0.15, 0.4, 'triangle');        // C5
    playNote(now + 0.12, 659.25, 0.15, 0.45, 'triangle'); // E5
    playNote(now + 0.24, 783.99, 0.15, 0.5, 'triangle');  // G5
    playNote(now + 0.36, 1046.50, 0.25, 0.55, 'triangle'); // C6

    // Part 2: Triumphant chord (sustained)
    playNote(now + 0.6, 523.25, 0.5, 0.3, 'sine');   // C5
    playNote(now + 0.6, 659.25, 0.5, 0.3, 'sine');   // E5
    playNote(now + 0.6, 783.99, 0.5, 0.3, 'sine');   // G5
    playNote(now + 0.6, 1046.50, 0.5, 0.4, 'sine');  // C6

    // Part 3: Final celebration beeps
    playNote(now + 1.2, 1318.51, 0.12, 0.5, 'square');  // E6 - beep!
    playNote(now + 1.35, 1318.51, 0.12, 0.5, 'square'); // E6 - beep!
    playNote(now + 1.5, 1567.98, 0.4, 0.6, 'square');   // G6 - BEEEEP!

    console.log('[TimerDisplay] 🎉 Dramatic alarm sound played!');
  } catch (error) {
    console.error('[TimerDisplay] Failed to play alarm sound:', error);
  }
};

export const TimerDisplay = forwardRef<TimerDisplayRef, TimerDisplayProps>(({
  estimatedTimeSec,
  timerRequired,
  isPaused = false,
  onTimeUp,
  onTimerStart
}, ref) => {
  const [remainingTime, setRemainingTime] = useState(estimatedTimeSec);
  const [isRunning, setIsRunning] = useState(false);
  const hasCalledOnTimeUp = useRef(false); // Prevent duplicate calls

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
    hasCalledOnTimeUp.current = false; // Reset flag on step change
  }, [estimatedTimeSec]);

  useEffect(() => {
    if (!isRunning || isPaused || remainingTime <= 0) {
      return;
    }

    const interval = setInterval(() => {
      setRemainingTime((prev) => {
        if (prev <= 1) {
          setIsRunning(false);

          // Prevent duplicate onTimeUp calls
          if (!hasCalledOnTimeUp.current) {
            hasCalledOnTimeUp.current = true;

            // Play alarm sound
            playAlarmSound();

            // Call onTimeUp callback
            if (onTimeUp) {
              onTimeUp();
            }
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
    if (percentage < 50) return 'bg-primary';
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
      <div className="card-header text-white" style={{ background: 'var(--color-primary)' }}>
        <h5 className="mb-0">⏱️ 타이머</h5>
      </div>
      <div className="card-body">
        {/* Timer Display */}
        <div className="text-center mb-4">
          <div
            className="display-3 fw-bold"
            style={{
              fontFamily: 'monospace',
              color: remainingTime <= 10 ? '#dc3545' : 'var(--color-primary)',
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
            className={`progress-bar progress-bar-striped ${isRunning && !isPaused ? 'progress-bar-animated' : ''
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
        <div className="d-flex gap-2">
          {!isRunning ? (
            <button
              className="btn btn-primary flex-grow-1"
              onClick={() => setIsRunning(true)}
              disabled={remainingTime === 0}
            >
              <i className="bi bi-play-fill me-2"></i>
              시작
            </button>
          ) : (
            <button
              className="btn btn-primary flex-grow-1"
              disabled
            >
              <i className="bi bi-play-fill me-2"></i>
              동작 중
            </button>
          )}

          <button
            className="btn btn-warning flex-grow-1"
            onClick={() => setIsRunning(false)}
            disabled={!isRunning}
          >
            <i className="bi bi-pause-fill me-2"></i>
            중지
          </button>

          <button
            className="btn btn-outline-secondary flex-grow-1"
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
          <div className="alert mt-3 mb-0" style={{ backgroundColor: 'rgba(242, 98, 46, 0.1)', borderColor: 'rgba(242, 98, 46, 0.2)', color: 'var(--color-primary-dark)' }}>
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
