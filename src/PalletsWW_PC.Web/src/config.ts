/**
 * Configuración centralizada de entorno y servicios para Pallets Wipes PC
 * Sigue el estándar corporativo MD5 Kimberly-Clark
 */

export const getApiBaseUrl = (): string => {
  // 1. Prioridad Máxima: Si el usuario/supervisor configuró una URL o Servidor IP en localStorage
  if (typeof window !== 'undefined' && window.localStorage) {
    let saved = localStorage.getItem('PalletsWW_ApiUrl');
    if (saved && saved.trim() !== '') {
      saved = saved.trim().replace(/\/+$/, '');
      return saved;
    }
    const savedIp = localStorage.getItem('PalletsWW_ServerIp');
    if (savedIp && savedIp.trim() !== '') {
      return `http://${savedIp.trim()}:5105`;
    }
  }

  // 2. Si no hay configuración manual en localStorage, tomar el host al que se conectó el navegador
  if (typeof window !== 'undefined' && window.location) {
    const hostname = window.location.hostname;
    if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1') {
      const protocol = window.location.protocol || 'http:';
      return `${protocol}//${hostname}:5105`;
    }
  }

  // 3. Fallback en desarrollo local
  return 'http://localhost:5105';
};

/**
 * Catálogo oficial de máquinas de Depto Wipes (Planta Tlaxcala)
 * Homologado con TLX009MXDB.dbo.tblMaquinas
 */
export const NOMBRES_MAQUINAS_OFICIALES: Record<number, string> = {
  9: 'TXWW1',
  16: 'TXWW2',
  53: 'TXWW3',
  54: 'TXWW4',
  55: 'TXWW5',
  67: 'TXWW6',
  70: 'TXWW7'
};

/**
 * Resuelve el nombre oficial de la máquina (ej. TXWW1, TXWW2) evitando mostrar 'Máquina 9'
 */
export const getNombreMaquinaOficial = (noMaquina?: number, fallback?: string): string => {
  if (!noMaquina || noMaquina <= 0) return fallback || 'Sin Asignar';
  if (NOMBRES_MAQUINAS_OFICIALES[noMaquina]) {
    return NOMBRES_MAQUINAS_OFICIALES[noMaquina];
  }
  if (fallback && fallback.trim() && !fallback.toLowerCase().startsWith('máquina')) {
    return fallback.trim();
  }
  return `Máquina ${noMaquina}`;
};

/**
 * Horarios oficiales de turno en Planta Tlaxcala
 */
export const HORARIOS_TURNOS: Record<number, string> = {
  1: '07:00 - 15:00',
  2: '15:00 - 23:00',
  3: '23:00 - 07:00'
};

/**
 * Resuelve el horario oficial del turno (07:00 - 15:00, 15:00 - 23:00, 23:00 - 07:00)
 */
export const getHorarioTurno = (turno?: number | string): string => {
  const num = turno !== undefined && turno !== null ? Number(turno) : NaN;
  if (HORARIOS_TURNOS[num]) {
    return HORARIOS_TURNOS[num];
  }
  const now = new Date();
  const hrs = now.getHours();
  if (hrs >= 7 && hrs < 15) return HORARIOS_TURNOS[1];
  if (hrs >= 15 && hrs < 23) return HORARIOS_TURNOS[2];
  return HORARIOS_TURNOS[3];
};

/**
 * Formatea una fecha de manera determinista al estándar visual de planta: DD/MM/YYYY (Día / Mes / Año).
 */
export const formatearFechaVisual = (fechaRaw?: string | Date | null): string => {
  if (!fechaRaw) {
    const d = new Date();
    const dia = String(d.getDate()).padStart(2, '0');
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const anio = d.getFullYear();
    return `${dia}/${mes}/${anio}`;
  }

  if (typeof fechaRaw === 'string') {
    const matchIso = fechaRaw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (matchIso) {
      const [, anio, mes, dia] = matchIso;
      return `${dia}/${mes}/${anio}`;
    }
    const matchCompact = fechaRaw.match(/^(\d{4})(\d{2})(\d{2})/);
    if (matchCompact) {
      const [, anio, mes, dia] = matchCompact;
      return `${dia}/${mes}/${anio}`;
    }
  }

  const d = new Date(fechaRaw);
  if (isNaN(d.getTime())) {
    return String(fechaRaw);
  }
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const anio = d.getFullYear();
  return `${dia}/${mes}/${anio}`;
};

/**
 * Obtiene el límite máximo de tarimas permitidas por vale en Wipes.
 * Regla de negocio de planta: 38 tarimas máximo estricto por vale físico.
 */
export const getMaxTarimasPorMaquina = (_noMaquina?: number): number => {
  return 38;
};

export const APP_CONFIG = {
  appName: 'Pallets Wipes PC',
  version: 'Versión 11',
  planta: 'Planta Tlaxcala - Depto Wipes',
  
  // Backend API REST en puerto 5105 (IIS)
  get apiBaseUrl(): string {
    return getApiBaseUrl();
  },
  
  // Microservicio local de hardware Zebra
  printBridgeUrl: 'http://127.0.0.1:9100',
  printBridgeFallbackUrl: 'http://127.0.0.1:5108',
  
  // Tiempos y directivas operativas
  shiftCheckIntervalMs: 20 * 60 * 1000, // 20 minutos por estándar
  printerPollIntervalMs: 15 * 1000,     // 15 segundos para semáforo de impresora
  
  // Módulo de Alertas de Pallets Sin Etiqueta
  alertasHabilitadas: false,

  // Directivas de inactividad y auto-cierre (Protección de Servidor IIS)
  inactivity: {
    defaultMinutes: 20, // 20 minutos predeterminado de planta
    minMinutes: 15,     // 15 minutos mínimo operativo
    maxMinutes: 120,    // 120 minutos máximo
    warningSeconds: 45  // 45 segundos de aviso previo con cuenta regresiva
  },
  
  // Límites de capacidad física en Wipes: 38 tarimas por vale
  defaultMaxTarimasPorVale: 38,
  getMaxTarimasPorMaquina,

  // Almacenamiento local keys
  storageKeys: {
    maquinaId: 'PalletsWW_MaquinaId',
    maquinaNombre: 'PalletsWW_MaquinaNombre',
    lineaEmpaque: 'PalletsWW_LineaEmpaque',
    noEmpleado: 'PalletsWW_NoEmpleado',
    nombreEmpleado: 'PalletsWW_NombreEmpleado',
    theme: 'PalletsWW_Theme',
    supervisorPin: 'PalletsWW_SupervisorPin',
    permitirCambioLinea: 'PalletsWW_PermitirCambioLinea',
    inactivityTimeout: 'PalletsWW_InactivityTimeoutMinutes',
  }
};