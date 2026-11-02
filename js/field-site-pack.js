// A deliberately transparent Site Pack manifest.  It is JSON rather than an
// executable project file: importing it only restores validated records and
// tasks. Binary attachments and PMTiles remain separately selected local files
// until a ZIP/PMTiles runtime is available in the host application.
import { normalizeFieldRecord } from "./field-records.js";
import { decodeFieldTask, encodeFieldTask } from "./field-task-share.js";

export const SITE_PACK_SCHEMA = "gismap-site-pack.v1";
const MAX_TASKS = 250;
const MAX_RECORDS = 2_000;
const MAX_LAYERS = 64;
const now = () => new Date().toISOString();
const text = (value, max = 240) => String(value ?? "").trim().slice(0, max);
const makeId = () => `site_${globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2)}`}`;

const task = (value) => decodeFieldTask(encodeFieldTask(value, "assign")).task;
const layer = (value) => ({ id: text(value?.id, 160), title: text(value?.title, 160), type: text(value?.type || "reference", 48), source: text(value?.source, 1024), featureCount: Math.max(0, Math.floor(Number(value?.featureCount) || 0)) });

export function normalizeSitePack(value) {
  if (!value || typeof value !== "object" || Array.isArray(value) || value.schema !== SITE_PACK_SCHEMA) throw new Error("This is not a supported GISMap Online Site Pack.");
  const createdAt = new Date(value.createdAt);
  if (!Number.isFinite(createdAt.getTime())) throw new Error("A Site Pack needs a valid creation time.");
  const id = text(value.id, 160);
  if (!id) throw new Error("A Site Pack needs a stable ID.");
  if (!Array.isArray(value.tasks) || value.tasks.length > MAX_TASKS) throw new Error(`A Site Pack can contain at most ${MAX_TASKS} tasks.`);
  if (!Array.isArray(value.records) || value.records.length > MAX_RECORDS) throw new Error(`A Site Pack can contain at most ${MAX_RECORDS} observations.`);
  if (!Array.isArray(value.layers || []) || value.layers.length > MAX_LAYERS) throw new Error(`A Site Pack can describe at most ${MAX_LAYERS} reference layers.`);
  const basemap = value.basemap && typeof value.basemap === "object" ? {
    id: text(value.basemap.id, 160), name: text(value.basemap.name, 240), format: text(value.basemap.format, 48), bytes: Math.max(0, Number(value.basemap.bytes) || 0), included: Boolean(value.basemap.included), renderer: text(value.basemap.renderer, 80),
  } : null;
  return {
    schema: SITE_PACK_SCHEMA,
    version: 1,
    id,
    name: text(value.name || "Field Site Pack", 240) || "Field Site Pack",
    createdAt: createdAt.toISOString(),
    tasks: value.tasks.map(task),
    records: value.records.map(normalizeFieldRecord),
    layers: (value.layers || []).map(layer),
    basemap,
    notes: text(value.notes, 2_000),
  };
}

export function createSitePack({ id = makeId(), name = "Field Site Pack", tasks = [], records = [], layers = [], basemap = null, notes = "", createdAt = now() } = {}) {
  return normalizeSitePack({ schema: SITE_PACK_SCHEMA, version: 1, id, name, createdAt, tasks, records, layers, basemap, notes });
}

export function sitePackEstimate(pack) {
  const clean = normalizeSitePack(pack);
  const jsonBytes = new TextEncoder().encode(JSON.stringify(clean)).byteLength;
  const basemapBytes = clean.basemap?.included ? clean.basemap.bytes : 0;
  return { manifestBytes: jsonBytes, basemapBytes, estimatedBytes: jsonBytes + basemapBytes, taskCount: clean.tasks.length, recordCount: clean.records.length, layerCount: clean.layers.length };
}
