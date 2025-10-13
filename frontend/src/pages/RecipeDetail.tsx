
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

// Define types for the detailed recipe data based on the new API response
interface Ingredient {
  name: string;
}

interface Step {
  step_no: number;
  text: string;
}

interface RecipeDetailsData {
  recipe_id: string;
  title: string;
  servings: string;
  total_time: string;
  difficulty: string;
  author: string;
  source: string;
  ingredients: Ingredient[];
  steps: Step[];
}

export const RecipeDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [recipe, setRecipe] = useState<RecipeDetailsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [planning, setPlanning] = useState(false);
  const [planningComplete, setPlanningComplete] = useState(false);

  useEffect(() => {
    if (!id) return;

    fetch(`/api/recipes/${id}/`)
      .then(res => {
        if (!res.ok) {
          throw new Error('Recipe not found');
        }
        return res.json();
      })
      .then(data => {
        setRecipe(data);
        setLoading(false);
      })
      .catch(error => {
        console.error("Error fetching recipe details:", error);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return <p className="text-center mt-5">Loading recipe details...</p>;
  }

  if (!recipe) {
    return <p className="text-center mt-5">Recipe not found.</p>;
  }

  const handlePrepareGuidance = () => {
    setPlanning(true);
    // This POST request will trigger the planning on the backend
    fetch('/api/recipes/voice/control/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'start', recipe_id: id }),
    })
    .then(res => res.json())
    .then(data => {
      if (data.error) {
        console.error("Planning failed:", data.error);
        alert("음성 안내 준비에 실패했습니다.");
        setPlanning(false);
      } else {
        setPlanning(false);
        setPlanningComplete(true);
      }
    })
    .catch(err => {
      console.error("Error during planning:", err);
      alert("음성 안내 준비 중 오류가 발생했습니다.");
      setPlanning(false);
    });
  };

  const handleStartGuidance = () => {
    navigate(`/recipe/${id}/voice`);
  };

  return (
    <>
      <div className="container mt-4">
        <button className="btn btn-outline-secondary mb-3" onClick={() => navigate(-1)}>← 뒤로가기</button>
        <div className="card">
          <div className="card-header">
            <h2>{recipe.title}</h2>
            <h6 className="card-subtitle text-muted">Source: {recipe.source} | Author: {recipe.author}</h6>
          </div>
          <div className="card-body">
            <div className="mb-4">
              <span className="badge bg-secondary me-2">인분: {recipe.servings}</span>
              <span className="badge bg-secondary me-2">시간: {recipe.total_time}</span>
              <span className="badge bg-secondary">난이도: {recipe.difficulty}</span>
            </div>
            
            <div className="row">
              <div className="col-md-4">
                <h4>재료</h4>
                <ul className="list-group list-group-flush">
                  {recipe.ingredients.map((ing: Ingredient, index: number) => (
                    <li key={index} className="list-group-item ps-0">{ing.name}</li>
                  ))}
                </ul>
              </div>
              <div className="col-md-8">
                <h4>조리 방법</h4>
                <ol className="list-group list-group-numbered">
                  {recipe.steps.map((step: Step) => (
                    <li key={step.step_no} className="list-group-item">{step.text}</li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
          <div className="card-footer text-center py-3">
            {!planning && !planningComplete && (
              <button className="btn btn-primary btn-lg" onClick={handlePrepareGuidance}>
                음성 안내 준비
              </button>
            )}
            {planning && (
              <div className="d-flex justify-content-center align-items-center">
                <div className="spinner-border me-2" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
                <span>음성 안내를 위한 플래닝 중입니다...</span>
              </div>
            )}
            {planningComplete && (
              <button className="btn btn-success btn-lg" onClick={handleStartGuidance}>
                안내 시작
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
