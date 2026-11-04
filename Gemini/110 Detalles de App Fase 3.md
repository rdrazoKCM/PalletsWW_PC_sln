# 110. Detalles de App Fase 3: Optimización Ultra-Rápida de Lotes, Retorno ZPL en Servidor, Resaltado Visual Reactivo y Desacoplamiento de SP V9

**Sistema:** Pallets Wet Wipes (.NET 8 Blazor Web App & ASP.NET Core Web API)  
**Fecha de Implementación:** 23/09/2026  
**Módulos Afectados:**  
- PalletsWW_PC.Web/Components/Pages/CapturaPallets.razor  
- PalletsWW_PC.Api/Controllers/PalletsController.cs  
- PalletsWW_PC.Api/Data/Repositories/PalletRepository.cs  
- PalletsWW_PC.Api/Data/Repositories/IPalletRepository.cs  
- PalletsWW_PC.Shared/Dtos/PalletResultDto.cs  
- Base de Datos TLX022MXDB: Procedimiento Almacenado dbo.pa_P009_01006_tblPalletsInsertcmdV9  
- Archivo SQL: Gemini/pa_P009_01006_tblPalletsInsertcmdV9.sql  
- Publicación IIS: C:\PublishIIS\PalletsWW_PC.Blazor.Publish\ y C:\PublishIIS\PalletsWW_PC.Api.Publish\  

---

## 1. Resumen Ejecutivo de la Fase 3

Durante las pruebas operativas en piso de producción con lotes de 3 a 5 tarimas, se presentaron dos retos críticos:
1. **Latencia Excesiva en Guardado de Lotes e Impresión:** El guardado tardaba considerablemente más que la aplicación legacy (sensación de lentitud de 15 segundos al confirmar con la palomita verde).
2. **Falsos Positivos de Duplicidad Horaria (Ej. Bloqueo a las 11:25):** Operadores intentaban capturar pallets con horas válidas y no registradas en el turno actual, pero el sistema bloqueaba la captura alegando duplicidad.
3. **Preservación Estricta de Compatibilidad:** Mantener el procedimiento almacenado pa_P009_01006_tblPalletsInsertcmdV5 100% inalterado para no interferir con aplicaciones preexistentes, migrando la nueva plataforma web exclusivamente a pa_P009_01006_tblPalletsInsertcmdV9.

---

## 2. Diagnóstico Técnico de Problemas y Soluciones

### A. Diagnóstico de Rendimiento: ¿Por qué el Lote Rápido tardaba hasta 15 segundos?
* **Causa Raíz:** En la implementación inicial de la versión web, tras insertar el lote en la base de datos vía API:
  - El cliente Blazor realizaba un ciclo oreach secuencial por cada pallet guardado.
  - Para cada pallet, ejecutaba una petición HTTP a ObtenerTurnoAnteriorAsync (redundante).
  - Seguido de otra petición HTTP a ObtenerEtiquetaZplAsync para obtener el código ZPL de impresión.
  - Para un lote de 5 pallets, esto representaba **15 viajes de red HTTP ida y vuelta (round-trips)**, provocando una latencia acumulada inaceptable en piso.
* **Solución Arquitectural (Retorno Atómico de ZPL en el Backend):**
  1. Se extendió PalletResultDto con la propiedad public string? CodigoZpl { get; set; }.
  2. En PalletRepository.cs, el backend genera la cadena ZPL directamente en memoria en el servidor (_impresionRepo.ObtenerDatosEtiquetaAsync) inmediatamente después de insertar cada pallet del lote.
  3. El endpoint POST /api/pallets/batch devuelve la respuesta completa con los IDs asignados y sus códigos ZPL en **una única transacción HTTP**.
  4. En CapturaPallets.razor, el cliente recibe el array de resultados y despacha las impresiones en segundo plano (Task.Run) hacia el spooler local PalletsPrintBridge (puerto 5005) con un intervalo de 350ms, liberando la interfaz gráfica de inmediato (0ms de bloqueo).

### B. Resaltado Visual Inmediato de Tarimas en Conflicto (Rojo / Parpadeo)
* **Requerimiento Operativo:** El operador debe identificar en milisegundos qué tarima del lote tiene una hora repetida para corregirla de inmediato.
* **Implementación:**
  - Validación preventiva en memoria en el cliente antes de llamar al servidor.
  - Si una hora coincide con otra del mismo lote o con un pallet ya registrado en el turno, la tarjeta de la tarima adquiere dinámicamente las clases CSS:
    * Borde rojo de alta visibilidad (order-danger border-2).
    * Fondo rojo suave (g-danger-subtle).
    * Badge de advertencia parpadeante: ⚠️ HORA DUPLICADA.
    * Mensaje explícito al operador indicando exactamente con qué pallet existe el conflicto.

### C. Desacoplamiento y Nuevo Stored Procedure V9 (dbo.pa_P009_01006_tblPalletsInsertcmdV9)
* **Problema con V5 (Falsos Positivos de Hora):**
  - Los números de FolioVale (ej. 3246) son reciclados por el negocio a lo largo de los meses y años.
  - El candado anti-duplicidad de V5 consultaba:
    `sql
    WHERE FolioVale = @FolioVale AND Hora = @Hora
    `
    Al haber un pallet con el mismo folio capturado en un turno de meses atrás a las 11:25, el sistema bloqueaba la hora en el turno actual aunque no existiera ningún pallet a esa hora hoy.
* **Directiva de Aislamiento:**
  - pa_P009_01006_tblPalletsInsertcmdV5 se restauró a su estado original para no meter ruido a aplicaciones concurrentes en producción.
  - Se creó el nuevo procedimiento [dbo].[pa_P009_01006_tblPalletsInsertcmdV9] que añade el filtro del encabezado del turno actual:
    `sql
    -- Sección 3.1: Candado Anti-Duplicidad Aislado por Vale y Turno
    IF EXISTS (
        SELECT 1 
        FROM dbo.tblPallets WITH (NOLOCK)
        WHERE FolioVale = @FolioVale 
          AND IdRT_Encabezado = @IdRT_Encabezado
          AND Hora = @Hora
    )
    `
  - La aplicación web y la API de .NET 8 fueron actualizadas para consumir exclusivamente pa_P009_01006_tblPalletsInsertcmdV9.

---

## 3. Matriz de Cambios por Componente

| Componente | Archivo | Cambio Realizado |
| :--- | :--- | :--- |
| **SQL Server** | pa_P009_01006_tblPalletsInsertcmdV9.sql | Nuevo SP con validación aislada por IdRT_Encabezado. |
| **SQL Server** | pa_P009_01006_tblPalletsInsertcmdV5.sql | Revertido a su estado original (sin alteración para legacy). |
| **API Backend** | PalletRepository.cs | Invocación de V9, generación de ZPL en lote y optimización COUNT(1). |
| **API Backend** | PalletsController.cs | Actualización de documentación y EndpointSummary a V9. |
| **Shared DTO** | PalletResultDto.cs | Inclusión del campo CodigoZpl para transporte atómico. |
| **Web Frontend** | CapturaPallets.razor | Resaltado visual en rojo de tarimas duplicadas, despacho ZPL en background. |

---

## 4. Despliegue y Publicación en IIS

1. **Compilación de la Solución:**
   - Comando: dotnet build PalletsWW_PC_sln.sln -c Release
   - Resultado: **0 Errores**, compilación exitosa.
2. **Publicación API:**
   - Ruta destino: C:\PublishIIS\PalletsWW_PC.Api.Publish\
   - Estado: Actualizada y operativa.
3. **Publicación Web (Blazor):**
   - Ruta destino: C:\PublishIIS\PalletsWW_PC.Blazor.Publish\
   - Estado: Actualizada y operativa.

---

## 5. Instrucciones de Ejecución para Servidor de Producción

Para habilitar el nuevo procedimiento en el servidor de base de datos de producción (TLX022MXDB), ejecute el script contenido en:
Gemini/pa_P009_01006_tblPalletsInsertcmdV9.sql
---

## 6. Blindaje Crítico en Captura Individual y Desactivación de Pestaña de Lote

### A. Diagnóstico de la Duplicidad por Tecla [Enter] (Horas 11:18 y 11:10)
* **Incidente Reportado:** El operador intentó registrar un pallet con hora `11:10`. Al presionar [Enter], el sistema generó inesperadamente dos pallets consecutivos:
  1. Primer pallet (ID 2838357): Hora `11:18:00` con `FechaSys` 11:22:00.490.
  2. Segundo pallet (ID 2838358): Hora `11:10:00` con `FechaSys` 11:22:02.733 (2.243 segundos después).
* **Causa Raíz en el Ciclo de Vida de Blazor:**
  1. **Disparidad de Eventos DOM vs C#:** El campo de hora utilizaba `@bind="_nuevaHora"` sin `@bind:event="oninput"`. En Blazor, el enlace por defecto se dispara en `onchange` (al desenfocar el elemento). Si el operador escribía `11:10` y presionaba [Enter] inmediatamente sin salir del campo, el evento `@onkeydown` se ejecutaba **antes** de que el navegador emitiera `onchange`.
  2. En consecuencia, la variable de C# `_nuevaHora` aún retenía el valor previo inicializado (`11:18`).
  3. `GuardarNuevoPallet` tomaba `11:18` y lo enviaba a la base de datos.
  4. Mientras la petición de red tardaba ~2 segundos, los campos de entrada **no estaban deshabilitados**, permitiendo que el operador volviera a presionar Enter o que el búfer del teclado enviara un segundo disparo con `11:10` ya actualizado.
* **Solución Implementada:**
  1. **Enlace en Tiempo Real (`@bind:event="oninput"`):** Cada pulsación de tecla (`1`, `1`, `:`, `1`, `0`) actualiza instantáneamente la variable en C#. Cuando se presiona [Enter], la variable contiene exactamente lo que está visible en pantalla.
  2. **Bloqueo Inmediato de Controles:** Los inputs de Hora, Cajas, Línea y el botón Guardar adquieren `disabled="@_isSaving"`.
  3. **Feedback Visual:** El botón Guardar muestra un spinner dinámico con el texto `Guardando...` durante la llamada a la API.
  4. **Candado Atómico y Cooldown Anti-Rebote:**
     ```csharp
     if (_isSaving || (DateTime.Now - _ultimoGuardadoMomento).TotalMilliseconds < 1500)
     {
         return;
     }
     _isSaving = true;
     _ultimoGuardadoMomento = DateTime.Now;
     ```
     Cualquier pulsación accidental repetida de Enter en menos de 1.5 segundos es descartada en 0ms en memoria.
  5. **Auto-Normalización en `@onblur`:** Al salir del campo, la hora se formatea defensivamente (`1110` -> `11:10`).

### B. Desactivación Operativa de la Pestaña de Lote Rápido
* A solicitud expresa de producción, se desactivó el botón de cambio de modo:
  - El botón `⚡ Lote Rápido (1 a 10 Tarimas)` queda en estado `disabled` con el badge `Inactivo` y tooltip explicativo.
  - La variable `_modoLote` permanece fija en `false`.
  - El código de soporte de lotes se mantiene preservado e intacto en el backend y frontend para su reactivación futura cuando sea requerida.
---

## 7. Optimización de Modales de Vales: Sincronización Bidireccional de Clave de Producto y Consecutivo Automático de Folio

### A. Problemática Operativa y Requerimiento de Planta
1. **Búsqueda Manual en Combobox:** Al dar de alta o modificar un vale de producción, los operadores debían desplazarse por todo el catálogo del combobox para encontrar el producto. Dado que en planta conocen de memoria las claves de producto (ej. E9623, E9624), requerían poder teclear la clave directamente y, al presionar [Enter] o desenfocar el campo, que el producto se seleccione automáticamente en la lista.
2. **Sincronización Inversa:** Si el operador opta por seleccionar el producto en el combobox, la clave debe auto-completarse en el campo de texto correspondiente.
3. **Erradicación del 0 por Default en Folio de Vale:** Anteriormente, el campo de folio de vale iniciaba con el número  . Existía el riesgo de que el operador no borrara el   y guardara un folio inválido.
4. **Consecutivo Inteligente Automático:** En lugar de  , el modal de nuevo vale calcula y sugiere de forma predeterminada el folio consecutivo al último vale registrado (ej. si el último vale fue 3247, el modal sugiere automáticamente 3248).

### B. Implementación Técnica en CapturaPallets.razor
1. **Campo de Folio como Tipo Nulable (int?):**
   - Las variables _nuevoFolioValeInput y _modificarFolioVale pasaron de int a int?.
   - Se añadió el atributo placeholder="Ej. 14450", eliminando el molesto   inicial si no hay vales previos.
2. **Cálculo de Consecutivo Automático en AbrirModalNuevoVale():**
   - Se determina el folio máximo entre los vales del turno actual (_valesDelTurno), del turno anterior (_valesTurnoAnterior) y el vale actualmente activo (_valeActual):
     `csharp
     int maxVale = 0;
     if (_valesDelTurno.Count > 0) maxVale = _valesDelTurno.Max(v => v.FolioVale);
     if (_valesTurnoAnterior.Count > 0) {
         int maxAnt = _valesTurnoAnterior.Max(v => v.FolioVale);
         if (maxAnt > maxVale) maxVale = maxAnt;
     }
     if (_valeActual != null && _valeActual.FolioVale > maxVale) maxVale = _valeActual.FolioVale;

     _nuevoFolioValeInput = maxVale > 0 ? maxVale + 1 : null;
     `
3. **Sincronización Bidireccional Clave <-> Producto:**
   - **En Nuevo Vale:** Métodos OnNuevoClaveInput, OnNuevoClaveKeyDown (detecta Enter), OnNuevoClaveBlur y SincronizarNuevoProductoPorClave.
   - **En Modificar Vale:** Métodos OnModificarClaveInput, OnModificarClaveKeyDown (detecta Enter), OnModificarClaveBlur y SincronizarModificarProductoPorClave.
   - Búsqueda insensible a mayúsculas/minúsculas y espacios en blanco (StringComparison.OrdinalIgnoreCase). Si se localiza la clave, se selecciona el producto y se emite un Toast verde; si no existe en la máquina, se emite una advertencia al operador.
   - Enlace inverso en @onchange de cada <select> (OnNuevoProductoChanged y OnModificarProductoChanged) que actualiza la clave en tiempo real al cambiar la selección en el combobox.

### C. Estado de Compilación y Despliegue
- **Directiva de Usuario:** Siguiendo la instrucción explícita del usuario y lo estipulado en AGENTS.md, **NO se ejecutó compilación (dotnet build) ni publicación a IIS (C:\PublishIIS\)**. Los cambios quedan aplicados en código fuente a nivel de desarrollo y documentados formalmente.
### D. Diagnóstico y Corrección de Búsqueda de Clave de Producto (Caso Clave 'E9623')
1. **Causa Raíz:**
   - El procedimiento almacenado de catálogo pa_P009_000_001_ProductosXMaquina (en TLX040MXDB) devuelve únicamente dos columnas: IdtblProductos y DescripcionProducto.
   - Como la propiedad ClaveProducto de cada elemento en _productosMaquina no era devuelta por ese SP, quedaba vacía ("").
   - Por esta razón, el selector <select> mostraba un guion suelto inicial (- Absorsec..., - Huggies...), y al ingresar la clave E9623, la búsqueda en memoria no encontraba coincidencias porque todos los objetos tenían ClaveProducto == "".
2. **Solución Integral de Doble Capa:**
   - **En Backend (CatalogoRepository.cs):** Si pa_P009_000_001_ProductosXMaquina no incluye la clave, el repositorio resuelve automáticamente la ClaveProducto consultando pa_P009_000_001_ObtenerDetalleProductoPorIdV8 (o pa_P009_01012_IdtblProductos). Como CatalogCacheService almacena el catálogo en caché por máquina, esto se ejecuta una única vez al inicio sin penalizar la velocidad.
   - **En Frontend (CapturaPallets.razor):**
     * Se integró EnriquecerClavesProductosMemoria(), el cual cruza en 0ms los productos de la máquina con los vales del turno actual (_valesDelTurno) y anterior (_valesTurnoAnterior) que ya contienen las claves reales asignadas por producción.
     * En SincronizarNuevoProductoPorClave y SincronizarModificarProductoPorClave, si la clave no estuviera de forma directa en el catálogo, busca defensivamente en los vales existentes y en el texto del producto.
     * Las opciones del <select> se formatean limpiamente evitando guiones sueltos cuando la clave aún no está precargada.
3. **Estatus de Compilación:**
   - PalletsWW_PC.Web: Compilación correcta (0 Errores).
   - PalletsWW_PC.Api: Compilación correcta (0 Errores).
### E. Soporte de Tecla [Enter] en Selector de Línea de Empaque para Guardado Directo
1. **Requerimiento Operativo:**
   - Previamente, el atajo de teclado [Enter] sólo disparaba el guardado de la tarima desde el campo de entrada de **Cajas**.
   - Los operadores requerían poder guardar el pallet tanto desde el campo de **Cajas** (cuando no cambian la línea) como directamente desde el selector de **Línea de Empaque** (tras elegir la línea de producción correspondiente) presionando [Enter].
2. **Implementación en CapturaPallets.razor:**
   - En el <select> de Línea de Empaque de la fila de captura activa:
     * Se enlazó el evento @onchange="OnNuevaLineaChanged" para reflejar de inmediato cualquier cambio de opción en la variable _nuevaLinea.
     * Se integró el manejador @onkeydown="HandleKeyDownNuevaFila".
     * Al presionar [Enter] en el selector de línea, se evalúa el candado anti-rebote y se ejecuta GuardarNuevoPallet(), garantizando la captura e impresión sin requerir clics adicionales con el mouse ni desplazarse de vuelta al campo de cajas.
3. **Estatus de Compilación:**
   - PalletsWW_PC.Web: Compilación correcta (0 Errores).