import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

interface Ingredient {
  id: number;
  name: string;
  quantity: string;
  description: string | null;
}

interface Step {
  id: number;
  step_number: number;
  description: string;
}

interface Recipe {
  id: number;
  recipe_id: string;
  title: string;
  servings: string;
  cook_time: string;
  difficulty: string;
  source_url: string;
  copyright: string;
  tips: string[];
  ingredients: Ingredient[];
  steps: Step[];
}

export function RecipeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecipe = async () => {
      try {
        const response = await fetch(`/api/recipes/${id}`);
        if (!response.ok) {
          throw new Error('Recipe not found');
        }
        const data = await response.json();
        setRecipe(data);
      } catch (error) {
        console.error('Error fetching recipe:', error);
        alert('레시피를 찾을 수 없습니다.');
        navigate('/');
      } finally {
        setLoading(false);
      }
    };

    fetchRecipe();
  }, [id, navigate]);

  if (loading) {
    return (
      <div className="container mt-5 text-center">
        <div className="spinner-border" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  if (!recipe) {
    return null;
  }

  return (
    <div className="container mb-5" style={{ padding: 'var(--spacing-4)' }}>
      {/* 뒤로 가기 버튼 */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <button
          className="btn btn-outline-secondary"
          onClick={() => navigate('/')}
          style={{ borderRadius: 'var(--radius-md)' }}
        >
          ← 목록으로
        </button>
        <button
          className="btn btn-primary btn-lg"
          onClick={() => navigate(`/cooking/${recipe.recipe_id}`)}
          style={{
            borderRadius: 'var(--radius-md)',
            fontWeight: 'var(--font-weight-bold)',
            boxShadow: '0 2px 8px rgba(242, 98, 46, 0.3)',
          }}
        >
          🍳 요리 시작
        </button>
      </div>

      {/* 제목 */}
      <div
        className="card mb-4"
        style={{
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <div className="card-body" style={{ padding: 'var(--spacing-5)' }}>
          <h1
            className="card-title mb-3"
            style={{
              fontSize: 'var(--font-size-2xl)',
              fontWeight: 'var(--font-weight-bold)',
            }}
          >
            {recipe.title}
          </h1>
          <div className="d-flex flex-wrap gap-2">
            <span
              className="badge"
              style={{
                background: 'rgba(207, 99, 22, 0.07)',
                color: '#cf7c1ded',
                border: '1px solid var(--color-secondary)',
                padding: 'var(--spacing-2) var(--spacing-3)',
              }}
            >
              👥 {recipe.servings}
            </span>
            <span
              className="badge"
              style={{
                background: 'rgba(255, 217, 61, 0.15)',
                color: '#B8941F',
                border: '1px solid var(--color-accent)',
                padding: 'var(--spacing-2) var(--spacing-3)',
              }}
            >
              ⏱️ {recipe.cook_time}
            </span>
            <span
              className="badge"
              style={{
                background: 'rgba(255, 107, 53, 0.15)',
                color: 'var(--color-primary-dark)',
                border: '1px solid var(--color-primary)',
                padding: 'var(--spacing-2) var(--spacing-3)',
              }}
            >
              📊 {recipe.difficulty}
            </span>
          </div>
        </div>
      </div>

      {/* Mobile Layout - Vertical Stack */}

      {/* 재료 */}
      <div
        className="card mb-4"
        style={{
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <div
          className="card-header text-white"
          style={{
            background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)',
            padding: 'var(--spacing-4)',
          }}
        >
          <h5 className="mb-0" style={{ fontWeight: 'var(--font-weight-bold)' }}>
            🥚 재료
          </h5>
        </div>
        <div className="card-body" style={{ padding: 'var(--spacing-4)' }}>
          <ul className="list-group list-group-flush">
            {recipe.ingredients.map((ingredient) => (
              <li
                key={ingredient.id}
                className="list-group-item d-flex justify-content-between align-items-center"
                style={{
                  border: 'none',
                  borderBottom: '1px solid var(--color-border-light)',
                  padding: 'var(--spacing-3) 0',
                }}
              >
                <span>{ingredient.name}</span>
                <strong style={{ color: 'var(--color-primary)' }}>
                  {ingredient.quantity}
                </strong>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* 팁 */}
      {recipe.tips && recipe.tips.length > 0 && (
        <div
          className="card mb-4"
          style={{
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div
            className="card-header"
            style={{
              background: 'linear-gradient(135deg, var(--color-accent) 0%, var(--color-accent-dark) 100%)',
              padding: 'var(--spacing-4)',
            }}
          >
            <h5 className="mb-0" style={{ fontWeight: 'var(--font-weight-bold)' }}>
              💡 팁
            </h5>
          </div>
          <div className="card-body" style={{ padding: 'var(--spacing-4)' }}>
            <ul className="mb-0" style={{ paddingLeft: 'var(--spacing-5)' }}>
              {recipe.tips.map((tip, idx) => (
                <li
                  key={idx}
                  style={{
                    marginBottom: 'var(--spacing-2)',
                    lineHeight: 'var(--line-height-relaxed)',
                  }}
                >
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* 조리 방법 */}
      <div
        className="card mb-4"
        style={{
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <div
          className="card-header"
          style={{
            background: 'linear-gradient(135deg, var(--color-secondary) 0%, var(--color-secondary-dark) 100%)',
            padding: 'var(--spacing-4)',
          }}
        >
          <h5 className="mb-0" style={{ fontWeight: 'var(--font-weight-bold)' }}>
            🧑🏻‍🍳 조리 방법
          </h5>
        </div>
        <div className="card-body" style={{ padding: 'var(--spacing-4)' }}>
          {recipe.steps.map((step) => (
            <div key={step.id} className="mb-4">
              <div className="d-flex align-items-start">
                <span
                  className="badge rounded-circle me-3"
                  style={{
                    width: '36px',
                    height: '36px',
                    lineHeight: '24px',
                    fontSize: 'var(--font-size-base)',
                    background: 'var(--color-secondary)',
                    color: 'white',
                    fontWeight: 'var(--font-weight-bold)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {step.step_number}
                </span>
                <p
                  className="mb-0"
                  style={{
                    lineHeight: 'var(--line-height-relaxed)',
                    fontSize: 'var(--font-size-base)',
                  }}
                >
                  {step.description}
                </p>
              </div>
              {step.step_number < recipe.steps.length && (
                <hr
                  className="mt-3"
                  style={{
                    borderColor: 'var(--color-border-light)',
                    opacity: 0.5,
                  }}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 출처 */}
      <div
        className="card"
        style={{
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div className="card-body" style={{ padding: 'var(--spacing-4)' }}>
          <small className="text-muted">
            출처: {recipe.copyright || '알 수 없음'}
            {recipe.source_url && recipe.source_url !== 'AI Generated' && (
              <>
                {' | '}
                <a
                  href={recipe.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ms-2"
                  style={{ color: 'var(--color-primary)' }}
                >
                  원본 레시피 보기
                </a>
              </>
            )}
          </small>
        </div>
      </div>
    </div>
  );
}