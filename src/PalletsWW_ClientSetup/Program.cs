using System;
using System.Diagnostics;
using System.Security.Principal;
using System.Windows.Forms;

namespace PalletsWW_ClientSetup;

internal static class Program
{
    [STAThread]
    static void Main(string[] args)
    {
        // 1. Analizar argumentos primero
        bool isSilent = false;
        bool noElevate = false;
        int paramMachine = 0;
        string paramServer = "";

        for (int i = 0; i < args.Length; i++)
        {
            string a = args[i].ToLowerInvariant();
            if (a == "-silent" || a == "/silent" || a == "-q" || a == "/q")
            {
                isSilent = true;
            }
            else if (a == "-noelevate" || a == "/noelevate")
            {
                noElevate = true;
            }
            else if ((a == "-maquina" || a == "/maquina") && i + 1 < args.Length)
            {
                if (int.TryParse(args[i + 1], out int m)) paramMachine = m;
            }
            else if (a.StartsWith("/maquina:") && int.TryParse(a.Substring(9), out int m2))
            {
                paramMachine = m2;
            }
            else if ((a == "-servidor" || a == "/servidor") && i + 1 < args.Length)
            {
                paramServer = args[i + 1];
            }
            else if (a.StartsWith("/servidor:"))
            {
                paramServer = a.Substring(10);
            }
        }

        // 2. Auto-elevación a Administrador si no se pasó -noelevate
        if (!noElevate && !IsAdministrator())
        {
            try
            {
                var psi = new ProcessStartInfo
                {
                    FileName = Environment.ProcessPath ?? Application.ExecutablePath,
                    UseShellExecute = true,
                    Verb = "runas",
                    Arguments = string.Join(" ", args)
                };
                Process.Start(psi);
                return;
            }
            catch
            {
                if (!isSilent)
                {
                    MessageBox.Show(
                        "Se requieren permisos de Administrador para instalar el servicio local y configurar los accesos directos de Windows.",
                        "Permisos de Administrador Requeridos",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Warning);
                    return;
                }
            }
        }

        // 3. Ejecución silenciosa
        if (isSilent)
        {
            RunSilentInstall(paramMachine, paramServer);
            return;
        }

        // 4. Modo Gráfico Normal
        ApplicationConfiguration.Initialize();
        Application.Run(new MainForm());
    }

    private static bool IsAdministrator()
    {
        using var identity = WindowsIdentity.GetCurrent();
        var principal = new WindowsPrincipal(identity);
        return principal.IsInRole(WindowsBuiltInRole.Administrator);
    }

    private static void RunSilentInstall(int machineId, string serverIp)
    {
        if (machineId <= 0)
        {
            var (detected, _) = InstallerEngine.DetectConfiguredMachine();
            machineId = detected > 0 ? detected : 70; // TXWW7 default
        }
        else
        {
            machineId = InstallerEngine.ResolveMachineNumberOrId(machineId);
        }

        if (string.IsNullOrWhiteSpace(serverIp))
        {
            serverIp = InstallerEngine.DetectConfiguredServer();
        }

        var (detectedMode, detectedIp, detectedPort) = InstallerEngine.DetectConfiguredPrinter();
        var users = InstallerEngine.DetectLocalUserProfiles();
        InstallerEngine.InstallAsync(
            machineId,
            serverIp,
            detectedMode,
            detectedIp,
            detectedPort,
            users,
            installService: true,
            autoStartup: true,
            createShortcuts: true,
            pinTaskbar: true,
            (msg, pct) => Console.WriteLine($"[{pct}%] {msg}")
        ).GetAwaiter().GetResult();
    }
}