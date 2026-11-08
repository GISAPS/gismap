// Portable, versioned field-session representation. No browser storage details
// or attachments are included. Validate every field before modifying a project.
import { normalizeNotes } from './map-notes.js?v=0.70.3-geology';
export const FIELD_BUNDLE_VERSION = '1.0';
const SESSION_KEYS = ['id', 'title', 'description', 'collector', 'projectId', 'createdAt', 'updatedAt'];
function string(value, name, max, required = false) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw new Error(`Invalid field session ${name}.`);
  return value;
}
function timestamp(value, name) {
  string(value, name, 40, true);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) throw new Error(`Invalid field session ${name}.`);
  return value;
}
export function normalizeFieldBundle(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.schemaVersion !== FIELD_BUNDLE_VERSION || Object.keys(value).some(key => !['schemaVersion', 'session', 'notes'].includes(key))) throw new Error('This is not a supported field notes JSON bundle.');
  const notes = normalizeNotes(value.notes);
  if (!Array.isArray(value.notes)) throw new Error('The bundle has no observation list.');
  if (value.session == null) return { schemaVersion: FIELD_BUNDLE_VERSION, notes };
  const s = value.session;
  if (typeof s !== 'object' || Array.isArray(s) || Object.keys(s).some(key => !SESSION_KEYS.includes(key))) throw new Error('Unsupported field session metadata.');
  const session = { id: string(s.id, 'ID', 128, true), title: string(s.title, 'title', 240, true), description: string(s.description, 'description', 10000), collector: string(s.collector, 'collector', 120), projectId: string(s.projectId, 'project ID', 128, true), createdAt: timestamp(s.createdAt, 'creation date'), updatedAt: timestamp(s.updatedAt, 'update date') };
  return { schemaVersion: FIELD_BUNDLE_VERSION, session, notes };
}
export function makeFieldBundle(session, notes) {
  const metadata = session && Object.fromEntries(SESSION_KEYS.map(key => [key, session[key]]));
  return normalizeFieldBundle({ schemaVersion: FIELD_BUNDLE_VERSION, ...(metadata ? { session: metadata } : {}), notes });
}
// Existing identities are skipped only when the complete normalized record is
// identical. Never silently overwrite a different version of an observation.
export function mergeObservations(existing, incoming) {
  const result = normalizeNotes(existing), index = new Map(result.map(note => [note.id, note]));
  let added = 0, skipped = 0;
  for (const note of normalizeNotes(incoming)) {
    const previous = index.get(note.id);
    if (previous) {
      if (JSON.stringify(previous) !== JSON.stringify(note)) throw new Error(`Observation ${note.id} already exists with different contents. Nothing was imported.`);
      skipped++; continue;
    }
    result.push(note); index.set(note.id, note); added++;
  }
  return { notes: normalizeNotes(result), added, skipped };
}
