// ArcGIS services on the MapLibre engine: renderers translated to MapLibre
// paint, services described and paged, spatial questions sent to the service,
// and polygons from services drawn with their islands as parts.
import test from "node:test";
import assert from "node:assert/strict";
import { rendererToPaint, rendererValue, symbolColor } from "../js/engines/maplibre/arcgis-renderer.js";
import { describeArcGIS, fetchFeatures, parseQueryUrl, queryGeometry, queryServiceIds, serviceFields, serviceName } from "../js/engines/maplibre/arcgis-service.js";
import { regroupPolygon } from "../js/engines/maplibre/geojson.js";
import { compileRenderer } from "../js/renderer-spec.js";
import { MaplibreEngine } from "../js/engines/maplibre/maplibre-engine.js";

/** A fetch that answers from a table of [url test, response json]. */
function fakeFetch(routes, calls = []) {
  return async (input, init = {}) => {
    const url = String(input);
    calls.push({ url, body: init.body ? String(init.body) : null });
    const route = routes.find(([match]) => (typeof match === "function" ? match(url, init) : url.includes(match)));
    if (!route) return { ok: false, status: 404, json: async () => ({}) };
    const body = typeof route[1] === "function" ? route[1](url, init) : route[1];
    return { ok: true, status: 200, json: async () => structuredClone(body) };
  };
}

test("service renderers (WebMap JSON) become MapLibre paint with data expressions", () => {
  assert.equal(symbolColor([255, 0, 0, 128], { webMap: true }), "rgba(255,0,0,0.5019607843137255)");
  assert.equal(symbolColor([255, 0, 0, 0.5]), "rgba(255,0,0,0.5)");
  const simple = rendererToPaint({ type: "simple", symbol: { type: "esriSFS", style: "esriSFSSolid", color: [10, 20, 30, 255], outline: { type: "esriSLS", color: [0, 0, 0, 255], width: 0.75 } } }, { transparency: 25 });
  assert.equal(simple.fill["fill-color"], "rgba(10,20,30,1)");
  assert.equal(simple.outline["line-width"], 1);
  assert.equal(simple.fill["fill-opacity"], 0.75, "the service's transparency");
  const unique = rendererToPaint({ type: "uniqueValue", field1: "KIND", field: "KIND", defaultSymbol: { type: "esriSMS", color: [128, 128, 128, 255], size: 6 }, uniqueValueInfos: [
    { value: "AL", symbol: { type: "esriSMS", color: [255, 0, 0, 255], size: 6 } },
    { value: "NL", symbol: { type: "esriSMS", color: [0, 0, 255, 255], size: 6 } },
  ] });
  assert.deepEqual(unique.circle["circle-color"], ["match", ["to-string", ["get", "KIND"]], "AL", "rgba(255,0,0,1)", "NL", "rgba(0,0,255,1)", "rgba(128,128,128,1)"]);
  assert.equal(unique.circle["circle-radius"], 4, "a size every class shares stays a constant");
  const breaks = rendererToPaint({ type: "classBreaks", field: "POP", minValue: 0, classBreakInfos: [
    { classMaxValue: 10, symbol: { type: "esriSFS", color: [1, 1, 1, 255] } },
    { classMaxValue: 20, symbol: { type: "esriSFS", color: [2, 2, 2, 255] } },
  ] });
  const expression = breaks.fill["fill-color"];
  assert.equal(expression[0], "case");
  assert.deepEqual(expression[2], "rgba(0,0,0,0)", "features without a value draw nothing, as in ArcGIS");
  assert.deepEqual(expression[3], ["all", [">=", ["to-number", ["get", "POP"], 0], 0], ["<=", ["to-number", ["get", "POP"], 0], 10]]);
  assert.equal(rendererToPaint({ type: "heatmap" }), null, "heat maps are not drawn this way");
});

test("GIS Map styles compiled by renderer-spec draw the same, sentinel codes as no data", () => {
  const renderer = compileRenderer({ type: "choropleth", field: "SALES", exclude: [-1], classes: 2, method: "equal-interval", ramp: "greens" }, { geometryType: "polygon", values: [1, 2, 3, 4] });
  assert.deepEqual(rendererValue(renderer), { field: "SALES", normalizeBy: null, exclude: [-1] });
  const paint = rendererToPaint(renderer);
  const [, missing, noData] = paint.fill["fill-color"];
  assert.deepEqual(missing, ["any", ["==", ["get", "SALES"], null], ["in", ["get", "SALES"], ["literal", [-1]]]]);
  assert.match(noData, /^(#|rgba)/, "the No data colour");
  const categories = compileRenderer({ type: "categories", field: "LEAGUE" }, { geometryType: "point", categories: [{ value: "AL", count: 15 }, { value: "NL", count: 15 }] });
  assert.equal(rendererToPaint(categories).circle["circle-color"][0], "match");
});

test("services are described from their JSON: names, fields, kinds and tile URLs", async () => {
  assert.equal(serviceName("https://x.org/arcgis/rest/services/Folder/USA_States/MapServer"), "USA States");
  assert.deepEqual(parseQueryUrl("https://x.org/arcgis/rest/services/A/FeatureServer/2/query?where=STATE%3D%27CA%27&f=json"), { layerUrl: "https://x.org/arcgis/rest/services/A/FeatureServer/2", where: "STATE='CA'" });
  assert.deepEqual(serviceFields({ fields: [{ name: "OBJECTID", type: "esriFieldTypeOID", alias: "OBJECTID" }, { name: "KIND", type: "esriFieldTypeSmallInteger", domain: { type: "codedValue", name: "kinds", codedValues: [{ code: 1, name: "One" }] } }] }), [
    { name: "OBJECTID", alias: "OBJECTID", type: "oid", domain: null },
    { name: "KIND", alias: "KIND", type: "small-integer", domain: { type: "coded-value", name: "kinds", codedValues: [{ code: 1, name: "One" }] } },
  ]);
  const fetchImpl = fakeFetch([
    ["/FeatureServer/0?", { type: "Feature Layer", name: "Parks", id: 0, geometryType: "esriGeometryPoint", objectIdField: "OBJECTID", displayField: "NAME", fields: [{ name: "OBJECTID", type: "esriFieldTypeOID" }], drawingInfo: { renderer: { type: "simple" }, transparency: 10 }, maxRecordCount: 2000, advancedQueryCapabilities: { supportsPagination: true }, minScale: 500000 }],
    ["/World_Topo/MapServer?", { mapName: "Layers", singleFusedMapCache: true, tileInfo: { rows: 256, spatialReference: { wkid: 102100, latestWkid: 3857 }, lods: new Array(24).fill({}) } }],
    ["/Dynamic/MapServer?", { mapName: "Layers", layers: [{ id: 0 }] }],
    ["/Land/ImageServer?", { name: "Land" }],
    ["/Dynamic/MapServer/3?", { type: "Raster Layer", name: "Elevation" }],
  ]);
  const feature = await describeArcGIS("https://x.org/arcgis/rest/services/A/FeatureServer/0", { fetchImpl });
  assert.deepEqual([feature.kind, feature.title, feature.objectIdField, feature.displayField, feature.geometryType, feature.transparency, feature.minScale, feature.paginated], ["feature", "Parks", "OBJECTID", "NAME", "point", 10, 500000, true]);
  const tiled = await describeArcGIS("https://x.org/arcgis/rest/services/World_Topo/MapServer", { fetchImpl });
  assert.deepEqual([tiled.kind, tiled.title, tiled.tiles.urls[0]], ["map-image", "World Topo", "https://x.org/arcgis/rest/services/World_Topo/MapServer/tile/{z}/{y}/{x}"]);
  const dynamic = await describeArcGIS("https://x.org/arcgis/rest/services/Dynamic/MapServer", { fetchImpl });
  assert.match(dynamic.tiles.urls[0], /\/export\?bbox=\{bbox-epsg-3857\}&bboxSR=3857&imageSR=3857&size=512%2C512&format=png32&transparent=true&f=image/);
  const imagery = await describeArcGIS("https://x.org/arcgis/rest/services/Land/ImageServer", { fetchImpl });
  assert.match(imagery.tiles.urls[0], /\/exportImage\?.*format=png32/, "no-data areas stay transparent");
  const sublayer = await describeArcGIS("https://x.org/arcgis/rest/services/Dynamic/MapServer/3", { fetchImpl });
  assert.deepEqual([sublayer.kind, sublayer.title], ["map-image", "Dynamic — Elevation"]);
  assert.match(sublayer.tiles.urls[0], /^https:\/\/x\.org\/arcgis\/rest\/services\/Dynamic\/MapServer\/export\?.*layers=show%3A3/, "the service draws the sublayer, at its own host");
  assert.equal(sublayer.url, "https://x.org/arcgis/rest/services/Dynamic/MapServer");
});

test("features are paged as GeoJSON, with Esri JSON when a service cannot answer f=geojson", async () => {
  const calls = [];
  const all = [1, 2, 3, 4, 5].map((id) => ({ type: "Feature", id, geometry: { type: "Point", coordinates: [id, id] }, properties: { OBJECTID: id } }));
  const fetchImpl = fakeFetch([[(url) => url.includes("f=geojson"), (url) => {
    const offset = Number(new URL(url).searchParams.get("resultOffset"));
    const count = Number(new URL(url).searchParams.get("resultRecordCount"));
    return { type: "FeatureCollection", features: all.slice(offset, offset + count), exceededTransferLimit: offset + count < all.length };
  }]], calls);
  const { features, truncated } = await fetchFeatures({ url: "https://x.org/FeatureServer/0", maxRecordCount: 2, paginated: true, objectIdField: "OBJECTID" }, { fetchImpl });
  assert.deepEqual(features.map((feature) => feature.id), [1, 2, 3, 4, 5]);
  assert.equal(truncated, false);
  assert.equal(calls.length, 4); // one format probe, then a bounded speculative batch
  assert.equal(new URL(calls[0].url).searchParams.get("outSR"), "4326");
  const old = fakeFetch([
    [(url) => url.includes("f=geojson"), { error: { message: "Invalid format" } }],
    [(url) => url.includes("returnIdsOnly"), { objectIds: [7] }],
    [(url) => url.includes("/query"), { spatialReference: { wkid: 4326 }, features: [{ attributes: { OBJECTID: 7 }, geometry: { x: 1, y: 2 } }] }],
  ]);
  const converted = await fetchFeatures({ url: "https://x.org/MapServer/0", maxRecordCount: 1000, paginated: false, objectIdField: "OBJECTID" }, { fetchImpl: old });
  assert.deepEqual(converted.features, [{ type: "Feature", geometry: { type: "Point", coordinates: [1, 2] }, properties: { OBJECTID: 7 } }]);
});

test("feature pages load concurrently but retain order and report failures", async () => {
  let active = 0;
  let peak = 0;
  const fetchImpl = async (url) => {
    const offset = Number(new URL(url).searchParams.get("resultOffset"));
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, offset === 2 ? 15 : 2));
    active -= 1;
    if (offset === 4) throw new Error("page failed");
    return { ok: true, json: async () => ({ features: offset < 6 ? [{ id: offset }] : [], exceededTransferLimit: offset < 6 }) };
  };
  // GeoJSON errors get the normal Esri JSON fallback, which must also fail.
  await assert.rejects(fetchFeatures({ url: "https://x.org/FeatureServer/0", maxRecordCount: 1, paginated: true }, { fetchImpl, maxFeatures: 8 }), /page failed/);
  assert.ok(peak > 1 && peak <= 3);
});

test("concurrent pagination returns features in order, bounded by the requested limit", async () => {
  const fetchImpl = async (url) => {
    const offset = Number(new URL(url).searchParams.get("resultOffset"));
    await new Promise((resolve) => setTimeout(resolve, offset === 1 ? 10 : 1));
    return { ok: true, json: async () => ({ features: [{ id: offset }], exceededTransferLimit: true }) };
  };
  const result = await fetchFeatures({ url: "https://x.org/FeatureServer/0", maxRecordCount: 1, paginated: true }, { fetchImpl, maxFeatures: 5 });
  assert.deepEqual(result.features.map((feature) => feature.id), [0, 1, 2, 3, 4]);
  assert.equal(result.truncated, true);
});

test("spatial relationships go to the service as ArcGIS queries", async () => {
  assert.deepEqual(queryGeometry({ type: "Polygon", coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] }), { geometry: { rings: [[[0, 0], [1, 0], [1, 1], [0, 0]]], spatialReference: { wkid: 4326 } }, geometryType: "esriGeometryPolygon" });
  const calls = [];
  const ids = await queryServiceIds({ url: "https://x.org/FeatureServer/1" }, { where: "LEAGUE = 'AL'", geometry: { type: "Point", coordinates: [-71, 42] }, spatialRelationship: "intersects", distance: 2, units: "miles" }, { fetchImpl: fakeFetch([["/query", { objectIds: [4, 8] }]], calls) });
  assert.deepEqual(ids, [4, 8]);
  const params = new URL(calls[0].url).searchParams;
  assert.deepEqual([params.get("spatialRel"), params.get("geometryType"), params.get("inSR"), params.get("distance"), params.get("units"), params.get("returnIdsOnly"), params.get("where")], ["esriSpatialRelIntersects", "esriGeometryPoint", "4326", "2", "esriSRUnit_StatuteMile", "true", "LEAGUE = 'AL'"]);
});

test("rings packed into one Polygon are regrouped: islands become parts, holes stay holes", () => {
  const square = (x, y, size) => [[x, y], [x + size, y], [x + size, y + size], [x, y + size], [x, y]];
  const mainland = square(0, 0, 10);
  const lake = square(2, 2, 2);
  const island = square(20, 0, 1);
  assert.deepEqual(regroupPolygon({ type: "Polygon", coordinates: [mainland, lake, island] }), { type: "MultiPolygon", coordinates: [[mainland, lake], [island]] });
  assert.deepEqual(regroupPolygon({ type: "Polygon", coordinates: [mainland, lake] }), { type: "Polygon", coordinates: [mainland, lake] });
});

test("an ArcGIS feature layer on MapLibre keeps its fields, IDs and service style", async () => {
  const published = [];
  const engine = new MaplibreEngine({ publish: (topic, payload) => published.push([topic, payload]) });
  const layers = new Map();
  engine.map = {
    addSource() {}, getSource: () => ({ setData() {} }),
    addLayer: (spec) => layers.set(spec.id, structuredClone(spec)), getLayer: (id) => layers.get(id),
    setFilter() {}, setLayoutProperty() {}, setPaintProperty: (id, name, value) => { layers.get(id).paint[name] = value; }, setLayerZoomRange() {},
  };
  const realFetch = globalThis.fetch;
  globalThis.fetch = fakeFetch([
    [(url) => url.includes("returnCountOnly"), { count: 2 }],
    [(url) => url.includes("f=geojson"), { type: "FeatureCollection", features: [
      { type: "Feature", id: 11, geometry: { type: "Point", coordinates: [-71.1, 42.3] }, properties: { OBJECTID: 11, NAME: "Fenway", LEAGUE: "AL" } },
      { type: "Feature", id: 12, geometry: { type: "Point", coordinates: [-87.6, 41.9] }, properties: { OBJECTID: 12, NAME: "Wrigley", LEAGUE: "NL" } },
    ] }],
    [(url) => url.includes("spatialRel"), { objectIds: [12] }],
    [(url) => /FeatureServer\/0\?/.test(url), { type: "Feature Layer", name: "Ballparks", id: 0, geometryType: "esriGeometryPoint", objectIdField: "OBJECTID", displayField: "NAME",
      fields: [{ name: "OBJECTID", type: "esriFieldTypeOID" }, { name: "NAME", type: "esriFieldTypeString" }, { name: "LEAGUE", type: "esriFieldTypeString" }],
      drawingInfo: { renderer: { type: "simple", symbol: { type: "esriSMS", color: [200, 0, 0, 255], size: 9 } } }, maxRecordCount: 1000, advancedQueryCapabilities: { supportsPagination: true } }],
  ]);
  try {
    const layer = await engine.addService({ url: "https://x.org/arcgis/rest/services/MLB/FeatureServer/0", serviceType: "arcgis-auto" });
    assert.deepEqual([layer.title, layer.type, layer.objectIdField, layer.displayField, layer.layerId, layer.queryable], ["Ballparks", "feature", "OBJECTID", "NAME", 0, true]);
    assert.deepEqual(layer.fields.map((field) => field.type), ["oid", "string", "string"]);
    assert.deepEqual(await engine.queryObjectIds(layer.uid, { where: "LEAGUE = 'AL'" }), [11], "the service's own object IDs");
    assert.equal(layers.get(`gismap-${layer.uid}-circle`).paint["circle-color"], "rgba(200,0,0,1)", "drawn with the service's style");
    assert.equal(engine.getLayerConfig(layer).styled, false);
    assert.deepEqual(await engine.queryObjectIds(layer.uid, { geometry: { type: "Polygon", coordinates: [[[-90, 40], [-85, 40], [-85, 45], [-90, 40]]] }, spatialRelationship: "contains" }), [12], "spatial relationships are answered by the service");
    assert.ok(engine.layerMetadata(layer), "service metadata for sentinels and edit dates");
    engine.restoreRenderer(layer.uid, { type: "simple", symbol: { type: "simple-marker", color: "#00ff00", size: 6 } });
    assert.equal(layers.get(`gismap-${layer.uid}-circle`).paint["circle-color"], "#00ff00");
    assert.equal(engine.getLayerConfig(layer).styled, true);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("large service layers can be opened for filtering and share only complete results", async () => {
  const engine = new MaplibreEngine({ publish() {} });
  engine.map = { addSource() {}, removeSource() {}, getSource: () => ({ setData() {} }), addLayer() {}, getLayer: () => null, setFilter() {}, setLayoutProperty() {}, setPaintProperty() {}, setLayerZoomRange() {} };
  const realFetch = globalThis.fetch;
  const seen = [];
  globalThis.fetch = fakeFetch([
    [(url) => url.includes("returnCountOnly"), { count: 50001 }],
    [(url) => url.includes("returnIdsOnly"), (url) => {
      const where = new URL(url).searchParams.get("where"); seen.push(where);
      return { objectIds: where === "1=1" ? Array.from({ length: 50001 }, (_, i) => i + 1) : [42] };
    }],
    [(url, init) => url.includes("f=geojson") || String(init.body || "").includes("f=geojson"), { type: "FeatureCollection", features: [{ type: "Feature", id: 42, geometry: { type: "Point", coordinates: [0, 0] }, properties: { OBJECTID: 42, MAG: 5 } }] }],
    [(url) => /FeatureServer\/0\?/.test(url), { type: "Feature Layer", name: "Historical Quakes", geometryType: "esriGeometryPoint", objectIdField: "OBJECTID", fields: [{ name: "OBJECTID", type: "esriFieldTypeOID" }, { name: "MAG", type: "esriFieldTypeDouble" }], maxRecordCount: 2000, advancedQueryCapabilities: { supportsPagination: false } }],
  ]);
  try {
    const layer = await engine.addService({ url: "https://x.org/FeatureServer/0", serviceType: "arcgis-auto" });
    await assert.rejects(engine.loadLayer(layer.uid), /feature limit/);
    assert.equal((await engine.loadLayer(layer.uid, { allowTruncated: true })).truncated, true);
    engine.setDefinitionExpression(layer.uid, "MAG >= 5");
    assert.equal((await engine.loadLayer(layer.uid)).truncated, false);
    assert.ok(seen.includes("MAG >= 5"));
    engine.setDefinitionExpression(layer.uid, null);
    await assert.rejects(engine.loadLayer(layer.uid), /feature limit/);
    assert.equal((await engine.loadLayer(layer.uid, { allowTruncated: true })).truncated, true);
  } finally { globalThis.fetch = realFetch; }
});
