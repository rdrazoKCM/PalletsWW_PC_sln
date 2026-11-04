namespace PalletsWW_PC.Web.Models.Dtos;

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
}
