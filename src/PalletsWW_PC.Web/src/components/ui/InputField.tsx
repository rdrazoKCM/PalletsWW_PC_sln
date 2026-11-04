import React, { forwardRef } from 'react';

export interface InputFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: React.ReactNode;
  rightElement?: React.ReactNode;
}

export const InputField = forwardRef<HTMLInputElement, InputFieldProps>(({
  label,
  error,
  hint,
  icon,
  rightElement,
  id,
  className = '',
  disabled,
  ...props
}, ref) => {
  const inputId = id || (label ? `input-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

  return (
    <div className="w-full">
      {label && (
        <label 
          htmlFor={inputId} 
          className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1"
        >
          {label}
        </label>
      )}
      <div className="relative rounded-lg shadow-2xs">
        {icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            {icon}
          </div>
        )}
        <input
          ref={ref}
          id={inputId}
          disabled={disabled}
          className={`
            w-full rounded-lg border bg-white py-2 text-sm text-slate-800 transition-colors
            placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-kc-400 focus:border-kc-600
            disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed
            ${icon ? 'pl-9' : 'pl-3'}
            ${rightElement ? 'pr-10' : 'pr-3'}
            ${error ? 'border-red-400 focus:ring-red-400 focus:border-red-500 bg-red-50/20' : 'border-slate-300'}
            ${className}
          `}
          {...props}
        />
        {rightElement && (
          <div className="absolute inset-y-0 right-0 pr-2 flex items-center">
            {rightElement}
          </div>
        )}
      </div>
      {error && (
        <p className="mt-1 text-xs text-red-600 font-medium">{error}</p>
      )}
      {hint && !error && (
        <p className="mt-1 text-xs text-slate-500">{hint}</p>
      )}
    </div>
  );
});

InputField.displayName = 'InputField';
