using System.Runtime.Versioning;
using System.Runtime.InteropServices;
using System.Text;

namespace PalletsWW_PC.Api.Services;

[SupportedOSPlatform("windows")]
public class UsbPrintService : IUsbPrintService
{
    private readonly IConfiguration _config;
    private readonly ILogger<UsbPrintService> _logger;

    public UsbPrintService(IConfiguration config, ILogger<UsbPrintService> logger)
    {
        _config = config;
        _logger = logger;
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
    private class DOCINFOA
    {
        [MarshalAs(UnmanagedType.LPStr)]
        public string pDocName = "Etiqueta Pallet WW";
        [MarshalAs(UnmanagedType.LPStr)]
        public string? pOutputFile = null;
        [MarshalAs(UnmanagedType.LPStr)]
        public string pDataType = "RAW";
    }

    [DllImport("winspool.Drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    private static extern bool OpenPrinter([MarshalAs(UnmanagedType.LPStr)] string szPrinter, out IntPtr hPrinter, IntPtr pd);

    [DllImport("winspool.Drv", EntryPoint = "ClosePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    private static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    private static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);

    [DllImport("winspool.Drv", EntryPoint = "EndDocPrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    private static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "StartPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    private static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "EndPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    private static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "WritePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    private static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);

    public (bool Conectada, string NombreImpresora, string Mensaje) VerificarEstadoImpresora()
    {
        string printerConfig = _config["PrinterSettings:PrinterName"] ?? "Generic / Text Only";
        string? printerName = ResolverNombreImpresora(printerConfig);

        if (!string.IsNullOrEmpty(printerName) && ProbarImpresora(printerName))
        {
            return (true, printerName, $"Impresora '{printerName}' detectada y lista.");
        }

        return (false, string.Empty, "No se detectó ninguna impresora compatible ('Generic / Text Only', 'Generic tex', 'Genérico / Solo texto' o 'Zebra'). Verifique conexión USB y encendido.");
    }

    private string? ResolverNombreImpresora(string configurado)
    {
        // 1. Probar nombre configurado
        if (ProbarImpresora(configurado)) return configurado;

        // 2. Probar variantes comunes de impresoras de texto y Zebra
        var variantes = new[]
        {
            "Generic / Text Only",
            "Generic tex",
            "Genérico / Solo texto",
            "Generic text",
            "Generic / Texto solo",
            "Generico / Solo texto",
            "Zebra",
            "Impresora Zebra"
        };

        foreach (var v in variantes)
        {
            if (ProbarImpresora(v))
            {
                _logger.LogInformation("Impresora USB detectada automáticamente por variante conocida: '{PrinterName}'", v);
                return v;
            }
        }

        // 3. Buscar en el registro de Windows cualquier impresora que contenga palabras clave
        try
        {
            var listaPrinters = new List<string>();
            using (var key = Microsoft.Win32.Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows NT\CurrentVersion\PrinterPorts"))
            {
                if (key != null) listaPrinters.AddRange(key.GetValueNames());
            }
            using (var key = Microsoft.Win32.Registry.LocalMachine.OpenSubKey(@"SYSTEM\CurrentControlSet\Control\Print\Printers"))
            {
                if (key != null) listaPrinters.AddRange(key.GetSubKeyNames());
            }

            foreach (var p in listaPrinters.Distinct(StringComparer.OrdinalIgnoreCase))
            {
                if (p.Contains("Generic", StringComparison.OrdinalIgnoreCase) ||
                    p.Contains("Genérico", StringComparison.OrdinalIgnoreCase) ||
                    p.Contains("Generico", StringComparison.OrdinalIgnoreCase) ||
                    p.Contains("Text", StringComparison.OrdinalIgnoreCase) ||
                    p.Contains("Texto", StringComparison.OrdinalIgnoreCase) ||
                    p.Contains("Zebra", StringComparison.OrdinalIgnoreCase))
                {
                    if (ProbarImpresora(p))
                    {
                        _logger.LogInformation("Impresora USB detectada en registro de Windows: '{PrinterName}'", p);
                        return p;
                    }
                }
            }
        }
        catch { }

        return null;
    }

    private static bool ProbarImpresora(string name)
    {
        if (string.IsNullOrWhiteSpace(name)) return false;
        if (OpenPrinter(name, out IntPtr hPrinter, IntPtr.Zero))
        {
            ClosePrinter(hPrinter);
            return true;
        }
        return false;
    }

    public Task<(bool Exitoso, string Mensaje)> EnviarZplAImpresoraUsbAsync(string codigoZpl)
    {
        string printerConfig = _config["PrinterSettings:PrinterName"] ?? "Generic / Text Only";
        string? printerName = ResolverNombreImpresora(printerConfig);

        if (string.IsNullOrEmpty(printerName))
        {
            return Task.FromResult((false, "No se encontró ninguna impresora USB compatible conectada ('Generic / Text Only', 'Generic tex', 'Genérico / Solo texto' o 'Zebra'). Verifique que el cable esté conectado y la impresora encendida."));
        }

        return Task.Run(() =>
        {
            IntPtr hPrinter = IntPtr.Zero;
            IntPtr pUnmanagedBytes = IntPtr.Zero;

            try
            {
                if (!OpenPrinter(printerName, out hPrinter, IntPtr.Zero))
                {
                    int err = Marshal.GetLastWin32Error();
                    _logger.LogError("No se pudo abrir la impresora USB '{PrinterName}'. Error Win32: {Error}", printerName, err);
                    return (false, $"No se pudo abrir la impresora USB '{printerName}'. Error Win32: {err}");
                }

                var di = new DOCINFOA();
                if (!StartDocPrinter(hPrinter, 1, di))
                {
                    return (false, "Error al iniciar el documento de impresión en el Spooler de Windows.");
                }

                if (!StartPagePrinter(hPrinter))
                {
                    EndDocPrinter(hPrinter);
                    return (false, "Error al iniciar página de impresión.");
                }

                byte[] bytes = Encoding.UTF8.GetBytes(codigoZpl);
                pUnmanagedBytes = Marshal.AllocCoTaskMem(bytes.Length);
                Marshal.Copy(bytes, 0, pUnmanagedBytes, bytes.Length);

                bool success = WritePrinter(hPrinter, pUnmanagedBytes, bytes.Length, out int written);

                EndPagePrinter(hPrinter);
                EndDocPrinter(hPrinter);

                if (!success || written != bytes.Length)
                {
                    return (false, "No se enviaron todos los bytes a la impresora USB.");
                }

                _logger.LogInformation("Etiqueta ZPL enviada con éxito a la impresora USB '{PrinterName}' ({Bytes} bytes)", printerName, written);
                return (true, $"Etiqueta enviada correctamente a la impresora USB '{printerName}'.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Excepción al imprimir vía USB en {PrinterName}", printerName);
                return (false, $"Error al enviar a impresora USB: {ex.Message}");
            }
            finally
            {
                if (pUnmanagedBytes != IntPtr.Zero) Marshal.FreeCoTaskMem(pUnmanagedBytes);
                if (hPrinter != IntPtr.Zero) ClosePrinter(hPrinter);
            }
        });
    }
}
