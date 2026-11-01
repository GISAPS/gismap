import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { CORN_LINK, CORN_SPEC, CORN_STYLED_LAYER_LINK, agentGuide, buildCatalog, buildUrlParameters } from "../scripts/agent-docs.mjs";
import { buildSiteOutputs } from "../scripts/site-outputs.mjs";
import { mapSpec, sources } from "../js/gismap-core.js";
import { mapSpecFromShareParameters } from "../js/map-spec.js";
import { parseShareParameters } from "../js/share.js";
// Pages link relative to themselves; these checks read them as root paths.
import { rootLinksHtml } from "../scripts/relative-links.mjs";
import { POPULAR_SERVICES } from "../js/catalog.js";

const text = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8").then((text) => (path.endsWith(".html") ? rootLinksHtml(path, text) : text));
const json = async (path) => JSON.parse(await text(path));
const AsyncFunction = (async () => {}).constructor;

test("every generated file matches its generator (run scripts/build-examples.mjs)", async () => {
  const outputs = await buildSiteOutputs({ readText: text });
  for (const path of ["llms.txt", "llms-full.txt", "api/url-parameters.json", "api/catalog.json", "guides/ai-agents/index.html", "guides/index.html", "sitemap.xml"]) {
    assert.ok(outputs.has(path), `${path} is generated`);
  }
  for (const [path, contents] of outputs) assert.equal(await text(path), contents, `${path} is out of date`);
});

test("the worked example is the published example, and it validates and opens", async () => {
  const capabilities = await json("api/capabilities.json");
  assert.equal(CORN_LINK, capabilities.examples.readableMapLink);
  assert.equal(CORN_STYLED_LAYER_LINK, capabilities.examples.styledLayerLink);
  assert.equal(mapSpec.validate(CORN_SPEC).valid, true);
  assert.deepEqual(await mapSpec.decode(CORN_LINK.split("#map=")[1]), CORN_SPEC);
  // The query-string form describes the same map.
  const shared = parseShareParameters(new URL(CORN_STYLED_LAYER_LINK).search);
  assert.deepEqual(mapSpecFromShareParameters(shared).layers[0].renderer, CORN_SPEC.layers[0].renderer);
});

test("recipe 2 runs: inspect finds the sentinel, the spec validates, the link opens", async () => {
  const guide = agentGuide();
  const recipe = guide.sections[1];
  const layer = await json("tests/fixtures/corn-layer.json");
  const fetchImpl = async (href) => {
    const url = new URL(href);
    const body = url.searchParams.get("returnCountOnly") ? { count: 3074 } : url.pathname.endsWith("/query") ? { features: [] } : layer;
    return { ok: true, json: async () => body };
  };
  const inspect = (url) => sources.inspect(url, { fetchImpl });
  const body = recipe.code.text.replace(/^import .*$/m, "");
  const run = new AsyncFunction("sources", "mapSpec", `${body}\nreturn { exclude, valid, issues, link, qr };`);
  const result = await run({ inspect }, mapSpec);
  assert.deepEqual(result.exclude, [-1]);
  assert.equal(result.valid, true, JSON.stringify(result.issues));
  assert.match(result.link, /#map=z/);
  assert.equal(result.qr, true);
  assert.equal((await mapSpec.decode(result.link.split("#map=")[1])).layers[0].renderer.exclude[0], -1);

  // The Python recipe builds the same spec (without the ramp) and an equivalent readable link.
  const python = recipe.extra.code.text;
  const spec = JSON.parse(python.match(/spec = (\{[\s\S]*?\})\nlink/)[1]);
  assert.equal(mapSpec.validate(spec).valid, true);
  assert.match(python, /"https:\/\/gismap\.online\/#map=json:" \+ urllib\.parse\.quote\(json\.dumps\(spec, separators=\(",", ":"\)\), safe=""\)/);
  const decoded = await mapSpec.decode(`json:${encodeURIComponent(JSON.stringify(spec, null, 0))}`);
  assert.deepEqual(decoded.layers[0].renderer, spec.layers[0].renderer);
});

test("recipe 3 uses only the in-page API that capabilities.json publishes", async () => {
  const capabilities = await json("api/capabilities.json");
  const recipe = agentGuide().sections[2].code.text;
  for (const [, namespace, method] of recipe.matchAll(/gisMapOnline\.(\w+)\.(\w+)\(/g)) {
    assert.ok(capabilities.namespaces[namespace]?.includes(method), `${namespace}.${method} is published`);
  }
  const calls = [];
  const gisMapOnline = {
    ready: Promise.resolve(),
    layers: {
      add: async (url, options) => { calls.push(["add", url, options.renderer.type]); return { id: "layer-1" }; },
      suggestStyles: async (id, { field }) => { calls.push(["suggestStyles", id, field]); return { options: [{ pinnedSpec: { type: "choropleth", field, breaks: [1, 2] } }] }; },
      update: async (id, { renderer }) => { calls.push(["update", id, renderer.breaks.length]); return { id }; },
    },
    camera: { fitTo: async (id) => calls.push(["fitTo", id]) },
    describe: () => ({ state: { layers: [] } }),
    mapSpec: { fromCurrent: () => CORN_SPEC, createLink: async (spec) => mapSpec.createLink(spec) },
  };
  const console = { log: () => {} };
  await new AsyncFunction("gisMapOnline", "console", recipe)(gisMapOnline, console);
  assert.deepEqual(calls, [["add", CORN_SPEC.layers[0].url, "choropleth"], ["fitTo", "layer-1"], ["suggestStyles", "layer-1", "CORN_SALES_IN_DOLLARS"], ["update", "layer-1", 2]]);
});

test("the error table lists every published error code", async () => {
  const capabilities = await json("api/capabilities.json");
  const table = agentGuide({ errorCodes: capabilities.errorCodes }).sections.find((section) => section.heading === "4. Handling errors").table;
  assert.deepEqual(table.rows.map(([code]) => code), Object.keys(capabilities.errorCodes));
  assert.ok(table.rows.every(([, hint]) => hint.length > 10));
});

test("url-parameters.json documents the parameters the app reads", async () => {
  const share = (await Promise.all(["js/share.js", "js/map-share.js", "js/app.js"].map(text))).join("\n");
  const parameters = buildUrlParameters();
  for (const name of Object.keys(parameters.query)) {
    assert.ok(share.includes(`"${name}"`), `the app reads ${name}`);
  }
  // Every example value parses.
  const query = new URLSearchParams(Object.entries(parameters.query).filter(([name]) => !["example", "spec", "briefing", "center", "scale", "level"].includes(name)).map(([name, item]) => [name, item.example]));
  const shared = parseShareParameters(`?${query}`);
  assert.equal(shared.layers.length, 1);
  assert.equal(shared.basemap, "gray-vector");
  assert.equal(parameters.query.briefingExample.example, "historical-quakes");
  assert.equal(parameters.query.tutorial.example, "1");
});

test("catalog.json links open their datasets", () => {
  const { datasets, count } = buildCatalog();
  assert.equal(count, POPULAR_SERVICES.length);
  for (const item of datasets) {
    assert.equal(parseShareParameters(new URL(item.link).search, POPULAR_SERVICES).example, item.slug);
    assert.equal(parseShareParameters(new URL(item.layerLink).search).layers[0].url, item.url);
    assert.match(item.url, /^https:\/\//);
  }
});

test("llms.txt follows llmstxt.org and its links resolve to files in the site", async () => {
  const llms = await text("llms.txt");
  assert.match(llms, /^# GISMap Online\n\n> .+\n/);
  assert.match(llms, /#map=json:/);
  assert.doesNotMatch(llms, /#spec=/);
  for (const [, href] of llms.matchAll(/\]\((https:\/\/gismap\.online\/[^)]*)\)/g)) {
    const path = new URL(href).pathname.slice(1);
    await text(path.endsWith("/") ? `${path}index.html` : path);
  }
});

test("the app page, sitemap, robots and headers point agents at the docs", async () => {
  const html = await text("index.html");
  assert.match(html, /<link rel="alternate" type="text\/plain" href="\/llms\.txt"/);
  assert.match(html, /<link rel="describedby" type="application\/json" href="\/api\/capabilities\.json"/);
  assert.match(html, /<link rel="help" href="\/guides\/ai-agents\/"/);
  assert.match(html, /<section class="sr-only"[^>]*>\s*<h2 id="agent-docs-title">For AI agents and developers<\/h2>/);
  assert.match(html, /<noscript>[^<]*<a href="\/llms\.txt">/);
  const sitemap = await text("sitemap.xml");
  for (const path of ["/llms.txt", "/guides/ai-agents/", "/api/catalog.json"]) assert.ok(sitemap.includes(`<loc>https://gismap.online${path}</loc>`), path);
  assert.doesNotMatch(await text("robots.txt"), /Disallow:\s*\/(llms|api|guides|schemas)/);
  const headers = await text("_headers");
  for (const path of ["/llms.txt", "/llms-full.txt", "/api/*", "/schemas/*"]) {
    assert.match(headers, new RegExp(`^${path.replace(/[.*]/g, "\\$&")}\\n(  .+\\n)*  Access-Control-Allow-Origin: \\*`, "m"), path);
  }
  const guides = await text("guides/index.html");
  assert.match(guides, /href="\/guides\/ai-agents\/"/);
  assert.match(await text("README.md"), /\/guides\/ai-agents\//);
});

test("example pages give a ready ?layer= link and a minimal map spec", async () => {
  const item = POPULAR_SERVICES.find((entry) => entry.featured);
  const page = await text(`examples/${item.slug}/index.html`);
  assert.match(page, /For AI agents and scripts/);
  const spec = JSON.parse(page.match(/<code class="language-json">([\s\S]*?)<\/code>/)[1].replace(/&quot;/g, '"').replace(/&amp;/g, "&"));
  assert.equal(mapSpec.validate(spec).valid, true);
  assert.equal(spec.layers[0].url, item.url);
});
