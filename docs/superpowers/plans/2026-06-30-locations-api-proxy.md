# Locations API Proxy Endpoint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a new API proxy endpoint `src/pages/api/invgate/locations.ts` that matches, caches, filters, and paginates InvGate locations against SQLite offices data for admin consumption.

**Architecture:** The endpoint validates user session and admin permissions, checks/updates a module-level cached comparison result (fetching from InvGate and querying the local SQLite offices table when needed), filters results dynamically based on parameters, and returns paginated JSON.

**Tech Stack:** Astro APIRoute, Drizzle ORM, InvGate Client, TypeScript.

---

### Task 1: Create the API Endpoint

**Files:**
- Create: `src/pages/api/invgate/locations.ts`

- [ ] **Step 1: Write the endpoint template with imports and structure**
  Write the endpoint skeleton with imports (`APIRoute`, `can`, `invgateGet`, `jsonResponse`, `db`, `offices`, `matchLocations`, `LocationComparisonResult`), the module-level variable `cachedComparison`, and authorization check logic.
  
  ```typescript
  import type { APIRoute } from "astro";
  import { can } from "@lib/roleConfig";
  import { invgateGet } from "@lib/invgateClient";
  import { jsonResponse } from "@lib/apiResponse";
  import { db } from "@db/index";
  import { offices } from "@db/schema";
  import { matchLocations } from "@lib/invgate/locationMatcher";
  import type { LocationComparisonResult } from "@lib/invgate/locationMatcher";
  import type { InvgateLocation } from "@/types/invgate";

  let cachedComparison: LocationComparisonResult | null = null;

  export const GET: APIRoute = async ({ locals, request }) => {
    if (!locals.user || locals.user.id === 0) {
      return jsonResponse({ error: "No autorizado" }, 401);
    }
    if (!can(locals.user.role, "admin")) {
      return jsonResponse({ error: "Prohibido" }, 403);
    }
    // ... rest of implementation will go here
  };
  ```

- [ ] **Step 2: Add parameter parsing, sync/fetch/cache logic**
  Parse parameters `action`, `page`, `limit`, `filter`, and `q`. Implement the cached comparison fetching and syncing logic.
  
  ```typescript
  const url = new URL(request.url);
  const action = url.searchParams.get("action");
  const page = parseInt(url.searchParams.get("page") ?? "1", 10) || 1;
  const limit = parseInt(url.searchParams.get("limit") ?? "50", 10) || 50;
  const filter = url.searchParams.get("filter") ?? "all";
  const q = url.searchParams.get("q") ?? "";

  if (action === "sync" || cachedComparison === null) {
    const response = await invgateGet<InvgateLocation[]>("locations");
    if (!response.ok) {
      return jsonResponse({ error: response.message }, response.status || 500);
    }

    const dbOffices = await db.select({
      code: offices.code,
      name: offices.name,
      address: offices.address,
    }).from(offices);

    const officeMap = new Map<string, { name: string; address: string }>();
    for (const off of dbOffices) {
      officeMap.set(off.code, {
        name: off.name,
        address: off.address ?? "",
      });
    }

    cachedComparison = matchLocations(response.data, officeMap);
  }
  ```

- [ ] **Step 3: Add filtering and pagination logic**
  Filter the comparison results based on state (`filter`) and query search (`q`). Paginate the filtered results and return the final JSON payload.
  
  ```typescript
  let filtered = cachedComparison.results;

  if (filter === "matched") {
    filtered = filtered.filter((r) => r.matched);
  } else if (filter === "unmatched") {
    filtered = filtered.filter((r) => !r.matched);
  }

  const query = q.toLowerCase().trim();
  if (query) {
    filtered = filtered.filter((r) => {
      const inv = r.invgateLocation;
      return (
        inv.displayName.toLowerCase().includes(query) ||
        inv.name.toLowerCase().includes(query) ||
        (inv.nis && inv.nis.toLowerCase().includes(query)) ||
        (inv.cp && inv.cp.toLowerCase().includes(query)) ||
        (inv.cc && inv.cc.toLowerCase().includes(query))
      );
    });
  }

  const totalItems = filtered.length;
  const totalPages = Math.ceil(totalItems / limit) || 1;
  const safePage = Math.max(1, Math.min(page, totalPages));
  const offset = (safePage - 1) * limit;
  const paginatedResults = filtered.slice(offset, offset + limit);

  return jsonResponse({
    results: paginatedResults,
    stats: cachedComparison.stats,
    pagination: {
      page: safePage,
      limit,
      totalPages,
      totalItems,
    },
  });
  ```

- [ ] **Step 4: Run typecheck/build check**
  Run Astro build check to verify typescript and build compatibility:
  `npm run build`
  Expected: Command succeeds with no errors.
