# InvGate HTTP Client Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crear la capa de servicio server-side para consumir la API REST v1 de InvGate Service Desk mediante un cliente HTTP tipado, centralizado y seguro.

**Architecture:** Un único módulo en `src/lib/invgateClient.ts` que encapsula la configuración de autenticación (Basic Auth con API Key codificada en Base64), la validación de variables de entorno, y una función genérica `invgateGet<T>()` que inyecta automáticamente las cabeceras y gestiona errores HTTP. Los tipos de respuesta se definen en `src/types/invgate.ts` para mantener la separación de responsabilidades del proyecto.

**Tech Stack:** Astro v5 SSR, TypeScript, `import.meta.env`, `fetch` nativo, `btoa()` para codificación Base64.

---

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `src/types/invgate.ts` | Interfaces TypeScript para la respuesta genérica de la API y errores tipados |
| `src/lib/invgateClient.ts` | Validación de env, construcción de headers, función `invgateGet<T>()` |
| `src/env.d.ts` | Declaración de tipos para las variables `INVGATE_*` en `ImportMetaEnv` |

---

### Task 1: Declarar tipos de entorno para InvGate

**Files:**
- Modify: `src/env.d.ts`

- [ ] **Step 1: Agregar las variables INVGATE al tipo ImportMetaEnv**

Agregar la interfaz `ImportMetaEnv` con las dos variables de InvGate para que TypeScript las reconozca en `import.meta.env`:

```typescript
interface ImportMetaEnv {
  readonly INVGATE_API_KEY: string;
  readonly INVGATE_BASE_URL: string;
}
```

Insertar este bloque después de la línea `/// <reference types="astro/client" />` y antes de `declare namespace App`.

- [ ] **Step 2: Verificar que no hay errores de tipos**

Run: `npx astro check 2>&1 | head -20`
Expected: Sin errores nuevos relacionados con `ImportMetaEnv`.

- [ ] **Step 3: Commit**

```bash
git add src/env.d.ts
git commit -m "feat(env): add InvGate API environment variable types"
```

---

### Task 2: Definir interfaces de respuesta de la API

**Files:**
- Create: `src/types/invgate.ts`

- [ ] **Step 1: Crear el archivo de tipos**

```typescript
export interface InvgateApiResponse<T> {
  data: T;
  status: number;
  ok: true;
}

export interface InvgateApiError {
  message: string;
  status: number;
  ok: false;
}

export type InvgateResult<T> = InvgateApiResponse<T> | InvgateApiError;
```

- [ ] **Step 2: Verificar que compila**

Run: `npx astro check 2>&1 | head -20`
Expected: Sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/types/invgate.ts
git commit -m "feat(types): add InvGate API response interfaces"
```

---

### Task 3: Implementar el cliente HTTP

**Files:**
- Create: `src/lib/invgateClient.ts`

- [ ] **Step 1: Crear el módulo con validación de entorno**

```typescript
const apiKey = import.meta.env.INVGATE_API_KEY;
const baseUrl = import.meta.env.INVGATE_BASE_URL;

if (!apiKey) {
  throw new Error("[InvGate] Variable de entorno INVGATE_API_KEY no definida.");
}

if (!baseUrl) {
  throw new Error("[InvGate] Variable de entorno INVGATE_BASE_URL no definida.");
}
```

- [ ] **Step 2: Agregar construcción del header de autenticación Basic**

La API Key se codifica en Base64 con el formato `apikey:${apiKey}` y se envía como `Authorization: Basic <base64>`:

```typescript
const credentials = btoa(`apikey:${apiKey}`);

const headers: Record<string, string> = {
  Authorization: `Basic ${credentials}`,
  "Content-Type": "application/json",
};
```

- [ ] **Step 3: Implementar la función invgateGet**

```typescript
import type { InvgateResult } from "@types/invgate";

export async function invgateGet<T>(endpoint: string): Promise<InvgateResult<T>> {
  const url = `${baseUrl}${endpoint}`;

  try {
    const response = await fetch(url, { method: "GET", headers });

    if (!response.ok) {
      return {
        message: `[InvGate] HTTP ${response.status}: ${response.statusText} — ${url}`,
        status: response.status,
        ok: false,
      };
    }

    const data: T = await response.json();

    return { data, status: response.status, ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return {
      message: `[InvGate] Error de red: ${message} — ${url}`,
      status: 0,
      ok: false,
    };
  }
}
```

- [ ] **Step 4: Verificar que compila**

Run: `npx astro check 2>&1 | head -20`
Expected: Sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/lib/invgateClient.ts
git commit -m "feat(invgate): add HTTP client with Basic Auth and typed responses"
```

---

### Task 4: Validación de integración

- [ ] **Step 1: Crear una página de prueba temporal**

Crear `src/pages/api/test-invgate.ts` para verificar que el cliente funciona contra la API real:

```typescript
import type { APIRoute } from "astro";
import { invgateGet } from "@lib/invgateClient";

export const GET: APIRoute = async () => {
  const result = await invgateGet<unknown>("incidents?page=1&page_size=1");

  return new Response(JSON.stringify(result, null, 2), {
    status: result.ok ? 200 : result.status || 500,
    headers: { "Content-Type": "application/json" },
  });
};
```

- [ ] **Step 2: Iniciar dev server y probar**

Run: `npm run dev`

Luego acceder a `http://localhost:4321/api/test-invgate` y verificar que:
- Se recibe una respuesta JSON con `ok: true` y datos del endpoint, o
- Se recibe un error tipado con `ok: false`, `status` y `message` descriptivos.

- [ ] **Step 3: Eliminar la página de prueba**

Eliminar `src/pages/api/test-invgate.ts` una vez validado el comportamiento.

- [ ] **Step 4: Verificar build completo**

Run: `npx astro check`
Expected: Sin errores.

- [ ] **Step 5: Commit final**

```bash
git add -A
git commit -m "test(invgate): validate client integration and clean up"
```

---

## Verification Plan

### Manual Verification
1. Arrancar el dev server con `npm run dev`.
2. Hacer un GET a `/api/test-invgate` y verificar respuesta JSON estructurada.
3. Probar con una variable de entorno faltante (renombrar temporalmente `INVGATE_API_KEY` en `.env`) y confirmar que el server lanza la excepción esperada.
4. Eliminar la ruta de prueba después de validar.

### Automated Checks
- `npx astro check` para validar tipos en todo el proyecto.
