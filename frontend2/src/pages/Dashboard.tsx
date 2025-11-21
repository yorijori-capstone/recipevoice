import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { SearchBar } from '../components/SearchBar';
import { RecipeCard } from '../components/RecipeCard';
import { RecipeGenerateModal } from '../components/RecipeGenerateModal';

interface Recipe {
  id: number;
  recipe_id: string;
  title: string;
  servings: string;
  cook_time: string;
  difficulty: string;
}

export function Dashboard() {
  const navigate = useNavigate();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const limit = 24; // 페이지당 24개 (3x8 그리드)

  useEffect(() => {
    const fetchRecipes = async () => {
      setLoading(true);
      try {
        const offset = (page - 1) * limit;
        const response = await fetch(`/api/recipes/?limit=${limit}&offset=${offset}`);
        const data = await response.json();
        setRecipes(data.recipes);
        setTotal(data.total);
      } catch (error) {
        console.error("Error fetching recipes:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchRecipes();
    
    // 페이지 변경 시 맨 위로 스크롤
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [page]);

  const totalPages = Math.ceil(total / limit);

  // 페이지 번호 표시 로직 (최대 5개만 표시)
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

  const handleRecipeGenerated = (recipeId: string) => {
    setShowGenerateModal(false);
    // Navigate to cooking mode with generated recipe
    navigate(`/cooking/${recipeId}`);
  };

  return (
    <>
      <Navbar />
      <div className="container">
        <div className="text-center mb-4">
          <h1 className="display-4">레시피 모음</h1>
          <p className="text-muted">총 {total}개의 레시피</p>
        </div>

        {/* AI Recipe Generation Button */}
        <div className="d-flex justify-content-center mb-4">
          <button
            className="btn btn-success btn-lg"
            onClick={() => setShowGenerateModal(true)}
          >
            🤖 AI로 새 레시피 생성하기
          </button>
        </div>

        <SearchBar />
        
        <section className="my-5">
          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status" style={{ width: '3rem', height: '3rem' }}>
                <span className="visually-hidden">Loading...</span>
              </div>
              <p className="mt-3 text-muted">레시피를 불러오는 중...</p>
            </div>
          ) : recipes.length === 0 ? (
            <div className="text-center py-5">
              <p className="text-muted fs-5">레시피가 없습니다.</p>
            </div>
          ) : (
            <>
              {/* 현재 페이지 정보 */}
              <div className="d-flex justify-content-between align-items-center mb-3">
                <p className="text-muted mb-0">
                  {(page - 1) * limit + 1} - {Math.min(page * limit, total)} / {total}개 표시 중
                </p>
                <p className="text-muted mb-0">
                  페이지 {page} / {totalPages}
                </p>
              </div>

              {/* 레시피 그리드 */}
              <div className="row">
                {recipes.map((recipe) => (
                  <div className="col-lg-4 col-md-6 mb-4" key={recipe.recipe_id}>
                    <RecipeCard 
                      id={recipe.id}
                      recipe_id={recipe.recipe_id}
                      title={recipe.title}
                      cookTime={recipe.cook_time}
                      difficulty={recipe.difficulty}
                      servings={recipe.servings}
                    />
                  </div>
                ))}
              </div>

              {/* 페이지네이션 */}
              {totalPages > 1 && (
                <nav aria-label="레시피 페이지네이션" className="mt-5">
                  <ul className="pagination justify-content-center">
                    {/* 처음 페이지 */}
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

                    {/* 이전 페이지 */}
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

                    {/* 페이지 번호들 */}
                    {page > 3 && (
                      <li className="page-item disabled">
                        <span className="page-link">...</span>
                      </li>
                    )}

                    {getPageNumbers().map((pageNum) => (
                      <li 
                        key={pageNum} 
                        className={`page-item ${page === pageNum ? 'active' : ''}`}
                      >
                        <button 
                          className="page-link" 
                          onClick={() => setPage(pageNum)}
                        >
                          {pageNum}
                        </button>
                      </li>
                    ))}

                    {page < totalPages - 2 && (
                      <li className="page-item disabled">
                        <span className="page-link">...</span>
                      </li>
                    )}

                    {/* 다음 페이지 */}
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

                    {/* 마지막 페이지 */}
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
          onClose={() => setShowGenerateModal(false)}
          onRecipeGenerated={handleRecipeGenerated}
        />
      )}
    </>
  );
}