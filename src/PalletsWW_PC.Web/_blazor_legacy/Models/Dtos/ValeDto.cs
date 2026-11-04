namespace PalletsWW_PC.Web.Models.Dtos;

public class ValeDto
{
    public int FolioVale { get; set; }
    public string ClaveProducto { get; set; } = string.Empty;
    public string DescripcionProducto { get; set; } = string.Empty;
    public int CajasProgramadas { get; set; }
    public int TotalTarimas { get; set; }
    public int IdRT_Encabezado { get; set; }
    public int IdAutotblProduccion { get; set; }
    public int IdtblProductos { get; set; }
    public int NoMaquina { get; set; }
    public int Turno { get; set; }
    public DateTime Fecha { get; set; }
}
