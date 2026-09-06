import React from 'react';
import { SectionHeading } from '../components/ui/SectionHeading';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { Accordion } from '../components/ui/Accordion';
import { ProductVisualMockup } from '../components/ui/ProductVisualMockup';
import { CtaSection } from '../components/ui/CtaSection';
import { DEMO_FAQS } from '../data/faqs';
import { Play } from 'lucide-react';

export const DemoPage: React.FC = () => {
  return (
    <div className="space-y-20 sm:space-y-28 py-12">
      {/* 1. HERO SECTION */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
        <Badge variant="purple" size="md">
          <Play className="w-3 h-3 fill-current" />
          <span>Interactive Demo</span>
        </Badge>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-brand-navy-950 tracking-tight leading-tight">
          Experience Meoow AI in{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-purple-600 to-indigo-500">
            Action
          </span>
        </h1>
        <p className="text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
          Interact with our live product simulation below. Switch between DSA coding challenges, distributed system design questions, and behavioral STAR stories.
        </p>
      </section>

      {/* 2. INTERACTIVE DEMO VISUALIZATION */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <ProductVisualMockup />
        <div className="text-center text-xs text-slate-500">
          💡 Click the tabs inside the simulation above to switch scenarios in real time.
        </div>
      </section>

      {/* 3. SIMULATION SCENARIO EXPLANATION */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-6 sm:p-8 space-y-4">
            <Badge variant="purple">Scenario 1</Badge>
            <h3 className="text-lg font-bold text-brand-navy-950">DSA Algorithmic Problem</h3>
            <p className="text-slate-600 text-sm leading-relaxed">
              When given a sliding window or graph problem, Meoow provides optimal Big-O complexity upfront, edge-case warnings, and clean syntax-highlighted code.
            </p>
          </Card>

          <Card className="p-6 sm:p-8 space-y-4">
            <Badge variant="blue">Scenario 2</Badge>
            <h3 className="text-lg font-bold text-brand-navy-950">System Design Architecture</h3>
            <p className="text-slate-600 text-sm leading-relaxed">
              For complex distributed systems, Meoow generates QPS capacity calculations, caching tier blueprints (Redis/CDN), and database partitioning strategies.
            </p>
          </Card>

          <Card className="p-6 sm:p-8 space-y-4">
            <Badge variant="green">Scenario 3</Badge>
            <h3 className="text-lg font-bold text-brand-navy-950">Behavioral STAR Story</h3>
            <p className="text-slate-600 text-sm leading-relaxed">
              For leadership questions, Meoow frames your real resume achievements into concise, quantifiable Situation, Task, Action, and Result talking points.
            </p>
          </Card>
        </div>
      </section>

      {/* 4. DEMO FAQS */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <SectionHeading
          badgeText="Demo FAQ"
          badgeVariant="purple"
          title="Questions About the Product Demo"
          subtitle="Learn how to test Meoow in your own environment with 30 free signup credits."
        />

        <Accordion items={DEMO_FAQS} />
      </section>

      {/* 5. CTA SECTION */}
      <CtaSection
        title="Ready to Try It Yourself?"
        subtitle="Get 30 free credits upon verified email registration. Test the real desktop client today."
        primaryCtaText="Download Meoow Free"
        primaryCtaHref="/download"
      />
    </div>
  );
};
