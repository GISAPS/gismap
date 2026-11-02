import { createFieldRecord, decodeCompactFieldRecord, encodeCompactFieldRecord, makeFieldPackage, normalizeFieldPackage, normalizeFieldRecord, recordsGeoJSON, reviseFieldRecord } from "../js/field-records.js";
import { FieldRecordStore } from "../js/field-record-store.js";
import { decodeQrFromImage } from "../js/qr-import.js";
import { decodeFieldTask, readFieldTaskHash, taskSteps } from "../js/field-task-share.js";
import { addAnimatedQrFrame, assembleAnimatedQrFrames, createAnimatedQrFrames, createReturnReceipt, decodeGeoPayload, encodeGeoPayload, fieldRecordFromGeoPayload, fieldTaskFromGeoPayload, geoPayloadFromFieldRecord, recommendTransports } from "../js/geopayload.js";
import { brandedQrFile } from "../js/pdf-document.js";
import { fieldRecordFileStem, fieldRecordPdf } from "../js/field-record-report.js";
import { createSitePack, normalizeSitePack, sitePackEstimate } from "../js/field-site-pack.js";
import { createOfflineAnalysis, formatOfflineDistance, TURF_VERSION } from "../js/turf-offline.js";

const $ = (selector) => document.querySelector(selector);
const store = new FieldRecordStore();
let records = [];
let tasks = [];
let handoffs = [];
let packages = [];
let basemaps = [];
let selectedRecordIds = new Set();
let activeQrTransfer = null;
let capture = null;
let attachmentDrafts = [];
let drawing = [];
let activeStroke = null;
let installPrompt = null;
let qrCameraStream = null;
let qrCameraTimer = null;
let pendingGeoPayload = null;
let animatedQrIntake = null;
let animatedQrTimer = null;
let analysisBuffer = null;

const toast = (message) => { const node = $("[data-toast]"); node.textContent = message; clearTimeout(toast.timer); toast.timer = setTimeout(() => { node.textContent = ""; }, 4200); };
const escape = (value) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
const date = (value) => new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
const recordName = (record) => record.properties.title || record.properties.category || "Untitled observation";
const download = (name, value, type) => { const href = URL.createObjectURL(new Blob([value], { type })); const link = document.createElement("a"); link.href = href; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(href), 1000); };
const assetId = () => `asset_${globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2)}`}`;

function capabilities() {
  const media = Boolean(navigator.mediaDevices?.getUserMedia && globalThis.MediaRecorder);
  const recognition = Boolean(globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition);
  const turf = Boolean(globalThis.turf?.distance && globalThis.turf?.buffer);
  const entries = [["Local storage", Boolean(globalThis.indexedDB)], ["GPS", Boolean(navigator.geolocation)], ["Offline spatial analysis", turf], ["Audio recording", media], ["Browser speech recognition", recognition], ["Camera capture", "capture" in document.createElement("input")], ["Network", navigator.onLine]];
  const offline = navigator.onLine === false;
  $(".field-app").classList.toggle("is-offline", offline);
  $("[data-status-summary]").textContent = `Local workspace · ${offline ? "offline" : "online"} · ${records.length} note${records.length === 1 ? "" : "s"}`;
  $("[data-capabilities]").innerHTML = `<p><strong>Capture diagnostics</strong></p>${entries.map(([label, yes]) => `<p><b>${escape(label)}</b> ${yes ? "available" : "unavailable"}</p>`).join("")}<p>Dictation from the device keyboard is separate from browser speech recognition. GISMap Online records audio locally but does not claim offline transcription.</p>`;
}

function fieldAnalysis() {
  return createOfflineAnalysis(globalThis.turf);
}

function analysisCoordinate(prefix) {
  const longitude = Number($(`[data-analysis-${prefix}-longitude]`).value);
  const latitude = Number($(`[data-analysis-${prefix}-latitude]`).value);
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) throw new Error(`Enter both ${prefix} longitude and latitude.`);
  return [longitude, latitude];
}

function setAnalysisCoordinate(prefix, coordinates) {
  $(`[data-analysis-${prefix}-longitude]`).value = coordinates?.[0] ?? "";
  $(`[data-analysis-${prefix}-latitude]`).value = coordinates?.[1] ?? "";
}

function analysisUnits() {
  return $("[data-analysis-units]").value;
}

function measureOfflineDistance() {
  const measurement = fieldAnalysis().measure(analysisCoordinate("from"), analysisCoordinate("to"), analysisUnits());
  const bearing = Math.round(((measurement.bearing % 360) + 360) % 360);
  const midpoint = measurement.midpoint.geometry.coordinates;
  $("[data-analysis-measurement]").textContent = `${formatOfflineDistance(measurement.distance, measurement.units)} · bearing ${bearing}° · midpoint ${midpoint[0].toFixed(5)}, ${midpoint[1].toFixed(5)}.`;
}

function createOfflineBuffer() {
  const radius = Number($("[data-analysis-radius]").value);
  const units = analysisUnits();
  analysisBuffer = fieldAnalysis().buffer(analysisCoordinate("from"), radius, units);
  $("[data-analysis-download-buffer]").disabled = false;
  $("[data-analysis-buffer-result]").textContent = `${formatOfflineDistance(radius, units)} buffer created locally with ${analysisBuffer.geometry.type}.`;
}

async function inspectOfflineGeoJson(file) {
  if (!file) return;
  if (file.size > 8 * 1024 * 1024) throw new Error("Choose a GeoJSON file smaller than 8 MB for local inspection.");
  const summary = fieldAnalysis().summarize(JSON.parse(await file.text()));
  const [west, south, east, north] = summary.bbox.map((value) => Number(value).toFixed(5));
  const area = summary.areaSquareMeters ? ` · polygon area ${(summary.areaSquareMeters / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 2 })} km²` : "";
  $("[data-analysis-geometry-result]").textContent = `${summary.type} · bounds ${west}, ${south} to ${east}, ${north}${area}.`;
}

function nearbyFieldNotes() {
  const units = analysisUnits();
  const matches = fieldAnalysis().nearestRecords(analysisCoordinate("from"), records, { units, limit: 5 });
  const host = $("[data-analysis-nearest-result]");
  host.innerHTML = matches.length ? `<ol class="field-analysis-nearest">${matches.map(({ record, distance }) => `<li><strong>${escape(recordName(record))}</strong><br />${escape(formatOfflineDistance(distance, units))} away · observed ${escape(date(record.observedAt))}</li>`).join("")}</ol>` : "No saved notes with point locations are available on this device.";
}

const TASK_STATES = ["incoming", "active", "completed", "ready-to-return", "returned"];
function taskState(task) {
  if (TASK_STATES.includes(task.status)) return task.status;
  if (task.status === "completed") return "completed";
  return "active";
}
function taskStateLabel(state) {
  return ({ incoming: "Incoming", active: "Active", completed: "Completed", "ready-to-return": "Ready to return", returned: "Returned locally" })[state] || "Active";
}
function taskCard(task) {
  const state = taskState(task); const steps = taskSteps(task); const done = steps.filter((step) => step.done).length;
  const taskId = escape(task.id); const complete = state === "completed"; const ready = state === "ready-to-return"; const returned = state === "returned";
  const actions = [
    state === "incoming" ? `<button type="button" data-start-task="${taskId}">Start task</button>` : "",
    state !== "incoming" ? `<button type="button" data-note-from-task="${taskId}">Add note for task</button>` : "",
    task.handoffId ? `<button type="button" data-ack-task="${taskId}">Show acknowledgment</button>` : "",
    complete || ready || returned ? `<button type="button" data-return-task="${taskId}">${complete ? "Prepare return" : returned ? "Show return" : "Show return QR"}</button>` : "",
  ].filter(Boolean).join("");
  return `<article class="record-card"><span class="record-card__meta">${escape(taskStateLabel(state))} · received ${escape(date(task.acceptedAt || task.importedAt || task.createdAt || Date.now()))}</span><h2>${escape(task.title || "Untitled field task")}</h2><p>${escape(task.notes || task.location || "No instructions.")}</p><p class="record-card__meta">${done}/${steps.length} steps complete${task.completedAt ? ` · completed ${escape(date(task.completedAt))}` : ""}${task.returnPreparedAt ? ` · return prepared ${escape(date(task.returnPreparedAt))}` : ""}</p><div class="task-steps">${steps.map((step, index) => `<label><input type="checkbox" data-task-step="${taskId}" value="${index}" ${step.done ? "checked" : ""} ${state !== "active" ? "disabled" : ""} /> ${escape(step.text)}</label>`).join("")}</div><div class="record-card__actions">${actions}</div></article>`;
}
function renderTasks() {
  if (!tasks.length) return '<div class="field-empty"><h2>Field Inbox is empty</h2><p>Scan or paste a self-contained Work Card while offline to receive work here.</p></div>';
  const groups = Object.fromEntries(TASK_STATES.map((state) => [state, tasks.filter((task) => taskState(task) === state)]));
  const incoming = groups.incoming.length; const active = groups.active.length; const outbound = handoffs.filter((item) => item.direction === "outgoing" && item.status === "ready-to-return").length; const received = handoffs.filter((item) => item.direction === "incoming" && item.type === "return-receipt").length;
  const conflicts = handoffs.filter((item) => item.status === "conflict").length;
  const history = handoffs.filter((item) => item.direction === "incoming").slice(0, 3).map((item) => `${escape(item.type || "handoff")} · ${escape(item.status || "received")} · ${escape(date(item.updatedAt || item.receivedAt || item.createdAt))}`).join("<br />");
  const header = `<article class="transfer-card field-handoff-summary"><h2>Field Inbox &amp; Outbox</h2><p>${incoming} incoming · ${active} active · ${groups.completed.length} completed · ${groups["ready-to-return"].length} ready to return · ${outbound} outbound receipt${outbound === 1 ? "" : "s"} prepared locally${received ? ` · ${received} return receipt${received === 1 ? "" : "s"} received` : ""}${conflicts ? ` · ${conflicts} conflict${conflicts === 1 ? "" : "s"} need review` : ""}.</p><p>Local acknowledgements are durable on this device. They are not server registrations.</p>${history ? `<p class="record-card__meta"><strong>Recent import history</strong><br />${history}</p>` : ""}</article>`;
  return header + TASK_STATES.map((state) => groups[state].length ? `<section class="field-task-group"><h2>${escape(taskStateLabel(state))} <span>${groups[state].length}</span></h2>${groups[state].map(taskCard).join("")}</section>` : "").join("");
}

async function updateHandoff(id, patch) {
  if (!id) return;
  const current = handoffs.find((item) => item.id === id) || await store.getHandoff(id);
  if (!current) return;
  await store.saveHandoff({ ...current, ...patch, updatedAt: new Date().toISOString() });
}

async function refresh() {
  records = await store.listRecords();
  tasks = await store.listTasks();
  handoffs = await store.listHandoffs();
  packages = await store.listPackages();
  basemaps = await store.listBasemaps();
  $("[data-record-count]").textContent = String(records.length);
  $("[data-task-count]").textContent = String(tasks.length);
  capabilities();
  const list = $("[data-record-list]");
  list.innerHTML = records.length ? `<div class="record-selection"><button type="button" data-select-all>${selectedRecordIds.size === records.length ? "Clear selection" : "Select all"}</button><span>${selectedRecordIds.size} selected</span></div>${records.map((record) => `<article class="record-card"><label class="record-card__select"><input type="checkbox" data-select-record="${escape(record.id)}" ${selectedRecordIds.has(record.id) ? "checked" : ""} /> Select for report</label><span class="record-card__meta">${escape(record.collectionId)} · observed ${escape(date(record.observedAt))}${record.geometry ? " · location attached" : " · no location"}</span><h2>${escape(recordName(record))}</h2><p>${escape(record.notes.text || "No notes.")}</p><span class="record-card__meta">Revision ${record.sync.revision} · edited ${escape(date(record.modifiedAt))} · ${record.attachments.length} attachment${record.attachments.length === 1 ? "" : "s"} · ${escape(record.sync.registeredAt ? "registered" : "local only")}</span><div class="record-card__actions"><button type="button" data-edit-record="${escape(record.id)}">Edit</button><button type="button" data-show-qr="${escape(record.id)}">Share &amp; QR</button><button type="button" data-record-pdf="${escape(record.id)}">PDF</button><button type="button" data-delete-record="${escape(record.id)}">Delete</button></div></article>`).join("")}` : '<div class="field-empty"><h2>No observations yet</h2><p>Saved observations stay securely in this browser until you export them.</p></div>';
  $("[data-task-list]").innerHTML = renderTasks();
  const packageList = $("[data-site-pack-list]");
  if (packageList) packageList.innerHTML = packages.length ? packages.map((item) => `<p class="field-storage-item"><strong>${escape(item.name)}</strong> · ${item.tasks?.length || 0} task${item.tasks?.length === 1 ? "" : "s"} · ${item.records?.length || 0} note${item.records?.length === 1 ? "" : "s"}<button type="button" data-remove-site-pack="${escape(item.id)}">Remove</button></p>`).join("") : "<p>No portable map packs are stored on this device.</p>";
  const mapList = $("[data-offline-map-list]");
  if (mapList) mapList.innerHTML = basemaps.length ? basemaps.map((item) => `<p class="field-storage-item"><strong>${escape(item.name)}</strong> · ${Math.round((item.bytes || 0) / 1024 / 1024)} MB · ${escape(item.format || "map data")}<button type="button" data-remove-basemap="${escape(item.id)}">Remove</button></p>`).join("") : "<p>No offline basemap files are stored. A compatible map viewer is still required to render PMTiles.</p>";
}

function switchView(view) {
  document.querySelectorAll("[data-view]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.view === view)));
  document.querySelectorAll("[data-view-panel]").forEach((panel) => { panel.hidden = panel.dataset.viewPanel !== view; });
  if (["records", "tasks", "analyze", "transfer"].includes(view)) refresh().catch((error) => toast(error.message));
}

function setLocation(location = null) {
  const form = $("[data-record-form]");
  form.elements.longitude.value = location?.coordinates?.[0] ?? "";
  form.elements.latitude.value = location?.coordinates?.[1] ?? "";
  form.dataset.locationSource = location?.source || "manual";
  form.dataset.locationAccuracy = location?.accuracyMeters ?? "";
  form.dataset.locationAltitude = location?.altitudeMeters ?? "";
  form.dataset.locationHeading = location?.headingDegrees ?? "";
  form.dataset.locationSpeed = location?.speedMetersPerSecond ?? "";
  $("[data-location-status]").textContent = location ? `Location attached: ${location.source}${Number.isFinite(location.accuracyMeters) ? ` · ±${Math.round(location.accuracyMeters)} m` : ""}.` : "No location attached. You can save a text-only observation.";
}

async function saveAttachment(file, type) {
  const id = assetId();
  const asset = { id, type, name: file.name || `${type}-${Date.now()}`, mime: file.type || "application/octet-stream", blob: file, createdAt: new Date().toISOString() };
  await store.saveAsset(asset);
  attachmentDrafts.push({ id: `attachment_${id}`, type, localAssetId: id, name: asset.name, mime: asset.mime });
  renderDraftAttachments();
}

function renderDraftAttachments() {
  const host = $("[data-draft-attachments]");
  host.innerHTML = attachmentDrafts.length ? attachmentDrafts.map((attachment, index) => `<p class="draft-attachment">${escape(attachment.type)} · ${escape(attachment.name || "Attachment")} <button type="button" data-remove-attachment="${index}" aria-label="Remove attachment">Remove</button></p>`).join("") : '<p data-attachment-status>No attachments selected.</p>';
}

function resetEditor() {
  const form = $("[data-record-form]"); form.reset(); form.elements.collectionId.value = "default"; form.elements.recordId.value = "";
  attachmentDrafts = []; drawing = []; paintSketch(); setLocation(); renderDraftAttachments();
  delete form.dataset.taskId;
  $("[data-editor-intro]").textContent = "Works without a map or a connection. Records stay on this device until you export them.";
  $("[data-save-record]").textContent = "Save local observation"; $("[data-cancel-edit]").hidden = true;
}

function editRecord(id) {
  const record = records.find((item) => item.id === id); if (!record) return;
  const form = $("[data-record-form]"); const fields = form.elements;
  delete form.dataset.taskId;
  fields.recordId.value = record.id; fields.collectionId.value = record.collectionId; fields.title.value = record.properties.title; fields.category.value = record.properties.category; fields.priority.value = record.properties.priority; fields.notes.value = record.notes.text;
  fields.observedAt.value = record.observedAt.slice(0, 16);
  setLocation(record.geometry?.type === "Point" ? { coordinates: record.geometry.coordinates, source: record.location.source, accuracyMeters: record.location.accuracyMeters, altitudeMeters: record.location.altitudeMeters, headingDegrees: record.location.headingDegrees, speedMetersPerSecond: record.location.speedMetersPerSecond } : null);
  attachmentDrafts = structuredClone(record.attachments); drawing = structuredClone(record.sketch?.strokes || []); paintSketch(); renderDraftAttachments();
  $("[data-editor-intro]").textContent = `Editing revision ${record.sync.revision}. The original collection time and record ID will be retained.`;
  $("[data-save-record]").textContent = "Save changes"; $("[data-cancel-edit]").hidden = false; switchView("collect"); window.scrollTo({ top: 0, behavior: "smooth" });
}

function pointFromEvent(event, canvas) {
  const box = canvas.getBoundingClientRect();
  return [Math.max(0, Math.min(1, (event.clientX - box.left) / box.width)), Math.max(0, Math.min(1, (event.clientY - box.top) / box.height))];
}
function paintSketch() {
  const canvas = $("[data-sketch]"); const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height); context.lineCap = "round"; context.lineJoin = "round"; context.strokeStyle = "#14755f"; context.lineWidth = 4;
  for (const stroke of drawing) { if (!stroke.length) continue; context.beginPath(); stroke.forEach(([x, y], index) => index ? context.lineTo(x * canvas.width, y * canvas.height) : context.moveTo(x * canvas.width, y * canvas.height)); context.stroke(); }
}
function setupSketch() {
  const canvas = $("[data-sketch]");
  canvas.addEventListener("pointerdown", (event) => { canvas.setPointerCapture(event.pointerId); activeStroke = [pointFromEvent(event, canvas)]; drawing.push(activeStroke); paintSketch(); });
  canvas.addEventListener("pointermove", (event) => { if (!activeStroke) return; activeStroke.push(pointFromEvent(event, canvas)); paintSketch(); });
  canvas.addEventListener("pointerup", () => { activeStroke = null; });
}

async function packageAssets() {
  const ids = [...new Set(records.flatMap((record) => record.attachments.map((attachment) => attachment.localAssetId)))];
  const assets = await store.getAssets(ids);
  return Promise.all(assets.map(async (asset) => ({ id: asset.id, type: asset.type, mime: asset.mime, name: asset.name, data: await blobToData(asset.blob) })));
}
async function blobToData(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer()); let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return btoa(binary);
}
function dataToBlob(data, mime) {
  const binary = atob(data); const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0)); return new Blob([bytes], { type: mime || "application/octet-stream" });
}

async function importPackage(file) {
  const parsed = normalizeFieldPackage(JSON.parse(await file.text()));
  const known = new Map((await store.listRecords()).map((record) => [record.id, JSON.stringify(record)]));
  let imported = 0; let skipped = 0;
  for (const record of parsed.records) {
    if (known.has(record.id)) { if (known.get(record.id) !== JSON.stringify(record)) throw new Error(`Record ${record.id} already exists with different content.`); skipped++; continue; }
    await store.saveRecord(record); known.set(record.id, JSON.stringify(record)); imported++;
  }
  for (const asset of parsed.assets) await store.saveAsset({ ...asset, blob: dataToBlob(asset.data, asset.mime), createdAt: new Date().toISOString() });
  await refresh(); toast(`Imported ${imported} observation${imported === 1 ? "" : "s"}${skipped ? `; ${skipped} already present` : ""}.`);
}

async function importSitePack(file) {
  const pack = normalizeSitePack(JSON.parse(await file.text()));
  const existing = packages.find((item) => item.id === pack.id);
  if (existing) { toast("This Site Pack is already stored on this device."); return; }
  let tasksAdded = 0; let recordsAdded = 0; let conflicts = 0; const importedAt = new Date().toISOString();
  for (const incoming of pack.tasks) {
    const current = tasks.find((item) => item.id === incoming.id);
    if (current && JSON.stringify(current) !== JSON.stringify(incoming)) { conflicts++; continue; }
    if (!current) { const id = incoming.id || `site-task:${pack.id}:${tasksAdded}`; await store.saveTask({ ...incoming, id, status: "incoming", importedAt, acceptedAt: importedAt, source: "site-pack", payloadId: pack.id, handoffId: `site:${pack.id}:${id}`, revision: 1 }); tasksAdded++; }
  }
  for (const incoming of pack.records) {
    const current = records.find((item) => item.id === incoming.id);
    if (current && JSON.stringify(current) !== JSON.stringify(incoming)) { conflicts++; continue; }
    if (!current) { await store.saveRecord(incoming); recordsAdded++; }
  }
  await store.savePackage({ ...pack, importedAt, sourceFileName: file.name, importHistory: { tasksAdded, recordsAdded, conflicts } });
  await store.saveHandoff({ id: `site-import:${pack.id}`, direction: "incoming", type: "site-pack", status: conflicts ? "conflict" : "imported", payloadId: pack.id, receivedAt: importedAt, createdAt: pack.createdAt, updatedAt: importedAt, importHistory: { tasksAdded, recordsAdded, conflicts } });
  await refresh(); switchView("tasks"); toast(`Site Pack added: ${tasksAdded} task${tasksAdded === 1 ? "" : "s"}, ${recordsAdded} note${recordsAdded === 1 ? "" : "s"}${conflicts ? `; ${conflicts} conflict${conflicts === 1 ? "" : "s"} retained` : ""}.`);
}

function downloadSitePack() {
  const scope = selectedRecords().length ? selectedRecords() : records;
  const pack = createSitePack({ name: "GISMap Online Field Site Pack", tasks, records: scope, basemap: basemaps[0] ? { id: basemaps[0].id, name: basemaps[0].name, format: basemaps[0].format, bytes: basemaps[0].bytes, included: false, renderer: "compatible GISMap Online map viewer required" } : null });
  const estimate = sitePackEstimate(pack);
  download("gismap-field-site.gismap", JSON.stringify(pack, null, 2), "application/vnd.gismap.site-pack+json");
  toast(`Site Pack downloaded: ${estimate.taskCount} tasks, ${estimate.recordCount} notes, about ${Math.max(1, Math.ceil(estimate.estimatedBytes / 1024))} KB manifest. Basemap files are referenced, not embedded.`);
}

async function importPmtiles(file) {
  if (!file) return;
  if (!/\.pmtiles$/i.test(file.name) && file.type !== "application/vnd.pmtiles") throw new Error("Choose a .pmtiles file.");
  const id = `pmtiles:${file.name}:${file.size}:${file.lastModified}`;
  if (basemaps.some((item) => item.id === id)) { toast("This PMTiles file is already stored on this device."); return; }
  await store.saveBasemap({ id, name: file.name, format: "PMTiles", bytes: file.size, blob: file, addedAt: new Date().toISOString(), renderer: "requires-compatible-map-viewer" });
  await refresh(); toast("PMTiles stored locally. Open a compatible GISMap Online map viewer to render it offline.");
}

async function showQr(id) {
  const record = records.find((item) => item.id === id); if (!record) return;
  await showGeoPayloadQr(geoPayloadFromFieldRecord(record), {
    title: recordName(record), fileName: `${fieldRecordFileStem(record)}-qr.png`,
    summary: `${recordName(record)} · portable GeoPayload · text and location only; no attachments included.`,
    lines: ["Portable GeoPayload record", "Attachments stay in the .gisfield package."],
  });
}

async function showGeoPayloadQr(payload, { title, fileName = "gismap-field-handoff-qr.png", summary, lines = ["Portable GISMap Online Field handoff"] } = {}) {
  const text = encodeGeoPayload(payload);
  const advice = recommendTransports(payload, { qr: true });
  activeQrTransfer = { text, payload, title: title || "GISMap Online Field handoff", fileName, summary: summary || "Portable GISMap Online Field handoff.", lines };
  if (!advice.qr.supported) { await showAnimatedQr(); return; }
  stopAnimatedQr();
  await renderQrText(text);
  $("[data-animate-qr]").hidden = false;
  $("[data-download-qr]").hidden = false;
  $("[data-share-qr]").hidden = false;
  $("[data-qr-summary]").textContent = activeQrTransfer.summary; $("[data-qr-dialog]").showModal();
}

async function renderQrText(text) {
  const canvas = $("[data-qr-canvas]");
  if (!globalThis.QRCode?.toCanvas) throw new Error("QR generator is unavailable.");
  await globalThis.QRCode.toCanvas(canvas, text, { width: 360, margin: 2, errorCorrectionLevel: "M", color: { dark: "#123e35", light: "#fffdf8" } });
}

function stopAnimatedQr() {
  if (animatedQrTimer) clearInterval(animatedQrTimer);
  animatedQrTimer = null;
}

async function showAnimatedQr() {
  if (!activeQrTransfer?.payload) throw new Error("Choose a portable handoff before starting animated QR.");
  const transfer = createAnimatedQrFrames(activeQrTransfer.payload);
  activeQrTransfer.animated = transfer;
  let frame = 0;
  const render = () => renderQrText(transfer.frames[frame++ % transfer.frames.length]).catch((error) => { stopAnimatedQr(); toast(error.message); });
  stopAnimatedQr(); render();
  animatedQrTimer = setInterval(render, 900);
  $("[data-animate-qr]").hidden = true;
  $("[data-download-qr]").hidden = true;
  $("[data-share-qr]").hidden = true;
  $("[data-qr-summary]").textContent = `${activeQrTransfer.summary} Animated transfer: ${transfer.dataFrames} data frames plus ${transfer.parityFrames} recovery frames repeat every ${Math.ceil(transfer.frames.length * 0.9)} seconds.`;
  if (!$("[data-qr-dialog]").open) $("[data-qr-dialog]").showModal();
}

async function qrCard() {
  if (!activeQrTransfer) throw new Error("Choose a handoff to share first.");
  const file = await brandedQrFile(activeQrTransfer.text, { fileName: activeQrTransfer.fileName, title: activeQrTransfer.title, lines: activeQrTransfer.lines, footer: "Scan in GISMap Online Field Mode" });
  if (!file) throw new Error("QR card generation is unavailable.");
  return file;
}

async function reportFile(forRecords) {
  if (!forRecords.length) throw new Error("Select at least one note for a report.");
  const assets = await store.getAssets([...new Set(forRecords.flatMap((record) => record.attachments.map((attachment) => attachment.localAssetId)))]);
  const blob = await fieldRecordPdf(forRecords, { assets, qrForRecord: encodeCompactFieldRecord, skin: "gismap", baseUrl: location.origin });
  return new File([blob], `${forRecords.length === 1 ? fieldRecordFileStem(forRecords[0]) : "field-report"}.pdf`, { type: "application/pdf" });
}

async function mobileShare({ title, text, file = null } = {}) {
  const data = file && navigator.canShare?.({ files: [file] }) ? { title, text, files: [file] } : { title, text };
  if (navigator.share) { await navigator.share(data); return; }
  if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text || title); toast("Share text copied."); return; }
  throw new Error("Sharing is unavailable in this browser. Download the file instead.");
}

function selectedRecords() {
  return records.filter((record) => selectedRecordIds.has(record.id));
}

async function importQrText(text) {
  const value = String(text || "").trim();
  if (value.startsWith("gismap-geoframe:v1:")) {
    animatedQrIntake = addAnimatedQrFrame(animatedQrIntake || {}, value);
    const received = Object.keys(animatedQrIntake.data).length; const total = animatedQrIntake.total;
    try {
      const payload = assembleAnimatedQrFrames(animatedQrIntake);
      animatedQrIntake = null; previewGeoPayload(payload); toast("Animated QR transfer reconstructed and verified.");
    } catch (error) {
      if (!/incomplete/.test(error.message)) throw error;
      toast(`Animated QR: ${received}/${total} data frames received. Keep scanning; one missed frame per group can recover.`);
    }
    return "waiting";
  }
  if (value.startsWith("gismap-geopayload:v1:") || value.startsWith("{")) {
    try { previewGeoPayload(decodeGeoPayload(value)); return; }
    catch (error) { if (value.startsWith("gismap-geopayload:v1:")) throw error; }
  }
  if (value.startsWith("gismap-field:v1:")) {
    const record = decodeCompactFieldRecord(value); const existing = records.find((item) => item.id === record.id);
    if (existing && JSON.stringify(existing) !== JSON.stringify(record)) throw new Error("This note already exists with a different revision. Import a .gisfield package to review both copies.");
    if (!existing) await store.saveRecord(record); await refresh(); toast(existing ? "This note is already on this device." : "Compact note imported; attachments are not included."); return;
  }
  let hash = value;
  try { hash = new URL(value).hash; } catch { /* A bare field-task fragment is also accepted. */ }
  const encoded = readFieldTaskHash(hash);
  if (!encoded) throw new Error("This is not a supported Field Mode note or Field Task QR.");
  const shared = decodeFieldTask(encoded, { allowHttp: location.hostname === "localhost" });
  const task = shared.task; const existing = tasks.find((item) => item.id === task.id);
  if (!existing) {
    const acceptedAt = new Date().toISOString(); const id = task.id || `task_${Date.now()}`; const handoffId = `legacy-task:${id}`;
    await store.saveTask({ ...task, id, status: "incoming", importedAt: acceptedAt, acceptedAt, acknowledgedAt: acceptedAt, source: "offline-qr", handoffId, revision: 1 });
    await store.saveHandoff({ id: handoffId, direction: "incoming", type: "legacy-work-card", status: "incoming", taskId: id, receivedAt: acceptedAt, acceptedAt, createdAt: acceptedAt, updatedAt: acceptedAt });
  }
  await refresh(); switchView("tasks"); toast(existing ? "This task is already in your Field Inbox." : "Field Task added to the Field Inbox. It has not been registered with a server.");
}

function geoPayloadSummary(payload) {
  if (payload.type === "observation") {
    const record = fieldRecordFromGeoPayload(payload);
    return `Observation: ${recordName(record)} · collected ${date(record.observedAt)} · ${record.geometry ? "location attached" : "no location"}.`;
  }
  if (payload.type === "work-card") {
    const task = fieldTaskFromGeoPayload(payload);
    return `Work card: ${task.title || "Untitled task"} · ${taskSteps(task).length} step${taskSteps(task).length === 1 ? "" : "s"} · ${task.features.length} linked feature${task.features.length === 1 ? "" : "s"}.`;
  }
  return `Return receipt for ${payload.data.payloadId} · ${payload.data.status} · ${date(payload.data.acknowledgedAt)}.`;
}

function previewGeoPayload(payload) {
  pendingGeoPayload = payload;
  $("[data-geopayload-summary]").textContent = geoPayloadSummary(payload);
  $("[data-geopayload-dialog]").showModal();
}

const handoffOperations = () => new Set(handoffs.flatMap((item) => item.operationIds || []));

async function mergeReturnReceipt(payload) {
  const existing = handoffs.find((item) => item.id === payload.id);
  if (existing) return { duplicate: true, imported: 0, conflicts: 0 };
  const completion = payload.data.completion && typeof payload.data.completion === "object" ? payload.data.completion : {};
  const operations = Array.isArray(completion.operations) ? completion.operations : [{ operationId: payload.id, entityType: "task", entityId: payload.data.taskId, baseVersion: completion.taskRevision, operation: "update", values: { status: payload.data.status, completedAt: completion.completedAt || payload.data.acknowledgedAt } }];
  const applied = handoffOperations(); const conflicts = []; let imported = 0; let duplicates = 0;
  for (const operation of operations) {
    const operationId = String(operation?.operationId || "").trim();
    if (!operationId || applied.has(operationId)) { duplicates++; continue; }
    if (operation.entityType === "task") {
      if (operation.operation === "acknowledge") { await updateHandoff(payload.data.payloadId, { status: "acknowledged", acknowledgedAt: payload.data.acknowledgedAt, acknowledgmentReceiptId: payload.id }); imported++; applied.add(operationId); continue; }
      const task = tasks.find((item) => item.id === operation.entityId || item.payloadId === payload.data.payloadId || item.handoffId === payload.data.payloadId);
      const baseVersion = Number(operation.baseVersion || 0);
      const desired = operation.values || {};
      if (task && baseVersion && Number(task.revision || 1) > baseVersion && desired.status && task.status !== desired.status) { conflicts.push({ operationId, entityType: "task", entityId: task.id, reason: "Task changed locally after the returned copy was issued." }); continue; }
      if (task) {
        await store.saveTask({ ...task, ...desired, status: desired.status === "completed" ? "returned" : (desired.status || task.status), returnedAt: payload.data.acknowledgedAt, updatedAt: new Date().toISOString(), revision: Math.max(Number(task.revision || 1), baseVersion) + 1 });
        imported++;
      }
    }
    if (operation.entityType === "observation") {
      const source = completion.observations?.find((record) => record.id === operation.entityId);
      if (!source) continue;
      const record = normalizeFieldRecord(source); const local = records.find((item) => item.id === record.id);
      if (local && JSON.stringify(local) !== JSON.stringify(record)) { conflicts.push({ operationId, entityType: "observation", entityId: record.id, reason: "Observation has different local content." }); continue; }
      if (!local) { await store.saveRecord(record); imported++; }
      else duplicates++;
    }
    applied.add(operationId);
  }
  await store.saveHandoff({ id: payload.id, direction: "incoming", type: "return-receipt", status: conflicts.length ? "conflict" : "reconciled", payloadId: payload.data.payloadId, taskId: payload.data.taskId, operationIds: operations.map((item) => String(item?.operationId || "").trim()).filter(Boolean), receivedAt: new Date().toISOString(), acknowledgedAt: payload.data.acknowledgedAt, createdAt: payload.createdAt, updatedAt: new Date().toISOString(), importHistory: { imported, duplicates, conflicts } });
  return { duplicate: false, imported, duplicates, conflicts: conflicts.length };
}

function acknowledgmentPayloadForTask(task) {
  const acknowledgedAt = task.acceptedAt || new Date().toISOString();
  return createReturnReceipt({
    operationId: task.acknowledgmentOperationId || `ack:${task.handoffId || task.id}:${acknowledgedAt}`,
    payloadId: task.payloadId || task.handoffId || task.id,
    taskId: task.id,
    status: "accepted",
    acknowledgedAt,
    completion: { kind: "handoff-acknowledgment", taskRevision: task.revision || 1, acceptedAt: acknowledgedAt, operations: [{ operationId: task.acknowledgmentOperationId || `ack:${task.handoffId || task.id}:${acknowledgedAt}`, entityType: "task", entityId: task.id, baseVersion: task.revision || 1, operation: "acknowledge", values: { status: "acknowledged", acceptedAt: acknowledgedAt } }] },
  });
}

async function showTaskAcknowledgment(task) {
  const payload = acknowledgmentPayloadForTask(task);
  if (!task.acknowledgmentOperationId) await store.saveTask({ ...task, acknowledgmentOperationId: payload.id, updatedAt: new Date().toISOString() });
  await store.saveHandoff({ id: payload.id, direction: "outgoing", type: "return-receipt", status: "acknowledgment-ready", taskId: task.id, payloadId: payload.data.payloadId, operationIds: payload.data.completion.operations.map((operation) => operation.operationId), createdAt: payload.createdAt, updatedAt: new Date().toISOString() });
  await refresh();
  await showGeoPayloadQr(payload, { title: `${task.title || "Field task"} acknowledgment`, fileName: `gismap-field-ack-${task.id}.png`, summary: "Task received acknowledgment. It is local until the originating device imports this handoff.", lines: ["GISMap Online Field acknowledgment", "Not a server registration."] });
}

async function acceptGeoPayload() {
  const payload = pendingGeoPayload;
  if (!payload) return;
  if (payload.type === "observation") {
    const record = fieldRecordFromGeoPayload(payload); const existing = records.find((item) => item.id === record.id);
    if (existing && JSON.stringify(existing) !== JSON.stringify(record)) throw new Error("This observation already exists with different content. Import a .gisfield package to review both copies.");
    if (!existing) await store.saveRecord(record);
    await refresh(); switchView("records"); toast(existing ? "This observation is already on this device." : "Portable observation added locally.");
  } else if (payload.type === "work-card") {
    const task = fieldTaskFromGeoPayload(payload); const existing = tasks.find((item) => item.id === task.id);
    if (!existing) {
      const acceptedAt = new Date().toISOString(); const id = task.id || payload.id;
      await store.saveTask({ ...task, id, status: "incoming", importedAt: acceptedAt, acceptedAt, acknowledgedAt: acceptedAt, source: "geopayload", payloadId: payload.id, handoffId: payload.id, revision: 1 });
      await store.saveHandoff({ id: payload.id, direction: "incoming", type: payload.type, status: "incoming", taskId: id, payloadCreatedAt: payload.createdAt, receivedAt: acceptedAt, acceptedAt, createdAt: acceptedAt, updatedAt: acceptedAt });
    }
    await refresh(); switchView("tasks"); toast(existing ? "This work card is already in your Field Inbox." : "Work card accepted into the Field Inbox. It has not been registered with a server.");
  } else {
    const result = await mergeReturnReceipt(payload);
    await refresh(); switchView("tasks"); toast(result.duplicate ? "This return receipt was already imported." : `${result.imported} change${result.imported === 1 ? "" : "s"} merged locally${result.conflicts ? `; ${result.conflicts} conflict${result.conflicts === 1 ? "" : "s"} kept for review` : ""}.`);
  }
  pendingGeoPayload = null;
  $("[data-geopayload-dialog]").close();
}

function stopQrCamera() {
  if (qrCameraTimer) clearTimeout(qrCameraTimer);
  qrCameraTimer = null;
  qrCameraStream?.getTracks().forEach((track) => track.stop());
  qrCameraStream = null;
  const video = $("[data-qr-scanner-video]");
  if (video) video.srcObject = null;
}

async function scanQrWithCamera() {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera scanning is unavailable here. Use Take QR photo instead.");
  if (typeof globalThis.BarcodeDetector !== "function") throw new Error("Live QR scanning is unavailable in this browser. Use Take QR photo instead.");
  const dialog = $("[data-qr-scanner-dialog]"); const video = $("[data-qr-scanner-video]"); const status = $("[data-qr-scanner-status]");
  stopQrCamera();
  try {
    const formats = await globalThis.BarcodeDetector.getSupportedFormats?.();
    if (formats && !formats.includes("qr_code")) throw new Error("This camera does not support QR scanning. Use Take QR photo instead.");
    const detector = new globalThis.BarcodeDetector({ formats: ["qr_code"] });
    qrCameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
    video.srcObject = qrCameraStream;
    if (!dialog.open) dialog.showModal();
    await video.play(); status.textContent = "Point the camera at a Field Mode or Field Task QR code.";
    const detect = async () => {
      if (!qrCameraStream) return;
      try {
        const codes = video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA ? await detector.detect(video) : [];
        const value = codes.find((code) => code.rawValue)?.rawValue;
        if (value) {
          const result = await importQrText(value);
          if (result === "waiting") { status.textContent = "Animated QR frame received. Keep the camera pointed at the sender."; qrCameraTimer = setTimeout(detect, 450); return; }
          stopQrCamera(); dialog.close(); return;
        }
      } catch (error) { status.textContent = error.message || "Camera scan failed. Use Take QR photo instead."; stopQrCamera(); return; }
      qrCameraTimer = setTimeout(detect, 250);
    };
    void detect();
  } catch (error) {
    stopQrCamera();
    if (dialog.open) dialog.close();
    throw error;
  }
}

async function importQrImage(file) {
  if (!file) return;
  const text = await decodeQrFromImage(file);
  if (!text) throw new Error("No QR code was found in that image.");
  await importQrText(text);
}

function returnPayloadForTask(task) {
  const linkedRecords = records.filter((record) => record.relations.fieldTaskIds.includes(task.id));
  const recordIds = linkedRecords.map((record) => record.id);
  const completedAt = task.completedAt || new Date().toISOString();
  const taskOperationId = `task:${task.id}:${task.revision || 1}:completed`;
  const operations = [
    { operationId: taskOperationId, entityType: "task", entityId: task.id, baseVersion: Math.max(1, Number(task.revision || 1) - 1), operation: "update", values: { status: "completed", completedAt } },
    ...linkedRecords.map((record) => ({ operationId: `observation:${record.id}:${record.sync.revision}`, entityType: "observation", entityId: record.id, baseVersion: record.sync.revision, operation: "append", values: { revision: record.sync.revision } })),
  ];
  return createReturnReceipt({
    operationId: task.returnOperationId || `return:${task.id}:${task.revision || 1}`,
    payloadId: task.payloadId || task.handoffId || task.id,
    taskId: task.id,
    recordIds,
    status: "completed",
    acknowledgedAt: completedAt,
    completion: { title: task.title || "Field task", completedAt, steps: taskSteps(task), taskRevision: task.revision || 1, operations, observations: linkedRecords },
    details: task.report || "",
  });
}

async function prepareTaskReturn(task) {
  if (!["completed", "ready-to-return", "returned"].includes(taskState(task))) throw new Error("Complete every task step before preparing its return.");
  const payload = returnPayloadForTask(task); const preparedAt = task.returnPreparedAt || new Date().toISOString();
  const updated = { ...task, status: "ready-to-return", returnOperationId: payload.id, returnPreparedAt: preparedAt, updatedAt: new Date().toISOString(), revision: (task.revision || 1) + (task.returnOperationId ? 0 : 1) };
  await store.saveTask(updated);
  await store.saveHandoff({ id: payload.id, direction: "outgoing", type: "return-receipt", status: "ready-to-return", taskId: task.id, payloadId: task.payloadId || task.handoffId || task.id, operationIds: payload.data.completion.operations.map((operation) => operation.operationId), createdAt: preparedAt, updatedAt: new Date().toISOString() });
  await updateHandoff(task.handoffId, { status: "ready-to-return", returnOperationId: payload.id, returnPreparedAt: preparedAt });
  await refresh();
  await showGeoPayloadQr(payload, { title: `${task.title || "Field task"} return`, fileName: `gismap-field-return-${task.id}.png`, summary: `${task.title || "Field task"} · completion return · ${payload.data.recordIds.length} linked note${payload.data.recordIds.length === 1 ? "" : "s"}. This QR is not a server acknowledgement.`, lines: ["GISMap Online Field completion return", "Scan in a prepared GISMap Online Field inbox."] });
}

async function readiness({ requestPersistence = false } = {}) {
  if (requestPersistence && navigator.storage?.persist) await navigator.storage.persist();
  const registration = navigator.serviceWorker?.getRegistration ? await navigator.serviceWorker.getRegistration("./").catch(() => null) : null;
  const controlled = Boolean(navigator.serviceWorker?.controller);
  const cached = "caches" in globalThis ? Boolean(await caches.match(new URL("./index.html", location.href)).catch(() => null)) : false;
  const persisted = await navigator.storage?.persisted?.().catch(() => false);
  const estimate = await navigator.storage?.estimate?.().catch(() => null);
  const scanner = typeof globalThis.BarcodeDetector === "function" ? "Live QR scanner available" : "QR photo scanner available after the Field app shell is cached";
  const usage = estimate?.usage != null && estimate?.quota ? `${Math.round(estimate.usage / 1024 / 1024)} MB used of ${Math.round(estimate.quota / 1024 / 1024)} MB` : "Storage estimate unavailable";
  const shell = controlled && cached ? "Ready for offline launch" : registration ? "Caching is installed; reload once before leaving service" : "Not prepared; keep this screen open online until caching finishes";
  const cacheNames = "caches" in globalThis ? await caches.keys().catch(() => []) : [];
  const cacheEntries = "caches" in globalThis ? (await Promise.all(cacheNames.map(async (name) => (await caches.open(name)).keys().then((items) => items.length).catch(() => 0)))).reduce((sum, count) => sum + count, 0) : 0;
  const mapCoverage = basemaps.length ? `${basemaps.length} PMTiles file${basemaps.length === 1 ? "" : "s"} stored locally; use a compatible GISMap Online map viewer to render.` : "No offline basemap file is stored. App cache entries are not a licensed or reliable map-download substitute.";
  const turfStatus = globalThis.turf?.distance && globalThis.turf?.buffer ? `Turf.js ${TURF_VERSION} bundled and ready for local measurements` : "Turf.js did not load; reload while online before relying on analysis";
  $("[data-readiness-status]").innerHTML = `<ul class="field-readiness"><li><b>Field app shell:</b> ${escape(shell)}</li><li><b>Local records:</b> ${globalThis.indexedDB ? "IndexedDB available" : "unavailable"}</li><li><b>Persistent storage:</b> ${persisted ? "granted" : "not guaranteed—request it below and keep exports"}</li><li><b>Device storage:</b> ${escape(usage)}</li><li><b>Cached application resources:</b> ${cacheEntries} item${cacheEntries === 1 ? "" : "s"} in ${cacheNames.length} cache${cacheNames.length === 1 ? "" : "s"}</li><li><b>Offline analysis:</b> ${escape(turfStatus)}</li><li><b>QR intake:</b> ${escape(scanner)}</li><li><b>Site Packs:</b> ${packages.length} stored locally</li><li><b>Map coverage:</b> ${escape(mapCoverage)}</li></ul>`;
}

async function openReadiness(requestPersistence = false) {
  const dialog = $("[data-readiness-dialog]"); if (!dialog.open) dialog.showModal();
  $("[data-readiness-status]").textContent = "Checking this device…";
  try { await readiness({ requestPersistence }); } catch (error) { $("[data-readiness-status]").textContent = `Could not finish the readiness check: ${error.message}`; }
}

function wire() {
  document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => switchView(button.dataset.view)));
  $("[data-analysis-use-note]").addEventListener("click", () => {
    const fields = $("[data-record-form]").elements;
    if (fields.longitude.value === "" || fields.latitude.value === "") { toast("Add a current note location first, or enter coordinates in Analyze."); return; }
    setAnalysisCoordinate("from", [Number(fields.longitude.value), Number(fields.latitude.value)]);
    toast("Current note location added as the measurement start.");
  });
  $("[data-analysis-measure]").addEventListener("click", () => { try { measureOfflineDistance(); } catch (error) { toast(error.message); } });
  $("[data-analysis-buffer]").addEventListener("click", () => { try { createOfflineBuffer(); } catch (error) { toast(error.message); } });
  $("[data-analysis-download-buffer]").addEventListener("click", () => {
    if (!analysisBuffer) { toast("Create a buffer first."); return; }
    download("gismap-field-buffer.geojson", JSON.stringify(analysisBuffer, null, 2), "application/geo+json");
    toast("Buffer GeoJSON downloaded.");
  });
  $("[data-analysis-geojson]").addEventListener("change", async (event) => {
    const [file] = event.target.files;
    try { await inspectOfflineGeoJson(file); } catch (error) { toast(error.message); }
    event.target.value = "";
  });
  $("[data-analysis-nearest]").addEventListener("click", () => { try { nearbyFieldNotes(); } catch (error) { toast(error.message); } });
  $("[data-capture-gps]").addEventListener("click", () => {
    if (!navigator.geolocation) { toast("GPS is unavailable in this browser."); return; }
    $("[data-location-status]").textContent = "Requesting device GPS…";
    navigator.geolocation.getCurrentPosition((position) => setLocation({ coordinates: [position.coords.longitude, position.coords.latitude], accuracyMeters: position.coords.accuracy, altitudeMeters: position.coords.altitude, headingDegrees: position.coords.heading, speedMetersPerSecond: position.coords.speed, source: "device-gps" }), (error) => { $("[data-location-status]").textContent = "GPS was not attached."; toast(error.message || "GPS could not get a location."); }, { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 });
  });
  $("[data-clear-location]").addEventListener("click", () => setLocation());
  $("[data-clear-sketch]").addEventListener("click", () => { drawing = []; paintSketch(); });
  ["photo", "cameraPhoto"].forEach((name) => $("[data-record-form]").elements[name].addEventListener("change", async (event) => { const [file] = event.target.files; if (!file) return; try { await saveAttachment(file, "photo"); } catch (error) { toast(error.message); } event.target.value = ""; }));
  $("[data-toggle-audio]").addEventListener("click", async (event) => {
    if (capture) { capture.stop(); return; }
    try { const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); const chunks = []; capture = new MediaRecorder(stream); capture.ondataavailable = (item) => item.data.size && chunks.push(item.data); capture.onstop = async () => { const mime = capture?.mimeType || "audio/webm"; stream.getTracks().forEach((track) => track.stop()); try { await saveAttachment(new File([new Blob(chunks, { type: mime })], `voice-${Date.now()}.webm`, { type: mime }), "audio"); } catch (error) { toast(error.message); } capture = null; event.currentTarget.textContent = "Record voice"; $("[data-audio-status]").textContent = "Voice recording saved locally; no transcription was created."; }; capture.start(); event.currentTarget.textContent = "Stop recording"; $("[data-audio-status]").textContent = "Recording voice locally…"; } catch (error) { $("[data-audio-status]").textContent = `Audio recording unavailable: ${error.message || "permission was denied"}. Device keyboard dictation may still work in Notes.`; }
  });
  $("[data-record-form]").addEventListener("submit", async (event) => {
    event.preventDefault(); const form = event.currentTarget; const fields = form.elements; const longitude = Number(fields.longitude.value); const latitude = Number(fields.latitude.value);
    try {
      const hasOneCoordinate = fields.longitude.value !== "" || fields.latitude.value !== "";
      if (hasOneCoordinate && (!Number.isFinite(longitude) || !Number.isFinite(latitude))) throw new Error("Enter both longitude and latitude, or remove the incomplete location.");
      const geometry = hasOneCoordinate ? { type: "Point", coordinates: [longitude, latitude] } : null;
      const existing = fields.recordId.value && records.find((item) => item.id === fields.recordId.value);
      const observedAt = fields.observedAt.value ? new Date(fields.observedAt.value).toISOString() : (existing?.observedAt || undefined);
      const values = { collectionId: fields.collectionId.value || "default", observedAt, geometry, location: geometry ? { source: form.dataset.locationSource || "manual", accuracyMeters: Number(form.dataset.locationAccuracy) || null, altitudeMeters: Number(form.dataset.locationAltitude) || null, headingDegrees: Number(form.dataset.locationHeading) || null, speedMetersPerSecond: Number(form.dataset.locationSpeed) || null } : { source: "none", accuracyMeters: null }, properties: { title: fields.title.value, category: fields.category.value, priority: fields.priority.value }, notes: { text: fields.notes.value, transcript: null, transcriptStatus: "pending" }, attachments: attachmentDrafts, relations: { fieldTaskIds: form.dataset.taskId ? [form.dataset.taskId] : (existing?.relations?.fieldTaskIds || []), mapNoteIds: existing?.relations?.mapNoteIds || [] }, ...(drawing.length ? { sketch: { coordinateSpace: "screen", strokes: drawing } } : {}) };
      const record = existing ? reviseFieldRecord(existing, values) : createFieldRecord(values);
      await store.saveRecord(record); resetEditor(); await refresh(); toast(existing ? `Changes saved locally as revision ${record.sync.revision}.` : "Observation saved on this device.");
    } catch (error) { toast(error.message); }
  });
  $("[data-cancel-edit]").addEventListener("click", resetEditor);
  $("[data-draft-attachments]").addEventListener("click", (event) => { const target = event.target.closest("button[data-remove-attachment]"); if (!target) return; attachmentDrafts.splice(Number(target.dataset.removeAttachment), 1); renderDraftAttachments(); });
  $("[data-record-list]").addEventListener("change", (event) => { const input = event.target; if (!input.matches("[data-select-record]")) return; if (input.checked) selectedRecordIds.add(input.dataset.selectRecord); else selectedRecordIds.delete(input.dataset.selectRecord); refresh().catch((error) => toast(error.message)); });
  $("[data-record-list]").addEventListener("click", async (event) => { const target = event.target.closest("button"); if (!target) return; try { if (target.dataset.selectAll !== undefined) { selectedRecordIds = selectedRecordIds.size === records.length ? new Set() : new Set(records.map((record) => record.id)); await refresh(); return; } if (target.dataset.editRecord) { editRecord(target.dataset.editRecord); return; } if (target.dataset.showQr) await showQr(target.dataset.showQr); if (target.dataset.recordPdf) { const record = records.find((item) => item.id === target.dataset.recordPdf); download(`${fieldRecordFileStem(record)}.pdf`, await reportFile([record]), "application/pdf"); } if (target.dataset.deleteRecord) { const record = records.find((item) => item.id === target.dataset.deleteRecord); if (record && confirm(`Delete “${recordName(record)}” from this device?`)) { const usedElsewhere = new Set(records.filter((item) => item.id !== record.id).flatMap((item) => item.attachments.map((attachment) => attachment.localAssetId))); await store.deleteRecord(record.id); await store.deleteAssets(record.attachments.map((id) => id.localAssetId).filter((id) => !usedElsewhere.has(id))); selectedRecordIds.delete(record.id); await refresh(); toast("Observation deleted."); } } } catch (error) { toast(error.message); } });
  $("[data-task-list]").addEventListener("change", async (event) => { const input = event.target; if (!input.matches("[data-task-step]")) return; const task = tasks.find((item) => item.id === input.dataset.taskStep); if (!task) return; const steps = taskSteps(task).map((step, index) => ({ ...step, done: index === Number(input.value) ? input.checked : step.done })); const complete = steps.length && steps.every((step) => step.done); const state = complete ? "completed" : "active"; await store.saveTask({ ...task, steps, status: state, completedAt: complete ? (task.completedAt || new Date().toISOString()) : null, updatedAt: new Date().toISOString(), revision: (task.revision || 1) + 1 }); await updateHandoff(task.handoffId, { status: state, completedAt: complete ? (task.completedAt || new Date().toISOString()) : null }); await refresh(); });
  $("[data-task-list]").addEventListener("click", async (event) => {
    const target = event.target.closest("button"); if (!target) return;
    try {
      if (target.dataset.startTask) { const task = tasks.find((item) => item.id === target.dataset.startTask); if (!task) return; const startedAt = new Date().toISOString(); await store.saveTask({ ...task, status: "active", startedAt, updatedAt: startedAt, revision: (task.revision || 1) + 1 }); await updateHandoff(task.handoffId, { status: "active", startedAt }); await refresh(); toast("Task started locally."); return; }
      if (target.dataset.ackTask) { const task = tasks.find((item) => item.id === target.dataset.ackTask); if (task) await showTaskAcknowledgment(task); return; }
      if (target.dataset.returnTask) { const task = tasks.find((item) => item.id === target.dataset.returnTask); if (task) await prepareTaskReturn(task); return; }
      if (!target.dataset.noteFromTask) return;
      const task = tasks.find((item) => item.id === target.dataset.noteFromTask); if (!task) return; resetEditor(); const fields = $("[data-record-form]").elements; fields.collectionId.value = "task-notes"; fields.title.value = task.title || ""; fields.notes.value = task.notes || ""; if (Number.isFinite(task.longitude) && Number.isFinite(task.latitude)) setLocation({ coordinates: [task.longitude, task.latitude], source: "field-task", accuracyMeters: null }); $("[data-record-form]").dataset.taskId = task.id; switchView("collect");
    } catch (error) { toast(error.message); }
  });
  $("[data-export-geojson]").addEventListener("click", () => download("gismap-field-observations.geojson", JSON.stringify(recordsGeoJSON(selectedRecords().length ? selectedRecords() : records), null, 2), "application/geo+json"));
  $("[data-export-geopayload]").addEventListener("click", () => {
    const scope = selectedRecords().length ? selectedRecords() : records.length === 1 ? records : [];
    if (scope.length !== 1) { toast("Select one note on the Notes tab to create a compact GeoPayload."); return; }
    const payload = geoPayloadFromFieldRecord(scope[0]);
    download(`${fieldRecordFileStem(scope[0])}.geopayload`, encodeGeoPayload(payload, "file"), "application/vnd.gismap.geopayload+json");
    toast("Portable GeoPayload downloaded. Attachments stay in the .gisfield package.");
  });
  $("[data-export-package]").addEventListener("click", async () => { try { const assets = await packageAssets(); download("gismap-field-observations.gisfield", JSON.stringify(makeFieldPackage(records, assets), null, 2), "application/vnd.gismap.field+json"); toast("Field package downloaded."); } catch (error) { toast(error.message); } });
  $("[data-export-site-pack]").addEventListener("click", () => { try { downloadSitePack(); } catch (error) { toast(error.message); } });
  $("[data-import-package]").addEventListener("change", async (event) => { const [file] = event.target.files; if (!file) return; try { await importPackage(file); } catch (error) { toast(error.message); } event.target.value = ""; });
  $("[data-import-site-pack]").addEventListener("change", async (event) => { const [file] = event.target.files; if (!file) return; try { await importSitePack(file); } catch (error) { toast(error.message); } event.target.value = ""; });
  $("[data-import-pmtiles]").addEventListener("change", async (event) => { const [file] = event.target.files; try { await importPmtiles(file); } catch (error) { toast(error.message); } event.target.value = ""; });
  $("[data-site-pack-list]").addEventListener("click", async (event) => { const button = event.target.closest("button[data-remove-site-pack]"); if (!button) return; await store.deletePackage(button.dataset.removeSitePack); await refresh(); toast("Site Pack removed from this device."); });
  $("[data-offline-map-list]").addEventListener("click", async (event) => { const button = event.target.closest("button[data-remove-basemap]"); if (!button) return; await store.deleteBasemap(button.dataset.removeBasemap); await refresh(); toast("Offline basemap file removed from this device."); });
  $("[data-import-geopayload]").addEventListener("change", async (event) => { const [file] = event.target.files; if (!file) return; try { previewGeoPayload(decodeGeoPayload(await file.text())); } catch (error) { toast(error.message); } event.target.value = ""; });
  $("[data-export-pdf]").addEventListener("click", async () => { try { const scope = selectedRecords(); const file = await reportFile(scope.length ? scope : records); download(file.name, file, file.type); toast("Field PDF downloaded. Open its location links on desktop to add a map later."); } catch (error) { toast(error.message); } });
  $("[data-share-records]").addEventListener("click", async () => { try { const scope = selectedRecords(); const file = await reportFile(scope.length ? scope : records); await mobileShare({ title: "GISMap Online Field report", text: "Field observations from GISMap Online Field Mode.", file }); } catch (error) { if (error.name !== "AbortError") toast(error.message); } });
  $("[data-import-qr]").addEventListener("click", async () => { try { await importQrText($("[data-qr-text]").value); $("[data-qr-text]").value = ""; } catch (error) { toast(error.message); } });
  ["[data-import-qr-image]", "[data-import-qr-camera-image]"].forEach((selector) => $(selector).addEventListener("change", async (event) => { const [file] = event.target.files; try { await importQrImage(file); } catch (error) { toast(error.message); } event.target.value = ""; }));
  $("[data-open-qr-import]").addEventListener("click", () => { switchView("transfer"); requestAnimationFrame(() => $("[data-start-qr-camera]").focus()); });
  $("[data-start-qr-camera]").addEventListener("click", () => scanQrWithCamera().catch((error) => toast(error.message)));
  $("[data-close-qr-scanner]").addEventListener("click", () => $("[data-qr-scanner-dialog]").close());
  $("[data-qr-scanner-dialog]").addEventListener("close", stopQrCamera);
  $("[data-close-geopayload]").addEventListener("click", () => $("[data-geopayload-dialog]").close());
  $("[data-reject-geopayload]").addEventListener("click", () => $("[data-geopayload-dialog]").close());
  $("[data-geopayload-dialog]").addEventListener("close", () => { pendingGeoPayload = null; });
  $("[data-accept-geopayload]").addEventListener("click", () => acceptGeoPayload().catch((error) => toast(error.message)));
  $("[data-prepare-field]").addEventListener("click", () => openReadiness());
  $("[data-close-readiness]").addEventListener("click", () => $("[data-readiness-dialog]").close());
  $("[data-refresh-readiness]").addEventListener("click", () => openReadiness());
  $("[data-persist-field]").addEventListener("click", () => openReadiness(true));
  $("[data-close-qr]").addEventListener("click", () => $("[data-qr-dialog]").close());
  $("[data-qr-dialog]").addEventListener("close", stopAnimatedQr);
  $("[data-animate-qr]").addEventListener("click", () => showAnimatedQr().catch((error) => toast(error.message)));
  $("[data-download-qr]").addEventListener("click", async () => { try { const file = await qrCard(); download(file.name, file, file.type); } catch (error) { toast(error.message); } });
  $("[data-download-payload]").addEventListener("click", () => { try { if (!activeQrTransfer?.payload) throw new Error("Choose a handoff first."); download(activeQrTransfer.fileName.replace(/-qr\.png$/i, ".geopayload"), encodeGeoPayload(activeQrTransfer.payload, "file"), "application/vnd.gismap.geopayload+json"); toast("Portable GeoPayload downloaded."); } catch (error) { toast(error.message); } });
  $("[data-share-qr]").addEventListener("click", async () => { try { const file = await qrCard(); await mobileShare({ title: activeQrTransfer?.title || "GISMap Online Field handoff", text: activeQrTransfer?.summary || "GISMap Online Field handoff.", file }); } catch (error) { if (error.name !== "AbortError") toast(error.message); } });
  $("[data-copy-qr]").addEventListener("click", async () => { try { if (!activeQrTransfer) throw new Error("Choose a handoff to copy first."); await navigator.clipboard.writeText(activeQrTransfer.text); toast("Portable GeoPayload copied."); } catch (error) { toast(error.message || "Copy is unavailable in this browser."); } });
  $("[data-capability-details]").addEventListener("click", () => { const detail = $("[data-capabilities]"); detail.hidden = !detail.hidden; });
  window.addEventListener("online", capabilities); window.addEventListener("offline", capabilities);
  window.addEventListener("beforeinstallprompt", (event) => { event.preventDefault(); installPrompt = event; $("[data-install]").hidden = false; });
  $("[data-install]").addEventListener("click", async () => { if (!installPrompt) return; await installPrompt.prompt(); installPrompt = null; $("[data-install]").hidden = true; });
}

async function initialize() {
  capabilities(); setupSketch(); wire();
  try { await store.open(); await refresh(); } catch (error) { toast(error.message); }
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./service-worker.js").catch(() => { /* Field Mode remains usable online without a cache. */ });
}
initialize();
