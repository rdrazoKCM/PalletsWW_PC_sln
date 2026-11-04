# 006 - Cambios en Pallets Wipes V3: Bloqueo Integral de Aplicación, Transaccionalidad de Lote, Telemetría, Resolución de Identidad (SCOPE_IDENTITY) y Corrección de Update (V02)

**Proyecto:** clsA_P035_PallestWipes  
**Base de Datos:** TLX022MXDB  
**Servidor:** MXTLAS02 (Desarrollo: DESKTOP-GNLGUOC)  
**Fecha de Implementación:** 16 de Septiembre de 2026  
**Documentos Relacionados:**  
- [002 Modificaciones de App Wipes.md](file:///c:/AI/Git%20Hub/PROY052_PalletsPanal/Gemini/002%20Modificaciones%20de%20App%20Wipes.md)  
- [005 Plan de Implementacion Pallets WW V3.md](file:///c:/AI/Git%20Hub/PROY052_PalletsPanal/Gemini/005%20Plan%20de%20Implementacion%20Pallets%20WW%20V3.md)  
- [007_Despliegue_Produccion_Pallets_WW_V3.sql](file:///c:/AI/Git%20Hub/PROY052_PalletsPanal/Gemini/007_Despliegue_Produccion_Pallets_WW_V3.sql)  
- [008 Pallets WW SP de Update.md](file:///c:/AI/Git%20Hub/PROY052_PalletsPanal/Gemini/008%20Pallets%20WW%20SP%20de%20Update.md)  
- [009_Despliegue_Produccion_Pallets_WW_UpdateV02.sql](file:///c:/AI/Git%20Hub/PROY052_PalletsPanal/Gemini/009_Despliegue_Produccion_Pallets_WW_UpdateV02.sql)  

---

## 1. Resumen Ejecutivo de la Implementación

En respuesta a las incidencias reportadas en las líneas de Toallitas Húmedas (Wipes) causadas por lentitud de red, concurrencia en SQL y errores al actualizar registros existentes:

1. **Envío de múltiples etiquetas (Doble Clic / Reentrancia):**
   - **En Guardar:** Bloqueo integral con bandera `_isSaving`, deshabilitación de `lnkGuardardgvDatos1`, deshabilitación del grid `dgvDatos1`, cursor `WaitCursor` y pausa preventiva del temporizador de sondeo `tmrRegistros.Stop()`.
   - **En Reimpresión:** Bloqueo integral con bandera `_isReimprimiendo`, deshabilitación del enlace `lnkReimprimir`, cursor `WaitCursor`, validación estricta de que el folio sea un entero positivo mayor a cero y pausa preventiva de `tmrRegistros.Stop()`.
2. **Filtro Inviolable Anti-Etiquetas Incompletas o en Blanco:**
   - La impresión solo se ejecuta si la inserción en SQL fue exitosa y tras validar que la consulta no devuelva campos vacíos (`NoTarima`, `Lote` o `DescripcionProducto`).
   - Si no se obtienen datos, se aborta la impresión hacia la impresora Zebra, evitando el desperdicio de etiquetas en blanco.
3. **Diferenciación en Log de Telemetría (`TipoOperacion`):**
   - Se incorporó la columna `[TipoOperacion] VARCHAR(20)` en `dbo.tblLog_PalletsWipes` con índice dedicado.
   - Cada acción queda categorizada como `'GUARDAR'`, `'REIMPRESION'` o `'MODIFICACION'`, permitiendo auditorías claras y análisis diferenciados de rendimiento de red.
4. **Unificación de Reimpresión:**
   - La columna `cbtnImprimir` del grid de pallets históricos (`sdgvDatos1_CellClick`) ahora delega de manera centralizada en `sReimprimirEtiqueta`, garantizando que ambos puntos de reimpresión compartan la misma protección anti-etiquetas en blanco y telemetría.
5. **Resolución de la Incidencia de Folio Inexistente en Producción (`SCOPE_IDENTITY`):**
   - Se eliminó el uso de `@@IDENTITY` que capturaba los IDs de tablas de auditoría/triggers (rango 6 millones) en lugar del folio de `tblPallets` (rango 2.8 millones).
   - Se adoptó la captura inmediata de `SCOPE_IDENTITY()` y retorno vía `UpdatedRowSource.Both`.
6. **Resolución del Error en Modificación de Pallets (`Update SP`):**
   - Se corrigió el error en tiempo de ejecución *"Procedure or function pa_P009_01008_tblPalletsUpdatecmd has too many arguments specified."* al eliminar el parámetro duplicado `@IdtblPallets` Output que se había añadido erróneamente en `sUPrmsdgv1datos1`.
   - Se creó y desplegó `pa_P009_01008_tblPalletsUpdatecmdV02` con transaccionalidad atómica, bloqueo por fila `WITH (ROWLOCK)`, validación de existencia de pallet, recálculo seguro de `Lote` y sincronización en `tblRT_Produccion`.
7. **Normalización Total de Textos, Ortografía y Acentuación (UTF-8 con BOM):**
   - Se corrigieron todas las anomalías de caracteres (`ó`, `¿Estǭ seguro...?`, `vǭlido`, `nǧmero`, etc.) en Visual Basic y SQL Server.
   - Todos los archivos se guardaron con codificación UTF-8 con marca de orden de bytes (BOM `EF BB BF`), garantizando que el compilador VB.NET y SQL Server muestren acentos y eñes con pulcritud.

---

## 2. Diagnóstico y Análisis Forense de la Prueba en Producción

Al desplegar la primera versión en producción y probar la captura de 5 pallets, se presentó el siguiente comportamiento reportado por el operador:
- El guardado tardó en completarse (tiempos en log de 15 a 69 segundos).
- No se imprimió ninguna etiqueta física.
- Apareció el mensaje de advertencia: *"El pallet se guardó correctamente en la base de datos con Folio 6089951, pero debido a problemas de red no se pudo recuperar la información completa para la etiqueta. La impresión se bloqueó..."*.
- En la tabla `tblLog_PalletsWipes`, todos los registros de `CONSULTA_ETIQUETA` marcaron `ERROR` en 5 a 12 ms.
- Al acudir a la pestaña de Reimpresión con los folios reales (`2812391`, `2812394`, `2812395`, `2812396`), la reimpresión funcionó en menos de 10 ms y las etiquetas se imprimieron perfectamente.

### Hallazgos Forenses y Causa Raíz

```
+---------------------------------------------------------------------------------------------------------+
|                                    ANÁLISIS DE LA DISCREPANCIA EN LOG                                   |
+-------------------+--------------------+------------------------+---------------------------------------+
|   Transacción     | Folio en Guardar   | Folio Real Reimpresión | Resultado Reimpresión                 |
+-------------------+--------------------+------------------------+---------------------------------------+
| Lote 1 (IdLog 4)  | 6,089,951 (ERROR)  | 2,812,391 (OK)         | SQL: 6 ms  | Zebra: 257 ms | ÉXITO    |
| Lote 2 (IdLog 13) | 6,089,954 (ERROR)  | 2,812,394 (OK)         | SQL: 14 ms | Zebra: 236 ms | ÉXITO    |
| Lote 3 (IdLog 24) | 6,089,955 (ERROR)  | 2,812,395 (OK)         | SQL: 6 ms  | Zebra: 246 ms | ÉXITO    |
| Lote 4 (IdLog 33) | 6,089,956 (ERROR)  | 2,812,396 (OK)         | SQL: 5 ms  | Zebra: 250 ms | ÉXITO    |
+-------------------+--------------------+------------------------+---------------------------------------+
```

1. **La Red y la Base de Datos NO tienen lentitud:**  
   Cuando se consultaron los folios reales en la reimpresión, SQL Server respondió en **6 milisegundos** y la impresora Zebra tardó **240 milisegundos**. Ambos procesos operaron a velocidad normal.
2. **El origen de los 6 millones (`@@IDENTITY` vs Triggers en Producción):**  
   En `.NET` se ejecutaba `SELECT @@IDENTITY` para obtener el último folio generado.  
   En SQL Server, `@@IDENTITY` devuelve el último autoincrementable de **cualquier tabla** en la sesión. En producción (`MXTLAS02`), al insertar en `tblPallets` o actualizar `tblRT_Produccion`, se activa un **trigger de auditoría/histórico** que inserta en otra tabla cuyo contador identity va en **6,089,951**.  
   `@@IDENTITY` devolvió el ID del trigger de auditoría y **pisó** el ID real de `tblPallets` (`2,812,391`).
3. **Por qué falló `CONSULTA_ETIQUETA`:**  
   El procedimiento `pa_P009_01010_btnImprimirEtiqueta_click` buscó `WHERE IdtblPallets = 6089951`. Como ese folio no existe en `tblPallets`, la consulta tardó solo 5 ms en regresar **0 filas**. El filtro anti-etiquetas en blanco detectó la falta de datos y bloqueó la impresión correctamente.
4. **Por qué `GUARDAR_SQL` tardó 69 segundos:**  
   El `MsgBox` de aviso se disparó dentro del evento `OnRowUpdated` del `SqlDataAdapter`. Los 69 segundos fueron exactamente el tiempo que el operador tardó en leer el cuadro de diálogo y presionar el botón "Aceptar".

---

## 3. Detalle de Estructuras en Base de Datos (`TLX022MXDB`)

### A. Tabla de Telemetría: `dbo.tblLog_PalletsWipes`
```sql
CREATE TABLE [dbo].[tblLog_PalletsWipes] (
    [IdLog]           BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [FechaHora]       DATETIME NOT NULL CONSTRAINT DF_tblLog_PalletsWipes_FechaHora DEFAULT GETDATE(),
    [IdTransaccion]   UNIQUEIDENTIFIER NOT NULL,
    [TipoOperacion]   VARCHAR(20) NOT NULL CONSTRAINT DF_tblLog_PalletsWipes_TipoOperacion DEFAULT 'GUARDAR', -- 'GUARDAR', 'REIMPRESION', 'MODIFICACION'
    [NoMaquina]       INT NULL,
    [IdtblProductos]  INT NULL,
    [FolioVale]       INT NULL,
    [IdtblPallets]    INT NULL,
    [NoTarima]        NVARCHAR(50) NULL,
    [Lote]            NVARCHAR(50) NULL,
    [TotalCajas]      INT NULL,
    [Accion]          VARCHAR(50) NOT NULL,
    [Estatus]         VARCHAR(30) NOT NULL,
    [TiempoMs]        INT NOT NULL CONSTRAINT DF_tblLog_PalletsWipes_TiempoMs DEFAULT 0,
    [Mensaje]         NVARCHAR(1000) NULL,
    [DetalleError]    NVARCHAR(MAX) NULL,
    [NoEmpleado]      INT NULL,
    [NombreEquipo]    NVARCHAR(100) NULL,
    [UsuarioWindows]  NVARCHAR(100) NULL
);

CREATE NONCLUSTERED INDEX IX_tblLog_PalletsWipes_FechaHora ON [dbo].[tblLog_PalletsWipes] ([FechaHora] DESC);
CREATE NONCLUSTERED INDEX IX_tblLog_PalletsWipes_IdTransaccion ON [dbo].[tblLog_PalletsWipes] ([IdTransaccion]);
CREATE NONCLUSTERED INDEX IX_tblLog_PalletsWipes_NoTarima ON [dbo].[tblLog_PalletsWipes] ([NoTarima]);
CREATE NONCLUSTERED INDEX IX_tblLog_PalletsWipes_TipoOperacion ON [dbo].[tblLog_PalletsWipes] ([TipoOperacion]);
```

### B. Procedimiento Almacenado de Telemetría: `dbo.pa_P009_01006_tblLogPalletsWipesInsert`
Recibe el parámetro `@TipoOperacion VARCHAR(20) = 'GUARDAR'` y persiste la información dentro de un bloque `BEGIN TRY...END TRY / BEGIN CATCH...END CATCH` para no interferir con la transacción productiva.

### C. Procedimiento Almacenado de Inserción Atómica: `dbo.pa_P009_01006_tblPalletsInsertcmdV02`
- Bloqueo exclusivo de contador con `UPDLOCK, HOLDLOCK` para evitar duplicidad de tarimas.
- **Captura Inmediata de `SCOPE_IDENTITY()`:** Justo después de cada `INSERT INTO tblPallets`, se ejecuta:
  ```sql
  SET @FolioPallet = SCOPE_IDENTITY();
  ```
  `SCOPE_IDENTITY()` es **100% inmune a triggers** y garantiza capturar el ID genuino de `tblPallets` (`2,812,391`).
- **Retorno Doble:**
  1. Parámetro de salida: `@IdtblPallets = @FolioPallet OUTPUT`
  2. Conjunto de resultados: `SELECT @FolioPallet AS IdtblPallets;`

### D. Procedimiento Almacenado de Actualización Atómica: `dbo.pa_P009_01008_tblPalletsUpdatecmdV02`
- Recibe exactamente 4 parámetros: `@TotalCajas int, @Hora time, @IdtblPallets int, @Linea nvarchar(05)`.
- Bloqueo por fila `WITH (ROWLOCK)` en `tblPallets` y en `tblRT_Produccion`.
- Validación defensiva de existencia (`IF NOT EXISTS...`).
- Recalculo automático de `Lote` respetando reglas de exportación y mercado nacional.
- Sincronización automática de `TotalCajas` en `tblRT_Produccion`.

---

## 4. Diagnóstico y Solución Definitiva de Error en Modificación / Update

### El Error Reportado en Producción
Al editar una celda en `dgvDatos1` (ej. cambiar Total Cajas o la Hora) y hacer clic en Guardar, Visual Basic arrojaba la excepción de SQL Server:
```
System.Data.SqlClient.SqlException:
"Procedure or function pa_P009_01008_tblPalletsUpdatecmd has too many arguments specified."
```

### Causa Raíz en Visual Studio (`clsD_0001_tblPallets.vb`)
En la subrutina `sUPrmsdgv1datos1` de la capa de datos, se había agregado incorrectamente una línea durante el refactor anterior:
```vb
' ERROR PREVIO: Parámetro extra que causaba 5 argumentos
Dim pIdPallet As SqlParameter = .Parameters.Add("@IdtblPallets", SqlDbType.Int)
pIdPallet.Direction = ParameterDirection.Output
```
Dado que `sUPrmsdgv1datos1` ya mapeaba `@IdtblPallets` como parámetro de entrada ligado a la columna del DataRow, este bloque agregó un segundo parámetro `@IdtblPallets` (de salida), provocando que ADO.NET enviara **5 parámetros** al stored procedure, el cual solo espera **4**.

### Corrección en Capa de Datos (`clsD_0001_tblPallets.vb`)
Se eliminó la declaración duplicada y se configuró la invocación a la versión `V02`:
```vb
Private Sub sUPrmsdgv1datos1(ByRef cmUpdateCmd As SqlCommand)
    With cmUpdateCmd
        .Parameters.Add("@TotalCajas", SqlDbType.Int)
        .Parameters("@TotalCajas").SourceVersion = DataRowVersion.Current
        .Parameters("@TotalCajas").SourceColumn = "TotalCajas"

        .Parameters.Add("@Hora", SqlDbType.Time)
        .Parameters("@Hora").SourceVersion = DataRowVersion.Current
        .Parameters("@Hora").SourceColumn = "Hora"

        .Parameters.Add("@IdtblPallets", SqlDbType.Int)
        .Parameters("@IdtblPallets").SourceVersion = DataRowVersion.Current
        .Parameters("@IdtblPallets").SourceColumn = "IdtblPallets"

        .Parameters.Add("@Linea", SqlDbType.NVarChar, 50)
        .Parameters("@Linea").SourceVersion = DataRowVersion.Current
        .Parameters("@Linea").SourceColumn = "LineaEmpaque"
    End With
End Sub
```
En la inicialización del comando:
```vb
clU_dgv.sUpdateCommand(o_clU_strucdgv1DatosDS, o_clU_strucdgv1DatosSource, _
    "pa_P009_01008_tblPalletsUpdatecmdV02", cmUpdateCmd)
cmUpdateCmd.UpdatedRowSource = UpdateRowSource.None
sUPrmsdgv1datos1(cmUpdateCmd)
clU_dgv.sUpdateCommandParams(o_clU_strucdgv1DatosDS, cmUpdateCmd)
```

### Manejo en Evento `OnRowUpdated` (`clsU_00901_dgv.vb`)
Se implementó la discriminación para `StatementType.Update`:
```vb
If e.StatementType = StatementType.Update Then
    Try
        If e.Row IsNot Nothing AndAlso e.Row.Table.Columns.Contains("IdtblPallets") AndAlso Not IsDBNull(e.Row("IdtblPallets")) Then
            Long.TryParse(e.Row("IdtblPallets").ToString(), intFolio)
        End If
    Catch ex As Exception
        intFolio = 0
    End Try

    If intFolio > 0 Then
        clsU_TelemetryLog.RegistrarLog(TransaccionActual, NoMaquinaActual, IdProductoActual, FolioValeActual, _
            CInt(intFolio), Nothing, Nothing, Nothing, "UPDATE_SQL", "EXITO", 0, _
            "Pallet modificado correctamente en la base de datos", Nothing, NoEmpleadoActual, "MODIFICACION")
        ' En modificación de registros no se envía etiqueta automática a Zebra;
        ' el operador la reimprime explícitamente desde el grid o la pestaña Reimpresión si lo requiere.
    End If
End If
```

---

## 5. Detalle de Correcciones Ortográficas y Codificación (UTF-8 BOM)

Se resolvió de forma integral la corrupción de caracteres especiales en español provocada por lecturas ANSI sobre archivos UTF-8:

| Archivo Modificado | Textos Corregidos | Codificación Aplicada |
| :--- | :--- | :--- |
| `clsA\frm_001_Pallets.vb` | `válido`, `número`, `¿Está seguro...`, `operación` | UTF-8 con BOM (`EF BB BF`) |
| `clsD\clsD_0001_tblPallets.vb` | `¿Está seguro de que desea guardar los cambios?`, `LÍNEA DE EMPAQUE`, `vacíos`, `Validación` | UTF-8 con BOM (`EF BB BF`) |
| `clsU\clsU_00901_dgv.vb` | `Ocurrió un error`, `Atención`, `guardó`, `información`, `impresión`, `bloqueó`, `pestaña`, `conexión` | UTF-8 con BOM (`EF BB BF`) |
| `clsF\clsF_001_frm_001_Pallets.vb` | `número`, `vacío`, `¿Desea guardar este registro?`, `¿Desea modificar este registro?`, `DESCRIPCIÓN CLAVE`, `máquina`, `reimpresión` | UTF-8 con BOM (`EF BB BF`) |
| Scripts SQL (`007`, `009`, `pa_*V02`) | Identificadores de esquemas `tblRT_Produccion`, `Exportacion`, mensajes de `RAISERROR` y encabezados | UTF-8 con BOM (`EF BB BF`) |

---

## 6. Validación de Compilación

Compilación de la solución `clsA_P035_PallestWipes.sln` ejecutada con MSBuild:
- **Configuración:** `Release` y `Debug`
- **Errores:** `0 Errores`
- **Advertencias:** `39 Advertencias` (advertencias benignas preexistentes en código legado de Crystal Reports / Type Casting).
- **Binario Final Generado:**  
  `C:\AI\Git Hub\clsA_P035_PallestWipes\bin\Release\clsA_P035_PallestWipes.exe` (188,928 bytes)

---

## 7. Consultas de Auditoría y Monitoreo en SQL Server

### A. Rendimiento Comparativo: Guardar vs Reimpresión vs Modificación
```sql
USE [TLX022MXDB];
GO

SELECT 
    TipoOperacion,
    Accion,
    Estatus,
    COUNT(*) AS TotalEventos,
    AVG(TiempoMs) AS PromedioMs,
    MIN(TiempoMs) AS MinimoMs,
    MAX(TiempoMs) AS MaximoMs
FROM dbo.tblLog_PalletsWipes
WHERE FechaHora >= DATEADD(HOUR, -24, GETDATE())
GROUP BY TipoOperacion, Accion, Estatus
ORDER BY TipoOperacion, Accion, Estatus;
```

### B. Auditoría de Modificaciones de Pallets
```sql
USE [TLX022MXDB];
GO

SELECT 
    FechaHora,
    NombreEquipo,
    UsuarioWindows,
    NoEmpleado,
    IdtblPallets,
    Accion,
    Estatus,
    TiempoMs,
    Mensaje
FROM dbo.tblLog_PalletsWipes
WHERE TipoOperacion = 'MODIFICACION'
ORDER BY FechaHora DESC;
```

---

## 8. Procedimiento para Despliegue en Producción

### Paso 1: Ejecutar el Script Maestro en `MXTLAS02` (Base de Datos `TLX022MXDB`)
Se preparó un **Script Maestro Único** que consolida en una sola ejecución todas las tablas, índices, validaciones y procedimientos almacenados versionados en **V5** (Inserción, Update y Telemetría) para evitar cualquier conflicto o afectación con otras aplicaciones:
- **Script Maestro:** [010_Despliegue_Produccion_Pallets_WW_Master_V5.sql](file:///c:/AI/Git%20Hub/PROY052_PalletsPanal/Gemini/010_Despliegue_Produccion_Pallets_WW_Master_V5.sql)
- **Acción:** Abrir en SQL Server Management Studio conectado al servidor `MXTLAS02` y presionar **F5 (Execute)**.
- **Resultado:**
  - Crea o actualiza la tabla de telemetría `dbo.tblLog_PalletsWipes`.
  - Crea los 4 índices de rendimiento para auditoría.
  - Crea/Actualiza `dbo.pa_P009_01006_tblLogPalletsWipesInsert` (Telemetría).
  - Crea/Actualiza `dbo.pa_P009_01006_tblPalletsInsertcmdV5` (Inserción atómica con `SCOPE_IDENTITY()` y subfijo dinámico de exportación).
  - Crea/Actualiza `dbo.pa_P009_01008_tblPalletsUpdatecmdV5` (Modificación de pallets con 4 argumentos exactos, corrección de lote de exportación por máquina y sincronización de cajas).
  - Ejecuta la reparación automática del pallet 2813008 (regresado de `TL626002X` a `TL626007X`).
  - Ejecuta la verificación automática final confirmando todos los objetos creados y los 4 parámetros del Update V5.

### Paso 2: Desplegar Ejecutable en Estaciones de Trabajo
1. Tomar el ejecutable compilado:  
   `C:\AI\Git Hub\clsA_P035_PallestWipes\bin\Release\clsA_P035_PallestWipes.exe` (188,928 bytes).
2. Cerrar la aplicación en las terminales de los operadores de Wipes.
3. Sustituir el archivo `.exe` en las estaciones de producción.
4. Iniciar la aplicación y validar la captura de tarima, edición en grid y reimpresión.


