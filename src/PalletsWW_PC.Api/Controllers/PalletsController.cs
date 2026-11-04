using Microsoft.AspNetCore.Mvc;
using PalletsWW_PC.Api.Data.Repositories;
using PalletsWW_PC.Api.Models.Dtos;

namespace PalletsWW_PC.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class PalletsController : ControllerBase
{
    private readonly IPalletRepository _palletRepo;
    private readonly ILogger<PalletsController> _logger;

    public PalletsController(IPalletRepository palletRepo, ILogger<PalletsController> logger)
    {
        _palletRepo = palletRepo;
        _logger = logger;
    }

    /// <summary>
    /// [pa_P009_01001_tblPallets] Consulta la cuadrícula de tarimas capturadas para un vale y máquina.
    /// </summary>
    [HttpGet("vale/{folio}")]
    [EndpointSummary("[pa_P009_01001_tblPallets] Consulta lista de pallets del vale")]
    [ProducesResponseType(typeof(IEnumerable<PalletDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ObtenerPorVale(int folio, [FromQuery] int idEncabezado)
    {
        var result = await _palletRepo.ObtenerPalletsPorValeAsync(folio, idEncabezado);
        return Ok(result);
    }

    /// <summary>
    /// [pa_P009_01006_tblPalletsInsertcmdV9] Inserta un nuevo pallet físico, validando duplicidad horaria con [pa_P009_01007_ValidaHoraDuplicadaPallet].
    /// </summary>
    [HttpPost]
    [EndpointSummary("[pa_P009_01006_tblPalletsInsertcmdV9] Inserta nuevo pallet (Valida: pa_P009_01007_ValidaHoraDuplicadaPallet)")]
    [ProducesResponseType(typeof(PalletResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(PalletResultDto), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Insertar([FromBody] PalletInsertDto dto)
    {
        if (dto.FolioVale <= 0 || dto.TotalCajas < 0 || string.IsNullOrWhiteSpace(dto.Hora))
        {
            return BadRequest(new PalletResultDto
            {
                Exitoso = false,
                Mensaje = "Los campos Vale, Total Cajas y Hora son obligatorios."
            });
        }

        var result = await _palletRepo.InsertarPalletAsync(dto);
        if (!result.Exitoso)
        {
            return BadRequest(result);
        }
        return Ok(result);
    }

    
    /// <summary>
    /// [pa_P009_01006_tblPalletsInsertcmdV9] Inserta un lote de 1 a 10 pallets atómicamente, validando capacidad física de 38 tarimas y anti-duplicidad.
    /// </summary>
    [HttpPost("batch")]
    [EndpointSummary("[pa_P009_01006_tblPalletsInsertcmdV9] Inserta lote de 1 a 10 pallets")]
    [ProducesResponseType(typeof(BatchPalletResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(BatchPalletResultDto), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> InsertarLote([FromBody] PalletBatchInsertDto dto)
    {
        if (dto.FolioVale <= 0 || dto.IdtblProductos <= 0 || dto.NoEmpCapturo <= 0)
        {
            return BadRequest(new BatchPalletResultDto
            {
                Exitoso = false,
                Mensaje = "Los campos Vale, Producto y Operador son obligatorios."
            });
        }

        if (dto.Pallets == null || dto.Pallets.Count == 0)
        {
            return BadRequest(new BatchPalletResultDto
            {
                Exitoso = false,
                Mensaje = "Debe enviar al menos 1 tarima en el lote."
            });
        }

        if (dto.Pallets.Count > 10)
        {
            return BadRequest(new BatchPalletResultDto
            {
                Exitoso = false,
                Mensaje = "El lote no puede exceder el límite máximo recomendado de 10 pallets."
            });
        }

        var result = await _palletRepo.InsertarLotePalletsAsync(dto);
        if (!result.Exitoso)
        {
            return BadRequest(result);
        }
        return Ok(result);
    }

    /// <summary>
    /// [pa_P009_01008_tblPalletsUpdatecmdV5] Modifica los datos de una tarima registrada (Cajas, Hora, Línea de empaque).
    /// </summary>
    [HttpPut("{id}")]
    [EndpointSummary("[pa_P009_01008_tblPalletsUpdatecmdV5] Modifica datos del pallet (Cajas, Hora, Línea)")]
    [ProducesResponseType(typeof(PalletResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(PalletResultDto), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Actualizar(int id, [FromBody] PalletUpdateDto dto)
    {
        dto.IdtblPallets = id;
        var result = await _palletRepo.ActualizarPalletAsync(dto);
        if (!result.Exitoso)
        {
            return BadRequest(result);
        }
        return Ok(result);
    }

    /// <summary>
    /// [pa_P009_01009_tblPalletsDeletecmd] Elimina físicamente un pallet por su identificador primario.
    /// </summary>
    [HttpDelete("{id}")]
    [EndpointSummary("[pa_P009_01009_tblPalletsDeletecmd] Elimina pallet por ID")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Eliminar(int id)
    {
        var result = await _palletRepo.EliminarPalletAsync(id);
        if (!result) return BadRequest(new { mensaje = "No se pudo eliminar el pallet." });
        return Ok(new { mensaje = "Pallet eliminado correctamente." });
    }
    /// <summary>
    /// [pa_P009_00102_ReporteConciliacionProduccionVsAlmacenPT] Reporte comparativo de pallets producidos en la máquina vs recepcionados en Almacén PT.
    /// </summary>
    [HttpGet("reporte/conciliacion")]
    [EndpointSummary("[pa_P009_00102_ReporteConciliacionProduccionVsAlmacenPT] Reporte de Conciliación Producción vs Almacén PT")]
    [ProducesResponseType(typeof(ReporteConciliacionResponseDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> ObtenerReporteConciliacion([FromQuery] int noMaquina, [FromQuery] int turno, [FromQuery] DateTime? fecha)
    {
        var f = fecha ?? DateTime.Today;
        var result = await _palletRepo.ObtenerReporteConciliacionAsync(noMaquina, turno, f);
        return Ok(result);
    }
}
