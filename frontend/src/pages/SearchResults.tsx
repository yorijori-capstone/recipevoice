import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { RecipeCard } from '../components/RecipeCard';
import { SearchBar } from '../components/SearchBar';

// Type from Dashboard
interface ApiRecipe {
  source_id: string;
  title: string;
}

export const SearchResults = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const query = searchParams.get('q');
  
  const [recipes, setRecipes] = useState<ApiRecipe[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!query) return;

    setLoading(true);
    fetch(`/api/recipes/search/?q=${query}`)
      .then(res => res.json())
      .then(data => {
        setRecipes(data);
        setLoading(false);
      })
      .catch(error => {
        console.error("Error fetching search results:", error);
        setLoading(false);
      });
  }, [query]);

  return (
    <div className="container mt-4">
      <button className="btn btn-outline-secondary mb-3" onClick={() => navigate('/')}>← Back to Home</button>
      <SearchBar />
      <h2 className="my-4">Search Results for: "{query}"</h2>
      {loading ? (
        <p>Searching...</p>
      ) : recipes.length > 0 ? (
        <div className="row justify-content-center">
          {recipes.map(recipe => (
            <div className="col-lg-8 mb-4" key={recipe.source_id}>
              <RecipeCard 
                id={recipe.source_id} 
                title={recipe.title} 
                source="10000recipe" 
                originalTitle={recipe.title}
              />
            </div>
          ))}
        </div>
      ) : (
        <p>No recipes found for your search.</p>
      )}
    </div>
  );
};
