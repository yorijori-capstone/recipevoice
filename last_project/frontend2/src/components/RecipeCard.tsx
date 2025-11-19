import { Link } from 'react-router-dom';

interface RecipeCardProps {
  id: number;
  recipe_id: string;
  title: string;
  description?: string;
  cookTime: string;
  difficulty: string;
  servings: string;
}

export function RecipeCard({ recipe_id, title, cookTime, difficulty, servings }: RecipeCardProps) {
  return (
    <div className="card h-100 shadow-sm">
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
        <Link to={`/recipe/${recipe_id}`} className="btn btn-primary w-100">
          레시피 보기
        </Link>
      </div>
    </div>
  );
}