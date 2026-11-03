// What a signed-in user can do with their GISMap SI workspace from Online:
// save the map (Map REST API v1), store vector data (the upload pipeline), and
// ask the workspace assistant. Every call goes through the session's client.
import { packCamera, packLayer } from "./map-share.js?v=0.65.0-paths";
import { normalizeTextBoxes } from "./text-boxes.js?v=0.65.0-paths";

const MAPS_KEY = "gismap.si.savedMaps";
const POLL_MS = 1500;
const POLL_LIMIT_MS = 5 * 60 * 1000;
const KIND_BY_TYPE = { feature: "featureserver", "map-image": "mapserver", "vector-tiles": "vectortiles", wms: "wms", geojson: "geojson-url" };

/** The SI `source.kind` for an Online layer, or null when SI can't store it yet. */
export function siSourceKind(config = {}) {
  if (config.local || !config.url) return null;
  const type = config.sourceType || "arcgis-auto";
  if (KIND_BY_TYPE[type]) return KIND_BY_TYPE[type];
  if (type !== "arcgis-auto") return null;
  if (/\/FeatureServer(\/\d+)?\/?$/i.test(config.url)) return "featureserver";
  if (/\/MapServer(\/\d+)?\/?$/i.test(config.url)) return "mapserver";
  if (/\/VectorTileServer\/?$/i.test(config.url)) return "vectortiles";
  return null;
}

const pruned = (object) => Object.fromEntries(Object.entries(object).filter(([, value]) => value !== null && value !== undefined));

/**
 * Editor state → SI map `state`. Settings SI hasn't named yet go into `extras`
 * under the names the accounts spec gives them. `blocked` names every layer SI
 * can't store; a map with blocked layers must not be saved.
 */
export function toSiState({ skin, basemap, camera, layers = [], textBoxes = [], drawings = [], engine = null, ground = null }) {
  const blocked = [];
  const siLayers = [];
  layers.forEach((config) => {
    const kind = siSourceKind(config);
    if (!kind) { blocked.push(config.title || "Untitled layer"); return; }
    const packed = packLayer(config);
    siLayers.push(pruned({
      id: `l${siLayers.length + 1}`,
      name: packed.n || config.title || "Layer",
      source: { kind, url: packed.u, layerType: packed.y },
      style: packed.r,
      where: packed.w,
      effect: packed.e,
      opacity: Number.isFinite(config.opacity) ? config.opacity : 1,
      visible: config.visible !== false,
      extras: Object.keys(pruned({ ignoreScaleRange: packed.s ? true : null, labels: packed.l, scene3d: packed.v, spatialChart: packed.q })).length
        ? pruned({ ignoreScaleRange: packed.s ? true : null, labels: packed.l, scene3d: packed.v, spatialChart: packed.q })
        : undefined,
    }));
  });
  const view = packCamera(camera);
  const boxes = normalizeTextBoxes(textBoxes);
  const state = pruned({
    view: view ? { center: view.c, zoom: view.z, bearing: view.h, pitch: view.t } : null,
    basemap: basemap ? { id: basemap } : null,
    layers: siLayers,
    annotations: { type: "FeatureCollection", features: drawings },
    extras: pruned({ skin: skin || null, engine, ground, textBoxes: boxes.length ? boxes : null }),
  });
  return { state, blocked };
}

function readSavedMaps(storage) {
  try { return JSON.parse(storage?.getItem(MAPS_KEY) || "{}") || {}; } catch { return {}; }
}

/** The SI map a project was last saved to: { id, version, shareUrl } or null. */
export function savedMapFor(projectId, storage = globalThis.localStorage) {
  return readSavedMaps(storage)[projectId] || null;
}

/**
 * Creates the map on first save, then saves new versions with If-Match.
 * Returns { id, version, shareUrl, warnings, created }.
 */
export async function saveMapToSi(session, { projectId, title, state, storage = globalThis.localStorage }) {
  const workspace = session.workspace();
  const previous = savedMapFor(projectId, storage);
  const body = { schemaVersion: 1, kind: "map", title: String(title || "Untitled map").slice(0, 180), state };
  let data;
  // A map deleted in SI (404/410) is saved again as a new one.
  const update = previous?.id && await session.client.put(`/maps/${encodeURIComponent(previous.id)}`, body, { headers: { "If-Match": String(previous.version) } })
    .catch((error) => { if (error.status === 404 || error.status === 410) return null; throw error; });
  if (update) {
    data = update.data;
  } else {
    ({ data } = await session.client.post("/maps", { ...body, ...(workspace ? { workspaceId: workspace.id } : {}) }));
  }
  const created = !update;
  const saved = { id: data.id || (created ? null : previous.id), version: data.version, shareUrl: data.shareUrl || (created ? null : previous.shareUrl) || null };
  try { storage?.setItem(MAPS_KEY, JSON.stringify({ ...readSavedMaps(storage), [projectId]: saved })); } catch { /* storage unavailable */ }
  return { ...saved, warnings: Array.isArray(data.warnings) ? data.warnings : [], created };
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function pollUpload(session, id, done, onProgress) {
  const started = Date.now();
  for (;;) {
    const { data } = await session.client.get(`/uploads/${encodeURIComponent(id)}`);
    onProgress?.(data);
    if (data.status === "failed") throw new Error(data.error_message || "GISMap SI couldn't read this data.");
    if (done.includes(data.status)) return data;
    if (Date.now() - started > POLL_LIMIT_MS) throw new Error("GISMap SI is still processing this upload. Check Stored Intel in GISMap SI shortly.");
    await wait(POLL_MS);
  }
}

/**
 * Stores a GeoJSON file as a private dataset in the current workspace:
 * upload, wait for SI's checks, then publish. Returns the finished job.
 */
export async function storeDatasetInSi(session, { blob, fileName, name, description = null, onProgress }) {
  const workspace = session.workspace();
  if (!workspace) throw new Error("Your GISMap SI account has no workspace yet. Create one in GISMap SI first.");
  const form = new FormData();
  form.append("organization_id", workspace.id);
  form.append("file", blob, fileName);
  onProgress?.({ status: "uploading" });
  const { data: job } = await session.client.post("/uploads", form);
  const reviewed = await pollUpload(session, job.id, ["review_ready"], onProgress);
  // A GeoJSON file holds one layer.
  const layer = reviewed.layers?.[0]?.name;
  await session.client.post(`/uploads/${encodeURIComponent(job.id)}/publish`, pruned({ name: String(name || fileName).slice(0, 180), description, layer_name: layer, reproject_to_4326: true }));
  return pollUpload(session, job.id, ["published"], onProgress);
}

/** One turn with the workspace assistant. Returns { sessionId, text, sources }. */
export async function askSiAssistant(session, { message, sessionId = null }) {
  const workspace = session.workspace();
  if (!workspace) throw new Error("Your GISMap SI account has no workspace yet.");
  const { data } = await session.client.post("/assistant/chat", pruned({ message: String(message).slice(0, 4000), organization_id: workspace.id, session_id: sessionId, current_page: "gismap-online" }));
  return { sessionId: data.session_id, text: data.message?.content || "", sources: data.message?.sources || [] };
}
