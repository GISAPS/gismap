import { generateFilterSeries } from "./briefing-data-series.js?v=0.60.0-media1";
import { isDateField } from "./briefing-timeline-dates.js?v=0.60.0-media1";
import { generateTimeline } from "./briefing-timeline.js?v=0.60.0-media1";
import { extentToBounds, generateGridAtlas } from "./briefing-grid-atlas.js?v=0.60.0-media1";
import { generateSpatialChartBrief } from "./briefing-spatial-chart.js?v=0.69.9-order";
import core, { normalizeBriefing, updateSlide, validateBriefingDocument } from "./gismap-core.js?v=0.69.1-pdflinks";
import { createShareLink } from "./map-share.js?v=0.69.9-order";
import { GisMapError, layerLoadError, toGisMapError } from "./gismap-errors.js?v=0.54.0-print";
import { featureLayerUrl } from "./field-task-share.js?v=0.41.0";
import { brandedQrFile, printPalette } from "./pdf-document.js?v=0.69.1-pdflinks";

const clone = (value) => structuredClone(value);
const trimUrl = (value) => String(value || "").replace(/\/+$/, "").toLowerCase();

/**
 * The portable reference a briefing document uses for its layer (`layerId`): the
 * layer's service URL when it has one, so the document still points at the
 * right data in another session or on another device; otherwise its layer ID.
 */
export function briefingLayerRef(mapController, layer) {
  if (!layer) return null;
  const config = mapController?.getLayerConfig?.(layer) || {};
  return (!config.local && (featureLayerUrl(layer) || config.url)) || layer.id || layer.uid || null;
}

/**
 * The map layer a briefing's `layerId` names: matched by service URL, layer ID,
 * session UID or title. Without a `layerId`, the first feature layer.
 */
export function findBriefingLayer(mapController, layerId) {
  const layers = (mapController?.getLayers?.() || []).filter((layer) => layer.queryable);
  if (!layerId) return layers[0] || null;
  const wanted = String(layerId);
  return layers.find((layer) => layer.uid === wanted || layer.id === wanted)
    || layers.find((layer) => [featureLayerUrl(layer), mapController.getLayerConfig?.(layer)?.url].some((url) => url && trimUrl(url) === trimUrl(wanted)))
    || layers.find((layer) => layer.title && layer.title === wanted)
    || null;
}
const cleanName = (value) => String(value || "briefing").trim().replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "briefing";

/** Bind the pure core to the active GISMap Online project and camera. */
/**
 * `host` (optional) lets the API reach app features beyond the document:
 * openBriefing(document, { slide, present }) loads a missing layer and opens it,
 * generate(options) builds slides from the styled map, and createPdf(options)
 * renders the PDF handout. Without a host (tests, headless) those calls throw.
 */
let warnedExportGmo = false;

export function createBriefingApi({ projectManager, mapController, host = null, baseUrl = () => globalThis.location?.href || "https://gismap.online/" }) {
  if (!projectManager) throw new Error("The Briefing API requires a project manager.");

  const current = () => normalizeBriefing(projectManager.current?.presentation?.briefing);
  const needHost = (name) => {
    if (typeof host?.[name] !== "function") throw new GisMapError("NOT_READY", `briefing.${name === "openBriefing" ? "load" : name} needs the GISMap Online app; it is not available here.`);
    return host[name];
  };
  const save = (document, { activate = false } = {}) => {
    const briefing = normalizeBriefing(document);
    const presentation = { ...(projectManager.current?.presentation || {}), briefing };
    // The document's own layer and selection choose what the briefing is about.
    const layer = findBriefingLayer(mapController, briefing.layerId);
    if (layer) presentation.primaryLayerId = layer.uid;
    if (briefing.selection && layer) presentation.briefingSelection = { layerId: layer.uid, ids: (briefing.selection.ids || []).map(String), useAll: briefing.selection.useAll === true };
    if (activate) {
      presentation.template = "briefing";
      projectManager.setPresentation(presentation);
    } else {
      projectManager.patchPresentation(presentation);
    }
    return clone(briefing);
  };

  const api = {
    ...core.briefing,
    capabilities: () => clone(core.capabilities),
    get: () => clone(current()),
    /**
     * Saves a briefing document into the project. `activate` (default true)
     * opens Briefing mode; `present` also starts the slides. The layer named by
     * `layerId` is loaded when it is not on the map, whether or not Briefing
     * opens. `ready` resolves with { layers } once that is done, and rejects
     * with a GisMapError (LAYER_LOAD_FAILED) if the layer cannot be loaded.
     */
    load(document, options = {}) {
      const result = validateBriefingDocument(document, options);
      if (!result.valid && options.allowInvalid !== true) {
        throw new GisMapError("INVALID_SPEC", "The briefing contains validation errors.", { details: { issues: result.issues } });
      }
      const activate = options.activate !== false;
      const issues = [...result.issues];
      const layerId = result.document.layerId;
      const onMap = () => findBriefingLayer(mapController, layerId);
      const describe = (layer) => (layer ? host?.layerInfo?.(layer) || { id: layer.uid, title: layer.title, url: briefingLayerRef(mapController, layer), loadStatus: "loaded" } : null);
      const wantsLoad = Boolean(layerId) && !onMap();
      const canLoad = wantsLoad && /^https:\/\//i.test(layerId) && typeof host?.loadLayer === "function";
      if (wantsLoad && !canLoad) {
        issues.push({ level: "warning", path: "layerId", message: /^https:\/\//i.test(layerId)
          ? "layerId was not loaded because the GISMap Online app is not available here; call layers.add first, or load the briefing in the app."
          : `layerId "${layerId}" does not match a layer on the map; use the layer's service URL so it can be loaded.` });
      }
      const saved = save(result.document, { activate });
      const ready = (async () => {
        if (canLoad) {
          try {
            await host.loadLayer({ url: layerId, serviceType: "arcgis-auto" });
          } catch (error) {
            throw layerLoadError(error, { layerId });
          }
          if (!onMap()) throw new GisMapError("LAYER_LOAD_FAILED", `The layer at ${layerId} could not be added.`, { details: { layerId } });
          // Now that the layer is there, the briefing points at it (and its selection applies).
          save(result.document, { activate: false });
        }
        if (activate && typeof host?.openBriefing === "function" && (canLoad || options.present === true)) {
          await host.openBriefing(saved, { present: options.present === true, slide: options.slide || null });
        }
        const layer = onMap();
        return { layers: layer ? [describe(layer)] : [] };
      })();
      // A caller that never awaits `ready` should not see an unhandled rejection.
      ready.catch(() => {});
      return { ...result, issues, document: saved, ready };
    },
    /**
     * Builds slides from the map as it looks (the layer's style and filter, the
     * Features-tab choices), as "Make a briefing from this view" does.
     * Options: { layerId, ai (AI descriptions when configured), share (open the share dialog) }.
     */
    async generate(options = {}) {
      const layer = options.layerId ? findBriefingLayer(mapController, options.layerId) : null;
      if (options.layerId && !layer) throw new GisMapError("NOT_FOUND", `No layer on the map matches ${options.layerId}.`);
      await needHost("generate")({ uid: layer?.uid || null, share: options.share === true, useAi: options.ai === true, confirmReplace: false });
      return clone(current());
    },
    /** The briefing's PDF handout (landscape, one page per slide, QR back to the live briefing) as a File. */
    async exportPdf(options = {}) {
      return needHost("createPdf")(options);
    },
    /** Generate a data-driven template in the active browser session.
     * Results describe a bounded source sample, not complete-source statistics.
     * Preview builds a candidate without changing the current project.
     */
    async generateTemplate(options = {}) {
      const { template, layerId, previewOnly = false } = options;
      if (typeof previewOnly !== "boolean") throw new GisMapError("INVALID_SPEC", "previewOnly must be a boolean.");
      if (options.kind != null && !["date", "year"].includes(options.kind)) throw new GisMapError("INVALID_SPEC", "Timeline kind must be date or year.");
      if (options.cameraPolicy != null && !["fit-features", "fixed"].includes(options.cameraPolicy)) throw new GisMapError("INVALID_SPEC", "Choose fit-features or fixed for the map view.");
      if (options.presentationMode != null && !["single-slide", "slide-series"].includes(options.presentationMode)) throw new GisMapError("INVALID_SPEC", "Choose single-slide or slide-series.");
      if (!["filter-series", "timeline", "grid-atlas", "spatial-3d-chart"].includes(template)) throw new GisMapError("INVALID_SPEC", "Choose filter-series, timeline, grid-atlas, or spatial-3d-chart.");
      const selected = layerId || projectManager.current?.presentation?.primaryLayerId || current().layerId;
      const layer = findBriefingLayer(mapController, selected);
      if (!layer) throw new GisMapError("NOT_FOUND", "Choose a queryable layer already loaded on the map.");
      const ref = briefingLayerRef(mapController, layer);
      if (!ref) throw new GisMapError("INVALID_SPEC", "The layer has no shareable reference.");
      const original = current();
      const originalState = JSON.stringify(original);
      const originalWhere = layer.where ?? null;
      if (original.slides.length && original.layerId && trimUrl(original.layerId) !== trimUrl(ref) && findBriefingLayer(mapController, original.layerId)?.uid !== layer.uid) throw new GisMapError("INVALID_SPEC", "The current briefing refers to a different layer; start a new briefing before generating this template.");
      const fields = layer.fields || [];
      if (!Array.isArray(fields) || !fields.length) throw new GisMapError("NOT_READY", "The layer does not expose its fields yet.");
      const limit = 500;
      const response = await mapController.queryFeatures(layer.uid, { outFields:["*"], returnGeometry:true, outSpatialReference:{wkid:4326}, num:limit });
      if (!Array.isArray(response?.features)) throw new GisMapError("NOT_READY", "The layer did not return features.");
      const records = response.features.slice(0, limit);
      const camera = api.captureCamera();
      const input = { briefing:{...original, layerId:ref, selection:{ids:[],useAll:true}}, layerRef:ref, camera, fields, records };
      let result;
      try {
        if (template === "filter-series") result = generateFilterSeries({...input, field:options.field, ...(options.cameraPolicy ? {cameraPolicy:options.cameraPolicy} : {})});
        else if (template === "timeline") {
          const allowed = ["field","kind","start","end","step","unit","timeZone","mode","rolling","endField","stat","statField","narration","presentationMode","cameraPolicy"];
          result = generateTimeline({...input, kind:isDateField(fields.find(field => field.name === options.field)) ? "date" : "year", ...Object.fromEntries(allowed.filter(key => options[key] !== undefined).map(key => [key, options[key]]))});
        } else if (template === "grid-atlas") {
          // area: "features" (default, the records' extent) or "view" (the visible map); bounds sets an explicit area.
          const allowed = ["rows","columns","targetCells","order","skipEmpty","countMode","bounds"];
          if (options.area != null && !["features", "view"].includes(options.area)) throw new Error("Choose features or view for the grid area.");
          const area = options.area === "view" && options.bounds === undefined ? { bounds: extentToBounds(mapController.getViewExtent?.()) } : {};
          if (options.area === "view" && !area.bounds && options.bounds === undefined) throw new Error("The map view is not ready yet.");
          result = generateGridAtlas({...input, ...Object.fromEntries(allowed.filter(key => options[key] !== undefined).map(key => [key, options[key]])), ...area});
        } else {
          result = generateSpatialChartBrief({ ...input, geometryType:layer.geometryType, groupBy:options.groupBy, heightField:options.heightField, slotMeters:options.slotMeters, gapMeters:options.gapMeters, scale:options.scale });
        }
      } catch (error) { throw new GisMapError("INVALID_SPEC", error.message); }
      if (template === "grid-atlas" && !result.preview.cells.length) throw new GisMapError("INVALID_SPEC", "No grid cells were generated.");
      if (!previewOnly && (JSON.stringify(current()) !== originalState || (findBriefingLayer(mapController, layer.uid)?.where ?? null) !== originalWhere || !findBriefingLayer(mapController, layer.uid))) throw new GisMapError("INVALID_SPEC", "The briefing or source layer changed while generating; retry to avoid overwriting newer work.");
      const document = previewOnly ? result.briefing : save(result.briefing);
      return { document:clone(document), preview:clone(result.preview), coverage:{returned:records.length, limit, exceededTransferLimit:response.exceededTransferLimit === true, completeness:"unknown", note:"Generated from at most 500 queried features; completeness is not guaranteed. Counts and categories are samples."}, saved:!previewOnly };
    },
    /** A branded PNG card whose QR opens the live briefing. */
    async exportQrCard(document = current(), options = {}) {
      if (!globalThis.document) throw new GisMapError("NOT_READY", "briefing.exportQrCard needs the GISMap Online browser app.");
      const presentation = projectManager.current?.presentation || {};
      const title = options.title || presentation.modeTitles?.briefing || presentation.title || projectManager.current?.name || "Briefing";
      const link = await api.createLink(document, { ...options, qrSafe: options.qrSafe !== false });
      const slideCount = normalizeBriefing(document).slides.filter((slide) => !slide.hidden).length;
      const palette = printPalette(globalThis.document?.documentElement?.dataset.skin || presentation.skin);
      const file = await brandedQrFile(link, {
        fileName: `${cleanName(options.fileName || title)}-qr.png`,
        title,
        lines: [`Scan to present ${slideCount} slide${slideCount === 1 ? "" : "s"}, or long-click the QR code`, "to open it in a browser."],
        footer: "Complete briefing encoded in this QR",
        palette,
      });
      if (!file) throw new GisMapError("NOT_READY", "The branded QR card could not be rendered in this environment.");
      return file;
    },
    captureCamera() {
      const state = mapController?.getViewState?.();
      if (!state?.center) throw new GisMapError("NOT_READY", "The map camera is not ready.");
      return { center: [...state.center], zoom: state.zoom, heading: state.heading ?? 0, tilt: state.tilt ?? 0 };
    },
    saveCurrentCamera(slideId) {
      const document = updateSlide(current(), slideId, { camera: api.captureCamera(), fit: null });
      if (!document.slides.some((slide) => slide.id === slideId)) throw new GisMapError("NOT_FOUND", `Unknown slide: ${slideId}`);
      return save(document);
    },
    /**
     * A link that opens the briefing's slides. With a web layer on the map it is
     * the full link the app shares (layers with styles and filters, skin,
     * basemap, view); `{ documentOnly: true }`, or a map with no web layers,
     * gives the slides-only link from the pure core.
     */
    async createLink(document = current(), options = {}) {
      const layers = mapController?.getAllLayerConfigs?.() || [];
      const presentation = projectManager.current?.presentation || {};
      if (options.documentOnly !== true && layers.some((layer) => layer.url && !layer.local)) {
        const link = await createShareLink({
          baseUrl: options.baseUrl || baseUrl(),
          kind: "briefing",
          title: presentation.modeTitles?.briefing || presentation.title || projectManager.current?.name || "Briefing",
          skin: globalThis.document?.documentElement?.dataset.skin || presentation.skin,
          basemap: mapController.getBasemapId?.(),
          camera: mapController.getViewState?.(),
          engine: mapController.getEngineId?.(),
          ground: mapController.getGroundId?.(),
          layers,
          primary: Math.max(0, layers.findIndex((layer) => layer.uid === presentation.primaryLayerId)),
          briefing: document,
          selection: presentation.briefingSelection?.ids || [],
          useAll: presentation.briefingSelection?.useAll === true,
          slide: options.slide || null,
        });
        if (options.qrSafe === true && !link.qr) throw new GisMapError("INVALID_SPEC", "This briefing exceeds the QR-safe link limit. Copy the link or export a .gis file instead.");
        return link.url;
      }
      if (options.documentOnly !== true) throw new GisMapError("INVALID_SPEC", "A complete briefing link needs public web layers. Export a project, or explicitly request a slides-only link with documentOnly: true.");
      return core.briefing.createLink({ baseUrl: options.baseUrl || baseUrl(), briefing: document, qrSafe: options.qrSafe === true, compress: options.compress !== false });
    },
    exportProject(document = current(), options = {}) {
      const project = projectManager.snapshot();
      project.presentation = { ...project.presentation, briefing: normalizeBriefing(document) };
      const text = JSON.stringify(project, null, 2);
      return {
        fileName: `${cleanName(options.fileName || project.presentation?.modeTitles?.briefing || project.name)}.gis`,
        mimeType: "application/vnd.gismap.online.project+json",
        text,
        blob: new Blob([text], { type: "application/vnd.gismap.online.project+json" }),
      };
    },
    /** @deprecated Use exportProject. */
    exportGmo(document, options) {
      if (!warnedExportGmo) console.warn("briefing.exportGmo is deprecated; use briefing.exportProject.");
      warnedExportGmo = true;
      return api.exportProject(document, options);
    },
  };
  return Object.freeze(api);
}

export function createClientApi(options) {
  const briefing = createBriefingApi(options);
  const currentMapLink = ({ baseUrl = null } = {}) => {
    const project = options.projectManager.current || {};
    const presentation = project.presentation || {};
    return createShareLink({
      baseUrl: baseUrl || options.baseUrl?.() || globalThis.location?.href || "https://gismap.online/",
      kind: "map",
      title: presentation.title || project.name || "Shared map",
      skin: globalThis.document?.documentElement?.dataset.skin || presentation.skin,
      basemap: options.mapController.getBasemapId?.(),
      camera: options.mapController.getViewState?.(),
      layers: options.mapController.getAllLayerConfigs?.() || [],
      textBoxes: options.mapController.getTextBoxes?.() || [],
    });
  };
  const createCurrent = async ({ baseUrl, width, height, download: ignored, ...print } = {}, download = false) => {
    const [image, share] = await Promise.all([
      // Through the Print Editor when the app is running: one path, the same wait and failure rules.
      options.print ? options.print.exportSmartImage(print) : options.projectManager.exportSmartImage({ width, height, download }),
      currentMapLink({ baseUrl }).catch(() => null),
    ]);
    if (download && options.print) options.print.download(image.file);
    return { ...image, share };
  };
  const smartImages = Object.freeze({
    ...core.smartImages,
    createShareLink: currentMapLink,
    createCurrent: (settings) => createCurrent(settings, false),
    downloadCurrent: (settings) => createCurrent(settings, settings?.download !== false),
  });
  return Object.freeze({
    version: core.version,
    capabilities: () => clone(core.capabilities),
    briefing,
    queries: core.queries,
    sources: core.sources,
    smartImages,
  });
}
