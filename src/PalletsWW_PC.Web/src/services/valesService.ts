import { api } from './api';
import type { 
  ValeProduccionDto, 
  EncabezadoTurnoDto, 
  NuevoValeRequest, 
  ModificarFolioValeRequest,
  ValeSiguienteSugeridoDto 
} from '../types';

export interface ValeApiResult {
  exitoso: boolean;
  exito?: boolean;
  mensaje: string;
  idAutotblProduccion?: number;
  folioVale?: number;
}

export function normalizarVale(v: any): ValeProduccionDto {
  if (!v) return v;
  return {
    idAutotblProduccion: v.idAutotblProduccion || 0,
    folioVale: v.folioVale || 0,
    clave: v.clave || v.claveProducto || '',
    descripcion: v.descripcion || v.descripcionProducto || '',
    totalCajas: v.totalCajas ?? v.cajasProgramadas ?? 0,
    totalPallets: v.totalPallets ?? v.totalTarimas ?? 0,
    cajasPorTarima: v.cajasPorTarima || v.cajasPorPallet || 63,
    cajasProgramadas: v.cajasProgramadas ?? v.totalCajas ?? 0,
    lineaEmpaque: v.lineaEmpaque || '1',
    idtblProductos: v.idtblProductos || 0,
    idRT_Encabezado: v.idRT_Encabezado || 0,
    esTurnoAnterior: !!v.esTurnoAnterior
  };
}

export function normalizarEncabezado(enc: any): EncabezadoTurnoDto {
  if (!enc) {
    return {
      idRT_Encabezado: 0,
      fecha: new Date().toISOString(),
      noMaquina: 0,
      turno: 1,
      tripulacion: '-',
      noSupervisor: 0,
      nombreSupervisor: 'Sin Turno Activo',
      encontrado: false
    };
  }
  return {
    idRT_Encabezado: enc.idRT_Encabezado || 0,
    fecha: enc.fecha ? String(enc.fecha) : new Date().toISOString(),
    noMaquina: enc.noMaquina || enc.maquina || 0,
    turno: enc.turno || 1,
    tripulacion: enc.tripulacion || '-',
    noSupervisor: enc.noSupervisor || enc.supervisor || 0,
    nombreSupervisor: enc.nombreSupervisor || '',
    encontrado: !!enc.encontrado,
    mensaje: enc.mensaje
  };
}

export const valesService = {
  getEncabezadoActual: async (noMaquina: number, turno?: number, fecha?: string): Promise<EncabezadoTurnoDto> => {
    let url = `/api/vales/encabezado-completo?noMaquina=${noMaquina}`;
    if (turno && turno > 0) url += `&turno=${turno}`;
    if (fecha) url += `&fecha=${encodeURIComponent(fecha)}`;
    const data = await api.get<any>(url);
    return normalizarEncabezado(data);
  },

  getEncabezadoActivo: async (noMaquina: number): Promise<EncabezadoTurnoDto> => {
    const data = await api.get<any>(`/api/vales/encabezado-completo?noMaquina=${noMaquina}`);
    return normalizarEncabezado(data);
  },

  getValesActivos: async (noMaquina: number, turno?: number, fecha?: string, idEncabezado?: number): Promise<ValeProduccionDto[]> => {
    let url = `/api/vales/activos?noMaquina=${noMaquina}`;
    if (turno && turno > 0) url += `&turno=${turno}`;
    if (fecha) url += `&fecha=${encodeURIComponent(fecha)}`;
    if (idEncabezado && idEncabezado > 0) url += `&idEncabezado=${idEncabezado}`;
    const data = await api.get<any[]>(url);
    return (data || []).map(normalizarVale);
  },

  getValesTurnoActual: async (idEncabezado?: number, _lineaEmpaque?: string): Promise<ValeProduccionDto[]> => {
    const data = await api.get<any[]>(`/api/vales/activos?idEncabezado=${idEncabezado || 0}`);
    return (data || []).map(normalizarVale);
  },

  getValesHistoricos: async (noMaquina: number, turno?: number, fecha?: string): Promise<ValeProduccionDto[]> => {
    let url = `/api/vales/turno-anterior?noMaquina=${noMaquina}`;
    if (turno && turno > 0) url += `&turno=${turno}`;
    if (fecha) url += `&fecha=${encodeURIComponent(fecha)}`;
    const data = await api.get<any[]>(url);
    return (data || []).map(v => ({ ...normalizarVale(v), esTurnoAnterior: true }));
  },

  getValesTurnoAnterior: async (noMaquina: number, _lineaEmpaque?: string, turno?: string, fecha?: string): Promise<ValeProduccionDto[]> => {
    const t = turno ? Number(turno) : undefined;
    return valesService.getValesHistoricos(noMaquina, t, fecha);
  },

  getDetalleVale: async (folioVale: number, idEncabezado: number) => {
    const data = await api.get<any>(`/api/vales/detalle?folioVale=${folioVale}&idEncabezado=${idEncabezado}`);
    return data ? normalizarVale(data) : null;
  },

  getDetalleValePorId: async (idAutotblProduccion: number) => {
    const data = await api.get<any>(`/api/vales/${idAutotblProduccion}/detalle-id`);
    return data ? normalizarVale(data) : null;
  },

  getSiguienteSugerido: async (_noMaquina?: number, _idEncabezado?: number): Promise<ValeSiguienteSugeridoDto> => ({
    siguienteFolio: 1,
    idtblProductosSugerido: undefined,
    claveProductoSugerida: '',
    descripcionProductoSugerida: '',
    cajasPorTarimaSugerida: 25
  }),

  crearVale: (request: NuevoValeRequest) =>
    api.post<ValeApiResult>('/api/vales/crear', {
      folioVale: request.folioVale,
      idtblProductos: request.idtblProductos,
      idRT_Encabezado: request.idRT_Encabezado,
      lineaEmpaque: request.lineaEmpaque,
      totalCajas: request.totalCajas || 0
    }),

  modificarVale: (request: ModificarFolioValeRequest) =>
    api.put<ValeApiResult>('/api/vales/modificar', {
      idAutotblProduccion: request.idAutotblProduccion,
      folioVale: request.folioValeNuevo,
      idtblProductos: request.idtblProductos || 0,
      lineaEmpaque: request.lineaEmpaque || '1'
    }),

  modificarFolio: (request: ModificarFolioValeRequest) =>
    valesService.modificarVale(request),
};