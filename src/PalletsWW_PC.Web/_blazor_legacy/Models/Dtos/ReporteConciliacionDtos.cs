namespace PalletsWW_PC.Web.Models.Dtos;

public class ReporteConciliacionItemDto
{
    public long IdtblPallets { get; set; }
    public string NoTarima { get; set; } = string.Empty;
    public long FolioVale { get; set; }
    public int TotalCajas { get; set; }
    public string HoraProduccion { get; set; } = string.Empty;
    public DateTime FechaHoraCaptura { get; set; }
    public string ClaveProducto { get; set; } = string.Empty;
    public string DescripcionProducto { get; set; } = string.Empty;
    public int NoEmpCapturo { get; set; }
    public string NombreOperador { get; set; } = string.Empty;

    // Estatus de Entrega en Almacén PT
    public bool EsEntregado { get; set; }
    public int? IdtblPalletEntregadoPT { get; set; }
    public DateTime? FechaHoraEntregaAlmacen { get; set; }
    public bool LeidoRFID { get; set; }
    public int? FolioRecepcionAlmacen { get; set; }
    public int? TurnoRecepcionAlmacen { get; set; }
    public string NombreSupAlmacen { get; set; } = string.Empty;
}

public class ReporteConciliacionResponseDto
{
    public int NoMaquina { get; set; }
    public int Turno { get; set; }
    public DateTime Fecha { get; set; }
    public int IdRT_Encabezado { get; set; }
    public string Tripulacion { get; set; } = string.Empty;
    public string NombreSupervisor { get; set; } = string.Empty;

    public int TotalPalletsProducidos { get; set; }
    public int TotalCajasProducidas { get; set; }
    public int TotalPalletsEntregados { get; set; }
    public int TotalCajasEntregadas { get; set; }
    public int TotalPalletsPendientes { get; set; }
    public int TotalCajasPendientes { get; set; }
    public decimal PorcentajeCumplimiento { get; set; }

    public List<ReporteConciliacionItemDto> Items { get; set; } = new();
}