import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
// Pages link relative to themselves; these checks read them as root paths.
import { rootLinksHtml } from "../scripts/relative-links.mjs";
import { POPULAR_SERVICES } from "../js/catalog.js";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8").then((text) => (path.endsWith(".html") ? rootLinksHtml(path, text) : text));

test("examples index is searchable and links every catalog item", async () => {
  const html = await read("examples/index.html");
  assert.match(html, /<link rel="canonical" href="https:\/\/gismap\.online\/examples\/">/);
  assert.match(html, /id="example-search"/);
  for (const item of POPULAR_SERVICES) {
    assert.match(html, new RegExp(`example=${item.slug}`));
    assert.ok(html.includes(item.title));
  }
});

test("featured examples and viewer guides contain canonical pages and map actions", async () => {
  for (const item of POPULAR_SERVICES.filter((entry) => entry.featured)) {
    const html = await read(`examples/${item.slug}/index.html`);
    assert.ok(html.includes(`https://gismap.online/examples/${item.slug}/`));
    assert.ok(html.includes(`example=${item.slug}`));
    assert.match(html, /application\/ld\+json/);
  }
  for (const slug of ["arcgis-rest-service-viewer", "arcgis-feature-service-viewer", "arcgis-map-service-viewer", "geojson-viewer", "3d-gis-viewer", "ai-connection-guide"]) {
    const html = await read(`${slug}/index.html`);
    assert.ok(html.includes(`https://gismap.online/${slug}/`));
    assert.match(html, /Browse examples/);
  }
  const guides = await read("guides/index.html");
  assert.match(guides, /GIS viewer guides/);
  assert.match(guides, /arcgis-feature-service-viewer/);
  assert.match(guides, /ai-connection-guide/);
});

test("local PostGIS tutorial is discoverable and describes safe, bounded access", async () => {
  const index = await read("examples/index.html");
  const tutorial = await read("examples/data-connections/local-postgis/index.html");
  const sitemap = await read("sitemap.xml");
  assert.match(index, /id="data-connections"/);
  assert.match(index, /href="\/examples\/data-connections\/local-postgis\/"/);
  assert.match(tutorial, /Connect a Local PostGIS Database to GISMap Online/);
  assert.match(tutorial, /PGFS_SERVER_HTTPHOST/);
  assert.match(tutorial, /PGFS_SERVER_CORSORIGINS/);
  assert.match(tutorial, /CORS controls which browser origins may read responses; it is not authentication/);
  assert.match(tutorial, /does not support authenticated map layers or viewport loading/);
  assert.match(tutorial, /localhost.*computer/i);
  assert.match(sitemap, /https:\/\/gismap\.online\/examples\/data-connections\/local-postgis\//);
});

test("Geo URL entry points and instructions use a consistent label", async () => {
  const home = await read("index.html");
  const ui = await read("js/ui.js");
  const guide = await read("geojson-viewer/index.html");
  assert.match(home, /data-action="data-geojson">Add Geo URL<\/button>/);
  assert.match(home, /data-empty-action="data-geojson">Geo URL<\/button>/);
  assert.match(ui, /data-empty-action="data-geojson">Geo URL<\/button>/);
  assert.match(ui, /isGeoJson \? "Add Geo URL"/);
  assert.match(guide, /or Add Geo URL for a public feed/);
  assert.doesNotMatch(home, />Add GeoJSON URL<\/button>|>GeoJSON URL<\/button>/);
});
