import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import type { 
  EncabezadoTurnoDto, 
  ValeProduccionDto, 
  PalletDto, 
  HardwarePrinterStatus,
  LineaEmpaqueDto 
} from '../types';
import { valesService } from '../services/valesService';
import { palletsService } from '../services/palletsService';
import { catalogosService } from '../services/catalogosService';
import { impresionService } from '../services/impresionService';
import { storageService } from '../services/storageService';
import { APP_CONFIG, getMaxTarimasPorMaquina, getNombreMaquinaOficial } from '../config';

interface ProductionContextType {
  // Configuración de Perfil (Producción vs Gerencia)
  modoPerfil: string;
  esGerencia: boolean;

  // Configuración de Terminal
  maquinaId: number;
  maquinaNombre: string;
  maxTarimas: number;
  setMaquina: (id: number, nombre?: string) => void;
  lineaEmpaque: string;
  setLineaEmpaque: (linea: string) => void;
  lineasEmpaque: LineaEmpaqueDto[];
  permitirCambioLinea: boolean;
  setPermitirCambioLinea: (permitir: boolean) => void;

  // Inactividad y Auto-Cierre (Protección Servidor IIS)
  inactivityTimeout: number;
  setInactivityTimeout: (minutos: number) => void;

  // Carga Inicial & Splash Screen Industrial
  isAppReady: boolean;
  initProgress: number;
  initStatusMessage: string;

  // Turno & Encabezado
  encabezado: EncabezadoTurnoDto | null;
  loadingEncabezado: boolean;

  // Vales
  valesTurnoActual: ValeProduccionDto[];
  valesTurnoAnterior: ValeProduccionDto[];
  valeSeleccionado: ValeProduccionDto | null;
  esTurnoAnterior: boolean;
  seleccionarVale: (vale: ValeProduccionDto, esAnterior?: boolean) => Promise<void>;
  recargarVales: (folioASeleccionar?: number) => Promise<void>;
  consultarTurnoAnterior: () => Promise<void>;

  // Pallets
  pallets: PalletDto[];
  loadingPallets: boolean;
  ultimoPalletGuardadoId: number | null;
  setUltimoPalletGuardadoId: (id: number | null) => void;
  recargarPallets: () => Promise<void>;
  agregarPalletOptimista: (pallet: PalletDto) => void;

  // Operador
  noEmpleado: string;
  nombreEmpleado: string;
  operadorValido: boolean;
  validandoOperador: boolean;
  setNoEmpleadoInput: (no: string) => void;
  validarOperador: (no?: string) => Promise<boolean>;

  // Hardware Zebra
  printerStatus: HardwarePrinterStatus;
  verificarImpresora: () => Promise<void>;

  // Control Operativo y Protección de Captura Activa
  isEditingOrTyping: boolean;
  setIsEditingOrTyping: (val: boolean) => void;
  cargarEncabezado: (deseleccionarVales?: boolean, overrideMaq?: number) => Promise<void>;
  refrescarTodo: (limpiarOperador?: boolean, deseleccionarVales?: boolean) => Promise<void>;
}

const ProductionContext = createContext<ProductionContextType | undefined>(undefined);

export const ProductionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 0. Estado de Perfil (Producción vs Gerencia)
  const [modoPerfil, setModoPerfil] = useState<string>('Produccion');
  const [esGerencia, setEsGerencia] = useState<boolean>(false);

  // 1. Estado de Terminal
  const [maquinaId, setMaquinaIdState] = useState<number>(() => storageService.getMaquinaId());
  const [maquinaNombre, setMaquinaNombreState] = useState<string>(() => storageService.getMaquinaNombre());
  const [lineaEmpaque, setLineaEmpaqueState] = useState<string>(() => storageService.getLineaEmpaque() || '1');
  const [lineasEmpaque, setLineasEmpaque] = useState<LineaEmpaqueDto[]>([]);
  const [permitirCambioLinea, setPermitirCambioLineaState] = useState<boolean>(() => storageService.getPermitirCambioLinea());

  const setPermitirCambioLinea = useCallback((permitir: boolean) => {
    storageService.setPermitirCambioLinea(permitir);
    setPermitirCambioLineaState(permitir);
  }, []);

  // Inactividad y Auto-Cierre (Protección Servidor IIS)
  const [inactivityTimeout, setInactivityTimeoutState] = useState<number>(() => storageService.getInactivityTimeout());

  const setInactivityTimeout = useCallback((minutos: number) => {
    storageService.setInactivityTimeout(minutos);
    setInactivityTimeoutState(minutos);
  }, []);

  // Capacidad máxima de tarimas dinámica (38 en Wipes)
  const maxTarimas = getMaxTarimasPorMaquina(maquinaId);

  // Estados de Splash Screen & Inicialización Industrial
  const [isAppReady, setIsAppReady] = useState<boolean>(false);
  const [initProgress, setInitProgress] = useState<number>(15);
  const [initStatusMessage, setInitStatusMessage] = useState<string>('Iniciando arquitectura de alta disponibilidad Pallets Wipes...');

  // Helper Operativo: Ordenar vales descendentemente
  const ordenarValesDesc = (vales: ValeProduccionDto[] = []) => {
    return [...vales].sort((a, b) => {
      const idA = a.idAutotblProduccion || a.folioVale || 0;
      const idB = b.idAutotblProduccion || b.folioVale || 0;
      return idB - idA;
    });
  };

  // 2. Estado de Turno & Encabezado
  const [encabezado, setEncabezado] = useState<EncabezadoTurnoDto | null>(null);
  const [loadingEncabezado, setLoadingEncabezado] = useState<boolean>(false);

  // 3. Estado de Vales
  const [valesTurnoActual, setValesTurnoActual] = useState<ValeProduccionDto[]>([]);
  const [valesTurnoAnterior, setValesTurnoAnterior] = useState<ValeProduccionDto[]>([]);
  const [valeSeleccionado, setValeSeleccionado] = useState<ValeProduccionDto | null>(null);
  const [esTurnoAnterior, setEsTurnoAnterior] = useState<boolean>(false);

  // 4. Estado de Pallets
  const [pallets, setPallets] = useState<PalletDto[]>([]);
  const [loadingPallets, setLoadingPallets] = useState<boolean>(false);
  const [ultimoPalletGuardadoId, setUltimoPalletGuardadoId] = useState<number | null>(null);

  // 5. Estado de Operador
  const [noEmpleado, setNoEmpleado] = useState<string>(() => storageService.getNoEmpleado());
  const [nombreEmpleado, setNombreEmpleado] = useState<string>(() => storageService.getNombreEmpleado());
  const [operadorValido, setOperadorValido] = useState<boolean>(() => !!storageService.getNombreEmpleado());
  const [validandoOperador, setValidandoOperador] = useState<boolean>(false);

  // 6. Hardware Zebra
  const [printerStatus, setPrinterStatus] = useState<HardwarePrinterStatus>({
    conectada: true,
    enPausa: false,
    nombre: 'Zebra ZT411 / ZT230',
    trabajosEnCola: 0,
    mensaje: 'Impresora lista'
  });

  // 7. Protección de captura activa y sincronización
  const [isEditingOrTyping, setIsEditingOrTyping] = useState<boolean>(false);
  const isEditingRef = useRef(isEditingOrTyping);
  isEditingRef.current = isEditingOrTyping;

  const valeSeleccionadoRef = useRef(valeSeleccionado);
  valeSeleccionadoRef.current = valeSeleccionado;

  const isCargandoEncabezadoRef = useRef(false);

  const setLineaEmpaque = useCallback((linea: string) => {
    setLineaEmpaqueState(linea);
    storageService.setLineaEmpaque(linea);
    try {
      const curMaq = storageService.getMaquinaId();
      fetch('http://127.0.0.1:9100/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          machineId: curMaq,
          lineaEmpaque: linea
        })
      }).catch(() => {});
    } catch {}
  }, []);

  // Actualizar máquina y sus líneas de empaque oficiales
  const setMaquina = useCallback((id: number, nombre?: string) => {
    const nomOficial = getNombreMaquinaOficial(id, nombre);
    setMaquinaIdState(id);
    setMaquinaNombreState(nomOficial);
    storageService.setMaquinaId(id, nomOficial);
    catalogosService.getLineasEmpaque(id).then(lineas => {
      if (lineas && lineas.length > 0) {
        setLineasEmpaque(lineas);
        const currentLinea = storageService.getLineaEmpaque();
        if (!currentLinea || !lineas.some(l => l.lineaEmpaque === currentLinea)) {
          setLineaEmpaque(lineas[0].lineaEmpaque);
        }
      }
    }).catch(() => {});
  }, [setLineaEmpaque]);

  // Validar Operador
  const validarOperador = useCallback(async (numStr?: string): Promise<boolean> => {
    const targetNum = (numStr !== undefined ? numStr : noEmpleado).trim();
    if (!targetNum) {
      setNombreEmpleado('');
      setOperadorValido(false);
      storageService.setNoEmpleado('', '');
      return false;
    }

    const n = parseInt(targetNum, 10);
    if (isNaN(n) || n <= 0) {
      setNombreEmpleado('Número inválido');
      setOperadorValido(false);
      return false;
    }

    setValidandoOperador(true);
    try {
      const emp = await catalogosService.validarOperador(n);
      if (emp && emp.nombreEmpleado) {
        setNombreEmpleado(emp.nombreEmpleado);
        setOperadorValido(true);
        storageService.setNoEmpleado(targetNum, emp.nombreEmpleado);
        return true;
      } else {
        setNombreEmpleado('Empleado no encontrado');
        setOperadorValido(false);
        return false;
      }
    } catch {
      setNombreEmpleado('Error al validar');
      setOperadorValido(false);
      return false;
    } finally {
      setValidandoOperador(false);
    }
  }, [noEmpleado]);

  const setNoEmpleadoInput = (no: string) => {
    setNoEmpleado(no);
    setOperadorValido(false);
  };

  // Verificar estado de impresora
  const verificarImpresora = useCallback(async () => {
    try {
      const status = await impresionService.getStatus();
      setPrinterStatus(status);
    } catch {
      // ignore
    }
  }, []);

  // Cargar Pallets de un Vale
  const cargarPalletsDeVale = useCallback(async (folioVale: number, idEncabezado?: number) => {
    if (!folioVale || folioVale <= 0) {
      setPallets([]);
      return;
    }
    setLoadingPallets(true);
    try {
      const data = await palletsService.getPalletsPorVale(folioVale, idEncabezado);
      const items = data || [];
      setPallets(items);
      const count = items.length;

      // Sincronizar conteo de tarimas en los vales en memoria
      setValesTurnoActual(prev => prev.map(v => 
        v.folioVale === folioVale ? { ...v, totalPallets: count } : v
      ));
      setValesTurnoAnterior(prev => prev.map(v => 
        v.folioVale === folioVale ? { ...v, totalPallets: count } : v
      ));
      setValeSeleccionado(prev => 
        prev && prev.folioVale === folioVale ? { ...prev, totalPallets: count } : prev
      );
    } catch (err) {
      console.warn('Aviso de red al consultar pallets del vale:', err);
    } finally {
      setLoadingPallets(false);
    }
  }, []);

  // Seleccionar Vale
  const seleccionarVale = useCallback(async (vale: ValeProduccionDto, esAnterior: boolean = false) => {
    setValeSeleccionado(vale);
    setEsTurnoAnterior(esAnterior);
    await cargarPalletsDeVale(vale.folioVale, vale.idRT_Encabezado || encabezado?.idRT_Encabezado);
  }, [cargarPalletsDeVale, encabezado?.idRT_Encabezado]);

  // Recargar Pallets del Vale actual
  const recargarPallets = useCallback(async () => {
    if (valeSeleccionado && valeSeleccionado.folioVale > 0) {
      await cargarPalletsDeVale(valeSeleccionado.folioVale, valeSeleccionado.idRT_Encabezado || encabezado?.idRT_Encabezado);
    }
  }, [valeSeleccionado, encabezado?.idRT_Encabezado, cargarPalletsDeVale]);

  // Aceleración de Rendimiento: Agregar tarima inmediatamente en memoria local (0 ms de espera)
  const agregarPalletOptimista = useCallback((nuevoPallet: PalletDto) => {
    setPallets(prev => {
      if (prev.some(p => p.idtblPallets === nuevoPallet.idtblPallets)) {
        return prev;
      }
      const nuevaLista = [...prev, nuevoPallet];
      const count = nuevaLista.length;

      setValesTurnoActual(vales => vales.map(v => 
        v.folioVale === nuevoPallet.folioVale ? { ...v, totalPallets: count } : v
      ));
      setValesTurnoAnterior(vales => vales.map(v => 
        v.folioVale === nuevoPallet.folioVale ? { ...v, totalPallets: count } : v
      ));
      setValeSeleccionado(v => 
        v && v.folioVale === nuevoPallet.folioVale ? { ...v, totalPallets: count } : v
      );

      return nuevaLista;
    });
  }, []);

  // Recargar Vales
  // Recargar Vales con selección forzada opcional
  const recargarVales = useCallback(async (folioASeleccionar?: number) => {
    try {
      if (maquinaId > 0) {
        const valesAct = await valesService.getValesActivos(maquinaId, encabezado?.turno, encabezado?.fecha, encabezado?.idRT_Encabezado);
        const valesActOrd = ordenarValesDesc(valesAct || []);
        setValesTurnoActual(valesActOrd);

        // Si se especificó un folio recién creado, seleccionarlo inmediatamente
        if (folioASeleccionar && folioASeleccionar > 0) {
          const valeCreado = valesActOrd.find(v => v.folioVale === folioASeleccionar);
          if (valeCreado) {
            await seleccionarVale(valeCreado, false);
            return;
          }
        }

        if (!valeSeleccionado && valesActOrd.length > 0) {
          seleccionarVale(valesActOrd[0], false);
        } else if (valeSeleccionado) {
          const existente = valesActOrd.find(v => v.folioVale === valeSeleccionado.folioVale);
          if (existente) {
            seleccionarVale(existente, false);
          }
        }
      }
    } catch (err) {
      console.error('Error al cargar vales:', err);
    }
  }, [encabezado, maquinaId, valeSeleccionado, seleccionarVale]);

  // Consultar explícitamente Turno Anterior (Regla 4.9: Solo por clic expreso)
  const consultarTurnoAnterior = useCallback(async () => {
    let effectiveMaq = maquinaId;
    if (effectiveMaq <= 0) effectiveMaq = storageService.getMaquinaId();
    if (effectiveMaq <= 0) return;
    try {
      const now = new Date();
      const hrs = now.getHours();
      const currentShift = encabezado?.turno || ((hrs >= 7 && hrs < 15) ? 1 : (hrs >= 15 && hrs < 23) ? 2 : 3);
      const valesAnt = await valesService.getValesHistoricos(effectiveMaq, currentShift, encabezado?.fecha);
      const valesAntOrd = ordenarValesDesc(valesAnt || []);
      setValesTurnoAnterior(valesAntOrd);
    } catch (err) {
      console.error('Error al consultar turno anterior:', err);
    }
  }, [maquinaId, encabezado]);

  // Cargar Encabezado Activo con auto-descubrimiento y guard de ejecución única
  const cargarEncabezado = useCallback(async (deseleccionarVales: boolean = false, overrideMaq?: number) => {
    let effectiveMaq = overrideMaq || maquinaId;
    if (effectiveMaq <= 0) {
      effectiveMaq = storageService.getMaquinaId();
      if (effectiveMaq <= 0) {
        try {
          const ml = await catalogosService.getMaquinaLocal();
          if (ml > 0) {
            effectiveMaq = ml;
            setMaquina(ml);
          }
        } catch {
          effectiveMaq = 54;
          setMaquina(54);
        }
      }
    }

    if (effectiveMaq <= 0) {
      setEncabezado(null);
      setValesTurnoActual([]);
      setValesTurnoAnterior([]);
      setValeSeleccionado(null);
      setPallets([]);
      setInitProgress(100);
      setInitStatusMessage('Terminal lista (sin máquina asignada)');
      return;
    }

    if (isCargandoEncabezadoRef.current) return;
    isCargandoEncabezadoRef.current = true;
    setLoadingEncabezado(true);

    try {
      setInitProgress(35);
      setInitStatusMessage(`Conectando con Backend API (Máquina ${effectiveMaq})...`);

      // 1. Consultar encabezado activo del turno actual
      const enc = await valesService.getEncabezadoActual(effectiveMaq);
      setEncabezado(enc);

      // 2. Cargar vales del turno actual
      let valesActOrd: ValeProduccionDto[] = [];
      setInitProgress(60);
      setInitStatusMessage(`Sincronizando turno ${enc?.turno || ''} (Sup: ${enc?.nombreSupervisor || 'Asignado'})...`);
      
      const valesAct = await valesService.getValesActivos(
        effectiveMaq, 
        enc?.turno, 
        enc?.fecha, 
        enc && enc.idRT_Encabezado > 0 ? enc.idRT_Encabezado : undefined
      );
      valesActOrd = ordenarValesDesc(valesAct || []);
      setValesTurnoActual(valesActOrd);

      // Cargar vales de turno anterior automáticamente (estándar Pallets Pañal: en el load y al refrescar)
      try {
        const now = new Date();
        const hrs = now.getHours();
        const currentShift = enc?.turno || ((hrs >= 7 && hrs < 15) ? 1 : (hrs >= 15 && hrs < 23) ? 2 : 3);
        const valesAnt = await valesService.getValesHistoricos(effectiveMaq, currentShift, enc?.fecha);
        const valesAntOrd = ordenarValesDesc(valesAnt || []);
        setValesTurnoAnterior(valesAntOrd);
      } catch (errAnt) {
        console.warn('Aviso al cargar vales de turno anterior:', errAnt);
      }

      setInitProgress(85);
      setInitStatusMessage(`Sincronizando interfaz de producción...`);

      if (deseleccionarVales) {
        setValeSeleccionado(null);
        valeSeleccionadoRef.current = null;
        setPallets([]);
        setEsTurnoAnterior(false);
        return;
      }

      // Regla de Negocio 4.9:
      // Si hay vales del turno actual, seleccionar el primero o conservar el actual
      if (valesActOrd.length > 0) {
        const actualVale = valeSeleccionadoRef.current;
        const existe = actualVale ? valesActOrd.find(v => v.folioVale === actualVale.folioVale) : null;
        if (existe) {
          await seleccionarVale(existe, false);
        } else {
          await seleccionarVale(valesActOrd[0], false);
        }
      } else {
        // Pantalla limpia con aviso industrial
        setValeSeleccionado(null);
        setPallets([]);
        setEsTurnoAnterior(false);
      }
    } catch (err) {
      console.error('Error al cargar encabezado activo:', err);
    } finally {
      isCargandoEncabezadoRef.current = false;
      setLoadingEncabezado(false);
    }
  }, [maquinaId, seleccionarVale, setMaquina]);

  // Refrescar Todo
  const refrescarTodo = useCallback(async (limpiarOperador: boolean = false, deseleccionarVales: boolean = false) => {
    isCargandoEncabezadoRef.current = false;
    if (limpiarOperador) {
      setNoEmpleado('');
      setNombreEmpleado('');
      setOperadorValido(false);
      storageService.setNoEmpleado('', '');
    }
    await cargarEncabezado(deseleccionarVales);
    await verificarImpresora();
  }, [cargarEncabezado, verificarImpresora]);

  // Inicialización Industrial de Alta Disponibilidad (Ejecución Atómica en Montaje)
  const cargarEncabezadoRef = useRef(cargarEncabezado);
  cargarEncabezadoRef.current = cargarEncabezado;
  const verificarImpresoraRef = useRef(verificarImpresora);
  verificarImpresoraRef.current = verificarImpresora;
  const validarOperadorRef = useRef(validarOperador);
  validarOperadorRef.current = validarOperador;

  const hasInitializedRef = useRef<boolean>(false);
  useEffect(() => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    const init = async () => {
      try {
        setInitProgress(10);
        setInitStatusMessage('Consultando perfil de la aplicación (Producción / Gerencia)...');
        try {
          const windowParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
          const hashQuery = typeof window !== 'undefined' && window.location.hash.includes('?') ? window.location.hash.split('?')[1] : '';
          const hashParams = new URLSearchParams(hashQuery);
          const qMode = windowParams?.get('perfil') || windowParams?.get('mode') || hashParams.get('perfil') || hashParams.get('mode');

          const perfilData = await catalogosService.getPerfil();
          let isG = !!perfilData?.esGerencia || perfilData?.modo?.toLowerCase() === 'gerencia';
          if (qMode?.toLowerCase() === 'gerencia') isG = true;
          if (qMode?.toLowerCase() === 'produccion') isG = false;

          setEsGerencia(isG);
          setModoPerfil(isG ? 'Gerencia' : 'Produccion');
        } catch {
          // fallback silencioso
        }

        setInitProgress(20);
        setInitStatusMessage('Verificando hardware de impresión térmico...');
        try {
          await verificarImpresoraRef.current();
        } catch (ePrn) {
          console.warn('Hardware de impresión en modo diferido:', ePrn);
        }

        // Auto-detección de máquina si no está asignada
        let currentMaq = storageService.getMaquinaId();
        if (currentMaq <= 0) {
          try {
            const maqLocal = await catalogosService.getMaquinaLocal();
            if (maqLocal && maqLocal > 0) {
              currentMaq = maqLocal;
            } else {
              currentMaq = 54; // Fallback TXWW4
            }
          } catch {
            currentMaq = 54;
          }
        }
        setMaquina(currentMaq);

        // Cargar líneas de empaque de la máquina
        try {
          const lineas = await catalogosService.getLineasEmpaque(currentMaq);
          if (lineas && lineas.length > 0) {
            setLineasEmpaque(lineas);
            const currentLinea = storageService.getLineaEmpaque();
            if (!currentLinea || !lineas.some(l => l.lineaEmpaque === currentLinea)) {
              setLineaEmpaque(lineas[0].lineaEmpaque);
            }
          }
        } catch {}

        setInitProgress(55);
        setInitStatusMessage('Cargando parámetros de turno y vales de producción...');
        try {
          await cargarEncabezadoRef.current(false, currentMaq);
        } catch (eEnc) {
          console.warn('Encabezado de turno no disponible temporalmente:', eEnc);
        }

        const opGuardado = storageService.getNoEmpleado();
        if (opGuardado) {
          setInitProgress(85);
          setInitStatusMessage(`Validando credenciales de operador (${opGuardado})...`);
          try {
            await validarOperadorRef.current(opGuardado);
          } catch (eOp) {
            console.warn('Operador previo no verificado en arranque:', eOp);
          }
        }

        setInitProgress(100);
        setInitStatusMessage('¡Terminal Pallets Wipes lista!');
        setTimeout(() => {
          setIsAppReady(true);
        }, 150);
      } catch (err) {
        console.error('Error durante la inicialización:', err);
        setIsAppReady(true);
      }
    };

    init();
  }, [setMaquina, setLineaEmpaque]);

  // Temporizador de Turno: cada 20 minutos (Regla 4.8) con protección de captura activa (Regla 4.7)
  useEffect(() => {
    const timer = setInterval(() => {
      if (!isEditingRef.current) {
        cargarEncabezado(false);
      }
    }, APP_CONFIG.shiftCheckIntervalMs);

    return () => clearInterval(timer);
  }, [cargarEncabezado]);

  // Semáforo de hardware Zebra cada 15 segundos
  useEffect(() => {
    const timer = setInterval(() => {
      verificarImpresora();
    }, APP_CONFIG.printerPollIntervalMs);

    return () => clearInterval(timer);
  }, [verificarImpresora]);

  return (
    <ProductionContext.Provider
      value={{
        modoPerfil,
        esGerencia,
        maquinaId,
        maquinaNombre,
        maxTarimas,
        setMaquina,
        lineaEmpaque,
        setLineaEmpaque,
        lineasEmpaque,
        permitirCambioLinea,
        setPermitirCambioLinea,
        inactivityTimeout,
        setInactivityTimeout,
        isAppReady,
        initProgress,
        initStatusMessage,
        encabezado,
        loadingEncabezado,
        valesTurnoActual,
        valesTurnoAnterior,
        valeSeleccionado,
        esTurnoAnterior,
        seleccionarVale,
        recargarVales,
        consultarTurnoAnterior,
        pallets,
        loadingPallets,
        ultimoPalletGuardadoId,
        setUltimoPalletGuardadoId,
        recargarPallets,
        agregarPalletOptimista,
        noEmpleado,
        nombreEmpleado,
        operadorValido,
        validandoOperador,
        setNoEmpleadoInput,
        validarOperador,
        printerStatus,
        verificarImpresora,
        isEditingOrTyping,
        setIsEditingOrTyping,
        cargarEncabezado,
        refrescarTodo,
      }}
    >
      {children}
    </ProductionContext.Provider>
  );
};

export const useProduction = (): ProductionContextType => {
  const context = useContext(ProductionContext);
  if (!context) {
    throw new Error('useProduction debe ser utilizado dentro de un ProductionProvider');
  }
  return context;
};