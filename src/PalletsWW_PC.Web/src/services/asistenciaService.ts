import { api } from './api';
import type { AsistenciaResponseDto } from '../types';

export const asistenciaService = {
  /**
   * Consulta los últimos 100 registros de asistencia por máquina.
   * Si no se envía noMaquina, la API lee automáticamente C:\ArchivosBitacoraAut\Maquina.txt.
   */
  getRegistros: async (noMaquina?: number): Promise<AsistenciaResponseDto> => {
    try {
      const endpoint = noMaquina && noMaquina > 0
        ? `/api/asistencia/registros?noMaquina=${noMaquina}`
        : '/api/asistencia/registros';

      const data = await api.get<AsistenciaResponseDto>(endpoint);
      return data;
    } catch (error: any) {
      return {
        exitoso: false,
        noMaquina: noMaquina || 0,
        nombreMaquina: `Máquina ${noMaquina || 0}`,
        totalRegistros: 0,
        fechaConsulta: new Date().toISOString(),
        registros: [],
        mensaje: error?.message || 'Error de comunicación al consultar asistencia'
      };
    }
  },

  /**
   * Consulta auditoría de asistencia gerencial por rango de fechas (sin condición de máquina).
   * Opcionalmente filtra por número de empleado (noEmp).
   */
  consultarGerencial: async (fechaInicio: string, fechaFin: string, noEmp?: number): Promise<import('../types').AsistenciaGerencialResponseDto> => {
    try {
      let endpoint = `/api/asistencia/gerencial?fechaInicio=${encodeURIComponent(fechaInicio)}&fechaFin=${encodeURIComponent(fechaFin)}`;
      if (noEmp && noEmp > 0) {
        endpoint += `&noEmp=${noEmp}`;
      }
      const data = await api.get<import('../types').AsistenciaGerencialResponseDto>(endpoint);
      return data;
    } catch (error: any) {
      return {
        exitoso: false,
        totalRegistros: 0,
        totalColaboradoresUnicos: 0,
        fechaInicio,
        fechaFin,
        items: [],
        mensaje: error?.message || 'Error de comunicación al consultar auditoría de asistencia'
      };
    }
  }
};
