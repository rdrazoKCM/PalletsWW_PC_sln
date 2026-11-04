namespace PalletsWW_PC.Web.Models.Dtos;

public class ReporteValeResumenDto
{
    public int FolioVale { get; set; }
    public string ClaveProducto { get; set; } = string.Empty;
    public string DescripcionProducto { get; set; } = string.Empty;
    public int CajasProgramadas { get; set; }
    public int TotalPalletsRegistrados { get; set; }
    public int TotalCajasRegistradas { get; set; }
    public decimal PorcentajeCumplimiento { get; set; }
}
