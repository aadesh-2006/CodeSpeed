import { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';

export function VerifyEmail({ token, onProceedToLogin }) {
  const [status, setStatus] = useState('verifying'); // 'verifying' | 'success' | 'error'
  const [message, setMessage] = useState('Verifying your email address...');
  const [resendEmail, setResendEmail] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const [resendError, setResendError] = useState('');
  const [cooldown, setCooldown] = useState(0);

  const verificationAttemptedRef = useRef(false);

  // Auto-verify on mount if token is provided
  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('No verification token provided. Please use the link sent to your email.');
      return;
    }

    if (verificationAttemptedRef.current) return;
    verificationAttemptedRef.current = true;

    const performVerification = async () => {
      setStatus('verifying');
      try {
        const res = await api.verifyEmail(token);
        setStatus('success');
        setMessage(res?.message || 'Email verified successfully! You can now log in to CodeSpeed.');
      } catch (err) {
        setStatus('error');
        setMessage(err.message || 'Verification link is invalid or has expired. Please request a new one.');
      }
    };

    performVerification();
  }, [token]);

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  const handleResend = async (e) => {
    e.preventDefault();
    if (!resendEmail.trim()) {
      setResendError('Please enter your registered email address.');
      return;
    }

    setResendLoading(true);
    setResendError('');
    setResendMessage('');

    try {
      const res = await api.resendVerification(resendEmail.trim());
      setResendMessage(res?.message || 'A fresh verification link has been sent to your email.');
      setCooldown(60);
    } catch (err) {
      setResendError(err.message || 'Failed to resend verification link. Please try again.');
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="verify-email-container">
      <div className="panel verify-email-card">
        {/* Verification Status Banner */}
        {status === 'verifying' && (
          <div className="verify-state-block">
            <div className="loading-spinner"></div>
            <h2 className="verify-title">Verifying Email</h2>
            <p className="verify-subtitle">Connecting to server and validating your security token...</p>
          </div>
        )}

        {status === 'success' && (
          <div className="verify-state-block success">
            <div className="verify-icon-circle success">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2 className="verify-title">Email Verified!</h2>
            <p className="verify-subtitle">{message}</p>
            <div className="verify-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={onProceedToLogin}
              >
                Proceed to Log In &rarr;
              </button>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="verify-state-block error">
            <div className="verify-icon-circle error">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </div>
            <h2 className="verify-title">Verification Failed</h2>
            <p className="verify-subtitle">{message}</p>

            {/* Resend Form Block */}
            <div className="verify-resend-section">
              <h3 className="verify-resend-heading">Request a New Verification Link</h3>
              {resendMessage && <div className="notification notification-success">{resendMessage}</div>}
              {resendError && <div className="notification notification-error">{resendError}</div>}

              <form onSubmit={handleResend} className="verify-resend-form">
                <div className="form-group">
                  <input
                    type="email"
                    className="input-field"
                    placeholder="Enter your registered email"
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    disabled={resendLoading || cooldown > 0}
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="btn btn-secondary btn-block"
                  disabled={resendLoading || cooldown > 0}
                >
                  {resendLoading
                    ? 'Sending...'
                    : cooldown > 0
                    ? `Resend available in ${cooldown}s`
                    : 'Resend Verification Email'}
                </button>
              </form>
            </div>

            <div className="verify-footer-nav">
              <button
                type="button"
                className="link-btn"
                onClick={onProceedToLogin}
              >
                &larr; Return to Log In
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default VerifyEmail;
