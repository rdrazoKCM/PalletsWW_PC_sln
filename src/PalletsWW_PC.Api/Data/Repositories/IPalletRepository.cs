using PalletsWW_PC.Api.Models.Dtos;

namespace PalletsWW_PC.Api.Data.Repositories;

public interface IPalletRepository
{
    Task<IEnumerable<PalletDto>> ObtenerPalletsPorValeAsync(int folioVale, int idEncabezado);
    Task<PalletResultDto> InsertarPalletAsync(PalletInsertDto dto);
    Task<BatchPalletResultDto> InsertarLotePalletsAsync(PalletBatchInsertDto loteDto);
    Task<PalletResultDto> ActualizarPalletAsync(PalletUpdateDto dto);
    Task<bool> EliminarPalletAsync(int idPallet);
    Task<ReporteConciliacionResponseDto> ObtenerReporteConciliacionAsync(int noMaquina, int turno, DateTime fecha);
}