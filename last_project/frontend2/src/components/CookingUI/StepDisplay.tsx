/**
 * StepDisplay Component
 * Displays the current cooking step with script
 */

import React from 'react';
import { PlannedStep } from '../../hooks/useCookingSession';

interface StepDisplayProps {
  step: PlannedStep;
  stepNumber: number;
  totalSteps: number;
}

export function StepDisplay({ step, stepNumber, totalSteps }: StepDisplayProps) {
  return (
    <div className="card shadow-lg">
      <div className="card-header bg-primary text-white">
        <h4 className="mb-0">
          <span className="badge bg-light text-primary me-2">{stepNumber}</span>
          / {totalSteps} 단계
        </h4>
      </div>
      <div className="card-body">
        <div className="mb-4">
          <h5 className="text-muted mb-3">📝 현재 단계</h5>
          <p className="fs-5 lh-lg">{step.script}</p>
        </div>

        {step.timer_required && (
          <div className="alert alert-info d-flex align-items-center">
            <i className="bi bi-clock-fill me-2"></i>
            <div>
              <strong>예상 시간:</strong> {Math.floor(step.estimated_time_sec / 60)}분 {step.estimated_time_sec % 60}초
              {step.timer_message && (
                <div className="mt-1">
                  <small>{step.timer_message}</small>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mt-3">
          <details>
            <summary className="text-muted" style={{ cursor: 'pointer' }}>
              💡 추가 도움말 보기
            </summary>
            <div className="mt-3 p-3 bg-light rounded">
              <div className="mb-2">
                <strong>다시 듣고 싶을 때:</strong>
                <p className="mb-0 text-muted">{step.retry_script}</p>
              </div>
              <div className="mb-2">
                <strong>이해가 어려울 때:</strong>
                <p className="mb-0 text-muted">{step.fallback_script}</p>
              </div>
              <div>
                <strong>잠시 멈출 때:</strong>
                <p className="mb-0 text-muted">{step.pause_hint}</p>
              </div>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
