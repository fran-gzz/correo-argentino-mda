# Borradores de issues — vista "Broadcast" de llamadas (2026-10-21)

En esta sesion no estaban disponibles el MCP `github` ni la skill `managing-github-issues`, asi que
los hallazgos quedan aca para publicar cuando se restablezca el acceso (mismo criterio que
`docs/drafts-issues-calidad-ia.md`).

Repo destino: `ignaciorevainera/correo-argentino-mda` (upstream).
Labels del catalogo cerrado: `bug`, `tech-debt`, `test`, `documentation`.

---

## 1. `bug(oficinas): los botones de paginacion de EstadisticasContent no usan los hooks de data-page-prev/next`

Labels: `bug`, `test`

### Diagnostico / Problema

`src/components/inventario/EstadisticasTerminalesContent.astro` tiene botones de paginacion, pero
el script cliente no consulta `[data-page-prev]` / `[data-page-next]`: el test
`tests/unit/challenger-remaining-empirical.test.ts` lo falla. El resultado es que la paginacion de
las estadisticas de oficinas no cambia de pagina (o cambia con un mecanismo no documentado y no
testeable).

### Evidencia / Causa

- `tests/unit/challenger-remaining-empirical.test.ts` ("2. Pagination Buttons in
  OficinasEstadisticasContent and ActionButton.astro"): falla antes y despues de la rama de
  "Broadcast" (verificado con `git stash` el 2026-10-21) -> **pre-existente, no regresion**.
- El assert busca `document.querySelector("[data-page-prev]")` y `document.querySelector("[data-page-next]")`
  en el script del componente.

### Propuesta / Solucion

1. Normalizar los selectores de paginacion a `[data-page-prev]` / `[data-page-next]` en el componente,
   como ya usa el resto del portal.
2. Si la paginacion actual funciona por otro mecanismo, documentarlo y actualizar el assert para que
   verifique comportamiento (cambia la pagina renderizada) y no el selector literal.

### Criterios de Aceptacion

- [ ] `npm run test:unit` pasa sin el fallo de `challenger-remaining-empirical.test.ts`.
- [ ] La paginacion de `/oficinas/estadisticas` cambia el conjunto de filas y la URL/pagina visible.

---

## 2. `fix(directorio): el boton de export CSV de DirectorioContent pierde label y clases`

Labels: `bug`, `test`

### Diagnostico / Problema

El boton de export CSV de `src/components/offices/DirectorioContent.astro` ya no matchea el patron
esperado (`id="export-csv-btn"` con `font-semibold` y las clases de `ActionButton`). El test
`tests/unit/phase1-buttons-standardization.test.ts` (#324) falla.

### Evidencia / Causa

- `tests/unit/phase1-buttons-standardization.test.ts` ("verifies DirectorioContent.astro export CSV
  ActionButton preserves label, download attribute and classes"): falla antes y despues de la rama de
  "Broadcast" (verificado con `git stash` el 2026-10-21) -> **pre-existente, no regresion**.
- El assert espera `/id="export-csv-btn"[^>]*font-semibold.../s` sobre el markup renderizado.

### Propuesta / Solucion

1. Revisar si el boton se movio de componente o cambio de markup: si el comportamiento de export
   sigue intacto, actualizar el assert para que valide comportamiento (descarga un CSV) y no la
   forma exacta del markup.
2. Si el export quedo roto, volver a engancharlo al `ActionButton` estandar conservando
   `label`, `download` y `font-semibold`.

### Criterios de Aceptacion

- [ ] `npm run test:unit` pasa sin el fallo de `phase1-buttons-standardization.test.ts`.
- [ ] El CSV de `/oficinas` se descarga con los datos del directorio y nombre de archivo correcto.

---

## 3. `test(wise): la API de Wise CX Analytics no tiene cobertura propia`

Labels: `test`, `tech-debt`

### Diagnostico / Problema

La vista `/broadcast` depende de `analytics.wcx.cloud/Reports.svc/*`, una API de terceros sin
versionado ni SLA, y hoy solo la cubre un E2E que pega a produccion. Los normalizadores puros
(estados de llamada, duracion, offset de fecha) no tienen test propio, y un cambio de Wise
(por ejemplo, un estado nuevo o un `data: null` silencioso) se descubre recien en runtime.

### Evidencia / Causa

- `src/lib/llamadas/estados.ts`: `classifyLlamadaEstado` y `normalizeLlamadaText` son logica pura con
  aliases que ya hicieron falta en produccion (el agrupado de Wise dice "En Curso" y el detalle
  "Respondida" para el mismo estado).
- `src/lib/wise-cx-calls.ts`: `parseWiseDuration` y `parseWiseDateTime` dependien del formato de Wise
  (duracion "1m 30s", fecha local de cuenta).
- `tests/broadcast.spec.ts`: unico cobertura, y es contra la API real.

### Propuesta / Solucion

1. Agregar tests de dominio (sin red) para `classifyLlamadaEstado` (incluyendo estados
   desconocidos), `parseWiseDuration` y `parseWiseDateTime` con offset.
2. Agregar en el E2E un caso con respuesta mockeada de `Reports.svc` para no depender de que
   haya llamadas vivas en el momento del test.

### Criterios de Aceptacion

- [ ] Los normalizadores de estado/duracion/fecha tienen cobertura propia.
- [ ] El E2E de la vista sigue pasando sin depender de que haya llamadas activas en Wise.

---

## 4. `refactor(broadcast): la integracion con InvGate quedo sin uso al convertir la vista en wallboard de TV`

Labels: `tech-debt`, `architecture`

### Diagnostico / Problema

La vista `/broadcast` se armo originalmente (ruta `/llamadas`) con dos fuentes: Wise CX (KPIs y
detalle de llamadas) e InvGate (estado de la Mesa de Ayuda TI Nivel 1 + email de los agentes). Al
convertirla en un wallboard de TV se decidio mostrar solo los 4 estados de llamada y el nombre del
agente, asi que **el dato de InvGate quedo sin consumidor** y el modulo quedo conservado "para
despues".

Hoy hay codigo muerto que puede confundir al proximo que lo lea:
- `src/lib/invgate/mesaEstado.ts` (consulta la cola del nivel 2510 y arma el resumen).
- `src/lib/llamadas/service.ts` (agrega Wise + InvGate y cruza agente -> email).
- `src/components/invgate/MesaTiEstadoCard.astro` (la tarjeta que se mostraba en la vista).

Ademas, la API de InvGate **no expone los "tableros" (vistas guardadas)**: `views`, `reports`,
`dashboards`, `boards` y `savedviews` no existen. Si lo que se quiere es una vision de la mesa
(tableros + agentes), hay que resolverlo con el estado de la cola, con scraping de la UI, o
pidiendo que InvGate exponga el listado de vistas.

### Evidencia / Causa

- Decision de producto del 2026-10-21: `/broadcast` se proyecta en una TV de la mesa; el detalle de
  casos por agente no aporta ahi y agrega una dependencia externa a un tablero que se refresca cada
  10 s.
- Verificacion de la API de InvGate (produccion, 2026-10-21): los endpoints de vistas no existen.
  Detalle en `docs/lessons.md` (2026-10-21).

### Propuesta / Solucion

1. Decidir el destino del dato de InvGate:
   - **a)** Publicar el estado de la mesa (casos por estado + agentes con email) en una vista de
     detalle o en `/reportes`, reutilizando `mesaEstado.ts` y `MesaTiEstadoCard.astro`.
   - **b)** Borrar el trio de archivos si la integracion con InvGate no se va a usar mas.
2. Si se elige (a), la vista nueva debe tener su propio endpoint (cache propia) para no hacer que
   el wallboard de TV dependa de InvGate.

### Criterios de Aceptacion

- [ ] No queda codigo sin consumidor en el repo, o queda documentado donde se usa.
- [ ] `/broadcast` no hace requests a InvGate (verificable en el log del server).
