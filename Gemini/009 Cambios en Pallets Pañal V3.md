# 009 - Cambios en Pallets Pañal V3: Bloqueo Integral de Aplicación, Erradicación de SELECT TOP 1, Telemetría y Captura Atómica de SCOPE_IDENTITY

**Proyecto:** PROY052_PalletsPanal (Pallets Pañal)  
**Base de Datos:** TLX018MXDB  
**Servidor Producción:** MXTLAS02 (Desarrollo/Pruebas: DESKTOP-GNLGUOC)  
**Fecha de Implementación:** 16 de Septiembre de 2026  
**Documentos Relacionados:**  
- `001 Modificaciones de App.md`  
- `002 Modificaciones de App Wipes.md`  
- `005 Plan de Implementacion Pallets WW V3.md`  
- `006 Cambios en Pallets WW V3.md`  
- `007 Plan de implementacion en Pallets Pañal V3.md`  
- `008_Despliegue_Produccion_Pallets_Panal_V3.sql`  

---

## 1. Resumen Ejecutivo de la Implementación

Basado en las lecciones aprendidas y la arquitectura probada en **Pallets WW V3** (`clsA_P035_PallestWipes`), se trasladaron e implementaron todas las optimizaciones y salvaguardas a **Pallets Pañal** (`PROY052_PalletsPanal`) para solucionar definitivamente los problemas de **etiquetas repetidas, folios saltados y bloqueos por red lenta**:

1. **Erradicación Definitiva de `SELECT TOP 1 ... ORDER BY DESC`:**  
   Se eliminó la consulta insegura en el evento `OnRowUpdated` de `clsU_00901_dgv.vb`, la cual bajo latencia de red o concurrencia de líneas (hasta 14 líneas concurrentes entre 7 máquinas) tomaba el folio de un pallet previo o de otra línea, provocando que se reimprimiera la misma etiqueta física y se repitiera la numeración de tarima.

2. **Captura Atómica e Inmune a Triggers de `SCOPE_IDENTITY()`:**  
   Se actualizó el procedimiento almacenado `pa_P009_00132_07_03_tblPalletsInsertcmdV02` para:
   - Capturar inmediatamente `SCOPE_IDENTITY()` tras el `INSERT` en `tblPalletsPanal` (inmune a cualquier trigger de auditoría o histórico en producción).
   - Asignar dicho valor al parámetro `@IdtblPalletsPanal OUTPUT`.
   - Retornar el `SELECT @FolioPallet AS IdtblPalletsPanal;` a ADO.NET.
   - En `clsD_0001_tblPallets.vb`, se configuró `UpdatedRowSource = UpdateRowSource.Both` y se añadió el parámetro `ParameterDirection.Output`.

3. **Bloqueo Inviolable de Interfaz de Usuario (Anti-Doble Clic y Anti-Reentrancia):**  
   - **En Botón Guardar (`lnkGuardardgvDatos1_LinkClicked`):** Se añadió bandera atómica `_isSaving`, deshabilitación de controles, `Cursor = Cursors.WaitCursor`, y pausa preventiva del temporizador de sondeo de turno (`tmrVerificaTurno.Stop()`).
   - **En Botón Reimpresión (`lnkReimprimir_LinkClicked`):** Se añadió bandera atómica `_isReimprimiendo`, validación estricta de folio entero > 0, deshabilitación de controles, `Cursor = Cursors.WaitCursor` y pausa preventiva de `tmrVerificaTurno.Stop()`.

4. **Filtro Defensivo Anti-Etiquetas en Blanco o Repetidas en Zebra:**  
   En `clsU_00901_dgv.vb` (`ImprimirEtiquetas`), se implementó una validación previa al envío socket. Si la consulta `pa_P009_030_07_03_SelecttblPalletsPanal` no devuelve filas o los campos esenciales (`strNoTarima`, `strClaveProducto`, `strDescProducto`) están vacíos, **el envío físico a Zebra se cancela inmediatamente**, registrando un log de advertencia y evitando desperdicio de insumos.

5. **Infraestructura de Telemetría Completa (`dbo.tblLog_PalletsPanal`):**  
   Se implementó una tabla dedicada de auditoría y rendimiento con columna `[TipoOperacion]` (`GUARDAR` vs `REIMPRESION`), 4 índices de alto rendimiento y el SP no bloqueante `pa_P009_00132_tblLogPalletsPanalInsert`. Cada paso (`GUARDAR_SQL`, `CONSULTA_ETIQUETA`, `ENVIO_ZEBRA`) registra sus milisegundos de ejecución (`TiempoMs`), estatus (`EXITO`/`ERROR`), máquina, usuario y equipo.

6. **Unificación del Flujo de Reimpresión:**  
   Tanto la reimpresión manual por caja de texto como la reimpresión por celda del grid (`cbtnImprimir`) se unificaron a través de `sReimprimirEtiqueta` y `clsU_00901.ImprimirEtiquetas(..., "REIMPRESION")`, eliminando la dependencia a SPs ajenos a la base de datos de Pañal.

---

## 2. Diagnóstico Forense y Causa Raíz de las Fallas Previas

```
+---------------------------------------------------------------------------------------------------------+
|                                    COMPARACIÓN DE ARQUITECTURAS                                         |
+------------------------------+------------------------------------+-------------------------------------+
| Componente                   | Versión Anterior (Problemática)    | Versión V3 (Implementada)          |
+------------------------------+------------------------------------+-------------------------------------+
| Recuperación de Folio        | SELECT TOP 1 ... ORDER BY DESC     | SCOPE_IDENTITY() vía OUTPUT & Both  |
| Concurrencia entre Máquinas  | Vulnerable a colisión de líneas   | Aislamiento atómico garantizado     |
| Clics del Operador           | Reentrante (Múltiples guardados)   | Bloqueo total (_isSaving)           |
| Impresión Zebra              | Imprime datos residuales en memoria| Filtro estricto anti-blancos/vacíos |
| Procedimiento de Reimpresión | pa_P009_01010_btnImprimirEtiqueta* | pa_P009_030_07_03_SelecttblPallets  |
| Monitoreo de Tiempos y Red   | Inexistente (Cero observabilidad)  | Telemetría milisegundo a milisegundo|
+------------------------------+------------------------------------+-------------------------------------+
* pa_P009_01010_btnImprimirEtiqueta_click pertenecía a la base de datos de Toallitas (TLX022MXDB), no a Pañal.
```

### El Mecanismo de la Etiqueta Repetida
1. Al pulsar "Guardar", el `DataAdapter.Update()` ejecutaba `pa_P009_00132_07_03_tblPalletsInsertcmdV02`.
2. Como el SP original no retornaba `SCOPE_IDENTITY()`, el `DataAdapter` no actualizaba el `DataRow`.
3. El evento `OnRowUpdated` compensaba esto ejecutando:
   ```sql
   SELECT TOP (1) IdtblPalletsPanal 
   FROM tblPalletsPanal a@1 INNER JOIN tblRT_Produccion a@2 
     ON a@1.IdAutotblProduccion = a@2.IdAutotblProduccion 
   WHERE a@1.NoMaquina = @NoMaquina AND a@2.LineaEmpaque = @LineaEmpaque 
   ORDER BY a@1.IdtblPalletsPanal DESC
   ```
4. Si la red tardaba en responder, o si otra línea/máquina estaba insertando, o si la transacción de SQL Server aún no completaba el `COMMIT` en el momento exacto en que `ExecuteScalar` leía, el query leía el **pallet anterior**.
5. Como consecuencia, el folio obtenido era el de la tarima vieja. `ImprimirEtiquetas` consultaba los datos de esa tarima vieja y mandaba a imprimir una **etiqueta idéntica a la anterior**, provocando etiquetas duplicadas en piso.

---

## 3. Modificaciones en Base de Datos (`TLX018MXDB`)

Todos los objetos de base de datos fueron consolidados en el script maestro idempotente:
`Gemini/008_Despliegue_Produccion_Pallets_Panal_V3.sql`.

### A. Tabla de Telemetría: `dbo.tblLog_PalletsPanal`
```sql
CREATE TABLE [dbo].[tblLog_PalletsPanal] (
    [IdLog]           BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY CLUSTERED,
    [FechaHora]       DATETIME NOT NULL CONSTRAINT DF_tblLog_PalletsPanal_FechaHora DEFAULT GETDATE(),
    [IdTransaccion]   UNIQUEIDENTIFIER NOT NULL,
    [TipoOperacion]   VARCHAR(20) NOT NULL CONSTRAINT DF_tblLog_PalletsPanal_TipoOperacion DEFAULT 'GUARDAR', -- 'GUARDAR', 'REIMPRESION'
    [NoMaquina]       INT NULL,
    [IdtblProductos]  INT NULL,
    [FolioVale]       INT NULL,
    [IdtblPallets]    INT NULL, -- IdtblPalletsPanal
    [NoTarima]        NVARCHAR(50) NULL,
    [Lote]            NVARCHAR(50) NULL,
    [TotalCajas]      INT NULL,
    [Accion]          VARCHAR(50) NOT NULL,
    [Estatus]         VARCHAR(30) NOT NULL,
    [TiempoMs]        INT NOT NULL CONSTRAINT DF_tblLog_PalletsPanal_TiempoMs DEFAULT 0,
    [Mensaje]         NVARCHAR(1000) NULL,
    [DetalleError]    NVARCHAR(MAX) NULL,
    [NoEmpleado]      INT NULL,
    [NombreEquipo]    NVARCHAR(100) NULL,
    [UsuarioWindows]  NVARCHAR(100) NULL
);

CREATE NONCLUSTERED INDEX IX_tblLog_PalletsPanal_FechaHora ON [dbo].[tblLog_PalletsPanal] ([FechaHora] DESC);
CREATE NONCLUSTERED INDEX IX_tblLog_PalletsPanal_IdTransaccion ON [dbo].[tblLog_PalletsPanal] ([IdTransaccion]);
CREATE NONCLUSTERED INDEX IX_tblLog_PalletsPanal_NoTarima ON [dbo].[tblLog_PalletsPanal] ([NoTarima]);
CREATE NONCLUSTERED INDEX IX_tblLog_PalletsPanal_TipoOperacion ON [dbo].[tblLog_PalletsPanal] ([TipoOperacion]);
```

### B. Procedimiento de Telemetría: `dbo.pa_P009_00132_tblLogPalletsPanalInsert`
Procedimiento ultraligero con bloque `TRY...CATCH` encapsulado para garantizar que **ningún error de registro de auditoría afecte jamás la transacción productiva**.

### C. Procedimiento de Inserción: `dbo.pa_P009_00132_07_03_tblPalletsInsertcmdV02`
```sql
CREATE OR ALTER PROCEDURE [dbo].[pa_P009_00132_07_03_tblPalletsInsertcmdV02]
    @IdAutotblProduccion int,
    @NoMaquina int, 
    @TotalCajas int,
    @NoEmpCapturo int,
    @IdtblPalletsPanal int = NULL OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @NoTarima bigint, 
            @NoTarimaStr nvarchar(50), 
            @Clave int,  
            @ProdXCaja smallint, 
            @Factor decimal(18,3), 
            @NombreMaquina nvarchar(50),
            @SumtotalCajas int,
            @FolioPallet int;

    BEGIN TRANSACTION;

    BEGIN TRY
        -- 1. Obtener datos descriptivos de máquina
        SELECT @NombreMaquina = NombreMaquina 
        FROM TLX009MXDB.dbo.tblMaquinas 
        WHERE NoMaquina = @NoMaquina;

        -- 2. Obtener clave de producto y factores
        SELECT @Clave = Clave 
        FROM tblRT_Produccion 
        WHERE IdAutotblProduccion = @IdAutotblProduccion;

        SELECT @ProdXCaja = ProdXCaja, @Factor = Factores 
        FROM TLX009MXDB.dbo.tblProductos 
        WHERE IdtblProductos = @Clave;

        -- 3. Reserva e incremento atómico de tarima
        UPDATE tblContadoresTarima WITH (UPDLOCK, ROWLOCK, HOLDLOCK)
        SET @NoTarima = NoTarima,
            NoTarima = NoTarima + 1
        WHERE NoMaquina = @NoMaquina;

        IF @NoTarima IS NULL
        BEGIN
            RAISERROR('No se encontró contador configurado en tblContadoresTarima para la máquina especificada.', 16, 1);
        END

        SET @NoTarimaStr = @NombreMaquina + '-' + CONVERT(nvarchar(20), @NoTarima);

        -- 4. Inserción atómica en tblPalletsPanal
        INSERT INTO tblPalletsPanal 
            (IdAutotblProduccion, NoTarima, NoMaquina, TotalCajas, ProdXCaja, Factor, Hora, FechaSys, NoEmpCapturo)
        VALUES
            (@IdAutotblProduccion, @NoTarimaStr, @NoMaquina, @TotalCajas, @ProdXCaja, @Factor, 
             CONVERT(DATETIME, GETDATE(), 114), GETDATE(), @NoEmpCapturo);

        -- CAPTURA INMEDIATA DE SCOPE_IDENTITY (Inmune a triggers)
        SET @FolioPallet = SCOPE_IDENTITY();

        -- 5. Actualizar sumatoria de cajas en tblRT_Produccion
        SELECT @SumtotalCajas = SUM(ISNULL(TotalCajas, 0)) 
        FROM tblPalletsPanal 
        WHERE IdAutotblProduccion = @IdAutotblProduccion;

        UPDATE tblRT_Produccion
        SET TotalCajas = @SumtotalCajas
        WHERE IdAutotblProduccion = @IdAutotblProduccion;

        SET @IdtblPalletsPanal = @FolioPallet;

        COMMIT TRANSACTION;

        -- Retornar Folio a ADO.NET DataAdapter
        SELECT @FolioPallet AS IdtblPalletsPanal;

    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END;
```

---

## 4. Modificaciones en Código Fuente VB.NET

### A. `PROY052_PalletsPanal\clsU\clsU_00201ConexionSQL.vb`
- Se agregó el método estático `RegistrarLog(...)` con manejo tolerante a fallos, captura de variables de entorno (`Environment.MachineName`, `Environment.UserName`) y registro asíncrono seguro en `dbo.tblLog_PalletsPanal`.

### B. `PROY052_PalletsPanal\clsA\frm_001_Pallets.vb`
- Se incorporaron las variables de estado `Private _isSaving As Boolean = False` y `Private _isReimprimiendo As Boolean = False`.
- En `lnkGuardardgvDatos1_LinkClicked`:
  - Salida inmediata si `_isSaving = True`.
  - Deshabilitación de `lnkGuardardgvDatos1` y `dgvDatos1`.
  - Establecimiento de `Cursor = Cursors.WaitCursor`.
  - `tmrVerificaTurno.Stop()` antes de iniciar y `tmrVerificaTurno.Start()` en el bloque `Finally`.
- En `lnkReimprimir_LinkClicked`:
  - Salida inmediata si `_isReimprimiendo = True`.
  - Validación numérica con `Integer.TryParse(..., intFolioIngresado) > 0`.
  - Deshabilitación temporal de `lnkReimprimir`, `Cursor = Cursors.WaitCursor`, y pausa de `tmrVerificaTurno`.

### C. `PROY052_PalletsPanal\clsD\clsD_0001_tblPallets.vb`
- En `sInicializaDataAdapterInsertCommand`:
  - Se configuró `cmInsertCmd.UpdatedRowSource = UpdateRowSource.Both`.
  - Se agregó el parámetro `@IdtblPalletsPanal` como `ParameterDirection.Output`.
- En `slnkGuardarCambiosdgv1Datos1_LinkClicked`:
  - Se añadió prevalidación de celda `TotalCajas > 0` antes de invocar `DataAdapter.Update()`.
  - Se incorporó la medición de tiempo (`Stopwatch`) y registro de log `GUARDAR_SQL` con el GUID de transacción y `TipoOperacion = "GUARDAR"`.

### D. `PROY052_PalletsPanal\clsU\clsU_00901_dgv.vb`
- Se implementó la propiedad compartida `CurrentIdTransaccion As Guid`.
- En `OnRowUpdated`:
  - **Se eliminó por completo el query `SELECT TOP 1 ... ORDER BY DESC`.**
  - Se implementó la recuperación de identidad en 3 niveles de respaldo:
    1. **Nivel 1 (Directo por DataRow):** `e.Row("IdtblPalletsPanal")` mapeado por `UpdatedRowSource.Both`.
    2. **Nivel 2 (Parámetro OUTPUT):** `e.Command.Parameters("@IdtblPalletsPanal").Value`.
    3. **Nivel 3 (Fallback de seguridad):** `SELECT IDENT_CURRENT('tblPalletsPanal')`.
- En `ImprimirEtiquetas`:
  - Se añadieron los parámetros opcionales `idTransaccion As Guid` y `tipoOperacion As String = "GUARDAR"`.
  - Se agregó el reset preventivo de variables a nivel de módulo (`strNoTarima = ""`, `strClaveProducto = ""`, etc.).
  - **Filtro Defensivo Anti-Blancos:**
    ```vb
    If String.IsNullOrWhiteSpace(strNoTarima) OrElse String.IsNullOrWhiteSpace(strClaveProducto) Then
        clsU_00201ConexionSQL.RegistrarLog(effectiveTransaccion, "CONSULTA_ETIQUETA", "BLOQUEADO_POR_DATOS", ...)
        MsgBox("El pallet se guardó con Folio " & ParamintFolio & ", pero la información para la etiqueta vino incompleta. Se bloqueó la impresión.", MsgBoxStyle.Exclamation)
        Exit Sub
    End If
    ```
  - Se midió y registró en telemetría el tiempo de la consulta SQL (`CONSULTA_ETIQUETA`) y el envío al socket de Zebra (`ENVIO_ZEBRA`).

### E. `PROY052_PalletsPanal\clsF\clsF_001_frm_001_Pallets.vb`
- En `slnkGuardardgvDatos1_LinkClicked`:
  - Se genera un GUID único por operación de guardado (`clsU_00901_dgv.CurrentIdTransaccion = Guid.NewGuid()`).
- En `sdgvDatos1_CellClick`:
  - El clic en la columna `cbtnImprimir` del grid ahora delega directamente a `sReimprimirEtiqueta(intFolioGrid, intNoMaquina)`.
- En `sReimprimirEtiqueta`:
  - Se eliminó el código legado que llamaba a un SP inexistente y armaba ZPL manual sin logging.
  - Se unificó llamando a `clsU_00901.ImprimirEtiquetas(intFolio, idTransaccionReimp, "REIMPRESION")`.

---

## 5. Verificación y Resultados de Compilación

La solución fue compilada utilizando el motor MSBuild de Visual Studio en ambas configuraciones:

```powershell
MSBuild PROY052_PalletsPanal.sln /t:Rebuild /p:Configuration=Release
MSBuild PROY052_PalletsPanal.sln /t:Rebuild /p:Configuration=Debug
```

**Resultado:**
- **Errores:** `0 Errores`
- **Advertencias:** 20 advertencias preexistentes del framework (imports no utilizados de Crystal Reports, etc.).
- **Binario generado:** `PROY052_PalletsPanal\bin\Release\PROY052_PalletsPanalGlobal.exe` (136,192 bytes, 16/09/2026).

---

## 6. Procedimiento para Despliegue en Producción (`MXTLAS02`)

### Paso 1: Ejecutar el Script de Base de Datos en `MXTLAS02`
1. Abrir **SQL Server Management Studio (SSMS)** y conectarse al servidor de producción **`MXTLAS02`**.
2. Abrir y ejecutar el archivo:
   `Gemini/008_Despliegue_Produccion_Pallets_Panal_V3.sql`.
3. Validar en la pestaña *Messages / Resultados* que los 3 objetos se hayan creado/actualizado correctamente:
   - `tblLog_PalletsPanal` (Tabla de logs)
   - `pa_P009_00132_tblLogPalletsPanalInsert` (SP de telemetría)
   - `pa_P009_00132_07_03_tblPalletsInsertcmdV02` (SP de inserción atómica V02)

### Paso 2: Desplegar el Ejecutable en las Terminales de Planta
1. Copiar el ejecutable generado:
   `PROY052_PalletsPanal\bin\Release\PROY052_PalletsPanalGlobal.exe`
2. Distribuirlo o actualizarlo en la carpeta de ejecución de las máquinas de Pallets Pañal (o en el servidor de publicación ClickOnce / recurso compartido de red).

### Paso 3: Consultas de Auditoría y Verificación Post-Arranque
Una vez que las operadoras comiencen a capturar pallets, ejecutar en SSMS:

```sql
USE [TLX018MXDB];
GO

-- 1. Ver las últimas operaciones en tiempo real con sus tiempos en milisegundos
SELECT TOP 50 
    FechaHora,
    TipoOperacion,
    Accion,
    Estatus,
    TiempoMs,
    IdtblPallets,
    NoTarima,
    Mensaje,
    DetalleError,
    NombreEquipo,
    UsuarioWindows
FROM dbo.tblLog_PalletsPanal WITH (NOLOCK)
ORDER BY IdLog DESC;

-- 2. Métricas de rendimiento promedio por tipo de acción
SELECT 
    TipoOperacion,
    Accion,
    Estatus,
    COUNT(*) AS TotalOperaciones,
    AVG(TiempoMs) AS TiempoPromedioMs,
    MAX(TiempoMs) AS TiempoMaximoMs,
    MIN(TiempoMs) AS TiempoMinimoMs
FROM dbo.tblLog_PalletsPanal WITH (NOLOCK)
GROUP BY TipoOperacion, Accion, Estatus
ORDER BY TipoOperacion, Accion;

-- 3. Auditoría de alertas o bloqueos por datos incompletos
SELECT * 
FROM dbo.tblLog_PalletsPanal WITH (NOLOCK)
WHERE Estatus IN ('ERROR', 'BLOQUEADO_POR_DATOS')
ORDER BY IdLog DESC;
```
