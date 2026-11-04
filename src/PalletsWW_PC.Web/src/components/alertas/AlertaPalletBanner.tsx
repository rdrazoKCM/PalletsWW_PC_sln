import React, { useState } from 'react';
import { 
  AlertTriangle, 
  PackageX, 
  ArrowRight, 
  CheckCircle2, 
  ChevronUp, 
  ChevronDown, 
  Clock, 
  UserCheck 
} from 'lucide-react';
import Swal from 'sweetalert2';
import type { AlertaPallet } from '../../services/alertasService';
import { alertasService } from '../../services/alertasService';

interface AlertaPalletBannerProps {
  alertas: AlertaPallet[];
  noEmpOperador?: string | number;
  onCapturarClick?: () => void;
}

export const AlertaPalletBanner: React.FC<AlertaPalletBannerProps> = ({
  alertas,
  noEmpOperador,
  onCapturarClick
}) => {
  const [minimizado, setMinimizado] = useState(false);
  const [procesandoId, setProcesandoId] = useState<number | null>(null);

  if (!alertas || alertas.length === 0) {
    return null;
  }

  // Tomar la alerta más reciente
  const alertaPrincipal = alertas[0];
  const totalAlertas = alertas.length;

  const handleMarcarAtendido = async (alerta: AlertaPallet) => {
    const result = await Swal.fire({
      title: '¿Confirmar Atención?',
      text: `¿Ya imprimiste y entregaste la etiqueta para el pallet de la máquina ${alerta.nombreMaquina || alerta.noMaquina} en almacén?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, ya la entregué',
      cancelButtonText: 'Aún no',
      confirmButtonColor: '#0047AB',
      cancelButtonColor: '#64748b',
    });

    if (result.isConfirmed) {
      setProcesandoId(alerta.idAlerta);
      try {
        const noEmp = Number(noEmpOperador) || 0;
        const ok = await alertasService.atenderAlerta({
          idAlerta: alerta.idAlerta,
          noEmpOperadorMaquina: noEmp,
        });

        if (ok) {
          Swal.fire({
            title: '¡Alerta Atendida!',
            text: 'La alerta fue despejada exitosamente en almacén y en la máquina.',
            icon: 'success',
            timer: 2000,
            showConfirmButton: false,
          });
        } else {
          Swal.fire('Error', 'No se pudo actualizar el estado de la alerta.', 'error');
        }
      } finally {
        setProcesandoId(null);
      }
    }
  };

  const formatearTiempo = (min: number) => {
    if (min <= 0) return 'Hace unos segundos';
    if (min === 1) return 'Hace 1 minuto';
    if (min < 60) return `Hace ${min} minutos`;
    const horas = Math.floor(min / 60);
    return `Hace más de ${horas}h`;
  };

  return (
    <div className="w-full mb-3 transition-all duration-300">
      {/* Contenedor Flotante de Alta Gama Neumórfico-Industrial */}
      <div 
        className="rounded-2xl border-2 border-amber-400 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-[0_0_25px_rgba(245,158,11,0.35)] overflow-hidden transition-all duration-300"
      >
        {/* Barra Superior de Estado */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-amber-500/15 border-b border-amber-400/30">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-amber-500"></span>
            </span>
            <div className="flex items-center gap-1.5 font-bold text-amber-300 text-sm tracking-wide uppercase">
              <AlertTriangle className="w-4 h-4 text-amber-400 animate-bounce" />
              <span>Aviso Urgente de Almacén</span>
              {totalAlertas > 1 && (
                <span className="ml-2 px-2 py-0.5 text-xs bg-red-600 text-white font-extrabold rounded-full">
                  {totalAlertas} Tarimas Pendientes
                </span>
              )}
            </div>
          </div>

          <button
            onClick={() => setMinimizado(!minimizado)}
            className="text-amber-200/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors flex items-center gap-1 text-xs font-semibold cursor-pointer"
            title={minimizado ? 'Expandir detalle' : 'Minimizar aviso'}
          >
            <span>{minimizado ? 'Ver Detalle' : 'Minimizar'}</span>
            {minimizado ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>

        {/* Cuerpo Principal del Banner */}
        {!minimizado ? (
          <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-amber-500/20 border border-amber-400/40 rounded-xl flex-shrink-0 text-amber-400 shadow-inner">
                <PackageX className="w-8 h-8" />
              </div>

              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-black text-white tracking-tight">
                    Tarima recibida sin etiqueta en Recepción PT
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-md bg-amber-400 text-slate-950 font-black text-xs uppercase shadow-sm">
                    Máquina {alertaPrincipal.nombreMaquina || `TL0${alertaPrincipal.noMaquina}`}
                  </span>
                </div>

                <p className="text-slate-300 text-sm leading-relaxed">
                  El montacargas entregó un pallet en almacén sin su etiqueta física de código de barras. Se requiere imprimir y colocar la etiqueta para darle entrada al inventario.
                </p>

                {alertaPrincipal.comentarios && (
                  <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-xs text-amber-200">
                    <span className="font-semibold text-slate-400">Nota de Almacén:</span>
                    <span>"{alertaPrincipal.comentarios}"</span>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-slate-400 font-medium">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    {formatearTiempo(alertaPrincipal.minutosTranscurridos)}
                  </span>
                  {alertaPrincipal.noEmpSup > 0 && (
                    <span className="flex items-center gap-1">
                      <UserCheck className="w-3.5 h-3.5 text-blue-400" />
                      Supervisor Almacén: No. {alertaPrincipal.noEmpSup}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Botones de Acción Inmediata */}
            <div className="flex flex-col sm:flex-row md:flex-col lg:flex-row gap-2.5 flex-shrink-0">
              <button
                type="button"
                onClick={() => onCapturarClick?.()}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
              >
                <span>Capturar Tarima</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                disabled={procesandoId === alertaPrincipal.idAlerta}
                onClick={() => handleMarcarAtendido(alertaPrincipal)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm border border-slate-600 hover:border-slate-500 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>{procesandoId === alertaPrincipal.idAlerta ? 'Guardando...' : 'Marcar Atendido'}</span>
              </button>
            </div>
          </div>
        ) : (
          /* Modo Compacto Minimizado */
          <div className="px-4 py-2 flex items-center justify-between bg-black/20 text-xs">
            <span className="text-amber-300 font-medium">
              Pallet sin etiqueta pendiente para {alertaPrincipal.nombreMaquina || `Máquina ${alertaPrincipal.noMaquina}`} ({formatearTiempo(alertaPrincipal.minutosTranscurridos)})
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onCapturarClick?.()}
                className="text-amber-400 hover:underline font-bold"
              >
                Ir a Capturar
              </button>
              <span className="text-slate-600">|</span>
              <button
                onClick={() => handleMarcarAtendido(alertaPrincipal)}
                className="text-emerald-400 hover:underline font-bold"
              >
                Marcar Atendido
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};