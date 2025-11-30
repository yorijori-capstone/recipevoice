import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getApiBaseUrl } from '../utils/api';

const API_BASE_URL = getApiBaseUrl();

interface YoutubeSearchResult {
  videoId: string;
  title: string;
  description: string;
  thumbnailUrl: string | null;
  channelTitle: string;
  channelId: string;
  publishedAt: string;
}

interface ImportSuccessData {
  recipeId: string;
  cleanedRecipeId: number;
  title: string;
}

export function YoutubeSearch() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<YoutubeSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importingVideoId, setImportingVideoId] = useState<string | null>(null);
  const [importedData, setImportedData] = useState<ImportSuccessData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setError('검색어는 최소 2자 이상이어야 합니다.');
      return;
    }

    setLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/youtube/search?query=${encodeURIComponent(searchQuery.trim())}&limit=5&captionFilter=true`
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'YouTube 검색에 실패했습니다.');
      }

      setSearchResults(data.results || []);
      if (data.results && data.results.length === 0) {
        setError('검색 결과가 없습니다. 다른 검색어를 시도해보세요.');
      }
    } catch (err: any) {
      console.error('[YoutubeSearch] Search error:', err);
      setError(err.message || 'YouTube 검색 중 오류가 발생했습니다.');
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !loading) {
      handleSearch();
    }
  };

  const handleImport = async (video: YoutubeSearchResult) => {
    setImporting(true);
    setImportingVideoId(video.videoId);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/youtube/import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoId: video.videoId,
          language: 'ko',
          searchQuery: searchQuery,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || '레시피 가져오기에 실패했습니다.');
      }

      setImportedData({
        recipeId: data.recipeId,
        cleanedRecipeId: data.cleanedRecipeId,
        title: data.title,
      });
    } catch (err: any) {
      console.error('[YoutubeSearch] Import error:', err);
      setError(err.message || '레시피 가져오기 중 오류가 발생했습니다.');
    } finally {
      setImporting(false);
      setImportingVideoId(null);
    }
  };

  const handleStartCooking = () => {
    if (importedData) {
      navigate(`/cooking/${importedData.recipeId}`);
    }
  };

  const handleCloseSuccessModal = () => {
    setImportedData(null);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return '오늘';
    if (diffDays === 1) return '어제';
    if (diffDays < 7) return `${diffDays}일 전`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}주 전`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}개월 전`;
    return `${Math.floor(diffDays / 365)}년 전`;
  };

  return (
    <div className="container" style={{ padding: 'var(--spacing-4)', maxWidth: '480px', margin: '0 auto' }}>
      {/* Header */}
      <div className="text-center mb-4" style={{ marginTop: 'var(--spacing-4)' }}>
        <h2 className="mb-2" style={{ fontWeight: 'var(--font-weight-bold)', fontSize: 'var(--font-size-2xl)' }}>
          📺 YouTube 레시피 검색
        </h2>
        <p className="text-muted" style={{ fontSize: 'var(--font-size-sm)' }}>
          YouTube에서 레시피를 검색하고 가져오세요
        </p>
      </div>

      {/* Search Bar */}
      <div className="mb-4">
        <div
          className="input-group"
          style={{
            boxShadow: '0 2px 12px rgba(181, 181, 181, 0.26)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
          }}
        >
          <input
            type="text"
            className="form-control"
            placeholder="레시피 검색... (예: 계란찜, 김치찌개)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            style={{
              border: 'none',
              padding: 'var(--spacing-3) var(--spacing-4)',
              fontSize: 'var(--font-size-lg)',
              borderRight: '1px solid var(--color-border-light)',
            }}
          />
          <button
            className="btn btn-primary"
            type="button"
            onClick={handleSearch}
            disabled={loading || !searchQuery.trim()}
            style={{
              padding: 'var(--spacing-3) var(--spacing-5)',
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
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="alert alert-danger mb-4" role="alert" style={{ borderRadius: 'var(--radius-md)' }}>
          <div className="d-flex justify-content-between align-items-center">
            <span>{error}</span>
            <button
              type="button"
              className="btn-close"
              onClick={() => setError(null)}
              aria-label="Close"
            ></button>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="text-center py-5">
          <div className="spinner-border text-primary mb-3" role="status" style={{ width: '3rem', height: '3rem' }}>
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="text-muted">YouTube에서 레시피를 검색하는 중...</p>
        </div>
      )}

      {/* Empty State (Before Search) */}
      {!hasSearched && !loading && (
        <div className="text-center py-5">
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>📺</div>
          <p className="text-muted mb-4">
            검색어를 입력하고 검색 버튼을 눌러주세요.
            <br />
            <small>예: 계란찜, 김치찌개, 파스타</small>
          </p>
        </div>
      )}

      {/* Empty State (No Results) */}
      {hasSearched && !loading && searchResults.length === 0 && !error && (
        <div className="text-center py-5">
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔍</div>
          <p className="text-muted mb-4">검색 결과가 없습니다.</p>
          <button className="btn btn-outline-primary" onClick={() => setSearchQuery('')}>
            다른 검색어로 검색
          </button>
        </div>
      )}

      {/* Search Results */}
      {!loading && searchResults.length > 0 && (
        <div className="mb-4">
          <p className="text-muted mb-3" style={{ fontSize: 'var(--font-size-sm)' }}>
            검색 결과: {searchResults.length}개
          </p>
          <div className="d-flex flex-column gap-3">
            {searchResults.map((video) => (
              <div
                key={video.videoId}
                className="card"
                style={{
                  borderRadius: 'var(--radius-lg)',
                  border: 'none',
                  boxShadow: 'var(--shadow-card)',
                  overflow: 'hidden',
                  background: 'white',
                }}
              >
                <div className="d-flex align-items-start p-3">
                  {/* Thumbnail */}
                  <div
                    className="flex-shrink-0 me-3"
                    style={{
                      width: '80px',
                      height: '80px',
                      borderRadius: 'var(--radius-md)',
                      overflow: 'hidden',
                      background: 'var(--color-background)',
                    }}
                  >
                    {video.thumbnailUrl ? (
                      <img
                        src={video.thumbnailUrl}
                        alt={video.title}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        }}
                      />
                    ) : (
                      <div
                        className="d-flex align-items-center justify-content-center h-100"
                        style={{
                          background: 'linear-gradient(135deg, #FFE5D9 0%, #FFF0E6 100%)',
                          fontSize: '2rem',
                        }}
                      >
                        📺
                      </div>
                    )}
                  </div>

                  {/* Video Info */}
                  <div className="flex-grow-1 min-width-0">
                    <h6
                      className="mb-1"
                      style={{
                        fontSize: 'var(--font-size-base)',
                        fontWeight: 'var(--font-weight-semibold)',
                        color: 'var(--color-text-primary)',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        lineHeight: '1.3',
                      }}
                    >
                      {video.title}
                    </h6>
                    <p
                      className="text-muted mb-1"
                      style={{
                        fontSize: 'var(--font-size-sm)',
                        margin: 0,
                        display: '-webkit-box',
                        WebkitLineClamp: 1,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {video.channelTitle}
                    </p>
                    <p
                      className="text-muted mb-2"
                      style={{
                        fontSize: 'var(--font-size-xs)',
                        margin: 0,
                      }}
                    >
                      {formatDate(video.publishedAt)}
                    </p>
                    <div className="d-flex gap-2">
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleImport(video)}
                        disabled={importing}
                        style={{
                          fontSize: 'var(--font-size-sm)',
                          padding: 'var(--spacing-1) var(--spacing-3)',
                          borderRadius: 'var(--radius-md)',
                        }}
                      >
                        {importing && importingVideoId === video.videoId ? (
                          <>
                            <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                            가져오는 중...
                          </>
                        ) : (
                          '레시피로 가져오기'
                        )}
                      </button>
                      <a
                        href={`https://www.youtube.com/watch?v=${video.videoId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-sm"
                        style={{
                          fontSize: 'var(--font-size-sm)',
                          padding: 'var(--spacing-1) var(--spacing-3)',
                          borderRadius: 'var(--radius-md)',
                          backgroundColor: 'white',
                          color: 'var(--color-primary)',
                          border: '1px solid var(--color-primary)',
                          textDecoration: 'none',
                        }}
                      >
                        영상 보기
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Import Success Modal */}
      {importedData && (
        <div
          className="modal show d-block"
          tabIndex={-1}
          style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}
          onClick={handleCloseSuccessModal}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div
              className="modal-content"
              style={{ borderRadius: 'var(--radius-lg)', border: 'none' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title fw-bold">✅ 레시피 가져오기 완료</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={handleCloseSuccessModal}
                  aria-label="Close"
                ></button>
              </div>
              <div className="modal-body text-center py-4">
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎉</div>
                <h6 className="mb-2">{importedData.title}</h6>
                <p className="text-muted mb-0">레시피가 성공적으로 가져와졌습니다!</p>
              </div>
              <div className="modal-footer border-0 pt-0 justify-content-center gap-2 pb-4">
                <button
                  type="button"
                  className="btn btn-light px-4 rounded-pill"
                  onClick={handleCloseSuccessModal}
                >
                  다른 레시피 보기
                </button>
                <button
                  type="button"
                  className="btn btn-primary px-4 rounded-pill"
                  onClick={handleStartCooking}
                >
                  요리 시작
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
