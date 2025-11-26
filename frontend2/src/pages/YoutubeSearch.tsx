import { useNavigate } from 'react-router-dom';

export function YoutubeSearch() {
    const navigate = useNavigate();

    return (
        <div className="container mt-5 text-center">
            <div className="card shadow-sm border-0" style={{ borderRadius: 'var(--radius-lg)' }}>
                <div className="card-body p-5">
                    <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>📺</div>
                    <h2 className="mb-3" style={{ fontWeight: 'var(--font-weight-bold)' }}>Youtube 레시피 검색</h2>
                    <p className="text-muted mb-4">
                        이 기능은 준비 중입니다.<br />
                        곧 Youtube의 맛있는 레시피들을 여기서 바로 검색하실 수 있습니다!
                    </p>
                    <button
                        className="btn btn-primary px-4 py-2"
                        onClick={() => navigate('/')}
                        style={{ borderRadius: 'var(--radius-md)' }}
                    >
                        홈으로 돌아가기
                    </button>
                </div>
            </div>
        </div>
    );
}
