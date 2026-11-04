import React, { useState, useEffect, useRef } from 'react';
import { Printer } from 'lucide-react';
import Swal from 'sweetalert2';
import { useProduction } from '../../context/ProductionContext';
import { palletsService } from '../../services/palletsService';
import { impresionService } from '../../services/impresionService';
import { Button } from '../ui/Button';
import type { PalletDto } from '../../types';

// Helper para hora actual en formato HH:mm
const getHoraActualHHMM = (): string => {
  const d = new Date();
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
};

// Normalizador inteligente: convierte 1010 -> 10:10, 830 -> 08:30, 9 -> 09:00
const normalizarHora = (input: string): string => {
  if (!input || !input.trim()) return getHoraActualHHMM();
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

export const CapturaRow: React.FC = () => {
  const {
    valeSeleccionado,
    encabezado,
    lineaEmpaque,
    setLineaEmpaque,
    lineasEmpaque,
    pallets,
    noEmpleado,
    operadorValido,
    validarOperador,
    recargarPallets,
    agregarPalletOptimista,
    setUltimoPalletGuardadoId,
    setIsEditingOrTyping,
    maxTarimas,
  } = useProduction();

  const [cajas, setCajas] = useState<string>(() => String(valeSeleccionado?.cajasPorTarima || 25));
  const [horaManual, setHoraManual] = useState<string>(() => getHoraActualHHMM());
  const [lineaCaptura, setLineaCaptura] = useState<string>(() => lineaEmpaque || (lineasEmpaque[0]?.lineaEmpaque || '41'));
  const [isSaving, setIsSaving] = useState<boolean>(false);
  
  const cajasInputRef = useRef<HTMLInputElement>(null);
  const horaInputRef = useRef<HTMLInputElement>(null);

  // Sincronizar línea con contexto o lista de líneas oficiales de la máquina
  useEffect(() => {
    if (lineaEmpaque) {
      setLineaCaptura(lineaEmpaque);
    } else if (lineasEmpaque.length > 0) {
      const defaultLinea = lineasEmpaque[0].lineaEmpaque;
      setLineaCaptura(defaultLinea);
      setLineaEmpaque(defaultLinea);
    }
  }, [lineaEmpaque, lineasEmpaque, setLineaEmpaque]);

  // BLINDAJE ANTI-DOBLE ENTER / ANTI-DOBLE CLIC (cooldown 1500ms)
  const ultimoGuardadoRef = useRef<number>(0);
  const COOLDOWN_MS = 1500;

  const proyectadoTarima = pallets.length + 1;

  useEffect(() => {
    if (valeSeleccionado) {
      const def = valeSeleccionado.cajasPorTarima || 25;
      setCajas(String(def));
      setHoraManual(getHoraActualHHMM());
      
      const t = setTimeout(() => {
        cajasInputRef.current?.focus();
        cajasInputRef.current?.select();
      }, 50);
      return () => clearTimeout(t);
    }
  }, [valeSeleccionado?.folioVale, valeSeleccionado?.cajasPorTarima, proyectadoTarima]);

  // Soporte universal de tecla Enter para modales y avisos (SweetAlert2)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && Swal.isVisible()) {
        const confirmBtn = Swal.getConfirmButton();
        if (confirmBtn && !confirmBtn.disabled) {
          e.preventDefault();
          e.stopPropagation();
          confirmBtn.click();
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown, true);
    };
  }, []);

  const handleFocus = () => { setIsEditingOrTyping(true); };
  const handleBlur = () => { setIsEditingOrTyping(false); };

  const handleGuardarPallet = async () => {
    const ahora = Date.now();
    if (isSaving || (ahora - ultimoGuardadoRef.current) < COOLDOWN_MS) return;
    ultimoGuardadoRef.current = ahora;

    if (!valeSeleccionado) {
      Swal.fire({ 
        icon: 'warning', 
        title: 'Sin Vale Activo', 
        text: 'Debe crear o seleccionar un vale de producción antes de registrar tarimas.', 
        confirmButtonColor: '#0047AB' 
      });
      return;
    }

    // Regla de Negocio 4.3: Tope de 38 tarimas por vale físico en Wipes
    if (pallets.length >= maxTarimas) {
      Swal.fire({ 
        icon: 'error', 
        title: 'Límite de Tarimas Alcanzado', 
        text: `Este vale físico ha alcanzado el límite máximo estricto de ${maxTarimas} tarimas en Wipes.`, 
        confirmButtonColor: '#0047AB' 
      });
      return;
    }

    // Validar cajas: no permitir campo en blanco o negativo, pero sí 0 cajas
    if (!cajas || cajas.trim() === '') {
      Swal.fire({ 
        icon: 'warning', 
        title: 'Cajas Requeridas', 
        text: 'El campo de cajas no puede estar en blanco. Ingrese 0 o la cantidad de cajas correspondiente.', 
        confirmButtonColor: '#0047AB',
        confirmButtonText: 'Aceptar',
        focusConfirm: true,
        allowEnterKey: true
      });
      cajasInputRef.current?.focus();
      return;
    }

    const cajasNum = parseInt(cajas.trim(), 10);
    if (isNaN(cajasNum) || cajasNum < 0) {
      Swal.fire({ 
        icon: 'warning', 
        title: 'Cajas Inválidas', 
        text: 'Ingrese una cantidad válida de cajas (0 o mayor).', 
        confirmButtonColor: '#0047AB',
        confirmButtonText: 'Aceptar',
        focusConfirm: true,
        allowEnterKey: true
      });
      cajasInputRef.current?.focus();
      return;
    }

    // Regla de Negocio 4.2: Normalizar y validar formato manual HH:mm (ej. 1010 -> 10:10)
    const horaNormalizada = normalizarHora(horaManual);
    setHoraManual(horaNormalizada);

    const horaRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (!horaRegex.test(horaNormalizada)) {
      Swal.fire({
        icon: 'warning',
        title: 'Hora Inválida',
        text: 'La hora debe tener formato válido de 24 horas (HH:mm, ej. 08:30 o 15:45).',
        confirmButtonColor: '#0047AB'
      });
      horaInputRef.current?.focus();
      return;
    }

    // Regla de Negocio Wipes 4.2: Candado Anti-Duplicidad de Hora por Línea en Memoria (0 ms)
    const lineaActual = String(lineaCaptura || '1').trim();
    const existeDuplicado = pallets.some(p => {
      const pL = String(p.lineaEmpaque || p.linea || '1').trim();
      const pH = (p.hora || '').trim();
      return pH === horaNormalizada && pL === lineaActual;
    });

    if (existeDuplicado) {
      Swal.fire({
        icon: 'warning',
        title: 'Hora Duplicada en Línea',
        text: `Ya existe una tarima registrada a las ${horaNormalizada} en la Línea ${lineaActual} para este vale. Para registrar a la misma hora, seleccione la otra línea o ajuste el minuto.`,
        confirmButtonColor: '#0047AB'
      });
      horaInputRef.current?.focus();
      return;
    }

    // Validar Operador
    let operadorListo = operadorValido;
    if (!operadorListo && noEmpleado.trim()) {
      operadorListo = await validarOperador(noEmpleado.trim());
    }

    if (!operadorListo) {
      Swal.fire({
        icon: 'warning',
        title: 'Operador Requerido',
        text: 'Debe ingresar y validar un número de operador válido en el encabezado antes de capturar.',
        confirmButtonColor: '#0047AB'
      });
      return;
    }

    const noEmpNum = parseInt(noEmpleado.trim(), 10) || 0;

    setIsSaving(true);
    setIsEditingOrTyping(true);

    try {
      // Blindaje de Coherencia Vale-Turno:
      // El pallet siempre hereda el idRT_Encabezado legítimo del propio vale seleccionado.
      // Si el operador sigue capturando en un vale del tercer turno aunque ya exista un primer turno,
      // el pallet se registra legítimamente en el tercer turno y no queda huérfano en SQL Server.
      const encIdReal = (valeSeleccionado.idRT_Encabezado && valeSeleccionado.idRT_Encabezado > 0)
        ? valeSeleccionado.idRT_Encabezado
        : (encabezado?.idRT_Encabezado || 0);

      const payload = {
        folioVale: valeSeleccionado.folioVale,
        idtblProductos: valeSeleccionado.idtblProductos || 0,
        totalCajas: cajasNum,
        hora: horaManual.trim(),
        idRT_Encabezado: encIdReal,
        noEmpCapturo: noEmpNum,
        linea: lineaCaptura,
        idAutotblProduccion: valeSeleccionado.idAutotblProduccion,
        noMaquina: encabezado?.noMaquina || 0,
      };

      const result = await palletsService.insertarPallet(payload);

      if (result.exitoso || result.exito) {
        const idGenerado = result.idtblPallets || result.idtblPalletsPanal || 0;
        setUltimoPalletGuardadoId(idGenerado);

        // 1. Inyección ultra rápida de ZPL a Zebra PrintBridge (< 50 ms)
        if (result.codigoZpl) {
          impresionService.inyectarZplDirecto(result.codigoZpl).catch((err) => {
            console.warn('Aviso al inyectar ZPL en local:', err);
          });
        } else if (idGenerado > 0) {
          impresionService.imprimirPallet(idGenerado).catch((err) => {
            console.warn('Aviso fallback al imprimir pallet:', err);
          });
        }

        // 2. Aceleración Ultra Rápida: Agregar inmediatamente a la cuadrícula en memoria local (0 ms)
        const nuevoPalletObj: PalletDto = {
          idtblPallets: idGenerado,
          idtblPalletsPanal: idGenerado,
          noTarima: result.noTarima || `Tarima ${proyectadoTarima}`,
          totalCajas: cajasNum,
          hora: horaNormalizada,
          lineaEmpaque: lineaActual,
          linea: lineaActual,
          folioVale: valeSeleccionado.folioVale,
          lote: '',
          descripcionProducto: valeSeleccionado.descripcion || '',
          claveProducto: valeSeleccionado.claveProducto || '',
          noEmpCapturo: noEmpNum,
          fechaSys: new Date().toISOString(),
        };

        agregarPalletOptimista(nuevoPalletObj);

        // 3. Notificación al operador
        if (result.codigo === 2 || result.codigoRespuesta === 2) {
          Swal.fire({
            icon: 'info',
            title: 'Tarima Recuperada e Impresa',
            text: result.mensaje || 'La tarima ya había sido registrada en el servidor durante un retardo de red previo. Se recuperó exitosamente y se envió su etiqueta a la impresora.',
            confirmButtonColor: '#0047AB',
            confirmButtonText: 'Aceptar',
            focusConfirm: true,
            allowEnterKey: true
          });
        } else {
          Swal.fire({
            icon: 'success',
            title: `Tarima ${proyectadoTarima} Guardada`,
            text: `ID: ${idGenerado} - Enviada a Zebra.`,
            timer: 1400,
            showConfirmButton: false,
            toast: true,
            position: 'top-end',
          });
        }

        // 4. Preparar campos para la siguiente captura
        setHoraManual(getHoraActualHHMM());
        setCajas(String(valeSeleccionado.cajasPorTarima || 25));

        // 5. Liberar foco inmediatamente (0 ms de espera para el operador)
        setIsSaving(false);
        setIsEditingOrTyping(false);

        setTimeout(() => {
          cajasInputRef.current?.focus();
          cajasInputRef.current?.select();
        }, 30);

        // 6. Sincronización en segundo plano con SQL Server (background refresh, no bloqueante)
        recargarPallets().catch((err) => {
          console.warn('[CapturaRow] Error en sincronización de fondo:', err);
        });

        return;

      } else {
        // En caso de que la respuesta venga con código 2 de recuperación
        if ((result.codigo === 2 || result.codigoRespuesta === 2) && (result.idtblPallets || 0) > 0) {
          const idRec = result.idtblPallets || 0;
          setUltimoPalletGuardadoId(idRec);
          if (result.codigoZpl) {
            impresionService.inyectarZplDirecto(result.codigoZpl).catch(() => {});
          } else {
            impresionService.imprimirPallet(idRec).catch(() => {});
          }

          const nuevoPalletObj: PalletDto = {
            idtblPallets: idRec,
            idtblPalletsPanal: idRec,
            noTarima: result.noTarima || `Tarima ${proyectadoTarima}`,
            totalCajas: cajasNum,
            hora: horaNormalizada,
            lineaEmpaque: lineaActual,
            linea: lineaActual,
            folioVale: valeSeleccionado.folioVale,
            lote: '',
            descripcionProducto: valeSeleccionado.descripcion || '',
            claveProducto: valeSeleccionado.claveProducto || '',
            noEmpCapturo: noEmpNum,
            fechaSys: new Date().toISOString(),
          };
          agregarPalletOptimista(nuevoPalletObj);

          Swal.fire({
            icon: 'info',
            title: 'Tarima Recuperada e Impresa',
            text: result.mensaje || 'La tarima ya se encontraba en el sistema. Se procedió a recuperar e imprimir su etiqueta física.',
            confirmButtonColor: '#0047AB',
            confirmButtonText: 'Aceptar',
            focusConfirm: true,
            allowEnterKey: true
          });
          setHoraManual(getHoraActualHHMM());
          setCajas(String(valeSeleccionado.cajasPorTarima || 25));
          setIsSaving(false);
          setIsEditingOrTyping(false);
          setTimeout(() => {
            cajasInputRef.current?.focus();
            cajasInputRef.current?.select();
          }, 30);

          recargarPallets().catch(() => {});
          return;
        }

        Swal.fire({
          icon: 'error',
          title: 'Error al Guardar',
          text: result.mensaje || 'No se pudo insertar el pallet.',
          confirmButtonColor: '#0047AB'
        });
      }
    } catch (err: any) {
      console.warn('[CapturaRow] Error o timeout al guardar pallet:', err);

      // Protocolo Automático de Reconciliación ante Red Lenta (Homologado con Pallets Pañal)
      Swal.fire({
        title: 'Verificando con el servidor...',
        html: `
          <div class="flex flex-col items-center gap-2 text-slate-700">
            <p class="text-sm font-medium">Hubo una demora momentánea en la red de planta.</p>
            <p class="text-xs text-slate-500">Comprobando si la tarima ya fue guardada para evitar duplicarla...</p>
          </div>
        `,
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });

      // Sincronización Defensiva: Pausa breve de 1.2s para permitir a SQL Server asentar la transacción
      let palletRecuperado: any = null;
      try {
        await new Promise((r) => setTimeout(r, 1200));

        const listaActual = await palletsService.getPalletsPorVale(
          valeSeleccionado.folioVale, 
          encabezado?.idRT_Encabezado
        );
        if (listaActual && listaActual.length > 0) {
          const hLimpia = horaNormalizada.replace(':', '').trim();
          const match = listaActual.find((p) => {
            const pH = (p.hora || '').replace(':', '').trim();
            const pL = String(p.lineaEmpaque || p.linea || '').trim();
            const lAct = String(lineaActual).trim();
            return pH === hLimpia && (!lAct || pL === lAct || pL.endsWith(lAct) || lAct.endsWith(pL));
          }) || (listaActual.length > pallets.length ? listaActual[listaActual.length - 1] : null);

          if (match && (match.idtblPallets || (match as any).idtblPalletsPanal || 0) > 0) {
            palletRecuperado = match;
          }
        }
      } catch (recErr) {
        console.warn('Error al verificar recuperación de pallet:', recErr);
      }

      // CASO A: ¡EL PALLET SÍ SE HABÍA GUARDADO EN EL SERVIDOR!
      if (palletRecuperado) {
        const idRec = palletRecuperado.idtblPallets || (palletRecuperado as any).idtblPalletsPanal || 0;
        setUltimoPalletGuardadoId(idRec);

        // Inyección inmediata de etiqueta a Zebra PrintBridge
        impresionService.imprimirPallet(idRec).catch((ePrint) => {
          console.warn('Aviso fallback al imprimir pallet recuperado:', ePrint);
        });

        await recargarPallets();
        Swal.fire({
          icon: 'success',
          title: `Tarima ${proyectadoTarima} Confirmada e Impresa`,
          text: `La tarima sí fue registrada en el servidor (ID: ${idRec}). Se envió la etiqueta a la impresora Zebra.`,
          confirmButtonColor: '#0047AB',
          confirmButtonText: 'Aceptar'
        });
        setHoraManual(getHoraActualHHMM());
        setCajas(String(valeSeleccionado.cajasPorTarima || 25));
        setTimeout(() => {
          cajasInputRef.current?.focus();
          cajasInputRef.current?.select();
        }, 60);
        return;
      }

      // CASO B: SE CONFIRMÓ QUE REALMENTE NO SE GUARDÓ (Idéntico a Pallets Pañal)
      await recargarPallets();
      Swal.fire({
        icon: 'warning',
        title: 'Tarima no guardada, inténtelo de nuevo',
        html: `
          <p class="text-sm text-slate-700 mb-2">
            Hubo una demora en la comunicación y se comprobó que la tarima no se registró en el servidor.
          </p>
          <div class="p-2.5 bg-amber-50 border border-amber-300 rounded-lg text-xs text-amber-900 text-left mb-2">
            <p>Tus datos capturados (<strong>${cajasNum}</strong> cajas, hora <strong>${horaNormalizada}</strong>, Línea <strong>${lineaActual}</strong>) se mantienen intactos en pantalla.</p>
            <p class="mt-1">Por favor, presione el botón <strong>Guardar</strong> nuevamente.</p>
          </div>
        `,
        confirmButtonColor: '#0047AB',
        confirmButtonText: 'Entendido'
      });
    } finally {
      setIsSaving(false);
      setIsEditingOrTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (Swal.isVisible()) {
        e.preventDefault();
        e.stopPropagation();
        const confirmBtn = Swal.getConfirmButton();
        if (confirmBtn && !confirmBtn.disabled) {
          confirmBtn.click();
        }
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      handleGuardarPallet();
    }
  };

  if (!valeSeleccionado || pallets.length >= maxTarimas) return null;

  return (
    <tr className="border-t-2 border-[#0047AB]/50 bg-sky-50/80 transition-colors" onKeyDown={handleKeyDown}>
      {/* 1. Tarima Proyectada */}
      <td className="p-2 text-center font-mono font-black text-[#0047AB] text-sm">
        {proyectadoTarima}
      </td>

      {/* 2. Hora Manual (HH:mm) */}
      <td className="p-2 text-center">
        <input
          ref={horaInputRef}
          type="text"
          maxLength={5}
          value={horaManual}
          onChange={(e) => setHoraManual(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={() => {
            handleBlur();
            setHoraManual((prev) => normalizarHora(prev));
          }}
          disabled={isSaving}
          placeholder="HH:mm"
          title="Hora de producción (formato HH:mm). Se permite ingresar 1010 sin dos puntos y se auto-formatea al salir. Presione Enter para guardar."
          className="w-20 px-2 py-1 text-xs font-mono font-bold text-center bg-white border border-[#0047AB] rounded-md focus:outline-none focus:ring-2 focus:ring-sky-400 shadow-2xs"
        />
      </td>

      {/* 3. Cajas */}
      <td className="p-2 text-center">
        <input
          ref={cajasInputRef}
          type="number"
          value={cajas}
          onChange={(e) => setCajas(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={(e) => { handleFocus(); e.target.select(); }}
          onBlur={handleBlur}
          disabled={isSaving}
          placeholder="Cajas"
          title={`Cajas por tarima (${valeSeleccionado?.cajasPorTarima || 25} sugeridas). Presione Enter para guardar.`}
          className="w-20 px-2 py-1 text-xs font-mono font-black text-center bg-white border-2 border-[#0047AB] rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 no-spinners shadow-xs"
        />
      </td>

      {/* 4. Selector Combobox de Líneas Oficiales de la Máquina (Wipes) */}
      <td className="p-2 text-center">
        <select
          value={lineaCaptura}
          onChange={(e) => {
            const val = e.target.value;
            setLineaCaptura(val);
            setLineaEmpaque(val);
          }}
          onKeyDown={handleKeyDown}
          disabled={isSaving}
          title="Línea de empaque asignada a la máquina de Wipes. Presione Enter para guardar."
          className="px-2.5 py-1 text-xs font-mono font-bold text-center bg-white border-2 border-[#0047AB] rounded-md text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-400 shadow-2xs cursor-pointer min-w-[58px]"
        >
          {lineasEmpaque && lineasEmpaque.length > 0 ? (
            lineasEmpaque.map((l) => (
              <option key={l.lineaEmpaque} value={l.lineaEmpaque}>
                {l.lineaEmpaque}
              </option>
            ))
          ) : (
            <>
              <option value="41">41</option>
              <option value="42">42</option>
            </>
          )}
        </select>
      </td>

      {/* 5. Insignia Consecutivo */}
      <td className="p-2 text-center">
        <span className="px-2 py-1 rounded text-xs font-mono font-black bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs">
          Tarima {proyectadoTarima}
        </span>
      </td>

      {/* 6. Folio Vale */}
      <td className="p-2 text-center font-mono font-bold text-slate-700 text-xs">
        {valeSeleccionado.folioVale}
      </td>

      {/* 7. Descripción Producto */}
      <td className="p-2 text-xs font-semibold text-slate-800 truncate max-w-[240px]" title={valeSeleccionado.descripcion}>
        {valeSeleccionado.descripcion}
      </td>

      {/* 8. Lote */}
      <td className="p-2 text-center">
        <span className="px-2 py-0.5 rounded text-xs font-mono text-slate-400 bg-slate-100 border border-slate-200">
          Auto
        </span>
      </td>

      {/* 9. Botón Guardar / Imprimir */}
      <td className="p-2 text-center">
        <Button 
          type="button" 
          variant="primary" 
          size="sm" 
          onClick={handleGuardarPallet} 
          loading={isSaving} 
          icon={<Printer className="w-3.5 h-3.5" />} 
          style={{
            backgroundColor: '#0047AB',
            backgroundImage: 'linear-gradient(135deg, #003888 0%, #0047AB 50%, #0052CC 100%)',
            color: '#ffffff'
          }}
          className="w-full text-xs font-extrabold shadow-sm hover:opacity-90 active:scale-98 transition-all cursor-pointer" 
          title="Guardar tarima e inyectar etiqueta ZPL a Zebra"
        >
          Guardar
        </Button>
      </td>
    </tr>
  );
};