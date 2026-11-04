import React from 'react';
import { 
  Package, 
  Boxes, 
  Archive, 
  AlertTriangle, 
  PlusCircle, 
  Edit3, 
  Lock,
  Clock
} from 'lucide-react';
import { useProduction } from '../../context/ProductionContext';
import { Button } from '../ui/Button';

interface ValeBannerProps {
  onOpenNuevoVale: () => void;
  onOpenModificarVale: () => void;
}

export const ValeBanner: React.FC<ValeBannerProps> = ({
  onOpenNuevoVale,
  onOpenModificarVale,
}) => {
  const { 
    valeSeleccionado, 
    esTurnoAnterior, 
    pallets, 
    encabezado,
    maquinaId,
    maxTarimas,
  } = useProduction();

  const totalCajas = pallets.reduce((acc, p) => acc + (p.totalCajas || 0), 0);
  const totalTarimas = pallets.length;
  const isLimitReached = totalTarimas >= maxTarimas;

  return (
    <div className="bg-white border-2 border-slate-400 rounded-xl shadow-xs p-3 mb-3">
      {/* CABECERA SUPERIOR DEL BANNER DE VALE */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Izquierda: Identificador de Vale Activo y Producto */}
        {valeSeleccionado ? (
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Folio Vale */}
            <div 
              className={`
                inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-mono font-bold shadow-xs
                ${esTurnoAnterior 
                  ? 'bg-amber-400 text-amber-950 border border-amber-500' 
                  : 'bg-kc-600 text-white'}
              `}
            >
              <Package className="w-4 h-4 shrink-0" />
              <span>VALE {valeSeleccionado.folioVale}</span>
            </div>

            {/* Tarimas / maxTarimas */}
            <div 
              className={`
                inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold shadow-2xs
                ${isLimitReached 
                  ? 'bg-red-600 text-white animate-pulse' 
                  : 'bg-kc-50 text-kc-700 border border-kc-200'}
              `}
              title={`Tarimas capturadas en este vale (límite industrial de ${maxTarimas})`}
            >
              <Boxes className="w-3.5 h-3.5 shrink-0" />
              <span>{totalTarimas} / {maxTarimas} Tarimas</span>
              {isLimitReached && <Lock className="w-3 h-3 ml-0.5" />}
            </div>

            {/* Total Cajas Acumuladas */}
            <div 
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold bg-slate-100 text-slate-800 border border-slate-300 shadow-2xs"
              title="Suma total de cajas capturadas en las tarimas del vale"
            >
              <Archive className="w-3.5 h-3.5 text-slate-600 shrink-0" />
              <span>{totalCajas} Cajas</span>
            </div>

            {/* Badge Turno Anterior si aplica */}
            {esTurnoAnterior && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-amber-500 text-white shadow-2xs">
                <Clock className="w-3 h-3" />
                TURNO ANTERIOR
              </span>
            )}

            {/* Descripción del Producto Asignado */}
            <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-50 border border-slate-300 max-w-xl truncate">
              <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-sky-100 text-sky-800 border border-sky-200">
                {valeSeleccionado.clave}
              </span>
              <span className="text-xs font-bold text-slate-800 truncate" title={valeSeleccionado.descripcion}>
                {valeSeleccionado.descripcion}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-300 px-3 py-1.5 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              No hay vales de producción activos en este turno. Cree uno nuevo con <strong>+ Nuevo Vale</strong> para registrar los pallets.
            </span>
          </div>
        )}

        {/* Derecha: Acciones de Vale */}
        <div className="flex items-center gap-2 ml-auto">
          <Button
            variant="warning"
            size="sm"
            onClick={onOpenModificarVale}
            disabled={!valeSeleccionado}
            icon={<Edit3 className="w-3.5 h-3.5" />}
            title="Modifica el folio físico asignado a este vale"
          >
            Modificar Vale
          </Button>

          <Button
            variant="success"
            size="sm"
            onClick={onOpenNuevoVale}
            disabled={!encabezado || !encabezado.encontrado || encabezado.idRT_Encabezado <= 0 || maquinaId <= 0}
            icon={<PlusCircle className="w-3.5 h-3.5" />}
            title="Crear un nuevo vale físico para la máquina activa"
          >
            + Nuevo Vale
          </Button>
        </div>
      </div>
    </div>
  );
};
