# 010 - Pallets WW: Error al Modificar Pallet - Plan de Implementación y Análisis Forense de Lote de Exportación

**Proyecto:** clsA_P035_PallestWipes  
**Base de Datos:** TLX022MXDB  
**Servidor:** MXTLAS02 (Desarrollo: DESKTOP-GNLGUOC)  
**Fecha:** 17 de Septiembre de 2026  
**Documentos Relacionados:**  
- [006 Cambios en Pallets WW V3.md](file:///c:/AI/Git%20Hub/PROY052_PalletsPanal/Gemini/006%20Cambios%20en%20Pallets%20WW%20V3.md)  
- [010_Despliegue_Produccion_Pallets_WW_Master_V5.sql](file:///c:/AI/Git%20Hub/PROY052_PalletsPanal/Gemini/010_Despliegue_Produccion_Pallets_WW_Master_V5.sql)  
- [pa_P009_01006_tblPalletsInsertcmdV5.sql](file:///c:/AI/Git%20Hub/PROY052_PalletsPanal/Gemini/pa_P009_01006_tblPalletsInsertcmdV5.sql)  
- [pa_P009_01008_tblPalletsUpdatecmdV5.sql](file:///c:/AI/Git%20Hub/PROY052_PalletsPanal/Gemini/pa_P009_01008_tblPalletsUpdatecmdV5.sql)  

---

## 1. Resumen Ejecutivo de la Incidencia

Al realizar una modificación en una fila del DataGridView de producción en la aplicación `clsA_P035_PallestWipes` (por ejemplo, corregir la hora o el conteo de cajas de un pallet existente):

- **Evidencia en Imagen 1 (Antes de la modificación):**
  - **Máquina:** `TXWW7` (Máquina ID 70 en `TLX009MXDB.dbo.tblMaquinas`)
  - **Turno:** 1 - Tripulación A
  - **Vale:** 3181 | **Clave:** `E9378` | **Producto:** `HUG SMPLY CLN FF SFT PK RC 704` (Producto de Exportación)
  - **Fila 22 en Grid:**
    - Tarima: `TXWW7-260-480`
    - Lote: **`TL626007X`** (Lote original correcto, terminado en `07X` por ser máquina 7)
    - ID Pallet: `2813008`
    - El operador edita la hora de `08:40` a `08:46`.

- **Evidencia en Imagen 2 (Después de guardar):**
  - La fila 22 guardó la hora `08:46:00`.
  - **El lote se alteró automáticamente a `TL626002X`**.
  - Todas las demás filas de esa misma máquina (`TXWW7`) conservan el lote correcto **`TL626007X`**.
  - Los operadores manifestaron que esta alteración ocurre **continuamente** cada vez que modifican un dato en la app y **únicamente pasa con producto de Exportación**.

---

## 2. Hallazgos Forenses y Causa Raíz en SQL Server

Se auditó el código de los Stored Procedures de actualización e inserción:

### A. Anatomía del Lote en Wipes
El número de lote se compone según el destino comercial del producto:
1. **Mercado Nacional (`Exportacion = 0` o `'False'`):**
   - Estructura: `TL + [Último dígito del Año] + [Día Juliano 3 dígitos] + [Línea de Empaque] + [Turno]`
   - Ejemplo: `TL` + `6` + `260` + `11` + `A` = `TL626011A`
   - Depende de la línea y turno ingresados.

2. **Mercado de Exportación (`Exportacion = 1` o `'True'`):**
   - Estructura: `TL + [Último dígito del Año] + [Día Juliano 3 dígitos] + [Subfijo de Máquina]`
   - El **Subfijo de Máquina** identifica físicamente en qué máquina de Toallitas Húmedas se procesó el producto:

| NoMaquina | NombreMaquina | Subfijo de Exportación | Ejemplo de Lote |
|:---------:|:-------------:|:----------------------:|:---------------:|
| 9         | TXWW1         | 01X                    | TL626001X       |
| 16        | TXWW2         | 02X                    | TL626002X       |
| 53        | TXWW3         | 03X                    | TL626003X       |
| 54        | TXWW4         | 04X                    | TL626004X       |
| 55        | TXWW5         | 05X                    | TL626005X       |
| 67        | TXWW6         | 06X                    | TL626006X       |
| 70        | TXWW7         | 07X                    | TL626007X       |

### B. El Defecto en el Stored Procedure de Actualización Original
En el procedimiento de actualización anterior:
1. **No se consultaba la máquina del encabezado:** La variable `@NoMaquina` nunca se leía de `dbo.tblRT_Encabezado`.
2. **El subfijo estaba fijo (hardcodeado) como `'02X'` para cualquier producto de exportación:**
   ```sql
   -- CÓDIGO CON ERROR EN VERSIONES ANTERIORES:
   IF @Exportacion = 1 OR @Exportacion = 'True'
   BEGIN
       SET @NoLote = 'TL' + CONVERT(nvarchar(1), RIGHT(@Anio, 1)) + @DiaJuliano + '02X';
   END
   ```
3. **Consecuencia directa:** Cualquier modificación (hora, total de cajas, etc.) ejecutada en máquinas TXWW1 (`01X`), TXWW3 (`03X`), TXWW4 (`04X`), TXWW5 (`05X`), TXWW6 (`06X`) o TXWW7 (`07X`) sobre un producto de exportación sobrescribía el lote forzándolo a terminar en `02X`.

---

## 3. Estrategia de Versionamiento a Procedimientos "V5"

Para no generar interferencias ni ruido en otras aplicaciones o reportes que pudieran consumir los procedimientos anteriores, se acordó crear procedimientos nuevos con sufijo **`V5`**:

1. **Procedimiento de Inserción:**
   - **Nombre:** `dbo.pa_P009_01006_tblPalletsInsertcmdV5`
   - **Mejoras integradas:** Bloqueo atómico `UPDLOCK, HOLDLOCK`, captura inmediata de `SCOPE_IDENTITY()`, retorno dual de `IdtblPallets` y mapeo dinámico de subfijo de exportación (`01X` a `07X`).
2. **Procedimiento de Modificación:**
   - **Nombre:** `dbo.pa_P009_01008_tblPalletsUpdatecmdV5`
   - **Mejoras integradas:** Consulta dinámica de `@NoMaquina` desde `tblRT_Encabezado`, cálculo del subfijo `01X` a `07X`, transaccionalidad atómica (`BEGIN TRAN / XACT_ABORT / TRY CATCH`), bloqueo de fila `WITH (ROWLOCK)`, 4 parámetros exactos y sincronización de cajas en `tblRT_Produccion`.

---

## 4. Cambios Realizados en Visual Studio (VB.NET)

En el proyecto `C:\AI\Git Hub\clsA_P035_PallestWipes`:

1. **En `clsD\clsD_0001_tblPallets.vb` (Método `sInicdgv1datos1`):**
   - Se actualizó el `sInsertCommand` para apuntar a: `"pa_P009_01006_tblPalletsInsertcmdV5"`.
   - Se actualizó el `sUpdateCommand` para apuntar a: `"pa_P009_01008_tblPalletsUpdatecmdV5"`.
   - Se preservaron intactos los métodos de parámetros `sIPrmsdgv1datos1` y `sUPrmsdgv1datos1` (4 parámetros para Update).
2. **Telemetría y Registro de Operaciones:**
   - En `clsD_0001_tblPallets.vb`, la modificación de filas en el DataGridView registra en `tblLog_PalletsWipes` con `TipoOperacion = 'MODIFICACION'`.
   - Se eliminó la reimpresión duplicada de etiquetas al modificar pallets existentes (evitando gasto innecesario de consumibles y confusiones en línea).
3. **Reimpresión y Ortografía en `clsF_001_frm_001_Pallets.vb`:**
   - Se corrigieron todas las cadenas con caracteres especiales y acentos españoles.
   - El botón de reimpresión registra en `tblLog_PalletsWipes` con `TipoOperacion = 'REIMPRESION'`.
4. **Compilación de la Solución:**
   - Se reconstruyó en modo Release con MSBuild de Visual Studio.
   - **Resultado:** 0 Errores, ejecutable generado en `clsA_P035_PallestWipes\bin\Release\clsA_P035_PallestWipes.exe`.

---

## 5. Script Maestro de Despliegue en Producción

Se consolidó un único archivo SQL maestro para producción en `MXTLAS02` (`TLX022MXDB`):

- **Ruta del Script:** `010_Despliegue_Produccion_Pallets_WW_Master_V5.sql`
- **Contenido:**
  1. Creación/actualización de `tblLog_PalletsWipes`.
  2. Índices de rendimiento para logs.
  3. Stored Procedure `pa_P009_01006_tblLogPalletsWipesInsert`.
  4. Stored Procedure `pa_P009_01006_tblPalletsInsertcmdV5`.
  5. Stored Procedure `pa_P009_01008_tblPalletsUpdatecmdV5`.
  6. Reparación automática del pallet `2813008` (regresado de `TL626002X` a `TL626007X`).
  7. Bloque de verificación post-despliegue de objetos y parámetros.

---

## 6. Pruebas y Validación Realizadas

1. **Creación de SPs en Base de Datos Local (`DESKTOP-GNLGUOC`):**
   - Ambos procedimientos `V5` se compilaron exitosamente.
2. **Prueba Transaccional Simulada:**
   - Se insertó un pallet de prueba en la máquina 70 (`TXWW7`) con un producto de exportación (`TL626007X`).
   - Se ejecutó `pa_P009_01008_tblPalletsUpdatecmdV5` modificando la hora a `08:46:00`.
   - **Resultado verificado:** El lote se mantuvo como `TL626007X` (`EXITO_V5`).
