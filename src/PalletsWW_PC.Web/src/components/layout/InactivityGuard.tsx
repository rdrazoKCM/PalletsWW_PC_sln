import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Clock, AlertTriangle, Power, XCircle, Play } from 'lucide-react';
import { useProduction } from '../../context/ProductionContext';
import { APP_CONFIG } from '../../config';

interface InactivityGuardProps {
  children: React.ReactNode;
}

/**
 * Guardián Global de Inactividad de Terminal (Protección Servidor IIS)
 * Homologado estrictamente con Pallets Pañal (MD5 Kimberly-Clark).
 *
 * Misión Operativa:
 * - Si no se detecta interacción del operador (clic, toque, teclado o scroll),
 *   cierra automáticamente la ventana tras los minutos configurados (default 20m, min 15m).
 * - Desconecta sockets y peticiones para evitar saturar el servidor IIS (172.26.52.14).
 * - PRESERVA 100% EL NÚMERO Y NOMBRE DE EMPLEADO EN LOCALSTORAGE (no se borra nada).
 * - Advierte con banner flotante interactivo durante los últimos 45 segundos.
 * - Cualquier tecla o clic reinicia el temporizador de inmediato.
 */
export const InactivityGuard: React.FC<InactivityGuardProps> = ({ children }) => {
  const { inactivityTimeout, isEditingOrTyping } = useProduction();

  const [warningSecondsLeft, setWarningSecondsLeft] = useState<number | null>(null);
  const [isSessionClosed, setIsSessionClosed] = useState<boolean>(false);

  const lastActivityRef = useRef<number>(Date.now());
  const isEditingRef = useRef<boolean>(isEditingOrTyping);
  isEditingRef.current = isEditingOrTyping;

  // Reset del temporizador ante cualquier interacción física del operador
  const resetTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (warningSecondsLeft !== null) {
      setWarningSecondsLeft(null);
    }
  }, [warningSecondsLeft]);

  // Escucha activa de eventos de usuario (teclado, clics, toques y scroll)
  useEffect(() => {
    if (isSessionClosed) return;
    if (!inactivityTimeout || inactivityTimeout <= 0) return;

    const handleUserInteraction = () => {
      resetTimer();
    };

    // Throttle para mousemove para no sobrecargar el hilo de UI en terminales lentas
    let lastMouseMove = 0;
    const handleMouseMove = () => {
      const now = Date.now();
      if (now - lastMouseMove > 2000) {
        lastMouseMove = now;
        resetTimer();
      }
    };

    window.addEventListener('mousedown', handleUserInteraction, { passive: true });
    window.addEventListener('keydown', handleUserInteraction, { passive: true });
    window.addEventListener('touchstart', handleUserInteraction, { passive: true });
    window.addEventListener('scroll', handleUserInteraction, { passive: true });
    window.addEventListener('click', handleUserInteraction, { passive: true });
    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    return () => {
      window.removeEventListener('mousedown', handleUserInteraction);
      window.removeEventListener('keydown', handleUserInteraction);
      window.removeEventListener('touchstart', handleUserInteraction);
      window.removeEventListener('scroll', handleUserInteraction);
      window.removeEventListener('click', handleUserInteraction);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [inactivityTimeout, isSessionClosed, resetTimer]);

  // Intervalo de evaluación de inactividad cada segundo
  useEffect(() => {
    if (isSessionClosed) return;
    if (!inactivityTimeout || inactivityTimeout <= 0) return;

    const timeoutMs = inactivityTimeout * 60 * 1000;
    const warningMs = APP_CONFIG.inactivity.warningSeconds * 1000;

    const interval = setInterval(() => {
      // Si el operador está en modo edición activa escribiendo, no desconectar
      if (isEditingRef.current) {
        lastActivityRef.current = Date.now();
        if (warningSecondsLeft !== null) setWarningSecondsLeft(null);
        return;
      }

      const elapsed = Date.now() - lastActivityRef.current;
      const remaining = timeoutMs - elapsed;

      if (remaining <= 0) {
        // Tiempo agotado: CERRAR APLICACIÓN
        setIsSessionClosed(true);
        setWarningSecondsLeft(null);

        // Intentar cerrar la ventana de Microsoft Edge de forma nativa
        try {
          window.close();
        } catch {}
      } else if (remaining <= warningMs) {
        // En periodo de aviso previo (últimos 45 segundos)
        const secondsLeft = Math.ceil(remaining / 1000);
        setWarningSecondsLeft(secondsLeft);
      } else {
        // Operación normal
        if (warningSecondsLeft !== null) {
          setWarningSecondsLeft(null);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [inactivityTimeout, isSessionClosed, warningSecondsLeft]);

  // PANTALLA DE CIERRE COMPLETO (Si window.close() fue bloqueado por directiva del navegador)
  if (isSessionClosed) {
    return (
      <div className="fixed inset-0 z-50 bg-[#030a19] text-slate-100 flex flex-col items-center justify-center p-6 select-none font-sans">
        {/* Fondo sutil estilo industrial */}
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(to right, rgba(56, 189, 248, 0.2) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(56, 189, 248, 0.2) 1px, transparent 1px)
            `,
            backgroundSize: '32px 32px'
          }}
        />

        <div className="bg-[#081735]/95 border border-sky-500/30 rounded-3xl p-8 max-w-md w-full shadow-[0_25px_70px_rgba(0,0,0,0.9)] text-center relative z-10 backdrop-blur-xl">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-4 border border-amber-400/30 shadow-[0_0_20px_rgba(245,158,11,0.2)]">
            <Power className="w-8 h-8" />
          </div>

          <h2 className="text-xl font-black text-white mb-2 tracking-wide uppercase">
            Aplicación Cerrada por Inactividad
          </h2>

          <p className="text-xs text-slate-300 mb-4 leading-relaxed">
            Se completaron los <strong className="text-amber-400 font-bold">{inactivityTimeout} minutos</strong> sin uso. Para no saturar el servidor IIS y ahorrar recursos de red, la conexión fue desconectada.
          </p>

          <div className="bg-sky-950/60 border border-sky-800/60 rounded-xl p-3 text-[11px] text-sky-200 mb-6 flex items-center gap-2 text-left">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
            <span>Su <strong>número de empleado y máquina asignada</strong> se conservan guardados en esta terminal.</span>
          </div>

          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => window.close()}
              className="w-full py-3 px-4 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer text-xs"
            >
              <XCircle className="w-4 h-4" />
              <span>Cerrar Ventana</span>
            </button>

            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl border border-slate-700 transition-all flex items-center justify-center gap-2 cursor-pointer text-xs"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Reanudar Aplicación</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {children}

      {/* AVISO PREVIO FLOTANTE (ÚLTIMOS 45 SEGUNDOS) */}
      {warningSecondsLeft !== null && warningSecondsLeft > 0 && (
        <div 
          onClick={resetTimer}
          className="fixed bottom-5 right-5 z-50 max-w-sm w-full bg-slate-900/95 text-white border-2 border-amber-400 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] p-4 backdrop-blur-md animate-in slide-in-from-bottom duration-300 cursor-pointer select-none"
          title="Haga clic en cualquier parte para continuar trabajando"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-400 flex items-center justify-center shrink-0 animate-pulse">
              <Clock className="w-6 h-6" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-black text-amber-300 uppercase tracking-wider flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  Inactividad Detectada
                </span>
                <span className="px-2 py-0.5 rounded-full text-xs font-mono font-black bg-amber-400 text-slate-950 animate-bounce">
                  {warningSecondsLeft}s
                </span>
              </div>

              <p className="text-[11px] text-slate-300 leading-snug mb-2">
                Para no saturar el servidor IIS, la aplicación se cerrará en <strong className="text-amber-300 font-bold">{warningSecondsLeft} segundos</strong> si no se utiliza.
              </p>

              {/* Barra de progreso visual */}
              <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden mb-2.5">
                <div 
                  className="bg-amber-400 h-full transition-all duration-1000 ease-linear rounded-full"
                  style={{ width: `${(warningSecondsLeft / APP_CONFIG.inactivity.warningSeconds) * 100}%` }}
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-400">
                  Presione cualquier tecla o haga clic
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    resetTimer();
                  }}
                  className="px-3 py-1 bg-amber-400 hover:bg-amber-300 active:bg-amber-500 text-slate-950 font-bold rounded-lg text-xs shadow-xs transition-colors cursor-pointer"
                >
                  Continuar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
