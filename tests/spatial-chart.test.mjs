import test from "node:test";
import assert from "node:assert/strict";
import { normalizeSpatialChart, spatialChartAxis, spatialChartLayerSpecs, spatialChartLegend, spatialChartColor, spatialChartGroupColor, spreadColors } from "../js/spatial-chart.js";
import { strataData } from "../js/cinematic/cinematic-effects.js";
import { generateSpatialChartBrief } from "../js/briefing-spatial-chart.js";
import { normalizeBriefing } from "../js/briefing-document.js";
import { validateMapSpec } from "../js/map-spec.js";
import { readShare, serializeShare } from "../js/map-share.js";

const fields = [
  { name: "YEAR_", type: "integer" },
  { name: "GIS_ACRES", type: "double" },
];
const records = [2019, 2022, 2025, 2022].map((year, index) => ({ attributes: { YEAR_: year, GIS_ACRES: (index + 1) * 10 } }));

test("normalizes temporal strata with explicit virtual-Z semantics", () => {
  const chart = normalizeSpatialChart({ type:"spatial-3d-chart", mode:"temporal-strata", groupBy:"YEAR_", height:{ slotMeters:400, gapMeters:100 } }, { fields, geometryType:"polygon", groupValues:records.map((record) => record.attributes.YEAR_) });
  assert.deepEqual(chart.groups, [2019, 2022, 2025]);
  assert.deepEqual(chart.geometry, { strategy:"source-footprints", aggregation:"none" });
  assert.match(spatialChartAxis(chart).detail, /not physical altitude/);
  const specs = spatialChartLayerSpecs({ chart, idPrefix:"fire", source:"source", polygonFilter:["==", ["geometry-type"], "Polygon"] });
  assert.equal(specs.length, 3);
  assert.equal(specs[1].paint["fill-extrusion-base"], 500);
  assert.equal(specs[1].paint["fill-extrusion-height"], 620);
  assert.deepEqual(specs[2].filter.at(-1), ["==", ["get", "YEAR_"], 2025]);
});

test("attribute extrusion uses a numeric field and rejects invented or non-polygon inputs", () => {
  const chart = normalizeSpatialChart({ type:"spatial-3d-chart", mode:"attribute-extrusion", height:{ field:"GIS_ACRES", scale:20 } }, { fields, geometryType:"polygon" });
  const [spec] = spatialChartLayerSpecs({ chart, idPrefix:"fire", source:"source", polygonFilter:true });
  assert.deepEqual(spec.paint["fill-extrusion-height"], ["max", 0, ["*", ["to-number", ["get", "GIS_ACRES"], 0], 20]]);
  assert.throws(() => normalizeSpatialChart({ mode:"attribute-extrusion", height:{ field:"MISSING" } }, { fields, geometryType:"polygon" }), /numeric height field/);
  assert.throws(() => normalizeSpatialChart({ mode:"attribute-extrusion", height:{ field:"GIS_ACRES" } }, { fields, geometryType:"point" }), /polygon/);
});

test("3D Spatial Chart Brief creates five portable, editable stages", () => {
  const camera = { center:[-120, 38], zoom:7, heading:0, tilt:35 };
  const result = generateSpatialChartBrief({ briefing:{ slides:[] }, layerRef:"https://example.test/FeatureServer/0", camera, fields, records, geometryType:"polygon", groupBy:"YEAR_", heightField:"GIS_ACRES", scale:20 });
  assert.deepEqual(result.briefing.slides.map((slide) => slide.title), ["Overview", "Magnitude", "History", "Accumulation", "Return to geography"]);
  assert.equal(result.briefing.slides[0].spatialChart, null);
  assert.equal(result.briefing.slides[2].spatialChart.mode, "temporal-strata");
  assert.equal(result.briefing.slides[3].spatialChart.geometry.aggregation, "none");
  const roundtrip = normalizeBriefing(JSON.parse(JSON.stringify(result.briefing)));
  assert.equal(roundtrip.slides[1].generatedBy.template, "spatial-3d-chart");
  assert.equal(result.preview.groups, 3);
});

test("map-v1 keeps the portable chart configuration", () => {
  const spatialChart = { type:"spatial-3d-chart", mode:"temporal-strata", groupBy:"YEAR_", groups:[2019,2022], height:{ mode:"fixed-slot", slotMeters:400, gapMeters:100, thicknessMeters:120, scale:1 }, geometry:{ strategy:"source-footprints", aggregation:"none" } };
  const result = validateMapSpec({ version:1, layers:[{ url:"https://example.test/fires.geojson", type:"geojson", spatialChart }] });
  assert.equal(result.valid, true);
  assert.deepEqual(result.spec.layers[0].spatialChart, spatialChart);
});

test("full share links preserve spatial chart settings without changing false interaction flags", () => {
  const spatialChart = { type:"spatial-3d-chart", mode:"exploded-timeline", groupBy:"YEAR_", groups:[2019,2022], height:{ mode:"fixed-slot", slotMeters:400, gapMeters:300, thicknessMeters:120, scale:1 }, color:{ field:"YEAR_", strategy:"sequential" }, geometry:{ strategy:"source-footprints", aggregation:"none" }, interaction:{ hover:false, select:true, explode:true, scrubTimeline:true } };
  const payload = serializeShare({ layers:[{ url:"https://example.test/fires.geojson", sourceType:"geojson", spatialChart }] });
  assert.deepEqual(readShare(payload).layers[0].spatialChart, spatialChart);
});

test("Brief playback restores the chart that was active before the presentation", async () => {
  const { BriefingSlides } = await import("../js/briefing-slides.js");
  const original = { type:"spatial-3d-chart", mode:"attribute-extrusion", height:{ field:"GIS_ACRES", scale:1 } };
  const layer = { uid:"fire", id:"fire", queryable:true };
  let current = original;
  const mapController = {
    getLayers:() => [layer], getLayerConfig:() => ({ spatialChart:current }),
    setSpatialChart:async (_uid, chart) => { current = chart; }, setVisibility() {},
  };
  const slides = new BriefingSlides({ mapController, data:() => ({ layer, fields:{ fields }, records:[] }), getBriefing:() => ({}) });
  const history = { type:"spatial-3d-chart", mode:"temporal-strata", groupBy:"YEAR_", groups:[2019], height:{ slotMeters:400, gapMeters:100, thicknessMeters:120, scale:1 } };
  await slides.applySlideLayers({ spatialChart:history });
  assert.equal(current.mode, "temporal-strata");
  await slides.restoreLayers();
  assert.equal(current.mode, "attribute-extrusion");
});


test("more than 40 groups is an explicit error, never a silent slice", () => {
  const fields = [{ name:"YEAR_", type:"integer" }];
  const groupValues = Array.from({ length:41 }, (_, i) => 1980 + i);
  assert.throws(() => normalizeSpatialChart({ type:"spatial-3d-chart", mode:"temporal-strata", groupBy:"YEAR_" }, { fields, geometryType:"polygon", groupValues }), /41 distinct values/);
});

test("magnitude slabs are capped at their slot so they cannot cover the next group", () => {
  const fields = [{ name:"YEAR_", type:"integer" }, { name:"ACRES", type:"double" }];
  const chart = normalizeSpatialChart({ type:"spatial-3d-chart", mode:"stacked-footprints", groupBy:"YEAR_", height:{ field:"ACRES", slotMeters:400, gapMeters:100, scale:10 } }, { fields, geometryType:"polygon", groupValues:[2019, 2020] });
  const [, second] = spatialChartLayerSpecs({ chart, idPrefix:"x", source:"x", polygonFilter:true });
  const height = second.paint["fill-extrusion-height"];
  assert.equal(height[1], 500);
  assert.equal(height[2][0], "min");
  assert.equal(height[2][1], 400);
  assert.match(spatialChartAxis(chart).detail, /capped at the 400 m slot/);
});

test("the legend shows real values against display heights, and strata swatches top-first", () => {
  const fields = [{ name:"YEAR_", type:"integer" }, { name:"RATE", type:"double" }];
  const extrusion = normalizeSpatialChart({ type:"spatial-3d-chart", mode:"attribute-extrusion", height:{ field:"RATE", scale:1000 } }, { fields, geometryType:"polygon" });
  const key = spatialChartLegend(extrusion, [12.5, null, 0, 3, 40, "x"]);
  assert.deepEqual(key.heights.map((item) => item.label), ["40 → 40 km", "12.5 → 12.5 km", "3 → 3 km"]);
  assert.equal(key.heights[0].ratio, 1);
  assert.equal(key.usesRendererColors, true, "extrusion keeps the style's colours, so the style legend stays");
  assert.deepEqual(key.slots, []);
  const strata = normalizeSpatialChart({ type:"spatial-3d-chart", mode:"temporal-strata", groupBy:"YEAR_", height:{ slotMeters:400, gapMeters:100 } }, { fields, geometryType:"polygon", groupValues:[2019, 2021, 2020] });
  const strataKey = spatialChartLegend(strata);
  assert.equal(strataKey.usesRendererColors, false, "strata draw their own colours, replacing the style legend");
  assert.deepEqual(strataKey.slots.map((slot) => slot.label), ["2021", "2020", "2019"]);
  assert.equal(strataKey.slots[0].color, spatialChartColor(2, 3));
  assert.equal(strataKey.slots[0].base, 1000);
  assert.deepEqual(strataKey.heights, []);
  const original = normalizeSpatialChart({ type:"spatial-3d-chart", mode:"stacked-footprints", groupBy:"YEAR_", color:{ strategy:"original" }, height:{ field:"RATE", scale:10, slotMeters:400 } }, { fields, geometryType:"polygon", groupValues:[2019] });
  const capped = spatialChartLegend(original, [100]);
  assert.equal(capped.usesRendererColors, true);
  assert.equal(capped.slots[0].color, null);
  assert.equal(capped.heights[0].label, "100 → 400 m", "slab thickness is capped at the slot");
});

test("height key values are rounded for reading", () => {
  const fields = [{ name:"ACRES", type:"double" }];
  const chart = normalizeSpatialChart({ type:"spatial-3d-chart", mode:"attribute-extrusion", height:{ field:"ACRES", scale:0.05 } }, { fields, geometryType:"polygon" });
  assert.deepEqual(spatialChartLegend(chart, [16389.54, 5062.198, 1.23456]).heights.map((item) => item.label), ["16,390 → 819 m", "5,062 → 253 m", "1.23 → 0 m"]);
});

test("descending order stacks the highest group at the bottom, and colours and legend follow", () => {
  const input = { type: "spatial-3d-chart", mode: "temporal-strata", groupBy: "YEAR_", order: "descending", height: { field: "YEAR_", slotMeters: 4000, gapMeters: 500, thicknessMeters: 2500 } };
  const chart = normalizeSpatialChart(input, { fields, groupValues: [1950, 2025, 1990] });
  assert.equal(chart.order, "descending");
  assert.deepEqual(chart.groups, [2025, 1990, 1950]);
  assert.deepEqual(normalizeSpatialChart(chart, { fields }).groups, [2025, 1990, 1950], "normalizing again keeps the order");
  const [bottom] = spatialChartLayerSpecs({ chart, idPrefix: "fires", source: "fires", polygonFilter: true });
  assert.deepEqual(bottom.filter.at(-1), ["==", ["get", "YEAR_"], 2025]);
  assert.equal(bottom.paint["fill-extrusion-base"], 0);
  assert.equal(bottom.paint["fill-extrusion-color"], spatialChartColor(0, 3));
  const legend = spatialChartLegend(chart, [1950, 2025]);
  assert.deepEqual(legend.slots.map((slot) => slot.label), ["1950", "1990", "2025"], "the top of the stack is listed first");
  assert.equal(legend.heights[0].label.startsWith("2025 →"), true, "a year field reads without a thousands separator");
  assert.equal(normalizeSpatialChart({ ...input, order: undefined }, { fields, groupValues: [1950, 2025] }).order, undefined, "ascending is the default and is not written out");
});

test("slab colours are kept per group value, survive a reversed order and reach every renderer", () => {
  const input = { type: "spatial-3d-chart", mode: "temporal-strata", groupBy: "YEAR_", height: { slotMeters: 400 }, color: { colors: { 1950: "#FF0000", 2025: "#00ff00", 1999: "#123456", bogus: "red" } } };
  const chart = normalizeSpatialChart(input, { fields, groupValues: [1950, 1990, 2025] });
  assert.deepEqual(chart.color.colors, { 1950: "#ff0000", 2025: "#00ff00" }, "unknown groups and invalid colours are dropped");
  assert.equal(spatialChartGroupColor(chart, 0), "#ff0000");
  assert.equal(spatialChartGroupColor(chart, 1), spatialChartColor(1, 3), "an unset group keeps the default palette");
  const reversed = normalizeSpatialChart({ ...input, order: "descending" }, { fields, groupValues: [1950, 1990, 2025] });
  assert.equal(spatialChartGroupColor(reversed, 0), "#00ff00", "the colour follows the group, not the position");
  const [bottom] = spatialChartLayerSpecs({ chart: reversed, idPrefix: "f", source: "f", polygonFilter: true });
  assert.equal(bottom.paint["fill-extrusion-color"], "#00ff00");
  assert.equal(spatialChartLegend(reversed).slots.at(-1).color, "#00ff00");
  assert.equal(strataData([{ index: 0, time: 1, feature: { geometry: { type: "Polygon", coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] }, properties: { YEAR_: 1950 } } }], { chart }).data.features[0].properties.color, "#ff0000");
  assert.equal(normalizeSpatialChart({ ...input, color: {} }, { fields, groupValues: [1950] }).color.colors, undefined);
});

test("a palette spread over more groups than it has stops gives every group its own colour", () => {
  const ramp = ["#000000", "#ffffff"];
  assert.deepEqual(spreadColors(ramp, 3), ["#000000", "#808080", "#ffffff"]);
  const eight = spreadColors(["#fcfdbf", "#fec488", "#fc8961", "#e75263", "#b5367a", "#7e2482", "#3b0f70"], 8);
  assert.equal(new Set(eight).size, 8);
  assert.deepEqual([eight[0], eight.at(-1)], ["#fcfdbf", "#3b0f70"]);
});

test("listed order stacks groups as given, for values that do not sort, such as geologic ages", () => {
  const ages = ["Paleozoic - Cambrian", "Paleozoic - Permian", "Mesozoic - Triassic", "Cenozoic - Neogene"];
  const fields = [{ name: "AGE_MAX", type: "string" }];
  const input = { type: "spatial-3d-chart", mode: "stacked-footprints", groupBy: "AGE_MAX", order: "listed", groups: [...ages, ages[0]], height: { slotMeters: 1000 } };
  const chart = normalizeSpatialChart(input, { fields, groupValues: ["Cenozoic - Neogene"] });
  assert.equal(chart.order, "listed");
  assert.deepEqual(chart.groups, ages, "oldest at the bottom; duplicates dropped, not sorted");
  assert.deepEqual(normalizeSpatialChart(chart, { fields }).groups, ages, "normalizing again keeps the order");
  const [bottom] = spatialChartLayerSpecs({ chart, idPrefix: "geology", source: "geology", polygonFilter: true });
  assert.deepEqual(bottom.filter.at(-1), ["==", ["get", "AGE_MAX"], "Paleozoic - Cambrian"]);
  assert.equal(normalizeSpatialChart({ ...input, groups: undefined }, { fields, groupValues: ages }).order, undefined, "without groups to keep, the order falls back to sorted");
});
