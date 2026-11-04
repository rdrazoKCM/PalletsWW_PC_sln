import { api } from './api';
import type { 
  PalletDto, 
  InsertarPalletRequest, 
  ActualizarPalletRequest,
  ReporteConciliacionResponseDto 
} from '../types';

export interface PalletInsertResponse {
  exitoso: boolean;
  exito?: boolean;
  mensaje: string;
  idtblPallets: number;
  idtblPalletsPanal?: number;
  noTarima?: string;
  codigoZpl?: string;
  codigo?: number;
  codigoRespuesta?: number;
}

export function normalizarPallet(p: any): PalletDto {
  if (!p) return p;
  const id = p.idtblPallets || p.idtblPalletsPanal || 0;
  return {
    idtblPallets: id,
    idtblPalletsPanal: id,
    noTarima: p.noTarima ? String(p.noTarima) : '',
    totalCajas: p.totalCajas ?? 0,
    hora: p.hora ? String(p.hora).substring(0, 5) : '',
    lineaEmpaque: p.lineaEmpaque || p.linea || '1',
    linea: p.lineaEmpaque || p.linea || '1',
    folioVale: p.folioVale || 0,
    lote: p.lote || '',
    descripcionProducto: p.descripcionProducto || p.descripcion || '',
    claveProducto: p.claveProducto || p.clave || ''
  };
}

export const palletsService = {
  getPalletsPorVale: async (folioVale: number, idEncabezado?: number): Promise<PalletDto[]> => {
    const enc = idEncabezado && idEncabezado > 0 ? idEncabezado : 0;
    const data = await api.get<any[]>(`/api/pallets/vale/${folioVale}?idEncabezado=${enc}`);
    return (data || []).map(normalizarPallet);
  },

  getPalletPorId: (idtblPallets: number) =>
    api.get<PalletDto>(`/api/pallets/${idtblPallets}`),
    
  insertarPallet: (request: InsertarPalletRequest) => 
    api.post<PalletInsertResponse>('/api/pallets', request),
    
  actualizarPallet: (idOrReq: number | ActualizarPalletRequest, request?: Partial<ActualizarPalletRequest>) => {
    if (typeof idOrReq === 'number') {
      return api.put<PalletInsertResponse>(`/api/pallets/${idOrReq}`, request || {});
    }
    const id = idOrReq.idtblPallets || 0;
    return api.put<PalletInsertResponse>(`/api/pallets/${id}`, idOrReq);
  },

  eliminarPallet: (id: number) =>
    api.delete<{ mensaje: string }>(`/api/pallets/${id}`),

  obtenerReporteConciliacion: (noMaquina: number, turno: number, fecha: string, lineaEmpaque?: number) => {
    let url = `/api/pallets/reporte/conciliacion?noMaquina=${noMaquina}&turno=${turno}&fecha=${encodeURIComponent(fecha)}`;
    if (lineaEmpaque && lineaEmpaque > 0) {
      url += `&lineaEmpaque=${lineaEmpaque}`;
    }
    return api.get<ReporteConciliacionResponseDto>(url);
  },

  verificarORecuperarPallet: async (
    _clientTransactionId?: string, 
    folioVale?: number, 
    idEncabezado?: number,
    hora?: string,
    linea?: string
  ): Promise<PalletInsertResponse> => {
    if (!folioVale || folioVale <= 0) {
      return { exitoso: false, mensaje: 'Sin datos para verificación', idtblPallets: 0 };
    }
    try {
      const list = await palletsService.getPalletsPorVale(folioVale, idEncabezado);
      if (list && list.length > 0) {
        if (hora) {
          const match = list.find(p => 
            (p.hora || '').trim() === hora.trim() && 
            (!linea || String(p.lineaEmpaque || p.linea || '1').trim() === String(linea).trim())
          );
          if (match) {
            return {
              exitoso: true,
              mensaje: 'Tarima recuperada del servidor',
              idtblPallets: match.idtblPallets || (match as any).idtblPalletsPanal || 0,
              noTarima: match.noTarima
            };
          }
        }
        const last = list[list.length - 1];
        return {
          exitoso: true,
          mensaje: 'Tarima recuperada del servidor',
          idtblPallets: last.idtblPallets || (last as any).idtblPalletsPanal || 0,
          noTarima: last.noTarima
        };
      }
    } catch {}
    return { exitoso: false, mensaje: 'No encontrada', idtblPallets: 0 };
  }
};