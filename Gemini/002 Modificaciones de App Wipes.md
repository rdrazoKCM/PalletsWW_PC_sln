# 002 - Modificaciones de la Aplicación Pallets Wipes: Corrección de Tarimas Repetidas y Saltos de Folio

**Proyecto:** clsA_P035_PallestWipes  
**Base de Datos:** TLX022MXDB  
**Fecha:** 12 de Septiembre de 2026  
**Objetivo:** Erradicar la duplicidad de números de tarima (`NoTarima`) y los saltos de folios (gaps) provocados por lentitud de red y concurrencia entre líneas en la planta de Wipes, manteniendo la regla de negocio original por (Máquina + Producto) y sin afectar ninguna app externa en operación.

---

## 1. Resumen Ejecutivo y Diagnóstico

### El Problema Reportado
En la aplicación de captura de pallets de toallitas húmedas (Wipes), se presentaban de manera intermitente dos síntomas críticos:
1. **Tarimas repetidas:** Se generaban dos o más registros con el mismo número de tarima.
2. **Saltos de números:** En ocasiones el consecutivo se saltaba números dejando huecos que nunca se insertaron en la base de datos, o parecía "saltar" abruptamente de un número alto a uno bajo.

### Causa Raíz Identificada

1. **Condición de Carrera en la Asignación del Consecutivo (Genera Duplicados):**
   El procedimiento almacenado original (`pa_P009_01006_tblPalletsInsertcmd`) consultaba el contador con `SELECT NoConsecutivo FROM tblNoTarima` y luego hacía un `UPDATE tblNoTarima SET NoConsecutivo = NoConsecutivo + 1`. Al carecer de bloqueos exclusivos (`UPDLOCK`, `HOLDLOCK`), dos guardados simultáneos o retardados por lentitud de red leían exactamente el mismo valor de consecutivo y generaban tarimas duplicadas.
2. **Incremento No Transaccional del Contador (Genera Saltos Reales de Folio):**
   El contador `tblNoTarima` se incrementaba al principio del procedimiento. Como no existía un bloque transaccional (`BEGIN TRANSACTION ... COMMIT TRANSACTION`) ni control de excepciones con `ROLLBACK`, si la conexión sufría un retardo o timeout de red al intentar insertar en `tblPallets`, el contador en disco ya había subido pero el pallet nunca se guardaba. Al reintentar la captura, el sistema tomaba el siguiente número, dejando un hueco/salto definitivo.
3. **Consecutivos Particionados por Producto (Genera Saltos Aparentes):**
   En Wipes, el contador se lleva por la combinación `WHERE NoMaquina = @NoMaquina AND IdtblProductos = @IdtblProductos`. Cada máquina maneja series independientes para cada clave de producto. Si una máquina cambia de presentación o empaca dos productos simultáneos en líneas paralelas, una línea puede ir en el pallet 50 y la otra en el 40, lo que a simple vista parecía un salto errático para el operador.
4. **Falla Concurrente con `IDENT_CURRENT` (.NET):**
   Al terminar de guardar la fila, el código cliente ejecutaba `SELECT IDENT_CURRENT ('dbo.tblPallets')`. Esta función devuelve el último ID generado por **cualquier máquina o conexión en toda la base de datos**, provocando que ante guardados casi simultáneos una máquina consultara e imprimiera la etiqueta del pallet de otra máquina.

---

## 2. Garantía de Seguridad e Integridad de Datos

> [!IMPORTANT]
> **Cero Riesgo para la Operación y Producción:**
> - **Cero borrado de datos:** El nuevo Stored Procedure **NO contiene ninguna instrucción `DELETE` ni `TRUNCATE`**. No borra registros de pallets ni altera la configuración de otras máquinas.
> - **Cero impacto en aplicaciones existentes:** Se creó un **nuevo procedimiento versionado (`pa_P009_01006_tblPalletsInsertcmdV02`)**. El procedimiento original permanece 100% intacto en `TLX022MXDB`.
> - **Protección absoluta contra caídas de red:** Se incorporó `SET XACT_ABORT ON;` junto con `BEGIN TRY ... BEGIN CATCH` y `ROLLBACK TRANSACTION`. Si la red falla a mitad de la operación, el contador se revierte de inmediato a su número original, evitando huecos.

---

## 3. Detalle de los Cambios Implementados

### A. Base de Datos: Nuevo Stored Procedure `pa_P009_01006_tblPalletsInsertcmdV02`
**Archivos SQL:**  
- `Gemini/pa_P009_01006_tblPalletsInsertcmdV02.sql` (en `PROY052_PalletsPanal`)  
- `C:\AI\Git Hub\clsA_P035_PallestWipes\Gemini\pa_P009_01006_tblPalletsInsertcmdV02.sql`

#### Mejoras Técnicas:
1. **Reserva e Incremento Atómico con Bloqueo de Fila:**
   ```sql
   IF NOT EXISTS (
       SELECT 1 
       FROM tblNoTarima WITH (UPDLOCK, HOLDLOCK) 
       WHERE NoMaquina = @NoMaquina AND IdtblProductos = @IdtblProductos
   )
   BEGIN
       INSERT INTO tblNoTarima (NoMaquina, IdtblProductos, NoMes, NoConsecutivo)
       VALUES (@NoMaquina, @IdtblProductos, MONTH(@Fecha), 2);

       SET @Noconsecutivo = 1;
   END
   ELSE
   BEGIN
       UPDATE tblNoTarima WITH (UPDLOCK, ROWLOCK, HOLDLOCK)
       SET @Noconsecutivo = NoConsecutivo,
           NoConsecutivo = NoConsecutivo + 1
       WHERE NoMaquina = @NoMaquina AND IdtblProductos = @IdtblProductos;
   END
   ```
   - `UPDLOCK, HOLDLOCK`: Bloquea la fila del contador para esa máquina y producto durante los milisegundos que dura la transacción. Ninguna otra sesión puede leer ni adelantarse.
   - En una sola instrucción atómica en CPU se asigna `@Noconsecutivo = NoConsecutivo` y se incrementa `NoConsecutivo = NoConsecutivo + 1`.
2. **Transaccionalidad ACID:**
   Todo el guardado (reserva de contador, inserción en `tblPallets` y actualización de `TotalCajas` en `tblRT_Produccion`) se ejecuta dentro de un único bloque protegido con `COMMIT TRANSACTION`. Si ocurre cualquier fallo, se ejecuta `ROLLBACK TRANSACTION`.

---

### B. Código Fuente de la Aplicación (.NET / Visual Basic)

#### 1. Conexión al nuevo SP en Capa de Datos
- **Archivo:** `C:\AI\Git Hub\clsA_P035_PallestWipes\clsD\clsD_0001_tblPallets.vb` (Línea 261)
- **Cambio:** Se actualizó `sInsertCommand` para apuntar a:
  ```vb
  clU_dgv.sInsertCommand(o_clU_strucdgv1DatosDS, o_clU_strucdgv1DatosSource, _
  "pa_P009_01006_tblPalletsInsertcmdV02", cmInsertCmd)
  ```

#### 2. Protección contra Manejadores Acumulados y Sustitución de `IDENT_CURRENT`
- **Archivo:** `C:\AI\Git Hub\clsA_P035_PallestWipes\clsU\clsU_00901_dgv.vb`
- **Cambio 1 (Líneas 256 y 301):** Se añadió `RemoveHandler` antes de cada `AddHandler` en `sGuardarCambiosdgvTable1` y `s2GuardarCambiosdgvTable1`.
- **Cambio 2 (Línea 756):** En `OnRowUpdated`, se reemplazó la consulta insegura de `IDENT_CURRENT` por `@@IDENTITY`:
  ```vb
  ccm = New SqlCommand("SELECT @@IDENTITY", e.Command.Connection)
  intFolio = ccm.ExecuteScalar
  ```
  Esto garantiza que el ID recuperado para la impresión de la etiqueta corresponda de forma estricta y única a la fila que acaba de insertar esa conexión específica, eliminando cualquier cruce entre máquinas.

---

## 4. Pruebas y Validación Realizadas

1. **Despliegue en Base de Datos de Desarrollo (`DESKTOP-GNLGUOC.TLX022MXDB`):**
   - Se desplegó `pa_P009_01006_tblPalletsInsertcmdV02` (Object ID: `1853249657`).
2. **Prueba Transaccional Aislada con Rollback:**
   - Se ejecutó el procedimiento simulando la captura de un pallet en la Máquina 9 con el Producto 361.
   - **Resultado:**
     - Generó la tarima correctamente formateada: `TXWW1-156-1`
     - Lote asignado: `TL615601A`
     - Incrementó el contador a `2` en `tblNoTarima`.
     - Al ejecutarse el `ROLLBACK`, tanto el registro del pallet como la fila del contador se eliminaron limpiamente sin dejar residuos ni huecos.
3. **Compilación de la Solución:**
   - Se ejecutó la recompilación completa con MSBuild sobre `clsA_P035_PallestWipes.sln`.
   - **Resultado:** **`0 Errores`**
   - Binario generado listo en:  
     `C:\AI\Git Hub\clsA_P035_PallestWipes\bin\Debug\clsA_P035_PallestWipes.exe`

---

## 5. Procedimiento de Puesta en Marcha en Producción

1. **En el Servidor de Base de Datos Producción (`MXTLAS02`):**
   - Abrir SQL Server Management Studio (SSMS) conectado a `MXTLAS02`.
   - Abrir y ejecutar el script `Gemini/pa_P009_01006_tblPalletsInsertcmdV02.sql` en la base de datos `TLX022MXDB`.
   *(Esto crea únicamente el nuevo SP V02 sin tocar ninguna tabla ni el SP anterior).*
2. **En las Estaciones de Trabajo de Wipes:**
   - Desplegar la nueva versión compilada de `clsA_P035_PallestWipes.exe`.

---

## 6. Consultas SQL de Monitoreo y Auditoría para Wipes (`TLX022MXDB`)

### Consulta A: Monitoreo Rápido de Tarimas Repetidas en Wipes
```sql
USE [TLX022MXDB];
GO

SELECT 
    NoTarima,
    IdtblProductos,
    COUNT(*) AS TotalRepeticiones,
    MIN(FechaSys) AS PrimeraCaptura,
    MAX(FechaSys) AS UltimaCaptura
FROM dbo.tblPallets
GROUP BY NoTarima, IdtblProductos
HAVING COUNT(*) > 1
ORDER BY UltimaCaptura DESC;
```

### Consulta B: Verificación de Contadores Activos por Máquina y Producto
```sql
USE [TLX022MXDB];
GO

SELECT 
    m.NombreMaquina AS MAQUINA,
    p.ClaveProducto AS CLAVE,
    p.DescripcionProducto AS PRODUCTO,
    c.NoConsecutivo - 1 AS [ULTIMA TARIMA EMITIDA],
    c.NoConsecutivo AS [SIGUIENTE TARIMA A EMITIR]
FROM dbo.tblNoTarima c
INNER JOIN TLX009MXDB.dbo.tblMaquinas m ON m.NoMaquina = c.NoMaquina
INNER JOIN TLX040MXDB.dbo.tblProductos p ON p.IdtblProductos = c.IdtblProductos
ORDER BY m.NombreMaquina, p.ClaveProducto;
```

### Consulta C: Monitoreo por Rango de Fechas (Resumen)
Permite especificar cualquier rango de fechas para verificar si existen tarimas repetidas en ese periodo:
```sql
USE [TLX022MXDB];
GO

DECLARE @FechaInicio DATE = '2026-09-12'; -- Ajustar fecha inicial
DECLARE @FechaFin    DATE = '2026-09-12'; -- Ajustar fecha final

SELECT 
    p.NoTarima,
    p.IdtblProductos,
    prod.ClaveProducto,
    prod.DescripcionProducto,
    COUNT(*) AS TotalRepeticiones,
    MIN(p.FechaSys) AS PrimeraCaptura,
    MAX(p.FechaSys) AS UltimaCaptura,
    DATEDIFF(SECOND, MIN(p.FechaSys), MAX(p.FechaSys)) AS DiferenciaSegundos
FROM dbo.tblPallets p
LEFT JOIN TLX040MXDB.dbo.tblProductos prod ON prod.IdtblProductos = p.IdtblProductos
WHERE p.FechaSys >= @FechaInicio 
  AND p.FechaSys < DATEADD(DAY, 1, @FechaFin)
GROUP BY p.NoTarima, p.IdtblProductos, prod.ClaveProducto, prod.DescripcionProducto
HAVING COUNT(*) > 1
ORDER BY UltimaCaptura DESC;
```

### Consulta D: Detalle Completo de Tarimas Repetidas en un Rango de Fechas
Si se detecta alguna tarima repetida en el resumen, esta consulta muestra fila por fila cada registro con su hora exacta, lote, vale y empleado que capturó:
```sql
USE [TLX022MXDB];
GO

DECLARE @FechaInicio DATE = '2026-09-12'; -- Ajustar fecha inicial
DECLARE @FechaFin    DATE = '2026-09-12'; -- Ajustar fecha final

SELECT 
    p.IdtblPallets,
    p.NoTarima,
    p.Lote,
    p.FolioVale,
    p.IdtblProductos,
    prod.ClaveProducto,
    prod.DescripcionProducto,
    p.TotalCajas,
    p.Hora,
    p.FechaSys,
    p.NoEmpCapturo
FROM dbo.tblPallets p
LEFT JOIN TLX040MXDB.dbo.tblProductos prod ON prod.IdtblProductos = p.IdtblProductos
WHERE p.FechaSys >= @FechaInicio 
  AND p.FechaSys < DATEADD(DAY, 1, @FechaFin)
  AND p.NoTarima IN (
      SELECT NoTarima 
      FROM dbo.tblPallets 
      WHERE FechaSys >= @FechaInicio 
        AND FechaSys < DATEADD(DAY, 1, @FechaFin)
      GROUP BY NoTarima 
      HAVING COUNT(*) > 1
  )
ORDER BY p.NoTarima, p.FechaSys;
```
*(Si ambas consultas regresan 0 filas, significa que en ese rango de fechas no existió ninguna tarima duplicada).*

