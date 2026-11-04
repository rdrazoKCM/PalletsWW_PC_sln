namespace PalletsWW_PC.Web.Models.Dtos;

public class PalletBatchInsertDto
{
    public int FolioVale { get; set; }
    public int IdtblProductos { get; set; }
    public int IdRT_Encabezado { get; set; }
    public int NoEmpCapturo { get; set; }
    public List<PalletBatchItemDto> Pallets { get; set; } = new();
}