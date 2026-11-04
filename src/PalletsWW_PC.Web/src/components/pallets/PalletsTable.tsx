import React, { useState, useRef } from 'react';
// ─── CONSTANTE DE COOLDOWN (homologada con CapturaRow y WW: 1500ms) ─────────────
const COOLDOWN_MS = 1500;

import { 
  Table, 
  Printer, 
  Edit2, 
  Check, 
  X, 
  Loader2, 
  Inbox, 
  PlusCircle,
  FileQuestion
} from 'lucide-react';
import Swal from 'sweetalert2';
import { useProduction } from '../../context/ProductionContext';
import { palletsService } from '../../services/palletsService';
import { impresionService } from '../../services/impresionService';
import { CapturaRow } from './CapturaRow';
import { Button } from '../ui/Button';
import type { PalletDto } from '../../types';

interface PalletsTableProps {
  onOpenNuevoVale: () => void;
}

export const PalletsTable: React.FC<PalletsTableProps> = ({ onOpenNuevoVale }) => {
  const {
    valeSeleccionado,
    pallets,
    loadingPallets,
    ultimoPalletGuardadoId,
    recargarPallets,
    encabezado,
    maquinaId,
    lineaEmpaque,
    lineasEmpaque,
    maxTarimas,
    printerStatus,
  } = useProduction();

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editHora, setEditHora] = useState<string>('');
  const [editCajas, setEditCajas] = useState<string>('');
  const [editLinea, setEditLinea] = useState<string>('');
  const [savingEdit, setSavingEdit] = useState<boolean>(false);
  const [reprintingId, setReprintingId] = useState<number | null>(null);

  // ─── BLINDAJE ANTI-DOBLE CLIC / ANTI-DOBLE ENTER ──────────────────────────────
  // Idéntico al patrón _isSaving + _ultimoGuardadoMomento de WW.
  // useRef para no disparar re-render al actualizar el timestamp.
  const ultimoGuardadoEditRef = useRef<number>(0);
  const ultimoReprintRef = useRef<number>(0);

  const normalizarHora = (input: string): string => {
    if (!input || !input.trim()) return '';
    const s = input.trim();
    if (s.includes(':')) {
      const parts = s.split(':');
      if (parts.length === 2) {
        const h = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        if (!isNaN(h) && !isNaN(m) && h >= 0 && h <= 23 && m >= 0 && m <= 59) {
          return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        }
      }
    }
    const digits = s.replace(/[^0-9]/g, '');
    if (digits.length === 4) {
      const h = parseInt(digits.substring(0, 2), 10);
      const m = parseInt(digits.substring(2, 4), 10);
      if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      }
    } else if (digits.length === 3) {
      const h = parseInt(digits.substring(0, 1), 10);
      const m = parseInt(digits.substring(1, 3), 10);
      if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      }
    } else if (digits.length === 1 || digits.length === 2) {
      const h = parseInt(digits, 10);
      if (h >= 0 && h <= 23) {
        return `${String(h).padStart(2, '0')}:00`;
      }
    }
    return s;
  };

  const startEdit = (p: PalletDto) => {
    if (savingEdit) return;   // No abrir edición si hay una en curso
    const id = (p.idtblPallets || p.idtblPalletsPanal || 0);
    setEditingId(id);
    setEditHora(p.hora ? normalizarHora(p.hora) : '');
    setEditCajas(String(p.totalCajas));
    const lineaActual = String(p.lineaEmpaque || p.linea || '').trim();
    setEditLinea(lineaActual || lineaEmpaque || (lineasEmpaque[0]?.lineaEmpaque || ''));
  };

  const cancelEdit = () => {
    if (savingEdit) return;   // No cancelar si está en medio de un guardado
    setEditingId(null);
    setEditHora('');
    setEditCajas('');
    setEditLinea('');
  };

  // ─── Soporte para guardar edición con Enter / cancelar con Escape ──────────────
  const handleEditKeyDown = (e: React.KeyboardEvent, idtblPallets: number) => {
    if (e.key === 'Enter') {
      if (Swal.isVisible()) {
        e.preventDefault();
        const confirmBtn = Swal.getConfirmButton();
        if (confirmBtn && !confirmBtn.disabled) confirmBtn.click();
        return;
      }
      e.preventDefault();
      saveEdit(idtblPallets);
    } else if (e.key === 'Escape') {
      cancelEdit();
    }
  };

  const saveEdit = async (idtblPallets: number) => {
    // CANDADO BICAPA: flag savingEdit + cooldown 1500ms (idéntico a WW)
    const ahora = Date.now();
    if (savingEdit || (ahora - ultimoGuardadoEditRef.current) < COOLDOWN_MS) return;
    ultimoGuardadoEditRef.current = ahora;

    if (!editCajas || editCajas.trim() === '') {
      Swal.fire({
        icon: 'warning',
        title: 'Cajas Requeridas',
        text: 'El campo de cajas no puede estar en blanco. Ingrese 0 o la cantidad de cajas correspondiente.',
        confirmButtonColor: '#0047AB',
        confirmButtonText: 'Aceptar',
        focusConfirm: true,
        allowEnterKey: true
      });
      return;
    }

    const c = parseInt(editCajas.trim(), 10);
    if (isNaN(c) || c < 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Cajas Inválidas',
        text: 'Ingrese una cantidad válida de cajas (0 o mayor).',
        confirmButtonColor: '#0047AB',
        confirmButtonText: 'Aceptar',
        focusConfirm: true,
        allowEnterKey: true
      });
      return;
    }

    const horaNorm = normalizarHora(editHora);
    if (!horaNorm || !/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(horaNorm)) {
      Swal.fire({
        icon: 'warning',
        title: 'Hora Inválida',
        text: 'Ingrese una hora válida en formato HH:mm (ej. 14:30).',
        confirmButtonColor: '#0047AB',
      });
      return;
    }

    const lineaNorm = editLinea.trim() || lineaEmpaque || (lineasEmpaque[0]?.lineaEmpaque || '1');

    // Validación industrial de colisión: misma hora y misma línea en el mismo vale
    const conflicto = pallets.some(
      (other) =>
        (other.idtblPallets || other.idtblPalletsPanal) !== idtblPallets &&
        normalizarHora(other.hora || '') === horaNorm &&
        String(other.lineaEmpaque || other.linea || '').trim() === lineaNorm
    );

    if (conflicto) {
      Swal.fire({
        icon: 'warning',
        title: 'Conflicto de Tarima',
        text: `Ya existe otra tarima registrada con la hora ${horaNorm} en la Línea ${lineaNorm} en este vale.`,
        confirmButtonColor: '#0047AB',
      });
      return;
    }

    setSavingEdit(true);
    try {
      const res = await palletsService.actualizarPallet({
        idtblPallets,
        totalCajas: c,
        hora: horaNorm,
        linea: lineaNorm,
      });

      if (res.exitoso || res.exito) {
        if (printerStatus.conectada && printerStatus.esCompatible === false) {
          Swal.fire({
            icon: 'info',
            title: 'Tarima Actualizada',
            text: `Se actualizaron los datos (Hora: ${horaNorm}, Cajas: ${c}, Línea: ${lineaNorm}). No se envió etiqueta a imprimir porque la impresora detectada ("${printerStatus.nombre}") no es compatible con Zebra.`,
            confirmButtonColor: '#0047AB',
          });
        } else {
          Swal.fire({
            icon: 'success',
            title: 'Tarima Actualizada',
            text: `Se actualizaron los datos (Hora: ${horaNorm}, Cajas: ${c}, Línea: ${lineaNorm}). Enviando etiqueta al cabezal Zebra...`,
            timer: 1600,
            showConfirmButton: false,
            toast: true,
            position: 'top-end',
          });

          // Reimpresión automática obligatoria al guardar edición
          try {
            await impresionService.imprimirPallet(idtblPallets);
          } catch (printErr: any) {
            console.warn('Aviso al imprimir etiqueta editada:', printErr);
          }
        }
        await recargarPallets();
        setEditingId(null);
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Error al Modificar',
          text: res.mensaje || 'No se pudo actualizar la tarima.',
          confirmButtonColor: '#0047AB',
        });
      }
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: 'Error de Red',
        text: err.message || 'No fue posible actualizar la tarima.',
        confirmButtonColor: '#0047AB',
      });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleReprint = async (idtblPallets: number) => {
    // CANDADO ANTI-DOBLE CLIC EN REIMPRESIÓN: bloquea si ya hay una en vuelo
    // O si no han pasado 1500ms desde la última reimpresión.
    const ahora = Date.now();
    if (reprintingId !== null || (ahora - ultimoReprintRef.current) < COOLDOWN_MS) return;
    ultimoReprintRef.current = ahora;

    if (printerStatus.conectada && printerStatus.esCompatible === false) {
      Swal.fire({
        icon: 'warning',
        title: 'Impresora No Compatible',
        text: `La impresora detectada ("${printerStatus.nombre}") no admite código ZPL. Se requiere una impresora térmica Zebra de planta para reimprimir etiquetas.`,
        confirmButtonColor: '#0047AB',
      });
      return;
    }

    setReprintingId(idtblPallets);
    try {
      const res = await impresionService.imprimirPallet(idtblPallets);
      if (res.exito) {
        Swal.fire({
          icon: 'success',
          title: 'Etiqueta Enviada',
          text: `Pallet ID ${idtblPallets} enviado al cabezal Zebra.`,
          timer: 1600,
          showConfirmButton: false,
          toast: true,
          position: 'top-end',
        });
      } else {
        Swal.fire({
          icon: 'warning',
          title: 'Aviso de Impresión',
          text: res.mensaje || 'Error al disparar ZPL a la impresora.',
          confirmButtonColor: '#0047AB',
        });
      }
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: err.message || 'Fallo de comunicación con la impresora.',
        confirmButtonColor: '#0047AB',
      });
    } finally {
      setReprintingId(null);
    }
  };

  return (
    <div className="bg-white border-2 border-slate-400 rounded-xl shadow-xs overflow-hidden mb-6">
      {/* CABECERA DE LA TABLA */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-300 gap-2">
        <div className="flex items-center gap-2">
          <Table className="w-4 h-4 text-kc-600" />
          <h3 className="text-sm font-bold text-slate-800">
            Tarimas Capturadas del Vale
          </h3>
          {valeSeleccionado && (
            <>
              <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-kc-50 text-kc-700 border border-kc-200">
                Vale {valeSeleccionado.folioVale}
              </span>
              <span 
                className={`
                  px-2 py-0.5 rounded text-xs font-mono font-bold
                  ${pallets.length >= maxTarimas ? 'bg-red-100 text-red-800 border border-red-300' : 'bg-slate-100 text-slate-700 border border-slate-200'}
                `}
              >
                {pallets.length} / {maxTarimas} Tarimas
              </span>
            </>
          )}
        </div>

        <div className="text-xs text-slate-500 font-mono">
          {valeSeleccionado ? (
            <span>Haga clic en <strong className="px-1.5 py-0.5 bg-kc-600 text-white rounded text-[11px] font-bold shadow-2xs">Guardar</strong> en la fila de captura para registrar e imprimir tarima</span>
          ) : (
            <span>Seleccione o cree un vale para comenzar</span>
          )}
        </div>
      </div>

      {/* CUADRÍCULA DE TARIMAS */}
      <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
        <table className="w-full text-left border-collapse text-xs min-w-[920px]">
          <thead className="bg-slate-100 text-slate-600 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200 sticky top-0 z-10 shadow-2xs">
            <tr>
              <th className="py-2.5 px-2.5 text-center w-12">NO.</th>
              <th className="py-2.5 px-2 text-center w-24">HORA</th>
              <th className="py-2.5 px-2 text-center w-20">CAJAS</th>
              <th className="py-2.5 px-2.5 text-center w-28">LÍNEA EMPAQUE</th>
              <th className="py-2.5 px-3 text-center w-36">NO. TARIMA</th>
              <th className="py-2.5 px-2 text-center w-20">VALE</th>
              <th className="py-2.5 px-3">DESCRIPCIÓN DEL PRODUCTO</th>
              <th className="py-2.5 px-3 text-center w-28">ID PALLET</th>
              <th className="py-2.5 px-2 text-center w-24">ACCIONES</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {/* ESTADO 1: SIN VALE SELECCIONADO */}
            {!valeSeleccionado ? (
              <tr>
                <td colSpan={9} className="py-12 text-center">
                  <div className="flex flex-col items-center justify-center gap-2 max-w-md mx-auto">
                    <div className="p-3 bg-amber-50 text-amber-600 rounded-full border border-amber-200 shadow-2xs">
                      <Inbox className="w-8 h-8" />
                    </div>
                    <h4 className="text-sm font-bold text-slate-800">
                      No hay vales de producción activos, crea uno para registrar los pallets.
                    </h4>
                    <p className="text-xs text-slate-500 mb-2">
                      Presione el botón <strong>+ Nuevo Vale</strong> para dar de alta el primer vale del turno, o seleccione un vale del turno anterior arriba si requiere capturar remanentes.
                    </p>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={onOpenNuevoVale}
                      disabled={!encabezado || !encabezado.encontrado || encabezado.idRT_Encabezado <= 0 || maquinaId <= 0}
                      icon={<PlusCircle className="w-4 h-4" />}
                    >
                      + Nuevo Vale de Producción
                    </Button>
                  </div>
                </td>
              </tr>
            ) : loadingPallets ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-slate-500">
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin text-kc-600" />
                    <span className="font-medium">Cargando tarimas del vale...</span>
                  </div>
                </td>
              </tr>
            ) : pallets.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-10 text-center">
                  <div className="flex flex-col items-center justify-center gap-1.5 text-slate-500">
                    <FileQuestion className="w-7 h-7 text-slate-400 opacity-60" />
                    <span className="text-sm font-semibold text-slate-700">Este vale físico no tiene tarimas capturadas aún.</span>
                    <span className="text-xs text-slate-500">
                      Ingrese los datos en la fila inferior y presione <kbd className="px-1.5 py-0.5 bg-slate-200 rounded text-slate-700 font-bold">Enter</kbd> o Guardar para registrar la primera tarima.
                    </span>
                  </div>
                </td>
              </tr>
            ) : (
              pallets.map((p, index) => {
                const isEditing = editingId === (p.idtblPallets || p.idtblPallets || 0);
                const isNewlySaved = ultimoPalletGuardadoId === (p.idtblPallets || p.idtblPallets || 0);
                const numConsecutivo = index + 1;

                return (
                  <tr
                    key={(p.idtblPallets || p.idtblPallets || 0)}
                    className={`
                      transition-colors duration-150 select-none
                      ${isNewlySaved ? 'row-pulse-success' : ''}
                      ${isEditing ? 'bg-amber-50/80 font-medium' : index % 2 === 0 ? 'bg-white hover:bg-slate-50' : 'bg-slate-50/60 hover:bg-slate-100/70'}
                    `}
                  >
                    {/* Contador Secuencial */}
                    <td className="py-2.5 px-2.5 text-center font-mono font-bold text-slate-600">
                      {numConsecutivo}
                    </td>

                    {/* Hora */}
                    <td className="py-2.5 px-2 text-center">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editHora}
                          onChange={(e) => setEditHora(e.target.value)}
                          onBlur={() => setEditHora((prev) => normalizarHora(prev))}
                          onKeyDown={(e) => handleEditKeyDown(e, (p.idtblPallets || p.idtblPalletsPanal || 0))}
                          disabled={savingEdit}
                          placeholder="HH:mm"
                          maxLength={5}
                          className="w-20 px-1 py-0.5 text-xs font-mono font-bold text-center border-2 border-amber-500 rounded bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-60"
                          autoFocus
                        />
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-100 border border-slate-200 text-slate-700">
                          {p.hora || '--'}
                        </span>
                      )}
                    </td>

                    {/* Cajas (Destacado Negrita Pro) */}
                    <td className="py-2.5 px-2 text-center font-mono font-black text-slate-900 text-sm">
                      {isEditing ? (
                        <input
                          type="number"
                          value={editCajas}
                          onChange={(e) => setEditCajas(e.target.value)}
                          onKeyDown={(e) => handleEditKeyDown(e, (p.idtblPallets || p.idtblPalletsPanal || 0))}
                          disabled={savingEdit}
                          className="w-16 px-1 py-0.5 text-xs font-black text-center border-2 border-amber-500 rounded bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-60"
                        />
                      ) : (
                        <span>{p.totalCajas}</span>
                      )}
                    </td>

                    {/* Línea Empaque */}
                    <td className="py-2.5 px-2.5 text-center">
                      {isEditing ? (
                        <select
                          value={editLinea}
                          onChange={(e) => setEditLinea(e.target.value)}
                          onKeyDown={(e) => handleEditKeyDown(e, (p.idtblPallets || p.idtblPalletsPanal || 0))}
                          disabled={savingEdit}
                          title="Línea de empaque asignada a la máquina de Wipes"
                          className="px-2 py-0.5 text-xs font-mono font-bold text-center border-2 border-amber-500 rounded bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer disabled:opacity-60 min-w-[58px]"
                        >
                          {lineasEmpaque && lineasEmpaque.length > 0 ? (
                            <>
                              {editLinea && !lineasEmpaque.some((l) => l.lineaEmpaque === editLinea) && (
                                <option key={editLinea} value={editLinea}>
                                  {editLinea}
                                </option>
                              )}
                              {lineasEmpaque.map((l) => (
                                <option key={l.lineaEmpaque} value={l.lineaEmpaque}>
                                  {l.lineaEmpaque}
                                </option>
                              ))}
                            </>
                          ) : (
                            <option value={editLinea || '01'}>{editLinea || '01'}</option>
                          )}
                        </select>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-sky-50 text-sky-800 border border-sky-200">
                          {p.lineaEmpaque || valeSeleccionado?.lineaEmpaque || lineaEmpaque || '1'}
                        </span>
                      )}
                    </td>

                    {/* No. Tarima (Azul KC) */}
                    <td className="py-2.5 px-3 text-center font-mono font-black text-[#0047AB]">
                      {p.noTarima || `Tarima ${numConsecutivo}`}
                    </td>

                    {/* Folio Vale */}
                    <td className="py-2.5 px-2 text-center font-mono font-bold text-slate-600">
                      {p.folioVale || valeSeleccionado.folioVale}
                    </td>

                    {/* Descripción Producto */}
                    <td className="py-2.5 px-3 truncate max-w-[260px] text-slate-800 font-medium" title={p.descripcionProducto || valeSeleccionado.descripcion || valeSeleccionado.descripcionProducto}>
                      {p.descripcionProducto || valeSeleccionado.descripcion || valeSeleccionado.descripcionProducto || 'Sin Descripción'}
                    </td>

                    {/* ID Pallet */}
                    <td className="py-2.5 px-3 text-center">
                      <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-slate-100 border border-slate-300 text-slate-800 shadow-2xs">
                        {(p.idtblPallets || p.idtblPalletsPanal || 0)}
                      </span>
                    </td>

                    {/* Acciones */}
                    <td className="py-2 px-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {isEditing ? (
                          <>
                            <button
                              onClick={() => saveEdit((p.idtblPallets || p.idtblPalletsPanal || 0))}
                              disabled={savingEdit}
                              className="p-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Guardar cambios (Enter)"
                            >
                              {savingEdit ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              onClick={cancelEdit}
                              disabled={savingEdit}
                              className="p-1 rounded bg-slate-200 text-slate-700 hover:bg-slate-300 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Cancelar edición (Esc)"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleReprint((p.idtblPallets || p.idtblPalletsPanal || 0))}
                              disabled={reprintingId !== null}
                              className="p-1.5 rounded-md bg-amber-50 text-amber-700 border border-amber-300 hover:bg-amber-500 hover:text-white transition-all cursor-pointer shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Reimprimir etiqueta Zebra"
                            >
                              {reprintingId === (p.idtblPallets || p.idtblPalletsPanal || 0) ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Printer className="w-3.5 h-3.5" />
                              )}
                            </button>

                            <button
                              onClick={() => startEdit(p)}
                              disabled={savingEdit || reprintingId !== null}
                              className="p-1.5 rounded-md bg-sky-50 text-sky-700 border border-sky-300 hover:bg-sky-600 hover:text-white transition-all cursor-pointer shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Modificar datos de esta tarima (Hora, Cajas, Línea)"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}

            {/* FILA DE CAPTURA RÁPIDA INDIVIDUAL */}
            <CapturaRow />
          </tbody>
        </table>
      </div>
    </div>
  );
};
