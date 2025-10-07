import React from 'react';
import { Link } from 'react-router-dom';

// Define a type for the recipe props
interface RecipeCardProps {
  id: number | string;
  title: string;
  source: string;
  originalTitle: string;
}

export const RecipeCard: React.FC<RecipeCardProps> = ({ id, title, source, originalTitle }) => {
  return (
    <Link to={`/recipe/${id}`} className="card-link">
      <div className="card mb-3 h-100 recipe-card-hover">
        <div className="card-body">
          <h5 className="card-title">{title}</h5>
          <h6 className="card-subtitle mb-2 text-muted">From: {source}</h6>
          <p className="card-text text-body-secondary">{originalTitle}</p>
        </div>
      </div>
    </Link>
  );
};
