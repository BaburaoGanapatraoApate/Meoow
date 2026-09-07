import React, { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams, useNavigate, Navigate } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../services/authApi';
import {
  Lock,
  Mail,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  RefreshCw,
  Sparkles,
  Download,
  LogOut,
  ArrowLeft,
} from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { isAuthenticated, user, setAuthSession, logout } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const redirectUrl = searchParams.get('redirect');

  // Login Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Step state: 'login' | 'otp' | 'success'
  const [currentStep, setCurrentStep] = useState<'login' | 'otp' | 'success'>('login');

  // OTP Verification state (if unverified account attempts login)
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendMessage, setResendMessage] = useState('');

  // General Loading & Error state
  const [isLoading, setIsLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (resendCooldown > 0) {
      timerRef.current = setTimeout(() => {
        setResendCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [resendCooldown]);

  // Handle Login Submit
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setLoginError('Please enter your email address.');
      return;
    }
    if (!password) {
      setLoginError('Please enter your password.');
      return;
    }

    setIsLoading(true);

    try {
      const result = await authApi.login(trimmedEmail, password);
      setAuthSession(result.token, result.user);
      if (redirectUrl && redirectUrl.startsWith('/')) {
        navigate(redirectUrl, { replace: true });
        return;
      }
      setCurrentStep('success');
    } catch (err: any) {
      if (err.requiresVerification || err.status === 403) {
        // Account exists but email is unverified -> switch to OTP verification
        setCurrentStep('otp');
        setOtpError('Your email still needs to be verified before logging in.');
        setResendCooldown(0);
      } else if (err.status === 401) {
        setLoginError('Email or password is incorrect. Please try again.');
      } else if (err.status === 429) {
        setLoginError('Too many login attempts. Please wait a few minutes and try again.');
      } else {
        setLoginError(err.message || 'Authentication failed. Please check your connection.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Handle OTP Submit (for unverified user)
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setOtpError('');

    const cleanOtp = otp.trim();
    if (!/^\d{6}$/.test(cleanOtp)) {
      setOtpError('Please enter the full 6-digit verification code.');
      return;
    }

    setIsLoading(true);

    try {
      const result = await authApi.verifyEmail(email.trim().toLowerCase(), cleanOtp);
      setAuthSession(result.token, result.user);
      if (redirectUrl && redirectUrl.startsWith('/')) {
        navigate(redirectUrl, { replace: true });
        return;
      }
      setCurrentStep('success');
    } catch (err: any) {
      if (err.status === 400 || err.status === 401) {
        setOtpError('Invalid or expired verification code. Please check your email or request a new one.');
      } else if (err.status === 429) {
        setOtpError('Too many attempts. Please wait before trying again.');
      } else {
        setOtpError(err.message || 'Verification failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Resend OTP
  const handleResendOtp = async () => {
    if (resendCooldown > 0 || isLoading) return;

    setIsLoading(true);
    setOtpError('');
    setResendMessage('');

    try {
      const result = await authApi.resendOtp(email.trim().toLowerCase());
      setResendCooldown(60);
      setResendMessage(result.message || 'A new verification code has been sent.');
    } catch (err: any) {
      if (err.status === 429) {
        setOtpError('Please wait before requesting another verification code.');
      } else {
        setOtpError(err.message || 'Failed to resend verification code.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 1. Authenticated State View
  if (isAuthenticated && user) {
    if (redirectUrl && redirectUrl.startsWith('/')) {
      return <Navigate to={redirectUrl} replace />;
    }
    return (
      <div className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 max-w-md mx-auto space-y-8">
        <div className="text-center space-y-3">
          <Link to="/" className="inline-flex items-center gap-2 group mb-2">
            <img src="/logo.png" alt="Meoow Logo" className="w-9 h-9 rounded-lg object-contain shadow-sm" />
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-extrabold text-brand-navy-950 tracking-tight">MEOOW</span>
              <span className="text-xs font-bold text-brand-purple-600 uppercase">AI</span>
            </div>
          </Link>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            Signed In
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-brand-navy-950">Welcome Back</h1>
          <p className="text-xs sm:text-sm text-slate-600">
            Signed in as <strong className="text-brand-navy-950">{user.email}</strong>.
          </p>
        </div>

        <Card className="p-6 sm:p-8 space-y-6 shadow-md border-slate-200">
          <div className="p-4 rounded-xl bg-purple-50 border border-purple-200/80 flex items-center justify-between">
            <div>
              <span className="text-xs font-medium text-slate-600 block">Available Balance</span>
              <span className="text-xl font-extrabold text-brand-navy-950">
                {user.usageMode === 'unlimited' ? 'Unlimited Mode' : `${user.credits} Credits`}
              </span>
            </div>
            <Badge variant="purple" size="sm">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Verified Account</span>
            </Badge>
          </div>

          <div className="space-y-3 pt-2">
            <Button href="/download" variant="primary" size="md" className="w-full justify-center">
              <Download className="w-4 h-4 mr-2" />
              Download Windows Client
            </Button>
            <Button href="/shortcuts" variant="outline" size="md" className="w-full justify-center text-slate-700">
              View Keyboard Shortcuts (Ctrl+Shift+A)
            </Button>
            <Button
              onClick={() => logout()}
              variant="outline"
              size="md"
              className="w-full justify-center text-rose-600 border-rose-200 hover:bg-rose-50"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // 2. OTP Verification View (for unverified users trying to log in)
  if (currentStep === 'otp') {
    return (
      <div className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 max-w-md mx-auto space-y-8">
        <div className="text-center space-y-3">
          <Link to="/" className="inline-flex items-center gap-2 group mb-2">
            <img src="/logo.png" alt="Meoow Logo" className="w-9 h-9 rounded-lg object-contain shadow-sm" />
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-extrabold text-brand-navy-950 tracking-tight">MEOOW</span>
              <span className="text-xs font-bold text-brand-purple-600 uppercase">AI</span>
            </div>
          </Link>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-brand-navy-950">
            Verify Your Email
          </h1>
          <p className="text-xs sm:text-sm text-slate-600">
            Please verify your email address (<strong className="text-brand-navy-950">{email}</strong>) to complete login.
          </p>
        </div>

        <Card className="p-6 sm:p-8 space-y-6 shadow-md border-slate-200">
          {resendMessage && (
            <div className="p-3 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-medium border border-emerald-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>{resendMessage}</span>
            </div>
          )}

          {otpError && (
            <div className="p-3 rounded-xl bg-amber-50 text-amber-900 text-xs font-medium border border-amber-200 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 leading-snug">{otpError}</div>
            </div>
          )}

          <form onSubmit={handleVerifyOtp} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-brand-navy-900 mb-2">
                6-Digit Verification Code
              </label>
              <input
                type="text"
                required
                maxLength={6}
                pattern="\d{6}"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                value={otp}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setOtp(val);
                }}
                className="w-full text-center tracking-[0.4em] font-mono text-xl py-3 px-4 rounded-xl border border-slate-200 text-brand-navy-950 focus:outline-none focus:ring-2 focus:ring-brand-purple-400 shadow-sm"
              />
            </div>

            <Button
              type="submit"
              disabled={isLoading || otp.length !== 6}
              variant="primary"
              size="lg"
              className="w-full justify-center"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Verifying...
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  Verify & Sign In
                  <ArrowRight className="w-4 h-4 ml-1" />
                </span>
              )}
            </Button>
          </form>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <button
              type="button"
              onClick={() => {
                setCurrentStep('login');
                setOtp('');
                setOtpError('');
                setResendMessage('');
              }}
              className="inline-flex items-center gap-1 text-slate-500 hover:text-brand-navy-900 font-medium transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Login
            </button>

            <button
              type="button"
              disabled={resendCooldown > 0 || isLoading}
              onClick={handleResendOtp}
              className={`font-bold transition ${
                resendCooldown > 0
                  ? 'text-slate-400 cursor-not-allowed'
                  : 'text-brand-purple-600 hover:underline'
              }`}
            >
              {resendCooldown > 0 ? `Resend code (${resendCooldown}s)` : 'Resend Code'}
            </button>
          </div>
        </Card>
      </div>
    );
  }

  // 3. Step 1: Default Login Form View
  return (
    <div className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 max-w-md mx-auto space-y-8">
      <div className="text-center space-y-3">
        <Link to="/" className="inline-flex items-center gap-2 group mb-2">
          <img src="/logo.png" alt="Meoow Logo" className="w-9 h-9 rounded-lg object-contain shadow-sm" />
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-extrabold text-brand-navy-950 tracking-tight">MEOOW</span>
            <span className="text-xs font-bold text-brand-purple-600 uppercase">AI</span>
          </div>
        </Link>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-brand-navy-950">Welcome Back</h1>
        <p className="text-xs sm:text-sm text-slate-600">
          Sign in to access your interview credits, account details, and desktop companion.
        </p>
      </div>

      <Card className="p-6 sm:p-8 space-y-6 shadow-md border-slate-200">
        {loginError && (
          <div className="p-3.5 rounded-xl bg-rose-50 text-rose-800 text-xs font-medium border border-rose-200 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 leading-snug">{loginError}</div>
          </div>
        )}

        <form onSubmit={handleLoginSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-brand-navy-900 mb-1.5">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm text-brand-navy-900 focus:outline-none focus:ring-2 focus:ring-brand-purple-400 shadow-sm"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-brand-navy-900">Password</label>
              <a
                href="mailto:support@meooow.tech?subject=Password Reset Request"
                className="text-xs text-brand-purple-600 hover:underline"
              >
                Forgot password?
              </a>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 text-sm text-brand-navy-900 focus:outline-none focus:ring-2 focus:ring-brand-purple-400 shadow-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            variant="primary"
            size="lg"
            className="w-full justify-center mt-2"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Signing In...
              </span>
            ) : (
              <span className="flex items-center gap-1">
                Sign In to Meoow
                <ArrowRight className="w-4 h-4 ml-1" />
              </span>
            )}
          </Button>
        </form>

        <div className="pt-4 border-t border-slate-100 text-center text-xs text-slate-600 space-y-2">
          <div>
            Don't have an account yet?{' '}
            <Link to="/signup" className="text-brand-purple-600 font-bold hover:underline">
              Sign up for 30 Free Credits
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
};
