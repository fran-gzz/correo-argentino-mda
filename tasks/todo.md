# Tarea: Normalización de clases Tailwind (Eliminación de valores hardcodeados)

Fecha: 2026-04-29

## Descripción

Eliminar el uso de valores arbitrarios de Tailwind (ej. `text-[11px]`, `bg-[#254888]`) en favor de clases predefinidas y tokens semánticos definidos en `DESIGN.md` y `src/styles/global.css`.

## Plan de ejecución

- [x] **Paso 1 — Normalización de tamaños de texto**:
    - Reemplazar `text-[9px]`, `text-[10px]`, `text-[11px]` por `text-xs`.
    - Reemplazar `text-[12px]` por `text-xs`.
- [x] **Paso 2 — Normalización de colores**:
    - Reemplazar `#254888` (Steel Azure) por `secondary` o `linea-institucional`.
    - Reemplazar `#ffc72c` (School Bus Yellow) por `primary`.
    - Reemplazar `#b3474d` por `error`.
    - Reemplazar `#0d9488` por `success` (o el token semántico correspondiente).
    - Asegurar el uso de opacidad con tokens (ej. `bg-secondary/10` en vez de `bg-[#254888]/10`).
- [x] **Paso 3 — Normalización de espaciados y dimensiones**:
    - Reemplazar `w-[320px]` por `w-80`.
    - Revisar y normalizar `max-h-[600px]`, `min-w-[220px]`, `border-l-[6px]`, etc.
- [x] **Paso 4 — Auditoría final**:
    - Ejecutar una búsqueda global de `-[` para asegurar que no queden inconsistencias críticas (excepto donde sea estrictamente necesario como en animaciones o grids complejos si no hay alternativa).
- [x] **Paso 5 — Verificación visual**:
    - Comprobar que los cambios no afecten negativamente la legibilidad o el layout.

## Criterio de éxito global

El proyecto no debe contener valores arbitrarios en clases de Tailwind para colores institucionales ni tamaños de texto que tengan equivalentes en el sistema de diseño.
