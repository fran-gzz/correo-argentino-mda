# Tarea: Módulo de Asignación de Autogestiones

Fecha: 2026-04-29

## Descripción

Implementar un nuevo módulo dentro del área de Supervisión para la distribución equitativa y controlada de tickets de autogestión entre un equipo de operadores técnicos, utilizando asignación circular (Round Robin), persistencia local y UI basada en el sistema de diseño del portal.

## Plan de ejecución

- [x] **Paso 1 — Setup y Datos**:
    - Crear `src/pages/asignacion-autogestiones/index.astro`.
    - Definir mock de datos de operadores (Nombre, ID, Horarios, Break, Estado).
- [x] **Paso 2 — Interfaz Gráfica (UI)**:
    - Utilizar `DataTable` y `DataTableHeaderCell` para listar operadores.
    - Implementar botones de acción ("Asignar próximo", "Reset", filtros).
    - Agregar modal de notificación para asignaciones usando DaisyUI.
    - Integrar acceso desde `src/pages/supervision/index.astro`.
- [x] **Paso 3 — Lógica de Asignación Circular**:
    - Desarrollar script de frontend para gestionar estado en `localStorage`.
    - Implementar "Asignar próximo" recorriendo la lista de "Disponibles".
    - Implementar "Asignación manual" y "Reset".
- [x] **Paso 4 — Interacciones Visuales**:
    - Resaltar la fila del último operador asignado.
    - Filtrar visualmente la tabla ("Ver todos" vs "Ver solo disponibles").
    - Mostrar modal con datos del asignado tras cada acción.

## Criterio de éxito global

El sistema debe permitir la asignación fluida circular e individual de operadores y recordar al último asignado.
