import React from 'react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { SUPPORT_EMAIL, CANONICAL_DOMAIN } from '../utils/constants';
import { Lock } from 'lucide-react';

export const PrivacyPage: React.FC = () => {
  return (
    <div className="py-12 space-y-12">
      {/* 1. HEADER */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4 text-center">
        <Badge variant="navy" size="md">
          <Lock className="w-3.5 h-3.5" />
          <span>Legal & Trust</span>
        </Badge>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-brand-navy-950 tracking-tight">
          Privacy Policy
        </h1>
        <p className="text-sm text-slate-500">
          Last Updated: September 2026 • Official Domain: <a href={CANONICAL_DOMAIN} className="text-brand-purple-600 font-mono">{CANONICAL_DOMAIN}</a>
        </p>
      </section>

      {/* 2. POLICY CONTENT */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <Card className="p-8 sm:p-12 space-y-8 bg-white border-slate-200/80 shadow-sm text-slate-700 leading-relaxed text-sm sm:text-base">
          <div>
            <h2 className="text-xl font-bold text-brand-navy-950 mb-3">1. Introduction</h2>
            <p>
              Meoow AI ("Meoow", "we", "us", or "our") respects your privacy. This Privacy Policy describes how we collect, process, store, and protect your information when you use our Windows desktop application, website (<a href={CANONICAL_DOMAIN} className="text-brand-purple-600 font-mono">{CANONICAL_DOMAIN}</a>), and related backend services.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-brand-navy-950 mb-3">2. Real Public Architecture & Data Processing</h2>
            <p className="mb-3">
              Meoow operates as a client-server platform designed with data minimization principles:
            </p>
            <ul className="space-y-2 list-disc pl-5">
              <li><strong>Electron Desktop Client:</strong> Runs locally on your machine, managing overlay opacity, global hotkeys, and local audio capture.</li>
              <li><strong>Secure Meoow Backend:</strong> Serves as the authentication and API gateway. No client communicates directly with raw provider APIs.</li>
              <li><strong>Neon PostgreSQL:</strong> Encrypted relational database storing user accounts, hashed passwords (Bcrypt), and credit transaction ledgers.</li>
              <li><strong>Deepgram Gateway:</strong> Processes incoming audio streams in real time for live speech-to-text diarization. <em>Audio buffers are processed in-memory and are never permanently stored on our servers.</em></li>
              <li><strong>Groq Gateway:</strong> Processes coding problem prompts, screen OCR text, and resume context to generate sub-second (~0.2s) answers.</li>
              <li><strong>Brevo (Sendinblue):</strong> Sends transactional 6-digit OTP verification emails.</li>
              <li><strong>Razorpay:</strong> Handles secure payment processing for credit packs. Meoow does not store sensitive credit/debit card numbers.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-bold text-brand-navy-950 mb-3">3. Information We Collect</h2>
            <ul className="space-y-2 list-disc pl-5">
              <li><strong>Account Information:</strong> Your name, email address, password hash, and verification status.</li>
              <li><strong>Session Context (Optional):</strong> Resume text, target job role, and preferred programming languages uploaded during interview configuration.</li>
              <li><strong>Usage & Ledger Data:</strong> Credit balance, transaction logs (signup bonus, purchases, deductions), and timestamp records.</li>
              <li><strong>Telemetry & Diagnostics:</strong> Client application error logs and crash reports for software stability.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-bold text-brand-navy-950 mb-3">4. Audio & Screen Capture Privacy</h2>
            <p className="mb-2">
              We understand the sensitive nature of live interview conversations:
            </p>
            <ul className="space-y-2 list-disc pl-5">
              <li><strong>Zero Audio Storage:</strong> Audio streams sent through the Deepgram gateway are ephemeral. We do not retain audio recordings.</li>
              <li><strong>Single-Key Screen Capture:</strong> Screen captures are triggered only when you explicitly press <code className="bg-slate-100 text-brand-navy-900 px-1 py-0.5 rounded font-mono text-xs">Ctrl+Shift+A</code>. No continuous passive screen recording occurs.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-bold text-brand-navy-950 mb-3">5. Data Security & Encryption</h2>
            <p>
              We implement industry-standard administrative, technical, and physical security measures. All communications between the desktop client, backend gateway, and third-party APIs use TLS 1.3 encryption. Internal credentials and sensitive settings are secured with AES-256-GCM authenticated encryption at rest.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-brand-navy-950 mb-3">6. User Rights & Data Deletion</h2>
            <p>
              You have the right to request access to, export, or permanent deletion of your account data. To submit a data deletion request, email our team at <a href={`mailto:${SUPPORT_EMAIL}`} className="text-brand-purple-600 font-semibold">{SUPPORT_EMAIL}</a>.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-brand-navy-950 mb-3">7. Contact Us</h2>
            <p>
              If you have any questions or concerns regarding this Privacy Policy, please reach out to us at <a href={`mailto:${SUPPORT_EMAIL}`} className="text-brand-purple-600 font-semibold">{SUPPORT_EMAIL}</a>.
            </p>
          </div>
        </Card>
      </section>
    </div>
  );
};
