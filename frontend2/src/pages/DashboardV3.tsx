import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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


  return (
    <div className="container" style={{ padding: 'var(--spacing-4)' }}>
      <div className="text-center mb-5" style={{ marginTop: 'var(--spacing-6)' }}>
        <h1
          className="display-4 mb-3"
          style={{
            fontWeight: 'var(--font-weight-bold)',
            background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          레시피 모음
        </h1>
        <p className="text-muted" style={{ fontSize: 'var(--font-size-lg)' }}>
          {isSearching
            ? `"${searchQuery}" 검색 결과: ${displayTotal}개`
            : `총 ${total}개의 레시피`}
        </p>
      </div>

      {/* Search Bar */}
      <div className="row justify-content-center mb-5">
        <div className="col-12">
          <div
            className="input-group input-group-lg"
            style={{
              boxShadow: 'var(--shadow-lg)',
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
            }}
          >
            <input
              type="text"
              className="form-control"
              placeholder="레시피 검색... (예: 김치, 찌개, 볶음)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              style={{
                border: 'none',
                padding: 'var(--spacing-4) var(--spacing-5)',
                fontSize: 'var(--font-size-lg)',
                borderRight: '1px solid var(--color-border-light)',
              }}
            />
            <button
              className="btn btn-primary"
              type="button"
              onClick={handleSearch}
              disabled={loading}
              style={{
                padding: 'var(--spacing-4) var(--spacing-6)',
                fontWeight: 'var(--font-weight-medium)',
                fontSize: 'var(--font-size-base)',
                border: 'none',
                backgroundColor: 'var(--color-primary)',
                color: 'white',
              }}
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
              <button
                className="btn btn-outline-secondary"
                type="button"
                onClick={clearSearch}
                style={{
                  padding: 'var(--spacing-4) var(--spacing-5)',
                  fontWeight: 'var(--font-weight-medium)',
                  border: 'none',
                  borderLeft: '1px solid var(--color-border-light)',
                }}
              >
                초기화
              </button>
            )}
          </div>
        </div>
      </div>

      {/* AI Recipe Generation Button */}
      <div className="d-flex justify-content-center mb-5">
        <button
          className="btn btn-success btn-lg"
          onClick={() => setShowGenerateModal(true)}
          style={{
            background: 'var(--color-primary)',
            border: 'none',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--spacing-4) var(--spacing-8)',
            fontWeight: 'var(--font-weight-bold)',
            fontSize: 'var(--font-size-lg)',
            boxShadow: 'var(--shadow-lg)',
            transition: 'all var(--transition-base)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = 'var(--shadow-xl)';
            e.currentTarget.style.background = 'var(--color-primary-dark)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
            e.currentTarget.style.background = 'var(--color-primary)';
          }}
        >
          ✨ AI로 새 레시피 생성하기
        </button>
      </div>

      <section className="my-5">
        {loading ? (
          <div className="text-center py-5">
            <div
              className="spinner-border"
              role="status"
              style={{
                width: '3rem',
                height: '3rem',
                color: 'var(--color-primary)',
                borderWidth: '4px',
              }}
            >
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className="mt-4 text-muted" style={{ fontSize: 'var(--font-size-lg)' }}>
              레시피를 불러오는 중...
            </p>
          </div>
        ) : isSearching && !hasSearchResults ? (
          // No search results - suggest AI generation
          <div className="text-center py-5">
            <div
              className="alert d-inline-block"
              role="alert"
              style={{
                background: 'linear-gradient(135deg, rgba(255, 217, 61, 0.1) 0%, rgba(255, 217, 61, 0.05) 100%)',
                border: '2px solid var(--color-accent)',
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--spacing-8)',
                maxWidth: '600px',
              }}
            >
              <h4 className="alert-heading" style={{ fontSize: 'var(--font-size-2xl)' }}>
                😔 검색 결과가 없습니다
              </h4>
              <p className="mb-3" style={{ fontSize: 'var(--font-size-lg)' }}>
                "<strong>{searchQuery}</strong>" 레시피를 찾을 수 없습니다.
              </p>
              <hr style={{ borderColor: 'var(--color-accent)', opacity: 0.3 }} />
              <p className="mb-3" style={{ fontSize: 'var(--font-size-lg)' }}>
                💡 원하는 레시피가 없나요?
              </p>
              <p className="mb-4" style={{ fontSize: 'var(--font-size-base)' }}>
                AI가 맞춤 레시피를 만들어드릴게요!
              </p>
              <button
                className="btn btn-success btn-lg"
                onClick={handleCreateWithAI}
                style={{
                  background: 'var(--color-primary)',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--spacing-3) var(--spacing-6)',
                  fontWeight: 'var(--font-weight-bold)',
                }}
              >
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
              <div className="d-flex justify-content-between align-items-center mb-4">
                <p className="text-muted mb-0" style={{ fontSize: 'var(--font-size-sm)' }}>
                  {(page - 1) * limit + 1} - {Math.min(page * limit, total)} / {total}개 표시 중
                </p>
                <p className="text-muted mb-0" style={{ fontSize: 'var(--font-size-sm)' }}>
                  페이지 {page} / {totalPages}
                </p>
              </div>
            )}

            {/* Recipe List Section with Gray Background */}
            <div
              style={{
                backgroundColor: '#f8f9fa',
                padding: '1.5rem',
                minHeight: '60vh',
                boxShadow: '0 -4px 20px rgba(0,0,0,0.02)'
              }}
            >
              {/* Recipe grid with stagger animation */}
              <div className="row stagger-animation">
                {displayRecipes.map((recipe) => (
                  <div className="col-12 mb-3" key={recipe.recipeId}>
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
                <nav aria-label="레시피 페이지네이션" className="mt-4">
                  <ul className="pagination justify-content-center">
                    <li className={`page-item ${page === 1 ? 'disabled' : ''}`}>
                      <button
                        className="page-link"
                        onClick={() => setPage(1)}
                        disabled={page === 1}
                        aria-label="처음"
                        style={{ borderRadius: '50%', width: '36px', height: '36px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 4px' }}
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
                        style={{ borderRadius: '50%', width: '36px', height: '36px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 4px' }}
                      >
                        <span aria-hidden="true">&lsaquo;</span>
                      </button>
                    </li>

                    {[...Array(5)].map((_, i) => {
                      const pageNum = page - 2 + i;
                      if (pageNum > 0 && pageNum <= totalPages) {
                        return (
                          <li key={pageNum} className={`page-item ${page === pageNum ? 'active' : ''}`}>
                            <button
                              className="page-link"
                              onClick={() => setPage(pageNum)}
                              style={{
                                borderRadius: '50%',
                                width: '36px',
                                height: '36px',
                                padding: 0,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 4px',
                                backgroundColor: page === pageNum ? 'var(--color-primary)' : 'white',
                                borderColor: page === pageNum ? 'var(--color-primary)' : '#dee2e6',
                                color: page === pageNum ? 'white' : 'var(--color-primary)'
                              }}
                            >
                              {pageNum}
                            </button>
                          </li>
                        );
                      }
                      return null;
                    })}

                    <li className={`page-item ${page === totalPages ? 'disabled' : ''}`}>
                      <button
                        className="page-link"
                        onClick={() => setPage(page + 1)}
                        disabled={page === totalPages}
                        aria-label="다음"
                        style={{ borderRadius: '50%', width: '36px', height: '36px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 4px' }}
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
                        style={{ borderRadius: '50%', width: '36px', height: '36px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 4px' }}
                      >
                        <span aria-hidden="true">&raquo;</span>
                      </button>
                    </li>
                  </ul>
                </nav>
              )}
            </div>
          </>
        )}
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
      </section>
    </div>
  );
}
