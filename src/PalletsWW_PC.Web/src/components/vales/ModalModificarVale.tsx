import React, { useState, useEffect } from 'react';
import { Edit3, Box, ScanLine } from 'lucide-react';
import Swal from 'sweetalert2';
import { Modal } from '../ui/Modal';
import { InputField } from '../ui/InputField';
import { Button } from '../ui/Button';
import { useProduction } from '../../context/ProductionContext';
import { catalogosService } from '../../services/catalogosService';
import { valesService } from '../../services/valesService';
import type { ProductoDto } from '../../types';

interface ModalModificarValeProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ModalModificarVale: React.FC<ModalModificarValeProps> = ({ isOpen, onClose }) => {
  const { valeSeleccionado, maquinaId, recargarVales } = useProduction();
  const [folioNuevo, setFolioNuevo] = useState<string>('');
  const [selectedLinea, setSelectedLinea] = useState<string>('1');
  const [productos, setProductos] = useState<ProductoDto[]>([]);
  const [claveInput, setClaveInput] = useState<string>('');
  const [productoSeleccionado, setProductoSeleccionado] = useState<ProductoDto | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingProductos, setLoadingProductos] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const isSubmittingRef = React.useRef<boolean>(false);

  useEffect(() => {
    if (isOpen && valeSeleccionado) {
      setFolioNuevo(String(valeSeleccionado.folioVale));
      setSelectedLinea(valeSeleccionado.lineaEmpaque || '1');
      setClaveInput(valeSeleccionado.clave || '');
      setErrorMsg('');

      if (maquinaId > 0) {
        setLoadingProductos(true);
        catalogosService.getProductosPorMaquina(maquinaId)
          .then((data) => {
            const prods = data || [];
            setProductos(prods);

            // Buscar producto coincidente por ID o clave
            let match = prods.find(p => p.idtblProductos === valeSeleccionado.idtblProductos);
            if (!match && valeSeleccionado.clave) {
              match = prods.find(p => (p.claveProducto || '').trim().toLowerCase() === valeSeleccionado.clave.trim().toLowerCase());
            }
            if (match) {
              setProductoSeleccionado(match);
              setClaveInput(match.claveProducto || '');
            } else {
              setProductoSeleccionado({
                idtblProductos: valeSeleccionado.idtblProductos ?? 0,
                claveProducto: valeSeleccionado.clave,
                descripcionClave: valeSeleccionado.descripcion,
                descripcion: valeSeleccionado.descripcion,
              });
            }
          })
          .catch((err) => {
            console.error('Error al cargar productos en modificar vale:', err);
          })
          .finally(() => setLoadingProductos(false));
      }
    }
  }, [isOpen, valeSeleccionado, maquinaId]);

  /**
   * Sincronización Clave -> Combobox (al dar Enter o perder foco)
   */
  const sincronizarPorClave = (claveAFiltrar: string) => {
    const claveLimpia = claveAFiltrar.trim();
    if (!claveLimpia) return;

    if (productos.length === 0) return;

    let encontrado = productos.find(p => 
      (p.claveProducto || '').trim().toLowerCase() === claveLimpia.toLowerCase()
    );

    if (!encontrado) {
      encontrado = productos.find(p => 
        (p.claveProducto || '').trim().toLowerCase().startsWith(claveLimpia.toLowerCase())
      );
    }

    if (!encontrado) {
      encontrado = productos.find(p => 
        (p.descripcionProducto || p.descripcionClave || p.descripcion || '').toLowerCase().includes(claveLimpia.toLowerCase())
      );
    }

    if (encontrado) {
      setProductoSeleccionado(encontrado);
      setClaveInput(encontrado.claveProducto || '');
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
      setProductoSeleccionado(prod);
      setClaveInput(prod.claveProducto || '');
      setErrorMsg('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valeSeleccionado || isSubmittingRef.current || loading) return;

    const n = parseInt(folioNuevo.trim(), 10);
    if (isNaN(n) || n <= 0) {
      setErrorMsg('Ingrese un folio de vale válido.');
      return;
    }

    const idProdFinal = productoSeleccionado?.idtblProductos || valeSeleccionado.idtblProductos;
    if (!idProdFinal || idProdFinal <= 0) {
      setErrorMsg('Debe seleccionar un producto válido.');
      return;
    }

    const claveFinal = productoSeleccionado?.claveProducto || valeSeleccionado.clave;
    const descFinal = productoSeleccionado?.descripcionProducto || productoSeleccionado?.descripcionClave || productoSeleccionado?.descripcion || valeSeleccionado.descripcion;

    isSubmittingRef.current = true;
    setLoading(true);

    // CONFIRMACIÓN PREVIA A LA MODIFICACIÓN DEL VALE
    const confirmResult = await Swal.fire({
      icon: 'question',
      title: '¿Confirmar Modificación de Vale?',
      html: `
        <div class="text-left text-xs space-y-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
          <p class="text-sm font-bold text-slate-800 border-b border-slate-200 pb-1.5">
            ¿Está seguro de actualizar la información de este vale de producción?
          </p>
          <div class="grid grid-cols-3 gap-y-1.5 pt-1 text-slate-700">
            <span class="text-slate-500 font-semibold">Folio Original:</span>
            <span class="col-span-2 font-mono text-slate-500 line-through">${valeSeleccionado.folioVale}</span>

            <span class="text-slate-500 font-semibold">Nuevo Folio:</span>
            <span class="col-span-2 font-mono font-bold text-kc-700 text-sm">${n}</span>

            <span class="text-slate-500 font-semibold">Clave de Producto:</span>
            <span class="col-span-2 font-mono font-bold text-slate-900">${claveFinal}</span>

            <span class="text-slate-500 font-semibold">Descripción:</span>
            <span class="col-span-2 font-semibold text-slate-800">${descFinal}</span>
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonColor: '#0047AB',
      cancelButtonColor: '#64748B',
      confirmButtonText: 'Sí, Modificar Vale',
      cancelButtonText: 'Cancelar',
      reverseButtons: true,
      focusConfirm: true,
    });

    if (!confirmResult.isConfirmed) {
      return;
    }

    setLoading(true);
    try {
      const res = await valesService.modificarFolio({
        idAutotblProduccion: valeSeleccionado.idAutotblProduccion,
        folioValeNuevo: n,
        idtblProductos: idProdFinal,
        lineaEmpaque: selectedLinea,
      });

      if (res.exito || (res as any).exitoso) {
        Swal.fire({
          icon: 'success',
          title: '¡Vale Modificado!',
          text: `El vale físico ${n} ha sido actualizado correctamente.`,
          timer: 1800,
          showConfirmButton: false,
          toast: true,
          position: 'top-end',
        });
        await recargarVales();
        onClose();
      } else {
        setErrorMsg(res.mensaje || 'No se pudo actualizar el vale.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error de comunicación al modificar el vale.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Modificar Vale de Producción"
      subtitle={`Vale actual: ${valeSeleccionado?.folioVale || '--'} - ID: ${valeSeleccionado?.idAutotblProduccion || '--'}`}
      icon={<Edit3 className="w-5 h-5 text-amber-600" />}
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
            value={folioNuevo}
            onChange={(e) => setFolioNuevo(e.target.value.replace(/\D/g, ''))}
            autoFocus
            required
          />
        </div>

        {/* Fila Coordinada: Clave de Producto y Combobox de Producto (Totalmente Editable) */}
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
          <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <ScanLine className="w-4 h-4 text-kc-600" />
            <span>Producto Asociado al Vale (Editable)</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            {/* Clave de Producto Editable con Enter */}
            <div className="sm:col-span-4">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Clave Producto:
              </label>
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
              <p className="text-[10px] text-slate-500 mt-1">
                [Enter] o [Tab] para buscar
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
            <div className="p-2.5 bg-amber-50/80 border border-amber-200 rounded-lg text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Box className="w-4 h-4 text-amber-700 shrink-0" />
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-semibold block">Producto a Actualizar:</span>
                  <span className="font-bold text-slate-900 font-mono">
                    {productoSeleccionado.claveProducto} - {productoSeleccionado.descripcionProducto || productoSeleccionado.descripcionClave || productoSeleccionado.descripcion}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

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
            variant="warning"
            loading={loading}
          >
            Actualizar Vale
          </Button>
        </div>
      </form>
    </Modal>
  );
};
