import React, { createContext, useContext, useEffect, useState } from 'react';
import type { ChromeTheme, AppThemeOption } from '../types';
import { storageService } from '../services/storageService';

/**
 * Catálogo Oficial de 15 Temas Homologados con MD5 Kimberly-Clark
 * (4 Oscuros, 3 Blancos / Claros y 8 Temáticos de Color)
 * Sin redundancias y 100% compatible con Windows 10 LTSC / Edge Kiosco.
 */
export const APP_THEMES_ORDERED: AppThemeOption[] = [
  // --- GRUPO 1: TEMAS OSCUROS (4) ---
  {
    id: 'royal-navy',
    orden: 1,
    categoria: 'oscuro',
    categoriaEtiqueta: 'Oscuro',
    nivelEtiqueta: 'Oficial · Default',
    nombre: 'Royal Navy MD5',
    descripcion: 'Azul marino oficial estándar de Kimberly-Clark con acentos celestiales',
    previewHeader: '#0f172a',
    previewCockpit: '#1e293b',
    previewAccent: '#3C93CB',
  },
  {
    id: 'kcm-deep-blue',
    orden: 2,
    categoria: 'oscuro',
    categoriaEtiqueta: 'Oscuro',
    nivelEtiqueta: 'Azul KCM Profundo',
    nombre: 'KCM Deep Blue',
    descripcion: 'Azul corporativo profundo de alta elegancia y contraste industrial',
    previewHeader: '#001f3f',
    previewCockpit: '#003366',
    previewAccent: '#3C93CB',
  },
  {
    id: 'kcm-sapphire-plat',
    orden: 3,
    categoria: 'oscuro',
    categoriaEtiqueta: 'Oscuro',
    nivelEtiqueta: 'Oscuro Suave',
    nombre: 'Sapphire Platinum',
    descripcion: 'Gris zafiro pizarra de bajo cansancio visual para turnos largos',
    previewHeader: '#1e293b',
    previewCockpit: '#334155',
    previewAccent: '#60a5fa',
  },
  {
    id: 'negro-obsidiana',
    orden: 4,
    categoria: 'oscuro',
    categoriaEtiqueta: 'Oscuro',
    nivelEtiqueta: 'Máximo Oscuro',
    nombre: 'Negro Obsidiana Carbono',
    descripcion: 'Negro carbón puro con acentos esmeralda para turnos nocturnos en planta',
    previewHeader: '#050508',
    previewCockpit: '#090b10',
    previewAccent: '#10b981',
  },

  // --- GRUPO 2: TEMAS BLANCOS / CLAROS (3) ---
  {
    id: 'blanco-platino',
    orden: 5,
    categoria: 'blanco',
    categoriaEtiqueta: 'Blanco',
    nivelEtiqueta: 'Blanco Puro',
    nombre: 'Blanco Platino Industrial',
    descripcion: 'Diseño blanco nítido minimalista de máxima luminosidad y claridad en planta',
    previewHeader: '#ffffff',
    previewCockpit: '#003888',
    previewAccent: '#0047ab',
  },
  {
    id: 'gris-hielo',
    orden: 6,
    categoria: 'blanco',
    categoriaEtiqueta: 'Blanco',
    nivelEtiqueta: 'Blanco Nórdico',
    nombre: 'Gris Hielo Nórdico',
    descripcion: 'Fondo blanco frío con matices en azul cielo y lectura ultra descansada',
    previewHeader: '#f0f5fa',
    previewCockpit: '#1e3a8a',
    previewAccent: '#0284c7',
  },
  {
    id: 'blanco-marfil',
    orden: 7,
    categoria: 'blanco',
    categoriaEtiqueta: 'Blanco',
    nivelEtiqueta: 'Blanco Cálido',
    nombre: 'Blanco Marfil Clásico',
    descripcion: 'Tono marfil corporativo suave con filetes en azul marino institucional KCM',
    previewHeader: '#faf8f2',
    previewCockpit: '#002868',
    previewAccent: '#d97706',
  },

  // --- GRUPO 3: TEMÁTICOS DE COLOR (8) ---
  {
    id: 'kcm-cyan-pro',
    orden: 8,
    categoria: 'color',
    categoriaEtiqueta: 'Color',
    nivelEtiqueta: 'Azul Glaciar Cyber',
    nombre: 'KCM Cyan Pro',
    descripcion: 'Azul oceánico profundo con líneas cian neón de alta tecnología y brillo nítido',
    previewHeader: '#082f49',
    previewCockpit: '#0c4a6e',
    previewAccent: '#38bdf8',
  },
  {
    id: 'kcm-emerald',
    orden: 9,
    categoria: 'color',
    categoriaEtiqueta: 'Color',
    nivelEtiqueta: 'Ecológico / Calidad',
    nombre: 'Verde Esmeralda Planta',
    descripcion: 'Verde bosque y esmeralda profundo representativo de calidad y auditoría',
    previewHeader: '#064e3b',
    previewCockpit: '#065f46',
    previewAccent: '#34d399',
  },
  {
    id: 'kcm-amber-sunset',
    orden: 10,
    categoria: 'color',
    categoriaEtiqueta: 'Color',
    nivelEtiqueta: 'Industrial Ámbar',
    nombre: 'Ámbar Ocaso Industrial',
    descripcion: 'Bronce metálico y ámbar dorado de gran visibilidad para líneas y montacargas',
    previewHeader: '#451a03',
    previewCockpit: '#78350f',
    previewAccent: '#fbbf24',
  },
  {
    id: 'rojo-carmin',
    orden: 11,
    categoria: 'color',
    categoriaEtiqueta: 'Color',
    nivelEtiqueta: 'Institucional Kimberly',
    nombre: 'Rojo Carmín Kimberly',
    descripcion: 'Rojo rubí institucional de alta energía y máxima presencia visual',
    previewHeader: '#881337',
    previewCockpit: '#4c0519',
    previewAccent: '#f43f5e',
  },
  {
    id: 'purpura-amatista',
    orden: 12,
    categoria: 'color',
    categoriaEtiqueta: 'Color',
    nivelEtiqueta: 'Amatista Imperial',
    nombre: 'Púrpura Amatista Imperial',
    descripcion: 'Violeta real profundo con contrastes lila neón de máxima elegancia visual',
    previewHeader: '#3b0764',
    previewCockpit: '#2e1065',
    previewAccent: '#c084fc',
  },
  {
    id: 'verde-jade',
    orden: 13,
    categoria: 'color',
    categoriaEtiqueta: 'Color',
    nivelEtiqueta: 'Verde Jade Menta',
    nombre: 'Verde Jade Menta',
    descripcion: 'Verde jade y menta industrial fresco de alto descanso óptico en jornadas largas',
    previewHeader: '#064e3b',
    previewCockpit: '#0f766e',
    previewAccent: '#2dd4bf',
  },
  {
    id: 'naranja-cobre',
    orden: 14,
    categoria: 'color',
    categoriaEtiqueta: 'Color',
    nivelEtiqueta: 'Cobre Forja',
    nombre: 'Naranja Cobre Forja',
    descripcion: 'Cobre metálico y naranja quemado de alto impacto para terminales en planta',
    previewHeader: '#7c2d12',
    previewCockpit: '#9a3412',
    previewAccent: '#fb923c',
  },
  {
    id: 'magenta-fusion',
    orden: 15,
    categoria: 'color',
    categoriaEtiqueta: 'Color',
    nivelEtiqueta: 'Rubí Fusión',
    nombre: 'Magenta Rubí Fusión',
    descripcion: 'Magenta rubí vibrante con acentos fucsia luminosos para máxima visibilidad',
    previewHeader: '#500724',
    previewCockpit: '#831843',
    previewAccent: '#f472b6',
  },
];

interface ThemeContextType {
  theme: ChromeTheme;
  themeOption: AppThemeOption;
  setTheme: (theme: ChromeTheme) => void;
  availableThemes: { id: ChromeTheme; name: string; color: string }[];
  themesOrdered: AppThemeOption[];
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ChromeTheme>(() => {
    const saved = storageService.getTheme();
    if (saved && APP_THEMES_ORDERED.some(t => t.id === saved)) {
      return saved;
    }
    return 'royal-navy';
  });

  const setTheme = (newTheme: ChromeTheme) => {
    setThemeState(newTheme);
    storageService.setTheme(newTheme);
  };

  useEffect(() => {
    // Aplicar clase al body y al html para compatibilidad universal
    const elements = [document.body, document.documentElement];
    elements.forEach(el => {
      if (!el) return;
      APP_THEMES_ORDERED.forEach(t => el.classList.remove(`theme-${t.id}`));
      el.classList.add(`theme-${theme}`);
    });
  }, [theme]);

  const themeOption = APP_THEMES_ORDERED.find(t => t.id === theme) || APP_THEMES_ORDERED[0];

  const availableThemes = APP_THEMES_ORDERED.map(t => ({
    id: t.id,
    name: t.nombre,
    color: t.previewHeader
  }));

  return (
    <ThemeContext.Provider value={{
      theme,
      themeOption,
      setTheme,
      availableThemes,
      themesOrdered: APP_THEMES_ORDERED
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
};