# InvGate Client Refactoring Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the InvGate HTTP client to lazily validate environment variables, use the web-standard `btoa` for Base64 encoding, and preserve HTTP status codes on JSON parsing failures.

**Architecture:** Move configuration fetching and validation inside `invgateGet`. Use `btoa` instead of `Buffer.from`. Capture the response status immediately after fetch and return it in the error response if parsing fails.

**Tech Stack:** Astro v5 SSR, TypeScript.

---

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `src/lib/invgateClient.ts` | Refactored client with lazy validation, btoa encoding, and status code retention. |

---

### Task 1: Refactor invgateClient.ts

**Files:**
- Modify: `src/lib/invgateClient.ts`

- [ ] **Step 1: Replace implementation in src/lib/invgateClient.ts**

Update the code to:
1. Move `apiKey` and `baseUrl` declarations and their checks inside `invgateGet`.
2. Replace `Buffer.from("apikey:" + apiKey).toString("base64")` with `btoa("apikey:" + apiKey)`.
3. Declare `let lastStatus = 0;` before the try block (or inside it, before `fetch`).
4. Set `lastStatus = response.status` immediately after the `fetch` call.
5. In the `catch` block, return `status: lastStatus` instead of `0`.
6. Ensure no comments are added in the code.

```typescript
import type { InvgateResult } from "@/types/invgate";

export async function invgateGet<T>(endpoint: string): Promise<InvgateResult<T>> {
  const apiKey = import.meta.env.INVGATE_API_KEY;
  const baseUrl = import.meta.env.INVGATE_BASE_URL;

  if (!apiKey) {
    throw new Error("[InvGate] Variable de entorno INVGATE_API_KEY no definida.");
  }

  if (!baseUrl) {
    throw new Error("[InvGate] Variable de entorno INVGATE_BASE_URL no definida.");
  }

  const credentials = btoa("apikey:" + apiKey);

  const headers = {
    "Authorization": `Basic ${credentials}`,
    "Content-Type": "application/json",
  };

  const url = `${baseUrl}${endpoint}`;
  let lastStatus = 0;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers,
    });

    lastStatus = response.status;

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: `[InvGate] HTTP ${response.status}: ${response.statusText} — ${url}`,
      };
    }

    const data = (await response.json()) as T;

    return {
      ok: true,
      status: response.status,
      data,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return {
      ok: false,
      status: lastStatus,
      message: `[InvGate] Error de red: ${message} — ${url}`,
    };
  }
}
```

- [ ] **Step 2: Verify compilation**

Run: `npx astro check`
Expected: Compilation passes with no errors.

- [ ] **Step 3: Stage changes**

Run: `git add src/lib/invgateClient.ts`
Expected: File is staged. No commit is made.

---

## Verification Plan

### Automated Checks
- Run `npx astro check` to verify compilation.
- Run `git status` to verify `src/lib/invgateClient.ts` is staged.
