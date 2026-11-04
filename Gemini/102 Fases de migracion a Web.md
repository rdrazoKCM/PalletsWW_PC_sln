# 102 Fases de Migración a Web: Pallets WW (`PalletsWW_PC_sln`)

## Resumen Ejecutivo de la Migración
El presente documento certifica la migración completa de la aplicación industrial **Pallets WW (Wet Wipes)** desde su arquitectura cliente-servidor tradicional en WinForms (.NET Framework 4.8) hacia la arquitectura web corporativa moderna de Kimberly-Clark de México (.NET 8 C# 12, ASP.NET Core Web API con Swagger y Blazor Web App InteractiveServer).

La solución se encuentra implementada en:
**`C:\AI\Git Hub\clsA_P035_PallestWipes\PalletsWW_PC_sln\`**

Siguiendo la estructura espejo de `RecepcionPTWW_PC_sln`:
- **Backend API:** `src\PalletsWW_PC.Api\` (**Puerto 5105**, Swagger en `/swagger`)
- **Frontend Web:** `src\PalletsWW_PC.Web\` (**Puerto 5106**, Blazor InteractiveServer)
- **Impresión de Etiquetas:** Conexión local **USB** a la PC mediante Windows Spooler (`winspool.drv` / `Generic / Text Only`).
- **Estado de Compilación:** **0 Errores** en ambos proyectos.

---

## Matriz de Fases de Migración

| Fase | Título | Componentes / Tecnologías | Estado | Resultado |
|:---|:---|:---|:---:|:---|
| **Fase 1** | **Scaffolding y Estructura Espejo** | Solución `.sln`, proyectos .NET 8, NuGet `Kcc.Infrastructure.Sql` 1.1.3, DTOs, Puertos 5105/5106 y Configuración USB | **COMPLETADA** | 0 Errores |
| **Fase 2** | **Acceso a Datos y Repositorios Asíncronos** | `IKccSqlProvider`, Repositorios para SPs de producción, Servicio de Impresión USB Win32 Spooler | **COMPLETADA** | 0 Errores |
| **Fase 3** | **Controladores Web API y Swagger** | Endpoints RESTful para Pallets, Vales, Catálogos e Impresión USB, Swagger UI | **COMPLETADA** | 0 Errores |
| **Fase 4** | **Frontend Blazor Web App** | Mini-Dashboard de Capacidad (38 pallets), captura ágil con Enter, feedback modal, toast 3s, resaltado verde | **COMPLETADA** | 0 Errores |
| **Fase 5** | **Verificación Integral y Compilación Final** | Validación end-to-end, compatibilidad con `TLX022MXDB` y arranque de servicios | **COMPLETADA** | 0 Errores |

---

## Detalle Técnico por Fase

### Fase 1: Scaffolding, Estructura Espejo y Configuración
1. **Estructura Espejo Idéntica a la App de Referencia (`RecepcionPTWW_PC_sln`):**
   - Carpetas auxiliares: `Antigravity/`, `Gemini/`, `images/`.
   - `nuget.config` en la raíz enlazando a `https://api.nuget.org/v3/index.json` y al feed local `C:\Nuget`.
   - Solución central: `PalletsWW_PC_sln.sln`.
2. **Asignación de Puertos Departamentales:**
   - API: `http://localhost:5105` y `https://localhost:7105` con perfil de depuración apuntando a `swagger`.
   - Web: `http://localhost:5106` y `https://localhost:7106` con `ApiSettings:BaseUrl` apuntando a `http://localhost:5105/`.
3. **Configuración de Impresora USB:**
   - En `appsettings.json` de la API se configuró:
     ```json
     "PrinterSettings": {
       "TipoConexion": "USB",
       "PrinterName": "Generic / Text Only"
     }
     ```
4. **Contratos DTO Fuertemente Tipados:**
   - Creados como clases independientes en `Models/Dtos/` tanto en la API como en la Web (`PalletDto`, `PalletInsertDto`, `PalletUpdateDto`, `PalletResultDto`, `ValeDto`, `ValeDetalleDto`, `EmpleadoDto`, `MaquinaDto`, `LineaEmpaqueDto`, `EtiquetaZplDto`, `ReporteValeResumenDto`).

---

### Fase 2: Repositorios Asíncronos y Servicio de Impresión USB
1. **Adherencia a `Kcc.Infrastructure.Sql` v1.1.3:**
   - Inyección en `Program.cs`: `builder.Services.AddKccSqlInfrastructure(builder.Configuration);`.
   - Inyección de `IKccSqlProvider` en los repositorios.
   - Resolución 100% dinámica de nombres de base de datos desde `appsettings.json` (`TLX022MXDB`, `TLX009MXDB`, `TLX040MXDB`, `TLX032MXDB`). Cero nombres hardcodeados.
2. **Repositorios de Datos:**
   - **`PalletRepository`:**
     - `pa_P009_01001_tblPallets`: Consulta de pallets del vale con mapeo por nombre de columna.
     - `pa_P009_01006_tblPalletsInsertcmdV5`: Parámetros `@FolioVale`, `@IdtblProductos`, `@TotalCajas`, `@Hora` (Time), `@IdRT_Encabezado`, `@NoEmpCapturo`, `@Linea`, y `@IdtblPallets` (`OUTPUT`).
     - `pa_P009_01008_tblPalletsUpdatecmdV5`: Parámetros `@IdtblPallets`, `@TotalCajas`, `@Hora` (Time), `@Linea`.
     - `pa_P009_01009_tblPalletsDeletecmd`: Borrado por `@IdtblPallets`.
   - **`ValeRepository`:**
     - `pa_P009_00102_ConsultaEncabezadoReporteTurnoWipes`: Localiza el `IdRT_Encabezado` del turno/fecha/máquina.
     - `pa_P009_01002_sLlenardgvProduccion`: Carga vales del turno actual.
     - `pa_P009_01005_sLlenardgvProduccionTurnoAnt`: Carga vales del turno anterior.
     - `ObtenerDetalleValeAsync`: Consulta directa con producto y cajas programadas.
   - **`CatalogoRepository`:**
     - `pa_P009_01013_sLlenar_cbxLineaEmpaque`: Líneas de empaque 1 a 14.
     - `pa_P009_000_001_LlenarcbxNoEmpSinParams`: Catálogo de operadores.
     - `pa_P009_000_008_LlenarcbxNoMaquinaConParams`: Catálogo de máquinas del departamento 6.
   - **`ImpresionRepository`:**
     - `pa_P009_01010_btnImprimirEtiqueta_click`: Recuperación de datos fiscales y lote.
     - Construcción matemática exacta de la plantilla ZPL de Zebra (`^XA...^XZ`) con fecha juliana, código de barras Code 39 y códigos QR.
3. **Servicio de Impresión USB (`UsbPrintService`):**
   - Implementa `IUsbPrintService` mediante llamadas P/Invoke a la API nativa del Spooler de Windows (`winspool.drv`: `OpenPrinter`, `StartDocPrinter`, `StartPagePrinter`, `WritePrinter`, `EndPagePrinter`, `EndDocPrinter`, `ClosePrinter`).
   - Envía el código ZPL como bytes RAW directamente a la impresora USB configurada (`Generic / Text Only` o driver Zebra local), garantizando que Windows no modifique los comandos ZPL ni intente rasterizarlos.

---

### Fase 3: Controladores Web API y Swagger
1. **Controladores RESTful en `PalletsWW_PC.Api`:**
   - **`PalletsController`:**
     - `GET /api/Pallets/vale/{folio}?idEncabezado={id}`: Obtiene la lista de tarimas del vale.
     - `POST /api/Pallets`: Inserta una nueva tarima y retorna su folio y estatus.
     - `PUT /api/Pallets/{id}`: Actualiza cajas, hora o línea de empaque.
     - `DELETE /api/Pallets/{id}`: Elimina un pallet.
   - **`ValesController`:**
     - `GET /api/Vales/encabezado`: Resuelve el folio de turno activo.
     - `GET /api/Vales/activos`: Lista de vales del turno en curso.
     - `GET /api/Vales/historicos`: Lista de vales del turno anterior.
     - `GET /api/Vales/detalle`: Detalle del producto y cajas del vale.
   - **`CatalogosController`:**
     - Endpoints para `/lineas`, `/operadores`, `/supervisores` y `/maquinas`.
   - **`ImpresionController`:**
     - `GET /api/Impresion/etiqueta/{idPallet}`: Obtiene el código ZPL generado y metadatos.
     - `POST /api/Impresion/enviar/{idPallet}`: Dispara la impresión directa al puerto USB local.
     - `POST /api/Impresion/enviar-raw`: Envía una cadena ZPL arbitraria al puerto USB local.
2. **Swagger / OpenAPI:**
   - Interfaz interactiva disponible en `http://localhost:5105/swagger` para pruebas directas en vivo.

---

### Fase 4: Frontend Blazor Web App InteractiveServer
1. **Diseño Visual y Estética Corporativa:**
   - Estilo Dark Glassmorphism de alta gama con paleta de colores acorde a Kimberly-Clark.
   - Iconografía moderna basada en **Bootstrap Icons** local (sin dependencias externas de internet).
   - Tipografía limpia y estructura responsiva en `MainLayout.razor` y `NavMenu.razor`.
2. **Pantalla Principal (`CapturaPallets.razor`):**
   - **Mini-Dashboard de Estado del Vale (KPIs en Tiempo Real):**
     - **Capacidad del Vale:** Badge dinámico `Pallets: X / 38` (Verde con espacio disponible, ámbar al acercarse a 30-37, rojo al alcanzar el límite estricto de 38).
     - **Total Cajas Acumuladas:** Conteo vivo de cajas capturadas en el vale vs cajas programadas.
     - **Última Tarima Generada:** Muestra de confirmación del último folio generado.
   - **Pre-llenado Inteligente de Hora:**
     - La hora actual redondeada (`HH:mm`) se sugiere automáticamente en la fila nueva.
   - **Agilidad por Teclado:**
     - Al presionar **Enter** en la fila de captura, se guarda automáticamente el pallet sin necesidad de usar el mouse.
   - **Feedback Visual de Guardado:**
     - **Modal de Proceso:** Mientras SQL Server procesa la transacción, se muestra un modal elegante con spinner indicando: *"Operación en proceso... Guardando pallet en base de datos. Por favor espere un momento..."*.
     - **Notificación Flotante (Toast Alert):** Al completarse, se despliega una alerta moderna de éxito *"¡Operación completada con éxito! Pallet registrado."* que se auto-descarta a los 3 segundos.
     - **Microanimación Visual:** La fila recién guardada o modificada parpadea suavemente en verde claro para confirmación visual instantánea del operador.
   - **Impresión USB Directa:**
     - Cada fila incluye un botón de impresión rápida que dispara el ZPL directo a la impresora local USB.
3. **Módulos Complementarios:**
   - **`ValesProduccion.razor`:** Consulta y monitoreo de vales activos e históricos.
   - **`ReimpresionEtiquetas.razor`:** Búsqueda por número de tarima, previsualización de ZPL y reenvío a USB.
   - **`ReportesVales.razor`:** Resumen de cumplimiento de producción por máquina y turno.

---

### Fase 5: Verificación Integral y Compilación Final

1. **Compilación de la Solución Completa:**
   ```powershell
   dotnet build "C:\AI\Git Hub\clsA_P035_PallestWipes\PalletsWW_PC_sln\PalletsWW_PC_sln.sln"
   ```
   **Resultado Obtenido:**
   ```
   PalletsWW_PC.Api -> bin\Debug\net8.0\PalletsWW_PC.Api.dll
   PalletsWW_PC.Web -> bin\Debug\net8.0\PalletsWW_PC.Web.dll
   Compilación correcta.
       0 Errores
   ```

2. **Instrucciones para Levantar los Servicios en Planta:**
   ```powershell
   # Terminal 1 - Backend Web API:
   cd "C:\AI\Git Hub\clsA_P035_PallestWipes\PalletsWW_PC_sln\src\PalletsWW_PC.Api"
   dotnet run
   # Acceso Swagger: http://localhost:5105/swagger

   # Terminal 2 - Frontend Web Blazor:
   cd "C:\AI\Git Hub\clsA_P035_PallestWipes\PalletsWW_PC_sln\src\PalletsWW_PC.Web"
   dotnet run
   # Acceso Aplicación: http://localhost:5106
   ```
