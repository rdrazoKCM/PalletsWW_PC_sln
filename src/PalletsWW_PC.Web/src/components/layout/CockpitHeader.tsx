import React, { useState, useEffect } from 'react';
import { 
  Boxes, 
  MapPin, 
  Printer, 
  AlertTriangle, 
  PauseCircle, 
  RotateCw, 
  Cpu, 
  Clock, 
  Calendar, 
  Users, 
  UserCheck, 
  UserX, 
  Keyboard, 
  Loader2,
  Bell
} from 'lucide-react';
import { useProduction } from '../../context/ProductionContext';
import { getNombreMaquinaOficial, getHorarioTurno, formatearFechaVisual, APP_CONFIG } from '../../config';
import { FontSizeStepper } from '../ui/FontSizeStepper';
import { alertasService, type AlertaPallet } from '../../services/alertasService';
import { Link } from 'react-router-dom';

export const CockpitHeader: React.FC = () => {
  const {
    maquinaId,
    maquinaNombre,
    lineaEmpaque,
    setLineaEmpaque,
    lineasEmpaque,
    permitirCambioLinea,
    encabezado,
    printerStatus,
    noEmpleado,
    nombreEmpleado,
    operadorValido,
    validandoOperador,
    setNoEmpleadoInput,
    validarOperador,
    refrescarTodo,
    loadingEncabezado,
    inactivityTimeout
  } = useProduction();

  const [inputVal, setInputVal] = useState<string>(noEmpleado);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [alertas, setAlertas] = useState<AlertaPallet[]>([]);

  // Suscripción a alertas activas para la campana de notificación (si el módulo está habilitado)
  useEffect(() => {
    if (!APP_CONFIG.alertasHabilitadas) return;
    const desuscribir = alertasService.suscribir(setAlertas);
    return () => desuscribir();
  }, []);

  // Sincronizar input visual cuando noEmpleado cambie en el contexto
  useEffect(() => {
    setInputVal(noEmpleado || '');
  }, [noEmpleado]);

  const handleRefresh = async () => {
    setRefreshing(true);
    setInputVal('');
    setNoEmpleadoInput('');
    try {
      await refrescarTodo(true, true);
    } finally {
      setTimeout(() => setRefreshing(false), 500);
    }
  };

  const handleKeyDownOperador = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      await validarOperador(inputVal);
    }
  };

  const handleBlurOperador = async () => {
    if (inputVal !== noEmpleado) {
      await validarOperador(inputVal);
    }
  };

  return (
    <div className="relative overflow-hidden bg-white border border-slate-200/90 rounded-2xl shadow-xs p-3.5 mb-3">
      {/* Línea superior estética de acento institucional */}
      <div 
        style={{
          background: 'linear-gradient(90deg, #002D72 0%, #0047AB 50%, #00E5FF 100%)'
        }}
        className="absolute top-0 left-0 right-0 h-1" 
      />

      {/* FILA 1: TÍTULO INSTITUCIONAL, PLANTA Y SEMÁFORO ZEBRA */}
      <div className="flex flex-wrap items-center justify-between pb-2.5 border-b border-slate-100 gap-2">
        {/* Izquierda: Identidad Kimberly-Clark y Título */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-2">
            <div 
              style={{
                backgroundColor: '#0047AB',
                backgroundImage: 'linear-gradient(135deg, #003888 0%, #0052CC 100%)',
                color: '#ffffff'
              }}
              className="p-1.5 text-white rounded-xl shadow-xs"
            >
              <Boxes className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-black tracking-widest text-[#0047AB] uppercase">KIMBERLY-CLARK</span>
                <span className="text-slate-300 font-light">|</span>
                <span className="text-[10px] font-black tracking-wider text-slate-500 uppercase">PRODUCCIÓN WIPES</span>
              </div>
              <h2 className="text-sm font-extrabold text-slate-900 tracking-tight leading-tight">
                Sistema de Control y Captura de Pallets
              </h2>
            </div>
          </div>

          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-800 border border-sky-200/80 shadow-2xs">
            <MapPin className="w-3 h-3 text-[#0047AB]" />
            Planta Tlaxcala
          </span>

          {encabezado && encabezado.idRT_Encabezado > 0 && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-mono font-black bg-slate-900 text-amber-300 border border-slate-700 shadow-2xs">
              <span className="text-[10px] text-slate-400 font-sans font-bold">Encabezado:</span>
              <span>{encabezado.idRT_Encabezado}</span>
            </span>
          )}
        </div>

        {/* Derecha: Semáforo Zebra Pro + Botón Actualizar */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {printerStatus.enPausa ? (
            <div 
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-extrabold bg-amber-50 text-amber-900 border border-amber-300 shadow-2xs cursor-help"
              title={printerStatus.mensaje}
            >
              <PauseCircle className="w-4 h-4 text-amber-600" />
              <span>Impresora en PAUSA ({printerStatus.trabajosEnCola} en cola)</span>
            </div>
          ) : printerStatus.sinPapel ? (
            <div 
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-extrabold bg-amber-50 text-amber-900 border border-amber-400 shadow-2xs cursor-help animate-pulse"
              title={printerStatus.mensaje}
            >
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>Impresora: SIN PAPEL</span>
            </div>
          ) : printerStatus.tapaAbierta ? (
            <div 
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-extrabold bg-amber-50 text-amber-900 border border-amber-400 shadow-2xs cursor-help animate-pulse"
              title={printerStatus.mensaje}
            >
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>Impresora: TAPA ABIERTA</span>
            </div>
          ) : printerStatus.isError && printerStatus.conectada ? (
            <div 
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-extrabold bg-red-50 text-red-900 border border-red-300 shadow-2xs cursor-help"
              title={printerStatus.mensaje}
            >
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <span>Impresora en ERROR</span>
            </div>
          ) : printerStatus.conectada && printerStatus.esCompatible === false ? (
            <div 
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-amber-50 text-amber-900 border border-amber-300 shadow-2xs cursor-help"
              title={`La impresora detectada "${printerStatus.nombre}" no admite código ZPL. Se requiere una impresora térmica Zebra de planta.`}
            >
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>Impresora no compatible</span>
            </div>
          ) : printerStatus.conectada ? (
            <div 
              className="inline-flex items-center gap-2 px-3 py-1 rounded-xl text-xs font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-300/80 shadow-2xs cursor-default"
              title={printerStatus.mensaje}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-xs animate-pulse" />
              <Printer className="w-4 h-4 text-emerald-600" />
              <span>Zebra {printerStatus.nombre} Lista</span>
            </div>
          ) : (
            <div 
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-extrabold bg-red-50 text-red-800 border border-red-300 shadow-2xs cursor-help"
              title={printerStatus.mensaje}
            >
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <span>Impresora Desconectada</span>
            </div>
          )}

          {/* Badge de Auto-cierre por Inactividad (Protección de Servidor IIS) */}
          <Link
            to="/configuracion"
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold transition-all shadow-2xs border ${
              inactivityTimeout > 0
                ? 'bg-blue-50/80 text-blue-900 border-blue-200 hover:bg-blue-100 hover:border-blue-300'
                : 'bg-slate-100/80 text-slate-600 border-slate-300 hover:bg-slate-200'
            }`}
            title={
              inactivityTimeout > 0
                ? `Auto-cierre por inactividad activo: se cerrará tras ${inactivityTimeout} min sin uso para proteger el servidor IIS. Clic para cambiar.`
                : 'Auto-cierre por inactividad desactivado. Clic para configurar.'
            }
          >
            <Clock className={`w-3.5 h-3.5 ${inactivityTimeout > 0 ? 'text-blue-600 animate-pulse' : 'text-slate-400'}`} />
            <span>
              {inactivityTimeout > 0 ? `${inactivityTimeout} min auto-cierre` : 'Auto-cierre: Off'}
            </span>
          </Link>

          {/* Control Ergonómico de Tamaño de Letra (A un lado del estatus de la impresora) */}
          <FontSizeStepper />

          {/* Campana de Notificaciones de Almacén (Pallets Sin Etiqueta) - Visible solo si el módulo está habilitado */}
          {APP_CONFIG.alertasHabilitadas && (
            <button
              type="button"
              onClick={() => {
                const banner = document.querySelector('.animate-ping')?.closest('.rounded-2xl');
                if (banner) {
                  banner.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
              }}
              className={`
                relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs active:scale-98
                ${alertas.length > 0 
                  ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 font-black ring-2 ring-amber-400 animate-pulse shadow-amber-500/30' 
                  : 'border border-slate-300 bg-white hover:bg-slate-50 text-slate-600'}
              `}
              title={alertas.length > 0 ? `${alertas.length} tarima(s) sin etiqueta en Almacén` : 'Sin alertas de almacén'}
            >
              <Bell className={`w-3.5 h-3.5 ${alertas.length > 0 ? 'text-slate-950' : 'text-slate-500'}`} />
              {alertas.length > 0 ? (
                <span className="flex items-center gap-1">
                  <span>Alertas</span>
                  <span className="px-1.5 py-0.2 bg-red-600 text-white rounded-full text-[10px] font-black">
                    {alertas.length}
                  </span>
                </span>
              ) : (
                <span>Alertas</span>
              )}
            </button>
          )}

          <button
            onClick={handleRefresh}
            disabled={refreshing || loadingEncabezado}
            className="
              inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold
              border border-slate-300 bg-white hover:bg-slate-50 text-slate-700
              transition-all cursor-pointer shadow-2xs active:scale-98 disabled:opacity-50
            "
            title="Actualiza la información completa de producción, turnos y vales"
          >
            <RotateCw className={`w-3.5 h-3.5 text-slate-500 ${refreshing || loadingEncabezado ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      {/* FILA 2: BARRA COCKPIT DE CONTEXTO Y OPERADOR DESTACADO */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2.5">
        {/* Bloque Izquierdo: Chips de Datos de Turno */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Máquina Asignada y Selector de Línea de Empaque */}
          <div className="inline-flex items-center px-2.5 py-1 rounded-xl bg-slate-50 border border-slate-200/90 text-xs shadow-2xs gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-[#0047AB]" />
            <span className="text-slate-500 font-medium">Máquina:</span>
            <strong className="text-slate-900 font-mono font-black">
              {getNombreMaquinaOficial(maquinaId, maquinaNombre)}
            </strong>
            <span className="text-slate-300">|</span>
            {permitirCambioLinea && lineasEmpaque && lineasEmpaque.length > 0 ? (
              <div className="inline-flex rounded-lg p-0.5 bg-slate-200/70 text-[11px] font-bold">
                {lineasEmpaque.map((l) => (
                  <button
                    key={l.lineaEmpaque}
                    type="button"
                    onClick={() => setLineaEmpaque(l.lineaEmpaque)}
                    className={`px-2 py-0.5 rounded-md cursor-pointer transition-all ${
                      (lineaEmpaque || lineasEmpaque[0]?.lineaEmpaque) === l.lineaEmpaque
                        ? 'bg-[#0047AB] text-white shadow-2xs font-extrabold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title={`Línea ${l.lineaEmpaque}`}
                  >
                    {l.lineaEmpaque}
                  </button>
                ))}
              </div>
            ) : (
              <span 
                className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-black bg-sky-100 text-[#0047AB] border border-sky-200"
                title="Línea de empaque asignada fijamente a esta terminal"
              >
                Línea {lineaEmpaque || (lineasEmpaque[0]?.lineaEmpaque || '1')}
              </span>
            )}
          </div>

          {/* Turno con Horario Oficial */}
          <div className="inline-flex items-center px-2.5 py-1 rounded-xl bg-slate-50 border border-slate-200/90 text-xs shadow-2xs">
            <Clock className="w-3.5 h-3.5 text-slate-500 mr-1.5" />
            <span className="text-slate-500 mr-1 font-medium">Turno:</span>
            <strong className="text-slate-900 font-mono font-black">
              {encabezado?.turno 
                ? `Turno ${encabezado.turno} (${getHorarioTurno(encabezado.turno)})` 
                : (() => {
                    const now = new Date();
                    const hrs = now.getHours();
                    const tCalc = (hrs >= 7 && hrs < 15) ? 1 : (hrs >= 15 && hrs < 23) ? 2 : 3;
                    return `Turno ${tCalc} (${getHorarioTurno(tCalc)})`;
                  })()}
            </strong>
          </div>

          {/* Fecha en formato Día / Mes / Año */}
          <div className="inline-flex items-center px-2.5 py-1 rounded-xl bg-slate-50 border border-slate-200/90 text-xs shadow-2xs">
            <Calendar className="w-3.5 h-3.5 text-slate-500 mr-1.5" />
            <span className="text-slate-500 mr-1 font-medium">Fecha:</span>
            <strong className="text-slate-900 font-mono font-black">
              {formatearFechaVisual(encabezado?.fecha)}
            </strong>
          </div>

          {/* Supervisor y Tripulación */}
          <div className="inline-flex items-center px-2.5 py-1 rounded-xl bg-slate-50 border border-slate-200/90 text-xs shadow-2xs">
            <Users className="w-3.5 h-3.5 text-slate-500 mr-1.5 shrink-0" />
            <span className="px-1.5 py-0.2 rounded-md bg-slate-200 text-slate-800 font-bold mr-1.5 text-[11px] shrink-0">
              {(() => {
                const trip = encabezado?.tripulacion?.trim();
                if (!trip || trip === '-' || trip === '--') return 'Trip --';
                return trip.toUpperCase().startsWith('TRIP') ? trip : `Trip ${trip}`;
              })()}
            </span>
            <strong className="text-slate-800 font-medium whitespace-nowrap" title={encabezado?.nombreSupervisor || 'Supervisor'}>
              {encabezado?.nombreSupervisor || 'Sin Asignar'}
            </strong>
          </div>
        </div>

        {/* Bloque Derecho: Operador que Captura Destacado e Interactivo */}
        <div 
          className={`
            flex items-center gap-2 p-1.5 px-3 rounded-xl border transition-all shadow-2xs
            ${operadorValido 
              ? 'bg-emerald-50/90 border-emerald-300 ring-1 ring-emerald-400/30' 
              : !inputVal 
                ? 'bg-amber-50/90 border-amber-300 ring-1 ring-amber-400/30' 
                : 'bg-red-50/90 border-red-300 ring-1 ring-red-400/30'}
          `}
        >
          <label 
            htmlFor="input-operador-no"
            className={`
              text-xs font-extrabold flex items-center gap-1 select-none
              ${operadorValido ? 'text-emerald-800' : !inputVal ? 'text-amber-800' : 'text-red-800'}
            `}
          >
            {operadorValido ? (
              <UserCheck className="w-4 h-4 text-emerald-600" />
            ) : !inputVal ? (
              <Keyboard className="w-4 h-4 text-amber-600" />
            ) : (
              <UserX className="w-4 h-4 text-red-600" />
            )}
            <span>Operador:</span>
          </label>

          <div className="flex items-center rounded-lg overflow-hidden border border-slate-300 bg-white shadow-2xs">
            <input
              id="input-operador-no"
              type="text"
              inputMode="numeric"
              maxLength={10}
              placeholder="No. Emp"
              value={inputVal}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '');
                setInputVal(val);
                setNoEmpleadoInput(val);
              }}
              onKeyDown={handleKeyDownOperador}
              onBlur={handleBlurOperador}
              className={`
                w-20 px-2 py-1 text-xs font-mono font-black text-center focus:outline-none focus:bg-blue-50
                ${operadorValido ? 'text-emerald-800' : !inputVal ? 'text-slate-800' : 'text-red-700'}
              `}
            />

            <div 
              className={`
                px-2.5 py-1 text-xs font-medium border-l border-slate-200 min-w-[140px] max-w-[280px] truncate flex items-center gap-1.5
                ${operadorValido ? 'text-emerald-800 font-bold' : !inputVal ? 'text-slate-400' : 'text-red-600'}
              `}
              title={nombreEmpleado}
            >
              {validandoOperador ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin text-[#0047AB]" />
                  <span>Validando...</span>
                </>
              ) : operadorValido ? (
                <>
                  <UserCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="truncate">{nombreEmpleado}</span>
                </>
              ) : !inputVal ? (
                <span>Inserte No. Emp</span>
              ) : (
                <>
                  <UserX className="w-3.5 h-3.5 text-red-500 shrink-0" />
                  <span className="truncate">{nombreEmpleado || 'Inválido'}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
