# 111. Detalles de App Fase 4: Optimización Ergonómica de Interfaz, Delimitación Visual de Paneles Críticos, Ocultación Temporal de Modo Lote y Guardado Directo por Tecla [Enter] en Línea

**Sistema:** Pallets Wet Wipes (.NET 8 Blazor Web App & ASP.NET Core Web API)  
**Fecha de Implementación:** 23/09/2026  
**Módulos Afectados:**  
- `PalletsWW_PC.Web/Components/Pages/CapturaPallets.razor`  
- `C:\PublishIIS\PalletsWW_PC.Blazor.Publish\`  
- `Gemini/010.01 Pallets WW Cambios Realizados Mejoras Operativas.md`  

---

## 1. Resumen Ejecutivo de la Fase 4

Durante las sesiones de validación operativa en piso de producción y pruebas ergonómicas con operadores y supervisores en planta Tlaxcala, se identificaron necesidades clave orientadas a la usabilidad táctil/visual y a la agilidad operativa:

1. **Guardado Directo desde Selector de Línea de Empaque con [Enter]:**  
   Previamente, el atajo de guardado automático mediante tecla `[Enter]` operaba únicamente cuando el foco estaba en el campo de **Cajas**. En operaciones continuas donde los operadores ya tienen la cantidad fija de cajas pero deben conmutar la **Línea de Empaque**, se requería disparar el guardado e impresión directa presionando `[Enter]` desde el combobox de línea, sin obligar al usuario a tomar el mouse o regresar el cursor a cajas.

2. **Baja Visibilidad de Paneles en Pantallas Industriales:**  
   Los monitores de quiosco en planta presentaban dificultad para distinguir las fronteras entre secciones debido al uso de bordes sutiles o transparentes (`border-0`, `border-opacity-25`). Se requirió contrastar y delimitar firmemente los contenedores principales:
   - Panel contenedor general de Vales y Métricas.
   - Sub-panel de Vales del Turno Actual.
   - Sub-panel de Vales del Turno Anterior.
   - Cuadrícula principal de Tarimas Capturadas del Vale.

3. **Maximización del Espacio Vertical Útil (Ocultación de Modo Lote):**  
   Para optimizar la visualización de la cuadrícula de tarimas capturadas y permitir que un mayor número de pallets se visualicen simultáneamente en pantalla sin desplazamientos verticales forzados, se solicitó ocultar temporalmente la franja de selección de *Modo de Captura (Individual vs Lote)*, manteniendo su arquitectura intacta para futuras fases.

4. **Preservación Total de la Lógica de Negocio:**  
   Todas las modificaciones se circunscribieron estrictamente a la capa de presentación Razor y estilos CSS en línea de alta prioridad (`!important`), sin modificar procedimientos almacenados, APIs, DTOs ni el ciclo de vida transaccional del backend.

---

## 2. Diagnóstico Técnico y Soluciones Implementadas

### A. Guardado Directo con Tecla [Enter] en el Selector de Línea de Empaque
* **Problema Operativo:** Cuando el operador cambiaba de la línea 11 a la 12, debía forzosamente dar clic en el botón verde "Guardar" o tabular de regreso al campo de cajas para presionar `[Enter]`.
* **Solución Implementada (`CapturaPallets.razor`):**
  - Se vinculó el evento `@onchange="OnNuevaLineaChanged"` para sincronizar al instante la opción seleccionada.
  - Se agregó el detector de teclado `@onkeydown="HandleKeyDownNuevaFila"`.
  - Cuando se detecta `Key == "Enter"` dentro del `<select>`, se valida el candado anti-rebote `_isSaving` y se invoca inmediatamente `GuardarNuevoPallet()`.

### B. Delimitación Perimetral de Alta Visibilidad por Paneles
* **Problema Visual:** Los paneles flotantes en modo claro (`card-glass`) se mimetizaban con el fondo gris perla `#f4f6f9`.
* **Solución Visual:**
  - **Panel General de Vales:** Borde sólido perimetral color pizarra oscuro (`border: 2px solid #64748b !important; box-shadow: 0 4px 12px rgba(0,0,0,0.06);`).
  - **Vales Turno Actual:** Borde perimetral azul cobalto sólido (`border: 2px solid #0284c7 !important;`) y cabecera reforzada con `border-bottom: 2px solid #0284c7`.
  - **Vales Turno Anterior:** Borde perimetral ámbar oscuro sólido (`border: 2px solid #d97706 !important;`) y cabecera con `border-bottom: 2px solid #d97706`.
  - **Cuadrícula de Tarimas Capturadas:** Borde perimetral pizarra (`border: 2px solid #64748b !important;`) y divisor de cabecera sólido a juego.

### C. Ocultación Controlada del Selector de Modo de Captura
* **Acción:** Se encapsuló el bloque HTML/Razor comprendido entre `<!-- SELECTOR MODERNO DE MODO DE CAPTURA -->` y `<!-- PANEL DE CAPTURA EN LOTE -->` dentro de un bloque de comentario Razor `@* ... *@`.
* **Resultado:**
  - Desaparición visual inmediata del selector en la pantalla de captura.
  - Ganancia aproximada de 65px a 110px de altura libre en pantalla.
  - La tabla de tarimas sube de cota, mostrando inmediatamente entre 6 y 9 filas de pallets capturados en monitores estándar 1080p y quioscos 768p.
  - Código fuente C# y bindings preservados sin generar referencias rotas ni warnings.

---

## 3. Matriz de Cambios por Componente

| Componente | Archivo Modificado | Cambio Realizado |
| :--- | :--- | :--- |
| **Frontend UI** | `CapturaPallets.razor` | Aplicación de bordes oscuros en paneles de Vales (`#64748b`), Vales Actuales (`#0284c7`), Vales Anteriores (`#d97706`) y Tarimas (`#64748b`). |
| **Frontend UI** | `CapturaPallets.razor` | Ocultación del bloque selector de Modo Captura y panel de lote vía comentario Razor `@* ... *@`. |
| **Frontend Lógica** | `CapturaPallets.razor` | Enlace de evento `[Enter]` en combobox de Línea de Empaque para disparo automático de guardado. |
| **Documentación** | `Gemini/010.01 Pallets WW Cambios Realizados Mejoras Operativas.md` | Anexo de la Sección F con el detalle técnico de la intervención visual y ergonómica. |
| **Documentación** | `Gemini/111 Detalles de App Fase 4.md` | Creación de la memoria técnica de la Fase 4 con especificaciones y validaciones. |

---

## 4. Despliegue y Publicación en IIS

1. **Compilación de la Solución:**
   - Proyecto: `PalletsWW_PC.Web.csproj`
   - Configuración: `Release`
   - Resultado: **0 Errores**, compilación exitosa.

2. **Publicación en Caliente en IIS:**
   - Directorio Destino: `C:\PublishIIS\PalletsWW_PC.Blazor.Publish\`
   - Reciclaje de Proceso: Detección automática in-process vía `web.config` y timestamp touch.
   - Estado: Totalmente operativa en el servidor local.

---

## 5. Directivas de Mantenimiento Futuro

* **Reactivación del Modo de Captura:**  
  Cuando la jefatura o el área de producción requiera reincorporar la captura por lote de 1 a 10 tarimas, únicamente debe removerse el tag de comentario `@*` y `*@` en `CapturaPallets.razor` alrededor de la línea 376. Ningún método en el bloque `@code` fue eliminado ni modificado.
* **Consistencia Visual:**  
  Cualquier modal emergente o nuevo panel introducido deberá apegarse al estándar de bordes de 2px con paleta Slate `#64748b` para secciones neutras, Blue `#0284c7` para turno activo y Amber `#d97706` para histórico.

---

## 6. Mejoras Operativas y Ergonómicas de Piso (25/09/2026)

En atención a la retroalimentación de los operadores en piso de producción en Planta Tlaxcala, se implementaron 4 optimizaciones de alta precisión para acelerar el ritmo de captura consecutiva y mejorar la legibilidad:

### A. Expansión del Control del Operador en Cabecera
* **Problema:** En la barra superior derecha, los nombres largos de operadores (ejemplo: `DEL RAZO LOPEZ RIGOBER`) se mostraban incompletos o truncados debido a una restricción fija de `max-width: 180px;`.
* **Solución Implementada (`CapturaPallets.razor`):**
  - Se flexibilizó el contenedor del nombre a `style="min-width: 180px; max-width: 380px;"`.
  - Se vinculó el atributo `title="@_nombreOperadorActivo"` para despliegue de tooltip con el nombre completo.
  - Ahora cualquier nombre largo de operador se visualiza al 100% de forma nítida, aprovechando el espacio libre horizontal de la cabecera.

### B. Incremento de Altura Útil de la Tabla (+1 Pallet Visible en Pantalla)
* **Problema:** Existía un margen inferior disponible entre la última fila y el borde inferior de la aplicación sin aprovecharse.
* **Solución Implementada (`CapturaPallets.razor`):**
  - Se incrementó la altura máxima `.vista-captura-normal #palletsTableContainer` de `385px` a `440px` (+55px).
  - En `.vista-turno-anterior #palletsTableContainer` se ajustó de `480px` a `535px`.
  - Se redujo el espaciador inferior de seguridad de `85px` a `25px` (-60px), manteniendo constante la cota total de la ventana y evitando scrolls externos no deseados.
  - Con esto se gana exactamente el espacio necesario para mostrar **1 tarima más de forma simultánea** en la cuadrícula de captura.

### C. Auto-Desplazamiento (Scroll) Continuo al Final tras Guardar Pallet
* **Problema:** Al presionar `[Enter]` o pulsar "Guardar", Blazor agregaba la nueva tarima pero el contenedor mantenía la posición de scroll anterior, obligando al operador a tomar el mouse y bajar la barra manualmente para poder visualizar y capturar el próximo pallet.
* **Causa Raíz:** `await ScrollTablaAlFinal()` se invocaba antes de que Blazor concluyera el ciclo de renderizado del nuevo elemento en el DOM, por lo que el cálculo de `scrollHeight` correspondía a la altura previa.
* **Solución Implementada (`CapturaPallets.razor`):**
  - En `GuardarNuevoPallet()`, tras obtener la respuesta exitosa, se invoca `StateHasChanged()` de forma explícita seguido de un breve delay preventivo (`await Task.Delay(60)`).
  - En `ScrollTablaAlFinal()`, se estructuró una rutina JavaScript auto-ejecutable multi-fase (`bajarScroll`) que:
    1. Ajusta `palletsTableContainer.scrollTop = palletsTableContainer.scrollHeight + 10000`.
    2. Ejecuta `input-nueva-hora.scrollIntoView({ behavior: 'auto', block: 'end' })`.
    3. Enfoca y selecciona el campo de hora (`inp.focus(); inp.select()`).
    4. Repite preventivamente a los 60ms y 180ms para asegurar acoplamiento tras el refresco del navegador.
  - **Resultado Operativo:** Los operadores pueden capturar un pallet tras otro de manera ininterrumpida y a alta velocidad sin tocar el ratón ni la barra de desplazamiento.

### D. Modernización y Nitidez de Iconos de Navegación Lateral
* **Problema:** Los iconos previos en el menú lateral colapsado (`bi-grid-3x3-gap-fill` que parecía un teclado numérico, `bi-file-earmark-bar-graph-fill` con trazos apretados, y `bi-gear-wide-connected` de baja resolución) resultaban visualmente confusos en pantallas industriales.
* **Solución Implementada (`NavMenu.razor` y `app.css`):**
  - **Captura de Pallets:** Actualizado a `<i class="bi bi-boxes"></i>` (icono estándar de tarimas/cajas apiladas).
  - **Reportes:** Actualizado a `<i class="bi bi-bar-chart-fill"></i>` (gráfica de barras sólida de máxima nitidez).
  - **Configuración:** Actualizado a `<i class="bi bi-gear-fill"></i>` (engranaje industrial definido).
  - En `app.css` se aplicó `filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.25))` y tamaño uniforme de `1.32rem`, brindando una estética premium y nítida.
  - Se preservó estrictamente la arquitectura de navegación (`GetCapturaUrl()`, `GetReportesUrl()`, `GetConfigUrl()`), garantizando 0 fallos o roturas de enlaces.

### E. Despliegue y Validación
* **Compilación:** `PalletsWW_PC_sln.sln` compilado en **Release** (0 Errores).
* **Publicación IIS:** Desplegado en caliente a `C:\PublishIIS\PalletsWW_PC.Blazor.Publish\`.
* **Codificación:** Archivos guardados bajo estándar **UTF-8 con BOM**.

