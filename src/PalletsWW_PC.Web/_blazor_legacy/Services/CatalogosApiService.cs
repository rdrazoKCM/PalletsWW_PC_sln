using System.Net.Http.Json;
using PalletsWW_PC.Web.Models.Dtos;

namespace PalletsWW_PC.Web.Services;

public class CatalogosApiService
{
    private readonly HttpClient _http;

    public CatalogosApiService(HttpClient http)
    {
        _http = http;
    }

    public async Task<List<MaquinaDto>> ObtenerMaquinasAsync()
    {
        try
        {
            var result = await _http.GetFromJsonAsync<List<MaquinaDto>>("api/Catalogos/maquinas");
            return result ?? new List<MaquinaDto>();
        }
        catch
        {
            return new List<MaquinaDto>();
        }
    }

    public async Task<List<LineaEmpaqueDto>> ObtenerLineasEmpaqueAsync(int noMaquina)
    {
        try
        {
            var result = await _http.GetFromJsonAsync<List<LineaEmpaqueDto>>($"api/Catalogos/lineas-empaque/{noMaquina}");
            return result ?? new List<LineaEmpaqueDto>();
        }
        catch
        {
            return new List<LineaEmpaqueDto>();
        }
    }

    public async Task<List<EmpleadoDto>> ObtenerOperadoresAsync()
    {
        try
        {
            var result = await _http.GetFromJsonAsync<List<EmpleadoDto>>("api/Catalogos/operadores");
            return result ?? new List<EmpleadoDto>();
        }
        catch
        {
            return new List<EmpleadoDto>();
        }
    }

    
    public async Task<EmpleadoDto?> ValidarOperadorRapidoAsync(int noEmp)
    {
        try
        {
            var result = await _http.GetFromJsonAsync<EmpleadoDto>($"api/Catalogos/operadores/validar/{noEmp}");
            return result;
        }
        catch
        {
            return null;
        }
    }

    public async Task<List<EmpleadoDto>> ObtenerSupervisoresAsync()
    {
        try
        {
            var result = await _http.GetFromJsonAsync<List<EmpleadoDto>>("api/Catalogos/supervisores");
            return result ?? new List<EmpleadoDto>();
        }
        catch
        {
            return new List<EmpleadoDto>();
        }
    }

    public async Task<List<ProductoDto>> ObtenerProductosPorMaquinaAsync(int noMaquina)
    {
        try
        {
            var result = await _http.GetFromJsonAsync<List<ProductoDto>>($"api/Catalogos/productos/{noMaquina}");
            return result ?? new List<ProductoDto>();
        }
        catch
        {
            return new List<ProductoDto>();
        }
    }

    public async Task<int> ObtenerMaquinaLocalAsync()
    {
        try
        {
            return await _http.GetFromJsonAsync<int>("api/Catalogos/maquina-local");
        }
        catch
        {
            return 9;
        }
    }

    public async Task<bool> GuardarMaquinaLocalAsync(int noMaquina)
    {
        try
        {
            var resp = await _http.PostAsync($"api/Catalogos/maquina-local/{noMaquina}", null);
            return resp.IsSuccessStatusCode;
        }
        catch
        {
            return false;
        }
    }
}
