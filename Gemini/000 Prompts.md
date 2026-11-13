# Prompts

Utiliza el archivo ./Gemini/001 Prompts.md en la parte "# 007 Analisis de App moderna web y con api que servira de ejemplo " como nuevo contexto para continuar

# 001 Contexto como funciona esta App

Te doy un poco mas de contexto sobre la app que acabas de analizar esta app se capturan pallets de pañal producidos en planta que estan asignados a un folio de vale de produccion 

pricipalemete se captura el nuemero de vale con la clave de producto que se esta produciendo una ves capturado ese vale o registrado mas bien en la app se empiezan a registrar los pallets manualmente ingresando el numero de cagas y presionando el boton guardar y actualmente son 7 maquinas de produccion y dos lineas de produccion por maquina osea 14 lineas en total que estan guardando pallets continuamente a la misma app algo que esta pasando es que esta repitiendo el numero de tarima en algunos pallets en una imagen te mostrare cual columna aun que esta no tenga repeditos pero esta repitiendo esos numeros cuando se supone que tiene que ser consecutivo y no repetir el numero de tarima te opego la imagen en el chat dime que encuentras sin midificar nda y puedes conectarte via mcp para ver tablas sp 

# 002 App Pallets WW 

Ya que la aplicacion de pallets pañal me la dejaste bien y parece que le diste en el clavo, ahora quiero que me ayudes con otra app que basicamente funciona de la misma forma solo que en lugar de pallets pañal es pallets ww pero el funcionamiento de la app es casi el mismo 

y esta pandando el mismo error el cual es que esta repitiendo numero de tarima o se los salta no siempre sigue el consecutivo aveces se los salta y aveces los repite y esta pando intermitente igual que n la app anterior de pallets pañal que me ayudaste a corregir ayudame con esta app se encuentra en: C:\AI\Git Hub\clsA_P035_PallestWipes analizala detalladmente como la anterior quiero que sigas siendo certero y le des al clavo una veZ MAS, yo se que puedes y me ayudes a solucional este problema que noes esta dando dolor de cabeza aun no mifiques nada solo dime que esta pasando y cual es la solucion a estos dolores de cabeza tomate tu tiempo, no quiero errores

conectate via MCp como en la anterior app y si necesitas algo mencionamelo

# 003 Pallets WW Imprime muchas etiquetas con informacion incompleta

Realiza un analisis de la App que esta en: C:\AI\Git Hub\clsA_P035_PallestWipes recuerdas quue me ayudaste a modificarla por los errores que habia en produccion que se derivan a la Red que actualmente este muy lenta? 

Actuamnete por lo que vi solo me ayudaste a bloquear sql cuando la red esta lenta y no bloqueaste la aplicacion ya que al tener fallo de red manda varias etiquetas y la mayoria con informacion incompleta los cambios que realizaste antes los documentaste aqui. 002 Modificaciones de App Wipes, dame el plan de implementacion para solucionar este problema.

El bloqeo solo está anivel SQL server hasya terminar la transacción, eso ya lo tienes, pero se requiere que no realice no la captura, ni la impresión de etiqueta ni los contadores de tarima, es decir desde que le pedimos guardar hasta que se genera la etiqueta, todo esto se debe tratar como ubna transacción, ahora si analizas el programa, como se hace a través de un datagrid se le pueden agregar varios pallets, no solo 1, y lo que hace es verificar cuantos cambios tiene el dataset del datagrid paar ir reagistrando uno por uno, usualmente solo se mete uno por uno, pero hay ocasiones que se le agregan varios pallets a la vez, y todo debe ser tratado como una transacción, de igual manera necesitanmos que me ayudes a crear logs que me digan los tiempos que tarda en cada acción, al guardar en SQL, si falló o fue correcto, al enviar la etiqueta, si al envió o no, al actualizar los contadores de tarima, si fue correcto o no , tod esto en un log de preferencia en una nueva tabla de SQL que puedas crera vía MCP, si es necesario analiza nuevamente la funcionalidad del programa, Documenta en 005 Plan de Implementacion Pallets WW V3 ahi documenta el plan de implementacion para esta app

# 004 App Pallets Pañal Imprime etiquetas repetidas

Al parecer ya solucionamos los problemas que habia en Pallets WW lo cual fue documentado en: 002 Modificaciones de App Wipes, los cuales fueron los primeros cambios y no solucionaron el problema al 100% ya que habia etiquetas repetidas o saltadas entre otros problemas para lo cual tu propusiste cambios que realizaste en la app y los documentaste en  006 Cambios en Pallets WW V3 y al parecr fueron certeros ya que se ha mantenido estable por un tiempo, sin embargo ahora el problema lo estamos teniendo en la app de Pallets pañal, la cual en un momento hace unos dias mne ayudaste a modificar y hiciste unas correcciones en SQL, los cuales al momento fueron buenos por que solucionaron el problema por unos dias pero al dia de hoy tenemos problemas otra vez con etiquetas repetidas entre otros problemas como los problemas de Pallets WW me gustaria que tomaras como contexto loq ue se realizo con la app pallets WW para aplicar los mismos cambios ya que estas apps son muy similares y basicamente son lo mismo, asi que muy probablemente son los mismos problemas tanto en sql como en la app visual estudio, teniendo como referencia la app pallets  WW dame el plan de omplementacion en 007 Plan de implementacion en Pallets Pañal V3, antes de que realices los cambios tambien necesito una tabla de logs como la que ceraste para la app de pallets ww asi como las condiciones que mejoraste en esa app como bloqueos en visual estudio en pocas palabras si ya funciono bien con la app de pallets ww basate en esa para hacer las mejoras en pallets pañal la cualm se encuentra en: C:\AI\Git Hub\PROY052_PalletsPanal y la app de pallets WW se encuentra enC:\AI\Git Hub\clsA_P035_PallestWipes y conectate via MCP si es necesario

# 005 Mejoras Operativas y Optimizacion de Rendimiento Pallets WW
- Restriccion estricta de 38 pallets por vale.
- Solucion a cuelgues por DataError en los 4 DataGridViews.
- Alta rapida de operador con tecla Enter.
- Diagnostico de lentitud extrema y timeouts en guardado (Indices y telemetria asincrona).
- Restauracion de esquema original en tblPallets.

# 006 Erradicacion de Duplicidad de Pallets y Script Maestro V5
- Diagnostico forense de pallets duplicados (Vale 3178 y Vale 14443).
- Implementacion de candado anti-duplicidad por hora en pa_P009_01006_tblPalletsInsertcmdV5.
- Indice IX_tblPallets_FolioVale_Hora.
- Validacion preventiva en memoria RAM en la aplicacion.
- Sincronizacion y refresco automatico ante caidas de red.
- Script Maestro de despliegue V5 y script de depuracion de duplicados.

# 007 Analisis de App moderna web y con api que servira de ejemplo 

Necesito que realices un profundo y detallado analisis de la aplicacion que se encuentra en: C:\AI\Git Hub\clsA_P035_PallestWipes\App Web con Api de ejemplo la cual ya es una app moderna web con su Api la cual es un estandar extremadamnete estricto en toda la extencion de la palabra tanto en lenguaje como programacion paquetes de conexion estructura realmente todooo lo que puedes ver en esa app es un estandar extremadamnete estricto por esto te pido la analises lo mejor posible tanto en la app como en la base de datos, puedes conectarte via MCP y documenta tu analisis en 100 Analisis App de ejemplo.md


# 008 Publicación del Proyecto en GitHub
Necesito que publiques este proyecto a GitHub, ¿qué necesitas?

# 009 Publicación Completa del Repositorio a GitHub
Quiero que realices todo el proceso de publicación del proyecto al repositorio https://github.com/rdrazoKCM/PalletsWW_PC_sln.git.

# 010 Corrección de Cambio Dinámico de Servidor IIS en Configuración
El día de hoy tuve un problema con la PC que uso como servidor de IIS (IP 10.26.24.31). En el menú de configuración tenemos una opción para cambiar el servidor de IIS, pero me di cuenta de que no funciona: aunque se cambie de servidor, realmente no lo hace. Necesito que me ayudes a verificar y corregir para que funcione correctamente.

# 011 Publicación de Cambios tras Verificación de Integridad
Publica los cambios, pero antes revisa que funcione correctamente y verifica que no se haya modificado ninguna otra funcionalidad.

# 012 Revisión y Corrección de Cambio de Servidor IIS en el Instalador del Cliente
Tengo una duda: ya hiciste las modificaciones necesarias para cambiar de servidor de IIS, pero yo tampoco podía cambiar de servidor de IIS incluso ejecutando otra vez el instalador (le colocaba la IP y no la agarraba). Revisa eso también y sé cuidadoso con lo que mueves, no quiero que se descomponga o ya no imprima.
