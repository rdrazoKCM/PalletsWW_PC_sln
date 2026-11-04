using Microsoft.AspNetCore.Mvc;
using PalletsWW_PC.Api.Data.Repositories;
using PalletsWW_PC.Api.Models.Dtos;

namespace PalletsWW_PC.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class AsistenciaController : ControllerBase
{
    private readonly IAsistenciaRepository _asistenciaRepo;
    private readonly ICatalogoRepository _catalogoRepo;
    private readonly ILogger<AsistenciaController> _logger;

    public AsistenciaController(
        IAsistenciaRepository asistenciaRepo,
        ICatalogoRepository catalogoRepo,
        ILogger<AsistenciaController> logger)
    {
        _asistenciaRepo = asistenciaRepo;
        _catalogoRepo = catalogoRepo;
        _logger = logger;
    }

    /// <summary>
    /// [pa_P007_002_LlenardgvComidasV02] Consulta los últimos 100 registros de asistencia de personal en la máquina indicada.
    /// Si no se especifica el parámetro noMaquina, se toma automáticamente del archivo local C:\ArchivosBitacoraAut\Maquina.txt.
    /// </summary>
    /// <param name="noMaquina">Número opcional de máquina. Si se omite, se lee del archivo local Maquina.txt.</param>
    [HttpGet("registros")]
    [EndpointSummary("[pa_P007_002_LlenardgvComidasV02] Consulta últimos 100 registros de asistencia por máquina")]
    [ProducesResponseType(typeof(AsistenciaResponseDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> ObtenerRegistros([FromQuery] int? noMaquina)
    {
        int maq = noMaquina.GetValueOrDefault(0);
        if (maq <= 0)
        {
            maq = await _catalogoRepo.LeerMaquinaConfiguradaAsync();
        }

        try
        {
            var registros = (await _asistenciaRepo.ObtenerRegistrosAsistenciaAsync(maq)).ToList();
            
            // Resolver nombre oficial de la máquina
            string nombreMaq = $"Máquina {maq}";
            try
            {
                var maquinas = await _catalogoRepo.ObtenerMaquinasAsync();
                var encontrada = maquinas.FirstOrDefault(m => m.NoMaquina == maq);
                if (encontrada != null && !string.IsNullOrWhiteSpace(encontrada.NombreMaquina))
                {
                    nombreMaq = encontrada.NombreMaquina.Trim();
                }
            }
            catch { }

            return Ok(new AsistenciaResponseDto
            {
                Exitoso = true,
                NoMaquina = maq,
                NombreMaquina = nombreMaq,
                TotalRegistros = registros.Count,
                FechaConsulta = DateTime.Now,
                Registros = registros,
                Mensaje = "Registros obtenidos correctamente"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al consultar registros de asistencia para Máquina {NoMaquina}", maq);
            return StatusCode(StatusCodes.Status500InternalServerError, new AsistenciaResponseDto
            {
                Exitoso = false,
                NoMaquina = maq,
                NombreMaquina = $"Máquina {maq}",
                TotalRegistros = 0,
                FechaConsulta = DateTime.Now,
                Registros = new List<AsistenciaDto>(),
                Mensaje = $"Error al consultar asistencia: {ex.Message}"
            });
        }
    }

    /// <summary>
    /// [pa_P007_002_ConsultaAsistenciaGerencial] Consulta gerencial de asistencia por rango de fechas y filtro opcional de empleado (sin filtro de máquina).
    /// </summary>
    [HttpGet("gerencial")]
    [EndpointSummary("[pa_P007_002_ConsultaAsistenciaGerencial] Consulta gerencial de asistencia por rango de fechas")]
    [ProducesResponseType(typeof(AsistenciaGerencialResponseDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> ConsultarAsistenciaGerencial(
        [FromQuery] DateTime? fechaInicio,
        [FromQuery] DateTime? fechaFin,
        [FromQuery] int? noEmp)
    {
        var fInicio = fechaInicio ?? DateTime.Today.AddDays(-7);
        var fFin = fechaFin ?? DateTime.Today;
        int emp = noEmp.GetValueOrDefault(0);

        try
        {
            var res = await _asistenciaRepo.ConsultarAsistenciaGerencialAsync(fInicio, fFin, emp);
            return Ok(res);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al consultar asistencia gerencial");
            return StatusCode(StatusCodes.Status500InternalServerError, new AsistenciaGerencialResponseDto
            {
                Exitoso = false,
                TotalRegistros = 0,
                TotalColaboradoresUnicos = 0,
                FechaInicio = fInicio,
                FechaFin = fFin,
                Items = new List<AsistenciaGerencialItemDto>(),
                Mensaje = $"Error al procesar consulta gerencial: {ex.Message}"
            });
        }
    }
}
