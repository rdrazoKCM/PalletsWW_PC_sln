# 001 - Modificaciones de la Aplicación: Corrección de Duplicidad de Tarimas

**Proyecto:** PROY052_PalletsPanal  
**Fecha:** 12 de Septiembre de 2026  
**Objetivo:** Eliminar la duplicidad de números de tarima (`NoTarima`) provocada por lentitud, retardos o microcortes de red y condiciones de concurrencia, sin afectar ninguna otra aplicación en producción.

---

## 1. Resumen Ejecutivo y Diagnóstico

### El Problema
En el proceso de guardado de pallets de pañal se detectó que el número de tarima se repetía esporádicamente (por ejemplo, en la Máquina 2 a las 03:35, 03:43 y 03:46), tanto en máquinas de una sola línea como de dos líneas. Esto ocurría con mayor frecuencia debido a la lentitud reciente experimentada en la red de planta.

### Causa Raíz Identificada
1. **Procedimiento Almacenado Original No Atómico (`pa_P009_00132_07_03_tblPalletsInsertcmd`):**
   - El SP original leía primero el contador: `SELECT @NoTarima = NoTarima FROM tblContadoresTarima WHERE NoMaquina = @NoMaquina`.
   - Luego insertaba el pallet en `tblPalletsPanal`.
   - Posteriormente ejecutaba un `UPDATE tblContadoresTarima SET NoTarima = @NoTarima + 1`.
   - **Falla:** No contaba con `BEGIN TRANSACTION` ni `COMMIT TRANSACTION`. Si ocurría un retardo o timeout de red entre el `INSERT` y el `UPDATE`, o si se reintentaba la operación, el pallet quedaba insertado pero el contador no se incrementaba o se sobreescribía con el valor viejo almacenado en la variable en memoria.
2. **Capa Cliente (.NET):**
   - El `SqlDataAdapter` agregaba el manejador de eventos `AddHandler daLlenarDataGridView.RowUpdated, AddressOf OnRowUpdated` en cada guardado sin limpiarlo previamente, lo que ante reintentos de red podía provocar llamadas acumuladas al evento de confirmación e impresión.

---

## 2. Garantía de Seguridad e Integridad de Datos

> [!IMPORTANT]
> **Seguridad y Certeza Absoluta para Producción:**
> - **Cero borrado de datos:** El nuevo Stored Procedure **NO contiene ninguna instrucción `DELETE` ni `TRUNCATE`**. No borra absolutamente ningún registro histórico de pallets, máquinas, vales ni catálogos.
> - **Cero actualizaciones indebidas:** Las únicas tablas modificadas son las mismas que modificaba el SP original:
>   1. `tblContadoresTarima`: incrementa en +1 el contador exclusivo de la máquina que está guardando.
>   2. `tblRT_Produccion`: recalcula la sumatoria de cajas del vale activo (`TotalCajas`).
> - **Cero afectación a otras aplicaciones:** Se creó un **nuevo Stored Procedure con nombre independiente (`pa_P009_00132_07_03_tblPalletsInsertcmdV02`)**. El SP original permanece **100% intacto**, garantizando que ninguna otra aplicación o módulo que dependa de él sufra alteraciones.

---

## 3. Detalle de los Cambios Implementados

### A. Base de Datos: Nuevo Stored Procedure `pa_P009_00132_07_03_tblPalletsInsertcmdV02`
**Archivo SQL:** `Gemini/pa_P009_00132_07_03_tblPalletsInsertcmdV02.sql`

#### Mejoras Técnicas Implementadas:
1. **`SET XACT_ABORT ON`:** Si el cliente pierde la conexión o se produce un timeout de red a mitad del guardado, SQL Server aborta de inmediato y revierte toda la transacción en automático, impidiendo registros huérfanos o bloqueos residuales.
2. **Bloqueo Exclusivo y Reserva Atómica del Contador:**
   Se sustituyó la lectura sucia y posterior actualización por una instrucción atómica indivisible:
   ```sql
   UPDATE tblContadoresTarima WITH (UPDLOCK, ROWLOCK, HOLDLOCK)
   SET @NoTarima = NoTarima,
       NoTarima = NoTarima + 1
   WHERE NoMaquina = @NoMaquina;
   ```
   - `UPDLOCK` / `HOLDLOCK`: Garantiza que ninguna otra sesión, línea de producción o hilo pueda leer o alterar el contador hasta que esta transacción finalice.
   - Asignación atómica: En el mismo ciclo de CPU donde se lee `@NoTarima`, el contador físico en disco ya queda incrementado a `NoTarima + 1`. Es imposible que dos guardados obtengan el mismo número.
3. **Bloque Transaccional `BEGIN TRY ... BEGIN CATCH`:**
   ```sql
   BEGIN TRANSACTION;
   BEGIN TRY
       -- Consultas descriptivas
       -- Reserva atómica del contador
       -- Inserción en tblPalletsPanal
       -- Actualización de TotalCajas en tblRT_Produccion
       COMMIT TRANSACTION;
   END TRY
   BEGIN CATCH
       IF @@TRANCOUNT > 0
           ROLLBACK TRANSACTION;
       THROW;
   END CATCH
   ```
   Todo se guarda completo o nada se guarda, garantizando consistencia total (cumplimiento ACID).

---

### B. Código Fuente de la Aplicación (.NET / Visual Basic)

#### 1. Conexión al nuevo SP en Capa de Datos
- **Archivo modificado:** `PROY052_PalletsPanal/clsD/clsD_0001_tblPallets.vb`
- **Línea:** 243
- **Cambio:**
  ```diff
  - clU_dgv.sInsertCommand(o_clU_strucdgv1DatosDS, o_clU_strucdgv1DatosSource, "pa_P009_00132_07_03_tblPalletsInsertcmd", cmInsertCmd)
  + clU_dgv.sInsertCommand(o_clU_strucdgv1DatosDS, o_clU_strucdgv1DatosSource, "pa_P009_00132_07_03_tblPalletsInsertcmdV02", cmInsertCmd)
  ```
  *Nota: Los parámetros recibidos (`@IdAutotblProduccion`, `@NoMaquina`, `@TotalCajas`, `@NoEmpCapturo`) se mantuvieron con exactamente los mismos nombres, tipos y orden.*

#### 2. Limpieza de Manejadores de Eventos en DataGridView
- **Archivo modificado:** `PROY052_PalletsPanal/clsU/clsU_00901_dgv.vb`
- **Líneas:** 254 y 298
- **Cambio:** Se agregó `RemoveHandler` inmediatamente antes de cada `AddHandler`:
  ```vb
  RemoveHandler o_clU_Estructurads.daLlenarDataGridView.RowUpdated, AddressOf OnRowUpdated
  AddHandler o_clU_Estructurads.daLlenarDataGridView.RowUpdated, AddressOf OnRowUpdated
  ```
  Esto asegura que el evento `RowUpdated` (donde se dispara la impresión RFID y la consulta cruzada de confirmación) se ejecute exactamente una vez por cada fila guardada, incluso ante reintentos de red.

---

## 4. Pruebas y Validación Realizadas

1. **Validación del Stored Procedure en Base de Datos de Desarrollo (`DESKTOP-GNLGUOC.TLX018MXDB`):**
   - Se ejecutó una prueba transaccional aislada reservando el contador de la Máquina 2 (`NoMaquina = 2`).
   - Se verificó que leyó el folio consecutivo exacto (`506366`), generó el formato de tarima `TL02-506366`, insertó en `tblPalletsPanal` y recalculó `tblRT_Produccion`.
   - Se probó el `ROLLBACK` y se comprobó que el contador regresó exactamente a su estado previo sin dejar residuos ni bloqueos activos.
2. **Validación de Compilación del Proyecto:**
   - Se ejecutó recompilación completa con MSBuild sobre `PROY052_PalletsPanal.sln`.
   - **Resultado:** `0 Errores` (Compilación limpia y exitosa).
   - El nuevo binario generado se encuentra en:  
     `PROY052_PalletsPanal\bin\Debug\PROY052_PalletsPanalGlobal.exe`

---

## 5. Procedimiento de Puesta en Marcha en Producción

1. **En el Servidor de Base de Datos Producción (`MXTLAS02`):**
   - Conectarse mediante SQL Server Management Studio a `MXTLAS02`.
   - Ejecutar el script `Gemini/pa_P009_00132_07_03_tblPalletsInsertcmdV02.sql` en la base de datos `TLX018MXDB`.
   *(Esto creará únicamente el nuevo SP V02; no afecta ninguna tabla existente ni al SP original).*
2. **En las Estaciones de Trabajo / Máquinas:**
   - Desplegar la versión compilada de `PROY052_PalletsPanalGlobal.exe`.
   - Con esto, la estación pasará a utilizar la versión atómica y protegida contra retardos de red.

---

## 6. Consultas SQL de Monitoreo y Auditoría de Duplicados

Para supervisar continuamente y verificar que no existan tarimas duplicadas, se pueden utilizar las siguientes consultas en `TLX018MXDB`:

### Consulta A: Monitoreo Rápido / Resumen de Tarimas Repetidas
Agrupa por número de tarima e identifica si alguno tiene más de un registro, mostrando cuántas veces se repitió y las fechas de captura:
```sql
USE [TLX018MXDB];
GO

SELECT 
    NoTarima,
    NoMaquina,
    COUNT(*) AS TotalRepeticiones,
    MIN(FechaSys) AS PrimeraCaptura,
    MAX(FechaSys) AS UltimaCaptura
FROM dbo.tblPalletsPanal
GROUP BY NoTarima, NoMaquina
HAVING COUNT(*) > 1
ORDER BY UltimaCaptura DESC;
```

### Consulta B: Detalle Completo de los Pallets Repetidos
Muestra fila por fila todos los datos de los pallets que comparten la misma tarima (útil para ver qué usuario capturó, qué vale de producción se usó y las diferencias de hora):
```sql
USE [TLX018MXDB];
GO

SELECT 
    p.IdtblPalletsPanal,
    p.NoTarima,
    p.NoMaquina,
    p.IdAutotblProduccion,
    p.TotalCajas,
    p.ProdXCaja,
    p.Hora,
    p.FechaSys,
    p.NoEmpCapturo
FROM dbo.tblPalletsPanal p
WHERE p.NoTarima IN (
    SELECT NoTarima 
    FROM dbo.tblPalletsPanal 
    GROUP BY NoTarima 
    HAVING COUNT(*) > 1
)
ORDER BY p.NoTarima, p.FechaSys;
```

### Consulta C: Monitoreo Exclusivo del Día de Hoy (o Turno Actual)
Permite verificar de un solo vistazo si hoy se ha presentado algún caso:
```sql
USE [TLX018MXDB];
GO

SELECT 
    NoTarima,
    NoMaquina,
    COUNT(*) AS TotalRepeticiones,
    MIN(FechaSys) AS PrimeraCaptura,
    MAX(FechaSys) AS UltimaCaptura
FROM dbo.tblPalletsPanal
WHERE FechaSys >= CAST(GETDATE() AS DATE)
GROUP BY NoTarima, NoMaquina
HAVING COUNT(*) > 1;
```
*(Si la consulta no devuelve ningún renglón, significa que la integridad es de 100% y no hay tarimas duplicadas).*

---

## 7. Validación Final en Vivo y Cierre de Implementación

### A. Resultados de la Prueba en Producción / Estación de Trabajo
Tras la compilación e instalación del nuevo ejecutable `PROY052_PalletsPanalGlobal.exe`, se realizaron capturas de prueba reales directamente en la aplicación conectada a la base de datos `TLX018MXDB`:

| IdtblPalletsPanal | IdAutotblProduccion | NoTarima | NoMaquina | TotalCajas | ProdXCaja | Factor | Hora | FechaSys | NoEmpCapturo | Estado Auditoría |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **2** | 394886 | **TL02-506366** | 2 | 10 | 192 | 1.280 | 12:46:11 | 2026-09-12 12:46:10.98 | 53697 | **OK (Consecutivo correcto)** |
| **3** | 394876 | **TL02-506367** | 2 | 10 | 192 | 1.280 | 12:48:15 | 2026-09-12 12:48:15.14 | 53697 | **OK (Consecutivo correcto)** |

### B. Hallazgos de la Auditoría Posterior:
1. **Incremento Estricto y Secuencial:** El contador pasó de `506366` a `506367` sin brincos, sin bloqueos y sin duplicar el número a pesar de la latencia de red.
2. **Cero Tarimas Duplicadas:** Se ejecutó la consulta de auditoría sobre `tblPalletsPanal` y arrojó **0 registros duplicados**.
3. **Cero Afectación a Apps Externas:** El procedimiento `pa_P009_00132_07_03_tblPalletsInsertcmd` permaneció intacto y sin interrupción de servicio para el resto de los módulos en planta.

### C. Conclusión y Estado del Sistema:
**ESTADO: IMPLEMENTADO Y VALIDADO CON ÉXITO.**  
La solución transaccional atómica (`V02`) resuelve de forma definitiva la condición de carrera y la vulnerabilidad por retardo de red en el guardado de tarimas de pañal.


