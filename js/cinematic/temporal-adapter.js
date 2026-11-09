// Normalizes timestamped layer features without modifying the layer or its data.
// The initial cinematic renderer intentionally uses observed snapshots only.

const dateLike = (field = {}) => /date|time|timestamp/i.test(`${field.name || ""} ${field.alias || ""}`)
  || /^(date|timestamp)$/i.test(String(field.type || ""));

export function temporalFieldCandidates(layer) {
  return (layer?.fields || []).filter(dateLike).map((field) => ({
    name: field.name,
    label: field.alias || field.name,
    type: field.type || "unknown",
  }));
}

/** Numeric fields a Scenario sweep can step through (not IDs, not dates). */
export function numericFieldCandidates(layer) {
  return (layer?.fields || []).filter((field) => /^(?:esriFieldType)?(?:small-?integer|integer|single|double|long|big-?integer|number)$/i.test(String(field.type || "").replace(/^esriFieldType/i, ""))
    && field.name !== layer?.objectIdField && !/(?:^|_)(?:fid|oid|objectid|id)$/i.test(field.name) && !dateLike(field))
    .map((field) => ({ name: field.name, label: field.alias || field.name, type: field.type || "unknown" }));
}

/** Text fields a Sequence can step through in order (not IDs, numbers or dates). */
export function textFieldCandidates(layer) {
  return (layer?.fields || []).filter((field) => /^(?:esriFieldType)?string$/i.test(String(field.type || "")) && field.name !== layer?.objectIdField && !/(?:^|_)(?:guid|globalid|uuid)$/i.test(field.name) && !dateLike(field))
    .map((field) => ({ name: field.name, label: field.alias || field.name, type: field.type || "string" }));
}

const SEQUENCE_ORDERS = ["listed", "alphabetical"];
const MAX_SEQUENCE_VALUES = 1000;
const cleanField = (value) => (typeof value === "string" ? value.trim().slice(0, 160) : "");

/**
 * The Sequence and label settings of a playback's `temporal`, normalized:
 * `order` ("listed" with its `values`, or "alphabetical") steps through a text
 * field's values; `labelField` names each step of a number sweep from a text
 * field on the same row. Only a "number" playback has them.
 */
export function normalizeSequence(temporal = {}) {
  if (temporal?.kind !== "number") return {};
  const order = SEQUENCE_ORDERS.includes(temporal.order) ? temporal.order : null;
  const values = order === "listed" && Array.isArray(temporal.values)
    ? [...new Set(temporal.values.filter((value) => value != null && value !== "").map((value) => String(value).slice(0, 500)))].slice(0, MAX_SEQUENCE_VALUES) : [];
  const labelField = order ? "" : cleanField(temporal.labelField);
  return { ...(order ? { order } : {}), ...(values.length ? { values } : {}), ...(labelField ? { labelField } : {}) };
}

/** A playback value by kind: epoch ms for "time", the number for "number", 0 for "none". */
export function parsePlaybackValue(value, kind = "time") {
  if (kind === "none") return 0;
  if (kind === "number") {
    const number = value === "" || value == null ? NaN : Number(value);
    return Number.isFinite(number) ? number : null;
  }
  return parseTemporalValue(value);
}

export function parseTemporalValue(value) {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() : null;
  if (typeof value === "number") {
    // ArcGIS date fields are milliseconds; numeric years are deliberately not
    // inferred as dates because that would fabricate a time interpretation.
    return Math.abs(value) >= 10 ** 11 && Number.isFinite(value) ? value : null;
  }
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function observationId(feature, index, objectIdField) {
  const value = feature?.attributes?.[objectIdField];
  return value == null || value === "" ? null : value;
}

/** Up to `steps` ascending step values that split `values` into equal-count groups (null when they already fit). */
export function quantileSteps(values, steps) {
  const sorted = [...new Set(values)].sort((a, b) => a - b);
  if (sorted.length <= steps) return null;
  const all = [...values].sort((a, b) => a - b);
  const breaks = [];
  for (let i = 1; i <= steps; i += 1) breaks.push(all[Math.min(all.length - 1, Math.ceil((i * all.length) / steps) - 1)]);
  return [...new Set(breaks)];
}

function firstAtLeast(sorted, value) {
  let low = 0, high = sorted.length - 1;
  while (low < high) { const middle = (low + high) >> 1; if (sorted[middle] >= value) high = middle; else low = middle + 1; }
  return low;
}

/**
 * Return a bounded, deterministic playback model for already-queried features.
 * `kind` is "time" (a date field: the observed timeline), "number" (a numeric
 * field: a Scenario sweep through its values) or "none" (Ambient: every
 * feature at once, effects loop). Rows lacking a valid value or stable object
 * ID are reported, never guessed.
 */
export function normalizeTemporalFeatures(features = [], { timeField, groupField = "", objectIdField, kind = "time", steps = 0, order = null, values = [], labelField = "" } = {}) {
  if (kind !== "none" && !timeField) throw new Error(kind === "number" ? "Choose a numeric field." : "Choose a timestamp field.");
  if (!objectIdField) throw new Error("This layer needs a stable object ID field for cinematic playback.");
  if (order === "listed" && !values.length) throw new Error(`There is no listed order for ${timeField}. Stack the layer as a 3D chart by ${timeField}, or step through it A to Z.`);
  const attributesOf = (feature) => feature?.attributes || {};
  // A Sequence plays a text field's values by their position in the order: 1, 2, 3 …
  const sequence = kind === "number" && (order === "listed" || order === "alphabetical");
  const ranks = !sequence ? null : new Map((order === "listed" ? values.map(String)
    : [...new Set(features.map((feature) => attributesOf(feature)[timeField]).filter((value) => value != null && value !== "").map(String))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })))
    .map((value, index) => [value, index + 1]));
  const invalid = [];
  const observations = [];
  features.forEach((feature, index) => {
    const raw = attributesOf(feature)[timeField];
    const time = sequence ? ranks.get(String(raw ?? "")) ?? null : parsePlaybackValue(raw, kind);
    const id = observationId(feature, index, objectIdField);
    if (time == null || id == null) {
      invalid.push({ index, reason: time == null ? "invalid-time" : "missing-id" });
      return;
    }
    const group = groupField && feature.attributes?.[groupField] != null && feature.attributes[groupField] !== ""
      ? String(feature.attributes[groupField]) : "__all__";
    observations.push({ id, group, time, feature, index });
  });
  // A Scenario sweep over many distinct values plays in `steps` quantile steps:
  // each record joins the first step value at or above its own, so "up to" stays true.
  // A Sequence plays every value in its order.
  if (kind === "number" && steps > 0 && !sequence) {
    const breaks = quantileSteps(observations.map((item) => item.time), steps);
    if (breaks) for (const item of observations) { item.value = item.time; item.time = breaks[firstAtLeast(breaks, item.time)]; }
  }
  observations.sort((a, b) => a.time - b.time || String(a.id).localeCompare(String(b.id)) || a.index - b.index);
  const ticks = [...new Set(observations.map((item) => item.time))];
  return {
    kind,
    ...(sequence ? { order } : {}),
    labels: sequence ? Object.fromEntries([...ranks].filter(([, rank]) => ticks.includes(rank)).map(([value, rank]) => [rank, value])) : kind === "number" && labelField ? stepLabels(observations, labelField, attributesOf) : null,
    timeField: kind === "none" ? null : timeField,
    groupField: groupField || null,
    objectIdField,
    observations,
    ticks,
    start: ticks[0] ?? null,
    end: ticks.at(-1) ?? null,
    invalid,
  };
}

/**
 * Each step's label from a text field on its rows: the label of a row whose own
 * value is the step (a binned step may hold several), the most common one when
 * rows disagree. Steps whose rows have no label are left out.
 */
function stepLabels(observations, labelField, attributesOf) {
  const counts = new Map();
  for (const item of observations) {
    const label = attributesOf(item.feature)[labelField];
    if (label == null || label === "") continue;
    const exact = item.value === undefined || item.value === item.time;
    const tally = counts.get(item.time) || new Map();
    const entry = tally.get(String(label)) || { exact: 0, all: 0 };
    entry.all += 1;
    if (exact) entry.exact += 1;
    tally.set(String(label), entry);
    counts.set(item.time, tally);
  }
  return Object.fromEntries([...counts].map(([time, tally]) => [time, [...tally].sort((a, b) => b[1].exact - a[1].exact || b[1].all - a[1].all)[0][0]]));
}

/**
 * Instant semantics retain the newest observed state per group. Cumulative
 * semantics retain every observation through the current instant. Neither
 * mode interpolates or invents geometry.
 */
export function observedFeatureIdsAt(model, time, { timeMode = "instant" } = {}) {
  return observedFeaturesAt(model, time, { timeMode }).map((observation) => observation.id)
    .filter((id, index, ids) => ids.findIndex((value) => String(value) === String(id)) === index)
    .sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));
}

/** The source observations selected by the renderer at a given instant. */
export function observedFeaturesAt(model, time, { timeMode = "instant" } = {}) {
  if (!model?.observations?.length || !Number.isFinite(Number(time))) return [];
  const byId = (items) => items.sort((a, b) => String(a.id).localeCompare(String(b.id), undefined, { numeric: true }) || a.index - b.index);
  if (timeMode === "cumulative") {
    return byId(model.observations.filter((observation) => observation.time <= time));
  }
  const selectedTimes = new Map();
  for (const observation of model.observations) {
    if (observation.time > time) break;
    selectedTimes.set(observation.group, observation.time);
  }
  return byId(model.observations
    .filter((observation) => selectedTimes.get(observation.group) === observation.time));
}

export function nearestObservationIndex(ticks = [], time) {
  if (!ticks.length) return -1;
  let index = 0;
  for (let current = 1; current < ticks.length; current += 1) {
    if (ticks[current] > time) break;
    index = current;
  }
  return index;
}

const pointInExtent = (point, extent) => Array.isArray(point) && Number.isFinite(Number(point[0])) && Number.isFinite(Number(point[1]))
  && point[0] >= extent.xmin && point[0] <= extent.xmax && point[1] >= extent.ymin && point[1] <= extent.ymax;

function coordinatePairs(geometry) {
  if (!geometry || typeof geometry !== "object") return [];
  if (Number.isFinite(geometry.x) && Number.isFinite(geometry.y)) return [[geometry.x, geometry.y]];
  const pairs = [];
  const visit = (value) => {
    if (!Array.isArray(value)) return;
    if (value.length >= 2 && Number.isFinite(Number(value[0])) && Number.isFinite(Number(value[1]))) pairs.push(value);
    else value.forEach(visit);
  };
  visit(geometry.coordinates || geometry.paths || geometry.rings || geometry.points);
  return pairs;
}

/** True when an observation intersects a geographic view envelope. */
export function observationInExtent(observation, extent) {
  if (!extent || ![extent.xmin, extent.ymin, extent.xmax, extent.ymax].every(Number.isFinite)) return false;
  const pairs = coordinatePairs(observation?.feature?.geometry);
  if (pairs.some((point) => pointInExtent(point, extent))) return true;
  // A view can sit wholly inside a large perimeter, with no perimeter vertex
  // in view. Envelope overlap is the safe fallback for loaded GeoJSON/ArcGIS
  // geometries; it may retain edge-only candidates but never drops data that
  // is visibly relevant merely because of sparse vertices.
  if (!pairs.length) return false;
  const xs = pairs.map((point) => Number(point[0])), ys = pairs.map((point) => Number(point[1]));
  return Math.min(...xs) <= extent.xmax && Math.max(...xs) >= extent.xmin && Math.min(...ys) <= extent.ymax && Math.max(...ys) >= extent.ymin;
}

/** A model restricted to loaded observations inside the current map window. */
export function temporalModelInExtent(model, extent) {
  const observations = (model?.observations || []).filter((observation) => observationInExtent(observation, extent));
  const ticks = [...new Set(observations.map((observation) => observation.time))];
  return { ...model, observations, ticks, start: ticks[0] ?? null, end: ticks.at(-1) ?? null };
}
