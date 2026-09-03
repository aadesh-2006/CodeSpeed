import { useState, useEffect } from 'react';
import { api, setToken } from '../services/api';

export function AuthForm({ onAuthSuccess }) {
  const [mode, setMode] = useState('login'); // 'login' | 'signup' | 'verify-notice'
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  // Email verification notice state
  const [pendingEmail, setPendingEmail] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState('');
  const [showUnverifiedWarning, setShowUnverifiedWarning] = useState(false);

  // Resend cooldown countdown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  const switchMode = (newMode) => {
    setMode(newMode);
    setError(null);
    setShowPassword(false);
    setShowUnverifiedWarning(false);
    setResendSuccess('');
  };

  const handleResendFromNotice = async () => {
    const targetEmail = pendingEmail || email.trim();
    if (!targetEmail) return;

    setResendLoading(true);
    setResendSuccess('');
    setError(null);

    try {
      const res = await api.resendVerification(targetEmail);
      setResendSuccess(res?.message || 'A fresh verification link has been sent to your email.');
      setResendCooldown(60);
    } catch (err) {
      setError(err.message || 'Failed to resend verification link.');
    } finally {
      setResendLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setShowUnverifiedWarning(false);
    setResendSuccess('');

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
      if (mode === 'signup') {
        const res = await api.signup({
          username: username.trim(),
          email: email.trim(),
          password,
        });

        if (res?.requiresVerification) {
          setPendingEmail(res.email || email.trim());
          setMode('verify-notice');
          setResendCooldown(60);
          return;
        }

        if (res.token && res.user) {
          setToken(res.token);
          onAuthSuccess(res.user, res.token);
        } else {
          setError('Unexpected response from server.');
        }
      } else {
        const res = await api.login({
          identifier: email.trim(),
          email: email.trim(),
          password,
        });

        if (res.token && res.user) {
          setToken(res.token);
          onAuthSuccess(res.user, res.token);
        } else {
          setError('Unexpected response from server.');
        }
      }
    } catch (err) {
      if (err.message && err.message.toLowerCase().includes('verify your email')) {
        setShowUnverifiedWarning(true);
        setPendingEmail(email.trim());
      }
      setError(err.message || 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // 1. Dedicated Verification Notice Screen after Signup
  if (mode === 'verify-notice') {
    return (
      <div className="auth-card">
        <div className="verify-notice-card">
          <div className="verify-icon-circle info">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
          </div>

          <h2 className="verify-title">Verify Your Email</h2>
          <p className="verify-subtitle">
            We've sent a verification link to <strong className="highlight-text">{pendingEmail}</strong>.
            Please click the link in your email to activate your account.
          </p>

          {resendSuccess && <div className="notification notification-success">{resendSuccess}</div>}
          {error && <div className="notification notification-error">{error}</div>}

          <div className="verify-notice-actions">
            <button
              type="button"
              className="btn btn-secondary btn-block"
              onClick={handleResendFromNotice}
              disabled={resendLoading || resendCooldown > 0}
            >
              {resendLoading
                ? 'Sending...'
                : resendCooldown > 0
                ? `Resend available in ${resendCooldown}s`
                : 'Resend Verification Email'}
            </button>
            <button
              type="button"
              className="btn btn-primary btn-block"
              onClick={() => switchMode('login')}
            >
              Proceed to Log In &rarr;
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. Normal Login & Signup Form
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
            <div className="auth-error-content">
              <span>{error}</span>
              {showUnverifiedWarning && (
                <div className="unverified-resend-row">
                  <button
                    type="button"
                    className="link-btn unverified-resend-btn"
                    onClick={handleResendFromNotice}
                    disabled={resendLoading || resendCooldown > 0}
                  >
                    {resendLoading
                      ? 'Sending...'
                      : resendCooldown > 0
                      ? `Resend available in ${resendCooldown}s`
                      : 'Resend verification link'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {resendSuccess && <div className="notification notification-success">{resendSuccess}</div>}

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
          <label htmlFor="email">
            {mode === 'login' ? 'Username or Email' : 'Email'}
          </label>
          <input
            id="email"
            type={mode === 'login' ? 'text' : 'email'}
            placeholder={mode === 'login' ? 'Enter username or email' : 'developer@example.com'}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            autoComplete={mode === 'login' ? 'username' : 'email'}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="password">Password</label>
          <div className="password-input-wrapper">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder={mode === 'signup' ? 'At least 6 characters' : 'Enter your password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              required
            />
            <button
              type="button"
              className="password-toggle-btn"
              onClick={() => setShowPassword((prev) => !prev)}
              disabled={loading}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              tabIndex="-1"
            >
              {showPassword ? (
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
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
