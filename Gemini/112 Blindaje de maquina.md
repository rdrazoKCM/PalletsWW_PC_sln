# 112 Blindaje de Máquina, Diagnóstico de Impresión USB, Candado Multilínea y Ergonomía Operativa

**Fecha:** 24 de Septiembre de 2026  
**Proyecto:** Migración Pallets WW (Depto 3 Wet Wipes - Kimberly Clark Planta Tlaxcala)  
**Módulos Afectados:**
- Base de Datos SQL Server (`TLX022MXDB`): SP `pa_P009_01006_tblPalletsInsertcmdV9`
- API Backend (.NET 8): `PalletsWW_PC.Api` -> `PalletRepository.cs`
- Frontend Web Blazor Server (.NET 8): `PalletsWW_PC.Web` -> `CapturaPallets.razor`, `Configuracion.razor`, `App.razor`
- Agente Local USB Zebra (.NET 8): `PalletsPrintBridge` -> `Program.cs`
- Script de Despliegue e Instalación Cliente: `Instalar_PC_Cliente_final.ps1`

---

## 1. Resumen Ejecutivo y Objetivos de la Intervención

En esta fase de estabilización y blindaje en planta, se resolvieron seis requerimientos críticos reportados tras las pruebas en piso de producción:

1. **Blindaje Total de Asignación de Máquina (Problema TXWW2 -> TXWW1):** Se identificó y erradicó la vulnerabilidad por la cual una PC configurada como Línea 2 (`TXWW2`) revertía a Línea 1 (`TXWW1`) tras reiniciar la terminal. Se implementó la arquitectura de **"Triple Candado de Persistencia"**.
2. **Solución a la Apertura de Doble Ventana al Iniciar Sesión Operador:** Se corrigió la duplicación de accesos directos en el proceso de inicio de Windows, garantizando que la aplicación abra exactamente una sola ventana en modo kiosco.
3. **Diagnóstico Integral y Guía de Prevención de Falla de Impresión USB Zebra:** Se analizó a profundidad por qué modificaciones de interfaz/diseño provocaron en dos ocasiones la desconexión del servicio de impresión, documentando la causa raíz técnica y el protocolo para evitar que vuelva a suceder.
4. **Validación de Horas Duplicadas por Línea de Empaque (Misma Hora en Distinta Línea SÍ se permite):** Se flexibilizó el candado de unicidad de horas dentro del vale. Ahora se permite registrar pallets con la misma hora exacta (ej. 11:30) siempre y cuando pertenezcan a diferentes líneas de empaque (ej. Línea 1 y Línea 2). Se implementó en Base de Datos (SP V9), Backend API y Frontend Blazor.
5. **Auto-Focus Operativo en la Hora del Pallet:** Tras presionar Enter o dar clic en Guardar, el cursor se posiciona automáticamente en el campo de la hora del siguiente pallet con selección activa, permitiendo captura continua sin usar el ratón.
6. **Limpieza Ortográfica y Corrección de Acentuación Integral:** Se eliminaron al 100% todos los caracteres con doble codificación UTF-8 (mojibake como `ó`, `á`, `é`, `í`, `ñ`, etc.) en mensajes de error, advertencias, títulos y menús.

---

## 2. Módulo 1: Blindaje de Máquina (Solución al Desfasamiento TXWW2 -> TXWW1)

### 2.1. Diagnóstico Forense: ¿Por qué la PC revertía a TXWW1 al reiniciar?
Al realizar la prueba instalando el sistema en la Máquina 2 y reiniciar la computadora, se presentó el siguiente comportamiento:
- En la interfaz de captura, el sistema cargaba los datos correspondientes a `TXWW1` (Línea 1).
- Al entrar al menú de configuración, la máquina seleccionada visualmente marcaba `TXWW2` (Línea 2).

La investigación de código y arquitectura reveló las siguientes causas concurrentes:
1. **Dispersión de Perfiles de Edge entre Usuarios de Windows:** El acceso directo ejecutaba Edge con `--user-data-dir="%LOCALAPPDATA%\PalletsWW_EdgeProfile"`. Cuando el técnico configuraba la máquina bajo la cuenta `Administrador`, los datos de `localStorage` se guardaban en `C:\Users\Administrador\AppData\Local\...`. Al reiniciar e iniciar sesión automática con la cuenta genérica `Operador`, Edge abría un directorio de datos completamente vacío (`C:\Users\Operador\AppData\Local\...`), sin ninguna configuración previa.
2. **Fallback Silencioso a Máquina 9 en Código:** Al no encontrar la clave `pallets_no_maquina` en el almacenamiento local del navegador, el código de `CapturaPallets.razor` tenía un valor por defecto histórico `private int _noMaquina = 9;` (`TXWW1`). En consecuencia, la aplicación asumía silenciosamente la Línea 1.
3. **Desincronización con el Agente Zebra:** El archivo `settings.json` sí tenía guardado `noMaquina: 16` porque residía en `ProgramData`, pero la página web de captura no leía `settings.json` en su inicialización primaria, sino `localStorage`.

### 2.2. Arquitectura Implementada: El "Triple Candado"

Para garantizar inmunidad absoluta contra reinicios, cierres de sesión y cambios de cuenta de Windows, se implementó el **Triple Candado**:

```
+-----------------------------------------------------------------------------------+
|                            TRIPLE CANDADO DE PERSISTENCIA                        |
+-----------------------------------------------------------------------------------+
|  CANDADO 1: Parámetro URL Inmutable                                               |
|  - El acceso directo en Escritorio y Menú Inicio arranca con:                     |
|    http://10.26.24.37:5106/?maquina=16                                            |
|  - Tiene máxima precedencia. No depende de cookies ni de almacenamiento web.      |
+-----------------------------------------------------------------------------------+
|  CANDADO 2: Perfil Compartido de Edge a Nivel PC                                  |
|  - Argumento Edge: --user-data-dir="C:\ProgramData\PalletsWW_EdgeProfile"         |
|  - Permisos ACL BUILTIN\Users: Control Total (FullControl).                       |
|  - Administrador y Operador comparten exactamente el mismo localStorage.          |
+-----------------------------------------------------------------------------------+
|  CANDADO 3: settings.json Sincronizado en C:\ProgramData\PalletsWW_ZebraBridge    |
|  - Archivo JSON accesible por el servicio local PalletsPrintBridge en puerto 9100.|
|  - Si la URL no lleva parámetro, el servicio local inyecta la máquina asignada.   |
+-----------------------------------------------------------------------------------+
|  CANDADO DE BLOQUEO DE SEGURIDAD (ANTI-ERROR OPERATIVO):                          |
|  - Si _noMaquina == 0 (terminal sin configurar):                                  |
|    * Se bloquea la pantalla de captura con banner rojo prominente.                |
|    * Se inhabilitan los botones "Nuevo Vale", "Guardar" y "Captura por Lotes".    |
|    * No se permite ninguna inserción en base de datos.                            |
|    * Se muestra enlace directo al Menú de Configuración para asignarla.           |
+-----------------------------------------------------------------------------------+
```

---

## 3. Módulo 2: Corrección de Doble Ventana al Iniciar Sesión Operador

### 3.1. Causa Raíz
El script de instalación `Instalar_PC_Cliente_final.ps1` configuraba el auto-arranque en dos ubicaciones simultáneas:
1. `CommonStartup`: `C:\ProgramData\Microsoft\Windows\Start Menu\Programs\Startup\Pallets WW.lnk` (Se ejecuta para cualquier usuario que inicie sesión).
2. Perfil Privado del Usuario: `C:\Users\Operador\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\Pallets WW.lnk`.

Cuando el usuario `Operador` iniciaba sesión en Windows, el subsistema de inicio de sesión de Windows ejecutaba ambos accesos directos, disparando dos instancias simultáneas de Microsoft Edge en pantalla completa.

### 3.2. Solución Aplicada
Se modificó `Instalar_PC_Cliente_final.ps1` y la lógica interna de auto-arranque en `Program.cs` del agente:
- El único lugar donde reside el auto-arranque de la aplicación es `CommonStartup` (`C:\ProgramData\...\Startup`).
- El instalador recorre todos los perfiles de `C:\Users\*` y **purga activamente** cualquier acceso directo residual `Pallets WW.lnk` o `PalletsPrintBridge.lnk` ubicado en sus carpetas privadas de `Startup`.
- **Resultado:** Al iniciar sesión el operador, Windows ejecuta únicamente la entrada pública, abriendo una sola ventana maximizada.

---

## 4. Módulo 3: Análisis Forense - Falla de Impresión USB tras Modificaciones Visuales

### 4.1. Arquitectura de Impresión: Servidor IIS vs Clientes USB
Es indispensable recordar la arquitectura de despliegue del sistema:
- **Servidor Central IIS (`10.26.24.37` o `172.26.52.14`):** Aloja la aplicación web compilada (`PalletsWW_PC.Web` y `PalletsWW_PC.Api`). El servidor **NO** tiene conectadas las impresoras físicas en sus puertos USB locales.
- **Terminales Cliente (PCs de Producción en Líneas 1 a 7):** Son computadoras Windows donde los operadores visualizan la aplicación web en Edge y tienen físicamente conectada una impresora Zebra mediante cable USB.
- **Agente Local `PalletsPrintBridge`:** Se ejecuta localmente en cada PC cliente escuchando en `http://127.0.0.1:9100`. Recibe el código ZPL desde el navegador web y lo escribe directamente al puerto RAW de la impresora USB de esa PC.

```
+--------------------------------------------------------------------------------+
|  CLIENTE EN LÍNEA DE PRODUCCIÓN (PC FÍSICA CON IMPRESORA)                      |
|                                                                                |
|  [ Microsoft Edge - Blazor Client ]                                            |
|          │                                                                     |
|          │ 1. JavaScript fetch() / checkStatus()                               |
|          ▼                                                                     |
|  [ Agente Local PalletsPrintBridge ] (127.0.0.1:9100)                          |
|          │                                                                     |
|          │ 2. Win32 RawPrinterHelper (Escape USB directo)                      |
|          ▼                                                                     |
|  [ Impresora Zebra USB ] ─── Imprime Etiqueta Física                           |
+────────────────────────────────────────────────────────────────────────────────+
           ▲                                                                     
           │ SignalR WebSocket (Solo lógica de negocio, datos y UI)              |
           ▼                                                                     
+────────────────────────────────────────────────────────────────────────────────+
|  SERVIDOR CENTRAL IIS (10.26.24.37:5106)                                       |
|  [ PalletsWW_PC.Web + Blazor Server Circuit ]                                  |
|  (El servidor central NO puede imprimir directamente por USB a los clientes)   |
+--------------------------------------------------------------------------------+
```

### 4.2. ¿Por qué dejó de imprimir tras los cambios de diseño y cómo evitarlo?
Al realizar mejoras estéticas en la vista de captura (rediseño de filas, botones y tablas), se presentaron cuatro fallas sutiles que rompieron la comunicación con el agente USB:

1. **Pérdida del Despachador de Blazor (`Task.Run` vs `InvokeAsync`):**
   - *Falla:* Al envolver operaciones de UI o consultas de estado de impresión dentro de `Task.Run(...)` sin sincronización, el hilo en segundo plano perdió el `Circuit Dispatcher` de Blazor Server. Cuando el método intentó invocar `JSRuntime.InvokeAsync` para consultar el estado del servicio local de la impresora, Blazor lanzó una excepción silenciosa de desconexión del circuito.
   - *Regla de Oro:* **Toda llamada que interactúe con JavaScript (`IJSRuntime`) o modifique propiedades enlazadas a la UI debe ejecutarse en el hilo del despachador de Blazor mediante `await InvokeAsync(...)`.**

2. **Valores Nulos / Serialización en DTOs (`ZebraDtos.cs`):**
   - *Falla:* El modelo `ZebraBridgeStatusDto` y `PrintJobDto` carecían de inicializadores por defecto para propiedades como `Estado`, `Mensaje`, `Impresora`. Cuando el endpoint local de `PalletsPrintBridge` retornaba un JSON con campos en mayúsculas/minúsculas o propiedades nulas, el deserializador `System.Text.Json` de Blazor fallaba o dejaba `Online = false`.
   - *Regla de Oro:* **Los DTOs de comunicación con el puente USB deben contar con propiedades con valores iniciales seguros (`string.Empty`, listas vacías) y `PropertyNameCaseInsensitive = true`.**

3. **Ubicación y Carga de `zebra-bridge.js` en `App.razor`:**
   - *Falla:* Al reorganizar scripts en `App.razor`, `zebra-bridge.js` debe cargarse **después** de `_framework/blazor.web.js` para asegurar que las funciones globales en `window.PalletsZebra` estén disponibles cuando los componentes Blazor inicien su ciclo de vida (`OnAfterRenderAsync`).
   - *Regla de Oro:* **`zebra-bridge.js` debe permanecer al pie de `App.razor`, garantizando la disponibilidad de `window.PalletsZebra.checkStatus()` y `window.PalletsZebra.printZpl()`.**

4. **Preservación del Estado Local sin Fallback al Servidor:**
   - *Falla:* Un intento de "recuperación" intentaba redirigir la petición de impresión hacia la API del servidor IIS cuando el cliente fallaba. Dado que el servidor central no tiene la impresora USB del cliente, esto arrojaba un error de timeout y bloqueaba el botón de impresión.
   - *Regla de Oro:* **La impresión USB es 100% cliente local (`127.0.0.1:9100`). Si el agente local no responde, se debe mostrar de inmediato la alerta al operador para que verifique que el agente esté abierto o el cable USB conectado, sin intentar enviar la orden USB al servidor IIS.**

5. **Error Crítico de Sintaxis en Script Cliente (`zebra-print.js:341`):**
   - *Falla Detectada:* Al incorporar la consulta dinámica de máquina en el cliente, la línea 341 contenía:
     ```javascript
     const response = await fetch(http://127.0.0.1:/config, {  // ERROR: faltaban comillas invertidas y variable ${port}
     ```
   - *Efecto Inmediato:* Al cargar Microsoft Edge la página web, el motor V8 lanzaba un `Uncaught SyntaxError: missing ) after argument list`. Como consecuencia, el script completo era descartado por el navegador y el objeto `window.ZebraPrint` **nunca se inicializaba**. Cualquier llamada posterior de Blazor (`ZebraPrint.checkStatus` o `ZebraPrint.printZpl`) fallaba con `Could not find 'ZebraPrint' in 'window'`.
   - *Solución Aplicada:* Se corrigió la línea a ``const response = await fetch(`http://127.0.0.1:${port}/config`, {``, se validó con `node -c` (0 errores de sintaxis), se agregó el alias de compatibilidad `window.PalletsZebra = window.ZebraPrint;` y se incrementó el parámetro de cache en `App.razor` a `zebra-print.js?v=20260924_5` para forzar a Edge a descargar la versión corregida de inmediato.

### 4.3. Protocolo Operativo: ¿Qué hacer paso a paso si la app deja de imprimir?

Cuando en piso de producción se reporte que *"la app ya no se conecta a la impresora"* o *"no manda a imprimir"*, siga rigurosamente este protocolo en 5 minutos:

```
+---------------------------------------------------------------------------------------------------+
|                     CHECKLIST DE DIAGNÓSTICO RÁPIDO DE IMPRESIÓN ZEBRA USB                        |
+---------------------------------------------------------------------------------------------------+
| PASO 1: Abrir la Consola de Microsoft Edge (F12) en la PC Cliente                                |
| ─────────────────────────────────────────────────────────────────                                 |
| Presione F12 o Ctrl+Shift+I en la terminal. Vaya a la pestaña "Console".                          |
| • ¿Aparece 'Uncaught SyntaxError' en rojo en algún archivo .js?                                   |
|   -> Causa: Se introdujo un error tipográfico en JavaScript (ej. comillas, llaves faltantes).     |
|   -> Solución: Corregir el script en el servidor, validar con `node -c` y subir versión `?v=`.   |
| • ¿Aparece 'Could not find ZebraPrint in window'?                                                 |
|   -> Causa: El script no cargó o falló al inicio de la página.                                   |
|                                                                                                   |
| PASO 2: Probar el Agente Local en el Navegador de la PC Cliente                                   |
| ───────────────────────────────────────────────────────────────                                   |
| En la misma PC cliente, abra una pestaña nueva e ingrese:                                         |
|   http://127.0.0.1:9100/default?type=printer                                                      |
|   http://127.0.0.1:9100/config                                                                    |
| • ¿Devuelve un JSON con los datos de la impresora y la máquina?                                   |
|   -> El agente local está VIVO y funcionando al 100%. El problema está en la Web o JS.           |
| • ¿Dice 'No se puede acceder a este sitio' o 'Connection Refused'?                                |
|   -> El agente PalletsPrintBridge.exe no está corriendo en esa PC.                               |
|   -> Solución: Abrir Administrador de Tareas -> Iniciar C:\ProgramData\PalletsWW_ZebraBridge\     |
|      PalletsPrintBridge.exe o reinstalar con Instalar_PC_Cliente_final.ps1.                       |
|                                                                                                   |
| PASO 3: Probar Impresión Directa por RAW via PowerShell en la PC Cliente                          |
| ────────────────────────────────────────────────────────────────────────                         |
| Abra PowerShell en la PC cliente y ejecute:                                                       |
|   Invoke-RestMethod -Uri "http://127.0.0.1:9100/write" -Method POST -Body '{"device":{"name":    |
|   "Zebra"},"data":"^XA^FO50,50^ADN,36,20^FDPRUEBA DIRECTA^FS^XZ"}' -ContentType "application/json"|
| • ¿Salió la etiqueta física?                                                                     |
|   -> El cable USB, el driver y la impresora física están PERFECTOS.                               |
| • ¿No sale nada o parpadea en rojo?                                                               |
|   -> La impresora física está pausada (botón PAUSE), sin etiquetas, o cable USB desconectado.     |
|                                                                                                   |
| PASO 4: Validar Sintaxis JS en el Servidor Antes de Publicar                                      |
| ───────────────────────────────────────────────────────────                                       |
| Antes de cualquier publicación a IIS, ejecute en la consola del servidor:                         |
|   node -c "C:\...\PalletsWW_PC.Web\wwwroot\js\zebra-print.js"                                     |
| Si devuelve 0 errores (sin texto), el JavaScript es completamente válido.                         |
|                                                                                                   |
| PASO 5: Forzar Ruptura de Caché (Cache-Busting) en App.razor                                      |
| ────────────────────────────────────────────────────────────                                       |
| Los navegadores en modo kiosco retienen agresivamente los archivos .js viejos en memoria.        |
| Al modificar cualquier script JS, incremente el número de versión en App.razor:                   |
|   <script src="js/zebra-print.js?v=20260924_6"></script>                                          |
| Y recicle el Application Pool de IIS en C:\PublishIIS\PalletsWW_PC.Blazor.Publish\web.config.      |
+---------------------------------------------------------------------------------------------------+
```

### 4.4. Matriz Rápida de Síntomas, Causa Raíz y Solución Inmediata

| Síntoma en Pantalla | Diagnóstico Técnico | Causa Raíz | Acción Inmediata |
| :--- | :--- | :--- | :--- |
| **Semáforo en Rojo:** *"No se detectó el Agente Zebra USB en esta PC"* | F12 muestra `Could not find 'ZebraPrint'` o `fetch(127.0.0.1:9100)` da timeout. | 1. `zebra-print.js` tiene error de sintaxis y no cargó.<br>2. `PalletsPrintBridge.exe` está cerrado en la PC cliente. | 1. Corregir sintaxis con `node -c`.<br>2. Verificar en el Administrador de Tareas que `PalletsPrintBridge.exe` esté activo. |
| **Botón Imprimir no responde:** *"Error al invocar ZebraPrint.printZpl"* | Blazor perdió el circuito SignalR o el objeto JS no está en `window`. | Se invocó JavaScript dentro de `Task.Run` descolgado sin despachador Blazor. | Asegurar que la llamada se realice con `await JS.InvokeAsync(...)` en el hilo principal de Blazor. |
| **Semáforo en Amarillo:** *"Impresora Pausada"* | El agente local reporta `isPaused = true`. | El operador presionó el botón físico PAUSE en la Zebra o el cabezal térmico quedó abierto. | Presionar el botón PAUSE en la impresora Zebra o cerrar la palanca del cabezal. |
| **Advertencia:** *"Cola de impresión saturada (X trabajos)"* | El agente reporta `cJobs > 3`. | Hay trabajos atorados en el spooler de Windows por haber mandado imprimir con cable USB desconectado. | Clic en el botón **"Purgar Cola"** en la app o reiniciar el servicio `Spooler` de Windows. |
| **La app imprime en otra PC pero no en esta:** | Error específico de esa terminal. | 1. Cable USB flojo.<br>2. Impresora apagada.<br>3. El agente local no arrancó en el inicio de Windows. | Revisar conexión física USB y ejecutar el acceso directo de `PalletsPrintBridge`. |

### 4.5. Tabla Comparativa de Buenas Prácticas (Qué NUNCA hacer vs Qué SIEMPRE hacer)

| Aspecto de Código | ❌ QUÉ NUNCA HACER (Causa fallas) | ✅ QUÉ SIEMPRE HACER (Estándar blindado) |
| :--- | :--- | :--- |
| **Llamadas a JavaScript (`IJSRuntime`)** | `Task.Run(async () => await JS.InvokeVoidAsync(...))` *(Pierde el despachador de Blazor)* | `await JS.InvokeVoidAsync(...)` directamente o envuelto en `await InvokeAsync(...)` |
| **Llamadas HTTP desde Blazor Server** | Intentar hacer `HttpClient.PostAsync("http://127.0.0.1:9100/...")` desde C# *(Se ejecuta en el servidor IIS, NO en la PC del cliente)* | Toda llamada a `127.0.0.1:9100` debe ser vía **JavaScript (`fetch` en el navegador del cliente)** |
| **Edición de Scripts JS** | Modificar `zebra-print.js` y publicar sin validar sintaxis | Correr `node -c zebra-print.js` para asegurar 0 errores antes de desplegar |
| **Caché del Navegador** | Dejar `<script src="js/zebra-print.js"></script>` estático | Utilizar siempre cache-busting: `<script src="js/zebra-print.js?v=TIMESTAMP"></script>` |
| **Modelos DTO (`ZebraDtos.cs`)** | Propiedades tipo string sin inicializar (`public string Printer { get; set; }`) | Inicializar con valor seguro: `public string Printer { get; set; } = string.Empty;` |

### 4.6. Implementación de la Opción A: Blindaje y Congelación de Código Frontend

Para garantizar que ningún cambio futuro de diseño o estética vuelva a interrumpir el servicio de impresión, se ejecutó formalmente la **Opción A de Blindaje**:

1. **Declaración de Código Congelado (Frozen Code):**
   - Los archivos `PalletsWW_PC.Web/wwwroot/js/zebra-print.js` y `PalletsWW_PC.Web/Models/Dtos/ZebraDtos.cs` quedan catalogados como componentes de infraestructura crítica.
   - Cualquier requerimiento estético (bordes, colores, espaciados, modales) debe atenderse exclusivamente en hojas de estilo CSS o estructura HTML del componente, sin modificar las funciones del conector de hardware.
2. **Script de Publicación Blindada (`Publicar_Web_IIS_Blindado.ps1`):**
   - Se integró el script maestro en la raíz del repositorio (`c:\AI\Git Hub\PROY052_PalletsPanal\Publicar_Web_IIS_Blindado.ps1`).
   - Antes de copiar cualquier archivo a `C:\PublishIIS\`, el script ejecuta automáticamente la validación sintáctica `node -c zebra-print.js`.
   - **Regla de Bloqueo:** Si el script detecta un error de sintaxis en JavaScript, el proceso de publicación se cancela de forma inmediata, emite una alarma en color rojo en la consola y deja intactos los archivos productivos en IIS para proteger la operación continua de la planta.
   - Si la validación y la compilación son 100% exitosas, el script publica en caliente y recicla los Application Pools de IIS automáticamente.

---

## 5. Módulo 4: Permisión de Pallets con Misma Hora en Diferentes Líneas

### 5.1. Regla de Negocio en Planta
En el Departamento 3 de Wet Wipes, un mismo vale de producción ampara el turno de trabajo y puede registrar producción de múltiples líneas físicas de empaque.
- **Caso Permitido:** A las `11:30` se produce un pallet en la **Línea 1**, y a las `11:30` se produce otro pallet en la **Línea 2**. Ambos pallets pertenecen al mismo vale, pero tienen líneas distintas. **Esto es 100% válido y debe permitirse.**
- **Caso Prohibido (Duplicado Real):** Registrar dos pallets a las `11:30` ambos en la **Línea 1** dentro del mismo vale. **Esto debe bloquearse.**

### 5.2. Implementación en Base de Datos (SP `pa_P009_01006_tblPalletsInsertcmdV9`)
En el stored procedure `TLX022MXDB.dbo.pa_P009_01006_tblPalletsInsertcmdV9`, el candado de unicidad histórica (Candado 3.1) extrae la línea de producción desde el campo `Lote` (donde los caracteres penúltimo y antepenúltimo representan la línea, ej. `01`, `02`):

```sql
-- Extracción segura de la línea de 2 dígitos del parámetro @Lote
DECLARE @LineaPad CHAR(2) = '';
IF @Lote IS NOT NULL AND LEN(RTRIM(@Lote)) >= 3
BEGIN
    SET @LineaPad = LEFT(RIGHT(RTRIM(@Lote), 3), 2);
END

-- CANDADO 3.1: Validar que no exista un pallet con la misma HORA Y MISMA LÍNEA en el mismo Vale y Turno
IF EXISTS (
    SELECT 1 
    FROM dbo.tblPallets WITH (NOLOCK)
    WHERE FolioVale = @FolioVale 
      AND IdRT_Encabezado = @IdRT_Encabezado
      AND Hora = @Hora
      AND (@LineaPad = '00' OR @LineaPad = '' OR LEFT(RIGHT(RTRIM(Lote), 3), 2) = @LineaPad)
)
BEGIN
    SET @MensajeError = 'CANDADO ANTI-DUPLICIDAD: Ya existe un pallet registrado en este vale a las ' 
                      + @Hora + ' para la línea ' + @LineaPad + '.';
    RAISERROR(@MensajeError, 16, 1);
    RETURN -301;
END
```

### 5.3. Implementación en Backend API (`PalletRepository.cs`)
En `InsertarLotePalletsAsync`, la validación de unicidad en memoria para la captura por lotes utiliza una tupla compuesta `(HoraNormalizada, LineaNormalizada)`:

```csharp
// Validación contra tarimas internas del lote
var paresLote = new HashSet<(string Hora, string Linea)>();
foreach (var item in request.Pallets)
{
    var hNorm = NormalizarHoraStr(item.Hora);
    var lNorm = NormalizarLineaStr(item.Linea);
    if (!paresLote.Add((hNorm, lNorm)))
    {
        result.Mensaje = $"Operación cancelada: El lote contiene la hora {hNorm} repetida en la línea {lNorm}.";
        return result;
    }
}
```

### 5.4. Implementación en Frontend Web (`CapturaPallets.razor`)
Tanto en la captura individual (`GuardarNuevoPallet`), en la edición de filas (`GuardarFilaEdicionAsync`), como en la captura por lotes (`GuardarLotePallets`), la verificación se realiza sobre el par `(hora, linea)`:

```csharp
// En CapturaPallets.razor
string lineaNorm = NormalizarLinea(_lineaEmpaqueFila);
bool existeMismaHoraYLinea = _palletsVale.Any(p => 
    NormalizarHora(p.Hora) == horaNorm && 
    NormalizarLinea(p.Linea) == lineaNorm
);

if (existeMismaHoraYLinea)
{
    MostrarToast($"Operación cancelada: Ya existe una tarima registrada a las {horaNorm} en la línea {lineaNorm} para este vale.", "warning");
    return;
}
```

---

## 6. Módulo 5: Auto-Focus Operativo en la Hora del Pallet

### 6.1. Requerimiento Ergonómico
Durante la captura continua al final del turno o lote, el operador digita la hora del pallet (ej. `11:30`), presiona **Enter** o da clic en **Guardar**, el pallet se inserta y se imprime. Para capturar el siguiente pallet, el operador requería volver a tomar el ratón y dar clic en el campo de la hora.

### 6.2. Solución Técnica
1. Se asignó un identificador unívoco al input de hora en `CapturaPallets.razor`:
   ```html
   <input type="text" id="input-nueva-hora" class="form-control text-center fw-bold" ... />
   ```
2. Se implementó la función auxiliar en C#:
   ```csharp
   private async Task EnfocarNuevaHoraAsync()
   {
       try
       {
           await JSRuntime.InvokeVoidAsync("window.PalletsZebra.enfocarElemento", "input-nueva-hora");
       }
       catch { }
   }
   ```
3. En `zebra-bridge.js`, se implementó la función `enfocarElemento(id)`:
   ```javascript
   enfocarElemento: function(elementId) {
       setTimeout(function() {
           var el = document.getElementById(elementId);
           if (el) {
               el.focus();
               if (typeof el.select === "function") {
                   el.select();
               }
           }
       }, 60);
   }
   ```
4. Se agregó la invocación automática inmediatamente después de guardar el pallet:
   ```csharp
   await ScrollTablaAlFinal();
   await EnfocarNuevaHoraAsync();
   ```
   **Resultado:** Tras guardar o dar Enter, el campo de la hora queda enfocado con el texto seleccionado, listo para sobreescribir la hora del siguiente pallet de manera inmediata.

---

## 7. Módulo 6: Limpieza Integral Ortográfica y UTF-8

Se realizó una auditoría y limpieza sistemática en el código fuente de la solución, reemplazando todas las secuencias corruptas por su grafía en español estándar:

| Texto Anterior (Mojibake) | Texto Corregido |
| :--- | :--- |
| `Configuración` | `Configuración` |
| `Máquina` / `MQUINA` | `Máquina` / `MÁQUINA` |
| `Línea` | `Línea` |
| `Contraseña` | `Contraseña` |
| `Producción` | `Producción` |
| `Módulo` | `Módulo` |
| `Sesión` | `Sesión` |
| `Menú` | `Menú` |
| `¡ATENCIÓN!` | `¡ATENCIÓN!` |
| `Límite` | `Límite` |
| `Físico` | `Físico` |
| `Único` | `Único` |
| `⚠️` | `⚠️` |

La verificación de integridad arrojó **0 ocurrencias** de caracteres de doble codificación en todos los proyectos de la solución.

---

## 8. Verificación de Compilación y Publicación en IIS

- **Compilación en Release:**
  - `PalletsPrintBridge`: 0 Errores.
  - `PalletsWW_PC.Api`: 0 Errores.
  - `PalletsWW_PC.Web`: 0 Errores.
- **Despliegue en IIS:**
  - `PalletsWW_PC.Web` publicado en: `C:\PublishIIS\PalletsWW_PC.Blazor.Publish\`
  - `PalletsWW_PC.Api` publicado en: `C:\PublishIIS\PalletsWW_PC.Api.Publish\`
  - Se actualizaron las marcas de tiempo (`touch`) de ambos archivos `web.config`, reciclando limpiamente los Application Pools de IIS.
- **Base de Datos:** Stored Procedure `pa_P009_01006_tblPalletsInsertcmdV9` ejecutado y activo en el catálogo de producción `TLX022MXDB`.

---

## 9. Lista de Control para Pruebas en Planta

1. **Prueba de Persistencia de Máquina:**
   - En una PC cliente, abrir la aplicación (ej. configurada como `TXWW2`).
   - Reiniciar completamente la computadora.
   - Iniciar sesión con la cuenta de operador.
   - Confirmar que la aplicación abre automáticamente en pantalla completa, muestra exactamente **una sola ventana**, y mantiene la máquina `TXWW2` seleccionada.
2. **Prueba de Impresión USB:**
   - Verificar que el indicador en la esquina superior derecha muestre estado en color verde ("Zebra USB Conectada").
   - Mandar a imprimir una etiqueta individual y una prueba de estado desde el menú de configuración.
3. **Prueba de Pallet con Misma Hora en Distinta Línea:**
   - Registrar un pallet a las `11:30` en la Línea 1.
   - Registrar otro pallet a las `11:30` en la Línea 2 dentro del mismo vale.
   - El sistema debe permitir el guardado y la impresión de ambos sin generar error.
   - Intentar registrar un tercer pallet a las `11:30` en la Línea 1 (misma línea): el sistema debe mostrar la advertencia y bloquear la inserción.
4. **Prueba de Ergonomía (Auto-Focus):**
   - Escribir la hora en la fila de captura, presionar Enter.
   - Verificar que tras guardarse, el cursor regresa solo a la caja de texto de la hora sin necesidad de tocar el ratón.

---

## 10. Módulo 7: Control Dinámico de Scroll y Rediseño Moderno del Menú Lateral

### 10.1. Diagnóstico de Visibilidad y Scroll de Ventana
- **Problema Detectado en Planta:** Al capturar tarimas en la vista normal (ej. tarima 18 y fila de captura en tarima 19), la página ejecutaba un `scrollIntoView` global de ventana hacia el pie del documento. Esto provocaba que los operadores tuvieran que scrollear hacia abajo, desplazando y ocultando la cabecera superior (Cockpit con Máquina, Turno, Fecha, Tripulación, Operador e información del Vale activo).
- **Comportamiento Requerido:** 
  1. **En Captura Normal (`_esTurnoAnterior == false`):** La vista completa (cabecera de máquina, tarjetas de vales y las filas de captura) debe apreciarse 100% visible en una sola pantalla estática sin scroll general de ventana (como en la Imagen 2 de referencia).
  2. **En Consulta de Vale Turno Anterior (`_esTurnoAnterior == true`):** Se activa dinámicamente el scroll vertical expandido, permitiendo revisar las hasta 38 tarimas del turno previo y la alerta amarilla de sólo lectura sin desbordar la interfaz.

### 10.2. Ajustes Técnicos de Scroll en Frontend (`CapturaPallets.razor` y `app.css`)
1. **Encapsulamiento Dinámico por Tipo de Vista:**
   - Se añadió una clase dinámica al contenedor raíz de la vista:
     ```razor
     <div class="container-fluid px-3 py-1 @(_esTurnoAnterior ? "vista-turno-anterior" : "vista-captura-normal")">
     ```
2. **Dimensionamiento del Contenedor de la Tabla (`#palletsTableContainer`):**
   - Se retiró la altura fija forzada `max-height: 515px` en línea.
   - En CSS se calibraron alturas máximas diferenciadas:
     ```css
     .vista-captura-normal #palletsTableContainer {
         max-height: 385px;
         min-height: 250px;
         overflow-y: auto;
     }
     .vista-turno-anterior #palletsTableContainer {
         max-height: 480px;
         overflow-y: auto;
     }
     ```
3. **Eliminación del Salto Global de Ventana en JavaScript (`ScrollTablaAlFinal`):**
   - Se removió la llamada intrusiva:
     `lastRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });`
   - Se sustituyó por desplazamiento exclusivo dentro del div interno con scrollbar de la tabla:
     `el.scrollTop = el.scrollHeight;`
   - Esto garantiza que tras guardar un pallet o pulsar Enter, la fila de captura activa se mantenga a la vista dentro de su tarjeta, mientras la cabecera del cockpit permanece anclada e inamovible en la parte superior.
4. **Remoción de Relleno Muerto Inferior:**
   - En `app.css`, se sustituyó `padding-bottom: 5rem !important;` (80px de espacio en blanco) en `.content-body` por `padding-top: 0.5rem !important; padding-bottom: 0.5rem !important;`, ganando el espacio vertical exacto para acomodar todo el contenido sin forzar la barra de desplazamiento del navegador.

### 10.3. Rediseño Moderno del Menú Desplegable Izquierdo (Dark Obsidian Glass)
Bajo la directiva estricta de no alterar ninguna lógica de ruteo, eventos ni parámetros C#, se modernizó la apariencia visual del menú lateral:
- **Estilo Obsidian Dark:** Fondo en gradiente sutil `#090e1a` a `#0d1527` con borde derecho cian de alta definición (`rgba(56, 189, 248, 0.12)`).
- **Logotipo y Marca:** Icono en caja flotante con gradiente azul eléctrico (`#0284c7` a `#2563eb`), relieve y texto `Pallets WW` con efecto gradiente de brillo metálico.
- **Píldoras de Navegación Glassmorphism:**
  - Botones con esquinas redondeadas (`10px`), transición suave `transform: translateX(2px)` y cajas de icono independientes (`.nav-icon-box`).
  - Estado activo con barra indicadora lateral vertical (`linear-gradient(180deg, #38bdf8, #2563eb)`), fondo en brillo azul translúcido y relieve neón.
- **Card de Estado Inferior:**
  - Tarjeta oscura con efecto de cristal esmerilado (`backdrop-filter: blur(8px)`), tipografía técnica y punto LED pulsante en verde esmeralda (`#10b981`), certificando el estado operativo en vivo.
- **Integridad de Código:** Se preservaron intactos los componentes `<NavLink>`, directivas `@onclick`, parámetros `IsCollapsed` y el callback `OnToggleCollapse`.

---

## 11. Módulo 8: Diagnóstico Forense y Solución Integral - Acceso Directo de Barra de Tareas y Blindaje de Máquina

### 11.1. Diagnóstico Forense: ¿Por qué a veces el icono de la Barra de Tareas no abría?
1. **Conflicto del Modo `--user-data-dir` con Microsoft Edge Startup Boost:**
   - En Windows, Microsoft Edge ejecuta por defecto un proceso en segundo plano en espera (`--no-startup-window`) para acelerar su inicio.
   - El acceso directo anterior invocaba:
     `msedge.exe --app="http://..." --user-data-dir="C:\Users\...\AppData\Local\PalletsWW_EdgeProfile"`
   - Al tener una ruta de perfil personalizada (`--user-data-dir`), cuando el operador cerraba la ventana, si quedaban subprocesos huérfanos de Edge en memoria o el bloqueo de instancia única (*SingletonLock*) estaba activo, al dar clic nuevamente en el icono de la barra de tareas, Edge enviaba la señal a la instancia en segundo plano pero **no creaba ninguna ventana nueva**.
   - El proceso se cerraba en 0 ms silenciosamente y para el operador **"la app no abre"**.
2. **Solución Implementada:**
   - Se removió el parámetro conflictivo `--user-data-dir` de los accesos directos.
   - El acceso directo ahora ejecuta el modo aplicación nativo de Edge:
     `msedge.exe --app="http://10.26.24.37:5106/?maquina=X" --start-maximized`
   - Sin profile locks artificiales, Windows y Edge reconocen la aplicación como una PWA independiente y **abren la ventana de inmediato al 100% de las veces**.

### 11.2. Diagnóstico Forense: ¿Por qué la aplicación llegaba a perder la máquina?
1. **Ausencia del parámetro en el acceso de Barra de Tareas:**
   - El script anterior creaba el acceso con `http://10.26.24.37:5106/` sin el parámetro `?maquina=...`.
2. **Limpieza del parámetro al navegar en el menú (`NavMenu.razor`):**
   - El enlace de "Captura de Pallets" en el menú lateral tenía `href=""`.
   - Cuando el operador hacía clic en el menú o navegaba entre páginas, la URL en la barra de direcciones cambiaba de `/?maquina=16` a `/`.
   - Al recargar la página (F5 o por el watchdog de auto-reconexión), la URL ya no tenía la máquina.
3. **Falta de persistencia en Cookie:**
   - La máquina sólo se intentaba leer de `localStorage` o del puente local. Si el perfil cambiaba o el servicio local tardaba en responder, `_noMaquinaSeleccionada` quedaba en 0 y mostraba *"⚠️ Sin Asignar"*.

### 11.3. Arquitectura de Quíntuple Candado de Persistencia (Imposible de Perder)
Para asegurar que la máquina asignada a la terminal **NUNCA** vuelva a perderse:
1. **Candado 1 (Parámetro URL Activo):**
   - El acceso directo incluye `?maquina=X`.
   - En `NavMenu.razor`, los enlaces preservan automáticamente el parámetro: `href="@GetCapturaUrl()"`.
2. **Candado 2 (Auto-Sincronización en Barra de Direcciones):**
   - Si la terminal entra sin parámetro (ej. `http://.../`), pero la máquina es detectada por cualquier otro candado, Blazor actualiza la barra de direcciones de inmediato con `Navigation.NavigateTo("/?maquina=X", replace: true)`.
3. **Candado 3 (Cookie de Larga Duración - 10 años):**
   - Cada vez que se detecta o asigna una máquina, se escribe la cookie `PalletsWW_Maquina=X; path=/; max-age=315360000; SameSite=Lax`. Las cookies sobreviven a reinicios de navegador y limpiezas de caché de sesión.
4. **Candado 4 (LocalStorage y SessionStorage Dual):**
   - Se mantiene sincronizado `PalletsWW_MaquinaId` en ambos almacenamientos web del navegador.
5. **Candado 5 (Puente Local Zebra y settings.json):**
   - `C:\ProgramData\PalletsWW_ZebraBridge\settings.json` y `C:\ArchivosBitacoraAut\Maquina.txt` permanecen como respaldo físico en el disco duro de la máquina.

### 11.4. Corrección Integral de Iconos y Ortografía en Menú Lateral
1. **Diseño de Iconos Centrados en Modo Colapsado:**
   - Se recalibró el contenedor de iconos a `48px x 48px` con `margin: 4px auto` y `padding: 0 !important; justify-content: center`.
   - El tamaño de los glifos aumentó a `1.25rem` con alto contraste y colores vivos (Cian para Captura, Ámbar para Reportes, Esmeralda para Configuración).
   - En estado activo, el botón colapsado adopta un fondo en gradiente azul eléctrico (`#0284c7` a `#2563eb`) con halo neón y glifo blanco puro, idéntico al estándar visual aprobado.
2. **Erradicación Total de Mojibake (UTF-8 con BOM):**
   - Todos los archivos fuente (.razor, .css, .js, .cs) fueron depurados y guardados estrictamente en **UTF-8 con BOM**.
   - Los títulos, tooltips y botones del menú muestran correctamente sus acentos: *"Configuración"*, *"Reportes de Producción"*, *"Expandir menú"*, *"Colapsar menú"*.

---

## 12. Instalador Todo-en-Uno Autónomo y Corrección de Cambio de Servidor Central (Default: 10.26.24.31)

### 12.1. Diagnóstico del Fallo en el Cambio de IP del Servidor desde la App
Al probar la sección de "Servidor Central" en el menú de Configuración:
1. **Redirección sin Parámetro de Máquina:**
   - Anteriormente, `GuardarServidorAsync` ejecutaba `Navigation.NavigateTo($"http://{cleanIp}:5106/configuracion", forceLoad: true)`.
   - Al no incluir `?maquina={_maquinaSeleccionada}` y dado que las cookies del navegador están aisladas estrictamente por IP/Host de origen, la nueva IP (`10.26.24.31`) no tenía aún las cookies de la IP anterior (`10.26.24.37`), provocando que la aplicación "perdiera la máquina" en la nueva dirección.
2. **Desconexión con el Microservicio Local:**
   - La llamada de JavaScript `saveServerConfig` no enviaba el ID de máquina ni el nombre a la petición `POST /config` al puerto local `9100`. Si `localStorage` no estaba poblado en ese instante, el puente local registraba `machineId: 0`, borrando el parámetro de los accesos directos de Windows.
3. **Persistencia del Parámetro Conflictivo `--user-data-dir`:**
   - El método `ActualizarAccesosDirectos` en `PalletsPrintBridge` todavía conservaba el argumento `--user-data-dir`, reintroduciendo los bloqueos en segundo plano de Edge al cambiar de servidor.

### 12.2. Solución Implementada para el Cambio de IP en Caliente
1. **Conservación de la Máquina en la Redirección:**
   - `GuardarServidorAsync` ahora redirige a:
     `http://{cleanIp}:5106/configuracion?maquina={_maquinaSeleccionada}`
   - Al cargar la nueva IP con el query string de la máquina, `App.razor` y `CapturaPallets.razor` registran inmediatamente las cookies y el almacenamiento local bajo la nueva IP de forma 100% transparente.
2. **Transmisión Completa de Parámetros al Microservicio:**
   - `saveServerConfig` ahora envía `{ serverIp: cleanIp, machineId: _maquinaSeleccionada, machineName: nombre }`.
   - `PalletsPrintBridge` actualiza `settings.json` y regenera todos los accesos directos de Windows con el modo app nativo:
     `msedge.exe --app="http://10.26.24.31:5106/?maquina=X" --start-maximized`
3. **Estandarización del Servidor por Defecto a `10.26.24.31`:**
   - Actualizado en `Configuracion.razor`, `App.razor` (splash screen y watchdog), `zebra-print.js`, `Servidor.txt`, `CrearAccesoDirecto.ps1` e `Instalar_PC_Cliente.ps1`.

### 12.3. Nuevo Instalador Todo-en-Uno Autónomo (`Setup_PalletsWW_Cliente.exe`)
Para sustituir la carpeta con múltiples scripts dispersos (`.bat`, `.ps1`, `.txt`, `.ico`, `.exe`), se desarrolló un instalador gráfico industrial en **.NET 8 WinForms**, empaquetado como **un único ejecutable autocontenido** (`Setup_PalletsWW_Cliente.exe`):
1. **Características Principales:**
   - **Archivo Único (Single-File Self-Contained):** Contiene internamente el runtime de .NET 8, el agente `PalletsPrintBridge.exe`, el icono oficial `pallets_ww.ico` y todas las rutinas de configuración. No requiere instalar frameworks ni dependencias externas.
   - **Auto-Elevación a Administrador (UAC):** Al hacer doble clic, si la sesión no es de Administrador, solicita automáticamente permisos elevados sin necesidad de scripts `.bat` adicionales.
   - **Detección Inteligente de Máquina:** Escanea automáticamente `C:\ArchivosBitacoraAut\Maquina.txt` y `settings.json`. Si la PC ya tenía una línea asignada (ej. Línea 7), la pre-selecciona automáticamente y muestra el distintivo *"✓ Línea detectada automáticamente en esta PC"*.
   - **Servidor Central por Defecto:** Configurado de fábrica a `10.26.24.31` (Puerto 5106), editable en la misma interfaz si fuera necesario.
   - **Automatización Completa en 2 Segundos:**
     * Detiene instancias previas.
     * Desempaqueta y otorga permisos de Control Total (`BUILTIN\Users`) en `C:\ProgramData\PalletsWW_ZebraBridge\`.
     * Registra el inicio automático en `CommonStartup` y purga accesos duplicados en perfiles privados.
     * Inicia el microservicio de impresión en segundo plano (puerto `9100`).
     * Crea los accesos directos en Modo App Nativo en Escritorio Público, Menú Inicio y Barra de Tareas.
     * Realiza un test en tiempo real contra `http://127.0.0.1:9100/default?type=printer` e informa el nombre de la impresora Zebra USB conectada.
   - **Soporte de Ejecución Silenciosa (CLI):** Puede ejecutarse en modo desatendido mediante:
     `Setup_PalletsWW_Cliente.exe -silent -maquina 7 -servidor 10.26.24.31`
2. **Ubicación del Instalador:**
   - Binario compilado listo para distribución en:
     `C:\AI\Git Hub\clsA_P035_PallestWipes\Instalador_Cliente_Zebra\Setup_PalletsWW_Cliente.exe`
   - Código fuente incorporado en la solución principal:
     `src\PalletsWW_ClientSetup\` en `PalletsWW_PC_sln.sln`.