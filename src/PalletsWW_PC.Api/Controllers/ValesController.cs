using Microsoft.AspNetCore.Mvc;
using PalletsWW_PC.Api.Data.Repositories;
using PalletsWW_PC.Api.Models.Dtos;

namespace PalletsWW_PC.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class ValesController : ControllerBase
{
    private readonly IValeRepository _valeRepo;
    private readonly ILogger<ValesController> _logger;

    public ValesController(IValeRepository valeRepo, ILogger<ValesController> logger)
    {
        _valeRepo = valeRepo;
        _logger = logger;
    }

    /// <summary>
    /// [pa_P009_00102_ConsultaEncabezadoReporteTurnoWipes] Obtiene el ID del encabezado de turno para la máquina, turno y fecha.
    /// </summary>
    [HttpGet("encabezado")]
    [EndpointSummary("[pa_P009_00102_ConsultaEncabezadoReporteTurnoWipes] Obtiene ID del encabezado de turno")]
    [ProducesResponseType(typeof(int), StatusCodes.Status200OK)]
    public async Task<IActionResult> ObtenerEncabezado([FromQuery] int noMaquina, [FromQuery] int? turno, [FromQuery] DateTime? fecha)
    {
        var f = fecha ?? DateTime.Today;
        int t = turno.GetValueOrDefault(0);
        var id = await _valeRepo.ObtenerIdEncabezadoTurnoAsync(noMaquina, t, f);
        return Ok(id);
    }

    /// <summary>
    /// [pa_P009_00102_ConsultaEncabezadoReporteTurnoWipes] Obtiene el objeto completo del turno (ID, Tripulación, Supervisor).
    /// </summary>
    [HttpGet("encabezado-completo")]
    [EndpointSummary("[pa_P009_00102_ConsultaEncabezadoReporteTurnoWipes] Consulta encabezado completo del turno")]
    [ProducesResponseType(typeof(EncabezadoTurnoDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> ObtenerEncabezadoCompleto([FromQuery] int noMaquina, [FromQuery] int? turno, [FromQuery] DateTime? fecha)
    {
        var f = fecha ?? DateTime.Today;
        int t = turno.GetValueOrDefault(0);
        var enc = await _valeRepo.ObtenerEncabezadoTurnoCompletoAsync(noMaquina, t, f);
        return Ok(enc);
    }

    /// <summary>
    /// [Homologación Pallets Pañal] Endpoint alias para obtener el encabezado activo vigente de una máquina.
    /// </summary>
    [HttpGet("encabezado-activo")]
    [EndpointSummary("[Homologación] Consulta encabezado activo actual de la máquina")]
    [ProducesResponseType(typeof(EncabezadoTurnoDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> ObtenerEncabezadoActivo([FromQuery] int noMaquina)
    {
        var enc = await _valeRepo.ObtenerEncabezadoTurnoCompletoAsync(noMaquina, 0, DateTime.Today);
        return Ok(enc);
    }

    /// <summary>
    /// [pa_P009_01002_sLlenardgvProduccion] Obtiene la lista de todos los vales de producción registrados en el turno activo.
    /// </summary>
    [HttpGet("activos")]
    [EndpointSummary("[pa_P009_01002_sLlenardgvProduccion] Lista vales activos del turno")]
    [ProducesResponseType(typeof(IEnumerable<ValeDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ObtenerActivos([FromQuery] int? idEncabezado, [FromQuery] int? noMaquina, [FromQuery] int? turno, [FromQuery] DateTime? fecha)
    {
        int encId = idEncabezado ?? 0;
        if (encId == 0 && noMaquina.HasValue && noMaquina.Value > 0)
        {
            var f = fecha ?? DateTime.Today;
            int t = turno.GetValueOrDefault(0);
            encId = await _valeRepo.ObtenerIdEncabezadoTurnoAsync(noMaquina.Value, t, f);
        }

        if (encId == 0) return Ok(Enumerable.Empty<ValeDto>());

        var result = await _valeRepo.ObtenerValesTurnoActualAsync(encId);
        return Ok(result);
    }

    /// <summary>
    /// [pa_P009_01005_sLlenardgvProduccionTurnoAnt] Obtiene la lista de vales registrados en el turno anterior.
    /// </summary>
    [HttpGet("turno-anterior")]
    [EndpointSummary("[pa_P009_01005_sLlenardgvProduccionTurnoAnt] Lista vales del turno anterior")]
    [ProducesResponseType(typeof(IEnumerable<ValeDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ObtenerTurnoAnterior([FromQuery] int noMaquina, [FromQuery] int? turno, [FromQuery] DateTime? fecha)
    {
        if (noMaquina <= 0) return Ok(Enumerable.Empty<ValeDto>());
        var f = fecha ?? DateTime.Today;
        int t = turno.GetValueOrDefault(0);
        if (t <= 0)
        {
            var (tAct, fAct) = ValeRepository.ObtenerTurnoYFechaPlantaActual();
            t = tAct;
            f = fAct;
        }
        var result = await _valeRepo.ObtenerValesTurnoAnteriorAsync(noMaquina, t, f);
        return Ok(result);
    }

    /// <summary>
    /// [pa_P009_01004_sdgvtblProduccion_CellDoubleClick] Carga detalle completo (Producto, Clave, Cajas/Pallet, Lote) de un vale.
    /// </summary>
    [HttpGet("detalle")]
    [EndpointSummary("[pa_P009_01004_sdgvtblProduccion_CellDoubleClick] Obtiene detalle del vale por Folio")]
    [ProducesResponseType(typeof(ValeDetalleDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ObtenerDetalle([FromQuery] int folioVale, [FromQuery] int idEncabezado)
    {
        var result = await _valeRepo.ObtenerDetalleValeAsync(folioVale, idEncabezado);
        if (result == null) return NotFound(new { mensaje = "Vale no encontrado" });
        return Ok(result);
    }

    /// <summary>
    /// [pa_P009_01004_sdgvtblProduccion_CellDoubleClick] Carga detalle de un vale directamente por su IdAutotblProduccion.
    /// </summary>
    [HttpGet("{idAutotblProduccion}/detalle-id")]
    [EndpointSummary("[pa_P009_01004_sdgvtblProduccion_CellDoubleClick] Obtiene detalle del vale por IdAutotblProduccion")]
    [ProducesResponseType(typeof(ValeDetalleDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ObtenerDetallePorId(int idAutotblProduccion)
    {
        var result = await _valeRepo.ObtenerDetalleValePorIdAutoAsync(idAutotblProduccion);
        if (result == null) return NotFound(new { mensaje = "Vale no encontrado" });
        return Ok(result);
    }

    /// <summary>
    /// [pa_P009_01003_slnkCapturaVale_LinkClicked] Registra y activa un nuevo vale de producción en el turno activo.
    /// </summary>
    [HttpPost("crear")]
    [EndpointSummary("[pa_P009_01003_slnkCapturaVale_LinkClicked] Crea y activa nuevo vale de producción")]
    [ProducesResponseType(typeof(ValeCreateResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValeCreateResultDto), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CrearVale([FromBody] ValeCreateDto dto)
    {
        if (dto.FolioVale <= 0)
        {
            return BadRequest(new ValeCreateResultDto
            {
                Exitoso = false,
                Mensaje = "El campo Folio del Vale es obligatorio y debe ser mayor a cero."
            });
        }

        if (dto.IdtblProductos <= 0)
        {
            return BadRequest(new ValeCreateResultDto
            {
                Exitoso = false,
                Mensaje = "Debe seleccionar un producto válido de la máquina."
            });
        }

        if (dto.IdRT_Encabezado <= 0)
        {
            return BadRequest(new ValeCreateResultDto
            {
                Exitoso = false,
                Mensaje = "No hay un encabezado de turno activo válido."
            });
        }

        var result = await _valeRepo.CrearValeAsync(dto);
        if (!result.Exitoso)
        {
            return BadRequest(result);
        }

        return Ok(result);
    }

    /// <summary>
    /// [pa_P009_01007_slnkModificaVale_LinkClicked] Modifica el folio o producto asignado a un vale existente.
    /// </summary>
    [HttpPut("modificar")]
    [EndpointSummary("[pa_P009_01007_slnkModificaVale_LinkClicked] Modifica datos de un vale existente")]
    [ProducesResponseType(typeof(ValeCreateResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValeCreateResultDto), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ModificarVale([FromBody] ValeModificarDto dto)
    {
        if (dto.IdAutotblProduccion <= 0)
        {
            return BadRequest(new ValeCreateResultDto
            {
                Exitoso = false,
                Mensaje = "Debe especificar el ID del registro de producción a modificar."
            });
        }

        if (dto.FolioVale <= 0)
        {
            return BadRequest(new ValeCreateResultDto
            {
                Exitoso = false,
                Mensaje = "El folio del vale es obligatorio y debe ser mayor a cero."
            });
        }

        if (dto.IdtblProductos <= 0)
        {
            return BadRequest(new ValeCreateResultDto
            {
                Exitoso = false,
                Mensaje = "Debe seleccionar un producto válido."
            });
        }

        var result = await _valeRepo.ModificarValeAsync(dto);
        if (!result.Exitoso)
        {
            return BadRequest(result);
        }

        return Ok(result);
    }
}