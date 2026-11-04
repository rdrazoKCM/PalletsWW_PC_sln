import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  UserCheck, 
  RotateCw, 
  Search, 
  Users, 
  Clock, 
  HardDrive, 
  Sparkles,
  CheckCircle2,
  XCircle,
  LayoutGrid,
  List,
  ShieldCheck,
  Activity,
  Fingerprint,
  Zap
} from 'lucide-react';
import { useProduction } from '../context/ProductionContext';
import { asistenciaService } from '../services/asistenciaService';
import type { AsistenciaDto } from '../types';
import { getNombreMaquinaOficial } from '../config';
import { Loading } from '../components/ui/Loading';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';

export const AsistenciaPage: React.FC = () => {
  const { maquinaId, maquinaNombre } = useProduction();

  const [registros, setRegistros] = useState<AsistenciaDto[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [ultimaActualizacion, setUltimaActualizacion] = useState<Date | null>(null);
  const [nombreMaquinaServidor, setNombreMaquinaServidor] = useState<string>('');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [now, setNow] = useState<Date>(new Date());

  // Actualizar segundero relativo cada minuto
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  // Consulta de datos a la API
  const cargarAsistencia = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const res = await asistenciaService.getRegistros(maquinaId > 0 ? maquinaId : undefined);
      if (res.exitoso) {
        setRegistros(res.registros || []);
        setNombreMaquinaServidor(res.nombreMaquina || getNombreMaquinaOficial(maquinaId, maquinaNombre));
        setUltimaActualizacion(new Date());
        setNow(new Date());
      } else {
        setError(res.mensaje || 'No se pudieron consultar los registros de asistencia.');
      }
    } catch (err: any) {
      setError(err?.message || 'Error de comunicación con el servidor.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [maquinaId, maquinaNombre]);

  // Carga inicial al entrar al componente
  useEffect(() => {
    cargarAsistencia();
  }, [cargarAsistencia]);

  // Soporte ergonómico para presionar F5 y refrescar los datos sin recargar el navegador
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F5') {
        e.preventDefault();
        cargarAsistencia(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cargarAsistencia]);

  // Filtro en vivo en memoria
  const registrosFiltrados = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return registros;

    return registros.filter(r => 
      r.noEmp.toString().includes(term) ||
      (r.nombre && r.nombre.toLowerCase().includes(term))
    );
  }, [registros, searchTerm]);

  // Generador de color de avatar según nombre para variedad visual armónica
  const getAvatarGradient = (nombre: string, index: number): string => {
    if (index === 0) return 'from-cyan-400 via-sky-500 to-blue-600';
    const sum = (nombre || '').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const variants = [
      'from-blue-600 to-indigo-700',
      'from-sky-500 to-blue-700',
      'from-teal-500 to-emerald-700',
      'from-indigo-500 to-purple-700',
      'from-cyan-600 to-sky-800',
      'from-slate-700 to-slate-900'
    ];
    return variants[sum % variants.length];
  };

  // Obtener iniciales para el avatar
  const getIniciales = (nombre: string): string => {
    if (!nombre) return 'OP';
    const partes = nombre.trim().split(/\s+/).filter(Boolean);
    if (partes.length === 1) return partes[0].substring(0, 2).toUpperCase();
    return (partes[0][0] + (partes[1] ? partes[1][0] : '')).toUpperCase();
  };

  // Formato de hora limpia
  const formatearHora = (fechaStr: string): string => {
    try {
      const d = new Date(fechaStr);
      if (isNaN(d.getTime())) return fechaStr;
      return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    } catch {
      return fechaStr;
    }
  };

  // Formato de fecha limpia
  const formatearFecha = (fechaStr: string): string => {
    try {
      const d = new Date(fechaStr);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return '';
    }
  };

  // Cálculo de tiempo transcurrido relativo
  const getTiempoRelativo = (fechaStr: string): string => {
    try {
      const d = new Date(fechaStr);
      if (isNaN(d.getTime())) return '';
      const diffMs = now.getTime() - d.getTime();
      if (diffMs < 0) return 'Justo ahora';
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'Hace unos segundos';
      if (diffMins === 1) return 'Hace 1 min';
      if (diffMins < 60) return `Hace ${diffMins} min`;
      const diffHoras = Math.floor(diffMins / 60);
      if (diffHoras === 1) return 'Hace 1 hr';
      if (diffHoras < 24) return `Hace ${diffHoras} hrs`;
      const diffDias = Math.floor(diffHoras / 24);
      return `Hace ${diffDias} d`;
    } catch {
      return '';
    }
  };

  // Primer registro (más reciente)
  const ultimoRegistro = registros.length > 0 ? registros[0] : null;

  return (
    <div className="space-y-4 animate-in fade-in duration-300 select-none pb-6">
      
      {/* ── 1. COCKPIT HERO HEADER (DISEÑO INDUSTRIAL 5.0) ── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-950 via-sky-950 to-slate-900 border border-sky-500/30 shadow-[0_10px_35px_rgba(0,0,0,0.4)] p-4 sm:p-6 text-white">
        
        {/* Glow de fondo decorativo */}
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-64 h-64 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-12 w-80 h-32 rounded-full bg-blue-600/10 blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* Título e Identidad */}
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-400 via-sky-500 to-blue-600 p-0.5 shadow-lg shadow-sky-500/30 flex items-center justify-center shrink-0 ring-2 ring-white/10">
              <div className="w-full h-full bg-slate-950/40 rounded-[14px] flex items-center justify-center backdrop-blur-xs">
                <UserCheck className="w-7 h-7 text-cyan-300 drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 shadow-[0_0_12px_rgba(16,185,129,0.3)]">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>Checador en Línea Activo</span>
                </span>
                <span className="text-[11px] font-mono text-sky-300/80 bg-white/5 px-2 py-0.5 rounded-md border border-white/10">
                  TLX012MXDB • V02
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2">
                <span>Control de Asistencia</span>
              </h1>

              <p className="text-xs sm:text-sm text-slate-300/90 font-medium flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-cyan-400" />
                <span>Terminal Asignada:</span>
                <strong className="text-cyan-300 font-bold">
                  {nombreMaquinaServidor || getNombreMaquinaOficial(maquinaId, maquinaNombre)}
                </strong>
                <span className="text-slate-500">•</span>
                <span className="text-slate-400 text-xs font-mono">C:\ArchivosBitacoraAut\Maquina.txt</span>
              </p>
            </div>
          </div>

          {/* Acciones Rápidas de Cabecera */}
          <div className="flex items-center gap-2.5 self-start md:self-center">
            {ultimaActualizacion && (
              <div className="hidden lg:flex flex-col text-right pr-2">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                  Última Consulta
                </span>
                <span className="text-xs font-mono font-bold text-cyan-300">
                  {ultimaActualizacion.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
            )}

            <button
              type="button"
              onClick={() => cargarAsistencia(true)}
              disabled={refreshing || loading}
              className="relative px-4 py-2.5 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-cyan-500 via-sky-600 to-blue-700 hover:from-cyan-400 hover:to-blue-600 active:scale-95 transition-all shadow-[0_0_20px_rgba(14,165,233,0.4)] border border-cyan-300/40 flex items-center gap-2 cursor-pointer disabled:opacity-50"
              title="Presione para recargar manualmente los últimos 100 registros (Atajo: F5)"
            >
              <RotateCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span>{refreshing ? 'Actualizando...' : 'Actualizar'}</span>
              <span className="px-1.5 py-0.5 rounded bg-black/30 font-mono text-[10px] text-cyan-200 border border-white/20">
                F5
              </span>
            </button>
          </div>

        </div>
      </div>

      {/* ── 2. KPI CARDS ESTILO COCKPIT HOLOGRÁFICO ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        
        {/* Card 1: Gafete Más Reciente (Hero Card) */}
        <div className="relative overflow-hidden rounded-2xl p-4 bg-gradient-to-br from-slate-900 via-slate-850 to-sky-950 border border-sky-400/30 shadow-md text-white group hover:border-cyan-400/50 transition-all">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-400 via-sky-500 to-blue-600" />
          
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-400/30">
                <Sparkles className="w-3.5 h-3.5" />
              </span>
              <span className="text-[10.5px] font-extrabold uppercase tracking-widest text-cyan-300">
                Último Colaborador Leído
              </span>
            </div>
            {ultimoRegistro && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                {getTiempoRelativo(ultimoRegistro.fecha)}
              </span>
            )}
          </div>

          {ultimoRegistro ? (
            <div className="flex items-center gap-3.5 mt-1">
              <div className="relative">
                <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-cyan-400 via-sky-500 to-blue-700 flex items-center justify-center text-white font-black text-base shadow-md ring-2 ring-cyan-300/40 shrink-0">
                  {getIniciales(ultimoRegistro.nombre)}
                </div>
                <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-slate-900 shadow-xs" />
              </div>

              <div className="min-w-0 flex-1">
                <h3 className="text-base sm:text-lg font-black text-white leading-tight uppercase truncate">
                  {ultimoRegistro.nombre}
                </h3>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="px-2 py-0.5 rounded-md text-xs font-mono font-black bg-cyan-950/80 text-cyan-300 border border-cyan-500/40 shadow-inner">
                    Nómina: #{ultimoRegistro.noEmp}
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-300 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-cyan-400" />
                    {formatearHora(ultimoRegistro.fecha)}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-4 text-center text-xs text-slate-400 italic">
              Sin lecturas registradas en esta terminal
            </div>
          )}
        </div>

        {/* Card 2: Capacidad y Velocidad (Límite 100) */}
        <div className="relative overflow-hidden rounded-2xl p-4 bg-white border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[10.5px] font-extrabold uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-kc-600" />
                Registros en Memoria
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-black text-slate-900 tracking-tight tabular-nums">
                  {registros.length}
                </span>
                <span className="text-xs font-bold text-slate-500">de 100 máx. (TOP 100)</span>
              </div>
            </div>
            <div className="p-3 rounded-2xl bg-sky-50 text-kc-600 border border-sky-100">
              <Fingerprint className="w-6 h-6" />
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-500 font-medium flex items-center gap-1">
              <Zap className="w-3 h-3 text-amber-500" />
              Consulta Inmediata
            </span>
            <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
              Ultra Rápido &lt; 30 ms
            </span>
          </div>
        </div>

        {/* Card 3: Máquina y Respaldo Físico */}
        <div className="relative overflow-hidden rounded-2xl p-4 bg-white border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[10.5px] font-extrabold uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-kc-600" />
                Máquina y Configuración
              </span>
              <h3 className="text-lg font-black text-slate-900 tracking-tight mt-1 truncate">
                {nombreMaquinaServidor || getNombreMaquinaOficial(maquinaId, maquinaNombre)}
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Lectura asignada a esta estación
              </p>
            </div>
            <div className="p-3 rounded-2xl bg-slate-100 text-slate-700 border border-slate-200">
              <Activity className="w-6 h-6 text-slate-700" />
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-500 font-mono">
              Filtro: NoMaquina = {maquinaId || 0}
            </span>
            <span className="font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-100 font-mono">
              NOLOCK Activo
            </span>
          </div>
        </div>

      </div>

      {/* ── 3. BARRA DE COMANDO TIPO SPOTLIGHT (BÚSQUEDA Y SWITCH DE VISTA) ── */}
      <div className="bg-white rounded-2xl p-3 border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        
        {/* Input con Icono Luminoso */}
        <div className="relative w-full sm:max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-sky-600 transition-colors" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filtrar por nombre o nómina en tiempo real..."
            className="w-full pl-10 pr-9 py-2 rounded-xl bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 text-sm font-medium text-slate-800 placeholder:text-slate-400 transition-all outline-none"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer p-0.5"
              title="Limpiar filtro"
            >
              <XCircle className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Contador y Switch de Vista (Tabla vs Credenciales) */}
        <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
          <span className="text-xs font-medium text-slate-500">
            Mostrando <strong className="font-bold text-slate-900 tabular-nums">{registrosFiltrados.length}</strong> de <strong className="tabular-nums">{registros.length}</strong>
          </span>

          {/* Toggle de Modo de Vista */}
          <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200/80">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer
                ${viewMode === 'table' 
                  ? 'bg-white text-kc-600 shadow-xs border border-slate-200/70' 
                  : 'text-slate-500 hover:text-slate-900'}
              `}
              title="Vista de Tabla Detallada"
            >
              <List className="w-3.5 h-3.5" />
              <span>Tabla</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer
                ${viewMode === 'cards' 
                  ? 'bg-white text-kc-600 shadow-xs border border-slate-200/70' 
                  : 'text-slate-500 hover:text-slate-900'}
              `}
              title="Vista de Credenciales / Gafetes"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Gafetes</span>
            </button>
          </div>
        </div>

      </div>

      {/* ── 4. CONTENIDO PRINCIPAL: ESTADOS Y VISTAS ── */}
      {loading ? (
        <div className="p-16 flex flex-col items-center justify-center text-center bg-white rounded-3xl border border-slate-200 shadow-sm">
          <Loading />
          <p className="text-sm font-bold text-slate-700 mt-4">
            Consultando registros de asistencia en TLX012MXDB...
          </p>
          <span className="text-xs text-slate-400 mt-1 font-mono">
            Procedimiento pa_P007_002_LlenardgvComidasV02
          </span>
        </div>
      ) : error ? (
        <ErrorState
          title="Fallo al Consultar Asistencia"
          message={error}
          onRetry={() => cargarAsistencia(false)}
        />
      ) : registrosFiltrados.length === 0 ? (
        <EmptyState
          icon={<UserCheck className="w-8 h-8 text-slate-400" />}
          title={searchTerm ? 'No se encontraron colaboradores' : 'Sin registros de asistencia'}
          description={
            searchTerm
              ? `No se encontró ningún registro que coincida con "${searchTerm}".`
              : 'Esta máquina aún no cuenta con pases de tarjeta registrados.'
          }
        />
      ) : viewMode === 'table' ? (
        
        /* ── MODO 1: TABLA PRO INDUSTRIAL CON EFECTO GLASS ── */
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white text-[11px] font-black uppercase tracking-wider border-b border-slate-800">
                  <th className="py-3 px-4 w-14 text-center">#</th>
                  <th className="py-3 px-4 w-32">Nómina</th>
                  <th className="py-3 px-4">Colaborador / Operador</th>
                  <th className="py-3 px-4 w-44">Hora de Lectura</th>
                  <th className="py-3 px-4 w-36">Tiempo Relativo</th>
                  <th className="py-3 px-4 w-32 text-center">Máquina</th>
                  <th className="py-3 px-4 w-28 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {registrosFiltrados.map((item, index) => {
                  const esElMasReciente = index === 0 && !searchTerm;
                  const gradient = getAvatarGradient(item.nombre, index);
                  
                  return (
                    <tr 
                      key={`${item.noEmp}-${item.fecha}-${index}`}
                      className={`
                        transition-all duration-150 group
                        ${esElMasReciente 
                          ? 'bg-sky-50/70 hover:bg-sky-100/70 font-medium border-l-4 border-l-cyan-500' 
                          : 'hover:bg-slate-50/80 border-l-4 border-l-transparent'}
                      `}
                    >
                      {/* Número consecutivo formateado a 3 dígitos (#001) */}
                      <td className="py-3 px-4 text-center text-xs font-mono font-bold text-slate-400 tabular-nums">
                        {String(index + 1).padStart(3, '0')}
                      </td>

                      {/* No. Nómina estilo Chip */}
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-mono font-black tracking-wider bg-slate-100 text-slate-800 border border-slate-200 group-hover:bg-white group-hover:border-sky-300 transition-colors shadow-2xs">
                          #{item.noEmp}
                        </span>
                      </td>

                      {/* Colaborador con Avatar en Gradiente */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div 
                            className={`
                              w-9 h-9 rounded-xl bg-gradient-to-br ${gradient} text-white flex items-center justify-center text-xs font-black shrink-0 shadow-xs ring-1 ring-black/10 group-hover:scale-105 transition-transform
                            `}
                          >
                            {getIniciales(item.nombre)}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="font-bold text-slate-900 leading-tight uppercase truncate">
                              {item.nombre}
                            </span>
                            {esElMasReciente && (
                              <span className="text-[10px] text-cyan-700 font-extrabold tracking-wide uppercase mt-0.5 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-ping" />
                                Pase más reciente
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Hora y Fecha Exacta */}
                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          <span className="font-mono font-bold text-slate-900 text-sm tabular-nums flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-sky-600" />
                            {formatearHora(item.fecha)}
                          </span>
                          <span className="text-[11px] text-slate-500 font-medium">
                            {formatearFecha(item.fecha)}
                          </span>
                        </div>
                      </td>

                      {/* Tiempo Relativo Dinámico */}
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium text-slate-600 bg-slate-100/80 border border-slate-200">
                          {getTiempoRelativo(item.fecha)}
                        </span>
                      </td>

                      {/* Máquina */}
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200 font-mono">
                          {getNombreMaquinaOficial(item.noMaquina || maquinaId, `Línea ${item.noMaquina || maquinaId}`)}
                        </span>
                      </td>

                      {/* Estado */}
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100/80 text-emerald-800 border border-emerald-200 shadow-2xs">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>OK</span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      ) : (
        
        /* ── MODO 2: GRID DE CREDENCIALES / GAFETES HOLOGRÁFICOS ── */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
          {registrosFiltrados.map((item, index) => {
            const esElMasReciente = index === 0 && !searchTerm;
            const gradient = getAvatarGradient(item.nombre, index);

            return (
              <div 
                key={`${item.noEmp}-${item.fecha}-${index}`}
                className={`
                  relative overflow-hidden rounded-2xl p-4 bg-white border transition-all duration-200 group
                  hover:-translate-y-0.5 hover:shadow-lg
                  ${esElMasReciente 
                    ? 'border-cyan-400 ring-2 ring-cyan-400/20 shadow-md bg-gradient-to-b from-sky-50/50 to-white' 
                    : 'border-slate-200 shadow-sm'}
                `}
              >
                {/* Header del Gafete */}
                <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-100">
                  <span className="text-[10px] font-black font-mono tracking-wider text-slate-400 uppercase">
                    REGISTRO #{String(index + 1).padStart(3, '0')}
                  </span>
                  {esElMasReciente ? (
                    <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-cyan-500 text-white shadow-xs">
                      Reciente
                    </span>
                  ) : (
                    <span className="text-[10px] font-medium text-slate-400">
                      {getTiempoRelativo(item.fecha)}
                    </span>
                  )}
                </div>

                {/* Perfil del Colaborador */}
                <div className="flex items-center gap-3">
                  <div 
                    className={`
                      w-12 h-12 rounded-2xl bg-gradient-to-br ${gradient} text-white flex items-center justify-center font-black text-sm shadow-md ring-2 ring-white shrink-0 group-hover:scale-105 transition-transform
                    `}
                  >
                    {getIniciales(item.nombre)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-black text-slate-900 text-sm uppercase leading-tight truncate" title={item.nombre}>
                      {item.nombre}
                    </h4>
                    <span className="inline-block mt-1 px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700 font-mono text-[11px] font-bold">
                      Nómina: #{item.noEmp}
                    </span>
                  </div>
                </div>

                {/* Footer del Gafete con Hora y Máquina */}
                <div className="mt-3.5 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-1 font-mono font-bold text-slate-900 text-xs">
                    <Clock className="w-3 h-3 text-sky-600" />
                    <span>{formatearHora(item.fecha)}</span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                    {getNombreMaquinaOficial(item.noMaquina || maquinaId, `L${item.noMaquina || maquinaId}`)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};
