namespace PalletsWW_PC.Web.Models.Dtos;

/// <summary>
/// DTO para la creación y asignación de un nuevo vale de producción.
/// SP Relacionado: [pa_P009_01003_slnkCapturaVale_LinkClicked]
/// </summary>
public class ValeCreateDto
{
    /// <summary>
    /// Folio físico del vale (e.g. 37947, 37948)
    /// </summary>
    public int FolioVale { get; set; }

    /// <summary>
    /// ID del producto asignado a la máquina
    /// </summary>
    public int IdtblProductos { get; set; }

    /// <summary>
    /// ID del encabezado del turno activo
    /// </summary>
    public int IdRT_Encabezado { get; set; }
}
