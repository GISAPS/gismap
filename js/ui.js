import { GisMapError } from "./gismap-errors.js?v=0.54.0-print";
import { initializeFieldworkWorkspace } from "./fieldwork-workspace.js?v=0.65.0-paths";
import { timelinePdfFrames, expandTimelinePdfSlides, parseTimelineFrameSelection } from "./briefing-timeline-pdf.js?v=0.1.0";
import { renderNotesHub } from "./notes-hub.js?v=0.55.0-fieldwork1";
import { refreshMapNoteFilters } from './map-note-filters.js?v=0.4.1';
import { openDataMapNotesPanel } from "./data-map-notes-panel.js?v=0.55.0-fieldwork1";
import { refreshMapNoteWorkflow } from "./map-note-workflow-ui.js?v=0.1.0";
import { noteFeatureReference } from './map-note-feature.js?v=0.1.0';
import { openMapNotesPanel } from "./map-notes-panel.js?v=0.69.1-pdflinks";
import { refreshNoteRelationships } from "./note-relationships-ui.js?v=0.1.0";
import { googleMapsLinkForChapter } from "./google-maps-link.js?v=0.53.0";
import { POPULAR_SERVICES } from "./catalog.js?v=0.18.6-fire-source";
import { plainText } from "./layer-insight.js?v=0.50.1";
import { detectCoordinateColumns, googleSheetCsvUrl, isSpreadsheetName, readSpreadsheet, rowsToGeoJson } from "./spreadsheet-import.js?v=0.65.8-made-with";
import { MapAssistantPanel } from "./assistant-panel.js?v=0.68.0-charts1";
import { createAssistantTools, summarizeMapState } from "./map-assistant.js?v=0.68.0-charts1";
import { ENTERPRISE_CATALOGS, EnterpriseCatalog, normalizeArcGisDirectoryUrl } from "./enterprise-catalog.js?v=0.18.2";
import { createShareUrl } from "./share.js?v=0.69.9-order";
import { createShareLink, hasDataFilter, readBriefingFile } from "./map-share.js?v=0.69.9-order";
import { createEmbedIframe, createEmbedUrl } from "./embed-share.js?v=0.65.0-paths";
import { briefingLayerRef, findBriefingLayer } from "./briefing-api.js?v=0.69.9-order";
import { createEmbeddedTourUrl } from "./tour-share.js?v=0.54.0-unified4";
import { markdownToPlainText, renderMarkdown } from "./markdown.js?v=0.18.2";
import { formatAttributeValue } from "./attribute-format.js?v=0.18.2";
import { normalizeApplicationConfig, presetApplication } from "./application-config.js?v=0.68.0-charts1";
import { featureFilterFor, featureId, fieldKind, filterRecords, histogram, requestGuard, sortRecords } from "./presentation-query.js?v=0.30.0";
import { DEFAULT_SKIN, INTERFACE_SKINS, applyInterfaceSkin, normalizeSkin, resolveSkinTheme, setSkinThemeResolver, skinIsDark, skinOptionsMarkup, skinTone } from "./skin-catalog.js?v=0.57.0-skins2";
import { applyMapColors, MAP_COLOR_COMPONENTS, SKIN_BASEMAP, themeFromComputedStyle } from "./basemap-themes.js?v=0.53.0-mapcolors1";
import { compactMedia } from "./viewport.js?v=0.18.2";
import { APP_VERSION } from "./version.js?v=0.54.0-print";
import { bindMobileSheetResize } from "./mobile-sheet-resize.js?v=0.52.7";
import { BRAND } from "./brand.js";
import { BRAND_LOGO, PdfDocument, brandedMapImage, brandedQrCanvas, imageToJpeg, loadBrandLogo, printPalette, qrAsset } from "./pdf-document.js?v=0.69.1-pdflinks";
import { DEFAULT_PAGE_FRAME, IMAGE_ANCHORS, MAP_TEMPLATES, getTemplate, loadImage, renderTemplate, templateCompact, templateMapAspect } from "./map-templates.js?v=0.54.0-print";
import { featureLayerUrl, locationUrl } from "./field-task-share.js?v=0.54.0-unified4";
import { dockIcon } from "./dock-icons.js?v=0.24.0";
import { serviceNameFromUrl } from "./service-name.js?v=0.26.0";
import { decodeQrFromImage, describeGisMapLink, gisMapLinkFrom, openGisMapLink } from "./qr-import.js?v=0.25.2";
import { BriefingSlides } from "./briefing-slides.js?v=0.69.9-order";
import { addSlide, createSlide, isRoutineField, matchesFilter, normalizeBriefing, normalizeFilter } from "./briefing-document.js?v=0.61.0-briefing-player";
import { conditionComplete, conditionLabel, conditionToFilter } from "./briefing-conditions.js?v=0.1.0";
import { createFilterBuilder } from "./filter-builder.js?v=0.1.0";
import { conditionsToWhere } from "./filter-sql.js?v=0.1.0";
import { aiDescriptionPrompt, applyAiDescriptions, describeWhere, generateBriefing, readAiDescriptions, rendererTheme } from "./briefing-generator.js?v=0.60.0-media1";
import { briefingFileStem } from "./briefing-pdf.js?v=0.69.1-pdflinks";
import { RAMPS, rampColors, compileRenderer } from "./renderer-spec.js?v=0.29.1";
import { saveEngine } from "./engine-preference.js?v=0.52.1";
import { BASEMAPS } from "./basemap-catalog.js?v=0.53.0-gallery1";
import { CartographyLab } from "./cartography-lab.js?v=0.69.9-order";
import { CONTEXT_ACTIONS, createSuggestionPreferences, deriveWorkspace, executeContextAction, suggestionKey, summarizeFeature } from "./contextual-workspace.js?v=6";
import { BRIEFING_WALKTHROUGH_STEPS, CINEMATIC_WALKTHROUGH_STEPS, HISTORICAL_QUAKES_BRIEFING_TUTORIAL_STEPS, createExampleWalkthroughSteps, startWorkspaceWalkthrough, waitForWalkthroughTarget } from "./workspace-walkthrough.js?v=0.62.3-briefing-slide-engines";
import { HISTORICAL_QUAKES_SOURCE, HISTORICAL_QUAKES_WHERE, createHistoricalQuakesExampleBriefing } from "./example-hazards-briefing.js?v=0.62.3-briefing-slide-engines";
import { CinematicModeController } from "./cinematic/mode.js?v=0.69.9-order";
import { CINEMATIC_EFFECTS, CINEMATIC_EFFECT_CATEGORIES, suggestEffect } from "./cinematic/cinematic-effects.js?v=0.69.9-order";
import { PROVENANCE_STATUSES } from "./cinematic/clock.js?v=0.1.0";
import { recommendAnimations } from "./cinematic/recommend.js?v=0.69.9-order";

// What each provenance label tells a viewer about a track's displayed progression.
const PROVENANCE_HELP = Object.freeze({
  observed: "Observed: each step shows recorded data as captured.",
  interpolated: "Interpolated: in-between states are estimated, not recorded.",
  modeled: "Modeled: the progression comes from a model, not observations.",
  forecast: "Forecast: a prediction of what may happen.",
  illustrative: "Illustrative: decorative motion that does not measure anything.",
});
import { numericFieldCandidates, temporalFieldCandidates } from "./cinematic/temporal-adapter.js?v=0.3.1";
import { buildClipPackage, clipToCinematicSpec, createCinematicClip, exportCinematicClip, normalizeCinematicClip } from "./cinematic/clip-model.js?v=0.3.10-strata";
import { availableVideoFormats, cameraAt, CLIP_FRAME_RATES, clipFrameCount, exportCinematicVideo, observationIndexAt, renderClipPoster } from "./cinematic/clip-export.js?v=0.69.9-order";
import { CHART_PANEL_PLACEMENTS, CHART_TYPES, PRESENTATION_TARGETS, chartFields, chartOption, createChartSpec, displayChartRows, loadECharts, queryChart, recommendCharts, renderChartFallback, rowsAsCsv } from "./charting-tools.js?v=0.68.0-charts1";
import { MapChartOverlayController } from "./map-chart-tools.js?v=0.68.0-charts1";
import { readTextBoxEditor, textBoxEditorMarkup, textBoxRunMarkup, textBoxSummary } from "./text-box-editor.js?v=0.65.0-paths";
import { labelEditorMarkup, labelableFields, readLabelEditor, syncLabelEditor } from "./label-editor.js?v=0.65.0-paths";
import { normalizeLabeling } from "./layer-labels.js?v=0.65.0-paths";
import { APP_ROOT, appUrl } from "./app-root.js?v=0.65.0-paths";
import { defaultRun } from "./text-boxes.js?v=0.65.0-paths";

const BUILDINGS_3D_KEY = "gismap-online:buildings-3d:v1";
const DISPLAY_SETTINGS_KEY = "gismap-online:display:v1";
const DEFAULT_BRAND = Object.freeze({ name: BRAND.name, logo: `./${BRAND.logo}` });
const WELCOME_PREFERENCE_KEY = "gismap.welcome.v1";
const DOCKABLE_PANELS = { places: "Places", bookmarks: "Bookmarks", draw: "Draw", intelligence: "Intelligence", layers: "Layers", observations: "Notes & Tasks" };
const RECENT_PLACES_KEY = "gismap-online:recent-places:v1";
const RECENT_PLACES_LIMIT = 6;
// Briefing and dashboard data: the first page draws at once, the rest pages in behind it.
const MAX_PRESENTATION_RECORDS = 10000;
const PRESENTATION_PAGE_SIZE = 1000;
const INSIGHT_POSITIONS = new Set(["upper-left", "lower-left", "bottom", "dock-left", "dock-right", "dock-top", "dock-bottom"]);
const TABLE_POSITIONS = new Set(["overlay-bottom", "dock-left", "dock-right", "dock-top", "dock-bottom"]);
// Every basemap id with its label (the menus list only the active engine's own; see #basemapOptionsMarkup).
const BASEMAP_OPTIONS = BASEMAPS.map(({ id, label }) => [id, label]);
const BASEMAP_IDS = new Set(BASEMAP_OPTIONS.map(([id]) => id));
const CHART_FAMILY_LABELS = Object.freeze({
  "line-area": "Line & Area",
  "bar-column": "Bar & Column",
  "scatter-bubble": "Scatter & Bubble",
  "distribution-composition": "Distribution & Composition",
  "3d": "3D Charts",
  map: "Map Charts",
  custom: "Custom Chart Builder",
});

// A deliberately small, offline-ready layer for trying every chart family.
// The names, categories, numeric measures, and point geometry give the builder
// useful defaults without requiring an account, network connection, or service.
const chartExampleFeatureCollection = () => ({
  type: "FeatureCollection",
  features: [
    ["Cascade", "North", 84, 126, -122.6765, 45.5231], ["Harbor", "North", 72, 111, -122.3321, 47.6062],
    ["Juniper", "West", 65, 98, -122.4194, 37.7749], ["Mesa", "West", 58, 92, -118.2437, 34.0522],
    ["Prairie", "Central", 76, 119, -104.9903, 39.7392], ["Riverbend", "Central", 61, 101, -96.7970, 32.7767],
    ["Cypress", "South", 88, 138, -84.3880, 33.7490], ["Seaside", "South", 69, 108, -80.1918, 25.7617],
    ["Maple", "East", 81, 132, -74.0060, 40.7128], ["Summit", "East", 74, 115, -71.0589, 42.3601],
    ["Lakeside", "North", 63, 103, -87.6298, 41.8781], ["Canyon", "West", 79, 127, -112.0740, 33.4484],
  ].map(([site, region, score, visits, longitude, latitude], index) => ({
    type: "Feature",
    geometry: { type: "Point", coordinates: [longitude, latitude] },
    properties: {
      site,
      region,
      score,
      visits,
      month: index + 1,
    },
  })),
});

const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);

export class UIController {
  constructor(events, mapController, projectManager, authController, aiController, toolManager, exportController, applicationRuntime, panelManager, mobilePanelManager) {
    Object.assign(this, { events, mapController, projectManager, authController, aiController, toolManager, exportController, applicationRuntime, panelManager, mobilePanelManager });
    this.dialog = document.querySelector("#app-dialog");
    this.searchResults = [];
    this.searchTimer = null;
    this.searchRequestId = 0;
    this.lastPlaceLabel = "";
    this.searchSelection = -1;
    this.lastInsight = null;
    this.intelligenceInsight = null;
    this.selectedInsightIndexes = new Set();
    this.insightIsolation = null;
    this.lastAIResponseText = null;
    this.lastAIQueryText = null;
    this.aiPending = false;
    this.identifyPending = false;
    this.utilityIntelligenceOpen = false;
    this.utilityDrawOpen = false;
    this.utilityStyleLayerUid = null;
    this.utilitySourceLayerUid = null;
    this.utilityQueryLayerUid = null;
    this.utilityDialogLayerTool = null;
    this.activeUtilityTab = null;
    this.utilityModalPane = null;
    this.utilityDialogOpen = false;
    this.utilityQueryOpen = false;
    this.expandedLayerCards = new Set();
    this.suppressNextDialogClose = false;
    this.presentationSearchTimer = null;
    this.atlasPlaybackToken = 0;
    this.sharedTourLaunch = false;
    this.sharedTourOnly = false;
    this.sharedTourEmbed = false;
    this.tourShareRenderToken = 0;
    this.workflowShareRenderToken = 0;
    // Standard panels currently docked as right-panel tabs (see #initDockablePanels).
    this.utilityPanelsOpen = new Set();
    // Which Briefing sections are unfolded on phones, kept across re-renders of the sheet.
    this.briefingFolds = { records: true, context: false };
    // Briefing has two tabs: Features (investigate) and Slides (author the presentation).
    this.briefingTab = "features";
    // Desktop Briefing: the Deck in the sidebar, Data docked at the bottom, an Inspector on the right (?briefingLayout=1: the previous layout).
    this.briefingV2 = new URLSearchParams(location.search).get("briefingLayout") !== "1";
    this.briefingInspectorOpen = false;
    // The Map assistant: a chat with the configured AI model that builds maps, briefings, tours and field tasks.
    this.assistant = new MapAssistantPanel({
      ai: this.aiController,
      tools: () => (this.assistantTools ??= createAssistantTools(this.#assistantHost())),
      state: () => summarizeMapState(globalThis.gisMapOnline),
      configure: () => this.#aiDialog(),
    });
    this.applicationRuntime.mountAssistant = (host) => this.assistant.mount(host);
    this.briefingSlides = new BriefingSlides({
      getBriefing: () => this.projectManager.current.presentation?.briefing,
      // A slide's focus feature can be clicked on the map; the callback gets its ID.
      pickFeature: (onPick) => {
        this.briefingFocusPick = onPick;
        document.body.classList.add("briefing-map-select");
        this.toast(`Click a feature in ${this.mapController.getLayer(this.presentationState.layerUid)?.title || "the briefing layer"} on the map.`);
      },
      saveBriefing: (briefing) => {
        this.projectManager.patchPresentation({ briefing });
        this.#syncBriefingTabs();
      },
      data: () => this.#briefingSlideData(),
      mapController: this.mapController,
      ensureSlideEngine: (slide) => this.#ensureHistoricalQuakesSlideEngine(slide),
      notify: (message) => this.toast(message),
      formatValue: (value, field, name) => formatAttributeValue(value, field, name),
      compact: () => this.mobileMedia.matches,
      share: () => this.shareBriefing(),
      createTask: (draft) => this.fieldTasks?.newTaskFrom(draft),
      createTour: (places, options) => this.createTourFromPlaces(places, options),
      generate: () => this.generateBriefingFromView(),
      describeWithAi: () => (this.aiController.isConfigured() ? this.#describeBriefingWithAi() : null),
      aiReady: () => this.aiController.isConfigured(),
      openInspector: () => this.#openBriefingInspector(),
      getCinematicClip: (id) => this.projectManager.current.presentation?.cinematicClips?.find((clip) => clip.id === id) || null,
      cinematicClips: () => this.projectManager.current.presentation?.cinematicClips || [],
      playCinematicClip: (slide, options) => this.#playBriefingCinematicClip(slide, options),
      pauseCinematicClip: () => this.cinematicController.pause(),
      stopCinematicClip: () => this.#stopBriefingCinematicClip(),
    });
    this.briefingFoldSelection = null;
    this.cinematicController = new CinematicModeController({
      mapController: this.mapController,
      onState: (state) => {
        this.cinematicState = state;
        this.events.publish("cinematic:state-changed", state);
        this.#syncCinematicControls(state);
      },
    });
    this.cinematicState = null;
    this.mobileAtlasSettingsOpen = false;
    this.presentationState = { template: "standard", records: [], visibleRecords: [], selectedIds: new Set(), layerUid: null, search: "", searchField: "*", searchOperator: "contains", chartField: null, scope: "all", rangeMin: null, rangeMax: null, sortField: null, sortDirection: "asc", page: 1, pageSize: 25, binCount: 12 };
    this.briefingRequest = requestGuard();
    this.keepWelcomeForSharedExample = new URLSearchParams(location.search).has("example");
    this.systemThemeMedia = matchMedia("(prefers-color-scheme: dark)");
    // Every skin renders light or dark: the house skin follows Appearance; other skins keep their own choice.
    setSkinThemeResolver((skin) => {
      const settings = this.#readDisplaySettings();
      const houseTheme = settings.appearance === "system" ? (this.systemThemeMedia.matches ? "dark" : "light") : settings.appearance;
      return resolveSkinTheme(skin, { houseTheme, choices: settings.skinAppearance });
    });
    this.mobileMedia = mobilePanelManager?.media || compactMedia();
    this.mapChartOverlays = new MapChartOverlayController({
      events: this.events,
      mapController: this.mapController,
      projectManager: this.projectManager,
      notify: (message) => this.toast(message),
      onSelect: ({ feature, layer }) => {
        const objectId = feature?.attributes?.[layer?.objectIdField];
        this.applicationRuntime.state.dispatch("selection:set", {
          layerId: layer?.uid || null,
          objectIds: objectId == null ? [] : [objectId],
          features: feature ? [{ attributes: feature.attributes || {}, geometry: feature.geometry || null, layerTitle: layer?.title || "" }] : [],
        }, { undoable: false });
        if (feature) void this.mapController.highlightFeature({ kind: "feature", layerUid: layer.uid, layerTitle: layer.title, attributes: feature.attributes || {}, geometry: feature.geometry || null }, { pulse: false });
      },
    });
  }

  initialize() {
    this.#applyBrandSettings();
    this.panelManager?.register("content:intelligence", document.querySelector("#intelligence-content"), { shell: document.querySelector("#intelligence-panel") });
    this.panelManager?.register("content:draw", document.querySelector(".draw-tools"), { shell: document.querySelector("#draw-panel") });
    this.#initDockablePanels();
    this.#configureWelcomeStartup();
    this.#initNotesHub();
    this.#initLegendEditing();
    this.#applyDisplaySettings(this.#readDisplaySettings());
    this.#followSkinOnMap();
    this.systemThemeMedia.addEventListener?.("change", () => {
      const settings = this.#readDisplaySettings();
      if (settings.appearance === "system") this.#applyDisplaySettings(settings);
    });
    if (this.mobileMedia.matches) {
      this.mobilePanelManager?.enter();
      this.#setSidebarCollapsed(true);
    }
    this.mobileMedia.addEventListener?.("change", ({ matches }) => {
      if (this.dialog.open && !this.dialog.classList.contains("app-dialog--docked")) {
        this.suppressNextDialogClose = true;
        this.dialog.close();
        if (matches) this.dialog.show();
        else this.dialog.showModal();
      }
      document.body.classList.remove("mobile-map-tools-open", "mobile-drawer-expanded");
      document.body.classList.remove("map-tools-collapsed");
      this.#syncMapToolsToggle(matches ? false : true);
      this.#setSidebarCollapsed(matches && this.presentationState.template === "standard");
      this.#applyDisplaySettings(this.#readDisplaySettings());
      if (matches) {
        this.utilityIntelligenceOpen = false;
        this.utilityDrawOpen = false;
        this.utilityStyleLayerUid = null;
        this.utilityPresentationOpen = false;
        this.activeUtilityTab = null;
        this.#syncUtilityPanel();
        this.mobilePanelManager?.enter();
      } else {
        this.mobilePanelManager?.leave();
      }
    });
    this.#buildMobileMenu();
    this.#bindMenus();
    this.#bindMapMenu();
    this.#bindStaticActions();
    this.#bindInsightResize();
    this.#bindUtilityPanel();
    this.#bindMobileDrawerResize();
    this.#bindMobileSheetResize();
    this.#bindMobileActionBar();
    this.#bindMapEvents();
    document.addEventListener("gismap:chart-panel-settings", (event) => this.#openChartPanelSettings(event.detail?.instanceId));
    document.addEventListener("gismap:chart-workspace", (event) => {
      this.chartWorkspaceOpen = Number(event.detail?.count || 0) > 0;
      this.#syncUtilityPanel(this.chartWorkspaceOpen ? "workspace" : null);
    });
    this.chartWorkspaceOpen = Boolean(document.querySelector('[data-utility-pane="workspace"] > .application-panel--workspace-chart'));
    if (this.chartWorkspaceOpen) this.#syncUtilityPanel("workspace");
    this.mapChartOverlays.initialize();
    this.#renderBookmarks();
    this.#renderLayers();
    document.querySelector("#insights-ai").hidden = !this.aiController.isConfigured();
    this.#renderIntelligenceContents();
    this.fieldworkWorkspace = initializeFieldworkWorkspace({
      ui: this,
      action: action => this.#handleAction(action),
      showSidebar: open => this.#setSidebarCollapsed(!open),
      setPanelVisibility: (id, visible, save = true) => this.#setOptionalPanelVisibility(id, visible, save),
      classic: () => this.#readDisplaySettings().classicLayout,
      // Light/dark flips the current skin; it never swaps the skin for the house look.
      theme: () => {
        const current = this.#readDisplaySettings();
        const skin = normalizeSkin(document.documentElement.dataset.skin);
        const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
        const settings = skinTone(skin) === "auto" ? { ...current, appearance: next } : { ...current, skinAppearance: { ...current.skinAppearance, [skin]: next } };
        try { localStorage.setItem(DISPLAY_SETTINGS_KEY, JSON.stringify(settings)); } catch { /* Session-only appearance. */ }
        this.#applyDisplaySettings(settings);
      },
    });
  }

  #initContextualWorkspace() {
    const host = document.createElement("section");
    host.className = "context-workspace";
    host.setAttribute("aria-label", "Suggested next steps");
    host.hidden = true;
    const placeHost = () => document.querySelector("#map-status")?.before(host);
    placeHost();
    this.mobileMedia.addEventListener?.("change", placeHost);
    let storage = null;
    try { storage = globalThis.localStorage; } catch { /* Private browsing: keep choices in memory. */ }
    const preferences = createSuggestionPreferences(storage);
    const samples = new Map();
    let featureSelected = false;
    const render = () => {
      if (!this.mapController.isReady()) return;
      const state = this.applicationRuntime.state.value;
      const layers = this.mapController.getLayers();
      const layer = layers.find((item) => item.uid === state.activeLayerId) || layers[0] || null;
      const config = layer ? this.mapController.getLayerConfig(layer) : {};
      if (layer?.queryable && config.local && !samples.has(layer.uid)) {
        samples.set(layer.uid, null);
        void this.mapController.queryFeatures(layer.uid, { where: "1=1", outFields: ["*"], returnGeometry: false, num: 100 }, { layerDefaults: false })
          .then(({ features }) => { if (this.mapController.getLayer(layer.uid) === layer && samples.has(layer.uid)) { samples.set(layer.uid, features.slice(0, 100)); render(); } })
          .catch(() => { /* Metadata remains usable if sampling fails. */ });
      }
      const workflow = document.body.classList.contains("field-task-picking") ? "field-task"
        : this.mapNotesModeActive || this.dataMapNotesOpen ? "notes"
        : this.presentationState.template === "briefing" ? "briefing"
        : this.presentationState.template !== "standard" || this.applicationRuntime.currentConfig?.mode === "present" ? "presentation"
        : document.body.classList.contains("fieldwork-desktop") && document.querySelector("#sidebar")?.dataset.workspace === "draw" ? "draw" : "explore";
      const context = deriveWorkspace({ layers, activeLayerId: state.activeLayerId,
        capabilities: this.mapController.getCapabilities(), selection: featureSelected ? state.selection : null, sample: layer ? samples.get(layer.uid) : null,
        workflow, viewport: this.mobileMedia.matches ? "mobile" : "desktop" });
      const key = suggestionKey(this.projectManager.current.id, context.rule, config);
      const suppressed = featureSelected || workflow !== "explore";
      const dismissed = preferences.has(key);
      host.hidden = suppressed || !context.layer || !document.querySelector("#welcome-panel")?.hidden || !context.actions.length;
      if (new URLSearchParams(location.search).has("contextDebug")) {
        globalThis.gisMapContextDebug = { rule: context.rule, workflow, viewport: this.mobileMedia.matches ? "mobile" : "desktop", engine: this.mapController.getEngineId(), activeLayerId: layer?.uid || null, layerCount: layers.length, selection: state.selection, layout: this.fieldworkWorkspace?.layout() || null, profile: context.profile, actions: context.actions, suppressedActions: context.suppressed, dismissed, surfaceSuppressed: suppressed };
      }
      if (host.hidden) return;
      host.replaceChildren();
      if (dismissed) {
        host.classList.add("context-workspace--dismissed");
        const restore = document.createElement("button");
        restore.type = "button"; restore.className = "context-workspace__restore"; restore.textContent = "Show suggestions";
        restore.addEventListener("click", () => { preferences.restore(key); render(); });
        host.append(restore);
        return;
      }
      host.classList.remove("context-workspace--dismissed");
      const header = document.createElement("div");
      header.className = "context-workspace__header";
      const heading = document.createElement("div");
      const eyebrow = document.createElement("span");
      eyebrow.className = "context-workspace__eyebrow";
      eyebrow.textContent = "START EXPLORING";
      const title = document.createElement("strong");
      title.textContent = context.layer ? `Create with ${context.layer.title || "your data"}` : "What will you make?";
      heading.append(eyebrow, title);
      const close = document.createElement("button");
      close.type = "button"; close.className = "context-workspace__close";
      close.setAttribute("aria-label", "Dismiss suggestions"); close.textContent = "×";
      close.addEventListener("click", () => { preferences.dismiss(key); render(); });
      header.append(heading, close);
      const actions = document.createElement("div");
      actions.className = "context-workspace__actions";
      const makeButton = (id) => {
        const action = CONTEXT_ACTIONS[id];
        const button = document.createElement("button");
        button.type = "button"; button.textContent = action.label; button.title = action.description;
        button.addEventListener("click", () => {
          const lab = () => this.openCartographyLab(context.layer.uid);
          executeContextAction(id, context, {
            briefing: () => this.openMobileWorkflow("briefing"), tour: () => this.openMobileWorkflow("tours"), skins: () => this.#handleAction("map-presentation"),
            table: () => this.events.publish("table:open", { uid: context.layer.uid }), style: lab,
            threeDimensional: () => { lab(); requestAnimationFrame(() => document.querySelector('#utility-lab-content [data-lab-dimension="3d"]')?.focus()); },
            filter: () => { lab(); this.cartographyLab?.styleTabs?.select("filter", true); },
            time: () => { lab(); this.cartographyLab?.styleTabs?.select("filter", true); const builder = this.cartographyLab?.builder; if (builder && !builder.conditions.length) builder.addCondition(context.profile.fields.temporal[0]); },
          });
        });
        return button;
      };
      context.actions.slice(0, 3).forEach((id) => actions.append(makeButton(id)));
      if (context.actions.length > 3) {
        const more = document.createElement("details");
        more.className = "context-workspace__more";
        const summary = document.createElement("summary"); summary.textContent = "More";
        more.append(summary, ...context.actions.slice(3).map(makeButton));
        actions.append(more);
      }
      host.append(header, actions);
      const walkthrough = document.createElement("button");
      walkthrough.type = "button";
      walkthrough.className = "context-workspace__walkthrough";
      walkthrough.textContent = "Walk me through the tools and menus";
      walkthrough.addEventListener("click", () => this.#startWorkspaceWalkthrough());
      host.append(walkthrough);
      if (context.profile?.profileStatus === "sampled") {
        const coverage = document.createElement("p"); coverage.className = "context-workspace__coverage";
        coverage.textContent = `${context.profile.coverage.sampleSize} local records sampled · not a full analysis`;
        host.append(coverage);
      }
      if (new URLSearchParams(location.search).has("contextDebug")) {
        const diagnostic = document.createElement("details"); diagnostic.className = "context-workspace__diagnostics";
        const summary = document.createElement("summary"); summary.textContent = "Context diagnostics";
        const data = document.createElement("pre"); data.textContent = JSON.stringify(globalThis.gisMapContextDebug, null, 2);
        diagnostic.append(summary, data); host.append(diagnostic);
      }
    };
    ["map:ready", "layer:added", "layer:removed", "layer:changed", "layers:reset", "project:loaded", "mobile:workflow-changed", "presentation:changed", "application:changed", "context:workspace-changed"].forEach((topic) => this.events.subscribe(topic, () => queueMicrotask(render)));
    this.applicationRuntime.state.subscribe(render, (state) => state.activeLayerId);
    this.events.subscribe("identify:complete", ({ results = [] }) => { featureSelected = results.length > 0; render(); });
    this.events.subscribe("layer:removed", ({ uid }) => samples.delete(uid));
    this.events.subscribe("layers:reset", () => samples.clear());
    ["identify:cleared", "insight:distance-exceeded"].forEach((topic) => this.events.subscribe(topic, () => { featureSelected = false; render(); }));
    document.querySelector("#insights-close")?.addEventListener("click", () => { featureSelected = false; render(); });
  }

  #buildMobileMenu() {
    const drawer = document.querySelector("#mobile-menu-drawer");
    const desktopMenu = document.querySelector("#sidebar > .menu-bar");
    const header = document.createElement("header");
    header.className = "mobile-menu-drawer__header";
    const title = document.createElement("strong");
    title.textContent = "Main menu";
    const close = document.createElement("button");
    close.id = "mobile-menu-close";
    close.type = "button";
    close.setAttribute("aria-label", "Close main menu");
    close.textContent = "×";
    header.append(title, close);
    const mobileMenu = desktopMenu.cloneNode(true);
    mobileMenu.querySelectorAll('[data-action="dashboard-builder"]').forEach((item) => item.remove());
    // Phones take notes in the field: Field notes stays; Map notes (desktop data annotation) does not.
    mobileMenu.querySelectorAll('[data-action="mode-data-map-notes"]').forEach((item) => item.remove());
    const workflows = mobileMenu.querySelector(".desktop-workflows-menu");
    workflows?.classList.remove("desktop-workflows-menu");
    workflows?.removeAttribute("data-desktop-only");
    const workflowTrigger = workflows?.querySelector(".menu__trigger");
    if (workflowTrigger) {
      workflowTrigger.firstChild.textContent = "Modes";
    }
    workflows?.querySelector('[data-action="map-presentation"]')?.replaceChildren(document.createTextNode("Instant Dashboard…"));
    workflows?.querySelector('[data-mobile-workflow="briefing"]')?.replaceChildren(document.createTextNode("Briefing"));
    workflows?.querySelector('[data-mobile-workflow="tours"]')?.replaceChildren(document.createTextNode("Tours"));
    workflows?.querySelector(".menu__link--field")?.replaceChildren(document.createTextNode("Field Mode"));
    workflows?.querySelector('[data-mobile-workflow="map"]')?.replaceChildren(document.createTextNode("Map tools"));
    drawer.replaceChildren(header, mobileMenu);
  }

  #bindMenus() {
    document.querySelectorAll(".menu__trigger").forEach((trigger) => {
      trigger.addEventListener("click", (event) => {
        event.stopPropagation();
        const menu = trigger.closest(".menu");
        const selectingConsolidated = document.body.dataset.navigationLayout === "top"
          && menu.closest(".menu-bar")?.classList.contains("is-consolidated-open");
        const open = selectingConsolidated || !menu.classList.contains("is-open");
        document.querySelectorAll(".menu.is-open").forEach((item) => item.classList.remove("is-open"));
        menu.classList.toggle("is-open", open);
        trigger.setAttribute("aria-expanded", String(open));
      });
    });
    document.querySelectorAll(".menu-bar__all-trigger").forEach((trigger) => {
      trigger.addEventListener("click", (event) => {
        event.stopPropagation();
        const menuBar = trigger.closest(".menu-bar");
        const open = !menuBar.classList.contains("is-consolidated-open");
        document.querySelectorAll(".menu-bar.is-consolidated-open").forEach((item) => item.classList.remove("is-consolidated-open"));
        menuBar.classList.toggle("is-consolidated-open", open);
        trigger.setAttribute("aria-expanded", String(open));
        if (open && !menuBar.querySelector(".menu.is-open")) {
          const firstMenu = menuBar.querySelector(".menu");
          firstMenu?.classList.add("is-open");
          firstMenu?.querySelector(".menu__trigger")?.setAttribute("aria-expanded", "true");
        }
      });
    });
    document.addEventListener("click", () => {
      document.querySelectorAll(".menu.is-open").forEach((item) => item.classList.remove("is-open"));
      document.querySelectorAll(".menu__trigger").forEach((item) => item.setAttribute("aria-expanded", "false"));
      document.querySelectorAll(".menu-bar.is-consolidated-open").forEach((item) => item.classList.remove("is-consolidated-open"));
      document.querySelectorAll(".menu-bar__all-trigger").forEach((item) => item.setAttribute("aria-expanded", "false"));
    });
    document.querySelectorAll(".menu__content").forEach((menu) => menu.addEventListener("click", (e) => e.stopPropagation()));
  }

  #bindStaticActions() {
    window.addEventListener("beforeunload", event => { if (this.captureDataMapNoteDraft?.() || this.dataMapNoteDraftDirty) { event.preventDefault(); event.returnValue = ""; } });
    document.querySelector("#welcome-close").addEventListener("click", () => this.#dismissWelcome({ persist: true }));
    document.querySelector("[data-welcome-start]")?.addEventListener("click", () => {
      this.#dismissWelcome({ persist: Boolean(document.querySelector("#welcome-suppress")?.checked) });
    });
    document.querySelector("#welcome-suppress")?.addEventListener("change", (event) => {
      this.#saveWelcomePreference({ dismissed: event.currentTarget.checked });
    });
    document.querySelectorAll("[data-welcome-workflow]").forEach((button) => button.addEventListener("click", () => {
      this.#dismissWelcome();
      this.openMobileWorkflow(button.dataset.welcomeWorkflow);
    }));
    document.querySelector("#layers-list")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-empty-action]");
      if (button) this.#handleAction(button.dataset.emptyAction);
    });
    document.querySelectorAll("[data-action]").forEach((button) =>
      button.addEventListener("click", () => {
        if (button.closest("#welcome-panel")) this.#dismissWelcome();
        this.#closeMenus();
        this.#handleAction(button.dataset.action);
      }),
    );
    document.querySelectorAll("[data-basemap]").forEach((button) =>
      button.addEventListener("click", () => {
        this.mapController.setBasemap(button.dataset.basemap);
        this.toast(`Basemap changed to ${button.textContent.trim()}.`);
        this.#closeMenus();
      }),
    );
    document.querySelectorAll("[data-ground]").forEach((button) =>
      button.addEventListener("click", () => {
        this.mapController.setGround(button.dataset.ground);
        this.toast(`Terrain changed to ${button.textContent.trim()}.`);
        this.#closeMenus();
      }),
    );
    document.querySelectorAll("[data-basemap-picker]").forEach((select) =>
      select.addEventListener("change", () => {
        this.mapController.setBasemap(select.value);
        this.toast(`Basemap changed to ${select.selectedOptions[0]?.textContent.trim()}.`);
        this.#closeMenus();
      }),
    );
    document.querySelectorAll("[data-buildings-toggle]").forEach((input) =>
      input.addEventListener("change", () => {
        try { localStorage.setItem(BUILDINGS_3D_KEY, input.checked ? "on" : "off"); } catch { /* Not kept. */ }
        this.projectManager.current.buildings3d = input.checked;
        this.projectManager.persistCurrentIfSaved();
        this.mapController.setBuildings3d(input.checked);
        this.toast(input.checked ? "3D buildings on." : "3D buildings off.");
      }),
    );
    document.querySelectorAll("[data-ground-picker]").forEach((select) =>
      select.addEventListener("change", () => {
        this.mapController.setGround(select.value);
        this.toast(`Terrain changed to ${select.selectedOptions[0]?.textContent.trim()}.`);
        this.#closeMenus();
      }),
    );
    document.querySelectorAll("[data-widget]").forEach((button) =>
      button.addEventListener("click", async () => {
        try {
          const active = await this.mapController.toggleWidget(button.dataset.widget);
          button.classList.toggle("is-active", active);
        } catch (error) {
          this.error(error.message);
        }
        this.#closeMenus();
      }),
    );
    document.querySelectorAll("[data-sidebar-panel-toggle]").forEach((button) =>
      button.addEventListener("click", () => {
        const panel = document.querySelector(`#${button.dataset.sidebarPanelToggle}`);
        if (!panel) return;
        // The desktop workspace decides what the side panel shows; phones keep the optional-panel model.
        if (document.body.classList.contains("fieldwork-desktop")) this.fieldworkWorkspace.togglePanel(panel.id);
        else this.#setOptionalPanelVisibility(panel.id, panel.classList.contains("is-sidebar-optional-hidden"));
        this.#closeMenus();
      }),
    );
    document.querySelectorAll("[data-panel-top-nav]").forEach((button) => button.addEventListener("click", () => {
      const settings = { ...this.#readDisplaySettings(), navigationLayout: document.body.dataset.navigationLayout === "top" ? "side" : "top" };
      localStorage.setItem(DISPLAY_SETTINGS_KEY, JSON.stringify(settings)); this.#applyDisplaySettings(settings); this.#closeMenus();
    }));
    document.querySelectorAll("[data-panel-workspace]").forEach((button) => button.addEventListener("click", () => {
      this.utilityWorkspaceOpen = true; this.#syncUtilityPanel("workspace"); this.#closeMenus();
    }));
    document.querySelectorAll("[data-draw]").forEach((button) =>
      button.addEventListener("click", () => {
        if (button.dataset.draw === "clear") this.mapController.clearTextBoxes?.();
        this.mapController.draw(button.dataset.draw);
      }),
    );
    document.querySelector("#draw-text-box")?.addEventListener("click", () => this.#placeTextBox());
    document.querySelector("#text-box-list")?.addEventListener("click", (event) => {
      const edit = event.target.closest("[data-text-box-edit]");
      const remove = event.target.closest("[data-text-box-remove]");
      if (edit) this.#openTextBoxEditor(edit.dataset.textBoxEdit);
      if (remove) this.mapController.removeTextBox(remove.dataset.textBoxRemove);
    });
    this.events.subscribe("text-boxes:changed", () => this.#renderTextBoxList());
    document.querySelector("#draw-style")?.addEventListener("click", () => this.#openDrawingStyle());

    document.querySelector("#draw-export").addEventListener("click", () => {
      const drawings = this.exportController.listExportableLayers().find((item) => item.kind === "drawings");
      if (!drawings) {
        this.error("Draw at least one point, line, polygon, or rectangle before exporting.");
        return;
      }
      this.#exportDialog(drawings.uid);
    });
    document.querySelectorAll("[data-nav]").forEach((button) =>
      button.addEventListener("click", () => this.mapController.navigate(button.dataset.nav).catch((e) => this.error(e.message))),
    );
    document.querySelectorAll("[data-mobile-workflow]").forEach((button) => button.addEventListener("click", () => { if (this.mapNotesModeActive) this.#closeUtilityTab("notes"); if (button.dataset.mobileWorkflow === "tasks") { this.notesHubTab = "tasks"; this.#showNotesHub(); } }));
    document.querySelector("#sidebar-close").addEventListener("click", () => this.#setSidebarCollapsed(true));
    document.querySelector("#sidebar-open").addEventListener("click", () => this.#setSidebarCollapsed(false));
    const toggleMobileMenu = (event) => {
      event.stopPropagation();
      const drawer = document.querySelector("#mobile-menu-drawer");
      const opening = drawer.hidden;
      drawer.hidden = !opening;
      document.querySelector("#mobile-menu-toggle").setAttribute("aria-expanded", String(opening));
      document.querySelector("#mobile-menu-toggle").classList.toggle("is-active", opening);
      document.body.classList.toggle("mobile-menu-open", opening);
      if (opening) {
        this.#dismissWelcome();
        this.mobilePanelManager?.close();
        this.events.publish("mobile:panel-active", { panelId: null });
      }
      if (opening && this.mobileMedia.matches) this.#setSidebarCollapsed(true);
      if (!opening) this.#closeMenus();
      this.events.publish("mobile:menu-toggled", { open: opening });
    };
    document.querySelector("#mobile-menu-toggle").addEventListener("click", toggleMobileMenu);
    document.querySelector("#mobile-menu-close")?.addEventListener("click", toggleMobileMenu);
    document.querySelector("#map-navigation-toggle")?.addEventListener("click", () => {
      if (this.mobileMedia.matches) {
        const open = !document.body.classList.contains("mobile-map-tools-open");
        document.body.classList.toggle("mobile-map-tools-open", open);
        this.#syncMapToolsToggle(open);
      } else {
        const open = document.body.classList.contains("map-tools-collapsed");
        document.body.classList.toggle("map-tools-collapsed", !open);
        this.#syncMapToolsToggle(open);
      }
    });
    this.#syncMapToolsToggle(!this.mobileMedia.matches);
    const setMapToolsCollapsed = (collapsed) => {
      document.body.classList.toggle("map-tools-collapsed", collapsed);
      this.#syncMapToolsToggle(!collapsed);
    };
    document.querySelector("#globe-navigation-close")?.addEventListener("click", () => setMapToolsCollapsed(true));
    document.querySelectorAll("[data-mobile-panel]").forEach((button) =>
      button.addEventListener("click", () => this.#activateMobilePanel(button.dataset.mobilePanel)),
    );
    document.querySelector("#utility-close").addEventListener("click", () => this.#closeActiveUtilityTab());
    this.#activateMobilePanel(null, false);
    document.querySelector("#insights-close").addEventListener("click", () => {
      this.#clearInsightIsolation();
      this.mapController.clearFeatureHighlight();
      this.#setInsightsOpen(false);
    });
    document.querySelector("#insights-ai").addEventListener("click", () => {
      if (!this.lastInsight?.selectedResults?.length) {
        this.error("Select at least one Map Insight feature before asking for AI Insights.");
        return;
      }
      if (!this.aiController.isConfigured()) {
        this.error("Configure an AI provider from Tools before requesting AI Insights.");
        return;
      }
      this.#openIntelligenceUtility();
      this.#askAI(
        "Analyze the selected map features and their location. Explain the most important attributes, relationships, patterns, and useful geographic context.",
        this.lastInsight,
        "Selected data query",
      );
    });
    document.querySelectorAll(".sidebar__scroll > .panel > summary").forEach((summary) =>
      summary.addEventListener("click", () => {
        if (document.body.dataset.navigationLayout !== "top") return;
        document.querySelectorAll(".sidebar__scroll > .panel[open]").forEach((panel) => {
          if (panel !== summary.parentElement) panel.open = false;
        });
      }),
    );
    const placeInput = document.querySelector("#place-query");
    document.querySelector("#place-search").addEventListener("submit", (event) => this.#search(event));
    placeInput.addEventListener("input", () => {
      this.lastPlaceLabel = "";
      this.#schedulePlaceSearch(placeInput.value);
    });
    document.querySelector("#recent-places-list").addEventListener("click", (event) => {
      const button = event.target.closest("[data-recent-place]");
      if (button) void this.#goToRecentPlace(Number(button.dataset.recentPlace));
    });
    document.querySelector("#recent-places-clear").addEventListener("click", () => {
      this.#writeRecentPlaces([]);
      this.#renderRecentPlaces();
    });
    this.#renderRecentPlaces();
    placeInput.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        this.#moveSearchSelection(event.key === "ArrowDown" ? 1 : -1);
      } else if (event.key === "Escape") {
        this.#clearSearchResults();
      }
    });
    document.addEventListener("click", (event) => {
      if (!event.target.closest(".place-search-combobox")) this.#clearSearchResults();
    });
    document.querySelector("#bookmark-add").addEventListener("click", () => this.#addBookmark());
    document.querySelector("#bookmark-manage")?.addEventListener("click", () => this.#bookmarkManagerDialog());
    this.dialog.addEventListener("close", () => {
      if (this.suppressNextDialogClose) {
        this.suppressNextDialogClose = false;
        return;
      }
      const wasDocked = this.utilityDialogOpen;
      this.exportController.cancel();
      this.#restoreUtilityModal();
      this.#undockDialogShell();
      this.utilityDialogLayerTool = null;
      if (wasDocked) this.#syncUtilityPanel();
    });
    document.querySelector("#dialog-dock").addEventListener("click", () => {
      if (this.mobileMedia.matches) return;
      this.#dockDialogInUtilityPanel();
    });
    document.querySelector("#utility-open-modal").innerHTML = dockIcon("popout");
    document.querySelector("#dialog-dock").innerHTML = dockIcon("dock");
    document.querySelector("#utility-open-modal").addEventListener("click", () => { if (!this.mobileMedia.matches) this.#openUtilityAsModal(); });
    document.addEventListener("click", (event) => {
      if (this.mobileMedia.matches && this.dialog.open && event.target.closest?.("[data-mobile-panel], [data-mobile-workflow], #mobile-menu-toggle")) this.dialog.close();
    }, true);
    document.querySelector("#project-file-input").addEventListener("change", (event) => this.#importProject(event));
    document.querySelector("#image-file-input")?.addEventListener("change", (event) => this.#importProject(event));
    const projectDropTarget = document.querySelector(".map-workspace");
    projectDropTarget.addEventListener("dragover", (event) => {
      if (![...event.dataTransfer?.items || []].some((item) => item.kind === "file")) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      projectDropTarget.classList.add("is-project-drop-target");
    });
    projectDropTarget.addEventListener("dragleave", (event) => {
      if (!projectDropTarget.contains(event.relatedTarget)) projectDropTarget.classList.remove("is-project-drop-target");
    });
    projectDropTarget.addEventListener("drop", (event) => {
      event.preventDefault();
      projectDropTarget.classList.remove("is-project-drop-target");
      void this.#importDroppedFiles([...event.dataTransfer?.files || []]);
    });
    document.querySelector("#data-file-input").addEventListener("change", (event) => this.#addFiles(event));
    document.querySelector("#tool-file-input").addEventListener("change", (event) => this.#loadTool(event));
    document.querySelector("#atlas-chapter-previous")?.addEventListener("click", () => this.#stepAtlasChapter(-1));
    document.querySelector("#atlas-chapter-next")?.addEventListener("click", () => this.#stepAtlasChapter(1));
    document.querySelector("#atlas-chapter-play")?.addEventListener("click", () => this.#toggleAtlasPlayback());
    document.querySelector("#atlas-tour-exit")?.addEventListener("click", () => this.#exitAtlasTour());
    document.querySelector("[data-mobile-atlas-previous]")?.addEventListener("click", () => void this.#stepAtlasChapter(-1));
    document.querySelector("[data-mobile-atlas-next]")?.addEventListener("click", () => void this.#stepAtlasChapter(1));
    document.querySelector("[data-mobile-atlas-play]")?.addEventListener("click", () => this.#toggleAtlasPlayback());
    document.querySelector("[data-mobile-atlas-control]")?.addEventListener("click", () => this.#mobileAtlasControlDialog());
    document.querySelector("[data-mobile-atlas-settings]")?.addEventListener("click", () => this.#openMobileAtlasSettings());
    document.querySelector("[data-mobile-briefing-context]")?.addEventListener("click", () => {
      // On phones the context is a folding section of the Briefing sheet: open it and bring it into view.
      const fold = document.querySelector("#presentation-dashboard .briefing-fold--context");
      if (this.mobileMedia.matches && fold) {
        fold.open = true;
        this.briefingFolds.context = true;
        fold.scrollIntoView({ block: "start", behavior: "smooth" });
        return;
      }
      const open = !document.body.classList.contains("mobile-briefing-context-open");
      document.body.classList.toggle("mobile-briefing-context-open", open);
      document.querySelector("[data-mobile-briefing-context]")?.setAttribute("aria-expanded", String(open));
    });
    document.querySelector("#application-edit-return")?.addEventListener("click", () => {
      const application = this.applicationRuntime.setMode("edit");
      this.projectManager.setApplication(application);
    });
    document.querySelector("#globe-dashboard-settings")?.addEventListener("click", () => this.#dashboardBuilderComingSoon());
  }

  /** Labels for a layer: from a field, a text/HTML template with {FIELD} wildcards, or fixed text. */
  #openLabelEditor(uid) {
    const layer = this.mapController.getLayer(uid);
    if (!layer) return;
    const fields = labelableFields(layer);
    const nameField = fields.find((field) => /^(name|title|label)$/i.test(field.name)) || fields.find((field) => /string/i.test(String(field.type || ""))) || fields[0];
    const spec = this.mapController.getLayerLabeling(uid) || normalizeLabeling({ enabled: true, field: nameField?.name || "" });
    this.openDialog({ eyebrow: layer.title || "Layer", title: "Labels", content: labelEditorMarkup(layer, spec) });
    const root = this.dialog.querySelector(".label-editor");
    let timer = 0;
    const apply = () => {
      syncLabelEditor(root);
      clearTimeout(timer);
      timer = setTimeout(() => this.mapController.setLayerLabeling(uid, readLabelEditor(root)), 150);
    };
    syncLabelEditor(root);
    this.mapController.setLayerLabeling(uid, readLabelEditor(root));
    root.addEventListener("input", apply);
    root.addEventListener("change", apply);
    root.querySelector("[data-label-mode]").addEventListener("change", (event) => {
      const template = root.querySelector("[data-label-template]");
      const field = root.querySelector("[data-label-field]").value || nameField?.name;
      if (!template.value.trim() && event.target.value === "template" && field) template.value = `<b>{${field}}</b>`;
      apply();
    });
    root.querySelector("[data-label-chips]").addEventListener("click", (event) => {
      const name = event.target.closest("[data-insert-field]")?.dataset.insertField;
      if (!name) return;
      const template = root.querySelector("[data-label-template]");
      const start = template.selectionStart ?? template.value.length;
      const end = template.selectionEnd ?? start;
      template.value = `${template.value.slice(0, start)}{${name}}${template.value.slice(end)}`;
      template.focus();
      template.selectionStart = template.selectionEnd = start + name.length + 2;
      apply();
    });
    root.querySelector("[data-label-remove]").addEventListener("click", () => {
      clearTimeout(timer);
      this.mapController.setLayerLabeling(uid, null);
      this.dialog.close();
    });
    root.querySelector("[data-label-done]").addEventListener("click", () => this.dialog.close());
  }

  async #placeTextBox() {
    this.toast("Click the map to place the text box. Press Escape to cancel.");
    const coordinates = await this.mapController.pickMapCoordinate();
    if (!coordinates) return;
    const box = this.mapController.addTextBox({ coordinates, runs: [defaultRun({ text: "New label" })] });
    this.#openTextBoxEditor(box.id);
  }

  #renderTextBoxList() {
    const list = document.querySelector("#text-box-list");
    if (!list) return;
    const boxes = this.mapController.getTextBoxes?.() || [];
    list.hidden = !boxes.length;
    list.innerHTML = boxes.map((box) => `<div class="text-box-list__item"><span>${escapeHtml(textBoxSummary(box))}</span><button type="button" data-text-box-edit="${escapeHtml(box.id)}">Edit</button><button type="button" class="button--quiet" data-text-box-remove="${escapeHtml(box.id)}" aria-label="Delete text box">✕</button></div>`).join("");
  }

  #openTextBoxEditor(id, { returnToPrint = false } = {}) {
    const box = this.mapController.getTextBoxes().find((item) => item.id === id);
    if (!box) return;
    // Opened over the Print Editor, the text box editor hands the window back when it closes.
    const backToPrint = returnToPrint || Boolean(this.dialog.open && this.dialog.querySelector(".map-templates"));
    const printDocked = this.dialog.classList.contains("app-dialog--docked");
    this.mapController.selectTextBox(id);
    this.openDialog({ eyebrow: "Draw", title: "Text box", content: textBoxEditorMarkup(box) });
    const root = this.dialog;
    const session = this.dialogSession;
    let currentZoom = null;
    try { currentZoom = this.mapController.getCamera()?.zoom; } catch { /* Not ready. */ }
    root.querySelector("[data-text-zoom-note]").textContent = `${Number.isFinite(currentZoom) ? `The map is at zoom ${currentZoom.toFixed(1)}. ` : ""}Leave min and max blank to show the label at every zoom.`;
    const apply = () => {
      const next = readTextBoxEditor(root, id);
      this.mapController.updateTextBox(id, next);
      root.querySelector("[data-frame-fill-output]").value = `${Math.round(next.frame.fillOpacity * 100)}%`;
    };
    const runs = root.querySelector("[data-text-runs]");
    const renumber = () => runs.querySelectorAll("[data-text-run]").forEach((run, index) => {
      run.dataset.textRun = index;
      run.querySelector("legend").textContent = `Text run ${index + 1}`;
      run.querySelector("[data-remove-run]").dataset.removeRun = index;
    });
    root.querySelector(".text-box-editor").addEventListener("input", apply);
    root.querySelector(".text-box-editor").addEventListener("change", apply);
    root.querySelector("[data-add-run]").addEventListener("click", () => {
      const last = readTextBoxEditor(root, id).runs.at(-1);
      runs.insertAdjacentHTML("beforeend", textBoxRunMarkup({ ...(last || defaultRun()), text: " more text" }, runs.children.length));
      apply();
    });
    runs.addEventListener("click", (event) => {
      const button = event.target.closest("[data-remove-run]");
      if (!button || runs.children.length <= 1) return;
      button.closest("[data-text-run]").remove();
      renumber();
      apply();
    });
    let picking = false;
    root.querySelector("[data-text-pick]").addEventListener("click", async () => {
      picking = true;
      this.dialog.close();
      this.toast("Click the map to move the text box. Press Escape to cancel.");
      const coordinates = await this.mapController.pickMapCoordinate();
      if (coordinates) this.mapController.updateTextBox(id, { coordinates });
      this.#openTextBoxEditor(id, { returnToPrint: backToPrint });
    });
    root.querySelector("[data-text-delete]").addEventListener("click", () => {
      this.mapController.removeTextBox(id);
      this.dialog.close();
    });
    root.querySelector("[data-text-done]").addEventListener("click", () => this.dialog.close());
    this.dialog.addEventListener("close", () => {
      if (this.dialogSession !== session) return;
      this.mapController.selectTextBox(null);
      // Docking closes and reopens the dialog; only a real close returns to the Print Editor.
      setTimeout(() => {
        if (!backToPrint || picking || this.dialogSession !== session || this.dialog.open) return;
        this.#openMapTemplates(this.printState?.output || "pdf").catch((error) => this.error(error.message));
        if (printDocked) document.querySelector("#dialog-dock")?.click();
      }, 0);
    }, { once: true });
  }

  #openDrawingStyle() {
    const style = this.mapController.getDrawingsStyle?.() || {};
    const effect = style.animatedEffect || {};
    const suggested = "glow";
    this.openDialog({
      eyebrow: "Drawings",
      title: "Advanced drawing style",
      content: `<div class="workspace-tool"><p class="form-note">Applies to every point, line, polygon, and rectangle in this drawing layer.</p><div class="field-grid"><label class="field"><span>Drawing colour</span><input type="color" data-drawing-color value="${escapeHtml(style.color || "#d9951e")}"></label><label class="field"><span>Outline colour</span><input type="color" data-drawing-outline value="${escapeHtml(style.outline || "#ffffff")}"></label><label class="field"><span>Line width</span><input type="number" min="0.5" max="20" step="0.5" data-drawing-width value="${Number(style.width || 3)}"></label><label class="field"><span>Point size</span><input type="number" min="1" max="40" step="1" data-drawing-radius value="${Number(style.pointRadius || 6)}"></label><label class="opacity-row"><span>Polygon fill</span><input type="range" min="0" max="1" step="0.05" data-drawing-fill value="${Number(style.fillOpacity ?? 0.18)}"><output data-drawing-fill-output>${Math.round(Number(style.fillOpacity ?? 0.18) * 100)}%</output></label></div><fieldset class="feedback-settings layer-effect"><legend>Cinematic effect</legend><div class="field-grid"><label class="field"><span>Effect</span><select data-drawing-effect>${this.#cinematicEffectOptions(effect.type || "none", suggested)}</select></label><label class="field"><span>Style</span><select data-drawing-effect-style><option value="soft"${effect.style === "soft" ? " selected" : ""}>Soft glow</option><option value="balanced"${!effect.style || effect.style === "balanced" ? " selected" : ""}>Balanced</option><option value="crisp"${effect.style === "crisp" ? " selected" : ""}>Crisp</option><option value="vivid"${effect.style === "vivid" ? " selected" : ""}>Vivid</option></select></label><label class="field"><span>Effect colour</span><input type="color" data-drawing-effect-color value="${escapeHtml(effect.color || "#ff8136")}"></label><label class="opacity-row"><span>Effect opacity</span><input type="range" min="0.05" max="1" step="0.05" data-drawing-effect-opacity value="${Number(effect.opacity ?? 1)}"><output data-drawing-effect-opacity-output>${Math.round(Number(effect.opacity ?? 1) * 100)}%</output></label><label class="opacity-row"><span>Intensity</span><input type="range" min="0.25" max="2" step="0.25" data-drawing-effect-intensity value="${Number(effect.intensity ?? 1)}"><output data-drawing-effect-intensity-output>${Number(effect.intensity ?? 1).toFixed(2).replace(/\.00$/, "")}×</output></label><label class="opacity-row"><span>Motion speed</span><input type="range" min="0.1" max="3" step="0.1" data-drawing-effect-speed value="${Number(effect.speed ?? 1)}"><output data-drawing-effect-speed-output>${Number(effect.speed ?? 1).toFixed(1)}×</output></label><label class="opacity-row"><span>Density</span><input type="range" min="0.25" max="2.5" step="0.05" data-drawing-effect-density value="${Number(effect.density ?? 1)}"><output data-drawing-effect-density-output>${Number(effect.density ?? 1).toFixed(2).replace(/0$/, "")}×</output></label></div><p class="form-note">Effects decorate your drawings. They do not represent observed fire, traffic, weather, or movement.</p></fieldset><div class="workspace-tool__actions"><button type="button" class="button--primary" data-apply-drawing-style>Apply drawing style</button></div></div>`,
    });
    const root = this.dialog;
    const output = (input, target, format) => root.querySelector(input)?.addEventListener("input", (event) => { root.querySelector(target).value = format(Number(event.currentTarget.value)); });
    output("[data-drawing-fill]", "[data-drawing-fill-output]", (value) => `${Math.round(value * 100)}%`);
    output("[data-drawing-effect-opacity]", "[data-drawing-effect-opacity-output]", (value) => `${Math.round(value * 100)}%`);
    output("[data-drawing-effect-intensity]", "[data-drawing-effect-intensity-output]", (value) => `${value.toFixed(2).replace(/\.00$/, "")}×`);
    output("[data-drawing-effect-speed]", "[data-drawing-effect-speed-output]", (value) => `${value.toFixed(1)}×`);
    output("[data-drawing-effect-density]", "[data-drawing-effect-density-output]", (value) => `${value.toFixed(2).replace(/0$/, "")}×`);
    root.querySelector("[data-apply-drawing-style]")?.addEventListener("click", async () => {
      const get = (selector) => root.querySelector(selector).value;
      await this.mapController.setDrawingsStyle({ color: get("[data-drawing-color]"), outline: get("[data-drawing-outline]"), width: Number(get("[data-drawing-width]")), pointRadius: Number(get("[data-drawing-radius]")), fillOpacity: Number(get("[data-drawing-fill]")), animatedEffect: { type: get("[data-drawing-effect]"), style: get("[data-drawing-effect-style]"), color: get("[data-drawing-effect-color]"), opacity: Number(get("[data-drawing-effect-opacity]")), intensity: Number(get("[data-drawing-effect-intensity]")), speed: Number(get("[data-drawing-effect-speed]")), density: Number(get("[data-drawing-effect-density]")) } });
      this.toast("Drawing style applied.");
    });
  }

  #syncMapToolsToggle(open) {
    const toggle = document.querySelector("#map-navigation-toggle");
    if (!toggle) return;
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", `${open ? "Hide" : "Show"} map tools`);
    toggle.title = `${open ? "Hide" : "Show"} map tools`;
    toggle.textContent = open ? "⌄" : "⌃";
  }

  #bindMapEvents() {
    const mapWorkspace = document.querySelector(".map-workspace");
    mapWorkspace.addEventListener("pointerdown", (event) => {
      // The welcome panel floats over the map; the first touch/click on the
      // actual map should get it out of the way before map navigation begins.
      if (event.target?.closest?.("#viewDiv") && !event.target?.closest?.("button, a, input, select")) this.#dismissWelcome();
    }, { passive: true });
    ["gesturestart", "gesturechange", "gestureend"].forEach((type) => {
      mapWorkspace.addEventListener(type, (event) => event.preventDefault(), { passive: false });
    });
    this.events.subscribe("map:ready", ({ zoom }) => {
      document.querySelector("#map-status").textContent = `Ready · zoom ${zoom.toFixed(1)}`;
    });
    this.events.subscribe("map:click", (click) => {
      const { mapPoint } = click;
      this.#dismissWelcome();
      const point = Number.isFinite(mapPoint?.longitude) && Number.isFinite(mapPoint?.latitude) ? [((mapPoint.longitude + 180) % 360 + 360) % 360 - 180, mapPoint.latitude] : null;
      if (this.dataMapNotesOpen && this.activeUtilityTab === "data-notes" && !this.dataMapNotePaused && point) {
        const setTarget = this.setDataMapNoteTarget;
        if (!setTarget) return;
        const revision = this.dataMapNotePickRevision = (this.dataMapNotePickRevision || 0) + 1;
        this.dataMapNotePoint = point;
        setTarget({ type: "location", coordinates: point });
        this.refreshDataMapNoteMarkers();
        const stillCurrent = () => this.dataMapNotesOpen && this.activeUtilityTab === "data-notes" && revision === this.dataMapNotePickRevision && setTarget === this.setDataMapNoteTarget;
        Promise.resolve().then(() => this.mapController.identify(click)).then(results => {
          if (!stillCurrent()) return;
          const seen = new Set();
          const features = (results || []).filter(item => item.kind === "feature").map(result => {
            const layer = this.mapController.getLayer(result.layerUid);
            const ref = noteFeatureReference(result, layer, layer && this.mapController.getLayerConfig(layer));
            if (!ref) return null;
            const key = `${ref.datasetId}\0${ref.featureId || ''}`;
            if (seen.has(key)) return null;
            seen.add(key);
            return { datasetId: ref.datasetId, ...(ref.featureId ? { featureId: ref.featureId } : {}), ...(ref.datasetTitle ? { datasetTitle: ref.datasetTitle } : {}), ...(ref.sourceUrl ? { sourceUrl: ref.sourceUrl } : {}) };
          }).filter(Boolean).slice(0, 50);
          if (features.length) this.setDataMapNoteContext?.({ features });
        }).catch(() => { /* The location remains usable if identify fails. */ });
        Promise.resolve().then(() => this.mapController.reverseGeocode({ longitude: point[0], latitude: point[1] })).then(result => {
          if (!stillCurrent() || !result) return;
          const address = typeof result.address === 'string' ? result.address.trim().slice(0, 512) : '';
          const fields = ['PlaceName', 'City', 'Region', 'State', 'County', 'CensusTract', 'CensusTractGEOID', 'CensusBlockGEOID', 'Postal', 'Country', 'CountryCode'];
          const geographies = fields.flatMap(label => { const value = result.attributes?.[label]; return typeof value === 'string' && value.trim() ? [{ label, value: value.trim().slice(0, 256) }] : []; });
          if (address || geographies.length) this.setDataMapNoteContext?.({ ...(address ? { address } : {}), ...(geographies.length ? { geographies } : {}) });
        }).catch(() => { /* The location remains usable if geocoding fails. */ });
        return;
      }
      if (!this.mapNotesModeActive || !this.fieldNotesEditing || this.activeUtilityTab !== "notes" || !point) { this.mapNotePoint = point; return; }
      const pane = document.querySelector("#utility-notes-content");
      if ([...pane.querySelectorAll('[data-note-form] [name="title"], [data-note-form] [name="body"]')].some((input) => input.value.trim())) {
        this.toast("Save or clear the current observation before choosing another location."); return;
      }
      this.mapNotePoint = point;
      const selection = this.mapNotesSelectionId = (this.mapNotesSelectionId || 0) + 1;
      openMapNotesPanel(this, { point: this.mapNotePoint });
      const attach = this.mapNotesAttachFeature;
      const save = pane.querySelector('[data-note-save]');
      const status = pane.querySelector('[data-linked-feature]');
      if (save) save.disabled = true;
      if (status) status.textContent = 'Checking for a feature at this location…';
      const identify = Promise.resolve().then(() => this.mapController.identify(click));
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Feature inspection timed out.')), 10000));
      Promise.race([identify, timeout]).then((results) => {
        if (!this.mapNotesModeActive || selection !== this.mapNotesSelectionId || attach !== this.mapNotesAttachFeature) return;
        const result = results?.find((item) => item.kind === "feature");
        const layer = result && this.mapController.getLayer(result.layerUid);
        const config = layer && this.mapController.getLayerConfig(layer);
        attach?.(noteFeatureReference(result, layer, config));
        if (save) save.disabled = false;
      }).catch(() => {
        if (!this.mapNotesModeActive || selection !== this.mapNotesSelectionId || attach !== this.mapNotesAttachFeature) return;
        if (status) status.textContent = 'Feature inspection unavailable; this will be a location-only note.';
        if (save) save.disabled = false;
      });
    });
    this.events.subscribe("view:scale-change", () => {
      this.#updateLayerScaleIndicators();
      // Cinematic effects carry zoom-dependent detail.
      if (this.presentationState.template === "cinematic" && this.cinematicState) {
        clearTimeout(this.cinematicDetailTimer);
        this.cinematicDetailTimer = setTimeout(() => this.cinematicController.refreshEffectDetail(), 250);
      }
    });
    this.events.subscribe("view:stationary", () => {
      if (this.presentationState.template === "cinematic" && this.cinematicController.state()?.localWindow) {
        clearTimeout(this.cinematicLocalWindowTimer);
        this.cinematicLocalWindowTimer = setTimeout(() => {
          if (this.presentationState.template !== "cinematic" || !this.cinematicController.state()?.localWindow) return;
          this.cinematicController.refreshLocalWindow();
          this.cinematicState = this.cinematicController.state();
          this.#renderPresentationDashboard(this.projectManager.current.presentation);
        }, 180);
      }
      if (["explorer", "briefing"].includes(this.presentationState.template) && this.presentationState.scope === "extent") {
        clearTimeout(this.presentationExtentTimer);
        // A briefing also fetches features in view that were not among the first records loaded.
        this.presentationExtentTimer = setTimeout(async () => {
          if (this.presentationState.template === "briefing") await this.#loadExtentRecords();
          this.#filterPresentationRecords();
        }, 250);
      }
    });
    this.events.subscribe("view:pointer-move", ({ longitude, latitude, zoom }) => {
      document.querySelector("#map-status").textContent =
        `${longitude.toFixed(5)}, ${latitude.toFixed(5)} · zoom ${zoom.toFixed(1)}`;
    });
    ["layer:added", "layer:removed", "layer:changed", "layers:reset"].forEach((topic) =>
      this.events.subscribe(topic, () => this.#renderLayers()),
    );
    // Cinematic owns separate, transient effect IDs. A layer delete must tell
    // it to release those IDs before a Three.js overlay can outlive its source.
    this.events.subscribe("layer:removed", ({ uid } = {}) => {
      if (!uid) return;
      void this.cinematicController.removeDeletedLayer(uid).then((removed) => {
        if (!removed) return;
        const cinematic = this.cinematicController.exportCinematicSpec()?.cinematic;
        if (cinematic) this.projectManager.patchPresentation({ cinematic });
        else if (this.projectManager.current.presentation?.template === "cinematic") {
          this.projectManager.setPresentation({ ...this.projectManager.current.presentation, template: "standard", primaryLayerId: null, cinematic: null });
          this.toast("The final cinematic layer was removed, so Cinematic mode has closed.");
        }
      }).catch((error) => this.error(`Could not clear the cinematic layer: ${error.message}`));
    });
    // Removing the layer a briefing (or other mode) was built on drops its feature context, dock and
    // Slide workspace; the mode then shows "Start with a dataset". The slides stay with the project.
    this.events.subscribe("layer:removed", ({ uid } = {}) => {
      const own = Boolean(uid) && (uid === this.presentationState?.layerUid || uid === this.briefingWorkspace?.layer?.uid);
      if (!own && uid && this.mapController.getLayers().length) return;
      this.#clearBriefingFeatureContext();
      if (!own) return;
      if (this.presentationState?.layerUid === uid) this.presentationState.layerUid = null;
      this.briefingWorkspace = null;
      this.#teardownBriefingV2();
      this.#renderPresentationDashboard(this.projectManager.current.presentation || {});
    });
    ["notes:changed", "map-notes:changed", "note-relationships:changed"].forEach(topic =>
      this.events.subscribe(topic, () => refreshNoteRelationships(this)),
    );
    ["map-notes:changed", "note-relationships:changed", "mobile:workflow-changed"].forEach(topic =>
      this.events.subscribe(topic, () => { refreshMapNoteWorkflow(this); refreshMapNoteFilters(this); }),
    );
    ["project:saved", "project:loaded"].forEach((topic) => this.events.subscribe(topic, () => this.#syncBriefingSave()));
    // Projects reopen on their own engine through the same in-place switch as the Map menu.
    this.projectManager.engineSwitcher = (engine) => this.#switchEngineSilently(engine, { updateUrl: true });
    this.events.subscribe("project:loaded", ({ project, missingFiles }) => {
      this.mapNotePoint = null;
      if (typeof project.buildings3d === "boolean") {
        try { localStorage.setItem(BUILDINGS_3D_KEY, project.buildings3d ? "on" : "off"); } catch { /* Not kept. */ }
        document.querySelectorAll("[data-buildings-toggle]").forEach((input) => { input.checked = project.buildings3d; });
        if (this.mapController.getCapabilities().includes("buildings-3d")) this.mapController.setBuildings3d(project.buildings3d);
      }
      if (this.mapNotesModeActive) { this.mapNotesSessionDraft = null; this.fieldSessionController.session = null; openMapNotesPanel(this); }
      if (this.dataMapNotesOpen) openDataMapNotesPanel(this);
      if (project.application?.configured) {
        this.#applyPresentation({ template: "standard" });
        this.applicationRuntime.apply(project.application);
      } else {
        this.applicationRuntime.deactivate();
        this.#applyPresentation(project.presentation);
      }
      this.#showProject(project);
      this.#renderBookmarks();
      this.#renderLayers();
      if (missingFiles?.length) {
        this.error(`Reattach local file${missingFiles.length === 1 ? "" : "s"}: ${missingFiles.join(", ")}`);
      }
    });
    this.events.subscribe("project:saved", ({ project, automatic }) => {
      this.#showProject(project, "Saved");
      if (!automatic) this.toast("Project saved in this browser.");
    });
    this.events.subscribe("presentation:changed", ({ presentation }) => {
      if (!this.projectManager.current.application) this.#applyPresentation(presentation);
    });
    this.events.subscribe("application:changed", ({ application }) => {
      if (!application?.configured) return this.applicationRuntime.deactivate();
      this.#applyPresentation({ template: "standard" });
      this.applicationRuntime.apply(application);
    });
    this.events.subscribe("tour-marker:click", ({ index }) => {
      if (this.presentationState.template !== "atlas" || !Number.isInteger(index)) return;
      const chapters = this.projectManager.current.presentation?.chapters || [];
      if (chapters[index]) void this.#goToAtlasChapter(chapters[index], index, chapters);
    });
    this.events.subscribe("identify:complete", (payload) => {
      const result = payload.results?.find((item) => item.layerUid === this.presentationState.layerUid);
      // A slide asked for its focus feature: one click answers it.
      if (this.briefingFocusPick) {
        if (!result) { this.toast(`Click a feature in ${this.mapController.getLayer(this.presentationState.layerUid)?.title || "the briefing layer"}.`); return; }
        const done = this.briefingFocusPick; this.briefingFocusPick = null;
        this.briefingFocusPicked = true; setTimeout(() => { this.briefingFocusPicked = false; }, 0);
        document.body.classList.remove("briefing-map-select");
        const layer = this.mapController.getLayer(this.presentationState.layerUid);
        const id = featureId(result, layer?.objectIdField);
        if (id && !this.presentationState.records.some((record) => featureId(record, layer.objectIdField) === id)) this.presentationState.records.push({ ...result, kind: "feature" });
        done(id);
        return;
      }
      if (this.presentationState.template === "briefing" && this.presentationState.mapSelect) return this.#toggleBriefingInclude(result);
      this.#selectPresentationResult(result);
    });
    this.events.subscribe("project:smart-image-unverified", () => this.toast("This image wasn't rendered by GISMap Online; the map may look different when opened."));
    this.events.subscribe("project:exported", ({ kind }) => this.toast(`${kind === "smart-image" ? "Smart map image (.png)" : kind === "package" ? "Project package (.gisx)" : kind === "atlas" ? "Guided tour (.gisatlas)" : "Project file (.gis)"} downloaded.`));
    this.events.subscribe("export:progress", ({ stage, completed, total }) => {
      const progress = this.dialog.querySelector("[data-export-progress]");
      const status = this.dialog.querySelector("[data-export-status]");
      if (!progress || !status) return;
      if (total > 0) {
        progress.max = total;
        progress.value = Math.min(completed, total);
      } else {
        progress.removeAttribute("value");
      }
      status.textContent = stage === "packaging"
        ? `Packaging ${completed.toLocaleString()} features…`
        : `Retrieving ${completed.toLocaleString()}${total > 0 ? ` of ${total.toLocaleString()}` : ""} features…`;
    });
    this.events.subscribe("export:cancelled", () => this.toast("Data export cancelled."));
    this.events.subscribe("bookmarks:changed", () => this.#renderBookmarks());
    // Data added from an empty Briefing becomes its dataset straight away.
    // The Lab's layer list follows the map's layers.
    for (const name of ["layer:added", "layer:removed"]) this.events.subscribe(name, () => { if (this.cartographyLabOpen) this.cartographyLab?.render(document.querySelector("#utility-lab-content")); });
    this.events.subscribe("layer:added", ({ layer }) => {
      const current = this.projectManager.current.presentation || {};
      if (current.template !== "briefing" || current.primaryLayerId || !layer?.queryable) return;
      this.#applyPresentation(this.projectManager.setPresentation({ ...current, primaryLayerId: layer.uid, title: current.title || `${layer.title || "Feature"} briefing` }));
    });
    this.events.subscribe("identify:start", () => {
      this.intelligenceInsight = null;
      this.#clearInsightIsolation();
      this.mapController.clearFeatureHighlight();
      document.querySelector("#insights-overlay").setAttribute("aria-busy", "true");
      this.identifyPending = true;
      this.#renderIntelligenceContents();
    });
    this.events.subscribe("identify:complete", (payload) => {
      // Intelligence is independent of the feature-details overlay, including
      // when a notes workflow deliberately keeps that overlay out of the way.
      this.intelligenceInsight = payload.intelligenceCurrent === false ? null : payload;
      this.identifyPending = false;
      document.querySelector("#insights-overlay").setAttribute("aria-busy", "false");
      if ((this.dataMapNotesOpen && this.activeUtilityTab === "data-notes" && !this.dataMapNotePaused)
        || (this.mapNotesModeActive && this.fieldNotesEditing && this.activeUtilityTab === "notes")) {
        this.#renderIntelligenceContents();
        this.#setInsightsOpen(false);
        return;
      }
      // Picking features (for a briefing or a field task) should not cover the map with details;
      // otherwise Briefing keeps Map Insight like any other mode.
      if ((this.presentationState.template === "briefing" && this.presentationState.mapSelect) || this.briefingFocusPicked || document.body.classList.contains("field-task-picking")) {
        this.#renderIntelligenceContents();
        this.#setInsightsOpen(false);
        return;
      }
      // While slides are presented the panels are hidden: the player shows a compact insight.
      const player = this.briefingSlides?.player;
      if (player?.isOpen) {
        this.#renderIntelligenceContents();
        if (payload.insightCurrent !== false) player.showInsight(this.#presentationInsight(payload));
        return;
      }
      if (payload.insightCurrent === false) {
        this.#renderIntelligenceContents();
        return;
      }
      this.#renderInsight(payload);
    });
    this.events.subscribe("identify:cleared", () => {
      // Map Insight and its selected features are independent of the Intelligence
      // panel. A pan invalidates only the latter, including any pending AI reply.
      this.intelligenceInsight = null;
      this.identifyPending = false;
      this.aiPending = false;
      this.lastAIResponseText = null;
      this.lastAIQueryText = null;
      this.#renderIntelligenceContents();
    });
    this.events.subscribe("insight:distance-exceeded", () => {
      this.lastInsight = null;
      this.selectedInsightIndexes.clear();
      document.querySelector("#insights-content").replaceChildren();
      this.#clearInsightIsolation();
      this.mapController.clearFeatureHighlight();
      this.#setInsightsOpen(false);
      document.querySelector(".orbital-insight-details")?.remove();
    });
    this.events.subscribe("table:open", () => {
      this.#clearInsightIsolation();
      this.mapController.clearFeatureHighlight();
      this.#setInsightsOpen(false);
    });
    this.events.subscribe("identify:error", ({ error }) => {
      this.identifyPending = false;
      document.querySelector("#insights-overlay").setAttribute("aria-busy", "false");
      this.#renderIntelligenceContents();
      this.error(`Identify failed: ${error.message}`);
    });
    this.events.subscribe("ai:configured", () => this.assistant.render());
    this.events.subscribe("ai:start", () => {
      this.aiPending = true;
      this.lastAIResponseText = null;
      this.#renderIntelligenceContents();
      this.toast("Asking the configured model…");
    });
    this.events.subscribe("ai:complete", ({ text, context }) => {
      if (context !== this.intelligenceInsight) return;
      this.aiPending = false;
      this.#showAIResponse(text);
    });
    this.events.subscribe("ai:error", ({ error, context }) => {
      if (context !== this.intelligenceInsight) return;
      this.aiPending = false;
      this.#renderIntelligenceContents();
      this.error(error.message);
    });
    ["ai:configured", "ai:disabled"].forEach((topic) =>
      this.events.subscribe(topic, () => {
        document.querySelector("#insights-ai").hidden = !this.aiController.isConfigured();
        if (this.lastInsight) this.#renderInsight(this.lastInsight);
      }),
    );
    this.events.subscribe("tool:loaded", ({ tool }) => this.toast(`Custom tool loaded: ${tool.title || tool.id}`));
    this.events.subscribe("auth:status-changed", ({ connection, status }) => {
      if (connection && status?.signedIn) this.toast(`Connected to ${connection.name}${status.userId ? ` as ${status.userId}` : ""}.`);
    });
    this.events.subscribe("app:error", ({ message }) => this.error(message));
    this.events.subscribe("project:credentials-removed", ({ message }) => this.toast(message));
    this.events.subscribe("widget:toggled", ({ name, open }) => {
      document.querySelectorAll(`[data-widget="${name}"]`).forEach((button) => button.classList.toggle("is-active", open));
      if (!["basemapGallery", "elevationProfile", "legend"].includes(name) && !(name === "measurement" && this.mapController.getEngineId() === "maplibre")) return;
      this.#syncUtilityPanel(open ? name : null);
    });
  }

  #utilityWidgetTabs() {
    const labels = {
      basemapGallery: "Basemap gallery",
      elevationProfile: "Elevation profile",
      legend: "Legend",
      ...(this.mapController.getEngineId() === "maplibre" ? { measurement: "Measurement" } : {}),
    };
    return Object.entries(labels)
      .filter(([name]) => this.mapController.widgetOpen(name))
      .map(([id, label]) => ({ id, label }));
  }

  #openUtilityAsModal() {
    if (this.activeUtilityTab === "dialog" && this.utilityDialogOpen) {
      this.#reopenDialog(false);
      return;
    }
    const pane = document.querySelector(`[data-utility-pane="${CSS.escape(this.activeUtilityTab || "")}"]`);
    if (!pane) return;
    this.utilityModalPane = pane;
    const title = document.querySelector("#utility-title").textContent || "Map tools";
    document.querySelector("#dialog-eyebrow").textContent = "Map tools";
    document.querySelector("#dialog-title").textContent = title;
    document.querySelector("#dialog-content").replaceChildren(pane);
    const footer = document.querySelector("#dialog-actions");
    footer.innerHTML = "";
    const restore = document.createElement("button");
    restore.type = "button";
    restore.textContent = "Return to panel";
    restore.className = "button--primary";
    restore.addEventListener("click", () => this.dialog.close());
    footer.append(restore);
    this.dialog.classList.remove("app-dialog--docked");
    if (!this.dialog.open) this.dialog.showModal();
  }

  #reopenDialog(docked) {
    if (!this.dialog.open) return;
    this.suppressNextDialogClose = true;
    this.dialog.close();
    if (docked) {
      // #app is the grid itself. Appending to a non-existent child previously
      // reserved the third column without moving the dialog into it.
      document.querySelector("#app")?.append(this.dialog);
      document.body.classList.add("dialog-panel-open");
      this.dialog.show();
    } else {
      this.#undockDialogShell();
      this.#syncUtilityPanel();
      this.dialog.showModal();
    }
    requestAnimationFrame(() => this.mapController.resize());
  }

  #dockDialogInUtilityPanel() {
    if (!this.dialog.open) return;
    // A dialog opened from an existing utility pane must return that pane to
    // its original tab. Docking the dialog shell as a second tab would give
    // one tool two owners (and produced duplicate Guided Places tabs).
    if (this.utilityModalPane) {
      const returnTab = this.utilityModalPane.dataset.utilityPane;
      this.#restoreUtilityModal();
      this.suppressNextDialogClose = true;
      this.dialog.close();
      this.#syncUtilityPanel(returnTab);
      return;
    }
    // The analysis workspace owns a persistent pane, rather than the shared
    // dialog shell: opening another dialog must not replace an in-progress SQL query.
    const query = this.dialog.querySelector("#dialog-content > .query-workspace");
    if (query) {
      document.querySelector("#utility-query-content").replaceChildren(query);
      this.suppressNextDialogClose = true;
      this.dialog.close();
      this.#undockDialogShell();
      this.utilityQueryOpen = true;
      this.#syncUtilityPanel("query");
      return;
    }
    this.suppressNextDialogClose = true;
    this.dialog.close();
    this.dialog.classList.add("app-dialog--docked");
    document.querySelector("#utility-dialog-content")?.append(this.dialog);
    // A non-modal dialog in a normal panel only needs the open attribute; it
    // must not enter the browser's top layer or retain a modal backdrop.
    this.dialog.setAttribute("open", "");
    this.utilityDialogOpen = true;
    this.#syncUtilityPanel("dialog");
  }

  #undockDialogShell() {
    if (this.dialog.parentElement !== document.body) document.body.append(this.dialog);
    this.dialog.classList.remove("app-dialog--docked");
    this.utilityDialogOpen = false;
    document.body.classList.remove("dialog-panel-open");
    requestAnimationFrame(() => this.mapController.resize());
  }

  #restoreUtilityModal() {
    if (!this.utilityModalPane) return;
    document.querySelector(".utility-panes")?.append(this.utilityModalPane);
    this.utilityModalPane = null;
    this.#syncUtilityPanel(this.activeUtilityTab);
  }

  #syncUtilityPanel(preferredTab = null) {
    const tabs = [
      ...(this.briefingInspectorOpen ? [{ id: "briefing", label: "Slide workspace" }] : []),
      ...(this.utilityWorkspaceOpen || this.chartWorkspaceOpen ? [{ id: "workspace", label: "Workspace" }] : []),
      ...(this.mapNotesModeActive ? [{ id: "notes", label: "Field Notes" }] : []),
      ...(this.dataMapNotesOpen ? [{ id: "data-notes", label: "Map Notes" }] : []),
      ...this.#utilityWidgetTabs(),
      ...(this.utilityTasksOpen ? [{ id: "tasks", label: "Field tasks" }] : []),
      ...(this.utilityDialogOpen ? [{ id: "dialog", label: document.querySelector("#dialog-title")?.textContent || "Dialog" }] : []),
      ...(this.utilityQueryOpen ? [{ id: "query", label: "Query data" }] : []),
      ...[...this.utilityPanelsOpen].map((id) => ({ id, label: DOCKABLE_PANELS[id] })),
      ...(this.utilityDrawOpen ? [{ id: "draw", label: "Draw" }] : []),
      ...(this.cartographyLabOpen ? [{ id: "lab", label: "Style layer" }] : []),
      ...(this.utilityStyleLayerUid ? [{ id: "style", label: `Style: ${this.mapController.getLayer(this.utilityStyleLayerUid)?.title || "Layer"}` }] : []),
      ...(this.utilitySourceLayerUid ? [{ id: "source", label: `Source: ${this.mapController.getLayer(this.utilitySourceLayerUid)?.title || "Layer"}` }] : []),
      ...(this.utilityIntelligenceOpen ? [{ id: "intelligence", label: "Intelligence" }] : []),
      ...(this.utilityAssistantOpen ? [{ id: "assistant", label: "Map assistant" }] : []),
      ...(this.utilityPresentationOpen ? [{ id: "presentation", label: this.projectManager.current.presentation?.template === "briefing" ? "Context briefing" : this.projectManager.current.presentation?.template === "explorer" ? "Dataset explorer" : this.projectManager.current.presentation?.title || "Guided places" }] : []),
    ];
    const validTabs = new Set(tabs.map((tab) => tab.id));
    this.activeUtilityTab = validTabs.has(preferredTab)
      ? preferredTab
      : validTabs.has(this.activeUtilityTab) ? this.activeUtilityTab : tabs[0]?.id || null;
    document.body.classList.toggle("map-notes-authoring", (this.mapNotesModeActive && this.fieldNotesEditing && this.activeUtilityTab === "notes") || (this.dataMapNotesOpen && this.activeUtilityTab === "data-notes" && !this.dataMapNotePaused));
    if (this.activeUtilityTab === "data-notes") this.refreshDataMapNoteMarkers();
    else if (this.activeUtilityTab === "notes") this.refreshMapNoteMarkers(this.mapNotePoint);
    else this.mapController.setMapNoteMarkers([]);
    const open = tabs.length > 0;
    if (open) this.#dismissWelcome();
    if (open && this.mobileMedia.matches) this.#setSidebarCollapsed(true);
    const tabList = document.querySelector("#utility-tabs");
    tabList.hidden = tabs.length < 2;
    tabList.innerHTML = tabs.map((tab) => `<span class="utility-tab"><button type="button" data-utility-tab="${tab.id}" aria-selected="${tab.id === this.activeUtilityTab}">${escapeHtml(tab.label)}</button><button type="button" class="utility-tab__close" data-close-utility-tab="${tab.id}" aria-label="Close ${escapeHtml(tab.label)}" title="Close ${escapeHtml(tab.label)}">×</button></span>`).join("");
    tabList.querySelectorAll("[data-utility-tab]").forEach((button) => button.addEventListener("click", () => this.#syncUtilityPanel(button.dataset.utilityTab)));
    tabList.querySelectorAll("[data-close-utility-tab]").forEach((button) => button.addEventListener("click", () => this.#closeUtilityTab(button.dataset.closeUtilityTab)));
    document.querySelectorAll("[data-utility-pane]").forEach((pane) => { pane.hidden = pane.dataset.utilityPane !== this.activeUtilityTab; });
    document.querySelector("#utility-title").textContent = tabs.find((tab) => tab.id === this.activeUtilityTab)?.label || "Map tools";
    const utilityModalButton = document.querySelector("#utility-open-modal");
    if (utilityModalButton) utilityModalButton.hidden = ["presentation", "tasks", "notes", "data-notes"].includes(this.activeUtilityTab);
    document.body.classList.toggle("utility-panel-open", open);
    document.body.classList.toggle("briefing-workspace-left", open && this.activeUtilityTab === "briefing" && this.#briefingV2Active());
    document.body.classList.toggle("mobile-measurement-panel-open", this.mobileMedia.matches && open && this.activeUtilityTab === "measurement");
    document.body.classList.toggle("mobile-presentation-panel-open", this.mobileMedia.matches && open && this.activeUtilityTab === "presentation");
    document.querySelector("#utility-panel").setAttribute("aria-hidden", String(!open));
    requestAnimationFrame(() => this.mapController.resize());
  }

  /**
   * Desktop: the Tasks screen is a tab of the right panel, so a docked dialog
   * (such as a task's share card) opens as a tab beside it instead of on top.
   */
  dockWorkflowPanel(open) {
    const root = document.querySelector("#mobile-workflow-root");
    const pane = document.querySelector("#utility-tasks-content");
    if (!root || !pane) return;
    if (open && !this.mobileMedia.matches) {
      if (root.parentElement !== pane) {
        this.workflowRootHome ??= { parent: root.parentElement, next: root.nextSibling };
        pane.append(root);
      }
      this.utilityTasksOpen = true;
      this.#syncUtilityPanel("tasks");
      return;
    }
    if (root.parentElement === pane && this.workflowRootHome) this.workflowRootHome.parent.insertBefore(root, this.workflowRootHome.next);
    if (this.utilityTasksOpen) {
      this.utilityTasksOpen = false;
      this.#syncUtilityPanel();
    }
  }

  #welcomeIsSharedLaunch() {
    const params = new URLSearchParams(location.search);
    if (["example", "layer", "url", "briefing", "briefingExample", "workflow", "application"].some((key) => params.has(key))) return true;
    return /(?:^#|&)(?:map|briefing|tour|fieldTask|fieldNote|at)=/.test(location.hash);
  }

  #welcomeIsExplicitlyRequested() {
    return new URLSearchParams(location.search).get("welcome") === "1";
  }

  #readWelcomePreference() {
    try {
      const stored = JSON.parse(localStorage.getItem(WELCOME_PREFERENCE_KEY) || "null");
      return stored?.version === 1 ? stored : { version: 1, dismissed: false };
    } catch { return { version: 1, dismissed: false }; }
  }

  #saveWelcomePreference({ dismissed }) {
    const preference = { version: 1, dismissed: Boolean(dismissed) };
    try { localStorage.setItem(WELCOME_PREFERENCE_KEY, JSON.stringify(preference)); } catch { /* Private browsing keeps the current page behavior. */ }
    const input = document.querySelector("#welcome-suppress");
    if (input) input.checked = preference.dismissed;
  }

  #configureWelcomeStartup() {
    const panel = document.querySelector("#welcome-panel");
    if (!panel) return;
    const preference = this.#readWelcomePreference();
    const explicitlyRequested = this.#welcomeIsExplicitlyRequested();
    const launchSuppressed = !explicitlyRequested && this.#welcomeIsSharedLaunch();
    panel.dataset.dismissed = preference.dismissed ? "true" : "false";
    panel.dataset.launchSuppressed = launchSuppressed ? "true" : "false";
    if (explicitlyRequested) panel.dataset.reopened = "true";
    panel.hidden = !explicitlyRequested && (preference.dismissed || launchSuppressed);
    const input = document.querySelector("#welcome-suppress");
    if (input) input.checked = preference.dismissed;
  }

  #dismissWelcome({ persist = false } = {}) {
    const welcomePanel = document.querySelector("#welcome-panel");
    const wasVisible = !welcomePanel.hidden;
    welcomePanel.dataset.dismissed = "true";
    delete welcomePanel.dataset.reopened;
    welcomePanel.hidden = true;
    if (persist) this.#saveWelcomePreference({ dismissed: true });
    if (wasVisible) {
      this.events.publish("welcome:visibility-changed");
      this.events.publish("context:workspace-changed");
    }
  }

  #toggleWelcome() {
    const panel = document.querySelector("#welcome-panel");
    if (!panel.hidden) return this.#dismissWelcome();
    panel.dataset.reopened = "true";
    panel.hidden = false;
    this.events.publish("welcome:visibility-changed");
    this.events.publish("context:workspace-changed");
  }

  /**
   * "Create an animation": the Cinematic guide. Each step opens what it points
   * at (the setup dialog, the playback controls, Present & export), and a map
   * with nothing to animate gets the USGS past-week earthquakes first.
   */
  async #startCinematicGuide() {
    this.#dismissWelcome();
    const steps = CINEMATIC_WALKTHROUGH_STEPS;
    const wait = (selector, signal) => waitForWalkthroughTarget(selector, { signal }).catch(() => null);
    const nonModal = () => {
      // A modal dialog makes the rest of the page inert, including the guide's own buttons,
      // so during the guide the setup floats over the map as a panel beside the guide's card.
      if (!this.dialog.open || this.mobileMedia.matches) return;
      if (this.dialog.matches?.(":modal")) { this.dialog.close(); this.dialog.show(); }
      // openDialog clears this for the next dialog. (Not a close listener: the
      // close event of the swap above arrives while the dialog is open again.)
      this.dialog.classList.add("app-dialog--floating");
    };
    const openPanel = (sections) => {
      this.cinematicDisclosureState = { ...(this.cinematicDisclosureState || {}), ...sections };
      this.#renderPresentationDashboard(this.projectManager.current.presentation);
    };
    const prepare = async (index, { signal }) => {
      const step = steps[index];
      if (["layer", "kind", "effect", "start"].includes(step.id)) {
        if (!document.querySelector("[data-cinematic-kind]")?.isConnected || !this.dialog.open) {
          if (!this.mapController.getLayers().some((layer) => layer.queryable && layer.objectIdField)) {
            await this.loadLayer({ url: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson", title: "Earthquakes — past week", serviceType: "geojson" });
          }
          this.#openCinematicMode({ reconfigure: true });
        }
        nonModal();
        return Boolean(await wait(step.desktop, signal));
      }
      if (step.id === "play") {
        // Leaving the setup steps starts the animation with what was chosen.
        const start = this.dialog.open && document.querySelector("[data-cinematic-kind]") ? document.querySelector("#dialog-actions .button--primary") : null;
        start?.click();
        return Boolean(await wait(".cinematic-quick-controls", signal));
      }
      if (step.id === "tune" || step.id === "dates") { openPanel({ playback: true }); await wait(".cinematic-controls", signal); return true; }
      if (step.id === "clip" || step.id === "share") {
        if (this.cinematicController.exportCinematicSpec?.()?.cinematic?.intent !== "present") {
          this.cinematicController.setIntent("present");
          this.projectManager.patchPresentation({ cinematic: this.cinematicController.exportCinematicSpec().cinematic });
        }
        openPanel({ present: true });
        return Boolean(await wait("[data-cinematic-create-clip]", signal));
      }
      return true;
    };
    try { await prepare(0, { signal: new AbortController().signal }); } catch (error) { this.error(`The guide could not start: ${error.message}`); return; }
    startWorkspaceWalkthrough({ steps, label: "Create an animation", mobile: () => this.mobileMedia.matches, beforeStep: prepare, preparingLabel: "Getting the next step ready…" });
  }

  #startWorkspaceWalkthrough() {
    this.#dismissWelcome();
    startWorkspaceWalkthrough({ mobile: () => this.mobileMedia.matches });
  }

  activateExampleGuide(example, { start = false } = {}) {
    if (!example) return;
    this.activeExampleGuide = example;
    this.#renderLayers();
    if (!start || this.exampleGuideStarted) return;
    this.exampleGuideStarted = true;
    requestAnimationFrame(() => setTimeout(() => this.#startExampleWalkthrough(example), 250));
  }

  #startExampleWalkthrough(example = this.activeExampleGuide) {
    if (!example) return;
    this.#dismissWelcome();
    if (example.tutorial === "historical-quakes-briefing") {
      this.#startHistoricalQuakesBriefingTutorial();
      return;
    }
    startWorkspaceWalkthrough({
      steps: createExampleWalkthroughSteps(example),
      label: `${example.title || "Example"} tutorial`,
      mobile: () => this.mobileMedia.matches,
    });
  }

  #startHistoricalQuakesBriefingTutorial() {
    const prepare = async (index, { signal }) => {
      const step = HISTORICAL_QUAKES_BRIEFING_TUTORIAL_STEPS[index];
      if (index === 0) return true;
      const presentation = this.projectManager.current.presentation;
      const layer = this.mapController.getLayer(presentation?.primaryLayerId || this.presentationState.layerUid);
      if (!layer) throw new Error("The Historical Quakes layer is no longer available. Reopen the example and start the tutorial again.");
      if (index === 1) {
        this.#openLayerSource(layer.uid);
      } else if (index === 2) {
        this.#openSymbologyUtility(layer.uid);
      } else if (index === 3) {
        // The briefing already has its M6.5+ source scope. Explain it in the
        // visible Data dock instead of opening a filter modal over the guide.
        this.#openBriefingInspector();
      } else {
        if (presentation?.template !== "briefing") throw new Error("The Historical Quakes briefing is no longer open. Reopen the example and start the tutorial again.");
        this.briefingTab = "slides";
        this.#renderPresentationDashboard(presentation);
        this.#openBriefingInspector();
      }
      await waitForWalkthroughTarget(this.mobileMedia.matches ? step.mobile : step.desktop, { signal });
      return true;
    };
    startWorkspaceWalkthrough({
      steps: HISTORICAL_QUAKES_BRIEFING_TUTORIAL_STEPS,
      label: "Historical Quakes briefing tutorial",
      mobile: () => this.mobileMedia.matches,
      beforeStep: prepare,
      preparingLabel: "Opening the next part of the Historical Quakes briefing…",
    });
  }

  /**
   * The Historical Quakes example is ArcGIS-first, except for its deliberately
   * isolated MapLibre pulse slide. The renderer changes below the live app;
   * the player, route, panels, and current slide never reload.
   */
  async #ensureHistoricalQuakesSlideEngine(slide) {
    if (new URLSearchParams(location.search).get('briefingExample') !== 'historical-quakes') return false;
    const target = slide?.mapEngine;
    if (!['arcgis', 'maplibre'].includes(target) || target === this.mapController.getEngineId()) return false;
    await this.#switchEngineSilently(target, { updateUrl: true });
    return false;
  }

  #remapEngineLayerReferences(layers = []) {
    const ids = new Map(layers.map(({ from, to }) => [from, to]).filter(([from, to]) => from && to));
    if (!ids.size) return;
    const current = this.projectManager.current.presentation || {};
    const primaryLayerId = ids.get(current.primaryLayerId) || current.primaryLayerId;
    const selection = current.briefingSelection;
    const selectionLayerId = ids.get(selection?.layerId) || selection?.layerId;
    if (primaryLayerId !== current.primaryLayerId || selectionLayerId !== selection?.layerId) {
      this.projectManager.setPresentation({
        ...current,
        primaryLayerId,
        ...(selection ? { briefingSelection: { ...selection, layerId: selectionLayerId } } : {}),
      });
    }
    const active = ids.get(this.presentationState?.layerUid);
    if (active) this.presentationState.layerUid = active;
    const workspaceLayer = this.briefingWorkspace?.layer;
    const workspaceUid = ids.get(workspaceLayer?.uid);
    if (workspaceUid && this.briefingWorkspace) this.briefingWorkspace.layer = this.mapController.getLayer(workspaceUid) || workspaceLayer;
  }

  /** Switch only the renderer canvas, retaining the application and its state. */
  async #switchEngineSilently(engine, { persist = false, updateUrl = false } = {}) {
    if (engine === this.mapController.getEngineId()) return { switched: false, engine, layers: [] };
    this.toast(`Switching to ${engine === 'maplibre' ? 'MapLibre' : 'ArcGIS'}…`);
    const result = await this.mapController.switchEngine(engine);
    this.#remapEngineLayerReferences(result.layers);
    this.syncBasemapTheme?.();
    this.mapController.resize();
    if (updateUrl) {
      const url = new URL(location.href);
      url.searchParams.set('engine', engine);
      history.replaceState(null, '', url.href);
    }
    if (persist) saveEngine(globalThis.localStorage, engine);
    return result;
  }

  /**
   * Changes the renderer in place. A local-only layer is rejected by the map
   * controller before anything is removed, so this never silently loses work.
   */
  async #switchEngine(engine) {
    try {
      await this.#switchEngineSilently(engine, { persist: true, updateUrl: true });
    } catch (error) {
      this.error(error.message || 'The map engine could not be switched.');
    }
  }

  /** A stable public launcher for the documented Historical Quakes tutorial URL. */
  async openHistoricalQuakesBriefingExample({ startTutorial = false, present = false, slide = null } = {}) {
    return this.#openExampleHistoricalQuakesBriefing({ startTutorial, present, slide });
  }

  /**
   * The standard left panels (Places, Bookmarks, Draw, Intelligence, Layers) each
   * get a dock button in their header that moves the panel into a right-panel
   * tab; closing the tab puts it back.
   */
  #initDockablePanels() {
    const panes = document.querySelector("#utility-panel .utility-panes");
    for (const [id, label] of Object.entries(DOCKABLE_PANELS)) {
      const shell = document.querySelector(`#${id}-panel`);
      const summary = shell?.querySelector(":scope > summary");
      if (!summary) continue;
      if (!["draw", "intelligence"].includes(id)) {
        const body = shell.querySelector(":scope > .panel__body");
        this.panelManager?.register(`content:${id}`, body, { shell });
        if (!document.querySelector(`[data-utility-pane="${id}"]`)) {
          const pane = document.createElement("div");
          pane.id = `utility-${id}-content`;
          pane.className = "utility-content workspace-tool-pane";
          pane.dataset.utilityPane = id;
          pane.hidden = true;
          panes?.append(pane);
        }
      }
      const button = document.createElement("button");
      button.type = "button";
      button.className = "panel-dock";
      button.dataset.panelDock = id;
      button.setAttribute("aria-label", `Open ${label} in the right panel`);
      button.title = `Open ${label} in the right panel`;
      button.innerHTML = dockIcon("dock");
      // A button inside <summary> would also fold the panel; it only docks.
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.#openPanelUtility(id);
      });
      summary.append(button);
      const close = document.createElement("button");
      close.type = "button"; close.className = "panel-close"; close.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6 6 18"/></svg>';
      close.setAttribute("aria-label", `Close ${label} panel`); close.title = `Close ${label} panel`;
      close.addEventListener("click", (event) => {
        event.preventDefault(); event.stopPropagation();
        if (document.body.classList.contains("fieldwork-desktop")) this.fieldworkWorkspace.togglePanel(shell.id);
        else this.#setOptionalPanelVisibility(shell.id, false);
      });
      summary.append(close);
    }
  }

  #openPanelUtility(id) {
    if (id === "intelligence") return this.#openIntelligenceUtility();
    if (id === "draw") return this.#openDrawUtility();
    this.utilityPanelsOpen.add(id);
    const shell = document.querySelector(`#${id}-panel`);
    if (shell) shell.open = true;
    this.panelManager?.move(`content:${id}`, document.querySelector(`#utility-${id}-content`), { surface: "utility", hideShell: true, replaceHost: true });
    this.#syncUtilityPanel(id);
  }

  #openIntelligenceUtility() {
    this.utilityIntelligenceOpen = true;
    const intelligencePanel = document.querySelector("#intelligence-panel");
    intelligencePanel.open = false;
    this.panelManager?.move("content:intelligence", document.querySelector("#utility-intelligence-content"), {
      surface: "utility",
      hideShell: true,
      replaceHost: true,
    });
    this.#renderIntelligenceContents();
    this.#syncUtilityPanel("intelligence");
  }

  #openDrawUtility() {
    this.utilityDrawOpen = true;
    const drawPanel = document.querySelector("#draw-panel");
    drawPanel.open = false;
    this.panelManager?.move("content:draw", document.querySelector("#utility-draw-content"), {
      surface: "utility",
      hideShell: true,
      replaceHost: true,
    });
    this.#syncUtilityPanel("draw");
  }

  #closeActiveUtilityTab() {
    if (this.activeUtilityTab) this.#closeUtilityTab(this.activeUtilityTab);
  }

  #closeUtilityTab(tabId) {
    if (tabId === "briefing") { this.briefingInspectorOpen = false; this.#syncUtilityPanel(); return; }
    if (tabId === "notes") {
      this.mapNotesModeActive = false; this.fieldNotesEditing = false; this.mapNotesSelectionId = (this.mapNotesSelectionId || 0) + 1;
      this.mapNotesAttachFeature = null; this.mapNotesSessionDraft = null;
      document.body.classList.remove("map-notes-authoring");
      this.mapController.setMapNoteMarkers([]);
      document.querySelector("#utility-notes-content")?.replaceChildren();
      this.#syncUtilityPanel(); return;
    }
    if (tabId === "data-notes") { if (this.captureDataMapNoteDraft?.() && !globalThis.confirm(this.dataMapNoteDraftStored ? "Close Map Notes? Your unsaved draft is kept only in this browser tab session, not in the project. Save the note and project for permanent storage." : "Close Map Notes? Session storage is unavailable and your unsaved draft will be lost.")) return; this.captureDataMapNoteDraft = null; this.dataMapNotesOpen = false; this.dataMapNotePickRevision = (this.dataMapNotePickRevision || 0) + 1; this.setDataMapNoteTarget = null; this.dataMapNotePoint = null; document.querySelector("#utility-data-notes-content")?.replaceChildren(); this.#syncUtilityPanel(); return; }
    if (tabId === "workspace") { this.utilityWorkspaceOpen = false; this.chartWorkspaceOpen = false; this.#syncUtilityPanel(); return; }
    if (tabId === "query") {
      this.utilityQueryOpen = false;
      this.utilityQueryLayerUid = null;
      document.querySelector("#utility-query-content")?.replaceChildren();
      this.#syncUtilityPanel();
      return;
    }
    if (this.utilityPanelsOpen.has(tabId)) {
      this.utilityPanelsOpen.delete(tabId);
      this.panelManager?.restore(`content:${tabId}`);
      this.applicationRuntime.syncStaticPanelVisibility();
      this.#syncUtilityPanel();
      return;
    }
    if (tabId === "tasks") {
      // The workflow router owns the Tasks screen; it returns to the map and undocks it.
      this.events.publish("workflow:panel-closed", { route: "tasks" });
      return;
    }
    if (tabId === "dialog") {
      this.utilityDialogOpen = false;
      this.utilityDialogLayerTool = null;
      this.dialog.close();
      this.#syncUtilityPanel();
      return;
    }
    if (tabId === "assistant") {
      this.utilityAssistantOpen = false;
      this.#syncUtilityPanel();
      return;
    }
    if (tabId === "intelligence") {
      this.utilityIntelligenceOpen = false;
      this.panelManager?.restore("content:intelligence", { restoreShell: false });
      this.applicationRuntime.syncStaticPanelVisibility();
      this.#syncUtilityPanel();
      return;
    }
    if (tabId === "presentation") {
      const resumeMobileAtlas = this.mobileAtlasSettingsOpen;
      this.mobileAtlasSettingsOpen = false;
      this.utilityPresentationOpen = false;
      const dashboard = document.querySelector("#presentation-dashboard");
      if (dashboard) this.panelManager?.restore("presentation:dashboard");
      const dockButton = dashboard?.querySelector("[data-presentation-dock]");
      if (dockButton) {
        dockButton.setAttribute("aria-label", "Open in right panel");
        dockButton.title = "Open in right panel";
        dockButton.innerHTML = dockIcon("dock");
      }
      document.body.classList.remove("presentation-workspace-panels-open");
      document.querySelectorAll(".sidebar__scroll > .panel[data-presentation-hidden]").forEach((panel) => { panel.hidden = true; });
      this.#syncUtilityPanel();
      if (resumeMobileAtlas && this.projectManager.current.presentation?.template === "atlas") {
        this.presentationState.atlasPresent = true;
        this.#renderPresentationDashboard(this.projectManager.current.presentation);
        const chapters = this.projectManager.current.presentation.chapters || [];
        const index = Math.max(0, Math.min(chapters.length - 1, this.presentationState.atlasChapterIndex ?? 0));
        if (chapters[index]) this.#showAtlasChapterOverlay(chapters[index], index, chapters);
      }
      return;
    }
    if (tabId === "draw") {
      this.utilityDrawOpen = false;
      this.panelManager?.restore("content:draw", { restoreShell: false });
      this.applicationRuntime.syncStaticPanelVisibility();
      this.#syncUtilityPanel();
      return;
    }
    if (tabId === "lab") {
      this.cartographyLabOpen = false;
      document.querySelector("#utility-lab-content")?.replaceChildren();
      this.#syncUtilityPanel();
      return;
    }
    if (tabId === "style") {
      this.utilityStyleLayerUid = null;
      document.querySelector("#utility-style-content").replaceChildren();
      this.#syncUtilityPanel();
      return;
    }
    if (tabId === "source") {
      this.utilitySourceLayerUid = null;
      document.querySelector("#utility-source-content")?.replaceChildren();
      this.#syncUtilityPanel();
      return;
    }
    if (["basemapGallery", "elevationProfile", "legend", "measurement"].includes(tabId)) {
      void this.mapController.toggleWidget(tabId);
    }
  }

  #setSidebarCollapsed(collapsed) {
    const mobile = this.mobileMedia.matches;
    document.body.classList.toggle("sidebar-collapsed", collapsed);
    if (collapsed) document.body.classList.remove("mobile-drawer-expanded");
    document.querySelector("#sidebar").setAttribute("aria-hidden", String(mobile ? false : collapsed));
    const mobileDrawerContent = document.querySelector("#sidebar .sidebar__scroll");
    mobileDrawerContent.inert = mobile && collapsed;
    mobileDrawerContent.setAttribute("aria-hidden", String(mobile && collapsed));
    const sidebarOpen = document.querySelector("#sidebar-open");
    sidebarOpen.hidden = mobile;
    sidebarOpen.setAttribute("aria-expanded", String(!collapsed));
    const handle = document.querySelector("#mobile-drawer-handle");
    handle?.setAttribute("aria-expanded", String(!collapsed));
    handle?.setAttribute("aria-label", `${collapsed ? "Expand" : "Collapse"} tool drawer`);
    requestAnimationFrame(() => this.mapController.resize());
  }

  #activateMobilePanel(panelId, openSidebar = true) {
    if (openSidebar) {
      this.#closeMenus();
      this.#dismissWelcome();
      this.#setInsightsOpen(false);
    }
    const panel = document.getElementById(panelId);
    if (panel?.classList.contains("is-sidebar-optional-hidden")) this.#setOptionalPanelVisibility(panelId, true, false);
    // null is the manager's intentional result when the active tool is toggled off.
    const activePanelId = this.mobilePanelManager ? this.mobilePanelManager.activate(panelId) : panelId;
    if (openSidebar) this.#setSidebarCollapsed(!activePanelId);
    this.events.publish("mobile:panel-active", { panelId: activePanelId || null });
  }

  async #handleAction(action) {
    if (this.dataMapNotesOpen && action?.startsWith("mode-") && action !== "mode-data-map-notes" && this.captureDataMapNoteDraft?.() && !globalThis.confirm(this.dataMapNoteDraftStored ? "Change mode? Your unsaved Map Note is kept only in this browser tab session, not in the project." : "Change mode? Session storage is unavailable and your unsaved Map Note may be lost.")) return;
    this.keepWelcomeForSharedExample = false;
    try {
      switch (action) {
        case "welcome-toggle":
          this.#toggleWelcome();
          break;
        case "welcome-dismiss":
          this.#dismissWelcome();
          break;
        case "classic-mode-toggle": {
          const settings = { ...this.#readDisplaySettings() };
          settings.classicLayout = !settings.classicLayout;
          try { localStorage.setItem(DISPLAY_SETTINGS_KEY, JSON.stringify(settings)); } catch { /* Session-only layout. */ }
          this.#closeMenus();
          this.#applyDisplaySettings(settings);
          this.fieldworkWorkspace?.refresh();
          this.toast(settings.classicLayout ? "Classic mode on. Choose Modes → Classic mode again to return to the new layout." : "Classic mode off.");
          break;
        }
        case "project-select":
          this.#selectProjectDialog();
          break;
        case "project-create":
          this.#createProjectDialog();
          break;
        case "project-save":
          this.#saveProjectDialog();
          break;
        case "project-details":
          this.#projectDetailsDialog();
          break;
        case "project-export":
          this.#projectDownloadDialog();
          break;
        case "project-package":
          await this.projectManager.exportPackage();
          break;
        case "atlas-export":
          this.projectManager.exportAtlas();
          break;
        case "project-import":
          document.querySelector("#project-file-input").click();
          break;
        case "open-image":
          this.openImagePicker();
          break;
        case "project-share":
          await this.#copyShareLink();
          break;
        case "project-application-settings":
          this.#applicationSettingsDialog();
          break;
        case "data-file":
          document.querySelector("#data-file-input").click();
          break;
        case "data-arcgis":
          this.#serviceDialog("arcgis-auto");
          break;
        case "data-google-sheet":
          void this.#addGoogleSheet();
          break;
        case "data-geojson":
          this.#serviceDialog("geojson");
          break;
        case "data-wms":
          this.#serviceDialog("wms");
          break;
        case "data-wfs":
          this.#serviceDialog("wfs");
          break;
        case "data-vector-tiles":
          this.#serviceDialog("vector-tiles");
          break;
        case "data-pmtiles": {
          const { openPmtilesPanel } = await import("./data-connections-panel.js?v=0.65.0-paths");
          openPmtilesPanel(this, this.mapController, (engine) => this.#switchEngine(engine));
          break;
        }
        case "data-duckdb": {
          const { openDuckdbPanel } = await import("./data-connections-panel.js?v=0.65.0-paths");
          openDuckdbPanel(this, this.applicationRuntime.duckdb);
          break;
        }
        case "tools-spatial-analysis": {
          const { openSpatialAnalysis } = await import("./spatial-analysis-panel.js?v=0.66.1-finish1");
          openSpatialAnalysis(this, globalThis.gisMapOnline.analysis);
          break;
        }
        case "tools-sql-workspace": {
          this.openDialog({ eyebrow: "Database tools", title: "SQL Workspace", content: '<div data-tools-sql-workspace></div>' });
          const host = this.dialog.querySelector("[data-tools-sql-workspace]");
          this.applicationRuntime.panels.get("sql").mount(host, { config: { settings: {} } });
          const more = document.createElement("p");
          more.className = "form-note sql-panel__more";
          more.innerHTML = 'For spatial analysis, joins and adding results to the map, use <button type="button" class="link-button">Query Data</button>.';
          more.querySelector("button").addEventListener("click", () => this.#handleAction("tools-duckdb-query"));
          host.append(more);
          break;
        }
        case "tools-duckdb-query": {
          const { openDuckdbQueryWorkspace } = await import("./duckdb-query-workspace.js?v=0.57.0-spatial2");
          openDuckdbQueryWorkspace(this, this.applicationRuntime.duckdb);
          break;
        }
        case "data-postgis": {
          const { openPostgisPanel } = await import("./data-connections-panel.js?v=0.65.0-paths");
          openPostgisPanel(this);
          break;
        }
        case "data-export":
        case "share-export":
          this.#shareExportDialog();
          break;
        case "share-map":
          this.shareMap().catch((error) => this.error(error.message));
          break;
        case "map-pdf":
        case "export-pdf-editor":
          this.#openMapTemplates("pdf").catch((error) => this.error(error.message));
          break;
        case "export-pdf-images":
          this.#openMapTemplates("pdf", "image-overlay").catch((error) => this.error(error.message));
          break;
        case "export-smart-image":
          this.#openMapTemplates("smart-image").catch((error) => this.error(error.message));
          break;
        case "data-popular":
          this.#popularDataDialog();
          break;
        case "mode-data-map-notes":
          this.#leaveMobileWorkflowScreen();
          openDataMapNotesPanel(this);
          break;
        case "mode-map-notes":
          this.#leaveMobileWorkflowScreen();
          openMapNotesPanel(this);
          break;
        case "game-dragons":
          this.openDialog({ eyebrow: "Games", title: "Here be dragons", content: `<iframe class="dragon-game-frame" src="${appUrl("dragons/?embed=1")}" title="Here be dragons game"></iframe>` });
          if (this.dialog.classList.contains("app-dialog--docked")) this.#reopenDialog(false);
          {
            const stopGame = () => {
              if (this.dialog.open) return;
              this.dialog.querySelector(".dragon-game-frame")?.remove();
              this.dialog.removeEventListener("close", stopGame);
            };
            this.dialog.addEventListener("close", stopGame);
          }
          break;
        case "tools-custom":
          this.#customToolDialog();
          break;
        case "tools-connections":
          this.#connectionsDialog();
          break;
        case "tools-ai":
          this.#aiDialog();
          break;
        case "tools-assistant":
          this.openAssistant();
          break;
        case "tools-cartography-lab":
          this.openCartographyLab();
          break;
        case "guide-cinematic":
          if (document.body.classList.contains("mobile-menu-open")) document.querySelector("#mobile-menu-toggle")?.click();
          void this.#startCinematicGuide();
          break;
        case "tools-chart-line-area":
          void this.#openChartsAnalytics({ family: "line-area" });
          break;
        case "tools-chart-bar-column":
          void this.#openChartsAnalytics({ family: "bar-column" });
          break;
        case "tools-chart-scatter-bubble":
          void this.#openChartsAnalytics({ family: "scatter-bubble" });
          break;
        case "tools-chart-distribution-composition":
          void this.#openChartsAnalytics({ family: "distribution-composition" });
          break;
        case "tools-chart-3d":
          void this.#openChartsAnalytics({ family: "3d" });
          break;
        case "tools-chart-map":
          void this.#openChartsAnalytics({ family: "map" });
          break;
        case "tools-chart-custom":
        case "tools-charts-analytics": // Deep links from the original entry remain valid.
          void this.#openChartsAnalytics({ family: "custom" });
          break;
        case "tools-walkthrough":
          if (document.body.classList.contains("mobile-menu-open")) document.querySelector("#mobile-menu-toggle")?.click();
          this.#startWorkspaceWalkthrough();
          break;
        case "tools-display":
          this.#displaySettingsDialog();
          break;
        case "map-presentation":
          this.#presentationDialog();
          break;
        case "map-guided-tours":
          this.#openGuidedTours();
          break;
        case "mode-cinematic":
          this.#openCinematicMode();
          break;
        case "map-customize":
        case "dashboard-builder":
          this.#dashboardBuilderComingSoon();
          break;
        case "map-globe":
          this.#applicationBuilderDialog("globe");
          break;
        case "tools-about":
          this.#aboutDialog();
          break;
      }
    } catch (error) {
      this.error(error.message);
    }
  }

  async #copyShareLink() {
    const href = createShareUrl({
      baseUrl: location.href,
      layers: this.mapController.getAllLayerConfigs(),
      basemap: this.mapController.getBasemapId(),
    });
    await navigator.clipboard.writeText(href);
    this.toast("Share link copied. Local files and credentials were not included.");
  }

  /**
   * Enters Cinematic mode. A mapping already set up in this project (kept while
   * you visit other modes) resumes as it was; `reconfigure` opens the setup.
   */
  #openCinematicMode({ reconfigure = false } = {}) {
    const current = this.projectManager.current.presentation || {};
    const saved = current.cinematic;
    if (!reconfigure && saved?.layers?.length && saved.layers.every((item) => this.mapController.getLayer(item.layerRef))) {
      if (current.template !== "cinematic") this.projectManager.setPresentation({ ...current, template: "cinematic" });
      return;
    }
    const layers = this.mapController.getLayers().filter((layer) => layer.queryable && layer.objectIdField);
    if (!layers.length) {
      this.#openCinematicNeedsData();
      return;
    }
    const selected = layers.find((layer) => layer.uid === this.presentationState.layerUid) || layers[0];
    const supportsBoundaryGlow = this.mapController.getCapabilities().includes("three-3d");
    const options = () => layers.map((layer) => `<option value="${escapeHtml(layer.uid)}">${escapeHtml(layer.title || "Untitled layer")}</option>`).join("");
    this.openDialog({
      eyebrow: "Cinematic mode",
      title: "Animate a layer",
      content: `<p class="form-note">Play observed records through time, sweep through a number field, or just bring the layer to life with a looping effect. Playback steps between real records; it never interpolates geometry or reads numbers as dates. <button type="button" class="link-button" data-cinematic-guide>New to this? Follow the step-by-step guide.</button></p><div class="field-grid"><label class="field"><span>Layer</span><select data-cinematic-layer>${options()}</select></label><label class="field"><span>Animate by</span><select data-cinematic-kind><option value="time">A date or time field (timeline)</option><option value="number">A number field (scenario sweep)</option><option value="none">Nothing: everything at once (ambient loop)</option></select></label><label class="field" data-cinematic-needs-field><span data-cinematic-field-label>Timestamp field</span><select data-cinematic-time></select></label><label class="field" data-cinematic-needs-number hidden><span>Steps</span><select data-cinematic-steps><option value="50">50 (coarse)</option><option value="100">100</option><option value="200" selected>200 (default)</option><option value="500">500 (fine)</option><option value="0">Every distinct value</option></select><small>Equal-count steps through the field's range; each step shows records up to its value.</small></label><label class="field" data-cinematic-needs-field><span>Group snapshots by</span><select data-cinematic-group><option value="">All observations together</option></select></label><label class="field" data-cinematic-needs-field><span>Display through time</span><select data-cinematic-time-mode><option value="instant">Current observed state</option><option value="cumulative">Build up observed records</option></select></label><label class="field"><span>Base playback duration (seconds)</span><input data-cinematic-duration type="number" min="1" max="600" value="120"></label><label class="field"><span>Initial speed</span><select data-cinematic-rate><option value="0.1">Very slow</option><option value="0.25" selected>Slow</option><option value="0.5">Steady</option><option value="1">Fast</option></select></label>${supportsBoundaryGlow ? '<label class="field"><span>Visual effect</span><select data-cinematic-effect></select><small>Decorative animation drawn on observed geometry (MapLibre). It never changes the data.</small></label>' : ""}</div><p class="form-note" data-cinematic-field-note></p>`,
      actions: [{ label: "Cancel", handler: () => this.dialog.close() }, { label: "Start cinematic mode", primary: true, handler: async () => {
        const layer = this.mapController.getLayer(this.dialog.querySelector("[data-cinematic-layer]").value);
        const kind = this.dialog.querySelector("[data-cinematic-kind]").value;
        const timeField = kind === "none" ? null : this.dialog.querySelector("[data-cinematic-time]").value;
        if (!layer || (kind !== "none" && !timeField)) throw new Error(kind === "number" ? "Choose a layer and a number field." : "Choose a layer and a timestamp field.");
        const groupField = kind === "none" ? "" : this.dialog.querySelector("[data-cinematic-group]").value;
        const steps = kind === "number" ? Number(this.dialog.querySelector("[data-cinematic-steps]").value) : 0;
        const effectType = this.dialog.querySelector("[data-cinematic-effect]")?.value || "none";
        // A Strata timeline stacks each step on the last, so it always builds up.
        const timeMode = kind === "none" ? "instant" : effectType === "strata" ? "cumulative" : this.dialog.querySelector("[data-cinematic-time-mode]").value;
        const durationSeconds = Number(this.dialog.querySelector("[data-cinematic-duration]").value);
        const rate = Number(this.dialog.querySelector("[data-cinematic-rate]").value);
        const spec = { cinematic: {
          id: `cinematic-${Date.now()}`,
          title: `${layer.title || "Map"} ${kind === "none" ? "animation" : kind === "number" ? `by ${timeField}` : "playback"}`,
          intent: "explore",
          preferredEngine: this.mapController.getEngineId(),
          clock: { durationSeconds, rate, timeMode, loop: false },
          layers: [{ layerRef: layer.uid, temporal: { kind, steps, startField: timeField, groupField, featureIdField: layer.objectIdField, timezone: "UTC", missingTime: "exclude" }, animation: { template: layer.geometryType === "point" ? "moving-track" : "step-perimeter", transition: "step", outline: { color: "#ff8136", glow: effectType !== "none" }, effect: { type: effectType, intensity: 1 }, provenanceLabel: "Observed records" } }],
          provenance: { synthetic: false, sourceUrls: layer.url && /^https:\/\//i.test(layer.url) ? [layer.url] : [], interpolated: false },
        } };
        await this.cinematicController.load(spec);
        this.cinematicState = this.cinematicController.state();
        this.projectManager.setPresentation({ ...this.projectManager.current.presentation, template: "cinematic", title: spec.cinematic.title, primaryLayerId: layer.uid, cinematic: spec.cinematic });
        this.dialog.close();
      } }],
    });
    const layerInput = this.dialog.querySelector("[data-cinematic-layer]");
    const timeInput = this.dialog.querySelector("[data-cinematic-time]");
    const groupInput = this.dialog.querySelector("[data-cinematic-group]");
    const note = this.dialog.querySelector("[data-cinematic-field-note]");
    this.dialog.querySelector("[data-cinematic-guide]")?.addEventListener("click", () => void this.#startCinematicGuide());
    const kindInput = this.dialog.querySelector("[data-cinematic-kind]");
    const fillKind = () => {
      const layer = this.mapController.getLayer(layerInput.value) || selected;
      const kind = kindInput.value;
      const candidates = kind === "number" ? numericFieldCandidates(layer) : temporalFieldCandidates(layer);
      this.dialog.querySelectorAll("[data-cinematic-needs-field]").forEach((label) => { label.hidden = kind === "none"; });
      this.dialog.querySelectorAll("[data-cinematic-needs-number]").forEach((label) => { label.hidden = kind !== "number"; });
      this.dialog.querySelector("[data-cinematic-field-label]").textContent = kind === "number" ? "Number field" : "Timestamp field";
      timeInput.innerHTML = candidates.length ? candidates.map((field) => `<option value="${escapeHtml(field.name)}">${escapeHtml(field.label)}</option>`).join("") : `<option value="">${kind === "number" ? "No number field found" : "No date/timestamp field found"}</option>`;
      note.textContent = kind === "none" ? "Every feature shows at once and its effect loops. No date or number field is needed; Export movie records the loop with your camera moves."
        : candidates.length ? (kind === "number" ? `Steps through the field's values, lowest first. Build up shows everything up to the current value. Rows without a number are excluded.` : `Stable ID: ${layer.objectIdField}. Rows without a valid ${candidates[0].label} value will be excluded.`)
        : `This layer has no ${kind === "number" ? "number" : "date/timestamp"} field. Choose "Nothing" to animate it anyway, or pick another layer.`;
    };
    kindInput.addEventListener("change", fillKind);
    const fillFields = () => {
      const layer = this.mapController.getLayer(layerInput.value) || selected;
      // No date field is no obstacle: the layer can still sweep a number or animate as ambient.
      kindInput.value = temporalFieldCandidates(layer).length ? "time" : numericFieldCandidates(layer).length ? "number" : "none";
      groupInput.innerHTML = '<option value="">All observations together</option>' + (layer.fields || []).filter((field) => field.name !== layer.objectIdField).map((field) => `<option value="${escapeHtml(field.name)}">${escapeHtml(field.alias || field.name)}</option>`).join("");
      fillKind();
      const effectInput = this.dialog.querySelector("[data-cinematic-effect]");
      if (effectInput) effectInput.innerHTML = this.#cinematicEffectOptions("auto", suggestEffect({ title: layer.title, geometryType: layer.geometryType, fields: layer.fields || [] }), { cinematic: true });
    };
    layerInput.value = selected.uid;
    layerInput.addEventListener("change", fillFields);
    fillFields();
  }

  #selectProjectDialog() {
    const projects = this.projectManager.list();
    this.openDialog({
      eyebrow: "Local projects",
      title: "Select a project",
      content: projects.length
        ? `<div class="project-list">${projects.map((project) => `
            <button class="project-card" data-project-id="${escapeHtml(project.id)}">
              <strong>${escapeHtml(project.name)}</strong>
              <span>${escapeHtml(new Date(project.updatedAt).toLocaleString())} · ${project.layers?.length ?? 0} layers</span>
            </button>`).join("")}</div>`
        : '<div class="empty-state">No projects are saved in this browser yet.</div>',
    });
    this.dialog.querySelectorAll("[data-project-id]").forEach((button) =>
      button.addEventListener("click", async () => {
        this.dialog.close();
        await this.projectManager.loadSaved(button.dataset.projectId);
      }),
    );
  }

  #createProjectDialog() {
    this.openDialog({
      eyebrow: "New blank slate",
      title: "Create project",
      content: '<label class="field"><span>Project name</span><input id="new-project-name" value="Untitled project" /></label><p class="form-note">This clears operational layers and drawings from the current map.</p>',
      actions: [{ label: "Create project", primary: true, handler: async () => {
        const name = this.dialog.querySelector("#new-project-name").value;
        this.dialog.close();
        await this.projectManager.create(name);
      }}],
    });
  }

  #saveProjectDialog() {
    this.openDialog({
      eyebrow: "Browser storage",
      title: "Save project",
      content: `<label class="field"><span>Project name</span><input id="save-project-name" value="${escapeHtml(this.projectManager.current.name)}" /></label><p class="form-note">Service settings persist in localStorage. Browser security prevents saved projects from silently reopening local files; use a project package when those files must travel with the map.</p>`,
      actions: [{ label: "Save locally", primary: true, handler: () => {
        this.projectManager.save(this.dialog.querySelector("#save-project-name").value);
        this.dialog.close();
      }}],
    });
  }

  #readInstallationBrand() {
    const config = globalThis.GISMAP_INSTALLATION;
    return {
      name: String(config?.applicationName || DEFAULT_BRAND.name).trim().slice(0, 80) || DEFAULT_BRAND.name,
      logo: typeof config?.logoUrl === "string" && config.logoUrl.trim() ? config.logoUrl.trim() : DEFAULT_BRAND.logo,
    };
  }

  #applyBrandSettings(brand = this.#readInstallationBrand()) {
    document.querySelectorAll("[data-brand-name]").forEach((element) => { element.textContent = brand.name; });
    document.querySelectorAll("[data-brand-logo]").forEach((image) => {
      image.src = brand.logo;
      image.alt = `${brand.name} logo`;
    });
    document.querySelectorAll("[data-brand-atlas-name]").forEach((element) => { element.textContent = `${brand.name} Guided Places`; });
    document.querySelectorAll("[data-brand-tools-label]").forEach((element) => { element.setAttribute("aria-label", `${brand.name} tools`); });
    document.title = `${brand.name}: Geospatial Application`;
  }

  #applicationSettingsDialog() {
    const brand = this.#readInstallationBrand();
    const configSnippet = `globalThis.GISMAP_INSTALLATION = Object.freeze({\n  applicationName: ${JSON.stringify(brand.name)},\n  logoUrl: ${JSON.stringify(brand.logo)},\n});`;
    this.openDialog({
      eyebrow: "Installed application identity",
      title: "Installation branding",
      content: `<section class="application-brand-settings">
        <div class="application-brand-settings__preview"><img src="${escapeHtml(brand.logo)}" alt="${escapeHtml(brand.name)} logo" /><strong>${escapeHtml(brand.name)}</strong></div>
        <p>Branding is configured for the installation, not for an individual browser or project. Every user of this deployed application receives the same name and logo.</p>
        <p class="form-note">Edit <code>installation-config.js</code> before deployment. Add the company logo under <code>assets/</code> (or use an approved HTTPS URL), then set <code>applicationName</code> and <code>logoUrl</code>.</p>
        <label class="field"><span>Current installation config</span><textarea readonly rows="5" data-installation-brand-config>${escapeHtml(configSnippet)}</textarea></label>
      </section>`,
      actions: [
        { label: "Copy config", primary: true, handler: async () => {
          try {
            await navigator.clipboard.writeText(configSnippet);
            this.toast("Installation config copied.");
          } catch (error) {
            const field = this.dialog.querySelector("[data-installation-brand-config]");
            field.focus();
            field.select();
            this.toast("Installation config selected. Copy it from the field.");
          }
        } },
      ],
    });
  }

  #projectDetailsDialog() {
    const applyName = () => {
      const name = this.dialog.querySelector("#project-details-name").value.trim() || "Untitled project";
      this.setProjectTitle(name);
      return name;
    };
    this.openDialog({
      eyebrow: "Current project", title: "Project details",
      content: `<label class="field"><span>Project name</span><input id="project-details-name" maxlength="160" value="${escapeHtml(this.projectManager.current.name)}" /></label><p class="form-note">Save this project in your browser, download it, or share the map as a link and QR code.</p>`,
      actions: [
        { label: "Save locally", primary: true, handler: () => { this.projectManager.save(applyName()); this.dialog.close(); } },
        { label: "Download project", handler: () => { applyName(); this.#projectDownloadDialog(); } },
        { label: "Share / QR", handler: () => { applyName(); void this.shareMap().catch(error => this.error(error.message)); } },
      ],
    });
  }

  /**
   * Share & export: one place to send the map on. Share a styled map link and
   * QR, make a branded map PDF, turn a layer into a briefing or tour, or
   * download its data. `uid` is the layer it was opened from, if any.
   */
  #shareExportDialog(uid = null) {
    const layers = this.mapController.getAllLayerConfigs();
    const layer = layers.find((config) => config.uid === uid) || layers.find((config) => this.mapController.getLayer(config.uid)?.queryable) || layers[0] || null;
    const exportable = this.exportController.listExportableLayers();
    const filtered = layers.filter((config) => hasDataFilter(config.definitionExpression));
    const local = layers.filter((config) => config.local || !config.url);
    const styled = layer?.renderer && layer.renderer.type !== "simple";
    const queryable = layer && Boolean(this.mapController.getLayer(layer.uid)?.queryable);
    const card = (action, title, description, { disabled = "", icon }) => `<button type="button" class="share-export__card" data-share-export="${action}"${disabled ? ` disabled title="${escapeHtml(disabled)}"` : ""}><span class="share-export__icon" aria-hidden="true">${icon}</span><strong>${title}</strong><small>${disabled ? escapeHtml(disabled) : description}</small></button>`;
    const notices = [
      filtered.length && `Data filters are on: ${filtered.map((config) => escapeHtml(config.title || "Layer")).join(", ")} ${filtered.length === 1 ? "shows" : "show"} only part of the data. Links, PDFs and briefings keep the filter.`,
      local.length && `${local.length === 1 ? "One layer comes" : `${local.length} layers come`} from files on this device and cannot travel in a link; save a project package to share ${local.length === 1 ? "it" : "them"}.`,
    ].filter(Boolean);
    this.openDialog({
      eyebrow: layer ? escapeHtml(layer.title || "Layer") : "Current map",
      title: "Share & export",
      content: `<div class="share-export">${notices.map((notice) => `<p class="workflow-share__notice">${notice}</p>`).join("")}
        <div class="share-export__grid">
          ${card("share", "Share map", "Link and QR code with the layers, styles, filters, view, basemap and skin.", { icon: "⌗", disabled: layers.length > local.length ? "" : "Add a web layer to share a link." })}
          ${card("pdf", "Map PDF", "Choose a page template (report, poster, field sheet, slide and more) and download it as a PDF.", { icon: "▤" })}
          ${card("smart-image", "Smart map image", "Any page template as a PNG that anyone can view, and that reopens the whole project when dropped on GISMap Online.", { icon: "◩" })}
          ${card("briefing-share", "Share as a briefing", `One click: slides from ${layer ? `“${escapeHtml(layer.title || "this layer")}”` : "the layer"}'s ${styled ? "style, " : ""}filter and top features${this.aiController.isConfigured() ? ", described by AI" : ""}, ready to share.`, { icon: "✦", disabled: queryable ? "" : "Choose a feature layer to brief on." })}
          ${card("briefing", "Create briefing", `Start a briefing on ${layer ? `“${escapeHtml(layer.title || "this layer")}”` : "a layer"}${styled ? " with its style" : ""} and write the slides yourself.`, { icon: "▣", disabled: queryable ? "" : "Choose a feature layer to brief on." })}
          ${card("tour", "Start a tour here", "Save this view as the first chapter of a guided tour.", { icon: "➤" })}
          ${card("data", "Export data", "Download features as GeoJSON, KML, KMZ or Shapefile.", { icon: "⤓", disabled: exportable.length ? "" : "Add a queryable vector layer first." })}
        </div></div>`,
      actions: [{ label: "Close", handler: () => this.dialog.close() }],
    });
    this.dialog.querySelectorAll("[data-share-export]").forEach((button) => button.addEventListener("click", async () => {
      const action = button.dataset.shareExport;
      try {
        if (action === "share") return await this.shareMap();
        if (action === "data") return this.#exportDialog(exportable.some((item) => item.uid === layer?.uid) ? layer.uid : null);
        this.dialog.close();
        if (action === "pdf" || action === "smart-image") return await this.#openMapTemplates(action);
        if (action === "briefing") return this.createBriefingFromLayer(layer.uid);
        if (action === "briefing-share") return await this.generateBriefingFromView({ uid: layer.uid, share: true });
        if (action === "tour") return await this.#startTourHere();
      } catch (error) {
        this.error(error.message);
      }
    }));
  }

  /** The current map as a self-contained link (and QR when it fits). */
  async #mapShareLink() {
    const layers = this.mapController.getAllLayerConfigs();
    const link = await createShareLink({
      baseUrl: location.href,
      kind: "map",
      title: this.projectManager.current.name || "Shared map",
      skin: document.documentElement.dataset.skin || this.projectManager.current.presentation?.skin,
      basemap: this.mapController.getBasemapId(),
      camera: this.mapController.getViewState(),
      layers,
      textBoxes: this.mapController.getTextBoxes?.() ?? [],
    });
    return { ...link, layers };
  }

  /** Shares the map exactly as it looks: styles, filters, view, basemap and skin. */
  async shareMap() {
    const link = await this.#mapShareLink();
    const filtered = link.layers.filter((config) => hasDataFilter(config.definitionExpression) && !config.local).length;
    const local = link.layers.filter((config) => config.local || !config.url).length;
    const title = this.projectManager.current.name || "Shared map";
    await this.shareMobileWorkflow("map", {
      url: link.url,
      title,
      kind: "map",
      eyebrow: "Share map",
      qr: link.qr,
      notice: [
        filtered && `Data filters travel with this link: ${filtered === 1 ? "one layer shows" : `${filtered} layers show`} only part of its data.`,
        local && `${local === 1 ? "One layer" : `${local} layers`} from this device ${local === 1 ? "is" : "are"} left out.`,
      ].filter(Boolean).join(" "),
      message: "Opens this map with the same layers, styles, filters, view, basemap and look.",
      embed: { kind: "map", title, message: "Paste this iframe into your site to publish the configured map. The embedded map keeps the same public layers, style, filter, camera, basemap, and look." },
      card: { lines: ["Scan to open this map, or long-click the QR code", "to open it in a browser."], footer: "Complete map encoded in this QR" },
      downloads: [
        { label: "Map PDF", create: () => this.#mapPdfFile(link) },
        { label: "Smart map image", create: async () => (await this.projectManager.exportSmartImage({ download: false })).file },
        // The same map as readable JSON (schemas/map-v1.schema.json), to edit or host and open with ?spec=.
        ...(this.mapSpec ? [{ label: "Map spec (JSON)", create: () => new File([JSON.stringify({ $schema: "https://gismap.online/schemas/map-v1.schema.json", ...this.mapSpec.fromCurrent({ title }) }, null, 2)], `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "map"}.map.json`, { type: "application/json" }) }] : []),
      ],
    });
  }

  /**
   * Map templates: pick a prebuilt page, preview it, and download it as a PDF or
   * Smart Image. Templates are code, not project data; images added to the
   * "Map with images" template stay in this browser session.
   */
  async #openMapTemplates(output = "pdf", startTemplate = null) {
    const remembered = startTemplate || this.printState?.templateId || (() => { try { return localStorage.getItem("gismap.mapTemplate"); } catch { return null; } })();
    let templateId = getTemplate(remembered).id;
    this.templateImages ||= [];
    const frame = this.printFrame || this.#templateFrame();
    this.printFrame = null;
    const project = this.projectManager.current;
    const fields = this.#templateFields();
    const options = MAP_TEMPLATES.map((template) => `<label class="map-template"><input type="radio" name="map-template" value="${template.id}"${template.id === templateId ? " checked" : ""}><strong>${escapeHtml(template.label)}</strong><small>${escapeHtml(template.description)}</small><small class="map-template__size">${template.page.width} × ${template.page.height} in</small></label>`).join("");
    const anchors = (selected) => IMAGE_ANCHORS.map((anchor) => `<option value="${anchor}"${anchor === selected ? " selected" : ""}>${anchor.replace("-", " ")}</option>`).join("");
    this.openDialog({
      eyebrow: "PDF & Smart Image",
      title: "Print Editor",
      content: `<div class="map-templates">
        <div class="map-templates__list" role="radiogroup" aria-label="Page template">${options}</div>
        <div class="map-templates__side">
          <button type="button" class="map-templates__expand" data-template-fullwindow aria-pressed="false">⤢ Full window</button>
          <div class="map-templates__preview"><canvas data-template-preview aria-label="Page preview"></canvas><p class="form-note" data-template-status>Capturing the map…</p></div>
          <div class="map-templates__fields">
          <label class="field"><span>Title</span><input type="text" maxlength="120" data-template-title value="${escapeHtml(fields.title)}"></label>
          <label class="field"><span>Subtitle</span><input type="text" maxlength="160" data-template-subtitle value="${escapeHtml(fields.subtitle)}"></label>
          <label class="field"><span>Description (report and poster)</span><textarea rows="3" maxlength="900" data-template-description>${escapeHtml(fields.description)}</textarea></label>
          <fieldset class="feedback-settings map-templates__frame"><legend>Margin &amp; border</legend><div class="field-grid">
            <label class="opacity-row"><span>Margin</span><input type="range" min="0" max="1" step="0.05" data-frame-margin value="${frame.margin}"><output>${frame.margin.toFixed(2)} in</output></label>
            <label class="field"><span>Margin colour</span><input type="color" data-frame-margin-color value="${escapeHtml(frame.marginColor)}"></label>
            <label class="opacity-row"><span>Border</span><input type="range" min="0" max="12" step="0.5" data-frame-border value="${frame.borderWidth}"><output>${frame.borderWidth} pt</output></label>
            <label class="field"><span>Border colour</span><input type="color" data-frame-border-color value="${escapeHtml(frame.borderColor)}"></label>
          </div><label class="menu__toggle map-templates__qr"><input type="checkbox" data-frame-qr${frame.showQr !== false ? " checked" : ""}><span>Show QR code</span></label><label class="menu__toggle"><input type="checkbox" data-frame-north${frame.showNorth !== false ? " checked" : ""}><span>Show north arrow</span></label><label class="menu__toggle"><input type="checkbox" data-frame-scale${frame.showScale !== false ? " checked" : ""}><span>Show scale bar</span></label><label class="menu__toggle"><input type="checkbox" data-frame-links${frame.links !== false ? " checked" : ""}><span>Clickable links in the PDF</span></label><p class="form-note" data-frame-qr-note hidden>No QR code: the live-map link needs a public web layer or a text box on the map.</p></fieldset>
          <fieldset class="feedback-settings map-templates__images" data-template-images-panel hidden><legend>Images on the map</legend>
            <p class="form-note">Add logos, photos or callouts. They stay in this browser session and are not saved in the project.</p>
            <div data-template-images></div>
            <label class="map-templates__add"><input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" multiple data-template-image-input> Add images…</label>
          </fieldset>
          <label class="field"><span>Pages</span><select data-template-pages><option value="view">Current map view</option><option value="bookmarks"${(this.projectManager.current.bookmarks ?? []).length ? "" : " disabled"}>One page per bookmark (${(this.projectManager.current.bookmarks ?? []).length})</option></select></label>
          <p class="form-note" data-template-pages-note>The preview follows the map. Dock the editor in the workspace panel to pan and zoom while you watch.</p>
          <div class="workspace-tool__actions map-templates__actions"><button type="button" data-template-export="smart-image"${output === "smart-image" ? ' class="button--primary"' : ""}>Download Smart Image</button><button type="button" data-template-export="pdf"${output === "pdf" ? ' class="button--primary"' : ""}>Download PDF</button></div>
        </div></div></div>`,
    });
    const root = this.dialog;
    const session = this.dialogSession;
    const status = root.querySelector("[data-template-status]");
    const captures = new Map();
    // Controls work at once; the capture and project details arrive in the background.
    const details = this.#templateData().catch(() => null);

    const capture = async (id, options = {}) => {
      const aspect = templateMapAspect(id, options);
      const key = aspect.toFixed(3);
      if (!captures.has(key)) captures.set(key, this.#templateCapture(aspect));
      return captures.get(key);
    };
    const data = async () => {
      const base = await details;
      if (!base) throw new Error("The map is not ready yet.");
      const page = await this.#templatePage(templateId, base, frame, capture, {
        title: root.querySelector("[data-template-title]").value.trim(),
        subtitle: root.querySelector("[data-template-subtitle]").value.trim(),
        description: root.querySelector("[data-template-description]").value.trim(),
      });
      root.querySelector("[data-frame-qr]").disabled = !page.liveQr;
      root.querySelector("[data-frame-qr-note]").hidden = Boolean(page.liveQr);
      return page;
    };
    let pending = 0;
    const preview = () => draw().catch((error) => { status.textContent = error.message; });
    const draw = async () => {
      const ticket = ++pending;
      syncExpand();
      this.printState = {
        projectId: project.id,
        templateId,
        output,
        fields: Object.fromEntries(["title", "subtitle", "description"].map((key) => [key, root.querySelector(`[data-template-${key}]`).value])),
      };
      root.querySelector("[data-template-images-panel]").hidden = !getTemplate(templateId).images;
      status.textContent = "Capturing the map…";
      const sheet = getTemplate(templateId).page;
      const ppi = Math.min(this.dialog.classList.contains("app-dialog--fullwindow") ? 96 : 48, 1100 / Math.max(sheet.width, sheet.height));
      const page = renderTemplate(templateId, await data(), { ppi, frame });
      if (ticket !== pending || this.dialogSession !== session) return;
      const canvas = root.querySelector("[data-template-preview]");
      canvas.width = page.canvas.width;
      canvas.height = page.canvas.height;
      canvas.getContext("2d").drawImage(page.canvas, 0, 0);
      status.textContent = `${page.template.label} · ${page.template.page.width} × ${page.template.page.height} in`;
    };
    const renderImages = () => {
      root.querySelector("[data-template-images]").innerHTML = this.templateImages.map((item, index) => `<div class="map-templates__image" data-template-image="${index}">
        <img src="${item.image.src}" alt="">
        <label class="field"><span>Position</span><select data-image-anchor>${anchors(item.anchor)}</select></label>
        <label class="opacity-row"><span>Size</span><input type="range" min="5" max="80" step="1" data-image-size value="${item.size}"><output>${item.size}%</output></label>
        <label class="opacity-row"><span>Opacity</span><input type="range" min="0.1" max="1" step="0.05" data-image-opacity value="${item.opacity}"><output>${Math.round(item.opacity * 100)}%</output></label>
        <button type="button" class="button--quiet" data-image-remove>Remove</button></div>`).join("");
    };
    renderImages();
    root.querySelector(".map-templates__list").addEventListener("change", (event) => {
      templateId = event.target.value;
      try { localStorage.setItem("gismap.mapTemplate", templateId); } catch { /* Preference only. */ }
      preview();
    });
    for (const selector of ["[data-template-title]", "[data-template-subtitle]", "[data-template-description]"]) root.querySelector(selector).addEventListener("input", () => preview());
    root.querySelector("[data-template-image-input]").addEventListener("change", async (event) => {
      for (const file of [...event.target.files].slice(0, 8)) {
        if (file.size > 15 * 1024 * 1024) { this.error(`${file.name} is larger than 15 MB.`); continue; }
        const image = await loadImage(URL.createObjectURL(file));
        if (!image) { this.error(`${file.name} could not be read as an image.`); continue; }
        this.templateImages.push({ image, anchor: ["top-right", "bottom-left", "top-left", "bottom-right"][this.templateImages.length % 4], size: 22, opacity: 1 });
      }
      event.target.value = "";
      renderImages();
      preview();
    });
    const frameInputs = root.querySelector(".map-templates__frame");
    frameInputs.addEventListener("input", (event) => {
      frame.margin = Number(frameInputs.querySelector("[data-frame-margin]").value);
      frame.marginColor = frameInputs.querySelector("[data-frame-margin-color]").value;
      frame.borderWidth = Number(frameInputs.querySelector("[data-frame-border]").value);
      frame.borderColor = frameInputs.querySelector("[data-frame-border-color]").value;
      frame.showQr = frameInputs.querySelector("[data-frame-qr]").checked;
      frame.showNorth = frameInputs.querySelector("[data-frame-north]").checked;
      frame.showScale = frameInputs.querySelector("[data-frame-scale]").checked;
      frame.links = frameInputs.querySelector("[data-frame-links]").checked;
      frameInputs.querySelector("[data-frame-margin] + output").value = `${frame.margin.toFixed(2)} in`;
      frameInputs.querySelector("[data-frame-border] + output").value = `${frame.borderWidth} pt`;
      try { localStorage.setItem("gismap.mapTemplateFrame", JSON.stringify(frame)); } catch { /* Preference only. */ }
      preview();
    });
    const expand = root.querySelector("[data-template-fullwindow]");
    const setFullWindow = (on) => {
      // From the workspace panel, full window first returns the editor to a window of its own.
      if (on && this.dialog.classList.contains("app-dialog--docked")) {
        try { localStorage.setItem("gismap.mapTemplateFullWindow", "1"); } catch { /* Preference only. */ }
        this.dialog.close();
        setTimeout(() => this.#openMapTemplates(output, templateId).catch((error) => this.error(error.message)), 0);
        return;
      }
      // Cover the map and side panels, leaving the top bar and the icon rail.
      const shown = (element) => element.getClientRects().length > 0 && getComputedStyle(element).visibility !== "hidden";
      const header = [...document.querySelectorAll(".studio-header, .menu-bar")].find(shown);
      const rail = [...document.querySelectorAll(".workspace-rail")].find(shown);
      this.dialog.style.setProperty("--fullwindow-top", `${Math.round(header?.getBoundingClientRect().bottom || 0)}px`);
      this.dialog.style.setProperty("--fullwindow-left", `${Math.round(rail?.getBoundingClientRect().right || 0)}px`);
      this.dialog.classList.toggle("app-dialog--fullwindow", on);
      syncExpand();
      try { localStorage.setItem("gismap.mapTemplateFullWindow", on ? "1" : ""); } catch { /* Preference only. */ }
      preview();
    };
    const isFull = () => this.dialog.classList.contains("app-dialog--fullwindow") && !this.dialog.classList.contains("app-dialog--docked");
    function syncExpand() {
      expand.setAttribute("aria-pressed", String(isFull()));
      expand.textContent = isFull() ? "⤡ Exit full window" : "⤢ Full window";
    }
    expand.addEventListener("click", () => setFullWindow(!isFull()));
    // The preview follows the map: a moved view or edited label recaptures it.
    let refresh = 0;
    let exporting = false;
    const follow = () => {
      // Docking closes and reopens the dialog, so the editor stops following only once replaced or closed.
      if (this.dialogSession !== session || !this.dialog.open) { followers.forEach((follower) => follower.remove()); return; }
      if (exporting) return;
      clearTimeout(refresh);
      refresh = setTimeout(() => { captures.clear(); preview(); }, 350);
    };
    const followers = ["view:stationary", "text-boxes:changed", "layer:changed", "map:basemap-changed"].map((topic) => this.events.subscribe(topic, follow));
    this.dialog.addEventListener("close", () => this.dialog.classList.remove("app-dialog--fullwindow"), { once: true });
    const pagesSelect = root.querySelector("[data-template-pages]");
    const smartButton = root.querySelector('[data-template-export="smart-image"]');
    pagesSelect.addEventListener("change", () => {
      const many = pagesSelect.value === "bookmarks";
      smartButton.disabled = many;
      smartButton.title = many ? "A Smart Image holds one page; choose Current map view." : "";
      root.querySelector("[data-template-pages-note]").textContent = many
        ? "The PDF gets one page per bookmark, each titled with its name. The map visits every bookmark while it is made, then returns here."
        : "The preview follows the map. Dock the editor in the workspace panel to pan and zoom while you watch.";
    });
    if ((() => { try { return localStorage.getItem("gismap.mapTemplateFullWindow") === "1"; } catch { return false; } })()) setFullWindow(true);
    const images = root.querySelector("[data-template-images]");
    images.addEventListener("input", (event) => {
      const row = event.target.closest("[data-template-image]");
      const item = row && this.templateImages[Number(row.dataset.templateImage)];
      if (!item) return;
      if (event.target.matches("[data-image-anchor]")) item.anchor = event.target.value;
      if (event.target.matches("[data-image-size]")) { item.size = Number(event.target.value); event.target.nextElementSibling.value = `${item.size}%`; }
      if (event.target.matches("[data-image-opacity]")) { item.opacity = Number(event.target.value); event.target.nextElementSibling.value = `${Math.round(item.opacity * 100)}%`; }
      preview();
    });
    images.addEventListener("click", (event) => {
      if (!event.target.closest("[data-image-remove]")) return;
      this.templateImages.splice(Number(event.target.closest("[data-template-image]").dataset.templateImage), 1);
      renderImages();
      preview();
    });
    root.querySelectorAll("[data-template-export]").forEach((button) => button.addEventListener("click", async () => {
      const kind = button.dataset.templateExport;
      button.disabled = true;
      try {
        if (kind === "pdf" && pagesSelect.value === "bookmarks") {
          exporting = true;
          const pages = await this.#bookmarkPages(templateId, data, frame, status);
          const stem = templateId === "branded" ? "" : `-${templateId}`;
          this.#download(await this.#templatePdf(pages, `${this.#fileStem()}${stem}-bookmarks.pdf`));
          return;
        }
        this.toast(kind === "pdf" ? "Making the map PDF…" : "Rendering the Smart Image…");
        const page = renderTemplate(templateId, await data(), { ppi: this.#templatePpi(templateId, kind === "pdf" ? 150 : 120), frame });
        const stem = (page.template.id === "branded" ? "" : `-${page.template.id}`);
        if (kind === "pdf") this.#download(await this.#templatePdf(page, `${this.#fileStem()}${stem}-map.pdf`));
        else {
          const blob = await new Promise((resolve) => page.canvas.toBlob(resolve, "image/png"));
          await this.projectManager.exportSmartImage({ visual: blob, suffix: `smart-map${stem}`, template: page.template.id });
        }
      } catch (error) {
        this.error(error.message);
      } finally {
        button.disabled = kind === "smart-image" && pagesSelect.value === "bookmarks";
        exporting = false;
      }
    }));
    await preview();
  }

  /** The saved page frame, or the editor's defaults. */
  #templateFrame() {
    return { ...DEFAULT_PAGE_FRAME, showQr: true, showNorth: true, showScale: true, links: true, ...(() => { try { return JSON.parse(localStorage.getItem("gismap.mapTemplateFrame")) || {}; } catch { return {}; } })() };
  }

  /** The editor's title, subtitle and description for the current project. */
  #templateFields() {
    const project = this.projectManager.current;
    return {
      title: project.name || "Map",
      subtitle: `${new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })} · ${this.#basemapLabel(this.mapController.getBasemapId())}`,
      description: "",
      // Fields typed earlier in this session come back, e.g. after editing a text box.
      ...(this.printState?.projectId === project.id ? this.printState.fields : {}),
    };
  }

  /** Everything one template page draws. The Print Editor and gisMapOnline.print both come through here. */
  async #templatePage(templateId, base, frame, capture, fields) {
    const link = await this.#templateLink(base.palette);
    const compact = templateCompact({ ...base, qr: frame.showQr === false ? null : link.qr, description: fields.description });
    const shot = await capture(templateId, { compact });
    return {
      ...base,
      ...shot,
      ...link,
      ...fields,
      liveQr: link.qr,
      compact,
      images: getTemplate(templateId).images ? this.templateImages || [] : [],
      ...(frame.showQr === false ? { qr: null } : {}),
    };
  }

  /** Print Editor defaults, in the option names of gisMapOnline.print. */
  printDefaults() {
    const frame = this.#templateFrame();
    const { title, subtitle, description } = this.#templateFields();
    return {
      title, subtitle, description,
      marginIn: frame.margin, marginColor: frame.marginColor, borderPt: frame.borderWidth, borderColor: frame.borderColor,
      showQr: frame.showQr !== false, showNorthArrow: frame.showNorth !== false, showScaleBar: frame.showScale !== false, clickableLinks: frame.links !== false,
    };
  }

  /** One export for gisMapOnline.print, with the same drawing as the editor's buttons. Nothing downloads. */
  async printRender(kind, { template: templateId, title, subtitle, description, frame, pages, dpi }) {
    const base = await this.#templateData();
    const fields = { title, subtitle, description };
    const capture = (id, options) => this.#templateCapture(templateMapAspect(id, options));
    const data = async () => {
      const page = await this.#templatePage(templateId, base, frame, capture, fields);
      if (!page.map) throw new GisMapError("PRINT_RENDER_TIMEOUT", "The map could not be captured.");
      return page;
    };
    const stem = templateId === "branded" ? "" : `-${templateId}`;
    if (kind === "pdf" && pages === "bookmarks") {
      const list = await this.#bookmarkPages(templateId, data, frame, {});
      const file = await this.#templatePdf(list, `${this.#fileStem()}${stem}-bookmarks.pdf`);
      return { file, blob: file, share: this.#printShare() };
    }
    const fallback = { preview: 48, pdf: 150, "smart-image": 120 }[kind];
    const page = renderTemplate(templateId, await data(), { ppi: this.#templatePpi(templateId, dpi || fallback), frame });
    const share = this.#printShare();
    if (kind === "pdf") {
      const file = await this.#templatePdf(page, `${this.#fileStem()}${stem}-map.pdf`);
      return { file, blob: file, share };
    }
    const png = await new Promise((resolve, reject) => page.canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("The browser could not encode the page.")), "image/png"));
    if (kind === "preview") return { blob: png, file: null, share };
    const { blob, file } = await this.projectManager.exportSmartImage({ visual: png, suffix: `smart-map${stem}`, download: false, template: page.template.id });
    return { blob, file, share };
  }

  #printShare() {
    return this.templateQr ? { url: this.templateQr.url, qr: Boolean(this.templateQr.qr) } : undefined;
  }

  /** Opens the Print Editor on these options. */
  printOpen({ template, title, subtitle, description, frame }) {
    const project = this.projectManager.current;
    this.printState = { projectId: project.id, templateId: template, output: this.printState?.output || "pdf", fields: { title, subtitle, description } };
    this.printFrame = frame;
    if (this.printIsOpen()) this.dialog.close();
    this.#openMapTemplates(this.printState.output, template).catch((error) => this.error(error.message));
  }

  printIsOpen() {
    return Boolean(this.dialog?.open && this.dialog.querySelector(".map-templates"));
  }

  printDownload(file) {
    this.#download(file);
  }

  /** Project details every template can use. */
  async #templateData() {
    const skin = document.documentElement.dataset.skin || this.projectManager.current.presentation?.skin;
    const palette = printPalette(skin);
    const logo = await loadImage(BRAND_LOGO);
    const [longitude, latitude] = this.mapController.getViewState().center || [];
    let heading = 0;
    try { heading = this.mapController.getCamera()?.heading || 0; } catch { /* Flat default. */ }
    const credits = (() => { try { return String(this.mapController.getAttributionText?.() || "").replace(/\s+/g, " ").slice(0, 220); } catch { return ""; } })();
    return {
      palette,
      logo,
      heading,
      center: Number.isFinite(latitude) ? { longitude, latitude } : null,
      centerUrl: Number.isFinite(latitude) ? locationUrl(location.href, { latitude, longitude }) : null,
      date: new Date().toLocaleString(),
      credits,
      layers: this.mapController.getAllLayerConfigs().filter((config) => config.visible !== false).map((config) => ({ title: config.title || "Layer" })),
      legend: (() => { try { return this.mapController.getLegendData?.() || []; } catch { return []; } })(),
    };
  }

  /** The live-map link and its QR code, rebuilt only when the link changes. */
  async #templateLink(palette) {
    const link = await this.#mapShareLink().catch(() => null);
    if (!link?.url) return { qr: null, linkUrl: null };
    if (this.templateQr?.url !== link.url) {
      let qr = null;
      if (link.qr && globalThis.QRCode?.toCanvas) {
        qr = document.createElement("canvas");
        await globalThis.QRCode.toCanvas(qr, link.url, { width: 600, margin: 1, errorCorrectionLevel: "L", color: { dark: palette.band, light: "#ffffff" } }).catch(() => { qr = null; });
      }
      this.templateQr = { url: link.url, qr };
    }
    return { qr: this.templateQr.qr, linkUrl: link.url };
  }

  /** The map shaped to a template's frame, with its ground width and extent when the view is flat. */
  async #templateCapture(aspect) {
    const shot = await this.mapController.captureImage({ format: "jpg", quality: 92, width: 2400, aspect });
    const image = shot?.dataUrl ? await loadImage(shot.dataUrl) : null;
    const size = this.mapController.getContainerSize();
    let tilt = 0;
    try { tilt = this.mapController.getCamera()?.tilt || 0; } catch { /* Flat default. */ }
    let groundWidth = null;
    let extent = null;
    if (size && tilt < 3) {
      const cropWidth = Math.min(size.width, size.height * aspect);
      const cropHeight = cropWidth / aspect;
      const left = (size.width - cropWidth) / 2;
      const top = (size.height - cropHeight) / 2;
      const west = this.mapController.screenToMap(left, size.height / 2);
      const east = this.mapController.screenToMap(left + cropWidth, size.height / 2);
      const north = this.mapController.screenToMap(size.width / 2, top);
      const south = this.mapController.screenToMap(size.width / 2, top + cropHeight);
      if (west && east) {
        const radians = Math.PI / 180;
        const lat = ((west[1] + east[1]) / 2) * radians;
        groundWidth = 6371008.8 * Math.abs(east[0] - west[0]) * radians * Math.cos(lat);
      }
      const heading = (() => { try { return Math.abs(this.mapController.getCamera()?.heading || 0); } catch { return 0; } })();
      if (west && east && north && south && (heading < 0.5 || heading > 359.5)) extent = { west: west[0], east: east[0], north: north[1], south: south[1] };
    }
    return { map: image, groundWidth, extent };
  }

  /** A template page as a one-page PDF: the page image plus its clickable areas. */
  /** Template pages as a PDF: each page image plus its clickable areas. */
  async #templatePdf(pages, name) {
    const list = Array.isArray(pages) ? pages : [pages];
    const { template } = list[0];
    const width = template.page.width * 72;
    const height = template.page.height * 72;
    const pdf = new PdfDocument({ header: false, homeUrl: null, pageWidth: width, pageHeight: height, margin: 0 });
    for (const [index, { canvas, links }] of list.entries()) {
      if (index) pdf.newPage();
      const asset = await imageToJpeg(canvas.toDataURL("image/png"), { width: canvas.width, height: canvas.height, quality: 0.9 });
      pdf.addImageAt(asset, { x: 0, y: height, width, height });
      const scale = 72 / (canvas.width / template.page.width);
      for (const link of links) pdf.addLink([link.x * scale, height - (link.y + link.h) * scale, (link.x + link.w) * scale, height - link.y * scale], link.url);
    }
    return new File([pdf.toBlob()], name, { type: "application/pdf" });
  }

  /** One rendered page per bookmark; the map visits each and then returns to where it was. */
  async #bookmarkPages(templateId, data, frame, status) {
    const bookmarks = (this.projectManager.current.bookmarks ?? []).filter((bookmark) => bookmark.viewpoint);
    if (!bookmarks.length) throw new Error("Add a bookmark first.");
    const base = await data();
    const previous = this.mapController.getViewState();
    const aspect = templateMapAspect(templateId, { compact: base.compact });
    const pages = [];
    try {
      for (const [index, bookmark] of bookmarks.entries()) {
        status.textContent = `Page ${index + 1} of ${bookmarks.length}: ${bookmark.name}`;
        await this.mapController.restoreView(bookmark.viewpoint);
        await new Promise((resolve) => setTimeout(resolve, 250));
        const shot = await this.#templateCapture(aspect);
        const link = await this.#templateLink(base.palette);
        pages.push(renderTemplate(templateId, {
          ...base,
          ...shot,
          ...link,
          ...(frame.showQr === false ? { qr: null } : {}),
          title: bookmark.name || base.title,
          subtitle: bookmark.description || base.subtitle,
          center: (() => { const [longitude, latitude] = this.mapController.getViewState().center || []; return Number.isFinite(latitude) ? { longitude, latitude } : base.center; })(),
          centerUrl: (() => { const [longitude, latitude] = this.mapController.getViewState().center || []; return Number.isFinite(latitude) ? locationUrl(location.href, { latitude, longitude }) : base.centerUrl; })(),
        }, { ppi: this.#templatePpi(templateId, 150), frame }));
      }
    } finally {
      await this.mapController.restoreView(previous).catch(() => {});
      status.textContent = `${pages.length} bookmark page${pages.length === 1 ? "" : "s"} ready`;
    }
    return pages;
  }

  /** Print resolution, lowered for wall maps so a sheet stays under ~6000 px on its long side. */
  #templatePpi(templateId, ppi) {
    const sheet = getTemplate(templateId).page;
    return Math.min(ppi, 6000 / Math.max(sheet.width, sheet.height));
  }

  #fileStem() {
    return (this.projectManager.current.name || "map").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "map";
  }

  #download(file) {
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(file);
    anchor.download = file.name;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(anchor.href), 1000);
  }

  async #downloadMapPdf() {
    this.toast("Making the map PDF…");
    const link = await this.#mapShareLink().catch(() => null);
    const file = await this.#mapPdfFile(link);
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(file);
    anchor.download = file.name;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(anchor.href), 1000);
  }

  /** A landscape, skin-coloured PDF of the current view with a layer key and a QR back to the live map. */
  async #mapPdfFile(link = null) {
    const skin = document.documentElement.dataset.skin || this.projectManager.current.presentation?.skin;
    const palette = printPalette(skin);
    const title = this.projectManager.current.name || "Map";
    const now = new Date();
    const [shot] = await this.mapController.captureViews([null], { aspect: 1.45 });
    const framed = shot ? await brandedMapImage(shot, { title, subtitle: `${now.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })} · ${this.#basemapLabel(this.mapController.getBasemapId())}`, palette }) : null;
    const pdf = new PdfDocument({ heading: title.toUpperCase(), logo: await loadBrandLogo(palette), palette, pageWidth: 792, pageHeight: 612 });
    const column = { x: 548, width: 196 };
    if (framed) pdf.addImageAt(framed, { x: 48, y: pdf.top + 12, width: 484, height: pdf.top - 34, link: link?.url || null });
    let y = pdf.addTextAt("Layers", { x: column.x, y: pdf.top, width: column.width, size: 12, bold: true, color: pdf.colors.accent });
    const styleLabel = (renderer) => {
      const field = renderer?.field1 || renderer?.field;
      return ({ simple: "Single symbol", uniqueValue: field ? `Categories by ${field}` : "Categories", classBreaks: field ? `Classes by ${field}` : "Graduated classes", heatmap: "Heat map" })[renderer?.type] || "";
    };
    for (const config of this.mapController.getAllLayerConfigs().filter((item) => item.visible !== false).slice(0, 10)) {
      y = pdf.addTextAt(config.title || "Layer", { x: column.x, y: y - 4, width: column.width, size: 9.5, bold: true });
      const details = [styleLabel(config.renderer), hasDataFilter(config.definitionExpression) && `Filter: ${config.definitionExpression}`, config.local && "From a local file"].filter(Boolean).join(" · ");
      if (details) y = pdf.addTextAt(details, { x: column.x, y: y + 2, width: column.width, size: 7.5, leading: 10, color: "0.36 0.44 0.41" });
    }
    const [longitude, latitude] = this.mapController.getViewState().center || [];
    const center = Number.isFinite(latitude) ? { longitude, latitude } : null;
    if (center) {
      y = pdf.addTextAt("Centre", { x: column.x, y: y - 8, width: column.width, size: 9.5, bold: true });
      y = pdf.addTextAt(`${center.latitude.toFixed(5)}, ${center.longitude.toFixed(5)}`, { x: column.x, y: y + 2, width: column.width, size: 8.5, link: locationUrl(location.href, { latitude: center.latitude, longitude: center.longitude }) });
    }
    if (link?.url) {
      const code = link.qr ? await qrAsset(link.url, { dark: palette.band }).catch(() => null) : null;
      if (code) pdf.addImageAt(code, { x: column.x, y: 196, width: 120, height: 120, link: link.url });
      pdf.addTextAt("Open the live map", { x: column.x, y: code ? 64 : 120, width: column.width, size: 10, bold: true, link: link.url });
    }
    pdf.addTextAt(`Made with GISMap Online · ${now.toLocaleString()}`, { x: 48, y: 22, width: 400, size: 7.5, color: "0.36 0.44 0.41", bottom: 0 });
    pdf.addSiteLink(22);
    const stem = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "map";
    return new File([pdf.toBlob()], `${stem}-map.pdf`, { type: "application/pdf" });
  }

  /**
   * Turns a layer into a briefing: the layer (with its current style and filter)
   * becomes the briefing's data, and an empty briefing gets a title slide at the
   * current view plus a key-numbers slide, ready to edit and share.
   */
  createBriefingFromLayer(uid, { featureIds = [], title: givenTitle = "", features = [], actions = [] } = {}) {
    const layer = this.mapController.getLayer(uid);
    if (!layer) throw new Error("That layer is no longer on the map.");
    const current = this.projectManager.current.presentation || {};
    const title = givenTitle || `${layer.title || "Feature"} briefing`;
    const fresh = Boolean(givenTitle) || !(current.briefing?.slides?.length && current.primaryLayerId === uid);
    let briefing = fresh ? { slides: [] } : current.briefing;
    if (!briefing.slides.length) {
      const view = this.mapController.getViewState();
      const camera = view.center ? { center: view.center, zoom: view.zoom, heading: view.heading, tilt: view.tilt } : null;
      briefing = { ...briefing, slides: [
        createSlide("title", { title, camera }),
        { ...createSlide("key-numbers", { title: "At a glance" }), blocks: [{ type: "stat", stat: "count", label: `${layer.title || "Features"}` }] },
        // Features handed over (from a field task) get a slide each; their facts fill in from the data.
        ...features.filter((feature) => feature.id != null).map((feature) => createSlide("feature", { title: feature.label || `Feature ${feature.id}`, featureId: String(feature.id) })),
        ...(actions.length ? [{ ...createSlide("actions", { title: "Next steps" }), blocks: [{ type: "list", items: actions.slice(0, 12) }] }] : []),
      ] };
    }
    this.briefingTab = "slides";
    this.projectManager.setPresentation({
      ...current,
      template: "briefing",
      title,
      modeTitles: { ...(current.modeTitles || {}), briefing: fresh ? title : current.modeTitles?.briefing || title },
      primaryLayerId: uid,
      briefing,
      briefingSelection: { layerId: uid, ids: featureIds.map(String), useAll: false },
    });
    this.#setSidebarCollapsed(false);
    this.events.publish("mobile:workflow-route", { route: "briefing" });
    this.toast(featureIds.length ? `Briefing started with ${featureIds.length} feature${featureIds.length === 1 ? "" : "s"}. Add them as slides in the Slides tab.` : "Briefing created. Edit the slides, then Share.");
  }

  /**
   * One click from a styled map to a briefing: opens Briefing on the layer, builds
   * slides from its style, filter, Features-tab filters and included features
   * (generateBriefing), lets AI write descriptions when it is configured, and
   * optionally opens the share dialog.
   */
  async generateBriefingFromView({ uid = null, share = false, useAi = this.aiController.isConfigured(), confirmReplace = true } = {}) {
    try {
      const current = this.projectManager.current.presentation || {};
      const queryable = (item) => item && item.queryable;
      const layer = [this.mapController.getLayer(uid), this.mapController.getLayer(this.presentationState.layerUid), this.mapController.getLayer(current.primaryLayerId), ...this.mapController.getLayers()].find(queryable);
      if (!layer) throw new Error("Add a feature layer to make a briefing from.");
      const existing = current.briefing?.slides?.length && current.primaryLayerId === layer.uid ? current.briefing.slides.length : 0;
      if (existing && confirmReplace && !confirm(`Replace the ${existing} slide${existing === 1 ? "" : "s"} in this briefing with new ones made from the map?`)) return;
      // Open the briefing on this layer and wait for its features.
      if (this.presentationState.template !== "briefing" || this.presentationState.layerUid !== layer.uid) {
        this.briefingTab = "slides";
        this.projectManager.setPresentation({ ...current, template: "briefing", primaryLayerId: layer.uid, title: current.primaryLayerId === layer.uid ? current.modeTitles?.briefing || "" : "" });
        this.#setSidebarCollapsed(false);
        this.events.publish("mobile:workflow-route", { route: "briefing" });
        await this.presentationLoading;
      }
      const state = this.presentationState;
      const fields = this.#presentationFields(layer);
      const conditions = this.#briefingConditionFilter();
      const narrowed = Boolean(conditions || state.search || state.scope === "extent");
      const records = narrowed ? state.visibleRecords : state.records;
      const config = this.mapController.getLayerConfig(layer);
      const alias = (name) => fields.fields.find((field) => field.name === name)?.alias || name;
      const kindOf = (name) => fieldKind(fields.fields.find((field) => field.name === name));
      const labels = (state.conditions || []).filter((item) => conditionComplete(item, kindOf(item.field))).map((item) => conditionLabel(item, kindOf(item.field), alias(item.field)));
      const scopeText = [
        labels.join(state.conditionLogic === "or" ? " or " : " and "),
        state.scope === "extent" ? "in the map view" : "",
      ].filter(Boolean).join(" and ");
      // "In view" has no attribute filter to replay, so the view's features are carried by ID.
      const inView = state.scope === "extent" ? { op: "feature_ids", ids: records.map((record) => featureId(record, layer.objectIdField)).filter(Boolean).slice(0, 2000) } : null;
      const scope = inView && conditions ? { op: "and", args: [conditions, inView] } : inView || conditions;
      const view = this.mapController.getViewState();
      const theme = rendererTheme(config.renderer);
      const title = `${layer.title || "Feature"}${theme.field ? ` by ${alias(theme.field)}` : ""}`;
      const briefing = generateBriefing({
        layerTitle: layer.title || "Features",
        title,
        where: config.definitionExpression,
        renderer: config.renderer,
        url: config.local ? "" : config.url,
        records,
        total: narrowed ? records.length : state.totalCount,
        fields: fields.fields,
        idField: layer.objectIdField,
        label: (record) => this.#recordLabel(record, fields),
        camera: view.center ? { center: view.center, zoom: view.zoom, heading: view.heading, tilt: view.tilt } : null,
        selectedIds: state.briefingUseAll ? [] : [...state.selectedIds],
        scope,
        scopeText,
      });
      this.briefingTab = "slides";
      // The document records what it is about, portably: the layer's URL and the chosen features.
      briefing.layerId = briefingLayerRef(this.mapController, layer);
      briefing.selection = { ids: [...state.selectedIds], useAll: state.briefingUseAll === true };
      this.projectManager.patchPresentation({ briefing, title, modeTitles: { ...(this.projectManager.current.presentation?.modeTitles || {}), briefing: title } });
      this.#renderPresentationDashboard(this.projectManager.current.presentation);
      this.toast(`Briefing made: ${briefing.slides.length} slides from the map's ${theme.field ? "style, " : ""}filters and features.`);
      if (useAi) await this.#describeBriefingWithAi({ quietFailure: true });
      if (share) await this.shareBriefing();
    } catch (error) {
      this.error(error.message);
    }
  }

  /** Asks the configured AI for short descriptions of the briefing's opening and feature slides. */
  async #describeBriefingWithAi({ quietFailure = false } = {}) {
    if (!this.aiController.isConfigured()) return this.error("Configure an AI provider from Tools first.");
    const presentation = this.projectManager.current.presentation || {};
    const layer = this.mapController.getLayer(this.presentationState.layerUid);
    if (!layer || !presentation.briefing?.slides?.length) return;
    const fields = this.#presentationFields(layer);
    const byId = new Map(this.presentationState.records.map((record) => [featureId(record, layer.objectIdField), record]));
    const records = Object.fromEntries(presentation.briefing.slides.filter((slide) => slide.featureId && byId.has(slide.featureId)).map((slide) => [slide.id, byId.get(slide.featureId)]));
    const config = this.mapController.getLayerConfig(layer);
    const theme = rendererTheme(config.renderer);
    const alias = (name) => fields.fields.find((field) => field.name === name)?.alias || name;
    this.toast("Writing slide descriptions with AI…");
    try {
      const text = await this.aiController.ask(aiDescriptionPrompt({ briefing: presentation.briefing, layerTitle: layer.title || "Features", filterText: describeWhere(config.definitionExpression, alias), themeField: theme.field ? alias(theme.field) : "", records }), { selectedResults: Object.values(records).slice(0, 12) }, { quiet: true });
      const descriptions = readAiDescriptions(text);
      if (!descriptions) throw new Error("The AI answer could not be read as slide text.");
      this.projectManager.patchPresentation({ briefing: applyAiDescriptions(this.projectManager.current.presentation.briefing, descriptions) });
      this.#renderPresentationDashboard(this.projectManager.current.presentation);
      this.toast(`AI wrote ${Object.keys(descriptions.features).length + (descriptions.summary ? 1 : 0)} slide descriptions. Check them before sharing.`);
    } catch (error) {
      if (quietFailure) this.toast(`AI descriptions skipped: ${error.message}`);
      else this.error(error.message);
    }
  }

  /** Opens Tours with the current view saved as a chapter. */
  async #startTourHere() {
    this.#openGuidedTours();
    await this.#captureAtlasChapter();
  }

  /**
   * Adds places as tour chapters and opens Tours: from a field task's places,
   * a briefing's features, or anything else with coordinates.
   * `places` are { title, body, latitude, longitude, zoom, address }.
   */
  /** Opens the Map assistant in the right panel. */
  openAssistant() {
    const pane = document.querySelector("#utility-assistant-content");
    if (!pane) return;
    if (this.assistant.host !== pane) this.assistant.mount(pane);
    this.utilityAssistantOpen = true;
    this.#syncUtilityPanel("assistant");
    requestAnimationFrame(() => pane.querySelector("[data-assistant-input]")?.focus());
  }

  /** What the Map assistant's tools reach in the app (see map-assistant.js createAssistantTools). */
  #assistantHost() {
    return {
      api: globalThis.gisMapOnline,
      catalog: POPULAR_SERVICES,
      setBasemap: (id) => this.mapController.setBasemap(id),
      getDisplaySettings: () => this.#readDisplaySettings(),
      setDisplaySetting: (key, value) => {
        const settings = { ...this.#readDisplaySettings(), [key]: value };
        localStorage.setItem(DISPLAY_SETTINGS_KEY, JSON.stringify(settings));
        this.#applyDisplaySettings(settings);
      },
      setMode: (mode) => document.querySelector(`[data-mobile-workflow="${mode}"]`)?.click(),
      setSkin: (skin) => this.applySkinChoice(skin),
      createInstantDashboard: async ({ layer: layerInfo, title, skin, basemap, chartTheme = "auto" }) => {
        const layer = this.mapController.getLayer(layerInfo.id);
        if (!layer?.queryable) throw Object.assign(new Error(`The layer “${layerInfo.title || layerInfo.id}” cannot be charted.`), { hint: "Choose a loaded feature layer with attributes." });
        const fields = layer.fields || [];
        const category = fields.find((field) => /string|guid|oid/i.test(String(field.type || "")) && field.name !== layer.objectIdField);
        const numeric = fields.find((field) => /integer|double|single|number|decimal|float/i.test(String(field.type || "")));
        const type = category ? "bar" : "histogram";
        const chart = createChartSpec({
          title: String(title || `${layer.title || "Map data"} dashboard`).slice(0, 160),
          type,
          source: { layerId: layer.uid, scope: "filtered" },
          dimension: category?.name || null,
          measure: { field: numeric?.name || null, aggregation: numeric ? "sum" : "count" },
          presentation: { target: "dashboard", targets: ["panel", "dashboard"], placement: "bottom", size: "regular" },
          interaction: { mapHighlight: true, crossFilter: true },
          // Colours follow the layer's map style; the look follows the skin unless asked.
          style: { palette: "inherit", theme: chartTheme },
        });
        this.applySkinChoice(skin);
        this.mapController.setBasemap(basemap);
        this.projectManager.setCharts?.([...(this.projectManager.current.charts || []), chart]);
        await this.applicationRuntime.runTool("application.chart.create", {
          title: chart.title,
          region: "bottom",
          binding: { layerId: layer.uid, followActiveLayer: false },
          settings: { chart },
          skin,
        });
        return {
          dashboard: chart.title,
          layer: layer.title || layer.uid,
          chart: { type, dimension: category?.name || null, measure: numeric?.name || null, aggregation: numeric ? "sum" : "count", theme: chart.style.theme },
          skin,
          basemap,
          interaction: "Click a chart mark to filter and select matching map features.",
        };
      },
      saveProject: (name) => { this.projectManager.save(name); return this.projectManager.current.name; },
      openShareMenu: () => this.#shareExportDialog(),
      createMapEmbed: async ({ title, height } = {}) => {
        const shared = await this.#mapShareLink();
        const embedTitle = String(title || this.projectManager.current.name || "GISMap Online map").slice(0, 160);
        return {
          url: createEmbedUrl(shared.url, { kind: "map" }),
          iframe: createEmbedIframe(shared.url, { kind: "map", title: embedTitle, height }),
          fitsQrCode: shared.qr,
          note: "Only public web layers are included. Local data and URLs with credentials are excluded from an embed.",
        };
      },
      download: async (format) => {
        if (format === "pdf") return this.#downloadMapPdf();
        if (format === "smart-image") return this.projectManager.exportSmartImage();
        if (format === "gisx") return this.projectManager.exportPackage();
        return this.projectManager.exportJson();
      },
      createTour: (places, options) => this.createTourFromPlaces(places, { ...options, open: true }),
      draftFieldTask: (draft) => this.fieldTasks?.newTaskFrom(draft),
      presentBriefing: async () => {
        const api = globalThis.gisMapOnline;
        await api.briefing.load(api.briefing.get(), { present: true }).ready;
      },
      // Features read for the model: object ID, a point, and the asked-for fields (plus the display field).
      queryFeatures: async (ref, { where, fields = [], orderBy, limit = 10 } = {}) => {
        const info = globalThis.gisMapOnline.layers.get(String(ref));
        let layer = info && this.mapController.getLayer(info.id);
        if (!layer?.queryable) throw Object.assign(new Error(`No queryable layer on the map matches "${ref}".`), { hint: "Add the layer first, or use a layer id from get_map_state." });
        layer = await this.mapController.loadLayer(layer.uid);
        const known = new Set((layer.fields || []).map((field) => field.name));
        const missing = fields.filter((name) => !known.has(name));
        if (missing.length) throw Object.assign(new Error(`Unknown field${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}.`), { code: "FIELD_NOT_FOUND", hint: `Fields: ${[...known].slice(0, 60).join(", ")}` });
        const outFields = [...new Set([layer.objectIdField, layer.displayField, ...fields].filter(Boolean))];
        const { features = [] } = await this.mapController.queryFeatures(layer.uid, { where: [layer.where, where].filter(Boolean).map((part) => `(${part})`).join(" AND ") || "1=1", outFields, returnGeometry: true, num: limit, ...(orderBy ? { orderByFields: [orderBy] } : {}) });
        return features.map((feature) => {
          const point = this.mapController.geographicCoordinates(feature.geometry);
          return { objectId: feature.attributes?.[layer.objectIdField], ...(point ? { longitude: Number(point.longitude.toFixed(5)), latitude: Number(point.latitude.toFixed(5)) } : {}), attributes: Object.fromEntries(outFields.map((name) => [name, feature.attributes?.[name]])) };
        });
      },
      // A feature by object ID, as a field task's place: its layer URL and a point on it.
      featurePlace: async (ref, objectId, label = "") => {
        const info = globalThis.gisMapOnline.layers.get(String(ref));
        const layer = info && this.mapController.getLayer(info.id);
        if (!layer?.queryable) throw Object.assign(new Error(`No queryable layer on the map matches "${ref}".`), { hint: "Use a layer id from get_map_state." });
        const [feature] = (await this.mapController.queryFeatures(layer.uid, { objectIds: [Number.isFinite(Number(objectId)) ? Number(objectId) : objectId], outFields: ["*"], returnGeometry: true })).features;
        if (!feature) throw Object.assign(new Error(`Feature ${objectId} was not found in ${info.title}.`), { hint: "Use an object ID from the layer." });
        const point = this.mapController.geographicCoordinates(feature.geometry);
        const name = label || feature.attributes?.[layer.displayField] || `${info.title} ${objectId}`;
        return { layerUrl: info.url, objectId: feature.attributes?.[layer.objectIdField] ?? objectId, latitude: point?.latitude, longitude: point?.longitude, label: String(name).slice(0, 80) };
      },
    };
  }

  /** Tools › Cartography Lab: colour, 3D height and filter for one layer, saved as reusable layer styles. */
  openCartographyLab(uid = null) {
    this.cartographyLab ??= new CartographyLab({
      mapController: this.mapController,
      layers: globalThis.gisMapOnline.layers,
      camera: globalThis.gisMapOnline.camera,
      layerStyles: this.layerStyles,
      filterMemory: (this.filterConditions ??= new Map()),
      toast: (message) => this.toast(message),
      error: (message) => this.error(message),
      getBriefing: () => this.projectManager.current.presentation?.briefing || null,
      openBriefing: (briefing) => this.openBriefingDocument(briefing),
      createTour: (places, options) => this.createTourFromPlaces(places, options),
    });
    this.cartographyLabOpen = true;
    this.#closeMenus();
    this.cartographyLab.render(document.querySelector("#utility-lab-content"), uid);
    this.#syncUtilityPanel("lab");
  }

  /** Standard dialog for moving and sizing a saved chart panel. */
  #openChartPanelSettings(instanceId) {
    const config = this.applicationRuntime.snapshot();
    const panel = config.panels.find((item) => item.instanceId === instanceId && item.type === "charts");
    if (!panel) return;
    const placement = panel.placement.region === "floating" ? "floating-top" : panel.placement.region;
    const initialSize = panel.placement.size?.height <= 240 ? "compact" : panel.placement.size?.height >= 380 ? "expanded" : "regular";
    const sizeFor = (size) => size === "compact" ? { width: 360, height: 220 } : size === "expanded" ? { width: 620, height: 420 } : { width: 460, height: 300 };
    const chart = panel.settings?.chart ? createChartSpec(panel.settings.chart) : null;
    const style = chart?.style || null;
    this.openDialog({
      eyebrow: "Chart panel",
      title: "Chart panel settings",
      content: `<section class="chart-panel-settings"><p class="form-note">Choose where this chart sits in the workspace. Top overlay panels can be dragged and resized directly on the map.</p><div class="field-grid"><label class="field"><span>Placement</span><select data-chart-panel-placement><option value="right"${placement === "right" ? " selected" : ""}>Right side</option><option value="left"${placement === "left" ? " selected" : ""}>Left side</option><option value="bottom"${placement === "bottom" ? " selected" : ""}>Bottom strip</option><option value="floating-top"${placement === "floating-top" ? " selected" : ""}>Top overlay</option></select></label><label class="field"><span>Panel size</span><select data-chart-panel-size><option value="compact"${initialSize === "compact" ? " selected" : ""}>Compact</option><option value="regular"${initialSize === "regular" ? " selected" : ""}>Regular</option><option value="expanded"${initialSize === "expanded" ? " selected" : ""}>Expanded</option></select></label>${style ? `<label class="field"><span>Look</span><select data-chart-panel-theme><option value="auto"${style.theme === "auto" ? " selected" : ""}>Match the skin</option><option value="standard"${style.theme === "standard" ? " selected" : ""}>Standard</option><option value="futuristic"${style.theme === "futuristic" ? " selected" : ""}>Futuristic HUD</option></select></label><label class="field"><span>Colours</span><select data-chart-panel-palette><option value="inherit"${style.palette === "inherit" ? " selected" : ""}>Match the map style</option><option value="theme"${style.palette === "theme" ? " selected" : ""}>Dashboard skin</option><option value="neon"${style.palette === "neon" ? " selected" : ""}>Neon</option></select></label>` : ""}</div>${style ? `<p class="form-note">“Match the map style” uses the layer's own category colours or colour ramp, so the chart and the map read the same way. Top N, Other and hidden categories are set on the chart itself.</p>` : ""}</section>`,
      actions: [
        { label: "Cancel", handler: () => this.dialog.close() },
        { label: "Apply", primary: true, handler: async () => {
          const nextPlacement = this.dialog.querySelector("[data-chart-panel-placement]").value;
          const size = sizeFor(this.dialog.querySelector("[data-chart-panel-size]").value);
          const region = nextPlacement === "floating-top" ? "floating" : nextPlacement;
          const position = nextPlacement === "floating-top"
            ? { x: Math.max(16, Math.round((window.innerWidth - size.width) / 2)), y: 76 }
            : panel.placement.position;
          await this.applicationRuntime.runTool("application.layout.change", {
            instanceId,
            placement: { region, size, ...(position ? { position } : {}) },
            ...(region === "bottom" ? { layout: { bottomHeight: size.height } } : {}),
          });
          if (chart) {
            const theme = this.dialog.querySelector("[data-chart-panel-theme]")?.value || style.theme;
            const palette = this.dialog.querySelector("[data-chart-panel-palette]")?.value || style.palette;
            if (theme !== style.theme || palette !== style.palette) {
              const next = createChartSpec({ ...chart, style: { ...style, theme, palette } });
              const latest = this.applicationRuntime.snapshot().panels.find((item) => item.instanceId === instanceId);
              await this.applicationRuntime.runTool("application.panel.configure", { instanceId, changes: { settings: { ...(latest?.settings || panel.settings), chart: next } } });
              const charts = this.projectManager.current.charts || [];
              if (charts.some((item) => item.id === next.id)) this.projectManager.setCharts?.(charts.map((item) => item.id === next.id ? next : item));
            }
          }
          this.dialog.close();
          this.toast("Chart panel settings applied.");
        } },
      ],
    });
  }

  /** Tools › Chart tools: one layer-aware builder with family presets. */
  async #openChartsAnalytics({ family = "custom", layerUid = null } = {}) {
    const layers = this.mapController.getLayers().filter((layer) => layer.queryable);
    if (!layers.length) {
      this.#openChartDataStarter({ family });
      return;
    }
    // A layer card's Chart button charts that layer; the Tools menu charts the active one.
    let layer = (layerUid && this.mapController.getLayer(layerUid)) || this.mapController.getLayer(this.applicationRuntime?.state?.value?.activeLayerId) || layers[0];
    if (!layer.queryable) layer = layers[0];
    let fields = [];
    let spec = null;
    let result = null;
    let chartInstance = null;
    let chartFilter = null;
    let request = 0;

    const choice = (items, selected, empty = "Choose a field") => `<option value="">${empty}</option>${items.map((field) => `<option value="${escapeHtml(field.name)}"${field.name === selected ? " selected" : ""}>${escapeHtml(field.alias || field.name)} (${escapeHtml(field.name)})</option>`).join("")}`;
    const selectedValue = (name) => this.dialog.querySelector(`[data-chart-${name}]`)?.value || "";
    const selectedValues = (name) => [...(this.dialog.querySelector(`[data-chart-${name}]`)?.selectedOptions || [])].map((option) => option.value).filter(Boolean);
    const selectedTargets = () => [...this.dialog.querySelectorAll("[data-chart-target]:checked")].map((control) => control.value);
    const destinationName = (target) => target === "panel" ? "chart panel" : target === "dashboard" ? "Instant Dashboard" : target === "map" ? "map" : "Brief";
    const primaryActionLabel = (targets) => {
      if (targets.includes("panel")) {
        const additional = targets.length - 1;
        return additional ? `Add chart panel + ${additional} more` : "Add chart panel to site";
      }
      if (targets.length === 1) return `Add chart to ${destinationName(targets[0])}`;
      return targets.length ? `Add chart to ${targets.length} destinations` : "Choose a destination";
    };
    const syncPrimaryAction = () => {
      const targets = selectedTargets();
      const button = this.dialog.querySelector("[data-chart-add]");
      if (button) {
        button.textContent = primaryActionLabel(targets);
        button.disabled = !targets.length;
      }
    };
    const chartFilterWhere = () => {
      if (!chartFilter?.conditions?.length) return null;
      try { return conditionsToWhere(chartFilter.conditions, chartFilter.logic, fields); }
      catch { return null; }
    };
    const currentSpec = () => {
      const where = chartFilterWhere();
      return createChartSpec({
        id: spec?.id,
        title: selectedValue("title") || `${layer.title || "Layer"} chart`,
        type: selectedValue("type") || spec?.type || "bar",
        preset: spec?.preset,
        source: { layerId: layer.uid, scope: selectedValue("scope") || "filtered", ...(chartFilter ? { filter: chartFilter, ...(where ? { where } : {}) } : {}) },
        dimension: selectedValue("dimension") || null,
        measure: { field: selectedValue("measure") || null, aggregation: selectedValue("aggregation") || "count" },
        encoding: { sizeField: selectedValue("size") || null, mapFields: selectedValues("map-fields") },
        presentation: {
          target: selectedTargets()[0] || spec?.presentation?.target || "panel",
          targets: selectedTargets(),
          renderMode: selectedValue("render-mode") || spec?.presentation?.renderMode || "standard",
          size: selectedValue("presentation-size") || spec?.presentation?.size || "regular",
          anchor: selectedValue("anchor") || spec?.presentation?.anchor || "feature",
          collision: selectedValue("collision") || spec?.presentation?.collision || "hide-overlap",
          display: selectedValue("display") || spec?.presentation?.display || "progressive",
          placement: selectedValue("placement") || spec?.presentation?.placement || "right",
        },
        interaction: { mapHighlight: true },
      });
    };
    const render = () => {
      if (chartFilter == null && spec?.source?.filter) chartFilter = structuredClone(spec.source.filter);
      const roles = chartFields(fields);
      const recommendations = recommendCharts(fields, { family });
      const gallery = recommendations.length ? recommendations : family === "3d" ? [{ preset: "bar-3d", type: "bar3d", dimension: roles.categoricalFields[0]?.name || roles.temporalFields[0]?.name || "", measure: roles.numericFields[0]?.name || "", aggregation: "sum", label: "3D category comparison", description: "An analytical isometric chart in the panel." }, { preset: "spatial-3d", type: "bar", label: "Geographic spatial 3D", description: "Extrude actual polygons and features in Cartography Lab.", spatial: true }] : [{ preset: "custom", type: "bar", label: "Start from this layer", description: "Choose the chart type and fields below." }];
      const type = spec?.type || recommendations[0]?.type || "bar";
      const dimension = spec?.dimension?.field || recommendations[0]?.dimension || roles.categoricalFields[0]?.name || roles.temporalFields[0]?.name || "";
      const measure = spec?.measure?.field || recommendations[0]?.measure || roles.numericFields[0]?.name || "";
      const size = spec?.encoding?.sizeField || recommendations[0]?.size || "";
      const mapFields = spec?.encoding?.mapFields || [measure, ...roles.numericFields.map((field) => field.name).filter((field) => field !== measure)].filter(Boolean).slice(0, 4);
      const aggregation = spec?.measure?.aggregation || recommendations[0]?.aggregation || "count";
      const targets = new Set(spec?.presentation?.targets || (family === "map" ? ["map"] : ["panel"]));
      const presentation = spec?.presentation || {};
      const chartFilterOpen = Boolean(chartFilter?.conditions?.length);
      const galleryLabel = family === "custom" ? "Data-aware starters" : `${family.replaceAll("-", " ")} presets`;
      this.openDialog({
        eyebrow: "Chart tools",
        title: family === "custom" ? "Custom Chart Builder" : "Chart Builder",
        content: `<div class="chart-builder">
          <section class="chart-builder__gallery" aria-label="Chart gallery">
            <div><span class="eyebrow">${escapeHtml(galleryLabel)}</span><p>Choose a starting point. The same builder keeps the data query and saved chart definition consistent.</p></div>
            <div class="chart-builder__gallery-grid">${gallery.map((item, index) => `<button type="button" class="chart-gallery-card" data-chart-suggestion="${index}"${item.spatial ? " data-chart-spatial=\"true\"" : ""}><span class="chart-gallery-card__glyph chart-gallery-card__glyph--${escapeHtml(item.type)}" aria-hidden="true"></span><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.description || "")}</small></button>`).join("")}</div>
          </section>
          <div class="chart-builder__controls">
            <label class="field"><span>Source layer</span><select data-chart-layer>${layers.map((item) => `<option value="${escapeHtml(item.uid)}"${item.uid === layer.uid ? " selected" : ""}>${escapeHtml(item.title || "Untitled layer")}</option>`).join("")}</select></label>
            <label class="field"><span>Chart type</span><select data-chart-type>${CHART_TYPES.map((entry) => `<option value="${entry.id}"${entry.id === type ? " selected" : ""}>${entry.label}</option>`).join("")}</select></label>
            <label class="field"><span>Group by</span><select data-chart-dimension>${choice(roles.analysisFields, dimension, "No grouping (metric)")}</select></label>
            <label class="field"><span>Aggregation</span><select data-chart-aggregation>${["count", "sum", "avg", "min", "max"].map((item) => `<option value="${item}"${item === aggregation ? " selected" : ""}>${item === "avg" ? "Average" : item[0].toUpperCase() + item.slice(1)}</option>`).join("")}</select></label>
            <label class="field"><span>Value field</span><select data-chart-measure>${choice(roles.numericFields, measure, aggregation === "count" ? "No field needed for count" : "Choose a numeric field")}</select></label>
            <label class="field"><span>Data scope</span><select data-chart-scope><option value="filtered"${(spec?.source?.scope || "filtered") === "filtered" ? " selected" : ""}>Current layer filters</option><option value="all"${spec?.source?.scope === "all" ? " selected" : ""}>All source records</option><option value="viewport"${spec?.source?.scope === "viewport" ? " selected" : ""}>Features in map extent</option></select></label>
            <label class="field chart-builder__title"><span>Chart title</span><input data-chart-title value="${escapeHtml(spec?.title || `${layer.title || "Layer"} chart`)}" /></label>
          </div>
          <details class="chart-builder__filter"${chartFilterOpen ? " open" : ""}><summary>Filter chart data <span>Optional</span></summary><p class="form-note">Narrow this chart without changing the map. When using Current layer filters, both the layer filter and this chart filter apply.</p><div data-chart-filter-builder></div></details>
          <fieldset class="chart-builder__targets"><legend>Where should this chart appear?</legend><p class="form-note">Choose one or more destinations. “Chart panel” adds this interactive chart to the current site.</p>${PRESENTATION_TARGETS.map((target) => `<label><input type="checkbox" data-chart-target value="${target}"${targets.has(target) ? " checked" : ""}> ${target === "panel" ? "Chart panel on this site" : target === "dashboard" ? "Instant Dashboard" : target === "map" ? "On the map" : "Brief slide"}</label>`).join("")}</fieldset>
          <details class="chart-builder__advanced"><summary>Advanced settings</summary><div class="chart-builder__controls">
            <label class="field"><span>Bubble size</span><select data-chart-size>${choice(roles.numericFields, size, "No size encoding")}</select></label>
            <label class="field"><span>Map measures <small>2–4 fields when available</small></span><select data-chart-map-fields multiple size="3">${roles.numericFields.map((field) => `<option value="${escapeHtml(field.name)}"${mapFields.includes(field.name) ? " selected" : ""}>${escapeHtml(field.alias || field.name)}</option>`).join("")}</select></label>
            <label class="field"><span>Map glyph</span><select data-chart-render-mode><option value="standard"${(presentation.renderMode || "standard") === "standard" ? " selected" : ""}>Standard panel</option><option value="svg"${presentation.renderMode === "svg" ? " selected" : ""}>SVG mini chart</option><option value="html"${presentation.renderMode === "html" ? " selected" : ""}>HTML mini chart</option></select></label>
            <label class="field"><span>Map anchor</span><select data-chart-anchor>${[["feature", "Feature geometry"], ["point", "Point"], ["line-midpoint", "Line midpoint"], ["polygon-interior", "Polygon interior"], ["polygon-centroid", "Polygon centroid"]].map(([value, label]) => `<option value="${value}"${(presentation.anchor || "feature") === value ? " selected" : ""}>${label}</option>`).join("")}</select></label>
            <label class="field"><span>Map overlap</span><select data-chart-collision>${[["hide-overlap", "Hide overlap"], ["cluster", "Cluster"], ["reposition", "Reposition"]].map(([value, label]) => `<option value="${value}"${(presentation.collision || "hide-overlap") === value ? " selected" : ""}>${label}</option>`).join("")}</select></label>
            <label class="field"><span>Map display</span><select data-chart-display>${[["progressive", "Progressive"], ["all", "All features"], ["clustered", "Clustered"]].map(([value, label]) => `<option value="${value}"${(presentation.display || "progressive") === value ? " selected" : ""}>${label}</option>`).join("")}</select></label>
            <label class="field"><span>Chart panel placement</span><select data-chart-placement>${CHART_PANEL_PLACEMENTS.map((value) => `<option value="${value}"${(presentation.placement || "right") === value ? " selected" : ""}>${value === "right" ? "Right side" : value === "left" ? "Left side" : value === "bottom" ? "Bottom strip" : "Top overlay (movable)"}</option>`).join("")}</select></label>
            <label class="field"><span>Chart panel size</span><select data-chart-presentation-size>${[["compact", "Compact"], ["regular", "Regular"], ["expanded", "Expanded"]].map(([value, label]) => `<option value="${value}"${(presentation.size || "regular") === value ? " selected" : ""}>${label}</option>`).join("")}</select></label>
          </div><p class="form-note">Map charts anchor compact SVG bars, sparklines, and donuts to visible features. Conventional 3D charts stay in this panel; Spatial Charts remain the geographic 3D path.</p></details>
          <div class="chart-builder__preview" data-chart-preview><div class="chart-builder__empty"><strong>Loading chart…</strong><p>Using the selected layer and its active filter.</p></div></div>
          <p class="form-note" data-chart-coverage>Charts use the layer’s canonical current filter. Map navigation does not alter a filtered chart.</p>
        </div>`,
        actions: [
          { label: "Download CSV", handler: () => {
            if (!result?.rows?.length) return this.error("There is no chart data to export.");
            const link = document.createElement("a");
            link.href = URL.createObjectURL(new Blob([rowsAsCsv(result)], { type: "text/csv;charset=utf-8" }));
            link.download = `${(spec?.title || "chart").replace(/[^a-z0-9]+/gi, "-").replace(/(^-|-$)/g, "").toLowerCase() || "chart"}.csv`;
            link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000);
          } },
          { label: "Close", handler: () => this.dialog.close() },
          { label: primaryActionLabel([...targets]), primary: true, handler: async () => {
            spec = currentSpec();
            if (!result?.rows?.length) return this.error("Configure a chart with data before saving it.");
            const charts = this.projectManager.current.charts || [];
            this.projectManager.setCharts?.([...charts.filter((item) => item.id !== spec.id), spec]);
            // A chart panel is a first-class site panel. Dashboard remains a
            // compatible destination for existing saved chart definitions;
            // selecting both still creates one panel, never duplicates.
            if (spec.presentation.targets.some((target) => ["panel", "dashboard"].includes(target))) await this.applicationRuntime.runTool("application.chart.create", {
              title: spec.title,
              region: spec.presentation.placement === "floating-top" ? "floating" : spec.presentation.placement,
              size: spec.presentation.size === "compact" ? { width: 360, height: 220 } : spec.presentation.size === "expanded" ? { width: 620, height: 420 } : { width: 460, height: 300 },
              ...(spec.presentation.placement === "floating-top" ? { position: { x: Math.max(16, Math.round((window.innerWidth - (spec.presentation.size === "expanded" ? 620 : spec.presentation.size === "compact" ? 360 : 460)) / 2)), y: 76 } } : {}),
              binding: { layerId: layer.uid, followActiveLayer: false },
              settings: { chart: spec },
              // An embedded chart is content for the current workspace, not a
              // presentation preset. Keep the active interface skin intact.
              skin: document.documentElement.dataset.skin || this.projectManager.current.presentation?.skin,
            });
            this.dialog.close();
            const destinations = spec.presentation.targets.map(destinationName);
            this.toast(`Chart added to ${destinations.join(", ") || "this project"}.`);
          } },
        ],
      });
      const addButton = this.dialog.querySelector(".button--primary");
      addButton?.setAttribute("data-chart-add", "");
      syncPrimaryAction();
      createFilterBuilder({
        host: this.dialog.querySelector("[data-chart-filter-builder]"),
        fields: roles.analysisFields,
        conditions: chartFilter?.conditions || [],
        logic: chartFilter?.logic || "and",
        addLabel: "Add chart filter",
        valuesFor: async (name) => (await this.mapController.distinctValues(layer, name).catch(() => ({ values: [] }))).values || [],
        onChange: ({ conditions, logic }) => {
          chartFilter = conditions.length ? { conditions, logic } : null;
          void refresh();
        },
      });
      const refresh = async () => {
        const token = ++request;
        spec = currentSpec();
        const preview = this.dialog.querySelector("[data-chart-preview]");
        const coverage = this.dialog.querySelector("[data-chart-coverage]");
        preview.innerHTML = `<div class="chart-builder__empty"><strong>Updating chart…</strong><p>Aggregating the selected records.</p></div>`;
        try {
          result = await queryChart(this.mapController, layer, spec);
          if (token !== request || !this.dialog.open) return;
          const quality = result.quality;
          coverage.textContent = quality.status === "complete"
            ? `${quality.processedRecords.toLocaleString()} matching records · complete result${quality.excludedNullMeasures ? ` · ${quality.excludedNullMeasures} empty measures excluded` : ""}`
            : quality.warning || "This chart is based on a partial result.";
          const displayRows = displayChartRows(result);
          preview.innerHTML = `${renderChartFallback(result, { rows: displayRows })}<div class="chart-builder__selection" data-chart-selection aria-live="polite"></div>`;
          const fallback = preview.querySelector(".chart-fallback");
          const selectRow = (row) => {
            const records = result.selection(row);
            const ids = records.map((record) => record.attributes?.[result.layer.objectIdField]).filter((value) => value != null);
            this.applicationRuntime.state.dispatch("selection:set", { layerId: result.layer.uid, objectIds: ids, features: records.slice(0, 100).map((record) => ({ attributes: record.attributes || {}, geometry: record.geometry || null, layerTitle: result.layer.title })) }, { undoable: false });
            if (records[0]) void this.mapController.highlightFeature({ kind: "feature", layerUid: result.layer.uid, layerTitle: result.layer.title, attributes: records[0].attributes || {}, geometry: records[0].geometry || null }, { pulse: false });
            preview.querySelector("[data-chart-selection]").textContent = `${records.length.toLocaleString()} matching feature${records.length === 1 ? "" : "s"} selected on the map.`;
          };
          fallback?.querySelectorAll("[data-chart-row]").forEach((button) => {
            const select = () => selectRow(displayRows[Number(button.dataset.chartRow)]);
            button.addEventListener("click", select);
            button.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); select(); } });
          });
          try {
            const echarts = await loadECharts();
            if (token !== request || !this.dialog.open || !displayRows.length || ["kpi", "bar3d", "scatter3d"].includes(result.chart.type)) return;
            const canvas = document.createElement("div");
            canvas.className = "chart-builder__canvas";
            canvas.dataset.chartCanvas = "";
            if (result.chart.type === "bar") canvas.style.height = `${Math.max(300, displayRows.length * 30 + 54)}px`;
            preview.insertBefore(canvas, fallback);
            chartInstance?.dispose?.();
            chartInstance = echarts.init(canvas);
            chartInstance.setOption(chartOption(result, { rows: displayRows }));
            chartInstance.on("click", (event) => { const row = displayRows[event.dataIndex]; if (row) selectRow(row); });
            fallback?.remove();
          } catch {
            // The accessible fallback stays available when the CDN is unavailable.
          }
        } catch (error) {
          if (token !== request || !this.dialog.open) return;
          preview.innerHTML = `<div class="chart-builder__empty"><strong>Chart unavailable</strong><p>${escapeHtml(error.message)}</p></div>`;
        }
      };
      this.dialog.querySelector("[data-chart-layer]").addEventListener("change", async (event) => {
        layer = this.mapController.getLayer(event.target.value) || layer;
        layer = await this.mapController.loadLayer(layer.uid, { allowTruncated: false });
        fields = layer.fields || [];
        spec = null;
        chartFilter = null;
        chartInstance?.dispose?.(); chartInstance = null;
        render();
      });
      this.dialog.querySelectorAll("[data-chart-type], [data-chart-dimension], [data-chart-aggregation], [data-chart-measure], [data-chart-size], [data-chart-map-fields], [data-chart-scope], [data-chart-title], [data-chart-target], [data-chart-render-mode], [data-chart-anchor], [data-chart-collision], [data-chart-display], [data-chart-placement], [data-chart-presentation-size]").forEach((control) => control.addEventListener("change", () => {
        if (control.matches("[data-chart-target]")) syncPrimaryAction();
        void refresh();
      }));
      this.dialog.querySelectorAll("[data-chart-suggestion]").forEach((button) => button.addEventListener("click", () => {
        const suggestion = gallery[Number(button.dataset.chartSuggestion)];
        if (!suggestion) return;
        if (suggestion.spatial) {
          this.dialog.close();
          this.openCartographyLab(layer.uid);
          requestAnimationFrame(() => document.querySelector('#utility-lab-content [data-lab-dimension="3d"]')?.focus());
          return;
        }
        spec = createChartSpec({ title: suggestion.label, preset: suggestion.preset, type: suggestion.type, layerId: layer.uid, dimension: suggestion.dimension, measure: { field: suggestion.measure, aggregation: suggestion.aggregation }, encoding: { sizeField: suggestion.size }, presentation: { target: suggestion.target || (family === "map" ? "map" : "panel"), targets: [suggestion.target || (family === "map" ? "map" : "panel")], renderMode: suggestion.renderMode || (family === "map" ? "svg" : "standard") } });
        chartInstance?.dispose?.(); chartInstance = null;
        render();
      }));
      const session = this.dialogSession;
      this.dialog.addEventListener("close", () => {
        if (session === this.dialogSession) { chartInstance?.dispose?.(); chartInstance = null; }
      }, { once: true });
      void refresh();
    };
    try {
      layer = await this.mapController.loadLayer(layer.uid, { allowTruncated: false });
      fields = layer.fields || [];
      const suggestion = recommendCharts(fields, { family })[0] || {};
      spec = createChartSpec({ title: suggestion.label || `${layer.title || "Layer"} chart`, preset: suggestion.preset, layerId: layer.uid, type: suggestion.type, dimension: suggestion.dimension, measure: { field: suggestion.measure, aggregation: suggestion.aggregation }, encoding: { sizeField: suggestion.size }, presentation: { target: suggestion.target || (family === "map" ? "map" : "panel"), targets: [suggestion.target || (family === "map" ? "map" : "panel")], renderMode: suggestion.renderMode || (family === "map" ? "svg" : "standard") } });
      render();
    } catch (error) {
      this.error(error.message);
    }
  }

  /** A chart-specific way into data when a workspace has no queryable layer yet. */
  #openChartDataStarter({ family = "custom" } = {}) {
    const familyLabel = CHART_FAMILY_LABELS[family] || CHART_FAMILY_LABELS.custom;
    const reopenBuilder = async () => this.#openChartsAnalytics({ family });
    const openSource = (source) => {
      this.dialog.close();
      if (source === "arcgis") this.#serviceDialog("arcgis-auto", reopenBuilder);
      else if (source === "geo-url") this.#serviceDialog("geojson", reopenBuilder);
      else if (source === "popular") this.#popularDataDialog(reopenBuilder);
      else if (source === "local") {
        const input = document.querySelector("#data-file-input");
        const existingLayerIds = new Set(this.mapController.getLayers().map((layer) => layer.uid));
        let settled = false;
        const subscription = this.events.subscribe("layer:added", ({ layer }) => {
          if (settled || !layer?.queryable || existingLayerIds.has(layer.uid)) return;
          settled = true;
          subscription.remove();
          void reopenBuilder();
        });
        input?.addEventListener("cancel", () => subscription.remove(), { once: true });
        input?.click();
      }
    };
    const startExample = async (button) => {
      button.disabled = true;
      button.textContent = "Loading example…";
      try {
        const file = new File([JSON.stringify(chartExampleFeatureCollection())], "chart-starter-example.geojson", { type: "application/geo+json" });
        const layer = await this.mapController.addLocalFile(file);
        this.dialog.close();
        this.toast("Chart starter example added. Try the preset, then change its fields.");
        await this.mapController.goToLayerOnInitialLoad(layer).catch(() => {});
        await reopenBuilder();
      } catch (error) {
        button.disabled = false;
        button.textContent = "Use the built-in example";
        this.error(`Could not add the chart example: ${error.message}`);
      }
    };
    const renderTutorial = () => {
      const content = this.dialog.querySelector("#dialog-content");
      content.innerHTML = `<section class="chart-data-starter chart-data-starter--tutorial">
        <span class="eyebrow">Chart tutorial</span>
        <h3>Build a ${escapeHtml(familyLabel)} chart in three steps</h3>
        <ol>
          <li><strong>Start with a layer.</strong><span>Use the local example or add a service, URL, or file.</span></li>
          <li><strong>Choose a clear comparison.</strong><span>Pick a category or time field and a numeric value; record IDs are never selected as defaults.</span></li>
          <li><strong>Preview, then share.</strong><span>Select a bar or point to link it to the map, then save it to a panel, dashboard, map, or brief.</span></li>
        </ol>
        <div class="chart-data-starter__tutorial-actions"><button type="button" data-chart-data-start="example">Use the built-in example</button><button type="button" data-chart-data-start="back">Choose another source</button></div>
      </section>`;
      bind();
    };
    const bind = () => {
      this.dialog.querySelectorAll("[data-chart-data-start]").forEach((button) => button.addEventListener("click", () => {
        const source = button.dataset.chartDataStart;
        if (source === "tutorial") return renderTutorial();
        if (source === "back") return this.#openChartDataStarter({ family });
        if (source === "example") return void startExample(button);
        openSource(source);
      }));
    };
    this.openDialog({
      eyebrow: "Chart tools",
      title: "Start with data",
      content: `<section class="chart-data-starter">
        <span class="eyebrow">${escapeHtml(familyLabel)}</span>
        <h3>Choose a dataset for your chart</h3>
        <p>A chart needs one queryable feature layer. Choose a source below; the Chart Builder will continue with this chart family after it loads.</p>
        <div class="chart-data-starter__grid">
          <button type="button" data-chart-data-start="tutorial"><strong>Chart tutorial</strong><small>Learn the workflow, then start with an example.</small></button>
          <button type="button" data-chart-data-start="popular"><strong>Popular data services</strong><small>Browse curated public GIS data.</small></button>
          <button type="button" data-chart-data-start="arcgis"><strong>ArcGIS REST service</strong><small>Connect a feature service or layer URL.</small></button>
          <button type="button" data-chart-data-start="geo-url"><strong>Geo URL</strong><small>Open a GeoJSON or GeoParquet URL.</small></button>
          <button type="button" data-chart-data-start="local"><strong>Local data file</strong><small>Add GeoJSON, KML, Shapefile, or GeoParquet.</small></button>
          <button type="button" data-chart-data-start="example"><strong>Example dataset</strong><small>Load an offline-ready sample and open the builder.</small></button>
        </div>
      </section>`,
      actions: [{ label: "Close", primary: true, handler: () => this.dialog.close() }],
    });
    bind();
  }

  createTourFromPlaces(places = [], { title = "", open = true } = {}) {
    const usable = places.filter((place) => Number.isFinite(place?.latitude) && Number.isFinite(place?.longitude));
    if (!usable.length) return this.error("There are no places with coordinates to tour.");
    if (open) this.#openGuidedTours();
    const presentation = this.projectManager.current.presentation || {};
    const chapters = presentation.chapters || [];
    const defaults = this.#atlasDefaults(presentation);
    const layers = this.mapController.getLayers();
    const added = usable.slice(0, Math.max(0, 50 - chapters.length)).map((place, index) => ({
      id: crypto.randomUUID?.() || `chapter-${Date.now()}-${index}`,
      title: String(place.title || `Chapter ${chapters.length + index + 1}`).slice(0, 120),
      body: String(place.body || "").slice(0, 600),
      mediaUrl: "",
      reverseAddress: place.address || "",
      viewState: { type: "scene", center: [place.longitude, place.latitude], zoom: place.zoom ?? 15, heading: place.heading ?? defaults.heading, tilt: place.tilt ?? defaults.tilt },
      viewpoint: null,
      basemapId: this.mapController.getBasemapId(),
      lingerSeconds: defaults.lingerSeconds,
      transitionMode: defaults.transitionMode,
      visibleLayerIds: layers.filter((layer) => layer.visible).map((layer) => layer.uid),
      layerVisibility: layers.map((layer) => ({ key: this.#atlasLayerKey(layer), visible: layer.visible })),
    }));
    if (!added.length) return this.error("This tour already has the most chapters it can hold (50).");
    // Without opening Tours (adding from a briefing), the chapters are saved quietly.
    if (open) this.#saveAtlasChapters([...chapters, ...added]);
    else return this.toast(`Added to the tour · ${this.projectManager.patchPresentation({ chapters: [...chapters, ...added] }).chapters.length} chapters. Open Tours to present it.`);
    if (title && !chapters.length) this.projectManager.patchPresentation({ title, modeTitles: { ...(this.projectManager.current.presentation?.modeTitles || {}), atlas: title } });
    this.toast(`Added ${added.length} chapter${added.length === 1 ? "" : "s"} to the tour.`);
  }

  /** A briefing on the layer a field task's features come from, loading it if needed. */
  async createBriefingForLayerUrl({ layerUrl, ids = [], title = "", steps = [], labels = {} }) {
    try {
      let layer = this.mapController.getLayers().find((item) => featureLayerUrl(item) === layerUrl || this.mapController.getLayerConfig(item).url === layerUrl);
      if (!layer) layer = await this.mapController.addService({ url: layerUrl, serviceType: "arcgis-auto" });
      this.createBriefingFromLayer(layer.uid, { featureIds: ids, title: title ? `${title} briefing` : "", features: ids.map((id) => ({ id, label: labels[id] })), actions: steps });
    } catch (error) {
      this.error(error.message);
    }
  }

  #projectDownloadDialog() {
    this.openDialog({
      eyebrow: "Portable project",
      title: "Download project",
      content: `<div class="smart-image-intro"><strong>A map that opens like a project</strong><p>Smart Image creates a polished PNG that works in ordinary image viewers while carrying this GISMap Online project invisibly. Import the original PNG into GISMap Online to restore its layers, styling, camera, bookmarks, workflows, and Briefing slides.</p></div>
        <dl class="project-download-formats">
          <div><dt>Smart map image (.png)</dt><dd>Best for email, AirDrop, chat attachments, and shared drives. Services must remain publicly reachable. Some social networks remove image metadata.</dd></div>
          <div><dt>Project file (.gis)</dt><dd>The compact editable project configuration without local source files.</dd></div>
          <div><dt>Project package (.gisx)</dt><dd>The complete portable package for projects that use local files.</dd></div>
        </dl>
        <p class="form-note">Smart Images contain configuration and public data references, never sign-in tokens. Use the package option when local datasets must travel with the project.</p>`,
      actions: [
        { label: "Smart map image", primary: true, handler: async () => {
          const button = this.dialog.querySelector(".button--primary");
          const label = button.textContent;
          button.disabled = true;
          button.textContent = "Rendering map…";
          try {
            await this.projectManager.exportSmartImage();
            this.dialog.close();
          } catch (error) {
            this.error(error.message);
            button.disabled = false;
            button.textContent = label;
          }
        } },
        { label: "Project file (.gis)", handler: () => { this.projectManager.exportJson(); this.dialog.close(); } },
        { label: "Project package (.gisx)", handler: async () => {
          try { await this.projectManager.exportPackage(); this.dialog.close(); } catch (error) { this.error(error.message); }
        } },
      ],
    });
  }

  #exportDialog(preselectedUid = null) {
    const layers = this.exportController.listExportableLayers();
    if (!layers.length) throw new Error("Add a queryable vector layer before exporting data.");
    const selectedUid = layers.some((layer) => layer.uid === preselectedUid) ? preselectedUid : layers[0].uid;
    this.openDialog({
      eyebrow: "Download vector data",
      title: "Export data",
      content: `<label class="field"><span>Layer</span><select id="export-layer">${layers.map((layer) => `<option value="${escapeHtml(layer.uid)}" ${layer.uid === selectedUid ? "selected" : ""}>${escapeHtml(layer.title)}</option>`).join("")}</select></label>
        <label class="field"><span>Features</span><select id="export-scope"></select></label>
        <label class="field"><span>Format</span><select id="export-format"><option value="geojson">GeoJSON (.geojson)</option><option value="kml">KML (.kml)</option><option value="kmz">Compressed KML (.kmz)</option><option value="shapefile">Shapefile (.zip)</option></select></label>
        <label class="field"><span>File name</span><input id="export-file-name" value="${escapeHtml(layers.find((layer) => layer.uid === selectedUid)?.title || "layer")}" /></label>
        <p class="form-note">Geometry is exported as longitude and latitude in EPSG:4326. Shapefiles are delivered as ZIP archives and split into point, line, and polygon datasets when needed. Retrieval is paginated and conversion runs in a background worker.</p>`,
      actions: [{ label: "Export GeoJSON", primary: true, handler: () => this.#runExport() }],
    });
    const layerSelect = this.dialog.querySelector("#export-layer");
    const formatSelect = this.dialog.querySelector("#export-format");
    const scopeSelect = this.dialog.querySelector("#export-scope");
    const exportButton = this.dialog.querySelector(".button--primary");
    const updateScope = () => {
      const drawingSource = layers.find((item) => item.uid === layerSelect.value)?.kind === "drawings";
      scopeSelect.innerHTML = drawingSource
        ? '<option value="all">All drawings</option><option value="extent">Drawings in the current map extent</option>'
        : '<option value="filtered">All features matching the current layer filter</option><option value="extent">Filtered features in the current map extent</option><option value="source">Entire source layer (ignore the current filter)</option>';
    };
    const updateFormat = () => {
      const label = formatSelect.selectedOptions[0]?.textContent.replace(/\s*\([^)]*\)\s*$/, "") || "data";
      exportButton.textContent = `Export ${label}`;
    };
    layerSelect.addEventListener("change", () => {
      const layer = layers.find((item) => item.uid === layerSelect.value);
      this.dialog.querySelector("#export-file-name").value = layer?.title || "layer";
      updateScope();
    });
    formatSelect.addEventListener("change", updateFormat);
    updateScope();
    updateFormat();
  }

  async #runExport() {
    const options = {
      uid: this.dialog.querySelector("#export-layer").value,
      scope: this.dialog.querySelector("#export-scope").value,
      format: this.dialog.querySelector("#export-format").value,
      fileName: this.dialog.querySelector("#export-file-name").value,
    };
    document.querySelector("#dialog-title").textContent = "Preparing download";
    document.querySelector("#dialog-content").innerHTML = `<div class="export-progress"><progress data-export-progress></progress><strong data-export-status>Preparing feature query…</strong><small>You can continue using the map after starting the download. Cancel stops outstanding service requests and terminates the export worker.</small></div>`;
    const footer = document.querySelector("#dialog-actions");
    footer.innerHTML = "";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.textContent = "Cancel export";
    cancel.addEventListener("click", () => {
      this.exportController.cancel();
      this.dialog.close();
    });
    footer.append(cancel);
    try {
      const result = await this.exportController.exportLayer(options);
      if (!result) return;
      this.dialog.close();
      const formatLabel = { geojson: "GeoJSON", kml: "KML", kmz: "KMZ", shapefile: "a zipped Shapefile" }[options.format];
      this.toast(`Exported ${result.featureCount.toLocaleString()} features as ${formatLabel}.`);
    } catch (error) {
      this.error(`Export failed: ${error.message}`);
      this.dialog.close();
    }
  }

  /** <option>s for the engines, the active one selected. */
  #engineOptionsMarkup() {
    const labels = { arcgis: "ArcGIS — 3D scenes", maplibre: "MapLibre — open 3D maps (preview)" };
    return this.mapController.availableEngines().map((engine) => `<option value="${escapeHtml(engine.id)}"${engine.id === this.mapController.getEngineId() ? " selected" : ""}>${escapeHtml(labels[engine.id] || engine.label)}</option>`).join("");
  }

  /**
   * <option>s for the active engine's own basemaps, grouped, with `id` (or the
   * basemap the engine draws for it: an ArcGIS id on MapLibre shows as its open equivalent) selected.
   */
  #basemapOptionsMarkup(id = null) {
    const { selected, options } = this.mapController.getBasemapOptions();
    const wanted = id == null ? selected : options.some((entry) => entry.id === id) ? id : BASEMAPS.find((entry) => entry.id === id)?.[this.mapController.getEngineId()] || selected;
    const groups = [...new Set(options.map((entry) => entry.group))];
    return groups.map((group) => `<optgroup label="${escapeHtml(group)}">${options.filter((entry) => entry.group === group).map((entry) => `<option value="${escapeHtml(entry.id)}"${entry.id === wanted ? " selected" : ""}>${escapeHtml(entry.label)}</option>`).join("")}</optgroup>`).join("");
  }

  #groundOptionsMarkup() {
    const { selected, options } = this.mapController.getGroundOptions();
    return options.map((option) => `<option value="${escapeHtml(option.id)}"${option.id === selected ? " selected" : ""}>${escapeHtml(option.label)}</option>`).join("");
  }

  /**
   * The Map menu speaks for the engine that is drawing: its engine choice, its
   * own basemaps with the one on screen selected, terrain only where there is
   * ground, and map tools that need another engine marked as such.
   */
  #syncMapMenu() {
    const capabilities = this.mapController.getCapabilities();
    const engine = this.mapController.getEngineId();
    document.querySelectorAll("[data-engine-picker]").forEach((select) => { select.innerHTML = this.#engineOptionsMarkup(); });
    document.querySelectorAll("[data-engine-hint]").forEach((hint) => {
      hint.textContent = engine === "maplibre" ? "Preview: open 3D terrain, basemaps, GeoJSON and ArcGIS services. KML services and some widgets still need the ArcGIS engine." : "";
      hint.hidden = !hint.textContent;
    });
    document.querySelectorAll("[data-basemap-picker]").forEach((select) => { select.innerHTML = this.#basemapOptionsMarkup(); });
    document.querySelectorAll("[data-ground-picker]").forEach((select) => { select.innerHTML = this.#groundOptionsMarkup(); });
    // 3D buildings are on unless turned off.
    let buildings = true;
    try { buildings = localStorage.getItem(BUILDINGS_3D_KEY) !== "off"; } catch { /* On. */ }
    document.querySelectorAll("[data-buildings-toggle]").forEach((input) => { input.checked = buildings; });
    if (capabilities.includes("buildings-3d")) this.mapController.setBuildings3d(buildings);
    document.querySelectorAll("[data-requires-capability]").forEach((element) => {
      const available = capabilities.includes(element.dataset.requiresCapability);
      if (element.matches("button")) {
        element.disabled = !available;
        if (available) element.removeAttribute("title");
        else element.title = "Needs the ArcGIS engine (Map → Map engine).";
      } else {
        element.hidden = !available;
      }
    });
  }

  #bindMapMenu() {
    this.#syncMapMenu();
    ["map:ready", "map:basemap-changed", "map:ground-changed"].forEach((topic) => this.events.subscribe(topic, () => this.#syncMapMenu()));
    this.events.subscribe("map:basemap-changed", () => {
      try {
        const { selected, options } = this.mapController.getBasemapOptions();
        if (options.some(({ id }) => id === selected)) localStorage.setItem(`gismap-online:basemap:${this.mapController.getEngineId()}`, selected);
      } catch { /* Preferences are optional when storage is unavailable. */ }
    });
    this.events.subscribe("map:ready", () => {
      try {
        if (sessionStorage.getItem("gismap-online:reopen-basemap-gallery") === "1") {
          sessionStorage.removeItem("gismap-online:reopen-basemap-gallery");
          if (!this.mapController.widgetOpen("basemapGallery")) Promise.resolve(this.mapController.toggleWidget("basemapGallery")).catch((error) => this.error(error.message));
        }
      } catch { /* Session storage is optional. */ }
    });
    document.addEventListener("change", async (event) => {
      const select = event.target.closest?.("[data-engine-picker]");
      if (!select || select.value === this.mapController.getEngineId()) return;
      this.#closeMenus();
      await this.#switchEngine(select.value);
    });
  }

  /**
   * Keeps the map engine's basemap theme in step with the interface: the
   * "skin" basemap and unstyled data layers take the active skin's colours,
   * whichever part of the app changes the skin or the light/dark appearance.
   */
  #followSkinOnMap() {
    const root = document.documentElement;
    let applied = null;
    const sync = () => {
      const skin = normalizeSkin(root.dataset.skin);
      const baseTheme = themeFromComputedStyle(getComputedStyle(root), { skin, dark: skinIsDark(skin, root.dataset.theme) });
      const palettes = this.mapColorPreview ?? this.projectManager.current.presentation?.mapColors ?? {};
      const theme = applyMapColors(baseTheme, palettes[skin]);
      const key = JSON.stringify(theme);
      if (key === applied) return;
      applied = key;
      this.mapController.setBasemapTheme(theme);
    };
    this.syncBasemapTheme = sync;
    sync();
    new MutationObserver(sync).observe(root, { attributes: true, attributeFilter: ["data-skin", "data-theme", "style"] });
  }

  #readDisplaySettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(DISPLAY_SETTINGS_KEY)) ?? {};
      return {
        insightDismissEnabled: saved.insightDismissEnabled !== false,
        insightDismissMiles: Number.isFinite(saved.insightDismissMiles) && saved.insightDismissMiles >= 1 && saved.insightDismissMiles <= 12450 ? saved.insightDismissMiles : 75,
        insightPosition: INSIGHT_POSITIONS.has(saved.insightPosition) ? saved.insightPosition : "upper-left",
        defaultBasemap: BASEMAP_IDS.has(saved.defaultBasemap) ? saved.defaultBasemap : "topo-3d",
        insightDockWidth: Number.isFinite(saved.insightDockWidth) ? Math.min(720, Math.max(300, saved.insightDockWidth)) : 420,
        insightDockHeight: Number.isFinite(saved.insightDockHeight) ? Math.min(620, Math.max(220, saved.insightDockHeight)) : 360,
        tablePosition: TABLE_POSITIONS.has(saved.tablePosition) ? saved.tablePosition : "overlay-bottom",
        tableDockWidth: Number.isFinite(saved.tableDockWidth) ? Math.min(820, Math.max(360, saved.tableDockWidth)) : 520,
        tableDockHeight: Number.isFinite(saved.tableDockHeight) ? Math.min(680, Math.max(170, saved.tableDockHeight)) : 420,
        highlightEnabled: saved.highlightEnabled !== false,
        clickMarkerEnabled: saved.clickMarkerEnabled !== false,
        highlightColor: /^#[0-9a-f]{6}$/i.test(saved.highlightColor) ? saved.highlightColor : "#00b8d9",
        highlightStyle: saved.highlightStyle === "outline" ? "outline" : "fill",
        navigationLayout: saved.navigationLayout === "top" ? "top" : "side",
        utilityPanelWidth: Number.isFinite(saved.utilityPanelWidth) ? Math.min(Math.max(280, window.innerWidth * 0.55), Math.max(280, saved.utilityPanelWidth)) : 360,
        appearance: ["system", "light", "dark"].includes(saved.appearance) ? saved.appearance : "light",
        classicLayout: saved.classicLayout === true,
        skinAppearance: Object.fromEntries(Object.entries(saved.skinAppearance && typeof saved.skinAppearance === "object" ? saved.skinAppearance : {}).filter(([skin, theme]) => INTERFACE_SKINS.some(({ id }) => id === skin) && (theme === "light" || theme === "dark"))),
        darkBasemapEnabled: saved.darkBasemapEnabled === true,
        bookmarksPanelVisible: saved.bookmarksPanelVisible === true,
        drawPanelVisible: saved.drawPanelVisible === true,
        placesPanelVisible: saved.placesPanelVisible !== false,
        intelligencePanelVisible: saved.intelligencePanelVisible !== false,
        layersPanelVisible: saved.layersPanelVisible !== false,
        observationsPanelVisible: saved.observationsPanelVisible === true,
      };
    } catch {
      return { insightDismissEnabled: true, insightDismissMiles: 75, insightPosition: "upper-left", defaultBasemap: "topo-3d", insightDockWidth: 420, insightDockHeight: 360, tablePosition: "overlay-bottom", tableDockWidth: 520, tableDockHeight: 420, highlightEnabled: true, clickMarkerEnabled: true, highlightColor: "#00b8d9", highlightStyle: "fill", navigationLayout: "side", utilityPanelWidth: 360, appearance: "light", darkBasemapEnabled: false, bookmarksPanelVisible: false, drawPanelVisible: false };
    }
  }

  #applyDisplaySettings(settings) {
    const prefersDark = matchMedia("(prefers-color-scheme: dark)").matches;
    const resolvedTheme = settings.appearance === "system" ? (prefersDark ? "dark" : "light") : settings.appearance;
    document.documentElement.dataset.theme = resolvedTheme;
    // Classic mode restores the pre-Fieldwork layout and house palette (css/fieldwork.css keys off data-layout).
    document.documentElement.dataset.layout = settings.classicLayout ? "classic" : "studio";
    document.querySelectorAll("[data-classic-mode]").forEach((button) => button.setAttribute("aria-pressed", String(Boolean(settings.classicLayout))));
    // Appearance is the house skin's light/dark; applyInterfaceSkin resolves the active skin's own rendering.
    const skin = document.documentElement.dataset.skin || this.projectManager?.current?.presentation?.skin;
    applyInterfaceSkin(skin, { colors: this.projectManager?.current?.presentation?.skinColors?.[normalizeSkin(skin)] });
    const mobile = this.mobileMedia.matches;
    const insightPosition = mobile ? "dock-top" : settings.insightPosition;
    const tablePosition = mobile ? "dock-top" : settings.tablePosition;
    document.body.dataset.insightsPosition = insightPosition;
    document.body.style.setProperty("--insights-dock-width", `${settings.insightDockWidth ?? 420}px`);
    document.body.style.setProperty("--insights-dock-height", `${settings.insightDockHeight ?? 360}px`);
    document.body.dataset.tablePosition = tablePosition;
    document.body.dataset.navigationLayout = settings.navigationLayout ?? "side";
    this.#setOptionalPanelVisibility("bookmarks-panel", settings.bookmarksPanelVisible, false);
    this.#setOptionalPanelVisibility("draw-panel", settings.drawPanelVisible, false);
    this.#setOptionalPanelVisibility("places-panel", settings.placesPanelVisible !== false, false);
    this.#setOptionalPanelVisibility("intelligence-panel", settings.intelligencePanelVisible !== false, false);
    this.#setOptionalPanelVisibility("layers-panel", settings.layersPanelVisible !== false, false);
    this.#setOptionalPanelVisibility("observations-panel", settings.observationsPanelVisible === true, false);
    document.querySelectorAll("[data-panel-top-nav]").forEach((button) => { button.textContent = settings.navigationLayout === "top" ? "Use side navigation" : "Use top navigation"; button.setAttribute("aria-pressed", String(settings.navigationLayout === "top")); });
    if (settings.navigationLayout === "top") {
      document.querySelectorAll(".sidebar__scroll > .panel").forEach((panel) => { panel.open = false; });
    }
    document.body.style.setProperty("--table-dock-width", `${settings.tableDockWidth ?? 520}px`);
    document.body.style.setProperty("--table-dock-height", `${settings.tableDockHeight ?? 420}px`);
    document.body.style.setProperty("--utility-panel-width", `${settings.utilityPanelWidth ?? 360}px`);
    const resizer = document.querySelector("#insights-resizer");
    if (resizer) resizer.setAttribute("aria-orientation", ["dock-top", "dock-bottom"].includes(insightPosition) ? "horizontal" : "vertical");
    const tableResizer = document.querySelector("#table-resizer");
    if (tableResizer) tableResizer.setAttribute("aria-orientation", ["dock-top", "dock-bottom"].includes(tablePosition) ? "horizontal" : "vertical");
    this.mapController.setDefaultBasemap(settings.defaultBasemap);
    if (settings.darkBasemapEnabled) {
      this.mapController.setBasemap(resolvedTheme === "dark" ? "navigation-dark-3d" : settings.defaultBasemap);
    }
    this.mapController.configureInteractionFeedback(settings);
    this.events.publish("display:insight-dismiss-distance", { miles: settings.insightDismissEnabled ? settings.insightDismissMiles : null });
    this.fieldworkWorkspace?.syncPanels();
    requestAnimationFrame(() => this.mapController.resize());
  }

  #setOptionalPanelVisibility(panelId, visible, save = true) {
    const panel = document.querySelector(`#${panelId}`);
    if (!panel) return;
    panel.classList.toggle("is-sidebar-optional-hidden", !visible);
    const panelType = panelId.replace(/-panel$/, "");
    if (save && !visible && (this.utilityPanelsOpen.has(panelType) || (panelType === "draw" && this.utilityDrawOpen) || (panelType === "intelligence" && this.utilityIntelligenceOpen))) this.#closeUtilityTab(panelType);
    if (save && this.mobileMedia.matches) {
      if (visible) this.#activateMobilePanel(panelId);
      else if (this.mobilePanelManager?.activePanelId === panelId) this.mobilePanelManager.close();
    }
    if (visible && !this.mobileMedia.matches) panel.open = true;
    document.querySelectorAll(`[data-sidebar-panel-toggle="${panelId}"]`).forEach((button) => {
      const label = DOCKABLE_PANELS[panelId.replace(/-panel$/, "")] || panelId;
      button.textContent = `${visible ? "Hide" : "Add"} ${label} panel`;
      button.setAttribute("aria-pressed", String(visible));
    });
    if (!save) return;
    const setting = `${panelId.replace(/-panel$/, "")}PanelVisible`;
    const settings = { ...this.#readDisplaySettings(), [setting]: visible };
    localStorage.setItem(DISPLAY_SETTINGS_KEY, JSON.stringify(settings));
    this.toast(`${visible ? "Added" : "Removed"} ${DOCKABLE_PANELS[panelId.replace(/-panel$/, "")] || ""} panel.`);
  }

  #displaySettingsDialog() {
    const current = this.#readDisplaySettings();
    const { insightPosition, tablePosition } = current;
    const defaultBasemap = this.mapController.getDefaultBasemapId();
    const basemapOptions = this.#basemapOptionsMarkup(defaultBasemap);
    this.openDialog({
      eyebrow: "Interface preferences",
      title: "Display settings",
      content: `<div class="display-settings-grid">
        <label class="field"><span>Appearance <small>${escapeHtml(INTERFACE_SKINS.find(({ id }) => id === normalizeSkin(document.documentElement.dataset.skin))?.label || "")}</small></span><select id="appearance"><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label>
        <label class="field"><span>Application navigation</span><select id="navigation-layout"><option value="side">Side panel</option><option value="top">Top navigation bar</option></select></label>
        <label class="field"><span>Map Insight position</span><select id="insight-position"><optgroup label="Floating"><option value="upper-left">Upper left</option><option value="lower-left">Lower left</option><option value="bottom">Bottom overlay</option></optgroup><optgroup label="Dashboard"><option value="dock-left">Dock left</option><option value="dock-right">Dock right</option><option value="dock-top">Dock top</option><option value="dock-bottom">Dock bottom</option></optgroup></select></label>
        <label class="field"><span>Attribute table position</span><select id="table-position"><option value="overlay-bottom">Bottom overlay</option><option value="dock-left">Dock left</option><option value="dock-right">Dock right</option><option value="dock-top">Dock top</option><option value="dock-bottom">Dock bottom</option></select></label>
        <label class="field display-basemap"><span>Default basemap</span><select id="default-basemap">${basemapOptions}</select></label>
        <label class="field"><span>Map engine</span><select id="map-engine">${this.#engineOptionsMarkup()}</select></label>
      </div>
      <label class="display-checkbox"><input id="dark-basemap-enabled" type="checkbox" ${current.darkBasemapEnabled ? "checked" : ""} /><span>Use a dark basemap when dark mode is enabled</span></label>
      <fieldset class="feedback-settings"><legend>Map Insight while navigating</legend><label class="display-checkbox"><input id="insight-dismiss-enabled" type="checkbox" ${current.insightDismissEnabled ? "checked" : ""} /><span>Close Map Insight after panning beyond a distance</span></label><label class="field"><span>Distance (miles)</span><input id="insight-dismiss-miles" type="number" min="1" max="12450" step="1" value="${current.insightDismissMiles}" /></label><p class="form-note">Measured from the map center when the feature was identified. Zooming to a feature from Map Insight keeps it open. Intelligence clears after any pan.</p></fieldset>
      <fieldset class="feedback-settings"><legend>Map click feedback</legend><label class="display-checkbox"><input id="click-marker-enabled" type="checkbox" ${current.clickMarkerEnabled ? "checked" : ""} /><span>Show a crosshair where the map is clicked</span></label><label class="display-checkbox"><input id="highlight-enabled" type="checkbox" ${current.highlightEnabled ? "checked" : ""} /><span>Highlight the feature selected in Map Insight</span></label><label class="field"><span>Selection style</span><select id="highlight-style"><option value="fill"${current.highlightStyle === "outline" ? "" : " selected"}>Filled polygon with outline</option><option value="outline"${current.highlightStyle === "outline" ? " selected" : ""}>Outline only</option></select></label><label class="highlight-color"><span>Feedback color</span><input id="highlight-color" type="color" value="${current.highlightColor}" /><output>${current.highlightColor.toUpperCase()}</output></label></fieldset>
      <label class="display-checkbox"><input id="apply-default-basemap" type="checkbox" /><span>Apply the default basemap to the current map</span></label><p class="form-note">Docked panels resize the map instead of covering it. Sizes, navigation, appearance, and feedback preferences are saved in this browser.</p>`,
      actions: [{ label: "Save settings", primary: true, handler: async () => {
        const insightPosition = this.dialog.querySelector("#insight-position").value;
        const tablePosition = this.dialog.querySelector("#table-position").value;
        const navigationLayout = this.dialog.querySelector("#navigation-layout").value;
        const appearance = this.dialog.querySelector("#appearance").value;
        const defaultBasemap = this.dialog.querySelector("#default-basemap").value;
        const insightDismissMiles = Number(this.dialog.querySelector("#insight-dismiss-miles").value);
        if (!Number.isFinite(insightDismissMiles) || insightDismissMiles < 1 || insightDismissMiles > 12450) { this.error("Choose a Map Insight distance between 1 and 12,450 miles."); return; }
        const activeSkin = normalizeSkin(document.documentElement.dataset.skin);
        const base = this.#readDisplaySettings();
        // Appearance belongs to the active skin; "System" follows the device for any skin.
        const skinChoice = skinTone(activeSkin) === "auto" ? {} : { skinAppearance: { ...base.skinAppearance, [activeSkin]: appearance === "system" ? (this.systemThemeMedia.matches ? "dark" : "light") : appearance } };
        const settings = { ...base, ...skinChoice, insightDismissEnabled: this.dialog.querySelector("#insight-dismiss-enabled").checked, insightDismissMiles, insightPosition, tablePosition, navigationLayout, appearance: skinTone(activeSkin) === "auto" ? appearance : base.appearance, defaultBasemap, darkBasemapEnabled: this.dialog.querySelector("#dark-basemap-enabled").checked, highlightEnabled: this.dialog.querySelector("#highlight-enabled").checked, clickMarkerEnabled: this.dialog.querySelector("#click-marker-enabled").checked, highlightColor: this.dialog.querySelector("#highlight-color").value, highlightStyle: this.dialog.querySelector("#highlight-style").value === "outline" ? "outline" : "fill" };
        localStorage.setItem(DISPLAY_SETTINGS_KEY, JSON.stringify(settings));
        this.#applyDisplaySettings(settings);
        if (this.dialog.querySelector("#apply-default-basemap").checked) {
          this.mapController.setBasemap(defaultBasemap);
        }
        const engine = this.dialog.querySelector("#map-engine")?.value;
        this.dialog.close();
        if (engine && engine !== this.mapController.getEngineId()) {
          await this.#switchEngine(engine);
          return;
        }
        this.toast("Display settings saved.");
      }}],
    });
    this.dialog.querySelector("#insight-position").value = insightPosition;
    this.dialog.querySelector("#table-position").value = tablePosition;
    this.dialog.querySelector("#navigation-layout").value = current.navigationLayout;
    const dialogSkin = normalizeSkin(document.documentElement.dataset.skin);
    this.dialog.querySelector("#appearance").value = skinTone(dialogSkin) === "auto" ? current.appearance : document.documentElement.dataset.theme || "light";
    this.dialog.querySelector("#highlight-color").addEventListener("input", (event) => {
      event.currentTarget.nextElementSibling.value = event.currentTarget.value.toUpperCase();
    });
  }

  #setInsightsOpen(open) {
    const overlay = document.querySelector("#insights-overlay");
    const wasOpen = !overlay.hidden;
    overlay.hidden = !open;
    document.body.classList.toggle("insights-open", open);
    if (open && this.mobileMedia.matches) this.#setSidebarCollapsed(true);
    if (wasOpen !== open) requestAnimationFrame(() => this.mapController.resize());
  }

  #bindInsightResize() {
    const handle = document.querySelector("#insights-resizer");
    const resizeBy = (amount) => {
      const settings = this.#readDisplaySettings();
      if (["dock-top", "dock-bottom"].includes(settings.insightPosition)) {
        settings.insightDockHeight = Math.min(window.innerHeight * 0.65, Math.max(220, settings.insightDockHeight + amount));
      } else if (["dock-left", "dock-right"].includes(settings.insightPosition)) {
        settings.insightDockWidth = Math.min(window.innerWidth * 0.55, Math.max(300, settings.insightDockWidth + amount));
      } else return;
      localStorage.setItem(DISPLAY_SETTINGS_KEY, JSON.stringify(settings));
      this.#applyDisplaySettings(settings);
    };
    handle.addEventListener("keydown", (event) => {
      const position = document.body.dataset.insightsPosition;
      const direction = ["dock-top", "dock-bottom"].includes(position)
        ? (position === "dock-top"
          ? ({ ArrowUp: -16, ArrowDown: 16 })[event.key]
          : ({ ArrowUp: 16, ArrowDown: -16 })[event.key])
        : ({ ArrowLeft: position === "dock-right" ? 16 : -16, ArrowRight: position === "dock-right" ? -16 : 16 })[event.key];
      if (direction == null) return;
      event.preventDefault();
      resizeBy(direction);
    });
    handle.addEventListener("pointerdown", (event) => {
      const position = document.body.dataset.insightsPosition;
      if (this.mobileMedia.matches) {
        event.preventDefault();
        const overlay = document.querySelector("#insights-overlay");
        const startY = event.clientY;
        const startHeight = overlay.getBoundingClientRect().height;
        document.body.classList.add("insights-resizing");
        const move = (moveEvent) => {
          const height = Math.min(window.innerHeight * 0.45, Math.max(window.innerHeight * 0.25, startHeight + startY - moveEvent.clientY));
          document.body.style.setProperty("--insights-overlay-height", `${height}px`);
        };
        const finish = () => {
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", finish);
          window.removeEventListener("pointercancel", finish);
          document.body.classList.remove("insights-resizing");
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", finish);
        window.addEventListener("pointercancel", finish);
        return;
      }
      if (!["dock-left", "dock-right", "dock-top", "dock-bottom"].includes(position)) return;
      event.preventDefault();
      const settings = this.#readDisplaySettings();
      const startX = event.clientX;
      const startY = event.clientY;
      const startWidth = settings.insightDockWidth;
      const startHeight = settings.insightDockHeight;
      document.body.classList.add("insights-resizing");
      const move = (moveEvent) => {
        if (["dock-top", "dock-bottom"].includes(position)) {
          const delta = position === "dock-top" ? moveEvent.clientY - startY : startY - moveEvent.clientY;
          settings.insightDockHeight = Math.min(window.innerHeight * 0.65, Math.max(220, startHeight + delta));
        } else {
          const delta = position === "dock-left" ? moveEvent.clientX - startX : startX - moveEvent.clientX;
          settings.insightDockWidth = Math.min(window.innerWidth * 0.55, Math.max(300, startWidth + delta));
        }
        this.#applyDisplaySettings(settings);
      };
      const finish = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", finish);
        window.removeEventListener("pointercancel", finish);
        document.body.classList.remove("insights-resizing");
        localStorage.setItem(DISPLAY_SETTINGS_KEY, JSON.stringify(settings));
        this.mapController.resize();
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", finish);
      window.addEventListener("pointercancel", finish);
    });
  }

  #bindUtilityPanel() {
    const handle = document.querySelector("#utility-resizer");
    const setWidth = (width, save = false) => {
      const settings = this.#readDisplaySettings();
      settings.utilityPanelWidth = Math.min(Math.max(280, window.innerWidth * 0.55), Math.max(280, width));
      document.body.style.setProperty("--utility-panel-width", `${settings.utilityPanelWidth}px`);
      if (save) localStorage.setItem(DISPLAY_SETTINGS_KEY, JSON.stringify(settings));
      requestAnimationFrame(() => this.mapController.resize());
    };
    this.setUtilityPanelWidth = (size) => setWidth(size === "max" ? window.innerWidth * 0.55 : 280, true);
    handle.addEventListener("keydown", (event) => {
      if (event.key === "Home" || event.key === "End") { event.preventDefault(); this.setUtilityPanelWidth(event.key === "Home" ? "min" : "max"); return; }
      const direction = document.body.classList.contains("briefing-workspace-left") && window.innerWidth >= 1100 ? -1 : 1;
      const delta = ({ ArrowLeft: 20 * direction, ArrowRight: -20 * direction })[event.key];
      if (delta == null) return;
      event.preventDefault();
      setWidth(this.#readDisplaySettings().utilityPanelWidth + delta, true);
    });
    handle.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      const startX = event.clientX;
      const startWidth = this.#readDisplaySettings().utilityPanelWidth;
      document.body.classList.add("utility-resizing");
      const direction = document.body.classList.contains("briefing-workspace-left") && window.innerWidth >= 1100 ? -1 : 1;
      const move = (moveEvent) => setWidth(startWidth + direction * (startX - moveEvent.clientX));
      const finish = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", finish);
        document.body.classList.remove("utility-resizing");
        const width = parseFloat(getComputedStyle(document.body).getPropertyValue("--utility-panel-width"));
        setWidth(width, true);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", finish);
    });
  }

  #bindMobileActionBar() {
    const bar = document.querySelector("#mobile-action-bar");
    if (!bar) return;
    this.mobileActionSources = [];
    this.mobileActionSignature = "";
    bar.addEventListener("click", (event) => {
      const button = event.target.closest("[data-action-proxy]");
      if (button) this.mobileActionSources[Number(button.dataset.actionProxy)]?.click();
    });
    // Batch bursts of DOM changes into one update, without waiting for a frame
    // (frames pause while the page is hidden).
    const schedule = () => {
      if (this.mobileActionQueued) return;
      this.mobileActionQueued = true;
      queueMicrotask(() => {
        this.mobileActionQueued = false;
        this.#syncMobileActionBar();
      });
    };
    const watch = (selector, options) => {
      const target = selector === "body" ? document.body : document.querySelector(selector);
      if (target) new MutationObserver(schedule).observe(target, options);
    };
    // The Briefing and Tour panels are rebuilt as they change, so watch the sidebar that holds them.
    watch("#sidebar", { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled", "hidden", "class"] });
    watch("#mobile-presentation-controls", { subtree: true, attributes: true, attributeFilter: ["disabled", "aria-expanded"] });
    watch("#mobile-workflow-root", { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled", "hidden"] });
    watch("body", { attributes: true, attributeFilter: ["class"] });
    watch("#app", { attributes: true, attributeFilter: ["data-presentation"] });
    this.mobileMedia.addEventListener?.("change", schedule);
    schedule();
  }

  /**
   * On phones, Briefing, Tours and the Tasks screens keep their main actions in a
   * bar docked above the bottom navigation, in the same slot the Map route uses
   * for its tools, where a thumb reaches them.
   * The bar mirrors the sheet's own buttons, so their behaviour stays in one place.
   */
  #syncMobileActionBar() {
    const bar = document.querySelector("#mobile-action-bar");
    const dashboard = document.querySelector("#presentation-dashboard");
    if (!bar || !dashboard) return;
    const template = document.querySelector("#app")?.dataset.presentation;
    const body = document.body.classList;
    const available = this.mobileMedia.matches && ["briefing", "atlas"].includes(template)
      && !body.contains("mobile-map-route") && !body.contains("mobile-atlas-presenting") && !body.contains("mobile-workflow-open") && !body.contains("mobile-menu-open");
    let sources = [];
    const workflowRoot = document.querySelector("#mobile-workflow-root");
    if (this.mobileMedia.matches && body.contains("mobile-workflow-open") && !body.contains("mobile-menu-open") && workflowRoot && !workflowRoot.hidden) {
      sources = [...workflowRoot.querySelectorAll("[data-mobile-bar]")].filter((button) => !button.hidden);
    } else if (available && template === "atlas") {
      sources = [...dashboard.querySelectorAll(".atlas-actions :is([data-atlas-mode],[data-atlas-capture],[data-atlas-share])")].filter((button) => !button.hidden);
    } else if (available && template === "briefing" && dashboard.querySelector(".mode-dashboard--briefing.is-slides")) {
      // The Slides tab puts its own main action (Preview) in the bar.
      sources = [...dashboard.querySelectorAll(".briefing-slides-host [data-mobile-bar]")];
    } else if (available && template === "briefing") {
      sources = dashboard.querySelector(".presentation-empty")
        ? [...dashboard.querySelectorAll(".presentation-empty [data-presentation-setup]")]
        : [document.querySelector("[data-mobile-briefing-context]")].filter(Boolean);
    }
    const open = sources.length > 0;
    body.toggle("mobile-action-bar-open", open);
    const short = { "Connect a service": "Connect", "Add a file": "Add file", "Find a dataset": "Find data", "Guide to creating a briefing": "Briefing guide", "Open an example": "Example" };
    const label = (button) => button.dataset.barLabel || short[button.textContent.trim()] || button.textContent.trim();
    const signature = `${template}|${sources.map((button) => `${label(button)}:${button.disabled}:${button.getAttribute("aria-expanded")}`).join(",")}`;
    bar.hidden = !open;
    if (signature === this.mobileActionSignature) return;
    this.mobileActionSignature = signature;
    this.mobileActionSources = sources;
    bar.innerHTML = sources.map((button, index) => {
      const primary = button.dataset.mobileBar === "primary" || button.matches("[data-atlas-mode],[data-atlas-capture],[data-mobile-briefing-context]") || (template === "briefing" && index === 0 && !button.hasAttribute("data-mobile-bar"));
      const expanded = button.getAttribute("aria-expanded");
      return `<button type="button" data-action-proxy="${index}" class="${primary ? "is-primary" : ""}"${button.disabled ? " disabled" : ""}${expanded ? ` aria-expanded="${expanded}"` : ""}>${escapeHtml(label(button))}</button>`;
    }).join("");
  }

  #bindMobileDrawerResize() {
    const handle = document.querySelector("#mobile-drawer-handle");
    if (!handle) return;
    // Map tool sheets stop at 60% of the screen; Briefing and Tour sheets can grow to the top bar.
    const presentationSheet = () => !document.body.classList.contains("mobile-map-route") && ["briefing", "atlas"].includes(document.querySelector("#app")?.dataset.presentation);
    const variable = () => (presentationSheet() ? "--mobile-sheet-height" : "--mobile-tool-drawer-height");
    const clamp = (height) => {
      const sheetBottom = document.querySelector("#sidebar")?.getBoundingClientRect().bottom ?? window.innerHeight;
      const topLimit = document.querySelector(".mobile-map-brand")?.getBoundingClientRect().bottom ?? 0;
      const max = presentationSheet() ? sheetBottom - topLimit : window.innerHeight * 0.6;
      return Math.min(max, Math.max(window.innerHeight * 0.2, height));
    };
    const setHeight = (height) => {
      document.body.style.setProperty(variable(), `${clamp(height)}px`);
      requestAnimationFrame(() => this.mapController.resize());
    };
    handle.addEventListener("keydown", (event) => {
      const delta = ({ ArrowUp: 32, ArrowDown: -32 })[event.key];
      if (delta == null) return;
      event.preventDefault();
      const current = document.querySelector("#sidebar")?.getBoundingClientRect().height || window.innerHeight * 0.4;
      setHeight(current + delta);
    });
    handle.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      const startY = event.clientY;
      const startHeight = document.querySelector("#sidebar")?.getBoundingClientRect().height || window.innerHeight * 0.4;
      document.body.classList.add("mobile-drawer-resizing");
      handle.setPointerCapture?.(event.pointerId);
      const move = (moveEvent) => setHeight(startHeight + startY - moveEvent.clientY);
      const finish = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", finish);
        window.removeEventListener("pointercancel", finish);
        document.body.classList.remove("mobile-drawer-resizing");
        this.mapController.resize();
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", finish);
      window.addEventListener("pointercancel", finish);
    });
  }

  #bindMobileSheetResize() {
    for (const [handle, sheet, variable] of [
      ["#mobile-dialog-resize", "#app-dialog", "--mobile-dialog-height"],
      ["#mobile-utility-resize", "#utility-panel", "--mobile-utility-height"],
    ]) {
      bindMobileSheetResize({ handle: document.querySelector(handle), sheet: document.querySelector(sheet), variable, documentRef: document, windowRef: window, isCompact: () => this.mobileMedia.matches, onResize: () => this.mapController.resize() });
    }
  }

  #serviceDialog(serviceType, onLayerAdded = null) {
    const isWms = serviceType === "wms";
    const isWfs = serviceType === "wfs";
    const isGeoJson = serviceType === "geojson";
    const isTiles = serviceType === "vector-tiles";
    const title = isTiles ? "Add vector tiles (MVT)" : isWms ? "Add WMS service" : isWfs ? "Add WFS service" : isGeoJson ? "Add Geo URL" : "Add ArcGIS REST service";
    const placeholder = isTiles
      ? "https://tiles.example.com/my_table"
      : isWms
      ? "https://server.example/geoserver/wms"
      : isWfs
        ? "https://server.example/geoserver/wfs?SERVICE=WFS&REQUEST=GetFeature&TYPENAMES=workspace:layer"
      : isGeoJson
        ? "https://example.org/data/feed.geojson"
        : "https://server.example/arcgis/rest/services/...";
    this.openDialog({
      eyebrow: isTiles ? "Tiled data" : isGeoJson ? "Open vector data feed" : isWms || isWfs ? "Open geospatial service" : "ArcGIS Enterprise / Online",
      title,
      content: `<label class="field"><span>${isTiles ? "TileJSON endpoint or XYZ tile URL" : isGeoJson ? "GeoJSON or GeoParquet URL" : isWfs ? "WFS endpoint or GetFeature URL" : "Service URL"}</span><input id="service-url" type="url" placeholder="${placeholder}" /></label>
        <label class="field"><span>Layer title <small>optional</small></span><input id="service-title" /></label>
        <details class="studio-disclosure"><summary>Advanced settings</summary>
        ${isWfs ? '<label class="field"><span>Feature type <small>optional when included as TYPENAME in the URL</small></span><input id="wfs-name" placeholder="workspace:layer_name" /></label>' : ""}
        ${isTiles ? '<label class="field"><span>Source layer <small>optional; comma-separated. Required for XYZ URLs without metadata</small></span><input id="tiles-source-layer" placeholder="All layers in the TileJSON" /></label>' : ""}
        ${isWms || isWfs || isGeoJson || isTiles ? "" : `<label class="field"><span>Service type</span><select id="service-type"><option value="arcgis-auto">Detect automatically</option><option value="feature">Feature service / layer</option><option value="map-image">Map service</option><option value="imagery">Image service</option></select></label>`}
        ${isTiles ? "" : '<label class="field"><span>Refresh every <small>minutes; 0 disables</small></span><input id="service-refresh" type="number" min="0" step="0.5" value="0" /></label>'}
        <p class="form-note">${isTiles ? "Works with any Mapbox Vector Tile server: a TileJSON endpoint such as Martin, tileserver-gl or pg_tileserv, or an XYZ template like https://host/{z}/{x}/{y}.pbf. The server must allow CORS. Requires the MapLibre engine. Tiles are drawn, not downloaded as a dataset, so filtering, styling and tables are not available for them yet." : isGeoJson ? "Use a direct GeoJSON or GeoParquet file URL. The provider must permit CORS; GeoParquet also requires byte-range requests. Large GeoParquet files are shown as a bounded snapshot. Refresh settings apply to GeoJSON feeds, not GeoParquet snapshots." : isWfs ? "Requires WFS 2.0, GeoJSON output advertised by the server, and browser CORS access. Full GetFeature URLs are reduced to the service endpoint and their TYPENAME is detected automatically." : "Layer URLs and FeatureServer /query URLs are supported. Query URLs apply their where and outFields parameters; geometry is projected into the map automatically. The remote server must allow cross-origin browser requests (CORS)."}</p></details><p class="form-note" role="status" id="service-status"></p>`,
      actions: [{ label: isTiles ? "Add tiles" : isGeoJson ? "Add data" : isWfs ? "Add WFS layer" : "Add service", primary: true, handler: async () => {
        const button = this.dialog.querySelector(".button--primary");
        button.disabled = true;
        button.textContent = "Adding…";
        try {
          const sourceUrl = this.dialog.querySelector("#service-url").value;
          const { isParquetName, addGeoParquetLayer } = await import("./geoparquet-layer.js?v=0.54.0-queryui1");
          if (isGeoJson && isParquetName(sourceUrl)) {
            const result = await addGeoParquetLayer(this, { url: sourceUrl, title: this.dialog.querySelector("#service-title").value });
            if (result.tableOnly) {
              const { openDuckdbQueryWorkspace } = await import("./duckdb-query-workspace.js?v=0.57.0-spatial2");
              openDuckdbQueryWorkspace(this, this.applicationRuntime.duckdb, { selectedRelation: result.relation, message: "This Parquet file has no recognized GeoParquet geometry metadata. It was loaded as a table, not a map layer." });
              return;
            }
            this.dialog.close();
            this.toast(result.truncated ? `Showing the first ${result.limit} features; SQL can query the full source.` : `${result.layer.title} added from the remote GeoParquet source.`);
            await this.mapController.goToLayerOnInitialLoad(result.layer).catch(() => {});
            return;
          }
          const layer = await this.#addServiceOrBrowse({
            url: sourceUrl,
            title: this.dialog.querySelector("#service-title").value,
            serviceType: isTiles ? "vector-tiles" : isWms ? "wms" : isWfs ? "wfs" : isGeoJson ? "geojson" : this.dialog.querySelector("#service-type").value,
            wfsName: isWfs ? this.dialog.querySelector("#wfs-name").value : undefined,
            sourceLayer: isTiles ? this.dialog.querySelector("#tiles-source-layer").value : undefined,
            refreshInterval: Number(this.dialog.querySelector("#service-refresh")?.value || 0),
          });
          if (!layer) return;
          this.dialog.close();
          this.toast(`${layer.title} added.`);
          await this.mapController.goToLayerOnInitialLoad(layer).catch(() => {});
          await onLayerAdded?.(layer);
        } catch (error) {
          button.disabled = false;
            button.textContent = isTiles ? "Add tiles" : isGeoJson ? "Add data" : isWfs ? "Add WFS layer" : "Add service";
          this.dialog.querySelector("#service-status").textContent = error.message;
          this.error(error.message);
        }
      }}],
    });
    // Suggest a title from the service's name as a URL is typed or pasted; a title typed by hand is kept.
    const urlInput = this.dialog.querySelector("#service-url");
    const titleInput = this.dialog.querySelector("#service-title");
    let suggested = "";
    const suggest = () => {
      const name = serviceNameFromUrl(urlInput.value);
      if (titleInput.value.trim() && titleInput.value !== suggested) return;
      titleInput.value = name;
      suggested = name;
    };
    urlInput.addEventListener("input", suggest);
    urlInput.addEventListener("change", suggest);
  }

  #popularDataDialog(onLayerAdded = null) {
    this.openDialog({
      eyebrow: "Starter catalog",
      title: "Popular data services",
      content: `<section class="server-directory-card" aria-labelledby="server-directory-title">
        <div>
          <h3 id="server-directory-title">GIS Server Directory</h3>
          <p>Search the original directory of public government ArcGIS servers, then paste a selected top-level endpoint below.</p>
        </div>
        <div id="server-directory-form" class="server-directory-form">
          <label class="field" for="server-directory-url"><span>ArcGIS server endpoint</span></label>
          <div class="server-directory-input">
            <input id="server-directory-url" type="url" spellcheck="false" placeholder="https://server.example/arcgis/rest/services" />
            <button id="server-directory-browse" type="button">Browse services</button>
          </div>
          <p class="form-note">Use a top-level address ending in <code>/rest/services</code>. GISMap Online reads its folders and services live; the directory itself is not copied or indexed.</p>
        </div>
      </section>
      <div class="catalog-list">${POPULAR_SERVICES.map((service) => `
        <article class="catalog-card">
          <div><span class="eyebrow">${escapeHtml(service.provider)}</span><h3>${escapeHtml(service.title)}</h3><p>${escapeHtml(service.description)}</p></div>
          <button type="button" data-catalog-id="${escapeHtml(service.id)}">Add</button>
        </article>`).join("")}</div><p class="catalog-directory-link"><a href="https://mappingsupport.com/p/surf_gis/list-federal-state-county-city-GIS-servers.pdf" target="_blank" rel="noopener noreferrer">Find more public data services here ↗</a></p><p class="form-note">Edit <code>js/catalog.js</code> to curate this list.</p>`,
    });
    this.dialog.querySelector("#server-directory-browse").addEventListener("click", async () => {
      try {
        const rootUrl = normalizeArcGisDirectoryUrl(this.dialog.querySelector("#server-directory-url").value);
        const hostname = new URL(rootUrl).hostname;
        await this.#enterpriseCatalogDialog({
          id: "external-directory",
          title: `${hostname} services`,
          rootUrl,
          version: "Live ArcGIS server directory",
        });
      } catch (error) {
        this.error(error.message);
      }
    });
    this.dialog.querySelectorAll("[data-catalog-id]").forEach((button) =>
      button.addEventListener("click", async () => {
        const service = POPULAR_SERVICES.find((item) => item.id === button.dataset.catalogId);
        button.disabled = true;
        try {
          const layer = await this.#addServiceOrBrowse(service);
          if (layer) {
            button.textContent = "Added";
            this.toast(`${service.title} added.`);
            this.activateExampleGuide(service);
            await onLayerAdded?.(layer);
          }
        } catch (error) {
          button.disabled = false;
          this.error(error.message);
        }
      }),
    );
  }

  async #addServiceOrBrowse(config) {
    const url = config.url?.trim().replace(/\/+$/, "");
    if (/\/FeatureServer$/i.test(url || "")) {
      const layers = await this.mapController.discoverFeatureServiceLayers(url);
      if (!layers.length) throw new Error("This FeatureServer does not advertise any feature layers.");
      if (layers.length === 1) return this.mapController.addService({ ...config, url: layers[0].url, title: config.title || layers[0].name });
      this.#featureServiceLayersDialog(config, layers);
      return null;
    }
    return this.mapController.addService(config);
  }

  async #openExampleHistoricalQuakesBriefing({ signal, startTutorial = false, present = false, slide = null } = {}) {
    if (this.exampleBriefingLoading) return false;
    const project = this.projectManager.current;
    if (project.presentation?.briefing?.slides?.length && !confirm('Replace the current briefing slides with the example? Your map layers will be kept.')) return false;
    const originalBriefing = JSON.stringify(project.presentation?.briefing || null);
    this.exampleBriefingLoading = true;
    this.toast('Loading the Historical Quakes briefing example…');
    try {
      const load = async () => {
        const existing = this.mapController.getLayers().find((layer) => {
          const config = this.mapController.getLayerConfig(layer) || {};
          return String(config.url || '').replace(/\/+$/, '').toLowerCase() === HISTORICAL_QUAKES_SOURCE.toLowerCase()
            && String(config.definitionExpression || '').trim() === HISTORICAL_QUAKES_WHERE;
        });
        if (existing) return existing;
        const [layer] = await this.loadLayer({
          url: HISTORICAL_QUAKES_SOURCE,
          title: 'Historical Quakes — M6.5+',
          serviceType: 'arcgis-auto',
          definitionExpression: HISTORICAL_QUAKES_WHERE,
        });
        return layer;
      };
      const earthquakeLayer = await load();
      // The completed example deliberately starts in a map-scale view. Keep
      // the service available while its opening views move; otherwise its
      // publisher scale threshold can turn the Brief into an empty globe.
      this.mapController.ignoreScaleRange?.(earthquakeLayer.uid, true);
      if (signal?.aborted) return false;
      if (this.projectManager.current !== project) throw new Error('The project changed while the example was loading.');
      if (JSON.stringify(project.presentation?.briefing || null) !== originalBriefing) throw new Error('The briefing changed while the example was loading, so it was not replaced.');
      const earthquakeRef = briefingLayerRef(this.mapController, earthquakeLayer);
      const { features: featuredEvents = [] } = await this.mapController.queryFeatures(earthquakeLayer.uid, {
        where: HISTORICAL_QUAKES_WHERE,
        outFields: ['OBJECTID', 'title', 'place', 'mag', 'time', 'depth', 'sig'],
        returnGeometry: true,
        orderByFields: ['mag DESC', 'time DESC'],
        num: 3,
      }, { layerDefaults: false });
      if (signal?.aborted) return false;
      const briefing = createHistoricalQuakesExampleBriefing({ quakeRef: earthquakeRef, featuredEvents });
      this.briefingTab = 'slides';
      const current = this.projectManager.current.presentation || {};
      this.projectManager.setPresentation({ ...current, template: 'briefing', title: 'Historical earthquakes', primaryLayerId: earthquakeLayer.uid, briefing, briefingSelection: { layerId: earthquakeLayer.uid, ids: [], useAll: true } });
      this.activateExampleGuide({
        id: 'historical-quakes-briefing',
        title: 'Historical Quakes briefing',
        description: 'A stable earthquake archive with finished slides, moving map views, and a presentation-only seismic pulse.',
        whyUseful: 'Follow the step-by-step guide to inspect the source, focus the data, see the pulse effect, and adapt the briefing.',
        tutorial: 'historical-quakes-briefing',
      }, { start: startTutorial });
      this.events.publish('mobile:workflow-route', { route: 'briefing' });
      if (present) {
        await this.presentationLoading;
        const visible = briefing.slides.filter((item) => !item.hidden);
        this.briefingSlides.openPlayer(visible.some((item) => item.id === slide) ? slide : visible[0]?.id);
      }
      this.toast('Historical Quakes briefing ready. It uses a stable Feature Service, moving map views, and a seismic pulse.');
      return true;
    } catch (error) {
      this.error(`Could not open the example briefing: ${error.message}. Any layers already added remain on the map.`);
      return false;
    } finally {
      this.exampleBriefingLoading = false;
    }
  }

  #featureServiceLayersDialog(config, layers) {
    this.openDialog({
      eyebrow: "ArcGIS feature service",
      title: config.title?.trim() || "Select layers",
      content: `<div class="feature-service-actions"><p class="form-note">This service contains multiple layers. Add individual datasets or bring them all into the map at once.</p><button type="button" data-add-all-feature-service>Add all layers</button></div>
        <div class="enterprise-list">${layers.map((layer) => `<div class="enterprise-row">
          <span><strong>${escapeHtml(layer.name)}</strong><small>${escapeHtml(layer.geometryType)} · Layer ${layer.id}</small></span>
          <button type="button" data-feature-service-layer="${escapeHtml(layer.url)}">Add</button>
        </div>`).join("")}</div>`,
    });
    const addLayer = async (layerInfo, button, { zoom = true } = {}) => {
      button.disabled = true;
      button.textContent = "Adding…";
      try {
        const layer = await this.mapController.addService({
          ...config,
          url: layerInfo.url,
          title: layerInfo.name,
          serviceType: "feature",
        });
        button.textContent = "Added";
        if (zoom) await this.mapController.goToLayerOnInitialLoad(layer).catch(() => {});
        return layer;
      } catch (error) {
        button.disabled = false;
        button.textContent = "Add";
        throw error;
      }
    };
    this.dialog.querySelectorAll("[data-feature-service-layer]").forEach((button) =>
      button.addEventListener("click", async () => {
        const layerInfo = layers.find((item) => item.url === button.dataset.featureServiceLayer);
        try {
          const layer = await addLayer(layerInfo, button);
          this.toast(`${layer.title} added.`);
        } catch (error) {
          this.error(error.message);
        }
      }),
    );
    this.dialog.querySelector("[data-add-all-feature-service]")?.addEventListener("click", async (event) => {
      const addAllButton = event.currentTarget;
      addAllButton.disabled = true;
      const added = [];
      const failures = [];
      for (let index = 0; index < layers.length; index += 1) {
        const layerInfo = layers[index];
        const layerButton = this.dialog.querySelector(`[data-feature-service-layer="${CSS.escape(layerInfo.url)}"]`);
        if (layerButton?.textContent === "Added") continue;
        addAllButton.textContent = `Adding ${index + 1} of ${layers.length}…`;
        try {
          const layer = await addLayer(layerInfo, layerButton, { zoom: false });
          added.push(layer);
        } catch (error) {
          failures.push(layerInfo.name);
        }
      }
      addAllButton.textContent = failures.length ? "Retry failed layers" : "All layers added";
      addAllButton.disabled = failures.length === 0;
      if (added[0]) await this.mapController.goToLayerOnInitialLoad(added[0]).catch(() => {});
      if (added.length) this.toast(`${added.length} layer${added.length === 1 ? "" : "s"} added.`);
      if (failures.length) this.error(`Could not add: ${failures.join(", ")}.`);
    });
  }

  async #enterpriseCatalogDialog(catalogIdOrDefinition) {
    const definition = typeof catalogIdOrDefinition === "string"
      ? ENTERPRISE_CATALOGS.find((item) => item.id === catalogIdOrDefinition)
      : catalogIdOrDefinition;
    if (!definition) throw new Error("That ArcGIS service directory is not configured.");
    const catalog = new EnterpriseCatalog(definition);
    this.openDialog({
      eyebrow: definition.version,
      title: definition.title,
      content: '<div class="loading-row"><span></span> Reading service directory…</div>',
    });

    const render = async (folder = "") => {
      const content = document.querySelector("#dialog-content");
      content.innerHTML = '<div class="loading-row"><span></span> Reading service directory…</div>';
      try {
        const listing = await catalog.browse(folder);
        const parent = listing.folder.includes("/")
          ? listing.folder.split("/").slice(0, -1).join("/")
          : "";
        content.innerHTML = `<div class="catalog-path"><button data-enterprise-folder="${escapeHtml(parent)}" ${listing.folder ? "" : "disabled"}>← Back</button><code>/${escapeHtml(listing.folder)}</code></div>
          <div class="enterprise-list">
            ${listing.folders.map((name) => `<button class="enterprise-row" data-enterprise-folder="${escapeHtml(name)}"><span><strong>${escapeHtml(name.split("/").pop())}</strong><small>Folder</small></span><b>→</b></button>`).join("")}
            ${listing.services.map((service) => `<div class="enterprise-row"><span><strong>${escapeHtml(service.name.split("/").pop())}</strong><small>${escapeHtml(service.type)}</small></span><button data-enterprise-service="${escapeHtml(service.url)}" data-service-type="${escapeHtml(service.serviceType)}">Add</button></div>`).join("")}
          </div>
          ${!listing.folders.length && !listing.services.length ? '<div class="empty-state">This folder is empty.</div>' : ""}
          <p class="form-note">Services are discovered live from <code>${escapeHtml(definition.rootUrl)}</code>. Availability and access are controlled by the service owner.</p>`;
        content.querySelectorAll("[data-enterprise-folder]").forEach((button) =>
          button.addEventListener("click", () => render(button.dataset.enterpriseFolder)),
        );
        content.querySelectorAll("[data-enterprise-service]").forEach((button) =>
          button.addEventListener("click", async () => {
            button.disabled = true;
            button.textContent = "Adding…";
            try {
              const layer = await this.mapController.addService({
                url: button.dataset.enterpriseService,
                serviceType: button.dataset.serviceType,
              });
              button.textContent = "Added";
              this.toast(`${layer.title} added.`);
              await this.mapController.goToLayerOnInitialLoad(layer).catch(() => {});
            } catch (error) {
              button.disabled = false;
              button.textContent = "Add";
              this.error(error.message);
            }
          }),
        );
      } catch (error) {
        content.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}<br />The server may not allow cross-origin browser access.</div>`;
      }
    };
    await render();
  }

  #customToolDialog() {
    this.openDialog({
      eyebrow: "Extensibility",
      title: "Load a custom JavaScript tool",
      content: `<div class="warning-box"><strong>Only load code you trust.</strong><p>A local module runs with this page's browser permissions. It can access map data and browser storage.</p></div><p class="form-note">Contract: export a default async function receiving <code>{ events, map, view, getLayers }</code>. Return an object with an optional <code>id</code> and <code>title</code>.</p>`,
      actions: [{ label: "Choose JavaScript file", primary: true, handler: () => {
        this.dialog.close();
        document.querySelector("#tool-file-input").click();
      }}],
    });
  }

  #connectionsDialog() {
    const callbackUrl = this.authController.getCallbackUrl();
    const redirectUrl = this.authController.getRedirectUrl();
    const connections = this.authController.list();
    const connectionCards = connections.length
      ? connections.map((connection) => {
          const url = connection.type === "portal" ? connection.portalUrl : connection.serverUrl;
          return `<article class="connection-card" data-connection-id="${escapeHtml(connection.id)}">
            <div class="connection-card__head">
              <div><strong>${escapeHtml(connection.name)}</strong><small>${connection.type === "portal" ? `Portal OAuth · ${connection.loginMode || "popup"}` : connection.authMode === "web-tier" ? "Standalone Server · web-tier" : "Standalone Server · token"}</small></div>
              <span class="connection-badge" data-connection-status>Checking…</span>
            </div>
            <code title="${escapeHtml(url)}">${escapeHtml(url)}</code>
            <div class="connection-card__actions">
              <button type="button" data-connect-id="${escapeHtml(connection.id)}">Connect</button>
              <button type="button" data-test-connection-id="${escapeHtml(connection.id)}">Test</button>
              <button type="button" class="button--quiet" data-remove-connection="${escapeHtml(connection.id)}">Remove</button>
            </div>
          </article>`;
        }).join("")
      : '<div class="empty-state">No server connections are configured in this browser.</div>';

    this.openDialog({
      eyebrow: "Connection setup",
      title: "Add a Server",
      content: `<section class="connection-manager">
          <div id="connection-list" class="connection-list">${connectionCards}</div>

          <label class="field"><span>Server configuration</span><select id="connection-kind"><option value="">Choose a configuration…</option><option value="portal">ArcGIS Portal or ArcGIS Online</option><option value="standalone">Standalone server</option></select></label>

          <section class="connection-setup" data-connection-config="portal" hidden>
            <h3>ArcGIS Portal or ArcGIS Online</h3>
            <div class="connection-setup__body">
              <div class="field-grid">
                <label class="field"><span>Connection name <small>optional</small></span><input id="portal-connection-name" placeholder="Acme GIS" /></label>
                <label class="field"><span>Portal URL</span><input id="portal-connection-url" type="url" value="https://www.arcgis.com" placeholder="https://gis.example.com/portal" /></label>
              </div>
              <label class="field"><span>GISMap Online application / Client ID</span><input id="portal-client-id" autocomplete="off" placeholder="Public OAuth application ID" /></label>
              <label class="field"><span>Sign-in presentation</span><select id="portal-login-mode"><option value="popup">Popup window</option><option value="redirect">Full-page redirect</option></select></label>
              <label class="field"><span>URI to register for popup mode</span><div class="copy-field"><input id="portal-callback-url" readonly value="${escapeHtml(callbackUrl)}" /><button type="button" data-copy-uri="${escapeHtml(callbackUrl)}">Copy</button></div></label>
              <label class="field"><span>URI to register for redirect mode</span><div class="copy-field"><input id="portal-redirect-url" readonly value="${escapeHtml(redirectUrl)}" /><button type="button" data-copy-uri="${escapeHtml(redirectUrl)}">Copy</button></div></label>
              <button type="button" id="add-portal-connection" class="inline-primary">Save &amp; connect</button>
              <p class="form-note">The organization administrator registers this application once and supplies its public Client ID. Sign-in uses OAuth authorization code + PKCE when supported; no client secret belongs in this browser app.</p>
            </div>
          </section>

          <section class="connection-setup" data-connection-config="standalone" hidden>
            <h3>Standalone server</h3>
            <div class="connection-setup__body">
              <label class="field"><span>Authentication</span><select id="standalone-auth-mode"><option value="token">Token authentication</option><option value="web-tier">Web-tier authentication</option></select></label>
              <label class="field"><span>Connection name <small>optional</small></span><input id="standalone-server-name" placeholder="Parcel server" /></label>
              <label class="field"><span>Server root URL</span><input id="standalone-server-url" type="url" placeholder="https://gis.example.com/server" /></label>
              <label class="field" data-token-service-field><span>Token service URL <small>discovered automatically when possible</small></span><input id="standalone-server-token-url" type="url" placeholder="https://gis.example.com/server/tokens/generateToken" /></label>
              <button type="button" id="add-standalone-server" class="inline-primary">Save &amp; connect</button>
              <p class="form-note" data-standalone-help>Use this only for a secured, non-federated server. IdentityManager owns the credential challenge and token; this application does not read or serialize usernames, passwords, or tokens.</p>
            </div>
          </section>

          <section id="connection-test-report" class="connection-report" hidden></section>

          <div class="warning-box connection-security"><strong>Project portability and security</strong><p>Connection names, URLs, and public Client IDs are saved locally and included in project exports. Credentials and access tokens are never added to a .gis or .gisx file. Imported projects require a fresh sign-in. The selected server must use HTTPS and allow this site through CORS.</p></div>
        </section>`,
      actions: connections.length ? [{ label: "Sign out all", handler: () => {
        this.authController.signOutAll();
        this.#connectionsDialog();
        this.toast("Signed out of server connections for this browser session.");
      }}] : [],
    });

    const setBusy = (button, busy, label) => {
      button.disabled = busy;
      button.textContent = busy ? "Connecting…" : label;
    };
    const renderReport = (report) => {
      const target = this.dialog.querySelector("#connection-test-report");
      const rows = [
        ["Endpoint", report.url],
        ["ArcGIS version", report.version || "Not reported"],
        ["Authentication", report.authentication],
        ["Token endpoint", report.tokenServiceUrl || "Not advertised"],
        ["CORS", report.cors ? "Browser request succeeded" : "Failed"],
        ["Federated", report.federated == null ? "Not applicable" : report.federated ? "Yes" : "No"],
        ["Owning Portal", report.owningSystemUrl || "None"],
        ["Organization", report.organization || "Not reported"],
        ["Response time", `${report.responseMs} ms`],
      ];
      target.innerHTML = `<strong>Connection test</strong><dl>${rows.map(([key, value]) => `<div><dt>${escapeHtml(key)}</dt><dd>${escapeHtml(String(value))}</dd></div>`).join("")}</dl>${report.federated && !report.portalConnectionId ? `<p>Add the owning Portal above with an OAuth Client ID. Federated Server credentials must be issued by that Portal.</p>` : ""}`;
      target.hidden = false;
      target.scrollIntoView({ block: "nearest" });
    };
    const configurationInput = this.dialog.querySelector("#connection-kind");
    const standaloneAuthInput = this.dialog.querySelector("#standalone-auth-mode");
    const syncConfiguration = () => {
      const kind = configurationInput.value;
      this.dialog.querySelectorAll("[data-connection-config]").forEach((section) => {
        section.hidden = section.dataset.connectionConfig !== kind;
      });
    };
    const syncStandaloneAuth = () => {
      const webTier = standaloneAuthInput.value === "web-tier";
      this.dialog.querySelector("[data-token-service-field]").hidden = webTier;
      this.dialog.querySelector("#add-standalone-server").textContent = webTier ? "Save & test browser access" : "Save & connect";
      this.dialog.querySelector("[data-standalone-help]").textContent = webTier
        ? "For IWA, PKI, or reverse-proxy authentication managed by the browser and web tier. This requires correct TLS, credentialed CORS, and usually the organization's network or VPN."
        : "Use this only for a secured, non-federated server. IdentityManager owns the credential challenge and token; this application does not read or serialize usernames, passwords, or tokens.";
    };
    configurationInput.addEventListener("change", syncConfiguration);
    standaloneAuthInput.addEventListener("change", syncStandaloneAuth);
    syncConfiguration();
    syncStandaloneAuth();
    this.dialog.querySelectorAll("[data-copy-uri]").forEach((button) => button.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(button.dataset.copyUri);
        this.toast("URI copied.");
      } catch {
        button.previousElementSibling.select();
        this.toast("URI selected. Copy it from the field.");
      }
    }));
    this.dialog.querySelector("#add-portal-connection").addEventListener("click", async (event) => {
      const button = event.currentTarget;
      setBusy(button, true, "Save & connect");
      try {
        const connection = this.authController.addPortal({
          name: this.dialog.querySelector("#portal-connection-name").value,
          portalUrl: this.dialog.querySelector("#portal-connection-url").value,
          clientId: this.dialog.querySelector("#portal-client-id").value,
          loginMode: this.dialog.querySelector("#portal-login-mode").value,
        });
        await this.authController.connect(connection.id);
        this.#connectionsDialog();
      } catch (error) {
        setBusy(button, false, "Save & connect");
        this.error(error.message);
      }
    });
    this.dialog.querySelector("#add-standalone-server").addEventListener("click", async (event) => {
      const button = event.currentTarget;
      const authMode = standaloneAuthInput.value;
      setBusy(button, true, authMode === "web-tier" ? "Save & test browser access" : "Save & connect");
      try {
        const serverUrl = this.dialog.querySelector("#standalone-server-url").value;
        const report = await this.authController.inspectServer(serverUrl, authMode);
        if (report.federated) throw new Error(`This Server is federated. Add its owning Portal (${report.owningSystemUrl}) and use Portal OAuth instead.`);
        const connection = this.authController.addServer({
          name: this.dialog.querySelector("#standalone-server-name").value,
          serverUrl,
          tokenServiceUrl: authMode === "token" ? this.dialog.querySelector("#standalone-server-token-url").value || report.tokenServiceUrl : undefined,
          authMode,
        });
        if (authMode === "token") await this.authController.connect(connection.id);
        this.#connectionsDialog();
      } catch (error) {
        setBusy(button, false, authMode === "web-tier" ? "Save & test browser access" : "Save & connect");
        this.error(error.message);
      }
    });
    this.dialog.querySelectorAll("[data-connect-id]").forEach((button) => {
      button.addEventListener("click", async () => {
        setBusy(button, true, "Connect");
        try {
          await this.authController.connect(button.dataset.connectId);
          this.#connectionsDialog();
        } catch (error) {
          setBusy(button, false, "Connect");
          this.error(error.message);
        }
      });
    });
    this.dialog.querySelectorAll("[data-test-connection-id]").forEach((button) => {
      button.addEventListener("click", async () => {
        setBusy(button, true, "Test");
        try {
          renderReport(await this.authController.testConnection(button.dataset.testConnectionId));
          setBusy(button, false, "Test");
        } catch (error) {
          setBusy(button, false, "Test");
          this.error(error.message);
        }
      });
    });
    this.dialog.querySelectorAll("[data-remove-connection]").forEach((button) => {
      button.addEventListener("click", () => {
        if (!confirm("Remove this server connection definition and sign out of its active session?")) return;
        this.authController.remove(button.dataset.removeConnection);
        this.#connectionsDialog();
      });
    });
    this.authController.getStatuses().then((items) => {
      for (const { connection, status } of items) {
        const card = this.dialog.querySelector(`[data-connection-id="${CSS.escape(connection.id)}"]`);
        const badge = card?.querySelector("[data-connection-status]");
        const connect = card?.querySelector("[data-connect-id]");
        if (!badge) continue;
        badge.textContent = status.signedIn ? status.userId || "Connected" : "Not signed in";
        badge.classList.toggle("is-connected", status.signedIn);
        if (connect) connect.textContent = status.signedIn ? "Reconnect" : "Connect";
      }
    }).catch(() => {});
  }

  #aiDialog() {
    const config = this.aiController.config ?? {};
    const provider = config.provider || "ollama";
    const appOrigin = location.origin;
    const defaults = {
      ollama: ["http://localhost:11434", "llama3.2"],
      openai: ["https://api.openai.com/v1", "gpt-6-astra"],
      anthropic: ["https://api.anthropic.com/v1", "claude-sonnet-5"],
      "openai-compatible": ["", ""],
    };
    const readForm = () => ({
      provider: this.dialog.querySelector("#ai-provider").value,
      endpoint: this.dialog.querySelector("#ai-endpoint").value,
      model: this.dialog.querySelector("#ai-model").value,
      token: this.dialog.querySelector("#ai-token").value,
    });
    const setConnectionStatus = (state, message) => {
      const status = this.dialog.querySelector("#ai-connection-status");
      status.className = `connection-status connection-status--${state}`;
      status.textContent = message;
      status.hidden = false;
    };
    const testConnection = async () => {
      const pending = readForm();
      const isOllama = pending.provider === "ollama";
      setConnectionStatus("testing", isOllama ? "Checking Ollama and installed models…" : "Checking provider credentials and model access…");
      try {
        const result = await this.aiController.testConnection(pending);
        if (isOllama) {
          this.dialog.querySelector("#ollama-models").innerHTML = result.models
            .map((name) => `<option value="${escapeHtml(name)}"></option>`)
            .join("");
          setConnectionStatus(
            "success",
            `Connected. ${result.models.length} installed model${result.models.length === 1 ? "" : "s"} found.`,
          );
        } else {
          setConnectionStatus("success", `Connected. ${result.model || pending.model} is available to this API key.`);
        }
        return result;
      } catch (error) {
        setConnectionStatus("error", error.message);
        throw error;
      }
    };
    const actions = [];
    if (config.provider) {
      actions.push({ label: "Disable AI", handler: () => {
        this.aiController.disable();
        this.dialog.close();
        this.toast("AI intelligence disabled.");
      }});
    }
    actions.push({ label: "Test connection", handler: async () => {
      try {
        await testConnection();
      } catch (error) {
        this.error(error.message);
      }
    }});
    actions.push({ label: "Use for this tab", primary: true, handler: async () => {
      const button = this.dialog.querySelector(".button--primary");
      button.disabled = true;
      button.textContent = "Checking…";
      try {
        const pending = readForm();
        if (pending.provider === "ollama") await testConnection();
        this.aiController.configure(pending);
        this.dialog.close();
        this.toast("AI enabled for this tab.");
      } catch (error) {
        this.error(error.message);
      } finally {
        button.disabled = false;
        button.textContent = "Use for this tab";
      }
    }});
    this.openDialog({
      eyebrow: "AI adapter",
      title: "Configure intelligence provider",
      content: `<label class="field"><span>Provider</span><select id="ai-provider"><option value="ollama" ${provider === "ollama" ? "selected" : ""}>Ollama (local)</option><option value="openai" ${provider === "openai" ? "selected" : ""}>OpenAI</option><option value="anthropic" ${provider === "anthropic" ? "selected" : ""}>Anthropic Claude</option><option value="openai-compatible" ${provider === "openai-compatible" ? "selected" : ""}>OpenAI-compatible endpoint</option></select></label>
        <label class="field"><span>Endpoint</span><input id="ai-endpoint" type="url" value="${escapeHtml(config.endpoint || defaults[provider][0])}" /></label>
        <label class="field"><span>Model</span><input id="ai-model" list="ollama-models" value="${escapeHtml(config.model || defaults[provider][1])}" /><datalist id="ollama-models"></datalist><small id="ai-model-hint">Use the complete Ollama tag, including a suffix such as <code>:27b</code>.</small></label>
        <label class="field"><span>API token <small>online providers only</small></span><input id="ai-token" type="password" autocomplete="off" /></label>
        <section id="ollama-setup" class="ollama-setup" ${provider === "ollama" ? "" : "hidden"}>
          <strong>One-time Ollama browser access on macOS</strong>
          <p>Ollama must allow this exact site origin. Run this in Terminal:</p>
          <code>launchctl setenv OLLAMA_ORIGINS &quot;${escapeHtml(appOrigin)}&quot;</code>
          <p>Then fully quit Ollama from its menu-bar icon, reopen it, and choose <b>Test Ollama</b>.</p>
          <small>Keeping the permission scoped to ${escapeHtml(appOrigin)} is safer than using <code>*</code>. Ollama's local API has no authentication.</small>
        </section>
        <div id="ai-connection-status" class="connection-status" hidden></div>
        <p class="form-note">Provider, endpoint, and model may be remembered locally. API tokens remain only in page memory and are never saved or exported; re-enter them after a reload. Direct browser keys are appropriate only for personal testing. Use a controlled proxy for a public paid service.</p>
        <p class="form-note"><a href="${appUrl("ai-connection-guide/")}" target="_blank" rel="noopener">Read the AI connection guide ↗</a></p>`,
      actions,
    });
    const providerInput = this.dialog.querySelector("#ai-provider");
    const syncProviderForm = () => {
      const [endpoint, model] = defaults[providerInput.value];
      if (document.activeElement === providerInput) {
        this.dialog.querySelector("#ai-endpoint").value = endpoint;
        this.dialog.querySelector("#ai-model").value = model;
      }
      this.dialog.querySelector("#ollama-setup").hidden = providerInput.value !== "ollama";
      this.dialog.querySelector("#ai-model-hint").innerHTML = providerInput.value === "ollama"
        ? 'Use the complete Ollama tag, including a suffix such as <code>:27b</code>.'
        : providerInput.value === "openai"
          ? "Enter an OpenAI API model identifier available to this API key. OpenAI uses the Responses API."
          : "Enter the model identifier accepted by this provider.";
      this.dialog.querySelector("#ai-connection-status").hidden = true;
    };
    providerInput.addEventListener("change", syncProviderForm);
    syncProviderForm();
  }

  #aboutDialog() {
    const brand = this.#readInstallationBrand();
    this.openDialog({
      eyebrow: "About this application",
      title: brand.name,
      content: `<div class="about-copy"><p>${escapeHtml(brand.name)} is a browser-based geospatial application for mapping, analysis, briefings, tours, and field tasks.</p><p><strong>GISMap Online home version:</strong> This installation is built from the GISMap Online project. Visit <a href="https://gismap.online/" target="_blank" rel="noopener noreferrer">GISMap Online ↗</a> for the home version, public examples, guides, and project updates.</p><p><a href="${appUrl("examples/")}">Browse available examples</a> or read the <a href="${appUrl("guides/")}">application guides</a>.</p><dl><div><dt>Version</dt><dd>${APP_VERSION}</dd></div><div><dt>Map engine</dt><dd>${escapeHtml(this.mapController.getEngineId() === "maplibre" ? "MapLibre" : "ArcGIS")}</dd></div><div><dt>Runtime</dt><dd>Static HTML + ES modules</dd></div><div><dt>Persistence</dt><dd>localStorage + portable ZIP</dd></div><div><dt>Identity</dt><dd>Optional Portal OAuth / server authentication</dd></div><div><dt>Privacy</dt><dd>No GISMap Online account or database; credentials are excluded from projects</dd></div></dl></div>`,
    });
  }

  #presentationLayer(presentation) {
    const layers = this.mapController.getLayers();
    return layers.find((layer) => layer.uid === presentation.primaryLayerId && layer.queryable)
      || layers.find((layer) => layer.queryable)
      || null;
  }

  #presentationFields(layer) {
    const fields = (layer?.fields || []).filter((field) => field?.name && !/^(objectid|shape|fid)$/i.test(field.name));
    const text = fields.filter((field) => /string|guid|oid/i.test(field.type || ""));
    const numeric = fields.filter((field) => /small-integer|integer|single|double|long/i.test(field.type || ""));
    const dates = fields.filter((field) => /date/i.test(field.type || ""));
    return { fields, text, numeric, dates };
  }

  #presentationRoles(presentation, layer, fields = this.#presentationFields(layer)) {
    const mappings = presentation.fieldMappings || {};
    const names = new Set(fields.fields.map((field) => field.name));
    const mapped = (role) => names.has(mappings[role]) ? mappings[role] : null;
    const matching = (list, pattern) => list.find((field) => pattern.test(`${field.name} ${field.alias || ""}`))?.name || null;
    return {
      // No name-like field: the record label picks the most distinguishing text field instead.
      title: mapped("title") || matching(fields.text, /location|station|site|name|title/i) || null,
      metric: mapped("metric") || matching(fields.numeric, /value|measure|concentration|amount|magnitude|score/i) || fields.numeric[0]?.name || null,
      // UnitID-style fields are commonly organizational identifiers. Only an
      // explicit mapping or a schema field named exactly "unit" is trusted.
      unit: mapped("unit") || fields.text.find((field) => /^(unit|units|uom)$/i.test(field.name))?.name || null,
      timestamp: mapped("timestamp") || matching([...fields.dates, ...fields.text], /observ|measure|sample|date|time|updated/i),
      category: mapped("category"),
      source: mapped("source") || matching(fields.text, /^(?:url|source_url|link)$/i),
    };
  }

  async #loadPresentationRecords(presentation) {
    const layer = this.#presentationLayer(presentation);
    const prior = this.presentationState.template === presentation.template ? this.presentationState : {};
    this.briefingRequest.cancel();
    const sameLayer = prior.layerUid && prior.layerUid === layer?.uid;
    this.presentationState = { ...prior, conditions: sameLayer ? prior.conditions || [] : [], conditionLogic: sameLayer ? prior.conditionLogic || "and" : "and", groupField: sameLayer ? prior.groupField || null : null, mapSelect: false, template: presentation.template, layerUid: layer?.uid || null, records: [], visibleRecords: [], selected: null, selectedIds: new Set(), search: "", searchField: "*", searchOperator: "contains", chartField: null, scope: "all", rangeMin: null, rangeMax: null, totalCount: null, sortField: null, sortDirection: "asc", page: 1, pageSize: 25, binCount: 12, fetchedAt: new Date().toISOString() };
    if (!layer) return this.#renderPresentationDashboard(presentation);
    try {
      const query = { where: layer.where || "1=1", outFields: ["*"], returnGeometry: true, num: 500 };
      const response = await this.mapController.queryFeatures(layer.uid, query);
      let totalCount = null;
      try { totalCount = await this.mapController.queryFeatureCount(layer.uid, query); } catch { /* Count metadata is optional. */ }
      if (this.presentationState.layerUid !== layer.uid) return;
      const features = response.features || [];
      if (presentation.template === "briefing") features.push(...await this.#missingSlideFeatures(layer, features));
      if (this.presentationState.layerUid !== layer.uid) return;
      this.presentationState.records = features.map((feature) => this.#toRecord(feature, layer));
      this.presentationState.totalCount = Number.isFinite(totalCount) ? totalCount : null;
      const fields = this.#presentationFields(layer);
      const roles = this.#presentationRoles(presentation, layer, fields);
      this.presentationState.roles = roles;
      this.presentationState.searchField = roles.title || "*";
      this.presentationState.chartField = roles.metric || fields.numeric[0]?.name || null;
      this.presentationState.sortField = roles.title || fields.fields[0]?.name || null;
      const metricValues = this.presentationState.records.map((record) => Number(record.attributes?.[roles.metric])).filter(Number.isFinite);
      this.presentationState.metricMin = metricValues.length ? Math.min(...metricValues) : null;
      this.presentationState.metricMax = metricValues.length ? Math.max(...metricValues) : null;
      this.presentationState.metricUnit = this.presentationState.records.map((record) => record.attributes?.[roles.unit]).find(Boolean) || "";
      if (presentation.template === "briefing") this.#restoreBriefingSelection(layer);
      this.#filterPresentationRecords();
      // The first page shows quickly; the rest of the layer follows in the background.
      if (Number.isFinite(totalCount) && totalCount > features.length) void this.#loadRemainingRecords(layer, this.presentationState);
    } catch (error) {
      this.presentationState.error = error.message;
      this.#renderPresentationDashboard(presentation);
    }
  }

  /**
   * Loads the rest of a layer's records in stable, ID-ordered pages (up to
   * MAX_PRESENTATION_RECORDS), then redraws once. A newer load or another
   * layer abandons it.
   */
  async #loadRemainingRecords(layer, state) {
    const idField = layer.objectIdField;
    const total = Math.min(state.totalCount, MAX_PRESENTATION_RECORDS);
    const seen = new Set(state.records.map((record) => featureId(record, idField)).filter(Boolean));
    const added = [];
    try {
      for (let start = 0; start < total; start += PRESENTATION_PAGE_SIZE) {
        const query = { where: layer.where || "1=1", outFields: ["*"], returnGeometry: true, start, num: PRESENTATION_PAGE_SIZE, ...(idField ? { orderByFields: [idField] } : {}) };
        const response = await this.mapController.queryFeatures(layer.uid, query);
        if (this.presentationState !== state || state.layerUid !== layer.uid) return;
        const page = response.features || [];
        for (const feature of page) {
          const record = this.#toRecord(feature, layer);
          const id = featureId(record, idField);
          if (id && seen.has(id)) continue;
          if (id) seen.add(id);
          added.push(record);
        }
        if (!page.length) break;
      }
    } catch (error) {
      if (this.presentationState === state) this.toast(`Loaded the first ${state.records.length.toLocaleString()} features; the rest could not be read (${error.message}).`);
    }
    if (this.presentationState !== state || !added.length) return;
    state.records.push(...added);
    const metric = state.roles?.metric;
    const values = state.records.map((record) => Number(record.attributes?.[metric])).filter(Number.isFinite);
    if (values.length) { state.metricMin = Math.min(...values); state.metricMax = Math.max(...values); }
    this.#filterPresentationRecords();
  }

  /** Slides can point at features beyond the first page of records; fetch those by ID. */
  async #missingSlideFeatures(layer, features) {
    const idField = layer.objectIdField;
    const slides = this.projectManager.current.presentation?.briefing?.slides || [];
    if (!idField || !slides.length) return [];
    const loaded = new Set(features.map((feature) => String(feature.attributes?.[idField])));
    const missing = [...new Set(slides.map((slide) => slide.featureId).filter((id) => id && !loaded.has(id)))].map(Number).filter(Number.isInteger).slice(0, 200);
    if (!missing.length) return [];
    try {
      return (await this.mapController.queryFeatures(layer.uid, { objectIds: missing, where: "1=1", outFields: ["*"], returnGeometry: true })).features || [];
    } catch {
      return [];
    }
  }

  #restoreBriefingSelection(layer) {
    const saved = this.projectManager.current.presentation?.briefingSelection;
    if (!saved || !layer || saved.layerId !== layer.uid) return;
    const available = new Set(this.presentationState.records.map((record) => featureId(record, layer.objectIdField)).filter(Boolean));
    this.presentationState.selectedIds = new Set(saved.ids.filter((id) => available.has(id)));
    this.presentationState.briefingUseAll = saved.useAll === true;
    if (Array.isArray(saved.conditions) && !this.presentationState.conditions?.length) Object.assign(this.presentationState, { conditions: saved.conditions, conditionLogic: saved.conditionLogic === "or" ? "or" : "and" });
  }

  #saveBriefingSelection() {
    const state = this.presentationState;
    if (state.template !== "briefing" || !state.layerUid) return;
    const layer = this.mapController.getLayer(state.layerUid);
    const briefing = this.projectManager.current.presentation?.briefing || {};
    this.projectManager.patchPresentation({
      briefingSelection: { layerId: state.layerUid, ids: [...state.selectedIds], useAll: state.briefingUseAll === true, conditions: state.conditions || [], conditionLogic: state.conditionLogic || "and" },
      // The briefing document carries its layer and selection too (portable: the layer by its service URL).
      briefing: { ...briefing, layerId: briefingLayerRef(this.mapController, layer), selection: { ids: [...state.selectedIds], useAll: state.briefingUseAll === true } },
    });
  }

  /** The Features tab's attribute conditions as one briefing filter (all must match), or null. */
  /** Map Insight condensed for the slide player: the first feature here, or the address. */
  #presentationInsight(payload) {
    const point = payload.point;
    const coordinates = Number.isFinite(point?.latitude) && Number.isFinite(point?.longitude) ? `${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}` : "";
    const address = typeof payload.address?.address === "string" ? payload.address.address.trim() : "";
    const results = payload.results || [];
    const [result] = results;
    if (!result) return { title: address || "Location", subtitle: address ? coordinates : "", rows: [], note: address ? "" : coordinates };
    const layer = this.mapController.getLayer(result.layerUid);
    const fields = new Map((layer?.fields || []).map((field) => [field.name, field]));
    const rows = Object.entries(result.attributes || {})
      .filter(([key, value]) => value != null && value !== "" && !key.startsWith("_") && !isRoutineField(fields.get(key) || key, { idField: layer?.objectIdField }))
      .slice(0, 8)
      .map(([key, value]) => [fields.get(key)?.alias || key, formatAttributeValue(value, fields.get(key), key)]);
    const others = results.length - 1;
    return { title: result.layerTitle || "Feature", subtitle: [address, coordinates].filter(Boolean).join(" · "), rows, note: others > 0 ? `${others} more ${others === 1 ? "feature" : "features"} here. Exit the slides for full Map Insight.` : "" };
  }

  /** One line for the list: what matches, how much of the source is loaded, and what the briefing includes. */
  #briefingStatus() {
    const state = this.presentationState;
    const shown = state.visibleRecords.length, loaded = state.records.length, total = state.totalCount;
    const included = state.briefingUseAll ? shown : state.selectedIds.size;
    const matching = shown === loaded ? `${loaded.toLocaleString()} features` : `${shown.toLocaleString()} of ${loaded.toLocaleString()} match`;
    const partial = Number.isFinite(total) && total > loaded ? ` · first ${loaded.toLocaleString()} of ${total.toLocaleString()} loaded` : "";
    return `${matching}${state.scope === "extent" ? " in view" : ""}${partial} · ${included.toLocaleString()} included`;
  }

  /** The briefing list's attribute conditions as one filter; `skip(condition)` leaves some out. */
  #briefingConditionFilter(skip = () => false) {
    const fields = this.mapController.getLayer(this.presentationState.layerUid)?.fields || [];
    const kindOf = (name) => fieldKind(fields.find((field) => field.name === name));
    const args = (this.presentationState.conditions || []).filter((item) => !skip(item)).map((item) => conditionToFilter(item, kindOf(item.field))).filter(Boolean);
    return args.length ? normalizeFilter({ op: this.presentationState.conditionLogic === "or" ? "or" : "and", args }) : null;
  }

  #toRecord(feature, layer) {
    return { kind: "feature", layerUid: layer.uid, layerTitle: layer.title || "Layer", attributes: feature.attributes || {}, geometry: feature.geometry || null };
  }

  /** Adds features in the current view that were not among the first records loaded. */
  async #loadExtentRecords() {
    const state = this.presentationState;
    const layer = this.mapController.getLayer(state.layerUid);
    const extent = this.mapController.getViewExtent();
    if (!layer?.queryable || !extent) return;
    try {
      const response = await this.mapController.queryFeatures(layer.uid, { geometry: extent, spatialRelationship: "intersects", where: layer.where || "1=1", outFields: ["*"], returnGeometry: true, num: 500 });
      if (state !== this.presentationState) return;
      const known = new Set(state.records.map((record) => featureId(record, layer.objectIdField)));
      const added = (response.features || []).filter((feature) => !known.has(String(feature.attributes?.[layer.objectIdField]))).map((feature) => this.#toRecord(feature, layer));
      state.records.push(...added);
    } catch { /* The loaded records still filter by extent. */ }
  }

  /** Pick on map: a click includes the feature in the briefing, or takes it out again. */
  #toggleBriefingInclude(result) {
    const state = this.presentationState;
    const layer = this.mapController.getLayer(state.layerUid);
    const id = featureId(result, layer?.objectIdField);
    if (!id) return;
    if (!state.records.some((record) => featureId(record, layer.objectIdField) === id)) state.records.push({ ...result, kind: "feature" });
    const record = state.records.find((item) => featureId(item, layer.objectIdField) === id);
    // "Use all matching" stops applying once features are picked one by one; start from what it included.
    if (state.briefingUseAll) { state.selectedIds = new Set(state.visibleRecords.map((item) => featureId(item, layer.objectIdField)).filter(Boolean)); state.briefingUseAll = false; }
    const label = this.#recordLabel(record, this.#presentationFields(layer));
    // Picking leaves the selection and panels alone, so the map does not move under the next click.
    if (state.selectedIds.has(id)) {
      state.selectedIds.delete(id);
      state.lastPick = `Removed ${label}`;
    } else {
      state.selectedIds.add(id);
      this.mapController.highlightFeature(record);
      state.lastPick = `Included ${label}`;
    }
    this.#saveBriefingSelection();
    this.#filterPresentationRecords();
    this.#syncPickBanner();
  }

  /** While picking on the map, a banner says so, counts what is included and offers Done. */
  #syncPickBanner() {
    const state = this.presentationState;
    const on = state?.template === "briefing" && Boolean(state.mapSelect);
    let banner = document.querySelector(".briefing-pick-banner");
    if (!on) { banner?.remove(); return; }
    if (!banner) {
      banner = document.createElement("div");
      banner.className = "briefing-pick-banner";
      banner.setAttribute("role", "status");
      banner.innerHTML = '<span data-pick-text></span><button type="button" data-pick-done>Done</button>';
      banner.querySelector("[data-pick-done]").addEventListener("click", () => document.querySelector("[data-select-map]")?.click());
      document.querySelector(".map-workspace")?.append(banner);
    }
    const count = state.briefingUseAll ? state.visibleRecords.length : state.selectedIds.size;
    banner.querySelector("[data-pick-text]").textContent = `Click features to include or remove them · ${count.toLocaleString()} included${state.lastPick ? ` · ${state.lastPick}` : ""}`;
  }

  #recordLabel(result, fields) {
    const attributes = result.attributes || {};
    const role = this.presentationState.roles?.title;
    const preferred = fields.fields.find((field) => field.name === role) || fields.text.find((field) => /name|title|incident|location|label/i.test(`${field.name} ${field.alias || ""}`)) || this.#distinctTextField(fields);
    const value = attributes[preferred?.name];
    if (value != null && String(value).trim()) return String(value);
    // No field names the records: use the ID, with the date when there is one ("#4521 · 14 Oct 2026").
    const id = attributes[this.mapController.getLayer(this.presentationState.layerUid)?.objectIdField];
    const dateField = fields.dates?.[0]?.name;
    const date = dateField && attributes[dateField] != null ? new Date(attributes[dateField]) : null;
    const when = date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "";
    return [id != null ? `#${id}` : "Untitled record", when].filter(Boolean).join(" · ");
  }

  /**
   * With no name-like field, the text field that best tells records apart: a
   * one-letter code shared by every record (like MODIS's satellite "A") makes a
   * poor label. Cached per layer and record count.
   */
  #distinctTextField(fields) {
    const records = this.presentationState.records || [];
    const key = `${this.presentationState.layerUid}:${records.length}`;
    if (this.labelFieldCache?.key === key) return this.labelFieldCache.field;
    const sample = records.slice(0, 300);
    let best = null;
    let bestScore = 0;
    for (const field of fields.text) {
      const values = sample.map((record) => record.attributes?.[field.name]).filter((value) => value != null && String(value).trim());
      const distinct = new Set(values.map(String)).size;
      const score = distinct / Math.max(1, sample.length) + (values.length ? Math.min(1, values.reduce((sum, value) => sum + String(value).length, 0) / values.length / 20) * 0.25 : 0);
      // A field needs some variety to be worth reading (at least one value in five differs).
      if (distinct > 1 && distinct / Math.max(1, sample.length) >= 0.2 && score > bestScore) { best = field; bestScore = score; }
    }
    // Nothing distinguishes the records: fall back to their IDs.
    this.labelFieldCache = { key, field: best };
    return best;
  }

  #filterPresentationRecords() {
    const active = document.activeElement?.matches?.("[data-mode-search]")
      ? { selector: "[data-mode-search]", start: document.activeElement.selectionStart, end: document.activeElement.selectionEnd }
      : null;
    const layer = this.mapController.getLayer(this.presentationState.layerUid);
    const fields = this.#presentationFields(layer);
    const inView = this.mapController.viewExtentFilter();
    const conditions = this.#briefingConditionFilter();
    const filtered = filterRecords(this.presentationState.records, this.presentationState, fields.fields, (result) => !inView || inView(result.geometry))
      .filter((record) => !conditions || matchesFilter(conditions, record.attributes || {}));
    this.presentationState.visibleRecords = sortRecords(filtered, this.presentationState.sortField, this.presentationState.sortDirection);
    if (this.presentationState.selected && !this.presentationState.visibleRecords.includes(this.presentationState.selected)) {
      this.presentationState.selected = null;
      this.mapController.clearFeatureHighlight();
    }
    void this.#syncExplorerMapFilter(layer, this.presentationState.visibleRecords);
    this.#renderPresentationDashboard(this.projectManager.current.presentation || {});
    if (active) requestAnimationFrame(() => {
      const input = document.querySelector(active.selector);
      if (!input) return;
      input.focus({ preventScroll: true });
      input.setSelectionRange(active.start ?? input.value.length, active.end ?? input.value.length);
    });
  }

  #selectPresentationResult(result) {
    if (!result || this.presentationState.template === "standard") return;
    const layer = this.mapController.getLayer(this.presentationState.layerUid);
    const idField = layer?.objectIdField;
    const selected = idField ? this.presentationState.records.find((record) => featureId(record, idField) === featureId(result, idField)) || result : result;
    this.presentationState.selected = selected;
    const selectedId = featureId(selected, idField);
    if (this.presentationState.template === "briefing") {
      if (selectedId) this.presentationState.selectedIds.add(selectedId);
      this.#saveBriefingSelection();
    } else {
      this.presentationState.selectedIds = new Set([selectedId].filter(Boolean));
    }
    this.mapController.highlightFeature(selected);
    this.#setInsightsOpen(false);
    this.#renderPresentationDashboard(this.projectManager.current.presentation || {});
  }

  async #syncExplorerMapFilter(layer, records) {
    if (!layer) return;
    // A Cinematic track's filter belongs to its playback; records that finish loading after
    // Cinematic starts would otherwise show the whole layer until the first step.
    if (this.cinematicController?.layers?.has(layer.uid)) return;
    // Not every layer supports a client-side object ID filter; those keep drawing everything.
    await this.mapController.setFeatureFilter(layer.uid, featureFilterFor(records, this.presentationState.records.length, layer.objectIdField));
  }

  #applyExplorerMetricRenderer(layer, roles, presentation) {
    if (!roles.metric || layer?.geometryType !== "point") return;
    const unit = this.presentationState.records.map((record) => record.attributes?.[roles.unit]).find(Boolean) || "";
    this.mapController.setRenderer(layer.uid, {
      type: "simple",
      symbol: { type: "simple-marker", size: 7, color: "#9ca3a0", outline: { color: "#ffffff", width: 0.7 } },
      visualVariables: [{
        type: "color", field: roles.metric,
        legendOptions: { title: `${presentation.widgets?.metricLabel || roles.metric}${unit ? ` (${unit})` : ""}` },
        stops: [
          { value: this.presentationState.metricMin ?? 0, color: "#2f7f9d", label: "Lower" },
          { value: ((this.presentationState.metricMin ?? 0) + (this.presentationState.metricMax ?? 1)) / 2, color: "#e0ad35", label: "Middle" },
          { value: this.presentationState.metricMax ?? 1, color: "#b23f62", label: "Higher" },
        ],
      }],
    });
  }

  #formatExplorerTime(value) {
    if (value == null || value === "") return "Time not supplied";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(date);
  }

  #formatExplorerNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(number) : "Measurement unavailable";
  }

  #explorerHistogram(records, metric, min, max) {
    if (!metric || !Number.isFinite(min) || !Number.isFinite(max)) return [];
    const bins = Array.from({ length: 12 }, (_, index) => ({ min: min + (max - min) * index / 12, max: min + (max - min) * (index + 1) / 12, count: 0 }));
    records.forEach((record) => {
      const value = Number(record.attributes?.[metric]);
      if (!Number.isFinite(value)) return;
      const index = max === min ? 0 : Math.min(11, Math.floor((value - min) / (max - min) * 12));
      bins[index].count += 1;
    });
    return bins;
  }

  #renderPresentationDashboard(presentation) {
    const root = document.querySelector("#presentation-dashboard");
    if (!root) return;
    const template = presentation.template || "standard";
    if (template !== "briefing") {
      this.#teardownBriefingV2();
      document.querySelector("#briefing-context-host")?.replaceChildren();
      this.briefingSlides?.closePlayer();
      document.body.classList.remove("briefing-slides-tab", "briefing-features-tab");
    }
    this.#syncPresentationMobileControls(presentation);
    if (template === "standard") { root.replaceChildren(); root.hidden = true; return; }
    root.hidden = false;
    const layer = this.mapController.getLayer(this.presentationState.layerUid);
    if (!layer && template !== "atlas") {
      root.innerHTML = `<section class="presentation-empty"><span class="eyebrow">${escapeHtml(template)}</span><h2>Start with a dataset</h2><p>This mode becomes interactive after you add a feature layer. Your project and map remain unchanged.</p><div>${template === 'briefing' ? '<button type="button" data-presentation-setup="briefing-guide">Guide to creating a briefing</button><button type="button" data-presentation-setup="example-briefing">Open Historical Quakes briefing</button><button type="button" data-presentation-setup="example-briefing-tutorial">Start step-by-step example</button>' : ''}<button type="button" data-presentation-setup="data-arcgis">Connect a service</button><button type="button" data-presentation-setup="data-file">Add a file</button><button type="button" data-presentation-setup="data-popular">${template === 'briefing' ? 'Find a dataset' : 'Open an example'}</button></div>${template === 'briefing' ? '<p class="form-note">Historical Quakes is a finished, editable example with the publisher’s symbols, event slides, and an observed cinematic timeline. The step-by-step option opens the same example and guides you through it.</p>' : ''}</section>`;
      root.querySelectorAll("[data-presentation-setup]").forEach((button) => button.addEventListener("click", () => {
        if (button.dataset.presentationSetup === 'example-briefing') return this.#openExampleHistoricalQuakesBriefing();
        if (button.dataset.presentationSetup === 'example-briefing-tutorial') return this.#openExampleHistoricalQuakesBriefing({ startTutorial: true });
        if (button.dataset.presentationSetup === 'briefing-guide') {
          this.#dismissWelcome();
          let exampleProject = null;
          return startWorkspaceWalkthrough({ mobile: () => this.mobileMedia.matches, steps: BRIEFING_WALKTHROUGH_STEPS, label: 'Briefing creation guide', beforeStep: async (index, { signal }) => {
            if (index < 3) return true;
            if (!exampleProject) {
              if (!await this.#openExampleHistoricalQuakesBriefing({ signal })) return false;
              exampleProject = this.projectManager.current;
            }
            if (this.projectManager.current !== exampleProject || this.projectManager.current.presentation?.template !== 'briefing') throw new Error('The briefing workspace changed. Reopen the guide to continue.');
            if (!this.#briefingV2Active()) {
              const tab = index === 3 ? 'features' : 'slides';
              const tabButton = await waitForWalkthroughTarget(`[data-briefing-tab="${tab}"]`, { signal });
              if (tabButton.getAttribute('aria-selected') !== 'true') tabButton.click();
            }
            const step = BRIEFING_WALKTHROUGH_STEPS[index];
            await waitForWalkthroughTarget(this.mobileMedia.matches ? step.mobile : step.desktop, { signal });
            return true;
          } });
        }
        return this.#handleAction(button.dataset.presentationSetup);
      }));
      return;
    }
    const fields = this.#presentationFields(layer);
    const records = this.presentationState.visibleRecords;
    const categories = [...new Set(this.presentationState.records.map((result) => String(result.attributes?.[this.presentationState.categoryField] ?? "")).filter(Boolean))].slice(0, 24);
    const selected = this.presentationState.selected;
    const selectedDetails = selected ? Object.entries(selected.attributes || {}).filter(([, value]) => value != null && value !== "").slice(0, 12) : [];
    if (template === "atlas") {
      const chapters = presentation.chapters || [];
      const playing = Boolean(this.presentationState.atlasPlaying);
      const playbackMode = presentation.playbackMode === "manual" ? "manual" : "auto";
      const skinOptions = INTERFACE_SKINS.map(({ id, label }) => [id, label]);
      root.innerHTML = `<section class="mode-dashboard mode-dashboard--atlas"><header><span class="eyebrow">Tour · ${this.presentationState.atlasPresent ? "present" : "edit"} mode</span><h2>${escapeHtml(presentation.title || "Guided places")}</h2><p>Turn saved map views into a guided tour.</p></header><label class="atlas-skin-control"><span>Look &amp; feel</span><select data-atlas-skin>${skinOptions.map(([value,label]) => `<option value="${value}"${presentation.skin === value ? " selected" : ""}>${label}</option>`).join("")}</select></label><div class="atlas-present-action"><button type="button" data-atlas-mode>${this.presentationState.atlasPresent ? "Edit chapters" : "Present tour"}</button></div><label class="atlas-playback-mode"><span>Playback</span><select data-atlas-playback><option value="auto"${playbackMode === "auto" ? " selected" : ""}>Auto · use linger time</option><option value="manual"${playbackMode === "manual" ? " selected" : ""}>Manual · use Back and Next</option></select></label><div class="atlas-actions"><button type="button" data-atlas-capture ${this.presentationState.atlasPresent ? "hidden" : ""}>Add another chapter</button><button type="button" data-atlas-share>Share tour</button><button type="button" data-atlas-export>Export tour</button></div><div class="mode-records">${chapters.map((chapter, index) => `<article class="atlas-chapter"><button type="button" data-atlas-go="${index}"><span>${index + 1}</span><strong>${escapeHtml(chapter.title || `Chapter ${index + 1}`)}</strong><small>${escapeHtml(chapter.reverseAddress || chapter.body || "Saved map view")}${chapter.basemapId ? ` · ${escapeHtml(this.#basemapLabel(chapter.basemapId))}` : ""}${playbackMode === "auto" && chapter.lingerSeconds ? ` · ${chapter.lingerSeconds}s` : ""}</small></button>${this.presentationState.atlasPresent ? "" : `<div><button type="button" data-atlas-rename="${index}">Edit</button><button type="button" data-atlas-delete="${index}">Delete</button></div>`}</article>`).join("") || `<p class="atlas-empty">Move to your first place, then add a chapter.</p>`}</div></section>`;
      if (!this.presentationState.atlasPresent) {
        const titleControl = document.createElement("label");
        titleControl.className = "atlas-title-control";
        titleControl.innerHTML = `<span>Tour name <small>Tap to edit</small></span><input data-atlas-title aria-label="Editable tour name" type="text" maxlength="80" value="${escapeHtml(presentation.title || "")}" placeholder="Name this tour" autocomplete="off">`;
        root.querySelector(".mode-dashboard--atlas > header")?.after(titleControl);
      }
      const atlasActions = root.querySelector(".atlas-actions");
      const modeButton = root.querySelector("[data-atlas-mode]");
      const captureButton = root.querySelector("[data-atlas-capture]");
      const shareButton = root.querySelector("[data-atlas-share]");
      shareButton?.classList.toggle("is-ready", chapters.length > 0);
      if (atlasActions && modeButton) {
        const compactAtlas = this.mobileMedia.matches;
        modeButton.textContent = this.presentationState.atlasPresent ? (compactAtlas ? "Edit" : "Edit tour") : (compactAtlas ? "Present" : "Present tour");
        atlasActions.prepend(modeButton);
        const settingsButton = document.createElement("button");
        settingsButton.type = "button";
        settingsButton.dataset.atlasSettings = "";
        settingsButton.textContent = "Tour settings";
        modeButton.after(settingsButton);
      }
      if (captureButton) captureButton.textContent = this.mobileMedia.matches ? "Add" : "Add a chapter";
      if (shareButton) shareButton.textContent = this.mobileMedia.matches ? "Share" : "Share & export";
      root.querySelector("[data-atlas-export]")?.remove();
      root.querySelector(".atlas-present-action")?.remove();
      root.querySelector(".atlas-skin-control")?.remove();
      root.querySelector(".atlas-playback-mode")?.remove();
      this.#addPresentationDockControl(root);
      root.querySelector("[data-atlas-mode]")?.addEventListener("click", async () => {
        if (this.mobileAtlasSettingsOpen) {
          this.presentationState.atlasPresent = true;
          this.#closeUtilityTab("presentation");
          return;
        }
        this.#stopAtlasStory();
        this.presentationState.atlasPresent = !this.presentationState.atlasPresent;
        this.#renderPresentationDashboard(presentation);
        if (this.presentationState.atlasPresent && chapters.length) await this.#goToAtlasChapter(chapters[0], 0, chapters);
        else this.#hideAtlasChapterOverlay();
      });
      root.querySelector("[data-atlas-capture]")?.addEventListener("click", () => this.#captureAtlasChapter());
      root.querySelector("[data-atlas-export]")?.addEventListener("click", () => this.projectManager.exportAtlas());
      root.querySelector("[data-atlas-share]")?.addEventListener("click", () => this.#shareAtlasDialog());
      root.querySelector("[data-atlas-settings]")?.addEventListener("click", () => this.#atlasSettingsDialog());
      root.querySelector("[data-atlas-title]")?.addEventListener("change", (event) => {
        const title = event.target.value.trim().slice(0, 80);
        const updated = this.projectManager.setPresentation({ ...this.projectManager.current.presentation, title });
        this.#renderPresentationDashboard(updated);
        this.#syncUtilityPanel("presentation");
      });
      root.querySelector("[data-atlas-skin]")?.addEventListener("change", (event) => {
        const updated = this.projectManager.setPresentation({ ...this.projectManager.current.presentation, skin: event.target.value });
        this.#renderPresentationDashboard(updated);
      });
      root.querySelector("[data-atlas-playback]")?.addEventListener("change", (event) => {
        this.#stopAtlasStory();
        this.projectManager.setPresentation({ ...this.projectManager.current.presentation, playbackMode: event.target.value });
        this.#renderPresentationDashboard(this.projectManager.current.presentation);
      });
      root.querySelectorAll("[data-atlas-go]").forEach((button) => button.addEventListener("click", () => { const index = Number(button.dataset.atlasGo); this.#goToAtlasChapter(chapters[index], index, chapters); }));
      root.querySelectorAll("[data-atlas-delete]").forEach((button) => button.addEventListener("click", () => this.#saveAtlasChapters(chapters.filter((_, index) => index !== Number(button.dataset.atlasDelete)))));
      root.querySelectorAll("[data-atlas-rename]").forEach((button) => button.addEventListener("click", () => this.#editAtlasChapter(chapters, Number(button.dataset.atlasRename))));
      return;
    }
    if (template === "cinematic") {
      this.#renderCinematicWorkspace(root, presentation, layer);
      return;
    }
    if (template === "explorer") {
      this.#renderExplorerWorkspace(root, presentation, layer, fields);
      return;
    }
    if (template === "briefing") {
      this.#renderBriefingWorkspace(root, presentation, layer, fields);
      return;
    }
    if (template === "explorer") {
      const roles = this.presentationState.roles || this.#presentationRoles(presentation, layer, fields);
      const loaded = this.presentationState.records.length;
      const total = this.presentationState.totalCount;
      const incomplete = Number.isFinite(total) && total > loaded;
      const unit = this.presentationState.metricUnit || "";
      const units = [...new Set(this.presentationState.records.map((record) => record.attributes?.[roles.unit]).filter(Boolean).map(String))];
      const bins = this.#explorerHistogram(records.filter((record) => !unit || String(record.attributes?.[roles.unit] ?? "") === unit), roles.metric, this.presentationState.metricMin, this.presentationState.metricMax);
      const maxBin = Math.max(1, ...bins.map((bin) => bin.count));
      const metricLabel = presentation.widgets?.metricLabel || fields.fields.find((field) => field.name === roles.metric)?.alias || roles.metric || "Measurement";
      const source = selected?.attributes?.[roles.source];
      const sourceLink = /^https:\/\//i.test(String(source || "")) ? `<a href="${escapeHtml(String(source))}" target="_blank" rel="noopener noreferrer">Open source record ↗</a>` : "";
      root.innerHTML = `<section class="mode-dashboard mode-dashboard--explorer"><header><span class="eyebrow">Explorer · synchronized dataset view</span><h2>${escapeHtml(presentation.title || layer.title || "Explore records")}</h2><div class="explorer-counts"><span><b>${loaded}</b> records loaded</span><span><b>${records.length}</b> match filters</span><span><b>${selected ? 1 : 0}</b> selected</span></div>${incomplete ? `<p class="explorer-coverage">Loaded sample: ${loaded} of ${total} service records. Filters, chart, and map cover the loaded sample.</p>` : `<p class="explorer-coverage">Filters, chart, map, and results cover all ${loaded} records returned to this browser.</p>`}</header><div class="explorer-toolbar"><label class="field"><span>Search loaded records</span><input data-mode-search value="${escapeHtml(this.presentationState.search)}" placeholder="Location, provider, or attribute" /></label><label class="field"><span>Geographic scope</span><select data-mode-scope><option value="all"${this.presentationState.scope === "all" ? " selected" : ""}>All loaded records</option><option value="extent"${this.presentationState.scope === "extent" ? " selected" : ""}>Current map extent</option></select></label>${roles.category && categories.length > 1 && categories.length <= 24 ? `<label class="field"><span>${escapeHtml(presentation.widgets?.categoryLabel || "Category filter")}</span><select data-mode-category><option value="">All categories</option>${categories.map((value) => `<option value="${escapeHtml(value)}"${value === this.presentationState.category ? " selected" : ""}>${escapeHtml(value)}</option>`).join("")}</select></label>` : ""}<div class="explorer-actions"><button type="button" data-mode-zoom>Zoom to results</button><button type="button" class="button--quiet" data-mode-clear>Clear filters</button></div></div>${roles.metric ? `<section class="explorer-distribution"><div><span class="eyebrow">Filtered loaded-record distribution</span><strong>${escapeHtml(metricLabel)}${unit ? ` (${escapeHtml(unit)})` : ""}</strong></div><div class="explorer-histogram" aria-label="Histogram of ${escapeHtml(metricLabel)}">${bins.map((bin) => `<button type="button" data-range-bin-min="${bin.min}" data-range-bin-max="${bin.max}" title="${bin.min.toFixed(1)}–${bin.max.toFixed(1)}: ${bin.count} matching loaded records"><span style="height:${Math.max(4, bin.count / maxBin * 100)}%"></span></button>`).join("")}</div><div class="explorer-range"><label>Minimum<input data-range-min type="number" step="any" value="${this.presentationState.rangeMin ?? ""}" placeholder="${Number(this.presentationState.metricMin).toFixed(1)}" /></label><label>Maximum<input data-range-max type="number" step="any" value="${this.presentationState.rangeMax ?? ""}" placeholder="${Number(this.presentationState.metricMax).toFixed(1)}" /></label></div><div class="explorer-legend"><i></i><span>Lower</span><i></i><span>Middle</span><i></i><span>Higher</span><i class="is-missing"></i><span>Missing</span></div>${units.length > 1 ? `<p class="form-note">Multiple units are present (${units.map(escapeHtml).join(", ")}). The chart and legend use ${escapeHtml(unit)} only; values are never combined across units.</p>` : ""}</section>` : ""}<div class="mode-records explorer-results">${records.map((record, index) => { const attrs = record.attributes || {}; const value = attrs[roles.metric]; return `<button type="button" class="mode-record${record === selected ? " is-selected" : ""}" data-mode-record="${index}"><strong>${escapeHtml(this.#recordLabel(record, fields))}</strong><span>${value == null ? "Measurement unavailable" : `${escapeHtml(this.#formatExplorerNumber(value))}${attrs[roles.unit] ? ` ${escapeHtml(String(attrs[roles.unit]))}` : ""}`}</span><small>${escapeHtml(this.#formatExplorerTime(attrs[roles.timestamp]))}</small></button>`; }).join("") || "<p class=\"form-note\">No loaded records match the active filters.</p>"}</div><aside class="mode-details explorer-details"><span class="eyebrow">Location details</span>${selected ? `<h3>${escapeHtml(this.#recordLabel(selected, fields))}</h3><p class="explorer-measurement">${selected.attributes?.[roles.metric] == null ? "Measurement unavailable" : `${escapeHtml(this.#formatExplorerNumber(selected.attributes[roles.metric]))}${selected.attributes?.[roles.unit] ? ` ${escapeHtml(String(selected.attributes[roles.unit]))}` : ""}`}</p><p><strong>${escapeHtml(presentation.widgets?.timestampLabel || "Reported time")}:</strong> ${escapeHtml(this.#formatExplorerTime(selected.attributes?.[roles.timestamp]))}</p>${sourceLink}<details><summary>Technical attributes</summary><dl>${Object.entries(selected.attributes || {}).filter(([, value]) => value != null && value !== "").map(([key, value]) => `<div><dt>${escapeHtml(key)}</dt><dd>${escapeHtml(formatAttributeValue(value, fields.fields.find((field) => field.name === key), key))}</dd></div>`).join("")}</dl>${roles.timestamp ? `<p class="form-note">Original timestamp: <code>${escapeHtml(String(selected.attributes?.[roles.timestamp] ?? "Not supplied"))}</code></p>` : ""}</details>` : "<p>Select a result or mapped feature. Selection does not change the filter count.</p>"}</aside>${presentation.widgets?.limitation ? `<p class="explorer-limitation"><strong>Source-data limitation:</strong> ${escapeHtml(presentation.widgets.limitation)}</p>` : ""}</section>`;
    } else {
      const dateField = fields.dates[0];
      root.innerHTML = `<section class="mode-dashboard"><header><span class="eyebrow">${escapeHtml(template)}</span><h2>${escapeHtml(presentation.title || layer.title || "Map data")}</h2><p>${records.length} loaded records · ${dateField ? `timeline field: ${escapeHtml(dateField.alias || dateField.name)}` : "No date field is available for a timeline."}</p></header><div class="mode-records">${records.map((record, index) => `<button type="button" class="mode-record${record === selected ? " is-selected" : ""}" data-mode-record="${index}"><strong>${escapeHtml(this.#recordLabel(record, fields))}</strong></button>`).join("")}</div><aside class="mode-details"><span class="eyebrow">Selected feature</span>${selected ? `<h3>${escapeHtml(this.#recordLabel(selected, fields))}</h3><dl>${selectedDetails.map(([key, value]) => `<div><dt>${escapeHtml(key)}</dt><dd>${escapeHtml(formatAttributeValue(value, fields.fields.find((field) => field.name === key), key))}</dd></div>`).join("")}</dl>` : "<p>Select a feature to view source attributes.</p>"}</aside></section>`;
    }
    root.querySelector("[data-mode-search]")?.addEventListener("input", (event) => {
      this.presentationState.search = event.target.value;
      clearTimeout(this.presentationSearchTimer);
      this.presentationSearchTimer = setTimeout(() => this.#filterPresentationRecords(), 180);
    });
    root.querySelector("[data-mode-category]")?.addEventListener("change", (event) => { this.presentationState.category = event.target.value; this.#filterPresentationRecords(); });
    root.querySelector("[data-mode-scope]")?.addEventListener("change", (event) => { this.presentationState.scope = event.target.value; this.#filterPresentationRecords(); });
    root.querySelectorAll("[data-range-min], [data-range-max]").forEach((input) => input.addEventListener("change", () => {
      const minimum = root.querySelector("[data-range-min]")?.value;
      const maximum = root.querySelector("[data-range-max]")?.value;
      this.presentationState.rangeMin = minimum === "" ? null : Number(minimum);
      this.presentationState.rangeMax = maximum === "" ? null : Number(maximum);
      this.#filterPresentationRecords();
    }));
    root.querySelectorAll("[data-range-bin-min]").forEach((button) => button.addEventListener("click", () => {
      this.presentationState.rangeMin = Number(button.dataset.rangeBinMin);
      this.presentationState.rangeMax = Number(button.dataset.rangeBinMax);
      this.#filterPresentationRecords();
    }));
    root.querySelector("[data-mode-zoom]")?.addEventListener("click", async () => {
      const features = this.presentationState.visibleRecords.filter((record) => record.geometry);
      if (features.length) await this.mapController.goToFeatures(features, { animate: !matchMedia("(prefers-reduced-motion: reduce)").matches });
    });
    root.querySelector("[data-mode-clear]")?.addEventListener("click", () => { this.presentationState.search = ""; this.presentationState.category = ""; this.presentationState.scope = "all"; this.presentationState.rangeMin = null; this.presentationState.rangeMax = null; this.#filterPresentationRecords(); });
    root.querySelectorAll("[data-mode-category-value]").forEach((button) => button.addEventListener("click", () => { this.presentationState.category = button.dataset.modeCategoryValue; this.#filterPresentationRecords(); }));
    root.querySelectorAll("[data-mode-record]").forEach((button) => button.addEventListener("click", async () => { const result = records[Number(button.dataset.modeRecord)]; this.#selectPresentationResult(result); if (result?.geometry) await this.mapController.setView({ geometry: result.geometry }); }));
  }

  #renderCinematicWorkspace(root, presentation, layer) {
    const state = this.cinematicState;
    const timeline = state?.timeline;
    if (!timeline) {
      root.innerHTML = `<section class="mode-dashboard cinematic-dashboard"><header><span class="eyebrow">Cinematic · observed playback</span><h2>${escapeHtml(presentation.title || layer.title || "Cinematic map")}</h2><p>Preparing timestamped observations…</p></header><button type="button" data-cinematic-reconfigure>Configure playback</button></section>`;
      root.querySelector("[data-cinematic-reconfigure]")?.addEventListener("click", () => this.#openCinematicMode({ reconfigure: true }));
      return;
    }
    const timeMode = state.spec?.cinematic.clock.timeMode || "instant";
    const intent = state.spec?.cinematic.intent || "explore";
    const localWindow = state.localWindow === true;
    const supportsBoundaryGlow = this.mapController.getCapabilities().includes("three-3d");
    const supportsGround = this.mapController.getCapabilities().includes("ground");
    const effectType = state.spec?.cinematic.layers?.[0]?.animation?.effect?.type || "none";
    const resolvedEffect = state.layers?.[0]?.effect || "none";
    const effectOptions = this.#cinematicEffectOptions(effectType, effectType === "auto" ? resolvedEffect : suggestEffect({ title: layer.title, geometryType: layer.geometryType, fields: layer.fields || [] }), { cinematic: true });
    const layerOpacity = state.spec?.cinematic.layers?.[0]?.animation?.opacity ?? layer.opacity ?? 1;
    const terrainOptions = supportsGround ? this.#groundOptionsMarkup() : "";
    const current = new Date(timeline.observationTime);
    const disclosure = this.cinematicDisclosureState || {};
    const playbackOpen = disclosure.playback === true;
    const presentOpen = disclosure.present !== false;
    const timeLabel = this.#cinematicPositionLabel(state);
    const ambientScene = state.valueKind === "none";
    const playing = ambientScene ? state.effects?.playing === true : timeline.playing;
    const fidelityNote = state.valueKind === "none" ? "Ambient animation: every feature shows at once and its effect loops. Nothing is stepped through time or estimated." : state.valueKind === "number" ? `Stepping through ${state.layers?.find((item) => item.kind === "number")?.timeField || "the field"} from lowest to highest. ${timeMode === "cumulative" ? "Build up shows every record up to the current value." : "Only records with the current value show."} Values are the data's own; nothing is interpolated.` : timeMode === "cumulative" ? "Showing every observed record from the first observation through this moment. This is cumulative display, not inferred persistence or geometry interpolation." : "Showing the current observed state only. Polygon boundaries step between snapshots; no unobserved spread or geometry interpolation is shown.";
    const inspection = intent === "investigate" ? `<section class="cinematic-inspector" aria-label="Observed data inspection"><span class="eyebrow">Observed evidence</span><strong>${escapeHtml(this.#cinematicValueText(timeline.observationTime, state))}</strong>${state.layers.map((item) => `<p><b>${escapeHtml(item.title)}</b><span>${item.observedCount} observed feature${item.observedCount === 1 ? "" : "s"} · ${escapeHtml(item.timeField)}</span></p>`).join("")}<small>Observed source records only; no estimated spread is shown.</small></section>` : "";
    const present = intent === "present" ? `<details class="cinematic-disclosure cinematic-disclosure--present"${presentOpen ? " open" : ""}><summary>Present & export</summary><div class="cinematic-actions">${this.#cinematicClipSummary()}<button type="button" data-cinematic-create-clip>Create Clip</button>${this.#latestCinematicClip() ? '<button type="button" data-cinematic-edit-clip>Edit Clip</button>' : ""}<button type="button" data-cinematic-add-brief>Add to Brief</button><button type="button" data-cinematic-download-clip>Clip JSON</button><button type="button" data-cinematic-poster>Poster PNG</button><button type="button" data-cinematic-record title="Render this Clip to a video file">Export movie</button></div></details>` : "";
    root.innerHTML = `<section class="mode-dashboard cinematic-dashboard"><header><span class="eyebrow">Cinematic · ${ambientScene ? "ambient loop" : state.valueKind === "number" ? "scenario sweep" : "observed playback"}</span><h2>${escapeHtml(presentation.title || layer.title || "Cinematic map")}</h2><div class="cinematic-mode-strip"><label>Intent <select data-cinematic-intent aria-label="Cinematic intent"><option value="explore"${intent === "explore" ? " selected" : ""}>Explore</option><option value="investigate"${intent === "investigate" ? " selected" : ""}>Investigate</option><option value="present"${intent === "present" ? " selected" : ""}>Present</option></select></label><span>${this.mapController.getEngineId?.() || "map"}</span></div><p data-cinematic-time-label>${escapeHtml(timeLabel)}</p></header><div class="cinematic-quick-controls" aria-label="Cinematic playback">${ambientScene ? "" : '<button type="button" data-cinematic-previous title="Previous observation">◀</button>'}<button type="button" data-cinematic-play aria-pressed="${playing ? "true" : "false"}"${ambientScene ? ' title="Play or pause the looping effects"' : ""}>${playing ? "Pause" : "Play"}</button>${ambientScene ? "" : '<button type="button" data-cinematic-next title="Next observation">▶</button>'}<button type="button" data-cinematic-focus title="Fly to the current observed feature">Focus</button></div>${inspection}<p class="cinematic-provenance">${this.#cinematicProvenanceBadges(state)}${escapeHtml(fidelityNote)}${state.layers?.[0]?.effectNote ? ` <span class="cinematic-effect-note">${escapeHtml(state.layers[0].effectNote)}</span>` : ""}</p><details class="cinematic-disclosure cinematic-disclosure--playback"${playbackOpen ? " open" : ""}><summary>${intent === "investigate" ? "Playback controls" : "Playback & map appearance"}</summary><div class="cinematic-controls">${ambientScene ? "" : `<label>Build up <input type="checkbox" data-cinematic-build-up${timeMode === "cumulative" ? " checked" : ""} aria-label="Build up observed records over time"></label><label>Local window <input type="checkbox" data-cinematic-local-window${localWindow ? " checked" : ""} aria-label="Filter cinematic observations to the current map window"></label>`}${ambientScene ? "" : `<label>Speed <select data-cinematic-rate aria-label="Playback speed"><option value="0.1"${timeline.playbackRate === 0.1 ? " selected" : ""}>Very slow</option><option value="0.25"${timeline.playbackRate === 0.25 ? " selected" : ""}>Slow</option><option value="0.5"${timeline.playbackRate === 0.5 ? " selected" : ""}>Steady</option><option value="1"${timeline.playbackRate === 1 ? " selected" : ""}>Fast</option><option value="2"${timeline.playbackRate === 2 ? " selected" : ""}>Very fast</option></select></label>`}${supportsGround ? `<label>Terrain <select data-cinematic-ground aria-label="Terrain"><option value="">Map setting</option>${terrainOptions}</select></label>` : ""}${supportsBoundaryGlow ? `${state.layers.length > 1 ? "" : `<label>Effect <select data-cinematic-effect aria-label="Visual effect">${effectOptions}</select></label>`}<label title="How much effect detail to draw. Auto lightens it for large scenes; the data is never reduced.">Detail <select data-cinematic-quality aria-label="Effect detail">${[["auto", "Auto"], ["eco", "Eco"], ["balanced", "Balanced"], ["cinematic", "Cinematic"]].map(([value, label]) => `<option value="${value}"${(state.spec?.cinematic.quality || "auto") === value ? " selected" : ""}>${label}</option>`).join("")}</select></label><label title="Effects loop on one clock, separate from the timeline">Effects move <input type="checkbox" data-cinematic-effects-playing${state.effects?.playing !== false ? " checked" : ""} aria-label="Effects move"></label><label>Effect speed <select data-cinematic-effects-rate aria-label="Effect speed">${[0.25, 0.5, 1, 2, 4].map((value) => `<option value="${value}"${(state.effects?.rate ?? 1) === value ? " selected" : ""}>${value}×</option>`).join("")}</select></label>` : ""}<label>Opacity <input type="range" data-cinematic-opacity min="5" max="100" value="${Math.round(Number(layerOpacity) * 100)}" aria-label="Cinematic layer opacity"></label>${ambientScene ? "" : `<label class="cinematic-controls__scrub">Observation <input type="range" data-cinematic-scrub min="0" max="${Math.max(0, timeline.ticks.length - 1)}" value="${timeline.observationIndex}" step="1"></label>`}</div>${ambientScene ? "" : this.#cinematicDateControls(state)}${supportsBoundaryGlow ? `<p class="cinematic-perf form-note" data-cinematic-perf aria-live="polite">${escapeHtml(this.#cinematicPerfText(state))}</p>` : ""}<p class="form-note">${ambientScene ? "Ambient: no dates or steps. Effects loop on one clock; pause stops repainting." : localWindow ? "The local range resets after each completed pan or zoom." : "Controls apply to observed data only."}</p></details>${this.#cinematicTracksMarkup(state, supportsBoundaryGlow)}${present}<div class="cinematic-footer-actions"><button type="button" data-cinematic-reconfigure>Change mapping</button><button type="button" data-cinematic-guide>Guide</button><button type="button" data-cinematic-exit>Exit</button></div></section>`;
    // An Ambient scene has no timeline: Play and Pause drive its looping effects.
    root.querySelector("[data-cinematic-play]")?.addEventListener("click", () => {
      if (this.cinematicState?.valueKind === "none") { this.cinematicController.toggleEffects(); this.#saveCinematicSpec(); }
      else this.cinematicController.toggle();
    });
    root.querySelector("[data-cinematic-effects-playing]")?.addEventListener("change", (event) => { this.cinematicController.setEffectsPlaying(event.target.checked); this.#saveCinematicSpec(); });
    root.querySelector("[data-cinematic-effects-rate]")?.addEventListener("change", (event) => { this.cinematicController.setEffectsRate(Number(event.target.value)); this.#saveCinematicSpec(); });
    root.querySelector("[data-cinematic-previous]")?.addEventListener("click", () => this.cinematicController.previousObservation());
    root.querySelector("[data-cinematic-next]")?.addEventListener("click", () => this.cinematicController.nextObservation());
    root.querySelector("[data-cinematic-focus]")?.addEventListener("click", () => {
      void this.cinematicController.focusCurrentObservation().catch((error) => this.error(`Could not focus the current observation: ${error.message}`));
    });
    root.querySelectorAll(".cinematic-disclosure").forEach((item) => item.addEventListener("toggle", () => this.#rememberCinematicDisclosureState(root)));
    root.querySelector("[data-cinematic-intent]")?.addEventListener("change", (event) => {
      this.#rememberCinematicDisclosureState(root);
      this.cinematicController.setIntent(event.target.value);
      const cinematic = this.cinematicController.exportCinematicSpec().cinematic;
      this.projectManager.patchPresentation({ cinematic });
      this.#renderPresentationDashboard(this.projectManager.current.presentation);
    });
    root.querySelector("[data-cinematic-scrub]")?.addEventListener("input", (event) => this.cinematicController.seekObservation(Number(event.target.value)));
    // Dates: a playback range (saved with the session) and Go to date.
    const fromLocal = (value) => this.#cinematicInputValue(value);
    const saveRange = (start, end) => {
      this.#rememberCinematicDisclosureState(root);
      try { this.cinematicController.setPlaybackRange(start, end); } catch (error) { this.error(error.message); return; }
      this.projectManager.patchPresentation({ cinematic: this.cinematicController.exportCinematicSpec().cinematic });
      this.cinematicState = this.cinematicController.state();
      this.#renderPresentationDashboard(this.projectManager.current.presentation);
    };
    root.querySelector("[data-cinematic-range-apply]")?.addEventListener("click", () => {
      const all = [...new Set((this.cinematicState?.layers || []).flatMap((layer) => layer.ticks || []))].sort((a, b) => a - b);
      const from = fromLocal(root.querySelector("[data-cinematic-from]").value), to = fromLocal(root.querySelector("[data-cinematic-to]").value);
      // A bound at the data's own first or last moment is no limit at all.
      saveRange(Number.isFinite(from) && from > all[0] ? from : "", Number.isFinite(to) && to < all.at(-1) ? to : "");
    });
    root.querySelector("[data-cinematic-range-all]")?.addEventListener("click", () => saveRange("", ""));
    root.querySelector("[data-cinematic-goto]")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const wanted = fromLocal(root.querySelector("[data-cinematic-goto-input]").value);
      const shown = this.cinematicController.goToTime(wanted);
      const note = root.querySelector("[data-cinematic-goto-note]");
      if (!Number.isFinite(shown)) { if (note) note.textContent = "Enter a date and time."; return; }
      const text = this.#cinematicValueText(shown);
      const message = shown > wanted ? `Nothing on or before that in the playing range; showing the first, ${text}.` : shown === wanted ? `Showing ${text}.` : `Showing the latest on or before it: ${text}.`;
      if (note) note.textContent = message;
      this.toast(message);
    });
    root.querySelector("[data-cinematic-rate]")?.addEventListener("change", (event) => {
      this.cinematicController.setRate(Number(event.target.value));
      const cinematic = this.cinematicController.exportCinematicSpec().cinematic;
      this.projectManager.patchPresentation({ cinematic });
    });
    root.querySelector("[data-cinematic-build-up]")?.addEventListener("change", (event) => {
      this.#rememberCinematicDisclosureState(root);
      this.cinematicController.setTimeMode(event.target.checked ? "cumulative" : "instant");
      const cinematic = this.cinematicController.exportCinematicSpec().cinematic;
      this.projectManager.patchPresentation({ cinematic });
      this.#renderPresentationDashboard(this.projectManager.current.presentation);
    });
    root.querySelector("[data-cinematic-local-window]")?.addEventListener("change", (event) => {
      this.#rememberCinematicDisclosureState(root);
      this.cinematicController.setLocalWindow(event.target.checked);
      this.cinematicState = this.cinematicController.state();
      this.#renderPresentationDashboard(this.projectManager.current.presentation);
    });
    root.querySelector("[data-cinematic-quality]")?.addEventListener("change", (event) => {
      this.cinematicController.setQuality(event.target.value);
      this.projectManager.patchPresentation({ cinematic: this.cinematicController.exportCinematicSpec().cinematic });
    });
    root.querySelector("[data-cinematic-effect]")?.addEventListener("change", (event) => {
      this.#rememberCinematicDisclosureState(root);
      this.cinematicController.setEffect(event.target.value);
      const cinematic = this.cinematicController.exportCinematicSpec().cinematic;
      this.projectManager.patchPresentation({ cinematic });
      this.cinematicState = this.cinematicController.state();
      this.#renderPresentationDashboard(this.projectManager.current.presentation);
    });
    this.#bindCinematicTracks(root);
    // The effects readout refreshes on its own while the panel shows (Ambient scenes have no steps).
    clearInterval(this.cinematicPerfTimer);
    this.cinematicPerfTimer = setInterval(() => {
      const perf = document.querySelector("[data-cinematic-perf]");
      if (!perf || !this.cinematicState) { clearInterval(this.cinematicPerfTimer); return; }
      perf.textContent = this.#cinematicPerfText(this.cinematicController.state());
    }, 2000);
    root.querySelector("[data-cinematic-ground]")?.addEventListener("change", (event) => {
      if (event.target.value) this.mapController.setGround(event.target.value);
    });
    root.querySelector("[data-cinematic-opacity]")?.addEventListener("input", (event) => {
      void this.cinematicController.setLayerOpacity(Number(event.target.value) / 100).then(() => {
        const cinematic = this.cinematicController.exportCinematicSpec().cinematic;
        this.projectManager.patchPresentation({ cinematic });
      });
    });
    root.querySelector("[data-cinematic-create-clip]")?.addEventListener("click", () => this.#captureCinematicClipDialog());
    root.querySelector("[data-cinematic-edit-clip]")?.addEventListener("click", () => this.#captureCinematicClipDialog({ clip: this.#latestCinematicClip() }));
    root.querySelector("[data-cinematic-add-brief]")?.addEventListener("click", () => this.#addCinematicClipToBrief());
    root.querySelector("[data-cinematic-download-clip]")?.addEventListener("click", () => this.#downloadCinematicClip());
    root.querySelector("[data-cinematic-poster]")?.addEventListener("click", () => void this.#downloadCinematicPoster());
    root.querySelector("[data-cinematic-record]")?.addEventListener("click", () => void this.#recordCinematicClip());
    root.querySelector("[data-cinematic-reconfigure]")?.addEventListener("click", () => this.#openCinematicMode({ reconfigure: true }));
    root.querySelector("[data-cinematic-guide]")?.addEventListener("click", () => void this.#startCinematicGuide());
    root.querySelector("[data-cinematic-exit]")?.addEventListener("click", async () => {
      await this.#leaveCinematic();
      this.projectManager.setPresentation({ ...this.projectManager.current.presentation, template: "standard" });
    });
    this.#syncCinematicMapTimeline(state);
  }

  /** A playback position as people read it: a date, "field value", or nothing for ambient. */
  #cinematicValueText(value, state = this.cinematicState) {
    if (state?.valueKind === "none") return "Ambient";
    if (state?.valueKind === "number") {
      const field = state.layers?.[0]?.timeField || "Value";
      const number = Number(value);
      // A year field (YEAR_, FIRE_YEAR) reads as a year: 1989, not "YEAR_ 1,989".
      if (/year/i.test(field) && Number.isInteger(number)) return String(number);
      return `${field} ${number.toLocaleString(undefined, { maximumFractionDigits: 6 })}`;
    }
    return this.#formatExplorerTime(new Date(value));
  }

  /** The panel's one-line position: where playback is, out of how many steps. */
  #cinematicPositionLabel(state) {
    const timeline = state?.timeline;
    if (!timeline) return "";
    if (state.localEmpty) return "No records intersect the current map window.";
    const count = (state.layers || []).reduce((sum, layer) => sum + (layer.observedCount || 0), 0);
    if (state.valueKind === "none") return `Ambient · ${count.toLocaleString()} feature${count === 1 ? "" : "s"} · effects loop${state.localWindow ? " · local window" : ""}`;
    const cumulative = (state.spec?.cinematic.clock.timeMode || "instant") === "cumulative";
    const prefix = cumulative ? (state.valueKind === "number" ? "Up to " : "Cumulative through ") : "";
    return `${prefix}${this.#cinematicValueText(timeline.observationTime, state)} · ${state.valueKind === "number" ? "step" : "observation"} ${timeline.observationIndex + 1} of ${timeline.ticks.length}${state.localWindow ? " · local window" : ""}`;
  }

  /** A datetime-local value (local time, to the second) for epoch ms. */
  #localDateTimeValue(ms) {
    return Number.isFinite(ms) ? new Date(ms - new Date(ms).getTimezoneOffset() * 60000).toISOString().slice(0, 19) : "";
  }

  /**
   * Playback range (From / To, with All dates) and Go to date. The range is
   * bounded by the observations the session has (in the local window when on).
   */
  #cinematicDateControls(state) {
    if (state.valueKind === "none") return "";
    const all = [...new Set((state.layers || []).flatMap((layer) => layer.ticks || []))].sort((a, b) => a - b);
    if (!all.length) return "";
    const numeric = state.valueKind === "number";
    const clock = state.spec?.cinematic.clock || {};
    const from = this.#cinematicInputValue(clock.start, state, true), to = this.#cinematicInputValue(clock.end, state, true);
    const limited = Number.isFinite(from) || Number.isFinite(to);
    const show = (value) => (numeric ? String(value) : this.#localDateTimeValue(value));
    const input = (attributes, value) => numeric
      ? `<input type="number" step="any" ${attributes} min="${all[0]}" max="${all.at(-1)}" value="${value}">`
      : `<input type="datetime-local" step="1" ${attributes} min="${show(all[0])}" max="${show(all.at(-1))}" value="${value}">`;
    const count = state.timeline?.ticks?.length || 0;
    const noun = numeric ? "values" : "observations";
    return `<fieldset class="cinematic-dates"><legend>${numeric ? "Values" : "Dates"}</legend>
      <div class="cinematic-dates__range"><label>Play from ${input("data-cinematic-from", show(Number.isFinite(from) ? from : all[0]))}</label><label>to ${input("data-cinematic-to", show(Number.isFinite(to) ? to : all.at(-1)))}</label></div>
      <div class="cinematic-dates__actions"><button type="button" data-cinematic-range-apply>Set range</button>${limited ? `<button type="button" data-cinematic-range-all>All ${numeric ? "values" : "dates"}</button>` : ""}</div>
      <p class="form-note">${limited ? `Playing ${count.toLocaleString()} of ${all.length.toLocaleString()} ${noun}.` : `All ${all.length.toLocaleString()} ${noun}.`}</p>
      <form class="cinematic-dates__goto" data-cinematic-goto><label>Go to ${numeric ? "value" : "date"} ${input("data-cinematic-goto-input required", "")}</label><button type="submit">Go</button></form>
      <p class="form-note" data-cinematic-goto-note aria-live="polite"></p>
    </fieldset>`;
  }

  /** An input's (or stored range bound's) value as a playback value: epoch ms for dates, the number for a sweep. */
  #cinematicInputValue(value, state = this.cinematicState, stored = false) {
    if (value === "" || value == null) return NaN;
    if (state?.valueKind === "number") return Number(value);
    return stored ? Date.parse(value) : new Date(value).getTime();
  }

  /** Effect <option>s; "Auto" names the effect it resolves to for this layer. */
  /**
   * Leave Cinematic mode. Each track's effect (flames on a wildfire layer, say)
   * stays on its layer as its Advanced Style animated effect, so the Layers view
   * keeps the look; Style → Animated effect changes or removes it.
   */
  async #leaveCinematic() {
    const keep = this.mapController.getCapabilities().includes("three-3d") ? this.cinematicController.effectsToKeep() : [];
    this.cinematicState = null;
    document.querySelector("#cinematic-map-timeline")?.remove();
    await this.cinematicController.destroy();
    const kept = [];
    for (const { uid, title, effect } of keep) {
      if (!this.mapController.getLayer(uid)) continue;
      try { await this.mapController.setLayerEffect(uid, effect); kept.push(`${CINEMATIC_EFFECTS[effect.type]?.label || effect.type} on ${title}`); } catch { /* the layer keeps its own look */ }
    }
    if (kept.length) this.toast(`Kept ${kept.join(", ")}. Change it in the layer's Style → Animated effect.`);
  }

  /**
   * Layer → Animate: suggestions for this layer, each with why it was offered
   * and what it shows (observed or illustrative). Ambient ones apply right on
   * the map; any of them can open in Cinematic mode instead.
   */
  #openAnimateLayer(uid) {
    const layer = this.mapController.getLayer(uid);
    if (!layer) return;
    const suggestions = recommendAnimations(layer);
    const kindName = { time: "Timeline", number: "Scenario", none: "Ambient" };
    const cards = suggestions.map((item, index) => `<article class="animate-option"><header><span class="animate-option__kind">${kindName[item.kind]}</span><span class="cinematic-badge cinematic-badge--${item.provenance}">${item.provenance}</span></header><strong>${escapeHtml(item.label.replace(/^[A-Za-z]+: /, ""))}</strong><p>${escapeHtml(item.reason)}</p><div class="animate-option__actions">${item.kind === "none" ? `<button type="button" class="button--primary" data-animate-apply="${index}">Animate on the map</button>` : ""}<button type="button" data-animate-cinematic="${index}">${item.kind === "none" ? "Open in Cinematic" : "Play in Cinematic"}</button></div></article>`).join("");
    const current = layer.animatedEffect ? `<p class="form-note">Now animated with ${escapeHtml(CINEMATIC_EFFECTS[layer.animatedEffect.type]?.label || layer.animatedEffect.type)}. <button type="button" class="link-button" data-animate-stop>Stop animating</button></p>` : "";
    this.openDialog({
      eyebrow: "Animate",
      title: `Animate ${layer.title || "layer"}`,
      content: `<p class="form-note">Suggested from this layer's shape and fields. A Timeline needs a real date field; without one, layers can still loop (Ambient) or sweep a number (Scenario). Effects decorate the data and never change it.</p>${current}<div class="animate-options">${cards}</div><p class="form-note"><button type="button" class="link-button" data-animate-more>More options in Cinematic setup…</button></p>`,
      actions: [{ label: "Close", handler: () => this.dialog.close() }],
    });
    const pick = (index) => suggestions[Number(index)];
    this.dialog.querySelectorAll("[data-animate-apply]").forEach((button) => button.addEventListener("click", async () => {
      const item = pick(button.dataset.animateApply);
      try {
        await this.mapController.setLayerEffect(uid, { type: item.effect, intensity: 1, ...(item.field ? { field: item.field } : {}) });
        this.dialog.close();
        this.toast(`${layer.title}: ${CINEMATIC_EFFECTS[item.effect]?.label || item.effect} on. Change it in Style → Animated effect.`);
      } catch (error) { this.error(`Could not animate the layer: ${error.message}`); }
    }));
    this.dialog.querySelectorAll("[data-animate-cinematic]").forEach((button) => button.addEventListener("click", () => {
      const item = pick(button.dataset.animateCinematic);
      this.dialog.close();
      this.#startCinematicFromSuggestion(layer, item).catch((error) => this.error(`Could not start Cinematic mode: ${error.message}`));
    }));
    this.dialog.querySelector("[data-animate-stop]")?.addEventListener("click", async () => {
      await this.mapController.setLayerEffect(uid, { type: "none" });
      this.dialog.close();
    });
    this.dialog.querySelector("[data-animate-more]")?.addEventListener("click", () => {
      this.presentationState.layerUid = uid;
      this.dialog.close();
      this.#openCinematicMode({ reconfigure: true });
    });
  }

  /** Start Cinematic mode straight from an Animate suggestion (no setup dialog). */
  async #startCinematicFromSuggestion(layer, item) {
    const spec = { cinematic: {
      id: `cinematic-${Date.now()}`,
      title: `${layer.title || "Map"} ${item.kind === "none" ? "animation" : item.kind === "number" ? `by ${item.field}` : "playback"}`,
      intent: "explore", preferredEngine: this.mapController.getEngineId(),
      clock: { durationSeconds: 120, rate: 0.25, timeMode: item.timeMode || "instant", loop: false },
      layers: [{ layerRef: layer.uid, temporal: { kind: item.kind, startField: item.kind === "none" ? null : item.field, featureIdField: layer.objectIdField, timezone: "UTC", missingTime: "exclude" },
        animation: { template: layer.geometryType === "point" ? "moving-track" : "step-perimeter", transition: "step", effect: { type: item.effect, intensity: 1, ...(item.kind === "none" && item.field ? { field: item.field } : {}) }, provenanceLabel: "Observed records" },
        provenance: { status: item.provenance } }],
      provenance: { synthetic: false, sourceUrls: layer.url && /^https:\/\//i.test(layer.url) ? [layer.url] : [], interpolated: false },
    } };
    await this.cinematicController.load(spec);
    this.cinematicState = this.cinematicController.state();
    this.projectManager.setPresentation({ ...this.projectManager.current.presentation, template: "cinematic", title: spec.cinematic.title, primaryLayerId: layer.uid, cinematic: this.cinematicController.exportCinematicSpec().cinematic });
  }

  /** Cinematic mode with no animatable layer: explain that it needs data and offer the ways to add some. */
  #openCinematicNeedsData() {
    this.openDialog({
      eyebrow: "Cinematic mode",
      title: "Add data to animate",
      content: `<p class="form-note">Cinematic mode animates a feature layer on your map, so it needs data first: a layer of points, lines or polygons, ideally with a date or number field to play through.</p><div class="cinematic-needs-data"><button type="button" data-cinematic-needs="data-popular"><strong>Popular data services</strong><span>Browse live public layers such as earthquakes, wildfires and storms.</span></button><button type="button" data-cinematic-needs="guide"><strong>Cinematic mode tutorial</strong><span>A step-by-step guide that loads an example layer for you.</span></button><button type="button" data-cinematic-needs="data-arcgis"><strong>Add ArcGIS REST service</strong><span>Connect a FeatureServer or MapServer layer by URL.</span></button><button type="button" data-cinematic-needs="data-geojson"><strong>Add Geo URL</strong><span>Load GeoJSON or another geodata file from a web address.</span></button></div>`,
      actions: [{ label: "Close", handler: () => this.dialog.close() }],
    });
    this.dialog.querySelectorAll("[data-cinematic-needs]").forEach((button) => button.addEventListener("click", () => {
      const choice = button.dataset.cinematicNeeds;
      this.dialog.close();
      // The next step opens its own dialog, so it starts after this one has closed.
      setTimeout(() => { if (choice === "guide") void this.#startCinematicGuide(); else this.#handleAction(choice); }, 0);
    }));
  }

  #saveCinematicSpec() {
    this.projectManager.patchPresentation({ cinematic: this.cinematicController.exportCinematicSpec().cinematic });
  }

  /** One badge per track saying what its progression is: Observed, Interpolated, Modeled, Forecast or Illustrative. */
  #cinematicProvenanceBadges(state) {
    const statuses = [...new Set((state.layers || []).map((item) => item.provenance || "illustrative"))];
    return statuses.map((status) => `<span class="cinematic-badge cinematic-badge--${escapeHtml(status)}" title="${escapeHtml(PROVENANCE_HELP[status] || "")}">${escapeHtml(status[0].toUpperCase() + status.slice(1))}</span> `).join("");
  }

  /** The scene's tracks: each layer with its role and effect, plus adding another layer beside the lead track. */
  #cinematicTracksMarkup(state, supportsEffects) {
    const kindLabel = (item) => item.ambient || item.kind === "none" ? "Ambient · loops beside the timeline" : item.kind === "number" ? `Scenario · ${item.timeField}` : `Timeline · ${item.timeField}`;
    const inScene = new Set(state.layers.map((item) => item.uid));
    const candidates = this.mapController.getLayers().filter((layer) => layer.queryable && layer.objectIdField && !inScene.has(layer.uid));
    const rows = state.layers.map((item) => `<li><span><b>${escapeHtml(item.title)}</b><small>${escapeHtml(kindLabel(item))} · <span data-cinematic-track-count="${escapeHtml(item.uid)}">${item.observedCount.toLocaleString()}</span> shown</small></span>${supportsEffects ? `<select data-cinematic-track-effect="${escapeHtml(item.uid)}" aria-label="Effect for ${escapeHtml(item.title)}">${this.#cinematicEffectOptions(item.effectType, item.effect, { cinematic: true })}</select>` : ""}${state.layers.length > 1 ? `<button type="button" class="cinematic-track-remove" data-cinematic-track-remove="${escapeHtml(item.uid)}" aria-label="Remove ${escapeHtml(item.title)} from the scene">Remove</button>` : ""}${supportsEffects ? this.#cinematicTrackMotion(item) : ""}</li>`).join("");
    const add = candidates.length ? `<div class="cinematic-track-add"><label>Add layer <select data-cinematic-track-layer>${candidates.map((layer) => `<option value="${escapeHtml(layer.uid)}">${escapeHtml(layer.title || "Untitled layer")}</option>`).join("")}</select></label><label>As <select data-cinematic-track-kind></select></label><button type="button" data-cinematic-track-add>Add track</button></div>` : '<p class="form-note">Add another queryable layer to the map to animate it here too.</p>';
    const open = this.cinematicDisclosureState?.tracks === true;
    return `<details class="cinematic-disclosure cinematic-disclosure--tracks"${open ? " open" : ""}><summary>Tracks (${state.layers.length})</summary><ul class="cinematic-tracks">${rows}</ul>${add}<p class="form-note">Ambient tracks show every feature with a looping effect beside the timeline. Timeline tracks step with it under the same clock.</p></details>`;
  }

  /** A track's own motion and label: show, colour, speed, cycle, policy and provenance. */
  #cinematicTrackMotion(item) {
    const uid = escapeHtml(item.uid), timing = item.timing || {};
    const option = (value, label, current) => `<option value="${value}"${String(current) === String(value) ? " selected" : ""}>${label}</option>`;
    return `<details class="cinematic-track-motion"><summary>Motion & label</summary><div class="cinematic-track-motion__grid">`
      + `<label>Show effect <input type="checkbox" data-cinematic-track-visible="${uid}"${item.visible !== false ? " checked" : ""}></label>`
      + `<label>Colour <input type="color" data-cinematic-track-color="${uid}" value="${escapeHtml(item.color || CINEMATIC_EFFECTS[item.effect]?.color || "#ff8136")}"></label>`
      + `<label>Speed <select data-cinematic-track-rate="${uid}">${[0.25, 0.5, 1, 2, 4].map((value) => option(value, `${value}×`, timing.rate ?? 1)).join("")}</select></label>`
      + `<label>Cycle <select data-cinematic-track-cycle="${uid}">${[[0, "Continuous"], [3, "3 s"], [6, "6 s"], [12, "12 s"], [30, "30 s"]].map(([value, label]) => option(value, label, timing.cycleSeconds ?? 0)).join("")}</select></label>`
      + `<label>Repeat <select data-cinematic-track-policy="${uid}">${[["loop", "Loop"], ["pingPong", "Ping-pong"], ["once", "Once"], ["hold", "Hold still"]].map(([value, label]) => option(value, label, timing.policy || "loop")).join("")}</select></label>`
      + `<label>Shown as <select data-cinematic-track-provenance="${uid}">${PROVENANCE_STATUSES.map((status) => option(status, status[0].toUpperCase() + status.slice(1), item.provenance)).join("")}</select></label>`
      + `</div><p class="form-note">${escapeHtml(PROVENANCE_HELP[item.provenance] || "")} Speed and cycle are animation settings, not physical rates.</p></details>`;
  }

  #bindCinematicTracks(root) {
    const commit = () => {
      this.#rememberCinematicDisclosureState(root);
      this.projectManager.patchPresentation({ cinematic: this.cinematicController.exportCinematicSpec().cinematic });
      this.cinematicState = this.cinematicController.state();
      this.#renderPresentationDashboard(this.projectManager.current.presentation);
    };
    root.querySelectorAll("[data-cinematic-track-effect]").forEach((select) => select.addEventListener("change", () => {
      this.cinematicController.setEffect(select.value, select.dataset.cinematicTrackEffect);
      commit();
    }));
    const onTrack = (selector, apply) => root.querySelectorAll(`[${selector}]`).forEach((input) => input.addEventListener("change", () => {
      apply(input.getAttribute(selector), input);
      commit();
    }));
    onTrack("data-cinematic-track-visible", (uid, input) => this.cinematicController.setTrackVisible(uid, input.checked));
    onTrack("data-cinematic-track-color", (uid, input) => this.cinematicController.setTrackColor(uid, input.value));
    onTrack("data-cinematic-track-rate", (uid, input) => this.cinematicController.setTrackTiming(uid, { rate: Number(input.value) }));
    onTrack("data-cinematic-track-cycle", (uid, input) => this.cinematicController.setTrackTiming(uid, { cycleSeconds: Number(input.value) }));
    onTrack("data-cinematic-track-policy", (uid, input) => this.cinematicController.setTrackTiming(uid, { policy: input.value }));
    onTrack("data-cinematic-track-provenance", (uid, input) => this.cinematicController.setTrackProvenance(uid, input.value));
    root.querySelectorAll("[data-cinematic-track-remove]").forEach((button) => button.addEventListener("click", () => {
      this.cinematicController.removeTrack(button.dataset.cinematicTrackRemove).then(commit).catch((error) => this.error(error.message));
    }));
    const layerInput = root.querySelector("[data-cinematic-track-layer]");
    const kindInput = root.querySelector("[data-cinematic-track-kind]");
    if (!layerInput || !kindInput) return;
    // A new track steps the way the scene does (or leads it, when the scene is all Ambient), or loops as Ambient.
    const fillKinds = () => {
      const layer = this.mapController.getLayer(layerInput.value);
      const lead = this.cinematicController.valueKind();
      const fields = (kind) => (kind === "number" ? numericFieldCandidates(layer) : temporalFieldCandidates(layer)).map((field) => ({ kind, field }));
      const choices = lead === "none" ? [...fields("time"), ...fields("number")] : fields(lead);
      kindInput.innerHTML = `<option value="none">Ambient loop</option>${choices.map(({ kind, field }) => `<option value="${kind}:${escapeHtml(field.name)}">${kind === "number" ? "Sweep" : "Timeline"} by ${escapeHtml(field.label)}</option>`).join("")}`;
    };
    layerInput.addEventListener("change", fillKinds);
    fillKinds();
    root.querySelector("[data-cinematic-track-add]")?.addEventListener("click", (event) => {
      const layer = this.mapController.getLayer(layerInput.value);
      const [kind, ...field] = kindInput.value.split(":");
      event.currentTarget.disabled = true;
      event.currentTarget.textContent = "Adding…";
      this.cinematicController.addTrack({ layerRef: layerInput.value, kind, startField: kind === "none" ? null : field.join(":"), effect: "auto" })
        .then(() => { commit(); this.toast(`${layer?.title || "Layer"} added as a track.`); })
        .catch((error) => { this.error(error.message); commit(); });
    });
  }

  /** Effect menu options. `cinematic` adds the effects that need a timeline (Strata timeline). */
  #cinematicEffectOptions(selected, suggested, { cinematic = false } = {}) {
    const one = (type, label) => `<option value="${type}"${type === selected ? " selected" : ""}>${escapeHtml(label)}</option>`;
    return one("auto", `Auto · ${CINEMATIC_EFFECTS[suggested]?.label || "Glow"}`)
      + one("none", "None")
      + CINEMATIC_EFFECT_CATEGORIES.map((category) => `<optgroup label="${escapeHtml(category)}">${Object.entries(CINEMATIC_EFFECTS).filter(([type, effect]) => type !== "none" && effect.category === category && (cinematic || !effect.cinematicOnly)).map(([type, effect]) => one(type, effect.label)).join("")}</optgroup>`).join("");
  }

  #rememberCinematicDisclosureState(root = document) {
    const open = (selector) => root.querySelector?.(selector)?.open;
    this.cinematicDisclosureState = {
      playback: open(".cinematic-disclosure--playback") === true,
      tracks: open(".cinematic-disclosure--tracks") === true,
      present: open(".cinematic-disclosure--present") !== false,
    };
  }

  #syncCinematicControls(state) {
    const timeline = state?.timeline;
    const root = document.querySelector("#presentation-dashboard");
    if (!timeline || !root || this.projectManager.current.presentation?.template !== "cinematic") { document.querySelector("#cinematic-map-timeline")?.remove(); return; }
    const time = root.querySelector("[data-cinematic-time-label]");
    const timeMode = state.spec?.cinematic.clock.timeMode || "instant";
    if (time) time.textContent = this.#cinematicPositionLabel(state);
    const buildUp = root.querySelector("[data-cinematic-build-up]");
    if (buildUp) buildUp.checked = timeMode === "cumulative";
    const slider = root.querySelector("[data-cinematic-scrub]");
    if (slider && document.activeElement !== slider) slider.value = String(timeline.observationIndex);
    const play = root.querySelector("[data-cinematic-play]");
    const playing = state.valueKind === "none" ? state.effects?.playing === true : timeline.playing;
    if (play) { play.textContent = playing ? "Pause" : "Play"; play.setAttribute("aria-pressed", String(playing)); }
    const effectsPlaying = root.querySelector("[data-cinematic-effects-playing]");
    if (effectsPlaying) effectsPlaying.checked = state.effects?.playing !== false;
    const local = root.querySelector("[data-cinematic-local-window]");
    if (local) local.checked = state.localWindow === true;
    const perf = root.querySelector("[data-cinematic-perf]");
    if (perf) perf.textContent = this.#cinematicPerfText(state);
    root.querySelectorAll("[data-cinematic-track-count]").forEach((count) => {
      const track = state.layers?.find((item) => item.uid === count.dataset.cinematicTrackCount);
      if (track) count.textContent = track.observedCount.toLocaleString();
    });
    this.#syncCinematicMapTimeline(state);
  }

  /** One line on effect load: what is drawn, measured frame rate, and whether Auto lightened the detail. */
  #cinematicPerfText(state) {
    const { stats, lightened } = state?.detail || {};
    if (!stats?.items && !stats?.native) return "Effects: nothing drawn yet.";
    const parts = [`Effects: ${(stats.vertices || 0).toLocaleString()} vertices`];
    if (stats.drawCalls) parts.push(`${stats.drawCalls} draw call${stats.drawCalls === 1 ? "" : "s"}`);
    if (stats.native) parts.push(`${stats.native} native layer${stats.native === 1 ? "" : "s"}`);
    if (stats.fps) parts.push(`${stats.fps} fps`);
    if (state.effects && !state.effects.playing) parts.push("effects paused (no repaint)");
    if (lightened) parts.push(`Auto lightened detail to ${lightened[0].toUpperCase()}${lightened.slice(1)} to keep playback smooth`);
    return `${parts.join(" · ")}.`;
  }

  #syncCinematicMapTimeline(state) {
    const timeline = state?.timeline;
    const container = this.mapController.getContainer?.();
    // Ambient animations have no timeline to scrub.
    if (state?.valueKind === "none") { document.querySelector("#cinematic-map-timeline")?.remove(); return; }
    if (!timeline || !container || this.projectManager.current.presentation?.template !== "cinematic") return;
    let overlay = container.querySelector?.("#cinematic-map-timeline");
    if (!overlay) {
      overlay = document.createElement("section");
      overlay.id = "cinematic-map-timeline";
      overlay.className = "cinematic-map-timeline";
      overlay.setAttribute("aria-label", "Cinematic timeline");
      container.append(overlay);
      overlay.addEventListener("click", (event) => {
        if (event.target.closest("[data-cinematic-map-play]")) this.cinematicController.toggle();
      });
      overlay.addEventListener("input", (event) => {
        if (event.target.matches("[data-cinematic-map-scrub]")) this.cinematicController.seekObservation(Number(event.target.value));
      });
      overlay.addEventListener("change", (event) => {
        if (event.target.matches("[data-cinematic-map-local]")) {
          this.cinematicController.setLocalWindow(event.target.checked);
          this.cinematicState = this.cinematicController.state();
          this.#renderPresentationDashboard(this.projectManager.current.presentation);
        }
      });
    }
    const current = this.#cinematicValueText(timeline.observationTime, state);
    const start = this.#cinematicValueText(timeline.ticks[0], state);
    const end = this.#cinematicValueText(timeline.ticks.at(-1), state);
    overlay.innerHTML = `<div class="cinematic-map-timeline__meta"><strong>${state.localEmpty ? "No local observations" : current}</strong><span>${state.localWindow ? "Local window" : "All observed data"}</span></div><div class="cinematic-map-timeline__controls"><button type="button" data-cinematic-map-play aria-pressed="${timeline.playing ? "true" : "false"}">${timeline.playing ? "Pause" : "Play"}</button><span>${escapeHtml(start)}</span><input type="range" data-cinematic-map-scrub min="0" max="${Math.max(0, timeline.ticks.length - 1)}" value="${timeline.observationIndex}" step="1" aria-label="Cinematic observation"><span>${escapeHtml(end)}</span><label><input type="checkbox" data-cinematic-map-local${state.localWindow ? " checked" : ""}> Local window</label></div>`;
  }

  #syncPresentationMobileControls(presentation = this.projectManager.current.presentation || {}) {
    const controls = document.querySelector("#mobile-presentation-controls");
    if (!controls) return;
    const template = presentation.template || "standard";
    const mobileAtlasPresenting = this.mobileMedia.matches && template === "atlas" && (this.presentationState.atlasPresent || this.mobileAtlasSettingsOpen);
    document.body.classList.toggle("mobile-atlas-presenting", mobileAtlasPresenting);
    // Briefing actions live in the docked action bar; these controls are for presenting a tour.
    controls.hidden = template !== "atlas" || !this.presentationState.atlasPresent;
    controls.dataset.presentation = template;
    const chapters = presentation.chapters || [];
    const index = Number.isInteger(this.presentationState.atlasChapterIndex) ? this.presentationState.atlasChapterIndex : 0;
    const previous = controls.querySelector("[data-mobile-atlas-previous]");
    const next = controls.querySelector("[data-mobile-atlas-next]");
    const play = controls.querySelector("[data-mobile-atlas-play]");
    const settings = controls.querySelector("[data-mobile-atlas-settings]");
    previous.disabled = !chapters.length || index <= 0;
    next.disabled = !chapters.length || index >= chapters.length - 1;
    // Manual tours do not start on their own, but viewers can still play them.
    play.hidden = chapters.length < 2;
    play.textContent = this.presentationState.atlasPlaying ? "❚❚" : "▶";
    play.setAttribute("aria-label", this.presentationState.atlasPlaying ? "Pause tour" : "Play tour");
    settings.hidden = this.sharedTourOnly;
    const contextButton = controls.querySelector("[data-mobile-briefing-context]");
    contextButton.disabled = !this.presentationState.selected;
    contextButton.setAttribute("aria-expanded", String(document.body.classList.contains("mobile-briefing-context-open")));
    if (template !== "briefing") document.body.classList.remove("mobile-briefing-context-open");
  }

  #mobileAtlasControlDialog() {
    const presentation = this.projectManager.current.presentation || {};
    const defaultName = presentation.title || "Guided places";
    this.openDialog({
      eyebrow: "Guided places",
      title: "Control tour",
      content: `<p class="form-note">Keep viewing, save this tour and its current project state in this browser, or end the presentation and return to the standard GIS workspace.</p><label class="field"><span>Local project name</span><input id="mobile-tour-project-name" value="${escapeHtml(defaultName)}" /></label>`,
      actions: [
        { label: "Continue tour", handler: () => this.dialog.close() },
        { label: "Save locally", handler: () => {
          const name = this.dialog.querySelector("#mobile-tour-project-name").value.trim() || defaultName;
          this.projectManager.save(name);
          this.dialog.close();
          this.toast(`Tour saved locally as “${name}”.`);
        } },
        { label: "End tour · Open GISMap Online", primary: true, handler: () => { this.dialog.close(); this.#exitAtlasTour(); } },
      ],
    });
  }

  #openMobileAtlasSettings() {
    const presentation = this.projectManager.current.presentation || {};
    if (presentation.template !== "atlas") return;
    this.mobileAtlasSettingsOpen = true;
    this.#stopAtlasStory();
    this.presentationState.atlasPresent = false;
    this.#renderPresentationDashboard(presentation);
    if (!this.utilityPresentationOpen) this.#togglePresentationDock();
    else this.#syncUtilityPanel("presentation");
  }

  #togglePresentationDock() {
    const dashboard = document.querySelector("#presentation-dashboard");
    if (!dashboard) return;
    this.panelManager?.register("presentation:dashboard", dashboard);
    this.utilityPresentationOpen = !this.utilityPresentationOpen;
    if (this.utilityPresentationOpen) {
      this.panelManager?.move("presentation:dashboard", document.querySelector("#utility-presentation-content"), {
        surface: "utility",
        replaceHost: true,
      });
      document.body.classList.add("presentation-workspace-panels-open");
      document.querySelectorAll(".sidebar__scroll > .panel[data-presentation-hidden]").forEach((panel) => { panel.hidden = false; });
    } else {
      this.panelManager?.restore("presentation:dashboard");
      document.body.classList.remove("presentation-workspace-panels-open");
      document.querySelectorAll(".sidebar__scroll > .panel[data-presentation-hidden]").forEach((panel) => { panel.hidden = true; });
    }
    const dockButton = dashboard.querySelector("[data-presentation-dock]");
    if (dockButton) {
      const mobileSettings = this.mobileMedia.matches && this.utilityPresentationOpen;
      const label = mobileSettings ? "Close presentation settings" : this.utilityPresentationOpen ? "Return to map" : "Open in right panel";
      dockButton.setAttribute("aria-label", label);
      dockButton.title = label;
      if (mobileSettings) dockButton.textContent = "×";
      else dockButton.innerHTML = dockIcon(this.utilityPresentationOpen ? "undock" : "dock");
    }
    this.#syncUtilityPanel("presentation");
    this.mapController.resize();
  }

  #addPresentationDockControl(root) {
    const header = root.querySelector(".mode-dashboard > header");
    if (!header || header.querySelector("[data-presentation-dock]")) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "presentation-dock-button";
    button.dataset.presentationDock = "";
    const mobileSettings = this.mobileMedia.matches && this.utilityPresentationOpen;
    button.setAttribute("aria-label", mobileSettings ? "Close presentation settings" : this.utilityPresentationOpen ? "Return to left panel" : "Open in right panel");
    button.title = button.getAttribute("aria-label");
    if (mobileSettings) button.textContent = "×";
    else button.innerHTML = dockIcon(this.utilityPresentationOpen ? "undock" : "dock");
    button.addEventListener("click", () => mobileSettings ? this.#closeUtilityTab("presentation") : this.#togglePresentationDock());
    header.append(button);
  }

  #fieldOptions(fields, selected, predicate = () => true) {
    return fields.filter(predicate).map((field) => `<option value="${escapeHtml(field.name)}"${field.name === selected ? " selected" : ""}>${escapeHtml(field.alias || field.name)}</option>`).join("");
  }


  #renderExplorerWorkspace(root, presentation, layer, fields) {
    const state = this.presentationState;
    const roles = state.roles || this.#presentationRoles(presentation, layer, fields);
    const loaded = state.records.length;
    const total = state.totalCount;
    const incomplete = Number.isFinite(total) && total > loaded;
    const selected = state.selected;
    const idField = layer.objectIdField;
    const chart = histogram(state.visibleRecords, state.chartField, state.binCount);
    const maxBin = Math.max(1, ...chart.bins.map((bin) => bin.count));
    const pageCount = Math.max(1, Math.ceil(state.visibleRecords.length / state.pageSize));
    state.page = Math.min(state.page, pageCount);
    const pageRecords = state.visibleRecords.slice((state.page - 1) * state.pageSize, state.page * state.pageSize);
    const searchField = fields.fields.find((field) => field.name === state.searchField);
    const chartLabel = fields.fields.find((field) => field.name === state.chartField)?.alias || state.chartField || "Numeric field";
    const activeRange = state.rangeMin != null || state.rangeMax != null;
    root.innerHTML = `<section class="mode-dashboard mode-dashboard--explorer presentation-workspace">
      <header class="presentation-compact-header"><span class="eyebrow">Dataset explorer</span><h2>${escapeHtml(presentation.title || layer.title || "Explore records")}</h2><label class="compact-dataset"><span>Dataset</span><select data-mode-dataset>${this.mapController.getLayers().filter((item) => item.queryable).map((item) => `<option value="${escapeHtml(item.uid)}"${item.uid === layer.uid ? " selected" : ""}>${escapeHtml(item.title || "Untitled layer")}</option>`).join("")}</select></label></header>
      <div class="explorer-counts"><button data-coverage-open><b>${Number.isFinite(total) ? total.toLocaleString() : "—"}</b><span>Total${Number.isFinite(total) ? "" : " unknown"}</span></button><button data-coverage-open><b>${loaded.toLocaleString()}</b><span>Available locally</span></button><button data-mode-zoom><b>${state.visibleRecords.length.toLocaleString()}</b><span>Match filters</span></button><button data-selection-zoom><b>${state.selectedIds.size}</b><span>Selected</span></button></div>
      <p class="explorer-coverage ${incomplete ? "is-partial" : ""}">${incomplete ? `Working with ${loaded.toLocaleString()} locally available records out of ${total.toLocaleString()} reported by the service.` : `Working with ${loaded.toLocaleString()} records available to this browser.`}</p>
      <section class="explorer-toolbar"><div class="explorer-search-grid"><label class="field"><span>Search field</span><select data-search-field><option value="*"${state.searchField === "*" ? " selected" : ""}>All searchable text fields</option>${this.#fieldOptions(fields.fields, state.searchField)}</select></label><label class="field explorer-search-input"><span>Search records</span><input data-mode-search list="presentation-search-values" value="${escapeHtml(state.search)}" placeholder="Search ${escapeHtml(searchField?.alias || "text fields")}" /><datalist id="presentation-search-values">${state.searchField && state.searchField !== "*" ? [...new Set(state.records.map((record) => record.attributes?.[state.searchField]).filter((value) => value != null && value !== "").map(String))].slice(0, 60).map((value) => `<option value="${escapeHtml(value)}"></option>`).join("") : ""}</datalist></label></div>
      <div class="explorer-conditions" data-explorer-conditions></div>
      <label class="scope-toggle"><input type="checkbox" data-mode-extent${state.scope === "extent" ? " checked" : ""}/> Limit to current map extent</label>
      <div class="filter-chips">${state.search ? `<button data-clear-search>${escapeHtml(searchField?.alias || "All text")}: ${escapeHtml(state.search)} ×</button>` : ""}${activeRange ? `<button data-clear-range>${escapeHtml(chartLabel)}: ${state.rangeMin ?? "−∞"}–${state.rangeMax ?? "+∞"} ×</button>` : ""}${state.scope === "extent" ? `<button data-clear-extent>Current extent ×</button>` : ""}${!state.search && !activeRange && state.scope !== "extent" && !this.#briefingConditionFilter() ? "<span>No active filters</span>" : ""}</div><div class="explorer-actions"><button data-mode-zoom>Zoom to results</button><button class="button--quiet" data-mode-clear>Clear all</button></div></section>
      <section class="explorer-distribution"><div class="chart-controls"><label class="field"><span>Chart field</span><select data-chart-field>${this.#fieldOptions(fields.numeric, state.chartField)}</select></label><label class="field"><span>Bins</span><select data-chart-bins>${[8,12,16,24].map((count) => `<option${count === state.binCount ? " selected" : ""}>${count}</option>`).join("")}</select></label></div><strong>${escapeHtml(chartLabel)}</strong><div class="chart-axis"><span>${chart.min == null ? "No numeric values" : this.#formatExplorerNumber(chart.min)}</span><span>${chart.max == null ? "" : this.#formatExplorerNumber(chart.max)}</span></div><div class="explorer-histogram" style="grid-template-columns:repeat(${chart.bins.length || 1},1fr)" aria-label="Histogram of ${escapeHtml(chartLabel)}">${chart.bins.map((bin) => `<button data-range-bin-min="${bin.min}" data-range-bin-max="${bin.max}" title="${this.#formatExplorerNumber(bin.min)}–${this.#formatExplorerNumber(bin.max)}: ${bin.count}"><span style="height:${Math.max(3, bin.count / maxBin * 100)}%"></span></button>`).join("")}</div><p class="chart-caption">${chart.bins.length} bins · ${chart.missing} missing value${chart.missing === 1 ? "" : "s"}. Clicking a bin filters every view. <button type="button" class="link-button" data-style-chart>Style map by this field</button></p></section>
      <section class="explorer-results-table"><header><strong>Results</strong><span>${state.visibleRecords.length.toLocaleString()} local matches</span><label>Sort <select data-sort-field>${this.#fieldOptions(fields.fields, state.sortField)}</select></label><button data-sort-direction aria-label="Reverse sort">${state.sortDirection === "asc" ? "↑" : "↓"}</button></header><div class="results-table" role="table"><div class="results-row results-row--head" role="row"><span>Name</span><span>${escapeHtml(chartLabel)}</span><span>ID</span></div>${pageRecords.map((record) => { const id = featureId(record, idField); return `<button class="results-row${state.selectedIds.has(id) ? " is-selected" : ""}" data-mode-record-id="${escapeHtml(id)}"><span>${escapeHtml(this.#recordLabel(record, fields))}</span><span>${escapeHtml(this.#formatExplorerNumber(record.attributes?.[state.chartField]))}</span><span>${escapeHtml(id || "—")}</span></button>`; }).join("") || "<p class=\"form-note\">No locally available records match.</p>"}</div><footer><button data-page-prev${state.page <= 1 ? " disabled" : ""}>Previous</button><span>Page ${state.page} of ${pageCount}</span><button data-page-next${state.page >= pageCount ? " disabled" : ""}>Next</button></footer></section>
      <aside class="mode-details explorer-details"><span class="eyebrow">Selected record</span>${selected ? `<h3>${escapeHtml(this.#recordLabel(selected, fields))}</h3><div class="detail-actions"><button data-selection-zoom>Zoom</button><button data-filter-selected>Filter to selected</button><button data-selection-clear>Clear</button></div><dl>${Object.entries(selected.attributes || {}).filter(([, value]) => value != null && value !== "").slice(0, 8).map(([key, value]) => `<div><dt>${escapeHtml(fields.fields.find((field) => field.name === key)?.alias || key)}</dt><dd>${escapeHtml(formatAttributeValue(value, fields.fields.find((field) => field.name === key), key))}</dd></div>`).join("")}</dl><details><summary>All attributes</summary><dl>${Object.entries(selected.attributes || {}).map(([key,value]) => `<div><dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}</dl></details>` : "<p>Select a table row or mapped feature. Selection is independent from filtering.</p>"}</aside>
    </section>`;
    this.#addPresentationDockControl(root);
    this.#bindExplorerWorkspace(root, presentation, layer, fields);
  }

  #bindExplorerWorkspace(root, presentation, layer, fields) {
    const state = this.presentationState;
    const refresh = () => this.#filterPresentationRecords();
    root.querySelector("[data-mode-dataset]")?.addEventListener("change", (event) => {
      this.#loadPresentationRecords({ ...presentation, primaryLayerId: event.target.value });
    });
    root.querySelector("[data-search-field]")?.addEventListener("change", (event) => { state.searchField = event.target.value; state.searchOperator = "contains"; state.page = 1; refresh(); });
    // Structured filters use the same builder as Briefing and layer filters; the search box stays a plain search.
    createFilterBuilder({
      host: root.querySelector("[data-explorer-conditions]"),
      fields: fields.fields,
      conditions: state.conditions || [],
      logic: state.conditionLogic,
      addLabel: "Add filter",
      valuesFor: (name) => {
        const counts = new Map();
        state.records.forEach((record) => { const value = record.attributes?.[name]; if (value != null && value !== "") counts.set(String(value), (counts.get(String(value)) || 0) + 1); });
        return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 200).map(([value, count]) => ({ value, count }));
      },
      onChange: ({ conditions, logic }) => { state.conditions = conditions; state.conditionLogic = logic; state.page = 1; refresh(); },
    });
    root.querySelector("[data-mode-search]")?.addEventListener("input", (event) => { state.search = event.target.value; state.page = 1; clearTimeout(this.presentationSearchTimer); this.presentationSearchTimer = setTimeout(refresh, 180); });
    root.querySelector("[data-mode-extent]")?.addEventListener("change", (event) => { state.scope = event.target.checked ? "extent" : "all"; state.page = 1; refresh(); });
    root.querySelector("[data-chart-field]")?.addEventListener("change", (event) => { state.chartField = event.target.value; state.rangeMin = null; state.rangeMax = null; refresh(); });
    root.querySelector("[data-chart-bins]")?.addEventListener("change", (event) => { state.binCount = Number(event.target.value); this.#renderExplorerWorkspace(root, presentation, layer, fields); });
    root.querySelector("[data-sort-field]")?.addEventListener("change", (event) => { state.sortField = event.target.value; state.page = 1; refresh(); });
    root.querySelector("[data-sort-direction]")?.addEventListener("click", () => { state.sortDirection = state.sortDirection === "asc" ? "desc" : "asc"; refresh(); });
    root.querySelectorAll("[data-range-bin-min]").forEach((button) => button.addEventListener("click", () => { state.rangeMin = Number(button.dataset.rangeBinMin); state.rangeMax = Number(button.dataset.rangeBinMax); state.page = 1; refresh(); }));
    root.querySelector("[data-clear-search]")?.addEventListener("click", () => { state.search = ""; refresh(); });
    root.querySelector("[data-clear-range]")?.addEventListener("click", () => { state.rangeMin = null; state.rangeMax = null; refresh(); });
    root.querySelector("[data-clear-extent]")?.addEventListener("click", () => { state.scope = "all"; refresh(); });
    root.querySelector("[data-mode-clear]")?.addEventListener("click", () => { Object.assign(state, { search: "", searchOperator: "contains", scope: "all", rangeMin: null, rangeMax: null, conditions: [], conditionLogic: "and", page: 1 }); refresh(); });
    root.querySelectorAll("[data-mode-zoom]").forEach((button) => button.addEventListener("click", async () => { const features = state.visibleRecords.filter((record) => record.geometry); if (features.length) await this.mapController.goToFeatures(features, { padding: { left: 36, right: 360, bottom: 230 } }); }));
    root.querySelectorAll("[data-selection-zoom]").forEach((button) => button.addEventListener("click", async () => { if (state.selected?.geometry) await this.mapController.setView({ geometry: state.selected.geometry }, { padding: 100 }); }));
    root.querySelector("[data-selection-clear]")?.addEventListener("click", () => { state.selected = null; state.selectedIds.clear(); this.mapController.clearFeatureHighlight(); this.#renderExplorerWorkspace(root, presentation, layer, fields); });
    root.querySelector("[data-filter-selected]")?.addEventListener("click", () => { if (!state.selected) return; state.conditions = [...(state.conditions || []).filter((item) => item.field !== layer.objectIdField), { field: layer.objectIdField, op: "eq", value: String(state.selected.attributes?.[layer.objectIdField] ?? "") }]; state.page = 1; refresh(); });
    root.querySelector("[data-style-chart]")?.addEventListener("click", () => { const roles = { ...state.roles, metric: state.chartField }; const values = state.records.map((record) => Number(record.attributes?.[state.chartField])).filter(Number.isFinite); state.metricMin = values.length ? Math.min(...values) : null; state.metricMax = values.length ? Math.max(...values) : null; this.#applyExplorerMetricRenderer(layer, roles, presentation); this.toast(`Map styled by ${fields.fields.find((field) => field.name === state.chartField)?.alias || state.chartField}.`); });
    root.querySelector("[data-coverage-open]")?.addEventListener("click", () => this.openDialog({ eyebrow: "Dataset coverage", title: layer.title || "Coverage details", content: `<dl class="coverage-details"><div><dt>Service total</dt><dd>${Number.isFinite(state.totalCount) ? state.totalCount.toLocaleString() : "Not reported"}</dd></div><div><dt>Available locally</dt><dd>${state.records.length.toLocaleString()}</dd></div><div><dt>Completeness</dt><dd>${Number.isFinite(state.totalCount) ? `${Math.min(100, state.records.length / state.totalCount * 100).toFixed(1)}%` : "Unknown"}</dd></div><div><dt>Fetched</dt><dd>${escapeHtml(this.#formatExplorerTime(state.fetchedAt))}</dd></div><div><dt>Source</dt><dd>${escapeHtml(layer.url || "Local/project layer")}</dd></div></dl><p class="form-note">Search, charts, statistics, and the results table operate on records available locally. Refresh requests the source again; load-more support depends on the service.</p>`, actions: [{ label: "Close", handler: () => this.dialog.close() }, { label: "Refresh", primary: true, handler: () => { this.mapController.refreshLayer(layer.uid); this.dialog.close(); this.#loadPresentationRecords(presentation); } }] }));
    root.querySelector("[data-page-prev]")?.addEventListener("click", () => { state.page -= 1; this.#renderExplorerWorkspace(root, presentation, layer, fields); });
    root.querySelector("[data-page-next]")?.addEventListener("click", () => { state.page += 1; this.#renderExplorerWorkspace(root, presentation, layer, fields); });
    root.querySelectorAll("[data-mode-record-id]").forEach((button) => button.addEventListener("click", async (event) => { const record = state.visibleRecords.find((item) => featureId(item, layer.objectIdField) === button.dataset.modeRecordId); if (!record) return; const id = featureId(record, layer.objectIdField); if (event.metaKey || event.ctrlKey || event.shiftKey) { state.selectedIds.has(id) ? state.selectedIds.delete(id) : state.selectedIds.add(id); state.selected = record; this.mapController.highlightFeature(record); this.#renderExplorerWorkspace(root, presentation, layer, fields); } else { this.#selectPresentationResult(record); if (record.geometry) await this.mapController.setView({ geometry: record.geometry }, { padding: { left: 36, right: 360, bottom: 140 } }); } }));
  }

  /**
   * Ways to choose features beyond search: limit to the map view, pick on the
   * map, attribute conditions, and grouping by a field (include a whole group).
   */
  #briefingSelectTools(root, presentation, layer, fields) {
    const state = this.presentationState;
    state.conditions ||= [];
    const idField = layer.objectIdField;
    const kindOf = (name) => fieldKind(fields.fields.find((field) => field.name === name));
    const distinct = (name, limit = 40) => {
      const counts = new Map();
      state.records.forEach((record) => { const value = record.attributes?.[name]; if (value != null && value !== "") counts.set(String(value), (counts.get(String(value)) || 0) + 1); });
      return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
    };
    // Group-by suits text fields with a handful of values.
    const groupable = fields.fields.filter((field) => { const values = distinct(field.name, 61).length; return values > 1 && values <= (kindOf(field.name) === "number" ? 12 : 60); });
    if (state.groupField && !groupable.some((field) => field.name === state.groupField)) state.groupField = null;
    // Groups are counted against every other condition, so choosing one group keeps the others in view.
    const others = this.#briefingConditionFilter((item) => item.field === state.groupField && item.op === "eq");
    const inView = state.scope === "extent" ? this.mapController.viewExtentFilter() : null;
    const groupBase = state.groupField ? state.records.filter((record) => (!others || matchesFilter(others, record.attributes || {})) && (!inView || inView(record.geometry))) : [];
    const groups = state.groupField ? (() => {
      const counts = new Map();
      groupBase.forEach((record) => { const value = record.attributes?.[state.groupField]; const key = value == null || value === "" ? "" : String(value); counts.set(key, (counts.get(key) || 0) + 1); });
      return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 24);
    })() : [];
    const activeGroup = state.conditions.find((item) => item.field === state.groupField && item.op === "eq")?.value;
    const tools = document.createElement("section");
    tools.className = "briefing-select";
    // Included features without a slide yet: the same action as on the Slides tab, where it is first needed.
    const pendingSlides = this.briefingSlides?.pendingIncluded().length || 0;
    tools.innerHTML = `<div class="briefing-select__modes">
        <button type="button" data-select-view aria-pressed="${state.scope === "extent"}" title="Only list features in the current map view">◱ In view</button>
        <button type="button" data-select-map aria-pressed="${Boolean(state.mapSelect)}" title="Click features on the map to include or remove them">⊕ Pick on map</button>
        <button type="button" data-cond-add title="Filter by attribute">+ Filter</button>
        <label class="briefing-select__group"><span class="sr-only">Group by</span><select data-select-group aria-label="Group by"><option value="">Group by…</option>${groupable.map((field) => `<option value="${escapeHtml(field.name)}"${field.name === state.groupField ? " selected" : ""}>${escapeHtml(field.alias || field.name)}</option>`).join("")}</select></label>
      </div>
      <div class="briefing-conditions" data-briefing-conditions${state.conditions.length ? "" : " hidden"}></div>
      ${groups.length ? `<div class="briefing-groups">${groups.map(([value, count]) => `<span class="briefing-group${activeGroup != null && String(activeGroup) === value ? " is-active" : ""}"><button type="button" data-group-filter="${escapeHtml(value)}" title="Show only this group">${escapeHtml(value || "No value")} <b>${count}</b></button><button type="button" data-group-include="${escapeHtml(value)}" title="Include all ${count} in the briefing" aria-label="Include all ${escapeHtml(value || "no value")}">+</button></span>`).join("")}</div>` : ""}
      <div class="briefing-select__bulk"><span data-briefing-status>${this.#briefingStatus()}</span><button type="button" data-include-shown${state.visibleRecords.length ? "" : " disabled"}>Include shown</button><button type="button" data-include-clear${state.selectedIds.size ? "" : " disabled"}>Clear</button></div>
      ${pendingSlides ? `<button type="button" class="briefing-select__add-slides" data-include-slides>Add ${pendingSlides.toLocaleString()} included feature${pendingSlides === 1 ? "" : "s"} as slides</button>` : ""}
      <button type="button" class="briefing-select__generate" data-generate-briefing data-mobile-bar data-bar-label="Make briefing" title="Build slides from the map's style, filter and these features">✦ Make a briefing from this view</button>`;
    const refresh = () => { state.page = 1; this.#saveBriefingSelection(); this.#filterPresentationRecords(); };
    const on = (selector, type, handler) => tools.querySelectorAll(selector).forEach((element) => element.addEventListener(type, () => handler(element)));
    on("[data-include-slides]", "click", () => {
      if (!this.briefingSlides.addIncluded()) return;
      // Show the new slides.
      this.briefingTab = "slides";
      this.#renderBriefingWorkspace(root, presentation, layer, fields);
    });
    on("[data-select-view]", "click", async () => {
      state.scope = state.scope === "extent" ? "all" : "extent";
      if (state.scope === "extent") await this.#loadExtentRecords();
      refresh();
    });
    on("[data-select-map]", "click", () => {
      state.mapSelect = !state.mapSelect;
      state.lastPick = "";
      document.body.classList.toggle("briefing-map-select", state.mapSelect);
      this.#renderBriefingWorkspace(root, presentation, layer, fields);
      this.#syncPickBanner();
    });
    // The shared builder edits the conditions; the list refreshes when one is complete or removed.
    const conditionHost = tools.querySelector("[data-briefing-conditions]");
    const builder = createFilterBuilder({
      host: conditionHost,
      fields: fields.fields,
      conditions: state.conditions,
      logic: state.conditionLogic,
      valuesFor: (name) => distinct(name, 200).map(([value, count]) => ({ value, count })),
      onChange: ({ conditions, logic }) => { state.conditions = conditions; state.conditionLogic = logic; refresh(); },
    });
    on("[data-cond-add]", "click", () => {
      conditionHost.hidden = false;
      builder.addCondition(state.groupField || fields.text[0]?.name || fields.fields[0]?.name);
      state.conditions = builder.conditions;
    });
    on("[data-select-group]", "change", (select) => {
      state.conditions = state.conditions.filter((item) => !(item.field === state.groupField && item.op === "eq"));
      state.groupField = select.value || null;
      refresh();
    });
    on("[data-group-filter]", "click", (button) => {
      const value = button.dataset.groupFilter;
      const existing = state.conditions.find((item) => item.field === state.groupField && item.op === "eq");
      if (existing && String(existing.value) === value) state.conditions = state.conditions.filter((item) => item !== existing);
      else if (existing) existing.value = value;
      else state.conditions.push({ field: state.groupField, op: "eq", value });
      refresh();
    });
    on("[data-group-include]", "click", (button) => {
      const value = button.dataset.groupInclude;
      const members = groupBase.filter((record) => String(record.attributes?.[state.groupField] ?? "") === value);
      state.briefingUseAll = false;
      members.forEach((record) => { const id = featureId(record, idField); if (id) state.selectedIds.add(id); });
      this.toast(`Included ${members.length} feature${members.length === 1 ? "" : "s"} where ${fields.fields.find((field) => field.name === state.groupField)?.alias || state.groupField} is ${value || "empty"}.`);
      refresh();
    });
    on("[data-include-shown]", "click", () => {
      state.briefingUseAll = false;
      state.visibleRecords.forEach((record) => { const id = featureId(record, idField); if (id) state.selectedIds.add(id); });
      refresh();
    });
    on("[data-include-clear]", "click", () => { state.selectedIds.clear(); state.briefingUseAll = false; refresh(); });
    on("[data-generate-briefing]", "click", () => this.generateBriefingFromView({ uid: layer.uid }));
    return tools;
  }

  #renderBriefingWorkspace(root, presentation, layer, fields) {
    const state = this.presentationState;
    document.querySelector("#briefing-context-host")?.replaceChildren();
    const selected = state.selected;
    const contextSettings = this.#briefingContextSettings(presentation);
    const contextSources = [layer, ...this.mapController.getLayers().filter((item) => item !== layer)]
      .filter((item) => !contextSettings.sourceIds.length || contextSettings.sourceIds.includes(item.uid));
    const nameField = state.roles?.title || fields.text[0]?.name;
    const idField = layer.objectIdField;
    const overview = selected ? Object.entries(selected.attributes || {}).filter(([key, value]) => value != null && value !== "" && key !== idField).slice(0, 5) : [];
    const useAll = state.briefingUseAll === true;
    const section = (key, title, content) => contextSettings.sections[key] ? `<section><h4>${title}</h4>${content}</section>` : "";
    root.innerHTML = `<section class="mode-dashboard mode-dashboard--briefing presentation-workspace"><header class="presentation-compact-header"><span class="eyebrow">Context briefing</span><h2>${escapeHtml(presentation.title || layer.title || "Feature briefing")}</h2><div class="briefing-header-actions"><button type="button" data-briefing-close title="Leave Briefing mode; the briefing stays with this project">Close</button><button type="button" data-briefing-discard title="Delete this briefing and its slides">Discard briefing…</button></div><label class="compact-dataset"><span>Dataset</span><select data-mode-dataset>${this.mapController.getLayers().filter((item) => item.queryable).map((item) => `<option value="${escapeHtml(item.uid)}"${item.uid === layer.uid ? " selected" : ""}>${escapeHtml(item.title || "Untitled layer")}</option>`).join("")}</select></label></header><div class="briefing-search"><label class="field"><span>Search field</span><select data-search-field>${this.#fieldOptions(fields.fields, state.searchField)}</select></label><label class="field"><span>Find a feature</span><input data-mode-search value="${escapeHtml(state.search)}" placeholder="Search ${escapeHtml(fields.fields.find((field) => field.name === state.searchField)?.alias || nameField || "features")}"/></label><button data-mode-clear aria-label="Clear the search" title="Clear the search">×</button></div><div class="mode-records briefing-records">${state.visibleRecords.slice(0, 400).map((record) => `<button class="mode-record${record === selected ? " is-selected" : ""}" data-mode-record-id="${escapeHtml(featureId(record, idField))}"><strong>${escapeHtml(this.#recordLabel(record, fields))}</strong><small>${escapeHtml(featureId(record, idField) || "")}</small></button>`).join("") || "<p class=\"form-note\">No locally available features match.</p>"}</div><aside class="mode-details briefing-context"><button class="context-settings-button" data-briefing-settings aria-label="Context settings" title="Context settings">⚙</button><span class="eyebrow">${selected ? "Feature context" : "Select a feature"}</span>${selected ? `<h3>${escapeHtml(this.#recordLabel(selected, fields))}</h3><div class="detail-actions"><button data-selection-zoom aria-label="Zoom to feature" title="Zoom to feature">⌕</button><button data-selection-clear aria-label="Clear selected feature" title="Clear selected feature">×</button><button type="button" class="detail-actions__slide" data-briefing-add-slide title="Add this feature to the briefing's slides">+ Slide</button><button type="button" class="detail-actions__slide" data-briefing-add-tour title="Add this feature to the guided tour">+ Tour</button><button type="button" class="detail-actions__slide" data-briefing-add-task title="Make a field task at this feature">Task</button></div>${section("overview", "Overview", `<dl>${overview.map(([key,value]) => `<div><dt>${escapeHtml(fields.fields.find((field) => field.name === key)?.alias || key)}</dt><dd>${escapeHtml(formatAttributeValue(value, fields.fields.find((field) => field.name === key), key))}</dd></div>`).join("")}</dl>`)}${section("surroundings", "Surroundings", `<p data-briefing-surroundings>Checking visible contextual datasets…</p>`)}${section("ai", "AI context", `<p data-briefing-ai>${this.aiController.isConfigured() ? "Deterministic context appears first. Generate a concise explanation after reviewing it." : "AI is not configured. Spatial context and source details remain available."}</p>${this.aiController.isConfigured() ? "<button data-briefing-ai-run>Generate sourced context</button>" : ""}`)}${section("sources", "Sources", contextSources.map((source) => `<p>${escapeHtml(source.title || "Dataset")} ${source === layer ? `· retrieved ${escapeHtml(this.#formatExplorerTime(state.fetchedAt))}` : ""}</p>${source.url ? `<a href="${escapeHtml(source.url)}" target="_blank" rel="noopener">Open dataset source ↗</a>` : ""}`).join("") || "<p>No sources selected.</p>")}<details><summary>All attributes</summary><dl>${Object.entries(selected.attributes || {}).map(([key,value]) => `<div><dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}</dl></details>` : "<p>Choose a named feature or click it on the map. The right context panel keeps selection, map highlight, and details synchronized.</p>"}</aside></section>`;
    const records = root.querySelector(".briefing-records");
    if (records) {
      const scope = document.createElement("div");
      scope.className = "briefing-scope";
      scope.innerHTML = `<label><input type="checkbox" data-briefing-use-all${useAll ? " checked" : ""}> Use all matching features</label>`;
      records.before(scope);
      records.querySelectorAll("[data-mode-record-id]").forEach((button) => {
        const id = button.dataset.modeRecordId;
        const row = document.createElement("article");
        row.className = `briefing-record${state.selectedIds.has(id) ? " is-included" : ""}`;
        row.innerHTML = `<label class="briefing-record__include" title="Include in briefing"><input type="checkbox" data-briefing-include="${escapeHtml(id)}"${useAll || state.selectedIds.has(id) ? " checked" : ""}${useAll ? " disabled" : ""}><span class="sr-only">Include feature in briefing</span></label>`;
        button.before(row);
        row.append(button);
      });
    }
    // Set first: the selection tools count the slides each included feature already has.
    this.briefingWorkspace = { root, presentation, layer, fields };
    root.querySelector(".briefing-search")?.after(this.#briefingSelectTools(root, presentation, layer, fields));
    if (selected) {
      const location = document.createElement("section");
      location.className = "briefing-location-details";
      location.innerHTML = `<span class="eyebrow">Location details</span><p data-briefing-address>Finding nearest address…</p><div class="briefing-coordinates"><code data-briefing-coordinates>Finding coordinates…</code><button type="button" data-copy-briefing-coordinates>Copy X/Y</button></div>`;
      root.querySelector(".briefing-records")?.after(location);
      document.body.dataset.briefingContextDock = contextSettings.dock;
    }
    const workspace = root.querySelector(".mode-dashboard--briefing");
    root.querySelector("[data-briefing-close]")?.addEventListener("click", () => this.#closeBriefing());
    root.querySelector("[data-briefing-discard]")?.addEventListener("click", () => this.#discardBriefing());
    const tabs = document.createElement("div");
    tabs.className = "briefing-tabs";
    tabs.setAttribute("role", "tablist");
    tabs.innerHTML = `<button type="button" role="tab" data-briefing-tab="features">Features</button><button type="button" role="tab" data-briefing-tab="slides">Slides</button>`;
    root.querySelector(".presentation-compact-header")?.after(tabs);
    const slidesHost = document.createElement("div");
    slidesHost.className = "briefing-slides-host";
    workspace?.append(slidesHost);
    tabs.querySelectorAll("[data-briefing-tab]").forEach((button) => button.addEventListener("click", () => {
      this.briefingTab = button.dataset.briefingTab;
      this.#renderBriefingWorkspace(root, presentation, layer, fields);
    }));
    const v2 = this.#briefingV2Active();
    if (v2) this.briefingTab = "slides";
    this.#syncBriefingTabs();
    if (v2) {
      const pane = document.querySelector("#utility-briefing-content");
      pane.innerHTML = `<section class="briefing-inspector__feature" data-inspector-feature hidden></section><section class="briefing-inspector__slide" data-inspector-slide></section>`;
      this.briefingSlides.render(slidesHost, { inspector: pane.querySelector("[data-inspector-slide]") });
    } else if (this.briefingTab === "slides") this.briefingSlides.render(slidesHost);
    this.#addPresentationDockControl(root);
    this.#bindBriefingWorkspace(root, presentation, layer, fields);
    const search = root.querySelector(".briefing-search [data-mode-search]");
    if (search && state.searchField) {
      const values = [...new Set(state.records.map((record) => record.attributes?.[state.searchField]).filter((value) => value != null && value !== "").map(String))].slice(0, 100);
      const suggestions = document.createElement("datalist");
      suggestions.id = "briefing-search-suggestions";
      for (const value of values) { const option = document.createElement("option"); option.value = value; suggestions.append(option); }
      search.setAttribute("list", suggestions.id);
      search.after(suggestions);
    }
    if (!this.mobileMedia.matches) this.#foldBriefingRecords(root);
    const context = root.querySelector(".briefing-context");
    if (context && this.mobileMedia.matches) this.#foldBriefingSheet(root, context, selected);
    else if (context) document.querySelector("#briefing-context-host")?.replaceChildren(context);
    if (selected) void this.#loadBriefingContext(root, context, selected, layer);
    if (v2) this.#layoutBriefingV2(root, selected, layer, presentation, fields);
  }

  #briefingV2Active() {
    return this.briefingV2 && !this.mobileMedia.matches;
  }

  /** Data pieces move to the bottom dock and the feature context to the inspector; their bindings come with them. */
  #layoutBriefingV2(root, selected, layer, presentation, fields) {
    const dock = document.querySelector("#briefing-data-dock");
    const body = dock?.querySelector(".briefing-data-dock__body");
    if (!dock || !body) return;
    const scope = root.querySelector(".briefing-scope");
    const records = this.#briefingDataTable(root, presentation, layer, fields);
    const filters = document.createElement("div");
    filters.className = "briefing-data-dock__filters";
    filters.append(...[root.querySelector(".briefing-search"), root.querySelector(".briefing-select")].filter(Boolean));
    const addIncluded = document.createElement("button");
    addIncluded.type = "button";
    addIncluded.className = "briefing-data-dock__add-slides";
    addIncluded.textContent = "Add included features as slides";
    addIncluded.addEventListener("click", () => { this.briefingSlides.addIncluded(); this.#openBriefingInspector(); });
    filters.append(addIncluded);
    const list = document.createElement("div");
    list.className = "briefing-data-dock__records";
    let actions = dock.querySelector(".briefing-data-dock__actions");
    if (!actions) {
      actions = document.createElement("div");
      actions.className = "briefing-data-dock__actions";
      actions.setAttribute("role", "group");
      actions.setAttribute("aria-label", "Briefing presentation actions");
      actions.innerHTML = '<button type="button" class="briefing-slides__present" data-dock-preview>Preview slides</button><button type="button" data-dock-save>Save</button><button type="button" data-dock-share title="Share a link, QR code or PDF">Share</button>';
      // Before the first save, slides live only in this tab; afterwards every edit is kept in this browser.
      actions.querySelector("[data-dock-save]").addEventListener("click", () => {
        if (!this.projectManager.isSaved()) { this.#saveProjectDialog(); return; }
        this.projectManager.save();
        this.toast("Saved in this browser. Slides save automatically as you edit.");
      });
      actions.querySelector("[data-dock-preview]").addEventListener("click", () => this.briefingSlides.openPlayer());
      actions.querySelector("[data-dock-share]").addEventListener("click", () => this.shareBriefing());
      dock.prepend(actions);
    }
    let camera = dock.querySelector(".briefing-data-dock__camera");
    if (!camera) {
      camera = document.createElement("div");
      camera.className = "briefing-data-dock__camera";
      camera.setAttribute("role", "group");
      camera.setAttribute("aria-label", "Slide map view: adjust the camera, then save it to the selected slide");
      // A slim camera toolbar beside the map, like the map controls: adjust, then save the angle.
      const icon = (path) => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${path}</svg>`;
      const tool = (nav, label, path) => `<button type="button" data-slide-nav="${nav}" aria-label="${label}" title="${label}">${icon(path)}</button>`;
      camera.innerHTML = [
        tool("tilt-up", "Tilt up", '<path d="M5 19h14l-3-6H8z"/><path d="M12 10V3m-3 3 3-3 3 3"/>'),
        tool("tilt-down", "Tilt down", '<path d="M4 19h16"/><path d="M12 3v10m-3-3 3 3 3-3"/>'),
        tool("rotate-left", "Rotate left", '<path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.6"/><path d="M4 4v4.6h4.6"/>'),
        tool("rotate-right", "Rotate right", '<path d="M20 12a8 8 0 1 1-2.4-5.7L20 8.6"/><path d="M20 4v4.6h-4.6"/>'),
        tool("in", "Zoom in", '<path d="M12 5v14M5 12h14"/>'),
        tool("out", "Zoom out", '<path d="M5 12h14"/>'),
        '<span class="briefing-data-dock__camera-divider" aria-hidden="true"></span>',
        `<button type="button" class="briefing-data-dock__camera-save" data-map-slide-save aria-label="Save this view to the selected slide" title="Save this view to the selected slide">${icon('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.2"/>')}</button>`,
        `<button type="button" data-map-slide-show aria-label="Show the slide's saved view" title="Show the slide's saved view">${icon('<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>')}</button>`,
      ].join("");
      camera.querySelectorAll("[data-slide-nav]").forEach((button) => button.addEventListener("click", () => this.mapController.navigate(button.dataset.slideNav).catch((error) => this.error(error.message))));
      // Save and show act on the selected slide directly, whether or not the Slide workspace is open.
      const save = camera.querySelector("[data-map-slide-save]");
      save.addEventListener("click", () => {
        if (!this.briefingSlides.saveCameraToSelected()) return;
        save.classList.add("is-saved");
        clearTimeout(save.savedTimer);
        save.savedTimer = setTimeout(() => save.classList.remove("is-saved"), 1600);
      });
      camera.querySelector("[data-map-slide-show]").addEventListener("click", () => this.briefingSlides.showSelectedMap());
      dock.prepend(camera);
    }
    actions.hidden = !this.projectManager.current.presentation?.briefing?.slides?.length;
    camera.hidden = actions.hidden;
    list.append(...[scope, records].filter(Boolean));
    body.replaceChildren(filters, list);
    dock.querySelector("[data-briefing-dock-status]").textContent = this.#briefingStatus();
    if (dock.hidden) {
      dock.hidden = false;
      this.#bindBriefingDock(dock);
    }
    this.#applyBriefingDockPadding();
    // The selected feature's context (moved to the map overlay host above) belongs in the inspector.
    const featureHost = document.querySelector("#utility-briefing-content [data-inspector-feature]");
    const context = document.querySelector("#briefing-context-host .briefing-context") || root.querySelector(".briefing-context");
    const location = root.querySelector(".briefing-location-details");
    if (featureHost && selected && context) {
      featureHost.replaceChildren(context, ...(location ? [location] : []));
      featureHost.hidden = false;
      // Open the inspector once per newly selected feature, not on every refresh.
      const id = featureId(selected, layer.objectIdField);
      if (id !== this.briefingInspectorFeature) { this.briefingInspectorFeature = id; this.#openBriefingInspector(); }
    } else {
      this.#clearBriefingFeatureContext();
    }
  }

  /** Forgets the selected feature's context in the Slide workspace (no selection, layer removed, briefing closed). */
  #clearBriefingFeatureContext() {
    this.briefingInspectorFeature = null;
    document.querySelector("#briefing-context-host")?.replaceChildren();
    const featureHost = document.querySelector("#utility-briefing-content [data-inspector-feature]");
    if (featureHost) { featureHost.replaceChildren(); featureHost.hidden = true; }
  }

  /** The Data dock's feature table: columns, sorting, inclusion, and group rows that make slides. */
  #briefingDataTable(root, presentation, layer, fields) {
    const state = this.presentationState;
    const idField = layer.objectIdField;
    const labelField = state.roles?.title || fields.text[0]?.name;
    const kind = (field) => fieldKind(field);
    // A few informative columns: numbers and dates first, never IDs or geometry measures.
    const columns = fields.fields.filter((field) => field.name !== labelField && field.name !== state.groupField && !isRoutineField(field, { idField }))
      .sort((a, b) => (["number", "date"].includes(kind(b)) ? 1 : 0) - (["number", "date"].includes(kind(a)) ? 1 : 0)).slice(0, 3);
    const limit = 50;
    const pages = Math.max(1, Math.ceil(state.visibleRecords.length / limit));
    state.briefingDataPage = Math.min(Math.max(0, state.briefingDataPage || 0), pages - 1);
    const rows = state.visibleRecords.slice(state.briefingDataPage * limit, (state.briefingDataPage + 1) * limit);
    const useAll = state.briefingUseAll === true;
    const cell = (record, field) => escapeHtml(formatAttributeValue(record.attributes?.[field.name], field, field.name));
    const sortMark = (name) => (state.sortField === name ? (state.sortDirection === "desc" ? " ↓" : " ↑") : "");
    const rowHtml = (record) => {
      const id = featureId(record, idField);
      const included = useAll || state.selectedIds.has(id);
      return `<tr data-dt-row="${escapeHtml(id)}"${record === state.selected ? ' class="is-selected" aria-selected="true"' : ""}><td><input type="checkbox" data-dt-include="${escapeHtml(id)}" aria-label="Include ${escapeHtml(this.#recordLabel(record, fields))}"${included ? " checked" : ""}${useAll ? " disabled" : ""}></td><th scope="row">${escapeHtml(this.#recordLabel(record, fields))}</th>${columns.map((field) => `<td>${cell(record, field)}</td>`).join("")}<td><button type="button" data-dt-slide="${escapeHtml(id)}" title="Add a slide for this feature">+ Slide</button></td></tr>`;
    };
    let body;
    if (state.groupField) {
      const groupLabel = fields.fields.find((field) => field.name === state.groupField)?.alias || state.groupField;
      const groups = new Map();
      // Counts and group actions cover every match; only the first rows are drawn.
      const listed = new Set(rows);
      state.visibleRecords.forEach((record) => { const value = record.attributes?.[state.groupField]; const key = value == null || value === "" ? "" : String(value); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(record); });
      state.collapsedGroups ||= new Set();
      body = [...groups.entries()].sort((a, b) => b[1].length - a[1].length).map(([value, members]) => {
        const collapsed = state.collapsedGroups.has(value);
        return `<tbody data-dt-group="${escapeHtml(value)}"><tr class="briefing-data-table__group"><td colspan="${columns.length + 2}"><button type="button" class="briefing-data-table__toggle" data-dt-group-toggle="${escapeHtml(value)}" aria-expanded="${!collapsed}">${collapsed ? "▸" : "▾"} ${escapeHtml(groupLabel)}: <strong>${escapeHtml(value || "No value")}</strong> <small>${members.length.toLocaleString()}</small></button></td><td><button type="button" data-dt-group-include="${escapeHtml(value)}" title="Include all ${members.length} in the briefing">Include all</button> <button type="button" data-dt-group-slide="${escapeHtml(value)}" title="One map slide showing only this group">+ Slide</button></td></tr>${collapsed ? "" : members.filter((record) => listed.has(record)).map(rowHtml).join("")}</tbody>`;
      }).join("");
    } else body = `<tbody>${rows.map(rowHtml).join("")}</tbody>`;
    const wrap = document.createElement("div");
    wrap.className = "briefing-data-table";
    const groupCount = state.groupField ? new Set(state.visibleRecords.map((record) => String(record.attributes?.[state.groupField] ?? ""))).size : 0;
    wrap.innerHTML = `${state.groupField ? `<div class="briefing-data-table__toolbar"><span>${groupCount.toLocaleString()} groups</span><button type="button" data-dt-series title="One filtered map slide per value, from the matching features">One slide per group</button></div>` : ""}
      <table><thead><tr><th scope="col"><span class="sr-only">Include</span></th><th scope="col"><button type="button" data-dt-sort="${escapeHtml(labelField || "")}">${escapeHtml(fields.fields.find((field) => field.name === labelField)?.alias || "Feature")}${sortMark(labelField)}</button></th>${columns.map((field) => `<th scope="col"><button type="button" data-dt-sort="${escapeHtml(field.name)}">${escapeHtml(field.alias || field.name)}${sortMark(field.name)}</button></th>`).join("")}<th scope="col"><span class="sr-only">Actions</span></th></tr></thead>${body}</table>
      ${state.visibleRecords.length > limit ? `<div class="briefing-data-table__pagination"><button type="button" data-dt-page="-1"${state.briefingDataPage === 0 ? " disabled" : ""}>Previous</button><span>Page ${state.briefingDataPage + 1} of ${pages} · ${state.visibleRecords.length.toLocaleString()} matches</span><button type="button" data-dt-page="1"${state.briefingDataPage >= pages - 1 ? " disabled" : ""}>Next</button></div><p class="form-note">Filters and group actions use all matching loaded features.</p>` : ""}${state.visibleRecords.length ? "" : '<p class="form-note">No loaded features match.</p>'}`;
    const rerender = () => this.#renderBriefingWorkspace(root, presentation, layer, fields);
    const recordFor = (id) => state.visibleRecords.find((record) => featureId(record, idField) === id);
    const groupMembers = (value) => state.visibleRecords.filter((record) => String(record.attributes?.[state.groupField] ?? "") === value);
    wrap.addEventListener("change", (event) => {
      const input = event.target.closest("[data-dt-include]");
      if (!input) return;
      input.checked ? state.selectedIds.add(input.dataset.dtInclude) : state.selectedIds.delete(input.dataset.dtInclude);
      this.#saveBriefingSelection();
      rerender();
    });
    wrap.addEventListener("click", async (event) => {
      const target = event.target;
      const page = target.closest("[data-dt-page]");
      if (page) { state.briefingDataPage += Number(page.dataset.dtPage); rerender(); return; }
      const sort = target.closest("[data-dt-sort]");
      if (sort) {
        const name = sort.dataset.dtSort;
        state.sortDirection = state.sortField === name && state.sortDirection === "asc" ? "desc" : "asc";
        state.sortField = name;
        this.#filterPresentationRecords();
        return;
      }
      const toggle = target.closest("[data-dt-group-toggle]");
      if (toggle) { const value = toggle.dataset.dtGroupToggle; state.collapsedGroups.has(value) ? state.collapsedGroups.delete(value) : state.collapsedGroups.add(value); rerender(); return; }
      const include = target.closest("[data-dt-group-include]");
      if (include) {
        const members = groupMembers(include.dataset.dtGroupInclude);
        state.briefingUseAll = false;
        members.forEach((record) => { const id = featureId(record, idField); if (id) state.selectedIds.add(id); });
        this.#saveBriefingSelection();
        this.toast(`Included ${members.length} feature${members.length === 1 ? "" : "s"}.`);
        rerender();
        return;
      }
      const makeSlides = (records, done) => {
        try { done(this.briefingSlides.addFilterSeries(state.groupField, records)); this.#openBriefingInspector(); } catch (error) { this.error(error.message); }
      };
      const groupSlide = target.closest("[data-dt-group-slide]");
      if (groupSlide) { makeSlides(groupMembers(groupSlide.dataset.dtGroupSlide), () => this.toast("Added a slide for this group.")); return; }
      if (target.closest("[data-dt-series]")) { makeSlides(state.visibleRecords, (count) => this.toast(`Added ${count} slides, one per value.`)); return; }
      const slide = target.closest("[data-dt-slide]");
      if (slide) { const record = recordFor(slide.dataset.dtSlide); if (record) { this.briefingSlides.addFeatureSlide(record); this.#openBriefingInspector(); } return; }
      if (target.closest("input, button")) return;
      const row = target.closest("[data-dt-row]");
      const record = row && recordFor(row.dataset.dtRow);
      if (!record) return;
      this.#selectPresentationResult(record);
      if (record.geometry) await this.mapController.setView({ geometry: record.geometry, zoom: this.mapController.getViewState().zoom }, { animate: false });
    });
    return wrap;
  }

  #openBriefingInspector() {
    if (!this.#briefingV2Active()) return;
    this.briefingInspectorOpen = true;
    this.#syncUtilityPanel("briefing");
  }

  #bindBriefingDock(dock) {
    if (dock.dataset.bound) return;
    dock.dataset.bound = "true";
    const toggle = dock.querySelector("[data-briefing-dock-toggle]");
    toggle.addEventListener("click", () => {
      const collapsed = dock.classList.toggle("is-collapsed");
      toggle.setAttribute("aria-expanded", String(!collapsed));
      toggle.setAttribute("aria-label", collapsed ? "Expand the data panel" : "Collapse the data panel");
      toggle.textContent = collapsed ? "⌃" : "⌄";
      this.#applyBriefingDockPadding();
    });
    const handle = dock.querySelector("[data-briefing-dock-resize]");
    const setHeight = (pixels) => {
      const workspace = dock.parentElement.getBoundingClientRect().height;
      const height = Math.round(Math.min(workspace * 0.8, Math.max(140, pixels)));
      document.body.style.setProperty("--briefing-dock-height", `${height}px`);
      this.#applyBriefingDockPadding();
    };
    handle.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      const bottom = dock.parentElement.getBoundingClientRect().bottom;
      const move = (moveEvent) => setHeight(bottom - moveEvent.clientY);
      const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    });
    handle.addEventListener("keydown", (event) => {
      if (!["ArrowUp", "ArrowDown"].includes(event.key)) return;
      event.preventDefault();
      setHeight(dock.getBoundingClientRect().height + (event.key === "ArrowUp" ? 40 : -40));
    });
  }

  /** The map keeps its full height; padding keeps framed features clear of the dock. */
  #applyBriefingDockPadding() {
    const dock = document.querySelector("#briefing-data-dock");
    const padding = this.mapController.getViewPadding?.() || {};
    const bottom = dock && !dock.hidden ? Math.round(dock.getBoundingClientRect().height) : 0;
    if ((padding.bottom || 0) !== bottom) this.mapController.setViewPadding?.({ ...padding, bottom });
  }

  #teardownBriefingV2() {
    const dock = document.querySelector("#briefing-data-dock");
    if (dock && !dock.hidden) {
      dock.hidden = true;
      dock.querySelector(".briefing-data-dock__body")?.replaceChildren();
      this.#applyBriefingDockPadding();
    }
    document.body.classList.remove("briefing-v2");
    this.#clearBriefingFeatureContext();
    document.querySelector("#utility-briefing-content")?.replaceChildren();
    if (this.briefingInspectorOpen) { this.briefingInspectorOpen = false; this.#syncUtilityPanel(); }
  }

  /** Leaves Briefing mode; the briefing stays with the project. */
  #closeBriefing() {
    const route = document.querySelector('.desktop-workflows-menu [data-mobile-workflow="map"]');
    if (route && !this.mobileMedia.matches) route.click(); else this.openMobileWorkflow("map");
  }

  /** Deletes the project's briefing after confirmation, then returns to the map. */
  #discardBriefing() {
    const slides = this.projectManager.current.presentation?.briefing?.slides?.length || 0;
    if (!globalThis.confirm(slides ? `Discard this briefing and its ${slides} slide${slides === 1 ? "" : "s"}? This cannot be undone.` : "Discard this briefing?")) return;
    this.briefingSlides.selectedSlideId = null;
    this.projectManager.patchPresentation({ briefing: null });
    this.#closeBriefing();
    this.#teardownBriefingV2();
    this.toast("Briefing discarded.");
  }

  /** What the Slides tab needs from the loaded briefing data. */
  #briefingSlideData() {
    const state = this.presentationState;
    const { presentation = {}, layer = null, fields = null } = this.briefingWorkspace || {};
    return {
      layer,
      fields,
      records: state.records || [],
      total: state.totalCount,
      selectedIds: state.selectedIds || new Set(),
      useAll: state.briefingUseAll === true,
      visibleRecords: state.visibleRecords || [],
      selected: state.selected,
      title: this.projectManager.current.presentation?.modeTitles?.briefing || presentation.title || layer?.title || "Briefing",
      label: (record) => (fields ? this.#recordLabel(record, fields) : String(record?.attributes?.[layer?.objectIdField] ?? "Feature")),
    };
  }

  /** The dock's Save button says whether the briefing is kept in this browser yet. */
  #syncBriefingSave() {
    const button = document.querySelector(".briefing-data-dock__actions [data-dock-save]");
    if (!button) return;
    const saved = this.projectManager.isSaved();
    button.textContent = saved ? "Saved ✓" : "Save";
    button.classList.toggle("is-saved", saved);
    button.title = saved ? "Saved in this browser; slides save automatically as you edit" : "Save this project and its slides in this browser";
  }

  #syncBriefingTabs() {
    this.#syncBriefingSave();
    const slides = this.projectManager.current.presentation?.briefing?.slides?.length || 0;
    const dockActions = document.querySelector(".briefing-data-dock__actions");
    if (dockActions) dockActions.hidden = !slides;
    const dockCamera = document.querySelector(".briefing-data-dock__camera");
    if (dockCamera) dockCamera.hidden = !slides;
    const slidesTab = this.briefingTab === "slides";
    document.querySelectorAll("[data-briefing-tab]").forEach((button) => {
      const selected = button.dataset.briefingTab === this.briefingTab;
      button.setAttribute("aria-selected", String(selected));
      if (button.dataset.briefingTab === "slides") button.textContent = slides ? `Slides · ${slides}` : "Slides";
    });
    document.querySelector(".mode-dashboard--briefing")?.classList.toggle("is-slides", slidesTab);
    const v2 = this.#briefingV2Active() && this.presentationState?.template === "briefing";
    document.body.classList.toggle("briefing-v2", v2);
    document.body.classList.toggle("briefing-slides-tab", !v2 && slidesTab && this.presentationState?.template === "briefing");
    // Both tabs are the same double-wide workspace on desktop, so switching keeps its size.
    document.body.classList.toggle("briefing-features-tab", !v2 && !slidesTab && this.presentationState?.template === "briefing");
    document.body.classList.toggle("briefing-map-select", (Boolean(this.presentationState?.mapSelect) && this.presentationState?.template === "briefing") || Boolean(this.briefingFocusPick));
    this.#syncPickBanner();
  }

  #bindBriefingWorkspace(root, presentation, layer, fields) {
    const state = this.presentationState;
    const refresh = () => this.#filterPresentationRecords();
    root.querySelector("[data-mode-dataset]")?.addEventListener("change", (event) => this.#loadPresentationRecords({ ...presentation, primaryLayerId: event.target.value }));
    root.querySelector("[data-search-field]")?.addEventListener("change", (event) => { state.searchField = event.target.value; state.searchOperator = "contains"; refresh(); });
    root.querySelector("[data-mode-search]")?.addEventListener("input", (event) => { state.search = event.target.value; clearTimeout(this.presentationSearchTimer); this.presentationSearchTimer = setTimeout(refresh, 180); });
    root.querySelector("[data-mode-clear]")?.addEventListener("click", () => { state.search = ""; refresh(); });
    root.querySelector("[data-briefing-use-all]")?.addEventListener("change", (event) => { state.briefingUseAll = event.target.checked; this.#saveBriefingSelection(); this.#renderBriefingWorkspace(root, presentation, layer, fields); });
    root.querySelectorAll("[data-briefing-include]").forEach((input) => input.addEventListener("change", () => { input.checked ? state.selectedIds.add(input.dataset.briefingInclude) : state.selectedIds.delete(input.dataset.briefingInclude); this.#saveBriefingSelection(); this.#renderBriefingWorkspace(root, presentation, layer, fields); }));
    root.querySelectorAll("[data-mode-record-id]").forEach((button) => button.addEventListener("click", () => { const record = state.visibleRecords.find((item) => featureId(item, layer.objectIdField) === button.dataset.modeRecordId); this.#selectPresentationResult(record); }));
    root.querySelector("[data-selection-clear]")?.addEventListener("click", () => { this.briefingRequest.cancel(); state.selected = null; this.mapController.clearFeatureHighlight(); this.#renderBriefingWorkspace(root, presentation, layer, fields); });
    root.querySelectorAll("[data-mode-record-id]").forEach((button) => button.addEventListener("click", async () => { const record = state.visibleRecords.find((item) => featureId(item, layer.objectIdField) === button.dataset.modeRecordId); if (record?.geometry) await this.mapController.setView({ geometry: record.geometry, zoom: this.mapController.getViewState().zoom }, { animate: false }); }));
    root.querySelector("[data-selection-zoom]")?.addEventListener("click", async () => { if (state.selected?.geometry) await this.mapController.setView({ geometry: state.selected.geometry, zoom: Math.min(18, (this.mapController.getViewState().zoom || 10) + 2) }, { padding: { left: 80, right: 420 } }); });
    root.querySelector("[data-briefing-settings]")?.addEventListener("click", () => this.#briefingSettingsDialog(presentation, layer));
    root.querySelector("[data-briefing-add-slide]")?.addEventListener("click", () => {
      if (!state.selected) return;
      this.briefingSlides.addFeatureSlide(state.selected);
    });
    // The same feature can join the tour or become a field task, without leaving the briefing.
    const selectedPlace = () => {
      const point = state.selected?.geometry ? this.mapController.geographicCoordinates(state.selected.geometry) : null;
      return point ? { ...point, label: this.#recordLabel(state.selected, fields) } : null;
    };
    root.querySelector("[data-briefing-add-tour]")?.addEventListener("click", () => {
      const place = selectedPlace();
      if (!place) return this.error("This feature has no location to tour.");
      this.createTourFromPlaces([{ title: place.label, latitude: place.latitude, longitude: place.longitude }], { open: false });
    });
    root.querySelector("[data-briefing-add-task]")?.addEventListener("click", () => {
      const place = selectedPlace();
      if (!place) return this.error("This feature has no location for a task.");
      const objectId = state.selected.attributes?.[layer.objectIdField];
      this.fieldTasks?.newTaskFrom({
        title: `Visit ${place.label}`,
        location: place.label,
        latitude: place.latitude,
        longitude: place.longitude,
        features: [{ layerUrl: featureLayerUrl(layer), objectId: objectId ?? null, latitude: place.latitude, longitude: place.longitude, label: place.label.slice(0, 80), done: false }],
      });
    });
    root.querySelector("[data-briefing-ai-run]")?.addEventListener("click", () => {
      if (!state.selected || !this.aiController.isConfigured()) return;
      const context = root.querySelector("[data-briefing-surroundings]")?.textContent || "No surrounding results available.";
      this.#openIntelligenceUtility();
      this.#askAI(`Explain this selected feature concisely using only its supplied attributes and the deterministic spatial context. Distinguish nearby or intersecting features from verified impacts. Cite dataset names in the response. Spatial context: ${context}`, { selectedResults: [state.selected] }, "Briefing context");
    });
  }

  #briefingContextSettings(presentation = {}) {
    const stored = presentation.contextSettings || {};
    return {
      dock: ["floating", "left", "right", "top", "bottom"].includes(stored.dock) ? stored.dock : "floating",
      perimeter: Math.max(0, Number(stored.perimeter) || 10),
      units: stored.units === "miles" ? "miles" : "kilometers",
      sections: { overview: true, surroundings: true, ai: true, sources: true, ...(stored.sections || {}) },
      layerIds: Array.isArray(stored.layerIds) ? stored.layerIds : [],
      sourceIds: Array.isArray(stored.sourceIds) ? stored.sourceIds : [],
    };
  }

  #briefingSettingsDialog(presentation, primaryLayer) {
    const settings = this.#briefingContextSettings(presentation);
    const layers = this.mapController.getLayers().filter((layer) => layer !== primaryLayer);
    const check = (value) => value ? " checked" : "";
    this.openDialog({
      eyebrow: "Context briefing",
      title: "Context settings",
      content: `<div class="briefing-settings"><fieldset><legend>Visible sections</legend>${[["overview", "Overview"], ["surroundings", "Surroundings"], ["ai", "AI context"], ["sources", "Sources"]].map(([key, label]) => `<label><input type="checkbox" data-context-section="${key}"${check(settings.sections[key])}/> ${label}</label>`).join("")}</fieldset><label class="field"><span>Presentation</span><select data-context-dock><option value="floating"${settings.dock === "floating" ? " selected" : ""}>Floating over map</option><option value="left"${settings.dock === "left" ? " selected" : ""}>Dock left</option><option value="right"${settings.dock === "right" ? " selected" : ""}>Dock right</option><option value="top"${settings.dock === "top" ? " selected" : ""}>Dock top</option><option value="bottom"${settings.dock === "bottom" ? " selected" : ""}>Dock bottom</option></select></label><fieldset><legend>Surroundings</legend><label class="field"><span>Search perimeter</span><input data-context-perimeter type="number" min="0" value="${settings.perimeter}" /></label><label class="field"><span>Units</span><select data-context-units><option${settings.units === "kilometers" ? " selected" : ""}>kilometers</option><option${settings.units === "miles" ? " selected" : ""}>miles</option></select></label><p class="form-note">Choose the visible layers checked for contextual intersections.</p>${layers.map((layer) => `<label><input type="checkbox" data-context-layer="${escapeHtml(layer.uid)}"${check(!settings.layerIds.length || settings.layerIds.includes(layer.uid))}/> ${escapeHtml(layer.title || "Untitled layer")}</label>`).join("") || "<p class=\"form-note\">No additional map layers are available.</p>"}</fieldset><fieldset><legend>Sources</legend><p class="form-note">Select sources that may be presented alongside the primary dataset or supplied to AI context.</p>${[primaryLayer, ...layers].map((layer) => `<label><input type="checkbox" data-context-source="${escapeHtml(layer.uid)}"${check(!settings.sourceIds.length || settings.sourceIds.includes(layer.uid))}/> ${escapeHtml(layer.title || "Untitled layer")}</label>`).join("")}</fieldset><p class="form-note">AI uses the shared application-wide intelligence provider. Configure it once and it is reused here.</p></div>`,
      actions: [
        { label: "Configure AI…", handler: () => this.#aiDialog() },
        { label: "Cancel", handler: () => this.dialog.close() },
        { label: "Save", primary: true, handler: () => {
          const next = {
            dock: this.dialog.querySelector("[data-context-dock]").value,
            perimeter: Number(this.dialog.querySelector("[data-context-perimeter]").value) || 10,
            units: this.dialog.querySelector("[data-context-units]").value,
            sections: Object.fromEntries([...this.dialog.querySelectorAll("[data-context-section]")].map((input) => [input.dataset.contextSection, input.checked])),
            layerIds: [...this.dialog.querySelectorAll("[data-context-layer]:checked")].map((input) => input.dataset.contextLayer),
            sourceIds: [...this.dialog.querySelectorAll("[data-context-source]:checked")].map((input) => input.dataset.contextSource),
          };
          const updated = this.projectManager.setPresentation({ ...this.projectManager.current.presentation, contextSettings: next });
          document.body.dataset.briefingContextDock = next.dock;
          this.dialog.close();
          this.#renderPresentationDashboard(updated);
          this.mapController.resize();
        } },
      ],
    });
  }

  async #loadBriefingContext(root, contextRoot, selected, primaryLayer) {
    const token = this.briefingRequest.next();
    const output = contextRoot?.querySelector("[data-briefing-surroundings]");
    const addressOutput = root.querySelector("[data-briefing-address]");
    const location = this.mapController.geographicCoordinates(selected.geometry);
    const coordinatesOutput = root.querySelector("[data-briefing-coordinates]");
    const coordinatesText = location ? `${location.longitude.toFixed(6)}, ${location.latitude.toFixed(6)}` : "Coordinates unavailable";
    if (coordinatesOutput) coordinatesOutput.textContent = coordinatesText;
    root.querySelector("[data-copy-briefing-coordinates]")?.addEventListener("click", async () => {
      await navigator.clipboard?.writeText(coordinatesText);
      this.toast("Coordinates copied.");
    });
    if (location) {
      void this.mapController.reverseGeocode(location).then((result) => {
        if (this.briefingRequest.valid(token) && this.presentationState.selected === selected && addressOutput?.isConnected) {
          addressOutput.textContent = result?.address ? `Nearest address: ${result.address}` : "Nearest address: not available for this feature.";
        }
      }).catch(() => { if (addressOutput?.isConnected) addressOutput.textContent = "Nearest address: not available for this feature."; });
    } else if (addressOutput) {
      addressOutput.textContent = "Nearest address: not available for this feature.";
    }
    const settings = this.#briefingContextSettings(this.projectManager.current.presentation);
    const contextual = this.mapController.getLayers().filter((layer) => layer !== primaryLayer && layer.visible && layer.countable && (!settings.layerIds.length || settings.layerIds.includes(layer.uid)));
    if (!output) return;
    if (!contextual.length) { output.textContent = "No other visible queryable datasets are available. Add or show a contextual layer to inspect surroundings."; return; }
    const results = await Promise.all(contextual.map(async (layer) => {
      try {
        const query = { geometry: selected.geometry, spatialRelationship: "intersects", distance: settings.perimeter, units: settings.units, where: layer.where || "1=1" };
        return { title: layer.title || "Untitled layer", count: await this.mapController.queryFeatureCount(layer.uid, query), status: "intersecting" };
      } catch { return { title: layer.title || "Untitled layer", count: null, status: "unavailable" }; }
    }));
    if (!this.briefingRequest.valid(token) || this.presentationState.selected !== selected || !output.isConnected) return;
    output.innerHTML = results.map((result) => result.count == null ? `<span>${escapeHtml(result.title)}: unavailable</span>` : `<button type="button" class="context-fact"><b>${result.count}</b> ${escapeHtml(result.title)} feature${result.count === 1 ? "" : "s"} intersect the selected geometry</button>`).join("") || "No intersections found.";
  }

  #saveAtlasChapters(chapters) {
    const presentation = this.projectManager.setPresentation({ ...this.projectManager.current.presentation, chapters });
    this.#renderPresentationDashboard(presentation);
  }

  /** The tour-wide values used when a new chapter is captured or generated. */
  #atlasDefaults(presentation = this.projectManager.current.presentation || {}) {
    const defaults = presentation.tourDefaults || {};
    return {
      transitionMode: defaults.transitionMode === "instant" ? "instant" : "smooth",
      lingerSeconds: Math.min(120, Math.max(1, Number(defaults.lingerSeconds) || 4)),
      heading: Math.min(360, Math.max(-360, Number(defaults.heading) || 0)),
      tilt: Math.min(179, Math.max(0, Number(defaults.tilt) || 0)),
    };
  }

  #atlasViewWithDefaults(view, defaults) {
    const state = structuredClone(view);
    state.heading = defaults.heading;
    state.tilt = defaults.tilt;
    if (state.camera) {
      state.camera.heading = defaults.heading;
      state.camera.tilt = defaults.tilt;
    }
    return state;
  }

  async #captureAtlasChapter() {
    if (!this.mapController.isReady()) return;
    const chapters = this.projectManager.current.presentation?.chapters || [];
    const defaults = this.#atlasDefaults();
    const [longitude, latitude] = this.mapController.getViewState().center || [];
    const address = await this.mapController.reverseGeocode({ longitude, latitude });
    const next = [...chapters, {
      id: crypto.randomUUID?.() || `chapter-${Date.now()}`,
      title: `Chapter ${chapters.length + 1}`,
      body: "",
      mediaUrl: "",
      reverseAddress: address?.address || "",
      viewState: this.#atlasViewWithDefaults(this.mapController.getViewState(), defaults),
      viewpoint: this.mapController.getViewpoint(),
      basemapId: this.mapController.getBasemapId(),
      lingerSeconds: defaults.lingerSeconds,
      transitionMode: defaults.transitionMode,
      visibleLayerIds: this.mapController.getLayers().filter((layer) => layer.visible).map((layer) => layer.uid),
      layerVisibility: this.mapController.getLayers().map((layer) => ({ key: this.#atlasLayerKey(layer), visible: layer.visible })),
    }];
    this.#saveAtlasChapters(next);
    this.#editAtlasChapter(next, next.length - 1);
  }

  #atlasLayerKey(layer) {
    const config = this.mapController.getLayerConfig(layer) || {};
    if (config.projectPath) return `local:${config.projectPath}`;
    if (config.url) return `url:${String(config.url).replace(/\/$/, "").toLowerCase()}`;
    return `title:${String(layer?.title || "untitled").toLowerCase()}`;
  }

  #atlasGeographicCameraPosition(position = {}) {
    const wkid = position.spatialReference?.latestWkid ?? position.spatialReference?.wkid;
    if (![3857, 102100, 102113].includes(wkid)) return { longitude: position.x ?? position.longitude, latitude: position.y ?? position.latitude, altitude: position.z };
    const radius = 6378137;
    return {
      longitude: (position.x / radius) * (180 / Math.PI),
      latitude: (2 * Math.atan(Math.exp(position.y / radius)) - (Math.PI / 2)) * (180 / Math.PI),
      altitude: position.z,
    };
  }

  /** The editor's longitude/latitude/altitude: the camera eye when there is one, else the view centre. */
  #atlasEditorPosition(state = {}) {
    if (state.camera?.position) return this.#atlasGeographicCameraPosition(state.camera.position);
    const [longitude, latitude] = state.center || [];
    return { longitude, latitude, altitude: undefined };
  }

  #atlasEditorViewState() {
    const state = structuredClone(this.atlasEditingViewState || this.mapController.getViewState());
    const number = (selector, fallback) => {
      const value = Number(this.dialog.querySelector(selector)?.value);
      return Number.isFinite(value) ? value : fallback;
    };
    if (!state.camera?.position) {
      // MapLibre views have no eye-position camera: the fields edit the centre the view looks at.
      const [longitude, latitude] = state.center || [];
      state.center = [number("#atlas-camera-longitude", longitude), number("#atlas-camera-latitude", latitude)];
      state.heading = number("#atlas-camera-heading", state.heading ?? 0);
      state.tilt = number("#atlas-camera-tilt", state.tilt ?? 0);
      return state;
    }
    const camera = state.camera;
    const position = camera.position;
    const geographic = this.#atlasGeographicCameraPosition(position);
    camera.position = {
      ...position,
      x: number("#atlas-camera-longitude", geographic.longitude),
      y: number("#atlas-camera-latitude", geographic.latitude),
      z: number("#atlas-camera-altitude", geographic.altitude ?? 0),
      spatialReference: { wkid: 4326 },
    };
    camera.heading = number("#atlas-camera-heading", camera.heading ?? state.heading ?? 0);
    camera.tilt = number("#atlas-camera-tilt", camera.tilt ?? state.tilt ?? 0);
    state.camera = camera;
    state.heading = camera.heading;
    state.tilt = camera.tilt;
    return state;
  }

  async #syncAtlasEditorToCurrentView(addressLabel = "", useAddressAsTitle = false, syncCamera = true) {
    if (!this.dialog.open) return;
    const state = this.mapController.getViewState();
    if (syncCamera) this.atlasEditingViewState = structuredClone(state);
    const editingState = this.atlasEditingViewState || state;
    const geographic = this.#atlasEditorPosition(editingState);
    const setValue = (selector, value, digits = 5) => {
      const input = this.dialog.querySelector(selector);
      if (input && Number.isFinite(Number(value))) input.value = Number(value).toFixed(digits);
    };
    setValue("#atlas-camera-longitude", geographic.longitude, 6);
    setValue("#atlas-camera-latitude", geographic.latitude, 6);
    setValue("#atlas-camera-altitude", geographic.altitude, 1);
    if (syncCamera) {
      setValue("#atlas-camera-heading", editingState.camera?.heading ?? editingState.heading, 1);
      setValue("#atlas-camera-tilt", editingState.camera?.tilt ?? editingState.tilt, 1);
    }
    const addressOutput = this.dialog.querySelector("#atlas-reverse-address");
    if (!addressOutput) return;
    addressOutput.textContent = addressLabel || "Finding the place at the center of this view…";
    const [longitude, latitude] = editingState.center || this.mapController.getViewState().center || [];
    const address = addressLabel ? { address: addressLabel } : await this.mapController.reverseGeocode({ longitude, latitude });
    if (!this.dialog.open || !this.dialog.querySelector("#atlas-reverse-address")) return;
    const locationDetails = address?.address || "";
    addressOutput.textContent = locationDetails || "No street address was found for this view.";
    addressOutput.dataset.address = locationDetails;
    if (useAddressAsTitle && locationDetails) {
      const titleInput = this.dialog.querySelector("#atlas-editor-title");
      const currentTitle = titleInput?.value.trim() || "";
      const previousLocationTitle = titleInput?.dataset.locationTitle || "";
      if (titleInput && (!currentTitle || /^Chapter\s+\d+$/i.test(currentTitle) || currentTitle === previousLocationTitle)) {
        titleInput.value = locationDetails;
        titleInput.dataset.locationTitle = locationDetails;
      }
    }
  }

  async #editAtlasChapter(chapters, index) {
    const chapter = chapters[index];
    if (!chapter) return;
    this.atlasEditingViewState = structuredClone(chapter.viewState || this.mapController.getViewState());
    const geographicPosition = this.#atlasEditorPosition(this.atlasEditingViewState);
    const basemapOptions = this.#basemapOptionsMarkup(chapter.basemapId || this.mapController.getBasemapId());
    const visibility = new Map((chapter.layerVisibility || []).map((entry) => [entry.key, entry.visible !== false]));
    const layerChoices = this.mapController.getLayers().map((layer) => {
      const key = this.#atlasLayerKey(layer);
      const checked = visibility.has(key) ? visibility.get(key) : chapter.visibleLayerIds ? chapter.visibleLayerIds.includes(layer.uid) : layer.visible;
      return `<label class="atlas-layer-choice"><input type="checkbox" data-atlas-layer-key="${escapeHtml(key)}"${checked ? " checked" : ""} /><span>${escapeHtml(layer.title || "Untitled layer")}</span></label>`;
    }).join("") || `<p class="form-note">This project has no operational layers. The basemap and camera will still be saved.</p>`;
    this.openDialog({
      eyebrow: "Atlas chapter",
      title: "Edit chapter",
      presentationSheet: true,
      content: `<section class="atlas-geocoder"><label class="field"><span>Zoom to a place or address</span><div class="atlas-geocoder__search"><input id="atlas-place-query" type="search" placeholder="Address, place, or longitude, latitude" autocomplete="off" role="combobox" aria-autocomplete="list" aria-controls="atlas-place-results" aria-expanded="false" /><button id="atlas-place-search" type="button">Find</button></div></label><div id="atlas-place-results" class="atlas-place-results" role="listbox" aria-label="Place suggestions" hidden></div><div class="atlas-reverse-place"><span>Center of view</span><output id="atlas-reverse-address" data-address="${escapeHtml(chapter.reverseAddress || "")}">${escapeHtml(chapter.reverseAddress || "Finding address…")}</output><button id="atlas-use-current-view" type="button">Use current map view</button></div></section><label class="field"><span>Title</span><input id="atlas-editor-title" value="${escapeHtml(chapter.title || "")}" /></label><details class="atlas-chapter-advanced"${this.mobileMedia.matches ? "" : " open"}><summary>More chapter options</summary><div class="atlas-chapter-advanced__content"><label class="field"><span>Description <small>Shown in the lower-right card during the tour</small></span><textarea id="atlas-chapter-body" rows="4">${escapeHtml(chapter.body || "")}</textarea></label><label class="field"><span>Image URL <small>Optional public http(s) image</small></span><input id="atlas-chapter-media" type="url" inputmode="url" placeholder="https://example.com/photo.jpg" value="${escapeHtml(chapter.mediaUrl || "")}" /></label><fieldset class="atlas-camera-fields"><legend>Exact camera</legend><label>Longitude<input id="atlas-camera-longitude" type="number" step="0.000001" value="${escapeHtml(geographicPosition.longitude ?? "")}" /></label><label>Latitude<input id="atlas-camera-latitude" type="number" step="0.000001" value="${escapeHtml(geographicPosition.latitude ?? "")}" /></label><label>Altitude (m)<input id="atlas-camera-altitude" type="number" step="0.1" value="${escapeHtml(geographicPosition.altitude ?? "")}" /></label><label>Heading / angle<input id="atlas-camera-heading" type="number" min="0" max="360" step="0.1" value="${escapeHtml(this.atlasEditingViewState.camera?.heading ?? this.atlasEditingViewState.heading ?? 0)}" /></label><label>Tilt<input id="atlas-camera-tilt" type="number" min="0" max="179" step="0.1" value="${escapeHtml(this.atlasEditingViewState.camera?.tilt ?? this.atlasEditingViewState.tilt ?? 0)}" /></label></fieldset><div class="field-grid"><label class="field"><span>Basemap</span><select id="atlas-chapter-basemap">${basemapOptions}</select></label><label class="field"><span>Linger (seconds) <small>Auto playback only</small></span><input id="atlas-chapter-linger" type="number" min="1" max="120" step="1" value="${Number(chapter.lingerSeconds) || 4}" /></label><label class="field"><span>Camera transition</span><select id="atlas-chapter-transition"><option value="smooth"${chapter.transitionMode !== "instant" ? " selected" : ""}>Smooth camera move</option><option value="instant"${chapter.transitionMode === "instant" ? " selected" : ""}>Cut instantly</option></select></label></div><fieldset class="atlas-layer-fields"><legend>Layers in this chapter</legend>${layerChoices}</fieldset></div></details>`,
      actions: [{ label: "Save", primary: true, handler: () => {
        const mediaUrl = this.dialog.querySelector("#atlas-chapter-media").value.trim();
        if (mediaUrl && !/^https?:\/\//i.test(mediaUrl)) return this.error("Use a full http or https image URL.");
        const lingerSeconds = Math.min(120, Math.max(1, Number(this.dialog.querySelector("#atlas-chapter-linger").value) || 4));
        const layerVisibility = [...this.dialog.querySelectorAll("[data-atlas-layer-key]")].map((input) => ({ key: input.dataset.atlasLayerKey, visible: input.checked }));
        const next = chapters.map((item, itemIndex) => itemIndex === index ? {
          ...item,
          title: this.dialog.querySelector("#atlas-editor-title").value.trim() || `Chapter ${index + 1}`,
          body: this.dialog.querySelector("#atlas-chapter-body").value.trim(),
          mediaUrl,
          reverseAddress: this.dialog.querySelector("#atlas-reverse-address").dataset.address || "",
          viewState: this.#atlasEditorViewState(),
          viewpoint: null,
          basemapId: this.dialog.querySelector("#atlas-chapter-basemap").value,
          lingerSeconds,
          transitionMode: this.dialog.querySelector("#atlas-chapter-transition").value,
          layerVisibility,
          visibleLayerIds: undefined,
        } : item);
        this.#saveAtlasChapters(next);
        this.dialog.close();
      } }],
    });
    this.dialog.querySelector("#atlas-use-current-view").addEventListener("click", () => this.#syncAtlasEditorToCurrentView("", true));
    const queryInput = this.dialog.querySelector("#atlas-place-query");
    let searchResults = [];
    let searchSelection = -1;
    let searchTimer = null;
    let searchRequestId = 0;
    const selectResult = async (resultIndex) => {
      const result = searchResults[resultIndex];
      if (!result) return;
      queryInput.value = result.label;
      queryInput.setAttribute("aria-expanded", "false");
      this.dialog.querySelector("#atlas-place-results").hidden = true;
      await this.mapController.goToSearchResult(result);
      await this.#syncAtlasEditorToCurrentView(result.label);
    };
    const runSearch = async (fromSubmit = false) => {
      const query = queryInput.value.trim();
      const resultsElement = this.dialog.querySelector("#atlas-place-results");
      if (query.length < 2) { resultsElement.hidden = true; queryInput.setAttribute("aria-expanded", "false"); return; }
      const requestId = ++searchRequestId;
      resultsElement.hidden = false;
      queryInput.setAttribute("aria-expanded", "true");
      if (fromSubmit) resultsElement.innerHTML = `<div class="loading-row"><span></span> Searching…</div>`;
      try {
        const results = await this.mapController.search(query);
        if (requestId !== searchRequestId || queryInput.value.trim() !== query) return;
        searchResults = results;
        searchSelection = fromSubmit && results.length === 1 ? 0 : -1;
        resultsElement.innerHTML = results.length ? results.map((result, resultIndex) => `<button type="button" role="option" data-atlas-place-result="${resultIndex}" aria-selected="${resultIndex === searchSelection}">${escapeHtml(result.label)}</button>`).join("") : `<p>No matching places found.</p>`;
        resultsElement.querySelectorAll("[data-atlas-place-result]").forEach((button) => button.addEventListener("click", () => void selectResult(Number(button.dataset.atlasPlaceResult))));
        if (fromSubmit && results.length === 1) await selectResult(0);
      } catch (error) {
        if (requestId !== searchRequestId) return;
        resultsElement.innerHTML = `<p>${escapeHtml(error.message)}</p>`;
      }
    };
    this.dialog.querySelector("#atlas-place-search").addEventListener("click", () => void runSearch(true));
    queryInput.addEventListener("input", () => {
      clearTimeout(searchTimer);
      searchRequestId += 1;
      if (queryInput.value.trim().length < 2 || !this.mapController.getCapabilities().includes("geocode-suggest")) {
        this.dialog.querySelector("#atlas-place-results").hidden = true;
        queryInput.setAttribute("aria-expanded", "false");
        return;
      }
      searchTimer = setTimeout(() => void runSearch(), 250);
    });
    queryInput.addEventListener("keydown", (event) => {
      if (["ArrowDown", "ArrowUp"].includes(event.key) && searchResults.length) {
        event.preventDefault();
        searchSelection = (searchSelection + (event.key === "ArrowDown" ? 1 : -1) + searchResults.length) % searchResults.length;
        this.dialog.querySelectorAll("[data-atlas-place-result]").forEach((button, resultIndex) => {
          button.setAttribute("aria-selected", String(resultIndex === searchSelection));
          if (resultIndex === searchSelection) button.scrollIntoView({ block: "nearest" });
        });
      } else if (event.key === "Enter") {
        event.preventDefault();
        if (searchSelection >= 0) void selectResult(searchSelection);
        else void runSearch(true);
      } else if (event.key === "Escape") {
        this.dialog.querySelector("#atlas-place-results").hidden = true;
        queryInput.setAttribute("aria-expanded", "false");
      }
    });
    // Resolve an empty address without replacing a newly captured chapter's
    // default camera orientation with the map's current orientation.
    if (!chapter.reverseAddress) void this.#syncAtlasEditorToCurrentView("", false, false);
  }

  async #goToAtlasChapter(chapter, index = null, chapters = this.projectManager.current.presentation?.chapters || []) {
    if (!chapter) return;
    // Update the story immediately.  A SceneView navigation can take longer
    // than the chapter linger (or never resolve after an interrupted camera
    // transition), but it must not hold the player hostage.
    const chapterIndex = Number.isInteger(index) ? index : chapters.indexOf(chapter);
    this.mapController.setActiveTourMarker(chapterIndex);
    this.#showAtlasChapterOverlay(chapter, chapterIndex, chapters);
    if (chapter.basemapId && BASEMAP_IDS.has(chapter.basemapId)) this.mapController.setBasemap(chapter.basemapId);
    const visibility = new Map((chapter.layerVisibility || []).map((entry) => [entry.key, entry.visible !== false]));
    this.mapController.getLayers().forEach((layer) => {
      if (visibility.size) this.mapController.setVisibility(layer.uid, visibility.get(this.#atlasLayerKey(layer)) ?? layer.visible, { silent: true });
      else if (chapter.visibleLayerIds) this.mapController.setVisibility(layer.uid, chapter.visibleLayerIds.includes(layer.uid), { silent: true });
    });
    const animate = chapter.transitionMode !== "instant" && !matchMedia("(prefers-reduced-motion: reduce)").matches;
    const state = chapter.viewState;
    if (state?.camera) await this.mapController.setView({ camera: state.camera }, { animate });
    else if (state?.center) await this.mapController.setView({ center: state.center, zoom: state.zoom, heading: state.heading ?? 0, tilt: state.tilt ?? 0 }, { animate });
    else if (chapter.viewpoint) await this.mapController.setView({ viewpoint: chapter.viewpoint }, { animate });
  }

  #showAtlasChapterOverlay(chapter, index, chapters) {
    const overlay = document.querySelector("#atlas-chapter-overlay");
    if (!overlay || !chapter || index < 0) return;
    this.presentationState.atlasChapterIndex = index;
    document.querySelector("#atlas-chapter-position").textContent = `Chapter ${index + 1} of ${chapters.length}`;
    document.querySelector("#atlas-chapter-title").textContent = chapter.title || `Chapter ${index + 1}`;
    const mapsLink = document.querySelector("#atlas-chapter-google-maps");
    const mapsUrl = googleMapsLinkForChapter(chapter);
    mapsLink.hidden = !mapsUrl;
    if (mapsUrl) mapsLink.href = mapsUrl;
    else mapsLink.removeAttribute("href");
    const message = document.querySelector("#atlas-chapter-message");
    message.textContent = chapter.body || "";
    const description = document.querySelector("#atlas-chapter-description");
    const image = document.querySelector("#atlas-chapter-image");
    const hasImage = /^https?:\/\//i.test(chapter.mediaUrl || "");
    image.hidden = !hasImage;
    image.src = hasImage ? chapter.mediaUrl : "";
    image.alt = hasImage ? `${chapter.title || `Chapter ${index + 1}`} illustration` : "";
    image.onerror = () => { image.hidden = true; };
    message.hidden = !chapter.body;
    description.hidden = !chapter.body && !hasImage;
    document.querySelector("#atlas-chapter-previous").disabled = index <= 0;
    document.querySelector("#atlas-chapter-next").disabled = index >= chapters.length - 1;
    const play = document.querySelector("#atlas-chapter-play");
    const exit = document.querySelector("#atlas-tour-exit");
    if (exit) exit.hidden = this.sharedTourOnly;
    // Manual tours do not start on their own, but viewers can still play them.
    play.hidden = chapters.length < 2;
    play.setAttribute("aria-label", this.presentationState.atlasPlaying ? "Stop tour" : "Play tour");
    play.innerHTML = this.presentationState.atlasPlaying ? "■ <span>Stop</span>" : "▶ <span>Play</span>";
    overlay.hidden = false;
  }

  #hideAtlasChapterOverlay() {
    const overlay = document.querySelector("#atlas-chapter-overlay");
    if (overlay) overlay.hidden = true;
    const description = document.querySelector("#atlas-chapter-description");
    if (description) description.hidden = true;
    this.presentationState.atlasChapterIndex = null;
    this.mapController.setActiveTourMarker(null);
  }

  async #stepAtlasChapter(direction) {
    const chapters = this.projectManager.current.presentation?.chapters || [];
    if (!chapters.length) return;
    this.#stopAtlasStory();
    const current = Number.isInteger(this.presentationState.atlasChapterIndex) ? this.presentationState.atlasChapterIndex : 0;
    const index = Math.max(0, Math.min(chapters.length - 1, current + direction));
    await this.#goToAtlasChapter(chapters[index], index, chapters);
  }

  #basemapLabel(id) {
    return BASEMAP_OPTIONS.find(([value]) => value === id)?.[1] || id;
  }

  #stopAtlasStory() {
    this.atlasPlaybackToken += 1;
    clearTimeout(this.atlasPlaybackTimer);
    this.atlasPlaybackTimer = null;
    this.presentationState.atlasPlaying = false;
    this.#renderPresentationDashboard(this.projectManager.current.presentation || {});
    const play = document.querySelector("#atlas-chapter-play");
    if (play) { play.setAttribute("aria-label", "Play tour"); play.innerHTML = "▶ <span>Play</span>"; }
  }

  #exitAtlasTour() {
    this.atlasPlaybackToken += 1;
    clearTimeout(this.atlasPlaybackTimer);
    this.atlasPlaybackTimer = null;
    this.presentationState.atlasPlaying = false;
    this.presentationState.atlasPresent = false;
    this.mobileAtlasSettingsOpen = false;
    this.#hideAtlasChapterOverlay();
    document.body.classList.remove("shared-tour-active", "shared-tour-only", "shared-tour-embed", "mobile-atlas-presenting", "mobile-presentation-panel-open");
    this.sharedTourLaunch = false;
    this.sharedTourOnly = false;
    this.sharedTourEmbed = false;
    const current = this.projectManager.current.presentation || {};
    this.projectManager.setPresentation({ ...current, template: "standard" });
    const cleanUrl = new URL(location.href);
    ["chapter", "autoplay", "tourOnly", "embed"].forEach((key) => cleanUrl.searchParams.delete(key));
    cleanUrl.hash = "";
    history.replaceState(null, "", `${cleanUrl.pathname}${cleanUrl.search}`);
    this.#setSidebarCollapsed(this.mobileMedia.matches);
    this.events.publish("mobile:workflow-route", { route: "map" });
    this.toast("Returned to the standard map workspace.");
  }

  #toggleAtlasPlayback() {
    const presentation = this.projectManager.current.presentation || {};
    const chapters = presentation.chapters || [];
    if (!chapters.length || presentation.playbackMode === "manual") return;
    if (this.presentationState.atlasPlaying) return this.#stopAtlasStory();
    const startIndex = Number.isInteger(this.presentationState.atlasChapterIndex) ? this.presentationState.atlasChapterIndex : 0;
    this.#playAtlasStory(chapters, startIndex);
    const play = document.querySelector("#atlas-chapter-play");
    if (play) { play.setAttribute("aria-label", "Stop tour"); play.innerHTML = "■ <span>Stop</span>"; }
  }

  #atlasSettingsDialog() {
    const presentation = this.projectManager.current.presentation || {};
    const playbackMode = presentation.playbackMode === "manual" ? "manual" : "auto";
    const defaults = this.#atlasDefaults(presentation);
    const skins = INTERFACE_SKINS.map(({ id, label }) => [id, label]);
    this.openDialog({
      eyebrow: "Guided places",
      title: "Tour settings",
      content: `<div class="atlas-settings"><label class="field"><span>Look &amp; feel</span><select data-atlas-settings-skin>${skins.map(([value, label]) => `<option value="${value}"${presentation.skin === value ? " selected" : ""}>${label}</option>`).join("")}</select></label><label class="field"><span>Playback</span><select data-atlas-settings-playback><option value="auto"${playbackMode === "auto" ? " selected" : ""}>Auto · advance after each linger time</option><option value="manual"${playbackMode === "manual" ? " selected" : ""}>Manual · use Back and Next</option></select></label><fieldset class="atlas-settings__defaults"><legend>Defaults for new chapters</legend><label class="field"><span>Between chapters</span><select data-atlas-settings-transition><option value="smooth"${defaults.transitionMode === "smooth" ? " selected" : ""}>Pan and zoom</option><option value="instant"${defaults.transitionMode === "instant" ? " selected" : ""}>Cut (jump straight there)</option></select></label><div class="field-grid"><label class="field"><span>Linger (seconds)</span><input data-atlas-settings-linger type="number" min="1" max="120" step="1" value="${defaults.lingerSeconds}" /></label><label class="field"><span>Heading</span><input data-atlas-settings-heading type="number" min="-360" max="360" step="0.1" value="${defaults.heading}" /></label><label class="field"><span>Camera tilt</span><input data-atlas-settings-tilt type="number" min="0" max="179" step="0.1" value="${defaults.tilt}" /></label></div></fieldset><p class="form-note">These values start each new chapter. Edit a chapter to override its transition, linger, or camera angle; saved chapters are never overwritten.</p></div>`,
      actions: [
        { label: "Cancel", handler: () => this.dialog.close() },
        { label: "Save settings", primary: true, handler: () => {
          this.#stopAtlasStory();
          const updated = this.projectManager.setPresentation({
            ...this.projectManager.current.presentation,
            skin: this.dialog.querySelector("[data-atlas-settings-skin]").value,
            playbackMode: this.dialog.querySelector("[data-atlas-settings-playback]").value,
            tourDefaults: {
              transitionMode: this.dialog.querySelector("[data-atlas-settings-transition]").value,
              lingerSeconds: this.dialog.querySelector("[data-atlas-settings-linger]").value,
              heading: this.dialog.querySelector("[data-atlas-settings-heading]").value,
              tilt: this.dialog.querySelector("[data-atlas-settings-tilt]").value,
            },
          });
          this.dialog.close();
          this.#renderPresentationDashboard(updated);
          this.toast("Tour settings saved.");
        } },
      ],
    });
  }

  #shareAtlasDialog() {
    let regularUrl;
    let tourOnlyUrl;
    let embedUrl;
    try {
      const options = { baseUrl: location.href, presentation: this.projectManager.current.presentation, allowedBasemaps: BASEMAP_IDS };
      regularUrl = createEmbeddedTourUrl(options);
      tourOnlyUrl = createEmbeddedTourUrl({ ...options, tourOnly: true });
      embedUrl = createEmbeddedTourUrl({ ...options, embed: true });
    }
    catch (error) { this.error(error.message); return; }
    const title = this.projectManager.current.presentation?.title || "Guided places";
    const iframe = createEmbedIframe(embedUrl, { title: `${title} guided map tour`, kind: "tour" });
    const selectedUrl = () => this.dialog.querySelector("[data-tour-share-url]")?.value || regularUrl;
    this.tourShareImageFile = null;
    this.openDialog({ eyebrow: "Guided places", title: "Share & export", content: `<p class="form-note">Share a camera-only link or download the complete tour file. Links omit descriptions, images, layers, and credentials; the .gisatlas file preserves the complete authored tour.</p><fieldset class="tour-share-options"><legend>Viewer access</legend><label><input type="radio" name="tour-share-mode" value="regular" checked><span><strong>Tour with GIS tools</strong><small>Viewers can exit the tour and continue in the standard map workspace.</small></span></label><label><input type="radio" name="tour-share-mode" value="tour-only"><span><strong>Tour only</strong><small>Hide authoring menus, map tools, and the Exit tour control.</small></span></label></fieldset><label class="field"><span>Link</span><textarea readonly rows="4" data-tour-share-url>${escapeHtml(regularUrl)}</textarea></label><details class="tour-embed"><summary>Embed this tour on a website</summary><p class="form-note">Paste this iframe into your page. It opens the same camera-only tour without the GIS authoring interface.</p><textarea readonly rows="6" data-tour-embed-code>${escapeHtml(iframe)}</textarea><button type="button" data-tour-copy-embed>Copy embed HTML</button></details><div class="tour-share-card"><canvas data-tour-share-card width="760" height="960" role="img" aria-label="Branded QR card for this guided places tour"></canvas><p class="tour-share-card__status" data-tour-share-status>Building complete-link QR card…</p></div>`, actions: [
      { label: "Download .gisatlas", handler: () => this.projectManager.exportAtlas() },
      { label: "Download image", handler: () => {
        if (!this.tourShareImageFile) return this.error("The tour image is still being prepared.");
        const link = document.createElement("a");
        link.href = URL.createObjectURL(this.tourShareImageFile);
        link.download = this.tourShareImageFile.name;
        link.click();
        setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      } },
      { label: "Mobile share", handler: async () => {
        const url = selectedUrl();
        let share = { title, text: `Open the ${title} guided tour in GISMap Online.`, url };
        const shareWithImage = this.tourShareImageFile ? { ...share, files: [this.tourShareImageFile] } : null;
        if (shareWithImage && navigator.canShare?.(shareWithImage)) share = shareWithImage;
        if (navigator.share) await navigator.share(share);
        else { await navigator.clipboard.writeText(url); this.toast("Tour link copied."); }
      } },
      { label: "Copy link", primary: true, handler: async () => { await navigator.clipboard.writeText(selectedUrl()); this.toast("Tour link copied."); } },
    ] });
    this.dialog.querySelectorAll('[name="tour-share-mode"]').forEach((input) => input.addEventListener("change", () => {
      const url = input.value === "tour-only" ? tourOnlyUrl : regularUrl;
      this.dialog.querySelector("[data-tour-share-url]").value = url;
      this.tourShareImageFile = null;
      void this.#renderTourShareCard(url, title);
    }));
    this.dialog.querySelector("[data-tour-copy-embed]")?.addEventListener("click", async () => {
      await navigator.clipboard.writeText(iframe);
      this.toast("Embed HTML copied.");
    });
    void this.#renderTourShareCard(regularUrl, title);
  }

  /** Phones: Features and Feature context become folding sections inside the Briefing sheet. */
  /**
   * Desktop: the feature list (with its "use all" bar) folds like a door, and
   * when open it fills the panel down to the footer, scrolling on its own.
   */
  #foldBriefingRecords(root) {
    const records = root.querySelector(".briefing-records");
    const scope = root.querySelector(".briefing-scope");
    if (!records) return;
    const shown = this.presentationState.visibleRecords.length;
    const fold = document.createElement("details");
    fold.className = "briefing-records-fold";
    fold.open = this.briefingRecordsOpen !== false;
    fold.innerHTML = `<summary>Features${shown > 400 ? " <small>first 400 listed</small>" : ""}</summary>`;
    (scope || records).before(fold);
    fold.append(...[scope, records].filter(Boolean));
    fold.addEventListener("toggle", () => {
      this.briefingRecordsOpen = fold.open;
      if (fold.open) this.#fitBriefingRecords(records);
    });
    requestAnimationFrame(() => this.#fitBriefingRecords(records));
    if (!this.briefingRecordsResize) {
      this.briefingRecordsResize = () => this.#fitBriefingRecords(document.querySelector(".briefing-records-fold .briefing-records"));
      addEventListener("resize", this.briefingRecordsResize);
    }
  }

  #fitBriefingRecords(records) {
    const scroller = records?.closest(".sidebar__scroll, .utility-content");
    if (!records?.isConnected || !scroller || this.mobileMedia.matches) return;
    // Top of the list within the scrolling panel, independent of how far it is scrolled.
    const top = records.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
    const available = scroller.clientHeight - top - 14;
    // At least about half the panel, so scrolling down to the list shows a useful page of it.
    records.style.maxHeight = `${Math.max(260, Math.round(scroller.clientHeight * 0.55), available)}px`;
  }

  #foldBriefingSheet(root, context, selected) {
    document.querySelector("#briefing-context-host")?.replaceChildren();
    document.body.classList.remove("mobile-briefing-context-open");
    if (selected !== this.briefingFoldSelection) {
      // A new selection shows its context; clearing it goes back to the list.
      this.briefingFoldSelection = selected;
      this.briefingFolds = { records: !selected, context: Boolean(selected) };
    }
    const fold = (key, title, node) => {
      const details = document.createElement("details");
      details.className = `briefing-fold briefing-fold--${key}`;
      details.open = this.briefingFolds[key];
      const summary = document.createElement("summary");
      summary.textContent = title;
      node.before(details);
      details.append(summary, node);
      details.addEventListener("toggle", () => { this.briefingFolds[key] = details.open; });
    };
    const records = root.querySelector(".briefing-records");
    if (records) fold("records", `Features · ${records.querySelectorAll(".mode-record").length}`, records);
    fold("context", selected ? "Feature context" : "Feature context · none selected", context);
  }

  async #renderTourShareCard(url, title) {
    const renderToken = ++this.tourShareRenderToken;
    const canvas = this.dialog.querySelector("[data-tour-share-card]");
    const status = this.dialog.querySelector("[data-tour-share-status]");
    if (!canvas || !status) return;
    try {
      const file = await this.#drawBrandedQrCard(canvas, url, {
        title: title || "Guided places",
        lines: ["Scan to open guided map tour, or long-click the QR code", "to open it in a browser."],
        footer: "Complete camera-only tour link encoded in this QR",
        fileStem: "guided-tour",
        isCurrent: () => renderToken === this.tourShareRenderToken,
      });
      if (!file) return;
      this.tourShareImageFile = file;
      status.textContent = "This QR contains the complete URL, including every encoded chapter.";
    } catch (error) {
      console.error("Tour share image generation failed", error);
      status.textContent = `The QR image could not be created here (${error?.message || "unknown error"}). Copy link still preserves the complete tour URL.`;
    }
  }

  /**
   * Draws the GISMap Online QR card (logo, title, two lines of guidance, the QR
   * and a footer) onto a 760×960 canvas and returns it as a PNG file, or null if
   * a newer render replaced this one.
   */
  async #drawBrandedQrCard(canvas, url, { title, lines = [], footer = "", fileStem = "gismap", isCurrent = () => true }) {
    if (!globalThis.QRCode?.toCanvas) throw new Error("QR generator unavailable");
    // The card wears the current skin's print colours, like the PDFs.
    const palette = printPalette(document.documentElement.dataset.skin);
    const safeTitle = String(title || "GISMap Online").slice(0, 54);
    await brandedQrCanvas(url, { canvas, title: safeTitle, lines, footer, palette });
    if (!isCurrent()) return null;
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("Could not create image");
    const safeName = safeTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || fileStem;
    return new File([blob], `${safeName}-qr.png`, { type: "image/png" });
  }

  async openSharedAtlas({ chapterIndex = 0, autoplay = false, tourOnly = false, embed = false } = {}) {
    const chapters = this.projectManager.current.presentation?.chapters || [];
    if (!chapters.length) return;
    this.sharedTourLaunch = true;
    this.sharedTourOnly = Boolean(tourOnly || embed);
    this.sharedTourEmbed = Boolean(embed);
    document.body.classList.add("shared-tour-active");
    document.body.classList.toggle("shared-tour-only", this.sharedTourOnly);
    document.body.classList.toggle("shared-tour-embed", this.sharedTourEmbed);
    this.presentationState.atlasPresent = true;
    this.#renderPresentationDashboard(this.projectManager.current.presentation);
    const index = Math.max(0, Math.min(chapters.length - 1, Number(chapterIndex) || 0));
    await this.#goToAtlasChapter(chapters[index], index, chapters);
    if (autoplay && !matchMedia("(prefers-reduced-motion: reduce)").matches) this.#playAtlasStory(chapters, index);
  }

  /** Deterministic cinematic import used by the UI and the in-page API. */
  async importCinematicSpec(spec) {
    await this.cinematicController.load(spec);
    this.cinematicState = this.cinematicController.state();
    const normalized = this.cinematicController.exportCinematicSpec();
    const primaryLayerId = normalized.cinematic.layers[0]?.layerRef || null;
    this.projectManager.setPresentation({
      ...this.projectManager.current.presentation,
      template: "cinematic",
      title: normalized.cinematic.title,
      primaryLayerId,
      cinematic: normalized.cinematic,
    });
    return normalized;
  }

  exportCinematicSpec() {
    const spec = this.cinematicController.exportCinematicSpec?.();
    if (spec) return spec;
    const cinematic = this.projectManager.current.presentation?.cinematic;
    if (!cinematic) throw new Error("No cinematic specification is loaded.");
    return { schemaVersion: "0.1", mode: "cinematic", cinematic: structuredClone(cinematic) };
  }

  /** The Clip the Present panel acts on: the last one saved or edited, else the newest. */
  #latestCinematicClip() {
    const clips = this.projectManager.current.presentation?.cinematicClips || [];
    return clips.find((clip) => clip.id === this.lastCinematicClipId) || clips.at(-1) || null;
  }

  #cinematicClipSummary() {
    const clip = this.#latestCinematicClip();
    return clip ? `<p class="form-note cinematic-clip-summary">Clip: <strong>${escapeHtml(clip.title)}</strong> · ${(clip.playback.durationMs / 1000).toFixed(0)} s${clip.tracks.some((track) => track.type === "caption") ? ` · ${clip.tracks.filter((track) => track.type === "caption").length} captions` : ""}</p>` : "";
  }

  /** The Clip actions need one: the latest, or (with no saved Clip) the capture dialog opens. */
  #currentCinematicClip() {
    const clip = this.#latestCinematicClip();
    if (!clip) this.#captureCinematicClipDialog();
    return clip;
  }

  /**
   * Capture → Save Clip: name, time range, length, camera start and end,
   * easing, captions and poster time. With `clip`, edits that Clip in place
   * (same id) and keeps the scene it was captured with.
   */
  #captureCinematicClipDialog({ clip = null } = {}) {
    const live = this.cinematicController.exportCinematicSpec?.();
    const timeline = this.cinematicState?.timeline;
    if (!clip && (!live?.cinematic || !timeline?.ticks?.length)) return this.error("Start cinematic playback before creating a Clip.");
    const scene = clip ? clipToCinematicSpec(clip).cinematic : live.cinematic;
    // Custom date ranges are for timelines; a Scenario's range is set in the panel's Values.
    const kind = scene.layers.find((item) => item.temporal?.kind !== "none")?.temporal.kind || (scene.layers.length ? "none" : "time");
    const ticks = timeline?.ticks?.length ? timeline.ticks : [Date.parse(clip.range.start), Date.parse(clip.range.end)].filter(Number.isFinite);
    const first = ticks[0], last = ticks.at(-1);
    // datetime-local works in local time to the second.
    const toLocal = (ms) => Number.isFinite(ms) ? new Date(ms - new Date(ms).getTimezoneOffset() * 60000).toISOString().slice(0, 19) : "";
    const fromLocal = (value) => (value ? new Date(value).getTime() : NaN);
    const view = this.mapController.getViewState?.();
    const asCamera = (state) => state && Array.isArray(state.center) ? { longitude: Number(state.center[0]), latitude: Number(state.center[1]), zoom: Number(state.zoom) || 12, bearing: Number(state.heading) || 0, pitch: Number(state.tilt) || 0 } : null;
    const cameras = { start: clip?.cameraTrack?.[0]?.camera || asCamera(view), end: clip?.cameraTrack?.at(-1)?.camera || asCamera(view) };
    let captions = (clip?.tracks || []).filter((track) => track.type === "caption").map((track) => ({ seconds: track.atMs / 1000, text: track.text }));
    const custom = kind === "time" && Boolean(clip && (Date.parse(clip.range.start) > first || Date.parse(clip.range.end) < last));
    const seconds = clip ? clip.playback.durationMs / 1000 : Math.min(30, Math.max(10, Number(scene.clock.durationSeconds) || 20));
    const cameraText = (camera) => camera ? `${camera.latitude.toFixed(3)}, ${camera.longitude.toFixed(3)} · zoom ${camera.zoom.toFixed(1)}${camera.pitch ? ` · tilt ${Math.round(camera.pitch)}°` : ""}${camera.bearing ? ` · heading ${Math.round(camera.bearing)}°` : ""}` : "Not set";
    const field = (label, control, extra = "") => `<label class="field"${extra}><span>${label}</span>${control}</label>`;
    this.openDialog({
      eyebrow: "Cinematic Clip",
      title: clip ? "Edit Clip" : "Save Clip",
      content: `<p class="form-note">A Clip is a reusable recipe of this scene (layers, time, camera and captions), not a video. Briefs play it live; Export movie renders it.</p>
        <div class="field-grid">
          ${field("Name", `<input data-clip-title maxlength="160" value="${escapeHtml(clip?.title || scene.title || "Cinematic clip")}">`)}
          ${field("Length (seconds)", `<input data-clip-seconds type="number" min="5" max="120" step="1" value="${Math.round(seconds)}">`)}
          ${field(kind === "time" ? "Time range" : "Range", `<select data-clip-range><option value="all"${custom ? "" : " selected"}>${kind === "none" ? "The whole ambient loop" : `Whole ${kind === "number" ? "range" : "timeline"} · ${escapeHtml(this.#cinematicValueText(first, { ...this.cinematicState, valueKind: kind }))} – ${escapeHtml(this.#cinematicValueText(last, { ...this.cinematicState, valueKind: kind }))}`}</option>${kind === "time" ? `<option value="custom"${custom ? " selected" : ""}>Custom start and end</option>` : ""}</select>`)}
          ${field("Camera motion", `<select data-clip-easing><option value="linear">Steady</option><option value="ease-in-out"${clip?.playback.easing === "ease-in-out" ? " selected" : ""}>Ease in and out</option></select>`)}
          ${field("Starts at", `<input data-clip-start type="datetime-local" step="1" min="${toLocal(first)}" max="${toLocal(last)}" value="${toLocal(clip ? Date.parse(clip.range.start) : first)}">`, ` data-clip-custom${custom ? "" : " hidden"}`)}
          ${field("Ends at", `<input data-clip-end type="datetime-local" step="1" min="${toLocal(first)}" max="${toLocal(last)}" value="${toLocal(clip ? Date.parse(clip.range.end) : last)}">`, ` data-clip-custom${custom ? "" : " hidden"}`)}
        </div>
        <fieldset class="briefing-field clip-cameras"><legend>Camera</legend>
          ${["start", "end"].map((key) => `<div class="clip-camera"><strong>${key === "start" ? "Start" : "End"}</strong><span data-clip-camera-text="${key}">${escapeHtml(cameraText(cameras[key]))}</span><button type="button" data-clip-camera-set="${key}">Use current view</button><button type="button" data-clip-camera-show="${key}">Show</button></div>`).join("")}
          <p class="form-note">Move the map, then set each end. The camera glides between them over the Clip's length.</p>
        </fieldset>
        <fieldset class="briefing-field clip-captions"><legend>Captions</legend><div data-clip-captions></div><button type="button" data-clip-caption-add>Add caption</button></fieldset>
        <div class="field-grid">${field("Poster frame (seconds)", `<input data-clip-poster type="number" min="0" step="0.5" value="${((clip?.posterMs || 0) / 1000).toFixed(1).replace(/\.0$/, "")}">`)}</div>
        <p class="form-note" data-clip-error role="alert"></p>`,
      actions: [{ label: "Cancel", handler: () => this.dialog.close() }, { label: clip ? "Save changes" : "Save Clip", primary: true, handler: () => save() }],
    });
    const root = this.dialog;
    const q = (selector) => root.querySelector(selector);
    const renderCaptions = () => {
      q("[data-clip-captions]").innerHTML = captions.length
        ? captions.map((caption, index) => `<div class="clip-caption" data-clip-caption="${index}"><input type="number" min="0" step="0.5" aria-label="Caption time in seconds" data-clip-caption-at value="${caption.seconds}"><input aria-label="Caption text" maxlength="500" data-clip-caption-text value="${escapeHtml(caption.text)}" placeholder="What the viewer should notice"><button type="button" class="briefing-link-button" data-clip-caption-remove aria-label="Remove caption">Remove</button></div>`).join("")
        : '<p class="form-note">No captions. Each caption shows from its time until the next one.</p>';
    };
    const readCaptions = () => {
      captions = [...root.querySelectorAll("[data-clip-caption]")].map((row) => ({ seconds: Number(row.querySelector("[data-clip-caption-at]").value) || 0, text: row.querySelector("[data-clip-caption-text]").value }));
    };
    renderCaptions();
    q("[data-clip-range]").addEventListener("change", (event) => root.querySelectorAll("[data-clip-custom]").forEach((label) => { label.hidden = event.target.value !== "custom"; }));
    q("[data-clip-caption-add]").addEventListener("click", () => { readCaptions(); captions.push({ seconds: captions.length ? Math.min(Number(q("[data-clip-seconds]").value) || seconds, captions.at(-1).seconds + 3) : 0, text: "" }); renderCaptions(); root.querySelectorAll("[data-clip-caption-text]")[captions.length - 1]?.focus(); });
    q("[data-clip-captions]").addEventListener("click", (event) => {
      const row = event.target.closest("[data-clip-caption-remove]")?.closest("[data-clip-caption]");
      if (!row) return;
      readCaptions(); captions.splice(Number(row.dataset.clipCaption), 1); renderCaptions();
    });
    root.querySelectorAll("[data-clip-camera-set]").forEach((button) => button.addEventListener("click", () => {
      const camera = asCamera(this.mapController.getViewState?.());
      if (!camera) return this.error("The map view could not be read.");
      cameras[button.dataset.clipCameraSet] = camera;
      q(`[data-clip-camera-text="${button.dataset.clipCameraSet}"]`).textContent = cameraText(camera);
    }));
    root.querySelectorAll("[data-clip-camera-show]").forEach((button) => button.addEventListener("click", () => {
      const camera = cameras[button.dataset.clipCameraShow];
      if (camera) void this.mapController.setView({ center: [camera.longitude, camera.latitude], zoom: camera.zoom, heading: camera.bearing, tilt: camera.pitch }, { animate: true });
    }));
    const save = () => {
      readCaptions();
      const fail = (message) => { q("[data-clip-error]").textContent = message; };
      const length = Number(q("[data-clip-seconds]").value);
      if (!(length >= 5 && length <= 120)) return fail("Choose a length from 5 to 120 seconds.");
      let range = null;
      if (q("[data-clip-range]").value === "custom") {
        const from = fromLocal(q("[data-clip-start]").value), to = fromLocal(q("[data-clip-end]").value);
        if (!Number.isFinite(from) || !Number.isFinite(to)) return fail("Set both the start and end of the time range.");
        if (to < from) return fail("The time range must end after it starts.");
        if (!ticks.some((tick) => tick >= from && tick <= to)) return fail("No observations fall inside that time range.");
        range = { start: new Date(from).toISOString(), end: new Date(to).toISOString() };
      }
      const poster = Number(q("[data-clip-poster]").value) || 0;
      if (poster < 0 || poster > length) return fail(`The poster frame must be between 0 and ${length} seconds.`);
      const saved = createCinematicClip({
        cinematic: scene, projectId: this.projectManager.current.id, observationTimes: ticks, title: q("[data-clip-title]").value.trim() || scene.title,
        options: {
          id: clip?.id, durationMs: length * 1000, range, easing: q("[data-clip-easing]").value, startCamera: cameras.start, endCamera: cameras.end, posterMs: poster * 1000,
          captions: captions.filter((caption) => caption.text.trim()).map((caption) => ({ atMs: Math.min(length, Math.max(0, caption.seconds)) * 1000, text: caption.text.trim() })),
        },
      });
      if (clip) Object.assign(saved, { createdAt: clip.createdAt, source: clip.source });
      const clips = [...(this.projectManager.current.presentation?.cinematicClips || []).filter((item) => item.id !== saved.id), saved];
      this.projectManager.patchPresentation({ cinematicClips: clips });
      this.lastCinematicClipId = saved.id;
      this.dialog.close();
      this.toast(clip ? `Clip “${saved.title}” updated.` : `Clip “${saved.title}” saved. Add it to a Brief or export a movie.`);
      this.#renderPresentationDashboard(this.projectManager.current.presentation);
    };
  }

  #downloadCinematicClip() {
    const clip = this.#currentCinematicClip();
    if (!clip) return;
    // A portable recipe: the Clip plus a summary, credits and what it needs to play elsewhere.
    const layers = {}, effectLabels = {};
    for (const track of clip.tracks.filter((item) => item.type === "temporalLayer")) {
      const layer = this.mapController.getLayer(track.layerRef);
      layers[track.layerRef] = { title: layer?.title, url: layer?.url };
      const type = track.animation?.effect?.type;
      const effect = type === "auto" ? suggestEffect({ title: layer?.title, geometryType: layer?.geometryType, fields: layer?.fields || [] }) : type;
      if (effect && effect !== "none") effectLabels[track.layerRef] = CINEMATIC_EFFECTS[effect]?.label || effect;
    }
    const recipe = buildClipPackage(clip, { layers, effectLabels, attribution: this.#mapAttributionText(), appVersion: APP_VERSION });
    const file = new Blob([JSON.stringify(recipe, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(file);
    link.download = `${String(clip.title || "cinematic-clip").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "cinematic-clip"}.gisclip`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 5000);
    this.toast(recipe.package.playableElsewhere ? "Clip JSON downloaded: a portable recipe that plays where its online services are reachable." : "Clip JSON downloaded. It uses local data that is not included, so it will not play elsewhere until that data is added.");
  }

  #addCinematicClipToBrief() {
    const clip = this.#currentCinematicClip();
    if (!clip) return;
    const slide = createSlide("cinematic", { title: clip.title, subtitle: "Observed playback" });
    // The slide keeps its own copy, so a shared Brief plays the Clip as captured.
    slide.clipRef = clip.id;
    slide.clip = exportCinematicClip(clip);
    const briefing = addSlide(normalizeBriefing(this.projectManager.current.presentation?.briefing), slide);
    this.projectManager.patchPresentation({ briefing });
    this.toast(`“${clip.title}” was added as an interactive Brief slide.`);
  }

  /** Poster PNG: the Clip's composed frame at its poster time, the same as that moment of the movie. */
  async #downloadCinematicPoster() {
    const clip = this.#currentCinematicClip();
    if (!clip) return;
    const restore = await this.#snapshotCinematicSession();
    try {
      this.cinematicController.pause();
      await this.cinematicController.load(clipToCinematicSpec(clip));
      const blob = await renderClipPoster({ clip, controller: this.cinematicController, mapController: this.mapController, attributionText: this.#mapAttributionText(), ...this.#clipFrameKey(clip) });
      await restore();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${String(clip.title || "cinematic-clip").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "cinematic-clip"}-poster.png`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 5000);
      this.toast(`Poster downloaded (frame at ${(clip.posterMs / 1000).toFixed(1)} s).`);
    } catch (error) {
      await restore();
      this.error(`Could not export poster: ${error.message}`);
    }
  }

  /**
   * Export movie: choose size, frame rate and a format this browser can
   * genuinely produce, render with progress and Cancel, preview, then
   * download. The live Cinematic session and map view are restored after.
   */
  #recordCinematicClip() {
    const clip = this.#currentCinematicClip();
    if (!clip) return;
    const seconds = clip.playback.durationMs / 1000;
    const field = (label, control) => `<label class="field"><span>${label}</span>${control}</label>`;
    this.openDialog({
      eyebrow: "Cinematic Clip",
      title: "Export movie",
      content: `<p class="form-note">Renders “${escapeHtml(clip.title)}” frame by frame: ${seconds.toFixed(0)} seconds, with the title, captions and map attribution drawn into the video.</p>
        <div class="field-grid">${field("Resolution", `<select data-export-size><option value="1280x720">720p · 1280 × 720</option><option value="1920x1080">1080p · 1920 × 1080</option></select>`)}${field("Frame rate", `<select data-export-fps>${CLIP_FRAME_RATES.map((fps) => `<option value="${fps}"${fps === 30 ? " selected" : ""}>${fps} fps</option>`).join("")}</select>`)}${field("Format", `<select data-export-format disabled><option>Checking this browser…</option></select>`)}</div>
        <p class="form-note" data-export-note></p>`,
      actions: [{ label: "Cancel", handler: () => this.dialog.close() }, { label: "Export", primary: true, handler: () => void start() }],
    });
    const root = this.dialog;
    const exportButton = [...root.querySelectorAll("#dialog-actions button")].at(-1);
    let formats = [];
    let controller = null;
    let objectUrl = null;
    const size = () => root.querySelector("[data-export-size]").value.split("x").map(Number);
    const refreshFormats = async () => {
      const select = root.querySelector("[data-export-format]");
      if (!select) return;
      const [width, height] = size();
      const fps = Number(root.querySelector("[data-export-fps]").value);
      exportButton.disabled = true;
      formats = await availableVideoFormats({ width, height, fps });
      // The dialog may have moved on (closed, or already exporting) while the browser was probed.
      if (!select.isConnected) return;
      select.innerHTML = formats.length ? formats.map((format, index) => `<option value="${index}">${escapeHtml(format.label)}</option>`).join("") : "<option>No supported video format</option>";
      select.disabled = !formats.length;
      exportButton.disabled = !formats.length;
      root.querySelector("[data-export-note]").textContent = formats.length
        ? formats[0].method === "webcodecs" ? "Frame-accurate: every frame is rendered, so the movie is exactly the Clip's length on any device." : "This browser records in real time: on a slow device some frames are skipped (the length stays right)."
        : "This browser cannot encode video. Use a current Chrome, Edge, Safari or Firefox, or download the Poster PNG and Clip JSON instead.";
    };
    root.querySelector("[data-export-size]").addEventListener("change", () => void refreshFormats());
    root.querySelector("[data-export-fps]").addEventListener("change", () => void refreshFormats());
    void refreshFormats();
    // Closing the dialog (Cancel, Esc or ×) stops a running export and frees the preview.
    root.addEventListener("close", () => { controller?.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); }, { once: true });

    const start = async () => {
      const format = formats[Number(root.querySelector("[data-export-format]")?.value) || 0];
      if (!format) return;
      const [width, height] = size();
      const fps = Number(root.querySelector("[data-export-fps]").value);
      const frames = clipFrameCount(clip.playback.durationMs, fps);
      controller = new AbortController();
      document.querySelector("#dialog-content").innerHTML = `<p class="form-note" data-export-stage>Preparing the Clip…</p><progress data-export-progress max="${frames}" value="0" style="width:100%"></progress><p class="form-note" data-export-count>0 of ${frames} frames</p>`;
      const footer = document.querySelector("#dialog-actions");
      footer.innerHTML = "";
      const cancel = document.createElement("button");
      cancel.type = "button"; cancel.textContent = "Cancel export";
      cancel.addEventListener("click", () => controller.abort());
      footer.append(cancel);
      const restore = await this.#snapshotCinematicSession();
      try {
        this.cinematicController.pause();
        await this.cinematicController.load(clipToCinematicSpec(clip));
        this.cinematicState = this.cinematicController.state();
        root.querySelector("[data-export-stage]").textContent = `Rendering ${format.container.toUpperCase()} at ${width} × ${height}, ${fps} fps…`;
        const result = await exportCinematicVideo({
          clip, controller: this.cinematicController, mapController: this.mapController, format, width, height, fps,
          attributionText: this.#mapAttributionText(), ...this.#clipFrameKey(clip), signal: controller.signal,
          onProgress: (done, total) => {
            const bar = root.querySelector("[data-export-progress]");
            if (bar) { bar.value = done; root.querySelector("[data-export-count]").textContent = `${done} of ${total} frames`; }
          },
        });
        await restore();
        if (!this.dialog.open) return;
        objectUrl = URL.createObjectURL(result.blob);
        const name = `${String(clip.title || "cinematic-clip").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "cinematic-clip"}${result.extension}`;
        const megabytes = (result.blob.size / 1048576).toFixed(1);
        document.querySelector("#dialog-content").innerHTML = `<video src="${objectUrl}" controls playsinline style="width:100%;max-height:52vh;background:#000"></video>
          <p class="form-note">${escapeHtml(result.mimeType)} · ${width} × ${height} · ${result.frames} frames · ${megabytes} MB${result.droppedFrames ? ` · ${result.droppedFrames} frames skipped by real-time recording` : ""}</p>`;
        footer.innerHTML = "";
        const close = document.createElement("button");
        close.type = "button"; close.textContent = "Close";
        close.addEventListener("click", () => this.dialog.close());
        const download = document.createElement("button");
        download.type = "button"; download.className = "button--primary"; download.textContent = `Download ${result.extension.slice(1).toUpperCase()}`;
        download.addEventListener("click", () => { const link = document.createElement("a"); link.href = objectUrl; link.download = name; link.click(); this.toast(`${name} downloaded.`); });
        footer.append(close, download);
      } catch (error) {
        await restore();
        if (error.name === "AbortError") { if (this.dialog.open) this.dialog.close(); this.toast("Movie export cancelled."); return; }
        if (this.dialog.open) this.dialog.close();
        this.error(`Could not export the movie: ${error.message}`);
      }
    };
  }

  /** Captures the live Cinematic session (spec, observation, view) and returns a function that puts it back. */
  async #snapshotCinematicSession() {
    const spec = this.cinematicState ? this.cinematicController.exportCinematicSpec?.() : null;
    const time = this.cinematicController.state?.()?.timeline?.observationTime;
    const view = this.mapController.getViewState?.();
    let restored = false;
    return async () => {
      if (restored) return;
      restored = true;
      try {
        if (spec?.cinematic) {
          await this.cinematicController.load(spec);
          if (Number.isFinite(time)) { this.cinematicController.seek(time); await this.cinematicController.renderTask; }
          this.cinematicState = this.cinematicController.state();
        }
        if (view) await this.mapController.setView(view, { animate: false });
      } catch (error) {
        this.error(`The Cinematic session could not be restored: ${error.message}`);
      }
      this.#renderPresentationDashboard(this.projectManager.current.presentation);
    };
  }

  /**
   * What a Clip frame's key shows (call after the Clip is loaded): the legend
   * of the Clip's own layers, and a note naming any effect as decoration.
   */
  #clipFrameKey(clip) {
    const refs = new Set(clip.tracks.filter((track) => track.type === "temporalLayer").map((track) => track.layerRef));
    let legend = [];
    try { legend = (this.mapController.getLegendData?.() || []).filter((layer) => refs.has(layer.uid)); } catch { /* No legend from this engine. */ }
    const effects = [...new Set((this.cinematicController.state()?.layers || []).map((layer) => layer.effect).filter((effect) => effect && effect !== "none"))];
    // Each track's progression is labelled in the movie too (Observed, Modeled, Illustrative…).
    const statuses = [...new Set((this.cinematicController.state()?.layers || []).map((layer) => layer.provenance).filter(Boolean))];
    const shownAs = statuses.length ? `Shown as ${statuses.join(", ")}` : "";
    const effectNote = [effects.length ? `${effects.map((effect) => CINEMATIC_EFFECTS[effect]?.label || effect).join(", ")}: decorative, not data` : "", shownAs].filter(Boolean).join(" · ");
    return { legend, effectNote };
  }

  /** The engine's credits for the basemap, terrain and visible data, so exported frames credit the real providers. */
  #mapAttributionText() {
    try { return this.mapController.getAttributionText?.() || ""; } catch { return ""; }
  }

  /**
   * Plays a Cinematic slide: its own Clip copy (else the project's), as
   * interactive playback whose camera follows the Clip's path, or as a poster
   * still. A token makes a slow load give way when the viewer has moved on,
   * so returning to a slide reinitializes it once and never plays twice.
   */
  async #playBriefingCinematicClip(slide, { autoplay = false } = {}) {
    const clip = slide?.clip || this.projectManager.current.presentation?.cinematicClips?.find((item) => item.id === slide?.clipRef);
    if (!clip) throw new Error("This Brief slide refers to a Clip that is not in the project.");
    // Play on the slide already loaded resumes it rather than starting over.
    if (this.briefingClip?.slideId === slide.id && this.cinematicController.timeline) {
      if (autoplay && slide.presentation !== "poster") {
        // Play is also a replay control once a non-looping Clip has finished.
        if (this.cinematicController.timeline.state()?.progress >= 0.999) this.cinematicController.seekObservation(0);
        this.cinematicController.play();
      }
      return;
    }
    const token = await this.#stopBriefingCinematicClip();
    // One load at a time on the shared controller: quick slide changes queue, and a superseded one is skipped.
    const previous = this.briefingClipLoading;
    let release;
    this.briefingClipLoading = new Promise((resolve) => { release = resolve; });
    let state;
    try {
      await previous;
      if (token !== this.briefingClipToken) return;
      const spec = clipToCinematicSpec(clip);
      spec.cinematic.clock.loop = slide.loop === true;
      state = await this.cinematicController.load(spec);
      if (token !== this.briefingClipToken) { await this.cinematicController.destroy(); return; }
    } finally { release(); }
    this.cinematicState = state;
    this.briefingClip = { slideId: slide.id, clip };
    const durationMs = clip.playback.durationMs;
    const showAt = async (ms) => {
      const camera = cameraAt(clip.cameraTrack, ms, clip.playback.easing);
      if (camera) await this.mapController.setView(camera, { animate: false });
    };
    if (slide.presentation === "poster") {
      this.cinematicController.seekObservation(observationIndexAt(clip.posterMs, durationMs, state.timeline.ticks.length));
      await this.cinematicController.renderTask;
      await showAt(clip.posterMs);
      return;
    }
    await showAt(0);
    // While it plays, the camera follows the Clip; paused, the viewer may move the map.
    const follow = () => {
      if (token !== this.briefingClipToken) return;
      const timeline = this.cinematicController.timeline?.state();
      if (timeline?.playing) void showAt(timeline.progress * durationMs);
      this.briefingClipFrame = requestAnimationFrame(follow);
    };
    this.briefingClipFrame = requestAnimationFrame(follow);
    if (autoplay && !matchMedia("(prefers-reduced-motion: reduce)").matches) this.cinematicController.play();
  }

  /** Stops a playing Cinematic slide and returns the token for whatever plays next. */
  async #stopBriefingCinematicClip() {
    this.briefingClipToken = (this.briefingClipToken || 0) + 1;
    const token = this.briefingClipToken;
    cancelAnimationFrame(this.briefingClipFrame);
    this.briefingClip = null;
    if (this.cinematicState) {
      await this.cinematicController.destroy();
      this.cinematicState = null;
    }
    return token;
  }

  #playAtlasStory(chapters, startIndex = 0) {
    if (!chapters.length) return;
    const token = ++this.atlasPlaybackToken;
    this.presentationState.atlasPlaying = true;
    this.#renderPresentationDashboard(this.projectManager.current.presentation || {});
    const advance = (index) => {
      if (token !== this.atlasPlaybackToken) return;
      const chapter = chapters[index];
      if (!chapter) return this.#stopAtlasStory();
      // Camera motion is deliberately non-blocking: a slow or interrupted
      // SceneView animation must never prevent the saved linger timer from
      // moving the story on to the next chapter.
      void this.#goToAtlasChapter(chapter, index, chapters).catch(() => {});
      const linger = Math.min(120, Math.max(1, Number(chapter.lingerSeconds) || 4)) * 1000;
      this.atlasPlaybackTimer = setTimeout(() => {
        if (token !== this.atlasPlaybackToken) return;
        if (index >= chapters.length - 1) this.#stopAtlasStory();
        else advance(index + 1);
      }, linger);
    };
    advance(Math.max(0, Math.min(chapters.length - 1, startIndex)));
  }

  /**
   * Undo everything a presentation mode did to the shared map and overlays, so
   * the next mode (or the plain map) starts clean.
   */
  #leavePresentationMode() {
    clearTimeout(this.presentationSearchTimer);
    this.briefingRequest.cancel();
    document.querySelector("#briefing-context-host")?.replaceChildren();
    document.body.classList.remove("mobile-briefing-context-open");
    delete document.body.dataset.briefingContextDock;
    const layer = this.mapController.getLayer(this.presentationState.layerUid);
    if (layer) void this.mapController.setFeatureFilter(layer.uid, null);
    this.mapController.clearFeatureHighlight();
  }

  #applyPresentation(presentation = {}) {
    const nextTemplate = presentation.template || "standard";
    if (nextTemplate !== "cinematic" && this.cinematicState) {
      // Remember where playback was, so returning from another mode resumes there.
      this.cinematicResume = { id: this.cinematicState.spec?.cinematic.id, time: this.cinematicController.state()?.timeline?.observationTime };
      void this.#leaveCinematic();
    }
    if (nextTemplate === "cinematic" && presentation.cinematic && !this.cinematicState && !this.cinematicLoading) {
      this.cinematicLoading = this.cinematicController.load({ cinematic: presentation.cinematic })
        .then(async (state) => {
          const resume = this.cinematicResume;
          this.cinematicResume = null;
          if (resume?.id === presentation.cinematic.id && Number.isFinite(resume.time)) {
            this.cinematicController.seek(resume.time);
            await this.cinematicController.renderTask;
            state = this.cinematicController.state();
          }
          this.cinematicState = state;
          this.#renderPresentationDashboard(this.projectManager.current.presentation);
        })
        .catch((error) => this.error(`Cinematic playback could not start: ${error.message}`))
        .finally(() => { this.cinematicLoading = null; });
    }
    if ((presentation.template || "standard") !== "briefing") this.#teardownBriefingV2();
    const app = document.querySelector("#app");
    const template = presentation.template || "standard";
    if (template === "standard" || template !== this.presentationState.template) this.#leavePresentationMode();
    app.dataset.presentation = template;
    if (template !== "briefing") document.body.classList.remove("briefing-map-select");
    const skin = presentation.skin ?? this.projectManager.current.presentation?.skin;
    applyInterfaceSkin(skin, { colors: (presentation.skinColors ?? this.projectManager.current.presentation?.skinColors)?.[normalizeSkin(skin)] });
    this.syncBasemapTheme?.();
    document.body.dataset.presentation = template;
    if (template === "atlas") {
      const activeIndex = Number.isInteger(this.presentationState.atlasChapterIndex) ? this.presentationState.atlasChapterIndex : null;
      this.mapController.setTourMarkers(presentation.chapters || [], activeIndex);
    } else {
      this.mapController.clearTourMarkers();
    }
    document.querySelector("#presentation-status")?.remove();
    const welcomePanel = document.querySelector("#welcome-panel");
    let context = document.querySelector("#presentation-context");
    let dashboard = document.querySelector("#presentation-dashboard");
    if (!dashboard) {
      dashboard = document.createElement("section");
      dashboard.id = "presentation-dashboard";
      dashboard.hidden = true;
      document.querySelector(".sidebar__scroll")?.prepend(dashboard);
    }
    this.panelManager?.register("presentation:dashboard", dashboard);
    document.querySelectorAll(".sidebar__scroll > .panel[data-presentation-hidden]").forEach((panel) => {
      panel.hidden = false;
      delete panel.dataset.presentationHidden;
    });
    if (template === "standard") {
      clearTimeout(this.presentationSearchTimer);
      context?.remove();
      dashboard.replaceChildren();
      dashboard.hidden = true;
      this.presentationState = { template: "standard", records: [], visibleRecords: [], selected: null, selectedIds: new Set(), layerUid: null, search: "", category: "" };
      this.#hideAtlasChapterOverlay();
      this.#syncPresentationMobileControls(presentation);
      if (welcomePanel) welcomePanel.hidden = welcomePanel.dataset.dismissed === "true" && welcomePanel.dataset.reopened !== "true";
      return;
    }
    // Choosing a workflow means the visitor has engaged; the introduction stays dismissed.
    this.#dismissWelcome();
    if (this.mobileMedia.matches) this.#setSidebarCollapsed(false);
    if (template !== "atlas") this.#hideAtlasChapterOverlay();
    this.presentationState.template = template;
    context?.remove();
    document.querySelectorAll(".sidebar__scroll > .panel").forEach((panel) => {
      panel.dataset.presentationHidden = "true";
      panel.hidden = true;
    });
    this.presentationLoading = this.#loadPresentationRecords(presentation);
  }

  #applicationBuilderDialog(startingPreset = null) {
    const previous = this.projectManager.current.application?.configured
      ? structuredClone(this.projectManager.current.application)
      : null;
    let draft = normalizeApplicationConfig(startingPreset ? presetApplication(startingPreset) : (previous || presetApplication("standard")));
    let previewing = false;
    let builderFinished = false;
    const panelTypes = this.applicationRuntime.panels.list();
    const layers = this.mapController.getLayers();
    const dashboardViews = [
      { id: "standard", label: "Classic workspace", description: "All core tools in a familiar left workspace.", preview: "left" },
      { id: "explorer", label: "Data explorer", description: "Browse at left, inspect at right, chart below.", preview: "three" },
      { id: "briefing", label: "Briefing room", description: "Situation tools and selected details frame the map.", preview: "briefing" },
      { id: "atlas", label: "Guided atlas", description: "Chapters and saved places with detail at right.", preview: "atlas" },
      { id: "operations", label: "Operations board", description: "Layers and intelligence with a live bottom deck.", preview: "operations" },
      { id: "ai-map", label: "AI copilot", description: "A map-first workspace with the assistant at right.", preview: "right" },
      { id: "globe", label: "Orbital globe", description: "A circular full-Earth view framed by curved tool rails.", preview: "globe" },
    ];
    const presetLabels = Object.fromEntries(dashboardViews.map((view) => [view.id, view.label]));
    let draggedInstanceId = null;
    const render = () => {
      const root = this.dialog.querySelector("[data-application-builder]");
      if (!root) return;
      const availabilityFor = (panel) => panel.availability({ layers, draft });
      const usablePanels = panelTypes.filter((panel) => panel.status !== "planned" && availabilityFor(panel).available);
      const unavailablePanels = panelTypes.filter((panel) => panel.status === "planned" || !availabilityFor(panel).available);
      const galleryCard = (panel, hidden = false) => {
        const availability = availabilityFor(panel);
        const added = !panel.multiple && draft.panels.some((item) => item.type === panel.type);
        const disabled = hidden || added;
        const reason = added ? "Already added to this dashboard." : availability.reason || panel.description;
        return `<button type="button" data-builder-add="${escapeHtml(panel.type)}"${disabled ? " disabled" : ""} title="${escapeHtml(reason)}"><span><strong>${disabled ? "" : "+ "}${escapeHtml(panel.displayName)}</strong><em>${added ? "Added" : panel.status === "planned" ? "Planned" : hidden ? "Unavailable" : "Ready"}</em></span><small>${escapeHtml(reason)}</small></button>`;
      };
      const panelRows = draft.panels.map((panel) => {
        const panelIndex = draft.panels.indexOf(panel);
        const boundLayer = this.mapController.getLayer(panel.binding?.layerId) || layers[0];
        const fields = boundLayer?.fields || [];
        const fieldControl = ["charts", "attributes"].includes(panel.type) && fields.length
          ? `<select data-builder-field aria-label="Field configuration"><option value="">Automatic field</option>${fields.map((field) => `<option value="${escapeHtml(field.name)}"${panel.settings?.field === field.name ? " selected" : ""}>${escapeHtml(field.alias || field.name)}</option>`).join("")}</select>`
          : "";
        return `<div class="application-builder__instance" data-builder-instance="${escapeHtml(panel.instanceId)}"><button type="button" class="application-builder__drag" data-builder-drag draggable="true" aria-label="Drag ${escapeHtml(panel.title)} to reorder" title="Drag to reorder">⠿</button><label class="application-builder__instance-title"><span>Panel</span><input data-builder-panel-title value="${escapeHtml(panel.title)}" /></label><label><span>Position</span><select data-builder-region aria-label="Panel placement">${["left", "right", "bottom", "floating"].map((region) => `<option value="${region}"${panel.placement.region === region ? " selected" : ""}>${region === "floating" ? "Floating" : `${region[0].toUpperCase()}${region.slice(1)} dock`}</option>`).join("")}</select></label><label><span>Dataset</span><select data-builder-layer aria-label="Dataset binding"><option value="">Follow active layer</option>${layers.map((layer) => `<option value="${escapeHtml(layer.uid)}"${panel.binding?.layerId === layer.uid ? " selected" : ""}>${escapeHtml(layer.title || "Untitled layer")}</option>`).join("")}</select></label>${fieldControl ? `<label><span>Field</span>${fieldControl}</label>` : ""}<label class="application-builder__audience"><input data-builder-audience type="checkbox"${panel.audienceVisible ? " checked" : ""} /> Show to audience</label><span class="application-builder__order"><button type="button" class="button--quiet" data-builder-up aria-label="Move ${escapeHtml(panel.title)} earlier"${panelIndex === 0 ? " disabled" : ""}>↑</button><button type="button" class="button--quiet" data-builder-down aria-label="Move ${escapeHtml(panel.title)} later"${panelIndex === draft.panels.length - 1 ? " disabled" : ""}>↓</button></span><button type="button" class="button--quiet application-builder__remove" data-builder-remove aria-label="Remove ${escapeHtml(panel.title)}">Remove</button></div>`;
      }).join("");
      root.innerHTML = `<section class="application-builder__views"><div><h3>Choose a dashboard view</h3><p>Start with a recognizable arrangement, then fine-tune it below.</p></div><div class="application-builder__view-grid">${dashboardViews.map((view) => `<button type="button" class="application-builder__view${draft.preset === view.id ? " is-selected" : ""}" data-builder-preset="${view.id}" aria-pressed="${draft.preset === view.id}"><span class="application-builder__view-preview application-builder__view-preview--${view.preview}"><i></i><i></i><i></i><i></i></span><strong>${view.label}</strong><small>${view.description}</small></button>`).join("")}</div></section><div class="application-builder__top"><label class="field"><span>Dashboard title</span><input data-builder-title value="${escapeHtml(draft.title)}" placeholder="Wildfire briefing" /></label><label class="field"><span>Skin</span><select data-builder-skin>${skinOptionsMarkup(draft.skin)}</select></label><label class="field"><span>View</span><select data-builder-mode><option value="edit"${draft.mode === "edit" ? " selected" : ""}>Edit</option><option value="present"${draft.mode === "present" ? " selected" : ""}>Present</option></select></label></div><div class="application-builder__section"><div><h3>Dashboard panels</h3><p class="application-builder__hint">Drag rows to reorder them. Position sends a panel to the left, right, bottom, or a floating window.</p></div><div class="application-builder__instances">${panelRows || `<p class="application-builder__notice">Add at least one panel. The map and project data remain available even when no panels are shown.</p>`}</div></div><div class="application-builder__section"><h3>Add a working panel</h3><div class="application-builder__gallery">${usablePanels.map((panel) => galleryCard(panel)).join("")}</div>${unavailablePanels.length ? `<details class="application-builder__roadmap"><summary>Unavailable and planned panels (${unavailablePanels.length})</summary><p>These stay hidden until their required data or implementation is available.</p><div class="application-builder__gallery">${unavailablePanels.map((panel) => galleryCard(panel, true)).join("")}</div></details>` : ""}</div><p class="application-builder__notice">Panel settings live here instead of on every dashboard panel. Removing a panel removes only its interface; project layers, drawings, filters, and saved analysis remain.</p><div class="application-builder__secondary-actions"><button type="button" class="button--quiet" data-builder-reset-layout>Reset positions</button><button type="button" class="button--quiet" data-builder-save-copy>Save as new dashboard</button></div>`;
      const layoutField = document.createElement("label");
      layoutField.className = "field";
      layoutField.innerHTML = `<span>Layout behavior</span><select data-builder-layout><option value="workspace">Workspace docks</option><option value="bottom-nav">Bottom navigation</option><option value="bottom-workspace">Bottom workspace</option><option value="ai-map">Map + right assistant</option><option value="globe">Orbital globe</option></select>`;
      root.querySelector(".application-builder__top").append(layoutField);
      layoutField.querySelector("select").value = draft.layout.kind;
      const resetLayout = root.querySelector("[data-builder-reset-layout]");
      const syncDraft = () => {
        draft.title = root.querySelector("[data-builder-title]").value.trim() || presetLabels[draft.preset];
        draft.skin = root.querySelector("[data-builder-skin]").value;
        draft.mode = root.querySelector("[data-builder-mode]").value;
        draft.layout = { ...draft.layout, kind: root.querySelector("[data-builder-layout]").value };
        root.querySelectorAll("[data-builder-instance]").forEach((row, index) => {
          const panel = draft.panels.find((item) => item.instanceId === row.dataset.builderInstance);
          if (!panel) return;
          panel.title = row.querySelector("[data-builder-panel-title]").value.trim() || panel.title;
          panel.placement = { ...panel.placement, region: row.querySelector("[data-builder-region]").value, order: index };
          const layerId = row.querySelector("[data-builder-layer]").value;
          panel.binding = layerId ? { ...panel.binding, layerId, followActiveLayer: false } : { ...panel.binding, layerId: null, followActiveLayer: true };
          const field = row.querySelector("[data-builder-field]")?.value;
          if (field !== undefined) panel.settings = { ...panel.settings, field: field || null };
          panel.audienceVisible = row.querySelector("[data-builder-audience]").checked;
        });
      };
      root.querySelectorAll("[data-builder-preset]").forEach((button) => button.addEventListener("click", () => {
        syncDraft();
        const title = draft.title;
        const skin = draft.skin;
        draft = presetApplication(button.dataset.builderPreset);
        if (title && title !== presetLabels[previous?.preset]) draft.title = title;
        draft.skin = skin;
        render();
      }));
      ["[data-builder-title]", "[data-builder-skin]", "[data-builder-mode]", "[data-builder-layout]"].forEach((selector) => root.querySelector(selector).addEventListener("change", syncDraft));
      resetLayout.addEventListener("click", () => {
        const preset = presetApplication(draft.preset);
        draft.layout = structuredClone(preset.layout);
        draft.panels = draft.panels.map((panel, order) => ({ ...panel, placement: { region: this.applicationRuntime.panels.get(panel.type)?.placements?.[0] || "left", order, size: { width: 360, height: 300 }, position: { x: 24 + order * 24, y: 80 + order * 24 } } }));
        render();
      });
      root.querySelectorAll("[data-builder-instance]").forEach((row) => {
        row.querySelectorAll("input, select").forEach((control) => control.addEventListener("change", syncDraft));
        row.querySelector("[data-builder-remove]").addEventListener("click", () => {
          syncDraft();
          draft.panels = draft.panels.filter((panel) => panel.instanceId !== row.dataset.builderInstance);
          render();
        });
        const move = (offset) => {
          syncDraft();
          const index = draft.panels.findIndex((panel) => panel.instanceId === row.dataset.builderInstance);
          const target = index + offset;
          if (index < 0 || target < 0 || target >= draft.panels.length) return;
          [draft.panels[index], draft.panels[target]] = [draft.panels[target], draft.panels[index]];
          render();
        };
        row.querySelector("[data-builder-up]")?.addEventListener("click", () => move(-1));
        row.querySelector("[data-builder-down]")?.addEventListener("click", () => move(1));
        const dragHandle = row.querySelector("[data-builder-drag]");
        const reorderAt = (sourceId, targetId) => {
          syncDraft();
          const sourceIndex = draft.panels.findIndex((item) => item.instanceId === sourceId);
          const targetIndex = draft.panels.findIndex((item) => item.instanceId === targetId);
          if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return false;
          const [moved] = draft.panels.splice(sourceIndex, 1);
          draft.panels.splice(targetIndex, 0, moved);
          draft.panels.forEach((item, index) => { item.placement.order = index; });
          draggedInstanceId = null;
          render();
          return true;
        };
        dragHandle?.addEventListener("pointerdown", (event) => {
          if (event.button !== 0) return;
          event.preventDefault();
          draggedInstanceId = row.dataset.builderInstance;
          row.classList.add("is-dragging");
          const movePointer = (moveEvent) => {
            root.querySelectorAll(".is-drag-target").forEach((item) => item.classList.remove("is-drag-target"));
            document.elementFromPoint(moveEvent.clientX, moveEvent.clientY)?.closest?.("[data-builder-instance]")?.classList.add("is-drag-target");
          };
          const releasePointer = (upEvent) => {
            globalThis.removeEventListener("pointermove", movePointer);
            globalThis.removeEventListener("pointerup", releasePointer);
            const target = document.elementFromPoint(upEvent.clientX, upEvent.clientY)?.closest?.("[data-builder-instance]");
            if (!target || !reorderAt(row.dataset.builderInstance, target.dataset.builderInstance)) {
              draggedInstanceId = null;
              row.classList.remove("is-dragging");
              root.querySelectorAll(".is-drag-target").forEach((item) => item.classList.remove("is-drag-target"));
            }
          };
          globalThis.addEventListener("pointermove", movePointer);
          globalThis.addEventListener("pointerup", releasePointer);
        });
        dragHandle?.addEventListener("dragstart", (event) => {
          syncDraft();
          draggedInstanceId = row.dataset.builderInstance;
          row.classList.add("is-dragging");
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", draggedInstanceId);
        });
        dragHandle?.addEventListener("dragend", () => {
          draggedInstanceId = null;
          row.classList.remove("is-dragging");
          root.querySelectorAll(".is-drag-target").forEach((item) => item.classList.remove("is-drag-target"));
        });
        row.addEventListener("dragover", (event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; row.classList.add("is-drag-target"); });
        row.addEventListener("dragleave", () => row.classList.remove("is-drag-target"));
        row.addEventListener("drop", (event) => {
          event.preventDefault();
          const sourceId = draggedInstanceId || event.dataTransfer.getData("text/plain");
          reorderAt(sourceId, row.dataset.builderInstance);
        });
      });
      root.querySelectorAll("[data-builder-add]").forEach((button) => button.addEventListener("click", () => {
        syncDraft();
        const definition = this.applicationRuntime.panels.get(button.dataset.builderAdd);
        const count = draft.panels.filter((panel) => panel.type === definition.type).length + 1;
        draft.panels.push({ instanceId: `${definition.type}-${crypto.randomUUID?.() || Date.now()}`, type: definition.type, title: count > 1 ? `${definition.displayName} ${count}` : definition.displayName, placement: { region: definition.placements[0], order: draft.panels.length }, binding: { followActiveLayer: true }, settings: structuredClone(definition.defaults || {}), audienceVisible: true });
        render();
      }));
      root.querySelector("[data-builder-save-copy]").addEventListener("click", () => {
        syncDraft();
        const copy = normalizeApplicationConfig({ ...draft, configured: true, title: `${draft.title} copy` });
        this.projectManager.current.applications ??= [];
        this.projectManager.current.applications.push(copy);
        builderFinished = true;
        this.projectManager.setApplication(copy);
        this.dialog.close();
        this.toast(`Saved “${copy.title}” as a new presentation.`);
      });
      root.syncDraft = syncDraft;
    };
    this.openDialog({
      eyebrow: "Account workspace",
      title: "Dashboard Builder",
      content: `<div class="application-builder" data-application-builder></div>`,
      actions: [
        { label: "Cancel", handler: () => { builderFinished = true; if (previewing) this.applicationRuntime.cancelPreview(); else if (!previous) this.applicationRuntime.deactivate(); this.dialog.close(); } },
        { label: "Reset", handler: () => { draft = presetApplication(draft.preset); render(); } },
        { label: "Preview", handler: () => { this.dialog.querySelector("[data-application-builder]").syncDraft?.(); this.applicationRuntime.apply(draft, { preview: true }); previewing = true; this.toast("Preview applied. Cancel restores the prior application."); } },
        { label: "Save", primary: true, handler: () => { this.dialog.querySelector("[data-application-builder]").syncDraft?.(); builderFinished = true; const saved = this.projectManager.setApplication(draft); this.applicationRuntime.commitPreview(); this.dialog.close(); this.toast(`Application “${saved.title}” saved.`); } },
      ],
    });
    this.dialog.addEventListener("close", () => {
      if (builderFinished || !previewing) return;
      this.applicationRuntime.cancelPreview();
    }, { once: true });
    render();
  }

  #dashboardBuilderComingSoon() {
    this.openDialog({
      eyebrow: "Account feature · coming soon",
      title: "Dashboard Builder",
      content: `<div class="dashboard-builder-gate"><p>Dashboard Builder is the signed-in authoring workspace for custom panel layouts, data bindings, and reusable applications.</p><p>Choose Briefing or Tours from <strong>Modes</strong>, and use Instant Dashboard to choose a look.</p><ul><li>Free now: Map tools, Briefing, Tours, and Field Tasks</li><li>With an account: custom dashboards and advanced operational workflows</li></ul></div>`,
      actions: [{ label: "Close", primary: true, handler: () => this.dialog.close() }],
    });
  }

  /** `draft` carries an unsaved skin choice across the engine switch offered in the dialog. */
  #presentationDialog(draft = null) {
    const previous = structuredClone(this.projectManager.current.presentation || {});
    const current = { template: "standard", skin: DEFAULT_SKIN, ...previous, ...draft };
    const palettes = structuredClone(current.skinColors || {});
    const mapPalettes = structuredClone(current.mapColors || {});
    const maplibre = this.mapController.getEngineId() === "maplibre";
    if (maplibre) this.mapColorPreview = mapPalettes;
    let applied = false;
    this.openDialog({
      eyebrow: "Dashboard",
      title: "Instant Dashboard",
      content: `<div class="presentation-picker"><p class="form-note">Choose a look for your map and dashboard. Your mode, layers, map symbols, and camera stay as they are.</p><fieldset class="skin-picker"><legend>Dashboard skin</legend>${INTERFACE_SKINS.map(({ id,label,description }) => `<button type="button" class="skin-card skin-card--${id}" data-skin-choice="${id}" aria-pressed="false"><span class="skin-mini"><i></i><b></b><em></em><small></small></span><strong>${label}</strong><small>${description}</small></button>`).join("")}<select id="presentation-skin" hidden>${skinOptionsMarkup(current.skin)}</select></fieldset><fieldset class="skin-customize"><legend>Customize skin colors</legend><p class="form-note">Adjust the interface accents. Colors are saved with this project.</p><div>${["primary", "secondary", "tertiary"].map((name) => `<label><span>${name[0].toUpperCase() + name.slice(1)}</span><input type="color" data-skin-color="${name}" aria-label="${name} color"></label>`).join("")}</div><button type="button" class="button--quiet" data-skin-reset>Reset colors</button></fieldset>${maplibre ? `<fieldset class="skin-customize map-color-customize"><legend>Customize map colors</legend><p class="form-note">Choose which components to override for this skin. These colors apply to the MapLibre Skin basemap, including 3D buildings—not imagery, other basemaps, or your data layers. Colors are saved with this project. Selecting the Skin basemap changes the map immediately, even if you cancel. Check label contrast after changing colors.</p><button type="button" class="button--quiet" data-use-skin-basemap>Use Skin basemap</button><div>${Object.entries(MAP_COLOR_COMPONENTS).map(([key, label]) => `<label><input type="checkbox" data-map-toggle="${key}"><span>${label}</span><input type="color" data-map-color="${key}" aria-label="${label} color"></label>`).join("")}</div><button type="button" class="button--quiet" data-map-reset>Reset map colors</button></fieldset>` : `<fieldset class="skin-customize map-engine-offer"><legend>Customize map colors</legend><p class="form-note">Map colors for land, water, roads, buildings, parks and labels can be set on the MapLibre engine. Switching keeps this page, your layers and the camera; layers stored only in this browser stay on ArcGIS.</p><button type="button" class="button--quiet" data-switch-maplibre>Switch to MapLibre</button></fieldset>`}</div>`,
      actions: [
        { label: "Cancel", handler: () => this.dialog.close() },
        { label: "Apply", primary: true, handler: () => {
          const skin = this.dialog.querySelector("#presentation-skin").value;
          this.projectManager.patchPresentation({ skin, skinColors: palettes, ...(maplibre ? { mapColors: mapPalettes } : {}) });
          applied = true;
          this.mapColorPreview = null;
          applyInterfaceSkin(skin, { colors: palettes[skin] });
          this.syncBasemapTheme?.();
          this.dialog.close();
          this.toast("Dashboard skin applied.");
        } },
      ],
    });
    // Closing by any route (Cancel, ×, Escape) restores the previous appearance.
    const session = this.dialogSession;
    this.dialog.addEventListener("close", () => {
      if (!applied && session === this.dialogSession) {
        this.mapColorPreview = null;
        applyInterfaceSkin(previous.skin, { colors: previous.skinColors?.[normalizeSkin(previous.skin)] });
        this.syncBasemapTheme?.();
      }
    }, { once: true });
    const skin = this.dialog.querySelector("#presentation-skin");
    skin.value = current.skin;
    const chooseSkin = (value) => {
      skin.value = value;
      this.dialog.querySelectorAll("[data-skin-choice]").forEach((card) => {
        const selected = card.dataset.skinChoice === value;
        card.classList.toggle("is-selected", selected);
        card.setAttribute("aria-pressed", String(selected));
      });
      applyInterfaceSkin(skin.value, { colors: palettes[skin.value] });
      const style = getComputedStyle(document.documentElement);
      for (const [name, token] of [["primary", "--green"], ["secondary", "--green-2"], ["tertiary", "--amber"]]) {
        const value = style.getPropertyValue(token).trim();
        const rgb = value.match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
        const hex = /^#[0-9a-f]{6}$/i.test(value) ? value : /^#[0-9a-f]{3}$/i.test(value) ? `#${[...value.slice(1)].map((digit) => digit + digit).join("")}` : rgb ? `#${rgb.slice(1, 4).map((part) => Number(part).toString(16).padStart(2, "0")).join("")}` : "#000000";
        this.dialog.querySelector(`[data-skin-color="${name}"]`).value = hex;
      }
      if (maplibre) {
        const base = themeFromComputedStyle(style, { skin: value, dark: skinIsDark(value, document.documentElement.dataset.theme) });
        const defaults = { land: base.land, water: base.water, roads: base.roadMinor, buildings: base.building, vegetation: base.park, labels: base.label };
        for (const key of Object.keys(MAP_COLOR_COMPONENTS)) {
          const color = this.dialog.querySelector(`[data-map-color="${key}"]`);
          const toggle = this.dialog.querySelector(`[data-map-toggle="${key}"]`);
          toggle.checked = Boolean(mapPalettes[value]?.[key]);
          color.disabled = !toggle.checked;
          color.value = mapPalettes[value]?.[key] || defaults[key];
        }
        this.syncBasemapTheme?.();
      }
    };
    this.dialog.querySelectorAll("[data-skin-choice]").forEach((card) => card.addEventListener("click", () => chooseSkin(card.dataset.skinChoice)));
    this.dialog.querySelectorAll("[data-skin-color]").forEach((input) => input.addEventListener("input", () => {
      palettes[skin.value] = Object.fromEntries([...this.dialog.querySelectorAll("[data-skin-color]")].map((field) => [field.dataset.skinColor, field.value]));
      applyInterfaceSkin(skin.value, { colors: palettes[skin.value] });
    }));
    this.dialog.querySelector("[data-skin-reset]").addEventListener("click", () => { delete palettes[skin.value]; chooseSkin(skin.value); });
    if (maplibre) {
      const updateMapColors = () => {
        mapPalettes[skin.value] = Object.fromEntries([...this.dialog.querySelectorAll("[data-map-color]")]
          .filter((field) => this.dialog.querySelector(`[data-map-toggle="${field.dataset.mapColor}"]`).checked)
          .map((field) => [field.dataset.mapColor, field.value]));
        this.dialog.querySelectorAll("[data-map-color]").forEach((field) => { field.disabled = !this.dialog.querySelector(`[data-map-toggle="${field.dataset.mapColor}"]`).checked; });
        this.syncBasemapTheme?.();
      };
      this.dialog.querySelectorAll("[data-map-toggle]").forEach((field) => field.addEventListener("change", updateMapColors));
      this.dialog.querySelectorAll("[data-map-color]").forEach((field) => field.addEventListener("input", updateMapColors));
      this.dialog.querySelector("[data-map-reset]").addEventListener("click", () => { delete mapPalettes[skin.value]; chooseSkin(skin.value); });
      this.dialog.querySelector("[data-use-skin-basemap]").addEventListener("click", () => {
        this.mapController.setBasemap(SKIN_BASEMAP);
        this.toast("Skin basemap selected.");
      });
    } else {
      this.dialog.querySelector("[data-switch-maplibre]").addEventListener("click", async () => {
        const draftSkin = { skin: skin.value, skinColors: palettes };
        this.dialog.close();
        await this.#switchEngine("maplibre");
        this.#presentationDialog(draftSkin);
      });
    }
    chooseSkin(normalizeSkin(current.skin));
  }

  #openGuidedTours() {
    const current = this.projectManager.current.presentation || {};
    const returningToTour = current.template === "atlas";
    const presentation = this.projectManager.setPresentation({
      ...current,
      template: "atlas",
      title: current.modeTitles?.atlas || (returningToTour ? current.title : "") || "Guided places",
      chapters: Array.isArray(current.chapters) ? current.chapters : [],
    });
    this.atlasPlaybackToken += 1;
    clearTimeout(this.atlasPlaybackTimer);
    this.atlasPlaybackTimer = null;
    this.presentationState.atlasPlaying = false;
    this.presentationState.atlasPresent = false;
    this.mobileAtlasSettingsOpen = false;
    this.#applyPresentation(presentation);
    if (this.utilityPresentationOpen) this.#syncUtilityPanel("presentation");
    this.#setSidebarCollapsed(false);
    this.events.publish("mobile:workflow-route", { route: "tours" });
    this.toast(returningToTour ? "Guided tour opened." : "Guided tours ready. Add a chapter to begin.");
  }

  /** Field notes from the phone's More screen (and any caller outside the menus). */
  openFieldNotes() {
    this.#leaveMobileWorkflowScreen();
    openMapNotesPanel(this);
  }

  /** Phones: a full-screen workflow (Field tasks, Modes) would cover a map panel opened from the menu, so go back to the map first. */
  #leaveMobileWorkflowScreen() {
    if (this.mobileMedia.matches && document.body.classList.contains("mobile-workflow-open")) this.fieldTasks?.navigate?.("map");
  }

  prepareMobileWorkflow(route) {
    if (!this.mobileMedia.matches) {
      // Desktop: only an explicit return to the map leaves a presentation.
      if (route === "map") {
        const current = this.projectManager.current.presentation || {};
        if ((current.template || "standard") !== "standard") this.projectManager.setPresentation({ ...current, template: "standard" });
        this.#teardownBriefingV2();
      }
      return;
    }
    this.mobilePanelManager?.close();
    this.events.publish("mobile:panel-active", { panelId: null });
    this.#setSidebarCollapsed(true);
    document.body.classList.remove("mobile-briefing-context-open", "mobile-map-tools-open", "mobile-drawer-resizing");
    this.#syncMapToolsToggle(false);
    this.#setInsightsOpen(false);
    if (this.utilityPresentationOpen) this.#closeUtilityTab("presentation");
    if (!["briefing", "tours"].includes(route)) {
      const current = this.projectManager.current.presentation || {};
      if ((current.template || "standard") !== "standard") {
        this.projectManager.setPresentation({ ...current, template: "standard" });
      }
    }
  }

  openMobileWorkflow(route) {
    if (route === "tours") {
      this.#openGuidedTours();
      return;
    }
    if (route === "briefing") {
      const current = this.projectManager.current.presentation || {};
      const primaryLayerId = current.primaryLayerId || this.mapController.getLayers().find((layer) => layer.queryable)?.uid || null;
      const returningToBriefing = current.template === "briefing";
      const primaryLayer = this.mapController.getLayer(primaryLayerId);
      const presentation = this.projectManager.setPresentation({
        ...current,
        template: "briefing",
        title: current.modeTitles?.briefing || (returningToBriefing ? current.title : "") || `${primaryLayer?.title || "Feature"} briefing`,
        primaryLayerId,
      });
      this.#applyPresentation(presentation);
      this.#setSidebarCollapsed(false);
      this.events.publish("mobile:workflow-route", { route: "briefing" });
      this.toast("Briefing opened.");
    }
  }

  async shareMobileWorkflow(route, payload = {}) {
    // A briefing shares as a self-contained link that opens its slides.
    if (route === "briefing" && !payload.url) return this.shareBriefing();
    try {
      let url;
      let title;
      if (payload.url) {
        url = payload.url;
        title = payload.title || "GISMap Online field task";
      } else if (route === "tasks" && payload.task) {
        const bytes = new TextEncoder().encode(JSON.stringify(payload.task));
        const encoded = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
        const target = new URL(location.href);
        target.searchParams.set("workflow", "tasks");
        target.hash = new URLSearchParams({ fieldTask: encoded }).toString();
        url = target.href;
        title = payload.task.title || "GISMap Online field task";
      } else {
        const target = new URL(createShareUrl({ baseUrl: location.href, layers: this.mapController.getAllLayerConfigs(), basemap: this.mapController.getBasemapId() }));
        target.searchParams.set("workflow", route);
        const state = this.presentationState;
        // Carry the chosen features so the recipient sees the same briefing.
        if (route === "briefing" && state.template === "briefing" && !state.briefingUseAll && state.selectedIds?.size) {
          target.searchParams.set("briefing", [...state.selectedIds].slice(0, 100).join(","));
        }
        url = target.href;
        const presentation = this.projectManager.current.presentation || {};
        title = presentation.modeTitles?.[route === "tours" ? "atlas" : "briefing"] || presentation.title || "GISMap Online briefing";
      }
      const kind = payload.kind || ({ tasks: "field task", tours: "tour", briefing: "briefing" })[route] || "map";
      const embed = payload.embed ? {
        kind: payload.embed.kind === "briefing" ? "briefing" : "map",
        title: payload.embed.title || title,
        message: payload.embed.message || "Paste this iframe into your site. It opens the same public GISMap Online link without authoring controls.",
      } : null;
      const embedUrl = embed ? createEmbedUrl(url, { kind: embed.kind }) : null;
      const embedIframe = embed ? createEmbedIframe(url, { kind: embed.kind, title: embed.title }) : null;
      const card = payload.card || {
        lines: [`Scan to open this ${kind}, or long-click the QR code`, "to open it in a browser."],
        footer: `Complete ${kind} link encoded in this QR`,
      };
      const renderToken = ++this.workflowShareRenderToken;
      this.workflowShareImageFile = null;
      // Extra files offered beside the QR (a field task's PDF and CSV), made once per dialog on first use.
      const downloads = payload.downloads || [];
      const made = new Map();
      const fileFor = (download) => {
        if (download.cache === false) return Promise.resolve().then(() => download.create());
        if (!made.has(download)) made.set(download, Promise.resolve(download.create()).catch((error) => { made.delete(download); throw error; }));
        return made.get(download);
      };
      const saveFile = (file) => {
        const link = document.createElement("a");
        link.href = URL.createObjectURL(file);
        link.download = file.name;
        link.click();
        setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      };
      this.openDialog({
        eyebrow: payload.eyebrow || "Shareable workflow",
        title,
        content: `<div class="workflow-share">${payload.qr === false ? `<p class="workflow-share__long">This ${kind} carries more than a QR code can hold (${url.length.toLocaleString()} characters), so it shares as a link and files instead. The link opens everything on any device.</p>` : `<div class="tour-share-card"><canvas data-workflow-share-card width="760" height="960" role="img" aria-label="Branded QR card for ${escapeHtml(title)}"></canvas><p class="tour-share-card__status" data-workflow-share-status>Building QR card…</p></div>`}${payload.notice ? `<p class="workflow-share__notice">${escapeHtml(payload.notice)}</p>` : ""}<p>${escapeHtml(payload.message || `Scan this code to open the ${kind} on another device.`)}</p><label class="field"><span>Share link</span><input data-workflow-share-url readonly value="${escapeHtml(url)}"></label>${embed ? `<details class="tour-embed"><summary>Embed on a website</summary><p class="form-note">${escapeHtml(embed.message)}</p><label class="field"><span>Embed URL</span><input readonly value="${escapeHtml(embedUrl)}"></label><textarea readonly rows="6" data-workflow-embed-code>${escapeHtml(embedIframe)}</textarea><button type="button" data-workflow-copy-embed>Copy embed HTML</button></details>` : ""}${downloads.length ? `<div class="workflow-share-downloads"><span>Report files</span><div>${downloads.map((download, index) => `<button type="button" data-share-download="${index}">${escapeHtml(download.label)}</button>`).join("")}</div></div>` : ""}</div>`,
        actions: [
          ...(payload.qr === false ? [] : [{ label: "Download image", handler: () => {
            if (!this.workflowShareImageFile) return this.error("The QR image is still being prepared.");
            saveFile(this.workflowShareImageFile);
          } }]),
          { label: "Share", handler: async () => {
            const attachments = (await Promise.all(downloads.filter((download) => download.share).map((download) => fileFor(download).catch(() => null)))).filter(Boolean);
            // Offer the richest bundle the device accepts: QR image and reports, then the image alone, then just the link.
            const options = [
              [this.workflowShareImageFile, ...attachments].filter(Boolean),
              [this.workflowShareImageFile].filter(Boolean),
            ].filter((files) => files.length).map((files) => ({ title, url, files }));
            const share = options.find((option) => navigator.canShare?.(option)) || { title, url };
            if (navigator.share) await navigator.share(share);
            else { await navigator.clipboard.writeText(url); this.toast("Share link copied."); }
          } },
          { label: "Copy link", primary: true, handler: async () => { await navigator.clipboard.writeText(url); this.toast("Share link copied."); } },
        ],
      });
      this.dialog.querySelectorAll("[data-share-download]").forEach((button) => button.addEventListener("click", async () => {
        const label = button.textContent;
        button.disabled = true;
        button.textContent = "Preparing…";
        try { saveFile(await fileFor(downloads[Number(button.dataset.shareDownload)])); } catch (error) { this.error(error.message); }
        finally { button.disabled = false; button.textContent = label; }
      }));
      this.dialog.querySelector("[data-workflow-copy-embed]")?.addEventListener("click", async () => {
        await navigator.clipboard.writeText(embedIframe);
        this.toast("Embed HTML copied.");
      });
      const canvas = this.dialog.querySelector("[data-workflow-share-card]");
      const status = this.dialog.querySelector("[data-workflow-share-status]");
      if (!canvas) return;
      try {
        const file = await this.#drawBrandedQrCard(canvas, url, { title, ...card, fileStem: route, isCurrent: () => renderToken === this.workflowShareRenderToken });
        if (file) {
          this.workflowShareImageFile = file;
          status.textContent = "This QR contains the complete link.";
        }
      } catch (error) {
        status.textContent = `The QR image could not be created here (${error?.message || "unknown error"}). Copy link still works.`;
      }
    } catch (error) {
      this.error(error.message);
    }
  }

  /**
   * Shares the briefing as one self-contained link: its layers with styles and
   * filters, skin, basemap and slides. The link opens straight into the slides.
   */
  /** The briefing's full share link, with what the dialog and the PDF need. */
  async #briefingShareLink() {
    const presentation = this.projectManager.current.presentation || {};
    const state = this.presentationState;
    const inBriefing = state.template === "briefing";
    const layer = this.mapController.getLayer(inBriefing ? state.layerUid : presentation.primaryLayerId) || this.briefingWorkspace?.layer;
    if (!layer) throw new Error("Choose the briefing's layer before sharing.");
    const layers = this.mapController.getAllLayerConfigs();
    const title = presentation.modeTitles?.briefing || presentation.title || `${layer.title || "Feature"} briefing`;
    const skin = document.documentElement.dataset.skin || presentation.skin;
    const link = await createShareLink({
      baseUrl: location.href,
      kind: "briefing",
      title,
      skin,
      basemap: this.mapController.getBasemapId(),
      camera: this.mapController.getViewState(),
      engine: this.mapController.getEngineId(),
      ground: this.mapController.getGroundId(),
      layers,
      primary: layers.findIndex((config) => config.uid === layer.uid),
      briefing: presentation.briefing,
      selection: inBriefing ? [...(state.selectedIds || [])] : presentation.briefingSelection?.ids || [],
      useAll: inBriefing ? state.briefingUseAll === true : presentation.briefingSelection?.useAll === true,
      });
    return { link, layers, title, skin, presentation };
  }

  /** The briefing's PDF handout as a File (for the API; the share dialog offers the same). */
  async briefingPdfFile({ withLink = true, timelineFrames = "initial", selectedFrames = [] } = {}) {
    const { link, skin } = withLink ? await this.#briefingShareLink() : { link: null, skin: document.documentElement.dataset.skin };
    return this.briefingSlides.createPdf({ link: link?.url || null, qr: link?.qr ?? false, skin, timelineFrames, selectedFrames });
  }

  async shareBriefing() {
    try {
      const { link, layers, title, skin, presentation } = await this.#briefingShareLink();
      const slides = (presentation.briefing?.slides || []).filter((slide) => !slide.hidden).length;
      const filtered = layers.filter((config) => hasDataFilter(config.definitionExpression) && !config.local).length;
      const stem = briefingFileStem(title);
      const downloads = [];
      if (slides) downloads.push({ label: "PDF handout", create: () => this.briefingSlides.createPdf({ link: link.url, qr: link.qr, skin }) });
      const pdfSlides = presentation.briefing?.slides || [];
      const timelineFrames = timelinePdfFrames(pdfSlides);
      if (timelineFrames.length) {
        const expanded = expandTimelinePdfSlides(pdfSlides, {mode:"all"});
        downloads.push({ label: `PDF · all timeline frames (${expanded.length + 1} pages)`, create: () => this.briefingSlides.createPdf({link:link.url, qr:link.qr, skin, timelineFrames:"all"}) });
        downloads.push({ label: "PDF · select timeline frames…", cache: false, create: () => {
          const listing = timelineFrames.map((frame,index) => `${index + 1}. ${frame.title}`).join("\n");
          const answer = globalThis.prompt(`Choose timeline frames (for example 1,3-5). Other slides are included.\n\n${listing}`);
          if (answer == null) throw new Error("PDF export cancelled.");
          const selectedFrames = parseTimelineFrameSelection(answer, timelineFrames.length);
          const pages = expandTimelinePdfSlides(pdfSlides, {mode:"selected", selected:selectedFrames}).length + 1;
          if (!globalThis.confirm(`Create a PDF with ${pages} pages including the cover?`)) throw new Error("PDF export cancelled.");
          return this.briefingSlides.createPdf({link:link.url, qr:link.qr, skin, timelineFrames:"selected", selectedFrames});
        }});
      }
      downloads.push({ label: "Briefing file", create: () => new File([JSON.stringify(link.payload, null, 2)], `${stem}.gisbrief`, { type: "application/json" }) });
      await this.shareMobileWorkflow("briefing", {
        url: link.url,
        title,
        kind: "briefing",
        eyebrow: "Share briefing",
        qr: link.qr,
        notice: filtered ? `Data filters travel with this link: ${filtered === 1 ? "one layer shows" : `${filtered} layers show`} only part of its data.` : "",
        message: `${slides ? `Opens the ${slides}-slide presentation directly` : "Opens this briefing's features"}, with the same layers, styles${filtered ? ", filters" : ""} and look.${link.qr ? "" : " To share by QR, host the briefing file on the web and link to it as ?briefing=<file address>."}`,
        embed: { kind: "briefing", title, message: "Paste this iframe into your site to present this briefing. It keeps the same public data, selected slides, filters, camera, and visual treatment." },
        card: {
          lines: [slides ? `Scan to present ${slides} slide${slides === 1 ? "" : "s"}, or long-click the QR code` : "Scan to open this briefing, or long-click the QR code", "to open it in a browser."],
          footer: "Complete briefing encoded in this QR",
        },
        downloads,
      });
    } catch (error) {
      this.error(error.message);
    }
  }

  /**
   * A slides-only briefing link (made by the client API without a map): the
   * slides go on the first feature layer the link loaded, then start presenting.
   */
  async #openSharedBriefingDocument(shared) {
    await this.openBriefingDocument(shared.briefing, { slide: shared.slide, present: true });
  }

  /**
   * Opens a briefing document (a schema briefing from a link, a file or the API):
   * finds its layer by `layerId`, loading it when it is a service URL not yet on
   * the map, applies its `selection`, and optionally starts presenting.
   */
  async openBriefingDocument(briefing, { slide = null, present = false } = {}) {
    let layer = findBriefingLayer(this.mapController, briefing.layerId);
    if (!layer && /^https:\/\//i.test(briefing.layerId || "")) {
      try {
        const load = this.loadLayer || (async (config) => [await this.mapController.addService(config)]);
        [layer] = await load({ url: briefing.layerId, serviceType: "arcgis-auto" });
      } catch (error) {
        this.error(`The briefing's layer could not be loaded: ${error.message}`);
      }
    }
    layer ||= findBriefingLayer(this.mapController, null);
    const current = this.projectManager.current.presentation || {};
    const visible = briefing.slides.filter((item) => !item.hidden);
    this.briefingTab = visible.length ? "slides" : "features";
    this.projectManager.setPresentation({
      ...current,
      template: "briefing",
      primaryLayerId: layer?.uid || current.primaryLayerId || null,
      briefing,
      ...(briefing.selection && layer ? { briefingSelection: { layerId: layer.uid, ids: (briefing.selection.ids || []).map(String), useAll: briefing.selection.useAll === true } } : {}),
    });
    this.events.publish("mobile:workflow-route", { route: "briefing" });
    await this.presentationLoading;
    if (!layer && briefing.slides.some((item) => item.featureId)) this.toast("This briefing's feature slides need its layer: set layerId to the layer's URL, or add it with ?layer= in the link.");
    if (present && visible.length) this.briefingSlides.openPlayer(visible.some((item) => item.id === slide) ? slide : visible[0].id);
  }

  /**
   * Opens a shared map or briefing link (see map-share.js): loads its layers
   * with their styles and filters, applies the skin and basemap, then shows the
   * view or starts presenting the briefing's slides.
   */
  activateSharedEmbed(kind = "map") {
    const safeKind = ["map", "briefing", "tour"].includes(kind) ? kind : "map";
    document.body.classList.add("shared-embed", `shared-embed--${safeKind}`);
  }

  async openSharedState(shared, { loadLayer, embed = false } = {}) {
    if (embed) this.activateSharedEmbed(shared.kind === "briefing" || shared.kind === "briefing-document" ? "briefing" : "map");
    if (shared.kind === "briefing-document") return this.#openSharedBriefingDocument(shared);
    if (shared.basemap) this.mapController.setBasemap(shared.basemap);
    if (shared.ground) this.mapController.setGround(shared.ground);
    const added = [];
    for (const config of shared.layers) {
      try {
        added.push((await loadLayer(config))[0] || null);
      } catch (error) {
        throw new Error(`Shared layer ${config.title || config.url} failed to restore: ${error.message}`);
      }
    }
    const filtered = shared.layers.filter((layer) => hasDataFilter(layer.definitionExpression)).length;
    const filterNote = filtered ? ` ${filtered === 1 ? "One layer has" : `${filtered} layers have`} a data filter, so not every feature is shown.` : "";
    const current = this.projectManager.current.presentation || {};
    const goToCamera = () => (shared.camera ? this.mapController.setView({ ...shared.camera }, { animate: false }) : null);
    if (shared.kind === "map") {
      if (shared.textBoxes?.length) this.mapController.setTextBoxes(shared.textBoxes);
      this.projectManager.setPresentation({ ...current, template: "standard", skin: shared.skin, title: shared.title || current.title });
      await goToCamera();
      this.toast(`${shared.title || "Shared map"} opened.${filterNote}`);
      return;
    }
    const layer = added[shared.primary] || added.find(Boolean);
    if (!layer) throw new Error("The briefing's layer could not be loaded.");
    const visible = shared.briefing.slides.filter((slide) => !slide.hidden);
    this.briefingTab = visible.length ? "slides" : "features";
    this.projectManager.setPresentation({
      ...current,
      template: "briefing",
      skin: shared.skin,
      title: shared.title,
      modeTitles: { ...(current.modeTitles || {}), briefing: shared.title },
      primaryLayerId: layer.uid,
      briefing: shared.briefing,
      briefingSelection: { layerId: layer.uid, ids: shared.selection, useAll: shared.useAll },
    });
    this.events.publish("mobile:workflow-route", { route: "briefing" });
    await this.presentationLoading;
    if (!visible.length) {
      await goToCamera();
      this.toast(`${shared.title || "Briefing"} opened.${filterNote}`);
      return;
    }
    await goToCamera();
    this.briefingSlides.openPlayer(visible.some((slide) => slide.id === shared.slide) ? shared.slide : visible[0].id);
    if (filterNote) this.toast(filterNote.trim());
  }

  async #importProject(event) {
    const [file] = event.target.files;
    event.target.value = "";
    if (file) await this.importProjectFile(file);
  }

  /** The photo library or camera on phones, files on desktop: a Smart image or a QR code picture. */
  openImagePicker() {
    document.querySelector("#image-file-input")?.click();
  }

  /**
   * A picture: a Smart image opens its whole project; otherwise a GISMap Online QR code
   * in it (a share card, a screenshot, a photo of a screen) opens its link here.
   */
  async #openImage(file) {
    if (file.type === "image/png" || /\.png$/i.test(file.name)) {
      try {
        const { project } = await this.projectManager.importFile(file);
        this.toast(`${project.name} opened from its Smart image.`);
        return;
      } catch (error) {
        // An ordinary PNG (or one whose project data a photo app removed) may still hold a QR code.
        if (!/ordinary image|not contain a GISMap Online project/i.test(error.message)) throw error;
      }
    }
    this.toast("Looking for a GISMap Online QR code in the picture…");
    const text = await decodeQrFromImage(file);
    if (!text) throw new Error("No GISMap Online project or QR code was found in this picture. Try a sharper or closer picture of the QR code.");
    const target = gisMapLinkFrom(text);
    if (!target) throw new Error(`This QR code is not a GISMap Online link${/^https?:/i.test(text) ? ` (it opens ${new URL(text).hostname})` : ""}, so it was not opened.`);
    this.toast(`Opening the ${describeGisMapLink(target)} from the QR code…`);
    setTimeout(() => openGisMapLink(target), 400);
  }

  /** Opens a project or tour file (from the file picker, or a file opened with the installed app). */
  async importProjectFile(file) {
    const isImage = file.type.startsWith("image/") || /\.(?:png|jpe?g|webp|gif|heic|heif)$/i.test(file.name);
    if (isImage) {
      try { await this.#openImage(file); } catch (error) { this.error(error.message); }
      return;
    }
    try {
      if (/\.gisbrief$/i.test(file.name)) return await this.#importBriefingFile(file);
      if (/\.gisclip$/i.test(file.name)) return await this.#importCinematicClipFile(file);
      const { project } = await this.projectManager.importFile(file);
      this.toast(`${project.name} imported from ${/\.png$/i.test(file.name) ? "Smart Image" : "project file"}.`);
    } catch (error) {
      this.error(error.message);
    }
  }

  /** A .gisbrief file opens like a `?briefing=` link: its layers load and the slides start presenting. */
  async #importBriefingFile(file) {
    const shared = readBriefingFile(JSON.parse(await file.text()));
    await this.openSharedState(shared, { loadLayer: this.loadLayer || (async (config) => [await this.mapController.addService(config)]) });
  }

  /** A .gisclip file is saved as a Clip in this project; its public layers load when they are not on the map. */
  async #importCinematicClipFile(file) {
    const raw = JSON.parse(await file.text());
    const clip = normalizeCinematicClip(raw);
    if (!clip.tracks.length && !clip.cameraTrack.length) throw new Error("This file does not contain a cinematic clip.");
    const load = this.loadLayer || (async (config) => [await this.mapController.addService(config)]);
    const missing = [];
    for (const dependency of (raw.package?.dependencies || []).filter((item) => item.layerRef)) {
      let layer = findBriefingLayer(this.mapController, dependency.layerRef) || (dependency.url && findBriefingLayer(this.mapController, dependency.url));
      if (!layer && dependency.url) {
        try { [layer] = await load({ url: dependency.url, title: dependency.title || undefined, serviceType: "arcgis-auto" }); } catch { /* Reported below. */ }
      }
      if (!layer) { missing.push(dependency.title || "a layer"); continue; }
      // The Clip was made against another map: point its tracks at this map's layer.
      for (const track of clip.tracks) if (track.layerRef === dependency.layerRef) track.layerRef = layer.uid;
    }
    const clips = [...(this.projectManager.current.presentation?.cinematicClips || []).filter((item) => item.id !== clip.id), clip];
    this.projectManager.patchPresentation({ cinematicClips: clips });
    this.lastCinematicClipId = clip.id;
    this.#renderPresentationDashboard(this.projectManager.current.presentation);
    this.toast(missing.length ? `Clip “${clip.title}” imported. Add ${missing.join(", ")} to the map to play it.` : `Clip “${clip.title}” imported.`);
  }

  /** A spreadsheet as a GeoJSON file, asking for its coordinate columns when their names aren't recognized. */
  async #spreadsheetAsGeoJson(file) {
    const table = await readSpreadsheet(file);
    const columns = detectCoordinateColumns(table.headers) || await this.#chooseCoordinateColumns(file.name, table.headers);
    if (!columns) return null;
    const { collection, skipped } = rowsToGeoJson(table, columns);
    if (!collection.features.length) throw new Error(`No rows in ${file.name} have valid coordinates in ${columns.pair || `${columns.x} and ${columns.y}`}. Longitude and latitude must be decimal degrees.`);
    if (skipped) this.toast(`${skipped} of ${table.rows.length} rows had no valid coordinates and were left out.`);
    return new File([JSON.stringify(collection)], `${file.name.replace(/\.[^.]+$/, "")}.geojson`, { type: "application/geo+json" });
  }

  #chooseCoordinateColumns(name, headers) {
    const options = headers.map((header) => `<option value="${escapeHtml(header)}">${escapeHtml(header)}</option>`).join("");
    return new Promise((resolve) => {
      this.openDialog({
        eyebrow: "Spreadsheet",
        title: "Choose the coordinate columns",
        content: `<div class="workspace-tool"><p class="form-note">${escapeHtml(name)} has no columns recognized as longitude and latitude. Choose them, in decimal degrees.</p><label class="field"><span>Longitude (X)</span><select data-column-x>${options}</select></label><label class="field"><span>Latitude (Y)</span><select data-column-y>${options}</select></label><button type="button" class="button" data-column-apply>Add to map</button></div>`,
      });
      const root = this.dialog;
      root.addEventListener("close", () => resolve(null), { once: true });
      root.querySelector("[data-column-apply]").addEventListener("click", () => {
        resolve({ x: root.querySelector("[data-column-x]").value, y: root.querySelector("[data-column-y]").value });
        root.close();
      });
    });
  }

  /** A public Google Sheet, read once as a local layer. */
  async #addGoogleSheet() {
    const link = globalThis.prompt?.("Paste the link of a Google Sheet that anyone with the link can view.");
    if (!link) return;
    const url = googleSheetCsvUrl(link);
    try {
      if (!url) throw new Error("That is not a Google Sheets link.");
      const response = await fetch(url).catch(() => null);
      const text = response?.ok ? await response.text() : "";
      if (!text || /^\s*<!doctype html/i.test(text)) throw new Error("That sheet could not be read. Set its sharing to Anyone with the link can view.");
      const event = { target: { files: [new File([text], "Google Sheet.csv", { type: "text/csv" })], value: "" } };
      await this.#addFiles(event);
    } catch (error) {
      this.events.publish("app:error", { message: error.message });
    }
  }

  /** Dropped files: projects, packages and pictures open as projects; local geodata is added as layers. */
  async #importDroppedFiles(files) {
    const projectName = /\.(?:png|jpe?g|webp|gif|heic|heif|gis|gisx|gisbrief|gisclip|gmo|gmop|gisatlas|gmoatlas|gismap)$/i;
    const dataName = /\.(?:csv|tsv|tab|txt|xlsx|xlsm|ods|xls|geojson|kml|kmz|parquet|geoparquet|las|laz|xyz|glb|gltf|obj|ply)$/i;
    const data = [];
    let project = null;
    for (const file of files) {
      if (projectName.test(file.name) || file.type.startsWith("image/")) project ??= file;
      else if (dataName.test(file.name)) data.push(file);
      else if (/\.(?:json|zip)$/i.test(file.name)) {
        // Both projects and geodata (GeoJSON, zipped shapefiles) use these extensions: look inside.
        if (await this.#isProjectFile(file)) project ??= file;
        else data.push(file);
      }
    }
    if (!project && !data.length) {
      this.error("Drop GIS data (GeoJSON, CSV, KML, shapefile ZIP, GeoParquet…), a GISMap Online project or package, a Smart Image, or a picture of a GISMap Online QR code.");
      return;
    }
    if (project) await this.importProjectFile(project);
    if (data.length) await this.#addFiles({ target: { files: data, value: "" } });
  }

  async #isProjectFile(file) {
    try {
      if (/\.zip$/i.test(file.name)) return Boolean(globalThis.JSZip && (await JSZip.loadAsync(file)).file("project.json"));
      const json = JSON.parse(await file.text());
      return !/^(?:FeatureCollection|Feature|GeometryCollection|Point|MultiPoint|LineString|MultiLineString|Polygon|MultiPolygon|Topology)$/.test(json?.type);
    } catch {
      return false;
    }
  }

  async #addFiles(event) {
    const files = [...event.target.files];
    event.target.value = "";
    for (let file of files) {
      try {
        if (isSpreadsheetName(file.name)) {
          file = await this.#spreadsheetAsGeoJson(file);
          if (!file) continue;
        }
        const { isParquetName, addGeoParquetLayer } = await import("./geoparquet-layer.js?v=0.54.0-queryui1");
        const result = isParquetName(file.name) ? await addGeoParquetLayer(this, { file }) : null;
        if (result?.tableOnly) {
          const { openDuckdbQueryWorkspace } = await import("./duckdb-query-workspace.js?v=0.57.0-spatial2");
          openDuckdbQueryWorkspace(this, this.applicationRuntime.duckdb, { selectedRelation: result.relation, message: "This Parquet file has no recognized GeoParquet geometry metadata. It was loaded as a table, not a map layer." });
          continue;
        }
        let layer = result?.layer;
        if (!layer) {
          try { layer = await this.mapController.addLocalFile(file); } catch (error) {
            // Point clouds without a CRS (XYZ, some LAS) can be placed once the person names it.
            if (!/which coordinate system/.test(error.message)) throw error;
            const crs = globalThis.prompt?.(`${file.name} does not say which coordinate system it uses. Enter it, such as EPSG:26910 (UTM 10N) or EPSG:2992 (Oregon Lambert, ft):`);
            if (!crs) throw error;
            layer = await this.mapController.addLocalFile(file, null, { scene3d: { crs: crs.trim() } });
          }
        }
        if (layer.type === "pointcloud" || layer.type === "model") { this.toast(`${layer.title} added in 3D. Tilt the map to see it.`); await this.mapController.goToLayer(layer).catch(() => {}); continue; }
        this.toast(result?.truncated ? `Showing the first ${result.limit} features; SQL can query the full source. Local files require a project package for restoration.` : `${layer.title} added.${result ? " Local files require a project package for restoration." : ""}`);
        await this.mapController.goToLayerOnInitialLoad(layer).catch(() => {});
      } catch (error) {
        this.error(`${file.name}: ${error.message}`);
      }
    }
  }

  async #loadTool(event) {
    const [file] = event.target.files;
    event.target.value = "";
    if (!file) return;
    try {
      await this.toolManager.load(file);
    } catch (error) {
      this.error(error.message);
    }
  }

  async #search(event) {
    event.preventDefault();
    const input = document.querySelector("#place-query");
    if (this.searchSelection >= 0 && this.searchResults[this.searchSelection]) {
      await this.#selectSearchResult(this.searchSelection);
      return;
    }
    await this.#runPlaceSearch(input.value, true);
  }

  #schedulePlaceSearch(value) {
    clearTimeout(this.searchTimer);
    this.searchRequestId += 1;
    const query = value.trim();
    // Engines whose geocoder forbids search-as-you-type search on Enter only.
    if (query.length < 2 || !this.mapController.getCapabilities().includes("geocode-suggest")) {
      this.searchRequestId += 1;
      this.#clearSearchResults();
      return;
    }
    this.searchTimer = setTimeout(() => this.#runPlaceSearch(query), 250);
  }

  async #runPlaceSearch(value, fromSubmit = false) {
    const input = document.querySelector("#place-query");
    const container = document.querySelector("#search-results");
    const query = value.trim();
    if (!query) {
      this.#clearSearchResults();
      return;
    }
    const requestId = ++this.searchRequestId;
    container.hidden = false;
    input.setAttribute("aria-expanded", "true");
    container.innerHTML = '<div class="loading-row"><span></span> Searching…</div>';
    try {
      const results = await this.mapController.search(query);
      if (requestId !== this.searchRequestId || input.value.trim() !== query) return;
      this.searchResults = results;
      this.searchSelection = fromSubmit && results.length === 1 ? 0 : -1;
      container.innerHTML = this.searchResults.length
        ? this.searchResults.map((result, index) => `<button type="button" role="option" data-search-index="${index}" aria-selected="${index === this.searchSelection}">${escapeHtml(result.label)}</button>`).join("")
        : '<div class="empty-state">No matching places found.</div>';
      container.querySelectorAll("[data-search-index]").forEach((button) =>
        button.addEventListener("click", () => this.#selectSearchResult(Number(button.dataset.searchIndex))),
      );
      if (fromSubmit && this.searchResults.length === 1) await this.#selectSearchResult(0);
    } catch (error) {
      if (requestId !== this.searchRequestId) return;
      container.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
    }
  }

  #moveSearchSelection(delta) {
    if (!this.searchResults.length || document.querySelector("#search-results").hidden) return;
    this.searchSelection = (this.searchSelection + delta + this.searchResults.length) % this.searchResults.length;
    document.querySelectorAll("#search-results [data-search-index]").forEach((button, index) => {
      button.setAttribute("aria-selected", String(index === this.searchSelection));
      if (index === this.searchSelection) button.scrollIntoView({ block: "nearest" });
    });
  }

  async #selectSearchResult(index) {
    const result = this.searchResults[index];
    if (!result) return;
    const input = document.querySelector("#place-query");
    input.value = "";
    this.lastPlaceLabel = result.label;
    this.#clearSearchResults();
    this.#rememberPlace(result);
    input.blur();
    await this.#goToPlace(result);
  }

  async #goToPlace(place) {
    try {
      await this.mapController.goToSearchResult(place);
    } catch (error) {
      // A newer camera move interrupting this one is expected, not a failure.
      if (error?.name !== "AbortError") this.error(error.message);
    }
  }

  #readRecentPlaces() {
    try {
      const places = JSON.parse(localStorage.getItem(RECENT_PLACES_KEY));
      return Array.isArray(places) ? places.filter((place) => place?.label && (place.extent || Array.isArray(place.location))) : [];
    } catch {
      return [];
    }
  }

  #writeRecentPlaces(places) {
    try {
      localStorage.setItem(RECENT_PLACES_KEY, JSON.stringify(places));
    } catch {
      // Storage can be unavailable (private mode); recent places are a convenience only.
    }
  }

  #rememberPlace(result) {
    const extent = result.extent;
    const place = {
      label: result.label,
      location: Array.isArray(result.location) ? result.location : null,
      extent: extent && Number.isFinite(extent.xmin)
        ? { type: "extent", xmin: extent.xmin, ymin: extent.ymin, xmax: extent.xmax, ymax: extent.ymax, spatialReference: { wkid: extent.spatialReference?.wkid ?? 4326 } }
        : null,
    };
    const places = [place, ...this.#readRecentPlaces().filter((saved) => saved.label !== place.label)].slice(0, RECENT_PLACES_LIMIT);
    this.#writeRecentPlaces(places);
    this.#renderRecentPlaces(places);
  }

  #renderRecentPlaces(places = this.#readRecentPlaces()) {
    const section = document.querySelector("#recent-places");
    const list = document.querySelector("#recent-places-list");
    if (!section || !list) return;
    section.hidden = !places.length;
    list.innerHTML = places.map((place, index) => `<button type="button" data-recent-place="${index}" title="${escapeHtml(place.label)}"><span aria-hidden="true">↺</span><span class="recent-places__label">${escapeHtml(place.label)}</span></button>`).join("");
  }

  async #goToRecentPlace(index) {
    const place = this.#readRecentPlaces()[index];
    if (!place) return;
    this.lastPlaceLabel = place.label;
    this.#rememberPlace(place);
    await this.#goToPlace({ ...place, extent: place.extent || undefined });
  }

  #clearSearchResults() {
    clearTimeout(this.searchTimer);
    this.searchRequestId += 1;
    this.searchResults = [];
    this.searchSelection = -1;
    const container = document.querySelector("#search-results");
    container.replaceChildren();
    container.hidden = true;
    document.querySelector("#place-query").setAttribute("aria-expanded", "false");
  }

  async #addBookmark() {
    const [longitude, latitude] = this.mapController.getViewState().center;
    const name = document.querySelector("#place-query").value.trim() || this.lastPlaceLabel || `View at ${latitude.toFixed(3)}, ${longitude.toFixed(3)}`;
    const address = await this.mapController.reverseGeocode({ longitude, latitude }).catch(() => null);
    this.projectManager.addBookmark({
      name,
      description: "",
      longitude,
      latitude,
      reverseAddress: address?.address || "",
      viewpoint: this.mapController.getViewState(),
      basemapId: this.mapController.getBasemapId(),
      lingerSeconds: 4,
      layerVisibility: this.mapController.getLayers().map((layer) => ({ key: this.#atlasLayerKey(layer), visible: layer.visible })),
    });
  }

  #bookmarkManagerDialog() {
    const bookmarks = this.projectManager.current.bookmarks ?? [];
    const rows = bookmarks.map((bookmark) => `<article class="bookmark-editor" data-bookmark-editor="${escapeHtml(bookmark.id)}"><label class="field"><span>Name</span><input data-bookmark-name value="${escapeHtml(bookmark.name)}" /></label><label class="field"><span>Description</span><textarea data-bookmark-description rows="2">${escapeHtml(bookmark.description || "")}</textarea></label><div class="bookmark-editor__coordinates"><label>Longitude<input data-bookmark-longitude type="number" step="0.000001" value="${escapeHtml(bookmark.longitude ?? bookmark.viewpoint?.center?.[0] ?? "")}" /></label><label>Latitude<input data-bookmark-latitude type="number" step="0.000001" value="${escapeHtml(bookmark.latitude ?? bookmark.viewpoint?.center?.[1] ?? "")}" /></label></div></article>`).join("") || `<p class="form-note">Add a current view first. Bookmarks retain Atlas-compatible camera, basemap, layer-state, description, and linger settings.</p>`;
    this.openDialog({
      eyebrow: "Bookmarks",
      title: "Manage saved places",
      content: `<div class="bookmark-manager"><p class="form-note">Edit saved places, export a location spreadsheet, or turn this set directly into a Guided Places atlas.</p><div class="bookmark-editor-list">${rows}</div></div>`,
      actions: [
        { label: "Download CSV", handler: () => this.#downloadBookmarksCsv() },
        { label: "Download .gisatlas", handler: () => { this.#saveBookmarkEdits(); this.#createAtlasFromBookmarks(); this.projectManager.exportAtlas(); this.dialog.close(); } },
        { label: "Create Atlas", handler: () => { this.#saveBookmarkEdits(); this.#createAtlasFromBookmarks(); this.dialog.close(); } },
        { label: "Save changes", primary: true, handler: () => { this.#saveBookmarkEdits(); this.dialog.close(); } },
      ],
    });
  }

  #saveBookmarkEdits() {
    this.dialog.querySelectorAll("[data-bookmark-editor]").forEach((row) => this.projectManager.updateBookmark(row.dataset.bookmarkEditor, {
      name: row.querySelector("[data-bookmark-name]").value.trim() || "Saved place",
      description: row.querySelector("[data-bookmark-description]").value.trim(),
      longitude: Number(row.querySelector("[data-bookmark-longitude]").value),
      latitude: Number(row.querySelector("[data-bookmark-latitude]").value),
    }));
  }

  #downloadBookmarksCsv() {
    const quote = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const csv = ["Name,Longitude,Latitude,Description", ...(this.projectManager.current.bookmarks ?? []).map((item) => [item.name, item.longitude ?? item.viewpoint?.center?.[0] ?? "", item.latitude ?? item.viewpoint?.center?.[1] ?? "", item.description ?? ""].map(quote).join(","))].join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.download = `${this.projectManager.current.name || "bookmarks"}-bookmarks.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 5000);
  }

  #createAtlasFromBookmarks() {
    const defaults = this.#atlasDefaults();
    const chapters = (this.projectManager.current.bookmarks ?? []).map((bookmark, index) => ({
      id: bookmark.id || `bookmark-${index + 1}`,
      title: bookmark.name || `Place ${index + 1}`,
      body: bookmark.description || "",
      reverseAddress: bookmark.reverseAddress || "",
      viewState: bookmark.viewpoint,
      basemapId: bookmark.basemapId || null,
      lingerSeconds: Math.min(120, Math.max(1, Number(bookmark.lingerSeconds) || defaults.lingerSeconds)),
      transitionMode: bookmark.transitionMode === "instant" ? "instant" : defaults.transitionMode,
      layerVisibility: bookmark.layerVisibility || null,
    }));
    if (!chapters.length) return this.error("Add at least one bookmark before creating an atlas.");
    const presentation = this.projectManager.setPresentation({ ...this.projectManager.current.presentation, template: "atlas", title: this.projectManager.current.presentation?.title || "Guided places", chapters });
    this.#applyPresentation(presentation);
    this.toast("Created Guided Places from bookmarks.");
  }

  #renderBookmarks() {
    const bookmarks = this.projectManager.current.bookmarks ?? [];
    const container = document.querySelector("#bookmarks-list");
    container.classList.toggle("muted", !bookmarks.length);
    container.innerHTML = bookmarks.length
      ? bookmarks.map((bookmark) => `<div class="bookmark-row"><button data-bookmark-id="${escapeHtml(bookmark.id)}">${escapeHtml(bookmark.name)}${bookmark.description ? `<small>${escapeHtml(bookmark.description)}</small>` : ""}</button><button data-bookmark-edit="${escapeHtml(bookmark.id)}" aria-label="Edit bookmark">✎</button><button data-bookmark-remove="${escapeHtml(bookmark.id)}" aria-label="Remove bookmark">×</button></div>`).join("")
      : "No saved locations yet.";
    container.querySelectorAll("[data-bookmark-id]").forEach((button) =>
      button.addEventListener("click", () => {
        const item = bookmarks.find((bookmark) => bookmark.id === button.dataset.bookmarkId);
        if (item) this.mapController.restoreView(item.viewpoint);
      }),
    );
    container.querySelectorAll("[data-bookmark-remove]").forEach((button) =>
      button.addEventListener("click", () => this.projectManager.removeBookmark(button.dataset.bookmarkRemove)),
    );
    container.querySelectorAll("[data-bookmark-edit]").forEach((button) => button.addEventListener("click", () => this.#bookmarkManagerDialog()));
  }

  #renderLayers() {
    const layers = this.mapController.getLayers().slice().reverse();
    if (this.utilityStyleLayerUid && !this.mapController.getLayer(this.utilityStyleLayerUid)) {
      this.utilityStyleLayerUid = null;
      document.querySelector("#utility-style-content").replaceChildren();
      this.#syncUtilityPanel();
    }
    if (this.utilitySourceLayerUid && !this.mapController.getLayer(this.utilitySourceLayerUid)) {
      this.utilitySourceLayerUid = null;
      document.querySelector("#utility-source-content")?.replaceChildren();
      this.#syncUtilityPanel();
    }
    const welcomePanel = document.querySelector("#welcome-panel");
    // On a phone the map is the point once data is loaded; keep the intro only on desktop shared-example landings.
    if (welcomePanel.dataset.reopened !== "true") {
      if (layers.length && (!this.keepWelcomeForSharedExample || this.mobileMedia.matches)) this.#dismissWelcome();
    }
    const applicationPreset = this.applicationRuntime?.snapshot?.().preset || "standard";
    const launchSuppressed = welcomePanel.dataset.launchSuppressed === "true";
    welcomePanel.hidden = welcomePanel.dataset.reopened !== "true" && (welcomePanel.dataset.dismissed === "true" || launchSuppressed || applicationPreset !== "standard");
    const exportable = new Set(this.exportController.listExportableLayers().map((layer) => layer.uid));
    document.querySelector("#layer-count").textContent = `${layers.length} loaded`;
    const container = document.querySelector("#layers-list");
    const exampleGuide = this.activeExampleGuide;
    const guide = exampleGuide ? `<section class="example-guide" aria-label="Example tutorial"><div><span class="eyebrow">Example loaded</span><strong>${escapeHtml(exampleGuide.title || "Explore this map")}</strong><p>See how the data, map symbols, and controls fit together.</p></div><button type="button" data-example-guide>Start tutorial</button></section>` : "";
    container.innerHTML = layers.length
      ? `${guide}${layers.map((layer) => {
        const config = this.mapController.getLayerConfig(layer);
        const scaleMessage = this.#layerScaleMessage(layer);
        // How current the source is, from the service's own edit dates.
        const edited = this.mapController.layerMetadata?.(layer)?.dataLastEditDate;
        const dataDate = edited ? new Date(edited).toLocaleDateString(undefined, { year: "numeric", month: "short" }) : "";
        return `<article class="layer-card" data-layer-uid="${escapeHtml(layer.uid)}">
          <div class="layer-card__head"><label class="layer-toggle"><input type="checkbox" data-layer-visible ${layer.visible ? "checked" : ""} /><span></span></label><div><button type="button" class="layer-card__title" data-layer-action="style" title="Style ${escapeHtml(layer.title)}">${escapeHtml(layer.title)}</button><small>${escapeHtml(config.sourceType === "geoparquet" ? "GeoParquet" : config.sourceType)}${config.definitionExpression ? " · Filtered" : ""}${config.refreshInterval ? ` · ${config.refreshInterval}m refresh` : ""}${dataDate ? ` · <span title="When the publisher last edited the data">Data ${escapeHtml(dataDate)}</span>` : ""}</small></div><button data-layer-action="remove" title="Remove layer">×</button></div>
          <div class="layer-scale-note" data-layer-scale-note ${scaleMessage ? "" : "hidden"}><span data-scale-text>${escapeHtml(scaleMessage || "")}</span><button type="button" data-layer-action="ignore-scale" title="Draw this layer at every zoom level">Show anyway</button></div>
          <label class="opacity-row"><span>Opacity</span><input data-layer-opacity type="range" min="0" max="1" step="0.05" value="${layer.opacity}" /><output>${Math.round(layer.opacity * 100)}%</output></label>
          <div class="layer-card__actions layer-card__primary"><button data-layer-action="zoom">Zoom</button><button data-layer-action="table">Table</button><button data-layer-action="style">Style</button></div>
          <details class="layer-card__more" ${this.expandedLayerCards.has(layer.uid) ? "open" : ""}><summary>More layer tools</summary><div class="layer-card__actions">${layer.queryable && this.mapController.getCapabilities().includes("three-3d") ? '<button data-layer-action="animate" title="Suggested animations for this layer: a looping effect, a timeline or a sweep">Animate</button>' : ""}<button data-layer-action="filter" title="Show only matching features on the map">Filter map</button>${layer.queryable || config.sourceType === "geoparquet" ? '<button data-layer-action="query-duckdb" title="Query, join or run spatial analysis on a copy of this layer">Query data</button>' : ''}${layer.queryable ? '<button data-layer-action="chart" title="Chart this layer in a panel linked to the map">Chart</button>' : ""}${layer.queryable ? '<button data-layer-action="labels" title="Label features from their fields, a template or fixed text">Labels</button>' : ""}<button data-layer-action="source" title="Inspect this data source and open its publisher page">Source</button><button data-layer-action="refresh">Refresh</button><button data-layer-action="advanced-style">Advanced style</button></div></details>
        </article>`;
      }).join("")}`
      : '<div class="empty-state empty-state--layers"><p>No layers yet. Add data to start.</p><div class="empty-state__actions"><button type="button" data-empty-action="data-arcgis">ArcGIS service</button><button type="button" data-empty-action="data-geojson">Geo URL</button><button type="button" data-empty-action="data-file">Local file</button><button type="button" data-empty-action="data-popular">Try an example</button></div></div>';
    container.querySelector("[data-example-guide]")?.addEventListener("click", () => this.#startExampleWalkthrough());
    container.querySelectorAll(".layer-card").forEach((card) => this.#bindLayerCard(card));
  }

  #layerScaleMessage(layer) {
    if (!layer?.visible || !this.mapController.isReady()) return "";
    const scale = Number(this.mapController.getScale());
    const minScale = Number(layer.minScale) || 0;
    const maxScale = Number(layer.maxScale) || 0;
    const formatScale = (value) => `1:${Math.round(value).toLocaleString()}`;
    if (minScale && scale > minScale) return `Hidden at this zoom (publisher limit ${formatScale(minScale)}). Zoom in or show anyway.`;
    if (maxScale && scale < maxScale) return `Hidden at this zoom (publisher limit ${formatScale(maxScale)}). Zoom out or show anyway.`;
    return "";
  }

  #updateLayerScaleIndicators() {
    document.querySelectorAll(".layer-card[data-layer-uid]").forEach((card) => {
      const note = card.querySelector("[data-layer-scale-note]");
      const message = this.#layerScaleMessage(this.mapController.getLayer(card.dataset.layerUid));
      if (!note) return;
      note.querySelector("[data-scale-text]").textContent = message;
      note.hidden = !message;
    });
  }

  #bindLayerCard(card) {
    const uid = card.dataset.layerUid;
    card.querySelector(".layer-card__more")?.addEventListener("toggle", (event) => { if (event.currentTarget.open) this.expandedLayerCards.add(uid); else this.expandedLayerCards.delete(uid); });
    card.querySelector("[data-layer-visible]").addEventListener("change", (event) => this.mapController.setVisibility(uid, event.target.checked));
    card.querySelector("[data-layer-opacity]").addEventListener("input", (event) => {
      this.mapController.setOpacity(uid, event.target.value);
      event.target.nextElementSibling.value = `${Math.round(event.target.value * 100)}%`;
    });
    card.querySelectorAll("[data-layer-action]").forEach((button) => button.addEventListener("click", async () => {
      const layer = this.mapController.getLayer(uid);
      if (layer) this.applicationRuntime.state.dispatch("layer:activate", { layerId: uid }, { undoable: false });
      switch (button.dataset.layerAction) {
        case "remove": this.mapController.removeLayer(uid); break;
        case "ignore-scale":
          // Saved with the project and carried in share links.
          this.mapController.ignoreScaleRange(uid, true);
          this.#updateLayerScaleIndicators();
          this.toast(`${layer?.title || "The layer"} now draws at every zoom level.`);
          break;
        case "zoom": {
          const zoomed = layer ? await this.mapController.goToLayer(layer) : false;
          if (!zoomed) this.toast("This layer has a near-global or invalid extent. Use a filter or select a feature to zoom safely.");
          break;
        }
        case "table": this.events.publish("table:toggle", { uid }); break;
        case "query-duckdb": {
          if (this.utilityQueryOpen && this.utilityQueryLayerUid === uid) {
            if (this.activeUtilityTab === "query") this.#closeUtilityTab("query");
            else this.#syncUtilityPanel("query");
            break;
          }
          button.disabled = true;
          try {
            this.utilityQueryLayerUid = uid;
            const { openLayerInDuckdb } = await import("./layer-duckdb.js?v=0.57.0-spatial2");
            await openLayerInDuckdb(this, uid);
          } catch (error) { this.utilityQueryLayerUid = null; this.error(error.message); }
          finally { button.disabled = false; }
          break;
        }
        case "filter":
          if (this.utilityDialogOpen && this.utilityDialogLayerTool?.action === "filter" && this.utilityDialogLayerTool.uid === uid) {
            if (this.activeUtilityTab === "dialog") this.#closeUtilityTab("dialog");
            else this.#syncUtilityPanel("dialog");
            break;
          }
          try {
            this.utilityDialogLayerTool = { action: "filter", uid };
            await this.#filterDialog(uid);
          } catch (error) { this.utilityDialogLayerTool = null; this.error(error.message); }
          break;
        case "source":
          if (this.utilitySourceLayerUid === uid) {
            if (this.activeUtilityTab === "source") this.#closeUtilityTab("source");
            else this.#syncUtilityPanel("source");
          } else this.#openLayerSource(uid);
          break;
        case "style":
          if (layer?.queryable && layer.fields?.length) {
            if (this.cartographyLabOpen && this.activeUtilityTab === "lab") this.#closeUtilityTab("lab");
            else this.openCartographyLab(uid);
          } else if (this.utilityStyleLayerUid === uid) {
            if (this.activeUtilityTab === "style") this.#closeUtilityTab("style");
            else this.#syncUtilityPanel("style");
          } else this.#openSymbologyUtility(uid);
          break;
        case "chart":
          void this.#openChartsAnalytics({ layerUid: uid });
          break;
        case "labels":
          this.#openLabelEditor(uid);
          break;
        case "advanced-style":
          if (this.utilityStyleLayerUid === uid) {
            if (this.activeUtilityTab === "style") this.#closeUtilityTab("style");
            else this.#syncUtilityPanel("style");
          } else this.#openSymbologyUtility(uid);
          break;
        case "animate": this.#openAnimateLayer(uid); break;
        case "refresh": this.#refreshDialog(uid); break;
      }
    }));
  }

  /** Show the loaded layer's provenance without making people hunt for its service URL. */
  #openLayerSource(uid) {
    const layer = this.mapController.getLayer(uid);
    if (!layer) return;
    const config = this.mapController.getLayerConfig(layer) || {};
    const metadata = this.mapController.layerMetadata?.(layer) || {};
    const rawUrl = String(config.url || layer.url || metadata.url || "");
    let sourceUrl = "";
    try {
      const parsed = new URL(rawUrl, location.href);
      if (["https:", "http:"].includes(parsed.protocol)) sourceUrl = parsed.href;
    } catch { /* Local files and non-web source references deliberately have no external link. */ }
    const sourceType = config.sourceType === "geoparquet"
      ? "GeoParquet file"
      : metadata.kind === "arcgis-layer" ? "ArcGIS feature layer"
        : metadata.kind === "arcgis-service" ? "ArcGIS map service"
          : metadata.kind === "geojson" ? "GeoJSON"
            : config.sourceType || layer.type || "Map layer";
    const localLabel = config.fileName || (config.local ? "Local file" : "");
    const formatDate = (value) => {
      const date = value ? new Date(value) : null;
      return date && !Number.isNaN(date.valueOf()) ? date.toLocaleString() : "";
    };
    const details = [
      ["Source type", sourceType],
      ["Layer", metadata.title || layer.title || config.title],
      ["Publisher attribution", metadata.attribution],
      ["Last data update", formatDate(metadata.dataLastEditDate || metadata.lastEditDate)],
      ["Features", Number.isFinite(metadata.featureCount) ? metadata.featureCount.toLocaleString() : ""],
      ["Local asset", localLabel],
    ].filter(([, value]) => value);
    // Publisher descriptions are HTML (sometimes entity-escaped); show their text, not their markup.
    const description = plainText(metadata.description, 4000);
    const pane = document.querySelector("#utility-source-content");
    if (!pane) return;
    pane.innerHTML = `<section class="layer-source"><span class="eyebrow">Data source</span><h3>${escapeHtml(layer.title || config.title || "Layer source")}</h3>${description ? `<p class="layer-source__description">${escapeHtml(description)}</p>` : `<p class="form-note">This panel keeps the source details for the layer currently on your map.</p>`}<dl class="layer-source__details">${details.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}</dl>${sourceUrl ? `<div class="layer-source__endpoint"><span>Publisher endpoint</span><code>${escapeHtml(sourceUrl)}</code></div><a class="button--primary layer-source__open" href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer">Open source in a new tab ↗</a>` : `<p class="form-note">This source is stored locally, so it does not have a publisher page to open.</p>`}</section>`;
    this.utilitySourceLayerUid = uid;
    this.#syncUtilityPanel("source");
  }

  async #filterDialog(uid) {
    let layer = this.mapController.getLayer(uid);
    if (!layer?.filterable) {
      throw new Error("This layer does not support attribute filters.");
    }
    layer = await this.mapController.loadLayer(uid, { allowTruncated: true });
    const fields = (layer.fields ?? []).filter((field) => field.name && !/geometry|blob|raster/i.test(field.type || ""));
    if (!fields.length) throw new Error("This layer does not expose fields that can be filtered.");
    // Conditions are remembered per layer, so reopening the dialog shows the filter as built.
    this.filterConditions ??= new Map();
    const saved = this.filterConditions.get(uid);
    const savedMatches = saved && saved.expression === (layer.where || null);
    let builder = null;
    this.openDialog({
      eyebrow: "Map layer filter",
      title: `Filter ${layer.title || "layer"}`,
      content: `<p class="form-note">Filter changes which features appear on the map and in the attribute table. Query data explores a separate analysis dataset and does not change this map filter.</p><div data-layer-filter-builder></div>${layer.where ? `<p class="form-note"><strong>Current filter:</strong> <code>${escapeHtml(layer.where)}</code></p>` : ''}`,
      actions: [
        { label: "Clear filter", handler: async () => {
          try {
            this.mapController.setDefinitionExpression(uid, null);
            const updated = await this.mapController.loadLayer(uid, { allowTruncated: true });
            this.filterConditions.delete(uid);
            this.dialog.close();
            this.toast(updated?.truncated ? "Filter cleared. The layer exceeds the feature limit; only the first matching features are shown." : "Layer filter cleared.");
          } catch (error) { this.error(error.message); }
        }},
        { label: "Apply filter", primary: true, handler: async () => {
          try {
            const { conditions, logic } = builder;
            const expression = conditionsToWhere(conditions, logic, fields);
            if (!expression) throw new Error("Complete a condition first, or choose Clear filter.");
            this.mapController.setDefinitionExpression(uid, expression);
            const updated = await this.mapController.loadLayer(uid, { allowTruncated: true });
            this.filterConditions.set(uid, { conditions, logic, expression });
            this.dialog.close();
            this.toast(updated?.truncated ? "Filter applied, but the layer still exceeds the feature limit. Narrow it further to show all matching features." : `Filter applied: ${expression}`);
          } catch (error) { this.error(error.message); }
        }},
      ],
    });
    // The same builder as Briefing and the Dataset explorer; values come from the service.
    builder = createFilterBuilder({
      host: this.dialog.querySelector("[data-layer-filter-builder]"),
      fields,
      conditions: savedMatches ? saved.conditions : [{ field: fields[0].name, op: fieldKind(fields[0]) === "number" ? "gte" : fieldKind(fields[0]) === "date" ? "after" : "eq", value: "" }],
      logic: savedMatches ? saved.logic : "and",
      valuesFor: async (name) => (await this.mapController.distinctValues(layer, name).catch(() => ({ values: [] }))).values || [],
    });
  }

  /** Legend → style editor: double-click a layer's legend card, or use its edit button. */
  #initLegendEditing() {
    const host = document.querySelector("#utility-legend-content");
    const open = (uid) => { if (uid && this.mapController.getLayer(uid)) this.#openSymbologyUtility(uid); };
    host?.addEventListener("click", (event) => open(event.target.closest("[data-legend-edit]")?.dataset.legendEdit));
    host?.addEventListener("dblclick", (event) => {
      if (event.target.closest("[data-legend-edit]")) return;
      window.getSelection?.()?.removeAllRanges();
      open(event.target.closest("[data-legend-layer]")?.dataset.legendLayer);
    });
  }

  #openSymbologyUtility(uid) {
    const layer = this.mapController.getLayer(uid);
    if (!layer) return;
    this.utilityStyleLayerUid = uid;
    const pane = document.querySelector("#utility-style-content");
    const fields = (layer.fields ?? []).filter((field) => field?.name && !/^(?:geometry)$/i.test(field.type || ""));
    // Object IDs are storage keys, not meaningful values for classification or
    // 3D heights. Prefer a measurement-like field when a renderer has none.
    const numericFields = fields.filter((field) => /^(?:small-integer|integer|single|double|long)$/i.test(field.type || ""));
    const preferredNumericField = numericFields.find((field) => /(?:^|\b)(?:value|concentration|amount|measurement|pm2?\.5)(?:\b|$)/i.test(`${field.name} ${field.alias || ""}`))
      ?? numericFields.find((field) => !/(?:^|_)id$/i.test(field.name))
      ?? numericFields[0];
    const renderer = layer.renderer ?? {};
    // Styles with excluded codes draw from an expression, so the recorded RendererSpec names the field.
    const layerConfig = this.mapController.getLayerConfig(layer) || {};
    const currentField = renderer.field || layerConfig.rendererSpec?.field;
    const savedSpec = layerConfig.rendererSpec;
    const savedChart = layerConfig.spatialChart || null;
    let selectedSpec = savedSpec && ["simple", "categories", "choropleth", "graduated-symbols", "heatmap"].includes(savedSpec.type) ? structuredClone(savedSpec) : null;
    const representativeSymbol = renderer.symbol ?? renderer.classBreakInfos?.[0]?.symbol ?? renderer.uniqueValueInfos?.[0]?.symbol;
    let selectedMarkerSymbol = representativeSymbol?.type === "picture-marker" && String(representativeSymbol.url || "").startsWith("/assets/symbols/") ? representativeSymbol.url : "";
    const objectSymbol = representativeSymbol?.symbolLayers?.find((symbolLayer) => symbolLayer.type === "object" || symbolLayer.type === "extrude");
    const heightVariable = renderer.visualVariables?.find((variable) => variable.type === "size" && (variable.axis === "height" || layer.geometryType === "polygon"));
    const expressionField = String(heightVariable?.valueExpression || "").match(/\$feature\[(?:"([^"]+)"|'([^']+)')\]/)?.slice(1).find(Boolean);
    const expressionMultiplier = Number(String(heightVariable?.valueExpression || "").match(/\*\s*([0-9]+(?:\.[0-9]+)?)/)?.[1]);
    const extrusionEnabledByRenderer = Boolean(savedChart || (objectSymbol && (heightVariable || Number(objectSymbol.height ?? objectSymbol.size) > 1)));
    const initialExtrusionSource = (savedChart?.height?.field || heightVariable) ? "field" : "fixed";
    const extrusionField = savedChart?.height?.field || heightVariable?.field || expressionField || preferredNumericField?.name || "";
    const chartGroupField = savedChart?.groupBy || fields.find((field) => /year|date|time|period/i.test(`${field.name} ${field.alias || ""}`))?.name || fields[0]?.name || "";
    const fieldOptions = (items, emptyLabel, selected = "") => items.length
      ? items.map((field) => `<option value="${escapeHtml(field.name)}"${field.name === selected ? " selected" : ""}>${escapeHtml(field.alias || field.name)} (${escapeHtml(field.name)})</option>`).join("")
      : `<option value="">${emptyLabel}</option>`;
    const rendererControls = fields.length
      ? `<label class="field"><span>What varies</span><select data-style-mode><option value="simple">Single symbol</option><option value="categorized">Category color</option><option value="color">Color by value</option><option value="graduated">Size by value</option><option value="size-color">Size and color by value</option><option value="heatmap">Heat map</option></select></label><label class="field" data-style-field-control hidden><span>Style field</span><select data-style-field>${fieldOptions(fields, "No fields available", currentField || preferredNumericField?.name)}</select></label>`
      : "";
    const polygonControls = layer.geometryType === "polygon"
      ? '<label class="opacity-row"><span>Fill opacity</span><input data-symbol-fill-opacity type="range" min="0" max="1" step="0.05" value="0.35" /><output>35%</output></label><label class="display-checkbox"><input data-symbol-no-fill type="checkbox" /><span>No fill — outline only</span></label>'
      : "";
    const pointSymbolControls = /point/i.test(layer.geometryType || "")
      ? `<fieldset class="feedback-settings symbol-gallery"><legend>Marker symbol <small>SVG markers</small></legend><div class="symbol-gallery__choices" role="radiogroup" aria-label="Marker symbol"><button type="button" class="symbol-gallery__choice${!selectedMarkerSymbol ? " is-selected" : ""}" data-symbol-gallery="" role="radio" aria-checked="${!selectedMarkerSymbol}"><span class="symbol-gallery__dot"></span><span>Circle</span></button>${[["/assets/symbols/fire.svg", "Fire"], ["/assets/symbols/sensor.svg", "Sensor"], ["/assets/symbols/quake.svg", "Quake"], ["/assets/symbols/pin.svg", "Place"]].map(([url, label]) => `<button type="button" class="symbol-gallery__choice${selectedMarkerSymbol === url ? " is-selected" : ""}" data-symbol-gallery="${url}" role="radio" aria-checked="${selectedMarkerSymbol === url}"><img src="${url}" alt=""><span>${label}</span></button>`).join("")}</div><p class="form-note">SVG markers render in the ArcGIS engine. MapLibre keeps the same color and size as a compatible circle marker.</p></fieldset>`
      : "";
    const extrudable = this.mapController.getEngineId() === "maplibre" ? layer.geometryType === "polygon" : ["polygon", "point", "multipoint"].includes(layer.geometryType);
    const extrusionControls = extrudable
      ? `<fieldset class="feedback-settings"><legend>3D visualization</legend><label class="display-checkbox"><input data-extrusion-enabled type="checkbox"${extrusionEnabledByRenderer ? " checked" : ""} /><span>Show as a 3D chart</span></label><div data-extrusion-options hidden><div class="field-grid"><label class="field"><span>Visualization type</span><select data-spatial-chart-mode><option value="attribute-extrusion">Attribute extrusion</option><option value="temporal-strata">Temporal strata</option><option value="stacked-footprints">Stacked footprints</option><option value="exploded-timeline">Exploded timeline</option></select></label><label class="field" data-spatial-group-control hidden><span>Vertical group field</span><select data-spatial-group-field>${fieldOptions(fields, "No fields available", chartGroupField)}</select></label><label class="field"><span>Height source</span><select data-extrusion-source><option value="fixed"${initialExtrusionSource === "fixed" ? " selected" : ""}>Fixed slab</option><option value="field"${initialExtrusionSource === "field" ? " selected" : ""}>Numeric field</option></select></label><label class="field" data-extrusion-value-control><span>Slab thickness <small>display meters</small></span><input data-extrusion-value type="number" min="1" step="1" value="${savedChart?.height?.thicknessMeters || Number(objectSymbol?.height ?? objectSymbol?.size) || 250}" /></label><label class="field" data-extrusion-field-control hidden><span>Height / thickness field</span><select data-extrusion-field>${fieldOptions(numericFields, "No numeric fields available", extrusionField)}</select></label><label class="field" data-extrusion-multiplier-control hidden><span>Height multiplier</span><input data-extrusion-multiplier type="number" min="0" step="0.01" value="${savedChart?.height?.scale ?? (Number.isFinite(expressionMultiplier) ? expressionMultiplier : 1)}" /></label><label class="field" data-spatial-slot-control hidden><span>Slot separation <small>display meters</small></span><input data-spatial-slot type="number" min="1" step="50" value="${savedChart?.height?.slotMeters || 400}" /></label><label class="field" data-spatial-gap-control hidden><span>Gap <small>display meters</small></span><input data-spatial-gap type="number" min="0" step="25" value="${savedChart?.height?.gapMeters ?? 100}" /></label><label class="display-checkbox"><input data-spatial-ground-outlines type="checkbox"${savedChart?.groundOutlines ? " checked" : ""} /><span>Show outlines on the ground <small>the flat perimeters under the 3D shapes</small></span></label><label class="display-checkbox" data-spatial-order-control hidden><input data-spatial-order type="checkbox"${savedChart?.order === "descending" ? " checked" : ""} /><span>Reverse stacking order <small>highest value at the bottom; colours follow</small></span></label>${layer.geometryType === "polygon" ? "" : `<label class="field"><span>Column width <small>meters</small></span><input data-extrusion-width type="number" min="1" step="50" value="${Number(objectSymbol?.width) || 650}" /></label>`}</div><p class="form-note" data-spatial-chart-note>Virtual Z is separate from terrain elevation. The legend labels what height and vertical position mean.</p></div></fieldset>`
      : `<fieldset class="feedback-settings"><legend>3D extrusion</legend><p class="form-note">${this.mapController.getEngineId() === "maplibre" && /point/i.test(layer.geometryType || "") ? "MapLibre point columns are not yet supported. Switch to ArcGIS for 3D columns." : "3D extrusion is not available for this layer’s geometry in the current engine."}</p></fieldset>`;
    // Animated effect: Cinematic mode's decorative effects on an ordinary layer (MapLibre draws them with three.js).
    const effectsAvailable = this.mapController.getCapabilities().includes("three-3d") && Boolean(layer.geometryType);
    const savedEffect = layerConfig.animatedEffect || null;
    const suggestedEffect = suggestEffect({ title: layer.title, geometryType: layer.geometryType, fields });
    const effectNote = (type) => {
      const resolved = type === "auto" ? suggestedEffect : type;
      return resolved && resolved !== "none" ? `${CINEMATIC_EFFECTS[resolved]?.note || ""} Applies right away and is saved with the layer.` : "Animate this layer with glow, flames, seismic pulses, wind, water or flow. Decorative only; it never changes the data.";
    };
    const effectControls = effectsAvailable
      ? `<fieldset class="feedback-settings layer-effect"><legend>Animated effect</legend><div class="field-grid"><label class="field"><span>Effect</span><select data-layer-effect>${this.#cinematicEffectOptions(savedEffect?.type || "none", suggestedEffect)}</select></label><label class="field"><span>Visual style</span><select data-layer-effect-style${savedEffect ? "" : " disabled"}><option value="soft"${savedEffect?.style === "soft" ? " selected" : ""}>Soft glow</option><option value="balanced"${!savedEffect?.style || savedEffect.style === "balanced" ? " selected" : ""}>Balanced</option><option value="crisp"${savedEffect?.style === "crisp" ? " selected" : ""}>Crisp</option><option value="vivid"${savedEffect?.style === "vivid" ? " selected" : ""}>Vivid</option></select></label><label class="field"><span>Effect colour</span><input type="color" data-layer-effect-color value="${escapeHtml(savedEffect?.color || CINEMATIC_EFFECTS[savedEffect?.type === "auto" ? suggestedEffect : savedEffect?.type]?.color || "#ff8136")}"${savedEffect ? "" : " disabled"}></label><label class="opacity-row"><span>Effect opacity</span><input type="range" data-layer-effect-opacity min="0.05" max="1" step="0.05" value="${savedEffect?.opacity ?? 1}"${savedEffect ? "" : " disabled"}><output data-layer-effect-opacity-output>${Math.round((savedEffect?.opacity ?? 1) * 100)}%</output></label><label class="opacity-row"><span>Intensity</span><input type="range" data-layer-effect-intensity min="0.25" max="2" step="0.25" value="${savedEffect?.intensity ?? 1}"${savedEffect ? "" : " disabled"} aria-label="Effect intensity"><output data-layer-effect-intensity-output>${Number(savedEffect?.intensity ?? 1).toFixed(2).replace(/\.00$/, "")}×</output></label><label class="opacity-row"><span>Motion speed</span><input type="range" data-layer-effect-speed min="0.1" max="3" step="0.1" value="${savedEffect?.speed ?? 1}"${savedEffect ? "" : " disabled"}><output data-layer-effect-speed-output>${Number(savedEffect?.speed ?? 1).toFixed(1)}×</output></label><label class="opacity-row"><span>Symbol density</span><input type="range" data-layer-effect-density min="0.25" max="2.5" step="0.05" value="${savedEffect?.density ?? 1}"${savedEffect ? "" : " disabled"}><output data-layer-effect-density-output>${Number(savedEffect?.density ?? 1).toFixed(2).replace(/0$/, "")}×</output></label></div><p class="form-note" data-layer-effect-note>${escapeHtml(effectNote(savedEffect?.type || "none"))}</p></fieldset>`
      : `<fieldset class="feedback-settings layer-effect"><legend>Animated effect</legend><p class="form-note">${layer.geometryType ? "Animated effects need the MapLibre engine (Display settings → Map engine)." : "Animated effects need a layer with features."}</p></fieldset>`;
    // Ranked styles computed from the field's values (renderer-spec.js suggestRenderers).
    const canSuggest = fields.length && layer.queryable;
    const styleOptions = canSuggest
      ? `<section class="style-options" aria-label="Style options"><div class="style-options__head"><strong>Style options</strong><button type="button" class="link-button" data-suggest-styles>Suggest styles for this field</button></div><div class="field-grid"><label class="field"><span>Suggestion field</span><select data-suggestion-field>${fieldOptions(fields, "No fields available", currentField || preferredNumericField?.name)}</select></label><label class="field"><span>Colour range</span><select data-style-ramp>${Object.keys(RAMPS).map((name) => `<option value="${name}">${escapeHtml(name.replaceAll("-", " "))}</option>`).join("")}</select></label></div><div class="style-options__list" data-style-options-list aria-live="polite"></div></section>`
      : "";
    pane.innerHTML = `<div class="workspace-tool"><p class="eyebrow">Layer presentation</p><h3>Style ${escapeHtml(layer.title || "layer")}</h3>${styleOptions}<div class="field-grid">${rendererControls}<label class="field" data-single-color><span>Symbol color</span><input data-symbol-color type="color" value="#1b7f6a" /></label><label class="field"><span>Outline</span><input data-symbol-outline type="color" value="#ffffff" /></label><label class="field"><span>Size / width</span><input data-symbol-size type="number" min="0.5" max="40" step="0.5" value="9" /></label></div>${pointSymbolControls}<section data-class-editor hidden><h4>Classes and colors</h4><div class="field-grid"><label class="field"><span>Palette</span><select data-class-ramp>${Object.keys(RAMPS).map((name) => `<option value="${name}">${escapeHtml(name.replaceAll("-", " "))}</option>`).join("")}</select></label><label class="display-checkbox"><input type="checkbox" data-class-reverse> Reverse palette</label></div><p class="form-note">Colors can be changed individually. Apply symbology to update the map.</p><div data-class-list aria-live="polite"></div></section>${polygonControls}${extrusionControls}${effectControls}<p class="form-note">Class previews use up to 20,000 loaded values matching the layer filter. Renderer settings are stored with the project.</p><div class="workspace-tool__actions"><button type="button" class="button--primary" data-apply-symbology>Apply symbology</button></div></div>`;
    const effectSelect = pane.querySelector("[data-layer-effect]");
    const effectIntensity = pane.querySelector("[data-layer-effect-intensity]");
    const effectControlsInputs = [...pane.querySelectorAll("[data-layer-effect-style], [data-layer-effect-color], [data-layer-effect-opacity], [data-layer-effect-intensity], [data-layer-effect-speed], [data-layer-effect-density]")];
    const applyEffect = async () => {
      const type = effectSelect.value;
      effectControlsInputs.forEach((input) => { input.disabled = type === "none"; });
      pane.querySelector("[data-layer-effect-note]").textContent = effectNote(type);
      try {
        await this.mapController.setLayerEffect(uid, { type,
          intensity: Number(effectIntensity.value) || 1,
          color: pane.querySelector("[data-layer-effect-color]").value,
          opacity: Number(pane.querySelector("[data-layer-effect-opacity]").value) || 1,
          style: pane.querySelector("[data-layer-effect-style]").value,
          speed: Number(pane.querySelector("[data-layer-effect-speed]").value) || 1,
          density: Number(pane.querySelector("[data-layer-effect-density]").value) || 1,
        });
      } catch (error) { this.error(`Could not apply the animated effect: ${error.message}`); }
    };
    effectSelect?.addEventListener("change", () => void applyEffect());
    const effectOutput = (selector, output, format) => pane.querySelector(selector)?.addEventListener("input", (event) => { pane.querySelector(output).value = format(Number(event.currentTarget.value)); });
    effectOutput("[data-layer-effect-opacity]", "[data-layer-effect-opacity-output]", (value) => `${Math.round(value * 100)}%`);
    effectOutput("[data-layer-effect-intensity]", "[data-layer-effect-intensity-output]", (value) => `${value.toFixed(2).replace(/\.00$/, "")}×`);
    effectOutput("[data-layer-effect-speed]", "[data-layer-effect-speed-output]", (value) => `${value.toFixed(1)}×`);
    effectOutput("[data-layer-effect-density]", "[data-layer-effect-density-output]", (value) => `${value.toFixed(2).replace(/0$/, "")}×`);
    effectControlsInputs.forEach((input) => input.addEventListener("change", () => void applyEffect()));
    const fillOpacity = pane.querySelector("[data-symbol-fill-opacity]");
    fillOpacity?.addEventListener("input", () => {
      fillOpacity.nextElementSibling.value = `${Math.round(Number(fillOpacity.value) * 100)}%`;
    });
    const styleMode = pane.querySelector("[data-style-mode]");
    const styleFieldControl = pane.querySelector("[data-style-field-control]");
    const styleField = pane.querySelector("[data-style-field]");
    pane.querySelectorAll("[data-symbol-gallery]").forEach((button) => button.addEventListener("click", () => {
      selectedMarkerSymbol = button.dataset.symbolGallery || "";
      selectedSpec = null;
      if (styleMode) styleMode.value = "simple";
      pane.querySelectorAll("[data-symbol-gallery]").forEach((item) => { const selected = item === button; item.classList.toggle("is-selected", selected); item.setAttribute("aria-checked", String(selected)); });
      syncStyleField();
    }));
    const syncStyleField = () => {
      if (!styleMode || !styleFieldControl || !styleField) return;
      pane.querySelector("[data-single-color]").hidden = ["categorized", "color", "size-color", "heatmap"].includes(styleMode.value);
      const needsField = styleMode.value !== "simple";
      styleFieldControl.hidden = !needsField;
      if (!needsField) return;
      const numeric = ["graduated", "color", "size-color"].includes(styleMode.value);
      const available = numeric ? numericFields : fields;
      const previous = styleField.value;
      styleField.innerHTML = fieldOptions(available, numeric ? "No numeric fields available" : "No fields available", available.some((item) => item.name === previous) ? previous : currentField || preferredNumericField?.name);
      styleField.disabled = !available.length;
    };
    if (layer.geometryType === "polygon" && styleMode) ["graduated", "size-color"].forEach((value) => { styleMode.querySelector(`option[value="${value}"]`).disabled = true; });
    styleMode?.addEventListener("change", () => {
      syncStyleField();
      const type = styleMode.value === "categorized" ? "categories" : styleMode.value === "color" ? "choropleth" : ["graduated", "size-color"].includes(styleMode.value) ? (layer.geometryType !== "polygon" ? "graduated-symbols" : "choropleth") : styleMode.value;
      selectedSpec = { type, ...(styleMode.value !== "simple" && styleField?.value ? { field: styleField.value } : {}), ...(styleMode.value === "size-color" ? { ramp: pane.querySelector("[data-class-ramp]").value } : {}) };
      void renderClasses();
    });
    styleField?.addEventListener("change", () => {
      if (selectedSpec && selectedSpec.field !== styleField.value) {
        selectedSpec.field = styleField.value;
        delete selectedSpec.breaks;
        delete selectedSpec.classColors;
        delete selectedSpec.colors;
        void renderClasses();
      }
    });
    syncStyleField();
    let classRequest = 0;
    const classEditor = pane.querySelector("[data-class-editor]"), classList = pane.querySelector("[data-class-list]"), classRamp = pane.querySelector("[data-class-ramp]"), classReverse = pane.querySelector("[data-class-reverse]");
    const renderClasses = async (resetCategoryPalette = false) => {
      const spec = selectedSpec, request = ++classRequest;
      const classed = spec && ["categories", "choropleth", "graduated-symbols"].includes(spec.type) && spec.field;
      classEditor.hidden = !classed;
      if (!classed) return;
      classList.textContent = "Reading values…";
      try {
        const raw = await this.mapController.fieldValues(uid, spec.field);
        if (request !== classRequest || selectedSpec !== spec) return;
        const counts = new Map(); raw.filter((v) => v != null).forEach((v) => counts.set(v, (counts.get(v) || 0) + 1));
        const values = raw.filter((v) => v != null && v !== "").map(Number).filter(Number.isFinite);
        const rendered = compileRenderer(spec, { geometryType: layer.geometryType, values, categories: [...counts].map(([value, count]) => ({ value, count })) });
        const entries = rendered.classBreakInfos || rendered.uniqueValueInfos || [];
        if (resetCategoryPalette && spec.type === "categories") {
          const colors = rampColors(classRamp.value, entries.length); if (classReverse.checked) colors.reverse();
          spec.colors = Object.fromEntries(entries.map((entry, index) => [String(entry.value), colors[index]]));
          entries.forEach((entry, index) => { entry.symbol.color = colors[index]; });
        }
        classList.innerHTML = entries.length ? entries.map((entry, index) => `<label class="style-class-row"><input type="color" data-class-color="${index}" aria-label="Color for ${escapeHtml(entry.label || entry.value)}" value="${escapeHtml(entry.symbol.color || "#1b7f6a")}"><span>${escapeHtml(entry.label || entry.value)}${spec.type === "graduated-symbols" ? ` · ${Math.round((entry.symbol.size ?? entry.symbol.width ?? 0) * 10) / 10} pt` : ""}</span></label>`).join("") : '<p class="form-note">No values available to classify.</p>';
        classList.querySelectorAll("[data-class-color]").forEach((input, index) => input.addEventListener("input", () => {
          entries[index].symbol.color = input.value;
          if (spec.type === "categories") spec.colors = { ...spec.colors, [String(entries[index].value)]: input.value };
          else spec.classColors = entries.map((entry) => entry.symbol.color);
        }));
      } catch (error) { if (request === classRequest) classList.textContent = `Could not preview classes: ${error.message}`; }
    };
    const applyPalette = () => {
      if (!selectedSpec) return;
      if (selectedSpec.type !== "categories") {
        selectedSpec.ramp = classRamp.value; selectedSpec.reverseRamp = classReverse.checked; delete selectedSpec.classColors;
        if (selectedSpec.type === "graduated-symbols" && styleMode?.value === "graduated") { styleMode.value = "size-color"; syncStyleField(); }
      }
      void renderClasses(selectedSpec.type === "categories");
    };
    classRamp.addEventListener("change", applyPalette); classReverse.addEventListener("change", applyPalette);
    pane.querySelector("[data-symbol-color]").addEventListener("input", (event) => {
      if (selectedSpec?.type === "graduated-symbols" && !selectedSpec.ramp) { selectedSpec.color = event.target.value; delete selectedSpec.classColors; void renderClasses(); }
    });
    pane.querySelector("[data-suggest-styles]")?.addEventListener("click", () => {
      // With no field chosen, the most measurement-like field is used (renderer-spec.js chooseStyleField).
      const field = pane.querySelector("[data-suggestion-field]")?.value;
      void this.#showStyleOptions(uid, pane.querySelector("[data-style-options-list]"), field || null, applySuggestion, layer);
    });
    pane.querySelector("[data-suggestion-field]")?.addEventListener("change", () => pane.querySelector("[data-suggest-styles]").click());
    pane.querySelector("[data-style-ramp]")?.addEventListener("change", (event) => {
      event.target.dataset.userSelected = "true";
      pane.querySelector("[data-symbol-color]").value = rampColors(event.target.value, 5)[2];
    });
    const extrusionEnabled = pane.querySelector("[data-extrusion-enabled]");
    const extrusionOptions = pane.querySelector("[data-extrusion-options]");
    const extrusionSource = pane.querySelector("[data-extrusion-source]");
    const extrusionValueControl = pane.querySelector("[data-extrusion-value-control]");
    const extrusionFieldControl = pane.querySelector("[data-extrusion-field-control]");
    const extrusionMultiplierControl = pane.querySelector("[data-extrusion-multiplier-control]");
    const spatialChartMode = pane.querySelector("[data-spatial-chart-mode]");
    const spatialGroupControl = pane.querySelector("[data-spatial-group-control]");
    const spatialSlotControl = pane.querySelector("[data-spatial-slot-control]");
    const spatialGapControl = pane.querySelector("[data-spatial-gap-control]");
    const spatialOrderControl = pane.querySelector("[data-spatial-order-control]");
    if (spatialChartMode && savedChart?.mode) spatialChartMode.value = savedChart.mode;
    const syncExtrusion = () => {
      if (!extrusionEnabled || !extrusionOptions) return;
      extrusionOptions.hidden = !extrusionEnabled.checked;
      const grouped = spatialChartMode && spatialChartMode.value !== "attribute-extrusion";
      if (spatialGroupControl) spatialGroupControl.hidden = !grouped;
      if (spatialSlotControl) spatialSlotControl.hidden = !grouped;
      if (spatialGapControl) spatialGapControl.hidden = !grouped;
      if (spatialOrderControl) spatialOrderControl.hidden = !grouped;
      if (extrusionSource && !grouped) extrusionSource.value = "field";
      const usingField = extrusionSource?.value === "field";
      if (extrusionValueControl) extrusionValueControl.hidden = usingField;
      if (extrusionFieldControl) extrusionFieldControl.hidden = !usingField;
      if (extrusionMultiplierControl) extrusionMultiplierControl.hidden = !usingField;
      const note = pane.querySelector("[data-spatial-chart-note]");
      if (note) note.textContent = grouped
        ? "Vertical position is a display slot, not physical altitude. Source footprints are preserved; this fast display does not calculate exact overlap partitions."
        : "Height is a display value, separate from terrain or physical altitude.";
    };
    extrusionEnabled?.addEventListener("change", syncExtrusion);
    extrusionSource?.addEventListener("change", syncExtrusion);
    spatialChartMode?.addEventListener("change", syncExtrusion);
    syncExtrusion();
    const populateSpec = (spec) => {
      selectedSpec = structuredClone(spec);
      if (styleMode) styleMode.value = spec.type === "categories" ? "categorized" : spec.type === "choropleth" ? "color" : spec.type === "graduated-symbols" ? (spec.ramp ? "size-color" : "graduated") : spec.type === "heatmap" ? "heatmap" : "simple";
      syncStyleField();
      if (styleField && spec.field) styleField.value = spec.field;
      if (pane.querySelector("[data-style-ramp]")) pane.querySelector("[data-style-ramp]").value = spec.ramp || "greens";
      pane.querySelector("[data-symbol-color]").value = spec.type === "choropleth" ? rampColors(spec.ramp || "greens", 5)[2] : spec.color || (spec.type === "graduated-symbols" ? "#d9951e" : "#1b7f6a");
      if (spec.outline) pane.querySelector("[data-symbol-outline]").value = spec.outline;
      if (spec.size) pane.querySelector("[data-symbol-size]").value = spec.size;
      classRamp.value = spec.ramp || "greens"; classReverse.checked = Boolean(spec.reverseRamp);
      void renderClasses();
    };
    if (selectedSpec) populateSpec(selectedSpec);
    const applySuggestion = async (option) => {
      if (option.is3d) {
        selectedSpec = null;
        if (styleMode) styleMode.value = "simple";
        syncStyleField();
        extrusionEnabled.checked = true;
        if (spatialChartMode) spatialChartMode.value = "attribute-extrusion";
        extrusionSource.value = option.heightField ? "field" : "fixed";
        if (option.heightField) pane.querySelector("[data-extrusion-field]").value = option.heightField;
        syncExtrusion();
        if (option.heightField && this.mapController.getCapabilities().includes("spatial-chart-3d")) await this.mapController.setSpatialChart(uid, { type:"spatial-3d-chart", mode:"attribute-extrusion", height:{ field:option.heightField, scale:Number(pane.querySelector("[data-extrusion-multiplier]").value) || 1 }, color:{ field:option.heightField, strategy:"original" }, geometry:{ strategy:"source-footprints", aggregation:"none" } });
        else await this.mapController.setLayerSymbology(uid, { mode: "simple", color: pane.querySelector("[data-symbol-color]").value, outline: pane.querySelector("[data-symbol-outline]").value, size: pane.querySelector("[data-symbol-size]").value, extrusionEnabled: true, extrusionSource: extrusionSource.value, extrusionField: option.heightField, extrusionValue: pane.querySelector("[data-extrusion-value]").value, extrusionMultiplier: pane.querySelector("[data-extrusion-multiplier]").value, extrusionWidth: pane.querySelector("[data-extrusion-width]")?.value });
      } else {
        const result = await this.mapController.applyRendererSpec(uid, option.pinnedSpec);
        if (extrusionEnabled) extrusionEnabled.checked = false;
        syncExtrusion();
        populateSpec(result?.spec || option.pinnedSpec);
      }
    };
    pane.querySelector("[data-apply-symbology]").addEventListener("click", async () => {
      try {
        if (selectedSpec && !extrusionEnabled?.checked && !selectedMarkerSymbol) {
          const spec = structuredClone(selectedSpec);
          if (spec.type === "choropleth") spec.ramp = spec.ramp || classRamp.value || "greens";
          if (["simple", "graduated-symbols"].includes(spec.type)) spec.color = pane.querySelector("[data-symbol-color]").value;
          if (spec.type === "simple") { spec.outline = pane.querySelector("[data-symbol-outline]").value; spec.size = Number(pane.querySelector("[data-symbol-size]").value); }
          await this.mapController.applyRendererSpec(uid, spec);
          if (this.mapController.getCapabilities().includes("spatial-chart-3d")) await this.mapController.setSpatialChart(uid, null);
          selectedSpec = spec;
          void renderClasses();
        } else {
          if (selectedSpec && extrusionEnabled?.checked && ["choropleth", "categories"].includes(selectedSpec.type)) {
            const spec = structuredClone(selectedSpec);
            if (spec.type === "choropleth") spec.ramp = spec.ramp || classRamp.value || "greens";
            await this.mapController.applyRendererSpec(uid, spec);
          }
          const symbology = {
          mode: styleMode?.value === "color" || styleMode?.value === "size-color" ? "graduated" : styleMode?.value || "simple",
          preserveClasses: Boolean(selectedSpec && ["choropleth", "categories"].includes(selectedSpec.type)),
          field: styleField?.value,
          color: pane.querySelector("[data-symbol-color]").value,
          outline: pane.querySelector("[data-symbol-outline]").value,
          size: pane.querySelector("[data-symbol-size]").value,
          markerSymbol: selectedMarkerSymbol || undefined,
          fillOpacity: fillOpacity?.value,
          noFill: pane.querySelector("[data-symbol-no-fill]")?.checked ?? false,
          extrusionEnabled: extrusionEnabled?.checked ?? false,
          extrusionSource: extrusionSource?.value || "fixed",
          extrusionValue: pane.querySelector("[data-extrusion-value]")?.value,
          extrusionField: pane.querySelector("[data-extrusion-field]")?.value,
          extrusionMultiplier: pane.querySelector("[data-extrusion-multiplier]")?.value,
          extrusionWidth: pane.querySelector("[data-extrusion-width]")?.value,
          };
          if (extrusionEnabled?.checked && this.mapController.getCapabilities().includes("spatial-chart-3d")) {
            const grouped = spatialChartMode.value !== "attribute-extrusion";
            await this.mapController.setSpatialChart(uid, {
              type: "spatial-3d-chart",
              mode: spatialChartMode.value,
              ...(grouped ? { groupBy: pane.querySelector("[data-spatial-group-field]").value } : {}),
              ...(grouped && pane.querySelector("[data-spatial-order]")?.checked ? { order: "descending" } : {}),
              ...(pane.querySelector("[data-spatial-ground-outlines]")?.checked ? { groundOutlines: true } : {}),
              height: {
                ...(extrusionSource.value === "field" ? { field: pane.querySelector("[data-extrusion-field]").value } : {}),
                scale: Number(pane.querySelector("[data-extrusion-multiplier]")?.value) || 1,
                thicknessMeters: Number(pane.querySelector("[data-extrusion-value]")?.value) || 120,
                slotMeters: Number(pane.querySelector("[data-spatial-slot]")?.value) || 400,
                gapMeters: Number(pane.querySelector("[data-spatial-gap]")?.value) || 0,
              },
              color: { field: grouped ? pane.querySelector("[data-spatial-group-field]").value : pane.querySelector("[data-extrusion-field]").value, strategy: grouped ? "sequential" : "original" },
              geometry: { strategy: "source-footprints", aggregation: "none" },
              interaction: { hover:true, select:true, explode:spatialChartMode.value === "exploded-timeline", scrubTimeline:["temporal-strata","exploded-timeline"].includes(spatialChartMode.value) },
            });
          } else await this.mapController.setLayerSymbology(uid, symbology);
        }
        const persisted = this.projectManager.persistCurrentIfSaved();
        this.toast(`Updated ${layer.title || "layer"} symbology${persisted ? " and saved it" : ""}.`);
      } catch (error) { this.error(error.message); }
    });
    this.#syncUtilityPanel("style");
  }

  async #showStyleOptions(uid, list, field, applySuggestion, layer) {
    if (!list) return;
    list.innerHTML = '<p class="form-note">Reading the field’s values…</p>';
    let suggestion;
    try {
      suggestion = await this.mapController.suggestRenderers(uid, { field });
    } catch (error) {
      list.innerHTML = `<p class="form-note">${escapeHtml(error.message)}</p>`;
      return;
    }
    if (list.closest(".workspace-tool")?.querySelector("[data-suggestion-field]")?.value !== field) return;
    const { stats, fieldAlias } = suggestion;
    const options = [...suggestion.options];
    const rampControl = list.closest(".workspace-tool").querySelector("[data-style-ramp]");
    if (rampControl && !rampControl.dataset.userSelected) {
      rampControl.value = options.find((option) => option.spec?.type === "choropleth")?.spec.ramp || rampControl.value;
      list.closest(".workspace-tool").querySelector("[data-symbol-color]").value = rampColors(rampControl.value, 5)[2];
    }
    if ((this.mapController.getEngineId() === "arcgis" && ["polygon", "point", "multipoint"].includes(layer.geometryType)) || (this.mapController.getEngineId() === "maplibre" && layer.geometryType === "polygon")) {
      const heightField = stats.min != null && stats.min >= 0 && stats.max > 0 ? field : null;
      options.push({ label: layer.geometryType === "polygon" ? "3D extruded areas" : "3D columns", reason: heightField ? `Height is based on ${fieldAlias}; adjust its multiplier below.` : "A fixed height gives features depth; adjust it below.", is3d: true, heightField, spec: {} });
    }
    const number = (value) => (value == null ? "" : Number(value).toLocaleString("en-US", { maximumFractionDigits: 2 }));
    const summary = stats.min !== undefined && stats.min !== null
      ? `${number(stats.count)} values from ${number(stats.min)} to ${number(stats.max)}${stats.excluded ? ` · ${number(stats.excluded)} shown as “No data”` : ""}${suggestion.sampled ? " · first 20,000 features" : ""}`
      : `${number(stats.distinct ?? 0)} distinct values`;
    if (!options.length) {
      list.innerHTML = `<p class="form-note">${escapeHtml(fieldAlias)} has no values to style by.</p>`;
      return;
    }
    const preview = (option) => {
      const { spec, breaks } = option;
      if (!breaks?.length) return "";
      const colors = (spec.type === "choropleth" || (spec.type === "graduated-symbols" && spec.ramp)) ? rampColors(list.closest(".workspace-tool").querySelector("[data-style-ramp]")?.value || spec.ramp || "greens", breaks.length) : breaks.map(() => spec.color || "#d9951e");
      let lower = stats.min;
      return `<ol class="style-option__classes">${breaks.map((upper, index) => {
        const label = `${number(lower)} – ${number(upper)}`;
        lower = upper;
        const size = spec.type === "graduated-symbols" ? 6 + (10 * index) / Math.max(1, breaks.length - 1) : 12;
        return `<li title="${escapeHtml(label)}"><span class="style-option__swatch${spec.type === "graduated-symbols" ? " is-symbol" : ""}" style="background:${colors[index]};width:${size}px;height:${size}px"></span>${escapeHtml(label)}</li>`;
      }).join("")}</ol>`;
    };
    list.innerHTML = `<p class="form-note">${escapeHtml(fieldAlias)}: ${escapeHtml(summary)}</p>${options.map((option, index) => `<article class="style-option${option.recommended ? " is-recommended" : ""}" data-option-type="${escapeHtml(option.spec?.type || "3d")}" data-option-ramp="${option.spec?.ramp ? "true" : "false"}"><div class="style-option__title"><strong>${escapeHtml(option.label)}</strong>${option.recommended ? '<span class="style-option__badge">Recommended</span>' : ""}</div><p>${escapeHtml(option.reason)}</p>${preview(option)}<button type="button" class="button--secondary" data-use-style-option="${index}">Use this style</button></article>`).join("")}`;
    if (rampControl) rampControl.onchange = () => {
      rampControl.dataset.userSelected = "true";
      list.querySelectorAll('[data-option-type="choropleth"], [data-option-type="graduated-symbols"][data-option-ramp="true"]').forEach((card) => {
        const swatches = card.querySelectorAll(".style-option__swatch");
        const colors = rampColors(rampControl.value, swatches.length);
        swatches.forEach((swatch, index) => { swatch.style.background = colors[index]; });
      });
      list.closest(".workspace-tool").querySelector("[data-symbol-color]").value = rampColors(rampControl.value, 5)[2];
    };
    list.querySelectorAll("[data-use-style-option]").forEach((button) => button.addEventListener("click", async () => {
      const option = options[Number(button.dataset.useStyleOption)];
      try {
        // The pinned spec keeps these exact classes in saved projects and shared links.
        const ramp = list.closest(".workspace-tool").querySelector("[data-style-ramp]")?.value;
        const adjusted = (option.pinnedSpec?.type === "choropleth" || option.pinnedSpec?.ramp) && ramp ? { ...option, pinnedSpec: { ...option.pinnedSpec, ramp } } : option;
        await applySuggestion(adjusted);
        list.querySelectorAll(".style-option").forEach((card, cardIndex) => card.classList.toggle("is-applied", cardIndex === Number(button.dataset.useStyleOption)));
        const persisted = this.projectManager.persistCurrentIfSaved();
        this.toast(`Styled by ${fieldAlias}: ${option.label.toLowerCase()}${persisted ? ", and saved" : ""}.`);
      } catch (error) { this.error(error.message); }
    }));
  }

  #refreshDialog(uid) {
    const layer = this.mapController.getLayer(uid);
    const current = layer.refreshInterval;
    this.openDialog({
      eyebrow: "Live data",
      title: `Refresh ${layer?.title || "layer"}`,
      content: `<label class="field"><span>Refresh interval <small>minutes; 0 disables</small></span><input id="layer-refresh" type="number" min="0" step="0.5" value="${current}" /></label>`,
      actions: [
        { label: "Refresh now", handler: () => { this.mapController.refreshLayer(uid); this.toast("Refresh requested."); } },
        { label: "Save interval", primary: true, handler: () => {
          try {
            this.mapController.setRefreshInterval(uid, this.dialog.querySelector("#layer-refresh").value);
            this.dialog.close();
          } catch (error) { this.error(error.message); }
        }},
      ],
    });
  }

  #renderInsight(payload) {
    this.#clearInsightIsolation();
    this.lastInsight = payload;
    this.identifyPending = false;
    const results = payload.results ?? [];
    const visibleResults = results.slice(0, 12);
    this.selectedInsightIndexes = new Set(visibleResults.length ? [0] : []);
    payload.selectedResults = visibleResults.length ? [visibleResults[0]] : [];
    const tabsHtml = visibleResults.length
      ? `<div class="insight-tabs" role="tablist" aria-label="Identified features">${visibleResults.map((result, index) =>
          `<button type="button" role="tab" id="insight-tab-${index}" data-insight-tab="${index}" aria-controls="insight-panel-${index}" aria-selected="${index === 0}">${escapeHtml(result.layerTitle)} ${index + 1}</button>`,
        ).join("")}</div>`
      : "";
    const aiEnabled = this.aiController.isConfigured();
    document.querySelector("#insights-ai").hidden = !aiEnabled;
    const resultHtml = visibleResults.map((result, index) => {
        const layer = this.mapController.getLayer(result.layerUid);
        const fieldsByName = new Map((layer?.fields ?? []).map((field) => [field.name, field]));
        const feature = summarizeFeature(result.attributes, { ...layer, title: result.layerTitle });
        const rows = (entries) => entries.map(([key, value]) => `<div><dt>${escapeHtml(fieldsByName.get(key)?.alias || key)}</dt><dd>${escapeHtml(formatAttributeValue(value, fieldsByName.get(key), key))}</dd></div>`).join("");
        const selection = aiEnabled
          ? `<label class="insight-ai-select"><input type="checkbox" data-ai-selection="${index}" ${index === 0 ? "checked" : ""}> Include in AI</label>`
          : "";
        return `<article class="insight-panel" id="insight-panel-${index}" role="tabpanel" aria-labelledby="insight-tab-${index}" ${index === 0 ? "" : "hidden"}><header><span><strong>${escapeHtml(feature.title)}</strong><small>${escapeHtml(result.layerTitle)}</small></span>${selection}</header>${result.kind === "feature" ? `<div class="insight-note-actions">${result.geometry ? `<button type="button" data-feature-zoom="${index}">Zoom to feature</button>` : ""}${payload.point ? `<button type="button" data-feature-note="${index}">+ Field observation</button><button type="button" data-feature-map-note="${index}">+ Map Note</button>` : ""}</div>` : ""}<dl>${rows(feature.summary) || "<div><dd>No attributes returned.</dd></div>"}</dl>${feature.remaining.length ? `<details class="insight-attributes"><summary>View all attributes (${feature.summary.length + feature.remaining.length})</summary><dl>${rows(feature.remaining)}</dl></details>` : ""}</article>`;
      }).join("");
    document.querySelector(".orbital-insight-details")?.remove();
    this.#renderIntelligenceContents();
    const overlay = document.querySelector("#insights-overlay");
    overlay.setAttribute("aria-busy", "false");
    if (results.length) {
      document.querySelector("#insights-title").textContent =
        results.length === 1 ? results[0].layerTitle : `${results.length} features`;
      const orbitalGlobe = document.querySelector("#app")?.dataset.applicationLayout === "globe" && !this.mobileMedia.matches;
      if (orbitalGlobe) {
        const intelligence = document.querySelector("#intelligence-content");
        intelligence?.insertAdjacentHTML("beforeend", `<details class="orbital-insight-details" open><summary>Selected feature attributes</summary><div class="orbital-insight-details__content">${tabsHtml}${resultHtml}</div></details>`);
        document.querySelector("#insights-content").replaceChildren();
        this.#setInsightsOpen(false);
      } else {
        document.querySelector("#insights-content").innerHTML = `${tabsHtml}${resultHtml}`;
        this.#setInsightsOpen(true);
      }
      document.querySelectorAll("[data-insight-tab]").forEach((button) =>
        button.addEventListener("click", () => this.#activateInsightTab(Number(button.dataset.insightTab), true)),
      );
      document.querySelectorAll("[data-feature-zoom]").forEach((button) => button.addEventListener("click", () => {
        const result = visibleResults[Number(button.dataset.featureZoom)];
        if (result) void Promise.resolve().then(() => this.mapController.goToFeature(result)).catch((error) => this.error(error.message || "Could not zoom to this feature."));
      }));
      document.querySelectorAll("[data-insight-tab]").forEach((button) =>
        button.addEventListener("dblclick", (event) => {
          event.preventDefault();
          this.#isolateInsightResult(Number(button.dataset.insightTab));
        }),
      );
      document.querySelectorAll("[data-feature-note]").forEach((button) => button.addEventListener("click", () => {
        const result = visibleResults[Number(button.dataset.featureNote)];
        const layer = result && this.mapController.getLayer(result.layerUid);
        const config = layer && this.mapController.getLayerConfig(layer);
        const feature = noteFeatureReference(result, layer, config);
        openMapNotesPanel(this, { point: [payload.point.longitude, payload.point.latitude], feature, featureUnavailable: !feature });
      }));
      document.querySelectorAll("[data-ai-selection]").forEach((input) =>
        input.addEventListener("change", () => this.#setInsightSelection(Number(input.dataset.aiSelection), input.checked)),
      );
      document.querySelectorAll("[data-feature-map-note]").forEach(button => button.addEventListener("click", () => {
        if (this.dataMapNotesOpen && this.captureDataMapNoteDraft?.() && !globalThis.confirm("Starting a Map Note from this feature will replace the current session draft. Continue?")) return;
        const result = visibleResults[Number(button.dataset.featureMapNote)];
        const layer = result && this.mapController.getLayer(result.layerUid);
        const feature = noteFeatureReference(result, layer, layer && this.mapController.getLayerConfig(layer));
        const target = feature ? { type: feature.featureId ? "feature" : "dataset", datasetId: feature.datasetId, ...(feature.featureId ? { featureId: feature.featureId } : {}), ...(feature.sourceUrl ? { sourceUrl: feature.sourceUrl } : {}) } : null;
        if (!target) this.toast("Enter a dataset or feature ID to link this Map Note.");
        openDataMapNotesPanel(this, { target });
      }));
      void this.mapController.highlightFeature(visibleResults[0], { pulse: false });
    } else {
      this.mapController.clearFeatureHighlight();
      document.querySelector("#insights-content").replaceChildren();
      this.#setInsightsOpen(false);
    }
  }

  #renderIntelligenceContents(payload = this.intelligenceInsight) {
    const target = document.querySelector("#intelligence-content");
    if (!target) return;
    const point = payload?.point;
    const coord = point ? `${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}` : "Unknown location";
    const selectedCount = payload?.selectedResults?.length ?? 0;
    const locationHtml = payload
      ? `<div class="location-card"><span class="eyebrow">Location</span><strong>${escapeHtml(payload.address?.address || coord)}</strong><small>${escapeHtml(coord)}</small></div>`
      : '<div class="intelligence-empty">Click a location to inspect its address, coordinates, and available context.</div>';
    const aiForm = this.aiController.isConfigured() && payload
      ? `<form class="ai-question"><label>Ask about this map context <small class="ai-selection-count">· ${selectedCount} feature${selectedCount === 1 ? "" : "s"} selected</small></label><div><input aria-label="Question about this map context" placeholder="What stands out here?" /><button>Ask AI</button></div></form>`
      : "";
    const responseHtml = this.lastAIResponseText
      ? `<section class="ai-response"><div class="ai-response__header"><span class="eyebrow">AI insights</span><span><button type="button" class="ai-response__download">Download report</button><button type="button" class="ai-response__clear">Clear insights</button></span></div><p class="ai-response__query"><strong>Query</strong><span>${escapeHtml(this.lastAIQueryText || "Map context query")}</span></p><div class="ai-response__markdown">${renderMarkdown(this.lastAIResponseText)}</div></section>`
      : "";
    const locationReportHtml = payload?.point
      ? `<div class="intelligence-report-action"><button type="button" data-intelligence-note>Add a note</button>${!this.lastAIResponseText ? '<button type="button" class="location-report-download">Download location report</button>' : ""}</div>`
      : "";
    const loadingHtml = this.identifyPending
      ? '<div class="loading-row"><span></span> Inspecting location…</div>'
      : this.aiPending ? '<div class="loading-row ai-loading"><span></span> Generating AI insights…</div>' : "";
    const html = `${loadingHtml}${locationHtml}${aiForm}${locationReportHtml}${responseHtml}`;
    target.classList.toggle("intelligence-empty", !payload);
    // Orbital Globe embeds Map Insight here; updating Intelligence must not
    // destroy its tabs, selection or event handlers.
    const orbitalInsight = target.querySelector(".orbital-insight-details");
    target.innerHTML = html;
    if (orbitalInsight) target.append(orbitalInsight);
    target.querySelector(".ai-question")?.addEventListener("submit", (event) => {
        event.preventDefault();
        const prompt = event.currentTarget.querySelector("input").value.trim();
        this.#askAI(
          prompt || "Summarize the current map extent, clicked location, loaded map layers, and any selected data. Identify useful patterns and geographic context.",
          payload,
          prompt || "Current map extent and location",
        );
    });
    target.querySelector(".ai-response__clear")?.addEventListener("click", () => {
      this.lastAIResponseText = null;
      this.lastAIQueryText = null;
      this.#renderIntelligenceContents();
    });
    target.querySelector(".ai-response__download")?.addEventListener("click", () => this.#downloadAIReport(payload));
    target.querySelector("[data-intelligence-note]")?.addEventListener("click", () => openMapNotesPanel(this, { point: [payload.point.longitude, payload.point.latitude] }));
    target.querySelector(".location-report-download")?.addEventListener("click", () => this.#downloadAIReport(payload));
  }

  #askAI(prompt, payload = this.lastInsight, displayQuery = prompt) {
    if (document.body.dataset.navigationLayout === "top") this.#openIntelligenceUtility();
    this.intelligenceInsight = payload;
    this.lastAIQueryText = displayQuery;
    this.aiController.ask(prompt, payload).catch(() => {});
  }

  #activateInsightTab(index, selectFeature = false) {
    if (this.insightIsolation) this.#clearInsightIsolation();
    document.querySelectorAll("[data-insight-tab]").forEach((button) => {
      const active = Number(button.dataset.insightTab) === index;
      button.setAttribute("aria-selected", String(active));
      button.tabIndex = active ? 0 : -1;
    });
    document.querySelectorAll(".insight-panel").forEach((panel, panelIndex) => {
      panel.hidden = panelIndex !== index;
    });
    const result = this.lastInsight?.results?.slice(0, 12)[index];
    if (selectFeature) {
      this.selectedInsightIndexes.add(index);
      const input = document.querySelector(`[data-ai-selection="${index}"]`);
      if (input) input.checked = true;
      this.#syncInsightSelection();
      if (result?.geometry) {
        this.events.publish("insight:navigation-start", {});
        void Promise.resolve().then(() => this.mapController.goToFeature(result))
          .catch(() => {}).finally(() => this.events.publish("insight:navigation-end", {}));
      }
    }
    void this.mapController.highlightFeature(result, { pulse: true });
  }

  #isolateInsightResult(index) {
    const visibleResults = this.lastInsight?.results?.slice(0, 12) ?? [];
    const result = visibleResults[index];
    const layer = result ? this.mapController.getLayer(result.layerUid) : null;
    const objectIdField = layer?.objectIdField;
    const objectId = objectIdField ? result?.attributes?.[objectIdField] : null;
    if (!result || !layer || !layer.filterable || objectId == null) {
      this.error("This feature cannot be isolated because it has no usable object ID.");
      return;
    }
    if (this.insightIsolation) this.#clearInsightIsolation();
    const literal = typeof objectId === "number" && Number.isFinite(objectId)
      ? String(objectId)
      : `'${String(objectId).replaceAll("'", "''")}'`;
    const previousExpression = layer.where || null;
    const clause = `${objectIdField} = ${literal}`;
    const appliedExpression = previousExpression ? `(${previousExpression}) AND (${clause})` : clause;
    this.mapController.setDefinitionExpression(layer.uid, appliedExpression, { persist: false });
    this.insightIsolation = { index, layerUid: result.layerUid, previousExpression, appliedExpression };
    this.#syncInsightIsolationUI();
    void this.mapController.highlightFeature(result, { pulse: false });
  }

  #clearInsightIsolation() {
    const isolation = this.insightIsolation;
    if (!isolation) return false;
    const layer = this.mapController.getLayer(isolation.layerUid);
    // Do not overwrite a deliberate filter change made while the temporary
    // isolate mode was active.
    if (layer?.where === isolation.appliedExpression) {
      this.mapController.setDefinitionExpression(layer.uid, isolation.previousExpression, { persist: false });
    }
    this.insightIsolation = null;
    this.#syncInsightIsolationUI();
    return true;
  }

  #syncInsightIsolationUI() {
    const isolatedIndex = this.insightIsolation?.index;
    document.querySelectorAll("[data-insight-tab]").forEach((button) => {
      const muted = isolatedIndex != null && Number(button.dataset.insightTab) !== isolatedIndex;
      button.classList.toggle("is-isolated-muted", muted);
      button.setAttribute("aria-label", muted
        ? `${button.textContent.trim()} — click to show all selected features`
        : isolatedIndex != null
          ? `${button.textContent.trim()} — click to show all selected features`
          : button.textContent.trim());
    });
  }

  #setInsightSelection(index, selected) {
    if (selected) this.selectedInsightIndexes.add(index);
    else this.selectedInsightIndexes.delete(index);
    this.#syncInsightSelection();
  }

  #syncInsightSelection() {
    if (!this.lastInsight) return;
    const visibleResults = this.lastInsight?.results?.slice(0, 12) ?? [];
    this.lastInsight.selectedResults = [...this.selectedInsightIndexes]
      .sort((a, b) => a - b)
      .map((index) => visibleResults[index])
      .filter(Boolean);
    const count = this.lastInsight.selectedResults.length;
    document.querySelectorAll(".ai-selection-count").forEach((label) => {
      label.textContent = `· ${count} feature${count === 1 ? "" : "s"} selected`;
    });
  }

  #showAIResponse(text) {
    this.lastAIResponseText = text;
    this.#renderIntelligenceContents();
    const activeContent = this.activeUtilityTab === "intelligence"
      ? document.querySelector("#utility-intelligence-content")
      : document.querySelector("#intelligence-content");
    activeContent?.querySelector(".ai-response")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  async #downloadAIReport(payload = this.lastInsight) {
    if (!payload) {
      this.error("Click a location before downloading a report.");
      return;
    }
    const hasAIResponse = Boolean(this.lastAIResponseText);
    const logo = await loadBrandLogo();
    const mapCapture = await this.mapController.captureImage().catch(() => null);
    const point = payload?.point;
    const coordinates = point ? `${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}` : "Unknown location";
    const location = payload?.address?.address || coordinates;
    // Coordinates and the map open the app zoomed to this place, with a pin on it.
    const placeLink = point ? locationUrl(globalThis.location.href, { latitude: point.latitude, longitude: point.longitude }) : null;
    const mapImage = mapCapture?.dataUrl
      ? await brandedMapImage(mapCapture, { title: String(location).split(",")[0] || "Location", subtitle: `Location intelligence map · ${new Date().toLocaleString()}` })
      : null;
    const report = new PdfDocument({ heading: "LOCATION INTELLIGENCE REPORT", logo, homeUrl: APP_ROOT });
    const addLines = (text, options) => report.addLines(text, options);
    addLines(`Generated ${new Date().toLocaleString()}`, { size: 9, leading: 14, color: "0.36 0.44 0.41" });
    report.gap(10);
    addLines("Location", { size: 13, leading: 18, color: "0.08 0.36 0.30", bold: true });
    addLines(location, { size: 12, leading: 18, bold: true });
    addLines(`Coordinates: ${coordinates}`, { link: placeLink });
    const extent = this.mapController.getCurrentExtentDetails?.();
    if (extent) addLines(`Map extent: ${extent.west.toFixed(4)}, ${extent.south.toFixed(4)} to ${extent.east.toFixed(4)}, ${extent.north.toFixed(4)}${extent.zoom != null ? ` (zoom ${extent.zoom})` : ""}`);
    if (hasAIResponse) {
      report.gap(10);
      addLines("Query", { size: 13, leading: 18, color: "0.08 0.36 0.30", bold: true });
      addLines(this.lastAIQueryText || "Map context query", { size: 11, leading: 16 });
      report.gap(10);
      addLines("Generated intelligence", { size: 13, leading: 18, color: "0.08 0.36 0.30", bold: true });
      addLines(markdownToPlainText(this.lastAIResponseText), { size: 10, leading: 15 });
    } else {
      const reportResults = payload.selectedResults?.length ? payload.selectedResults : (payload.results ?? []).slice(0, 1);
      report.gap(10);
      addLines("Map Insight attributes", { size: 13, leading: 18, color: "0.08 0.36 0.30", bold: true });
      if (!reportResults.length) {
        addLines("No map feature was identified at the clicked location.");
      } else {
        reportResults.forEach((result) => {
          addLines(result.layerTitle || "Selected feature", { size: 11, leading: 16, bold: true });
          const attributes = Object.entries(result.attributes ?? {}).filter(([, value]) => value !== null && value !== "");
          if (!attributes.length) addLines("No attributes returned.");
          attributes.slice(0, 60).forEach(([key, value]) => {
            addLines(`${key}: ${typeof value === "object" ? JSON.stringify(value) : value}`, { size: 10, leading: 15 });
          });
          if (attributes.length > 60) addLines(`… ${attributes.length - 60} additional attributes omitted.`, { size: 9, leading: 14, color: "0.36 0.44 0.41" });
          report.gap(6);
        });
      }
    }
    if (mapImage) {
      report.newPage();
      addLines("Map snapshot", { size: 13, leading: 18, color: "0.08 0.36 0.30", bold: true });
      addLines(`The map view at the time this Location Intelligence Report was created.${placeLink ? " Click it to open this place in GISMap Online." : ""}`, { size: 9, leading: 14, color: "0.36 0.44 0.41" });
      report.addImage(mapImage, { maxHeight: 420, link: placeLink });
      const details = this.mapController.getCurrentExtentDetails();
      addLines(`Map extent: ${details?.west.toFixed(4)}, ${details?.south.toFixed(4)} to ${details?.east.toFixed(4)}, ${details?.north.toFixed(4)}`, { size: 9, leading: 14, color: "0.36 0.44 0.41" });
    }
    const slug = String(location).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 48) || "map-location";
    const download = document.createElement("a");
    download.href = URL.createObjectURL(report.toBlob());
    download.download = `location-intelligence-report-${slug}.pdf`;
    download.click();
    setTimeout(() => URL.revokeObjectURL(download.href), 1000);
    this.toast(hasAIResponse ? "Location Intelligence Report downloaded." : "Location report downloaded.");
  }

  /** Applies a skin as the spec or link asks, and keeps it with the project. */
  applySkinChoice(skin) {
    const applied = applyInterfaceSkin(skin, { colors: this.projectManager.current.presentation?.skinColors?.[normalizeSkin(skin)] });
    this.projectManager.patchPresentation({ skin: applied });
    // Effects without a colour of their own take the new skin's palette.
    this.cinematicController.refreshEffectDetail();
    if (this.mapController.getCapabilities().includes("three-3d")) {
      for (const layer of this.mapController.getLayers()) {
        const effect = layer.animatedEffect;
        if (effect && !effect.color) void Promise.resolve(this.mapController.setLayerEffect(layer.uid, effect)).catch(() => {});
      }
    }
  }

  setProjectTitle(title) {
    this.projectManager.current.name = String(title).slice(0, 160);
    document.querySelector("#project-name").textContent = this.projectManager.current.name;
  }

  async showLegendWidget() {
    // MapLibre's toggleWidget is synchronous; ArcGIS's returns a promise.
    if (!this.mapController.widgetOpen("legend")) await Promise.resolve().then(() => this.mapController.toggleWidget("legend")).catch(() => {});
  }

  /** Lists what a map spec or link could not do, so a person (or an agent reading describe()) can fix it. */
  showSpecIssues(issues = []) {
    const rows = issues.map((issue) => `<li class="spec-issue spec-issue--${issue.level}"><strong>${escapeHtml(issue.code || issue.level)}</strong> <code>${escapeHtml(issue.path || "")}</code><p>${escapeHtml(issue.message)}</p>${issue.hint ? `<small>${escapeHtml(issue.hint)}</small>` : ""}</li>`).join("");
    this.openDialog({
      eyebrow: "Map link",
      title: "Some of this map could not be shown",
      content: `<p class="form-note">Everything else on the map loaded. ${issues.length} issue${issues.length === 1 ? "" : "s"}:</p><ul class="spec-issues">${rows}</ul>`,
      actions: [
        { label: "Copy as JSON", handler: async () => { await navigator.clipboard.writeText(JSON.stringify(issues, null, 2)); this.toast("Issues copied."); } },
        { label: "Close", primary: true, handler: () => this.dialog.close() },
      ],
    });
  }

  /**
   * Opens a chart panel from a map spec (createChartSpec input bound to a loaded
   * layer) beside the map. Without an application the sidebar is left as it is.
   */
  async addLinkedChart(input) {
    const layer = this.mapController.getLayer(input.source?.layerId);
    if (!layer?.queryable) throw Object.assign(new Error(`The layer “${layer?.title || "?"}” cannot be charted.`), { hint: "Charts need a feature layer with attributes." });
    // Field names are matched as the service spells them, whatever the case in the link.
    const fields = (layer.fields || []).map((field) => field.name);
    const named = (name) => !name || !fields.length ? name : fields.find((field) => field === name) || fields.find((field) => field.toLowerCase() === name.toLowerCase()) || undefined;
    const dimension = named(input.dimension);
    const measure = named(input.measure?.field);
    const missing = [[input.dimension, dimension], [input.measure?.field, measure]].filter(([asked, found]) => asked && !found).map(([asked]) => `“${asked}”`);
    if (missing.length) throw Object.assign(new Error(`${layer.title || "The layer"} has no field ${missing.join(" or ")}.`), { hint: `Its fields: ${fields.slice(0, 40).join(", ")}.` });
    const chart = createChartSpec({ ...input, dimension, measure: { ...input.measure, field: measure } });
    this.projectManager.setCharts?.([...(this.projectManager.current.charts || []), chart]);
    const size = chart.presentation.size;
    await this.applicationRuntime.runTool("application.chart.create", {
      title: chart.title,
      region: chart.presentation.placement,
      size: size === "compact" ? { width: 360, height: 220 } : size === "expanded" ? { width: 620, height: 420 } : { width: 460, height: 300 },
      binding: { layerId: layer.uid, followActiveLayer: false },
      settings: { chart },
    });
    return chart;
  }

  /** Removes the chart panels (and saved charts) before a map spec replaces the layers they chart. */
  async clearChartPanels() {
    const panels = this.applicationRuntime.currentConfig ? this.applicationRuntime.snapshot().panels.filter((panel) => panel.type === "charts") : [];
    for (const panel of panels) await this.applicationRuntime.runTool("application.panel.remove", { instanceId: panel.instanceId });
    if (this.projectManager.current.charts?.length) this.projectManager.setCharts?.([]);
  }

  #showProject(project, state = "Local") {
    document.querySelector("#project-name").textContent = project.name;
    document.querySelector("#save-state").textContent = state;
  }

  #showNotesHub() {
    this.#setOptionalPanelVisibility("observations-panel", true, false);
    this.#renderNotesHub();
  }

  #renderNotesHub() {
    const host = document.querySelector("#observations-content");
    if (!host || !this.projectManager.current) return;
    const mapNotes = this.projectManager.mapNotes?.list() || [];
    const fieldNotes = this.projectManager.notes?.list() || [];
    const tasks = this.fieldTasks?.store?.snapshot()?.fieldTasks || this.projectManager.current.mobile?.fieldTasks || [];
    const count = document.querySelector("#observations-count");
    if (count) count.textContent = `${mapNotes.length + fieldNotes.length + tasks.length} items`;
    host.innerHTML = renderNotesHub({ projectName: this.projectManager.current.name, mapNotes, fieldNotes, tasks, tab: this.notesHubTab });
  }

  #initNotesHub() {
    const host = document.querySelector("#observations-content");
    host?.addEventListener("click", event => {
      const button = event.target.closest("[data-notes-hub]");
      if (!button || button.disabled) return;
      const action = button.dataset.notesHub;
      if (action === "tab") { this.notesHubTab = button.dataset.tab; this.#renderNotesHub(); return; }
      if (action === "new") {
        if (!this.dataMapNotesOpen) openDataMapNotesPanel(this);
        else { this.#syncUtilityPanel("data-notes"); document.querySelector('#utility-data-notes-content [data-note-view="compose"]')?.click(); }
        return;
      }
      if (action === "projects") { this.#selectProjectDialog(); return; }
      if (action === "qr") { this.openImagePicker(); return; }
      if (action === "pdf") { if (!this.mapNotesModeActive) openMapNotesPanel(this); else this.#syncUtilityPanel("notes"); document.querySelector("#utility-notes-content [data-note-pdf]")?.click(); return; }
      if (action === "workspace" || action === "item") {
        if (this.notesHubTab === "field") {
          if (!this.mapNotesModeActive) openMapNotesPanel(this); else this.#syncUtilityPanel("notes");
          if (action === "item") [...document.querySelectorAll("#utility-notes-content [data-note-edit]")].find(el => el.dataset.noteEdit === button.dataset.id)?.closest(".map-note-card")?.scrollIntoView({ block: "nearest" });
        }
        else if (this.notesHubTab === "tasks") {
          document.querySelector('[data-mobile-workflow="tasks"]')?.click();
          if (action === "item") [...document.querySelectorAll("#mobile-workflow-root [data-open-task]")].find(el => el.dataset.openTask === button.dataset.id)?.click();
        }
        else {
          // Reuse the existing workspace instead of replacing an unsaved composer.
          if (!this.dataMapNotesOpen) openDataMapNotesPanel(this, { view: "browse" });
          else { this.#syncUtilityPanel("data-notes"); document.querySelector('#utility-data-notes-content [data-note-view="browse"]')?.click(); }
          if (action === "item") {
            const card = [...document.querySelectorAll("#utility-data-notes-content [data-map-note-id]")].find(el => el.dataset.mapNoteId === button.dataset.id);
            card?.querySelector("[data-note-review-open]")?.click();
          }
        }
      }
    });
    ["notes:changed", "map-notes:changed", "mobile:workflow-changed", "project:loaded"].forEach(topic => this.events.subscribe(topic, () => this.#renderNotesHub()));
    this.#renderNotesHub();
  }

  updateFieldNotesCursor() {
    document.body.classList.toggle("map-notes-authoring", (this.mapNotesModeActive && this.fieldNotesEditing && this.activeUtilityTab === "notes") || (this.dataMapNotesOpen && this.activeUtilityTab === "data-notes" && !this.dataMapNotePaused));
  }

  updateDataMapNoteCursor() { document.body.classList.toggle("map-notes-authoring", this.dataMapNotesOpen && this.activeUtilityTab === "data-notes" && !this.dataMapNotePaused); }

  openDataMapNotesWorkspace(content) {
    this.notesHubTab = "map"; this.#showNotesHub();
    this.dataMapNotesOpen = true;
    const pane = document.querySelector("#utility-data-notes-content");
    pane.innerHTML = content;
    this.#syncUtilityPanel("data-notes");
    return pane;
  }

  openMapNotesWorkspace(content) {
    this.notesHubTab = "field"; this.#showNotesHub();
    this.mapNotesModeActive = true;
    const pane = document.querySelector("#utility-notes-content");
    pane.innerHTML = content;
    this.#syncUtilityPanel("notes");
    return pane;
  }

  async previewSharedObservation(bundle) {
    const note = bundle.notes[0];
    const [longitude, latitude] = note.anchor.geometry.coordinates;
    this.mapController.setTaskPin({ kind: "task", label: "Shared observation", longitude, latitude });
    this.mapController.setView({ center: [longitude, latitude], zoom: 15 }, { animate: false }).catch(() => {});
    const reference = note.relationships.find((item) => item.type === "references_feature" || item.type === "references_dataset");
    this.openDialog({
      eyebrow: "Field Notes · shared observation",
      title: note.title || "Shared observation",
      content: `<p>${escapeHtml(note.body).replaceAll("\n", "<br>")}</p><p class="form-note">${escapeHtml(bundle.session?.title || "Field observation")} · ${escapeHtml(note.type)} · ${latitude.toFixed(5)}, ${longitude.toFixed(5)}</p>${reference ? `<p class="form-note">Related dataset: ${escapeHtml(reference.datasetTitle || reference.datasetId || reference.targetId)}${reference.featureId ? ` · feature ${escapeHtml(reference.featureId)}` : ""}. The source is not automatically loaded; it may require access or reconnection.</p>` : ""}<p class="form-note">This is a preview. Importing saves the observation to this device; it does not overwrite conflicting notes.</p>`,
      actions: [
        { label: "Close", handler: () => this.dialog.close() },
        { label: "Import observation", primary: true, handler: async (event) => {
          const button = event.currentTarget; button.disabled = true;
          try {
            const { FieldSessionController } = await import("./field-session-store.js?v=0.4.0");
            const field = this.fieldSessionController ||= new FieldSessionController(this.projectManager, this.events);
            await field.importBundle(bundle);
            this.dialog.close();
            this.mapController.setTaskPin(null);
            openMapNotesPanel(this, { editId: note.id });
            this.toast("Observation imported locally.");
          } catch (error) { button.disabled = false; this.error(`Could not import observation: ${error.message}`); }
        } },
      ],
    });
  }

  refreshDataMapNoteMarkers() {
    if (!this.dataMapNotesOpen || this.activeUtilityTab !== "data-notes") return;
    const points = this.projectManager.mapNotes.list().filter(note => note.target.coordinates).map(note => ({ longitude: note.target.coordinates[0], latitude: note.target.coordinates[1] }));
    if (this.dataMapNotePoint) points.push({ longitude: this.dataMapNotePoint[0], latitude: this.dataMapNotePoint[1], draft: true });
    this.mapController.setMapNoteMarkers(points);
  }

  refreshMapNoteMarkers(draft = null) {
    if (!this.mapNotesModeActive) return;
    const points = this.projectManager.notes.list().filter((note) => note.anchor.geometry.type === "Point").map((note) => ({ longitude: note.anchor.geometry.coordinates[0], latitude: note.anchor.geometry.coordinates[1] }));
    if (draft) points.push({ longitude: draft[0], latitude: draft[1], draft: true });
    this.mapController.setMapNoteMarkers(points);
  }

  openDialog({ eyebrow = "GISMap Online", title, content, actions = [], presentationSheet = false }) {
    this.dialogSession = (this.dialogSession || 0) + 1;
    const remainsDocked = this.utilityDialogOpen && this.dialog.open;
    this.dialog.classList.remove("app-dialog--docked", "app-dialog--presentation-sheet", "app-dialog--floating");
    if (remainsDocked) this.dialog.classList.add("app-dialog--docked");
    this.dialog.classList.toggle("app-dialog--presentation-sheet", presentationSheet);
    document.querySelector("#dialog-dock").setAttribute("aria-label", "Move dialog to the right panel");
    document.querySelector("#dialog-dock").innerHTML = dockIcon("dock");
    document.querySelector("#dialog-eyebrow").textContent = eyebrow;
    document.querySelector("#dialog-title").textContent = title;
    document.querySelector("#dialog-content").innerHTML = content;
    const footer = document.querySelector("#dialog-actions");
    footer.innerHTML = "";
    actions.forEach((action) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = action.label;
      if (action.primary) button.className = "button--primary";
      button.addEventListener("click", action.handler);
      footer.append(button);
    });
    if (!this.dialog.open) {
      if (this.mobileMedia.matches) this.dialog.show();
      else this.dialog.showModal();
    } else if (remainsDocked) this.#syncUtilityPanel("dialog");
  }

  toast(message) {
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    document.querySelector("#toast-region").append(toast);
    setTimeout(() => toast.remove(), 4500);
  }

  error(message) {
    const toast = document.createElement("div");
    toast.className = "toast toast--error";
    toast.textContent = message;
    document.querySelector("#toast-region").append(toast);
    setTimeout(() => toast.remove(), 7000);
  }

  #closeMenus() {
    document.body.classList.remove("mobile-menu-open");
    document.querySelector("#mobile-menu-toggle").classList.remove("is-active");
    document.querySelectorAll(".menu.is-open").forEach((menu) => menu.classList.remove("is-open"));
    document.querySelectorAll(".menu__trigger").forEach((trigger) => trigger.setAttribute("aria-expanded", "false"));
    document.querySelectorAll(".menu-bar.is-consolidated-open").forEach((menu) => menu.classList.remove("is-consolidated-open"));
    document.querySelectorAll(".menu-bar__all-trigger").forEach((trigger) => trigger.setAttribute("aria-expanded", "false"));
    const drawer = document.querySelector("#mobile-menu-drawer");
    if (drawer && !drawer.hidden) {
      drawer.hidden = true;
      const toggle = document.querySelector("#mobile-menu-toggle");
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "Open application menu");
    }
  }
}
