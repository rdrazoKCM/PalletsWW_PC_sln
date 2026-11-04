import React from 'react';
import { 
  Zap, 
  Award, 
  Layers, 
  Package
} from 'lucide-react';
import { useProduction } from '../../context/ProductionContext';

export const ValeCockpitCard: React.FC = () => {
  const {
    valeSeleccionado,
    esTurnoAnterior,
    pallets,
    maxTarimas,
  } = useProduction();

  const limiteMax = maxTarimas || 38;
  const totalTarimas = pallets.length;
  const totalCajasAcumuladas = pallets.reduce((sum, p) => sum + (p.totalCajas || 0), 0);
  const tarimasFaltantes = Math.max(0, limiteMax - totalTarimas);
  const porcentaje = Math.min(100, Math.round((totalTarimas / limiteMax) * 100));

  // Cajas por tarima: reflejar las tarimas capturadas o la configuración del vale
  const cajasPorTarimaActual = (pallets.length > 0 && pallets[pallets.length - 1]?.totalCajas)
    ? pallets[pallets.length - 1].totalCajas
    : (valeSeleccionado?.cajasPorTarima || 25);

  // Estado si no hay vale seleccionado
  if (!valeSeleccionado) {
    return (
      <div className="
        h-full rounded-2xl p-5 border-2 border-dashed border-slate-300
        bg-gradient-to-b from-slate-50 to-slate-100/80 text-slate-500
        flex flex-col items-center justify-center text-center space-y-3 min-h-[380px] shadow-2xs
      ">
        <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-xs text-kc-600">
          <Layers className="w-8 h-8 opacity-70" />
        </div>
        <div>
          <h4 className="text-sm font-extrabold text-slate-800">
            Sin Vale Seleccionado
          </h4>
          <p className="text-xs text-slate-500 max-w-[220px] mt-1 leading-relaxed">
            Haga clic en cualquier vale de las tablas superiores para proyectar aquí su medidor y especificaciones.
          </p>
        </div>
        <div className="text-[11px] font-mono text-slate-400 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
          Esperando selección...
        </div>
      </div>
    );
  }

  return (
    <div 
      style={{
        backgroundColor: '#001433',
        backgroundImage: 'linear-gradient(180deg, #001433 0%, #002244 50%, #003366 100%)',
        color: '#ffffff'
      }}
      className="
        relative overflow-hidden rounded-2xl p-4.5 border-2 border-[#00E5FF]/50
        text-white shadow-[0_12px_32px_-6px_rgba(0,38,97,0.5),0_0_18px_rgba(0,229,255,0.22)]
        flex flex-col justify-between h-full space-y-3.5 min-h-[420px]
      "
    >
      {/* Resplandor ambiental superior */}
      <div className="absolute -top-10 -right-10 w-44 h-44 bg-[#00E5FF]/15 rounded-full blur-3xl pointer-events-none" />

      {/* ── CABECERA DEL VALE ACTIVO ── */}
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-2">
          <span className={`
            text-[10px] font-mono font-black tracking-wider uppercase px-2.5 py-0.5 rounded-full border
            ${esTurnoAnterior 
              ? 'bg-amber-400/20 text-amber-300 border-amber-400/50 shadow-[0_0_8px_rgba(245,158,11,0.3)]' 
              : 'bg-[#00E5FF]/20 text-[#00E5FF] border-[#00E5FF]/50 shadow-[0_0_8px_rgba(0,229,255,0.35)]'}
          `}>
            {esTurnoAnterior ? 'TURNO ANTERIOR' : 'VALE ACTIVO'}
          </span>

          <span className="text-[11px] font-mono font-bold text-white/80 bg-white/10 px-2 py-0.5 rounded border border-white/15">
            Máx. {limiteMax} T
          </span>
        </div>

        <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-white leading-tight flex items-baseline justify-between gap-2">
          <span className="text-white drop-shadow-md truncate">VALE {valeSeleccionado.folioVale}</span>
          <span className="text-xs font-mono font-bold text-[#00E5FF] tracking-normal drop-shadow-sm shrink-0 bg-white/10 px-1.5 py-0.5 rounded border border-white/10">
            ID: {valeSeleccionado.idAutotblProduccion}
          </span>
        </div>

        <div className="text-xs text-slate-100 font-bold mt-1.5 line-clamp-2 leading-snug drop-shadow-xs" title={valeSeleccionado.descripcion || valeSeleccionado.descripcionProducto}>
          {valeSeleccionado.descripcion || valeSeleccionado.descripcionProducto || 'Sin Descripción'}
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-200 font-mono mt-1.5 pt-1.5 border-t border-white/15">
          <span>Clave: <strong className="text-white font-bold">{valeSeleccionado.clave || valeSeleccionado.claveProducto || 'S/C'}</strong></span>
          <span className="text-slate-300">Capacidad: <strong className="text-white font-bold">{limiteMax} T</strong></span>
        </div>
      </div>

      {/* ── EL PLUS: MEDIDOR RADIAL CIRCULAR 360° CON GLOW NEÓN CYAN ── */}
      <div className="relative z-10 flex flex-col items-center justify-center py-1">
        <div className="relative w-40 h-40 flex items-center justify-center">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            {/* Pista base */}
            <circle 
              cx="50" 
              cy="50" 
              r="39" 
              stroke="rgba(255,255,255,0.18)" 
              strokeWidth="7" 
              fill="transparent" 
            />
            {/* Anillo de progreso con glow cyan de alta fidelidad */}
            <circle
              cx="50"
              cy="50"
              r="39"
              stroke="#00E5FF"
              strokeWidth="7.5"
              className="transition-all duration-700 drop-shadow-[0_0_10px_rgba(0,229,255,0.85)]"
              fill="transparent"
              strokeDasharray={245}
              strokeDashoffset={245 - (245 * porcentaje) / 100}
              strokeLinecap="round"
            />
          </svg>

          {/* Centro del Dial con Números Grandes */}
          <div className="absolute flex flex-col items-center justify-center text-center">
            <div className="flex items-center gap-1 text-[9.5px] font-mono text-slate-200 uppercase tracking-widest font-bold">
              <Zap className="w-3 h-3 text-[#00E5FF]" /> TARIMAS
            </div>
            <span className="text-2xl font-black font-mono text-white leading-tight mt-0.5 drop-shadow-sm">
              {totalTarimas} <span className="text-sm font-normal text-slate-300">/ {limiteMax}</span>
            </span>
            <span className="text-xs font-mono font-black text-[#00E5FF] tracking-wider drop-shadow-[0_0_6px_rgba(0,229,255,0.6)]">
              {porcentaje}% LLENO
            </span>
          </div>
        </div>
      </div>

      {/* ── EL PLUS: MÉTRICAS EN CRISTAL (GLASSMORPHISM DE ALTO CONTRASTE) ── */}
      <div className="relative z-10 grid grid-cols-2 gap-2 text-xs">
        <div 
          style={{ backgroundColor: 'rgba(255, 255, 255, 0.09)', borderColor: 'rgba(255, 255, 255, 0.2)' }}
          className="p-2 rounded-xl border text-center shadow-xs"
        >
          <span className="text-sky-200 text-[10px] block font-mono font-bold">TOTAL CAJAS</span>
          <strong className="text-base font-mono font-black text-white">{totalCajasAcumuladas}</strong>
        </div>
        <div 
          style={{ backgroundColor: 'rgba(255, 255, 255, 0.09)', borderColor: 'rgba(255, 255, 255, 0.2)' }}
          className="p-2 rounded-xl border text-center shadow-xs"
        >
          <span className="text-sky-200 text-[10px] block font-mono font-bold">POR TARIMA</span>
          <strong className="text-base font-mono font-black text-white">{cajasPorTarimaActual}</strong>
        </div>
      </div>

      {/* ── EL PLUS: BATERÍA LED DE TARIMAS (HASTA LIMITEMAX = 38 EN WIPES) ── */}
      <div 
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.45)', borderColor: 'rgba(255, 255, 255, 0.15)' }}
        className="relative z-10 p-2.5 rounded-xl border space-y-1.5"
      >
        <div className="flex justify-between text-[10px] font-mono text-slate-200 font-bold">
          <span className="flex items-center gap-1">
            <Award className="w-3 h-3 text-[#00E5FF]" /> Restantes:
          </span>
          <span className="text-white font-black">{tarimasFaltantes} Tarimas para Límite</span>
        </div>

        {/* Matriz dinámica de mini barritas LED */}
        <div className="flex gap-0.5 py-0.5 w-full">
          {Array.from({ length: limiteMax }).map((_, index) => {
            const isFilled = index < totalTarimas;
            return (
              <div
                key={index}
                className={`
                  flex-1 h-3 rounded-xs transition-all duration-300 min-w-0
                  ${isFilled 
                    ? 'bg-[#00E5FF] shadow-[0_0_4px_#00E5FF]' 
                    : 'bg-white/20'}
                `}
                title={`Tarima #${index + 1}`}
              />
            );
          })}
        </div>

        <div className="flex justify-between text-[9px] font-mono text-slate-300 pt-0.5 font-bold">
          <span>01</span>
          <span>Tope Máximo {limiteMax} T</span>
        </div>
      </div>

      {/* Pie informativo: estado del vale */}
      <div className="relative z-10 flex items-center justify-between text-[10px] font-mono text-slate-200 pt-1 border-t border-white/10">
        <span className="flex items-center gap-1">
          <Package className="w-3 h-3 text-[#00E5FF]" />
          <span>Vale de Producción</span>
        </span>
        <span className="text-[#00E5FF] font-bold">
          {totalTarimas >= limiteMax ? 'VALE COMPLETO' : 'EN PRODUCCIÓN'}
        </span>
      </div>
    </div>
  );
};
