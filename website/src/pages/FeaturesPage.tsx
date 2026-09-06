import React, { useState } from 'react';
import { SectionHeading } from '../components/ui/SectionHeading';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Accordion } from '../components/ui/Accordion';
import { CtaSection } from '../components/ui/CtaSection';
import { FEATURES, FeatureItem } from '../data/features';
import { FEATURES_FAQS } from '../data/faqs';
import {
  Mic,
  Scan,
  Zap,
  Code,
  Cpu,
  Compass,
  Layers,
  FileText,
  CreditCard,
  ShieldCheck,
  Check,
  ArrowRight,
} from 'lucide-react';

export const FeaturesPage: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<'all' | 'core' | 'technical' | 'experience' | 'security'>('all');

  const filteredFeatures =
    activeCategory === 'all'
      ? FEATURES
      : FEATURES.filter((f) => f.category === activeCategory);

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'Mic': return <Mic className="w-6 h-6 text-brand-purple-600" />;
      case 'Scan': return <Scan className="w-6 h-6 text-sky-500" />;
      case 'Zap': return <Zap className="w-6 h-6 text-amber-500" />;
      case 'Code': return <Code className="w-6 h-6 text-emerald-500" />;
      case 'Cpu': return <Cpu className="w-6 h-6 text-purple-500" />;
      case 'Compass': return <Compass className="w-6 h-6 text-blue-500" />;
      case 'Layers': return <Layers className="w-6 h-6 text-slate-700" />;
      case 'FileText': return <FileText className="w-6 h-6 text-brand-purple-600" />;
      case 'CreditCard': return <CreditCard className="w-6 h-6 text-emerald-500" />;
      case 'ShieldCheck': return <ShieldCheck className="w-6 h-6 text-sky-500" />;
      default: return <Zap className="w-6 h-6 text-brand-purple-600" />;
    }
  };

  return (
    <div className="space-y-20 sm:space-y-28 py-12">
      {/* 1. HERO SECTION */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
        <Badge variant="purple" size="md">
          Product Capabilities
        </Badge>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-brand-navy-950 tracking-tight leading-tight">
          Everything You Need to Navigate{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-purple-600 to-indigo-500">
            Technical Interviews
          </span>
        </h1>
        <p className="text-lg sm:text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed">
          Explore the complete suite of real-time AI tools designed to support your algorithmic problem solving, system architecture discussions, and behavioral responses.
        </p>
      </section>

      {/* 2. CATEGORY FILTER TABS */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-center gap-2 p-1.5 bg-white rounded-2xl border border-slate-200/80 shadow-sm max-w-2xl mx-auto">
          <button
            onClick={() => setActiveCategory('all')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
              activeCategory === 'all'
                ? 'bg-brand-purple-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-brand-navy-900 hover:bg-slate-50'
            }`}
          >
            All Features ({FEATURES.length})
          </button>
          <button
            onClick={() => setActiveCategory('core')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
              activeCategory === 'core'
                ? 'bg-brand-purple-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-brand-navy-900 hover:bg-slate-50'
            }`}
          >
            Core Engine
          </button>
          <button
            onClick={() => setActiveCategory('technical')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
              activeCategory === 'technical'
                ? 'bg-brand-purple-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-brand-navy-900 hover:bg-slate-50'
            }`}
          >
            DSA & Architecture
          </button>
          <button
            onClick={() => setActiveCategory('experience')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
              activeCategory === 'experience'
                ? 'bg-brand-purple-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-brand-navy-900 hover:bg-slate-50'
            }`}
          >
            Desktop UI & Opacity
          </button>
          <button
            onClick={() => setActiveCategory('security')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
              activeCategory === 'security'
                ? 'bg-brand-purple-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-brand-navy-900 hover:bg-slate-50'
            }`}
          >
            Credits & Privacy
          </button>
        </div>
      </section>

      {/* 3. FEATURE CARDS GRID */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {filteredFeatures.map((feature: FeatureItem) => (
            <Card key={feature.id} className="p-8 space-y-6 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-center shadow-inner">
                    {getIcon(feature.iconName)}
                  </div>
                  {feature.highlight && (
                    <Badge variant="purple" size="sm">
                      {feature.highlight}
                    </Badge>
                  )}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-brand-navy-950">{feature.title}</h3>
                  <div className="text-xs font-semibold text-brand-purple-600 mt-0.5">{feature.tagline}</div>
                </div>
                <p className="text-slate-600 text-sm leading-relaxed">{feature.description}</p>
              </div>

              <div className="pt-5 border-t border-slate-100 space-y-2.5">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Key Capabilities:</div>
                <ul className="space-y-2 text-xs sm:text-sm text-slate-700">
                  {feature.details.map((detail, idx) => (
                    <li key={idx} className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <span>{detail}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* 4. PERFORMANCE DIFFERENTIATOR BANNER */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-gradient-to-r from-brand-navy-900 to-slate-900 rounded-3xl p-8 sm:p-12 text-white shadow-xl border border-slate-800 flex flex-col lg:flex-row items-center justify-between gap-8">
          <div className="space-y-4 max-w-2xl">
            <Badge variant="purple" className="bg-brand-purple-500/20 text-brand-purple-300 border-brand-purple-400/30">
              ⚡ Ultra-Low Latency
            </Badge>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
              Built for Near-Instant AI Responses — as Fast as ~0.2s
            </h2>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              Powered by dedicated Groq hardware gateways, Meoow eliminates standard 3–5 second cloud delays so you can maintain natural conversation during live coding interviews.
            </p>
          </div>
          <div className="flex-shrink-0">
            <Button href="/download" size="lg" variant="primary">
              Try Meoow Free (30 Credits)
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </section>

      {/* 5. FEATURES FAQ */}
      <section id="faq" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <SectionHeading
          badgeText="Features FAQ"
          badgeVariant="purple"
          title="Frequently Asked Questions About Features"
          subtitle="Learn more about real-time voice transcription, screen OCR, and language support."
        />

        <Accordion items={FEATURES_FAQS} />
      </section>

      {/* 6. CTA SECTION */}
      <CtaSection
        title="Ready to Practice Smarter?"
        subtitle="Download Meoow for Windows and get 30 free starting credits immediately."
      />
    </div>
  );
};

