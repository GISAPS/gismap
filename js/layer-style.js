// Layer styles (schemas/layer-style-v1.schema.json): a reusable "layer file"
// that records how one layer is drawn — its renderer, an optional 3D spatial
// chart, a filter and opacity — apart from the map it was made on. The
// Cartography Lab saves them per layer, and they become map-v1 layers,
// briefings and tours.
import { validateRendererSpec } from "./renderer-spec.js?v=0.29.1";
import { SPATIAL_CHART_MODES, SPATIAL_CHART_TYPE } from "./spatial-chart.js?v=0.69.9-order";
import { createSlide, normalizeBriefing } from "./briefing-document.js?v=0.61.0-briefing-player";

export const LAYER_STYLE_TYPE = "gismap-layer-style";
export const LAYER_STYLE_VERSION = 1;
export const LAYER_STYLE_SCHEMA = "https://gismap.online/schemas/layer-style-v1.schema.json";
export const MAX_LAYER_STYLES = 200;

const MAX_CONDITIONS = 10;
const READ_ONLY_WHERE = /;|--|\/\*|\b(drop|delete|insert|update|alter|exec|execute|merge|truncate|create)\b/i;
const FIELD_NAME = /^[A-Za-z_][\w.]*$/;
const text = (value, max) => String(value ?? "").trim().slice(0, max);
const newId = () => `style-${globalThis.crypto?.randomUUID?.().slice(0, 8) || Math.random().toString(36).slice(2, 10)}`;

/** The service URL a style is matched on: no trailing slash, case-insensitive. */
export const sourceKey = (url) => String(url || "").trim().replace(/\/+$/, "").toLowerCase();

function normalizeFilter(filter) {
  if (!filter || typeof filter !== "object" || !Array.isArray(filter.conditions)) return null;
  const conditions = filter.conditions.slice(0, MAX_CONDITIONS)
    .filter((condition) => condition && FIELD_NAME.test(String(condition.field || "")) && typeof condition.op === "string")
    .map((condition) => ({
      field: condition.field,
      op: text(condition.op, 20),
      ...(condition.value !== undefined ? { value: Array.isArray(condition.value) ? condition.value.slice(0, 50).map((item) => text(item, 200)) : text(condition.value, 200) } : {}),
      ...(condition.value2 !== undefined ? { value2: text(condition.value2, 200) } : {}),
    }));
  return conditions.length ? { conditions, logic: filter.logic === "or" ? "or" : "and" } : null;
}

function normalizeChart(chart) {
  if (chart == null) return null;
  if (typeof chart !== "object" || (chart.type && chart.type !== SPATIAL_CHART_TYPE)) throw new Error(`spatialChart must be a "${SPATIAL_CHART_TYPE}" object.`);
  if (!SPATIAL_CHART_MODES.includes(chart.mode)) throw new Error(`spatialChart.mode must be one of: ${SPATIAL_CHART_MODES.join(", ")}.`);
  // Groups are read from the data each time the style is applied, so a saved style follows the data.
  const { groups, ...rest } = structuredClone(chart);
  return { ...rest, type: SPATIAL_CHART_TYPE };
}

/** A valid layer style, or an Error naming the first problem. */
export function normalizeLayerStyle(input, { now = new Date() } = {}) {
  if (!input || typeof input !== "object") throw new Error("A layer style must be a JSON object.");
  if (input.type !== LAYER_STYLE_TYPE) throw new Error(`This is not a GISMap Online layer style (type must be "${LAYER_STYLE_TYPE}").`);
  if (Number(input.version) !== LAYER_STYLE_VERSION) throw new Error(`Unsupported layer style version ${input.version}.`);
  const name = text(input.name, 120);
  if (!name) throw new Error("A layer style needs a name.");
  let renderer = null;
  if (input.renderer != null && input.renderer.type !== "service") {
    const checked = validateRendererSpec(input.renderer);
    if (!checked.valid) throw new Error(checked.issues.find((issue) => issue.level === "error")?.message || "The renderer is not valid.");
    renderer = checked.spec;
  }
  const spatialChart = normalizeChart(input.spatialChart);
  const where = input.where == null || input.where === "" ? null : text(input.where, 4000);
  if (where && READ_ONLY_WHERE.test(where)) throw new Error("The style's filter must be a read-only where clause.");
  const opacity = Number(input.opacity);
  const camera = input.camera && typeof input.camera === "object"
    ? Object.fromEntries([["tilt", 0, 90], ["heading", -360, 360]].filter(([key]) => Number.isFinite(Number(input.camera[key]))).map(([key, min, max]) => [key, Math.min(max, Math.max(min, Number(input.camera[key])))]))
    : null;
  const stamp = now.toISOString();
  return {
    type: LAYER_STYLE_TYPE,
    version: LAYER_STYLE_VERSION,
    id: /^[\w-]{1,60}$/.test(String(input.id || "")) ? input.id : newId(),
    name,
    ...(text(input.description, 1000) ? { description: text(input.description, 1000) } : {}),
    source: {
      url: text(input.source?.url, 2048),
      ...(text(input.source?.title, 160) ? { title: text(input.source.title, 160) } : {}),
      ...(text(input.source?.geometryType, 40) ? { geometryType: text(input.source.geometryType, 40) } : {}),
    },
    dimension: spatialChart ? "3d" : "2d",
    renderer,
    spatialChart,
    filter: normalizeFilter(input.filter),
    where,
    opacity: Number.isFinite(opacity) ? Math.min(1, Math.max(0, opacity)) : 1,
    ...(camera && Object.keys(camera).length ? { camera } : {}),
    createdAt: text(input.createdAt, 40) || stamp,
    updatedAt: stamp,
  };
}

/**
 * A style from a layer as the layers API describes it (layers.get):
 * { url, title, geometryType, renderer, spatialChart, where, opacity }.
 */
export function layerStyleFromLayer(info, { name, description = "", filter = null, camera = null, id } = {}) {
  return normalizeLayerStyle({
    type: LAYER_STYLE_TYPE,
    version: LAYER_STYLE_VERSION,
    id,
    name: name || `${info.title || "Layer"} style`,
    description,
    source: { url: info.url, title: info.title, geometryType: info.geometryType },
    renderer: info.renderer?.type === "service" ? null : info.renderer,
    spatialChart: info.spatialChart || null,
    filter,
    where: info.where || null,
    opacity: info.opacity ?? 1,
    camera,
  });
}

/** What the style does, in one line: "Choropleth of ACRES (oranges) · 3D attribute extrusion · Filter: YEAR_ >= 2019". */
export function describeLayerStyle(style) {
  const r = style.renderer;
  const parts = [!r ? "Service style"
    : r.type === "simple" ? "Single colour"
    : r.type === "categories" ? `Categories of ${r.field}`
    : r.type === "choropleth" ? `Classes of ${r.field}${r.ramp ? ` (${r.ramp})` : ""}`
    : r.type === "graduated-symbols" ? `Sized by ${r.field}`
    : r.type === "heatmap" ? "Heat map"
    : r.type === "auto" ? "Automatic style" : "ArcGIS renderer"];
  const chart = style.spatialChart;
  if (chart) parts.push(chart.mode === "attribute-extrusion" ? `3D height ${chart.height?.field} × ${chart.height?.scale ?? 1}` : `3D ${chart.mode.replaceAll("-", " ")} by ${chart.groupBy}`);
  if (style.where) parts.push(`Filter: ${style.where}`);
  if (style.opacity < 1) parts.push(`${Math.round(style.opacity * 100)}% opacity`);
  return parts.join(" · ");
}

/** The style applied to a layer: a map-v1 layer entry (schemas/map-v1.schema.json). */
export function layerStyleMapLayer(style, { url = style.source.url, type, title = style.source.title } = {}) {
  return {
    url,
    ...(type ? { type } : {}),
    ...(title ? { title } : {}),
    ...(style.where ? { where: style.where } : {}),
    ...(style.renderer ? { renderer: style.renderer } : {}),
    ...(style.spatialChart ? { spatialChart: style.spatialChart } : {}),
    ...(style.opacity < 1 ? { opacity: style.opacity } : {}),
  };
}

/** A whole map-v1 spec showing the styled layer, tilted when the style is 3D. */
export function layerStyleMapSpec(style, { title = style.name, basemap, camera, type } = {}) {
  const tilt = style.camera?.tilt ?? (style.dimension === "3d" ? 60 : 0);
  return {
    version: 1,
    title,
    ...(basemap ? { basemap } : {}),
    legend: true,
    ...(camera?.center ? { camera: { center: camera.center, zoom: camera.zoom, heading: style.camera?.heading ?? camera.heading ?? 0, tilt } } : {}),
    layers: [layerStyleMapLayer(style, { type })],
  };
}

/**
 * Briefing slides that walk through a style: a title, the flat map and, for a
 * 3D style, the same data in 3D. Slides carry the 3D chart; the colours are
 * the layer's own, so apply the style before presenting.
 */
export function layerStyleBriefing(style, { briefing = {}, layerRef = style.source.url, camera = null } = {}) {
  const document = normalizeBriefing(briefing);
  const slides = [];
  const make = (template, title, markdown, spatialChart, view, stage) => {
    const slide = createSlide(template, { title, camera: view });
    if (slide.blocks[0] && markdown) slide.blocks[0].markdown = markdown;
    slide.spatialChart = spatialChart;
    slide.generatedBy = { template: "layer-style", version: 1, stage, styleId: style.id, layer: layerRef };
    return slide;
  };
  const summary = describeLayerStyle(style);
  const title = createSlide("title", { title: style.name, camera: camera ? { ...camera, tilt: 0 } : null });
  title.subtitle = style.source.title || "";
  title.generatedBy = { template: "layer-style", version: 1, stage: "title", styleId: style.id, layer: layerRef };
  slides.push(title);
  slides.push(make("map-narrative", "The map", `${style.description ? `${style.description}\n\n` : ""}${summary}.`, null, camera ? { ...camera, tilt: 0 } : null, "flat"));
  if (style.spatialChart) {
    const chart = style.spatialChart;
    const meaning = chart.mode === "attribute-extrusion"
      ? `Height shows **${chart.height?.field}** × ${chart.height?.scale ?? 1} (display metres, not real elevation).`
      : `Each value of **${chart.groupBy}** has its own vertical slot. Vertical position shows order, not altitude.`;
    slides.push(make("map-narrative", "In 3D", meaning, chart, camera ? { ...camera, tilt: Math.max(55, style.camera?.tilt ?? 60), heading: style.camera?.heading ?? camera.heading ?? 0 } : null, "3d"));
  }
  if (document.slides.length + slides.length > 60) throw new Error("The briefing has no room for these slides (60 at most).");
  return normalizeBriefing({ ...document, title: document.title || style.name, layerId: layerRef || document.layerId, selection: document.selection || { ids: [], useAll: true }, slides: [...document.slides, ...slides] });
}

/** The field a tour of "the top features" is ordered by: the 3D height, else the renderer's field. */
export function layerStyleRankField(style) {
  return style.spatialChart?.height?.field || (["choropleth", "graduated-symbols", "heatmap"].includes(style.renderer?.type) ? style.renderer.field : null) || null;
}

/** A file name for a downloaded style. */
export function layerStyleFileName(style) {
  const slug = String(style.name || "layer-style").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "layer-style";
  return `${slug}.gismap-style.json`;
}

/** Merges style lists by id, the newest first; at most MAX_LAYER_STYLES. */
export function mergeLayerStyles(...lists) {
  const byId = new Map();
  for (const style of lists.flat()) {
    if (!style?.id) continue;
    const existing = byId.get(style.id);
    if (!existing || String(style.updatedAt) > String(existing.updatedAt)) byId.set(style.id, style);
  }
  return [...byId.values()].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))).slice(0, MAX_LAYER_STYLES);
}

/** Styles saved for a layer (matched by service URL). */
export const stylesForSource = (styles, url) => styles.filter((style) => sourceKey(style.source?.url) === sourceKey(url));
