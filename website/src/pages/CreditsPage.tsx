import React from 'react';
import { SectionHeading } from '../components/ui/SectionHeading';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Accordion } from '../components/ui/Accordion';
import { CtaSection } from '../components/ui/CtaSection';
import { CREDITS_FAQS } from '../data/faqs';
import { Check, ArrowRight, Zap } from 'lucide-react';

export const CreditsPage: React.FC = () => {
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
          No expensive monthly subscriptions. No auto-renewing trials. Get 30 free credits on registration, and top up 40 credits for just ₹100 whenever you need them.
        </p>
      </section>

      {/* 2. PRICING & CREDITS CARDS */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
          {/* Card 1: Free Starter */}
          <Card className="p-8 sm:p-10 space-y-6 border-2 border-brand-purple-500 bg-gradient-to-b from-white to-purple-50/20 shadow-lg relative flex flex-col justify-between">
            <div className="space-y-6">
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

              <div className="pt-4 border-t border-slate-100">
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

            <div className="pt-6">
              <Button href="/download" size="lg" variant="primary" className="w-full justify-center">
                Claim 30 Free Credits
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </Card>

          {/* Card 2: Top-Up Pack */}
          <Card className="p-8 sm:p-10 space-y-6 border border-slate-200 bg-white shadow-sm flex flex-col justify-between">
            <div className="space-y-6">
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

              <div className="pt-4 border-t border-slate-100">
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

            <div className="pt-6">
              <Button href="/download" size="lg" variant="secondary" className="w-full justify-center">
                Download App to Buy Credits
              </Button>
            </div>
          </Card>
        </div>
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
