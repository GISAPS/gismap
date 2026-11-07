// Self-contained links for a styled map or a briefing. Everything needed to
// rebuild the view travels in the URL fragment (never sent to a server):
// layers with their styles and filters, basemap, skin, camera and, for a
// briefing, its slides. Small enough links also fit in a QR code.
import { normalizeLayerEffect } from "./cinematic/cinematic-effects.js?v=0.69.9-order";
import { decodePayload, encodePayload } from "./link-codec.js?v=0.21.0";
import { normalizeBriefing } from "./briefing-document.js?v=0.61.0-briefing-player";
import { SHARE_BASEMAPS, SHARE_LAYER_TYPES, sanitizeSharedResourceUrl } from "./share.js?v=0.69.9-order";
import { normalizeSkin } from "./skin-catalog.js?v=0.57.0-skins2";
import { decodeBriefing } from "./briefing-share.js?v=0.60.0-media1";
import { normalizeTextBoxes } from "./text-boxes.js?v=0.65.0-paths";

const MAX_TEXT_BOXES = 50;

/**
 * Slides-only briefing links from the client API (`#briefing=b1.…` / `j1.…`,
 * briefing-share.js) carry no layers; full links (`z…` / `j…`, no dot) do.
 */
const DOCUMENT_ONLY = /^[bj]\d+\./;

/** The longest readable `#map=json:` payload (after "json:"), so links survive chat apps. */
export const MAP_SPEC_JSON_LIMIT = 8192;
/** Version-40 QR codes hold a little under 3 KB, so only links this short get a QR. */
export const QR_SAFE_LENGTH = 2800;
const MAX_LAYERS = 10;
const MAX_LABELING = 4500;
const MAX_RENDERER = 60000;
const MAX_SPATIAL_CHART = 12000;
const MAX_SELECTION = 300;
const KINDS = new Set(["map", "briefing"]);

const text = (value, max = 160) => String(value ?? "").trim().slice(0, max);

/** A layer filter that actually hides something (not empty and not "1=1"). */
export const hasDataFilter = (expression) => Boolean(String(expression ?? "").replace(/\s+/g, "") && !/^(1=1|true)$/i.test(String(expression).replace(/\s+/g, "")));
const round = (value, digits) => Number(Number(value).toFixed(digits));

/**
 * Drops empty values so links stay short; normalizeBriefing puts the defaults
 * back. Renderers (`r`) are kept exactly as the map serialized them.
 */
function prune(value) {
  if (Array.isArray(value)) return value.map(prune);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value)
    .map(([key, item]) => [key, key === "r" || key === "q" || key === "v" ? item : prune(item)])
    .filter(([, item]) => item !== null && item !== undefined && item !== "" && item !== false && !(Array.isArray(item) && !item.length)));
}

/** The presented part of a briefing: visible slides, without per-block IDs. */
export function compactBriefing(briefing) {
  const document = normalizeBriefing(briefing);
  const slides = document.slides.filter((slide) => !slide.hidden).map(({ hidden, ...slide }) => ({
    ...slide,
    blocks: slide.blocks.map(({ id, ...block }) => block),
  }));
  return prune({ transition: document.transition || null, queries: Object.keys(document.queries).length ? document.queries : null, slides });
}

/** One layer as a link carries it: source, title, filter, style and opacity. */
export function packLayer(config = {}) {
  // A service's own style loads with the layer anyway; it travels only when set in
  // GISMap Online (or when it is small), since service styles often embed symbol images.
  const json = config.renderer ? JSON.stringify(config.renderer) : "";
  const wanted = config.styled === true || !json.includes('"imageData"');
  if (config.styled === true && json.length > MAX_RENDERER) throw new Error("A custom renderer is too large to share without losing its style. Export a project instead.");
  const renderer = config.renderer && wanted && json.length <= MAX_RENDERER ? config.renderer : null;
  const chartJson = config.spatialChart ? JSON.stringify(config.spatialChart) : "";
  if (chartJson.length > MAX_SPATIAL_CHART) throw new Error("A 3D spatial chart is too large to share. Reduce its groups or export a project instead.");
  return prune({
    u: config.url,
    y: SHARE_LAYER_TYPES.has(config.sourceType) ? config.sourceType : "arcgis-auto",
    n: text(config.title, 120),
    w: hasDataFilter(config.definitionExpression) ? text(config.definitionExpression, 2000) : null,
    r: renderer,
    q: chartJson ? config.spatialChart : null,
    e: normalizeLayerEffect(config.animatedEffect),
    v: config.scene3d && JSON.stringify(config.scene3d).length <= MAX_SPATIAL_CHART ? config.scene3d : null,
    o: Number.isFinite(config.opacity) && config.opacity < 1 ? round(config.opacity, 2) : null,
    h: config.visible === false ? 1 : null,
    s: config.ignoreServiceScaleRange ? 1 : null,
    l: config.labeling?.enabled && JSON.stringify(config.labeling).length <= MAX_LABELING ? { ...config.labeling, avoidOverlap: config.labeling.avoidOverlap === false ? 0 : 1 } : null,
  });
}

function unpackLayer(layer, options) {
  if (!layer || typeof layer !== "object") throw new Error("A shared layer is missing.");
  const renderer = layer.r && typeof layer.r === "object" && JSON.stringify(layer.r).length <= MAX_RENDERER ? layer.r : null;
  const spatialChart = layer.q && typeof layer.q === "object" && JSON.stringify(layer.q).length <= MAX_SPATIAL_CHART ? layer.q : null;
  return {
    url: sanitizeSharedResourceUrl(layer.u, options),
    serviceType: SHARE_LAYER_TYPES.has(layer.y) ? layer.y : "arcgis-auto",
    title: text(layer.n, 120) || undefined,
    definitionExpression: text(layer.w, 2000) || undefined,
    renderer,
    spatialChart,
    animatedEffect: normalizeLayerEffect(layer.e) || undefined,
    scene3d: layer.v && typeof layer.v === "object" && !Array.isArray(layer.v) && JSON.stringify(layer.v).length <= MAX_SPATIAL_CHART ? layer.v : undefined,
    opacity: Number.isFinite(layer.o) ? Math.min(1, Math.max(0, layer.o)) : undefined,
    visible: layer.h !== 1,
    ignoreServiceScaleRange: layer.s === 1,
    labeling: layer.l && typeof layer.l === "object" && !Array.isArray(layer.l) && JSON.stringify(layer.l).length <= MAX_LABELING ? { ...layer.l, enabled: true } : undefined,
  };
}

export function packCamera(state) {
  const center = state?.center;
  if (!Array.isArray(center) || !center.every(Number.isFinite)) return null;
  return { c: [round(center[0], 5), round(center[1], 5)], z: round(state.zoom ?? 12, 2), h: round(state.heading ?? 0, 1), t: round(state.tilt ?? 0, 1) };
}

function unpackCamera(camera) {
  const center = Array.isArray(camera?.c) ? camera.c.map(Number) : [];
  if (center.length !== 2 || !center.every(Number.isFinite) || Math.abs(center[0]) > 180 || Math.abs(center[1]) > 90) return null;
  const number = (value, fallback, min, max) => (Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback);
  return { center, zoom: number(camera.z, 12, 0, 24), heading: number(camera.h, 0, -360, 360), tilt: number(camera.t, 0, 0, 90) };
}

/**
 * The shareable state. `layers` are map-controller layer configs (remote ones
 * are kept; local files cannot travel in a link). For a briefing, `primary` is
 * the index of the briefing's layer within `layers`.
 */
export function serializeShare({ kind = "map", title = "", skin, basemap, camera, layers = [], primary = 0, briefing = null, selection = null, useAll = false, engine = null, ground = null, textBoxes = [] }) {
  const labels = kind === "map" ? normalizeTextBoxes(textBoxes).slice(0, MAX_TEXT_BOXES) : [];
  if (!KINDS.has(kind)) throw new Error(`Unknown link type: ${kind}.`);
  const remote = layers.filter((layer) => layer?.url && !layer.local);
  if (kind === "briefing" && remote.length !== layers.length) throw new Error("This briefing contains local or non-shareable layers. Export a project instead of an incomplete link.");
  if (kind === "briefing" && layers.length && !remote.includes(layers[primary])) throw new Error("The briefing's primary layer is not shareable.");
  if (kind === "briefing" && !useAll && selection?.length > MAX_SELECTION) throw new Error(`This selection exceeds the ${MAX_SELECTION}-feature share limit. Export a project instead.`);
  for (const layer of remote) {
    sanitizeSharedResourceUrl(layer.url, { allowHttp: true });
    if (String(layer.definitionExpression || "").length > 2000) throw new Error("A layer filter is too long to share without truncation. Export a project instead.");
  }
  if (!remote.length && !labels.length) throw new Error("Add a public web layer before sharing; files from this device cannot travel in a link.");
  if (remote.length > MAX_LAYERS) throw new Error(`A shared map can include at most ${MAX_LAYERS} layers.`);
  const payload = {
    v: 1,
    k: kind,
    t: text(title, 120),
    s: normalizeSkin(skin),
    m: SHARE_BASEMAPS.has(basemap) ? basemap : null,
    c: packCamera(camera),
    e: ["arcgis", "maplibre"].includes(engine) ? engine : null,
    g: ["flat", "world-elevation", "world-topobathymetry"].includes(ground) ? ground : null,
    L: remote.map(packLayer),
    x: labels.length ? labels : null,
  };
  if (kind === "briefing") {
    payload.p = Math.max(0, remote.indexOf(layers[primary]));
    payload.b = normalizeBriefing(briefing);
    if (!useAll && selection?.length) payload.i = selection.slice(0, MAX_SELECTION).map(String);
    if (useAll) payload.a = 1;
  }
  return prune(payload);
}

/** Validates a decoded (or downloaded) payload into the app's own shapes. */
export function readShare(payload, options = {}) {
  if (!payload || payload.v !== 1 || !KINDS.has(payload.k)) throw new Error("This link was made by a newer or different app and cannot be opened.");
  const layers = (Array.isArray(payload.L) ? payload.L : []).slice(0, MAX_LAYERS).map((layer) => unpackLayer(layer, options));
  const textBoxes = payload.k === "map" ? normalizeTextBoxes(payload.x).slice(0, MAX_TEXT_BOXES) : [];
  if (!layers.length && !textBoxes.length) throw new Error("This link has no layers.");
  const result = {
    kind: payload.k,
    title: text(payload.t, 120),
    skin: normalizeSkin(payload.s),
    basemap: SHARE_BASEMAPS.has(payload.m) ? payload.m : null,
    camera: unpackCamera(payload.c),
    engine: ["arcgis", "maplibre"].includes(payload.e) ? payload.e : null,
    ground: ["flat", "world-elevation", "world-topobathymetry"].includes(payload.g) ? payload.g : null,
    layers,
    textBoxes,
  };
  if (payload.k === "briefing") {
    result.primary = Math.min(layers.length - 1, Math.max(0, Number(payload.p) || 0));
    result.briefing = normalizeBriefing(payload.b);
    result.selection = (Array.isArray(payload.i) ? payload.i : []).slice(0, MAX_SELECTION).map(String);
    result.useAll = payload.a === 1;
  }
  return result;
}

/** A complete link. `slide` deep-links into a briefing. */
export async function createShareLink({ baseUrl, slide = null, ...state }) {
  const payload = serializeShare(state);
  const url = new URL(baseUrl);
  url.search = "";
  const hash = new URLSearchParams({ [payload.k]: await encodePayload(payload) });
  if (slide) hash.set("slide", slide);
  url.hash = hash.toString();
  return { url: url.href, payload, qr: url.href.length <= QR_SAFE_LENGTH };
}

/**
 * Finds a shared map or briefing in the address: `#map=…` / `#briefing=…`
 * fragments, or `?briefing=https://…/file.json` (the app's briefing file or a
 * schema briefing document, which may name its layer by URL in `layerId`).
 */
export async function readShareLocation(location, { fetchJson = (url) => fetch(url).then((response) => { if (!response.ok) throw new Error(`The shared file could not be downloaded (${response.status}).`); return response.json(); }), ...options } = {}) {
  const hash = new URLSearchParams(String(location.hash || "").replace(/^#/, ""));
  const slide = hash.get("slide");
  // A map spec (map-v1, js/map-spec.js): `#map=json:<URI-encoded JSON>`, the same
  // JSON compressed in `#map=z…`, or a hosted file in `?spec=<https URL>`.
  const mapValue = hash.get("map");
  if (mapValue && /^json:/i.test(mapValue)) {
    // Read the raw fragment rather than the parsed parameter: hand-written JSON may
    // hold "&" or "+" that query-string parsing would split or turn into spaces.
    const raw = String(location.hash || "").replace(/^#/, "");
    let body = raw.slice(raw.search(/(?:^|&)map=json:/i)).replace(/^&?map=json:/i, "").replace(/&slide=[^&]*$/, "");
    if (body.length > MAP_SPEC_JSON_LIMIT) throw new Error(`This json: map link is longer than ${MAP_SPEC_JSON_LIMIT.toLocaleString("en-US")} characters; use the compressed #map= form or ?spec=.`);
    try { body = decodeURIComponent(body); } catch { /* Partly encoded: parse as it is. */ }
    try {
      return { kind: "map-spec", spec: JSON.parse(body), slide };
    } catch (error) {
      throw new Error(`The json: map link is not valid JSON (${error.message}). URI-encode the JSON (encodeURIComponent) and check its quotes and brackets.`);
    }
  }
  if (mapValue) {
    const decoded = await decodePayload(mapValue);
    if (decoded && decoded.k === undefined) return { kind: "map-spec", spec: decoded, slide };
    return { ...readShare(decoded, options), slide };
  }
  const specFile = new URLSearchParams(String(location.search || "")).get("spec");
  if (specFile) {
    if (!/^https?:\/\//i.test(specFile)) throw new Error("?spec= must be the https:// address of a map spec JSON file.");
    return { kind: "map-spec", spec: await fetchJson(sanitizeSharedResourceUrl(specFile, options)), slide, specUrl: specFile };
  }
  if (DOCUMENT_ONLY.test(hash.get("briefing") || "")) {
    // The slides apply to whatever layers the link loads (for example with ?layer=).
    return { kind: "briefing-document", briefing: await decodeBriefing(hash.get("briefing")), layers: [], slide };
  }
  for (const kind of KINDS) {
    if (hash.has(kind)) return { ...readShare(await decodePayload(hash.get(kind)), options), slide };
  }
  const file = new URLSearchParams(String(location.search || "")).get("briefing");
  if (file && /^https?:\/\//i.test(file)) {
    return { ...readBriefingFile(await fetchJson(sanitizeSharedResourceUrl(file, options)), options), slide };
  }
  return null;
}

/**
 * Reads a parsed briefing file (`?briefing=` or a `.gisbrief`): either the app's
 * own briefing file (a share payload) or a briefing document written against
 * schemas/briefing-v1.schema.json, alone or inside a project.
 */
export function readBriefingFile(raw, options = {}) {
  const document = raw?.k ? null : raw?.presentation?.briefing || raw;
  if (document && (document.schemaVersion !== undefined || Array.isArray(document.slides))) {
    if (document.schemaVersion !== undefined && document.schemaVersion !== 1) throw new Error("This briefing file uses a newer schema version than this app supports.");
    return { kind: "briefing-document", briefing: normalizeBriefing(document), layers: [] };
  }
  return readShare(raw, options);
}
