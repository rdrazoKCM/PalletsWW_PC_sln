// ==============================================================================
// Servicio de Tipografía Dinámica para Pallets Pañal PC
// Soporta cambio en caliente de fuentes corporativas con inyección global en el DOM
// ==============================================================================

export interface FontOption {
  id: string;
  nombre: string;
  descripcion: string;
  fontFamily: string;
  muestra: string;
}

export const FUENTES_DISPONIBLES: FontOption[] = [
  {
    id: 'segoe-ui',
    nombre: 'Segoe UI (Predeterminada)',
    descripcion: 'Nativa de Windows 10/11 LTSC de Planta (Máxima Nitidez)',
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    muestra: '1234567890 · HUGGIES TOALLAS HUMEDAS CUIDADO PURO',
  },
  {
    id: 'md5-estandar',
    nombre: 'Estándar MD5 (Kimberly-Clark)',
    descripcion: 'Estándar Oficial Manufactura Digital 5.0 (Quicksand / Outfit)',
    fontFamily: "'Quicksand', 'Outfit', 'Century Gothic', -apple-system, BlinkMacSystemFont, sans-serif",
    muestra: '1234567890 · HUGGIES TOALLAS HUMEDAS CUIDADO PURO',
  },
  {
    id: 'inter',
    nombre: 'Inter',
    descripcion: 'Diseño Suizo Moderno y Balanceado',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    muestra: '1234567890 · HUGGIES TOALLAS HUMEDAS CUIDADO PURO',
  },
  {
    id: 'roboto',
    nombre: 'Roboto',
    descripcion: 'Diseño Sans-Serif Moderno de Google (Muy Clara a Distancia)',
    fontFamily: "'Roboto', 'Helvetica Neue', Arial, sans-serif",
    muestra: '1234567890 · HUGGIES TOALLAS HUMEDAS CUIDADO PURO',
  },
  {
    id: 'monospace-pro',
    nombre: 'JetBrains Mono / Cascadia',
    descripcion: 'Tipografía Técnica Industrial (Cifras Tabulares de Alta Precisión)',
    fontFamily: "'JetBrains Mono', 'Cascadia Code', 'Consolas', monospace",
    muestra: '1234567890 · HUGGIES TOALLAS HUMEDAS CUIDADO PURO',
  },
];

const STORAGE_KEY_FONT = 'pallets_font_family';

export const fontService = {
  getFuentes(): FontOption[] {
    return FUENTES_DISPONIBLES;
  },

  getFuenteActivaId(): string {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_FONT);
      if (saved && FUENTES_DISPONIBLES.some(f => f.id === saved)) {
        return saved;
      }
    } catch {
      // Ignorar si localStorage no está disponible
    }
    // Segoe UI es la tipografía predeterminada por instrucción oficial
    return 'segoe-ui';
  },

  aplicarFuente(id: string): void {
    const fuente = FUENTES_DISPONIBLES.find(f => f.id === id) || FUENTES_DISPONIBLES[0];
    
    // 1. Guardar en localStorage
    try {
      localStorage.setItem(STORAGE_KEY_FONT, fuente.id);
    } catch { }

    // 2. Aplicar sobre variables CSS de Tailwind v4 y estilos de root/body
    document.documentElement.style.setProperty('--font-sans', fuente.fontFamily);
    document.body.style.setProperty('--font-sans', fuente.fontFamily);
    document.documentElement.style.fontFamily = fuente.fontFamily;
    document.body.style.fontFamily = fuente.fontFamily;

    // 3. Inyección forzada global e instantánea en el árbol DOM (Anti-sobreescritura CSS)
    let styleTag = document.getElementById('dynamic-kcc-font') as HTMLStyleElement | null;
    if (!styleTag) {
      styleTag = document.createElement('style');
      styleTag.id = 'dynamic-kcc-font';
      document.head.appendChild(styleTag);
    }

    styleTag.innerHTML = `
      :root, html, body, #root, #root *, button, input, select, textarea, .font-sans {
        font-family: ${fuente.fontFamily} !important;
      }
    `;
  },

  inicializarFuente(): void {
    const activeId = this.getFuenteActivaId();
    this.aplicarFuente(activeId);
  }
};
