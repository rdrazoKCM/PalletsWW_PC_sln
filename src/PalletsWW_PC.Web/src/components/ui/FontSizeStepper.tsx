import React, { useState, useEffect } from 'react';
import { Type, Minus, Plus } from 'lucide-react';

const SCALE_LEVELS = [100, 108, 116, 125, 135];
const STORAGE_KEY = 'pallets_font_scale';

export const FontSizeStepper: React.FC = () => {
  const [currentScale, setCurrentScale] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (SCALE_LEVELS.includes(parsed)) {
          return parsed;
        }
      }
    } catch {
      // Ignorar si localStorage no está disponible
    }
    return 100;
  });

  useEffect(() => {
    // Aplicar al elemento raíz html para que todos los rem escalen proporcionalmente
    document.documentElement.style.fontSize = `${currentScale}%`;
    try {
      localStorage.setItem(STORAGE_KEY, String(currentScale));
    } catch {
      // Ignorar si localStorage no está disponible
    }
  }, [currentScale]);

  const currentIndex = SCALE_LEVELS.indexOf(currentScale);
  const canDecrease = currentIndex > 0;
  const canIncrease = currentIndex < SCALE_LEVELS.length - 1;

  const handleDecrease = () => {
    if (canDecrease) {
      setCurrentScale(SCALE_LEVELS[currentIndex - 1]);
    }
  };

  const handleIncrease = () => {
    if (canIncrease) {
      setCurrentScale(SCALE_LEVELS[currentIndex + 1]);
    }
  };

  return (
    <div 
      className="inline-flex items-center gap-1 px-1.5 py-1 rounded-xl bg-slate-50 border border-slate-300 shadow-2xs select-none"
      title="Ajuste ergonómico de tamaño de letra para operadores de planta (Mínimo: 100%)"
    >
      <div className="flex items-center gap-1 text-slate-500 pl-1 pr-0.5">
        <Type className="w-3.5 h-3.5 text-[#0047AB]" />
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 hidden sm:inline">
          Letra
        </span>
      </div>

      {/* Botón Disminuir (Mínimo 100%) */}
      <button
        type="button"
        onClick={handleDecrease}
        disabled={!canDecrease}
        aria-label="Disminuir tamaño de letra"
        className="
          w-6 h-6 rounded-lg flex items-center justify-center
          bg-white hover:bg-slate-100 border border-slate-200 text-slate-700
          transition-all cursor-pointer shadow-2xs active:scale-95
          disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white
        "
        title={canDecrease ? `Reducir tamaño a ${SCALE_LEVELS[currentIndex - 1]}%` : 'Tamaño mínimo alcanzado (100%)'}
      >
        <Minus className="w-3 h-3 stroke-[2.5]" />
      </button>

      {/* Píldora de Porcentaje Actual */}
      <span className="
        min-w-[44px] px-1.5 py-0.5 rounded-lg text-center font-mono font-black text-xs
        bg-white border border-slate-200 text-slate-900 shadow-2xs
      ">
        {currentScale}%
      </span>

      {/* Botón Aumentar */}
      <button
        type="button"
        onClick={handleIncrease}
        disabled={!canIncrease}
        aria-label="Aumentar tamaño de letra"
        className="
          w-6 h-6 rounded-lg flex items-center justify-center
          bg-white hover:bg-slate-100 border border-slate-200 text-[#0047AB]
          transition-all cursor-pointer shadow-2xs active:scale-95
          disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white
        "
        title={canIncrease ? `Aumentar tamaño a ${SCALE_LEVELS[currentIndex + 1]}%` : 'Tamaño máximo alcanzado (135%)'}
      >
        <Plus className="w-3 h-3 stroke-[2.5]" />
      </button>
    </div>
  );
};
