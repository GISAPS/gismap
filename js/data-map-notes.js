// Data-review Map Notes are distinct from the legacy field observation records
// in project.notes. They are data, never instructions or permission to edit.
import { sanitizeSharedResourceUrl } from './share.js?v=0.70.1-colours';
import { summarizeMapNoteWorkflow } from './map-note-workflow.js?v=0.1.0';
const categories = new Set(['classification', 'data-quality', 'editing-instruction', 'clarification', 'insight', 'validation', 'investigation', 'other']);
const statuses = new Set(['open', 'in-review', 'resolved', 'archived']);
const allowed = (v, keys, what) => { if (!v || typeof v !== 'object' || Array.isArray(v) || Object.keys(v).some(k => !keys.includes(k))) throw new Error(`Unsupported ${what} fields.`); };
const text = (v, name, max, required = false) => { if (typeof v !== 'string' || v.length > max || (required && !v.trim())) throw new Error(`Invalid ${name}.`); return v; };
const timestamp = (v) => { if (typeof v !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(v) || !Number.isFinite(Date.parse(v))) throw new Error('Invalid Map Note timestamp.'); return v; };
function target(value, version) {
  allowed(value, ['type', 'datasetId', 'featureId', 'sourceUrl', 'coordinates', ...(['3.0', '4.0', '5.0'].includes(version) ? ['label'] : []), ...(['4.0', '5.0'].includes(version) ? ['context'] : [])], 'Map Note target');
  if (!['project', 'feature', 'dataset', 'service', 'location', ...(['3.0', '4.0', '5.0'].includes(version) ? ['custom'] : [])].includes(value.type)) throw new Error('Invalid Map Note target type.');
  const result = { type: value.type };
  if (value.type === 'custom') result.label = text(value.label, 'target label', 256, true);
  if (value.datasetId != null) result.datasetId = text(value.datasetId, 'dataset ID', 256, true);
  if (value.featureId != null) result.featureId = text(value.featureId, 'feature ID', 256, true);
  if (value.sourceUrl != null) result.sourceUrl = sanitizeSharedResourceUrl(value.sourceUrl, { allowHttp: true });
  if (value.type === 'feature' && (!result.datasetId || !result.featureId)) throw new Error('Feature notes require dataset and feature IDs.');
  if (value.type === 'dataset' && !result.datasetId) throw new Error('Dataset notes require a dataset ID.');
  if (value.type === 'service' && !result.sourceUrl) throw new Error('Service notes require a safe service URL.');
  if (value.coordinates != null) {
    const c = value.coordinates;
    if (!Array.isArray(c) || c.length !== 2 || !c.every(n => typeof n === 'number' && Number.isFinite(n)) || Math.abs(c[0]) > 180 || Math.abs(c[1]) > 90) throw new Error('Invalid Map Note coordinates.');
    result.coordinates = c.map(value => Number(value.toFixed(8)));
  }
  if (value.context != null) {
    allowed(value.context, ['address', 'geographies', 'features'], 'Map Note context');
    const context = {};
    if (value.context.address != null) context.address = text(value.context.address, 'address', 512, true);
    if (value.context.geographies != null) {
      if (!Array.isArray(value.context.geographies) || value.context.geographies.length > 30) throw new Error('Invalid geographic context.');
      context.geographies = value.context.geographies.map(item => { allowed(item, ['label', 'value'], 'geography'); return { label: text(item.label, 'geography label', 80, true), value: text(item.value, 'geography value', 256, true) }; });
    }
    if (value.context.features != null) {
      if (!Array.isArray(value.context.features) || value.context.features.length > 50) throw new Error('Invalid feature context.');
      context.features = value.context.features.map(item => {
        allowed(item, ['datasetId', 'featureId', 'sourceUrl', 'datasetTitle'], 'feature context');
        const ref = { datasetId: text(item.datasetId, 'dataset ID', 256, true) };
        if (item.featureId != null) ref.featureId = text(item.featureId, 'feature ID', 256, true);
        if (item.datasetTitle != null) ref.datasetTitle = text(item.datasetTitle, 'dataset title', 240, true);
        if (item.sourceUrl != null) ref.sourceUrl = sanitizeSharedResourceUrl(item.sourceUrl, { allowHttp: true });
        return ref;
      });
    }
    result.context = context;
  }
  if (value.type === 'location' && !result.coordinates) throw new Error('Location notes require coordinates.');
  return result;
}
export function normalizeDataMapNote(value) {
  allowed(value, ['kind', 'schemaVersion', 'id', 'title', 'body', 'category', 'tags', 'status', 'target', 'createdAt', 'updatedAt', ...(value.schemaVersion === '5.0' ? ['categories'] : [])], 'Map Note');
  if (value.kind !== 'map-note' || !['1.0', '2.0', '3.0', '4.0', '5.0'].includes(value.schemaVersion) || (value.schemaVersion === '1.0' && value.target?.type === 'project')) throw new Error('Unsupported data Map Note version.');
  const title = text(value.title, 'title', 240), body = text(value.body, 'body', 20000);
  if (!title.trim() && !body.trim()) throw new Error('Enter a title or note.');
  if ((['3.0', '4.0', '5.0'].includes(value.schemaVersion) ? typeof value.category !== 'string' || !value.category.trim() || value.category.length > 80 : !categories.has(value.category)) || !statuses.has(value.status)) throw new Error('Invalid Map Note category or status.');
  if (value.schemaVersion === '5.0' && (!Array.isArray(value.categories) || value.categories.length < 1 || value.categories.length > 30 || value.categories.some(item => typeof item !== 'string' || !item.trim() || item.length > 80) || new Set(value.categories).size !== value.categories.length || value.categories[0] !== value.category)) throw new Error('Invalid Map Note categories.');
  if (!Array.isArray(value.tags) || value.tags.length > 50) throw new Error('Invalid Map Note tags.');
  return { kind: 'map-note', schemaVersion: value.schemaVersion, id: text(value.id, 'ID', 128, true), title, body, category: value.category, ...(value.schemaVersion === '5.0' ? { categories: value.categories.slice() } : {}), tags: value.tags.map(t => text(t, 'tag', 80, true)), status: value.status, target: target(value.target, value.schemaVersion), createdAt: timestamp(value.createdAt), updatedAt: timestamp(value.updatedAt) };
}
export function normalizeDataMapNotes(values) {
  if (!Array.isArray(values) || values.length > 5000) throw new Error('Invalid data Map Notes list.');
  const list = values.map(normalizeDataMapNote), ids = new Set();
  for (const note of list) { if (ids.has(note.id)) throw new Error('Duplicate data Map Note ID.'); ids.add(note.id); }
  return list;
}
export class DataMapNotesRegistry {
  constructor({ project, events, persist = () => {} }) { Object.assign(this, { project, events, persist }); }
  list() { return structuredClone(this.project().mapNotes || []); }
  get(id) { return this.list().find(note => note.id === id) || null; }
  getWorkflowSummary(id) { if (!this.get(id)) throw new Error('Map Note not found.'); return summarizeMapNoteWorkflow(this.project(), id); }
  commit(notes, action, id) {
    const project = this.project(), previous = project.mapNotes;
    project.mapNotes = normalizeDataMapNotes(notes);
    try { this.persist(); } catch (error) { project.mapNotes = previous; throw error; }
    this.events?.publish('map-notes:changed', { action, noteId: id, count: notes.length });
  }
  create(input) {
    const now = new Date().toISOString();
    const id = `mn_${globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2)}`}`;
    const note = normalizeDataMapNote({ title: '', body: '', category: 'other', tags: [], status: 'open', ...input, kind: 'map-note', schemaVersion: input.categories ? '5.0' : input.target?.context ? '4.0' : input.target?.type === 'custom' || (input.category && !categories.has(input.category)) ? '3.0' : input.target?.type === 'project' ? '2.0' : '1.0', id, createdAt: now, updatedAt: now });
    this.commit([...this.list(), note], 'create', id); return structuredClone(note);
  }
  update(id, changes) {
    const old = this.get(id); if (!old) throw new Error('Map Note not found.');
    if (!changes || typeof changes !== 'object' || Array.isArray(changes) || Object.keys(changes).some(k => !['title', 'body', 'category', 'tags', 'status', 'target', 'categories'].includes(k))) throw new Error('Unsupported Map Note changes.');
    if (old.schemaVersion === '5.0' && changes.category != null && changes.categories == null) changes = { ...changes, categories: [changes.category, ...old.categories.filter(item => item !== old.category && item !== changes.category)] };
    const note = normalizeDataMapNote({ ...old, ...changes, schemaVersion: old.schemaVersion === '5.0' || changes.categories ? '5.0' : old.schemaVersion === '4.0' || changes.target?.context ? '4.0' : old.schemaVersion === '3.0' || changes.target?.type === 'custom' || (changes.category && !categories.has(changes.category)) ? '3.0' : changes.target?.type === 'project' ? '2.0' : old.schemaVersion, updatedAt: new Date().toISOString() });
    this.commit(this.list().map(item => item.id === id ? note : item), 'update', id); return structuredClone(note);
  }
  remove(id) { const notes = this.list(); if (!notes.some(n => n.id === id)) return false; this.commit(notes.filter(n => n.id !== id), 'remove', id); return true; }
}
