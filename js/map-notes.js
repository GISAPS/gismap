import { sanitizeSharedResourceUrl } from './share.js?v=0.69.8-skin';
// Map Notes are project-owned records, independent of map engines and source features.
// Do not put these records in the public application state or send them to an AI.
export const NOTE_VERSION = '1.0';
export const NOTE_LIMIT = 5000;
export const RELATIONSHIP_TYPES = Object.freeze(['belongs_to_project', 'references_dataset', 'references_feature', 'located_at', 'related_to_note', 'responds_to_note', 'supersedes_note', 'supports_note', 'contradicts_note']);
const TYPES = new Set(['observation', 'issue', 'memory', 'question', 'idea', 'plan', 'other']);
const STATUSES = new Set(['open', 'in_progress', 'resolved', 'archived']);
const REVIEWS = new Set(['unreviewed', 'confirmed', 'needs_info', 'rejected']);
const TARGETS = new Set(['project', 'dataset', 'feature', 'location', 'note']);
const REL_TARGET = { belongs_to_project: 'project', references_dataset: 'dataset', references_feature: 'feature', located_at: 'location', related_to_note: 'note', responds_to_note: 'note', supersedes_note: 'note', supports_note: 'note', contradicts_note: 'note' };
const text = (v, name, max, required = false) => {
  if (v == null && !required) return '';
  if (typeof v !== 'string' || v.length > max || (required && !v.trim())) throw new Error(`Invalid ${name}.`);
  return v;
};
const keys = (value, allowed, label) => { if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some((key) => !allowed.includes(key))) throw new Error(`Unsupported ${label} fields.`); };
const id = () => `note_${globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2)}`}`;
const date = (v, name) => { if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(v) || !Number.isFinite(Date.parse(v))) throw new Error(`Invalid ${name}.`); return v; };
function coordinate(point) {
  if (!Array.isArray(point) || point.length < 2 || point.length > 3 || !point.every((n) => typeof n === 'number' && Number.isFinite(n)) || Math.abs(point[0]) > 180 || Math.abs(point[1]) > 90) throw new Error('Invalid longitude/latitude coordinate.');
  return point.slice();
}
function geometry(value) {
  if (!value || typeof value !== 'object') throw new Error('A note needs a geographic anchor.');
  keys(value, ['type', 'coordinates'], 'geometry');
  if (value.type === 'Point') return { type: 'Point', coordinates: coordinate(value.coordinates) };
  if (value.type === 'LineString') {
    if (!Array.isArray(value.coordinates) || value.coordinates.length < 2 || value.coordinates.length > 10000) throw new Error('Invalid note line.');
    return { type: value.type, coordinates: value.coordinates.map(coordinate) };
  }
  if (value.type === 'Polygon') {
    if (!Array.isArray(value.coordinates) || !value.coordinates.length || value.coordinates.length > 100) throw new Error('Invalid note polygon.');
    let count = 0;
    const rings = value.coordinates.map((ring) => {
      if (!Array.isArray(ring) || ring.length < 4 || (count += ring.length) > 10000) throw new Error('Invalid note polygon ring.');
      const result = ring.map(coordinate); if (result[0][0] !== result.at(-1)[0] || result[0][1] !== result.at(-1)[1]) throw new Error('Polygon rings must be closed.'); return result;
    });
    return { type: value.type, coordinates: rings };
  }
  throw new Error('Notes support point, line, or polygon anchors.');
}
function relationship(value) {
  keys(value, ['type', 'targetType', 'targetId', 'datasetId', 'featureId', 'sourceUrl', 'datasetTitle'], 'relationship');
  if (!value || !RELATIONSHIP_TYPES.includes(value.type) || !TARGETS.has(value.targetType) || REL_TARGET[value.type] !== value.targetType) throw new Error('Invalid note relationship.');
  const result = { type: value.type, targetType: value.targetType, targetId: text(value.targetId, 'relationship target', 256, value.targetType !== 'feature') };
  if (value.targetType === 'feature') { result.datasetId = text(value.datasetId, 'dataset ID', 256, true); result.featureId = text(String(value.featureId ?? ''), 'feature ID', 256, true); }
  if (value.datasetId != null && value.targetType !== 'feature') result.datasetId = text(value.datasetId, 'dataset ID', 256, true);
  if (value.datasetTitle != null) result.datasetTitle = text(value.datasetTitle, 'dataset title', 240);
  if (value.sourceUrl != null) result.sourceUrl = sanitizeSharedResourceUrl(value.sourceUrl, { allowHttp: true });
  return result;
}
function list(value, limit, name) { if (value == null) return []; if (!Array.isArray(value) || value.length > limit) throw new Error(`Invalid ${name}.`); return value; }
function message(value, label) {
  if (!value || typeof value !== 'object') throw new Error(`Invalid ${label}.`);
  keys(value, ['id', 'body', 'createdAt', 'author'], label);
  if (value.author) keys(value.author, ['displayName'], 'author');
  return { id: text(value.id, `${label} ID`, 128, true), body: text(value.body, `${label} body`, 10000, true), createdAt: date(value.createdAt, `${label} date`), ...(value.author ? { author: { displayName: text(value.author.displayName, 'author', 120) } } : {}) };
}
/** Validate and normalize untrusted version 1 records. No HTML is interpreted. */
export function normalizeNote(value) {
  if (!value || typeof value !== 'object' || value.schemaVersion !== NOTE_VERSION) throw new Error('Unsupported Map Note version.');
  keys(value, ['schemaVersion', 'id', 'type', 'title', 'body', 'tags', 'status', 'priority', 'createdAt', 'updatedAt', 'author', 'anchor', 'relationships', 'replies', 'attachments', 'review', 'fieldSessionId', 'observedAt', 'coordinateSource', 'accuracyMeters', 'revision', 'observerPosition'], 'note');
  if (value.author) keys(value.author, ['displayName'], 'author');
  if (value.review) keys(value.review, ['status', 'events'], 'review');
  if (value.anchor) keys(value.anchor, ['type', 'geometry', 'crs'], 'anchor');
  if (value.priority != null && !['low', 'normal', 'high'].includes(value.priority)) throw new Error('Invalid note priority.');
  const kind = value.type || 'observation', status = value.status || 'open', review = value.review?.status || 'unreviewed';
  if (!TYPES.has(kind) || !STATUSES.has(status) || !REVIEWS.has(review)) throw new Error('Invalid note type, status, or review state.');
  if (value.anchor?.crs && value.anchor.crs !== 'EPSG:4326' && value.anchor.crs !== 'OGC:CRS84') throw new Error('Note anchors must use longitude/latitude.');
  if (value.coordinateSource != null && !['gps', 'map-selected', 'feature-derived', 'manual'].includes(value.coordinateSource)) throw new Error('Invalid coordinate source.');
  if (value.accuracyMeters != null && (typeof value.accuracyMeters !== 'number' || !Number.isFinite(value.accuracyMeters) || value.accuracyMeters < 0)) throw new Error('Invalid GPS accuracy.');
  if (value.revision != null && (!Number.isSafeInteger(value.revision) || value.revision < 1)) throw new Error('Invalid observation revision.');
  let observerPosition;
  if (value.observerPosition != null) {
    keys(value.observerPosition, ['coordinates', 'accuracyMeters', 'capturedAt'], 'observer position');
    const accuracy = value.observerPosition.accuracyMeters;
    if (accuracy != null && (typeof accuracy !== 'number' || !Number.isFinite(accuracy) || accuracy < 0)) throw new Error('Invalid observer GPS accuracy.');
    observerPosition = { coordinates: coordinate(value.observerPosition.coordinates), ...(accuracy != null ? { accuracyMeters: accuracy } : {}), capturedAt: date(value.observerPosition.capturedAt, 'observer position date') };
  }
  const geom = geometry(value.anchor?.geometry);
  if (value.anchor?.type && !['point', 'area', 'feature'].includes(value.anchor.type)) throw new Error('Invalid anchor type.');
  if (value.anchor?.type === 'area' && geom.type === 'Point') throw new Error('An area note requires a line or polygon.');
  if (value.anchor?.type === 'point' && geom.type !== 'Point') throw new Error('A point note requires a point.');
  if (!String(value.title || '').trim() && !String(value.body || '').trim()) throw new Error('Enter a note title or details.');
  const attachments = list(value.attachments, 50, 'attachments');
  // Attachment storage is not yet implemented; reject rather than silently discard it.
  if (attachments.length) throw new Error('Attachments are not yet supported by this version.');
  const reviews = list(value.review?.events, 200, 'review events').map((event) => {
    keys(event, ['id', 'decision', 'createdAt', 'author'], 'review event');
    if (event.author) keys(event.author, ['displayName'], 'author');
    if (!event || !REVIEWS.has(event.decision) || event.decision === 'unreviewed') throw new Error('Invalid review decision.');
    return { id: text(event.id, 'review ID', 128, true), decision: event.decision, createdAt: date(event.createdAt, 'review date'), ...(event.author ? { author: { displayName: text(event.author.displayName, 'review author', 120) } } : {}) };
  });
  return { ...(observerPosition ? { observerPosition } : {}), ...(value.fieldSessionId ? { fieldSessionId: text(value.fieldSessionId, 'field session ID', 128, true) } : {}), ...(value.observedAt ? { observedAt: date(value.observedAt, 'observation date') } : {}), ...(value.coordinateSource ? { coordinateSource: value.coordinateSource } : {}), ...(value.accuracyMeters != null ? { accuracyMeters: value.accuracyMeters } : {}), ...(value.revision != null ? { revision: value.revision } : {}), schemaVersion: NOTE_VERSION, id: text(value.id, 'note ID', 128, true), type: kind, title: text(value.title, 'title', 240), body: text(value.body, 'body', 20000), tags: list(value.tags, 50, 'tags').map((tag) => text(tag, 'tag', 80, true)), status, priority: ['low', 'normal', 'high'].includes(value.priority) ? value.priority : 'normal', createdAt: date(value.createdAt, 'creation date'), updatedAt: date(value.updatedAt, 'update date'), ...(value.author ? { author: { displayName: text(value.author.displayName, 'author', 120) } } : {}), anchor: { type: geom.type === 'Point' ? 'point' : 'area', geometry: geom, crs: 'EPSG:4326' }, relationships: list(value.relationships, 100, 'relationships').map(relationship), replies: list(value.replies, 200, 'replies').map((item) => message(item, 'reply')), attachments: [], review: { status: review, events: reviews } };
}
export function normalizeNotes(values) {
  const notes = list(values, NOTE_LIMIT, 'notes').map(normalizeNote); const ids = new Set();
  for (const note of notes) { if (ids.has(note.id)) throw new Error(`Duplicate note ID: ${note.id}`); ids.add(note.id); }
  return notes;
}
export class MapNotesRegistry {
  constructor({ project, events, persist = () => {} }) { Object.assign(this, { project, events, persist }); }
  list(filters = {}) { return structuredClone((this.project().notes || []).filter((note) => Object.entries(filters).every(([key, value]) => key === 'datasetId' ? note.relationships.some((r) => r.targetId === value || r.datasetId === value) : key === 'reviewStatus' ? note.review.status === value : note[key] === value))); }
  get(noteId) { return this.list().find((note) => note.id === noteId) || null; }
  #commit(notes, action, noteId) {
    const project = this.project(), previous = project.notes;
    project.notes = normalizeNotes(notes);
    try { this.persist(); } catch (error) { project.notes = previous; throw error; }
    this.events?.publish('notes:changed', { action, noteId, count: notes.length });
  }
  create(input) {
    const now = new Date().toISOString(); const projectId = this.project().id;
    const note = normalizeNote({ ...input, schemaVersion: NOTE_VERSION, id: id(), createdAt: now, updatedAt: now, relationships: [...(input.relationships || []), { type: 'belongs_to_project', targetType: 'project', targetId: projectId }] });
    this.#commit([...(this.project().notes || []), note], 'create', note.id); return structuredClone(note);
  }
  update(noteId, changes) {
    const notes = this.project().notes || []; const old = notes.find((note) => note.id === noteId); if (!old) throw new Error('Note not found.');
    if (!changes || typeof changes !== 'object' || Array.isArray(changes)) throw new Error('Invalid note changes.');
    const updated = normalizeNote({ ...old, ...changes, id: old.id, schemaVersion: old.schemaVersion, createdAt: old.createdAt, updatedAt: new Date().toISOString() });
    this.#commit(notes.map((note) => note.id === noteId ? updated : note), 'update', noteId); return structuredClone(updated);
  }
  remove(noteId) { const notes = this.project().notes || []; if (!notes.some((note) => note.id === noteId)) return false; this.#commit(notes.filter((note) => note.id !== noteId), 'remove', noteId); return true; }
  import(records) { const incoming = normalizeNotes(records); const existing = this.project().notes || []; const ids = new Set(existing.map((note) => note.id)); if (incoming.some((note) => ids.has(note.id))) throw new Error('A note with that ID already exists; merge is not yet supported.'); this.#commit([...existing, ...incoming], 'import', null); return incoming.length; }
  exportJSON() { return JSON.stringify({ schemaVersion: NOTE_VERSION, notes: this.list() }, null, 2); }
}
