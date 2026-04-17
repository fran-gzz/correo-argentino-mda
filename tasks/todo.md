# Tarea: Documentar contrato de Barra Superior (Header/Topbar)
Fecha: 2026-04-17

## Descripcion
Actualizar las directrices de diseno y arquitectura para definir formalmente que es y como se comporta la Barra Superior del portal, incluyendo su rol de orientacion global, quick actions, reglas responsive y restricciones visuales.

## Riesgos identificados
- Desalineacion entre la especificacion nueva del Header y la implementacion actual en BaseLayout (hoy no cumple sticky ni zonas funcionales completas).
- Contradicciones entre PROJECT_CONTEXT, DESIGN_SYSTEM y README si la regla se documenta con distinto nivel de detalle en cada archivo.
- Ambiguedad en comportamiento responsive si no se explicita que se oculta en mobile y que se contrae a iconos/modal.
- Regresion futura de consistencia visual si no queda explicitada la regla de botones ghost, agrupacion por divisores y uso de tokens semanticos.

## Plan de ejecucion

[x] Paso 1 — ui-designer: auditar estado actual del layout y mapear gap entre Header implementado y Header objetivo definido por la directriz.
    Criterio de exito: se registra claramente estado actual vs comportamiento objetivo (sticky, contexto dinamico, quick actions y responsive).

[x] Paso 2 — ui-designer: actualizar PROJECT_CONTEXT.md con la especificacion funcional completa de la Barra Superior.
    Criterio de exito: PROJECT_CONTEXT incluye concepto, estructura por zonas, comportamiento responsive, quick actions, alertas y reglas de intervencion del Header.

[x] Paso 3 — ui-designer: actualizar DESIGN_SYSTEM.md con reglas de arquitectura visual y de componentes para Header/Topbar.
    Criterio de exito: DESIGN_SYSTEM define jerarquia visual reducida, uso de botones ghost, agrupacion con divisores, consistencia por tokens semanticos y comportamiento sticky por defecto.

[x] Paso 4 — ui-designer: sincronizar README.md y cualquier guia operativa breve para que onboarding y contexto rapido reflejen la nueva directriz del Header.
    Criterio de exito: README mantiene una version resumida y consistente de la funcion del Header sin contradecir PROJECT_CONTEXT ni DESIGN_SYSTEM.

[x] Paso 5 — qa-reviewer: validar consistencia documental integral y cerrar con commit.
    Criterio de exito: no hay contradicciones entre documentos, la especificacion del Header queda trazable y se crea commit final de documentacion.

## Agentes involucrados
- ui-designer
- qa-reviewer

## Criterio de exito global
El proyecto queda con una especificacion unica y clara de la Barra Superior, consistente entre contexto, sistema de diseno y guias operativas, sirviendo como contrato de implementacion para futuros cambios de UI.

## Resultado de revision — 2026-04-17

### Aprobado
- Se verifico que PROJECT_CONTEXT.md, DESIGN_SYSTEM.md y README.md incorporan el contrato del Header con: rol critico, comportamiento sticky, zona izquierda contextual con ocultamiento en mobile, zona derecha A/B/C en orden y reglas visuales (ghost, divisores, tokens semanticos).
- Se valido trazabilidad honesta de estado actual vs objetivo en los tres documentos, sin declarar funcionalidades inexistentes como implementadas.
- Se confirmo consistencia transversal entre documentos, sin contradicciones funcionales o de direccion UX para Header/Topbar.
- Verificacion tecnica ejecutada: `npm run build` OK y `npx astro check` sin errores (solo warnings/hints preexistentes fuera del alcance documental).

### Requiere correccion
- Ninguna en el alcance de esta tarea documental.

### Bloqueantes para completar la tarea
- Ninguno.