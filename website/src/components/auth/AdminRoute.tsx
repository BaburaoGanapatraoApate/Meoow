import React from 'react';
import { Navigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ShieldAlert, ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '../ui/Button';

interface AdminRouteProps {
  children: React.ReactNode;
}

export const AdminRoute: React.FC<AdminRouteProps> = ({ children }) => {
  const { isLoading, isAuthenticated, user } = useAuth();
  const location = useLocation();

  // 1. Loading state: wait until authentication check is complete
  if (isLoading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <Loader2 className="w-10 h-10 animate-spin text-brand-purple-600" />
          <p className="text-sm font-medium text-slate-500">Verifying administrative access...</p>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated: redirect to login with return redirect parameter
  if (!isAuthenticated || !user) {
    const redirectParam = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?redirect=${redirectParam}`} replace />;
  }

  // 3. Authenticated but non-admin role: 403 Forbidden view
  if (user.role !== 'admin') {
    return (
      <div className="min-h-[75vh] flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200/80 shadow-xl p-6 sm:p-8 text-center animate-fadeIn">
          <div className="w-16 h-16 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-center mx-auto mb-5 text-rose-600">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <h1 className="text-2xl font-extrabold text-brand-navy-950 mb-2">
            Admin Access Required
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed mb-6">
            Your account (<span className="font-semibold text-brand-navy-900">{user.email}</span>) does not have administrative privileges to view this portal.
          </p>

          <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-3.5 mb-6 text-xs text-slate-500 text-left">
            <p className="font-semibold text-slate-700 mb-1">Security Notice:</p>
            <p>Access attempts to administrative endpoints are monitored and audited by the server authorization layer.</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button href="/" variant="primary" size="md" className="w-full sm:w-auto">
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              <span>Back to Home</span>
            </Button>
            <Link
              to="/credits"
              className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition"
            >
              My Credits
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 4. Authorized admin user: render protected content
  return <>{children}</>;
};

