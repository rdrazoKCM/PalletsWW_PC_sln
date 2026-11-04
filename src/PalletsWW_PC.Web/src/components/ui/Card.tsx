import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'flat' | 'glass' | 'accent' | 'warning';
}

export const Card: React.FC<CardProps> = ({
  variant = 'default',
  children,
  className = '',
  ...props
}) => {
  const variantStyles = {
    default: 'bg-white border border-slate-200 shadow-xs rounded-xl',
    flat: 'bg-slate-50 border border-slate-200 rounded-xl',
    glass: 'bg-white/90 backdrop-blur-md border border-slate-200/80 shadow-sm rounded-xl',
    accent: 'bg-white border-2 border-kc-400 shadow-sm rounded-xl',
    warning: 'bg-amber-50/70 border-2 border-amber-400 shadow-sm rounded-xl',
  };

  return (
    <div className={`${variantStyles[variant]} ${className}`} {...props}>
      {children}
    </div>
  );
};
