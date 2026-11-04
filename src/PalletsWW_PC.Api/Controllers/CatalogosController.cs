using Microsoft.AspNetCore.Mvc;
using PalletsWW_PC.Api.Data.Repositories;
using PalletsWW_PC.Api.Models.Dtos;

namespace PalletsWW_PC.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class CatalogosController : ControllerBase
{
    private readonly ICatalogoRepository _catRepo;
    private readonly ILogger<CatalogosController> _logger;

    public CatalogosController(ICatalogoRepository catRepo, ILogger<CatalogosController> logger)
    {
        _catRepo = catRepo;
        _logger = logger;
    }

    /// <summary>
    /// [pa_P009_000_008_LlenarcbxNoMaquinaConParams] Consulta la lista de máquinas autorizadas para el departamento Wet Wipes.
    /// </summary>
    [HttpGet("maquinas")]
    [EndpointSummary("[pa_P009_000_008_LlenarcbxNoMaquinaConParams] Consulta catálogo de máquinas")]
    [ProducesResponseType(typeof(IEnumerable<MaquinaDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ObtenerMaquinas()
    {
        var result = await _catRepo.ObtenerMaquinasAsync();
        return Ok(result);
    }

    /// <summary>
    /// [pa_P009_01013_sLlenar_cbxLineaEmpaque] Obtiene las líneas de empaque configuradas para una máquina.
    /// </summary>
    [HttpGet("lineas-empaque/{noMaquina}")]
    [EndpointSummary("[pa_P009_01013_sLlenar_cbxLineaEmpaque] Consulta líneas de empaque de máquina")]
    [ProducesResponseType(typeof(IEnumerable<LineaEmpaqueDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ObtenerLineasEmpaque(int noMaquina)
    {
        var result = await _catRepo.ObtenerLineasEmpaqueAsync(noMaquina);
        return Ok(result);
    }

    /// <summary>
    /// [pa_P009_000_001_LlenarcbxNoEmpSinParams] Consulta el padrón de operadores para selección y captura.
    /// </summary>
    [HttpGet("operadores")]
    [EndpointSummary("[pa_P009_000_001_LlenarcbxNoEmpSinParams] Consulta catálogo de operadores")]
    [ProducesResponseType(typeof(IEnumerable<EmpleadoDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ObtenerOperadores()
    {
        var result = await _catRepo.ObtenerOperadoresAsync();
        return Ok(result);
    }

    
    /// <summary>
    /// [pa_P009_000_001_ObtenerEmpleadoPorNoEmpV8] Consulta rápida de un solo operador por su No. de Empleado (tiempo de respuesta &lt; 5ms).
    /// </summary>
    [HttpGet("operadores/validar/{noEmp}")]
    [EndpointSummary("[pa_P009_000_001_ObtenerEmpleadoPorNoEmpV8] Valida operador por NoEmp")]
    [ProducesResponseType(typeof(EmpleadoDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ValidarOperador(int noEmp)
    {
        var emp = await _catRepo.ObtenerEmpleadoPorNoEmpAsync(noEmp);
        if (emp == null) return NotFound(new { exitoso = false, mensaje = $"Operador #{noEmp} no encontrado" });
        return Ok(emp);
    }

    /// <summary>
    /// [pa_P009_000_051_LlenarcbxSupervisoresxDepto] Consulta supervisores activos asignados al departamento 3 (Wet Wipes).
    /// </summary>
    [HttpGet("supervisores")]
    [EndpointSummary("[pa_P009_000_051_LlenarcbxSupervisoresxDepto] Consulta supervisores de Wet Wipes")]
    [ProducesResponseType(typeof(IEnumerable<EmpleadoDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ObtenerSupervisores()
    {
        var result = await _catRepo.ObtenerSupervisoresAsync();
        return Ok(result);
    }

    /// <summary>
    /// [pa_P009_000_001_ProductosXMaquina] Consulta los productos y claves autorizados para fabricarse en una máquina específica.
    /// </summary>
    [HttpGet("productos/{noMaquina}")]
    [EndpointSummary("[pa_P009_000_001_ProductosXMaquina] Consulta productos asignados a la máquina")]
    [ProducesResponseType(typeof(IEnumerable<ProductoDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ObtenerProductosPorMaquina(int noMaquina)
    {
        var result = await _catRepo.ObtenerProductosPorMaquinaAsync(noMaquina);
        return Ok(result);
    }

    /// <summary>
    /// [Configuración Terminal] Lee la máquina configurada localmente en C:\ArchivosBitacoraAut\Maquina.txt.
    /// </summary>
    [HttpGet("maquina-local")]
    [EndpointSummary("[Configuración Terminal] Lee máquina local de terminal")]
    [ProducesResponseType(typeof(int), StatusCodes.Status200OK)]
    public async Task<IActionResult> ObtenerMaquinaLocal()
    {
        var m = await _catRepo.LeerMaquinaConfiguradaAsync();
        return Ok(m);
    }

    /// <summary>
    /// [Configuración Terminal] Guarda la nueva máquina en C:\ArchivosBitacoraAut\Maquina.txt para uso de administradores.
    /// </summary>
    [HttpPost("maquina-local/{noMaquina}")]
    [EndpointSummary("[Configuración Terminal] Guarda máquina en C:\\ArchivosBitacoraAut\\Maquina.txt")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> GuardarMaquinaLocal(int noMaquina)
    {
        var ok = await _catRepo.GuardarConfiguracionMaquinaAsync(noMaquina);
        if (!ok) return BadRequest(new { exitoso = false, mensaje = "No se pudo actualizar Maquina.txt" });
        return Ok(new { exitoso = true, mensaje = $"Terminal asignada a la máquina {noMaquina}" });
    }

    /// <summary>
    /// [Perfil de Aplicación] Devuelve si este servidor IIS opera en Modo Producción o Modo Gerencia.
    /// </summary>
    [HttpGet("perfil")]
    [EndpointSummary("[Perfil] Consulta modo de operación de la aplicación")]
    [ProducesResponseType(typeof(PerfilAppDto), StatusCodes.Status200OK)]
    public IActionResult ObtenerPerfil([FromServices] IConfiguration config)
    {
        string modo = config["AppProfile:Modo"] ?? "Produccion";
        bool esGerencia = string.Equals(modo, "Gerencia", StringComparison.OrdinalIgnoreCase);

        return Ok(new PerfilAppDto
        {
            Modo = modo,
            EsGerencia = esGerencia,
            Servidor = Environment.MachineName
        });
    }
}
