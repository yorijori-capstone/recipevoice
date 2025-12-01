import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getApiBaseUrl } from '../utils/api';

interface YoutubeVideo {
    videoId: string;
    title: string;
    description: string;
    thumbnailUrl: string | null;
    channelTitle: string;
    channelId: string;
    publishedAt: string;
}

// Helper function to decode HTML entities
function decodeHtmlEntities(text: string): string {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    return textarea.value;
}

export function YoutubeSearch() {
    const navigate = useNavigate();
    const [query, setQuery] = useState('');
    const [videos, setVideos] = useState<YoutubeVideo[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [importing, setImporting] = useState<string | null>(null);
    const [importProgress, setImportProgress] = useState<string>('');

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim()) return;

        setLoading(true);
        setError('');
        setVideos([]);

        try {
            const API_BASE_URL = getApiBaseUrl();
            const response = await fetch(
                `${API_BASE_URL}/api/youtube/search?query=${encodeURIComponent(query)}&limit=5&captionFilter=true`
            );

            if (!response.ok) {
                throw new Error('검색에 실패했습니다');
            }

            const data = await response.json();
            if (data.success) {
                setVideos(data.results);
            } else {
                setError(data.message || '검색에 실패했습니다');
            }
        } catch (err: any) {
            setError(err.message || '검색 중 오류가 발생했습니다');
        } finally {
            setLoading(false);
        }
    };

    const handleImport = async (videoId: string) => {
        setImporting(videoId);
        setError('');
        setImportProgress('영상 정보를 가져오는 중...');

        try {
            const API_BASE_URL = getApiBaseUrl();

            // Simulate progress updates
            setTimeout(() => setImportProgress('댓글에서 재료 정보를 찾는 중...'), 500);
            setTimeout(() => setImportProgress('자막을 가져오는 중...'), 1500);
            setTimeout(() => setImportProgress('레시피를 분석하는 중...'), 3000);

            const response = await fetch(`${API_BASE_URL}/api/youtube/import`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    videoId,
                    language: 'ko',
                    searchQuery: query,
                }),
            });

            if (!response.ok) {
                throw new Error('레시피 가져오기에 실패했습니다');
            }

            const data = await response.json();
            if (data.success) {
                setImportProgress('완료!');
                setTimeout(() => {
                    alert(`레시피 "${data.title}"을(를) 성공적으로 가져왔습니다!`);
                    navigate('/');
                }, 500);
            } else {
                setError(data.message || '레시피 가져오기에 실패했습니다');
            }
        } catch (err: any) {
            setError(err.message || '레시피 가져오기 중 오류가 발생했습니다');
        } finally {
            setTimeout(() => {
                setImporting(null);
                setImportProgress('');
            }, 1000);
        }
    };

    return (
        <div style={{ width: '100%', maxWidth: '1200px', margin: '0 auto', padding: '40px 20px' }}>
            <h2 className="mb-4" style={{ fontWeight: 'var(--font-weight-bold)' }}>
                🎬 YouTube 레시피 검색
            </h2>

            <form onSubmit={handleSearch} className="mb-4">
                <div className="input-group input-group-lg">
                    <input
                        type="text"
                        className="form-control"
                        placeholder="레시피 검색... (예: 김치찌개, 떡볶이)"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        style={{ borderRadius: 'var(--radius-md) 0 0 var(--radius-md)' }}
                    />
                    <button
                        className="btn btn-primary px-4"
                        type="submit"
                        disabled={loading || !query.trim()}
                        style={{ borderRadius: '0 var(--radius-md) var(--radius-md) 0' }}
                    >
                        {loading ? '검색 중...' : '검색'}
                    </button>
                </div>
            </form>

            {error && (
                <div className="alert alert-danger" role="alert">
                    {error}
                </div>
            )}

            {videos.length > 0 && (
                <div className="d-flex flex-column gap-3">
                    {videos.map((video) => {
                        const decodedTitle = decodeHtmlEntities(video.title);
                        const decodedDescription = decodeHtmlEntities(video.description || '');
                        const decodedChannelTitle = decodeHtmlEntities(video.channelTitle);

                        return (
                        <div key={video.videoId} className="card shadow-sm border-0" style={{ borderRadius: 'var(--radius-lg)' }}>
                            <div className="card-body p-3">
                                <div style={{
                                    display: 'flex',
                                    gap: '16px',
                                    alignItems: 'flex-start'
                                }}>
                                    {/* Thumbnail */}
                                    <div style={{
                                        flexShrink: 0,
                                        width: '240px'
                                    }}>
                                        {video.thumbnailUrl && (
                                            <img
                                                src={video.thumbnailUrl}
                                                alt={decodedTitle}
                                                style={{
                                                    width: '100%',
                                                    borderRadius: 'var(--radius-md)',
                                                    objectFit: 'cover',
                                                    aspectRatio: '16/9',
                                                    display: 'block'
                                                }}
                                            />
                                        )}
                                    </div>

                                    {/* Content */}
                                    <div style={{
                                        flex: '1',
                                        minWidth: 0
                                    }}>
                                        <h5 style={{
                                            fontWeight: 'var(--font-weight-semibold)',
                                            marginBottom: '8px',
                                            wordBreak: 'keep-all',
                                            overflowWrap: 'break-word',
                                            lineHeight: '1.4'
                                        }}>
                                            {decodedTitle}
                                        </h5>
                                        <p style={{
                                            fontSize: '0.875rem',
                                            color: '#6c757d',
                                            marginBottom: '8px',
                                            wordBreak: 'keep-all',
                                            overflowWrap: 'break-word'
                                        }}>
                                            <strong>{decodedChannelTitle}</strong>
                                        </p>
                                        <p style={{
                                            fontSize: '0.875rem',
                                            color: '#6c757d',
                                            marginBottom: '12px',
                                            display: '-webkit-box',
                                            WebkitLineClamp: 2,
                                            WebkitBoxOrient: 'vertical',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            wordBreak: 'keep-all',
                                            overflowWrap: 'break-word'
                                        }}>
                                            {decodedDescription || '설명이 없습니다'}
                                        </p>
                                        <div style={{
                                            display: 'flex',
                                            flexWrap: 'wrap',
                                            gap: '8px'
                                        }}>
                                            <a
                                                href={`https://www.youtube.com/watch?v=${video.videoId}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="btn btn-outline-secondary btn-sm"
                                                style={{ borderRadius: 'var(--radius-sm)' }}
                                            >
                                                YouTube에서 보기
                                            </a>
                                            <button
                                                className="btn btn-primary btn-sm"
                                                onClick={() => handleImport(video.videoId)}
                                                disabled={importing === video.videoId}
                                                style={{ borderRadius: 'var(--radius-sm)' }}
                                            >
                                                {importing === video.videoId ? '가져오는 중...' : '레시피로 가져오기'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        );
                    })}
                </div>
            )}

            {!loading && videos.length === 0 && query && (
                <div className="text-center text-muted py-5">
                    <div style={{ fontSize: '3rem' }}>🔍</div>
                    <p>검색 결과가 없습니다</p>
                </div>
            )}

            {!loading && !query && (
                <div className="text-center text-muted py-5">
                    <div style={{ fontSize: '3rem' }}>📺</div>
                    <p>YouTube에서 레시피를 검색해보세요!</p>
                </div>
            )}

            {/* Import Progress Modal */}
            {importing && (
                <div
                    className="modal d-block"
                    style={{
                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1050
                    }}
                >
                    <div
                        className="modal-dialog modal-dialog-centered"
                        style={{ maxWidth: '400px', margin: 'auto' }}
                    >
                        <div className="modal-content" style={{ borderRadius: 'var(--radius-lg)' }}>
                            <div className="modal-body text-center p-4">
                                <div className="mb-3">
                                    <div
                                        className="spinner-border text-primary"
                                        role="status"
                                        style={{ width: '3rem', height: '3rem' }}
                                    >
                                        <span className="visually-hidden">Loading...</span>
                                    </div>
                                </div>
                                <h5 className="mb-3" style={{ fontWeight: 'var(--font-weight-semibold)' }}>
                                    레시피 가져오는 중...
                                </h5>
                                <p className="text-muted mb-0" style={{ fontSize: '0.9rem' }}>
                                    {importProgress}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
