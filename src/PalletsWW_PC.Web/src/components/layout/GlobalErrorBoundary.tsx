import { Component, type ErrorInfo, type ReactNode } from 'react';
import { RefreshCw, RotateCcw, ShieldAlert, WifiOff } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  isChunkError: boolean;
  retrying: boolean;
}

export class GlobalErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    isChunkError: false,
    retrying: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    const isChunk = 
      error.message?.includes('dynamically imported module') ||
      error.message?.includes('Loading chunk') ||
      error.message?.includes('Preload error') ||
      error.name === 'ChunkLoadError';

    return {
      hasError: true,
      error,
      isChunkError: isChunk,
    };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[GlobalErrorBoundary] Error no controlado capturado:', error, errorInfo);
    this.setState({ errorInfo });

    // Si es un error de chunk por actualización en el servidor, auto-recargar suavemente tras 1.5s
    const isChunk = 
      error.message?.includes('dynamically imported module') ||
      error.message?.includes('Loading chunk') ||
      error.message?.includes('Preload error') ||
      error.name === 'ChunkLoadError';

    if (isChunk) {
      console.warn('[GlobalErrorBoundary] Detectada actualización de versión en el servidor. Recargando bundle...');
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    }
  }

  private handleReset = () => {
    this.setState({ retrying: true });
    setTimeout(() => {
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        isChunkError: false,
        retrying: false,
      });
    }, 400);
  };

  private handleReload = () => {
    window.location.reload();
  };

  public override render() {
    if (this.state.hasError) {
      const { error, isChunkError, retrying } = this.state;

      return (
        <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4 select-none">
          {/* Fondo sutil estilo industrial Kimberly-Clark */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(0,71,171,0.22),transparent_70%)] pointer-events-none" />

          <div className="relative w-full max-w-xl bg-slate-800/90 border border-slate-700/80 rounded-2xl shadow-2xl p-6 sm:p-8 backdrop-blur-md">
            {/* Header del Blindaje */}
            <div className="flex items-center gap-4 border-b border-slate-700 pb-5">
              <div className="w-14 h-14 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                {isChunkError ? (
                  <WifiOff className="w-8 h-8 animate-pulse" />
                ) : (
                  <ShieldAlert className="w-8 h-8 text-amber-400" />
                )}
              </div>
              <div>
                <h1 className="text-xl font-bold text-white tracking-wide">
                  Pallets Pañal — Kimberly-Clark Tlaxcala
                </h1>
                <p className="text-xs text-sky-400 font-medium uppercase tracking-wider mt-0.5">
                  Protección Activa de Pantalla y Estado de Piso
                </p>
              </div>
            </div>

            {/* Cuerpo del Mensaje */}
            <div className="py-6 space-y-4">
              <div className="bg-amber-500/10 border-l-4 border-amber-500 p-4 rounded-r-lg">
                <p className="text-sm font-semibold text-amber-200">
                  {isChunkError
                    ? 'Actualización de Versión en Servidor Detectada'
                    : 'Interrupción Temporal de Comunicación o Renderizado'}
                </p>
                <p className="text-xs text-amber-300/80 mt-1 leading-relaxed">
                  {isChunkError
                    ? 'El servidor IIS ha publicado una nueva versión del sistema. Tus datos y pallets en SQL Server están 100% seguros y resguardados. La pantalla se actualizará automáticamente en breve.'
                    : 'Se detectó una pausa momentánea en el servicio o una respuesta inesperada de la red. Tus datos capturados no se han borrado.'}
                </p>
              </div>

              {/* Detalle no invasivo */}
              <div className="bg-slate-950/60 rounded-lg p-3 border border-slate-800 text-xs font-mono text-slate-400 break-words max-h-32 overflow-y-auto">
                <span className="text-slate-500 block mb-1">Diagnóstico interno:</span>
                {error?.message || 'Error no especificado en el árbol de componentes.'}
              </div>
            </div>

            {/* Botones de Acción */}
            <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4 border-t border-slate-700/80">
              <button
                type="button"
                onClick={this.handleReset}
                disabled={retrying}
                className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                <RotateCcw className={`w-4 h-4 ${retrying ? 'animate-spin' : ''}`} />
                Restaurar Vista
              </button>

              <button
                type="button"
                onClick={this.handleReload}
                className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-[#0047AB] hover:bg-[#00388A] text-white text-sm font-semibold shadow-lg shadow-blue-900/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                Recargar Aplicación
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
