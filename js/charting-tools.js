// Provider-neutral Charting Tools model. Chart configurations belong to
// GISMap Online; ECharts is only the lazy-loaded renderer for a configuration.

import { fieldKind, featureFilterFor } from "./presentation-query.js";
// Pure renderer-JSON readers (no SDK), shared with the map legend so a chart's
// colours are the colours the legend shows.
import { rendererValue, symbolColor, symbolPaint } from "./engines/maplibre/arcgis-renderer.js?v=0.42.0";

export const CHART_SCHEMA_VERSION = 1;
export const ECHARTS_URL = "https://cdn.jsdelivr.net/npm/echarts@5.5.1/dist/echarts.min.js";
export const PRESENTATION_TARGETS = Object.freeze(["panel", "dashboard", "map", "brief"]);
export const CHART_PANEL_PLACEMENTS = Object.freeze(["left", "right", "bottom", "floating-top"]);
export const CHART_FAMILIES = Object.freeze([
  { id: "line-area", label: "Line & Area" },
  { id: "bar-column", label: "Bar & Column" },
  { id: "scatter-bubble", label: "Scatter & Bubble" },
  { id: "distribution-composition", label: "Distribution & Composition" },
  { id: "3d", label: "3D Charts" },
  { id: "map", label: "Map Charts" },
  { id: "custom", label: "Custom Chart Builder" },
]);
export const CHART_TYPES = Object.freeze([
  { id: "bar", label: "Bar chart", dimension: true, measure: true },
  { id: "column", label: "Column chart", dimension: true, measure: true },
  { id: "line", label: "Line chart", dimension: true, measure: true },
  { id: "area", label: "Area chart", dimension: true, measure: true },
  { id: "histogram", label: "Histogram", dimension: false, measure: true },
  { id: "scatter", label: "Scatterplot", dimension: true, measure: true },
  { id: "bubble", label: "Bubble chart", dimension: true, measure: true },
  { id: "boxplot", label: "Box plot", dimension: true, measure: true },
  { id: "donut", label: "Donut chart", dimension: true, measure: true },
  { id: "kpi", label: "Metric card", dimension: false, measure: true },
  { id: "bar3d", label: "3D bar chart", dimension: true, measure: true },
  { id: "scatter3d", label: "3D scatterplot", dimension: true, measure: true },
]);
export const AGGREGATIONS = Object.freeze(["count", "sum", "avg", "min", "max"]);
// "inherit" follows the layer's map style; "theme" the interface skin; "neon"
// the futuristic dashboard palette.
export const CHART_PALETTES = Object.freeze(["inherit", "theme", "neon"]);
// "auto" draws the futuristic look under the console-style dark skins.
export const CHART_THEMES = Object.freeze(["auto", "standard", "futuristic"]);
export const FUTURISTIC_SKINS = Object.freeze(["violet-circuit", "velvet-orbit", "wavelength"]);
// Categories beyond the top N are grouped as one "Other" mark, or left out.
export const CHART_OTHER_MODES = Object.freeze(["group", "hide"]);
export const CHART_SORTS = Object.freeze(["auto", "value", "label"]);
export const THEME_PALETTE = Object.freeze(["#1b7f6a", "#e0ad35", "#2f7f9d", "#b23f62", "#667085", "#728b3f", "#8054a0", "#bf6545"]);
export const NEON_PALETTE = Object.freeze(["#22d3ee", "#a78bfa", "#f472b6", "#34d399", "#facc15", "#60a5fa", "#fb7185", "#c084fc"]);
const OTHER_COLOR = "#8b9590";
export const CHART_DEFAULT_TOP = Object.freeze({ bar: 16, column: 12, donut: 8, bar3d: 12, boxplot: 16 });

const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const id = () => globalThis.crypto?.randomUUID?.() || `chart-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const numeric = (value) => value !== "" && value != null && Number.isFinite(Number(value)) ? Number(value) : null;
const label = (value) => value == null || value === "" ? "(No value)" : String(value);
const allowed = (value, values, fallback) => values.includes(value) ? value : fallback;
const unique = (values) => [...new Set(values)];
const normalizeFilter = (value) => {
  const conditions = Array.isArray(value?.conditions) ? value.conditions.slice(0, 10).flatMap((condition) => {
    if (!condition || typeof condition !== "object" || !String(condition.field || "").trim() || !String(condition.op || "").trim()) return [];
    return [{
      field: String(condition.field).slice(0, 160),
      op: String(condition.op).slice(0, 40),
      ...(condition.value != null ? { value: String(condition.value).slice(0, 512) } : {}),
      ...(condition.value2 != null ? { value2: String(condition.value2).slice(0, 512) } : {}),
    }];
  }) : [];
  return conditions.length ? { conditions, logic: value?.logic === "or" ? "or" : "and" } : null;
};
// Object IDs identify records; they are never meaningful default chart axes or
// groupings, even when an adapter reports an OID as a text-like field.
const objectIdField = (field = {}) => /(?:^|[_\s-])(?:object[_\s-]?id|oid|fid|global[_\s-]?id)(?:$|[_\s-])/i.test(String(field.name || "")) || /(?:^|[^a-z])oid(?:$|[^a-z])/i.test(String(field.type || ""));

export function chartFields(fields = []) {
  const usable = fields.filter((field) => field?.name);
  const analysisFields = usable.filter((field) => !objectIdField(field));
  // IDs and temporal keys can be numeric but are not meaningful default sums.
  const numericFields = analysisFields.filter((field) => fieldKind(field) === "number" && !/(?:^|[_\s-])(year|date|time|id|identifier|code)(?:$|[_\s-])/i.test(`${field.name} ${field.alias || ""}`));
  // Real date metadata is unambiguous and is preferred over a YEAR-like
  // numeric field. YEAR remains a suggestion, never an implicit conversion.
  const dated = analysisFields.filter((field) => fieldKind(field) === "date");
  const namedTemporal = analysisFields.filter((field) => fieldKind(field) !== "date" && /(?:^|[_\s-])(year|date|time|month|day)(?:$|[_\s-])/i.test(`${field.name} ${field.alias || ""}`));
  const temporalFields = unique([...dated, ...namedTemporal].map((field) => field.name)).map((name) => analysisFields.find((field) => field.name === name));
  const categoricalFields = analysisFields.filter((field) => fieldKind(field) === "text" || fieldKind(field) === "boolean");
  return { usable, analysisFields, numericFields, temporalFields, categoricalFields };
}

export function recommendCharts(fields = [], { family = "all" } = {}) {
  const { numericFields, temporalFields, categoricalFields } = chartFields(fields);
  const numeric = numericFields[0]?.name || null;
  const secondNumeric = numericFields[1]?.name || null;
  const temporal = temporalFields[0]?.name || null;
  const category = categoricalFields[0]?.name || null;
  const recommendations = [];
  const add = (item, families) => { if (family === "all" || family === "custom" || families.includes(family)) recommendations.push(item); };
  if (temporal && numeric) {
    add({ preset: "trend-line", type: "line", dimension: temporal, measure: numeric, aggregation: "sum", label: "Trend over time", description: "A time-based trend from the first temporal and numeric fields." }, ["line-area"]);
    add({ preset: "cumulative-area", type: "area", dimension: temporal, measure: numeric, aggregation: "sum", label: "Cumulative area", description: "A filled trend for change over time." }, ["line-area"]);
  }
  if (category && numeric) {
    const categoryLabel = categoricalFields[0]?.alias || category;
    const measureLabel = numericFields[0]?.alias || numeric;
    add({ preset: "category-bar", type: "bar", dimension: category, measure: numeric, aggregation: "sum", label: `${measureLabel} by ${categoryLabel}`, description: "A horizontal comparison of category totals." }, ["bar-column"]);
    add({ preset: "category-column", type: "column", dimension: category, measure: numeric, aggregation: "sum", label: `${measureLabel} by ${categoryLabel}`, description: "A vertical category comparison." }, ["bar-column"]);
    add({ preset: "boxplot", type: "boxplot", dimension: category, measure: numeric, aggregation: "avg", label: "Distribution by category", description: "Quartiles and outliers for each category." }, ["distribution-composition"]);
  }
  if (numeric) add({ preset: "histogram", type: "histogram", dimension: null, measure: numeric, aggregation: "count", label: "Value distribution", description: "A binned distribution of a numeric field." }, ["distribution-composition"]);
  if (category) add({ preset: "donut", type: "donut", dimension: category, measure: null, aggregation: "count", label: "Category composition", description: "A share-of-total view." }, ["distribution-composition"]);
  if (numeric && secondNumeric) {
    add({ preset: "scatter", type: "scatter", dimension: numeric, measure: secondNumeric, aggregation: "count", label: "Numeric relationship", description: "Compare two numeric fields feature by feature." }, ["scatter-bubble"]);
    add({ preset: "bubble", type: "bubble", dimension: numeric, measure: secondNumeric, size: numericFields[2]?.name || null, aggregation: "count", label: "Bubble comparison", description: "A relationship with bubble size as a third measure." }, ["scatter-bubble"]);
    add({ preset: "scatter-3d", type: "scatter3d", dimension: numeric, measure: secondNumeric, size: numericFields[2]?.name || numeric, aggregation: "count", label: "3D numeric relationship", description: "A conventional three-axis scatter plot in the chart panel." }, ["3d"]);
  }
  if (category && numeric) add({ preset: "bar-3d", type: "bar3d", dimension: category, measure: numeric, aggregation: "sum", label: "3D category comparison", description: "A conventional isometric bar chart; it is not a geographic extrusion." }, ["3d"]);
  if (numeric) add({ preset: "metric", type: "kpi", dimension: null, measure: numeric, aggregation: "sum", label: "Total metric", description: "One headline value." }, ["custom"]);
  if (family === "map") {
    if (category && numeric) recommendations.push({ preset: "map-bars", type: "bar", dimension: category, measure: numeric, aggregation: "sum", label: "Map mini bars", description: "Compact SVG bars, ready for geographic feature anchors.", target: "map", renderMode: "svg" });
    if (temporal && numeric) recommendations.push({ preset: "map-sparkline", type: "line", dimension: temporal, measure: numeric, aggregation: "sum", label: "Map sparklines", description: "Compact SVG trends, ready for geographic feature anchors.", target: "map", renderMode: "svg" });
    if (category) recommendations.push({ preset: "map-donut", type: "donut", dimension: category, measure: numeric, aggregation: numeric ? "sum" : "count", label: "Map donuts", description: "Compact geographic donuts, ready for feature anchors.", target: "map", renderMode: "svg" });
  }
  if (family === "map") return recommendations.map((item) => ({ ...item, target: "map", renderMode: "svg" }));
  return recommendations;
}

export function createChartSpec(input = {}) {
  const type = CHART_TYPES.some((entry) => entry.id === (input.type || input.chartType)) ? (input.type || input.chartType) : "bar";
  const aggregation = AGGREGATIONS.includes(input.measure?.aggregation || input.aggregation) ? (input.measure?.aggregation || input.aggregation) : "count";
  const target = allowed(input.presentation?.target || input.target, PRESENTATION_TARGETS, "panel");
  const targets = unique([...(Array.isArray(input.presentation?.targets) ? input.presentation.targets : Array.isArray(input.targets) ? input.targets : []), target]).filter((item) => PRESENTATION_TARGETS.includes(item));
  const source = input.source || input.data || {};
  const filter = normalizeFilter(source.filter || input.filter);
  const where = typeof source.where === "string" && source.where.trim() ? source.where.trim().slice(0, 4000) : null;
  const dimensionInput = input.dimension?.field || input.dimension || source.groupBy || null;
  const measureInput = input.measure?.field ?? input.measureField ?? input.data?.series?.[0]?.field ?? null;
  const sizeField = input.encoding?.sizeField || input.size?.field || input.size || null;
  const mapFields = unique((Array.isArray(input.encoding?.mapFields) ? input.encoding.mapFields : Array.isArray(input.mapFields) ? input.mapFields : []).filter((field) => typeof field === "string" && field));
  return {
    schemaVersion: CHART_SCHEMA_VERSION,
    id: input.id || id(),
    title: String(input.title || "Untitled chart").slice(0, 160),
    type,
    // chartType/data are aliases for the portable contract; type/source remain
    // for existing dashboard panels and saved projects.
    chartType: type,
    preset: typeof input.preset === "string" ? input.preset.slice(0, 80) : null,
    source: { layerId: source.layerId || input.layerId || null, scope: ["all", "filtered", "viewport", "selected"].includes(source.scope || input.scope) ? (source.scope || input.scope) : "filtered", ...(filter ? { filter } : {}), ...(where ? { where } : {}) },
    data: { layerId: source.layerId || input.layerId || null, scope: ["all", "filtered", "viewport", "selected"].includes(source.scope || input.scope) ? (source.scope || input.scope) : "filtered", groupBy: dimensionInput || null, series: [{ field: measureInput, aggregation }] },
    dimension: dimensionInput ? { field: dimensionInput, interpretation: input.dimension?.interpretation || (input.preset?.includes("trend") ? "temporal" : "category") } : null,
    measure: { field: measureInput, aggregation },
    encoding: { ...(sizeField ? { sizeField: String(sizeField) } : {}), ...(mapFields.length ? { mapFields } : {}) },
    presentation: {
      target,
      targets: targets.length ? targets : ["panel"],
      renderMode: allowed(input.presentation?.renderMode || input.renderMode, ["standard", "svg", "html", "engine-3d"], "standard"),
      size: allowed(input.presentation?.size || input.size, ["compact", "regular", "expanded"], "regular"),
      anchor: allowed(input.presentation?.anchor || input.anchor, ["point", "line-midpoint", "polygon-interior", "polygon-centroid", "feature"], "feature"),
      collision: allowed(input.presentation?.collision || input.collision, ["hide-overlap", "cluster", "reposition"], "hide-overlap"),
      display: allowed(input.presentation?.display || input.display, ["all", "progressive", "clustered"], "progressive"),
      placement: allowed(input.presentation?.placement || input.placement, CHART_PANEL_PLACEMENTS, "right"),
      minZoom: Number.isFinite(Number(input.presentation?.minZoom)) ? Number(input.presentation.minZoom) : null,
      maxZoom: Number.isFinite(Number(input.presentation?.maxZoom)) ? Number(input.presentation.maxZoom) : null,
    },
    interaction: { mapHighlight: input.interaction?.mapHighlight !== false, crossFilter: input.interaction?.crossFilter === true },
    style: normalizeChartStyle(input.style),
  };
}

/**
 * Presentation choices that never change the aggregate: colours, look, how
 * many categories show, what happens to the rest, and categories left out.
 * topN null is the chart type's default; 0 shows every category.
 */
export function normalizeChartStyle(style = {}) {
  const top = style?.topN == null || style.topN === "" ? null : Math.round(Number(style.topN));
  return {
    palette: allowed(style?.palette, CHART_PALETTES, "inherit"),
    legend: style?.legend !== false,
    stacked: style?.stacked === true,
    theme: allowed(style?.theme, CHART_THEMES, "auto"),
    topN: Number.isFinite(top) ? Math.max(0, Math.min(100, top)) : null,
    other: allowed(style?.other, CHART_OTHER_MODES, "group"),
    sort: allowed(style?.sort, CHART_SORTS, "auto"),
    hidden: unique((Array.isArray(style?.hidden) ? style.hidden : []).map((value) => String(value).slice(0, 200))).slice(0, 200),
  };
}

/** The look a chart draws with, given the active interface skin. */
export function resolveChartTheme(chart, skin = "") {
  const theme = chart?.style?.theme || "auto";
  if (theme !== "auto") return theme;
  return FUTURISTIC_SKINS.includes(String(skin)) ? "futuristic" : "standard";
}

export function normalizeCharts(value) {
  return Array.isArray(value) ? value.filter((chart) => chart && typeof chart === "object").slice(0, 60).map(createChartSpec) : [];
}

function aggregateValue(records, field, aggregation) {
  if (aggregation === "count") return records.length;
  const values = records.map((record) => numeric(record.attributes?.[field])).filter((value) => value != null);
  if (!values.length) return null;
  if (aggregation === "sum") return values.reduce((sum, value) => sum + value, 0);
  if (aggregation === "avg") return values.reduce((sum, value) => sum + value, 0) / values.length;
  if (aggregation === "min") return Math.min(...values);
  if (aggregation === "max") return Math.max(...values);
  return null;
}

export function aggregateChart(records = [], spec = {}) {
  const chart = createChartSpec(spec);
  const quality = { status: "complete", processedRecords: records.length, excludedNullMeasures: 0, excludedInvalidDimensions: 0, warning: null };
  const measure = chart.measure.field;
  if (["scatter", "bubble", "scatter3d"].includes(chart.type)) {
    const xField = chart.dimension?.field;
    const sizeField = chart.encoding?.sizeField;
    const points = records.map((record) => ({ x: numeric(record.attributes?.[xField]), y: numeric(record.attributes?.[measure]), size: numeric(record.attributes?.[sizeField]), record })).filter((point) => point.x != null && point.y != null);
    quality.excludedInvalidDimensions = records.length - points.length;
    return { chart, rows: points, quality, selection: (row) => [row.record] };
  }
  if (chart.type === "histogram") {
    const values = records.map((record) => ({ value: numeric(record.attributes?.[measure]), record })).filter((item) => item.value != null);
    quality.excludedNullMeasures = records.length - values.length;
    if (!values.length) return { chart, rows: [], quality, selection: () => [] };
    const min = Math.min(...values.map((item) => item.value)); const max = Math.max(...values.map((item) => item.value)); const bins = 10;
    const width = (max - min || 1) / bins;
    const rows = Array.from({ length: bins }, (_, index) => ({ min: min + index * width, max: index === bins - 1 ? max : min + (index + 1) * width, value: 0, records: [] }));
    values.forEach((item) => { const index = max === min ? 0 : Math.min(bins - 1, Math.floor((item.value - min) / width)); rows[index].value += 1; rows[index].records.push(item.record); });
    return { chart, rows, quality, selection: (row) => row.records };
  }
  if (chart.type === "kpi") {
    const value = aggregateValue(records, measure, chart.measure.aggregation);
    quality.excludedNullMeasures = chart.measure.aggregation === "count" ? 0 : records.length - records.filter((record) => numeric(record.attributes?.[measure]) != null).length;
    return { chart, rows: value == null ? [] : [{ label: chart.measure.aggregation, value, records }], quality, selection: (row) => row.records };
  }
  const dimension = chart.dimension?.field;
  if (!dimension) return { chart, rows: [], quality: { ...quality, warning: "Choose a field to group this chart." }, selection: () => [] };
  const groups = new Map();
  records.forEach((record) => {
    const value = record.attributes?.[dimension];
    if (value == null || value === "") { quality.excludedInvalidDimensions += 1; return; }
    const key = label(value);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(record);
  });
  const percentile = (values, fraction) => {
    if (!values.length) return null;
    const index = (values.length - 1) * fraction;
    const low = Math.floor(index); const high = Math.ceil(index);
    return values[low] + (values[high] - values[low]) * (index - low);
  };
  const rows = [...groups.entries()].map(([key, group]) => {
    if (chart.type === "boxplot") {
      const values = group.map((record) => numeric(record.attributes?.[measure])).filter((value) => value != null).sort((a, b) => a - b);
      return { label: key, value: values.length ? [values[0], percentile(values, .25), percentile(values, .5), percentile(values, .75), values.at(-1)] : null, records: group };
    }
    return { label: key, value: aggregateValue(group, measure, chart.measure.aggregation), records: group };
  }).filter((row) => row.value != null);
  quality.excludedNullMeasures = chart.measure.aggregation === "count" ? 0 : records.length - records.filter((record) => numeric(record.attributes?.[measure]) != null).length;
  rows.sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
  return { chart, rows, quality, selection: (row) => row.records };
}

export async function queryChart(mapController, layer, spec) {
  const chart = createChartSpec(spec);
  if (!layer?.queryable) throw new Error("Choose a queryable feature layer.");
  const loaded = await mapController.loadLayer(layer.uid, { allowTruncated: false });
  const fields = [chart.dimension?.field, chart.measure?.field, chart.encoding?.sizeField, ...(chart.encoding?.mapFields || []), loaded.objectIdField].filter(Boolean);
  // With the filtered scope, the engine combines this chart-only clause with
  // the layer definition expression. "All source records" is the explicit
  // opt-out from the layer filter, but still honors the chart's own filter.
  const params = { where: chart.source.scope === "all" ? chart.source.where || "1=1" : chart.source.where || undefined, outFields: [...new Set(fields)], returnGeometry: chart.interaction.mapHighlight === true };
  if (chart.source.scope === "viewport") params.geometry = "view";
  const response = await mapController.queryFeatures(loaded.uid, params, { layerDefaults: chart.source.scope !== "all" });
  const result = aggregateChart(response.features, chart);
  if (response.exceededTransferLimit) result.quality = { ...result.quality, status: "partial", warning: "The source limited this query. Refine its filter before using this chart." };
  return { ...result, layer: loaded, features: response.features };
}

const CATEGORICAL_TYPES = ["bar", "column", "donut", "bar3d"];
const rowScalar = (row) => Array.isArray(row?.value) ? Number(row.value[2]) || 0 : Number(row?.value ?? row?.y) || 0;
const byLabel = (a, b) => String(a.label).localeCompare(String(b.label), undefined, { numeric: true });

/** Every category the chart could show, before Top N and hidden categories apply. */
export function chartCategories(result) {
  if (!CATEGORICAL_TYPES.includes(result?.chart?.type) && result?.chart?.type !== "boxplot") return [];
  return [...(result?.rows || [])].sort((a, b) => Math.abs(rowScalar(b)) - Math.abs(rowScalar(a)) || byLabel(a, b)).map((row) => ({ label: row.label, value: rowScalar(row), count: row.records?.length || 0 }));
}

/**
 * The rows a chart draws: hidden categories removed, categories ranked (or in
 * label order for years and other ordered values), and those beyond the top N
 * grouped as "Other" or left out, as the chart's style says.
 */
export function displayChartRows(result, { limit = null } = {}) {
  const chart = result?.chart;
  const style = chart?.style || {};
  const type = chart?.type;
  const categorical = CATEGORICAL_TYPES.includes(type) || type === "boxplot";
  const hidden = new Set(categorical ? style.hidden || [] : []);
  let rows = (result?.rows || []).filter((row) => !hidden.has(String(row.label)));
  if (!categorical) return rows;
  // Years and other numeric categories read in order; names read by size.
  const ordered = chart?.dimension?.interpretation === "temporal" || (rows.length && rows.every((row) => Number.isFinite(Number(row.label))));
  const sort = style.sort === "auto" || !style.sort ? (ordered || type === "boxplot" ? "label" : "value") : style.sort;
  const ranked = [...rows].sort((a, b) => Math.abs(rowScalar(b)) - Math.abs(rowScalar(a)) || byLabel(a, b));
  rows = sort === "value" ? ranked : [...rows].sort(byLabel);
  const maximum = limit || (style.topN === 0 ? Infinity : style.topN || CHART_DEFAULT_TOP[type] || Infinity);
  if (rows.length <= maximum || !Number.isFinite(maximum)) return rows;
  const keep = style.other === "hide" ? maximum : Math.max(1, maximum - 1);
  const retained = new Set(ranked.slice(0, keep));
  const remainder = ranked.slice(keep);
  const shown = rows.filter((row) => retained.has(row));
  if (style.other === "hide" || type === "boxplot") return shown;
  return [...shown, { label: `Other (${remainder.length})`, other: true, members: remainder.map((row) => row.label), value: remainder.reduce((total, row) => total + rowScalar(row), 0), records: remainder.flatMap((row) => row.records || []) }];
}

const symbolFill = (symbol) => {
  const paint = symbolPaint(symbol);
  const fill = paint.fill && !/,\s*0\)$/.test(paint.fill) ? paint.fill : null;
  return fill || paint.circle || paint.line || paint.outline || null;
};

/**
 * What a layer's style says about colour, read from its renderer JSON (either
 * the service WebMap form or the autocast form GISMap compiles):
 * { kind: "categories" | "classes" | "single" | "none", field, categories, classes, color, defaultColor }.
 */
export function chartSymbology(renderer) {
  if (!renderer || typeof renderer !== "object") return { kind: "none", field: null };
  const type = String(renderer.type || "");
  const defaultColor = symbolFill(renderer.defaultSymbol);
  const field = rendererValue(renderer).field || renderer.field1 || null;
  if (/^unique-?value$/i.test(type) && field) {
    const categories = new Map();
    for (const info of renderer.uniqueValueInfos || []) {
      const color = symbolFill(info.symbol);
      if (color) categories.set(String(info.value), color);
    }
    return { kind: "categories", field, categories, defaultColor };
  }
  if (/^class-?breaks$/i.test(type) && field) {
    let lower = Number.isFinite(renderer.minValue) ? renderer.minValue : -Infinity;
    const classes = (renderer.classBreakInfos || []).map((info) => {
      const min = Number.isFinite(info.classMinValue) ? info.classMinValue : Number.isFinite(info.minValue) ? info.minValue : lower;
      const max = Number.isFinite(info.classMaxValue) ? info.classMaxValue : info.maxValue;
      lower = max;
      return { min, max, color: symbolFill(info.symbol) };
    }).filter((item) => item.color);
    if (classes.length) return { kind: "classes", field, classes, defaultColor };
  }
  const variable = (renderer.visualVariables || []).find((item) => /^color(Info)?$/.test(item?.type) && item.field && item.stops?.length);
  if (variable) {
    const classes = variable.stops.filter((stop) => Number.isFinite(stop.value)).sort((a, b) => a.value - b.value)
      .map((stop) => ({ min: stop.value, max: stop.value, color: symbolColor(stop.color, { webMap: variable.type === "colorInfo" }) })).filter((item) => item.color);
    if (classes.length) return { kind: "classes", field: variable.field, classes, defaultColor, continuous: true };
  }
  const color = symbolFill(renderer.symbol) || defaultColor;
  return color ? { kind: "single", field: null, color } : { kind: "none", field: null };
}

const parseColor = (value) => {
  const text = String(value || "").trim();
  const hex = text.match(/^#([0-9a-f]{6}|[0-9a-f]{3})(?:[0-9a-f]{2})?$/i)?.[1];
  if (hex) {
    const full = hex.length === 3 ? [...hex].map((digit) => digit + digit).join("") : hex;
    return [0, 2, 4].map((index) => parseInt(full.slice(index, index + 2), 16));
  }
  const rgb = text.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
  return rgb ? rgb.slice(1, 4).map(Number) : null;
};
const toHex = (rgb) => `#${rgb.map((part) => Math.round(Math.max(0, Math.min(255, part))).toString(16).padStart(2, "0")).join("")}`;
const mix = (a, b, amount) => {
  const from = parseColor(a); const to = parseColor(b);
  if (!from || !to) return a || b;
  return toHex(from.map((part, index) => part + (to[index] - part) * amount));
};
/** A colour with an alpha, for gradients and glows. */
export function chartColorAlpha(color, alpha) {
  const rgb = parseColor(color);
  return rgb ? `rgba(${rgb.join(",")},${alpha})` : color;
}
// A position (0–1) along a list of colours.
const along = (colors, position) => {
  if (colors.length === 1) return colors[0];
  const scaled = Math.max(0, Math.min(1, position)) * (colors.length - 1);
  const index = Math.min(colors.length - 2, Math.floor(scaled));
  return mix(colors[index], colors[index + 1], scaled - index);
};
const classColor = (classes, value) => {
  if (!Number.isFinite(value)) return null;
  const found = classes.find((item) => value <= item.max);
  return (found || classes.at(-1)).color;
};

/**
 * One colour per drawn row, and where the colours came from. With the
 * "inherit" palette a chart grouped by the layer's styled field takes the
 * map's own category colours; classed and ramped styles colour each mark
 * along the same ramp; a single-symbol layer draws in its symbol colour.
 * { colors, source: "map" | "theme" | "neon", note }.
 */
export function chartColors(result, rows = displayChartRows(result), { renderer = null, palette = THEME_PALETTE, theme = "standard" } = {}) {
  const chart = result?.chart || {};
  const choice = chart.style?.palette || "inherit";
  const neon = choice === "neon" || (choice === "theme" && theme === "futuristic");
  const base = neon ? NEON_PALETTE : palette;
  const multiple = ["donut"].includes(chart.type);
  const values = rows.map(rowScalar);
  const low = Math.min(...values); const high = Math.max(...values);
  const position = (value) => high === low ? 1 : (value - low) / (high - low);
  const fromPalette = () => {
    if (multiple) return rows.map((row, index) => row.other ? OTHER_COLOR : base[index % base.length]);
    // One series in one hue; the futuristic look shades it from cool to warm by value.
    if (neon) return rows.map((row) => row.other ? OTHER_COLOR : along([NEON_PALETTE[0], NEON_PALETTE[1], NEON_PALETTE[2]], position(rowScalar(row))));
    return rows.map((row) => row.other ? OTHER_COLOR : base[0]);
  };
  if (choice !== "inherit") return { colors: fromPalette(), source: neon ? "neon" : "theme", note: null };
  const symbology = chartSymbology(renderer);
  const dimension = chart.dimension?.field;
  if (symbology.kind === "categories" && dimension && symbology.field === dimension) {
    const colors = rows.map((row, index) => row.other ? (symbology.defaultColor || OTHER_COLOR) : symbology.categories.get(String(row.records?.[0]?.attributes?.[dimension] ?? row.label)) || symbology.categories.get(String(row.label)) || symbology.defaultColor || base[index % base.length]);
    return { colors, source: "map", note: `Colours match the map's ${dimension} categories.` };
  }
  if (symbology.kind === "classes") {
    const ramp = symbology.classes.map((item) => item.color);
    // A histogram of the styled field, or an average of it, sits inside the map's own classes.
    const sameScale = symbology.field === chart.measure?.field && (chart.type === "histogram" || ["avg", "min", "max"].includes(chart.measure?.aggregation));
    const colors = rows.map((row) => {
      if (row.other) return OTHER_COLOR;
      if (sameScale && !symbology.continuous) return classColor(symbology.classes, chart.type === "histogram" ? (Number(row.min) + Number(row.max)) / 2 : rowScalar(row)) || ramp.at(-1);
      return along(ramp, position(rowScalar(row)));
    });
    return { colors, source: "map", note: sameScale ? `Colours use the map's ${symbology.field} classes.` : "Colours follow the map's colour ramp, low to high." };
  }
  if (symbology.kind === "single") {
    const colors = multiple
      ? rows.map((row, index) => row.other ? OTHER_COLOR : mix(symbology.color, index % 2 ? "#000000" : "#ffffff", Math.min(.6, Math.floor((index + 1) / 2) * .16)))
      : rows.map((row) => row.other ? OTHER_COLOR : symbology.color);
    return { colors, source: "map", note: "Colours match the layer's map symbol." };
  }
  return { colors: fromPalette(), source: "theme", note: null };
}

const compact = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value ?? "");
  return Math.abs(number) >= 10000 ? number.toLocaleString(undefined, { notation: "compact", maximumFractionDigits: 1 }) : number.toLocaleString(undefined, { maximumFractionDigits: 2 });
};

/**
 * Headline numbers for a dashboard chart: the total, how many groups, and the
 * leading group with its share. Null for charts without groups.
 */
export function chartSummary(result, rows = displayChartRows(result)) {
  const chart = result?.chart;
  if (!chart || !CATEGORICAL_TYPES.includes(chart.type) || !result.rows?.length) return null;
  const all = result.rows;
  const total = all.reduce((sum, row) => sum + rowScalar(row), 0);
  const top = [...all].sort((a, b) => rowScalar(b) - rowScalar(a))[0];
  const additive = ["sum", "count"].includes(chart.measure?.aggregation);
  return {
    total: additive ? total : null,
    aggregation: chart.measure?.aggregation || "count",
    field: chart.measure?.field || null,
    groups: all.length,
    shown: rows.filter((row) => !row.other).length,
    top: top ? { label: top.label, value: rowScalar(top), share: additive && total ? rowScalar(top) / total : null } : null,
    records: result.quality?.processedRecords ?? null,
  };
}

/**
 * ECharts option for a chart result. `colors` are per-row colours (see
 * chartColors); `tokens` are the interface's CSS colours and font so the chart
 * reads in light, dark and every skin; theme "futuristic" draws glowing
 * gradient marks on a transparent HUD-like grid.
 */
export function chartOption(result, { palette = THEME_PALETTE, rows = displayChartRows(result), colors = null, theme = "standard", tokens = {} } = {}) {
  const { chart } = result;
  // Conventional 3D charts deliberately use the local SVG renderer below.
  // That keeps analytical 3D independent of the geographic engines and avoids
  // making ECharts GL another CDN/runtime requirement.
  if (["kpi", "bar3d", "scatter3d"].includes(chart.type)) return null;
  const futuristic = theme === "futuristic";
  const ink = tokens.ink || (futuristic ? "#e6f6ff" : "#17221f");
  const muted = tokens.muted || (futuristic ? "#8fb3c9" : "#68736e");
  const line = tokens.line || (futuristic ? "rgba(34,211,238,.16)" : "#d9d5c9");
  const surface = tokens.surface || (futuristic ? "#0b1020" : "#fffdf8");
  const font = futuristic ? `"JetBrains Mono", "SFMono-Regular", ui-monospace, Menlo, monospace` : tokens.font || "system-ui, sans-serif";
  const marks = colors || rows.map((row, index) => palette[index % palette.length]);
  const reduced = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  const grid = futuristic ? "rgba(34,211,238,.12)" : chartColorAlpha(line, .7);
  const axisLabel = { color: muted, fontFamily: font, fontSize: 10 };
  const valueAxis = { type: "value", axisLabel: { ...axisLabel, formatter: compact }, splitLine: { lineStyle: { color: grid, type: futuristic ? "dashed" : "solid" } }, axisLine: { show: false }, axisTick: { show: false } };
  const categoryAxis = { axisLabel: { ...axisLabel, color: futuristic ? "#bfe9ff" : ink }, axisLine: { lineStyle: { color: futuristic ? "rgba(34,211,238,.35)" : line } }, axisTick: { show: false } };
  const common = {
    color: marks,
    backgroundColor: "transparent",
    textStyle: { fontFamily: font, color: ink },
    animation: !reduced,
    animationDuration: futuristic ? 1100 : 600,
    animationEasing: "cubicOut",
    tooltip: {
      trigger: chart.type === "donut" ? "item" : "axis",
      axisPointer: { type: "shadow", shadowStyle: { color: futuristic ? "rgba(34,211,238,.08)" : chartColorAlpha(line, .35) } },
      backgroundColor: futuristic ? "rgba(8,14,30,.92)" : surface,
      borderColor: futuristic ? "rgba(34,211,238,.5)" : line,
      textStyle: { color: ink, fontFamily: font, fontSize: 11 },
      extraCssText: futuristic ? "box-shadow:0 0 18px rgba(34,211,238,.35);backdrop-filter:blur(6px);border-radius:4px;" : "border-radius:6px;",
      valueFormatter: (value) => Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 }),
    },
  };
  // A mark's fill: flat in the standard look; a gradient with a soft glow in the futuristic one.
  const fill = (color, horizontal) => futuristic
    ? { color: { type: "linear", x: 0, y: horizontal ? 0 : 1, x2: horizontal ? 1 : 0, y2: 0, colorStops: [{ offset: 0, color: chartColorAlpha(color, .15) }, { offset: 1, color }] }, shadowBlur: 14, shadowColor: chartColorAlpha(color, .55), borderRadius: horizontal ? [0, 2, 2, 0] : [2, 2, 0, 0] }
    : { color, borderRadius: horizontal ? [0, 3, 3, 0] : [3, 3, 0, 0] };
  const emphasis = { focus: "self", itemStyle: { shadowBlur: futuristic ? 24 : 6, shadowColor: futuristic ? "rgba(34,211,238,.8)" : "rgba(0,0,0,.25)" } };
  if (["scatter", "bubble"].includes(chart.type)) return { ...common, grid: { left: 12, right: 18, top: 28, bottom: 12, containLabel: true }, xAxis: { ...valueAxis, name: chart.dimension?.field || "X", nameTextStyle: axisLabel }, yAxis: { ...valueAxis, name: chart.measure.field || "Y", nameTextStyle: axisLabel }, series: [{ type: "scatter", symbolSize: chart.type === "bubble" ? (value) => Math.max(7, Math.min(42, Math.sqrt(Math.abs(Number(value[2]) || 0)) * 2.5 || 10)) : 9, itemStyle: { color: marks[0], opacity: .82, ...(futuristic ? { shadowBlur: 10, shadowColor: chartColorAlpha(marks[0], .7) } : {}) }, emphasis, data: rows.map((row) => chart.type === "bubble" ? [row.x, row.y, row.size] : [row.x, row.y]) }] };
  if (chart.type === "donut") {
    const total = rows.reduce((sum, row) => sum + rowScalar(row), 0);
    return {
      ...common,
      tooltip: { ...common.tooltip, trigger: "item" },
      legend: chart.style?.legend === false ? undefined : { type: "scroll", orient: "vertical", right: 4, top: "middle", itemWidth: 10, itemHeight: 10, icon: futuristic ? "rect" : "circle", textStyle: { color: muted, fontFamily: font, fontSize: 10, width: 120, overflow: "truncate" }, pageTextStyle: { color: muted } },
      title: { text: compact(total), subtext: chart.measure?.aggregation === "count" ? "records" : chart.measure?.field || "", left: "34%", top: "center", textAlign: "center", textStyle: { color: futuristic ? "#e6f6ff" : ink, fontFamily: font, fontSize: 18, fontWeight: 700, textShadowBlur: futuristic ? 12 : 0, textShadowColor: "rgba(34,211,238,.8)" }, subtextStyle: { color: muted, fontFamily: font, fontSize: 10 } },
      series: [{ type: "pie", center: ["35%", "50%"], radius: ["52%", "76%"], padAngle: futuristic ? 2 : 1, itemStyle: { borderRadius: futuristic ? 2 : 4, borderColor: futuristic ? "transparent" : surface, borderWidth: futuristic ? 0 : 2 }, label: { show: false }, emphasis: { scale: true, scaleSize: 6, itemStyle: emphasis.itemStyle }, data: rows.map((row, index) => ({ name: row.label, value: rowScalar(row), itemStyle: { color: marks[index], ...(futuristic ? { shadowBlur: 16, shadowColor: chartColorAlpha(marks[index], .6) } : {}) } })) }],
    };
  }
  if (chart.type === "boxplot") return { ...common, grid: { left: 12, right: 18, top: 22, bottom: 12, containLabel: true }, xAxis: { ...categoryAxis, type: "category", data: rows.map((row) => row.label), axisLabel: { ...categoryAxis.axisLabel, rotate: rows.length > 7 ? 35 : 0, width: 90, overflow: "truncate" } }, yAxis: valueAxis, series: [{ type: "boxplot", itemStyle: { color: chartColorAlpha(marks[0], .25), borderColor: marks[0], borderWidth: 1.5 }, data: rows.map((row) => row.value) }] };
  const categories = rows.map((row) => chart.type === "histogram" ? `${row.min.toLocaleString(undefined, { maximumFractionDigits: 2 })}–${row.max.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : row.label);
  const barData = (horizontal) => rows.map((row, index) => ({ value: row.value, itemStyle: { ...fill(marks[index], horizontal), ...(row.other ? { opacity: .7 } : {}) } }));
  if (chart.type === "bar") {
    return {
      ...common,
      grid: { left: 8, right: 46, top: 6, bottom: 6, containLabel: true },
      xAxis: { ...valueAxis, splitNumber: 4 },
      // Largest first, at the top, so the ranking reads down the chart.
      yAxis: { ...categoryAxis, type: "category", inverse: true, data: categories, axisLabel: { ...categoryAxis.axisLabel, interval: 0, width: 132, overflow: "truncate" }, axisLine: { show: false } },
      series: [{ type: "bar", barMaxWidth: 18, barCategoryGap: "28%", showBackground: futuristic, backgroundStyle: { color: "rgba(34,211,238,.05)", borderRadius: 2 }, label: { show: true, position: "right", color: futuristic ? "#bfe9ff" : muted, fontFamily: font, fontSize: 10, formatter: ({ value }) => compact(value) }, emphasis, data: barData(true) }],
    };
  }
  const type = chart.type === "histogram" || chart.type === "column" ? "bar" : "line";
  const rotate = categories.length > 7 ? 35 : 0;
  const base = { ...common, grid: { left: 8, right: 18, top: 18, bottom: 6, containLabel: true }, xAxis: { ...categoryAxis, type: "category", data: categories, axisLabel: { ...categoryAxis.axisLabel, rotate, interval: "auto", width: rotate ? 80 : 110, overflow: "truncate" } }, yAxis: valueAxis };
  if (type === "bar") return { ...base, series: [{ type: "bar", barMaxWidth: 34, barCategoryGap: chart.type === "histogram" ? "6%" : "30%", emphasis, data: barData(false) }] };
  const color = marks[0];
  return {
    ...base,
    xAxis: { ...base.xAxis, boundaryGap: false },
    series: [{
      type: "line", smooth: futuristic ? .35 : false, showSymbol: rows.length <= 24, symbolSize: 6, data: rows.map((row) => row.value), emphasis,
      lineStyle: { width: futuristic ? 2.5 : 2, color, ...(futuristic ? { shadowBlur: 12, shadowColor: chartColorAlpha(color, .8) } : {}) },
      itemStyle: { color, borderColor: futuristic ? "#e6f6ff" : surface, borderWidth: 1.5 },
      areaStyle: chart.type === "area" || futuristic ? { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: chartColorAlpha(color, chart.type === "area" ? .45 : .22) }, { offset: 1, color: chartColorAlpha(color, 0) }] } } : undefined,
    }],
  };
}

export async function loadECharts(documentRef = document) {
  if (globalThis.echarts) return globalThis.echarts;
  const existing = documentRef.querySelector(`script[data-gismap-echarts]`);
  if (existing) return new Promise((resolve, reject) => { existing.addEventListener("load", () => resolve(globalThis.echarts), { once: true }); existing.addEventListener("error", () => reject(new Error("Chart renderer could not load.")), { once: true }); });
  return new Promise((resolve, reject) => {
    const script = documentRef.createElement("script"); script.src = ECHARTS_URL; script.async = true; script.dataset.gismapEcharts = "true";
    script.addEventListener("load", () => globalThis.echarts ? resolve(globalThis.echarts) : reject(new Error("Chart renderer did not initialize.")), { once: true });
    script.addEventListener("error", () => reject(new Error("Chart renderer could not load.")), { once: true });
    documentRef.head.append(script);
  });
}

function renderThreeDimensionalFallback(chart, rows) {
  const scalar = (row) => Math.max(0, Number(row.value ?? row.z ?? row.y) || 0);
  const max = Math.max(...rows.map(scalar), 1);
  if (chart.type === "scatter3d") {
    const values = rows.slice(0, 80); const x = values.map((row) => Number(row.x) || 0); const y = values.map((row) => Number(row.y) || 0); const z = values.map((row) => Number(row.size) || 0);
    const range = (list) => [Math.min(...list), Math.max(...list)]; const [minX, maxX] = range(x); const [minY, maxY] = range(y); const [minZ, maxZ] = range(z);
    const scale = (value, min, max, size) => max === min ? size / 2 : (value - min) / (max - min) * size;
    return `<div class="chart-3d" aria-label="${escape(chart.title)} three-dimensional scatterplot"><svg viewBox="0 0 520 300" role="img"><path class="chart-3d__axis" d="M68 244 270 282 464 178M68 244 68 54M68 244 198 174"/>${values.map((row, index) => { const px = 68 + scale(Number(row.x) || 0, minX, maxX, 200); const py = 244 - scale(Number(row.y) || 0, minY, maxY, 154) - scale(Number(row.size) || 0, minZ, maxZ, 68); return `<g class="chart-3d__point" data-chart-row="${index}" role="button" tabindex="0" aria-label="${escape(`${row.x}, ${row.y}, ${row.size}`)}"><circle cx="${px}" cy="${py}" r="6" /></g>`; }).join("")}</svg><p>Fixed perspective · X, Y, and Z use the selected numeric fields.</p></div>`;
  }
  const values = rows; const spacing = 390 / Math.max(values.length, 1);
  return `<div class="chart-3d" aria-label="${escape(chart.title)} three-dimensional bar chart"><svg viewBox="0 0 520 300" role="img"><path class="chart-3d__axis" d="M48 252 458 252M48 252 48 46M48 252 140 202"/>${values.map((row, index) => { const height = Math.max(5, scalar(row) / max * 174); const width = Math.max(14, Math.min(28, spacing - 8)); const left = 66 + index * spacing; const top = 252 - height; const depth = Math.min(12, width * .5); return `<g class="chart-3d__column" data-chart-row="${index}" role="button" tabindex="0" aria-label="${escape(`${row.label}: ${row.value}`)}"><path class="chart-3d__bar-side" d="M${left + width} ${top} l${depth} -${depth} v${height} l-${depth} ${depth}z"/><path class="chart-3d__bar-top" d="M${left} ${top} l${depth} -${depth} h${width} l-${depth} ${depth}z"/><rect class="chart-3d__bar" x="${left}" y="${top}" width="${width}" height="${height}" rx="1"/></g>`; }).join("")}</svg><p>Fixed analytical perspective · geographic 3D remains available through Spatial Charts.</p></div>`;
}

export function renderChartFallback(result, { rows = displayChartRows(result), colors = null } = {}) {
  const { chart } = result;
  if (!rows.length) return `<div class="chart-builder__empty"><strong>No chartable values</strong><p>Change the fields or adjust the current layer filter.</p></div>`;
  if (chart.type === "kpi") return `<div class="chart-kpi"><span>${escape(chart.measure.aggregation)}</span><strong>${Number(rows[0].value).toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong></div>`;
  if (["bar3d", "scatter3d"].includes(chart.type)) return renderThreeDimensionalFallback(chart, rows);
  const scalar = (row) => Array.isArray(row.value) ? row.value[2] : Number(row.value ?? row.y) || 0;
  const max = Math.max(...rows.map(scalar), 1);
  const rowLabel = (row) => row.label || (row.min != null ? `${Number(row.min).toLocaleString(undefined, { maximumFractionDigits: 2 })}–${Number(row.max).toLocaleString(undefined, { maximumFractionDigits: 2 })}` : row.x);
  if (chart.type === "bar") return `<div class="chart-fallback chart-fallback--horizontal" aria-label="${escape(chart.title)}">${rows.map((row, index) => `<button type="button" data-chart-row="${index}" title="${escape(rowLabel(row))}: ${Number(row.value ?? row.y).toLocaleString()}"><span>${escape(rowLabel(row))}</span><i style="width:${Math.max(2, scalar(row) / max * 100)}%${colors?.[index] ? `;background:${escape(colors[index])}` : ""}"></i><b>${Number(row.value ?? row.y).toLocaleString(undefined, { maximumFractionDigits: 2 })}</b></button>`).join("")}</div>`;
  return `<div class="chart-fallback" aria-label="${escape(chart.title)}">${rows.map((row, index) => `<button type="button" data-chart-row="${index}" title="${escape(rowLabel(row) || `${row.x}, ${row.y}`)}: ${Array.isArray(row.value) ? row.value[2].toLocaleString() : Number(row.value ?? row.y).toLocaleString()}"><i style="height:${Math.max(4, scalar(row) / max * 100)}%${colors?.[index] ? `;background:${escape(colors[index])}` : ""}"></i><span>${escape(rowLabel(row))}</span></button>`).join("")}</div>`;
}

export function mapSelectionForRows(result, rows) {
  const selected = rows.flatMap((row) => result.selection(row));
  return featureFilterFor(selected, result.features?.length || selected.length, result.layer?.objectIdField);
}

const sqlIdentifier = (value) => `"${String(value || "").replaceAll('"', '""')}"`;
const sqlLiteral = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "1" : "0";
  if (value instanceof Date && Number.isFinite(value.getTime())) return `'${value.toISOString().replaceAll("'", "''")}'`;
  return `'${String(value ?? "").replaceAll("'", "''")}'`;
};

/**
 * Turn one rendered chart mark into a portable map-definition expression.
 * Category marks filter by their source dimension (including an "Other" bucket),
 * while histogram marks retain their numeric range. This avoids relying on
 * renderer-specific selection APIs and works for ArcGIS and MapLibre layers.
 */
export function chartFilterForRow(result, row) {
  const chart = result?.chart;
  if (!chart || !row) return null;
  if (chart.type === "histogram") {
    const field = chart.measure?.field;
    const min = Number(row.min); const max = Number(row.max);
    if (!field || !Number.isFinite(min) || !Number.isFinite(max)) return null;
    return { kind: "range", field, min, max, label: `${min.toLocaleString()}–${max.toLocaleString()}`, where: `${sqlIdentifier(field)} >= ${min} AND ${sqlIdentifier(field)} <= ${max}` };
  }
  if (["scatter", "bubble", "scatter3d"].includes(chart.type)) {
    const idField = result.layer?.objectIdField;
    const records = result.selection?.(row) || [];
    const values = [...new Set(records.map((record) => record.attributes?.[idField]).filter((value) => value != null))];
    if (!idField || !values.length) return null;
    return { kind: "records", field: idField, values, label: "selected record", where: `${sqlIdentifier(idField)} IN (${values.map(sqlLiteral).join(", ")})` };
  }
  if (chart.type === "kpi") return null;
  const field = chart.dimension?.field;
  const records = result.selection?.(row) || row.records || [];
  const values = [...new Set(records.map((record) => record.attributes?.[field]).filter((value) => value != null && value !== ""))];
  if (!field || !values.length) return null;
  return { kind: "category", field, values, label: row.label || String(values[0]), where: `${sqlIdentifier(field)} IN (${values.map(sqlLiteral).join(", ")})` };
}

export function rowsAsCsv(result) {
  const scatter = ["scatter", "bubble", "scatter3d"].includes(result.chart.type);
  const headings = scatter ? [result.chart.dimension?.field || "x", result.chart.measure.field || "y", ...(["bubble", "scatter3d"].includes(result.chart.type) ? [result.chart.encoding?.sizeField || "z / size"] : [])] : ["category", "value", "record_count"];
  const values = result.rows.map((row) => scatter ? [row.x, row.y, ...(["bubble", "scatter3d"].includes(result.chart.type) ? [row.size] : [])] : [row.label || `${row.min}–${row.max}`, Array.isArray(row.value) ? row.value.join("–") : row.value, row.records?.length || 0]);
  return [headings, ...values].map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
}
