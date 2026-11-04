import React, { useState, useEffect, useCallback } from 'react';
import { 
  Cpu, 
  Check, 
  Printer, 
  Server, 
  RefreshCw, 
  ArrowLeft, 
  Eye, 
  EyeOff, 
  Lock, 
  Unlock, 
  CheckCircle2, 
  XCircle, 
  Database, 
  Layers, 
  Type, 
  Network, 
  Usb, 
  Save,
  ShieldAlert,
  ShieldCheck,
  ArrowRight,
  Clock,
  Minus,
  Plus
} from 'lucide-react';
import { Link } from 'react-router-dom';
import Swal from 'sweetalert2';
import { useProduction } from '../context/ProductionContext';
import { catalogosService } from '../services/catalogosService';
import { impresionService } from '../services/impresionService';
import { storageService } from '../services/storageService';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { APP_CONFIG, getNombreMaquinaOficial } from '../config';
import { fontService } from '../services/fontService';
import type { MaquinaDto } from '../types';

export const MAQUINAS_DEFAULT_WIPES: MaquinaDto[] = [
  { noMaquina: 9, descripcionMaquina: 'TXWW1' },
  { noMaquina: 16, descripcionMaquina: 'TXWW2' },
  { noMaquina: 53, descripcionMaquina: 'TXWW3' },
  { noMaquina: 54, descripcionMaquina: 'TXWW4' },
  { noMaquina: 55, descripcionMaquina: 'TXWW5' },
  { noMaquina: 67, descripcionMaquina: 'TXWW6' },
  { noMaquina: 70, descripcionMaquina: 'TXWW7' },
];

export const ConfiguracionPage: React.FC = () => {
  const { 
    maquinaId, 
    setMaquina, 
    printerStatus,
    verificarImpresora,
    inactivityTimeout,
    setInactivityTimeout,
    esGerencia,
    modoPerfil
  } = useProduction();

  const [selectedInactivity, setSelectedInactivity] = useState<number>(() => inactivityTimeout);

  useEffect(() => {
    setSelectedInactivity(inactivityTimeout);
  }, [inactivityTimeout]);

  const handleCambiarInactividad = (minutos: number) => {
    setSelectedInactivity(minutos);
    setInactivityTimeout(minutos);
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'success',
      title: minutos > 0 
        ? `Auto-cierre configurado a ${minutos} minutos` 
        : 'Auto-cierre desactivado (Nunca)',
      showConfirmButton: false,
      timer: 2000,
      timerProgressBar: true
    });
  };

  const [authorized, setAuthorized] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState<string>('');
  const [showPin, setShowPin] = useState<boolean>(false);
  const [pinError, setPinError] = useState<boolean>(false);

  const [maquinas, setMaquinas] = useState<MaquinaDto[]>(MAQUINAS_DEFAULT_WIPES);
  const [catalogSource, setCatalogSource] = useState<'local' | 'api'>('local');
  const [loadingMaquinas, setLoadingMaquinas] = useState<boolean>(false);
  const [selectedMaquinaId, setSelectedMaquinaId] = useState<number>(() => maquinaId > 0 ? maquinaId : 9);
  const [fuenteActivaId, setFuenteActivaId] = useState<string>(() => fontService.getFuenteActivaId());

  const handleCambiarFuente = (id: string) => {
    fontService.aplicarFuente(id);
    setFuenteActivaId(id);
    const fuente = fontService.getFuentes().find(f => f.id === id);
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'success',
      title: `Tipografía activa: ${fuente?.nombre || id}`,
      showConfirmButton: false,
      timer: 1800,
      timerProgressBar: true
    });
  };

  // Servidor IIS (Web & API) - 3 modos: Producción Oficial, Pruebas y Personalizado
  const [serverMode, setServerMode] = useState<'oficial' | 'pruebas' | 'personalizado'>(() => {
    const host = storageService.getServerIp();
    if (host === '10.26.24.31') return 'oficial';
    if (host === '10.26.24.37') return 'pruebas';
    return 'personalizado';
  });

  const [serverIpInput, setServerIpInput] = useState<string>(() => {
    return storageService.getServerIp();
  });

  const [serverPortInput, setServerPortInput] = useState<string>(() => {
    return storageService.getServerPort().toString();
  });

  const [savingServer, setSavingServer] = useState<boolean>(false);
  const [apiUrlInput, setApiUrlInput] = useState<string>(() => APP_CONFIG.apiBaseUrl);
  const [testingApi, setTestingApi] = useState<boolean>(false);
  const [apiStatus, setApiStatus] = useState<{ ok: boolean; ms?: number; message?: string } | null>(null);

  // Configuración de Impresora Zebra: USB Local vs Red IP
  const [printerMode, setPrinterMode] = useState<'USB' | 'Red'>('USB');
  const [printerIpInput, setPrinterIpInput] = useState<string>('');
  const [printerPortInput, setPrinterPortInput] = useState<string>('9100');
  const [savingPrinterConfig, setSavingPrinterConfig] = useState<boolean>(false);
  const [testingPrint, setTestingPrint] = useState<boolean>(false);
  const [testPrintResult, setTestPrintResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Cargar configuración de impresora y servidor desde PrintBridge local (http://127.0.0.1:9100/config)
  const loadPrinterBridgeConfig = useCallback(async () => {
    try {
      const resp = await fetch('http://127.0.0.1:9100/config');
      if (resp.ok) {
        const data = await resp.json();
        if (data) {
          const mode = (data.printMode && String(data.printMode).toLowerCase() === 'red') ? 'Red' : 'USB';
          setPrinterMode(mode);
          if (data.printerIp) setPrinterIpInput(String(data.printerIp));
          if (data.printerPort) setPrinterPortInput(String(data.printerPort));

          // En desarrollo local (localhost), sincronizar con la IP del servidor que PrintBridge tiene en settings.json
          if (typeof window !== 'undefined' && window.location) {
            const h = window.location.hostname;
            if ((!h || h === 'localhost' || h === '127.0.0.1') && data.serverIp) {
              const bridgeIp = String(data.serverIp).trim();
              if (bridgeIp) {
                setServerIpInput(bridgeIp);
                if (bridgeIp === '10.26.24.31') setServerMode('oficial');
                else if (bridgeIp === '10.26.24.37') setServerMode('pruebas');
                else setServerMode('personalizado');
                setApiUrlInput(`http://${bridgeIp}:5105`);
              }
            }
          }
        }
      }
    } catch {
      // PrintBridge no responde aún o no está instalado en este equipo
    }
  }, []);

  // Cargar máquinas de la API con fallback garantizado a las 7 oficiales de Wipes
  const loadMaquinas = useCallback(async () => {
    setLoadingMaquinas(true);
    try {
      const data = await catalogosService.getMaquinas();
      if (data && data.length > 0) {
        const enriched = data.map((d) => {
          const match = MAQUINAS_DEFAULT_WIPES.find((m) => m.noMaquina === d.noMaquina);
          return {
            noMaquina: d.noMaquina,
            descripcionMaquina: match ? match.descripcionMaquina : (d.descripcionMaquina || `Máquina ${d.noMaquina}`),
          };
        });
        setMaquinas(enriched);
        setCatalogSource('api');
      } else {
        setMaquinas(MAQUINAS_DEFAULT_WIPES);
        setCatalogSource('local');
      }
    } catch (err: any) {
      console.warn('Backend API no disponible en puerto 5105, usando catálogo oficial de Planta Wipes:', err);
      setMaquinas(MAQUINAS_DEFAULT_WIPES);
      setCatalogSource('local');
    } finally {
      setLoadingMaquinas(false);
    }
  }, []);

  useEffect(() => {
    if (authorized) {
      loadMaquinas();
      loadPrinterBridgeConfig();
    }
  }, [authorized, loadMaquinas, loadPrinterBridgeConfig]);

  const handleVerifyPin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPin = pinInput.trim();
    // Claves maestras de acceso TI autorizadas
    const CLAVES_TI_AUTORIZADAS = ['w0rdP@$$', 'Kimberly2026', 'kcc123'];
    if (CLAVES_TI_AUTORIZADAS.includes(cleanPin)) {
      setAuthorized(true);
      setPinError(false);
    } else {
      setPinError(true);
    }
  };

  // Guardar asignación de máquina
  const handleSaveMaquina = async () => {
    if (selectedMaquinaId <= 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Seleccione una Máquina',
        text: 'Debe seleccionar una máquina física de Depto Wipes.',
        confirmButtonColor: '#0047AB',
      });
      return;
    }

    const m = maquinas.find((x) => x.noMaquina === selectedMaquinaId) 
      || MAQUINAS_DEFAULT_WIPES.find((x) => x.noMaquina === selectedMaquinaId);
    const desc = getNombreMaquinaOficial(selectedMaquinaId, m?.descripcionMaquina);
    setMaquina(selectedMaquinaId, desc);

    // Sincronizar con PrintBridge local para persistir en settings.json y actualizar accesos directos
    let bridgeOk = false;
    try {
      const cleanIp = serverIpInput.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '').replace(/:.*$/, '') || '10.26.24.31';
      const cleanPort = parseInt(serverPortInput || '5106', 10) || 5106;
      const resp = await fetch('http://127.0.0.1:9100/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          machineId: selectedMaquinaId,
          machineName: desc,
          serverIp: cleanIp,
          serverPort: cleanPort
        })
      });
      if (resp.ok) bridgeOk = true;
    } catch { }

    Swal.fire({
      icon: 'success',
      title: '¡Máquina Asignada con Éxito!',
      html: `
        <div class="text-left text-sm space-y-2 p-1">
          <p><strong>Máquina Oficial:</strong> <span class="text-kc-600 font-bold">${desc}</span> (ID: ${selectedMaquinaId})</p>
          <p><strong>Configuración de Planta:</strong> <span class="font-bold text-slate-700">1 PC compartida atiende Línea 1 y Línea 2</span></p>
          <p><strong>Accesos Directos de Windows:</strong> <span class="font-bold ${bridgeOk ? 'text-emerald-700' : 'text-slate-500'}">${bridgeOk ? 'Actualizados automáticamente en el Escritorio' : 'Guardado localmente en esta terminal'}</span></p>
          <div class="mt-2 text-xs text-slate-500 border-t border-slate-200 pt-2">
            La terminal iniciará por omisión en esta máquina en las próximas sesiones.
          </div>
        </div>
      `,
      confirmButtonColor: '#0047AB',
    });
  };

  // Guardar Servidor IIS (3 Formas)
  const handleSelectServerMode = (mode: 'oficial' | 'pruebas' | 'personalizado') => {
    setServerMode(mode);
    if (mode === 'oficial') {
      setServerIpInput('10.26.24.31');
      setServerPortInput('5106');
      setApiUrlInput('http://10.26.24.31:5105');
    } else if (mode === 'pruebas') {
      setServerIpInput('10.26.24.37');
      setServerPortInput('5106');
      setApiUrlInput('http://10.26.24.37:5105');
    }
  };

  const handleSaveServer = async (targetIp?: string, targetPort?: string) => {
    const rawIp = targetIp || serverIpInput;
    const cleanIp = rawIp.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '').replace(/:.*$/, '');
    const cleanPort = parseInt(targetPort || serverPortInput || '5106', 10) || 5106;

    if (!cleanIp) {
      Swal.fire({
        icon: 'warning',
        title: 'Dirección Requerida',
        text: 'Debe ingresar una dirección IP o nombre de host válido para el servidor IIS.',
        confirmButtonColor: '#0047AB'
      });
      return;
    }

    setSavingServer(true);
    try {
      storageService.setServerConfig(cleanIp, cleanPort);
      setServerIpInput(cleanIp);
      setServerPortInput(cleanPort.toString());
      setApiUrlInput(`http://${cleanIp}:5105`);

      let shortcutUpdated = false;
      try {
        const resp = await fetch('http://127.0.0.1:9100/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            machineId: selectedMaquinaId,
            serverIp: cleanIp,
            serverPort: cleanPort
          })
        });
        if (resp.ok) shortcutUpdated = true;
      } catch { }

      await Swal.fire({
        icon: 'success',
        title: '¡Servidor IIS Configurado!',
        html: `
          <div class="text-left text-sm space-y-2 p-1">
            <p><strong>Servidor Guardado:</strong> <span class="text-kc-600 font-bold">${cleanIp}:${cleanPort}</span></p>
            <p><strong>API Backend:</strong> <span class="font-mono text-slate-700">http://${cleanIp}:5105</span></p>
            <p><strong>Accesos Directos de Windows:</strong> <span class="font-bold ${shortcutUpdated ? 'text-emerald-700' : 'text-amber-600'}">${shortcutUpdated ? 'Actualizados automáticamente en el Escritorio y Menú Inicio' : 'Se actualizarán al abrir PrintBridge'}</span></p>
            <div class="mt-2 text-xs text-slate-500 border-t border-slate-200 pt-2">
              Redirigiendo a la nueva dirección en 2 segundos...
            </div>
          </div>
        `,
        confirmButtonColor: '#0047AB',
        timer: 2500,
        timerProgressBar: true
      });

      window.location.href = `http://${cleanIp}:${cleanPort}/#/configuracion`;
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: 'Error al Guardar Servidor',
        text: err.message || 'No se pudo actualizar la configuración del servidor IIS.',
        confirmButtonColor: '#0047AB'
      });
    } finally {
      setSavingServer(false);
    }
  };

  // Guardar Configuración de Impresora Zebra (USB vs Red IP)
  const handleSavePrinterConfig = async () => {
    setSavingPrinterConfig(true);
    try {
      const payload: any = {
        printMode: printerMode,
        machineId: selectedMaquinaId,
      };

      if (printerMode === 'Red') {
        const cleanIp = printerIpInput.trim();
        if (!cleanIp) {
          Swal.fire({
            icon: 'warning',
            title: 'IP de Impresora Requerida',
            text: 'Debe ingresar la dirección IP de red de la impresora térmica Zebra (ej. 10.26.x.x).',
            confirmButtonColor: '#0047AB',
          });
          setSavingPrinterConfig(false);
          return;
        }
        payload.printerIp = cleanIp;
        payload.printerPort = parseInt(printerPortInput.trim() || '9100', 10) || 9100;
      } else {
        payload.printerIp = '';
        payload.printerPort = 9100;
      }

      const resp = await fetch('http://127.0.0.1:9100/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!resp.ok) {
        throw new Error(`PrintBridge devolvió código HTTP ${resp.status}`);
      }

      await verificarImpresora();

      Swal.fire({
        icon: 'success',
        title: '¡Configuración de Impresora Guardada!',
        html: `
          <div class="text-left text-sm space-y-2 p-1">
            <p><strong>Modo de Impresión:</strong> <span class="text-kc-600 font-bold">${printerMode === 'Red' ? 'RED ETHERNET (IP)' : 'USB LOCAL (Cable)'}</span></p>
            ${printerMode === 'Red' ? `<p><strong>Destino de Red:</strong> <span class="font-mono font-bold text-slate-800">${printerIpInput.trim()}:${printerPortInput.trim() || '9100'}</span></p>` : '<p><strong>Destino:</strong> <span class="font-semibold text-slate-700">Impresora Zebra conectada vía USB</span></p>'}
            <div class="mt-2 text-xs text-slate-500 border-t border-slate-200 pt-2">
              El microservicio local Zebra PrintBridge quedó configurado y listo para emitir etiquetas.
            </div>
          </div>
        `,
        confirmButtonColor: '#0047AB',
      });
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: 'Error de Comunicación con PrintBridge',
        text: 'Asegúrese de que el servicio Pallets PrintBridge esté ejecutándose en la bandeja del sistema (puerto 9100). Error: ' + (err.message || 'Sin conexión'),
        confirmButtonColor: '#0047AB',
      });
    } finally {
      setSavingPrinterConfig(false);
    }
  };

  const handleTestPrint = async () => {
    setTestingPrint(true);
    setTestPrintResult(null);
    try {
      // 1. Intentar prueba directa mediante PrintBridge local
      const resp = await fetch('http://127.0.0.1:9100/test-print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          printMode: printerMode,
          printerIp: printerMode === 'Red' ? printerIpInput.trim() : undefined,
          printerPort: printerMode === 'Red' ? (parseInt(printerPortInput, 10) || 9100) : undefined
        })
      });

      if (resp.ok) {
        const data = await resp.json();
        setTestPrintResult({ ok: true, message: data.message || 'Etiqueta de prueba enviada exitosamente.' });
        await verificarImpresora();
        Swal.fire({
          icon: 'success',
          title: '¡Etiqueta de Prueba Impresa!',
          text: data.message || `Etiqueta de prueba enviada exitosamente a la impresora (${printerMode}).`,
          confirmButtonColor: '#0047AB',
        });
        return;
      }

      // Fallback a inyección ZPL directa de prueba
      const zplTest = `^XA^FO50,50^A0N,40,40^FDKIMBERLY-CLARK DE MEXICO^FS^FO50,110^A0N,30,30^FDPALLETS WIPES - PRUEBA^FS^FO50,160^A0N,25,25^FD${new Date().toLocaleString()}^FS^XZ`;
      const respZpl = await impresionService.inyectarZplDirecto(zplTest);
      const ok = !!respZpl?.exito;
      setTestPrintResult({
        ok,
        message: ok ? 'Etiqueta de prueba enviada con éxito a Zebra' : (respZpl?.mensaje || 'No se pudo comunicar con la impresora Zebra')
      });
      await verificarImpresora();
    } catch (err: any) {
      setTestPrintResult({
        ok: false,
        message: `Error al intentar imprimir: ${err.message || 'Sin conexión'}`
      });
    } finally {
      setTestingPrint(false);
    }
  };

  const handleTestApi = async () => {
    setTestingApi(true);
    const start = performance.now();
    try {
      const data = await catalogosService.getMaquinas();
      const elapsed = Math.round(performance.now() - start);
      setApiStatus({
        ok: true,
        ms: elapsed,
        message: `Conexión exitosa con Backend API (${elapsed} ms). Catálogo respondió con ${data.length} máquinas.`
      });
    } catch (err: any) {
      setApiStatus({
        ok: false,
        message: `Fallo de conexión con API (${apiUrlInput}): ${err.message || 'Servidor no responde'}`
      });
    } finally {
      setTestingApi(false);
    }
  };

  if (!authorized) {
    return (
      <div className="fixed inset-0 z-50 bg-[#030a19] text-slate-100 flex flex-col justify-between p-4 overflow-y-auto font-sans select-none">
        {/* Grid Neón de Fondo (Estándar Corporativo MD5) */}
        <div
          className="absolute inset-0 opacity-[0.05] pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(to right, rgba(56, 189, 248, 0.15) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(56, 189, 248, 0.15) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px'
          }}
        />

        {/* Halos de luz radial ambiental en el centro y esquinas */}
        <div className="absolute top-[-10%] left-[-5%] w-[50vw] h-[50vw] max-w-[650px] max-h-[650px] bg-kc-600/20 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[50vw] h-[50vw] max-w-[650px] max-h-[650px] bg-cyan-600/15 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[70vw] h-[35vw] bg-sky-500/10 rounded-full blur-[160px] pointer-events-none" />

        {/* CONTENEDOR CENTRAL */}
        <main className="flex-1 flex flex-col items-center justify-center z-10 w-full max-w-[390px] mx-auto my-auto py-6">
          {/* LOGOTIPO CORPORATIVO Y TÍTULO */}
          <div className="text-center mb-5 flex flex-col items-center">
            <div className="flex justify-center w-full mb-2.5 relative">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 bg-cyan-500/20 rounded-full blur-2xl pointer-events-none" />
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-kc-600 via-sky-600 to-cyan-500 p-0.5 shadow-[0_0_25px_rgba(14,165,233,0.4)] relative z-10">
                <div className="w-full h-full bg-[#081735] rounded-[14px] flex items-center justify-center">
                  <ShieldCheck className="w-7 h-7 text-cyan-400" />
                </div>
              </div>
            </div>

            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white uppercase flex items-center justify-center gap-1.5 drop-shadow-[0_4px_25px_rgba(0,0,0,0.8)]">
              <span>PALLETS</span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-cyan-300 to-blue-500">WIPES</span>
            </h1>

            <div className="mt-1 flex items-center justify-center">
              <span className="text-[9.5px] font-black px-2.5 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 tracking-widest uppercase shadow-[0_0_12px_rgba(34,211,238,0.2)]">
                CONFIGURACIÓN TI
              </span>
            </div>

            <div className="flex items-center justify-center gap-2 mt-2">
              <div className="h-px w-6 bg-gradient-to-r from-transparent to-cyan-500/60" />
              <p className="text-[8.5px] sm:text-[9px] font-black text-slate-300 uppercase tracking-[0.20em]">
                KIMBERLY-CLARK DE MÉXICO • PLANTA TLAXCALA
              </p>
              <div className="h-px w-6 bg-gradient-to-l from-transparent to-cyan-500/60" />
            </div>
          </div>

          {/* CONTENEDOR TARJETA CON HUD INDUSTRIAL */}
          <div className="w-full relative">
            {/* Esquinas Industriales HUD */}
            <div className="absolute -top-2.5 -left-2.5 w-4 h-4 border-t-2 border-l-2 border-cyan-400 z-20 pointer-events-none" />
            <div className="absolute -top-2.5 -right-2.5 w-4 h-4 border-t-2 border-r-2 border-cyan-400 z-20 pointer-events-none" />
            <div className="absolute -bottom-2.5 -left-2.5 w-4 h-4 border-b-2 border-l-2 border-cyan-400 z-20 pointer-events-none" />
            <div className="absolute -bottom-2.5 -right-2.5 w-4 h-4 border-b-2 border-r-2 border-cyan-400 z-20 pointer-events-none" />

            {/* Tarjeta de Cristal Glassmorphic */}
            <div className="bg-[#081735]/85 backdrop-blur-2xl border border-sky-500/30 rounded-[2.2rem] px-7 py-8 sm:px-8 sm:py-9 shadow-[0_30px_80px_rgba(0,0,0,0.9)] relative z-10 flex flex-col gap-5 ring-1 ring-cyan-500/20">
              {/* Cabecera de la tarjeta */}
              <div className="text-center">
                <span className="text-[8.5px] font-black tracking-[0.25em] text-cyan-400 uppercase block mb-0.5">SEGURIDAD Y CONTROL</span>
                <h2 className="text-base sm:text-lg font-black text-white uppercase tracking-wider">ACCESO ADMINISTRATIVO TI</h2>
              </div>

              {/* Mensaje Informativo para Administradores de TI */}
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-[11px] text-amber-200 flex items-start gap-2.5 shadow-inner">
                <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span className="font-medium leading-relaxed">
                  Este menú es de uso exclusivo para <strong className="text-amber-300">Administradores de TI y Sistemas</strong>. Las opciones permiten reconfigurar el servidor IIS, puertos y hardware de impresión.
                </span>
              </div>

              {/* FORMULARIO DE ACCESO POR CONTRASEÑA */}
              <form onSubmit={handleVerifyPin} className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-1.5 ml-1">
                    <label className="block text-[0.6rem] font-black text-slate-300 uppercase tracking-widest">
                      CONTRASEÑA ADMINISTRADOR TI
                    </label>
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowPin(!showPin)}
                      className="text-[0.6rem] font-extrabold text-cyan-400 hover:text-cyan-300 uppercase tracking-wider cursor-pointer"
                    >
                      {showPin ? "OCULTAR" : "MOSTRAR"}
                    </button>
                  </div>

                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-cyan-400 transition-colors">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showPin ? "text" : "password"}
                      required
                      autoFocus
                      value={pinInput}
                      onChange={(e) => {
                        setPinInput(e.target.value);
                        if (pinError) setPinError(false);
                      }}
                      className={`w-full bg-slate-950/80 border ${
                        pinError 
                          ? 'border-rose-500/80 ring-2 ring-rose-500/20 text-rose-200' 
                          : 'border-slate-700/80 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 text-white'
                      } rounded-2xl pl-10 pr-11 py-3.5 text-xs placeholder-slate-500 outline-none font-bold transition-all shadow-inner`}
                      placeholder="••••••••••••"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowPin(!showPin)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-cyan-300 transition-colors cursor-pointer"
                    >
                      {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {pinError && (
                    <p className="text-[11px] text-rose-400 font-semibold mt-1.5 ml-1 flex items-center gap-1">
                      <XCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>Contraseña incorrecta. Acceso exclusivo para TI.</span>
                    </p>
                  )}
                </div>

                {/* BOTÓN INICIAR SESIÓN */}
                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-kc-600 via-sky-600 to-cyan-500 hover:from-blue-500 hover:via-sky-500 hover:to-cyan-400 text-white font-black py-3.5 rounded-2xl transition-all shadow-[0_0_25px_rgba(14,165,233,0.4)] mt-2 text-xs tracking-widest uppercase flex items-center justify-center gap-2 cursor-pointer active:scale-98 border border-cyan-400/30"
                >
                  <Unlock className="w-4 h-4" />
                  <span>DESBLOQUEAR MENÚ TI</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>

              {/* Botón Volver a Captura */}
              <div className="text-center pt-2 border-t border-slate-800/80">
                <Link
                  to="/"
                  className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-cyan-300 font-semibold transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Volver a Captura de Pallets</span>
                </Link>
              </div>
            </div>
          </div>
        </main>

        {/* DERECHOS RESERVADOS AL PIE */}
        <footer className="w-full py-2.5 text-center z-20 text-[9.5px] font-extrabold text-slate-500 uppercase tracking-widest">
          © {new Date().getFullYear()} KIMBERLY-CLARK DE MÉXICO S.A.B. DE C.V. • PLANTA TLAXCALA
        </footer>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ENCABEZADO DE PÁGINA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="p-2 rounded-lg border border-slate-300 text-slate-600 hover:text-kc-600 hover:bg-slate-50 transition-colors cursor-pointer"
            title="Volver a Captura de Pallets"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Cpu className="w-6 h-6 text-kc-600" />
              Configuración y Diagnósticos de Terminal
            </h1>
            <p className="text-xs text-slate-500">
              Pallets Wipes PC · Planta Tlaxcala · Modo Administrador TI Habilitado
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Acceso Autorizado TI
          </span>
          <button
            type="button"
            onClick={() => setAuthorized(false)}
            className="px-2.5 py-1 text-xs text-slate-500 hover:text-red-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            title="Bloquear configuración"
          >
            Bloquear
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* COLUMNA IZQUIERDA Y CENTRAL: ASIGNACIÓN DE MÁQUINA Y TIPOGRAFÍA (2 COLUMNAS) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* TARJETA 1: ASIGNACIÓN DE MÁQUINA DE PLANTA WIPES */}
          <Card className="p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Cpu className="w-5 h-5 text-kc-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-800">
                    Asignación de Máquina (Depto Wipes)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Seleccione la máquina física asignada a esta PC. Cada terminal atiende simultáneamente Línea 1 y Línea 2.
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-kc-100 text-kc-800 border border-kc-200">
                Máquina Activa: {selectedMaquinaId ? getNombreMaquinaOficial(selectedMaquinaId) : 'Sin Asignar'}
              </span>
            </div>

            {/* Selector Rápido Dropdown y Recarga de Catálogo */}
            <div className="p-3 bg-white rounded-lg border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-kc-600 shrink-0" />
                <label htmlFor="select-maquina-dd" className="text-xs font-bold text-slate-700">
                  Selección Rápida:
                </label>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <select
                  id="select-maquina-dd"
                  value={selectedMaquinaId}
                  onChange={(e) => setSelectedMaquinaId(Number(e.target.value))}
                  className="w-full sm:w-80 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-kc-600 cursor-pointer"
                >
                  <option value={0}>-- Seleccione Máquina --</option>
                  {maquinas.map((m) => (
                    <option key={m.noMaquina} value={m.noMaquina}>
                      {m.descripcionMaquina} (ID: {m.noMaquina})
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={loadMaquinas}
                  disabled={loadingMaquinas}
                  title="Recargar catálogo desde API"
                  className="p-1.5 rounded-lg border border-slate-300 text-slate-600 hover:text-kc-600 hover:bg-slate-50 cursor-pointer disabled:opacity-50 shrink-0"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingMaquinas ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Banner de Estado del Catálogo */}
            <div className={`p-2.5 rounded-lg text-xs flex items-center justify-between border ${
              catalogSource === 'api' 
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                : 'bg-blue-50 text-blue-800 border-blue-200'
            }`}>
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 shrink-0" />
                <span>
                  {catalogSource === 'api' 
                    ? 'Catálogo sincronizado en tiempo real con Base de Datos SQL Server (TLX009MXDB).' 
                    : 'Modo Local Oficial: Catálogo con las 7 máquinas estándar de Planta Wipes.'}
                </span>
              </div>
              <span className={`px-2 py-0.5 rounded text-[11px] font-bold shrink-0 ${
                catalogSource === 'api' ? 'bg-emerald-200 text-emerald-900' : 'bg-blue-200 text-blue-900'
              }`}>
                {maquinas.length} Máquinas Oficiales
              </span>
            </div>

            {/* Cuadrícula de Máquinas */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Haga clic sobre la máquina deseada para asignarla:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {maquinas.map((m) => {
                  const isSelected = selectedMaquinaId === m.noMaquina;
                  return (
                    <button
                      key={m.noMaquina}
                      type="button"
                      onClick={() => setSelectedMaquinaId(m.noMaquina)}
                      className={`
                        p-3 rounded-xl border text-left transition-all duration-150 cursor-pointer flex flex-col justify-between min-h-[90px]
                        ${isSelected 
                          ? 'bg-kc-600 text-white border-kc-700 shadow-md ring-2 ring-kc-400' 
                          : 'bg-white text-slate-800 border-slate-200 hover:border-kc-400 hover:bg-slate-50'}
                      `}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span 
                          className={`
                            px-1.5 py-0.5 rounded text-[11px] font-mono font-bold
                            ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'}
                          `}
                        >
                          ID {m.noMaquina}
                        </span>
                        {isSelected && <Check className="w-4 h-4 text-white" />}
                      </div>

                      <div className="mt-2 font-bold text-sm" title={m.descripcionMaquina}>
                        {m.descripcionMaquina}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-slate-100">
              <span className="text-xs text-slate-500">
                Seleccionada actualmente: <strong>{getNombreMaquinaOficial(selectedMaquinaId)} (ID: {selectedMaquinaId || '--'})</strong>
              </span>

              <Button
                variant="success"
                onClick={handleSaveMaquina}
                icon={<CheckCircle2 className="w-4 h-4" />}
              >
                Guardar y Asignar Terminal
              </Button>
            </div>
          </Card>

          {/* TARJETA 2: TIPOGRAFÍA Y APARIENCIA ERGONÓMICA */}
          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Type className="w-5 h-5 text-kc-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-800">
                    Tipografía y Fuente del Sistema
                  </h3>
                  <p className="text-xs text-slate-500">
                    Seleccione la tipografía corporativa de la aplicación para maximizar la nitidez y ergonomía en planta
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-sky-50 text-kc-700 border border-sky-200">
                {fontService.getFuentes().find(f => f.id === fuenteActivaId)?.nombre}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              {fontService.getFuentes().map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => handleCambiarFuente(f.id)}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    fuenteActivaId === f.id
                      ? 'bg-sky-50/80 border-kc-600 ring-2 ring-kc-400/40 shadow-xs'
                      : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                      {f.nombre}
                      {f.id === 'inter' && (
                        <span className="text-[9.5px] font-semibold text-kc-600 bg-kc-50 px-1.5 py-0.2 rounded border border-kc-200">Oficial KC</span>
                      )}
                    </span>
                    {fuenteActivaId === f.id && (
                      <CheckCircle2 className="w-4 h-4 text-kc-600" />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 leading-tight mb-2">
                    {f.descripcion}
                  </p>
                  <div 
                    className="p-2 rounded bg-slate-100/90 text-slate-800 text-[11px] font-semibold border border-slate-200/80 truncate"
                    style={{ fontFamily: f.fontFamily }}
                  >
                    {f.muestra}
                  </div>
                </button>
              ))}
            </div>
          </Card>
        </div>

        {/* COLUMNA DERECHA: PERFIL DEL SISTEMA, SERVIDORES IIS, AUTO-CIERRE E IMPRESORA ZEBRA */}
        <div className="space-y-6">

          {/* TARJETA 0: PERFIL ACTIVO DE LA APLICACIÓN (PRODUCCIÓN vs GERENCIA) */}
          <Card className="p-4 space-y-3 border-l-4 border-l-kc-600 bg-gradient-to-br from-white to-slate-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-kc-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-800">
                    Modo Activo de la Aplicación
                  </h3>
                  <span className="text-[11px] text-slate-500">
                    Controlado por el archivo appsettings.json de la API
                  </span>
                </div>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider ${
                esGerencia 
                  ? 'bg-purple-100 text-purple-800 border border-purple-300' 
                  : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
              }`}>
                MODO {modoPerfil.toUpperCase()}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-900 text-slate-200 font-mono text-xs space-y-1 shadow-inner">
              <div className="text-slate-400 text-[10px]">// Configuración central en IIS (appsettings.json):</div>
              <div className="text-cyan-300">"AppProfile": &#123; "Modo": "{modoPerfil}" &#125;</div>
            </div>

            <div className="text-xs text-slate-600 space-y-1">
              <div>• <strong>Modo Producción:</strong> Habilita Captura de Pallets, Líneas 1/2, Reimpresión F9 y Asistencia TOP 100 de terminal.</div>
              <div>• <strong>Modo Gerencia:</strong> Habilita Reportes y Auditoría de Asistencia por rango de fechas (sin captura operativa).</div>
            </div>
          </Card>

          {/* TARJETA: AUTO-CIERRE POR INACTIVIDAD (PROTECCIÓN DE SERVIDOR IIS) */}
          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-kc-600" />
                <h3 className="text-sm font-bold text-slate-800">
                  Auto-Cierre por Inactividad
                </h3>
              </div>
              <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
                selectedInactivity > 0 
                  ? 'bg-blue-50 text-blue-700 border-blue-200' 
                  : 'bg-slate-100 text-slate-600 border-slate-300'
              }`}>
                {selectedInactivity > 0 ? `${selectedInactivity} min` : 'Desactivado'}
              </span>
            </div>

            <p className="text-xs text-slate-500">
              Cierra automáticamente la aplicación si no se usa para proteger y liberar conexiones del Servidor IIS (172.26.52.14). Los datos del operador permanecen guardados.
            </p>

            {/* Chips de Selección Rápida */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Tiempos Rápidos:
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                {[15, 20, 25, 30, 45, 60].map((mins) => {
                  const isActive = selectedInactivity === mins;
                  return (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => handleCambiarInactividad(mins)}
                      className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition-all cursor-pointer text-center ${
                        isActive
                          ? 'bg-kc-600 text-white border-kc-600 shadow-xs ring-2 ring-kc-400'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {mins} min
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => handleCambiarInactividad(0)}
                className={`w-full mt-1.5 py-1.5 px-2 rounded-lg text-xs font-bold border transition-all cursor-pointer text-center ${
                  selectedInactivity === 0
                    ? 'bg-slate-800 text-white border-slate-800 shadow-xs ring-2 ring-slate-400'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Nunca (Desactivado)
              </button>
            </div>

            {/* Ajuste Fino con Stepper y Slider */}
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-600 uppercase">
                  Ajuste Manual:
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={selectedInactivity <= 15}
                    onClick={() => handleCambiarInactividad(Math.max(15, selectedInactivity - 5))}
                    className="w-7 h-7 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 font-black text-sm flex items-center justify-center cursor-pointer transition-colors"
                    title="Reducir 5 minutos"
                  >
                    <Minus className="w-3.5 h-3.5 text-slate-700" />
                  </button>
                  <span className="font-mono font-bold text-xs px-2.5 py-1 bg-white border border-slate-300 rounded-lg min-w-16 text-center text-slate-800">
                    {selectedInactivity > 0 ? `${selectedInactivity} min` : 'OFF'}
                  </span>
                  <button
                    type="button"
                    disabled={selectedInactivity >= 120}
                    onClick={() => handleCambiarInactividad(selectedInactivity === 0 ? 15 : Math.min(120, selectedInactivity + 5))}
                    className="w-7 h-7 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 font-black text-sm flex items-center justify-center cursor-pointer transition-colors"
                    title="Aumentar 5 minutos"
                  >
                    <Plus className="w-3.5 h-3.5 text-slate-700" />
                  </button>
                </div>
              </div>

              {selectedInactivity > 0 && (
                <input
                  type="range"
                  min={15}
                  max={120}
                  step={5}
                  value={selectedInactivity}
                  onChange={(e) => handleCambiarInactividad(Number(e.target.value))}
                  className="w-full accent-kc-600 cursor-pointer"
                />
              )}
            </div>

            {/* Mensaje Informativo Garantía de Operador */}
            <div className="p-2.5 bg-blue-50/70 rounded-lg border border-blue-200/80 text-[11px] text-blue-900 flex items-start gap-2">
              <Clock className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
              <span>
                <strong>Garantía de Operador:</strong> Al reabrir la app tras un auto-cierre, el <strong>número y nombre del operador continúan guardados</strong> en la terminal. El contador se reinicia con cualquier tecla, clic o toque en pantalla.
              </span>
            </div>
          </Card>

          {/* TARJETA 3: SERVIDOR IIS (3 FORMAS FUNCIONALES) */}
          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-kc-600" />
                <h3 className="text-sm font-bold text-slate-800">
                  Servidor IIS (Web & API)
                </h3>
              </div>
              <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-kc-100 text-kc-800 border border-kc-200">
                Puerto Web: {serverPortInput || '5106'}
              </span>
            </div>

            {/* Banner de Servidor Activo Detectado */}
            <div className="p-2.5 rounded-lg bg-slate-100 border border-slate-200 text-xs flex items-center justify-between shadow-2xs">
              <div className="flex items-center gap-1.5 text-slate-600">
                <Server className="w-3.5 h-3.5 text-slate-500" />
                <span className="font-medium">Conectado actualmente a:</span>
              </div>
              <span className="font-mono font-bold text-kc-700 bg-white px-2 py-0.5 rounded border border-slate-200 text-xs">
                {(window.location.hostname && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') ? window.location.hostname : storageService.getServerIp()}:{window.location.port || '5106'}
              </span>
            </div>

            <p className="text-xs text-slate-500">
              Alterne entre servidores IIS de planta. Reconfigura automáticamente los accesos directos de Windows (.lnk) en el Escritorio y Menú Inicio de la PC cliente.
            </p>

            {/* Selector de las 3 Formas de Servidor */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Seleccione el Modo de Servidor:
              </span>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleSelectServerMode('oficial')}
                  className={`p-2 rounded-lg border text-left cursor-pointer transition-all ${
                    serverMode === 'oficial' 
                      ? 'bg-kc-50 border-kc-600 text-kc-800 ring-2 ring-kc-400 font-bold' 
                      : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700 text-xs'
                  }`}
                >
                  <div className="text-[10px] text-kc-600 uppercase font-bold">Producción Oficial</div>
                  <div className="font-mono text-xs">10.26.24.31</div>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectServerMode('pruebas')}
                  className={`p-2 rounded-lg border text-left cursor-pointer transition-all ${
                    serverMode === 'pruebas' 
                      ? 'bg-amber-50 border-amber-600 text-amber-900 ring-2 ring-amber-400 font-bold' 
                      : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700 text-xs'
                  }`}
                >
                  <div className="text-[10px] text-amber-700 uppercase font-bold">Pruebas / QA</div>
                  <div className="font-mono text-xs">10.26.24.37</div>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectServerMode('personalizado')}
                  className={`p-2 rounded-lg border text-left cursor-pointer transition-all ${
                    serverMode === 'personalizado'
                      ? 'bg-sky-50 border-sky-600 text-sky-900 ring-2 ring-sky-400 font-bold' 
                      : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700 text-xs'
                  }`}
                >
                  <div className="text-[10px] text-sky-700 uppercase font-bold">Personalizado</div>
                  <div className="font-mono text-xs truncate">Otro Host/IP</div>
                </button>
              </div>
            </div>

            {/* Formulario de IP y Puerto */}
            <div className="space-y-2 pt-1 border-t border-slate-100">
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">
                    Dirección IP / Host IIS:
                  </label>
                  <input
                    type="text"
                    value={serverIpInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      setServerIpInput(val);
                      setServerMode('personalizado');
                      const clean = val.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '').replace(/:.*$/, '');
                      if (clean) setApiUrlInput(`http://${clean}:5105`);
                    }}
                    placeholder="10.26.24.31 o IP personalizada"
                    className="w-full font-mono font-bold text-xs bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 focus:bg-white focus:outline-kc-600"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">
                    Puerto Web:
                  </label>
                  <input
                    type="text"
                    value={serverPortInput}
                    onChange={(e) => {
                      setServerPortInput(e.target.value);
                      setServerMode('personalizado');
                    }}
                    placeholder="5106"
                    className="w-full font-mono font-bold text-xs bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 focus:bg-white focus:outline-kc-600"
                  />
                </div>
              </div>

              <Button
                variant="primary"
                size="sm"
                onClick={() => handleSaveServer()}
                loading={savingServer}
                icon={<RefreshCw className="w-3.5 h-3.5" />}
                className="w-full"
              >
                Guardar y Conectar a Servidor IIS
              </Button>
            </div>

            {/* Diagnóstico Backend API REST */}
            <div className="pt-2 border-t border-slate-100 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase truncate" title={apiUrlInput}>
                  Prueba API Backend ({apiUrlInput}):
                </span>
                <button
                  type="button"
                  onClick={handleTestApi}
                  disabled={testingApi}
                  className="text-[11px] font-bold text-kc-600 hover:underline cursor-pointer flex items-center gap-1 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 ${testingApi ? 'animate-spin' : ''}`} />
                  <span>Probar API</span>
                </button>
              </div>

              {apiStatus && (
                <div className={`p-2 rounded text-[11px] flex items-center gap-1.5 ${apiStatus.ok ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                  {apiStatus.ok ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <XCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />}
                  <span className="break-all">{apiStatus.message}</span>
                </div>
              )}
            </div>
          </Card>

          {/* TARJETA 4: CONFIGURACIÓN DE IMPRESORA ZEBRA (USB VS RED IP) */}
          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Printer className="w-4 h-4 text-amber-600" />
                <h3 className="text-sm font-bold text-slate-800">
                  Impresora Zebra (USB o Red IP)
                </h3>
              </div>
              <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
                printerMode === 'Red' 
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200' 
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}>
                {printerMode === 'Red' ? 'Modo Red IP' : 'Modo USB'}
              </span>
            </div>

            <p className="text-xs text-slate-500">
              Configure si esta terminal envía etiquetas térmicas mediante cable USB local o a través de la red Ethernet de planta.
            </p>

            {/* Selector de Modo: USB Local vs Red IP */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Tipo de Conexión de Impresora:
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPrinterMode('USB')}
                  className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all flex items-center gap-2 ${
                    printerMode === 'USB' 
                      ? 'bg-emerald-50 border-emerald-600 text-emerald-900 ring-2 ring-emerald-400 font-bold' 
                      : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700 text-xs'
                  }`}
                >
                  <Usb className={`w-4 h-4 ${printerMode === 'USB' ? 'text-emerald-700' : 'text-slate-400'}`} />
                  <div>
                    <div className="text-xs font-bold">USB Local</div>
                    <div className="text-[10px] text-slate-500">Cable Directo PC</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setPrinterMode('Red')}
                  className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all flex items-center gap-2 ${
                    printerMode === 'Red' 
                      ? 'bg-indigo-50 border-indigo-600 text-indigo-900 ring-2 ring-indigo-400 font-bold' 
                      : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700 text-xs'
                  }`}
                >
                  <Network className={`w-4 h-4 ${printerMode === 'Red' ? 'text-indigo-700' : 'text-slate-400'}`} />
                  <div>
                    <div className="text-xs font-bold">Red IP (Ethernet)</div>
                    <div className="text-[10px] text-slate-500">Socket 9100</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Campos condicionales para Modo Red IP */}
            {printerMode === 'Red' ? (
              <div className="p-3 bg-indigo-50/60 rounded-lg border border-indigo-200 space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="text-[10px] font-bold text-indigo-900 uppercase block mb-0.5">
                      Dirección IP de Impresora:
                    </label>
                    <input
                      type="text"
                      value={printerIpInput}
                      onChange={(e) => setPrinterIpInput(e.target.value)}
                      placeholder="Ej. 10.26.24.150"
                      className="w-full font-mono font-bold text-xs bg-white border border-indigo-300 rounded px-2.5 py-1.5 focus:outline-kc-600"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-indigo-900 uppercase block mb-0.5">
                      Puerto RAW:
                    </label>
                    <input
                      type="text"
                      value={printerPortInput}
                      onChange={(e) => setPrinterPortInput(e.target.value)}
                      placeholder="9100"
                      className="w-full font-mono font-bold text-xs bg-white border border-indigo-300 rounded px-2.5 py-1.5 focus:outline-kc-600"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-indigo-700 leading-tight">
                  Las etiquetas se inyectarán directamente al socket RAW de la impresora Zebra en red a través de PrintBridge.
                </p>
              </div>
            ) : (
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 text-[11px]">Controlador USB:</span>
                  <span className="font-semibold text-slate-800 truncate">{printerStatus.nombre || 'ZDesigner (USB)'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 text-[11px]">Canal de Envío:</span>
                  <span className="font-mono text-emerald-700 font-bold">Win32 RAW (Directo)</span>
                </div>
              </div>
            )}

            {/* Estado Actual del Semáforo de Impresora */}
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-[10px]">ESTADO HARDWARE:</span>
                <span className={`font-bold ${
                  printerStatus.enPausa 
                    ? 'text-amber-600' 
                    : (printerStatus.sinPapel || printerStatus.tapaAbierta) 
                    ? 'text-amber-600'
                    : printerStatus.conectada 
                    ? 'text-emerald-600' 
                    : 'text-red-600'
                }`}>
                  {printerStatus.enPausa 
                    ? 'EN PAUSA' 
                    : printerStatus.sinPapel 
                    ? 'SIN PAPEL' 
                    : printerStatus.tapaAbierta 
                    ? 'TAPA ABIERTA' 
                    : printerStatus.conectada 
                    ? 'ONLINE' 
                    : 'DESCONECTADA'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-[10px]">COLA DE TRABAJOS:</span>
                <span className="text-slate-800">{printerStatus.trabajosEnCola} en spooler</span>
              </div>
            </div>

            {testPrintResult && (
              <div className={`p-2 rounded text-xs flex items-center gap-1.5 ${
                testPrintResult.ok ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
              }`}>
                {testPrintResult.ok ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <XCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />}
                <span className="break-all">{testPrintResult.message}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button
                variant="primary"
                size="sm"
                onClick={handleSavePrinterConfig}
                loading={savingPrinterConfig}
                icon={<Save className="w-3.5 h-3.5" />}
              >
                Guardar Impresora
              </Button>

              <Button
                variant="warning"
                size="sm"
                onClick={handleTestPrint}
                loading={testingPrint}
                icon={<Printer className="w-3.5 h-3.5" />}
              >
                Imprimir Prueba
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
