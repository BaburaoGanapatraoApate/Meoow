import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../services/authApi';
import {
  Lock,
  Mail,
  User,
  ArrowRight,
  Gift,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  RefreshCw,
  ArrowLeft,
  Sparkles,
  Download,
  LogOut,
} from 'lucide-react';

export const SignupPage: React.FC = () => {
  const { isAuthenticated, user, setAuthSession, logout } = useAuth();

  // Step 1: Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Step / UI Flow State: 'form' | 'otp' | 'success'
  const [currentStep, setCurrentStep] = useState<'form' | 'otp' | 'success'>('form');

  // OTP state
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendMessage, setResendMessage] = useState('');

  // General Loading & Error states
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState('');

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

  // Handle Step 1 Registration
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedName) {
      setFormError('Please enter your full name.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setFormError('Please enter a valid email address.');
      return;
    }

    if (password.length < 6) {
      setFormError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setFormError('Passwords do not match. Please verify.');
      return;
    }

    setIsLoading(true);

    try {
      await authApi.register(trimmedName, trimmedEmail, password);
      setCurrentStep('otp');
      setResendCooldown(60);
      setResendMessage('Verification code sent to your inbox.');
    } catch (err: any) {
      if (err.status === 409) {
        setFormError('An account with this email already exists. Please log in.');
      } else if (err.status === 429) {
        setFormError('Too many registration attempts. Please wait a few minutes and try again.');
      } else {
        setFormError(err.message || 'Failed to register account. Please check your information.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Step 2 OTP Verification
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

  // 1. Authenticated User View
  if (isAuthenticated && user) {
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
            Account Active
          </h1>
          <p className="text-xs sm:text-sm text-slate-600">
            You are currently signed in as <strong className="text-brand-navy-950">{user.email}</strong>.
          </p>
        </div>

        <Card className="p-6 sm:p-8 space-y-6 shadow-md border-slate-200">
          <div className="p-4 rounded-xl bg-purple-50 border border-purple-200/80 flex items-center justify-between">
            <div>
              <span className="text-xs font-medium text-slate-600 block">Current Balance</span>
              <span className="text-xl font-extrabold text-brand-navy-950">
                {user.usageMode === 'unlimited' ? 'Unlimited Mode' : `${user.credits} Credits`}
              </span>
            </div>
            <Badge variant="purple" size="sm">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Verified User</span>
            </Badge>
          </div>

          <div className="space-y-3 pt-2">
            <Button href="/download" variant="primary" size="md" className="w-full justify-center">
              <Download className="w-4 h-4 mr-2" />
              Download Windows Client
            </Button>
            <Button
              onClick={() => logout()}
              variant="outline"
              size="md"
              className="w-full justify-center text-slate-700 hover:bg-slate-50"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // 2. Step 3: Registration & Verification Success Screen
  if (currentStep === 'success') {
    return (
      <div className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 max-w-lg mx-auto space-y-8">
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
            Email Verified Successfully
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-brand-navy-950 tracking-tight">
            You're In! Welcome to Meoow.
          </h1>
          <p className="text-sm text-slate-600">
            Your account is verified and ready to power your technical interview practice.
          </p>
        </div>

        <Card className="p-6 sm:p-8 space-y-6 shadow-xl border-2 border-brand-purple-400 bg-gradient-to-b from-white via-purple-50/10 to-white">
          <div className="p-5 rounded-2xl bg-gradient-to-br from-brand-navy-950 to-slate-900 text-white space-y-2 text-center">
            <div className="inline-flex items-center gap-1.5 text-brand-purple-400 text-xs font-bold uppercase tracking-wider">
              <Gift className="w-4 h-4" />
              Starting Bonus Unlocked
            </div>
            <div className="text-3xl font-extrabold text-white">
              30 FREE CREDITS
            </div>
            <p className="text-xs text-slate-300">
              Added to your verified account. Use them to try real-time AI interview hints with zero commitment.
            </p>
          </div>

          <div className="space-y-3">
            <Button href="/download" variant="primary" size="lg" className="w-full justify-center py-3.5 shadow-md">
              <Download className="w-5 h-5 mr-2" />
              Download Meoow for Windows
            </Button>
            <Button href="/how-it-works" variant="outline" size="md" className="w-full justify-center">
              View How It Works Guide
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </div>

          <div className="pt-4 border-t border-slate-100 text-center text-xs text-slate-500">
            Next: Install the desktop app, log in with <strong className="text-brand-navy-900">{email}</strong>, and press <code className="bg-slate-100 px-1 py-0.5 rounded font-mono font-bold text-slate-700">Ctrl+Shift+A</code>.
          </div>
        </Card>
      </div>
    );
  }

  // 3. Step 2: OTP Verification Screen
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
            Check Your Email
          </h1>
          <p className="text-xs sm:text-sm text-slate-600">
            We sent a 6-digit verification code to <strong className="text-brand-navy-950">{email}</strong>.
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
            <div className="p-3 rounded-xl bg-rose-50 text-rose-800 text-xs font-medium border border-rose-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{otpError}</span>
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
              <span className="text-[11px] text-slate-500 mt-1.5 block text-center">
                Valid for 10 minutes. Check your spam folder if not received.
              </span>
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
                  Verifying Code...
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  Verify & Claim 30 Credits
                  <ArrowRight className="w-4 h-4 ml-1" />
                </span>
              )}
            </Button>
          </form>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <button
              type="button"
              onClick={() => {
                setCurrentStep('form');
                setOtp('');
                setOtpError('');
                setResendMessage('');
              }}
              className="inline-flex items-center gap-1 text-slate-500 hover:text-brand-navy-900 font-medium transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Change Email
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

  // 4. Step 1: Default Signup Form Screen
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
          Create Free Account
        </h1>
        <div className="flex justify-center">
          <Badge variant="purple" size="sm">
            <Gift className="w-3.5 h-3.5" />
            <span>30 Free Credits on Verification</span>
          </Badge>
        </div>
      </div>

      <Card className="p-6 sm:p-8 space-y-6 shadow-md border-slate-200">
        {formError && (
          <div className="p-3.5 rounded-xl bg-rose-50 text-rose-800 text-xs font-medium border border-rose-200 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 leading-snug">{formError}</div>
          </div>
        )}

        <form onSubmit={handleRegisterSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-brand-navy-900 mb-1.5">Full Name</label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                maxLength={100}
                placeholder="Alex Chen"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm text-brand-navy-900 focus:outline-none focus:ring-2 focus:ring-brand-purple-400 shadow-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-brand-navy-900 mb-1.5">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                placeholder="alex@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm text-brand-navy-900 focus:outline-none focus:ring-2 focus:ring-brand-purple-400 shadow-sm"
              />
            </div>
            <span className="text-[11px] text-slate-500 mt-1 block">
              A 6-digit verification code will be sent to this email.
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold text-brand-navy-900 mb-1.5">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                maxLength={128}
                placeholder="At least 6 characters"
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

          <div>
            <label className="block text-xs font-bold text-brand-navy-900 mb-1.5">Confirm Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                maxLength={128}
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 text-sm text-brand-navy-900 focus:outline-none focus:ring-2 focus:ring-brand-purple-400 shadow-sm"
              />
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
                Creating Account...
              </span>
            ) : (
              <span className="flex items-center gap-1">
                Continue to Email Verification
                <ArrowRight className="w-4 h-4 ml-1" />
              </span>
            )}
          </Button>
        </form>

        <div className="pt-4 border-t border-slate-100 text-center text-xs text-slate-600 space-y-2">
          <div>
            Already have an account?{' '}
            <Link to="/login" className="text-brand-purple-600 font-bold hover:underline">
              Log In
            </Link>
          </div>
          <div className="text-[11px] text-slate-400">
            By signing up, you agree to our <Link to="/terms" className="underline">Terms</Link> and{' '}
            <Link to="/privacy" className="underline">Privacy Policy</Link>.
          </div>
        </div>
      </Card>
    </div>
  );
};
