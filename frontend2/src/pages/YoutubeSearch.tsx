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

export function YoutubeSearch() {
    const navigate = useNavigate();
    const [query, setQuery] = useState('');
    const [videos, setVideos] = useState<YoutubeVideo[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [importing, setImporting] = useState<string | null>(null);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim()) return;

        setLoading(true);
        setError('');
        setVideos([]);

        try {
            const API_BASE_URL = getApiBaseUrl();
            const response = await fetch(
                `${API_BASE_URL}/api/youtube/search?query=${encodeURIComponent(query)}&limit=5`
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

    const handleImport = async (videoId: string, title: string) => {
        setImporting(videoId);
        setError('');

        try {
            const API_BASE_URL = getApiBaseUrl();
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
                alert(`레시피 "${data.title}"을(를) 성공적으로 가져왔습니다!`);
                navigate('/');
            } else {
                setError(data.message || '레시피 가져오기에 실패했습니다');
            }
        } catch (err: any) {
            setError(err.message || '레시피 가져오기 중 오류가 발생했습니다');
        } finally {
            setImporting(null);
        }
    };

    return (
        <div className="container mt-5">
            <div className="row">
                <div className="col-12 col-lg-10 offset-lg-1 col-xl-8 offset-xl-2">
                    <div className="d-flex align-items-center mb-4">
                        <button
                            className="btn btn-outline-secondary me-3"
                            onClick={() => navigate('/')}
                            style={{ borderRadius: 'var(--radius-md)' }}
                        >
                            ← 돌아가기
                        </button>
                        <h2 className="mb-0" style={{ fontWeight: 'var(--font-weight-bold)' }}>
                            🎬 YouTube 레시피 검색
                        </h2>
                    </div>

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
                        <div className="row g-3">
                            {videos.map((video) => (
                                <div key={video.videoId} className="col-12">
                                    <div className="card shadow-sm border-0" style={{ borderRadius: 'var(--radius-lg)' }}>
                                        <div className="card-body p-3">
                                            <div className="row g-3">
                                                <div className="col-12 col-md-4">
                                                    {video.thumbnailUrl && (
                                                        <img
                                                            src={video.thumbnailUrl}
                                                            alt={video.title}
                                                            className="img-fluid w-100"
                                                            style={{ borderRadius: 'var(--radius-md)', objectFit: 'cover', height: '150px' }}
                                                        />
                                                    )}
                                                </div>
                                                <div className="col-12 col-md-8">
                                                    <h5 className="card-title mb-2" style={{ fontWeight: 'var(--font-weight-semibold)' }}>
                                                        {video.title}
                                                    </h5>
                                                    <p className="text-muted small mb-2">
                                                        <strong>{video.channelTitle}</strong>
                                                    </p>
                                                    <p className="card-text text-muted small mb-3" style={{
                                                        display: '-webkit-box',
                                                        WebkitLineClamp: 2,
                                                        WebkitBoxOrient: 'vertical',
                                                        overflow: 'hidden'
                                                    }}>
                                                        {video.description || '설명이 없습니다'}
                                                    </p>
                                                    <div className="d-flex gap-2">
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
                                                            onClick={() => handleImport(video.videoId, video.title)}
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
                                </div>
                            ))}
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
                </div>
            </div>
        </div>
    );
}
