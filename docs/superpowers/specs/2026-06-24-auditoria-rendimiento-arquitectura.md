# Auditoría de Rendimiento y Arquitectura

**Fecha:** 2026-06-24
**Proyecto:** correo-argentino-mda (Portal Mesa de Ayuda)
**Stack:** Astro v5 SSR + Tailwind v4 + DaisyUI v5 + Drizzle ORM + SQLite + React islands

---

## Resumen Ejecutivo

Se identificaron **16 hallazgos** categorizados por severidad:

| Severidad | Cantidad |
|-----------|----------|
| 🔴 Alta | 6 |
| 🟡 Media | 6 |
| 🟢 Baja | 4 |

Los hallazgos críticos impactan en seguridad (`checkOrigin: false`), rendimiento (~13 MB de assets huérfanos), y mantenibilidad (~700 líneas de boilerplate modal duplicado).

---

## 1. Dependencias y Configuración

### 1.1 🔴 `@libsql/client` y `@astrojs/mdx` en `dependencies` — No utilizados

- `@libsql/client` (Turso/libSQL driver) nunca se importa. La DB usa `better-sqlite3`.
- `@astrojs/mdx` no está registrado en las integraciones de Astro ni se usa ningún archivo `.mdx`.
- **Impacto:** 0.17 MB de espacio muerto en `node_modules`.
- **Fix:** Remover ambos de `dependencies`.

### 1.2 🟡 `typescript` y `@astrojs/check` en `dependencies`

Deberían estar en `devDependencies`. No son dependencias de runtime.

### 1.3 🟡 `cheerio` en `dependencies`

Solo se usa en `scripts/fix-drizzle-mismatch.ts` (script de una sola vez). Debe moverse a `devDependencies`.

### 1.4 🟡 `glob` en `devDependencies` — No utilizado

No hay ningún `import ... from "glob"` en el código fuente.

### 1.5 🔴 `security.checkOrigin: false` en `astro.config.mjs`

Desactiva la validación CSRF/origen de Astro para formularios POST. **Riesgo de seguridad** para páginas admin con endpoints de mutación.
- **Fix:** Setear a `true` o agregar comentario justificando por qué se requiere `false`.

### 1.6 🟡 `NODE_ENV="development"` hardcodeado en esbuild define

```js
vite: { optimizeDeps: { esbuildOptions: { define: { "process.env.NODE_ENV": '"development"' } } } }
```

Durante `astro build` (producción), React podría ejecutar code paths de desarrollo. Posible copy-paste leftover.
- **Fix:** Remover el bloque `optimizeDeps` o condicionarlo a `import.meta.env.DEV`.

### 1.7 🟡 Alias `@middleware/*` apunta a directorio inexistente

`tsconfig.json` mapea `@middleware/*` a `./src/middleware/*`, pero `middleware.ts` es un archivo, no un directorio.
- **Fix:** Mapear a `./src` (igual que `@/*`) o remover el alias.

---

## 2. Assets y Build Output

### 2.1 🔴 ~13 MB de screenshots PNG en `public/images/`

| Archivo | Tamaño |
|---------|--------|
| inventario-equipos.png | 2,248 KB |
| supervision.png | 1,972 KB |
| contactos.png | 1,441 KB |
| catalogo-aplicativos.png | 1,424 KB |
| generador-firmas.png | 1,290 KB |
| admin.png | 1,106 KB |
| guia-soportes.png | 967 KB |
| directorio-oficinas.png | 946 KB |
| titulos-tickets.png | 922 KB |
| buscador-usuarios.png | 880 KB |
| **Total** | **~13 MB** |

**Ninguno es referenciado desde el código fuente** — solo desde `README.md`. Se copian al build y se sirven a todos los visitantes.
- **Fix:** Mover a `docs/screenshots/` (fuera de `public/`).

### 2.2 🟢 `argentina_provincias.geojson` (505 KB) en `public/data/`

Se sirve como fetch runtime en `DirectorioContent.astro`. Considerar:
- Compresión gzip/brotli
- Conversión a TopoJSON (~80% más pequeño)
- Cacheo agresivo

### 2.3 🟢 `BaseLayout.BZV8eW2M.css` en 263 KB

Peso esperado con DaisyUI completo pero monitoreable. Considerar purgar componentes no utilizados.

### 2.4 🟢 Falta `robots.txt`

No hay `public/robots.txt` ni ruta SSR. Buena práctica agregarlo.

---

## 3. Código Duplicado y Oportunidades de Componentización

### 3.1 🔴 ~22 modales `<dialog>` raw con boilerplate repetido

El componente `src/components/ui/Modal.astro` (53 líneas) existe pero solo se usa parcialmente. Quedan **22 diálogos raw** que replican el shell de DaisyUI manualmente:

| Archivo | Diálogos |
|---------|----------|
| `src/components/cronograma/subcomponents/RulesSettingsModal.astro` | 1 |
| `src/components/cronograma/subcomponents/OperatorFormModal.astro` | 2 |
| `src/components/cronograma/subcomponents/NewMonthModal.astro` | 1 |
| `src/components/cronograma/subcomponents/HolidaysModal.astro` | 1 |
| `src/components/cronograma/subcomponents/MonthlyDetailModal.astro` | 1 |
| `src/components/cronograma/CronogramaDashboard.astro` | 1 |
| `src/components/supervision/calidad/CalidadContent.astro` | 3 |
| `src/components/buscador-usuarios/TerminalModal.astro` | 1 |
| `src/components/supervision/asignacion/AsignacionContent.astro` | 1 |
| `src/components/admin/users/AdminUsersContent.astro` | 4+ |
| `src/components/admin/aplicativos/AdminAplicativosContent.astro` | 1 |
| `src/components/admin/recursos/AdminRecursosContent.astro` | 1 |
| `src/components/admin/contacts/AdminContactsContent.astro` | 1 |
| `src/components/support-guides/SupportGuideRow.astro` | 1 |
| `src/layouts/BaseLayout.astro` | 2 |

Los modales de cronograma comparten un patrón idéntico: `shadow-2xl rounded-3xl p-6`, heading `font-black uppercase tracking-tight`, y `modal-backdrop`. ~700 líneas de boilerplate.

### 3.2 🟡 `SectionCard.astro` sin uso completo

El componente existe pero tiene aplicación parcial. Varios archivos aún construyen wrappers de card manualmente (`<section class="card bg-base-100 border border-base-300 shadow-md">...`).

### 3.3 ✅ `roleConfig.ts` — Creado pero verificar cobertura

`src/lib/roleConfig.ts` se creó con `ROLE_CONFIG` y `getRoleConfig()`. Los consumidores actualizados:
- ✅ `BaseLayout.astro`
- ✅ `profile.astro`
- ✅ `AdminUsersContent.astro`

### 3.4 🟡 `resolveUrl` definido en 12+ archivos

Cada archivo define el mismo helper:
```ts
const base = import.meta.env.BASE_URL || "/";
const resolveUrl = (p: string) => `${base.replace(/\/$/, "")}${p}`;
```

**Fix:** Extraer a `src/lib/url.ts` como función compartida.

### 3.5 🔴 Triple modal de eliminación de categoría casi idéntico

`AdminAplicativosContent`, `AdminRecursosContent` y `AdminContactsContent` tienen un modal de "Eliminar Categoría" de ~35 líneas cada uno con la misma estructura (radio buttons, botones, backdrop). Solo cambia el texto específico de la entidad.

El JS de apertura también se repite:
```js
(window as any).openDeleteCategoryModal = (categoryId: string) => { ... };
```

### 3.6 🟢 Clases de input/label repetidas

La cadena `input input-bordered input-sm font-bold w-full focus:outline-none focus:border-secondary bg-base-100` aparece 12+ veces. La cadena de label `label-text font-bold text-xs uppercase text-base-content/60` aparece 17+ veces.

### 3.7 🟡 Guard de acceso inline repetido

`!["admin", "supervisor", "team_leader"].includes(role)` aparece en 5 páginas. `rbac.ts` ya tiene `hasPermission()` para esto.

---

## 4. Uso de React

### 4.1 🟢 React es un solo island

```astro
<TitlesContainer client:idle />
```

| Componente | Líneas | Estado |
|------------|--------|--------|
| `useTitlesHook.tsx` | 217 | ✅ Justifica React (useState, useEffect, useCallback, useMemo) |
| `TitlesContainer.tsx` | 103 | ✅ Entry island, consume hook |
| `TitleDrawer.tsx` | 85 | 🟢 Convertible a Astro (sin hooks, props → render) |
| `TitleCard.tsx` | 74 | 🟡 Evaluar (usa memo, podría reescribirse) |
| `TitleCardSkeleton.tsx` | 30 | 🟢 Convertible a Astro trivialmente |

**Dependencias React:** `react`, `react-dom`, `@types/react`, `@types/react-dom`, `@astrojs/react`, `@heroicons/react`.

**Veredicto:** React no es crítico de remover. La migración completa tomaría ~3-4 horas. Prioridad baja.

---

## 5. Hallazgos Resueltos en Sesión Actual

| ID | Hallazgo | Resolución |
|----|----------|------------|
| M-03 | Mapa rol-a-color duplicado (ternarias inline) | `src/lib/roleConfig.ts` creado. BaseLayout, profile, AdminUsersContent actualizados |
| M-02 | Boilerplate modal duplicado en varios archivos | `Modal.astro` aplicado a 10 modales en 7 archivos (EditUserModal, SupportGuideRow, AsignacionContent, AdminUsersContent, AdminAplicativosContent, AdminContactsContent, AdminRecursosContent) |
| C-04 | `@iconify-json/boxicons` en devDependencies | Movido a `dependencies` |

---

## 6. Plan de Acción Recomendado

| Prioridad | Hallazgo | Esfuerzo | Impacto |
|-----------|----------|----------|---------|
| P0 | 🔴 `security.checkOrigin: false` | 5 min | Seguridad |
| P0 | 🔴 ~13 MB de PNGs en public/images/ | 10 min | Rendimiento (-90% build) |
| P1 | 🔴 Remover `@libsql/client` + `@astrojs/mdx` | 2 min | Mantenibilidad |
| P1 | 🔴 Triple modal delete-category | 30 min | -105 líneas |
| P2 | 🟡 Mover typescript, @astrojs/check, cheerio a devDeps | 5 min | Correctitud |
| P2 | 🟡 Remover `glob` unused | 1 min | -1.53 MB |
| P2 | 🟡 Remover `NODE_ENV=development` esbuild | 5 min | Calidad build |
| P2 | 🟡 Extraer `resolveUrl` a `src/lib/url.ts` | 15 min | -40+ líneas |
| P3 | 🟢 Convertir TitleDrawer + TitleCardSkeleton a Astro | 30 min | -115 líneas React |
| P3 | 🟢 Agregar robots.txt | 5 min | SEO/best practice |
