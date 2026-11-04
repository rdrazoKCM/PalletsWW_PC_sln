namespace PalletsWW_PC.Web.Models.Dtos;

public class PalletDto
{
    public int IdtblPallets { get; set; }
    public string NoTarima { get; set; } = string.Empty;
    public int TotalCajas { get; set; }
    public string Hora { get; set; } = string.Empty;
    public string LineaEmpaque { get; set; } = string.Empty;
    public int FolioVale { get; set; }
    public string Lote { get; set; } = string.Empty;
    public string DescripcionProducto { get; set; } = string.Empty;
}
