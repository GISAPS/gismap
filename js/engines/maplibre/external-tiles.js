// Browser-only external tile discovery. This module does not fetch or execute
// remote styles; providers' tiles and metadata remain subject to CORS.
import { sanitizeSharedResourceUrl } from "../../share.js?v=0.69.3-fire";

export const PMTILES_SCRIPT = "https://unpkg.com/pmtiles@4.5.0/dist/pmtiles.js";
const TYPES = new Set(["auto", "pmtiles", "vector-xyz", "raster-xyz", "vector-tilejson", "raster-tilejson"]);
const protocols = new WeakMap();
let loading = null;

export function tileUrl(value, options = {}) {
  const sanitized = sanitizeSharedResourceUrl(value, options);
  // URL serialisation escapes braces in pathnames, but MapLibre requires the
  // literal template tokens. Never unescape any other URL contents.
  return sanitized.replace(/%7B(z|x|y|quadkey|bbox-epsg-3857)%7D/gi, (_, token) => `{${token.toLowerCase()}}`);
}

export function detectTileType(url) {
  const text = String(url || "").toLowerCase();
  const path = text.split(/[?#]/)[0];
  if (path.endsWith(".pmtiles")) return "pmtiles";
  if (path.includes("{z}") && path.includes("{x}") && path.includes("{y}")) {
    if (/\.(pbf|mvt|mlt)$/.test(path)) return "vector-xyz";
    if (/\.(png|jpe?g|webp|avif)$/.test(path)) return "raster-xyz";
  }
  return null; // JSON and unknown templates need inspection or a manual choice.
}

export async function loadPmtiles({ documentRef = globalThis.document, globalRef = globalThis } = {}) {
  if (globalRef.pmtiles?.PMTiles && globalRef.pmtiles?.Protocol) return globalRef.pmtiles;
  if (loading) return loading;
  if (!documentRef?.head) throw new Error("PMTiles requires a browser document.");
  loading = new Promise((resolve, reject) => {
    const script = documentRef.createElement("script");
    script.src = PMTILES_SCRIPT;
    script.addEventListener("load", () => globalRef.pmtiles?.PMTiles && globalRef.pmtiles?.Protocol
      ? resolve(globalRef.pmtiles) : reject(new Error("The PMTiles library did not initialize.")), { once: true });
    script.addEventListener("error", () => reject(new Error("The PMTiles library could not be loaded. Check your network or content security policy.")), { once: true });
    documentRef.head.append(script);
  }).catch((error) => { loading = null; throw error; });
  return loading;
}

/** One registered protocol per library instance, even when several maps exist. */
export async function registerPmtiles(maplibre, options = {}) {
  if (!maplibre?.addProtocol) throw new Error("MapLibre is not ready.");
  if (protocols.has(maplibre)) return protocols.get(maplibre);
  // Store the promise before loading so simultaneous callers cannot register twice.
  const promise = loadPmtiles(options).then((library) => {
    const protocol = new library.Protocol();
    maplibre.addProtocol("pmtiles", protocol.tile);
    return { protocol, library };
  }).catch((error) => { protocols.delete(maplibre); throw error; });
  protocols.set(maplibre, promise);
  return promise;
}

function metadataLayers(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 200).flatMap((layer) => {
    if (!layer || typeof layer.id !== "string" || !layer.id.trim()) return [];
    const fields = layer.fields && typeof layer.fields === "object" && !Array.isArray(layer.fields)
      ? Object.entries(layer.fields).slice(0, 500).map(([name, type]) => ({ name: String(name).slice(0, 255), type: String(type).slice(0, 80) })) : [];
    return [{ id: layer.id.slice(0, 255), fields }];
  });
}

function boundsOf(value) {
  if (!Array.isArray(value) || value.length !== 4 || !value.every(Number.isFinite)) return null;
  const [west, south, east, north] = value;
  return west >= -180 && east <= 180 && south >= -90 && north <= 90 && west <= east && south <= north ? value : null;
}

async function fetchChecked(url, options, fetchImpl) {
  let response;
  try { response = await fetchImpl(url, options); } catch (error) {
    if (error?.name === "AbortError") throw error;
    throw new Error("The tile provider could not be reached. Check the URL, network connection, and provider CORS policy.", { cause: error });
  }
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw new Error(`The tile provider denied access (HTTP ${response.status}). Check your authorization with the provider.`);
    throw new Error(`The tile provider returned HTTP ${response.status}.`);
  }
  return response;
}

/** Discover archive metadata or TileJSON; XYZ templates have no discoverable metadata. */
export async function inspectExternalTiles(value, { type = "auto", allowHttp = false, fetchImpl = globalThis.fetch, maplibre, signal, pmtilesOptions } = {}) {
  if (!TYPES.has(type)) throw new Error("Unsupported external tile format.");
  const url = tileUrl(value, { allowHttp });
  let format = type === "auto" ? detectTileType(url) : type;
  // Endpoints without a template (Martin, tileserver-gl, pg_tileserv) serve TileJSON at a bare path.
  if (!format && (/\.json(?:$|[?#])/i.test(url) || !/\{z\}/i.test(url))) format = "tilejson-auto";
  if (!format) throw new Error("Could not detect the tile format. Choose a format manually.");
  if (format === "pmtiles") {
    const response = await fetchChecked(url, { headers: { Range: "bytes=0-126" }, signal }, fetchImpl);
    // A 200 response means the host ignored Range; do not download an entire archive.
    await response.body?.cancel?.().catch(() => {});
    if (response.status !== 206) throw new Error("This PMTiles host does not support HTTP Range requests (expected HTTP 206). Ask the provider to enable byte ranges.");
    const { protocol, library } = await registerPmtiles(maplibre, pmtilesOptions);
    const archive = new library.PMTiles(url);
    let header;
    let metadata;
    try { [header, metadata] = await Promise.all([archive.getHeader(), archive.getMetadata()]); }
    catch (error) { throw new Error(`The PMTiles archive could not be read. It may be invalid, inaccessible, or have a CORS/Range problem: ${error.message}`, { cause: error }); }
    const tileType = Number(header.tileType);
    const kind = tileType === 1 ? "vector" : [2, 3, 4, 5].includes(tileType) ? "raster" : null;
    if (!kind) throw new Error("This PMTiles archive uses an unsupported tile type. Use MVT vector tiles or PNG, JPEG, WebP, or AVIF raster tiles.");
    protocol.add(archive);
    return { url, format, kind, minzoom: header.minZoom, maxzoom: header.maxZoom, bounds: boundsOf([header.minLon, header.minLat, header.maxLon, header.maxLat]), title: String(metadata?.name || ""), attribution: String(metadata?.attribution || ""), layers: metadataLayers(metadata?.vector_layers) };
  }
  if (format.endsWith("-xyz")) {
    if (!["{z}", "{x}", "{y}"].every((token) => url.toLowerCase().includes(token))) throw new Error("An XYZ URL must contain {z}, {x}, and {y} placeholders.");
    return { url, format, kind: format.startsWith("vector") ? "vector" : "raster", bounds: null, layers: [], attribution: "" };
  }
  const response = await fetchChecked(url, { signal, headers: { Accept: "application/json" } }, fetchImpl);
  let metadata;
  try { metadata = await response.json(); } catch { throw new Error("The TileJSON response is not valid JSON."); }
  if (!metadata || !Array.isArray(metadata.tiles) || !metadata.tiles.length) throw new Error("TileJSON must include at least one tile URL.");
  const tiles = metadata.tiles.slice(0, 20).map((entry) => tileUrl(new URL(entry, url).href, { allowHttp }));
  if (format === "tilejson-auto") {
    const detected = detectTileType(tiles[0]);
    const vector = metadata.vector_layers?.length || detected === "vector-xyz";
    if (!vector && detected !== "raster-xyz") throw new Error("The TileJSON does not identify its tile type. Choose vector or raster TileJSON manually.");
    format = vector ? "vector-tilejson" : "raster-tilejson";
  }
  return { url, format, kind: format.startsWith("vector") ? "vector" : "raster", tiles, minzoom: metadata.minzoom, maxzoom: metadata.maxzoom, bounds: boundsOf(metadata.bounds), title: String(metadata.name || ""), attribution: String(metadata.attribution || ""), layers: metadataLayers(metadata.vector_layers) };
}
