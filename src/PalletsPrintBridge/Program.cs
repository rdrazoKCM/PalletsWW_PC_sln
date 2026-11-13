using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Printing;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Sockets;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;
using System.Threading;

namespace PalletsPrintBridge;

public class BridgeConfigData
{
    public int MachineId { get; set; }
    public string? MachineName { get; set; }
    public string? ServerIp { get; set; }
    public string? PrinterName { get; set; }
    public string? PrintMode { get; set; } = "USB"; // "USB" o "Red"
    public string? PrinterIp { get; set; } = "";
    public int PrinterPort { get; set; } = 9100;
}

[StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
public struct PRINTER_INFO_2
{
    public string pServerName;
    public string pPrinterName;
    public string pShareName;
    public string pPortName;
    public string pDriverName;
    public string pComment;
    public string pLocation;
    public IntPtr pDevMode;
    public string pSepFile;
    public string pPrintProcessor;
    public string pDatatype;
    public string pParameters;
    public IntPtr pSecurityDescriptor;
    public uint Attributes;
    public uint Priority;
    public uint DefaultPriority;
    public uint StartTime;
    public uint UntilTime;
    public uint Status;
    public uint cJobs;
    public uint AveragePPM;
}

class Program
{
    private static readonly string AppDataDir = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "PalletsWW_ZebraBridge");
    private static readonly string SettingsFile = Path.Combine(AppDataDir, "settings.json");
    private static readonly string LogFile = Path.Combine(AppDataDir, "bridge.log");

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private class DOCINFOW
    {
        [MarshalAs(UnmanagedType.LPWStr)]
        public string pDocName = "PalletLabel_ZPL";
        [MarshalAs(UnmanagedType.LPWStr)]
        public string? pOutputFile = null;
        [MarshalAs(UnmanagedType.LPWStr)]
        public string pDataType = "RAW";
    }

    [DllImport("winspool.Drv", EntryPoint = "OpenPrinterW", SetLastError = true, CharSet = CharSet.Unicode, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    private static extern bool OpenPrinter([MarshalAs(UnmanagedType.LPWStr)] string szPrinter, out IntPtr hPrinter, IntPtr pd);

    [DllImport("winspool.Drv", EntryPoint = "ClosePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    private static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "StartDocPrinterW", SetLastError = true, CharSet = CharSet.Unicode, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    private static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOW di);

    [DllImport("winspool.Drv", EntryPoint = "EndDocPrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    private static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "StartPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    private static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "EndPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    private static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "WritePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    private static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);

    [DllImport("winspool.Drv", EntryPoint = "GetDefaultPrinterW", SetLastError = true, CharSet = CharSet.Unicode, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    private static extern bool GetDefaultPrinter(StringBuilder pszBuffer, ref int pcchBuffer);

    [DllImport("winspool.Drv", EntryPoint = "GetPrinterW", SetLastError = true, CharSet = CharSet.Unicode, ExactSpelling = true)]
    private static extern bool GetPrinter(IntPtr hPrinter, int dwLevel, IntPtr pPrinter, int cbBuf, out int pcbNeeded);

    [DllImport("winspool.Drv", EntryPoint = "SetPrinterW", SetLastError = true)]
    private static extern bool SetPrinter(IntPtr hPrinter, int dwLevel, IntPtr pPrinter, int dwCommand);

    private const uint PRINTER_ATTRIBUTE_PAUSED = 0x00000001;
    private const uint PRINTER_STATUS_PAUSED = 0x00000001;
    private const uint PRINTER_STATUS_ERROR = 0x00000002;
    private const uint PRINTER_STATUS_OFFLINE = 0x00000080;
    private const uint PRINTER_STATUS_PAPER_OUT = 0x00000010;
    private const uint PRINTER_STATUS_DOOR_OPEN = 0x00400000;

    private const int PRINTER_CONTROL_PAUSE = 1;
    private const int PRINTER_CONTROL_RESUME = 2;
    private const int PRINTER_CONTROL_PURGE = 3;

    private static Mutex? _singleInstanceMutex;

    public static void Main(string[] args)
    {
        Encoding.RegisterProvider(System.Text.CodePagesEncodingProvider.Instance);

        bool createdNew;
        _singleInstanceMutex = new Mutex(true, "PalletsWW_PrintBridge_Mutex_Global", out createdNew);
        if (!createdNew)
        {
            return;
        }

        AppDomain.CurrentDomain.UnhandledException += (s, e) =>
            Log($"CRASH UNHANDLED: {e.ExceptionObject}");

        try
        {
            if (!Directory.Exists(AppDataDir))
                Directory.CreateDirectory(AppDataDir);

            Log("Iniciando PalletsPrintBridge (v6.4 con Detección de Pausa y Purga Spooler)...");
        }
        catch { }

        int[] puertos = [9100, 5108];
        HttpListener? listener = null;
        int puertoActivo = 0;

        foreach (var p in puertos)
        {
            try
            {
                var l = new HttpListener();
                l.Prefixes.Add($"http://127.0.0.1:{p}/");
                l.Start();
                listener = l;
                puertoActivo = p;
                Log($"Escuchando peticiones HTTP en http://127.0.0.1:{puertoActivo}/");

                // Sincronización automática de accesos directos al iniciar sesión en segundo plano
                ThreadPool.QueueUserWorkItem(_ =>
                {
                    try
                    {
                        Thread.Sleep(2500); // Dar tiempo a que Explorer y Shell estén listos
                        if (File.Exists(SettingsFile))
                        {
                            var cfg = ObtenerConfiguracionActual();
                            if (!string.IsNullOrWhiteSpace(cfg.ServerIp))
                            {
                                ActualizarAccesosDirectos(cfg.ServerIp, cfg.MachineId);
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        Log($"Aviso en auto-sincronización de accesos al iniciar: {ex.Message}");
                    }
                });
                break;
            }
            catch (Exception ex)
            {
                Log($"Puerto {p} no disponible: {ex.Message}");
            }
        }

        if (listener == null)
        {
            Log("ERROR FATAL: No se pudo abrir ninguno de los puertos (9100, 5108). Saliendo.");
            return;
        }

        while (true)
        {
            try
            {
                var ctx = listener.GetContext();
                ThreadPool.QueueUserWorkItem(_ => ProcesarPeticion(ctx, puertoActivo));
            }
            catch (Exception ex)
            {
                Log($"Excepción en GetContext: {ex.Message}");
                Thread.Sleep(500);
            }
        }
    }

    private static BridgeConfigData ObtenerConfiguracionActual()
    {
        var cfg = new BridgeConfigData { ServerIp = "10.26.24.31", PrintMode = "USB", PrinterPort = 9100 };
        if (File.Exists(SettingsFile))
        {
            try
            {
                var opts = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
                var parsed = JsonSerializer.Deserialize<BridgeConfigData>(File.ReadAllText(SettingsFile, Encoding.UTF8), opts);
                if (parsed != null) cfg = parsed;
            }
            catch { }
        }
        return cfg;
    }
    private static void ProcesarPeticion(HttpListenerContext ctx, int puerto)
    {
        try
        {
            var req = ctx.Request;
            var res = ctx.Response;

            res.AddHeader("Access-Control-Allow-Origin", "*");
            res.AddHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
            res.AddHeader("Access-Control-Allow-Headers", "Content-Type, Accept");

            if (req.HttpMethod == "OPTIONS")
            {
                res.StatusCode = 200;
                res.Close();
                return;
            }

            string path = (req.Url?.AbsolutePath ?? "").ToLowerInvariant();

            // 1. Detección / Estado Detallado de la Impresora
            if (path.EndsWith("/default") || path.EndsWith("/status") || path.EndsWith("/available"))
            {
                var cfg = ObtenerConfiguracionActual();
                bool isNetwork = string.Equals(cfg.PrintMode, "Red", StringComparison.OrdinalIgnoreCase) ||
                                 string.Equals(cfg.PrintMode, "Network", StringComparison.OrdinalIgnoreCase) ||
                                 (!string.IsNullOrWhiteSpace(cfg.PrinterIp) && !string.Equals(cfg.PrintMode, "USB", StringComparison.OrdinalIgnoreCase));

                if (isNetwork && !string.IsNullOrWhiteSpace(cfg.PrinterIp))
                {
                    int netPort = cfg.PrinterPort > 0 ? cfg.PrinterPort : 9100;
                    bool online = ProbarConexionImpresoraRed(cfg.PrinterIp, netPort, out string netDesc);
                    var payloadNet = new
                    {
                        name = $"Zebra de Red ({cfg.PrinterIp}:{netPort})",
                        deviceType = "printer",
                        connection = "network_tcp",
                        uid = cfg.PrinterIp,
                        version = "PalletsPrintBridge_v7.0_DualMode",
                        printMode = "Red",
                        printerIp = cfg.PrinterIp,
                        printerPort = netPort,
                        isPaused = false,
                        isOffline = !online,
                        isError = !online,
                        cJobs = (uint)0,
                        statusDesc = online ? $"En Línea (IP {cfg.PrinterIp}:{netPort})" : netDesc
                    };

                    string jsonNet = JsonSerializer.Serialize(payloadNet);
                    byte[] bufNet = Encoding.UTF8.GetBytes(jsonNet);

                    res.ContentType = "application/json; charset=utf-8";
                    res.StatusCode = 200;
                    res.OutputStream.Write(bufNet, 0, bufNet.Length);
                    res.Close();
                    return;
                }

                string printer = DetectarImpresora();
                ObtenerEstadoImpresora(printer, out bool isPaused, out bool isOffline, out bool isError, out uint cJobs, out string statusDesc);

                var payload = new
                {
                    name = printer,
                    deviceType = "printer",
                    connection = "driver",
                    uid = "usb_local",
                    version = "PalletsPrintBridge_v7.0_DualMode",
                    printMode = "USB",
                    printerIp = "",
                    printerPort = 9100,
                    isPaused = isPaused,
                    isOffline = isOffline,
                    isError = isError,
                    cJobs = cJobs,
                    statusDesc = statusDesc
                };

                string json = JsonSerializer.Serialize(payload);
                byte[] buf = Encoding.UTF8.GetBytes(json);

                res.ContentType = "application/json; charset=utf-8";
                res.StatusCode = 200;
                res.OutputStream.Write(buf, 0, buf.Length);
                res.Close();
                return;
            }

            // 2. Catálogo de Todas las Impresoras Instaladas en la PC (/printers)
            if (path.EndsWith("/printers"))
            {
                var instaladas = ObtenerImpresorasInstaladas();
                string actual = DetectarImpresora();
                ObtenerEstadoImpresora(actual, out bool isPaused, out bool isOffline, out bool isError, out uint cJobs, out string statusDesc);

                var payload = new
                {
                    selected = actual,
                    isPaused = isPaused,
                    isOffline = isOffline,
                    isError = isError,
                    cJobs = cJobs,
                    statusDesc = statusDesc,
                    printers = instaladas
                };

                string json = JsonSerializer.Serialize(payload);
                byte[] buf = Encoding.UTF8.GetBytes(json);

                res.ContentType = "application/json; charset=utf-8";
                res.StatusCode = 200;
                res.OutputStream.Write(buf, 0, buf.Length);
                res.Close();
                return;
            }

            // 3. Purgar / Limpiar Cola de Impresión (/purge)
            if (path.EndsWith("/purge"))
            {
                string printer = DetectarImpresora();
                bool ok = PurgarColaImpresion(printer, out string purgeMsg);
                ObtenerEstadoImpresora(printer, out bool isPaused, out bool isOffline, out bool isError, out uint cJobs, out string statusDesc);

                res.ContentType = "application/json; charset=utf-8";
                res.StatusCode = ok ? 200 : 500;
                var resp = new { success = ok, message = purgeMsg, cJobs = cJobs, isPaused = isPaused };
                byte[] buf = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(resp));
                res.OutputStream.Write(buf, 0, buf.Length);
                res.Close();
                return;
            }

            // 4. Reanudar / Despausar Impresora (/resume)
            if (path.EndsWith("/resume"))
            {
                string printer = DetectarImpresora();
                bool ok = ReanudarImpresora(printer, out string resumeMsg);
                ObtenerEstadoImpresora(printer, out bool isPaused, out bool isOffline, out bool isError, out uint cJobs, out string statusDesc);

                res.ContentType = "application/json; charset=utf-8";
                res.StatusCode = ok ? 200 : 500;
                var resp = new { success = ok, message = resumeMsg, cJobs = cJobs, isPaused = isPaused };
                byte[] buf = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(resp));
                res.OutputStream.Write(buf, 0, buf.Length);
                res.Close();
                return;
            }

            // 5. Configuración y Enrolamiento Local (GET y POST /config)
            if (path.EndsWith("/config"))
            {
                if (req.HttpMethod == "GET")
                {
                    var cfgActual = ObtenerConfiguracionActual();
                    string configJson = JsonSerializer.Serialize(cfgActual, new JsonSerializerOptions { WriteIndented = true });

                    byte[] buf = Encoding.UTF8.GetBytes(configJson);
                    res.ContentType = "application/json; charset=utf-8";
                    res.StatusCode = 200;
                    res.OutputStream.Write(buf, 0, buf.Length);
                    res.Close();
                    return;
                }
                else if (req.HttpMethod == "POST")
                {
                    try
                    {
                        using var reader = new StreamReader(req.InputStream, req.ContentEncoding ?? Encoding.UTF8);
                        string body = reader.ReadToEnd();

                        if (!Directory.Exists(AppDataDir))
                        {
                            Directory.CreateDirectory(AppDataDir);
                        }

                        BridgeConfigData? nuevoCfg = null;
                        try
                        {
                            var opts = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
                            nuevoCfg = JsonSerializer.Deserialize<BridgeConfigData>(body, opts);
                        }
                        catch { }

                        BridgeConfigData actualCfg = ObtenerConfiguracionActual();

                        if (nuevoCfg != null)
                        {
                            if (nuevoCfg.MachineId > 0) actualCfg.MachineId = nuevoCfg.MachineId;
                            if (!string.IsNullOrWhiteSpace(nuevoCfg.MachineName)) actualCfg.MachineName = nuevoCfg.MachineName;
                            if (!string.IsNullOrWhiteSpace(nuevoCfg.ServerIp)) actualCfg.ServerIp = nuevoCfg.ServerIp;
                            if (!string.IsNullOrWhiteSpace(nuevoCfg.PrinterName)) actualCfg.PrinterName = nuevoCfg.PrinterName;
                            if (!string.IsNullOrWhiteSpace(nuevoCfg.PrintMode)) actualCfg.PrintMode = nuevoCfg.PrintMode;
                            if (nuevoCfg.PrinterIp != null) actualCfg.PrinterIp = nuevoCfg.PrinterIp;
                            if (nuevoCfg.PrinterPort > 0) actualCfg.PrinterPort = nuevoCfg.PrinterPort;
                        }

                        string mergedJson = JsonSerializer.Serialize(actualCfg, new JsonSerializerOptions { WriteIndented = true });
                        File.WriteAllText(SettingsFile, mergedJson, Encoding.UTF8);
                        Log($"Configuración actualizada en settings.json: {mergedJson}");

                        if (!string.IsNullOrWhiteSpace(actualCfg.ServerIp))
                        {
                            ActualizarAccesosDirectos(actualCfg.ServerIp ?? "10.26.24.31", actualCfg.MachineId);
                        }

                        string resp = "{\"success\":true,\"message\":\"Configuración guardada exitosamente en la PC cliente\"}";
                        byte[] buf = Encoding.UTF8.GetBytes(resp);
                        res.ContentType = "application/json; charset=utf-8";
                        res.StatusCode = 200;
                        res.OutputStream.Write(buf, 0, buf.Length);
                    }
                    catch (Exception ex)
                    {
                        Log($"Error al guardar configuración: {ex.Message}");
                        res.StatusCode = 500;
                    }
                    res.Close();
                    return;
                }
            }

            // 5.1 Test de Impresión Inmediato (/test-print)
            if (path.EndsWith("/test-print"))
            {
                var cfg = ObtenerConfiguracionActual();
                bool isNetwork = string.Equals(cfg.PrintMode, "Red", StringComparison.OrdinalIgnoreCase) ||
                                 string.Equals(cfg.PrintMode, "Network", StringComparison.OrdinalIgnoreCase) ||
                                 (!string.IsNullOrWhiteSpace(cfg.PrinterIp) && !string.Equals(cfg.PrintMode, "USB", StringComparison.OrdinalIgnoreCase));

                string modoDesc = isNetwork ? "RED ETHERNET" : "USB LOCAL";
                string destDesc = isNetwork ? $"{cfg.PrinterIp}:{cfg.PrinterPort}" : DetectarImpresora();
                string testZpl = "^XA\n" +
                                 "^FO50,40^A0N,36,36^FDPRUEBA DE IMPRESION ZEBRA^FS\n" +
                                 $"^FO50,85^A0N,26,26^FDMODO: {modoDesc}^FS\n" +
                                 $"^FO50,120^A0N,24,24^FDDESTINO: {destDesc}^FS\n" +
                                 $"^FO50,155^A0N,24,24^FDFECHA: {DateTime.Now:yyyy-MM-dd HH:mm:ss}^FS\n" +
                                 "^FO50,190^A0N,22,22^FDKIMBERLY-CLARK TLAXCALA - OK^FS\n" +
                                 "^XZ";

                bool ok;
                string msg;
                if (isNetwork && !string.IsNullOrWhiteSpace(cfg.PrinterIp))
                {
                    int netPort = cfg.PrinterPort > 0 ? cfg.PrinterPort : 9100;
                    ok = ImprimirPorRed(cfg.PrinterIp, netPort, testZpl, out msg);
                }
                else
                {
                    string printer = DetectarImpresora();
                    ok = ImprimirDual(printer, testZpl, out msg);
                }

                res.ContentType = "application/json; charset=utf-8";
                res.StatusCode = ok ? 200 : 500;
                byte[] respBuf = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(new { success = ok, message = msg, mode = isNetwork ? "Red" : "USB" }));
                res.OutputStream.Write(respBuf, 0, respBuf.Length);
                res.Close();
                return;
            }

            // 5.2 Diagnóstico de Impresora de Red (/check-network-printer)
            if (path.EndsWith("/check-network-printer"))
            {
                string targetIp = "";
                int targetPort = 9100;
                try
                {
                    using var reader = new StreamReader(req.InputStream, req.ContentEncoding ?? Encoding.UTF8);
                    string b = reader.ReadToEnd();
                    if (!string.IsNullOrWhiteSpace(b))
                    {
                        using var doc = JsonDocument.Parse(b);
                        if (doc.RootElement.TryGetProperty("ip", out var ipProp)) targetIp = ipProp.GetString() ?? "";
                        if (doc.RootElement.TryGetProperty("port", out var pProp)) targetPort = pProp.GetInt32();
                    }
                }
                catch { }

                if (string.IsNullOrWhiteSpace(targetIp))
                {
                    var cfg = ObtenerConfiguracionActual();
                    targetIp = cfg.PrinterIp ?? "";
                    targetPort = cfg.PrinterPort > 0 ? cfg.PrinterPort : 9100;
                }

                bool reachable = ProbarConexionImpresoraRed(targetIp, targetPort, out string reachMsg);
                res.ContentType = "application/json; charset=utf-8";
                res.StatusCode = 200;
                byte[] respBuf = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(new { success = reachable, ip = targetIp, port = targetPort, message = reachMsg }));
                res.OutputStream.Write(respBuf, 0, respBuf.Length);
                res.Close();
                return;
            }

            // 6. Impresión ZPL (/write o /print) con CANDADO DE PAUSA PRE-VUELO
            if (path.EndsWith("/write") || path.EndsWith("/print"))
            {
                using var reader = new StreamReader(req.InputStream, req.ContentEncoding ?? Encoding.UTF8);
                string body = reader.ReadToEnd();

                string zpl = ExtraerZpl(body);

                if (string.IsNullOrWhiteSpace(zpl))
                {
                    res.StatusCode = 400;
                    byte[] err = Encoding.UTF8.GetBytes("{\"success\":false,\"message\":\"Código ZPL vacío\"}");
                    res.OutputStream.Write(err, 0, err.Length);
                    res.Close();
                    return;
                }

                var cfg = ObtenerConfiguracionActual();
                bool isNetwork = string.Equals(cfg.PrintMode, "Red", StringComparison.OrdinalIgnoreCase) ||
                                 string.Equals(cfg.PrintMode, "Network", StringComparison.OrdinalIgnoreCase) ||
                                 (!string.IsNullOrWhiteSpace(cfg.PrinterIp) && !string.Equals(cfg.PrintMode, "USB", StringComparison.OrdinalIgnoreCase));

                // RUTA A: IMPRESIÓN POR RED ETHERNET (TCP SOCKET RAW PUERTO 9100)
                if (isNetwork && !string.IsNullOrWhiteSpace(cfg.PrinterIp))
                {
                    int netPort = cfg.PrinterPort > 0 ? cfg.PrinterPort : 9100;
                    bool ok = ImprimirPorRed(cfg.PrinterIp, netPort, zpl, out string redMsg);
                    Log($"Impresión RED en '{cfg.PrinterIp}:{netPort}': {(ok ? "ÉXITO" : "FALLÓ")} - {redMsg}");

                    res.ContentType = "application/json; charset=utf-8";
                    res.StatusCode = ok ? 200 : 500;
                    byte[] respBufNet = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(new { success = ok, isPaused = false, message = redMsg, mode = "Red", ip = cfg.PrinterIp }));
                    res.OutputStream.Write(respBufNet, 0, respBufNet.Length);
                    res.Close();
                    return;
                }

                // RUTA B: IMPRESIÓN USB LOCAL CON CANDADO PRE-VUELO (100% RETROCOMPATIBLE)
                string printerName = DetectarImpresora();

                // CANDADO: DETECTAR SI LA IMPRESORA ESTÁ EN PAUSA ANTES DE ENCOLAR
                ObtenerEstadoImpresora(printerName, out bool isPaused, out bool isOffline, out bool isError, out uint cJobs, out string statusDesc);
                if (isPaused)
                {
                    string warnMsg = $"⚠️ IMPRESIÓN RECHAZADA: La impresora '{printerName}' está EN PAUSA en Windows ({cJobs} trabajos en cola). Despause la impresora antes de imprimir para no acumular etiquetas.";
                    Log(warnMsg);
                    res.ContentType = "application/json; charset=utf-8";
                    res.StatusCode = 409; // HTTP 409 Conflict
                    byte[] respBuf = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(new
                    {
                        success = false,
                        isPaused = true,
                        cJobs = cJobs,
                        message = warnMsg
                    }));
                    res.OutputStream.Write(respBuf, 0, respBuf.Length);
                    res.Close();
                    return;
                }

                bool okUsb = ImprimirDual(printerName, zpl, out string msg);
                Log($"Impresión en '{printerName}': {(okUsb ? "ÉXITO" : "FALLÓ")} - {msg}");

                res.ContentType = "application/json; charset=utf-8";
                res.StatusCode = okUsb ? 200 : 500;
                byte[] respBuf2 = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(new { success = okUsb, isPaused = false, message = msg, mode = "USB" }));
                res.OutputStream.Write(respBuf2, 0, respBuf2.Length);
                res.Close();
                return;
            }
            res.StatusCode = 404;
            res.Close();
        }
        catch (Exception ex)
        {
            Log($"Error en ProcesarPeticion: {ex.Message}");
            try
            {
                ctx.Response.StatusCode = 500;
                ctx.Response.Close();
            }
            catch { }
        }
    }

    private static bool ObtenerEstadoImpresora(string printerName, out bool isPaused, out bool isOffline, out bool isError, out uint cJobs, out string statusDesc)
    {
        isPaused = false;
        isOffline = false;
        isError = false;
        cJobs = 0;
        statusDesc = "Listo";

        if (string.IsNullOrWhiteSpace(printerName))
        {
            statusDesc = "Nombre de impresora no especificado";
            return false;
        }

        if (!OpenPrinter(printerName, out IntPtr hPrinter, IntPtr.Zero))
        {
            statusDesc = $"No se pudo abrir la impresora (Win32: {Marshal.GetLastWin32Error()})";
            return false;
        }

        try
        {
            GetPrinter(hPrinter, 2, IntPtr.Zero, 0, out int needed);
            if (needed <= 0) return false;

            IntPtr buffer = Marshal.AllocHGlobal(needed);
            try
            {
                if (GetPrinter(hPrinter, 2, buffer, needed, out _))
                {
                    var info = Marshal.PtrToStructure<PRINTER_INFO_2>(buffer);
                    cJobs = info.cJobs;

                    if ((info.Attributes & PRINTER_ATTRIBUTE_PAUSED) != 0 || (info.Status & PRINTER_STATUS_PAUSED) != 0)
                    {
                        isPaused = true;
                    }
                    if ((info.Status & PRINTER_STATUS_OFFLINE) != 0)
                    {
                        isOffline = true;
                    }
                    if ((info.Status & PRINTER_STATUS_ERROR) != 0)
                    {
                        isError = true;
                    }

                    var descList = new List<string>();
                    if (isPaused) descList.Add("EN PAUSA");
                    if (isOffline) descList.Add("DESCONECTADA / OFFLINE");
                    if (isError) descList.Add("EN ERROR");
                    if ((info.Status & PRINTER_STATUS_PAPER_OUT) != 0) descList.Add("SIN PAPEL");
                    if ((info.Status & PRINTER_STATUS_DOOR_OPEN) != 0) descList.Add("TAPA ABIERTA");

                    if (descList.Count > 0)
                    {
                        statusDesc = string.Join(", ", descList);
                    }
                    else
                    {
                        statusDesc = "Listo";
                    }
                    return true;
                }
            }
            finally
            {
                Marshal.FreeHGlobal(buffer);
            }
        }
        catch (Exception ex)
        {
            statusDesc = $"Excepción al consultar estado: {ex.Message}";
        }
        finally
        {
            ClosePrinter(hPrinter);
        }
        return false;
    }

    private static bool PurgarColaImpresion(string printerName, out string msg)
    {
        if (!OpenPrinter(printerName, out IntPtr hPrinter, IntPtr.Zero))
        {
            msg = $"No se pudo abrir la impresora '{printerName}' para purga.";
            return false;
        }
        try
        {
            if (SetPrinter(hPrinter, 0, IntPtr.Zero, PRINTER_CONTROL_PURGE))
            {
                msg = $"Cola de impresión de '{printerName}' purgada exitosamente.";
                Log(msg);
                return true;
            }
            else
            {
                int err = Marshal.GetLastWin32Error();
                msg = $"Error al purgar cola de impresión (Win32: {err}).";
                Log(msg);
                return false;
            }
        }
        catch (Exception ex)
        {
            msg = $"Excepción al purgar cola: {ex.Message}";
            Log(msg);
            return false;
        }
        finally
        {
            ClosePrinter(hPrinter);
        }
    }

    private static bool ReanudarImpresora(string printerName, out string msg)
    {
        if (!OpenPrinter(printerName, out IntPtr hPrinter, IntPtr.Zero))
        {
            msg = $"No se pudo abrir la impresora '{printerName}' para reanudar.";
            return false;
        }
        try
        {
            if (SetPrinter(hPrinter, 0, IntPtr.Zero, PRINTER_CONTROL_RESUME))
            {
                msg = $"Impresora '{printerName}' despausada exitosamente.";
                Log(msg);
                return true;
            }
            else
            {
                int err = Marshal.GetLastWin32Error();
                msg = $"Error al reanudar impresora (Win32: {err}).";
                Log(msg);
                return false;
            }
        }
        catch (Exception ex)
        {
            msg = $"Excepción al reanudar impresora: {ex.Message}";
            Log(msg);
            return false;
        }
        finally
        {
            ClosePrinter(hPrinter);
        }
    }

    private static void LimpiarAccesosStartupDuplicados()
    {
        try
        {
            // 1. Startup del usuario actual
            string curStartup = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Startup), "Pallets WW.lnk");
            if (File.Exists(curStartup))
            {
                File.Delete(curStartup);
                Log($"Eliminado acceso directo duplicado en Startup de usuario actual: {curStartup}");
            }

            // 2. Startup de cada perfil en C:\Users\*
            string usersDir = @"C:\Users";
            if (Directory.Exists(usersDir))
            {
                foreach (var uDir in Directory.GetDirectories(usersDir))
                {
                    string uName = Path.GetFileName(uDir);
                    if (uName.Equals("Public", StringComparison.OrdinalIgnoreCase) ||
                        uName.Equals("All Users", StringComparison.OrdinalIgnoreCase) ||
                        uName.Equals("Default User", StringComparison.OrdinalIgnoreCase))
                    {
                        continue;
                    }

                    string uStartupFile = Path.Combine(uDir, @"AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\Pallets WW.lnk");
                    if (File.Exists(uStartupFile))
                    {
                        File.Delete(uStartupFile);
                        Log($"Eliminado acceso directo duplicado en Startup de usuario '{uName}': {uStartupFile}");
                    }
                }
            }
        }
        catch (Exception ex)
        {
            Log($"Error en LimpiarAccesosStartupDuplicados: {ex.Message}");
        }
    }

    [DllImport("shell32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    public static extern void SHChangeNotify(int wEventId, int uFlags, IntPtr dwItem1, IntPtr dwItem2);
    public const int SHCNE_ASSOCCHANGED = 0x08000000;
    public const int SHCNF_IDLIST = 0x0000;

    public static void RefrescarIconosWindows()
    {
        try
        {
            SHChangeNotify(SHCNE_ASSOCCHANGED, SHCNF_IDLIST, IntPtr.Zero, IntPtr.Zero);
        }
        catch { }
    }

    private static bool EsAccesoDirectoLegacy(dynamic sc)
    {
        try
        {
            string target = sc.TargetPath?.ToString() ?? "";
            if (string.IsNullOrWhiteSpace(target)) return false;

            if (target.EndsWith(".exe", StringComparison.OrdinalIgnoreCase))
            {
                if (!target.Contains("msedge", StringComparison.OrdinalIgnoreCase) &&
                    !target.Contains("chrome", StringComparison.OrdinalIgnoreCase))
                {
                    return true;
                }
            }
        }
        catch { }
        return false;
    }

    private static void RepararAccesoLegacySiEsNecesario(dynamic sc, string lnkPath)
    {
        try
        {
            if (EsAccesoDirectoLegacy(sc))
            {
                string curIcon = sc.IconLocation?.ToString() ?? "";
                if (curIcon.Contains("pallets_ww.ico", StringComparison.OrdinalIgnoreCase) ||
                    curIcon.Contains("pallets_panal.ico", StringComparison.OrdinalIgnoreCase))
                {
                    string legacyExe = sc.TargetPath?.ToString() ?? "";
                    if (File.Exists(legacyExe))
                    {
                        try { File.SetAttributes(lnkPath, FileAttributes.Normal); } catch { }
                        sc.IconLocation = $"{legacyExe},0";
                        sc.Save();
                        Log($"Icono de app legacy restaurado a su origen: '{lnkPath}' -> {legacyExe}");
                    }
                }
            }
        }
        catch { }
    }

    private static void RepararCacheImplicitAppShortcuts(string userProfileDir)
    {
        try
        {
            string uImplicit = Path.Combine(userProfileDir, @"AppData\Roaming\Microsoft\Internet Explorer\Quick Launch\User Pinned\ImplicitAppShortcuts");
            if (!Directory.Exists(uImplicit)) return;

            Type? shellType = Type.GetTypeFromProgID("WScript.Shell");
            dynamic? shell = shellType != null ? Activator.CreateInstance(shellType) : null;
            if (shell == null) return;

            foreach (var lnk in Directory.GetFiles(uImplicit, "*.lnk", SearchOption.AllDirectories))
            {
                try
                {
                    dynamic sc = shell.CreateShortcut(lnk);
                    string icon = sc.IconLocation?.ToString() ?? "";

                    if (EsAccesoDirectoLegacy(sc) && 
                        (icon.Contains("pallets_ww.ico", StringComparison.OrdinalIgnoreCase) || 
                         icon.Contains("pallets_panal.ico", StringComparison.OrdinalIgnoreCase)))
                    {
                        try 
                        { 
                            File.SetAttributes(lnk, FileAttributes.Normal);
                            File.Delete(lnk); 
                            Log($"Cache corrupto de ImplicitAppShortcuts eliminado: '{lnk}'");
                        } 
                        catch { }
                    }
                }
                catch { }
            }
        }
        catch { }
    }

    private static bool AnclarABarraDeTareasShell(string folderPath, string fileName)
    {
        try
        {
            string lnkPath = Path.Combine(folderPath, fileName);
            if (!File.Exists(lnkPath)) return false;

            Type? shellAppType = Type.GetTypeFromProgID("Shell.Application");
            if (shellAppType == null) return false;
            dynamic? shell = Activator.CreateInstance(shellAppType);
            if (shell == null) return false;
            dynamic folder = shell.Namespace(folderPath);
            if (folder == null) return false;
            dynamic item = folder.ParseName(fileName);
            if (item == null) return false;

            bool alreadyPinned = false;
            dynamic? pinVerb = null;
            foreach (var verb in item.Verbs())
            {
                string vName = verb.Name?.ToString()?.Replace("&", "")?.Trim() ?? "";
                if (vName.IndexOf("Desanclar de la barra de tareas", StringComparison.OrdinalIgnoreCase) >= 0 ||
                    vName.IndexOf("Unpin from taskbar", StringComparison.OrdinalIgnoreCase) >= 0)
                {
                    alreadyPinned = true;
                    break;
                }
                if (vName.IndexOf("Anclar a la barra de tareas", StringComparison.OrdinalIgnoreCase) >= 0 ||
                    vName.IndexOf("Pin to taskbar", StringComparison.OrdinalIgnoreCase) >= 0)
                {
                    pinVerb = verb;
                }
            }

            if (alreadyPinned) return true;
            if (pinVerb != null)
            {
                pinVerb.DoIt();
                Log($"Acceso '{fileName}' anclado a la barra de tareas de la sesión activa vía Shell COM.");
                return true;
            }
        }
        catch (Exception ex)
        {
            Log($"Aviso en AnclarABarraDeTareasShell: {ex.Message}");
        }
        return false;
    }

    private static void ActualizarAccesosDirectos(string serverIp, int machineId = 0)
    {
        if (string.IsNullOrWhiteSpace(serverIp)) return;
        try
        {
            string cleanServer = serverIp.Trim().Replace("http://", "").Replace("https://", "").TrimEnd('/');
            try
            {
                if (!Directory.Exists(AppDataDir)) Directory.CreateDirectory(AppDataDir);
                File.WriteAllText(Path.Combine(AppDataDir, "Servidor.txt"), cleanServer, Encoding.UTF8);
            }
            catch { }
            string url = machineId > 0 ? $"http://{cleanServer}:5106/?maquina={machineId}" : $"http://{cleanServer}:5106/";

            string edge = @"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe";
            if (!File.Exists(edge)) edge = @"C:\Program Files\Microsoft\Edge\Application\msedge.exe";
            string chrome = @"C:\Program Files\Google\Chrome\Application\chrome.exe";
            if (!File.Exists(chrome)) chrome = @"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe";

            string icoPath = Path.Combine(AppDataDir, "pallets_ww.ico");
            const string appId = "KCM.PalletsWW";
            string userDataDir = Path.Combine(AppDataDir, "EdgeData");
            try
            {
                if (!Directory.Exists(userDataDir)) Directory.CreateDirectory(userDataDir);
            }
            catch { }

            string target = url;
            string args = "";
            if (File.Exists(edge)) { target = edge; args = $"--app=\"{url}\" --window-name=\"PalletsWW\" --app-user-model-id=\"{appId}\" --user-data-dir=\"{userDataDir}\" --start-maximized"; }
            else if (File.Exists(chrome)) { target = chrome; args = $"--app=\"{url}\" --window-name=\"PalletsWW\" --app-user-model-id=\"{appId}\" --user-data-dir=\"{userDataDir}\" --start-maximized"; }

            // Consultar si la configuración de la terminal solicitó anclar a barra de tareas
            bool pinTaskbar = true;
            try
            {
                if (File.Exists(SettingsFile))
                {
                    using var doc = JsonDocument.Parse(File.ReadAllText(SettingsFile, Encoding.UTF8));
                    if (doc.RootElement.TryGetProperty("pinTaskbar", out var ptProp))
                    {
                        pinTaskbar = ptProp.GetBoolean();
                    }
                }
            }
            catch { }

            Type? shellType = Type.GetTypeFromProgID("WScript.Shell");
            if (shellType != null)
            {
                dynamic? shell = Activator.CreateInstance(shellType);
                if (shell != null)
                {
                    void GuardarAcceso(string rutaLnk)
                    {
                        try
                        {
                            string? dir = Path.GetDirectoryName(rutaLnk);
                            if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir))
                            {
                                Directory.CreateDirectory(dir);
                            }
                            if (File.Exists(rutaLnk))
                            {
                                try { File.SetAttributes(rutaLnk, FileAttributes.Normal); } catch { }
                            }
                            dynamic sc = shell.CreateShortcut(rutaLnk);
                            sc.TargetPath = target;
                            if (!string.IsNullOrEmpty(args)) sc.Arguments = args;
                            if (File.Exists(icoPath)) sc.IconLocation = $"{icoPath},0";
                            sc.Description = machineId > 0 
                                ? $"Pallets WW - Servidor {cleanServer} (Máquina {machineId})"
                                : $"Pallets WW - Servidor {cleanServer}";
                            sc.Save();
                            Log($"Acceso directo actualizado: '{rutaLnk}' -> {url}");
                        }
                        catch (Exception ex)
                        {
                            Log($"Error al guardar acceso '{rutaLnk}': {ex.Message}");
                        }
                    }

                    void LimpiarAccesosDuplicados(string dirPath, string currentLnkName)
                    {
                        try
                        {
                            if (!Directory.Exists(dirPath)) return;
                            foreach (var lnk in Directory.GetFiles(dirPath, "*.lnk"))
                            {
                                string fn = Path.GetFileName(lnk);
                                if (fn.Equals(currentLnkName, StringComparison.OrdinalIgnoreCase)) continue;

                                if (fn.StartsWith("Pallets WW", StringComparison.OrdinalIgnoreCase) || 
                                    fn.StartsWith("Pallets Wet Wipes", StringComparison.OrdinalIgnoreCase))
                                {
                                    try
                                    {
                                        dynamic sc = shell.CreateShortcut(lnk);
                                        if (EsAccesoDirectoLegacy(sc))
                                        {
                                            RepararAccesoLegacySiEsNecesario(sc, lnk);
                                            continue;
                                        }
                                    }
                                    catch { }

                                    try { File.Delete(lnk); Log($"Acceso duplicado eliminado: '{lnk}'"); } catch { }
                                }
                            }
                        }
                        catch { }
                    }

                    void ActualizarLnkExistentes(string dirPath, string currentLnkName, bool recurse = false)
                    {
                        try
                        {
                            if (!Directory.Exists(dirPath)) return;
                            var searchOpt = recurse ? SearchOption.AllDirectories : SearchOption.TopDirectoryOnly;
                            foreach (var lnk in Directory.GetFiles(dirPath, "*.lnk", searchOpt))
                            {
                                try
                                {
                                    dynamic scLnk = shell.CreateShortcut(lnk);

                                    // Si es app legacy, proteger y reparar si es necesario
                                    if (EsAccesoDirectoLegacy(scLnk))
                                    {
                                        RepararAccesoLegacySiEsNecesario(scLnk, lnk);
                                        continue;
                                    }

                                    string curArgs = scLnk.Arguments?.ToString() ?? "";
                                    string curTarget = scLnk.TargetPath?.ToString() ?? "";
                                    string fn = Path.GetFileName(lnk);

                                    bool esAccesoWeb = curArgs.Contains(":5106") || curTarget.Contains(":5106") || curArgs.Contains("http") ||
                                                       (fn.Equals(currentLnkName, StringComparison.OrdinalIgnoreCase) && 
                                                        (curTarget.Contains("msedge", StringComparison.OrdinalIgnoreCase) || 
                                                         curTarget.Contains("chrome", StringComparison.OrdinalIgnoreCase)));

                                    if (esAccesoWeb)
                                    {
                                        try { File.SetAttributes(lnk, FileAttributes.Normal); } catch { }
                                        scLnk.TargetPath = target;
                                        scLnk.Arguments = args;
                                        if (File.Exists(icoPath)) scLnk.IconLocation = $"{icoPath},0";
                                        scLnk.Description = machineId > 0 
                                            ? $"Pallets WW - Servidor {cleanServer} (Máquina {machineId})"
                                            : $"Pallets WW - Servidor {cleanServer}";
                                        scLnk.Save();
                                        Log($"Acceso existente actualizado: '{lnk}' -> {url}");
                                    }
                                }
                                catch { }
                            }
                        }
                        catch { }
                    }

                    // 1. Acceso Maestro en AppDataDir (C:\ProgramData\PalletsWW_ZebraBridge\Pallets WW.lnk)
                    GuardarAcceso(Path.Combine(AppDataDir, "Pallets WW.lnk"));

                    // 2. Limpiar Escritorio Público para evitar icono duplicado con el escritorio del usuario
                    string commonDesktop = Environment.GetFolderPath(Environment.SpecialFolder.CommonDesktopDirectory);
                    if (!string.IsNullOrEmpty(commonDesktop) && Directory.Exists(commonDesktop))
                    {
                        string oldCommonDesk = Path.Combine(commonDesktop, "Pallets WW.lnk");
                        if (File.Exists(oldCommonDesk)) { try { File.Delete(oldCommonDesk); } catch { } }
                        LimpiarAccesosDuplicados(commonDesktop, "Pallets WW.lnk");
                    }

                    // 3. Menú Inicio Público (Universal para búsqueda de Windows)
                    string commonPrograms = Environment.GetFolderPath(Environment.SpecialFolder.CommonPrograms);
                    if (!string.IsNullOrEmpty(commonPrograms) && Directory.Exists(commonPrograms))
                    {
                        GuardarAcceso(Path.Combine(commonPrograms, "Pallets WW.lnk"));
                    }

                    // 4. Limpiar CommonStartup (Previene apertura doble)
                    string commonStartup = Environment.GetFolderPath(Environment.SpecialFolder.CommonStartup);
                    if (!string.IsNullOrEmpty(commonStartup) && Directory.Exists(commonStartup))
                    {
                        string oldStartup = Path.Combine(commonStartup, "Pallets WW.lnk");
                        if (File.Exists(oldStartup)) { try { File.Delete(oldStartup); } catch { } }
                    }

                    // 5. Escritorio y TaskBar del usuario en sesión
                    string desktop = Environment.GetFolderPath(Environment.SpecialFolder.Desktop);
                    if (!string.IsNullOrEmpty(desktop) && Directory.Exists(desktop))
                    {
                        LimpiarAccesosDuplicados(desktop, "Pallets WW.lnk");
                        GuardarAcceso(Path.Combine(desktop, "Pallets WW.lnk"));
                    }

                    string currentAppData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
                    string taskbarDir = Path.Combine(currentAppData, @"Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar");
                    if (Directory.Exists(taskbarDir))
                    {
                        if (pinTaskbar)
                        {
                            GuardarAcceso(Path.Combine(taskbarDir, "Pallets WW.lnk"));
                        }
                        ActualizarLnkExistentes(taskbarDir, "Pallets WW.lnk");
                    }

                    // Anclar automáticamente a la barra de tareas de la sesión activa si está habilitado
                    if (pinTaskbar && !string.IsNullOrEmpty(desktop))
                    {
                        AnclarABarraDeTareasShell(desktop, "Pallets WW.lnk");
                    }

                    // Reparar cualquier residuo en la carpeta de usuario actual
                    RepararCacheImplicitAppShortcuts(Path.GetDirectoryName(Path.GetDirectoryName(currentAppData)) ?? "");

                    // 6. Recorrer perfiles en C:\Users para sincronizar Escritorio, Taskbar y Menú Inicio
                    string usersDir = @"C:\Users";
                    if (Directory.Exists(usersDir))
                    {
                        foreach (var uDir in Directory.GetDirectories(usersDir))
                        {
                            try
                            {
                                string uName = Path.GetFileName(uDir);
                                if (uName.Equals("Public", StringComparison.OrdinalIgnoreCase) ||
                                    uName.Equals("All Users", StringComparison.OrdinalIgnoreCase) ||
                                    uName.Equals("Default User", StringComparison.OrdinalIgnoreCase))
                                {
                                    continue;
                                }

                                // Escritorio del usuario (Limpiar duplicados y colocar exactamente 1 icono)
                                string uDesk = Path.Combine(uDir, "Desktop");
                                if (Directory.Exists(uDesk))
                                {
                                    LimpiarAccesosDuplicados(uDesk, "Pallets WW.lnk");
                                    GuardarAcceso(Path.Combine(uDesk, "Pallets WW.lnk"));
                                }

                                // TaskBar del usuario
                                string uTb = Path.Combine(uDir, @"AppData\Roaming\Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar");
                                if (Directory.Exists(uTb))
                                {
                                    if (pinTaskbar)
                                    {
                                        GuardarAcceso(Path.Combine(uTb, "Pallets WW.lnk"));
                                    }
                                    ActualizarLnkExistentes(uTb, "Pallets WW.lnk");
                                }

                                // Reparar caché interna de Windows en el perfil del usuario
                                RepararCacheImplicitAppShortcuts(uDir);

                                // Menú Inicio del usuario
                                string uPrograms = Path.Combine(uDir, @"AppData\Roaming\Microsoft\Windows\Start Menu\Programs");
                                if (Directory.Exists(uPrograms))
                                {
                                    GuardarAcceso(Path.Combine(uPrograms, "Pallets WW.lnk"));
                                }
                            }
                            catch { }
                        }
                    }

                    // Forzar a Windows a actualizar su caché de iconos
                    RefrescarIconosWindows();
                }
            }
        }
        catch (Exception ex)
        {
            Log($"Error al actualizar accesos directos: {ex.Message}");
        }
    }

    private static string DetectarImpresora()
    {
        try
        {
            if (File.Exists(SettingsFile))
            {
                var doc = JsonDocument.Parse(File.ReadAllText(SettingsFile, Encoding.UTF8));
                if (doc.RootElement.TryGetProperty("printerName", out var pProp))
                {
                    string pName = pProp.GetString() ?? "";
                    if (!string.IsNullOrWhiteSpace(pName) && ProbarImpresora(pName))
                    {
                        return pName;
                    }
                }
            }
        }
        catch { }

        var candidatos = new[]
        {
            "Generic / Text Only",
            "Genérico / Solo texto",
            "Generic tex",
            "ZDesigner",
            "Zebra"
        };
        var instaladas = ObtenerImpresorasInstaladas();
        foreach (var c in candidatos)
        {
            var match = instaladas.FirstOrDefault(i => i.IndexOf(c, StringComparison.OrdinalIgnoreCase) >= 0);
            if (!string.IsNullOrEmpty(match) && ProbarImpresora(match))
            {
                return match;
            }
        }

        try
        {
            var ps = new System.Drawing.Printing.PrinterSettings();
            if (!string.IsNullOrEmpty(ps.PrinterName) && ProbarImpresora(ps.PrinterName))
            {
                return ps.PrinterName;
            }
        }
        catch { }

        return "Generic / Text Only";
    }

    private static List<string> ObtenerImpresorasInstaladas()
    {
        var lista = new List<string>();
        try
        {
            foreach (string p in System.Drawing.Printing.PrinterSettings.InstalledPrinters)
            {
                lista.Add(p);
            }
        }
        catch { }
        return lista;
    }

    private static bool ProbarImpresora(string printerName)
    {
        try
        {
            if (OpenPrinter(printerName, out IntPtr hPrinter, IntPtr.Zero))
            {
                ClosePrinter(hPrinter);
                return true;
            }
        }
        catch { }
        return false;
    }

    private static string ExtraerZpl(string body)
    {
        if (string.IsNullOrWhiteSpace(body)) return "";
        body = body.Trim();
        if (body.StartsWith("{") && body.EndsWith("}"))
        {
            try
            {
                using var doc = JsonDocument.Parse(body);
                if (doc.RootElement.TryGetProperty("zpl", out var zplProp))
                    return zplProp.GetString() ?? "";
                if (doc.RootElement.TryGetProperty("data", out var dataProp))
                    return dataProp.GetString() ?? "";
            }
            catch { }
        }
        return body;
    }

    private static bool ImprimirPorRed(string ip, int puerto, string zpl, out string mensaje)
    {
        try
        {
            Log($"[RED] Conectando a impresora Zebra en {ip}:{puerto}...");
            using var client = new TcpClient();
            var connectTask = client.ConnectAsync(ip, puerto);
            if (!connectTask.Wait(3000))
            {
                mensaje = $"Tiempo de espera agotado (3s) al conectar a impresora de red {ip}:{puerto}. Verifique encendido y cable de red.";
                Log($"[ERROR RED] {mensaje}");
                return false;
            }

            using var stream = client.GetStream();
            stream.WriteTimeout = 5000;

            byte[] bytes;
            try
            {
                bytes = Encoding.GetEncoding(1252).GetBytes(zpl);
            }
            catch
            {
                bytes = Encoding.UTF8.GetBytes(zpl);
            }

            stream.Write(bytes, 0, bytes.Length);
            stream.Flush();

            mensaje = $"Etiqueta impresa exitosamente en impresora de red {ip}:{puerto} ({bytes.Length} bytes RAW).";
            Log($"[OK RED] {mensaje}");
            return true;
        }
        catch (Exception ex)
        {
            mensaje = $"Error al imprimir en impresora de red {ip}:{puerto}: {ex.Message}";
            Log($"[ERROR RED] {mensaje}");
            return false;
        }
    }

    private static bool ProbarConexionImpresoraRed(string ip, int puerto, out string mensaje)
    {
        if (string.IsNullOrWhiteSpace(ip))
        {
            mensaje = "Dirección IP no especificada";
            return false;
        }

        try
        {
            using var client = new TcpClient();
            var connectTask = client.ConnectAsync(ip, puerto);
            if (!connectTask.Wait(2000))
            {
                mensaje = $"Sin respuesta en {ip}:{puerto} (Timeout 2s)";
                return false;
            }
            mensaje = $"En línea (Conexión TCP {ip}:{puerto} exitosa)";
            return true;
        }
        catch (Exception ex)
        {
            mensaje = $"No disponible ({ex.Message})";
            return false;
        }
    }
    private static bool ImprimirDual(string printerName, string zpl, out string mensaje)
    {
        bool isGenericText = printerName.IndexOf("Generic", StringComparison.OrdinalIgnoreCase) >= 0 ||
                             printerName.IndexOf("Genérico", StringComparison.OrdinalIgnoreCase) >= 0 ||
                             printerName.IndexOf("Generico", StringComparison.OrdinalIgnoreCase) >= 0 ||
                             printerName.IndexOf("Text", StringComparison.OrdinalIgnoreCase) >= 0 ||
                             printerName.IndexOf("Texto", StringComparison.OrdinalIgnoreCase) >= 0;

        if (isGenericText)
        {
            Log($"Imprimiendo en '{printerName}' usando GDI PrintDocument (Modo Texto Legacy)...");
            if (ImprimirConPrintDocument(printerName, zpl, out mensaje))
            {
                return true;
            }

            Log($"Aviso: GDI PrintDocument falló ({mensaje}). Reintentando con WinSpooler RAW...");
            return ImprimirRawWinSpool(printerName, zpl, out mensaje);
        }
        else
        {
            Log($"Imprimiendo en '{printerName}' usando WinSpooler RAW (ZDesigner / Zebra)...");
            if (ImprimirRawWinSpool(printerName, zpl, out mensaje))
            {
                return true;
            }

            Log($"Aviso: WinSpooler RAW falló ({mensaje}). Reintentando con GDI PrintDocument...");
            return ImprimirConPrintDocument(printerName, zpl, out mensaje);
        }
    }

    private static bool ImprimirConPrintDocument(string printerName, string text, out string msg)
    {
        try
        {
            using var prn = new PrintDocument();
            prn.PrinterSettings.PrinterName = printerName;
            prn.PrintController = new StandardPrintController();
            prn.PrintPage += (sender, args) =>
            {
                using var myFont = new Font("Microsoft Sans Serif", 10);
                args.Graphics?.DrawString(text, myFont, Brushes.Black, 50, 50);
            };
            prn.Print();
            msg = $"Etiqueta impresa con éxito en '{printerName}' vía PrintDocument GDI.";
            Log(msg);
            return true;
        }
        catch (Exception ex)
        {
            msg = $"Excepción PrintDocument en '{printerName}': {ex.Message}";
            Log(msg);
            return false;
        }
    }

    private static bool ImprimirRawWinSpool(string printerName, string zpl, out string mensaje)
    {
        IntPtr hPrinter = IntPtr.Zero;
        IntPtr pUnmanagedBytes = IntPtr.Zero;

        try
        {
            if (!OpenPrinter(printerName, out hPrinter, IntPtr.Zero))
            {
                int err = Marshal.GetLastWin32Error();
                mensaje = $"No se pudo abrir la impresora '{printerName}'. Error Win32: {err}.";
                return false;
            }

            var di = new DOCINFOW
            {
                pDocName = $"Pallet_ZPL_{DateTime.Now:HHmmss}",
                pDataType = "RAW"
            };

            if (!StartDocPrinter(hPrinter, 1, di))
            {
                int err = Marshal.GetLastWin32Error();
                mensaje = $"Fallo al iniciar documento RAW en '{printerName}'. Error Win32: {err}.";
                return false;
            }

            if (!StartPagePrinter(hPrinter))
            {
                int err = Marshal.GetLastWin32Error();
                EndDocPrinter(hPrinter);
                mensaje = $"Fallo al iniciar página en '{printerName}'. Error Win32: {err}.";
                return false;
            }

            byte[] bytes;
            try
            {
                bytes = Encoding.GetEncoding(1252).GetBytes(zpl);
            }
            catch
            {
                bytes = Encoding.UTF8.GetBytes(zpl);
            }

            pUnmanagedBytes = Marshal.AllocCoTaskMem(bytes.Length);
            Marshal.Copy(bytes, 0, pUnmanagedBytes, bytes.Length);

            if (!WritePrinter(hPrinter, pUnmanagedBytes, bytes.Length, out int dwWritten))
            {
                int err = Marshal.GetLastWin32Error();
                EndPagePrinter(hPrinter);
                EndDocPrinter(hPrinter);
                mensaje = $"Error al enviar bytes a '{printerName}'. Error Win32: {err}.";
                return false;
            }

            EndPagePrinter(hPrinter);
            EndDocPrinter(hPrinter);

            mensaje = $"Etiqueta impresa con éxito en '{printerName}' ({dwWritten} bytes enviados vía RAW).";
            Log(mensaje);
            return true;
        }
        catch (Exception ex)
        {
            mensaje = $"Excepción al imprimir RAW en '{printerName}': {ex.Message}";
            Log(mensaje);
            return false;
        }
        finally
        {
            if (pUnmanagedBytes != IntPtr.Zero)
            {
                Marshal.FreeCoTaskMem(pUnmanagedBytes);
            }
            if (hPrinter != IntPtr.Zero)
            {
                ClosePrinter(hPrinter);
            }
        }
    }

    private static void Log(string mensaje)
    {
        try
        {
            if (!Directory.Exists(AppDataDir))
            {
                Directory.CreateDirectory(AppDataDir);
            }
            string line = $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] {mensaje}{Environment.NewLine}";
            File.AppendAllText(LogFile, line, Encoding.UTF8);
        }
        catch { }
    }
}