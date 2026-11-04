# 106. Arquitectura Multi-Usuario (Toda la PC) y Compatibilidad de Anclaje Win 10 / Win 11

## 1. Contexto Operativo en Piso de Producción
En las computadoras cliente de planta (e.g. Departamento 3 Wet Wipes):
- **Usuario Operador:** Cuenta restringida sin acceso a Explorador de archivos ni al Escritorio de Windows. El operador interactúa exclusivamente con los iconos **fijados en la Barra de Tareas** o con aplicaciones que inicien automáticamente.
- **Usuario Administrador:** Cuenta utilizada por Sistemas/Mantenimiento para configurar la PC, instalar software y enrolar terminales.
- **Parque de Equipos:** Coexistencia de equipos con **Windows 10** y equipos modernos con **Windows 11**.

---

## 2. Diferencias Técnicas entre Windows 10 y Windows 11 para la Barra de Tareas

| Característica | Windows 10 | Windows 11 |
| :--- | :--- | :--- |
| **Arquitectura de Barra** | Shell clásico Win32 | XAML / WinUI aislado |
| **Inyección por Script** | Permitida (`User Pinned\TaskBar` + Shell Verbs) | **Bloqueada por seguridad de Microsoft** para evitar que malware/adware se auto-anclen sin consentimiento visual |
| **Método Oficial de Microsoft** | Invocación de Verbo COM o Layout XML | `LayoutModification.xml` (Perfil base) o Anclaje Interactivo |

---

## 3. Solución Integral Implementada en el Instalador (`Instalar_PC_Cliente.ps1`)

Para garantizar una instalación rápida, certera y 100% libre de frustración en ambas versiones de Windows, se diseñó una **Estrategia Triple de Alta Confiabilidad**:

### A. Para Equipos con Windows 10
El script ejecuta automáticamente el verbo nativo de Shell:
```powershell
$verb = $item.Verbs() | Where-Object { $_.Name -match 'Anclar a la barra de tareas|Pin to taskbar' }
$verb.DoIt()
```
Esto deja el icono **inmediatamente clavado en la barra de tareas de Windows 10** de forma 100% desatendida.

### B. Auto-Arranque de Terminal para el Operador (Válido para Win 10 y Win 11)
Para resolver de raíz la restricción de que el Operador no tiene acceso al Escritorio:
- El instalador registra el acceso directo de **Pallets WW** en la carpeta de inicio global de la máquina:  
  `C:\ProgramData\Microsoft\Windows\Start Menu\Programs\Startup\Pallets WW App.lnk`
- **Resultado Operativo:** Cuando el operador enciende la computadora o inicia sesión, **la aplicación Pallets WW se abre automáticamente a pantalla completa**. El operador no tiene que buscar ningún icono ni dar ningún clic previo.

### C. Despliegue de `LayoutModification.xml`
Se inyecta el esquema de layout oficial corporativo en:
- `C:\Users\Default\AppData\Local\Microsoft\Windows\Shell\LayoutModification.xml`
- `C:\Users\<Usuario>\AppData\Local\Microsoft\Windows\Shell\LayoutModification.xml`

### D. Asistente Visual Inmediato para Windows 11
Al terminar la instalación en Windows 11:
1. El instalador detecta `Build >= 22000`.
2. **Abre la ventana de Pallets WW automáticamente en pantalla**, haciendo que el icono aparezca de inmediato en la barra de tareas.
3. Despliega un aviso claro en color amarillo:  
   *Solo dé 1 Clic Derecho sobre el icono abierto en la barra -> 'Anclar a la barra de tareas'.*

---

## 4. Diagnóstico y Corrección de Visibilidad en Menú Inicio para el Operador

### Diagnóstico de Causa Raíz:
1. **Falta de CommonPrograms en el instalador:**  
   Previamente, el script creaba el acceso en CommonDesktop (por eso apareció en el Escritorio), pero en el Menú Inicio intentaba escribir directamente en C:\Users\Operador\AppData\Roaming\Microsoft\Windows\Start Menu\Programs. Debido a que Windows restringe el acceso de una cuenta a la carpeta AppData de otra, la copia fallaba silenciosamente y el buscador de Windows en la cuenta Operador no encontraba nada.
2. **Ciclo de vida de la carpeta Startup en Windows:**  
   La carpeta de inicio automático de Windows (Startup) **solo se ejecuta en el evento de inicio de sesión (Logon)**. Si el usuario Operador ya tenía su sesión abierta en memoria y solo se utilizó la función "Cambiar de usuario" (Switch User), Windows no vuelve a ejecutar los elementos de inicio; se requiere **Cerrar Sesión (Sign out)** e **Iniciar Sesión (Sign in)**.

### Correcciones Aplicadas:
1. **Inyección en CommonPrograms (C:\ProgramData\Microsoft\Windows\Start Menu\Programs):**  
   Esta es la carpeta universal del Menú Inicio de Windows. Cualquier acceso directo colocado aquí es indexado de inmediato por Windows Search para **TODOS los usuarios** del equipo sin restricciones de permisos.
2. **Auto-Elevación UAC en INSTALAR_AQUI_1_CLIC.bat:**  
   Se incorporó comprobación automática de permisos de Administrador (
et session). Si se ejecuta con un doble clic simple, solicita elevación para tener privilegios de escritura en las carpetas públicas de Windows.
3. **Inyección en CommonStartup:**  
   El acceso directo de Pallets WW se colocó en CommonStartup para que cuando el Operador inicie sesión, la app abra automáticamente a pantalla completa.
