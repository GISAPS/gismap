import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { smartImages } from "../js/gismap-core.js";
import { embedProjectInPng, readProjectFromPng } from "../js/smart-image.js";
import { MAP_TEMPLATES } from "../js/map-templates.js";
import { createPrintApi, printFrame, resolvePrintOptions } from "../js/print-api.js";
import { createBriefingApi } from "../js/briefing-api.js";

const PNG = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="), (c) => c.charCodeAt(0));
const PROJECT = { version: 1, layers: [] };
const DEFAULTS = { title: "T", subtitle: "S", description: "", marginIn: 0, marginColor: "#ffffff", borderPt: 0, borderColor: "#17201d", showQr: true, showNorthArrow: true, showScaleBar: true, clickableLinks: true };

function api(overrides = {}) {
  let time = 0;
  const rendered = [];
  const host = {
    webgl: () => true, ready: async () => {}, layers: () => [{ title: "A", loadStatus: "loaded" }], idle: () => true,
    defaults: () => DEFAULTS, isOpen: () => false, open() {}, read: async () => ({ manifest: true }),
    render: async (kind, options) => { rendered.push({ kind, options }); return { blob: new Blob(["x"]), file: new File(["x"], "x"), share: { url: "u", qr: true } }; },
    ...overrides,
  };
  return { rendered, print: createPrintApi({ templates: MAP_TEMPLATES, host, now: () => time, wait: async (ms) => { if (ms <= 1000) time += ms; else await new Promise(() => {}); }, poll: 1000 }) };
}
const code = (expected) => (error) => error.code === expected;

test("templates list every Print Editor page with its size", () => {
  const templates = api().print.templates();
  assert.equal(templates.length, MAP_TEMPLATES.length);
  assert.deepEqual(templates.find((item) => item.id === "wall-24x36").heightIn, 36);
  assert.ok(templates.every((item) => typeof item.supports.qr === "boolean"));
});

test("options resolve over defaults and reject what the editor could not draw", () => {
  const { print } = api();
  assert.equal(print.getOptions().template, "branded");
  assert.equal(print.setOptions({ title: "New" }).title, "New");
  assert.equal(print.getOptions().title, "New");
  assert.throws(() => resolvePrintOptions({ template: "nope" }, { template: "branded" }, MAP_TEMPLATES), code("UNKNOWN_TEMPLATE"));
  assert.throws(() => resolvePrintOptions({ bogus: 1 }, { template: "branded" }, MAP_TEMPLATES), code("INVALID_SPEC"));
  assert.throws(() => resolvePrintOptions({ dpi: 9000 }, { template: "branded" }, MAP_TEMPLATES), code("INVALID_SPEC"));
  assert.throws(() => resolvePrintOptions({ marginColor: "red" }, { template: "branded" }, MAP_TEMPLATES), code("INVALID_SPEC"));
  assert.deepEqual(printFrame({ ...DEFAULTS, marginIn: 1 }).margin, 1);
});

test("a failed layer stops the export unless the caller allows a partial map", async () => {
  const { print, rendered } = api({ layers: () => [{ title: "Bad", loadStatus: "failed" }] });
  await assert.rejects(print.exportPdf(), code("PRINT_LAYERS_NOT_LOADED"));
  assert.equal(rendered.length, 0);
  const partial = await print.exportPdf({ allowPartial: true });
  assert.match(partial.warnings[0], /Bad/);
});

test("a layer still loading at the timeout counts as not loaded", async () => {
  const { print } = api({ layers: () => [{ title: "Slow", loadStatus: "loading" }] });
  await assert.rejects(print.exportPdf({ timeoutMs: 2000 }), code("PRINT_LAYERS_NOT_LOADED"));
});

test("render, WebGL and taint failures carry their own codes", async () => {
  await assert.rejects(api({ idle: () => false }).print.exportPdf({ timeoutMs: 2000 }), code("PRINT_RENDER_TIMEOUT"));
  await assert.rejects(api({ webgl: () => false }).print.preview(), code("WEBGL_UNAVAILABLE"));
  const tainted = api({ render: async () => { throw Object.assign(new Error("Tainted canvases"), { name: "SecurityError" }); } });
  await assert.rejects(tainted.print.exportPdf(), code("PRINT_CANVAS_TAINTED"));
  assert.ok(await api({ idle: () => false }).print.exportPdf({ waitFor: "layers" }));
});

test("a Smart Image is one page and returns its manifest", async () => {
  const { print } = api();
  await assert.rejects(print.exportSmartImage({ pages: "bookmarks" }), code("INVALID_SPEC"));
  assert.deepEqual((await print.exportSmartImage()).manifest, { manifest: true });
});

test("provenance is read from the app's stamp and absent from public embeds", async () => {
  const stamped = await embedProjectInPng(new Blob([PNG]), PROJECT, { generator: "gismap-online", apiVersion: "1", renderedBy: "app", template: "branded" });
  const app = await readProjectFromPng(stamped);
  assert.equal(app.provenance.renderedBy, "app");
  assert.equal(app.provenance.template, "branded");
  const forged = await readProjectFromPng(await smartImages.embed(new Blob([PNG]), PROJECT, { renderedBy: "app" }));
  assert.equal(forged.provenance.renderedBy, "unknown");
});

test("briefing.exportGmo is a deprecated alias that warns once", () => {
  const warnings = [];
  const warn = console.warn;
  console.warn = (message) => warnings.push(message);
  try {
    const briefing = createBriefingApi({ projectManager: { current: { presentation: {} }, snapshot: () => ({ name: "Plan", presentation: {} }) }, mapController: {}, host: {} });
    assert.match(briefing.exportGmo().fileName, /\.gis$/);
    assert.match(briefing.exportGmo().fileName, /\.gis$/);
    assert.equal(briefing.exportProject().mimeType, "application/vnd.gismap.online.project+json");
  } finally { console.warn = warn; }
  assert.ok(warnings.length <= 1);
});

test("legacy extensions stay importable and writers use the current ones", async () => {
  const project = await readFile(new URL("../js/project.js", import.meta.url), "utf8");
  assert.match(project, /zip\|gisx\|gmop\|gismap/);
  assert.doesNotMatch(project, /`[^`]*\.gmop?`/);
});
