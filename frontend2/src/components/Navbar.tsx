import { Link } from 'react-router-dom';
import youtubeLogo from '../assets/YouTube_Logo_2017.png';

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
      <div className="container d-flex justify-content-center">
        <button
          className="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#navbarNav"
          style={{ borderColor: 'var(--color-primary)' }}
        >
          <span className="navbar-toggler-icon"></span>
        </button>

        <div className="collapse navbar-collapse justify-content-center" id="navbarNav">
          <ul className="navbar-nav" style={{ gap: '20px', alignItems: 'center' }}>
            <li className="nav-item">
              <Link
                className="nav-link px-3 py-2"
                to="/"
                style={{
                  borderRadius: 'var(--radius-md)',
                  transition: 'all var(--transition-base)',
                  fontWeight: '500',
                  fontSize: '1.1rem',
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
                className="nav-link px-3 py-2 d-flex align-items-center"
                to="/youtube-search"
                style={{
                  borderRadius: 'var(--radius-md)',
                  transition: 'all var(--transition-base)',
                  fontWeight: '500',
                  fontSize: '1.1rem',
                  gap: '8px',
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
                <img src={youtubeLogo} alt="Youtube" style={{ height: '24px' }} />
                <span>에서 레시피 찾기</span>
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  );
}