// Persist only explicit, non-secret connection metadata. Runtime sessions and
// credentials never enter this registry or a GISMap Online project/share document.
const KEY = 'gismap-online:data-connections:v1';
const TYPES = new Set(['duckdb-wasm', 'duckdb-remote-file', 'postgis-http', 'pmtiles']);

export function connectionUrl(value, { allowLoopbackHttp = false } = {}) {
  let url;
  try { url = new URL(String(value || '').trim()); } catch { throw new Error('Enter a valid connector URL.'); }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(allowLoopbackHttp && url.protocol === 'http:' && loopback)) || url.username || url.password) {
    throw new Error(allowLoopbackHttp
      ? 'Use HTTPS or HTTP on localhost, 127.0.0.1, or [::1], without a username or password.'
      : 'Use an HTTPS URL without a username or password.');
  }
  // A conservative boundary: query parameters may contain provider secrets.
  if (url.search || url.hash) throw new Error('Connection URLs cannot contain query parameters or fragments; use session authentication instead.');
  return url.href;
}

/** Convert public Source Cooperative file pages to the advertised data host. */
export function resolveRemoteParquetUrl(value) {
  const url = new URL(connectionUrl(value));
  const segments = url.pathname.split('/').filter(Boolean);
  if (url.hostname === 'source.coop' && !url.port && segments.length >= 3 && /\.(?:parquet|geoparquet)$/i.test(segments.at(-1))) {
    url.hostname = 'data.source.coop';
    return { url: url.href, normalized: true };
  }
  return { url: url.href, normalized: false };
}

export class ConnectionRegistry {
  constructor(storage = globalThis.localStorage) { this.storage = storage; }
  list() {
    try {
      const entries = JSON.parse(this.storage?.getItem(KEY) || '[]');
      return Array.isArray(entries) ? entries.filter((x) => x && TYPES.has(x.type) && typeof x.id === 'string') : [];
    } catch { return []; }
  }
  save(input) {
    if (!TYPES.has(input.type)) throw new Error('Unsupported connection type.');
    const name = String(input.name || '').trim().slice(0, 120);
    if (!name) throw new Error('Enter a connection name.');
    const id = String(input.id || globalThis.crypto.randomUUID());
    const config = {};
    if (input.config?.url) config.url = connectionUrl(input.config.url, { allowLoopbackHttp: input.type === 'postgis-http' });
    if (input.type === 'postgis-http') config.workspace = String(input.config?.workspace || '').trim().slice(0, 120);
    const record = { id, name, type: input.type, config };
    const entries = this.list().filter((entry) => entry.id !== id);
    entries.push(record);
    this.storage.setItem(KEY, JSON.stringify(entries));
    return record;
  }
  remove(id) { this.storage.setItem(KEY, JSON.stringify(this.list().filter((entry) => entry.id !== id))); }
}

// OGC API Features collection discovery, not a direct PostgreSQL connection.
// Tokens are accepted only in memory and only sent to the configured origin.
function collectionsUrl(endpoint) {
  const base = new URL(connectionUrl(endpoint, { allowLoopbackHttp: true }));
  return base.pathname.replace(/\/$/, '').endsWith('/collections')
    ? base : new URL(`${base.href.replace(/\/$/, '')}/collections`);
}

export async function discoverOgcCollections(endpoint, { token = '', fetchImpl = fetch, signal } = {}) {
  const collections = collectionsUrl(endpoint);
  let response;
  try {
    response = await fetchImpl(collections.href, { headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, signal, redirect: 'error' });
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    throw new Error('The connector could not be reached. Check the address, CORS, browser local-network permissions, and redirects. A PostgreSQL port is not an HTTP connector.');
  }
  if (response.status === 401) throw new Error('Authentication required or credentials rejected (HTTP 401).');
  if (response.status === 403) throw new Error('The connector denied access (HTTP 403).');
  if (!response.ok) throw new Error(`The connector returned HTTP ${response.status}.`);
  let data;
  try { data = await response.json(); } catch { throw new Error('The connector did not return JSON.'); }
  if (!Array.isArray(data?.collections)) throw new Error('The endpoint is reachable but is not a supported OGC API Features collections endpoint.');
  return data.collections.filter((item) => typeof item?.id === 'string').map((item) => ({
    id: item.id, title: String(item.title || item.id), description: String(item.description || ''),
    extent: item.extent || null, crs: Array.isArray(item.crs) ? item.crs.filter((v) => typeof v === 'string') : [],
    links: Array.isArray(item.links) ? item.links.filter((link) => link?.rel === 'items' && typeof link.href === 'string').map((link) => ({ href: link.href, type: String(link.type || '') })) : [],
  }));
}

export function ogcItemsUrl(endpoint, collection, limit = 1000) {
  const base = collectionsUrl(endpoint);
  if (typeof collection?.id !== 'string' || !collection.id || collection.id === '.' || collection.id === '..') throw new Error('Invalid collection ID.');
  const advertised = collection.links?.find((link) => /geo\+json|application\/json/i.test(link.type)) || collection.links?.[0];
  const url = advertised ? new URL(advertised.href, base) : new URL(`${base.href.replace(/\/$/, '')}/${encodeURIComponent(collection.id)}/items.json`);
  if (url.origin !== base.origin || url.username || url.password || url.hash || url.search) throw new Error('The collection items URL must be on the connector origin and contain no credentials, query, or fragment.');
  url.searchParams.set('limit', String(Math.max(1, Math.min(1000, Math.floor(limit) || 1000))));
  return url.href;
}

export async function fetchOgcItems(endpoint, collection, { token = '', limit = 1000, fetchImpl = fetch, signal } = {}) {
  const url = ogcItemsUrl(endpoint, collection, limit);
  let response;
  try { response = await fetchImpl(url, { headers: { Accept: 'application/geo+json, application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, signal, redirect: 'error' }); }
  catch (error) { if (error?.name === 'AbortError') throw error; throw new Error('Could not load collection records. Check connector access and CORS.'); }
  if (!response.ok) throw new Error(`Collection request failed (HTTP ${response.status}).`);
  let data;
  try { data = await response.json(); } catch { throw new Error('The connector did not return JSON.'); }
  if (data?.type !== 'FeatureCollection' || !Array.isArray(data.features)) throw new Error('The connector did not return a GeoJSON feature collection.');
  const bound = Number(new URL(url).searchParams.get('limit'));
  if (data.features.length > bound) throw new Error('The connector ignored the feature limit; no layer was added.');
  const truncated = data.features.length >= bound || (Number.isFinite(data.numberMatched) && data.numberMatched > data.features.length) || (Array.isArray(data.links) && data.links.some((link) => link?.rel === 'next'));
  return { url, data, truncated };
}

export function validateOgcGeometry(data) {
  const depths = { Point: 0, MultiPoint: 1, LineString: 1, MultiLineString: 2, Polygon: 2, MultiPolygon: 3 };
  const positions = (coordinates, depth) => {
    if (!Array.isArray(coordinates) || !coordinates.length) return false;
    if (depth) return coordinates.every((part) => positions(part, depth - 1));
    return coordinates.length >= 2 && coordinates.every(Number.isFinite) && Math.abs(coordinates[0]) <= 180 && Math.abs(coordinates[1]) <= 90;
  };
  const valid = (geometry) => geometry?.type === 'GeometryCollection'
    ? Array.isArray(geometry.geometries) && geometry.geometries.length > 0 && geometry.geometries.every(valid)
    : Object.hasOwn(depths, geometry?.type) && positions(geometry.coordinates, depths[geometry.type]);
  let spatial = 0;
  for (const feature of data.features) {
    if (feature?.type !== 'Feature' || (feature.properties !== null && (typeof feature.properties !== 'object' || Array.isArray(feature.properties)))) throw new Error('The collection contains an invalid GeoJSON feature.');
    if (feature.geometry != null) {
      if (!valid(feature.geometry)) throw new Error('The collection contains invalid geometry or coordinates outside longitude/latitude bounds.');
      spatial++;
    }
  }
  return spatial;
}

export function ogcHasLocalBounds(data) {
  let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity;
  const walk = (value) => {
    if (!Array.isArray(value)) return;
    if (typeof value[0] === 'number' && typeof value[1] === 'number') {
      west = Math.min(west, value[0]); east = Math.max(east, value[0]);
      south = Math.min(south, value[1]); north = Math.max(north, value[1]);
    } else value.forEach(walk);
  };
  const visit = (geometry) => { if (geometry?.type === 'GeometryCollection') geometry.geometries.forEach(visit); else walk(geometry?.coordinates); };
  data.features.forEach((feature) => visit(feature.geometry));
  return Number.isFinite(west) && east - west < 180 && north - south < 90;
}

// An extent alone is not proof that a collection actually contains geometry.
// Sample only on explicit request, and never treat an empty/null sample as non-spatial.
export async function inspectOgcSpatial(endpoint, collection, options = {}) {
  if (typeof collection === 'string') collection = { id: collection, links: [{ href: `${collectionsUrl(endpoint).href.replace(/\/$/, '')}/${encodeURIComponent(collection)}/items`, type: 'application/geo+json' }] };
  const { data } = await fetchOgcItems(endpoint, collection, { ...options, limit: 1 });
  const geometry = data.features.find((feature) => feature?.type === 'Feature' && feature.geometry && typeof feature.geometry.type === 'string')?.geometry;
  return geometry ? { status: 'spatial', geometryType: geometry.type } : { status: 'unknown', geometryType: null };
}

export function filterOgcCollections(entries, { search = '', sort = 'asc', spatial = 'all' } = {}) {
  const query = search.trim().toLocaleLowerCase();
  return entries.filter((entry) => (!query || `${entry.title} ${entry.id} ${entry.description}`.toLocaleLowerCase().includes(query)) && (spatial === 'all' || entry.spatialStatus === spatial))
    .slice().sort((a, b) => (sort === 'desc' ? -1 : 1) * (a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' }) || a.id.localeCompare(b.id)));
}
