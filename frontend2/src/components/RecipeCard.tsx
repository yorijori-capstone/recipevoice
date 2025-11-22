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
  const [isHovered, setIsHovered] = useState(false);

  const isAIGenerated = recipe_id.startsWith('recipe_gen_');

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/recipes/${recipe_id}`, {
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
    <div
      className="card position-relative"
      style={{
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--color-border-light)',
        boxShadow: isHovered ? 'var(--shadow-card-hover)' : 'var(--shadow-card)',
        transform: isHovered ? 'translateY(-4px)' : 'translateY(0)',
        transition: 'all var(--transition-base)',
        overflow: 'hidden',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="card-body" style={{ padding: 'var(--spacing-4)' }}>
        {/* AI Generated Badge */}
        {isAIGenerated && (
          <div className="mb-2">
            <span
              className="badge"
              style={{
                background: 'linear-gradient(135deg, var(--color-secondary), var(--color-secondary-dark))',
                color: 'white',
                padding: 'var(--spacing-1) var(--spacing-3)',
                borderRadius: 'var(--radius-sm)',
                fontWeight: 'var(--font-weight-medium)',
                fontSize: 'var(--font-size-xs)',
              }}
            >
              ✨ AI 생성
            </span>
          </div>
        )}

        <h5
          className="card-title mb-3"
          style={{
            fontSize: 'var(--font-size-lg)',
            fontWeight: 'var(--font-weight-bold)',
            color: 'var(--color-text-primary)',
            lineHeight: 'var(--line-height-tight)',
          }}
        >
          {title}
        </h5>

        <div className="d-flex flex-wrap gap-2 mb-3">
          <span
            className="badge"
            style={{
              background: 'rgba(255, 107, 53, 0.1)',
              color: 'var(--color-primary)',
              border: '1px solid var(--color-primary)',
              fontWeight: 'var(--font-weight-medium)',
              fontSize: 'var(--font-size-xs)',
              padding: 'var(--spacing-1) var(--spacing-3)',
            }}
          >
            👥 {servings}
          </span>
          <span
            className="badge"
            style={{
              background: 'rgba(255, 107, 53, 0.1)',
              color: 'var(--color-primary)',
              border: '1px solid var(--color-primary)',
              fontWeight: 'var(--font-weight-medium)',
              fontSize: 'var(--font-size-xs)',
              padding: 'var(--spacing-1) var(--spacing-3)',
            }}
          >
            ⏱️ {cookTime}
          </span>
          <span
            className="badge"
            style={{
              background: 'rgba(255, 107, 53, 0.1)',
              color: 'var(--color-primary)',
              border: '1px solid var(--color-primary)',
              fontWeight: 'var(--font-weight-medium)',
              fontSize: 'var(--font-size-xs)',
              padding: 'var(--spacing-1) var(--spacing-3)',
            }}
          >
            📊 {difficulty}
          </span>
        </div>

        <div className="d-flex gap-2">
          <Link
            to={`/recipe/${recipe_id}`}
            className="btn btn-primary flex-grow-1"
            style={{
              borderRadius: 'var(--radius-md)',
              fontWeight: 'var(--font-weight-medium)',
              padding: 'var(--spacing-2) var(--spacing-4)',
              fontSize: 'var(--font-size-sm)',
            }}
          >
            레시피 보기
          </Link>
          {isAIGenerated && (
            <button
              className="btn btn-outline-danger"
              onClick={() => setShowDeleteConfirm(true)}
              title="삭제"
              style={{
                borderRadius: 'var(--radius-md)',
                padding: 'var(--spacing-2) var(--spacing-3)',
                borderColor: 'var(--color-primary)',
                color: 'var(--color-primary)',
              }}
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
          style={{
            backgroundColor: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(4px)',
          }}
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
            <div
              className="modal-content"
              style={{
                borderRadius: 'var(--radius-lg)',
                border: 'none',
                boxShadow: 'var(--shadow-2xl)',
              }}
            >
              <div
                className="modal-header"
                style={{
                  borderBottom: '1px solid var(--color-border-light)',
                  padding: 'var(--spacing-5)',
                }}
              >
                <h5 className="modal-title" style={{ fontWeight: 'var(--font-weight-bold)' }}>
                  레시피 삭제
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowDeleteConfirm(false)}
                ></button>
              </div>
              <div className="modal-body" style={{ padding: 'var(--spacing-5)' }}>
                <p><strong>{title}</strong> 레시피를 삭제하시겠습니까?</p>
                <p className="text-muted small mb-0">이 작업은 되돌릴 수 없습니다.</p>
              </div>
              <div
                className="modal-footer"
                style={{
                  borderTop: '1px solid var(--color-border-light)',
                  padding: 'var(--spacing-5)',
                }}
              >
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                  style={{ borderRadius: 'var(--radius-md)' }}
                >
                  취소
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  style={{ borderRadius: 'var(--radius-md)' }}
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
