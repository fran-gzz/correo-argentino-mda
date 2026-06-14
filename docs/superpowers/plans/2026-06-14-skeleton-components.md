# Skeletons Componentization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor duplicated and hardcoded skeleton loading structures across the application into generic, reusable UI components.

**Architecture:** We will create a `skeletons` directory inside `src/components/ui/` to house structural loading components (`SkeletonTable`, `SkeletonCard`, `SkeletonMetric`). These components will wrap DaisyUI's native `.skeleton` class, eliminating the need for scattered `animate-pulse` wrappers and hardcoded flex/grid structures.

**Tech Stack:** Astro, Tailwind CSS, DaisyUI.

## User Review Required

> [!WARNING]  
> Please review the proposed components (`SkeletonTable`, `SkeletonCard`, `SkeletonMetric`). I am proposing high-level structural skeletons instead of atomic primitives to reduce boilerplate significantly. Do you approve this approach?

---

### Task 1: Create SkeletonCard Component

**Files:**
- Create: `src/components/ui/skeletons/SkeletonCard.astro`

- [ ] **Step 1: Write the component implementation**

```astro
---
interface Props {
  /**
   * Tipo de tarjeta a renderizar
   */
  type?: "user" | "basic";
  class?: string;
}

const { type = "basic", class: className = "" } = Astro.props;
---

<div class:list={["card bg-base-200/50 border border-base-300 shadow-md", className]}>
  <div class="card-body p-4 gap-3">
    {type === "user" ? (
      <>
        <div class="flex items-center gap-3">
          <div class="size-12 rounded-full skeleton shrink-0" />
          <div class="flex-1 space-y-2">
            <div class="h-4 w-3/4 skeleton rounded" />
            <div class="h-3 w-1/2 skeleton rounded" />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-2 mt-2">
          <div class="h-8 w-full skeleton rounded" />
          <div class="h-8 w-full skeleton rounded" />
        </div>
      </>
    ) : (
      <>
        <div class="h-5 w-1/3 skeleton rounded mb-2" />
        <div class="space-y-2">
          <div class="h-4 w-full skeleton rounded" />
          <div class="h-4 w-5/6 skeleton rounded" />
        </div>
      </>
    )}
  </div>
</div>
```

### Task 2: Create SkeletonTable Component

**Files:**
- Create: `src/components/ui/skeletons/SkeletonTable.astro`

- [ ] **Step 1: Write the component implementation**

```astro
---
interface Props {
  rows?: number;
  columns?: number;
  class?: string;
}

const { rows = 5, columns = 4, class: className = "" } = Astro.props;
---

<div class:list={["bg-base-100 rounded-2xl border border-base-300 shadow-md overflow-hidden", className]}>
  <div class="overflow-x-auto min-h-[300px]">
    <table class="w-full text-sm text-left border-collapse">
      <thead class="bg-base-200/80 border-b border-base-300">
        <tr>
          {Array.from({ length: columns }).map(() => (
            <th class="py-3.5 px-4">
              <div class="h-4 w-20 skeleton rounded" />
            </th>
          ))}
        </tr>
      </thead>
      <tbody class="divide-y divide-base-200">
        {Array.from({ length: rows }).map(() => (
          <tr>
            {Array.from({ length: columns }).map((_, colIndex) => (
              <td class="py-4 px-4">
                {colIndex === 0 ? (
                  <div class="flex items-center gap-3">
                    <div class="size-8 rounded-full skeleton shrink-0" />
                    <div class="space-y-1.5 w-full">
                      <div class="h-4 w-28 skeleton rounded" />
                      <div class="h-3 w-20 skeleton rounded" />
                    </div>
                  </div>
                ) : colIndex === columns - 1 ? (
                  <div class="flex justify-end">
                    <div class="h-8 w-16 skeleton rounded-lg" />
                  </div>
                ) : (
                  <div class="h-4 w-24 skeleton rounded" />
                )}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
</div>
```

### Task 3: Create SkeletonMetric Component

**Files:**
- Create: `src/components/ui/skeletons/SkeletonMetric.astro`

- [ ] **Step 1: Write the component implementation**

```astro
---
interface Props {
  count?: number;
  class?: string;
}

const { count = 1, class: className = "" } = Astro.props;
---

<div class:list={["grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full", className]}>
  {Array.from({ length: count }).map(() => (
    <div class="bg-base-100 p-4 rounded-2xl border border-base-300 shadow-sm flex flex-col gap-3">
      <div class="h-3 w-24 skeleton rounded" />
      <div class="h-8 w-20 skeleton rounded-lg" />
    </div>
  ))}
</div>
```

### Task 4: Refactor BuscadorUsuariosSkeleton

**Files:**
- Modify: `src/components/buscador-usuarios/BuscadorUsuariosSkeleton.astro:61-90`

- [ ] **Step 1: Import and apply SkeletonCard**

```astro
---
import PageContainer from "@components/ui/PageContainer.astro";
import PageHeader from "@components/ui/PageHeader.astro";
import SkeletonCard from "@components/ui/skeletons/SkeletonCard.astro";
import { Icon } from "astro-icon/components";
---

<PageContainer>
  <!-- Contenedor Principal Optimizado (Grilla) -->
  <div class="grid lg:grid-cols-3 gap-6 mb-8">
    <!-- Sección de Búsqueda -->
    <section class="lg:col-span-2 py-8 px-6 md:px-8 rounded-2xl bg-base-200/50 border border-base-300 shadow-md flex flex-col justify-center">
      <PageHeader
        description="Acceso rápido a contacto, internos y dependencias de todo el personal."
        class="mb-6 text-left"
        titleClass="text-2xl md:text-3xl"
      />

      <div class="w-full relative group opacity-70">
        <div class="join w-full shadow-md rounded-xl overflow-hidden border border-base-300 bg-base-100">
          <div class="relative flex-1">
            <div class="absolute inset-y-0 left-4 flex items-center pointer-events-none opacity-40">
              <Icon name="boxicons:search" size={24} />
            </div>
            <input
              type="text"
              placeholder="Cargando buscador..."
              class="w-full pl-12 pr-16 h-14 bg-transparent focus:outline-hidden text-base sm:text-lg cursor-not-allowed"
              disabled
            />
          </div>
        </div>
      </div>

      <div class="mt-4 flex items-center gap-2 text-xs sm:text-sm text-base-content/50">
        <span class="loading loading-spinner loading-xs text-primary"></span>
        <span>Preparando interfaz...</span>
      </div>
    </section>

    <!-- Banner Extensión -->
    <div class="group relative flex flex-col justify-center p-6 lg:p-8 rounded-2xl border border-accent/20 bg-linear-to-br from-accent/5 via-transparent to-transparent backdrop-blur-md opacity-80 overflow-hidden">
      <!-- Efecto de brillo sutil de fondo -->
      <div class="absolute -bottom-12 -right-12 size-48 bg-accent/10 rounded-full blur-3xl"></div>

      <div class="flex items-center gap-4 mb-4 relative z-10">
        <div class="size-12 rounded-xl bg-accent/10 flex items-center justify-center text-accent shrink-0 shadow-inner">
          <Icon name="boxicons:puzzle-filled" size={24} />
        </div>
        <div>
          <h4 class="font-bold text-lg text-accent tracking-tight leading-tight">Extensión MDA</h4>
          <div class="text-[10px] font-bold text-base-content/40 uppercase tracking-widest mt-1">Chrome / Edge</div>
        </div>
      </div>

      <p class="text-sm text-base-content/60 leading-relaxed relative z-10 flex-1">
        Cargando acceso directo a la extensión...
      </p>
    </div>
  </div>

  <section>
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-xl font-bold flex items-center gap-2">
        Usuarios sugeridos <span class="badge badge-sm badge-neutral">0</span>
      </h2>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {
        [1, 2, 3, 4, 5, 6].map(() => (
          <SkeletonCard type="user" />
        ))
      }
    </div>
  </section>
</PageContainer>
```

### Task 5: Refactor AsistenciaSkeleton

**Files:**
- Modify: `src/components/supervision/asistencia/AsistenciaSkeleton.astro:19-58`

- [ ] **Step 1: Import and apply SkeletonTable**

```astro
---
import SkeletonTable from "@components/ui/skeletons/SkeletonTable.astro";
---

<div class="flex flex-col gap-6 w-full pb-24">
  <!-- Filters bar Skeleton -->
  <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-base-100 p-4 rounded-2xl border border-base-300 shadow-sm">
    <div class="flex items-center gap-3">
      <div class="h-10 w-40 skeleton rounded-xl"></div>
      <div class="h-4 w-16 skeleton rounded"></div>
    </div>
    <div class="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
      <div class="size-10 skeleton rounded-xl"></div>
      <div class="h-10 w-28 skeleton rounded-xl"></div>
      <div class="h-10 w-44 skeleton rounded-xl"></div>
      <div class="h-10 w-full sm:w-64 skeleton rounded-xl"></div>
    </div>
  </div>

  <!-- Main table Skeleton -->
  <SkeletonTable rows={6} columns={7} />
</div>
```

### Task 6: Refactor CronogramaSkeleton

**Files:**
- Modify: `src/components/supervision/cronograma/CronogramaSkeleton.astro:12-52`

- [ ] **Step 1: Import and apply SkeletonTable**

```astro
---
import SkeletonTable from "@components/ui/skeletons/SkeletonTable.astro";
---

<div class="w-full flex flex-col gap-6">
  <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
    <div class="flex bg-base-200/60 p-1 rounded-xl border border-base-300 shadow-sm shrink-0 w-36 h-9">
      <div class="w-full h-full skeleton rounded-lg"></div>
    </div>
    <div class="w-40 h-9 skeleton rounded-xl border border-base-300"></div>
  </div>

  <SkeletonTable rows={6} columns={3} />
</div>
```

### Task 7: Refactor EstadisticasSkeleton

**Files:**
- Modify: `src/components/supervision/asistencia/EstadisticasSkeleton.astro:13-22`

- [ ] **Step 1: Import and apply SkeletonMetric**

```astro
---
import SkeletonMetric from "@components/ui/skeletons/SkeletonMetric.astro";
---

<div class="flex flex-col gap-6 w-full pb-24">
  <!-- Controls & Filters Bar Skeleton -->
  <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-base-100 p-4 rounded-2xl border border-base-300 shadow-sm">
    <div class="flex items-center gap-3">
      <div class="h-4 w-32 skeleton rounded"></div>
      <div class="h-9 w-40 skeleton rounded-xl"></div>
    </div>
  </div>

  <!-- KPI Cards Skeleton -->
  <SkeletonMetric count={4} />

  <!-- Charts Grid Skeleton -->
  <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full">
    <!-- Doughnut Chart Skeleton -->
    <div class="bg-base-100 p-5 rounded-2xl border border-base-300 shadow-sm flex flex-col gap-4">
      <div class="h-4 w-44 skeleton rounded"></div>
      <div class="relative w-full h-[220px] flex items-center justify-center">
        <div class="size-44 rounded-full skeleton"></div>
      </div>
    </div>
    <!-- Bar Chart Skeleton -->
    <div class="bg-base-100 p-5 rounded-2xl border border-base-300 shadow-sm flex flex-col gap-4 lg:col-span-2">
      <div class="h-4 w-52 skeleton rounded"></div>
      <div class="w-full h-[220px] skeleton rounded-xl"></div>
    </div>
  </div>

  <!-- Ranking and Operator Profile Grid Skeleton -->
  <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full">
    <!-- Podio / Rankings Skeleton -->
    <div class="bg-base-100 p-5 rounded-2xl border border-base-300 shadow-sm flex flex-col gap-4">
      <div class="h-4 w-40 skeleton rounded"></div>
      <div class="space-y-4">
        <div class="space-y-2">
          <div class="h-3 w-32 skeleton rounded"></div>
          <div class="h-4 w-full skeleton rounded"></div>
          <div class="h-4 w-full skeleton rounded"></div>
        </div>
        <div class="border-t border-base-200 pt-3 space-y-2">
          <div class="h-3 w-36 skeleton rounded"></div>
          <div class="h-4 w-full skeleton rounded"></div>
          <div class="h-4 w-full skeleton rounded"></div>
        </div>
      </div>
    </div>

    <!-- Operator Details Sheet Skeleton -->
    <div class="bg-base-100 p-5 rounded-2xl border border-base-300 shadow-sm flex flex-col gap-4 lg:col-span-2">
      <div class="flex items-center justify-between border-b border-base-200 pb-3">
        <div class="h-4 w-32 skeleton rounded"></div>
        <div class="h-8 w-44 skeleton rounded-xl"></div>
      </div>
      <div class="py-12 text-center text-base-content/40 font-medium">
        <div class="h-4 w-72 skeleton rounded mx-auto"></div>
      </div>
    </div>
  </div>
</div>
```
