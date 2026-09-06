import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MAIN_NAV } from '../../data/navigation';
import { Button } from '../ui/Button';
import { useAuth } from '../../context/AuthContext';
import { Menu, X, ArrowRight, Sparkles, LogOut, Download, Shield } from 'lucide-react';

export const Navbar: React.FC = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const { isAuthenticated, user, logout } = useAuth();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-200 ${
        isScrolled
          ? 'bg-white/95 backdrop-blur-md shadow-sm border-b border-slate-200/80 py-3'
          : 'bg-white/80 backdrop-blur-sm border-b border-transparent py-4'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        {/* Brand Logo */}
        <Link to="/" className="flex items-center gap-2.5 group select-none">
          <img
            src="/logo.png"
            alt="Meoow AI Logo"
            className="w-8 h-8 rounded-lg object-contain shadow-sm group-hover:scale-105 transition-transform"
          />
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-extrabold text-brand-navy-950 tracking-tight">
              MEOOW
            </span>
            <span className="text-xs font-bold text-brand-purple-600 uppercase tracking-wider">
              AI
            </span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center gap-1 xl:gap-2">
          {MAIN_NAV.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'text-brand-purple-600 bg-brand-purple-50 font-semibold'
                    : 'text-slate-600 hover:text-brand-navy-900 hover:bg-slate-100/70'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Desktop Action Buttons */}
        <div className="hidden lg:flex items-center gap-3">
          {isAuthenticated && user ? (
            <div className="flex items-center gap-2.5">
              {user.role === 'admin' && (
                <Link
                  to="/admin"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-100 border border-purple-300 text-xs font-bold text-purple-800 hover:bg-purple-200 transition"
                  title="Admin Dashboard"
                >
                  <Shield className="w-3.5 h-3.5 text-purple-700" />
                  <span>Admin</span>
                </Link>
              )}
              <Link
                to="/credits"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-purple-50 border border-brand-purple-200 text-xs font-bold text-brand-purple-700 hover:bg-brand-purple-100 transition"
              >
                <Sparkles className="w-3.5 h-3.5 text-brand-purple-600" />
                <span>
                  {user.usageMode === 'unlimited' ? 'Unlimited' : `${user.credits} Credits`}
                </span>
              </Link>
              <Button href="/download" variant="primary" size="sm">
                <Download className="w-3.5 h-3.5 mr-1" />
                <span>Download App</span>
              </Button>
              <button
                onClick={() => logout()}
                className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition"
                title="Sign Out"
                aria-label="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <>
              <Button href="/login" variant="ghost" size="sm">
                Log In
              </Button>
              <Button href="/signup" variant="primary" size="sm">
                <span>Get Meoow Free</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </>
          )}
        </div>

        {/* Mobile Hamburger Toggle */}
        <div className="flex lg:hidden items-center gap-2">
          {isAuthenticated ? (
            <Button href="/download" variant="primary" size="sm" className="text-xs px-2.5 py-1">
              App
            </Button>
          ) : (
            <Button href="/signup" variant="primary" size="sm" className="text-xs px-3 py-1.5">
              Get Free
            </Button>
          )}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-300"
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Dropdown Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-white border-b border-slate-200 shadow-xl px-4 pt-3 pb-6 space-y-3 animate-fadeIn">
          <nav className="flex flex-col space-y-1">
            {MAIN_NAV.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={`px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    isActive
                      ? 'text-brand-purple-600 bg-brand-purple-50 font-semibold'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
            {isAuthenticated && user ? (
              <>
                <div className="p-3 rounded-xl bg-brand-purple-50 border border-brand-purple-200/80 flex items-center justify-between text-xs font-bold text-brand-navy-950">
                  <span>Signed in as {user.email}</span>
                  <span className="text-brand-purple-600">
                    {user.usageMode === 'unlimited' ? 'Unlimited' : `${user.credits} Credits`}
                  </span>
                </div>
                {user.role === 'admin' && (
                  <Link
                    to="/admin"
                    className="p-2.5 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-between text-xs font-bold text-purple-800 hover:bg-purple-100 transition"
                  >
                    <span className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-purple-700" />
                      <span>Admin Dashboard</span>
                    </span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                )}
                <Button href="/download" variant="primary" size="md" className="w-full justify-center">
                  <Download className="w-4 h-4 mr-1.5" />
                  Download Windows Client
                </Button>
                <Button
                  onClick={() => logout()}
                  variant="outline"
                  size="md"
                  className="w-full justify-center text-rose-600 border-rose-200"
                >
                  <LogOut className="w-4 h-4 mr-1.5" />
                  Sign Out
                </Button>
              </>
            ) : (
              <>
                <Button href="/login" variant="secondary" size="md" className="w-full justify-center">
                  Log In
                </Button>
                <Button href="/signup" variant="primary" size="md" className="w-full justify-center">
                  <span>Get Started (30 Free Credits)</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
