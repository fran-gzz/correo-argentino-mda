# Tarea: Reestructurar rutas y eliminar seccion de documentacion
Fecha: 2026-04-17

## Descripcion
Aplicar cambios funcionales para alinear rutas y paginas al sitemap objetivo del portal, eliminando todo rastro funcional de la seccion de documentacion y ajustando la navegacion principal para el flujo operativo N1/N2.

## Riesgos identificados
- Rotura de accesos guardados si se eliminan rutas legadas sin estrategia de compatibilidad.
- Navegacion inconsistente si BaseLayout y paginas no quedan sincronizados en el mismo cambio.
- Errores de build si se elimina documentacion sin limpiar colecciones e integraciones asociadas.
- Regresion en rutas privadas si middleware no se actualiza junto con el renombre de oficinas.
- Eliminacion accidental de contenido util no relacionado si la limpieza no se limita al alcance funcional.

## Plan de ejecucion

[x] Paso 1 — fullstack: ejecutar auditoria tecnica de rutas y dependencias para cerrar alcance exacto de eliminacion.
    Criterio de exito: lista confirmada de archivos a tocar para rutas, navegacion, middleware y configuracion, sin ambiguedades.

[x] Paso 2 — fullstack: aplicar nuevo mapa de rutas del portal, incluyendo renombre funcional de oficinas a directorio y alta de vistas faltantes del roadmap.
    Criterio de exito: existen y responden las rutas objetivo del sitemap, y las rutas obsoletas quedan retiradas o cubiertas por estrategia de transicion definida.

[x] Paso 3 — fullstack: eliminar la seccion de documentacion del codigo funcional.
    Criterio de exito: se retira pagina de documentacion, referencias en navegacion y pagina de inicio, coleccion documentacion en content config y cualquier uso funcional asociado.

[x] Paso 4 — fullstack: sincronizar navegacion principal y guardas de acceso con las rutas finales.
    Criterio de exito: BaseLayout refleja solo modulos vigentes y middleware usa el set final de rutas privadas sin referencias antiguas.

[x] Paso 5 — qa-reviewer: validar el resultado integral, ejecutar chequeos de calidad y cerrar con commit.
    Criterio de exito: navegacion sin enlaces rotos, rutas nuevas accesibles, rutas retiradas sin rastro funcional, verificacion tecnica en verde y commit final creado.

## Agentes involucrados
- fullstack
- qa-reviewer

## Criterio de exito global
El portal queda alineado funcionalmente al sitemap objetivo, sin seccion de documentacion en rutas ni navegacion, con configuracion limpia y sin regresiones de compilacion o navegacion.

## Resultado de revision — 2026-04-17

### Aprobado
- Se valido el sitemap objetivo de 11 vistas con respuesta HTTP 200 en: `/`, `/titulos-tickets`, `/buscador-usuarios`, `/directorio-oficinas`, `/guia-soportes`, `/cronograma`, `/cubics`, `/mapa-sucursales`, `/inventario-terminales`, `/enlaces-importantes`, `/configuracion`.
- Se verifico que las rutas legacy removidas devuelven 404: `/documentacion`, `/design-system`, `/oficinas-telegrafia`.
- Se confirmo sincronizacion de navegacion en layout principal con enlaces operativos a las 11 vistas del sitemap y acceso separado a `/login`.
- Se confirmo limpieza funcional de documentacion: sin integracion MDX en `astro.config.mjs`, sin coleccion activa en `src/content.config.ts` y sin paginas funcionales de documentacion/design-system.
- Validacion tecnica final completada: `npm run astro -- check` sin errores y `npm run build` exitoso.

### Requiere correccion
- Ninguna en el alcance de esta tarea.

### Bloqueantes para completar la tarea
- Ninguno.