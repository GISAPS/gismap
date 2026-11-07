import { sanitizeSharedResourceUrl } from "./share.js?v=0.69.8-skin";
import { GisMapError, toGisMapError } from "./gismap-errors.js?v=0.54.0-print";

const MAX_FIELDS = 500;
const MAX_SAMPLE_FEATURES = 25;
// Features read to spot unlabelled sentinel values (flagged only, never applied).
const SENTINEL_SAMPLE = 200;
const SENTINEL_CANDIDATES = [-1, -9999, -999, 999999];
/** Labels publishers give to "no real value" codes such as -1. */
export const SENTINEL_LABEL = /not\s*disclosed|no\s*data|withheld|\(d\)|suppressed|not\s*available|n\/a|unknown|confidential|missing/i;

const fieldRole = (field = {}) => {
  const type = String(field.type || "").toLowerCase();
  if (type.includes("date")) return "timestamp";
  if (/integer|double|single|small|oid|long/.test(type)) return "numeric";
  return "text";
};

const isoDate = (value) => (Number.isFinite(value) && value > 0 ? new Date(value).toISOString() : null);

/** A WGS84 [west, south, east, north] box from an ArcGIS extent in 4326 or Web Mercator, else null. */
export function wgs84Extent(extent) {
  if (!extent || ![extent.xmin, extent.ymin, extent.xmax, extent.ymax].every(Number.isFinite)) return null;
  const wkid = extent.spatialReference?.latestWkid ?? extent.spatialReference?.wkid;
  const round = (value) => Number(value.toFixed(5));
  if ([4326, 4269].includes(wkid)) return [extent.xmin, extent.ymin, extent.xmax, extent.ymax].map(round);
  if ([3857, 102100, 102113].includes(wkid)) {
    const radius = 6378137;
    const lon = (x) => (x / radius) * (180 / Math.PI);
    const lat = (y) => (2 * Math.atan(Math.exp(y / radius)) - Math.PI / 2) * (180 / Math.PI);
    return [lon(extent.xmin), lat(extent.ymin), lon(extent.xmax), lat(extent.ymax)].map(round);
  }
  return null;
}

/**
 * "No real value" codes a layer uses, such as -1 for "Not Disclosed". From the
 * publisher's own renderer (a class or category labelled like "No data") and
 * coded-value domains; with sample features, values like -9999 that appear in
 * more than 1% of them are added as `heuristic` (reported, never applied by default).
 */
export function detectSentinels(raw = {}, sampleFeatures = []) {
  const found = new Map();
  const add = (field, value, label, source) => {
    if (!field || value === null || value === undefined) return;
    const key = `${field}\u0000${value}`;
    if (!found.has(key)) found.set(key, { field, value, label: String(label || "No data"), source });
  };
  const renderer = raw.drawingInfo?.renderer;
  if (renderer?.type === "classBreaks" && renderer.field) {
    for (const info of renderer.classBreakInfos || []) {
      const max = info.classMaxValue;
      // A non-positive class with a "no data" label (Corn: -1, "Not Disclosed") is a code, not a measurement.
      if (Number.isFinite(max) && max <= 0 && SENTINEL_LABEL.test(info.label || "")) add(renderer.field, max, info.label, "renderer");
    }
  }
  if (renderer?.type === "uniqueValue" && renderer.field1) {
    for (const info of renderer.uniqueValueInfos || []) {
      if (SENTINEL_LABEL.test(info.label || "")) add(renderer.field1, typeof info.value === "string" && /^-?\d+(\.\d+)?$/.test(info.value) ? Number(info.value) : info.value, info.label, "renderer");
    }
  }
  for (const field of raw.fields || []) {
    for (const code of field.domain?.type === "codedValue" ? field.domain.codedValues || [] : []) {
      if (SENTINEL_LABEL.test(code.name || "")) add(field.name, code.code, code.name, "domain");
    }
  }
  if (sampleFeatures.length) {
    const numeric = (raw.fields || []).filter((field) => fieldRole(field) === "numeric" && !/oid|globalid/i.test(field.type));
    for (const field of numeric) {
      for (const candidate of SENTINEL_CANDIDATES) {
        const hits = sampleFeatures.filter((feature) => feature?.attributes?.[field.name] === candidate).length;
        if (hits / sampleFeatures.length > 0.01 && !found.has(`${field.name}\u0000${candidate}`)) add(field.name, candidate, "Possible no-data code", "heuristic");
      }
    }
  }
  return [...found.values()];
}

/** Metadata from an ArcGIS REST layer or service JSON (as fetched, or a loaded layer's sourceJSON). */
export function arcgisMetadata(raw, url) {
  const fields = (raw.fields || []).slice(0, MAX_FIELDS).map((field) => ({
    name: String(field.name),
    alias: String(field.alias || field.name),
    type: String(field.type || "unknown"),
    role: fieldRole(field),
    nullable: field.nullable !== false,
  }));
  const capabilities = String(raw.capabilities || "").split(",").map((item) => item.trim()).filter(Boolean);
  const editing = raw.editingInfo || {};
  return {
    kind: Array.isArray(raw.layers) ? "arcgis-service" : "arcgis-layer",
    url,
    title: String(raw.name || raw.mapName || raw.documentInfo?.Title || "ArcGIS source"),
    description: String(raw.description || raw.serviceDescription || ""),
    geometryType: raw.geometryType || null,
    objectIdField: raw.objectIdField || raw.objectIdFieldName || fields.find((field) => /oid/i.test(field.type))?.name || null,
    maxRecordCount: Number.isFinite(raw.maxRecordCount) ? raw.maxRecordCount : null,
    capabilities,
    fields,
    layers: (raw.layers || []).map((layer) => ({ id: layer.id, name: String(layer.name || `Layer ${layer.id}`) })),
    // The publisher's scale range: 0 means no limit. maxScale 144447 hides the layer when zoomed in past 1:144,447.
    minScale: Number.isFinite(raw.minScale) ? raw.minScale : 0,
    maxScale: Number.isFinite(raw.maxScale) ? raw.maxScale : 0,
    extent: wgs84Extent(raw.extent),
    spatialReference: raw.extent?.spatialReference || raw.spatialReference || null,
    lastEditDate: isoDate(editing.lastEditDate),
    dataLastEditDate: isoDate(editing.dataLastEditDate),
    schemaLastEditDate: isoDate(editing.schemaLastEditDate),
    featureCount: null,
    // Unknown is distinct from false: service metadata is often incomplete.
    supportsPagination: raw.advancedQueryCapabilities?.supportsPagination ?? raw.supportsPagination ?? null,
    supportsStatistics: Boolean(raw.supportsStatistics ?? raw.advancedQueryCapabilities?.supportsStatistics),
    attribution: String(raw.copyrightText || ""),
    access: { metadataReadable: true, authentication: "unknown", cors: "not-verified" },
    supportsGenerateRenderer: capabilities.some((item) => /^(query|map)$/i.test(item)),
    sentinels: detectSentinels(raw),
  };
}

function geoJsonMetadata(raw, url) {
  const features = Array.isArray(raw.features) ? raw.features.slice(0, MAX_SAMPLE_FEATURES) : [];
  const names = [...new Set(features.flatMap((feature) => Object.keys(feature?.properties || {})))].slice(0, MAX_FIELDS);
  const fields = names.map((name) => {
    const values = features.map((feature) => feature?.properties?.[name]).filter((value) => value != null);
    const numeric = values.length > 0 && values.every((value) => typeof value === "number" && Number.isFinite(value));
    return { name, alias: name, type: numeric ? "number" : "string", role: numeric ? "numeric" : "text", nullable: values.length < features.length };
  });
  const geometryTypes = [...new Set(features.map((feature) => feature?.geometry?.type).filter(Boolean))];
  const sample = features.map((feature) => ({ attributes: feature?.properties || {} }));
  return {
    kind: "geojson",
    url,
    title: String(raw.name || "GeoJSON source"),
    description: String(raw.description || ""),
    geometryType: geometryTypes.length === 1 ? geometryTypes[0] : geometryTypes.length ? "Mixed" : null,
    objectIdField: null,
    maxRecordCount: Array.isArray(raw.features) ? raw.features.length : null,
    capabilities: ["loaded-query", "loaded-statistics"],
    fields,
    layers: [],
    minScale: 0,
    maxScale: 0,
    extent: Array.isArray(raw.bbox) && raw.bbox.length >= 4 ? raw.bbox.slice(0, 4) : null,
    spatialReference: { wkid: 4326 },
    lastEditDate: null,
    dataLastEditDate: null,
    schemaLastEditDate: null,
    featureCount: Array.isArray(raw.features) ? raw.features.length : null,
    supportsPagination: false,
    supportsStatistics: false,
    attribution: String(raw.copyright || ""),
    access: { metadataReadable: true, authentication: "unknown", cors: "not-verified" },
    supportsGenerateRenderer: false,
    sentinels: detectSentinels({ fields: fields.map((field) => ({ name: field.name, type: field.role === "numeric" ? "esriFieldTypeDouble" : "esriFieldTypeString" })) }, sample),
  };
}

/**
 * Inspect public ArcGIS REST or GeoJSON metadata without loading it into the map.
 * For an ArcGIS layer that supports queries, two small queries add the feature
 * count and a sample for spotting sentinel values (`sample: false` skips them).
 */
export async function inspectSource(value, { fetchImpl = globalThis.fetch, signal, allowHttp = false, sample = true } = {}) {
  if (typeof fetchImpl !== "function") throw new GisMapError("NOT_READY", "Source inspection requires fetch().");
  let url;
  try { url = sanitizeSharedResourceUrl(value, { allowHttp }); } catch (error) { throw toGisMapError(error, "INVALID_URL", { url: String(value) }); }
  const target = new URL(url);
  const looksArcGis = /\/rest\/services\//i.test(target.pathname) || /\/(?:Feature|Map|Image)Server(?:\/\d+)?\/?$/i.test(target.pathname);
  const getJson = async (href, what) => {
    let response;
    try {
      response = await fetchImpl(href, { headers: { Accept: "application/json, application/geo+json" }, signal });
    } catch (error) {
      if (error?.name === "AbortError") throw error;
      throw new GisMapError("CORS_BLOCKED", "The source could not be read. Check its URL, CORS policy, and network availability.", { cause: error, details: { url } });
    }
    if (!response.ok) throw new GisMapError("SERVICE_ERROR", `The source returned HTTP ${response.status}.`, { details: { url, status: response.status } });
    let json;
    try { json = await response.json(); } catch (error) { throw new GisMapError("SERVICE_ERROR", `The source did not return JSON ${what}.`, { cause: error, details: { url } }); }
    if (json?.error) throw new GisMapError("SERVICE_ERROR", String(json.error.message || "The ArcGIS service rejected the request."), { details: { url, error: json.error } });
    return json;
  };
  if (looksArcGis) target.searchParams.set("f", "json");
  const raw = await getJson(target.href, "metadata");
  if (looksArcGis || raw?.currentVersion || raw?.geometryType || Array.isArray(raw?.layers)) {
    const metadata = arcgisMetadata(raw, url);
    if (sample && metadata.kind === "arcgis-layer" && metadata.capabilities.some((item) => /^query$/i.test(item))) {
      const query = (params) => {
        const queryUrl = new URL(`${url.replace(/\/+$/, "").replace(/\/query$/i, "")}/query`);
        Object.entries({ where: "1=1", f: "json", ...params }).forEach(([key, item]) => queryUrl.searchParams.set(key, item));
        return getJson(queryUrl.href, "query results").catch(() => null);
      };
      const [count, features] = await Promise.all([
        query({ returnCountOnly: "true" }),
        query({ outFields: "*", returnGeometry: "false", resultRecordCount: String(SENTINEL_SAMPLE) }),
      ]);
      if (Number.isFinite(count?.count)) metadata.featureCount = count.count;
      if (Array.isArray(features?.features)) metadata.sentinels = detectSentinels(raw, features.features);
    }
    return metadata;
  }
  if (raw?.type === "FeatureCollection" && Array.isArray(raw.features)) return geoJsonMetadata(raw, url);
  throw new GisMapError("UNSUPPORTED_LAYER_TYPE", "The source is neither supported ArcGIS REST metadata nor a GeoJSON FeatureCollection.", { details: { url } });
}
