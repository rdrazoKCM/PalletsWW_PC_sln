namespace PalletsWW_PC.Api.Models.Dtos;

public class EncabezadoTurnoDto
{
    public int IdRT_Encabezado { get; set; }
    public DateTime Fecha { get; set; }
    public int Maquina { get; set; }
    public int Turno { get; set; }
    public string Tripulacion { get; set; } = "";
    public int Supervisor { get; set; }
    public string NombreSupervisor { get; set; } = "";
    public bool Encontrado { get; set; }

    // Alias para compatibilidad con cliente React SPA
    public int NoMaquina { get => Maquina; set => Maquina = value; }
    public int NoSupervisor { get => Supervisor; set => Supervisor = value; }
    public string Mensaje { get; set; } = "";
}
