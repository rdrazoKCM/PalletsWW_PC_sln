using PalletsWW_PC.Api.Models.Dtos;

namespace PalletsWW_PC.Api.Data.Repositories;

public interface IValeRepository
{
    Task<int> ObtenerIdEncabezadoTurnoAsync(int noMaquina, int turno, DateTime fecha);
    Task<EncabezadoTurnoDto> ObtenerEncabezadoTurnoCompletoAsync(int noMaquina, int turno, DateTime fecha);
    Task<IEnumerable<ValeDto>> ObtenerValesTurnoActualAsync(int idEncabezado);
    Task<IEnumerable<ValeDto>> ObtenerValesTurnoAnteriorAsync(int noMaquina, int turno, DateTime fecha);
    Task<ValeDetalleDto?> ObtenerDetalleValeAsync(int folioVale, int idEncabezado);
    Task<ValeDetalleDto?> ObtenerDetalleValePorIdAutoAsync(int idAutotblProduccion);
    Task<ValeCreateResultDto> CrearValeAsync(ValeCreateDto dto);
    Task<ValeCreateResultDto> ModificarValeAsync(ValeModificarDto dto);
}