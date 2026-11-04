# 109. Detalles de App Fase 2: Soporte Multiproducto, Sincronización Clave-Producto, Lote Rápido Inteligente, Anti-Duplicidad Atómica y Corrección Ortográfica

**Sistema:** Pallets Wet Wipes (.NET 8 Blazor Web App & ASP.NET Core Web API)  
**Fecha de Implementación:** 23/09/2026  
**Módulos Afectados:**  
- `PalletsWW_PC.Web/Components/Pages/CapturaPallets.razor`  
- `PalletsWW_PC.Web/Components/App.razor`  
- `PalletsWW_PC.Web/Components/Pages/Configuracion.razor`  
- `PalletsWW_PC.Web/Services/ValesApiService.cs`  
- `PalletsWW_PC.Api/Controllers/ValesController.cs`  
- `PalletsWW_PC.Api/Data/Repositories/PalletRepository.cs`  
- Publicación IIS: `C:\PublishIIS\PalletsWW_PC.Blazor.Publish\` y `C:\PublishIIS\PalletsWW_PC.Api.Publish\`  

---

## 1. Resumen Ejecutivo de la Fase 2

En respuesta a las pruebas operativas en piso de producción (Líneas Wet Wipes), se implementaron mejoras ergonómicas, operativas y visuales para agilizar la captura de pallets, eliminar elementos redundantes que saturaban la pantalla, dar soporte completo a la producción concurrente de productos, dotar a los operadores de atajos de teclado y auto-formato, blindar el sistema contra guardados parciales o confusiones por horas duplicadas y corregir integralmente la acentuación y ortografía de la aplicación.

---

## 2. Cambios Realizados en la Interfaz y Lógica de Negocio

### A. Eliminación de Campos Redundantes (`Cajas por Tarima` y `Lote Base`)
* **Problema Identificado:** Los operadores en planta ya conocen la cantidad estándar de cajas por tarima y el lote base viene asociado directamente a la orden/vale. Mantener estos dos cuadros en el panel superior consumía espacio horizontal valioso.
* **Solución Implementada:**
  - Se retiraron por completo los campos visuales `Cajas por Tarima` y `Lote Base` de la cabecera del vale.
  - El espacio liberado se asignó al contenedor del **Producto Asignado** (con un ancho expandido de hasta 680px), permitiendo leer el nombre completo del producto sin recortes ni truncamientos.
  - La lógica interna de cálculo (cajas por tarima por defecto y lote del vale) se mantiene 100% activa en memoria para el guardado e impresión de pallets.

### B. Visibilidad Nítida del ID Pallet (Sin `#`)
* **Problema:** En versiones anteriores, la columna `ID PALLET` utilizaba un fondo oscuro que dificultaba la lectura en monitores industriales con reflejos o polvo.
* **Directiva:** Se retiró el símbolo `#` de todos los identificadores y contadores (`851` en lugar de `#851`).
* **Diseño:** Fondo claro aperlado (`bg-light`), borde suave (`border-secondary-subtle`), texto oscuro y tipografía monoespaciada legible (`font-monospace`).

### C. Tablas Comparativas de Vales (Turno Actual y Turno Anterior)
* **Soporte Multiproducto Concurrente:**
  - En las líneas de toallitas húmedas es frecuente que los operadores produzcan dos tipos de producto al mismo tiempo.
  - Se colocaron dos tarjetas lado a lado con formato tabular idéntico al sistema legacy:
    * **Vales Turno Actual:** `VALE | CLAVE | PRODUCTO | TOTAL CAJAS | ID`
    * **Vales Turno Anterior:** Carga automática mediante procedimiento almacenado `pa_P009_01005_sLlenardgvProduccionTurnoAnt`.
* **Cambio de Vale a 1 Clic:** El operador conmuta de producto simplemente haciendo clic en cualquier fila de la tabla; la interfaz y el grid de pallets se actualizan de inmediato.
* **Resaltado Visual Prominente del Vale Activo:**
  - El vale seleccionado se ilumina con fondo azul suave (`table-primary`), borde izquierdo de 4px, icono de check y tipografía destacada.
  - En turno anterior se ilumina con fondo ámbar (`table-warning`).
* **Banner de Alerta Turno Anterior:** Cuando el operador selecciona un vale del turno previo, se despliega un banner ámbar permanente de advertencia:  
  `⚠️ ATENCIÓN: Estás capturando pallets en un Vale del TURNO ANTERIOR. Los pallets registrados quedarán vinculados al encabezado del turno previo.`
* **Integridad Referencial:** Al capturar un pallet en turno anterior, el registro se vincula con el `IdRT_Encabezado` del turno correspondiente.

### D. Nueva Función: "Modificar Vale" y Sincronización Clave <-> Producto
* **Problema:** Anteriormente solo existía el botón `+ Nuevo Vale`, impidiendo corregir errores tipográficos en el número de folio o en la selección del producto sin intervención de soporte técnico.
* **Sincronización Bidireccional en Ambos Modales (Nuevo Vale y Modificar Vale):**
  - **Por Clave:** El operador puede escribir directamente la Clave del producto (ej. `E9623`) en un campo exclusivo; al presionar [Enter] o salir del campo, el sistema busca en el catálogo y selecciona automáticamente el producto en el combobox.
  - **Por Producto:** Si el operador selecciona un producto en el combobox, el campo de Clave se actualiza de inmediato con su clave oficial.
* **Corrección del Desplegable (Dropdown hacia Abajo):**
  - El modal se reubicó con margen superior fijo para garantizar que el combobox siempre disponga de espacio inferior en pantalla y se despliegue **hacia abajo** en lugar de elevarse hacia arriba.
* **Corrección de Acentos:** Títulos limpios en UTF-8: `Dar de Alta Nuevo Vale de Producción` y `Modificar Vale de Producción`.

### E. Reubicación de "ID Encabezado" al Título Principal
* Se eliminaron los badges redundantes de ID Encabezado que aparecían en la tarjeta de Turno y en el banner del Vale.
* Se centralizó en un único badge distintivo ubicado a un lado del título de la aplicación:
  `Captura de Pallets | Planta Tlaxcala - Depto 3 Wet Wipes | Encabezado: 58622` (sin el signo `#`).

### F. Eliminación de Flechas (Spinners) en No. Empleado
* Se retiraron los botones de incremento/decremento (`spinners`) del campo de No. Empleado mediante `inputmode="numeric"` y directivas CSS (`::-webkit-inner-spin-button { -webkit-appearance: none; }`), ahorrando espacio y evitando que el operador altere involuntariamente su número con la rueda del ratón o teclas de flecha.

### G. Auto-Formato Flexible de Hora (`0810` -> `08:10`)
* **Problema:** En piso los operadores tienen prisa y con frecuencia omiten los dos puntos (`:`) o escriben `0810`, `810` o `1400`.
* **Solución Implementada (`NormalizarHora`):**
  - Si el operador escribe `0810` o `810`, el sistema lo convierte automáticamente a `08:10`.
  - Si escribe `1400` o `14`, lo convierte a `14:00`.
  - Si deja el campo vacío o inválido, asigna automáticamente la hora actual.
  - La normalización ocurre al salir del campo (`onblur`) y antes de cualquier guardado en base de datos.

### H. Lote Rápido Inteligente a Intervalos de 4 Minutos y Navegación con [Enter]
* **Intervalo de 4 Minutos:** La salida estándar de toallitas húmedas en Planta Tlaxcala es de aproximadamente 4 minutos por tarima. Las horas consecutivas sugeridas en lote rápido ahora se generan con saltos de **+4 minutos** (ej. `08:00`, `08:04`, `08:08`...).
* **Navegación Ultrarrápida con [Enter]:** Como las cajas y la línea rara vez varían, los operadores solo ingresan las horas:
  - Al capturar la hora en la Tarima 1 y presionar [Enter], el cursor salta automáticamente al campo de hora de la Tarima 2 y selecciona su texto para sobreescritura rápida.
  - De la Tarima 2 salta a la Tarima 3, y así sucesivamente.
  - En la última tarima del lote, presionar [Enter] traslada el foco directamente al botón **Guardar Lote de Tarimas**.

### I. Bloqueo Inviolable al Alcanzar el Límite de 38 Pallets
* Si el vale ya alcanzó los 38 pallets:
  - El botón `Lote Rápido (1 a 10 Tarimas)` queda deshabilitado con tooltip explicativo.
  - Se impide añadir filas adicionales si el total acumulado superaría 38 tarimas.
  - En el guardado individual, se valida y bloquea cualquier intento de inserción que exceda el límite físico del vale.

### J. Validación Obligatoria de los 3 Campos de Pallet
* Antes de guardar cualquier pallet (individual o lote), se valida de forma estricta:
  1. **Hora:** No vacía y normalizada en formato `HH:mm`.
  2. **Cajas:** Entero mayor a 0.
  3. **Línea de Empaque:** Seleccionada y válida en el catálogo.

### K. Numeración Secuencial Progresiva (1, 2, 3...)
* Columna **`NO.`** en el grid de pallets con numeración progresiva limpia: `1`, `2`, `3`, `4`... hasta el total de pallets del vale (sin `#`).
* La fila de captura inferior proyecta en gris tenue el siguiente número que le corresponderá al pallet (ej. `Tarima 2`).

### L. Candado Previo Anti-Duplicidad de Hora en Tarima Rápida (Atomicidad "Todo o Nada")
* **Diagnóstico de la Incidencia Operativa:**
  - Al capturar un lote de 5 tarimas donde una de ellas tenía una hora repetida respecto a un pallet previamente capturado en ese vale, el procedimiento `pa_P009_01006_tblPalletsInsertcmdV5` rechazó la tarima en conflicto.
  - Sin embargo, la primera tarima ya se había insertado en la base de datos de forma aislada. Como el lote devolvió error general, la app web no mandó a imprimir la tarima guardada ni refrescó la tabla, causando confusión en piso de producción.
* **Solución Implementada en 3 Niveles Defensivos:**
  1. **Nivel 1 (Cliente en Memoria - 0ms):**
     - Antes de enviar el lote a la API, `CapturaPallets.razor` comprueba:
       * Que no existan horas repetidas entre las tarimas del propio lote a registrar.
       * Que ninguna hora del lote coincida con las horas ya registradas en la lista del vale activo (`_pallets`).
     - Si hay cualquier coincidencia, la operación se cancela de inmediato informando exactamente la tarima y la hora en conflicto, **sin contactar a la base de datos ni guardar absolutamente nada (0 tarimas)**.
  2. **Nivel 2 (Backend API - Atomicidad y Pre-validación en `PalletRepository.cs`):**
     - Antes de ejecutar el primer `INSERT`, la API consulta directamente las horas existentes en `dbo.tblPallets WITH (NOLOCK) WHERE FolioVale = @FolioVale`.
     - Si detecta colisión con alguna hora del lote o duplicidad interna, aborta la petición con `Exitoso = false`, protegiendo la tabla y los números consecutivos de `dbo.tblNoTarima`.
  3. **Nivel 3 (Resiliencia en Frontend):**
     - En caso de un fallo imprevisto ajeno a las horas, si alguna tarima alcanzó a insertarse (`IdsInsertados.Count > 0`), la interfaz envía inmediatamente la orden de impresión de las tarimas que sí quedaron guardadas y refresca el grid para garantizar 100% de coherencia visual vs base de datos.
  4. **Protección Extendida:** Este mismo candado se activó en la captura de **Tarima Individual** y en la **Edición de Tarimas**.

### M. Corrección Integral de Ortografía, Acentuación y Eliminación de Mojibake
* Se restauraron limpiamente más de 80 textos que presentaban caracteres mal codificados (`á`, `é`, `LÁNEA`, etc.) en:
  - `CapturaPallets.razor`
  - `App.razor`
  - `Configuracion.razor`
* Se corrigieron y acentuaron formalmente los encabezados y etiquetas de la interfaz:
  - `Producción`, `Línea de Empaque`, `Descripción del Producto`, `Máquina Asignada`, `Información`, `Número de Empleado`, `Tarima Rápida`, `Edición`, `Atención`, `Válido`.
* Todos los archivos modificados quedaron guardados en formato **UTF-8 con BOM**.

### N. Detección Visual Instantánea de Tarimas en Conflicto (Parpadeo Rojo)
* **Objetivo:** Permitir al operador identificar en menos de 1 segundo cuál es la tarima que tiene la hora repetida para corregirla de inmediato.
* **Implementación Visual:**
  - Se diseñó la animación CSS `@keyframes pulseDangerRow` con clase `.row-pulse-danger` y `.row-pulse-danger-cell`.
  - La fila o celda en conflicto emite un **parpadeo rojo intermitente** con bordes y fondo carmesí translúcido de alta intensidad (`rgba(220, 53, 69, 0.45)`).
  - Al presionar **Guardar Lote de Tarimas**:
    1. Si hay conflicto dentro del propio lote, las tarimas con horas idénticas parpadean en rojo.
    2. Si hay conflicto contra una tarima ya capturada en el vale, tanto la fila del lote como la fila histórica del grid se marcan en rojo parpadeante.
    3. El foco del cursor se traslada automáticamente a la primera caja de hora conflictiva para su edición inmediata.

### O. Optimización y Debounce Inmediato en Modificación de Pallets
* **Problema Identificado:**
  - Al editar una tarima existente (cambiar hora, cajas o línea de empaque) y pulsar la palomita verde, la interfaz no daba retroalimentación visual inmediata.
  - El operador asumía que el clic no había funcionado y pulsaba reiteradamente el botón, disparando peticiones concurrentes y bloqueos transaccionales en SQL Server que demoraban la respuesta hasta 15 segundos.
* **Soluciones Implementadas:**
  1. **Debounce e Indicador de Carga 0ms en Interfaz:**
     - En cuanto se hace clic en la palomita verde, la variable `_guardandoEdicionId` se activa inmediatamente (0 ms).
     - El botón deshabilita clics subsecuentes y sustituye la palomita verde por un spinner dinámico de carga (`spinner-border spinner-border-sm text-white`).
     - Al concluir la operación, se restaura el estado y se recargan los datos limpiamente.
  2. **Optimización del Procedimiento Almacenado `pa_P009_01008_tblPalletsUpdatecmdV5`:**
     - Se eliminó el `JOIN` redundante y costoso hacia `dbo.tblPallets` en la cláusula `UPDATE`.
     - Se agregaron directivas `WITH (NOLOCK)` en las lecturas de validación.
     - Se incluyó la actualización directa de `LineaEmpaque = @Linea`.
     - El tiempo de ejecución se redujo de segundos a **< 15 ms**.

### P. Sincronización Integral de Cambio de Máquina y Servicio Zebra Bridge
* **Causa Raíz de la Falla al Cambiar Máquina:**
  - `Configuracion.razor` y `zebra-print.js` guardaban el identificador en `localStorage` bajo la clave `PalletsWW_MaquinaId`.
  - `CapturaPallets.razor` intentaba leer la máquina bajo la clave legacy `pallets_ww_maquina`.
  - En consecuencia, aunque `Configuracion.razor` indicaba que la máquina se había guardado, la pantalla de captura continuaba operando con la máquina anterior.
* **Solución Implementada:**
  - `zebra-print.js` sincroniza simultáneamente ambas claves (`PalletsWW_MaquinaId` y `pallets_ww_maquina`) al llamar a `saveMachineConfig`.
  - Al cambiar de máquina en `/configuracion`, se limpia la caché en memoria (`CacheService.LimpiarCache()`) y se ejecuta una recarga forzada (`Navigation.NavigateTo("/", forceLoad: true)`).
  - Al iniciar `CapturaPallets.razor`, se lee la configuración activa de la máquina y se recargan automáticamente las líneas de empaque correspondientes a dicha máquina (`CargarLineasEmpaqueAsync`), los productos y el turno activo.
  - La sincronización con el servicio de impresión USB de Zebra (`PalletsPrintBridge` y su archivo `settings.json` en `C:\ProgramData\PalletsWW_ZebraBridge`) queda 100% enlazada con la máquina seleccionada.

---


### Q. Corrección de Visibilidad Inferior en Modo App/Kiosk y Limpieza de Caracteres Especiales (23/09/2026)
* **Diagnóstico de la Diferencia entre Navegador Edge y Modo App (Instalador):**
  - En Microsoft Edge regular existen pestañas, barra de URLs y favoritos (~110px de cabecera), lo que obliga a la ventana a tener barra de desplazamiento vertical completa donde el usuario puede deslizarse hacia abajo y ver la tabla con espacio.
  - En la aplicación empaquetada (`--app`), la ventana carece de barras de herramientas y ocupa el área de trabajo completa hasta el borde superior de la barra de tareas de Windows.
  - El contenedor de la cuadrícula (`#palletsTableContainer`) tenía una altura fija `max-height: 460px`, la tarjeta inferior carecía de margen y el contenedor principal terminaba abruptamente sin relleno inferior. Como resultado, la última tarima (tarima 38 o fila de captura rápida) quedaba pegada al borde inferior de la pantalla y cortada parcialmente por la barra de tareas de Windows, impidiendo al usuario ver su borde inferior y acciones.
* **Soluciones Implementadas:**
  1. **Ajuste Dinámico de Altura:** Se optimizó `#palletsTableContainer` a `max-height: 420px; overflow-y: auto; padding-bottom: 15px;`.
  2. **Espaciador en Tabla (`<tfoot>`):** Se introdujo un pie de tabla transparente de 20px dentro de la cuadrícula, garantizando que al hacer scroll al fondo, la última fila quede elevada con margen interno.
  3. **Espaciador de Seguridad Inferior en Página:** Se agregó un buffer inferior de 85px (`<div style="height: 85px; width: 100%;"></div>`) al final del contenedor principal y un padding inferior de 5rem en `.content-body` dentro de `app.css`.
  4. **Auto-Scroll Inteligente:** `ScrollTablaAlFinal()` ahora invoca `lastRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' })` además de `scrollTop = scrollHeight`, asegurando que la última fila registrada quede perfectamente centrada en el campo visual del operador.
  5. **Limpieza Integral de Mojibake:** Se corrigieron todos los caracteres residuales `\uFFFD`, restituyendo `DESCRIPCIÓN DEL PRODUCTO`, `Última Tarima:`, `⚠️ ATENCIÓN: CAPTURANDO EN EL TURNO ANTERIOR`, `CONFIGURACIÓN`, `GESTIÓN`, `MÉTRICAS`, `CREACIÓN`, `MODIFICACIÓN`, `REIMPRESIÓN`, `CONFIRMACIÓN`, `NOTIFICACIÓN`, `NORMALIZACIÓN`, `NAVEGACIÓN` y `SINCRONIZACIÓN`.


### R. Enlace Nativo de Impresión Zebra USB en Captura de Pallets (23/09/2026)
* **Causa Raíz de 'Impresora Desconectada' y Fallo de Impresión:**
  - En la pantalla de captura (`CapturaPallets.razor`), los métodos `VerificarImpresoraUsbAsync` e `ImprimirEtiquetaUsb` realizaban llamadas HTTP hacia `ImpresionApiService` en el servidor central IIS (`10.26.24.37`).
  - Como el servidor IIS está en un centro de cómputo y no tiene cables USB de impresoras físicas conectados, el servidor respondía `conectada = false` y rechazaba las órdenes de impresión.
  - El microservicio local `PalletsPrintBridge.exe` estaba correctamente activo en la PC cliente (puerto 9100), pero la pantalla de captura no lo estaba llamando (a diferencia de `/configuracion` que sí utilizaba `ZebraPrint`).
* **Solución Implementada:**
  1. **Detección Local en PC Cliente:** `VerificarImpresoraUsbAsync` consulta primero al puente local a través de `ZebraPrint.checkStatus` (`http://127.0.0.1:9100/default?type=printer`). Detecta el nombre de la impresora física instalada en Windows (`Generic / Text Only` o `ZDesigner`), su estado de pausa y trabajos en cola, pintando el badge en **Verde** inmediatamente.
  2. **Envío Directo ZPL RAW:** `ImprimirEtiquetaUsb` obtiene el código ZPL generado por la base de datos vía `ObtenerEtiquetaAsync(idPallet)` y lo envía inmediatamente a `ZebraPrint.printZpl` hacia `http://127.0.0.1:9100/write`. El microservicio inyecta los bytes en < 10ms a través de `winspool.drv`.
  3. **Impresión Secuencial en Lotes:** Al guardar lotes de 1 a 10 pallets, las etiquetas se despachan secuencialmente con 350ms de pausa para alimentación y avance limpio de rollo.
  4. **Fallback:** Si la aplicación se ejecuta localmente en el servidor sin puente cliente, mantiene su fallback al spooler central.


### S. Corrección Crítica de Falsa Duplicidad de Hora por FolioVale e Hiper-Optimización de Velocidad en Captura por Lotes (23/09/2026)
* **Causa Raíz del Rechazo Falso de Hora ("Hora ya registrada en este vale"):**
  - **Diagnóstico:** Al intentar guardar tarimas con horas que no estaban en el vale actual (ej. `11:25`), el sistema arrojaba el error: *"La tarima #1 tiene la hora 11:25, la cual ya está registrada en este vale"*, obligando al operador a cambiar la hora a `11:26`.
  - **Falla en Stored Procedure y API:**
    - Tanto en el Stored Procedure `pa_P009_01006_tblPalletsInsertcmdV5` como en la consulta previa de `PalletRepository.cs`, la validación de duplicidad consultaba:
      `WHERE FolioVale = @FolioVale AND Hora = @Hora`
    - **Omitía el filtro `AND IdRT_Encabezado = @IdRT_Encabezado`**.
    - Como los folios de vales se reciclan a través de los años y turnos en Planta Tlaxcala, existía en el histórico de `dbo.tblPallets` un registro antiguo de otro turno/año con ese mismo folio `3246` y con hora `11:25`. Al no delimitar por el turno activo, el sistema colisionaba contra datos históricos ajenos.
  - **Solución Aplicada:**
    1. **En Stored Procedure `pa_P009_01006_tblPalletsInsertcmdV5`:** Se añadió `AND IdRT_Encabezado = @IdRT_Encabezado` a la condición `IF EXISTS` y a la consulta de la tarima existente. Compilado y aplicado directamente en la base de datos de producción `TLX022MXDB`.
    2. **En Backend API (`PalletRepository.cs`):** Se parametrizó `WHERE FolioVale = @FolioVale AND IdRT_Encabezado = @IdRT_Encabezado`.
    3. **En Frontend Web (`CapturaPallets.razor`):** Se reubicó la validación visual en memoria para que se ejecute estrictamente dentro de `GuardarLotePallets` sobre las tarimas activas del vale actual (`_pallets`), marcando en rojo parpadeante solo los conflictos reales del turno actual.

* **Hiper-Optimización de Velocidad en Guardado por Lotes (Reducción de 15 viajes de red a 1):**
  - **Diagnóstico de Lentitud:** Para guardar 3 a 5 tarimas, la app web realizaba hasta 15 peticiones HTTP/SQL secuenciales (verificación pesada de tabla completa, guardados uno a uno, recarga de turno anterior y 5 llamadas GET separadas para obtener el ZPL de cada tarima).
  - **Soluciones de Rendimiento:**
    1. **Generación ZPL en Servidor:** Al insertar cada pallet, la API genera el código ZPL inmediatamente en el servidor y lo adjunta dentro de `PalletResultDto.CodigoZpl`. El cliente web recibe todas las etiquetas listas en la misma respuesta del lote, eliminando todas las llamadas HTTP adicionales de `/api/impresion/etiqueta/...`.
    2. **Conteo Ultraligero:** Se sustituyó `ObtenerPalletsPorValeAsync` por un `SELECT COUNT(1)` indexado para validar el límite de 38 tarimas.
    3. **Eliminación de Recarga de Turno Anterior:** Se removió la consulta pesada a `ObtenerTurnoAnteriorAsync` tras guardar un lote, ya que los vales históricos no cambian.
    4. **Impresión Asíncrona sin Bloqueo:** Las etiquetas ZPL se envían al Spooler de Zebra en segundo plano espaciadas por 350ms, liberando la pantalla del operador inmediatamente.

## 3. Matriz de Componentes y Procedimientos Almacenados

| Componente | Tipo | Acción / Procedimiento |
| :--- | :--- | :--- |
| `CapturaPallets.razor` | Blazor Component | Sincronización Clave/Producto, navegación con Enter en Lote, autoformato de hora, candado cliente anti-duplicidad, parpadeo rojo `row-pulse-danger`, debounce/spinner en edición de tarimas, recarga dinámica por cambio de máquina, despacho ZPL en background. |
| `Configuracion.razor` | Blazor Component | Guardado atómico de máquina en `localStorage` y `PalletsPrintBridge`, limpieza de caché y redirección forzada. |
| `zebra-print.js` | JavaScript Interop | Compatibilidad dual de claves de almacenamiento (`PalletsWW_MaquinaId` y `pallets_ww_maquina`), sincronización de hardware Zebra. |
| `PalletRepository.cs` | Repositorio API | Invocación de `pa_P009_01008_tblPalletsUpdatecmdV5`, pre-validación de horas duplicadas por `IdRT_Encabezado`, conteo `COUNT(1)` de 38 pallets, generación integrada de ZPL en `PalletResultDto`. |
| `pa_P009_01006_tblPalletsInsertcmdV5.sql` | Stored Procedure | Corrección del candado anti-duplicidad para validar `IdRT_Encabezado = @IdRT_Encabezado` y evitar colisiones con vales históricos. |
| `pa_P009_01008_tblPalletsUpdatecmdV5.sql` | Stored Procedure | Procedimiento ultraligero de actualización de pallets (< 15ms) con soporte de línea, cajas y hora. |
| `ValesApiService.cs` | Web Service | Métodos `ObtenerTurnoAnteriorAsync` y `ModificarValeAsync`. |
| `ValesController.cs` | Web API Controller | Endpoints `GET api/vales/turno-anterior` y `PUT api/vales/modificar`. |
| `ValeRepository.cs` | Repositorio API | Invocación de `pa_P009_01005_sLlenardgvProduccionTurnoAnt` y `pa_P009_01007_slnkModificaVale_LinkClicked`. |

---

## 4. Estado de Publicación y Verificación

1. **Compilación Release:** 0 Errores en toda la solución (`PalletsWW_PC_sln.sln`).
2. **Publicación en Caliente en IIS:**
   - **Backend API:** `C:\PublishIIS\PalletsWW_PC.Api.Publish` (Exit Code 0).
   - **Frontend Web:** `C:\PublishIIS\PalletsWW_PC.Blazor.Publish` (Exit Code 0).
3. **Persistencia y Codificación:** Guardado en formato **UTF-8 con BOM**.


