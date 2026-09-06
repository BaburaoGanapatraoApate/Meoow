import React from 'react';
import { Link } from 'react-router-dom';
import { FOOTER_NAV } from '../../data/navigation';
import { CANONICAL_DOMAIN, SUPPORT_EMAIL } from '../../utils/constants';
import { Shield } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-slate-900 text-slate-300 border-t border-slate-800 pt-16 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 pb-12 border-b border-slate-800">
          {/* Brand Info */}
          <div className="lg:col-span-2 space-y-4">
            <Link to="/" className="flex items-center gap-2.5 group">
              <img src="/logo.png" alt="Meoow Logo" className="w-8 h-8 rounded-lg object-contain" />
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-extrabold text-white tracking-tight">MEOOW</span>
                <span className="text-xs font-bold text-brand-purple-400 uppercase tracking-wider">AI</span>
              </div>
            </Link>
            <p className="text-sm text-slate-400 max-w-sm leading-relaxed">
              Real-time AI interview copilot and technical preparation assistant. Fast voice transcription, instant screen capture, and sub-second coding guidance.
            </p>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span>Official Domain: <a href={CANONICAL_DOMAIN} className="text-slate-300 font-mono hover:text-brand-purple-400">{CANONICAL_DOMAIN}</a></span>
            </div>
            <div className="text-xs text-slate-400">
              Support: <a href={`mailto:${SUPPORT_EMAIL}`} className="text-brand-purple-400 hover:underline">{SUPPORT_EMAIL}</a>
            </div>
          </div>

          {/* Column 1: Product */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">Product</h3>
            <ul className="space-y-2 text-sm">
              {FOOTER_NAV.product.map((link) => (
                <li key={link.href}>
                  <Link to={link.href} className="hover:text-white transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 2: Resources & Company */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">Resources</h3>
            <ul className="space-y-2 text-sm">
              {FOOTER_NAV.resources.map((link) => (
                <li key={link.href}>
                  <Link to={link.href} className="hover:text-white transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3: Company & Legal */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">Legal & Company</h3>
            <ul className="space-y-2 text-sm">
              {FOOTER_NAV.company.map((link) => (
                <li key={link.href}>
                  <Link to={link.href} className="hover:text-white transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
              {FOOTER_NAV.legal.map((link) => (
                <li key={link.href}>
                  <Link to={link.href} className="hover:text-white transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Responsible Use Notice & Copyright */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <span>Meoow AI is built for interview preparation, mock simulations, and skill development. Use responsibly.</span>
          </div>
          <div>
            © {new Date().getFullYear()} Meoow AI. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  );
};
