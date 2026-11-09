// The map engine contract. Everything outside js/engines/ talks to the map
// through one object that implements this interface (the ArcGIS adapter,
// js/engines/arcgis/arcgis-engine.js, and the MapLibre preview,
// js/engines/maplibre/maplibre-engine.js); it never sees a map SDK's own objects.
// What crosses the boundary is plain data: layer handles, features with plain
// JSON geometry, view states and screen points.
//
// An engine that cannot do something throws GisMapError("UNSUPPORTED_LAYER_TYPE"
// or "NOT_READY", …) with `details.capability` naming the missing capability, so
// callers (and agents) can tell "not here" from "went wrong". `unsupported()`
// builds that error.
import { GisMapError } from "../gismap-errors.js?v=0.54.0-print";

/**
 * What an engine may support. getCapabilities() returns the subset an engine has.
 * Callers check before offering a feature; engines throw `unsupported(name)` otherwise.
 */
export const ENGINE_CAPABILITIES = Object.freeze([
  "view-2d", // a flat map
  "view-3d", // a globe or scene: tilt, heading, elevation
  "spatial-chart-3d", // derived 3D chart layers with explicit virtual-Z semantics
  "three-3d", // three.js point clouds (LAS, LAZ, XYZ) and models (glTF, OBJ, PLY)
  "basemaps", // setBasemap(id)
  "basemap-themes", // setBasemapTheme(theme): the "skin" basemap drawn in the skin's colours
  "ground", // setGround(id): terrain elevation
  "layers-arcgis", // ArcGIS REST feature, map image and imagery services
  "layers-ogc", // WMS and WFS
  "layers-files", // GeoJSON, KML/KMZ and zipped shapefiles
  "query", // queryFeatures / queryFeatureCount / queryObjectIds
  "spatial-query", // the above with a geometry and spatial relationship
  "feature-filter", // setFeatureFilter: draw only some features without refetching
  "renderer-spec", // applyRendererSpec: renderer-spec.js styles
  "renderer-native", // restoreRenderer: the engine's own renderer JSON (ArcGIS WebMap JSON)
  "identify", // identify(screenPoint)
  "highlight", // highlightFeature
  "capture", // captureImage / captureViews
  "geocode", // search(text) / reverseGeocode({ longitude, latitude })
  "geocode-suggest",
  "buildings-3d", // setBuildings3d(on): extruded buildings on the basemap // search() may run as the user types (place suggestions)
  "subsurface", // setSubsurface / setUndergroundView: layers drawn below the ground, seen through a faded surface
  "draw", // draw(type), sketching graphics
  "widgets", // toggleWidget(name): legend, measurement, elevation profile, …
  "measurement", // interactive distance measurement
  "legend", // operational layer legend
  "tour-markers", // setTourMarkers
  "native", // native(): the SDK's own map and view, an escape hatch for custom tools
]);

/** The error an engine throws for an operation it does not support. */
export function unsupported(capability, message = `This map engine does not support ${capability}.`) {
  return new GisMapError("UNSUPPORTED_LAYER_TYPE", message, { details: { capability } });
}

/**
 * The small renderer contract every engine must implement. Higher-level map
 * workflows belong to MapController, while capability-specific operations may
 * be implemented by an engine and are exposed through the controller only when
 * that engine advertises the corresponding capability.
 */
export const ENGINE_METHODS = Object.freeze([
  // lifecycle
  "initialize", "destroy", "isReady", "whenReady", "getCapabilities", "resize",
  // basemap
  "setBasemap", "getBasemapId", "whenBasemapLoaded",
  // layers
  "addService", "removeLayer", "clearOperationalLayers", "getLayers", "getLayer", "loadLayer", "getLayerConfig",
  "setVisibility", "setOpacity", "setDefinitionExpression",
  // styling
  "applyRendererSpec",
  // queries
  "queryFeatures", "queryFeatureCount", "queryObjectIds", "setFeatureFilter", "getFeatureFilter",
  // view
  "getViewState", "setView", "getViewPadding", "setViewPadding", "getContainer", "getViewExtent",
  // interaction
  "identify",
  // capture
  "captureImage",
]);

/**
 * The stable application-facing facade. MapController implements this surface;
 * it supplies engine-neutral helpers itself and delegates renderer-specific
 * operations to the active engine. A future engine therefore does not need to
 * copy every ArcGIS workflow merely to start rendering maps.
 */
export const MAP_CONTROLLER_METHODS = Object.freeze([
  ...ENGINE_METHODS,
  "native", "switchEngine", "setInitialBasemap", "setDefaultBasemap", "getDefaultBasemapId", "setGround", "getGroundId",
  "setCinematicEffect", "clearCinematicEffect", "getCinematicEffectStats", "requestEffectFrame",
  "addLocalFile", "discoverFeatureServiceLayers", "getQueryableLayer", "getAllLayerConfigs",
  "setTitle", "setOutFields", "setRefreshInterval", "refreshLayer", "ignoreScaleRange", "scaleState", "layerMetadata", "getLocalAsset",
  "suggestRenderers", "restoreRenderer", "setRenderer", "recordRendererSpec", "setLayerSymbology", "setSpatialChart", "setSubsurface", "setUndergroundView", "getUndergroundView", "distinctValues", "fieldValues",
  "getCamera", "getScale", "getViewpoint", "getCurrentExtentDetails", "restoreView", "navigate", "viewExtentFilter",
  "goToLayer", "goToLayers", "goToLayerOnInitialLoad", "layerExtent", "dataBounds", "goToFeature", "goToFeatures", "goToSearchResult", "goToTaskPlaces",
  "highlightFeature", "clearFeatureHighlight", "configureInteractionFeedback", "clearClickMarker", "locateUser", "geographicCoordinates",
  "search", "reverseGeocode", "captureViews", "captureTaskMap",
  "draw", "hasDrawings", "clearDrawings", "getDrawGraphicsForExport", "getDrawingsStyle", "setDrawingsStyle", "setTaskPin", "setTourMarkers", "setActiveTourMarker", "clearTourMarkers", "toggleWidget", "widgetOpen",
  "setBasemapTheme", "getBasemapOptions", "getGroundOptions", "setBuildings3d",
  "getAttributionText", "getLegendData", "setLayerEffect", "getLayerEffect", "suspendLayerEffect",
]);

/** Capability used when an optional delegated method is absent. */
export const METHOD_CAPABILITIES = Object.freeze({
  native: "native", setGround: "ground", getGroundId: "ground",
  setCinematicEffect: "three-3d", clearCinematicEffect: "three-3d", getCinematicEffectStats: "three-3d", requestEffectFrame: "three-3d", setLayerEffect: "three-3d", getLayerEffect: "three-3d", suspendLayerEffect: "three-3d",
  addLocalFile: "layers-files", discoverFeatureServiceLayers: "layers-arcgis", getQueryableLayer: "query",
  suggestRenderers: "renderer-spec", restoreRenderer: "renderer-native", setRenderer: "renderer-native", setLayerSymbology: "renderer-native", setSpatialChart: "spatial-chart-3d", setSubsurface: "subsurface", setUndergroundView: "subsurface", getUndergroundView: "subsurface",
  distinctValues: "query", fieldValues: "query", navigate: "view-2d", viewExtentFilter: "spatial-query",
  goToLayer: "query", goToLayers: "query", goToLayerOnInitialLoad: "query", layerExtent: "query", dataBounds: "query",
  highlightFeature: "highlight", clearFeatureHighlight: "highlight", configureInteractionFeedback: "highlight", clearClickMarker: "highlight", locateUser: "view-2d",
  search: "geocode", reverseGeocode: "geocode", captureViews: "capture", captureTaskMap: "capture", getAttributionText: "capture", getLegendData: "capture",
  draw: "draw", hasDrawings: "draw", clearDrawings: "draw", getDrawGraphicsForExport: "draw", getDrawingsStyle: "draw", setDrawingsStyle: "draw", setTaskPin: "draw", setTourMarkers: "tour-markers", setActiveTourMarker: "tour-markers", clearTourMarkers: "tour-markers",
  toggleWidget: "widgets", widgetOpen: "widgets", setBasemapTheme: "basemap-themes", setBuildings3d: "buildings-3d", getBasemapOptions: "basemaps", getGroundOptions: "ground",
});

/**
 * Events an engine publishes on the app's event bus (all payloads are plain data):
 *   map:ready            { engine, zoom }
 *   map:click            ClickEvent
 *   view:pointer-move    { longitude, latitude, zoom }
 *   view:scale-change    { scale }
 *   view:stationary      {}
 *   layer:added          { layer: LayerHandle, config: LayerConfig }
 *   layer:removed        { uid }
 *   layer:changed        { uid }
 *   layers:reset         {}
 *   map:basemap-changed  { id }
 *   map:ground-changed   { id }
 *   map:underground-changed { enabled, groundOpacity }
 *   draw:complete        { feature: Feature }
 *   tour-marker:click    { index }
 *   widget:toggled       { name, open }
 *   app:error            { message }
 */
export const ENGINE_EVENTS = Object.freeze([
  "map:ready", "map:click", "view:pointer-move", "view:scale-change", "view:stationary",
  "layer:added", "layer:removed", "layer:changed", "layers:reset",
  "map:basemap-changed", "map:ground-changed", "map:underground-changed", "draw:complete", "tour-marker:click", "widget:toggled", "app:error",
]);

/**
 * @typedef {object} Field
 * @property {string} name
 * @property {string} [alias]
 * @property {string} type  "string" | "small-integer" | "integer" | "single" | "double" | "long" | "date" | "oid" | "guid" | "global-id" | …
 * @property {number} [length]
 * @property {boolean} [nullable]
 * @property {{ type: "coded-value", name?: string, codedValues: { code: any, name: string }[] } | { type: "range", name?: string, minValue: number, maxValue: number } | null} [domain]
 */

/**
 * A layer as callers see it: read-only, plain values (getters that read the
 * engine's live layer). Change a layer only through engine methods.
 * @typedef {object} LayerHandle
 * @property {string} uid           the engine's key for the layer (this session only)
 * @property {string} id            the layer's id (this session only, unless the engine was given one)
 * @property {string} title
 * @property {string|null} url      the service URL as the engine holds it (see getLayerConfig().url for the URL it was added with)
 * @property {number|null} layerId  the sublayer index in its service, when the URL is a service root
 * @property {string} type          the engine's layer type ("feature", "map-image", "geojson", …)
 * @property {Field[]} fields
 * @property {string|null} geometryType "point" | "multipoint" | "polyline" | "polygon" | "multipatch" | "mesh"
 * @property {string|null} objectIdField
 * @property {string|null} displayField
 * @property {boolean} visible
 * @property {number} opacity
 * @property {string|null} where     the layer's attribute filter (SQL where clause)
 * @property {object|null} rendererSpec  the renderer-spec.js style set in GISMap Online, if any
 * @property {object|null} renderer  the engine's renderer as JSON (ArcGIS: WebMap renderer JSON)
 * @property {number} minScale
 * @property {number} maxScale
 * @property {number} refreshInterval minutes
 * @property {"not-loaded"|"loading"|"loaded"|"failed"} loadStatus
 * @property {{ name: string, message: string }|null} loadError
 * @property {boolean} queryable     queryFeatures works on it
 * @property {boolean} countable     queryFeatureCount works on it
 * @property {boolean} objectIdQueryable queryObjectIds works on it
 * @property {boolean} filterable    setDefinitionExpression works on it
 * @property {boolean} stylable      it has a client-side renderer
 * @property {boolean} refreshable   it has a refresh interval
 * @property {number} maxRecordCount the most features one query returns (0 when unknown)
 * @property {boolean} paginated     queries can page with start/num
 * @property {string|null} parentTitle the containing layer's title (sublayers)
 */

/**
 * Geometry is plain JSON in the engine's own geometry format (ArcGIS JSON for
 * the ArcGIS engine: { x, y, spatialReference }, { rings }, { paths }, …).
 * Callers treat it as opaque: test it, keep it, hand it back to the engine
 * (goToFeature, geographicCoordinates, query geometry), or convert it with
 * export-core.js geometryToGeoJSON.
 * @typedef {object} Geometry
 */

/**
 * @typedef {object} Feature
 * @property {object} attributes
 * @property {Geometry|null} geometry
 */

/**
 * An identify result or a presentation record.
 * @typedef {object} FeatureResult
 * @property {"feature"|"raster"|"media"} kind
 * @property {string|null} layerUid       the operational layer it belongs to
 * @property {string} layerTitle
 * @property {object} attributes
 * @property {Geometry|null} [geometry]
 * @property {{ url: string|null, layerId: number|null, title: string, objectIdField: string|null, displayField: string|null }} [source] the (sub)layer that drew it
 */

/**
 * Query parameters (ArcGIS REST query vocabulary; engines translate them).
 * @typedef {object} QueryParams
 * @property {string} [where]
 * @property {string[]} [outFields]
 * @property {boolean} [returnGeometry]
 * @property {number} [num]
 * @property {number} [start]
 * @property {string[]} [orderByFields]
 * @property {(number|string)[]} [objectIds]
 * @property {boolean} [returnDistinctValues]
 * @property {Geometry|"view"} [geometry]   "view": the current view's extent
 * @property {string} [spatialRelationship] "intersects", "contains", "within", … (briefing-document.js SPATIAL_RELATIONSHIPS)
 * @property {string} [relationParameter]
 * @property {number} [distance]
 * @property {string} [units]
 * @property {{ wkid: number }|"view"} [outSpatialReference]
 * @property {number} [maxAllowableOffset]
 * @property {number} [geometryPrecision]
 */

/**
 * Where to move the camera (setView, captureViews). One of:
 *   { center: [lon, lat], zoom?, scale?, heading?, tilt? }
 *   { camera }        a saved camera (getViewState().camera)
 *   { viewpoint }     a saved viewpoint (getViewpoint())
 *   { geometry, fit?: "feature", zoom?, tilt?, heading? }  fit "feature": points at zoom 15, shapes with a margin
 *   { features: Feature[] }   frame them all
 *   { bounds: [west, south, east, north], tilt?, heading? }  degrees
 * @typedef {object} ViewTarget
 */

/**
 * @typedef {object} ViewState  as saved in projects (map-v1 camera, tours, bookmarks)
 * @property {string} type
 * @property {object|null} camera
 * @property {[number, number]|null} center
 * @property {number} zoom
 * @property {number} heading
 * @property {number} tilt
 */

/**
 * @typedef {object} ClickEvent
 * @property {number} x  screen pixels from the map's left edge
 * @property {number} y  screen pixels from the map's top edge
 * @property {{ longitude: number, latitude: number, x: number, y: number, z?: number, spatialReference: { wkid: number } }|null} mapPoint
 */

/**
 * @typedef {object} MapEngine
 * @property {(container?: string|HTMLElement) => Promise<void>} initialize
 * @property {() => void} destroy
 * @property {() => string[]} getCapabilities
 * @property {(id: string) => void} setBasemap
 * @property {(config: object) => Promise<LayerHandle>} addService
 * @property {(uid: string) => void} removeLayer
 * @property {() => LayerHandle[]} getLayers
 * @property {(uid: string) => LayerHandle|null} getLayer
 * @property {(uid: string, params?: QueryParams, options?: { signal?: AbortSignal, layerDefaults?: boolean }) => Promise<{ features: Feature[], exceededTransferLimit: boolean }>} queryFeatures
 * @property {(target: ViewTarget, options?: { animate?: boolean, duration?: number, padding?: object }) => Promise<void>} setView
 * @property {() => ViewState} getViewState
 * @property {(click: ClickEvent) => Promise<FeatureResult[]>} identify
 * @property {(options?: { format?: string, quality?: number, width?: number, height?: number }) => Promise<{ dataUrl: string, width: number, height: number }|null>} captureImage
 * @property {(text: string) => Promise<{ label: string, location: [number, number], extent?: object }[]>} search
 * @property {(point: { longitude: number, latitude: number }) => Promise<{ address: string, attributes: object }|null>} reverseGeocode
 */
