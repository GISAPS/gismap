// ArcGIS REST services for engines that draw data themselves (MapLibre): what
// a URL is, its fields in the contract's words, its features as GeoJSON
// (paged), and raster tile URLs for map image and imagery services. Talks to
// the services with fetch (public services only); no map SDK.
import { geometryToGeoJSON } from "../../export/export-core.js?v=0.18.2";

/** Esri field types in the names the app uses (the ArcGIS SDK's). */
const FIELD_TYPES = {
  esriFieldTypeOID: "oid", esriFieldTypeString: "string", esriFieldTypeInteger: "integer", esriFieldTypeSmallInteger: "small-integer",
  esriFieldTypeBigInteger: "big-integer", esriFieldTypeDouble: "double", esriFieldTypeSingle: "single", esriFieldTypeDate: "date",
  esriFieldTypeDateOnly: "date-only", esriFieldTypeTimeOnly: "time-only", esriFieldTypeTimestampOffset: "timestamp-offset",
  esriFieldTypeGUID: "guid", esriFieldTypeGlobalID: "global-id", esriFieldTypeGeometry: "geometry", esriFieldTypeBlob: "blob",
  esriFieldTypeRaster: "raster", esriFieldTypeXML: "xml",
};
const GEOMETRY_TYPES = { esriGeometryPoint: "point", esriGeometryMultipoint: "multipoint", esriGeometryPolyline: "polyline", esriGeometryPolygon: "polygon", esriGeometryEnvelope: "polygon" };
const WEB_MERCATOR = new Set([3857, 102100, 102113, 900913]);

/** The most features one layer brings into the browser. */
export const MAX_FEATURES = 50000;

const trim = (url) => String(url || "").trim().replace(/\/+$/, "");

/** A service's name from its URL ("USA" for …/services/USA/MapServer), as the ArcGIS engine titles map services. */
export function serviceName(url) {
  const parts = trim(url).split("?")[0].split("/");
  const index = parts.findIndex((part) => /^(MapServer|FeatureServer|ImageServer)$/i.test(part));
  const name = index > 0 ? parts[index - 1] : parts.at(-1);
  try {
    return decodeURIComponent(name || "Layer").replaceAll("_", " ");
  } catch {
    return name || "Layer";
  }
}

/** A `.../FeatureServer/0/query?where=…` URL as { layerUrl, where }, or null. */
export function parseQueryUrl(value) {
  try {
    const parsed = new URL(value);
    const match = parsed.pathname.match(/^(.*\/(?:FeatureServer|MapServer)\/\d+)\/query\/?$/i);
    if (!match) return null;
    const where = [...parsed.searchParams].find(([key]) => key.toLowerCase() === "where")?.[1]?.trim() || null;
    parsed.pathname = match[1];
    parsed.search = "";
    parsed.hash = "";
    return { layerUrl: trim(parsed.href), where: where && where !== "1=1" ? where : null };
  } catch {
    return null;
  }
}

async function getJson(url, params = {}, { fetchImpl = globalThis.fetch } = {}) {
  const target = new URL(url);
  for (const [key, value] of Object.entries({ f: "json", ...params })) if (value !== undefined && value !== null) target.searchParams.set(key, value);
  // Long object ID lists go as a form POST; ArcGIS accepts both.
  const long = target.href.length > 1800;
  const response = long
    ? await fetchImpl(`${target.origin}${target.pathname}`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: target.searchParams.toString() })
    : await fetchImpl(target.href);
  if (!response.ok) throw new Error(`The service answered HTTP ${response.status}.`);
  const json = await response.json();
  if (json?.error) {
    const message = json.error.message || "The service returned an error.";
    throw new Error(/token|authoriz|permission/i.test(message) ? `${message} Secured services need the ArcGIS engine and an ArcGIS connection.` : message);
  }
  return json;
}

/** Fields in the contract's shape (engine-interface.js Field). */
export function serviceFields(json) {
  return (json.fields || []).map((field) => {
    const domain = field.domain;
    return {
      name: field.name,
      alias: field.alias || field.name,
      type: FIELD_TYPES[field.type] || String(field.type || "string"),
      ...(field.length != null ? { length: field.length } : {}),
      ...(field.nullable != null ? { nullable: field.nullable } : {}),
      domain: domain?.type === "codedValue"
        ? { type: "coded-value", name: domain.name ?? null, codedValues: (domain.codedValues || []).map((item) => ({ code: item.code, name: item.name })) }
        : domain?.type === "range" ? { type: "range", name: domain.name ?? null, minValue: domain.range?.[0], maxValue: domain.range?.[1] } : null,
    };
  });
}

/**
 * What an ArcGIS REST URL is: { kind: "feature" | "map-image" | "imagery" | "service-root",
 * url, json, … }. Feature layers (FeatureServer/n, or a MapServer/n that holds
 * features) are drawn as data; map and image services as images.
 */
export async function describeArcGIS(value, options = {}) {
  const query = parseQueryUrl(value);
  const url = query?.layerUrl || trim(value);
  const json = await getJson(url, {}, options);
  const path = new URL(url).pathname;
  const sublayer = url.split("?")[0].match(/^(.*\/MapServer)\/(\d+)$/i);
  if (json.type === "Feature Layer" || (json.geometryType && Array.isArray(json.fields))) {
    return {
      kind: "feature",
      url,
      json,
      where: query?.where || null,
      title: json.name || null,
      layerId: Number.isInteger(json.id) ? json.id : null,
      fields: serviceFields(json),
      objectIdField: json.objectIdField || (json.fields || []).find((field) => field.type === "esriFieldTypeOID")?.name || null,
      displayField: json.displayField || null,
      geometryType: GEOMETRY_TYPES[json.geometryType] || null,
      renderer: json.drawingInfo?.renderer || null,
      transparency: json.drawingInfo?.transparency || 0,
      minScale: json.minScale || 0,
      maxScale: json.maxScale || 0,
      maxRecordCount: json.maxRecordCount || 1000,
      paginated: json.advancedQueryCapabilities?.supportsPagination !== false && json.supportsPagination !== false,
    };
  }
  if (sublayer) {
    // A MapServer sublayer without features to fetch (raster, group): the service draws it.
    const root = sublayer[1];
    return { kind: "map-image", url: root, layers: [Number(sublayer[2])], json, title: json.name ? `${serviceName(root)} — ${json.name}` : serviceName(root), tiles: exportTiles(root, { layers: [Number(sublayer[2])] }) };
  }
  if (/\/ImageServer$/i.test(path)) {
    return { kind: "imagery", url, json, title: serviceName(url), tiles: cachedTiles(url, json) || exportTiles(url, { image: true }) };
  }
  if (/\/MapServer$/i.test(path)) {
    return { kind: "map-image", url, json, title: json.documentInfo?.Title || serviceName(url), tiles: cachedTiles(url, json) || exportTiles(url) };
  }
  if (/\/FeatureServer$/i.test(path)) return { kind: "service-root", url, json };
  throw new Error("That URL is not an ArcGIS feature layer, map service or image service.");
}

/** Tile URLs for a service cached in Web Mercator, or null. */
function cachedTiles(url, json) {
  const wkid = json.tileInfo?.spatialReference?.latestWkid ?? json.tileInfo?.spatialReference?.wkid;
  if (!json.singleFusedMapCache || !WEB_MERCATOR.has(wkid)) return null;
  return { urls: [`${url}/tile/{z}/{y}/{x}`], tileSize: json.tileInfo?.rows || 256, maxzoom: Math.max(0, (json.tileInfo?.lods?.length || 20) - 1) };
}

/** Tile URLs that ask the service to draw each tile (export / exportImage) in Web Mercator. */
function exportTiles(url, { layers = null, image = false } = {}) {
  // png32: areas without data come back transparent rather than black.
  const params = new URLSearchParams({ bbox: "BBOX", bboxSR: "3857", imageSR: "3857", size: "512,512", format: "png32", transparent: "true", f: "image" });
  if (layers) params.set("layers", `show:${layers.join(",")}`);
  if (!image) params.set("dpi", "96");
  return { urls: [`${url}/${image ? "exportImage" : "export"}?${params.toString().replace("BBOX", "{bbox-epsg-3857}")}`], tileSize: 512, maxzoom: 22 };
}

/** The feature layers a FeatureServer lists: [{ id, name, geometryType, url }]. */
export async function featureServiceLayers(rootUrl, options = {}) {
  const url = trim(rootUrl);
  const json = await getJson(url, {}, options);
  return (json.layers || [])
    .filter((layer) => Number.isInteger(layer.id) && !Array.isArray(layer.subLayerIds))
    .map((layer) => ({ id: layer.id, name: layer.name || `Layer ${layer.id}`, geometryType: layer.geometryType || "Feature Layer", url: `${url}/${layer.id}` }));
}

/** Esri JSON features as GeoJSON (when a service cannot answer f=geojson). */
function esriToGeoJSON(json) {
  return (json.features || []).map((feature) => ({ type: "Feature", geometry: feature.geometry ? geometryToGeoJSON({ ...feature.geometry, spatialReference: feature.geometry.spatialReference || json.spatialReference }) : null, properties: feature.attributes || {} }));
}

/**
 * A feature layer's features as GeoJSON features (WGS84), paged, at most
 * MAX_FEATURES: { features, truncated }. `where` filters on the service.
 */
export async function fetchFeatures(layer, { where = null, maxFeatures = MAX_FEATURES, onProgress = () => {}, onPage = () => {}, simplify = null, concurrency = 3, outFields = "*", ...options } = {}) {
  // Full-detail polygons can be megabytes per page, so pages stay small; with
  // `simplify` ({ maxAllowableOffset, geometryPrecision } in degrees) the service
  // sends outlines generalized to that tolerance, a fraction of the size, and pages can be full.
  const pageSize = Math.max(1, Math.min(layer.maxRecordCount || 1000, layer.geometryType === "polygon" && !simplify ? 500 : 2000));
  const base = {
    where: where || "1=1", outFields, returnGeometry: "true", outSR: "4326",
    ...(simplify ? { maxAllowableOffset: String(simplify.maxAllowableOffset), geometryPrecision: String(simplify.geometryPrecision ?? 6) } : {}),
  };
  let geojson = true;
  const page = async (params) => {
    if (geojson) {
      try {
        const json = await getJson(`${layer.url}/query`, { ...base, ...params, f: "geojson" }, options);
        if (Array.isArray(json.features)) return { features: json.features, exceeded: Boolean(json.exceededTransferLimit || json.properties?.exceededTransferLimit) };
      } catch {
        // Older servers answer f=geojson with an error; Esri JSON works everywhere.
      }
      geojson = false;
    }
    const json = await getJson(`${layer.url}/query`, { ...base, ...params }, options);
    return { features: esriToGeoJSON(json), exceeded: Boolean(json.exceededTransferLimit) };
  };
  const features = [];
  if (layer.paginated) {
    const requestPage = (offset) => page({ resultOffset: String(offset), resultRecordCount: String(Math.min(pageSize, maxFeatures - offset)), ...(layer.objectIdField ? { orderByFields: layer.objectIdField } : {}) });
    // Resolve the response format before starting concurrent requests. This
    // avoids racing the GeoJSON-to-Esri fallback on older services.
    let offset = 0;
    let pending = [await requestPage(offset)];
    while (offset < maxFeatures) {
      for (const result of pending) {
        if (result.status === "rejected") throw result.reason;
        const { features: batch, exceeded } = result.status === "fulfilled" ? result.value : result;
        features.push(...batch);
        onPage(batch);
        onProgress(features.length);
        const requested = Math.min(pageSize, maxFeatures - offset);
        offset += requested;
        if (!batch.length || (!exceeded && batch.length < requested)) return { features, truncated: false };
      }
      // Keep only three pages in flight: complex polygon geometries can make
      // each response large, especially on mobile devices. Process results in
      // offset order, including errors, so later speculative pages cannot
      // hide a failed page or change feature ordering.
      const offsets = Array.from({ length: concurrency }, (_, index) => offset + index * pageSize).filter((start) => start < maxFeatures);
      if (!offsets.length) break;
      pending = await Promise.allSettled(offsets.map(requestPage));
    }
    return { features, truncated: true };
  }
  // No paging: the object IDs first, then features by ID in batches.
  const ids = (await getJson(`${layer.url}/query`, { where: base.where, returnIdsOnly: "true" }, options)).objectIds || [];
  ids.sort((a, b) => a - b);
  for (let start = 0; start < Math.min(ids.length, maxFeatures); start += pageSize) {
    const { features: batch } = await page({ objectIds: ids.slice(start, Math.min(start + pageSize, maxFeatures)).join(",") });
    features.push(...batch);
    onPage(batch);
    onProgress(features.length);
  }
  return { features, truncated: ids.length > maxFeatures };
}

const SPATIAL_RELATIONS = {
  intersects: "esriSpatialRelIntersects", contains: "esriSpatialRelContains", within: "esriSpatialRelWithin",
  crosses: "esriSpatialRelCrosses", overlaps: "esriSpatialRelOverlaps", touches: "esriSpatialRelTouches",
  "envelope-intersects": "esriSpatialRelEnvelopeIntersects", "index-intersects": "esriSpatialRelIndexIntersects", relation: "esriSpatialRelRelation",
};
const DISTANCE_UNITS = {
  meters: "esriSRUnit_Meter", kilometers: "esriSRUnit_Kilometer", feet: "esriSRUnit_Foot", miles: "esriSRUnit_StatuteMile",
  "nautical-miles": "esriSRUnit_NauticalMile", "us-nautical-miles": "esriSRUnit_USNauticalMile",
};

/** GeoJSON (or ArcGIS JSON) geometry as an ArcGIS query geometry: { geometry, geometryType }. */
export function queryGeometry(geometry) {
  if (!geometry) return null;
  if (Number.isFinite(geometry.xmin)) return { geometry: { spatialReference: { wkid: 4326 }, ...geometry }, geometryType: "esriGeometryEnvelope" };
  if (Number.isFinite(geometry.x)) return { geometry: { spatialReference: { wkid: 4326 }, ...geometry }, geometryType: "esriGeometryPoint" };
  if (geometry.rings) return { geometry: { spatialReference: { wkid: 4326 }, ...geometry }, geometryType: "esriGeometryPolygon" };
  if (geometry.paths) return { geometry: { spatialReference: { wkid: 4326 }, ...geometry }, geometryType: "esriGeometryPolyline" };
  if (geometry.points) return { geometry: { spatialReference: { wkid: 4326 }, ...geometry }, geometryType: "esriGeometryMultipoint" };
  const sr = { wkid: 4326 };
  switch (geometry.type) {
    case "Point": return { geometry: { x: geometry.coordinates[0], y: geometry.coordinates[1], spatialReference: sr }, geometryType: "esriGeometryPoint" };
    case "MultiPoint": return { geometry: { points: geometry.coordinates, spatialReference: sr }, geometryType: "esriGeometryMultipoint" };
    case "LineString": return { geometry: { paths: [geometry.coordinates], spatialReference: sr }, geometryType: "esriGeometryPolyline" };
    case "MultiLineString": return { geometry: { paths: geometry.coordinates, spatialReference: sr }, geometryType: "esriGeometryPolyline" };
    case "Polygon": return { geometry: { rings: geometry.coordinates, spatialReference: sr }, geometryType: "esriGeometryPolygon" };
    case "MultiPolygon": return { geometry: { rings: geometry.coordinates.flat(), spatialReference: sr }, geometryType: "esriGeometryPolygon" };
    default: return null;
  }
}

/**
 * The object IDs of a feature layer's features in a spatial relationship with
 * a geometry, answered by the service (as the ArcGIS engine's queries are).
 */
export async function queryServiceIds(layer, { where = null, geometry, spatialRelationship = "intersects", distance = null, units = "meters", relationParameter = null } = {}, options = {}) {
  const shape = queryGeometry(geometry);
  const relation = SPATIAL_RELATIONS[spatialRelationship];
  if (!shape || !relation) throw new Error(`The service cannot answer “${spatialRelationship}” queries.`);
  const json = await getJson(`${layer.url}/query`, {
    where: where || "1=1",
    geometry: JSON.stringify(shape.geometry),
    geometryType: shape.geometryType,
    inSR: "4326",
    spatialRel: relation,
    ...(relation === "esriSpatialRelRelation" && relationParameter ? { relationParam: relationParameter } : {}),
    ...(Number(distance) > 0 ? { distance: String(distance), units: DISTANCE_UNITS[units] || DISTANCE_UNITS.meters } : {}),
    returnIdsOnly: "true",
  }, options);
  return json.objectIds || [];
}

/**
 * Geometries only, for features in a box, at a given detail: the features a
 * zoomed-in view shows, refetched sharper than the overview. [{ id, geometry }].
 */
export async function fetchGeometries(layer, { bounds, maxAllowableOffset, where = null, limit = 2000 } = {}, options = {}) {
  const [xmin, ymin, xmax, ymax] = bounds;
  const json = await getJson(`${layer.url}/query`, {
    where: where || "1=1", geometry: JSON.stringify({ xmin, ymin, xmax, ymax, spatialReference: { wkid: 4326 } }), geometryType: "esriGeometryEnvelope", inSR: "4326",
    spatialRel: "esriSpatialRelIntersects", outFields: layer.objectIdField || "", returnGeometry: "true", outSR: "4326",
    maxAllowableOffset: String(maxAllowableOffset), geometryPrecision: "6", resultRecordCount: String(limit), f: "geojson",
  }, options).catch(() => null);
  return (json?.features || []).map((feature) => ({ id: Number(feature.properties?.[layer.objectIdField] ?? feature.id), geometry: feature.geometry })).filter((item) => Number.isFinite(item.id) && item.geometry);
}
