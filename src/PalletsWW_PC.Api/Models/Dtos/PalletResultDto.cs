namespace PalletsWW_PC.Api.Models.Dtos;

public class PalletResultDto
{
    public bool Exitoso { get; set; }
    public int IdtblPallets { get; set; }
    public string NoTarima { get; set; } = string.Empty;
    public string Mensaje { get; set; } = string.Empty;
    public int CodigoRespuesta { get; set; }
    public string? CodigoZpl { get; set; }
}