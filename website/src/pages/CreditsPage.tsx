import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { SectionHeading } from '../components/ui/SectionHeading';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Accordion } from '../components/ui/Accordion';
import { CtaSection } from '../components/ui/CtaSection';
import { CREDITS_FAQS } from '../data/faqs';
import { Check, ArrowRight, Zap, Sparkles, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { paymentApi } from '../services/paymentApi';

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if ((window as any).Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export const CreditsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, token, isAuthenticated, refreshUser } = useAuth();

  const [processingPackageId, setProcessingPackageId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isProcessing = processingPackageId !== null;
  const isVerifiedUser = Boolean(isAuthenticated && user?.emailVerified);
  const isAdmin = Boolean(isAuthenticated && user?.role === 'admin');

  const handleBuyCredits = async (packageId: string) => {
    if (!token || !isAuthenticated) {
      navigate('/login?redirect=/credits');
      return;
    }

    setProcessingPackageId(packageId);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      // 1. Create order on backend (authoritative pricing and access enforcement)
      const orderData = await paymentApi.createOrder(token, packageId);

      // 2. Load Razorpay checkout script
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        throw new Error('Could not load payment gateway. Please check your internet connection.');
      }

      // 3. Open Razorpay Checkout modal
      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'Meoow AI',
        description: `${orderData.credits} AI Interview Credits`,
        order_id: orderData.orderId,
        prefill: {
          name: user?.name || '',
          email: user?.email || '',
        },
        theme: {
          color: '#7c3aed',
        },
        modal: {
          ondismiss: () => {
            setProcessingPackageId(null);
          },
        },
        handler: async (response: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) => {
          try {
            // 4. Send signatures to backend for cryptographic verification & atomic credit fulfillment
            const verifyRes = await paymentApi.verifyPayment(token, {
              orderId: response.razorpay_order_id,
              paymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
            });

            // 5. Authoritatively refresh user state
            await refreshUser();

            setSuccessMessage(
              `Payment successful! Added ${verifyRes.creditsAwarded || orderData.credits} credits to your account. Your new balance is updated.`
            );
          } catch (err: any) {
            console.error('[CreditsPage] Verification error:', err);
            setErrorMessage(err.message || 'Payment verification failed. Please contact support.');
          } finally {
            setProcessingPackageId(null);
          }
        },
      };

      const rzp = new (window as any).Razorpay(options);

      rzp.on('payment.failed', (response: any) => {
        console.error('[CreditsPage] Payment failed event:', response?.error);
        setErrorMessage(
          response?.error?.description || 'Payment was cancelled or failed. No credits were deducted.'
        );
        setProcessingPackageId(null);
      });

      rzp.open();
    } catch (err: any) {
      console.error('[CreditsPage] Checkout initiation error:', err);
      setErrorMessage(err.message || 'Unable to start checkout. Please try again.');
      setProcessingPackageId(null);
    }
  };

  return (
    <div className="space-y-20 sm:space-y-28 py-12">
      {/* 1. HERO SECTION */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
        <Badge variant="green" size="md">
          Transparent Credits Model
        </Badge>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-brand-navy-950 tracking-tight leading-tight">
          Start Free. Pay Only When You{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-purple-600 to-indigo-500">
            Need More.
          </span>
        </h1>
        <p className="text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
          No expensive monthly subscriptions. No auto-renewing trials. Get 30 free credits on registration, and top up credits whenever you need them.
        </p>
      </section>

      {/* 2. PRICING & CREDITS CARDS */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* User Status / Balance Banner */}
        {isAuthenticated && user && (
          <div className="flex flex-col sm:flex-row items-center justify-between p-4 mb-8 rounded-2xl bg-purple-50/70 border border-purple-200/80 shadow-sm gap-3">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-brand-purple-100 text-brand-purple-700">
                <Zap className="w-4 h-4" />
              </span>
              <div>
                <div className="text-xs text-slate-500">Signed in as</div>
                <div className="text-sm font-bold text-brand-navy-950">{user.email}</div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-xs text-slate-500">Available Credits</div>
                <div className="text-lg font-extrabold text-brand-purple-700">
                  {user.usageMode === 'unlimited' ? 'Unlimited' : `${user.credits} credits`}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Global Success / Error Alerts */}
        {successMessage && (
          <div className="p-4 mb-8 rounded-2xl bg-emerald-50 border border-emerald-200 text-sm font-semibold text-emerald-800 flex items-start gap-3 shadow-sm">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            <span>{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="p-4 mb-8 rounded-2xl bg-rose-50 border border-rose-200 text-sm font-semibold text-rose-800 flex items-start gap-3 shadow-sm">
            <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
          {isVerifiedUser ? (
            /* DYNAMIC CARDS FOR LOGGED-IN, EMAIL-VERIFIED USERS (Parts 2, 3, 4) */
            <>
              {/* Card 1: Standard Pack (40 Credits - ₹100) */}
              <Card className="p-8 sm:p-10 border border-slate-200 bg-white shadow-sm flex flex-col justify-between h-full">
                <div className="space-y-6 flex-1 flex flex-col">
                  <div className="flex items-center justify-between">
                    <Badge variant="navy">Top-Up Pack</Badge>
                    <span className="text-xs font-semibold text-slate-500">Instant Delivery</span>
                  </div>
                  <div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl sm:text-5xl font-extrabold text-brand-navy-950">₹100</span>
                      <span className="text-slate-500 font-semibold text-lg">/ 40 Credits</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                      Just ₹2.50 per generated answer. Secure payment via Razorpay.
                    </p>
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex-1">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Package Features:</div>
                    <ul className="space-y-3 text-sm text-slate-700">
                      <li className="flex items-center gap-2.5">
                        <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        <span><strong>40 additional AI answers</strong> added instantly</span>
                      </li>
                      <li className="flex items-center gap-2.5">
                        <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        <span>Zero recurring monthly charges or surprises</span>
                      </li>
                      <li className="flex items-center gap-2.5">
                        <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        <span>UPI (GPay, PhonePe, Paytm), Cards & Net Banking</span>
                      </li>
                      <li className="flex items-center gap-2.5">
                        <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        <span>Credits stack and never expire</span>
                      </li>
                      <li className="flex items-center gap-2.5">
                        <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        <span>Live instant delivery upon payment</span>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="pt-6 mt-auto">
                  <button
                    type="button"
                    onClick={() => handleBuyCredits('credits_40')}
                    disabled={isProcessing}
                    className="w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white font-bold text-base shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 cursor-pointer"
                  >
                    {processingPackageId === 'credits_40' ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Opening Payment Gateway...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>Buy 40 Credits (₹100)</span>
                      </>
                    )}
                  </button>
                </div>
              </Card>

              {/* Card 2: Pro Value Pack (90 Credits - ₹200) */}
              <Card className="p-8 sm:p-10 border-2 border-brand-purple-500 bg-gradient-to-b from-white to-purple-50/20 shadow-lg relative flex flex-col justify-between h-full">
                <div className="space-y-6 flex-1 flex flex-col">
                  <div className="flex items-center justify-between">
                    <Badge variant="purple">Best Value</Badge>
                    <span className="text-xs font-bold text-brand-purple-600">Save 11%</span>
                  </div>
                  <div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl sm:text-5xl font-extrabold text-brand-navy-950">₹200</span>
                      <span className="text-slate-500 font-semibold text-lg">/ 90 Credits</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                      Just ₹2.22 per answer. Maximum savings for active interview preparation.
                    </p>
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex-1">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Package Features:</div>
                    <ul className="space-y-3 text-sm text-slate-700">
                      <li className="flex items-center gap-2.5">
                        <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        <span><strong>90 additional AI answers</strong> added instantly</span>
                      </li>
                      <li className="flex items-center gap-2.5">
                        <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        <span><strong>10 bonus credits</strong> over two ₹100 purchases</span>
                      </li>
                      <li className="flex items-center gap-2.5">
                        <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        <span>Zero recurring monthly charges or surprises</span>
                      </li>
                      <li className="flex items-center gap-2.5">
                        <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        <span>UPI (GPay, PhonePe, Paytm), Cards & Net Banking</span>
                      </li>
                      <li className="flex items-center gap-2.5">
                        <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        <span>Credits stack and never expire</span>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="pt-6 mt-auto">
                  <button
                    type="button"
                    onClick={() => handleBuyCredits('credits_90')}
                    disabled={isProcessing}
                    className="w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-brand-purple-600 hover:bg-brand-purple-700 disabled:opacity-60 text-white font-bold text-base shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-brand-purple-500 focus:ring-offset-2 cursor-pointer"
                  >
                    {processingPackageId === 'credits_90' ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Opening Payment Gateway...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>Buy 90 Credits (₹200)</span>
                      </>
                    )}
                  </button>
                </div>
              </Card>
            </>
          ) : (
            /* CARDS FOR LOGGED-OUT OR UNVERIFIED USERS */
            <>
              {/* Card 1: Free Starter */}
              <Card className="p-8 sm:p-10 border-2 border-brand-purple-500 bg-gradient-to-b from-white to-purple-50/20 shadow-lg relative flex flex-col justify-between h-full">
                <div className="space-y-6 flex-1 flex flex-col">
                  <div className="flex items-center justify-between">
                    <Badge variant="purple">Free Starter</Badge>
                    <span className="text-xs font-bold text-brand-purple-600">Zero Payment Required</span>
                  </div>
                  <div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl sm:text-5xl font-extrabold text-brand-navy-950">30 Credits</span>
                      <span className="text-xl font-bold text-slate-400 line-through">₹75</span>
                      <span className="text-xl font-bold text-emerald-600">FREE</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                      Credited immediately upon verifying your 6-digit email OTP.
                    </p>
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex-1">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Included in Free Tier:</div>
                    <ul className="space-y-3 text-sm text-slate-700">
                      <li className="flex items-center gap-2.5">
                        <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        <span><strong>30 generated AI answers</strong> (1 credit = 1 answer)</span>
                      </li>
                      <li className="flex items-center gap-2.5">
                        <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        <span>Real-time voice transcription (Deepgram Nova-3)</span>
                      </li>
                      <li className="flex items-center gap-2.5">
                        <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        <span>Instant screen capture OCR (Ctrl+Shift+A)</span>
                      </li>
                      <li className="flex items-center gap-2.5">
                        <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        <span>Resume context parsing & interview setup</span>
                      </li>
                      <li className="flex items-center gap-2.5">
                        <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        <span>Credits never expire</span>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="pt-6 mt-auto">
                  {isAuthenticated ? (
                    <Button href="/verify-otp" size="lg" variant="primary" className="w-full justify-center">
                      Verify Email to Claim 30 Credits
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  ) : (
                    <Button href="/signup" size="lg" variant="primary" className="w-full justify-center">
                      Claim 30 Free Credits
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  )}
                </div>
              </Card>

              {/* Card 2: Top-Up Pack */}
              <Card className="p-8 sm:p-10 border border-slate-200 bg-white shadow-sm flex flex-col justify-between h-full">
                <div className="space-y-6 flex-1 flex flex-col">
                  <div className="flex items-center justify-between">
                    <Badge variant="navy">Top-Up Pack</Badge>
                    <span className="text-xs font-semibold text-slate-500">One-Time Payment</span>
                  </div>
                  <div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl sm:text-5xl font-extrabold text-brand-navy-950">₹100</span>
                      <span className="text-slate-500 font-semibold text-lg">/ 40 Credits</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                      Just ₹2.50 per generated answer. Secure payment via Razorpay.
                    </p>
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex-1">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Top-Up Details:</div>
                    <ul className="space-y-3 text-sm text-slate-700">
                      <li className="flex items-center gap-2.5">
                        <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        <span><strong>40 additional AI answers</strong> added instantly</span>
                      </li>
                      <li className="flex items-center gap-2.5">
                        <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        <span>Zero recurring monthly charges or surprises</span>
                      </li>
                      <li className="flex items-center gap-2.5">
                        <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        <span>UPI (GPay, PhonePe, Paytm), Cards & Net Banking</span>
                      </li>
                      <li className="flex items-center gap-2.5">
                        <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        <span>Buy only when your balance runs low</span>
                      </li>
                      <li className="flex items-center gap-2.5">
                        <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        <span>Credits stack and never expire</span>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="pt-6 mt-auto">
                  {isAuthenticated ? (
                    <button
                      type="button"
                      onClick={() => handleBuyCredits('credits_40')}
                      disabled={isProcessing}
                      className="w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-brand-purple-600 hover:bg-brand-purple-700 disabled:opacity-60 text-white font-bold text-base shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-brand-purple-500 focus:ring-offset-2 cursor-pointer"
                    >
                      {processingPackageId === 'credits_40' ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Opening Payment Gateway...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          <span>Buy 40 Credits (₹100)</span>
                        </>
                      )}
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <Link
                        to="/login?redirect=/credits"
                        className="w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-base shadow-sm transition-all text-center"
                      >
                        <span>Log In to Buy Credits</span>
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                      <p className="text-xs text-slate-500 text-center">
                        New to Meoow?{' '}
                        <Link to="/signup" className="text-brand-purple-600 hover:underline font-semibold">
                          Create free account
                        </Link>{' '}
                        first to get 30 starter credits.
                      </p>
                    </div>
                  )}
                </div>
              </Card>
            </>
          )}
        </div>

        {/* ADMIN LIVE TEST PACKAGES PANEL (Part 5) */}
        {isAdmin && (
          <div className="mt-8 p-6 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge variant="orange">Admin Live Test Mode</Badge>
                <span className="text-xs font-semibold text-amber-800">Restricted to {user?.email}</span>
              </div>
              <span className="text-xs font-mono text-slate-500">Live Razorpay Test Suite</span>
            </div>
            <p className="text-xs text-slate-600">
              Test end-to-end live Razorpay payment processing and real webhook/signature verification with minimal ₹5 or ₹10 transactions.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-white border border-amber-200 flex flex-col justify-between h-full">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-slate-900 text-sm">5 Credits (Test Pack)</span>
                    <span className="font-extrabold text-amber-700 text-base">₹5</span>
                  </div>
                  <p className="text-xs text-slate-500 mb-3">Live transaction test for ₹5 (500 paise)</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleBuyCredits('test_credits_5')}
                  disabled={isProcessing}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white font-semibold text-sm shadow-sm transition-all cursor-pointer mt-auto"
                >
                  {processingPackageId === 'test_credits_5' ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Opening...</span>
                    </>
                  ) : (
                    <span>Test Pay ₹5 (5 Credits)</span>
                  )}
                </button>
              </div>

              <div className="p-4 rounded-xl bg-white border border-amber-200 flex flex-col justify-between h-full">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-slate-900 text-sm">10 Credits (Test Pack)</span>
                    <span className="font-extrabold text-amber-700 text-base">₹10</span>
                  </div>
                  <p className="text-xs text-slate-500 mb-3">Live transaction test for ₹10 (1000 paise)</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleBuyCredits('test_credits_10')}
                  disabled={isProcessing}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white font-semibold text-sm shadow-sm transition-all cursor-pointer mt-auto"
                >
                  {processingPackageId === 'test_credits_10' ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Opening...</span>
                    </>
                  ) : (
                    <span>Test Pay ₹10 (10 Credits)</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 3. HOW CREDITS WORK EXPLANATION */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <Card className="p-8 bg-slate-50 border-slate-200 space-y-4">
          <div className="flex items-center gap-2 text-brand-purple-600 text-xs font-bold uppercase tracking-wider">
            <Zap className="w-4 h-4" />
            <span>Strict Credit Rule</span>
          </div>
          <h3 className="text-xl font-bold text-brand-navy-950">
            Exactly 1 credit = 1 successfully generated AI answer.
          </h3>
          <p className="text-slate-600 text-sm leading-relaxed">
            Credits are deducted only when an AI answer is successfully delivered to your desktop app. Voice transcription, audio diarization, screen capture previews, and keyboard controls are always free and do not consume credits. If an AI request fails or is interrupted, no credit is deducted.
          </p>
        </Card>
      </section>

      {/* 4. CREDITS FAQ */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <SectionHeading
          badgeText="FAQ"
          badgeVariant="purple"
          title="Frequently Asked Questions About Credits"
          subtitle="Everything you need to know about our student-accessible credit model."
        />

        <Accordion items={CREDITS_FAQS} />
      </section>

      {/* 5. CTA SECTION */}
      <CtaSection
        title="Start Practicing for Free Today"
        subtitle="Claim your 30 complimentary credits on registration. No credit card required."
      />
    </div>
  );
};
