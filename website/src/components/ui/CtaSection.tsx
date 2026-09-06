import React from 'react';
import { Button } from './Button';
import { Badge } from './Badge';
import { Sparkles, ArrowRight, ShieldCheck, Zap } from 'lucide-react';

export interface CtaSectionProps {
  title?: string;
  subtitle?: string;
  primaryCtaText?: string;
  primaryCtaHref?: string;
  secondaryCtaText?: string;
  secondaryCtaHref?: string;
}

export const CtaSection: React.FC<CtaSectionProps> = ({
  title = 'Ready to Interview Smarter and Answer with Confidence?',
  subtitle = 'Download the lightweight Meoow desktop client today. Get 30 free credits upon verified email registration with zero recurring subscription traps.',
  primaryCtaText = 'Get Meoow Free',
  primaryCtaHref = '/download',
  secondaryCtaText = 'Explore Features',
  secondaryCtaHref = '/features',
}) => {
  return (
    <section className="relative overflow-hidden py-16 sm:py-24 bg-gradient-to-b from-brand-navy-900 to-brand-navy-950 text-white rounded-3xl mx-4 sm:mx-8 my-12 shadow-2xl border border-brand-navy-800">
      {/* Background Decorative Glow */}
      <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 bg-brand-purple-500/20 rounded-full blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 right-10 w-80 h-80 bg-sky-500/15 rounded-full blur-3xl" />

      <div className="relative max-w-4xl mx-auto px-6 text-center space-y-8">
        <div className="flex justify-center">
          <Badge variant="purple" className="bg-brand-purple-500/20 text-brand-purple-300 border-brand-purple-400/30">
            <Sparkles className="w-3.5 h-3.5" />
            <span>30 Free Credits on Signup</span>
          </Badge>
        </div>

        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-tight">
          {title}
        </h2>

        <p className="text-base sm:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
          {subtitle}
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
          <Button
            href={primaryCtaHref}
            size="lg"
            variant="primary"
            className="w-full sm:w-auto text-base shadow-lg shadow-brand-purple-500/25"
          >
            {primaryCtaText}
            <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
          <Button
            href={secondaryCtaHref}
            size="lg"
            variant="secondary"
            className="w-full sm:w-auto text-base bg-white/10 hover:bg-white/15 text-white border-white/20"
          >
            {secondaryCtaText}
          </Button>
        </div>

        {/* Trust Badges */}
        <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400 pt-4 border-t border-slate-800/80">
          <div className="flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-brand-purple-400" />
            <span>Answers in as little as ~0.2s</span>
          </div>
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Zero Audio Retention</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span>₹100 = 40 Credits</span>
          </div>
        </div>
      </div>
    </section>
  );
};
