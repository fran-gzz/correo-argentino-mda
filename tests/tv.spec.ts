import "dotenv/config";
import { test, expect } from "@playwright/test";
import {
  createTestUserAndSession,
  cleanupTestUser,
  setSessionCookie,
} from "./helpers/auth";

/**
 * Vista "/tv": wallboard de la mesa para proyectar en una pantalla.
 *
 * Cubre: chrome del portal, KPIs, llamadas, ranking completo, métricas de la
 * mesa, estados de error, polling, redirect desde la ruta vieja y shape del
 * endpoint.
 */

/** Orden de los KPIs en pantalla. */
const KPI_ORDER = ["ringing", "attended", "enqueued", "ivr"];

let agentUser: Awaited<ReturnType<typeof createTestUserAndSession>>;
let supervisorUser: Awaited<ReturnType<typeof createTestUserAndSession>>;

test.beforeAll(async () => {
  agentUser = await createTestUserAndSession("agent");
  supervisorUser = await createTestUserAndSession("supervisor");
});

test.afterAll(async () => {
  await cleanupTestUser(agentUser.userId, agentUser.sessionId);
  await cleanupTestUser(supervisorUser.userId, supervisorUser.sessionId);
});

function baseCalidad() {
  return {
    month: "10-2026",
    monthLabel: "Octubre 2026",
    usedFallback: false,
    totalAuditorias: 40,
    operadoresAuditados: 12,
    promedioGeneral: 81,
    aprobados: 6,
    aprobadosTotal: 12,
    porCanal: [
      { key: "wise_call", label: "Llamadas", avg: 80.5, count: 20 },
      { key: "wise_email", label: "Mails", avg: 82.2, count: 12 },
      { key: "invgate_ticket", label: "Autogestiones", avg: 79.8, count: 8 },
    ],
    ranking: [
      {
        agentId: 1,
        name: "MOCK UNO",
        score: 95.5,
        audits: 12,
        quotaFulfilled: true,
      },
      {
        agentId: 2,
        name: "MOCK DOS",
        score: 88,
        audits: 10,
        quotaFulfilled: true,
      },
      {
        agentId: 3,
        name: "MOCK TRES",
        score: 81.2,
        audits: 8,
        quotaFulfilled: false,
      },
      {
        agentId: 4,
        name: "MOCK CUATRO",
        score: 74.9,
        audits: 6,
        quotaFulfilled: false,
      },
      {
        agentId: 5,
        name: "MOCK CINCO",
        score: 60,
        audits: 4,
        quotaFulfilled: false,
      },
      {
        agentId: 6,
        name: "MOCK SEIS",
        score: 58,
        audits: 4,
        quotaFulfilled: false,
      },
      {
        agentId: 7,
        name: "MOCK SIETE",
        score: 56,
        audits: 4,
        quotaFulfilled: false,
      },
      {
        agentId: 8,
        name: "MOCK OCHO",
        score: 54,
        audits: 4,
        quotaFulfilled: false,
      },
      {
        agentId: 9,
        name: "MOCK NUEVE",
        score: 52,
        audits: 4,
        quotaFulfilled: false,
      },
      {
        agentId: 10,
        name: "MOCK DIEZ",
        score: 50,
        audits: 4,
        quotaFulfilled: false,
      },
      {
        agentId: 11,
        name: "MOCK ONCE",
        score: 48,
        audits: 4,
        quotaFulfilled: false,
      },
      {
        agentId: 12,
        name: "MOCK DOCE",
        score: 46,
        audits: 4,
        quotaFulfilled: false,
      },
    ],
  };
}

function baseCasos() {
  return {
    helpdeskId: 2510,
    helpdeskExplicit: true,
    total: 3,
    porCategoria: [
      { categoryId: 1127, label: "Nueva Solicitud", count: 3 },
    ],
    casos: [
      {
        id: 98024,
        prettyId: "98024",
        title: "ECOM sistema central paq",
        categoryId: 1127,
        categoryName: "Nueva Solicitud",
        statusId: 2,
        statusName: "Abierto",
        assignedId: null,
        creatorName: "Marcelo Perez",
        locationName: "CONCEPCION DEL URUGUAY",
        createdAt: Math.floor(Date.now() / 1000) - 3600,
        ageHours: 1,
      },
    ],
    metricas: {
      abiertos: 86,
      sinAsignar: 3,
      asignados: 83,
      porEstado: [
        { statusId: 2, name: "Abierto", count: 18 },
        { statusId: 3, name: "Pendiente", count: 4 },
        { statusId: 4, name: "En espera", count: 55 },
      ],
      antiguedadMedianaHoras: 161.7,
      masAntiguoHoras: 7055,
    },
    actualizadoAt: new Date().toISOString(),
  };
}

function baseKpis() {
  return {
    active: 0,
    attended: 0,
    ringing: 0,
    enqueued: 0,
    ivr: 0,
    overflow: 0,
    avgWaitSeconds: 0,
    avgWaitLabel: "0s",
  };
}

test.describe("TV de la mesa", () => {
  test("el agente accede al tablero con el chrome del portal y el boton de pantalla completa", async ({
    context,
    page,
  }) => {
    await setSessionCookie(context, agentUser.signedSessionId);
    await page.goto("/tv");

    await expect(page.locator("#main-drawer")).toHaveCount(1);

    const root = page.locator("[data-tv-root]");
    await expect(root).toBeVisible({ timeout: 30_000 });

    const fullscreenButton = root.locator("[data-fullscreen-toggle]");
    await expect(fullscreenButton).toBeVisible();
    await expect(fullscreenButton).toContainText("Pantalla completa");
    await expect(root).toHaveAttribute("data-fullscreen-root", "");

    await fullscreenButton.click();
    await expect(root).toHaveClass(/is-fullscreen/, { timeout: 5_000 });
    await fullscreenButton.click();
    await expect(root).not.toHaveClass(/is-fullscreen/, { timeout: 5_000 });
  });

  test("la ruta vieja /broadcast redirige a /tv", async ({ context, page }) => {
    await setSessionCookie(context, agentUser.signedSessionId);
    await page.goto("/broadcast");
    await expect(page).toHaveURL(/\/tv$/);
    await expect(page.locator("[data-tv-root]")).toBeVisible({
      timeout: 30_000,
    });
  });

  test("muestra los cuatro estados en orden, con numero grande", async ({
    context,
    page,
  }) => {
    await setSessionCookie(context, agentUser.signedSessionId);
    await page.goto("/tv");

    const root = page.locator("[data-tv-root]");
    await expect(root).toBeVisible({ timeout: 30_000 });

    const kpis = root.locator("[data-tv-kpi]");
    await expect(kpis).toHaveCount(4);

    const keys = await kpis.evaluateAll((els) =>
      els.map((el) => el.getAttribute("data-tv-kpi")),
    );
    expect(keys).toEqual(KPI_ORDER);

    await expect(root).toContainText("Sonando");
    await expect(root).toContainText("Activas");
    await expect(root).toContainText("En cola");
    await expect(root).toContainText("En IVR");

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
    await page.goto("/tv");

    const root = page.locator("[data-tv-root]");
    await expect(root).toBeVisible({ timeout: 30_000 });

    for (const key of KPI_ORDER) {
      const kpi = root.locator(`[data-tv-kpi="${key}"]`);
      const value = Number((await kpi.textContent())?.trim() ?? "0");
      const classes = (await kpi.getAttribute("class")) ?? "";

      if (value === 0) {
        expect(classes).toContain("text-base-content/50");
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
    await page.goto("/tv");

    const root = page.locator("[data-tv-root]");
    await expect(root).toBeVisible({ timeout: 30_000 });

    await expect(root.locator("[data-tv-live]")).toContainText("En vivo");
    await expect(root.locator("[data-tv-freshness]")).not.toBeEmpty();
  });

  test("si el polling falla, el tablero deja de decir En vivo", async ({
    context,
    page,
  }) => {
    await setSessionCookie(context, agentUser.signedSessionId);

    await page.route("**/api/tv/estado", async (route) => {
      await route.abort();
    });

    await page.goto("/tv");
    const root = page.locator("[data-tv-root]");
    await expect(root).toBeVisible({ timeout: 30_000 });

    await expect(root.locator("[data-tv-live-label]")).toHaveText("Sin datos", {
      timeout: 25_000,
    });
  });

  test("las llamadas se listan en filas con el total en badge", async ({
    context,
    page,
  }) => {
    await setSessionCookie(context, agentUser.signedSessionId);
    await page.goto("/tv");

    const root = page.locator("[data-tv-root]");
    await expect(root).toBeVisible({ timeout: 30_000 });

    await expect(
      page.getByRole("heading", { name: "Llamadas activas" }),
    ).toBeVisible();

    const total = root.locator("[data-tv-total]");
    await expect(total).toBeVisible();
    await expect(total).toHaveClass(/badge/);

    const cards = page.locator("[data-tv-card]");
    const count = await cards.count();

    expect(Number((await total.textContent())?.trim())).toBe(count);

    if (count > 0) {
      const primera = cards.first();
      await expect(primera.locator("[data-estado-badge]")).toBeVisible();
      await expect(primera.locator('[data-field="agente"]')).not.toBeEmpty();
      await expect(primera.locator('[data-field="tiempo"]')).not.toBeEmpty();
    } else {
      await expect(root.locator("[data-tv-empty]")).toBeVisible();
    }
  });

  test("una llamada en IVR sin agente se explica en vez de mostrar Sin Asignar", async ({
    context,
    page,
  }) => {
    await setSessionCookie(context, agentUser.signedSessionId);

    const snapshot = {
      kpis: { ...baseKpis(), attended: 1, ivr: 1 },
      calls: [
        {
          callId: 1,
          agentName: "[Sin Asignar]",
          state: "en_ivr",
          stateLabel: "En IVR",
          groupName: "[Sin Asignar]",
          elapsedSeconds: 12,
          createdAt: new Date().toISOString(),
        },
        {
          callId: 2,
          agentName: "MOCK AGENTE CURSO",
          state: "en_curso",
          stateLabel: "En curso",
          groupName: "Track and Trace",
          elapsedSeconds: 30,
          createdAt: new Date().toISOString(),
        },
      ],
      fetchedAt: new Date().toISOString(),
      stale: false,
      casos: baseCasos(),
      calidad: baseCalidad(),
    };

    await page.route("**/api/tv/estado", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(snapshot),
      });
    });

    await page.goto("/tv");
    await expect(page.locator("[data-tv-root]")).toBeVisible({
      timeout: 30_000,
    });

    await expect(page.locator("[data-tv-cards]")).toContainText(
      "MOCK AGENTE CURSO",
      { timeout: 25_000 },
    );

    const ivrCard = page
      .locator("[data-tv-card]")
      .filter({ hasText: "En IVR" })
      .first();

    await expect(ivrCard.locator('[data-field="agente"]')).toHaveText("En IVR");
    await expect(ivrCard.locator('[data-field="grupo"]')).toHaveText(
      "Cliente se encuentra en el menú",
    );
    await expect(ivrCard).not.toContainText("[Sin Asignar]");

    await expect(page.locator('[data-tv-kpi="ivr"]')).toHaveClass(
      /text-secondary/,
    );
    await expect(page.locator('[data-tv-kpi="ringing"]')).toHaveClass(
      /text-base-content\/50/,
    );
  });

  test("una llamada en hold se muestra con el badge En espera", async ({
    context,
    page,
  }) => {
    await setSessionCookie(context, agentUser.signedSessionId);

    const nowSeconds = Math.floor(Date.now() / 1000);
    const snapshot = {
      kpis: { ...baseKpis(), active: 1, attended: 1 },
      calls: [
        {
          callId: 9001,
          agentName: "MOCK AGENTE HOLD",
          state: "en_espera",
          stateLabel: "En espera",
          groupName: "Track and Trace",
          elapsedSeconds: 120,
          createdAt: new Date(nowSeconds * 1000).toISOString(),
        },
      ],
      fetchedAt: new Date().toISOString(),
      stale: false,
      casos: baseCasos(),
      calidad: baseCalidad(),
    };

    await page.route("**/api/tv/estado", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(snapshot),
      });
    });

    await page.goto("/tv");
    await expect(page.locator("[data-tv-root]")).toBeVisible({
      timeout: 30_000,
    });

    await expect(page.locator("[data-tv-cards]")).toContainText(
      "MOCK AGENTE HOLD",
      { timeout: 25_000 },
    );

    const card = page
      .locator("[data-tv-card]")
      .filter({ hasText: "MOCK AGENTE HOLD" });
    await expect(card.locator("[data-estado-badge]")).toHaveText("En espera");
  });

  test("el podio muestra el Top 3 y el modal el ranking completo", async ({
    context,
    page,
  }) => {
    await setSessionCookie(context, agentUser.signedSessionId);

    const snapshot = {
      kpis: baseKpis(),
      calls: [],
      fetchedAt: new Date().toISOString(),
      stale: false,
      casos: baseCasos(),
      calidad: baseCalidad(),
    };

    await page.route("**/api/tv/estado", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(snapshot),
      });
    });

    await page.goto("/tv");
    await expect(page.locator("[data-tv-root]")).toBeVisible({
      timeout: 30_000,
    });

    await expect(
      page.locator('[data-tv-podio-row="1"] [data-field="nombre"]'),
    ).toHaveText("MOCK UNO", { timeout: 25_000 });

    // El podio solo muestra 3, aunque el ranking tenga 12.
    await expect(page.locator('[data-tv-podio-row="1"]')).toBeVisible();
    await expect(page.locator('[data-tv-podio-row="2"]')).toBeVisible();
    await expect(page.locator('[data-tv-podio-row="3"]')).toBeVisible();
    await expect(page.locator("[data-tv-podio-rows]")).not.toContainText(
      "MOCK CUATRO",
    );

    // Orden visual 2º, 1º, 3º y 1º más alto (podio).
    const cajas = await Promise.all(
      [2, 1, 3].map((puesto) =>
        page.locator(`[data-tv-podio-row="${puesto}"]`).boundingBox(),
      ),
    );
    expect(cajas[0]).not.toBeNull();
    expect(cajas[1]).not.toBeNull();
    expect(cajas[2]).not.toBeNull();
    expect(cajas[0]!.x).toBeLessThan(cajas[1]!.x);
    expect(cajas[1]!.x).toBeLessThan(cajas[2]!.x);
    expect(cajas[1]!.y).toBeLessThan(cajas[0]!.y);
    expect(cajas[1]!.y).toBeLessThan(cajas[2]!.y);

    await expect(
      page.locator('[data-tv-podio-row="1"] [data-field="score"]'),
    ).toHaveText("95.5%");
    await expect(
      page.locator('[data-tv-podio-row="2"] [data-field="nombre"]'),
    ).toHaveText("MOCK DOS");
    await expect(
      page.locator('[data-tv-podio-row="3"] [data-field="nombre"]'),
    ).toHaveText("MOCK TRES");

    // La lista muestra del 4º al 10º, con tope de 10.
    const top10 = page.locator("[data-tv-top10-list] [data-tv-top10-row]");
    await expect(top10).toHaveCount(7);
    const top10Nombres = await top10
      .locator('[data-field="nombre"]')
      .evaluateAll((els) => els.map((el) => el.textContent?.trim()));
    expect(top10Nombres).toEqual([
      "MOCK CUATRO",
      "MOCK CINCO",
      "MOCK SEIS",
      "MOCK SIETE",
      "MOCK OCHO",
      "MOCK NUEVE",
      "MOCK DIEZ",
    ]);
    await expect(top10.first().locator('[data-field="posicion"]')).toHaveText(
      "4º",
    );
    await expect(top10.last().locator('[data-field="posicion"]')).toHaveText(
      "10º",
    );
    await expect(top10.last().locator('[data-field="score"]')).toHaveText(
      "50.0%",
    );
    await expect(page.locator("[data-tv-top10-list]")).not.toContainText(
      "MOCK ONCE",
    );

    const trigger = page.locator("[data-tv-ranking-open]");
    const modal = page.locator("#tv-ranking-modal");

    await trigger.click();
    await expect(modal).toBeVisible();

    const filas = page.locator("[data-tv-modal-body] [data-tv-modal-row]");
    await expect(filas).toHaveCount(12);

    const nombres = await filas
      .locator('[data-field="nombre"]')
      .evaluateAll((els) => els.map((el) => el.textContent?.trim()));
    expect(nombres).toEqual([
      "MOCK UNO",
      "MOCK DOS",
      "MOCK TRES",
      "MOCK CUATRO",
      "MOCK CINCO",
      "MOCK SEIS",
      "MOCK SIETE",
      "MOCK OCHO",
      "MOCK NUEVE",
      "MOCK DIEZ",
      "MOCK ONCE",
      "MOCK DOCE",
    ]);

    await expect(filas.first().locator('[data-field="score"]')).toHaveText(
      "95.5%",
    );
    await expect(filas.last().locator('[data-field="score"]')).toHaveText(
      "46.0%",
    );
    await expect(filas.first().locator('[data-field="posicion"]')).toHaveText(
      "1º",
    );

    // El polling sigue corriendo con el modal abierto y no lo cierra.
    let pollingHits = 0;
    page.on("request", (req) => {
      if (req.url().includes("/api/tv/estado")) pollingHits += 1;
    });
    const hitsBeforeWait = pollingHits;
    await page.waitForTimeout(11_000);
    expect(pollingHits).toBeGreaterThan(hitsBeforeWait);
    await expect(modal).toBeVisible();

    // Foco inicial en la X de cierre y retorno al disparador al cerrar.
    await expect(
      modal.locator('[aria-label="Cerrar"]'),
    ).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(modal).not.toBeVisible();
    await expect(trigger).toBeFocused();

    // Cierre con la X.
    await trigger.click();
    await expect(modal).toBeVisible();
    await modal.locator('[aria-label="Cerrar"]').click();
    await expect(modal).not.toBeVisible();

    // Cierre al hacer clic fuera del contenido.
    await trigger.click();
    await expect(modal).toBeVisible();
    await page.mouse.click(10, 10);
    await expect(modal).not.toBeVisible();
  });

  test("el ranking real coincide entre podio y modal", async ({
    context,
    page,
  }) => {
    await setSessionCookie(context, supervisorUser.signedSessionId);
    await page.goto("/tv");

    const root = page.locator("[data-tv-root]");
    await expect(root).toBeVisible({ timeout: 30_000 });

    const baseURL = test.info().project.use.baseURL;
    expect(baseURL).toBeTruthy();
    const endpoint = new URL("api/tv/estado", baseURL!).toString();

    const body = await page.evaluate(async (url) => {
      const response = await fetch(url, {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      return response.json();
    }, endpoint);

    const ranking = body.calidad.ranking as { name: string }[];
    expect(ranking.length).toBeGreaterThan(0);
    expect(body.calidad).not.toHaveProperty("top");

    // El podio y el modal comparten el mismo array. Esperamos al polling por
    // si el SSR llegó con el ranking vacío.
    const podiumFirst = page.locator(
      '[data-tv-podio-row="1"] [data-field="nombre"]',
    );
    await expect(podiumFirst).not.toBeEmpty({ timeout: 25_000 });
    const podiumName = (await podiumFirst.textContent())?.trim();
    expect(podiumName).toBeTruthy();

    const top10 = page.locator("[data-tv-top10-list] [data-tv-top10-row]");
    const top10First = (
      await top10.first().locator('[data-field="nombre"]').textContent()
    )?.trim();
    expect(top10First).toBeTruthy();

    await page.locator("[data-tv-ranking-open]").click();
    const filas = page.locator("[data-tv-modal-body] [data-tv-modal-row]");
    await expect(filas.first().locator('[data-field="nombre"]')).toHaveText(
      podiumName!,
      { timeout: 25_000 },
    );

    const modalCount = await filas.count();
    expect(modalCount).toBeGreaterThanOrEqual(3);
    const podiumCount = await page
      .locator("[data-tv-podio-row]:visible")
      .count();
    expect(podiumCount).toBe(Math.min(3, modalCount));

    const expectedTop10 = Math.min(7, Math.max(0, modalCount - 3));
    await expect(top10).toHaveCount(expectedTop10);
    await expect(filas.nth(3).locator('[data-field="nombre"]')).toHaveText(
      top10First!,
      { timeout: 25_000 },
    );

    await page.keyboard.press("Escape");
    await expect(page.locator("#tv-ranking-modal")).not.toBeVisible();
  });

  test("muestra el estado vacio del podio cuando no hay auditorias", async ({
    context,
    page,
  }) => {
    await setSessionCookie(context, agentUser.signedSessionId);

    const calidad = {
      ...baseCalidad(),
      ranking: [],
      operadoresAuditados: 0,
      totalAuditorias: 0,
      promedioGeneral: null,
      aprobados: 0,
      aprobadosTotal: 0,
      porCanal: [],
    };

    const snapshot = {
      kpis: baseKpis(),
      calls: [],
      fetchedAt: new Date().toISOString(),
      stale: false,
      casos: baseCasos(),
      calidad,
    };

    await page.route("**/api/tv/estado", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(snapshot),
      });
    });

    await page.goto("/tv");
    await expect(page.locator("[data-tv-root]")).toBeVisible({
      timeout: 30_000,
    });

    await expect(page.locator("[data-tv-podio-empty]")).toBeVisible({
      timeout: 25_000,
    });
    await expect(page.locator("[data-tv-podio-empty]")).toContainText(
      "Todavía no hay auditorías suficientes",
    );
    await expect(page.locator("[data-tv-podio-row]:visible")).toHaveCount(0);
    await expect(page.locator("[data-tv-top10-list]")).toBeHidden();
    await expect(page.locator("[data-tv-ranking-open]")).toBeDisabled();
    await expect(page.locator("[data-tv-podio-cta]")).toBeHidden();
  });

  test("avisa cuando la mesa no esta configurada y la cola vuelve vacia", async ({
    context,
    page,
  }) => {
    await setSessionCookie(context, agentUser.signedSessionId);

    const casos = {
      ...baseCasos(),
      helpdeskId: 3950,
      helpdeskExplicit: false,
      total: 0,
      porCategoria: [],
      casos: [],
      metricas: {
        abiertos: 0,
        sinAsignar: 0,
        asignados: 0,
        porEstado: [],
        antiguedadMedianaHoras: 0,
        masAntiguoHoras: 0,
      },
      warning:
        "La mesa 3950 no devolvió casos. Revisá INVGATE_AGENTS_HELPDESK_ID.",
    };

    const snapshot = {
      kpis: baseKpis(),
      calls: [],
      fetchedAt: new Date().toISOString(),
      stale: false,
      casos,
      calidad: baseCalidad(),
    };

    await page.route("**/api/tv/estado", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(snapshot),
      });
    });

    await page.goto("/tv");
    await expect(page.locator("[data-tv-root]")).toBeVisible({
      timeout: 30_000,
    });

    const warning = page.locator("[data-tv-casos-warning]");
    await expect(warning).toContainText("INVGATE_AGENTS_HELPDESK_ID", {
      timeout: 25_000,
    });
    await expect(page.locator("[data-tv-casos-cards] li")).toHaveCount(0);
    await expect(page.locator("[data-tv-casos-empty]")).toBeVisible();
  });

  test("renderiza los casos sin asignar con su categoria real", async ({
    context,
    page,
  }) => {
    await setSessionCookie(context, agentUser.signedSessionId);

    const casos = baseCasos();
    casos.casos = [
      casos.casos[0],
      {
        id: 98027,
        prettyId: "98027",
        title: "EXCEL WORD",
        categoryId: 1127,
        categoryName: "Nueva Solicitud",
        statusId: 2,
        statusName: "Abierto",
        assignedId: null,
        creatorName: "Agustin Aguirre",
        locationName: "RIO CUARTO",
        createdAt: Math.floor(Date.now() / 1000) - 90000,
        ageHours: 25,
      },
    ] as typeof casos.casos;
    casos.total = 2;
    casos.porCategoria = [
      { categoryId: 1127, label: "Nueva Solicitud", count: 2 },
    ];

    const snapshot = {
      kpis: baseKpis(),
      calls: [],
      fetchedAt: new Date().toISOString(),
      stale: false,
      casos,
      calidad: baseCalidad(),
    };

    await page.route("**/api/tv/estado", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(snapshot),
      });
    });

    await page.goto("/tv");
    await expect(page.locator("[data-tv-root]")).toBeVisible({
      timeout: 30_000,
    });

    await expect(page.locator("[data-tv-casos-cards]")).toContainText("#98024", {
      timeout: 25_000,
    });

    const primera = page
      .locator("[data-tv-caso]")
      .filter({ hasText: "#98024" });
    await expect(primera).toContainText("Nueva Solicitud");
    await expect(primera).toContainText("ECOM sistema central paq");
    await expect(primera.locator('[data-field="edad"]')).not.toBeEmpty();

    await expect(page.locator("[data-tv-casos-total]")).toHaveText("2");
    await expect(
      page.locator('[data-tv-caso-categoria="1127"]'),
    ).toContainText("Nueva Solicitud: 2");
  });

  test("la grilla 1+3 y llamadas/casos en dos columnas", async ({
    context,
    page,
  }) => {
    await setSessionCookie(context, agentUser.signedSessionId);
    await page.goto("/tv");

    const root = page.locator("[data-tv-root]");
    await expect(root).toBeVisible({ timeout: 30_000 });

    const columnas = root.locator("[data-tv-columns]");
    await expect(columnas).toBeVisible();

    const layout = await columnas.evaluate((el) => {
      const styles = getComputedStyle(el);
      return { display: styles.display, columns: styles.gridTemplateColumns };
    });
    expect(layout.display).toBe("grid");
    expect(layout.columns.split(" ").length).toBe(4);

    const izquierda = await root.locator("[data-tv-left]").boundingBox();
    const operaciones = await root.locator("[data-tv-ops]").boundingBox();
    expect(izquierda).not.toBeNull();
    expect(operaciones).not.toBeNull();
    expect(izquierda!.width).toBeLessThan(operaciones!.width);
    expect(izquierda!.width / operaciones!.width).toBeGreaterThan(0.25);
    expect(izquierda!.width / operaciones!.width).toBeLessThan(0.45);

    const paneles = root.locator("[data-tv-ops] > section");
    const llamadas = await paneles.nth(0).boundingBox();
    const casos = await paneles.nth(1).boundingBox();
    expect(llamadas).not.toBeNull();
    expect(casos).not.toBeNull();
    expect(llamadas!.x).toBeLessThan(casos!.x);

    await expect(
      root.getByRole("heading", { name: "Top operadores" }),
    ).toBeVisible();
    await expect(
      root.getByRole("heading", { name: "Llamadas activas" }),
    ).toBeVisible();
    await expect(
      root.getByRole("heading", { name: "Casos sin asignar" }),
    ).toBeVisible();
    await expect(root.locator("[data-tv-top10-list]")).toBeVisible();
  });

  test("el polling refresca el tablero sin recargar la pagina", async ({
    context,
    page,
  }) => {
    await setSessionCookie(context, agentUser.signedSessionId);

    let pollingHits = 0;
    page.on("request", (req) => {
      if (req.url().includes("/api/tv/estado")) pollingHits += 1;
    });

    await page.goto("/tv");
    await expect(page.locator("[data-tv-root]")).toBeVisible({
      timeout: 30_000,
    });

    const hitsAfterLoad = pollingHits;

    await expect
      .poll(() => pollingHits, { timeout: 20_000, intervals: [1000] })
      .toBeGreaterThan(hitsAfterLoad);
  });

  test("el endpoint de estado responde con el shape esperado (supervision)", async ({
    context,
    page,
  }) => {
    await setSessionCookie(context, supervisorUser.signedSessionId);
    await page.goto("/tv");

    const baseURL = test.info().project.use.baseURL;
    expect(baseURL).toBeTruthy();
    const endpoint = new URL("api/tv/estado", baseURL!).toString();

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

    expect(body).toHaveProperty("casos");
    expect(body.casos).toHaveProperty("total");
    expect(body.casos).toHaveProperty("metricas");
    expect(body.casos.metricas).toHaveProperty("abiertos");
    expect(body.casos.metricas).toHaveProperty("sinAsignar");
    expect(body.casos.metricas).toHaveProperty("asignados");
    expect(Array.isArray(body.casos.metricas.porEstado)).toBe(true);
    expect(body.casos.metricas.abiertos).toBeGreaterThanOrEqual(
      body.casos.total,
    );
    expect(Array.isArray(body.casos.casos)).toBe(true);

    for (const caso of body.casos.casos) {
      expect(caso.assignedId).toBeNull();
      expect(caso.categoryId).toBeGreaterThan(0);
      expect(caso.categoryName).toBeTruthy();
    }

    expect(body).toHaveProperty("calidad");
    expect(body.calidad).toHaveProperty("ranking");
    expect(Array.isArray(body.calidad.ranking)).toBe(true);
    expect(body.calidad).not.toHaveProperty("top");
    expect(body.calidad).toHaveProperty("promedioGeneral");

    expect(body).not.toHaveProperty("mesa");
  });

  test("el endpoint de estado exige sesion", async ({ request }) => {
    const response = await request.get("/api/tv/estado");
    expect(response.status()).toBe(401);
  });
});
