import React from 'react';

export interface BadgeProps {
  variant?: 'purple' | 'primary' | 'orange' | 'blue' | 'navy' | 'green' | 'gray';
  size?: 'sm' | 'md';
  children: React.ReactNode;
  className?: string;
  icon?: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'purple',
  size = 'md',
  children,
  className = '',
  icon,
}) => {
  const sizeClasses = {
    sm: 'text-xs px-2.5 py-0.5 gap-1.5 font-medium',
    md: 'text-xs px-3.5 py-1 gap-1.5 font-semibold tracking-wide uppercase',
  };

  const variantClasses = {
    purple: 'bg-brand-purple-50 text-brand-purple-700 border border-brand-purple-200/80',
    primary: 'bg-brand-purple-50 text-brand-purple-700 border border-brand-purple-200/80',
    orange: 'bg-brand-purple-50 text-brand-purple-700 border border-brand-purple-200/80',
    blue: 'bg-sky-50 text-sky-700 border border-sky-200/80',
    navy: 'bg-slate-100 text-brand-navy-900 border border-slate-200',
    green: 'bg-emerald-50 text-emerald-700 border border-emerald-200/80',
    gray: 'bg-slate-50 text-slate-600 border border-slate-200/80',
  };

  return (
    <span className={`inline-flex flex-row items-center justify-center whitespace-nowrap rounded-full ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}>
      {icon}
      <span className="inline-flex flex-row items-center gap-1.5 whitespace-nowrap">{children}</span>
    </span>
  );
};
