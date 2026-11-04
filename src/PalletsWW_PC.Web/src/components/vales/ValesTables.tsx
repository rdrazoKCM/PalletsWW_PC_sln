import React, { useMemo } from 'react';
import { 
  Clock, 
  CheckCircle2, 
  History, 
  PlusCircle, 
  Edit3, 
  Layers 
} from 'lucide-react';
import { useProduction } from '../../context/ProductionContext';

interface ValesTablesProps {
  onOpenNuevoVale?: () => void;
  onOpenModificarVale?: () => void;
}

export const ValesTables: React.FC<ValesTablesProps> = ({
  onOpenNuevoVale,
  onOpenModificarVale
}) => {
  const {
    valesTurnoActual,
    valesTurnoAnterior,
    valeSeleccionado,
    esTurnoAnterior,
    seleccionarVale,
    pallets,
    maxTarimas,
    maquinaId,
    encabezado,
  } = useProduction();

  // Orden descendente garantizado (el más nuevo/reciente arriba)
  const valesActOrdenados = useMemo(() => {
    return [...valesTurnoActual].sort((a, b) => {
      const idA = a.idAutotblProduccion || a.folioVale || 0;
      const idB = b.idAutotblProduccion || b.folioVale || 0;
      return idB - idA;
    });
  }, [valesTurnoActual]);

  const valesAntOrdenados = useMemo(() => {
    return [...valesTurnoAnterior].sort((a, b) => {
      const idA = a.idAutotblProduccion || a.folioVale || 0;
      const idB = b.idAutotblProduccion || b.folioVale || 0;
      return idB - idA;
    });
  }, [valesTurnoAnterior]);

  const puedeCrearVale = encabezado && encabezado.encontrado && encabezado.idRT_Encabezado > 0 && maquinaId > 0;

  return (
    <div className="space-y-2 mb-3">
      {/* ─── BARRA DE ACCIONES ULTRA PRO: NUEVO VALE Y MODIFICAR VALE ─── */}
      <div className="bg-white border border-slate-200/90 rounded-xl px-3.5 py-2 shadow-2xs flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-lg bg-sky-50 text-kc-700 border border-sky-200">
            <Layers className="w-4 h-4" />
          </div>
          <span className="text-xs font-black text-slate-800 uppercase tracking-wide">
            Vales de Producción de Planta
          </span>
          <span className="text-[11px] text-slate-500 font-medium hidden sm:inline">
            (Seleccione una fila para proyectar sus métricas en el panel de control)
          </span>
        </div>

        {/* BOTONES CON TOQUE ULTRA PRO */}
        <div className="flex items-center gap-2">
          {/* Botón 1: + Nuevo Vale (Ultra Pro con acabado zafiro sólido) */}
          <button
            type="button"
            onClick={onOpenNuevoVale}
            disabled={!puedeCrearVale}
            style={{
              backgroundColor: '#0047AB',
              backgroundImage: 'linear-gradient(135deg, #003888 0%, #0047AB 50%, #005CE6 100%)',
              color: '#ffffff'
            }}
            className="
              inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-white font-extrabold text-xs
              shadow-[0_2px_10px_rgba(0,71,171,0.35)] active:scale-98
              transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed
            "
            title="Dar de alta un nuevo vale físico de producción para la máquina actual"
          >
            <PlusCircle className="w-3.5 h-3.5 text-sky-200" />
            <span>+ Nuevo Vale</span>
          </button>

          {/* Botón 2: Modificar Vale (Ultra Pro con acabado titanio/ámbar) */}
          <button
            type="button"
            onClick={onOpenModificarVale}
            disabled={!valeSeleccionado}
            className="
              inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-slate-700 font-extrabold text-xs
              bg-slate-100 hover:bg-slate-200/90 border border-slate-300
              shadow-2xs active:scale-98 transition-all cursor-pointer
              disabled:opacity-40 disabled:cursor-not-allowed
            "
            title="Modificar descripción, clave o cajas del vale seleccionado"
          >
            <Edit3 className="w-3.5 h-3.5 text-slate-600" />
            <span>Modificar Vale</span>
          </button>
        </div>
      </div>

      {/* ─── TABLAS COMPARATIVAS DE VALES POR TURNO ─── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        
        {/* ── TABLA 1: VALES TURNO ACTUAL (Azul Zafiro / Cobalto Pro) ── */}
        <div className="bg-white border-2 border-[#0047AB]/70 rounded-xl shadow-xs overflow-hidden flex flex-col">
          <div 
            style={{
              backgroundColor: '#003888',
              backgroundImage: 'linear-gradient(90deg, #002B66 0%, #003888 50%, #0047AB 100%)',
              color: '#ffffff'
            }}
            className="flex items-center justify-between px-3 py-1.5 text-white"
          >
            <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider">
              <Clock className="w-3.5 h-3.5 text-[#00E5FF]" />
              <span>Vales Turno Actual</span>
            </div>
            <span className="px-2 py-0.5 rounded text-[11px] font-mono font-black bg-white/20 text-white border border-white/20">
              {valesActOrdenados.length} {valesActOrdenados.length === 1 ? 'vale' : 'vales'}
            </span>
          </div>

          <div className="max-h-[145px] overflow-y-auto bg-white">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 sticky top-0 z-10 text-[11px]">
                <tr>
                  <th className="py-1.5 px-2 text-center w-16">VALE</th>
                  <th className="py-1.5 px-2 text-center w-20">CLAVE</th>
                  <th className="py-1.5 px-2">PRODUCTO</th>
                  <th className="py-1.5 px-2 text-center w-20">TOTAL CAJAS</th>
                  <th className="py-1.5 px-2 text-center w-24">TARIMAS</th>
                  <th className="py-1.5 px-2 text-center w-16">ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {valesActOrdenados.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-4 text-center text-slate-400 italic">
                      No hay vales dados de alta en el turno actual
                    </td>
                  </tr>
                ) : (
                  valesActOrdenados.map((v) => {
                    const isSelected = !esTurnoAnterior && v.idAutotblProduccion === valeSeleccionado?.idAutotblProduccion;
                    const tarimasCount = isSelected ? pallets.length : (v.totalPallets || 0);

                    return (
                      <tr
                        key={`act-${v.idAutotblProduccion}-${v.folioVale}`}
                        onClick={() => seleccionarVale(v, false)}
                        className={`
                          cursor-pointer transition-all duration-150 select-none
                          ${isSelected 
                            ? 'bg-sky-100/90 font-black border-l-8 border-[#0047AB] text-slate-900 shadow-xs ring-2 ring-sky-400/60 scale-[1.006] z-10 relative' 
                            : 'hover:bg-slate-50 text-slate-700'}
                        `}
                      >
                        <td className="py-1.5 px-2 text-center font-mono">
                          <div className="flex items-center justify-center gap-1.5">
                            {isSelected ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#0047AB] text-white font-mono font-extrabold text-xs shadow-xs animate-pulse">
                                <CheckCircle2 className="w-3.5 h-3.5 text-sky-200 shrink-0" />
                                <span>{v.folioVale}</span>
                              </span>
                            ) : (
                              <span className="font-mono text-slate-700 font-bold">{v.folioVale}</span>
                            )}
                          </div>
                        </td>
                        <td className="py-1.5 px-2 text-center">
                          <span 
                            className={`
                              px-1.5 py-0.5 rounded text-[11px] font-mono font-bold
                              ${isSelected 
                                ? 'bg-white text-kc-900 border-2 border-kc-500 shadow-xs' 
                                : 'bg-slate-100 text-slate-700 border border-slate-200'}
                            `}
                          >
                            {v.clave || v.claveProducto || 'S/C'}
                          </span>
                        </td>
                        <td className="py-1.5 px-2">
                          <div className="flex items-center gap-1.5 truncate max-w-[210px]" title={v.descripcion || v.descripcionProducto}>
                            {isSelected && (
                              <span className="px-1.5 py-0.2 rounded text-[8.5px] font-black uppercase tracking-wider bg-[#0047AB] text-white shrink-0 shadow-2xs">
                                ACTIVO
                              </span>
                            )}
                            <span className={isSelected ? 'font-black text-slate-900 truncate' : 'truncate font-medium'}>
                              {v.descripcion || v.descripcionProducto || 'Sin Descripción'}
                            </span>
                          </div>
                        </td>
                        <td className="py-1.5 px-2 text-center font-mono">
                          <span className={isSelected ? 'font-black text-slate-900 text-xs' : 'font-bold text-slate-700'}>
                            {v.totalCajas || v.cajasProgramadas || '--'}
                          </span>
                        </td>
                        <td className="py-1.5 px-2 text-center">
                          <span 
                            className={`
                              px-2 py-0.5 rounded text-[11px] font-mono font-black shadow-xs
                              ${tarimasCount >= maxTarimas 
                                ? 'bg-emerald-600 text-white' 
                                : isSelected 
                                  ? 'bg-[#0047AB] text-white ring-2 ring-sky-300' 
                                  : 'bg-slate-100 text-slate-700 border'}
                            `}
                          >
                            {tarimasCount} / {maxTarimas}
                          </span>
                        </td>
                        <td className="py-1.5 px-2 text-center font-mono">
                          <span className={isSelected ? 'font-bold text-kc-800' : 'text-slate-400'}>
                            {v.idAutotblProduccion}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── TABLA 2: VALES TURNO ANTERIOR (Cobre / Ámbar Industrial Pro) ── */}
        <div className="bg-white border-2 border-amber-500/80 rounded-xl shadow-xs overflow-hidden flex flex-col">
          <div 
            style={{
              backgroundColor: '#92400E',
              backgroundImage: 'linear-gradient(90deg, #78350F 0%, #92400E 50%, #B45309 100%)',
              color: '#ffffff'
            }}
            className="flex items-center justify-between px-3 py-1.5 text-white"
          >
            <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider">
              <History className="w-3.5 h-3.5 text-amber-200" />
              <span>Vales Turno Anterior</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[11px] font-mono font-black bg-white/20 text-white border border-white/20">
                {valesAntOrdenados.length} {valesAntOrdenados.length === 1 ? 'vale' : 'vales'}
              </span>
            </div>
          </div>

          <div className="max-h-[145px] overflow-y-auto bg-white">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 sticky top-0 z-10 text-[11px]">
                <tr>
                  <th className="py-1.5 px-2 text-center w-16">VALE</th>
                  <th className="py-1.5 px-2 text-center w-20">CLAVE</th>
                  <th className="py-1.5 px-2">PRODUCTO</th>
                  <th className="py-1.5 px-2 text-center w-20">TOTAL CAJAS</th>
                  <th className="py-1.5 px-2 text-center w-24">TARIMAS</th>
                  <th className="py-1.5 px-2 text-center w-16">ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {valesAntOrdenados.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-4 text-center text-slate-400 italic">
                      No se encontraron vales en el turno anterior
                    </td>
                  </tr>
                ) : (
                  valesAntOrdenados.map((v) => {
                    const isSelected = esTurnoAnterior && v.idAutotblProduccion === valeSeleccionado?.idAutotblProduccion;
                    const tarimasCount = isSelected ? pallets.length : (v.totalPallets || 0);

                    return (
                      <tr
                        key={`ant-${v.idAutotblProduccion}-${v.folioVale}`}
                        onClick={() => seleccionarVale(v, true)}
                        className={`
                          cursor-pointer transition-all duration-150 select-none
                          ${isSelected 
                            ? 'bg-amber-100/90 font-black border-l-8 border-amber-600 text-amber-950 shadow-xs ring-2 ring-amber-400/60 scale-[1.006] z-10 relative' 
                            : 'hover:bg-slate-50 text-slate-700'}
                        `}
                      >
                        <td className="py-1.5 px-2 text-center font-mono">
                          <div className="flex items-center justify-center gap-1.5">
                            {isSelected ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-700 text-white font-mono font-extrabold text-xs shadow-xs animate-pulse">
                                <CheckCircle2 className="w-3.5 h-3.5 text-amber-200 shrink-0" />
                                <span>{v.folioVale}</span>
                              </span>
                            ) : (
                              <span className="font-mono text-slate-700 font-bold">{v.folioVale}</span>
                            )}
                          </div>
                        </td>
                        <td className="py-1.5 px-2 text-center">
                          <span 
                            className={`
                              px-1.5 py-0.5 rounded text-[11px] font-mono font-bold
                              ${isSelected 
                                ? 'bg-white text-amber-950 border-2 border-amber-500 shadow-xs' 
                                : 'bg-slate-100 text-slate-700 border border-slate-200'}
                            `}
                          >
                            {v.clave || v.claveProducto || 'S/C'}
                          </span>
                        </td>
                        <td className="py-1.5 px-2">
                          <div className="flex items-center gap-1.5 truncate max-w-[210px]" title={v.descripcion || v.descripcionProducto}>
                            {isSelected && (
                              <span className="px-1.5 py-0.2 rounded text-[8.5px] font-black uppercase tracking-wider bg-amber-700 text-white shrink-0 shadow-2xs">
                                TURNO ANT
                              </span>
                            )}
                            <span className={isSelected ? 'font-black text-amber-950 truncate' : 'truncate font-medium'}>
                              {v.descripcion || v.descripcionProducto || 'Sin Descripción'}
                            </span>
                          </div>
                        </td>
                        <td className="py-1.5 px-2 text-center font-mono">
                          <span className={isSelected ? 'font-black text-amber-950 text-xs' : 'font-bold text-slate-700'}>
                            {v.totalCajas || v.cajasProgramadas || '--'}
                          </span>
                        </td>
                        <td className="py-1.5 px-2 text-center">
                          <span 
                            className={`
                              px-2 py-0.5 rounded text-[11px] font-mono font-black shadow-xs
                              ${tarimasCount >= maxTarimas 
                                ? 'bg-emerald-600 text-white' 
                                : isSelected 
                                  ? 'bg-amber-600 text-white ring-2 ring-amber-400' 
                                  : 'bg-slate-100 text-slate-700 border'}
                            `}
                          >
                            {tarimasCount} / {maxTarimas}
                          </span>
                        </td>
                        <td className="py-1.5 px-2 text-center font-mono">
                          <span className={isSelected ? 'font-bold text-amber-800' : 'text-slate-400'}>
                            {v.idAutotblProduccion}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
};
