import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './Button';

export interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Error de Comunicación',
  message,
  onRetry,
  className = 'py-8',
}) => {
  return (
    <div className={`flex flex-col items-center justify-center text-center p-6 rounded-xl border border-red-200 bg-red-50/60 ${className}`}>
      <div className="p-3 bg-red-100 text-red-600 rounded-full mb-3">
        <AlertCircle className="w-8 h-8" />
      </div>
      <h4 className="text-base font-bold text-red-800 mb-1">{title}</h4>
      <p className="text-xs text-red-600 max-w-md mb-4">{message}</p>
      {onRetry && (
        <Button 
          variant="secondary" 
          size="sm" 
          onClick={onRetry}
          icon={<RefreshCw className="w-3.5 h-3.5" />}
        >
          Reintentar Conexión
        </Button>
      )}
    </div>
  );
};
