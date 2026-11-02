// Portable, transport-neutral handoff messages for Field Mode.  A GeoPayload
// deliberately holds only data: it never tells the receiver to execute code
// or fetch arbitrary resources.  QR, copied text, files and Web Share all use
// this exact envelope.
import { createFieldRecord, normalizeFieldRecord } from "./field-records.js";
import { decodeFieldTask, encodeFieldTask } from "./field-task-share.js";

export const GEOPAYLOAD_SCHEMA = "gismap-geopayload";
export const GEOPAYLOAD_VERSION = 1;
export const GEOPAYLOAD_PREFIX = "gismap-geopayload:v1:";
export const GEOPAYLOAD_TYPES = Object.freeze(["observation", "work-card", "return-receipt", "site-pack"]);
export const EMBEDDED_QR_TARGET = 2200;
export const EMBEDDED_QR_MAXIMUM = 2953;
export const GEOFRAME_PREFIX = "gismap-geoframe:v1:";
const MAX_JSON_BYTES = 512 * 1024;

const text = (value, max = 240) => String(value ?? "").trim().slice(0, max);
const id = (prefix) => `${prefix}_${globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2)}`}`;
const timestamp = (value) => {
  const parsed = new Date(value || Date.now());
  if (!Number.isFinite(parsed.getTime())) throw new Error("A GeoPayload needs a valid creation time.");
  return parsed.toISOString();
};

function jsonValue(value, depth = 0) {
  if (depth > 24) throw new Error("A GeoPayload is nested too deeply.");
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") { if (!Number.isFinite(value)) throw new Error("A GeoPayload cannot contain non-finite numbers."); return value; }
  if (Array.isArray(value)) return value.map((item) => jsonValue(item, depth + 1));
  if (!value || typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) throw new Error("A GeoPayload must contain plain JSON data only.");
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, jsonValue(value[key], depth + 1)]));
}

const stableJson = (value) => JSON.stringify(jsonValue(value));
const bytes = (value) => new TextEncoder().encode(typeof value === "string" ? value : stableJson(value)).byteLength;
const toBase64Url = (value) => {
  const source = new TextEncoder().encode(value); let binary = "";
  source.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
};
const fromBase64Url = (value) => {
  const binary = atob(String(value).replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - String(value).length % 4) % 4));
  return new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
};

// A short checksum detects transcription/scanning damage. It is not a
// signature and must not be mistaken for an authenticity guarantee.
function checksum(value) {
  let hash = 0x811c9dc5;
  for (const character of stableJson(value)) { hash ^= character.charCodeAt(0); hash = Math.imul(hash, 0x01000193); }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function envelope(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("This is not a GeoPayload.");
  if (value.schema !== GEOPAYLOAD_SCHEMA || value.version !== GEOPAYLOAD_VERSION) throw new Error("This GeoPayload version is not supported.");
  if (!GEOPAYLOAD_TYPES.includes(value.type)) throw new Error("This GeoPayload has an unsupported type.");
  const clean = {
    schema: GEOPAYLOAD_SCHEMA,
    version: GEOPAYLOAD_VERSION,
    type: value.type,
    id: text(value.id, 160),
    createdAt: timestamp(value.createdAt),
    data: jsonValue(value.data),
  };
  if (!clean.id) throw new Error("A GeoPayload needs a stable ID.");
  if (bytes(clean) > MAX_JSON_BYTES) throw new Error("This GeoPayload is too large. Share it as a field package instead.");
  const expected = checksum(clean);
  if (value.checksum != null && value.checksum !== expected) throw new Error("This GeoPayload appears damaged or was changed after it was created.");
  return { ...clean, checksum: expected };
}

/** Create a canonical GeoPayload envelope. */
export function createGeoPayload({ type, data, id: payloadId = id("payload"), createdAt = new Date().toISOString() } = {}) {
  return envelope({ schema: GEOPAYLOAD_SCHEMA, version: GEOPAYLOAD_VERSION, type, id: payloadId, createdAt, data });
}

export const validateGeoPayload = (payload) => envelope(payload);

/** Encode a GeoPayload as QR/copyable text or standalone JSON file text. */
export function encodeGeoPayload(payload, transport = "qr") {
  const clean = validateGeoPayload(payload);
  const json = stableJson(clean);
  if (transport === "file") return json;
  if (transport !== "qr" && transport !== "text") throw new Error("Unsupported GeoPayload transport.");
  return `${GEOPAYLOAD_PREFIX}${toBase64Url(json)}`;
}

/** Decode a prefixed QR/text message or a JSON GeoPayload file. */
export function decodeGeoPayload(input) {
  const source = String(input || "").trim();
  if (!source) throw new Error("No GeoPayload was provided.");
  let raw;
  try {
    raw = source.startsWith(GEOPAYLOAD_PREFIX) ? JSON.parse(fromBase64Url(source.slice(GEOPAYLOAD_PREFIX.length))) : JSON.parse(source);
  } catch {
    throw new Error("This GeoPayload is not valid JSON or QR text.");
  }
  return validateGeoPayload(raw);
}

export function estimateTransportSize(payload) {
  const file = encodeGeoPayload(payload, "file");
  const qr = encodeGeoPayload(payload, "qr");
  return { jsonBytes: bytes(file), qrCharacters: qr.length, embeddedQrTarget: EMBEDDED_QR_TARGET, embeddedQrMaximum: EMBEDDED_QR_MAXIMUM };
}

/** Suggest transports without silently truncating the data. */
export function recommendTransports(payload, capabilities = {}) {
  const size = estimateTransportSize(payload);
  const embedded = size.qrCharacters <= EMBEDDED_QR_TARGET;
  const maximum = size.qrCharacters <= EMBEDDED_QR_MAXIMUM;
  return {
    ...size,
    qr: { supported: capabilities.qr !== false && maximum, recommended: capabilities.qr !== false && embedded, reason: embedded ? "Fits the conservative static-QR target." : maximum ? "Fits only a dense QR; a file or native share is clearer." : "Too large for a reliable single QR." },
    file: { supported: capabilities.file !== false, recommended: !embedded, reason: "Preserves the complete payload without QR density limits." },
    nativeShare: { supported: capabilities.nativeShare === true, recommended: !embedded && capabilities.nativeShare === true, reason: "Useful for nearby devices when a file is available." },
  };
}

/** A compact record adapter. Binary assets and screen sketches remain in .gisfield packages. */
export function geoPayloadFromFieldRecord(record, options = {}) {
  const clean = normalizeFieldRecord(record);
  const portable = {
    schema: clean.schema, id: clean.id, collectionId: clean.collectionId, type: clean.type,
    createdAt: clean.createdAt, observedAt: clean.observedAt, modifiedAt: clean.modifiedAt,
    geometry: clean.geometry, location: clean.location, properties: clean.properties,
    notes: { text: clean.notes.text.slice(0, 600), transcript: null, transcriptStatus: "pending" },
    attachments: [], relations: clean.relations,
    sync: { status: "transferred", revision: clean.sync.revision }, history: [],
  };
  return createGeoPayload({ type: "observation", id: options.id || clean.id, createdAt: clean.createdAt, data: { record: portable } });
}

export function fieldRecordFromGeoPayload(payload) {
  const clean = validateGeoPayload(payload);
  if (clean.type !== "observation") throw new Error("This GeoPayload is not an observation.");
  return createFieldRecord(normalizeFieldRecord(clean.data?.record), { recordId: clean.data.record.id, createdAt: clean.data.record.createdAt });
}

/** Work cards reuse the already-audited Field Task data limits and URL safety rules. */
export function geoPayloadFromFieldTask(task, options = {}) {
  const normalized = decodeFieldTask(encodeFieldTask(task, "assign")).task;
  return createGeoPayload({ type: "work-card", id: options.id || normalized.id || id("work"), createdAt: options.createdAt, data: { task: normalized } });
}

export function fieldTaskFromGeoPayload(payload) {
  const clean = validateGeoPayload(payload);
  if (clean.type !== "work-card") throw new Error("This GeoPayload is not a work card.");
  return decodeFieldTask(encodeFieldTask(clean.data?.task, "assign")).task;
}

export function createReturnReceipt({ operationId = id("receipt"), payloadId, taskId = null, recordIds = [], completion = null, status = "accepted", acknowledgedAt = new Date().toISOString(), details = "" } = {}) {
  const originalPayloadId = text(payloadId, 160);
  if (!originalPayloadId) throw new Error("A return receipt needs the original payload ID.");
  const records = Array.isArray(recordIds) ? [...new Set(recordIds.map((value) => text(value, 160)).filter(Boolean))].slice(0, 100) : [];
  const task = text(taskId, 160) || null;
  return createGeoPayload({ type: "return-receipt", id: operationId, createdAt: acknowledgedAt, data: { payloadId: originalPayloadId, taskId: task, recordIds: records, completion: completion == null ? null : jsonValue(completion), status: text(status, 48) || "accepted", acknowledgedAt: timestamp(acknowledgedAt), details: text(details, 600) } });
}

// Animated QR is deliberately an optional transport. Every frame contains an
// integrity marker and a small XOR parity frame for each block, so a receiver
// can recover one missed data frame per block. More than one missing frame is
// reported plainly instead of producing a damaged handoff.
const frameChecksum = (value) => checksum({ value: String(value) });
const xorBytes = (parts, width) => {
  const output = new Uint8Array(width);
  parts.forEach((part) => {
    const encoded = part instanceof Uint8Array ? part : new TextEncoder().encode(part);
    for (let index = 0; index < width; index += 1) output[index] ^= encoded[index] || 0;
  });
  return output;
};
const binaryToBase64Url = (value) => {
  const bytes = value instanceof Uint8Array ? value : new TextEncoder().encode(value); let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
};
const base64UrlToBytes = (value) => Uint8Array.from(atob(String(value).replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - String(value).length % 4) % 4)), (character) => character.charCodeAt(0));

/** Split an otherwise-valid GeoPayload into screen-shareable QR frames. */
export function createAnimatedQrFrames(payload, { transferId = id("frames"), chunkSize = 640 } = {}) {
  const source = encodeGeoPayload(payload, "qr");
  const size = Math.max(160, Math.min(900, Math.floor(Number(chunkSize) || 640)));
  const groupSize = 4;
  const chunks = Array.from({ length: Math.ceil(source.length / size) }, (_, index) => source.slice(index * size, (index + 1) * size));
  const transfer = text(transferId, 160);
  if (!transfer || !chunks.length) throw new Error("Could not prepare animated QR frames.");
  const digest = frameChecksum(source);
  const frames = [];
  chunks.forEach((chunk, index) => {
    const block = Math.floor(index / groupSize);
    frames.push(`${GEOFRAME_PREFIX}${transfer}:${index}/${chunks.length}:${block}:d:${source.length}:${size}:${digest}:${toBase64Url(chunk)}`);
  });
  for (let start = 0; start < chunks.length; start += groupSize) {
    const block = Math.floor(start / groupSize); const group = chunks.slice(start, start + groupSize);
    frames.push(`${GEOFRAME_PREFIX}${transfer}:${start}/${chunks.length}:${block}:p:${source.length}:${size}:${digest}:${binaryToBase64Url(xorBytes(group, size))}`);
  }
  return { id: transfer, frames, dataFrames: chunks.length, parityFrames: Math.ceil(chunks.length / groupSize), sourceCharacters: source.length, checksum: digest, chunkSize: size, blockSize: groupSize };
}

export function decodeAnimatedQrFrame(input) {
  const source = String(input || "").trim();
  if (!source.startsWith(GEOFRAME_PREFIX)) throw new Error("This is not a GISMap Online animated QR frame.");
  const match = source.slice(GEOFRAME_PREFIX.length).match(/^([^:]+):(\d+)\/(\d+):(\d+):([dp]):(\d+):(\d+):([0-9a-f]{8}):([A-Za-z0-9_-]+)$/);
  if (!match) throw new Error("This animated QR frame is malformed.");
  const [, transferId, frameIndex, total, block, kind, sourceLength, chunkSize, digest, body] = match;
  const decoded = kind === "d" ? fromBase64Url(body) : base64UrlToBytes(body);
  return { transferId, index: Number(frameIndex), total: Number(total), block: Number(block), kind, sourceLength: Number(sourceLength), chunkSize: Number(chunkSize), checksum: digest, body: decoded };
}

/** Add a frame to a plain persisted accumulator. Safe to save in IndexedDB. */
export function addAnimatedQrFrame(accumulator = {}, input) {
  const frame = typeof input === "string" ? decodeAnimatedQrFrame(input) : input;
  const next = { id: frame.transferId, total: frame.total, sourceLength: frame.sourceLength, chunkSize: frame.chunkSize, checksum: frame.checksum, data: { ...(accumulator.data || {}) }, parity: { ...(accumulator.parity || {}) } };
  if (accumulator.id && accumulator.id !== frame.transferId) throw new Error("That frame belongs to a different animated transfer.");
  if ([next.total, next.sourceLength, next.chunkSize].some((value) => !Number.isFinite(value) || value < 1)) throw new Error("This animated QR frame has invalid metadata.");
  if (accumulator.id && (frame.total !== accumulator.total || frame.sourceLength !== accumulator.sourceLength || frame.chunkSize !== accumulator.chunkSize || frame.checksum !== accumulator.checksum)) throw new Error("That frame does not match this animated transfer.");
  if (!Number.isInteger(frame.index) || frame.index < 0 || frame.index >= frame.total) throw new Error("This animated QR frame has an invalid frame number.");
  if (frame.kind === "d") next.data[frame.index] = frame.body;
  else next.parity[frame.block] = frame.body;
  return next;
}

/** Rebuild the original payload; recovers one missing data frame per block. */
export function assembleAnimatedQrFrames(accumulator) {
  const state = accumulator || {}; const chunks = { ...(state.data || {}) };
  const total = Number(state.total); const size = Number(state.chunkSize); const blockSize = 4;
  if (!Number.isInteger(total) || total < 1 || !Number.isInteger(size) || size < 1) throw new Error("No animated transfer is ready to assemble.");
  for (let start = 0; start < total; start += blockSize) {
    const indexes = Array.from({ length: Math.min(blockSize, total - start) }, (_, offset) => start + offset);
    const missing = indexes.filter((index) => chunks[index] == null);
    if (!missing.length) continue;
    const parity = state.parity?.[Math.floor(start / blockSize)];
    if (missing.length !== 1 || !parity) continue;
    const known = indexes.filter((index) => index !== missing[0]).map((index) => chunks[index]);
    const restored = xorBytes([parity, ...known], size);
    chunks[missing[0]] = new TextDecoder().decode(restored);
  }
  const missing = Array.from({ length: total }, (_, index) => index).filter((index) => chunks[index] == null);
  if (missing.length) throw new Error(`Animated transfer is incomplete: ${missing.length} data frame${missing.length === 1 ? "" : "s"} still missing.`);
  const source = Array.from({ length: total }, (_, index) => chunks[index]).join("").slice(0, Number(state.sourceLength));
  if (frameChecksum(source) !== state.checksum) throw new Error("Animated transfer failed its integrity check. Scan the frames again.");
  return decodeGeoPayload(source);
}
