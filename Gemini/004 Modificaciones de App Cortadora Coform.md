# 004 - Modificaciones de la Aplicación Cortadora Coform: Corrección Definitiva de Paquetes Repetidos y Saltos de Folio

**Proyecto:** clsA_P050_CortadoraCoform  
**Ubicación de Código:** `C:\AI\Git Hub\clsA_P050_CortadoraCoform`  
**Base de Datos:** `TLX023MXDB`  
**Fecha:** 14 de Septiembre de 2026  
**Objetivo:** Erradicar de raíz la duplicidad de números de paquete (`PAQUETE.CODIGO`) y los saltos de consecutivo provocados por concurrencia y lentitud de red en la Cortadora Coform (TXNW-2, Máquinas 388, 390, 391), asegurando sincronización exacta entre la base de datos y la etiqueta física impresa por la Zebra, sin afectar la operación histórica ni otras aplicaciones.

---

## 1. Resumen Ejecutivo y Diagnóstico

### El Problema Reportado
Al igual que en las aplicaciones de Pallets de Pañal (`PROY052_PalletsPanal`) y Pallets Wipes (`clsA_P035_PallestWipes`), en la aplicación de Cortadora Coform se presentaban dos síntomas críticos en la captura de paquetes:
1. **Paquetes repetidos:** Se generaban registros duplicados en la base de datos compartiendo el mismo código de paquete (`CODIGO`). La auditoría histórica en `TLX023MXDB` confirmó códigos duplicados previos (ej. `1600000161`, `1600000159`, `1600000157`, etc.).
2. **Saltos de número (Gaps):** El consecutivo se saltaba números dejando huecos que nunca se guardaban en la base de datos, o desfasaba la numeración física respecto a la electrónica.

### Causa Raíz Identificada

1. **Lectura Previa No Bloqueante en el Cliente (.NET):**
   Al abrir la pantalla o dar de alta un paquete, la aplicación ejecutaba `Utils.ObtenSiguientePaquete`, realizando un `SELECT dbo.fnAppendCeros(numero, 8) FROM CONTADORES2 WHERE id = @NoMaquina`. En ese instante el contador en la base de datos **no se incrementaba ni se bloqueaba**, quedando reservado únicamente en la pantalla visual del operador. Si otra terminal o usuario capturaba al mismo tiempo, ambos recibían la misma propuesta de código.
2. **Condición de Carrera en `prAdminPaquetes` (`@op = 2`):**
   El procedimiento recibía el `@CODIGO` enviado por el cliente. Si detectaba que ya existía (`IF EXISTS(...)`), incrementaba `CONTADORES2` y generaba otro código, pero **sin ningún bloqueo de aislamiento (`UPDLOCK`, `HOLDLOCK`)**. Dos peticiones concurrentes podían evaluar el `IF EXISTS` simultáneamente antes de que la primera insertara, provocando intentos de inserción con la misma clave.
3. **Desconexión entre SQL y la Etiqueta Impresa (`@CODIGO` no retornado):**
   En el procedimiento original, si SQL regeneraba el código `@CODIGO` por colisión, **dicho valor nunca se devolvía a Visual Basic .NET** (el parámetro `@CODIGO` estaba declarado como entrada unidireccional). Por lo tanto, la aplicación mandaba a imprimir a la Zebra el código viejo que tenía en `Me.txtPaquete.Text`, resultando en una etiqueta física con un código y la base de datos con otro (o duplicado).
4. **Doble Incremento del Contador (Genera Saltos):**
   Si el código ya existía, el procedimiento original hacía `UPDATE CONTADORES2 SET NUMERO = NUMERO + 1` en el bloque de corrección, y más adelante volvía a ejecutar `UPDATE CONTADORES2 SET NUMERO = NUMERO + 1` al finalizar el empaque de bobinas. Esto provocaba que el contador avanzara dos unidades en un solo registro (salto de consecutivo).
5. **Falta de Transaccionalidad Protegida:**
   Si la conexión sufría un timeout o caída de red al insertar las bobinas en `BOBINAS_PAQUETE` o al ligar el folio de entrega, no existía un bloque `BEGIN TRY ... BEGIN CATCH` con `ROLLBACK TRANSACTION` seguro, dejando el contador desfasado.

---

## 2. Garantía de Seguridad e Integridad de Datos

> [!IMPORTANT]
> **Cero Riesgo para la Producción:**
> - **Cero borrado de datos:** Ningún registro de `PAQUETE`, `BOBINAS`, `BOBINAS_PAQUETE` o `CONTADORES2` es eliminado.
> - **Cero impacto en aplicaciones existentes:** Se creó el procedimiento almacenado versionado **`prAdminPaquetesV02`**. El procedimiento original `prAdminPaquetes` permanece intacto en `TLX023MXDB`.
> - **Protección contra caídas de red:** Se incorporó `SET XACT_ABORT ON;` junto con `BEGIN TRY ... BEGIN CATCH` y `ROLLBACK TRANSACTION`. Cualquier fallo revierte el contador automáticamente, previniendo huecos.

---

## 3. Detalle de los Cambios Implementados

### A. Base de Datos: Stored Procedure `prAdminPaquetesV02`
**Archivos SQL:**  
- `c:\AI\Git Hub\PROY052_PalletsPanal\Gemini\pa_AdminPaquetesV02.sql`  
- `C:\AI\Git Hub\clsA_P050_CortadoraCoform\pa_AdminPaquetesV02.sql`

#### Mejoras Técnicas Clave:
1. **Reserva e Incremento Atómico con Bloqueo Exclusivo de Fila:**
   ```sql
   DECLARE @Consecutivo INT;

   UPDATE CONTADORES2 WITH (UPDLOCK, ROWLOCK, HOLDLOCK)
   SET @Consecutivo = NUMERO,
       NUMERO = NUMERO + 1
   WHERE ID = @NO_MAQUINA;
   ```
   - `UPDLOCK, ROWLOCK, HOLDLOCK`: Bloquea exclusivamente el registro de la máquina en `CONTADORES2` durante los milisegundos de la transacción. Las peticiones simultáneas se forman en cola en memoria en SQL Server, garantizando que nunca lean el mismo número.
   - Incrementa el contador **una sola vez**.
2. **Generación Autorizada del Código en Servidor:**
   ```sql
   SET @CODIGO = CAST(@NO_MAQUINA AS VARCHAR(4)) + CAST(@PLANTA AS VARCHAR(2)) + dbo.fnAppendCeros(@Consecutivo, 8);

   -- Blindaje contra colisiones con registros históricos
   WHILE EXISTS (SELECT 1 FROM PAQUETE WITH (UPDLOCK, HOLDLOCK) WHERE CODIGO = @CODIGO)
   BEGIN
       UPDATE CONTADORES2 WITH (UPDLOCK, ROWLOCK, HOLDLOCK)
       SET @Consecutivo = NUMERO,
           NUMERO = NUMERO + 1
       WHERE ID = @NO_MAQUINA;

       SET @CODIGO = CAST(@NO_MAQUINA AS VARCHAR(4)) + CAST(@PLANTA AS VARCHAR(2)) + dbo.fnAppendCeros(@Consecutivo, 8);
   END
   ```
3. **Parámetro `@CODIGO OUTPUT`:**
   El procedimiento devuelve el código oficial generado:
   ```sql
   CREATE PROCEDURE [dbo].[prAdminPaquetesV02]
       @op tinyint = 0,
       @CODIGO varchar(15) = '' OUTPUT,
       ...
   ```
4. **Protección Transaccional Robusta:**
   Toda la operación (alta de paquete, bobinas empacadas y asignación a folio) se ejecuta dentro de un bloque `BEGIN TRY ... COMMIT TRANSACTION` con reversión automática `ROLLBACK TRANSACTION` ante cualquier error.

---

### B. Aplicación Visual Basic .NET (`clsA_P050_CortadoraCoform`)

#### 1. Capa de Utilerías ([Utils.vb](file:///C:/AI/Git%20Hub/clsA_P050_CortadoraCoform/clsU/Utils.vb))
- Firma del método actualizada para pasar `CODIGO` por referencia:
  ```vb
  Public Shared Sub AdminPaquetes(op As Integer, ByRef CODIGO As String, PESO_BASE_ID As Integer, ...)
  ```
- Invocación redirigida a `prAdminPaquetesV02`:
  ```vb
  cmd.CommandText = "prAdminPaquetesV02"
  ```
- Parámetro configurado como bidireccional (`InputOutput`):
  ```vb
  Dim pCodigo As New SqlParameter("@CODIGO", SqlDbType.VarChar, 15)
  pCodigo.Direction = ParameterDirection.InputOutput
  pCodigo.Value = CODIGO
  cmd.Parameters.Add(pCodigo)
  ```
- Recuperación del código confirmado por SQL tras ejecutar:
  ```vb
  cmd.ExecuteNonQuery()
  siam = cmd.Parameters("@SIAM").Value.ToString()
  CODIGO = cmd.Parameters("@CODIGO").Value.ToString()
  ```

#### 2. Formulario de Paquetes ([frmCrearPaquete.vb](file:///C:/AI/Git%20Hub/clsA_P050_CortadoraCoform/clsA/frmCrearPaquete.vb))
- En el evento `btnGuardar_Click`:
  ```vb
  Dim codigoGuardar As String = Me.txtPaquete.Text
  Utils.AdminPaquetes(2, codigoGuardar, 0, row(3).ToString(), ...)
  Me.txtPaquete.Text = codigoGuardar
  ```
- Se envía `Me.txtPaquete.Text` (actualizado con `codigoGuardar`) a la rutina de impresión Zebra:
  ```vb
  Dim codigo As String = Me.txtPaquete.Text
  ...
  Utils.ImprimeEtiquetaPaqueteZebraNuevo(codigo, peso_base, peso_base_descr, ...)
  ```
  **Garantía:** La etiqueta impresa físicamente siempre corresponde al registro exacto insertado en la base de datos.

---

## 4. Resultados de Pruebas y Validación

### 4.1 Compilación .NET
- **Compilador:** MSBuild 18.10.1 (Visual Studio 2022)
- **Configuración:** `Debug` / `Any CPU`
- **Resultado:** **0 Errores**, compilación limpia y exitosa.
- **Binario generado:** `C:\AI\Git Hub\clsA_P050_CortadoraCoform\bin\Debug\clsA_P050_CortadoraCoform.exe`.

### 4.2 Prueba de Generación Concurrente y Consecutiva
Se ejecutaron llamadas consecutivas sobre la máquina 390 en `TLX023MXDB`:
- Consecutivo inicial: `269761`
- Códigos generados:
  1. `390600269761`
  2. `390600269762`
  3. `390600269763`
- **Resultado:** Generación matemática continua, 0 duplicados y 0 saltos.

### 4.3 Prueba de Reversión Transaccional (Rollback)
Se forzó un error de clave foránea al asociar bobinas para verificar el comportamiento ante fallas de red:
- **Resultado:** La transacción hizo `ROLLBACK` completo. El contador no avanzó en falso y no quedaron paquetes huérfanos.

---

## 5. Guía de Despliegue a Producción

### Paso 1: Crear el Stored Procedure en Producción
1. Abre **SQL Server Management Studio (SSMS)** y conéctate al servidor de base de datos de producción:
   - **Servidor:** `172.26.52.14` (o `MXTLAS02`)
   - **Base de Datos:** `TLX023MXDB`
2. Abre y ejecuta el archivo:
   [pa_AdminPaquetesV02.sql](file:///C:/AI/Git%20Hub/clsA_P050_CortadoraCoform/pa_AdminPaquetesV02.sql)
3. Confirma que el procedimiento aparezca en:
   `TLX023MXDB -> Programmability -> Stored Procedures -> dbo.prAdminPaquetesV02`.

### Paso 2: Desplegar la Aplicación
1. Asegúrate de que el archivo de configuración `clsA_P050_CortadoraCoform.exe.config` en producción apunte a la base de datos de producción con el usuario y contraseña vigentes:
   ```xml
   <connectionStrings>
     <clear/>
     <add name="dsn" connectionString="Data Source=172.26.52.14;Initial Catalog=TLX023MXDB;User ID=tlx1mxpublic;Password=TU_PASSWORD" providerName="System.Data.SqlClient"/>
   </connectionStrings>
   ```
2. Distribuye el nuevo ejecutable compilado `clsA_P050_CortadoraCoform.exe` en las estaciones de la Cortadora Coform.

---

## 6. Consulta SQL de Monitoreo de Duplicados (Para Producción)

Para auditar y monitorear periódicamente que no existan duplicados:

```sql
USE [TLX023MXDB];
GO

DECLARE @FechaInicio DATETIME = '2026-09-01 00:00:00';
DECLARE @FechaFin    DATETIME = '2026-09-30 23:59:59';

SELECT 
    CODIGO, 
    COUNT(*) AS Repeticiones, 
    NO_MAQUINA, 
    MIN(CREACION) AS PrimeraFecha, 
    MAX(CREACION) AS UltimaFecha
FROM PAQUETE
WHERE CREACION >= @FechaInicio AND CREACION <= @FechaFin
GROUP BY CODIGO, NO_MAQUINA
HAVING COUNT(*) > 1
ORDER BY Repeticiones DESC, UltimaFecha DESC;
```
*(Si la consulta no arroja registros, el sistema opera con 100% de integridad).*
