/**
 * Servicio de Alertas en Tiempo Real de Pallets Sin Etiqueta
 * Patrón Híbrido Resiliente: SignalR Push + Sincronización Inicial + Auto-reconexión
 * Estándar MD5 Kimberly-Clark
 */
import * as signalR from '@microsoft/signalr';
import { getApiBaseUrl } from '../config';

export interface AlertaPallet {
  idAlerta: number;
  noMaquina: number;
  nombreMaquina: string;
  fechaRegistro: string;
  noEmpSup: number;
  comentarios: string;
  estatus: string;
  minutosTranscurridos: number;
}

export interface AlertaRegistrarPayload {
  noMaquina: number;
  noEmpSup?: number;
  idtblEncabRecepcionAlmacenPT?: number;
  comentarios?: string;
}

export interface AlertaAtenderPayload {
  idAlerta: number;
  noEmpOperadorMaquina: number;
  idPalletGenerado?: number;
}

class AlertasService {
  private connection: signalR.HubConnection | null = null;
  private currentNoMaquina: number = 0;
  private listeners: ((alertas: AlertaPallet[]) => void)[] = [];
  private currentAlertas: AlertaPallet[] = [];
  private audioContext: AudioContext | null = null;

  /**
   * Obtiene la lista actual de alertas activas en memoria.
   */
  public getAlertasActivas(): AlertaPallet[] {
    return this.currentAlertas;
  }

  /**
   * Suscribe un componente UI a los cambios en las alertas activas.
   */
  public suscribir(callback: (alertas: AlertaPallet[]) => void): () => void {
    this.listeners.push(callback);
    callback(this.currentAlertas);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  private notificarCambios(): void {
    this.listeners.forEach(cb => cb([...this.currentAlertas]));
  }

  /**
   * Inicializa la conexión SignalR para la máquina configurada en la terminal.
   * Aplica sincronización inicial (1 sola llamada HTTP) y auto-reconexión ante cortes.
   */
  public async iniciarConexion(noMaquina: number): Promise<void> {
    if (!noMaquina || noMaquina <= 0) return;
    this.currentNoMaquina = noMaquina;

    // 1. Sincronización Inicial Inmediata (Hidratación vía REST)
    await this.sincronizarAlertas(noMaquina);

    // 2. Si ya hay una conexión activa para esta máquina, no duplicar
    if (this.connection && this.connection.state === signalR.HubConnectionState.Connected) {
      await this.connection.invoke('UnirseAMaquina', noMaquina).catch(() => {});
      return;
    }

    const hubUrl = `${getApiBaseUrl()}/hubs/alertas`;

    this.connection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, {
        transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.LongPolling,
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    // Evento: Alerta entrante desde Almacén
    this.connection.on('NuevaAlerta', (nueva: AlertaPallet) => {
      if (nueva.noMaquina === this.currentNoMaquina) {
        // Evitar duplicados
        if (!this.currentAlertas.some(a => a.idAlerta === nueva.idAlerta)) {
          this.currentAlertas = [nueva, ...this.currentAlertas];
          this.notificarCambios();
          this.reproducirChimeAlerta();
        }
      }
    });

    // Evento: Alerta atendida por un operador
    this.connection.on('AlertaAtendida', (idAlerta: number) => {
      this.currentAlertas = this.currentAlertas.filter(a => a.idAlerta !== idAlerta);
      this.notificarCambios();
    });

    // Evento: Alerta cancelada desde Almacén
    this.connection.on('AlertaCancelada', (idAlerta: number) => {
      this.currentAlertas = this.currentAlertas.filter(a => a.idAlerta !== idAlerta);
      this.notificarCambios();
    });

    // Evento de Reconexión: Cuando la red regresa tras una caída, sincronizar de nuevo
    this.connection.onreconnected(async () => {
      if (this.currentNoMaquina > 0) {
        await this.connection?.invoke('UnirseAMaquina', this.currentNoMaquina).catch(() => {});
        await this.sincronizarAlertas(this.currentNoMaquina);
      }
    });

    try {
      await this.connection.start();
      await this.connection.invoke('UnirseAMaquina', noMaquina);
    } catch (err) {
      // Si falla la conexión inicial de SignalR (ej. sin red), queda respaldado por la sincronización
      console.warn('SignalR Hub no disponible temporalmente, operando en modo desconectado:', err);
    }
  }

  /**
   * Consulta directa vía HTTP para sincronización garantizada.
   */
  public async sincronizarAlertas(noMaquina: number): Promise<AlertaPallet[]> {
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/alertas/maquina/${noMaquina}/activas`);
      if (res.ok) {
        const data: AlertaPallet[] = await res.json();
        this.currentAlertas = Array.isArray(data) ? data : [];
        this.notificarCambios();
        return this.currentAlertas;
      }
    } catch {
      // Error silencioso en red
    }
    return this.currentAlertas;
  }

  /**
   * Marca una alerta como atendida al capturar o confirmar la tarima.
   */
  public async atenderAlerta(payload: AlertaAtenderPayload): Promise<boolean> {
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/alertas/atender`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        this.currentAlertas = this.currentAlertas.filter(a => a.idAlerta !== payload.idAlerta);
        this.notificarCambios();
        return true;
      }
    } catch (err) {
      console.error('Error al atender alerta:', err);
    }
    return false;
  }

  /**
   * Permite a Almacén o pruebas registrar una alerta.
   */
  public async registrarAlerta(payload: AlertaRegistrarPayload): Promise<number | null> {
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/alertas/registrar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        return data.idAlerta || null;
      }
    } catch (err) {
      console.error('Error al registrar alerta:', err);
    }
    return null;
  }

  /**
   * Cierra la conexión de SignalR si la terminal cambia de máquina.
   */
  public async detenerConexion(): Promise<void> {
    if (this.connection) {
      if (this.currentNoMaquina > 0) {
        await this.connection.invoke('SalirDeMaquina', this.currentNoMaquina).catch(() => {});
      }
      await this.connection.stop().catch(() => {});
      this.connection = null;
    }
    this.currentAlertas = [];
    this.notificarCambios();
  }

  /**
   * Genera un chime sonoro industrial sutil y profesional usando Web Audio API.
   * Sin dependencias de archivos mp3 externos.
   */
  public reproducirChimeAlerta(): void {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      if (!this.audioContext || this.audioContext.state === 'suspended') {
        this.audioContext = new AudioCtx();
      }

      const ctx = this.audioContext;
      const now = ctx.currentTime;

      // Oscilador 1: Tono base agradable (523.25 Hz - C5)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(523.25, now);
      gain1.gain.setValueAtTime(0.15, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.35);

      // Oscilador 2: Tono armonioso agudo (659.25 Hz - E5)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(659.25, now + 0.12);
      gain2.gain.setValueAtTime(0.18, now + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.55);
    } catch {
      // Ignorar si el navegador bloquea audio sin interacción de usuario
    }
  }
}

export const alertasService = new AlertasService();