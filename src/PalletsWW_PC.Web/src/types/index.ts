/**
 * Definiciones y tipos de TypeScript para Pallets Wipes PC
 * Homologado con MD5 y PalletsWW_PC.Api
 */

export interface MaquinaDto {
  noMaquina: number;
  descripcionMaquina: string;
}

export interface SupervisorDto {
  noEmpleado: number;
  nombreSupervisor: string;
}

export interface EmpleadoDto {
  noEmpleado: number;
  nombreEmpleado: string;
  nombreCompleto?: string;
  puesto?: string;
}

export interface LineaEmpaqueDto {
  idLineaEmpaque?: number;
  lineaEmpaque: string;
  descripcion?: string;
}

export interface ProductoDto {
  idtblProductos: number;
  claveProducto: string;
  descripcionProducto?: string;
  descripcionClave?: string;
  descripcion?: string;
  cajasPorTarima?: number;
  cajasXPallet?: number;
  prodXCaja?: number;
  conteo?: string;
}

export interface EncabezadoTurnoDto {
  idRT_Encabezado: number;
  fecha: string;
  noMaquina: number;
  maquina?: number;
  turno: number;
  tripulacion: string;
  noSupervisor: number;
  supervisor?: number;
  nombreSupervisor?: string;
  encontrado: boolean;
  mensaje?: string;
}

export interface ValeProduccionDto {
  idAutotblProduccion: number;
  folioVale: number;
  clave: string;
  claveProducto?: string;
  descripcion: string;
  descripcionProducto?: string;
  totalCajas?: number;
  totalPallets: number;
  cajasPorTarima?: number;
  cajasProgramadas?: number;
  lineaEmpaque: string;
  idRT_Encabezado?: number;
  esTurnoAnterior?: boolean;
  idtblProductos?: number;
}

export interface ValeSiguienteSugeridoDto {
  siguienteFolio: number;
  idtblProductosSugerido?: number;
  claveProductoSugerida?: string;
  descripcionProductoSugerida?: string;
  cajasPorTarimaSugerida?: number;
}

export interface PalletDto {
  idtblPallets: number;
  idtblPalletsPanal?: number; // Compatibilidad de alias visual
  noTarima: string;
  totalCajas: number;
  fechaSys?: string;
  hora: string;
  noEmpCapturo?: number;
  estatus?: string;
  folioVale?: number;
  descripcionProducto?: string;
  claveProducto?: string;
  lineaEmpaque?: string;
  linea?: string;
  lote?: string;
}

export interface NuevoValeRequest {
  folioVale: number;
  clave: string;
  idtblProductos?: number;
  idRT_Encabezado: number;
  lineaEmpaque: string;
  totalCajas?: number;
}

export interface ModificarFolioValeRequest {
  idAutotblProduccion: number;
  folioValeNuevo: number;
  idtblProductos?: number;
  lineaEmpaque?: string;
}

export interface InsertarPalletRequest {
  folioVale: number;
  idtblProductos: number;
  totalCajas: number;
  hora: string;
  idRT_Encabezado: number;
  noEmpCapturo: number;
  linea: string; // Selector obligatorio Línea 1 o Línea 2
  idAutotblProduccion?: number;
  noMaquina?: number;
  clientTransactionId?: string;
}

export interface ActualizarPalletRequest {
  idtblPallets: number;
  totalCajas: number;
  hora?: string;
  linea?: string;
}

export interface ImpresionEtiquetaResponse {
  exito: boolean;
  mensaje: string;
  zplCode?: string;
  impresora?: string;
  tarima?: string;
  lote?: string;
  producto?: string;
}

export interface HardwarePrinterStatus {
  conectada: boolean;
  enPausa: boolean;
  sinPapel?: boolean;
  tapaAbierta?: boolean;
  isError?: boolean;
  esCompatible?: boolean;
  nombre: string;
  trabajosEnCola: number;
  mensaje: string;
}

export type ChromeTheme = 
  | 'royal-navy' 
  | 'kcm-deep-blue' 
  | 'kcm-cyan-pro' 
  | 'kcm-sapphire-plat' 
  | 'kcm-emerald' 
  | 'kcm-amber-sunset';

export interface ReporteConciliacionItemDto {
  idtblPallets: number;
  noTarima: string;
  folioVale: number;
  totalCajas: number;
  horaProduccion: string;
  fechaHoraCaptura: string;
  lineaEmpaque: number;
  claveProducto: string;
  descripcionProducto: string;
  noEmpCapturo: number;
  nombreOperador: string;
  esEntregado: boolean;
  idtblPalletEntregadoPT?: number | null;
  fechaHoraEntregaAlmacen?: string | null;
  leidoRFID: boolean;
  folioRecepcionAlmacen?: number | null;
  turnoRecepcionAlmacen?: number | null;
  nombreSupAlmacen?: string;
}

export interface ReporteConciliacionResponseDto {
  noMaquina: number;
  turno: number;
  fecha: string;
  lineaEmpaque?: number | null;
  idRT_Encabezado: number;
  tripulacion: string;
  nombreSupervisor: string;
  totalPalletsProducidos: number;
  totalCajasProducidas: number;
  totalPalletsEntregados: number;
  totalCajasEntregadas: number;
  totalPalletsPendientes: number;
  totalCajasPendientes: number;
  porcentajeCumplimiento: number;
  items: ReporteConciliacionItemDto[];
}

export interface AsistenciaDto {
  noEmp: number;
  nombre: string;
  fecha: string;
  noMaquina: number;
}

export interface AsistenciaResponseDto {
  exitoso: boolean;
  noMaquina: number;
  nombreMaquina: string;
  totalRegistros: number;
  fechaConsulta: string;
  registros: AsistenciaDto[];
  mensaje?: string;
}

export interface AsistenciaGerencialItemDto {
  id: number;
  noEmp: number;
  nombre: string;
  fecha: string;
  noMaquina: number;
}

export interface AsistenciaGerencialResponseDto {
  exitoso: boolean;
  totalRegistros: number;
  totalColaboradoresUnicos: number;
  fechaInicio: string;
  fechaFin: string;
  items: AsistenciaGerencialItemDto[];
  mensaje?: string;
}

export interface PerfilAppDto {
  modo: 'Produccion' | 'Gerencia' | string;
  esGerencia: boolean;
  servidor: string;
}