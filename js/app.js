import { buildManifest, createPublicStateApi } from "./application-manifest.js?v=0.69.9-order";
import { createActionsApi } from "./application-actions.js?v=0.69.9-order";
import { events } from "./events.js?v=0.18.2";
import { AuthController } from "./engines/arcgis/arcgis-auth.js?v=0.39.0";
import { MapController } from "./map-controller.js?v=0.69.9-order";
import { listEngines } from "./engines/engine-registry.js?v=0.69.9-order";
import { chooseEngine } from "./engine-preference.js?v=0.52.5";
import { BASEMAP_IDS } from "./basemap-catalog.js?v=0.53.0-gallery1";
import { ProjectManager } from "./project.js?v=0.69.2-strata";
import { IdentifyController } from "./identify.js?v=0.54.0-pan2";
import { AttributeTableController } from "./attribute-table.js?v=0.61.2-layer-tools";
import { AIController } from "./ai.js?v=0.68.0-charts1";
import { ToolManager } from "./tool-manager.js?v=0.37.0";
import { UIController } from "./ui.js?v=0.69.9-order";
import { ExportController } from "./export/export-controller.js?v=0.37.0";
import { SHARE_BASEMAPS, parseShareParameters } from "./share.js?v=0.69.9-order";
import { readShareLocation } from "./map-share.js?v=0.69.9-order";
import { decodeEmbeddedTour } from "./tour-share.js?v=0.55.0-readable1";
import { decodeFieldTask, featureLayerUrl, readFieldTaskHash, readFocus } from "./field-task-share.js?v=0.55.0-readable1";
import { readFieldNoteHash } from "./field-note-link.js?v=0.1.0";
import { POPULAR_SERVICES } from "./catalog.js?v=0.18.6-fire-source";
import { ApplicationRuntime } from "./application-runtime.js?v=0.68.0-charts1";
import { PanelManager } from "./panel-manager.js?v=0.18.2";
import { MobilePanelManager } from "./mobile-panel-manager.js?v=0.18.2";
import { MobileWorkflowRouter } from "./mobile-workflow-router.js?v=0.69.1-pdflinks";
import { createClientApi } from "./briefing-api.js?v=0.69.9-order";
import { createPrintApi, hasWebgl, registerPrintTools, webglIssue } from "./print-api.js?v=0.54.0-print";
import { MAP_TEMPLATES } from "./map-templates.js?v=0.54.0-print";
import { readProjectFromPng } from "./smart-image.js?v=0.69.1-pdflinks";
import { registerAuthoringTools } from "./agent-authoring-tools.js?v=0.53.0";
import { createCameraApi, createLayersApi } from "./layers-api.js?v=0.54.0-unified4";
import { registerLayerTools } from "./layer-tools.js?v=0.29.0";
import { createSpatialAnalysisApi } from "./spatial-analysis.js?v=0.66.1-finish1";
import { createMapSpecApi } from "./map-spec-api.js?v=0.69.0-linkcharts1";
import { createLayerStylesApi } from "./layer-styles-api.js?v=0.69.9-order";
import { mapSpecFromShareParameters } from "./map-spec.js?v=0.69.9-order";
import { GisMapError, ERROR_CODES } from "./gismap-errors.js?v=0.54.0-print";

import { loadSharedLayer } from "./shared-layer-loader.js?v=0.53.0";
import { allowedParents, validConsoleMessage } from "./si-console-embed.js?v=0.67.0-si-console";

// Readiness for agents and scripts: gisMapOnline.ready, a `gismap:ready` event,
// and <html data-gismap-state="loading|ready|error">.
document.documentElement.dataset.gismapState = "loading";
let resolveReady;
let rejectReady;
const ready = new Promise((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
ready.catch(() => {});

// Parent pages allowed to hear from an embedded map. postMessage's target
// origin makes the browser drop the message for any other embedding site.
const EMBED_PARENT_ORIGINS = ["https://gismap.si", "https://www.gismap.si"];
function announceEmbedReady(layerCount) {
  if (window.parent === window) return;
  for (const origin of EMBED_PARENT_ORIGINS) window.parent.postMessage({ type: "gismap.ready", version: 1, layers: layerCount }, origin);
}

function announcePrivatePreview(type) {
  if (window.parent === window) return;
  for (const origin of EMBED_PARENT_ORIGINS) window.parent.postMessage({ type, version: 1 }, origin);
}

function validPrivatePreview(data) {
  if (!data || data.type !== "FeatureCollection" || !Array.isArray(data.features) || data.features.length > 2000) return false;
  return data.features.every((feature) => feature?.type === "Feature" && feature.geometry && typeof feature.geometry.type === "string" && Array.isArray(feature.geometry.coordinates));
}

async function start() {
  const allowHttp = location.hostname === "localhost" || location.hostname === "127.0.0.1";
  const launchParams = new URLSearchParams(location.search);
  const sharedEmbed = launchParams.get("embed") === "1";
  const siPreviewEmbed = sharedEmbed && launchParams.get("embedKind") === "si-preview";
  const siConsoleEmbed = sharedEmbed && launchParams.get("embedKind") === "si-console";
  // MapLibre by default; ?engine=arcgis (or the Display settings choice) selects the ArcGIS engine.
  let sharedState = null;
  let sharedStateError = null;
  try { sharedState = await readShareLocation(location, { allowHttp }); } catch (error) { sharedStateError = error; }
  // Historical Quakes is an ArcGIS-first briefing. Its third slide explicitly
  // changes to MapLibre for the presentation-only seismic pulse, then the
  // following slide returns to ArcGIS. Do not make that one effect choose the
  // engine for the whole briefing.
  const historicalQuakesBriefing = launchParams.get("briefingExample") === "historical-quakes";
  const engineId = sharedState?.engine || (historicalQuakesBriefing && !launchParams.has("engine")
    ? "arcgis"
    : chooseEngine({ search: location.search, storage: globalThis.localStorage, available: listEngines().map((engine) => engine.id) }));
  document.documentElement.dataset.mapEngine = engineId;
  const authController = new AuthController(events);
  // Saved ArcGIS sign-ins load the ArcGIS identity runtime only when ArcGIS draws the map (or a connection is used).
  await authController.initialize({ runtime: engineId === "arcgis" });
  const mapController = new MapController(events, authController, { engineId });
  // Create the selected adapter before UI/settings code configures it; drawing
  // still starts later, after shared-link settings have been read.
  await mapController.prepare();
  const projectManager = new ProjectManager(events, mapController, authController);
  const identifyController = new IdentifyController(events, mapController);
  const aiController = new AIController(events, mapController);
  const toolManager = new ToolManager(events, mapController);
  const tableController = new AttributeTableController(events, mapController);
  const exportController = new ExportController(events, mapController);
  const panelManager = new PanelManager();
  const mobilePanelManager = new MobilePanelManager({ panelManager });
  const applicationRuntime = new ApplicationRuntime({ events, mapController, projectManager, aiController, panelManager, mobilePanelManager });
  const uiController = new UIController(
    events,
    mapController,
    projectManager,
    authController,
    aiController,
    toolManager,
    exportController,
    applicationRuntime,
    panelManager,
    mobilePanelManager,
  );

  identifyController.initialize();
  tableController.initialize();
  applicationRuntime.initialize();
  uiController.initialize();
  const mobileWorkflowRouter = new MobileWorkflowRouter({
    events, projectManager, mapController,
    prepareWorkflow: (route) => uiController.prepareMobileWorkflow(route),
    openWorkflow: (route) => uiController.openMobileWorkflow(route),
    shareWorkflow: (route, payload) => uiController.shareMobileWorkflow(route, payload),
    notify: (message) => uiController.toast(message),
    dockWorkflow: (open) => uiController.dockWorkflowPanel(open),
    createTour: (places, options) => uiController.createTourFromPlaces(places, options),
    createBriefing: (request) => uiController.createBriefingForLayerUrl(request),
    openFieldNotes: () => uiController.openFieldNotes(),
  });
  mobileWorkflowRouter.initialize();
  // Briefing action items become field tasks.
  uiController.fieldTasks = mobileWorkflowRouter;
  // Project, map-spec and UI imports use the same shared DuckDB session.
  projectManager.geoParquetLoader = async (options) => {
    const { addGeoParquetLayer } = await import("./geoparquet-layer.js?v=0.54.0-queryui1");
    return addGeoParquetLayer(uiController, options);
  };
  const loadUnifiedLayer = async (config) => {
    if (config.serviceType !== "geoparquet") return loadSharedLayer(mapController, config);
    const result = await projectManager.geoParquetLoader({ url: config.url, title: config.title });
    if (!result.layer) throw new Error("This source does not contain mappable GeoParquet geometry.");
    if (config.visible !== undefined) mapController.setVisibility(result.layer.uid, config.visible !== false);
    if (Number.isFinite(config.opacity)) mapController.setOpacity(result.layer.uid, config.opacity);
    if (config.definitionExpression) mapController.setDefinitionExpression(result.layer.uid, config.definitionExpression);
    if (config.spatialChart) await mapController.setSpatialChart(result.layer.uid, config.spatialChart);
    return [result.layer];
  };
  // Briefing documents can name a service URL as their layer; it loads like a shared layer.
  uiController.loadLayer = loadUnifiedLayer;

  let pendingPrivatePreview = null;
  let loadPrivatePreview = null;
  if (siConsoleEmbed) {
    uiController.activateSharedEmbed("map");
    document.body.classList.add("si-console-embed");
  }
  if (siPreviewEmbed) {
    // SI's browser parent delivers an authorized, bounded snapshot after this ready
    // signal. Nothing private is included in the iframe URL or saved by GISMap Online.
    uiController.activateSharedEmbed("map");
    document.body.classList.add("si-preview-embed");
    let previewReceived = false;
    loadPrivatePreview = async (payload) => {
      try {
        const snapshot = new Blob([JSON.stringify(payload.data)], { type: "application/geo+json" });
        const [layer] = await loadUnifiedLayer({
          url: URL.createObjectURL(snapshot),
          title: String(payload.title || "Private dataset").slice(0, 180),
          serviceType: "geojson",
        });
        // Let the renderer register the GeoJSON before calculating its extent.
        // This direct controller call works for both MapLibre and ArcGIS embeds.
        await new Promise((resolve) => requestAnimationFrame(resolve));
        const fitted = await mapController.goToLayers([layer], { animate: false });
        if (!fitted) throw new Error("The private dataset did not provide a map extent.");
        announcePrivatePreview("gismap.preview.loaded");
      } catch (error) {
        console.warn("GISMap SI private preview could not be displayed.", error);
        announcePrivatePreview("gismap.preview.error");
      }
    };
    window.addEventListener("message", (event) => {
      if (previewReceived || event.origin === location.origin || !EMBED_PARENT_ORIGINS.includes(event.origin) || event.source !== window.parent) return;
      const payload = event.data;
      if (payload?.type !== "gismap.si.preview" || payload.version !== 1 || !validPrivatePreview(payload.data)) return;
      previewReceived = true;
      // SI receives the iframe's ready signal before the map engine has finished
      // its own initial view. Queue the preview until initialization, otherwise
      // that initial view can overwrite the just-calculated dataset extent.
      pendingPrivatePreview = payload;
      if (mapController.isReady()) {
        pendingPrivatePreview = null;
        void loadPrivatePreview(payload);
      }
    });
    announceEmbedReady(0);
  }

  // The public, in-page API. Defined before the map starts so agents can await `ready`.
  const layersApi = createLayersApi({ mapController, loadLayer: loadUnifiedLayer, state: applicationRuntime.state, events, allowHttp });
  const cameraApi = createCameraApi({ mapController, layers: layersApi });
  registerLayerTools(applicationRuntime.tools, layersApi);
  const clientApi = createClientApi({
    projectManager,
    mapController,
    host: {
      openBriefing: (briefing, options) => uiController.openBriefingDocument(briefing, options),
      generate: (options) => uiController.generateBriefingFromView(options),
      createPdf: (options) => uiController.briefingPdfFile(options),
      loadLayer: loadUnifiedLayer,
      layerInfo: (layer) => layersApi.get(layer.uid),
    },
    print: {
      exportSmartImage: (options) => printApi.exportSmartImage(options),
      download: (file) => uiController.printDownload(file),
    },
  });
  registerAuthoringTools(applicationRuntime.tools, { sources: clientApi.sources, briefing: clientApi.briefing, layers: layersApi, camera: cameraApi });
  const issues = [];
  if (!hasWebgl()) {
    // Say why at once, rather than leaving agents a silently empty map.
    issues.push(webglIssue());
    document.documentElement.dataset.gismapState = "error";
  }
  const analysisApi = createSpatialAnalysisApi({ mapController, layers: layersApi });
  const mapSpecApi = createMapSpecApi({
    analysis: analysisApi,
    layers: layersApi,
    camera: cameraApi,
    mapController,
    issues,
    allowHttp,
    host: {
      setBasemap: (id) => mapController.setBasemap(id),
      applySkin: (skin) => uiController.applySkinChoice(skin),
      setTitle: (title) => uiController.setProjectTitle(title),
      getTitle: () => projectManager.current?.name || "",
      getSkin: () => document.documentElement.dataset.skin || null,
      showLegend: () => uiController.showLegendWidget(),
      showIssues: (list) => uiController.showSpecIssues(list),
      loadBriefing: (briefing) => clientApi.briefing.load(briefing, { activate: false }).ready,
      getBriefing: () => projectManager.current?.presentation?.briefing || null,
      addChart: (chart) => uiController.addLinkedChart(chart),
      clearCharts: () => uiController.clearChartPanels(),
      getCharts: () => projectManager.current?.charts || [],
    },
  });
  const layerStylesApi = createLayerStylesApi({
    layers: layersApi,
    camera: cameraApi,
    mapSpec: mapSpecApi,
    events,
    spatialCharts: () => mapController.getCapabilities().includes("spatial-chart-3d"),
    basemap: () => mapController.getBasemapId?.() || null,
    project: {
      get: () => projectManager.current?.layerStyles || [],
      set: (styles) => { projectManager.current.layerStyles = styles; projectManager.persistCurrentIfSaved(); },
    },
  });
  uiController.layerStyles = layerStylesApi;
  const printApi = createPrintApi({
    templates: MAP_TEMPLATES,
    host: {
      webgl: hasWebgl,
      ready: () => ready,
      layers: () => mapController.isReady() ? layersApi.list() : [],
      idle: () => {
        const { map, view } = mapController.native();
        return view ? view.updating === false : Boolean(map?.loaded?.() && map.areTilesLoaded?.());
      },
      defaults: () => uiController.printDefaults(),
      render: (kind, options) => uiController.printRender(kind, options),
      open: (options) => uiController.printOpen(options),
      isOpen: () => uiController.printIsOpen(),
      read: readProjectFromPng,
    },
  });
  registerPrintTools(applicationRuntime.tools, printApi);
  const describeTool = (tool) => ({ id: tool.id, displayName: tool.displayName, description: tool.description, inputSchema: tool.inputSchema });
  const describe = () => {
    let camera = null;
    try { camera = cameraApi.get(); } catch { /* Not ready yet. */ }
    const presentation = projectManager.current?.presentation || {};
    return {
      ...clientApi.capabilities(),
      tools: applicationRuntime.tools.list().map(describeTool),
      errorCodes: Object.keys(ERROR_CODES),
      state: {
        status: document.documentElement.dataset.gismapState,
        layers: mapController.isReady() ? layersApi.list() : [],
        engine: mapController.getEngineId(),
        basemap: mapController.getBasemapId(),
        camera,
        skin: document.documentElement.dataset.skin || presentation.skin || null,
        mode: presentation.template || "standard",
        briefingSlides: presentation.briefing?.slides?.length || 0,
        aiConfigured: aiController.isConfigured(),
        issues: issues.slice(),
      },
    };
  };
  const publicState = createPublicStateApi({ runtime: applicationRuntime, mapController, documentRef: document, events });
  uiController.mapSpec = mapSpecApi;
  globalThis.gisMapOnline = Object.freeze({
    version: clientApi.version,
    /** Resolves once the view, basemap and the layers the address asked for have loaded. */
    ready,
    describe,
    manifest: () => buildManifest({ tools: applicationRuntime.tools.list(), panels: applicationRuntime.panels.list() }),
    state: publicState,
    actions: createActionsApi({ runtime: applicationRuntime, state: publicState }),
    layers: layersApi,
    camera: cameraApi,
    /** Browser-side spatial analysis: operations(), run(operation, { input, overlay, options, addToMap, title }). */
    analysis: analysisApi,
    /** Whole maps as one JSON object (schemas/map-v1.schema.json): validate, encode, decode, createLink, load, fromCurrent. */
    mapSpec: mapSpecApi,
    /** Saved layer styles (schemas/layer-style-v1.schema.json): list, capture, save, apply, toMapSpec, createLink, toBriefing, export, import. */
    layerStyles: layerStylesApi,
    GisMapError,
    events,
    /** Experimental escape hatches: the ArcGIS Map and SceneView. Prefer layers.* and camera.*. */
    get map() { return mapController.native().map; },
    get view() { return mapController.native().view; },
    getProject: () => projectManager.snapshot(),
    getConnections: () => authController.list(),
    exportData: (options) => exportController.exportLayer(options),
    capabilities: clientApi.capabilities,
    briefing: clientApi.briefing,
    queries: clientApi.queries,
    sources: clientApi.sources,
    smartImages: clientApi.smartImages,
    /** The Print Editor: templates, getOptions, setOptions, preview, exportPdf, exportSmartImage, open. Exports return files. */
    print: printApi,
    /** Project files, returned without downloading: exportFile (.gis), exportPackage (.gisx). */
    project: Object.freeze({
      exportFile: () => projectManager.createFile(),
      exportPackage: () => projectManager.createPackage(),
    }),
    cinematic: Object.freeze({
      importCinematicSpec: (spec) => uiController.importCinematicSpec(spec),
      exportCinematicSpec: () => uiController.exportCinematicSpec(),
    }),
    application: Object.freeze({
      getState: () => applicationRuntime.state.value,
      getConfig: () => applicationRuntime.snapshot(),
      listPanels: () => applicationRuntime.panels.list(),
      listTools: () => applicationRuntime.tools.list().map(describeTool),
      runTool: (id, input, options) => applicationRuntime.runTool(id, input, options),
      plan: (prompt) => applicationRuntime.planRequest(prompt),
      previewPlan: (plan) => applicationRuntime.previewPlan(plan),
      undo: () => applicationRuntime.undo(),
    }),
  });

  // Read the address before the scene exists, so it starts on the requested
  // basemap instead of drawing the default and swapping it mid-draw.
  let shared = null;
  let sharedError = null;
  try {
    shared = parseShareParameters(location.search, POPULAR_SERVICES, { allowHttp });
  } catch (error) {
    sharedError = error;
  }
  const linkBasemap = shared?.basemap || (sharedState?.kind === "map-spec" ? sharedState.spec?.basemap : sharedState?.basemap) || null;
  mapController.setInitialBasemap(SHARE_BASEMAPS.has(linkBasemap) ? linkBasemap : null);
  let consoleBridge = null;
  if (siConsoleEmbed) {
    // Tools must work while basemap tiles are still loading, so this cannot wait for initialize().
    const parents = allowedParents(location.hostname, document.referrer);
    const post = (message) => { if (window.parent !== window) parents.forEach((origin) => window.parent.postMessage(message, origin)); };
    const connect = () => {
      const bridge = consoleBridge = mapController.attachConsoleOverlay({ post });
      if (!bridge) { setTimeout(connect, 100); return; }
      window.addEventListener("message", (event) => {
        if (event.source === window.parent && parents.includes(event.origin) && validConsoleMessage(event.data)) bridge.handle(event.data);
      });
    };
    connect();
  }
  await mapController.initialize();
  consoleBridge?.refit();
  events.publish("project:loaded", { project: projectManager.current, missingFiles: [] });

  // The SI parent can send its secure snapshot while the engine is still
  // initializing. Apply it only after the default map view is finalized.
  if (pendingPrivatePreview && loadPrivatePreview) {
    const preview = pendingPrivatePreview;
    pendingPrivatePreview = null;
    await loadPrivatePreview(preview);
  }

  // Waits that depend on drawing (camera moves) never finish in a hidden tab.
  const within = (promise, seconds) => Promise.race([promise, new Promise((resolve) => setTimeout(resolve, seconds * 1000))]);
  const sharedLayers = [];
  try {
    if (sharedError) throw sharedError;
    if (shared.basemap) mapController.setBasemap(shared.basemap);
    // ?layer= links (with their title=, where=, style=… parameters) load as a map spec, the one path for links.
    if (shared.layers.length) {
      const spec = mapSpecFromShareParameters(shared);
      // Another part of the link (#map, #briefing, a tour, a task, #at=) decides the view.
      if (sharedState || /(?:^#|&)(?:tour|fieldTask|fieldNote|at)=/.test(location.hash)) spec.camera = { fit: "none" };
      await within(mapSpecApi.load(spec, { replace: false }).ready, 120).catch((error) => events.publish("app:error", { message: error.message }));
      sharedLayers.push(...mapController.getLayers());
      // `?layer=…&embed=1` is how GISMap SI embeds a dataset: the same chrome-free view as an embedded #map link.
      if (sharedEmbed && !sharedState) {
        uiController.activateSharedEmbed("map");
        announceEmbedReady(sharedLayers.length);
      }
    }
    const example = POPULAR_SERVICES.find((item) => (item.slug || item.id) === shared.example);
    if (example?.presentation && sharedLayers.length) {
      const primaryLayer = sharedLayers.find((layer) => /pm2[.\s-]*5/i.test(layer.title || "")) || sharedLayers[0];
      projectManager.setPresentation({ ...example.presentation, primaryLayerId: primaryLayer.uid });
    }
    if (example && sharedLayers.length) uiController.activateExampleGuide(example, { start: true });
  } catch (error) {
    events.publish("app:error", { message: error.message });
  }

  // A documented, no-payload launcher for the finished Historical Quakes
  // briefing. Unlike ?example=historical-quakes, it loads the bounded source,
  // slides and presentation-only pulse as one editable briefing.
  if (!sharedState && launchParams.get("briefingExample") === "historical-quakes") {
    const slide = new URLSearchParams(location.hash.replace(/^#/, "")).get("slide");
    await uiController.openHistoricalQuakesBriefingExample({
      startTutorial: launchParams.get("tutorial") === "1",
      present: launchParams.get("briefingPresent") === "1",
      slide,
    });
  }

  // A styled map or briefing link (`#map=…`, `#briefing=…`, or `?briefing=<file URL>`).
  try {
    if (sharedStateError) throw sharedStateError;
    if (sharedState?.kind === "map-spec") {
      await within(mapSpecApi.load(sharedState.spec, { replace: false }).ready, 120);
      if (sharedEmbed) uiController.activateSharedEmbed(sharedState.spec?.briefing ? "briefing" : "map");
      // A link whose spec carries slides opens presenting them, as a briefing link does.
      // (mapSpec.load from the API stays quiet: an agent decides when to present.)
      const briefing = projectManager.current?.presentation?.briefing;
      if (sharedState.spec?.briefing && briefing?.slides?.some((slide) => !slide.hidden)) await uiController.openBriefingDocument(briefing, { present: true });
    } else if (sharedState) await uiController.openSharedState(sharedState, { loadLayer: loadUnifiedLayer, embed: sharedEmbed });
  } catch (error) {
    events.publish("app:error", { message: error.message });
  }

  const requestedWorkflow = sharedState ? null : launchParams.get("workflow");
  const sharedBriefingIds = launchParams.get("briefing");
  if (requestedWorkflow === "briefing" && sharedBriefingIds && !/^https?:/i.test(sharedBriefingIds)) {
    const layer = mapController.getLayers().find((item) => item.queryable);
    if (layer) projectManager.patchPresentation({ primaryLayerId: layer.uid, briefingSelection: { layerId: layer.uid, ids: sharedBriefingIds.split(",").filter(Boolean), useAll: false } });
  }
  const fieldTaskPayload = readFieldTaskHash(location.hash);
  try {
    const observation = readFieldNoteHash(location.hash);
    if (observation) await uiController.previewSharedObservation(observation);
  } catch (error) { events.publish("app:error", { message: error.message }); }
  if (fieldTaskPayload) {
    try {
      const shared = decodeFieldTask(fieldTaskPayload, { allowHttp: location.hostname === "localhost" || location.hostname === "127.0.0.1" });
      {
        // Bring in the feature layers the task points at (to work on them, or to inspect them in a
        // report), unless they are already on the map.
        const loaded = new Set(mapController.getLayers().flatMap((layer) => [featureLayerUrl(layer), mapController.getLayerConfig(layer).url]).filter(Boolean));
        for (const url of new Set(shared.task.features.map((feature) => feature.layerUrl).filter(Boolean))) {
          if (loaded.has(url)) continue;
          try {
            await loadSharedLayer(mapController, { url, serviceType: "arcgis-auto", renderer: shared.task.layerStyles?.[url] || null });
          } catch (error) {
            events.publish("app:error", { message: `A field task layer failed to load: ${error.message}` });
          }
        }
      }
      // The fragment stays in place so a reload reopens the task even in an unsaved project.
      await mobileWorkflowRouter.openSharedTask(shared, readFocus(location.hash));
    } catch (error) {
      events.publish("app:error", { message: error.message });
    }
  } else if (["briefing", "tours", "tasks"].includes(requestedWorkflow)) {
    mobileWorkflowRouter.navigate(requestedWorkflow);
  }
  // A location link (`#at=lat,lon`, as in PDF reports) opens the map pinned on that place.
  const sharedPlace = !fieldTaskPayload && readFocus(location.hash).at;
  if (sharedPlace) {
    mapController.setTaskPin({ kind: "task", label: "Shared location", ...sharedPlace });
    mapController.goToTaskPlaces([sharedPlace], { animate: false }).catch(() => {});
  }

  const tourMatch = location.hash.match(/(?:^#|&)tour=([^&]+)/);
  if (tourMatch) {
    try {
      const tour = decodeEmbeddedTour(tourMatch[1], new Set(BASEMAP_IDS));
      projectManager.setPresentation({ template: "atlas", ...tour });
      const launch = new URLSearchParams(location.search);
      const chapter = Math.max(0, Number(launch.get("chapter") || 1) - 1);
      await uiController.openSharedAtlas({
        chapterIndex: chapter,
        autoplay: launch.get("autoplay") === "1",
        tourOnly: launch.get("tourOnly") === "1",
        embed: launch.get("embed") === "1",
      });
      if (tour.chapters.some((item) => item.sharedBasemapFallback)) events.publish("app:error", { message: "One or more shared basemaps are unavailable; a supported map was used instead." });
    } catch (error) { events.publish("app:error", { message: error.message }); }
  }

  // Installed as an app, double-clicking a .gis / .gisx / .gisatlas / .gisbrief / .gisclip file opens it here.
  globalThis.launchQueue?.setConsumer?.(async ({ files = [] }) => {
    for (const handle of files) await uiController.importProjectFile(await handle.getFile());
  });

  // The basemap's layers loading is part of "ready": a screenshot taken now shows the whole map.
  await mapController.whenBasemapLoaded(15000);
  if (hasWebgl()) document.documentElement.dataset.gismapState = "ready";
  resolveReady();
  dispatchEvent(new CustomEvent("gismap:ready", { detail: describe() }));
}

start().catch((error) => {
  console.error(error);
  document.documentElement.dataset.gismapState = "error";
  rejectReady(error);
  document.querySelector("#map-status").textContent = "Map failed to start";
  events.publish("app:error", { message: error.message });
});
