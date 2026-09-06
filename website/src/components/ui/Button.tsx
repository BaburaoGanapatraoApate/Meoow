import React from 'react';
import { Link } from 'react-router-dom';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'navy';
  size?: 'sm' | 'md' | 'lg';
  href?: string;
  isExternal?: boolean;
  children: React.ReactNode;
  className?: string;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  href,
  isExternal,
  children,
  className = '',
  disabled,
  ...props
}) => {
  const baseClasses = 'inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]';

  const sizeClasses = {
    sm: 'text-xs px-3.5 py-1.5 gap-1.5',
    md: 'text-sm px-5 py-2.5 gap-2',
    lg: 'text-base px-6 py-3.5 gap-2.5',
  };

  const variantClasses = {
    primary: 'bg-brand-purple-600 hover:bg-brand-purple-700 text-white shadow-sm hover:shadow-md focus:ring-brand-purple-400 border border-brand-purple-700/20',
    secondary: 'bg-white hover:bg-slate-50 text-brand-navy-900 border border-slate-200 shadow-sm hover:shadow focus:ring-slate-300',
    outline: 'bg-transparent hover:bg-brand-purple-50 text-brand-purple-600 border border-brand-purple-300 focus:ring-brand-purple-300',
    ghost: 'bg-transparent hover:bg-slate-100 text-brand-navy-700 hover:text-brand-navy-900 focus:ring-slate-200',
    navy: 'bg-brand-navy-900 hover:bg-brand-navy-800 text-white shadow-sm hover:shadow-md focus:ring-brand-navy-700 border border-brand-navy-950',
  };

  const combinedClasses = `${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`;

  if (href) {
    if (isExternal || href.startsWith('http') || href.startsWith('mailto:')) {
      return (
        <a href={href} className={combinedClasses} target="_blank" rel="noopener noreferrer">
          {children}
        </a>
      );
    }
    return (
      <Link to={href} className={combinedClasses}>
        {children}
      </Link>
    );
  }

  return (
    <button className={combinedClasses} disabled={disabled} {...props}>
      {children}
    </button>
  );
};
