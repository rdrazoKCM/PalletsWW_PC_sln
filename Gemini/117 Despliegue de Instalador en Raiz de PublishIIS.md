# 117 Despliegue del Instalador en la Raíz de PublishIIS

> **Documento Oficial de Memoria Técnica y Control de Cambios**  
> **Ubicación:** `C:\AI\Git Hub\clsA_P035_PallestWipes\PalletsWW_PC_sln\Gemini\117 Despliegue de Instalador en Raiz de PublishIIS.md`  
> **Codificación:** UTF-8 con BOM (`\uFEFF`)  
> **Archivo Desplegado:** `C:\PublishIIS\Setup_PalletsWW_Cliente.exe`  
> **Versión del Instalador:** **v1.0.2** (`1.0.2.0`)  
> **Fecha:** 13 de Noviembre de 2026  

---

## 1. Resumen Ejecutivo de la Solicitud

El usuario requirió ubicar el instalador oficial compilado del cliente (`Setup_PalletsWW_Cliente.exe`) directamente en el directorio raíz de publicaciones del servidor IIS:
* **Ruta solicitada:** `C:\PublishIIS\Setup_PalletsWW_Cliente.exe`
* **Propósito industrial:** Homologar la distribución del instalador con el resto de aplicaciones de planta que comparten ese directorio raíz (ej. `Setup_PalletsPanal_Cliente.exe`, `Setup_EmbarquesPanal_Cliente.exe`, `Setup_SupervisoryPanal_Cliente.exe`), facilitando a los administradores de sistemas el copiado manual o mediante carpetas compartidas de red hacia las terminales cliente de los operadores.

---

## 2. Acciones Ejecutadas

### 2.1. Copiado del Binario v1.0.2 a la Raíz de IIS
* Se copió el ejecutable auto-contenido `win-x64` desde el directorio de publicación staging hacia la raíz de `C:\PublishIIS`:
  * **Origen:** `src\PalletsWW_ClientSetup\bin\Publish\Setup_PalletsWW_Cliente.exe`
  * **Destino:** `C:\PublishIIS\Setup_PalletsWW_Cliente.exe`
  * **Tamaño:** 230,050,906 bytes (~219.3 MB)
  * **Información de versión certificada:**
    * `FileVersion:` **1.0.2.0**
    * `ProductVersion:` **1.0.2**
    * `Description:` Setup_PalletsWW_Cliente (Pallets Wet Wipes)

### 2.2. Automatización en el Script de Publicación Oficial
* **Archivo modificado:** `scripts/Publicar_PalletsWW.ps1`
* **Ajuste aplicado:** Se integró la copia directa tanto en el paso de compilación del instalador (`-BuildInstaller`) como en el paso de despliegue web, garantizando que ante cualquier ejecución de publicación futura, el instalador siempre se sincronice automáticamente en:
  1. `C:\PublishIIS\Setup_PalletsWW_Cliente.exe` (Raíz del servidor para administradores de TI).
  2. `C:\PublishIIS\PalletsWW_PC_React.Publish\Setup_PalletsWW_Cliente.exe` (Servidor Web estático).
  3. `src\PalletsWW_PC.Web\public\Setup_PalletsWW_Cliente.exe` (Descarga directa desde el navegador).

### 2.3. Actualización de Directivas en `AGENTS.md`
* Se actualizó la regla de publicación en [AGENTS.md](file:///c:/AI/Git%20Hub/PalletsWW_PC_sln/AGENTS.md#L30) para dejar explícito que el instalador de terminales debe mantenerse siempre en la raíz de `C:\PublishIIS\`.

---

## 3. Verificación de Integridad

* **Validación de Archivo:** Se ejecutó `(Get-Item 'C:\PublishIIS\Setup_PalletsWW_Cliente.exe').VersionInfo` comprobando que el hash y la versión corresponden exactamente a la última compilación.
* **Codificación:** Archivo generado con **UTF-8 con BOM** (`\uFEFF`).
