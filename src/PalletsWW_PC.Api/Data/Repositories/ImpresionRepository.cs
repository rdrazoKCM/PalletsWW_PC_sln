using System.Data;
using System.Text;
using Kcc.Infrastructure.Sql.Providers;
using PalletsWW_PC.Api.Models.Dtos;

namespace PalletsWW_PC.Api.Data.Repositories;

public class ImpresionRepository : IImpresionRepository
{
    private readonly IKccSqlProvider _sqlProvider;
    private readonly string _database;

    public ImpresionRepository(IKccSqlProvider sqlProvider, IConfiguration configuration)
    {
        _sqlProvider = sqlProvider;
        _database = configuration["AppDatabases:PalletsWWDb"] 
            ?? throw new ArgumentNullException("AppDatabases:PalletsWWDb no configurado");
    }

    public async Task<EtiquetaZplDto?> ObtenerDatosEtiquetaAsync(int idPallet)
    {
        EtiquetaZplDto? etiqueta = null;

        await _sqlProvider.ExecuteReaderAsync(
            database: _database,
            cmdText: "pa_P009_01010_btnImprimirEtiqueta_click",
            configure: cmd =>
            {
                cmd.CommandType = CommandType.StoredProcedure;
                cmd.Parameters.AddWithValue("@IdtblPallets", idPallet);
            },
            handleRow: rdr =>
            {
                if (etiqueta == null)
                {
                    etiqueta = new EtiquetaZplDto
                    {
                        Fecha = rdr.IsDBNull(0) ? DateTime.Now : Convert.ToDateTime(rdr.GetValue(0)),
                        FechaLiberacion = rdr.IsDBNull(1) ? DateTime.Now : Convert.ToDateTime(rdr.GetValue(1)),
                        IdtblPallets = rdr.IsDBNull(2) ? idPallet : Convert.ToInt32(rdr.GetValue(2)),
                        DescripcionProducto = rdr.IsDBNull(3) ? "" : rdr.GetValue(3).ToString() ?? "",
                        ClaveProducto = rdr.IsDBNull(4) ? "" : rdr.GetValue(4).ToString() ?? "",
                        Advertencia = rdr.IsDBNull(5) ? "" : rdr.GetValue(5).ToString() ?? "",
                        NoTarima = rdr.IsDBNull(6) ? "" : rdr.GetValue(6).ToString() ?? "",
                        NoCajas = rdr.IsDBNull(7) ? "" : rdr.GetValue(7).ToString() ?? "",
                        Hora = rdr.IsDBNull(8) ? "" : rdr.GetValue(8).ToString() ?? "",
                        Lote = rdr.IsDBNull(9) ? "" : rdr.GetValue(9).ToString() ?? "",
                        FechaSys = rdr.IsDBNull(10) ? DateTime.Now : Convert.ToDateTime(rdr.GetValue(10))
                    };
                }
            });

        if (etiqueta != null)
        {
            etiqueta.CodigoZpl = ConstruirCodigoZpl(etiqueta);
        }

        return etiqueta;
    }

    public string ConstruirCodigoZpl(EtiquetaZplDto d)
    {
        string strJulianProd = d.Fecha.DayOfYear.ToString();
        string strJulianLib = d.FechaLiberacion.DayOfYear.ToString();
        string adv = d.Advertencia ?? "";
        string adv1 = adv.Length > 44 ? adv.Substring(0, 44) : adv;
        string adv2 = adv.Length > 44 ? adv.Substring(44) : "";

        var sb = new StringBuilder();
        sb.AppendLine("^XA");
        sb.AppendLine("^FT730,850^A0R,65,37^FDKIMBERLY CLARK DE MEXICO S.A. B. DE C.V.^FS");
        sb.AppendLine("^FT730,30^A0R,65,37^FDKIMBERLY CLARK DE MEXICO S.A. B. DE C.V.^FS");
        sb.AppendLine($"^FT690,500^A0R,40,45^FD{d.FechaSys:dd/MM/yyyy}^FS");
        sb.AppendLine("^FT690,850^A0R,37,45^FDPLANTA TLAXCALA^FS");
        sb.AppendLine("^FT690,30^A0R,37,45^FDPLANTA TLAXCALA^FS");
        sb.AppendLine($"^FT620,880^ADR,60,20^FD{d.ClaveProducto}^FS");
        sb.AppendLine($"^FT620,60^ADR,60,20^FD{d.ClaveProducto}^FS");
        sb.AppendLine($"^FT620,1060^ADR,60,20^FD{d.DescripcionProducto}^FS");
        sb.AppendLine($"^FT620,240^ADR,60,20^FD{d.DescripcionProducto}^FS");
        sb.AppendLine("^FT470,1070^A0R,50,30^FDFECHA PRODUCCION^FS");
        sb.AppendLine("^FT470,250^A0R,50,30^FDFECHA PRODUCCION^FS");
        sb.AppendLine("^FT320,1070^A0R,50,30^FDFECHA LIBERACION^FS");
        sb.AppendLine("^FT320,250^A0R,50,30^FDFECHA LIBERACION^FS");
        sb.AppendLine($"^FT390,1070^A0R,80,50^FD{strJulianProd} / {d.Fecha:dd/MM/yyyy}^FS");
        sb.AppendLine($"^FT390,250^A0R,80,50^FD{strJulianProd} / {d.Fecha:dd/MM/yyyy}^FS");
        sb.AppendLine($"^FT240,1070^A0R,80,50^FD{strJulianLib} / {d.FechaLiberacion:dd/MM/yyyy}^FS");
        sb.AppendLine($"^FT240,250^A0R,80,50^FD{strJulianLib} / {d.FechaLiberacion:dd/MM/yyyy}^FS");
        sb.AppendLine($"^FT580,850^AFR,30,10^FD{adv1}^FS");
        sb.AppendLine($"^FT580,30^AFR,30,10^FD{adv1}^FS");
        sb.AppendLine($"^FT550,850^AFR,30,10^FD{adv2}^FS");
        sb.AppendLine($"^FT550,30^AFR,30,10^FD{adv2}^FS");
        sb.AppendLine($"^FT140,850^ADR,50,14^FD{d.NoTarima}^FS");
        sb.AppendLine($"^FT140,30^ADR,50,14^FD{d.NoTarima}^FS");
        sb.AppendLine($"^FT80,850^ADR,50,14^FD{d.Lote}^FS");
        sb.AppendLine($"^FT80,30^ADR,50,14^FD{d.Lote}^FS");
        sb.AppendLine($"^FT140,1150^ADR,50,14^FDHORA: {d.Hora}^FS");
        sb.AppendLine($"^FT140,330^ADR,50,14^FDHORA: {d.Hora}^FS");
        sb.AppendLine($"^FT80,1150^ADR,50,14^FDCAJAS: {d.NoCajas}^FS");
        sb.AppendLine($"^FT80,330^ADR,50,14^FDCAJAS: {d.NoCajas}^FS");
        sb.AppendLine("^FO290,850^BQN,2,8^FDMM,N" + d.IdtblPallets + "^FS");
        sb.AppendLine("^FO290,30^BQN,2,8^FDMM,N" + d.IdtblPallets + "^FS");
        sb.AppendLine("^FO40,750^A0N,70,45^FD_______________________________^FS");
        sb.AppendLine("^FO40,751^A0N,70,45^FD_______________________________^FS");
        sb.AppendLine("^FO40,752^A0N,70,45^FD_______________________________^FS");
        sb.AppendLine("^BY3,2.5^FS");
        sb.AppendLine($"^FT470,1500^B3I,N,65,Y,N^FD{d.IdtblPallets}^FS");
        sb.AppendLine("^BY3,2.5^FS");
        sb.AppendLine($"^FT470,690^B3I,N,65,Y,N^FD{d.IdtblPallets}^FS");
        sb.AppendLine("^XZ");

        return sb.ToString();
    }
}
