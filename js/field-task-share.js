// Field task links carry the whole assignment (or its completed report) in the
// URL fragment, so no server is involved. A paid, database-backed service can
// replace this later; until then the payload stays small enough for a QR code.
import { sanitizeSharedResourceUrl } from "./share.js?v=0.69.9-order";

const MAX_URL_LENGTH = 2800;
const MAX_FEATURES = 5;
const MAX_STEPS = 10;
const MAX_TITLE = 120;
const MAX_STEP = 120;
const MAX_NOTES = 500;
const MAX_LABEL = 80;
const MAX_NAME = 60;
const MAX_ADDRESS = 160;
const MAX_STYLE = 2400;

export const FIELD_TASK_LIMITS = Object.freeze({
  maxUrlLength: MAX_URL_LENGTH,
  maxFeatures: MAX_FEATURES,
  maxSteps: MAX_STEPS,
  maxNotes: MAX_NOTES,
});

export const DEFAULT_TASK_STEPS = Object.freeze(["Access is clear", "Signage is readable", "Site condition documented"]);

function base64UrlEncode(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64UrlDecode(value) {
  const normalized = String(value || "").replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(normalized + "=".repeat((4 - normalized.length % 4) % 4));
  return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
}

const text = (value, max) => String(value ?? "").trim().slice(0, max);
const coordinate = (value) => Number(Number(value).toFixed(6));
const flag = (value) => (value ? 1 : 0);
const validObjectId = (value) => (Number.isSafeInteger(value) || (typeof value === "string" && value.length > 0 && value.length <= 64));

/** Steps for any stored task, including drafts saved before steps were editable. */
export function taskSteps(task = {}) {
  if (Array.isArray(task.steps)) return task.steps.map((step) => ({ text: text(step?.text, MAX_STEP), done: Boolean(step?.done) })).filter((step) => step.text);
  return DEFAULT_TASK_STEPS.map((label, index) => ({ text: label, done: Boolean(task.checklist?.[index]) }));
}

/**
 * Address details from a reverse-geocode result ({ address, attributes }), the
 * same lookup Location Intelligence uses. Returns null when nothing was found.
 */
export function addressDetails(result, { latitude, longitude } = {}) {
  const attributes = result?.attributes || {};
  const label = text(attributes.LongLabel || result?.address || attributes.Match_addr, MAX_ADDRESS);
  if (!label) return null;
  const details = {
    label,
    neighborhood: text(attributes.Neighborhood, MAX_LABEL),
    city: text(attributes.City, MAX_LABEL),
    county: text(attributes.Subregion, MAX_LABEL),
    region: text(attributes.Region, MAX_LABEL),
    postal: text(attributes.Postal, 20),
    country: text(attributes.CntryName || attributes.CountryCode, MAX_LABEL),
  };
  if (Number.isFinite(latitude) && Number.isFinite(longitude)) Object.assign(details, { latitude, longitude });
  return Object.fromEntries(Object.entries(details).filter(([, value]) => value !== ""));
}

/** "Oakland, Alameda County, California 94612, United States" from the parts that are known. */
export function addressPlace(address) {
  if (!address) return "";
  const regionPostal = [address.region, address.postal].filter(Boolean).join(" ");
  return [address.neighborhood, address.city, address.county, regionPostal, address.country].filter(Boolean).join(", ");
}

/** The shareable layer URL for a feature layer or map-service sublayer. */
export function featureLayerUrl(layer) {
  const url = String(layer?.url || "").replace(/\/+$/, "");
  if (!url) return null;
  return Number.isInteger(layer.layerId) && !/\/\d+$/.test(url) ? `${url}/${layer.layerId}` : url;
}

export function serializeFieldTask(task, kind = "assign") {
  if (!["assign", "return"].includes(kind)) throw new Error("Unknown field task link type.");
  const features = (task.features || []).slice(0, MAX_FEATURES + 1);
  if (features.length > MAX_FEATURES) throw new Error(`A shared field task can include at most ${MAX_FEATURES} features.`);
  const layers = [];
  const compactFeatures = features.map((feature) => {
    let layerIndex;
    if (feature.layerUrl) {
      const url = sanitizeSharedResourceUrl(feature.layerUrl);
      layerIndex = layers.indexOf(url);
      if (layerIndex < 0) layerIndex = layers.push(url) - 1;
    }
    return {
      li: layerIndex,
      o: validObjectId(feature.objectId) ? feature.objectId : undefined,
      x: coordinate(feature.longitude),
      y: coordinate(feature.latitude),
      l: text(feature.label, MAX_LABEL) || undefined,
      d: kind === "return" ? flag(feature.done) : undefined,
    };
  });
  const steps = taskSteps(task).slice(0, MAX_STEPS);
  const payload = {
    v: 1,
    k: kind === "return" ? "r" : "a",
    id: text(task.id, 64),
    t: text(task.title, MAX_TITLE) || "Field task",
    p: text(task.location, MAX_TITLE) || undefined,
    n: text(task.notes, MAX_NOTES) || undefined,
    s: steps.map((step) => step.text),
    L: layers.length ? layers : undefined,
    f: compactFeatures.length ? compactFeatures : undefined,
  };
  // Layer styles ride along when the author has styled the layers (createFieldTaskUrl drops them if the link gets too long).
  const styles = layers.map((url) => task.layerStyles?.[url] || 0);
  if (styles.some((style) => style && JSON.stringify(style).length <= MAX_STYLE)) payload.R = styles.map((style) => (style && JSON.stringify(style).length <= MAX_STYLE ? style : 0));
  if (Number.isFinite(task.latitude) && Number.isFinite(task.longitude)) {
    payload.x = coordinate(task.longitude);
    payload.y = coordinate(task.latitude);
  }
  payload.a = text(task.address?.label, MAX_ADDRESS) || undefined;
  if (kind === "return") {
    const checkIn = task.checkIn;
    if (checkIn && Number.isFinite(checkIn.latitude) && Number.isFinite(checkIn.longitude)) {
      payload.c = {
        x: coordinate(checkIn.longitude),
        y: coordinate(checkIn.latitude),
        t: checkIn.at || undefined,
        r: Number.isFinite(checkIn.accuracy) ? Math.round(checkIn.accuracy) : undefined,
        a: text(checkIn.address?.label, MAX_ADDRESS) || undefined,
      };
    }
    payload.d = steps.map((step) => flag(step.done));
    payload.r = text(task.report, MAX_NOTES) || undefined;
    payload.by = text(task.completedBy, MAX_NAME) || undefined;
    payload.at = task.completedAt || new Date().toISOString();
  }
  return payload;
}

export function encodeFieldTask(task, kind = "assign") {
  return base64UrlEncode(JSON.stringify(serializeFieldTask(task, kind)));
}

const inRange = (lon, lat) => Number.isFinite(lon) && Number.isFinite(lat) && Math.abs(lon) <= 180 && Math.abs(lat) <= 90;

/**
 * A task a person or chatbot can write by hand: `#fieldTask=json:<URI-encoded JSON>`,
 * { title, location, lat, lon, notes, steps: ["…"], features: [{ layerUrl, objectId, lat, lon, label }] }.
 * Always an assignment: reports come only from the field. Null when not a json: link.
 */
export function readableFieldTaskPayload(value) {
  let body = String(value || "");
  if (!/^json(?::|%3A)/i.test(body)) return null;
  try { body = decodeURIComponent(body); } catch { /* Already decoded. */ }
  let task;
  try { task = JSON.parse(body.replace(/^json:/i, "")); } catch (error) { throw new Error(`This json: field task link is not valid JSON (${error.message}).`); }
  if (!task || typeof task !== "object" || typeof task.title !== "string") throw new Error("A json: field task needs a title.");
  if ((task.steps || []).length > MAX_STEPS) throw new Error(`A field task holds at most ${MAX_STEPS} steps; split the work into several tasks.`);
  const coordinate = (item, key, long) => Number(item?.[key] ?? item?.[long]);
  return serializeFieldTask({
    id: task.id, title: task.title, location: task.location, notes: task.notes ?? task.instructions,
    latitude: coordinate(task, "lat", "latitude"), longitude: coordinate(task, "lon", "longitude"),
    steps: (Array.isArray(task.steps) ? task.steps : []).map((step) => ({ text: typeof step === "string" ? step : step?.text, done: false })),
    features: (Array.isArray(task.features) ? task.features : []).map((feature) => ({ layerUrl: feature?.layerUrl, objectId: feature?.objectId, latitude: coordinate(feature, "lat", "latitude"), longitude: coordinate(feature, "lon", "longitude"), label: feature?.label })),
  });
}

export function decodeFieldTask(value, options = {}) {
  let raw = readableFieldTaskPayload(value);
  if (!raw) try { raw = JSON.parse(base64UrlDecode(value)); } catch { throw new Error("This field task link is not valid."); }
  // Links made before versioned payloads held the raw task object.
  if (raw && raw.v === undefined && typeof raw.title === "string") {
    raw = { v: 1, k: "a", id: raw.id, t: raw.title, p: raw.location, n: raw.notes, s: taskSteps(raw).map((step) => step.text), x: raw.longitude, y: raw.latitude };
  }
  if (!raw || raw.v !== 1 || !["a", "r"].includes(raw.k) || typeof raw.t !== "string") throw new Error("This field task link has an unsupported version.");
  const layers = Array.isArray(raw.L) ? raw.L.slice(0, MAX_FEATURES).map((url) => sanitizeSharedResourceUrl(url, options)) : [];
  const rawFeatures = Array.isArray(raw.f) ? raw.f : [];
  if (rawFeatures.length > MAX_FEATURES) throw new Error(`A shared field task can include at most ${MAX_FEATURES} features.`);
  const features = rawFeatures.map((feature, index) => {
    if (!inRange(feature?.x, feature?.y)) throw new Error(`Feature ${index + 1} has an invalid location.`);
    return {
      layerUrl: Number.isInteger(feature.li) ? layers[feature.li] ?? null : null,
      objectId: validObjectId(feature.o) ? feature.o : null,
      longitude: feature.x,
      latitude: feature.y,
      label: text(feature.l, MAX_LABEL) || `Feature ${index + 1}`,
      done: feature.d === 1,
    };
  });
  const layerStyles = {};
  (Array.isArray(raw.R) ? raw.R : []).forEach((style, index) => {
    if (layers[index] && style && typeof style === "object" && !Array.isArray(style) && JSON.stringify(style).length <= MAX_STYLE) layerStyles[layers[index]] = style;
  });
  const rawSteps = Array.isArray(raw.s) ? raw.s.slice(0, MAX_STEPS) : [];
  const done = Array.isArray(raw.d) ? raw.d : [];
  const task = {
    id: text(raw.id, 64) || null,
    title: text(raw.t, MAX_TITLE) || "Field task",
    location: text(raw.p, MAX_TITLE),
    notes: text(raw.n, MAX_NOTES),
    steps: rawSteps.map((step, index) => ({ text: text(step, MAX_STEP), done: done[index] === 1 })).filter((step) => step.text),
    features,
  };
  if (Object.keys(layerStyles).length) task.layerStyles = layerStyles;
  if (inRange(raw.x, raw.y)) Object.assign(task, { longitude: raw.x, latitude: raw.y });
  if (typeof raw.a === "string" && raw.a.trim()) task.address = { label: text(raw.a, MAX_ADDRESS) };
  if (raw.k === "r") {
    const checkIn = raw.c;
    if (checkIn && inRange(checkIn.x, checkIn.y)) {
      const at = new Date(checkIn.t);
      task.checkIn = {
        longitude: checkIn.x,
        latitude: checkIn.y,
        at: Number.isNaN(at.getTime()) ? null : at.toISOString(),
        accuracy: Number.isFinite(checkIn.r) && checkIn.r >= 0 ? checkIn.r : null,
        address: typeof checkIn.a === "string" && checkIn.a.trim() ? { label: text(checkIn.a, MAX_ADDRESS) } : null,
      };
    }
    const completedAt = new Date(raw.at);
    Object.assign(task, {
      report: text(raw.r, MAX_NOTES),
      completedBy: text(raw.by, MAX_NAME),
      completedAt: Number.isNaN(completedAt.getTime()) ? new Date().toISOString() : completedAt.toISOString(),
    });
  }
  return { kind: raw.k === "r" ? "return" : "assign", task };
}

export function createFieldTaskUrl({ baseUrl, task, kind = "assign", readable = false }) {
  const url = new URL(baseUrl);
  url.search = "";
  url.searchParams.set("workflow", "tasks");
  if (readable && kind === "assign") {
    const steps = taskSteps(task).map((step) => step.text);
    url.hash = `fieldTask=json:${encodeURIComponent(JSON.stringify({ id: task.id, title: task.title, location: task.location, lat: task.latitude, lon: task.longitude, notes: task.notes, steps, features: task.features?.length ? task.features.map(({ layerUrl, objectId, latitude, longitude, label }) => ({ layerUrl, objectId, lat: latitude, lon: longitude, label })) : undefined }))}`;
    return url.href;
  }
  url.hash = `fieldTask=${encodeFieldTask(task, kind)}`;
  // Styles are a nicety: without them the task still works, so they go first when space runs out.
  if (url.href.length > MAX_URL_LENGTH && task.layerStyles) url.hash = `fieldTask=${encodeFieldTask({ ...task, layerStyles: null }, kind)}`;
  if (url.href.length > MAX_URL_LENGTH) throw new Error("This field task is too long for a QR code. Shorten the instructions, steps, or report.");
  return url.href;
}

/**
 * Adds a focus to a share link: `at=lat,lon` zooms to that place and, for a
 * field task link, `feature=N` zooms to its Nth attached feature.
 */
export function withFocus(url, { latitude, longitude, feature } = {}) {
  const target = new URL(url);
  const params = new URLSearchParams(target.hash.replace(/^#/, ""));
  if (Number.isFinite(latitude) && Number.isFinite(longitude)) params.set("at", `${coordinate(latitude)},${coordinate(longitude)}`);
  if (Number.isInteger(feature) && feature >= 0) params.set("feature", String(feature));
  target.hash = params.toString();
  return target.href;
}

/** A plain map link that opens the app zoomed to a place, with a pin on it. */
export function locationUrl(baseUrl, { latitude, longitude }) {
  const target = new URL(baseUrl);
  target.search = "";
  target.hash = "";
  return withFocus(target.href, { latitude, longitude });
}

/** The focus part of a link's fragment, if any: { at: { latitude, longitude } | null, feature: number | null }. */
export function readFocus(hash) {
  const params = new URLSearchParams(String(hash || "").replace(/^#/, ""));
  const [latitude, longitude] = String(params.get("at") || "").split(",").map((value) => (value === "" ? NaN : Number(value)));
  const feature = params.get("feature");
  return {
    at: inRange(longitude, latitude) ? { latitude, longitude } : null,
    feature: feature != null && /^\d{1,2}$/.test(feature) ? Number(feature) : null,
  };
}

export function readFieldTaskHash(hash) {
  return new URLSearchParams(String(hash || "").replace(/^#/, "")).get("fieldTask");
}
