namespace PalletsWW_PC.Web.Models.Dtos;

/// <summary>
/// DTO para catálogo de productos asignados a la máquina.
/// SP Relacionado: [pa_P009_000_001_ProductosXMaquina]
/// </summary>
public class ProductoDto
{
    public int IdtblProductos { get; set; }
    public string ClaveProducto { get; set; } = string.Empty;
    public string DescripcionProducto { get; set; } = string.Empty;
}
