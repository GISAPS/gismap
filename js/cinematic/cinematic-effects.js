// Engine-independent part of the cinematic visual effects: the preset catalogue,
// a data-driven suggestion, and exact-coordinate geometry buffers. Nothing here
// buffers, simplifies or interpolates observed geometry; widths, heights and
// motion are applied on the GPU in screen pixels and are visual annotation only.
import { localFrame } from "../geo-frame.js?v=0.1.0";
import { MAX_SPATIAL_CHART_GROUPS, spatialChartColor } from "../spatial-chart.js?v=0.69.9-order";

export const CINEMATIC_EFFECTS = Object.freeze({
  none: { label: "None", note: "" },
  glow: { label: "Glow", category: "Essentials", color: "#ff8136", note: "Glow marks observed outlines and points; it is decoration, not data." },
  fire: { label: "Flames", category: "Hazards & weather", color: "#ff6a1a", note: "Flames and embers decorate the observed edge; they do not model fire behaviour or spread." },
  pulse: { label: "Seismic pulse", category: "Hazards & weather", color: "#ff3b2f", note: "Rings pulse out from observed points; ring size follows the magnitude field when there is one." },
  wind: { label: "Wind", category: "Hazards & weather", color: "#2f8fdc", note: "Streaks blow along the observed direction field; without one they are decorative only." },
  snow: { label: "Falling snow", category: "Hazards & weather", color: "#e7f7ff", note: "Snowfall is a looping decorative field at observed features; it is not measured precipitation." },
  lightning: { label: "Lightning", category: "Hazards & weather", color: "#d9d6ff", note: "Lightning flashes at observed points; its timing and path are illustrative." },
  tornado: { label: "Tornado", category: "Hazards & weather", color: "#aeb8c8", note: "A stylised funnel marks observed locations; it does not model a tornado's path or wind field." },
  hurricane: { label: "Hurricane spiral", category: "Hazards & weather", color: "#80d8ff", note: "A spiral marks the observed location; it is not a forecast cone or wind model." },
  storm: { label: "Storm cell", category: "Hazards & weather", color: "#8ca7ff", note: "A rotating storm-cell marker is decorative, not a radar or forecast product." },
  rain: { label: "Falling rain", category: "Hazards & weather", color: "#8ccfff", note: "Rainfall is a looping decorative field at observed features; it is not measured precipitation." },
  fog: { label: "Drifting fog", category: "Hazards & weather", color: "#d9e6ed", note: "Fog drifts over observed features as a decorative field; it is not a visibility observation or forecast." },
  lava: { label: "Flowing lava", category: "Hazards & weather", color: "#ff4a16", note: "Lava decorates an observed line or edge; it is not a lava-flow model, extent, speed, or hazard forecast." },
  water: { label: "Pond ripples", category: "Water & flow", color: "#1f8fd6", note: "Ripples decorate observed water areas; they are not a flow or depth model." },
  "water-flow": { label: "Water flow", category: "Water & flow", color: "#4dcaff", note: "Light moves along observed waterways in their drawn order; it is not a current or discharge model." },
  flow: { label: "Flow", category: "Water & flow", color: "#18c7b5", note: "Light travels along observed lines in their drawn order." },
  electricity: { label: "Electric flow", category: "Water & flow", color: "#a6f7ff", note: "Pulses decorate observed utility lines; they do not show measured load, voltage, or outages." },
  traffic: { label: "Traffic", category: "Vehicles & movement", color: "#ffcf73", note: "Car lights move both ways along each road; their speed and spacing are styling, not measured traffic." },
  trains: { label: "Trains", category: "Vehicles & movement", color: "#3d7bd9", note: "Trains run both ways along each line; they are not real vehicle positions or timetables." },
  sailboats: { label: "Sailboats", category: "Vehicles & movement", color: "#f6fbff", note: "Sailboats travel along observed water lines; they are illustrative, not vessel positions or tracks." },
  ships: { label: "Ships", category: "Vehicles & movement", color: "#ffb86b", note: "Ships travel along observed sea routes; they are illustrative, not AIS positions or shipping schedules." },
  birds: { label: "Birds", category: "Flight", color: "#f5d58c", note: "Bird movement is decorative unless it uses recorded tracks; it does not show observed animal positions." },
  drones: { label: "Drones", category: "Flight", color: "#62f1d6", note: "Drone movement is decorative unless it uses recorded tracks; it does not show live aircraft operations." },
  airplanes: { label: "Airplanes", category: "Flight", color: "#c6e8ff", note: "Aircraft movement is decorative unless it uses recorded tracks; it does not show live flight positions or routes." },
  helicopters: { label: "Helicopters", category: "Flight", color: "#e5f0d7", note: "Helicopter movement is decorative unless it uses recorded tracks; it does not show live aircraft operations." },
  walkers: { label: "Walking people", category: "Vehicles & movement", color: "#f5dca0", note: "People walk symbolically along observed paths; they do not show individual locations, trips, or counts." },
  // Native primitives (MapLibre style layers, no custom GL), for statistics and planning.
  extrude: { label: "Rise (extrude)", category: "Data transformation", color: "#4c7fd9", native: true, note: "Areas rise to their value of the chosen field; the rise is animation, the heights are the data." },
  reveal: { label: "Reveal", category: "Data transformation", color: "#f2a93b", native: true, note: "Features appear one after another in the order of a field (or their stored order); the order is not a date unless the field is one." },
  // Needs a timeline (or a stacked 3D chart), so it is offered in Cinematic mode only.
  strata: { label: "Strata timeline", category: "Data transformation", color: "#a46bff", native: true, cinematicOnly: true, note: "Each step's records drop onto the top of a 3D stack, earliest at the bottom. Vertical position is display order, not altitude; footprints are the source geometry." },
});
/**
 * Skins choose effect palettes, never data: a skin only recolours effects that
 * have no colour of their own. Values, dates and scenarios are untouched.
 */
export const SKIN_EFFECT_PALETTES = Object.freeze({
  "dark-analytical": { glow: "#38e1ff", fire: "#ff7a2f", pulse: "#ff4d6d", wind: "#7cc4ff", water: "#3ad0ff", flow: "#00ffc6", traffic: "#ffe08a", trains: "#38e1ff", extrude: "#38e1ff", reveal: "#ffd166" },
  highway: { glow: "#ffb000", fire: "#ff8a00", pulse: "#ffcc00", wind: "#ffffff", water: "#4fc3ff", flow: "#ffd400", traffic: "#fff1b8", trains: "#ffb000", extrude: "#ffb000", reveal: "#ffd400" },
  "velvet-orbit": { glow: "#ff5fd2", fire: "#ff6a5f", pulse: "#c77dff", wind: "#9db4ff", water: "#7f8cff", flow: "#ff9de2", traffic: "#ffd6f2", trains: "#c77dff", extrude: "#b06bff", reveal: "#ff5fd2" },
  "violet-circuit": { glow: "#a46bff", fire: "#ff7a45", pulse: "#ff4fd8", wind: "#5ee7ff", water: "#5ee7ff", flow: "#7dffcf", traffic: "#ffe9a8", trains: "#5ee7ff", extrude: "#a46bff", reveal: "#5ee7ff" },
  portolan: { glow: "#b5652b", fire: "#c4471d", pulse: "#8c2f1b", wind: "#3e5c76", water: "#2f6f8f", flow: "#7a5c2e", traffic: "#9b6b2e", trains: "#3e5c76", extrude: "#8b5a2b", reveal: "#b5652b" },
});

/** The colour an effect draws in: its own, else the skin's palette, else the effect's default. */
export function effectColor(effect, { color = null, skin = "" } = {}) {
  if (/^#[0-9a-f]{6}$/i.test(color || "")) return color;
  return SKIN_EFFECT_PALETTES[skin]?.[effect] || CINEMATIC_EFFECTS[effect]?.color || "#ff8136";
}

/** Effects drawn as native map layers rather than three.js. */
export const NATIVE_EFFECTS = Object.freeze(Object.keys(CINEMATIC_EFFECTS).filter((key) => CINEMATIC_EFFECTS[key].native));
export const CINEMATIC_EFFECT_TYPES = Object.freeze(Object.keys(CINEMATIC_EFFECTS));
export const CINEMATIC_EFFECT_CATEGORIES = Object.freeze([...new Set(Object.values(CINEMATIC_EFFECTS).map((effect) => effect.category).filter(Boolean))]);

const MAGNITUDE = /^(mag|magnitude|ml|mw|mb|richter|intensity)$/i;
const DIRECTION = /^(wdir|winddir|wind_dir|wind_direction|direction|dir|bearing|heading|azimuth|course)$/i;
const SPEED = /^(wspd|windspeed|wind_speed|speed|sknt|knots|gust|velocity|vel|mph|kph)$/i;

/** Attribute names an effect can use: { magnitude, direction, speed } (null when absent). */
export function effectFields(fields = [], sample = {}) {
  const names = [...new Set([...fields.map((field) => field?.name).filter(Boolean), ...Object.keys(sample || {})])];
  const find = (pattern) => names.find((name) => pattern.test(name)) || names.find((name) => pattern.test(name.replace(/^.*[._]/, ""))) || null;
  return { magnitude: find(MAGNITUDE), direction: find(DIRECTION), speed: find(SPEED) };
}

/** [min, max] of each effect field across every observation (not one snapshot). */
export function effectRanges(features = [], found = {}) {
  const ranges = {};
  for (const key of ["magnitude", "speed"]) {
    if (!found[key]) continue;
    let min = Infinity, max = -Infinity;
    for (const feature of features) {
      const raw = (feature?.attributes || feature?.properties || {})[found[key]];
      const value = raw === null || raw === undefined || raw === "" ? NaN : Number(raw);
      if (Number.isFinite(value)) { min = Math.min(min, value); max = Math.max(max, value); }
    }
    if (min <= max) ranges[key] = [min, max];
  }
  return ranges;
}

/** The effect that suits a layer, from its title, geometry and fields. Deterministic; never "none". */
export function suggestEffect({ title = "", geometryType = "", fields = [], sample = {} } = {}) {
  const name = String(title).toLowerCase();
  const found = effectFields(fields, sample);
  const points = /point/i.test(geometryType);
  if (/fire|burn|perimeter|wildland|blaze|smoke|hotspot|firms|viirs|modis/.test(name)) return "fire";
  if (/lightning|thunder/.test(name)) return "lightning";
  if (/tornado|twister/.test(name)) return "tornado";
  if (/hurricane|cyclone|typhoon/.test(name)) return "hurricane";
  if (/snow|blizzard|sleet/.test(name)) return "snow";
  if (/rain|precipitation|shower/.test(name)) return "rain";
  if (/fog|mist|low cloud/.test(name)) return "fog";
  if (/lava|volcan/.test(name)) return "lava";
  if (/storm|radar/.test(name)) return "storm";
  // Statistical areas (population, income, housing…) rise to their values.
  if (/polygon/i.test(geometryType) && /population|census|tract|county|counties|income|density|demograph|households|housing units|poverty/.test(name) && valueField(fields, sample)) return "extrude";
  if (/quake|seism|tremor|shake|usgs.*(mag|event)/.test(name) || (points && found.magnitude && /^(mag|magnitude|mw|ml)$/i.test(found.magnitude))) return "pulse";
  if (/wind|gust|weather station|metar/.test(name) || (points && found.direction && found.speed)) return "wind";
  if (/electric|power.?line|transmission|grid|substation/.test(name)) return "electricity";
  if (/sail|marina|harbor|harbour/.test(name)) return "sailboats";
  if (/ship|shipping|vessel|ais|ocean route|sea route/.test(name)) return "ships";
  if (/bird|migration|wildlife track/.test(name)) return "birds";
  if (/drone|uav/.test(name)) return "drones";
  if (/airplane|aircraft|flight|airport|air traffic/.test(name)) return "airplanes";
  if (/helicopter|heliport/.test(name)) return "helicopters";
  if (/walk|pedestrian|footpath|sidewalk|trail/.test(name)) return "walkers";
  if (/flood|water|river|stream|lake|inundat|tide|surge|coast|hydro|wetland/.test(name)) return /line/i.test(geometryType) ? "water-flow" : "water";
  if (/line/i.test(geometryType) && /rail|train|metro|subway|underground|tram|streetcar|light rail|lrt|bart|amtrak|commuter|transit line|transit route|rapid transit|railway|monorail|funicular/.test(name)) return "trains";
  if (/line/i.test(geometryType) && /road|street|highway|freeway|interstate|motorway|traffic|aadt|arterial|centerline|centreline/.test(name)) return "traffic";
  if (/line/i.test(geometryType) || /route|track|path|trip|transit|traffic/.test(name)) return "flow";
  return "glow";
}

const VALUE_HINT = /^(pop|population|total|count|value|amount|density|income|households|units|height|estimate|est|pct|percent|rate)/i;
const NOT_A_VALUE = /^(objectid|fid|oid|id|gid|shape_|st_|globalid|fips|geoid|code|zip)/i;

/** The numeric field an extrusion or a reveal reads by default: a value-like name first, then any number. */
export function valueField(fields = [], sample = {}) {
  const numeric = fields.filter((field) => /double|single|integer|small|long|float|number|int/i.test(field?.type || "") && !NOT_A_VALUE.test(field.name));
  const fromSample = Object.entries(sample || {}).filter(([name, value]) => typeof value === "number" && !NOT_A_VALUE.test(name)).map(([name]) => ({ name }));
  const all = [...numeric, ...fromSample];
  return (all.find((field) => VALUE_HINT.test(field.name)) || all[0])?.name || null;
}

/**
 * GeoJSON for a native effect: each feature's exact geometry with `v` (its
 * value of `field`, scaled 0–1 across the features) and `order` (0–1 rank by
 * `field`, or by stored order without one). Values are never altered.
 */
export function nativeEffectData(items = [], { field = null } = {}) {
  const rows = [];
  for (const entry of items) {
    const feature = entry?.feature ?? entry;
    const geometry = feature?.geometry;
    if (!geometry?.type || !geometry.coordinates) continue;
    const attributes = feature.attributes || feature.properties || {};
    const raw = field ? attributes[field] : null;
    const value = raw === null || raw === undefined || raw === "" ? NaN : Number(raw);
    rows.push({ geometry, value, index: rows.length });
  }
  const values = rows.map((row) => row.value).filter(Number.isFinite);
  const min = values.length ? Math.min(...values) : 0, max = values.length ? Math.max(...values) : 0;
  const ranked = [...rows].sort((a, b) => (Number.isFinite(a.value) ? a.value : Infinity) - (Number.isFinite(b.value) ? b.value : Infinity) || a.index - b.index);
  ranked.forEach((row, rank) => { row.order = ranked.length > 1 ? rank / (ranked.length - 1) : 0; });
  return {
    // Heights must stay proportional: non-negative values scale from zero (value / max), so
    // the smallest area is not drawn flat; only data with negatives scale min–max.
    data: { type: "FeatureCollection", features: rows.map((row) => ({ type: "Feature", geometry: row.geometry, properties: { v: scaled(row.value, min, max), order: field ? row.order : (rows.length > 1 ? row.index / (rows.length - 1) : 0) } })) },
    stats: { field, min, max, count: rows.length, withValue: values.length },
  };
}

function scaled(value, min, max) {
  if (!Number.isFinite(value)) return 0;
  if (min >= 0) return max > 0 ? value / max : 0;
  return max > min ? (value - min) / (max - min) : 1;
}

const STRATA_STACK_METERS = 12_000;

/**
 * GeoJSON for the Strata timeline: every observation once, keyed by its
 * `index`, with the display `base`/`top` (metres) and `color` of its slab.
 * A layer's own stacked 3D chart decides the slots, colours and thickness, so
 * the playback matches the Style panel. `color` (the track's own) overrides
 * the slot colours; `fallbackColor` paints a chart drawn in its original colour. Without one, each playback step gets a
 * slot (binned to at most 40, earliest lowest). Geometry is never changed.
 */
export function strataData(observations = [], { chart = null, ticks = [], color = null, fallbackColor = "#a46bff" } = {}) {
  const stacked = chart && chart.mode !== "attribute-extrusion" && chart.groupBy && chart.groups?.length;
  const tickIndex = new Map(ticks.map((tick, index) => [tick, index]));
  const slots = stacked ? chart.groups.length : Math.max(1, Math.min(MAX_SPATIAL_CHART_GROUPS, ticks.length));
  const stride = stacked ? chart.height.slotMeters + chart.height.gapMeters : Math.min(500, STRATA_STACK_METERS / slots);
  const groupSlot = stacked ? new Map(chart.groups.map((value, index) => [String(value), index])) : null;
  const features = [];
  let unplaced = 0;
  for (const observation of observations) {
    const feature = observation?.feature;
    const geometry = feature?.geometry;
    if (!/Polygon$/.test(geometry?.type || "") || !geometry.coordinates) continue;
    const attributes = feature.attributes || feature.properties || {};
    const slot = stacked ? groupSlot.get(String(attributes[chart.groupBy] ?? "")) : Math.floor((tickIndex.get(observation.time) ?? 0) * slots / Math.max(1, ticks.length));
    if (slot === undefined) { unplaced += 1; continue; }
    const base = slot * stride;
    const value = stacked && chart.height.field ? Number(attributes[chart.height.field]) : NaN;
    const thickness = !stacked ? stride * 0.6 : chart.height.field ? Math.min(chart.height.slotMeters, Math.max(chart.height.thicknessMeters, Math.max(0, Number.isFinite(value) ? value : 0) * chart.height.scale)) : chart.height.thicknessMeters;
    const slabColor = color || (stacked && chart.color?.strategy === "original" ? null : spatialChartColor(slot, slots)) || fallbackColor;
    features.push({ type: "Feature", id: observation.index, geometry, properties: { base, top: base + thickness, color: slabColor } });
  }
  return { data: { type: "FeatureCollection", features }, stats: { count: features.length, unplaced, slots, stride, stacked: Boolean(stacked) } };
}

/** How far a fresh slab has fallen into place (0 = just appeared above the stack, 1 = landed). */
export function strataLanding(secondsSinceStep = 0, { speed = 1 } = {}) {
  return smooth(secondsSinceStep * Math.max(0.1, speed) / 1.2);
}

const smooth = (x) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };
/** How far a rise has grown (0–1) at a track's time: over its cycle, or over 3 s and then held. */
export function riseAmount({ seconds = 0, phase = 0 } = {}, cycleSeconds = 0) {
  return smooth(cycleSeconds > 0 ? phase : seconds / 3);
}
/** How much of a reveal is shown (0–1): over its cycle, or over 8 s and then held. */
export function revealAmount({ seconds = 0, phase = 0 } = {}, cycleSeconds = 0) {
  return Math.min(1, Math.max(0, cycleSeconds > 0 ? phase : seconds / 8));
}

/** "auto" resolved against the layer; unknown names fall back to glow. */
export function resolveEffect(type, layer = {}) {
  if (type === "auto") return suggestEffect(layer);
  return CINEMATIC_EFFECT_TYPES.includes(type) ? type : "glow";
}

const finiteCoordinate = (coordinate) => Array.isArray(coordinate)
  && Number.isFinite(Number(coordinate[0])) && Number.isFinite(Number(coordinate[1]))
  && Math.abs(Number(coordinate[0])) <= 180 && Math.abs(Number(coordinate[1])) <= 90;

function collect(geometry, out) {
  if (!geometry || typeof geometry !== "object") return;
  const line = (path) => { const usable = path?.filter(finiteCoordinate); if (usable?.length >= 2) out.paths.push(usable); };
  const polygon = (rings) => {
    const usable = rings?.map((ring) => ring?.filter(finiteCoordinate)).filter((ring) => ring?.length >= 4);
    if (usable?.length) { out.polygons.push(usable); usable.forEach((ring) => out.paths.push(ring)); }
  };
  if (geometry.type === "Point" && finiteCoordinate(geometry.coordinates)) out.points.push(geometry.coordinates);
  else if (geometry.type === "MultiPoint") geometry.coordinates?.filter(finiteCoordinate).forEach((point) => out.points.push(point));
  else if (geometry.type === "LineString") line(geometry.coordinates);
  else if (geometry.type === "MultiLineString") geometry.coordinates?.forEach(line);
  else if (geometry.type === "Polygon") polygon(geometry.coordinates);
  else if (geometry.type === "MultiPolygon") geometry.coordinates?.forEach(polygon);
  else if (geometry.type === "GeometryCollection") geometry.geometries?.forEach((item) => collect(item, out));
}

/**
 * Rendering budgets. Detail is decoration, so it is what gives way first:
 * "eco" draws only edges, "balanced" keeps flames and embers for the newest
 * observations, "cinematic" draws everything. "auto" picks from the size of
 * the scene (resolveQuality).
 */
export const EFFECT_QUALITY = Object.freeze({
  eco: { label: "Eco", maxPaths: 800, maxVertices: 30000, maxPoints: 3000, walls: "none", embers: 0 },
  balanced: { label: "Balanced", maxPaths: 1500, maxVertices: 80000, maxPoints: 6000, walls: "fresh", embers: 600 },
  cinematic: { label: "Cinematic", maxPaths: 2500, maxVertices: 150000, maxPoints: 8000, walls: "all", embers: 1400 },
});

/** "auto" by scene size: small scenes get full detail, large ones a lighter budget. */
export function resolveQuality(quality, featureCount = 0) {
  if (EFFECT_QUALITY[quality]) return quality;
  return featureCount > 6000 ? "eco" : featureCount > 1200 ? "balanced" : "cinematic";
}

/** [west, south, east, north] of effect parts, or null when there is nothing to draw. */
export function partsBounds(parts) {
  let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity;
  const extend = ([longitude, latitude]) => { west = Math.min(west, longitude); east = Math.max(east, longitude); south = Math.min(south, latitude); north = Math.max(north, latitude); };
  parts.paths.forEach((path) => path.coordinates.forEach(extend));
  parts.points.forEach((point) => extend(point.coordinates));
  return Number.isFinite(west) ? [west, south, east, north] : null;
}

/**
 * Douglas–Peucker on [lon, lat] with a tolerance in degrees. Used only for
 * decoration at sub-pixel tolerance; the observed outline itself is drawn by
 * the map from the exact geometry.
 */
export function simplifyPath(path, tolerance) {
  if (!(tolerance > 0) || path.length < 3) return path;
  const keep = new Uint8Array(path.length);
  keep[0] = keep[path.length - 1] = 1;
  const stack = [[0, path.length - 1]];
  const squared = tolerance * tolerance;
  while (stack.length) {
    const [first, last] = stack.pop();
    const [ax, ay] = path[first], [bx, by] = path[last];
    const dx = bx - ax, dy = by - ay, length = dx * dx + dy * dy;
    let farthest = -1, best = squared;
    for (let i = first + 1; i < last; i += 1) {
      const [px, py] = path[i];
      const t = length ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / length)) : 0;
      const ex = ax + t * dx - px, ey = ay + t * dy - py, distance = ex * ex + ey * ey;
      if (distance > best) { best = distance; farthest = i; }
    }
    if (farthest > 0) { keep[farthest] = 1; stack.push([first, farthest], [farthest, last]); }
  }
  const simplified = path.filter((_, index) => keep[index]);
  return simplified.length >= 2 ? simplified : path;
}

/**
 * Observed geometry split into drawable parts, each tagged with its feature's
 * `fresh` flag (first observed at the current tick) and attributes. The budget
 * is spent on the newest observations first (fresh, then from the end of the
 * list), so a large build-up never drops the perimeter that just appeared.
 * `simplify` (degrees) trims sub-pixel vertices from decoration.
 */
export function effectParts(items = [], { maxPaths = 2500, maxVertices = 150000, maxPoints = 8000, simplify = 0 } = {}) {
  const parts = { paths: [], polygons: [], points: [] };
  let vertices = 0;
  const ordered = [...items.filter((entry) => entry?.fresh === true), ...items.filter((entry) => entry?.fresh !== true).reverse()];
  for (const entry of ordered) {
    if (parts.paths.length >= maxPaths && parts.points.length >= maxPoints) break;
    const feature = entry?.feature ?? entry;
    const fresh = entry?.fresh === false ? 0 : 1;
    const attributes = feature?.attributes || feature?.properties || {};
    const found = { paths: [], polygons: [], points: [] };
    collect(feature?.geometry || feature, found);
    for (const original of found.paths) {
      const path = simplify ? simplifyPath(original, simplify) : original;
      if (parts.paths.length >= maxPaths || vertices + path.length > maxVertices) break;
      parts.paths.push({ coordinates: path, fresh });
      vertices += path.length;
    }
    for (const rings of found.polygons) {
      const count = rings.reduce((sum, ring) => sum + ring.length, 0);
      if (vertices + count > maxVertices * 1.5) break;
      parts.polygons.push({ rings, fresh });
    }
    for (const point of found.points) {
      if (parts.points.length >= maxPoints) break;
      parts.points.push({ coordinates: point, fresh, attributes });
    }
  }
  return parts;
}

/** A deterministic 0–1 pseudo-random sequence, so rebuilt effects look the same for the same data. */
export function seededRandom(seed = 1) {
  let state = (Math.floor(Math.abs(seed)) || 1) >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A local frame shared by every part of one effect, plus a converter that
 * keeps elevation in the same units as the horizontal axes (MapLibre scales
 * metres by latitude). `elevationAt(lng, lat)` returns terrain metres or 0.
 */
export function effectFrame(origin, elevationAt = () => 0) {
  const frame = localFrame(origin);
  const cosOrigin = Math.cos((origin[1] * Math.PI) / 180);
  const toLocal = ([longitude, latitude], lift = 0) => {
    const [x, y] = frame.toLocal(longitude, latitude, 0);
    const metres = (Number(elevationAt(longitude, latitude)) || 0) + lift;
    return [x, y, metres * (cosOrigin / Math.cos((latitude * Math.PI) / 180))];
  };
  return { ...frame, toLocal };
}

/**
 * A mitred ribbon along each path: two vertices per path point on the exact
 * observed coordinate, pushed apart on the GPU by `offset × side × width`.
 * Closed rings mitre across their closing point so corners have no notches.
 */
export function ribbonBuffers(paths, frame) {
  const position = [], offset = [], side = [], distance = [], fresh = [], seed = [], size = [], index = [], lngLat = [];
  for (const [pathIndex, path] of paths.entries()) {
    const points = [];
    for (const coordinate of path.coordinates) {
      const local = frame.toLocal(coordinate);
      const last = points.at(-1);
      if (!last || Math.hypot(local[0] - last.local[0], local[1] - last.local[1]) > 1e-6) points.push({ local, coordinate });
    }
    if (points.length < 2) continue;
    const first = points[0].local, end = points.at(-1).local;
    const closed = points.length > 3 && Math.hypot(first[0] - end[0], first[1] - end[1]) < 1e-6;
    const base = position.length / 3;
    // Path extent lets the GPU fade rings that are tinier than the ribbon on screen.
    const xs = points.map((point) => point.local[0]), ys = points.map((point) => point.local[1]);
    const extent = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    let along = 0;
    for (let i = 0; i < points.length; i += 1) {
      const current = points[i].local;
      const previous = i > 0 ? points[i - 1].local : closed ? points.at(-2).local : null;
      const next = i < points.length - 1 ? points[i + 1].local : closed ? points[1].local : null;
      if (i > 0) along += Math.hypot(current[0] - points[i - 1].local[0], current[1] - points[i - 1].local[1]);
      const direction = (from, to) => { const dx = to[0] - from[0], dy = to[1] - from[1], length = Math.hypot(dx, dy) || 1; return [dx / length, dy / length]; };
      const incoming = previous ? direction(previous, current) : direction(current, next);
      const outgoing = next ? direction(current, next) : incoming;
      let tx = incoming[0] + outgoing[0], ty = incoming[1] + outgoing[1];
      const tangentLength = Math.hypot(tx, ty);
      if (tangentLength < 1e-6) { tx = incoming[0]; ty = incoming[1]; } else { tx /= tangentLength; ty /= tangentLength; }
      const mitre = Math.min(1.6, 1 / Math.max(0.4, -ty * -incoming[1] + tx * incoming[0]));
      for (const s of [-1, 1]) {
        position.push(...current);
        offset.push(-ty * mitre, tx * mitre);
        side.push(s);
        distance.push(along);
        fresh.push(path.fresh ?? 1);
        seed.push((pathIndex * 0.6180339887) % 1);
        size.push(extent);
        lngLat.push(points[i].coordinate[0], points[i].coordinate[1]);
      }
      if (i > 0) {
        const a = base + (i - 1) * 2, b = base + i * 2;
        index.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
  }
  return position.length ? { position, offset, side, distance, fresh, seed, size, index, lngLat } : null;
}

/**
 * Four corners per observed point, centred on the exact coordinate. Each point
 * carries a normalized magnitude, a blow-toward direction (radians, local
 * x/y) and speed when those fields exist.
 */
export function quadBuffers(points, frame, { magnitudeField = null, directionField = null, speedField = null, ranges = {} } = {}) {
  const number = (value) => (value === null || value === undefined || value === "" ? NaN : Number(value));
  // Prefer the whole dataset's range, so a lone quake is not drawn as the largest.
  const range = (field, given) => {
    if (Array.isArray(given) && given.every(Number.isFinite)) return given;
    const values = field ? points.map((point) => number(point.attributes?.[field])).filter(Number.isFinite) : [];
    return values.length ? [Math.min(...values), Math.max(...values)] : null;
  };
  const magnitudeRange = range(magnitudeField, ranges.magnitude), speedRange = range(speedField, ranges.speed);
  const normalize = (value, bounds, fallback) => (bounds && Number.isFinite(value) ? (bounds[1] > bounds[0] ? (value - bounds[0]) / (bounds[1] - bounds[0]) : 1) : fallback);
  const position = [], corner = [], magnitude = [], heading = [], speed = [], fresh = [], seed = [], index = [], lngLat = [];
  const random = seededRandom(points.length * 7919 + 17);
  points.forEach((point, pointIndex) => {
    const local = frame.toLocal(point.coordinates);
    const m = normalize(number(point.attributes?.[magnitudeField]), magnitudeRange, 0.5);
    const from = number(point.attributes?.[directionField]);
    // Meteorological direction is where wind comes FROM; streaks blow toward the opposite bearing.
    const toward = Number.isFinite(from) ? ((from + 180) * Math.PI) / 180 : (90 * Math.PI) / 180;
    const angle = Math.PI / 2 - toward;
    const s = normalize(number(point.attributes?.[speedField]), speedRange, 0.5);
    const r = random();
    for (const [cx, cy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      position.push(...local);
      corner.push(cx, cy);
      magnitude.push(m);
      heading.push(angle);
      speed.push(s);
      fresh.push(point.fresh ?? 1);
      seed.push(r);
      lngLat.push(point.coordinates[0], point.coordinates[1]);
    }
    const base = pointIndex * 4;
    index.push(base, base + 1, base + 2, base, base + 2, base + 3);
  });
  return position.length ? { position, corner, magnitude, heading, speed, fresh, seed, index, lngLat, hasDirection: Boolean(directionField) } : null;
}

/**
 * Ember/spark seeds spread evenly along paths by length, preferring the newest
 * (fresh) paths. Deterministic for the same input.
 */
export function particleSeeds(paths, frame, { count = 900 } = {}) {
  const preferred = paths.some((path) => path.fresh) ? paths.filter((path) => path.fresh) : paths;
  const segments = [];
  let total = 0;
  for (const path of preferred) {
    for (let i = 1; i < path.coordinates.length; i += 1) {
      const a = path.coordinates[i - 1], b = path.coordinates[i];
      const la = frame.toLocal(a), lb = frame.toLocal(b);
      const length = Math.hypot(lb[0] - la[0], lb[1] - la[1]);
      if (length > 0) { segments.push({ la, lb, a, b, start: total, length }); total += length; }
    }
  }
  if (!total) return null;
  const random = seededRandom(Math.round(total) + segments.length);
  const position = [], seed = [], lngLat = [];
  let segment = 0;
  const n = Math.max(1, Math.min(count, Math.round(count)));
  for (let i = 0; i < n; i += 1) {
    const target = ((i + random() * 0.8) / n) * total;
    while (segment < segments.length - 1 && segments[segment].start + segments[segment].length < target) segment += 1;
    const { la, lb, a, b, start, length } = segments[segment];
    const t = Math.min(1, Math.max(0, (target - start) / length));
    position.push(la[0] + (lb[0] - la[0]) * t, la[1] + (lb[1] - la[1]) * t, la[2] + (lb[2] - la[2]) * t);
    lngLat.push(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t);
    seed.push(random(), random());
  }
  return { position, seed, lngLat };
}

/**
 * A layer's saved animated effect (Advanced Style, map specs and links):
 * { type, intensity, color, opacity, style, speed, density } or null for
 * none. These are purely visual controls: they never alter source features.
 */
export function normalizeLayerEffect(value) {
  if (!value || typeof value !== "object") return null;
  const type = ["auto", ...CINEMATIC_EFFECT_TYPES].includes(value.type) ? value.type : null;
  if (!type || type === "none") return null;
  const intensity = Number(value.intensity);
  const opacity = Number(value.opacity);
  const speed = Number(value.speed);
  const density = Number(value.density);
  // A Rise or Reveal keeps the field it reads.
  const field = typeof value.field === "string" ? value.field.trim().slice(0, 160) : "";
  return {
    type,
    intensity: Number.isFinite(intensity) ? Math.min(2, Math.max(0.25, intensity)) : 1,
    opacity: Number.isFinite(opacity) ? Math.min(1, Math.max(0.05, opacity)) : 1,
    color: /^#[0-9a-f]{6}$/i.test(value.color || "") ? value.color : null,
    style: ["soft", "balanced", "crisp", "vivid"].includes(value.style) ? value.style : "balanced",
    speed: Number.isFinite(speed) ? Math.min(3, Math.max(0.1, speed)) : 1,
    density: Number.isFinite(density) ? Math.min(2.5, Math.max(0.25, density)) : 1,
    ...(field ? { field } : {}),
  };
}
