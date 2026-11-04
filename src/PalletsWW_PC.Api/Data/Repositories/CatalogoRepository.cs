using System.Data;
using Kcc.Infrastructure.Sql.Providers;
using PalletsWW_PC.Api.Models.Dtos;

namespace PalletsWW_PC.Api.Data.Repositories;

public class CatalogoRepository : ICatalogoRepository
{
    private readonly IKccSqlProvider _sqlProvider;
    private readonly string _palletsDb;
    private readonly string _productosDb;
    private readonly string _empleadosDb;
    private const string MaquinaFilePath = @"C:\ArchivosBitacoraAut\Maquina.txt";

    public CatalogoRepository(IKccSqlProvider sqlProvider, IConfiguration configuration)
    {
        _sqlProvider = sqlProvider;
        _palletsDb = configuration["AppDatabases:PalletsWWDb"] ?? "TLX022MXDB";
        _productosDb = configuration["AppDatabases:ProductosDb"] ?? "TLX040MXDB";
        _empleadosDb = configuration["AppDatabases:EmpleadosDb"] ?? "TLX032MXDB";
    }

    public async Task<IEnumerable<LineaEmpaqueDto>> ObtenerLineasEmpaqueAsync(int noMaquina = 0)
    {
        var list = new List<LineaEmpaqueDto>();

        try
        {
            await _sqlProvider.ExecuteReaderManyAsync(
                database: _palletsDb,
                cmdText: "pa_P009_01013_sLlenar_cbxLineaEmpaque",
                configure: cmd =>
                {
                    cmd.CommandType = CommandType.StoredProcedure;
                    cmd.Parameters.AddWithValue("@NoMaquina", noMaquina);
                },
                handleRow: rdr =>
                {
                    if (!rdr.IsDBNull(0))
                    {
                        var linea = rdr.GetValue(0).ToString() ?? "";
                        if (!string.IsNullOrWhiteSpace(linea))
                        {
                            list.Add(new LineaEmpaqueDto
                            {
                                IdLineaEmpaque = list.Count + 1,
                                LineaEmpaque = linea.Trim()
                            });
                        }
                    }
                });
        }
        catch
        {
            // Fallback
        }

        if (list.Count == 0)
        {
            var defaultLineas = new[] { "01", "02", "11", "12", "31", "32" };
            for (int i = 0; i < defaultLineas.Length; i++)
            {
                list.Add(new LineaEmpaqueDto { IdLineaEmpaque = i + 1, LineaEmpaque = defaultLineas[i] });
            }
        }

        return list;
    }

    public async Task<IEnumerable<EmpleadoDto>> ObtenerOperadoresAsync()
    {
        var list = new List<EmpleadoDto>();

        await _sqlProvider.ExecuteReaderManyAsync(
            database: _empleadosDb,
            cmdText: "pa_P009_000_001_LlenarcbxNoEmpSinParams",
            configure: cmd =>
            {
                cmd.CommandType = CommandType.StoredProcedure;
            },
            handleRow: rdr =>
            {
                list.Add(new EmpleadoDto
                {
                    NoEmp = rdr.IsDBNull(0) ? 0 : Convert.ToInt32(rdr.GetValue(0)),
                    Nombre = rdr.IsDBNull(1) ? "" : rdr.GetValue(1).ToString() ?? ""
                });
            });

        return list;
    }

    
    public async Task<EmpleadoDto?> ObtenerEmpleadoPorNoEmpAsync(int noEmp)
    {
        EmpleadoDto? emp = null;
        try
        {
            await _sqlProvider.ExecuteReaderAsync(
                database: _empleadosDb,
                cmdText: "SELECT TOP 1 NoEmp, Nombre FROM dbo.tblEmpleados WITH (NOLOCK) WHERE NoEmp = @NoEmp AND Bajas = 0",
                configure: cmd =>
                {
                    cmd.CommandType = CommandType.Text;
                    cmd.Parameters.AddWithValue("@NoEmp", noEmp);
                },
                handleRow: rdr =>
                {
                    if (!rdr.IsDBNull(0))
                    {
                        emp = new EmpleadoDto
                        {
                            NoEmp = Convert.ToInt32(rdr.GetValue(0)),
                            Nombre = rdr.IsDBNull(1) ? "" : rdr.GetValue(1).ToString() ?? ""
                        };
                    }
                });
        }
        catch { }
        return emp;
    }

    public async Task<IEnumerable<EmpleadoDto>> ObtenerSupervisoresAsync()
    {
        var list = new List<EmpleadoDto>();

        await _sqlProvider.ExecuteReaderManyAsync(
            database: _productosDb,
            cmdText: "pa_P009_000_051_LlenarcbxSupervisoresxDepto",
            configure: cmd =>
            {
                cmd.CommandType = CommandType.StoredProcedure;
                cmd.Parameters.AddWithValue("@Nodepto", 3); // Depto 3 = Wet Wipes
            },
            handleRow: rdr =>
            {
                list.Add(new EmpleadoDto
                {
                    NoEmp = rdr.IsDBNull(0) ? 0 : Convert.ToInt32(rdr.GetValue(0)),
                    Nombre = rdr.IsDBNull(1) ? "" : rdr.GetValue(1).ToString() ?? ""
                });
            });

        return list;
    }

    public async Task<IEnumerable<MaquinaDto>> ObtenerMaquinasAsync()
    {
        var list = new List<MaquinaDto>();

        await _sqlProvider.ExecuteReaderManyAsync(
            database: _productosDb,
            cmdText: "pa_P009_000_008_LlenarcbxNoMaquinaConParams",
            configure: cmd =>
            {
                cmd.CommandType = CommandType.StoredProcedure;
                cmd.Parameters.AddWithValue("@NoDepto", 3); // Depto 3 = Wet Wipes
            },
            handleRow: rdr =>
            {
                list.Add(new MaquinaDto
                {
                    NoMaquina = rdr.IsDBNull(0) ? 0 : Convert.ToInt32(rdr.GetValue(0)),
                    NombreMaquina = rdr.IsDBNull(1) ? "" : rdr.GetValue(1).ToString() ?? ""
                });
            });

        return list;
    }

    public async Task<IEnumerable<ProductoDto>> ObtenerProductosPorMaquinaAsync(int noMaquina)
    {
        var list = new List<ProductoDto>();

        try
        {
            await _sqlProvider.ExecuteReaderManyAsync(
                database: _productosDb,
                cmdText: "pa_P009_000_001_ProductosXMaquina",
                configure: cmd =>
                {
                    cmd.CommandType = CommandType.StoredProcedure;
                    cmd.Parameters.AddWithValue("@NoMaquina", noMaquina);
                },
                handleRow: rdr =>
                {
                    list.Add(new ProductoDto
                    {
                        IdtblProductos = rdr.IsDBNull(0) ? 0 : Convert.ToInt32(rdr.GetValue(0)),
                        DescripcionProducto = rdr.IsDBNull(1) ? "" : rdr.GetValue(1).ToString() ?? "",
                        ClaveProducto = rdr.FieldCount > 2 && !rdr.IsDBNull(2) ? rdr.GetValue(2).ToString() ?? "" : ""
                    });
                });
        }
        catch
        {
            // Fallback
        }

        // Enriquecer ClaveProducto y CajasXPallet desde el catálogo oficial de productos
        if (list.Count > 0)
        {
            var ids = list.Where(p => p.IdtblProductos > 0).Select(p => p.IdtblProductos).Distinct().ToList();
            if (ids.Count > 0)
            {
                try
                {
                    string idList = string.Join(",", ids);
                    string sqlProds = $"SELECT IdtblProductos, ClaveProducto, ISNULL(CajasXPallet, 63) AS CajasXPallet FROM dbo.tblProductos WITH (NOLOCK) WHERE IdtblProductos IN ({idList})";
                    await _sqlProvider.ExecuteReaderManyAsync(
                        database: _productosDb,
                        cmdText: sqlProds,
                        configure: cmd => { cmd.CommandType = CommandType.Text; },
                        handleRow: rdrP =>
                        {
                            int id = Convert.ToInt32(rdrP["IdtblProductos"]);
                            string clave = rdrP["ClaveProducto"] != DBNull.Value ? rdrP["ClaveProducto"].ToString()?.Trim() ?? "" : "";
                            int cajas = rdrP["CajasXPallet"] != DBNull.Value ? Convert.ToInt32(rdrP["CajasXPallet"]) : 63;

                            var match = list.FirstOrDefault(x => x.IdtblProductos == id);
                            if (match != null)
                            {
                                if (string.IsNullOrWhiteSpace(match.ClaveProducto)) match.ClaveProducto = clave;
                                match.CajasXPallet = cajas;
                            }
                        });
                }
                catch { }
            }
        }

        return list;
    }

    public Task<int> LeerMaquinaConfiguradaAsync()
    {
        try
        {
            if (File.Exists(MaquinaFilePath))
            {
                var lines = File.ReadAllLines(MaquinaFilePath);
                if (lines.Length > 0 && int.TryParse(lines[0].Trim(), out int m))
                {
                    return Task.FromResult(m);
                }
            }
        }
        catch { }

        return Task.FromResult(9); // Default máquina 9 TXWW1
    }

    public Task<bool> GuardarConfiguracionMaquinaAsync(int noMaquina)
    {
        try
        {
            string dir = Path.GetDirectoryName(MaquinaFilePath) ?? @"C:\ArchivosBitacoraAut";
            if (!Directory.Exists(dir))
            {
                Directory.CreateDirectory(dir);
            }

            string turno = "1";
            string noEmp = "0";

            if (File.Exists(MaquinaFilePath))
            {
                var existing = File.ReadAllLines(MaquinaFilePath);
                if (existing.Length > 1) turno = existing[1];
                if (existing.Length > 2) noEmp = existing[2];
            }

            File.WriteAllLines(MaquinaFilePath, new[] { noMaquina.ToString(), turno, noEmp });
            return Task.FromResult(true);
        }
        catch
        {
            return Task.FromResult(false);
        }
    }
}
