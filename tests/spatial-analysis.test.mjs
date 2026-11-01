import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { runSpatialOperation, SPATIAL_OPERATIONS, toFeatureCollection } from "../js/spatial-analysis.js";
import { validateMapSpec } from "../js/map-spec.js";

const sandbox = {};
sandbox.globalThis = sandbox; sandbox.self = sandbox;
vm.runInNewContext(readFileSync(new URL("../js/vendor/turf-7.4.0.min.js", import.meta.url), "utf8"), sandbox);
const { turf } = sandbox;

const point = (x, y, properties = {}) => ({ type: "Feature", properties, geometry: { type: "Point", coordinates: [x, y] } });
const square = (x, y, size, properties = {}) => ({ type: "Feature", properties, geometry: { type: "Polygon", coordinates: [[[x, y], [x + size, y], [x + size, y + size], [x, y + size], [x, y]]] } });
const collection = (...features) => ({ type: "FeatureCollection", features });
const points = collection(point(0, 0, { name: "a" }), point(0.1, 0.1, { name: "b" }), point(5, 5, { name: "c" }), point(5.1, 4.9, { name: "d" }));
const polygons = collection(square(0, 0, 1, { zone: "x" }), square(4, 4, 2, { zone: "y" }));
const run = (id, input, extra = {}) => runSpatialOperation(turf, id, { input, ...extra });

test("every operation runs on suitable data", () => {
  for (const operation of SPATIAL_OPERATIONS) {
    const input = operation.input === "polygon" ? polygons : points;
    const overlay = operation.overlay === "polygon" ? collection(square(0.5, 0.5, 5)) : operation.overlay ? (operation.input === "point" ? collection(point(1, 1)) : points) : undefined;
    const options = operation.id === "kmeans" ? { clusters: 2 } : operation.id === "hexbin" ? { cellKm: 100 } : {};
    assert.ok(run(operation.id, input, { overlay, options }).collection.features.length > 0, operation.id);
  }
});

test("buffer, count, select and join give the right answers", () => {
  const area = turf.area(run("buffer", collection(point(0, 0)), { options: { distanceKm: 10 } }).collection) / 1e6;
  assert.ok(Math.abs(area - Math.PI * 100) < 10, `area ${area}`);
  const counted = run("count", polygons, { overlay: points }).collection.features.map((feature) => feature.properties.point_count);
  assert.deepEqual(counted, [2, 2]);
  assert.equal(run("select", points, { overlay: collection(polygons.features[0]) }).collection.features.length, 2);
  const joined = run("join", points, { overlay: polygons }).collection.features;
  assert.equal(joined[0].properties.zone, "x");
  assert.equal(joined[2].properties.zone, "y");
});

test("measure reports totals and clip and erase split a polygon", () => {
  const { totals } = run("measure", collection(square(0, 0, 1)));
  assert.ok(Math.abs(totals.areaKm2 - 12364) < 100, `${totals.areaKm2}`);
  const half = collection(square(0.5, -1, 3));
  const whole = turf.area(square(0, 0, 1));
  const clipped = turf.area(run("clip", collection(square(0, 0, 1)), { overlay: half }).collection);
  const erased = turf.area(run("erase", collection(square(0, 0, 1)), { overlay: half }).collection);
  assert.ok(Math.abs(clipped + erased - whole) / whole < 0.01);
});

test("a buffer across the 180 degree meridian stays one small shape", () => {
  const [feature] = run("buffer", collection(point(179.9, 0)), { options: { distanceKm: 200 } }).collection.features;
  const longitudes = feature.geometry.coordinates[0].map(([x]) => x);
  assert.ok(Math.max(...longitudes) - Math.min(...longitudes) < 5);
});

test("hexagon counts keep every point", () => {
  const { collection: result } = run("hexbin", points, { options: { cellKm: 300 } });
  assert.equal(result.features.reduce((sum, feature) => sum + feature.properties.point_count, 0), 4);
});

test("bad input is refused in plain language", () => {
  assert.throws(() => run("voronoi", polygons), /point features/);
  assert.throws(() => run("buffer", points, { options: { distanceKm: -1 } }), /between/);
  assert.throws(() => run("clip", polygons), /overlay/);
  assert.throws(() => run("hexbin", points, { options: { cellKm: 0.001 } }), /too many/);
  assert.throws(() => run("nope", points), /Unknown analysis/);
  assert.throws(() => toFeatureCollection("x"), /GeoJSON/);
});

test("map specs keep valid analysis steps and warn about the rest", () => {
  const { spec, issues } = validateMapSpec({ version: 1, layers: [{ url: "https://example.org/a.geojson" }], analysis: [
    { operation: "buffer", input: 0, options: { distanceKm: 5 } },
    { operation: "nope", input: 0 },
    { operation: "clip", input: 3 },
  ] });
  assert.equal(spec.analysis.length, 1);
  assert.equal(issues.filter((issue) => issue.path.startsWith("analysis")).length, 2);
});
