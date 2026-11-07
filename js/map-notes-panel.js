import { refreshNoteRelationships } from './note-relationships-ui.js?v=0.1.0';
import { FieldSessionController } from './field-session-store.js?v=0.70.0-ground';
import { makeFieldBundle, normalizeFieldBundle } from './field-session-bundle.js?v=0.70.0-ground';
import { APP_ROOT } from './app-root.js?v=0.65.0-paths';
import { createFieldNoteUrl } from './field-note-link.js?v=0.70.0-ground';
// A deliberately small first UI for project-owned location notes. The shared
// workspace supplies docking and mobile behavior. All note text is escaped.
const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const choices = ['observation', 'issue', 'memory', 'question', 'idea', 'plan', 'other'];
const states = ['open', 'in_progress', 'resolved', 'archived'];
const label = (s) => s.replaceAll('_', ' ');
const options = (values, selected) => values.map((v) => `<option value="${v}"${v === selected ? ' selected' : ''}>${escape(label(v))}</option>`).join('');

export function openMapNotesPanel(ui, { point = null, editId = null, locationSource = 'map-selected', accuracy = null, feature = null, observer = null, featureUnavailable = false, compose = false } = {}) {
  const field = ui.fieldSessionController ||= new FieldSessionController(ui.projectManager, ui.events);
  if (field.session && field.session.projectId !== ui.projectManager.current.id && field.session.resumedIntoProjectId !== ui.projectManager.current.id) field.session = null;
  const registry = ui.projectManager.notes;
  const note = editId ? registry.get(editId) : null;
  if (editId && !note) throw new Error('That note is no longer in this project.');
  const editorOpen = Boolean(compose || point || editId);
  const anchor = note?.anchor?.geometry?.type === 'Point' ? note.anchor.geometry.coordinates : point;
  let observerPosition = note?.observerPosition || observer;
  let linked = note?.relationships?.find((item) => item.type === 'references_feature' || item.type === 'references_dataset') || feature;
  const list = registry.list();
  const items = list.map((item) => `<article class="feed-card map-note-card field-note-review-card"><span class="status-pill">${escape(label(item.status))}</span><h3>${escape(item.title || 'Untitled note')}</h3><p>${escape(item.body || 'No details provided.')}</p><span class="feed-card__meta">${escape(label(item.type))} · ${escape(item.anchor.geometry.type)}</span><div class="feed-card__actions map-note-card__actions">${item.anchor.geometry.type === 'Point' ? `<button type="button" data-note-edit="${escape(item.id)}">Review &amp; edit</button>` : ''}<button type="button" data-note-focus="${escape(item.id)}">Go to location</button><button type="button" data-note-share="${escape(item.id)}">Share link</button><button type="button" data-note-remove="${escape(item.id)}">Remove</button></div><details data-field-note-links="${escape(item.id)}"></details></article>`).join('');
  const host = ui.openMapNotesWorkspace(`<div class="map-notes-panel field-notes-panel"><div data-field-note-editor class="field-notes-editor" ${editorOpen ? '' : 'hidden'}><button type="button" data-field-note-back>← Back to field notes</button><div class="mobile-card field-notes-editor__card"><p class="form-note">Observations are saved on this device, not published or sent to AI. Browser storage can be cleared: download a JSON backup regularly. Offline launch requires the application to have been cached separately.</p><section><h3>Field session</h3><label class="field"><span>Session title</span><input data-session-title maxlength="240" value="${escape(ui.mapNotesSessionDraft?.title ?? field.session?.title ?? 'Field notes')}" /></label><label class="field"><span>Description (optional)</span><textarea data-session-description maxlength="10000" rows="2">${escape(ui.mapNotesSessionDraft?.description ?? field.session?.description ?? '')}</textarea></label><label class="field"><span>Collector (optional)</span><input data-session-collector maxlength="120" value="${escape(ui.mapNotesSessionDraft?.collector ?? field.session?.collector ?? '')}" /></label><p class="form-note">Session details are saved with the next observation.</p><p class="form-note" data-field-storage>Checking local storage…</p><button type="button" data-persist-storage>Request persistent storage</button><div data-session-resume></div></section><section><h3>${note ? 'Edit note' : 'New location note'}</h3>${anchor ? `<p class="form-note">Location: ${escape(Number(anchor[1]).toFixed(5))}, ${escape(Number(anchor[0]).toFixed(5))}${locationSource === 'gps' && accuracy != null && !note ? ` · GPS accuracy ±${escape(Math.round(accuracy))} m` : ''}</p><div data-linked-feature>${linked ? `<p class="form-note">Related ${linked.type === 'references_feature' ? 'feature' : 'dataset'}: ${escape(linked.datasetTitle || linked.datasetId || linked.targetId)}${linked.featureId ? ` · ID ${escape(linked.featureId)}` : ' · no stable feature ID available'}</p>` : featureUnavailable ? '<p class="form-note">This feature cannot be linked because its dataset has no reusable identifier. The selected location will still be saved.</p>' : ''}</div><p data-observer-position class="form-note">${observerPosition ? `Collector GPS: ${escape(Number(observerPosition.coordinates[1]).toFixed(5))}, ${escape(Number(observerPosition.coordinates[0]).toFixed(5))}${observerPosition.accuracyMeters != null ? ` · ±${escape(Math.round(observerPosition.accuracyMeters))} m` : ''}` : (ui.mobileMedia.matches ? 'Collector GPS has not been recorded.' : '')}</p><div data-note-form><label class="field"><span>Type</span><select name="type">${options(choices, note?.type || 'observation')}</select></label><label class="field"><span>Title (optional)</span><input name="title" maxlength="240" value="${escape(note?.title || '')}" /></label><label class="field"><span>Details</span><textarea name="body" maxlength="20000" rows="4">${escape(note?.body || '')}</textarea></label>${note ? `<label class="field"><span>Status</span><select name="status">${options(states, note.status)}</select></label>` : ''}<div class="map-note-card__actions"><button type="button" data-note-save class="button--primary">${note ? 'Save changes' : 'Save observation'}</button>${note ? '<button type="button" data-note-cancel>Cancel editing</button>' : ''}</div><p data-note-error role="alert"></p></div>` : '<p class="form-note">Click a feature or location on the map to place a note.</p>'}${ui.mobileMedia.matches ? `<button type="button" data-note-gps>${anchor ? 'Record collector GPS' : 'Use my GPS location'}</button><p data-gps-error role="status"></p>` : ''}</section></div></div><section data-field-note-overview ${editorOpen ? 'hidden' : ''}><p class="mobile-workflow__subtitle">Record observations at a location or feature, then share a link or QR code.</p><button type="button" class="mobile-primary" data-field-note-new>+ New field note</button><div class="map-notes-panel__head"><h3>Field notes for review (${list.length})</h3><div class="map-note-card__actions"><button type="button" data-note-export ${list.length ? '' : 'disabled'}>Download notes JSON</button><button type="button" data-note-pdf ${list.length ? '' : 'disabled'}>Create PDF</button><button type="button" data-note-import-button>Import notes JSON</button><input type="file" accept=".json,application/json" data-note-import hidden></div></div><div class="feed-list" data-field-notes-review>${items || '<div class="mobile-empty"><h2>No field notes</h2><p>Create a note for a location or feature, then review or share it here.</p></div>'}</div></section></div>`);
  ui.fieldNotesEditing = editorOpen;
  const showEditor = (visible) => {
    ui.fieldNotesEditing = visible;
    host.querySelector('[data-field-note-editor]').hidden = !visible;
    host.querySelector('[data-field-note-overview]').hidden = visible;
    ui.updateFieldNotesCursor?.();
  };
  host.querySelector('[data-field-note-new]')?.addEventListener('click', () => showEditor(true));
  host.querySelector('[data-field-note-back]')?.addEventListener('click', () => showEditor(false));
  ui.updateFieldNotesCursor?.();
  refreshNoteRelationships(ui);
  ui.refreshMapNoteMarkers(anchor);
  const sessionDraft = () => { ui.mapNotesSessionDraft = { title: host.querySelector('[data-session-title]').value, description: host.querySelector('[data-session-description]').value, collector: host.querySelector('[data-session-collector]').value }; };
  host.querySelectorAll('[data-session-title], [data-session-description], [data-session-collector]').forEach((input) => input.addEventListener('input', sessionDraft));
  ui.mapNotesAttachFeature = (reference) => { if (!host.isConnected || !host.querySelector('[data-linked-feature]')) return; linked = reference; const target = host.querySelector('[data-linked-feature]'); target.textContent = reference ? `Related ${reference.featureId ? 'feature' : 'dataset'}: ${reference.datasetTitle || reference.datasetId}${reference.featureId ? ` · ID ${reference.featureId}` : ' · no stable feature ID available'}` : ''; };
  host.querySelector('[data-note-save]')?.addEventListener('click', async (event) => {
    event.preventDefault(); const saveButton = event.currentTarget; const form = host.querySelector('[data-note-form]');
    const read = (name) => form.querySelector(`[name="${name}"]`)?.value || '';
    try {
      saveButton.disabled = true;
      if (!field.session || (field.session.projectId !== ui.projectManager.current.id && field.session.resumedIntoProjectId !== ui.projectManager.current.id)) field.session = null;
      if (!field.session && registry.list().some((item) => item.fieldSessionId)) throw new Error('Resume the saved field session before adding or editing its observations. If it is unavailable, export a JSON backup first.');
      if (!field.session) { const { newFieldSession } = await import('./field-session-store.js?v=0.70.0-ground'); field.session = newFieldSession(ui.projectManager.current); }
      field.session.title = host.querySelector('[data-session-title]').value.trim().slice(0, 240) || 'Field notes';
      field.session.description = host.querySelector('[data-session-description]').value;
      field.session.collector = host.querySelector('[data-session-collector]').value;
      if (note) await field.mutate('update', note.id, { type: read('type'), title: read('title'), body: read('body'), status: read('status'), ...(observerPosition ? { observerPosition } : {}) });
      else await field.mutate('create', { type: read('type'), title: read('title'), body: read('body'), ...(linked ? { relationships: [linked] } : {}), ...(observerPosition ? { observerPosition } : {}), coordinateSource: locationSource, ...(accuracy != null ? { accuracyMeters: accuracy } : {}), anchor: { type: 'point', geometry: { type: 'Point', coordinates: anchor }, crs: 'EPSG:4326' } });
      ui.toast('Observation saved locally. Export a backup regularly.');
      openMapNotesPanel(ui);
    } catch (error) { form.querySelector('[data-note-error]').textContent = `Not saved: ${error.message}`; saveButton.disabled = false; }
  });
  host.querySelector('[data-note-cancel]')?.addEventListener('click', () => openMapNotesPanel(ui));
  host.querySelectorAll('[data-note-edit]').forEach((button) => button.addEventListener('click', () => openMapNotesPanel(ui, { point, editId: button.dataset.noteEdit, feature, featureUnavailable })));
  host.querySelectorAll('[data-note-focus]').forEach((button) => button.addEventListener('click', async () => {
    const selected = registry.get(button.dataset.noteFocus); if (!selected) return;
    const geometry = selected.anchor.geometry;
    const coordinates = geometry.type === 'Point' ? geometry.coordinates : geometry.type === 'LineString' ? geometry.coordinates[0] : geometry.coordinates[0][0];
    try { await ui.mapController.setView({ center: coordinates.slice(0, 2), zoom: 15 }); } catch (error) { ui.error(error.message); }
  }));
  host.querySelectorAll('[data-note-share]').forEach((button) => button.addEventListener('click', () => {
    const selected = registry.get(button.dataset.noteShare); if (!selected) return;
    let url;
    try { url = createFieldNoteUrl(APP_ROOT, field.session, selected); }
    catch (error) { ui.error(error.message); return; }
    ui.openDialog({ eyebrow: 'Field Notes · sharing', title: 'Share this observation?',
      content: '<p>This link contains the complete observation, its location, feature references, and field session details. Anyone with the link can read and share them. Do not share sensitive observations unless you intend to disclose them.</p><p class="form-note">The data is embedded in the link; no account or server stores it. Linked features may need a separately accessible source.</p>',
      actions: [
        { label: 'Cancel', handler: () => ui.dialog.close() },
        { label: 'Show QR code', handler: async () => {
          if (!globalThis.QRCode?.toCanvas) { ui.error('The QR generator is unavailable. You can still copy the link.'); return; }
          ui.openDialog({ eyebrow: 'Field Notes · sharing', title: 'Scan this observation',
            content: '<p>Anyone who scans this code can read and share the complete observation, including its location and session details.</p><canvas class="map-note-qr" data-note-qr width="720" height="720" role="img" aria-label="QR code to open this observation"></canvas><p class="form-note" data-note-qr-status>Creating QR code…</p>',
            actions: [ { label: 'Close', primary: true, handler: () => ui.dialog.close() } ],
          });
          const canvas = ui.dialog.querySelector('[data-note-qr]');
          const status = ui.dialog.querySelector('[data-note-qr-status]');
          try {
            await globalThis.QRCode.toCanvas(canvas, url, { width: 720, margin: 4, errorCorrectionLevel: 'L', color: { dark: '#072f2b', light: '#ffffff' } });
            if (status.isConnected) status.textContent = 'Scan to preview the observation in GISMap Online. Importing requires confirmation.';
          } catch {
            if (status.isConnected) status.textContent = 'Could not generate a QR code for this observation. Use the link or export JSON instead.';
          }
        } },
        { label: 'Copy link', primary: true, handler: async () => {
          try { await navigator.clipboard.writeText(url); ui.dialog.close(); ui.toast('Observation link copied. Anyone with it can read the note.'); }
          catch { ui.error('Could not copy the link. Check browser clipboard permissions.'); }
        } },
      ],
    });
  }));
  host.querySelectorAll('[data-note-remove]').forEach((button) => button.addEventListener('click', async () => {
    // Two-step confirmation avoids accidental removal without a native dialog.
    if (button.dataset.confirm !== 'yes') { button.dataset.confirm = 'yes'; button.textContent = 'Confirm remove'; return; }
    button.disabled = true; try { await field.mutate('remove', button.dataset.noteRemove); ui.toast('Observation removed locally.'); openMapNotesPanel(ui, { point, locationSource, accuracy, feature, featureUnavailable }); } catch (error) { button.disabled = false; ui.error(`Could not remove observation: ${error.message}`); }
  }));
  host.querySelector('[data-note-import-button]')?.addEventListener('click', () => host.querySelector('[data-note-import]')?.click());
  host.querySelector('[data-note-import]')?.addEventListener('change', async (event) => {
    const input = event.currentTarget; const file = input.files?.[0]; if (!file) return;
    try {
      if (file.size > 32 * 1024 * 1024) throw new Error('Field notes files must be 32 MB or smaller.');
      const bundle = normalizeFieldBundle(JSON.parse(await file.text()));
      const result = await field.importBundle(bundle); ui.toast(`Imported ${result.added} observation${result.added === 1 ? '' : 's'}; ${result.skipped} already present.`); openMapNotesPanel(ui, { point });
    } catch (error) { ui.error(`Could not import notes: ${error.message}`); } finally { input.value = ''; }
  });
  host.querySelector('[data-persist-storage]')?.addEventListener('click', async () => {
    const status = host.querySelector('[data-field-storage]');
    try { const granted = await navigator.storage?.persist?.(); status.textContent = granted ? 'Persistent storage granted. Export a backup regularly.' : 'Persistent storage was not granted; the browser may evict data. Export a backup regularly.'; } catch { status.textContent = 'Persistent storage could not be requested. Export a backup regularly.'; }
  });
  host.querySelector('[data-note-gps]')?.addEventListener('click', (event) => {
    if (!navigator.geolocation) { host.querySelector('[data-gps-error]').textContent = 'GPS is unavailable in this browser.'; return; }
    const gpsButton = event.currentTarget; gpsButton.disabled = true; host.querySelector('[data-gps-error]').textContent = 'Finding your location…';
    navigator.geolocation.getCurrentPosition((position) => {
      observerPosition = { coordinates: [position.coords.longitude, position.coords.latitude], accuracyMeters: position.coords.accuracy, capturedAt: new Date(position.timestamp).toISOString() };
      if (!anchor) openMapNotesPanel(ui, { point: observerPosition.coordinates, locationSource: 'gps', accuracy: position.coords.accuracy, feature, featureUnavailable, observer: observerPosition });
      else { gpsButton.disabled = false; const display = host.querySelector('[data-observer-position]'); if (display) display.textContent = `Collector GPS: ${position.coords.latitude.toFixed(5)}, ${position.coords.longitude.toFixed(5)} · ±${Math.round(position.coords.accuracy)} m`; host.querySelector('[data-gps-error]').textContent = 'Collector position recorded; save the observation to keep it.'; }
    }, (error) => { gpsButton.disabled = false; host.querySelector('[data-gps-error]').textContent = `Could not get location: ${error.message}`; }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  });
  (async () => {
    const status = host.querySelector('[data-field-storage]');
    try {
      const sessions = await field.store.list();
      if (!status.isConnected) return;
      const persisted = await navigator.storage?.persisted?.().catch(() => false);
      const estimate = await navigator.storage?.estimate?.().catch(() => null);
      const low = estimate?.quota && estimate.usage / estimate.quota > 0.8;
      status.textContent = `Local storage ready. ${persisted ? 'Persistent storage granted.' : 'Storage may be evicted by the browser.'}${low ? ' Device storage is running low.' : ''} Export a backup regularly.`;
      const container = host.querySelector('[data-session-resume]');
      const projectNotes = registry.list();
      const resumable = sessions.filter((session) => projectNotes.every((item) => item.fieldSessionId === session.id));
      if (resumable.length && !field.session) {
        const select = document.createElement('select'); select.setAttribute('aria-label', 'Saved field session');
        for (const session of resumable) { const option = document.createElement('option'); option.value = session.id; option.textContent = `${session.title} (${session.notes.length} observations)`; select.append(option); }
        const resume = document.createElement('button'); resume.type = 'button'; resume.textContent = 'Resume saved field session';
        resume.addEventListener('click', async () => { resume.disabled = true; try { await field.resume(resumable.find((item) => item.id === select.value)); ui.mapNotesSessionDraft = null; openMapNotesPanel(ui, { point, locationSource, accuracy, feature, featureUnavailable }); ui.toast('Field session resumed locally.'); } catch (error) { resume.disabled = false; ui.error(error.message); } });
        container.append(select, resume);
      } else if (sessions.length && projectNotes.length && !field.session) {
        container.textContent = 'Saved sessions can be resumed in an empty project or a project with notes from that session.';
      }
    } catch (error) { if (status.isConnected) status.textContent = `Local storage unavailable: ${error.message} Observations cannot be saved.`; }
  })();
  host.querySelector('[data-note-pdf]')?.addEventListener('click', () => {
    ui.openDialog({ eyebrow: 'Field Notes · export', title: 'Create a field report?',
      content: '<p>The PDF and its QR codes contain private observation and session details. Anyone receiving them can read and share that information.</p><p class="form-note">Each QR contains one observation. The report uses a coordinate diagram, not a map screenshot, and does not restore source layers. This first version supports point notes with short links and ASCII text only. Export JSON for a complete backup. Links made on localhost only work where that local application is available.</p><p data-report-progress role="status"></p>',
      actions: [ { label: 'Cancel', handler: () => ui.dialog.close() }, { label: 'Create PDF', primary: true, handler: async (event) => {
        const button = event.currentTarget; button.disabled = true;
        const progress = ui.dialog.querySelector('[data-report-progress]');
        try {
          const { createMapNotesReport } = await import('./map-notes-report.js?v=0.70.0-ground');
          const blob = await createMapNotesReport(APP_ROOT, field.session, registry.list(), { onProgress: (current, total) => { if (progress?.isConnected) progress.textContent = `Preparing observation ${current} of ${total}…`; } });
          const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'gismap-field-report.pdf'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 5000);
          if (progress?.isConnected) ui.dialog.close(); ui.toast('Field report created locally. Keep a JSON backup.');
        } catch (error) { if (progress?.isConnected) progress.textContent = `Report not created: ${error.message}`; button.disabled = false; }
      } } ],
    });
  });
  host.querySelector('[data-note-export]')?.addEventListener('click', () => {
    const bundle = makeFieldBundle(field.session, registry.list());
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = 'gismap-field-session.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 5000);
  });
}
