// A small, explicit share of the same canonical bundle used by JSON export.
// The fragment contains private content: callers must warn before sharing it.
import { makeFieldBundle, normalizeFieldBundle } from './field-session-bundle.js?v=0.70.3-geology';

export const FIELD_NOTE_URL_LIMIT = 2800;
const encode = (value) => {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
};
const decode = (value) => {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('This observation link is damaged or incomplete.');
  try {
    const encoded = value.replaceAll('-', '+').replaceAll('_', '/');
    const bytes = Uint8Array.from(atob(encoded + '='.repeat((4 - encoded.length % 4) % 4)), (c) => c.charCodeAt(0));
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch { throw new Error('This observation link is damaged or incomplete.'); }
};

export function createFieldNoteUrl(baseUrl, session, note) {
  const bundle = makeFieldBundle(session, [note]);
  if (bundle.notes[0].anchor.geometry.type !== 'Point') throw new Error('Share links currently support point observations only. Export the field session JSON instead.');
  const target = new URL(baseUrl);
  target.search = '';
  target.hash = new URLSearchParams({ fieldNote: `j1.${encode(JSON.stringify(bundle))}` }).toString();
  if (target.href.length > FIELD_NOTE_URL_LIMIT) throw new Error('This observation is too large for a portable link. Export the field session JSON instead; no content was omitted.');
  return target.href;
}

export function readFieldNoteHash(hash) {
  const value = new URLSearchParams(String(hash || '').replace(/^#/, '')).get('fieldNote');
  if (value == null) return null;
  if (value.length > FIELD_NOTE_URL_LIMIT || !value.startsWith('j1.')) throw new Error('This observation link is unsupported or too long.');
  let parsed;
  try { parsed = JSON.parse(decode(value.slice(3))); } catch (error) { throw new Error(`Could not open observation link: ${error.message}`); }
  const bundle = normalizeFieldBundle(parsed);
  if (bundle.notes.length !== 1 || bundle.notes[0].anchor.geometry.type !== 'Point') throw new Error('This link must contain exactly one point observation.');
  return bundle;
}
