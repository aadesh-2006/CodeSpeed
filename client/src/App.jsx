import { useState, useEffect } from 'react';
import { api, clearToken, getToken } from './services/api';
import AuthForm from './components/AuthForm';
import './App.css';

function App() {
  const [apiStatus, setApiStatus] = useState({ status: 'checking', message: 'Connecting to API...' });
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  // Check health check status from backend
  useEffect(() => {
    fetch(`${apiUrl}/api/health`)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        setApiStatus({ status: 'connected', message: data.message });
      })
      .catch(() => {
        setApiStatus({ status: 'disconnected', message: 'Server not reachable' });
      });
  }, [apiUrl]);

  // Restore authenticated session on initial mount
  useEffect(() => {
    const token = getToken();
    if (!token) {
      setAuthLoading(false);
      return;
    }

    api
      .getMe()
      .then((data) => {
        if (data && data.user) {
          setUser(data.user);
        }
      })
      .catch(() => {
        // Token was invalid or expired, clear it
        clearToken();
        setUser(null);
      })
      .finally(() => {
        setAuthLoading(false);
      });
  }, []);

  const handleAuthSuccess = (authenticatedUser) => {
    setUser(authenticatedUser);
  };

  const handleLogout = () => {
    clearToken();
    setUser(null);
  };

  return (
    <div className="app-container">
      <header className="header">
        <div className="badge">Milestone 1 &bull; Authentication</div>
      </header>

      <main className="hero">
        <div className="logo-symbol">&gt;_</div>
        <h1 className="title">CodeSpeed</h1>
        <p className="tagline">Type code. Track speed. Improve.</p>

        {authLoading ? (
          <div className="loading-card">
            <p>Loading user session...</p>
          </div>
        ) : user ? (
          /* Simple Authenticated Area for M1 */
          <div className="authenticated-card">
            <div className="user-welcome">
              <h2>Welcome, <span className="highlight-username">{user.username}</span></h2>
              <p className="user-email">{user.email}</p>
            </div>

            <div className="auth-status-box">
              <span className="secure-badge">&#x2714; Authenticated via JWT</span>
              <p className="scope-note">
                Your account is ready. Coding speed tests and tracking are scheduled for upcoming milestones.
              </p>
            </div>

            <button type="button" className="logout-btn" onClick={handleLogout}>
              Log Out
            </button>
          </div>
        ) : (
          /* Unauthenticated Auth UI (Login / Signup) */
          <AuthForm onAuthSuccess={handleAuthSuccess} />
        )}

        <div className="info-card">
          <div className="status-indicator">
            <span className={`status-dot ${apiStatus.status}`}></span>
            <span className="status-text">
              Backend Status: <strong>{apiStatus.message}</strong>
            </span>
          </div>
          <p className="milestone-note">
            Milestone 1 Authentication active with MongoDB &amp; JWT. Typing tests coming in later milestones.
          </p>
        </div>
      </main>

      <footer className="footer">
        <p>&copy; {new Date().getFullYear()} CodeSpeed &bull; Built with React &amp; Express</p>
      </footer>
    </div>
  );
}

export default App;
