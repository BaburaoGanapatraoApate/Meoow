import React from 'react';
import { SectionHeading } from '../components/ui/SectionHeading';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Accordion } from '../components/ui/Accordion';
import { CtaSection } from '../components/ui/CtaSection';
import { ABOUT_FAQS } from '../data/faqs';
import { Target } from 'lucide-react';

export const AboutPage: React.FC = () => {
  return (
    <div className="space-y-20 sm:space-y-28 py-12">
      {/* 1. HERO SECTION */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
        <Badge variant="purple" size="md">
          About Meoow AI
        </Badge>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-brand-navy-950 tracking-tight leading-tight">
          Empowering Engineers to{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-purple-600 to-indigo-500">
            Interview with Confidence
          </span>
        </h1>
        <p className="text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
          We are on a mission to demystify technical interviews, reduce high-stakes anxiety, and make premium AI preparation accessible to every candidate.
        </p>
      </section>

      {/* 2. THE STORY / PHILOSOPHY */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <div className="space-y-4">
            <h2 className="text-2xl sm:text-3xl font-bold text-brand-navy-950">
              Why We Built Meoow
            </h2>
            <p className="text-slate-600 leading-relaxed text-sm sm:text-base">
              Technical interviews are notoriously stressful. Candidates are often judged on how quickly they can recall tricky algorithmic edge cases under intense pressure, rather than their true engineering capability, collaboration skills, and problem-solving mindset.
            </p>
            <p className="text-slate-600 leading-relaxed text-sm sm:text-base">
              Traditional mock interview platforms charge exorbitant fees ($100+/hr), pricing out college students and junior developers. We built Meoow to provide a fast, affordable, and accessible practice copilot that gives candidates real-time feedback and structured clarity.
            </p>
          </div>

          <Card className="p-8 bg-gradient-to-br from-brand-navy-900 to-slate-900 text-white space-y-4 border-slate-800">
            <div className="flex items-center gap-2 text-brand-purple-400 font-bold text-xs uppercase tracking-wider">
              <Target className="w-4 h-4" />
              <span>Core Mission</span>
            </div>
            <h3 className="text-xl font-bold text-white">
              Leveling the Technical Playing Field
            </h3>
            <p className="text-slate-300 text-sm leading-relaxed">
              We believe every dedicated software engineer deserves access to world-class interview preparation tools without recurring subscription traps.
            </p>
          </Card>
        </div>
      </section>

      {/* 3. FOUR CORE PILLARS */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <SectionHeading
          badgeText="Values"
          badgeVariant="blue"
          title="Our Architectural & Educational Principles"
          subtitle="How we approach AI development, candidate privacy, and fair pricing."
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="p-6 space-y-3">
            <div className="w-10 h-10 rounded-lg bg-brand-purple-50 text-brand-purple-600 flex items-center justify-center font-bold">
              01
            </div>
            <h3 className="text-base font-bold text-brand-navy-950">Active Learning First</h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              AI should mentor candidates with hints, edge-case analysis, and complexity validation rather than encouraging blind copy-pasting.
            </p>
          </Card>

          <Card className="p-6 space-y-3">
            <div className="w-10 h-10 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
              02
            </div>
            <h3 className="text-base font-bold text-brand-navy-950">Sub-Second Speed</h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              We engineer our systems with Groq LPU acceleration to deliver answers in ~0.2s, matching natural conversational cadence.
            </p>
          </Card>

          <Card className="p-6 space-y-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              03
            </div>
            <h3 className="text-base font-bold text-brand-navy-950">Transparent Pricing</h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              30 free signup credits and ₹100 for 40 credits. You pay only for what you use with zero automatic monthly rebilling.
            </p>
          </Card>

          <Card className="p-6 space-y-3">
            <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
              04
            </div>
            <h3 className="text-base font-bold text-brand-navy-950">Privacy by Design</h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Zero persistent audio recordings. Real-time audio streams are processed ephemerally with encrypted server gateways.
            </p>
          </Card>
        </div>
      </section>

      {/* 4. ABOUT FAQS */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <SectionHeading
          badgeText="FAQ"
          badgeVariant="purple"
          title="Frequently Asked Questions About Meoow"
          subtitle="Learn more about our vision, team philosophy, and technology."
        />

        <Accordion items={ABOUT_FAQS} />
      </section>

      {/* 5. CTA SECTION */}
      <CtaSection
        title="Ready to Transform Your Interview Preparation?"
        subtitle="Download Meoow today and start practicing with 30 free credits."
      />
    </div>
  );
};
