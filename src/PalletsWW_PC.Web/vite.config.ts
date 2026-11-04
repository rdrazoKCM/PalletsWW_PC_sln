import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * Plugin de alta compatibilidad para Windows 10 (Edge Chromium < 99).
 * Desenvuelve (flattens) todos los bloques '@layer' generados por Tailwind CSS v4.
 * En versiones de Edge/Chrome anteriores a v99, los bloques '@layer' no reconocidos
 * son descartados por completo por el parser del navegador, dejando la app sin estilos.
 * Al aplanar '@layer', las clases utilitarias (.flex, .grid, .bg-slate-100, etc.) quedan
 * en el nivel raíz del CSS, funcionando en cualquier versión de navegador desde 2015+.
 */
function unwrapCssLayersPlugin(): Plugin {
  function unwrapCss(code: string): string {
    let result = '';
    let i = 0;
    while (i < code.length) {
      if (code.startsWith('@layer ', i)) {
        const openBrace = code.indexOf('{', i);
        const semi = code.indexOf(';', i);
        if (semi !== -1 && (openBrace === -1 || semi < openBrace)) {
          i = semi + 1;
          continue;
        }
        if (openBrace === -1) {
          result += code.slice(i);
          break;
        }
        let depth = 1;
        let j = openBrace + 1;
        let inString = false;
        let strChar = '';
        const contentStart = openBrace + 1;
        while (j < code.length && depth > 0) {
          const char = code[j];
          if (inString) {
            if (char === strChar && code[j - 1] !== '\\') {
              inString = false;
            }
          } else {
            if (char === '"' || char === "'") {
              inString = true;
              strChar = char;
            } else if (char === '{') {
              depth++;
            } else if (char === '}') {
              depth--;
            }
          }
          j++;
        }
        const layerContent = code.slice(contentStart, j - 1);
        result += unwrapCss(layerContent);
        i = j;
      } else {
        result += code[i];
        i++;
      }
    }
    return result;
  }

  return {
    name: 'unwrap-css-layers',
    enforce: 'post',
    generateBundle(_, bundle) {
      for (const fileName in bundle) {
        const file = bundle[fileName];
        if (fileName.endsWith('.css') && file.type === 'asset' && typeof file.source === 'string') {
          file.source = unwrapCss(file.source);
        }
      }
    },
    transform(code, id) {
      if (id.endsWith('.css') || id.includes('.css?')) {
        if (code.includes('@layer')) {
          return { code: unwrapCss(code), map: null };
        }
      }
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    unwrapCssLayersPlugin(),
  ],
  build: {
    // ES2015 garantiza compatibilidad con Edge/Chrome 79+ en Windows 10
    target: ['es2015', 'chrome79', 'edge79', 'firefox78'],
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false, // Mantener diagnósticos en consola
        drop_debugger: true,
      },
    },
    rollupOptions: {
      output: {
        // Separar vendors grandes para caché más eficiente en PCs de planta
        manualChunks(id: string) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-router')) {
            return 'react-vendor';
          }
          if (id.includes('node_modules/sweetalert2') || id.includes('node_modules/lucide-react')) {
            return 'ui-vendor';
          }
          if (id.includes('node_modules/chart.js')) {
            return 'chart-vendor';
          }
          if (id.includes('node_modules/jspdf')) {
            return 'pdf-vendor';
          }
        },
      },
    },
  },
  server: {
    port: 5106,
    proxy: {
      '/api': {
        target: 'http://localhost:5105',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})