import React, { useState, useRef, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { 
  Boxes, 
  BarChart3, 
  Settings, 
  ChevronLeft, 
  ChevronRight, 
  ChevronUp, 
  ChevronDown, 
  Palette, 
  CheckCircle2, 
  Printer,
  CornerDownLeft,
  RotateCw,
  ClipboardCheck,
  UserCheck,
  Info,
  Sparkles,
  X
} from 'lucide-react';
import Swal from 'sweetalert2';
import { useProduction } from '../../context/ProductionContext';
import { useTheme } from '../../context/ThemeContext';
import { APP_CONFIG } from '../../config';
import { impresionService } from '../../services/impresionService';

export const Sidebar: React.FC = () => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [showThemePicker, setShowThemePicker] = useState<boolean>(false);
  const [showReleaseNotes, setShowReleaseNotes] = useState<boolean>(false);
  const [folioInput, setFolioInput] = useState<string>('');
  const [reprinting, setReprinting] = useState<boolean>(false);
  const inputFolioRef = useRef<HTMLInputElement>(null);
  const lastPrintTimeRef = useRef<number>(0);
  const releaseNotesRef = useRef<HTMLDivElement>(null);

  const { printerStatus, esGerencia } = useProduction();
  const { theme, setTheme, availableThemes } = useTheme();

  // Cerrar notas de la versión al hacer clic fuera del panel
  useEffect(() => {
    if (!showReleaseNotes) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (releaseNotesRef.current && !releaseNotesRef.current.contains(e.target as Node)) {
        setShowReleaseNotes(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showReleaseNotes]);

  // Atajo de teclado global F9 para enfocar rápidamente la reimpresión por ID (solo en producción)
  useEffect(() => {
    if (esGerencia) return;
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F9') {
        e.preventDefault();
        if (isCollapsed) {
          setIsCollapsed(false);
        }
        setTimeout(() => {
          inputFolioRef.current?.focus();
          inputFolioRef.current?.select();
        }, 80);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isCollapsed]);

  const ejecutarReimpresion = async (folioStr: string) => {
    const clean = folioStr.trim();
    if (!clean) return;

    const id = parseInt(clean, 10);
    if (isNaN(id) || id <= 0) {
      Swal.fire({
        toast: true,
        position: 'top-start',
        icon: 'warning',
        title: 'Folio No Válido',
        text: 'Ingrese un ID numérico de pallet mayor a cero.',
        timer: 3000,
        timerProgressBar: true,
        showConfirmButton: false,
      });
      return;
    }

    const ahora = Date.now();
    if (reprinting || (ahora - lastPrintTimeRef.current < 1500)) return;
    lastPrintTimeRef.current = ahora;

    setReprinting(true);

    // Toast discreto informativo inicial en la parte superior izquierda
    Swal.fire({
      toast: true,
      position: 'top-start',
      icon: 'info',
      title: `Consultando Pallet #${id}...`,
      text: 'Generando ZPL y comunicando con Zebra...',
      timer: 3000,
      timerProgressBar: true,
      showConfirmButton: false,
    });

    try {
      const res = await impresionService.imprimirPallet(id);
      if (res.exito) {
        const detalle = res.tarima ? ` (${res.tarima}${res.lote ? ` • Lote ${res.lote}` : ''})` : '';
        Swal.fire({
          toast: true,
          position: 'top-start',
          icon: 'success',
          title: '¡Etiqueta Enviada al Cabezal!',
          text: `Pallet #${id}${detalle} enviado a la impresora Zebra.`,
          timer: 3000,
          timerProgressBar: true,
          showConfirmButton: false,
        });
        setFolioInput('');
      } else {
        const es404 = res.mensaje?.toLowerCase().includes('no existe') || res.mensaje?.toLowerCase().includes('no encontrado');
        Swal.fire({
          toast: true,
          position: 'top-start',
          icon: es404 ? 'warning' : 'error',
          title: es404 ? 'Pallet No Encontrado' : 'Aviso de Impresión',
          text: res.mensaje || `No se pudo imprimir el Pallet #${id}.`,
          timer: 3000,
          timerProgressBar: true,
          showConfirmButton: false,
        });
      }
    } catch (err: any) {
      Swal.fire({
        toast: true,
        position: 'top-start',
        icon: 'error',
        title: 'Error de Comunicación',
        text: err?.message || 'Fallo de comunicación con la impresora Zebra.',
        timer: 3000,
        timerProgressBar: true,
        showConfirmButton: false,
      });
    } finally {
      setReprinting(false);
    }
  };

  return (
    <aside 
      className={`
        relative flex flex-col shrink-0 h-screen transition-all duration-200 select-none z-30
        border-r shadow-md
        ${isCollapsed ? 'w-16' : 'w-64'}
      `}
      style={{
        backgroundColor: 'var(--chrome-bg, #0f172a)',
        borderColor: 'var(--chrome-border, #334155)',
        color: 'var(--chrome-text, #f8fafc)',
      }}
    >
      {/* Cabecera del Sidebar: Marca y Versión Oficial */}
      <div 
        className="flex items-center justify-between p-3.5 border-b"
        style={{ borderColor: 'var(--chrome-border, #334155)' }}
      >
        {!isCollapsed ? (
          <div className="flex items-center gap-3 overflow-hidden">
            <div 
              className="w-10 h-10 rounded-2xl flex items-center justify-center font-black text-white shadow-md flex-shrink-0 bg-gradient-to-br from-sky-400 via-blue-600 to-indigo-700 ring-2 ring-sky-300/30"
            >
              <Boxes className="w-5 h-5 text-white drop-shadow-sm" />
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-black text-base tracking-tight leading-tight text-white drop-shadow-sm">
                  Pallets Wipes
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold bg-white/10 text-slate-300 border border-white/15">
                  {APP_CONFIG.version.replace(/Versión\s*/i, 'V')}
                </span>
                {esGerencia ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10.5px] font-black tracking-wider uppercase bg-gradient-to-r from-purple-500 via-indigo-500 to-sky-500 text-white shadow-[0_0_12px_rgba(168,85,247,0.5)] border border-purple-300/40">
                    GERENCIA
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10.5px] font-black tracking-wider uppercase bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-white shadow-[0_0_12px_rgba(16,185,129,0.5)] border border-emerald-300/40">
                    PRODUCCIÓN
                  </span>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="w-full flex flex-col items-center gap-1 py-1">
            <div 
              className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-white shadow-sm bg-gradient-to-br from-sky-400 via-blue-600 to-indigo-700 ring-1 ring-sky-300/30"
              title={`Pallets Wipes - ${esGerencia ? 'Modo Gerencia' : 'Modo Producción'}`}
            >
              <Boxes className="w-5 h-5 text-white" />
            </div>
            <span className={`text-[8.5px] font-black tracking-tight px-1 py-0.5 rounded border ${esGerencia ? 'bg-purple-950/80 text-purple-300 border-purple-500/30' : 'bg-emerald-950/80 text-emerald-300 border-emerald-500/30'}`}>
              {esGerencia ? 'GER' : 'PROD'}
            </span>
          </div>
        )}

        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={`
            p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer
            ${isCollapsed ? 'absolute -right-3 top-4 bg-slate-800 border border-slate-600 shadow-md text-white' : ''}
          `}
          title={isCollapsed ? 'Expandir menú lateral' : 'Colapsar menú lateral'}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navegación Principal */}
      <nav className="flex-1 px-2.5 py-4 space-y-1.5 overflow-y-auto">
        {esGerencia ? (
          <>
            <NavLink
              to="/reportes"
              className={({ isActive }) => `
                flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm transition-all duration-150
                ${isActive 
                  ? 'text-white shadow-xs font-semibold' 
                  : 'text-slate-300 hover:text-white hover:bg-white/5'}
              `}
              style={({ isActive }) => ({
                backgroundColor: isActive ? 'var(--chrome-accent, #3C93CB)' : undefined,
              })}
              title="Reportes de Producción"
            >
              <BarChart3 className="w-5 h-5 shrink-0" />
              {!isCollapsed && <span>Reportes</span>}
            </NavLink>

            <NavLink
              to="/auditoria-asistencia"
              className={({ isActive }) => `
                flex items-center justify-between px-3 py-2.5 rounded-xl font-medium text-sm transition-all duration-150 group
                ${isActive 
                  ? 'text-white shadow-md font-bold' 
                  : 'text-slate-300 hover:text-white hover:bg-white/8'}
              `}
              style={({ isActive }) => ({
                backgroundColor: isActive ? 'var(--chrome-accent, #3C93CB)' : undefined,
              })}
              title="Auditoría de Asistencia por Rango de Fechas"
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <ClipboardCheck className="w-5 h-5 shrink-0 group-hover:scale-110 transition-transform text-cyan-300" />
                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                </div>
                {!isCollapsed && <span>Auditoría Asistencia</span>}
              </div>
              {!isCollapsed && (
                <span className="px-1.5 py-0.5 rounded-md text-[9px] font-mono font-black uppercase tracking-wider bg-purple-950/80 text-purple-200 border border-purple-400/30 shadow-2xs">
                  RANGO
                </span>
              )}
            </NavLink>
          </>
        ) : (
          <>
            <NavLink
              to="/"
              className={({ isActive }) => `
                flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm transition-all duration-150
                ${isActive 
                  ? 'text-white shadow-xs font-semibold' 
                  : 'text-slate-300 hover:text-white hover:bg-white/5'}
              `}
              style={({ isActive }) => ({
                backgroundColor: isActive ? 'var(--chrome-accent, #3C93CB)' : undefined,
              })}
              title="Captura de Pallets"
            >
              <Boxes className="w-5 h-5 shrink-0" />
              {!isCollapsed && <span>Captura de Pallets</span>}
            </NavLink>

            <NavLink
              to="/reportes"
              className={({ isActive }) => `
                flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm transition-all duration-150
                ${isActive 
                  ? 'text-white shadow-xs font-semibold' 
                  : 'text-slate-300 hover:text-white hover:bg-white/5'}
              `}
              style={({ isActive }) => ({
                backgroundColor: isActive ? 'var(--chrome-accent, #3C93CB)' : undefined,
              })}
              title="Reportes de Producción"
            >
              <BarChart3 className="w-5 h-5 shrink-0" />
              {!isCollapsed && <span>Reportes</span>}
            </NavLink>

            <NavLink
              to="/asistencia"
              className={({ isActive }) => `
                flex items-center justify-between px-3 py-2.5 rounded-xl font-medium text-sm transition-all duration-150 group
                ${isActive 
                  ? 'text-white shadow-xs font-semibold' 
                  : 'text-slate-300 hover:text-white hover:bg-white/5'}
              `}
              style={({ isActive }) => ({
                backgroundColor: isActive ? 'var(--chrome-accent, #3C93CB)' : undefined,
              })}
              title="Control de Asistencia en Máquina (TOP 100 Checadas)"
            >
              <div className="flex items-center gap-3">
                <UserCheck className="w-5 h-5 shrink-0 text-cyan-300" />
                {!isCollapsed && <span>Control de Asistencia</span>}
              </div>
              {!isCollapsed && (
                <span className="px-1.5 py-0.5 rounded-md text-[9px] font-mono font-black uppercase tracking-wider bg-black/25 text-emerald-300 border border-emerald-500/30 shadow-2xs">
                  100
                </span>
              )}
            </NavLink>

            <NavLink
              to="/configuracion"
              className={({ isActive }) => `
                flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm transition-all duration-150
                ${isActive 
                  ? 'text-white shadow-xs font-semibold' 
                  : 'text-slate-300 hover:text-white hover:bg-white/5'}
              `}
              style={({ isActive }) => ({
                backgroundColor: isActive ? 'var(--chrome-accent, #3C93CB)' : undefined,
              })}
              title="Configuración de Terminal"
            >
              <Settings className="w-5 h-5 shrink-0" />
              {!isCollapsed && <span>Configuración</span>}
            </NavLink>

            <div className="my-2.5 border-t border-white/10" />

            {/* WIDGET ERGONÓMICO DE REIMPRESIÓN MANUAL POR FOLIO / ID */}
            {!isCollapsed ? (
              <div className="p-3 rounded-2xl bg-gradient-to-b from-sky-950/50 to-slate-900/80 border border-sky-500/30 shadow-md backdrop-blur-md relative overflow-hidden group">
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-cyan-400 via-sky-500 to-blue-600 opacity-80" />

                {/* Encabezado del Widget */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <div className="p-1 rounded-lg bg-sky-500/20 text-cyan-300 border border-sky-400/30">
                      <Printer className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-[11px] font-extrabold tracking-wider text-sky-200 uppercase">
                      Reimpresión
                    </span>
                  </div>
                  <span 
                    className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-black bg-sky-400/20 text-cyan-300 border border-cyan-400/40 shadow-2xs"
                    title="Atajo global: presione F9 en cualquier momento para enfocar este campo"
                  >
                    F9
                  </span>
                </div>

                {/* Input y botón enviar */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    ejecutarReimpresion(folioInput);
                  }}
                  className="relative flex items-center"
                >
                  <input
                    ref={inputFolioRef}
                    type="text"
                    inputMode="numeric"
                    value={folioInput}
                    onChange={(e) => setFolioInput(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="Folio / ID Pallet..."
                    disabled={reprinting}
                    className="w-full pl-2.5 pr-8 py-1.5 rounded-xl bg-slate-900/90 border border-slate-700 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 text-xs font-mono font-bold text-white placeholder:text-slate-500 focus:outline-none transition-all disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={reprinting || !folioInput.trim()}
                    className="absolute right-1 p-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white disabled:opacity-40 disabled:hover:bg-sky-600 transition-all cursor-pointer shadow-2xs"
                    title="Presione Enter para imprimir"
                  >
                    {reprinting ? (
                      <RotateCw className="w-3.5 h-3.5 animate-spin text-white" />
                    ) : (
                      <CornerDownLeft className="w-3.5 h-3.5 text-white" />
                    )}
                  </button>
                </form>

                {/* Guía ergonómica solicitada para los operadores */}
                <div className="mt-1.5 flex items-center justify-between text-[9.5px] text-slate-400 font-medium">
                  <span className="truncate">Ingresa el ID y da <strong className="text-sky-300">Enter</strong></span>
                  <span className="text-[9px] text-cyan-400/90 font-mono font-bold bg-white/5 px-1 py-0.2 rounded" title="Presione F9 para enfocar rápidamente">F9</span>
                </div>
              </div>
            ) : (
              <div className="pt-2 flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => {
                    setIsCollapsed(false);
                    setTimeout(() => {
                      inputFolioRef.current?.focus();
                      inputFolioRef.current?.select();
                    }, 80);
                  }}
                  className="relative p-2.5 rounded-xl bg-sky-950/60 border border-sky-500/30 text-cyan-300 hover:bg-sky-900/60 hover:text-white transition-all shadow-md group cursor-pointer"
                  title="Reimpresión rápida de Pallet por ID (Presione F9)"
                >
                  <Printer className="w-4 h-4 text-cyan-300 group-hover:scale-110 transition-transform" />
                  <span className="absolute -top-1 -right-1 px-1 rounded bg-sky-500 text-slate-950 text-[8px] font-black font-mono">
                    F9
                  </span>
                </button>
              </div>
            )}
          </>
        )}
      </nav>

      {/* Selector de Temas Oficiales MD5 Moderno y Rediseñado */}
      <div className="px-2.5 pb-2">
        {!isCollapsed && (
          <div className="relative">
            <button
              onClick={() => setShowThemePicker(!showThemePicker)}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-slate-200 transition-all cursor-pointer border border-white/10 hover:border-sky-400/40 shadow-xs"
              title="Seleccionar paleta y estilo de cromo visual"
            >
              <div className="flex items-center gap-2.5">
                <div 
                  className="w-4 h-4 rounded-full border border-white/40 shadow-xs flex-shrink-0"
                  style={{ backgroundColor: availableThemes.find(t => t.id === theme)?.color || '#3C93CB' }}
                />
                <div className="flex flex-col text-left">
                  <span className="font-semibold text-xs leading-none">
                    {availableThemes.find(t => t.id === theme)?.name.split(' ')[0]}
                  </span>
                  <span className="text-[9.5px] text-slate-400 mt-0.5">Tema de Cromo</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-slate-400">
                <span className="text-[10px] font-mono font-bold bg-white/10 px-1.5 py-0.5 rounded text-slate-300">{availableThemes.length}</span>
                {showThemePicker ? <ChevronDown className="w-3.5 h-3.5 text-sky-400" /> : <ChevronUp className="w-3.5 h-3.5" />}
              </div>
            </button>

            {showThemePicker && (
              <div 
                className="absolute bottom-full left-0 right-0 mb-2 p-2 bg-slate-900/95 backdrop-blur-xl border border-sky-500/30 rounded-2xl shadow-[0_15px_40px_rgba(0,0,0,0.7)] space-y-1.5 z-50 text-xs ring-1 ring-white/10"
              >
                <div className="px-2.5 py-1.5 border-b border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[10.5px] font-extrabold text-sky-300 uppercase tracking-wider">
                    <Palette className="w-3.5 h-3.5 text-sky-400" />
                    <span>Estilos Kimberly-Clark</span>
                  </div>
                  <span className="text-[9.5px] font-mono text-slate-400">MD5</span>
                </div>

                <div className="space-y-1 max-h-[440px] overflow-y-auto pr-0.5">
                  {availableThemes.map(t => (
                    <button
                      key={t.id}
                      onClick={() => {
                        setTheme(t.id);
                        setShowThemePicker(false);
                      }}
                      className={`
                        w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left transition-all cursor-pointer group
                        ${theme === t.id 
                          ? 'bg-gradient-to-r from-kc-600 to-sky-600 text-white font-bold shadow-xs border border-sky-400/40' 
                          : 'text-slate-300 hover:text-white hover:bg-white/8'}
                      `}
                    >
                      <div className="flex items-center gap-2.5">
                        <div 
                          className="w-3.5 h-3.5 rounded-full border-2 border-white/40 shadow-xs group-hover:scale-110 transition-transform" 
                          style={{ backgroundColor: t.color }} 
                        />
                        <span className="text-xs">{t.name}</span>
                      </div>
                      {theme === t.id && (
                        <CheckCircle2 className="w-4 h-4 text-white drop-shadow-sm" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Pie del Sidebar: Versión Destacada y Novedades */}
      <div 
        ref={releaseNotesRef}
        className="p-3 border-t bg-black/15 relative"
        style={{ borderColor: 'var(--chrome-border, #334155)' }}
      >
        {/* Panel Desplegable de Novedades de la Versión */}
        {showReleaseNotes && (
          <div 
            className={`
              absolute bottom-[calc(100%+8px)] z-50 rounded-xl shadow-2xl border backdrop-blur-md transition-all duration-150 animate-in fade-in slide-in-from-bottom-2
              ${isCollapsed ? 'left-2 w-72' : 'left-2 right-2'}
            `}
            style={{
              backgroundColor: 'var(--chrome-card-bg, #1e293b)',
              borderColor: 'var(--chrome-accent, #3b82f6)',
              color: 'var(--chrome-text, #f8fafc)',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.4)'
            }}
          >
            {/* Cabecera del Panel */}
            <div 
              className="flex items-center justify-between p-3 border-b"
              style={{ borderColor: 'var(--chrome-border, #334155)' }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded-lg bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-400 shrink-0">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <div className="truncate">
                  <h4 className="text-xs font-black tracking-wide text-white truncate">
                    {APP_CONFIG.versionNotesTitle || `Novedades ${APP_CONFIG.version}`}
                  </h4>
                  <p className="text-[10px] text-sky-300 font-mono">
                    Build Oficial MD5 Kimberly-Clark
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowReleaseNotes(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                title="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Lista de Novedades */}
            <div className="p-3 max-h-60 overflow-y-auto space-y-2 text-xs">
              {APP_CONFIG.versionReleaseNotes && APP_CONFIG.versionReleaseNotes.length > 0 ? (
                APP_CONFIG.versionReleaseNotes.map((nota, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-slate-300 leading-snug">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400 mt-1.5 shrink-0 shadow-[0_0_6px_rgba(56,189,248,0.8)]" />
                    <span className="text-[11px] select-text">{nota}</span>
                  </div>
                ))
              ) : (
                <p className="text-[11px] text-slate-400 italic">No hay notas registradas para esta versión.</p>
              )}
            </div>

            {/* Pie del Panel */}
            <div 
              className="px-3 py-2 border-t bg-black/20 flex items-center justify-between text-[10px] text-slate-400"
              style={{ borderColor: 'var(--chrome-border, #334155)' }}
            >
              <span className="font-mono">{APP_CONFIG.appName}</span>
              <span className="font-bold text-sky-400">{APP_CONFIG.version}</span>
            </div>
          </div>
        )}

        {!isCollapsed ? (
          <div className="flex items-center justify-between gap-2">
            {/* Versión en grande y destacada */}
            <div className="flex items-center gap-2.5 min-w-0">
              <div 
                className="relative flex items-center justify-center shrink-0 cursor-pointer"
                onClick={() => setShowReleaseNotes(!showReleaseNotes)}
                title={printerStatus.conectada ? 'Zebra PrintBridge Conectado' : 'Zebra PrintBridge Desconectado'}
              >
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-sky-500/20 to-blue-600/30 border border-sky-400/30 flex items-center justify-center text-sky-400 shadow-sm hover:scale-105 transition-transform">
                  <Info className="w-4 h-4" />
                </div>
                {/* Indicador discreto de estado de impresora */}
                <span 
                  className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-slate-900 ${printerStatus.conectada ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]'}`} 
                  title={printerStatus.conectada ? 'Impresora Térmica En Línea' : 'Impresora Fuera de Línea'}
                />
              </div>

              <button
                onClick={() => setShowReleaseNotes(!showReleaseNotes)}
                className="flex flex-col text-left group min-w-0 cursor-pointer"
                title="Clic para desplegar las novedades de la versión"
              >
                <div className="flex items-baseline gap-1.5 leading-none">
                  <span className="text-sm font-extrabold tracking-tight text-white group-hover:text-sky-300 transition-colors">
                    Versión
                  </span>
                  <span className="text-xl font-black text-cyan-400 group-hover:text-cyan-300 drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]">
                    {APP_CONFIG.version.replace(/[^0-9]/g, '') || APP_CONFIG.version}
                  </span>
                </div>
                <span className="text-[10px] text-sky-400 font-bold group-hover:underline mt-1 truncate">
                  {showReleaseNotes ? 'Ocultar notas' : 'Ver novedades'}
                </span>
              </button>
            </div>

            {/* Botón desplegar/ocultar comentarios de versión */}
            <button
              onClick={() => setShowReleaseNotes(!showReleaseNotes)}
              className={`p-1.5 rounded-lg border transition-all duration-150 shrink-0 cursor-pointer ${
                showReleaseNotes 
                  ? 'bg-sky-500 text-white border-sky-400 shadow-[0_0_10px_rgba(14,165,233,0.5)]' 
                  : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/10 hover:text-white'
              }`}
              title={showReleaseNotes ? 'Ocultar novedades de la versión' : 'Desplegar novedades de la versión'}
              aria-label="Desplegar notas de versión"
            >
              {showReleaseNotes ? (
                <ChevronDown className="w-4 h-4 transition-transform duration-200" />
              ) : (
                <ChevronUp className="w-4 h-4 transition-transform duration-200" />
              )}
            </button>
          </div>
        ) : (
          /* Versión compacta cuando el sidebar está colapsado */
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={() => setShowReleaseNotes(!showReleaseNotes)}
              className="relative p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 hover:border-sky-400/50 transition-all flex flex-col items-center justify-center group cursor-pointer"
              title={`${APP_CONFIG.version} - Clic para ver novedades`}
            >
              <span className="text-xs font-black text-cyan-300 bg-cyan-950/80 px-1.5 py-0.5 rounded border border-cyan-400/40 shadow-xs">
                {APP_CONFIG.version.replace(/Versión\s*/i, 'V')}
              </span>
              <span 
                className={`w-2 h-2 rounded-full mt-1 ${printerStatus.conectada ? 'bg-emerald-500' : 'bg-red-500'}`} 
                title={printerStatus.conectada ? 'Impresora Conectada' : 'Impresora Desconectada'}
              />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};