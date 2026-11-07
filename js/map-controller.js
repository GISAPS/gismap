// Stable application-facing map facade. It owns engine selection and the
// higher-level workflows that can be expressed with provider-neutral
// primitives. Renderer adapters stay focused on drawing and interaction.
import { createEngine, getEngineDefinition, listEngines } from "./engines/engine-registry.js?v=0.69.9-order";
import { MAP_CONTROLLER_METHODS, METHOD_CAPABILITIES, unsupported } from "./engines/engine-interface.js?v=0.62.4-silent-engine-handoff";
import { GisMapError } from "./gismap-errors.js?v=0.54.0-print";
import { TextBoxLayer } from "./text-boxes.js?v=0.65.0-paths";
import { LayerLabeler, normalizeLabeling } from "./layer-labels.js?v=0.65.0-paths";

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const nothing = () => undefined;

/**
 * What the app gets when the engine lacks an optional capability whose
 * absence is harmless (no click marker, no tour pins, no address lookup).
 * Anything not listed reports the missing capability instead.
 */
const CARRIED_LAYER_FIELDS = ["wfsName", "customParameters", "elevationInfo", "animatedEffect", "scene3d", "labeling"];

/** An ArcGIS JSON or GeoJSON geometry (EPSG:4326) as GeoJSON. */
function toGeoJsonGeometry(geometry) {
  if (!geometry) return null;
  if (typeof geometry.type === "string" && Array.isArray(geometry.coordinates)) return { type: geometry.type, coordinates: geometry.coordinates };
  if (Number.isFinite(geometry.x) && Number.isFinite(geometry.y)) return { type: "Point", coordinates: [geometry.x, geometry.y] };
  if (Array.isArray(geometry.points)) return { type: "MultiPoint", coordinates: geometry.points.map((point) => point.slice(0, 2)) };
  if (Array.isArray(geometry.paths)) {
    const paths = geometry.paths.map((path) => path.map((point) => point.slice(0, 2)));
    return paths.length === 1 ? { type: "LineString", coordinates: paths[0] } : { type: "MultiLineString", coordinates: paths };
  }
  if (Array.isArray(geometry.rings)) return { type: "Polygon", coordinates: geometry.rings.map((ring) => ring.map((point) => point.slice(0, 2))) };
  return null;
}

const FALLBACKS = Object.freeze({
  configureInteractionFeedback: nothing,
  clearClickMarker: nothing,
  highlightFeature: async () => false,
  clearFeatureHighlight: nothing,
  setTaskPin: nothing,
  setTourMarkers: nothing,
  setActiveTourMarker: nothing,
  clearTourMarkers: nothing,
  hasDrawings: () => false,
  clearDrawings: nothing,
  getDrawGraphicsForExport: () => [],
  getDrawingsStyle: () => ({}),
  setDrawingsStyle: nothing,
  widgetOpen: () => false,
  setBasemapTheme: nothing,
  setBuildings3d: nothing,
  getBasemapOptions: () => ({ selected: null, options: [] }),
  restoreRenderer: nothing,
  recordRendererSpec: nothing,
  layerMetadata: () => null,
  getLocalAsset: () => null,
  ignoreScaleRange: () => false,
  reverseGeocode: async () => null,
});

export class MapController {
  constructor(events, authController = null, { engineId = "arcgis", engineFactory = createEngine } = {}) {
    this.events = events;
    this.authController = authController;
    this.engineId = engineId;
    this.engineFactory = engineFactory;
    this.engine = null;
    this.container = null;
    this.initialBasemapId = null;
    this.defaultBasemapId = null;
    this.groundId = "world-elevation";
    this.geoParquetSources = new Map();
    this.carriedLayerFields = new Map();
    this.textBoxes = new TextBoxLayer({
      events,
      project: {
        mapToScreen: (coordinates) => this.engine?.mapToScreen?.(coordinates) ?? null,
        screenToMap: (x, y) => this.engine?.screenToMap?.(x, y) ?? null,
        container: () => this.#containerElement(),
        zoom: () => { try { return this.engine?.getCamera?.()?.zoom ?? null; } catch { return null; } },
      },
    });
    // Layer labels are drawn by the text-box renderer, so captures and exports include them.
    this.labeler = new LayerLabeler({ mapController: this, events });
    this.textBoxes.addSource(() => this.labeler.boxes());
    this.events?.subscribe?.("labels:changed", () => this.textBoxes.wake());
    this.events?.subscribe?.("layer:removed", ({ uid }) => { this.geoParquetSources.delete(uid); this.carriedLayerFields.delete(uid); });
  }

  availableEngines() { return listEngines(); }
  /** Null until the engine's map exists, or on an engine without this overlay. */
  attachConsoleOverlay(options) { return this.engine?.attachConsoleOverlay?.(options) ?? null; }
  getEngineId() { return this.engine?.id || this.engineId; }

  async prepare() {
    if (!this.engine) {
      this.engine = await this.engineFactory(this.engineId, { events: this.events, authController: this.authController });
      if (this.defaultBasemapId) this.engine.setDefaultBasemap?.(this.defaultBasemapId);
      if (this.initialBasemapId) this.engine.setInitialBasemap?.(this.initialBasemapId);
    }
    return this.engine;
  }

  async initialize(container = "viewDiv") {
    this.container = container;
    await this.prepare();
    return this.engine.initialize(container);
  }

  /**
   * Replaces the renderer beneath the existing workspace without navigating
   * away from the application. Remote layers, their GISMap Online styles, basemap,
   * terrain choice, and camera are rebuilt in the new engine. Callers receive
   * the old-to-new layer IDs so their own selection state can follow along.
   *
   * Local browser files deliberately fail before the old engine is removed:
   * their File handles cannot safely cross an engine boundary.
   */
  async switchEngine(engineId) {
    const target = String(engineId || "").toLowerCase();
    const previousId = this.getEngineId();
    if (!target || target === previousId) return { switched: false, engine: previousId, layers: [] };
    if (!getEngineDefinition(target)) throw new GisMapError("UNKNOWN_ENGINE", `Unknown map engine: ${target}.`);
    if (!this.engine) throw new GisMapError("NOT_READY", "The map engine has not been initialized yet.");

    const configs = this.getAllLayerConfigs();
    const local = configs.find((config) => config.local || this.geoParquetSources.has(config.uid));
    if (local) throw new GisMapError("UNSUPPORTED_LAYER_TYPE", `“${local.title || "A local layer"}” is stored only in this browser and cannot move between map engines.`);

    const container = this.container || this.getContainer?.() || "viewDiv";
    const view = this.getViewState();
    const basemap = this.getBasemapId();
    const ground = this.getGroundId();
    const drawings = this.getDrawings();
    const drawingsStyle = this.engine.getDrawingsStyle?.() ?? null;
    const previousEngine = this.engine;
    const oldEngineId = this.engineId;

    // Destroying only the map view leaves the workspace, player, panels, and
    // route in place. The container is reused, so this is a renderer handoff,
    // not an application reload.
    previousEngine.destroy?.();
    this.engine = null;
    this.engineId = target;
    try {
      const engine = await this.engineFactory(target, { events: this.events, authController: this.authController });
      this.engine = engine;
      await engine.initialize(container);
      if (this.defaultBasemapId) engine.setDefaultBasemap?.(this.defaultBasemapId);
      if (basemap) await Promise.resolve(engine.setBasemap?.(basemap)).catch(() => {});
      if (ground) await Promise.resolve(this.setGround(ground)).catch(() => {});

      const layers = [];
      for (const config of configs) {
        const layer = await this.addService(config);
        // Renderer specs are GISMap Online's portable styling format. Native renderer
        // JSON is intentionally not replayed across different SDKs.
        if (config.rendererSpec) await Promise.resolve(this.applyRendererSpec(layer.uid, config.rendererSpec)).catch(() => {});
        if (config.ignoreServiceScaleRange) await Promise.resolve(this.ignoreScaleRange(layer.uid, true)).catch(() => {});
        if (config.animatedEffect && this.getCapabilities().includes("three-3d")) await Promise.resolve(this.setLayerEffect(layer.uid, config.animatedEffect)).catch(() => {});
        layers.push({ from: config.uid, to: layer.uid, layer, config });
      }
      if (drawingsStyle && Object.keys(drawingsStyle).length) await Promise.resolve(engine.setDrawingsStyle?.(drawingsStyle)).catch(() => {});
      if (drawings.length) await this.setDrawings(drawings).catch(() => {});
      await this.restoreView(view);
      this.events?.publish?.("layers:reset", {});
      this.textBoxes.reattach();
      this.events?.publish?.("engine:changed", { from: previousId, engine: target, layers });
      return { switched: true, engine: target, layers };
    } catch (error) {
      // The old renderer has already released its WebGL context; restore a
      // working renderer rather than leave the live app without a map.
      this.engine?.destroy?.();
      this.engine = null;
      this.engineId = oldEngineId;
      try {
        const engine = await this.engineFactory(oldEngineId, { events: this.events, authController: this.authController });
        this.engine = engine;
        await engine.initialize(container);
        if (basemap) await Promise.resolve(engine.setBasemap?.(basemap)).catch(() => {});
        if (ground) await Promise.resolve(this.setGround(ground)).catch(() => {});
        for (const config of configs) {
          const layer = await this.addService(config);
          if (config.rendererSpec) await Promise.resolve(this.applyRendererSpec(layer.uid, config.rendererSpec)).catch(() => {});
          if (config.ignoreServiceScaleRange) await Promise.resolve(this.ignoreScaleRange(layer.uid, true)).catch(() => {});
        }
        await this.restoreView(view);
        this.events?.publish?.("layers:reset", {});
      } catch { /* Surface the original error; a failed recovery is handled by the app error boundary. */ }
      throw error;
    }
  }

  destroy() {
    this.engine?.destroy?.();
    this.engine = null;
  }

  isReady() { return Boolean(this.engine?.isReady?.()); }
  async whenReady() { return this.#requireEngine().whenReady(); }
  getCapabilities() { return this.engine?.getCapabilities?.() || getEngineDefinition(this.engineId)?.capabilities || []; }

  setInitialBasemap(id) {
    this.initialBasemapId = id || null;
    this.engine?.setInitialBasemap?.(this.initialBasemapId);
  }

  setDefaultBasemap(id) {
    this.defaultBasemapId = id || null;
    this.engine?.setDefaultBasemap?.(this.defaultBasemapId);
  }

  setMapNoteMarkers(points = []) { this.engine?.setMapNoteMarkers?.(points); }

  getDefaultBasemapId() {
    return this.engine?.getDefaultBasemapId?.() || this.defaultBasemapId || this.engine?.getBasemapId?.() || this.initialBasemapId;
  }

  getBasemapId() { return this.engine?.getBasemapId?.() || this.initialBasemapId || this.defaultBasemapId; }

  setGeoParquetSource(uid, source) { this.geoParquetSources.set(uid, source); }

  getLayerConfig(ref) {
    const config = this._delegate("getLayerConfig", [ref]);
    if (!config) return config;
    const source = this.geoParquetSources.get(config.uid);
    const carried = this.carriedLayerFields.get(config.uid);
    if (carried) for (const [key, value] of Object.entries(carried)) if (config[key] == null) config[key] = structuredClone(value);
    if (!source) return config;
    return { ...config, sourceType: "geoparquet", type: "geoparquet", local: Boolean(source.file),
      url: source.url || null, fileName: source.file?.name || null,
      projectPath: source.file ? source.projectPath : null, refreshInterval: 0 };
  }

  getLocalAsset(ref) {
    const uid = typeof ref === "string" ? ref : ref?.uid;
    return this.geoParquetSources.get(uid)?.file || this._delegate("getLocalAsset", [ref]);
  }

  /**
   * Engines keep settings they cannot draw (a WFS name on MapLibre, an effect on
   * ArcGIS) so a project saved on one engine loses nothing on the other.
   */
  async addService(config = {}) {
    const layer = await this._delegate("addService", [config]);
    const carried = Object.fromEntries(CARRIED_LAYER_FIELDS.filter((key) => config[key] != null).map((key) => [key, structuredClone(config[key])]));
    if (layer?.uid && Object.keys(carried).length) this.carriedLayerFields.set(layer.uid, carried);
    return layer;
  }

  async setLayerEffect(uid, effect) {
    const result = await this._delegate("setLayerEffect", [uid, effect]);
    delete this.carriedLayerFields.get(uid)?.animatedEffect;
    return result;
  }

  /** Drawings as GeoJSON features in EPSG:4326, the same on every engine. */
  getDrawings() {
    return (this._delegate("getDrawGraphicsForExport", ["all"]) || [])
      .map(({ geometry }) => ({ type: "Feature", geometry: toGeoJsonGeometry(geometry), properties: {} }))
      .filter((feature) => feature.geometry);
  }

  async setDrawings(features = []) {
    const valid = (Array.isArray(features) ? features : []).filter((feature) => feature?.geometry?.type && Array.isArray(feature.geometry.coordinates)).slice(0, 5000);
    if (typeof this.engine?.setDrawings !== "function") return;
    await this.engine.setDrawings(valid.map((feature) => ({ type: "Feature", geometry: feature.geometry, properties: {} })));
  }

  /** A layer's label settings (normalized), or null when it has none. */
  getLayerLabeling(uid) {
    const spec = this.carriedLayerFields.get(uid)?.labeling;
    return spec ? normalizeLabeling(spec) : null;
  }

  /** Labels a layer from its fields; saved with the layer in projects and kept across engines. */
  setLayerLabeling(uid, spec) {
    const carried = this.carriedLayerFields.get(uid) || {};
    if (spec) carried.labeling = normalizeLabeling(spec); else delete carried.labeling;
    this.carriedLayerFields.set(uid, carried);
    this.labeler.schedule(0);
    this.events?.publish?.("layer:labels-changed", { uid });
  }

  /** Map text boxes: rich labels anchored at [longitude, latitude, z], kept across engines. */
  getTextBoxes() { return this.textBoxes.list(); }
  setTextBoxes(list = []) { this.textBoxes.set(list); }
  addTextBox(box) { return this.textBoxes.add(box); }
  updateTextBox(id, patch) { return this.textBoxes.update(id, patch); }
  removeTextBox(id) { this.textBoxes.remove(id); }
  clearTextBoxes() { this.textBoxes.clear(); }
  selectTextBox(id) { this.textBoxes.select(id); }
  pickMapCoordinate() { return this.textBoxes.pickCoordinate(); }
  /** Screen pixels (in the map container) of [longitude, latitude, z?], or null. */
  mapToScreen(coordinates) { return this.engine?.mapToScreen?.(coordinates) ?? null; }

  /** Inspects an external tile archive; only engines that draw vector tiles can. */
  inspectExternalTiles(value, options = {}) {
    if (typeof this.engine?.inspectExternalTiles !== "function") throw new GisMapError("UNSUPPORTED", "Switch to the MapLibre engine to inspect tile archives.");
    return this.engine.inspectExternalTiles(value, options);
  }

  /** [longitude, latitude, z] under a map-container pixel, or null. */
  screenToMap(x, y) { return this.engine?.screenToMap?.(x, y) ?? null; }
  /** The map container's size in CSS pixels. */
  getContainerSize() { const element = this.#containerElement(); return element ? { width: element.clientWidth, height: element.clientHeight } : null; }

  /** The engine's capture with text boxes drawn in, so exports match the screen. */
  async captureImage(options = {}) {
    const capture = await this._delegate("captureImage", [options]);
    try {
      return await this.textBoxes.composite(capture, options.format || "jpg", options.quality ?? 82);
    } catch {
      return capture;
    }
  }

  #containerElement() {
    const container = this.engine?.getContainer?.() ?? this.container;
    if (typeof container === "string") return typeof document === "undefined" ? null : document.getElementById(container);
    return container || null;
  }

  getAllLayerConfigs() { return this.getLayers().map((layer) => this.getLayerConfig(layer)); }

  /** Terrain on engines with 3D ground; others keep the choice so projects save it unchanged. */
  setGround(id) {
    this.groundId = id || "world-elevation";
    if (typeof this.engine?.setGround === "function") return this.engine.setGround(this.groundId);
  }

  getGroundId() {
    return typeof this.engine?.getGroundId === "function" ? this.engine.getGroundId() : this.groundId;
  }

  getGroundOptions() {
    return this.engine?.getGroundOptions?.() || { selected: this.getGroundId(), options: [
      { id: "world-elevation", label: "World elevation" },
      { id: "world-topobathymetry", label: "Elevation + bathymetry" },
      { id: "flat", label: "Flat ground" },
    ] };
  }

  async restoreView(state) {
    if (!state) return;
    // A flat map goes to a saved 3D view's centre and zoom when it has them; the camera position is the eye, not the target.
    const flat = !this.getCapabilities().includes("view-3d");
    if (state.camera && !(flat && Array.isArray(state.center))) return this.setView({ camera: state.camera }, { animate: false });
    return this.setView({ center: state.center, zoom: state.zoom, heading: state.heading, tilt: state.tilt }, { animate: false });
  }

  async goToFeature(feature, options = {}) {
    if (!feature?.geometry) throw new Error("This record does not have a geometry to zoom to.");
    return this.setView({ geometry: feature.geometry, fit: "feature" }, { animate: options.animate ?? true, ...options });
  }

  async goToFeatures(features = [], options = undefined) {
    const usable = features.filter((feature) => feature?.geometry);
    if (usable.length) return this.setView({ features: usable }, options);
  }

  /** Every value of a field under the layer's filter, paged and engine-neutral. */
  async fieldValues(ref, field, { limit = 20000 } = {}) {
    const layer = typeof ref === "string" ? this.getLayer(ref) : ref;
    if (!layer?.queryable) return [];
    const values = [];
    const pageSize = Math.max(1, Math.min(layer.maxRecordCount || 2000, 2000));
    for (let start = 0; start < limit; start += pageSize) {
      const result = await this._delegate("queryFeatures", [layer.uid, {
        where: layer.where || "1=1", outFields: [field], returnGeometry: false, num: pageSize,
        ...(layer.paginated ? { start } : {}),
      }]);
      result.features.forEach((feature) => values.push(feature.attributes?.[field]));
      if (!layer.paginated || result.features.length < pageSize) break;
    }
    return values;
  }

  async distinctValues(ref, fieldName, { limit = 200 } = {}) {
    const layer = typeof ref === "string" ? this.getLayer(ref) : ref;
    const field = layer?.fields?.find((item) => item.name === fieldName);
    if (!field) return { values: [], complete: true };
    const coded = field.domain?.type === "coded-value" ? field.domain.codedValues || [] : [];
    if (coded.length) return { values: coded.slice(0, limit).map((item) => ({ value: item.code, label: String(item.name ?? item.code) })), complete: coded.length <= limit };
    if (!layer.queryable || /date|oid|geometry|guid|global-?id|blob/i.test(String(field.type || ""))) return { values: [], complete: true };
    const unique = (list) => [...new Set(list.filter((value) => value !== null && value !== undefined && value !== ""))]
      .sort((a, b) => (typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b))));
    let values;
    let sampled = false;
    try {
      const result = await this._delegate("queryFeatures", [layer.uid, { where: "1=1", outFields: [fieldName], returnGeometry: false, returnDistinctValues: true, orderByFields: [fieldName], num: limit + 1 }, { layerDefaults: false }]);
      values = unique(result.features.map((feature) => feature.attributes?.[fieldName]));
    } catch {
      const result = await this._delegate("queryFeatures", [layer.uid, { where: "1=1", outFields: [fieldName], returnGeometry: false, num: 2000 }, { layerDefaults: false }]).catch(() => ({ features: [] }));
      values = unique(result.features.map((feature) => feature.attributes?.[fieldName]));
      sampled = result.features.length >= 2000;
    }
    return { values: values.slice(0, limit).map((value) => ({ value, label: String(value) })), complete: values.length <= limit && !sampled };
  }

  /** Provider-neutral multi-view capture used by Briefing PDF export. */
  async captureViews(targets = [], { aspect = 4 / 3, width = 1400, onProgress = () => {}, prepare = null } = {}) {
    const previous = this.getViewState();
    const images = [];
    try {
      for (const [index, target] of targets.entries()) {
        onProgress(index, targets.length);
        try {
          if (target) await this.setView(target, { animate: false });
          if (prepare) await prepare(index, target);
          await wait(120);
          images.push(await this.captureImage({ format: "jpg", quality: 84, width, aspect }));
        } catch {
          images.push(null);
        }
      }
    } finally {
      await this.restoreView(previous).catch(() => {});
    }
    return images;
  }

  #requireEngine() {
    if (!this.engine) throw new GisMapError("NOT_READY", "The map engine has not been initialized yet.");
    return this.engine;
  }

  _delegate(name, args) {
    const engine = this.#requireEngine();
    if (typeof engine[name] !== "function" && FALLBACKS[name]) return FALLBACKS[name](...args);
    if (typeof engine[name] !== "function") throw unsupported(METHOD_CAPABILITIES[name] || name, `${engine.id || this.engineId} does not support ${name}.`);
    return engine[name](...args);
  }
}

// Keep the facade explicit and testable without 70 repetitive one-line methods.
for (const name of MAP_CONTROLLER_METHODS) {
  if (typeof MapController.prototype[name] === "function") continue;
  Object.defineProperty(MapController.prototype, name, {
    configurable: false,
    value(...args) { return this._delegate(name, args); },
  });
}

