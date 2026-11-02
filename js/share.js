import { BASEMAP_IDS } from "./basemap-catalog.js?v=0.53.0-gallery1";

const ALLOWED_PROTOCOLS = new Set(["https:", "http:"]);
const SENSITIVE_PARAMETER = /^(?:token|oauth[_-]?token|access[_-]?token|api[_-]?key|apikey|key|client[_-]?secret|password|passwd|pwd|authorization|auth|signature|sig)$/i;
const SUPPORTED_TYPES = new Set(["arcgis-auto", "feature", "map-image", "imagery", "geojson", "geoparquet", "wms", "wfs", "kml", "pointcloud", "model", "vector-tiles"]);
const SUPPORTED_BASEMAPS = new Set(BASEMAP_IDS);
const MAX_LAYERS = 10;
const CAMERA_ZOOM_MODES = new Set(["layers", "none"]);
const STYLE_NAMES = new Set(["service", "simple", "choropleth", "graduated", "categories", "heatmap", "auto"]);
const MAX_URL_LENGTH = 4096;

export function sanitizeSharedResourceUrl(value, { allowHttp = false } = {}) {
  let parsed;
  try {
    parsed = new URL(String(value ?? "").trim());
  } catch {
    throw new Error("A shared layer contains an invalid URL.");
  }
  if (!ALLOWED_PROTOCOLS.has(parsed.protocol) || (parsed.protocol === "http:" && !allowHttp)) {
    throw new Error("Shared layers must use HTTPS.");
  }
  if (parsed.username || parsed.password) {
    throw new Error("Shared layer URLs cannot contain a username or password.");
  }
  const sensitive = [...parsed.searchParams.keys()].find((key) => SENSITIVE_PARAMETER.test(key));
  if (sensitive) {
    throw new Error(`Remove the credential parameter “${sensitive}” before sharing this layer.`);
  }
  parsed.hash = "";
  if (parsed.href.length > MAX_URL_LENGTH) throw new Error("A shared layer URL is too long.");
  return parsed.href;
}

export function parseShareParameters(search, catalog = [], options = {}) {
  const params = new URLSearchParams(String(search ?? "").replace(/^\?/, ""));
  const rawLayers = params.getAll("layer");
  const rawTypes = params.getAll("layerType");
  if (rawLayers.length > MAX_LAYERS) throw new Error(`A shared map can load at most ${MAX_LAYERS} layers.`);

  // Simple styling without JSON, index-aligned with layer=: title, where, style,
  // field, classes, method, breaks, ramp, exclude, color, opacity (js/map-spec.js turns it into a RendererSpec).
  const aligned = (name) => params.getAll(name);
  const STYLE_KEYS = ["style", "field", "classes", "method", "breaks", "ramp", "exclude", "color"];
  const layers = rawLayers.map((url, index) => {
    const serviceType = rawTypes[index] || "arcgis-auto";
    if (!SUPPORTED_TYPES.has(serviceType)) throw new Error(`Unsupported shared layer type: ${serviceType}.`);
    const layer = { url: sanitizeSharedResourceUrl(url, options), serviceType };
    const title = aligned("title")[index]?.trim();
    const where = aligned("where")[index]?.trim();
    const opacity = aligned("opacity")[index];
    if (title) layer.title = title.slice(0, 160);
    if (where) layer.where = where.slice(0, 2000);
    if (opacity !== undefined && opacity !== "") {
      const value = Number(opacity);
      if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error("opacity must be a number from 0 to 1.");
      layer.opacity = value;
    }
    const style = Object.fromEntries(STYLE_KEYS.map((key) => [key, aligned(key)[index]?.trim()]).filter(([, value]) => value));
    if (style.style) {
      if (!STYLE_NAMES.has(style.style)) throw new Error(`Unsupported style: ${style.style}. Use ${[...STYLE_NAMES].join(", ")}.`);
      layer.style = style;
    }
    return layer;
  });
  const example = params.get("example")?.trim() || null;
  if (example) {
    const entry = catalog.find((item) => (item.slug || item.id) === example);
    if (!entry) throw new Error(`Unknown GISMap Online example: ${example}.`);
    const exampleLayers = Array.isArray(entry.layers) && entry.layers.length ? entry.layers : [entry];
    for (const item of exampleLayers) {
      const layer = {
        url: sanitizeSharedResourceUrl(item.url, options),
        serviceType: item.serviceType || entry.serviceType || "arcgis-auto",
        title: item.title || entry.title,
        refreshInterval: item.refreshInterval ?? entry.refreshInterval,
      };
      if (item.renderer || entry.renderer) layer.renderer = structuredClone(item.renderer || entry.renderer);
      if (item.animatedEffect || entry.animatedEffect) layer.animatedEffect = structuredClone(item.animatedEffect || entry.animatedEffect);
      layers.push(layer);
    }
  }
  if (layers.length > MAX_LAYERS) throw new Error(`A shared map can load at most ${MAX_LAYERS} layers.`);
  const basemap = params.get("basemap")?.trim() || null;
  if (basemap && !SUPPORTED_BASEMAPS.has(basemap)) throw new Error(`Unsupported shared basemap: ${basemap}.`);
  return { layers, basemap, example, camera: parseCameraParameters(params) };
}

/**
 * Where a link's map should look. `zoom=layers` (the default when no camera is
 * given) fits the loaded data, `zoom=none` keeps the starting view, and
 * `center=lon,lat` with `scale=` or `level=` sets a view. The scene is always
 * 3D, so there is no 2D/3D switch.
 */
export function parseCameraParameters(params) {
  const zoom = params.get("zoom")?.trim().toLowerCase() || null;
  if (zoom && !CAMERA_ZOOM_MODES.has(zoom)) throw new Error(`Unsupported zoom mode: ${zoom}. Use "layers" or "none".`);
  const centerText = params.get("center")?.trim();
  let center = null;
  if (centerText) {
    const parts = centerText.split(",").map((part) => Number(part.trim()));
    if (parts.length !== 2 || !parts.every(Number.isFinite) || Math.abs(parts[0]) > 180 || Math.abs(parts[1]) > 90) {
      throw new Error("center must be longitude,latitude in degrees, such as center=-98.5,39.5.");
    }
    center = parts;
  }
  const number = (name, min, max) => {
    const text = params.get(name)?.trim();
    if (!text) return null;
    const value = Number(text);
    if (!Number.isFinite(value) || value < min || value > max) throw new Error(`${name} must be a number from ${min} to ${max}.`);
    return value;
  };
  const scale = number("scale", 1, 600000000);
  const level = number("level", 0, 24);
  if ((scale != null || level != null) && !center) throw new Error("scale and level need a center (center=lon,lat).");
  if (scale != null && level != null) throw new Error("Use either scale or level, not both.");
  const mode = zoom || (center ? "none" : "layers");
  return { zoom: mode, center, scale, level };
}

export function createShareUrl({ baseUrl, layers = [], basemap = null }) {
  const url = new URL(baseUrl);
  url.search = "";
  url.hash = "";
  const remoteLayers = layers.filter((layer) => layer?.url && !layer.local);
  if (!remoteLayers.length) throw new Error("Add at least one public remote layer before creating a share link.");
  if (remoteLayers.length > MAX_LAYERS) throw new Error(`A shared map can include at most ${MAX_LAYERS} layers.`);
  for (const layer of remoteLayers) {
    url.searchParams.append("layer", sanitizeSharedResourceUrl(layer.url));
    url.searchParams.append("layerType", SUPPORTED_TYPES.has(layer.sourceType) ? layer.sourceType : "arcgis-auto");
  }
  if (basemap) {
    if (!SUPPORTED_BASEMAPS.has(basemap)) throw new Error(`Unsupported shared basemap: ${basemap}.`);
    url.searchParams.set("basemap", basemap);
  }
  return url.href;
}

// Read by nothing in the app: `via` credits the tool that wrote a link, for aggregate counts.
export const SHARE_IGNORED_PARAMETERS = Object.freeze(["via"]);
export const SHARE_LIMITS = Object.freeze({ maxLayers: MAX_LAYERS, maxUrlLength: MAX_URL_LENGTH });
export const SHARE_LAYER_TYPES = SUPPORTED_TYPES;
export const SHARE_BASEMAPS = SUPPORTED_BASEMAPS;
export const SHARE_CAMERA_ZOOM_MODES = CAMERA_ZOOM_MODES;
export const SHARE_STYLE_NAMES = STYLE_NAMES;
