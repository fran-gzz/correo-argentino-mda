---
name: admin-crud-pattern
description: Use when adding admin CRUD pages for a new entity in an Astro SSR project with DataTable, server islands, and audit logging
---

# Admin CRUD Pattern

Cada entidad admin requiere **5 archivos** con estructura fija. El listing usa `server:defer` + DataTable; los forms manejan POST con validación, `logAdminAction` y respuesta dual (JSON o redirect).

## Quick Reference

| Archivo | Propósito | Plantilla |
|---------|-----------|-----------|
| `pages/admin/<entity>/index.astro` | Page shell | 11 líneas: Layout + Content + Skeleton |
| `components/admin/<entity>/Admin<Entity>Content.astro` | SSR: datos + DataTable | fetch → gridClasses → DataTable → search script |
| `components/admin/<entity>/Admin<Entity>Skeleton.astro` | Fallback de carga | Mismas gridClasses que Content |
| `pages/admin/<entity>/create.astro` | Form + POST handler | breadcrumb → SectionCard → POST → logAdminAction → redirect |
| `pages/admin/<entity>/edit/[id].astro` | Edit form | SELECT prefill → UPDATE → logAdminAction → redirect |
| `lib/navigation.ts` | **Registro obligatorio** | Agregar NavItem a sección admin |

## Core Rules

1. `headerGridClass` y `rowGridClass` **idénticos** en Content y Skeleton
2. Toda mutación llama `logAdminAction()` antes de responder
3. Cada form maneja respuesta dual: JSON si `Accept: application/json`, redirect si no
4. `server:defer` + skeleton obligatorio en toda página async
5. Toda ruta admin se registra en `navigation.ts`
6. Cada fila en DataTable lleva `data-sort-id`, `data-sort-{key}`, `data-search-text`. Siempre incluir `data-sort-id` aunque la columna ID no se muestre.
7. La búsqueda client-side usa `@lib/clientSearch` (`matchesSearchQuery` + `highlightSearchTargets`), no scripts inline. Copiar el bloque `<script>` de AdminOperadoresContent.astro sin modificaciones.

## File Templates

### Page Shell (`index.astro`)

```astro
---
import BaseLayout from "@layouts/BaseLayout.astro";
import Admin<Entity>Content from "@components/admin/<entity>/Admin<Entity>Content.astro";
import Admin<Entity>Skeleton from "@components/admin/<entity>/Admin<Entity>Skeleton.astro";
---
<BaseLayout>
  <Admin<Entity>Content server:defer>
    <Admin<Entity>Skeleton slot="fallback" />
  </Admin<Entity>Content>
</BaseLayout>
```

### Content (`Admin<Entity>Content.astro`)

Layout: fetch data → define gridClasses → PageContainer → PageHeader → toolbar (search + "Nuevo" button) → DataTable con headers + rows. Cada row incluye `data-sort-*`, `data-search-text`, `ActionEditButton` y `ActionDeleteButton`. Incluir `<script>` con cliente de búsqueda.

### Skeleton (`Admin<Entity>Skeleton.astro`)

Misma estructura que Content pero con `<div class="skeleton">`. `headerGridClass` y `rowGridClass` **deben** coincidir exactamente.

### Create (`create.astro`)

```astro
// POST handler pattern:
if (Astro.request.method === "POST") {
  const isAjax = Astro.request.headers.get('accept')?.includes('application/json');
  try {
    // validar campos
    // db.insert(...).returning(...)
    await logAdminAction(user?.username || 'Sistema', `Creó...`);
    if (isAjax) { return new Response(JSON.stringify({...}), {...}); }
    return Astro.redirect(`...?toast_msg=...&toast_type=success`);
  } catch (e) {
    // error handling
    if (isAjax) { return new Response(JSON.stringify({...}), { status: 400, ... }); }
  }
}
```

Incluir `<AsyncFormScript />` al final del layout para soporte AJAX.

### Edit (`edit/[id].astro`)

Mismo patrón que create pero: SELECT previo para pre-fill, `db.update()` en POST, validación de `id` + redirect si no existe. Incluir `data-async-form` en `<form>`.

## Common Mistakes

- Grid classes que NO coinciden entre Content y Skeleton → layout roto durante carga
- Olvidar `logAdminAction()` → la auditoría pierde la acción
- No manejar respuesta AJAX → el modal de creación no cierra automáticamente
- Olvidar registro en `navigation.ts` → la ruta no aparece en sidebar, header ni command palette
- Faltan `data-sort-*` en filas → las columnas no son ordenables
- No incluir `<AsyncFormScript />` → el form no funciona como AJAX

## When Not to Use

- Categorías embebidas en entidad padre (solo create/edit, sin index propio)
- Páginas públicas o de solo lectura (no admin CRUD)
- APIs que no gestionan entidades CRUD
