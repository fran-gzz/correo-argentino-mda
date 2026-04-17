# Portal de la Mesa de Ayuda Interna

Portal interno de Correo Argentino orientado a soporte corporativo logistico
y postal. El objetivo es centralizar y agilizar el trabajo diario de
operadores N1/N2.

## Objetivo principal

Unificar en una sola plataforma:
- tipificacion de tickets
- busqueda de personal
- monitoreo de terminales
- gestion de carga laboral

## Sistema UX/UI aprobado

- Tipografia legible para UI y tipografia monoespaciada para datos tecnicos.
- Soporte claro/oscuro global con selector de tema.
- Acentos institucionales amarillo/azul con estados semanticos consistentes.
- Interacciones de copia rapida para acelerar tareas operativas.
- Idioma en espanol con sentence case en titulos y textos de interfaz.

## Stack real del proyecto

- Astro (output server) + adapter Vercel
- Tailwind CSS + DaisyUI
- Supabase + Supabase Auth
- MDX + astro-icon

## Estado actual vs roadmap

Rutas implementadas hoy:
- /
- /titulos-tickets
- /documentacion
- /guia-soportes
- /buscador-usuarios
- /oficinas-telegrafia
- /cubics
- /configuracion
- /design-system
- /login

Roadmap funcional objetivo (11 vistas):
- /
- /titulos-tickets
- /buscador-usuarios
- /directorio-oficinas
- /guia-soportes
- /cronograma
- /cubics
- /mapa-sucursales
- /inventario-terminales
- /enlaces-importantes
- /configuracion

Gap principal documentado:
- El roadmap define /directorio-oficinas, mientras que en el repo actual existe
  /oficinas-telegrafia.
- /cronograma, /mapa-sucursales, /inventario-terminales y
  /enlaces-importantes aun no tienen implementacion.

## Reglas de intervencion

- Mantener consistencia modular visual (contenedores, tarjetas y limpieza).
- Si se agrega una ruta, registrar en el orquestador principal de navegacion:
  src/layouts/BaseLayout.astro (arreglo navItems) y reflejar el cambio en la
  navegacion dinamica de sidebar/topbar cuando aplique.
- Usar colores semanticos del sistema (tokens DaisyUI) para componentes nuevos.

## Documentos de referencia

- PROJECT_CONTEXT.md
- DESIGN_SYSTEM.md
- STACK.md
