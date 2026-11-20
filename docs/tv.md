# TV de la mesa (`/tv`)

Wallboard para proyectar en una pantalla de la oficina. Muestra 4 KPIs de
llamadas en vivo (Wise CX), el Top 3 de operadores por calidad, la lista del 4º
al 10º, las llamadas activas y los casos sin asignar (InvGate, solo lectura).
El ranking completo se abre en un modal.

- **Ruta**: `/tv` (sección Accesos rápidos del sidebar, ícono `tv`)
- **Ruta anterior**: `/broadcast` redirige 302 a `/tv`
- **Endpoint**: `GET /api/tv/estado`
- **RBAC**: ruta `/tv`, `/api/tv` y módulo `tv` con lectura para **todos** los
  usuarios logueados (`routePermissions` + `getModulePermissions` en
  `src/lib/rbac.ts`). Es de solo lectura.
- **Auto-refresh**: polling cada 10 s desde el navegador.

## Cómo correrlo

```powershell
npm run dev                      # http://localhost:4321/tv
npm run build                    # incluye scripts/verify-build.mjs
```

E2E (Playwright levanta el dev server; usar un puerto propio por workspace):

```powershell
$env:PLAYWRIGHT_BASE_URL="http://localhost:4331"
npx playwright test tests/tv.spec.ts --timeout=60000
npx playwright show-report
```

## Arquitectura

```
Navegador ──polling 10s──▶ /api/tv/estado ──cache 10s──▶ Wise CX Analytics
   ▲                                │
   │                                ├──cache 60s──▶ InvGate (mesa)
   └──── JSON: kpis + calls ────────┴──cache 5min──▶ SQLite (calidad)
         + casos + calidad
```

- **`src/lib/wise-cx-analytics.ts`**: cliente HTTP de
  `analytics.wcx.cloud/Reports.svc/*`. Es una API **pública**: se resuelve con
  `{ codeCompany, tab_guid }` y **no requiere credenciales**.
- **`src/lib/wise-cx-calls.ts`**: dominio: KPIs, detalle, normalización de
  estados, cache de **10 s + single-flight**.
- **`src/lib/tv/display.ts`**: helpers puros compartidos entre SSR y polling:
  `describeCall`, `formatAge`, `formatDuration`, `formatScore` y
  `scoreToneClass`.
- **`src/lib/invgate/casosAutogestion.ts`**: cola de la mesa: casos sin
  asignar + métricas (abiertos, asignados, por estado, antigüedad). Cache de
  60 s + single-flight.
- **`src/lib/calidad/resumenTv.ts`**: ranking completo y promedios de calidad.
  Cache de 5 min.
- **`src/components/tv/`**: `TvContent` (server island), `TvKpiSegment`,
  `TopOperadoresPodio`, `RankingCompletoModal`, `Medalla`, `LlamadaRow`,
  `CasoRow`, `PromediosCalidad`, `EstadoLlamadaBadge`.
- **`src/pages/tv/index.astro`**: página (`server:defer`) + polling y tick de
  1 s para tiempos y frescura.

La página usa `server:defer`: el HTML inicial trae un skeleton y el island
resuelve los datos por su cuenta.

## Layout

Pensado para una pantalla 16:9, con cinco zonas:

1. Header: chip de conexión (`En vivo` / `Datos demorados` / `Sin datos`),
   frescura del snapshot, aviso si Wise reporta problemas y botón de pantalla
   completa.
2. Banda horizontal de 4 KPIs. No son cuatro tarjetas: es una sola superficie
   dividida por líneas de 1 px.
3. Columna izquierda (1 de 4 columnas, 25%):
   - **Top 3 de operadores en podio horizontal**, de izquierda a derecha 2º, 1º
     y 3º. El 1º queda en el centro, más alto y con una superficie apenas
     tintada; 2º y 3º se alinean abajo. Cada tarjeta muestra posición, nombre y
     promedio. El encabezado solo tiene el título, el mes y el CTA; no muestra
     cantidad de operadores, auditorías ni fallback. Todo el módulo es
     clickeable y abre el ranking.
   - **Lista 4º a 10º** debajo del podio: posición, nombre y promedio, sin
     auditorías. Máximo 7 filas (`ranking.slice(3, 10)`), con scroll interno.
     Todo el módulo sigue siendo clickeable y abre el modal.
4. Columnas derechas (3 de 4, 75%): **Llamadas activas** a la izquierda y
   **Casos sin asignar** a la derecha, en dos columnas. La lista de casos, el
   desglose por categoría y el aviso de InvGate viven en el bloque de casos.
5. Pie: promedio general, promedios por canal, aprobados y mes usado.

El ranking completo vive en un modal centrado, con tabla compacta, scroll
interno, cierre por botón, Escape y clic fuera. El modal muestra solamente el
título y la tabla de posición, operador, auditorías y promedio; no repite el
resumen del período. El podio y el modal usan el mismo array
`calidad.ranking`; no hay request adicional ni lógica duplicada.

## Datos: widgets, ventana y formato

Env vars (con default):

```env
WISE_CX_ANALYTICS_BASE_URL="https://analytics.wcx.cloud"
WISE_CX_ANALYTICS_COMPANY="Me599"
WISE_CX_ANALYTICS_TAB_GUID="8c2f22668de84a57892eab5b1f2c5fd5"
WISE_CX_CALLS_WIDGET_ID="464249"          # "Estado de Llamadas" (type 53)
WISE_CX_CALLS_DETAIL_WIDGET_ID="464546"   # "Cantidad de Llamadas" (type 76)
WISE_CX_TIMEZONE_OFFSET="-03:00"
```

| Qué | Cómo |
| --- | --- |
| KPIs (Sonando / Activas / En cola / En IVR) | `getDataReportByWidget` con el widget **464249** (type 53) |
| Detalle fila por fila | `getCallsListData` reusando el widget **464546** (type 76) |
| Ventana del listado | `call_created IN #Last6Hours#` |
| "Activas" | Estado **en curso** de Wise (`total_call_attended`) |

### Hold: badge "En espera"

Wise reporta una llamada en **hold** con `call_status = "En Cola"`, pero el KPI
`total_call_enqueued` no la cuenta. Si el estado es `En Cola` **y la llamada
tiene agente**, se clasifica como **"En espera"** (`en_espera`). Es solo un
badge: no tiene KPI propio.

## Casos sin asignar (InvGate, solo lectura)

La columna derecha muestra los casos que la mesa todavía tiene que tomar. La
sección "Mesa de ayuda" con abiertos, asignados y antigüedades salió de la UI;
el endpoint sigue devolviendo `casos.metricas` por compatibilidad, pero `/tv`
ya no lo renderiza.

**No asigna nada**: no tiene botones, no toma el lock y no escribe en InvGate ni
en SQLite.

| Qué | Cómo |
| --- | --- |
| Fuente | `src/lib/invgate/casosAutogestion.ts` |
| Mesa | `INVGATE_AGENTS_HELPDESK_ID` (o `INVGATE_AUTOGESTION_HELPDESK_ID` si se quiere otra para el panel) |
| ID correcto | Es el **nivel** de `helpdesksandlevels` (type_id=1), no el helpdesk padre. Producción: **2510**. QA: 3950 |
| Filtro de casos | **sin `assigned_id`** y sin `solved_at`/`closed_at` |
| Orden | más antiguos primero |
| Cache | 60 s + single-flight |
| Si InvGate falla | `casos: []` + `warning`; el wallboard sigue funcionando |

### Un cero no siempre es un cero

Si la mesa no está configurada, el código resuelve un default por entorno
(2510 en producción, 3950 en QA). Un ID equivocado devuelve una cola vacía
**sin error**. Por eso el resumen incluye `helpdeskExplicit` y, cuando el ID
salió de un default y la cola vuelve vacía, `warning`. El panel muestra ese
aviso en lugar de un 0 mudo.

```env
# Nivel 1 de TI_GSM_MDA TI en producción.
INVGATE_AGENTS_HELPDESK_ID="2510"
```

## Calidad: Top 3, modal y promedios

Visible para todos los roles con acceso a la vista.

| Qué | Cómo |
| --- | --- |
| Fuente | `src/lib/calidad/resumenTv.ts` |
| Score por operador | `calculateOperatorChannelStats().globalAverage` |
| Podio en pantalla | `calidad.ranking.slice(0, 3)`, con medallas de oro, plata y bronce |
| Lista 4-10 | `calidad.ranking.slice(3, 10)`, posición, nombre y promedio |
| Ranking completo | El mismo array `ranking` en un modal, sin request adicional |
| Ranking | **todos** los operadores auditados, de mayor a menor promedio; desempate por auditorías y luego nombre |
| Promedio general | media de los promedios por operador (criterio "Promedio MDA" del Excel) |
| Aprobados | operadores con promedio >= 75 (`QUALITY_APPROVAL_THRESHOLD`, el mismo del Excel) |
| Color del score | `>= 85` success, `70 a 84` texto normal, `< 70` error. El ámbar no se usa como texto porque no alcanza 3:1 sobre base-100 |
| Universo | operadores con `incluidoCalidad = true`, usuario activo y >= 1 auditoría |
| Periodo | mes corriente; si tiene **menos de 5 auditorías**, usa el anterior e indica cuál |
| Cache | 5 min |

> Los operadores sin auditorías en el período no tienen promedio y no entran al
> ranking. El podio muestra posición, nombre y promedio; el modal agrega la
> cantidad de auditorías.

## Tests

| Comando | Qué cubre |
| --- | --- |
| `npx playwright test tests/tv.spec.ts` | 18 casos: chrome del portal, redirect `/broadcast`, KPIs y su orden, color, conexión y estado "Sin datos", llamadas (IVR y hold), podio 2/1/3, lista 4-10 con tope de 10, modal con el mismo ranking, cierre por Escape, X y clic fuera, foco, polling con el modal abierto, estado vacío del podio, casos en la derecha, grilla 1+3, llamadas/casos en dos columnas, polling, shape del endpoint y 401 sin sesión |
| `npx playwright test tests/tv-contrast.spec.ts` | Contraste real en el navegador de badges, chip de conexión, botón de pantalla completa, podio, modal, KPIs y pie, en light y dark. Falla si algún par baja de 4.5:1 (texto normal) o 3:1 (texto grande) |
| `npm run test:domain` | Tests de dominio con `node:test` |
| `npm run test:unit` | Suite general (arrastra 5 fallos preexistentes: 3 históricos y 2 de tarjetas de admin, issue #402) |

## Decisiones de diseño

1. **Polling, no websocket.** Wise Analytics usa SignalR, pero solo avisa "hay
   cambios"; el dato se pide igual por HTTP. Un poller server-side con cache es
   más simple y no tiene token rotativo.
2. **Podio horizontal 2-1-3.** Libera alto en la columna izquierda para el
   tablero de la mesa y mantiene el reconocimiento: el 1º queda en el centro,
   más alto, y 2º y 3º a los costados. El ranking completo sigue en el modal.
3. **Grilla 1+3.** El bloque de reconocimiento y mesa ocupa 1 de 4 columnas; la
   operación ocupa las otras 3. La pantalla queda dominada por llamadas y casos.
4. **Llamadas y casos en dos columnas.** Dentro de esas 3 columnas, cada bloque
   tiene su encabezado, su lista y su scroll interno.
5. **Menos resumen.** El podio no repite cantidad de operadores, auditorías ni
   fallback, y cada tarjeta no muestra auditorías. El modal tampoco repite el
   resumen del período; solo queda la tabla de operadores.
6. **La columna izquierda muestra hasta 10 operadores.** Podio 1-3 y lista 4-10.
   Las métricas de la mesa salieron de la UI; los casos sin asignar siguen a la
   derecha.
7. **Un solo fetch para casos y su lista.** La lista sale de los mismos
   incidentes que ya se piden a InvGate. El endpoint conserva `casos.metricas`
   por compatibilidad, aunque la vista no lo renderice.
8. **El chip dice "Sin datos" si falla el polling.** Un wallboard que sigue
   diciendo "En vivo" con datos viejos es peor que uno que admite el corte.
9. **Pantalla completa, no "modo TV" en el layout.** El botón usa la Fullscreen
   API y el layout del portal no cambia.
10. **Superficies planas.** Banda KPI, podio y bloque operativo; el resto son
    líneas y listas. Sin gradientes, glass, glow ni sombras decorativas.
11. **Medallas locales.** Oro, plata y bronce viven en variables CSS de TV, con
    variantes light/dark. No son tokens institucionales.

## Trampas conocidas de la API de Wise

| Trampa | Detalle |
| --- | --- |
| `data: null` silencioso | Un WQL inválido devuelve `data: null` sin error de envelope. Validar `data != null` |
| `widgetID` atado al tab | Si el widget no existe en el tab: `"Invalid Tab - WidgetID: N - TabID: 0"` |
| Config incompleta | Con un `widget.config` mínimo el backend responde `data: null` |
| Shape de `LoadPage` | `{ reportValues: { codeCompany, tab_guid } }` |
| Estados con dos nombres | El agrupado dice "En Curso" y el detalle "Respondida" |
| Fechas | `call_created` viene en hora local de la cuenta (-03:00) |

## Pendientes

- **Snapshot histórico en SQLite** (cada 1 a 5 min) para hora pico y evolución
  de la cola.
- **Tema oscuro forzado** para salas en penumbra.
- **Polling a 5 s** si 10 s se siente lento en la sala.
