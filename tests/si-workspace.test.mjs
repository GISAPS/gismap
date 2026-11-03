import test from "node:test";
import assert from "node:assert/strict";
import { createSiSession } from "../js/si-session.js";
import { askSiAssistant, savedMapFor, saveMapToSi, siSourceKind, storeDatasetInSi, toSiState } from "../js/si-workspace.js";

const json = (status, body) => new Response(body === null ? null : JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const FS = "https://services.arcgis.com/x/arcgis/rest/services/Fires/FeatureServer/0";

function memoryStorage() {
  const map = new Map();
  return { getItem: (key) => map.get(key) ?? null, setItem: (key, value) => map.set(key, String(value)), removeItem: (key) => map.delete(key) };
}

async function signedIn(routes) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    const path = new URL(url).pathname.replace("/api/v1", "");
    const call = { path, method: init.method, headers: init.headers, body: init.body };
    calls.push(call);
    const handler = routes[`${init.method} ${path}`];
    return handler ? handler(call) : json(404, { detail: "Not Found" });
  };
  routes["POST /auth/login"] ??= () => json(200, { access_token: "tok", user: { email: "a@b.c" }, organizations: [{ id: "org-1", name: "Loki", role: "owner" }] });
  routes["GET /auth/me"] ??= () => json(200, { user: { email: "a@b.c" }, organizations: [{ id: "org-1", name: "Loki", role: "owner" }] });
  const storage = memoryStorage();
  const session = createSiSession({ fetchImpl, storage });
  await session.signIn({ email: "a@b.c", password: "pw" });
  calls.length = 0;
  return { session, calls, storage };
}

test("layers map to SI source kinds, and unsupported ones are named", () => {
  assert.equal(siSourceKind({ url: FS, sourceType: "arcgis-auto" }), "featureserver");
  assert.equal(siSourceKind({ url: "https://x/arcgis/rest/services/A/MapServer", sourceType: "arcgis-auto" }), "mapserver");
  assert.equal(siSourceKind({ url: "https://x/a.geojson", sourceType: "geojson" }), "geojson-url");
  assert.equal(siSourceKind({ url: "https://x/a.kml", sourceType: "kml" }), null);
  assert.equal(siSourceKind({ url: "blob:x", local: true, sourceType: "geojson" }), null);

  const { state, blocked } = toSiState({
    skin: "highway",
    basemap: "streets",
    camera: { center: [-119.1, 43.7], zoom: 9.7, heading: 10, tilt: 40 },
    layers: [
      { url: FS, sourceType: "feature", title: "Fires", definitionExpression: "Age <= 7", opacity: 0.8, ignoreServiceScaleRange: true, labeling: { enabled: true, field: "Name" } },
      { url: "https://x/a.kml", sourceType: "kml", title: "Trails" },
    ],
    drawings: [{ type: "Feature", geometry: { type: "Point", coordinates: [0, 0] }, properties: {} }],
  });
  assert.deepEqual(blocked, ["Trails"]);
  assert.deepEqual(state.view, { center: [-119.1, 43.7], zoom: 9.7, bearing: 10, pitch: 40 });
  assert.deepEqual(state.basemap, { id: "streets" });
  assert.equal(state.extras.skin, "highway");
  assert.equal(state.layers.length, 1);
  const [layer] = state.layers;
  assert.deepEqual(layer.source, { kind: "featureserver", url: FS, layerType: "feature" });
  assert.equal(layer.where, "Age <= 7");
  assert.equal(layer.opacity, 0.8);
  assert.equal(layer.extras.ignoreScaleRange, true);
  assert.equal(layer.extras.labels.field, "Name");
  assert.equal(state.annotations.features.length, 1);
});

test("the first save creates the map, later saves send If-Match", async () => {
  let version = 1;
  const { session, calls, storage } = await signedIn({
    "POST /maps": () => json(201, { id: "m_1", version: 1, shareUrl: "https://gismap.online/m/m_1", warnings: [] }),
    "PUT /maps/m_1": () => json(200, { id: "m_1", version: ++version, warnings: [{ message: "Removed a token from a URL." }] }),
  });
  const first = await saveMapToSi(session, { projectId: "p1", title: "Fires", state: { layers: [] }, storage });
  assert.equal(first.created, true);
  assert.equal(JSON.parse(calls[0].body).workspaceId, "org-1");
  const second = await saveMapToSi(session, { projectId: "p1", title: "Fires", state: { layers: [] }, storage });
  assert.equal(second.created, false);
  assert.equal(calls[1].headers["If-Match"], "1");
  assert.equal(second.warnings[0].message, "Removed a token from a URL.");
  assert.deepEqual(savedMapFor("p1", storage), { id: "m_1", version: 2, shareUrl: "https://gismap.online/m/m_1" });
});

test("a map deleted in SI is saved again as a new one", async () => {
  const { session, storage } = await signedIn({
    "PUT /maps/gone": () => json(410, { detail: "This map is no longer available" }),
    "POST /maps": () => json(201, { id: "m_2", version: 1, warnings: [] }),
  });
  storage.setItem("gismap.si.savedMaps", JSON.stringify({ p1: { id: "gone", version: 3 } }));
  const saved = await saveMapToSi(session, { projectId: "p1", title: "Fires", state: {}, storage });
  assert.equal(saved.created, true);
  assert.equal(saved.id, "m_2");
});

test("a dataset is uploaded to the workspace, checked, then published", async () => {
  const statuses = ["inspecting", "review_ready", "publishing", "published"];
  const { session, calls } = await signedIn({
    "POST /uploads": () => json(202, { id: "u1", status: "queued" }),
    "GET /uploads/u1": () => json(200, { id: "u1", status: statuses.shift(), layers: [{ name: "drawings" }] }),
    "POST /uploads/u1/publish": () => json(202, { id: "u1", status: "publish_queued" }),
  });
  const seen = [];
  const job = await storeDatasetInSi(session, { blob: new Blob(["{}"], { type: "application/geo+json" }), fileName: "sites.geojson", name: "Valley sites", onProgress: (step) => seen.push(step.status) });
  assert.equal(job.status, "published");
  const upload = calls.find((call) => call.path === "/uploads");
  assert.ok(upload.body instanceof FormData);
  assert.equal(upload.body.get("organization_id"), "org-1");
  assert.equal(upload.headers["Content-Type"], undefined, "the browser sets the multipart boundary");
  const publish = JSON.parse(calls.find((call) => call.path === "/uploads/u1/publish").body);
  assert.deepEqual(publish, { name: "Valley sites", layer_name: "drawings", reproject_to_4326: true });
  assert.deepEqual(seen, ["uploading", "inspecting", "review_ready", "publishing", "published"]);
});

test("a failed SI check reports SI's reason", async () => {
  const { session } = await signedIn({
    "POST /uploads": () => json(202, { id: "u2", status: "queued" }),
    "GET /uploads/u2": () => json(200, { id: "u2", status: "failed", error_message: "No valid geometry." }),
  });
  await assert.rejects(storeDatasetInSi(session, { blob: new Blob(["{}"]), fileName: "x.geojson", name: "x" }), { message: "No valid geometry." });
});

test("the assistant keeps one SI chat session", async () => {
  const { session, calls } = await signedIn({
    "POST /assistant/chat": (call) => json(200, { session_id: "s1", message: { content: `echo ${JSON.parse(call.body).message}`, sources: [] } }),
  });
  const first = await askSiAssistant(session, { message: "Which datasets?" });
  assert.equal(first.text, "echo Which datasets?");
  await askSiAssistant(session, { message: "And fires?", sessionId: first.sessionId });
  assert.equal(JSON.parse(calls[0].body).organization_id, "org-1");
  assert.equal(JSON.parse(calls[1].body).session_id, "s1");
});
