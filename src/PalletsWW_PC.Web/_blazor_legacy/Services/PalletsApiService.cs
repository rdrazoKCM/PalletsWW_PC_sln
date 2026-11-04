using System.Net.Http.Json;
using PalletsWW_PC.Web.Models.Dtos;

namespace PalletsWW_PC.Web.Services;

public class PalletsApiService
{
    private readonly HttpClient _http;

    public PalletsApiService(HttpClient http)
    {
        _http = http;
    }

    public async Task<List<PalletDto>> ObtenerPalletsPorValeAsync(int folioVale, int idEncabezado)
    {
        try
        {
            var result = await _http.GetFromJsonAsync<List<PalletDto>>($"api/Pallets/vale/{folioVale}?idEncabezado={idEncabezado}");
            return result ?? new List<PalletDto>();
        }
        catch
        {
            return new List<PalletDto>();
        }
    }

    public async Task<PalletResultDto> InsertarPalletAsync(PalletInsertDto dto)
    {
        try
        {
            var response = await _http.PostAsJsonAsync("api/Pallets", dto);
            if (response.IsSuccessStatusCode)
            {
                return await response.Content.ReadFromJsonAsync<PalletResultDto>() 
                    ?? new PalletResultDto { Exitoso = true, Mensaje = "Pallet registrado con éxito" };
            }
            var err = await response.Content.ReadFromJsonAsync<PalletResultDto>();
            return err ?? new PalletResultDto { Exitoso = false, Mensaje = "Error al registrar pallet" };
        }
        catch (Exception ex)
        {
            return new PalletResultDto { Exitoso = false, Mensaje = ex.Message };
        }
    }

    
    public async Task<BatchPalletResultDto> InsertarLotePalletsAsync(PalletBatchInsertDto dto)
    {
        try
        {
            var response = await _http.PostAsJsonAsync("api/Pallets/batch", dto);
            if (response.IsSuccessStatusCode)
            {
                return await response.Content.ReadFromJsonAsync<BatchPalletResultDto>() 
                    ?? new BatchPalletResultDto { Exitoso = true, Mensaje = "Lote registrado con éxito" };
            }
            var err = await response.Content.ReadFromJsonAsync<BatchPalletResultDto>();
            return err ?? new BatchPalletResultDto { Exitoso = false, Mensaje = "Error al registrar lote de pallets" };
        }
        catch (Exception ex)
        {
            return new BatchPalletResultDto { Exitoso = false, Mensaje = ex.Message };
        }
    }

    public async Task<PalletResultDto> ActualizarPalletAsync(PalletUpdateDto dto)
    {
        try
        {
            var response = await _http.PutAsJsonAsync($"api/Pallets/{dto.IdtblPallets}", dto);
            if (response.IsSuccessStatusCode)
            {
                return await response.Content.ReadFromJsonAsync<PalletResultDto>() 
                    ?? new PalletResultDto { Exitoso = true, Mensaje = "Pallet actualizado con éxito" };
            }
            var err = await response.Content.ReadFromJsonAsync<PalletResultDto>();
            return err ?? new PalletResultDto { Exitoso = false, Mensaje = "Error al actualizar pallet" };
        }
        catch (Exception ex)
        {
            return new PalletResultDto { Exitoso = false, Mensaje = ex.Message };
        }
    }

    public async Task<bool> EliminarPalletAsync(int idPallet)
    {
        try
        {
            var response = await _http.DeleteAsync($"api/Pallets/{idPallet}");
            return response.IsSuccessStatusCode;
        }
        catch
        {
            return false;
        }
    }
    public async Task<ReporteConciliacionResponseDto?> ObtenerReporteConciliacionAsync(int noMaquina, int turno, DateTime fecha)
    {
        try
        {
            string fStr = fecha.ToString("yyyy-MM-dd");
            var result = await _http.GetFromJsonAsync<ReporteConciliacionResponseDto>($"api/Pallets/reporte/conciliacion?noMaquina={noMaquina}&turno={turno}&fecha={fStr}");
            return result;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[PalletsApiService] Error al consultar reporte de conciliación: {ex.Message}");
            return null;
        }
    }
}
