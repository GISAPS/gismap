import test from "node:test";
import assert from "node:assert/strict";
import { allowedParents, SI_PARENT_ORIGINS, validConsoleMessage } from "../js/si-console-embed.js";
import { createConsoleBridge } from "../js/engines/maplibre/console-overlay.js";

const message = (action, extra = {}) => ({ type: "gismap.si.console", version: 1, action, ...extra });
const feature = { type: "Feature", properties: { id: 1 }, geometry: { type: "Point", coordinates: [1, 2] } };
const collection = { type: "FeatureCollection", features: [feature] };

function fakeMap() {
  const handlers = {}, sources = {}, layers = {}, filters = {}, calls = [];
  return {
    handlers, sources, filters, calls, doubleClickZoom: { disable: () => calls.push("nodblzoom") },
    getSource: (id) => sources[id], addSource(id, source) { sources[id] = { ...source, setData(data) { this.data = data; } }; },
    getLayer: (id) => layers[id], addLayer(layer) { layers[layer.id] = layer; }, setFilter(id, filter) { filters[id] = filter; },
    on(name, fn) { handlers[name] = fn; }, isStyleLoaded: () => true,
    getBounds: () => ({ getWest: () => 0, getSouth: () => 1, getEast: () => 2, getNorth: () => 3 }),
    queryRenderedFeatures: () => [{ properties: { oid: 7 } }], fitBounds: (b) => calls.push(["fit", b]), zoomIn: () => calls.push("in"), zoomOut: () => calls.push("out"),
    easeTo: (o) => calls.push(["center", o.center]), getCanvas: () => ({ style: {} }),
  };
}

test("only GISMap SI parents are trusted in production", () => {
  assert.deepEqual(allowedParents("gismap.online", "https://evil.test/"), SI_PARENT_ORIGINS);
  assert.ok(allowedParents("localhost", "http://localhost:8792/x").includes("http://localhost:8792"));
});
test("console messages are validated", () => {
  assert.ok(validConsoleMessage(message("data", { name: "results", data: collection })));
  assert.ok(validConsoleMessage(message("fit", { bbox: [0, 0, 1, 1] })));
  for (const bad of [null, {}, message("eval"), { ...message("select"), version: 2 }, message("data", { name: "x", data: collection }), message("data", { name: "results", data: { type: "FeatureCollection", features: [{}] } }), message("fit", { bbox: [0, 0, "x", 1] }), message("zoom", { direction: "up" })]) assert.equal(validConsoleMessage(bad), false);
  assert.equal(validConsoleMessage(message("data", { name: "results", data: { type: "FeatureCollection", features: Array(20001).fill(feature) } })), false);
});
test("bridge waits for the style before announcing ready", () => {
  const map = fakeMap(), sent = [], addSource = map.addSource;
  map.addSource = () => { throw new Error("Style is not done loading"); };
  createConsoleBridge({ map, post: (m) => sent.push(m) });
  assert.deepEqual(sent, []);
  map.addSource = addSource;
  map.handlers.styledata();
  assert.equal(sent.at(-1).type, "gismap.console.ready");
});
test("bridge draws data, selects, and reports gestures with the hit feature", () => {
  const map = fakeMap(), sent = [];
  const bridge = createConsoleBridge({ map, post: (m) => sent.push(m), basemaps: [{ id: "a", label: "A" }] });
  assert.deepEqual(sent.map((m) => m.type), ["gismap.console.bounds", "gismap.console.ready"]);
  assert.deepEqual(sent[1].basemaps, [{ id: "a", label: "A" }]);
  bridge.handle(message("data", { name: "results", data: collection, idField: "oid" }));
  assert.equal(map.sources["si-results"].data, collection);
  bridge.handle(message("select", { id: 7 }));
  assert.match(JSON.stringify(map.filters["si-selected-fill"]), /"oid".*"7"/);
  map.handlers.click({ point: { x: 1, y: 1 }, lngLat: { lng: 5, lat: 6 } });
  assert.deepEqual(sent.at(-1), { type: "gismap.console.click", version: 1, lng: 5, lat: 6, id: 7 });
  bridge.handle(message("fit", { bbox: [0, 0, 1, 1] }));
  bridge.refit();
  assert.equal(map.calls.filter((call) => call[0] === "fit").length, 2);
  let prevented = false;
  map.handlers.dblclick({ point: { x: 1, y: 1 }, lngLat: { lng: 5, lat: 6 }, preventDefault: () => { prevented = true; } });
  assert.ok(prevented);
});
