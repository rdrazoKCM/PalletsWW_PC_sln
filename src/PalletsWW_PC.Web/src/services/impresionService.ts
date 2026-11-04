import { APP_CONFIG } from '../config';
import { api } from './api';
import type { HardwarePrinterStatus, ImpresionEtiquetaResponse } from '../types';

/**
 * Helper para validar si el nombre de una impresora corresponde a una impresora
 * térmica industrial compatible con lenguaje ZPL (Zebra).
 */
export function esImpresoraZebra(nombre: string): boolean {
  if (!nombre) return false;
  const nom = nombre.toLowerCase().trim();

  if (
    nom.includes('pdf') ||
    nom.includes('onenote') ||
    nom.includes('xps') ||
    nom.includes('fax') ||
    nom.includes('root print queue')
  ) {
    return false;
  }

  const patronesZebra = [
    'zdesigner',
    'zebra',
    'zt411', 'zt230', 'zt410', 'zt420', 'zt510', 'zt610',
    'zd220', 'zd230', 'zd420', 'zd421', 'zd620', 'zd621',
    'gk420', 'gx420', 'gx430', 'gc420', 'gt800',
    'tlp', 'lp 2844', 'lp2844',
    'generic / text only',
    'etiqueta', 'termica', 'thermal', 'barcode'
  ];

  return patronesZebra.some(patron => nom.includes(patron));
}

export const impresionService = {
  /**
   * Consulta el estado del hardware de impresión en el microservicio local PrintBridge
   */
  async getStatus(): Promise<HardwarePrinterStatus> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000); // Rápido: 2s max

      const response = await fetch(`${APP_CONFIG.printBridgeUrl}/status`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        const isOffline = data.isOffline ?? (data.conectada === false);
        const isPaused = data.isPaused ?? data.enPausa ?? false;
        const sinPapel = data.sinPapel ?? false;
        const tapaAbierta = data.tapaAbierta ?? false;
        const isError = data.isError ?? false;
        const isConnected = !isOffline && (data.conectada !== false);
        const nombreImpresora = data.nombre || data.name || 'Zebra ZT411 / ZT230';
        const esCompatible = isConnected ? esImpresoraZebra(nombreImpresora) : false;

        let defaultMsg = 'Impresora Lista';
        if (!isConnected) {
          defaultMsg = 'Impresora Desconectada';
        } else if (!esCompatible) {
          defaultMsg = 'Impresora no compatible (Se requiere Zebra ZPL)';
        } else if (isPaused) {
          defaultMsg = 'Impresora en Pausa';
        } else if (sinPapel) {
          defaultMsg = 'Impresora Sin Papel';
        } else if (tapaAbierta) {
          defaultMsg = 'Impresora: Tapa Abierta';
        } else if (isError) {
          defaultMsg = 'Impresora en Error';
        }

        return {
          conectada: isConnected,
          esCompatible,
          enPausa: isPaused,
          sinPapel,
          tapaAbierta,
          isError,
          nombre: nombreImpresora,
          trabajosEnCola: data.trabajosEnCola ?? data.cJobs ?? 0,
          mensaje: !esCompatible 
            ? `Impresora no compatible: "${nombreImpresora}" no admite código ZPL.` 
            : (data.mensaje || data.statusDesc || defaultMsg)
        };
      }
    } catch {
      // PrintBridge local no respondió
    }

    return {
      conectada: false,
      esCompatible: false,
      enPausa: false,
      nombre: 'PrintBridge Desconectado',
      trabajosEnCola: 0,
      mensaje: 'Servicio local Zebra PrintBridge no responde en http://127.0.0.1:9100'
    };
  },

  /**
   * Imprime etiqueta ZPL directo de una tarima mediante su ID
   */
  async imprimirPallet(idtblPallets: number): Promise<ImpresionEtiquetaResponse> {
    try {
      // 1. Obtener datos de la etiqueta desde el API
      const result = await api.get<any>(`/api/impresion/etiqueta/${idtblPallets}`);
      const zplCode = result?.codigoZpl || result?.zplCode;

      if (zplCode) {
        // Inyectar de inmediato a 127.0.0.1:9100
        const resBridge = await this.inyectarZplDirecto(zplCode);
        return {
          ...resBridge,
          tarima: result?.noTarima,
          lote: result?.lote,
          producto: result?.descripcionProducto,
        };
      }

      // Fallback: enviar petición al endpoint de impresión directa del servidor
      const postRes = await api.post<any>(`/api/impresion/enviar/${idtblPallets}`);
      return {
        exito: postRes?.exitoso ?? true,
        mensaje: postRes?.mensaje ?? 'Impresión completada',
        zplCode: postRes?.codigoZpl,
        tarima: postRes?.noTarima,
        lote: postRes?.lote,
        producto: postRes?.descripcionProducto,
      };
    } catch (error: any) {
      const es404 = error?.status === 404 || error?.message?.includes('404') || error?.data?.mensaje?.includes('no encontrado');
      return {
        exito: false,
        mensaje: es404 
          ? `El Pallet #${idtblPallets} no existe en la base de datos.` 
          : (error.message || 'Error al enviar trabajo a la impresora')
      };
    }
  },

  /**
   * Inyecta código ZPL directamente al microservicio local PrintBridge (127.0.0.1:9100)
   * sin latencia de red (< 50 ms).
   */
  async inyectarZplDirecto(zplCode: string): Promise<ImpresionEtiquetaResponse> {
    try {
      const pbRes = await fetch(`${APP_CONFIG.printBridgeUrl}/print`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: zplCode,
      });

      if (!pbRes.ok) {
        const errText = await pbRes.text();
        if (pbRes.status === 409) {
          return {
            exito: false,
            mensaje: `Impresora en PAUSA: ${errText || 'Reanude la impresora Zebra para imprimir.'}`,
            zplCode
          };
        } else if (pbRes.status === 503) {
          return {
            exito: false,
            mensaje: `Impresora Fuera de Línea / Desconectada: ${errText || 'Verifique cable USB y encendido.'}`,
            zplCode
          };
        } else {
          return {
            exito: false,
            mensaje: `Aviso PrintBridge (${pbRes.status}): ${errText}`,
            zplCode
          };
        }
      }

      return {
        exito: true,
        mensaje: 'Etiqueta enviada correctamente al cabezal Zebra.',
        zplCode
      };
    } catch (pbErr: any) {
      console.warn('PrintBridge local no respondió al inyectar ZPL:', pbErr);
      return {
        exito: false,
        mensaje: 'No se pudo enviar al cabezal Zebra: El microservicio local en http://127.0.0.1:9100 no responde.',
        zplCode
      };
    }
  }
};