import React from 'react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { SUPPORT_EMAIL, CANONICAL_DOMAIN } from '../utils/constants';
import { FileText } from 'lucide-react';

export const TermsPage: React.FC = () => {
  return (
    <div className="py-12 space-y-12">
      {/* 1. HEADER */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4 text-center">
        <Badge variant="navy" size="md">
          <FileText className="w-3.5 h-3.5" />
          <span>Legal Terms</span>
        </Badge>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-brand-navy-950 tracking-tight">
          Terms of Use
        </h1>
        <p className="text-sm text-slate-500">
          Last Updated: September 2026 • Official Domain: <a href={CANONICAL_DOMAIN} className="text-brand-purple-600 font-mono">{CANONICAL_DOMAIN}</a>
        </p>
      </section>

      {/* 2. TERMS CONTENT */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <Card className="p-8 sm:p-12 space-y-8 bg-white border-slate-200/80 shadow-sm text-slate-700 leading-relaxed text-sm sm:text-base">
          <div>
            <h2 className="text-xl font-bold text-brand-navy-950 mb-3">1. Agreement to Terms</h2>
            <p>
              By accessing or using the Meoow AI desktop application, website (<a href={CANONICAL_DOMAIN} className="text-brand-purple-600 font-mono">{CANONICAL_DOMAIN}</a>), or associated backend services, you agree to be bound by these Terms of Use. If you do not agree to these Terms, do not install or use our software.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-brand-navy-950 mb-3">2. Purpose & Responsible Use</h2>
            <p className="mb-3">
              Meoow AI is built as an educational interview preparation companion, mock simulation tool, and skill development assistant.
            </p>
            <ul className="space-y-2 list-disc pl-5">
              <li>You agree to use Meoow in compliance with all applicable local, state, and international laws, regulations, and third-party platform terms.</li>
              <li>You are solely responsible for ensuring your use of interview preparation tools complies with any non-disclosure agreements (NDAs) or employment evaluation guidelines applicable to you.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-bold text-brand-navy-950 mb-3">3. Accounts & Security</h2>
            <p>
              You must provide accurate and complete registration information. You are responsible for maintaining the confidentiality of your account credentials and one-time password (OTP) codes. You agree to notify us immediately of any unauthorized use of your account.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-brand-navy-950 mb-3">4. Credit Model & Payments</h2>
            <ul className="space-y-2 list-disc pl-5">
              <li><strong>Signup Allowance:</strong> Verified accounts receive 30 complimentary bonus credits upon email verification.</li>
              <li><strong>Deduction Rule:</strong> Exactly 1 credit is deducted per successfully generated AI answer. Screen capture previews, transcript streams, and window controls do not consume credits.</li>
              <li><strong>Top-Ups:</strong> You may purchase 40 credits for ₹100 via our payment gateway (Razorpay). There are no recurring monthly subscription plans.</li>
              <li><strong>Expiration:</strong> Purchased and promotional credits do not expire as long as your account remains active.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-bold text-brand-navy-950 mb-3">5. Intellectual Property</h2>
            <p>
              All software, code, logos, designs, documentation, and assets related to Meoow AI are the exclusive intellectual property of Meoow AI. You are granted a limited, non-exclusive, non-transferable license to use the desktop client for personal, non-commercial interview preparation.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-brand-navy-950 mb-3">6. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by applicable law, Meoow AI and its operators shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits, employment opportunities, or data resulting from your use of the service.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-brand-navy-950 mb-3">7. Contact Information</h2>
            <p>
              For legal inquiries or questions regarding these Terms, contact us at <a href={`mailto:${SUPPORT_EMAIL}`} className="text-brand-purple-600 font-semibold">{SUPPORT_EMAIL}</a>.
            </p>
          </div>
        </Card>
      </section>
    </div>
  );
};

