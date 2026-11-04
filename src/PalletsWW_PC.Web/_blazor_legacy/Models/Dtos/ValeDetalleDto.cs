namespace PalletsWW_PC.Web.Models.Dtos;

public class ValeDetalleDto
{
    public int FolioVale { get; set; }
    public int IdRT_Encabezado { get; set; }
    public string ClaveProducto { get; set; } = string.Empty;
    public string DescripcionProducto { get; set; } = string.Empty;
    public string Lote { get; set; } = string.Empty;
    public int IdtblProductos { get; set; }
    public int IdAutotblProduccion { get; set; }
    public int CajasProgramadas { get; set; }
    public int CajasPorPallet { get; set; } = 63;
}
