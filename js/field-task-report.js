// Field task reports: a branded PDF (framed map, location details, check-in,
// steps, features, report, photos and a data table) and a CSV of the same
// record, built on the device that holds the task.
import { PDF_COLORS, PdfDocument, brandedMapImage, dataUrlBytes, imageToJpeg, loadBrandLogo, printPalette, qrAsset } from "./pdf-document.js?v=0.69.1-pdflinks";
import { addressPlace, taskSteps, withFocus } from "./field-task-share.js?v=0.70.0-ground";

const STATUS = { draft: "Draft", sent: "Sent", assigned: "To complete", "in-progress": "In progress", completed: "Completed", returned: "Report received", shared: "Shared" };
const MAX_PHOTO_SIDE = 1280;

const hasLocation = (item) => Number.isFinite(item?.latitude) && Number.isFinite(item?.longitude);
const coordinates = (item) => (hasLocation(item) ? `${Number(item.latitude).toFixed(6)}, ${Number(item.longitude).toFixed(6)}` : "");
const when = (value) => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleString() : "";
};

/** A file name stem for the task, e.g. "field-task-check-trailhead-sign". */
export function fieldTaskFileStem(task) {
  const slug = String(task?.title || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 48);
  return `field-task-${slug || "report"}`;
}

/**
 * Every place the task points at, each with a `kind` for its map pin: the task
 * location, attached features, then where the field worker checked in.
 */
export function fieldTaskPoints(task) {
  return [
    ...(hasLocation(task) ? [{ kind: "task", label: task.location || task.title || "Task location", longitude: task.longitude, latitude: task.latitude }] : []),
    ...(task?.features || []).filter(hasLocation).map((feature) => ({ kind: "feature", label: feature.label, longitude: feature.longitude, latitude: feature.latitude })),
    ...(hasLocation(task?.checkIn) ? [{ kind: "checkin", label: "Check-in", longitude: task.checkIn.longitude, latitude: task.checkIn.latitude }] : []),
  ];
}

export const FIELD_TASK_COLUMNS = Object.freeze(["section", "item", "status", "latitude", "longitude", "address", "recorded_at", "object_id", "layer_url", "notes"]);

/** One row per part of the task, in FIELD_TASK_COLUMNS order. Shared by the CSV and the PDF table. */
export function fieldTaskRows(task) {
  const row = (values) => FIELD_TASK_COLUMNS.map((column) => values[column] ?? "");
  const rows = [row({ section: "task", item: task.title || "Field task", status: STATUS[task.status] || task.status || "", latitude: task.latitude, longitude: task.longitude, address: task.address?.label, recorded_at: task.capturedAt, notes: task.notes })];
  if (task.location || task.address) rows.push(row({ section: "location", item: task.location || "Task location", latitude: task.latitude, longitude: task.longitude, address: task.address?.label, notes: addressPlace(task.address) }));
  if (hasLocation(task.checkIn)) {
    rows.push(row({ section: "check-in", item: task.completedBy || "Field check-in", latitude: task.checkIn.latitude, longitude: task.checkIn.longitude, address: task.checkIn.address?.label, recorded_at: task.checkIn.at, notes: [Number.isFinite(task.checkIn.accuracy) && `accuracy ${Math.round(task.checkIn.accuracy)} m`, addressPlace(task.checkIn.address)].filter(Boolean).join("; ") }));
  }
  taskSteps(task).forEach((step) => rows.push(row({ section: "step", item: step.text, status: step.done ? "done" : "open" })));
  (task.features || []).forEach((feature) => rows.push(row({ section: "feature", item: feature.label, status: feature.done ? "visited" : "not visited", latitude: feature.latitude, longitude: feature.longitude, object_id: feature.objectId, layer_url: feature.layerUrl })));
  if (task.report || task.completedAt || task.completedBy) rows.push(row({ section: "report", item: task.completedBy, status: task.completedAt ? "completed" : "", recorded_at: task.completedAt, notes: task.report }));
  (task.photos || []).forEach((_, index) => rows.push(row({ section: "photo", item: `Photo ${index + 1}`, status: "in PDF report" })));
  return rows;
}

// Spreadsheet apps run cells that start with = + - @ as formulas; quote them as text.
const csvCell = (value) => {
  if (value == null || value === "") return "";
  let text = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

export function fieldTaskCsv(task) {
  return `${[FIELD_TASK_COLUMNS, ...fieldTaskRows(task)].map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}

/** Downscales a photo from a file input to a JPEG data URL small enough to keep with the task. */
export async function photoDataUrl(file) {
  const source = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  const jpeg = await imageToJpeg(source, { maxSide: MAX_PHOTO_SIDE, quality: 0.85 });
  return jpeg?.dataUrl || source;
}

/**
 * Builds the PDF. `mapImage` is an optional { dataUrl, width, height } capture of
 * the map at the task's places. `reportUrl` is the task's share link: its QR code
 * goes in the report, and the map and every coordinate link back to it, focused
 * on that place or feature.
 */
export async function fieldTaskPdf(task, { mapImage = null, reportUrl = null, skin = null } = {}) {
  const palette = printPalette(skin);
  const logo = await loadBrandLogo(palette);
  const report = new PdfDocument({ heading: "FIELD TASK REPORT", logo, palette, homeUrl: reportUrl ? new URL("./", reportUrl).href : undefined });
  const focusLink = (place) => (reportUrl ? withFocus(reportUrl, place) : null);
  const muted = { size: 9, leading: 14, color: PDF_COLORS.muted };
  report.addLines(task.title || "Field task", { size: 16, leading: 22, bold: true });
  const status = [STATUS[task.status] || task.status, task.completedBy && `completed by ${task.completedBy}`, when(task.completedAt)].filter(Boolean).join(" - ");
  if (status) report.addLines(status, { size: 10, leading: 15, color: report.colors.accent, bold: true });
  report.addLines(`Generated ${new Date().toLocaleString()}`, muted);

  if (task.location || task.address || hasLocation(task)) {
    report.gap(10);
    report.heading2("Task location");
    if (task.location) report.addLines(task.location, { size: 11, leading: 16, bold: true });
    if (task.address?.label) report.addLines(task.address.label);
    if (addressPlace(task.address)) report.addLines(addressPlace(task.address), muted);
    if (hasLocation(task)) report.addLines(`Coordinates: ${coordinates(task)}`, { link: focusLink(task) });
  }
  if (hasLocation(task.checkIn)) {
    report.gap(10);
    report.heading2("Field check-in");
    report.addLines([when(task.checkIn.at) && `Checked in ${when(task.checkIn.at)}`, task.completedBy && `by ${task.completedBy}`].filter(Boolean).join(" ") || "Checked in", { bold: true });
    if (task.checkIn.address?.label) report.addLines(task.checkIn.address.label);
    if (addressPlace(task.checkIn.address)) report.addLines(addressPlace(task.checkIn.address), muted);
    report.addLines(`Coordinates: ${coordinates(task.checkIn)}${Number.isFinite(task.checkIn.accuracy) ? ` (accuracy ${Math.round(task.checkIn.accuracy)} m)` : ""}`, { link: focusLink(task.checkIn) });
  }
  if (task.notes) {
    report.gap(10);
    report.heading2("Instructions");
    report.addLines(task.notes);
  }
  const steps = taskSteps(task);
  if (steps.length) {
    report.gap(10);
    report.heading2(`Steps - ${steps.filter((step) => step.done).length} of ${steps.length} done`);
    steps.forEach((step) => report.addLines(`[${step.done ? "x" : " "}] ${step.text}`));
  }
  const features = task.features || [];
  if (features.length) {
    report.gap(10);
    report.heading2(`Features - ${features.filter((feature) => feature.done).length} of ${features.length} visited`);
    features.forEach((feature, index) => {
      report.addLines(`[${feature.done ? "x" : " "}] ${feature.label}`, { bold: true });
      report.addLines([feature.objectId != null && `ID ${feature.objectId}`, coordinates(feature)].filter(Boolean).join(" - "), { ...muted, link: hasLocation(feature) ? focusLink({ ...feature, feature: index }) : null });
      if (feature.layerUrl) report.addLines(feature.layerUrl, { ...muted, maxChars: 100 });
    });
  }
  if (task.report) {
    report.gap(10);
    report.heading2("Report");
    report.addLines(task.report);
  }
  const qr = await qrAsset(reportUrl, { dark: palette.band }).catch(() => null);
  if (qr) {
    report.gap(10);
    report.heading2(task.role === "assignee" || task.status === "returned" ? "Completed report link" : "Task link");
    report.addLines("Scan or click to open this task in GISMap Online, with its places, features and steps. Photos are only in this PDF.", muted);
    report.gap(4);
    report.addImage(qr, { maxHeight: 150, maxWidth: 150, gapAfter: 8, link: reportUrl });
    report.addLines("Open in GISMap Online", { link: reportUrl, bold: true });
  }
  const points = fieldTaskPoints(task);
  const legend = [
    points.some((point) => point.kind === "task") && { shape: "diamond", label: "Task location" },
    points.some((point) => point.kind === "feature") && { shape: "small-diamond", label: "Feature" },
    points.some((point) => point.kind === "checkin") && { shape: "circle", label: "Check-in" },
  ].filter(Boolean);
  const map = mapImage?.dataUrl
    ? await brandedMapImage(mapImage, { title: task.title || "Field task", subtitle: `Field task map · ${when(task.completedAt || task.checkIn?.at || task.updatedAt) || new Date().toLocaleString()}`, legend, palette })
    : null;
  if (map) {
    report.gap(10);
    report.heading2("Map");
    if (reportUrl) report.addLines("Click the map to open the task in GISMap Online.", muted);
    report.addImage(map, { maxHeight: 420, link: reportUrl });
  }
  const photos = (await Promise.all((task.photos || []).map((photo) => imageToJpeg(photo, { maxSide: 1200, quality: 0.85 })))).filter(Boolean);
  if (photos.length) {
    report.gap(10);
    report.heading2(`Photos - ${photos.length}`);
    photos.forEach((photo, index) => {
      report.addImage(photo, { maxHeight: 300, gapAfter: 6 });
      report.addLines(`Photo ${index + 1}`, { ...muted, leading: 18 });
    });
  }
  // The same rows as the CSV, condensed to the columns that fit a page.
  report.newPage();
  report.heading2("Task data");
  report.addLines("The rows of the CSV export. Layer URLs are in the CSV.", muted);
  report.gap(4);
  const index = Object.fromEntries(FIELD_TASK_COLUMNS.map((column, position) => [column, position]));
  const shortTime = (value) => {
    const date = value ? new Date(value) : null;
    return date && !Number.isNaN(date.getTime()) ? date.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" }) : "";
  };
  report.addTable(
    [{ label: "Section", width: 50 }, { label: "Item", width: 104 }, { label: "Status", width: 52 }, { label: "Lat, Lon", width: 72 }, { label: "Recorded", width: 62 }, { label: "Address / notes", width: 176 }],
    fieldTaskRows(task).map((row) => [
      row[index.section],
      row[index.item],
      row[index.status],
      row[index.latitude] !== "" ? `${Number(row[index.latitude]).toFixed(5)}, ${Number(row[index.longitude]).toFixed(5)}` : "",
      shortTime(row[index.recorded_at]),
      [row[index.address], row[index.object_id] !== "" && `ID ${row[index.object_id]}`, row[index.notes]].filter(Boolean).join(" - "),
    ]),
  );
  return report.toBlob();
}
