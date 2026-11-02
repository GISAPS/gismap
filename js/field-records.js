// Canonical, portable records for the offline-first Field Mode.  This module
// intentionally has no DOM or storage dependency so import/export can be
// tested and used by a future sync service without changing the record shape.
export const FIELD_RECORD_SCHEMA = "gismap.field-record.v1";
export const FIELD_PACKAGE_SCHEMA = "gismap.field-package.v1";
export const FIELD_QR_PREFIX = "gismap-field:v1:";

const MAX_TEXT = 20_000;
const cleanText = (value, max = MAX_TEXT) => String(value ?? "").trim().slice(0, max);
const now = () => new Date().toISOString();
const id = (prefix) => `${prefix}_${globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2)}`}`;
const finite = (value) => Number.isFinite(Number(value)) ? Number(value) : null;
const coordinate = (value) => Array.isArray(value) && value.length >= 2 && finite(value[0]) != null && finite(value[1]) != null
  ? [finite(value[0]), finite(value[1])] : null;

function geometry(value) {
  if (value == null) return null;
  const type = value.type;
  if (type === "Point") {
    const point = coordinate(value.coordinates);
    if (!point || Math.abs(point[0]) > 180 || Math.abs(point[1]) > 90) throw new Error("A point needs a valid longitude and latitude.");
    return { type, coordinates: point };
  }
  if (type === "LineString") {
    const points = (value.coordinates || []).map(coordinate);
    if (points.length < 2 || points.some((point) => !point)) throw new Error("A line needs at least two valid coordinates.");
    return { type, coordinates: points };
  }
  if (type === "Polygon") {
    const rings = (value.coordinates || []).map((ring) => ring.map(coordinate));
    if (!rings.length || rings.some((ring) => ring.length < 4 || ring.some((point) => !point))) throw new Error("A polygon needs a closed ring with at least four coordinates.");
    return { type, coordinates: rings };
  }
  throw new Error("Unsupported field geometry.");
}

function attachment(value) {
  if (!value || typeof value !== "object") throw new Error("Invalid field attachment.");
  const id = cleanText(value.id, 160);
  const localAssetId = cleanText(value.localAssetId, 160);
  const type = cleanText(value.type, 48);
  if (!id || !localAssetId || !type) throw new Error("A field attachment needs an ID, type, and local asset ID.");
  return { id, type, localAssetId, ...(cleanText(value.name, 240) ? { name: cleanText(value.name, 240) } : {}), ...(cleanText(value.mime, 120) ? { mime: cleanText(value.mime, 120) } : {}) };
}

/** Validates and canonicalizes one local-first field record. */
export function normalizeFieldRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value) || value.schema !== FIELD_RECORD_SCHEMA) throw new Error("This is not a supported field record.");
  const createdAt = new Date(value.createdAt);
  if (!Number.isFinite(createdAt.getTime())) throw new Error("A field record needs a valid creation time.");
  const recordId = cleanText(value.id, 160);
  const collectionId = cleanText(value.collectionId, 160);
  if (!recordId || !collectionId) throw new Error("A field record needs an ID and collection.");
  const location = value.location && typeof value.location === "object" ? value.location : {};
  const notes = value.notes && typeof value.notes === "object" ? value.notes : {};
  const properties = value.properties && typeof value.properties === "object" ? value.properties : {};
  const relations = value.relations && typeof value.relations === "object" ? value.relations : {};
  const sync = value.sync && typeof value.sync === "object" ? value.sync : {};
  const modifiedAt = new Date(value.modifiedAt || value.createdAt);
  const observedAt = new Date(value.observedAt || value.createdAt);
  if (!Number.isFinite(modifiedAt.getTime()) || !Number.isFinite(observedAt.getTime())) throw new Error("A field record has an invalid observation or modification time.");
  return {
    schema: FIELD_RECORD_SCHEMA,
    id: recordId,
    collectionId,
    type: cleanText(value.type || "observation", 64) || "observation",
    createdAt: createdAt.toISOString(),
    observedAt: observedAt.toISOString(),
    modifiedAt: modifiedAt.toISOString(),
    geometry: geometry(value.geometry),
    location: {
      accuracyMeters: finite(location.accuracyMeters),
      altitudeMeters: finite(location.altitudeMeters),
      headingDegrees: finite(location.headingDegrees),
      speedMetersPerSecond: finite(location.speedMetersPerSecond),
      source: cleanText(location.source || "manual", 64) || "manual",
    },
    properties: {
      title: cleanText(properties.title, 240),
      category: cleanText(properties.category, 120),
      priority: cleanText(properties.priority || "normal", 32) || "normal",
    },
    notes: {
      text: cleanText(notes.text),
      transcript: notes.transcript == null ? null : cleanText(notes.transcript),
      transcriptStatus: cleanText(notes.transcriptStatus || "pending", 32) || "pending",
    },
    attachments: Array.isArray(value.attachments) ? value.attachments.map(attachment) : [],
    relations: {
      fieldTaskIds: Array.isArray(relations.fieldTaskIds) ? relations.fieldTaskIds.map((item) => cleanText(item, 160)).filter(Boolean) : [],
      mapNoteIds: Array.isArray(relations.mapNoteIds) ? relations.mapNoteIds.map((item) => cleanText(item, 160)).filter(Boolean) : [],
    },
    sync: {
      status: cleanText(sync.status || "local-only", 48) || "local-only",
      revision: Math.max(1, Math.floor(finite(sync.revision) || 1)),
      submittedAt: sync.submittedAt || null,
      serverReceivedAt: sync.serverReceivedAt || null,
      registeredAt: sync.registeredAt || null,
      acknowledgedAt: sync.acknowledgedAt || null,
      registrationId: cleanText(sync.registrationId, 160) || null,
    },
    history: Array.isArray(value.history) ? value.history.slice(-20).map((entry) => ({ revision: Math.max(1, Math.floor(finite(entry?.revision) || 1)), modifiedAt: new Date(entry?.modifiedAt || createdAt).toISOString(), action: cleanText(entry?.action || "edited", 64) || "edited" })) : [],
    ...(value.sketch ? { sketch: value.sketch } : {}),
  };
}

export function createFieldRecord(values = {}, { recordId = id("field"), createdAt = now() } = {}) {
  return normalizeFieldRecord({
    schema: FIELD_RECORD_SCHEMA, id: recordId, collectionId: values.collectionId || "default", type: "observation", createdAt, observedAt: values.observedAt || createdAt, modifiedAt: values.modifiedAt || createdAt,
    geometry: values.geometry || null,
    location: values.location || { source: "manual", accuracyMeters: null },
    properties: values.properties || {}, notes: values.notes || {}, attachments: values.attachments || [], relations: values.relations || {}, history: values.history || [], sync: { status: "local-only", revision: 1, ...(values.sync || {}) },
    ...(values.sketch ? { sketch: values.sketch } : {}),
  });
}

/** Updates a record in place: IDs and original collection timestamp never change. */
export function reviseFieldRecord(existing, values = {}, { modifiedAt = now(), action = "edited" } = {}) {
  const current = normalizeFieldRecord(existing);
  return normalizeFieldRecord({
    ...current,
    ...values,
    id: current.id,
    createdAt: current.createdAt,
    observedAt: values.observedAt || current.observedAt,
    modifiedAt,
    sync: { ...current.sync, ...(values.sync || {}), revision: current.sync.revision + 1 },
    history: [...current.history, { revision: current.sync.revision, modifiedAt: current.modifiedAt, action }],
  });
}

export function recordFeature(record) {
  const clean = normalizeFieldRecord(record);
  return { type: "Feature", id: clean.id, geometry: clean.geometry, properties: { ...clean.properties, collectionId: clean.collectionId, observedAt: clean.createdAt, locationSource: clean.location.source, accuracyMeters: clean.location.accuracyMeters, notes: clean.notes.text, attachmentCount: clean.attachments.length } };
}

export function recordsGeoJSON(records) {
  return { type: "FeatureCollection", features: records.map(recordFeature) };
}

export function makeFieldPackage(records, assets = []) {
  return {
    schema: FIELD_PACKAGE_SCHEMA,
    exportedAt: now(),
    records: records.map(normalizeFieldRecord),
    assets: assets.map((asset) => ({ id: cleanText(asset.id, 160), type: cleanText(asset.type, 48), mime: cleanText(asset.mime, 120), name: cleanText(asset.name, 240), data: cleanText(asset.data, 30_000_000) })).filter((asset) => asset.id && asset.data),
  };
}

export function normalizeFieldPackage(value) {
  if (!value || typeof value !== "object" || Array.isArray(value) || value.schema !== FIELD_PACKAGE_SCHEMA || !Array.isArray(value.records) || !Array.isArray(value.assets || [])) throw new Error("This is not a supported .gisfield package.");
  return makeFieldPackage(value.records, value.assets || []);
}

const toBase64Url = (text) => {
  const bytes = new TextEncoder().encode(text); let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
};
const fromBase64Url = (text) => {
  const binary = atob(text.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - text.length % 4) % 4));
  return new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
};

/** QR contains only compact record content—never audio, photos, or drawings. */
export function encodeCompactFieldRecord(record) {
  const clean = normalizeFieldRecord(record);
  const payload = { s: 1, i: clean.id, c: clean.collectionId, t: clean.createdAt, g: clean.geometry, p: clean.properties, n: clean.notes.text.slice(0, 600), l: clean.location };
  const text = `${FIELD_QR_PREFIX}${toBase64Url(JSON.stringify(payload))}`;
  if (text.length > 2200) throw new Error("This observation is too large for one QR code. Export a .gisfield package instead.");
  return text;
}

export function decodeCompactFieldRecord(text) {
  if (!String(text).startsWith(FIELD_QR_PREFIX)) throw new Error("This is not a GISMap Online Field Mode QR record.");
  let payload;
  try { payload = JSON.parse(fromBase64Url(String(text).slice(FIELD_QR_PREFIX.length))); } catch { throw new Error("This Field Mode QR record is damaged."); }
  if (payload?.s !== 1) throw new Error("This Field Mode QR record has an unsupported version.");
  return createFieldRecord({ collectionId: payload.c, geometry: payload.g, properties: payload.p, notes: { text: payload.n, transcript: null, transcriptStatus: "pending" }, location: payload.l }, { recordId: payload.i, createdAt: payload.t });
}
