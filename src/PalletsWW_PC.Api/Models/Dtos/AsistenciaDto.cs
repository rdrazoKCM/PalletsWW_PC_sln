namespace PalletsWW_PC.Api.Models.Dtos;

public class AsistenciaDto
{
    public int NoEmp { get; set; }
    public string Nombre { get; set; } = string.Empty;
    public DateTime Fecha { get; set; }
    public int NoMaquina { get; set; }
}

public class AsistenciaResponseDto
{
    public bool Exitoso { get; set; }
    public int NoMaquina { get; set; }
    public string NombreMaquina { get; set; } = string.Empty;
    public int TotalRegistros { get; set; }
    public DateTime FechaConsulta { get; set; } = DateTime.Now;
    public List<AsistenciaDto> Registros { get; set; } = new();
    public string? Mensaje { get; set; }
}
