# 108. Detalles de App Fase 1: Blindaje Antidesconexión, Reubicación de Captura, Columna ID y Restricción de Eliminación

**Sistema:** Pallets Wet Wipes (.NET 8 Blazor Web App)  
**Fecha de Implementación:** 22/09/2026  
**Módulos Afectados:**  
- `PalletsWW_PC.Web/Program.cs`  
- `PalletsWW_PC.Web/Components/App.razor`  
- `PalletsWW_PC.Web/Components/Pages/CapturaPallets.razor`  
- `Instalador_Cliente_Zebra/Instalar_PC_Cliente.ps1` y `CrearAccesoDirecto.ps1`  
- Publicación IIS: `C:\PublishIIS\PalletsWW_PC.Blazor.Publish\`  

---

## 1. Prevención Definitiva de Congelamiento por Inactividad ("Could not reconnect to the server")

### Diagnóstico de Causa Raíz
* **Sleeping Tabs de Microsoft Edge:** Tras varios minutos sin interacción del operador, Microsoft Edge suspende automáticamente los temporizadores de JavaScript y la conexión WebSocket (SignalR) para ahorrar memoria RAM y CPU.
* **Agotamiento de Intentos de Blazor Server:** El circuito de SignalR por defecto tiene un número limitado de reintentos (8 intentos breves). Cuando el circuito expiraba en el servidor, Blazor desplegaba una barra gris de error estática:  
  `Could not reconnect to the server. Reload the page to restore functionality.`  
  bloqueando toda la interfaz gráfica hasta que el operador cerraba y abría el navegador o presionaba F5.

### Solución Arquitectónica Cuádruple Implementada

1. **Retención de Circuitos de 8 Horas (`Program.cs`):**
   ```csharp
   builder.Services.AddRazorComponents()
       .AddInteractiveServerComponents(circuitOptions =>
       {
           circuitOptions.DisconnectedCircuitRetentionPeriod = TimeSpan.FromHours(8);
           circuitOptions.DisconnectedCircuitMaxRetained = 200;
       });

   builder.Services.AddSignalR(hubOptions =>
   {
       hubOptions.ClientTimeoutInterval = TimeSpan.FromMinutes(2);
       hubOptions.KeepAliveInterval = TimeSpan.FromSeconds(15);
       hubOptions.HandshakeTimeout = TimeSpan.FromSeconds(30);
   });
   ```
   *Efecto:* El servidor IIS mantiene viva la memoria y el estado de la sesión de captura durante un turno industrial completo de 8 horas, permitiendo reanudar la sesión sin pérdida de datos.

2. **Endpoint de Salud y Keep-Alive (`/api/health`):**
   Se expuso un endpoint liviano en ASP.NET Core:
   ```csharp
   app.MapGet("/api/health", () => Results.Ok(new { status = "OK", timestamp = DateTime.Now }));
   ```

3. **Watchdog de Auto-Recuperación en Navegador (`App.razor`):**
   - **Latido continuo cada 20 segundos:** Realiza un ping a `/api/health`, impidiendo que Edge clasifique la pestaña como inactiva.
   - **Monitor de Reconexión:** Si el modal de reconexión de Blazor se activa y no se restablece en pocos segundos, el watchdog **recarga automáticamente la página de forma limpia**, evitando que el operador quede bloqueado con la barra de error.
   - **Evento de Foco / Visibilidad:** Al volver a enfocar la ventana de la terminal, reactiva la conexión inmediatamente.

4. **Flags Anti-Suspensión en Accesos Directos (`Instalar_PC_Cliente.ps1` y `CrearAccesoDirecto.ps1`):**
   Se configuró el modo de aplicación de Edge con directivas industriales de Chromium:
   ```text
   --app=http://10.26.24.37:5106/ --user-data-dir="%LOCALAPPDATA%\PalletsWW_EdgeProfile" --start-maximized --disable-background-timer-throttling --disable-renderer-backgrounding --disable-backgrounding-occluded-windows
   ```
   *Efecto:* Edge no degrada ni suspende la ventana de Pallets WW aunque quede en segundo plano.

---

## 2. Retiro del Botón Eliminar Pallet para Piso de Producción

### Requerimiento Operativo
Producción no debe tener facultades para eliminar pallets registrados en el vale.

### Modificación Aplicada (`CapturaPallets.razor`)
* Se removió el botón `<button class="btn btn-outline-danger btn-sm p-1" title="Eliminar Tarima">` de la columna de acciones.
* La columna **ACCIONES** ahora contiene exclusivamente:
  - **Imprimir Etiqueta (`bi-printer`):** Reenvío directo de comandos ZPL a la impresora Zebra USB.
  - **Modificar Tarima (`bi-pencil-square`):** Edición en línea de hora, cajas y línea de empaque.

---

## 3. Reubicación de la Fila de Captura al Final del Listado con Auto-Scroll

### Requerimiento Operativo
En el diseño anterior, la fila de captura rápida estaba ubicada en la parte superior de la tabla, mientras que los pallets se ordenaban cronológicamente hacia abajo. El operador capturaba a las 13:17 pero para ver el último pallet capturado (ej. 12:09) o verificar que se guardó tenía que desplazarse por el scroll.

### Modificación Aplicada (`CapturaPallets.razor`)
1. **Reubicación debajo de los Pallets Registrados:**  
   El bloque `@if (!_modoLote ...)` se trasladó al final del cuerpo de la tabla (`<tbody>`). Ahora:
   - Primero se listan los pallets existentes (Tarima 1, Tarima 2, ... Tarima N).
   - Inmediatamente debajo de la última tarima aparece la fila de captura para la tarima `N + 1`.
   - El operador tiene justo encima la hora y el número de tarima anterior como referencia directa.
2. **Auto-Scroll Inteligente:**  
   Se implementó la función `ScrollTablaAlFinal()`:
   ```csharp
   private async Task ScrollTablaAlFinal()
   {
       try
       {
           await Task.Delay(60);
           await JS.InvokeVoidAsync("eval", "var el = document.getElementById('palletsTableContainer'); if (el) { el.scrollTop = el.scrollHeight; }");
       }
       catch { }
   }
   ```
   Al seleccionar un vale o guardar un pallet, la tabla se desplaza suavemente hacia abajo, manteniendo siempre a la vista los últimos registros y los campos de captura.

---

## 4. Nueva Columna "ID PALLET" en la Tabla

### Requerimiento Operativo
Los operadores requerían una referencia visual clara y directa del número de identificación único de cada pallet registrado.

### Modificación Aplicada (`CapturaPallets.razor`)
* **Encabezado:** Se agregó la columna `<th style="width: 105px;" class="text-center">ID PALLET</th>` entre `DESCRIPCIÓN DEL PRODUCTO` y `ACCIONES`.
* **Filas de Datos:** Se muestra el identificador de base de datos (`IdtblPallets`):
  ```html
  <td class="text-center font-monospace fw-bold">
      <span class="badge bg-secondary bg-opacity-15 text-secondary border border-secondary font-monospace px-2 py-1">
          #@p.IdtblPallets
      </span>
  </td>
  ```
* **Fila de Captura:** Despliega una insignia neutral `--` indicando que el ID será asignado automáticamente por el servidor al presionar Guardar.

---

## 5. Resumen de Pruebas y Despliegue

1. **Compilación:** Verificada en Release (`0 Errores`).
2. **Publicación IIS:** Desplegada exitosamente en `C:\PublishIIS\PalletsWW_PC.Blazor.Publish\`.
3. **Instaladores Actualizados:** `Instalar_PC_Cliente.ps1` y `CrearAccesoDirecto.ps1` listos con los flags anti-suspensión para nuevas terminales.
