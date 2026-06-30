# InvGate Admin Diagnostic Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar una tarjeta de diagnóstico en el panel de administración (`/admin`) para verificar bajo demanda el estado de la conexión con la API de InvGate.

**Architecture:** 
- Un nuevo endpoint `/api/admin/invgate-status` protegido que utiliza el cliente `invgateGet` para consultar la API de InvGate y devolver el estado.
- Modificación del componente de frontend `SyncDashboard.astro` para reordenar la grilla en 3 columnas, añadir la tarjeta de estado para InvGate y programar la lógica JS que carga el estado al entrar a la página y al hacer clic en el botón de actualización bajo demanda (con efecto spin).

**Tech Stack:** Astro v5 SSR, Playwright (Testing E2E), TypeScript, Tailwind CSS, DaisyUI v5.

---

## File Structure

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `tests/admin/invgate-diagnostic.spec.ts` | [NEW] | Test de integración/E2E para validar el comportamiento del endpoint y la UI bajo TDD |
| `src/pages/api/admin/invgate-status.ts` | [NEW] | Endpoint protegido de backend que consulta la salud de la API |
| `src/components/admin/SyncDashboard.astro` | [MODIFY] | Frontend de la tarjeta y script de actualización client-side bajo demanda |

---

### Task 1: Escribir el test fallante (RED) en Playwright

**Files:**
- Create: `tests/admin/invgate-diagnostic.spec.ts`

- [ ] **Step 1: Crear archivo de pruebas E2E**

Escribir el archivo `tests/admin/invgate-diagnostic.spec.ts` con tres pruebas específicas:
1. Acceso desautenticado a `/api/admin/invgate-status` debe devolver HTTP 401.
2. Acceso autenticado (admin) a `/api/admin/invgate-status` debe devolver un JSON válido con campos `{ ok, status, message }`.
3. Carga de `/admin` (como admin) debe renderizar la card de InvGate y el botón de refrescar.

```typescript
import 'dotenv/config';
import { test, expect } from '@playwright/test';
import { db } from '../../src/db/index';
import { users, sessions } from '../../src/db/schema';
import { eq } from 'drizzle-orm';
import { createHmac } from 'crypto';

const SECRET_KEY = process.env.SESSION_SECRET || "fallback-secret-do-not-use-in-prod";

function signSessionId(sessionId: string): string {
  const signature = createHmac("sha256", SECRET_KEY).update(sessionId).digest("base64url");
  return `${sessionId}.${signature}`;
}

interface TestUser {
  id: number;
  username: string;
  role: string;
  rawSessionId: string;
  signedSessionId: string;
}

let adminUser: TestUser;

test.beforeAll(async () => {
  const role = 'admin';
  const username = `admin_diag_test_${Date.now()}`;
  const rawSessionId = `test-admin-diag-session-${Date.now()}`;
  const signedSessionId = signSessionId(rawSessionId);

  const [newUser] = await db.insert(users).values({
    username,
    password: 'hashed_fake_password',
    role,
  }).returning({ id: users.id });

  await db.insert(sessions).values({
    id: rawSessionId,
    userId: newUser.id,
    expiresAt: Date.now() + 1000 * 60 * 60 * 24,
  });

  adminUser = {
    id: newUser.id,
    username,
    role,
    rawSessionId,
    signedSessionId,
  };
});

test.afterAll(async () => {
  if (adminUser) {
    await db.delete(sessions).where(eq(sessions.id, adminUser.rawSessionId));
    await db.delete(users).where(eq(users.id, adminUser.id));
  }
});

test.describe('Diagnóstico de InvGate - No Autenticado', () => {
  test('debe retornar 401 al acceder al endpoint de estado sin sesión', async ({ request }) => {
    const response = await request.get('/api/admin/invgate-status');
    expect(response.status()).toBe(401);
  });
});

test.describe('Diagnóstico de InvGate - Autenticado Admin', () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies([{
      name: 'session_id',
      value: adminUser.signedSessionId,
      domain: 'localhost',
      path: '/',
    }]);
  });

  test('debe retornar JSON con estado de conexión', async ({ request }) => {
    const response = await request.get('/api/admin/invgate-status');
    expect(response.status()).toBe(200);
    const json = await response.json();
    expect(json).toHaveProperty('ok');
    expect(json).toHaveProperty('status');
    expect(json).toHaveProperty('message');
  });

  test('debe renderizar la card de diagnóstico en la UI del panel admin', async ({ page }) => {
    await page.goto('/admin');
    const card = page.locator('#sync-dashboard');
    await expect(card).toBeVisible();
    
    const invgateTitle = page.locator('text=Integración InvGate');
    await expect(invgateTitle).toBeVisible();

    const refreshButton = page.locator('#invgate-refresh-btn');
    await expect(refreshButton).toBeVisible();
  });
});
```

- [ ] **Step 2: Ejecutar los tests para verificar que fallan (RED)**

Levantar el servidor en segundo plano si es necesario y ejecutar Playwright:
Run: `npx playwright test tests/admin/invgate-diagnostic.spec.ts`
Expected: FALLA. El test de desautenticado fallará con 404 (el endpoint no existe), el de autenticado fallará con 404 y el de la UI fallará porque no encuentra la tarjeta ni el botón.

- [ ] **Step 3: Preparar archivos para commit (staging)**

Run: `git add tests/admin/invgate-diagnostic.spec.ts`

---

### Task 2: Implementar el endpoint del backend (GREEN)

**Files:**
- Create: `src/pages/api/admin/invgate-status.ts`

- [ ] **Step 1: Crear el endpoint de backend**

Escribir el código en `src/pages/api/admin/invgate-status.ts` con protección de rol y consumo de la capa de servicio:

```typescript
import type { APIRoute } from "astro";
import { invgateGet } from "@/lib/invgateClient";
import { jsonResponse } from "@/lib/apiResponse";

export const GET: APIRoute = async ({ locals }) => {
  if (!locals.user || locals.user.id === 0) {
    return jsonResponse({ error: "No autorizado" }, 401);
  }

  const result = await invgateGet<unknown>("incidents?page=1&page_size=1");

  return jsonResponse({
    ok: result.ok,
    status: result.status,
    message: result.ok
      ? "Conexión exitosa"
      : ("message" in result ? result.message : "Fallo de conexión"),
  });
};
```

- [ ] **Step 2: Ejecutar tests de integración**

Correr Playwright para verificar que los primeros dos tests pasan:
Run: `npx playwright test tests/admin/invgate-diagnostic.spec.ts`
Expected: El test de 401 y el de retornar JSON pasan (GREEN). El de la UI (Test 3) sigue fallando.

- [ ] **Step 3: Preparar archivos para commit**

Run: `git add src/pages/api/admin/invgate-status.ts`

---

### Task 3: Implementar la tarjeta en la UI (GREEN)

**Files:**
- Modify: `src/components/admin/SyncDashboard.astro`

- [ ] **Step 1: Modificar la maquetación HTML de SyncDashboard.astro**

Modificar la grilla principal de `grid-cols-1 md:grid-cols-2` a `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` en la línea 5 y agregar la tarjeta de InvGate:

```html
  <div
    class="card bg-base-100 border border-base-300 flex flex-row items-center justify-between p-5 md:p-6"
  >
    <div class="flex-1 min-w-0">
      <div class="flex items-center gap-2">
        <div
          class="text-xs font-semibold uppercase tracking-wider text-base-content/60 truncate"
        >
          Integración InvGate
        </div>
        <button
          type="button"
          id="invgate-refresh-btn"
          class="btn btn-ghost btn-circle btn-xs text-base-content/50 hover:text-base-content focus:outline-none focus-visible:ring-1 focus-visible:ring-primary"
          title="Verificar conexión de InvGate"
          aria-label="Verificar conexión de InvGate"
        >
          <Icon name="boxicons:refresh" size={14} id="invgate-refresh-icon" />
        </button>
      </div>
      <div
        class="text-lg md:text-xl font-bold mt-0.5 text-base-content"
        id="invgate-status"
      >
        Cargando...
      </div>
      <div class="text-xs text-base-content/50 mt-1 truncate" id="invgate-desc">
        Esperando datos...
      </div>
    </div>
    <div
      class="bg-base-200/60 text-base-content/40 p-3 rounded-xl shrink-0 ml-4"
      id="invgate-icon-container"
    >
      <Icon name="boxicons:plug" size={32} />
    </div>
  </div>
```

- [ ] **Step 2: Agregar lógica de cliente JS en el `<script>`**

Agregar al script de `SyncDashboard.astro` la función `updateInvgateStatus()` para consumir la API e interactuar con el botón:

```typescript
      // 3. Actualizar Integración de InvGate
      const invgateStatusEl = document.getElementById("invgate-status");
      const invgateDescEl = document.getElementById("invgate-desc");
      const invgateIconContainer = document.getElementById("invgate-icon-container");
      const invgateRefreshBtn = document.getElementById("invgate-refresh-btn");
      const invgateRefreshIcon = document.getElementById("invgate-refresh-icon");

      async function updateInvgateStatus() {
        if (!invgateStatusEl) return;
        
        if (invgateRefreshIcon) {
          invgateRefreshIcon.classList.add("animate-spin");
        }
        if (invgateRefreshBtn) {
          invgateRefreshBtn.setAttribute("disabled", "true");
        }

        try {
          const res = await fetch("/api/admin/invgate-status");
          if (!res.ok) throw new Error("Error en la respuesta de la API");

          const data = await res.json();

          let statusText = "Desconectado";
          let statusClass = "text-lg md:text-xl font-bold mt-0.5 text-error";
          let iconContainerClass = "bg-error/15 text-error p-3 rounded-xl shrink-0 ml-4";

          if (data.ok) {
            statusText = "Conectado";
            statusClass = "text-lg md:text-xl font-bold mt-0.5 text-success";
            iconContainerClass = "bg-success/15 text-success p-3 rounded-xl shrink-0 ml-4";
          }

          invgateStatusEl.textContent = statusText;
          invgateStatusEl.className = statusClass;

          if (invgateDescEl) {
            const descText = data.message || `HTTP ${data.status}`;
            invgateDescEl.textContent = descText;
            invgateDescEl.title = descText;
          }

          if (invgateIconContainer) {
            invgateIconContainer.className = iconContainerClass;
          }
        } catch (err) {
          console.error("[SyncDashboard] Error al verificar InvGate:", err);
          invgateStatusEl.textContent = "Error de Conexión";
          invgateStatusEl.className = "text-lg md:text-xl font-bold mt-0.5 text-warning";
          if (invgateIconContainer) {
            invgateIconContainer.className = "bg-warning/15 text-warning p-3 rounded-xl shrink-0 ml-4";
          }
        } finally {
          if (invgateRefreshIcon) {
            invgateRefreshIcon.classList.remove("animate-spin");
          }
          if (invgateRefreshBtn) {
            invgateRefreshBtn.removeAttribute("disabled");
          }
        }
      }

      // Hookear el botón de refresh
      if (invgateRefreshBtn) {
        invgateRefreshBtn.onclick = (e) => {
          e.preventDefault();
          updateInvgateStatus();
        };
      }

      // Llamar al inicio
      updateInvgateStatus();
```

Esto se insertará al final de `updateDashboard()` o de forma integrada dentro de la carga de la página.

- [ ] **Step 3: Ejecutar todos los tests (GREEN)**

Run: `npx playwright test tests/admin/invgate-diagnostic.spec.ts`
Expected: Todos los tests pasan exitosamente.

- [ ] **Step 4: Ejecutar la compilación del proyecto para asegurar tipos**

Run: `npx astro check`
Expected: Sin errores.

- [ ] **Step 5: Preparar archivos para commit**

Run: `git add src/components/admin/SyncDashboard.astro`

---

## Verification Plan

### Automated Tests
- `npx playwright test tests/admin/invgate-diagnostic.spec.ts` para verificar la seguridad, la respuesta del endpoint y la presencia en la UI.
- `npx astro check` para la validez del tipado TypeScript y Astro.

### Manual Verification
- Iniciar sesión como Administrador en el portal.
- Ingresar a `/admin`.
- Verificar que la tarjeta muestre "Cargando..." y luego cambie a "Conectado" o "Error de Conexión" según las credenciales de InvGate vigentes en el `.env` local.
- Presionar el botón de refresco y comprobar que el icono de refrescar gira mientras realiza la petición y actualiza el estado.
