import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { Accordion } from '../components/ui/Accordion';
import { SectionHeading } from '../components/ui/SectionHeading';
import { TestimonialRail } from '../components/ui/TestimonialRail';
import { TwoPcAnnotatedVisual } from '../components/ui/TwoPcAnnotatedVisual';
import { CtaSection } from '../components/ui/CtaSection';
import { FEATURES } from '../data/features';
import { WORKFLOW_STEPS } from '../data/howItWorks';
import { HOME_FAQS } from '../data/faqs';
import { BLOG_POSTS } from '../data/blogPosts';
import {
  Sparkles,
  ArrowRight,
  Zap,
  ShieldCheck,
  Code2,
  Cpu,
  Compass,
  Gift,
  Check,
} from 'lucide-react';

export const HomePage: React.FC = () => {
  const featuredPosts = BLOG_POSTS.slice(0, 3);
  const coreFeatures = FEATURES.slice(0, 6);

  return (
    <div className="space-y-20 sm:space-y-32 pb-16">
      {/* 1. HERO SECTION */}
      <section className="relative pt-8 sm:pt-16 pb-12 overflow-hidden">
        {/* Subtle Background Glows */}
        <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-brand-purple-500/10 rounded-full blur-3xl -z-10" />
        <div className="pointer-events-none absolute top-60 right-10 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl -z-10" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          {/* Hero Copy */}
          <div className="text-center max-w-3xl mx-auto space-y-6">
            <div className="flex justify-center">
              <Badge variant="purple" size="md">
                <Sparkles className="w-3.5 h-3.5" />
                <span>AI Interview Copilot</span>
              </Badge>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-brand-navy-950 tracking-tight leading-[1.1]">
              Interview smarter.{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-purple-600 via-brand-purple-500 to-indigo-500">
                Answer with confidence.
              </span>
            </h1>

            <p className="text-lg sm:text-xl text-slate-600 leading-relaxed max-w-2xl mx-auto">
              Meoow helps software engineers prepare for and navigate technical interviews with real-time voice transcription, instant screen capture, and sub-second AI answers in a discreet desktop overlay.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
              <Button href="/download" size="lg" variant="primary" className="w-full sm:w-auto shadow-md shadow-brand-purple-500/20">
                <span>Get Meoow Free</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
              <Button href="/how-it-works" size="lg" variant="secondary" className="w-full sm:w-auto">
                See How It Works
              </Button>
            </div>

            {/* Micro Trust Indicators */}
            <div className="flex flex-wrap items-center justify-center gap-5 sm:gap-8 pt-4 text-xs font-medium text-slate-500">
              <span className="flex items-center gap-1.5">
                <Gift className="w-4 h-4 text-brand-purple-600" />
                30 Free Signup Credits
              </span>
              <span className="flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-brand-purple-500" />
                Answers as fast as ~0.2s
              </span>
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                No Forced Subscriptions
              </span>
            </div>
          </div>

          {/* Hero Product Visual Showcase */}
          <div className="pt-6 max-w-6xl mx-auto">
            <TwoPcAnnotatedVisual />
          </div>
        </div>
      </section>

      {/* 2. TRUST & PERFORMANCE STRIP */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-sm p-6 sm:p-8">
          <div className="text-center max-w-2xl mx-auto mb-8">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Built For Candidates Who Want Less Guesswork and More Confidence
            </h3>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 text-center divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
            <div className="space-y-1">
              <div className="text-3xl sm:text-4xl font-extrabold text-brand-purple-600">~0.2s</div>
              <div className="text-xs sm:text-sm font-semibold text-brand-navy-900">Fast Answer Path</div>
              <div className="text-[11px] text-slate-500">on supported workflows</div>
            </div>
            <div className="space-y-1 pt-4 sm:pt-0">
              <div className="text-3xl sm:text-4xl font-extrabold text-brand-navy-900">30</div>
              <div className="text-xs sm:text-sm font-semibold text-brand-navy-900">Free Starting Credits</div>
              <div className="text-[11px] text-slate-500">upon email verification</div>
            </div>
            <div className="space-y-1 pt-4 sm:pt-0">
              <div className="text-3xl sm:text-4xl font-extrabold text-brand-navy-900">₹100</div>
              <div className="text-xs sm:text-sm font-semibold text-brand-navy-900">40 Credits Pack</div>
              <div className="text-[11px] text-slate-500">1 credit = 1 generated answer</div>
            </div>
            <div className="space-y-1 pt-4 sm:pt-0">
              <div className="text-3xl sm:text-4xl font-extrabold text-emerald-600">Windows</div>
              <div className="text-xs sm:text-sm font-semibold text-brand-navy-900">Native Desktop Client</div>
              <div className="text-[11px] text-slate-500">Windows 10 / 11 (64-bit)</div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. WHY MEOOW (6 PILLARS) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <SectionHeading
          badgeText="Why Meoow AI"
          badgeVariant="purple"
          title="Engineered from the ground up for technical interview success"
          subtitle="Everything you need to master live coding, algorithmic design, and behavioral evaluations without high-stress mental blockages."
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="p-6 sm:p-8 space-y-4">
            <div className="w-12 h-12 rounded-xl bg-brand-purple-50 text-brand-purple-600 flex items-center justify-center font-bold text-lg border border-brand-purple-200/50">
              01
            </div>
            <h3 className="text-xl font-bold text-brand-navy-900">Real-Time Voice Context</h3>
            <p className="text-slate-600 text-sm leading-relaxed">
              Deepgram Nova-3 voice engine separates interviewer audio from your own speech, transcribing technical questions live with millisecond accuracy.
            </p>
          </Card>

          <Card className="p-6 sm:p-8 space-y-4">
            <div className="w-12 h-12 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold text-lg border border-sky-200/50">
              02
            </div>
            <h3 className="text-xl font-bold text-brand-navy-900">Sub-Second AI Answers</h3>
            <p className="text-slate-600 text-sm leading-relaxed">
              Our ultra-low latency Groq pipeline delivers code solutions, hints, and complexity analysis in as little as ~0.2s without awkward silence.
            </p>
          </Card>

          <Card className="p-6 sm:p-8 space-y-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-lg border border-emerald-200/50">
              03
            </div>
            <h3 className="text-xl font-bold text-brand-navy-900">Instant Screen Capture</h3>
            <p className="text-slate-600 text-sm leading-relaxed">
              Hit <code className="bg-slate-100 text-brand-navy-900 px-1.5 py-0.5 rounded text-xs font-mono font-bold">Ctrl+Shift+A</code> to crop LeetCode challenges, IDE code snippets, or system diagrams for instant OCR parsing.
            </p>
          </Card>

          <Card className="p-6 sm:p-8 space-y-4">
            <div className="w-12 h-12 rounded-xl bg-brand-purple-50 text-brand-purple-600 flex items-center justify-center font-bold text-lg border border-brand-purple-200/50">
              04
            </div>
            <h3 className="text-xl font-bold text-brand-navy-900">DSA & System Design Blueprints</h3>
            <p className="text-slate-600 text-sm leading-relaxed">
              Get optimal Big-O complexity breakdowns, edge-case alerts, and distributed architecture blueprints tailored for real-world interviews.
            </p>
          </Card>

          <Card className="p-6 sm:p-8 space-y-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-lg border border-amber-200/50">
              05
            </div>
            <h3 className="text-xl font-bold text-brand-navy-900">Fair & Student-Friendly Pricing</h3>
            <p className="text-slate-600 text-sm leading-relaxed">
              No expensive $50/month recurring bills. Start free with 30 credits, then get 40 credits for just ₹100 whenever you need more.
            </p>
          </Card>

          <Card className="p-6 sm:p-8 space-y-4">
            <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-lg border border-slate-200">
              06
            </div>
            <h3 className="text-xl font-bold text-brand-navy-900">Privacy-First Architecture</h3>
            <p className="text-slate-600 text-sm leading-relaxed">
              Audio is streamed in-memory with zero persistent voice recordings. All credentials and sessions are protected by AES-256 encrypted gateways.
            </p>
          </Card>
        </div>
      </section>

      {/* 4. CORE FEATURES SHOWCASE */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <SectionHeading
          badgeText="Product Features"
          badgeVariant="blue"
          title="Everything you need in a single desktop companion"
          subtitle="Explore the powerful toolset designed to give you an unfair advantage in technical interviews."
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {coreFeatures.map((feat) => (
            <Card key={feat.id} className="p-6 sm:p-8 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-brand-purple-50 text-brand-purple-700 border border-brand-purple-200/50">
                    {feat.highlight}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-brand-navy-900">{feat.title}</h3>
                <p className="text-slate-600 text-sm leading-relaxed">{feat.description}</p>
              </div>

              <ul className="space-y-2 pt-4 border-t border-slate-100 text-xs text-slate-600">
                {feat.details.map((detail, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <span>{detail}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>

        <div className="text-center pt-4">
          <Button href="/features" variant="outline" size="md">
            View All Features & Capabilities
            <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </section>

      {/* 5. HOW IT WORKS (6 STEPS) */}
      <section className="bg-slate-50 border-y border-slate-200/80 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <SectionHeading
            badgeText="Workflow"
            badgeVariant="purple"
            title="How Meoow Works in 6 Simple Steps"
            subtitle="From downloading the desktop client to getting sub-second AI assistance during mock practice."
          />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {WORKFLOW_STEPS.map((step) => (
              <div
                key={step.stepNumber}
                className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-4 relative"
              >
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-black text-brand-purple-600 font-mono">
                    {step.stepNumber}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-brand-navy-900">{step.title}</h3>
                <p className="text-slate-600 text-sm leading-relaxed">{step.details}</p>
                {step.tip && (
                  <div className="text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-slate-500">
                    💡 <strong className="text-slate-700">Tip:</strong> {step.tip}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="text-center pt-4">
            <Button href="/how-it-works" variant="primary" size="md">
              Learn More About the Workflow
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </section>

      {/* 6. INTERVIEW WORKFLOWS (DSA, SYSTEM DESIGN, BEHAVIORAL) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <SectionHeading
          badgeText="Comprehensive Coverage"
          badgeVariant="navy"
          title="Master Every Phase of the Technical Interview Loop"
          subtitle="Tailored copilot modes designed specifically for coding, architecture, and leadership rounds."
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* DSA Card */}
          <Card className="p-8 space-y-5 border-t-4 border-t-brand-purple-600">
            <div className="w-12 h-12 rounded-xl bg-brand-purple-50 text-brand-purple-600 flex items-center justify-center">
              <Code2 className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-brand-navy-900">Coding & DSA Interviews</h3>
            <p className="text-slate-600 text-sm leading-relaxed">
              Instant pattern matching (Sliding Window, Two Pointers, Dynamic Programming), edge-case identification, and optimal time/space complexity analysis.
            </p>
            <ul className="space-y-2 text-xs text-slate-600 pt-2 border-t border-slate-100">
              <li className="flex items-center gap-2">✓ Python, Java, C++, TypeScript, Go</li>
              <li className="flex items-center gap-2">✓ Big-O time and space complexity breakdown</li>
              <li className="flex items-center gap-2">✓ Single-key screen capture (Ctrl+Shift+A)</li>
            </ul>
          </Card>

          {/* System Design Card */}
          <Card className="p-8 space-y-5 border-t-4 border-t-sky-500">
            <div className="w-12 h-12 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
              <Cpu className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-brand-navy-900">System Design Architecture</h3>
            <p className="text-slate-600 text-sm leading-relaxed">
              Structure complex distributed system questions with QPS calculations, database trade-offs (SQL vs. NoSQL), caching tiers (Redis), and horizontal sharding.
            </p>
            <ul className="space-y-2 text-xs text-slate-600 pt-2 border-t border-slate-100">
              <li className="flex items-center gap-2">✓ Back-of-the-envelope capacity estimations</li>
              <li className="flex items-center gap-2">✓ CAP theorem & disaster recovery strategies</li>
              <li className="flex items-center gap-2">✓ API contracts & data schema blueprints</li>
            </ul>
          </Card>

          {/* Behavioral Card */}
          <Card className="p-8 space-y-5 border-t-4 border-t-emerald-500">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Compass className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-brand-navy-900">Behavioral STAR Coaching</h3>
            <p className="text-slate-600 text-sm leading-relaxed">
              Upload your resume during session setup to contextualize leadership and situational questions into structured Situation, Task, Action, and Result stories.
            </p>
            <ul className="space-y-2 text-xs text-slate-600 pt-2 border-t border-slate-100">
              <li className="flex items-center gap-2">✓ Resume-aware personal story mapping</li>
              <li className="flex items-center gap-2">✓ Quantifiable metrics & outcome framing</li>
              <li className="flex items-center gap-2">✓ Concise talking points avoiding rambling</li>
            </ul>
          </Card>
        </div>
      </section>

      {/* 7. STUDENT & CANDIDATE TESTIMONIALS (DUAL MARQUEE) */}
      <section className="space-y-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            badgeText="Candidate Perspectives"
            badgeVariant="purple"
            title="How Candidates Leverage Meoow for Interview Practice"
            subtitle="Representative workflows of how software engineers and students practice DSA, system design, and behavioral interviews."
          />
        </div>

        <TestimonialRail />
      </section>

      {/* 8. CREDITS & PRICING PREVIEW */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <SectionHeading
          badgeText="Fair Credits Model"
          badgeVariant="purple"
          title="Start Free. Pay Only When You Need More."
          subtitle="No expensive monthly subscription traps. Enjoy 30 free credits on registration, and top up 40 credits for just ₹100 whenever you need them."
        />

        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Free Starter Card */}
          <Card className="p-8 space-y-6 border-2 border-brand-purple-500 relative overflow-hidden bg-gradient-to-b from-white to-purple-50/20">
            <div className="flex items-center justify-between">
              <Badge variant="purple">Free Starter</Badge>
              <span className="text-xs font-semibold text-brand-purple-600">No Credit Card Needed</span>
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-extrabold text-brand-navy-950">30 Credits</span>
                <span className="text-slate-500 font-semibold">Free</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">Credited immediately upon email OTP verification</p>
            </div>
            <ul className="space-y-3 text-sm text-slate-700">
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>30 generated AI answers (1 credit = 1 answer)</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>Real-time voice transcription via Deepgram</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>Single-key screen capture (Ctrl+Shift+A)</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>Credits never expire</span>
              </li>
            </ul>
            <Button href="/download" variant="primary" size="lg" className="w-full justify-center">
              Claim 30 Free Credits
            </Button>
          </Card>

          {/* Paid Top-Up Card */}
          <Card className="p-8 space-y-6 border border-slate-200 bg-white">
            <div className="flex items-center justify-between">
              <Badge variant="navy">Top-Up Pack</Badge>
              <span className="text-xs font-semibold text-slate-500">Pay As You Go</span>
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-extrabold text-brand-navy-950">₹100</span>
                <span className="text-slate-500 font-semibold">/ 40 Credits</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">₹2.50 per generated AI answer (One-time payment)</p>
            </div>
            <ul className="space-y-3 text-sm text-slate-700">
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>40 additional AI answers</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>No recurring subscription or auto-renewals</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>Instant activation via Razorpay (UPI, Cards)</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>Credits accumulate and never expire</span>
              </li>
            </ul>
            <Button href="/credits" variant="secondary" size="lg" className="w-full justify-center">
              View Credits & Pricing
            </Button>
          </Card>
        </div>
      </section>

      {/* 9. BLOG & KNOWLEDGE BASE PREVIEW */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <SectionHeading
          badgeText="Knowledge Base"
          badgeVariant="blue"
          title="Master Technical Interviewing with Our In-Depth Guides"
          subtitle="Read expert guides on algorithmic patterns, system design frameworks, and behavioral coaching."
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {featuredPosts.map((post) => (
            <Card key={post.slug} className="p-6 sm:p-8 flex flex-col justify-between space-y-4 group">
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-semibold text-brand-purple-600 bg-brand-purple-50 px-2 py-0.5 rounded">
                    {post.category}
                  </span>
                  <span>{post.readTime}</span>
                </div>
                <h3 className="text-lg font-bold text-brand-navy-900 group-hover:text-brand-purple-600 transition-colors leading-snug">
                  <Link to={`/blog/${post.slug}`}>{post.title}</Link>
                </h3>
                <p className="text-slate-600 text-xs sm:text-sm leading-relaxed line-clamp-3">
                  {post.excerpt}
                </p>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-brand-purple-600">
                <Link to={`/blog/${post.slug}`} className="inline-flex items-center gap-1 group-hover:underline">
                  Read Article
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
                <span className="text-slate-400 font-normal">{post.date}</span>
              </div>
            </Card>
          ))}
        </div>

        <div className="text-center pt-4">
          <Button href="/blog" variant="outline" size="md">
            Explore All 10 Articles in Blog
            <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </section>

      {/* 10. HOMEPAGE FAQ SECTION */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <SectionHeading
          badgeText="FAQ"
          badgeVariant="purple"
          title="Frequently Asked Questions"
          subtitle="Everything you need to know about Meoow AI, starting free, credit usage, and privacy."
        />

        <Accordion items={HOME_FAQS} />
      </section>

      {/* 11. FINAL CTA SECTION */}
      <CtaSection />
    </div>
  );
};
