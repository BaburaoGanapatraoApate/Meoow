import React, { useState } from 'react';
import { SectionHeading } from '../components/ui/SectionHeading';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Accordion } from '../components/ui/Accordion';
import { CtaSection } from '../components/ui/CtaSection';
import { DOWNLOAD_FAQS } from '../data/faqs';
import { METRICS } from '../utils/constants';
import { useAuth } from '../context/AuthContext';
import {
  Download,
  Monitor,
  ShieldCheck,
  Gift,
  CheckCircle2,
  Sparkles,
  Info,
  ArrowRight,
} from 'lucide-react';

export const DownloadPage: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  const [showStatusNotice, setShowStatusNotice] = useState(false);

  // Check if a real public installer URL is configured via environment
  const publicDownloadUrl = import.meta.env.VITE_PUBLIC_WINDOWS_DOWNLOAD_URL;
  const hasLiveInstaller = Boolean(
    publicDownloadUrl &&
    typeof publicDownloadUrl === 'string' &&
    publicDownloadUrl.trim().startsWith('http')
  );

  const handleDownloadClick = (e: React.MouseEvent) => {
    if (hasLiveInstaller) {
      // Let standard link navigation open the real download URL
      return;
    }
    // Prevent dummy page navigation and show honest release status
    e.preventDefault();
    setShowStatusNotice(true);
  };

  return (
    <div className="space-y-20 sm:space-y-28 py-12">
      {/* 1. HERO DOWNLOAD BOX */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8">
        <Badge variant="purple" size="md">
          <Download className="w-3.5 h-3.5" />
          <span>Windows Desktop Client</span>
        </Badge>

        <h1 className="text-4xl sm:text-5xl font-extrabold text-brand-navy-950 tracking-tight leading-tight">
          Download Meoow AI for{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-purple-600 to-indigo-500">
            Windows
          </span>
        </h1>

        <p className="text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
          Install the official lightweight desktop companion. Get 30 free starting credits upon email verification.
        </p>

        {/* Authenticated Account Status Banner */}
        {isAuthenticated && user && (
          <div className="max-w-xl mx-auto p-4 rounded-2xl bg-emerald-50 border border-emerald-200/90 flex items-center justify-between text-left text-xs sm:text-sm">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <div>
                <span className="font-bold text-brand-navy-950 block">
                  Logged in as {user.email}
                </span>
                <span className="text-slate-600 text-xs">
                  Balance: {user.usageMode === 'unlimited' ? 'Unlimited' : `${user.credits} Free Credits Ready`}
                </span>
              </div>
            </div>
            <Badge variant="purple" size="sm">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Ready</span>
            </Badge>
          </div>
        )}

        {/* Download Card */}
        <Card className="max-w-xl mx-auto p-8 sm:p-10 space-y-6 shadow-xl border-2 border-brand-purple-400 bg-gradient-to-b from-white via-purple-50/10 to-white">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-semibold text-brand-navy-900 flex items-center gap-1.5">
              <Monitor className="w-4 h-4 text-brand-purple-600" />
              Windows 10 / 11 (64-bit)
            </span>
            <span className="font-mono bg-slate-100 px-2.5 py-0.5 rounded text-slate-600 font-medium">
              {METRICS.releaseLabel}
            </span>
          </div>

          <div className="space-y-3">
            {hasLiveInstaller ? (
              <a
                href={publicDownloadUrl}
                download
                className="inline-flex items-center justify-center w-full px-6 py-4 rounded-xl font-bold bg-brand-purple-600 text-white hover:bg-brand-purple-700 shadow-lg shadow-brand-purple-500/25 transition-all text-base sm:text-lg"
              >
                <Download className="w-5 h-5 mr-2" />
                Download Windows Client (.exe)
              </a>
            ) : (
              <Button
                onClick={handleDownloadClick}
                size="lg"
                variant="primary"
                className="w-full justify-center text-base sm:text-lg shadow-lg shadow-brand-purple-500/25 py-4 cursor-pointer"
              >
                <Download className="w-5 h-5 mr-2" />
                <span>Download Windows Client (.exe)</span>
              </Button>
            )}

            {/* Informational Release Status Notice if live installer URL is not yet attached */}
            {showStatusNotice && !hasLiveInstaller && (
              <div className="p-4 rounded-xl bg-slate-900 text-white text-xs text-left space-y-2 animate-in fade-in-50 duration-200">
                <div className="flex items-center gap-2 font-bold text-brand-purple-400">
                  <Info className="w-4 h-4 flex-shrink-0" />
                  <span>Windows Installer Distribution Ready</span>
                </div>
                <p className="text-slate-300 leading-relaxed text-[11px]">
                  The official Windows desktop installer binary will be distributed upon production launch. Create your free account now to secure your 30 free starting credits!
                </p>
                {!isAuthenticated && (
                  <div className="pt-1">
                    <Button href="/signup" variant="primary" size="sm" className="w-full justify-center">
                      Sign Up & Reserve 30 Free Credits
                      <ArrowRight className="w-3.5 h-3.5 ml-1" />
                    </Button>
                  </div>
                )}
              </div>
            )}

            <div className="text-[11px] text-slate-500 text-center pt-1">
              Official 64-bit Windows Desktop Installer • Direct Setup
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 grid grid-cols-2 gap-4 text-left text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <Gift className="w-4 h-4 text-brand-purple-600 flex-shrink-0" />
              <span>30 Free Signup Credits</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              <span>No Credit Card Needed</span>
            </div>
          </div>
        </Card>
      </section>

      {/* 2. 3-STEP QUICK START GUIDE */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <SectionHeading
          badgeText="Quick Setup"
          badgeVariant="blue"
          title="Install and Start Practicing in 3 Minutes"
          subtitle="Follow these three simple steps to set up your interview workspace."
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-6 sm:p-8 space-y-4">
            <div className="w-10 h-10 rounded-xl bg-brand-purple-50 text-brand-purple-600 font-bold text-lg flex items-center justify-center font-mono">
              1
            </div>
            <h3 className="text-lg font-bold text-brand-navy-950">Run the Installer</h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Launch the downloaded setup file. Windows SmartScreen may show a prompt—click "More Info" and "Run Anyway" to complete installation.
            </p>
          </Card>

          <Card className="p-6 sm:p-8 space-y-4">
            <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 font-bold text-lg flex items-center justify-center font-mono">
              2
            </div>
            <h3 className="text-lg font-bold text-brand-navy-950">Verify Email & Claim 30 Credits</h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Sign up with your email and enter the 6-digit OTP code sent to your inbox. Your 30 free credits are added immediately.
            </p>
          </Card>

          <Card className="p-6 sm:p-8 space-y-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 font-bold text-lg flex items-center justify-center font-mono">
              3
            </div>
            <h3 className="text-lg font-bold text-brand-navy-950">Start Interview Practice</h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Launch your session, toggle overlay opacity, and press <code className="bg-slate-100 text-brand-navy-900 px-1 rounded font-mono font-bold">Ctrl+Shift+A</code> to analyze coding problems on screen.
            </p>
          </Card>
        </div>
      </section>

      {/* 3. SYSTEM REQUIREMENTS */}
      <section id="requirements" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <Card className="p-8 space-y-6 bg-slate-50 border-slate-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-brand-navy-950">Minimum System Requirements</h2>
            <Badge variant="navy">Windows Only</Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm text-slate-700">
            <div className="p-3 bg-white rounded-xl border border-slate-200">
              <strong className="block text-brand-navy-900 mb-1">Operating System</strong>
              <span>Windows 10 or Windows 11 (64-bit architecture)</span>
            </div>
            <div className="p-3 bg-white rounded-xl border border-slate-200">
              <strong className="block text-brand-navy-900 mb-1">RAM / Memory</strong>
              <span>Minimum 4 GB RAM (8 GB recommended)</span>
            </div>
            <div className="p-3 bg-white rounded-xl border border-slate-200">
              <strong className="block text-brand-navy-900 mb-1">Storage</strong>
              <span>200 MB free hard drive space</span>
            </div>
            <div className="p-3 bg-white rounded-xl border border-slate-200">
              <strong className="block text-brand-navy-900 mb-1">Audio / Network</strong>
              <span>Microphone input and active broadband internet connection</span>
            </div>
          </div>
        </Card>
      </section>

      {/* 4. RELEASE HIGHLIGHTS */}
      <section id="changelog" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <h2 className="text-2xl font-bold text-brand-navy-950 text-center">Windows Desktop App Capabilities</h2>
        <Card className="p-6 sm:p-8 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="font-bold text-brand-navy-950">Meoow AI for Windows</div>
            <span className="text-xs text-slate-400">Desktop Feature Set</span>
          </div>
          <ul className="space-y-2 text-xs sm:text-sm text-slate-600 list-disc pl-5 leading-relaxed">
            <li>Dual-channel real-time voice diarization powered by Deepgram Nova-3.</li>
            <li>Sub-second AI answer streaming (~0.2s) powered by Groq LPU hardware gateways.</li>
            <li>Single-key screen capture and high-accuracy OCR parser (<code className="bg-slate-100 px-1 rounded font-mono">Ctrl+Shift+A</code>).</li>
            <li>Discreet floating overlay with custom background opacity slider (10% to 100%) and instant hide (<code className="bg-slate-100 px-1 rounded font-mono">Ctrl+Shift+H</code>).</li>
            <li>30 free starting credits on email verification and ₹100 for 40 credits top-up via Razorpay.</li>
          </ul>
        </Card>
      </section>

      {/* 5. DOWNLOAD FAQS */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <SectionHeading
          badgeText="FAQ"
          badgeVariant="purple"
          title="Frequently Asked Questions About Download"
          subtitle="Answers to common installation, compatibility, and account questions."
        />

        <Accordion items={DOWNLOAD_FAQS} />
      </section>

      {/* 6. CTA SECTION */}
      <CtaSection />
    </div>
  );
};
