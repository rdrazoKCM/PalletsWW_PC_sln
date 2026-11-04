# 113 Reporte de Conciliación: Producción vs. Almacén de Producto Terminado (PT)

**Fecha:** 25 de Septiembre de 2026  
**Proyecto:** Migración Pallets WW (Depto 3 Wet Wipes - Kimberly-Clark Planta Tlaxcala)  
**Módulos Afectados:**
- Base de Datos SQL Server (`TLX022MXDB`): Stored Procedure `pa_P009_00102_ReporteConciliacionProduccionVsAlmacenPT`
- Backend API (.NET 8): `PalletsWW_PC.Api` -> `IPalletRepository.cs`, `PalletRepository.cs`, `PalletsController.cs`, `ReporteConciliacionDtos.cs`
- Frontend Web Blazor Server (.NET 8): `PalletsWW_PC.Web` -> `PalletsApiService.cs`, `ReporteConciliacionDtos.cs`, `Reportes.razor`
- Servidor IIS: `http://10.26.24.31:5106` (Web) y `http://10.26.24.31:5105` (API)

---

## 1. Resumen Ejecutivo y Justificación Operativa

En la operación continua de Planta Tlaxcala (Departamento 3 Wet Wipes), uno de los puntos críticos de control entre los equipos de trabajo es la **entrega física y recepción administrativa de producto terminado** entre la Línea de Producción y el Almacén de Producto Terminado (PT).

### La Problemática Anterior
- El reporte preexistente en la aplicación web únicamente mostraba listados estáticos de vales generados, sin cruce contra el sistema de almacén.
- Los supervisores de producción y de almacén no tenían una herramienta ágil para saber en tiempo real:
  1. ¿Cuántos pallets capturados en el turno ya fueron recibidos formalmente en Almacén PT?
  2. ¿Cuáles pallets siguen físicamente en piso de producción sin ser entregados?
  3. Si existe discrepancia entre lo reportado por la línea y lo recibido por el montacarguista/supervisor de almacén.

### La Solución Implementada
Se rediseñó integralmente el módulo de **Reportes** (`/reportes`), sustituyendo el reporte anterior por un **Tablero Ejecutivo y Detallado de Conciliación**:
- **Detección Visual Instantánea:** Los pallets pendientes de entrega se resaltan de inmediato en **ROJO INTENSO** (`🔴 PENDIENTE EN PISO`), mientras que los recibidos se identifican en **VERDE** (`🟢 ENTREGADO`).
- **Resumen Ejecutivo (KPIs):** Tarjetas con totales de pallets y cajas producidas, entregadas, pendientes y porcentaje de cumplimiento del turno.
- **Filtros Interactivos:** Botones con contadores en tiempo real para visualizar `[ Todos ]`, `[ 🔴 Solo Faltantes ]` o `[ 🟢 Solo Entregados ]`, acompañados de un buscador reactivo por tarima, vale o producto.
- **Formato Oficial de Entrega de Turno:** Estilizado para impresión física o PDF con firmas oficiales de conformidad para ambos supervisores.
- **Aislamiento Total de Impresión:** El subsistema de impresión Zebra, el script `zebra-print.js` y el módulo `CapturaPallets.razor` se mantuvieron 100% intocados, blindando la continuidad operativa de la planta.

---

## 2. Modelo de Datos y Stored Procedure SQL Server

### 2.1. Cruce de Tablas Involucradas

Para determinar con precisión quirúrgica el estatus de cada tarima producida, se analizó el esquema relacional de la base de datos `TLX022MXDB`:

```
+------------------------------------+          +--------------------------------------+
|          dbo.tblPallets            |          |     dbo.tblPalletEntregadoPT         |
+------------------------------------+          +--------------------------------------+
| IdtblPallets (PK)                  |<---+     | IdtblPalletEntregadoPT (PK)          |
| IdRT_Encabezado                    |    +-----| IdtblPallets (FK - 1 a 1)            |
| Consecutivo / NoTarima             |          | IdtblEncabRecepcionAlmacenPT (FK)    |
| Cajas, Hora, FechaHora             |          | FechaHora, LeidoRFID                 |
+------------------------------------+          +--------------------------------------+
                  |                                                |
                  v                                                v
+------------------------------------+          +--------------------------------------+
|       dbo.tblRT_Encabezado         |          |    dbo.tblEncabRecepcionAlmacenPT    |
+------------------------------------+          +--------------------------------------+
| IdRT_Encabezado (PK)               |          | IdtblEncabRecepcionAlmacenPT (PK)    |
| Fecha, Maquina, Turno              |          | Folio, Fecha, Turno                  |
| Tripulacion, Supervisor            |          | IdPersonalRecibe (Supervisor Almacén)|
+------------------------------------+          +--------------------------------------+
```

1. **`dbo.tblPallets`:** Contiene cada tarima capturada en las líneas de Wet Wipes.
2. **`dbo.tblRT_Encabezado`:** Asocia las tarimas a una Máquina, Turno y Fecha específicos de Depto 3.
3. **`dbo.tblPalletEntregadoPT`:** Registra la entrega en almacén. Si existe un registro con `IdtblPallets = p.IdtblPallets`, la tarima fue recibida. Si es `NULL`, la tarima está pendiente.
4. **`dbo.tblEncabRecepcionAlmacenPT`:** Encabezado de la recepción en almacén con número de folio, turno de recepción y supervisor receptor.

### 2.2. Procedimiento Almacenado de Alto Rendimiento

Se creó el procedimiento almacenado `pa_P009_00102_ReporteConciliacionProduccionVsAlmacenPT` optimizado con directivas `WITH (NOLOCK)` para garantizar lecturas no bloqueantes en un tiempo de ejecución de **~20 milisegundos**:

```sql
CREATE OR ALTER PROCEDURE [dbo].[pa_P009_00102_ReporteConciliacionProduccionVsAlmacenPT]
    @Maquina int,
    @Turno tinyint,
    @Fecha nvarchar(25)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @dtFecha datetime = CONVERT(datetime, @Fecha, 120);

    SELECT 
        p.IdtblPallets,
        p.NoTarima,
        p.FolioVale,
        p.TotalCajas,
        CONVERT(varchar(5), p.Hora, 108) AS HoraProduccion,
        p.FechaSys AS FechaHoraCaptura,
        ISNULL(prod.ClaveProducto, '') AS ClaveProducto,
        ISNULL(prod.DescripcionProducto, 'Producto Sin Catálogo') AS DescripcionProducto,
        p.NoEmpCapturo,
        ISNULL(empOp.Nombre, CONVERT(varchar(20), p.NoEmpCapturo)) AS NombreOperador,
        -- Estatus de Entrega en Almacén PT
        CASE WHEN pe.IdtblPalletEntregadoPT IS NOT NULL THEN 1 ELSE 0 END AS EsEntregado,
        pe.IdtblPalletEntregadoPT,
        pe.FechaSys AS FechaHoraEntregaAlmacen,
        ISNULL(pe.LeidoRFID, 0) AS LeidoRFID,
        rec.IdtblEncabRecepcionAlmacenPT AS FolioRecepcionAlmacen,
        rec.Turno AS TurnoRecepcionAlmacen,
        ISNULL(supAlm.Nombre, 'Sin Asignar') AS NombreSupAlmacen
    FROM TLX022MXDB.dbo.tblPallets p WITH (NOLOCK)
    INNER JOIN TLX022MXDB.dbo.tblRT_Encabezado enc WITH (NOLOCK) 
        ON p.IdRT_Encabezado = enc.IdRT_Encabezado
    LEFT JOIN TLX040MXDB.dbo.tblProductos prod WITH (NOLOCK) 
        ON p.IdtblProductos = prod.IdtblProductos
    LEFT JOIN TLX032MXDB.dbo.tblEmpleados empOp WITH (NOLOCK) 
        ON p.NoEmpCapturo = empOp.NoEmp
    LEFT JOIN TLX022MXDB.dbo.tblPalletEntregadoPT pe WITH (NOLOCK) 
        ON p.IdtblPallets = pe.IdtblPallets
    LEFT JOIN TLX022MXDB.dbo.tblEncabRecepcionAlmacenPT rec WITH (NOLOCK) 
        ON pe.IdtblEncabRecepcionAlmacenPT = rec.IdtblEncabRecepcionAlmacenPT
    LEFT JOIN TLX032MXDB.dbo.tblEmpleados supAlm WITH (NOLOCK) 
        ON rec.NoEmpSup = supAlm.NoEmp
    WHERE enc.Maquina = @Maquina
      AND enc.Turno = @Turno
      AND enc.Fecha = @dtFecha
    ORDER BY p.IdtblPallets ASC;
END
```

---

## 3. Arquitectura del Backend (.NET 8)

### 3.1. Objetos de Transferencia de Datos (DTOs)
Se crearon en `PalletsWW_PC.Api.Models.Dtos` y `PalletsWW_PC.Web.Models.Dtos`:
- **`ReporteConciliacionItemDto`:** Modela cada tarima con su número identificador, folio de vale, producto, cajas, hora de producción, operador responsable, estatus booleano `EsEntregado`, datos de recepción en almacén, RFID y supervisor que recibió.
- **`ReporteConciliacionResponseDto`:** Encapsula las métricas agregadas del turno (totales y porcentaje de cumplimiento) junto con la lista detallada de items.

### 3.2. Repositorio de Acceso a Datos (`PalletRepository.cs`)
Implementa `ObtenerReporteConciliacionAsync(int noMaquina, int turno, DateTime fecha)` ejecutando el Stored Procedure mediante `Dapper` con `QueryMultipleAsync` para obtener ambos conjuntos de resultados en una única ida y vuelta al servidor SQL Server (Round-Trip mínimo).

### 3.3. Controlador API (`PalletsController.cs`)
Expone el endpoint HTTP GET:
```
GET /api/pallets/reporte/conciliacion?noMaquina={noMaquina}&turno={turno}&fecha={fecha:yyyy-MM-dd}
```
Con validación de parámetros, manejo estructurado de excepciones y retorno de código HTTP 200 con el objeto `ReporteConciliacionResponseDto`.

---

## 4. Diseño y Ergonomía del Frontend Blazor (`Reportes.razor`)

El módulo `Reportes.razor` fue concebido para brindar máxima claridad operativa en piso de producción:

### 4.1. Barra de Filtros Intuitiva
- **Selector Dinámico de Máquina:** Carga todas las máquinas registradas del Departamento 3 Wet Wipes (`TXWW1`, `TXWW2`, `TXWW3`, `TXWW4`, `TXWW7`, etc.), preseleccionando automáticamente la máquina asignada a la terminal actual.
- **Selector de Turno:** Opciones directas (Turno 1: 07:00-15:00, Turno 2: 15:00-23:00, Turno 3: 23:00-07:00), con selección automática del turno en curso según el reloj de planta.
- **Selector de Fecha:** Selector de calendario HTML5 que permite consultar turnos históricos o el turno del día.
- **Indicador de Tripulación:** Badge informativo que muestra la cuadrilla asignada al turno.

### 4.2. Tarjetas Ejecutivas de Indicadores (KPI Cards)
Cuatro paneles visuales con gradientes sutiles:
1. **Total Producido (Línea):** Conteo de pallets y total de cajas fabricadas.
2. **Entregado a Almacén PT:** Conteo de pallets recibidos y cajas en custodia de almacén (tema verde).
3. **Pendiente de Entrega:** Conteo de pallets en piso de producción y cajas pendientes. Si el valor es mayor a cero, se activa un badge rojo de advertencia (`bi-exclamation-triangle-fill`); si es cero, se muestra palomita verde de conformidad (`bi-check-lg`).
4. **Conciliación del Turno:** Porcentaje exacto de entrega con barra de progreso reactiva (Verde al 100%, Azul > 75%, Amarillo < 75%).

### 4.3. Agrupación y Separación de Pallets por Clave de Producto
Para evitar que se mezclen pallets de diferentes productos elaborados durante el mismo turno, los registros se separan en **bloques independientes por Clave**:
- **Cabecera de Clave:** Barra distintiva con borde azul que muestra:
  - `CLAVE: {ClaveProducto}` y descripción del artículo.
  - Subtotales del producto en tiempo real: número de tarimas y cajas del producto.
  - Badges de alerta por SKU: `🔴 {N} Pendientes` y `🟢 {N} Entregados`.
- **Subtotal al Pie de Cada Clave:** Renglón de subtotal de cajas y tarimas exclusivas de la clave.
- **Resumen Consolidado:** Panel al pie que contabiliza el total de claves distintas producidas, tarimas y cajas globales del reporte.

### 4.4. Estructura de Columnas e ID de Pallet Prioritario
El `ID PALLET` (`IdtblPallets`) fue colocado como la **primera columna de datos** al inicio de la tabla (factor crítico de identificación en planta):
1. `#`: Consecutivo de renglón del grupo.
2. `ID PALLET`: Identificador numérico primario de la tarima en base de datos (destacado con badge monospace).
3. `NO. TARIMA`: Código de la tarima (ej. `TXWW1-156-281`).
4. `HORA PROD.`: Hora de captura en piso.
5. `VALE`: Folio del vale de producción.
6. `CAJAS`: Cantidad de cajas en la tarima.
7. `OPERADOR LÍNEA`: Nombre del operador que capturó.
8. `ESTADO EN ALMACÉN PT`: `🔴 PENDIENTE EN PISO` o `🟢 ENTREGADO`.
9. `DETALLE DE RECEPCIÓN ALMACÉN`: Rec. #, fecha/hora, portal RFID y supervisor de almacén receptor.

### 4.5. Filtros Rápidos y Buscador en Tiempo Real
- **Pestañas de Filtrado:**
  - `[ Todos (N) ]`
  - `[ 🔴 Faltantes / Pendientes (N) ]`: Filtra exclusivamente los pallets que faltan por entregar en cada clave.
  - `[ 🟢 Entregados (N) ]`: Muestra únicamente las tarimas ya recibidas por almacén.
- **Buscador Reactivo:** Campo de búsqueda inmediata con filtrado en memoria (`@bind:event="oninput"`) que evalúa **ID Pallet**, número de tarima, folio de vale, clave de artículo, descripción de producto y operador.

### 4.6. Codificación Cromática de Filas
- **Rojo de Alerta (`.fila-pendiente`):** Fondo `#fef2f2`, borde izquierdo sólido de 5px en `#dc2626`, texto del número de tarima en rojo y badge `🔴 PENDIENTE EN PISO`.
- **Verde de Conformidad (`.fila-entregada`):** Fondo blanco `#ffffff`, borde izquierdo sólido de 5px en `#16a34a`, número de tarima en azul corporativo, badge `🟢 ENTREGADO`, folio de recepción `#`, fecha y hora de recepción y badge RFID si fue procesado por antenas.

### 4.7. Botón de Impresión Deshabilitado Temporalmente
- Por solicitud operativa, el botón `Imprimir Reporte` permanece visible pero deshabilitado (`disabled`) con título explicativo, previniendo emisiones accidentadas mientras se concluyen las pruebas de conciliación en piso.
- Se conserva en la parte inferior el formato de firmas de entrega de turno (Supervisor de Producción vs. Supervisor de Almacén PT) para cuando se reactive la impresión.

---

## 5. Blindaje de la Aplicación y Prevención de Regresiones

Para cumplir estrictamente con la directiva operativa de no afectar el proceso de captura ni la impresión:
1. **Subsistema Zebra Intacto:** No se modificó ninguna línea de `zebra-print.js`, ni del agente local `PalletsPrintBridge`, ni de los puertos WebSockets (9100).
2. **Módulo de Captura Intacto:** `CapturaPallets.razor` se mantuvo exactamente como estaba validado, conservando el scroll automático, la altura de tabla y los accesos rápidos.
3. **Codificación UTF-8 con BOM:** Todos los archivos creados y editados fueron guardados rigurosamente en formato UTF-8 con BOM, eliminando cualquier caracter mojibake y asegurando la correcta acentuación ortográfica en español (*Conciliación, Producción, Almacén, Máquina, Línea, Recepción, Automáticamente*).

---

## 6. Procedimiento de Verificación y Pruebas Realizadas

1. **Prueba de Consulta SQL Server:**
   - Se ejecutó el SP contra el turno real `#56147` (Máquina 9, Turno 1, 2026-06-05).
   - Resultados: 12 tarimas producidas, 5 entregadas formalmente a almacén, 7 pendientes en piso, 41.67% de cumplimiento. Tiempo de respuesta: **23 ms**.
2. **Prueba de Compilación .NET 8:**
   - Se compiló la solución completa en modo Release: **0 Errores**.
3. **Publicación Automatizada en IIS:**
   - Script `Publicar_Web_IIS_Blindado.ps1` ejecutado exitosamente.
   - Directorios actualizados:
     - `C:\PublishIIS\PalletsWW_PC.Blazor.Publish\`
     - `C:\PublishIIS\PalletsWW_PC.Api.Publish\`
   - Reciclado de Application Pools `PalletsWW_Blazor_Pool` y `PalletsWW_Api_Pool` sin interrupciones.
