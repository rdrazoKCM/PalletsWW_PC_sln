using System.Runtime.InteropServices.ComTypes;
using System.Runtime.InteropServices;
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Reflection;
using System.Security.AccessControl;
using System.Security.Principal;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace PalletsWW_ClientSetup;

public record MachineItem(int Id, string Code, string DisplayName);

public static class InstallerEngine
{
    public static readonly string ProgramDataFolder = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "PalletsWW_ZebraBridge");
    public const string DefaultServerIp = "10.26.24.31";

    public static readonly List<MachineItem> AvailableMachines = new()
    {
        new(9,  "TXWW1",  "Línea 1 (TXWW1)"),
        new(16, "TXWW2",  "Línea 2 (TXWW2)"),
        new(53, "TXWW3",  "Línea 3 (TXWW3)"),
        new(54, "TXWW4",  "Línea 4 (TXWW4)"),
        new(55, "TXWW5",  "Línea 5 (TXWW5)"),
        new(67, "TXWW6",  "Línea 6 (TXWW6)"),
        new(70, "TXWW7",  "Línea 7 (TXWW7)"),
        new(11, "POCKET", "Línea Pocket Wipes (POCKET)")
    };

    public static List<string> DetectLocalUserProfiles()
    {
        var users = new List<string>();
        try
        {
            string usersDir = @"C:\Users";
            if (Directory.Exists(usersDir))
            {
                foreach (var d in Directory.GetDirectories(usersDir))
                {
                    string name = Path.GetFileName(d);
                    if (name.Equals("Public", StringComparison.OrdinalIgnoreCase) ||
                        name.Equals("All Users", StringComparison.OrdinalIgnoreCase) ||
                        name.Equals("Default", StringComparison.OrdinalIgnoreCase) ||
                        name.Equals("Default User", StringComparison.OrdinalIgnoreCase) ||
                        name.Equals("desktop.ini", StringComparison.OrdinalIgnoreCase))
                    {
                        continue;
                    }
                    users.Add(name);
                }
            }
        }
        catch { }

        if (users.Count == 0 && !string.IsNullOrEmpty(Environment.UserName))
        {
            users.Add(Environment.UserName);
        }

        return users;
    }

    public static (int MachineId, string Source) DetectConfiguredMachine()
    {
        try
        {
            string legacyPath = @"C:\ArchivosBitacoraAut\Maquina.txt";
            if (File.Exists(legacyPath))
            {
                string text = File.ReadAllText(legacyPath).Trim();
                if (int.TryParse(text, out int mId) && mId > 0)
                {
                    int resolvedId = ResolveMachineNumberOrId(mId);
                    return (resolvedId, $"Maquina.txt ({text})");
                }
            }
        }
        catch { }

        try
        {
            string sharedCfg = Path.Combine(ProgramDataFolder, "settings.json");
            if (File.Exists(sharedCfg))
            {
                using var doc = JsonDocument.Parse(File.ReadAllText(sharedCfg, Encoding.UTF8));
                if (doc.RootElement.TryGetProperty("machineId", out var prop) && prop.GetInt32() > 0)
                {
                    return (prop.GetInt32(), "settings.json (ProgramData)");
                }
            }
        }
        catch { }

        try
        {
            string localCfg = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "PalletsWW_ZebraBridge", "settings.json");
            if (File.Exists(localCfg))
            {
                using var doc = JsonDocument.Parse(File.ReadAllText(localCfg, Encoding.UTF8));
                if (doc.RootElement.TryGetProperty("machineId", out var prop) && prop.GetInt32() > 0)
                {
                    return (prop.GetInt32(), "settings.json (LocalAppData)");
                }
            }
        }
        catch { }

        return (0, "No detectada");
    }

    public static int ResolveMachineNumberOrId(int input)
    {
        if (AvailableMachines.Any(m => m.Id == input)) return input;

        return input switch
        {
            1 => 9,
            2 => 16,
            3 => 53,
            4 => 54,
            5 => 55,
            6 => 67,
            7 => 70,
            _ => input
        };
    }

    public static string DetectConfiguredServer()
    {
        // 1. PRIMERO consultar la configuración compartida real del equipo (settings.json)
        try
        {
            string sharedCfg = Path.Combine(ProgramDataFolder, "settings.json");
            if (File.Exists(sharedCfg))
            {
                using var doc = JsonDocument.Parse(File.ReadAllText(sharedCfg, Encoding.UTF8));
                if (doc.RootElement.TryGetProperty("serverIp", out var prop))
                {
                    string ip = prop.GetString() ?? "";
                    if (!string.IsNullOrEmpty(ip)) return ip.Trim();
                }
            }
        }
        catch { }

        // 2. Si no hay configuración previa en el equipo, verificar si el instalador vino con Servidor.txt
        try
        {
            string srvFile = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Servidor.txt");
            if (File.Exists(srvFile))
            {
                string ip = File.ReadAllText(srvFile).Trim();
                if (!string.IsNullOrEmpty(ip)) return ip;
            }
        }
        catch { }

        return DefaultServerIp;
    }

    public static (string PrintMode, string PrinterIp, int PrinterPort) DetectConfiguredPrinter()
    {
        try
        {
            string sharedCfg = Path.Combine(ProgramDataFolder, "settings.json");
            if (File.Exists(sharedCfg))
            {
                using var doc = JsonDocument.Parse(File.ReadAllText(sharedCfg, Encoding.UTF8));
                string mode = doc.RootElement.TryGetProperty("printMode", out var mProp) ? mProp.GetString() ?? "USB" : "USB";
                string ip = doc.RootElement.TryGetProperty("printerIp", out var ipProp) ? ipProp.GetString() ?? "" : "";
                int port = doc.RootElement.TryGetProperty("printerPort", out var pProp) && pProp.GetInt32() > 0 ? pProp.GetInt32() : 9100;
                return (mode, ip, port);
            }
        }
        catch { }

        return ("USB", "", 9100);
    }

    public static async Task<(bool Success, string Message)> TestNetworkPrinterAsync(string ip, int port)
    {
        if (string.IsNullOrWhiteSpace(ip)) return (false, "La dirección IP no puede estar vacía.");
        try
        {
            using var tcp = new System.Net.Sockets.TcpClient();
            var connectTask = tcp.ConnectAsync(ip.Trim(), port > 0 ? port : 9100);
            var timeoutTask = Task.Delay(2500);
            var completed = await Task.WhenAny(connectTask, timeoutTask);
            if (completed == connectTask && tcp.Connected)
            {
                return (true, $"Conexión exitosa con la impresora Zebra en {ip}:{port} (Socket TCP 9100 Abierto).");
            }
            return (false, $"Tiempo de espera agotado (2.5s) al conectar con {ip}:{port}. Verifique que la impresora esté encendida y conectada a la red.");
        }
        catch (Exception ex)
        {
            return (false, $"Error al conectar con {ip}:{port}: {ex.Message}");
        }
    }

    
    [ComImport]
    [Guid("00021401-0000-0000-C000-000000000046")]
    private class ShellLinkClass { }

    [ComImport]
    [Guid("000214EE-0000-0000-C000-000000000046")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IShellLinkW
    {
        void GetPath([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder pszFile, int cchMaxPath, out IntPtr pfd, int fFlags);
        void GetIDList(out IntPtr ppidl);
        void SetIDList(IntPtr pidl);
        void GetDescription([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder pszName, int cchMaxName);
        void SetDescription([MarshalAs(UnmanagedType.LPWStr)] string pszName);
        void GetWorkingDirectory([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder pszDir, int cchMaxPath);
        void SetWorkingDirectory([MarshalAs(UnmanagedType.LPWStr)] string pszDir);
        void GetArguments([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder pszArgs, int cchMaxPath);
        void SetArguments([MarshalAs(UnmanagedType.LPWStr)] string pszArgs);
        void GetHotkey(out short pwHotkey);
        void SetHotkey(short wHotkey);
        void GetShowCmd(out int piShowCmd);
        void SetShowCmd(int iShowCmd);
        void GetIconLocation([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder pszIconPath, int cchIconPath, out int piIcon);
        void SetIconLocation([MarshalAs(UnmanagedType.LPWStr)] string pszIconPath, int iIcon);
        void SetRelativePath([MarshalAs(UnmanagedType.LPWStr)] string pszPathRel, int dwReserved);
        void Resolve(IntPtr hwnd, int fFlags);
        void SetPath([MarshalAs(UnmanagedType.LPWStr)] string pszFile);
    }

    [ComImport]
    [Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IPropertyStore
    {
        int GetCount(out uint cProps);
        int GetAt(uint iProp, out PROPERTYKEY pkey);
        int GetValue(ref PROPERTYKEY key, out PROPVARIANT pv);
        int SetValue(ref PROPERTYKEY key, ref PROPVARIANT pv);
        int Commit();
    }

    [StructLayout(LayoutKind.Sequential, Pack = 4)]
    private struct PROPERTYKEY
    {
        public Guid fmtid;
        public uint pid;
        public PROPERTYKEY(Guid f, uint p) { fmtid = f; pid = p; }
    }

    [StructLayout(LayoutKind.Explicit)]
    private struct PROPVARIANT
    {
        [FieldOffset(0)] public ushort vt;
        [FieldOffset(8)] public IntPtr pwszVal;

        public static PROPVARIANT FromString(string val)
        {
            return new PROPVARIANT
            {
                vt = 31, // VT_LPWSTR
                pwszVal = Marshal.StringToCoTaskMemUni(val)
            };
        }
    }

    private static readonly PROPERTYKEY PKEY_AppUserModel_ID = new PROPERTYKEY(new Guid("9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3"), 5);

    public static void SetShortcutAppUserModelId(string lnkPath, string appId)
    {
        try
        {
            if (!File.Exists(lnkPath)) return;
            var link = (IShellLinkW)new ShellLinkClass();
            ((IPersistFile)link).Load(lnkPath, 0x00000002 /* STGM_READWRITE */);

            var store = (IPropertyStore)link;
            var pv = PROPVARIANT.FromString(appId);
            var key = PKEY_AppUserModel_ID;
            store.SetValue(ref key, ref pv);
            store.Commit();

            ((IPersistFile)link).Save(lnkPath, true);
        }
        catch { }
    }

    private static void ConfigurarLayoutXml(string userProfileDir, string shortcutFileName)
    {
        try
        {
            string shellDir = Path.Combine(userProfileDir, @"AppData\Local\Microsoft\Windows\Shell");
            if (!Directory.Exists(shellDir)) Directory.CreateDirectory(shellDir);

            string commonProgLnk = @"%ALLUSERSPROFILE%\Microsoft\Windows\Start Menu\Programs\" + shortcutFileName;

            string xmlContent = $@"<?xml version=""1.0"" encoding=""utf-8""?>
<LayoutModificationTemplate
    xmlns=""http://schemas.microsoft.com/Start/2014/LayoutModification""
    xmlns:defaultlayout=""http://schemas.microsoft.com/Start/2014/FullDefaultLayout""
    xmlns:start=""http://schemas.microsoft.com/Start/2014/StartLayout""
    xmlns:taskbar=""http://schemas.microsoft.com/Start/2014/TaskbarLayout""
    Version=""1"">
  <CustomTaskbarLayoutCollection>
    <defaultlayout:TaskbarLayout>
      <taskbar:TaskbarPinList>
        <taskbar:DesktopApp DesktopApplicationLinkPath=""{commonProgLnk}"" />
      </taskbar:TaskbarPinList>
    </defaultlayout:TaskbarLayout>
  </CustomTaskbarLayoutCollection>
</LayoutModificationTemplate>";

            // Soporte universal para Windows 10 y Windows 11
            string xmlPath1 = Path.Combine(shellDir, "LayoutModification.xml");
            File.WriteAllText(xmlPath1, xmlContent, Encoding.UTF8);
            OtorgarPermisosTotales(xmlPath1);

            string xmlPath2 = Path.Combine(shellDir, "TaskbarLayoutModification.xml");
            File.WriteAllText(xmlPath2, xmlContent, Encoding.UTF8);
            OtorgarPermisosTotales(xmlPath2);
        }
        catch { }
    }

public static async Task<bool> InstallAsync(
        int machineId,
        string serverIp,
        string printMode,
        string printerIp,
        int printerPort,
        List<string> selectedUsers,
        bool installService,
        bool autoStartup,
        bool createShortcuts,
        bool pinTaskbar,
        Action<string, int> progress)
    {
        return await Task.Run(async () =>
        {
            try
            {
                serverIp = (string.IsNullOrWhiteSpace(serverIp) ? DefaultServerIp : serverIp).Trim().Replace("http://", "").Replace("https://", "").TrimEnd('/');
                if (serverIp.Contains(":")) serverIp = serverIp.Split(':')[0];

                var machine = AvailableMachines.FirstOrDefault(m => m.Id == machineId) ?? new MachineItem(machineId, $"TXWW{machineId}", $"Línea {machineId}");

                string logFile = Path.Combine(ProgramDataFolder, "setup_install.log");
                void WriteLog(string m) {
                    try { File.AppendAllText(logFile, $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] {m}\r\n", Encoding.UTF8); } catch { }
                }
                var origProgress = progress;
                progress = (m, p) => {
                    WriteLog(m);
                    origProgress(m, p);
                };
                progress($"Iniciando instalación para {machine.DisplayName} (Servidor: {serverIp})...", 5);

                // PASO 1: Detener procesos previos y fantasmas de Edge en segundo plano
                progress("Paso 1/7: Verificando y deteniendo procesos previos...", 10);
                try
                {
                    foreach (var proc in Process.GetProcessesByName("PalletsPrintBridge"))
                    {
                        try { proc.Kill(); proc.WaitForExit(1500); } catch { }
                    }
                }
                catch { }
                try
                {
                    foreach (var proc in Process.GetProcessesByName("msedge"))
                    {
                        try { proc.Kill(); proc.WaitForExit(1000); } catch { }
                    }
                }
                catch { }
                Thread.Sleep(500);

                // PASO 2: Crear carpeta ProgramData con permisos universales
                progress($"Paso 2/7: Configurando directorio seguro en {ProgramDataFolder}...", 20);
                if (!Directory.Exists(ProgramDataFolder))
                {
                    Directory.CreateDirectory(ProgramDataFolder);
                }
                OtorgarPermisosTotales(ProgramDataFolder);

                // PASO 3: Extraer binarios embebidos (PalletsPrintBridge.exe e Icono)
                progress("Paso 3/7: Desempaquetando archivos del Agente de Impresión...", 35);
                string targetExe = Path.Combine(ProgramDataFolder, "PalletsPrintBridge.exe");
                string targetIco = Path.Combine(ProgramDataFolder, "pallets_ww.ico");

                ExtractEmbeddedResource("PalletsWW_ClientSetup.Payload.PalletsPrintBridge.exe", targetExe);
                ExtractEmbeddedResource("PalletsWW_ClientSetup.Payload.pallets_ww.ico", targetIco);
                OtorgarPermisosTotales(targetExe);
                OtorgarPermisosTotales(targetIco);

                // PASO 4: Guardar settings.json con persistencia
                progress($"Paso 4/7: Guardando configuración local de terminal ({machine.Code})...", 50);
                string settingsJson = Path.Combine(ProgramDataFolder, "settings.json");
                var cfgObj = new
                {
                    machineId = machine.Id,
                    machineName = machine.Code,
                    serverIp = serverIp,
                    printerName = "",
                    printMode = string.IsNullOrWhiteSpace(printMode) ? "USB" : printMode,
                    printerIp = printerIp ?? "",
                    printerPort = printerPort > 0 ? printerPort : 9100,
                    pinTaskbar = pinTaskbar
                };
                string jsonStr = JsonSerializer.Serialize(cfgObj, new JsonSerializerOptions { WriteIndented = true });
                try { File.WriteAllText(Path.Combine(ProgramDataFolder, "Servidor.txt"), serverIp, Encoding.UTF8); } catch { }
                try { File.WriteAllText(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Servidor.txt"), serverIp, Encoding.UTF8); } catch { }
                PurgarCacheEdgeLocal(ProgramDataFolder, progress);
                File.WriteAllText(settingsJson, jsonStr, Encoding.UTF8);
                OtorgarPermisosTotales(settingsJson);

                // PASO 5: Configurar inicio automático del servicio de impresión
                if (installService && autoStartup)
                {
                    progress("Paso 5/7: Registrando servicio en Auto-Arranque del sistema (Common Startup)...", 65);
                    string commonStartup = Environment.GetFolderPath(Environment.SpecialFolder.CommonStartup);
                    if (string.IsNullOrEmpty(commonStartup) || !Directory.Exists(commonStartup))
                    {
                        commonStartup = @"C:\ProgramData\Microsoft\Windows\Start Menu\Programs\Startup";
                    }

                    if (Directory.Exists(commonStartup))
                    {
                        string startupLnk = Path.Combine(commonStartup, "PalletsPrintBridge.lnk");
                        CrearAccesoDirectoWsh(startupLnk, targetExe, "", ProgramDataFolder, targetIco, "Agente Local Zebra USB Pallets WW (Multi-Usuario)");
                        OtorgarPermisosTotales(startupLnk);

                        // Garantizar que la app web NO esté en CommonStartup (para evitar que abra sola dos veces)
                        string staleWebStartup = Path.Combine(commonStartup, "Pallets WW.lnk");
                        if (File.Exists(staleWebStartup))
                        {
                            try { File.Delete(staleWebStartup); } catch { }
                        }
                    }

                    // Limpiar accesos duplicados en perfiles privados para evitar doble ventana
                    LimpiarIniciosPrivados();
                }

                // Iniciar servicio en segundo plano
                if (installService && File.Exists(targetExe))
                {
                    try
                    {
                        var psi = new ProcessStartInfo
                        {
                            FileName = targetExe,
                            WorkingDirectory = ProgramDataFolder,
                            UseShellExecute = true,
                            WindowStyle = ProcessWindowStyle.Hidden
                        };
                        Process.Start(psi);
                        progress("-> Servicio Zebra iniciado en segundo plano (Puerto 9100).", 70);
                    }
                    catch (Exception exStart)
                    {
                        progress($"Aviso al iniciar servicio: {exStart.Message}", 70);
                    }
                }

                // PASO 6: Crear accesos directos
                if (createShortcuts)
                {
                    progress("Paso 6/7: Optimizando directivas de Edge y creando accesos directos...", 80);
                    string appUrl = machine.Id > 0 ? $"http://{serverIp}:5106/?maquina={machine.Id}" : $"http://{serverIp}:5106/";
                    ConfigurarDirectivasNavegador(appUrl, "Pallets WW", progress);
                    progress("Paso 6/7: Creando accesos directos y anclajes para usuarios seleccionados...", 80);
                    CrearAccesosDirectosAplicacion(serverIp, machine.Id, targetIco, selectedUsers, pinTaskbar, progress);
                }

                // PASO 7: Verificar conectividad del servicio local y la impresora
                progress("Paso 7/7: Verificando salud del servicio Zebra local...", 90);
                Thread.Sleep(1200);
                await VerificarServicioLocalAsync(progress);

                if (string.Equals(printMode, "Red", StringComparison.OrdinalIgnoreCase) && !string.IsNullOrWhiteSpace(printerIp))
                {
                    progress($"-> Verificando conectividad hacia impresora de red ({printerIp}:{printerPort})...", 95);
                    var (netOk, netMsg) = await TestNetworkPrinterAsync(printerIp, printerPort);
                    if (netOk)
                    {
                        progress($"✓ Impresora de Red OK: {netMsg}", 98);
                    }
                    else
                    {
                        progress($"⚠️ Aviso Impresora de Red: {netMsg}", 98);
                    }
                }

                progress("✓ ¡INSTALACIÓN COMPLETADA CON ÉXITO! Terminal configurada y lista para operar.", 100);
                return true;
            }
            catch (Exception ex)
            {
                progress($"✗ ERROR DURANTE LA INSTALACIÓN: {ex.Message}", 0);
                return false;
            }
        });
    }

        private static void PurgarCacheEdgeLocal(string programDataFolder, Action<string, int> progress)
    {
        try
        {
            string edgeData = Path.Combine(programDataFolder, "EdgeData");
            if (Directory.Exists(edgeData))
            {
                string lsDir = Path.Combine(edgeData, @"Default\Local Storage");
                if (Directory.Exists(lsDir))
                {
                    try { Directory.Delete(lsDir, true); } catch { }
                }
                string netDir = Path.Combine(edgeData, @"Default\Network");
                if (Directory.Exists(netDir))
                {
                    try { Directory.Delete(netDir, true); } catch { }
                }
                progress("-> Almacenamiento local y cookies de Edge purgados (eliminando IPs obsoletas)...", 53);
            }
        }
        catch { }
    }

    private static void ExtractEmbeddedResource(string resourceName, string outputPath)
    {
        var asm = Assembly.GetExecutingAssembly();
        using var stream = asm.GetManifestResourceStream(resourceName);
        if (stream == null)
        {
            throw new FileNotFoundException($"No se encontró el recurso embebido '{resourceName}' en el ensamblado.");
        }

        int maxRetries = 5;
        for (int i = 0; i < maxRetries; i++)
        {
            try
            {
                using var fileStream = new FileStream(outputPath, FileMode.Create, FileAccess.Write, FileShare.None);
                stream.CopyTo(fileStream);
                return;
            }
            catch (IOException) when (i < maxRetries - 1)
            {
                Thread.Sleep(500);
            }
        }
    }

    [DllImport("shell32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    public static extern void SHChangeNotify(int wEventId, int uFlags, IntPtr dwItem1, IntPtr dwItem2);
    public const int SHCNE_ASSOCCHANGED = 0x08000000;
    public const int SHCNF_IDLIST = 0x0000;

    private static void ConfigurarDirectivasNavegador(string url, string appName, Action<string, int> progress)
    {
        try
        {
            string edgePolKey = @"Software\Policies\Microsoft\Edge";
            using var kEdge = Microsoft.Win32.Registry.LocalMachine.CreateSubKey(edgePolKey);
            if (kEdge != null)
            {
                kEdge.SetValue("StartupBoostEnabled", 0, Microsoft.Win32.RegistryValueKind.DWord);
                kEdge.SetValue("BackgroundModeEnabled", 0, Microsoft.Win32.RegistryValueKind.DWord);

                if (!string.IsNullOrEmpty(url))
                {
                    string pwaJson = $"[{{\"url\":\"{url}\",\"default_launch_container\":\"window\",\"create_desktop_shortcut\":true,\"fallback_app_name\":\"{appName}\"}}]";
                    kEdge.SetValue("WebAppInstallForceList", pwaJson, Microsoft.Win32.RegistryValueKind.String);
                }
            }
            progress("-> Directivas de Edge aplicadas para rendimiento de quiosco e identidad PWA.", 81);
        }
        catch { }
    }
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
                return true;
            }
        }
        catch { }
        return false;
    }

    private static void CrearAccesosDirectosAplicacion(
        string serverIp,
        int machineId,
        string icoPath,
        List<string> selectedUsers,
        bool pinTaskbar,
        Action<string, int> progress)
    {
        string url = machineId > 0 ? $"http://{serverIp}:5106/?maquina={machineId}" : $"http://{serverIp}:5106/";

        string edge = @"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe";
        if (!File.Exists(edge)) edge = @"C:\Program Files\Microsoft\Edge\Application\msedge.exe";
        string chrome = @"C:\Program Files\Google\Chrome\Application\chrome.exe";
        if (!File.Exists(chrome)) chrome = @"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe";

        string browserPath = File.Exists(edge) ? edge : (File.Exists(chrome) ? chrome : "");
        if (string.IsNullOrEmpty(browserPath))
        {
            progress("Aviso: No se encontró Edge ni Chrome. Creando acceso URL directo.", 82);
            browserPath = url;
        }

        const string appId = "KCM.PalletsWW";
        string userDataDir = Path.Combine(ProgramDataFolder, "EdgeData");
        try
        {
            if (!Directory.Exists(userDataDir))
            {
                Directory.CreateDirectory(userDataDir);
                OtorgarPermisosTotales(userDataDir);
            }
        }
        catch { }

        string args = !string.IsNullOrEmpty(browserPath) && browserPath != url 
            ? $"--app=\"{url}\" --window-name=\"PalletsWW\" --app-user-model-id=\"{appId}\" --user-data-dir=\"{userDataDir}\" --start-maximized"
            : "";

        string shortcutName = "Pallets WW.lnk";
        string masterLnk = Path.Combine(ProgramDataFolder, shortcutName);
        CrearAccesoDirectoWsh(masterLnk, browserPath, args, Path.GetDirectoryName(browserPath) ?? "", icoPath, $"Pallets WW - Servidor {serverIp} (Línea {machineId})", appId);
        SetShortcutAppUserModelId(masterLnk, appId);
        OtorgarPermisosTotales(masterLnk);

        // 1. Limpiar Escritorio Público para evitar duplicidad de iconos con el escritorio de los usuarios
        string commonDesk = Environment.GetFolderPath(Environment.SpecialFolder.CommonDesktopDirectory);
        if (!string.IsNullOrEmpty(commonDesk) && Directory.Exists(commonDesk))
        {
            string oldCommon = Path.Combine(commonDesk, shortcutName);
            if (File.Exists(oldCommon))
            {
                try { File.Delete(oldCommon); } catch { }
            }
            LimpiarAccesosDuplicados(commonDesk, shortcutName);
            progress("-> Escritorio Público depurado (evitando iconos duplicados).", 83);
        }

        // 2. Menú Inicio Público (Common Programs) - Permite búsqueda universal en cualquier usuario
        string commonProg = Environment.GetFolderPath(Environment.SpecialFolder.CommonPrograms);
        if (!string.IsNullOrEmpty(commonProg) && Directory.Exists(commonProg))
        {
            string commonLnk = Path.Combine(commonProg, shortcutName);
            CopiarYPermitirArchivo(masterLnk, commonLnk);
            SetShortcutAppUserModelId(commonLnk, appId);
            progress("-> Acceso colocado en Menú Inicio Público.", 84);
        }

        // 3. Limpiar cualquier remanente de Pallets WW en CommonStartup para que NUNCA abra dos veces
        string commonStartup = Environment.GetFolderPath(Environment.SpecialFolder.CommonStartup);
        if (!string.IsNullOrEmpty(commonStartup) && Directory.Exists(commonStartup))
        {
            string oldWebStartup = Path.Combine(commonStartup, shortcutName);
            if (File.Exists(oldWebStartup))
            {
                try { File.Delete(oldWebStartup); } catch { }
            }
        }

        // 4. Perfiles de usuario seleccionados en C:\Users
        string usersDir = @"C:\Users";
        foreach (var uName in selectedUsers)
        {
            string uDir = Path.Combine(usersDir, uName);
            if (!Directory.Exists(uDir)) continue;

            progress($"-> Configurando accesos para usuario '{uName}'...", 85);

            // Escritorio del usuario (Limpiar duplicados preservando app legacy y colocar exactamente 1 icono oficial)
            string uDesk = Path.Combine(uDir, "Desktop");
            if (Directory.Exists(uDesk))
            {
                LimpiarAccesosDuplicados(uDesk, shortcutName);
                string uDeskLnk = Path.Combine(uDesk, shortcutName);
                CopiarYPermitirArchivo(masterLnk, uDeskLnk);
                SetShortcutAppUserModelId(uDeskLnk, appId);
            }

            // Menú Inicio del usuario
            string uProg = Path.Combine(uDir, @"AppData\Roaming\Microsoft\Windows\Start Menu\Programs");
            if (Directory.Exists(uProg))
            {
                string uProgLnk = Path.Combine(uProg, shortcutName);
                CopiarYPermitirArchivo(masterLnk, uProgLnk);
                SetShortcutAppUserModelId(uProgLnk, appId);
            }

            // Barra de Tareas (TaskBar Pinned)
            string uTb = Path.Combine(uDir, @"AppData\Roaming\Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar");
            if (Directory.Exists(uTb))
            {
                DesanclarAccesosDuplicadosTaskbar(uTb, shortcutName);
                if (pinTaskbar)
                {
                    string uTbLnk = Path.Combine(uTb, shortcutName);
                    CopiarYPermitirArchivo(masterLnk, uTbLnk);
                    SetShortcutAppUserModelId(uTbLnk, appId);
                }
            }
            else if (pinTaskbar)
            {
                try
                {
                    Directory.CreateDirectory(uTb);
                    OtorgarPermisosTotales(uTb);
                    string uTbLnk = Path.Combine(uTb, shortcutName);
                    CopiarYPermitirArchivo(masterLnk, uTbLnk);
                    SetShortcutAppUserModelId(uTbLnk, appId);
                }
                catch { }
            }

            // Reparar cache interna de Windows (ImplicitAppShortcuts) en el perfil
            RepararCacheImplicitAppShortcuts(uDir);

            // Limpiar LayoutModification.xml para evitar que Windows auto-anexe iconos extra
            LimpiarLayoutXml(uDir);
            if (pinTaskbar) { ConfigurarLayoutXml(uDir, shortcutName); }

            // LIMPIAR cualquier residuo en Startup del usuario para garantizar 0 aperturas dobles
            string uStartup = Path.Combine(uDir, @"AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup", shortcutName);
            if (File.Exists(uStartup))
            {
                try { File.Delete(uStartup); } catch { }
            }
        }

        // Anclaje Shell a la Barra de Tareas para sesiones de usuario
        if (pinTaskbar)
        {
            try
            {
                var deskFolders = new List<string>();
                string activeDesk = Environment.GetFolderPath(Environment.SpecialFolder.Desktop);
                if (!string.IsNullOrEmpty(activeDesk) && Directory.Exists(activeDesk))
                {
                    deskFolders.Add(activeDesk);
                }

                foreach (var uName in selectedUsers)
                {
                    string uDesk = Path.Combine(usersDir, uName, "Desktop");
                    if (Directory.Exists(uDesk) && !deskFolders.Contains(uDesk, StringComparer.OrdinalIgnoreCase))
                    {
                        deskFolders.Add(uDesk);
                    }
                }

                foreach (var dPath in deskFolders)
                {
                    AnclarABarraDeTareasShell(dPath, shortcutName);
                }
                progress("-> Acceso fijado a la barra de tareas exitosamente.", 88);
            }
            catch { }
        }

        // Notificar al Shell de Windows para refrescar de inmediato la caché de iconos
        if (pinTaskbar) { ConfigurarLayoutXml(@"C:\Users\Default", shortcutName); }
        RefrescarIconosWindows();
    }

    private static void LimpiarLayoutXml(string userProfileDir)
    {
        try
        {
            string[] xmlFiles = {
                Path.Combine(userProfileDir, @"AppData\Local\Microsoft\Windows\Shell\LayoutModification.xml"),
                Path.Combine(userProfileDir, @"AppData\Local\Microsoft\Windows\Shell\TaskbarLayoutModification.xml")
            };
            foreach (var f in xmlFiles)
            {
                if (File.Exists(f))
                {
                    string xml = File.ReadAllText(f);
                    if (xml.Contains("Pallet", StringComparison.OrdinalIgnoreCase))
                    {
                        try { File.Delete(f); } catch { }
                    }
                }
            }
        }
        catch { }
    }

    private static void DesanclarAccesosDuplicadosTaskbar(string dirPath, string currentLnkName)
    {
        try
        {
            if (!Directory.Exists(dirPath)) return;
            Type? shellAppType = Type.GetTypeFromProgID("Shell.Application");
            Type? wshType = Type.GetTypeFromProgID("WScript.Shell");
            dynamic? shell = shellAppType != null ? Activator.CreateInstance(shellAppType) : null;
            dynamic? wsh = wshType != null ? Activator.CreateInstance(wshType) : null;
            dynamic? folder = shell != null ? shell.Namespace(dirPath) : null;

            foreach (var file in Directory.GetFiles(dirPath, "*.lnk"))
            {
                string fn = Path.GetFileName(file);
                if (fn.Equals(currentLnkName, StringComparison.OrdinalIgnoreCase)) continue;

                if (fn.Contains("Pallet", StringComparison.OrdinalIgnoreCase))
                {
                    if (wsh != null)
                    {
                        try
                        {
                            dynamic sc = wsh.CreateShortcut(file);
                            if (EsAccesoDirectoLegacy(sc))
                            {
                                RepararAccesoLegacySiEsNecesario(sc, file);
                                continue;
                            }
                        }
                        catch { }
                    }

                    if (folder != null)
                    {
                        try
                        {
                            dynamic item = folder.ParseName(fn);
                            if (item != null)
                            {
                                foreach (var verb in item.Verbs())
                                {
                                    string vName = verb.Name?.ToString()?.Replace("&", "")?.Trim() ?? "";
                                    if (vName.IndexOf("Desanclar de la barra de tareas", StringComparison.OrdinalIgnoreCase) >= 0 ||
                                        vName.IndexOf("Unpin from taskbar", StringComparison.OrdinalIgnoreCase) >= 0)
                                    {
                                        verb.DoIt();
                                        break;
                                    }
                                }
                            }
                        }
                        catch { }
                    }
                    try 
                    { 
                        File.SetAttributes(file, FileAttributes.Normal);
                        File.Delete(file); 
                    } 
                    catch { }
                }
            }
        }
        catch { }
    }

    private static void LimpiarIniciosPrivados()
    {
        try
        {
            string usersDir = @"C:\Users";
            if (!Directory.Exists(usersDir)) return;

            foreach (var uDir in Directory.GetDirectories(usersDir))
            {
                string uName = Path.GetFileName(uDir);
                if (uName.Equals("Public", StringComparison.OrdinalIgnoreCase) ||
                    uName.Equals("All Users", StringComparison.OrdinalIgnoreCase) ||
                    uName.Equals("Default User", StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }

                string duplicateLnk = Path.Combine(uDir, @"AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\Pallets WW.lnk");
                if (File.Exists(duplicateLnk))
                {
                    try { File.Delete(duplicateLnk); } catch { }
                }
            }
        }
        catch { }
    }

    private static void CopiarYPermitirArchivo(string origen, string destino)
    {
        try
        {
            string? dir = Path.GetDirectoryName(destino);
            if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir))
            {
                Directory.CreateDirectory(dir);
                OtorgarPermisosTotales(dir);
            }

            if (File.Exists(destino))
            {
                try
                {
                    File.SetAttributes(destino, FileAttributes.Normal);
                    File.Delete(destino);
                }
                catch { }
            }

            File.Copy(origen, destino, true);
            OtorgarPermisosTotales(destino);
        }
        catch { }
    }

    private static void OtorgarPermisosTotales(string path)
    {
        try
        {
            var userSid = new SecurityIdentifier(WellKnownSidType.BuiltinUsersSid, null);
            var worldSid = new SecurityIdentifier(WellKnownSidType.WorldSid, null);

            if (File.Exists(path))
            {
                var fInfo = new FileInfo(path);
                var fSec = fInfo.GetAccessControl();
                fSec.AddAccessRule(new FileSystemAccessRule(userSid, FileSystemRights.FullControl, AccessControlType.Allow));
                fSec.AddAccessRule(new FileSystemAccessRule(worldSid, FileSystemRights.FullControl, AccessControlType.Allow));
                fInfo.SetAccessControl(fSec);
            }
            else if (Directory.Exists(path))
            {
                var dInfo = new DirectoryInfo(path);
                var dSec = dInfo.GetAccessControl();
                dSec.AddAccessRule(new FileSystemAccessRule(userSid, FileSystemRights.FullControl,
                    InheritanceFlags.ContainerInherit | InheritanceFlags.ObjectInherit,
                    PropagationFlags.None, AccessControlType.Allow));
                dSec.AddAccessRule(new FileSystemAccessRule(worldSid, FileSystemRights.FullControl,
                    InheritanceFlags.ContainerInherit | InheritanceFlags.ObjectInherit,
                    PropagationFlags.None, AccessControlType.Allow));
                dInfo.SetAccessControl(dSec);
            }
        }
        catch { }
    }

    private static void CrearAccesoDirectoWsh(string rutaLnk, string target, string args, string workingDir, string iconPath, string description, string? appId = null)
    {
        try
        {
            string? dir = Path.GetDirectoryName(rutaLnk);
            if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir))
            {
                Directory.CreateDirectory(dir);
                OtorgarPermisosTotales(dir);
            }

            Type? shellType = Type.GetTypeFromProgID("WScript.Shell");
            if (shellType != null)
            {
                dynamic? shell = Activator.CreateInstance(shellType);
                if (shell != null)
                {
                    dynamic sc = shell.CreateShortcut(rutaLnk);
                    sc.TargetPath = target;
                    if (!string.IsNullOrEmpty(args)) sc.Arguments = args;
                    if (!string.IsNullOrEmpty(workingDir)) sc.WorkingDirectory = workingDir;
                    if (File.Exists(iconPath)) sc.IconLocation = $"{iconPath},0";
                    sc.Description = description;
                    sc.Save();
                }
            }

            if (!string.IsNullOrEmpty(appId))
            {
                SetShortcutAppUserModelId(rutaLnk, appId);
            }

            OtorgarPermisosTotales(rutaLnk);
        }
        catch { }
    }

    private static async Task VerificarServicioLocalAsync(Action<string, int> progress)
    {
        using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(3) };
        try
        {
            var res = await client.GetAsync("http://127.0.0.1:9100/default?type=printer");
            if (res.IsSuccessStatusCode)
            {
                progress("✓ Servicio local respondiendo correctamente en puerto 9100.", 95);
            }
            else
            {
                progress("Aviso: El servicio respondió pero no con código 200.", 95);
            }
        }
        catch
        {
            progress("Aviso: No se pudo verificar la respuesta en puerto 9100 (iniciando en segundo plano).", 95);
        }
    }

    private static void LimpiarAccesosDuplicados(string dir, string currentLnkName)
    {
        try
        {
            if (!Directory.Exists(dir)) return;
            Type? shellType = Type.GetTypeFromProgID("WScript.Shell");
            dynamic? shell = shellType != null ? Activator.CreateInstance(shellType) : null;

            foreach (var lnk in Directory.GetFiles(dir, "*.lnk"))
            {
                string fn = Path.GetFileName(lnk);
                if (fn.Equals(currentLnkName, StringComparison.OrdinalIgnoreCase)) continue;

                if (fn.StartsWith("Pallets WW", StringComparison.OrdinalIgnoreCase) || 
                    fn.StartsWith("Pallets Wet Wipes", StringComparison.OrdinalIgnoreCase) ||
                    fn.StartsWith("Pallets Panal", StringComparison.OrdinalIgnoreCase) ||
                    fn.StartsWith("Pallets Pañal", StringComparison.OrdinalIgnoreCase))
                {
                    if (shell != null)
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
                    }

                    try 
                    { 
                        File.SetAttributes(lnk, FileAttributes.Normal);
                        File.Delete(lnk); 
                    } 
                    catch { }
                }
            }
        }
        catch { }
    }

    private static void ActualizarLnkExistentesEnDir(
        string dirPath, 
        string targetPath, 
        string args, 
        string icoPath, 
        string serverIp, 
        int machineId, 
        string currentLnkName,
        bool recurse = false)
    {
        try
        {
            if (!Directory.Exists(dirPath)) return;
            var searchOption = recurse ? SearchOption.AllDirectories : SearchOption.TopDirectoryOnly;
            Type? shellType = Type.GetTypeFromProgID("WScript.Shell");
            if (shellType == null) return;
            dynamic? shell = Activator.CreateInstance(shellType);
            if (shell == null) return;

            foreach (var lnk in Directory.GetFiles(dirPath, "*.lnk", searchOption))
            {
                try
                {
                    dynamic sc = shell.CreateShortcut(lnk);

                    // Si es la aplicación legacy, reparar su icono si estaba dañado y continuar sin tocar
                    if (EsAccesoDirectoLegacy(sc))
                    {
                        RepararAccesoLegacySiEsNecesario(sc, lnk);
                        continue;
                    }

                    string curArgs = sc.Arguments?.ToString() ?? "";
                    string curTarget = sc.TargetPath?.ToString() ?? "";
                    string fn = Path.GetFileName(lnk);

                    // Solo actualizar si es un acceso directo de la aplicación WEB
                    bool esAccesoWeb = curArgs.Contains(":5106") || curArgs.Contains(":5004") ||
                                       curTarget.Contains(":5106") || curTarget.Contains(":5004") ||
                                       (fn.Equals(currentLnkName, StringComparison.OrdinalIgnoreCase) && 
                                        (curTarget.Contains("msedge", StringComparison.OrdinalIgnoreCase) || 
                                         curTarget.Contains("chrome", StringComparison.OrdinalIgnoreCase)));

                    if (esAccesoWeb)
                    {
                        try { File.SetAttributes(lnk, FileAttributes.Normal); } catch { }
                        sc.TargetPath = targetPath;
                        sc.Arguments = args;
                        if (File.Exists(icoPath)) sc.IconLocation = $"{icoPath},0";
                        sc.Description = machineId > 0 
                            ? $"Pallets WW - Servidor {serverIp} (Línea {machineId})"
                            : $"Pallets WW - Servidor {serverIp}";
                        sc.Save();
                    }
                }
                catch { }
            }
        }
        catch { }
    }

    public static async Task<(bool Success, string Message)> UninstallAsync(Action<string, int> progress)
    {
        return await Task.Run(() =>
        {
            try
            {
                progress("Paso 1/5: Deteniendo servicio puente en ejecución (PalletsPrintBridge)...", 15);
                foreach (var proc in Process.GetProcessesByName("PalletsPrintBridge"))
                {
                    try { proc.Kill(); proc.WaitForExit(3000); } catch { }
                }

                progress("Paso 2/5: Eliminando arranque automático de Windows...", 35);
                string commonStartup = Environment.GetFolderPath(Environment.SpecialFolder.CommonStartup);
                if (string.IsNullOrEmpty(commonStartup) || !Directory.Exists(commonStartup))
                    commonStartup = @"C:\ProgramData\Microsoft\Windows\Start Menu\Programs\Startup";
                
                string[] startupLnks = { "PalletsPrintBridge.lnk", "Pallets WW.lnk", "Pallets Wet Wipes.lnk", "Pallets Panal.lnk", "Pallets Pañal.lnk" };
                foreach (var lnk in startupLnks)
                {
                    string p = Path.Combine(commonStartup, lnk);
                    if (File.Exists(p)) try { File.Delete(p); } catch { }
                }

                progress("Paso 3/5: Eliminando accesos directos de todos los usuarios y escritorios...", 60);
                string[] scTargets = { "*Pallet*.lnk", "Pallets WW.lnk", "Pallets Wet Wipes.lnk" };

                // Escritorio Publico y Menu Inicio Publico
                string commonDesk = Environment.GetFolderPath(Environment.SpecialFolder.CommonDesktopDirectory);
                string commonProg = Environment.GetFolderPath(Environment.SpecialFolder.CommonPrograms);
                if (Directory.Exists(commonDesk))
                {
                    foreach (var f in Directory.GetFiles(commonDesk, "*Pallet*.lnk"))
                        try { File.Delete(f); } catch { }
                }
                if (Directory.Exists(commonProg))
                {
                    foreach (var f in Directory.GetFiles(commonProg, "*Pallet*.lnk"))
                        try { File.Delete(f); } catch { }
                }

                // Perfiles individuales en C:\Users
                if (Directory.Exists(@"C:\Users"))
                {
                    foreach (var uDir in Directory.GetDirectories(@"C:\Users"))
                    {
                        try
                        {
                            string uDesk = Path.Combine(uDir, "Desktop");
                            if (Directory.Exists(uDesk))
                            {
                                foreach (var f in Directory.GetFiles(uDesk, "*Pallet*.lnk"))
                                    try { File.Delete(f); } catch { }
                            }

                            string uProg = Path.Combine(uDir, @"AppData\Roaming\Microsoft\Windows\Start Menu\Programs");
                            if (Directory.Exists(uProg))
                            {
                                foreach (var f in Directory.GetFiles(uProg, "*Pallet*.lnk"))
                                    try { File.Delete(f); } catch { }
                            }

                            string uStartup = Path.Combine(uDir, @"AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup");
                            if (Directory.Exists(uStartup))
                            {
                                foreach (var f in Directory.GetFiles(uStartup, "*Pallet*.lnk"))
                                    try { File.Delete(f); } catch { }
                                string pLnk = Path.Combine(uStartup, "PalletsPrintBridge.lnk");
                                if (File.Exists(pLnk)) try { File.Delete(pLnk); } catch { }
                            }

                            string uTb = Path.Combine(uDir, @"AppData\Roaming\Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar");
                            if (Directory.Exists(uTb))
                            {
                                DesanclarAccesosDuplicadosTaskbar(uTb, "Pallets WW.lnk");
                                LimpiarLayoutXml(uDir);
                                foreach (var f in Directory.GetFiles(uTb, "*Pallet*.lnk")) try { File.Delete(f); } catch { }
                            }
                        }
                        catch { }
                    }
                }

                progress("Paso 4/5: Eliminando carpeta del programa en ProgramData...", 80);
                if (Directory.Exists(ProgramDataFolder))
                {
                    try { Directory.Delete(ProgramDataFolder, true); } catch { }
                }

                progress("Paso 5/5: Limpiando regla del Firewall local...", 95);
                try
                {
                    Process.Start(new ProcessStartInfo
                    {
                        FileName = "netsh",
                        Arguments = "advfirewall firewall delete rule name=\"PalletsWW_PrintBridge_9100\"",
                        CreateNoWindow = true,
                        UseShellExecute = false
                    })?.WaitForExit(2000);
                }
                catch { }

                progress("-> DESINSTALACIÓN COMPLETADA EXITOSAMENTE AL 100%.", 100);
                return (true, "La aplicación y el servicio de Pallets WW fueron desinstalados completamente.");
            }
            catch (Exception ex)
            {
                return (false, "Error durante la desinstalación: " + ex.Message);
            }
        });
    }
}
