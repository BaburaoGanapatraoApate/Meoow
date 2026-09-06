import React from 'react';
import {
  Eye,
  Mic,
  FileText,
  Sparkles,
  ShieldCheck,
  Code2,
} from 'lucide-react';

export const TwoPcAnnotatedVisual: React.FC = () => {
  return (
    <div className="w-full relative mx-auto max-w-6xl select-none">
      {/* Subtle Background Glow behind the composition */}
      <div className="pointer-events-none absolute -top-12 left-1/4 w-96 h-96 bg-brand-purple-600/10 rounded-full blur-3xl -z-10" />
      <div className="pointer-events-none absolute -bottom-10 right-1/4 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl -z-10" />

      {/* ========================================================================= */}
      {/* DESKTOP & TABLET VIEW: FULL ANNOTATED TWO-PC COMPOSITION (md:block) */}
      {/* ========================================================================= */}
      <div className="hidden md:block relative w-full">
        {/* Main Base Image Canvas with Overlaid SVG & Annotations */}
        <div className="relative w-full aspect-[1672/941] rounded-2xl overflow-visible">
          {/* 1. SYNCHRONIZED TOP VIEW LABELS (Precisely aligned at the exact same Y coordinate) */}
          {/* Left Monitor Top Label: Centered at 27.5% over left monitor */}
          <div
            className="absolute -translate-x-1/2 flex flex-col items-center text-center space-y-1 z-30 pointer-events-auto"
            style={{ left: '27.5%', top: '2%' }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-xl bg-slate-900/90 border border-slate-700/80 shadow-xl shadow-slate-950/30 backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-xs lg:text-sm font-bold tracking-wider text-slate-100 uppercase">
                INTERVIEWER VIEW
              </span>
            </div>
            <span className="text-xs text-slate-400 font-medium whitespace-nowrap">
              Sees your shared screen
            </span>
          </div>

          {/* Right Monitor Top Label: Centered at 70.6% over right monitor */}
          <div
            className="absolute -translate-x-1/2 flex flex-col items-center text-center space-y-1 z-30 pointer-events-auto"
            style={{ left: '70.6%', top: '2%' }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-xl bg-slate-900/90 border border-brand-purple-500/50 shadow-xl shadow-brand-purple-950/30 backdrop-blur-md">
              <Eye className="w-3.5 h-3.5 text-brand-purple-400" />
              <span className="text-xs lg:text-sm font-bold tracking-wider text-white uppercase">
                YOUR VIEW
              </span>
            </div>
            <span className="text-xs text-brand-purple-300 font-medium whitespace-nowrap">
              Meoow is visible to you
            </span>
          </div>

          {/* 2. The Authoritative Base Image (two_pc.png) - 100% Untouched */}
          <img
            src="/two_pc.png"
            alt="Meoow AI interview copilot shown during a remote technical interview"
            className="w-full h-full object-contain block drop-shadow-2xl"
            loading="eager"
          />

          {/* 3. SVG Overlay for Precise Curved Bézier Connectors */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none z-20 overflow-visible"
            viewBox="0 0 1672 941"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <defs>
              {/* Arrowhead marker - Slate for Left Shared Code Area */}
              <marker
                id="arrow-slate"
                viewBox="0 0 10 10"
                refX="6"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1.5 L 7 5 L 0 8.5 z" fill="#94A3B8" />
              </marker>

              {/* Arrowhead marker - Brand Purple for Meoow Copilot Header */}
              <marker
                id="arrow-purple"
                viewBox="0 0 10 10"
                refX="6"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1.5 L 7 5 L 0 8.5 z" fill="#A78BFA" />
              </marker>

              {/* Arrowhead marker - Sky Blue for Transcript & Audio Stream */}
              <marker
                id="arrow-sky"
                viewBox="0 0 10 10"
                refX="6"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1.5 L 7 5 L 0 8.5 z" fill="#38BDF8" />
              </marker>

              {/* Arrowhead marker - Emerald for AI Generated Guidance */}
              <marker
                id="arrow-emerald"
                viewBox="0 0 10 10"
                refX="6"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1.5 L 7 5 L 0 8.5 z" fill="#34D399" />
              </marker>

              {/* Drop Filter for SVG paths */}
              <filter id="path-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="#000000" floodOpacity="0.5" />
              </filter>
            </defs>

            {/* 1. CURVED CONNECTOR: Left Monitor — Shared Screen -> Exact Code Editor (x: 380, y: 480) */}
            <path
              d="M 190 435 C 250 435, 310 455, 380 480"
              stroke="#94A3B8"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="4 3"
              markerEnd="url(#arrow-slate)"
              filter="url(#path-glow)"
              opacity="0.9"
            />

            {/* 2. CURVED CONNECTOR: Right Monitor — Meoow AI Copilot -> Floating Bar & Header Title (x: 1200, y: 300) */}
            <path
              d="M 1470 245 C 1380 245, 1290 270, 1200 300"
              stroke="#A78BFA"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              markerEnd="url(#arrow-purple)"
              filter="url(#path-glow)"
              opacity="0.95"
            />

            {/* 3. CURVED CONNECTOR: Right Monitor — AI-Generated Guidance -> Answer Text Area (x: 1260, y: 440) */}
            <path
              d="M 1470 420 C 1390 420, 1320 430, 1260 440"
              stroke="#34D399"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              markerEnd="url(#arrow-emerald)"
              filter="url(#path-glow)"
              opacity="0.95"
            />

            {/* 4. CURVED CONNECTOR: Right Monitor — Voice Detected -> Interviewer Transcript Line (x: 1250, y: 635) */}
            <path
              d="M 1470 610 C 1390 610, 1320 625, 1250 635"
              stroke="#38BDF8"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="4 3"
              markerEnd="url(#arrow-sky)"
              filter="url(#path-glow)"
              opacity="0.9"
            />

            {/* 5. CURVED CONNECTOR: Right Monitor — Live Transcript -> Transcript Section Header (x: 1155, y: 625) */}
            <path
              d="M 1080 810 C 1100 740, 1125 675, 1155 625"
              stroke="#38BDF8"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              markerEnd="url(#arrow-sky)"
              filter="url(#path-glow)"
              opacity="0.9"
            />
          </svg>

          {/* ========================================================================= */}
          {/* 4. HTML ANNOTATION CARDS (Positioned relative to scaled image) */}
          {/* ========================================================================= */}

          {/* ANNOTATION 1: Left Monitor — Shared Screen */}
          <div
            className="absolute z-30 transition-all duration-300 hover:scale-105"
            style={{ left: '-1%', top: '42%' }}
          >
            <div className="bg-slate-950/90 border border-slate-700/80 rounded-xl p-2.5 shadow-2xl backdrop-blur-md max-w-[190px] text-left">
              <div className="flex items-center gap-1.5 text-slate-200 font-semibold text-xs">
                <Code2 className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                <span>Shared screen</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                Your interviewer sees your work
              </p>
            </div>
          </div>

          {/* ANNOTATION 2: Right Monitor — Meoow AI Copilot (Clean right side, does NOT block Your View) */}
          <div
            className="absolute z-30 transition-all duration-300 hover:scale-105"
            style={{ right: '-2%', top: '22%' }}
          >
            <div className="bg-slate-950/95 border border-brand-purple-500/60 rounded-xl p-2.5 shadow-2xl shadow-brand-purple-950/40 backdrop-blur-md max-w-[210px] text-left">
              <div className="flex items-center gap-1.5 text-brand-purple-300 font-bold text-xs">
                <Sparkles className="w-3.5 h-3.5 text-brand-purple-400 flex-shrink-0" />
                <span>Meoow AI Copilot</span>
              </div>
              <p className="text-[11px] text-slate-300 mt-0.5 leading-snug">
                Visible on your side
              </p>
            </div>
          </div>

          {/* ANNOTATION 3: Right Monitor — AI-Generated Guidance */}
          <div
            className="absolute z-30 transition-all duration-300 hover:scale-105"
            style={{ right: '-2%', top: '40%' }}
          >
            <div className="bg-slate-950/95 border border-emerald-500/60 rounded-xl p-2.5 shadow-2xl shadow-emerald-950/30 backdrop-blur-md max-w-[230px] text-left">
              <div className="flex items-center gap-1.5 text-emerald-300 font-bold text-xs">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                <span>AI-generated guidance</span>
              </div>
              <p className="text-[11px] text-slate-300 mt-0.5 leading-snug">
                Context-aware interview assistance
              </p>
            </div>
          </div>

          {/* ANNOTATION 4: Right Monitor — Voice Detected (Positioned below pointing to Interviewer transcript) */}
          <div
            className="absolute z-30 transition-all duration-300 hover:scale-105"
            style={{ right: '-2%', top: '60%' }}
          >
            <div className="bg-slate-950/90 border border-sky-500/50 rounded-xl p-2.5 shadow-2xl backdrop-blur-md max-w-[190px] text-left">
              <div className="flex items-center gap-1.5 text-sky-300 font-semibold text-xs">
                <Mic className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
                <span>Voice detected</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                Interview audio detected
              </p>
            </div>
          </div>

          {/* ANNOTATION 5: Right Monitor — Live Transcript (Bottom center-right) */}
          <div
            className="absolute z-30 transition-all duration-300 hover:scale-105"
            style={{ left: '54%', bottom: '2%' }}
          >
            <div className="bg-slate-950/90 border border-sky-500/50 rounded-xl p-2.5 shadow-2xl backdrop-blur-md max-w-[200px] text-left">
              <div className="flex items-center gap-1.5 text-sky-300 font-semibold text-xs">
                <FileText className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
                <span>Live transcript</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                Interview audio → text
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MOBILE VIEW: ADAPTIVE RESPONSIVE PRESENTATION (< md) */}
      {/* ========================================================================= */}
      <div className="block md:hidden space-y-3">
        {/* Side-by-side Dual View Headers (Aligns with Left Monitor & Right Monitor) */}
        <div className="grid grid-cols-2 gap-2">
          {/* Left Monitor Badge: Interviewer View */}
          <div className="bg-slate-900/90 border border-slate-700/80 rounded-xl p-2.5 text-center flex flex-col items-center justify-center shadow-lg">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-100">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Interviewer View</span>
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5 leading-tight">
              Sees shared screen
            </span>
          </div>

          {/* Right Monitor Badge: Your View */}
          <div className="bg-slate-900/90 border border-brand-purple-500/60 rounded-xl p-2.5 text-center flex flex-col items-center justify-center shadow-lg shadow-brand-purple-950/20">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-white">
              <Eye className="w-3 h-3 text-brand-purple-400 flex-shrink-0" />
              <span>Your View</span>
            </div>
            <span className="text-[10px] text-brand-purple-300 mt-0.5 leading-tight">
              Meoow is visible
            </span>
          </div>
        </div>

        {/* Base Image Container (Fully visible, edge-to-edge containment) */}
        <div className="relative w-full rounded-2xl overflow-hidden bg-slate-950/80 border border-slate-800 shadow-2xl p-1">
          <img
            src="/two_pc.png"
            alt="Meoow AI interview copilot shown during a remote technical interview"
            className="w-full h-auto object-contain block"
            loading="eager"
          />
        </div>

        {/* Mobile Explanatory Feature Cards (Sleek 2x2 Grid) */}
        <div className="grid grid-cols-2 gap-2 text-xs pt-0.5">
          {/* Feature 1: Shared Screen */}
          <div className="bg-slate-900/85 border border-slate-800/90 rounded-xl p-2.5 flex flex-col justify-between shadow-md">
            <div className="flex items-center gap-1.5 text-slate-200 font-bold text-[11px]">
              <Code2 className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              <span>Shared screen</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1 leading-snug">
              Interviewer only sees your code
            </p>
          </div>

          {/* Feature 2: Meoow AI Copilot */}
          <div className="bg-slate-900/85 border border-brand-purple-500/40 rounded-xl p-2.5 flex flex-col justify-between shadow-md shadow-brand-purple-950/20">
            <div className="flex items-center gap-1.5 text-brand-purple-300 font-bold text-[11px]">
              <Sparkles className="w-3.5 h-3.5 text-brand-purple-400 flex-shrink-0" />
              <span>AI Copilot</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1 leading-snug">
              Private on your side screen
            </p>
          </div>

          {/* Feature 3: Live Transcript */}
          <div className="bg-slate-900/85 border border-sky-500/40 rounded-xl p-2.5 flex flex-col justify-between shadow-md">
            <div className="flex items-center gap-1.5 text-sky-300 font-bold text-[11px]">
              <Mic className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
              <span>Live transcript</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1 leading-snug">
              Interview audio → instant text
            </p>
          </div>

          {/* Feature 4: AI Guidance */}
          <div className="bg-slate-900/85 border border-emerald-500/40 rounded-xl p-2.5 flex flex-col justify-between shadow-md">
            <div className="flex items-center gap-1.5 text-emerald-300 font-bold text-[11px]">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
              <span>AI guidance</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1 leading-snug">
              Contextual interview hints
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};