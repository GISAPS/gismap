import test from "node:test";
import assert from "node:assert/strict";
import { buildSubsurfaceGeometry, featuresBounds, measureMeters, normalizeSubsurface, normalizeUnderground, parseColor, rendererColorResolver, subsurfaceArcgis, subsurfaceSummary } from "../js/subsurface.js";
import { validateMapSpec } from "../js/map-spec.js";

const fields = [{ name: "DEPTH_FT", type: "double" }, { name: "DIAM_IN", type: "integer" }, { name: "KIND", type: "string" }];
// A frame with 1 degree = 1000 m, enough to check the geometry's metres.
const frame = { toLocal: (lon, lat) => [lon * 1000, lat * 1000] };
const zRange = (positions) => {
  const z = positions.filter((_, index) => index % 3 === 2);
  return [Math.min(...z), Math.max(...z)];
};

test("a below-ground setting is bounded and keeps only what its geometry uses", () => {
  const pipe = normalizeSubsurface({ depth: { field: "DEPTH_FT", scale: 0.3048 }, diameter: { field: "DIAM_IN", scale: 0.0254 }, thickness: 40, exaggeration: 500, color: "#AABBCC" }, { fields, geometryType: "polyline" });
  assert.deepEqual(pipe, {
    type: "subsurface",
    depth: { field: "DEPTH_FT", meters: 3, scale: 0.3048 },
    diameter: { field: "DIAM_IN", meters: 1, scale: 0.0254, minMeters: 1 },
    exaggeration: 100,
    color: "#aabbcc",
  });
  const rock = normalizeSubsurface({ depth: 50, thickness: { meters: 200 } }, { fields, geometryType: "polygon" });
  assert.equal(rock.thickness.meters, 200);
  assert.equal(rock.diameter, undefined);
  assert.equal(normalizeSubsurface(null), null);
  assert.throws(() => normalizeSubsurface({ depth: { field: "KIND" } }, { fields, geometryType: "point" }), /numeric/);
  assert.throws(() => normalizeSubsurface({ depth: { field: "NOPE" } }, { fields, geometryType: "point" }), /no field/);
});

test("the underground view setting accepts true or an object", () => {
  assert.deepEqual(normalizeUnderground(true), { enabled: true, groundOpacity: 0.45 });
  assert.deepEqual(normalizeUnderground({ enabled: true, groundOpacity: 3 }), { enabled: true, groundOpacity: 1 });
  assert.deepEqual(normalizeUnderground(null), { enabled: false, groundOpacity: 0.45 });
});

test("measurements read a feature's field in its units, falling back to fixed metres", () => {
  const depth = { field: "DEPTH_FT", meters: 2, scale: 0.3048 };
  assert.equal(measureMeters(depth, { DEPTH_FT: 10 }), 3.048);
  assert.equal(measureMeters(depth, { DEPTH_FT: null }), 2);
  assert.equal(measureMeters(depth, {}), 2);
  assert.match(subsurfaceSummary(normalizeSubsurface({ depth, diameter: 0.5 }, { geometryType: "polyline" })), /depth from DEPTH_FT × 0.3048 m; diameter 0.5 m/);
});

test("pipes are tubes at their depth below the ground", () => {
  const config = normalizeSubsurface({ depth: 4, diameter: 2 }, { geometryType: "polyline" });
  const built = buildSubsurfaceGeometry([{ geometry: { type: "LineString", coordinates: [[0, 0], [0.1, 0], [0.1, 0.1]] }, properties: {} }], config, { frame });
  assert.equal(built.drawn, 1);
  assert.equal(built.positions.length, built.normals.length);
  assert.equal(built.positions.length % 9, 0);
  const [low, high] = zRange(built.positions);
  assert.ok(Math.abs(low + 5) < 1e-6 && Math.abs(high + 3) < 1e-6, `${low}..${high}`);
  // The ground's relief carries the pipe with it.
  const raised = buildSubsurfaceGeometry([{ geometry: { type: "LineString", coordinates: [[0, 0], [0.1, 0]] }, properties: {} }], config, { frame, groundAt: () => 100 });
  assert.ok(Math.abs(zRange(raised.positions)[1] - 97) < 1e-6);
});

test("wells hang from the ground and rock units sit between their top and base", () => {
  const well = normalizeSubsurface({ depth: { field: "DEPTH_FT", scale: 0.3048 }, diameter: 1 }, { fields, geometryType: "point" });
  const shaft = buildSubsurfaceGeometry([{ geometry: { type: "Point", coordinates: [0, 0] }, properties: { DEPTH_FT: 100 } }], well, { frame });
  assert.deepEqual(zRange(shaft.positions).map((value) => Math.round(value * 100) / 100), [-30.98, 0.5]);
  const unit = normalizeSubsurface({ depth: 10, thickness: 30, exaggeration: 2 }, { geometryType: "polygon" });
  const square = buildSubsurfaceGeometry([{ geometry: { type: "Polygon", coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]] }, properties: {} }], unit, { frame });
  assert.deepEqual(zRange(square.positions), [-80, -20]);
  assert.equal(square.deepest, 80);
  // Top and bottom (2 triangles each) and four walls (2 each).
  assert.equal(square.positions.length / 9, 12);
});

test("features take the colour the flat map gives them", () => {
  const byKind = rendererColorResolver({ type: "unique-value", field: "KIND", uniqueValueInfos: [{ value: "sewer", symbol: { type: "simple-line", color: "#8a5a2b" } }], defaultSymbol: { type: "simple-line", color: [10, 20, 30, 1] } });
  assert.deepEqual(byKind({ KIND: "sewer" }), parseColor("#8a5a2b"));
  assert.deepEqual(byKind({ KIND: "gas" }), [10 / 255, 20 / 255, 30 / 255]);
  const byDepth = rendererColorResolver({ type: "classBreaks", field: "DEPTH_FT", classBreakInfos: [{ classMaxValue: 10, symbol: { type: "esriSLS", color: [255, 0, 0, 255] } }, { classMaxValue: 50, symbol: { type: "esriSLS", color: [0, 0, 255, 255] } }] });
  assert.deepEqual(byDepth({ DEPTH_FT: 20 }), [0, 0, 1]);
  assert.deepEqual(rendererColorResolver(null, "#ffffff")(), [1, 1, 1]);
});

test("bounds cover every part of every feature", () => {
  assert.deepEqual(featuresBounds([{ geometry: { type: "MultiLineString", coordinates: [[[-1, 2], [3, 4]], [[5, -6], [0, 0]]] } }]), [-1, -6, 5, 4]);
  assert.equal(featuresBounds([]), null);
});

test("ArcGIS draws pipes as tubes, wells as hanging cylinders and units extruded up from their base", () => {
  const pipe = subsurfaceArcgis(normalizeSubsurface({ depth: { field: "DEPTH_FT", scale: 0.3048 }, diameter: 0.6 }, { fields, geometryType: "polyline" }), "polyline");
  assert.equal(pipe.renderer.symbol.symbolLayers[0].type, "path");
  assert.equal(pipe.renderer.symbol.symbolLayers[0].width, 1);
  assert.equal(pipe.elevationInfo.featureExpressionInfo.expression, '-(DefaultValue($feature["DEPTH_FT"], 3) * 0.3048)');
  const well = subsurfaceArcgis(normalizeSubsurface({ depth: 30 }, { geometryType: "point" }), "point");
  assert.equal(well.renderer.symbol.symbolLayers[0].anchor, "top");
  assert.equal(well.renderer.symbol.symbolLayers[0].height, 30);
  assert.equal(well.elevationInfo.featureExpressionInfo.expression, "0");
  const unit = subsurfaceArcgis(normalizeSubsurface({ depth: 10, thickness: 30 }, { geometryType: "polygon" }), "polygon", { type: "unique-value", field: "KIND", uniqueValues: [{ value: "sand", color: "#e0c080" }] });
  assert.equal(unit.renderer.uniqueValueInfos[0].symbol.symbolLayers[0].size, 30);
  assert.equal(unit.elevationInfo.featureExpressionInfo.expression, "-(10) - (30)");
});

test("map specs carry the below-ground setting and the underground view", () => {
  const { spec, issues } = validateMapSpec({ version: 1, underground: true, layers: [{ url: "https://example.com/arcgis/rest/services/Sewers/FeatureServer/0", subsurface: { depth: 3, diameter: 1 } }] });
  assert.deepEqual(spec.underground, { enabled: true, groundOpacity: 0.45 });
  assert.equal(spec.layers[0].subsurface.depth.meters, 3);
  assert.equal(issues.filter((item) => item.path?.includes("subsurface")).length, 0);
  const bad = validateMapSpec({ version: 1, layers: [{ url: "https://example.com/arcgis/rest/services/Sewers/FeatureServer/0", subsurface: { depth: { field: "bad name" } } }] });
  assert.equal(bad.spec.layers[0].subsurface, undefined);
  assert.ok(bad.issues.some((item) => item.path === "layers[0].subsurface"));
});
