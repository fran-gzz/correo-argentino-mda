# Broadcast de llamadas en vivo (`/broadcast`)

Wallboard para proyectar en una TV de la mesa. Muestra 4 KPIs de estado y un
grid de cards con las llamadas vivas de Wise CX.

- **Ruta**: `/broadcast` (sección Accesos rápidos del sidebar, ícono `tv`)
- **Endpoint**: `GET /api/broadcast/estado`
- **RBAC**: ruta `/broadcast` y módulo `broadcast` → lectura para **todos** los
  usuarios logueados (`routePermissions` + `getModulePermissions` en
  `src/lib/rbac.ts`). Es de solo lectura.
- **Auto-refresh**: polling cada 10 s desde el navegador.

## Cómo correrlo

```powershell
npm run dev                      # http://localhost:4321/broadcast
npm run build                    # incluye scripts/verify-build.mjs
```

E2E (Playwright levanta el dev server; usar un puerto propio por workspace):

```powershell
$env:PLAYWRIGHT_BASE_URL="http://localhost:4331"
npx playwright test tests/broadcast.spec.ts --timeout=60000
npx playwright show-report
```

Tests relevantes:

| Comando | Qué cubre |
| --- | --- |
| `npx playwright test tests/broadcast.spec.ts` | 9 casos: sidebar + botón pantalla completa, orden y tamaño de los 4 KPIs, color gris/acento, chip En vivo, grid de cards + badge del total, caso IVR sin agente (snapshot mockeado), polling, shape del endpoint, 401 sin sesión |
| `npm run test:unit` | Suite general. **2 fallos pre-existentes** ajenos a esta vista (ver Pendientes) |
| `npm run test:domain` | Tests de dominio con `node:test` |

## Arquitectura

```
Navegador ──polling 10s──▶ /api/broadcast/estado ──cache 10s──▶ Wise CX Analytics
   ▲                                │
   └──── JSON: kpis + calls ────────┘
```

- **`src/lib/wise-cx-analytics.ts`** — cliente HTTP de `analytics.wcx.cloud/Reports.svc/*`.
  Es una API **pública**: se resuelve con `{ codeCompany, tab_guid }` y **no
  requiere credenciales**. (La API core de Wise CX, `api.wcx.cloud`, es otra:
  esa sí usa `x-api-key` + `Bearer` y la usa `src/lib/wise-cx-client.ts`.)
- **`src/lib/wise-cx-calls.ts`** — dominio: KPIs, detalle, normalización de
  estados, cache de **10 s + single-flight**. N clientes con la vista abierta
  generan **una** consulta a Wise por ventana.
- **`src/lib/broadcast/display.ts`** — `describeCall()`: texto de cada card.
  Módulo puro, compartido entre el SSR y el script de polling.
- **`src/lib/llamadas/estados.ts`** — estados canónicos + alias + tonos.
- **`src/components/broadcast/`** — `BroadcastContent` (server island),
  `BroadcastKpiCard`, `LlamadaCard`, `EstadoLlamadaBadge`.
- **`src/pages/broadcast/index.astro`** — página (`server:defer`) + script de
  polling y tick de 1 s para los tiempos.

La página usa `server:defer`: el HTML inicial trae un skeleton y el island
resuelve los datos por su cuenta (no bloquea el render esperando a Wise).

## Datos: widgets, ventana y formato

Env vars (todas con **default**, así que la vista funciona sin configurar nada):

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
| KPIs (Sonando / Activas / En Cola / En IVR) | `getDataReportByWidget` con el widget **464249** (type 53): `total_call_ringing`, `total_call_attended`, `total_call_enqueued`, `total_call_ivr` |
| Detalle fila por fila | `getCallsListData` reusando el widget **464546** (type 76) con series extendidas: `call_num`, `call_agent`, `call_status`, `call_created`, `call_wait_time`, `call_group` |
| Ventana del listado | `call_created IN #Last6Hours#` |
| "Activas" | Es el estado **en curso** de Wise (`total_call_attended`). Se muestra con ese label a pedido de la mesa. |

## Decisiones de diseño

1. **Polling, no websocket.** Wise Analytics usa SignalR (`socketURL` +
   `signalr/hubs`, o SignalR Core en `realtime.a.wcx.cloud` con un JWT que
   rota), pero **solo avisa "hay cambios"**: el dato se pide igual por HTTP y
   el propio front de Wise refresca por polling (`autorefresh: "5s"`). Un
   poller server-side con cache es más simple y no tiene token rotativo.
2. **InvGate quedó afuera de la vista.** El wallboard de TV solo necesitaba el
   estado de las llamadas y el nombre del agente. El código de InvGate
   (`mesaEstado.ts`, `llamadas/service.ts`, `MesaTiEstadoCard.astro`) se
   **conservó sin uso** para una futura vista de detalle (ver Pendientes).
3. **Ventana de 6 h, no del día.** `getCallsListData` devuelve las filas en
   orden **ascendente** y `orderBy: call_created DESC` **no se aplica**: con el
   día completo y `pageSize` acotado, se truncarían justamente las filas más
   recientes (las vivas).
4. **Pantalla completa, no "modo TV" en el layout.** La primera versión hacía
   que `/broadcast` ocultara el sidebar y el navbar modificando
   `BaseLayout.astro`. Se descartó: ahora hay un botón "Pantalla completa"
   (Fullscreen API) y el layout del portal no cambia. Ver `docs/lessons.md`
   (2026-10-21).

## Trampas conocidas de la API de Wise

| Trampa | Detalle |
| --- | --- |
| `data: null` silencioso | Un WQL inválido devuelve `data: null` **sin error de envelope**. Validar `data != null` explícito. |
| `widgetID` atado al tab | Si el widget no existe en el tab: `"Invalid Tab - WidgetID: N - TabID: 0"`. Se puede reusar el ID de un widget existente y cambiar `widget.type`/`config` en el payload. |
| Config incompleta | Con un `widget.config` mínimo el backend responde `data: null`: hay que partir del widget real que devuelve `LoadPage`. |
| Shape de `LoadPage` | Tiene que ser `{ reportValues: { codeCompany, tab_guid } }`. El shape plano devuelve 500 `INVALID_LOGIN`. |
| Estados con dos nombres | El agrupado dice "En Curso" y el detalle "Respondida" para el mismo estado. |
| Fechas | `call_created` viene en **hora local de la cuenta** (-03:00), no en UTC. Parsear con `WISE_CX_TIMEZONE_OFFSET`. |
| `company_ticket` | Viene en **0 en toda la cuenta Me599**: no sirve para cruzar con InvGate. El cruce que sí funciona es agente (Wise) → `GET users` (InvGate) → email. |

## Pendientes / próximos pasos

### 1. Decidir el destino del código de InvGate (sin uso)

`src/lib/invgate/mesaEstado.ts`, `src/lib/llamadas/service.ts` y
`src/components/invgate/MesaTiEstadoCard.astro` están **conservados sin
consumidor**. Resumen: estado de la Mesa de Ayuda TI Nivel 1 (nivel InvGate
`2510`) con casos por estado y agentes con email.

Opciones: publicarlo en `/reportes` o `/mesas-de-ayuda`, o borrar el trío.
Detalle completo en `docs/drafts-issues-broadcast.md` (issue 4).

**Ojo**: la API de InvGate **no expone los "tableros"** (vistas guardadas):
`views`, `reports`, `dashboards`, `boards` y `savedviews` no existen. Lo que sí
se puede listar es el estado de la cola (casos + agente asignado + email).

### 2. Tests de dominio para los normalizadores

Hoy la única cobertura de `classifyLlamadaEstado`, `parseWiseDuration` y
`parseWiseDateTime` es el E2E contra la API real. Faltan tests sin red para:
estados desconocidos, alias ("En Curso"/"Respondida"), duraciones ("1m 30s")
y fechas con offset.

### 3. Dos tests unitarios pre-existentes que fallan

Confirmados con `git stash` (ajenos a esta rama):

- `tests/unit/challenger-remaining-empirical.test.ts` — paginación en
  `OficinasEstadisticasContent` (no usa `[data-page-prev]`/`[data-page-next]`).
- `tests/unit/phase1-buttons-standardization.test.ts` — el botón de export CSV
  de `DirectorioContent` perdió label/clases.

### 4. Verificar las env vars en el `.env` del server

La vista funciona con los defaults, pero conviene fijar las
`WISE_CX_ANALYTICS_*` explícitamente en producción.

### 5. Ideas para después

- **Snapshot histórico en SQLite** (cada 1–5 min) para ver hora pico y
  evolución de la cola. Precedente: `scripts/snapshot-automation-metrics.ts`.
- **Badge de alerta en el sidebar** cuando hay llamadas en cola > X minutos.
- **Tema oscuro forzado** para la TV (muchas salas están en penumbra).
- **Export CSV** de la foto actual.
- **Polling a 5 s** (como Wise) si 10 s se siente lento en la sala.
