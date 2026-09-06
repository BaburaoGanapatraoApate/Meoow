import React, { useState } from 'react';
import {
  Monitor,
  Eye,
  EyeOff,
  ShieldCheck,
  Zap,
  Mic,
  Cpu,
  Lock,
  Sparkles,
  ArrowRight,
  Sliders,
  CheckCircle2,
  Tv,
} from 'lucide-react';

export const HeroInterviewStoryVisual: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'both' | 'candidate' | 'interviewer'>('both');
  const [showCallouts, setShowCallouts] = useState(true);

  return (
    <div className="w-full bg-slate-950 rounded-2xl sm:rounded-3xl border border-slate-800 shadow-2xl overflow-hidden text-slate-100 font-sans relative">
      {/* Subtle Top Glow */}
      <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 bg-brand-purple-600/15 rounded-full blur-3xl" />

      {/* 1. Header Bar: Session Status & View Switcher */}
      <div className="bg-slate-900/90 px-4 sm:px-6 py-3.5 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3 select-none relative z-10">
        {/* Left: Live Session Status */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block"></span>
            <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block"></span>
            <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block"></span>
          </div>

          <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
            <img src="/logo.png" alt="Meoow Logo" className="w-5 h-5 rounded-md object-contain" />
            <span className="text-xs sm:text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
              <span>Live Technical Interview</span>
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Google Meet Active (00:55)
            </span>
          </div>
        </div>

        {/* Center: View Switcher */}
        <div className="flex items-center bg-slate-950 rounded-lg p-1 border border-slate-800 text-xs">
          <button
            onClick={() => setActiveTab('both')}
            className={`px-3 py-1 rounded-md transition font-medium flex items-center gap-1.5 ${
              activeTab === 'both'
                ? 'bg-brand-purple-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Tv className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Dual View</span>
            <span className="sm:hidden">Both</span>
          </button>
          <button
            onClick={() => setActiveTab('candidate')}
            className={`px-3 py-1 rounded-md transition font-medium flex items-center gap-1.5 ${
              activeTab === 'candidate'
                ? 'bg-brand-purple-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Eye className="w-3.5 h-3.5 text-brand-purple-300" />
            <span>Your Screen</span>
          </button>
          <button
            onClick={() => setActiveTab('interviewer')}
            className={`px-3 py-1 rounded-md transition font-medium flex items-center gap-1.5 ${
              activeTab === 'interviewer'
                ? 'bg-brand-purple-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <EyeOff className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Interviewer Sees</span>
            <span className="sm:hidden">Interviewer</span>
          </button>
        </div>

        {/* Right: Quick Features / Callout Toggle */}
        <div className="hidden lg:flex items-center gap-2">
          <button
            onClick={() => setShowCallouts(!showCallouts)}
            className={`text-xs px-2.5 py-1 rounded-md border transition font-medium flex items-center gap-1.5 ${
              showCallouts
                ? 'bg-brand-purple-950/60 border-brand-purple-500/40 text-brand-purple-300'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-300'
            }`}
          >
            <Sparkles className="w-3 h-3 text-brand-purple-400" />
            <span>{showCallouts ? 'UI Highlights: ON' : 'UI Highlights: OFF'}</span>
          </button>
        </div>
      </div>

      {/* 2. Main Visual Canvas */}
      <div className="p-4 sm:p-6 lg:p-7 space-y-6">
        {/* Dynamic Grid based on selected tab */}
        <div
          className={`grid gap-6 ${
            activeTab === 'both'
              ? 'grid-cols-1 lg:grid-cols-12'
              : 'grid-cols-1'
          }`}
        >
          {/* ========================================================================= */}
          {/* VIEW A: CANDIDATE'S PHYSICAL SCREEN (WHAT YOU SEE) */}
          {/* ========================================================================= */}
          {(activeTab === 'both' || activeTab === 'candidate') && (
            <div
              className={`${
                activeTab === 'both' ? 'lg:col-span-7' : 'w-full'
              } flex flex-col bg-slate-900/90 rounded-2xl border border-slate-800 p-3 sm:p-4 relative group shadow-xl`}
            >
              {/* Header Badge */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-800/80">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-purple-500/15 border border-brand-purple-500/30 text-brand-purple-300 text-xs font-semibold">
                    <Eye className="w-3.5 h-3.5 text-brand-purple-400" />
                    <span>Candidate Physical Screen</span>
                  </span>
                  <span className="text-xs text-slate-400 font-medium hidden sm:inline">
                    (Visible exclusively on your display)
                  </span>
                </div>

                <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                    Ctrl + Shift + A
                  </span>
                  <span className="text-slate-500">Analyze</span>
                </div>
              </div>

              {/* Authentic Screenshot Display */}
              <div className="relative rounded-xl overflow-hidden border border-slate-700/80 bg-slate-950 shadow-2xl">
                {/* Real Screenshot Image */}
                <img
                  src="/meoow-real-desktop-rect.png"
                  alt="Real Meoow AI desktop application running on candidate screen during live interview"
                  className="w-full h-auto object-cover block"
                  loading="eager"
                />

                {/* Subtle Interactive Callout Badges on the Real UI */}
                {showCallouts && (
                  <>
                    {/* Callout 1: Top Floating Control Bar */}
                    <div className="absolute top-2 left-2 sm:top-3 sm:left-3 bg-slate-950/90 backdrop-blur-md text-[10px] sm:text-xs font-medium text-brand-purple-200 px-2.5 py-1 rounded-lg border border-brand-purple-500/50 shadow-lg flex items-center gap-1.5">
                      <Sliders className="w-3 h-3 text-brand-purple-400" />
                      <span>Floating Bar • 90% Opacity • Ctrl+Shift+H to hide</span>
                    </div>

                    {/* Callout 2: Real-Time Answer Card */}
                    <div className="absolute bottom-12 left-2 sm:bottom-14 sm:left-4 bg-slate-950/95 backdrop-blur-md text-[10px] sm:text-xs font-medium text-emerald-300 px-2.5 py-1 rounded-lg border border-emerald-500/50 shadow-lg flex items-center gap-1.5">
                      <Zap className="w-3 h-3 text-emerald-400" />
                      <span>~0.2s Groq LPU: Data Science Life Cycle</span>
                    </div>

                    {/* Callout 3: Live Voice Diarization */}
                    <div className="absolute top-12 right-2 sm:top-14 sm:right-3 bg-slate-950/90 backdrop-blur-md text-[10px] sm:text-xs font-medium text-sky-300 px-2.5 py-1 rounded-lg border border-sky-500/50 shadow-lg flex items-center gap-1.5">
                      <Mic className="w-3 h-3 text-sky-400" />
                      <span>Deepgram Voice Diarization</span>
                    </div>
                  </>
                )}
              </div>

              {/* Bottom Feature Badges */}
              <div className="pt-3 mt-3 grid grid-cols-3 gap-2 text-center text-[11px] text-slate-300">
                <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/80">
                  <span className="text-slate-400 block text-[10px]">Response Speed</span>
                  <strong className="text-brand-purple-400 font-semibold">~0.2s Groq Inference</strong>
                </div>
                <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/80">
                  <span className="text-slate-400 block text-[10px]">Window Opacity</span>
                  <strong className="text-white font-semibold">Customizable (50-100%)</strong>
                </div>
                <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/80">
                  <span className="text-slate-400 block text-[10px]">Audio Transcription</span>
                  <strong className="text-sky-400 font-semibold">Deepgram Nova-2 Live</strong>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* VIEW B: INTERVIEWER'S SCREEN-SHARE STREAM (WHAT THE INTERVIEWER SEES) */}
          {/* ========================================================================= */}
          {(activeTab === 'both' || activeTab === 'interviewer') && (
            <div
              className={`${
                activeTab === 'both' ? 'lg:col-span-5' : 'w-full'
              } flex flex-col bg-slate-900/90 rounded-2xl border border-slate-800 p-3 sm:p-4 relative shadow-xl`}
            >
              {/* Header Badge */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-800/80">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
                    <EyeOff className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Interviewer Screen-Share Stream</span>
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/60">
                  <Lock className="w-3 h-3 text-emerald-400" />
                  <span>Meoow Excluded</span>
                </div>
              </div>

              {/* Interviewer View Mockup Canvas */}
              <div className="flex-1 flex flex-col rounded-xl overflow-hidden border border-slate-700/80 bg-slate-950 p-4 relative space-y-4">
                {/* Meeting Video Stream Header */}
                <div className="flex items-center justify-between bg-slate-900 p-2.5 rounded-lg border border-slate-800 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-brand-purple-600 flex items-center justify-center text-white font-bold text-xs">
                      IE
                    </div>
                    <div>
                      <div className="font-semibold text-slate-200">Interviewer (Lead Staff Engineer)</div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        Speaking: "Can you walk me through the data science life cycle?"
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-400 bg-slate-950 px-2 py-1 rounded border border-slate-800">
                    Google Meet
                  </span>
                </div>

                {/* Candidate Shared Coding/Presentation Workspace (CLEAN — NO OVERLAY) */}
                <div className="flex-1 bg-slate-900/60 rounded-lg p-3 sm:p-4 border border-slate-800 space-y-3 font-mono text-xs">
                  <div className="flex items-center justify-between text-slate-400 border-b border-slate-800 pb-2 text-[11px]">
                    <span className="text-slate-300 font-sans font-semibold flex items-center gap-1.5">
                      <Monitor className="w-3.5 h-3.5 text-slate-400" />
                      Shared Candidate Screen
                    </span>
                    <span className="text-emerald-400 font-sans text-[10px] flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      Clean Stream Capture
                    </span>
                  </div>

                  {/* Clean Technical Workspace Mock */}
                  <div className="space-y-1.5 text-slate-300 text-[11px] sm:text-xs">
                    <p className="text-indigo-300 font-sans font-medium text-xs">
                      // Question: Explain the End-to-End Data Science Life Cycle
                    </p>
                    <div className="p-2.5 bg-slate-950 rounded border border-slate-800/80 text-slate-300 font-sans text-xs leading-relaxed space-y-1">
                      <div className="text-slate-400 text-[11px]">Candidate Live Notes:</div>
                      <p className="text-slate-200">
                        1. Business & Problem Definition → Clarify success metric
                      </p>
                      <p className="text-slate-200">
                        2. Data Ingestion & Cleaning → Handle nulls, drift, imbalance
                      </p>
                      <p className="text-slate-200">
                        3. EDA & Feature Engineering → Cross-validation strategy
                      </p>
                    </div>
                  </div>

                  {/* Screen Sharing Active Banner */}
                  <div className="bg-slate-950 px-3 py-1.5 rounded border border-slate-800 text-[10px] text-slate-400 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
                      meet.google.com is sharing your screen
                    </span>
                    <span className="text-slate-500">[Stop sharing]</span>
                  </div>
                </div>

                {/* Stream Protection Guarantee Banner */}
                <div className="bg-brand-purple-950/40 border border-brand-purple-500/30 rounded-lg p-3 text-xs text-brand-purple-200 space-y-1.5">
                  <div className="flex items-center gap-1.5 font-semibold text-brand-purple-300">
                    <ShieldCheck className="w-4 h-4 text-brand-purple-400 flex-shrink-0" />
                    <span>Discreet Desktop Display Architecture</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed font-sans">
                    The Meoow floating bar and AI answer cards render strictly on your physical monitor framebuffer and are excluded from video conferencing screen capture streams.
                  </p>
                </div>
              </div>

              {/* Bottom Feature Badges */}
              <div className="pt-3 mt-3 grid grid-cols-2 gap-2 text-center text-[11px] text-slate-300">
                <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/80">
                  <span className="text-slate-400 block text-[10px]">Screen Sharing Stream</span>
                  <strong className="text-emerald-400 font-semibold">100% Unaltered Stream</strong>
                </div>
                <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/80">
                  <span className="text-slate-400 block text-[10px]">Meeting Platforms</span>
                  <strong className="text-white font-semibold">Meet, Zoom, Teams, Webex</strong>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 3. Bottom Summary Connector Bar */}
        <div className="bg-slate-900/80 rounded-xl border border-slate-800/80 p-3 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3 text-slate-300">
            <span className="w-8 h-8 rounded-lg bg-brand-purple-600/20 border border-brand-purple-500/40 flex items-center justify-center text-brand-purple-400 flex-shrink-0">
              <Cpu className="w-4 h-4" />
            </span>
            <div>
              <span className="font-semibold text-white block">Real Desktop AI Copilot</span>
              <span className="text-slate-400 text-[11px]">
                Powered by sub-second Groq LPU inference, Deepgram voice transcription, and hotkey screen OCR.
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <a
              href="/download"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-brand-purple-600 hover:bg-brand-purple-500 text-white font-medium text-xs transition shadow-sm"
            >
              <span>Download Desktop Client</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};