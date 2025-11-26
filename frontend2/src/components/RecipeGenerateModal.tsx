/**
 * Recipe Generate Modal
 * AI-powered recipe generation interface
 */

import { useState } from 'react';

interface RecipeGenerateModalProps {
  onClose: () => void;
  onRecipeGenerated: (recipeId: string) => void;
  initialPrompt?: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

export function RecipeGenerateModal({ onClose, onRecipeGenerated, initialPrompt = '' }: RecipeGenerateModalProps) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedRecipe, setGeneratedRecipe] = useState<any | null>(null);

  const examplePrompts = [
    '1인분 원팬 명란 알리오 올리오',
    '감자 활용 다이어트 레시피',
    '3인분 등촌 샤브샤브',
    '2인분 돼지고기 김치찌개',
    '순두부 활용 단백질 많은 레시피'
  ];

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('요리 이름을 입력해주세요');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('[RecipeGenerateModal] Generating recipe:', prompt);

      const response = await fetch(`${API_BASE_URL}/api/recipes/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ prompt })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to generate recipe');
      }

      const data = await response.json();

      console.log('[RecipeGenerateModal] Recipe generated:', data);

      setGeneratedRecipe(data);
    } catch (err: any) {
      console.error('[RecipeGenerateModal] Generation failed:', err);
      setError(err.message || 'Failed to generate recipe');
    } finally {
      setLoading(false);
    }
  };

  const handleStartCooking = () => {
    if (generatedRecipe) {
      onRecipeGenerated(generatedRecipe.recipe_id);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) {
      handleGenerate();
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="modal-backdrop fade show"
        onClick={onClose}
        style={{ zIndex: 1040 }}
      ></div>

      {/* Modal */}
      <div
        className="modal fade show d-block"
        tabIndex={-1}
        style={{ zIndex: 1050 }}
      >
        <div className="modal-dialog modal-lg modal-dialog-scrollable">
          <div className="modal-content">
            {/* Header */}
            <div className="modal-header text-white" style={{ background: 'var(--color-primary)' }}>
              <h5 className="modal-title">✨ AI 레시피 생성</h5>
              <button
                type="button"
                className="btn-close btn-close-white"
                onClick={onClose}
                aria-label="Close"
                disabled={loading}
              ></button>
            </div>

            {/* Body */}
            <div className="modal-body">
              {!generatedRecipe ? (
                <>
                  {/* Input Section */}
                  <div className="mb-4">
                    <label htmlFor="recipePrompt" className="form-label">
                      어떤 요리를 만들고 싶으세요?
                    </label>
                    <input
                      type="text"
                      className="form-control form-control-lg"
                      id="recipePrompt"
                      placeholder="예: 자취생이 1인분 30분 이내로 간단하게 먹기 좋은 맛있는 파스타 레시피"
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      onKeyPress={handleKeyPress}
                      disabled={loading}
                      autoFocus
                    />
                  </div>

                  {/* Example Prompts */}
                  <div className="mb-4">
                    <p className="text-muted small mb-2">💡 예시:</p>
                    <div className="d-flex flex-wrap gap-2">
                      {examplePrompts.map((example, index) => (
                        <button
                          key={index}
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => setPrompt(example)}
                          disabled={loading}
                        >
                          {example}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Error Message */}
                  {error && (
                    <div className="alert alert-danger" role="alert">
                      ❌ {error}
                    </div>
                  )}

                  {/* Loading State */}
                  {loading && (
                    <div className="text-center py-4">
                      <div className="spinner-border text-primary mb-3" role="status">
                        <span className="visually-hidden">Loading...</span>
                      </div>
                      <p className="text-muted">
                        AI가 레시피를 생성하고 있습니다...<br />
                        <small>약 5-10초 소요됩니다</small>
                      </p>
                    </div>
                  )}

                  {/* Info Box */}
                  {!loading && (
                    <div className="alert alert-success" style={{ backgroundColor: 'rgba(255, 107, 53, 0.1)', borderColor: 'rgba(255, 107, 53, 0.2)', color: 'var(--color-primary-dark)' }}>
                      <h6 className="alert-heading">ℹ️ AI 레시피 생성 안내</h6>
                      <ul className="mb-0 small">
                        <li>Recipe Creator가 한국 요리 레시피를 자동으로 생성합니다</li>
                        <li>재료, 조리 단계, 팁까지 모두 포함됩니다</li>
                        <li>생성 후 바로 음성 가이드 요리를 시작할 수 있습니다</li>
                      </ul>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {/* Generated Recipe Display */}
                  <div className="alert" style={{ backgroundColor: 'rgba(255, 107, 53, 0.1)', borderColor: 'rgba(255, 107, 53, 0.2)', color: 'var(--color-primary-dark)' }}>
                    <h5 className="alert-heading">✅ 레시피 생성 완료!</h5>
                    <p className="mb-0">
                      <strong>{generatedRecipe.title}</strong> 레시피가 생성되었습니다.
                    </p>
                  </div>

                  <div className="card mb-3">
                    <div className="card-body">
                      <h6 className="card-title">📋 생성된 레시피</h6>
                      <p className="card-text">
                        <strong>레시피 ID:</strong> {generatedRecipe.recipe_id}
                        <br />
                        <strong>제목:</strong> {generatedRecipe.title}
                        <br />
                        <strong>상태:</strong>{' '}
                        <span className="badge bg-primary">Planning 완료</span>
                      </p>
                    </div>
                  </div>

                  <div className="alert alert-warning">
                    <strong>🎉 바로 요리를 시작할 수 있습니다!</strong>
                    <p className="mb-0 small mt-2">
                      AI가 레시피를 생성하고 음성 가이드까지 준비했습니다.
                      <br />
                      "요리 시작하기" 버튼을 눌러 음성 안내와 함께 요리를 시작하세요!
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="modal-footer">
              {!generatedRecipe ? (
                <>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={onClose}
                    disabled={loading}
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleGenerate}
                    disabled={loading || !prompt.trim()}
                  >
                    {loading ? (
                      <>
                        <span
                          className="spinner-border spinner-border-sm me-2"
                          role="status"
                          aria-hidden="true"
                        ></span>
                        생성 중...
                      </>
                    ) : (
                      '✨ 레시피 생성하기'
                    )}
                  </button>
                </>
              ) : (
                <>
                  <button type="button" className="btn btn-secondary" onClick={onClose}>
                    닫기
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-lg"
                    onClick={handleStartCooking}
                  >
                    🍳 요리 시작하기
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
