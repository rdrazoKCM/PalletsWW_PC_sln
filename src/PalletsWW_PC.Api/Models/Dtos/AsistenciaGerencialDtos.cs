namespace PalletsWW_PC.Api.Models.Dtos;

public class AsistenciaGerencialItemDto
{
    public long Id { get; set; }
    public int NoEmp { get; set; }
    public string Nombre { get; set; } = string.Empty;
    public DateTime Fecha { get; set; }
    public int NoMaquina { get; set; }
}

public class AsistenciaGerencialResponseDto
{
    public bool Exitoso { get; set; }
    public int TotalRegistros { get; set; }
    public int TotalColaboradoresUnicos { get; set; }
    public DateTime FechaInicio { get; set; }
    public DateTime FechaFin { get; set; }
    public List<AsistenciaGerencialItemDto> Items { get; set; } = new();
    public string? Mensaje { get; set; }
}

public class PerfilAppDto
{
    public string Modo { get; set; } = "Produccion";
    public bool EsGerencia { get; set; }
    public string Servidor { get; set; } = string.Empty;
}
