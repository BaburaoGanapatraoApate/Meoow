import React from 'react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Home, Compass } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="py-24 px-4 sm:px-6 lg:px-8 max-w-xl mx-auto text-center space-y-6">
      <Badge variant="purple" size="md">
        404 Page Not Found
      </Badge>

      <h1 className="text-4xl sm:text-5xl font-extrabold text-brand-navy-950 tracking-tight">
        Looks Like This Page Took the{' '}
        <span className="text-brand-purple-600">Wrong Question</span>
      </h1>

      <p className="text-base text-slate-600 leading-relaxed">
        The page you are looking for might have been moved, renamed, or is temporarily unavailable. Let's get you back on track for your interview prep.
      </p>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
        <Button href="/" variant="primary" size="lg">
          <Home className="w-4 h-4 mr-2" />
          <span>Back to Homepage</span>
        </Button>
        <Button href="/features" variant="secondary" size="lg">
          <Compass className="w-4 h-4 mr-2" />
          <span>Explore Features</span>
        </Button>
      </div>
    </div>
  );
};
