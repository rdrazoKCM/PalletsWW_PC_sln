# Directivas del Proyecto: PalletsWW_PC_sln (Pallets Wipes PC)

> **Documento Oficial de Reglas, Arquitectura y Memoria Técnica para Agentes de IA**  
> **Ubicación:** Raíz del Repositorio (`C:\AI\Git Hub\clsA_P035_PallestWipes\PalletsWW_PC_sln\AGENTS.md`)  
> **Codificación Obligatoria:** **UTF-8 con BOM** en todos los archivos generados o modificados.  
> **Estándar Arquitectónico Base:** Homologado estrictamente con **MD5 (Manufactura Digital 5.0 - Kimberly-Clark)** y la arquitectura de ultra alto desempeño de **Pallets Pañal PC**.

---

## 1. Misión del Proyecto

Migrar y modernizar el Frontend de la aplicación de **Pallets Wipes (Pallets WW)** desde su arquitectura actual en **Blazor Server** hacia una plataforma desacoplada de ultra alto desempeño en **React 19 SPA (Single Page Application)**, erradicando los retrasos provocados por la latencia de la red de planta:
1. **Frontend Web SPA (`src/PalletsWW_PC.Web`):** React 19 + TypeScript + Vite + Tailwind CSS v4, ejecutándose directamente en la memoria del navegador de la PC cliente.
2. **Backend API REST (`src/PalletsWW_PC.Api`):** ASP.NET Core Web API en C# (.NET 8 LTS) con micro-ORM Dapper y la librería oficial `Kcc.Infrastructure.Sql`, ejecutando Stored Procedures nativos en SQL Server.
3. **Inyección ZPL Ultra Rápida (< 120 ms):** Enviar el código ZPL devuelto por la API directamente desde React hacia el microservicio local Zebra (`http://127.0.0.1:9100/print`) en el milisegundo cero, sin intermediación de WebSockets en el servidor IIS.
4. **Instalador de Terminales (`Setup_PalletsWW_Cliente.exe`):** Empaquetador multi-usuario con permisos ACL en `%ProgramData%` y ejecución en modo aplicación de Edge (`--app`).

---

## 2. Reglas Estrictas de Codificación e Integridad

1. **Codificación:** Todo archivo creado o editado (`.md`, `.ts`, `.tsx`, `.cs`, `.css`, `.sql`, `.ps1`, `.iss`, `.json`) debe guardarse **estrictamente en UTF-8 con BOM** (`\uFEFF`).
2. **Cero Suposiciones en Producción:** No modificar esquemas, tablas ni procedimientos almacenados en SQL Server sin análisis forense previo, validación y respaldo.
3. **No Romper la Impresión Zebra:** La comunicación con impresoras térmicas es crítica. No alterar la inyección ZPL ni los parámetros de cabezal sin pruebas exhaustivas.
4. **Política Estricta de Publicación (Solo por Instrucción Expresa):** No compilar a producción (`dotnet publish`, `C:\PublishIIS\...` ni instalador) en cambios menores. Se publica **ÚNICAMENTE** cuando el usuario lo solicite expresamente en el chat (ej. *"publica los cambios"*).

---

## 3. Reglas de Negocio Específicas de Planta Wipes (Diferencias Críticas vs Pañal)

El agente debe prestar especial atención a las reglas operativas de Wipes que **NO deben alterarse**:

1. **1 PC Compartida para 2 Líneas de Producción:**  
   A diferencia de Pañal (que tiene 1 PC por línea), en Wipes **una sola PC atiende 2 líneas de empaque**.  
   * **Requisito Inviolable:** La interfaz debe incluir el **selector manual de Línea 1 y Línea 2** en la barra de captura para que el operador indique qué línea está empacando la tarima.
2. **Hora Manual con Candado Anti-Duplicidad:**  
   * En Wipes la hora de producción se captura de forma **MANUAL** con formato `HH:mm`.  
   * **Regla de Negocio:** Se permite registrar dos tarimas a la misma hora **únicamente si la Línea de Empaque es diferente**. Si coinciden Vale + Turno + Hora + Misma Línea, SQL Server arroja alerta de duplicidad.
3. **Límite de 38 Tarimas por Vale Físico:**  
   * En Wipes el tope máximo industrial estricto es de **38 tarimas por vale físico** (a diferencia de Pañal, donde el límite es 25). Tanto el frontend como el backend deben validar este tope.
4. **Captura Individual Tarima por Tarima (1 a 1):**  
   * La captura se realiza exclusivamente tarima individual (1 a 1) en la fila de captura rápida, idéntico al flujo ergonómico de Pallets Pañal (sin módulo de lotes).
5. **Catálogo de Máquinas Wipes:**  
   * Máquinas oficiales: **TXWW1** (9), **TXWW2** (16), **TXWW3** (53), **TXWW4** (54), **TXWW5** (55), **TXWW6** (67) y **TXWW7** (70).
6. **Bases de Datos y Stored Procedures:**  
   * Base de datos principal de pallets: **`TLX022MXDB`** (en lugar de `TLX018MXDB`).
   * SP oficial de inserción: **`pa_P009_01006_tblPalletsInsertcmdV9`**.
   * SP de vales activos: **`pa_P009_01002_ConsultaValesProduccionTurno`**.
   * SP de consulta de pallets: **`pa_P009_01001_tblPallets`**.

---

## 4. Stack Tecnológico Homologado (Estándar MD5 Kimberly-Clark)

### 4.1. Frontend Web SPA (`src/PalletsWW_PC.Web`)
* **Librería UI:** **React 19.2+** (`react`, `react-dom`).
* **Lenguaje:** **TypeScript ~5.x / 6.0** con tipado estricto (`tsc -b`).
* **Bundler & Build Tool:** **Vite 8.x** (`@vitejs/plugin-react`).
* **Gestor de Paquetes:** **`pnpm`** obligatorio (`pnpm-lock.yaml`).
* **Estilos:** **Tailwind CSS v4** (`@tailwindcss/vite`) configurado en `src/index.css`.
* **Iconografía y Alertas:** `lucide-react`, `sweetalert2`.
* **Código Base de Referencia:**  
  Utilizar la arquitectura y componentes visuales ya probados en:  
  📁 `c:\AI\Git Hub\PalletsPañal_PC_sln\src\PalletsPanal.Web\`

### 4.2. Matriz de Puertos Oficiales
* **`5001`**: API Recepción de Producto Terminado (Almacén).
* **`5002`**: Web Recepción de Producto Terminado (Almacén).
* **`5003`**: API Pallets Pañal.
* **`5004`**: Web Pallets Pañal.
* **`5005`**: API Pallets Wipes (`PalletsWW_PC.Api`).
* **`5006`**: Web Pallets Wipes (`PalletsWW_PC.Web`).
* **`9100`**: Microservicio Local Zebra PrintBridge (en la PC del operador).

---

## 5. Arquitectura de Desempeño: Por qué React es 10x más rápido en Red Lenta

1. **Eliminación del Cuello de Botella de Blazor Server:**  
   * En Blazor Server, cada clic viajaba por WebSocket de la PC al servidor IIS, y la orden de impresión regresaba por WebSocket de IIS a la PC para invocar JavaScript. Con red lenta, este doble viaje acumulaba entre **800 ms y 1,500 ms**.
2. **Flujo Atómico en React SPA (< 120 ms):**  
   * React ejecuta la pantalla localmente a 60 FPS en la PC del operador.
   * Al dar clic en "Guardar", emite 1 sola petición HTTP normal al Backend API.
   * El Backend ejecuta el SP V9 en SQL Server, calcula el ZPL y lo entrega en la misma respuesta JSON.
   * En cuanto React recibe la respuesta en la PC, inyecta el ZPL a `http://127.0.0.1:9100/print` en **0.5 ms**.
   * **Resultado:** La etiqueta sale físicamente de la Zebra en **~120 milisegundos**.

---

## 6. Estándar de Documentación y Bitácora de Prompts

1. **`Gemini/000 Prompts.md`:**  
   * Bitácora cronológica con encabezados `# <Número de 3 Dígitos> <Título>`.
   * Contiene **únicamente** la petición del usuario sintetizada y con ortografía corregida.
   * Sin detalles de código ni volcados técnicos.
2. **Archivos Temáticos en `Gemini/`:**  
   * Todo plan de arquitectura, optimización o migración debe documentarse en archivos dedicados (ej. `Gemini/115 Plan de Migracion de Blazor a React 19.md`).
