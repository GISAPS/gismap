const WEB_MERCATOR_WKIDS = new Set([3857, 102100, 102113, 900913]);
const WEB_MERCATOR_RADIUS = 6378137;

function spatialReferenceWkid(spatialReference) {
  return Number(spatialReference?.latestWkid || spatialReference?.wkid) || null;
}

function appearsProjected(x, y) {
  return Math.abs(x) > 180 || Math.abs(y) > 90;
}

function coordinateToWgs84(coordinate, spatialReference) {
  if (!Array.isArray(coordinate) || coordinate.length < 2) return coordinate;
  const [x, y, ...rest] = coordinate;
  const wkid = spatialReferenceWkid(spatialReference);
  if (!WEB_MERCATOR_WKIDS.has(wkid) && !(wkid == null && appearsProjected(x, y))) return [...coordinate];
  const longitude = (x / WEB_MERCATOR_RADIUS) * (180 / Math.PI);
  const latitude = (2 * Math.atan(Math.exp(y / WEB_MERCATOR_RADIUS)) - (Math.PI / 2)) * (180 / Math.PI);
  return [longitude, latitude, ...rest];
}

function coordinateTreeToWgs84(value, spatialReference) {
  if (!Array.isArray(value)) return value;
  if (value.length >= 2 && Number.isFinite(value[0]) && Number.isFinite(value[1])) {
    return coordinateToWgs84(value, spatialReference);
  }
  return value.map((child) => coordinateTreeToWgs84(child, spatialReference));
}

function coordinatesOf(point, spatialReference) {
  const values = coordinateToWgs84([point.x, point.y], spatialReference);
  if (Number.isFinite(point.z)) values.push(point.z);
  return values;
}

function signedRingArea(ring) {
  let area = 0;
  for (let index = 0; index < ring.length - 1; index += 1) {
    area += (ring[index][0] * ring[index + 1][1]) - (ring[index + 1][0] * ring[index][1]);
  }
  return area / 2;
}

function closeRing(ring) {
  if (!ring.length) return ring;
  const first = ring[0];
  const last = ring.at(-1);
  return first[0] === last[0] && first[1] === last[1] ? ring : [...ring, [...first]];
}

function pointInRing(point, ring) {
  let inside = false;
  for (let current = 0, previous = ring.length - 1; current < ring.length; previous = current++) {
    const [x, y] = ring[current];
    const [previousX, previousY] = ring[previous];
    const crosses = (y > point[1]) !== (previousY > point[1])
      && point[0] < ((previousX - x) * (point[1] - y)) / (previousY - y) + x;
    if (crosses) inside = !inside;
  }
  return inside;
}

function orientRing(ring, counterClockwise) {
  const isCounterClockwise = signedRingArea(ring) > 0;
  return isCounterClockwise === counterClockwise ? ring : [...ring].reverse();
}

function polygonCoordinates(rings = []) {
  const valid = rings.map(closeRing).filter((ring) => ring.length >= 4);
  if (!valid.length) return { type: "Polygon", coordinates: [] };
  const largest = valid.reduce((winner, ring) =>
    Math.abs(signedRingArea(ring)) > Math.abs(signedRingArea(winner)) ? ring : winner,
  );
  const outerSign = Math.sign(signedRingArea(largest)) || 1;
  const polygons = valid
    .filter((ring) => (Math.sign(signedRingArea(ring)) || outerSign) === outerSign)
    .map((ring) => [orientRing(ring, true)]);
  const holes = valid.filter((ring) => (Math.sign(signedRingArea(ring)) || outerSign) !== outerSign);

  holes.forEach((hole) => {
    const candidates = polygons
      .filter(([outer]) => pointInRing(hole[0], outer))
      .sort((a, b) => Math.abs(signedRingArea(a[0])) - Math.abs(signedRingArea(b[0])));
    if (candidates[0]) candidates[0].push(orientRing(hole, false));
    else polygons.push([orientRing(hole, true)]);
  });

  return polygons.length === 1
    ? { type: "Polygon", coordinates: polygons[0] }
    : { type: "MultiPolygon", coordinates: polygons };
}

export function geometryToGeoJSON(geometry) {
  if (!geometry) return null;
  const source = geometry.toJSON?.() ?? geometry;
  const spatialReference = geometry.spatialReference || source.spatialReference;
  const geometryType = geometry.type || source.type
    || (Number.isFinite(source.x) && Number.isFinite(source.y) ? "point" : null)
    || (source.points ? "multipoint" : null)
    || (source.paths ? "polyline" : null)
    || (source.rings ? "polygon" : null);
  switch (geometryType) {
    case "point":
      return { type: "Point", coordinates: coordinatesOf(source, spatialReference) };
    case "multipoint":
      return { type: "MultiPoint", coordinates: coordinateTreeToWgs84(source.points ?? [], spatialReference) };
    case "polyline":
      return (source.paths?.length ?? 0) === 1
        ? { type: "LineString", coordinates: coordinateTreeToWgs84(source.paths[0], spatialReference) }
        : { type: "MultiLineString", coordinates: coordinateTreeToWgs84(source.paths ?? [], spatialReference) };
    case "polygon":
      return polygonCoordinates(coordinateTreeToWgs84(source.rings ?? [], spatialReference));
    default:
      if (source.type && source.coordinates) return structuredClone(source);
      throw new Error(`Unsupported export geometry: ${geometryType || "unknown"}.`);
  }
}

export function graphicToGeoJSONFeature(graphic) {
  return {
    type: "Feature",
    geometry: geometryToGeoJSON(graphic?.geometry),
    properties: structuredClone(graphic?.attributes ?? {}),
  };
}

export function createFeatureCollection(features, metadata = {}) {
  return {
    type: "FeatureCollection",
    name: metadata.name || undefined,
    features,
  };
}

function escapeXml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
  })[character]);
}

function coordinateText(coordinates = []) {
  return coordinates.map((coordinate) => coordinate.slice(0, 3).join(",")).join(" ");
}

function geometryToKml(geometry) {
  if (!geometry) return "";
  switch (geometry.type) {
    case "Point":
      return `<Point><coordinates>${coordinateText([geometry.coordinates])}</coordinates></Point>`;
    case "MultiPoint":
      return `<MultiGeometry>${geometry.coordinates.map((point) => geometryToKml({ type: "Point", coordinates: point })).join("")}</MultiGeometry>`;
    case "LineString":
      return `<LineString><tessellate>1</tessellate><coordinates>${coordinateText(geometry.coordinates)}</coordinates></LineString>`;
    case "MultiLineString":
      return `<MultiGeometry>${geometry.coordinates.map((line) => geometryToKml({ type: "LineString", coordinates: line })).join("")}</MultiGeometry>`;
    case "Polygon": {
      const [outer, ...holes] = geometry.coordinates;
      if (!outer) return "";
      return `<Polygon><tessellate>1</tessellate><outerBoundaryIs><LinearRing><coordinates>${coordinateText(outer)}</coordinates></LinearRing></outerBoundaryIs>${holes.map((hole) => `<innerBoundaryIs><LinearRing><coordinates>${coordinateText(hole)}</coordinates></LinearRing></innerBoundaryIs>`).join("")}</Polygon>`;
    }
    case "MultiPolygon":
      return `<MultiGeometry>${geometry.coordinates.map((polygon) => geometryToKml({ type: "Polygon", coordinates: polygon })).join("")}</MultiGeometry>`;
    default:
      throw new Error(`Unsupported KML geometry: ${geometry.type || "unknown"}.`);
  }
}

export function featureCollectionToKml(collection) {
  const documentName = escapeXml(collection.name || "GISMap Online export");
  const placemarks = (collection.features ?? []).map((feature, index) => {
    const properties = feature.properties ?? {};
    const name = escapeXml(properties.name ?? properties.title ?? `Feature ${index + 1}`);
    const description = properties.description == null ? "" : `<description>${escapeXml(properties.description)}</description>`;
    const data = Object.entries(properties).map(([key, value]) => {
      const normalized = value != null && typeof value === "object" ? JSON.stringify(value) : value;
      return `<Data name="${escapeXml(key)}"><value>${escapeXml(normalized)}</value></Data>`;
    }).join("");
    return `<Placemark><name>${name}</name>${description}<ExtendedData>${data}</ExtendedData>${geometryToKml(feature.geometry)}</Placemark>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${documentName}</name>${placemarks}</Document></kml>`;
}

export function safeExportName(value, fallback = "layer") {
  const name = String(value || fallback)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9._-]+/gi, "-")
    .replace(/^-+|-+$/g, "");
  return name || fallback;
}
