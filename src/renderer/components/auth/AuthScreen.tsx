import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import logoImg from '../../assets/logo.png';
import '../../styles/auth.css';

type AuthMode = 'login' | 'register' | 'verify';

export function AuthScreen() {
  const { login, register, verifyEmail, resendOtp } = useAuth();

  const [mode, setMode] = useState<AuthMode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Resend cooldown timer
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const clearMessages = () => {
    setError(null);
    setSuccessMessage(null);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();

    if (!email.trim() || !password) {
      setError('Please enter both email and password.');
      return;
    }

    setIsSubmitting(true);
    try {
      await login(email.trim(), password);
    } catch (err: any) {
      if (err.requiresVerification) {
        setError('Your email is not verified yet. We have sent you a verification code.');
        setMode('verify');
        setCooldown(60);
      } else {
        setError(err.message || 'Invalid email or password.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();

    if (!name.trim()) {
      setError('Please enter your name.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await register(name.trim(), email.trim(), password);
      setSuccessMessage(res.message || 'Verification code sent to your email.');
      setMode('verify');
      setCooldown(60);
      setOtp('');
    } catch (err: any) {
      setError(err.message || 'Failed to register account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();

    const cleanOtp = otp.trim();
    if (!cleanOtp || cleanOtp.length !== 6 || !/^\d+$/.test(cleanOtp)) {
      setError('Please enter a valid 6-digit verification code.');
      return;
    }

    setIsSubmitting(true);
    try {
      await verifyEmail(email.trim(), cleanOtp);
      // Successfully verified - AuthContext will transition to authenticated state
    } catch (err: any) {
      setError(err.message || 'Invalid verification code. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendClick = async () => {
    if (cooldown > 0 || isSubmitting) return;
    clearMessages();

    setIsSubmitting(true);
    try {
      const res = await resendOtp(email.trim());
      setSuccessMessage(res.message || 'A new verification code has been sent.');
      setCooldown(60);
    } catch (err: any) {
      setError(err.message || 'Failed to resend verification code.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-container" data-window-interactive="true">
      <div className="auth-card" data-window-interactive="true">
        <div className="auth-header">
          <img src={logoImg} alt="Meoow Logo" className="auth-logo" />
          <h1 className="auth-title">
            {mode === 'login' && 'Welcome to Meoow'}
            {mode === 'register' && 'Create Your Account'}
            {mode === 'verify' && 'Verify Your Email'}
          </h1>
          <p className="auth-subtitle">
            {mode === 'login' && 'Sign in to access your AI interview copilot.'}
            {mode === 'register' && 'Get 30 free signup credits upon email verification.'}
            {mode === 'verify' && `We sent a 6-digit code to ${email || 'your email'}.`}
          </p>
        </div>

        {error && <div className="auth-error">{error}</div>}
        {successMessage && <div className="auth-success">{successMessage}</div>}

        {/* ── Login Form ── */}
        {mode === 'login' && (
          <form className="auth-form" onSubmit={handleLoginSubmit}>
            <div className="auth-field">
              <label className="auth-label">Email Address</label>
              <input
                type="email"
                className="auth-input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>

            <div className="auth-field">
              <label className="auth-label">Password</label>
              <input
                type="password"
                className="auth-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>

            <button type="submit" className="auth-submit-button" disabled={isSubmitting}>
              {isSubmitting ? 'Signing In...' : 'Sign In'}
            </button>

            <div className="auth-footer">
              <div>
                Don't have an account?{' '}
                <button
                  type="button"
                  className="auth-link"
                  onClick={() => {
                    clearMessages();
                    setMode('register');
                  }}
                >
                  Create one
                </button>
              </div>
            </div>
          </form>
        )}

        {/* ── Register Form ── */}
        {mode === 'register' && (
          <form className="auth-form" onSubmit={handleRegisterSubmit}>
            <div className="auth-field">
              <label className="auth-label">Full Name</label>
              <input
                type="text"
                className="auth-input"
                placeholder="Alex Johnson"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                required
              />
            </div>

            <div className="auth-field">
              <label className="auth-label">Email Address</label>
              <input
                type="email"
                className="auth-input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>

            <div className="auth-field">
              <label className="auth-label">Password</label>
              <input
                type="password"
                className="auth-input"
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>

            <div className="auth-field">
              <label className="auth-label">Confirm Password</label>
              <input
                type="password"
                className="auth-input"
                placeholder="Repeat password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>

            <button type="submit" className="auth-submit-button" disabled={isSubmitting}>
              {isSubmitting ? 'Creating Account...' : 'Sign Up & Get 30 Credits'}
            </button>

            <div className="auth-footer">
              <div>
                Already have an account?{' '}
                <button
                  type="button"
                  className="auth-link"
                  onClick={() => {
                    clearMessages();
                    setMode('login');
                  }}
                >
                  Sign In
                </button>
              </div>
            </div>
          </form>
        )}

        {/* ── Verify Email OTP Form ── */}
        {mode === 'verify' && (
          <form className="auth-form" onSubmit={handleVerifySubmit}>
            <div className="auth-field">
              <label className="auth-label">6-Digit Verification Code</label>
              <div className="otp-input-container">
                <input
                  type="text"
                  maxLength={6}
                  className="otp-digit-input"
                  placeholder="123456"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  autoFocus
                  required
                />
              </div>
            </div>

            <button type="submit" className="auth-submit-button" disabled={isSubmitting || otp.length !== 6}>
              {isSubmitting ? 'Verifying...' : 'Verify & Claim 30 Credits'}
            </button>

            <div className="resend-box">
              <span>Didn't receive the code?</span>
              <button
                type="button"
                className="auth-link"
                disabled={cooldown > 0 || isSubmitting}
                onClick={handleResendClick}
              >
                {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend Code'}
              </button>
            </div>

            <div className="auth-footer">
              <button
                type="button"
                className="auth-link"
                onClick={() => {
                  clearMessages();
                  setMode('login');
                }}
              >
                ← Back to Login
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

