# 300 - Guía Operativa: Control de Versiones y Sincronización en Red con Git

---

## 1. Objetivo y Arquitectura de Git en Red

Este documento describe el procedimiento estándar para respaldar, sincronizar y compartir los cambios de los proyectos **Pallets WW** y **Pallets Pañal** a través del servidor local de planta.

### Topología de Red
* **Servidor Central de Git (Intranet):** \\10.26.24.31\Git\
  * Repositorio Pallets WW: \\10.26.24.31\Git\PalletsWW_PC_sln
  * Repositorio Pallets Pañal: \\10.26.24.31\Git\PalletsPañal_PC_sln
* **Estaciones de Desarrollo / Clientes:** Laptops y PCs de piso de planta (NEXUS-LAP, DESKTOP-CA2BJ3K, etc.).

---

## 2. ¿Por qué el Servidor tiene un Repositorio Bare?

A diferencia de tu carpeta local de trabajo (donde ves .sln, .cs, .tsx), en el servidor \\10.26.24.31\Git\ el repositorio se encuentra en formato **Bare** (--bare):
* **Solo almacena la base de datos de Git:** Contiene carpetas como objects/, efs/, HEAD, config.
* **Evita bloqueos de archivo:** Si el servidor tuviera los archivos de código sueltos abiertos por Windows o IIS, Git bloquearía los push de los programadores.
* **Múltiples desarrolladores:** Permite que cualquier PC de la planta envíe (push) o reciba (pull) cambios concurrentemente sin conflictos de sistema de archivos.

---

## 3. Preparación de una Nueva PC Cliente (Resolución de Dubious Ownership)

Al clonar un repositorio desde un recurso compartido de red en Windows por primera vez, Git genera por seguridad el siguiente error:

`plaintext
fatal: detected dubious ownership in repository at '\\10.26.24.31\Git\PalletsWW_PC_sln'
`

### Causa
El usuario de Windows del servidor (SID ...1001) difiere del usuario local de la máquina cliente (ej. DESKTOP-CA2BJ3K\M22142).

### Solución Definitiva (Ejecutar en PowerShell una sola vez por PC)
Ejecuta los siguientes comandos para autorizar las rutas del servidor central:

`powershell
# Autorizar todos los repositorios compartidos del servidor 10.26.24.31
git config --global --add safe.directory "%(prefix)///10.26.24.31/Git/*"
git config --global --add safe.directory "\\10.26.24.31\Git\*"
git config --global --add safe.directory "*"
`

---

## 4. Cómo Descargar (Clonar) el Proyecto en una Nueva PC

Una vez configurada la excepción de seguridad:

### Para Pallets WW:
`powershell
git clone "\\10.26.24.31\Git\PalletsWW_PC_sln"
`

### Para Pallets Pañal:
`powershell
git clone "\\10.26.24.31\Git\PalletsPañal_PC_sln"
`

Git reconstruirá instantáneamente todos los archivos de la solución (.sln), código fuente, scripts y documentación en la carpeta local.

---

## 5. Procedimiento Estándar para Subir Cambios (Commit y Push)

Cada vez que realices cambios o mejoras en tu código local, sigue este flujo:

### Paso 1: Revisar qué archivos modificaste
`powershell
git status
`
* Asegúrate de que los archivos mostrados sean los correctos.
* Gracias al .gitignore configurado, los binarios pesados (.exe de más de 100 MB), dependencias (
ode_modules/) y carpetas temporales (in/, obj/, .vs/) se ignoran automáticamente.

### Paso 2: Preparar los archivos para el commit
`powershell
git add .
`

### Paso 3: Confirmar los cambios con un mensaje claro
`powershell
git commit -m "feat: descripcion clara de la mejora o correccion realizada"
`

### Paso 4: Enviar los cambios al Servidor Central

* **En Pallets WW:**
  `powershell
  git push server master
  `
  *(O git push origin master si tu remoto principal es origin).*

* **En Pallets Pañal:**
  `powershell
  git push origin master
  `

---

## 6. Procedimiento para Recibir los Últimos Cambios (Pull)

Antes de empezar a programar en el día a día, o para sincronizar cambios hechos desde otra PC:

`powershell
# En Pallets WW:
git pull server master

# En Pallets Pañal:
git pull origin master
`

---

## 7. Comandos de Diagnóstico Rápido

| Comando | Función |
| :--- | :--- |
| git status | Muestra archivos pendientes de guardar o confirmar |
| git log -n 5 --oneline | Muestra los últimos 5 commits de la rama actual |
| git remote -v | Muestra a qué rutas de red o GitHub apunta tu repositorio local |
| git diff | Muestra las líneas exactas que cambiaron antes del commit |

---

## 8. Políticas y Buenas Prácticas del Repositorio

1. **Exclusión de Binarios Grandes:** Nunca desactives las reglas del .gitignore para archivos .exe, .msi o 
ode_modules/. Los instaladores se compilan bajo demanda mediante sus respectivos scripts en scripts/.
2. **Mensajes Atómicos:** Haz commits pequeños y descriptivos (ej. ix(impresion): correccion de timeout en socket zebra o eat(reporte): exportacion a excel).
3. **Codificación:** Todo archivo nuevo .md, .cs, .vb o .ps1 debe mantenerse en **UTF-8 con BOM** para evitar problemas de compatibilidad en Windows.