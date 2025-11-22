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
    <>
      <Link
        to={`/recipe/${recipe_id}`}
        className="text-decoration-none"
        style={{ color: 'inherit' }}
      >
        <div
          className="card position-relative h-100"
          style={{
            borderRadius: 'var(--radius-lg)',
            border: 'none',
            boxShadow: isHovered ? 'var(--shadow-card-hover)' : 'var(--shadow-sm)',
            transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
            transition: 'all var(--transition-base)',
            overflow: 'hidden',
            background: 'white',
          }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <div className="d-flex align-items-center p-3">
            {/* Left: Image Placeholder */}
            <div
              className="flex-shrink-0 d-flex align-items-center justify-content-center rounded-3 me-3"
              style={{
                width: '80px',
                height: '80px',
                background: 'linear-gradient(135deg, #FFE5D9 0%, #FFF0E6 100%)',
                fontSize: '2rem',
              }}
            >
              🍳
            </div>

            {/* Right: Content */}
            <div className="flex-grow-1 min-width-0">
              <div className="d-flex justify-content-between align-items-start mb-1">
                <h5
                  className="card-title mb-0"
                  style={{
                    fontSize: 'var(--font-size-md)',
                    fontWeight: 'var(--font-weight-bold)',
                    color: 'var(--color-text-primary)',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    lineHeight: '1.3',
                  }}
                >
                  {title}
                </h5>

                {/* AI Badge or Delete Button */}
                {isAIGenerated && (
                  <div className="d-flex align-items-center gap-2">
                    <span
                      className="badge rounded-pill"
                      style={{
                        background: 'var(--color-secondary)',
                        fontSize: '0.65rem',
                        fontWeight: 'var(--font-weight-bold)',
                      }}
                    >
                      AI
                    </span>
                    <button
                      className="btn btn-link p-0 text-muted"
                      onClick={(e) => {
                        e.preventDefault(); // Prevent navigation
                        e.stopPropagation();
                        setShowDeleteConfirm(true);
                      }}
                      style={{ fontSize: '1rem', lineHeight: 1 }}
                    >
                      &times;
                    </button>
                  </div>
                )}
              </div>

              <div className="d-flex flex-wrap gap-2">
                <span
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--color-text-secondary)',
                    background: 'var(--color-background)',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontWeight: '500',
                  }}
                >
                  👥 {servings}
                </span>
                <span
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--color-text-secondary)',
                    background: 'var(--color-background)',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontWeight: '500',
                  }}
                >
                  ⏱️ {cookTime}
                </span>
                <span
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--color-text-secondary)',
                    background: 'var(--color-background)',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontWeight: '500',
                  }}
                >
                  📊 {difficulty}
                </span>
              </div>
            </div>
          </div>
        </div>
      </Link>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div
          className="modal show d-block"
          tabIndex={-1}
          style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content" style={{ borderRadius: 'var(--radius-lg)', border: 'none' }}>
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title fw-bold">레시피 삭제</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowDeleteConfirm(false);
                  }}
                ></button>
              </div>
              <div className="modal-body text-center py-4">
                <p className="mb-0 text-muted">정말로 이 레시피를 삭제하시겠습니까?</p>
              </div>
              <div className="modal-footer border-0 pt-0 justify-content-center gap-2 pb-4">
                <button
                  type="button"
                  className="btn btn-light px-4 rounded-pill"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowDeleteConfirm(false);
                  }}
                >
                  취소
                </button>
                <button
                  type="button"
                  className="btn btn-danger px-4 rounded-pill"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleDelete();
                  }}
                  disabled={isDeleting}
                >
                  {isDeleting ? '삭제 중...' : '삭제'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
