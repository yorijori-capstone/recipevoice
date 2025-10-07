
import { useEffect, useState } from 'react';
import { SearchBar } from '../components/SearchBar';
import { RecipeCard } from '../components/RecipeCard';

// Define a type for the recipe object from the API
interface ApiRecipe {
  source_id: string; // Assuming source_id is the unique identifier
  title: string;
  // Add other fields if needed, like 'source' if the backend provides it
}

export const Dashboard = () => {
  const [recipes, setRecipes] = useState<ApiRecipe[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch recipes from the backend API
    // Note: The backend server must be running and accessible.
    // The URL might need to be adjusted based on the backend server's address.
    fetch('/api/recipes/') // Using Vite's proxy
      .then(res => res.json())
      .then(data => {
        setRecipes(data);
        setLoading(false);
      })
      .catch(error => {
        console.error("Error fetching recipes:", error);
        setLoading(false);
      });
  }, []);

  return (
    <div className="container mt-4">
      <h1 className="mb-4 text-center">Recipe Voice</h1>
      <SearchBar />
      
      <section className="my-5">
        <h2 className="mb-3">모든 레시피</h2>
        {loading ? (
          <p>Loading recipes...</p>
        ) : (
          <div className="row justify-content-center">
            {recipes.map((recipe: ApiRecipe) => (
              <div className="col-lg-8 mb-4" key={recipe.source_id}>
                <RecipeCard 
                  id={recipe.source_id} 
                  title={recipe.title}
                  source="10000recipe" // Placeholder, adjust if API provides it
                  originalTitle={recipe.title}
                />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
