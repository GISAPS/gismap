// A deliberately bounded first report. The existing field bundle remains the
// authoritative portable record; the PDF contains one self-contained link per note.
import { makeFieldBundle } from './field-session-bundle.js?v=0.71.0-subsurface';
import { createFieldNoteUrl } from './field-note-link.js?v=0.71.0-subsurface';
import { PdfDocument, qrAsset } from './pdf-document.js?v=0.69.1-pdflinks';

export function prepareMapNotesReport(baseUrl, session, notes) {
  const bundle = makeFieldBundle(session, notes);
  if (!bundle.notes.length) throw new Error('There are no observations to report.');
  if (bundle.notes.length > 100) throw new Error('Reports currently support at most 100 observations at a time. Export the complete JSON backup instead.');
  // The current PDF writer has only built-in Helvetica and replaces Unicode.
  // Refuse rather than quietly damaging the printed record.
  if (/[^\x20-\x7e\n\r\t]/.test(JSON.stringify(bundle))) throw new Error('This PDF exporter cannot yet print non-ASCII text faithfully. Export the complete notes JSON instead.');
  return bundle.notes.map((note, index) => {
    try { return { note, url: createFieldNoteUrl(baseUrl, bundle.session, note) }; }
    catch (error) { throw new Error(`Observation ${index + 1}: ${error.message} No PDF was created.`); }
  });
}

// Split long unbroken words before passing them to the common PDF writer, which
// otherwise lets them run beyond the page. No note contents are clipped.
function lines(pdf, value, options = {}) {
  const width = options.maxChars || 85;
  for (const paragraph of String(value ?? '').split('\n')) {
    let line = '';
    for (const word of paragraph.trim().split(/\s+/).filter(Boolean)) {
      let rest = word;
      while (rest.length > width) {
        if (line) { pdf.addLines(line, options); line = ''; }
        pdf.addLines(rest.slice(0, width), options);
        rest = rest.slice(width);
      }
      if (line && line.length + rest.length + 1 > width) { pdf.addLines(line, options); line = ''; }
      line += (line ? ' ' : '') + rest;
    }
    pdf.addLines(line, options);
  }
}

/** Generate locally, sequentially: only one QR canvas exists at a time. */
export async function createMapNotesReport(baseUrl, session, notes, { onProgress = () => {}, makeQr = qrAsset } = {}) {
  const entries = prepareMapNotesReport(baseUrl, session, notes);
  const pdf = new PdfDocument({ heading: 'MAP NOTES FIELD REPORT', homeUrl: baseUrl });
  const localOrigin = ['localhost', '127.0.0.1', '[::1]'].includes(new URL(baseUrl).hostname);
  for (const [index, { note, url }] of entries.entries()) {
    onProgress(index + 1, entries.length);
    const qr = await makeQr(url);
    if (!qr?.bytes?.length) throw new Error(`Could not create the QR for observation ${index + 1}. No PDF was created; export JSON instead.`);
    if (index) pdf.newPage();
    lines(pdf, `Observation ${index + 1} of ${entries.length}: ${note.title || 'Untitled note'}`, { bold: true, size: 13, leading: 18, maxChars: 65 });
    // A locally rendered point diagram, not a screenshot or a geographic basemap.
    const y = pdf.y, x = pdf.margin, width = 290, height = 130;
    pdf.fillRect(x, y - height, width, height, '#e8f2ee');
    const [lon, lat] = note.anchor.geometry.coordinates;
    const px = x + ((lon + 180) / 360) * width, py = y - height + ((lat + 90) / 180) * height;
    pdf.fillRect(Math.max(x, Math.min(x + width - 6, px - 3)), Math.max(y - height, Math.min(y - 6, py - 3)), 6, 6, '#b34421');
    pdf.addImageAt(qr, { x: 385, y, width: 130, height: 130, link: url });
    pdf.y = y - height - 12;
    lines(pdf, 'World-coordinate locator only; not a basemap or map screenshot.', { size: 8, leading: 11 });
    lines(pdf, 'Scan the QR or click below to preview this observation. The link contains the note and session; source layers are not restored automatically.', { size: 9, leading: 13 });
    lines(pdf, 'Open this observation in GISMap Online', { link: url, bold: true, leading: 16 });
    if (localOrigin) lines(pdf, 'This link points to localhost and will not open this application on another device.', { size: 9, leading: 13 });
    const info = [
      `ID: ${note.id}`, `Observed: ${note.observedAt || note.createdAt}`,
      `Session: ${session?.title || '(none)'} | Project ID: ${session?.projectId || '(not included)'}`,
      `Longitude, latitude: ${lon}, ${lat} (EPSG:4326)`,
      `Type: ${note.type} | Status: ${note.status}`,
      note.coordinateSource && `Location source: ${note.coordinateSource}`,
      note.accuracyMeters != null && `Location accuracy: ${note.accuracyMeters} m`,
      note.observerPosition && `Collector GPS: ${note.observerPosition.coordinates.join(', ')}; accuracy: ${note.observerPosition.accuracyMeters ?? 'unknown'} m; captured: ${note.observerPosition.capturedAt}`,
      ...note.relationships.map(item => `Relationship: ${JSON.stringify(item)}`),
    ].filter(Boolean);
    for (const item of info) lines(pdf, item, { size: 9, leading: 13 });
    pdf.gap(6); pdf.heading2('Details');
    lines(pdf, note.body || '(No details)', { size: 10, leading: 15 });
    lines(pdf, 'The QR contains the full normalized observation. Save the JSON backup as well.', { size: 8, leading: 11 });
  }
  return pdf.toBlob();
}
