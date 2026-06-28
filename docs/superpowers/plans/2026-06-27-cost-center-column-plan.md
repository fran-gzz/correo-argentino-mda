# Office Cost Center Column Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Centro de Costo" column to the office directory tables (main and admin) after the address column, and enable searching offices by cost center, without adding any new database columns.

**Architecture:** Mapped cost center from existing database fields on load, append cost center values to the office `searchableText` string for server search, pass cost center to DOM for client-side search, and display it in table rows with custom styling.

**Tech Stack:** Astro, Drizzle ORM, Tailwind CSS (via Tailwind/DaisyUI).

---

### Task 1: Update Data Helpers and Mapping
**Files:**
- Modify: [src/lib/offices.ts](file:///e:/Dev/proyectos/correo-argentino-mda/src/lib/offices.ts)
- Modify: [src/lib/officeQueries.ts](file:///e:/Dev/proyectos/correo-argentino-mda/src/lib/officeQueries.ts)

- [ ] **Step 1: Update `getAllOfficesFromDB` in `src/lib/offices.ts` to compute the active cost center**
  Extract cost center fields and assign the first non-empty value to `costCenter`.
  ```typescript
  // In src/lib/offices.ts inside mapping function:
  const costCenterFields = [
    office.cctAdminOffice,
    office.ccCommercial,
    office.ccCommercialCorp,
    office.ccElectoral,
    office.ccNetworkMgmt,
    office.ccOperations,
    office.ccOperational,
    office.ccHr,
    office.ccSecurity,
    office.ccAdmin,
    office.ccAdmission,
    office.ccCtp,
    office.ccCtt,
    office.ccTransport,
    office.ccLogistics
  ];
  const activeCostCenter = costCenterFields.find(val => val && val.trim() !== "") || "—";
  ```
- [ ] **Step 2: Update `getOfficeDirectoryItems` / main mapping in `src/lib/officeQueries.ts` similarly**
  Change `costCenter: ""` to the active cost center computation.
- [ ] **Step 3: Update `searchableText` generation in create and edit endpoints to include cost center fields**
  - Modify: [src/pages/oficinas/create.astro](file:///e:/Dev/proyectos/correo-argentino-mda/src/pages/oficinas/create.astro)
  - Modify: [src/pages/oficinas/edit/[id].astro](file:///e:/Dev/proyectos/correo-argentino-mda/src/pages/oficinas/edit/[id].astro)
  Ensure cost center fields from form data (`fd.get("cctAdminOffice")`, etc.) are added to the `nextSearchableText` string generation.

---

### Task 2: Update Table Interfaces and Skeletons
**Files:**
- Modify: [src/components/offices/DirectorioContent.astro](file:///e:/Dev/proyectos/correo-argentino-mda/src/components/offices/DirectorioContent.astro)
- Modify: [src/components/offices/DirectorioSkeleton.astro](file:///e:/Dev/proyectos/correo-argentino-mda/src/components/offices/DirectorioSkeleton.astro)
- Modify: [src/components/admin/offices/AdminOfficesContent.astro](file:///e:/Dev/proyectos/correo-argentino-mda/src/components/admin/offices/AdminOfficesContent.astro)
- Modify: [src/components/admin/offices/AdminOfficesSkeleton.astro](file:///e:/Dev/proyectos/correo-argentino-mda/src/components/admin/offices/AdminOfficesSkeleton.astro)

- [ ] **Step 1: Update grid classes in `DirectorioContent.astro` and `DirectorioSkeleton.astro`**
  Modify grid-cols definitions to add a column for Centro de Costo (e.g., `1fr` or `120px`) after the Address column.
- [ ] **Step 2: Add headers for "Centro de Costo"**
  Add `<div slot="header"><DataTableHeaderCell sortKey="costCenter">Centro de Costo</DataTableHeaderCell></div>` after the Address header cell.
- [ ] **Step 3: Perform same grid and header adjustments for admin office views (`AdminOfficesContent.astro` & `AdminOfficesSkeleton.astro`)**

---

### Task 3: Update Office Rows and DOM Search Attributes
**Files:**
- Modify: [src/components/offices/OfficeRow.astro](file:///e:/Dev/proyectos/correo-argentino-mda/src/components/offices/OfficeRow.astro)
- Modify: [src/components/admin/AdminOfficeRow.astro](file:///e:/Dev/proyectos/correo-argentino-mda/src/components/admin/AdminOfficeRow.astro)

- [ ] **Step 1: Update row grids in `OfficeRow.astro` and `AdminOfficeRow.astro`**
  Modify `officeDirectoryRowGridClass` or inline grid column styles to match the new headers.
- [ ] **Step 2: Add cost center column render block**
  Add a cell displaying `{office.costCenter}` with `font-mono text-xs text-base-content/70` class right after the Address cell block.
- [ ] **Step 3: Update `data-search-text` attribute**
  Concatenate `${office.costCenter}` to the `data-search-text` attribute in the root `<article>` or row container to enable DOM-based client search.
