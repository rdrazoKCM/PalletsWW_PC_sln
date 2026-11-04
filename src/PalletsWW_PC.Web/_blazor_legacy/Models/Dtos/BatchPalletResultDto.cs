namespace PalletsWW_PC.Web.Models.Dtos;

public class BatchPalletResultDto
{
    public bool Exitoso { get; set; }
    public string Mensaje { get; set; } = string.Empty;
    public int TotalSolicitados { get; set; }
    public int TotalGuardados { get; set; }
    public List<PalletResultDto> PalletsInsertados { get; set; } = new();
    public List<int> IdsInsertados => PalletsInsertados.Where(p => p.Exitoso).Select(p => p.IdtblPallets).ToList();
}