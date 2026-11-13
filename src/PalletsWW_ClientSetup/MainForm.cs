using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Windows.Forms;

namespace PalletsWW_ClientSetup;

public class MainForm : Form
{
    private ComboBox cmbMaquina = null!;
    private TextBox txtServerIp = null!;
    private RadioButton rbUsb = null!;
    private RadioButton rbNetwork = null!;
    private TextBox txtPrinterIp = null!;
    private TextBox txtPrinterPort = null!;
    private Button btnTestPrinterIp = null!;
    private Label lblTestResult = null!;
    private Label lblDetectedPrinterBadge = null!;
    private CheckedListBox chkListUsers = null!;
    private CheckBox chkService = null!;
    private CheckBox chkAutoStartup = null!;
    private CheckBox chkShortcuts = null!;
    private CheckBox chkTaskbar = null!;
    private Button btnInstall = null!;
    private Button btnUninstall = null!;
    private Button btnClose = null!;
    private ProgressBar progressBar = null!;
    private TextBox txtLog = null!;
    private Label lblDetectedBadge = null!;

    private int _detectedMachineId = 0;
    private string _detectedServerIp = InstallerEngine.DefaultServerIp;
    private string _detectedPrintMode = "USB";
    private string _detectedPrinterIp = "";
    private int _detectedPrinterPort = 9100;

    public MainForm()
    {
        InitializeComponents();
        LoadDetectedSettings();
    }

    private void InitializeComponents()
    {
        this.Text = "Instalador Todo-en-Uno - Pallets Wet Wipes v1.0.2 (Kimberly-Clark)";
        this.Size = new Size(660, 940);
        this.StartPosition = FormStartPosition.CenterScreen;
        this.FormBorderStyle = FormBorderStyle.FixedDialog;
        this.MaximizeBox = false;
        this.AutoScroll = true;
        this.BackColor = Color.FromArgb(248, 250, 252);
        this.Font = new Font("Segoe UI", 9.5f, FontStyle.Regular);

        // Icono de la ventana
        string icoPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "pallets_ww.ico");
        if (File.Exists(icoPath))
        {
            try { this.Icon = new Icon(icoPath); } catch { }
        }

        // Panel Encabezado
        var headerPanel = new Panel
        {
            Dock = DockStyle.Top,
            Height = 85,
            BackColor = Color.FromArgb(15, 23, 42) // Dark Slate
        };

        var lblTitle = new Label
        {
            Text = "PALLETS WET WIPES",
            Font = new Font("Segoe UI", 14f, FontStyle.Bold),
            ForeColor = Color.White,
            Location = new Point(20, 16),
            AutoSize = true
        };

        var lblSubtitle = new Label
        {
            Text = "Instalador Todo-en-Uno de Terminal y Agente Zebra (USB / Red LAN)   Depto 3   Planta Tlaxcala   v1.0.2",
            Font = new Font("Segoe UI", 9f, FontStyle.Regular),
            ForeColor = Color.FromArgb(148, 163, 184),
            Location = new Point(21, 46),
            AutoSize = true
        };

        headerPanel.Controls.Add(lblTitle);
        headerPanel.Controls.Add(lblSubtitle);
        this.Controls.Add(headerPanel);

        int currentY = 95;

        // Card 1: Selección de Máquina
        var grpMaquina = new GroupBox
        {
            Text = " 1. Línea de Producción Asignada a esta PC ",
            Font = new Font("Segoe UI", 9.5f, FontStyle.Bold),
            ForeColor = Color.FromArgb(30, 41, 59),
            Location = new Point(20, currentY),
            Size = new Size(600, 90),
            BackColor = Color.White
        };

        cmbMaquina = new ComboBox
        {
            DropDownStyle = ComboBoxStyle.DropDownList,
            Font = new Font("Segoe UI", 10.5f, FontStyle.Regular),
            Location = new Point(20, 26),
            Size = new Size(350, 30)
        };

        foreach (var m in InstallerEngine.AvailableMachines)
        {
            cmbMaquina.Items.Add(m);
        }
        cmbMaquina.DisplayMember = "DisplayName";
        cmbMaquina.ValueMember = "Id";

        lblDetectedBadge = new Label
        {
            Font = new Font("Segoe UI", 8.5f, FontStyle.Bold),
            ForeColor = Color.FromArgb(16, 185, 129), // Emerald
            Location = new Point(20, 62),
            Size = new Size(550, 20),
            Text = "Consultando configuración previa..."
        };

        grpMaquina.Controls.Add(cmbMaquina);
        grpMaquina.Controls.Add(lblDetectedBadge);
        this.Controls.Add(grpMaquina);

        currentY += 98;

        // Card 2: Servidor Central IIS
        var grpServer = new GroupBox
        {
            Text = " 2. Servidor Central de la Aplicación (IIS - Puerto 5106) ",
            Font = new Font("Segoe UI", 9.5f, FontStyle.Bold),
            ForeColor = Color.FromArgb(30, 41, 59),
            Location = new Point(20, currentY),
            Size = new Size(600, 70),
            BackColor = Color.White
        };

        var lblHttp = new Label
        {
            Text = "http://",
            Font = new Font("Segoe UI", 10f, FontStyle.Regular),
            ForeColor = Color.FromArgb(100, 116, 139),
            Location = new Point(20, 28),
            AutoSize = true
        };

        txtServerIp = new TextBox
        {
            Font = new Font("Segoe UI", 10.5f, FontStyle.Bold),
            Text = InstallerEngine.DefaultServerIp,
            Location = new Point(75, 25),
            Size = new Size(180, 30)
        };

        var lblPort = new Label
        {
            Text = ":5106/  (IP Servidor en Planta: 10.26.24.31)",
            Font = new Font("Segoe UI", 9f, FontStyle.Regular),
            ForeColor = Color.FromArgb(100, 116, 139),
            Location = new Point(265, 29),
            AutoSize = true
        };

        grpServer.Controls.Add(lblHttp);
        grpServer.Controls.Add(txtServerIp);
        grpServer.Controls.Add(lblPort);
        this.Controls.Add(grpServer);

        currentY += 78;

        // Card 3: Conexión de Impresora Zebra (USB vs Red Ethernet)
        var grpPrinter = new GroupBox
        {
            Text = " 3. Conexión de Impresora Zebra (USB Local o Red Ethernet LAN) ",
            Font = new Font("Segoe UI", 9.5f, FontStyle.Bold),
            ForeColor = Color.FromArgb(30, 41, 59),
            Location = new Point(20, currentY),
            Size = new Size(600, 125),
            BackColor = Color.White
        };

        rbUsb = new RadioButton
        {
            Text = "Zebra USB (Impresora conectada directamente por cable USB)",
            Checked = true,
            Font = new Font("Segoe UI", 9.5f, FontStyle.Regular),
            Location = new Point(20, 24),
            AutoSize = true
        };

        rbNetwork = new RadioButton
        {
            Text = "Zebra RED (Impresora conectada a la red Ethernet - IP Fija)",
            Checked = false,
            Font = new Font("Segoe UI", 9.5f, FontStyle.Regular),
            Location = new Point(20, 48),
            AutoSize = true
        };

        var lblIp = new Label
        {
            Text = "IP Impresora:",
            Font = new Font("Segoe UI", 9f, FontStyle.Regular),
            ForeColor = Color.FromArgb(100, 116, 139),
            Location = new Point(40, 78),
            AutoSize = true
        };

        txtPrinterIp = new TextBox
        {
            Font = new Font("Segoe UI", 9.5f, FontStyle.Bold),
            Text = "",
            Location = new Point(125, 75),
            Size = new Size(130, 26),
            Enabled = false
        };

        var lblPuerto = new Label
        {
            Text = "Puerto:",
            Font = new Font("Segoe UI", 9f, FontStyle.Regular),
            ForeColor = Color.FromArgb(100, 116, 139),
            Location = new Point(265, 78),
            AutoSize = true
        };

        txtPrinterPort = new TextBox
        {
            Font = new Font("Segoe UI", 9.5f, FontStyle.Bold),
            Text = "9100",
            Location = new Point(315, 75),
            Size = new Size(55, 26),
            Enabled = false
        };

        btnTestPrinterIp = new Button
        {
            Text = "Probar Conexión",
            Font = new Font("Segoe UI", 8.5f, FontStyle.Bold),
            BackColor = Color.FromArgb(241, 245, 249),
            ForeColor = Color.FromArgb(30, 41, 59),
            FlatStyle = FlatStyle.Flat,
            Location = new Point(380, 74),
            Size = new Size(120, 28),
            Enabled = false,
            Cursor = Cursors.Hand
        };

        lblTestResult = new Label
        {
            Font = new Font("Segoe UI", 8.5f, FontStyle.Bold),
            ForeColor = Color.FromArgb(100, 116, 139),
            Location = new Point(505, 78),
            Size = new Size(85, 20),
            Text = ""
        };

        lblDetectedPrinterBadge = new Label
        {
            Font = new Font("Segoe UI", 8f, FontStyle.Regular),
            ForeColor = Color.FromArgb(100, 116, 139),
            Location = new Point(40, 103),
            Size = new Size(540, 18),
            Text = "Modo predeterminado: Zebra USB Local"
        };

        rbUsb.CheckedChanged += (s, e) => {
            bool isNet = rbNetwork.Checked;
            txtPrinterIp.Enabled = isNet;
            txtPrinterPort.Enabled = isNet;
            btnTestPrinterIp.Enabled = isNet;
            if (!isNet) lblTestResult.Text = "";
        };

        rbNetwork.CheckedChanged += (s, e) => {
            bool isNet = rbNetwork.Checked;
            txtPrinterIp.Enabled = isNet;
            txtPrinterPort.Enabled = isNet;
            btnTestPrinterIp.Enabled = isNet;
            if (isNet && string.IsNullOrWhiteSpace(txtPrinterIp.Text)) {
                txtPrinterIp.Text = "10.26.24.";
                txtPrinterIp.Focus();
                txtPrinterIp.SelectionStart = txtPrinterIp.Text.Length;
            }
        };

        btnTestPrinterIp.Click += async (s, e) => {
            btnTestPrinterIp.Enabled = false;
            lblTestResult.ForeColor = Color.FromArgb(100, 116, 139);
            lblTestResult.Text = "Probando...";
            int port = int.TryParse(txtPrinterPort.Text.Trim(), out int p) ? p : 9100;
            var (ok, msg) = await InstallerEngine.TestNetworkPrinterAsync(txtPrinterIp.Text.Trim(), port);
            btnTestPrinterIp.Enabled = true;
            if (ok) {
                lblTestResult.ForeColor = Color.FromArgb(16, 185, 129);
                lblTestResult.Text = "✓ OK (9100)";
                MessageBox.Show(msg, "Conexión Exitosa con Impresora", MessageBoxButtons.OK, MessageBoxIcon.Information);
            } else {
                lblTestResult.ForeColor = Color.FromArgb(225, 29, 72);
                lblTestResult.Text = "✗ Falló";
                MessageBox.Show(msg, "Error de Conexión de Red", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            }
        };

        grpPrinter.Controls.Add(rbUsb);
        grpPrinter.Controls.Add(rbNetwork);
        grpPrinter.Controls.Add(lblIp);
        grpPrinter.Controls.Add(txtPrinterIp);
        grpPrinter.Controls.Add(lblPuerto);
        grpPrinter.Controls.Add(txtPrinterPort);
        grpPrinter.Controls.Add(btnTestPrinterIp);
        grpPrinter.Controls.Add(lblTestResult);
        grpPrinter.Controls.Add(lblDetectedPrinterBadge);
        this.Controls.Add(grpPrinter);

        currentY += 133;

        // Card 4: Cuentas de Usuario de la PC
        var grpUsers = new GroupBox
        {
            Text = " 4. Cuentas de Usuario en esta PC (Seleccionar dónde fijar/crear accesos) ",
            Font = new Font("Segoe UI", 9.5f, FontStyle.Bold),
            ForeColor = Color.FromArgb(30, 41, 59),
            Location = new Point(20, currentY),
            Size = new Size(600, 95),
            BackColor = Color.White
        };

        chkListUsers = new CheckedListBox
        {
            Font = new Font("Segoe UI", 9.5f, FontStyle.Regular),
            Location = new Point(20, 24),
            Size = new Size(560, 58),
            CheckOnClick = true,
            BorderStyle = BorderStyle.FixedSingle
        };

        var detectedUsers = InstallerEngine.DetectLocalUserProfiles();
        foreach (var u in detectedUsers)
        {
            chkListUsers.Items.Add(u, isChecked: true);
        }

        grpUsers.Controls.Add(chkListUsers);
        this.Controls.Add(grpUsers);

        currentY += 103;

        // Card 5: Opciones de Configuración
        var grpOptions = new GroupBox
        {
            Text = " 5. Acciones de Configuración Automatizada ",
            Font = new Font("Segoe UI", 9.5f, FontStyle.Bold),
            ForeColor = Color.FromArgb(30, 41, 59),
            Location = new Point(20, currentY),
            Size = new Size(600, 110),
            BackColor = Color.White
        };

        chkService = new CheckBox
        {
            Text = "Instalar microservicio local Zebra (127.0.0.1:9100) en ProgramData",
            Checked = true,
            Font = new Font("Segoe UI", 9f, FontStyle.Regular),
            Location = new Point(20, 24),
            AutoSize = true
        };

        chkAutoStartup = new CheckBox
        {
            Text = "Iniciar microservicio automáticamente al encender la PC (Common Startup)",
            Checked = true,
            Font = new Font("Segoe UI", 9f, FontStyle.Regular),
            Location = new Point(20, 44),
            AutoSize = true
        };

        chkShortcuts = new CheckBox
        {
            Text = "Crear acceso directo universal en Escritorio y Menú Inicio (Modo App Nativo)",
            Checked = true,
            Font = new Font("Segoe UI", 9f, FontStyle.Regular),
            Location = new Point(20, 64),
            AutoSize = true
        };

        chkTaskbar = new CheckBox
        {
            Text = "Anclar acceso directo a la Barra de Tareas (Taskbar de Windows)",
            Checked = true,
            Font = new Font("Segoe UI", 9f, FontStyle.Regular),
            Location = new Point(20, 84),
            AutoSize = true
        };

        grpOptions.Controls.Add(chkService);
        grpOptions.Controls.Add(chkAutoStartup);
        grpOptions.Controls.Add(chkShortcuts);
        grpOptions.Controls.Add(chkTaskbar);
        this.Controls.Add(grpOptions);

        currentY += 118;

        // Botón de Instalación
        btnInstall = new Button
        {
            Text = "⚡  INSTALAR Y CONFIGURAR AHORA",
            Font = new Font("Segoe UI", 11f, FontStyle.Bold),
            ForeColor = Color.White,
            BackColor = Color.FromArgb(2, 132, 199), // Sky 600
            FlatStyle = FlatStyle.Flat,
            Location = new Point(20, currentY),
            Size = new Size(600, 45),
            Cursor = Cursors.Hand
        };
        btnInstall.FlatAppearance.BorderSize = 0;
        btnInstall.Click += BtnInstall_Click;
        this.Controls.Add(btnInstall);

        currentY += 55;

        // Barra de progreso y Log
        progressBar = new ProgressBar
        {
            Location = new Point(20, currentY),
            Size = new Size(600, 12),
            Style = ProgressBarStyle.Continuous,
            Value = 0
        };
        this.Controls.Add(progressBar);

        currentY += 18;

        txtLog = new TextBox
        {
            Multiline = true,
            ReadOnly = true,
            ScrollBars = ScrollBars.Vertical,
            BackColor = Color.FromArgb(15, 23, 42),
            ForeColor = Color.FromArgb(56, 189, 248),
            Font = new Font("Consolas", 8.5f, FontStyle.Regular),
            Location = new Point(20, currentY),
            Size = new Size(600, 115)
        };
        this.Controls.Add(txtLog);

        currentY += 125;

        // Botón Desinstalar
        btnUninstall = new Button
        {
            Text = "🗑️  Desinstalar Terminal",
            Font = new Font("Segoe UI", 9.5f, FontStyle.Bold),
            ForeColor = Color.White,
            BackColor = Color.FromArgb(225, 29, 72), // Rose Red
            FlatStyle = FlatStyle.Flat,
            Location = new Point(20, currentY),
            Size = new Size(230, 36),
            Cursor = Cursors.Hand
        };
        btnUninstall.FlatAppearance.BorderSize = 0;
        btnUninstall.Click += BtnUninstall_Click;
        this.Controls.Add(btnUninstall);

        // Botón Cerrar
        btnClose = new Button
        {
            Text = "Cerrar",
            Font = new Font("Segoe UI", 10f, FontStyle.Regular),
            Location = new Point(485, currentY),
            Size = new Size(135, 36),
            Cursor = Cursors.Hand
        };
        btnClose.Click += (s, e) => this.Close();
        this.Controls.Add(btnClose);
    }

    private void LoadDetectedSettings()
    {
        var (detectedId, source) = InstallerEngine.DetectConfiguredMachine();
        _detectedMachineId = detectedId;
        _detectedServerIp = InstallerEngine.DetectConfiguredServer();
        var (detectedMode, detectedIp, detectedPort) = InstallerEngine.DetectConfiguredPrinter();
        _detectedPrintMode = detectedMode;
        _detectedPrinterIp = detectedIp;
        _detectedPrinterPort = detectedPort > 0 ? detectedPort : 9100;

        txtServerIp.Text = _detectedServerIp;
        txtPrinterIp.Text = _detectedPrinterIp;
        txtPrinterPort.Text = _detectedPrinterPort.ToString();

        if (string.Equals(_detectedPrintMode, "Red", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(_detectedPrintMode, "Network", StringComparison.OrdinalIgnoreCase))
        {
            rbNetwork.Checked = true;
            rbUsb.Checked = false;
            txtPrinterIp.Enabled = true;
            txtPrinterPort.Enabled = true;
            btnTestPrinterIp.Enabled = true;
            lblDetectedPrinterBadge.Text = $"Configuración previa: Red Ethernet ({_detectedPrinterIp}:{_detectedPrinterPort})";
            lblDetectedPrinterBadge.ForeColor = Color.FromArgb(16, 185, 129);
        }
        else
        {
            rbUsb.Checked = true;
            rbNetwork.Checked = false;
            txtPrinterIp.Enabled = false;
            txtPrinterPort.Enabled = false;
            btnTestPrinterIp.Enabled = false;
            lblDetectedPrinterBadge.Text = "Configuración previa: Zebra USB Local";
            lblDetectedPrinterBadge.ForeColor = Color.FromArgb(100, 116, 139);
        }

        if (_detectedMachineId <= 0) _detectedMachineId = 70;
        if (_detectedMachineId > 0)
        {
            for (int i = 0; i < cmbMaquina.Items.Count; i++)
            {
                if (cmbMaquina.Items[i] is MachineItem mi && mi.Id == _detectedMachineId)
                {
                    cmbMaquina.SelectedIndex = i;
                    lblDetectedBadge.Text = $"OK - Línea detectada automáticamente: {mi.DisplayName} (desde {source})";
                    lblDetectedBadge.ForeColor = Color.FromArgb(16, 185, 129);
                    return;
                }
            }
        }

        cmbMaquina.SelectedIndex = cmbMaquina.Items.Count > 6 ? 6 : 0; // Línea 7
        lblDetectedBadge.Text = "Info: Seleccione la línea correspondiente para esta computadora.";
        lblDetectedBadge.ForeColor = Color.FromArgb(100, 116, 139);
    }

    private async void BtnInstall_Click(object? sender, EventArgs e)
    {
        if (cmbMaquina.SelectedItem == null)
        {
            MessageBox.Show("Por favor seleccione una máquina de producción.", "Validación", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            return;
        }

        if (string.IsNullOrWhiteSpace(txtServerIp.Text))
        {
            MessageBox.Show("Por favor ingrese la IP o nombre de host del servidor central de IIS.", "Validación", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            txtServerIp.Focus();
            return;
        }

        string printMode = rbNetwork.Checked ? "Red" : "USB";
        string printerIp = txtPrinterIp.Text.Trim();
        int printerPort = int.TryParse(txtPrinterPort.Text.Trim(), out int p) ? p : 9100;

        if (rbNetwork.Checked && string.IsNullOrWhiteSpace(printerIp))
        {
            MessageBox.Show("Ha seleccionado impresión por Red. Por favor ingrese la IP de la impresora Zebra (ej. 10.26.24.106).", "Validación", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            txtPrinterIp.Focus();
            return;
        }

        var selectedUsers = new List<string>();
        foreach (var item in chkListUsers.CheckedItems)
        {
            if (item != null) selectedUsers.Add(item.ToString()!);
        }
        if (selectedUsers.Count == 0)
        {
            selectedUsers.Add(Environment.UserName);
        }

        var machine = (MachineItem)cmbMaquina.SelectedItem!;
        string server = txtServerIp.Text.Trim();

        btnInstall.Enabled = false;
        btnInstall.Text = "⏳  Instalando y Configurando Terminal...";
        btnInstall.BackColor = Color.FromArgb(100, 116, 139);
        cmbMaquina.Enabled = false;
        txtServerIp.Enabled = false;
        rbUsb.Enabled = false;
        rbNetwork.Enabled = false;
        txtPrinterIp.Enabled = false;
        txtPrinterPort.Enabled = false;
        btnTestPrinterIp.Enabled = false;
        chkListUsers.Enabled = false;
        chkService.Enabled = false;
        chkAutoStartup.Enabled = false;
        chkShortcuts.Enabled = false;
        chkTaskbar.Enabled = false;

        txtLog.Clear();
        progressBar.Value = 0;

        void LogProgress(string msg, int pct)
        {
            if (this.InvokeRequired)
            {
                this.Invoke(() => LogProgress(msg, pct));
                return;
            }

            txtLog.AppendText($"[{DateTime.Now:HH:mm:ss}] {msg}\r\n");
            txtLog.SelectionStart = txtLog.Text.Length;
            txtLog.ScrollToCaret();

            if (pct >= 0 && pct <= 100)
            {
                progressBar.Value = pct;
            }
        }

        bool success = await InstallerEngine.InstallAsync(
            machine.Id,
            server,
            printMode,
            printerIp,
            printerPort,
            selectedUsers,
            chkService.Checked,
            chkAutoStartup.Checked,
            chkShortcuts.Checked,
            chkTaskbar.Checked,
            LogProgress
        );

        if (success)
        {
            btnInstall.Text = "✓  INSTALACIÓN COMPLETADA CON ÉXITO";
            btnInstall.BackColor = Color.FromArgb(16, 185, 129); // Emerald Green
            string modoImpresionMsg = printMode == "Red" 
                ? $"Zebra RED ({printerIp}:{printerPort})" 
                : "Zebra USB Local";

            MessageBox.Show(
                $"¡Instalación completada exitosamente!\r\n\r\n" +
                $"  Terminal asignada a: {machine.DisplayName}\r\n" +
                $"  Servidor Central: http://{server}:5106/\r\n" +
                $"  Modo de Impresión: {modoImpresionMsg}\r\n" +
                $"  Servicio Zebra: Operativo en segundo plano (puerto 9100)\r\n" +
                $"  Usuarios configurados: {string.Join(", ", selectedUsers)}\r\n\r\n" +
                $"📌 Anclaje a la Barra de Tareas (Windows 10 y Windows 11):\r\n" +
                $"El acceso directo oficial ha sido colocado en su Escritorio y Menú Inicio.\r\n" +
                $"• Windows 10: Clic derecho sobre el icono del Escritorio > 'Anclar a la barra de tareas' (o arrástrelo a la barra).\r\n" +
                $"• Windows 11: Arrastre el icono del Escritorio directamente a la Barra de Tareas (o clic derecho > Mostrar más opciones > Anclar a la barra de tareas).\r\n\r\n" +
                $"✓ En ambos sistemas (Windows 10 y Windows 11), la app mantendrá siempre su icono oficial de Pallets WW y sus parámetros sin convertirse jamás en Edge genérico.",
                "Instalación Exitosa - Pallets WW",
                MessageBoxButtons.OK,
                MessageBoxIcon.Information
            );
        }
        else
        {
            btnInstall.Enabled = true;
            btnInstall.Text = "⚠️  REINTENTAR INSTALACIÓN";
            btnInstall.BackColor = Color.FromArgb(225, 29, 72); // Rose
            cmbMaquina.Enabled = true;
            txtServerIp.Enabled = true;
            rbUsb.Enabled = true;
            rbNetwork.Enabled = true;
            txtPrinterIp.Enabled = rbNetwork.Checked;
            txtPrinterPort.Enabled = rbNetwork.Checked;
            btnTestPrinterIp.Enabled = rbNetwork.Checked;
            chkListUsers.Enabled = true;
            chkService.Enabled = true;
            chkAutoStartup.Enabled = true;
            chkShortcuts.Enabled = true;
            chkTaskbar.Enabled = true;
        }
    }

    private async void BtnUninstall_Click(object? sender, EventArgs e)
    {
        var confirm = MessageBox.Show(
            "¿Está seguro de que desea DESINSTALAR Pallets WW de esta PC?\n\n" +
            "Se detendrá el servicio de impresión, se eliminarán los accesos directos de todos los usuarios y se limpiará la configuración.",
            "Confirmar Desinstalación Completa",
            MessageBoxButtons.YesNo,
            MessageBoxIcon.Warning
        );

        if (confirm != DialogResult.Yes) return;

        btnInstall.Enabled = false;
        btnUninstall.Enabled = false;
        btnClose.Enabled = false;
        btnUninstall.Text = "⏳  Desinstalando...";
        txtLog.Clear();

        var (success, msg) = await InstallerEngine.UninstallAsync((txt, pct) =>
        {
            this.Invoke(() =>
            {
                progressBar.Value = Math.Clamp(pct, 0, 100);
                txtLog.AppendText($"[{DateTime.Now:HH:mm:ss}] {txt}\r\n");
            });
        });

        btnUninstall.Enabled = true;
        btnInstall.Enabled = true;
        btnClose.Enabled = true;

        if (success)
        {
            btnUninstall.Text = "✓  Desinstalado";
            btnUninstall.BackColor = Color.FromArgb(100, 116, 139);
            btnInstall.Text = "⚡  INSTALAR Y CONFIGURAR AHORA";
            btnInstall.BackColor = Color.FromArgb(2, 132, 199);
            MessageBox.Show(msg, "Desinstalación Exitosa", MessageBoxButtons.OK, MessageBoxIcon.Information);
        }
        else
        {
            btnUninstall.Text = "🗑️  Desinstalar Terminal";
            MessageBox.Show(msg, "Error al Desinstalar", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }
}
