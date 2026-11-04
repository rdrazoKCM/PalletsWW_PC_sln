namespace PalletsWW_PC.Web.Models.Dtos;

/// <summary>
/// Resultado de la operación de creación de vale.
/// SP Relacionado: [pa_P009_01003_slnkCapturaVale_LinkClicked]
/// </summary>
public class ValeCreateResultDto
{
    public bool Exitoso { get; set; }
    public int IdAutotblProduccion { get; set; }
    public int IntRespuesta { get; set; }
    public string Mensaje { get; set; } = string.Empty;
}
