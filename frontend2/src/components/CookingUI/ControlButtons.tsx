/**
 * ControlButtons Component
 * Navigation buttons for cooking session (previous/next step)
 */

interface ControlButtonsProps {
  status: 'planning' | 'active' | 'paused' | 'completed' | 'error';
  currentStepIndex: number;
  totalSteps: number;
  onPrevious: () => void;
  onNext: () => void;
  loading?: boolean;
}

export function ControlButtons({
  status,
  currentStepIndex,
  totalSteps,
  onPrevious,
  onNext,
  loading = false
}: ControlButtonsProps) {
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex >= totalSteps - 1;

  return (
    <div className="card shadow">
      <div className="card-header text-white" style={{ background: 'var(--color-primary)' }}>
        <h5 className="mb-0">📖 단계 이동</h5>
      </div>
      <div className="card-body">
        <div className="d-flex gap-2">
          {/* Previous Step */}
          <button
            className="btn btn-outline-secondary btn-lg flex-grow-1"
            onClick={onPrevious}
            disabled={loading || isFirstStep || status === 'completed'}
          >
            <i className="bi bi-chevron-left me-2"></i>
            이전
          </button>

          {/* Next Step */}
          <button
            className="btn btn-primary btn-lg flex-grow-1"
            onClick={onNext}
            disabled={loading || isLastStep || status === 'completed'}
          >
            다음
            <i className="bi bi-chevron-right ms-2"></i>
          </button>
        </div>

        {/* Step Counter */}
        <div className="mt-3 text-center">
          <div className="badge bg-secondary fs-6 py-2 px-3">
            {currentStepIndex + 1} / {totalSteps}
          </div>
        </div>

        {/* Status Badge */}
        <div className="mt-2 text-center">
          {status === 'planning' && (
            <span className="badge bg-secondary">준비 중...</span>
          )}
          {status === 'active' && (
            <span className="badge bg-secondary">진행 중</span>
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
          <small className="text-muted">
            <i className="bi bi-info-circle me-1"></i>
            단계별로 레시피를 확인하며 요리하세요
          </small>
        </div>
      </div>
    </div>
  );
}
