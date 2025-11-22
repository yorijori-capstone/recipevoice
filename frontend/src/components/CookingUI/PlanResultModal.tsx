/**
 * PlanResultModal Component
 * Displays the planning result from Planning Service
 */

interface PlanResultModalProps {
  planResult: any;
  onClose: () => void;
}

export function PlanResultModal({ planResult, onClose }: PlanResultModalProps) {
  if (!planResult) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="modal-backdrop fade show"
        onClick={onClose}
        style={{ zIndex: 1040 }}
      ></div>

      {/* Modal */}
      <div
        className="modal fade show d-block"
        tabIndex={-1}
        style={{ zIndex: 1050 }}
      >
        <div className="modal-dialog modal-lg modal-dialog-scrollable">
          <div className="modal-content">
            {/* Header */}
            <div className="modal-header bg-primary text-white">
              <h5 className="modal-title">
                📋 Planning 결과
              </h5>
              <button
                type="button"
                className="btn-close btn-close-white"
                onClick={onClose}
                aria-label="Close"
              ></button>
            </div>

            {/* Body */}
            <div className="modal-body">
              {/* Title */}
              <div className="mb-4">
                <h6 className="text-muted mb-2">레시피 제목</h6>
                <p className="fs-5 fw-bold">{planResult.title}</p>
              </div>

              {/* Opening Remark */}
              <div className="mb-4">
                <h6 className="text-muted mb-2">시작 멘트</h6>
                <div className="alert alert-info">
                  {planResult.opening_remark}
                </div>
              </div>

              {/* Planned Steps */}
              <div className="mb-4">
                <h6 className="text-muted mb-2">단계별 스크립트 ({planResult.planned_steps?.length || 0}단계)</h6>
                <div className="accordion" id="planStepsAccordion">
                  {planResult.planned_steps?.map((step: any, index: number) => (
                    <div className="accordion-item" key={index}>
                      <h2 className="accordion-header">
                        <button
                          className={`accordion-button ${index === 0 ? '' : 'collapsed'}`}
                          type="button"
                          data-bs-toggle="collapse"
                          data-bs-target={`#step${index}`}
                          aria-expanded={index === 0 ? 'true' : 'false'}
                        >
                          <strong>단계 {step.order}</strong>
                          {step.timer_required && (
                            <span className="badge bg-warning text-dark ms-2">
                              ⏱️ {step.estimated_time_sec}초
                            </span>
                          )}
                        </button>
                      </h2>
                      <div
                        id={`step${index}`}
                        className={`accordion-collapse collapse ${index === 0 ? 'show' : ''}`}
                        data-bs-parent="#planStepsAccordion"
                      >
                        <div className="accordion-body">
                          <div className="mb-3">
                            <strong className="text-primary">📢 메인 스크립트:</strong>
                            <p className="mt-1">{step.script}</p>
                          </div>
                          <div className="mb-3">
                            <strong className="text-warning">🔁 재시도 스크립트:</strong>
                            <p className="mt-1 text-muted">{step.retry_script}</p>
                          </div>
                          <div className="mb-3">
                            <strong className="text-success">💡 간단 설명:</strong>
                            <p className="mt-1 text-muted">{step.fallback_script}</p>
                          </div>
                          <div className="mb-3">
                            <strong className="text-secondary">⏸️ 일시정지 힌트:</strong>
                            <p className="mt-1 text-muted">{step.pause_hint}</p>
                          </div>
                          {step.timer_required && (
                            <div className="alert alert-warning mb-0">
                              <strong>⏱️ 타이머:</strong> {step.timer_message}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Closing Remark */}
              <div className="mb-3">
                <h6 className="text-muted mb-2">완료 멘트</h6>
                <div className="alert alert-success">
                  {planResult.closing_remark}
                </div>
              </div>

              {/* JSON Raw Data */}
              <div>
                <h6 className="text-muted mb-2">JSON 원본</h6>
                <pre className="bg-dark text-light p-3 rounded" style={{ fontSize: '0.85rem', maxHeight: '300px', overflow: 'auto' }}>
                  {JSON.stringify(planResult, null, 2)}
                </pre>
              </div>
            </div>

            {/* Footer */}
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
