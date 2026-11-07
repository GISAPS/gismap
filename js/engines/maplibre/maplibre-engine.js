// The MapLibre engine (experimental): a web map drawn with MapLibre GL JS
// on open OpenFreeMap basemaps. It implements the renderer contract in
// ../engine-interface.js. GeoJSON and ArcGIS feature layers are held in the
// browser as GeoJSON (ArcGIS features keep their service's fields and object
// IDs), drawn with their service's style or a GISMap Online style, and filtered,
// queried and identified here; ArcGIS map image and imagery services and WMS
// are drawn as images by their services. Open raster-DEM terrain turns the
// pitched map into a 3D surface. Capabilities it lacks (WFS, KML, and widgets)
// are left out of getCapabilities(),
// and MapController falls back or reports them.
//
// Zoom: GISMap Online zoom levels follow ArcGIS (256-pixel tiles); MapLibre's are
// one lower for the same scale (512-pixel tiles). Everything that crosses the
// boundary uses GISMap Online levels, so links and projects mean the same view.
import { createConsoleBridge } from "./console-overlay.js?v=0.67.0-si-console";
import { tourChapterPoint, tourMarkerDataUrl } from "../tour-markers.js?v=0.65.9-tourpins";
import { madeWithForPage, madeWithHtml } from "../../made-with.js?v=0.65.8-made-with";
import { parseLocalVectorFile } from "../../local-vector-import.js?v=0.54.0-vector1";
import { GisMapError } from "../../gismap-errors.js?v=0.54.0-print";
import { unsupported } from "../engine-interface.js?v=0.52.4";
import { openBasemapFor, withUsgsImagery } from "./basemaps.js?v=0.53.0-gallery1";
import { mountBasemapGallery } from "./basemap-gallery.js?v=0.53.0-gallery1";
import { basemapOnEngine, basemapsForEngine } from "../../basemap-catalog.js?v=0.53.0-gallery1";
import { applyBasemapTheme, withBuildings3d } from "./basemap-theme.js?v=0.52.0";
import { compileWhere } from "./where.js?v=0.40.0-timeline";
import { arcgisMetadata } from "../../source-inspector.js?v=0.53.0";
import { OpenGeocoder } from "./geocoder.js?v=0.47.0";
import { chooseStyleField, compileRenderer, resolveRendererSpec, suggestRenderers, validateRendererSpec } from "../../renderer-spec.js?v=0.29.1";
import { rendererToPaint } from "./arcgis-renderer.js?v=0.42.0";
import { legendForLayer } from "./legend.js?v=0.52.4";
import { inspectExternalTiles } from "./external-tiles.js?v=0.54.0";
import { hostCredit, joinCredits, legendSwatch, plainAttribution } from "../map-credits.js?v=0.1.0";
import { CINEMATIC_EFFECT_TYPES, effectFields, effectRanges, resolveQuality, suggestEffect } from "../../cinematic/cinematic-effects.js?v=0.69.9-order";

// A layer effect draws over at most this many features; more would cost frame rate for no visible gain.
const LAYER_EFFECT_MAX_FEATURES = 20000;
// Above this many features a layer effect spends its budget on what is in view first.
const LAYER_EFFECT_VIEW_FIRST = 800;
// Settled cinematic build-ups draw as native line layers under this source/layer prefix.
const SETTLED_EDGES_PREFIX = "cinematic-edges:";
// Native animated effects (Rise, Reveal) use this source/layer prefix.
const NATIVE_EFFECT_PREFIX = "cinematic-native:";
import { MAX_FEATURES, describeArcGIS, featureServiceLayers, fetchFeatures, fetchGeometries, queryServiceIds } from "./arcgis-service.js?v=0.47.0";
import { OBJECT_ID_FIELD, boundsIntersect, boundsOf, expandBounds, geometryTypeOf, inferFields, normalizeFeatures, regroupPolygon, representativePoint } from "./geojson.js?v=0.42.0";
import { loadMaplibre } from "./maplibre-loader.js?v=0.62.5-amd-safe";
import { HILLSHADE_LAYER_ID, HILLSHADE_SOURCE_ID, MAPLIBRE_GROUNDS, TERRAIN_SOURCE_ID, isTerrainTileFailure, hillshadeLayer, maplibreGround, terrainSource } from "./terrain.js?v=0.43.0";
import { normalizeSpatialChart, spatialChartAxis, spatialChartLayerSpecs, spatialChartLegend } from "../../spatial-chart.js?v=0.69.9-order";
import { SCENE3D_TYPES, normalizeScene3d, scene3dTypeFor } from "../../scene3d.js?v=0.1.0";
import { THREE_LAYER_ID, ThreeHost, loadThree } from "../three/three-host.js?v=0.1.4";

export const MAPLIBRE_CAPABILITIES = Object.freeze(["view-2d", "view-3d", "spatial-chart-3d", "three-3d", "basemaps", "basemap-themes", "ground", "layers-arcgis", "layers-files", "query", "feature-filter", "renderer-spec", "renderer-native", "identify", "highlight", "capture", "geocode", "buildings-3d", "draw", "measurement", "legend", "tour-markers", "native"]);

const ZOOM_OFFSET = 1;
const SCALE_AT_ZOOM_0 = 591657527.591555;
// GISMap Online green, until a skin's theme gives the data its accent colour.
const DEFAULT_COLOR = "#1b7f6a";
const MAX_PITCH = 85;
const HIGHLIGHT_SOURCE = "gismap-highlight";
const DRAW_SOURCE = "gismap-drawings";
const MEASURE_SOURCE = "gismap-measurement";
// Spherical surface area, with longitude differences wrapped at the date line.
// This measures a geographic footprint, not the area of the terrain surface.
export function measurementArea(coordinates) {
  if (coordinates.length < 3) return 0;
  const radians = Math.PI / 180;
  let sum = 0;
  for (let i = 0; i < coordinates.length; i++) {
    const [lon1, lat1] = coordinates[i];
    const [lon2, lat2] = coordinates[(i + 1) % coordinates.length];
    let delta = (lon2 - lon1) * radians;
    delta = ((delta + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
    sum += delta * (Math.sin(lat1 * radians) + Math.sin(lat2 * radians));
  }
  const sphere = 4 * Math.PI * 6371008.8 ** 2;
  const area = Math.abs(sum) * 6371008.8 ** 2 / 2;
  return Math.min(area, sphere - area);
}
const DRAW_LAYER_IDS = ["gismap-drawings-fill", "gismap-drawings-line", "gismap-drawings-point"];
const toEngineZoom = (zoom) => Number(zoom) - ZOOM_OFFSET;
const toGisZoom = (zoom) => Number(zoom) + ZOOM_OFFSET;
const zoomForScale = (scale) => Math.log2(SCALE_AT_ZOOM_0 / Math.max(1, Number(scale)));
const normalizeHeading = (bearing) => ((Number(bearing) % 360) + 360) % 360;
const round = (value, digits) => Number(Number(value).toFixed(digits));

function titleFromUrl(url = "") {
  const name = String(url).split(/[?#]/)[0].replace(/\/+$/, "").split("/").at(-1) || "GeoJSON layer";
  try {
    return decodeURIComponent(name).replace(/\.(geo)?json$/i, "").replaceAll("_", " ") || "GeoJSON layer";
  } catch {
    return name;
  }
}

function isGeoJsonUrl(url) {
  try {
    const parsed = new URL(url, globalThis.location?.href);
    return /\.(geo)?json$/i.test(parsed.pathname) || /^geojson$/i.test(parsed.searchParams.get("f") || "");
  } catch {
    return /\.(geo)?json(?:$|[?#])/i.test(String(url));
  }
}

/** A Web Mercator or WGS84 point as degrees. */
function geographicPoint(x, y, wkid) {
  if ([3857, 102100, 102113, 900913].includes(wkid)) {
    const radius = 6378137;
    return { longitude: (x / radius) * (180 / Math.PI), latitude: (2 * Math.atan(Math.exp(y / radius)) - (Math.PI / 2)) * (180 / Math.PI) };
  }
  return { longitude: x, latitude: y };
}

/** Read-only handle over a layer record (engine-interface.js LayerHandle). */
function layerHandle(record) {
  return Object.freeze({
    get uid() { return record.uid; },
    get id() { return record.id; },
    get title() { return record.title; },
    get url() { return record.url; },
    get layerId() { return record.layerId; },
    get type() { return record.type; },
    get fields() { return record.fields; },
    get geometryType() { return record.geometryType; },
    get objectIdField() { return record.kind === "vector" ? record.objectIdField : null; },
    get displayField() { return record.displayField; },
    get visible() { return record.visible; },
    get opacity() { return record.opacity; },
    get where() { return record.where || null; },
    get rendererSpec() { return record.rendererSpec; },
    get renderer() { return record.renderer ?? record.serviceRenderer ?? null; },
    get spatialChart() { return record.spatialChart ?? null; },
    get scene3d() { return record.scene3d ?? null; },
    get scene3dInfo() { return record.scene3dInfo ?? null; },
    get minScale() { return record.minScale || 0; },
    get maxScale() { return record.maxScale || 0; },
    get refreshInterval() { return 0; },
    get loadStatus() { return "loaded"; },
    get loadError() { return record.loadFailed ?? null; },
    get truncated() { return Boolean(record.truncated); },
    get queryable() { return record.kind === "vector"; },
    get countable() { return record.kind === "vector"; },
    get objectIdQueryable() { return record.kind === "vector"; },
    get filterable() { return record.kind === "vector"; },
    get stylable() { return record.kind === "vector"; },
    get refreshable() { return false; },
    get maxRecordCount() { return 0; },
    get paginated() { return true; },
    get parentTitle() { return null; },
  });
}

export class MaplibreEngine {
  #records = new Map();
  // Each asynchronous effect build receives a revision. Clearing or replacing
  // an effect advances it, so a late module/shader load cannot revive a layer
  // that has already been removed.
  #cinematicEffectRevisions = new Map();
  #count = 0;
  #loaded = null;
  #styleJson = new Map();
  #styleToken = 0;

  constructor(events) {
    this.id = "maplibre";
    this.events = events;
    this.maplibregl = null;
    this.map = null;
    this.defaultView = { center: [-98.5, 39.5], zoom: 4, heading: 0, tilt: 0 };
    this.defaultBasemapId = "topo-3d";
    this.basemapId = "topo-3d";
    this.initialBasemapId = null;
    this.basemapTheme = null;
    this.highlight = { enabled: true, color: "#00b8d9", style: "fill", feature: null };
    this.noteMarkers = [];
    this.tourMarkers = [];
    this.tourMarkerChapters = [];
    this.drawings = [];
    this.drawingsStyle = { color: "#d9951e", outline: "#ffffff", width: 3, fillOpacity: 0.18, pointRadius: 6, animatedEffect: null };
    this.drawing = null;
    this.drawPreviousCursor = null;
    this.measurement = null;
    this.legendHost = null;
    this.groundId = "world-elevation";
  }

  /* ---------------- Lifecycle ---------------- */

  async initialize(container = "viewDiv") {
    this.maplibregl = await loadMaplibre();
    const { center, zoom, heading, tilt } = this.defaultView;
    this.map = new this.maplibregl.Map({
      container,
      style: await this.#styleFor(this.basemapId),
      center,
      zoom: toEngineZoom(zoom),
      bearing: heading,
      pitch: tilt,
      maxPitch: MAX_PITCH,
      attributionControl: { compact: true, ...(madeWithForPage() ? { customAttribution: madeWithHtml() } : {}) },
      // Captures (Smart images, briefing PDFs) read the canvas after drawing.
      canvasContextAttributes: { preserveDrawingBuffer: true },
    });
    this.#loaded = new Promise((resolve, reject) => {
      this.map.once("load", resolve);
      this.map.once("error", (event) => { if (!this.map.loaded()) reject(event.error || new Error("The basemap did not load.")); });
    });
    await this.#loaded;
    await this.#applyGround();
    this.#bindEvents();
    this.events.publish("map:ready", { engine: this.id, zoom: this.#gisZoom() });
  }

  #bindEvents() {
    const point = (lngLat) => ({ longitude: lngLat.lng, latitude: lngLat.lat, x: lngLat.lng, y: lngLat.lat, spatialReference: { wkid: 4326 } });
    this.map.on("click", (event) => {
      if (this.measurement) return this.#measureClick(event);
      if (this.drawing) return this.#handleDrawingClick(event);
      this.events.publish("map:click", { x: event.point.x, y: event.point.y, mapPoint: point(event.lngLat) });
    });
    this.map.on("dblclick", (event) => {
      if (!this.drawing || !["polyline", "polygon"].includes(this.drawing.type)) return;
      event.preventDefault();
      this.#completeDrawing();
    });
    this.map.on("mousedown", (event) => {
      if (this.drawing?.type !== "rectangle") return;
      this.drawing.start = [event.lngLat.lng, event.lngLat.lat];
      this.map.dragPan.disable();
    });
    this.map.on("mouseup", (event) => {
      if (this.drawing?.type !== "rectangle" || !this.drawing.start) return;
      const [west, east] = [this.drawing.start[0], event.lngLat.lng].sort((a, b) => a - b);
      const [south, north] = [this.drawing.start[1], event.lngLat.lat].sort((a, b) => a - b);
      this.map.dragPan.enable();
      this.#finishDrawing({ type: "Polygon", coordinates: [[[west, south], [east, south], [east, north], [west, north], [west, south]]] });
    });
    this.map.on("mousemove", (event) => this.events.publish("view:pointer-move", { longitude: event.lngLat.lng, latitude: event.lngLat.lat, zoom: this.#gisZoom() }));
    this.map.on("zoomend", () => {
      this.#renderLegend();
      this.events.publish("view:scale-change", { scale: this.getScale() });
      // Layer effects carry zoom-dependent detail; a new zoom level redraws them.
      for (const record of this.#records.values()) if (record.animatedEffect && record.effectBuilt && record.effectBuilt.zoom !== Math.round(this.map.getZoom())) this.#queueLayerEffect(record);
    });
    this.map.on("moveend", () => {
      this.events.publish("view:stationary", {});
      // View-first layer effects follow the map once it leaves the area they were built for.
      const view = this.#effectViewBounds();
      for (const record of this.#records.values()) if (record.animatedEffect && record.effectBuilt?.viewBounds && view && !containsBounds(record.effectBuilt.viewBounds, view)) this.#queueLayerEffect(record);
      this.#sharpen();
    });
    this.map.on("error", (event) => {
      // Basemap tiles come and go; a failure in a data layer's source is worth reporting.
      if (!String(event.sourceId || "").startsWith("gismap-")) return;
      const terrainSourceIds = new Set([TERRAIN_SOURCE_ID, HILLSHADE_SOURCE_ID]);
      // A missing elevation tile only leaves that patch flat; the map and any tour carry on.
      if (terrainSourceIds.has(event.sourceId) && isTerrainTileFailure(event)) {
        if (!this.terrainTileWarned) console.warn("Some 3D terrain tiles could not load.", event.error);
        this.terrainTileWarned = true;
        return;
      }
      const record = this.#records.get(String(event.sourceId).slice("gismap-".length));
      const message = event.sourceId === "gismap-usgs-basemap"
        ? "USGS imagery could not be loaded. The fallback basemap remains available; check the provider or choose another basemap."
        : terrainSourceIds.has(event.sourceId)
        ? `3D terrain could not load: ${event.error?.message || "unknown error"}. You can continue with flat ground.`
        : `Could not draw ${record?.title || "a layer"}: ${event.error?.message || "unknown error"}`;
      // Every failing tile reports; say it once every few seconds.
      if (this.lastDrawError === message) return;
      this.lastDrawError = message;
      setTimeout(() => { if (this.lastDrawError === message) this.lastDrawError = null; }, 5000);
      this.events.publish("app:error", { message });
    });
  }

  destroy() {
    if (this.measurement) this.toggleWidget("measurement");
    if (this.legendHost) this.toggleWidget("legend");
    if (this.basemapGallery) this.toggleWidget("basemapGallery");
    this.three?.clear();
    this.map?.remove();
    this.map = null;
    this.three = null;
    this.#records.clear();
  }

  isReady() {
    return Boolean(this.map);
  }

  async whenReady() {
    await this.#loaded;
  }

  getCapabilities() {
    return [...MAPLIBRE_CAPABILITIES];
  }

  /** The MapLibre map itself, for custom tools (gisMapOnline.map). There is no SceneView. */
  native() {
    return { engine: this.id, map: this.map, view: null, layers: () => [] };
  }

  /**
   * Add an optional cinematic effect to the one shared ThreeHost. This is
   * intentionally data-in / data-out: the cinematic controller owns timing,
   * while the effect only draws the currently observed GeoJSON geometries.
   */
  async setCinematicEffect(uid, effect = {}) {
    const id = String(uid || "");
    // "observed-boundary-glow" is the v0.1 name for the glow effect.
    const name = effect.type === "observed-boundary-glow" ? "glow" : effect.effect;
    if (!id || !["observed-effect", "observed-boundary-glow"].includes(effect.type) || !name || name === "none") return false;
    const revision = this.#nextCinematicEffectRevision(id);
    if (effect.settled === true) return this.#drawSettledEdges(id, name, effect, revision);
    if (name === "strata") return this.#drawStrataEffect(id, effect, revision);
    if (name === "extrude" || name === "reveal") return this.#drawNativeEffect(id, name, effect, revision);
    const THREE = await loadThree();
    if (!this.#cinematicEffectIsCurrent(id, revision)) return false;
    // A track switched from a native effect (Rise, Reveal, Strata) leaves no layers behind.
    this.#removeNativeEffect(id);
    this.three ??= new ThreeHost({ map: this.map, THREE, notify: (message) => this.events.publish("app:error", { message }) });
    const [{ buildCinematicEffect }, { effectColor }] = await Promise.all([import("../../cinematic/effects-three.js?v=0.69.9-order"), import("../../cinematic/cinematic-effects.js?v=0.69.9-order")]);
    if (!this.#cinematicEffectIsCurrent(id, revision)) return false;
    // Decoration is simplified to half a screen pixel at the current zoom; the map draws the exact outline.
    const simplify = Number.isFinite(effect.simplify) ? effect.simplify : 0.5 * 360 / (512 * 2 ** (this.map?.getZoom?.() ?? 0));
    const item = buildCinematicEffect(THREE, effect.items || effect.features || [], {
      // The skin picks the palette when the effect has no colour of its own.
      effect: name, color: effectColor(name, { color: effect.color, skin: globalThis.document?.documentElement?.dataset?.skin }), intensity: effect.intensity, fields: effect.fields, ranges: effect.ranges,
      quality: effect.quality || "cinematic", simplify, timing: effect.timing || null,
      reducedMotion: globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true,
      elevationAt: (longitude, latitude) => (this.map?.getTerrain?.() ? this.map.queryTerrainElevation?.([longitude, latitude]) || 0 : 0),
    });
    if (!item) {
      if (this.#cinematicEffectIsCurrent(id, revision)) this.three.remove(id);
      return false;
    }
    if (!this.#cinematicEffectIsCurrent(id, revision)) return false;
    this.three.add(id, item);
    return true;
  }

  /** Draw one frame of the effects (their clock was paused, seeked or sped up). */
  requestEffectFrame() {
    this.map?.triggerRepaint?.();
    this.#runNativeEffects(true);
  }

  clearCinematicEffect(uid) {
    const id = String(uid || "");
    this.#nextCinematicEffectRevision(id);
    this.three?.remove(id);
    this.#removeSettledEdges(id);
    this.#removeNativeEffect(id);
  }

  #nextCinematicEffectRevision(id) {
    const next = (this.#cinematicEffectRevisions.get(id) || 0) + 1;
    this.#cinematicEffectRevisions.set(id, next);
    return next;
  }

  #cinematicEffectIsCurrent(id, revision) { return this.#cinematicEffectRevisions.get(id) === revision; }

  #nativeEffects = new Map();
  #nativeFrame = null;
  #effectClockRunning = () => true;

  /**
   * Rise (fill-extrusion to each feature's value) and Reveal (features fading in
   * by order) as plain MapLibre layers. One paint value follows the track's time
   * on the master clock, so pause, seek and export agree; data stay unchanged.
   */
  async #drawNativeEffect(id, name, effect, revision) {
    const [{ effectColor, nativeEffectData, valueField, riseAmount, revealAmount }, { effectSeconds, effectClockRunning }, { trackTime, normalizeTiming }] = await Promise.all([
      import("../../cinematic/cinematic-effects.js?v=0.69.9-order"), import("../../cinematic/effects-three.js?v=0.69.9-order"), import("../../cinematic/clock.js?v=0.1.0"),
    ]);
    if (!this.#cinematicEffectIsCurrent(id, revision)) return false;
    this.#effectClockRunning = effectClockRunning;
    this.three?.remove(id);
    if (this.#nativeEffects.get(id)?.kind === "strata") this.#removeNativeEffect(id);
    const items = effect.items || [];
    const first = items[0]?.feature ?? items[0];
    const field = effect.field || (name === "extrude" ? valueField(effect.fields || [], first?.attributes || first?.properties || {}) : null);
    const { data, stats } = nativeEffectData(items, { field });
    if (!this.map || !stats.count || (name === "extrude" && !stats.withValue)) { this.#removeNativeEffect(id); return false; }
    const sourceId = `${NATIVE_EFFECT_PREFIX}${id}`;
    if (this.map.getSource(sourceId)) this.map.getSource(sourceId).setData(data);
    else this.map.addSource(sourceId, { type: "geojson", data });
    const color = effectColor(name, { color: effect.color, skin: globalThis.document?.documentElement?.dataset?.skin });
    const strength = Math.min(2, Math.max(0.25, Number(effect.intensity) || 1));
    const polygons = ["match", ["geometry-type"], ["Polygon", "MultiPolygon"], true, false];
    const lines = ["match", ["geometry-type"], ["LineString", "MultiLineString"], true, false];
    const points = ["match", ["geometry-type"], ["Point", "MultiPoint"], true, false];
    const layers = name === "extrude"
      ? [{ id: `${sourceId}:extrude`, type: "fill-extrusion", filter: polygons, paint: { "fill-extrusion-color": ["interpolate", ["linear"], ["get", "v"], 0, "#dfe8f7", 1, color], "fill-extrusion-opacity": 0.86, "fill-extrusion-base": 0, "fill-extrusion-height": 0 } }]
      : [
        { id: `${sourceId}:fill`, type: "fill", filter: polygons, paint: { "fill-color": color, "fill-opacity": 0 } },
        { id: `${sourceId}:line`, type: "line", filter: ["any", lines, polygons], paint: { "line-color": color, "line-width": 2, "line-opacity": 0 } },
        { id: `${sourceId}:points`, type: "circle", filter: points, paint: { "circle-color": color, "circle-radius": 5, "circle-stroke-color": "#fff", "circle-stroke-width": 1, "circle-opacity": 0, "circle-stroke-opacity": 0 } },
      ];
    const before = this.map.getLayer(THREE_LAYER_ID) ? THREE_LAYER_ID : undefined;
    for (const layer of layers) if (!this.map.getLayer(layer.id)) this.map.addLayer({ ...layer, source: sourceId }, before);
    const timing = normalizeTiming(effect.timing);
    // Heights in metres sized to the view when drawn (redrawn on zoom changes).
    const maxHeight = (3_000_000 / 2 ** (this.map.getZoom?.() ?? 4)) * strength;
    const holdAfter = name === "extrude" ? 3 : 8;
    const apply = () => {
      if (!this.map?.getSource(sourceId)) return { settled: true };
      const local = trackTime(effectSeconds(), timing);
      if (name === "extrude") {
        this.map.setPaintProperty(`${sourceId}:extrude`, "fill-extrusion-height", ["*", ["get", "v"], maxHeight * riseAmount(local, timing.cycleSeconds)]);
      } else {
        const reach = revealAmount(local, timing.cycleSeconds) * 1.05;
        const shown = ["interpolate", ["linear"], ["get", "order"], reach - 0.04, 1, reach, 0];
        this.map.setPaintProperty(`${sourceId}:fill`, "fill-opacity", ["*", 0.45 * Math.min(1, strength), shown]);
        this.map.setPaintProperty(`${sourceId}:line`, "line-opacity", shown);
        this.map.setPaintProperty(`${sourceId}:points`, "circle-opacity", ["*", 0.9, shown]);
        this.map.setPaintProperty(`${sourceId}:points`, "circle-stroke-opacity", shown);
      }
      return { settled: local.settled || (timing.cycleSeconds === 0 && local.seconds >= holdAfter) };
    };
    this.#nativeEffects.set(id, { apply, layers: layers.map((layer) => layer.id), sourceId });
    apply();
    this.#runNativeEffects(true);
    return true;
  }

  /**
   * The Strata timeline: every record of the track is in one source, built
   * once; each step only changes which slabs show. Older records sit settled
   * in their slots and the step's new ones fall onto the stack. The layer's
   * own 3D chart is hidden meanwhile so its slabs are not drawn twice.
   */
  async #drawStrataEffect(id, effect, revision) {
    const [{ effectColor, strataData, strataLanding }, { effectSeconds, effectClockRunning }] = await Promise.all([
      import("../../cinematic/cinematic-effects.js?v=0.69.9-order"), import("../../cinematic/effects-three.js?v=0.69.9-order"),
    ]);
    if (!this.#cinematicEffectIsCurrent(id, revision) || !this.map) return false;
    this.#effectClockRunning = effectClockRunning;
    this.three?.remove(id);
    const sourceId = `${NATIVE_EFFECT_PREFIX}${id}`;
    const color = effectColor("strata", { color: effect.color, skin: globalThis.document?.documentElement?.dataset?.skin });
    let current = this.#nativeEffects.get(id);
    if (current && current.kind !== "strata") { this.#removeNativeEffect(id); current = null; }
    const key = `${effect.color || ""}|${color}|${JSON.stringify(effect.chart || null)}`;
    if (current?.kind !== "strata" || current.stack !== effect.stack || current.key !== key) {
      const { data, stats } = strataData(effect.stack || [], { chart: effect.chart, ticks: effect.ticks || [], color: effect.color || null, fallbackColor: color });
      if (!stats.count) { this.#removeNativeEffect(id); return false; }
      if (this.map.getSource(sourceId)) this.map.getSource(sourceId).setData(data);
      else this.map.addSource(sourceId, { type: "geojson", data });
      current = { kind: "strata", stack: effect.stack, key, sourceId, layers: [`${sourceId}:strata`, `${sourceId}:strata-fresh`], layerUid: effect.layerUid || null, drop: stats.stride * 4, apply: () => ({ settled: true }) };
      const before = this.map.getLayer(THREE_LAYER_ID) ? THREE_LAYER_ID : undefined;
      const paint = { "fill-extrusion-color": ["get", "color"], "fill-extrusion-base": ["get", "base"], "fill-extrusion-height": ["get", "top"], "fill-extrusion-opacity": 0.82, "fill-extrusion-vertical-gradient": true };
      for (const layerId of current.layers) if (!this.map.getLayer(layerId)) this.map.addLayer({ id: layerId, type: "fill-extrusion", source: sourceId, filter: ["in", ["id"], ["literal", []]], paint }, before);
      this.#nativeEffects.set(id, current);
      this.#setStrataHidden(current.layerUid, id);
    }
    // Which slabs show now: settled ones, and this step's new ones (which fall into place).
    const fresh = [], settled = [];
    for (const item of effect.items || []) (item.fresh ? fresh : settled).push(item.index);
    this.map.setFilter(current.layers[0], ["in", ["id"], ["literal", settled]]);
    this.map.setFilter(current.layers[1], ["in", ["id"], ["literal", fresh]]);
    const startedAt = effectSeconds();
    const speed = Math.min(3, Math.max(0.1, Number(effect.speed) || 1));
    const reduced = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
    const { drop } = current;
    current.apply = () => {
      if (!this.map?.getLayer(current.layers[1])) return { settled: true };
      // A paused effects clock (or reduced motion) shows the step already landed.
      const landed = reduced || !effectClockRunning() ? 1 : strataLanding(effectSeconds() - startedAt, { speed });
      const lift = drop * (1 - landed);
      this.map.setPaintProperty(current.layers[1], "fill-extrusion-base", ["+", ["get", "base"], lift]);
      this.map.setPaintProperty(current.layers[1], "fill-extrusion-height", ["+", ["get", "top"], lift]);
      this.map.setPaintProperty(current.layers[1], "fill-extrusion-opacity", 0.25 + 0.7 * landed);
      return { settled: landed >= 1 };
    };
    current.apply();
    this.#runNativeEffects(true);
    return true;
  }

  /** Hides (effectId) or shows again (null) a layer's own 3D chart while a Strata timeline draws it. */
  #setStrataHidden(uid, effectId) {
    const record = uid ? this.#record(uid) : null;
    if (!record || record.kind !== "vector") return;
    record.strataEffect = effectId;
    this.#refresh(record);
  }

  /** One small loop for every native effect, only while one is still moving and the clock runs. */
  #runNativeEffects(force = false) {
    if (this.#nativeFrame != null || !this.#nativeEffects.size) return;
    let last = 0;
    const tick = (time = 0) => {
      this.#nativeFrame = null;
      // ~30 updates a second is smooth for a rise or a fade and halves the style work.
      if (time - last < 32) { this.#nativeFrame = requestAnimationFrame(tick); return; }
      last = time;
      let moving = false;
      for (const effect of this.#nativeEffects.values()) moving = !effect.apply().settled || moving;
      if (moving && this.#effectClockRunning()) this.#nativeFrame = requestAnimationFrame(tick);
    };
    if (force || this.#effectClockRunning()) this.#nativeFrame = requestAnimationFrame(tick);
  }

  #removeNativeEffect(id) {
    const effect = this.#nativeEffects.get(id);
    this.#nativeEffects.delete(id);
    const sourceId = effect?.sourceId || `${NATIVE_EFFECT_PREFIX}${id}`;
    for (const record of this.#records.values()) if (record.strataEffect === id) this.#setStrataHidden(record.uid, null);
    if (!this.map?.getSource?.(sourceId)) return;
    for (const suffix of [":extrude", ":fill", ":line", ":points", ":strata", ":strata-fresh"]) if (this.map.getLayer(`${sourceId}${suffix}`)) this.map.removeLayer(`${sourceId}${suffix}`);
    this.map.removeSource(sourceId);
  }

  /**
   * A settled build-up (older records, edge only) drawn as plain MapLibre
   * line and circle layers with a soft halo: no custom GL, nothing animating,
   * and far cheaper than shader ribbons for thousands of outlines.
   */
  async #drawSettledEdges(id, name, effect, revision) {
    const { effectColor, effectParts } = await import("../../cinematic/cinematic-effects.js?v=0.69.9-order");
    if (!this.#cinematicEffectIsCurrent(id, revision)) return false;
    this.three?.remove(id);
    const simplify = Number.isFinite(effect.simplify) ? effect.simplify : 0.5 * 360 / (512 * 2 ** (this.map?.getZoom?.() ?? 0));
    const parts = effectParts(effect.items || [], { maxPaths: 20000, maxVertices: 400000, maxPoints: 20000, simplify });
    const features = [
      ...parts.paths.map((path) => ({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: path.coordinates } })),
      ...parts.points.map((point) => ({ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: point.coordinates } })),
    ];
    if (!this.map || !features.length) { this.#removeSettledEdges(id); return false; }
    const sourceId = `${SETTLED_EDGES_PREFIX}${id}`;
    const data = { type: "FeatureCollection", features };
    const color = effectColor(name, { color: effect.color, skin: globalThis.document?.documentElement?.dataset?.skin });
    const strength = Math.min(1, Math.max(0.3, Number(effect.intensity) || 1));
    if (this.map.getSource(sourceId)) this.map.getSource(sourceId).setData(data);
    else this.map.addSource(sourceId, { type: "geojson", data, tolerance: 0.6 });
    const before = this.map.getLayer(THREE_LAYER_ID) ? THREE_LAYER_ID : undefined;
    const lines = ["==", ["geometry-type"], "LineString"], points = ["==", ["geometry-type"], "Point"];
    const zoomed = (low, high) => ["interpolate", ["linear"], ["zoom"], 3, low, 14, high];
    const layers = [
      { id: `${sourceId}:halo`, type: "line", filter: lines, layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": color, "line-width": zoomed(1.2, 9), "line-blur": zoomed(1, 6), "line-opacity": 0.16 * strength } },
      { id: `${sourceId}:core`, type: "line", filter: lines, layout: { "line-join": "round" }, paint: { "line-color": color, "line-width": zoomed(0.4, 1.4), "line-opacity": 0.5 * strength } },
      { id: `${sourceId}:points`, type: "circle", filter: points, paint: { "circle-color": color, "circle-radius": zoomed(2, 8), "circle-blur": 0.8, "circle-opacity": 0.3 * strength } },
    ];
    for (const layer of layers) {
      if (!this.map.getLayer(layer.id)) this.map.addLayer({ ...layer, source: sourceId }, before);
      else for (const [key, value] of Object.entries(layer.paint)) this.map.setPaintProperty(layer.id, key, value);
    }
    return true;
  }

  #removeSettledEdges(id) {
    const sourceId = `${SETTLED_EDGES_PREFIX}${id}`;
    if (!this.map?.getSource?.(sourceId)) return;
    for (const suffix of [":halo", ":core", ":points"]) if (this.map.getLayer(`${sourceId}${suffix}`)) this.map.removeLayer(`${sourceId}${suffix}`);
    this.map.removeSource(sourceId);
  }

  /** Effect load and frame timing for Cinematic's adaptive detail (null before any effect). */
  getCinematicEffectStats({ reset = false } = {}) {
    const three = this.three?.stats({ reset }) ?? null;
    // Native effects (Rise, Reveal, settled edges) are style layers: counted, not timed.
    const native = this.#nativeEffects.size + (this.map?.getStyle?.()?.layers || []).filter((layer) => layer.id.startsWith(SETTLED_EDGES_PREFIX) && layer.id.endsWith(":core")).length;
    return three || native ? { items: 0, vertices: 0, ...(three || {}), native } : null;
  }

  resize() {
    this.map?.resize();
  }

  getContainer() {
    return this.map?.getContainer() ?? null;
  }

  /** Screen pixels (relative to the container) of [longitude, latitude, z]. */
  /** Reads a PMTiles/TileJSON/XYZ source's layers and fields without adding it to the map. */
  inspectExternalTiles(value, options = {}) {
    return inspectExternalTiles(value, { ...options, maplibre: globalThis.maplibregl });
  }

  /** With `aboveGround`, Z is metres above the terrain rather than above sea level. */
  mapToScreen([longitude, latitude, z = null, aboveGround = false] = []) {
    if (!this.map || !Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;
    // An altitude needs the camera's 3D pixel matrix; map.project() only knows the ground.
    const transform = this.map.transform;
    const matrix = transform?.pixelMatrix3D ?? transform?._pixelMatrix3D;
    const Mercator = globalThis.maplibregl?.MercatorCoordinate;
    // No Z: on the ground, which map.project() places on the terrain.
    if (z !== null && z !== undefined && typeof transform?.coordinatePoint === "function" && matrix && Mercator) {
      const exaggeration = this.map.getTerrain?.()?.exaggeration ?? 1;
      // The terrain's own height is already exaggerated as drawn.
      const ground = aboveGround ? (this.map.queryTerrainElevation?.([longitude, latitude]) ?? 0) : 0;
      const point = transform.coordinatePoint(Mercator.fromLngLat([longitude, latitude]), ground + (Number(z) || 0) * exaggeration, matrix);
      if (Number.isFinite(point?.x) && Number.isFinite(point?.y)) return { x: point.x, y: point.y };
    }
    const point = this.map.project([longitude, latitude]);
    return { x: point.x, y: point.y };
  }

  /** [longitude, latitude, z] under a container pixel. */
  screenToMap(x, y) {
    if (!this.map) return null;
    const { lng, lat } = this.map.unproject([x, y]);
    const z = this.map.queryTerrainElevation?.([lng, lat]) ?? 0;
    return [lng, lat, Number.isFinite(z) ? z : 0];
  }

  /* ---------------- Basemap ---------------- */

  setInitialBasemap(id) {
    if (this.map || !id) return;
    this.initialBasemapId = String(id);
    this.basemapId = this.initialBasemapId;
  }

  setDefaultBasemap(id) {
    this.defaultBasemapId = String(id || "topo-3d");
    if (!this.map && !this.initialBasemapId) this.basemapId = this.defaultBasemapId;
  }

  getDefaultBasemapId() {
    return this.defaultBasemapId;
  }

  getBasemapId() {
    return this.basemapId;
  }

  getGroundOptions() {
    return { selected: this.groundId, options: MAPLIBRE_GROUNDS.map(({ id, label }) => ({ id, label })) };
  }

  setGround(id) {
    const next = maplibreGround(id).id;
    if (next === this.groundId && this.map?.getTerrain?.()) return;
    this.groundId = next;
    if (this.map) void this.#applyGround();
    this.events.publish("map:ground-changed", { id: this.groundId });
  }

  getGroundId() {
    return this.groundId;
  }

  /** Adds or removes the open DEM, subtle hillshade and sky after a style is ready. */
  async #applyGround({ styleReady = false } = {}) {
    if (!this.map) return;
    if (!styleReady && !this.map.isStyleLoaded?.()) {
      await new Promise((resolve) => { this.map.once("style.load", resolve); setTimeout(resolve, 10000); });
      if (!this.map) return;
    }
    const option = maplibreGround(this.groundId);
    if (!option.terrain) {
      this.map.setTerrain?.(null);
      this.map.setSky?.(null);
      if (this.map.getLayer?.(HILLSHADE_LAYER_ID)) this.map.removeLayer(HILLSHADE_LAYER_ID);
      if (this.map.getSource?.(HILLSHADE_SOURCE_ID)) this.map.removeSource(HILLSHADE_SOURCE_ID);
      if (this.map.getSource?.(TERRAIN_SOURCE_ID)) this.map.removeSource(TERRAIN_SOURCE_ID);
      return;
    }
    if (!this.map.getSource?.(TERRAIN_SOURCE_ID)) this.map.addSource(TERRAIN_SOURCE_ID, terrainSource());
    if (!this.map.getSource?.(HILLSHADE_SOURCE_ID)) this.map.addSource(HILLSHADE_SOURCE_ID, terrainSource());
    if (!this.map.getLayer?.(HILLSHADE_LAYER_ID)) {
      const before = this.map.getStyle?.()?.layers?.find((layer) => layer.type === "symbol")?.id || null;
      const spec = hillshadeLayer();
      this.map.addLayer(spec, before || undefined);
    }
    this.map.setTerrain?.({ source: TERRAIN_SOURCE_ID, exaggeration: option.exaggeration });
    this.map.setSky?.({});
  }

  /** The basemaps this engine draws, and the one it is drawing now (an ArcGIS id from a link shows as its open equivalent). */
  attachConsoleOverlay({ post }) {
    if (!this.map) return null;
    const basemaps = this.getBasemapOptions().options.map(({ id, title, label, name }) => ({ id, label: title || label || name || id }));
    return createConsoleBridge({ map: this.map, post, basemaps, setBasemap: (id) => this.setBasemap(id) });
  }

  getBasemapOptions() {
    return { selected: basemapOnEngine(this.basemapId, "maplibre"), options: basemapsForEngine("maplibre") };
  }

  setBasemap(id) {
    const next = id || "topo-3d";
    if (!this.map && this.initialBasemapId) return;
    if (this.map && next === this.basemapId) return;
    const previous = openBasemapFor(this.basemapId);
    this.basemapId = next;
    const upcoming = openBasemapFor(next);
    if (this.map && (upcoming.themed || previous.themed || upcoming.key !== previous.key)) void this.#applyStyle();
    this.basemapGallery?.update();
    this.events.publish("map:basemap-changed", { id: this.basemapId });
  }

  /**
   * The colours of the active skin (basemap-themes.js themeFromTokens): the
   * "skin" basemap is drawn with them, and data layers without a style of
   * their own take the theme's accent.
   */
  /** Shows or hides the basemap's 3D buildings (on unless turned off). */
  setBuildings3d(on = true) {
    this.buildings3d = on !== false;
    if (this.map?.getLayer?.("building-3d")) this.map.setLayoutProperty("building-3d", "visibility", this.buildings3d ? "visible" : "none");
  }

  setBasemapTheme(theme) {
    this.basemapTheme = theme || null;
    for (const record of this.#records.values()) if (record.kind === "vector" && !record.renderer && !record.serviceRenderer) this.#refresh(record);
    if (this.map && openBasemapFor(this.basemapId).themed) void this.#applyStyle();
  }

  #dataColor() {
    return this.basemapTheme?.accent || DEFAULT_COLOR;
  }

  /**
   * The style for a basemap id: the OpenFreeMap style with 3D buildings, and
   * for "skin" restyled with the theme (buildings included).
   */
  async #styleFor(id) {
    const basemap = openBasemapFor(id);
    if (!this.#styleJson.has(basemap.style)) {
      this.#styleJson.set(basemap.style, fetch(basemap.style).then((response) => {
        if (!response.ok) throw new Error(`The basemap style did not load (HTTP ${response.status}).`);
        return response.json();
      }).catch((error) => { this.#styleJson.delete(basemap.style); throw error; }));
    }
    try {
      let style = withBuildings3d(await this.#styleJson.get(basemap.style), { visible: this.buildings3d !== false });
      if (basemap.raster) style = withUsgsImagery(style, basemap.raster);
      return basemap.themed && this.basemapTheme ? applyBasemapTheme(style, this.basemapTheme) : style;
    } catch {
      if (basemap.raster) return withUsgsImagery({ version: 8, sources: {}, layers: [{ id: "fallback-background", type: "background", paint: { "background-color": "#e8e7dc" } }] }, basemap.raster);
      return basemap.style;
    }
  }

  /** Swaps in the current basemap's style, carrying the data layers over (only what changed is redrawn). */
  async #applyStyle() {
    const token = ++this.#styleToken;
    const style = await this.#styleFor(this.basemapId);
    // A style still loading cannot be diffed (MapLibre would rebuild from scratch); wait for it.
    if (this.map && !this.map.isStyleLoaded()) await new Promise((resolve) => { this.map.once("style.load", resolve); setTimeout(resolve, 10000); });
    if (token !== this.#styleToken || !this.map) return;
    this.map.once?.("style.load", () => { if (token === this.#styleToken) { void this.#applyGround({ styleReady: true }); this.three?.attach(); } });
    this.map.setStyle(style, {
      diff: true,
      transformStyle: (previous, incoming) => {
        // Native cinematic effects (Rise, Reveal, Strata, settled edges) carry over as they are drawn now: filters and paint included.
        const effectSource = (id) => [NATIVE_EFFECT_PREFIX, SETTLED_EDGES_PREFIX].some((prefix) => String(id || "").startsWith(prefix));
        const effectSources = Object.entries(previous?.sources || {}).filter(([id]) => effectSource(id));
        const effectLayers = (previous?.layers || []).filter((layer) => effectSource(layer.source));
        return {
          ...incoming,
          sources: { ...incoming.sources, [HIGHLIGHT_SOURCE]: this.#highlightSource(), [DRAW_SOURCE]: this.#drawingSource(), ...(this.measurement ? { [MEASURE_SOURCE]: this.#measureSource() } : {}), ...Object.fromEntries([...this.#records.values()].filter((record) => record.kind !== "three").map((record) => [this.#sourceId(record), this.#sourceSpec(record)])), ...Object.fromEntries(effectSources) },
          layers: [...incoming.layers, ...[...this.#records.values()].filter((record) => record.kind !== "three").flatMap((record) => this.#layerSpecs(record)), ...effectLayers, ...this.#drawingSpecs(), ...(this.measurement ? this.#measureSpecs() : []), ...this.#highlightSpecs()],
        };
      },
    });
  }

  async whenBasemapLoaded(timeout = 15000) {
    if (!this.map) return;
    await Promise.race([
      this.map.loaded() ? Promise.resolve() : new Promise((resolve) => this.map.once("idle", resolve)),
      new Promise((resolve) => setTimeout(resolve, timeout)),
    ]);
  }

  /* ---------------- Layers ---------------- */

  #record(ref) {
    if (ref == null) return null;
    return this.#records.get(typeof ref === "object" ? ref.uid : String(ref)) ?? null;
  }

  #require(ref) {
    const record = this.#record(ref);
    if (!record) throw new GisMapError("NOT_FOUND", "That layer is not on the map.");
    return record;
  }

  #requireVector(ref) {
    const record = this.#require(ref);
    if (record.kind === "tiles") throw new GisMapError("UNSUPPORTED_LAYER_TYPE", `${record.title || "This layer"} is a vector tile layer; its features arrive tile by tile and cannot be queried or restyled here yet.`);
    if (record.kind !== "vector") throw new GisMapError("UNSUPPORTED_LAYER_TYPE", `${record.title || "This layer"} is drawn by its service as an image; it has no features to query or restyle here.`);
    return record;
  }

  #sourceId(record) { return `gismap-${record.uid}`; }

  #visibleFeatures(record) {
    if (!record.where) return record.features;
    const matches = compileWhere(record.where);
    return record.features.filter((feature) => matches(feature.properties));
  }

  #sourceSpec(record) {
    if (record.kind === "raster") {
      return { type: "raster", tiles: record.tiles.urls, tileSize: record.tiles.tileSize || 256, ...(record.tiles.maxzoom != null ? { maxzoom: record.tiles.maxzoom } : {}), ...(record.attribution ? { attribution: record.attribution } : {}) };
    }
    if (record.kind === "tiles") {
      const { tiles, minzoom, maxzoom, bounds } = record.tiles;
      return { type: "vector", tiles, ...(Number.isFinite(minzoom) ? { minzoom } : {}), ...(Number.isFinite(maxzoom) ? { maxzoom } : {}), ...(bounds ? { bounds } : {}), ...(record.attribution ? { attribution: record.attribution } : {}) };
    }
    return { type: "geojson", data: { type: "FeatureCollection", features: this.#visibleFeatures(record) } };
  }

  /** The publisher's scale range as MapLibre zooms (ignored when the person chose "Show anyway"). */
  #zoomRange(record) {
    if (record.ignoreScaleRange) return { minzoom: 0, maxzoom: 24 };
    return {
      minzoom: record.minScale > 0 ? Math.max(0, toEngineZoom(zoomForScale(record.minScale))) : 0,
      maxzoom: record.maxScale > 0 ? Math.min(24, toEngineZoom(zoomForScale(record.maxScale))) : 24,
    };
  }

  /** The style a vector layer draws with: its GISMap Online style, else its service's own, else the skin's accent. */
  #paintFor(record) {
    if (record.renderer) return rendererToPaint(record.renderer);
    if (record.serviceRenderer) return rendererToPaint(record.serviceRenderer, { transparency: record.transparency });
    return null;
  }

  /** The MapLibre layers that draw one data layer: an image, or fill and outline, lines, and points. */
  #layerSpecs(record) {
    const source = this.#sourceId(record);
    const visibility = record.visible ? "visible" : "none";
    const opacity = record.opacity;
    const range = this.#zoomRange(record);
    if (record.kind === "raster") {
      return [{ id: `${source}-raster`, type: "raster", source, ...range, layout: { visibility }, paint: { "raster-opacity": opacity * (1 - (record.transparency || 0) / 100) } }];
    }
    if (record.kind === "tiles") return this.#tileLayerSpecs(record, { source, visibility, opacity, range });
    const color = this.#dataColor();
    const halo = this.basemapTheme?.labelHalo || "#ffffff";
    const styled = this.#paintFor(record) || {};
    const scaled = (paint, keys) => Object.fromEntries(Object.entries(paint).map(([key, value]) => [key, keys.includes(key) ? value * opacity : value]));
    const featureFilter = record.featureFilter ? ["in", ["id"], ["literal", record.featureFilter]] : null;
    const filtered = (types) => {
      const base = ["match", ["geometry-type"], types, true, false];
      return featureFilter ? ["all", base, featureFilter] : base;
    };
    const fill = scaled({ "fill-color": color, "fill-opacity": styled.fill ? 1 : 0.35, ...styled.fill }, ["fill-opacity"]);
    const outline = scaled({ "line-color": color, "line-width": 1.5, "line-opacity": 1, ...styled.outline }, ["line-opacity"]);
    const line = scaled({ "line-color": color, "line-width": 2.5, "line-opacity": 1, ...styled.line }, ["line-opacity"]);
    const circle = scaled({ "circle-color": color, "circle-radius": 4.5, "circle-stroke-color": halo, "circle-stroke-width": 1.5, "circle-opacity": 1, "circle-stroke-opacity": 1, ...styled.circle }, ["circle-opacity", "circle-stroke-opacity"]);
    const symbol = record.renderer?.symbol || record.renderer?.classBreakInfos?.[0]?.symbol || record.renderer?.uniqueValueInfos?.[0]?.symbol;
    const extrusion = symbol?.symbolLayers?.find((item) => String(item.type).toLowerCase() === "extrude");
    const variable = record.renderer?.visualVariables?.find((item) => /^(size|sizeinfo)$/i.test(item.type));
    const expression = String(variable?.valueExpression || "");
    const match = expression.match(/^\$feature\[("(?:[^"\\]|\\.)*")\]\s*\*\s*((?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)$/i);
    const field = variable?.field || (match ? JSON.parse(match[1]) : null);
    const height = field ? ["max", 0, ["*", ["to-number", ["get", field], 0], match ? Number(match[2]) : 1]] : Math.max(0, Number(extrusion?.size) || 0);
    const chart = record.spatialChart;
    // A Strata timeline draws this layer's slabs itself. Footprint outlines on the
    // ground under a chart or Strata stack show only when the chart asks for them.
    const stacked = Boolean(record.strataEffect);
    const fillVisibility = extrusion || chart || stacked ? "none" : visibility;
    const outlineVisibility = (chart || stacked) && !chart?.groundOutlines ? "none" : visibility;
    const specs = [
      { id: `${source}-fill`, type: "fill", source, ...range, filter: filtered(["Polygon", "MultiPolygon"]), layout: { visibility: fillVisibility }, paint: fill },
      { id: `${source}-extrusion`, type: "fill-extrusion", source, ...range, filter: filtered(["Polygon", "MultiPolygon"]), layout: { visibility: extrusion && !chart && !stacked ? visibility : "none" }, paint: { "fill-extrusion-color": fill["fill-color"], "fill-extrusion-height": height, "fill-extrusion-base": 0, "fill-extrusion-opacity": opacity } },
      { id: `${source}-outline`, type: "line", source, ...range, filter: filtered(["Polygon", "MultiPolygon"]), layout: { visibility: outlineVisibility }, paint: outline },
      { id: `${source}-line`, type: "line", source, ...range, filter: filtered(["LineString", "MultiLineString"]), layout: { visibility, "line-cap": "round", "line-join": "round" }, paint: line },
      { id: `${source}-circle`, type: "circle", source, ...range, filter: filtered(["Point", "MultiPoint"]), layout: { visibility }, paint: circle },
    ];
    if (chart) specs.push(...spatialChartLayerSpecs({ chart, idPrefix: source, source, range, visibility: stacked ? "none" : visibility, opacity, polygonFilter: ["match", ["geometry-type"], ["Polygon", "MultiPolygon"], true, false], featureFilter, originalColor: fill["fill-color"] }));
    return specs;
  }

  /**
   * Vector tiles carry no geometry type in their metadata, so every source layer
   * gets fill, outline, line and circle layers filtered by each feature's geometry.
   */
  #tileLayerSpecs(record, { source, visibility, opacity, range }) {
    const color = this.#dataColor();
    const halo = this.basemapTheme?.labelHalo || "#ffffff";
    const polygons = ["match", ["geometry-type"], ["Polygon", "MultiPolygon"], true, false];
    return record.sourceLayers.flatMap((name, index) => {
      const id = `${source}-${index}`;
      const common = { source, "source-layer": name, ...range };
      return [
        { id: `${id}-fill`, type: "fill", ...common, filter: polygons, layout: { visibility }, paint: { "fill-color": color, "fill-opacity": 0.35 * opacity } },
        { id: `${id}-outline`, type: "line", ...common, filter: polygons, layout: { visibility }, paint: { "line-color": color, "line-width": 1.5, "line-opacity": opacity } },
        { id: `${id}-line`, type: "line", ...common, filter: ["match", ["geometry-type"], ["LineString", "MultiLineString"], true, false], layout: { visibility, "line-cap": "round", "line-join": "round" }, paint: { "line-color": color, "line-width": 2.5, "line-opacity": opacity } },
        { id: `${id}-circle`, type: "circle", ...common, filter: ["match", ["geometry-type"], ["Point", "MultiPoint"], true, false], layout: { visibility }, paint: { "circle-color": color, "circle-radius": 4.5, "circle-stroke-color": halo, "circle-stroke-width": 1.5, "circle-opacity": opacity, "circle-stroke-opacity": opacity } },
      ];
    });
  }

  #layerIds(record) {
    if (record.kind === "three") return [];
    if (record.kind === "tiles" && !record.renderLayerIds?.length) return this.#layerSpecs(record).map((spec) => spec.id);
    return record.renderLayerIds?.length ? [...record.renderLayerIds] : record.kind === "raster" ? [`${this.#sourceId(record)}-raster`] : ["fill", "extrusion", "outline", "line", "circle"].map((suffix) => `${this.#sourceId(record)}-${suffix}`);
  }

  #rebuildRecordLayers(record) {
    for (const id of this.#layerIds(record)) if (this.map?.getLayer(id)) this.map.removeLayer(id);
    const specs = this.#layerSpecs(record);
    for (const spec of specs) this.map.addLayer(spec);
    record.renderLayerIds = specs.map((spec) => spec.id);
  }

  /** Redraws a layer after its data, filter, range or style changed. */
  #refresh(record, { data = false } = {}) {
    if (record.kind === "three") {
      this.three?.set(record.uid, { visible: record.visible, opacity: record.opacity });
      this.#renderLegend();
      return;
    }
    if (!this.map?.getSource(this.#sourceId(record))) return;
    if (data && record.kind === "vector") this.map.getSource(this.#sourceId(record)).setData(this.#sourceSpec(record).data);
    for (const spec of this.#layerSpecs(record)) {
      if (!this.map.getLayer(spec.id)) continue;
      if (spec.filter) this.map.setFilter(spec.id, spec.filter);
      this.map.setLayerZoomRange?.(spec.id, spec.minzoom, spec.maxzoom);
      for (const [name, value] of Object.entries(spec.layout)) this.map.setLayoutProperty(spec.id, name, value);
      for (const [name, value] of Object.entries(spec.paint)) this.map.setPaintProperty(spec.id, name, value);
    }
    if (record.animatedEffect) this.#queueLayerEffect(record);
    this.#renderLegend();
  }

  /* ---------------- Animated layer effects ---------------- */

  /**
   * A decorative animated effect on a layer (Advanced Style): the same glow,
   * flames, pulses, wind, water and flow as Cinematic mode, drawn on every
   * feature the layer shows. `effect` includes style, colour, opacity, motion
   * speed and density as well as intensity; type
   * "none" (or null) removes it. Saved with the layer's configuration.
   */
  async setLayerEffect(uid, effect) {
    const record = this.#requireVector(uid);
    const type = ["auto", ...CINEMATIC_EFFECT_TYPES].includes(effect?.type) ? effect.type : "none";
    const intensity = Math.min(2, Math.max(0.25, Number(effect?.intensity) || 1));
    const opacity = Math.min(1, Math.max(0.05, Number(effect?.opacity) || 1));
    const speed = Math.min(3, Math.max(0.1, Number(effect?.speed) || 1));
    const density = Math.min(2.5, Math.max(0.25, Number(effect?.density) || 1));
    const style = ["soft", "balanced", "crisp", "vivid"].includes(effect?.style) ? effect.style : "balanced";
    const field = typeof effect?.field === "string" && effect.field ? effect.field.slice(0, 160) : null;
    record.animatedEffect = type === "none" ? null : { type, intensity, opacity, speed, density, style, color: /^#[0-9a-f]{6}$/i.test(effect?.color || "") ? effect.color : null, ...(field ? { field } : {}) };
    record.effectBuilt = null;
    await this.#syncLayerEffect(record);
    this.events.publish("layer:changed", { uid: record.uid });
    return this.getLayerEffect(uid);
  }

  getLayerEffect(uid) {
    const effect = this.#record(uid)?.animatedEffect;
    return effect ? { ...effect } : null;
  }

  /** Hides a layer's own effect while something else (Cinematic playback) animates that layer. */
  suspendLayerEffect(uid, suspended = true) {
    const record = this.#record(uid);
    if (!record) return;
    record.effectSuspended = Boolean(suspended);
    record.effectBuilt = null;
    void this.#syncLayerEffect(record).catch(() => {});
  }

  #layerEffectId(record) { return `layer-effect:${record.uid}`; }

  /** The map view as [w, s, e, n] for layer effects, or null for a wrapped/world view where "in view" means everything. */
  #effectViewBounds() {
    const bounds = this.map?.getBounds?.();
    if (!bounds) return null;
    const view = [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()];
    return view[2] - view[0] >= 180 || view[0] < -180 || view[2] > 180 ? null : view;
  }

  /** Opacity follows at once; a rebuild for new data, filters or visibility waits for changes to settle. */
  #queueLayerEffect(record) {
    if (this.three) this.three.set(this.#layerEffectId(record), { opacity: record.opacity });
    clearTimeout(record.effectTimer);
    record.effectTimer = setTimeout(() => void this.#syncLayerEffect(record).catch((error) => this.events.publish("app:error", { message: `${record.title}: the animated effect could not be drawn (${error.message}).` })), 180);
  }

  async #syncLayerEffect(record) {
    const id = this.#layerEffectId(record);
    const effect = record.animatedEffect;
    if (!effect || !record.visible || record.effectSuspended || !this.#records.has(record.uid)) {
      record.effectBuilt = null;
      this.three?.remove(id);
      return;
    }
    const features = this.#visibleFeatures(record);
    // A large layer decorates what is in (or near) view first, so the budget isn't
    // spent off screen. It is rebuilt when the view leaves the area it was built for.
    const view = features.length > LAYER_EFFECT_VIEW_FIRST ? this.#effectViewBounds() : null;
    const viewBounds = !view ? null : record.effectBuilt?.viewBounds && containsBounds(record.effectBuilt.viewBounds, view) ? record.effectBuilt.viewBounds : expandBounds(view, 2);
    // Detail follows the zoom level, so a rebuild comes with each new level.
    const built = { effect, features, where: record.where, zoom: Math.round(this.map?.getZoom?.() || 0), viewBounds };
    // Unchanged data and settings: nothing to rebuild, only opacity to follow.
    if (record.effectBuilt && Object.entries(built).every(([key, value]) => record.effectBuilt[key] === value)) {
      this.three?.set(id, { opacity: record.opacity * (effect.opacity ?? 1) });
      return;
    }
    record.effectBuilt = built;
    const name = effect.type === "auto" ? suggestEffect({ title: record.title, geometryType: record.geometryType, fields: record.fields }) : effect.type;
    // Off-screen features wait for the view to reach them; detail follows how many are near it.
    const shown = (viewBounds ? nearView(features, viewBounds) : features).slice(0, LAYER_EFFECT_MAX_FEATURES);
    const drawn = await this.setCinematicEffect(id, {
      type: "observed-effect", effect: name, color: effect.color, intensity: effect.intensity, opacity: record.opacity * (effect.opacity ?? 1), speed: effect.speed, density: effect.density, style: effect.style, field: effect.field || null, fields: record.fields, quality: resolveQuality(effect.quality || "auto", shown.length),
      ranges: effectRanges(features, effectFields(record.fields, shown[0]?.properties)),
      items: shown.map((feature) => ({ feature, fresh: true })),
    });
    // The layer may have changed (or gone) while three.js loaded.
    if (record.effectBuilt !== built || !this.#records.has(record.uid)) return;
    if (drawn) this.three?.set(id, { opacity: record.opacity * (effect.opacity ?? 1) });
  }

  /** A new layer record, drawn and announced. */
  #addRecord(fields) {
    this.#count += 1;
    const record = {
      uid: `maplibre-${this.#count}`,
      id: `layer-${this.#count}`,
      title: "Layer",
      url: null,
      kind: "vector",
      type: "geojson",
      layerId: null,
      features: [],
      fields: [],
      objectIdField: OBJECT_ID_FIELD,
      displayField: null,
      geometryType: null,
      visible: true,
      opacity: 0.9,
      where: null,
      featureFilter: null,
      spatialChart: null,
      renderLayerIds: [],
      rendererSpec: null,
      renderer: null,
      serviceRenderer: null,
      transparency: 0,
      minScale: 0,
      maxScale: 0,
      ignoreScaleRange: false,
      sourceJSON: null,
      service: null,
      tiles: null,
      asset: null,
      ...fields,
    };
    record.config = { sourceType: "geojson", fileName: null, projectPath: null, local: false, definitionExpression: null, ...(fields.config || {}) };
    if (fields.where) {
      compileWhere(fields.where);
      record.where = String(fields.where).trim() || null;
      record.config.definitionExpression = record.where;
    }
    this.#records.set(record.uid, record);
    // three.js layers draw through the shared custom layer, not MapLibre sources.
    if (record.kind !== "three") {
      try {
        this.map.addSource(this.#sourceId(record), this.#sourceSpec(record));
        const specs = this.#layerSpecs(record);
        for (const spec of specs) this.map.addLayer(spec);
        record.renderLayerIds = specs.map((spec) => spec.id);
      } catch (error) {
        // A failed add must not leave a half-registered record behind every later layer list.
        this.#records.delete(record.uid);
        try {
          for (const spec of this.map.getStyle?.()?.layers || []) if (spec.source === this.#sourceId(record)) this.map.removeLayer(spec.id);
          if (this.map.getSource?.(this.#sourceId(record))) this.map.removeSource(this.#sourceId(record));
        } catch { /* The style itself is unavailable; nothing was drawn. */ }
        throw error;
      }
    }
    record.handle = layerHandle(record);
    this.#renderLegend();
    this.events.publish("layer:added", { layer: record.handle, config: this.getLayerConfig(record) });
    if (record.truncated) this.events.publish("app:error", { message: `${record.title}: showing the first ${record.features.length.toLocaleString()} features. Add a filter to see the rest.` });
    return record.handle;
  }

  #common(config) {
    return {
      visible: config.visible !== false,
      opacity: Number.isFinite(config.opacity) ? Math.max(0, Math.min(1, config.opacity)) : 0.9,
      ignoreScaleRange: config.ignoreServiceScaleRange === true,
    };
  }

  async addService(config = {}) {
    const url = String(config.url || "").trim().replace(/\/$/, "");
    if (!url) throw new Error("A service URL is required.");
    const type = config.serviceType || "arcgis-auto";
    const scene3dType = SCENE3D_TYPES.includes(type) ? type : type === "arcgis-auto" ? scene3dTypeFor(url) : null;
    if (scene3dType) return this.#addScene3d({ ...config, url }, scene3dType);
    if (type === "geojson" || (type === "arcgis-auto" && isGeoJsonUrl(url))) {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`The GeoJSON could not be read (HTTP ${response.status}).`);
      const features = normalizeFeatures(await response.json());
      return this.#addRecord({ ...this.#common(config), title: config.title?.trim() || titleFromUrl(url), url, features, fields: inferFields(features), geometryType: geometryTypeOf(features), where: config.definitionExpression, config: { sourceType: "geojson", url } });
    }
    if (type === "wms") return this.#addWms(url, config);
    if (type === "vector-tiles") return this.#addVectorTiles(url, config);
    if (type === "wfs" || type === "kml") {
      throw unsupported("layers-ogc", `The MapLibre engine (preview) does not draw ${type.toUpperCase()} services yet. Switch to the ArcGIS engine under Map → Map engine.`);
    }
    let service = await describeArcGIS(url);
    if (service.kind === "service-root") {
      // A FeatureServer: its first layer (links and the add dialog list each layer separately).
      const [first] = await featureServiceLayers(url);
      if (!first) throw new Error("The feature service does not list any layers.");
      service = await describeArcGIS(first.url);
    }
    const title = config.title?.trim() || service.title || titleFromUrl(url);
    const common = { ...this.#common(config), title, url: service.url, sourceJSON: service.json, attribution: service.json?.copyrightText || undefined, config: { sourceType: type, url } };
    if (service.kind !== "feature") {
      return this.#addRecord({ ...common, kind: "raster", type: service.kind, layerId: service.layers?.[0] ?? null, tiles: service.tiles, transparency: service.json?.drawingInfo?.transparency || 0, minScale: service.json?.minScale || 0, maxScale: service.json?.maxScale || 0 });
    }
    const where = config.definitionExpression ?? service.where ?? null;
    // The layer is on the map at once and fills in page by page; queries wait for all of it.
    const handle = this.#addRecord({
      ...common,
      type: "feature",
      layerId: service.layerId,
      service,
      features: [],
      fields: service.fields,
      objectIdField: service.objectIdField || OBJECT_ID_FIELD,
      displayField: service.displayField,
      geometryType: service.geometryType,
      serviceRenderer: service.renderer,
      transparency: service.transparency,
      minScale: service.minScale,
      maxScale: service.maxScale,
      where,
    });
    const record = this.#record(handle);
    let drawn = 0;
    let done = false;
    // Coarse sketches show first and are replaced, feature by feature, as the overview pages arrive.
    const byId = new Map();
    const redraw = () => { drawn = Date.now(); record.features = [...byId.values()]; this.#refresh(record, { data: true }); };
    const take = (features, sketch) => {
      if (done || !this.#records.has(record.uid)) return;
      for (const feature of features) if (!sketch || !byId.has(feature.id)) byId.set(feature.id, feature);
      if (Date.now() - drawn > 500) redraw();
    };
    record.loaded = this.#loadFeatures(service, where, {
      onPage: (features) => take(features, false),
      onSketch: (features) => take(features, true),
    }).then((loaded) => {
      done = true;
      Object.assign(record, { features: loaded.features, truncated: loaded.truncated, serverWhere: loaded.serverWhere });
      record.geometryType ||= geometryTypeOf(loaded.features);
      redraw();
      if (loaded.truncated) this.events.publish("app:error", { message: `${record.title}: showing the first ${record.features.length.toLocaleString()} features. Add a filter to see the rest.` });
      this.events.publish("layer:changed", { uid: record.uid });
      this.#sharpen();
    }).catch((error) => {
      record.loadFailed = error;
      this.events.publish("app:error", { message: `${record.title}: ${error.message}` });
    });
    // A layer that cannot be read at all fails the add, as on ArcGIS.
    await Promise.race([record.loaded, new Promise((resolve) => setTimeout(resolve, 0))]);
    if (record.loadFailed && !record.features.length) {
      this.removeLayer(record.uid);
      throw record.loadFailed;
    }
    return handle;
  }

  /** The outline detail the overview of line and polygon layers is fetched at (degrees, about 50 m). */
  static OVERVIEW_DETAIL = 0.0005;

  /** The outline detail of the first, coarse sketch of line and polygon layers (degrees, about 2 km). */
  static SKETCH_DETAIL = 0.02;

  /**
   * Zoomed in, the line and polygon features in view are refetched at the
   * detail the view can show (their overview outlines are generalized).
   */
  #sharpen() {
    clearTimeout(this.sharpenTimer);
    // Sharpening is a nicety: a failed request leaves the overview outlines.
    this.sharpenTimer = setTimeout(() => this.#sharpenNow().catch(() => {}), 250);
  }

  async #sharpenNow() {
    if (typeof this.map?.getBounds !== "function") return;
    const bounds = this.#viewBounds();
    if (!bounds) return;
    // Degrees per screen pixel at the view's latitude: half a pixel is as sharp as the eye can tell.
    const detail = ((bounds[2] - bounds[0]) / Math.max(1, this.map.getContainer().clientWidth)) * 0.5;
    if (detail >= MaplibreEngine.OVERVIEW_DETAIL) return;
    for (const record of this.#records.values()) {
      if (record.kind !== "vector" || !record.service || !record.visible || !/polygon|polyline/.test(record.geometryType || "")) continue;
      record.detail ??= new Map();
      const sharpened = await fetchGeometries(record.service, { bounds, maxAllowableOffset: detail, where: record.serverWhere ? record.where : null });
      let changed = false;
      const byId = new Map(record.features.map((feature) => [feature.id, feature]));
      for (const { id, geometry } of sharpened) {
        const feature = byId.get(id);
        if (!feature || (record.detail.get(id) ?? MaplibreEngine.OVERVIEW_DETAIL) <= detail) continue;
        feature.geometry = geometry.type === "Polygon" ? regroupPolygon(geometry) : geometry;
        record.detail.set(id, detail);
        changed = true;
      }
      if (changed) this.#refresh(record, { data: true });
    }
  }

  /**
   * A feature layer's features. Layers that fit in the browser are fetched
   * whole and filtered here; bigger ones are fetched already filtered, and
   * fetched again when the filter changes.
   */
  async #loadFeatures(service, where, { onPage = () => {}, onSketch = null } = {}) {
    let total = Infinity;
    try {
      total = (await (await fetch(`${service.url}/query?where=1%3D1&returnCountOnly=true&f=json`)).json()).count ?? Infinity;
    } catch { /* Count unknown: fetch filtered. */ }
    const serverWhere = total > MAX_FEATURES ? where || null : null;
    const prepare = (features) => normalizeFeatures({ type: "FeatureCollection", features: features.map((feature) => (feature.geometry?.type === "Polygon" ? { ...feature, geometry: regroupPolygon(feature.geometry) } : feature)) }, { objectIdField: service.objectIdField });
    // Lines and polygons arrive generalized for the overview (a fraction of the size); zooming in sharpens them.
    const simplify = /polygon|polyline/.test(service.geometryType || "") ? { maxAllowableOffset: MaplibreEngine.OVERVIEW_DETAIL, geometryPrecision: 5 } : null;
    if (simplify && onSketch) {
      // A quick coarse pass (outlines at about 2 km, only the fields the style reads) to show the layer's shape at once.
      const outFields = [...new Set([service.objectIdField, ...rendererFields(service.renderer)].filter(Boolean))].join(",");
      void fetchFeatures(service, { where: serverWhere, simplify: { maxAllowableOffset: MaplibreEngine.SKETCH_DETAIL, geometryPrecision: 3 }, outFields, concurrency: 10, onPage: (batch) => onSketch(prepare(batch)) }).catch(() => {});
    }
    const { features, truncated } = await fetchFeatures(service, { where: serverWhere, simplify, concurrency: 10, onPage: (batch) => onPage(prepare(batch)) });
    return { features: prepare(features), truncated, serverWhere: total > MAX_FEATURES };
  }

  async #addWms(url, config) {
    const parsed = new URL(url);
    const standard = new Set(["service", "request", "version", "layers", "styles", "crs", "srs", "bbox", "width", "height", "format", "transparent"]);
    const extra = [...parsed.searchParams].filter(([key]) => !standard.has(key.toLowerCase()));
    const base = `${parsed.origin}${parsed.pathname}`;
    const capabilities = new URL(base);
    extra.forEach(([key, value]) => capabilities.searchParams.set(key, value));
    capabilities.searchParams.set("SERVICE", "WMS");
    capabilities.searchParams.set("REQUEST", "GetCapabilities");
    const response = await fetch(capabilities.href);
    if (!response.ok) throw new Error(`The WMS capabilities could not be read (HTTP ${response.status}).`);
    const doc = new DOMParser().parseFromString(await response.text(), "text/xml");
    const version = doc.documentElement.getAttribute("version") || "1.3.0";
    // The layers the link names (LAYERS=…), else the service's own layers, up to the most it draws at once.
    const requested = [...parsed.searchParams].find(([key]) => key.toLowerCase() === "layers")?.[1]?.split(",").map((name) => name.trim()).filter(Boolean);
    const limit = Number(doc.getElementsByTagName("LayerLimit")[0]?.textContent) || 30;
    const names = (requested?.length ? requested : [...doc.getElementsByTagName("Layer")]
      .filter((layer) => !layer.getElementsByTagName("Layer").length)
      .map((layer) => [...layer.children].find((child) => child.localName === "Name")?.textContent?.trim())
      .filter(Boolean))
      .slice(0, Math.max(1, Math.min(limit, 30)));
    if (!names.length) throw new Error("The WMS service does not list any layers to draw.");
    const getMap = new URL(base);
    extra.forEach(([key, value]) => getMap.searchParams.set(key, value));
    Object.entries({ SERVICE: "WMS", REQUEST: "GetMap", VERSION: version, LAYERS: names.join(","), STYLES: "", [version.startsWith("1.3") ? "CRS" : "SRS"]: "EPSG:3857", BBOX: "BBOX", WIDTH: "512", HEIGHT: "512", FORMAT: "image/png", TRANSPARENT: "true" })
      .forEach(([key, value]) => getMap.searchParams.set(key, value));
    const title = config.title?.trim() || [...doc.getElementsByTagName("Title")][0]?.textContent?.trim() || titleFromUrl(url);
    return this.#addRecord({ ...this.#common(config), title, url: base, kind: "raster", type: "wms", tiles: { urls: [getMap.href.replace("BBOX=BBOX", "BBOX={bbox-epsg-3857}")], tileSize: 512 }, config: { sourceType: "wms", url } });
  }

  /**
   * Mapbox Vector Tiles from any server: a TileJSON endpoint (Martin, tileserver-gl,
   * pg_tileserv) or an XYZ template, which needs its source-layer name. Tiles are
   * clipped and zoom-dependent, so the layer is drawn but not queried as a dataset.
   */
  async #addVectorTiles(url, config) {
    const allowHttp = /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/)/i.test(url);
    const xyz = /\{z\}/i.test(url);
    const info = await inspectExternalTiles(url, { type: xyz ? "vector-xyz" : "auto", allowHttp });
    if (info.kind !== "vector") throw new Error("This endpoint serves raster tiles, not vector (MVT) tiles.");
    const requested = String(config.sourceLayer || "").split(",").map((name) => name.trim()).filter(Boolean);
    const known = info.layers.map((layer) => layer.id);
    const missing = known.length ? requested.filter((name) => !known.includes(name)) : [];
    if (missing.length) throw new Error(`The tile source has no layer named “${missing[0]}”. Available layers: ${known.join(", ")}.`);
    const sourceLayers = requested.length ? requested : known;
    if (!sourceLayers.length) throw new Error("This tile URL has no metadata naming its layers. Enter the source-layer name under Advanced settings.");
    const fields = (requested.length ? info.layers.filter((layer) => requested.includes(layer.id)) : info.layers).flatMap((layer) => layer.fields);
    const attribution = plainAttribution(info.attribution).replace(/[<>]/g, "") || undefined;
    return this.#addRecord({
      ...this.#common(config),
      title: config.title?.trim() || info.title || (sourceLayers.length === 1 ? sourceLayers[0] : titleFromUrl(url)),
      url,
      kind: "tiles",
      type: "vector-tiles",
      sourceLayers,
      fields: [...new Map(fields.map((field) => [field.name, { name: field.name, alias: field.name, type: /number|int|float|double/i.test(field.type) ? "esriFieldTypeDouble" : "esriFieldTypeString" }])).values()],
      tiles: { tiles: xyz ? [info.url] : info.tiles, minzoom: info.minzoom, maxzoom: info.maxzoom, bounds: info.bounds },
      bounds: info.bounds,
      attribution,
      config: { sourceType: "vector-tiles", url, sourceLayer: requested.length ? requested.join(",") : null },
    });
  }

  /** A point cloud or model drawn with three.js (js/engines/three/). */
  async #addScene3d(config, type, { file = null, projectPath = null } = {}) {
    const options = normalizeScene3d(config.scene3d, type);
    const THREE = await loadThree();
    this.three ??= new ThreeHost({ map: this.map, THREE, notify: (message) => this.events.publish("app:error", { message }) });
    const { buildPointCloud } = type === "pointcloud" ? await import("../three/point-cloud.js?v=0.1.0") : {};
    const { buildModel } = type === "model" ? await import("../three/model.js?v=0.1.0") : {};
    const built = await (type === "pointcloud" ? buildPointCloud : buildModel)(THREE, file ? { file } : { url: config.url }, options);
    const handle = this.#addRecord({
      ...this.#common(config), kind: "three", type, title: config.title?.trim() || (file ? file.name : titleFromUrl(config.url)), url: config.url || null,
      bounds: built.bounds, scene3d: options, scene3dInfo: built.info, asset: file,
      config: { sourceType: type, url: config.url ?? null, fileName: file?.name ?? null, projectPath: file ? projectPath || `data/${file.name}` : null, local: Boolean(file) },
    });
    const record = this.#record(handle);
    this.three.add(record.uid, built.item);
    this.three.set(record.uid, { visible: record.visible, opacity: record.opacity });
    if (built.item.animated) this.three.clock.play();
    return handle;
  }

  async addLocalFile(file, projectPath = null, options = {}) {
    const scene3dType = scene3dTypeFor(file?.name);
    if (scene3dType) {
      // A model dropped on the map without placement stands at the map centre.
      const center = this.map.getCenter();
      const scene3d = scene3dType === "model" && !options.scene3d?.anchor && !options.scene3d?.crs ? { ...options.scene3d, anchor: [center.lng, center.lat, 0] } : options.scene3d;
      return this.#addScene3d({ scene3d }, scene3dType, { file, projectPath });
    }
    const parsed = await parseLocalVectorFile(file);
    // A basemap may still be swapping in when an address runs analysis or adds a file.
    if (!this.map.isStyleLoaded()) await new Promise((resolve) => { this.map.once("style.load", resolve); setTimeout(resolve, 3000); });
    const parts = options.collectionKey != null ? parsed.collections.filter((part) => part.key === options.collectionKey) : parsed.collections;
    if (!parts.length) throw new Error("The requested shapefile was not found in the archive.");
    let first;
    for (const part of parts) {
      const features = normalizeFeatures(part.data);
      const title = part.key ? `${file.name} — ${part.key}` : file.name;
      const added = this.#addRecord({ title, features, fields: inferFields(features), geometryType: geometryTypeOf(features), asset: file, config: { sourceType: parsed.extension === "zip" ? "shapefile" : parsed.extension, fileName: file.name, projectPath: projectPath || `data/${file.name}`, collectionKey: part.key, local: true } });
      first ||= added;
    }
    if (parsed.warnings.length) this.events.publish("app:error", { message: `${file.name}: ${parsed.warnings.join(" ")}` });
    return first;
  }

  async discoverFeatureServiceLayers(value) {
    const rootUrl = String(value ?? "").trim().replace(/\/+$/, "");
    if (!/\/FeatureServer$/i.test(new URL(rootUrl).pathname)) return [];
    return featureServiceLayers(rootUrl);
  }

  async refreshLayer(uid) {
    const record = this.#record(uid);
    if (!record || record.kind !== "vector" || record.config.local) return;
    if (record.service) {
      const loaded = await this.#loadFeatures(record.service, record.where);
      Object.assign(record, { features: loaded.features, truncated: loaded.truncated, serverWhere: loaded.serverWhere });
    } else if (record.url) {
      const response = await fetch(record.url);
      if (!response.ok) return;
      record.features = normalizeFeatures(await response.json());
      record.fields = inferFields(record.features);
    }
    this.#refresh(record, { data: true });
    this.events.publish("layer:changed", { uid: record.uid });
  }

  removeLayer(uid) {
    const record = this.#record(uid);
    if (!record) return;
    if (record.kind === "three") this.three?.remove(record.uid);
    clearTimeout(record.effectTimer);
    this.three?.remove(this.#layerEffectId(record));
    for (const id of this.#layerIds(record)) if (this.map?.getLayer(id)) this.map.removeLayer(id);
    if (this.map?.getSource(this.#sourceId(record))) this.map.removeSource(this.#sourceId(record));
    this.#records.delete(record.uid);
    this.#renderLegend();
    this.events.publish("layer:removed", { uid: record.uid });
  }

  async clearOperationalLayers() {
    for (const record of [...this.#records.values()]) {
      if (record.kind === "three") this.three?.remove(record.uid);
      clearTimeout(record.effectTimer);
      this.three?.remove(this.#layerEffectId(record));
      for (const id of this.#layerIds(record)) if (this.map?.getLayer(id)) this.map.removeLayer(id);
      if (this.map?.getSource(this.#sourceId(record))) this.map.removeSource(this.#sourceId(record));
    }
    this.#records.clear();
    this.#renderLegend();
    this.events.publish("layers:reset");
  }

  getLayers() {
    return [...this.#records.values()].map((record) => record.handle);
  }

  getLayer(uid) {
    return this.#record(uid)?.handle ?? null;
  }

  getQueryableLayer(uid) {
    const record = this.#record(uid);
    return record?.kind === "vector" ? record.handle : null;
  }

  async loadLayer(uid, { allowTruncated = false } = {}) {
    const record = this.#record(uid);
    if (!record) throw new Error("The layer is no longer available.");
    let pending;
    do { pending = record.loaded; await pending; } while (pending !== record.loaded);
    if (record.loadFailed) throw record.loadFailed;
    if (record.filterError) { const error = record.filterError; record.filterError = null; throw error; }
    if (record.truncated && !allowTruncated) throw new Error(`${record.title}: the layer exceeds the feature limit; apply a narrower filter before sharing.`);
    return this.getLayer(uid);
  }

  getLocalAsset(uid) {
    return this.#record(uid)?.asset ?? null;
  }

  /** What the service says about the layer (fields, scale range, edit dates, sentinels), for ArcGIS layers. */
  layerMetadata(ref) {
    const record = this.#record(ref);
    if (!record?.sourceJSON) return null;
    const metadata = arcgisMetadata(record.sourceJSON, record.config.url || record.url || "");
    return metadata;
  }

  getLayerConfig(ref) {
    const record = this.#record(ref);
    if (!record) return null;
    return {
      uid: record.uid,
      id: record.id,
      title: record.title,
      type: record.type,
      url: record.config.url ?? record.url,
      sourceType: record.config.sourceType,
      fileName: record.config.fileName,
      projectPath: record.config.projectPath,
      collectionKey: record.config.collectionKey ?? null,
      local: record.config.local,
      visible: record.visible,
      opacity: record.opacity,
      refreshInterval: 0,
      definitionExpression: record.where || record.config.definitionExpression || null,
      wfsName: null,
      customParameters: null,
      elevationInfo: null,
      renderer: record.renderer ?? record.serviceRenderer ?? null,
      // True when the style was set in GISMap Online (or arrived with a shared map), not the service's own.
      styled: Boolean(record.renderer),
      rendererSpec: record.rendererSpec,
      spatialChart: record.spatialChart ? structuredClone(record.spatialChart) : null,
      animatedEffect: record.animatedEffect ? { ...record.animatedEffect } : null,
      scene3d: record.scene3d ? structuredClone(record.scene3d) : null,
      ignoreServiceScaleRange: record.ignoreScaleRange,
      sourceLayer: record.config.sourceLayer ?? null,
    };
  }

  scaleState(ref) {
    const record = this.#record(ref);
    const scale = this.getScale();
    const minScale = record?.ignoreScaleRange ? 0 : record?.minScale || 0;
    const maxScale = record?.ignoreScaleRange ? 0 : record?.maxScale || 0;
    const visibleAtCurrentScale = !Number.isFinite(scale) || ((!minScale || scale <= minScale) && (!maxScale || scale >= maxScale));
    return { minScale, maxScale, visibleAtCurrentScale, serviceMinScale: record?.minScale || 0, serviceMaxScale: record?.maxScale || 0, ignored: Boolean(record?.ignoreScaleRange) };
  }

  /** "Show anyway": draws a layer at every scale, ignoring the publisher's range. */
  ignoreScaleRange(uid, ignore = true) {
    const record = this.#record(uid);
    if (!record) return false;
    record.ignoreScaleRange = Boolean(ignore);
    this.#refresh(record);
    this.events.publish("layer:changed", { uid: record.uid });
    return true;
  }

  setVisibility(uid, visible, { silent = false } = {}) {
    const record = this.#record(uid);
    if (record) {
      record.visible = Boolean(visible);
      this.#refresh(record);
    }
    if (!silent) this.events.publish("layer:changed", { uid });
  }

  setOpacity(uid, opacity, { silent = false } = {}) {
    const record = this.#record(uid);
    if (record) {
      record.opacity = Math.max(0, Math.min(1, Number(opacity)));
      this.#refresh(record);
    }
    if (!silent) this.events.publish("layer:changed", { uid });
  }

  setTitle(uid, title) {
    const record = this.#record(uid);
    if (record) record.title = String(title);
    this.#renderLegend();
  }

  setOutFields() {
    // Every attribute is fetched with the features.
  }

  /** The layer's attribute filter: evaluated here, or by the service for layers too big to hold whole. */
  setDefinitionExpression(uid, expression, { persist = true } = {}) {
    const record = this.#requireVector(uid);
    const value = String(expression || "").trim() || null;
    compileWhere(value);
    const previousWhere = record.where;
    const previousConfigWhere = record.config.definitionExpression;
    record.where = value;
    if (record.serverWhere && record.service) {
      const request = record.filterRequest = (record.filterRequest || 0) + 1;
      record.filterCommitted ??= { where: previousWhere, configWhere: previousConfigWhere };
      record.filterError = null;
      // Share/export callers must wait for the new subset, not the original load.
      record.loaded = this.#loadFeatures(record.service, value).then((loaded) => {
        if (record.filterRequest !== request || !this.#records.has(record.uid)) return;
        Object.assign(record, { features: loaded.features, truncated: loaded.truncated, serverWhere: loaded.serverWhere });
        record.detail?.clear();
        record.filterCommitted = { where: value, configWhere: persist ? value : record.config.definitionExpression };
        this.#refresh(record, { data: true });
        if (loaded.truncated) this.events.publish("app:error", { message: `${record.title}: showing the first ${record.features.length.toLocaleString()} matching features. Narrow the filter to see all results.` });
        this.events.publish("layer:changed", { uid: record.uid });
      }).catch((error) => {
        if (record.filterRequest !== request || !this.#records.has(record.uid)) return;
        record.where = record.filterCommitted.where;
        record.config.definitionExpression = record.filterCommitted.configWhere;
        record.filterError = error;
        this.#refresh(record, { data: true });
        this.events.publish("layer:changed", { uid: record.uid });
        this.events.publish("app:error", { message: `${record.title}: ${error.message}` });
      });
    }
    this.#refresh(record, { data: true });
    if (!persist) return expression;
    record.config.definitionExpression = value;
    this.events.publish("layer:changed", { uid: record.uid });
    return value;
  }

  async getFeatureFilter(uid) {
    const record = this.#record(uid);
    return record?.featureFilter ? { objectIds: [...record.featureFilter] } : null;
  }

  /** Draws only some features without changing the layer's filter: { objectIds } or { where }, or null for all. */
  async setFeatureFilter(uid, filter) {
    const record = this.#record(uid);
    if (!record || record.kind !== "vector" || !this.map) return false;
    if (!filter) record.featureFilter = null;
    else if (filter.where) {
      const matches = compileWhere(filter.where);
      record.featureFilter = record.features.filter((feature) => matches(feature.properties) && (!Array.isArray(filter.objectIds) || filter.objectIds.includes(Number(feature.id)))).map((feature) => feature.id);
    } else if (Array.isArray(filter.objectIds)) record.featureFilter = filter.objectIds.map(Number);
    else record.featureFilter = null;
    this.#refresh(record);
    return true;
  }

  /* ---------------- Styling ---------------- */

  #sentinelCodes(sentinels, field) {
    return sentinels.filter((item) => item.field === field && item.source !== "heuristic").map((item) => item.value);
  }

  #styleFields(record) {
    return record.fields.filter((field) => field.name !== OBJECT_ID_FIELD).map((field) => ({ name: field.name, alias: field.alias, type: field.type }));
  }

  /** Every value of a field under the layer's filter. */
  async fieldValues(ref, field) {
    const record = this.#record(ref);
    if (record?.kind !== "vector") return [];
    return this.#visibleFeatures(record).map((feature) => feature.properties?.[field]);
  }

  /**
   * Styles a layer from a RendererSpec (renderer-spec.js), as the ArcGIS
   * engine does: validated against the fields, "auto" decided from the data,
   * sentinel codes kept out of the classes. The compiled ArcGIS renderer is
   * then drawn by MapLibre (arcgis-renderer.js). Heat maps need the ArcGIS engine.
   */
  async applyRendererSpec(uid, input, { sentinels = [] } = {}) {
    const record = this.#requireVector(uid);
    const fields = this.#styleFields(record);
    const { valid, issues, spec: validated } = validateRendererSpec(input, { fields, geometryType: record.geometryType });
    if (!valid) {
      const first = issues.find((issue) => issue.level === "error");
      throw new GisMapError(first.code === "FIELD_NOT_FOUND" ? "FIELD_NOT_FOUND" : "INVALID_SPEC", first.message, { hint: first.hint, details: { issues } });
    }
    let spec = validated;
    if (spec.type === "auto" || spec.method === "auto") {
      const field = spec.field || chooseStyleField(fields);
      if (!field) throw new GisMapError("INVALID_SPEC", `${record.title || "This layer"} has no field to style by.`, { hint: 'Name a field, or use { "type": "simple" }.' });
      const exclude = spec.exclude ?? this.#sentinelCodes(sentinels, field);
      const values = await this.fieldValues(record, field);
      spec = resolveRendererSpec({ ...spec, field, ...(exclude.length ? { exclude } : {}) }, { values, fieldType: fields.find((item) => item.name === field)?.type, geometryType: record.geometryType });
    }
    if (spec.type === "service") {
      record.renderer = null;
      record.rendererSpec = null;
    } else if (spec.type === "arcgis") {
      record.renderer = spec.json;
      record.rendererSpec = spec;
    } else {
      if (["choropleth", "graduated-symbols"].includes(spec.type) && spec.exclude === undefined) {
        const codes = this.#sentinelCodes(sentinels, spec.field);
        if (codes.length) spec = { ...spec, exclude: codes };
      }
      const values = ["choropleth", "graduated-symbols"].includes(spec.type) ? (await this.fieldValues(record, spec.field)).map(Number) : [];
      const counts = new Map();
      if (spec.type === "categories") (await this.fieldValues(record, spec.field)).forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
      const alias = fields.find((field) => field.name === spec.field)?.alias;
      const renderer = compileRenderer(spec, { geometryType: record.geometryType, values, categories: [...counts].map(([value, count]) => ({ value, count })), fieldAlias: alias });
      if (!renderer || !rendererToPaint(renderer)) throw unsupported("renderer-spec", `The MapLibre engine (preview) cannot draw “${spec.type}” styles yet; switch to the ArcGIS engine under Map → Map engine.`);
      record.renderer = renderer;
      record.rendererSpec = spec;
    }
    this.#refresh(record);
    this.events.publish("layer:changed", { uid: record.uid });
    return { issues, spec };
  }

  /** Apply the editor's 3D polygon settings using a portable ArcGIS renderer. */
  async setLayerSymbology(uid, options = {}) {
    const record = this.#requireVector(uid);
    if (record.spatialChart) {
      record.spatialChart = null;
      this.#rebuildRecordLayers(record);
    }
    if (!options.extrusionEnabled) {
      const type = options.mode === "categorized" ? "categories" : options.mode === "graduated" ? (record.geometryType === "polygon" ? "choropleth" : "graduated-symbols") : "simple";
      return this.applyRendererSpec(uid, { type, ...(type === "simple" ? { color: options.color, outline: options.outline, size: Number(options.size) || 9 } : { field: options.field }) });
    }
    if (record.geometryType !== "polygon") throw unsupported("3d-symbols", "MapLibre 3D extrusion currently requires polygon features.");
    const field = String(options.extrusionField || "");
    if (options.extrusionSource === "field" && !this.#styleFields(record).some((item) => item.name === field && /integer|double|single|number/i.test(item.type))) throw new Error("Choose a numeric height field.");
    const multiplier = Math.max(0, Number(options.extrusionMultiplier) || 0);
    const symbol3d = (symbol) => ({ type: "polygon-3d", symbolLayers: [{ type: "extrude", size: options.extrusionSource === "fixed" ? Math.max(0, Number(options.extrusionValue) || 0) : 0, material: { color: symbol?.color || options.color || "#1b7f6a" }, edges: { type: "solid", color: options.outline || "#ffffff", size: 1 } }] });
    const preserveClasses = options.mode !== "simple" && record.renderer && ["class-breaks", "unique-value"].includes(record.renderer.type);
    const renderer = preserveClasses ? structuredClone(record.renderer) : { type: "simple", symbol: symbol3d(null) };
    if (renderer.classBreakInfos) renderer.classBreakInfos = renderer.classBreakInfos.map((item) => ({ ...item, symbol: symbol3d(item.symbol) }));
    if (renderer.uniqueValueInfos) renderer.uniqueValueInfos = renderer.uniqueValueInfos.map((item) => ({ ...item, symbol: symbol3d(item.symbol) }));
    if (renderer.defaultSymbol) renderer.defaultSymbol = symbol3d(renderer.defaultSymbol);
    if (options.extrusionSource === "field") renderer.visualVariables = [{ type: "size", valueExpression: `$feature[${JSON.stringify(field)}] * ${multiplier}`, valueUnit: "meters" }];
    else delete renderer.visualVariables;
    record.renderer = renderer;
    record.rendererSpec = null;
    this.#refresh(record);
    this.events.publish("layer:changed", { uid: record.uid });
  }

  /** Apply a portable 3D spatial chart using derived MapLibre layers. */
  async setSpatialChart(uid, input = null) {
    const record = this.#requireVector(uid);
    const groupBy = String(input?.groupBy || "");
    const groupValues = groupBy ? this.#visibleFeatures(record).map((feature) => feature.properties?.[groupBy]) : [];
    record.spatialChart = normalizeSpatialChart(input, { fields: this.#styleFields(record), geometryType: record.geometryType, groupValues });
    this.#rebuildRecordLayers(record);
    this.#renderLegend();
    this.events.publish("layer:changed", { uid: record.uid });
    return record.spatialChart ? structuredClone(record.spatialChart) : null;
  }

  /** Ranked style options for one field, from the values matching the layer's filter (renderer-spec.js). */
  async suggestRenderers(uid, { field = null, sentinels = null } = {}) {
    const record = this.#requireVector(uid);
    const fields = this.#styleFields(record);
    const name = field || chooseStyleField(fields);
    const fieldInfo = fields.find((item) => item.name === name) || fields.find((item) => item.name.toLowerCase() === String(name || "").toLowerCase());
    if (!fieldInfo) throw new GisMapError("FIELD_NOT_FOUND", name ? `Field \`${name}\` does not exist.` : `${record.title || "This layer"} has no field to style by.`);
    const values = await this.fieldValues(record, fieldInfo.name);
    const codes = this.#sentinelCodes(sentinels ?? this.layerMetadata(record)?.sentinels ?? [], fieldInfo.name);
    const suggestion = suggestRenderers({ field: fieldInfo.name, fieldType: fieldInfo.type, geometryType: record.geometryType, values, exclude: codes });
    return { ...suggestion, fieldAlias: fieldInfo.alias || fieldInfo.name, geometryType: record.geometryType, sampled: Boolean(record.truncated) };
  }

  /** Draws a layer with ArcGIS renderer JSON (from a project or link) and records it as its style. */
  restoreRenderer(ref, rendererJson) {
    const record = this.#record(ref);
    if (!record || record.kind !== "vector" || !rendererJson) throw new Error("The requested style cannot be applied to this layer.");
    if (!rendererToPaint(rendererJson)) throw unsupported("renderer-native", "MapLibre cannot draw this renderer; use a supported style or switch engines.");
    const symbol = rendererJson.symbol || rendererJson.classBreakInfos?.[0]?.symbol || rendererJson.uniqueValueInfos?.[0]?.symbol;
    const isExtrusion = symbol?.symbolLayers?.some((item) => String(item.type).toLowerCase() === "extrude");
    const size = rendererJson.visualVariables?.find((item) => /^(size|sizeinfo)$/i.test(item.type));
    if (isExtrusion && size?.valueExpression && !/^\$feature\[("(?:[^"\\]|\\.)*")\]\s*\*\s*((?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)$/i.test(size.valueExpression)) {
      throw unsupported("renderer-native", "MapLibre cannot restore this extrusion height expression. Use a field multiplied by a nonnegative constant.");
    }
    record.renderer = structuredClone(rendererJson);
    this.#refresh(record);
  }

  /** Draws a layer with a renderer for now (the Explorer's "style by this chart"). */
  setRenderer(uid, renderer) {
    this.restoreRenderer(uid, renderer);
  }

  recordRendererSpec(uid, rendererSpec) {
    const record = this.#record(uid);
    if (record) record.rendererSpec = rendererSpec;
  }

  /* ---------------- Queries ---------------- */

  #viewBounds() {
    const bounds = this.map?.getBounds();
    return bounds ? [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()] : null;
  }

  #matching(record, params = {}, layerDefaults = true) {
    if (record.kind !== "vector") throw unsupported("query", `${record.title || "This layer"} is drawn by its service as an image; it has no features to query here.`);
    let features = record.features;
    const keep = (predicate) => { features = features.filter(predicate); };
    if (layerDefaults && record.where) {
      const matches = compileWhere(record.where);
      keep((feature) => matches(feature.properties));
    }
    if (params.where) {
      const matches = compileWhere(params.where);
      keep((feature) => matches(feature.properties));
    }
    if (Array.isArray(params.objectIds)) {
      const ids = new Set(params.objectIds.map(Number));
      keep((feature) => ids.has(feature.id));
    }
    if (params.geometry) {
      const relation = params.spatialRelationship || "intersects";
      const area = params.geometry === "view" ? this.#viewBounds() : Number.isFinite(params.geometry?.xmin) ? boundsOf(params.geometry) : null;
      // Bounding-box tests only: exact spatial relationships need the ArcGIS engine for now.
      if (!area || !["intersects", "envelope-intersects", "index-intersects"].includes(relation) || params.distance) {
        throw unsupported("spatial-query", "Spatial relationships on GeoJSON layers need the ArcGIS engine; ArcGIS layers are answered by their service.");
      }
      keep((feature) => boundsIntersect(boundsOf(feature.geometry), area));
    }
    return features;
  }

  /**
   * The features a query selects. Spatial relationships beyond "in this box"
   * go to the layer's ArcGIS service when it has one (it answers with object
   * IDs); everything else is evaluated here.
   */
  async #select(record, params = {}, layerDefaults = true) {
    await record.loaded;
    const boxOnly = params.geometry === "view" || Number.isFinite(params.geometry?.xmin);
    const relation = params.spatialRelationship || "intersects";
    if (!params.geometry || (boxOnly && ["intersects", "envelope-intersects", "index-intersects"].includes(relation) && !params.distance) || !record.service) {
      return this.#matching(record, params, layerDefaults);
    }
    const geometry = params.geometry === "view" ? this.getViewExtent() : params.geometry;
    const where = [layerDefaults ? record.where : null, params.where].filter(Boolean).map((part) => `(${part})`).join(" AND ") || null;
    const ids = new Set(await queryServiceIds(record.service, { where, geometry, spatialRelationship: relation, distance: params.distance, units: params.units, relationParameter: params.relationParameter }));
    const { geometry: _, spatialRelationship: __, distance: ___, units: ____, relationParameter: _____, ...rest } = params;
    return this.#matching(record, rest, layerDefaults).filter((feature) => ids.has(feature.id));
  }

  async queryFeatures(uid, params = {}, { layerDefaults = true } = {}) {
    const record = this.#require(uid);
    let features = await this.#select(record, params, layerDefaults);
    const fields = Array.isArray(params.outFields) && !params.outFields.includes("*") ? params.outFields : null;
    const pick = (properties) => (fields ? Object.fromEntries(fields.map((name) => [name, properties[name] ?? null])) : { ...properties });
    if (Array.isArray(params.orderByFields) && params.orderByFields.length) {
      const orders = params.orderByFields.map((entry) => { const [name, direction] = String(entry).trim().split(/\s+/); return { name, sign: /^desc$/i.test(direction || "") ? -1 : 1 }; });
      features = [...features].sort((a, b) => {
        for (const { name, sign } of orders) {
          const x = a.properties[name]; const y = b.properties[name];
          if (x === y) continue;
          if (x == null) return 1;
          if (y == null) return -1;
          return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y))) * sign;
        }
        return 0;
      });
    }
    if (params.returnDistinctValues) {
      const seen = new Set();
      features = features.filter((feature) => {
        const key = JSON.stringify(pick(feature.properties));
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }
    const start = Math.max(0, Number(params.start) || 0);
    const end = Number.isFinite(Number(params.num)) && Number(params.num) > 0 ? start + Number(params.num) : features.length;
    const page = features.slice(start, end);
    return {
      features: page.map((feature) => ({ attributes: pick(feature.properties), geometry: params.returnGeometry === false ? null : feature.geometry })),
      exceededTransferLimit: end < features.length,
    };
  }

  async queryFeatureCount(uid, params = {}, { layerDefaults = true } = {}) {
    return (await this.#select(this.#require(uid), params, layerDefaults)).length;
  }

  async queryObjectIds(uid, params = {}, { layerDefaults = true } = {}) {
    return (await this.#select(this.#require(uid), params, layerDefaults)).map((feature) => feature.id);
  }

  /* ---------------- Drawings ---------------- */

  #drawingSource() {
    const vertices = this.drawing?.coordinates || [];
    const preview = vertices.map((coordinates) => ({ type: "Feature", geometry: { type: "Point", coordinates }, properties: {} }));
    if (vertices.length >= 2) preview.push({ type: "Feature", geometry: { type: "LineString", coordinates: vertices }, properties: {} });
    return { type: "geojson", data: { type: "FeatureCollection", features: [...this.drawings, ...preview] } };
  }

  #drawingSpecs() {
    const style = this.drawingsStyle;
    const color = style.color || this.basemapTheme?.accent || "#d9951e";
    return [
      { id: DRAW_LAYER_IDS[0], type: "fill", source: DRAW_SOURCE, filter: ["==", ["geometry-type"], "Polygon"], paint: { "fill-color": color, "fill-opacity": style.fillOpacity } },
      { id: DRAW_LAYER_IDS[1], type: "line", source: DRAW_SOURCE, paint: { "line-color": color, "line-width": style.width } },
      { id: DRAW_LAYER_IDS[2], type: "circle", source: DRAW_SOURCE, filter: ["==", ["geometry-type"], "Point"], paint: { "circle-color": color, "circle-radius": style.pointRadius, "circle-stroke-color": style.outline, "circle-stroke-width": 1.5 } },
    ];
  }

  #drawDrawings() {
    if (!this.map) return;
    const source = this.map.getSource(DRAW_SOURCE);
    try {
      if (!source) this.map.addSource(DRAW_SOURCE, this.#drawingSource());
      else source.setData(this.#drawingSource().data);
      this.#drawingSpecs().forEach((spec) => {
        if (!this.map.getLayer(spec.id)) this.map.addLayer(spec);
        else Object.entries(spec.paint).forEach(([property, value]) => this.map.setPaintProperty(spec.id, property, value));
      });
    } catch (error) {
      this.events.publish("app:error", { message: `Could not display drawings: ${error.message}` });
    }
  }

  #handleDrawingClick(event) {
    const coordinate = [event.lngLat.lng, event.lngLat.lat];
    if (this.drawing.type === "point") return this.#finishDrawing({ type: "Point", coordinates: coordinate });
    if (["polyline", "polygon"].includes(this.drawing.type)) {
      const previous = this.drawing.coordinates.at(-1);
      if (!previous || previous[0] !== coordinate[0] || previous[1] !== coordinate[1]) this.drawing.coordinates.push(coordinate);
      this.#drawDrawings();
    }
  }

  #finishDrawing(geometry) {
    const feature = { type: "Feature", geometry, properties: { drawing_id: this.drawings.length + 1 } };
    this.drawings.push(feature);
    this.drawing = null;
    this.#restoreDrawCursor();
    this.#drawDrawings();
    if (this.drawingsStyle.animatedEffect) void this.setDrawingsStyle({ animatedEffect: this.drawingsStyle.animatedEffect });
    this.map?.dragPan.enable();
    this.events.publish("draw:complete", { feature });
  }

  #completeDrawing() {
    if (!this.drawing || this.drawing.coordinates.length < (this.drawing.type === "polygon" ? 3 : 2)) return;
    const coordinates = this.drawing.type === "polygon" ? [...this.drawing.coordinates, this.drawing.coordinates[0]] : this.drawing.coordinates;
    this.#finishDrawing({ type: this.drawing.type === "polygon" ? "Polygon" : "LineString", coordinates: this.drawing.type === "polygon" ? [coordinates] : coordinates });
  }

  draw(type) {
    if (type === "clear") return this.clearDrawings();
    if (!["point", "polyline", "polygon", "rectangle"].includes(type)) return;
    if (this.measurement) this.toggleWidget("measurement");
    const canvas = this.map?.getCanvas?.();
    if (canvas && this.drawPreviousCursor === null) this.drawPreviousCursor = canvas.style.cursor;
    if (canvas) canvas.style.cursor = "crosshair";
    this.map?.dragPan.enable();
    this.drawing = { type, coordinates: [], start: null };
    if (this.map?.getSource?.(DRAW_SOURCE)) this.#drawDrawings();
    if (type === "rectangle") this.map?.dragPan.disable();
  }

  /** Completes a line or polygon still being drawn, as a double-click would. */
  finishDrawing() { if (["polyline", "polygon"].includes(this.drawing?.type)) this.#completeDrawing(); }
  hasDrawings() { return this.drawings.length > 0; }
  /** Replaces the drawings with saved GeoJSON features. */
  async setDrawings(features = []) {
    this.drawing = null;
    this.drawings = features.map((feature, index) => ({ type: "Feature", geometry: structuredClone(feature.geometry), properties: { drawing_id: index + 1 } }));
    if (this.map?.getSource?.(DRAW_SOURCE) || this.map?.isStyleLoaded?.()) this.#drawDrawings();
    if (this.drawingsStyle.animatedEffect) await this.setDrawingsStyle({ animatedEffect: this.drawingsStyle.animatedEffect });
  }
  getDrawingsStyle() { return structuredClone(this.drawingsStyle); }
  async setDrawingsStyle(next = {}) {
    const effect = next.animatedEffect;
    this.drawingsStyle = {
      ...this.drawingsStyle,
      ...( /^#[0-9a-f]{6}$/i.test(next.color || "") ? { color: next.color } : {}),
      ...( /^#[0-9a-f]{6}$/i.test(next.outline || "") ? { outline: next.outline } : {}),
      ...(Number.isFinite(Number(next.width)) ? { width: Math.min(20, Math.max(0.5, Number(next.width))) } : {}),
      ...(Number.isFinite(Number(next.fillOpacity)) ? { fillOpacity: Math.min(1, Math.max(0, Number(next.fillOpacity))) } : {}),
      ...(Number.isFinite(Number(next.pointRadius)) ? { pointRadius: Math.min(40, Math.max(1, Number(next.pointRadius))) } : {}),
      ...(effect !== undefined ? { animatedEffect: effect?.type && effect.type !== "none" ? { ...effect } : null } : {}),
    };
    this.#drawDrawings();
    const animated = this.drawingsStyle.animatedEffect;
    if (!animated || !this.drawings.length) this.clearCinematicEffect("drawings-effect");
    else await this.setCinematicEffect("drawings-effect", { type: "observed-effect", effect: animated.type, color: animated.color, intensity: animated.intensity, opacity: animated.opacity, speed: animated.speed, density: animated.density, style: animated.style, items: this.drawings.map((feature) => ({ feature, fresh: true })), fields: [], quality: "cinematic" });
    this.events.publish("draw:style-changed", { style: this.getDrawingsStyle() });
    return this.getDrawingsStyle();
  }
  #restoreDrawCursor() {
    const canvas = this.map?.getCanvas?.();
    if (canvas && this.drawPreviousCursor !== null) canvas.style.cursor = this.drawPreviousCursor;
    this.drawPreviousCursor = null;
  }
  clearDrawings() {
    this.drawing = null;
    this.#restoreDrawCursor();
    this.drawings = [];
    this.map?.dragPan.enable();
    this.map?.getSource?.(DRAW_SOURCE)?.setData(this.#drawingSource().data);
    this.clearCinematicEffect("drawings-effect");
  }
  getDrawGraphicsForExport(scope = "all") {
    const extent = scope === "extent" ? this.getViewExtent() : null;
    const box = extent ? [extent.xmin, extent.ymin, extent.xmax, extent.ymax] : null;
    return this.drawings.filter((feature) => !box || boundsIntersect(boundsOf(feature.geometry), box))
      .map((feature) => ({ geometry: feature.geometry, attributes: { ...feature.properties, geometry_type: feature.geometry.type } }));
  }

  /** One line crediting the basemap, terrain and visible data layers, as the attribution control would. */
  getAttributionText() {
    if (!this.map) return "";
    const style = this.map.getStyle?.() || { layers: [] };
    const sources = new Set(style.layers.filter((layer) => layer.source && (layer.layout?.visibility ?? "visible") !== "none").map((layer) => layer.source));
    const terrain = this.map.getTerrain?.()?.source;
    if (terrain) sources.add(terrain);
    const credits = [...sources].map((id) => plainAttribution(this.map.getSource(id)?.attribution));
    for (const record of this.#records.values()) if (record.visible) credits.push(record.attribution ? plainAttribution(record.attribution) : hostCredit(record.url));
    return joinCredits(credits);
  }

  /** Visible layers' legends as data ({ uid, title, field, entries: [{ label, geometry, fill, stroke, radius }] }), top layer first. */
  getLegendData() {
    return [...this.#records.values()].filter((record) => record.visible && record.kind === "vector").reverse().map((record) => {
      const legend = legendForLayer(record, this.#dataColor());
      return { uid: record.uid, title: record.title || "Layer", field: legend.field || null, entries: (legend.entries || []).map(legendSwatch) };
    });
  }

  widgetOpen(name) { return name === "measurement" ? Boolean(this.measurement) : name === "basemapGallery" ? Boolean(this.basemapGallery) : name === "legend" && Boolean(this.legendHost); }

  #renderLegend() {
    const host = this.legendHost;
    if (!host) return;
    host.replaceChildren();
    const records = [...this.#records.values()].filter((record) => record.visible).reverse();
    if (!records.length) {
      const empty = document.createElement("p");
      empty.className = "maplibre-legend__note";
      empty.textContent = "No visible layers. Add or show a layer to see its legend.";
      host.append(empty);
      return;
    }
    for (const record of records) {
      const section = document.createElement("section");
      section.className = "maplibre-legend__layer";
      // The app opens this layer's style editor on double-click or the edit button.
      section.dataset.legendLayer = record.uid;
      section.title = "Double-click to edit this layer's style";
      const head = document.createElement("header");
      head.className = "maplibre-legend__head";
      const heading = document.createElement("strong");
      heading.className = "maplibre-legend__title";
      heading.textContent = record.title || "Untitled layer";
      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "maplibre-legend__edit";
      edit.dataset.legendEdit = record.uid;
      edit.setAttribute("aria-label", `Edit style of ${record.title || "this layer"}`);
      edit.innerHTML = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M11.3 2.3a1.4 1.4 0 0 1 2 2L5.6 12 2.5 13l1-3.1z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>';
      head.append(heading, edit);
      section.append(head);
      if (!this.scaleState(record.uid).visibleAtCurrentScale) {
        const note = document.createElement("p");
        note.className = "maplibre-legend__note";
        note.textContent = "Not visible at this scale.";
        section.append(note);
      }
      if (record.kind === "three") {
        const info = record.scene3dInfo || {};
        const note = document.createElement("p");
        note.className = "maplibre-legend__note";
        note.textContent = info.kind === "pointcloud"
          ? `${info.points.toLocaleString()} of ${info.total.toLocaleString()} points${info.step > 1 ? ` (every ${info.step}th)` : ""} · ${info.crs} · coloured by ${info.colorMode}`
          : `3D model · ${(info.vertices || 0).toLocaleString()} vertices · ${info.size?.join(" × ")} m · placed by ${info.placement}`;
        section.append(note);
        for (const entry of info.legend || []) {
          const row = document.createElement("div");
          row.className = "maplibre-legend__entry";
          const swatch = document.createElement("span");
          swatch.className = "maplibre-legend__swatch maplibre-legend__swatch--point";
          swatch.setAttribute("aria-hidden", "true");
          swatch.style.backgroundColor = entry.color;
          const label = document.createElement("span");
          label.textContent = entry.label;
          row.append(swatch, label);
          section.append(row);
        }
        host.append(section);
        continue;
      }
      let legend = legendForLayer(record, this.#dataColor());
      const axis = spatialChartAxis(record.spatialChart);
      if (axis) {
        const field = document.createElement("p");
        field.className = "maplibre-legend__field";
        field.textContent = axis.label;
        section.append(field);
        const note = document.createElement("p");
        note.className = "maplibre-legend__note";
        note.textContent = axis.detail;
        section.append(note);
        const chart = record.spatialChart;
        const key = spatialChartLegend(chart, chart.height.field ? this.#visibleFeatures(record).map((feature) => feature.properties?.[chart.height.field]) : []);
        const heading = (text) => { const element = document.createElement("p"); element.className = "maplibre-legend__field"; element.textContent = text; section.append(element); };
        const row = (swatch, text) => { const entry = document.createElement("div"); entry.className = "maplibre-legend__entry"; const label = document.createElement("span"); label.textContent = text; entry.append(swatch, label); section.append(entry); };
        if (key.heights.length) {
          heading(chart.mode === "attribute-extrusion" ? "Height key" : "Slab thickness");
          for (const item of key.heights) {
            const bar = document.createElement("span");
            bar.className = "maplibre-legend__height";
            bar.setAttribute("aria-hidden", "true");
            bar.style.height = `${Math.round(4 + item.ratio * 20)}px`;
            row(bar, item.label);
          }
        }
        if (key.slots.length) {
          heading(`Stacked by ${chart.groupBy}, top slot first`);
          for (const slot of key.slots) {
            const swatch = document.createElement("span");
            swatch.className = "maplibre-legend__swatch maplibre-legend__swatch--polygon";
            swatch.setAttribute("aria-hidden", "true");
            swatch.style.backgroundColor = slot.color || "transparent";
            if (!slot.color) swatch.style.borderStyle = "dashed";
            row(swatch, slot.label);
          }
        }
        // Strata drawn in their own colours: the base style's classes are not on the map.
        if (!key.usesRendererColors) legend = { ...legend, field: null, note: null, entries: [] };
      }
      if (legend.field) {
        const field = document.createElement("p");
        field.className = "maplibre-legend__field";
        field.textContent = legend.field;
        section.append(field);
      }
      if (legend.note) {
        const note = document.createElement("p");
        note.className = "maplibre-legend__note";
        note.textContent = legend.note;
        section.append(note);
      }
      // A single unlabelled symbol reads best beside the layer name, not on a row of its own.
      const single = legend.entries.length === 1 && !legend.entries[0].label.trim();
      const list = document.createElement("div");
      list.className = "maplibre-legend__entries";
      for (const entry of legend.entries) {
        const row = document.createElement("div");
        row.className = "maplibre-legend__entry";
        const swatch = document.createElement("span");
        swatch.className = `maplibre-legend__swatch maplibre-legend__swatch--${entry.geometry}`;
        swatch.setAttribute("aria-hidden", "true");
        const color = entry.geometry === "point" ? entry.paint.circle : entry.geometry === "line" ? entry.paint.line : entry.paint.fill;
        swatch.style.backgroundColor = color || "transparent";
        swatch.style.borderColor = entry.paint.stroke || entry.paint.outline || color || "transparent";
        const unstyledFill = entry.geometry === "polygon" && !this.#paintFor(record);
        swatch.style.opacity = String(record.opacity * (record.renderer ? 1 : 1 - (record.transparency || 0) / 100) * (unstyledFill ? 0.35 : 1));
        if (entry.geometry === "point" && entry.paint.radius) {
          const size = Math.min(24, Math.max(6, entry.paint.radius * 2));
          swatch.style.width = `${size}px`;
          swatch.style.height = `${size}px`;
        }
        if (single) { head.prepend(swatch); continue; }
        const label = document.createElement("span");
        label.className = "maplibre-legend__label";
        label.textContent = entry.label;
        row.append(swatch, label);
        list.append(row);
      }
      if (list.childElementCount) section.append(list);
      host.append(section);
    }
  }

  toggleWidget(name) {
    if (name === "basemapGallery") {
      const host = document.querySelector("#utility-basemap-content");
      if (!host) throw new Error("The basemap gallery panel is unavailable.");
      if (this.basemapGallery) {
        host.replaceChildren();
        this.basemapGallery = null;
        this.events.publish("widget:toggled", { name, open: false });
        return false;
      }
      this.basemapGallery = mountBasemapGallery(host, { options: () => this.getBasemapOptions(), select: (id) => this.setBasemap(id) });
      this.events.publish("widget:toggled", { name, open: true });
      return true;
    }
    if (name === "legend") {
      if (this.legendHost) {
        this.legendHost.replaceChildren();
        this.legendHost = null;
        this.events.publish("widget:toggled", { name, open: false });
        return false;
      }
      this.legendHost = document.querySelector("#utility-legend-content");
      if (!this.legendHost) throw new Error("The legend panel is unavailable.");
      this.#renderLegend();
      this.events.publish("widget:toggled", { name, open: true });
      return true;
    }
    if (name !== "measurement") throw new Error(`MapLibre does not support ${name}.`);
    if (this.measurement) {
      this.measurement.panel.remove();
      this.measurement = null;
      for (const id of ["gismap-measure-fill", "gismap-measure-line", "gismap-measure-points"]) if (this.map?.getLayer(id)) this.map.removeLayer(id);
      if (this.map?.getSource(MEASURE_SOURCE)) this.map.removeSource(MEASURE_SOURCE);
      this.#restoreDrawCursor();
      this.events.publish("widget:toggled", { name, open: false });
      return false;
    }
    const host = document.querySelector("#utility-measurement-content");
    if (!host) throw new Error("The measurement panel is unavailable.");
    if (this.drawing) {
      this.drawing = null;
      this.map?.dragPan.enable();
      this.#drawDrawings();
    }
    const canvas = this.map.getCanvas();
    if (this.drawPreviousCursor === null) this.drawPreviousCursor = canvas.style.cursor;
    canvas.style.cursor = "crosshair";
    const panel = document.createElement("section");
    panel.className = "maplibre-measurement";
    panel.setAttribute("aria-label", "Map measurement");
    panel.innerHTML = '<label class="field"><span>Measure</span><select data-measure-mode><option value="distance">Distance</option><option value="area">Area</option></select></label><p data-measure-instructions>Click or tap the map to add points. Distance follows the globe, not terrain elevation.</p><output aria-live="polite">0 m · 0 ft</output><button type="button" data-measure-clear>Clear</button>';
    host.replaceChildren(panel);
    this.measurement = { coordinates: [], panel, mode: "distance" };
    panel.querySelector("[data-measure-mode]").addEventListener("change", (event) => {
      this.measurement.mode = event.target.value === "area" ? "area" : "distance";
      this.measurement.coordinates = [];
      panel.querySelector("[data-measure-instructions]").textContent = this.measurement.mode === "area" ? "Click or tap at least three points around the area. The shape closes automatically; area is a geographic footprint, not terrain surface area." : "Click or tap the map to add points. Distance follows the globe, not terrain elevation.";
      this.#updateMeasurement();
    });
    panel.querySelector("[data-measure-clear]").addEventListener("click", () => { this.measurement.coordinates = []; this.#updateMeasurement(); });
    this.#updateMeasurement();
    this.events.publish("widget:toggled", { name, open: true });
    return true;
  }

  #measureSource() {
    const coordinates = this.measurement?.coordinates || [];
    const features = coordinates.map((coordinate) => ({ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: coordinate } }));
    const area = this.measurement?.mode === "area" && coordinates.length >= 3;
    if (area) features.push({ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [[...coordinates, coordinates[0]]] } });
    if (coordinates.length > 1) features.push({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: area ? [...coordinates, coordinates[0]] : coordinates } });
    return { type: "geojson", data: { type: "FeatureCollection", features } };
  }

  #measureSpecs() {
    return [
      { id: "gismap-measure-fill", type: "fill", source: MEASURE_SOURCE, filter: ["==", ["geometry-type"], "Polygon"], paint: { "fill-color": "#ff8c00", "fill-opacity": 0.25 } },
      { id: "gismap-measure-line", type: "line", source: MEASURE_SOURCE, filter: ["==", ["geometry-type"], "LineString"], paint: { "line-color": "#ff8c00", "line-width": 4 } },
      { id: "gismap-measure-points", type: "circle", source: MEASURE_SOURCE, filter: ["==", ["geometry-type"], "Point"], paint: { "circle-radius": 5, "circle-color": "#ff8c00", "circle-stroke-color": "#fff", "circle-stroke-width": 2 } },
    ];
  }

  #measureClick(event) {
    this.measurement.coordinates.push([event.lngLat.lng, event.lngLat.lat]);
    this.#updateMeasurement();
  }

  #updateMeasurement() {
    const coordinates = this.measurement.coordinates;
    if (this.measurement.mode === "area") {
      const area = measurementArea(coordinates);
      const metric = area < 1e6 ? `${area.toFixed(0)} m²` : `${(area / 1e6).toFixed(2)} km²`;
      const feet = area * 10.7639104167;
      const imperial = feet < 43560 ? `${feet.toFixed(0)} ft²` : feet < 27878400 ? `${(feet / 43560).toFixed(2)} acres` : `${(feet / 27878400).toFixed(2)} mi²`;
      this.measurement.panel.querySelector("output").textContent = `${metric} · ${imperial}`;
    } else {
    let meters = 0;
    for (let i = 1; i < coordinates.length; i++) {
      const [lon1, lat1] = coordinates[i - 1].map((n) => n * Math.PI / 180);
      const [lon2, lat2] = coordinates[i].map((n) => n * Math.PI / 180);
      const a = Math.sin((lat2 - lat1) / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2;
      meters += 12742017.6 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a))));
    }
    const metric = meters < 1000 ? `${meters.toFixed(0)} m` : `${(meters / 1000).toFixed(2)} km`;
    const feet = meters * 3.28084;
    const imperial = feet < 5280 ? `${feet.toFixed(0)} ft` : `${(feet / 5280).toFixed(2)} mi`;
    this.measurement.panel.querySelector("output").textContent = `${metric} · ${imperial}`;
    }
    const source = this.map.getSource(MEASURE_SOURCE);
    if (source) source.setData(this.#measureSource().data);
    else this.map.addSource(MEASURE_SOURCE, this.#measureSource());
    for (const spec of this.#measureSpecs()) if (!this.map.getLayer(spec.id)) this.map.addLayer(spec);
  }

  /* ---------------- Highlight ---------------- */

  #highlightSource() {
    return { type: "geojson", data: { type: "FeatureCollection", features: this.highlight.feature ? [this.highlight.feature].flat() : [] } };
  }

  /** The selected feature, drawn above the data in the feedback colour: filled with an outline, or the outline only. */
  #highlightSpecs() {
    const { color, style } = this.highlight;
    return [
      { id: `${HIGHLIGHT_SOURCE}-fill`, type: "fill", source: HIGHLIGHT_SOURCE, filter: ["match", ["geometry-type"], ["Polygon", "MultiPolygon"], true, false], paint: { "fill-color": color, "fill-opacity": style === "outline" ? 0 : 0.25 } },
      { id: `${HIGHLIGHT_SOURCE}-line`, type: "line", source: HIGHLIGHT_SOURCE, filter: ["match", ["geometry-type"], ["Point", "MultiPoint"], false, true], layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": color, "line-width": 3 } },
      { id: `${HIGHLIGHT_SOURCE}-point`, type: "circle", source: HIGHLIGHT_SOURCE, filter: ["match", ["geometry-type"], ["Point", "MultiPoint"], true, false], paint: { "circle-color": color, "circle-opacity": style === "outline" ? 0 : 0.35, "circle-radius": 9, "circle-stroke-color": color, "circle-stroke-width": 3 } },
    ];
  }

  #drawHighlight() {
    if (!this.map) return;
    const source = this.map.getSource(HIGHLIGHT_SOURCE);
    if (!source) {
      try {
        this.map.addSource(HIGHLIGHT_SOURCE, this.#highlightSource());
        for (const spec of this.#highlightSpecs()) this.map.addLayer(spec);
      } catch {
        // The style is being replaced (a basemap change): draw once it settles.
        this.map.once("idle", () => this.#drawHighlight());
      }
      return;
    }
    source.setData(this.#highlightSource().data);
    for (const spec of this.#highlightSpecs()) {
      if (!this.map.getLayer(spec.id)) continue;
      this.map.moveLayer(spec.id);
      for (const [name, value] of Object.entries(spec.paint)) this.map.setPaintProperty(spec.id, name, value);
    }
  }

  /**
   * Marks a feature (an identify result or presentation record) on the map,
   * or every feature in result.features (a chart group).
   */
  async highlightFeature(result) {
    const parts = (Array.isArray(result?.features) && result.features.length ? result.features : [result]).filter((part) => part?.geometry?.type);
    if (!this.highlight.enabled || result?.kind !== "feature" || !parts.length) {
      this.clearFeatureHighlight();
      return false;
    }
    this.highlight.feature = parts.map((part) => ({ type: "Feature", geometry: part.geometry, properties: {} }));
    this.#drawHighlight();
    return true;
  }

  clearFeatureHighlight() {
    this.highlight.feature = null;
    this.map?.getSource?.(HIGHLIGHT_SOURCE)?.setData(this.#highlightSource().data);
  }

  /** Display settings: highlight on or off, its colour, and filled or outline only. */
  configureInteractionFeedback({ highlightEnabled, highlightColor, highlightStyle } = {}) {
    this.highlight.enabled = highlightEnabled !== false;
    if (/^#[0-9a-f]{6}$/i.test(String(highlightColor || ""))) this.highlight.color = highlightColor;
    this.highlight.style = highlightStyle === "outline" ? "outline" : "fill";
    if (!this.highlight.enabled) this.highlight.feature = null;
    if (this.map?.getSource?.(HIGHLIGHT_SOURCE)) this.#drawHighlight();
  }

  /* ---------------- Identify ---------------- */

  async identify(click) {
    if (!this.map || !Number.isFinite(click?.x)) return [];
    const layers = [...this.#records.values()].filter((record) => record.visible && (record.kind === "vector" || record.kind === "tiles")).flatMap((record) => this.#layerIds(record)).filter((id) => this.map.getLayer(id));
    if (!layers.length) return [];
    const box = [[click.x - 5, click.y - 5], [click.x + 5, click.y + 5]];
    const seen = new Set();
    const results = [];
    for (const hit of this.map.queryRenderedFeatures(box, { layers })) {
      const record = this.#records.get(String(hit.source).slice("gismap-".length));
      if (record?.kind === "tiles") {
        const key = `${record.uid}:${hit.sourceLayer}:${hit.id ?? JSON.stringify(hit.properties)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        results.push({ kind: "feature", layerTitle: record.title || "Layer", layerUid: record.uid, attributes: { ...hit.properties }, geometry: hit.geometry, source: { url: record.url, layerId: hit.sourceLayer, title: record.title, objectIdField: null, displayField: null } });
        continue;
      }
      const id = Number(hit.id ?? hit.properties?.[OBJECT_ID_FIELD]);
      if (!record || seen.has(`${record.uid}:${id}`)) continue;
      seen.add(`${record.uid}:${id}`);
      const feature = record.features.find((item) => item.id === id);
      if (!feature) continue;
      results.push({
        kind: "feature",
        layerUid: record.uid,
        layerTitle: record.title || "Layer",
        attributes: { ...feature.properties },
        geometry: feature.geometry,
        source: { url: record.url, layerId: record.layerId, title: record.title, objectIdField: record.objectIdField, displayField: record.displayField },
      });
    }
    return results;
  }

  setMapNoteMarkers(points = []) {
    this.noteMarkers.forEach((marker) => marker.remove());
    this.noteMarkers = [];
    if (!this.map || !this.maplibregl?.Marker) return;
    for (const point of points) {
      if (!Number.isFinite(point.longitude) || !Number.isFinite(point.latitude)) continue;
      const element = document.createElement("div");
      element.className = `map-note-marker${point.draft ? " map-note-marker--draft" : ""}`;
      element.setAttribute("aria-label", point.draft ? "New note location" : "Map note location");
      this.noteMarkers.push(new this.maplibregl.Marker({ element, anchor: "center" }).setLngLat([point.longitude, point.latitude]).addTo(this.map));
    }
  }

  setTourMarkers(chapters = [], activeIndex = null) {
    this.tourMarkerChapters = Array.isArray(chapters) ? chapters : [];
    this.tourMarkers.forEach((marker) => marker.remove());
    this.tourMarkers = [];
    if (!this.map || !this.maplibregl?.Marker) return;
    this.tourMarkerChapters.forEach((chapter, chapterIndex) => {
      const point = tourChapterPoint(chapter);
      if (!point) return;
      const active = chapterIndex === activeIndex;
      const element = document.createElement("button");
      element.type = "button";
      element.className = "tour-marker";
      element.setAttribute("aria-label", String(chapter?.title || `Chapter ${chapterIndex + 1}`));
      element.style.cssText = `width:${active ? 44 : 36}px;height:${active ? 58 : 48}px;padding:0;border:0;cursor:pointer;background:url("${tourMarkerDataUrl(active)}") center/contain no-repeat;`;
      element.addEventListener("click", (event) => {
        event.stopPropagation();
        this.events.publish("tour-marker:click", { index: chapterIndex });
      });
      this.tourMarkers.push(new this.maplibregl.Marker({ element, anchor: "bottom" }).setLngLat([point.longitude, point.latitude]).addTo(this.map));
    });
  }

  setActiveTourMarker(index = null) {
    this.setTourMarkers(this.tourMarkerChapters, Number.isInteger(index) ? index : null);
  }

  clearTourMarkers() {
    this.setTourMarkers([]);
  }

  /* ---------------- View ---------------- */

  #gisZoom() {
    return toGisZoom(this.map?.getZoom() ?? toEngineZoom(this.defaultView.zoom));
  }

  getViewState() {
    if (!this.map) return { type: "map", camera: null, center: null, zoom: undefined, heading: 0, tilt: 0 };
    const center = this.map.getCenter();
    return { type: "map", camera: null, center: [center.lng, center.lat], zoom: this.#gisZoom(), heading: normalizeHeading(this.map.getBearing()), tilt: this.map.getPitch() };
  }

  getCamera() {
    if (!this.map) throw new GisMapError("NOT_READY", "The map is not ready yet.");
    const center = this.map.getCenter();
    return {
      center: [round(center.lng, 6), round(center.lat, 6)],
      zoom: round(this.#gisZoom(), 2),
      scale: Math.round(this.getScale()),
      heading: round(normalizeHeading(this.map.getBearing()), 1),
      tilt: round(this.map.getPitch(), 1),
    };
  }

  getScale() {
    if (!this.map) return null;
    // The scale ArcGIS reports for a zoom level (Web Mercator at the equator), so scales mean the same in links.
    return SCALE_AT_ZOOM_0 / 2 ** this.#gisZoom();
  }

  getViewpoint() {
    return null;
  }

  getViewExtent() {
    const bounds = this.#viewBounds();
    return bounds ? { xmin: bounds[0], ymin: bounds[1], xmax: bounds[2], ymax: bounds[3], spatialReference: { wkid: 4326 } } : null;
  }

  viewExtentFilter() {
    const view = this.#viewBounds();
    return view ? (geometry) => boundsIntersect(boundsOf(geometry), view) : null;
  }

  getCurrentExtentDetails() {
    const bounds = this.#viewBounds();
    if (!bounds) return null;
    const center = this.map.getCenter();
    return {
      west: round(bounds[0], 6), south: round(bounds[1], 6), east: round(bounds[2], 6), north: round(bounds[3], 6),
      center: { longitude: round(center.lng, 6), latitude: round(center.lat, 6) },
      zoom: round(this.#gisZoom(), 2),
    };
  }

  getViewPadding() {
    return this.map ? { ...this.map.getPadding() } : null;
  }

  setViewPadding(padding) {
    this.map?.setPadding(padding || { top: 0, right: 0, bottom: 0, left: 0 });
  }

  geographicCoordinates(geometry) {
    const point = representativePoint(geometry);
    if (!point) return null;
    const wkid = geometry?.spatialReference?.latestWkid ?? geometry?.spatialReference?.wkid;
    return wkid ? geographicPoint(point.longitude, point.latitude, wkid) : point;
  }

  /** A saved ArcGIS camera (eye position, heading, tilt) as the centre and zoom it looks at. */
  #fromCamera(camera) {
    const position = camera?.position;
    if (!position || !Number.isFinite(position.x)) return null;
    const eye = geographicPoint(position.x, position.y, position.spatialReference?.latestWkid ?? position.spatialReference?.wkid);
    const heading = Number(camera.heading) || 0;
    const tilt = Math.min(MAX_PITCH, Number(camera.tilt) || 0);
    const altitude = Math.max(1, Number(position.z) || 10000);
    const reach = altitude * Math.tan((tilt * Math.PI) / 180);
    const latitude = eye.latitude + (reach * Math.cos((heading * Math.PI) / 180)) / 111320;
    const longitude = eye.longitude + (reach * Math.sin((heading * Math.PI) / 180)) / (111320 * Math.cos((eye.latitude * Math.PI) / 180));
    // A SceneView about 1,200 pixels wide shows a map scale of roughly 3.3 times the slant distance.
    const slant = altitude / Math.cos((tilt * Math.PI) / 180);
    return { center: [longitude, latitude], zoom: zoomForScale(slant * 3.28), heading, tilt };
  }

  #centerOf(value) {
    if (Array.isArray(value)) return [Number(value[0]), Number(value[1])];
    if (value && Number.isFinite(value.longitude)) return [value.longitude, value.latitude];
    if (value && Number.isFinite(value.x)) {
      const point = geographicPoint(value.x, value.y, value.spatialReference?.latestWkid ?? value.spatialReference?.wkid);
      return [point.longitude, point.latitude];
    }
    return null;
  }

  async #move(camera, { animate = true, duration, padding, motion = "pan" } = {}) {
    if (!this.map) return;
    const options = { ...camera, ...(padding !== undefined ? { padding: typeof padding === "number" ? { top: padding, right: padding, bottom: padding, left: padding } : padding } : {}) };
    if (animate === false) {
      this.map.jumpTo(options);
      return;
    }
    const move = motion === "fly" ? "flyTo" : "easeTo";
    await this.#untilMoved(() => this.map[move]({ ...options, ...(duration !== undefined ? { duration } : {}) }));
  }

  /** Runs a camera move and waits for it to end (or a few seconds, when the map is not drawing). */
  async #untilMoved(start) {
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, 5000);
      this.map.once("moveend", () => { clearTimeout(timer); resolve(); });
      start();
    });
  }

  async #fit(bounds, { animate = true, padding = 40, maxZoom, heading, tilt, duration, motion = "pan" } = {}) {
    if (!this.map || !bounds) return;
    const [west, south, east, north] = bounds;
    const options = { padding: typeof padding === "number" ? padding : { top: 0, right: 0, bottom: 0, left: 0, ...padding }, animate: animate !== false, ...(Number.isFinite(maxZoom) ? { maxZoom: toEngineZoom(maxZoom) } : {}), ...(Number.isFinite(heading) ? { bearing: heading } : {}), ...(Number.isFinite(tilt) ? { pitch: tilt } : {}) };
    if (animate === false) {
      this.map.fitBounds([[west, south], [east, north]], options);
      return;
    }
    // cameraForBounds lets a Briefing use the same fly/pan choice for
    // feature and bounds framing. Older MapLibre builds simply use fitBounds.
    if (motion === "fly" && typeof this.map.cameraForBounds === "function") {
      const { animate: _animate, ...cameraOptions } = options;
      const camera = this.map.cameraForBounds([[west, south], [east, north]], cameraOptions);
      if (camera) return this.#move(camera, { animate, duration, motion: "fly" });
    }
    await this.#untilMoved(() => this.map.fitBounds([[west, south], [east, north]], options));
  }

  /** Moves the camera (engine-interface.js ViewTarget). */
  async setView(target, options = {}) {
    if (!this.map || !target) return;
    const animation = { animate: options?.animate, duration: options?.duration, padding: options?.padding, motion: options?.motion };
    if (target.camera || target.viewpoint) {
      const viewpoint = target.viewpoint;
      const camera = this.#fromCamera(target.camera || viewpoint?.camera);
      if (camera) return this.#move({ center: camera.center, zoom: toEngineZoom(camera.zoom), bearing: camera.heading, pitch: camera.tilt }, animation);
      const center = this.#centerOf(representativePoint(viewpoint?.targetGeometry) || viewpoint?.targetGeometry);
      if (center) return this.#move({ center, ...(Number.isFinite(viewpoint.scale) ? { zoom: toEngineZoom(zoomForScale(viewpoint.scale)) } : {}), bearing: -(Number(viewpoint.rotation) || 0) }, animation);
      return;
    }
    if (Array.isArray(target.features)) {
      const bounds = boundsOf(target.features.map((feature) => feature?.geometry).filter(Boolean));
      return bounds ? this.#fit(expandBounds(bounds, 1.1), { ...animation, padding: options?.padding ?? 40 }) : undefined;
    }
    if (Array.isArray(target.bounds)) return this.#fit(target.bounds, { ...animation, padding: options?.padding ?? 0, heading: target.heading, tilt: target.tilt });
    if (target.geometry) {
      const bounds = boundsOf(target.geometry);
      if (!bounds) return;
      const isPoint = bounds[0] === bounds[2] && bounds[1] === bounds[3];
      if (target.fit === "feature" || !Number.isFinite(target.zoom)) {
        if (isPoint) return this.#move({ center: [bounds[0], bounds[1]], zoom: toEngineZoom(target.fit === "feature" ? 15 : this.#gisZoom()), pitch: 0 }, animation);
        return this.#fit(expandBounds(bounds, 1.25), { ...animation, padding: options?.padding ?? 0, tilt: target.fit === "feature" ? 0 : target.tilt });
      }
      const point = representativePoint(target.geometry);
      return this.#move({ center: [point.longitude, point.latitude], zoom: toEngineZoom(target.zoom) }, animation);
    }
    const camera = {};
    const center = this.#centerOf(target.center);
    if (center) camera.center = center;
    if (Number.isFinite(Number(target.zoom)) && target.zoom !== null && target.zoom !== undefined) camera.zoom = toEngineZoom(target.zoom);
    else if (Number.isFinite(Number(target.scale)) && target.scale) camera.zoom = toEngineZoom(zoomForScale(target.scale));
    if (Number.isFinite(Number(target.heading)) && target.heading !== null && target.heading !== undefined) camera.bearing = Number(target.heading);
    if (Number.isFinite(Number(target.tilt)) && target.tilt !== null && target.tilt !== undefined) camera.pitch = Math.min(MAX_PITCH, Number(target.tilt));
    return this.#move(camera, animation);
  }

  async navigate(action) {
    if (!this.map) return null;
    if (action === "home") return this.setView(this.defaultView);
    if (action === "in") return this.#move({ zoom: this.map.getZoom() + 1 });
    if (action === "out") return this.#move({ zoom: this.map.getZoom() - 1 });
    if (action === "north") return this.#move({ bearing: 0 }, { duration: 350 });
    if (action === "rotate-left") return this.#move({ bearing: this.map.getBearing() - 20 }, { duration: 350 });
    if (action === "rotate-right") return this.#move({ bearing: this.map.getBearing() + 20 }, { duration: 350 });
    if (action === "tilt-up") return this.#move({ pitch: Math.min(MAX_PITCH, this.map.getPitch() + 10) }, { duration: 350 });
    if (action === "tilt-down") return this.#move({ pitch: Math.max(0, this.map.getPitch() - 10) }, { duration: 350 });
    if (action === "locate") return this.locateUser({ move: true });
    return null;
  }

  async locateUser({ move = true } = {}) {
    if (!navigator.geolocation) throw new Error("Geolocation is not supported by this browser.");
    const position = await new Promise((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }),
    );
    if (!move) return position.coords;
    return this.setView({ center: [position.coords.longitude, position.coords.latitude], zoom: 15, tilt: 0 });
  }

  /** [west, south, east, north] of the layers' filtered data (all data layers when none are given), or null. */
  async dataBounds(layers = null) {
    const chosen = layers ? layers.map((ref) => this.#record(ref)) : [...this.#records.values()];
    const scenes = chosen.filter((record) => (record?.kind === "three" || record?.kind === "tiles") && record.bounds).map((record) => record.bounds);
    if (scenes.length) {
      const vector = chosen.some((record) => record?.kind === "vector") ? await this.dataBounds(chosen.filter((record) => record?.kind === "vector").map((record) => record.uid)) : null;
      return [...scenes, ...(vector ? [vector] : [])].reduce((a, b) => [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])]);
    }
    const records = chosen.filter((record) => record?.kind === "vector");
    await Promise.all(records.map((record) => record.loaded));
    const geometries = records.flatMap((record) => this.#visibleFeatures(record).map((feature) => feature.geometry));
    const full = boundsOf(geometries);
    // Data spread over half the world (U.S. counties with Alaska, Hawaii and territories) frames its
    // dense core, as the ArcGIS engine does: feature centres between the 2nd and 98th percentiles.
    if (!full || full[2] - full[0] <= 60) return full;
    const points = geometries.map((geometry) => representativePoint(geometry)).filter((point) => Number.isFinite(point?.longitude));
    if (points.length < 20) return full;
    const pick = (values, ratio) => values[Math.min(values.length - 1, Math.max(0, Math.round(ratio * (values.length - 1))))];
    const xs = points.map((point) => point.longitude).sort((a, b) => a - b);
    const ys = points.map((point) => point.latitude).sort((a, b) => a - b);
    const core = [pick(xs, 0.02), pick(ys, 0.02), pick(xs, 0.98), pick(ys, 0.98)];
    return core[2] > core[0] && core[3] > core[1] ? core : full;
  }

  async layerExtent(ref) {
    const bounds = await this.dataBounds([ref]);
    return bounds ? { xmin: bounds[0], ymin: bounds[1], xmax: bounds[2], ymax: bounds[3], spatialReference: { wkid: 4326 } } : null;
  }

  async goToLayers(layers = null, { animate = true } = {}) {
    const bounds = await this.dataBounds(layers);
    if (!bounds) return false;
    await this.#fit(expandBounds(bounds, 1.08), { animate, padding: 24, tilt: 0 });
    // With 3D terrain the camera centre stays at sea level; lift it to the ground so the data is centred.
    if (this.map?.getTerrain?.() && this.map.setCenterElevation) this.map.setCenterElevation(this.map.queryTerrainElevation?.(this.map.getCenter()) || 0);
    return true;
  }

  async goToLayer(ref) {
    return this.goToLayers([ref]);
  }

  async goToLayerOnInitialLoad(ref) {
    if (this.#gisZoom() > 5.5) return false;
    return this.goToLayer(ref);
  }

  /** Places matching a text, or a "longitude, latitude" pair, as { label, location: [lon, lat], extent }. */
  async search(query) {
    const text = String(query || "").trim();
    const coordinates = text.match(/^\s*(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (coordinates) {
      const center = [Number(coordinates[1]), Number(coordinates[2])];
      return [{ label: `${center[0].toFixed(5)}, ${center[1].toFixed(5)}`, location: center }];
    }
    this.geocoder ??= new OpenGeocoder();
    return this.geocoder.search(text);
  }

  /** The address nearest a point in degrees: { address, attributes }, or null. */
  async reverseGeocode(point) {
    this.geocoder ??= new OpenGeocoder();
    return this.geocoder.reverse(point).catch(() => null);
  }

  async goToSearchResult(result) {
    if (result?.extent && Number.isFinite(result.extent.xmin)) {
      const { xmin, ymin, xmax, ymax } = result.extent;
      const wkid = result.extent.spatialReference?.latestWkid ?? result.extent.spatialReference?.wkid;
      const southwest = geographicPoint(xmin, ymin, wkid);
      const northeast = geographicPoint(xmax, ymax, wkid);
      return this.#fit([southwest.longitude, southwest.latitude, northeast.longitude, northeast.latitude], { padding: 0, tilt: 0 });
    }
    return this.setView({ center: result.location, zoom: 14, tilt: 0 });
  }

  async goToTaskPlaces(points = [], { animate = true } = {}) {
    const places = points.filter((point) => Number.isFinite(point?.longitude) && Number.isFinite(point?.latitude));
    if (!this.map || !places.length) return;
    if (places.length === 1) return this.setView({ center: [places[0].longitude, places[0].latitude], zoom: 16, tilt: 0, heading: 0 }, { animate });
    const bounds = boundsOf(places.map((point) => ({ type: "Point", coordinates: [point.longitude, point.latitude] })));
    return this.#fit(expandBounds(bounds, 1.4), { animate, padding: 0, tilt: 0, heading: 0 });
  }

  /* ---------------- Capture ---------------- */

  /**
   * The map as an image: { dataUrl, width, height }. `aspect` crops around the
   * centre; `height` with `width` sets the output size (cropped to its shape).
   */
  async captureImage({ format = "jpg", quality = 82, width = 1200, height = null, aspect = null } = {}) {
    if (!this.map) return null;
    await Promise.race([
      this.map.loaded() ? Promise.resolve() : new Promise((resolve) => this.map.once("idle", resolve)),
      new Promise((resolve) => setTimeout(resolve, 8000)),
    ]);
    // Read a freshly drawn frame, not whatever the buffer held mid-load.
    await Promise.race([
      new Promise((resolve) => { this.map.once("render", resolve); this.map.triggerRepaint(); }),
      new Promise((resolve) => setTimeout(resolve, 1000)),
    ]);
    const canvas = this.map.getCanvas();
    const shape = Number.isFinite(aspect) && aspect > 0 ? aspect : Number.isFinite(height) && height > 0 ? width / height : canvas.width / canvas.height;
    const cropWidth = Math.min(canvas.width, Math.round(canvas.height * shape));
    const cropHeight = Math.min(canvas.height, Math.round(cropWidth / shape));
    const outputWidth = Math.max(1, Math.round(Math.min(width, Number.isFinite(aspect) ? cropWidth : width)));
    const outputHeight = Number.isFinite(height) && height > 0 && !Number.isFinite(aspect) ? Math.round(height) : Math.max(1, Math.round(outputWidth / shape));
    const output = document.createElement("canvas");
    output.width = outputWidth;
    output.height = outputHeight;
    const context = output.getContext("2d");
    if (format !== "png") {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, outputWidth, outputHeight);
    }
    context.drawImage(canvas, Math.round((canvas.width - cropWidth) / 2), Math.round((canvas.height - cropHeight) / 2), cropWidth, cropHeight, 0, 0, outputWidth, outputHeight);
    const dataUrl = output.toDataURL(format === "png" ? "image/png" : "image/jpeg", Math.max(0, Math.min(1, quality / 100)));
    return { dataUrl, width: outputWidth, height: outputHeight };
  }
}

export default MaplibreEngine;

/** The attribute fields an ArcGIS renderer reads. */
function rendererFields(renderer) {
  if (!renderer) return [];
  return [renderer.field, renderer.field1, renderer.field2, renderer.field3, renderer.normalizationField, ...(renderer.visualVariables || []).map((variable) => variable.field)].filter((field) => typeof field === "string");
}

function containsBounds(outer, inner) {
  return outer[0] <= inner[0] && outer[1] <= inner[1] && outer[2] >= inner[2] && outer[3] >= inner[3];
}

// Feature bounds are cached: the same features are tested again on every pan.
const featureBounds = new WeakMap();
/** The features overlapping `bounds`, in their order. */
function nearView(features, bounds) {
  return features.filter((feature) => {
    let box = featureBounds.get(feature);
    if (box === undefined) { box = feature?.geometry ? boundsOf(feature.geometry) : null; featureBounds.set(feature, box); }
    return Boolean(box) && boundsIntersect(box, bounds);
  });
}
