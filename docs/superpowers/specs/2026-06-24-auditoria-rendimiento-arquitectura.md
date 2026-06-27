# Auditoría de Rendimiento y Arquitectura

**Fecha:** 2026-06-25 (actualización post-intervención)
**Versión inicial:** 2026-06-24
**Proyecto:** correo-argentino-mda (Portal Mesa de Ayuda)
**Stack:** Astro v5 SSR + Tailwind v4 + DaisyUI v5 + Drizzle ORM + SQLite + React islands

---

## Resumen Ejecutivo

Se intervinieron **12 de 18 hallazgos** originales (67%). Quedan **6 pendientes** de la auditoría inicial. Se agregaron **5 hallazgos N3** en el re-análisis post-intervención, y **15 nuevos hallazgos N4** descubiertos en el re-análisis del 2026-06-26.

| Estado | Cantidad |
|--------|----------|
| 🔴 Corregidos | 12 |
| 🟡 Pendientes originales | 6 |
| 🆕 Nuevos hallazgos N3 | 5 |
| 🆕 Nuevos hallazgos N4 | 15 |

Total: **38 hallazgos** documentados, de los cuales 12 están resueltos, 6 pendientes originales, y 20 son nuevos descubrimientos.

---

## Hallazgos Corregidos (12)

| ID | Hallazgo | Severidad | Resolución | Commit(s) |
|----|----------|-----------|------------|-----------|
| 1.1 | `@libsql/client` y `@astrojs/mdx` en `dependencies` — No utilizados | 🔴 | Removidos de `dependencies` | Sesión anterior |
| 1.2 | `typescript` y `@astrojs/check` en `dependencies` | 🟡 | Movidos a `devDependencies` | Sesión anterior |
| 1.3 | `cheerio` en `dependencies` | 🟡 | Movido a `devDependencies` | Sesión anterior |
| 1.4 | `glob` en `devDependencies` — No utilizado | 🟡 | Removido | Sesión anterior |
| 1.6 | `NODE_ENV="development"` hardcodeado en esbuild define | 🟡 | Reemplazado por `JSON.stringify(process.env.NODE_ENV ?? "development")` | `cc946e6` |
| 1.7 | Alias `@middleware/*` apunta a directorio inexistente | 🟡 | Alias removido de `tsconfig.json` | `59a6f8b` |
| 2.1 | ~13 MB de screenshots PNG en `public/images/` | 🔴 | Movidos a `docs/screenshots/` (fuera de `public/`) | `0ed329f` |
| 2.2 | `argentina_provincias.geojson` (505 KB) | 🟢 | Convertido a TopoJSON (31 KB, -94%), actualizado `DirectorioContent.astro` | `0ed329f` |
| 2.4 | Falta `robots.txt` | 🟢 | Creado `public/robots.txt` | `0ed329f` |
| 3.4 | `resolveUrl` definido en 15 archivos | 🟡 | Extraído a `src/lib/url.ts` como función compartida. 15 archivos actualizados | `3dbcea4` |
| 3.5 | Triple modal de eliminación de categoría (~105 líneas duplicadas) | 🔴 | Extraído a `src/components/ui/DeleteCategoryModal.astro`. 3 content components actualizados (-74 líneas netas) | `9877c30` |
| 3.7 | Guard de acceso inline repetido en 5+ páginas | 🟡 | Centralizado en `routePermissions` + middleware `hasPermission()`. Guards removidos de 15+ archivos de página. 28 tests RBAC agregados | 7 commits (sesión 3.7) |

---

## Hallazgos Pendientes (de la auditoría original)

### 1.5 🔴 `security.checkOrigin: false` en `astro.config.mjs`

**No intervenido.** Sigue desactivando la validación CSRF/origen de Astro.

**Estado:** ❌ Sin cambios desde la auditoría inicial.
**Fix:** Setear a `true` y verificar que los formularios POST no requieran origen cruzado. Si hay un caso legítimo, documentarlo con comentario.
**Esfuerzo:** 5 min.
**Impacto:** Seguridad.

### 1.6 ✅ `NODE_ENV="development"` hardcodeado en esbuild define

**Resuelto.** Ahora lee el valor real del entorno:

```js
define: { "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV ?? "development") },
```

**Estado:** ✅ Resuelto — 2026-06-26.
**Fix:** `JSON.stringify("development")` → `JSON.stringify(process.env.NODE_ENV ?? "development")` en `astro.config.mjs`.
**Esfuerzo:** 5 min.
**Impacto:** Calidad de build.

### 2.3 🟢 CSS bundle ~263 KB

**Estado:** ❌ No intervenido. Peso esperado con DaisyUI completo. Monitoreable.
**Fix:** Purgar componentes DaisyUI no utilizados (postcss purge).
**Esfuerzo:** 30 min.
**Impacto:** Rendimiento (mejorable pero no crítico).

### 3.1 🔴 ~20 diálogos `<dialog>` raw sin refactorizar

Se intervinieron ~10 modales en M-02 (7 archivos), pero quedan **20 diálogos raw** en **13 archivos** que no usan `Modal.astro`:

| Archivo | Diálogos | Nota |
|---------|----------|------|
| `src/layouts/BaseLayout.astro` | 2 (command-palette, about-project) | Candidato directo |
| `src/components/support-guides/SupportGuideRow.astro` | 1 | Candidato directo |
| `src/components/buscador-usuarios/TerminalModal.astro` | 1 | Candidato directo |
| `src/components/buscador-usuarios/EditUserModal.astro` | 1 | Candidato directo |
| `src/components/supervision/asignacion/AsignacionContent.astro` | 1 | Candidato directo |
| `src/components/supervision/calidad/CalidadContent.astro` | 3 | Custom z-index y estilos — evaluar |
| `src/components/admin/users/AdminUsersContent.astro` | 4 | Candidato directo |
| `src/components/ui/DeleteCategoryModal.astro` | 1 | Nuevo en 3.5 — refactorizar post creación |
| `src/components/cronograma/CronogramaDashboard.astro` | 1 (inline) | Patrón diferente (shadow-2xl, rounded-3xl) |
| `src/components/cronograma/subcomponents/HolidaysModal.astro` | 1 | Patrón cronograma |
| `src/components/cronograma/subcomponents/NewMonthModal.astro` | 1 | Patrón cronograma |
| `src/components/cronograma/subcomponents/OperatorFormModal.astro` | 1 | Patrón cronograma |
| `src/components/cronograma/subcomponents/RulesSettingsModal.astro` | 1 | Patrón cronograma |

**Nota:** Los modales de cronograma comparten un patrón visual distinto (`shadow-2xl rounded-3xl p-6`, heading `font-black uppercase tracking-tight`, `modal-backdrop`). Requerirían extender `Modal.astro` con variante de estilo o crear `CronogramaModal.astro`.

**Estado:** ⚠️ Parcial (10 corregidos, 20 pendientes).
**Fix:** Aplicar `Modal.astro` a los archivos marcados como "Candidato directo". Para cronograma, evaluar extensión del componente.
**Esfuerzo:** ~2-3 h para candidatos directos + 1-2 h para cronograma.
**Impacto:** -400+ líneas de boilerplate.

### 3.2 🟡 `SectionCard.astro` sin uso (dead code)

**El componente fue creado en M-01 pero NUNCA importado en ningún archivo del código fuente.** Es dead code.

Paralelamente, existen **~46 archivos** que construyen cards manualmente con `bg-base-100 border border-base-300 shadow-md/shadow-sm`. Entre ellos:

| Archivo | Instancias |
|---------|-----------|
| `OfficeForm.astro` | 6 |
| `SignatureGenerator.astro` | 3 |
| `AsignacionContent.astro` | 4 |
| Admin CRUD pages (create/edit, ~25 archivos) | 1-2 c/u |
| `profile.astro`, `admin/index.astro`, etc. | 2 c/u |

**Decisión requerida:** (a) Eliminar `SectionCard.astro` si no se justifica su existencia, o (b) aplicarlo a los 46 archivos que construyen cards manualmente.

**Estado:** ⚠️ Componente creado pero sin adoptar.
**Esfuerzo:** 5 min si se elimina; 2-3 h si se aplica a los 46 archivos.
**Impacto:** Mantenibilidad.

### 3.6 🟢 Clases de input/label repetidas

Se mantienen ~24 instancias del patrón de label y varias cadenas de input repetidas:

| Patrón | Conteo | Archivos principales |
|--------|--------|---------------------|
| `label-text font-bold text-xs uppercase text-base-content/60` | 17 | cronograma modals, CalidadContent |
| `label-text font-bold text-xs uppercase text-base-content/40 tracking-wider` | 6 | EditUserModal, AsignacionContent |
| `input-bordered input-sm font-bold w-(full\|32) focus:outline-none focus:border-secondary bg-base-100` | 6 | RulesSettingsModal, OperatorFormModal, NewMonthModal |
| `input-bordered input-sm font-mono font-bold w-full focus:outline-none focus:border-primary bg-base-100` | 3 | CalidadContent |
| `fieldset-legend font-semibold uppercase tracking-wide text-xs` (+ `mb-2`) | 20+ | Admin CRUD create/edit pages |
| `text-tiny font-black uppercase tracking-wider text-base-content/40` (+ variantes) | 32 | CronogramaDashboard |
| `input input-bordered w-full focus:input-primary` | 8 | soportes create/edit |
| `file-input file-input-bordered w-full` | 8 | Admin aps/recursos create/edit |
| `textarea textarea-bordered w-full h-24 focus:textarea-primary` (+ variantes) | 8 | soportes create/edit |
| `btn btn-sm btn-ghost hover:bg-base-200 text-xs font-black uppercase` | 7 | cronograma modals, CalidadContent |
| `btn btn-sm btn-secondary text-xs font-black uppercase` | 7 | cronograma modals, CalidadContent |

**Estado:** ❌ No intervenido (agravado por nuevos hallazgos).
**Fix:** Crear componentes `FormLabel`, `FormInput`, `FormTextarea` y reemplazar en todos los archivos.
**Esfuerzo:** ~3-4 h para cobertura completa.
**Impacto:** -350+ líneas de clases repetidas.

### 4.1 🟢 React — Single island (Titles)

**Estado:** ❌ No intervenido. Baja prioridad.

| Componente | Líneas | Estado |
|------------|--------|--------|
| `useTitlesHook.tsx` | 217 | ✅ Justifica React |
| `TitlesContainer.tsx` | 103 | ✅ Entry island |
| `TitleDrawer.tsx` | 85 | 🟢 Convertible a Astro |
| `TitleCard.tsx` | 74 | 🟡 Evaluar |
| `TitleCardSkeleton.tsx` | 30 | 🟢 Convertible a Astro |

**Fix:** Convertir TitleDrawer y TitleCardSkeleton a Astro. TitleCard evaluar. Dependencias React: `react`, `react-dom`, `@types/react`, `@types/react-dom`, `@astrojs/react`, `@heroicons/react`.
**Esfuerzo:** ~3-4 h completa; 1 h parcial (drawer + skeleton).
**Impacto:** -115 líneas React, simplifica toolchain.

---

## Nuevos Hallazgos (descubiertos en re-análisis 2026-06-25)

### N3.8 ✅ `fieldset-legend` repetido 20+ veces en admin CRUD

**Resuelto.** Creado `FormLegend.astro` en `src/components/ui/forms/` y aplicado en 14 archivos (~33 instancias). El componente usa `fieldset-legend uppercase tracking-wide` como base, evitando clases redundantes con DaisyUI (`font-semibold`, `text-xs` ya vienen del framework). Cada variante se maneja vía `class` prop: `mb-2`, `px-2`, `font-bold tracking-wider`, `normal-case tracking-normal`.

**Archivos intervenidos:** `FormField.astro`, `SelectField.astro`, `PasswordField.astro`, `OfficeForm.astro`, `aplicativos/create.astro`, `aplicativos/edit/[id].astro`, `contactos/create.astro`, `contactos/edit/[id].astro`, `recursos/enlace/create.astro`, `recursos/enlace/edit/[id].astro`, `contactos/categoria/create.astro`, `contactos/categoria/edit/[id].astro`, `recursos/categoria/create.astro`, `recursos/categoria/edit/[id].astro`.

**Estado:** ✅ Resuelto — 2026-06-26.
**Esfuerzo:** 30 min.
**Impacto:** -100+ líneas, centralización de estilos.

### N3.9 🟡 `text-tiny font-black uppercase tracking-wider` 32 veces en CronogramaDashboard

Una clase extremadamente específica que aparece exclusivamente en `CronogramaDashboard.astro` como headings de secciones (días, horarios, operadores).

**Fix:** Extraer a clase CSS compartida o componente de heading. Si es un solo archivo, aplicar refactor interno.
**Esfuerzo:** 15 min.
**Impacto:** Mantenibilidad de ese archivo (que ya es muy grande).

### N3.10 🟡 `input input-bordered w-full focus:input-primary` 8 veces en soportes

Patrón de input repetido en `soportes/create.astro` y `soportes/edit/[id].astro`. Aparece acompañado de `textarea textarea-bordered w-full h-24 focus:textarea-primary` (8 veces en los mismos archivos).

**Fix:** Mismo `FormInput` / `FormTextarea` propuesto en 3.6.
**Esfuerzo:** 30 min (incluido en 3.6).
**Impacto:** -60+ líneas.

### N3.11 🟡 `btn btn-sm btn-ghost` y `btn btn-sm btn-secondary` repetidos 7 veces c/u

Botones de acción en cronograma modals y CalidadContent con estructura idéntica.

| Patrón | Conteo | Ubicación |
|--------|--------|-----------|
| `btn btn-sm btn-ghost hover:bg-base-200 text-xs font-black uppercase` | 7 | RulesSettingsModal, HolidaysModal, OperatorFormModal, NewMonthModal, CalidadContent |
| `btn btn-sm btn-secondary text-xs font-black uppercase` | 7 | NewMonthModal, HolidaysModal, RulesSettingsModal, OperatorFormModal, CalidadContent |

**Fix:** Misma extracción que 3.6, o crear componente `ActionButton`.
**Esfuerzo:** 30 min.
**Impacto:** -50+ líneas.

### N3.12 🟢 `file-input file-input-bordered w-full` 8 veces en admin forms

Repetido en `admin/aplicativos/create.astro`, `admin/aplicativos/edit/[id].astro`, `admin/recursos/enlace/create.astro`, `admin/recursos/enlace/edit/[id].astro`.

**Fix:** Incluir en componente `FormInput` (3.6) con variante `type="file"`.
**Esfuerzo:** Incluido en 3.6.
**Impacto:** Mantenibilidad.

---

## Nuevos Hallazgos N4 (descubiertos en re-análisis 2026-06-26)

### N4.1 🔴 API key `mda_live_*` hardcodeada 3 veces en JS de cliente

La API key `mda_live_bf9d7a2e8c5643190ab76d2e1f48c590` aparece hardcodeada en 3 lugares del script de `BuscadorUsuariosContent.astro` (líneas 547, 633, 752), expuesta a cualquier usuario que abra el inspector del navegador.

**Fix:** Mover a variable de entorno (`import.meta.env.USERS_API_KEY`), consumir vía endpoint Astro API proxy o en servidor.
**Esfuerzo:** 30 min.
**Impacto:** Seguridad — fuga de credencial productiva.

### N4.2 🔴 3 archivos monstruo >2,000 líneas

| Archivo | Líneas | Contenido |
|---------|--------|-----------|
| `src/components/cronograma/lib/dashboard-client.ts` | **3.760** | Lógica de cliente del cronograma (drag & drop, cálculos, render) |
| `src/components/supervision/calidad/CalidadContent.astro` | **2.781** | Template + script de calidad de operadores |
| `src/components/cronograma/CronogramaDashboard.astro` | **2.317** | Dashboard completo de cronograma |

Archivos de esta magnitud son imposibles de mantener, testear o revisar. Concentran lógica de UI, estado, API y negocio en un solo lugar.

**Fix:** Dividir cada monstruo por responsabilidad (componentes hijos, hooks, utilidades separadas).
**Esfuerzo:** 4-6 h c/u (12-18 h total).
**Impacto:** Mantenibilidad crítica.

### N4.3 🟡 Catch blocks vacíos (7 instancias)

| Archivo | Línea | Código |
|---------|-------|--------|
| `src/lib/navigation.ts` | 198 | `catch (e) {}` |
| `src/lib/navigation.ts` | 213 | `catch (e) {}` |
| `src/lib/iconUpload.ts` | 110 | `catch {}` |
| `src/pages/admin/aplicativos/edit/[id].astro` | 166 | `catch {}` |
| `src/pages/oficinas/create.astro` | 199 | `catch (e: any) {}` |
| `src/pages/oficinas/edit/[id].astro` | 210 | `catch (e: any) {}` |
| `src/pages/inventario-terminales/cubics/create.astro` | 136 | `catch (e: any) {}` |

Errores silenciados que ocultan bugs hasta que impactan al usuario sin trazabilidad.

**Fix:** Agregar logging (`console.error`) mínimo en cada catch o propagar el error según contexto.
**Esfuerzo:** 20 min.
**Impacto:** Calidad — errores ocultos.

### N4.4 🟡 `(window as any)` 30+ veces + `(locals as any).user?.username` 12 veces

El código usa `(window as any)` como escape hatch para propiedades globales en más de 30 ocasiones. Similarmente, `(locals as any).user` aparece 12 veces en API routes en lugar del tipo `App.Locals` correcto.

**Fix:** Declarar global types para las propiedades de `window` (ej. `showToast`, `myChart`, `L`) y tipificar `locals` correctamente con `declare global { namespace App { interface Locals { ... } } }`.
**Esfuerzo:** 1-2 h.
**Impacto:** Type safety — ~42 escapes de tipado.

### N4.5 🟡 Cookies de sesión sin flag `secure: true`

En `src/lib/session.ts:41,52` las cookies de sesión se crean con `secure: false`, permitiendo envío sobre HTTP (no cifrado). En producción con HTTPS, esto expone el session ID a intermediarios.

**Fix:** Condicionar `secure` a `import.meta.env.PROD`.
**Esfuerzo:** 5 min.
**Impacto:** Seguridad — session hijacking en redes no seguras.

### N4.6 🟡 16 `console.log` en OfficeForm.astro

`src/components/admin/OfficeForm.astro:594-821` contiene 16 llamadas a `console.log` con mensajes de debug (nombres de secciones, estado de carga). Son residuos de desarrollo que contaminan la salida estándar en producción.

**Fix:** Remover todos los `console.log` del archivo.
**Esfuerzo:** 5 min.
**Impacto:** Calidad — debug leakage + rendimiento marginal.

### N4.7 🟡 400+ líneas de mock data hardcodeado en cubics.ts

`src/lib/cubics.ts` exporta un array `cubicMachines` de ~400 líneas con datos de prueba estáticos (IPs 10.254.59.x, fechas, etc.). Esto se envía a producción como parte del bundle.

**Fix:** Mover a archivo de seed/test (`src/db/seed-cubics.ts`) o a un JSON externo. El código productivo debe consumir de la DB real.
**Esfuerzo:** 15 min.
**Impacto:** Calidad — shipping data falsa a producción.

### N4.8 🟡 Potencial XSS vía `innerHTML` con datos de API externa

En `BuscadorUsuariosContent.astro:425` y `EstadisticasContent.astro:375` se inyecta HTML usando `innerHTML` con datos provenientes de APIs externas o DB. Si la fuente es comprometida, hay XSS directo.

**Fix:** Usar `textContent` en lugar de `innerHTML` para datos textuales. Usar `insertAdjacentHTML` solo con strings controladas y escapadas.
**Esfuerzo:** 30 min.
**Impacto:** Seguridad — XSS potencial.

### N4.9 🟡 `onclick` inline con template literals `${}` en 21+ archivos

El patrón `onclick=\`...\${...}...\`` se usa extensivamente para abrir modales (`showModal()`) y ejecutar acciones. Si el valor interpolado (`id`, `userId`, etc.) proviene de fuente no confiable, es XSS directo.

**Fix:** Reemplazar por event listeners programáticos (`addEventListener`) con datos en `data-*` attributes. Priorizar archivos con datos de API/DB.
**Esfuerzo:** 2-3 h.
**Impacto:** Seguridad — XSS en 21+ archivos.

### N4.10 🟡 Missing `aria-label` en icon-only buttons

Componentes como `GithubLink.astro:23` usan SVG dentro de un `<a>` sin `aria-label`. Botones que solo contienen un ícono son invisibles para lectores de pantalla sin etiqueta accesible.

**Fix:** Agregar `aria-label` descriptivo a todo link/botón con solo ícono. Evaluar `FilterTabsBox.astro` para roles ARIA correctos.
**Esfuerzo:** 30 min.
**Impacto:** Accesibilidad.

### N4.11 🟡 Fallback secrets débiles + `@ts-ignore`

`src/lib/session.ts:12` usa `"fallback-secret-do-not-use-in-prod"` y `src/lib/encryption.ts:46` usa `"dev_key_must_be_configured_in_env"` como defaults. Además `@ts-ignore` en `src/components/cronograma/lib/exporters.ts:252` suprime error de tipo sin justificación.

**Fix:** Hacer que el server tire error al iniciar si falta `SESSION_SECRET`/`ENCRYPTION_MASTER_KEY` en producción. Documentar `@ts-ignore` con comentario de por qué es necesario.
**Esfuerzo:** 15 min.
**Impacto:** Seguridad + type safety.

### N4.12 🟢 Colores hex hardcodeados en componentes

`DirectorioContent.astro` usa `#003B71`, `#7F8C8D` y `SignatureGenerator.astro` usa `#ffc72c`, `#0c0c0c`, `#254888`, `#54585a` como colores fijos. Estos no respetan el theme claro/oscuro del sistema de diseño.

**Fix:** Reemplazar por tokens DaisyUI (`text-primary`, `bg-secondary`, etc.) o variables CSS `var(--color-*)`.
**Esfuerzo:** 20 min.
**Impacto:** Consistencia visual — rompe tema oscuro.

### N4.13 🟢 Animaciones pesadas contradicen design system

El design system especifica "sin ruido visual ni animaciones pesadas". Sin embargo se usan extensivamente: `animate-pulse` (6+ archivos), `animate-fade-in`, `animate-bounce`, `animate-spin`, `animate-ping`, transiciones CSS `cubic-bezier` personalizadas, y `@keyframes bubble-in`.

**Fix:** Auditar animaciones y reducir a micro-interacciones sutiles. Remover `animate-bounce` y `animate-ping` (las más pesadas).
**Esfuerzo:** 1 h.
**Impacto:** Consistencia de diseño + rendimiento de UI.

### N4.14 🟢 `any[]` en lugar de tipos Drizzle/DB

Archivos como `AdminRecursosContent.astro:23`, `CatalogoContent.astro:51` y otros tipan resultados de consultas DB como `any[]` en vez de usar los tipos generados por Drizzle (`InferSelectModel<typeof table>`).

**Fix:** Reemplazar `any[]` por tipos Drizzle. Si la consulta usa joins, definir interfaz explícita.
**Esfuerzo:** 1-2 h.
**Impacto:** Type safety — pérdida de autocompletado y validación en queries DB.

### N4.15 🟢 Hardcoded HTTP URLs internas

`BuscadorUsuariosContent.astro:548,634,753` hardcodea `http://mda.correo.local/api_mda_find_extension/get_users.php` (HTTP, no HTTPS) para consultar la API de extensión telefónica. Esto fuerza conexión no segura.

**Fix:** Extraer a constante o variable de entorno. Evaluar si puede migrarse a HTTPS.
**Esfuerzo:** 10 min.
**Impacto:** Consistencia — URL hardcodeada en 3 lugares.

---

## Plan de Acción Recomendado (Actualizado)

| Prioridad | ID | Hallazgo | Esfuerzo | Impacto |
|-----------|----|----------|----------|---------|
| **P0** | 1.5 | 🔴 `security.checkOrigin: false` | 5 min | Seguridad |
| **P0** | N4.1 | 🔴 API key `mda_live_*` hardcodeada en cliente | 30 min | Seguridad — fuga credencial |
| **P0** | N4.5 | 🟡 Cookies sin flag `secure: true` | 5 min | Seguridad — session hijacking |
| **P0** | N4.8 | 🟡 XSS vía `innerHTML` con datos de API | 30 min | Seguridad — XSS potencial |
| **P0** | N4.9 | 🟡 `onclick` con template literals en 21+ archivos | 2-3 h | Seguridad — XSS potencial |
| **P0** | N4.11 | 🟡 Fallback secrets débiles + `@ts-ignore` | 15 min | Seguridad + type safety |
| **P1** | 3.1 | 🔴 20 diálogos raw sin Modal.astro | 2-4 h | -400+ líneas boilerplate |
| **P1** | N4.2 | 🔴 3 archivos monstruo >2K líneas c/u | 12-18 h | Mantenibilidad crítica |
| **P1** | N4.4 | 🟡 `(window as any)` 30+ veces + `(locals as any)` 12 veces | 1-2 h | Type safety — ~42 escapes |
| **P1** | N3.8 | ✅ `fieldset-legend` repetido 20+ veces | 30 min | Mantenibilidad |
| **P1** | N3.11 | 🟡 Botones btn-sm repetidos (14 instancias) | 30 min | Mantenibilidad |
| **P2** | N4.3 | 🟡 Catch blocks vacíos (7 instancias) | 20 min | Calidad — errores ocultos |
| **P2** | N4.6 | 🟡 16 `console.log` en OfficeForm.astro | 5 min | Debug leakage |
| **P2** | N4.7 | 🟡 400+ líneas mock data en cubics.ts | 15 min | Shipping data falsa |
| **P2** | N4.10 | 🟡 Missing `aria-label` en icon-only buttons | 30 min | Accesibilidad |
| **P2** | 3.6 / N3.10 / N3.12 | 🟢 Clases input/label/file repetidas | 3-4 h | -350+ líneas |
| **P2** | N3.9 | 🟡 `text-tiny font-black` 32 veces | 15 min | Mantenibilidad |
| **P2** | 1.6 | ✅ `NODE_ENV` hardcodeado en esbuild define | 5 min | Calidad build |
| **P2** | 3.2 | ✅ SectionCard.astro — adopción en 20 archivos | 3 h | Mantenibilidad |
| **P3** | 2.3 | 🟢 CSS bundle 263 KB | 30 min | Rendimiento |
| **P3** | 4.1 | 🟢 Migrar TitleDrawer + Skeleton a Astro | 1 h | -115 líneas React |
| **P3** | 4.1 | 🟢 Migración React completa | 3-4 h | Toolchain simplificada |
| **P3** | N4.12 | 🟢 Colores hex hardcodeados | 20 min | Consistencia visual |
| **P3** | N4.13 | 🟢 Animaciones pesadas contradicen design system | 1 h | Consistencia diseño |
| **P3** | N4.14 | 🟢 `any[]` en lugar de tipos Drizzle/DB | 1-2 h | Type safety |
| **P3** | N4.15 | 🟢 Hardcoded HTTP URLs internas | 10 min | Consistencia |

### Leyenda de prioridades
- **P0:** Riesgo de seguridad.
- **P1:** Alto impacto en mantenibilidad, esfuerzo medio-alto pero recuperable en deuda técnica.
- **P2:** Mejora de calidad/build, esfuerzo bajo o mediano.
- **P3:** Buenas prácticas / rendimiento marginal.
