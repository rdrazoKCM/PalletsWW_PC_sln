# 001 Stack Tecnológico MD5 (Manufactura Digital 5.0 - Kimberly-Clark)

> **Documento:** 001 Stack de MD5  
> **Proyecto Analizado:** `C:\AI\MD5_ECA_V2\MD5_2026-09-04`  
> **Destino:** Plantilla arquitectónica y estándar corporativo para la migración de **PalletsPañal_PC_sln**.  
> **Codificación:** UTF-8 con BOM estrictamente garantizada.

---

## 1. Resumen Ejecutivo del Stack

El proyecto **MD5 (Manufactura Digital 5.0 - Kimberly-Clark)** representa el estándar oficial más moderno y estricto de la compañía para aplicaciones de manufactura e intranet industrial. Está diseñado con una separación limpia y desacoplada entre **Frontend Web SPA (Single Page Application)** y **Backend API REST Multi-Planta con Micro-ORM Dapper**.

```
+---------------------------------------------------------------------------------------------------------+
|                                    STACK OFICIAL MD5 KIMBERLY-CLARK                                     |
+---------------------------------------------------------------------------------------------------------+
|                                                                                                         |
|  [ FRONTEND SPA ]                                    [ BACKEND API REST ]         [ BASE DE DATOS ]     |
|  * React 19.2 + TypeScript 6.0                       * ASP.NET Core Web API       * SQL Server          |
|  * Vite 8 (Bundler ultra rápido)                     * C# (.NET 10 / .NET 8)      * Multi-Planta        |
|  * Tailwind CSS v4 (@tailwindcss/vite)               * Dapper 2.1 (Micro-ORM)     * Transacciones ACID  |
|  * Sistema de Diseño KC (Azul Marca + 6 Temas)      * EF Core 10 (DbContext)    * Stored Procedures   |
|  * React Router v7 + pnpm                            * JWT Bearer + Active Dir    * Sockets ZPL 9100    |
|  * Componentes UI Corporativos homologados           * SignalR (Tiempo Real)      * Hardware Local      |
|                                                      * Scalar API Docs                                  |
+---------------------------------------------------------------------------------------------------------+
```

---

## 2. Frontend: Arquitectura, Lenguajes y Librerías

El frontend se encuentra en la carpeta `C:\AI\MD5_ECA_V2\MD5_2026-09-04\Frontend` y está orquestado mediante **pnpm** como gestor de paquetes de alto desempeño.

### 2.1. Tecnologías Base
| Componente | Versión / Tecnología | Propósito |
| :--- | :--- | :--- |
| **Lenguaje Principal** | **TypeScript 6.0 / 5.x** | Tipado estático estricto, autocompletado y robustez en compilación (`tsc -b`). |
| **Librería UI** | **React 19.2.6** (`react`, `react-dom`) | Última versión de React con soporte nativo para acciones y renderizado eficiente. |
| **Bundler & DevServer**| **Vite 8.0.12** (`@vitejs/plugin-react`) | Tiempos de arranque en milisegundos, Hot Module Replacement (HMR) instantáneo. |
| **Enrutador** | **React Router DOM 7.15.1** | Enrutamiento declarativo del lado del cliente, navegación fluida sin recargar página. |
| **Estilos y CSS** | **Tailwind CSS 4.3.0** (`@tailwindcss/vite`) | Motor Tailwind v4 integrado directamente al pipeline de Vite con directivas `@theme`. |
| **Gestor de Paquetes** | **pnpm** (`pnpm-lock.yaml`, `pnpm-workspace.yaml`) | Rápido, deduplica dependencias en disco y garantiza builds deterministas. |

### 2.2. Librerías Complementarias
* **`lucide-react` (1.16.0):** Set oficial de iconografía limpia, moderna y homogénea para toda la interfaz.
* **`sweetalert2` (11.26.24):** Cuadros de diálogo modales, confirmaciones críticas (ej. cancelar pallet, alertas de red).
* **`react-select` (5.10.2):** Selectores avanzados con autocompletado y búsqueda rápida en listas grandes.
* **`chart.js` (4.5.1):** Visualización de métricas de producción y gráficas de rendimiento.
* **`jspdf` (4.2.1) + `jspdf-autotable` (5.0.8):** Generación y exportación de reportes de producción a formato PDF.
* **`@vladmandic/face-api` (1.7.15):** Módulo biométrico de reconocimiento facial (opcional para login sin teclear contraseña).

### 2.3. Estructura de Directorios del Frontend
```
Frontend/src/
  ├── components/          # Componentes reusables de negocio (PdcaTablero, FirmaDigital, etc.)
  │    └── ui/             # Componentes nucleares homologados de la Guía KC (Button, Modal, Card, etc.)
  ├── config.ts            # Detección inteligente de URL de API (localhost dev vs ruta relativa en IIS)
  ├── context/             # Estados globales (Autenticación, Tema visual, Planta activa)
  ├── hooks/               # Custom hooks de React (consultas, debouncing, sockets)
  ├── lib/                 # Utilidades generales y helpers
  ├── pages/               # Vistas principales (Login, Captura, Catálogos, Reportes)
  ├── services/            # Capa cliente HTTP (api.ts centralizado con inyección de JWT y headers)
  ├── index.css            # Tokens de diseño @theme, fuentes y definición de los 6 temas
  └── main.tsx             # Punto de entrada de la aplicación
```

---

## 3. Guía de Diseño Corporativo: `DISENO_KC.md`

El proyecto MD5 contiene una guía obligatoria de diseño industrial para Kimberly-Clark. Todo nuevo módulo debe regirse por estos principios:

### 3.1. Identidad de Color Kimberly-Clark
Reconcilia el azul oficial de marca (celestial `#3C93CB`) con el azul profundo accesible (`#0047AB`):

| Token Tailwind | Hexadecimal | Uso Obligatorio |
| :--- | :--- | :--- |
| **`kc-50`** | `#E6F0FA` | Fondos tenues, hover de filas en tablas de datos. |
| **`kc-100`** | `#CFE2F5` | Fondos de chips informativos o badges suaves. |
| **`kc-400`** | `#3C93CB` | **Identidad / Acento** (celestial oficial, riel activo, detalles). |
| **`kc-600`** | `#0047AB` | **Acción Principal**: Botones primarios, enlaces, foco accesible (contraste 8.6:1). |
| **`kc-700`** | `#003D99` | Hover de botones de acción, números de KPIs destacados. |
| **`kc-800`** | `#003366` | Cromo oscuro (cabeceras on-brand, sidebars). |

> **Regla de Oro:** **Un solo azul de acción (`kc-600`)**. Prohibido usar gradientes en botones de guardado o acción.

### 3.2. Colores Semánticos de Estado (Invariables)
El color siempre comunica el mismo significado en todas las pantallas:
* **OK (`#16A34A` / Verde):** Pallet guardado, proceso cerrado, turno activo correcto.
* **WARN (`#B45309` / Ámbar):** Pendiente de procesar, advertencia de red lenta.
* **DANGER (`#DC2626` / Rojo):** Error de impresión, cancelación, pallet duplicado detenido.
* **INFO (`#0047AB` / Azul KC):** Informativo, detalles de turno, folio de vale.

### 3.3. Sistema de 6 Temas Oficiales
La aplicación conserva **6 temas de cromo** (sidebar y header):
1. `royal-navy` (Predeterminado)
2. `kcm-deep-blue`
3. `kcm-cyan-pro`
4. `kcm-sapphire-plat`
5. `kcm-emerald`
6. `kcm-amber-sunset`

*El contenido interior, los botones y las tablas **NO cambian con el tema**; esto mantiene la consistencia operativa.*

### 3.4. Tipografía y Jerarquía
* Fuente: **Inter** o **Quicksand** corporativa.
* **Piso mínimo de 14px** para texto de cuerpo (`text-sm`). Prohibido textos diminutos ilegibles.
* Números y tablas con **cifras tabulares** (`tabular-nums`) para evitar descuadres en contadores de tarimas y cajas.

### 3.5. Componentes UI Estandarizados (`src/components/ui/`)
* `<Button variant="primary | secondary | danger | ghost">`
* `<PageHeader icon title subtitle actions>`
* `<Modal isOpen onClose title>` (Con soporte nativo de Escape y bloqueo de scroll).
* `<InputField>` / `<SelectField>` (Con `<label htmlFor>` accesible y foco en azul KC).
* `<Chip tone="ok | warn | danger | info | neutral">`
* `<Card>` (Superficie limpia con borde suave y sombra estandarizada).
* `<Loading>`, `<EmptyState>`, `<ErrorState>` (Manejo explícito de los 3 estados de red).

---

## 4. Backend: Arquitectura y Tecnologías (.NET C#)

El backend en `C:\AI\MD5_ECA_V2\MD5_2026-09-04\Backend` es un servicio **ASP.NET Core Web API** en C# optimizado para alto tráfico y latencia mínima.

### 4.1. Paquetes NuGet y Framework
* **TargetFramework:** `net10.0` (compatible y portable con `net8.0` LTS).
* **Dapper (2.1.79):** Micro-ORM de alto rendimiento utilizado para la ejecución directa y ultrarrápida de consultas T-SQL y llamadas a Stored Procedures sin la sobrecarga de un ORM pesado.
* **Entity Framework Core (10.0.8):** `Microsoft.EntityFrameworkCore.SqlServer` para gestión de contexto y metadatos de conexión (`AppDbContext`).
* **Autenticación JWT:** `Microsoft.AspNetCore.Authentication.JwtBearer` (claves simétricas HMAC-SHA256 validadas a mínimo 32 bytes).
* **Directorio Activo / LDAP:** `System.DirectoryServices.AccountManagement` y `System.DirectoryServices.Protocols` para autenticación con credenciales corporativas Windows/KCC.
* **Scalar API Reference (2.0.33):** Sustituto moderno y ultra rápido de Swagger UI para documentación y prueba interactiva de endpoints (`app.MapScalarApiReference`).
* **SignalR:** WebSockets nativos de ASP.NET Core (`builder.Services.AddSignalR()`) para notificaciones y sincronizaciones en tiempo real.

### 4.2. El Patrón Base `BaseDbController` y `PeticionDapper`
Todos los controladores del sistema heredan de `BaseDbController.cs`, implementando el patrón corporativo de despacho dinámico:

```csharp
// Estructura de petición recibida por el backend:
public class PeticionDapper
{
    public string Accion { get; set; } = string.Empty;
    public bool EsSelect { get; set; }
    public Dictionary<string, JsonElement>? Parametros { get; set; }
}

// Endpoint estándar en cada controlador:
[HttpPost("ejecutar")]
public async Task<IActionResult> EjecutarQuery([FromBody] PeticionDapper peticion)
{
    string? query = peticion.Accion switch
    {
        "GetPalletsPorVale" => @"
            SELECT FolioVale, NumTarima, Cajas, Fecha, Hora, Estatus 
            FROM tblPallets 
            WHERE FolioVale = @FolioVale 
            ORDER BY NumTarima DESC",
            
        "InsertarPallet" => @"
            EXEC pa_P009_01006_tblPalletsInsertcmdV9 @FolioVale, @NumTarima, @Cajas...",
            
        _ => null
    };

    return await EjecutarConsulta(query, peticion.EsSelect, peticion.Parametros);
}
```

### 4.3. Ruteo Dinámico Multi-Planta (`IDbConnectionResolver`)
MD5 cuenta con ruteo de base de datos integrado para las 9 plantas de Kimberly-Clark México mediante el header `X-Planta-Id`:
* **384:** Planta Ecatepec (`mdt0mxdbeca`)
* **366:** Planta Tlaxcala (`TLX022MXDB` / `mdt0mxdbtla`)
* **362:** Planta Bajío (`mdt0mxdbbaj`)
* **365:** Planta Ramos Arizpe (`mdt0mxdbram`)
* **367:** Planta Orizaba (`mdt0mxdbori`)
* **368:** Planta Prosperidad (`mdt0mxdbpro`)
* **381:** Planta Morelia (`mdt0mxdbmor`)
* **387:** Planta Texmelucan (`mdt0mxdbtex`)
* **900:** Planta Evenflo (`mdt0mxdbeve`)

---

## 5. Hardware e Impresión Zebra (Puerto 9100)

En el módulo de `MateriaPrima` (`CatMPController.cs`) de MD5 se observa la tabla `sys_cat_impresoras`, la cual administra impresoras industriales con:
* **IP y Puerto:** Puerto estándar **9100** (puerto RAW de Zebra).
* **Impresora Default por Módulo.**
* **Integración con Socket Local:** En nuestro caso para **Pallets Pañal PC**, este modelo empata a la perfección con nuestro microservicio local `PalletsPrintBridge` y la comunicación Socket TCP / USB Raw Helper.

---

## 6. Despliegue en IIS e Intranet

### 6.1. Detección de Entorno en Frontend (`config.ts`)
* **En Desarrollo:** Se conecta automáticamente a `http://localhost:5200` o `https://localhost:5201`.
* **En Producción (IIS):** Utiliza ruta relativa `''`. Esto permite que IIS gestione el Frontend como un sitio web estático y redirija las peticiones `/api/*` al Backend mediante **IIS Reverse Proxy / URL Rewrite**, eliminando problemas de CORS.

### 6.2. Variables de Entorno y Seguridad
* La clave secreta de JWT (`Jwt:Key`) no se versiona en texto plano en Git; en producción se inyecta mediante variable de entorno `Jwt__Key`.
* Servidor Kestrel configurado con certificado PFX corporativo para HTTPS (`server.pfx`).

---

## 7. Plan de Adopción para `PalletsPañal_PC_sln`

Para migrar **Pallets Pañal PC** a la nueva plataforma web oficial de la empresa, implementaremos la siguiente arquitectura gemela a MD5:

1. **Frontend (`PalletsPanal.Web`):**
   * **React 19 + TypeScript + Vite + Tailwind CSS v4.**
   * Interfaz de captura de pallets y vales usando la guía oficial `DISENO_KC.md` (azul `kc-600`, Inter 14px, `tabular-nums`).
   * Modo App en Edge (`--app=http://...`) para la terminal del operador.
   * Temporizador de cambio de turno de 20 min y protección de captura activa.

2. **Backend (`PalletsPanal.Api`):**
   * **ASP.NET Core Web API en C# (.NET 8 LTS o .NET 10).**
   * **Dapper** para ejecución inmediata de Stored Procedures (`pa_P009_01006_tblPalletsInsertcmdV9`, etc.).
   * Documentación interactiva con **Scalar API Reference**.

3. **Impresión Local (`PalletsPrintBridge`):**
   * Microservicio local C# / Socket 9100 / WinSpooler RAW en la terminal del operador para disparo instantáneo sin diálogo de impresión.

4. **Instalador de Terminal (`Setup_PalletsPanal_Cliente.exe`):**
   * Instalador gráfico con permisos ACL multi-usuario en `%ProgramData%` para no perder la configuración del servidor IIS entre Admin y Operador.
