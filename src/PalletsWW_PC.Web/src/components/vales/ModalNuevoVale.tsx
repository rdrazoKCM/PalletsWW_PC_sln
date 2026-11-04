import React, { useState, useEffect } from 'react';
import { PlusCircle, Box, ScanLine } from 'lucide-react';
import Swal from 'sweetalert2';
import { Modal } from '../ui/Modal';
import { InputField } from '../ui/InputField';
import { Button } from '../ui/Button';
import { useProduction } from '../../context/ProductionContext';
import { catalogosService } from '../../services/catalogosService';
import { valesService } from '../../services/valesService';
import { getNombreMaquinaOficial } from '../../config';
import type { ProductoDto } from '../../types';

interface ModalNuevoValeProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ModalNuevoVale: React.FC<ModalNuevoValeProps> = ({ isOpen, onClose }) => {
  const { 
    maquinaId, 
    maquinaNombre, 
    encabezado, 
    lineaEmpaque, 
    recargarVales,
    maxTarimas,
    valesTurnoActual,
    valesTurnoAnterior,
    valeSeleccionado,
  } = useProduction();

  const [folioVale, setFolioVale] = useState<string>('');
  const [productos, setProductos] = useState<ProductoDto[]>([]);
  const [claveInput, setClaveInput] = useState<string>('');
  const [productoSeleccionado, setProductoSeleccionado] = useState<ProductoDto | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingProductos, setLoadingProductos] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const isSubmittingRef = React.useRef<boolean>(false);

  // Cargar productos de la máquina, consecutivo automático y última clave de vale
  useEffect(() => {
    if (isOpen && maquinaId > 0) {
      setLoadingProductos(true);
      setErrorMsg('');

      Promise.all([
        catalogosService.getProductosPorMaquina(maquinaId),
        valesService.getSiguienteSugerido(maquinaId, encabezado?.idRT_Encabezado).catch(() => null)
      ])
        .then(([data, sugerido]) => {
          const prods = data || [];
          setProductos(prods);

          // 1. CALCULAR CONSECUTIVO DEL ÚLTIMO VALE CAPTURADO (HOMOLOGADO 1:1 CON PALLETS WW)
          // Recopilar todos los folios conocidos en memoria para esta máquina (turno actual, anterior o vale activo)
          const todosVales = [...valesTurnoActual, ...valesTurnoAnterior];
          if (valeSeleccionado && !todosVales.some(v => v.idAutotblProduccion === valeSeleccionado.idAutotblProduccion)) {
            todosVales.push(valeSeleccionado);
          }

          const foliosMemoria = todosVales
            .map(v => Number(v.folioVale))
            .filter(f => !isNaN(f) && f > 0);

          let siguienteCalculado = 1;

          if (foliosMemoria.length > 0) {
            // Fuente de verdad absoluta: El folio más alto registrado en memoria de esta máquina + 1
            const maxFolioMemoria = Math.max(...foliosMemoria);
            siguienteCalculado = maxFolioMemoria + 1;
          } else if (sugerido && sugerido.siguienteFolio > 0) {
            // Fallback a API únicamente si la máquina no tiene vales en memoria
            siguienteCalculado = sugerido.siguienteFolio;
          } else {
            siguienteCalculado = 1;
          }

          setFolioVale(String(siguienteCalculado));

          // 2. SUGERIR LA ÚLTIMA CLAVE DEL ÚLTIMO VALE CAPTURADO
          // Prioridad: 1. Vale en pantalla -> 2. Último de turno actual -> 3. Último de turno anterior
          const ultimoVale = valeSeleccionado || valesTurnoActual[0] || valesTurnoAnterior[0];

          let prodMatch: ProductoDto | null = null;

          // A) Buscar por la clave del último vale activo en la terminal
          if (ultimoVale && ultimoVale.clave) {
            const claveLimpia = (ultimoVale.clave || '').trim().toLowerCase();
            prodMatch = prods.find(p => (p.claveProducto || '').trim().toLowerCase() === claveLimpia) || null;

            // Fallback por descripción si la clave fue formateada distinto
            if (!prodMatch && ultimoVale.descripcion) {
              const descLimpia = (ultimoVale.descripcion || '').trim().toLowerCase();
              prodMatch = prods.find(p => (p.descripcionClave || p.descripcion || '').trim().toLowerCase() === descLimpia) || null;
            }
          }

          // B) Fallback a sugerido por API si no hubo match en memoria
          if (!prodMatch && sugerido) {
            if (sugerido.claveProductoSugerida) {
              const cApi = (sugerido.claveProductoSugerida || '').trim().toLowerCase();
              prodMatch = prods.find(p => (p.claveProducto || '').trim().toLowerCase() === cApi) || null;
            }
            if (!prodMatch && (sugerido as any)?.idtblProductosSugerido) {
              prodMatch = prods.find(p => p.idtblProductos === (sugerido as any)?.idtblProductosSugerido) || null;
            }
          }

          // C) Fallback al primer producto de la máquina
          if (!prodMatch && prods.length > 0) {
            prodMatch = prods[0];
          }

          if (prodMatch) {
            aplicarProductoSeleccionado(prodMatch);
          } else {
            setClaveInput('');
            setProductoSeleccionado(null);
          }
        })
        .catch((err) => {
          console.error('Error al cargar datos para nuevo vale:', err);
          setErrorMsg('No se pudieron cargar los productos autorizados para esta máquina.');
        })
        .finally(() => setLoadingProductos(false));
    }
  }, [
    isOpen, 
    maquinaId, 
    lineaEmpaque, 
    maxTarimas, 
    encabezado?.idRT_Encabezado, 
    valesTurnoActual, 
    valesTurnoAnterior, 
    valeSeleccionado
  ]);

  const aplicarProductoSeleccionado = (prod: ProductoDto) => {
    setProductoSeleccionado(prod);
    setClaveInput(prod.claveProducto || '');
  };

  /**
   * Sincronización Clave -> Combobox (al dar Enter o perder foco)
   */
  const sincronizarPorClave = (claveAFiltrar: string) => {
    const claveLimpia = claveAFiltrar.trim();
    if (!claveLimpia) return;

    if (productos.length === 0) return;

    // 1. Búsqueda exacta por clave de producto (case-insensitive)
    let encontrado = productos.find(p => 
      (p.claveProducto || '').trim().toLowerCase() === claveLimpia.toLowerCase()
    );

    // 2. Búsqueda por coincidencia de inicio o contención si no hay exacta
    if (!encontrado) {
      encontrado = productos.find(p => 
        (p.claveProducto || '').trim().toLowerCase().startsWith(claveLimpia.toLowerCase())
      );
    }

    if (!encontrado) {
      encontrado = productos.find(p => 
        (p.descripcionClave || p.descripcion || '').toLowerCase().includes(claveLimpia.toLowerCase())
      );
    }

    if (encontrado) {
      aplicarProductoSeleccionado(encontrado);
      setErrorMsg('');
    } else {
      setErrorMsg(`Clave '${claveLimpia}' no encontrada en el catálogo.`);
    }
  };

  /**
   * Sincronización Combobox -> Clave (al cambiar de opción en el select)
   */
  const handleSelectCbx = (idProd: number) => {
    if (idProd <= 0) {
      setProductoSeleccionado(null);
      setClaveInput('');
      return;
    }

    const prod = productos.find(p => p.idtblProductos === idProd);
    if (prod) {
      aplicarProductoSeleccionado(prod);
      setErrorMsg('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current || loading) {
      return;
    }

    setErrorMsg('');

    const folioNum = parseInt(folioVale.trim(), 10);
    if (isNaN(folioNum) || folioNum <= 0) {
      setErrorMsg('Ingrese un folio de vale numérico válido.');
      return;
    }

    if (!productoSeleccionado || productoSeleccionado.idtblProductos <= 0) {
      setErrorMsg('Debe seleccionar un producto autorizado del catálogo.');
      return;
    }

    if (!encabezado || encabezado.idRT_Encabezado <= 0) {
      setErrorMsg('No hay un turno/encabezado activo en la máquina.');
      return;
    }

    // CANDADO SÍNCRONO ANTI-DOBLE CLIC / DOBLE ENTER
    isSubmittingRef.current = true;
    setLoading(true);

    try {
      // CONFIRMACIÓN PREVIA CON LOADER ACTIVO Y DESHABILITACIÓN ATÓMICA (ANTI-DUPLICADOS POR RED LENTA)
      const confirmResult = await Swal.fire({
        icon: 'question',
        title: '¿Confirmar Creación de Vale?',
        html: `
          <div class="text-left text-xs space-y-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <p class="text-sm font-bold text-slate-800 border-b border-slate-200 pb-1.5">
              ¿Está seguro de crear un nuevo vale de producción con los siguientes datos?
            </p>
            <div class="grid grid-cols-3 gap-y-1.5 pt-1 text-slate-700">
              <span class="text-slate-500 font-semibold">Número de Vale:</span>
              <span class="col-span-2 font-mono font-bold text-kc-700 text-sm">${folioNum}</span>

              <span class="text-slate-500 font-semibold">Clave de Producto:</span>
              <span class="col-span-2 font-mono font-bold text-slate-900">${productoSeleccionado.claveProducto}</span>

              <span class="text-slate-500 font-semibold">Descripción:</span>
              <span class="col-span-2 font-semibold text-slate-800">${productoSeleccionado.descripcionClave || productoSeleccionado.descripcion}</span>
            </div>
          </div>
        `,
        showCancelButton: true,
        confirmButtonColor: '#0047AB',
        cancelButtonColor: '#64748B',
        confirmButtonText: 'Sí, Crear Vale',
        cancelButtonText: 'Cancelar',
        reverseButtons: true,
        focusConfirm: true,
        showLoaderOnConfirm: true,
        allowOutsideClick: () => !Swal.isLoading(),
        preConfirm: async () => {
          try {
            const res = await valesService.crearVale({
              folioVale: folioNum,
              clave: productoSeleccionado.claveProducto,
              idtblProductos: productoSeleccionado.idtblProductos,
              idRT_Encabezado: encabezado.idRT_Encabezado,
              lineaEmpaque: lineaEmpaque || '1',
            });
            return res;
          } catch (error: any) {
            // RECUPERACIÓN AUTOMÁTICA EN CASO DE TIMEOUT O LATENCIA DE RED:
            // Si la llamada HTTP tardó o se cortó, verificamos si la base de datos sí alcanzó a guardar el vale
            try {
              const valesActuales = await valesService.getValesTurnoActual(encabezado.idRT_Encabezado, lineaEmpaque || '1');
              const yaCreado = valesActuales.find((v: any) => Number(v.folioVale) === folioNum);
              if (yaCreado) {
                return {
                  exito: true,
                  mensaje: 'Vale registrado y recuperado tras reconexión.',
                  idAutotblProduccion: yaCreado.idAutotblProduccion,
                };
              }
            } catch { }

            const msg = error.message || 'Error de comunicación al registrar el vale.';
            Swal.showValidationMessage(msg);
            return false;
          }
        },
      });

      if (!confirmResult.isConfirmed || !confirmResult.value) {
        return;
      }

      const res = confirmResult.value as any;

      if (res.exito || res.exitoso) {
        Swal.fire({
          icon: 'success',
          title: '¡Vale Creado!',
          text: `Vale físico ${folioNum} registrado correctamente.`,
          timer: 1800,
          showConfirmButton: false,
          toast: true,
          position: 'top-end',
        });

        await recargarVales(folioNum);
        onClose();
      } else {
        const yaExisteMsg = res.mensaje || 'No se pudo crear el vale.';
        // Si el backend notificó que ya existe, verificamos si ya está activo en el turno
        try {
          const valesActuales = await valesService.getValesTurnoActual(encabezado.idRT_Encabezado, lineaEmpaque || '1');
          const yaCreado = valesActuales.find((v: any) => Number(v.folioVale) === folioNum);
          if (yaCreado) {
            Swal.fire({
              icon: 'info',
              title: 'Vale Ya Activo',
              text: `El vale ${folioNum} ya se encuentra registrado y activo en este turno.`,
              timer: 2000,
              showConfirmButton: false,
              toast: true,
              position: 'top-end',
            });
            await recargarVales(folioNum);
            onClose();
            return;
          }
        } catch { }

        setErrorMsg(yaExisteMsg);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error de comunicación al registrar el vale.');
    } finally {
      setTimeout(() => {
        isSubmittingRef.current = false;
        setLoading(false);
      }, 1500);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Nuevo Vale de Producción"
      subtitle={`Máquina: ${getNombreMaquinaOficial(maquinaId, maquinaNombre)} - Encabezado: ${encabezado?.idRT_Encabezado || '--'}`}
      icon={<PlusCircle className="w-5 h-5 text-kc-600" />}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMsg && (
          <div className="p-3 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg">
            {errorMsg}
          </div>
        )}

        <div>
          {/* Folio Físico del Vale */}
          <InputField
            label="Folio del Vale Físico *"
            type="text"
            inputMode="numeric"
            placeholder="Ej. 10452"
            value={folioVale}
            onChange={(e) => setFolioVale(e.target.value.replace(/\D/g, ''))}
            autoFocus
            required
          />
        </div>

        {/* Fila Coordinada: Clave de Producto y Combobox de Producto (Estilo Pallets WW) */}
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
          <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <ScanLine className="w-4 h-4 text-kc-600" />
            <span>Selección Rápida de Producto (Sincronizado)</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            {/* Clave de Producto Editable con Enter */}
            <div className="sm:col-span-4">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Clave Producto:
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Ej. 3001"
                  value={claveInput}
                  onChange={(e) => setClaveInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      sincronizarPorClave(claveInput);
                    }
                  }}
                  onBlur={() => sincronizarPorClave(claveInput)}
                  className="w-full px-3 py-2 text-xs font-mono font-bold text-kc-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-kc-400 focus:border-kc-500 uppercase tracking-wide"
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                [Enter] o [Tab] para buscar y seleccionar
              </p>
            </div>

            {/* Combobox de Producto a Fabricar */}
            <div className="sm:col-span-8">
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                <span>Producto a Fabricar:</span>
                <span className="text-[10px] text-slate-400 font-normal">
                  {productos.length} autorizados
                </span>
              </label>
              <select
                value={productoSeleccionado?.idtblProductos || 0}
                onChange={(e) => handleSelectCbx(Number(e.target.value))}
                disabled={loadingProductos}
                className="w-full px-3 py-2 text-xs font-medium text-slate-800 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-kc-400 focus:border-kc-500 cursor-pointer disabled:bg-slate-100"
              >
                <option value={0}>-- Seleccione un Producto --</option>
                {productos.map((p) => {
                  const desc = p.descripcionProducto || p.descripcionClave || p.descripcion || '';
                  const etiqueta = p.claveProducto ? `${p.claveProducto} - ${desc}` : desc;
                  return (
                    <option key={p.idtblProductos} value={p.idtblProductos}>
                      {etiqueta}
                    </option>
                  );
                })}
              </select>
              <p className="text-[10px] text-slate-500 mt-1">
                Al seleccionar se actualiza la clave automáticamente
              </p>
            </div>
          </div>

          {/* Tarjeta de Confirmación de Producto Activo */}
          {productoSeleccionado && (
            <div className="p-2.5 bg-sky-50/80 border border-sky-200 rounded-lg text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Box className="w-4 h-4 text-kc-600 shrink-0" />
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-semibold block">Producto Seleccionado:</span>
                  <span className="font-bold text-kc-900 font-mono">
                    {productoSeleccionado.claveProducto} - {productoSeleccionado.descripcionProducto || productoSeleccionado.descripcionClave || productoSeleccionado.descripcion}
                  </span>
                </div>
              </div>
              {(productoSeleccionado.cajasPorTarima || productoSeleccionado.cajasXPallet) && (
                <span className="px-2.5 py-1 rounded bg-white text-kc-700 font-mono text-[11px] font-bold border border-sky-300 shadow-2xs shrink-0">
                  {productoSeleccionado.cajasPorTarima || productoSeleccionado.cajasXPallet} cajas / tarima
                </span>
              )}
            </div>
          )}
        </div>


        {/* Botones de acción */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={loading}
          >
            Cancelar
          </Button>

          <Button
            type="submit"
            variant="primary"
            loading={loading}
            icon={<PlusCircle className="w-4 h-4" />}
          >
            Crear Vale de Producción
          </Button>
        </div>
      </form>
    </Modal>
  );
};
