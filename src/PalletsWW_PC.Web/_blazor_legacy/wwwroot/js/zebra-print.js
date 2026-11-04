// =============================================================================
// Pallets WW - Conector Cliente para Impresoras Zebra USB y Red LAN (Dual Mode)
// Soporta Zebra Browser Print Oficial (9100) y PalletsPrintBridge (9100/5108)
// Con Detección de Pausa, Alerta Pre-Vuelo, Socket TCP y Purga de Cola Spooler
// =============================================================================

window.ZebraPrint = {
    activePort: null,
    defaultDevice: null,
    isConnected: false,

    // 1. Diagnóstico y Detección de la Impresora en la PC Cliente
    checkStatus: async function () {
        const ports = [9100, 5108];

        for (const port of ports) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 1800);

                const response = await fetch(`http://127.0.0.1:${port}/default?type=printer`, {
                    method: 'GET',
                    headers: { 'Accept': 'application/json' },
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                if (response.ok) {
                    const data = await response.json();
                    if (data) {
                        this.activePort = port;
                        this.defaultDevice = data;
                        this.isConnected = true;

                        const printMode = data.printMode || "USB";
                        const printerIp = data.printerIp || "";
                        const printerPort = data.printerPort || 9100;
                        const name = data.name || (printMode === "Red" ? `Zebra Red (${printerIp}:${printerPort})` : "Generic / Text Only (Zebra USB)");
                        const isPaused = data.isPaused === true;
                        const isOffline = data.isOffline === true;
                        const isError = data.isError === true;
                        const cJobs = data.cJobs || 0;
                        const statusDesc = data.statusDesc || "Listo";

                        let msg = "";
                        if (printMode === "Red") {
                            if (isOffline || isError) {
                                msg = `⚠️ Impresora de Red (LAN) no responde en ${printerIp}:${printerPort}. Verifique cable o IP.`;
                            } else {
                                msg = `Impresora Zebra de Red en línea en ${printerIp}:${printerPort} (Socket 9100)`;
                            }
                        } else {
                            msg = `Impresora USB lista en esta PC (${name}) vía puerto ${port}`;
                            if (isPaused) {
                                msg = `⚠️ Impresora en PAUSA (${name}) con ${cJobs} trabajo(s) en cola. Despause para imprimir.`;
                            } else if (isOffline) {
                                msg = `⚠️ Impresora apagada o desconectada (${name}).`;
                            } else if (isError) {
                                msg = `⚠️ Impresora con error en Windows (${name}).`;
                            }
                        }

                        return {
                            connected: true,
                            printerName: name,
                            port: port,
                            printMode: printMode,
                            printerIp: printerIp,
                            printerPort: printerPort,
                            isPaused: isPaused,
                            isOffline: isOffline,
                            isError: isError,
                            cJobs: cJobs,
                            statusDesc: statusDesc,
                            message: msg
                        };
                    }
                }
            } catch (err) {
                // Siguiente puerto
            }
        }

        this.isConnected = false;
        this.activePort = null;

        return {
            connected: false,
            printerName: "",
            port: 0,
            printMode: "USB",
            printerIp: "",
            printerPort: 9100,
            isPaused: false,
            isOffline: false,
            isError: false,
            cJobs: 0,
            statusDesc: "No disponible",
            message: "No se detectó el Agente Zebra en esta PC (127.0.0.1:9100). Verifique que PalletsPrintBridge esté ejecutándose."
        };
    },

    // 2. Catálogo de Todas las Impresoras Instaladas en la PC Cliente (Modo USB)
    getPrintersList: async function () {
        const ports = this.activePort ? [this.activePort, 9100, 5108] : [9100, 5108];
        const uniquePorts = [...new Set(ports)];

        for (const port of uniquePorts) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 2000);

                const response = await fetch(`http://127.0.0.1:${port}/printers`, {
                    headers: { 'Accept': 'application/json' },
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                if (response.ok) {
                    const data = await response.json();
                    this.activePort = port;
                    return data; // { selected: "...", printers: [...], isPaused, cJobs, statusDesc }
                }
            } catch (e) { }
        }

        return { selected: "", printers: [], isPaused: false, cJobs: 0, statusDesc: "" };
    },

    // 3. Guardar Selección de Impresora Local USB
    savePrinterConfig: async function (printerName) {
        if (!printerName || printerName.trim().length === 0) {
            return { success: false, message: "Nombre de impresora vacío" };
        }

        const ports = this.activePort ? [this.activePort, 9100, 5108] : [9100, 5108];
        const uniquePorts = [...new Set(ports)];

        for (const port of uniquePorts) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 2000);

                const response = await fetch(`http://127.0.0.1:${port}/config`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({ printerName: printerName.trim(), printMode: "USB" }),
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                if (response.ok) {
                    this.activePort = port;
                    return { success: true, printerName: printerName.trim() };
                }
            } catch (e) { }
        }

        return { success: false, message: "No se pudo comunicar con el agente local." };
    },

    // 3.1 Obtener Configuración de Hardware Completa (USB / Red LAN)
    getHardwareConfig: async function () {
        const ports = this.activePort ? [this.activePort, 9100, 5108] : [9100, 5108];
        const uniquePorts = [...new Set(ports)];

        for (const port of uniquePorts) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 2000);

                const response = await fetch(`http://127.0.0.1:${port}/config`, {
                    headers: { 'Accept': 'application/json' },
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                if (response.ok) {
                    const data = await response.json();
                    this.activePort = port;
                    return data;
                }
            } catch (e) { }
        }

        return null;
    },

    // 3.2 Guardar Configuración de Hardware Completa (USB o Red LAN)
    saveHardwareConfig: async function (config) {
        if (!config) return { success: false, message: "Configuración inválida" };

        const ports = this.activePort ? [this.activePort, 9100, 5108] : [9100, 5108];
        const uniquePorts = [...new Set(ports)];

        for (const port of uniquePorts) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 3000);

                const response = await fetch(`http://127.0.0.1:${port}/config`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify(config),
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                if (response.ok) {
                    this.activePort = port;
                    const resData = await response.json().catch(() => ({ success: true, message: "OK" }));
                    return { success: true, message: resData.message || "Configuración guardada exitosamente." };
                }
            } catch (e) { }
        }

        return { success: false, message: "No se pudo comunicar con el agente local en 127.0.0.1:9100." };
    },

    // 3.3 Probar Socket TCP con Impresora de Red Ethernet (/check-network-printer)
    testNetworkPrinter: async function (ip, port) {
        if (!ip || !ip.trim()) return { success: false, message: "Debe ingresar una dirección IP válida." };
        const targetPort = port > 0 ? port : 9100;
        const ports = this.activePort ? [this.activePort, 9100, 5108] : [9100, 5108];
        const uniquePorts = [...new Set(ports)];

        for (const p of uniquePorts) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 4000);

                const response = await fetch(`http://127.0.0.1:${p}/check-network-printer`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({ ip: ip.trim(), port: targetPort }),
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                if (response.ok) {
                    const data = await response.json();
                    return data;
                } else {
                    const errData = await response.json().catch(() => ({ message: "Error al conectar con la impresora" }));
                    return { success: false, message: errData.message || "Fallo de conexión." };
                }
            } catch (e) { }
        }

        return { success: false, message: "No se pudo contactar al agente local para probar la IP." };
    },

    // 4. Envío de Código ZPL Directamente a la Impresora (Maneja USB o Red según modo)
    printZpl: async function (zplCode) {
        if (!zplCode || zplCode.trim().length === 0) {
            return { success: false, isPaused: false, cJobs: 0, message: "El código ZPL está vacío." };
        }

        const ports = this.activePort ? [this.activePort, 9100, 5108] : [9100, 5108];
        const uniquePorts = [...new Set(ports)];

        for (const port of uniquePorts) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 4000);

                const payload = {
                    device: this.defaultDevice || {
                        name: "Generic / Text Only",
                        uid: "usb_local",
                        connection: "driver"
                    },
                    data: zplCode
                };

                const response = await fetch(`http://127.0.0.1:${port}/write`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify(payload),
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                if (response.ok) {
                    this.activePort = port;
                    this.isConnected = true;
                    const resData = await response.json().catch(() => ({ success: true, message: "OK" }));
                    return {
                        success: true,
                        port: port,
                        isPaused: false,
                        cJobs: 0,
                        message: resData.message || "Etiqueta enviada exitosamente a la impresora de esta PC."
                    };
                } else {
                    const errData = await response.json().catch(() => ({ message: "Error HTTP " + response.status }));
                    return {
                        success: false,
                        port: port,
                        isPaused: errData.isPaused === true,
                        cJobs: errData.cJobs || 0,
                        message: errData.message || "Error al procesar la etiqueta en la impresora."
                    };
                }
            } catch (err) {
                // Siguiente puerto
            }
        }

        return {
            success: false,
            isPaused: false,
            cJobs: 0,
            message: "No se pudo conectar con el servicio local de impresión (127.0.0.1:9100). Verifique que esté activo."
        };
    },

    // 5. Purgar / Cancelar Cola de Impresión en Windows
    purgeSpoolQueue: async function () {
        const ports = this.activePort ? [this.activePort, 9100, 5108] : [9100, 5108];
        const uniquePorts = [...new Set(ports)];

        for (const port of uniquePorts) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 3000);

                const response = await fetch(`http://127.0.0.1:${port}/purge`, {
                    method: 'POST',
                    headers: { 'Accept': 'application/json' },
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                if (response.ok) {
                    const data = await response.json();
                    return {
                        success: true,
                        cJobs: data.cJobs || 0,
                        isPaused: data.isPaused || false,
                        message: data.message || "Cola de impresión purgada exitosamente."
                    };
                } else {
                    const data = await response.json().catch(() => ({ message: "Fallo al purgar" }));
                    return {
                        success: false,
                        message: data.message || "No se pudo purgar la cola de impresión."
                    };
                }
            } catch (e) { }
        }

        return { success: false, message: "No se pudo comunicar con el agente local." };
    },

    // 6. Despausar / Reanudar Impresora en Windows
    resumePrinter: async function () {
        const ports = this.activePort ? [this.activePort, 9100, 5108] : [9100, 5108];
        const uniquePorts = [...new Set(ports)];

        for (const port of uniquePorts) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 3000);

                const response = await fetch(`http://127.0.0.1:${port}/resume`, {
                    method: 'POST',
                    headers: { 'Accept': 'application/json' },
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                if (response.ok) {
                    const data = await response.json();
                    return {
                        success: true,
                        cJobs: data.cJobs || 0,
                        isPaused: data.isPaused || false,
                        message: data.message || "Impresora despausada exitosamente."
                    };
                } else {
                    const data = await response.json().catch(() => ({ message: "Fallo al despausar" }));
                    return {
                        success: false,
                        message: data.message || "No se pudo despausar la impresora."
                    };
                }
            } catch (e) { }
        }

        return { success: false, message: "No se pudo comunicar con el agente local." };
    },

    // 7. Enrolamiento y Doble Candado Local de Máquina
    getMachineConfig: async function (retries = 2) {
        let machineId = 0;
        let machineName = "";
        let serverIp = window.location.hostname;

        // Candado 0: URL search param ?maquina=X (Prioridad inmediata)
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const urlM = urlParams.get('maquina');
            if (urlM && parseInt(urlM) > 0) {
                machineId = parseInt(urlM);
                localStorage.setItem("PalletsWW_MaquinaId", machineId.toString());
                localStorage.setItem("pallets_ww_maquina", machineId.toString());
                document.cookie = "PalletsWW_Maquina=" + machineId + "; path=/; max-age=315360000; SameSite=Lax";
            }
        } catch (e) { }

        // Candado 0.5: Cookie persistente en navegador (Inmune a perfiles)
        if (machineId <= 0) {
            try {
                const match = document.cookie.match(/(?:^|;\s*)PalletsWW_Maquina=([^;]+)/);
                if (match && parseInt(match[1]) > 0) {
                    machineId = parseInt(match[1]);
                    localStorage.setItem("PalletsWW_MaquinaId", machineId.toString());
                }
            } catch (e) { }
        }

        // Candado 1: localStorage
        if (machineId <= 0) {
            try {
                let savedId = localStorage.getItem("PalletsWW_MaquinaId");
                if (!savedId || parseInt(savedId) <= 0) {
                    savedId = localStorage.getItem("pallets_ww_maquina");
                }
                const savedName = localStorage.getItem("PalletsWW_MaquinaNombre");
                const savedServer = localStorage.getItem("PalletsWW_ServerIp");

                if (savedId && parseInt(savedId) > 0) {
                    machineId = parseInt(savedId);
                    machineName = savedName || "";
                    serverIp = savedServer || window.location.hostname;
                }
            } catch (e) {
                console.warn("No se pudo leer localStorage:", e);
            }
        }

        if (machineId > 0) {
            return { machineId: machineId, machineName: machineName, serverIp: serverIp };
        }

        // Candado 2: Consultar settings.json en el agente local (127.0.0.1:9100) con reintentos
        const ports = [9100, 5108];
        const attempts = Math.max(1, retries + 1);

        for (let attempt = 0; attempt < attempts; attempt++) {
            for (const port of ports) {
                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 1500);

                    const response = await fetch(`http://127.0.0.1:${port}/config`, {
                        method: 'GET',
                        headers: { 'Accept': 'application/json' },
                        signal: controller.signal
                    });
                    clearTimeout(timeoutId);

                    if (response.ok) {
                        const data = await response.json();
                        if (data && data.machineId > 0) {
                            machineId = data.machineId;
                            machineName = data.machineName || "";
                            serverIp = data.serverIp || window.location.hostname;
                            try {
                                localStorage.setItem("PalletsWW_MaquinaId", machineId.toString());
                                localStorage.setItem("PalletsWW_MaquinaNombre", machineName);
                                localStorage.setItem("pallets_ww_maquina", machineId.toString());
                                if (serverIp) localStorage.setItem("PalletsWW_ServerIp", serverIp);
                            } catch (e) { }
                            return { machineId: machineId, machineName: machineName, serverIp: serverIp };
                        }
                    }
                } catch (err) { }
            }

            if (attempt < attempts - 1) {
                await new Promise(r => setTimeout(r, 600));
            }
        }

        return { machineId: 0, machineName: "", serverIp: window.location.hostname };
    },

    saveMachineConfig: async function (machineId, machineName) {
        if (!machineId || machineId <= 0) {
            return { success: false, message: "ID de máquina inválido" };
        }

        const idNum = parseInt(machineId);
        const nameStr = machineName || "";
        const serverIp = localStorage.getItem("PalletsWW_ServerIp") || window.location.hostname;

        // 1. Guardar en localStorage
        try {
            localStorage.setItem("PalletsWW_MaquinaId", idNum.toString());
            localStorage.setItem("PalletsWW_MaquinaNombre", nameStr);
            localStorage.setItem("pallets_ww_maquina", idNum.toString());
        } catch (e) {
            console.warn("No se pudo guardar en localStorage:", e);
        }

        // 2. Persistencia en disco local
        const ports = [9100, 5108];
        let serviceUpdated = false;

        for (const port of ports) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 2000);

                const response = await fetch(`http://127.0.0.1:${port}/config`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({
                        machineId: idNum,
                        machineName: nameStr,
                        serverIp: serverIp
                    }),
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                if (response.ok) {
                    serviceUpdated = true;
                    break;
                }
            } catch (err) { }
        }

        return {
            success: true,
            machineId: idNum,
            machineName: nameStr,
            serviceUpdated: serviceUpdated
        };
    },

    // 8. Gestión de Servidor Central
    getServerConfig: async function () {
        // 1. Consultar PRIMERO al servicio local en la PC cliente (settings.json escrito por el instalador)
        const ports = [9100, 5108];
        for (const port of ports) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 1200);
                const response = await fetch("http://127.0.0.1:" + port + "/config", {
                    headers: { 'Accept': 'application/json' },
                    signal: controller.signal
                });
                clearTimeout(timeoutId);
                if (response.ok) {
                    const data = await response.json();
                    if (data && data.serverIp && data.serverIp.trim().length > 0) {
                        const srv = data.serverIp.trim();
                        try { localStorage.setItem("PalletsWW_ServerIp", srv); } catch (e) { }
                        return srv;
                    }
                }
            } catch (err) { }
        }

        // 2. Si no responde el puente local, usar el host actual del navegador
        if (window.location && window.location.hostname && 
            window.location.hostname !== "127.0.0.1" && 
            window.location.hostname !== "localhost") {
            try { localStorage.setItem("PalletsWW_ServerIp", window.location.hostname); } catch (e) { }
            return window.location.hostname;
        }

        // 3. Fallback: localStorage
        try {
            const saved = localStorage.getItem("PalletsWW_ServerIp");
            if (saved && saved.trim().length > 0) {
                return saved.trim();
            }
        } catch (e) { }

        return "10.26.24.31";
    },
    saveServerConfig: async function (newServerIp) {
        if (!newServerIp || newServerIp.trim().length === 0) {
            return { success: false, message: "Dirección de servidor vacía" };
        }

        const cleanIp = newServerIp.trim().replace(/^https?:\/\//i, '').replace(/:.*$/, '').trim();

        try {
            localStorage.setItem("PalletsWW_ServerIp", cleanIp);
        } catch (e) { }

        let machineId = 0;
        let machineName = "";
        try {
            machineId = parseInt(localStorage.getItem("PalletsWW_MaquinaId") || "0");
            machineName = localStorage.getItem("PalletsWW_MaquinaNombre") || "";
        } catch (e) { }

        const ports = [9100, 5108];
        let shortcutUpdated = false;

        for (const port of ports) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 2000);

                const response = await fetch(`http://127.0.0.1:${port}/config`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({
                        machineId: machineId,
                        machineName: machineName,
                        serverIp: cleanIp
                    }),
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                if (response.ok) {
                    shortcutUpdated = true;
                    break;
                }
            } catch (err) { }
        }

        return {
            success: true,
            serverIp: cleanIp,
            shortcutUpdated: shortcutUpdated
        };
    },

    getSavedMachineId: function () {
        try {
            return localStorage.getItem("PalletsWW_MaquinaId");
        } catch (e) {
            return null;
        }
    },

    setSavedMachineId: function (id) {
        try {
            if (id && id > 0) {
                localStorage.setItem("PalletsWW_MaquinaId", id.toString());
            }
        } catch (e) { }
    }
};

window.PalletsZebra = window.ZebraPrint;
