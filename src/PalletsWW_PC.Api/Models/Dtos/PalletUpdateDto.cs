namespace PalletsWW_PC.Api.Models.Dtos;

public class PalletUpdateDto
{
    public int IdtblPallets { get; set; }
    public int TotalCajas { get; set; }
    public string Hora { get; set; } = string.Empty;
    public string Linea { get; set; } = string.Empty;
}
