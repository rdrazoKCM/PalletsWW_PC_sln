using System.Net.Http.Json;
using PalletsWW_PC.Web.Models.Dtos;

namespace PalletsWW_PC.Web.Services;

public class ValesApiService
{
    private readonly HttpClient _httpClient;

    public ValesApiService(HttpClient httpClient)
    {
        _httpClient = httpClient;
    }

    public async Task<int> ObtenerIdEncabezadoAsync(int noMaquina, int turno, DateTime fecha)
    {
        var enc = await ObtenerEncabezadoCompletoAsync(noMaquina, turno, fecha);
        return enc?.IdRT_Encabezado ?? 0;
    }

    public async Task<EncabezadoTurnoDto?> ObtenerEncabezadoCompletoAsync(int noMaquina, int turno, DateTime fecha)
    {
        try
        {
            var url = $"api/vales/encabezado-completo?noMaquina={noMaquina}&turno={turno}&fecha={fecha:yyyy-MM-dd}";
            return await _httpClient.GetFromJsonAsync<EncabezadoTurnoDto>(url);
        }
        catch
        {
            return null;
        }
    }

    public async Task<List<ValeDto>> ObtenerActivosAsync(int noMaquina, int turno, DateTime fecha, int? idEncabezado = null)
    {
        try
        {
            var url = idEncabezado.HasValue && idEncabezado.Value > 0
                ? $"api/vales/activos?idEncabezado={idEncabezado.Value}"
                : $"api/vales/activos?noMaquina={noMaquina}&turno={turno}&fecha={fecha:yyyy-MM-dd}";

            return await _httpClient.GetFromJsonAsync<List<ValeDto>>(url) ?? new();
        }
        catch
        {
            return new();
        }
    }

    public async Task<List<ValeDto>> ObtenerTurnoAnteriorAsync(int noMaquina, int turno, DateTime fecha)
    {
        try
        {
            var url = $"api/vales/turno-anterior?noMaquina={noMaquina}&turno={turno}&fecha={fecha:yyyy-MM-dd}";
            return await _httpClient.GetFromJsonAsync<List<ValeDto>>(url) ?? new();
        }
        catch
        {
            return new();
        }
    }

    public async Task<ValeDetalleDto?> ObtenerDetalleAsync(int folioVale, int idEncabezado)
    {
        try
        {
            var url = $"api/vales/detalle?folioVale={folioVale}&idEncabezado={idEncabezado}";
            return await _httpClient.GetFromJsonAsync<ValeDetalleDto>(url);
        }
        catch
        {
            return null;
        }
    }

    public async Task<ValeDetalleDto?> ObtenerDetallePorIdAutoAsync(int idAutotblProduccion)
    {
        try
        {
            var url = $"api/vales/{idAutotblProduccion}/detalle-id";
            return await _httpClient.GetFromJsonAsync<ValeDetalleDto>(url);
        }
        catch
        {
            return null;
        }
    }

    public async Task<ValeCreateResultDto> CrearValeAsync(ValeCreateDto dto)
    {
        try
        {
            var response = await _httpClient.PostAsJsonAsync("api/vales/crear", dto);
            if (response.IsSuccessStatusCode)
            {
                return await response.Content.ReadFromJsonAsync<ValeCreateResultDto>() 
                    ?? new ValeCreateResultDto { Exitoso = true, Mensaje = "Vale creado exitosamente" };
            }

            var err = await response.Content.ReadFromJsonAsync<ValeCreateResultDto>();
            return err ?? new ValeCreateResultDto { Exitoso = false, Mensaje = "Error al crear el vale" };
        }
        catch (Exception ex)
        {
            return new ValeCreateResultDto { Exitoso = false, Mensaje = ex.Message };
        }
    }

    public async Task<ValeCreateResultDto> ModificarValeAsync(ValeModificarDto dto)
    {
        try
        {
            var response = await _httpClient.PutAsJsonAsync("api/vales/modificar", dto);
            if (response.IsSuccessStatusCode)
            {
                return await response.Content.ReadFromJsonAsync<ValeCreateResultDto>()
                    ?? new ValeCreateResultDto { Exitoso = true, Mensaje = "Vale modificado exitosamente" };
            }

            var err = await response.Content.ReadFromJsonAsync<ValeCreateResultDto>();
            return err ?? new ValeCreateResultDto { Exitoso = false, Mensaje = "Error al modificar el vale" };
        }
        catch (Exception ex)
        {
            return new ValeCreateResultDto { Exitoso = false, Mensaje = ex.Message };
        }
    }
}