using System.Collections.Concurrent;
using PalletsWW_PC.Web.Models.Dtos;

namespace PalletsWW_PC.Web.Services;

public class CatalogCacheService
{
    private readonly CatalogosApiService _catalogosApi;
    private List<MaquinaDto>? _maquinasCache;
    private readonly ConcurrentDictionary<int, List<LineaEmpaqueDto>> _lineasCache = new();
    private readonly ConcurrentDictionary<int, List<ProductoDto>> _productosCache = new();
    private readonly ConcurrentDictionary<int, EmpleadoDto> _operadoresCache = new();
    private int? _maquinaLocalCache;

    public CatalogCacheService(CatalogosApiService catalogosApi)
    {
        _catalogosApi = catalogosApi;
    }

    public async Task<int> ObtenerMaquinaLocalAsync(bool forzarRefresco = false)
    {
        if (_maquinaLocalCache.HasValue && !forzarRefresco)
        {
            return _maquinaLocalCache.Value;
        }

        int m = await _catalogosApi.ObtenerMaquinaLocalAsync();
        _maquinaLocalCache = m;
        return m;
    }

    public async Task<bool> GuardarMaquinaLocalAsync(int noMaquina)
    {
        bool ok = await _catalogosApi.GuardarMaquinaLocalAsync(noMaquina);
        if (ok)
        {
            _maquinaLocalCache = noMaquina;
        }
        return ok;
    }

    public async Task<List<MaquinaDto>> ObtenerMaquinasAsync(bool forzarRefresco = false)
    {
        if (_maquinasCache != null && !forzarRefresco)
        {
            return _maquinasCache;
        }

        _maquinasCache = await _catalogosApi.ObtenerMaquinasAsync();
        return _maquinasCache;
    }

    public async Task<List<LineaEmpaqueDto>> ObtenerLineasEmpaqueAsync(int noMaquina, bool forzarRefresco = false)
    {
        if (!forzarRefresco && _lineasCache.TryGetValue(noMaquina, out var cached))
        {
            return cached;
        }

        var lineas = await _catalogosApi.ObtenerLineasEmpaqueAsync(noMaquina);
        _lineasCache[noMaquina] = lineas;
        return lineas;
    }

    public async Task<List<ProductoDto>> ObtenerProductosPorMaquinaAsync(int noMaquina, bool forzarRefresco = false)
    {
        if (!forzarRefresco && _productosCache.TryGetValue(noMaquina, out var cached))
        {
            return cached;
        }

        var productos = await _catalogosApi.ObtenerProductosPorMaquinaAsync(noMaquina);
        _productosCache[noMaquina] = productos;
        return productos;
    }

    public async Task<EmpleadoDto?> ValidarOperadorAsync(int noEmp)
    {
        if (noEmp <= 0) return null;

        if (_operadoresCache.TryGetValue(noEmp, out var cached))
        {
            return cached;
        }

        var emp = await _catalogosApi.ValidarOperadorRapidoAsync(noEmp);
        if (emp != null)
        {
            _operadoresCache[noEmp] = emp;
        }
        return emp;
    }

    public void LimpiarCache()
    {
        _maquinasCache = null;
        _lineasCache.Clear();
        _productosCache.Clear();
        _operadoresCache.Clear();
        _maquinaLocalCache = null;
    }
}