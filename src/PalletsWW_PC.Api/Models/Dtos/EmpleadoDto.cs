namespace PalletsWW_PC.Api.Models.Dtos;

public class EmpleadoDto
{
    public int NoEmp { get; set; }
    public int NoEmpleado => NoEmp;
    public string Nombre { get; set; } = string.Empty;
    public string NombreEmpleado => Nombre;
}
