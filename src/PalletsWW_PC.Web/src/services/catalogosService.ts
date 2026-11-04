import { api } from './api';
import type { MaquinaDto, SupervisorDto, EmpleadoDto, ProductoDto, LineaEmpaqueDto, PerfilAppDto } from '../types';

export const catalogosService = {
  getPerfil: () =>
    api.get<PerfilAppDto>('/api/catalogos/perfil'),

  getMaquinas: () => 
    api.get<MaquinaDto[]>('/api/catalogos/maquinas'),
  
  getSupervisores: () => 
    api.get<SupervisorDto[]>('/api/catalogos/supervisores'),
  
  getOperadores: () => 
    api.get<EmpleadoDto[]>('/api/catalogos/operadores'),

  getEmpleado: (noEmpleado: number) => 
    catalogosService.validarOperador(noEmpleado),

  validarOperador: async (noEmpleado: number): Promise<EmpleadoDto | null> => {
    try {
      const res = await api.get<any>(`/api/catalogos/operadores/validar/${noEmpleado}`);
      if (!res) return null;
      const nom = res.nombreEmpleado || res.nombre || res.nombreCompleto || '';
      return {
        noEmpleado: res.noEmpleado || res.noEmp || noEmpleado,
        nombreEmpleado: nom,
        nombreCompleto: nom
      };
    } catch {
      return null;
    }
  },
  
  getProductosPorMaquina: async (noMaquina: number): Promise<ProductoDto[]> => {
    try {
      const data = await api.get<any[]>(`/api/catalogos/productos/${noMaquina}`);
      return (data || []).map(p => {
        const desc = p.descripcionProducto || p.descripcionClave || p.descripcion || '';
        return {
          idtblProductos: p.idtblProductos || 0,
          claveProducto: String(p.claveProducto || '').trim(),
          descripcionProducto: desc,
          descripcionClave: desc,
          descripcion: desc,
          cajasXPallet: p.cajasXPallet || p.cajasPorTarima || 25,
          cajasPorTarima: p.cajasPorTarima || p.cajasXPallet || 25,
        };
      });
    } catch {
      return [];
    }
  },

  getLineasEmpaque: async (noMaquina: number): Promise<LineaEmpaqueDto[]> => {
    try {
      const data = await api.get<any[]>(`/api/catalogos/lineas-empaque/${noMaquina}`);
      return (data || []).map(l => ({
        idLineaEmpaque: l.idLineaEmpaque || 0,
        lineaEmpaque: String(l.lineaEmpaque || l.linea || '').trim(),
        descripcion: l.descripcion || `Línea ${l.lineaEmpaque || ''}`
      })).filter(l => l.lineaEmpaque.length > 0);
    } catch {
      return [];
    }
  },

  getMaquinaLocal: () =>
    api.get<number>('/api/catalogos/maquina-local'),

  guardarMaquinaLocal: (noMaquina: number) =>
    api.post<{ exitoso: boolean; mensaje: string }>(`/api/catalogos/maquina-local/${noMaquina}`),
};