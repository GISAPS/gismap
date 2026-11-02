import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import core, { briefing, capabilities, inspectSource, queries, GISMAP_CORE_VERSION } from "../js/gismap-core.js";
import { createClientApi } from "../js/briefing-api.js";

test("gismap-core exposes a versioned, declarative briefing contract", () => {
  assert.equal(core.version, GISMAP_CORE_VERSION);
  assert.equal(capabilities.briefingSchemaVersion, 1);
  assert.ok(capabilities.filters.includes("feature_ids"));
  const document = briefing.create({
    queries: { safe: { op: "eq", field: "status", value: "Active" }, unsafe: { op: "sql", value: "DROP TABLE" } },
    slides: [{ id: "slide-1", template: "actions", title: "Next", hidden: false, blocks: [{ id: "block-1", type: "links", links: [{ label: "Unsafe", url: "javascript:alert(1)" }] }] }],
  });
  assert.deepEqual(Object.keys(document.queries), ["safe"]);
  assert.deepEqual(document.slides[0].blocks[0].links, []);
  assert.equal(briefing.validate(document).valid, true);
  assert.equal(queries.matches(document.queries.safe, { status: "active" }), true);
});

test("briefing links round trip through the versioned compressed format", async () => {
  const document = briefing.addSlide({}, briefing.createSlide("title", { title: "Oakland update", date: new Date("2026-10-14T00:00:00Z") }));
  const encoded = await briefing.encode(document);
  assert.match(encoded, /^[bj]1\./);
  assert.deepEqual(await briefing.decode(encoded), document);
  const link = await briefing.createLink({ baseUrl: "https://gismap.online/?example=test", briefing: document, qrSafe: true });
  assert.equal((await briefing.readHash(new URL(link).hash)).slides[0].title, "Oakland update");
});

test("source inspection reports ArcGIS metadata and rejects credential-bearing URLs", async () => {
  let requested = null;
  const fetchImpl = async (url) => {
    requested = new URL(url);
    return { ok: true, json: async () => ({ name: "Projects", geometryType: "esriGeometryPoint", objectIdField: "OBJECTID", maxRecordCount: 2000, capabilities: "Query,Extract", fields: [{ name: "OBJECTID", alias: "Object ID", type: "esriFieldTypeOID", nullable: false }, { name: "status", alias: "Status", type: "esriFieldTypeString" }] }) };
  };
  const result = await inspectSource("https://example.org/arcgis/rest/services/Projects/FeatureServer/0", { fetchImpl });
  assert.equal(requested.searchParams.get("f"), "json");
  assert.deepEqual([result.kind, result.objectIdField, result.fields[0].role], ["arcgis-layer", "OBJECTID", "numeric"]);
  await assert.rejects(() => inspectSource("https://example.org/data.geojson?token=secret", { fetchImpl }), /credential parameter/);
});

test("the in-page API can load, update and export the current briefing", async () => {
  const presentation = { template: "standard", skin: "gismap", briefing: { schemaVersion: 1, queries: {}, slides: [] } };
  const projectManager = {
    current: { name: "Oakland projects", presentation },
    setPresentation(value) { this.current.presentation = value; return value; },
    patchPresentation(value) { this.current.presentation = { ...this.current.presentation, ...value }; return this.current.presentation; },
    snapshot() { return structuredClone({ schema: "https://gismap.online/project/v1", name: this.current.name, presentation: this.current.presentation }); },
  };
  const api = createClientApi({ projectManager, mapController: { getViewState: () => ({ center: [-122.27, 37.8], zoom: 12, heading: 4, tilt: 35 }) }, baseUrl: () => "https://gismap.online/" });
  const slide = api.briefing.createSlide("map-narrative", { title: "Corridors" });
  const document = api.briefing.addSlide({}, slide);
  const loaded = api.briefing.load(document);
  assert.equal(loaded.valid, true);
  assert.equal(projectManager.current.presentation.template, "briefing");
  api.briefing.saveCurrentCamera(slide.id);
  assert.deepEqual(api.briefing.get().slides[0].camera.center, [-122.27, 37.8]);
  const output = api.briefing.exportGmo();
  assert.match(output.fileName, /Oakland-projects\.gis$/);
  assert.equal(JSON.parse(output.text).presentation.briefing.slides.length, 1);
});

test("published schema and capabilities files are valid and the browser global exposes the API", async () => {
  const schema = JSON.parse(await readFile(new URL("../schemas/briefing-v1.schema.json", import.meta.url), "utf8"));
  const published = JSON.parse(await readFile(new URL("../api/capabilities.json", import.meta.url), "utf8"));
  const types = await readFile(new URL("../js/gismap-core.d.ts", import.meta.url), "utf8");
  const app = await readFile(new URL("../js/app.js", import.meta.url), "utf8");
  assert.equal(schema.$id, "https://gismap.online/schemas/briefing-v1.schema.json");
  assert.equal(published.global, "globalThis.gisMapOnline");
  assert.equal(published.types, "/js/gismap-core.d.ts");
  assert.match(types, /export type BriefingDocument/);
  assert.match(app, /briefing: clientApi\.briefing/);
  assert.match(app, /sources: clientApi\.sources/);
  assert.match(app, /smartImages: clientApi\.smartImages/);
});

test("a briefing document names its layer and selection, and the in-page API generates and renders through the app", async () => {
  const url = "https://example.org/arcgis/rest/services/Projects/FeatureServer/0";
  const layer = { uid: "session-uid-7", id: "projects", title: "Projects", url, queryable: true };
  const mapController = { getLayers: () => [layer], getLayerConfig: () => ({ url, local: false }), getViewState: () => ({ center: [0, 0], zoom: 3 }) };
  const presentation = { template: "standard", briefing: { schemaVersion: 1, queries: {}, slides: [] } };
  const projectManager = {
    current: { name: "P", presentation },
    setPresentation(value) { this.current.presentation = value; return value; },
    patchPresentation(value) { this.current.presentation = { ...this.current.presentation, ...value }; return this.current.presentation; },
    snapshot() { return structuredClone(this.current); },
  };
  const calls = [];
  const host = { openBriefing: async (document, options) => calls.push(["open", document.layerId, options]), generate: async (options) => calls.push(["generate", options]), createPdf: async () => new File(["%PDF"], "b.pdf") };
  const api = createClientApi({ projectManager, mapController, host });
  const loaded = api.briefing.load({ schemaVersion: 1, layerId: `${url}/`, selection: { ids: [104, "221"] }, slides: [] });
  await loaded.ready;
  assert.equal(projectManager.current.presentation.primaryLayerId, "session-uid-7", "a service URL in layerId finds the loaded layer");
  assert.deepEqual(projectManager.current.presentation.briefingSelection, { layerId: "session-uid-7", ids: ["104", "221"], useAll: false });
  const elsewhere = api.briefing.load({ schemaVersion: 1, layerId: "https://other.example.org/arcgis/rest/services/X/FeatureServer/0", slides: [] }, { present: true });
  await elsewhere.ready;
  assert.deepEqual(calls[0].slice(0, 2), ["open", "https://other.example.org/arcgis/rest/services/X/FeatureServer/0"], "a layer not on the map is loaded by the app");
  await api.briefing.generate({ layerId: "Projects", ai: true });
  assert.deepEqual(calls[1], ["generate", { uid: "session-uid-7", share: false, useAi: true, confirmReplace: false }]);
  assert.equal((await api.briefing.exportPdf()).name, "b.pdf");
  const headless = createClientApi({ projectManager, mapController });
  await assert.rejects(() => headless.briefing.exportPdf(), /needs the GISMap Online app/);
  const published = JSON.parse(await readFile(new URL("../api/capabilities.json", import.meta.url), "utf8"));
  assert.equal(published.apiVersion, GISMAP_CORE_VERSION);
  assert.ok(published.namespaces.briefing.includes("generate") && published.namespaces.briefing.includes("exportPdf") && published.namespaces.briefing.includes("exportQrCard"));
  assert.deepEqual(published.namespaces.smartImages, ["embed", "read", "createShareLink", "createCurrent", "downloadCurrent"]);
  assert.ok(published.outputs.includes("briefing-pdf"));
  assert.ok(published.outputs.includes("briefing-qr-png"));
});

test("the in-page Smart Image API returns an image and equivalent live map for an agent", async () => {
  const service = "https://services9.arcgis.com/RHVPKKiFTONKtxq3/arcgis/rest/services/MODIS_Thermal_v1/FeatureServer/0";
  const projectManager = {
    current: { name: "MODIS Thermal Anomalies", presentation: { skin: "gismap" } },
    async exportSmartImage(options) {
      return {
        blob: new Blob(["png"], { type: "image/png" }),
        file: new File(["png"], "modis-smart-map.png", { type: "image/png" }),
        project: { version: 1, layers: [{ url: service }] },
        options,
      };
    },
  };
  const mapController = {
    getAllLayerConfigs: () => [{ url: service, sourceType: "feature", title: "MODIS Thermal v1", visible: true }],
    getBasemapId: () => "dark-gray-3d",
    getViewState: () => ({ center: [-98.5, 39.5], zoom: 4, heading: 0, tilt: 35 }),
    getLayers: () => [],
  };
  const api = createClientApi({ projectManager, mapController, baseUrl: () => "https://gismap.online/" });
  const output = await api.smartImages.createCurrent();
  assert.equal(output.file.name, "modis-smart-map.png");
  assert.equal(output.options.download, false);
  assert.match(output.share.url, /^https:\/\/gismap\.online\/#map=/);
  assert.equal(output.share.payload.L[0].u, service);
  assert.equal(output.share.payload.m, "dark-gray-3d");
  assert.deepEqual(output.share.payload.c.c, [-98.5, 39.5]);
  assert.equal((await api.smartImages.downloadCurrent()).options.download, true);
});

test('data-driven briefing API previews and generates each supported template without hiding sample coverage', async () => {
  const layer={uid:'u',id:'layer',url:'https://example.org/FeatureServer/0',queryable:true,geometryType:'polygon',fields:[{name:'kind',type:'string'},{name:'year',type:'integer'},{name:'acres',type:'double'}]};
  const features=[{attributes:{kind:'A',year:2020,acres:10},geometry:{type:'Polygon',coordinates:[[[0,0],[1,0],[1,1],[0,1],[0,0]]]}},{attributes:{kind:'B',year:2021,acres:20},geometry:{type:'Polygon',coordinates:[[[2,2],[3,2],[3,3],[2,3],[2,2]]]}}];
  const mapController={getLayers:()=>[layer],getLayerConfig:()=>({url:layer.url}),getViewState:()=>({center:[1,1],zoom:4}),queryFeatures:async(_uid,params)=>{assert.equal(params.num,500);return {features,exceededTransferLimit:true}}};
  const projectManager={current:{presentation:{briefing:{slides:[]}}},patchPresentation(value){this.current.presentation={...this.current.presentation,...value};}};
  const api=createClientApi({projectManager,mapController});
  const preview=await api.briefing.generateTemplate({template:'filter-series',field:'kind',previewOnly:true});
  assert.equal(preview.saved,false); assert.equal(preview.document.slides.length,2); assert.equal(api.briefing.get().slides.length,0);
  assert.equal(preview.coverage.completeness,'unknown'); assert.equal(preview.coverage.exceededTransferLimit,true);
  const result=await api.briefing.generateTemplate({template:'timeline',field:'year',start:2020,end:2021,presentationMode:'single-slide'});
  assert.equal(result.saved,true); assert.equal(api.briefing.get().slides[0].timeline.frames.length,2);
  const grid=await api.briefing.generateTemplate({template:'grid-atlas',rows:2,columns:2,previewOnly:true});
  assert.equal(grid.document.slides.length,5); assert.equal(api.briefing.get().slides.length,1);
  const spatial=await api.briefing.generateTemplate({template:'spatial-3d-chart',groupBy:'year',heightField:'acres',previewOnly:true});
  assert.equal(spatial.document.slides.length,6); assert.equal(spatial.preview.groups,2); assert.equal(spatial.document.slides.at(-3).spatialChart.mode,'temporal-strata');
  await assert.rejects(api.briefing.generateTemplate({template:'not-supported'}),/Choose filter-series/);
  await assert.rejects(api.briefing.generateTemplate({template:'grid-atlas',rows:0}),/rows/);
  assert.equal(api.briefing.get().slides.length,1);
});
