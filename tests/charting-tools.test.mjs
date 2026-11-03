import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { aggregateChart, chartCategories, chartColors, chartFields, chartFilterForRow, chartOption, chartSummary, chartSymbology, createChartSpec, displayChartRows, normalizeCharts, queryChart, recommendCharts, resolveChartTheme, rowsAsCsv } from "../js/charting-tools.js";
import { mapChartAnchor, normalizeMapChartPresentation, planMapChartDisplay, renderMapChartSvg } from "../js/map-chart-tools.js";

const fields = [
  { name: "OBJECTID", type: "oid" },
  { name: "YEAR_", alias: "Fire year", type: "integer" },
  { name: "GIS_ACRES", alias: "Recorded acreage", type: "double" },
  { name: "location_id", alias: "Location ID", type: "integer" },
  { name: "FIRE_NAME", alias: "Fire name", type: "string" },
  { name: "IGNITION_DATE", type: "date" },
];
const records = [
  { attributes: { OBJECTID: 1, YEAR_: 2000, GIS_ACRES: 12, FIRE_NAME: "Alpha" } },
  { attributes: { OBJECTID: 2, YEAR_: 2000, GIS_ACRES: 8, FIRE_NAME: "Beta" } },
  { attributes: { OBJECTID: 3, YEAR_: 2001, GIS_ACRES: 30, FIRE_NAME: "Alpha" } },
  { attributes: { OBJECTID: 4, YEAR_: null, GIS_ACRES: 9, FIRE_NAME: "Gamma" } },
  { attributes: { OBJECTID: 5, YEAR_: 2001, GIS_ACRES: null, FIRE_NAME: "Gamma" } },
];

test("annual sum bars aggregate rows and disclose invalid source values", () => {
  const result = aggregateChart(records, createChartSpec({ type: "bar", dimension: "YEAR_", measure: { field: "GIS_ACRES", aggregation: "sum" } }));
  assert.deepEqual(result.rows.map(({ label, value }) => [label, value]), [["2000", 20], ["2001", 30]]);
  assert.equal(result.quality.excludedInvalidDimensions, 1);
  assert.equal(result.quality.excludedNullMeasures, 1);
});

test("histograms and scatterplots retain the source records for map-linked selection", () => {
  const histogram = aggregateChart(records, createChartSpec({ type: "histogram", measure: { field: "GIS_ACRES", aggregation: "count" } }));
  assert.equal(histogram.rows.reduce((total, row) => total + row.value, 0), 4);
  assert.equal(histogram.selection(histogram.rows[0]).length > 0, true);
  const scatter = aggregateChart(records, createChartSpec({ type: "scatter", dimension: "YEAR_", measure: { field: "GIS_ACRES", aggregation: "count" } }));
  assert.equal(scatter.rows.length, 3);
  assert.deepEqual(scatter.rows[0].x, 2000);
});

test("recommendations prefer temporal trends and safe project persistence only stores specs", () => {
  const roles = chartFields(fields);
  assert.equal(roles.categoricalFields.some((field) => field.name === "OBJECTID"), false, "record IDs are never suggested as chart categories");
  assert.equal(roles.temporalFields.some((field) => field.name === "OBJECTID"), false, "record IDs are never suggested as chart time axes");
  assert.equal(roles.numericFields.some((field) => field.name === "location_id"), false, "identifier fields are never suggested as chart measures");
  const recommendations = recommendCharts(fields);
  assert.equal(recommendations[0].type, "line");
  assert.equal(recommendations[0].dimension, "IGNITION_DATE");
  const charts = normalizeCharts([{ type: "donut", layerId: "fires", dimension: "FIRE_NAME", measure: { aggregation: "count" }, result: { rawRecords: records } }]);
  assert.equal(charts.length, 1);
  assert.equal(charts[0].source.layerId, "fires");
  assert.equal(charts[0].result, undefined);
  assert.deepEqual(charts[0].presentation.targets, ["panel"]);
});

test("chart families provide data-aware starters and retain multi-destination definitions", () => {
  const bars = recommendCharts(fields, { family: "bar-column" });
  assert.equal(bars.some((item) => item.type === "bar"), true);
  const scatter = recommendCharts(fields, { family: "scatter-bubble" });
  assert.equal(scatter.some((item) => item.type === "scatter"), false, "one usable numeric value should not invent a scatterplot");
  const mapGallery = recommendCharts(fields, { family: "map" });
  assert.equal(mapGallery.some((item) => item.preset === "map-donut"), true);
  assert.equal(mapGallery.every((item) => item.target === "map" && item.renderMode === "svg"), true);
  const map = createChartSpec({ chartType: "donut", data: { layerId: "fires", groupBy: "FIRE_NAME", series: [{ field: "GIS_ACRES", aggregation: "sum" }] }, presentation: { target: "map", targets: ["map", "dashboard"], renderMode: "svg", anchor: "polygon-interior", collision: "cluster", display: "progressive" } });
  assert.equal(map.type, "donut");
  assert.equal(map.chartType, "donut");
  assert.equal(map.data.groupBy, "FIRE_NAME");
  assert.deepEqual(map.presentation.targets, ["map", "dashboard"]);
  assert.equal(map.presentation.anchor, "polygon-interior");
  const threeD = recommendCharts([...fields, { name: "TEMPERATURE", type: "double" }], { family: "3d" });
  assert.equal(threeD.some((item) => item.type === "bar3d"), true);
  assert.equal(threeD.some((item) => item.type === "scatter3d"), true);
});

test("large categorical previews retain the most material values and an Other bucket", () => {
  const many = Array.from({ length: 24 }, (_, index) => ({ attributes: { CATEGORY: `Category ${index + 1}`, VALUE: index + 1 } }));
  const result = aggregateChart(many, createChartSpec({ type: "bar", dimension: "CATEGORY", measure: { field: "VALUE", aggregation: "sum" } }));
  const display = displayChartRows(result);
  assert.equal(display.length, 16);
  assert.match(display.at(-1).label, /^Other \(9\)$/);
  assert.equal(display.at(-1).records.length, 9);
});

test("chart style chooses the top N, hides Other, and leaves out chosen categories", () => {
  const many = Array.from({ length: 24 }, (_, index) => ({ attributes: { CATEGORY: `Category ${index + 1}`, VALUE: index + 1 } }));
  const spec = (style) => createChartSpec({ type: "bar", dimension: "CATEGORY", measure: { field: "VALUE", aggregation: "sum" }, style });
  const rows = (style) => displayChartRows(aggregateChart(many, spec(style)));
  // Ranked largest first, so the chart reads down from the leader.
  assert.deepEqual(rows({ topN: 5 }).map((row) => row.label), ["Category 24", "Category 23", "Category 22", "Category 21", "Other (20)"]);
  assert.equal(rows({ topN: 5 }).at(-1).other, true);
  assert.deepEqual(rows({ topN: 3, other: "hide" }).map((row) => row.label), ["Category 24", "Category 23", "Category 22"]);
  assert.equal(rows({ topN: 0 }).length, 24);
  assert.deepEqual(rows({ topN: 3, other: "hide", hidden: ["Category 24"] }).map((row) => row.label), ["Category 23", "Category 22", "Category 21"]);
  const result = aggregateChart(many, spec({ hidden: ["Category 1"] }));
  assert.equal(chartCategories(result).length, 24, "every category stays listed so it can be shown again");
  assert.equal(chartSummary(result).total, 300);
  assert.equal(chartSummary(result).top.label, "Category 24");
  assert.equal(createChartSpec({ style: { topN: "abc", other: "nope", theme: "x" } }).style.other, "group");
});

test("year-like categories keep their order instead of ranking", () => {
  const records = [2021, 2019, 2020].map((year, index) => ({ attributes: { YEAR: year, VALUE: [5, 50, 10][index] } }));
  const rows = displayChartRows(aggregateChart(records, createChartSpec({ type: "column", dimension: "YEAR", measure: { field: "VALUE", aggregation: "sum" } })));
  assert.deepEqual(rows.map((row) => row.label), ["2019", "2020", "2021"]);
});

test("chart colours follow the layer's map style", () => {
  const records = [["Park", 3], ["River", 9], ["Road", 1]].map(([TYPE, VALUE]) => ({ attributes: { TYPE, VALUE } }));
  const result = aggregateChart(records, createChartSpec({ type: "bar", dimension: "TYPE", measure: { field: "VALUE", aggregation: "sum" } }));
  const rows = displayChartRows(result);
  // Service WebMap JSON (0–255 alpha) and GISMap's autocast form both read.
  const webMap = { type: "uniqueValue", field1: "TYPE", uniqueValueInfos: [{ value: "Park", symbol: { type: "esriSFS", color: [0, 128, 0, 255] } }, { value: "River", symbol: { type: "esriSFS", color: [0, 0, 255, 255] } }], defaultSymbol: { type: "esriSFS", color: [200, 200, 200, 255] } };
  const categories = chartColors(result, rows, { renderer: webMap });
  assert.equal(categories.source, "map");
  assert.deepEqual(categories.colors, ["rgba(0,0,255,1)", "rgba(0,128,0,1)", "rgba(200,200,200,1)"]);
  const simple = chartColors(result, rows, { renderer: { type: "simple", symbol: { type: "polygon-3d", symbolLayers: [{ type: "extrude", material: { color: "#ff6a00" } }] } } });
  assert.deepEqual(simple.colors, ["#ff6a00", "#ff6a00", "#ff6a00"]);
  const ramp = chartColors(result, rows, { renderer: { type: "class-breaks", field: "VALUE", classBreakInfos: [{ minValue: 0, maxValue: 5, symbol: { type: "simple-fill", color: "#ffffff" } }, { minValue: 5, maxValue: 10, symbol: { type: "simple-fill", color: "#000000" } }] } });
  assert.equal(ramp.colors[0], "#000000", "the largest value takes the dark end of the ramp");
  assert.equal(ramp.colors.at(-1), "#ffffff");
  assert.equal(chartSymbology(null).kind, "none");
  const neon = chartColors({ ...result, chart: createChartSpec({ ...result.chart, style: { palette: "neon" } }) }, rows);
  assert.equal(neon.source, "neon");
});

test("the futuristic look draws glowing gradient marks and follows console skins", () => {
  const records = [["A", 3], ["B", 9]].map(([TYPE, VALUE]) => ({ attributes: { TYPE, VALUE } }));
  const result = aggregateChart(records, createChartSpec({ type: "bar", dimension: "TYPE", measure: { field: "VALUE", aggregation: "sum" } }));
  const option = chartOption(result, { theme: "futuristic", colors: ["#22d3ee", "#a78bfa"] });
  assert.equal(option.series[0].data[0].itemStyle.color.type, "linear");
  assert.ok(option.series[0].data[0].itemStyle.shadowBlur > 0);
  assert.equal(option.yAxis.inverse, true);
  assert.equal(option.grid.containLabel, true, "labels never overlap the plot");
  assert.equal(resolveChartTheme(result.chart, "violet-circuit"), "futuristic");
  assert.equal(resolveChartTheme(result.chart, "gismap"), "standard");
  assert.equal(resolveChartTheme(createChartSpec({ style: { theme: "futuristic" } }), "gismap"), "futuristic");
});

test("Map Charts primitives keep anchors, SVG glyphs, and collision plans engine-neutral", () => {
  assert.deepEqual(mapChartAnchor({ type: "Point", coordinates: [-122.4, 37.8] }), [-122.4, 37.8]);
  assert.deepEqual(mapChartAnchor({ type: "LineString", coordinates: [[0, 0], [10, 0]] }), [5, 0]);
  assert.deepEqual(mapChartAnchor({ type: "Polygon", coordinates: [[[0, 0], [4, 0], [4, 4], [0, 4], [0, 0]]] }), [1.6, 1.6]);
  assert.match(renderMapChartSvg({ mark: "donut", values: [2, 3], label: "A donut" }), /<svg/);
  const policy = normalizeMapChartPresentation({ collision: "hide-overlap", maxVisible: 1 });
  const plan = planMapChartDisplay([{ id: "ordinary", screen: { x: 0, y: 0, width: 12, height: 12 } }, { id: "selected", selected: true, screen: { x: 2, y: 2, width: 12, height: 12 } }], policy);
  assert.equal(plan.visible[0].id, "selected");
  assert.equal(plan.hidden[0].reason, "budget");
  const cluster = planMapChartDisplay([{ id: "one", screen: { x: 0, y: 0, width: 12, height: 12 } }, { id: "two", screen: { x: 2, y: 2, width: 12, height: 12 } }], { collision: "cluster", maxVisible: 4 });
  assert.equal(cluster.hidden[0].reason, "cluster");
});

test("chart data exports a compact, quoted CSV", () => {
  const result = aggregateChart(records, createChartSpec({ type: "bar", dimension: "FIRE_NAME", measure: { aggregation: "count" } }));
  assert.match(rowsAsCsv(result), /^"category","value","record_count"/);
  assert.match(rowsAsCsv(result), /"Alpha","2","2"/);
});

test("chart marks create portable map filters for categories and value ranges", () => {
  const category = aggregateChart(records, createChartSpec({ type: "donut", dimension: "FIRE_NAME", measure: { aggregation: "count" } }));
  category.layer = { objectIdField: "OBJECTID" };
  const alpha = chartFilterForRow(category, category.rows.find((row) => row.label === "Alpha"));
  assert.equal(alpha.kind, "category");
  assert.equal(alpha.where, '"FIRE_NAME" IN (\'Alpha\')');
  const histogram = aggregateChart(records, createChartSpec({ type: "histogram", measure: { field: "GIS_ACRES", aggregation: "count" } }));
  histogram.layer = { objectIdField: "OBJECTID" };
  const range = chartFilterForRow(histogram, histogram.rows[0]);
  assert.equal(range.kind, "range");
  assert.match(range.where, /^"GIS_ACRES" >= /);
  assert.match(range.where, / <= /);
});

test("chart-specific filters persist and combine with current layer filters", async () => {
  const spec = createChartSpec({
    layerId: "fires",
    dimension: "FIRE_NAME",
    measure: { aggregation: "count" },
    source: { scope: "filtered", where: "GIS_ACRES >= 10", filter: { conditions: [{ field: "GIS_ACRES", op: "gte", value: "10" }], logic: "and" } },
  });
  assert.deepEqual(spec.source.filter, { conditions: [{ field: "GIS_ACRES", op: "gte", value: "10" }], logic: "and" });
  assert.equal(spec.source.where, "GIS_ACRES >= 10");
  const calls = [];
  const mapController = {
    loadLayer: async () => ({ uid: "fires", queryable: true, objectIdField: "OBJECTID", fields }),
    queryFeatures: async (uid, params, options) => {
      calls.push({ uid, params, options });
      return { features: records, exceededTransferLimit: false };
    },
  };
  await queryChart(mapController, { uid: "fires", queryable: true }, spec);
  assert.equal(calls[0].params.where, "GIS_ACRES >= 10");
  assert.equal(calls[0].options.layerDefaults, true, "filtered scope retains the layer definition expression");
  await queryChart(mapController, { uid: "fires", queryable: true }, createChartSpec({ ...spec, source: { ...spec.source, scope: "all" } }));
  assert.equal(calls[1].params.where, "GIS_ACRES >= 10");
  assert.equal(calls[1].options.layerDefaults, false, "all-records scope explicitly omits the layer definition expression");
});

test("Chart Tools has dedicated family actions which share one persisted builder", () => {
  const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const ui = fs.readFileSync(new URL("../js/ui.js", import.meta.url), "utf8");
  const css = fs.readFileSync(new URL("../css/app.css", import.meta.url), "utf8");
  const project = fs.readFileSync(new URL("../js/project.js", import.meta.url), "utf8");
  for (const action of ["tools-chart-line-area", "tools-chart-bar-column", "tools-chart-scatter-bubble", "tools-chart-distribution-composition", "tools-chart-3d", "tools-chart-map", "tools-chart-custom"]) assert.match(html, new RegExp(`data-action="${action}"`));
  assert.ok(html.indexOf('<span class="menu__label">Chart tools</span>') > html.indexOf('<span class="menu__label">Servers</span>'), "Chart Tools stays in the lower part of the Tools menu");
  assert.doesNotMatch(html, /data-action="tools-charts-analytics">Charts &amp; Analytics/);
  assert.match(ui, /case "tools-chart-line-area":[\s\S]*?#openChartsAnalytics\(\{ family: "line-area" \}\)/);
  assert.match(ui, /chart-builder__gallery/);
  assert.match(ui, /data-chart-target/);
  assert.match(ui, /Chart panel on this site/);
  assert.match(ui, /Add chart panel to site/);
  assert.match(ui, /Filter chart data/);
  assert.match(ui, /data-chart-filter-builder/);
  assert.match(ui, /Chart panel placement/);
  assert.match(ui, /Top overlay \(movable\)/);
  assert.match(ui, /Chart panel settings/);
  assert.match(ui, /gismap:chart-panel-settings/);
  assert.match(ui, /targets\.some\(\(target\) => \["panel", "dashboard"\]\.includes\(target\)\)/, "The Chart panel destination creates a visible site panel.");
  assert.match(css, /\.chart-builder \{ container-type:inline-size;[\s\S]*?min-width:0/);
  assert.match(css, /@container \(max-width: 560px\)/);
  assert.match(css, /\.app-dialog:has\(\.chart-builder\)[\s\S]*?overflow-x:hidden/);
  assert.match(css, /\.chart-builder__filter/);
  assert.match(project, /setCharts\(charts\)/);
});

test("Chart Tools guides an empty workspace to data instead of showing a warning", () => {
  const ui = fs.readFileSync(new URL("../js/ui.js", import.meta.url), "utf8");
  const css = fs.readFileSync(new URL("../css/app.css", import.meta.url), "utf8");
  assert.match(ui, /#openChartDataStarter\(\{ family \}\)/);
  assert.doesNotMatch(ui, /this\.error\("Add a queryable feature layer before creating a chart\."\)/);
  for (const source of ["tutorial", "popular", "arcgis", "geo-url", "local", "example"]) assert.match(ui, new RegExp(`data-chart-data-start="${source}"`));
  assert.match(ui, /chartExampleFeatureCollection/);
  assert.match(ui, /new File\(\[JSON\.stringify\(chartExampleFeatureCollection\(\)\)/);
  assert.match(ui, /#serviceDialog\("arcgis-auto", reopenBuilder\)/);
  assert.match(ui, /#popularDataDialog\(reopenBuilder\)/);
  assert.match(css, /\.chart-data-starter__grid/);
  assert.match(css, /@media \(max-width: 420px\) \{ \.chart-data-starter__grid \{ grid-template-columns:1fr; \}/);
});

test("saved charts stay inside standard panels and retain the active skin", () => {
  const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const ui = fs.readFileSync(new URL("../js/ui.js", import.meta.url), "utf8");
  const runtime = fs.readFileSync(new URL("../js/application-runtime.js", import.meta.url), "utf8");
  const css = fs.readFileSync(new URL("../css/app.css", import.meta.url), "utf8");
  assert.match(ui, /skin: document\.documentElement\.dataset\.skin \|\| this\.projectManager\.current\.presentation\?\.skin/);
  assert.match(runtime, /application\.chart\.create[\s\S]*?const activeSkin = String\(input\.skin \|\| this\.document\.documentElement\.dataset\.skin/);
  assert.match(runtime, /new ResizeObserver\(\(\) => \{ fit\(\); chartInstance\?\.resize\?\.\(\); \}\)/);
  assert.match(runtime, /region: input\.region \|\| "right"/);
  assert.match(runtime, /input\.size \? \{ size: input\.size \}/);
  assert.match(runtime, /chartFilterForRow\(result, row\)/);
  assert.match(runtime, /data-dashboard-chart-clear>Show all map data/);
  assert.match(runtime, /plot\.querySelectorAll\("\[data-chart-row\]"\)/);
  assert.match(css, /\.application-panel\[data-panel-type="charts"\] \.application-panel__body \{ overflow-x:hidden; \}/);
  // The chart fills its panel: resizing the panel resizes the chart.
  assert.match(css, /\.chart-dashboard \.chart-builder__canvas \{ width:100%; height:100%;/);
  assert.doesNotMatch(css, /\.chart-dashboard \.chart-builder__canvas \{[^}]*max-height/);
  assert.match(css, /\.application-panel__settings/);
  assert.doesNotMatch(html, /dashboard-settings-open/);
});

test("a chart added to the ordinary workspace leaves the sidebar panels as they were", () => {
  const runtime = fs.readFileSync(new URL("../js/application-runtime.js", import.meta.url), "utf8");
  assert.match(runtime, /if \(!this\.currentConfig && id !== "application\.preset\.apply"\) \{\s*current\.layout\.sidebar = "workspace";\s*current\.panels = current\.panels\.filter\(\(panel\) => !STATIC_PANELS\[panel\.type\]\);/);
  assert.match(runtime, /config\.layout\?\.sidebar !== "workspace"/);
});

test("hovering a chart mark lights up its group and a click frames it", () => {
  const runtime = fs.readFileSync(new URL("../js/application-runtime.js", import.meta.url), "utf8");
  const maplibre = fs.readFileSync(new URL("../js/engines/maplibre/maplibre-engine.js", import.meta.url), "utf8");
  const arcgis = fs.readFileSync(new URL("../js/engines/arcgis/arcgis-engine.js", import.meta.url), "utf8");
  assert.match(runtime, /chartInstance\.on\("mouseover", \(event\) => lightUp\(displayRows\[event\.dataIndex\]\)\)/);
  assert.match(runtime, /chartInstance\.on\("globalout", restoreHighlight\)/);
  assert.match(runtime, /this\.mapController\.goToFeatures\(located/);
  assert.match(maplibre, /this\.highlight\.feature = parts\.map/);
  assert.match(arcgis, /const target = groupIds\.length \? groupIds/);
});

test("right-side chart panels use the expandable Workspace utility pane", () => {
  const runtime = fs.readFileSync(new URL("../js/application-runtime.js", import.meta.url), "utf8");
  const layout = fs.readFileSync(new URL("../js/layout-manager.js", import.meta.url), "utf8");
  const ui = fs.readFileSync(new URL("../js/ui.js", import.meta.url), "utf8");
  const css = fs.readFileSync(new URL("../css/app.css", import.meta.url), "utf8");
  assert.match(runtime, /workspace: documentRef\.querySelector\('\[data-utility-pane="workspace"\]'\)/);
  assert.match(layout, /panel\.type === "charts" && region === "right" && this\.workspaceHost/);
  assert.match(layout, /application-panel--workspace-chart/);
  assert.match(layout, /gismap:chart-workspace/);
  assert.match(ui, /this\.utilityWorkspaceOpen \|\| this\.chartWorkspaceOpen/);
  assert.match(css, /\.utility-content\[data-utility-pane="workspace"\]:has\(\.application-panel--workspace-chart\)/);
});
