namespace PalletsWW_PC.Api.Models.Dtos;

public class PalletInsertDto
{
    public int FolioVale { get; set; }
    public int IdtblProductos { get; set; }
    public int TotalCajas { get; set; }
    public string Hora { get; set; } = string.Empty;
    public int IdRT_Encabezado { get; set; }
    public int NoEmpCapturo { get; set; }
    public string Linea { get; set; } = string.Empty;
    public int IdAutotblProduccion { get; set; }
}
