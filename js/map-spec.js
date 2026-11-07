// map-v1: a whole map as one readable JSON object (schemas/map-v1.schema.json).
// It is the readable form of a `#map=` link:
//   #map=json:<URI-encoded map-v1 JSON>   written by hand, even by a chat-only model
//   #map=z…                                the same JSON, compressed (link-codec.js)
//   ?spec=<https URL of a map-v1 file>     for maps too large for a link
// Older app links (`#map=z…` holding the compact share payload) still open; they
// decode to map-v1 too. Pure functions only, so headless callers can build links.
import { decodePayload, encodePayload } from "./link-codec.js?v=0.21.0";
import { MAP_SPEC_JSON_LIMIT, QR_SAFE_LENGTH, readShare } from "./map-share.js?v=0.69.9-order";
import { SHARE_BASEMAPS, SHARE_LAYER_TYPES, SHARE_LIMITS, sanitizeSharedResourceUrl } from "./share.js?v=0.69.9-order";
import { validateRendererSpec } from "./renderer-spec.js?v=0.29.0";
import { normalizeBriefing, validateBriefing } from "./briefing-document.js?v=0.61.0-briefing-player";
import { SCENE3D_TYPES, normalizeScene3d, scene3dTypeFor } from "./scene3d.js?v=0.1.0";
import { CINEMATIC_EFFECT_TYPES, normalizeLayerEffect } from "./cinematic/cinematic-effects.js?v=0.69.9-order";
import { INTERFACE_SKINS } from "./skin-catalog.js?v=0.57.0-skins2";
import { GisMapError } from "./gismap-errors.js?v=0.54.0-print";
import { AGGREGATIONS, CHART_TYPES, normalizeChartStyle } from "./charting-tools.js?v=0.68.0-charts1";

export const MAP_SPEC_VERSION = 1;
export const MAP_SPEC_SCHEMA = "https://gismap.online/schemas/map-v1.schema.json";
import { SPATIAL_OPERATION_IDS, SPATIAL_OPERATIONS } from "./spatial-analysis.js?v=0.66.0-analysis1";

export { MAP_SPEC_JSON_LIMIT };

const TOP_LEVEL = new Set(["$schema", "version", "title", "description", "basemap", "skin", "camera", "layers", "legend", "briefing", "analysis", "charts"]);
const LAYER_KEYS = new Set(["url", "type", "title", "where", "renderer", "spatialChart", "animatedEffect", "scene3d", "opacity", "visible", "ignoreServiceScaleRange", "popup", "outFields", "refreshInterval"]);
// A chart panel is a definition only: which layer, which fields, how it looks.
// Its numbers are computed from the layer when the link opens.
const CHART_KEYS = new Set(["type", "title", "layer", "dimension", "measure", "aggregation", "scope", "placement", "size", "style"]);
const CHART_STYLE_KEYS = ["palette", "theme", "topN", "other", "sort", "legend", "stacked", "hidden"];
const CHART_SCOPES = ["filtered", "all", "viewport"];
const CHART_SIZES = ["compact", "regular", "expanded"];
export const MAP_SPEC_CHART_LIMITS = Object.freeze({ maxCharts: 6, maxJson: 4000 });
const FIELD_NAME = /^[A-Za-z_][A-Za-z0-9_.]{0,159}$/;
const SKINS = new Set(INTERFACE_SKINS.map(({ id }) => id));
const READ_ONLY_WHERE = /;|--|\/\*|\b(drop|delete|insert|update|alter|exec|execute|merge|truncate|create)\b/i;
const text = (value, max) => String(value ?? "").trim().slice(0, max);

/**
 * Checks a map spec and returns { valid, issues, spec }: the normalized spec
 * keeps every layer that can load. Issues are { level, code, path, message, hint }.
 * A layer with an error is dropped (the rest of the map still opens); `valid`
 * is false when anything was dropped or the spec cannot be used at all.
 */
export function validateMapSpec(input, { allowHttp = false } = {}) {
  const issues = [];
  const issue = (level, code, path, message, hint) => issues.push({ level, code, path, message, ...(hint ? { hint } : {}) });
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    issue("error", "INVALID_SPEC", "", "A map spec must be a JSON object.", 'Start from { "version": 1, "layers": [{ "url": "https://…" }] }.');
    return { valid: false, issues, spec: null };
  }
  if (input.version !== undefined && input.version !== MAP_SPEC_VERSION) {
    issue("error", "INVALID_SPEC", "version", `Unsupported map spec version ${input.version}.`, `Use "version": ${MAP_SPEC_VERSION}.`);
    return { valid: false, issues, spec: null };
  }
  for (const key of Object.keys(input)) {
    if (!TOP_LEVEL.has(key)) issue("warning", "INVALID_SPEC", key, `Unknown property "${key}" was ignored.`, key === "layer" ? 'Use "layers": [ … ].' : `Known properties: ${[...TOP_LEVEL].join(", ")}.`);
  }
  const spec = { version: MAP_SPEC_VERSION };
  if (input.title !== undefined) spec.title = text(input.title, 160);
  if (input.description !== undefined) spec.description = text(input.description, 2000);
  if (input.basemap !== undefined) {
    if (SHARE_BASEMAPS.has(input.basemap)) spec.basemap = input.basemap;
    else issue("warning", "INVALID_SPEC", "basemap", `Unknown basemap "${input.basemap}"; the default is used.`, `Use one of: ${[...SHARE_BASEMAPS].join(", ")}.`);
  }
  if (input.skin !== undefined) {
    if (SKINS.has(input.skin)) spec.skin = input.skin;
    else issue("warning", "INVALID_SPEC", "skin", `Unknown skin "${input.skin}"; the current look is kept.`, `Use one of: ${[...SKINS].join(", ")}.`);
  }
  // Camera: fit the layers (the default), or an exact view.
  const camera = input.camera;
  if (camera === undefined || camera === null || camera?.fit === "layers") {
    spec.camera = { fit: "layers" };
  } else if (camera?.fit === "none") {
    spec.camera = { fit: "none" };
  } else if (camera && typeof camera === "object") {
    const center = Array.isArray(camera.center) ? camera.center.map(Number) : null;
    if (!center || center.length !== 2 || !center.every(Number.isFinite) || Math.abs(center[0]) > 180 || Math.abs(center[1]) > 90) {
      issue("warning", "INVALID_SPEC", "camera.center", "camera.center must be [longitude, latitude] in degrees; the map fits its layers instead.", 'Use { "center": [-98.5, 39.5], "zoom": 4 } or { "fit": "layers" }.');
      spec.camera = { fit: "layers" };
    } else {
      const clamp = (value, min, max, fallback) => (Number.isFinite(Number(value)) ? Math.min(max, Math.max(min, Number(value))) : fallback);
      spec.camera = {
        center,
        ...(camera.zoom === undefined && Number.isFinite(Number(camera.scale)) ? { scale: clamp(camera.scale, 1, 600000000, 1000000) } : { zoom: clamp(camera.zoom, 0, 24, 10) }),
        heading: clamp(camera.heading, -360, 360, 0),
        tilt: clamp(camera.tilt, 0, 90, 0),
      };
    }
  } else {
    issue("warning", "INVALID_SPEC", "camera", 'camera must be { "fit": "layers" } or { "center": [lon, lat], "zoom": n }.');
    spec.camera = { fit: "layers" };
  }
  if (input.legend !== undefined) spec.legend = input.legend === true;
  // Layers: each checked on its own, so one bad layer does not lose the map.
  const layers = Array.isArray(input.layers) ? input.layers : [];
  if (!Array.isArray(input.layers)) issue("error", "INVALID_SPEC", "layers", "layers must be a list of { url } objects.", 'Use "layers": [{ "url": "https://…/FeatureServer/0" }].');
  if (layers.length > SHARE_LIMITS.maxLayers) issue("error", "TOO_MANY_LAYERS", "layers", `A map holds at most ${SHARE_LIMITS.maxLayers} layers; the rest were left out.`);
  spec.layers = [];
  const kept = new Map(); // position in input.layers → position in spec.layers
  layers.slice(0, SHARE_LIMITS.maxLayers).forEach((raw, index) => {
    const path = `layers[${index}]`;
    if (!raw || typeof raw !== "object") return issue("error", "INVALID_SPEC", path, "Each layer must be an object with a url.");
    let url;
    try {
      url = sanitizeSharedResourceUrl(raw.url, { allowHttp });
    } catch (error) {
      const code = /HTTPS/.test(error.message) ? "HTTPS_REQUIRED" : /credential|password/i.test(error.message) ? "CREDENTIAL_IN_URL" : "INVALID_URL";
      return issue("error", code, `${path}.url`, `${error.message}${raw.url ? ` (${String(raw.url).slice(0, 120)})` : ""}`);
    }
    const layer = { url };
    for (const key of Object.keys(raw)) if (!LAYER_KEYS.has(key)) issue("warning", "INVALID_SPEC", `${path}.${key}`, `Unknown layer property "${key}" was ignored.`);
    const type = raw.type === undefined ? "arcgis-auto" : raw.type;
    if (!SHARE_LAYER_TYPES.has(type)) return issue("error", "UNSUPPORTED_LAYER_TYPE", `${path}.type`, `Unsupported layer type "${raw.type}".`, `Use one of: ${[...SHARE_LAYER_TYPES].join(", ")}.`);
    layer.type = type;
    if (raw.title !== undefined) layer.title = text(raw.title, 160);
    if (raw.where !== undefined && raw.where !== null && raw.where !== "") {
      const where = String(raw.where).trim();
      if (where.length > 2000 || READ_ONLY_WHERE.test(where)) issue("error", "INVALID_SPEC", `${path}.where`, "where must be a plain attribute filter (no statements, comments or semicolons); the layer is shown unfiltered.");
      else layer.where = where;
    }
    if (raw.renderer !== undefined) {
      // Field names are checked when the layer loads and its fields are known.
      const { valid, issues: styleIssues, spec: renderer } = validateRendererSpec(raw.renderer);
      styleIssues.forEach((item) => issue(item.level === "error" ? "warning" : item.level, item.code, `${path}.${item.path}`, `${item.message}${item.level === "error" ? " The service's own style is used." : ""}`, item.hint));
      if (valid) layer.renderer = renderer;
    }
    if (raw.spatialChart !== undefined) {
      const chart = raw.spatialChart;
      const modes = ["attribute-extrusion", "temporal-strata", "stacked-footprints", "exploded-timeline"];
      if (!chart || typeof chart !== "object" || chart.type !== "spatial-3d-chart" || !modes.includes(chart.mode) || JSON.stringify(chart).length > 12000) issue("warning", "INVALID_SPEC", `${path}.spatialChart`, "spatialChart must be a bounded spatial-3d-chart configuration; it was ignored.");
      else layer.spatialChart = structuredClone(chart);
    }
    if (raw.animatedEffect !== undefined && raw.animatedEffect !== null) {
      const effect = normalizeLayerEffect(raw.animatedEffect);
      if (effect) layer.animatedEffect = effect;
      else issue("warning", "INVALID_SPEC", `${path}.animatedEffect`, `animatedEffect.type must be one of auto, ${CINEMATIC_EFFECT_TYPES.filter((type) => type !== "none").join(", ")}; it was ignored.`);
    }
    if (raw.scene3d !== undefined) {
      const kind = SCENE3D_TYPES.includes(type) ? type : scene3dTypeFor(raw.url);
      try {
        if (!kind) throw new Error("scene3d applies to pointcloud and model layers.");
        layer.scene3d = normalizeScene3d(raw.scene3d, kind);
      } catch (error) { issue("warning", "INVALID_SPEC", `${path}.scene3d`, `${error.message} The 3D options were ignored.`); }
    }
    if (raw.opacity !== undefined) {
      const opacity = Number(raw.opacity);
      if (Number.isFinite(opacity) && opacity >= 0 && opacity <= 1) layer.opacity = opacity;
      else issue("warning", "INVALID_SPEC", `${path}.opacity`, "opacity must be a number from 0 to 1.");
    }
    if (raw.visible !== undefined) layer.visible = raw.visible !== false;
    if (raw.ignoreServiceScaleRange !== undefined) layer.ignoreServiceScaleRange = raw.ignoreServiceScaleRange === true;
    if (Number.isFinite(Number(raw.refreshInterval)) && Number(raw.refreshInterval) > 0) layer.refreshInterval = Math.min(1440, Number(raw.refreshInterval));
    const popupFields = raw.popup?.fields ?? raw.outFields;
    if (popupFields !== undefined) {
      if (Array.isArray(popupFields) && popupFields.every((field) => typeof field === "string")) layer.popup = { fields: popupFields.slice(0, 50) };
      else issue("warning", "INVALID_SPEC", `${path}.popup.fields`, "popup.fields must be a list of field names.");
    }
    kept.set(index, spec.layers.length);
    spec.layers.push(layer);
  });
  if (layers.length && !spec.layers.length) issue("error", "INVALID_SPEC", "layers", "None of the layers can be loaded.");
  if (input.briefing !== undefined && input.briefing !== null) {
    if (typeof input.briefing !== "object") issue("warning", "INVALID_SPEC", "briefing", "briefing must be a briefing-v1 document; it was ignored.");
    else {
      const briefing = normalizeBriefing(input.briefing);
      validateBriefing(briefing).filter((item) => item.level === "error").forEach((item) => issue("warning", "INVALID_SPEC", `briefing.slides[${item.slideId}]`, item.message));
      spec.briefing = briefing;
    }
  }
  if (input.analysis !== undefined && input.analysis !== null) {
    const steps = Array.isArray(input.analysis) ? input.analysis.slice(0, 5) : [];
    if (!Array.isArray(input.analysis) || input.analysis.length > 5) issue("warning", "INVALID_SPEC", "analysis", "analysis must be a list of at most 5 steps.");
    const source = (value) => value === "drawings" || (value && typeof value === "object") || (Number.isInteger(value) && value >= 0 && value < spec.layers.length);
    const kept = steps.filter((step, index) => {
      const operation = SPATIAL_OPERATIONS.find((item) => item.id === step?.operation);
      if (!operation) issue("warning", "INVALID_SPEC", `analysis[${index}].operation`, `Unknown analysis "${step?.operation}"; the step was ignored.`, `Use one of: ${SPATIAL_OPERATION_IDS.join(", ")}.`);
      else if (!source(step.input) || (operation.overlay && !source(step.overlay))) issue("warning", "INVALID_SPEC", `analysis[${index}]`, "input and overlay must be a layer's position in layers, or GeoJSON; the step was ignored.");
      else return true;
      return false;
    });
    if (kept.length) spec.analysis = kept.map(({ operation, input: from, overlay, options, title }) => ({ operation, input: from, ...(overlay !== undefined ? { overlay } : {}), ...(options ? { options } : {}), ...(title ? { title: text(title, 120) } : {}) }));
  }
  if (input.charts !== undefined && input.charts !== null) {
    const charts = Array.isArray(input.charts) ? input.charts.slice(0, MAP_SPEC_CHART_LIMITS.maxCharts) : [];
    if (!Array.isArray(input.charts) || input.charts.length > MAP_SPEC_CHART_LIMITS.maxCharts) issue("warning", "INVALID_SPEC", "charts", `charts must be a list of at most ${MAP_SPEC_CHART_LIMITS.maxCharts} chart panels.`);
    const valid = charts.map((raw, index) => validateChart(raw, `charts[${index}]`, { issue, kept, layers: spec.layers, allowHttp })).filter(Boolean);
    if (valid.length) spec.charts = valid;
  }
  return { valid: !issues.some((item) => item.level === "error"), issues, spec };
}

/**
 * One chart panel of a map spec, or null (with a warning) when it cannot be
 * drawn. `layer` is a position in the spec's layers or one of their URLs;
 * style keeps only what differs from the chart defaults.
 */
function validateChart(raw, path, { issue, kept, layers, allowHttp }) {
  const skip = (message, hint) => { issue("warning", "INVALID_SPEC", path, `${message} The chart was left out.`, hint); return null; };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return skip("Each chart must be an object.");
  if (JSON.stringify(raw).length > MAP_SPEC_CHART_LIMITS.maxJson) return skip(`A chart definition holds at most ${MAP_SPEC_CHART_LIMITS.maxJson.toLocaleString("en-US")} characters; charts carry field names, not data.`);
  for (const key of Object.keys(raw)) if (!CHART_KEYS.has(key)) issue("warning", "INVALID_SPEC", `${path}.${key}`, `Unknown chart property "${key}" was ignored.`, `Known properties: ${[...CHART_KEYS].join(", ")}.`);
  const type = CHART_TYPES.find((entry) => entry.id === raw.type);
  if (!type) return skip(`Unknown chart type "${raw.type}".`, `Use one of: ${CHART_TYPES.map((entry) => entry.id).join(", ")}.`);
  let layer = raw.layer ?? 0;
  if (Number.isInteger(layer)) {
    if (!kept.has(layer)) return skip(`layer ${layer} is not one of the map's layers that loads.`, "Use a position in layers (0 is the first) or one of their URLs.");
    layer = kept.get(layer);
  } else {
    let url;
    try { url = sanitizeSharedResourceUrl(layer, { allowHttp }); } catch { url = null; }
    if (!url || !layers.some((entry) => entry.url === url)) return skip("layer must be a position in layers or the URL of one of them.");
    layer = url;
  }
  const field = (value, name) => {
    if (value === undefined || value === null || value === "") return null;
    if (typeof value === "string" && FIELD_NAME.test(value)) return value;
    issue("warning", "INVALID_SPEC", `${path}.${name}`, `${name} must be a field name.`);
    return undefined;
  };
  const dimension = field(raw.dimension?.field ?? raw.dimension, "dimension");
  const measureField = field(typeof raw.measure === "object" && raw.measure ? raw.measure.field : raw.measure, "measure");
  if (dimension === undefined || measureField === undefined) return skip("The chart's fields are not valid.");
  const aggregation = raw.measure?.aggregation ?? raw.aggregation ?? (measureField ? "sum" : "count");
  if (!AGGREGATIONS.includes(aggregation)) return skip(`Unknown aggregation "${aggregation}".`, `Use one of: ${AGGREGATIONS.join(", ")}.`);
  if (type.dimension && type.id !== "histogram" && !dimension) return skip(`A ${type.id} chart needs a dimension field.`);
  if (aggregation !== "count" && !measureField) return skip(`aggregation "${aggregation}" needs a measure field.`);
  if (type.id === "histogram" && !measureField) return skip("A histogram needs a numeric measure field.");
  const chart = { type: type.id };
  if (raw.title !== undefined) chart.title = text(raw.title, 160);
  chart.layer = layer;
  if (dimension) chart.dimension = dimension;
  chart.measure = { field: measureField, aggregation };
  if (raw.scope !== undefined) {
    if (CHART_SCOPES.includes(raw.scope)) chart.scope = raw.scope;
    else issue("warning", "INVALID_SPEC", `${path}.scope`, `scope must be one of ${CHART_SCOPES.join(", ")}; "filtered" is used.`);
  }
  if (raw.placement !== undefined && raw.placement !== "right" && raw.placement !== "bottom") issue("warning", "INVALID_SPEC", `${path}.placement`, 'placement must be "right" or "bottom"; "right" is used.');
  chart.placement = raw.placement === "bottom" ? "bottom" : "right";
  if (raw.size !== undefined) {
    if (CHART_SIZES.includes(raw.size)) chart.size = raw.size;
    else issue("warning", "INVALID_SPEC", `${path}.size`, `size must be one of ${CHART_SIZES.join(", ")}.`);
  }
  if (raw.style !== undefined && raw.style !== null) {
    if (typeof raw.style !== "object" || Array.isArray(raw.style)) issue("warning", "INVALID_SPEC", `${path}.style`, "style must be an object; the chart defaults are used.");
    else {
      for (const key of Object.keys(raw.style)) if (!CHART_STYLE_KEYS.includes(key)) issue("warning", "INVALID_SPEC", `${path}.style.${key}`, `Unknown chart style "${key}" was ignored.`);
      const style = compactChartStyle(raw.style);
      if (style) chart.style = style;
    }
  }
  return chart;
}

/** The createChartSpec input for a map-v1 chart, bound to the loaded layer's id. */
export function chartSpecFromMapChart(chart, layerId) {
  return {
    title: chart.title || chartTitle(chart),
    type: chart.type,
    source: { layerId, scope: chart.scope || "filtered" },
    dimension: chart.dimension || null,
    measure: chart.measure,
    presentation: { target: "panel", targets: ["panel", "dashboard"], placement: chart.placement || "right", size: chart.size || "regular" },
    interaction: { mapHighlight: true, crossFilter: true },
    style: chart.style || {},
  };
}

/** A saved chart panel (createChartSpec) as a map-v1 chart; `layer` is its position in the spec's layers. */
export function mapChartFromChartSpec(chart, layer) {
  const style = compactChartStyle(chart.style);
  const placement = chart.presentation?.placement === "bottom" ? "bottom" : "right";
  return {
    type: chart.type,
    ...(chart.title ? { title: chart.title } : {}),
    layer,
    ...(chart.dimension?.field ? { dimension: chart.dimension.field } : {}),
    measure: { field: chart.measure?.field || null, aggregation: chart.measure?.aggregation || "count" },
    ...(CHART_SCOPES.includes(chart.source?.scope) && chart.source.scope !== "filtered" ? { scope: chart.source.scope } : {}),
    placement,
    ...(chart.presentation?.size && chart.presentation.size !== "regular" ? { size: chart.presentation.size } : {}),
    ...(style ? { style } : {}),
  };
}

// The chart style choices that differ from the defaults, or null.
function compactChartStyle(input) {
  const style = normalizeChartStyle(input);
  const defaults = normalizeChartStyle({});
  const changed = CHART_STYLE_KEYS.filter((key) => JSON.stringify(style[key]) !== JSON.stringify(defaults[key]));
  return changed.length ? Object.fromEntries(changed.map((key) => [key, style[key]])) : null;
}

function chartTitle(chart) {
  const measure = chart.measure.aggregation === "count" ? "Count" : `${chart.measure.aggregation[0].toUpperCase()}${chart.measure.aggregation.slice(1)} of ${chart.measure.field}`;
  return chart.dimension ? `${measure} by ${chart.dimension}` : measure;
}

/** The `#map=` payload for a spec: compressed (`z…`) by default, or readable (`json:…`). */
export async function encodeMapSpec(input, { compress = true } = {}) {
  const { spec, issues } = validateMapSpec(input, { allowHttp: true });
  if (!spec || !spec.layers.length) throw new GisMapError("INVALID_SPEC", issues.find((item) => item.level === "error")?.message || "The map spec has no layers.", { details: { issues } });
  if (compress) return encodePayload(spec);
  const json = encodeURIComponent(JSON.stringify(spec));
  if (json.length > MAP_SPEC_JSON_LIMIT) throw new GisMapError("SPEC_TOO_LONG", `The readable spec is ${json.length.toLocaleString("en-US")} characters; json: links hold at most ${MAP_SPEC_JSON_LIMIT.toLocaleString("en-US")}.`, { details: { length: json.length, limit: MAP_SPEC_JSON_LIMIT } });
  return `json:${json}`;
}

/** Converts the app's older compact `#map=` payload ({ v, k, L, … }) into map-v1. */
export function mapSpecFromSharePayload(payload, options = {}) {
  const shared = readShare(payload, options);
  const spec = {
    version: MAP_SPEC_VERSION,
    ...(shared.title ? { title: shared.title } : {}),
    ...(shared.basemap ? { basemap: shared.basemap } : {}),
    ...(shared.skin ? { skin: shared.skin } : {}),
    camera: shared.camera ? { center: shared.camera.center, zoom: shared.camera.zoom, heading: shared.camera.heading, tilt: shared.camera.tilt } : { fit: "layers" },
    layers: shared.layers.map((layer) => ({
      url: layer.url,
      type: layer.serviceType,
      ...(layer.title ? { title: layer.title } : {}),
      ...(layer.definitionExpression ? { where: layer.definitionExpression } : {}),
      ...(layer.renderer ? { renderer: { type: "arcgis", json: layer.renderer } } : {}),
      ...(layer.spatialChart ? { spatialChart: layer.spatialChart } : {}),
      ...(layer.animatedEffect ? { animatedEffect: layer.animatedEffect } : {}),
      ...(layer.scene3d ? { scene3d: layer.scene3d } : {}),
      ...(Number.isFinite(layer.opacity) ? { opacity: layer.opacity } : {}),
      ...(layer.visible === false ? { visible: false } : {}),
      ...(layer.ignoreServiceScaleRange ? { ignoreServiceScaleRange: true } : {}),
    })),
  };
  if (shared.kind === "briefing") spec.briefing = shared.briefing;
  return spec;
}

/**
 * The map spec in a `#map=` payload: `json:` readable JSON, a compressed map-v1
 * spec, or an older compact share payload.
 */
export async function decodeMapSpec(value, options = {}) {
  const payload = String(value || "").trim();
  if (/^json:/i.test(payload)) {
    const body = payload.slice(5);
    if (body.length > MAP_SPEC_JSON_LIMIT) throw new GisMapError("SPEC_TOO_LONG", `This json: map link is longer than ${MAP_SPEC_JSON_LIMIT.toLocaleString("en-US")} characters.`, { details: { length: body.length } });
    let decoded = body;
    try { decoded = decodeURIComponent(body); } catch { /* Already plain JSON. */ }
    try {
      return JSON.parse(decoded);
    } catch (error) {
      throw new GisMapError("INVALID_SPEC", `The json: map link is not valid JSON (${error.message}).`, { hint: "URI-encode the JSON with encodeURIComponent, or check for a missing quote or bracket." });
    }
  }
  const raw = await decodePayload(payload);
  if (raw && raw.k !== undefined) return mapSpecFromSharePayload(raw, options);
  return raw;
}

/** A complete link that opens the spec: { url, payload, qr } (qr: short enough for a QR code). */
export async function createMapSpecLink(input, { baseUrl = "https://gismap.online/", compress = true } = {}) {
  const payload = await encodeMapSpec(input, { compress });
  const url = new URL(baseUrl);
  url.search = "";
  url.hash = `map=${payload}`;
  return { url: url.href, payload, qr: url.href.length <= QR_SAFE_LENGTH };
}

/** Prepare a share link and report only checks actually performed. No network or map is accessed. */
export async function prepareMapVerification(input, { baseUrl = "https://gismap.online/", compress = false, allowHttp = false } = {}) {
  const validation = validateMapSpec(input, { allowHttp });
  const report = {
    version: 1,
    status: validation.valid ? "validated" : "invalid",
    checks: {
      specification: validation.valid ? "passed" : "failed",
      sourceMetadata: "not_checked", fields: "not_checked", filterAccepted: "not_checked",
      layerLoaded: "not_checked", mapRendered: "not_checked", shareLinkReopened: "not_checked",
      linkRoundTrip: "not_checked",
    },
    url: null,
    warnings: validation.issues.filter((issue) => issue.level !== "error"),
    errors: validation.issues.filter((issue) => issue.level === "error"),
  };
  if (!validation.valid || !validation.spec) return report;
  try {
    const link = await createMapSpecLink(validation.spec, { baseUrl, compress });
    const decoded = await decodeMapSpec(link.payload, { allowHttp });
    if (JSON.stringify(decoded) !== JSON.stringify(validation.spec)) throw new Error("Decoded link differs from the validated specification.");
    report.url = link.url;
    report.checks.linkRoundTrip = "passed";
  } catch (error) {
    report.checks.linkRoundTrip = "failed";
    report.errors.push({ level: "error", code: error.code || "LINK_FAILED", path: "", message: error.message });
  }
  return report;
}

/**
 * One map spec from `?layer=` parameters and their index-aligned styling:
 * title, where, style (service | simple | choropleth | graduated | categories |
 * heatmap | auto), field, classes, method, breaks and exclude (comma-separated), ramp, opacity.
 */
export function mapSpecFromShareParameters(shared) {
  const spec = { version: MAP_SPEC_VERSION, layers: [] };
  if (shared.basemap) spec.basemap = shared.basemap;
  const camera = shared.camera || {};
  spec.camera = camera.center
    ? { center: camera.center, ...(camera.scale ? { scale: camera.scale } : { zoom: camera.level ?? 10 }), heading: camera.heading ?? 0, tilt: camera.tilt ?? 0 }
    : camera.zoom === "none" ? { fit: "none" } : { fit: "layers" };
  for (const layer of shared.layers) {
    const entry = { url: layer.url, type: layer.serviceType || "arcgis-auto" };
    if (layer.title) entry.title = layer.title;
    if (layer.where) entry.where = layer.where;
    if (Number.isFinite(layer.opacity)) entry.opacity = layer.opacity;
    if (layer.refreshInterval) entry.refreshInterval = layer.refreshInterval;
    if (layer.style) entry.renderer = rendererSpecFromParameters(layer.style);
    else if (layer.renderer) entry.renderer = { type: "arcgis", json: layer.renderer };
    if (layer.animatedEffect) entry.animatedEffect = layer.animatedEffect;
    if (layer.spatialChart) entry.spatialChart = layer.spatialChart;
    spec.layers.push(entry);
  }
  return spec;
}

/** Turns `style=choropleth&field=POP&method=auto&ramp=greens&exclude=-1` (one layer's values) into a RendererSpec. */
export function rendererSpecFromParameters({ style, field, classes, method, breaks, ramp, exclude, color } = {}) {
  if (!style) return null;
  const type = style === "graduated" ? "graduated-symbols" : style;
  const spec = { type };
  if (field) spec.field = field;
  if (classes !== undefined && classes !== "") spec.classes = Number(classes);
  if (method) spec.method = method;
  if (breaks) spec.breaks = String(breaks).split(",").map((item) => Number(item.trim()));
  if (ramp) spec.ramp = ramp;
  if (color) spec.color = color.startsWith("#") ? color : `#${color}`;
  if (exclude !== undefined && exclude !== "") spec.exclude = String(exclude).split(",").map((item) => item.trim()).filter(Boolean).map((item) => (/^-?\d+(\.\d+)?$/.test(item) ? Number(item) : item));
  return spec;
}
