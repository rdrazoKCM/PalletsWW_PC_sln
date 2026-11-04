import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { GlobalErrorBoundary } from './components/layout/GlobalErrorBoundary'
import { fontService } from './services/fontService'

// Inicializar tipografía guardada por el operador o configuración
fontService.inicializarFuente();

// Auto-recuperación ante despliegues en caliente en IIS:
// Si una terminal activa intenta descargar un chunk JS que ya fue reemplazado por una nueva versión,
// Vite dispara 'vite:preloadError'. Forzamos un reload suave para sincronizar inmediatamente sin pantalla en blanco.
window.addEventListener('vite:preloadError', (event) => {
  console.warn('[Vite Preload] Nueva versión detectada en IIS. Sincronizando bundle...');
  event.preventDefault();
  window.location.reload();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GlobalErrorBoundary>
      <App />
    </GlobalErrorBoundary>
  </StrictMode>,
)
