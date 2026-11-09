// Below-ground layers: sewers, water and gas mains, transit tunnels, wells and
// bedrock units drawn at a depth under the local ground. `subsurface` is a
// portable layer setting (like spatialChart); the underground view fades the
// ground so what lies under it shows. Pure: no DOM and no map SDK. The MapLibre
// engine draws the triangles built here with three.js; the ArcGIS engine uses
// the SDK's own 3D symbols (subsurfaceArcgis).
import { rendererValue, symbolPaint } from "./engines/maplibre/arcgis-renderer.js?v=0.42.0";

export const SUBSURFACE_TYPE = "subsurface";
export const UNDERGROUND_DEFAULTS = Object.freeze({ enabled: false, groundOpacity: 0.45 });

const FIELD_NAME = /^[A-Za-z_][A-Za-z0-9_.]*$/;
const HEX = /^#[0-9a-f]{6}$/i;
const numericType = (type) => /integer|single|double|long|number|float|decimal/i.test(String(type || ""));
const bounded = (value, fallback, min, max) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
};

/**
 * One measurement: a fixed number of metres, or a numeric field times `scale`
 * (0.3048 for feet, 0.0254 for inches). Features without a value use `meters`.
 */
function measure(input, fallback, byName, label, { min = 0, max = 20000 } = {}) {
  const raw = typeof input === "number" ? { meters: input } : input && typeof input === "object" ? input : {};
  const field = String(raw.field || "").trim();
  if (field) {
    if (!FIELD_NAME.test(field)) throw new Error(`${label}: ${field} is not a usable field name.`);
    if (byName.size && !byName.has(field)) throw new Error(`${label}: the layer has no field named ${field}.`);
    if (byName.size && !numericType(byName.get(field)?.type)) throw new Error(`${label}: ${field} must be a numeric field.`);
  }
  return {
    ...(field ? { field } : {}),
    meters: bounded(raw.meters, fallback, min, max),
    ...(field ? { scale: bounded(raw.scale, 1, 0, 100000) } : {}),
  };
}

/**
 * Validate and bound a layer's below-ground setting. Throws before anything is drawn.
 * depth: down from the local ground to a pipe's centre, a unit's top or a well's bottom.
 * thickness: polygons only, a unit's height from its top down.
 * diameter: lines and points, a pipe's or shaft's width; `minMeters` is a display floor so
 * a 300 mm main stays visible from above the city.
 */
export function normalizeSubsurface(input, { fields = [], geometryType = null } = {}) {
  if (input == null || input === false) return null;
  if (!input || typeof input !== "object") throw new Error("The below-ground setting must be an object.");
  if (geometryType && !["point", "polyline", "polygon"].includes(geometryType)) throw new Error("Below-ground drawing needs point, line or polygon features.");
  const byName = new Map(fields.map((field) => [field.name, field]));
  const depth = measure(input.depth, 3, byName, "Depth");
  const result = { type: SUBSURFACE_TYPE, depth };
  if (geometryType !== "point" && geometryType !== "polyline") result.thickness = measure(input.thickness, 20, byName, "Thickness", { min: 0.1 });
  if (geometryType !== "polygon") {
    const diameter = measure(input.diameter, 1, byName, "Diameter", { min: 0.01, max: 500 });
    result.diameter = { ...diameter, minMeters: bounded(input.diameter?.minMeters, 1, 0, 500) };
  }
  result.exaggeration = bounded(input.exaggeration, 1, 0.1, 100);
  if (HEX.test(String(input.color || ""))) result.color = String(input.color).toLowerCase();
  return result;
}

/** The underground view setting, bounded: { enabled, groundOpacity } (0 hides the ground, 1 keeps it solid). */
export function normalizeUnderground(input) {
  if (typeof input === "boolean") return { ...UNDERGROUND_DEFAULTS, enabled: input };
  const raw = input && typeof input === "object" ? input : {};
  return { enabled: raw.enabled === true, groundOpacity: bounded(raw.groundOpacity, UNDERGROUND_DEFAULTS.groundOpacity, 0, 1) };
}

/** A measurement's metres for one feature's properties. */
export function measureMeters(spec, properties = {}) {
  if (!spec) return 0;
  if (spec.field) {
    const value = Number(properties?.[spec.field]);
    if (properties?.[spec.field] !== null && properties?.[spec.field] !== "" && Number.isFinite(value)) return Math.max(0, value * spec.scale);
  }
  return spec.meters;
}

/** Plain-language description of a setting, for the legend, Briefs and agents. */
export function subsurfaceSummary(config) {
  if (!config) return null;
  const part = (spec, noun) => (spec.field ? `${noun} from ${spec.field}${spec.scale !== 1 ? ` × ${spec.scale}` : ""} m` : `${noun} ${spec.meters.toLocaleString()} m`);
  const parts = [part(config.depth, "depth"), config.thickness && part(config.thickness, "thickness"), config.diameter && part(config.diameter, "diameter")].filter(Boolean);
  return `Below ground: ${parts.join("; ")}${config.exaggeration !== 1 ? `; depths drawn × ${config.exaggeration}` : ""}.`;
}

/* ---------------- Colour ---------------- */

/** [r, g, b] in 0–1 from #rgb, #rrggbb or rgb(a)(); null when it can't be read. */
export function parseColor(value) {
  const text = String(value || "").trim();
  let match = text.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (match) {
    const hex = match[1].length === 3 ? [...match[1]].map((digit) => digit + digit).join("") : match[1];
    return [0, 2, 4].map((at) => parseInt(hex.slice(at, at + 2), 16) / 255);
  }
  match = text.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
  return match ? match.slice(1, 4).map((part) => Math.min(255, Number(part)) / 255) : null;
}

/**
 * A feature's colour from a layer's renderer (simple, unique-value or class-breaks,
 * in WebMap or autocast form), as the flat map draws it. `fallback` for anything else.
 */
export function rendererColorResolver(renderer, fallback = "#1b7f6a") {
  const colorOf = (symbol) => {
    const paint = symbolPaint(symbol);
    return parseColor(paint.line || paint.fill || paint.circle);
  };
  const base = parseColor(fallback) || [0.1, 0.5, 0.42];
  const type = String(renderer?.type || "");
  if (type === "simple") {
    const color = colorOf(renderer.symbol) || base;
    return () => color;
  }
  const defaultColor = colorOf(renderer?.defaultSymbol) || base;
  const { field, normalizeBy } = rendererValue(renderer);
  if (!field) return () => defaultColor;
  if (type === "uniqueValue" || type === "unique-value") {
    const byValue = new Map((renderer.uniqueValueInfos || []).map((info) => [String(info.value), colorOf(info.symbol) || defaultColor]));
    return (properties = {}) => byValue.get(String(properties?.[field])) || defaultColor;
  }
  if (type === "classBreaks" || type === "class-breaks") {
    let lower = -Infinity;
    const breaks = (renderer.classBreakInfos || []).map((info) => {
      const min = Number.isFinite(info.minValue) ? info.minValue : lower;
      const max = Number.isFinite(info.maxValue) ? info.maxValue : Number(info.classMaxValue);
      lower = max;
      return { min, max, color: colorOf(info.symbol) || defaultColor };
    });
    return (properties = {}) => {
      const raw = Number(properties?.[field]);
      const by = normalizeBy ? Number(properties?.[normalizeBy]) : 1;
      if (properties?.[field] == null || !Number.isFinite(raw) || !by) return defaultColor;
      const value = raw / by;
      return breaks.find((item) => value >= item.min && value <= item.max)?.color || defaultColor;
    };
  }
  return () => defaultColor;
}

/* ---------------- Geometry ---------------- */

const SIDES = 8;

/** Positions (x east, y north, z up, metres), normals and colours as flat triangle lists. */
class TriangleSoup {
  positions = [];
  normals = [];
  colors = [];
  triangle(a, b, c, color) {
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const length = Math.hypot(...n);
    if (!(length > 0)) return;
    for (const point of [a, b, c]) {
      this.positions.push(point[0], point[1], point[2]);
      this.normals.push(n[0] / length, n[1] / length, n[2] / length);
      this.colors.push(color[0], color[1], color[2]);
    }
  }
  quad(a, b, c, d, color) {
    this.triangle(a, b, c, color);
    this.triangle(a, c, d, color);
  }
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => {
  const length = Math.hypot(...a);
  return length > 0 ? scale(a, 1 / length) : null;
};

/** A closed tube of `radius` from `a` to `b`, lengthened by the radius at both ends so bends close up. */
function tube(soup, a, b, radius, color) {
  const axis = unit(sub(b, a));
  if (!axis) return;
  const start = sub(a, scale(axis, radius)), end = add(b, scale(axis, radius));
  // Any vector not along the axis gives the ring's plane.
  const helper = Math.abs(axis[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  const u = unit(cross(axis, helper)), v = cross(axis, u);
  const ring = (center) => Array.from({ length: SIDES }, (_, index) => {
    const angle = (index / SIDES) * Math.PI * 2;
    return add(center, add(scale(u, Math.cos(angle) * radius), scale(v, Math.sin(angle) * radius)));
  });
  const near = ring(start), far = ring(end);
  for (let index = 0; index < SIDES; index += 1) {
    const next = (index + 1) % SIDES;
    soup.quad(near[index], near[next], far[next], far[index], color);
    soup.triangle(start, near[next], near[index], color);
    soup.triangle(end, far[index], far[next], color);
  }
}

/** A ring's points without the closing repeat. */
const openRing = (ring) => (ring.length > 1 && ring[0][0] === ring.at(-1)[0] && ring[0][1] === ring.at(-1)[1] ? ring.slice(0, -1) : ring);

/** A polygon (outer ring then holes, as [x, y] metres) as a prism from `top(x, y)` down to `bottom(x, y)`. */
function prism(soup, rings, top, bottom, color, triangulate) {
  const contour = openRing(rings[0]);
  if (contour.length < 3) return;
  const holes = rings.slice(1).map(openRing).filter((ring) => ring.length >= 3);
  const points = [contour, ...holes].flat();
  for (const [a, b, c] of triangulate(contour, holes)) {
    const [pa, pb, pc] = [points[a], points[b], points[c]];
    if (!pa || !pb || !pc) continue;
    soup.triangle([...pa, top(...pa)], [...pb, top(...pb)], [...pc, top(...pc)], color);
    soup.triangle([...pa, bottom(...pa)], [...pc, bottom(...pc)], [...pb, bottom(...pb)], color);
  }
  for (const ring of [contour, ...holes]) {
    ring.forEach((point, index) => {
      const next = ring[(index + 1) % ring.length];
      soup.quad([...point, top(...point)], [...point, bottom(...point)], [...next, bottom(...next)], [...next, top(...next)], color);
    });
  }
}

/** A fan triangulation for convex rings; engines pass a real one (three.js ShapeUtils.triangulateShape). */
export const fanTriangulate = (contour) => contour.slice(2).map((_, index) => [0, index + 1, index + 2]);

/** [west, south, east, north] of features' geometries, or null. */
export function featuresBounds(features = []) {
  let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity;
  const visit = (coordinates) => {
    if (typeof coordinates?.[0] === "number") {
      west = Math.min(west, coordinates[0]); east = Math.max(east, coordinates[0]);
      south = Math.min(south, coordinates[1]); north = Math.max(north, coordinates[1]);
    } else coordinates?.forEach?.(visit);
  };
  for (const feature of features) {
    const geometry = feature?.geometry;
    if (geometry?.type === "GeometryCollection") geometry.geometries?.forEach((part) => visit(part.coordinates));
    else visit(geometry?.coordinates);
  }
  return Number.isFinite(west) ? [west, south, east, north] : null;
}

/**
 * Triangles for features drawn below ground, in a local frame's metres:
 * { positions, normals, colors } (flat arrays), plus `deepest` (metres) and the
 * feature count drawn. `frame.toLocal(lon, lat)` gives [east, north];
 * `groundAt(lon, lat)` is the ground height relative to the frame's anchor (0 on flat ground).
 */
export function buildSubsurfaceGeometry(features, config, { frame, groundAt = () => 0, colorOf = () => [0.1, 0.5, 0.42], triangulate = fanTriangulate } = {}) {
  const soup = new TriangleSoup();
  const ex = config.exaggeration || 1;
  let deepest = 0, drawn = 0;
  for (const feature of features) {
    const geometry = feature?.geometry;
    if (!geometry) continue;
    const properties = feature.properties || {};
    const depth = measureMeters(config.depth, properties) * ex;
    const color = colorOf(properties) || [0.1, 0.5, 0.42];
    const local = ([lon, lat]) => {
      const [x, y] = frame.toLocal(lon, lat);
      return [x, y, groundAt(lon, lat)];
    };
    const before = soup.positions.length;
    if (geometry.type === "LineString" || geometry.type === "MultiLineString") {
      const radius = Math.max(config.diameter.minMeters, measureMeters(config.diameter, properties)) / 2;
      const lines = geometry.type === "LineString" ? [geometry.coordinates] : geometry.coordinates;
      for (const line of lines) {
        const points = (line || []).filter((point) => Number.isFinite(point?.[0]) && Number.isFinite(point?.[1])).map(local).map(([x, y, z]) => [x, y, z - depth]);
        for (let index = 1; index < points.length; index += 1) tube(soup, points[index - 1], points[index], radius, color);
      }
      deepest = Math.max(deepest, depth + radius);
    } else if (geometry.type === "Point" || geometry.type === "MultiPoint") {
      // A well, shaft or manhole: from the ground down to its depth.
      const radius = Math.max(config.diameter.minMeters, measureMeters(config.diameter, properties)) / 2;
      const points = geometry.type === "Point" ? [geometry.coordinates] : geometry.coordinates;
      for (const point of points) {
        if (!Number.isFinite(point?.[0]) || !Number.isFinite(point?.[1]) || !(depth > 0)) continue;
        const [x, y, z] = local(point);
        tube(soup, [x, y, z], [x, y, z - depth], radius, color);
      }
      deepest = Math.max(deepest, depth);
    } else if (geometry.type === "Polygon" || geometry.type === "MultiPolygon") {
      const thickness = Math.max(0.1, measureMeters(config.thickness, properties)) * ex;
      const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
      for (const polygon of polygons) {
        const lonLat = new Map();
        const rings = (polygon || []).map((ring) => (ring || []).filter((point) => Number.isFinite(point?.[0]) && Number.isFinite(point?.[1])).map((point) => {
          const [x, y] = frame.toLocal(point[0], point[1]);
          lonLat.set(`${x},${y}`, point);
          return [x, y];
        }));
        if (!rings[0]?.length) continue;
        const ground = (x, y) => groundAt(...(lonLat.get(`${x},${y}`) || [0, 0]));
        prism(soup, rings, (x, y) => ground(x, y) - depth, (x, y) => ground(x, y) - depth - thickness, color, triangulate);
      }
      deepest = Math.max(deepest, depth + thickness);
    }
    if (soup.positions.length > before) drawn += 1;
  }
  return { positions: soup.positions, normals: soup.normals, colors: soup.colors, deepest, drawn };
}

/* ---------------- ArcGIS ---------------- */

const arcadeField = (name) => {
  if (!FIELD_NAME.test(String(name || ""))) throw new Error(`Unsafe field name ${name}.`);
  return `$feature[${JSON.stringify(name)}]`;
};
const round = (value) => Number(Number(value).toFixed(6));
/** Arcade for a measurement in metres. */
const arcade = (spec, times = 1) => (spec.field ? `DefaultValue(${arcadeField(spec.field)}, ${round(spec.meters)}) * ${round(spec.scale * times)}` : String(round(spec.meters * times)));

/**
 * The setting as an ArcGIS SceneView renderer and elevationInfo (SDK autocast JSON),
 * keeping the layer's classes and colours. `palette` is the live style, as
 * spatialChartArcgis reads it. Polygons extrude up from the unit's base; points are
 * cylinders hanging from the ground; lines are round tubes.
 */
export function subsurfaceArcgis(config, geometryType, palette = {}) {
  if (!config) throw new Error("No below-ground setting to draw.");
  const ex = config.exaggeration || 1;
  const fallback = config.color || palette.defaultColor || "#1b7f6a";
  const diameter = config.diameter ? Math.max(config.diameter.minMeters, config.diameter.meters) : 1;
  const symbol = (color) => {
    if (geometryType === "polyline") return { type: "line-3d", symbolLayers: [{ type: "path", profile: "circle", width: diameter, height: diameter, anchor: "center", cap: "round", join: "round", material: { color } }] };
    if (geometryType === "point") return { type: "point-3d", symbolLayers: [{ type: "object", resource: { primitive: "cylinder" }, width: diameter, depth: diameter, height: config.depth.meters * ex, anchor: "top", material: { color } }] };
    return { type: "polygon-3d", symbolLayers: [{ type: "extrude", size: config.thickness.meters * ex, material: { color }, edges: { type: "solid", color: [255, 255, 255, 0.3], size: 0.5 } }] };
  };
  let renderer;
  if (!config.color && palette.type === "class-breaks" && palette.classBreaks?.length) {
    renderer = { type: "class-breaks", field: palette.field, classBreakInfos: palette.classBreaks.map((item) => ({ minValue: item.minValue, maxValue: item.maxValue, label: item.label, symbol: symbol(item.color) })) };
  } else if (!config.color && palette.type === "unique-value" && palette.uniqueValues?.length) {
    renderer = { type: "unique-value", field: palette.field, uniqueValueInfos: palette.uniqueValues.map((item) => ({ value: item.value, label: item.label, symbol: symbol(item.color) })) };
  } else renderer = { type: "simple", symbol: symbol(fallback) };
  if (renderer.type !== "simple") Object.assign(renderer, { defaultSymbol: symbol(palette.defaultColor || [180, 180, 180, 0.9]), defaultLabel: palette.defaultLabel || "Other" });
  const variables = [];
  // The display floor applies to field diameters too.
  if (config.diameter?.field) variables.push({ type: "size", valueExpression: `Max(${round(config.diameter.minMeters)}, ${arcade(config.diameter)})`, valueUnit: "meters", ...(geometryType === "point" ? { axis: "width-and-depth" } : {}) });
  if (geometryType === "point" && config.depth.field) variables.push({ type: "size", valueExpression: arcade(config.depth, ex), valueUnit: "meters", axis: "height" });
  if (geometryType === "polygon" && config.thickness.field) variables.push({ type: "size", valueExpression: arcade(config.thickness, ex), valueUnit: "meters" });
  if (variables.length) renderer.visualVariables = variables;
  // Points hang from the ground by their top; polygons extrude up from their base.
  const offset = geometryType === "point" ? "0" : geometryType === "polygon" ? `-(${arcade(config.depth, ex)}) - (${arcade(config.thickness, ex)})` : `-(${arcade(config.depth, ex)})`;
  return { renderer, elevationInfo: { mode: "relative-to-ground", featureExpressionInfo: { expression: offset }, unit: "meters" } };
}
