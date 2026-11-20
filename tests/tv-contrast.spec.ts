import "dotenv/config";
import { test, expect } from "@playwright/test";
import {
  createTestUserAndSession,
  cleanupTestUser,
  setSessionCookie,
} from "./helpers/auth";

let user: Awaited<ReturnType<typeof createTestUserAndSession>>;

test.beforeAll(async () => {
  user = await createTestUserAndSession("agent");
});

test.afterAll(async () => {
  await cleanupTestUser(user.userId, user.sessionId);
});

const tones = [
  "warning",
  "success",
  "info",
  "secondary",
  "accent",
  "error",
  "neutral",
];

for (const theme of ["light", "dark"] as const) {
  test(`contraste de la TV en tema ${theme}`, async ({ context, page }) => {
    await setSessionCookie(context, user.signedSessionId);
    await page.addInitScript((value) => {
      localStorage.setItem("theme", value);
    }, theme);
    await page.setViewportSize({ width: 1920, height: 1080 });

    await page.goto("/tv");
    await expect(page.locator("[data-tv-root]")).toBeVisible({
      timeout: 30_000,
    });
    await page.waitForTimeout(1200);

    await page.locator("[data-tv-ranking-open]").click();
    await expect(page.locator("#tv-ranking-modal")).toBeVisible();
    await page.waitForTimeout(400);

    const result = await page.evaluate((toneList) => {
      const base =
        getComputedStyle(document.documentElement)
          .getPropertyValue("--color-base-100")
          .trim() || "rgb(239,239,239)";
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext("2d")!;

      /** Compone fg sobre bg y devuelve el pixel final (resuelve alpha y oklab). */
      const composite = (fg: string, bg: string): number[] => {
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, 1, 1);
        ctx.fillStyle = fg;
        ctx.fillRect(0, 0, 1, 1);
        const data = ctx.getImageData(0, 0, 1, 1).data;
        return [data[0], data[1], data[2]];
      };

      const lum = (rgb: number[]): number => {
        const c = rgb.map((v) => {
          const x = v / 255;
          return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
      };

      const ratio = (fg: number[], bg: number[]): number => {
        const [l1, l2] = [lum(fg), lum(bg)].sort((a, b) => b - a);
        return (l1 + 0.05) / (l2 + 0.05);
      };

      const effectiveBg = (el: Element | null): string => {
        const chain: string[] = [];
        let node: Element | null = el;
        while (node) {
          const bg = getComputedStyle(node).backgroundColor;
          if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") {
            chain.push(bg);
          }
          node = node.parentElement;
        }

        // Resuelve de afuera hacia adentro para que las capas con alpha
        // (por ejemplo bg-secondary/5) se compongan sobre el fondo real.
        let resolved = base;
        for (let index = chain.length - 1; index >= 0; index--) {
          resolved = `rgb(${composite(chain[index], resolved).join(",")})`;
        }
        return resolved;
      };

      const probe = document.createElement("div");
      probe.style.position = "absolute";
      probe.style.left = "-9999px";
      probe.style.top = "0";
      document.body.appendChild(probe);

      const badges: Record<string, { ratio: number; size: number }> = {};
      for (const tone of toneList) {
        const el = document.createElement("span");
        el.className = `badge badge-sm badge-${tone}${tone === "error" ? " dark:bg-error/80" : ""}`;
        el.textContent = "Texto";
        probe.appendChild(el);
        const cs = getComputedStyle(el);
        badges[tone] = {
          ratio: +ratio(
            composite(cs.color, cs.backgroundColor),
            composite(cs.backgroundColor, base),
          ).toFixed(2),
          size: parseFloat(cs.fontSize),
        };
      }

      const read = (selector: string) => {
        const el = document.querySelector(selector);
        if (!el) return null;
        const cs = getComputedStyle(el);
        const bg = effectiveBg(el);
        return {
          text: el.textContent?.trim().slice(0, 24),
          fg: cs.color,
          bg,
          size: parseFloat(cs.fontSize),
          ratio: +ratio(composite(cs.color, bg), composite(bg, bg)).toFixed(2),
        };
      };

      return {
        theme: document.documentElement.dataset.theme,
        badges,
        live: read("[data-tv-live]"),
        fullscreen: read("[data-fullscreen-toggle]"),
        score: read('[data-tv-podio-row="1"] [data-field="score"]'),
        kpi: read('[data-tv-kpi="ringing"]'),
        top10Position: read('[data-tv-top10-row] [data-field="posicion"]'),
        top10Name: read('[data-tv-top10-row] [data-field="nombre"]'),
        top10Score: read('[data-tv-top10-row] [data-field="score"]'),
        footer: read("[data-tv-calidad-general]"),
        rankName: read('[data-tv-podio-row="1"] [data-field="nombre"]'),
        modalTitle: read("#tv-ranking-modal-title"),
        modalHeader: read("#tv-ranking-modal thead th"),
        modalName: read(
          '[data-tv-modal-body] [data-tv-modal-row] [data-field="nombre"]',
        ),
        modalScore: read(
          '[data-tv-modal-body] [data-tv-modal-row] [data-field="score"]',
        ),
      };
    }, tones);

    console.log(JSON.stringify(result, null, 2));

    for (const tone of tones) {
      expect(
        result.badges[tone].ratio,
        `badge ${tone} en ${theme}`,
      ).toBeGreaterThanOrEqual(4.5);
    }

    for (const key of [
      "live",
      "fullscreen",
      "score",
      "kpi",
      "top10Position",
      "top10Name",
      "top10Score",
      "footer",
      "rankName",
      "modalTitle",
      "modalHeader",
      "modalName",
      "modalScore",
    ] as const) {
      const item = result[key];
      expect(item, `${key} presente`).not.toBeNull();
      const large = (item?.size ?? 0) >= 18;
      expect(
        item!.ratio,
        `${key} (${item?.size}px) en ${theme}`,
      ).toBeGreaterThanOrEqual(large ? 3 : 4.5);
    }
  });
}
