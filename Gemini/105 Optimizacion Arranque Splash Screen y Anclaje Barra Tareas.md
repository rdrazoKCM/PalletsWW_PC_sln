# 105 Optimización de Arranque, Pantalla de Carga (Splash Screen) y Anclaje en Barra de Tareas

## 1. Contexto y Casos Observados en Pruebas de Planta

Durante las pruebas operativas de captura de pallets en producción en Planta Tlaxcala, se observaron tres comportamientos particulares que requerían solución arquitectónica:

1. **Retardo al reabrir la app tras cierre accidental:**
   - Al cerrar la ventana y volver a abrir el acceso directo de inmediato, se percibió un retardo de unos segundos antes de cargar la pantalla. Al probar una segunda vez, abrió de manera instantánea.
   
2. **Desanclaje y reintento de conexión a IP residual `10.26.24.31`:**
   - Al desanclar el acceso directo de la barra de tareas y reabrirlo, la aplicación intentó conectarse a la dirección IP antigua `10.26.24.31` en lugar del servidor de producción activo `10.26.24.37`. Al volver a ejecutar el instalador (`INSTALAR_AQUI_1_CLIC.bat`), leyó `Servidor.txt` y restauró el acceso a `10.26.24.37`.

3. **Experiencia de usuario al conectar (Pantalla blanca con IP):**
   - En momentos de latencia de red o inicio de sesión, el navegador mostraba una pantalla en blanco con la URL/IP en la esquina superior izquierda, lo cual desorienta a los operadores al no saber si el sistema está respondiendo o se congeló.

4. **Operación restringida a Barra de Tareas:**
   - En las terminales de planta, las políticas de los operadores restringen el acceso al Escritorio de Windows, por lo que el punto de acceso obligatorio y único es la Barra de Tareas.

---

## 2. Análisis Causa-Raíz (RCA)

### 2.1 Causa Técnica del Retardo Inicial (Cold Start vs. Warm Start)
Existen dos factores combinados:
- **Arranque en Frío de Chromium (Edge):** Al cerrar la aplicación web kiosco, si no hay otros procesos de Edge activos en segundo plano, Windows descarga de la memoria RAM el motor Blink/V8. La siguiente apertura debe inicializar el motor gráfico, la GPU y la pila TCP (~2 a 4 segundos). Una vez cargado, los inicios posteriores son instantáneos (~200 ms).
- **Suspensión de Inactividad en IIS (`Idle Time-out`):** El Application Pool de IIS por defecto tiene una directiva de suspensión a los 20 minutos de inactividad. Si nadie realiza peticiones, `w3wp.exe` se suspende. Al recibir la primera petición, .NET 8 tiene que recomponer el circuito Blazor Server en memoria.

### 2.2 Causa Técnica de la IP Antigua `10.26.24.31`
Al inspeccionar el código fuente del proyecto se localizaron 5 puntos clave donde la IP de desarrollo anterior (`10.26.24.31`) permanecía como valor por defecto (*fallback*):
1. `CrearAccesoDirecto.ps1` (Línea 14): `$ipServidor = "10.26.24.31"`
2. `Instalar_PC_Cliente.ps1` (Línea 56): `$servidor = "10.26.24.31"`
3. `PalletsPrintBridge/Program.cs` (Líneas 293 y 330): `serverIp = "10.26.24.31"`
4. `Configuracion.razor` (Líneas 209, 222 y 376): `_servidorIpInput = "10.26.24.31"`
5. `wwwroot/js/zebra-print.js` (Línea 432): `hostname || "10.26.24.31"`

Cuando un acceso directo pierde sus argumentos (por ejemplo, si Windows recrea un pin desde un proceso huérfano o si se consulta el microservicio local sin haber guardado configuración previa), el sistema tomaba automáticamente el valor `10.26.24.31`.

---

## 3. Soluciones Técnicas Aplicadas

### 3.1 Unificación Total de IP de Servidor a `10.26.24.37`
Se reemplazaron todos los valores por defecto residuales en el instalador, los scripts de PowerShell, el microservicio puente y los componentes web, estableciendo de forma definitiva y homogénea `10.26.24.37`.

### 3.2 Pantalla de Carga y Conexión Industrial (Splash Screen)
Para evitar que los operadores vean una pantalla blanca o direcciones IP crudas, se incorporó un Splash Screen corporativo en `App.razor`:
- **Identidad Visual:** Logo estilizado de Pallets Wet Wipes con iluminación industrial cian/azul.
- **Mensaje de Estado Dinámico:** *«Conectando con Servidor Central de Producción (10.26.24.37)...»*.
- **Indicador de Progreso:** Animación de pulso y barra de carga con degradado de alta visibilidad.
- **Mecanismo de Recuperación:** Si tras 10 segundos no se establece el canal WebSocket SignalR, la pantalla ofrece un botón de acción: *«Reintentar Conexión»* e instrucciones claras de verificar el cable de red.

### 3.3 Acceso Directo con Perfil Aislado y Anclaje a la Barra de Tareas
Para que el acceso directo no se confunda con el navegador Edge personal y permanezca siempre anclado para los operadores:
1. **Perfil de Datos Aislado:**
   ```powershell
   --app="http://10.26.24.37:5106/" --user-data-dir="%LOCALAPPDATA%\PalletsWW_Profile" --start-maximized
   ```
   Esto asegura que la ventana no comparta cookies, sesiones o cierres accidentales con otras instancias del navegador.
2. **Identidad Propia en Windows:**
   Se asocia el icono oficial de la app (`pallets_ww.ico`) para que en la Barra de Tareas se muestre como un programa independiente y no como un icono de Edge.
3. **Anclaje Automático:**
   Se incluye en el instalador de 1 clic (`INSTALAR_AQUI_1_CLIC.bat`) la rutina que ubica y ancla el acceso directo directamente en:
   `%APPDATA%\Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar\Pallets WW.lnk`

---

## 4. Logo Corporativo Generado

Se generó un isotipo industrial de alta fidelidad:
- **Diseño:** Tarima industrial metálica con paquetes estibados de Wet Wipes Kimberly-Clark, reflejos cromados y fondo oscuro ergonómico.
- **Formatos:**
  - `wwwroot/img/pallets_ww_logo.png` (Visualización web y Splash Screen).
  - `wwwroot/favicon.png` (Pestaña del navegador y PWA).
  - `Instalador_Cliente_Zebra/pallets_ww.ico` (Icono ejecutable para la Barra de Tareas).
