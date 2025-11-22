import { Link } from 'react-router-dom';
import logoImage from '../assets/yorijori-logo-basic.png';

export function Navbar() {
  return (
    <nav
      className="navbar navbar-expand-lg navbar-light shadow-sm mb-4 sticky-top"
      style={{
        background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(255, 251, 245, 0.95) 100%)',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid rgba(255, 107, 53, 0.1)',
      }}
    >
      <div className="container">
        <Link className="navbar-brand d-flex align-items-center fw-bold" to="/" style={{ gap: '12px' }}>
          <img
            src={logoImage}
            alt="요리조리 로고"
            style={{
              height: '40px',
              width: 'auto',
              filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1))'
            }}
          />
          <span style={{
            fontSize: '1.5rem',
            background: 'linear-gradient(135deg, #FF6B35 0%, #FF8C61 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            요리조리
          </span>
        </Link>

        <button
          className="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#navbarNav"
          style={{ borderColor: 'var(--color-primary)' }}
        >
          <span className="navbar-toggler-icon"></span>
        </button>

        <div className="collapse navbar-collapse" id="navbarNav">
          <ul className="navbar-nav ms-auto" style={{ gap: '8px' }}>
            <li className="nav-item">
              <Link
                className="nav-link px-3 py-2"
                to="/"
                style={{
                  borderRadius: 'var(--radius-md)',
                  transition: 'all var(--transition-base)',
                  fontWeight: '500',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 107, 53, 0.1)';
                  e.currentTarget.style.color = 'var(--color-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '';
                }}
              >
                📋 레시피 목록
              </Link>
            </li>
            <li className="nav-item">
              <Link
                className="nav-link px-3 py-2"
                to="/voice-test"
                style={{
                  borderRadius: 'var(--radius-md)',
                  transition: 'all var(--transition-base)',
                  fontWeight: '500',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 107, 53, 0.1)';
                  e.currentTarget.style.color = 'var(--color-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '';
                }}
              >
                🎤 음성 에이전트
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  );
}