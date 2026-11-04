import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  BarChart3, 
  Printer, 
  Download, 
  FileSpreadsheet,
  Search, 
  Boxes, 
  CheckCircle2, 
  AlertOctagon, 
  Clock, 
  Calendar, 
  Cpu, 
  Layers, 
  Radio, 
  User, 
  RotateCw, 
  Inbox,
  Tag
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Swal from 'sweetalert2';
import { useProduction } from '../context/ProductionContext';
import { palletsService } from '../services/palletsService';
import { catalogosService } from '../services/catalogosService';
import type { 
  ReporteConciliacionResponseDto, 
  ReporteConciliacionItemDto, 
  MaquinaDto 
} from '../types';

// Catálogo estricto de las 7 máquinas operativas de Planta Wipes (TXWW1 a TXWW7)
const MAQUINAS_OFICIALES_TL: Record<number, string> = {
  9: 'TXWW1',
  16: 'TXWW2',
  53: 'TXWW3',
  54: 'TXWW4',
  55: 'TXWW5',
  67: 'TXWW6',
  70: 'TXWW7'
};

const MAQUINAS_OFICIALES_LISTA: MaquinaDto[] = [
  { noMaquina: 9, descripcionMaquina: 'TXWW1' },
  { noMaquina: 16, descripcionMaquina: 'TXWW2' },
  { noMaquina: 53, descripcionMaquina: 'TXWW3' },
  { noMaquina: 54, descripcionMaquina: 'TXWW4' },
  { noMaquina: 55, descripcionMaquina: 'TXWW5' },
  { noMaquina: 67, descripcionMaquina: 'TXWW6' },
  { noMaquina: 70, descripcionMaquina: 'TXWW7' }
];

export const ReportesPage: React.FC = () => {
  const { maquinaId } = useProduction();

  // ─── ESTADOS DE FILTRO ──────────────────────────────────────────────────────────
  const [maquinas, setMaquinas] = useState<MaquinaDto[]>(MAQUINAS_OFICIALES_LISTA);
  const [selectedMaquina, setSelectedMaquina] = useState<number>(() => {
    return maquinaId && MAQUINAS_OFICIALES_TL[maquinaId] ? maquinaId : 9;
  });
  const [selectedTurno, setSelectedTurno] = useState<number>(1);
  const [selectedFecha, setSelectedFecha] = useState<string>(() => {
    const hoy = new Date();
    const yyyy = hoy.getFullYear();
    const mm = String(hoy.getMonth() + 1).padStart(2, '0');
    const dd = String(hoy.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });
  const [selectedLinea, setSelectedLinea] = useState<number>(0); // 0 = Todas

  // ─── ESTADOS DE DATOS Y CARGA ──────────────────────────────────────────────────
  const [cargando, setCargando] = useState<boolean>(false);
  const [reporte, setReporte] = useState<ReporteConciliacionResponseDto | null>(null);
  const [filtroEstado, setFiltroEstado] = useState<'TODOS' | 'PENDIENTES' | 'ENTREGADOS'>('TODOS');
  const [busqueda, setBusqueda] = useState<string>('');

  // Cargar lista de máquinas al montar (filtrando exclusivamente TL01 a TL07)
  useEffect(() => {
    let cancel = false;
    catalogosService.getMaquinas()
      .then(res => {
        if (!cancel && res && res.length > 0) {
          const filtradas = res
            .filter(m => MAQUINAS_OFICIALES_TL[m.noMaquina] !== undefined)
            .map(m => ({
              ...m,
              descripcionMaquina: MAQUINAS_OFICIALES_TL[m.noMaquina] || m.descripcionMaquina
            }));

          const listaFinal = filtradas.length > 0 ? filtradas : MAQUINAS_OFICIALES_LISTA;
          setMaquinas(listaFinal);

          if (maquinaId && listaFinal.some(m => m.noMaquina === maquinaId)) {
            setSelectedMaquina(maquinaId);
          } else {
            setSelectedMaquina(listaFinal[0].noMaquina);
          }
        } else if (!cancel) {
          setMaquinas(MAQUINAS_OFICIALES_LISTA);
          setSelectedMaquina(maquinaId && MAQUINAS_OFICIALES_TL[maquinaId] ? maquinaId : 1);
        }
      })
      .catch(err => {
        console.warn('Aviso al cargar máquinas para reporte:', err);
        if (!cancel) {
          setMaquinas(MAQUINAS_OFICIALES_LISTA);
          setSelectedMaquina(maquinaId && MAQUINAS_OFICIALES_TL[maquinaId] ? maquinaId : 1);
        }
      });

    return () => { cancel = true; };
  }, [maquinaId]);

  // Consultar reporte de conciliación
  const consultarReporte = useCallback(async () => {
    if (!selectedMaquina || selectedMaquina <= 0) return;
    setCargando(true);
    try {
      const data = await palletsService.obtenerReporteConciliacion(
        selectedMaquina,
        selectedTurno,
        selectedFecha,
        selectedLinea > 0 ? selectedLinea : undefined
      );
      setReporte(data);
    } catch (err: any) {
      console.error('Error al consultar conciliación:', err);
      Swal.fire({
        icon: 'error',
        title: 'Error de Consulta',
        text: err.message || 'No fue posible obtener el reporte de conciliación.',
        confirmButtonColor: '#0047AB',
      });
    } finally {
      setCargando(false);
    }
  }, [selectedMaquina, selectedTurno, selectedFecha, selectedLinea]);

  // Ejecutar primera consulta automática cuando se defina la máquina
  useEffect(() => {
    if (selectedMaquina > 0) {
      consultarReporte();
    }
  }, [selectedMaquina, consultarReporte]);

  // ─── FILTRADO DINÁMICO DE ITEMS ────────────────────────────────────────────────
  const itemsFiltrados = useMemo(() => {
    if (!reporte?.items) return [];

    let list = reporte.items;

    // Filtro por Estado de Almacén
    if (filtroEstado === 'PENDIENTES') {
      list = list.filter(i => !i.esEntregado);
    } else if (filtroEstado === 'ENTREGADOS') {
      list = list.filter(i => i.esEntregado);
    }

    // Buscador en tiempo real
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase().trim();
      list = list.filter(i => 
        String(i.idtblPallets).includes(q) ||
        (i.noTarima || '').toLowerCase().includes(q) ||
        String(i.folioVale).includes(q) ||
        (i.claveProducto || '').toLowerCase().includes(q) ||
        (i.descripcionProducto || '').toLowerCase().includes(q) ||
        (i.nombreOperador || '').toLowerCase().includes(q) ||
        (i.folioRecepcionAlmacen && String(i.folioRecepcionAlmacen).includes(q)) ||
        (i.nombreSupAlmacen || '').toLowerCase().includes(q)
      );
    }

    return list;
  }, [reporte, filtroEstado, busqueda]);

  // ─── AGRUPACIÓN POR CLAVE DE PRODUCTO (Patrón Pallets WW) ──────────────────────
  const gruposPorClave = useMemo(() => {
    const map = new Map<string, ReporteConciliacionItemDto[]>();
    itemsFiltrados.forEach(item => {
      const clave = item.claveProducto || 'SIN_CLAVE';
      if (!map.has(clave)) {
        map.set(clave, []);
      }
      map.get(clave)!.push(item);
    });
    return Array.from(map.entries());
  }, [itemsFiltrados]);

  // Nombre de máquina legible
  const getNombreMaquina = (num: number) => {
    const m = maquinas.find(x => x.noMaquina === num);
    return m ? `${m.noMaquina} - ${m.descripcionMaquina}` : `Máquina ${num}`;
  };

  // ─── EXPORTAR A PDF PROFESIONAL KIMBERLY-CLARK ─────────────────────────────────
  const exportarPdf = () => {
    if (!reporte || reporte.items.length === 0) {
      Swal.fire({
        icon: 'info',
        title: 'Sin Datos',
        text: 'No hay datos de producción para generar el PDF.',
        confirmButtonColor: '#0047AB',
      });
      return;
    }

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });

    // Membrete Oficial KCC
    doc.setFillColor(0, 71, 171); // #0047AB kc-600
    doc.rect(0, 0, 279, 18, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('KIMBERLY-CLARK DE MÉXICO • PLANTA TLAXCALA', 14, 8);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Departamento de Producción de Pañal | Conciliación de Pallets Producidos vs. Entregas a Almacén PT', 14, 14);

    // Metadata del Turno
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(`Máquina: ${getNombreMaquina(reporte.noMaquina)}`, 14, 25);
    doc.text(`Turno: ${reporte.turno} (Tripulación: ${reporte.tripulacion || '--'})`, 110, 25);
    doc.text(`Fecha: ${reporte.fecha ? new Date(reporte.fecha).toLocaleDateString('es-MX') : selectedFecha}`, 200, 25);

    doc.setFont('helvetica', 'normal');
    doc.text(`Supervisor Producción: ${reporte.nombreSupervisor || 'Sin Asignar'}`, 14, 30);
    doc.text(`Línea Empaque: ${selectedLinea > 0 ? `Línea ${selectedLinea}` : 'Todas las Líneas'}`, 110, 30);
    doc.text(`Conciliación: ${reporte.porcentajeCumplimiento}% (${reporte.totalPalletsEntregados}/${reporte.totalPalletsProducidos} pallets)`, 200, 30);

    // Resumen Ejecutivo en línea
    doc.setFillColor(241, 245, 249);
    doc.rect(14, 33, 251, 8, 'F');
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`TOTAL PRODUCIDO: ${reporte.totalPalletsProducidos} Pallets (${reporte.totalCajasProducidas} Cajas)`, 18, 38);
    doc.setTextColor(22, 163, 74);
    doc.text(`RECIBIDO EN ALMACÉN: ${reporte.totalPalletsEntregados} Pallets (${reporte.totalCajasEntregadas} Cajas)`, 105, 38);
    doc.setTextColor(220, 38, 38);
    doc.text(`PENDIENTE EN PISO: ${reporte.totalPalletsPendientes} Pallets (${reporte.totalCajasPendientes} Cajas)`, 195, 38);

    // Tabla de Datos
    const tableBody = itemsFiltrados.map((it, idx) => [
      String(idx + 1),
      String(it.idtblPallets),
      it.noTarima || '--',
      it.horaProduccion || '--',
      String(it.folioVale),
      String(it.totalCajas),
      String(it.lineaEmpaque || 1),
      it.claveProducto || '--',
      it.descripcionProducto || '--',
      it.nombreOperador || '--',
      it.esEntregado ? 'ENTREGADO' : 'PENDIENTE',
      it.esEntregado 
        ? `Rec. #${it.folioRecepcionAlmacen || '--'} | ${it.fechaHoraEntregaAlmacen ? new Date(it.fechaHoraEntregaAlmacen).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : '--'} | Sup: ${it.nombreSupAlmacen || '--'}`
        : 'Pendiente en piso de planta'
    ]);

    autoTable(doc, {
      startY: 44,
      head: [['#', 'ID Pallet', 'No. Tarima', 'Hora', 'Vale', 'Cajas', 'Lín.', 'Clave', 'Descripción Producto', 'Operador', 'Estado Almacén', 'Detalle Recepción']],
      body: tableBody,
      theme: 'grid',
      headStyles: {
        fillColor: [0, 71, 171],
        textColor: [255, 255, 255],
        fontSize: 7.5,
        fontStyle: 'bold',
        halign: 'center',
      },
      styles: {
        fontSize: 7,
        cellPadding: 1.5,
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 8 },
        1: { halign: 'center', cellWidth: 16, fontStyle: 'bold' },
        2: { halign: 'center', cellWidth: 22, fontStyle: 'bold' },
        3: { halign: 'center', cellWidth: 14 },
        4: { halign: 'center', cellWidth: 16 },
        5: { halign: 'center', cellWidth: 12, fontStyle: 'bold' },
        6: { halign: 'center', cellWidth: 10 },
        7: { halign: 'center', cellWidth: 16 },
        8: { cellWidth: 46 },
        9: { cellWidth: 32 },
        10: { halign: 'center', cellWidth: 22, fontStyle: 'bold' },
        11: { cellWidth: 50 },
      },
      didParseCell: (data) => {
        if (data.section === 'body') {
          const item = itemsFiltrados[data.row.index];
          if (item) {
            if (!item.esEntregado) {
              data.cell.styles.fillColor = [254, 242, 242]; // Rosado alerta
              if (data.column.index === 10) {
                data.cell.styles.textColor = [220, 38, 38];
              }
            } else if (data.column.index === 10) {
              data.cell.styles.textColor = [22, 163, 74];
            }
          }
        }
      },
    });

    // Sección de Firmas de Entrega de Turno
    const finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 14 : 180;
    if (finalY < 195) {
      doc.setDrawColor(100, 116, 139);
      doc.line(30, finalY + 12, 110, finalY + 12);
      doc.line(165, finalY + 12, 245, finalY + 12);

      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text('Supervisor de Producción (Línea de Pañal)', 70, finalY + 16, { align: 'center' });
      doc.text('Supervisor de Almacén Producto Terminado', 205, finalY + 16, { align: 'center' });

      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text('Nombre y Firma de Entrega', 70, finalY + 20, { align: 'center' });
      doc.text('Nombre y Firma de Recepción Física', 205, finalY + 20, { align: 'center' });
    }

    doc.save(`Conciliacion_Panal_M${reporte.noMaquina}_T${reporte.turno}_${selectedFecha}.pdf`);
  };

  // ─── EXPORTAR A EXCEL (CSV) ───────────────────────────────────────────────────
  const exportarCsv = () => {
    if (!reporte || reporte.items.length === 0) return;

    const encabezados = [
      'ID Pallet',
      'No. Tarima',
      'Hora Producción',
      'Folio Vale',
      'Cajas',
      'Línea Empaque',
      'Clave Producto',
      'Descripción Producto',
      'No. Emp. Capturó',
      'Nombre Operador',
      'Estado Almacén',
      'Id Entrega PT',
      'Fecha Recepción Almacén',
      'Leído RFID',
      'Folio Recepción Almacén',
      'Turno Recepción Almacén',
      'Supervisor Almacén'
    ];

    const filas = itemsFiltrados.map(i => [
      i.idtblPallets,
      `"${i.noTarima}"`,
      `"${i.horaProduccion}"`,
      i.folioVale,
      i.totalCajas,
      i.lineaEmpaque,
      `"${i.claveProducto}"`,
      `"${(i.descripcionProducto || '').replace(/"/g, '""')}"`,
      i.noEmpCapturo,
      `"${(i.nombreOperador || '').replace(/"/g, '""')}"`,
      i.esEntregado ? 'ENTREGADO' : 'PENDIENTE EN PISO',
      i.idtblPalletEntregadoPT || '',
      i.fechaHoraEntregaAlmacen ? `"${new Date(i.fechaHoraEntregaAlmacen).toLocaleString('es-MX')}"` : '',
      i.leidoRFID ? 'SI' : 'NO',
      i.folioRecepcionAlmacen || '',
      i.turnoRecepcionAlmacen || '',
      `"${(i.nombreSupAlmacen || '').replace(/"/g, '""')}"`
    ]);

    const contenido = [encabezados.join(','), ...filas.map(f => f.join(','))].join('\r\n');
    const blob = new Blob(['\uFEFF' + contenido], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Conciliacion_Panal_M${reporte.noMaquina}_T${reporte.turno}_${selectedFecha}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Imprimir reporte nativo en navegador
  const imprimirReporte = () => {
    window.print();
  };

  return (
    <div className="space-y-4 max-w-[1600px] mx-auto pb-10 print:p-0 print:space-y-2">
      {/* ─── FILTROS Y CONTROLES PRINCIPALES (Oculto en Impresión) ─────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-3.5 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3 mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-kc-50 text-kc-600 rounded-lg">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 tracking-tight">
                Reporte de Conciliación: Producción vs. Almacén de Producto Terminado (PT)
              </h2>
              <p className="text-xs text-slate-500">
                Auditoría en tiempo real de pallets físicos producidos en máquina de pañal contra entregas consolidadas en almacén.
              </p>
            </div>
          </div>

          {/* Botones de Acción */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Botón Excel (CSV) oculto a petición operativa */}
            <button
              onClick={exportarCsv}
              className="hidden"
              aria-hidden="true"
              tabIndex={-1}
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Excel (CSV)</span>
            </button>

            <button
              onClick={exportarPdf}
              disabled={!reporte || reporte.items.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-800 bg-rose-50 border border-rose-300 rounded-lg hover:bg-rose-100 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs"
              title="Descargar documento PDF oficial con membrete de planta"
            >
              <Download className="w-4 h-4 text-rose-600" />
              <span>PDF Oficial</span>
            </button>

            <button
              onClick={imprimirReporte}
              disabled={true}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-400 bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-not-allowed opacity-50 shadow-2xs pointer-events-none select-none"
              title="Impresión deshabilitada temporalmente"
            >
              <Printer className="w-4 h-4 text-slate-400" />
              <span>Imprimir</span>
            </button>

            <button
              onClick={consultarReporte}
              disabled={cargando}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-kc-600 rounded-lg hover:bg-kc-700 active:scale-98 transition-all cursor-pointer disabled:opacity-60 shadow-xs"
            >
              <RotateCw className={`w-3.5 h-3.5 ${cargando ? 'animate-spin' : ''}`} />
              <span>{cargando ? 'Consultando...' : 'Consultar'}</span>
            </button>
          </div>
        </div>

        {/* Formulario de Parámetros */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {/* Máquina */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1 flex items-center gap-1">
              <Cpu className="w-3.5 h-3.5 text-kc-600" />
              <span>Máquina</span>
            </label>
            <select
              value={selectedMaquina}
              onChange={(e) => setSelectedMaquina(Number(e.target.value))}
              className="w-full text-xs font-semibold bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-kc-500 shadow-2xs"
            >
              {maquinas.map((m) => (
                <option key={m.noMaquina} value={m.noMaquina}>
                  {m.descripcionMaquina} (Máquina {m.noMaquina})
                </option>
              ))}
            </select>
          </div>

          {/* Turno */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-kc-600" />
              <span>Turno</span>
            </label>
            <select
              value={selectedTurno}
              onChange={(e) => setSelectedTurno(Number(e.target.value))}
              className="w-full text-xs font-semibold bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-kc-500 shadow-2xs"
            >
              <option value={1}>Turno 1 (07:00 - 15:00)</option>
              <option value={2}>Turno 2 (15:00 - 23:00)</option>
              <option value={3}>Turno 3 (23:00 - 07:00)</option>
            </select>
          </div>

          {/* Fecha de Producción */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-kc-600" />
              <span>Fecha Producción</span>
            </label>
            <input
              type="date"
              value={selectedFecha}
              onChange={(e) => setSelectedFecha(e.target.value)}
              className="w-full text-xs font-semibold bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-kc-500 shadow-2xs"
            />
          </div>

          {/* Línea de Empaque (Específico Pañal) */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-kc-600" />
              <span>Línea Empaque</span>
            </label>
            <select
              value={selectedLinea}
              onChange={(e) => setSelectedLinea(Number(e.target.value))}
              className="w-full text-xs font-semibold bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-kc-500 shadow-2xs"
            >
              <option value={0}>Todas las Líneas (1 y 2)</option>
              <option value={1}>Línea 1</option>
              <option value={2}>Línea 2</option>
            </select>
          </div>

          {/* Tripulación y Supervisor Detectados */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 flex flex-col justify-center min-w-[220px]">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-semibold">Tripulación:</span>
              <span className="font-mono font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
                {reporte?.tripulacion || '--'}
              </span>
            </div>
            <div className="text-[11px] text-slate-600 mt-1 whitespace-nowrap" title={reporte?.nombreSupervisor}>
              Sup: <span className="font-semibold text-slate-800">{reporte?.nombreSupervisor || 'Sin Asignar'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── ENCABEZADO INSTITUCIONAL DE HOJA (Para Pantalla e Impresión) ─────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 print:border-none print:shadow-none print:p-0">
        <div className="flex flex-wrap items-center justify-between border-b border-slate-200 pb-3 mb-4 gap-2">
          <div>
            <div className="text-sm font-black text-kc-700 uppercase tracking-wider">
              Kimberly-Clark de México • Planta Tlaxcala
            </div>
            <div className="text-xs text-slate-500 font-medium">
              Departamento de Producción de Pañal | Conciliación de Pallets Producidos vs. Entregas a Almacén PT
            </div>
          </div>
          <div className="text-right">
            <span className="inline-block px-3 py-1 bg-kc-50 text-kc-700 font-bold text-xs rounded-full border border-kc-200">
              {getNombreMaquina(selectedMaquina)} • Turno {selectedTurno}
            </span>
            <div className="text-[11px] text-slate-400 mt-0.5 font-medium">
              Fecha: {selectedFecha}
            </div>
          </div>
        </div>

        {/* ─── TARJETAS DE RESUMEN EJECUTIVO (KPIs) ───────────────────────────── */}
        {reporte && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            {/* 1. Total Producido en Línea */}
            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-100/60 transition-colors shadow-2xs">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Total Producido (Línea)
                  </div>
                  <div className="text-2xl font-black text-slate-800 font-mono mt-0.5">
                    {reporte.totalPalletsProducidos} <span className="text-xs font-semibold text-slate-500">Pallets</span>
                  </div>
                  <div className="text-xs font-semibold text-slate-600 mt-0.5">
                    {reporte.totalCajasProducidas.toLocaleString('es-MX')} Cajas totales
                  </div>
                </div>
                <div className="p-2.5 bg-slate-200/70 text-slate-700 rounded-lg">
                  <Boxes className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* 2. Entregado a Almacén PT */}
            <div className="p-3.5 rounded-xl border-2 border-emerald-500 bg-emerald-50/50 hover:bg-emerald-50 transition-colors shadow-2xs">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                    Entregado a Almacén PT
                  </div>
                  <div className="text-2xl font-black text-emerald-800 font-mono mt-0.5">
                    {reporte.totalPalletsEntregados} <span className="text-xs font-semibold text-emerald-600">Pallets</span>
                  </div>
                  <div className="text-xs font-semibold text-emerald-700 mt-0.5">
                    {reporte.totalCajasEntregadas.toLocaleString('es-MX')} Cajas recibidas
                  </div>
                </div>
                <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-lg">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* 3. Pendiente de Entrega en Piso (CRÍTICO) */}
            <div className={`p-3.5 rounded-xl border-2 transition-colors shadow-2xs ${
              reporte.totalPalletsPendientes > 0 
                ? 'border-rose-500 bg-rose-50/60' 
                : 'border-slate-200 bg-slate-50/50'
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className={`text-[11px] font-bold uppercase tracking-wider ${
                    reporte.totalPalletsPendientes > 0 ? 'text-rose-700' : 'text-slate-500'
                  }`}>
                    Pendiente en Piso
                  </div>
                  <div className={`text-2xl font-black font-mono mt-0.5 ${
                    reporte.totalPalletsPendientes > 0 ? 'text-rose-700' : 'text-slate-700'
                  }`}>
                    {reporte.totalPalletsPendientes} <span className="text-xs font-semibold opacity-75">Pallets</span>
                  </div>
                  <div className={`text-xs font-semibold mt-0.5 ${
                    reporte.totalPalletsPendientes > 0 ? 'text-rose-700' : 'text-slate-500'
                  }`}>
                    {reporte.totalCajasPendientes.toLocaleString('es-MX')} Cajas sin entrega
                  </div>
                </div>
                <div className={`p-2.5 rounded-lg ${
                  reporte.totalPalletsPendientes > 0 
                    ? 'bg-rose-100 text-rose-700 animate-pulse' 
                    : 'bg-slate-200 text-slate-500'
                }`}>
                  <AlertOctagon className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* 4. % Cumplimiento de Entrega */}
            <div className="p-3.5 rounded-xl border border-sky-300 bg-sky-50/40 hover:bg-sky-50/70 transition-colors shadow-2xs">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-sky-800">
                    Conciliación del Turno
                  </div>
                  <div className="text-2xl font-black text-sky-900 font-mono mt-0.5">
                    {reporte.porcentajeCumplimiento}%
                  </div>
                  <div className="w-32 bg-slate-200 rounded-full h-2 mt-1.5 overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-500 ${
                        reporte.porcentajeCumplimiento === 100 
                          ? 'bg-emerald-500' 
                          : reporte.porcentajeCumplimiento >= 75 
                            ? 'bg-kc-600' 
                            : 'bg-amber-500'
                      }`}
                      style={{ width: `${Math.min(100, reporte.porcentajeCumplimiento)}%` }}
                    />
                  </div>
                </div>
                <div className="p-2.5 bg-sky-100 text-sky-700 rounded-lg">
                  <BarChart3 className="w-5 h-5" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── CONTROLES DE FILTRADO RÁPIDO (Oculto en Impresión) ─────────────── */}
        {reporte && (
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4 print:hidden">
            {/* Tabs de Filtro */}
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
              <button
                onClick={() => setFiltroEstado('TODOS')}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                  filtroEstado === 'TODOS'
                    ? 'bg-white text-kc-700 shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Todos ({reporte.items.length})
              </button>

              <button
                onClick={() => setFiltroEstado('PENDIENTES')}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-colors cursor-pointer flex items-center gap-1 ${
                  filtroEstado === 'PENDIENTES'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-rose-700 hover:bg-rose-50'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-rose-400"></span>
                <span>Pendientes en Piso ({reporte.totalPalletsPendientes})</span>
              </button>

              <button
                onClick={() => setFiltroEstado('ENTREGADOS')}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-colors cursor-pointer flex items-center gap-1 ${
                  filtroEstado === 'ENTREGADOS'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-emerald-700 hover:bg-emerald-50'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span>Entregados ({reporte.totalPalletsEntregados})</span>
              </button>
            </div>

            {/* Buscador de Texto */}
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar ID, tarima, vale, producto..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-kc-500 shadow-2xs"
              />
            </div>
          </div>
        )}

        {/* ─── ESTADOS DE CARGA Y VACÍO ───────────────────────────────────────── */}
        {cargando ? (
          <div className="py-16 text-center">
            <div className="w-10 h-10 border-4 border-kc-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <div className="text-sm font-bold text-slate-700">Consultando conciliación en bases de datos...</div>
            <div className="text-xs text-slate-500">Cruzando pallets producidos con recepciones de almacén PT.</div>
          </div>
        ) : !reporte || reporte.items.length === 0 ? (
          <div className="py-16 text-center border-2 border-dashed border-slate-200 rounded-xl">
            <Inbox className="w-12 h-12 text-slate-300 mx-auto mb-2" />
            <h4 className="text-sm font-bold text-slate-700">No se encontraron registros de producción</h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              No hay tarimas capturadas para la máquina {selectedMaquina} en el turno {selectedTurno} con fecha {selectedFecha}.
            </p>
          </div>
        ) : gruposPorClave.length === 0 ? (
          <div className="py-12 text-center border border-slate-200 rounded-xl bg-slate-50">
            <Search className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <div className="text-sm font-bold text-slate-700">Sin resultados para el filtro seleccionado</div>
            <div className="text-xs text-slate-500">
              No hay tarimas que coincidan con &quot;{filtroEstado}&quot; o la búsqueda actual.
            </div>
          </div>
        ) : (
          /* ─── BLOQUES DE PALLETS POR CLAVE DE PRODUCTO (Estándar WW) ──────── */
          <div className="space-y-6">
            {gruposPorClave.map(([clave, items]) => {
              const primer = items[0];
              const totalTarimas = items.length;
              const totalCajas = items.reduce((acc, x) => acc + x.totalCajas, 0);
              const entregadas = items.filter(x => x.esEntregado).length;
              const pendientes = items.filter(x => !x.esEntregado).length;

              return (
                <div 
                  key={clave} 
                  className="border border-slate-200 rounded-xl overflow-hidden shadow-xs bg-white"
                >
                  {/* Cabecera del Grupo de Producto */}
                  <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 border-l-4 border-l-kc-600">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-kc-600 text-white rounded text-xs font-mono font-bold shadow-2xs">
                        <Tag className="w-3 h-3" />
                        CLAVE: {clave}
                      </span>
                      <span className="text-xs font-bold text-slate-800">
                        {primer.descripcionProducto || 'Producto Sin Catálogo'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs flex-wrap font-semibold">
                      <span className="px-2 py-0.5 bg-white text-slate-700 border border-slate-200 rounded">
                        {totalTarimas} Tarimas
                      </span>
                      <span className="px-2 py-0.5 bg-white text-slate-700 border border-slate-200 rounded">
                        {totalCajas.toLocaleString('es-MX')} Cajas
                      </span>
                      {pendientes > 0 && (
                        <span className="px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded font-bold">
                          🔴 {pendientes} Pendientes
                        </span>
                      )}
                      {entregadas > 0 && (
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded font-bold">
                          🟢 {entregadas} Entregados
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Tabla de Detalle */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100/80 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                          <th className="py-2.5 px-2 text-center w-10">#</th>
                          <th className="py-2.5 px-2.5 text-center w-24">ID Pallet</th>
                          <th className="py-2.5 px-3 text-center w-28">No. Tarima</th>
                          <th className="py-2.5 px-2 text-center w-16">Hora</th>
                          <th className="py-2.5 px-2 text-center w-16">Vale</th>
                          <th className="py-2.5 px-2 text-center w-14">Cajas</th>
                          <th className="py-2.5 px-2 text-center w-12">Lín.</th>
                          <th className="py-2.5 px-4 min-w-[280px]">Operador</th>
                          <th className="py-2.5 px-3 text-center min-w-[170px]">Estado Almacén PT</th>
                          <th className="py-2.5 px-4 min-w-[340px]">Detalle de Recepción Almacén</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {items.map((it, idx) => {
                          const isDelivered = it.esEntregado;

                          return (
                            <tr 
                              key={it.idtblPallets}
                              className={`
                                transition-colors
                                ${isDelivered 
                                  ? 'bg-white hover:bg-slate-50/80 border-l-4 border-l-emerald-500' 
                                  : 'bg-rose-50/60 hover:bg-rose-50 border-l-4 border-l-rose-500'
                                }
                              `}
                            >
                              {/* # Secuencial */}
                              <td className="py-2.5 px-2 text-center text-slate-400 font-mono text-[11px]">
                                {idx + 1}
                              </td>

                              {/* ID Pallet */}
                              <td className="py-2.5 px-2.5 text-center font-mono font-bold">
                                <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-800 text-[11px]">
                                  {it.idtblPallets}
                                </span>
                              </td>

                              {/* No. Tarima */}
                              <td className={`py-2.5 px-3 text-center font-mono font-bold text-xs ${
                                isDelivered ? 'text-kc-700' : 'text-rose-700'
                              }`}>
                                {it.noTarima}
                              </td>

                              {/* Hora Producción */}
                              <td className="py-2.5 px-2 text-center font-mono text-slate-700 text-xs">
                                {it.horaProduccion || '--'}
                              </td>

                              {/* Folio Vale */}
                              <td className="py-2.5 px-2 text-center font-mono text-slate-600 text-xs">
                                {it.folioVale}
                              </td>

                              {/* Cajas */}
                              <td className="py-2.5 px-2 text-center font-mono font-black text-slate-900 text-xs">
                                {it.totalCajas}
                              </td>

                              {/* Línea Empaque */}
                              <td className="py-2.5 px-2 text-center font-mono text-xs">
                                <span className="px-1.5 py-0.5 rounded bg-sky-50 text-sky-800 border border-sky-200 font-bold">
                                  {it.lineaEmpaque || 1}
                                </span>
                              </td>

                              {/* Operador */}
                              <td className="py-2.5 px-4 text-slate-700 font-medium" title={it.nombreOperador}>
                                <div className="flex items-center gap-1.5 text-xs whitespace-nowrap">
                                  <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  <span className="font-semibold text-slate-800">{it.nombreOperador || `Emp #${it.noEmpCapturo}`}</span>
                                </div>
                              </td>

                              {/* Estado Almacén (Visual Inmediato) */}
                              <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                {isDelivered ? (
                                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-600 text-white rounded-full text-[11px] font-bold shadow-2xs">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>ENTREGADO</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-rose-600 text-white rounded-full text-[11px] font-bold shadow-2xs">
                                    <AlertOctagon className="w-3.5 h-3.5" />
                                    <span>PENDIENTE EN PISO</span>
                                  </span>
                                )}
                              </td>

                              {/* Detalle Recepción Almacén */}
                              <td className="py-2.5 px-4 text-xs">
                                {isDelivered ? (
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="px-2 py-0.5 bg-sky-50 text-sky-800 border border-sky-200 rounded font-mono font-bold text-[11px] shrink-0">
                                      Recibo #{it.folioRecepcionAlmacen || '--'}
                                    </span>
                                    <span className="text-slate-500 font-mono text-[11px] shrink-0">
                                      <Clock className="w-3.5 h-3.5 inline mr-1 text-slate-400" />
                                      {it.fechaHoraEntregaAlmacen 
                                        ? new Date(it.fechaHoraEntregaAlmacen).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
                                        : '--:--'}
                                    </span>
                                    {it.leidoRFID && (
                                      <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded font-bold text-[10px] inline-flex items-center gap-0.5 shrink-0">
                                        <Radio className="w-2.5 h-2.5" /> RFID
                                      </span>
                                    )}
                                    <span className="text-slate-600 text-[11px] whitespace-nowrap" title={it.nombreSupAlmacen}>
                                      • Sup: <strong className="text-slate-800">{it.nombreSupAlmacen || 'Sin Asignar'}</strong>
                                    </span>
                                  </div>
                                ) : (
                                  <div className="text-rose-600 font-semibold text-[11px] flex items-center gap-1.5 whitespace-nowrap">
                                    <AlertOctagon className="w-3.5 h-3.5 shrink-0" />
                                    <span>Pendiente de recepción física en almacén de producto terminado</span>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-50 font-bold text-xs text-slate-700 border-t border-slate-200">
                          <td colSpan={5} className="py-2 px-3 text-right text-slate-500">
                            Subtotal Clave {clave}:
                          </td>
                          <td className="py-2 px-2 text-center text-kc-700 font-mono text-sm">
                            {totalCajas.toLocaleString('es-MX')}
                          </td>
                          <td colSpan={4} className="py-2 px-3 text-slate-500 text-[11px]">
                            {totalTarimas} tarimas registradas ({entregadas} entregadas / {pendientes} pendientes)
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              );
            })}

            {/* ─── RESUMEN GENERAL AL PIE (GRAN TOTAL) ────────────────────────── */}
            <div className="p-3.5 bg-slate-100 rounded-xl border border-slate-300 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs font-bold text-slate-700 flex items-center gap-2">
                <span>RESUMEN CONSOLIDADO:</span>
                <span className="px-2 py-0.5 bg-kc-600 text-white rounded text-[11px] font-bold">
                  {gruposPorClave.length} Claves distintas
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs font-semibold text-slate-700">
                <span>
                  Total Tarimas Mostradas: <strong className="font-mono text-slate-900 text-sm">{itemsFiltrados.length}</strong>
                </span>
                <span>
                  Total Cajas Mostradas: <strong className="font-mono text-kc-700 text-sm">{itemsFiltrados.reduce((acc, x) => acc + x.totalCajas, 0).toLocaleString('es-MX')}</strong>
                </span>
              </div>
            </div>

            {/* ─── SECCIÓN DE FIRMAS PARA ENTREGA DE TURNO (Imprimible) ──────── */}
            <div className="mt-8 pt-4 border-t border-slate-300">
              <div className="grid grid-cols-2 gap-8 text-center">
                <div>
                  <div className="w-3/4 mx-auto border-b border-slate-400 mb-2 mt-8"></div>
                  <div className="text-xs font-bold text-slate-800">
                    {reporte.nombreSupervisor || 'Supervisor de Producción'}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Supervisor de Producción (Línea de Pañal) - Entrega
                  </div>
                </div>

                <div>
                  <div className="w-3/4 mx-auto border-b border-slate-400 mb-2 mt-8"></div>
                  <div className="text-xs font-bold text-slate-800">
                    Supervisor de Almacén PT
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Supervisor de Almacén Producto Terminado - Recepción
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
