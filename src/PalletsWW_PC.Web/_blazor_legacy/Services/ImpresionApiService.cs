using System.Net.Http.Json;
using System.Text.Json.Serialization;
using PalletsWW_PC.Web.Models.Dtos;

namespace PalletsWW_PC.Web.Services;

public record EstadoImpresoraDto(
    [property: JsonPropertyName("conectada")] bool Conectada,
    [property: JsonPropertyName("nombreImpresora")] string? NombreImpresora,
    [property: JsonPropertyName("mensaje")] string? Mensaje
);

public record RespuestaImpresionDto(
    [property: JsonPropertyName("exitoso")] bool Exitoso,
    [property: JsonPropertyName("mensaje")] string? Mensaje,
    [property: JsonPropertyName("codigoZpl")] string? CodigoZpl
);

public class ImpresionApiService
{
    private readonly HttpClient _http;

    public ImpresionApiService(HttpClient http)
    {
        _http = http;
    }

    public async Task<EstadoImpresoraDto> ObtenerEstadoImpresoraAsync()
    {
        try
        {
            var res = await _http.GetFromJsonAsync<EstadoImpresoraDto>("api/Impresion/estado");
            return res ?? new EstadoImpresoraDto(false, null, "Sin respuesta de API");
        }
        catch (Exception ex)
        {
            return new EstadoImpresoraDto(false, null, ex.Message);
        }
    }

    public async Task<EtiquetaZplDto?> ObtenerEtiquetaAsync(int idPallet)
    {
        try
        {
            return await _http.GetFromJsonAsync<EtiquetaZplDto>($"api/Impresion/etiqueta/{idPallet}");
        }
        catch
        {
            return null;
        }
    }

    public async Task<(bool Exitoso, string Mensaje)> EnviarAImpresoraUsbAsync(int idPallet)
    {
        try
        {
            var response = await _http.PostAsync($"api/Impresion/enviar/{idPallet}", null);
            var resObj = await response.Content.ReadFromJsonAsync<RespuestaImpresionDto>();
            if (response.IsSuccessStatusCode)
            {
                return (true, resObj?.Mensaje ?? "Etiqueta enviada a la impresora.");
            }
            else
            {
                return (false, resObj?.Mensaje ?? "Error al enviar la etiqueta a la impresora.");
            }
        }
        catch (Exception ex)
        {
            return (false, ex.Message);
        }
    }

    public async Task<(bool Exitoso, string Mensaje)> EnviarZplRawAsync(string codigoZpl)
    {
        try
        {
            var response = await _http.PostAsJsonAsync("api/Impresion/enviar-raw", codigoZpl);
            var resObj = await response.Content.ReadFromJsonAsync<RespuestaImpresionDto>();
            if (response.IsSuccessStatusCode)
            {
                return (true, resObj?.Mensaje ?? "Comando ZPL enviado con éxito a la impresora.");
            }
            else
            {
                return (false, resObj?.Mensaje ?? "Error al enviar comando ZPL.");
            }
        }
        catch (Exception ex)
        {
            return (false, ex.Message);
        }
    }

    public async Task<bool> ImprimirEtiquetaAsync(int idPallet, int noMaquina = 0)
    {
        try
        {
            var res = await EnviarAImpresoraUsbAsync(idPallet);
            return res.Exitoso;
        }
        catch
        {
            return false;
        }
    }
}
