// The ArcGIS engine: the one module that drives the ArcGIS Maps SDK (a
// SceneView). It implements the engine contract in ../engine-interface.js:
// callers get layer handles, features with plain JSON geometry and view
// states, never SDK objects. Only native() hands the SDK's own map and view
// out, for custom tools and the in-page API's escape hatches.
import { madeWithForPage, madeWithHtml } from "../../made-with.js?v=0.65.8-made-with";
import { tourChapterPoint, tourMarkerDataUrl } from "../tour-markers.js?v=0.65.9-tourpins";
import { parseLocalVectorFile } from "../../local-vector-import.js?v=0.54.0-vector1";
import { arcgisMetadata } from "../../source-inspector.js?v=0.53.0";
import { chooseStyleField, compileRenderer, resolveRendererSpec, suggestRenderers, validateRendererSpec } from "../../renderer-spec.js?v=0.29.1";
import { GisMapError } from "../../gismap-errors.js?v=0.54.0-print";
import { ENGINE_CAPABILITIES, unsupported } from "../engine-interface.js?v=0.52.0";
import { loadArcGISRuntime } from "./arcgis-loader.js?v=0.38.0";
import { basemapOnEngine, basemapsForEngine } from "../../basemap-catalog.js?v=0.53.0-gallery1";
import { normalizeSpatialChart } from "../../spatial-chart.js?v=0.69.9-order";
import { spatialChartArcgis } from "../../spatial-chart-arcgis.js?v=0.69.9-order";
import { legendForLayer } from "../maplibre/legend.js?v=0.52.4";

// GISMap Online's own symbols are stored as "/assets/…" so projects move between hosts;
// they load from wherever this app is installed (it may live in a subfolder).
const APP_ROOT = new URL("../../../", import.meta.url).href;
const assetUrls = (value, from, to) => JSON.parse(JSON.stringify(value), (key, item) => (key === "url" && typeof item === "string" && item.startsWith(from) ? to + item.slice(from.length) : item));
const loadableAssets = (value) => (value ? assetUrls(value, "/assets/", `${APP_ROOT}assets/`) : value);
const portableAssets = (value) => (value ? assetUrls(value, `${APP_ROOT}assets/`, "/assets/") : value);
import { hostCredit, joinCredits, legendSwatch, plainAttribution } from "../map-credits.js?v=0.1.0";

const ARCGIS_WORLD_GEOCODER =
  "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer";

export function isNavigationAbort(error) {
  const message = String(error?.message ?? error ?? "").trim();
  return error?.name === "AbortError" || /^(?:abort(?:ed)?|cancel(?:led)?)$/i.test(message);
}
export function parseArcGISFeatureQueryUrl(value) {
  try {
    const parsed = new URL(value);
    const match = parsed.pathname.match(/^(.*\/FeatureServer\/\d+)\/query\/?$/i);
    if (!match) return null;

    const parameter = (name) => {
      const entry = [...parsed.searchParams].find(([key]) => key.toLowerCase() === name.toLowerCase());
      return entry?.[1]?.trim() || null;
    };
    const layerUrl = new URL(parsed.href);
    layerUrl.pathname = match[1];
    layerUrl.search = "";
    layerUrl.hash = "";
    const where = parameter("where");
    const outFields = parameter("outFields");
    return {
      layerUrl: layerUrl.href.replace(/\/$/, ""),
      definitionExpression: where && where !== "1=1" ? where : undefined,
      outFields: outFields ? outFields.split(",").map((field) => field.trim()).filter(Boolean) : undefined,
      requestedOutSpatialReference: parameter("outSR"),
    };
  } catch {
    return null;
  }
}

export function parseWfsUrl(value) {
  const parsed = new URL(String(value).trim());
  const parameter = (name) => [...parsed.searchParams]
    .find(([key]) => key.toLowerCase() === name.toLowerCase())?.[1]?.trim() || null;
  const wfsName = parameter("typeNames") || parameter("typeName");
  const standard = new Set([
    "service", "request", "version", "typenames", "typename", "startindex", "count",
    "srsname", "bbox", "outputformat",
  ]);
  const customParameters = Object.fromEntries(
    [...parsed.searchParams].filter(([key]) => !standard.has(key.toLowerCase())),
  );
  parsed.search = "";
  parsed.hash = "";
  return {
    serviceUrl: parsed.href.replace(/\/$/, ""),
    wfsName,
    customParameters,
  };
}

/** A field as plain data (the SDK's Field and Domain objects stay inside the engine). */
function plainField(field) {
  const domain = field.domain;
  return {
    name: field.name,
    alias: field.alias,
    type: field.type,
    ...(field.length != null ? { length: field.length } : {}),
    ...(field.nullable != null ? { nullable: field.nullable } : {}),
    ...(field.editable != null ? { editable: field.editable } : {}),
    domain: !domain ? null : domain.type === "coded-value"
      ? { type: "coded-value", name: domain.name ?? null, codedValues: (domain.codedValues ?? []).map((item) => ({ code: item.code, name: item.name })) }
      : domain.type === "range"
        ? { type: "range", name: domain.name ?? null, minValue: domain.minValue, maxValue: domain.maxValue }
        : { type: domain.type, name: domain.name ?? null },
  };
}

/**
 * The read-only handle callers get for an SDK layer (engine-interface.js
 * LayerHandle): getters over the live layer that return plain values.
 */
function layerHandle(engine, layer) {
  let fieldsSource;
  let fields = [];
  const config = () => engine.layerConfigs.get(layer.uid) ?? {};
  return Object.freeze({
    get uid() { return layer.uid; },
    get id() { return layer.id; },
    get title() { return layer.title; },
    get url() { return layer.url ?? null; },
    get layerId() { return Number.isInteger(layer.layerId) ? layer.layerId : null; },
    get type() { return layer.type; },
    get fields() {
      if (layer.fields !== fieldsSource) {
        fieldsSource = layer.fields;
        fields = (layer.fields ?? []).map(plainField);
      }
      return fields;
    },
    get geometryType() { return layer.geometryType ?? null; },
    get objectIdField() { return layer.objectIdField ?? null; },
    get displayField() { return layer.displayField ?? null; },
    get visible() { return layer.visible; },
    get opacity() { return layer.opacity; },
    get where() { return layer.definitionExpression || null; },
    get rendererSpec() { return config().rendererSpec ?? null; },
    get renderer() { return layer.renderer?.toJSON?.() ?? null; },
    get minScale() { return layer.minScale || 0; },
    get maxScale() { return layer.maxScale || 0; },
    get refreshInterval() { return "refreshInterval" in layer ? layer.refreshInterval ?? 0 : 0; },
    get loadStatus() { return layer.loadStatus; },
    get loadError() { return layer.loadError ? { name: layer.loadError.name, message: layer.loadError.message } : null; },
    get queryable() { return typeof layer.queryFeatures === "function"; },
    get countable() { return typeof layer.queryFeatureCount === "function"; },
    get objectIdQueryable() { return typeof layer.queryObjectIds === "function"; },
    get filterable() { return "definitionExpression" in layer; },
    get stylable() { return "renderer" in layer; },
    get refreshable() { return "refreshInterval" in layer; },
    get maxRecordCount() { return layer.capabilities?.query?.maxRecordCount || 0; },
    get paginated() { return layer.capabilities?.query?.supportsPagination !== false; },
    get parentTitle() { return layer.parent?.title ?? null; },
  });
}

export class ArcGISEngine {
  #handles = new WeakMap();
  #handleLayers = new WeakMap();
  // Queryable sublayers handed out by getQueryableLayer, by uid (they are not in map.allLayers).
  #sublayers = new Map();
  // Plain geometry JSON handed out -> the SDK geometry and graphic it came from.
  #geometries = new WeakMap();
  #graphics = new WeakMap();

  constructor(events, authController = null) {
    this.id = "arcgis";
    this.events = events;
    this.authController = authController;
    this.map = null;
    this.view = null;
    this.drawLayer = null;
    this.tourLayer = null;
    this.clickFeedbackLayer = null;
    this.locationLayer = null;
    this.locationWatchId = null;
    this.tourMarkerChapters = [];
    this.tourMarkerActiveIndex = null;
    this.modules = {};
    this.layerConfigs = new Map();
    this.localAssets = new Map();
    this.widgets = new Map();
    this.sketch = null;
    this.featureHighlight = null;
    this.featureHighlightTimers = [];
    this.featureHighlightRequestId = 0;
    this.highlightEnabled = true;
    this.clickMarkerEnabled = true;
    this.highlightColor = "#00b8d9";
    this.highlightStyle = "fill";
    this.clickMarkerAnimation = null;
    this.defaultViewpoint = { center: [-98.5, 39.5], zoom: 4, tilt: 35, heading: 0 };
    this.defaultBasemapId = "topo-3d";
    this.basemapId = "topo-3d";
    this.groundId = "world-elevation";
    this.basemapTheme = null;
  }

  async initialize(container = "viewDiv") {
    await loadArcGISRuntime();
    if (!globalThis.$arcgis?.import) {
      throw new Error("ArcGIS Maps SDK did not load. Check the network connection and CDN URL.");
    }

    const moduleIds = [
      "@arcgis/core/Map.js",
      "@arcgis/core/views/SceneView.js",
      "@arcgis/core/Ground.js",
      "@arcgis/core/layers/Layer.js",
      "@arcgis/core/layers/FeatureLayer.js",
      "@arcgis/core/layers/MapImageLayer.js",
      "@arcgis/core/layers/ImageryLayer.js",
      "@arcgis/core/layers/WMSLayer.js",
      "@arcgis/core/layers/WFSLayer.js",
      "@arcgis/core/layers/KMLLayer.js",
      "@arcgis/core/layers/GeoJSONLayer.js",
      "@arcgis/core/layers/GraphicsLayer.js",
      "@arcgis/core/Graphic.js",
      "@arcgis/core/renderers/support/jsonUtils.js",
      "@arcgis/core/rest/locator.js",
      "@arcgis/core/request.js",
      "@arcgis/core/widgets/Sketch/SketchViewModel.js",
      "@arcgis/core/geometry/support/webMercatorUtils.js",
      "@arcgis/core/geometry/Extent.js",
      "@arcgis/core/geometry/support/jsonUtils.js",
    ];
    const [
      ArcGISMap,
      SceneView,
      Ground,
      Layer,
      FeatureLayer,
      MapImageLayer,
      ImageryLayer,
      WMSLayer,
      WFSLayer,
      KMLLayer,
      GeoJSONLayer,
      GraphicsLayer,
      Graphic,
      rendererJsonUtils,
      locator,
      esriRequest,
      SketchViewModel,
      webMercatorUtils,
      Extent,
      geometryJsonUtils,
    ] = await $arcgis.import(moduleIds);

    Object.assign(this.modules, {
      ArcGISMap,
      SceneView,
      Ground,
      Layer,
      FeatureLayer,
      MapImageLayer,
      ImageryLayer,
      WMSLayer,
      WFSLayer,
      KMLLayer,
      GeoJSONLayer,
      GraphicsLayer,
      Graphic,
      rendererJsonUtils,
      locator,
      esriRequest,
      SketchViewModel,
      webMercatorUtils,
      Extent,
      geometryJsonUtils,
    });

    this.drawLayer = new GraphicsLayer({
      title: "Drawings",
      listMode: "hide",
      // Drape every part of a sketch over the terrain, ignoring captured Z values.
      elevationInfo: { mode: "on-the-ground" },
    });
    this.tourLayer = new GraphicsLayer({
      title: "Guided tour locations",
      listMode: "hide",
      elevationInfo: { mode: "relative-to-ground", offset: 12 },
    });
    this.clickFeedbackLayer = new GraphicsLayer({ title: "Click feedback", listMode: "hide" });
    this.locationLayer = new GraphicsLayer({ title: "Your location", listMode: "hide" });
    this.map = new ArcGISMap({
      basemap: this.#sdkBasemap(this.basemapId),
      ground: this.groundId,
      layers: [this.drawLayer, this.tourLayer, this.clickFeedbackLayer, this.locationLayer],
    });
    this.view = new SceneView({
      container,
      map: this.map,
      ...this.defaultViewpoint,
      viewingMode: "global",
      qualityProfile: "high",
      popupEnabled: false,
      ui: { components: [] },
      highlightOptions: this.#highlightOptions(),
      environment: {
        atmosphereEnabled: true,
        starsEnabled: true,
        lighting: { type: "virtual" },
      },
    });
    await this.view.when();
    this.view.ui.empty("top-left");
    if (madeWithForPage()) {
      const credit = document.createElement("div");
      credit.innerHTML = madeWithHtml();
      this.view.ui.add(credit, "bottom-right");
    }
    this.view.on("click", async (event) => {
      try {
        const response = await this.view.hitTest(event, { include: [this.tourLayer] });
        const tourHit = response?.results?.find((result) => result.graphic?.attributes?.tourMarker === true);
        if (tourHit) {
          this.events.publish("tour-marker:click", { index: Number(tourHit.graphic.attributes.chapterIndex) });
          return;
        }
      } catch {
        // A marker hit test must never prevent ordinary map interaction.
      }
      this.showClickMarker(event.mapPoint);
      this.events.publish("map:click", { x: event.x, y: event.y, mapPoint: this.#plainPoint(event.mapPoint) });
    });
    this.view.watch("scale", (scale) => this.events.publish("view:scale-change", { scale }));
    this.view.watch("stationary", (stationary) => { if (stationary) this.events.publish("view:stationary", {}); });
    this.view.on("pointer-move", (event) => {
      const point = this.view.toMap(event);
      if (point) this.events.publish("view:pointer-move", { longitude: point.longitude, latitude: point.latitude, zoom: this.view.zoom });
    });
    this.view.on("layerview-create-error", ({ layer, error }) => {
      // A basemap replaced while it was still drawing reports an error for layers
      // that are no longer on the map; only layers still shown are real failures.
      if (error?.name === "AbortError" || layer?.destroyed || !this.map.allLayers.includes(layer)) return;
      const message = `Could not draw ${layer?.title ?? "a layer"}: ${error?.message ?? "unknown error"}`;
      if (this.lastLayerViewError === message) return;
      this.lastLayerViewError = message;
      setTimeout(() => { if (this.lastLayerViewError === message) this.lastLayerViewError = null; }, 5000);
      this.events.publish("app:error", { message });
    });
    this.#initializeSketch();
    this.events.publish("map:ready", { engine: "arcgis", zoom: this.view.zoom });
  }

  destroy() {
    if (this.locationWatchId != null) navigator.geolocation?.clearWatch?.(this.locationWatchId);
    this.locationWatchId = null;
    this.clearFeatureHighlight();
    this.clearClickMarker();
    this.sketch?.destroy?.();
    this.view?.destroy?.();
    this.map = null;
    this.view = null;
  }

  isReady() {
    return Boolean(this.view && this.map);
  }

  /** Resolves once the view has drawn its first frame (immediately when it already has). */
  async whenReady() {
    await this.view?.when?.();
  }

  /** The basemap's own layers have loaded (a screenshot now shows the whole map), or the timeout passed. */
  async whenBasemapLoaded(timeout = 15000) {
    await Promise.race([this.map?.basemap?.load?.(), new Promise((resolve) => setTimeout(resolve, timeout))]).catch(() => {});
  }

  /** One line crediting the basemap (as Esri's attribution shows it) and visible data layers. */
  getAttributionText() {
    const esri = plainAttribution(this.view?.container?.querySelector?.(".esri-attribution__sources")?.textContent);
    const data = this.#operationalLayers().filter((layer) => layer.visible).map((layer) => plainAttribution(layer.copyright) || hostCredit(layer.url));
    return joinCredits([esri, ...data]);
  }

  /** Visible feature layers' legends as data, from their renderers (same shape as the MapLibre engine). */
  getLegendData() {
    return this.#operationalLayers().filter((layer) => layer.visible && layer.renderer && layer.geometryType).reverse().map((layer) => {
      const legend = legendForLayer({ kind: "vector", renderer: layer.renderer.toJSON?.() ?? layer.renderer, geometryType: layer.geometryType }, "#2f7d6d");
      return { uid: layer.uid, title: layer.title || "Layer", field: legend.field || null, entries: (legend.entries || []).map(legendSwatch) };
    });
  }

  getCapabilities() {
    // Point clouds and models (three.js) are MapLibre-only; spatial charts draw with SceneView symbols.
    return ENGINE_CAPABILITIES.filter((name) => !["view-2d", "basemap-themes", "buildings-3d", "three-3d"].includes(name));
  }

  /**
   * The SDK's own Map and SceneView, for custom tools and the in-page API's
   * experimental escape hatches (gisMapOnline.map / .view). Nothing in the app uses it.
   */
  native() {
    return { engine: "arcgis", map: this.map, view: this.view, layers: () => this.#operationalLayers() };
  }

  /* ---------------- Handles and plain data ---------------- */

  /** The SDK layer behind a uid, a handle, or (inside the engine) the layer itself. */
  #layer(ref) {
    if (ref == null) return null;
    if (typeof ref === "object") return this.#handleLayers.get(ref) ?? ref;
    const uid = String(ref);
    return this.#sublayers.get(uid) ?? this.map?.allLayers?.find((layer) => layer.uid === uid) ?? null;
  }

  #handle(layer) {
    if (!layer) return null;
    let handle = this.#handles.get(layer);
    if (!handle) {
      handle = layerHandle(this, layer);
      this.#handles.set(layer, handle);
      this.#handleLayers.set(handle, layer);
    }
    return handle;
  }

  #plainGeometry(geometry) {
    if (!geometry) return null;
    if (typeof geometry.toJSON !== "function") return geometry;
    const json = geometry.toJSON();
    this.#geometries.set(json, geometry);
    return json;
  }

  #plainPoint(point) {
    if (!point) return null;
    const json = this.#plainGeometry(point);
    const geographic = this.geographicCoordinates(json);
    const plain = { ...json, longitude: geographic?.longitude ?? point.longitude, latitude: geographic?.latitude ?? point.latitude };
    this.#geometries.set(plain, point);
    return plain;
  }

  /** A graphic as a plain feature; the engine remembers the graphic for highlighting. */
  #feature(graphic) {
    const geometry = this.#plainGeometry(graphic.geometry);
    if (geometry) this.#graphics.set(geometry, graphic);
    return { attributes: graphic.attributes ?? {}, geometry };
  }

  /** Plain geometry JSON (or a { longitude, latitude } point) as an SDK geometry. */
  #sdkGeometry(value) {
    if (!value || typeof value !== "object") return null;
    if (value.declaredClass) return value;
    const known = this.#geometries.get(value);
    if (known) return known;
    let geometry = null;
    try {
      const json = Number.isFinite(value.x) || value.rings || value.paths || value.points || Number.isFinite(value.xmin)
        ? value
        : Number.isFinite(value.longitude) && Number.isFinite(value.latitude)
          ? { x: value.longitude, y: value.latitude, spatialReference: { wkid: 4326 } }
          : null;
      // Before the SDK has loaded (and in tests) the JSON goes to the SDK as is, to autocast.
      geometry = !json ? null : this.modules.geometryJsonUtils ? this.modules.geometryJsonUtils.fromJSON(structuredClone(json)) : json;
    } catch {
      geometry = null;
    }
    if (geometry) this.#geometries.set(value, geometry);
    return geometry;
  }

  #initializeSketch() {
    this.sketch = new this.modules.SketchViewModel({
      view: this.view,
      layer: this.drawLayer,
      defaultCreateOptions: { hasZ: false },
      pointSymbol: {
        type: "simple-marker",
        color: "#d9951e",
        outline: { color: "#ffffff", width: 1.5 },
        size: 9,
      },
      polylineSymbol: { type: "simple-line", color: "#d9951e", width: 3 },
      polygonSymbol: {
        type: "simple-fill",
        color: [217, 149, 30, 0.18],
        outline: { color: "#d9951e", width: 2 },
      },
    });
    this.sketch.on("create", ({ state, graphic }) => {
      if (state === "complete") this.events.publish("draw:complete", { feature: this.#feature(graphic) });
    });
  }

  draw(type) {
    if (type === "clear") {
      this.drawLayer.removeAll();
      return;
    }
    this.sketch?.create(type);
  }

  /** Completes a line or polygon still being drawn, as a double-click would. */
  finishDrawing() { this.sketch?.complete(); }

  hasDrawings() {
    return Boolean(this.drawLayer?.graphics?.length);
  }

  clearDrawings() {
    this.drawLayer?.removeAll();
  }

  /** Replaces the drawings with saved GeoJSON features (EPSG:4326), styled like new sketches. */
  setDrawings(features = []) {
    if (!this.drawLayer) return;
    this.drawLayer.removeAll();
    const spatialReference = { wkid: 4326 };
    const symbols = {
      point: this.sketch?.pointSymbol ?? { type: "simple-marker", color: "#d9951e", outline: { color: "#ffffff", width: 1.5 }, size: 9 },
      multipoint: this.sketch?.pointSymbol ?? { type: "simple-marker", color: "#d9951e", size: 9 },
      polyline: this.sketch?.polylineSymbol ?? { type: "simple-line", color: "#d9951e", width: 3 },
      polygon: this.sketch?.polygonSymbol ?? { type: "simple-fill", color: [217, 149, 30, 0.18], outline: { color: "#d9951e", width: 2 } },
    };
    const toArcGIS = ({ type, coordinates }) => ({
      Point: { type: "point", x: coordinates[0], y: coordinates[1], spatialReference },
      MultiPoint: { type: "multipoint", points: coordinates, spatialReference },
      LineString: { type: "polyline", paths: [coordinates], spatialReference },
      MultiLineString: { type: "polyline", paths: coordinates, spatialReference },
      Polygon: { type: "polygon", rings: coordinates, spatialReference },
      MultiPolygon: { type: "polygon", rings: coordinates.flat(), spatialReference },
    })[type] ?? null;
    for (const feature of features) {
      const geometry = toArcGIS(feature.geometry);
      if (geometry) this.drawLayer.add(new this.modules.Graphic({ geometry, symbol: symbols[geometry.type], attributes: {} }));
    }
  }

  getDrawGraphicsForExport(scope = "all") {
    const extent = this.view?.extent;
    return (this.drawLayer?.graphics?.toArray?.() ?? [])
      .filter((graphic) => scope !== "extent" || !extent || extent.intersects(graphic.geometry))
      .map((graphic, index) => {
        const spatialReference = graphic.geometry?.spatialReference;
        let geometry = graphic.geometry;
        if (!spatialReference?.isGeographic) {
          if (!this.modules.webMercatorUtils?.canProject(geometry, { wkid: 4326 })) {
            throw new Error("A drawing could not be projected to EPSG:4326 for export.");
          }
          geometry = this.modules.webMercatorUtils.project(geometry, { wkid: 4326 });
        }
        return {
          geometry: this.#plainGeometry(geometry),
          attributes: {
            drawing_id: index + 1,
            geometry_type: graphic.geometry?.type || "unknown",
            ...(graphic.attributes ?? {}),
          },
        };
      });
  }

  async addService(config) {
    const cleanUrl = config.url?.trim().replace(/\/$/, "");
    if (!cleanUrl) throw new Error("A service URL is required.");
    if (config.serviceType === "vector-tiles") throw new Error("Vector tile (MVT) layers need the MapLibre engine. Switch under Map → Map engine.");
    if (!["wms", "wfs", "kml", "geojson"].includes(config.serviceType)) {
      await this.authController?.prepareService(cleanUrl);
    }
    const featureQuery = parseArcGISFeatureQueryUrl(cleanUrl);
    const wfs = config.serviceType === "wfs" ? parseWfsUrl(cleanUrl) : null;
    let serviceType = this.#serviceTypeFromUrl(config.serviceType, cleanUrl);
    if (featureQuery) serviceType = "feature";
    const mapSublayer = this.#parseMapSublayerUrl(cleanUrl);
    let layer;
    const common = {
      url: wfs?.serviceUrl ?? featureQuery?.layerUrl ?? cleanUrl,
      title: config.title?.trim() || undefined,
      opacity: Number.isFinite(config.opacity) ? config.opacity : 0.9,
      visible: config.visible !== false,
      popupEnabled: false,
    };

    const buildMapSublayer = () => new this.modules.MapImageLayer({
      ...common,
      url: mapSublayer.rootUrl,
      sublayers: [{ id: mapSublayer.id }],
    });

    try {
      switch (serviceType) {
        case "feature":
          layer = new this.modules.FeatureLayer({
            ...common,
            definitionExpression: config.definitionExpression ?? featureQuery?.definitionExpression,
            outFields: featureQuery?.outFields ?? ["*"],
          });
          break;
        case "map-image":
          layer = mapSublayer ? buildMapSublayer() : new this.modules.MapImageLayer(common);
          break;
        case "imagery":
          if (mapSublayer) {
            serviceType = "map-image";
            layer = buildMapSublayer();
          } else {
            layer = new this.modules.ImageryLayer(common);
          }
          break;
        case "wms":
          layer = new this.modules.WMSLayer(common);
          break;
        case "wfs":
          layer = new this.modules.WFSLayer({
            ...common,
            name: config.wfsName?.trim() || wfs?.wfsName || undefined,
            customParameters: config.customParameters ?? wfs?.customParameters,
          });
          break;
        case "kml":
          layer = new this.modules.KMLLayer(common);
          break;
        case "geojson":
          layer = new this.modules.GeoJSONLayer(common);
          break;
        default:
          layer = await this.modules.Layer.fromArcGISServerUrl({ url: cleanUrl });
          if (common.title) layer.title = common.title;
          layer.opacity = common.opacity;
          layer.visible = common.visible;
          // Shared and saved filters apply to auto-detected feature layers too.
          if (config.definitionExpression && "definitionExpression" in layer) layer.definitionExpression = config.definitionExpression;
          break;
      }

      return await this.#addLayer(layer, {
        sourceType: serviceType,
        url: cleanUrl,
        title: common.title,
        serviceLayerId: mapSublayer?.id ?? null,
        elevationInfo: config.elevationInfo ?? null,
        refreshInterval: Number(config.refreshInterval) || 0,
        definitionExpression: config.definitionExpression ?? featureQuery?.definitionExpression ?? null,
        wfsName: config.wfsName?.trim() || wfs?.wfsName || null,
        customParameters: config.customParameters ?? wfs?.customParameters ?? null,
        ignoreServiceScaleRange: config.ignoreServiceScaleRange === true,
      });
    } catch (error) {
      if (!mapSublayer || serviceType !== "arcgis-auto") throw error;
      serviceType = "map-image";
      layer = buildMapSublayer();
      return this.#addLayer(layer, {
        sourceType: serviceType,
        url: cleanUrl,
        title: common.title,
        serviceLayerId: mapSublayer.id,
        refreshInterval: Number(config.refreshInterval) || 0,
        ignoreServiceScaleRange: config.ignoreServiceScaleRange === true,
      });
    }
  }

  async discoverFeatureServiceLayers(value) {
    const rootUrl = String(value ?? "").trim().replace(/\/+$/, "");
    if (!/\/FeatureServer$/i.test(new URL(rootUrl).pathname)) return [];
    await this.authController?.prepareService(rootUrl);
    const response = await this.modules.esriRequest(rootUrl, {
      query: { f: "json" },
      responseType: "json",
    });
    const payload = response.data ?? {};
    if (payload.error) throw new Error(payload.error.message || "Could not inspect the feature service.");
    return (payload.layers ?? [])
      .filter((layer) => Number.isInteger(layer.id) && !Array.isArray(layer.subLayerIds))
      .map((layer) => ({
        id: layer.id,
        name: layer.name || `Layer ${layer.id}`,
        geometryType: layer.geometryType || "Feature Layer",
        url: `${rootUrl}/${layer.id}`,
      }));
  }

  #parseMapSublayerUrl(url) {
    try {
      const parsed = new URL(url, location.href);
      const match = parsed.pathname.match(/^(.*\/MapServer)\/(\d+)$/i);
      if (!match) return null;
      parsed.pathname = match[1];
      return { rootUrl: parsed.href.replace(/\/$/, ""), id: Number(match[2]) };
    } catch {
      const match = String(url).match(/^(.*\/MapServer)\/(\d+)(?:[?#].*)?$/i);
      return match ? { rootUrl: match[1], id: Number(match[2]) } : null;
    }
  }

  #serviceTypeFromUrl(requestedType, url) {
    if (requestedType && requestedType !== "arcgis-auto") return requestedType;
    try {
      const parsed = new URL(url, location.href);
      if (/\.geojson$/i.test(parsed.pathname) || /^(geojson)$/i.test(parsed.searchParams.get("f") || "")) {
        return "geojson";
      }
    } catch {
      if (/\.geojson(?:$|[?#])/i.test(url)) return "geojson";
    }
    return "arcgis-auto";
  }

  async addLocalFile(file, projectPath = null, options = {}) {
    const parsed = await parseLocalVectorFile(file);
    const parts = options.collectionKey != null ? parsed.collections.filter((part) => part.key === options.collectionKey) : parsed.collections;
    if (!parts.length) throw new Error("The requested shapefile was not found in the archive.");
    let first;
    for (const part of parts) {
      const url = URL.createObjectURL(new Blob([JSON.stringify(part.data)], { type: "application/geo+json" }));
      try {
        const layer = new this.modules.GeoJSONLayer({ url, title: part.key ? `${file.name} — ${part.key}` : file.name, opacity: 0.9, popupEnabled: false });
        const added = await this.#addLayer(layer, { sourceType: parsed.extension === "zip" ? "shapefile" : parsed.extension, fileName: file.name, projectPath: projectPath || `data/${file.name}`, collectionKey: part.key, local: true });
        this.localAssets.set(added.uid, file); first ||= added;
      } catch (error) { URL.revokeObjectURL(url); throw error; }
    }
    if (parsed.warnings.length) this.events.publish("app:error", { message: `${file.name}: ${parsed.warnings.join(" ")}` });
    return first;
  }

  async #addLayer(layer, config = {}) {
    layer.popupEnabled = false;
    if (config.refreshInterval > 0 && "refreshInterval" in layer) {
      layer.refreshInterval = config.refreshInterval;
    }
    await layer.load();
    if ("elevationInfo" in layer) {
      layer.elevationInfo = config.elevationInfo || { mode: "on-the-ground" };
    }
    if (config.serviceLayerId != null && !config.title) {
      const sublayer = layer.findSublayerById?.(config.serviceLayerId);
      const serviceTitle = this.#titleFromUrl(config.url || layer.url);
      layer.title = sublayer?.title ? `${serviceTitle} — ${sublayer.title}` : serviceTitle;
    } else if (!layer.title?.trim()) {
      layer.title = this.#titleFromUrl(config.url || layer.url);
    }
    // The publisher's own style, so a { type: "service" } renderer can return to it.
    const serviceRenderer = layer.renderer?.toJSON?.() ?? null;
    if (config.ignoreServiceScaleRange) this.#overrideScaleRange(layer, config);
    // Keep internal tour and click-feedback graphics above operational data.
    this.map.add(layer, Math.max(0, this.map.layers.length - 2));
    this.layerConfigs.set(layer.uid, { ...config, serviceRenderer });
    const handle = this.#handle(layer);
    this.events.publish("layer:added", { layer: handle, config: this.getLayerConfig(layer) });
    return handle;
  }

  #titleFromUrl(url = "") {
    const parts = String(url).replace(/\/$/, "").split("/");
    const serviceIndex = parts.findIndex((part) => /^(MapServer|FeatureServer|ImageServer)$/i.test(part));
    const name = serviceIndex > 0 ? parts[serviceIndex - 1] : parts.at(-1);
    try {
      return decodeURIComponent(name || "Untitled layer").replaceAll("_", " ");
    } catch {
      return name || "Untitled layer";
    }
  }

  removeLayer(uid) {
    const layer = this.#layer(uid);
    if (!layer || this.#internal(layer)) return;
    this.clearFeatureHighlight();
    this.map.remove(layer);
    this.layerConfigs.delete(uid);
    this.localAssets.delete(uid);
    this.#forgetSublayers();
    this.events.publish("layer:removed", { uid });
  }

  #internal(layer) {
    return layer === this.drawLayer || layer === this.tourLayer || layer === this.clickFeedbackLayer || layer === this.locationLayer;
  }

  #forgetSublayers() {
    for (const [uid, sublayer] of this.#sublayers) {
      let root = sublayer;
      while (root?.parent && root.parent !== this.map) root = root.parent;
      if (!this.map?.layers?.includes?.(root)) this.#sublayers.delete(uid);
    }
  }

  /** The data layers, bottom to top (drawings, tour markers and other internal graphics are left out). */
  getLayers() {
    return this.#operationalLayers().map((layer) => this.#handle(layer));
  }

  /** A data layer (or a sublayer from getQueryableLayer) by uid, or null. */
  getLayer(uid) {
    const layer = this.#layer(uid);
    return layer && !this.#internal(layer) ? this.#handle(layer) : null;
  }

  /**
   * The layer itself when it can be queried, otherwise its first queryable
   * sublayer (map image services), or null.
   */
  getQueryableLayer(uid) {
    const visit = (layer) => {
      if (!layer) return null;
      if (typeof layer.queryFeatures === "function") return layer;
      for (const child of layer.sublayers?.toArray?.() ?? []) {
        const found = visit(child);
        if (found) return found;
      }
      return null;
    };
    const root = this.#layer(uid);
    const found = root && !this.#internal(root) ? visit(root) : null;
    if (found && found !== root) this.#sublayers.set(found.uid, found);
    return this.#handle(found);
  }

  /** Waits for a layer's service description (fields, geometry type) and returns its handle. */
  async loadLayer(uid) {
    const layer = this.#layer(uid);
    if (!layer) return null;
    await layer.load?.();
    return this.#handle(layer);
  }

  getLocalAsset(uid) {
    return this.localAssets.get(uid) ?? null;
  }

  clearFeatureHighlight() {
    this.featureHighlightRequestId += 1;
    this.featureHighlightTimers.forEach((timer) => clearTimeout(timer));
    this.featureHighlightTimers = [];
    this.featureHighlight?.remove?.();
    this.featureHighlight = null;
  }

  async highlightFeature(result, { pulse = true } = {}) {
    this.clearFeatureHighlight();
    if (!this.highlightEnabled || !result || result.kind !== "feature" || !this.view?.whenLayerView) return false;

    const requestId = this.featureHighlightRequestId;
    const graphic = (result.geometry && this.#graphics.get(result.geometry)) ?? null;
    const layer = graphic?.layer || graphic?.sourceLayer || this.#layer(result.layerUid);
    if (!layer) return false;

    try {
      const layerView = await this.view.whenLayerView(layer);
      if (requestId !== this.featureHighlightRequestId) return false;

      const objectIdField = layer.objectIdField || graphic?.layer?.objectIdField;
      const objectId = objectIdField
        ? (result.attributes?.[objectIdField] ?? graphic?.attributes?.[objectIdField])
        : null;
      // A chart group highlights every one of its features.
      const groupIds = objectIdField && Array.isArray(result.features) ? result.features.map((feature) => feature?.attributes?.[objectIdField]).filter((id) => id != null) : [];
      const target = groupIds.length ? groupIds : objectId != null ? objectId : graphic;
      if (!target) return false;

      const applyHighlight = () => {
        if (requestId !== this.featureHighlightRequestId) return;
        this.featureHighlight?.remove?.();
        this.featureHighlight = layerView.highlight(target);
      };
      applyHighlight();

      if (pulse) {
        this.featureHighlightTimers.push(setTimeout(() => {
          if (requestId !== this.featureHighlightRequestId) return;
          this.featureHighlight?.remove?.();
          this.featureHighlight = null;
        }, 180));
        this.featureHighlightTimers.push(setTimeout(applyHighlight, 300));
      }
      return true;
    } catch {
      return false;
    }
  }

  /** The view's highlight look: the feedback colour, filled or as an outline only. */
  #highlightOptions() {
    return { color: this.highlightColor, haloOpacity: 1, fillOpacity: this.highlightStyle === "outline" ? 0 : 0.25 };
  }

  configureInteractionFeedback({ highlightEnabled, clickMarkerEnabled, highlightColor, highlightStyle } = {}) {
    this.highlightStyle = highlightStyle === "outline" ? "outline" : "fill";
    this.highlightEnabled = highlightEnabled !== false;
    this.clickMarkerEnabled = clickMarkerEnabled !== false;
    if (/^#[0-9a-f]{6}$/i.test(String(highlightColor || ""))) this.highlightColor = highlightColor;
    if (this.view) this.view.highlightOptions = this.#highlightOptions();
    if (!this.highlightEnabled) this.clearFeatureHighlight();
    if (!this.clickMarkerEnabled) this.clearClickMarker();
  }

  clearClickMarker() {
    if (this.clickMarkerAnimation != null) {
      if (globalThis.cancelAnimationFrame) cancelAnimationFrame(this.clickMarkerAnimation);
      else clearTimeout(this.clickMarkerAnimation);
    }
    this.clickMarkerAnimation = null;
    this.clickFeedbackLayer?.removeAll();
  }

  showClickMarker(point) {
    if (!this.clickMarkerEnabled || !point || !this.clickFeedbackLayer || !this.modules.Graphic) return;
    const color = this.highlightColor;
    this.clearClickMarker();
    const crosshair = new this.modules.Graphic({
      geometry: point,
      symbol: { type: "simple-marker", style: "cross", size: 18, color, outline: { color, width: 2.5 } },
    });
    const pulse = new this.modules.Graphic({
      geometry: point,
      symbol: { type: "simple-marker", style: "circle", size: 18, color: [0, 0, 0, 0], outline: { color, width: 2 } },
    });
    this.clickFeedbackLayer.addMany([crosshair, pulse]);

    const animationNow = () => globalThis.performance?.now?.() ?? Date.now();
    const startedAt = animationNow();
    const duration = 850;
    const schedule = globalThis.requestAnimationFrame
      ? (callback) => requestAnimationFrame(callback)
      : (callback) => setTimeout(() => callback(animationNow()), 16);
    const animate = (now) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const opacity = progress < 0.18 ? 1 : 1 - ((progress - 0.18) / 0.82);
      const animatedColor = this.#hexToRgba(color, Math.max(0, opacity));
      crosshair.symbol = {
        type: "simple-marker",
        style: "cross",
        size: 18 + (progress * 8),
        color: animatedColor,
        outline: { color: animatedColor, width: 2.5 },
      };
      pulse.symbol = {
        type: "simple-marker",
        style: "circle",
        size: 18 + (progress * 34),
        color: [0, 0, 0, 0],
        outline: { color: animatedColor, width: 2 },
      };
      if (progress < 1) {
        this.clickMarkerAnimation = schedule(animate);
      } else {
        this.clearClickMarker();
      }
    };
    this.clickMarkerAnimation = schedule(animate);
  }

  /**
   * Finds the device and marks it with a "you are here" dot. Once found, the dot
   * keeps following the device until the page closes.
   */
  async locateUser({ move = true } = {}) {
    if (!navigator.geolocation) throw new Error("Geolocation is not supported by this browser.");
    const position = await new Promise((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }),
    );
    this.#showUserLocation(position.coords);
    if (this.locationWatchId == null && navigator.geolocation.watchPosition) {
      this.locationWatchId = navigator.geolocation.watchPosition(
        ({ coords }) => this.#showUserLocation(coords),
        () => {},
        { enableHighAccuracy: true, maximumAge: 10000 },
      );
    }
    if (!move) return position.coords;
    return await this.view.goTo({ center: [position.coords.longitude, position.coords.latitude], zoom: 15, tilt: 0 });
  }

  #showUserLocation({ longitude, latitude, accuracy }) {
    if (!this.locationLayer || !this.modules.Graphic || !Number.isFinite(longitude) || !Number.isFinite(latitude)) return;
    this.locationLayer.graphics.filter((graphic) => graphic.attributes?.kind === "user").forEach((graphic) => this.locationLayer.remove(graphic));
    const geometry = { type: "point", longitude, latitude };
    const halo = new this.modules.Graphic({
      geometry,
      attributes: { kind: "user", accuracy: Math.round(accuracy || 0) },
      symbol: { type: "simple-marker", style: "circle", size: 30, color: [37, 99, 235, 0.18], outline: { color: [37, 99, 235, 0.35], width: 1 } },
    });
    const dot = new this.modules.Graphic({
      geometry,
      attributes: { kind: "user" },
      symbol: { type: "simple-marker", style: "circle", size: 14, color: [37, 99, 235, 1], outline: { color: [255, 255, 255, 1], width: 2.5 } },
    });
    this.locationLayer.addMany([halo, dot]);
  }

  setMapNoteMarkers(points = []) {
    if (!this.locationLayer || !this.modules.Graphic) return;
    this.locationLayer.graphics.filter((graphic) => graphic.attributes?.kind === "map-note").forEach((graphic) => this.locationLayer.remove(graphic));
    for (const point of points) {
      if (!Number.isFinite(point.longitude) || !Number.isFinite(point.latitude)) continue;
      this.locationLayer.add(new this.modules.Graphic({ geometry: { type: "point", longitude: point.longitude, latitude: point.latitude }, attributes: { kind: "map-note" }, symbol: { type: "simple-marker", style: "circle", size: point.draft ? 16 : 13, color: point.draft ? "#f3ae2b" : "#087c68", outline: { color: "#ffffff", width: 2 } } }));
    }
  }

  /** Marks the place (or places) a field task points at; pass nothing to clear them. */
  setTaskPin(points = null) {
    if (!this.locationLayer) return;
    this.locationLayer.graphics.filter((graphic) => graphic.attributes?.kind === "task").forEach((graphic) => this.locationLayer.remove(graphic));
    if (!this.modules.Graphic) return;
    (Array.isArray(points) ? points : [points])
      .filter((point) => point && Number.isFinite(point.longitude) && Number.isFinite(point.latitude))
      .forEach((point) => this.locationLayer.add(new this.modules.Graphic({
        geometry: { type: "point", longitude: point.longitude, latitude: point.latitude },
        attributes: { kind: "task", pin: point.kind || "task", label: point.label || "" },
        // Amber diamonds for where the task points; a green circle for where it was completed.
        symbol: point.kind === "checkin"
          ? { type: "simple-marker", style: "circle", size: 18, color: [15, 143, 110, 1], outline: { color: [255, 255, 255, 1], width: 3 } }
          : { type: "simple-marker", style: "diamond", size: point.kind === "feature" ? 15 : 20, color: [217, 149, 30, 1], outline: { color: [255, 255, 255, 1], width: 2.5 } },
      })));
  }

  /** Frames a set of field task places (one place: a close-up; several: their extent). */
  async goToTaskPlaces(points = [], { animate = true } = {}) {
    const places = points.filter((point) => Number.isFinite(point?.longitude) && Number.isFinite(point?.latitude));
    if (!this.view || !places.length) return;
    const longitudes = places.map((point) => point.longitude);
    const latitudes = places.map((point) => point.latitude);
    const pad = (min, max) => Math.max((max - min) * 0.2, 0.002);
    const [west, east, south, north] = [Math.min(...longitudes), Math.max(...longitudes), Math.min(...latitudes), Math.max(...latitudes)];
    const target = places.length === 1
      ? { center: [places[0].longitude, places[0].latitude], zoom: 16, tilt: 0, heading: 0 }
      // goTo does not autocast a plain extent object, so build a real Extent.
      : { target: new this.modules.Extent({ xmin: west - pad(west, east), xmax: east + pad(west, east), ymin: south - pad(south, north), ymax: north + pad(south, north), spatialReference: { wkid: 4326 } }), tilt: 0, heading: 0 };
    await this.view.when?.();
    await this.view.goTo(target, { animate });
  }

  /**
   * Captures the map framed on a field task's places, pinned, then puts the
   * camera and pins back the way they were.
   */
  async captureTaskMap(points = []) {
    const places = points.filter((point) => Number.isFinite(point?.longitude) && Number.isFinite(point?.latitude));
    if (!this.view?.takeScreenshot || !places.length) return null;
    const camera = this.view.camera?.clone?.();
    const previousPins = this.locationLayer?.graphics.filter((graphic) => graphic.attributes?.kind === "task").toArray() ?? [];
    this.setTaskPin(places);
    try {
      await this.goToTaskPlaces(places, { animate: false });
      // Give tiles a moment to arrive before the snapshot.
      const started = Date.now();
      while (this.view.updating && Date.now() - started < 8000) await new Promise((resolve) => setTimeout(resolve, 150));
      // A 4:3 crop around the centre keeps the pins in frame on tall phone screens.
      const width = this.view.width;
      const height = Math.min(this.view.height, Math.round(width * 0.75));
      const capture = await this.view.takeScreenshot({ format: "jpg", quality: 82, width: 1200, area: { x: 0, y: Math.round((this.view.height - height) / 2), width, height } });
      return capture?.dataUrl && capture?.data ? { dataUrl: capture.dataUrl, width: capture.data.width, height: capture.data.height } : null;
    } finally {
      this.locationLayer?.graphics.filter((graphic) => graphic.attributes?.kind === "task").forEach((graphic) => this.locationLayer.remove(graphic));
      if (previousPins.length) this.locationLayer?.addMany(previousPins);
      if (camera) await this.view.goTo(camera, { animate: false }).catch(() => {});
    }
  }

  /**
   * Snapshots of several map views (for briefing PDFs). Each target is a goTo
   * target or null for the current view; images are cropped to `aspect` around
   * the centre. The camera returns to where it was afterwards.
   */
  async captureViews(targets = [], { aspect = 4 / 3, width = 1400, onProgress = () => {}, prepare = null } = {}) {
    if (!this.view?.takeScreenshot) return targets.map(() => null);
    const camera = this.view.camera?.clone?.();
    const images = [];
    try {
      for (const [index, target] of targets.entries()) {
        onProgress(index, targets.length);
        try {
          if (target) await this.view.goTo(this.#goToTarget(target), { animate: false });
          if (prepare) await prepare(index, target);
          const started = Date.now();
          await new Promise((resolve) => setTimeout(resolve, 120));
          while (this.view.updating && Date.now() - started < 8000) await new Promise((resolve) => setTimeout(resolve, 150));
          const viewWidth = this.view.width;
          const viewHeight = this.view.height;
          const cropWidth = Math.min(viewWidth, Math.round(viewHeight * aspect));
          const cropHeight = Math.min(viewHeight, Math.round(cropWidth / aspect));
          const capture = await this.view.takeScreenshot({ format: "jpg", quality: 84, width: Math.min(width, cropWidth * 2), area: { x: Math.round((viewWidth - cropWidth) / 2), y: Math.round((viewHeight - cropHeight) / 2), width: cropWidth, height: cropHeight } });
          images.push(capture?.dataUrl && capture?.data ? { dataUrl: capture.dataUrl, width: capture.data.width, height: capture.data.height } : null);
        } catch {
          images.push(null);
        }
      }
    } finally {
      if (camera) await this.view.goTo(camera, { animate: false }).catch(() => {});
    }
    return images;
  }

  #operationalLayers() {
    return this.map?.layers?.toArray()
      .filter((layer) => !this.#internal(layer)) ?? [];
  }

  setTourMarkers(chapters = [], activeIndex = null) {
    this.tourMarkerChapters = Array.isArray(chapters) ? chapters : [];
    this.tourMarkerActiveIndex = Number.isInteger(activeIndex) ? activeIndex : null;
    this.tourLayer?.removeAll();
    if (!this.tourLayer || !this.modules.Graphic) return;

    const graphics = [];
    this.tourMarkerChapters.forEach((chapter, chapterIndex) => {
      const point = tourChapterPoint(chapter);
      if (!point) return;
      const active = chapterIndex === this.tourMarkerActiveIndex;
      const geometry = { type: "point", longitude: point.longitude, latitude: point.latitude, spatialReference: { wkid: 4326 } };
      const attributes = { tourMarker: true, chapterIndex, title: String(chapter?.title || `Chapter ${chapterIndex + 1}`) };
      graphics.push(new this.modules.Graphic({
        geometry,
        attributes,
        symbol: {
          type: "picture-marker",
          url: tourMarkerDataUrl(active),
          width: active ? 44 : 36,
          height: active ? 58 : 48,
          yoffset: active ? 29 : 24,
        },
      }));
    });
    if (graphics.length) this.tourLayer.addMany(graphics);
  }

  setActiveTourMarker(index = null) {
    this.setTourMarkers(this.tourMarkerChapters, Number.isInteger(index) ? index : null);
  }

  clearTourMarkers() {
    this.tourMarkerChapters = [];
    this.tourMarkerActiveIndex = null;
    this.tourLayer?.removeAll();
  }


  getLayerConfig(ref) {
    const layer = this.#layer(ref);
    if (!layer) return null;
    const source = this.layerConfigs.get(layer.uid) ?? {};
    return {
      uid: layer.uid,
      id: layer.id,
      title: layer.title,
      type: layer.type,
      url: source.url ?? layer.url ?? null,
      sourceType: source.sourceType ?? layer.type,
      fileName: source.fileName ?? null,
      projectPath: source.projectPath ?? null,
      collectionKey: source.collectionKey ?? null,
      local: Boolean(source.local),
      visible: layer.visible,
      opacity: layer.opacity,
      refreshInterval: "refreshInterval" in layer ? layer.refreshInterval ?? 0 : 0,
      definitionExpression: layer.definitionExpression || source.definitionExpression || null,
      wfsName: source.wfsName ?? layer.name ?? null,
      customParameters: source.customParameters ?? layer.customParameters ?? null,
      // While a spatial chart is drawn, projects and links keep the style it was made from, plus the chart.
      elevationInfo: source.spatialChart ? source.chartRestore?.elevationInfo?.toJSON?.() ?? null : layer.elevationInfo?.toJSON?.() ?? source.elevationInfo ?? null,
      renderer: portableAssets(source.spatialChart ? source.chartRestore?.renderer?.toJSON?.() ?? null : layer.renderer?.toJSON?.() ?? null),
      spatialChart: source.spatialChart ? structuredClone(source.spatialChart) : null,
      // True when the style was set in GISMap Online (or arrived with a shared map), not the service's own.
      styled: Boolean(source.renderer),
      rendererSpec: source.rendererSpec ?? null,
      ignoreServiceScaleRange: Boolean(source.ignoreServiceScaleRange),
    };
  }

  /** The layer's scale range in effect, and whether it draws at the current scale. */
  scaleState(ref) {
    const layer = this.#layer(ref);
    const scale = this.view?.scale;
    const minScale = layer?.minScale || 0;
    const maxScale = layer?.maxScale || 0;
    const visibleAtCurrentScale = !Number.isFinite(scale) || ((!minScale || scale <= minScale) && (!maxScale || scale >= maxScale));
    const source = this.layerConfigs.get(layer?.uid) ?? {};
    return { minScale, maxScale, visibleAtCurrentScale, serviceMinScale: source.serviceScaleRange?.minScale ?? minScale, serviceMaxScale: source.serviceScaleRange?.maxScale ?? maxScale, ignored: Boolean(source.ignoreServiceScaleRange) };
  }

  #overrideScaleRange(layer, config) {
    config.serviceScaleRange ??= { minScale: layer.minScale || 0, maxScale: layer.maxScale || 0 };
    layer.minScale = 0;
    layer.maxScale = 0;
    config.ignoreServiceScaleRange = true;
  }

  /**
   * "Show anyway": draws a layer at every scale, ignoring the publisher's range
   * (kept in the project and in share links). `false` restores the publisher's range.
   */
  ignoreScaleRange(uid, ignore = true) {
    const layer = this.#layer(uid);
    if (!layer || !("minScale" in layer)) return false;
    const config = this.layerConfigs.get(uid) ?? {};
    if (ignore) this.#overrideScaleRange(layer, config);
    else {
      layer.minScale = config.serviceScaleRange?.minScale ?? layer.minScale;
      layer.maxScale = config.serviceScaleRange?.maxScale ?? layer.maxScale;
      config.ignoreServiceScaleRange = false;
    }
    this.layerConfigs.set(uid, config);
    this.events.publish("layer:changed", { uid });
    return true;
  }

  /** What the layer's own service JSON says about it: fields, scale range, freshness, sentinels. */
  layerMetadata(ref) {
    const layer = this.#layer(ref);
    const raw = layer?.sourceJSON;
    if (!raw || typeof raw !== "object") return null;
    const metadata = arcgisMetadata(raw, this.getLayerConfig(layer).url || layer.url || "");
    const range = this.layerConfigs.get(layer.uid)?.serviceScaleRange;
    if (range) Object.assign(metadata, range);
    return metadata;
  }

  /** Every value of a field under the layer's filter (paged; at most `limit`), for class breaks. */
  async fieldValues(ref, field, { limit = 20000 } = {}) {
    const layer = this.#layer(ref);
    if (typeof layer?.queryFeatures !== "function") return [];
    const values = [];
    const pageSize = Math.max(1, Math.min(layer.capabilities?.query?.maxRecordCount || 2000, 2000));
    const paged = layer.capabilities?.query?.supportsPagination !== false;
    for (let start = 0; start < limit; start += pageSize) {
      const query = layer.createQuery();
      Object.assign(query, { where: layer.definitionExpression || "1=1", outFields: [field], returnGeometry: false, num: pageSize });
      if (paged) query.start = start;
      const { features = [] } = await layer.queryFeatures(query);
      features.forEach((feature) => values.push(feature.attributes?.[field]));
      if (!paged || features.length < pageSize) break;
    }
    return values;
  }

  /**
   * The values a field takes, for filter suggestions: a coded-value domain's
   * codes and names, otherwise up to `limit` distinct values from the service
   * (every feature, not just the current filter), sorted. Returns
   * { values: [{ value, label }], complete } where complete is false when
   * there may be more values than were listed.
   */
  async distinctValues(ref, fieldName, { limit = 200 } = {}) {
    const layer = this.#layer(ref);
    const field = (layer?.fields || []).find((item) => item.name === fieldName);
    if (!field) return { values: [], complete: true };
    const coded = field.domain?.type === "coded-value" ? field.domain.codedValues || [] : [];
    if (coded.length) return { values: coded.slice(0, limit).map((item) => ({ value: item.code, label: String(item.name ?? item.code) })), complete: coded.length <= limit };
    if (typeof layer.queryFeatures !== "function" || /date|oid|geometry|guid|global-?id|blob/i.test(String(field.type || ""))) return { values: [], complete: true };
    const unique = (list) => [...new Set(list.filter((value) => value !== null && value !== undefined && value !== ""))]
      .sort((a, b) => (typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b))));
    let values;
    let sampled = false;
    try {
      const query = layer.createQuery();
      Object.assign(query, { where: "1=1", outFields: [fieldName], returnGeometry: false, returnDistinctValues: true, orderByFields: [fieldName], num: limit + 1 });
      const { features = [] } = await layer.queryFeatures(query);
      values = unique(features.map((feature) => feature.attributes?.[fieldName]));
    } catch {
      // Services without distinct queries: the values of a sample of features.
      const query = layer.createQuery();
      Object.assign(query, { where: "1=1", outFields: [fieldName], returnGeometry: false, num: 2000 });
      const { features = [] } = await layer.queryFeatures(query).catch(() => ({ features: [] }));
      values = unique(features.map((feature) => feature.attributes?.[fieldName]));
      sampled = features.length >= 2000;
    }
    return { values: values.slice(0, limit).map((value) => ({ value, label: String(value) })), complete: values.length <= limit && !sampled };
  }

  /**
   * Styles a layer from a RendererSpec (renderer-spec.js): validates it against
   * the layer's fields, computes class breaks from its values (sentinel codes
   * go to "No data"), and records the spec so projects and links keep it.
   * Returns { issues } with any warnings.
   */
  async applyRendererSpec(uid, input, { sentinels = [] } = {}) {
    const layer = this.#layer(uid);
    if (!layer) throw new GisMapError("NOT_FOUND", "That layer is not on the map.");
    await layer.load();
    if (!("renderer" in layer)) throw new GisMapError("UNSUPPORTED_LAYER_TYPE", `${layer.title || "This layer"} is drawn by its service and cannot be restyled.`);
    this.#dropSpatialChart(layer);
    const fields = (layer.fields || []).map((field) => ({ name: field.name, alias: field.alias, type: field.type }));
    const { valid, issues, spec: validated } = validateRendererSpec(input, { fields, geometryType: layer.geometryType });
    if (!valid) {
      const first = issues.find((issue) => issue.level === "error");
      throw new GisMapError(first.code === "FIELD_NOT_FOUND" ? "FIELD_NOT_FOUND" : "INVALID_SPEC", first.message, { hint: first.hint, details: { issues } });
    }
    const config = this.layerConfigs.get(uid) ?? {};
    // "auto" styles are decided from the data now, and recorded with their breaks.
    let spec = validated;
    let fetched = null;
    if (spec.type === "auto" || spec.method === "auto") {
      const field = spec.field || chooseStyleField(fields);
      if (!field) throw new GisMapError("INVALID_SPEC", `${layer.title || "This layer"} has no field to style by.`, { hint: 'Name a field, or use { "type": "simple" }.' });
      const fieldInfo = fields.find((item) => item.name === field);
      const exclude = spec.exclude ?? this.#sentinelCodes(sentinels, field);
      const values = await this.fieldValues(layer, field);
      fetched = { field, values };
      spec = resolveRendererSpec({ ...spec, field, ...(exclude.length ? { exclude } : {}) }, { values, fieldType: fieldInfo?.type, geometryType: layer.geometryType });
    }
    if (spec.type === "service") {
      if (config.serviceRenderer) this.restoreRenderer(layer, config.serviceRenderer);
      delete config.renderer;
      config.rendererSpec = null;
      this.layerConfigs.set(uid, config);
      this.events.publish("layer:changed", { uid });
      return { issues, spec };
    }
    if (spec.type === "arcgis") {
      this.restoreRenderer(layer, spec.json);
    } else {
      // Codes such as -1 ("Not Disclosed") stay out of the classes unless the spec says otherwise.
      if (["choropleth", "graduated-symbols"].includes(spec.type) && spec.exclude === undefined) {
        const codes = this.#sentinelCodes(sentinels, spec.field);
        if (codes.length) spec = { ...spec, exclude: codes };
      }
      let values = [];
      let categories = [];
      const valuesOf = (field, options) => (fetched?.field === field ? fetched.values : this.fieldValues(layer, field, options));
      if (["choropleth", "graduated-symbols"].includes(spec.type)) values = (await valuesOf(spec.field)).map(Number);
      if (spec.type === "categories") {
        const counts = new Map();
        (await valuesOf(spec.field, { limit: 10000 })).forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
        categories = [...counts].map(([value, count]) => ({ value, count }));
      }
      const alias = (layer.fields || []).find((field) => field.name === spec.field)?.alias;
      layer.renderer = compileRenderer(spec, { geometryType: layer.geometryType, values, categories, fieldAlias: alias });
    }
    config.renderer = layer.renderer?.toJSON?.() ?? null;
    config.rendererSpec = spec;
    this.layerConfigs.set(uid, config);
    this.events.publish("layer:changed", { uid });
    return { issues, spec };
  }

  #sentinelCodes(sentinels, field) {
    return sentinels.filter((item) => item.field === field && item.source !== "heuristic").map((item) => item.value);
  }

  /**
   * Ranked style options for one field of a layer (renderer-spec.js
   * suggestRenderers), from the values matching its current filter. Without a
   * field, the most measurement-like field is used.
   */
  async suggestRenderers(uid, { field = null, sentinels = null } = {}) {
    const layer = this.#layer(uid);
    if (!layer) throw new GisMapError("NOT_FOUND", "That layer is not on the map.");
    await layer.load();
    if (!("renderer" in layer) || typeof layer.queryFeatures !== "function") throw new GisMapError("UNSUPPORTED_LAYER_TYPE", `${layer.title || "This layer"} is drawn by its service and cannot be restyled.`);
    const fields = (layer.fields || []).map((item) => ({ name: item.name, alias: item.alias, type: item.type }));
    const name = field || chooseStyleField(fields);
    const fieldInfo = fields.find((item) => item.name === name) || fields.find((item) => item.name.toLowerCase() === String(name || "").toLowerCase());
    if (!fieldInfo) throw new GisMapError("FIELD_NOT_FOUND", name ? `Field \`${name}\` does not exist.` : `${layer.title || "This layer"} has no field to style by.`);
    const values = await this.fieldValues(layer, fieldInfo.name);
    const codes = this.#sentinelCodes(sentinels ?? this.layerMetadata(layer)?.sentinels ?? [], fieldInfo.name);
    const suggestion = suggestRenderers({ field: fieldInfo.name, fieldType: fieldInfo.type, geometryType: layer.geometryType, values, exclude: codes });
    return { ...suggestion, fieldAlias: fieldInfo.alias || fieldInfo.name, geometryType: layer.geometryType, sampled: values.length >= 20000 };
  }

  /** The extent to show a layer's (filtered) data, or null. */
  async layerExtent(layerOrUid) {
    const layer = this.#layer(layerOrUid);
    return layer ? this.#plainGeometry(await this.#zoomTarget(layer)) : null;
  }

  /** Fits the view to the combined (filtered) extent of several layers (uids or handles); all data layers when none are given. */
  async goToLayers(layers = null, { animate = true } = {}) {
    const combined = await this.#dataExtent(layers);
    if (!combined) return false;
    await this.view.goTo({ target: combined.expand(1.08), tilt: 0 }, { animate });
    return true;
  }

  /**
   * The [west, south, east, north] box in degrees that goToLayers frames: the
   * layers' filtered data, or its dense core when it spreads over half the world. Null without data.
   */
  async dataBounds(layers = null) {
    const extent = await this.#dataExtent(layers);
    if (!extent) return null;
    const geographic = this.modules.webMercatorUtils?.canProject(extent, { wkid: 4326 }) && extent.spatialReference?.isWebMercator
      ? this.modules.webMercatorUtils.webMercatorToGeographic(extent)
      : extent;
    return [geographic.xmin, geographic.ymin, geographic.xmax, geographic.ymax];
  }

  /** The combined extent of several layers' (filtered) data in the view's spatial reference, or null. */
  async #dataExtent(refs = null) {
    const layers = refs ? refs.map((ref) => this.#layer(ref)).filter(Boolean) : this.#operationalLayers();
    const extents = (await Promise.all(layers.map(async (layer) => {
      const full = await this.#zoomTarget(layer).catch(() => null);
      // A layer spread over half the world (U.S. counties with Alaska, Hawaii and
      // territories) frames its dense core instead, so the data fills the view.
      const footprint = full ? this.#geographicFootprint(full) : null;
      if (footprint && footprint.width > 60) return (await this.#coreExtent(layer).catch(() => null)) || full;
      return full;
    }))).filter(Boolean)
      .map((extent) => this.#toViewSpatialReference(extent)).filter(Boolean);
    if (!extents.length) return null;
    return extents.slice(1).reduce((union, extent) => union.union(extent), extents[0].clone());
  }

  /**
   * The extent holding most of a layer's features: feature centres between the
   * 2nd and 98th percentiles of longitude and latitude (filter-aware), or null.
   */
  async #coreExtent(layer) {
    if (typeof layer?.queryFeatures !== "function") return null;
    // Generalized geometry in degrees is light enough to read every feature's centre (up to 6,000).
    const pageSize = Math.max(1, Math.min(layer.capabilities?.query?.maxRecordCount || 2000, 2000));
    const paged = layer.capabilities?.query?.supportsPagination !== false;
    const features = [];
    for (let start = 0; start < 6000; start += pageSize) {
      const query = layer.createQuery();
      Object.assign(query, { where: layer.definitionExpression || "1=1", outFields: [], returnGeometry: true, maxAllowableOffset: 0.05, geometryPrecision: 3, outSpatialReference: { wkid: 4326 }, num: pageSize });
      if (paged) query.start = start;
      const page = (await layer.queryFeatures(query)).features || [];
      features.push(...page);
      if (!paged || page.length < pageSize) break;
    }
    const centre = (geometry) => (geometry?.type === "point" ? geometry : geometry?.centroid || geometry?.extent?.center || null);
    const points = features.map((feature) => centre(feature.geometry)).filter((point) => Number.isFinite(point?.x) && Number.isFinite(point?.y));
    if (points.length < 20) return null;
    const pick = (values, ratio) => values[Math.min(values.length - 1, Math.max(0, Math.round(ratio * (values.length - 1))))];
    const xs = points.map((point) => point.x).sort((a, b) => a - b);
    const ys = points.map((point) => point.y).sort((a, b) => a - b);
    const [xmin, xmax, ymin, ymax] = [pick(xs, 0.02), pick(xs, 0.98), pick(ys, 0.02), pick(ys, 0.98)];
    if (!(xmax > xmin && ymax > ymin)) return null;
    return new this.modules.Extent({ xmin, ymin, xmax, ymax, spatialReference: { wkid: 4326 } });
  }

  #toViewSpatialReference(extent) {
    const target = extent.declaredClass ? extent : this.modules.Extent.fromJSON(extent);
    const wkid = target.spatialReference?.latestWkid ?? target.spatialReference?.wkid;
    if ([4326, 4269].includes(wkid) && this.modules.webMercatorUtils?.canProject(target, this.view.spatialReference)) {
      return this.modules.webMercatorUtils.geographicToWebMercator(target);
    }
    return target;
  }

  getAllLayerConfigs() {
    return this.#operationalLayers().map((layer) => this.getLayerConfig(layer));
  }

  /** `silent` changes the layer without announcing it (slides, tours and project restores set many at once). */
  setVisibility(uid, visible, { silent = false } = {}) {
    const layer = this.#layer(uid);
    if (layer) layer.visible = visible;
    if (!silent) this.events.publish("layer:changed", { uid });
  }

  setOpacity(uid, opacity, { silent = false } = {}) {
    const layer = this.#layer(uid);
    if (layer) layer.opacity = silent ? opacity : Math.max(0, Math.min(1, Number(opacity)));
    if (!silent) this.events.publish("layer:changed", { uid });
  }

  /** Renames a layer (no event: the caller re-renders). */
  setTitle(uid, title) {
    const layer = this.#layer(uid);
    if (layer) layer.title = title;
  }

  /** The fields a feature layer fetches with its features. */
  setOutFields(uid, fields) {
    const layer = this.#layer(uid);
    if (layer && "outFields" in layer) layer.outFields = fields;
  }

  /** Asks the layer's service for fresh data now. */
  refreshLayer(uid) {
    this.#layer(uid)?.refresh?.();
  }

  setRefreshInterval(uid, minutes) {
    const layer = this.#layer(uid);
    if (!layer || !("refreshInterval" in layer)) {
      throw new Error("This layer type does not expose an automatic refresh interval.");
    }
    layer.refreshInterval = Math.max(0, Number(minutes) || 0);
    const config = this.layerConfigs.get(uid) ?? {};
    config.refreshInterval = layer.refreshInterval;
    this.layerConfigs.set(uid, config);
    this.events.publish("layer:changed", { uid });
  }

  /**
   * The layer's attribute filter. `persist: false` applies it for the moment
   * only (Isolate in Map Insight): no event, and projects and links keep the saved filter.
   */
  setDefinitionExpression(uid, expression, { persist = true } = {}) {
    const layer = this.#layer(uid);
    if (!layer || !("definitionExpression" in layer)) {
      throw new Error("This layer type does not support attribute filters.");
    }
    if (!persist) {
      layer.definitionExpression = expression;
      return expression;
    }
    const value = String(expression || "").trim() || null;
    layer.definitionExpression = value;
    const config = this.layerConfigs.get(uid) ?? {};
    config.definitionExpression = value;
    this.layerConfigs.set(uid, config);
    this.events.publish("layer:changed", { uid });
    return value;
  }

  restoreRenderer(ref, rendererJson) {
    rendererJson = loadableAssets(rendererJson);
    const layer = this.#layer(ref);
    if (!layer || !("renderer" in layer) || !rendererJson) return;
    this.#dropSpatialChart(layer);
    // renderer.toJSON() produces WebMap JSON names such as `classBreaks`,
    // `PolygonSymbol3D`, `Extrude`, and `sizeInfo`. Convert that serialized
    // form back into live SDK objects before assigning it. Direct autocasting
    // expects API-style names and may silently retain the service renderer.
    // Renderers written in the SDK's autocast form (catalog examples, RendererSpec output:
    // "class-breaks", "simple-fill", "point-3d", …) go straight in; the WebMap JSON
    // parser would accept them but silently drop their symbols.
    const autocast = /"type":"(class-breaks|unique-value|simple-(marker|fill|line)|picture-(marker|fill)|(point|line|polygon|mesh|label)-3d|web-style|text)"/.test(JSON.stringify(rendererJson));
    if (autocast) {
      layer.renderer = structuredClone(rendererJson);
      this.layerConfigs.set(layer.uid, { ...(this.layerConfigs.get(layer.uid) ?? {}), renderer: layer.renderer.toJSON?.() ?? structuredClone(rendererJson) });
      return;
    }
    try {
      const renderer = this.modules.rendererJsonUtils?.fromJSON?.(structuredClone(rendererJson));
      if (renderer) {
        layer.renderer = renderer;
        this.layerConfigs.set(layer.uid, { ...(this.layerConfigs.get(layer.uid) ?? {}), renderer: structuredClone(rendererJson) });
        return;
      }
    } catch { /* Some catalog renderers already use API autocast JSON. */ }
    layer.renderer = structuredClone(rendererJson);
    this.layerConfigs.set(layer.uid, { ...(this.layerConfigs.get(layer.uid) ?? {}), renderer: structuredClone(rendererJson) });
  }

  /**
   * Draws the layer with a renderer (SDK autocast JSON) for now, without recording
   * it as the layer's GISMap Online style (the Explorer's "style by this chart").
   */
  setRenderer(uid, renderer) {
    const layer = this.#layer(uid);
    if (layer && "renderer" in layer) layer.renderer = renderer;
  }

  /** Records the RendererSpec a restored style was made from, so projects and links keep it. */
  recordRendererSpec(uid, rendererSpec) {
    const source = this.layerConfigs.get(uid);
    if (source) source.rendererSpec = rendererSpec;
  }

  async setLayerSymbology(uid, options = {}) {
    const layer = this.#layer(uid);
    if (!layer || !("renderer" in layer)) throw new Error("This layer does not support client-side renderers.");
    await layer.load();
    this.#dropSpatialChart(layer);
    const color = options.color || "#1b7f6a";
    const outline = options.outline || "#ffffff";
    const geometryType = layer.geometryType;
    const mode = ["simple", "categorized", "graduated"].includes(options.mode) ? options.mode : "simple";
    if (["polygon", "point", "multipoint"].includes(geometryType) && options.extrusionEnabled && options.extrusionSource === "field") {
      this.#requireStyleField(layer, options.extrusionField, true);
    }
    const makeSymbol = (symbolColor) => this.#styleSymbol(geometryType, { ...options, color: symbolColor }, outline);
    let renderer;

    if (options.extrusionEnabled && options.preserveClasses && ["class-breaks", "unique-value"].includes(layer.renderer?.type)) {
      const current = layer.renderer.toJSON?.() ?? structuredClone(layer.renderer);
      const colorOf = (symbol) => symbol?.color ?? symbol?.symbolLayers?.[0]?.material?.color ?? color;
      renderer = { ...current, type: layer.renderer.type };
      if (renderer.classBreakInfos) renderer.classBreakInfos = renderer.classBreakInfos.map((item) => ({ ...item, symbol: makeSymbol(colorOf(item.symbol)) }));
      if (renderer.uniqueValueInfos) renderer.uniqueValueInfos = renderer.uniqueValueInfos.map((item) => ({ ...item, symbol: makeSymbol(colorOf(item.symbol)) }));
      if (renderer.defaultSymbol) renderer.defaultSymbol = makeSymbol(colorOf(renderer.defaultSymbol));
    } else if (mode === "categorized") {
      const field = this.#requireStyleField(layer, options.field);
      const values = await this.#styleFieldValues(layer, field.name, false);
      if (!values.length) throw new Error("The active layer filter has no values for that field.");
      const palette = ["#1b7f6a", "#3d7db8", "#d9951e", "#ab5d8d", "#728b3f", "#8054a0", "#bf6545", "#287b83", "#a36d26", "#656fb0", "#9a4b5a", "#4c8f73"];
      renderer = {
        type: "unique-value",
        field: field.name,
        uniqueValueInfos: values.slice(0, 12).map((value, index) => ({
          value,
          label: String(value),
          symbol: makeSymbol(palette[index]),
        })),
        defaultSymbol: makeSymbol(color),
        defaultLabel: "Other values",
      };
    } else if (mode === "graduated") {
      const field = this.#requireStyleField(layer, options.field, true);
      const values = await this.#styleFieldValues(layer, field.name, true);
      if (!values.length) throw new Error("The active layer filter has no numeric values for that field.");
      const minimum = Math.min(...values);
      const maximum = Math.max(...values);
      const palette = ["#d9eee8", "#a8d8ca", "#73b8a4", "#3b927a", "#176756"];
      const span = maximum - minimum || 1;
      renderer = {
        type: "class-breaks",
        field: field.name,
        classBreakInfos: palette.map((breakColor, index) => {
          const minValue = minimum + ((span / palette.length) * index);
          const maxValue = index === palette.length - 1 ? maximum : minimum + ((span / palette.length) * (index + 1));
          return {
            minValue,
            maxValue,
            label: `${this.#formatStyleNumber(minValue)} – ${this.#formatStyleNumber(maxValue)}`,
            symbol: makeSymbol(breakColor),
          };
        }),
      };
    } else {
      renderer = { type: "simple", symbol: makeSymbol(color) };
    }
    const extrusionVariable = this.#extrusionVisualVariable(geometryType, options);
    if (extrusionVariable) renderer.visualVariables = [extrusionVariable];
    layer.renderer = renderer;
    const config = this.layerConfigs.get(uid) ?? {};
    config.renderer = layer.renderer.toJSON?.() ?? structuredClone(layer.renderer);
    config.rendererSpec = null;
    this.layerConfigs.set(uid, config);
    this.events.publish("layer:changed", { uid });
  }

  /**
   * A portable 3D spatial chart (js/spatial-chart.js) drawn with SceneView
   * extrusion symbols and per-group elevation; null returns to the layer's style.
   */
  async setSpatialChart(uid, input = null) {
    const layer = this.#layer(uid);
    if (!layer || !("renderer" in layer)) throw new GisMapError("UNSUPPORTED_LAYER_TYPE", "3D spatial charts need a feature layer.");
    await layer.load();
    const config = this.layerConfigs.get(layer.uid) ?? {};
    this.layerConfigs.set(layer.uid, config);
    if (!input) {
      this.#dropSpatialChart(layer);
      this.events.publish("layer:changed", { uid: layer.uid });
      return null;
    }
    const groupBy = String(input.groupBy || "");
    const groupValues = groupBy ? await this.#styleFieldValues(layer, groupBy, false) : [];
    const fields = (layer.fields || []).map((field) => ({ name: field.name, alias: field.alias, type: field.type }));
    const chart = normalizeSpatialChart(input, { fields, geometryType: layer.geometryType, groupValues });
    // The style the chart was made from is kept, so removing the chart (or saving the project) returns to it.
    config.chartRestore ??= { renderer: layer.renderer?.clone?.() ?? null, elevationInfo: layer.elevationInfo?.clone?.() ?? null };
    const { renderer, elevationInfo } = spatialChartArcgis(chart, this.#rendererPalette(config.chartRestore.renderer));
    layer.renderer = renderer;
    layer.elevationInfo = elevationInfo;
    config.spatialChart = chart;
    this.events.publish("layer:changed", { uid: layer.uid });
    return structuredClone(chart);
  }

  #dropSpatialChart(layer) {
    const config = this.layerConfigs.get(layer.uid);
    if (!config?.spatialChart) return;
    const { renderer, elevationInfo } = config.chartRestore || {};
    if (renderer) layer.renderer = renderer;
    layer.elevationInfo = elevationInfo || { mode: "on-the-ground" };
    config.spatialChart = null;
    config.chartRestore = null;
  }

  /** The current style's classes and colours (live SDK renderer), for extruding without losing them. */
  #rendererPalette(renderer) {
    const colorOf = (symbol) => {
      const color = symbol?.color ?? symbol?.symbolLayers?.getItemAt?.(0)?.material?.color ?? symbol?.symbolLayers?.[0]?.material?.color;
      return color?.toRgba?.() ?? color ?? null;
    };
    const otherVariables = (renderer?.visualVariables || []).filter((variable) => variable.type !== "size").map((variable) => variable.toJSON?.() ?? variable);
    if (renderer?.type === "class-breaks") return { type: "class-breaks", field: renderer.field, classBreaks: renderer.classBreakInfos.map((info) => ({ minValue: info.minValue, maxValue: info.maxValue, label: info.label, color: colorOf(info.symbol) })), defaultColor: colorOf(renderer.defaultSymbol), defaultLabel: renderer.defaultLabel, visualVariables: otherVariables };
    if (renderer?.type === "unique-value" && renderer.field) return { type: "unique-value", field: renderer.field, uniqueValues: renderer.uniqueValueInfos.map((info) => ({ value: info.value, label: info.label, color: colorOf(info.symbol) })), defaultColor: colorOf(renderer.defaultSymbol), defaultLabel: renderer.defaultLabel, visualVariables: otherVariables };
    return { type: "simple", defaultColor: colorOf(renderer?.symbol) || "#1b7f6a", visualVariables: otherVariables };
  }

  async setSimpleSymbology(uid, options) {
    return this.setLayerSymbology(uid, { ...options, mode: "simple" });
  }

  #styleSymbol(geometryType, options, outline) {
    const size = Number(options.size);
    const extrusionEnabled = options.extrusionEnabled && ["polygon", "point", "multipoint"].includes(geometryType);
    if (geometryType === "point" || geometryType === "multipoint") {
      if (extrusionEnabled) {
        const width = Math.max(1, Number(options.extrusionWidth) || 650);
        return {
          type: "point-3d",
          symbolLayers: [{
            type: "object",
            resource: { primitive: "cylinder" },
            width,
            depth: width,
            height: options.extrusionSource === "fixed" ? Math.max(0, Number(options.extrusionValue) || 0) : 1,
            anchor: "bottom",
            material: { color: options.color },
          }],
        };
      }
      if (options.markerSymbol) {
        const markerSize = Math.min(48, Math.max(10, Number.isFinite(size) ? size * 2.2 : 20));
        return { type: "picture-marker", url: loadableAssets({ url: options.markerSymbol }).url, width: markerSize, height: markerSize };
      }
      return { type: "simple-marker", color: options.color, size: Number.isFinite(size) ? size : 9, outline: { color: outline, width: 1 } };
    }
    if (geometryType === "polyline") {
      return { type: "simple-line", color: options.color, width: Number.isFinite(size) ? size : 2.5 };
    }
    const fillOpacity = Math.min(1, Math.max(0, Number(options.fillOpacity)));
    const rgba = options.noFill ? [0, 0, 0, 0] : this.#hexToRgba(options.color, Number.isFinite(fillOpacity) ? fillOpacity : 0.35);
    if (extrusionEnabled) {
      return {
        type: "polygon-3d",
        symbolLayers: [{
          type: "extrude",
          size: options.extrusionSource === "fixed" ? Math.max(0, Number(options.extrusionValue) || 0) : 0,
          material: { color: rgba },
          edges: { type: "solid", color: outline, size: Number.isFinite(size) ? size : 1.5 },
        }],
      };
    }
    return {
      type: "simple-fill",
      style: options.noFill ? "none" : "solid",
      color: rgba,
      outline: { color: outline, width: Number.isFinite(size) ? size : 1.5 },
    };
  }

  #extrusionVisualVariable(geometryType, options) {
    if (!["polygon", "point", "multipoint"].includes(geometryType) || !options.extrusionEnabled || options.extrusionSource !== "field") return null;
    const field = String(options.extrusionField || "").trim();
    if (!field) throw new Error("Choose a numeric field to drive extrusion height.");
    const multiplier = Math.max(0, Number(options.extrusionMultiplier) || 1);
    return {
      type: "size",
      valueExpression: `$feature[${JSON.stringify(field)}] * ${multiplier}`,
      valueUnit: "meters",
      ...((geometryType === "point" || geometryType === "multipoint") ? { axis: "height" } : {}),
    };
  }

  #requireStyleField(layer, fieldName, numeric = false) {
    const field = (layer.fields ?? []).find((candidate) => candidate.name === fieldName);
    if (!field) throw new Error("Choose a field for the renderer.");
    if (numeric && !this.#isNumericField(field)) throw new Error("Graduated styles require a numeric field.");
    return field;
  }

  async #styleFieldValues(layer, fieldName, numeric) {
    if (typeof layer.queryFeatures !== "function") throw new Error("This layer cannot be queried for field-based styles.");
    const query = layer.createQuery?.() ?? {};
    query.where = layer.definitionExpression || "1=1";
    query.outFields = [fieldName];
    query.returnGeometry = false;
    // Public FeatureServers commonly cap a single query at 1,000 records.
    // A bounded sample is enough to derive an editor renderer and avoids
    // turning a style change into a costly or rejected service request.
    query.num = 1000;
    const response = await layer.queryFeatures(query);
    const raw = (response.features ?? []).map((feature) => feature.attributes?.[fieldName]);
    if (numeric) return raw.map(Number).filter(Number.isFinite);
    return [...new Set(raw.filter((value) => value !== null && value !== undefined && String(value).trim() !== ""))];
  }

  #isNumericField(field) {
    // Object IDs are numeric implementation keys, not measurements. Do not
    // offer them as graduated-style or extrusion fields.
    return /^(?:small-integer|integer|single|double|long)$/i.test(String(field?.type || ""));
  }

  #formatStyleNumber(value) {
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
  }

  #hexToRgba(hex, alpha) {
    const value = hex.replace("#", "");
    return [0, 2, 4].map((index) => parseInt(value.slice(index, index + 2), 16)).concat(alpha);
  }

  async clearOperationalLayers() {
    this.#operationalLayers().forEach((layer) => this.map.remove(layer));
    this.#sublayers.clear();
    this.layerConfigs.clear();
    this.localAssets.clear();
    this.events.publish("layers:reset");
  }

  setBasemap(id) {
    const next = id || "topo-3d";
    // Before the map exists, a basemap requested by the link wins over settings and defaults.
    if (!this.map && this.initialBasemapId) return;
    // Re-assigning the same basemap would tear down and rebuild its layer views for nothing.
    if (this.map && next === this.basemapId && this.map.basemap) return;
    this.basemapId = next;
    if (this.map) this.map.basemap = this.#sdkBasemap(this.basemapId);
    this.events.publish("map:basemap-changed", { id: this.basemapId });
  }

  /**
   * The ArcGIS basemap for a GISMap Online basemap id. ArcGIS cannot restyle its
   * basemaps by skin, so the "skin" basemap is the light or dark gray canvas
   * that suits the skin; OpenFreeMap ids draw their ArcGIS equivalents.
   */
  #sdkBasemap(id) {
    return id === "skin" ? (this.basemapTheme?.dark ? "dark-gray-vector" : "gray-vector") : basemapOnEngine(id, "arcgis");
  }

  /** The basemaps this engine draws, and the one it is drawing now (an OpenFreeMap id from a link shows as its ArcGIS equivalent). */
  getBasemapOptions() {
    return { selected: basemapOnEngine(this.basemapId, "arcgis"), options: basemapsForEngine("arcgis") };
  }

  /** The active skin's basemap theme: only light or dark matters here. */
  setBasemapTheme(theme) {
    const wasDark = Boolean(this.basemapTheme?.dark);
    this.basemapTheme = theme || null;
    if (this.map && this.basemapId === "skin" && wasDark !== Boolean(this.basemapTheme?.dark)) this.map.basemap = this.#sdkBasemap("skin");
  }

  /**
   * The basemap the scene starts with, from the link (`?basemap=`, `#map=`),
   * set before initialize() so the default basemap is never created and then
   * swapped mid-draw (which raced: "Could not draw Topographic … hasLayerViewModule").
   */
  setInitialBasemap(id) {
    if (this.map || !id) return;
    this.initialBasemapId = String(id);
    this.basemapId = this.initialBasemapId;
  }

  getBasemapId() {
    return this.basemapId;
  }

  setDefaultBasemap(id) {
    this.defaultBasemapId = String(id || "topo-3d");
    if (!this.map && !this.initialBasemapId) this.basemapId = this.defaultBasemapId;
  }

  getDefaultBasemapId() {
    return this.defaultBasemapId;
  }

  setGround(id) {
    this.groundId = id || "world-elevation";
    this.map.ground = this.groundId === "flat" ? new this.modules.Ground() : this.groundId;
    this.events.publish("map:ground-changed", { id: this.groundId });
  }

  getGroundId() {
    return this.groundId;
  }

  getViewState() {
    const camera = this.view?.camera?.toJSON?.() ?? null;
    const cameraPosition = this.view?.camera?.position;
    if (camera?.position && Number.isFinite(cameraPosition?.longitude) && Number.isFinite(cameraPosition?.latitude)) {
      camera.position = {
        x: cameraPosition.longitude,
        y: cameraPosition.latitude,
        z: cameraPosition.z,
        spatialReference: { wkid: 4326 },
      };
    }
    return {
      type: "scene",
      camera,
      center: this.view?.center ? [this.view.center.longitude, this.view.center.latitude] : null,
      zoom: this.view?.zoom,
      heading: this.view?.camera?.heading ?? 0,
      tilt: this.view?.camera?.tilt ?? 0,
    };
  }

  getCurrentExtentDetails() {
    const extent = this.view?.extent;
    if (!extent) return null;
    const wkid = extent.spatialReference?.latestWkid ?? extent.spatialReference?.wkid;
    const toGeographic = (x, y) => {
      if (![3857, 102100, 102113].includes(wkid)) return { longitude: x, latitude: y };
      const radius = 6378137;
      return {
        longitude: (x / radius) * (180 / Math.PI),
        latitude: (2 * Math.atan(Math.exp(y / radius)) - (Math.PI / 2)) * (180 / Math.PI),
      };
    };
    const toCoordinate = (longitude, latitude) => (
      Number.isFinite(longitude) && Number.isFinite(latitude)
        ? { longitude: Number(longitude.toFixed(6)), latitude: Number(latitude.toFixed(6)) }
        : null
    );
    const center = this.view?.center;
    const southwest = toGeographic(extent.xmin, extent.ymin);
    const northeast = toGeographic(extent.xmax, extent.ymax);
    return {
      west: Number(southwest.longitude.toFixed(6)),
      south: Number(southwest.latitude.toFixed(6)),
      east: Number(northeast.longitude.toFixed(6)),
      north: Number(northeast.latitude.toFixed(6)),
      center: toCoordinate(center?.longitude, center?.latitude),
      zoom: Number.isFinite(this.view?.zoom) ? Number(this.view.zoom.toFixed(2)) : null,
    };
  }

  async captureImage({ format = "jpg", quality = 82, width = 1200, height = null, aspect = null } = {}) {
    if (!this.view?.takeScreenshot) return null;
    const options = { format, width };
    if (format !== "png") options.quality = quality;
    if (Number.isFinite(aspect) && aspect > 0 && this.view.width && this.view.height) {
      const cropWidth = Math.min(this.view.width, Math.round(this.view.height * aspect));
      const cropHeight = Math.min(this.view.height, Math.round(cropWidth / aspect));
      options.width = Math.min(width, cropWidth * 2);
      options.area = { x: Math.round((this.view.width - cropWidth) / 2), y: Math.round((this.view.height - cropHeight) / 2), width: cropWidth, height: cropHeight };
    } else if (Number.isFinite(height)) options.height = height;
    const capture = await this.view.takeScreenshot(options);
    return capture?.dataUrl && capture?.data
      ? { dataUrl: capture.dataUrl, width: capture.data.width, height: capture.data.height }
      : null;
  }

  async restoreView(state) {
    if (state?.camera) {
      await this.view.goTo(state.camera, { animate: false });
      return;
    }
    if (!state?.center) return;
    await this.view.goTo({
      center: state.center,
      zoom: state.zoom ?? 4,
      heading: state.heading ?? state.rotation ?? 0,
      tilt: state.tilt ?? 35,
    });
  }

  /** The camera as the in-page API reports it: { center, zoom, scale, heading, tilt }, rounded. */
  getCamera() {
    if (!this.view) throw new GisMapError("NOT_READY", "The map is not ready yet.");
    const center = this.view.center;
    return {
      center: [Number(center.longitude.toFixed(6)), Number(center.latitude.toFixed(6))],
      zoom: Number(this.view.zoom.toFixed(2)),
      scale: Math.round(this.view.scale),
      heading: Number((this.view.camera?.heading ?? 0).toFixed(1)),
      tilt: Number((this.view.camera?.tilt ?? 0).toFixed(1)),
    };
  }

  /** The map scale at the view's centre (1:scale), or null before the view exists. */
  getScale() {
    return this.view?.scale ?? null;
  }

  /** The view's viewpoint as JSON (saved with tour chapters), or null. */
  getViewpoint() {
    return this.view?.viewpoint?.toJSON?.() || null;
  }

  /**
   * Moves the camera (engine-interface.js ViewTarget). Resolves once it arrives;
   * does nothing before the view exists.
   */
  async setView(target, options = undefined) {
    if (!this.view || !target) return;
    // `motion` is an engine-neutral Briefing preference. ArcGIS chooses its
    // native goTo path, while MapLibre can distinguish flyTo from easeTo.
    const { motion: _motion, ...goToOptions } = options || {};
    await this.view.goTo(this.#goToTarget(target), goToOptions);
  }

  /** A ViewTarget as an SDK goTo target. */
  #goToTarget(target) {
    if (target.camera) return target.camera;
    if (target.viewpoint) return target.viewpoint;
    if (Array.isArray(target.features)) {
      return target.features.map((feature) => this.#sdkGeometry(feature?.geometry)).filter(Boolean);
    }
    if (Array.isArray(target.bounds)) {
      const [xmin, ymin, xmax, ymax] = target.bounds;
      const { bounds, ...rest } = target;
      return { ...rest, target: new this.modules.Extent({ xmin, ymin, xmax, ymax, spatialReference: { wkid: 4326 } }) };
    }
    if (target.geometry) {
      const geometry = this.#sdkGeometry(target.geometry);
      const { geometry: _, fit, ...rest } = target;
      if (fit === "feature") {
        if (geometry?.type === "point") return { target: geometry, zoom: 15, tilt: 0 };
        return { target: geometry?.extent?.clone?.().expand?.(1.25) ?? geometry, tilt: 0 };
      }
      return { ...rest, target: geometry };
    }
    return target;
  }

  /** The padding (pixels) the view centres within, or null. */
  getViewPadding() {
    return this.view?.padding ? { ...this.view.padding } : null;
  }

  setViewPadding(padding) {
    if (this.view) this.view.padding = padding || { top: 0, right: 0, bottom: 0, left: 0 };
  }

  /** The element the map draws into. */
  getContainer() {
    return this.view?.container ?? null;
  }

  /** Screen pixels (relative to the container) of [longitude, latitude, z], or null when off-view. */
  /** With `aboveGround`, Z is metres above the ground surface rather than above sea level. */
  mapToScreen([longitude, latitude, z = null, aboveGround = false] = []) {
    if (!this.view?.toScreen || !this.modules.geometryJsonUtils) return null;
    // No Z: on the ground surface, sampled from the view's elevation.
    let height = Number(z);
    if (z === null || z === undefined || !Number.isFinite(height) || aboveGround) {
      const offset = aboveGround && Number.isFinite(height) ? height : 0;
      const sampler = this.view.groundView?.elevationSampler;
      const ground = sampler ? this.modules.geometryJsonUtils.fromJSON({ x: longitude, y: latitude, spatialReference: { wkid: 4326 } }) : null;
      try { height = (ground ? sampler.queryElevation(ground)?.z ?? 0 : 0) + offset; } catch { height = offset; }
    }
    const point = this.modules.geometryJsonUtils.fromJSON({ x: longitude, y: latitude, z: height, spatialReference: { wkid: 4326 } });
    const screen = this.view.toScreen(point);
    return screen && Number.isFinite(screen.x) && Number.isFinite(screen.y) ? { x: screen.x, y: screen.y } : null;
  }

  /** [longitude, latitude, z] under a container pixel, or null off the globe. */
  screenToMap(x, y) {
    const point = this.view?.toMap?.({ x, y });
    if (!point) return null;
    const geographic = this.geographicCoordinates(this.#plainGeometry(point));
    const longitude = geographic?.longitude ?? point.longitude;
    const latitude = geographic?.latitude ?? point.latitude;
    return Number.isFinite(longitude) && Number.isFinite(latitude) ? [longitude, latitude, Number.isFinite(point.z) ? point.z : 0] : null;
  }

  /** The view's current extent as plain geometry JSON (usable as a query geometry), or null. */
  getViewExtent() {
    return this.#plainGeometry(this.view?.extent ?? null);
  }

  /**
   * A test for "is this geometry in the current view?", or null before the view
   * has an extent (callers then keep everything).
   */
  viewExtentFilter() {
    const extent = this.view?.extent;
    if (!extent) return null;
    return (geometry) => {
      const value = this.#sdkGeometry(geometry);
      return Boolean(extent.intersects?.(value?.extent || value));
    };
  }

  async navigate(action) {
    try {
      if (action === "home") return await this.view.goTo(this.defaultViewpoint);
      if (action === "in") return await this.view.zoomIn();
      if (action === "out") return await this.view.zoomOut();
      if (["north", "rotate-left", "rotate-right", "tilt-up", "tilt-down"].includes(action)) {
        const camera = this.view.camera.clone();
        if (action === "north") camera.heading = 0;
        if (action === "rotate-left") camera.heading -= 20;
        if (action === "rotate-right") camera.heading += 20;
        if (action === "tilt-up") camera.tilt = Math.min(88, camera.tilt + 10);
        if (action === "tilt-down") camera.tilt = Math.max(0, camera.tilt - 10);
        return await this.view.goTo(camera, { duration: 350 });
      }
      if (action === "locate") return await this.locateUser({ move: true });
    } catch (error) {
      if (isNavigationAbort(error)) return null;
      throw error;
    }
  }

  /** Places matching a text, or a "longitude, latitude" pair, as { label, location: [lon, lat], extent }. */
  async search(query) {
    const text = query.trim();
    const coordinates = text.match(/^\s*(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (coordinates) {
      const center = [Number(coordinates[1]), Number(coordinates[2])];
      return [{ label: `${center[0].toFixed(5)}, ${center[1].toFixed(5)}`, location: center }];
    }
    const response = await this.modules.locator.addressToLocations(ARCGIS_WORLD_GEOCODER, {
      address: { SingleLine: text },
      maxLocations: 6,
      outFields: ["PlaceName", "Type", "Addr_type"],
    });
    return response.map((candidate) => ({
      label: candidate.address,
      location: [candidate.location.longitude, candidate.location.latitude],
      extent: candidate.extent?.toJSON?.() ?? candidate.extent ?? undefined,
    }));
  }

  async goToSearchResult(result) {
    // Recent places come back from storage as plain JSON, which goTo does not autocast.
    const extent = result.extent && !result.extent.declaredClass && this.modules.Extent
      ? this.modules.Extent.fromJSON(result.extent)
      : result.extent;
    return extent
      ? this.view.goTo({ target: extent, tilt: 0 })
      : this.view.goTo({ center: result.location, zoom: 14, tilt: 0 });
  }

  resize() {
    this.view?.resize?.();
  }

  async goToLayer(layerOrUid) {
    const layer = this.#layer(layerOrUid);
    if (!layer?.fullExtent) return;
    const target = await this.#zoomTarget(layer);
    if (!target) return false;
    await this.view.goTo({ target, tilt: 0 });
    return true;
  }

  /** The filter-aware extent of a layer's data (queried live, else metadata), or null. */
  async #zoomTarget(layer) {
    if (!layer?.fullExtent) return null;
    const candidates = [layer.initialExtent, layer.fullExtent].filter((extent) => this.#isPlausibleExtent(extent));
    if (typeof layer.queryExtent === "function") {
      try {
        const query = layer.createQuery?.() ?? {};
        query.where = layer.definitionExpression || "1=1";
        query.outSpatialReference = this.view?.spatialReference;
        const result = await layer.queryExtent(query);
        if (result?.extent && this.#isPlausibleExtent(result.extent)) candidates.unshift(result.extent);
      } catch {
        // Some layer types advertise query support but reject extent-only queries.
        // Fall through to the metadata/fallback feature extent handling below.
      }
    }
    let target = this.#selectZoomExtent(candidates);
    if (!target && typeof layer.queryFeatures === "function") {
      const query = layer.createQuery?.() ?? {};
      query.where = layer.definitionExpression || "1=1";
      query.returnGeometry = true;
      query.outFields = [];
      query.num = 2000;
      query.outSpatialReference = layer.fullExtent?.spatialReference ?? this.view?.spatialReference;
      const { features = [] } = await layer.queryFeatures(query);
      const extents = features.map((feature) => feature.geometry?.extent).filter((extent) => this.#isPlausibleExtent(extent));
      if (extents.length) {
        const first = extents[0];
        const featureExtent = {
          type: "extent",
          xmin: Math.min(...extents.map((extent) => extent.xmin)),
          ymin: Math.min(...extents.map((extent) => extent.ymin)),
          xmax: Math.max(...extents.map((extent) => extent.xmax)),
          ymax: Math.max(...extents.map((extent) => extent.ymax)),
          spatialReference: first.spatialReference ?? this.view.spatialReference,
        };
        target = this.#selectZoomExtent([featureExtent]);
      }
    }
    return target || null;
  }

  async goToLayerOnInitialLoad(layerOrUid) {
    // Keep a user's working map view intact. A fresh, globe-level scene may still
    // benefit from an initial layer zoom, but a deliberate city/regional view should not move.
    if ((this.view?.zoom ?? Infinity) > 5.5) return false;
    return this.goToLayer(layerOrUid);
  }

  #isPlausibleExtent(extent) {
    if (!extent) return false;
    const wkid = extent.spatialReference?.latestWkid ?? extent.spatialReference?.wkid;
    if (![4326, 4269].includes(wkid)) return true;
    return extent.xmin >= -180 && extent.xmax <= 180 && extent.ymin >= -90 && extent.ymax <= 90;
  }

  #selectZoomExtent(extents) {
    const safe = extents.filter((extent) => this.#isZoomSafeExtent(extent));
    if (!safe.length) return null;
    return safe.sort((a, b) => this.#extentFootprint(a) - this.#extentFootprint(b))[0];
  }

  #isZoomSafeExtent(extent) {
    const footprint = this.#geographicFootprint(extent);
    if (!footprint) return false;
    const { width, height } = footprint;
    return Number.isFinite(width) && Number.isFinite(height) && width >= 0 && height >= 0 && (width > 0 || height > 0)
      && width < 250 && height < 120;
  }

  #extentFootprint(extent) {
    const footprint = this.#geographicFootprint(extent);
    return footprint ? footprint.width * footprint.height : Infinity;
  }

  #geographicFootprint(extent) {
    if (!this.#isPlausibleExtent(extent)) return null;
    const wkid = extent.spatialReference?.latestWkid ?? extent.spatialReference?.wkid;
    if ([4326, 4269].includes(wkid)) {
      return { width: Math.abs(extent.xmax - extent.xmin), height: Math.abs(extent.ymax - extent.ymin) };
    }
    if ([3857, 102100, 102113].includes(wkid)) {
      const world = 20037508.342789244;
      return {
        width: Math.abs(extent.xmax - extent.xmin) * 180 / world,
        height: Math.abs(extent.ymax - extent.ymin) * 180 / world,
      };
    }
    return { width: Math.abs(extent.xmax - extent.xmin), height: Math.abs(extent.ymax - extent.ymin) };
  }

  async goToFeature(feature, { animate = true } = {}) {
    const geometry = this.#sdkGeometry(feature?.geometry);
    if (!geometry) throw new Error("This record does not have a geometry to zoom to.");
    if (geometry.type === "point") {
      return this.view.goTo({ center: geometry, zoom: 15, tilt: 0 }, { animate });
    }
    const target = geometry.extent?.expand?.(1.25) ?? geometry.extent ?? geometry;
    return this.view.goTo({ target, tilt: 0 }, { animate });
  }

  /** Frames several features (presentation records, identify results). */
  async goToFeatures(features = [], options = undefined) {
    const geometries = features.map((feature) => this.#sdkGeometry(feature?.geometry)).filter(Boolean);
    if (geometries.length) await this.view?.goTo(geometries, options);
  }

  /** The address nearest a point in degrees: { address, attributes }, or null. */
  async reverseGeocode(point) {
    if (!Number.isFinite(Number(point?.longitude)) || !Number.isFinite(Number(point?.latitude))) return null;
    try {
      const result = await this.modules.locator.locationToAddress(ARCGIS_WORLD_GEOCODER, {
        location: { type: "point", longitude: Number(point.longitude), latitude: Number(point.latitude), spatialReference: { wkid: 4326 } },
      });
      return { address: result.address, attributes: result.attributes ?? {} };
    } catch {
      return null;
    }
  }

  #representativePoint(geometry) {
    if (!geometry) return null;
    return geometry.type === "point" ? geometry : geometry.centroid ?? geometry.extent?.center ?? null;
  }

  /** A geometry's representative point (its centroid for shapes) in degrees: { longitude, latitude }, or null. */
  geographicCoordinates(geometry) {
    let point = this.#representativePoint(this.#sdkGeometry(geometry));
    if (!point) return null;
    const wkid = point.spatialReference?.wkid;
    if (![4326, 4269].includes(wkid) && this.modules.webMercatorUtils?.canProject(point, { wkid: 4326 })) {
      point = this.modules.webMercatorUtils.project(point, { wkid: 4326 });
    }
    const longitude = Number(point.longitude ?? point.x);
    const latitude = Number(point.latitude ?? point.y);
    return Number.isFinite(longitude) && Number.isFinite(latitude) ? { longitude, latitude } : null;
  }

  /* ---------------- Queries ---------------- */

  /** The SDK query for engine-interface.js QueryParams, starting from the layer's own (filter included) unless `layerDefaults` is false. */
  #query(layer, params = {}, layerDefaults = true) {
    const query = layerDefaults ? layer.createQuery?.() ?? {} : {};
    const { geometry, outSpatialReference, ...rest } = params;
    Object.assign(query, rest);
    if (geometry === "view") query.geometry = this.view?.extent;
    else if (geometry) query.geometry = this.#sdkGeometry(geometry) ?? geometry;
    if (outSpatialReference === "view") {
      if (this.view?.spatialReference) query.outSpatialReference = this.view.spatialReference;
    } else if (outSpatialReference) {
      query.outSpatialReference = outSpatialReference;
    }
    return query;
  }

  #queryLayer(uid, method) {
    const layer = this.#layer(uid);
    if (typeof layer?.[method] !== "function") throw unsupported("query", `${layer?.title || "This layer"} cannot be queried.`);
    return layer;
  }

  /** Features matching a query: { features: [{ attributes, geometry }], exceededTransferLimit }. */
  async queryFeatures(uid, params = {}, { signal = undefined, layerDefaults = true } = {}) {
    const layer = this.#queryLayer(uid, "queryFeatures");
    const result = await layer.queryFeatures(this.#query(layer, params, layerDefaults), signal ? { signal } : undefined);
    return { features: (result?.features ?? []).map((graphic) => this.#feature(graphic)), exceededTransferLimit: Boolean(result?.exceededTransferLimit) };
  }

  async queryFeatureCount(uid, params = {}, { signal = undefined, layerDefaults = true } = {}) {
    const layer = this.#queryLayer(uid, "queryFeatureCount");
    return layer.queryFeatureCount(this.#query(layer, params, layerDefaults), signal ? { signal } : undefined);
  }

  async queryObjectIds(uid, params = {}, { signal = undefined, layerDefaults = true } = {}) {
    const layer = this.#queryLayer(uid, "queryObjectIds");
    return layer.queryObjectIds(this.#query(layer, params, layerDefaults), signal ? { signal } : undefined);
  }

  async getFeatureFilter(uid) {
    const layer = this.#layer(uid);
    if (!layer || !this.view?.whenLayerView) throw new Error('Layer filter is unavailable.');
    const layerView = await this.view.whenLayerView(layer);
    const filter = layerView.filter;
    return filter ? (filter.toJSON ? filter.toJSON() : { ...filter }) : null;
  }

  /**
   * Draws only some of a layer's features, without fetching again:
   * { where } or { objectIds }, or null for all of them. False when the layer cannot.
   */
  async setFeatureFilter(uid, filter) {
    const layer = this.#layer(uid);
    if (!layer || !this.view?.whenLayerView) return false;
    try {
      const layerView = await this.view.whenLayerView(layer);
      layerView.filter = filter ?? null;
      return true;
    } catch {
      return false;
    }
  }

  /* ---------------- Identify ---------------- */

  /**
   * What is at a clicked point (engine-interface.js ClickEvent): features the
   * scene draws there, and features of queryable layers within a few pixels.
   * Results are FeatureResults, not yet de-duplicated.
   */
  async identify(click) {
    const mapPoint = click?.mapPoint ? this.#sdkGeometry(click.mapPoint) ?? this.view?.toMap?.({ x: click.x, y: click.y }) : null;
    if (!mapPoint || !this.view) return [];
    const operationalLayers = this.#operationalLayers();
    const response = operationalLayers.length
      ? await this.view.hitTest({ x: click.x, y: click.y }, { include: operationalLayers })
      : { results: [] };
    const hits = (response.results ?? []).map((hit) => this.#normalizeHit(hit)).filter(Boolean);
    const fallback = await this.#queryQueryableLayers(click, mapPoint);
    return [...fallback, ...hits];
  }

  #source(layer) {
    return layer
      ? { url: layer.url ?? null, layerId: Number.isInteger(layer.layerId) ? layer.layerId : null, title: layer.title ?? "", objectIdField: layer.objectIdField ?? null, displayField: layer.displayField ?? null }
      : null;
  }

  #featureResult(graphic, root, layer, layerTitle) {
    const feature = this.#feature(graphic);
    return {
      kind: "feature",
      layerUid: root?.uid ?? layer?.uid ?? null,
      layerTitle,
      attributes: feature.attributes,
      geometry: feature.geometry,
      source: this.#source(layer),
    };
  }

  #normalizeHit(hit) {
    if (hit.type === "graphic" || hit.graphic) {
      const graphic = hit.graphic;
      const layer = graphic?.layer || graphic?.sourceLayer || graphic?.origin?.layer;
      const root = this.#operationalRoot(layer);
      if (!root) return null;
      return this.#featureResult(graphic, root, layer, graphic?.sourceLayer?.title ?? layer?.title ?? root.title ?? "Map feature");
    }
    if (hit.type === "media" || hit.element) {
      return { kind: "media", layerTitle: hit.layer?.title ?? "Media", attributes: {} };
    }
    if (hit.type === "raster-pixel" || hit.pixelData) {
      return {
        kind: "raster",
        layerUid: hit.layer?.uid ?? null,
        layerTitle: hit.layer?.title ?? "Imagery",
        attributes: { "Pixel value": hit.pixelData?.pixelValue ?? hit.value ?? "No data" },
      };
    }
    return null;
  }

  #operationalRoot(layer) {
    if (!layer) return null;
    const roots = this.#operationalLayers();
    let current = layer;
    while (current) {
      if (roots.includes(current)) return current;
      current = current.parent;
    }
    return roots.find((root) => root.allSublayers?.includes?.(layer)) ?? null;
  }

  async #queryQueryableLayers(click, mapPoint) {
    const layers = [];
    const visit = (layer) => {
      if (layer.sublayers?.length) layer.sublayers.forEach(visit);
      else layers.push(layer);
    };
    this.#operationalLayers().forEach(visit);
    const extent = this.#clickExtent(click, mapPoint);
    const jobs = layers
      .filter((layer) => {
        const root = this.#operationalRoot(layer);
        return layer.visible !== false && root?.visible !== false;
      })
      .map(async (layer) => {
        try {
          if (typeof layer.queryFeatures === "function") {
            const query = layer.createQuery?.() ?? {};
            Object.assign(query, {
              geometry: extent,
              spatialRelationship: "intersects",
              outFields: ["*"],
              returnGeometry: true,
              num: 10,
            });
            const set = await layer.queryFeatures(query);
            const root = this.#operationalRoot(layer);
            return (set.features ?? []).map((graphic) => this.#featureResult(graphic, root, layer, layer.title ?? layer.parent?.title ?? "Layer"));
          }
          if (typeof layer.identify === "function") {
            const identified = await layer.identify(mapPoint);
            return [{
              kind: "raster",
              layerUid: layer.uid,
              layerTitle: layer.title ?? "Imagery",
              attributes: identified?.value ? { Value: identified.value } : {},
            }];
          }
        } catch (error) {
          console.debug(`Identify fallback skipped for ${layer.title}`, error);
        }
        return [];
      });
    return (await Promise.all(jobs)).flat();
  }

  #clickExtent(click, mapPoint) {
    const view = this.view;
    const samples = [
      mapPoint,
      view.toMap({ x: click.x - 8, y: click.y }),
      view.toMap({ x: click.x + 8, y: click.y }),
      view.toMap({ x: click.x, y: click.y - 8 }),
      view.toMap({ x: click.x, y: click.y + 8 }),
    ].filter(Boolean);
    if (samples.length > 1) {
      return {
        type: "extent",
        xmin: Math.min(...samples.map((point) => point.x)),
        ymin: Math.min(...samples.map((point) => point.y)),
        xmax: Math.max(...samples.map((point) => point.x)),
        ymax: Math.max(...samples.map((point) => point.y)),
        spatialReference: mapPoint.spatialReference,
      };
    }
    const groundMeters = Math.max(5, Number(view.scale || 10000) * 0.000264583 * 8);
    const geographic = Boolean(mapPoint.spatialReference?.isGeographic);
    const latitude = mapPoint.latitude ?? mapPoint.y;
    const dx = geographic
      ? groundMeters / Math.max(111320 * Math.cos((latitude * Math.PI) / 180), 1000)
      : groundMeters;
    const dy = geographic ? groundMeters / 110540 : groundMeters;
    return {
      type: "extent",
      xmin: mapPoint.x - dx,
      ymin: mapPoint.y - dy,
      xmax: mapPoint.x + dx,
      ymax: mapPoint.y + dy,
      spatialReference: mapPoint.spatialReference,
    };
  }

  /** Whether a widget (legend, measurement, …) is open. */
  widgetOpen(name) {
    return this.widgets.has(name);
  }

  async toggleWidget(name) {
    const existing = this.widgets.get(name);
    if (existing) {
      if (existing.closest?.("#utility-panel") || existing.container?.closest?.("#utility-panel")) {
        document.querySelector(`[data-utility-pane="${name}"]`)?.replaceChildren();
      }
      else this.view.ui.remove(existing);
      await existing.destroy?.();
      this.widgets.delete(name);
      this.events.publish("widget:toggled", { name, open: false });
      return false;
    }
    const utilityHosts = {
      basemapGallery: "#utility-basemap-content",
      elevationProfile: "#utility-elevation-content",
      legend: "#utility-legend-content",
    };
    const componentTags = {
      basemapGallery: "arcgis-basemap-gallery",
      compass: "arcgis-compass",
    };
    if (componentTags[name]) {
      const tagName = componentTags[name];
      await customElements.whenDefined(tagName);
      const component = document.createElement(tagName);
      component.view = this.view;
      if (name === "basemapGallery") {
        component.addEventListener("arcgisPropertyChange", (event) => {
          if (event.detail?.name === "activeBasemap") {
            this.basemapId = this.map.basemap?.id || component.activeBasemap?.id || this.basemapId;
            this.events.publish("map:basemap-changed", { id: this.basemapId });
          }
        });
      }
      if (name === "basemapGallery") {
        const host = document.querySelector(utilityHosts[name]);
        host.replaceChildren(component);
      } else {
        this.view.ui.add(component, "top-right");
      }
      this.widgets.set(name, component);
      this.events.publish("widget:toggled", { name, open: true });
      return true;
    }
    const definitions = {
      measurement: ["@arcgis/core/widgets/Measurement.js", {}, "top-right"],
      elevationProfile: ["@arcgis/core/widgets/ElevationProfile.js", {}, "utility"],
      legend: ["@arcgis/core/widgets/Legend.js", {}, "utility"],
    };
    const definition = definitions[name];
    if (!definition) return false;
    const Widget = await $arcgis.import(definition[0]);
    const host = definition[2] === "utility" ? document.querySelector(utilityHosts[name]) : null;
    if (host) host.replaceChildren();
    const widget = new Widget({ view: this.view, container: host || undefined, ...definition[1] });
    if (!host) this.view.ui.add(widget, definition[2]);
    this.widgets.set(name, widget);
    this.events.publish("widget:toggled", { name, open: true });
    return true;
  }
}

export default ArcGISEngine;
