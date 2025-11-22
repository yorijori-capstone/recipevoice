import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { RecipeCard } from '../components/RecipeCard';
import { RecipeGenerateModal } from '../components/RecipeGenerateModal';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

interface Recipe {
  id: number;
  recipeId: string;
  title: string;
  servings?: string;
  cookTime?: string;
  difficulty?: string;
  openingRemark?: string;
  totalSteps?: number;
}

export function DashboardV3() {
  const navigate = useNavigate();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Recipe[]>([]);
  const [hasSearchResults, setHasSearchResults] = useState(true);
  const [initialPrompt, setInitialPrompt] = useState('');
  const limit = 24;

  // Load all recipes
  useEffect(() => {
    if (!isSearching) {
      fetchAllRecipes();
    }
  }, [page, isSearching]);

  const fetchAllRecipes = async () => {
    setLoading(true);
    try {
      const offset = (page - 1) * limit;
      const response = await fetch(`${API_BASE_URL}/api/recipes/?limit=${limit}&offset=${offset}`);
      const data = await response.json();

      // Map snake_case to camelCase
      const mappedRecipes = data.recipes.map((recipe: any) => ({
        id: recipe.id,
        recipeId: recipe.recipe_id,
        title: recipe.title,
        servings: recipe.servings,
        cookTime: recipe.cook_time,
        difficulty: recipe.difficulty,
      }));

      setRecipes(mappedRecipes);
      setTotal(data.total);
    } catch (error) {
      console.error('Error fetching recipes:', error);
    } finally {
      setLoading(false);
    }
  };

  // Search recipes
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      // Empty search - show all recipes
      setIsSearching(false);
      setPage(1);
      return;
    }

    setLoading(true);
    setIsSearching(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/recipes/search/cleaned?q=${encodeURIComponent(searchQuery.trim())}`
      );
      const data = await response.json();

      if (data.success) {
        // Map snake_case to camelCase for search results
        const mappedResults = data.recipes.map((recipe: any) => ({
          id: recipe.id,
          recipeId: recipe.recipeId || recipe.recipe_id,
          title: recipe.title,
          servings: recipe.servings,
          cookTime: recipe.cookTime || recipe.cook_time,
          difficulty: recipe.difficulty,
          openingRemark: recipe.openingRemark || recipe.opening_remark,
          totalSteps: recipe.totalSteps || recipe.total_steps,
        }));

        setSearchResults(mappedResults);
        setHasSearchResults(data.hasResults);
        console.log(`[Dashboard] Search results: ${data.count} recipes found`);
      }
    } catch (error) {
      console.error('[Dashboard] Search error:', error);
      setSearchResults([]);
      setHasSearchResults(false);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      handleSearch();
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setIsSearching(false);
    setSearchResults([]);
    setHasSearchResults(true);
    setPage(1);
  };

  const handleCreateWithAI = () => {
    setInitialPrompt(searchQuery);
    setShowGenerateModal(true);
  };

  const handleRecipeGenerated = (recipeId: string) => {
    setShowGenerateModal(false);
    setInitialPrompt('');
    navigate(`/cooking/${recipeId}`);
  };

  const displayRecipes = isSearching ? searchResults : recipes;
  const displayTotal = isSearching ? searchResults.length : total;

  const totalPages = isSearching ? 1 : Math.ceil(total / limit);

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;

    let startPage = Math.max(1, page - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);

    if (endPage - startPage < maxVisible - 1) {
      startPage = Math.max(1, endPage - maxVisible + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    return pages;
  };

  return (
    <>
      <Navbar />
      <div className="container">
        <div className="text-center mb-4">
          <h1 className="display-4">레시피 모음</h1>
          <p className="text-muted">
            {isSearching
              ? `"${searchQuery}" 검색 결과: ${displayTotal}개`
              : `총 ${total}개의 레시피`}
          </p>
        </div>

        {/* Search Bar */}
        <div className="row justify-content-center mb-4">
          <div className="col-md-8">
            <div className="input-group input-group-lg">
              <input
                type="text"
                className="form-control"
                placeholder="레시피 검색... (예: 김치, 찌개, 볶음)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <button
                className="btn btn-primary"
                type="button"
                onClick={handleSearch}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    검색 중...
                  </>
                ) : (
                  <>🔍 검색</>
                )}
              </button>
              {isSearching && (
                <button className="btn btn-outline-secondary" type="button" onClick={clearSearch}>
                  초기화
                </button>
              )}
            </div>
          </div>
        </div>

        {/* AI Recipe Generation Button */}
        <div className="d-flex justify-content-center mb-4">
          <button className="btn btn-success btn-lg" onClick={() => setShowGenerateModal(true)}>
            🤖 AI로 새 레시피 생성하기
          </button>
        </div>

        <section className="my-5">
          {loading ? (
            <div className="text-center py-5">
              <div
                className="spinner-border text-primary"
                role="status"
                style={{ width: '3rem', height: '3rem' }}
              >
                <span className="visually-hidden">Loading...</span>
              </div>
              <p className="mt-3 text-muted">레시피를 불러오는 중...</p>
            </div>
          ) : isSearching && !hasSearchResults ? (
            // No search results - suggest AI generation
            <div className="text-center py-5">
              <div className="alert alert-warning d-inline-block" role="alert">
                <h4 className="alert-heading">😔 검색 결과가 없습니다</h4>
                <p className="mb-3">
                  "<strong>{searchQuery}</strong>" 레시피를 찾을 수 없습니다.
                </p>
                <hr />
                <p className="mb-3">💡 원하는 레시피가 없나요?</p>
                <p className="mb-4">AI가 맞춤 레시피를 만들어드릴게요!</p>
                <button className="btn btn-success btn-lg" onClick={handleCreateWithAI}>
                  ✨ AI로 "{searchQuery}" 레시피 만들기
                </button>
              </div>
            </div>
          ) : displayRecipes.length === 0 ? (
            <div className="text-center py-5">
              <p className="text-muted fs-5">레시피가 없습니다.</p>
            </div>
          ) : (
            <>
              {/* Current page info */}
              {!isSearching && (
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <p className="text-muted mb-0">
                    {(page - 1) * limit + 1} - {Math.min(page * limit, total)} / {total}개 표시 중
                  </p>
                  <p className="text-muted mb-0">
                    페이지 {page} / {totalPages}
                  </p>
                </div>
              )}

              {/* Recipe grid */}
              <div className="row">
                {displayRecipes.map((recipe) => (
                  <div className="col-lg-4 col-md-6 mb-4" key={recipe.recipeId}>
                    <RecipeCard
                      id={recipe.id}
                      recipe_id={recipe.recipeId}
                      title={recipe.title}
                      cookTime={recipe.cookTime || ''}
                      difficulty={recipe.difficulty || ''}
                      servings={recipe.servings || ''}
                      onDelete={() => {
                        // Refresh the list after deletion
                        if (isSearching) {
                          handleSearch();
                        } else {
                          fetchAllRecipes();
                        }
                      }}
                    />
                  </div>
                ))}
              </div>

              {/* Pagination - only show when not searching */}
              {!isSearching && totalPages > 1 && (
                <nav aria-label="레시피 페이지네이션" className="mt-5">
                  <ul className="pagination justify-content-center">
                    <li className={`page-item ${page === 1 ? 'disabled' : ''}`}>
                      <button
                        className="page-link"
                        onClick={() => setPage(1)}
                        disabled={page === 1}
                        aria-label="처음"
                      >
                        <span aria-hidden="true">&laquo;</span>
                      </button>
                    </li>

                    <li className={`page-item ${page === 1 ? 'disabled' : ''}`}>
                      <button
                        className="page-link"
                        onClick={() => setPage(page - 1)}
                        disabled={page === 1}
                        aria-label="이전"
                      >
                        <span aria-hidden="true">&lsaquo;</span>
                      </button>
                    </li>

                    {page > 3 && (
                      <li className="page-item disabled">
                        <span className="page-link">...</span>
                      </li>
                    )}

                    {getPageNumbers().map((pageNum) => (
                      <li key={pageNum} className={`page-item ${page === pageNum ? 'active' : ''}`}>
                        <button className="page-link" onClick={() => setPage(pageNum)}>
                          {pageNum}
                        </button>
                      </li>
                    ))}

                    {page < totalPages - 2 && (
                      <li className="page-item disabled">
                        <span className="page-link">...</span>
                      </li>
                    )}

                    <li className={`page-item ${page === totalPages ? 'disabled' : ''}`}>
                      <button
                        className="page-link"
                        onClick={() => setPage(page + 1)}
                        disabled={page === totalPages}
                        aria-label="다음"
                      >
                        <span aria-hidden="true">&rsaquo;</span>
                      </button>
                    </li>

                    <li className={`page-item ${page === totalPages ? 'disabled' : ''}`}>
                      <button
                        className="page-link"
                        onClick={() => setPage(totalPages)}
                        disabled={page === totalPages}
                        aria-label="마지막"
                      >
                        <span aria-hidden="true">&raquo;</span>
                      </button>
                    </li>
                  </ul>
                </nav>
              )}
            </>
          )}
        </section>
      </div>

      {/* Recipe Generate Modal */}
      {showGenerateModal && (
        <RecipeGenerateModal
          onClose={() => {
            setShowGenerateModal(false);
            setInitialPrompt('');
          }}
          onRecipeGenerated={handleRecipeGenerated}
          initialPrompt={initialPrompt}
        />
      )}
    </>
  );
}
