# Tarea: Implementar Header operativo segun contrato aprobado
Fecha: 2026-04-17

## Descripcion
Implementar en codigo la Barra Superior (Header/Topbar) para cumplir el contrato UX del portal: componente sticky, orientacion contextual por ruta activa, quick actions globales y comportamiento responsive para operaciones N1/N2.

## Riesgos identificados
- Interferencia entre scripts del Header (paleta de comandos, toggle de tema y atajos de teclado) que afecte interacciones globales.
- Doble ubicacion de preferencias si el toggle de tema no se centraliza en Header.
- Regresion de navegacion en mobile si el trigger del drawer pierde prioridad o visibilidad.
- Problemas de contraste/percepcion visual si el Header queda con estilos pesados y no respeta tokens semanticos.

## Plan de ejecucion

[x] Paso 1 — ui-designer: redisenar estructura del Header en BaseLayout con enfoque sticky y jerarquia visual reducida.
    Criterio de exito: Header anclado arriba, superficie discreta con tokens semanticos y sin CTAs pesados.

[x] Paso 2 — ui-designer: implementar zona contextual izquierda y zona de herramientas globales derecha en el orden definido.
    Criterio de exito: contexto dinamico de ruta visible en desktop y herramientas A/B/C disponibles (busqueda, preferencias, alertas/ayuda).

[x] Paso 3 — ui-designer: implementar busqueda maestra responsive con paleta/modal y atajo Ctrl/Cmd+K.
    Criterio de exito: trigger desktop y mobile abren dialog, filtro de accesos funciona y cierre opera con Escape/click fuera.

[x] Paso 4 — ui-designer: limpiar duplicaciones y sincronizar layout lateral con el nuevo Header.
    Criterio de exito: toggle de tema removido del sidebar, login preservado en sidebar y scripts del Header tipados sin errores.

[x] Paso 5 — qa-reviewer: validar comportamiento integral, ejecutar checks y cerrar con commit.
    Criterio de exito: validacion visual/funcional del Header en desktop/mobile, `astro check` y `build` en verde, y commit final creado.

## Agentes involucrados
- ui-designer
- qa-reviewer

## Criterio de exito global
El Header queda implementado como epicentro operativo global, cumpliendo sticky, contexto dinamico, quick actions y consistencia visual semantica sin romper navegacion ni build.

## Resultado de revision — 2026-04-17

### Aprobado
- Header sticky, delgado y no invasivo validado visualmente en mobile (390x844), tablet (768x1024) y desktop (1280x800).
- Zona izquierda con contexto dinamico de ruta validada y ocultamiento en mobile ajustado en QA final.
- Zona derecha validada en orden A/B/C: busqueda maestra, preferencias (theme toggle) y alertas/ayuda.
- Botones y quick actions usando `btn-ghost`, divisor logico y tokens semanticos (`base-*`, `primary`, `secondary`).
- Paleta/modal de busqueda validada en desktop y mobile: apertura por boton y `Ctrl+K`, cierre por `Escape` y click fuera, filtro operativo.
- Toggle de tema centralizado en Header validado, sin duplicado en sidebar; login preservado en navegacion lateral.
- Validacion tecnica: `npm run astro -- check` sin errores (0 errors, 0 warnings, 4 hints) y `npm run build` exitoso (exit code 0).

### Requiere correccion
- Ninguna pendiente dentro del alcance de la tarea.

### Bloqueantes para completar la tarea
- Ninguno.