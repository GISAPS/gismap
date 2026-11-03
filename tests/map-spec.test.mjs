import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { MAP_SPEC_JSON_LIMIT, createMapSpecLink, decodeMapSpec, encodeMapSpec, mapSpecFromShareParameters, rendererSpecFromParameters, validateMapSpec } from "../js/map-spec.js";
import { createShareLink, readShareLocation } from "../js/map-share.js";
import { parseShareParameters } from "../js/share.js";
import { createMapSpecApi } from "../js/map-spec-api.js";
import { createChartSpec } from "../js/charting-tools.js";
import { GisMapError } from "../js/gismap-errors.js";

const CORN = "https://services.arcgis.com/P3ePLMYs2RVChkJx/ArcGIS/rest/services/Corn/FeatureServer/0";
const CORN_SPEC = {
  version: 1,
  title: "U.S. corn sales by county",
  basemap: "gray-vector",
  camera: { fit: "layers" },
  layers: [{
    url: CORN,
    type: "feature",
    title: "Corn sales (USD)",
    where: "CORN_SALES_IN_DOLLARS >= 0",
    renderer: { type: "choropleth", field: "CORN_SALES_IN_DOLLARS", classes: 5, method: "natural-breaks", ramp: "greens", exclude: [-1] },
    popup: { fields: ["county_name", "state_name", "CORN_SALES_IN_DOLLARS"] },
    ignoreServiceScaleRange: true,
  }],
  legend: true,
};
const at = (href) => new URL(href);

test("a valid map spec passes unchanged in substance", () => {
  const { valid, issues, spec } = validateMapSpec(CORN_SPEC);
  assert.equal(valid, true);
  assert.deepEqual(issues, []);
  assert.deepEqual(spec.layers[0].renderer, { type: "choropleth", field: "CORN_SALES_IN_DOLLARS", classes: 5, method: "natural-breaks", ramp: "greens", exclude: [-1] });
  assert.equal(spec.layers[0].ignoreServiceScaleRange, true);
  assert.deepEqual(spec.camera, { fit: "layers" });
});

test("an invalid spec keeps what can load and says exactly what was dropped", () => {
  const { valid, issues, spec } = validateMapSpec({
    version: 1,
    layer: [],
    basemap: "moon",
    camera: { center: [500, 0] },
    layers: [
      { url: CORN, renderer: { type: "choropleth" }, where: "1=1; DROP TABLE t" },
      { url: "http://example.org/FeatureServer/0" },
      { url: `${CORN}?token=abc` },
      { url: CORN, type: "shapefile" },
    ],
  });
  assert.equal(valid, false, "layers were dropped");
  assert.equal(spec.layers.length, 1);
  assert.equal(spec.layers[0].renderer, undefined, "a broken style falls back to the service's style");
  assert.equal(spec.layers[0].where, undefined, "an unsafe filter is not applied");
  const codes = issues.map((issue) => `${issue.level}:${issue.code}:${issue.path}`);
  for (const expected of ["warning:INVALID_SPEC:layer", "warning:INVALID_SPEC:basemap", "warning:INVALID_SPEC:camera.center", "error:HTTPS_REQUIRED:layers[1].url", "error:CREDENTIAL_IN_URL:layers[2].url", "error:UNSUPPORTED_LAYER_TYPE:layers[3].type", "error:INVALID_SPEC:layers[0].where"]) {
    assert.ok(codes.includes(expected), `${expected} in ${codes.join(", ")}`);
  }
  assert.match(issues.find((issue) => issue.path === "layer").hint, /"layers"/, "a typo gets a hint");
  assert.equal(validateMapSpec({ version: 2, layers: [] }).spec, null);
  assert.deepEqual(validateMapSpec({ layers: [{ url: CORN }], camera: { center: [-93.6, 42], scale: 500000 } }).spec.camera, { center: [-93.6, 42], scale: 500000, heading: 0, tilt: 0 });
  assert.deepEqual(validateMapSpec({ layers: [{ url: CORN }], camera: { fit: "none" } }).spec.camera, { fit: "none" });
});

test("specs encode as compressed or readable #map= payloads and decode back", async () => {
  const { spec } = validateMapSpec(CORN_SPEC);
  const compressed = await encodeMapSpec(CORN_SPEC);
  assert.match(compressed, /^[zj][A-Za-z0-9_-]+$/);
  assert.deepEqual(await decodeMapSpec(compressed), spec);
  const readable = await encodeMapSpec(CORN_SPEC, { compress: false });
  assert.match(readable, /^json:%7B/);
  assert.deepEqual(await decodeMapSpec(readable), spec);
  const link = await createMapSpecLink(CORN_SPEC, { baseUrl: "https://gismap.online/?old=1" });
  assert.equal(at(link.url).search, "");
  assert.ok(link.qr && link.url.startsWith("https://gismap.online/#map=z"));
  const huge = { layers: Array.from({ length: 10 }, (_, index) => ({ url: `${CORN}?n=${index}`, title: "x".repeat(150), renderer: { type: "arcgis", json: { type: "simple", label: "y".repeat(900) } } })) };
  // Browser cache-busting query strings create a separate module identity in
  // Node, so public errors are matched by their stable shape rather than
  // `instanceof` across two URLs for gismap-errors.js.
  await assert.rejects(encodeMapSpec(huge, { compress: false }), (error) => error?.name === "GisMapError" && error.code === "SPEC_TOO_LONG" && /\?spec=/.test(error.hint));
  await assert.rejects(decodeMapSpec(`json:${"a".repeat(MAP_SPEC_JSON_LIMIT + 1)}`), (error) => error.code === "SPEC_TOO_LONG");
  await assert.rejects(decodeMapSpec("json:{not json"), (error) => error.code === "INVALID_SPEC" && /encodeURIComponent/.test(error.hint));
});

test("older app #map= links decode to map-v1 too", async () => {
  const old = await createShareLink({ baseUrl: "https://gismap.online/", kind: "map", title: "Old", basemap: "osm", camera: { center: [-93, 42], zoom: 6 }, layers: [{ url: CORN, sourceType: "feature", title: "Corn", definitionExpression: "CORN_SALES_IN_DOLLARS > 0", renderer: { type: "simple" } }] });
  const spec = await decodeMapSpec(new URLSearchParams(at(old.url).hash.slice(1)).get("map"));
  assert.equal(spec.version, 1);
  assert.equal(spec.basemap, "osm");
  assert.deepEqual(spec.camera, { center: [-93, 42], zoom: 6, heading: 0, tilt: 0 });
  assert.deepEqual(spec.layers[0], { url: CORN, type: "feature", title: "Corn", where: "CORN_SALES_IN_DOLLARS > 0", renderer: { type: "arcgis", json: { type: "simple" } } });
  assert.equal(validateMapSpec(spec).valid, true);
});

test("the link reader opens readable, compressed and hosted specs; raw JSON with & survives", async () => {
  const raw = `https://gismap.online/#map=json:{"version":1,"title":"Corn & soy","layers":[{"url":"${CORN}"}]}&slide=s-1`;
  const readable = await readShareLocation(at(raw));
  assert.equal(readable.kind, "map-spec");
  assert.equal(readable.spec.title, "Corn & soy");
  assert.equal(readable.slide, "s-1");
  const compressed = await readShareLocation(at((await createMapSpecLink(CORN_SPEC)).url));
  assert.deepEqual(compressed.spec.layers[0].renderer.exclude, [-1]);
  const hosted = await readShareLocation(at("https://gismap.online/?spec=https%3A%2F%2Fexample.org%2Fcorn.map.json"), { fetchJson: async (url) => ({ ...CORN_SPEC, fetched: url }) });
  assert.equal(hosted.kind, "map-spec");
  assert.equal(hosted.spec.fetched, "https://example.org/corn.map.json");
  await assert.rejects(readShareLocation(at("https://gismap.online/?spec=ftp://example.org/x.json")), /https/);
  const appLink = await readShareLocation(at((await createShareLink({ baseUrl: "https://gismap.online/", kind: "map", layers: [{ url: CORN }] })).url));
  assert.equal(appLink.kind, "map", "the app's own links keep their exact renderers and open as before");
});

test("?layer= links style one layer per field without JSON, through the same spec", () => {
  const shared = parseShareParameters(`?layer=${encodeURIComponent(CORN)}&layerType=feature&title=Corn%20sales&where=CORN_SALES_IN_DOLLARS%20%3E%3D%200&style=choropleth&field=CORN_SALES_IN_DOLLARS&classes=4&ramp=greens&exclude=-1&opacity=0.8&basemap=gray-vector`);
  const spec = mapSpecFromShareParameters(shared);
  assert.deepEqual(spec, {
    version: 1,
    basemap: "gray-vector",
    camera: { fit: "layers" },
    layers: [{ url: CORN, type: "feature", title: "Corn sales", where: "CORN_SALES_IN_DOLLARS >= 0", opacity: 0.8, renderer: { type: "choropleth", field: "CORN_SALES_IN_DOLLARS", classes: 4, ramp: "greens", exclude: [-1] } }],
  });
  assert.equal(validateMapSpec(spec).valid, true);
  assert.deepEqual(rendererSpecFromParameters({ style: "graduated", field: "POP", color: "d9951e" }), { type: "graduated-symbols", field: "POP", color: "#d9951e" });
  assert.deepEqual(rendererSpecFromParameters({ style: "categories", field: "STATE", exclude: "N/A,-1" }), { type: "categories", field: "STATE", exclude: ["N/A", -1] });
  assert.throws(() => parseShareParameters(`?layer=${encodeURIComponent(CORN)}&style=rainbow`), /Unsupported style/);
  assert.throws(() => parseShareParameters(`?layer=${encodeURIComponent(CORN)}&opacity=2`), /opacity/);
  const centered = mapSpecFromShareParameters(parseShareParameters(`?layer=${encodeURIComponent(CORN)}&center=-93.6,42&level=7`));
  assert.deepEqual(centered.camera, { center: [-93.6, 42], zoom: 7, heading: 0, tilt: 0 });
});

test("mapSpec.load opens what it can, keeps the service style for a bad field, and reports issues", async () => {
  const added = [];
  const layers = {
    list: () => added.slice(),
    remove: (id) => { const index = added.findIndex((item) => item.id === id); if (index >= 0) added.splice(index, 1); return index >= 0; },
    add: async (url, options) => {
      if (/missing/.test(url)) throw new GisMapError("LAYER_LOAD_FAILED", "The service did not answer.");
      const info = { id: `l${added.length + 1}`, url, title: options.title || "Corn", type: "feature", renderer: { type: "service" }, opacity: 1, visible: true };
      added.push(info);
      return info;
    },
    update: async (id, patch) => {
      if (patch.renderer?.field === "CORN_SALES") throw new GisMapError("FIELD_NOT_FOUND", "Field `CORN_SALES` does not exist; did you mean `CORN_SALES_IN_DOLLARS`?");
      const info = added.find((item) => item.id === id);
      info.renderer = patch.renderer;
      return info;
    },
    zoomTo: async () => {},
  };
  const camera = { set: async () => ({}), get: () => ({ center: [-98.5, 39.5], zoom: 4, heading: 0, tilt: 0 }) };
  const shown = [];
  const issues = [];
  const host = { setBasemap: (id) => shown.push(`basemap:${id}`), setTitle: (title) => shown.push(`title:${title}`), showLegend: () => shown.push("legend"), showIssues: (list) => shown.push(`issues:${list.length}`) };
  const api = createMapSpecApi({ layers, camera, mapController: { getBasemapId: () => "gray-vector" }, host, issues });
  const result = api.load({ ...CORN_SPEC, layers: [{ ...CORN_SPEC.layers[0], renderer: { type: "choropleth", field: "CORN_SALES" } }, { url: `${CORN.replace("Corn", "missing")}` }] });
  const { layers: loaded, issues: reported } = await result.ready;
  assert.equal(loaded.length, 1);
  assert.deepEqual(loaded[0].renderer, { type: "service" });
  assert.deepEqual(reported.map((issue) => [issue.code, issue.path]), [["FIELD_NOT_FOUND", "layers[0].renderer"], ["LAYER_LOAD_FAILED", "layers[1]"]]);
  assert.equal(issues.length, 2, "describe() sees the same issues");
  assert.deepEqual(shown, ["basemap:gray-vector", "title:U.S. corn sales by county", "legend", "issues:2"]);
  // Exporting the map gives back a spec that validates.
  const exported = api.fromCurrent();
  assert.equal(validateMapSpec(exported).valid, true);
  assert.deepEqual(exported.layers[0].popup, CORN_SPEC.layers[0].popup, "popup fields round-trip");
  await assert.rejects(api.load("not a spec").ready, (error) => error.code === "INVALID_SPEC");
});

test("the schema, capabilities and app describe the same map spec", async () => {
  const schema = JSON.parse(await readFile(new URL("../schemas/map-v1.schema.json", import.meta.url), "utf8"));
  const capabilities = JSON.parse(await readFile(new URL("../api/capabilities.json", import.meta.url), "utf8"));
  assert.equal(schema.$id, "https://gismap.online/schemas/map-v1.schema.json");
  assert.deepEqual(Object.keys(schema.properties).sort(), ["$schema", "analysis", "basemap", "briefing", "camera", "charts", "description", "layers", "legend", "skin", "title", "version"]);
  assert.deepEqual(Object.keys(schema.$defs.chart.properties).sort(), ["aggregation", "dimension", "layer", "measure", "placement", "scope", "size", "style", "title", "type"]);
  assert.deepEqual(Object.keys(schema.$defs.layer.properties).sort(), ["animatedEffect", "ignoreServiceScaleRange", "opacity", "popup", "refreshInterval", "renderer", "scene3d", "spatialChart", "title", "type", "url", "visible", "where"]);
  assert.equal(capabilities.schemas.map, "/schemas/map-v1.schema.json");
  assert.ok(capabilities.namespaces.mapSpec.includes("load") && capabilities.namespaces.mapSpec.includes("fromCurrent"));
  assert.ok(capabilities.errorCodes.SPEC_TOO_LONG);
  const example = decodeURIComponent(capabilities.examples.readableMapLink.split("#map=json:")[1]);
  assert.equal(validateMapSpec(JSON.parse(example)).valid, true, "the documented example link is valid");
  const app = await readFile(new URL("../js/app.js", import.meta.url), "utf8");
  assert.match(app, /mapSpecFromShareParameters\(shared\)/, "?layer= links go through the spec");
  assert.match(app, /mapSpec: mapSpecApi/);
});

test("renderers in the SDK's autocast form keep their symbols (catalog 3D columns)", async () => {
  const { ArcGISEngine: MapController } = await import("../js/engines/arcgis/arcgis-engine.js");
  const map = new MapController({ publish() {} });
  map.modules = { rendererJsonUtils: { fromJSON: () => ({ type: "simple" }) } };
  const layer = { uid: "pm25", renderer: null };
  const columns = { type: "simple", symbol: { type: "point-3d", symbolLayers: [{ type: "object", resource: { primitive: "cylinder" } }] } };
  map.restoreRenderer(layer, columns);
  assert.deepEqual(layer.renderer, columns, "not run through the WebMap parser, which dropped the symbol");
  const webmap = { type: "classBreaks", field: "acres", classBreakInfos: [{ classMaxValue: 1, symbol: { type: "esriSFS" } }] };
  map.restoreRenderer(layer, webmap);
  assert.deepEqual(layer.renderer, { type: "simple" }, "WebMap JSON still goes through the parser");
});

const FIRES = "https://services9.arcgis.com/RHVPKKiFTONKtxq3/ArcGIS/rest/services/USA_Wildfires_v1/FeatureServer/0";

test("charts are definitions bound to a layer by position or URL; bad ones are left out with a warning", () => {
  const { valid, issues, spec } = validateMapSpec({
    version: 1,
    layers: [{ url: "http://insecure.example/0" }, { url: FIRES }],
    charts: [
      { type: "bar", layer: 1, dimension: "POOState", style: { topN: 10, theme: "futuristic", palette: "inherit", other: "group" } },
      { type: "column", layer: FIRES, dimension: "IncidentTypeCategory", measure: "DailyAcres", placement: "bottom", rows: [{ POOState: "US-CA" }] },
      { type: "bar", layer: 0, dimension: "POOState" },
      { type: "pie", dimension: "POOState" },
      { type: "bar", layer: 1, dimension: "POOState; DROP TABLE" },
      { type: "kpi", layer: 1, measure: { field: "DailyAcres", aggregation: "median" } },
    ],
  });
  assert.equal(valid, false, "the insecure layer is an error");
  // Layer 1 is the first layer that loads, so the chart points at position 0; defaults are not written out.
  assert.deepEqual(spec.charts, [
    { type: "bar", layer: 0, dimension: "POOState", measure: { field: null, aggregation: "count" }, placement: "right", style: { theme: "futuristic", topN: 10 } },
    { type: "column", layer: FIRES, dimension: "IncidentTypeCategory", measure: { field: "DailyAcres", aggregation: "sum" }, placement: "bottom" },
  ]);
  assert.deepEqual(issues.filter((item) => item.path.startsWith("charts")).map((item) => item.path), ["charts[1].rows", "charts[2]", "charts[3]", "charts[4].dimension", "charts[4]", "charts[5]"]);
  assert.ok(!JSON.stringify(spec.charts).includes("US-CA"), "record data never survives validation");
  const big = validateMapSpec({ layers: [{ url: FIRES }], charts: [{ type: "bar", dimension: "POOState", style: { hidden: Array.from({ length: 200 }, (_, index) => `category ${index} ${"x".repeat(20)}`) } }] });
  assert.equal(big.spec.charts, undefined, "an oversized chart is left out");
  assert.equal(validateMapSpec({ layers: [{ url: FIRES }], charts: [{ type: "bar" }] }).spec.charts, undefined, "a bar chart needs a dimension");
  assert.equal(validateMapSpec({ layers: [{ url: FIRES }], charts: Array.from({ length: 8 }, () => ({ type: "kpi" })) }).spec.charts.length, 6);
});

test("opening a spec with charts mounts each one bound to its loaded layer, and fromCurrent writes them back", async () => {
  const added = [];
  const layers = {
    list: () => added.slice(),
    remove: (id) => { const index = added.findIndex((item) => item.id === id); if (index >= 0) added.splice(index, 1); },
    add: async (url, options) => {
      if (/missing/.test(url)) throw new GisMapError("LAYER_LOAD_FAILED", "The service did not answer.");
      const info = { id: `uid-${added.length + 1}`, url, title: options.title || "Fires", type: "feature", renderer: { type: "service" }, opacity: 1, visible: true };
      added.push(info);
      return info;
    },
    update: async (id) => added.find((item) => item.id === id),
    zoomTo: async () => {},
  };
  const charts = [];
  const steps = [];
  const host = {
    addChart: async (chart) => { steps.push("chart"); charts.push(createChartSpec(chart)); },
    clearCharts: () => { steps.push("clear"); charts.length = 0; },
    getCharts: () => charts,
  };
  const camera = { set: async () => { steps.push("camera"); }, get: () => ({ center: [-110, 40], zoom: 4, heading: 0, tilt: 0 }) };
  const api = createMapSpecApi({ layers, camera, mapController: {}, host });
  const { ready } = api.load({
    camera: { center: [-110, 40], zoom: 4 },
    layers: [{ url: FIRES.replace("USA_Wildfires", "missing") }, { url: FIRES }],
    charts: [
      { type: "bar", title: "Incidents by state", layer: 1, dimension: "POOState", style: { topN: 10 } },
      { type: "donut", layer: 0, dimension: "POOState" },
    ],
  });
  const { issues } = await ready;
  assert.deepEqual(steps, ["clear", "chart", "camera"], "charts open after the layers and before the camera fits");
  assert.deepEqual(issues.map((item) => [item.code, item.path]), [["LAYER_LOAD_FAILED", "layers[0]"], ["LAYER_LOAD_FAILED", "charts[1]"]]);
  assert.equal(charts[0].source.layerId, "uid-1", "bound to the loaded layer's id, not to its position");
  assert.equal(charts[0].dimension.field, "POOState");
  assert.equal(charts[0].presentation.placement, "right");
  assert.equal(charts[0].style.topN, 10);
  const exported = api.fromCurrent();
  assert.deepEqual(exported.charts, [{ type: "bar", title: "Incidents by state", layer: 0, dimension: "POOState", measure: { field: null, aggregation: "count" }, placement: "right", style: { topN: 10 } }]);
  assert.deepEqual(validateMapSpec(exported).spec.charts, exported.charts, "the exported charts validate unchanged");
});
