/**
 * ProgressBar Component
 * Shows overall cooking progress
 */

interface ProgressBarProps {
  currentStep: number;
  totalSteps: number;
  status: 'planning' | 'active' | 'paused' | 'completed' | 'error';
}

export function ProgressBar({ currentStep, totalSteps, status }: ProgressBarProps) {
  const progressPercentage = (currentStep / totalSteps) * 100;

  const getProgressColor = () => {
    // All statuses use orange/warning/danger, no blue
    if (status === 'completed') return 'bg-primary';
    if (status === 'error') return 'bg-danger';
    if (status === 'paused') return 'bg-warning';
    return 'bg-primary'; // active status - orange
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'planning':
        return '⏳';
      case 'active':
        return '🔥';
      case 'paused':
        return '⏸️';
      case 'completed':
        return '✅';
      case 'error':
        return '❌';
      default:
        return '🍳';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'planning':
        return '준비 중';
      case 'active':
        return '요리 중';
      case 'paused':
        return '일시정지';
      case 'completed':
        return '완료!';
      case 'error':
        return '오류';
      default:
        return '요리 중';
    }
  };

  return (
    <div className="card shadow-sm mb-4">
      <div className="card-body">
        {/* Header */}
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h5 className="mb-0" style={{ fontWeight: 'var(--font-weight-bold)' }}>
            {getStatusIcon()} {getStatusText()}
          </h5>
          <span className="badge bg-secondary">
            {currentStep} / {totalSteps} 단계
          </span>
        </div>

        {/* Progress Bar */}
        <div className="progress" style={{ height: '30px' }}>
          <div
            className={`progress-bar progress-bar-striped ${status === 'active' ? 'progress-bar-animated' : ''
              } ${getProgressColor()}`}
            role="progressbar"
            style={{ width: `${progressPercentage}%` }}
            aria-valuenow={progressPercentage}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <strong>{Math.round(progressPercentage)}%</strong>
          </div>
        </div>

        {/* Step Indicators */}
        <div className="mt-3">
          <div className="d-flex justify-content-between">
            {Array.from({ length: totalSteps }, (_, index) => {
              const stepNumber = index + 1;
              const isCompleted = stepNumber < currentStep;
              const isCurrent = stepNumber === currentStep;

              return (
                <div
                  key={stepNumber}
                  className="d-flex flex-column align-items-center"
                  style={{ flex: 1 }}
                >
                  <div
                    className={`rounded-circle d-flex align-items-center justify-content-center ${isCompleted
                      ? 'bg-primary text-white'
                      : isCurrent
                        ? 'bg-primary text-white'
                        : 'bg-light text-muted'
                      }`}
                    style={{
                      width: '30px',
                      height: '30px',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}
                  >
                    {isCompleted ? '✓' : stepNumber}
                  </div>
                  {totalSteps <= 10 && (
                    <small className="text-muted mt-1" style={{ fontSize: '10px' }}>
                      {stepNumber}
                    </small>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Completion Message */}
        {status === 'completed' && (
          <div className="alert mt-3 mb-0" style={{ backgroundColor: 'rgba(242, 98, 46, 0.1)', borderColor: 'rgba(242, 98, 46, 0.2)', color: 'var(--color-primary-dark)' }}>
            <strong>🎉 축하합니다!</strong> 모든 요리 단계를 완료했습니다.
          </div>
        )}
      </div>
    </div>
  );
}
