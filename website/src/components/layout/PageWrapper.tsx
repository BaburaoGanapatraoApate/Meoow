import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { SeoHead } from '../seo/SeoHead';

export interface PageWrapperProps {
  children: React.ReactNode;
}

export const PageWrapper: React.FC<PageWrapperProps> = ({ children }) => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="min-h-screen flex flex-col bg-brand-surface-subtle text-brand-navy-900 selection:bg-brand-purple-100 selection:text-brand-purple-900">
      <SeoHead />
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
};
