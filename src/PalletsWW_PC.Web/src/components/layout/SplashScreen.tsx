import React, { useEffect, useState } from 'react';
import { Cpu, CheckCircle2, Loader2 } from 'lucide-react';
import { useProduction } from '../../context/ProductionContext';
import { APP_CONFIG } from '../../config';

export const SplashScreen: React.FC = () => {
  const { isAppReady, initProgress, initStatusMessage, maquinaNombre, maquinaId, lineaEmpaque } = useProduction();
  const [shouldRender, setShouldRender] = useState(true);
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    if (isAppReady) {
      setIsFadingOut(true);
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, 550);
      return () => clearTimeout(timer);
    }
  }, [isAppReady]);

  if (!shouldRender) return null;

  return (
    <div
      className={`fixed inset-0 z-50 bg-[#030a19] text-slate-100 flex flex-col justify-between p-4 overflow-hidden font-sans select-none transition-all duration-500 ease-out ${
        isFadingOut ? 'opacity-0 scale-102 pointer-events-none' : 'opacity-100 scale-100'
      }`}
    >
      {/* Grid Neón de Fondo (Estándar Corporativo MD5) */}
      <div
        className="absolute inset-0 opacity-[0.06] pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(56, 189, 248, 0.18) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(56, 189, 248, 0.18) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
      />

      {/* Halos de luz radial ambiental multicapa */}
      <div className="absolute top-[-10%] left-[-5%] w-[50vw] h-[50vw] max-w-[650px] max-h-[650px] bg-kc-600/25 rounded-full blur-[140px] pointer-events-none animate-pulse duration-1000" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[50vw] h-[50vw] max-w-[650px] max-h-[650px] bg-cyan-600/20 rounded-full blur-[140px] pointer-events-none animate-pulse duration-700" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[70vw] h-[35vw] bg-sky-500/12 rounded-full blur-[160px] pointer-events-none" />

      {/* CABECERA SUPERIOR */}
      <header className="relative z-10 flex justify-between items-center px-2 pt-2">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
          <span className="text-[10px] font-mono tracking-widest text-emerald-400 uppercase font-bold">
            SISTEMA OPERATIVO ACTIVO
          </span>
        </div>
        <div className="text-[10px] font-mono tracking-widest text-cyan-400 uppercase font-bold">
          {maquinaId > 0 ? `LÍNEA ${maquinaNombre || maquinaId} • PACK ${lineaEmpaque}` : 'INICIALIZANDO TERMINAL'}
        </div>
      </header>

      {/* CONTENEDOR CENTRAL */}
      <main className="flex-1 flex flex-col items-center justify-center z-10 w-full max-w-[430px] mx-auto my-auto py-4">
        {/* LOGOTIPO CORPORATIVO Y TÍTULOS */}
        <div className="text-center mb-5 flex flex-col items-center">
          <div className="flex justify-center w-full mb-3 relative">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 bg-cyan-500/25 rounded-full blur-2xl pointer-events-none" />
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-kc-600 via-sky-600 to-cyan-400 p-0.5 shadow-[0_0_30px_rgba(14,165,233,0.45)] relative z-10 flex items-center justify-center">
              <div className="w-full h-full bg-[#081735] rounded-[14px] flex items-center justify-center">
                <Cpu className="w-8 h-8 text-cyan-300 animate-pulse" />
              </div>
            </div>
          </div>

          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white uppercase flex items-center justify-center gap-2 drop-shadow-[0_4px_25px_rgba(0,0,0,0.85)]">
            <span>PALLETS</span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-cyan-300 to-blue-400">WIPES</span>
          </h1>

          <div className="mt-1.5 flex items-center justify-center gap-2">
            <span className="text-[9.5px] font-black px-3 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 tracking-widest uppercase shadow-[0_0_12px_rgba(34,211,238,0.25)]">
              APLICACIÓN DE ALTO RENDIMIENTO • {APP_CONFIG.version.toUpperCase()}
            </span>
          </div>

          <div className="flex items-center justify-center gap-2 mt-2">
            <div className="h-px w-6 bg-gradient-to-r from-transparent to-cyan-500/60" />
            <p className="text-[9px] font-black text-slate-300 uppercase tracking-[0.22em]">
              KIMBERLY-CLARK DE MÉXICO • PLANTA TLAXCALA • DEPTO WIPES
            </p>
            <div className="h-px w-6 bg-gradient-to-l from-transparent to-cyan-500/60" />
          </div>
        </div>

        {/* TARJETA INDUSTRIAL CON HUD */}
        <div className="w-full relative">
          {/* Esquinas Industriales HUD */}
          <div className="absolute -top-2.5 -left-2.5 w-4 h-4 border-t-2 border-l-2 border-cyan-400 z-20 pointer-events-none" />
          <div className="absolute -top-2.5 -right-2.5 w-4 h-4 border-t-2 border-r-2 border-cyan-400 z-20 pointer-events-none" />
          <div className="absolute -bottom-2.5 -left-2.5 w-4 h-4 border-b-2 border-l-2 border-cyan-400 z-20 pointer-events-none" />
          <div className="absolute -bottom-2.5 -right-2.5 w-4 h-4 border-b-2 border-r-2 border-cyan-400 z-20 pointer-events-none" />

          {/* Tarjeta de Cristal Glassmorphic */}
          <div className="bg-[#081735]/90 backdrop-blur-2xl border border-sky-500/35 rounded-[2.2rem] px-6 py-6 sm:px-8 sm:py-7 shadow-[0_30px_80px_rgba(0,0,0,0.95)] relative z-10 flex flex-col gap-4 ring-1 ring-cyan-500/20">
            {/* Encabezado de la barra */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
                <span className="text-[10px] font-black tracking-widest text-cyan-400 uppercase">
                  CARGANDO DATOS DE PLANTA
                </span>
              </div>
              <span className="text-sm font-black font-mono text-cyan-300 tabular-nums">
                {Math.min(100, Math.max(0, initProgress))}%
              </span>
            </div>

            {/* Barra de Progreso Industrial Estilo Instalador */}
            <div className="w-full h-3 bg-slate-950/90 border border-sky-500/40 rounded-full overflow-hidden p-0.5 shadow-inner relative">
              <div
                className="h-full rounded-full bg-gradient-to-r from-kc-600 via-sky-400 to-cyan-300 shadow-[0_0_14px_rgba(56,189,248,0.7)] transition-all duration-300 ease-out relative overflow-hidden"
                style={{ width: `${Math.min(100, Math.max(8, initProgress))}%` }}
              >
                {/* Efecto Shimmer de Luz en Movimiento */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full animate-[shimmer_1.6s_infinite]" />
              </div>
            </div>

            {/* Mensaje de Etapa Actual */}
            <div className="min-h-[22px] flex items-center justify-between text-[11px] text-slate-300 font-medium">
              <span className="truncate pr-2">{initStatusMessage || 'Sincronizando producción...'}</span>
              {initProgress >= 100 && (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 animate-in zoom-in duration-200" />
              )}
            </div>

            {/* Micro Tag Informativo */}
            <div className="pt-2 border-t border-slate-700/60 flex items-center justify-between text-[9px] text-slate-400 font-mono">
              <span className="uppercase tracking-wider">MOTOR MD5 • ALTA DISPONIBILIDAD</span>
              <span className="text-cyan-400 font-bold uppercase tracking-wider">PALLETS WW ARCH</span>
            </div>
          </div>
        </div>
      </main>

      {/* PIE DE PÁGINA */}
      <footer className="relative z-10 text-center py-1">
        <p className="text-[8.5px] font-mono text-slate-500 uppercase tracking-widest">
          TERMINAL FIJA DE EMPAQUE • OPERACIÓN INDUSTRIAL CONTINUA 24/7
        </p>
      </footer>
    </div>
  );
};
