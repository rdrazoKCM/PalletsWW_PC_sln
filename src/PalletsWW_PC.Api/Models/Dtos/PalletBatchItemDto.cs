namespace PalletsWW_PC.Api.Models.Dtos;

public class PalletBatchItemDto
{
    public int FilaIndex { get; set; }
    public int TotalCajas { get; set; }
    public string Hora { get; set; } = string.Empty;
    public string Linea { get; set; } = string.Empty;
}