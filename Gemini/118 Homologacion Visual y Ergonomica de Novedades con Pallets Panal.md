# 118 Homologación Visual y Ergonómica de Novedades con Pallets Pañal

> **Documento Oficial de Memoria Técnica y Control de Cambios**  
> **Ubicación:** `C:\AI\Git Hub\clsA_P035_PallestWipes\PalletsWW_PC_sln\Gemini\118 Homologacion Visual y Ergonomica de Novedades con Pallets Panal.md`  
> **Codificación:** UTF-8 con BOM (`\uFEFF`)  
> **Módulos Afectados:** `src/PalletsWW_PC.Web/src/components/layout/Sidebar.tsx`, `src/PalletsWW_PC.Web/src/config.ts`  
> **Versión de la Aplicación:** **Versión 13.0 • MD5**  
> **Fecha:** 13 de Noviembre de 2026  

---

## 1. Resumen Ejecutivo de la Solicitud

El usuario solicitó homologar al 100% el diseño visual y la ergonomía del panel de **"Novedades de la Versión"** en Pallets Wipes con respecto a la interfaz implementada en **Pallets Pañal** (`PalletsPanal.Web`), señalando que la presentación anterior lucía austera ("muy chafa"):
* **Objetivo de Diseño:** Replicar con exactitud pixel-perfect la tarjeta flotante, las insignias categorizadas (pills por color), la tipografía jerarquizada, la cabecera degradada con destello y el monitor de estatus del microservicio de impresión térmica Zebra en el pie del panel.
* **Estándar Gráfico:** Manufactura Digital 5.0 (MD5) de Kimberly-Clark Planta Tlaxcala, integrando microinteracciones suaves, efectos de desenfoque (`backdrop-blur-2xl`), sombras profundas de grado industrial y estados reactivos.

---

## 2. Diagnóstico y Arquitectura Visual Homologada

Al analizar la implementación de referencia en `c:\AI\Git Hub\PalletsPañal_PC_sln\src\PalletsPanal.Web\src\components\layout\Sidebar.tsx` y la captura de pantalla suministrada por el usuario, se identificaron los elementos clave que fueron adoptados íntegramente:

```
┌────────────────────────────────────────────────────────┐
│ ✨ Novedades de la Versión                          ✕ │
│    Versión 13.0 • MD5                                  │
├────────────────────────────────────────────────────────┤
│ [PLATAFORMA]  Actualización a .NET 10 LTS              │
│               Backend Web API modernizado en .NET 10...│
├────────────────────────────────────────────────────────┤
│ [DISEÑO]      Catálogo de 15 Temas MD5 Kimberly-Clark  │
│               Suite completa de 4 temas oscuros, 3...  │
├────────────────────────────────────────────────────────┤
│ [PRODUCCIÓN]  Reglas Industriales Wipes (38 Tarimas)   │
│               Blindaje estricto de 38 tarimas por vale │
├────────────────────────────────────────────────────────┤
│ [CONECTIVIDAD] Mapeo Dinámico de Servidor IIS          │
│               Solución del mapeo dinámico del servidor │
├────────────────────────────────────────────────────────┤
│ 🖨️ Servicio Zebra (9100):                  ● Conectado │
└────────────────────────────────────────────────────────┘
```

---

## 3. Componentes y Archivos Modificados

### 3.1. Tipado y Catálogo Centralizado (`src/PalletsWW_PC.Web/src/config.ts`)
* Se definió la interfaz `VersionNovedadItem` con soporte para clasificación tipográfica y cromática:
  ```typescript
  export interface VersionNovedadItem {
    id: string;
    titulo: string;
    descripcion: string;
    tag: string;
    color: 'purple' | 'emerald' | 'amber' | 'cyan' | 'blue';
  }
  ```
* Se pobló la constante `NOVEDADES_VERSION` con los ítems representativos de la versión activa de Pallets Wipes:
  1. `PLATAFORMA` (`purple`): Actualización a .NET 10 LTS.
  2. `DISEÑO` (`emerald`): Catálogo de 15 Temas MD5 Kimberly-Clark.
  3. `CONECTIVIDAD` (`blue`): Mapeo Dinámico de Servidor IIS.
  4. `PRODUCCIÓN` (`cyan`): Reglas Industriales Wipes (38 Tarimas / 2 Líneas).
  5. `WINDOWS` (`cyan`): Sincronización Universal de Accesos Directos.
  6. `SETUP` (`emerald`): Instalador Todo-en-Uno v1.0.2 en `C:\PublishIIS`.
  7. `RENDIMIENTO` (`amber`): Purga Automática de Sesiones en Quiosco.

### 3.2. Rediseño del Componente Sidebar (`src/PalletsWW_PC.Web/src/components/layout/Sidebar.tsx`)
* **Botón Disparador en Barra Lateral:**
  * Indicador LED de la impresora Zebra con pulso continuo (`animate-pulse`), verde (`bg-emerald-400`) si está conectada a `http://127.0.0.1:9100`, o rojo (`bg-red-500`) en desconexión.
  * Número de versión en tipografía destacada (`text-sm font-black text-white group-hover:text-cyan-300`).
  * Subtítulo ergonómico: `Novedades de versión`.
  * Ícono de destello `Sparkles` en tono ámbar (`text-amber-400`) y flecha reactiva (`ChevronUp`/`ChevronDown`).
  * Soporte compacto para modo colapsado (`isCollapsed`) mostrando el LED y la píldora `V13`.
* **Panel Flotante (Popover):**
  * Fondo oscuro con doble capa de desenfoque (`bg-slate-900/98 backdrop-blur-2xl`), borde con halo cyan (`border-sky-500/40 ring-1 ring-cyan-500/30`) y sombra volumétrica (`shadow-[0_25px_60px_rgba(0,0,0,0.85)]`).
  * Cabecera con degradado (`from-sky-950/80 via-slate-900 to-indigo-950/80`), insignia cuadrangular azul para el ícono `Sparkles`, título en blanco bold y subtítulo monospaciado `{APP_CONFIG.version} • MD5`.
  * Botón de cierre `X` en esquina superior derecha con parada de propagación.
  * Lista con scroll independiente (`max-h-[380px] overflow-y-auto divide-y divide-white/5`).
  * Badges con estilos dedicados por categoría:
    * `purple`: `bg-purple-950/80 text-purple-300 border-purple-500/30`
    * `emerald`: `bg-emerald-950/80 text-emerald-300 border-emerald-500/30`
    * `amber`: `bg-amber-950/80 text-amber-300 border-amber-500/30`
    * `cyan`: `bg-cyan-950/80 text-cyan-300 border-cyan-500/30`
    * `blue`: `bg-blue-950/80 text-blue-300 border-blue-500/30`
  * Pie con estado en vivo del servicio local de impresión: `Servicio Zebra (9100): ● Conectado` / `Sin conexión`.
  * Listener global para cierre automático al hacer clic fuera del panel (`handleClickOutside`).

---

## 4. Pruebas y Validación Técnica

1. **Compilación de Frontend Web SPA:**
   * Ejecución: `pnpm run build`
   * Resultado: **0 errores**, tiempo de compilación 6.42s con `vite v8.3.4`.
2. **Compilación de Backend Web API:**
   * Ejecución: `dotnet build src/PalletsWW_PC.Api/PalletsWW_PC.Api.csproj -c Release`
   * Resultado: **0 errores**, 1 advertencia CA1416 esperada para llamadas Windows USB.
3. **Despliegue a Producción Local (IIS):**
   * Script ejecutado: `scripts/Publicar_PalletsWW.ps1`
   * Backend API: `C:\PublishIIS\PalletsWW_PC.Api.Publish` (Actualizado con técnica `app_offline.htm`).
   * Frontend Web: `C:\PublishIIS\PalletsWW_PC_React.Publish` (Sincronizado vía `robocopy /PURGE`).
   * Instalador: `C:\PublishIIS\Setup_PalletsWW_Cliente.exe` (v1.0.2.0 confirmado, 219.3 MB).
4. **Verificación de Codificación:**
   * Se aplicó la validación estricta de **UTF-8 con BOM** (`0xEF, 0xBB, 0xBF`) en todos los archivos modificados.

---

## 5. Estado Final del Sistema

* **Frontend Web:** Homologado visualmente al 100% con Pallets Pañal y estándar MD5.
* **Experiencia de Usuario:** El operador y el personal de soporte cuentan con visualización clara, profesional y ergonómica de las mejoras de la versión junto al semáforo de estado de impresión térmica.
* **Instalador y Publicación:** Disponibles en IIS y listos para distribución en planta.
