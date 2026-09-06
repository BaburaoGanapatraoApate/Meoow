import React, { useState } from 'react';
import { SectionHeading } from '../components/ui/SectionHeading';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Accordion } from '../components/ui/Accordion';
import { CtaSection } from '../components/ui/CtaSection';
import { SUPPORT_FAQS } from '../data/faqs';
import { SUPPORT_EMAIL } from '../utils/constants';
import {
  HelpCircle,
  Mail,
  Search,
  Download,
  Key,
  CreditCard,
  Mic,
  Scan,
  Zap,
  Bug,
  ArrowRight,
} from 'lucide-react';

export const SupportPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');

  const supportCategories = [
    {
      title: 'Installation & Setup',
      icon: <Download className="w-5 h-5 text-brand-purple-600" />,
      desc: 'Windows 10/11 installation, permissions, and app startup issues.',
    },
    {
      title: 'Login & OTP Email',
      icon: <Key className="w-5 h-5 text-sky-500" />,
      desc: '6-digit OTP codes, email delivery, and account verification.',
    },
    {
      title: 'Credits & Payments',
      icon: <CreditCard className="w-5 h-5 text-emerald-500" />,
      desc: '30 free signup credits, Razorpay packages, and balance queries.',
    },
    {
      title: 'Voice & Transcription',
      icon: <Mic className="w-5 h-5 text-purple-500" />,
      desc: 'Microphone permissions, loopback audio, and Deepgram voice sync.',
    },
    {
      title: 'Screen Capture & OCR',
      icon: <Scan className="w-5 h-5 text-amber-500" />,
      desc: 'Ctrl+Shift+A shortcuts, multi-monitor setups, and crop accuracy.',
    },
    {
      title: 'AI Answer Pipeline',
      icon: <Zap className="w-5 h-5 text-blue-500" />,
      desc: 'Sub-second Groq latency, code syntax blocks, and language models.',
    },
    {
      title: 'Bug Reports & Feedback',
      icon: <Bug className="w-5 h-5 text-rose-500" />,
      desc: 'Report unexpected behavior or suggest new features to our engineers.',
    },
    {
      title: 'General Inquiries',
      icon: <HelpCircle className="w-5 h-5 text-slate-600" />,
      desc: 'Educational partnerships, student inquiries, and technical questions.',
    },
  ];

  return (
    <div className="space-y-20 sm:space-y-28 py-12">
      {/* 1. HERO SECTION */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
        <Badge variant="purple" size="md">
          <HelpCircle className="w-3.5 h-3.5" />
          <span>Help & Support Center</span>
        </Badge>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-brand-navy-950 tracking-tight leading-tight">
          How Can We{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-purple-600 to-indigo-500">
            Help You?
          </span>
        </h1>
        <p className="text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
          Find quick solutions for installation, account verification, credits, and live audio transcription.
        </p>

        {/* Search Box */}
        <div className="max-w-xl mx-auto relative pt-2">
          <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search help articles (e.g. OTP email, credits, microphone)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-slate-200 bg-white text-sm text-brand-navy-900 focus:outline-none focus:ring-2 focus:ring-brand-purple-400 shadow-md"
          />
        </div>
      </section>

      {/* 2. SUPPORT TOPICS GRID */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {supportCategories.map((cat, idx) => (
            <Card key={idx} className="p-6 space-y-3 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center">
                  {cat.icon}
                </div>
                <h3 className="text-base font-bold text-brand-navy-950">{cat.title}</h3>
                <p className="text-xs text-slate-600 leading-relaxed">{cat.desc}</p>
              </div>
              <a
                href={`mailto:${SUPPORT_EMAIL}?subject=Support Inquiry: ${encodeURIComponent(cat.title)}`}
                className="text-xs font-semibold text-brand-purple-600 hover:text-brand-purple-700 pt-2 border-t border-slate-100 flex items-center justify-between"
              >
                <span>Contact Team</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </Card>
          ))}
        </div>
      </section>

      {/* 3. DIRECT CONTACT BOX */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <Card className="p-8 sm:p-10 bg-slate-900 text-white border-slate-800 space-y-6">
          <div className="flex items-center gap-2 text-brand-purple-400 font-bold text-xs uppercase tracking-wider">
            <Mail className="w-4 h-4" />
            <span>Dedicated Support Team</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white">
            Need Direct Technical Assistance?
          </h2>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            Our engineering team is always ready to assist you with account issues, payment fulfillment, or bug reports. Drop us an email and we will respond promptly.
          </p>
          <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <Button
              href={`mailto:${SUPPORT_EMAIL}`}
              variant="primary"
              size="lg"
            >
              <Mail className="w-4 h-4 mr-2" />
              <span>Email {SUPPORT_EMAIL}</span>
            </Button>
            <span className="text-xs text-slate-400">Average response time: &lt; 24 hours</span>
          </div>
        </Card>
      </section>

      {/* 4. SUPPORT FAQS */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <SectionHeading
          badgeText="FAQ"
          badgeVariant="purple"
          title="Common Support Questions"
          subtitle="Quick answers to frequently asked technical and account questions."
        />

        <Accordion items={SUPPORT_FAQS} />
      </section>

      {/* 5. CTA SECTION */}
      <CtaSection />
    </div>
  );
};
