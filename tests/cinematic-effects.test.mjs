import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { effectFields, effectFrame, effectParts, particleSeeds, quadBuffers, resolveEffect, resolveQuality, ribbonBuffers, simplifyPath, suggestEffect } from "../js/cinematic/cinematic-effects.js";
import { normalizeCinematicSpec } from "../js/cinematic/state.js";

test("point fire uses a compact upright flame marker", async () => {
  const source = await readFile(new URL("../js/cinematic/effects-three.js", import.meta.url), "utf8");
  assert.match(source, /float y = gl_PointCoord\.y;/);
  assert.match(source, /float size = uHeight \* \(0\.42 \+ aMagnitude \* 0\.34\)/);
  assert.match(source, /float outerWidth = 0\.035 \+ 0\.29/);
});

test("effect parts keep only valid observed coordinates, tagged fresh, within budget", () => {
  const parts = effectParts([
    { feature: { geometry: { type: "Polygon", coordinates: [[[-122, 38], [-121, 38], [-121, 39], [-122, 38]]] } }, fresh: false },
    { geometry: { type: "LineString", coordinates: [[181, 0], [-120, 40], [-119, 40]] } },
    { feature: { attributes: { mag: 4.2 }, geometry: { type: "Point", coordinates: [-121.9, 37.7] } }, fresh: true },
  ]);
  // Newest first: the budget goes to fresh observations, then from the end of the list back.
  assert.deepEqual(parts.paths.map((path) => [path.coordinates, path.fresh]), [
    [[[-120, 40], [-119, 40]], 1],
    [[[-122, 38], [-121, 38], [-121, 39], [-122, 38]], 0],
  ]);
  assert.equal(parts.polygons.length, 1);
  assert.deepEqual(parts.points, [{ coordinates: [-121.9, 37.7], fresh: 1, attributes: { mag: 4.2 } }]);
  assert.equal(effectParts([{ geometry: { type: "MultiLineString", coordinates: [[[0, 0], [1, 1]], [[2, 2], [3, 3]]] } }], { maxPaths: 1 }).paths.length, 1);
});

test("ribbon vertices sit on the exact observed coordinates and mitre closed rings", () => {
  const frame = effectFrame([-122, 38]);
  const ring = [[-122, 38], [-121.99, 38], [-121.99, 38.01], [-122, 38.01], [-122, 38]];
  const buffers = ribbonBuffers([{ coordinates: ring, fresh: 1 }], frame);
  assert.equal(buffers.position.length / 3, ring.length * 2);
  // Both sides of a vertex share its exact position; width is applied on the GPU.
  assert.deepEqual(buffers.position.slice(0, 3), buffers.position.slice(3, 6));
  assert.deepEqual(buffers.position.slice(0, 3).map((v) => v + 0), [0, 0, 0]);
  // The closing corner mitres across the seam: start and end offsets match, at √2 for a square corner.
  assert.deepEqual(buffers.offset.slice(0, 2).map((v) => v.toFixed(6)), buffers.offset.slice(-4, -2).map((v) => v.toFixed(6)));
  assert.ok(Math.abs(Math.hypot(buffers.offset[0], buffers.offset[1]) - Math.SQRT2) < 1e-6);
  assert.equal(buffers.index.length, (ring.length - 1) * 6);
  assert.ok(buffers.distance.at(-1) > 3000 && buffers.distance.at(-1) < 4500);
});

test("terrain heights are sampled per vertex, not once for the whole effect", () => {
  const frame = effectFrame([-122, 38], (longitude) => (longitude > -121.995 ? 900 : 100));
  const buffers = ribbonBuffers([{ coordinates: [[-122, 38], [-121.99, 38]], fresh: 1 }], frame);
  assert.ok(Math.abs(buffers.position[2] - 100) < 1);
  assert.ok(Math.abs(buffers.position.at(-1) - 900) < 1);
});

test("point quads normalize magnitude and turn wind-from bearings into blow-toward directions", () => {
  const frame = effectFrame([0, 0]);
  const points = [
    { coordinates: [0, 0], fresh: 1, attributes: { mag: 2, wdir: 0, wspd: 5 } },
    { coordinates: [0.1, 0], fresh: 0, attributes: { mag: 6, wdir: 270, wspd: 25 } },
  ];
  const quads = quadBuffers(points, frame, { magnitudeField: "mag", directionField: "wdir", speedField: "wspd" });
  assert.deepEqual([quads.magnitude[0], quads.magnitude[4]], [0, 1]);
  assert.deepEqual([quads.speed[0], quads.speed[4]], [0, 1]);
  // From the north blows south (−y); from the west blows east (+x).
  assert.ok(Math.abs(Math.sin(quads.heading[0]) + 1) < 1e-9);
  assert.ok(Math.abs(Math.cos(quads.heading[4]) - 1) < 1e-9);
  assert.equal(quads.index.length, 12);
  assert.deepEqual(effectFields([{ name: "OBJECTID" }, { name: "mag" }], { wind_speed: 3, WDIR: 10 }), { magnitude: "mag", direction: "WDIR", speed: "wind_speed" });
});

test("embers are deterministic and prefer the newest observed edges", () => {
  const frame = effectFrame([-122, 38]);
  const paths = [{ coordinates: [[-122, 38], [-121.9, 38]], fresh: 0 }, { coordinates: [[-122, 38.1], [-121.9, 38.1]], fresh: 1 }];
  const first = particleSeeds(paths, frame, { count: 50 });
  assert.deepEqual(first, particleSeeds(paths, frame, { count: 50 }));
  assert.ok(first.lngLat.filter((_, index) => index % 2 === 1).every((latitude) => Math.abs(latitude - 38.1) < 1e-9));
});

test("auto effect follows the data and specs migrate the v0.1 glow flag", () => {
  assert.equal(suggestEffect({ title: "Current_Perimeters", geometryType: "polygon" }), "fire");
  assert.equal(suggestEffect({ title: "Earthquakes — past 30 days", geometryType: "point" }), "pulse");
  assert.equal(suggestEffect({ title: "Stations", geometryType: "point", fields: [{ name: "wdir" }, { name: "wspd" }] }), "wind");
  assert.equal(suggestEffect({ title: "Flood stages", geometryType: "polygon" }), "water");
  assert.equal(suggestEffect({ title: "Bus routes", geometryType: "polyline" }), "flow");
  assert.equal(suggestEffect({ title: "Parcels", geometryType: "polygon" }), "glow");
  assert.equal(resolveEffect("auto", { title: "USGS quakes", geometryType: "point" }), "pulse");
  assert.equal(resolveEffect("sparkles"), "glow");
  const layer = (animation) => normalizeCinematicSpec({ layers: [{ layerRef: "a", temporal: { startField: "t" }, animation }] }).cinematic.layers[0].animation.effect;
  assert.deepEqual(layer({ outline: { glow: true } }), { type: "glow", color: null, intensity: 1, opacity: 1, speed: 1, density: 1, style: "balanced" });
  assert.deepEqual(layer({ effect: { type: "fire", color: "#ff0000", intensity: 9 } }), { type: "fire", color: "#ff0000", intensity: 2, opacity: 1, speed: 1, density: 1, style: "balanced" });
  assert.equal(layer({ effect: { type: "lasers" } }).type, "none");
});

test("terrain sampling stays within budget, interpolates along a path and resamples at path jumps", async () => {
  const { sampledHeights } = await import("../js/cinematic/effects-three.js");
  const lngLat = [];
  for (let i = 0; i <= 100; i += 1) lngLat.push(-122 + i * 0.0001, 38);
  lngLat.push(-121, 39, -120.9999, 39);
  const calls = [];
  const heights = sampledHeights(lngLat, ([longitude, latitude]) => { calls.push(longitude); return latitude === 39 ? 5000 : (longitude + 122) * 1e4; }, { budget: 10 });
  assert.ok(calls.length <= 16);
  assert.ok(Math.abs(heights[37] - 37) < 1e-6);
  assert.deepEqual([...heights.slice(-2)], [5000, 5000]);
});

test("layer effects travel in map specs and share links, and bad ones are reported", async () => {
  const { normalizeLayerEffect } = await import("../js/cinematic/cinematic-effects.js");
  const { validateMapSpec } = await import("../js/map-spec.js");
  const { packLayer } = await import("../js/map-share.js");
  assert.deepEqual(normalizeLayerEffect({ type: "fire", intensity: 0.1 }), { type: "fire", intensity: 0.25, opacity: 1, color: null, style: "balanced", speed: 1, density: 1 });
  assert.equal(normalizeLayerEffect({ type: "none" }), null);
  assert.equal(normalizeLayerEffect("glow"), null);
  const ok = validateMapSpec({ version: 1, layers: [{ url: "https://example.org/quakes.geojson", animatedEffect: { type: "pulse", intensity: 1.5 } }] });
  assert.deepEqual(ok.spec.layers[0].animatedEffect, { type: "pulse", intensity: 1.5, opacity: 1, color: null, style: "balanced", speed: 1, density: 1 });
  const bad = validateMapSpec({ version: 1, layers: [{ url: "https://example.org/quakes.geojson", animatedEffect: { type: "lasers" } }] });
  assert.equal(bad.spec.layers[0].animatedEffect, undefined);
  assert.ok(bad.issues.some((issue) => issue.path === "layers[0].animatedEffect"));
  // Links prune empty values; reading one back normalizes the effect again.
  assert.deepEqual(packLayer({ url: "https://example.org/quakes.geojson", sourceType: "geojson", animatedEffect: { type: "glow", intensity: 1 } }).e, { type: "glow", intensity: 1, opacity: 1, style: "balanced", speed: 1, density: 1 });
  assert.deepEqual(normalizeLayerEffect({ type: "glow", intensity: 1 }), { type: "glow", intensity: 1, opacity: 1, color: null, style: "balanced", speed: 1, density: 1 });
});

test("large scenes keep the newest observation, trim sub-pixel detail and pick a lighter quality", () => {
  const line = (n) => ({ feature: { geometry: { type: "LineString", coordinates: [[n, 0], [n + 0.5, 0.0001], [n + 1, 0]] } }, fresh: false });
  const items = [...Array.from({ length: 50 }, (_, n) => line(n)), { ...line(99), fresh: true }];
  const parts = effectParts(items, { maxPaths: 5 });
  assert.equal(parts.paths.length, 5);
  assert.equal(parts.paths[0].coordinates[0][0], 99);
  assert.equal(parts.paths[1].coordinates[0][0], 49);
  // A bump smaller than the tolerance is dropped; one larger is kept.
  assert.deepEqual(simplifyPath([[0, 0], [0.5, 0.0001], [1, 0]], 0.001), [[0, 0], [1, 0]]);
  assert.equal(simplifyPath([[0, 0], [0.5, 0.01], [1, 0]], 0.001).length, 3);
  assert.equal(effectParts(items, { simplify: 0.001 }).paths[0].coordinates.length, 2);
  assert.equal(resolveQuality("auto", 300), "cinematic");
  assert.equal(resolveQuality("auto", 3000), "balanced");
  assert.equal(resolveQuality("auto", 17950), "eco");
  assert.equal(resolveQuality("balanced", 17950), "balanced");
});

test("Rise and Reveal read a value field, keep values as data and grow on the track's time", async () => {
  const { nativeEffectData, valueField, riseAmount, revealAmount, NATIVE_EFFECTS, suggestEffect: suggest } = await import("../js/cinematic/cinematic-effects.js");
  assert.deepEqual(NATIVE_EFFECTS, ["extrude", "reveal", "strata"]);
  const fields = [{ name: "OBJECTID", type: "esriFieldTypeOID" }, { name: "GEOID", type: "esriFieldTypeInteger" }, { name: "NAME", type: "esriFieldTypeString" }, { name: "POP2020", type: "esriFieldTypeInteger" }];
  assert.equal(valueField(fields), "POP2020", "IDs and codes are not values");
  const square = (x) => ({ type: "Polygon", coordinates: [[[x, 0], [x + 1, 0], [x + 1, 1], [x, 0]]] });
  const items = [100, 400, 250, null].map((value, index) => ({ feature: { attributes: { POP2020: value }, geometry: square(index) } }));
  const { data, stats } = nativeEffectData(items, { field: "POP2020" });
  assert.deepEqual(stats, { field: "POP2020", min: 100, max: 400, count: 4, withValue: 3 });
  assert.deepEqual(data.features.map((feature) => feature.properties.v), [0.25, 1, 0.625, 0], "heights are proportional to the values (no value: flat)");
  assert.deepEqual(nativeEffectData([-10, 10].map((value) => ({ feature: { attributes: { d: value }, geometry: square(0) } })), { field: "d" }).data.features.map((feature) => feature.properties.v), [0, 1], "data with negatives scale min to max");
  assert.deepEqual(data.features.map((feature) => feature.properties.order), [0, 2 / 3, 1 / 3, 1], "ranked by value; no value last");
  assert.deepEqual(data.features[1].geometry, square(1), "geometry is passed through exactly");
  const stored = nativeEffectData(items);
  assert.deepEqual(stored.data.features.map((feature) => feature.properties.order), [0, 1 / 3, 2 / 3, 1], "without a field, the stored order (not a date)");
  assert.equal(riseAmount({ seconds: 0 }), 0);
  assert.equal(riseAmount({ seconds: 3 }), 1, "a continuous track rises over 3 s and holds");
  assert.equal(riseAmount({ phase: 0.5 }, 6), 0.5);
  assert.equal(revealAmount({ seconds: 4 }), 0.5);
  assert.equal(suggest({ title: "County population 2020", geometryType: "polygon", fields }), "extrude");
  assert.equal(suggest({ title: "Parcels", geometryType: "polygon", fields }), "glow", "only statistical areas rise by default");
});

test("Strata timeline stacks records in the layer's chart slots, or one slot per step, earliest lowest", async () => {
  const { strataData, strataLanding, CINEMATIC_EFFECTS: catalog } = await import("../js/cinematic/cinematic-effects.js");
  assert.equal(catalog.strata.cinematicOnly, true, "needs a timeline, so it is not a Style-panel effect");
  assert.match(catalog.strata.note, /not altitude/);
  const square = (x) => ({ type: "Polygon", coordinates: [[[x, 0], [x + 1, 0], [x + 1, 1], [x, 0]]] });
  const observations = [["1980s", 1985, 10], ["1990s", 1994, 20], ["1980s", 1988, 30]].map(([decade, year, time], index) => ({ index, time, feature: { attributes: { DECADES: decade, YEAR_: year }, geometry: square(index) } }));
  const chart = { mode: "temporal-strata", groupBy: "DECADES", groups: ["1980s", "1990s"], height: { field: "YEAR_", slotMeters: 400, gapMeters: 100, thicknessMeters: 250, scale: 1 }, color: { strategy: "sequential" } };
  const charted = strataData(observations, { chart, ticks: [10, 20, 30] });
  assert.deepEqual(charted.data.features.map((feature) => [feature.id, feature.properties.base, feature.properties.top]), [[0, 0, 400], [1, 500, 900], [2, 0, 400]], "the chart's slots and capped thickness");
  assert.deepEqual(charted.data.features[1].geometry, square(1), "geometry is passed through exactly");
  assert.notEqual(charted.data.features[0].properties.color, charted.data.features[1].properties.color, "each slot keeps its chart colour");
  const bySteps = strataData(observations, { ticks: [10, 20, 30] });
  assert.deepEqual(bySteps.data.features.map((feature) => feature.properties.base), [0, 500, 1000], "without a chart, each step is a slot");
  assert.equal(strataData(observations, { ticks: Array.from({ length: 400 }, (_, index) => index) }).stats.slots, 40, "many steps are binned");
  assert.equal(strataData(observations, { chart, ticks: [], color: "#123456" }).data.features[0].properties.color, "#123456", "a track's own colour wins");
  assert.equal(strataData([{ index: 0, time: 0, feature: { geometry: { type: "Point", coordinates: [0, 0] } } }]).stats.count, 0, "only polygons stack");
  assert.equal(strataLanding(0), 0);
  assert.equal(strataLanding(1.2), 1, "a new step lands in 1.2 s");
});

test("skins recolour effects without a colour of their own, and nothing else", async () => {
  const { effectColor, SKIN_EFFECT_PALETTES, CINEMATIC_EFFECTS: catalog } = await import("../js/cinematic/cinematic-effects.js");
  assert.equal(effectColor("fire"), catalog.fire.color);
  assert.equal(effectColor("flow", { skin: "dark-analytical" }), SKIN_EFFECT_PALETTES["dark-analytical"].flow);
  assert.equal(effectColor("flow", { skin: "dark-analytical", color: "#123456" }), "#123456", "a track's own colour wins");
  assert.equal(effectColor("flow", { skin: "no-such-skin" }), catalog.flow.color);
  for (const palette of Object.values(SKIN_EFFECT_PALETTES)) for (const value of Object.values(palette)) assert.match(value, /^#[0-9a-f]{6}$/i);
});

test("roads get Traffic: car lights both ways, labelled as styling", async () => {
  const { CINEMATIC_EFFECTS: catalog, suggestEffect: suggest, resolveEffect: resolve, normalizeLayerEffect } = await import("../js/cinematic/cinematic-effects.js");
  assert.equal(catalog.traffic.label, "Traffic");
  assert.match(catalog.traffic.note, /not measured traffic/);
  for (const title of ["Major roads", "Street centerlines", "Interstate highways", "Traffic counts (AADT)"]) assert.equal(suggest({ title, geometryType: "polyline" }), "traffic", title);
  assert.equal(suggest({ title: "Transmission lines", geometryType: "polyline" }), "electricity", "utility lines get Electric flow");
  assert.equal(suggest({ title: "Pacific shipping lanes", geometryType: "polyline" }), "ships");
  assert.equal(suggest({ title: "Airport flight corridors", geometryType: "polyline" }), "airplanes");
  assert.equal(suggest({ title: "Tornado reports", geometryType: "point" }), "tornado");
  assert.notEqual(suggest({ title: "Traffic cameras", geometryType: "point" }), "traffic", "traffic points are not roads");
  assert.equal(resolve("traffic"), "traffic");
  assert.deepEqual(normalizeLayerEffect({ type: "traffic", opacity: 0.6, style: "vivid", speed: 2.2, density: 1.4 }), { type: "traffic", intensity: 1, opacity: 0.6, color: null, style: "vivid", speed: 2.2, density: 1.4 });
  const { importCinematicSpec } = await import("../js/cinematic/state.js");
  assert.equal(importCinematicSpec({ cinematic: { layers: [{ layerRef: "roads", temporal: { kind: "none" }, animation: { effect: { type: "traffic" } } }] } }).cinematic.layers[0].animation.effect.type, "traffic");
  const { recommendAnimations } = await import("../js/cinematic/recommend.js");
  const first = recommendAnimations({ title: "Major roads", geometryType: "polyline", fields: [] })[0];
  assert.deepEqual([first.effect, first.kind, first.provenance], ["traffic", "none", "illustrative"]);
});

test("the expanded effects catalogue is categorized and remains explicitly illustrative", async () => {
  const { CINEMATIC_EFFECTS: catalog, CINEMATIC_EFFECT_CATEGORIES: categories } = await import("../js/cinematic/cinematic-effects.js");
  for (const key of ["snow", "lightning", "tornado", "hurricane", "storm", "water-flow", "electricity", "sailboats", "ships", "birds", "drones", "airplanes", "helicopters"]) {
    assert.ok(catalog[key], key);
    assert.ok(categories.includes(catalog[key].category), `${key} category`);
    assert.match(catalog[key].note, /not|decorative|illustrative/i, `${key} disclosure`);
  }
  assert.deepEqual([...new Set(categories)], categories, "categories are unique and menu-ready");
});

test("rail and transit lines get Trains, labelled as not real positions", async () => {
  const { CINEMATIC_EFFECTS: catalog, suggestEffect: suggest } = await import("../js/cinematic/cinematic-effects.js");
  assert.match(catalog.trains.note, /not real vehicle positions or timetables/);
  for (const title of ["Light rail lines", "BART routes", "Subway lines", "Amtrak railway", "Streetcar network"]) assert.equal(suggest({ title, geometryType: "polyline" }), "trains", title);
  assert.equal(suggest({ title: "Major roads", geometryType: "polyline" }), "traffic", "roads keep Traffic");
  assert.equal(suggest({ title: "Rail stations", geometryType: "point" }) !== "trains", true, "stations are points, not lines");
  const { importCinematicSpec } = await import("../js/cinematic/state.js");
  assert.equal(importCinematicSpec({ cinematic: { layers: [{ layerRef: "rail", temporal: { kind: "none" }, animation: { effect: { type: "trains" } } }] } }).cinematic.layers[0].animation.effect.type, "trains");
  const { recommendAnimations } = await import("../js/cinematic/recommend.js");
  const first = recommendAnimations({ title: "Light rail lines", geometryType: "polyline", fields: [] })[0];
  assert.deepEqual([first.effect, first.kind, first.provenance], ["trains", "none", "illustrative"]);
});

test("Auto plays a layer with a stacked 3D chart as Strata, not as outlines on the ground", () => {
  const strata = { type: "spatial-3d-chart", mode: "temporal-strata", groupBy: "DECADES", groups: ["1950-1959", "1960-1969"] };
  assert.equal(suggestEffect({ title: "California fire perimeters by decade", geometryType: "polygon", spatialChart: strata }), "strata");
  assert.equal(resolveEffect("auto", { title: "California fire perimeters by decade", geometryType: "polygon", spatialChart: strata }), "strata");
  assert.equal(suggestEffect({ title: "California fire perimeters", geometryType: "polygon", spatialChart: { type: "spatial-3d-chart", mode: "attribute-extrusion" } }), "fire", "a plain extrusion keeps the themed effect");
  assert.equal(suggestEffect({ title: "California fire perimeters", geometryType: "polygon" }), "fire");
});
