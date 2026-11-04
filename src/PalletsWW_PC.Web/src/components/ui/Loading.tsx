import React from 'react';
import { Loader2 } from 'lucide-react';

export const Loading: React.FC<{ message?: string; className?: string }> = ({
  message = 'Cargando información...',
  className = 'py-12',
}) => {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 text-slate-500 ${className}`}>
      <Loader2 className="w-8 h-8 animate-spin text-kc-600" />
      <span className="text-sm font-medium">{message}</span>
    </div>
  );
};
