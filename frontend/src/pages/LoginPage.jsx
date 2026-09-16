import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API, API_BASE } from '../api/client';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('error') || '';
  });
  const [loading, setLoading] = useState(false);

  // Forgot password modal state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMessage, setForgotMessage] = useState('');
  const [forgotError, setForgotError] = useState('');

  // Password reset confirmation flow (triggered via reset link ?reset=true&uid=...&token=...)
  const params = new URLSearchParams(location.search);
  const resetUid = params.get('uid') || '';
  const resetToken = params.get('token') || '';
  const isResetFlow = Boolean(params.get('reset') && resetUid && resetToken);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState('');
  const [resetError, setResetError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const err = params.get('error');
    if (err) {
      setError(decodeURIComponent(err));
    }
  }, [location.search]);

  const frontendOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const googleOAuthUrl = `${API_BASE}/api/accounts/oauth/google/login/?frontend_redirect=${encodeURIComponent(frontendOrigin)}`;
  const microsoftOAuthUrl = `${API_BASE}/api/accounts/oauth/microsoft/login/?frontend_redirect=${encodeURIComponent(frontendOrigin)}`;

  const handleRequestReset = async (e) => {
    e.preventDefault();
    if (!forgotEmail.trim()) return;
    setForgotLoading(true);
    setForgotError('');
    setForgotMessage('');
    try {
      const res = await API.post('/api/accounts/password-reset/', { email: forgotEmail.trim() });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setForgotMessage(data.message || 'If an account exists with this email, a reset link has been sent.');
      } else {
        setForgotError(data.error || 'Failed to request password reset. Please try again.');
      }
    } catch {
      setForgotError('Network error while requesting password reset.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleConfirmReset = async (e) => {
    e.preventDefault();
    if (!newPassword || !confirmPassword) return;
    if (newPassword !== confirmPassword) {
      setResetError('Passwords do not match.');
      return;
    }
    setResetLoading(true);
    setResetError('');
    setResetSuccess('');
    try {
      const res = await API.post('/api/accounts/password-reset/confirm/', {
        uid: resetUid,
        token: resetToken,
        password: newPassword,
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setResetSuccess('Password reset successfully! You can now sign in with your new password.');
        setTimeout(() => {
          navigate('/login', { replace: true });
        }, 2000);
      } else {
        setResetError(data.error || 'Failed to reset password. The reset link may have expired.');
      }
    } catch {
      setResetError('Network error while resetting password.');
    } finally {
      setResetLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) return;

    try {
      setError('');
      setLoading(true);
      await login(username.trim(), password);
      const from = location.state?.from?.pathname || '/feed';
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message || 'Invalid username or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="auth-shell"
      style={{
        minHeight: 'calc(100vh - 120px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '420px',
          padding: '36px',
          backgroundColor: '#18181D',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 40px rgba(229, 169, 60, 0.08)',
          position: 'relative',
        }}
      >
        <Link
          to="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            color: 'var(--text-subtle)',
            fontSize: '13px',
            textDecoration: 'none',
            marginBottom: '18px',
            transition: 'color 0.15s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--primary)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-subtle)')}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>arrow_back</span>
          Back to Math'd
        </Link>

        {isResetFlow ? (
          /* Password Reset Confirmation Flow */
          <div>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <h1 className="font-display" style={{ fontSize: '26px', color: 'var(--text)', marginBottom: '6px' }}>
                Set New Password
              </h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '13.5px' }}>
                Choose a strong new password for your Math'd account.
              </p>
            </div>

            {resetSuccess && (
              <div style={{ padding: '12px 14px', borderRadius: '8px', backgroundColor: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#6EE7B7', fontSize: '13px', marginBottom: '18px' }}>
                {resetSuccess}
              </div>
            )}

            {resetError && (
              <div style={{ padding: '12px 14px', borderRadius: '8px', backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#FCA5A5', fontSize: '13px', marginBottom: '18px' }}>
                {resetError}
              </div>
            )}

            <form onSubmit={handleConfirmReset} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                  New Password
                </label>
                <input
                  type="password"
                  className="glass-input"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                />
              </div>

              <div>
                <label style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                  Confirm New Password
                </label>
                <input
                  type="password"
                  className="glass-input"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  autoComplete="new-password"
                />
              </div>

              <button
                type="submit"
                disabled={resetLoading}
                className="btn-primary"
                style={{ width: '100%', padding: '12px', marginTop: '6px', fontSize: '14.5px' }}
              >
                {resetLoading ? 'Resetting Password...' : 'Update Password'}
              </button>
            </form>
          </div>
        ) : (
          /* Standard Login Flow */
          <>
            <div style={{ textAlign: 'center', marginBottom: '28px' }}>
              <h1
                className="font-display"
                style={{
                  fontSize: '28px',
                  color: 'var(--text)',
                  marginBottom: '6px',
                }}
              >
                Welcome Back
              </h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                Sign in to access your study rooms, math notes, and challenges.
              </p>
            </div>

            {error && (
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#FCA5A5',
                  fontSize: '13px',
                  marginBottom: '20px',
                }}
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                  Username or Email
                </label>
                <input
                  type="text"
                  className="glass-input"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. euler or euler@mathify.local"
                  autoComplete="username"
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotModal(true);
                      setForgotError('');
                      setForgotMessage('');
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--primary)',
                      fontSize: '12px',
                      cursor: 'pointer',
                      padding: 0,
                      fontWeight: 500,
                    }}
                  >
                    Forgot password?
                  </button>
                </div>
                <input
                  type="password"
                  className="glass-input"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary"
                style={{ width: '100%', padding: '12px', marginTop: '8px', fontSize: '15px' }}
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          </>
        )}

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', margin: '20px 0', gap: '12px' }}>
          <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border)' }} />
          <span style={{ fontSize: '11.5px', color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>or</span>
          <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border)' }} />
        </div>

        {/* OAuth Social Logins */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <a
            href={googleOAuthUrl}
            className="btn-secondary"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              padding: '10px 14px',
              fontSize: '13.5px',
              fontWeight: 500,
              backgroundColor: '#141418',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              textDecoration: 'none',
              borderRadius: '8px',
              transition: 'border-color 0.15s ease',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            <span>Continue with Google</span>
          </a>

          <a
            href={microsoftOAuthUrl}
            className="btn-secondary"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              padding: '10px 14px',
              fontSize: '13.5px',
              fontWeight: 500,
              backgroundColor: '#141418',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              textDecoration: 'none',
              borderRadius: '8px',
              transition: 'border-color 0.15s ease',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 23 23">
              <path fill="#f35325" d="M1 1h10v10H1z" />
              <path fill="#81bc06" d="M12 1h10v10H12z" />
              <path fill="#05a6f0" d="M1 12h10v10H1z" />
              <path fill="#ffba08" d="M12 12h10v10H12z" />
            </svg>
            <span>Continue with Microsoft</span>
          </a>
        </div>

        <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '13px', color: 'var(--text-muted)' }}>
          Don't have an account?{' '}
          <Link to="/register" style={{ color: 'var(--primary)', fontWeight: 600 }}>
            Join the department
          </Link>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
          onClick={() => setShowForgotModal(false)}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '400px',
              backgroundColor: '#18181D',
              padding: '28px',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.8)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '18px', margin: 0, color: 'var(--text)' }}>Reset Password</h3>
              <button
                onClick={() => setShowForgotModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-subtle)', cursor: 'pointer', display: 'flex' }}
                aria-label="Close"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
              </button>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '18px', lineHeight: 1.5 }}>
              Enter your registered email address and we'll send you a secure link to reset your account password.
            </p>

            {forgotMessage && (
              <div style={{ padding: '10px 12px', borderRadius: '6px', backgroundColor: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#6EE7B7', fontSize: '12.5px', marginBottom: '16px' }}>
                {forgotMessage}
              </div>
            )}

            {forgotError && (
              <div style={{ padding: '10px 12px', borderRadius: '6px', backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#FCA5A5', fontSize: '12.5px', marginBottom: '16px' }}>
                {forgotError}
              </div>
            )}

            <form onSubmit={handleRequestReset} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12.5px', color: 'var(--text-muted)', display: 'block', marginBottom: '5px' }}>
                  Registered Email Address
                </label>
                <input
                  type="email"
                  className="glass-input"
                  required
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="e.g. yourname@university.edu"
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(false)}
                  className="btn-secondary"
                  style={{ flex: 1, padding: '10px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="btn-primary"
                  style={{ flex: 1, padding: '10px' }}
                >
                  {forgotLoading ? 'Sending...' : 'Send Link'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default LoginPage;
