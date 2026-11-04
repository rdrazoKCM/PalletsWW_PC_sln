using Microsoft.AspNetCore.Mvc;
using PalletsWW_PC.Api.Data.Repositories;
using PalletsWW_PC.Api.Models.Dtos;
using PalletsWW_PC.Api.Services;

namespace PalletsWW_PC.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class ImpresionController : ControllerBase
{
    private readonly IImpresionRepository _impresionRepo;
    private readonly IUsbPrintService _usbPrintService;
    private readonly ILogger<ImpresionController> _logger;

    public ImpresionController(
        IImpresionRepository impresionRepo, 
        IUsbPrintService usbPrintService,
        ILogger<ImpresionController> logger)
    {
        _impresionRepo = impresionRepo;
        _usbPrintService = usbPrintService;
        _logger = logger;
    }

    /// <summary>
    /// Verifica si la impresora USB está conectada y disponible en Windows.
    /// </summary>
    [HttpGet("estado")]
    [EndpointSummary("Verifica el estado de conexión de la impresora USB")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public IActionResult ObtenerEstadoImpresora()
    {
        var (conectada, nombre, mensaje) = _usbPrintService.VerificarEstadoImpresora();
        return Ok(new { conectada, nombreImpresora = nombre, mensaje });
    }

    /// <summary>
    /// [pa_P009_01010_btnImprimirEtiqueta_click] Obtiene los datos del pallet y genera la cadena en lenguaje ZPL para la etiqueta.
    /// </summary>
    [HttpGet("etiqueta/{idPallet}")]
    [EndpointSummary("[pa_P009_01010_btnImprimirEtiqueta_click] Obtiene datos y genera código ZPL")]
    [ProducesResponseType(typeof(EtiquetaZplDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ObtenerEtiqueta(int idPallet)
    {
        var etiqueta = await _impresionRepo.ObtenerDatosEtiquetaAsync(idPallet);
        if (etiqueta == null) return NotFound(new { mensaje = $"Pallet {idPallet} no encontrado o sin datos de etiqueta." });
        return Ok(etiqueta);
    }

    /// <summary>
    /// [pa_P009_01010_btnImprimirEtiqueta_click] Genera el código ZPL y lo envía directamente al Spooler de la impresora USB local.
    /// </summary>
    [HttpPost("enviar/{idPallet}")]
    [EndpointSummary("[pa_P009_01010_btnImprimirEtiqueta_click] Imprime etiqueta de pallet en impresora USB")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> EnviarEtiquetaUsb(int idPallet)
    {
        var etiqueta = await _impresionRepo.ObtenerDatosEtiquetaAsync(idPallet);
        if (etiqueta == null || string.IsNullOrWhiteSpace(etiqueta.CodigoZpl))
        {
            return BadRequest(new { exitoso = false, mensaje = "No se pudo generar el código ZPL para este pallet." });
        }

        var (exitoso, mensaje) = await _usbPrintService.EnviarZplAImpresoraUsbAsync(etiqueta.CodigoZpl);
        if (!exitoso)
        {
            return BadRequest(new { exitoso = false, mensaje, codigoZpl = etiqueta.CodigoZpl });
        }

        return Ok(new { exitoso = true, mensaje, codigoZpl = etiqueta.CodigoZpl });
    }

    /// <summary>
    /// [RAW_USB] Envía un bloque de texto ZPL directamente al puerto de la impresora USB.
    /// </summary>
    [HttpPost("enviar-raw")]
    [EndpointSummary("[RAW_USB] Envía comando ZPL en texto crudo a la impresora USB")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> EnviarZplRaw([FromBody] string codigoZpl)
    {
        if (string.IsNullOrWhiteSpace(codigoZpl))
        {
            return BadRequest(new { exitoso = false, mensaje = "El código ZPL no puede estar vacío." });
        }

        var (exitoso, mensaje) = await _usbPrintService.EnviarZplAImpresoraUsbAsync(codigoZpl);
        if (!exitoso)
        {
            return BadRequest(new { exitoso = false, mensaje });
        }

        return Ok(new { exitoso = true, mensaje });
    }
}
