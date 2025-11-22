import { Link } from 'react-router-dom';
import { useState } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

interface RecipeCardProps {
  id: number;
  recipe_id: string;
  title: string;
  description?: string;
  cookTime: string;
  difficulty: string;
  servings: string;
  onDelete?: () => void;
}

export function RecipeCard({ recipe_id, title, cookTime, difficulty, servings, onDelete }: RecipeCardProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isAIGenerated = recipe_id.startsWith('recipe_gen_');

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/recipes/${recipe_id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        alert(error.message || 'Failed to delete recipe');
        return;
      }

      // Notify parent component to refresh list
      onDelete?.();
      alert('레시피가 삭제되었습니다.');
    } catch (error) {
      console.error('Delete error:', error);
      alert('삭제 중 오류가 발생했습니다.');
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className="card h-100 shadow-sm position-relative">
      {/* AI Generated Badge */}
      {isAIGenerated && (
        <div className="position-absolute top-0 end-0 m-2">
          <span className="badge bg-success">AI 생성</span>
        </div>
      )}

      {/* 이미지 placeholder */}
      <div className="card-img-top bg-light d-flex align-items-center justify-content-center" style={{ height: '200px' }}>
        <span style={{ fontSize: '64px' }}>🍳</span>
      </div>

      <div className="card-body">
        <h5 className="card-title">{title}</h5>

        <div className="mb-2">
          <span className="badge bg-info me-1">👥 {servings}</span>
          <span className="badge bg-warning me-1">⏱️ {cookTime}</span>
          <span className="badge bg-success">📊 {difficulty}</span>
        </div>
      </div>

      <div className="card-footer">
        <div className="d-flex gap-2">
          <Link to={`/recipe/${recipe_id}`} className="btn btn-primary flex-grow-1">
            레시피 보기
          </Link>
          {isAIGenerated && (
            <button
              className="btn btn-danger"
              onClick={() => setShowDeleteConfirm(true)}
              title="삭제"
            >
              🗑️
            </button>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div
          className="modal d-block"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">레시피 삭제</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowDeleteConfirm(false)}
                ></button>
              </div>
              <div className="modal-body">
                <p><strong>{title}</strong> 레시피를 삭제하시겠습니까?</p>
                <p className="text-muted small">이 작업은 되돌릴 수 없습니다.</p>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                >
                  취소
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={handleDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? '삭제 중...' : '삭제'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
