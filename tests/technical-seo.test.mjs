import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pages = [
  "examples/index.html", "guides/index.html",
  "examples/data-connections/local-postgis/index.html",
  "examples/modis-active-fires/index.html",
  "examples/air-quality-pm25/index.html", "examples/usgs-earthquakes/index.html",
  "arcgis-rest-service-viewer/index.html", "arcgis-feature-service-viewer/index.html",
  "arcgis-map-service-viewer/index.html", "geojson-viewer/index.html", "3d-gis-viewer/index.html", "ai-connection-guide/index.html",
];

function localTarget(from, href) {
  const pathname = new URL(href, "https://gismap.online/").pathname;
  if (!pathname.endsWith("/")) return resolve(root, pathname.slice(1));
  return resolve(root, pathname.slice(1), "index.html");
}

test("generated pages have unique technical SEO metadata and valid schema", async () => {
  const titles = new Set();
  const canonicals = new Set();
  for (const page of pages) {
    const html = await readFile(resolve(root, page), "utf8");
    const title = html.match(/<title>([^<]+)<\/title>/)?.[1];
    const description = html.match(/<meta name="description" content="([^"]+)">/)?.[1];
    const canonical = html.match(/<link rel="canonical" href="([^"]+)">/)?.[1];
    assert.ok(title && title.length <= 65, `${page} needs a concise title`);
    assert.ok(description && description.length >= 70 && description.length <= 160, `${page} needs a useful description`);
    assert.ok(canonical?.startsWith("https://gismap.online/"), `${page} needs a canonical URL`);
    assert.ok(!titles.has(title), `duplicate title: ${title}`);
    assert.ok(!canonicals.has(canonical), `duplicate canonical: ${canonical}`);
    titles.add(title); canonicals.add(canonical);
    assert.match(html, /<meta name="robots" content="index, follow, max-image-preview:large">/);
    assert.match(html, /<meta name="twitter:card" content="summary_large_image">/);
    assert.match(html, /aria-label="Breadcrumb"/);
    const schema = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
    assert.ok(schema["@graph"].some((entry) => entry["@type"] === "WebPage"));
    assert.ok(schema["@graph"].some((entry) => entry["@type"] === "BreadcrumbList"));

    for (const href of [...html.matchAll(/href="(\/[^"]*)"/g)].map((match) => match[1])) {
      if (href.startsWith("/?") || href === "/") continue;
      await access(localTarget(page, href));
    }
  }
});

test("sitemap contains every generated canonical URL", async () => {
  const sitemap = await readFile(resolve(root, "sitemap.xml"), "utf8");
  for (const page of pages) {
    const html = await readFile(resolve(root, page), "utf8");
    const canonical = html.match(/<link rel="canonical" href="([^"]+)">/)[1];
    assert.ok(sitemap.includes(`<loc>${canonical}</loc>`), `sitemap is missing ${canonical}`);
  }
});
