using System.Data;
using Kcc.Infrastructure.Sql.Providers;
using PalletsWW_PC.Api.Models.Dtos;

namespace PalletsWW_PC.Api.Data.Repositories;

public class AsistenciaRepository : IAsistenciaRepository
{
    private readonly IKccSqlProvider _sqlProvider;
    private readonly ICatalogoRepository _catalogoRepository;
    private readonly string _asistenciaDb;
    private readonly ILogger<AsistenciaRepository> _logger;

    public AsistenciaRepository(
        IKccSqlProvider sqlProvider,
        ICatalogoRepository catalogoRepository,
        IConfiguration configuration,
        ILogger<AsistenciaRepository> logger)
    {
        _sqlProvider = sqlProvider;
        _catalogoRepository = catalogoRepository;
        _asistenciaDb = configuration["AppDatabases:AsistenciaDb"] ?? "TLX012MXDB";
        _logger = logger;
    }

    public async Task<IEnumerable<AsistenciaDto>> ObtenerRegistrosAsistenciaAsync(int noMaquina)
    {
        var lista = new List<AsistenciaDto>();

        // Si no se especifica máquina o viene <= 0, leer del archivo físico C:\ArchivosBitacoraAut\Maquina.txt
        if (noMaquina <= 0)
        {
            try
            {
                noMaquina = await _catalogoRepository.LeerMaquinaConfiguradaAsync();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "No se pudo leer la máquina desde Maquina.txt. Usando default 9.");
                noMaquina = 9;
            }
        }

        try
        {
            await _sqlProvider.ExecuteReaderManyAsync(
                database: _asistenciaDb,
                cmdText: "pa_P007_002_LlenardgvComidasV02",
                configure: cmd =>
                {
                    cmd.CommandType = CommandType.StoredProcedure;
                    cmd.Parameters.AddWithValue("@NoMaquina", noMaquina);
                },
                handleRow: rdr =>
                {
                    int noEmp = 0;
                    if (!rdr.IsDBNull(rdr.GetOrdinal("NoEmp")))
                    {
                        int.TryParse(rdr["NoEmp"].ToString(), out noEmp);
                    }

                    string nombre = string.Empty;
                    if (!rdr.IsDBNull(rdr.GetOrdinal("Nombre")))
                    {
                        nombre = rdr["Nombre"].ToString()?.Trim() ?? string.Empty;
                    }

                    DateTime fecha = DateTime.MinValue;
                    if (!rdr.IsDBNull(rdr.GetOrdinal("Fecha")))
                    {
                        DateTime.TryParse(rdr["Fecha"].ToString(), out fecha);
                    }

                    int maq = noMaquina;
                    if (!rdr.IsDBNull(rdr.GetOrdinal("NoMaquina")))
                    {
                        int.TryParse(rdr["NoMaquina"].ToString(), out maq);
                    }

                    lista.Add(new AsistenciaDto
                    {
                        NoEmp = noEmp,
                        Nombre = string.IsNullOrWhiteSpace(nombre) ? $"EMPLEADO {noEmp}" : nombre,
                        Fecha = fecha,
                        NoMaquina = maq
                    });
                });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al consultar pa_P007_002_LlenardgvComidasV02 en {Db} para Máquina {NoMaquina}", _asistenciaDb, noMaquina);
            throw;
        }

        return lista;
    }

    public async Task<AsistenciaGerencialResponseDto> ConsultarAsistenciaGerencialAsync(DateTime fechaInicio, DateTime fechaFin, int noEmp = 0)
    {
        var items = new List<AsistenciaGerencialItemDto>();

        // Si la fecha fin es medianoche, abarcar hasta las 23:59:59
        if (fechaFin.TimeOfDay == TimeSpan.Zero)
        {
            fechaFin = fechaFin.Date.AddDays(1).AddTicks(-1);
        }

        try
        {
            await _sqlProvider.ExecuteReaderManyAsync(
                database: _asistenciaDb,
                cmdText: "pa_P007_002_ConsultaAsistenciaGerencial",
                configure: cmd =>
                {
                    cmd.CommandType = CommandType.StoredProcedure;
                    cmd.Parameters.AddWithValue("@FechaInicio", fechaInicio);
                    cmd.Parameters.AddWithValue("@FechaFin", fechaFin);
                    cmd.Parameters.AddWithValue("@NoEmp", noEmp);
                },
                handleRow: rdr =>
                {
                    long id = 0;
                    if (!rdr.IsDBNull(rdr.GetOrdinal("Id"))) long.TryParse(rdr["Id"].ToString(), out id);

                    int empNo = 0;
                    if (!rdr.IsDBNull(rdr.GetOrdinal("NoEmp"))) int.TryParse(rdr["NoEmp"].ToString(), out empNo);

                    string nombre = string.Empty;
                    if (!rdr.IsDBNull(rdr.GetOrdinal("Nombre"))) nombre = rdr["Nombre"].ToString()?.Trim() ?? string.Empty;

                    DateTime fecha = DateTime.MinValue;
                    if (!rdr.IsDBNull(rdr.GetOrdinal("Fecha"))) DateTime.TryParse(rdr["Fecha"].ToString(), out fecha);

                    int maq = 0;
                    if (!rdr.IsDBNull(rdr.GetOrdinal("NoMaquina"))) int.TryParse(rdr["NoMaquina"].ToString(), out maq);

                    items.Add(new AsistenciaGerencialItemDto
                    {
                        Id = id,
                        NoEmp = empNo,
                        Nombre = string.IsNullOrWhiteSpace(nombre) ? $"EMPLEADO {empNo}" : nombre,
                        Fecha = fecha,
                        NoMaquina = maq
                    });
                });
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "El SP pa_P007_002_ConsultaAsistenciaGerencial falló. Ejecutando consulta directa con NOLOCK.");
            
            try
            {
                string queryFallback = @"
                    SELECT TOP (5000)
                        rc.IdtblRegistroComida AS [Id],
                        rc.NoEmp AS [NoEmp],
                        ISNULL(NULLIF(LTRIM(RTRIM(emp.Nombre)), ''), 'EMPLEADO ' + CAST(rc.NoEmp AS VARCHAR(20))) AS [Nombre],
                        rc.Fecha AS [Fecha],
                        ISNULL(rc.NoMaquina, 0) AS [NoMaquina]
                    FROM dbo.tblRegistroComida rc WITH (NOLOCK)
                    LEFT JOIN TLX032MXDB.dbo.tblEmpleados emp WITH (NOLOCK) ON rc.NoEmp = emp.NoEmp
                    WHERE rc.Fecha >= @FechaInicio AND rc.Fecha <= @FechaFin
                      AND (@NoEmp <= 0 OR rc.NoEmp = @NoEmp)
                    ORDER BY rc.Fecha DESC, rc.IdtblRegistroComida DESC";

                await _sqlProvider.ExecuteReaderManyAsync(
                    database: _asistenciaDb,
                    cmdText: queryFallback,
                    configure: cmd =>
                    {
                        cmd.CommandType = CommandType.Text;
                        cmd.Parameters.AddWithValue("@FechaInicio", fechaInicio);
                        cmd.Parameters.AddWithValue("@FechaFin", fechaFin);
                        cmd.Parameters.AddWithValue("@NoEmp", noEmp);
                    },
                    handleRow: rdr =>
                    {
                        long id = 0;
                        if (!rdr.IsDBNull(rdr.GetOrdinal("Id"))) long.TryParse(rdr["Id"].ToString(), out id);
                        int empNo = 0;
                        if (!rdr.IsDBNull(rdr.GetOrdinal("NoEmp"))) int.TryParse(rdr["NoEmp"].ToString(), out empNo);
                        string nombre = string.Empty;
                        if (!rdr.IsDBNull(rdr.GetOrdinal("Nombre"))) nombre = rdr["Nombre"].ToString()?.Trim() ?? string.Empty;
                        DateTime fecha = DateTime.MinValue;
                        if (!rdr.IsDBNull(rdr.GetOrdinal("Fecha"))) DateTime.TryParse(rdr["Fecha"].ToString(), out fecha);
                        int maq = 0;
                        if (!rdr.IsDBNull(rdr.GetOrdinal("NoMaquina"))) int.TryParse(rdr["NoMaquina"].ToString(), out maq);

                        items.Add(new AsistenciaGerencialItemDto
                        {
                            Id = id,
                            NoEmp = empNo,
                            Nombre = string.IsNullOrWhiteSpace(nombre) ? $"EMPLEADO {empNo}" : nombre,
                            Fecha = fecha,
                            NoMaquina = maq
                        });
                    });
            }
            catch (Exception exDirect)
            {
                _logger.LogError(exDirect, "Error crítico al consultar asistencia gerencial en {Db}", _asistenciaDb);
                throw;
            }
        }

        int unicos = items.Select(x => x.NoEmp).Distinct().Count();

        return new AsistenciaGerencialResponseDto
        {
            Exitoso = true,
            TotalRegistros = items.Count,
            TotalColaboradoresUnicos = unicos,
            FechaInicio = fechaInicio,
            FechaFin = fechaFin,
            Items = items,
            Mensaje = "Consulta gerencial completada con éxito"
        };
    }
}
