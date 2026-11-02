// Layer styles (Cartography Lab): the file format, what it becomes, and the in-page API.
import test from "node:test";
import assert from "node:assert/strict";
import { describeLayerStyle, layerStyleBriefing, layerStyleFileName, layerStyleFromLayer, layerStyleMapSpec, layerStyleRankField, mergeLayerStyles, normalizeLayerStyle, stylesForSource } from "../js/layer-style.js";
import { createLayerStylesApi } from "../js/layer-styles-api.js";
import { validateMapSpec } from "../js/map-spec.js";
import { niceScale } from "../js/cartography-lab.js";

const URL_ = "https://services1.arcgis.com/x/ArcGIS/rest/services/Fires/FeatureServer/0";
const chart = { type: "spatial-3d-chart", mode: "attribute-extrusion", height: { field: "GIS_ACRES", scale: 0.05 }, color: { field: "GIS_ACRES", strategy: "original" }, geometry: { strategy: "source-footprints", aggregation: "none" } };
const info = { id: "l1", url: URL_, title: "Fires", type: "feature", renderer: { type: "choropleth", field: "GIS_ACRES", ramp: "oranges", classes: 5, method: "natural-breaks" }, spatialChart: chart, where: "YEAR_ >= 2019", opacity: 0.8 };

test("a style records the renderer, 3D chart, filter and opacity, and is 3D when it has a chart", () => {
  const style = layerStyleFromLayer(info, { name: "Acres in 3D", filter: { conditions: [{ field: "YEAR_", op: "gte", value: "2019" }], logic: "and" } });
  assert.equal(style.type, "gismap-layer-style");
  assert.equal(style.dimension, "3d");
  assert.equal(style.renderer.type, "choropleth");
  assert.equal(style.spatialChart.mode, "attribute-extrusion");
  assert.equal(style.where, "YEAR_ >= 2019");
  assert.equal(style.opacity, 0.8);
  assert.deepEqual(style.filter.conditions, [{ field: "YEAR_", op: "gte", value: "2019" }]);
  assert.match(style.id, /^style-/);
  assert.equal(describeLayerStyle(style), "Classes of GIS_ACRES (oranges) · 3D height GIS_ACRES × 0.05 · Filter: YEAR_ >= 2019 · 80% opacity");
  assert.equal(layerStyleFileName(style), "acres-in-3d.gismap-style.json");
  assert.equal(layerStyleRankField(style), "GIS_ACRES");
});

test("a service-styled 2D layer saves no renderer; group values are not stored", () => {
  const style = layerStyleFromLayer({ ...info, renderer: { type: "service" }, spatialChart: null, where: null, opacity: 1 }, { name: "Plain" });
  assert.equal(style.renderer, null);
  assert.equal(style.dimension, "2d");
  assert.equal(describeLayerStyle(style), "Service style");
  const strata = normalizeLayerStyle({ type: "gismap-layer-style", version: 1, name: "Years", source: { url: URL_ }, spatialChart: { type: "spatial-3d-chart", mode: "temporal-strata", groupBy: "YEAR_", groups: [2019, 2020] } });
  assert.equal(strata.spatialChart.groups, undefined, "groups are read from the data when applied");
});

test("invalid styles are refused with a reason", () => {
  assert.throws(() => normalizeLayerStyle({ type: "other", version: 1, name: "x" }), /not a GISMap Online layer style/);
  assert.throws(() => normalizeLayerStyle({ type: "gismap-layer-style", version: 1, name: "" }), /needs a name/);
  assert.throws(() => normalizeLayerStyle({ type: "gismap-layer-style", version: 1, name: "x", renderer: { type: "choropleth" } }), /needs a field/);
  assert.throws(() => normalizeLayerStyle({ type: "gismap-layer-style", version: 1, name: "x", where: "1=1; DROP TABLE x" }), /read-only/);
  assert.throws(() => normalizeLayerStyle({ type: "gismap-layer-style", version: 1, name: "x", spatialChart: { mode: "spiral" } }), /spatialChart.mode/);
});

test("a style becomes a valid map-v1 spec, tilted when it is 3D", () => {
  const style = layerStyleFromLayer(info, { name: "Acres in 3D" });
  const spec = layerStyleMapSpec(style, { basemap: "gray-vector", camera: { center: [-120, 37], zoom: 6, heading: 10, tilt: 0 } });
  assert.equal(spec.camera.tilt, 60);
  assert.deepEqual(Object.keys(spec.layers[0]), ["url", "title", "where", "renderer", "spatialChart", "opacity"]);
  const { valid, issues } = validateMapSpec(spec);
  assert.ok(valid, JSON.stringify(issues));
});

test("briefing slides: a title, the flat map and the 3D view", () => {
  const style = layerStyleFromLayer(info, { name: "Acres in 3D" });
  const briefing = layerStyleBriefing(style, { camera: { center: [-120, 37], zoom: 6, heading: 0, tilt: 0 } });
  assert.equal(briefing.layerId, URL_);
  assert.deepEqual(briefing.slides.map((slide) => [slide.template, slide.title, slide.spatialChart?.mode ?? null, slide.camera?.tilt]), [["title", "Acres in 3D", null, 0], ["map-narrative", "The map", null, 0], ["map-narrative", "In 3D", "attribute-extrusion", 60]]);
  const flat = layerStyleBriefing({ ...style, spatialChart: null, dimension: "2d" });
  assert.equal(flat.slides.length, 2);
});

test("styles merge by id, newest first, and match their layer by URL", () => {
  const a = { id: "a", updatedAt: "2026-01-01", source: { url: URL_ } };
  const a2 = { id: "a", updatedAt: "2026-02-01", source: { url: `${URL_}/` } };
  const b = { id: "b", updatedAt: "2026-01-15", source: { url: "https://other/FeatureServer/0" } };
  const merged = mergeLayerStyles([a, b], [a2]);
  assert.deepEqual(merged.map((style) => [style.id, style.updatedAt]), [["a", "2026-02-01"], ["b", "2026-01-15"]]);
  assert.deepEqual(stylesForSource(merged, URL_.toUpperCase()).map((style) => style.id), ["a"]);
});

test("the layerStyles API saves to the project and library, and applies through layers.update", async () => {
  const updates = [];
  const layers = { get: (key) => (key === "l1" || key === URL_ ? info : null), list: () => [info], update: async (id, patch) => { updates.push([id, patch]); return info; } };
  const memory = new Map();
  const storage = { getItem: (key) => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) };
  let projectStyles = [];
  const api = createLayerStylesApi({ layers, camera: { get: () => ({ center: [-120, 37], zoom: 6, heading: 15, tilt: 55 }) }, mapSpec: { createLink: async (spec) => ({ url: `https://gismap.online/#map=${spec.layers.length}` }) }, project: { get: () => projectStyles, set: (styles) => { projectStyles = styles; } }, storage });
  const captured = api.capture("l1", { name: "Acres" });
  assert.deepEqual(captured.camera, { tilt: 55, heading: 15 });
  const saved = api.save(captured);
  assert.equal(projectStyles.length, 1);
  assert.equal(JSON.parse(memory.get("gismap-online:layer-styles:v1")).length, 1);
  assert.deepEqual(api.list("l1").map((style) => style.id), [saved.id]);
  await api.apply("l1", saved.id);
  assert.deepEqual(updates[0], ["l1", { where: "YEAR_ >= 2019", opacity: 0.8, renderer: info.renderer, spatialChart: saved.spatialChart }]);
  // A file round-trips, and another project still finds the style in the browser library.
  const text = api.export(saved.id);
  assert.match(text, /layer-style-v1\.schema\.json/);
  projectStyles = [];
  assert.equal(api.list().length, 1);
  assert.equal(api.import(text).id, saved.id);
  assert.equal(api.remove(saved.id), true);
  assert.equal(api.list().length, 0);
  assert.equal((await api.createLink(captured)).url, "https://gismap.online/#map=1");
});

test("niceScale rounds the height multiplier to 1, 2 or 5 × a power of ten", () => {
  assert.equal(niceScale(1_000_000, 25_000), 0.02);
  assert.equal(niceScale(50, 400), 10);
  assert.equal(niceScale(0, 400), 1);
});
