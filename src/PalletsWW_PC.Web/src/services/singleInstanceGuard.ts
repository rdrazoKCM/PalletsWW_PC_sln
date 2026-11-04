/**
 * Guardián de Instancia Única para Pallets Pañal PC
 * Asegura que únicamente exista una sola ventana activa de la aplicación en el equipo.
 * Si el usuario intenta abrir una segunda ventana, la ventana previa se enfoca
 * y la nueva ventana se cierra automáticamente.
 */

const CHANNEL_NAME = 'kcm_pallets_wipes_single_instance_channel';
const STORAGE_KEY = 'kcm_pallets_wipes_active_window';

export function initSingleInstanceGuard(onDuplicateDetected: () => void): () => void {
  const windowId = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  let isPrimary = false;
  let channel: BroadcastChannel | null = null;

  try {
    channel = new BroadcastChannel(CHANNEL_NAME);
  } catch {
    // Si el navegador no soporta BroadcastChannel, continuar con localStorage
  }

  // 1. Verificar si ya existe una ventana registrada recientemente en localStorage
  const currentActive = localStorage.getItem(STORAGE_KEY);
  if (currentActive) {
    try {
      const data = JSON.parse(currentActive);
      // Si la ventana activa reportó actividad en los últimos 3 segundos
      if (Date.now() - (data.timestamp || 0) < 3000) {
        // Enviar ping para verificar si sigue viva
        channel?.postMessage({ type: 'PING_PRIMARY', from: windowId });
      }
    } catch {
      // ignore
    }
  }

  // 2. Manejador de mensajes entre ventanas
  const handleMessage = (msg: { type: string; from?: string; primaryId?: string }) => {
    if (!msg) return;

    if (msg.type === 'PING_PRIMARY' && isPrimary) {
      // Otra ventana está intentando abrirse mientras esta ya es la primaria
      channel?.postMessage({ type: 'PONG_PRIMARY_ACTIVE', primaryId: windowId });
      window.focus();
    } else if (msg.type === 'PONG_PRIMARY_ACTIVE' && !isPrimary) {
      // Se detectó que ya hay una ventana activa: cerrar esta ventana duplicada
      onDuplicateDetected();
    }
  };

  if (channel) {
    channel.onmessage = (event) => handleMessage(event.data);
  }

  // 3. Reclamar el rol de ventana primaria si no hay otra
  const claimTimeout = setTimeout(() => {
    isPrimary = true;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ id: windowId, timestamp: Date.now() }));
  }, 250);

  // 4. Heartbeat de la ventana primaria cada 1.5 segundos
  const heartbeatInterval = setInterval(() => {
    if (isPrimary) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ id: windowId, timestamp: Date.now() }));
    }
  }, 1500);

  // 5. Escuchar storage events para sincronización entre procesos
  const handleStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      try {
        const data = JSON.parse(e.newValue);
        if (data.id !== windowId && !isPrimary) {
          // Otra ventana se registró como primaria
          onDuplicateDetected();
        }
      } catch { }
    }
  };
  window.addEventListener('storage', handleStorage);

  // 6. Limpieza al descargar la ventana
  const cleanup = () => {
    clearTimeout(claimTimeout);
    clearInterval(heartbeatInterval);
    if (isPrimary) {
      localStorage.removeItem(STORAGE_KEY);
      channel?.postMessage({ type: 'PRIMARY_CLOSED', from: windowId });
    }
    window.removeEventListener('storage', handleStorage);
    channel?.close();
  };

  window.addEventListener('beforeunload', cleanup);
  return cleanup;
}
