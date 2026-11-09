// The in-page `layers` and `camera` namespaces of globalThis.gisMapOnline.
// They use the same loading path as "Add ArcGIS REST service" and `?layer=`
// links (loadLayer), and change layers only through the map controller, so the
// project, share links and Smart images all see the result.
import { SHARE_LAYER_TYPES, SHARE_LIMITS, sanitizeSharedResourceUrl } from "./share.js?v=0.71.0-subsurface";
import { SCENE3D_TYPES, normalizeScene3d, scene3dTypeFor } from "./scene3d.js?v=0.1.0";
import { GisMapError, layerLoadError, toGisMapError } from "./gismap-errors.js?v=0.54.0-print";
import { featureLayerUrl } from "./field-task-share.js?v=0.71.0-subsurface";

const trimUrl = (value) => String(value || "").trim().replace(/\/+$/, "").replace(/\/query$/i, "").toLowerCase();
const READ_ONLY_WHERE = /;|--|\/\*|\b(drop|delete|insert|update|alter|exec|execute|merge|truncate|create)\b/i;

/** Rejects anything but a plain attribute filter (a SQL where clause, read-only). */
export function checkWhere(where) {
  if (where == null || where === "") return null;
  const text = String(where).trim();
  if (text.length > 2000) throw new GisMapError("INVALID_SPEC", "The filter is too long (over 2,000 characters).");
  if (READ_ONLY_WHERE.test(text)) throw new GisMapError("INVALID_SPEC", "A filter can only compare fields (for example POP > 1000 AND STATE = 'CA'); statements, comments and semicolons are not allowed.", { details: { where: text } });
  return text;
}

export function createLayersApi({ mapController, loadLayer, state = null, events = null, allowHttp = false }) {
  const metadata = new Map();
  const counts = new Map();
  const errors = new Map();
  // Adds still loading hold a place, so concurrent calls cannot pass the layer limit together.
  let pending = 0;

  const dataLayers = () => mapController.getLayers();
  const urlsOf = (layer) => {
    const config = mapController.getLayerConfig(layer);
    return [config.url, featureLayerUrl(layer), layer.url].filter(Boolean).map(trimUrl);
  };
  const find = (key) => {
    if (key == null || key === "") return null;
    const text = String(key);
    const layers = dataLayers();
    return layers.find((layer) => layer.uid === text || layer.id === text)
      || layers.find((layer) => urlsOf(layer).includes(trimUrl(text)))
      || layers.find((layer) => layer.title === text)
      || null;
  };
  const require = (key) => {
    const layer = find(key);
    if (!layer) throw new GisMapError("NOT_FOUND", `No layer on the map matches "${key}".`, { details: { layers: dataLayers().map((item) => ({ id: item.uid, title: item.title })) } });
    return layer;
  };
  const metadataFor = (layer) => {
    if (!metadata.has(layer.uid)) metadata.set(layer.uid, mapController.layerMetadata(layer));
    return metadata.get(layer.uid);
  };
  const info = (layer) => {
    const config = mapController.getLayerConfig(layer);
    const scale = mapController.scaleState(layer);
    const meta = metadataFor(layer);
    const status = layer.loadStatus === "loaded" ? "loaded" : layer.loadStatus === "failed" ? "failed" : "loading";
    return {
      id: layer.uid,
      title: layer.title || "",
      url: config.url || featureLayerUrl(layer) || layer.url || "",
      // "arcgis-auto" layers report what they turned out to be.
      type: config.sourceType === "arcgis-auto" ? ({ feature: "feature", "map-image": "map-image", imagery: "imagery", "imagery-tile": "imagery" })[layer.type] || "arcgis-auto" : SHARE_LAYER_TYPES.has(config.sourceType) ? config.sourceType : config.sourceType || layer.type,
      loadStatus: status,
      visible: layer.visible !== false,
      opacity: layer.opacity,
      where: config.definitionExpression || null,
      renderer: config.rendererSpec || (config.styled ? { type: "arcgis", json: config.renderer } : { type: "service" }),
      spatialChart: config.spatialChart || null,
      subsurface: config.subsurface || null,
      animatedEffect: config.animatedEffect || null,
      scene3d: config.scene3d || null,
      visibleAtCurrentScale: scale.visibleAtCurrentScale,
      minScale: scale.serviceMinScale,
      maxScale: scale.serviceMaxScale,
      ignoreServiceScaleRange: scale.ignored,
      featureCount: counts.get(layer.uid) ?? null,
      dataLastEditDate: meta?.dataLastEditDate ?? null,
      sentinels: meta?.sentinels ?? [],
      error: errors.get(layer.uid) || (status === "failed" ? toGisMapError(layer.loadError?.message || "The layer failed to load.", "LAYER_LOAD_FAILED").toJSON() : null),
    };
  };
  // The filter each count was made with, so a filter changed anywhere (the filter dialog, say) is recounted.
  const countedWhere = new Map();
  const countFeatures = async (layer) => {
    if (!layer.countable) return;
    const where = layer.where || null;
    countedWhere.set(layer.uid, where);
    try {
      const count = await mapController.queryFeatureCount(layer.uid, { where: where || "1=1" });
      if (countedWhere.get(layer.uid) === where) counts.set(layer.uid, count);
    } catch { /* Counts are optional. */ }
  };

  async function applyOptions(layer, options, { adding = false } = {}) {
    const uid = layer.uid;
    if (options.title !== undefined) mapController.setTitle(uid, String(options.title).slice(0, 160));
    if (options.where !== undefined) {
      if (!layer.filterable) throw new GisMapError("UNSUPPORTED_LAYER_TYPE", `${layer.title} cannot be filtered.`);
      mapController.setDefinitionExpression(uid, checkWhere(options.where));
      counts.delete(uid);
    }
    if (Array.isArray(options.outFields)) mapController.setOutFields(uid, options.outFields.map(String));
    if (options.opacity !== undefined) mapController.setOpacity(uid, Number(options.opacity));
    if (options.visible !== undefined) mapController.setVisibility(uid, options.visible !== false);
    if (options.ignoreServiceScaleRange !== undefined && !adding) mapController.ignoreScaleRange(uid, options.ignoreServiceScaleRange === true);
    if (options.renderer !== undefined) {
      // "auto" comes back decided, with its breaks: that is what projects and links record.
      const { spec } = await mapController.applyRendererSpec(uid, options.renderer, { sentinels: metadataFor(layer)?.sentinels || [] });
      state?.dispatch?.("layer:style", { layerId: uid, style: spec }, { undoable: false });
    }
    if (options.spatialChart !== undefined) await mapController.setSpatialChart(uid, options.spatialChart);
    if (options.subsurface !== undefined) await mapController.setSubsurface(uid, options.subsurface);
    if (options.animatedEffect !== undefined) await mapController.setLayerEffect(uid, options.animatedEffect);
  }

  // Layers added any way (dialog, link, project) get a feature count in the background.
  events?.subscribe?.("layer:added", ({ layer }) => { if (layer) void countFeatures(layer); });
  events?.subscribe?.("layer:removed", ({ uid }) => { metadata.delete(uid); counts.delete(uid); errors.delete(uid); countedWhere.delete(uid); });
  events?.subscribe?.("layer:changed", ({ uid } = {}) => {
    const layer = uid && mapController.getLayer(uid);
    if (layer && countedWhere.has(uid) && (layer.where || null) !== countedWhere.get(uid)) { counts.delete(uid); void countFeatures(layer); }
  });

  function validateLayerInput(url, options) {
    const type = options.type || "arcgis-auto";
    if (!SHARE_LAYER_TYPES.has(type)) throw new GisMapError("UNSUPPORTED_LAYER_TYPE", `Unsupported layer type: ${type}.`, { details: { supported: [...SHARE_LAYER_TYPES] } });
    let clean;
    try { clean = sanitizeSharedResourceUrl(url, { allowHttp }); } catch (error) { throw toGisMapError(error, "INVALID_URL", { url: String(url) }); }
    const where = checkWhere(options.where);
    const scene3dType = SCENE3D_TYPES.includes(type) ? type : type === "arcgis-auto" ? scene3dTypeFor(clean) : null;
    if (scene3dType && !mapController.getCapabilities?.().includes("three-3d")) throw new GisMapError("UNSUPPORTED_LAYER_TYPE", "Point clouds and 3D models draw on the MapLibre engine. Open the map with ?engine=maplibre.", { details: { type: scene3dType } });
    if (scene3dType) try { normalizeScene3d(options.scene3d, scene3dType); } catch (error) { throw new GisMapError("INVALID_SPEC", error.message); }
    return { clean, type, where };
  }

  async function addLayer(url, options, before, validated = validateLayerInput(url, options)) {
    const { clean, type, where } = validated;
    if (options.signal?.aborted) throw new DOMException("The layer was not added.", "AbortError");
    let added;
    try {
      added = await loadLayer({
        url: clean,
        serviceType: type,
        title: options.title,
        definitionExpression: where || undefined,
        opacity: Number.isFinite(options.opacity) ? options.opacity : undefined,
        visible: options.visible,
        ignoreServiceScaleRange: options.ignoreServiceScaleRange === true,
        refreshInterval: Number(options.refreshInterval) || 0,
        ...(options.scene3d ? { scene3d: options.scene3d } : {}),
      });
    } catch (error) {
      throw layerLoadError(error, { url: clean });
    }
    const layer = added?.[0];
    if (!layer) throw new GisMapError("LAYER_LOAD_FAILED", "The service did not provide a layer to add.", { details: { url: clean } });
    if (options.signal?.aborted) { mapController.removeLayer(layer.uid); throw new DOMException("The layer was not added.", "AbortError"); }
    try {
      await applyOptions(layer, { outFields: options.outFields, renderer: options.renderer, spatialChart: options.spatialChart, subsurface: options.subsurface }, { adding: true });
    } catch (error) {
      // Adding is all or nothing: a layer whose style failed is taken off again.
      (added || []).forEach((item) => mapController.removeLayer(item.uid));
      throw toGisMapError(error, "INVALID_SPEC");
    }
    state?.dispatch?.("layer:activate", { layerId: layer.uid }, { undoable: false });
    await countFeatures(layer);
    // The camera move waits for drawing; a hidden tab never draws, so it gets 8 seconds.
    if (options.zoomTo ?? before === 0) await Promise.race([mapController.goToLayers([layer]).catch(() => false), new Promise((resolve) => setTimeout(resolve, 8000))]);
    return info(layer);
  }

  const api = {
    /** Data layers only; drawings, tour markers and other internal graphics are left out. */
    list: () => dataLayers().map(info),
    get: (key) => { const layer = find(key); return layer ? info(layer) : null; },

    /**
     * Adds a layer by URL and resolves once it has loaded, with its LayerInfo.
     * Options: type, title, where, outFields, renderer (RendererSpec), opacity,
     * visible, ignoreServiceScaleRange, zoomTo (default: when it is the first data layer).
     */
    async add(url, options = {}) {
      // Input errors are more useful than a capacity error and require no map
      // mutation, so validate before reserving a concurrent layer slot.
      const validated = validateLayerInput(url, options);
      const before = dataLayers().length;
      if (before + pending >= SHARE_LIMITS.maxLayers) throw new GisMapError("TOO_MANY_LAYERS", `A map can include at most ${SHARE_LIMITS.maxLayers} layers.`, { details: { limit: SHARE_LIMITS.maxLayers } });
      pending += 1;
      try {
        return await addLayer(url, options, before, validated);
      } finally {
        pending -= 1;
      }
    },

    /**
     * Ranked style options for a field (all of the layer's values that match its
     * filter): { field, stats, options: [{ id, label, reason, recommended, spec, pinnedSpec, breaks }] }.
     * Apply one with update(key, { renderer: option.pinnedSpec }).
     */
    async suggestStyles(key, { field = null } = {}) {
      const layer = require(key);
      try {
        return await mapController.suggestRenderers(layer.uid, { field, sentinels: metadataFor(layer)?.sentinels || [] });
      } catch (error) { throw toGisMapError(error, "INVALID_SPEC"); }
    },

    async update(key, patch = {}) {
      const layer = require(key);
      try { await applyOptions(layer, patch); } catch (error) { throw toGisMapError(error, "INVALID_SPEC"); }
      if (patch.where !== undefined) await countFeatures(layer);
      return info(layer);
    },

    remove(key) {
      const layer = find(key);
      if (!layer) return false;
      mapController.removeLayer(layer.uid);
      metadata.delete(layer.uid);
      counts.delete(layer.uid);
      errors.delete(layer.uid);
      return true;
    },

    /** Fits the view to one layer's filtered data, or to all data layers. */
    async zoomTo(key = null, { animate = true } = {}) {
      const layers = key == null ? dataLayers() : [require(key)];
      if (!await mapController.goToLayers(layers, { animate })) throw new GisMapError("NOT_READY", "There is no data extent to zoom to yet.");
    },

    /**
     * The [west, south, east, north] box (degrees) that zoomTo frames: the
     * filtered data, or its dense core when it spreads over half the world.
     */
    async extent(key = null) {
      const layers = key == null ? dataLayers() : [require(key)];
      const bounds = await mapController.dataBounds(layers);
      return bounds ? bounds.map((value) => Number(value.toFixed(4))) : null;
    },

    /** The layer's metadata from its service: fields, scale range, freshness, sentinels. */
    metadata: (key) => metadataFor(require(key)),
  };
  return Object.freeze(api);
}

/** Camera: where the scene looks, as { center: [lon, lat], zoom, scale, heading, tilt }. */
export function createCameraApi({ mapController, layers }) {
  const ready = () => {
    if (!mapController.isReady()) throw new GisMapError("NOT_READY", "The map is not ready yet.");
  };
  return Object.freeze({
    get() {
      ready();
      return mapController.getCamera();
    },
    async set(camera = {}, { animate = true } = {}) {
      const target = {};
      if (camera.center !== undefined) {
        const [lon, lat] = Array.isArray(camera.center) ? camera.center.map(Number) : [];
        if (!Number.isFinite(lon) || !Number.isFinite(lat) || Math.abs(lon) > 180 || Math.abs(lat) > 90) throw new GisMapError("INVALID_SPEC", "center must be [longitude, latitude] in degrees.");
        target.center = [lon, lat];
      }
      if (camera.zoom !== undefined) target.zoom = Math.min(24, Math.max(0, Number(camera.zoom)));
      else if (camera.scale !== undefined) target.scale = Math.max(1, Number(camera.scale));
      if (camera.heading !== undefined) target.heading = Number(camera.heading) || 0;
      if (camera.tilt !== undefined) target.tilt = Math.min(90, Math.max(0, Number(camera.tilt) || 0));
      ready();
      await mapController.setView(target, { animate });
      return this.get();
    },
    /** Fits a layer (id, URL or title), every data layer ("layers"), or a [west, south, east, north] box. */
    async fitTo(target = "layers", { animate = true } = {}) {
      if (Array.isArray(target)) {
        const [xmin, ymin, xmax, ymax] = target.map(Number);
        if (![xmin, ymin, xmax, ymax].every(Number.isFinite) || xmin >= xmax || ymin >= ymax) throw new GisMapError("INVALID_SPEC", "An extent must be [west, south, east, north] in degrees.");
        ready();
        await mapController.setView({ bounds: [xmin, ymin, xmax, ymax], tilt: 0 }, { animate });
      } else {
        await layers.zoomTo(target === "layers" ? null : target, { animate });
      }
      return this.get();
    },
  });
}
