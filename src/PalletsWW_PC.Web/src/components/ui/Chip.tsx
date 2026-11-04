import React from 'react';

export interface ChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: 'ok' | 'warn' | 'danger' | 'info' | 'neutral' | 'brand';
  size?: 'sm' | 'md';
  icon?: React.ReactNode;
}

export const Chip: React.FC<ChipProps> = ({
  tone = 'neutral',
  size = 'sm',
  icon,
  children,
  className = '',
  ...props
}) => {
  const sizeStyles = {
    sm: 'text-xs px-2.5 py-0.5 gap-1.5',
    md: 'text-sm px-3 py-1 gap-2',
  };

  // Estados semánticos invariables de Kimberly-Clark
  const toneStyles = {
    ok: 'bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium',
    warn: 'bg-amber-50 text-amber-800 border border-amber-300 font-medium',
    danger: 'bg-red-50 text-red-800 border border-red-200 font-medium',
    info: 'bg-blue-50 text-kc-700 border border-blue-200 font-medium',
    neutral: 'bg-slate-100 text-slate-700 border border-slate-200',
    brand: 'bg-kc-50 text-kc-700 border border-kc-200 font-semibold',
  };

  return (
    <span
      className={`inline-flex items-center rounded-md font-sans tracking-wide ${sizeStyles[size]} ${toneStyles[tone]} ${className}`}
      {...props}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      <span>{children}</span>
    </span>
  );
};
