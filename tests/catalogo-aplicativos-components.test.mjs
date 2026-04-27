import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const fileUrl = (path) => new URL(path, root);
const read = (path) => readFile(fileUrl(path), "utf8");
const exists = (path) => existsSync(fileUrl(path));

const expectedFiles = [
  "src/pages/catalogo-aplicativos/_components/CatalogAppCard.astro",
  "src/pages/catalogo-aplicativos/_components/CatalogSoftBadge.astro",
  "src/pages/catalogo-aplicativos/_components/CatalogBundleBanner.astro",
  "src/pages/catalogo-aplicativos/_components/types.ts",
  "src/components/ui/AnnouncementBanner.astro",
];

for (const path of expectedFiles) {
  assert.ok(exists(path), `Expected ${path} to exist`);
}

const catalogPage = await read("src/pages/catalogo-aplicativos/index.astro");
const appCard = await read(
  "src/pages/catalogo-aplicativos/_components/CatalogAppCard.astro",
);
const bundleBanner = await read(
  "src/pages/catalogo-aplicativos/_components/CatalogBundleBanner.astro",
);
const softBadge = await read(
  "src/pages/catalogo-aplicativos/_components/CatalogSoftBadge.astro",
);
const announcementBanner = await read(
  "src/components/ui/AnnouncementBanner.astro",
);
const importantLinksView = await read(
  "src/pages/enlaces-importantes/_components/ImportantLinksView.astro",
);

assert.match(
  catalogPage,
  /import\s+CatalogAppCard\s+from\s+"\.\/_components\/CatalogAppCard\.astro"/,
);
assert.match(
  catalogPage,
  /import\s+CatalogBundleBanner\s+from\s+"\.\/_components\/CatalogBundleBanner\.astro"/,
);
assert.doesNotMatch(catalogPage, /interface\s+CatalogItem/);
assert.doesNotMatch(catalogPage, /class="dropdown/);

assert.match(appCard, /interface\s+Props\s*\{\s*item:\s*CatalogItem;\s*\}/);
assert.match(appCard, /dropdown\s+dropdown-bottom/);
assert.match(appCard, /dropdown-content\s+menu/);
assert.match(appCard, /tabindex="0"[\s\S]*role="button"/);
assert.match(appCard, /tabindex="-1"/);
assert.doesNotMatch(appCard, /<details[\s\S]*<summary/);
assert.match(appCard, /CatalogSoftBadge/);
assert.match(appCard, /Version pendiente|Versión pendiente/);
assert.match(appCard, /Pendiente/);

assert.match(
  bundleBanner,
  /interface\s+Props\s*\{\s*bundle:\s*CatalogBundle;\s*\}/,
);
assert.match(bundleBanner, /Descargar \.zip/);
assert.match(bundleBanner, /Disponible pronto/);

assert.match(
  softBadge,
  /tone\?:\s*"primary"\s*\|\s*"secondary"\s*\|\s*"accent"\s*\|\s*"neutral"\s*\|\s*"warning"/,
);
assert.match(softBadge, /bg-primary\/15/);
assert.match(softBadge, /bg-secondary\/15/);

assert.match(announcementBanner, /interface\s+Props/);
assert.match(announcementBanner, /title:\s*string/);
assert.match(announcementBanner, /description:\s*string/);
assert.match(announcementBanner, /href:\s*string/);
assert.match(announcementBanner, /ctaLabel:\s*string/);
assert.match(announcementBanner, /badgeLabel\?:\s*string/);

assert.match(importantLinksView, /AnnouncementBanner/);
assert.doesNotMatch(importantLinksView, /catalogo-aplicativos-cta-title/);
