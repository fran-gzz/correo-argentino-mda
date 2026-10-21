import "dotenv/config";
import { test, expect } from "@playwright/test";
import {
  createTestUserAndSession,
  cleanupTestUser,
  setSessionCookie,
} from "./helpers/auth";

/**
 * Vista "/broadcast": wallboard de llamadas en vivo (Wise CX) para proyectar
 * en una TV. 4 KPIs grandes + grid de cards con las llamadas activas.
 *
 * La fuente es Wise CX Analytics (endpoint publico Reports.svc). Los asserts
 * son estructurales (que el tablero exista y sea coherente), no sobre valores
 * concretos: la cantidad de llamadas cambia segundo a segundo.
 */

/** Orden de los KPIs en pantalla. */
const KPI_ORDER = ["ringing", "attended", "enqueued", "ivr"];

let agentUser: Awaited<ReturnType<typeof createTestUserAndSession>>;

test.beforeAll(async () => {
  agentUser = await createTestUserAndSession("agent");
});

test.afterAll(async () => {
  await cleanupTestUser(agentUser.userId, agentUser.sessionId);
});

test.describe("Broadcast de llamadas", () => {
  test("el agente accede al wallboard con el chrome del portal y el boton de pantalla completa", async ({
    context,
    page,
  }) => {
    await setSessionCookie(context, agentUser.signedSessionId);
    await page.goto("/broadcast");

    // El sidebar vuelve a estar: la vista no se sale del layout del portal.
    await expect(page.locator("#main-drawer")).toHaveCount(1);

    // El server island resuelve los datos: el tablero aparece.
    const root = page.locator("[data-broadcast-root]");
    await expect(root).toBeVisible({ timeout: 30_000 });

    // Pantalla completa: el boton vive dentro del root que se expande.
    const fullscreenButton = root.locator("[data-fullscreen-toggle]");
    await expect(fullscreenButton).toBeVisible();
    await expect(fullscreenButton).toContainText("Pantalla completa");
    await expect(root).toHaveAttribute("data-fullscreen-root", "");
  });

  test("muestra los cuatro estados en orden, con numero grande", async ({
    context,
    page,
  }) => {
    await setSessionCookie(context, agentUser.signedSessionId);
    await page.goto("/broadcast");

    const root = page.locator("[data-broadcast-root]");
    await expect(root).toBeVisible({ timeout: 30_000 });

    const kpis = root.locator("[data-broadcast-kpi]");
    await expect(kpis).toHaveCount(4);

    // Orden: Sonando | Activas | En Cola | En IVR.
    const keys = await kpis.evaluateAll((els) =>
      els.map((el) => el.getAttribute("data-broadcast-kpi")),
    );
    expect(keys).toEqual(KPI_ORDER);

    // Los labels visibles acompannian el dato.
    await expect(root).toContainText("Sonando");
    await expect(root).toContainText("Activas");
    await expect(root).toContainText("En Cola");
    await expect(root).toContainText("En IVR");

    // El numero se lee a distancia: fuente grande.
    for (const kpi of await kpis.all()) {
      const fontSize = await kpi.evaluate((el) =>
        parseFloat(getComputedStyle(el).fontSize),
      );
      expect(fontSize).toBeGreaterThanOrEqual(48);
    }
  });

  test("el color del numero depende de si hay llamadas", async ({
    context,
    page,
  }) => {
    await setSessionCookie(context, agentUser.signedSessionId);
    await page.goto("/broadcast");

    const root = page.locator("[data-broadcast-root]");
    await expect(root).toBeVisible({ timeout: 30_000 });

    for (const key of KPI_ORDER) {
      const kpi = root.locator(`[data-broadcast-kpi="${key}"]`);
      const value = Number((await kpi.textContent())?.trim() ?? "0");
      const classes = (await kpi.getAttribute("class")) ?? "";

      if (value === 0) {
        expect(classes).toContain("text-base-content/40");
      } else {
        expect(classes).toContain("text-secondary");
      }
    }
  });

  test("el chip En vivo y la frescura del snapshot estan presentes", async ({
    context,
    page,
  }) => {
    await setSessionCookie(context, agentUser.signedSessionId);
    await page.goto("/broadcast");

    const root = page.locator("[data-broadcast-root]");
    await expect(root).toBeVisible({ timeout: 30_000 });

    await expect(root.locator("[data-broadcast-vivo]")).toContainText("En vivo");
    await expect(root.locator("[data-broadcast-freshness]")).not.toBeEmpty();
  });

  test("las llamadas se listan en cards con el total en badge", async ({
    context,
    page,
  }) => {
    await setSessionCookie(context, agentUser.signedSessionId);
    await page.goto("/broadcast");

    const root = page.locator("[data-broadcast-root]");
    await expect(root).toBeVisible({ timeout: 30_000 });

    await expect(
      page.getByRole("heading", { name: "Llamadas activas" }),
    ).toBeVisible();

    const total = root.locator("[data-broadcast-total]");
    await expect(total).toBeVisible();
    // El total se muestra como badge pegado al titulo.
    await expect(total).toHaveClass(/badge/);

    const cards = page.locator("[data-broadcast-card]");
    const count = await cards.count();

    expect(Number((await total.textContent())?.trim())).toBe(count);

    if (count > 0) {
      const primera = cards.first();
      await expect(primera.locator("[data-estado-badge]")).toBeVisible();
      await expect(primera.locator('[data-field="agente"]')).not.toBeEmpty();
      await expect(primera.locator('[data-field="tiempo"]')).not.toBeEmpty();

      const layout = await cards
        .first()
        .evaluate((el) =>
          el.parentElement ? getComputedStyle(el.parentElement).display : "",
        );
      expect(layout).toBe("grid");
    } else {
      await expect(root.locator("[data-broadcast-empty]")).toBeVisible();
    }
  });

  test("una llamada en IVR sin agente se explica en vez de mostrar Sin Asignar", async ({
    context,
    page,
  }) => {
    await setSessionCookie(context, agentUser.signedSessionId);

    // Snapshot controlado: una llamada en IVR sin agente. No depende de que
    // haya llamadas en IVR justo en el momento del test.
    const snapshot = {
      kpis: {
        active: 0,
        attended: 1,
        ringing: 0,
        enqueued: 0,
        ivr: 1,
        overflow: 0,
        avgWaitSeconds: 0,
        avgWaitLabel: "0s",
      },
      calls: [
        {
          callId: 1,
          agentName: "[Sin Asignar]",
          state: "en_ivr",
          stateLabel: "En IVR",
          groupName: "[Sin Asignar]",
          elapsedSeconds: 12,
          createdAt: new Date().toISOString(),
          createdAtLocal: "2026-10-21 12:00:00.0000",
        },
        {
          callId: 2,
          agentName: "Tamara Cardenas.",
          state: "en_curso",
          stateLabel: "En curso",
          groupName: "Track and Trace",
          elapsedSeconds: 30,
          createdAt: new Date().toISOString(),
          createdAtLocal: "2026-10-21 12:01:00.0000",
        },
      ],
      fetchedAt: new Date().toISOString(),
      stale: false,
    };

    await page.route("**/api/broadcast/estado", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(snapshot),
      });
    });

    await page.goto("/broadcast");
    await expect(page.locator("[data-broadcast-root]")).toBeVisible({
      timeout: 30_000,
    });

    // El render inicial viene del server island (datos reales); el primer
    // ciclo de polling (10 s) aplica el snapshot controlado.
    await expect
      .poll(() => page.locator("[data-broadcast-card]").count(), {
        timeout: 25_000,
        intervals: [1000],
      })
      .toBe(2);

    const ivrCard = page
      .locator("[data-broadcast-card]")
      .filter({ hasText: "En IVR" })
      .first();

    await expect(ivrCard.locator('[data-field="agente"]')).toHaveText("En IVR");
    await expect(ivrCard.locator('[data-field="grupo"]')).toHaveText(
      "Cliente se encuentra en el menú",
    );
    await expect(ivrCard).not.toContainText("[Sin Asignar]");

    // El color del numero se recalcula con el snapshot: 1 -> acento, 0 -> gris.
    await expect(page.locator('[data-broadcast-kpi="ivr"]')).toHaveClass(
      /text-secondary/,
    );
    await expect(page.locator('[data-broadcast-kpi="ringing"]')).toHaveClass(
      /text-base-content\/40/,
    );
  });

  test("el polling refresca el tablero sin recargar la pagina", async ({
    context,
    page,
  }) => {
    await setSessionCookie(context, agentUser.signedSessionId);

    let pollingHits = 0;
    page.on("request", (req) => {
      if (req.url().includes("/api/broadcast/estado")) pollingHits += 1;
    });

    await page.goto("/broadcast");
    await expect(page.locator("[data-broadcast-root]")).toBeVisible({
      timeout: 30_000,
    });

    const hitsAfterLoad = pollingHits;

    await expect
      .poll(() => pollingHits, { timeout: 20_000, intervals: [1000] })
      .toBeGreaterThan(hitsAfterLoad);
  });

  test("el endpoint de estado responde con el shape esperado", async ({
    context,
    page,
  }) => {
    await setSessionCookie(context, agentUser.signedSessionId);
    await page.goto("/broadcast");

    const baseURL = test.info().project.use.baseURL;
    expect(baseURL).toBeTruthy();
    const endpoint = new URL("api/broadcast/estado", baseURL!).toString();

    const result = await page.evaluate(async (url) => {
      const response = await fetch(url, {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      return { status: response.status, body: await response.json() };
    }, endpoint);

    expect(result.status).toBe(200);

    const body = result.body;
    expect(body).toHaveProperty("kpis");
    expect(body.kpis).toHaveProperty("ringing");
    expect(body.kpis).toHaveProperty("attended");
    expect(body.kpis).toHaveProperty("enqueued");
    expect(body.kpis).toHaveProperty("ivr");
    expect(body).toHaveProperty("calls");
    expect(Array.isArray(body.calls)).toBe(true);
    // La vista no consume InvGate: el payload no trae mesa ni grupos.
    expect(body).not.toHaveProperty("mesa");
  });

  test("el endpoint de estado exige sesion", async ({ request }) => {
    const response = await request.get("/api/broadcast/estado");
    expect(response.status()).toBe(401);
  });
});
