import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
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
  const { recipeId } = useParams<{ recipeId: string }>();
  const navigate = useNavigate();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecipe = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/recipes/${recipeId}`);
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
  }, [recipeId, navigate]);

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="container mt-5 text-center">
          <div className="spinner-border" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      </>
    );
  }

  if (!recipe) {
    return null;
  }

  return (
    <>
      <Navbar />
      <div className="container mb-5">
        {/* 뒤로 가기 버튼 */}
        <div className="d-flex justify-content-between align-items-center mb-3">
          <button className="btn btn-outline-secondary" onClick={() => navigate('/')}>
            ← 목록으로
          </button>
          <button
            className="btn btn-primary btn-lg"
            onClick={() => navigate(`/cooking/${recipe.recipe_id}`)}
          >
            🍳 요리 시작
          </button>
        </div>

        {/* 제목 */}
        <div className="card mb-4">
          <div className="card-body">
            <h1 className="card-title">{recipe.title}</h1>
            <div className="row mt-3">
              <div className="col-md-4">
                <span className="badge bg-info me-2">👥 {recipe.servings}</span>
              </div>
              <div className="col-md-4">
                <span className="badge bg-warning me-2">⏱️ {recipe.cook_time}</span>
              </div>
              <div className="col-md-4">
                <span className="badge bg-success">📊 {recipe.difficulty}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="row">
          {/* 재료 */}
          <div className="col-md-4">
            <div className="card mb-4">
              <div className="card-header bg-primary text-white">
                <h5 className="mb-0">🥘 재료</h5>
              </div>
              <div className="card-body">
                <ul className="list-group list-group-flush">
                  {recipe.ingredients.map((ingredient) => (
                    <li key={ingredient.id} className="list-group-item d-flex justify-content-between">
                      <span>{ingredient.name}</span>
                      <strong>{ingredient.quantity}</strong>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* 팁 */}
            {recipe.tips && recipe.tips.length > 0 && (
              <div className="card">
                <div className="card-header bg-warning">
                  <h5 className="mb-0">💡 팁</h5>
                </div>
                <div className="card-body">
                  <ul className="mb-0">
                    {recipe.tips.map((tip, idx) => (
                      <li key={idx}>{tip}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>

          {/* 조리 단계 */}
          <div className="col-md-8">
            <div className="card">
              <div className="card-header bg-success text-white">
                <h5 className="mb-0">👨‍🍳 조리 방법</h5>
              </div>
              <div className="card-body">
                {recipe.steps.map((step) => (
                  <div key={step.id} className="mb-4">
                    <div className="d-flex align-items-start">
                      <span
                        className="badge bg-success rounded-circle me-3"
                        style={{ width: '30px', height: '30px', lineHeight: '20px', fontSize: '14px' }}
                      >
                        {step.step_number}
                      </span>
                      <p className="mb-0">{step.description}</p>
                    </div>
                    {step.step_number < recipe.steps.length && <hr className="mt-3" />}
                  </div>
                ))}
              </div>
            </div>

            {/* 출처 */}
            <div className="card mt-3">
              <div className="card-body">
                <small className="text-muted">
                  출처: {recipe.copyright || '알 수 없음'} |
                  <a href={recipe.source_url} target="_blank" rel="noopener noreferrer" className="ms-2">
                    원본 레시피 보기
                  </a>
                </small>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}