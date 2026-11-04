using PalletsWW_PC.Api.Models.Dtos;

namespace PalletsWW_PC.Api.Data.Repositories;

public interface IAsistenciaRepository
{
    Task<IEnumerable<AsistenciaDto>> ObtenerRegistrosAsistenciaAsync(int noMaquina);
    Task<AsistenciaGerencialResponseDto> ConsultarAsistenciaGerencialAsync(DateTime fechaInicio, DateTime fechaFin, int noEmp = 0);
}
