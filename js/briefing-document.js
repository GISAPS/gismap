// The briefing document: an ordered set of slides kept in the project under
// presentation.briefing. Pure functions only, so the app, custom tools and
// agents all edit the same JSON the same way.
import { normalizeCinematicClip } from "./cinematic/clip-model.js?v=0.70.4-sequence";

export const BRIEFING_SCHEMA_VERSION = 1;
export const MAX_SLIDES = 60;
const MAX_TITLE = 160;
const MAX_TEXT = 4000;
const MAX_NOTES = 4000;
export const MAX_IMAGES = 12;

/** The first-release templates, all on a fixed grid. */
export const SLIDE_TEMPLATES = Object.freeze([
  { id: "title", label: "Title", description: "Opening slide: briefing title, subtitle and date" },
  { id: "feature", label: "Feature", description: "One selected feature: map, overview facts and source" },
  { id: "map-narrative", label: "Map and narrative", description: "A map view with explanatory text" },
  { id: "key-numbers", label: "Key numbers", description: "Two to four statistics from the briefing data" },
  { id: "actions", label: "Actions", description: "Next steps and links to close the briefing" },
  { id: "media", label: "Image & text", description: "Images and text without a map; two or more images become a slideshow" },
  { id: "cinematic", label: "Cinematic Clip", description: "An interactive, versioned cinematic map scene" },
]);
const TEMPLATE_IDS = new Set(SLIDE_TEMPLATES.map((template) => template.id));

/**
 * What a slide can be, as the "Add a new slide" chooser offers it. "template"
 * kinds convert a slide in place; "generator" kinds create a series of slides
 * from the data; "planned" kinds are announced but not yet available.
 */
export const SLIDE_TYPES = Object.freeze([
  { id: "map", label: "Map", description: "A place on the map, one main layer and related layers", kind: "template", template: "map-narrative" },
  { id: "title", label: "Title", description: "Opening slide: title, subtitle and date", kind: "template", template: "title" },
  { id: "numbers", label: "Key numbers", description: "Two to four statistics from the data", kind: "template", template: "key-numbers" },
  { id: "actions", label: "Next steps", description: "Actions and links to close the briefing", kind: "template", template: "actions" },
  { id: "grid", label: "Grid", description: "Divide an area into cells, one slide per cell", kind: "generator", generator: "grid-atlas" },
  { id: "timeline", label: "Timeline", description: "Step through time, one slide per interval", kind: "generator", generator: "timeline" },
  { id: "chart-3d", label: "3D spatial chart", description: "Extruded 3D chart of grouped values", kind: "generator", generator: "spatial-3d-chart" },
  { id: "series", label: "One slide per value", description: "A slide for each value of a field", kind: "generator", generator: "filter-series" },
  { id: "tour", label: "Tour", description: "A guided tour inside the slide", kind: "planned" },
  { id: "media", label: "Image & text", description: "Images and text, or a slideshow, without a map", kind: "template", template: "media" },
  { id: "cinematic", label: "Cinematic Clip", description: "Play an interactive cinematic map scene", kind: "template", template: "cinematic" },
  { id: "animation", label: "Animation", description: "A MapLibre + three.js or three.js animation", kind: "planned" },
  { id: "bim", label: "BIM / CAD", description: "A 3D building model", kind: "planned" },
  { id: "realtime", label: "Real-time", description: "Live data that refreshes during the meeting", kind: "planned" },
  { id: "dashboard", label: "Dashboard", description: "Charts, graphs and maps together", kind: "planned" },
]);

/** The chooser's type for a slide: generated series first, then its template. */
export function slideTypeOf(slide) {
  const generated = SLIDE_TYPES.find((type) => type.generator && type.generator === slide?.generatedBy?.template);
  if (generated) return generated;
  if (slide?.template === "feature") return { id: "feature", label: "Feature map", description: "One selected feature with its facts", kind: "template", template: "feature" };
  return SLIDE_TYPES.find((type) => type.template === slide?.template) || SLIDE_TYPES[0];
}

export const STAT_TYPES = Object.freeze(["count", "sum", "average", "min", "max"]);
/** How the map moves between slides: "pan" flies there (the default), "cut" jumps straight there. */
export const SLIDE_TRANSITIONS = Object.freeze(["pan", "cut"]);
/**
 * How another layer's features relate to a slide's feature, as the ArcGIS REST
 * query names them (spatialRel). "contains": features inside the slide's
 * feature; "within": features that contain it; "relation": a DE-9IM pattern.
 */
export const SPATIAL_RELATIONSHIPS = Object.freeze(["intersects", "contains", "crosses", "envelope-intersects", "index-intersects", "overlaps", "touches", "within", "disjoint", "relation"]);
export const DISTANCE_UNITS = Object.freeze(["meters", "kilometers", "feet", "miles", "nautical-miles", "us-nautical-miles"]);
const MAX_SLIDE_LAYERS = 10;
const FILTER_OPERATORS = new Set(["eq", "neq", "gt", "gte", "lt", "lte", "in", "not_in", "contains", "starts_with", "is_null", "is_not_null", "and", "or", "not", "feature_ids"]);

const text = (value, max) => String(value ?? "").slice(0, max);

// Fields a GIS keeps for itself: record IDs and the geometry's own measurements.
const ROUTINE_FIELD = /^(?:objectid(?:_\d+)?|fid(?:_\d+)?|oid|globalid|gdb_geomattr_data|shape(?:_?_?(?:leng|length|len|area))?|st_area(?:\(shape\))?|st_length(?:\(shape\))?|perimeter)$/i;

/**
 * Whether a field is an ID or a geometry measurement (OBJECTID, GlobalID,
 * Shape__Area, Shape__Length, SHAPE_Leng, PERIMETER…), which slides leave out
 * by default: such values are rarely what a briefing is about. `field` is a
 * name or { name, type }.
 */
export function isRoutineField(field, { idField = null } = {}) {
  const name = String(field?.name ?? field ?? "");
  const type = String(field?.type || "");
  return Boolean(name) && (name === idField || /oid|global-?id|guid|geometry|blob|raster/i.test(type) || ROUTINE_FIELD.test(name));
}
const array = (value) => (Array.isArray(value) ? value : []);
const finite = (value) => (Number.isFinite(Number(value)) && value !== null && value !== "" ? Number(value) : null);

/** A short random ID, stable once saved. */
export function newId(prefix) {
  const random = globalThis.crypto?.randomUUID?.().replaceAll("-", "").slice(0, 8) || Math.random().toString(36).slice(2, 10);
  return `${prefix}-${random}`;
}

function normalizeCamera(camera) {
  if (!camera || typeof camera !== "object") return null;
  const center = array(camera.center).map(Number);
  if (center.length !== 2 || !center.every(Number.isFinite) || Math.abs(center[0]) > 180 || Math.abs(center[1]) > 90) return null;
  return {
    center,
    zoom: Math.min(24, Math.max(0, finite(camera.zoom) ?? 12)),
    heading: finite(camera.heading) ?? 0,
    tilt: Math.min(90, Math.max(0, finite(camera.tilt) ?? 0)),
  };
}

/** Filters are a typed tree (never code). Unknown operators are rejected, not run. */
export function normalizeFilter(filter, depth = 0) {
  if (!filter || typeof filter !== "object" || depth > 6 || !FILTER_OPERATORS.has(filter.op)) return null;
  if (["and", "or"].includes(filter.op)) {
    const args = array(filter.args).map((arg) => normalizeFilter(arg, depth + 1)).filter(Boolean).slice(0, 20);
    return args.length ? { op: filter.op, args } : null;
  }
  if (filter.op === "not") {
    const arg = normalizeFilter(filter.arg, depth + 1);
    return arg ? { op: "not", arg } : null;
  }
  if (filter.op === "feature_ids") return { op: "feature_ids", ids: array(filter.ids).map(String).slice(0, 2000) };
  if (typeof filter.field !== "string" || !filter.field) return null;
  if (["is_null", "is_not_null"].includes(filter.op)) return { op: filter.op, field: filter.field };
  if (["in", "not_in"].includes(filter.op)) return { op: filter.op, field: filter.field, values: array(filter.values).slice(0, 200) };
  return { op: filter.op, field: filter.field, value: filter.value ?? null };
}

function normalizeBlock(block) {
  if (!block || typeof block !== "object") return null;
  const id = typeof block.id === "string" && block.id ? block.id : newId("b");
  if (block.type === "text") return { ...block, id, type: "text", markdown: text(block.markdown, MAX_TEXT) };
  if (block.type === "stat") {
    return {
      ...block,
      id,
      type: "stat",
      stat: STAT_TYPES.includes(block.stat) ? block.stat : "count",
      field: typeof block.field === "string" ? block.field : null,
      queryRef: typeof block.queryRef === "string" && block.queryRef ? block.queryRef : null,
      label: text(block.label, 80),
    };
  }
  if (block.type === "facts") return { ...block, id, type: "facts", fields: array(block.fields).map(String).slice(0, 12) };
  if (block.type === "list") return { ...block, id, type: "list", items: array(block.items).map((item) => text(item, 300)).filter(Boolean).slice(0, 12) };
  // Images are referenced by http(s) URL; captions and alt text travel with them.
  if (block.type === "images") {
    return { ...block, id, type: "images", images: array(block.images).map((image) => ({ url: safeUrl(image?.url), alt: text(image?.alt, 200), caption: text(image?.caption, 300) })).filter((image) => image.url).slice(0, MAX_IMAGES) };
  }
  // A place the slide links to: its saved view, with a label for the "Show on the map" button.
  if (block.type === "place") return { ...block, id, type: "place", label: text(block.label, 120) };
  if (block.type === "links") {
    return { ...block, id, type: "links", links: array(block.links).map((link) => ({ label: text(link?.label, 120), url: safeUrl(link?.url) })).filter((link) => link.url).slice(0, 8) };
  }
  // Unknown block types survive a round trip untouched, for newer versions of the app.
  return { ...block, id };
}

/** Only http(s) links are kept; anything else (javascript:, data:) is dropped. */
export function safeUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

/**
 * One other layer on a slide: { layer, visible, relation }. `layer` is the
 * layer's service URL (or ID or title); `relation`, when set, shows only the
 * features with that spatial relationship to the slide's feature, optionally
 * within `distance` `units` of it.
 */
function normalizeSlideLayer(entry) {
  if (!entry || typeof entry !== "object") return null;
  const layer = text(entry.layer, 2048).trim();
  if (!layer) return null;
  const result = { layer, visible: entry.visible !== false };
  const relation = entry.relation;
  if (relation && typeof relation === "object" && SPATIAL_RELATIONSHIPS.includes(relation.type)) {
    const normalized = { type: relation.type };
    const distance = finite(relation.distance);
    if (distance > 0) {
      normalized.distance = Math.min(distance, 1000000);
      normalized.units = DISTANCE_UNITS.includes(relation.units) ? relation.units : "meters";
    }
    const pattern = String(relation.relationParameter || "").toUpperCase();
    if (relation.type !== "relation" || /^[TF*012]{9}$/.test(pattern)) {
      if (relation.type === "relation") normalized.relationParameter = pattern;
      result.relation = normalized;
    }
  }
  return result;
}

function normalizeSlide(slide) {
  if (!slide || typeof slide !== "object") return null;
  // `layers` is left out until a slide sets it: such slides show the other layers as the map has them.
  const { layers, ...rest } = slide;
  const seen = new Set();
  const slideLayers = Array.isArray(layers)
    ? layers.map(normalizeSlideLayer).filter((entry) => entry && !seen.has(entry.layer) && seen.add(entry.layer)).slice(0, MAX_SLIDE_LAYERS)
    : null;
  return {
    ...rest,
    ...(slideLayers ? { layers: slideLayers } : {}),
    id: typeof slide.id === "string" && slide.id ? slide.id : newId("s"),
    template: TEMPLATE_IDS.has(slide.template) ? slide.template : "map-narrative",
    title: text(slide.title, MAX_TITLE),
    subtitle: text(slide.subtitle, MAX_TITLE),
    featureId: slide.featureId != null && slide.featureId !== "" ? String(slide.featureId) : null,
    camera: normalizeCamera(slide.camera),
    fit: ["feature", "selection"].includes(slide.fit) ? slide.fit : null,
    blocks: array(slide.blocks).map(normalizeBlock).filter(Boolean).slice(0, 12),
    notes: text(slide.notes, MAX_NOTES),
    hidden: slide.hidden === true,
    ...(slide.template === "cinematic" ? cinematicSlideFields(slide) : {}),
  };
}

/**
 * A Cinematic slide plays a Clip. It keeps its own normalized copy (`clip`)
 * so a shared briefing link plays the Clip as captured, even where the
 * project's Clip library is absent; `clipRef` still names the original.
 */
function cinematicSlideFields(slide) {
  let clip = null;
  try { clip = slide.clip && typeof slide.clip === "object" ? normalizeCinematicClip(slide.clip) : null; } catch { clip = null; }
  const clipRef = clip?.id || (typeof slide.clipRef === "string" && slide.clipRef ? slide.clipRef.slice(0, 120) : null);
  if (!clipRef) return {};
  return {
    clipRef,
    ...(clip ? { clip } : {}),
    presentation: slide.presentation === "poster" ? "poster" : "interactive",
    autoplay: slide.autoplay === true,
    loop: slide.loop === true,
    allowExplore: slide.allowExplore !== false,
    fallback: slide.fallback && typeof slide.fallback === "object" ? { posterRef: text(slide.fallback.posterRef, 2048) || null, videoRef: text(slide.fallback.videoRef, 2048) || null } : { posterRef: null, videoRef: null },
  };
}

/** A complete, valid briefing document from whatever was saved (or nothing). */
export function normalizeBriefing(value = {}) {
  const source = value && typeof value === "object" ? value : {};
  const queries = {};
  for (const [name, filter] of Object.entries(source.queries && typeof source.queries === "object" ? source.queries : {})) {
    const normalized = normalizeFilter(filter);
    if (normalized && /^[\w-]{1,40}$/.test(name)) queries[name] = normalized;
  }
  const seen = new Set();
  const slides = array(source.slides).map(normalizeSlide).filter((slide) => slide && !seen.has(slide.id) && seen.add(slide.id)).slice(0, MAX_SLIDES);
  // "pan" is the default and is left out, so older documents and links stay byte-identical.
  // Player settings are intentionally sparse for the same reason: omitted means
  // the familiar animated pan, popup insight and project basemap behavior.
  const { transition, playerSettings: rawPlayerSettings, ...rest } = source;
  const playerSettings = normalizeBriefingPlayerSettings(rawPlayerSettings, { preserveAnimation: transition === "cut" });
  return {
    ...rest,
    schemaVersion: BRIEFING_SCHEMA_VERSION,
    ...(transition === "cut" ? { transition: "cut" } : {}),
    ...(Object.keys(playerSettings).length ? { playerSettings } : {}),
    queries,
    slides,
  };
}

/**
 * Portable preferences for the briefing player. Defaults are omitted from the
 * saved document so existing shared links remain compact and unmodified.
 */
export function normalizeBriefingPlayerSettings(value = {}, { preserveAnimation = false } = {}) {
  const source = value && typeof value === "object" ? value : {};
  const next = {};
  if (typeof source.basemap === "string" && /^[\w-]{1,80}$/.test(source.basemap)) next.basemap = source.basemap;
  if (source.animations === false || (preserveAnimation && source.animations === true)) next.animations = source.animations;
  if (source.motion === "fly") next.motion = "fly";
  if (source.mapDetails === "slide") next.mapDetails = "slide";
  return next;
}

/** A new slide from a template, prefilled from what the briefing already knows. */
export function createSlide(template, { title = "", subtitle = "", featureId = null, camera = null, fields = [], date = new Date() } = {}) {
  const base = { id: newId("s"), template, title, subtitle, featureId, camera, fit: null, blocks: [], notes: "", hidden: false };
  if (template === "title") {
    base.subtitle = subtitle || date.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  }
  if (template === "feature") {
    base.fit = camera ? null : "feature";
    base.blocks = [{ id: newId("b"), type: "facts", fields: fields.slice(0, 5) }, { id: newId("b"), type: "text", markdown: "" }];
  }
  if (template === "map-narrative") base.blocks = [{ id: newId("b"), type: "text", markdown: "" }];
  if (template === "key-numbers") {
    base.blocks = [
      { id: newId("b"), type: "stat", stat: "count", field: null, queryRef: null, label: "Features" },
      { id: newId("b"), type: "text", markdown: "" },
    ];
  }
  if (template === "actions") base.blocks = [{ id: newId("b"), type: "list", items: [] }, { id: newId("b"), type: "links", links: [] }];
  if (template === "media") base.blocks = [{ id: newId("b"), type: "images", images: [] }, { id: newId("b"), type: "text", markdown: "" }, { id: newId("b"), type: "place", label: "" }];
  if (template === "cinematic") { base.clipRef = null; base.presentation = "interactive"; base.autoplay = false; base.loop = false; base.allowExplore = true; base.fallback = { posterRef: null, videoRef: null }; }
  return normalizeSlide(base);
}

// Edits return a new briefing; they never change the one passed in.
const withSlides = (briefing, slides) => normalizeBriefing({ ...briefing, slides });

export function addSlide(briefing, slide, afterId = null) {
  const slides = [...normalizeBriefing(briefing).slides];
  if (slides.length >= MAX_SLIDES) throw new Error(`A briefing can hold at most ${MAX_SLIDES} slides.`);
  const index = afterId ? slides.findIndex((item) => item.id === afterId) : -1;
  slides.splice(index >= 0 ? index + 1 : slides.length, 0, slide);
  return withSlides(briefing, slides);
}

export function updateSlide(briefing, id, patch) {
  return withSlides(briefing, normalizeBriefing(briefing).slides.map((slide) => (slide.id === id ? { ...slide, ...patch, id } : slide)));
}

export function removeSlide(briefing, id) {
  return withSlides(briefing, normalizeBriefing(briefing).slides.filter((slide) => slide.id !== id));
}

export function moveSlide(briefing, id, offset) {
  const slides = [...normalizeBriefing(briefing).slides];
  const from = slides.findIndex((slide) => slide.id === id);
  // Moves past either end stop at the first or last place.
  const to = Math.min(slides.length - 1, Math.max(0, from + offset));
  if (from < 0 || to === from) return normalizeBriefing(briefing);
  const [slide] = slides.splice(from, 1);
  slides.splice(to, 0, slide);
  return withSlides(briefing, slides);
}

export function duplicateSlide(briefing, id) {
  const slide = normalizeBriefing(briefing).slides.find((item) => item.id === id);
  if (!slide) return normalizeBriefing(briefing);
  const copy = structuredClone(slide);
  copy.id = newId("s");
  copy.title = slide.title ? `${slide.title} (copy)` : "";
  copy.blocks = copy.blocks.map((block) => ({ ...block, id: newId("b") }));
  return addSlide(briefing, copy, id);
}

/**
 * Turns a slide into another template in place: it keeps its id, title, map
 * view, notes and layers, carries its narrative text across, and stops being
 * part of a generated series.
 */
export function convertSlide(briefing, id, template, { camera = null, date = new Date() } = {}) {
  if (!TEMPLATE_IDS.has(template)) throw new Error(`Unknown slide template: ${template}`);
  const slide = normalizeBriefing(briefing).slides.find((item) => item.id === id);
  if (!slide) throw new Error(`Unknown slide: ${id}`);
  const fresh = createSlide(template, { title: slide.title, subtitle: slide.subtitle, featureId: template === "feature" ? slide.featureId : null, camera: slide.camera || camera, date });
  const text = slide.blocks.find((block) => block.type === "text")?.markdown;
  const blocks = fresh.blocks.map((block) => (block.type === "text" && text ? { ...block, markdown: text } : block));
  const { generatedBy, dataView, spatialChart, ...kept } = slide;
  return withSlides(briefing, normalizeBriefing(briefing).slides.map((item) => (item.id === id
    ? { ...kept, template, subtitle: fresh.subtitle, featureId: fresh.featureId, fit: fresh.fit, camera: fresh.camera, blocks }
    : item)));
}

export function updateBlock(briefing, slideId, blockId, patch) {
  const slide = normalizeBriefing(briefing).slides.find((item) => item.id === slideId);
  if (!slide) return normalizeBriefing(briefing);
  return updateSlide(briefing, slideId, { blocks: slide.blocks.map((block) => (block.id === blockId ? { ...block, ...patch, id: blockId } : block)) });
}

/** Evaluates a filter tree against one record's attributes (for loaded data). */
export function matchesFilter(filter, attributes = {}, id = null) {
  if (!filter) return true;
  const value = attributes[filter.field];
  const comparable = (left, right) => {
    // Date conditions compare timestamps; GeoJSON often stores dates as ISO text.
    const time = (value, other) => (typeof value === "string" && typeof other === "number" && /^\d{4}-\d{2}-\d{2}/.test(value) ? Date.parse(value.length === 10 ? `${value}T00:00:00Z` : value) : Number(value));
    const a = time(left, right);
    const b = Number(right);
    return Number.isFinite(a) && Number.isFinite(b) && left !== "" && right !== "" ? [a, b] : [String(left ?? "").toLowerCase(), String(right ?? "").toLowerCase()];
  };
  switch (filter.op) {
    case "and": return filter.args.every((arg) => matchesFilter(arg, attributes, id));
    case "or": return filter.args.some((arg) => matchesFilter(arg, attributes, id));
    case "not": return !matchesFilter(filter.arg, attributes, id);
    case "feature_ids": return id != null && filter.ids.includes(String(id));
    case "is_null": return value == null || value === "";
    case "is_not_null": return !(value == null || value === "");
    case "in": return filter.values.some((item) => String(item) === String(value));
    case "not_in": return !filter.values.some((item) => String(item) === String(value));
    case "contains": return String(value ?? "").toLowerCase().includes(String(filter.value ?? "").toLowerCase());
    case "starts_with": return String(value ?? "").toLowerCase().startsWith(String(filter.value ?? "").toLowerCase());
    default: {
      if (value == null) return false;
      const [a, b] = comparable(value, filter.value);
      if (filter.op === "eq") return a === b;
      if (filter.op === "neq") return a !== b;
      if (filter.op === "gt") return a > b;
      if (filter.op === "gte") return a >= b;
      if (filter.op === "lt") return a < b;
      if (filter.op === "lte") return a <= b;
      return false;
    }
  }
}

/**
 * A statistic over loaded records. `total` is the source's full count when known;
 * if fewer records are loaded, the result says it is a sample of them.
 */
/**
 * A statistic over records. Values that are codes rather than measurements (a
 * layer's sentinels, such as -1 for "Not Disclosed", or `exclude`) are left out
 * of sums, averages and extremes, and of counts of the field, and reported as
 * `excluded`. `sentinels` are [{ field, value }]; `excludeSentinels: false` keeps them.
 */
export function computeStat(block, records = [], { queries = {}, idField = null, total = null, exclude = [], sentinels = [], excludeSentinels = true } = {}) {
  const filter = block.queryRef ? queries[block.queryRef] : null;
  const matching = records.filter((record) => matchesFilter(filter, record.attributes || {}, idField ? record.attributes?.[idField] : null));
  const sample = Number.isFinite(total) && total > records.length;
  const codes = new Set([
    ...array(exclude).map(String),
    ...(excludeSentinels ? array(sentinels).filter((item) => item?.field === block.field).map((item) => String(item.value)) : []),
  ]);
  const isCode = (record) => block.field && codes.size > 0 && codes.has(String(record.attributes?.[block.field]));
  const kept = matching.filter((record) => !isCode(record));
  const excluded = matching.length - kept.length;
  if (block.stat === "count") {
    return { value: kept.length, sample, loaded: records.length, total, matched: matching.length, excluded };
  }
  const values = kept.map((record) => Number(record.attributes?.[block.field])).filter(Number.isFinite);
  if (!block.field || !values.length) return { value: null, sample, loaded: records.length, total, matched: matching.length, excluded };
  const sum = values.reduce((acc, item) => acc + item, 0);
  const value = { sum, average: sum / values.length, min: Math.min(...values), max: Math.max(...values) }[block.stat];
  return { value, sample, loaded: records.length, total, matched: matching.length, excluded };
}

export function formatStat(value) {
  if (value == null) return "—";
  if (Math.abs(value) >= 1e6) return `${(value / 1e6).toLocaleString(undefined, { maximumFractionDigits: 1 })}M`;
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: Math.abs(value) < 10 ? 2 : 0 });
}

/** Checks the author should see before presenting: empty titles, missing features, empty numbers. */
export function validateBriefing(briefing, { featureIds = null } = {}) {
  const issues = [];
  normalizeBriefing(briefing).slides.forEach((slide, index) => {
    const where = `Slide ${index + 1}`;
    if (!slide.title.trim()) issues.push({ slideId: slide.id, level: "warning", message: `${where} has no title.` });
    if (slide.template === "feature" && !slide.featureId) issues.push({ slideId: slide.id, level: "error", message: `${where} is a feature slide with no feature.` });
    if (slide.featureId && featureIds && !featureIds.has(slide.featureId)) issues.push({ slideId: slide.id, level: "warning", message: `${where}: its feature is not in the loaded data.` });
    if (slide.template === "media") {
      const images = slide.blocks.find((block) => block.type === "images")?.images || [];
      const words = slide.blocks.some((block) => block.type === "text" && block.markdown.trim());
      if (!images.length && !words) issues.push({ slideId: slide.id, level: "warning", message: `${where} has no images or text yet.` });
      if (images.some((image) => !image.alt.trim())) issues.push({ slideId: slide.id, level: "warning", message: `${where}: an image has no description for screen readers.` });
    }
    if (slide.template === "cinematic" && !slide.clipRef) issues.push({ slideId: slide.id, level: "error", message: `${where} has no Cinematic Clip selected.` });
    if (["map-narrative", "feature", "title"].includes(slide.template) && !slide.camera && !slide.fit) issues.push({ slideId: slide.id, level: "warning", message: `${where} has no saved map view.` });
  });
  return issues;
}
