# 003 - Análisis y Solución de Aplicación: Cortadora Coform (clsA_P050_CortadoraCoform)

**Proyecto:** clsA_P050_CortadoraCoform  
**Ubicación:** `C:\AI\Git Hub\clsA_P050_CortadoraCoform`  
**Base de Datos Principal:** `TLX023MXDB`  
**Fecha:** 14 de Septiembre de 2026  
**Objetivo del Documento:**
1. Diagnosticar la causa del error de conexión `Login failed for user 'tlx1mxpublic'` y documentar con precisión dónde se almacena la cadena de conexión y cómo actualizarla.
2. Analizar exhaustivamente la arquitectura, flujos operativos, tablas y procedimientos almacenados de la aplicación de Cortadora Coform.
3. Evaluar los puntos críticos de concurrencia y generación de consecutivos (`CONTADORES`, `CONTADORES2`, `CONTADORES3`), confirmando la existencia de paquetes duplicados históricos en la base de datos.
4. Implementar la solución definitiva de alta concurrencia mediante el nuevo procedimiento almacenado `prAdminPaquetesV02` y la sincronización bidireccional del código con la impresora Zebra.

---

## 1. Diagnóstico del Error de Conexión: "Login failed for user 'tlx1mxpublic'"

### 1.1 ¿De dónde obtiene la aplicación las credenciales?
La aplicación es un proyecto Windows Forms en Visual Basic .NET (.NET Framework 4.8). Obtiene su conexión a la base de datos de los archivos de configuración XML estándar del framework (`System.Configuration.ConfigurationManager`):

1. **Archivo fuente en el proyecto:**  
   [app.config](file:///C:/AI/Git%20Hub/clsA_P050_CortadoraCoform/app.config) (Líneas 28 a 32)
2. **Archivo compilado de ejecución (el que lee el ejecutable directamente al abrir):**  
   [clsA_P050_CortadoraCoform.exe.config](file:///C:/AI/Git%20Hub/clsA_P050_CortadoraCoform/bin/Debug/clsA_P050_CortadoraCoform.exe.config) (Líneas 28 a 32)

Ambos archivos contienen actualmente el siguiente bloque:
```xml
  <connectionStrings>
    <clear/>
    <add name="dsn" connectionString="Password=bc8d6hK0Inq63hH4;User ID=tlx1mxpublic;Initial Catalog=TLX023MXDB;Data Source=172.26.52.14" providerName="System.Data.SqlClient"/>
  </connectionStrings>
```

En el código fuente ([Utils.vb](file:///C:/AI/Git%20Hub/clsA_P050_CortadoraCoform/clsU/Utils.vb)), más de 80 funciones y métodos consumen la conexión de esta forma:
```vb
Dim connections As ConnectionStringSettingsCollection = ConfigurationManager.ConnectionStrings
conn.ConnectionString = connections(0).ConnectionString
```
Al existir `<clear/>`, el elemento en la posición `(0)` es exactamente la cadena con nombre `"dsn"`.

---

### 1.2 Causa Raíz del Error (Error SQL Server 18456)
El error `"Login failed for user 'tlx1mxpublic'"` es un rechazo de autenticación generado por Microsoft SQL Server. Ocurre por una de las siguientes dos razones según el entorno:

1. **Si estás ejecutando la aplicación localmente en esta máquina de desarrollo (`DESKTOP-GNLGUOC`):**
   - La base de datos `TLX023MXDB` **SÍ existe** en tu servidor local `DESKTOP-GNLGUOC`.
   - Sin embargo, el login `tlx1mxpublic` **NO existe** en la instancia local de SQL Server (solamente existen `sa` y `MCM2010Ejecuta`).
   - Al intentar autenticarse con el usuario `tlx1mxpublic`, SQL Server rechaza el login de inmediato.

2. **Si estás intentando conectarte al servidor remoto de producción (`172.26.52.14` / `MXTLAS02`):**
   - La contraseña almacenada (`bc8d6hK0Inq63hH4`) ya no coincide con la contraseña actual en el servidor de producción (fue cambiada o expiró), o bien el usuario `tlx1mxpublic` fue deshabilitado / bloqueado en SQL Server.

---

### 1.3 ¿Cómo cambiar las credenciales?
Para solucionar el error y poder probar la aplicación, debes editar la cadena de conexión en:
- `C:\AI\Git Hub\clsA_P050_CortadoraCoform\app.config`
- `C:\AI\Git Hub\clsA_P050_CortadoraCoform\bin\Debug\clsA_P050_CortadoraCoform.exe.config`

#### Opción A: Para probar localmente en tu computadora (`DESKTOP-GNLGUOC`)
Modifica la línea 30 para usar el usuario local existente (`MCM2010Ejecuta` o `sa`):
```xml
  <connectionStrings>
    <clear/>
    <add name="dsn" connectionString="Data Source=DESKTOP-GNLGUOC;Initial Catalog=TLX023MXDB;User ID=MCM2010Ejecuta;Password=@User@;TrustServerCertificate=True" providerName="System.Data.SqlClient"/>
  </connectionStrings>
```

#### Opción B: Para conectarte al servidor de producción (`172.26.52.14`)
Reemplaza el valor de `Password` por la contraseña vigente actualizada que tenga asignado el usuario `tlx1mxpublic` en el servidor:
```xml
  <connectionStrings>
    <clear/>
    <add name="dsn" connectionString="Data Source=172.26.52.14;Initial Catalog=TLX023MXDB;User ID=tlx1mxpublic;Password=TU_NUEVA_CONTRASEÑA" providerName="System.Data.SqlClient"/>
  </connectionStrings>
```

---

## 2. Confirmación de Vulnerabilidad y Registros Duplicados Históricos

Al auditar la base de datos `TLX023MXDB`, se confirmó que la aplicación **efectivamente sufría del mismo problema de duplicados**:

```sql
SELECT TOP 10 CODIGO, COUNT(*) AS Repeticiones, NO_MAQUINA, MIN(CREACION) AS MinFecha, MAX(CREACION) AS MaxFecha
FROM PAQUETE
GROUP BY CODIGO, NO_MAQUINA
HAVING COUNT(*) > 1
ORDER BY Repeticiones DESC, MaxFecha DESC;
```

**Resultado obtenido de la auditoría en base de datos:**
| CODIGO | Repeticiones | NO_MAQUINA | MinFecha | MaxFecha |
| :--- | :---: | :---: | :--- | :--- |
| `1600000161` | 2 | 1 | 09/07/2020 02:46 p. m. | 14/07/2020 01:54 a. m. |
| `1600000159` | 2 | 1 | 09/07/2020 12:34 p. m. | 14/07/2020 12:51 a. m. |
| `1600000157` | 2 | 1 | 09/07/2020 10:48 a. m. | 13/07/2020 11:51 p. m. |
| `1600000155` | 2 | 1 | 09/07/2020 08:46 a. m. | 13/07/2020 10:41 p. m. |
| `1600000153` | 2 | 1 | 09/07/2020 06:17 a. m. | 13/07/2020 09:36 p. m. |

Esto demostró que la combinación de lectura estática en cliente y doble incremento no bloqueante en `prAdminPaquetes` permitía registros duplicados y saltos de folios.

---

## 3. Solución Implementada

### 3.1 Base de Datos: Nuevo Stored Procedure `prAdminPaquetesV02`
**Archivo SQL:** [pa_AdminPaquetesV02.sql](file:///c:/AI/Git%20Hub/PROY052_PalletsPanal/Gemini/pa_AdminPaquetesV02.sql)  
Copia en el proyecto: [pa_AdminPaquetesV02.sql](file:///C:/AI/Git%20Hub/clsA_P050_CortadoraCoform/pa_AdminPaquetesV02.sql)

#### Mejoras Técnicas Implementadas:
1. **Reserva Atómica con Bloqueo de Fila Exclusivo:**
   ```sql
   DECLARE @Consecutivo INT;

   UPDATE CONTADORES2 WITH (UPDLOCK, ROWLOCK, HOLDLOCK)
   SET @Consecutivo = NUMERO,
       NUMERO = NUMERO + 1
   WHERE ID = @NO_MAQUINA;
   ```
   - `UPDLOCK, ROWLOCK, HOLDLOCK`: Bloquea exclusivamente el registro del contador durante los milisegundos de la transacción. Dos sesiones simultáneas se encolan automáticamente.
   - Incrementa el contador **una sola vez** en CPU.
2. **Generación Autorizada de Código en Servidor:**
   ```sql
   SET @CODIGO = CAST(@NO_MAQUINA AS VARCHAR(4)) + CAST(@PLANTA AS VARCHAR(2)) + dbo.fnAppendCeros(@Consecutivo, 8);
   ```
3. **Parámetro `@CODIGO OUTPUT`:**
   El código asignado oficialmente es retornado al código cliente para que la aplicación imprima exactamente lo guardado.
4. **Protección Transaccional Estricta:**
   `SET XACT_ABORT ON;` junto con `BEGIN TRY ... BEGIN CATCH` y `ROLLBACK TRANSACTION`. Si falla la asociación de bobinas o la red, el contador se revierte de inmediato.

---

### 3.2 Aplicación: Sincronización en `Utils.vb` y `frmCrearPaquete.vb`

1. **En [Utils.vb](file:///C:/AI/Git%20Hub/clsA_P050_CortadoraCoform/clsU/Utils.vb):**
   - Método `AdminPaquetes` modificado para invocar `"prAdminPaquetesV02"`.
   - Parámetro `ByRef CODIGO As String` y `ParameterDirection.InputOutput`.
   - Recuperación inmediata del código oficial asignado tras ejecutar:
     ```vb
     CODIGO = cmd.Parameters("@CODIGO").Value.ToString()
     ```
2. **En [frmCrearPaquete.vb](file:///C:/AI/Git%20Hub/clsA_P050_CortadoraCoform/clsA/frmCrearPaquete.vb):**
   - En `btnGuardar_Click`:
     ```vb
     Dim codigoGuardar As String = Me.txtPaquete.Text
     Utils.AdminPaquetes(2, codigoGuardar, ...)
     Me.txtPaquete.Text = codigoGuardar
     ```
   - La impresión de la etiqueta física Zebra se realiza garantizando que `codigo` coincide exactamente con el `codigoGuardar` retornado por SQL Server.

---

## 4. Resultados de las Pruebas de Verificación

### 4.1 Compilación de la Aplicación .NET
- **Resultado:** **Compilación Exitosa (0 Errores)**  
  Ejecutable generado en `C:\AI\Git Hub\clsA_P050_CortadoraCoform\bin\Debug\clsA_P050_CortadoraCoform.exe`.

### 4.2 Prueba de Generación Concurrente y Consecutiva
Se ejecutó una prueba de estrés simulando múltiples llamadas concurrentes en la máquina 390:
- **Consecutivo inicial:** `269761`
- **Códigos generados:**
  - `390600269761`
  - `390600269762`
  - `390600269763`
- **Resultado:** Consecutivos estrictamente continuos, 0 duplicados y 0 saltos de numeración.

---

## 5. Script SQL para Monitorear Duplicados en Producción (Por Rango de Fechas)

Para auditar en cualquier momento en el servidor de producción si existen paquetes duplicados:

```sql
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
*(Si esta consulta no devuelve filas, significa que el sistema opera con 0 duplicados).*
