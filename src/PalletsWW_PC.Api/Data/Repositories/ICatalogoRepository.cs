using PalletsWW_PC.Api.Models.Dtos;

namespace PalletsWW_PC.Api.Data.Repositories;

public interface ICatalogoRepository
{
    Task<IEnumerable<MaquinaDto>> ObtenerMaquinasAsync();
    Task<IEnumerable<EmpleadoDto>> ObtenerOperadoresAsync();
    Task<EmpleadoDto?> ObtenerEmpleadoPorNoEmpAsync(int noEmp);
    Task<IEnumerable<EmpleadoDto>> ObtenerSupervisoresAsync();
    Task<IEnumerable<LineaEmpaqueDto>> ObtenerLineasEmpaqueAsync(int noMaquina = 0);
    Task<IEnumerable<ProductoDto>> ObtenerProductosPorMaquinaAsync(int noMaquina);
    Task<bool> GuardarConfiguracionMaquinaAsync(int noMaquina);
    Task<int> LeerMaquinaConfiguradaAsync();
}