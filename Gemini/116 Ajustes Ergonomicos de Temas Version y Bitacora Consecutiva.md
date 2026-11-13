# 116 Ajustes Ergonómicos de Temas, Visibilidad de Versión, Verificación de Instalador y Bitácora Consecutiva

> **Documento Oficial de Memoria Técnica y Control de Cambios**  
> **Ubicación:** `C:\AI\Git Hub\clsA_P035_PallestWipes\PalletsWW_PC_sln\Gemini\116 Ajustes Ergonomicos de Temas Version y Bitacora Consecutiva.md`  
> **Codificación:** UTF-8 con BOM (`\uFEFF`)  
> **Versión del Sistema Resultante:** **Versión 13** (Web SPA) / **v1.0.2** (Instalador Cliente)  
> **Fecha:** 13 de Noviembre de 2026  

---

## 1. Resumen Ejecutivo de la Solicitud

A petición expresa de la operación de planta, se ejecutaron las siguientes mejoras funcionales, estéticas y normativas:
1. **Selector de Temas Ergonómico:** Ampliar el área visible del menú desplegable de temas en la barra lateral para proyectar **10 temas simultáneos** antes de requerir scroll vertical.
2. **Eliminación de Selectores Duplicados:** Verificar que no existan selectores de temas en la cabecera del cockpit de captura, manteniendo como punto único oficial el selector de la barra lateral.
3. **Visibilidad en Gran Formato del Número de Versión:** Incrementar el tamaño tipográfico y contraste del número de versión en el pie del sidebar para facilitar su lectura a distancia en las pantallas industriales de piso.
4. **Verificación Integral del Instalador de Terminales:** Comprobar que los ajustes realizados a la resolución dinámica de la IP de IIS (`InstallerEngine.cs` y `MainForm.cs`) y la comunicación del microservicio `PalletsPrintBridge` operen sin fallas ni regresiones.
5. **Estandarización de Bitácora Consecutiva en `AGENTS.md`:** Incorporar como directiva inviolable la generación de documentos técnicos consecutivos (`Gemini/116 X.md`, `117 X.md`, etc.) ante cada instrucción del chat.
6. **Publicación Oficial y Salto de Versión:** Desplegar en IIS con incremento de versión (+1) a **`Versión 13`**.

---

## 2. Acciones Técnicas Realizadas

### 2.1. Selector de Temas con Visualización de 10 Temas en Pantalla
* **Archivo modificado:** `src/PalletsWW_PC.Web/src/components/layout/Sidebar.tsx`
* **Diagnóstico previo:** El contenedor emergente del selector de temas empleaba `max-h-72` (288 px), lo que permitía visualizar únicamente entre 7 y 8 opciones antes de requerir desplazamiento.
* **Solución aplicada:** Se ajustó la altura máxima a `max-h-[440px]`, permitiendo que con el tamaño de botón de ~40 px y espaciado de 4 px (`space-y-1`), exactamente **10 temas** sean visibles de manera inmediata, dejando las 5 opciones restantes accesibles mediante scroll suave.
* **Verificación de duplicidad:** Se auditó `CockpitHeader.tsx` y `CapturaPage.tsx` certificando que no existe ningún botón redundante de temas en la vista de captura. El único punto de control es el selector de la barra lateral.

### 2.2. Número de Versión en Gran Formato y Alto Contraste
* **Archivo modificado:** `src/PalletsWW_PC.Web/src/components/layout/Sidebar.tsx`
* **Diseño ergonómico:**
  * Se sustituyó la tipografía discreta por una composición en gran escala:
    * Etiqueta: `Versión` en `text-sm font-extrabold text-white`.
    * Dígito: `13` en `text-xl font-black text-cyan-400` con filtro de brillo neón `drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]`.
  * En modo colapsado (`isCollapsed`), se implementó una cápsula distintiva en `text-xs font-black text-cyan-300 bg-cyan-950/80` con borde cian neón.
  * Se conservó el botón interactivo para desplegar y ocultar el panel de novedades de la versión.

### 2.3. Auditoría y Verificación del Instalador del Cliente
* **Proyectos revisados y compilados:**
  * `src/PalletsWW_ClientSetup/PalletsWW_ClientSetup.csproj` (Actualizado a versión `1.0.2`).
  * `src/PalletsPrintBridge/PalletsPrintBridge.csproj` (Microservicio RAW Zebra).
* **Puntos clave validados:**
  * **Conmutación de Servidor IIS:** El instalador resuelve adecuadamente la IP ingresada por el usuario (ej. `10.26.24.31`) y genera los accesos directos de Edge `--app=http://<IP>:5106/` con soporte universal para Windows 10 LTSC y Windows 11.
  * **Microservicio Zebra:** Compilado como ejecutable auto-contenido `win-x64` y colocado en la carpeta `Payload/` del instalador.
  * **Compilación:** Ambos proyectos compilaron con **0 errores y 0 advertencias**.

### 2.4. Estandarización de Bitácora Consecutiva en `AGENTS.md`
* **Archivo modificado:** `AGENTS.md` (Sección 6)
* **Regla institucional incorporada:**
  1. `Gemini/000 Prompts.md` se reserva de forma estricta para registrar las peticiones sintetizadas y ortográficamente corregidas con la referencia al documento técnico asociado.
  2. Cada intervención genera obligatoriamente un archivo consecutivo (`116 X.md`, `117 X.md`, etc.) con el desglose técnico, análisis, justificación y bitácora de compilación.

---

## 3. Matriz de Versiones y Despliegue en Producción

| Componente | Versión Anterior | Versión Nueva | Destino en Servidor IIS |
| :--- | :--- | :--- | :--- |
| **Frontend Web SPA** | Versión 12 | **Versión 13** | `C:\PublishIIS\PalletsWW_PC_React.Publish` |
| **Backend Web API** | .NET 8 LTS | **.NET 10 LTS** | `C:\PublishIIS\PalletsWW_PC.Api.Publish` |
| **Instalador Cliente** | v1.0.1 | **v1.0.2** | `C:\PublishIIS\PalletsWW_PC_React.Publish\Setup_PalletsWW_Cliente.exe` |

---

## 4. Validación de Integridad y Código

1. **Frontend:** `tsc -b && vite build` ejecutado con **0 errores**.
2. **Backend:** `dotnet publish -c Release` ejecutado en .NET 10 LTS con **0 errores**.
3. **Instalador:** `dotnet publish -c Release -r win-x64` completado con éxito.
4. **Codificación:** Todos los archivos creados y editados fueron verificados con **UTF-8 con BOM** (`\uFEFF`).

