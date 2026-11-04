import React, { useState, useMemo, useCallback } from 'react';
import { 
  ClipboardCheck, 
  RotateCw, 
  Search, 
  Users, 
  Calendar, 
  Clock, 
  FileSpreadsheet, 
  Printer, 
  XCircle, 
  ChevronLeft, 
  ChevronRight, 
  Sparkles, 
  CalendarRange, 
  User, 
  CheckCircle2, 
  Filter, 
  LayoutGrid, 
  List
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Swal from 'sweetalert2';
import { asistenciaService } from '../services/asistenciaService';
import type { AsistenciaGerencialItemDto } from '../types';
import { Loading } from '../components/ui/Loading';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';

// Helper para formatear fecha a YYYY-MM-DD local
const formatDateIso = (date: Date): string => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

type PresetTipo = 'hoy' | 'ayer' | 'esta_semana' | 'semana_pasada' | 'ultimos_15' | 'este_mes' | 'custom';

interface PresetItem {
  id: PresetTipo;
  label: string;
}

const PRESETS: PresetItem[] = [
  { id: 'hoy', label: 'Hoy' },
  { id: 'ayer', label: 'Ayer' },
  { id: 'esta_semana', label: 'Esta Semana' },
  { id: 'semana_pasada', label: 'Semana Pasada' },
  { id: 'ultimos_15', label: 'Últimos 15 Días' },
  { id: 'este_mes', label: 'Este Mes' },
];

export const AsistenciaGerencialPage: React.FC = () => {
  // Inicialización de rango por defecto (últimos 7 días)
  const [fechaInicio, setFechaInicio] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return formatDateIso(d);
  });

  const [fechaFin, setFechaFin] = useState<string>(() => {
    return formatDateIso(new Date());
  });

  // Filtro por número de empleado (opcional en backend SP)
  const [noEmpleadoFiltro, setNoEmpleadoFiltro] = useState<string>('');

  // Preset activo seleccionado visualmente
  const [presetActivo, setPresetActivo] = useState<PresetTipo | null>(null);

  // Bandera que indica si el usuario ya realizó al menos una consulta (Lazy Load)
  const [haConsultado, setHaConsultado] = useState<boolean>(false);

  // Estados de datos y respuesta
  const [items, setItems] = useState<AsistenciaGerencialItemDto[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [consultando, setConsultando] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Filtro de texto en vivo (búsqueda dentro de los resultados obtenidos)
  const [busquedaTexto, setBusquedaTexto] = useState<string>('');

  // Modo de visualización: tabla o tarjetas
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  // Paginación
  const [paginaActual, setPaginaActual] = useState<number>(1);
  const elementosPorPagina = 50;

  // Presets rápidos de fechas con ejecución inmediata de consulta y retroalimentación visual
  const aplicarPreset = (tipo: PresetTipo) => {
    const ahora = new Date();
    const inicio = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
    const fin = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());

    switch (tipo) {
      case 'hoy':
        // inicio y fin son hoy
        break;
      case 'ayer':
        inicio.setDate(inicio.getDate() - 1);
        fin.setDate(fin.getDate() - 1);
        break;
      case 'esta_semana': {
        const diaSemana = ahora.getDay();
        const diffLunes = diaSemana === 0 ? -6 : 1 - diaSemana;
        inicio.setDate(inicio.getDate() + diffLunes);
        break;
      }
      case 'semana_pasada': {
        const diaSemana = ahora.getDay();
        const diffLunes = diaSemana === 0 ? -6 : 1 - diaSemana;
        inicio.setDate(inicio.getDate() + diffLunes - 7);
        fin.setTime(inicio.getTime());
        fin.setDate(inicio.getDate() + 6);
        break;
      }
      case 'ultimos_15':
        inicio.setDate(inicio.getDate() - 14);
        break;
      case 'este_mes':
        inicio.setDate(1);
        break;
      default:
        break;
    }

    const fIniStr = formatDateIso(inicio);
    const fFinStr = formatDateIso(fin);
    setFechaInicio(fIniStr);
    setFechaFin(fFinStr);
    setPresetActivo(tipo);

    // Consulta de forma automática al presionar un preset
    consultarDatos(fIniStr, fFinStr, noEmpleadoFiltro);
  };

  // Función principal de consulta (llamada explícita bajo demanda)
  const consultarDatos = useCallback(async (fIni: string, fFin: string, noEmpStr?: string) => {
    if (!fIni || !fFin) {
      Swal.fire({
        icon: 'warning',
        title: 'Rango Incompleto',
        text: 'Por favor seleccione fecha de inicio y fecha final.',
        confirmButtonColor: '#0047AB'
      });
      return;
    }

    if (fIni > fFin) {
      Swal.fire({
        icon: 'warning',
        title: 'Fechas Inválidas',
        text: 'La fecha de inicio no puede ser posterior a la fecha final.',
        confirmButtonColor: '#0047AB'
      });
      return;
    }

    setConsultando(true);
    setLoading(true);
    setError(null);

    const empNum = noEmpStr && noEmpStr.trim() ? parseInt(noEmpStr.trim(), 10) : undefined;

    try {
      const res = await asistenciaService.consultarGerencial(
        fIni, 
        fFin, 
        empNum && !isNaN(empNum) && empNum > 0 ? empNum : undefined
      );

      if (res.exitoso) {
        setItems(res.items || []);
        setPaginaActual(1);
        setHaConsultado(true);
      } else {
        setError(res.mensaje || 'No se pudieron consultar los registros de asistencia gerencial.');
        setItems([]);
        setHaConsultado(true);
      }
    } catch (err: any) {
      setError(err?.message || 'Error de comunicación con el servidor.');
      setItems([]);
      setHaConsultado(true);
    } finally {
      setLoading(false);
      setConsultando(false);
    }
  }, []);

  // Reiniciar estado y volver al centro inicial de búsqueda
  const reiniciarConsulta = () => {
    setHaConsultado(false);
    setItems([]);
    setBusquedaTexto('');
    setError(null);
    setPresetActivo(null);
  };

  // Filtrado en vivo de los datos en memoria
  const itemsFiltrados = useMemo(() => {
    const term = busquedaTexto.trim().toLowerCase();
    if (!term) return items;

    return items.filter(it => 
      it.noEmp.toString().includes(term) ||
      (it.nombre && it.nombre.toLowerCase().includes(term)) ||
      (it.noMaquina && it.noMaquina.toString().includes(term))
    );
  }, [items, busquedaTexto]);

  // Paginación calculada
  const totalPaginas = Math.ceil(itemsFiltrados.length / elementosPorPagina) || 1;
  const itemsPaginados = useMemo(() => {
    const inicio = (paginaActual - 1) * elementosPorPagina;
    return itemsFiltrados.slice(inicio, inicio + elementosPorPagina);
  }, [itemsFiltrados, paginaActual]);

  // KPIs de resumen
  const totalRegistros = itemsFiltrados.length;
  const colaboradoresUnicos = useMemo(() => {
    const setEmp = new Set<number>();
    itemsFiltrados.forEach(it => {
      if (it.noEmp > 0) setEmp.add(it.noEmp);
    });
    return setEmp.size;
  }, [itemsFiltrados]);

  const diasRango = useMemo(() => {
    if (!fechaInicio || !fechaFin) return 1;
    const ini = new Date(fechaInicio);
    const fin = new Date(fechaFin);
    const diff = Math.ceil((fin.getTime() - ini.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return diff > 0 ? diff : 1;
  }, [fechaInicio, fechaFin]);

  const promedioDiario = diasRango > 0 ? Math.round(totalRegistros / diasRango) : totalRegistros;

  // Exportar a Excel (CSV con UTF-8 BOM)
  const exportarCSV = () => {
    if (itemsFiltrados.length === 0) {
      Swal.fire({
        icon: 'info',
        title: 'Sin Datos',
        text: 'No hay registros en la tabla para exportar.',
        confirmButtonColor: '#0047AB'
      });
      return;
    }

    let csv = '\uFEFF'; // UTF-8 BOM para apertura nativa correcta en Excel
    csv += 'ID,NoEmpleado,Colaborador,Fecha,Hora,NoMaquinaLector\r\n';

    itemsFiltrados.forEach(it => {
      let fechaFormatted = '';
      let horaFormatted = '';
      if (it.fecha) {
        const d = new Date(it.fecha);
        if (!isNaN(d.getTime())) {
          fechaFormatted = d.toLocaleDateString('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit' });
          horaFormatted = d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
        } else {
          fechaFormatted = String(it.fecha);
        }
      }

      const nomLimpio = `"${(it.nombre || '').replace(/"/g, '""')}"`;
      csv += `${it.id},${it.noEmp},${nomLimpio},${fechaFormatted},${horaFormatted},${it.noMaquina}\r\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Auditoria_Asistencia_Wipes_${fechaInicio}_al_${fechaFin}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'success',
      title: 'Archivo Excel Generado',
      text: `${itemsFiltrados.length} registros exportados con éxito.`,
      timer: 3000,
      showConfirmButton: false
    });
  };

  // Exportar a PDF Oficial Kimberly-Clark
  const exportarPDF = () => {
    if (itemsFiltrados.length === 0) {
      Swal.fire({
        icon: 'info',
        title: 'Sin Datos',
        text: 'No hay registros para generar el reporte PDF.',
        confirmButtonColor: '#0047AB'
      });
      return;
    }

    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'letter'
      });

      // Cabecera Corporativa KC
      doc.setFillColor(0, 71, 171); // Azul KC-600
      doc.rect(0, 0, 216, 24, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('KIMBERLY-CLARK DE MÉXICO - PLANTA TLAXCALA', 14, 11);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text('Auditoría de Asistencia Gerencial • Departamento Wet Wipes', 14, 18);

      // Metadatos
      doc.setTextColor(51, 65, 85);
      doc.setFontSize(9);
      doc.text(`Rango de Consulta: ${fechaInicio} al ${fechaFin}`, 14, 32);
      doc.text(`Total Checadas: ${totalRegistros}   |   Colaboradores Únicos: ${colaboradoresUnicos}   |   Promedio Diario: ${promedioDiario}`, 14, 38);
      if (noEmpleadoFiltro) {
        doc.text(`Filtro Específico por Empleado: #${noEmpleadoFiltro}`, 14, 44);
        doc.text(`Fecha de Emisión: ${new Date().toLocaleString('es-MX')}`, 14, 50);
      } else {
        doc.text(`Fecha de Emisión: ${new Date().toLocaleString('es-MX')}`, 14, 44);
      }

      // Tabla de datos
      const tableData = itemsFiltrados.map((it, idx) => {
        let fStr = '';
        let hStr = '';
        if (it.fecha) {
          const d = new Date(it.fecha);
          if (!isNaN(d.getTime())) {
            fStr = d.toLocaleDateString('es-MX');
            hStr = d.toLocaleTimeString('es-MX', { hour12: false });
          } else {
            fStr = String(it.fecha);
          }
        }
        return [
          idx + 1,
          it.noEmp,
          it.nombre || 'Sin nombre',
          fStr,
          hStr,
          `Lector ${it.noMaquina || 'Gral'}`,
          `#${it.id}`
        ];
      });

      autoTable(doc, {
        head: [['#', 'No. Emp', 'Nombre del Colaborador', 'Fecha', 'Hora', 'Lector', 'ID']],
        body: tableData,
        startY: noEmpleadoFiltro ? 54 : 48,
        theme: 'striped',
        headStyles: {
          fillColor: [0, 71, 171],
          textColor: [255, 255, 255],
          fontSize: 8.5,
          fontStyle: 'bold'
        },
        styles: {
          fontSize: 8,
          cellPadding: 2,
          textColor: [30, 41, 59]
        },
        columnStyles: {
          0: { cellWidth: 10, halign: 'center' },
          1: { cellWidth: 20, halign: 'center', fontStyle: 'bold' },
          2: { cellWidth: 70 },
          3: { cellWidth: 25, halign: 'center' },
          4: { cellWidth: 22, halign: 'center' },
          5: { cellWidth: 24, halign: 'center' },
          6: { cellWidth: 15, halign: 'right' }
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252]
        }
      });

      doc.save(`Auditoria_Asistencia_Wipes_${fechaInicio}_al_${fechaFin}.pdf`);

      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: 'Reporte PDF Generado',
        text: 'El documento se descargó correctamente.',
        timer: 3000,
        showConfirmButton: false
      });
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: 'Error al Generar PDF',
        text: err?.message || 'Ocurrió un error inesperado al armar el PDF.',
        confirmButtonColor: '#0047AB'
      });
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* ─── CABECERA GERENCIAL MD5 ──────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-5 border border-indigo-500/30 shadow-xl text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-600 to-sky-600 p-0.5 shadow-lg flex-shrink-0">
              <div className="w-full h-full bg-slate-950/80 rounded-[14px] flex items-center justify-center">
                <ClipboardCheck className="w-6 h-6 text-indigo-300" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-black tracking-tight text-white">
                  Auditoría de Asistencia
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-xs border border-purple-300/30">
                  WET WIPES
                </span>
                <span className="hidden sm:inline-flex px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-white/10 text-slate-300 border border-white/15">
                  TLX012MXDB
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 flex items-center gap-2 flex-wrap">
                <span>Consulta histórica y trazabilidad sin restricción de máquina</span>
                <span className="w-1 h-1 rounded-full bg-slate-500" />
                <span className="text-indigo-300 font-semibold">Base de Comidas / Asistencias</span>
              </p>
            </div>
          </div>

          {/* Acciones de Cabecera: Exportaciones */}
          <div className="flex items-center gap-2 self-start md:self-auto">
            {haConsultado && (
              <button
                type="button"
                onClick={reiniciarConsulta}
                className="py-2 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer border border-white/15"
                title="Reiniciar consulta y volver a la pantalla inicial"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Nueva Consulta</span>
              </button>
            )}

            <button
              onClick={exportarCSV}
              disabled={itemsFiltrados.length === 0}
              className="py-2 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
              title="Descargar datos en formato Excel (CSV UTF-8)"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Exportar Excel</span>
            </button>

            <button
              onClick={exportarPDF}
              disabled={itemsFiltrados.length === 0}
              className="py-2 px-3.5 rounded-xl bg-kc-600 hover:bg-kc-500 active:bg-kc-700 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
              title="Generar e imprimir Reporte PDF Oficial"
            >
              <Printer className="w-4 h-4" />
              <span>Reporte PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* ─── BARRA DE PARÁMETROS, PRESETS Y FILTROS ────────────────────────────── */}
      <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-200 space-y-3">
        {/* Presets de 1 Clic con selección dinámica garantizada */}
        <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
            <Sparkles className="w-4 h-4 text-indigo-500" />
            <span>Accesos Rápidos de Rango:</span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {PRESETS.map((p) => {
              const isSelected = presetActivo === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => aplicarPreset(p.id)}
                  className={`
                    px-3 py-1.5 rounded-xl text-xs transition-all cursor-pointer font-bold flex items-center gap-1.5
                    ${isSelected 
                      ? 'bg-indigo-600 text-white shadow-md border border-indigo-600 ring-2 ring-indigo-300/40 scale-102' 
                      : 'bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 border border-slate-200'}
                  `}
                >
                  {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-200" />}
                  <span>{p.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Formulario de Parámetros de Consulta */}
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            consultarDatos(fechaInicio, fechaFin, noEmpleadoFiltro);
          }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end"
        >
          {/* Fecha Inicio (lg:col-span-3) */}
          <div className="lg:col-span-3">
            <label className="block text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-indigo-500" />
              <span>Fecha Inicio</span>
            </label>
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => {
                setFechaInicio(e.target.value);
                setPresetActivo('custom');
              }}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 focus:border-indigo-500 focus:bg-white text-xs font-bold text-slate-800 outline-none transition-all shadow-xs"
            />
          </div>

          {/* Fecha Fin (lg:col-span-3) */}
          <div className="lg:col-span-3">
            <label className="block text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-indigo-500" />
              <span>Fecha Fin</span>
            </label>
            <input
              type="date"
              value={fechaFin}
              onChange={(e) => {
                setFechaFin(e.target.value);
                setPresetActivo('custom');
              }}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 focus:border-indigo-500 focus:bg-white text-xs font-bold text-slate-800 outline-none transition-all shadow-xs"
            />
          </div>

          {/* No. Empleado (Opcional) (lg:col-span-3) */}
          <div className="lg:col-span-3">
            <label className="block text-[11px] font-bold text-slate-600 mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-indigo-500" />
                <span>No. Empleado (Opcional)</span>
              </span>
              {noEmpleadoFiltro && (
                <button
                  type="button"
                  onClick={() => {
                    setNoEmpleadoFiltro('');
                    if (haConsultado) {
                      consultarDatos(fechaInicio, fechaFin, '');
                    }
                  }}
                  className="text-[10px] text-red-500 hover:underline cursor-pointer font-semibold"
                >
                  Limpiar
                </button>
              )}
            </label>
            <div className="relative">
              <input
                type="text"
                inputMode="numeric"
                placeholder="Ej. 58366 (Todos si vacío)"
                value={noEmpleadoFiltro}
                onChange={(e) => setNoEmpleadoFiltro(e.target.value.replace(/[^0-9]/g, ''))}
                className="w-full pl-3 pr-8 py-2 rounded-xl bg-slate-50 border border-slate-300 focus:border-indigo-500 focus:bg-white text-xs font-mono font-bold text-slate-800 outline-none transition-all shadow-xs placeholder:text-slate-400"
              />
              {noEmpleadoFiltro && (
                <button
                  type="button"
                  onClick={() => setNoEmpleadoFiltro('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <XCircle className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Botón Principal Consultar (lg:col-span-3) */}
          <div className="lg:col-span-3">
            <button
              type="submit"
              disabled={consultando}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-kc-600 to-indigo-600 hover:from-kc-700 hover:to-indigo-700 active:from-kc-800 active:to-indigo-800 text-white font-black text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {consultando ? (
                <>
                  <RotateCw className="w-4 h-4 animate-spin" />
                  <span>Consultando Servidor...</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>{noEmpleadoFiltro ? 'Buscar Empleado' : 'Consultar Checadas'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* ─── ESTADO INICIAL SUTIL Y ELEGANTE (SIN TARJETAS PESADAS NI CARGAS PREVIAS) ─── */}
      {!haConsultado && !consultando && !loading && (
        <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-xs text-center relative overflow-hidden">
          <div className="absolute top-0 right-1/4 w-64 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute bottom-0 left-1/4 w-64 h-32 bg-sky-500/5 rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10 max-w-md mx-auto space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center mx-auto shadow-2xs">
              <CalendarRange className="w-6 h-6 text-indigo-600" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900 tracking-tight">
                Consulta de Asistencia Gerencial
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Selecciona las fechas de consulta o presiona un acceso rápido superior. Para agilizar la respuesta, la información se consulta bajo demanda.
              </p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => consultarDatos(fechaInicio, fechaFin, noEmpleadoFiltro)}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-indigo-600 active:bg-indigo-700 text-white text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer group"
              >
                <Search className="w-3.5 h-3.5 text-indigo-300 group-hover:text-white transition-colors" />
                <span>
                  {noEmpleadoFiltro.trim() 
                    ? `Consultar Colaborador #${noEmpleadoFiltro}` 
                    : `Consultar del ${fechaInicio} al ${fechaFin}`}
                </span>
              </button>
            </div>

            <p className="text-[11px] text-slate-400 font-medium">
              💡 Tip: Puedes usar los botones de acceso rápido (Hoy, Ayer, Esta Semana...) para consultar en 1 clic
            </p>
          </div>
        </div>
      )}

      {/* ─── RESULTADOS: CUANDO YA SE CONSULTÓ ─────────────────────────────────── */}
      {haConsultado && (
        <>
          {/* ─── 4 TARJETAS DE KPIS GERENCIALES ────────────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Total Checadas */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0 border border-indigo-100">
                <ClipboardCheck className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Total Checadas
                </span>
                <span className="text-xl font-black text-slate-900 font-mono tabular-nums leading-tight block">
                  {totalRegistros.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Colaboradores Únicos */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center flex-shrink-0 border border-sky-100">
                <Users className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Colaboradores Únicos
                </span>
                <span className="text-xl font-black text-slate-900 font-mono tabular-nums leading-tight block">
                  {colaboradoresUnicos.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Promedio Diario */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0 border border-emerald-100">
                <Clock className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Promedio Diario
                </span>
                <span className="text-xl font-black text-slate-900 font-mono tabular-nums leading-tight block">
                  {promedioDiario.toLocaleString()}
                  <span className="text-[10px] font-sans text-slate-400 ml-1 font-normal">/día</span>
                </span>
              </div>
            </div>

            {/* Días del Rango */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0 border border-purple-100">
                <CalendarRange className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Rango Analizado
                </span>
                <span className="text-xl font-black text-slate-900 font-mono tabular-nums leading-tight block">
                  {diasRango} {diasRango === 1 ? 'Día' : 'Días'}
                </span>
              </div>
            </div>
          </div>

          {/* ─── CONTENEDOR DE DATOS INTERACTIVO CON FILTRO EN VIVO ───────────────── */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
            {/* Barra superior de la tabla: Búsqueda rápida, Switch de Vistas y Paginador */}
            <div className="p-3.5 bg-slate-50/80 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-1 max-w-md">
                <div className="relative w-full">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Filtrar en resultados por nombre o no. empleado..."
                    value={busquedaTexto}
                    onChange={(e) => {
                      setBusquedaTexto(e.target.value);
                      setPaginaActual(1);
                    }}
                    className="w-full pl-9 pr-8 py-1.5 rounded-xl bg-white border border-slate-300 focus:border-indigo-500 text-xs text-slate-800 outline-none transition-all shadow-2xs font-medium"
                  />
                  {busquedaTexto && (
                    <button
                      type="button"
                      onClick={() => setBusquedaTexto('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Switch de Vistas: Tabla vs Tarjetas */}
                <div className="flex items-center bg-slate-200/80 p-0.5 rounded-xl border border-slate-300/60">
                  <button
                    type="button"
                    onClick={() => setViewMode('table')}
                    className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                      viewMode === 'table' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                    }`}
                    title="Vista en Tabla Tabular"
                  >
                    <List className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('cards')}
                    className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                      viewMode === 'cards' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                    }`}
                    title="Vista en Tarjetas de Colaboradores"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Paginador Rápido */}
              <div className="flex items-center gap-3 text-xs text-slate-500 self-end sm:self-auto font-medium">
                <span>
                  Mostrando <strong className="text-slate-800 font-bold">{itemsPaginados.length}</strong> de <strong className="text-slate-800 font-bold">{itemsFiltrados.length}</strong> checadas
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setPaginaActual(p => Math.max(1, p - 1))}
                    disabled={paginaActual === 1}
                    className="p-1 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                    title="Página Anterior"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-2 py-0.5 rounded font-mono font-bold text-slate-700 bg-slate-200/70 text-[11px]">
                    {paginaActual} / {totalPaginas}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPaginaActual(p => Math.min(totalPaginas, p + 1))}
                    disabled={paginaActual >= totalPaginas}
                    className="p-1 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                    title="Página Siguiente"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Aviso de Filtro por Empleado Activo */}
            {noEmpleadoFiltro && (
              <div className="px-4 py-2 bg-indigo-50/80 border-b border-indigo-100 flex items-center justify-between text-xs text-indigo-900 font-semibold">
                <div className="flex items-center gap-2">
                  <Filter className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Resultados focalizados exclusivamente en el colaborador:</span>
                  <span className="px-2 py-0.5 rounded-md bg-indigo-600 text-white font-mono font-black text-[11px]">
                    #{noEmpleadoFiltro}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setNoEmpleadoFiltro('');
                    consultarDatos(fechaInicio, fechaFin, '');
                  }}
                  className="text-xs text-indigo-700 hover:text-indigo-900 underline font-bold cursor-pointer"
                >
                  Ver todos los colaboradores
                </button>
              </div>
            )}

            {/* Cuerpo de Resultados */}
            {loading || consultando ? (
              <div className="p-12">
                <Loading message="Extrayendo auditoría de asistencia desde SQL Server..." />
              </div>
            ) : error ? (
              <div className="p-8">
                <ErrorState
                  title="Error al Consultar Asistencia"
                  message={error}
                  onRetry={() => consultarDatos(fechaInicio, fechaFin, noEmpleadoFiltro)}
                />
              </div>
            ) : itemsFiltrados.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  title="No se encontraron registros de checada"
                  description={`No se encontraron checadas en el rango de ${fechaInicio} al ${fechaFin}${noEmpleadoFiltro ? ` para el empleado #${noEmpleadoFiltro}` : ''}. Pruebe seleccionando otro rango o preset.`}
                />
              </div>
            ) : viewMode === 'table' ? (
              /* ─── VISTA TABULAR DETALLADA ─── */
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100/90 text-slate-600 uppercase text-[10px] tracking-wider border-b border-slate-200 font-extrabold select-none">
                      <th className="py-3 px-3.5 text-center w-12">#</th>
                      <th className="py-3 px-3.5 w-32">No. Empleado</th>
                      <th className="py-3 px-4">Nombre del Colaborador</th>
                      <th className="py-3 px-4 text-center w-32">Fecha</th>
                      <th className="py-3 px-4 text-center w-28">Hora</th>
                      <th className="py-3 px-4 text-center w-36">Lector / Máquina</th>
                      <th className="py-3 px-4 text-right w-24">ID Checada</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {itemsPaginados.map((item, index) => {
                      const globalIdx = (paginaActual - 1) * elementosPorPagina + index + 1;
                      
                      let fStr = '';
                      let hStr = '';
                      if (item.fecha) {
                        const d = new Date(item.fecha);
                        if (!isNaN(d.getTime())) {
                          fStr = d.toLocaleDateString('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit' });
                          hStr = d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
                        } else {
                          fStr = String(item.fecha);
                        }
                      }

                      const initial = (item.nombre || '?').charAt(0).toUpperCase();

                      return (
                        <tr 
                          key={`${item.id}-${index}`}
                          className="hover:bg-indigo-50/40 transition-colors group"
                        >
                          <td className="py-2.5 px-3.5 text-center font-mono text-[11px] text-slate-400 font-bold">
                            {globalIdx}
                          </td>

                          <td className="py-2.5 px-3.5">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md font-mono font-black text-[11px] bg-slate-100 text-slate-800 border border-slate-200 group-hover:bg-indigo-100 group-hover:text-indigo-800 transition-colors">
                              {item.noEmp}
                            </span>
                          </td>

                          <td className="py-2.5 px-4 font-semibold text-slate-900">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-sky-500 text-white font-black text-[10px] flex items-center justify-center shadow-xs flex-shrink-0">
                                {initial}
                              </div>
                              <span className="truncate max-w-xs">{item.nombre || 'Sin Nombre Registrado'}</span>
                            </div>
                          </td>

                          <td className="py-2.5 px-4 text-center font-mono font-bold text-slate-700">
                            {fStr}
                          </td>

                          <td className="py-2.5 px-4 text-center">
                            <span className="inline-flex items-center gap-1 font-mono font-black text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                              <Clock className="w-3 h-3 text-indigo-500" />
                              <span>{hStr || '--:--'}</span>
                            </span>
                          </td>

                          <td className="py-2.5 px-4 text-center">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-sky-50 text-sky-700 border border-sky-200">
                              Lector {item.noMaquina || 'Gral'}
                            </span>
                          </td>

                          <td className="py-2.5 px-4 text-right font-mono text-slate-400 text-[11px]">
                            #{item.id}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              /* ─── VISTA EN TARJETAS DE COLABORADORES ─── */
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {itemsPaginados.map((item, index) => {
                  let fStr = '';
                  let hStr = '';
                  if (item.fecha) {
                    const d = new Date(item.fecha);
                    if (!isNaN(d.getTime())) {
                      fStr = d.toLocaleDateString('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit' });
                      hStr = d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
                    } else {
                      fStr = String(item.fecha);
                    }
                  }

                  const initial = (item.nombre || '?').charAt(0).toUpperCase();

                  return (
                    <div 
                      key={`${item.id}-${index}`}
                      className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all flex flex-col justify-between"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-sky-500 text-white font-black text-xs flex items-center justify-center shadow-xs flex-shrink-0">
                            {initial}
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-bold text-xs text-slate-900 truncate">
                              {item.nombre || 'Sin Nombre Registrado'}
                            </h4>
                            <span className="font-mono text-[11px] text-slate-500 font-bold block">
                              Nómina #{item.noEmp}
                            </span>
                          </div>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                          #{item.id}
                        </span>
                      </div>

                      <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-xs font-mono">
                        <span className="text-slate-600 font-bold">{fStr}</span>
                        <span className="inline-flex items-center gap-1 font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
                          <Clock className="w-3 h-3 text-indigo-500" />
                          <span>{hStr}</span>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pie de Tabla con Controles de Paginación */}
            {itemsFiltrados.length > 0 && (
              <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
                <span>
                  Página <strong>{paginaActual}</strong> de <strong>{totalPaginas}</strong> ({itemsFiltrados.length} checadas encontradas)
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setPaginaActual(p => Math.max(1, p - 1))}
                    disabled={paginaActual === 1}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none cursor-pointer font-semibold text-xs"
                  >
                    Anterior
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaginaActual(p => Math.min(totalPaginas, p + 1))}
                    disabled={paginaActual >= totalPaginas}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none cursor-pointer font-semibold text-xs"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
