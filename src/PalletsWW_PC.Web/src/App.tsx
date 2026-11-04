import React, { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import { ProductionProvider, useProduction } from './context/ProductionContext';
import { ThemeProvider } from './context/ThemeContext';
import { AppLayout } from './components/layout/AppLayout';
import { CapturaPage } from './pages/CapturaPage';
import { ReportesPage } from './pages/ReportesPage';
import { AsistenciaPage } from './pages/AsistenciaPage';
import { AsistenciaGerencialPage } from './pages/AsistenciaGerencialPage';
import { ConfiguracionPage } from './pages/ConfiguracionPage';

import { APP_CONFIG, getNombreMaquinaOficial } from './config';
import { storageService } from './services/storageService';
import { initSingleInstanceGuard } from './services/singleInstanceGuard';
import { SplashScreen } from './components/layout/SplashScreen';
import { InactivityGuard } from './components/layout/InactivityGuard';
import { AlertTriangle, XCircle } from 'lucide-react';

// Manejador de ruta raíz según perfil activo (Producción vs Gerencia)
const RootRouteHandler: React.FC = () => {
  const { esGerencia } = useProduction();
  if (esGerencia) {
    return <Navigate to="/reportes" replace />;
  }
  return <CapturaPage />;
};

// Protección de vistas operativas de piso cuando el modo Gerencia está activo
const SoloProduccionGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { esGerencia } = useProduction();
  if (esGerencia) {
    return <Navigate to="/reportes" replace />;
  }
  return <>{children}</>;
};

// Protección de vistas gerenciales cuando el modo Producción está activo
const SoloGerenciaGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { esGerencia } = useProduction();
  if (!esGerencia) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
};

// Componente para sincronizar URL query parameters iniciales sin revertir elecciones del usuario
const QueryParamSync: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { setMaquina, setLineaEmpaque } = useProduction();
  const initialSyncDone = React.useRef(false);

  useEffect(() => {
    if (initialSyncDone.current) return;
    initialSyncDone.current = true;

    // Soporta parámetros tanto dentro del hash (#/?maquina=2&linea=B) como en la raíz (/?maquina=2&linea=B#/)
    const windowParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    
    // Máquina: solo tomar de URL si no está ya configurada en el equipo
    const storedMaq = storageService.getMaquinaId();
    const m = searchParams.get('maquina') || windowParams?.get('maquina');
    if (m && storedMaq <= 0) {
      const num = parseInt(m, 10);
      if (!isNaN(num) && num > 0) {
        setMaquina(num, getNombreMaquinaOficial(num));
      }
    }

    // Línea de empaque: respetar la persistencia del usuario en localStorage
    const storedLinea = localStorage.getItem(APP_CONFIG.storageKeys.lineaEmpaque);
    const l = searchParams.get('linea') || windowParams?.get('linea');
    if (l && !storedLinea) {
      let lineaNorm = l.trim().toUpperCase();
      if (lineaNorm === 'A') lineaNorm = '1';
      if (lineaNorm === 'B') lineaNorm = '2';
      if (lineaNorm === '1' || lineaNorm === '2') {
        setLineaEmpaque(lineaNorm);
      }
    }
  }, [searchParams, setMaquina, setLineaEmpaque]);

  return null;
};

function App() {
  const [isDuplicate, setIsDuplicate] = React.useState<boolean>(false);

  React.useEffect(() => {
    const cleanup = initSingleInstanceGuard(() => {
      setIsDuplicate(true);
      try {
        window.close();
      } catch { }
    });
    return cleanup;
  }, []);

  if (isDuplicate) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/95 text-slate-800 p-4 select-none">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl text-center border-2 border-kc-500 animate-in fade-in zoom-in duration-200">
          <div className="w-16 h-16 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-4 border border-amber-200 shadow-inner">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2 tracking-tight">
            Pallets Wipes ya está abierto
          </h2>
          <p className="text-sm text-slate-600 mb-6 leading-relaxed">
            Ya existe una ventana activa de la aplicación en esta computadora.
            Por control y seguridad de producción, solo se permite una ventana abierta a la vez.
          </p>
          <button
            type="button"
            onClick={() => window.close()}
            className="w-full py-3 px-4 bg-kc-600 hover:bg-kc-700 active:bg-kc-800 text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <XCircle className="w-5 h-5" />
            <span>Cerrar esta ventana</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <ThemeProvider>
      <ProductionProvider>
        <InactivityGuard>
          <SplashScreen />
          <HashRouter>
            <QueryParamSync />
            <Routes>
              <Route path="/" element={<AppLayout />}>
                <Route index element={<RootRouteHandler />} />
                <Route path="reportes" element={<ReportesPage />} />
                <Route 
                  path="auditoria-asistencia" 
                  element={
                    <SoloGerenciaGuard>
                      <AsistenciaGerencialPage />
                    </SoloGerenciaGuard>
                  } 
                />
                <Route 
                  path="asistencia" 
                  element={
                    <SoloProduccionGuard>
                      <AsistenciaPage />
                    </SoloProduccionGuard>
                  } 
                />
                <Route 
                  path="configuracion" 
                  element={
                    <SoloProduccionGuard>
                      <ConfiguracionPage />
                    </SoloProduccionGuard>
                  } 
                />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </HashRouter>
        </InactivityGuard>
      </ProductionProvider>
    </ThemeProvider>
  );
}

export default App;
