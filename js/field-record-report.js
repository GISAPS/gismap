// Offline PDFs for Field Mode. They never require a map image: a coordinate
// link lets the desktop map rebuild a richer report later without changing the
// stable record ID or revision.
import { PDF_COLORS, PdfDocument, imageToJpeg, loadBrandLogo, printPalette, qrAsset } from "./pdf-document.js?v=0.69.1-pdflinks";

const when = (value) => value ? new Date(value).toLocaleString() : "";
const location = (record) => record.geometry?.type === "Point" ? `${record.geometry.coordinates[1].toFixed(6)}, ${record.geometry.coordinates[0].toFixed(6)}` : "No location captured";
const mapLink = (record, base = globalThis.location?.origin) => record.geometry?.type === "Point" && base ? `${base}/#at=${record.geometry.coordinates[1]},${record.geometry.coordinates[0]}` : null;

function sketchAsset(sketch) {
  if (!sketch?.strokes?.length) return null;
  const canvas = document.createElement("canvas"); canvas.width = 1000; canvas.height = 400;
  const context = canvas.getContext("2d"); context.fillStyle = "#fffdf8"; context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "#14755f"; context.lineWidth = 6; context.lineCap = "round"; context.lineJoin = "round";
  sketch.strokes.forEach((stroke) => { if (!stroke?.length) return; context.beginPath(); stroke.forEach(([x, y], index) => index ? context.lineTo(x * canvas.width, y * canvas.height) : context.moveTo(x * canvas.width, y * canvas.height)); context.stroke(); });
  return imageToJpeg(canvas.toDataURL("image/jpeg", .9), { maxSide: 1200 });
}

async function imageAssets(record, assets) {
  const photos = assets.filter((asset) => record.attachments.some((attachment) => attachment.localAssetId === asset.id) && /^image\//.test(asset.mime || asset.blob?.type || ""));
  return Promise.all(photos.map(async (asset) => {
    const source = URL.createObjectURL(asset.blob);
    try { return await imageToJpeg(source, { maxSide: 1200, quality: .85 }); } finally { URL.revokeObjectURL(source); }
  }));
}

/** One card per field observation, with local timestamps and a compact QR. */
export async function fieldRecordPdf(records, { assets = [], qrForRecord, skin = null, baseUrl = globalThis.location?.origin } = {}) {
  const palette = printPalette(skin); const logo = await loadBrandLogo(palette);
  const report = new PdfDocument({ heading: records.length === 1 ? "FIELD OBSERVATION" : "FIELD REPORT", logo, palette, homeUrl: baseUrl || undefined });
  for (let index = 0; index < records.length; index++) {
    const record = records[index]; if (index) report.newPage();
    const title = record.properties.title || record.properties.category || "Untitled observation";
    const link = mapLink(record, baseUrl);
    report.addLines(title, { size: 17, leading: 23, bold: true });
    report.addLines(`Record ${record.id} · revision ${record.sync.revision}`, { size: 9, leading: 14, color: report.colors.accent, bold: true });
    report.addLines(`Observed ${when(record.observedAt)} · collected ${when(record.createdAt)} · last saved locally ${when(record.modifiedAt)}`, { size: 9, leading: 14, color: PDF_COLORS.muted });
    report.gap(7); report.heading2("Observation");
    if (record.properties.category || record.properties.priority) report.addLines([record.properties.category, record.properties.priority && `priority: ${record.properties.priority}`].filter(Boolean).join(" · "));
    report.addLines(record.notes.text || "No written notes.");
    report.gap(7); report.heading2("Location"); report.addLines(location(record), { link });
    if (Number.isFinite(record.location.accuracyMeters)) report.addLines(`Source: ${record.location.source} · accuracy ±${Math.round(record.location.accuracyMeters)} m`, { size: 9, leading: 14, color: PDF_COLORS.muted });
    else report.addLines(`Source: ${record.location.source}`, { size: 9, leading: 14, color: PDF_COLORS.muted });
    if (link) report.addLines("Open location in GISMap Online desktop", { link, bold: true });
    const qr = await qrAsset(qrForRecord?.(record), { dark: palette.band }).catch(() => null);
    if (qr) { report.gap(8); report.heading2("Transfer record"); report.addLines("Scan this QR in Field Mode. Attachments remain in the .gisfield package.", { size: 9, leading: 14, color: PDF_COLORS.muted }); report.addImage(qr, { maxHeight: 145, maxWidth: 145, gapAfter: 8 }); }
    const photos = (await imageAssets(record, assets)).filter(Boolean);
    if (photos.length) { report.gap(8); report.heading2(`Photos · ${photos.length}`); photos.forEach((photo, photoIndex) => { report.addImage(photo, { maxHeight: 300, gapAfter: 5 }); report.addLines(`Photo ${photoIndex + 1}`, { size: 9, leading: 14, color: PDF_COLORS.muted }); }); }
    const sketch = await sketchAsset(record.sketch);
    if (sketch) { report.gap(8); report.heading2("Field sketch"); report.addImage(sketch, { maxHeight: 240 }); }
    report.gap(8); report.heading2("Registration");
    report.addLines(record.sync.registeredAt ? `Registered ${when(record.sync.registeredAt)}` : "Registration pending. This local record has not been sent to a server.", { size: 9, leading: 14, color: PDF_COLORS.muted });
  }
  return report.toBlob();
}

export function fieldRecordFileStem(record) {
  const slug = String(record?.properties?.title || record?.id || "report").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 48);
  return `field-report-${slug || "record"}`;
}
