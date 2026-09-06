import React from 'react';
import { SectionHeading } from '../components/ui/SectionHeading';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Accordion } from '../components/ui/Accordion';
import { CtaSection } from '../components/ui/CtaSection';
import { WORKFLOW_STEPS } from '../data/howItWorks';
import { HOW_IT_WORKS_FAQS } from '../data/faqs';
import {
  DownloadCloud,
  Gift,
  Sliders,
  Radio,
  Crop,
  CheckCircle2,
  Shield,
  Sparkles,
} from 'lucide-react';

export const HowItWorksPage: React.FC = () => {
  const getStepIcon = (iconName: string) => {
    switch (iconName) {
      case 'DownloadCloud': return <DownloadCloud className="w-6 h-6 text-brand-purple-600" />;
      case 'Gift': return <Gift className="w-6 h-6 text-emerald-500" />;
      case 'Sliders': return <Sliders className="w-6 h-6 text-sky-500" />;
      case 'Radio': return <Radio className="w-6 h-6 text-purple-500" />;
      case 'Crop': return <Crop className="w-6 h-6 text-amber-500" />;
      case 'CheckCircle2': return <CheckCircle2 className="w-6 h-6 text-brand-purple-600" />;
      default: return <Sparkles className="w-6 h-6 text-brand-purple-600" />;
    }
  };

  return (
    <div className="space-y-20 sm:space-y-28 py-12">
      {/* 1. HERO SECTION */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
        <Badge variant="purple" size="md">
          Simple 6-Step Workflow
        </Badge>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-brand-navy-950 tracking-tight leading-tight">
          How Meoow Works From{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-purple-600 to-indigo-500">
            Setup to Answer
          </span>
        </h1>
        <p className="text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
          See how our lightweight desktop overlay and ultra-fast backend pipeline provide real-time interview assistance in six seamless steps.
        </p>
      </section>

      {/* 2. STEP BY STEP DETAILED TIMELINE */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="space-y-8 relative">
          {/* Vertical connecting line on desktop */}
          <div className="hidden md:block absolute left-8 top-10 bottom-10 w-0.5 bg-slate-200 -z-10" />

          {WORKFLOW_STEPS.map((step, index) => (
            <div key={step.stepNumber} className="flex flex-col md:flex-row gap-6 items-start">
              {/* Step indicator */}
              <div className="flex-shrink-0 w-16 h-16 rounded-2xl bg-white border-2 border-brand-purple-600 text-brand-navy-950 shadow-md flex items-center justify-center font-black text-xl font-mono">
                {step.stepNumber}
              </div>

              {/* Step content card */}
              <Card className="flex-1 p-6 sm:p-8 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                      {getStepIcon(step.iconName)}
                    </div>
                    <h3 className="text-xl font-bold text-brand-navy-950">{step.title}</h3>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded bg-slate-100 text-slate-600">
                    Step {index + 1} of 6
                  </span>
                </div>

                <p className="text-slate-700 text-base leading-relaxed">{step.details}</p>

                {step.tip && (
                  <div className="bg-brand-surface-subtle p-3.5 rounded-xl border border-slate-200/80 text-xs sm:text-sm text-slate-600 flex items-start gap-2">
                    <span className="text-brand-purple-600 font-bold flex-shrink-0">💡 Pro Tip:</span>
                    <span>{step.tip}</span>
                  </div>
                )}
              </Card>
            </div>
          ))}
        </div>
      </section>

      {/* 3. TECHNICAL ARCHITECTURE SUMMARY */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <Card className="p-8 sm:p-10 bg-slate-900 text-white border-slate-800 space-y-6">
          <div className="flex items-center gap-2 text-brand-purple-400 text-xs font-bold uppercase tracking-wider">
            <Shield className="w-4 h-4" />
            <span>Behind The Scenes Architecture</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white">
            Secure, Ephemeral, and Sub-Second by Design
          </h2>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            Meoow is built on an isolated, server-authoritative architecture. Your desktop client communicates over TLS-encrypted WebSockets with our backend gateway. Incoming voice audio is transcribed ephemerally via Deepgram without persistent storage, and coding questions are processed in ~0.2s via Groq hardware acceleration.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-800 text-xs text-slate-400">
            <div>
              <strong className="text-white block mb-1">Dual-Channel Audio</strong>
              <span>Diarizes candidate vs. interviewer speech streams in real time.</span>
            </div>
            <div>
              <strong className="text-white block mb-1">Encrypted Gateway</strong>
              <span>AES-256 encrypted credentials on Neon PostgreSQL.</span>
            </div>
            <div>
              <strong className="text-white block mb-1">Server-Verified Credits</strong>
              <span>Exactly 1 credit per successfully generated AI answer.</span>
            </div>
          </div>
        </Card>
      </section>

      {/* 4. HOW IT WORKS FAQ */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <SectionHeading
          badgeText="FAQ"
          badgeVariant="purple"
          title="Workflow Questions & Answers"
          subtitle="Everything you need to know about setting up and running Meoow during practice sessions."
        />

        <Accordion items={HOW_IT_WORKS_FAQS} />
      </section>

      {/* 5. CTA SECTION */}
      <CtaSection
        title="Ready to Set Up Your First Session?"
        subtitle="Download the app, claim 30 free credits, and start practicing in minutes."
      />
    </div>
  );
};
