using System.ComponentModel.DataAnnotations;

namespace PalletsWW_PC.Api.Models.Dtos;

public class PalletBatchInsertDto
{
    [Required]
    [Range(1, int.MaxValue, ErrorMessage = "El Folio de Vale debe ser mayor a 0")]
    public int FolioVale { get; set; }

    [Required]
    [Range(1, int.MaxValue, ErrorMessage = "El ID de Producto debe ser mayor a 0")]
    public int IdtblProductos { get; set; }

    public int IdRT_Encabezado { get; set; }

    [Required]
    [Range(1, int.MaxValue, ErrorMessage = "El número de empleado debe ser mayor a 0")]
    public int NoEmpCapturo { get; set; }

    [Required]
    [MinLength(1, ErrorMessage = "Debe incluir al menos 1 pallet en el lote")]
    [MaxLength(10, ErrorMessage = "El lote no puede exceder el límite máximo de 10 pallets")]
    public List<PalletBatchItemDto> Pallets { get; set; } = new();
}