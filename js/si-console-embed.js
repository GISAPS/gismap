// Map side of the GISMap SI Query Console. SI owns the query and the tools; this
// draws what SI sends and reports map gestures back. Nothing here is persisted,
// and messages are accepted only from the framing SI page.
export const SI_PARENT_ORIGINS = ["https://gismap.si", "https://www.gismap.si"];
const MAX_FEATURES = 20000;
const COLLECTIONS = new Set(["results", "draw", "extent", "context"]);
const ACTIONS = new Set(["data", "select", "fit", "zoom", "center", "tool", "basemap"]);
const EMPTY = { type: "FeatureCollection", features: [] };
const isBbox = (value) => Array.isArray(value) && value.length === 4 && value.every(Number.isFinite);

export function allowedParents(hostname, referrer = "") {
  if (hostname !== "localhost" && hostname !== "127.0.0.1") return SI_PARENT_ORIGINS;
  try { return [...SI_PARENT_ORIGINS, new URL(referrer).origin]; } catch { return SI_PARENT_ORIGINS; }
}

export function validConsoleMessage(message) {
  if (message?.type !== "gismap.si.console" || message.version !== 1 || !ACTIONS.has(message.action)) return false;
  if (message.action === "data") {
    const { name, data } = message;
    return COLLECTIONS.has(name) && data?.type === "FeatureCollection" && Array.isArray(data.features)
      && data.features.length <= MAX_FEATURES && data.features.every((item) => item?.type === "Feature" && item.geometry && typeof item.geometry.type === "string");
  }
  if (message.action === "fit") return isBbox(message.bbox);
  if (message.action === "center") return Array.isArray(message.center) && message.center.length === 2 && message.center.every(Number.isFinite);
  if (message.action === "zoom") return message.direction === "in" || message.direction === "out";
  if (message.action === "tool") return typeof message.tool === "string";
  if (message.action === "basemap") return typeof message.id === "string";
  return true;
}

const isPolygon = ["==", ["geometry-type"], "Polygon"];
const isPoint = ["==", ["geometry-type"], "Point"];
const NONE = ["boolean", false];
const COLORS = { purple: "#7052bc", pink: "#eb4aa4", danger: "#b2154d", soft: "#716b87", query: "#2563eb" };
const LAYERS = [
  { id: "si-context-fill", type: "fill", source: "si-context", filter: isPolygon, paint: { "fill-color": "#fff", "fill-opacity": 0.5 } },
  { id: "si-context-line", type: "line", source: "si-context", paint: { "line-color": COLORS.soft, "line-width": 1.5 } },
  { id: "si-fill", type: "fill", source: "si-results", filter: isPolygon, paint: { "fill-color": COLORS.purple, "fill-opacity": 0.45 } },
  { id: "si-line", type: "line", source: "si-results", filter: ["!", isPoint], paint: { "line-color": COLORS.purple, "line-width": 2 } },
  { id: "si-point", type: "circle", source: "si-results", filter: isPoint, paint: { "circle-color": COLORS.purple, "circle-opacity": 0.8, "circle-radius": 6, "circle-stroke-color": "#fff", "circle-stroke-width": 1.5 } },
  { id: "si-selected-fill", type: "fill", source: "si-results", filter: NONE, paint: { "fill-color": COLORS.pink, "fill-opacity": 0.55 } },
  { id: "si-selected-line", type: "line", source: "si-results", filter: NONE, paint: { "line-color": COLORS.danger, "line-width": 3 } },
  { id: "si-selected-point", type: "circle", source: "si-results", filter: NONE, paint: { "circle-color": COLORS.pink, "circle-radius": 8, "circle-stroke-color": COLORS.danger, "circle-stroke-width": 3 } },
  { id: "si-extent-line", type: "line", source: "si-extent", paint: { "line-color": COLORS.purple, "line-width": 2 } },
  { id: "si-draw-line", type: "line", source: "si-draw", paint: { "line-color": COLORS.query, "line-width": 2.5, "line-dasharray": [2, 1.5] } },
  { id: "si-draw-vertex", type: "circle", source: "si-draw", filter: isPoint, paint: { "circle-color": "#fff", "circle-radius": 4.5, "circle-stroke-color": COLORS.query, "circle-stroke-width": 2 } },
];
const HIT_LAYERS = ["si-fill", "si-line", "si-point"];

export function createConsoleBridge({ map, post, basemaps = [], setBasemap = () => {} }) {
  const data = { results: EMPTY, draw: EMPTY, extent: EMPTY, context: EMPTY };
  const state = { idField: null, selected: null, fit: null };
  function applySelection() {
    if (!map.getLayer("si-fill")) return;
    const match = state.selected == null || !state.idField ? NONE : ["==", ["to-string", ["get", state.idField]], String(state.selected)];
    map.setFilter("si-selected-fill", ["all", isPolygon, match]);
    map.setFilter("si-selected-line", ["all", ["!", isPoint], match]);
    map.setFilter("si-selected-point", ["all", isPoint, match]);
  }
  // A basemap change replaces the style, so the overlay is rebuilt from memory.
  function ensureOverlay() {
    if (map.getSource("si-results")) return;
    try {
      for (const name of COLLECTIONS) map.addSource(`si-${name}`, { type: "geojson", data: data[name] });
    } catch { return; } // The style is still loading; a later style event retries.
    LAYERS.forEach((layer) => map.addLayer(layer));
    applySelection();
    if (!announced) { announced = true; report(); post({ type: "gismap.console.ready", version: 1, basemaps }); }
  }
  const report = () => { const b = map.getBounds(); post({ type: "gismap.console.bounds", version: 1, bbox: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()] }); };
  function pointerEvent(type, event) {
    const { x, y } = event.point;
    const hit = map.getLayer("si-fill") ? map.queryRenderedFeatures([[x - 4, y - 4], [x + 4, y + 4]], { layers: HIT_LAYERS })[0] : null;
    post({ type, version: 1, lng: event.lngLat.lng, lat: event.lngLat.lat, id: hit && state.idField ? hit.properties[state.idField] ?? null : null });
  }
  let announced = false;
  map.doubleClickZoom.disable();
  ["styledata", "sourcedata", "load", "idle"].forEach((name) => map.on(name, ensureOverlay));
  map.on("click", (event) => pointerEvent("gismap.console.click", event));
  map.on("dblclick", (event) => { event.preventDefault(); pointerEvent("gismap.console.dblclick", event); });
  map.on("mousemove", (event) => post({ type: "gismap.console.move", version: 1, lng: event.lngLat.lng, lat: event.lngLat.lat }));
  map.on("moveend", report);
  ensureOverlay();
  const fit = (duration) => map.fitBounds([[state.fit[0], state.fit[1]], [state.fit[2], state.fit[3]]], { padding: 50, maxZoom: 16, duration });
  return {
    // GISMap's initial view can land after SI's first fit, so it is applied again.
    refit() { if (state.fit) fit(0); },
    handle(message) {
      if (message.action === "data") {
        data[message.name] = message.data;
        if (message.name === "results") { state.idField = message.idField || null; state.selected = null; }
        map.getSource(`si-${message.name}`)?.setData(message.data);
        applySelection();
      }
      if (message.action === "select") { state.selected = message.id ?? null; applySelection(); }
      if (message.action === "fit") { state.fit = message.bbox; fit(400); }
      if (message.action === "zoom") message.direction === "in" ? map.zoomIn() : map.zoomOut();
      if (message.action === "center") map.easeTo({ center: message.center, duration: 300 });
      if (message.action === "tool") map.getCanvas().style.cursor = message.tool === "select" ? "" : "crosshair";
      if (message.action === "basemap") setBasemap(message.id);
    },
  };
}
