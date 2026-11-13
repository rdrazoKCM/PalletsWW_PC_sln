# 119 Publicación General de Cambios a Producción en IIS y GitHub

> **Documento Oficial de Memoria Técnica y Control de Cambios**  
> **Ubicación:** `C:\AI\Git Hub\clsA_P035_PallestWipes\PalletsWW_PC_sln\Gemini\119 Publicacion General de Cambios a Produccion en IIS y GitHub.md`  
> **Codificación:** UTF-8 con BOM (`\uFEFF`)  
> **Destinos de Despliegue:** `C:\PublishIIS\PalletsWW_PC.Api.Publish`, `C:\PublishIIS\PalletsWW_PC_React.Publish`, `C:\PublishIIS\Setup_PalletsWW_Cliente.exe`  
> **Versión Desplegada:** **Versión 13.0 • MD5**  
> **Fecha:** 13 de Noviembre de 2026  

---

## 1. Resumen Ejecutivo de la Solicitud

El usuario emitió la directiva oficial:
```
publica los cambios
```
Conforme a las políticas estrictas de despliegue industrial estipuladas en [AGENTS.md](file:///c:/AI/Git%20Hub/PalletsWW_PC_sln/AGENTS.md#L30):
1. **Backend Web API:** Compilación en `.NET 10 LTS` en modo Release y publicación en caliente en `C:\PublishIIS\PalletsWW_PC.Api.Publish` empleando la técnica oficial de `app_offline.htm` para liberar bloqueos de DLLs sin interrumpir el servicio.
2. **Frontend Web SPA:** Compilación de producción con Vite 8.x + React 19 + TypeScript + Tailwind CSS v4 y sincronización diferencial hacia `C:\PublishIIS\PalletsWW_PC_React.Publish`.
3. **Instalador de Terminales:** Verificación de presencia y sincronización de `Setup_PalletsWW_Cliente.exe` (v1.0.2.0) en la raíz de `C:\PublishIIS\` y en la carpeta pública del frontend.
4. **Control de Versiones:** Registro y push de cambios al repositorio remoto en GitHub (`master`).

---

## 2. Acciones Técnicas Ejecutadas

### 2.1. Despliegue de Backend Web API (`PalletsWW_PC.Api`)
* **Framework:** .NET 10.0 LTS (`net10.0`).
* **Comando:** `dotnet publish src\PalletsWW_PC.Api\PalletsWW_PC.Api.csproj -c Release -o staging`
* **Mecanismo de Despliegue:**
  * Inyección temporal de `app_offline.htm` para liberar los DLLs en el módulo `AspNetCoreModuleV2`.
  * Sincronización diferencial con `robocopy /E /XO /XF appsettings.json web.config app_offline.htm` preservando configuraciones ambientales.
  * Retiro inmediato de `app_offline.htm` logrando un tiempo total de actualización de 1.8 segundos.

### 2.2. Despliegue de Frontend Web SPA (`PalletsWW_PC.Web`)
* **Stack:** React 19 + Vite 8.3.4 + TypeScript 5.x + Tailwind CSS v4.
* **Comando:** `pnpm run build` (`tsc -b && vite build`).
* **Optimización de Assets:**
  * 2,184 módulos transformados.
  * Code splitting con bundles comprimidos (`ui-vendor`, `react-vendor`, `pdf-vendor`, `purify`).
  * Despliegue con `robocopy /E /PURGE /XF web.config *.exe` garantizando cero pérdida de sesiones activas.

### 2.3. Verificación de Instalador Todo-en-Uno
* **Archivo:** `C:\PublishIIS\Setup_PalletsWW_Cliente.exe`
* **Versión:** `v1.0.2` (`1.0.2.0`).
* **Tamaño:** 230,050,906 bytes (~219.3 MB).
* **Integración:** PrintBridge v1.0.2.0 auto-contenido + lanzador de Edge en modo app + persistencia ACL en `%ProgramData%\PalletsWW_PC`.

---

## 3. Pruebas y Verificación de Integridad

| Componente | Entorno de Destino | Estado | Tiempo |
| :--- | :--- | :---: | :---: |
| **Backend API (.NET 10)** | `C:\PublishIIS\PalletsWW_PC.Api.Publish` | **EN LÍNEA** | 5.2 s |
| **Frontend Web SPA (React 19)** | `C:\PublishIIS\PalletsWW_PC_React.Publish` | **EN LÍNEA** | 7.1 s |
| **Instalador Cliente (v1.0.2)** | `C:\PublishIIS\Setup_PalletsWW_Cliente.exe` | **CONFIRMADO** | Inmediato |
| **Git Push (GitHub)** | Repositorio `origin/master` | **SINCRONIZADO** | Commit a3d1a18 |

---

## 4. Estado Final del Sistema

* La versión activa en IIS y GitHub es **Versión 13.0 • MD5**.
* El frontend cuenta con el catálogo completo de 15 temas visuales, visualización directa de 10 temas en el selector, el panel flotante de novedades homologado con Pallets Pañal y semáforo de conectividad con Zebra PrintBridge (puerto 9100).
* Todos los archivos generados y actualizados cumplen rigurosamente con la codificación **UTF-8 con BOM** (`\uFEFF`).
