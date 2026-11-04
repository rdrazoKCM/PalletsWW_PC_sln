# 115 Plan de Migración de Blazor Server a React 19 (Pallets WW)

> **Documento Oficial de Arquitectura y Migración de Frontend**  
> **Ubicación:** `C:\AI\Git Hub\clsA_P035_PallestWipes\PalletsWW_PC_sln\Gemini\115 Plan de Migracion de Blazor a React 19.md`  
> **Codificación:** UTF-8 con BOM (`\uFEFF`)  
> **Objetivo:** Acelerar la salida física de etiquetas Zebra (< 120 ms) en entornos de red lenta de planta, preservando al 100% las reglas operativas de Wipes (1 PC para 2 líneas, hora manual y 38 tarimas por vale).

---

## 1. Justificación y Diagnóstico Técnico

### 1.1. El Cuello de Botella de Blazor Server con Red Lenta
En la arquitectura actual de Pallets WW (`InteractiveServerComponents`):
1. El clic en "Guardar" viaja desde el navegador de la PC del operador por un socket SignalR hacia el servidor IIS.
2. IIS procesa la inserción en SQL Server.
3. Para imprimir en la Zebra USB local de la terminal, IIS debe enviar de regreso un comando por WebSocket (`JS.InvokeAsync("ZebraPrint.printZpl")`) a la PC del operador.
4. Con latencia o congestión en la red LAN de planta, este **doble viaje de red** demora la reacción de la impresora entre **800 ms y 1,500 ms**.

### 1.2. La Solución Probada en Pallets Pañal (React 19 SPA)
1. La aplicación corre 100% en la memoria RAM del navegador local de la terminal.
2. Se emite 1 sola petición HTTP hacia la API REST en IIS.
3. La API ejecuta el SP de inserción y devuelve el código ZPL en la misma respuesta.
4. En cuanto React recibe el ZPL en la PC local, lo inyecta a `http://127.0.0.1:9100/print` en **0.5 ms**.
5. **Resultado:** La etiqueta sale en **~120 milisegundos**.

---

## 2. Reglas de Negocio Inviolables de Planta Wipes

Durante la migración a React 19, se deben mantener intactas las particularidades operativas de Wipes:

| Componente | Regla en Wipes | Cómo se implementa en React 19 |
| :--- | :--- | :--- |
| **Línea de Empaque** | **1 PC compartida para 2 líneas.** El operador selecciona si empaca en Línea 1 o Línea 2. | Selector tipo radio/cápsula ergonómico en la fila de captura (`Línea 1` / `Línea 2`). |
| **Hora de Producción** | **Manual** (con formato `HH:mm`). | Campo de texto con validación de hora y sugerencia de hora actual editable. |
| **Candado de Duplicidad** | Se permite misma hora **solo si la línea es distinta**. | Validación preventiva en React + validación atómica en SP V9. |
| **Capacidad Máxima** | **38 tarimas por vale físico**. | Matriz LED / Medidor radial configurado a 38 tarimas máximo. |
| **Base de Datos** | **`TLX022MXDB`** | Conexión directa mediante `PalletsWW_PC.Api`. |
| **SP de Inserción** | **`pa_P009_01006_tblPalletsInsertcmdV9`** | Invocación atómica en Dapper con parámetro OUTPUT de ID. |

---

## 3. Hoja de Ruta de Migración Paso a Paso

### Fase 1: Creación del Proyecto Frontend React 19
1. Inicializar `src/PalletsWW_PC.Web` con Vite 8 + React 19 + TypeScript + Tailwind CSS v4 (`pnpm`).
2. Configurar `vite.config.ts` con puerto de desarrollo `5006` y proxy hacia la API en `5005`.
3. Configurar directivas `@theme` en `src/index.css` con la paleta oficial Kimberly-Clark (`DISENO_KC.md`).

### Fase 2: Reutilización de Componentes de Pallets Pañal
Copiar y adaptar desde `c:\AI\Git Hub\PalletsPañal_PC_sln\src\PalletsPanal.Web\`:
* `src/components/layout/Sidebar.tsx`
* `src/components/layout/CockpitHeader.tsx` (adaptado para mostrar supervisor, tripulación y estado Zebra).
* `src/components/ui/` (Button, Modal, Card, Chip, FontSizeStepper).
* `src/services/impresionService.ts` (inyección RAW directa a `127.0.0.1:9100`).

### Fase 3: Adaptación Específica de Pantalla de Captura (`CapturaPage.tsx`)
* Integrar selector interactivo de **Línea 1 y Línea 2**.
* Integrar input de **Hora** manual precargado con hora actual pero modificable.
* Ajustar medidor radial y topes de tarimas a **38 tarimas**.
* Captura rápida tarima por tarima (1 a 1) homologada con Pallets Pañal.

### Fase 4: Pruebas y Certificación de Desempeño
* Verificar que desde el clic en "Guardar" hasta la salida física de la etiqueta Zebra transcurran **menos de 150 ms** incluso bajo condiciones de red lenta.
