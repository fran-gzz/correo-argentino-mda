---
trigger: always_on
---

description: Apply Astro project conventions. Loaded automatically for any task involving components, layouts, pages, images, SSR, endpoints, client directives, import aliases, or icons in an Astro project.
applyTo: '**/*.astro, astro.config.mjs, tsconfig.json, src/**/*.ts'

## Alcance

Estas instrucciones aplican a cualquier tarea que involucre:
- Estructura de archivos y carpetas del proyecto
- Componentes, layouts y paginas de Astro
- Directivas de cliente y manejo de interactividad
- Imagenes, fuentes y assets
- SSR y endpoints de servidor

## Estructura de archivos

Respetar siempre esta estructura:

src/
  layouts/
    BaseLayout.astro        — layout principal con head, meta y fuentes
  components/
    ui/                     — componentes atomicos: Button, Card, Badge, etc.
    sections/               — secciones completas: Hero, Features, CTA, etc.
    global/                 — Navbar, Footer y elementos globales
  lib/                      — acceso a datos y logica de negocio
  types/                    — interfaces y tipos TypeScript
  pages/                    — una archivo por ruta, sin logica de negocio

docs/
  mockups/                  — wireframes, capturas y referencias visuales
    .gitkeep                — mantener en git aunque este vacia

## Componentes

- Nombres en PascalCase: HeroSection.astro, ContactForm.astro
- Props tipadas siempre con TypeScript en el frontmatter
- Un componente por archivo
- Sin logica de negocio en componentes de UI: solo presentacion
- Usar slots de Astro para contenido dinamico cuando aplique

Ejemplo de componente bien estructurado:

  ---
  interface Props {
    title: string
    description?: string
    variant?: 'primary' | 'secondary'
  }
  const { title, description, variant = 'primary' } = Astro.props
  ---
  <div class="card bg-base-100 shadow">
    <div class="card-body">
      <h2 class="card-title">{title}</h2>
      {description && <p>{description}</p>}
    </div>
  </div>

## Directivas de cliente

Elegir la directiva correcta para cada caso:

  client:load      — interactividad necesaria inmediatamente al cargar
  client:visible   — interactividad cuando el componente entra en viewport
  client:idle      — interactividad cuando el navegador esta libre
  client:media     — interactividad segun un media query
  client:only      — componente renderizado solo en cliente, sin SSR

Preferir client:visible sobre client:load salvo que la interactividad
sea necesaria antes de que el usuario haga scroll.

## Imagenes

Usar siempre el componente Image de Astro para imagenes locales y remotas:

  ---
  import { Image } from 'astro:assets'
  ---
  <Image src={imagenLocal} alt="descripcion de la imagen" />
  <Image src="https://placehold.co/800x450" alt="descripcion" width={800} height={450} />

Nunca usar la etiqueta img directa para imagenes que Astro puede optimizar.

## BaseLayout

El BaseLayout centraliza todo lo que va en el head y define la estructura
visual de todas las paginas. Todas las paginas deben usar BaseLayout
o un layout que extienda de el.

Incluye obligatoriamente:
- meta charset y viewport
- title dinamico por pagina
- meta description dinamico por pagina
- OG tags: og:title, og:description, og:image
- Importacion de fuentes (segun STACK.md)
- Configuracion del tema DaisyUI via atributo data-theme (segun DESIGN.md)
- Navbar y Footer globales
- Estructura de columna flex que empuja el footer al fondo siempre

### Estructura obligatoria del body

El body usa flex-col con min-h-screen para que el footer siempre quede
pegado al borde inferior, incluso en paginas con poco contenido.
El main tiene flex-1 para ocupar todo el espacio disponible entre
el Navbar y el Footer.

  <body class="flex flex-col min-h-screen">
    <Navbar />
    <main class="flex-1">
      <slot />
    </main>
    <Footer />
  </body>

Nunca usar:
  <body>
    <slot />   ← el Navbar y Footer los pone cada pagina por su cuenta
  </body>

Nunca usar height fija ni padding-bottom para compensar el footer.
El patron flex-col + min-h-screen + flex-1 lo resuelve sin hacks.

### Codigo completo del BaseLayout

  ---
  import '@styles/global.css'
  import Navbar from '@components/global/Navbar.astro'
  import Footer from '@components/global/Footer.astro'

  interface Props {
    title: string
    description: string
    ogImage?: string
  }

  const { title, description, ogImage = '/og-default.png' } = Astro.props
  ---

  <html lang="es" data-theme="nombre-del-tema">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width" />
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={ogImage} />
    </head>
    <body class="flex flex-col min-h-screen">
      <Navbar />
      <main class="flex-1">
        <slot />
      </main>
      <Footer />
    </body>
  </html>

El valor de data-theme se gestiona con theme-change (ver seccion
siguiente). El import de global.css va siempre en el BaseLayout,
nunca en paginas ni componentes individuales.

Navbar y Footer se importan SOLO en BaseLayout, nunca en paginas
individuales. Si una pagina no los necesita (ej: login a pantalla
completa), crear un layout alternativo que extienda de BaseLayout
omitiendo uno o ambos.

### Gestion del tema con theme-change

Dependencia obligatoria en todos los proyectos:

  npm install theme-change

El control del tema claro/oscuro usa theme-change junto con DaisyUI.
El atributo data-theme NO va hardcodeado en el html — lo gestiona
el script de theme-change leyendo y escribiendo localStorage.

Dos scripts obligatorios en el <head> del BaseLayout, en este orden:

  <head>
    <!-- Script 1: inline — aplica el tema guardado ANTES de que
         la pagina se renderice, evitando el flash de tema incorrecto.
         Debe ser is:inline para ejecutarse de forma sincrona. -->
    <script is:inline>
      if (localStorage.getItem("theme") === null) {
        document.documentElement.setAttribute("data-theme", "nombre-del-tema-default");
      } else {
        document.documentElement.setAttribute(
          "data-theme",
          localStorage.getItem("theme"),
        );
      }
    </script>

    <!-- Script 2: inicializa theme-change para que los botones
         con data-toggle-theme funcionen automaticamente -->
    <script>
      import { themeChange } from "theme-change";
      themeChange();
    </script>
  </head>

El primer script usa is:inline para ejecutarse de forma sincrona
antes del render — sin esto la pagina parpadea con el tema incorrecto
al cargar. El segundo script puede ser async normal.

Reemplazar "nombre-del-tema-default" con el tema definido en
DESIGN.md. Si el tema aun no esta definido, usar "light".

El boton de toggle en el Navbar usa el atributo data-toggle-theme
de DaisyUI con los dos temas separados por coma:

  <button
    data-toggle-theme="light,dark"
    data-act-class="ACTIVECLASS"
    aria-label="Cambiar tema"
    type="button"
  >
    <Icon name="heroicons:contrast" />
  </button>

### Codigo completo del BaseLayout con theme-change

  ---
  import '@styles/global.css'
  import Navbar from '@components/global/Navbar.astro'
  import Footer from '@components/global/Footer.astro'

  interface Props {
    title: string
    description: string
    ogImage?: string
  }

  const { title, description, ogImage = '/og-default.png' } = Astro.props
  ---

  <html lang="es">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width" />
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={ogImage} />

      <script is:inline>
        if (localStorage.getItem("theme") === null) {
          document.documentElement.setAttribute("data-theme", "light");
        } else {
          document.documentElement.setAttribute(
            "data-theme",
            localStorage.getItem("theme"),
          );
        }
      </script>
      <script>
        import { themeChange } from "theme-change";
        themeChange();
      </script>
    </head>
    <body class="flex flex-col min-h-screen">
      <Navbar />
      <main class="flex-1">
        <slot />
      </main>
      <Footer />
    </body>
  </html>

Notar que data-theme ya no esta en el elemento html — lo aplica
el script de theme-change dinamicamente. Sin ese script el atributo
no existiria hasta que el JS cargue, causando flash visual.

## Comandos utiles de Astro

  npx astro dev          — servidor de desarrollo local
  npx astro build        — construir el proyecto para produccion
  npx astro check        — verificar errores de tipos en archivos .astro
  npx astro sync         — regenerar tipos de modulos de Astro (astro:assets,
                           astro:content, etc.) despues de agregar integraciones
                           o cambiar la configuracion

Ejecutar astro check antes de cualquier commit que involucre cambios
en componentes o layouts.

## Configuracion base

La opcion site en astro.config.mjs es obligatoria en proyectos publicos.
Astro la usa para generar el sitemap y las URLs canonicas correctamente:

  export default defineConfig({
    site: 'https://mi-proyecto.vercel.app',
    ...
  })

Configurar con la URL de produccion real una vez que el proyecto
este desplegado en Vercel.

## Paginas

- Una pagina por archivo en src/pages/
- Sin logica de negocio ni queries directas en paginas
- Importar datos desde src/lib/
- Pasar datos a componentes via props

## Variables de entorno

- Variables publicas (accesibles en cliente): prefijo PUBLIC_
- Variables privadas (solo servidor): sin prefijo
- Nunca exponer variables privadas en componentes de cliente
- Acceder siempre via import.meta.env.NOMBRE_VARIABLE

## Alias de imports

Todos los proyectos usan estos alias definidos en tsconfig.json.
Usarlos siempre en imports. Nunca usar rutas relativas largas como
../../components o ../../../lib.

  @/*                src/*
  @components/*      src/components/*
  @layouts/*         src/layouts/*
  @lib/*             src/lib/*
  @styles/*          src/styles/*
  @assets/*          src/assets/*
  @instructions/*    .github/instructions/*

Correcto:
  import Button from '@components/ui/Button.astro'
  import { getArticles } from '@lib/articles'
  import { supabase } from '@lib/supabase/client'

Incorrecto:
  import Button from '../../components/ui/Button.astro'
  import { getArticles } from '../../../lib/articles'

Estos alias estan configurados en tsconfig.json y en astro.config.mjs.
Verificar que ambos archivos los tienen antes de usarlos.

## Iconos

Usar siempre astro-icon para iconos en cualquier componente de Astro.

  ---
  import { Icon } from 'astro-icon/components'
  ---
  <Icon name="heroicons:home" />
  <Icon name="lucide:arrow-right" />
  <Icon name="tabler:brand-github" />

Sets de iconos disponibles: heroicons, lucide, tabler.
Elegir el set mas apropiado para el proyecto y mantenerlo consistente.
No mezclar sets de iconos dentro del mismo proyecto salvo necesidad
especifica y justificada en DESIGN.md.

Siempre agregar aria-label cuando el icono comunica informacion
y no tiene texto visible acompanandolo:

  <Icon name="heroicons:search" aria-label="Buscar" />

Iconos decorativos con aria-hidden:

  <Icon name="heroicons:sparkles" aria-hidden="true" />

Nunca usar emojis como iconos de interfaz.