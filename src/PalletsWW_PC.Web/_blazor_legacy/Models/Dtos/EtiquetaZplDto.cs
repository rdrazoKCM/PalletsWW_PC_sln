namespace PalletsWW_PC.Web.Models.Dtos;

public class EtiquetaZplDto
{
    public int IdtblPallets { get; set; }
    public DateTime Fecha { get; set; }
    public DateTime FechaLiberacion { get; set; }
    public DateTime FechaSys { get; set; }
    public string ClaveProducto { get; set; } = string.Empty;
    public string DescripcionProducto { get; set; } = string.Empty;
    public string Advertencia { get; set; } = string.Empty;
    public string NoTarima { get; set; } = string.Empty;
    public string NoCajas { get; set; } = string.Empty;
    public string Hora { get; set; } = string.Empty;
    public string Lote { get; set; } = string.Empty;
    public string CodigoZpl { get; set; } = string.Empty;
}
