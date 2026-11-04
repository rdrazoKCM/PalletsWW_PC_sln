# 201 Plan de Optimización y Mejoras de Velocidad al Imprimir

**Fecha:** 24 de Septiembre de 2026  
**Proyecto:** Migración Pallets WW (Depto 3 Wet Wipes - Kimberly Clark Planta Tlaxcala)  
**Propósito:** Análisis arquitectónico, evaluación de riesgos y hoja de ruta técnica para maximizar la velocidad de impresión USB en la aplicación Web Blazor Server.

---

## 1. Contexto y Diagnóstico Comparativo de Latencias

En una línea de producción continua de toallitas húmedas, la velocidad y confiabilidad de la impresión son factores críticos de éxito. La aplicación Legacy de escritorio (Windows Forms en .NET 2.0/3.5) generaba una percepción de "inmediatez absoluta", mientras que la versión Web Blazor Server realiza más pasos intermedios.

### Desglose de Tiempos de Respuesta: Legacy vs Web Actual

```
+───────────────────────────────────────────────────────────────────────────────────────────+
|                                COMPARATIVA DE LATENCIAS                                   |
+───────────────────────────────────────────────────────────+───────────────────────────────+
| FLUJO LEGACY WINFORMS (.NET)                              | TIEMPO ESTIMADO               |
+───────────────────────────────────────────────────────────+───────────────────────────────+
| 1. Ejecutar SP en SQL Server por ADO.NET directo          | ~25 ms                        |
| 2. Ensamblar plantilla ZPL en memoria RAM local de la PC  | ~1 ms                         |
| 3. Enviar bytes directos a winspool.drv (WritePrinter RAW)| ~3 ms                         |
| TIEMPO TOTAL PERCIBIDO POR EL OPERADOR:                   | ≈ 29 ms (Instantáneo)         |
+───────────────────────────────────────────────────────────+───────────────────────────────+

+───────────────────────────────────────────────────────────+───────────────────────────────+
| FLUJO WEB BLAZOR ACTUAL (IIS + AGENTE USB)                | TIEMPO ESTIMADO               |
+───────────────────────────────────────────────────────────+───────────────────────────────+
| 1. Enviar evento de guardado vía SignalR WebSocket a IIS  | ~10 ms                        |
| 2. Servidor IIS ejecuta SP pa_P009_01006_tblPalletsInsert | ~35 ms                        |
| 3. Servidor IIS recarga tabla y totales en memoria        | ~25 ms                        |
| 4. Servidor IIS responde a Blazor Client                  | ~15 ms                        |
| 5. Blazor Client hace SEGUNDA llamada HTTP: GetZplPallet  | ~35 ms  <-- VIAJE REDUNDANTE  |
| 6. Blazor Client recibe ZPL y hace fetch a 127.0.0.1:9100 | ~15 ms                        |
| 7. Agente PalletsPrintBridge entrega RAW a la Zebra       | ~5 ms                         |
| TIEMPO TOTAL PERCIBIDO POR EL OPERADOR:                   | ≈ 140 - 180 ms                |
+───────────────────────────────────────────────────────────+───────────────────────────────+
```

**Conclusión del Diagnóstico:**  
La diferencia perceptible de velocidad no radica en la impresora ni en el agente local, sino en el **"doble viaje de red"**: la aplicación web guarda el pallet primero y, tras recibir la confirmación, realiza una segunda petición HTTP al servidor para solicitar el texto ZPL de ese pallet.

---

## 2. Opción A (Implementada): Blindaje y Congelación de Código Frontend

Esta opción **ya fue implementada y activada** en producción como medida de protección fundamental:

### 2.1. Directiva de Código Congelado
Los archivos responsables del enlace de hardware:
- `PalletsWW_PC.Web/wwwroot/js/zebra-print.js`
- `PalletsWW_PC.Web/Models/Dtos/ZebraDtos.cs`

Quedan formalmente declarados como **código congelado**. Está estrictamente prohibido modificarlos durante iteraciones de diseño gráfico, colores, márgenes, padding o tipografía.

### 2.2. Pre-chequeo Automatizado en Despliegues (`Publicar_Web_IIS_Blindado.ps1`)
Se incorporó el script maestro de publicación que ejecuta:
1. `node -c zebra-print.js`: Valida la sintaxis JavaScript antes de tocar IIS. Si existe el más mínimo error de sintaxis (comas, llaves o comillas rotas), **la publicación se aborta de inmediato**.
2. Compilación estricta en Release (0 errores).
3. Publicación limpia en IIS (`C:\PublishIIS\PalletsWW_PC.Blazor.Publish\` y `Api.Publish\`).
4. Reciclaje automático del Application Pool.

---

## 3. Opción B (Planificada): Optimización del Payload Unificado

### 3.1. En qué consiste la mejora
Eliminar el segundo viaje HTTP hacia el servidor IIS unificando la respuesta del guardado:
- Actualmente: `POST /api/pallets` retorna `{ exitoso: true, idtblPallets: 102540 }`.
- Optimización: `POST /api/pallets` ejecuta el SP e inmediatamente en el mismo hilo del servidor genera la plantilla ZPL, retornando:
  ```json
  {
    "exitoso": true,
    "idtblPallets": 102540,
    "zpl": "^XA^FO50,50^ADN,36,20^FD...^FS^XZ",
    "mensaje": "Pallet guardado correctamente"
  }
  ```

### 3.2. Beneficio de Rendimiento
- **Ahorro neto de tiempo:** Entre **40 y 70 milisegundos por tarima**.
- **Latencia total estimada:** Reducción de $\approx 160\text{ ms}$ a menos de $\approx 80\text{ ms}$.

### 3.3. Análisis de Riesgos y Mitigación
- **Nivel de Riesgo:** **Extremadamente Bajo (5%)**.
- **Mecanismo de Seguridad (Fallback Defensivo):**
  En el frontend, la lógica se diseña con tolerancia a fallos:
  ```csharp
  string zplParaImprimir = res.Zpl;
  if (string.IsNullOrWhiteSpace(zplParaImprimir))
  {
      // Fallback de contingencia: si por alguna razón el backend no incluyó el ZPL,
      // se consulta por la vía tradicional sin interrumpir la operación.
      zplParaImprimir = await _reporteService.GenerarZplPalletAsync(res.IdtblPallets);
  }
  await ImprimirZplEnZebraLocalAsync(zplParaImprimir);
  ```

---

## 4. Opción C (Analizada y Descartada): Impresión Asíncrona Inmediata

### 4.1. Concepto Evaluado
Disparar la orden hacia el puerto USB local "en segundo plano" (fire-and-forget) antes de que la pantalla termine de refrescar la tabla y calcular los totales.

### 4.2. Por qué se DESCARTA por Seguridad Industrial
Aunque esta técnica ahorraría otros 30 milisegundos visuales, introduce tres riesgos inaceptables en una planta de manufactura continua:

1. **Pérdida de Visibilidad Inmediata de Fallas:**  
   Si el operador presiona Enter y el cursor se libera instantáneamente mientras la impresión corre en segundo plano a ciegas, el operador comenzará a capturar el siguiente pallet. Si la impresora se quedó sin papel, tiene el cabezal abierto o el cable USB está flojo, el operador no lo notará a tiempo y capturará pallets sobre etiquetas que nunca se imprimieron físicamente.
2. **Riesgo de Traslape de Etiquetas en Captura Rápida:**  
   En momentos de alta velocidad o captura por lotes, enviar múltiples llamadas asíncronas no secuenciales al puerto RAW de Windows puede provocar colisiones o alteración en el orden de las etiquetas físicas que salen de la máquina.
3. **Principio Industrial:**  
   Esperar la confirmación del puerto USB ($\approx 50\text{ ms}$) es una **garantía de certeza operativa**, no un defecto del sistema.

---

## 5. Hoja de Ruta y Recomendación de Implementación

### Fase 1: Estabilización en Piso (EN CURSO)
- Operar la aplicación tal como se encuentra desplegada hoy.
- Evaluar la experiencia del operador con las mejoras ergonómicas ya activas:
  - Foco automático inmediato en la hora del pallet (`Enter` $\rightarrow$ cursor listo para la siguiente tarima).
  - Eliminación de clicks con el ratón.
  - Blindaje de máquina (Triple Candado).

### Fase 2: Criterio de Activación de la Opción B
- Si tras 2 o 3 semanas de operación continua los supervisores o el área de producción solicitan mayor agilidad en la salida de la etiqueta, se programará la **Opción B (Payload Unificado)**.
- Se realizarán pruebas previas en el ambiente de desarrollo y se desplegará mediante el script blindado `Publicar_Web_IIS_Blindado.ps1`.
