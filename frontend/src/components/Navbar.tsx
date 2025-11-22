import { Link } from 'react-router-dom';

export function Navbar() {
  return (
    <nav className="navbar navbar-expand-lg navbar-light bg-light shadow-sm mb-4">
      <div className="container">
        <Link className="navbar-brand fw-bold" to="/">
          🍳 Recipe Voice
        </Link>
        
        <button 
          className="navbar-toggler" 
          type="button" 
          data-bs-toggle="collapse" 
          data-bs-target="#navbarNav"
        >
          <span className="navbar-toggler-icon"></span>
        </button>
        
        <div className="collapse navbar-collapse" id="navbarNav">
          <ul className="navbar-nav ms-auto">
            <li className="nav-item">
              <Link className="nav-link" to="/">
                📋 레시피 목록
              </Link>
            </li>
            <li className="nav-item">
              <Link className="nav-link" to="/voice-test">
                🎤 음성 에이전트
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  );
}