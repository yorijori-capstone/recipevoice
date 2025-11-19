/**
 * ControlButtons Component
 * Control buttons for cooking session (pause, resume, retry, clarify, next)
 */

import React from 'react';

interface ControlButtonsProps {
  status: 'planning' | 'active' | 'paused' | 'completed' | 'error';
  onPause: () => void;
  onResume: () => void;
  onRetry: () => void;
  onClarify: () => void;
  onNext: () => void;
  loading?: boolean;
}

export function ControlButtons({
  status,
  onPause,
  onResume,
  onRetry,
  onClarify,
  onNext,
  loading = false
}: ControlButtonsProps) {
  return (
    <div className="card shadow">
      <div className="card-header bg-dark text-white">
        <h5 className="mb-0">🎮 제어</h5>
      </div>
      <div className="card-body">
        <div className="row g-2">
          {/* Pause/Resume */}
          <div className="col-6">
            {status === 'paused' ? (
              <button
                className="btn btn-success w-100"
                onClick={onResume}
                disabled={loading}
              >
                <i className="bi bi-play-fill me-2"></i>
                계속
              </button>
            ) : (
              <button
                className="btn btn-warning w-100"
                onClick={onPause}
                disabled={loading || status !== 'active'}
              >
                <i className="bi bi-pause-fill me-2"></i>
                멈춰
              </button>
            )}
          </div>

          {/* Retry */}
          <div className="col-6">
            <button
              className="btn btn-info w-100"
              onClick={onRetry}
              disabled={loading || status === 'paused'}
            >
              <i className="bi bi-arrow-repeat me-2"></i>
              다시
            </button>
          </div>

          {/* Clarify */}
          <div className="col-6">
            <button
              className="btn btn-secondary w-100"
              onClick={onClarify}
              disabled={loading || status === 'paused'}
            >
              <i className="bi bi-question-circle me-2"></i>
              뭐라고?
            </button>
          </div>

          {/* Next Step */}
          <div className="col-6">
            <button
              className="btn btn-primary w-100"
              onClick={onNext}
              disabled={loading || status === 'paused' || status === 'completed'}
            >
              <i className="bi bi-chevron-right me-2"></i>
              다음 단계
            </button>
          </div>
        </div>

        {/* Status Badge */}
        <div className="mt-3 text-center">
          {status === 'planning' && (
            <span className="badge bg-secondary">준비 중...</span>
          )}
          {status === 'active' && (
            <span className="badge bg-success">진행 중</span>
          )}
          {status === 'paused' && (
            <span className="badge bg-warning">일시정지</span>
          )}
          {status === 'completed' && (
            <span className="badge bg-primary">완료!</span>
          )}
          {status === 'error' && (
            <span className="badge bg-danger">오류 발생</span>
          )}
        </div>

        {/* Help Text */}
        <div className="mt-3">
          <small className="text-muted d-block">
            <strong>💡 사용법:</strong>
          </small>
          <small className="text-muted">
            • <strong>멈춰/계속</strong>: 요리 일시정지/재개<br />
            • <strong>다시</strong>: 현재 단계 재설명<br />
            • <strong>뭐라고?</strong>: 쉽게 다시 설명<br />
            • <strong>다음 단계</strong>: 다음으로 이동
          </small>
        </div>
      </div>
    </div>
  );
}
