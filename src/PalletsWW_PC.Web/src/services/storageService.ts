import { APP_CONFIG, getNombreMaquinaOficial } from '../config';
import type { ChromeTheme } from '../types';

export const storageService = {
  getMaquinaId(): number {
    // 1. Prioridad: Query param en la URL (?maquina=9, ?maq=9 o ?m=9) típico de accesos directos
    if (typeof window !== 'undefined' && window.location) {
      try {
        const search = window.location.search || (window.location.hash.includes('?') ? window.location.hash.split('?')[1] : '');
        if (search) {
          const params = new URLSearchParams(search);
          const mParam = params.get('maquina') || params.get('maq') || params.get('m');
          if (mParam) {
            const mNum = parseInt(mParam, 10);
            if (!isNaN(mNum) && mNum > 0) {
              localStorage.setItem(APP_CONFIG.storageKeys.maquinaId, mNum.toString());
              const nomOficial = getNombreMaquinaOficial(mNum);
              localStorage.setItem(APP_CONFIG.storageKeys.maquinaNombre, nomOficial);
              return mNum;
            }
          }
        }
      } catch {}
    }

    // 2. Almacenamiento local persistente
    const val = localStorage.getItem(APP_CONFIG.storageKeys.maquinaId);
    return val ? parseInt(val, 10) : 0;
  },

  setMaquinaId(id: number, nombre?: string): void {
    if (id > 0) {
      localStorage.setItem(APP_CONFIG.storageKeys.maquinaId, id.toString());
      const nombreOficial = getNombreMaquinaOficial(id, nombre);
      localStorage.setItem(APP_CONFIG.storageKeys.maquinaNombre, nombreOficial);
    } else {
      localStorage.removeItem(APP_CONFIG.storageKeys.maquinaId);
      localStorage.removeItem(APP_CONFIG.storageKeys.maquinaNombre);
    }
  },

  getMaquinaNombre(): string {
    const id = this.getMaquinaId();
    const stored = localStorage.getItem(APP_CONFIG.storageKeys.maquinaNombre) || '';
    return getNombreMaquinaOficial(id, stored);
  },

  getLineaEmpaque(): string {
    const val = localStorage.getItem(APP_CONFIG.storageKeys.lineaEmpaque);
    if (!val || val === 'A') return '1';
    if (val === 'B') return '2';
    return val;
  },

  setLineaEmpaque(linea: string): void {
    localStorage.setItem(APP_CONFIG.storageKeys.lineaEmpaque, linea);
  },

  getNoEmpleado(): string {
    return localStorage.getItem(APP_CONFIG.storageKeys.noEmpleado) || '';
  },

  setNoEmpleado(no: string, nombre?: string): void {
    localStorage.setItem(APP_CONFIG.storageKeys.noEmpleado, no);
    if (nombre) localStorage.setItem(APP_CONFIG.storageKeys.nombreEmpleado, nombre);
  },

  getNombreEmpleado(): string {
    return localStorage.getItem(APP_CONFIG.storageKeys.nombreEmpleado) || '';
  },

  getTheme(): ChromeTheme {
    return (localStorage.getItem(APP_CONFIG.storageKeys.theme) as ChromeTheme) || 'royal-navy';
  },

  setTheme(theme: ChromeTheme): void {
    localStorage.setItem(APP_CONFIG.storageKeys.theme, theme);
  },

  getSupervisorPin(): string {
    return localStorage.getItem(APP_CONFIG.storageKeys.supervisorPin) || 'kcc123';
  },

  setSupervisorPin(pin: string): void {
    localStorage.setItem(APP_CONFIG.storageKeys.supervisorPin, pin);
  },

  getPermitirCambioLinea(): boolean {
    return localStorage.getItem(APP_CONFIG.storageKeys.permitirCambioLinea) === 'true';
  },

  setPermitirCambioLinea(permitir: boolean): void {
    localStorage.setItem(APP_CONFIG.storageKeys.permitirCambioLinea, permitir ? 'true' : 'false');
  },

  getInactivityTimeout(): number {
    const saved = localStorage.getItem(APP_CONFIG.storageKeys.inactivityTimeout);
    if (saved === null || saved === undefined) {
      return APP_CONFIG.inactivity.defaultMinutes; // 20 min default
    }
    const parsed = parseInt(saved, 10);
    return isNaN(parsed) ? APP_CONFIG.inactivity.defaultMinutes : parsed;
  },

  setInactivityTimeout(minutes: number): void {
    localStorage.setItem(APP_CONFIG.storageKeys.inactivityTimeout, minutes.toString());
  },

  getServerIp(): string {
    // 1. Prioridad: Lo que el supervisor haya configurado explícitamente en esta terminal
    const saved = localStorage.getItem('PalletsWW_ServerIp');
    if (saved && saved.trim()) return saved.trim();

    // 2. Si no hay configuración manual previa, tomar el host al que se conectó el navegador
    if (typeof window !== 'undefined' && window.location) {
      const host = window.location.hostname;
      if (host && host !== 'localhost' && host !== '127.0.0.1') {
        return host;
      }
    }

    // 3. Fallback predeterminado oficial de planta
    return '10.26.24.31';
  },

  getServerPort(): number {
    const saved = localStorage.getItem('PalletsWW_ServerPort');
    if (saved) {
      const p = parseInt(saved, 10);
      if (!isNaN(p) && p > 0) return p;
    }
    if (typeof window !== 'undefined' && window.location && window.location.port) {
      const p = parseInt(window.location.port, 10);
      if (!isNaN(p) && p > 0) return p;
    }
    return 5106;
  },

  setServerConfig(ip: string, port: number = 5106): void {
    const cleanIp = ip.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '').replace(/:.*$/, '');
    if (cleanIp) {
      localStorage.setItem('PalletsWW_ServerIp', cleanIp);
      localStorage.setItem('PalletsWW_ServerPort', port.toString());
      localStorage.setItem('PalletsWW_ApiUrl', `http://${cleanIp}:5105`);
    }
  }
};

