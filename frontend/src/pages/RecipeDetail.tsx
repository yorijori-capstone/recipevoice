
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

// Define types for the detailed recipe data
interface Ingredient {
  name: string;
  quantity: string;
}

interface Step {
  order: number;
  instruction: string;
}

interface RecipeDetailsData {
  title: string;
  servings: string;
  cook_time: string;
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
    fetch(`/api/recipes/${id}/`)
      .then(res => res.json())
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
    return <p>Loading recipe details...</p>;
  }

  if (!recipe) {
    return <p>Recipe not found.</p>;
  }

  const handlePrepareGuidance = () => {
    setPlanning(true);
    // Simulate planning phase
    setTimeout(() => {
      setPlanning(false);
      setPlanningComplete(true);
    }, 3000); // 3 seconds delay
  };

  const handleStartGuidance = () => {
    navigate(`/recipe/${id}/voice`);
  };

  return (
    <>
      <div className="container mt-4">
        <button className="btn btn-outline-secondary mb-3" onClick={() => navigate('/')}>← 뒤로가기</button>
        <div className="card">
          <div className="card-header">
            <h2>{recipe.title}</h2>
            <h6 className="card-subtitle text-muted">From: 10000recipe</h6>
          </div>
          <div className="card-body">
            <div className="mb-4">
              <span className="badge bg-secondary me-2">{recipe.servings}</span>
              <span className="badge bg-secondary">{recipe.cook_time}</span>
            </div>
            <div className="row">
              <div className="col-md-4">
                <h4>Ingredients</h4>
                <ul className="list-group list-group-flush">
                  {recipe.ingredients.map((ing: Ingredient, index: number) => (
                    <li key={index} className="list-group-item ps-0">{ing.name} - {ing.quantity}</li>
                  ))}
                </ul>
              </div>
              <div className="col-md-8">
                <h4>Instructions</h4>
                <ol className="list-group list-group-numbered">
                  {recipe.steps.map((step: Step) => (
                    <li key={step.order} className="list-group-item">{step.instruction}</li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
          <div className="card-footer text-center">
            {!planning && !planningComplete && (
              <button className="btn btn-primary btn-lg" onClick={handlePrepareGuidance}>
                음성 안내 준비
              </button>
            )}
            {planning && (
              <p>음성 안내를 위한 플래닝 중입니다...</p>
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
