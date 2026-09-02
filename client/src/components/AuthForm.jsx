import { useState } from 'react';
import { api, setToken } from '../services/api';

export function AuthForm({ onAuthSuccess }) {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const switchMode = (newMode) => {
    setMode(newMode);
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Basic frontend validations
    if (!email.trim() || !password) {
      setError('Please fill in all required fields.');
      return;
    }

    if (mode === 'signup') {
      if (!username.trim()) {
        setError('Username is required.');
        return;
      }
      if (username.trim().length < 3 || username.trim().length > 30) {
        setError('Username must be between 3 and 30 characters.');
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters long.');
        return;
      }
    }

    setLoading(true);

    try {
      let res;
      if (mode === 'signup') {
        res = await api.signup({
          username: username.trim(),
          email: email.trim(),
          password,
        });
      } else {
        res = await api.login({
          email: email.trim(),
          password,
        });
      }

      if (res.token && res.user) {
        setToken(res.token);
        onAuthSuccess(res.user, res.token);
      } else {
        setError('Unexpected response from server.');
      }
    } catch (err) {
      setError(err.message || 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-card">
      <div className="auth-tabs">
        <button
          type="button"
          className={`tab-btn ${mode === 'login' ? 'active' : ''}`}
          onClick={() => switchMode('login')}
          disabled={loading}
        >
          Log In
        </button>
        <button
          type="button"
          className={`tab-btn ${mode === 'signup' ? 'active' : ''}`}
          onClick={() => switchMode('signup')}
          disabled={loading}
        >
          Sign Up
        </button>
      </div>

      <form onSubmit={handleSubmit} className="auth-form" noValidate>
        {error && (
          <div className="auth-error-banner" role="alert">
            <span className="error-icon">&times;</span>
            <span>{error}</span>
          </div>
        )}

        {mode === 'signup' && (
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              placeholder="e.g. dev_coder"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
              autoComplete="username"
              required
            />
          </div>
        )}

        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            placeholder="developer@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            autoComplete="email"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            placeholder={mode === 'signup' ? 'At least 6 characters' : 'Enter your password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            required
          />
        </div>

        <button type="submit" className="submit-btn" disabled={loading}>
          {loading ? (
            <span className="spinner-text">Processing...</span>
          ) : mode === 'signup' ? (
            'Create Account'
          ) : (
            'Sign In'
          )}
        </button>
      </form>

      <div className="auth-footer">
        {mode === 'login' ? (
          <p>
            Don't have an account?{' '}
            <button
              type="button"
              className="link-btn"
              onClick={() => switchMode('signup')}
              disabled={loading}
            >
              Sign up
            </button>
          </p>
        ) : (
          <p>
            Already have an account?{' '}
            <button
              type="button"
              className="link-btn"
              onClick={() => switchMode('login')}
              disabled={loading}
            >
              Log in
            </button>
          </p>
        )}
      </div>
    </div>
  );
}

export default AuthForm;
