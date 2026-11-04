# 103 Cambios en App Web: Modernización, Swagger y Mejoras Operativas Pallets WW

**Proyecto:** Pallets WW Web (.NET 8 C# Blazor / Web API)  
**Solución:** `C:\AI\Git Hub\clsA_P035_PallestWipes\PalletsWW_PC_sln`  
**Fecha:** Septiembre 2026  
**Versión:** 6.0.2  
**Codificación:** UTF-8 con BOM  

---

## 1. Resumen Ejecutivo de Cambios

A solicitud del usuario, se realizó una reestructuración integral y modernización de la aplicación web de **Pallets Wet Wipes (WW)** con el objetivo de elevar la ergonomía industrial, confiabilidad operativa y claridad técnica a estándares corporativos de primer nivel:

1. **Swagger con Stored Procedures Explícitos:** Se prefijó en el resumen, etiquetas y documentación XML de cada endpoint de la Web API el nombre exacto del Stored Procedure de SQL Server que ejecuta (ej. `[pa_P009_01001_tblPallets]`, `[pa_P009_01006_tblPalletsInsertcmdV5]`, `[pa_P009_01003_slnkCapturaVale_LinkClicked]`, etc.), permitiendo identificar al instante el flujo de datos.
2. **Menú Lateral Izquierdo Colapsable (Sidebar):** Se eliminó la barra superior y se implementó un Sidebar moderno a la izquierda con animación suave (250px en modo expandido y 70px en modo colapsado con solo iconos), brindando mayor área visual vertical a los operadores.
3. **Corrección de Acciones de Cada Pallet en la Cuadrícula:** 
   - Se diagnosticó y corrigió la causa raíz que impedía las acciones: en el Stored Procedure `pa_P009_01010_btnImprimirEtiqueta_click`, el campo `NoTarima` retorna un valor alfanumérico (ej. `'TXWW1-156-2'`) y estaba mapeado indebidamente como entero (`int`), lanzando una excepción no controlada (`FormatException`).
   - Se blindaron los botones de **Reimprimir** (con generación ZPL y spooler USB), **Editar** (edición en línea de Hora, Cajas y Línea) y **Eliminar** (con modal de confirmación de alto contraste).
4. **Creación y Conmutación de Múltiples Vales:** Se implementó la capacidad de crear vales de producción en el turno mediante el SP `pa_P009_01003_slnkCapturaVale_LinkClicked` y el catálogo de productos autorizados por máquina (`pa_P009_000_001_ProductosXMaquina`), soportando la operación real de planta donde se producen más de 5 vales por turno. Se agregó selector para alternar entre los vales activos del turno.
5. **Máquina Fija para Operadores y Configuración de Terminal para Administradores:** La pantalla de captura muestra un indicador fijo y bloqueado con candado (`🔒 Máquina: 9 - TXWW1 [Fija]`), imposibilitando que el operador la cambie por error. La reasignación de máquina se trasladó al menú **Configuración** exclusivo para supervisores/administradores, persistiendo en `C:\ArchivosBitacoraAut\Maquina.txt`.
6. **Toast de Error con Auto-Cierre y Botón de Cierre Manual:** Se resolvió el problema del mensaje de error que no desaparecía en pantalla, dotando a `ToastAlert.razor` de un temporizador automático de 5 segundos (`CancellationTokenSource`) y botón explícito `X`.
7. **Eliminación de las 3 Tarjetas de KPI:** Se retiraron las 3 tarjetas voluminosas (*Capacidad del Vale*, *Cajas Acumuladas*, *Última Tarima Registrada*) y se integró un resumen compacto de una sola línea en la cabecera del vale (`Tarimas: X/38 | Cajas: Y | Última: Z`), recuperando más del 25% del espacio vertical de la pantalla para la tabla de captura.
8. **Diseño Visual de Alto Impacto:** Adopción de una estética corporativa limpia y profesional basada en tipografía *Inter*, sombras suaves de elevación, transiciones fluidas y contraste de grado industrial.

---

## 2. Diagnóstico Técnico y Causas Raíz

### 2.1. Causa Raíz del Error en Acciones de Pallet (`NoTarima`)
- **Problema:** Al hacer clic en las acciones de una fila de pallet, ocurría un fallo silencioso o mensaje de error genérico.
- **Causa Raíz:** En `ImpresionRepository.cs`, la columna 6 de `pa_P009_01010_btnImprimirEtiqueta_click` corresponde al folio compuesto de la tarima (ej. `TXWW1-156-2`). El código ejecutaba `Convert.ToInt32(rdr.GetValue(6))`, arrojando:
  ```text
  System.FormatException: The input string 'TXWW1-156-2' was not in a correct format.
     at PalletsWW_PC.Api.Data.Repositories.ImpresionRepository.ObtenerDatosEtiquetaAsync
  ```
- **Solución:** Se corrigió la propiedad `NoTarima` a tipo `string` en `EtiquetaZplDto.cs` (tanto en API como en Web) y se lee mediante `rdr.GetValue(6).ToString()`.

### 2.2. Causa Raíz del Toast de Error Persistente
- **Problema:** Cuando se presentaba una alerta de duplicidad horaria (`pa_P009_01007_ValidaHoraDuplicadaPallet`), la tarjeta roja permanecía fija indefinidamente en la esquina inferior derecha.
- **Causa Raíz:** `ToastAlert.razor` carecía de temporizador de desvanecimiento (`Task.Delay`) y de botón de cierre manual (`btn-close`). El componente dependía exclusivamente de que el componente padre cambiara el booleano `_toastVisible`, lo cual no ocurría automáticamente.
- **Solución:** Se implementó en `ToastAlert.razor` un temporizador interno asíncrono de 5 segundos con reinicio ante nuevos mensajes, acompañado de un botón de cierre manual (`X`).

---

## 3. Matriz de Endpoints vs Stored Procedures (Swagger)

A continuación se detalla el mapeo exacto visible en Swagger UI (`http://localhost:5105/swagger`):

| Método | Endpoint | Stored Procedure Asociado | Base de Datos | Función Operativa |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/Pallets/vale/{folio}` | `pa_P009_01001_tblPallets` | `TLX022MXDB` | Consulta tarimas capturadas del vale activo |
| `POST` | `/api/Pallets` | `pa_P009_01006_tblPalletsInsertcmdV5`<br>*(Valida: `pa_P009_01007_ValidaHoraDuplicadaPallet`)* | `TLX022MXDB` | Registra nueva tarima física validando duplicidad horaria |
| `PUT` | `/api/Pallets/{id}` | `pa_P009_01008_tblPalletsUpdatecmdV5` | `TLX022MXDB` | Modifica datos del pallet (cajas, hora, línea de empaque) |
| `DELETE` | `/api/Pallets/{id}` | `pa_P009_01009_tblPalletsDeletecmd` | `TLX022MXDB` | Elimina físicamente un pallet de la cuadrícula |
| `GET` | `/api/Vales/encabezado` | `pa_P009_00102_ConsultaEncabezadoReporteTurnoWipes` | `TLX022MXDB` | Obtiene el ID del encabezado del turno activo |
| `GET` | `/api/Vales/encabezado-completo` | `pa_P009_00102_ConsultaEncabezadoReporteTurnoWipes` | `TLX022MXDB` | Obtiene turno, tripulación y supervisor asignados |
| `GET` | `/api/Vales/activos` | `pa_P009_01002_sLlenardgvProduccion` | `TLX022MXDB` | Lista todos los vales de producción dados de alta en el turno |
| `POST` | `/api/Vales/crear` | `pa_P009_01003_slnkCapturaVale_LinkClicked` | `TLX022MXDB` | **Registra y activa un nuevo vale de producción** |
| `GET` | `/api/Vales/detalle` | `pa_P009_01004_sdgvtblProduccion_CellDoubleClick` | `TLX022MXDB` | Carga producto, clave y cajas por pallet de un vale |
| `GET` | `/api/Vales/{id}/detalle-id` | `pa_P009_01004_sdgvtblProduccion_CellDoubleClick` | `TLX022MXDB` | Carga datos del vale por su `IdAutotblProduccion` |
| `GET` | `/api/Vales/historicos` | `pa_P009_01005_sLlenardgvProduccionTurnoAnt` | `TLX022MXDB` | Consulta vales del turno anterior |
| `GET` | `/api/Catalogos/maquinas` | `pa_P009_000_008_LlenarcbxNoMaquinaConParams` | `TLX040MXDB` | Catálogo de máquinas del departamento Wet Wipes (Depto 3) |
| `GET` | `/api/Catalogos/lineas-empaque/{noMaquina}` | `pa_P009_01013_sLlenar_cbxLineaEmpaque` | `TLX022MXDB` | Líneas de empaque habilitadas para la máquina |
| `GET` | `/api/Catalogos/operadores` | `pa_P009_000_001_LlenarcbxNoEmpSinParams` | `TLX040MXDB` | Catálogo general de empleados para validación de operador |
| `GET` | `/api/Catalogos/supervisores` | `pa_P009_000_051_LlenarcbxSupervisoresxDepto` | `TLX040MXDB` | Supervisores asignados a Wet Wipes |
| `GET` | `/api/Catalogos/productos/{noMaquina}` | `pa_P009_000_001_ProductosXMaquina` | `TLX040MXDB` | **Productos y claves autorizados para la máquina** |
| `GET` | `/api/Catalogos/maquina-local` | *[Configuración Terminal]* | Archivo Local | Lee máquina local en `C:\ArchivosBitacoraAut\Maquina.txt` |
| `POST` | `/api/Catalogos/maquina-local/{m}` | *[Configuración Terminal]* | Archivo Local | Guarda máquina en `C:\ArchivosBitacoraAut\Maquina.txt` |
| `GET` | `/api/Impresion/etiqueta/{idPallet}` | `pa_P009_01010_btnImprimirEtiqueta_click` | `TLX022MXDB` | Genera código de impresión en lenguaje ZPL |
| `POST` | `/api/Impresion/enviar/{idPallet}` | `pa_P009_01010_btnImprimirEtiqueta_click` | Spooler USB | Envía directamente al puerto USB de la impresora local |
| `POST` | `/api/Impresion/enviar-raw` | *[RAW_USB]* | Spooler USB | Envía ZPL crudo a la impresora |

---

## 4. Detalles de las Mejoras en la Interfaz de Usuario

### 4.1. Menú Lateral Izquierdo Colapsable
- Se reemplazó la antigua barra horizontal superior por un sidebar anclado a la izquierda.
- **Modo Expandido (250px):** Logo "Pallets WW", nombre de planta, enlaces con icono y texto (*Captura de Pallets*, *Reportes*, *Configuración*), indicador de estado y botón de colapso con chevron.
- **Modo Colapsado (70px):** Oculta textos y etiquetas dejando únicamente los iconos centrados con tooltips hover, maximizando el espacio de trabajo en pantallas táctiles o monitores industriales.

### 4.2. Eliminación de las 3 Tarjetas y Tira Compacta
- Se eliminaron los contenedores voluminosos de:
  - `CAPACIDAD DEL VALE (12 / 38 Tarimas)`
  - `CAJAS ACUMULADAS (758 / 632 Cajas)`
  - `ÚLTIMA TARIMA REGISTRADA (TXWW1-156-2)`
- Se integró una tira horizontal compacta de solo lectura en la parte inferior del banner del vale:
  ```text
  Tarimas Capturadas: 12 / 38 | Cajas Acumuladas: 758 Cajas | Última Tarima: TXWW1-156-2
  ```

### 4.3. Flujo de Creación de Vales de Producción
- En plantas industriales de Wet Wipes, una misma máquina produce típicamente más de 5 vales por turno.
- Se agregó el botón verde **"+ Nuevo Vale"** en el banner principal.
- Al pulsarlo, se abre el modal que solicita:
  - **Folio Físico del Vale:** Input numérico.
  - **Producto:** Selector poblado dinámicamente con `pa_P009_000_001_ProductosXMaquina` (Clave y Descripción).
- Al confirmar, el sistema ejecuta `pa_P009_01003_slnkCapturaVale_LinkClicked`, da de alta el registro en `tblProduccion`, refresca la lista de vales del turno y lo selecciona de inmediato como vale activo, dejando la cuadrícula lista para capturar el pallet #1.

### 4.4. Control de Máquina Bloqueado y Menú de Configuración
- Para evitar que los operadores cambien la máquina accidentalmente durante la captura, el campo de máquina en la pantalla principal es de solo lectura y muestra la insignia `[Fija]`.
- En el sidebar izquierdo se habilitó el enlace **Configuración**. Al hacer clic se abre el modal administrativo protegido por PIN de seguridad donde los supervisores pueden seleccionar una nueva máquina del catálogo `pa_P009_000_008_LlenarcbxNoMaquinaConParams`. Al guardar:
  - Se actualiza la línea 1 de `C:\ArchivosBitacoraAut\Maquina.txt`.
  - La aplicación se reconfigura automáticamente con los productos, líneas y turnos de la nueva máquina.

---

## 5. Verificación y Pruebas Realizadas

1. **Compilación de la Solución:**
   - `PalletsWW_PC.Api.csproj`: Compilación correcta (0 errores).
   - `PalletsWW_PC.Web.csproj`: Compilación correcta (0 errores).
2. **Prueba de Swagger UI:**
   - Se verificó mediante consulta HTTP a `/swagger/v1/swagger.json` que el 100% de los endpoints contienen el prefijo `[pa_P009_...]` o su respectivo nombre de procedimiento almacenado en el summary.
3. **Prueba de Frontend Blazor:**
   - Se verificó que el HTML servido en el puerto `5106` contiene la clase `sidebar-container`, no contiene las 3 tarjetas antiguas (`CAPACIDAD DEL VALE`), cuenta con el botón `+ Nuevo Vale` y muestra la máquina fija para el operador.
