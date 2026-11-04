import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'warning' | 'ghost' | 'success';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  children,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1 select-none cursor-pointer active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100 shadow-xs';

  const sizeStyles = {
    sm: 'text-xs px-2.5 py-1.5 gap-1.5',
    md: 'text-sm px-4 py-2 gap-2',
    lg: 'text-base px-5 py-2.5 gap-2.5 font-semibold',
  };

  // Regla de Oro DISENO_KC: kc-600 (#0047AB) para acción primaria. Prohibido usar gradientes en botones de acción.
  const variantStyles = {
    primary: 'bg-kc-600 hover:bg-kc-700 text-white focus:ring-kc-400 shadow-sm border border-kc-700',
    secondary: 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 focus:ring-slate-400 shadow-xs',
    danger: 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-400 border border-red-700',
    warning: 'bg-amber-500 hover:bg-amber-600 text-white focus:ring-amber-400 border border-amber-600 font-semibold',
    success: 'bg-emerald-600 hover:bg-emerald-700 text-white focus:ring-emerald-400 border border-emerald-700',
    ghost: 'bg-transparent hover:bg-slate-100 text-slate-700 focus:ring-slate-400 shadow-none',
  };

  return (
    <button
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : icon ? (
        <span className="flex-shrink-0">{icon}</span>
      ) : null}
      {children}
    </button>
  );
};
