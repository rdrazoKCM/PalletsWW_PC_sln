namespace PalletsWW_PC.Api.Models.Dtos;

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

    // Propiedades de enlace dual para compatibilidad total con Frontend React SPA
    public string Clave { get => ClaveProducto; set => ClaveProducto = value; }
    public string Descripcion { get => DescripcionProducto; set => DescripcionProducto = value; }
    public int TotalPallets { get => TotalTarimas; set => TotalTarimas = value; }
    public int TotalCajas { get => CajasProgramadas; set => CajasProgramadas = value; }
    public int CajasPorTarima { get; set; } = 63;
    public string LineaEmpaque { get; set; } = "1";
}
