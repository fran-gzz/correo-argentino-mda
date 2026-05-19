# Plan de Trabajo - Implementación de Rutas Relativas y BASE_URL

## Objetivo
- Configurar el proyecto para soportar despliegues bajo subdirectorios corporativos (ej: `/mda/`) sin rutas URL absolutas duras.
- Refactorizar las rutas de navegación, redirecciones y recursos estáticos para usar `import.meta.env.BASE_URL`.

## Tareas

### 1. Configuración de Astro
- [x] Modificar `astro.config.mjs` para incluir la propiedad `base: "/mda"`.

### 2. Inferencia de Rutas y Navegación
- [x] Adaptar `src/lib/navigation.ts` para que la inferencia de títulos `getSectionTitle` soporte rutas con el prefijo `base`.
- [x] Crear un helper de resolución de URL en `src/layouts/BaseLayout.astro` (o consumirlo globalmente).
- [x] Refactorizar el render de enlaces de `navSections` en `BaseLayout.astro` utilizando la URL resuelta.
- [x] Refactorizar el redireccionamiento y favicons en la cabecera del `BaseLayout.astro`.

### 3. Refactorización de Enlaces y Assets en Páginas
- [x] Refactorizar los enlaces y redirecciones en `src/pages/supervision/cronograma/index.astro`.
- [x] Refactorizar los enlaces y redirecciones en `src/pages/supervision/calidad-operadores/index.astro`.
- [x] Refactorizar los enlaces en `src/pages/enlaces-recursos/_components/ImportantLinksView.astro`.
- [x] Refactorizar los enlaces en `src/pages/buscador-usuarios/index.astro`.
- [x] Refactorizar los enlaces en `src/pages/admin/cubics/index.astro`.
- [x] Refactorizar los enlaces en `src/pages/admin/offices/index.astro`.
- [x] Refactorizar los enlaces en `src/pages/admin/cubics/[id].astro`.
- [x] Refactorizar los enlaces en `src/pages/admin/offices/[id].astro`.

### 4. Middleware y Autenticación
- [x] Modificar `src/middleware.ts` para procesar y validar rutas relativas al subdirectorio base, y corregir los redireccionamientos de autenticación.
- [x] Modificar `src/pages/login/index.astro` para redirigir usando el path absoluto con `base`.
- [x] Modificar `src/pages/logout.ts` para redirigir usando el path absoluto con `base`.

### 5. Validación
- [x] Ejecutar compilación de producción (`npm run build`) para verificar que todos los recursos se ubiquen correctamente en `/mda/` y no existan errores de TypeScript.
