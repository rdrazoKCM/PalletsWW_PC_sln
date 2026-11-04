using System.Data;
using Microsoft.Data.SqlClient;
using Kcc.Infrastructure.Sql.Providers;
using PalletsWW_PC.Api.Models.Dtos;

namespace PalletsWW_PC.Api.Data.Repositories;

public class PalletRepository : IPalletRepository
{
    private static readonly System.Collections.Concurrent.ConcurrentDictionary<int, int> _claveToIdCache = new();
    private readonly IKccSqlProvider _sqlProvider;
    private readonly string _database;
    private readonly IImpresionRepository _impresionRepo;

    public PalletRepository(IKccSqlProvider sqlProvider, IConfiguration configuration, IImpresionRepository impresionRepo)
    {
        _sqlProvider = sqlProvider;
        _impresionRepo = impresionRepo;
        _database = configuration["AppDatabases:PalletsWWDb"] 
            ?? throw new ArgumentNullException("AppDatabases:PalletsWWDb no configurado en appsettings.json");
    }

    public async Task<IEnumerable<PalletDto>> ObtenerPalletsPorValeAsync(int folioVale, int idEncabezado)
    {
        var list = new List<PalletDto>();

        // Integridad: Prohibido consultar si no hay encabezado activo o folio válido
        if (idEncabezado <= 0 || folioVale <= 0)
        {
            return list;
        }

        await _sqlProvider.ExecuteReaderManyAsync(
            database: _database,
            cmdText: "pa_P009_01001_tblPallets",
            configure: cmd =>
            {
                cmd.CommandType = CommandType.StoredProcedure;
                cmd.Parameters.AddWithValue("@FolioVale", folioVale);
                cmd.Parameters.AddWithValue("@IdRT_Encabezado", idEncabezado);
            },
            handleRow: rdr =>
            {
                string horaStr = "";
                if (rdr["Hora"] != DBNull.Value)
                {
                    horaStr = rdr["Hora"].ToString() ?? "";
                    if (TimeSpan.TryParse(horaStr, out var ts))
                    {
                        horaStr = ts.ToString(@"hh\:mm");
                    }
                    else if (DateTime.TryParse(horaStr, out var dt))
                    {
                        horaStr = dt.ToString("HH:mm");
                    }
                }

                string noTarimaStr = "";
                try { noTarimaStr = rdr["NoTarima"] != DBNull.Value ? rdr["NoTarima"].ToString() ?? "" : ""; } catch { }

                string loteStr = "";
                try { loteStr = rdr["Lote"] != DBNull.Value ? rdr["Lote"].ToString() ?? "" : ""; } catch { }

                string descStr = "";
                try { descStr = rdr["DescripcionProducto"] != DBNull.Value ? rdr["DescripcionProducto"].ToString() ?? "" : ""; } catch { }

                var dto = new PalletDto
                {
                    IdtblPallets = rdr["IdtblPallets"] != DBNull.Value ? Convert.ToInt32(rdr["IdtblPallets"]) : 0,
                    NoTarima = noTarimaStr,
                    TotalCajas = rdr["TotalCajas"] != DBNull.Value ? Convert.ToInt32(rdr["TotalCajas"]) : 0,
                    Hora = horaStr,
                    LineaEmpaque = rdr["LineaEmpaque"] != DBNull.Value ? rdr["LineaEmpaque"].ToString() ?? "" : "",
                    FolioVale = folioVale,
                    Lote = loteStr,
                    DescripcionProducto = descStr
                };
                list.Add(dto);
            });

        return list;
    }

    public async Task<PalletResultDto> InsertarPalletAsync(PalletInsertDto dto)
    {
        // Integridad Crítica: Prohibido registrar tarimas sin turno activo en producción
        if (dto.IdRT_Encabezado <= 0)
        {
            return new PalletResultDto
            {
                Exitoso = false,
                IdtblPallets = 0,
                Mensaje = "Operación rechazada: No se puede registrar tarima porque no hay un turno activo dado de alta en el sistema.",
                CodigoRespuesta = -1
            };
        }

        SqlParameter pIdPallet = null!;

        try
        {
            // Blindaje de Coherencia Vale-Turno y Validación de Producto:
            // Un pallet SIEMPRE debe heredar el IdRT_Encabezado legítimo al que pertenece su vale físico.
            // Si el cliente/frontend envía un IdRT_Encabezado desfasado (por ejemplo, el turno nuevo 59116
            // mientras se captura en un vale remanente del turno 3), recuperamos y aplicamos el IdRT_Encabezado real del vale.
            int idEncReal = 0;
            int idProdReal = 0;

            if (dto.IdAutotblProduccion > 0)
            {
                try
                {
                    await _sqlProvider.ExecuteReaderAsync(
                        database: _database,
                        cmdText: "SELECT TOP 1 IdRT_Encabezado, IdtblProductos FROM dbo.tblRT_Produccion WITH (NOLOCK) WHERE IdAutotblProduccion = @IdAuto",
                        configure: cmd => { cmd.Parameters.AddWithValue("@IdAuto", dto.IdAutotblProduccion); },
                        handleRow: rdr =>
                        {
                            if (!rdr.IsDBNull(0)) idEncReal = Convert.ToInt32(rdr.GetValue(0));
                            if (!rdr.IsDBNull(1)) idProdReal = Convert.ToInt32(rdr.GetValue(1));
                        });
                }
                catch { }
            }

            if (idEncReal <= 0 && dto.FolioVale > 0)
            {
                try
                {
                    await _sqlProvider.ExecuteReaderAsync(
                        database: _database,
                        cmdText: "SELECT TOP 1 IdRT_Encabezado, IdtblProductos FROM dbo.tblRT_Produccion WITH (NOLOCK) WHERE FolioVale = @Folio ORDER BY IdAutotblProduccion DESC",
                        configure: cmd => { cmd.Parameters.AddWithValue("@Folio", dto.FolioVale); },
                        handleRow: rdr =>
                        {
                            if (!rdr.IsDBNull(0)) idEncReal = Convert.ToInt32(rdr.GetValue(0));
                            if (!rdr.IsDBNull(1)) idProdReal = Convert.ToInt32(rdr.GetValue(1));
                        });
                }
                catch { }
            }

            // Si el vale físico tiene un IdRT_Encabezado registrado legítimo, garantizar consistencia
            if (idEncReal > 0 && idEncReal != dto.IdRT_Encabezado)
            {
                dto.IdRT_Encabezado = idEncReal;
            }

            if (dto.IdtblProductos <= 0 && idProdReal > 0)
            {
                dto.IdtblProductos = idProdReal;
            }

            // Si por error se mandÃ³ la Clave del producto (ej. 96679) en vez del IdtblProductos (ej. 361), corregirla
            // Blindaje y Aceleración de Rendimiento:
            // En Kimberly-Clark los IdtblProductos son enteros chicos (< 10,000) y las Claves de Producto son >= 10,000.
            // Solo se consulta TLX040MXDB si dto.IdtblProductos > 10,000 (vino una clave SAP en vez de un ID interno).
            // Además, se almacena en caché en memoria estática (_claveToIdCache) para resolver en 0 ms.
            if (dto.IdtblProductos > 10000)
            {
                if (_claveToIdCache.TryGetValue(dto.IdtblProductos, out int idEnCache))
                {
                    dto.IdtblProductos = idEnCache;
                }
                else
                {
                    try
                    {
                        int idReal = 0;
                        await _sqlProvider.ExecuteReaderAsync(
                            database: "TLX040MXDB",
                            cmdText: "SELECT TOP 1 IdtblProductos FROM dbo.tblProductos WITH (NOLOCK) WHERE ClaveProducto = CAST(@Val AS VARCHAR(50))",
                            configure: cmd => { cmd.Parameters.AddWithValue("@Val", dto.IdtblProductos); },
                            handleRow: rdr => { if (!rdr.IsDBNull(0)) idReal = Convert.ToInt32(rdr.GetValue(0)); });

                        if (idReal > 0)
                        {
                            _claveToIdCache.TryAdd(dto.IdtblProductos, idReal);
                            dto.IdtblProductos = idReal;
                        }
                    }
                    catch { }
                }
            }

            TimeSpan horaParsed = TimeSpan.TryParse(dto.Hora, out var ts) 
                ? ts 
                : DateTime.Now.TimeOfDay;

            await _sqlProvider.ExecuteNonQueryAsync(
                database: _database,
                cmdType: CommandType.StoredProcedure,
                cmdText: "pa_P009_01006_tblPalletsInsertcmdV9",
                configure: cmd =>
                {
                    cmd.Parameters.AddWithValue("@FolioVale", dto.FolioVale);
                    cmd.Parameters.AddWithValue("@IdtblProductos", dto.IdtblProductos);
                    cmd.Parameters.AddWithValue("@TotalCajas", dto.TotalCajas);
                    cmd.Parameters.Add("@Hora", SqlDbType.Time).Value = horaParsed;
                    cmd.Parameters.AddWithValue("@IdRT_Encabezado", dto.IdRT_Encabezado);
                    cmd.Parameters.AddWithValue("@NoEmpCapturo", dto.NoEmpCapturo);
                    cmd.Parameters.AddWithValue("@Linea", dto.Linea ?? string.Empty);

                    pIdPallet = new SqlParameter("@IdtblPallets", SqlDbType.Int)
                    {
                        Direction = ParameterDirection.Output
                    };
                    cmd.Parameters.Add(pIdPallet);
                });

            int nuevoId = (pIdPallet.Value != null && pIdPallet.Value != DBNull.Value) 
                ? Convert.ToInt32(pIdPallet.Value) 
                : 0;

            string codigoZpl = "";
            string noTarimaReal = nuevoId.ToString();
            if (nuevoId > 0)
            {
                try
                {
                    var etq = await _impresionRepo.ObtenerDatosEtiquetaAsync(nuevoId);
                    codigoZpl = etq?.CodigoZpl ?? "";
                    if (!string.IsNullOrEmpty(etq?.NoTarima))
                    {
                        noTarimaReal = etq.NoTarima;
                    }
                }
                catch { }
            }

            return new PalletResultDto
            {
                Exitoso = nuevoId > 0,
                IdtblPallets = nuevoId,
                NoTarima = noTarimaReal,
                CodigoZpl = codigoZpl,
                Mensaje = nuevoId > 0 ? "Pallet registrado con éxito" : "No se generó folio de pallet",
                CodigoRespuesta = nuevoId > 0 ? 1 : 0
            };
        }
        catch (SqlException ex)
        {
            // BLINDAJE INDUSTRIAL (Homologado con Pallets PaÃ±al):
            // Si hubo lentitud de red o doble clic, el primer intento sÃ­ guardÃ³ el pallet en SQL Server.
            // Al reintentar, el SP arroja ALERTA DE DUPLICIDAD.
            // En vez de fallar, recuperamos la tarima existente en BD, generamos su etiqueta ZPL y la entregamos con Ã©xito.
            if (ex.Message.Contains("ALERTA DE DUPLICIDAD") || ex.Message.Contains("ya tiene registrado un pallet"))
            {
                try
                {
                    TimeSpan horaParsed = TimeSpan.TryParse(dto.Hora, out var ts) ? ts : DateTime.Now.TimeOfDay;
                    int idExistente = 0;
                    string noTarimaExistente = "";

                    string sqlBuscar = @"
                        SELECT TOP 1 IdtblPallets, NoTarima 
                        FROM dbo.tblPallets WITH (NOLOCK)
                        WHERE FolioVale = @FolioVale 
                          AND IdRT_Encabezado = @IdRT_Encabezado
                          AND Hora = @Hora
                        ORDER BY IdtblPallets DESC";

                    await _sqlProvider.ExecuteReaderAsync(
                        database: _database,
                        cmdText: sqlBuscar,
                        configure: cmd =>
                        {
                            cmd.CommandType = CommandType.Text;
                            cmd.Parameters.AddWithValue("@FolioVale", dto.FolioVale);
                            cmd.Parameters.AddWithValue("@IdRT_Encabezado", dto.IdRT_Encabezado);
                            cmd.Parameters.Add("@Hora", SqlDbType.Time).Value = horaParsed;
                        },
                        handleRow: rdr =>
                        {
                            if (!rdr.IsDBNull(0)) idExistente = Convert.ToInt32(rdr.GetValue(0));
                            if (!rdr.IsDBNull(1)) noTarimaExistente = rdr.GetValue(1).ToString() ?? "";
                        });

                    if (idExistente > 0)
                    {
                        string codigoZplRecuperado = "";
                        try
                        {
                            var etq = await _impresionRepo.ObtenerDatosEtiquetaAsync(idExistente);
                            codigoZplRecuperado = etq?.CodigoZpl ?? "";
                        }
                        catch { }

                        return new PalletResultDto
                        {
                            Exitoso = true,
                            IdtblPallets = idExistente,
                            NoTarima = !string.IsNullOrEmpty(noTarimaExistente) ? noTarimaExistente : idExistente.ToString(),
                            CodigoZpl = codigoZplRecuperado,
                            Mensaje = "Tarima previamente registrada en el servidor (recuperada automÃ¡ticamente tras lentitud de red y etiqueta emitida).",
                            CodigoRespuesta = 2
                        };
                    }
                }
                catch { }
            }

            return new PalletResultDto
            {
                Exitoso = false,
                IdtblPallets = 0,
                NoTarima = "0",
                Mensaje = ex.Message,
                CodigoRespuesta = ex.Number
            };
        }
        catch (Exception ex)
        {
            return new PalletResultDto
            {
                Exitoso = false,
                IdtblPallets = 0,
                NoTarima = "0",
                Mensaje = ex.Message,
                CodigoRespuesta = -1
            };
        }
    }
    
    public async Task<BatchPalletResultDto> InsertarLotePalletsAsync(PalletBatchInsertDto loteDto)
    {
        var result = new BatchPalletResultDto
        {
            TotalSolicitados = loteDto.Pallets?.Count ?? 0
        };

        // Integridad Crítica: Prohibido registrar lote sin turno activo en producción
        if (loteDto.IdRT_Encabezado <= 0)
        {
            result.Exitoso = false;
            result.Mensaje = "Operación rechazada: No se puede registrar el lote porque no hay un turno activo dado de alta en el sistema.";
            return result;
        }

        if (loteDto.Pallets == null || loteDto.Pallets.Count == 0)
        {
            result.Exitoso = false;
            result.Mensaje = "El lote no contiene tarimas para registrar.";
            return result;
        }

        if (loteDto.Pallets.Count > 10)
        {
            result.Exitoso = false;
            result.Mensaje = "El lote no puede exceder el límite máximo de 10 pallets.";
            return result;
        }

        // 1. Verificar capacidad actual del vale (máximo 38 pallets en total) mediante conteo ultraligero
        // Blindaje de Coherencia Vale-Turno para Lote
        if (loteDto.FolioVale > 0)
        {
            int idEncReal = 0;
            try
            {
                await _sqlProvider.ExecuteReaderAsync(
                    database: _database,
                    cmdText: "SELECT TOP 1 IdRT_Encabezado FROM dbo.tblRT_Produccion WITH (NOLOCK) WHERE FolioVale = @Folio ORDER BY IdAutotblProduccion DESC",
                    configure: cmd => { cmd.Parameters.AddWithValue("@Folio", loteDto.FolioVale); },
                    handleRow: rdr => { if (!rdr.IsDBNull(0)) idEncReal = Convert.ToInt32(rdr.GetValue(0)); });
            }
            catch { }

            if (idEncReal > 0 && idEncReal != loteDto.IdRT_Encabezado)
            {
                loteDto.IdRT_Encabezado = idEncReal;
            }
        }

        int palletsActualesCount = 0;
        await _sqlProvider.ExecuteReaderAsync(
            database: _database,
            cmdText: "SELECT COUNT(1) AS Total FROM dbo.tblPallets WITH (NOLOCK) WHERE FolioVale = @FolioVale AND IdRT_Encabezado = @IdRT_Encabezado",
            configure: cmd =>
            {
                cmd.CommandType = CommandType.Text;
                cmd.Parameters.AddWithValue("@FolioVale", loteDto.FolioVale);
                cmd.Parameters.AddWithValue("@IdRT_Encabezado", loteDto.IdRT_Encabezado);
            },
            handleRow: rdr =>
            {
                palletsActualesCount = Convert.ToInt32(rdr["Total"]);
            });

        if (palletsActualesCount + loteDto.Pallets.Count > 38)
        {
            result.Exitoso = false;
            result.Mensaje = $"No se puede registrar el lote. El vale actual tiene {palletsActualesCount} tarimas y el límite físico es 38 (exceso de {palletsActualesCount + loteDto.Pallets.Count - 38}).";
            return result;
        }

        // 2. Candado Previo de Integridad y Atomicidad (Todo o Nada)
        // 2.1. Validar que no existan horas repetidas en la MISMA LÍNEA dentro de las tarimas del propio lote
        var paresEnLote = new HashSet<string>();
        foreach (var item in loteDto.Pallets)
        {
            string hNorm = NormalizarHoraStr(item.Hora);
            item.Hora = hNorm;
            string lNorm = NormalizarLineaStr(item.Linea);
            string clave = $"{hNorm}_{lNorm}";
            if (!paresEnLote.Add(clave))
            {
                result.Exitoso = false;
                result.Mensaje = $"Operación cancelada: El lote contiene la hora {hNorm} repetida en la línea {lNorm} en más de una tarima. Ninguna tarima fue guardada.";
                return result;
            }
        }

        // 2.2. Validar que ningún par (Hora, Línea) del lote coincida con tarimas previas en dbo.tblPallets para este FolioVale
        var registrosEnBD = new HashSet<string>();
        await _sqlProvider.ExecuteReaderManyAsync(
            database: _database,
            cmdText: "SELECT Hora, Lote FROM dbo.tblPallets WITH (NOLOCK) WHERE FolioVale = @FolioVale AND IdRT_Encabezado = @IdRT_Encabezado",
            configure: cmd =>
            {
                cmd.CommandType = CommandType.Text;
                cmd.Parameters.AddWithValue("@FolioVale", loteDto.FolioVale);
                cmd.Parameters.AddWithValue("@IdRT_Encabezado", loteDto.IdRT_Encabezado);
            },
            handleRow: rdr =>
            {
                if (rdr["Hora"] != DBNull.Value)
                {
                    string hRaw = rdr["Hora"].ToString() ?? "";
                    string hFormateada = "";
                    if (TimeSpan.TryParse(hRaw, out var ts))
                    {
                        hFormateada = ts.ToString(@"hh\:mm");
                    }
                    else if (DateTime.TryParse(hRaw, out var dt))
                    {
                        hFormateada = dt.ToString("HH:mm");
                    }

                    string lote = rdr["Lote"] != DBNull.Value ? rdr["Lote"].ToString() ?? "" : "";
                    string linea = "";
                    if (lote.Length >= 3)
                    {
                        linea = lote.Substring(lote.Length - 3, 2);
                    }
                    linea = NormalizarLineaStr(linea);

                    if (!string.IsNullOrEmpty(hFormateada))
                    {
                        registrosEnBD.Add($"{hFormateada}_{linea}");
                    }
                }
            });

        foreach (var item in loteDto.Pallets)
        {
            string lNorm = NormalizarLineaStr(item.Linea);
            string clave = $"{item.Hora}_{lNorm}";
            if (registrosEnBD.Contains(clave))
            {
                result.Exitoso = false;
                result.Mensaje = $"Operación cancelada: La tarima #{item.FilaIndex} tiene la hora {item.Hora} en la línea {lNorm}, la cual ya está registrada en este vale. Modifique la hora o la línea antes de guardar.";
                return result;
            }
        }

        // 3. Insertar cada pallet de forma secuencial una vez garantizado al 100% que todas las horas son válidas y únicas
        
        foreach (var item in loteDto.Pallets)
        {
            var insertDto = new PalletInsertDto
            {
                FolioVale = loteDto.FolioVale,
                IdtblProductos = loteDto.IdtblProductos,
                TotalCajas = item.TotalCajas,
                Hora = item.Hora,
                IdRT_Encabezado = loteDto.IdRT_Encabezado,
                NoEmpCapturo = loteDto.NoEmpCapturo,
                Linea = item.Linea
            };

            var res = await InsertarPalletAsync(insertDto);
            result.PalletsInsertados.Add(res);

            if (res.Exitoso)
            {
                result.TotalGuardados++;
            }
            else
            {
                result.Exitoso = false;
                result.Mensaje = $"Error al guardar tarima fila #{item.FilaIndex} ({item.Hora}): {res.Mensaje}. Se guardaron {result.TotalGuardados} de {result.TotalSolicitados} tarimas.";
                return result;
            }
        }

        result.Exitoso = result.TotalGuardados == result.TotalSolicitados;
        result.Mensaje = $"Lote de {result.TotalGuardados} tarimas guardado exitosamente.";
        return result;
    }

    public async Task<PalletResultDto> ActualizarPalletAsync(PalletUpdateDto dto)
    {
        try
        {
            string horaStr = NormalizarHoraStr(dto.Hora);
            TimeSpan horaParsed = TimeSpan.TryParse(horaStr, out var ts) 
                ? ts 
                : DateTime.Now.TimeOfDay;

            await _sqlProvider.ExecuteNonQueryAsync(
                database: _database,
                cmdType: CommandType.StoredProcedure,
                cmdText: "pa_P009_01008_tblPalletsUpdatecmdV5",
                configure: cmd =>
                {
                    cmd.Parameters.AddWithValue("@IdtblPallets", dto.IdtblPallets);
                    cmd.Parameters.AddWithValue("@TotalCajas", dto.TotalCajas);
                    cmd.Parameters.Add("@Hora", SqlDbType.Time).Value = horaParsed;
                    cmd.Parameters.AddWithValue("@Linea", dto.Linea ?? string.Empty);
                });

            return new PalletResultDto
            {
                Exitoso = true,
                IdtblPallets = dto.IdtblPallets,
                NoTarima = dto.IdtblPallets.ToString(),
                Mensaje = "Pallet actualizado con éxito",
                CodigoRespuesta = 2
            };
        }
        catch (SqlException ex)
        {
            return new PalletResultDto
            {
                Exitoso = false,
                IdtblPallets = dto.IdtblPallets,
                NoTarima = "0",
                Mensaje = ex.Message,
                CodigoRespuesta = ex.Number
            };
        }
    }

    public async Task<bool> EliminarPalletAsync(int idPallet)
    {
        try
        {
            await _sqlProvider.ExecuteNonQueryAsync(
                database: _database,
                cmdType: CommandType.StoredProcedure,
                cmdText: "pa_P009_01009_tblPalletsDeletecmd",
                configure: cmd =>
                {
                    cmd.Parameters.AddWithValue("@IdtblPallets", idPallet);
                });

            return true;
        }
        catch
        {
            return false;
        }
    }

    private static string NormalizarHoraStr(string? hora)
    {
        if (string.IsNullOrWhiteSpace(hora)) return DateTime.Now.ToString("HH:mm");
        string clean = hora.Trim();
        if (clean.Length == 4 && !clean.Contains(':') && int.TryParse(clean, out _))
        {
            clean = $"{clean.Substring(0, 2)}:{clean.Substring(2, 2)}";
        }
        else if (clean.Length == 3 && !clean.Contains(':') && int.TryParse(clean, out _))
        {
            clean = $"0{clean[0]}:{clean.Substring(1, 2)}";
        }
        if (TimeSpan.TryParse(clean, out var ts))
        {
            return ts.ToString(@"hh\:mm");
        }
        if (DateTime.TryParse(clean, out var dt))
        {
            return dt.ToString("HH:mm");
        }
        return clean;
    }
    private static string NormalizarLineaStr(string? linea)
    {
        if (string.IsNullOrWhiteSpace(linea)) return "01";
        string limpio = linea.Trim();
        if (int.TryParse(limpio, out int num))
        {
            return num.ToString("D2");
        }
        return limpio.Length >= 2 ? limpio : limpio.PadLeft(2, '0');
    }
    public async Task<ReporteConciliacionResponseDto> ObtenerReporteConciliacionAsync(int noMaquina, int turno, DateTime fecha)
    {
        var response = new ReporteConciliacionResponseDto
        {
            NoMaquina = noMaquina,
            Turno = turno,
            Fecha = fecha
        };

        // 1. Obtener información de encabezado (tripulación y supervisor)
        string strFecha = fecha.ToString("yyyyMMdd");
        try
        {
            await _sqlProvider.ExecuteReaderAsync(
                database: _database,
                cmdText: "pa_P009_00102_ConsultaEncabezadoReporteTurnoWipes",
                configure: cmd =>
                {
                    cmd.CommandType = CommandType.StoredProcedure;
                    cmd.Parameters.AddWithValue("@Fecha", strFecha);
                    cmd.Parameters.AddWithValue("@Turno", turno.ToString());
                    cmd.Parameters.AddWithValue("@Maquina", noMaquina);
                },
                handleRow: rdr =>
                {
                    if (response.IdRT_Encabezado <= 0 && !rdr.IsDBNull(0))
                    {
                        response.IdRT_Encabezado = Convert.ToInt32(rdr.GetValue(0));
                        response.Tripulacion = rdr.IsDBNull(4) ? "-" : rdr.GetValue(4).ToString() ?? "-";
                        int noEmpSup = rdr.IsDBNull(5) ? 0 : Convert.ToInt32(rdr.GetValue(5));
                        response.NombreSupervisor = noEmpSup > 0 ? $"Supervisor No. {noEmpSup}" : "Sin Supervisor Asignado";
                    }
                });
        }
        catch { }

        // 2. Obtener lista detallada de pallets cruzada con almacén
        var items = new List<ReporteConciliacionItemDto>();
        try
        {
            await _sqlProvider.ExecuteReaderManyAsync(
                database: _database,
                cmdText: "pa_P009_00102_ReporteConciliacionProduccionVsAlmacenPT",
                configure: cmd =>
                {
                    cmd.CommandType = CommandType.StoredProcedure;
                    cmd.Parameters.AddWithValue("@Maquina", noMaquina);
                    cmd.Parameters.AddWithValue("@Turno", Convert.ToByte(turno));
                    cmd.Parameters.AddWithValue("@Fecha", fecha.ToString("yyyy-MM-dd"));
                },
                handleRow: rdr =>
                {
                    var item = new ReporteConciliacionItemDto
                    {
                        IdtblPallets = Convert.ToInt64(rdr["IdtblPallets"]),
                        NoTarima = rdr["NoTarima"]?.ToString() ?? "",
                        FolioVale = Convert.ToInt64(rdr["FolioVale"]),
                        TotalCajas = Convert.ToInt32(rdr["TotalCajas"]),
                        HoraProduccion = rdr["HoraProduccion"]?.ToString() ?? "",
                        FechaHoraCaptura = rdr["FechaHoraCaptura"] != DBNull.Value ? Convert.ToDateTime(rdr["FechaHoraCaptura"]) : DateTime.MinValue,
                        ClaveProducto = rdr["ClaveProducto"]?.ToString() ?? "",
                        DescripcionProducto = rdr["DescripcionProducto"]?.ToString() ?? "",
                        NoEmpCapturo = rdr["NoEmpCapturo"] != DBNull.Value ? Convert.ToInt32(rdr["NoEmpCapturo"]) : 0,
                        NombreOperador = rdr["NombreOperador"]?.ToString() ?? "",
                        EsEntregado = Convert.ToInt32(rdr["EsEntregado"]) == 1,
                        IdtblPalletEntregadoPT = rdr["IdtblPalletEntregadoPT"] != DBNull.Value ? Convert.ToInt32(rdr["IdtblPalletEntregadoPT"]) : null,
                        FechaHoraEntregaAlmacen = rdr["FechaHoraEntregaAlmacen"] != DBNull.Value ? Convert.ToDateTime(rdr["FechaHoraEntregaAlmacen"]) : null,
                        LeidoRFID = rdr["LeidoRFID"] != DBNull.Value && Convert.ToBoolean(rdr["LeidoRFID"]),
                        FolioRecepcionAlmacen = rdr["FolioRecepcionAlmacen"] != DBNull.Value ? Convert.ToInt32(rdr["FolioRecepcionAlmacen"]) : null,
                        TurnoRecepcionAlmacen = rdr["TurnoRecepcionAlmacen"] != DBNull.Value ? Convert.ToInt32(rdr["TurnoRecepcionAlmacen"]) : null,
                        NombreSupAlmacen = rdr["NombreSupAlmacen"]?.ToString() ?? ""
                    };
                    items.Add(item);
                });
        }
        catch { }

        // 3. Cálculos agregados
        response.Items = items;
        response.TotalPalletsProducidos = items.Count;
        response.TotalCajasProducidas = items.Sum(x => x.TotalCajas);
        response.TotalPalletsEntregados = items.Count(x => x.EsEntregado);
        response.TotalCajasEntregadas = items.Where(x => x.EsEntregado).Sum(x => x.TotalCajas);
        response.TotalPalletsPendientes = response.TotalPalletsProducidos - response.TotalPalletsEntregados;
        response.TotalCajasPendientes = response.TotalCajasProducidas - response.TotalCajasEntregadas;
        response.PorcentajeCumplimiento = response.TotalPalletsProducidos > 0 
            ? Math.Round(((decimal)response.TotalPalletsEntregados / response.TotalPalletsProducidos) * 100m, 1) 
            : 0m;

        return response;
    }
}