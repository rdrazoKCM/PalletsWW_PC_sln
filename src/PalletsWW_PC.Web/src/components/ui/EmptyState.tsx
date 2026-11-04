import React from 'react';
import { PackageOpen } from 'lucide-react';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className = 'py-12',
}) => {
  return (
    <div className={`flex flex-col items-center justify-center text-center p-6 rounded-xl border border-dashed border-slate-300 bg-slate-50/50 ${className}`}>
      <div className="p-3 bg-white text-slate-400 rounded-full border border-slate-200 shadow-2xs mb-3">
        {icon || <PackageOpen className="w-8 h-8 text-slate-400" />}
      </div>
      <h4 className="text-base font-bold text-slate-800 mb-1">{title}</h4>
      {description && (
        <p className="text-xs text-slate-500 max-w-md mb-4">{description}</p>
      )}
      {action && <div>{action}</div>}
    </div>
  );
};
