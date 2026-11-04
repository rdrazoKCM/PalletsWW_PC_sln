using System.Data;
using Microsoft.Data.SqlClient;
using Kcc.Infrastructure.Sql.Providers;
using PalletsWW_PC.Api.Models.Dtos;

namespace PalletsWW_PC.Api.Data.Repositories;

public class ValeRepository : IValeRepository
{
    private readonly IKccSqlProvider _sqlProvider;
    private readonly string _database;
    private readonly string _productosDb;
    private readonly string _empleadosDb;

    public ValeRepository(IKccSqlProvider sqlProvider, IConfiguration configuration)
    {
        _sqlProvider = sqlProvider;
        _database = configuration["AppDatabases:PalletsWWDb"] ?? "TLX022MXDB";
        _productosDb = configuration["AppDatabases:ProductosDb"] ?? "TLX040MXDB";
        _empleadosDb = configuration["AppDatabases:EmpleadosDb"] ?? "TLX032MXDB";
    }

    public static (int Turno, DateTime Fecha) ObtenerTurnoYFechaPlantaActual()
    {
        var ahora = DateTime.Now;
        var horaMin = ahora.TimeOfDay;

        if (horaMin >= new TimeSpan(7, 0, 0) && horaMin < new TimeSpan(15, 0, 0))
        {
            return (1, ahora.Date);
        }
        else if (horaMin >= new TimeSpan(15, 0, 0) && horaMin < new TimeSpan(23, 0, 0))
        {
            return (2, ahora.Date);
        }
        else
        {
            var f = horaMin < new TimeSpan(7, 0, 0) ? ahora.Date.AddDays(-1) : ahora.Date;
            return (3, f);
        }
    }

    public async Task<int> ObtenerIdEncabezadoTurnoAsync(int noMaquina, int turno, DateTime fecha)
    {
        var enc = await ObtenerEncabezadoTurnoCompletoAsync(noMaquina, turno, fecha);
        return enc.IdRT_Encabezado;
    }

    public async Task<EncabezadoTurnoDto> ObtenerEncabezadoTurnoCompletoAsync(int noMaquina, int turno, DateTime fecha)
    {
        int turnoConsulta = turno;
        DateTime fechaConsulta = fecha;

        // Auto-resolución de turno oficial de planta Kimberly-Clark si no se proporciona explícitamente
        if (turnoConsulta <= 0)
        {
            var (tAuto, fAuto) = ObtenerTurnoYFechaPlantaActual();
            turnoConsulta = tAuto;
            if (fecha == default || fecha == DateTime.MinValue || fecha.Date == DateTime.Today)
            {
                fechaConsulta = fAuto;
            }
        }

        var enc = new EncabezadoTurnoDto
        {
            Maquina = noMaquina,
            Turno = turnoConsulta,
            Fecha = fechaConsulta,
            Encontrado = false,
            Tripulacion = "-",
            NombreSupervisor = "Sin Turno Dado de Alta"
        };

        if (noMaquina <= 0)
        {
            return enc;
        }

        string strFecha = fechaConsulta.ToString("yyyyMMdd");

        try
        {
            await _sqlProvider.ExecuteReaderAsync(
                database: _database,
                cmdText: "pa_P009_00102_ConsultaEncabezadoReporteTurnoWipes",
                configure: cmd =>
                {
                    cmd.CommandType = CommandType.StoredProcedure;
                    cmd.Parameters.AddWithValue("@Fecha", strFecha);
                    cmd.Parameters.AddWithValue("@Turno", turnoConsulta.ToString());
                    cmd.Parameters.AddWithValue("@Maquina", noMaquina);
                },
                handleRow: rdr =>
                {
                    if (!enc.Encontrado && !rdr.IsDBNull(0))
                    {
                        enc.IdRT_Encabezado = Convert.ToInt32(rdr.GetValue(0));
                        enc.Fecha = rdr.IsDBNull(1) ? fechaConsulta : Convert.ToDateTime(rdr.GetValue(1));
                        enc.Maquina = rdr.IsDBNull(2) ? noMaquina : Convert.ToInt32(rdr.GetValue(2));
                        enc.Turno = rdr.IsDBNull(3) ? turnoConsulta : Convert.ToInt32(rdr.GetValue(3));
                        enc.Tripulacion = rdr.IsDBNull(4) ? "" : rdr.GetValue(4).ToString() ?? "";
                        enc.Supervisor = rdr.IsDBNull(5) ? 0 : Convert.ToInt32(rdr.GetValue(5));
                        enc.Encontrado = true;
                    }
                });
        }
        catch { }

        // Respaldo de Alta Disponibilidad: Si el SP específico no arrojó registro pero hay un turno activo registrado hoy
        if (!enc.Encontrado)
        {
            try
            {
                string sqlReciente = @"
                    SELECT TOP 1 IdRT_Encabezado, Fecha, Maquina, Turno, Tripulacion, Supervisor 
                    FROM dbo.tblRT_Encabezado WITH (NOLOCK) 
                    WHERE Maquina = @Maquina AND Fecha >= DATEADD(day, -2, CAST(GETDATE() AS DATE))
                    ORDER BY IdRT_Encabezado DESC";

                await _sqlProvider.ExecuteReaderAsync(
                    database: _database,
                    cmdText: sqlReciente,
                    configure: cmd =>
                    {
                        cmd.CommandType = CommandType.Text;
                        cmd.Parameters.AddWithValue("@Maquina", noMaquina);
                    },
                    handleRow: rdr =>
                    {
                        if (!enc.Encontrado && !rdr.IsDBNull(0))
                        {
                            enc.IdRT_Encabezado = Convert.ToInt32(rdr.GetValue(0));
                            enc.Fecha = rdr.IsDBNull(1) ? fechaConsulta : Convert.ToDateTime(rdr.GetValue(1));
                            enc.Maquina = rdr.IsDBNull(2) ? noMaquina : Convert.ToInt32(rdr.GetValue(2));
                            enc.Turno = rdr.IsDBNull(3) ? turnoConsulta : Convert.ToInt32(rdr.GetValue(3));
                            enc.Tripulacion = rdr.IsDBNull(4) ? "" : rdr.GetValue(4).ToString() ?? "";
                            enc.Supervisor = rdr.IsDBNull(5) ? 0 : Convert.ToInt32(rdr.GetValue(5));
                            enc.Encontrado = true;
                        }
                    });
            }
            catch { }
        }

        if (enc.Encontrado && enc.Supervisor > 0)
        {
            try
            {
                await _sqlProvider.ExecuteReaderAsync(
                    database: _empleadosDb,
                    cmdText: "SELECT TOP 1 Nombre FROM dbo.tblEmpleados WITH (NOLOCK) WHERE NoEmp = @NoEmp",
                    configure: cmd =>
                    {
                        cmd.CommandType = CommandType.Text;
                        cmd.Parameters.AddWithValue("@NoEmp", enc.Supervisor);
                    },
                    handleRow: rdr =>
                    {
                        if (!rdr.IsDBNull(0))
                        {
                            enc.NombreSupervisor = rdr.GetValue(0).ToString() ?? "";
                        }
                    });
            }
            catch
            {
                enc.NombreSupervisor = $"Supervisor #{enc.Supervisor}";
            }
        }

        return enc;
    }

    public async Task<IEnumerable<ValeDto>> ObtenerValesTurnoActualAsync(int idEncabezado)
    {
        var list = new List<ValeDto>();

        if (idEncabezado <= 0)
        {
            return list;
        }

        try
        {
            await _sqlProvider.ExecuteReaderManyAsync(
                database: _database,
                cmdText: "pa_P009_01002_sLlenardgvProduccion",
                configure: cmd =>
                {
                    cmd.CommandType = CommandType.StoredProcedure;
                    cmd.Parameters.AddWithValue("@IdRT_Encabezado", idEncabezado);
                },
                handleRow: rdr =>
                {
                    list.Add(new ValeDto
                    {
                        FolioVale = rdr["VALE"] != DBNull.Value ? Convert.ToInt32(rdr["VALE"]) : 0,
                        ClaveProducto = rdr["CLAVE"] != DBNull.Value ? rdr["CLAVE"].ToString() ?? "" : "",
                        DescripcionProducto = rdr["PRODUCTO"] != DBNull.Value ? rdr["PRODUCTO"].ToString() ?? "" : "",
                        CajasProgramadas = rdr["TOTAL CAJAS"] != DBNull.Value ? Convert.ToInt32(rdr["TOTAL CAJAS"]) : 0,
                        IdAutotblProduccion = rdr["ID"] != DBNull.Value ? Convert.ToInt32(rdr["ID"]) : 0,
                        IdRT_Encabezado = idEncabezado
                    });
                });
        }
        catch { }

        if (list.Count > 0)
        {
            await EnriquecerValesConProductosAsync(list);
            try
            {
                var folios = list.Where(v => v.FolioVale > 0).Select(v => v.FolioVale).Distinct().ToList();
                if (folios.Count > 0)
                {
                    string inClause = string.Join(",", folios);
                    string sqlTarimas = $"SELECT FolioVale, COUNT(1) AS Cant FROM dbo.tblPallets WITH (NOLOCK) WHERE IdRT_Encabezado = {idEncabezado} AND FolioVale IN ({inClause}) GROUP BY FolioVale";
                    await _sqlProvider.ExecuteReaderManyAsync(
                        database: _database,
                        cmdText: sqlTarimas,
                        configure: cmd => { cmd.CommandType = CommandType.Text; },
                        handleRow: rdrT =>
                        {
                            int f = Convert.ToInt32(rdrT[0]);
                            int cnt = Convert.ToInt32(rdrT[1]);
                            var match = list.FirstOrDefault(x => x.FolioVale == f);
                            if (match != null) match.TotalTarimas = cnt;
                        });
                }
            }
            catch { }
        }

        return list;
    }

    public async Task<IEnumerable<ValeDto>> ObtenerValesTurnoAnteriorAsync(int noMaquina, int turno, DateTime fecha)
    {
        var list = new List<ValeDto>();
        string strFecha = fecha.ToString("yyyyMMdd");

        try
        {
            await _sqlProvider.ExecuteReaderManyAsync(
                database: _database,
                cmdText: "pa_P009_01005_sLlenardgvProduccionTurnoAnt",
                configure: cmd =>
                {
                    cmd.CommandType = CommandType.StoredProcedure;
                    cmd.Parameters.AddWithValue("@Turno", turno);
                    cmd.Parameters.AddWithValue("@Fecha", strFecha);
                    cmd.Parameters.AddWithValue("@NoMaquina", noMaquina);
                },
                handleRow: rdr =>
                {
                    int folio = 0;
                    string clave = "";
                    string producto = "";
                    int totalCajas = 0;
                    int idAuto = 0;
                    int idEncTurnoAnt = 0;

                    try { folio = Convert.ToInt32(rdr.GetValue(0)); } catch { }
                    try { clave = rdr.GetValue(1)?.ToString() ?? ""; } catch { }
                    try { producto = rdr.GetValue(2)?.ToString() ?? ""; } catch { }
                    try { totalCajas = Convert.ToInt32(rdr.GetValue(3)); } catch { }
                    try { idAuto = Convert.ToInt32(rdr.GetValue(4)); } catch { }
                    if (rdr.FieldCount > 5)
                    {
                        try { idEncTurnoAnt = Convert.ToInt32(rdr.GetValue(5)); } catch { }
                    }

                    list.Add(new ValeDto
                    {
                        FolioVale = folio,
                        ClaveProducto = clave,
                        DescripcionProducto = producto,
                        CajasProgramadas = totalCajas,
                        IdAutotblProduccion = idAuto,
                        IdRT_Encabezado = idEncTurnoAnt
                    });
                });
        }
        catch { }

        if (list.Count > 0)
        {
            await EnriquecerValesConProductosAsync(list);
            try
            {
                var conds = list.Where(v => v.FolioVale > 0 && v.IdRT_Encabezado > 0)
                    .Select(v => $"(FolioVale = {v.FolioVale} AND IdRT_Encabezado = {v.IdRT_Encabezado})");
                string whereClause = string.Join(" OR ", conds);
                if (!string.IsNullOrEmpty(whereClause))
                {
                    string sqlTarimas = $"SELECT FolioVale, IdRT_Encabezado, COUNT(1) AS Cant FROM dbo.tblPallets WITH (NOLOCK) WHERE {whereClause} GROUP BY FolioVale, IdRT_Encabezado";
                    await _sqlProvider.ExecuteReaderManyAsync(
                        database: _database,
                        cmdText: sqlTarimas,
                        configure: cmd => { cmd.CommandType = CommandType.Text; },
                        handleRow: rdrT =>
                        {
                            int f = Convert.ToInt32(rdrT[0]);
                            int enc = Convert.ToInt32(rdrT[1]);
                            int cnt = Convert.ToInt32(rdrT[2]);
                            var match = list.FirstOrDefault(x => x.FolioVale == f && x.IdRT_Encabezado == enc);
                            if (match != null) match.TotalTarimas = cnt;
                        });
                }
            }
            catch { }
        }

        return list;
    }

    public async Task<ValeDetalleDto?> ObtenerDetalleValeAsync(int folioVale, int idEncabezado)
    {
        if (idEncabezado <= 0)
        {
            return null;
        }

        var detalle = new ValeDetalleDto
        {
            FolioVale = folioVale,
            IdRT_Encabezado = idEncabezado,
            CajasPorPallet = 63,
            Lote = string.Empty
        };

        bool found = false;

        try
        {
            await _sqlProvider.ExecuteReaderAsync(
                database: _database,
                cmdText: "pa_P009_01004_02_ObtenerDetalleValePorFolioV8",
                configure: cmd =>
                {
                    cmd.CommandType = CommandType.StoredProcedure;
                    cmd.Parameters.AddWithValue("@FolioVale", folioVale);
                    cmd.Parameters.AddWithValue("@IdRT_Encabezado", idEncabezado);
                },
                handleRow: rdr =>
                {
                    detalle.FolioVale = Convert.ToInt32(rdr.GetValue(0));
                    detalle.IdtblProductos = Convert.ToInt32(rdr.GetValue(1));
                    detalle.IdAutotblProduccion = Convert.ToInt32(rdr.GetValue(2));
                    found = true;
                });
        }
        catch { }

        if (found)
        {
            if (detalle.IdtblProductos <= 0 && detalle.IdAutotblProduccion > 0)
            {
                try
                {
                    await _sqlProvider.ExecuteReaderAsync(
                        database: _database,
                        cmdText: "SELECT TOP 1 IdtblProductos FROM dbo.tblRT_Produccion WITH (NOLOCK) WHERE IdAutotblProduccion = @IdAuto",
                        configure: cmd => { cmd.Parameters.AddWithValue("@IdAuto", detalle.IdAutotblProduccion); },
                        handleRow: rdr => { if (!rdr.IsDBNull(0)) detalle.IdtblProductos = Convert.ToInt32(rdr.GetValue(0)); });
                }
                catch { }
            }

            if (detalle.IdtblProductos > 0)
            {
                try
                {
                    await _sqlProvider.ExecuteReaderAsync(
                        database: _productosDb,
                        cmdText: "pa_P009_000_001_ObtenerDetalleProductoPorIdV8",
                        configure: cmd =>
                        {
                            cmd.CommandType = CommandType.StoredProcedure;
                            cmd.Parameters.AddWithValue("@Id", detalle.IdtblProductos);
                        },
                        handleRow: rdr =>
                        {
                            detalle.ClaveProducto = rdr.IsDBNull(0) ? "" : rdr.GetValue(0).ToString() ?? "";
                            detalle.DescripcionProducto = rdr.IsDBNull(1) ? "" : rdr.GetValue(1).ToString() ?? "";
                            detalle.CajasPorPallet = rdr.IsDBNull(2) ? 63 : Convert.ToInt32(rdr.GetValue(2));
                        });
                }
                catch { }
            }

            if (string.IsNullOrWhiteSpace(detalle.ClaveProducto))
            {
                try
                {
                    string sqlDefensivo = @"
                        SELECT TOP 1 IdtblProductos, ClaveProducto, PresentacionVale, ISNULL(CajasXPallet, 63)
                        FROM dbo.tblProductos WITH (NOLOCK)
                        WHERE IdtblProductos = @Id OR ClaveProducto = CAST(@Id AS VARCHAR(50))";

                    await _sqlProvider.ExecuteReaderAsync(
                        database: _productosDb,
                        cmdText: sqlDefensivo,
                        configure: cmd =>
                        {
                            cmd.CommandType = CommandType.Text;
                            cmd.Parameters.AddWithValue("@Id", detalle.IdtblProductos);
                        },
                        handleRow: rdr =>
                        {
                            detalle.IdtblProductos = Convert.ToInt32(rdr.GetValue(0));
                            detalle.ClaveProducto = rdr.GetValue(1)?.ToString() ?? "";
                            detalle.DescripcionProducto = rdr.GetValue(2)?.ToString() ?? "";
                            detalle.CajasPorPallet = Convert.ToInt32(rdr.GetValue(3));
                        });
                }
                catch { }
            }
        }

        try
        {
            await _sqlProvider.ExecuteReaderAsync(
                database: _database,
                cmdText: "pa_P009_01004_ObtenerUltimoLoteValeV8",
                configure: cmd =>
                {
                    cmd.CommandType = CommandType.StoredProcedure;
                    cmd.Parameters.AddWithValue("@FolioVale", folioVale);
                },
                handleRow: rdr =>
                {
                    if (!rdr.IsDBNull(0))
                        detalle.Lote = rdr.GetValue(0).ToString() ?? "";
                });
        }
        catch { }

        return found ? detalle : null;
    }

    public async Task<ValeDetalleDto?> ObtenerDetalleValePorIdAutoAsync(int idAutotblProduccion)
    {
        var detalle = new ValeDetalleDto
        {
            IdAutotblProduccion = idAutotblProduccion,
            CajasPorPallet = 63,
            Lote = string.Empty
        };

        bool found = false;

        try
        {
            await _sqlProvider.ExecuteReaderAsync(
                database: _database,
                cmdText: "pa_P009_01004_sdgvtblProduccion_CellDoubleClick",
                configure: cmd =>
                {
                    cmd.CommandType = CommandType.StoredProcedure;
                    cmd.Parameters.AddWithValue("@IdAutotblProduccion", idAutotblProduccion);
                },
                handleRow: rdr =>
                {
                    detalle.FolioVale = Convert.ToInt32(rdr.GetValue(0));
                    detalle.IdtblProductos = Convert.ToInt32(rdr.GetValue(1));
                    detalle.IdAutotblProduccion = Convert.ToInt32(rdr.GetValue(2));
                    found = true;
                });
        }
        catch
        {
            return null;
        }

        if (found)
        {
            if (detalle.IdtblProductos <= 0 && detalle.IdAutotblProduccion > 0)
            {
                try
                {
                    await _sqlProvider.ExecuteReaderAsync(
                        database: _database,
                        cmdText: "SELECT TOP 1 IdtblProductos FROM dbo.tblRT_Produccion WITH (NOLOCK) WHERE IdAutotblProduccion = @IdAuto",
                        configure: cmd => { cmd.Parameters.AddWithValue("@IdAuto", detalle.IdAutotblProduccion); },
                        handleRow: rdr => { if (!rdr.IsDBNull(0)) detalle.IdtblProductos = Convert.ToInt32(rdr.GetValue(0)); });
                }
                catch { }
            }

            if (detalle.IdtblProductos > 0)
            {
                try
                {
                    await _sqlProvider.ExecuteReaderAsync(
                        database: _productosDb,
                        cmdText: "pa_P009_000_001_ObtenerDetalleProductoPorIdV8",
                        configure: cmd =>
                        {
                            cmd.CommandType = CommandType.StoredProcedure;
                            cmd.Parameters.AddWithValue("@Id", detalle.IdtblProductos);
                        },
                        handleRow: rdr =>
                        {
                            detalle.ClaveProducto = rdr.IsDBNull(0) ? "" : rdr.GetValue(0).ToString() ?? "";
                            detalle.DescripcionProducto = rdr.IsDBNull(1) ? "" : rdr.GetValue(1).ToString() ?? "";
                            detalle.CajasPorPallet = rdr.IsDBNull(2) ? 63 : Convert.ToInt32(rdr.GetValue(2));
                        });
                }
                catch { }
            }

            if (string.IsNullOrWhiteSpace(detalle.ClaveProducto))
            {
                try
                {
                    string sqlDefensivo = @"
                        SELECT TOP 1 IdtblProductos, ClaveProducto, PresentacionVale, ISNULL(CajasXPallet, 63)
                        FROM dbo.tblProductos WITH (NOLOCK)
                        WHERE IdtblProductos = @Id OR ClaveProducto = CAST(@Id AS VARCHAR(50))";

                    await _sqlProvider.ExecuteReaderAsync(
                        database: _productosDb,
                        cmdText: sqlDefensivo,
                        configure: cmd =>
                        {
                            cmd.CommandType = CommandType.Text;
                            cmd.Parameters.AddWithValue("@Id", detalle.IdtblProductos);
                        },
                        handleRow: rdr =>
                        {
                            detalle.IdtblProductos = Convert.ToInt32(rdr.GetValue(0));
                            detalle.ClaveProducto = rdr.GetValue(1)?.ToString() ?? "";
                            detalle.DescripcionProducto = rdr.GetValue(2)?.ToString() ?? "";
                            detalle.CajasPorPallet = Convert.ToInt32(rdr.GetValue(3));
                        });
                }
                catch { }
            }
        }

        if (found && detalle.FolioVale > 0)
        {
            try
            {
                await _sqlProvider.ExecuteReaderAsync(
                    database: _database,
                    cmdText: "pa_P009_01004_ObtenerUltimoLoteValeV8",
                    configure: cmd =>
                    {
                        cmd.CommandType = CommandType.StoredProcedure;
                        cmd.Parameters.AddWithValue("@FolioVale", detalle.FolioVale);
                    },
                    handleRow: rdr =>
                    {
                        if (!rdr.IsDBNull(0))
                            detalle.Lote = rdr.GetValue(0).ToString() ?? "";
                    });
            }
            catch { }
        }

        return found ? detalle : null;
    }

    public async Task<ValeCreateResultDto> CrearValeAsync(ValeCreateDto dto)
    {
        if (dto.IdRT_Encabezado <= 0)
        {
            return new ValeCreateResultDto
            {
                Exitoso = false,
                Mensaje = "No se puede crear el vale: No hay turno activo dado de alta en el sistema."
            };
        }

        // CANDADO ANTI-DUPLICIDAD PREVENTIVO (Anti-doble clic / lentitud de red):
        // Si ya existe un vale con el mismo Folio en este turno/encabezado,
        // no reinsertar en la base de datos; retornar el registro ya existente.
        try
        {
            int idExistente = 0;
            await _sqlProvider.ExecuteReaderAsync(
                database: _database,
                cmdText: "SELECT TOP 1 IdAutotblProduccion FROM dbo.tblProduccion WITH (NOLOCK) WHERE FolioVale = @FolioVale AND IdRT_Encabezado = @IdRT_Encabezado",
                configure: cmd =>
                {
                    cmd.CommandType = CommandType.Text;
                    cmd.Parameters.AddWithValue("@FolioVale", dto.FolioVale);
                    cmd.Parameters.AddWithValue("@IdRT_Encabezado", dto.IdRT_Encabezado);
                },
                handleRow: rdr =>
                {
                    if (!rdr.IsDBNull(0)) idExistente = Convert.ToInt32(rdr.GetValue(0));
                });

            if (idExistente > 0)
            {
                return new ValeCreateResultDto
                {
                    Exitoso = true,
                    IdAutotblProduccion = idExistente,
                    IntRespuesta = 0,
                    Mensaje = $"El vale {dto.FolioVale} ya se encontraba registrado en este turno (recuperado exitosamente)."
                };
            }
        }
        catch { }

        SqlParameter pIdAuto = null!;
        SqlParameter pIntRespuesta = null!;

        try
        {
            await _sqlProvider.ExecuteNonQueryAsync(
                database: _database,
                cmdType: CommandType.StoredProcedure,
                cmdText: "pa_P009_01003_slnkCapturaVale_LinkClicked",
                configure: cmd =>
                {
                    cmd.Parameters.AddWithValue("@FolioVale", dto.FolioVale);
                    cmd.Parameters.AddWithValue("@IdtblProductos", dto.IdtblProductos);
                    cmd.Parameters.AddWithValue("@IdRT_Encabezado", dto.IdRT_Encabezado);

                    pIdAuto = new SqlParameter("@IdAutotblProduccion", SqlDbType.Int)
                    {
                        Direction = ParameterDirection.Output,
                        Size = 16
                    };
                    pIntRespuesta = new SqlParameter("@IntRespuesta", SqlDbType.SmallInt)
                    {
                        Direction = ParameterDirection.Output,
                        Size = 16
                    };

                    cmd.Parameters.Add(pIdAuto);
                    cmd.Parameters.Add(pIntRespuesta);
                });

            int resp = (pIntRespuesta.Value != null && pIntRespuesta.Value != DBNull.Value) 
                ? Convert.ToInt32(pIntRespuesta.Value) 
                : 0;

            int nuevoIdAuto = (pIdAuto.Value != null && pIdAuto.Value != DBNull.Value) 
                ? Convert.ToInt32(pIdAuto.Value) 
                : 0;

            if (resp == 1)
            {
                return new ValeCreateResultDto
                {
                    Exitoso = false,
                    IntRespuesta = 1,
                    Mensaje = "Ya existe este folio de vale en el sistema. Para modificarlo o capturarlo nuevamente es necesario eliminarlo."
                };
            }

            return new ValeCreateResultDto
            {
                Exitoso = true,
                IdAutotblProduccion = nuevoIdAuto,
                IntRespuesta = 0,
                Mensaje = "Vale creado y activado exitosamente."
            };
        }
        catch (Exception ex)
        {
            return new ValeCreateResultDto
            {
                Exitoso = false,
                IntRespuesta = -1,
                Mensaje = $"Error al crear vale: {ex.Message}"
            };
        }
    }

    public async Task<ValeCreateResultDto> ModificarValeAsync(ValeModificarDto dto)
    {
        if (dto.IdAutotblProduccion <= 0)
        {
            return new ValeCreateResultDto
            {
                Exitoso = false,
                Mensaje = "Debe seleccionar un vale registrado para poder modificarlo."
            };
        }

        if (dto.FolioVale <= 0)
        {
            return new ValeCreateResultDto
            {
                Exitoso = false,
                Mensaje = "El folio del vale debe ser mayor a cero."
            };
        }

        if (dto.IdtblProductos <= 0)
        {
            return new ValeCreateResultDto
            {
                Exitoso = false,
                Mensaje = "Debe seleccionar un producto válido."
            };
        }

        SqlParameter pIntRespuesta = null!;

        try
        {
            await _sqlProvider.ExecuteNonQueryAsync(
                database: _database,
                cmdType: CommandType.StoredProcedure,
                cmdText: "pa_P009_01007_slnkModificaVale_LinkClicked",
                configure: cmd =>
                {
                    cmd.Parameters.AddWithValue("@FolioVale", dto.FolioVale);
                    cmd.Parameters.AddWithValue("@IdtblProductos", dto.IdtblProductos);
                    cmd.Parameters.AddWithValue("@IdAutotblProduccion", dto.IdAutotblProduccion);

                    pIntRespuesta = new SqlParameter("@IntRespuesta", SqlDbType.SmallInt)
                    {
                        Direction = ParameterDirection.Output,
                        Size = 16
                    };
                    cmd.Parameters.Add(pIntRespuesta);
                });

            int resp = (pIntRespuesta.Value != null && pIntRespuesta.Value != DBNull.Value)
                ? Convert.ToInt32(pIntRespuesta.Value)
                : 0;

            if (resp == 1)
            {
                return new ValeCreateResultDto
                {
                    Exitoso = false,
                    IntRespuesta = 1,
                    Mensaje = "Ya existe este folio de vale en la máquina seleccionada."
                };
            }

            return new ValeCreateResultDto
            {
                Exitoso = true,
                IdAutotblProduccion = dto.IdAutotblProduccion,
                IntRespuesta = 0,
                Mensaje = "Vale modificado exitosamente."
            };
        }
        catch
        {
            // Fallback directo a actualización de tblRT_Produccion
            try
            {
                await _sqlProvider.ExecuteNonQueryAsync(
                    database: _database,
                    cmdType: CommandType.Text,
                    cmdText: "UPDATE tblRT_Produccion SET FolioVale = @FolioVale, IdtblProductos = @IdtblProductos WHERE IdAutotblProduccion = @IdAutotblProduccion",
                    configure: cmd =>
                    {
                        cmd.Parameters.AddWithValue("@FolioVale", dto.FolioVale);
                        cmd.Parameters.AddWithValue("@IdtblProductos", dto.IdtblProductos);
                        cmd.Parameters.AddWithValue("@IdAutotblProduccion", dto.IdAutotblProduccion);
                    });

                return new ValeCreateResultDto
                {
                    Exitoso = true,
                    IdAutotblProduccion = dto.IdAutotblProduccion,
                    IntRespuesta = 0,
                    Mensaje = "Vale modificado exitosamente."
                };
            }
            catch (Exception exFallback)
            {
                return new ValeCreateResultDto
                {
                    Exitoso = false,
                    IntRespuesta = -1,
                    Mensaje = $"Error al modificar vale: {exFallback.Message}"
                };
            }
        }
    }

    private async Task EnriquecerValesConProductosAsync(List<ValeDto> list)
    {
        if (list == null || list.Count == 0) return;

        try
        {
            // 1. Obtener IdtblProductos desde tblRT_Produccion para los IdAutotblProduccion
            var idsAuto = list.Where(v => v.IdAutotblProduccion > 0).Select(v => v.IdAutotblProduccion).Distinct().ToList();
            if (idsAuto.Count > 0)
            {
                string inClause = string.Join(",", idsAuto);
                string sqlRT = $"SELECT IdAutotblProduccion, IdtblProductos, FolioVale FROM dbo.tblRT_Produccion WITH (NOLOCK) WHERE IdAutotblProduccion IN ({inClause})";
                await _sqlProvider.ExecuteReaderManyAsync(
                    database: _database,
                    cmdText: sqlRT,
                    configure: cmd => { cmd.CommandType = CommandType.Text; },
                    handleRow: rdr =>
                    {
                        int idAuto = Convert.ToInt32(rdr[0]);
                        int idProd = rdr[1] != DBNull.Value ? Convert.ToInt32(rdr[1]) : 0;
                        var match = list.FirstOrDefault(v => v.IdAutotblProduccion == idAuto);
                        if (match != null && idProd > 0)
                        {
                            match.IdtblProductos = idProd;
                        }
                    });
            }

            // 2. Si todavÃ­a hay vales con IdtblProductos == 0, buscar por ClaveProducto en tblProductos
            var claves = list.Where(v => v.IdtblProductos <= 0 && !string.IsNullOrWhiteSpace(v.ClaveProducto))
                             .Select(v => $"'{v.ClaveProducto.Trim().Replace("'", "''")}'").Distinct().ToList();
            if (claves.Count > 0)
            {
                string inClaves = string.Join(",", claves);
                string sqlClaves = $"SELECT IdtblProductos, ClaveProducto, PresentacionVale, ISNULL(CajasXPallet, 63) FROM dbo.tblProductos WITH (NOLOCK) WHERE ClaveProducto IN ({inClaves})";
                await _sqlProvider.ExecuteReaderManyAsync(
                    database: _productosDb,
                    cmdText: sqlClaves,
                    configure: cmd => { cmd.CommandType = CommandType.Text; },
                    handleRow: rdr =>
                    {
                        int idProd = Convert.ToInt32(rdr[0]);
                        string c = rdr[1]?.ToString()?.Trim() ?? "";
                        string d = rdr[2]?.ToString() ?? "";
                        int cxp = Convert.ToInt32(rdr[3]);
                        var matches = list.Where(v => v.IdtblProductos <= 0 && v.ClaveProducto.Trim().Equals(c, StringComparison.OrdinalIgnoreCase));
                        foreach (var m in matches)
                        {
                            m.IdtblProductos = idProd;
                            m.CajasPorTarima = cxp;
                            if (string.IsNullOrEmpty(m.DescripcionProducto)) m.DescripcionProducto = d;
                        }
                    });
            }

            // 3. Obtener detalles y CajasXPallet de todos los IdtblProductos encontrados
            var idProds = list.Where(v => v.IdtblProductos > 0).Select(v => v.IdtblProductos).Distinct().ToList();
            if (idProds.Count > 0)
            {
                string inProds = string.Join(",", idProds);
                string sqlProds = $"SELECT IdtblProductos, ClaveProducto, PresentacionVale, ISNULL(CajasXPallet, 63) FROM dbo.tblProductos WITH (NOLOCK) WHERE IdtblProductos IN ({inProds})";
                await _sqlProvider.ExecuteReaderManyAsync(
                    database: _productosDb,
                    cmdText: sqlProds,
                    configure: cmd => { cmd.CommandType = CommandType.Text; },
                    handleRow: rdr =>
                    {
                        int idProd = Convert.ToInt32(rdr[0]);
                        string c = rdr[1]?.ToString() ?? "";
                        string d = rdr[2]?.ToString() ?? "";
                        int cxp = Convert.ToInt32(rdr[3]);
                        var matches = list.Where(v => v.IdtblProductos == idProd);
                        foreach (var m in matches)
                        {
                            m.CajasPorTarima = cxp;
                            if (string.IsNullOrEmpty(m.ClaveProducto)) m.ClaveProducto = c;
                            if (string.IsNullOrEmpty(m.DescripcionProducto)) m.DescripcionProducto = d;
                        }
                    });
            }
        }
        catch { }
    }
}