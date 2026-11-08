import { BRAND } from "./brand.js";
import { APP_VERSION } from "./version.js?v=0.54.0-print";
import { DataMapNotesRegistry, normalizeDataMapNotes } from "./data-map-notes.js?v=0.70.3-geology";
import { NoteRelationshipsRegistry, normalizeNoteRelationships } from "./note-relationships.js?v=0.2.0";
import { previewMapNoteTasks, prepareMapNoteTasks } from "./map-note-task-planner.js?v=0.1.0";
import { MapNotesRegistry, normalizeNotes } from "./map-notes.js?v=0.70.3-geology";
import { applicationToLegacyPresentation, normalizeApplicationConfig } from "./application-config.js?v=0.68.0-charts1";
import { normalizeDataCatalog } from "./data-catalog.js?v=0.18.2";
import { normalizeSkin, normalizeSkinColors } from "./skin-catalog.js?v=0.57.0-skins2";
import { normalizeMapColors } from "./basemap-themes.js?v=0.53.0-mapcolors1";
import { normalizeMobileWorkflow } from "./mobile-feed-store.js?v=0.18.7";
import { normalizeBriefing } from "./briefing-document.js?v=0.61.0-briefing-player";
import { importCinematicSpec } from "./cinematic/state.js?v=0.2.9-strata";
import { normalizeCinematicClips } from "./cinematic/clip-model.js?v=0.3.10-strata";
import { composeSmartImage, embedProjectInPng, readProjectFromPng } from "./smart-image.js?v=0.70.3-geology";
import { normalizeCharts } from "./charting-tools.js?v=0.68.0-charts1";
import { stripProjectCredentials } from "./project-privacy.js?v=0.62.7-save-all";

const STORAGE_KEY = "gismap-online:projects:v1";
const CURRENT_KEY = "gismap-online:current-project:v1";
const TOUR_DEFAULTS = Object.freeze({ transitionMode: "smooth", lingerSeconds: 4, heading: 0, tilt: 0 });

function finite(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeTourDefaults(value = {}) {
  return {
    transitionMode: value?.transitionMode === "instant" ? "instant" : "smooth",
    lingerSeconds: Math.min(120, Math.max(1, finite(value?.lingerSeconds, TOUR_DEFAULTS.lingerSeconds))),
    heading: Math.min(360, Math.max(-360, finite(value?.heading, TOUR_DEFAULTS.heading))),
    tilt: Math.min(179, Math.max(0, finite(value?.tilt, TOUR_DEFAULTS.tilt))),
  };
}

function makeId() {
  return globalThis.crypto?.randomUUID?.() ?? `project-${Date.now()}`;
}

function downloadBlob(blob, fileName) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 5000);
}

export class ProjectManager {
  constructor(events, mapController, authController = null) {
    this.events = events;
    this.mapController = mapController;
    this.authController = authController;
    this.current = this.#blank("Untitled project");
    // Preserve project.notes and the historical .notes API without guessing
    // whether legacy records were intended as data or field observations.
    this.notes = new MapNotesRegistry({ project: () => this.current, events, persist: () => this.persistCurrentIfSaved() });
    this.fieldNotes = this.notes;
    this.mapNotes = new DataMapNotesRegistry({ project: () => this.current, events, persist: () => this.persistCurrentIfSaved() });
    this.noteRelationships = new NoteRelationshipsRegistry({ project: () => this.current, events, persist: () => this.persistCurrentIfSaved() });
  }

  #blank(name) {
    return {
      schema: "https://gismap.online/project/v1",
      version: 1,
      id: makeId(),
      name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      basemap: this.mapController?.getDefaultBasemapId?.() ?? "topo-3d",
      defaultBasemap: this.mapController?.getDefaultBasemapId?.() ?? "topo-3d",
      ground: "world-elevation",
      view: { type: "scene", center: [-98.5, 39.5], zoom: 4, heading: 0, tilt: 35 },
      layers: [],
      bookmarks: [],
      notes: [],
      mapNotes: [],
      noteRelationships: [],
      tools: [],
      ai: { provider: null, model: null },
      connections: [],
      presentation: { schemaVersion: 1, template: "standard", skin: "gismap", title: "", primaryLayerId: null, fieldMappings: {}, widgets: {}, tourDefaults: normalizeTourDefaults(), chapters: [] },
      application: null,
      dataCatalog: normalizeDataCatalog(),
      mobile: normalizeMobileWorkflow(),
      // Saved Cartography Lab styles (schemas/layer-style-v1.schema.json).
      layerStyles: [],
      // Chart definitions (never copied result data) reconnect to their layers on load.
      charts: [],
    };
  }

  list() {
    return Object.values(this.#readStore()).sort((a, b) =>
      String(b.updatedAt).localeCompare(String(a.updatedAt)),
    );
  }

  async create(name = "Untitled project") {
    await this.mapController.clearOperationalLayers();
    this.mapController.clearDrawings?.();
    this.mapController.clearTextBoxes?.();
    this.mapController.setBasemap(this.mapController.getDefaultBasemapId());
    this.mapController.setGround("world-elevation");
    await this.mapController.restoreView({ center: [-98.5, 39.5], zoom: 4, heading: 0, tilt: 35 });
    this.current = this.#blank(name.trim() || "Untitled project");
    this.events.publish("project:loaded", { project: this.current, missingFiles: [] });
    return this.current;
  }

  snapshot() {
    this.current = {
      ...this.current,
      updatedAt: new Date().toISOString(),
      basemap: this.mapController.getBasemapId(),
      defaultBasemap: this.mapController.getDefaultBasemapId(),
      ground: this.mapController.getGroundId(),
      engine: this.mapController.getEngineId?.() ?? this.current.engine ?? null,
      view: this.mapController.getViewState(),
      layers: this.mapController.getAllLayerConfigs().map(({ uid, ...layer }) => layer),
      drawings: this.mapController.getDrawings?.() ?? [],
      drawingsStyle: this.#drawingsStyle(),
      textBoxes: this.mapController.getTextBoxes?.() ?? [],
      connections: this.authController?.exportConnections() ?? this.current.connections ?? [],
    };
    return structuredClone(this.current);
  }

  #drawingsStyle() {
    const style = this.mapController.getDrawingsStyle?.() ?? {};
    return Object.keys(style).length ? style : this.current.drawingsStyle ?? null;
  }

  /** The current project without credentials, for files that leave this browser. */
  #shareableSnapshot() {
    const { project, removed } = stripProjectCredentials(this.snapshot());
    if (removed.length) this.events.publish("project:credentials-removed", { message: `Credentials were left out of the file for: ${removed.join(", ")}. Sign in again after opening it.` });
    return project;
  }

  save(name = null) {
    if (name?.trim()) this.current.name = name.trim();
    const project = this.snapshot();
    const store = this.#readStore();
    store[project.id] = project;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    localStorage.setItem(CURRENT_KEY, project.id);
    this.events.publish("project:saved", { project });
    return project;
  }

  /** Whether this project is in the browser's project store; once it is, edits persist automatically. */
  isSaved() {
    return Boolean(this.#readStore()[this.current.id]);
  }

  persistCurrentIfSaved() {
    const store = this.#readStore();
    if (!store[this.current.id]) return false;
    const project = this.snapshot();
    store[project.id] = project;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    localStorage.setItem(CURRENT_KEY, project.id);
    this.events.publish("project:saved", { project, automatic: true });
    return true;
  }

  previewTasksFromMapNotes(request) { return previewMapNoteTasks(this.current, request); }

  createTasksFromMapNotes(preview) {
    const prepared = prepareMapNoteTasks(this.current, preview);
    const previous = { mobile: this.current.mobile, links: this.current.noteRelationships };
    this.current.mobile = normalizeMobileWorkflow({ ...this.current.mobile, fieldTasks: [...prepared.tasks, ...(this.current.mobile?.fieldTasks || [])] });
    this.current.noteRelationships = prepared.links;
    try {
      // A single atomic localStorage write for already-saved projects; unsaved
      // projects stay in memory until the user explicitly saves them.
      const store = this.#readStore();
      if (store[this.current.id]) { const snapshot = this.snapshot(); store[snapshot.id] = snapshot; localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); }
    } catch (error) { this.current.mobile = previous.mobile; this.current.noteRelationships = previous.links; throw error; }
    this.events.publish('mobile:workflow-changed', { mobile: structuredClone(this.current.mobile) });
    this.events.publish('note-relationships:changed', { action: 'create', relationshipId: null, count: this.current.noteRelationships.length });
    return structuredClone(prepared.tasks);
  }

  async loadSaved(id) {
    const project = this.#readStore()[id];
    if (!project) throw new Error("That local project no longer exists.");
    return this.load(project);
  }

  async load(project, packageFiles = new Map()) {
    if (!project || project.version !== 1 || !Array.isArray(project.layers)) {
      throw new Error("This is not a supported GISMap Online project file.");
    }
    // Validate before changing the current map or accepting an imported project.
    const notes = normalizeNotes(project.notes ?? []);
    const mapNotes = normalizeDataMapNotes(project.mapNotes ?? []);
    const noteRelationships = normalizeNoteRelationships(project.noteRelationships ?? []);
    this.authController?.importConnections(project.connections ?? []);
    await this.mapController.clearOperationalLayers();
    this.mapController.clearDrawings?.();
    // Reopen on the engine the project was made with; layers are cleared first so nothing blocks the switch.
    if (project.engine && project.engine !== this.mapController.getEngineId?.()) {
      try {
        await (this.engineSwitcher ? this.engineSwitcher(project.engine) : this.mapController.switchEngine(project.engine));
      } catch (error) {
        this.events.publish("app:error", { message: `The project was made with the ${project.engine} engine, which could not start: ${error.message}` });
      }
    }
    this.mapController.setDefaultBasemap(project.defaultBasemap || this.mapController.getDefaultBasemapId());
    this.mapController.setBasemap(project.basemap || this.mapController.getDefaultBasemapId());
    this.mapController.setGround(project.ground || "world-elevation");
    const missingFiles = [];

    for (const layer of project.layers) {
      try {
        if (layer.sourceType === "geoparquet") {
          if (!this.geoParquetLoader) throw new Error("GeoParquet import is unavailable.");
          const packaged = layer.local ? (packageFiles.get(layer.projectPath) || packageFiles.get(`data/${layer.fileName}`)) : null;
          if (layer.local && !packaged) { missingFiles.push(layer.fileName); continue; }
          const result = await this.geoParquetLoader({ file: packaged || undefined, url: layer.local ? undefined : layer.url, title: layer.title, projectPath: layer.projectPath });
          if (!result.layer) throw new Error("This source no longer contains mappable GeoParquet geometry.");
          await this.#restoreLayerPresentation(result.layer, layer);
        } else if (layer.local) {
          const packaged = packageFiles.get(layer.projectPath) || packageFiles.get(`data/${layer.fileName}`);
          if (!packaged) {
            missingFiles.push(layer.fileName);
            continue;
          }
          const added = await this.mapController.addLocalFile(packaged, layer.projectPath, { collectionKey: layer.collectionKey, scene3d: layer.scene3d });
          await this.#restoreLayerPresentation(added, layer);
        } else if (layer.url) {
          const added = await this.mapController.addService({
            url: layer.url,
            title: layer.title,
            serviceType: this.#serviceTypeFor(layer),
            opacity: layer.opacity,
            visible: layer.visible,
            elevationInfo: layer.elevationInfo,
            refreshInterval: layer.refreshInterval,
            definitionExpression: layer.definitionExpression,
            wfsName: layer.wfsName,
            customParameters: layer.customParameters,
            ignoreServiceScaleRange: layer.ignoreServiceScaleRange === true,
            animatedEffect: layer.animatedEffect ?? null,
            scene3d: layer.scene3d ?? null,
            sourceLayer: layer.sourceLayer ?? null,
          });
          await this.#restoreLayerPresentation(added, layer);
        }
      } catch (error) {
        this.events.publish("app:error", {
          message: `Could not restore ${layer.title || layer.fileName}: ${error.message}`,
        });
      }
    }

    this.current = structuredClone(project);
    this.current.notes = notes;
    this.current.mapNotes = mapNotes;
    this.current.noteRelationships = noteRelationships;
    this.current.presentation = this.#presentation(project.presentation);
    this.current.application = project.application?.configured === true
      ? normalizeApplicationConfig(project.application)
      : null;
    this.current.dataCatalog = normalizeDataCatalog(project.dataCatalog);
    this.current.mobile = normalizeMobileWorkflow(project.mobile);
    this.current.layerStyles = Array.isArray(project.layerStyles) ? project.layerStyles.slice(0, 200) : [];
    this.current.charts = normalizeCharts(project.charts);
    if (project.drawingsStyle && typeof project.drawingsStyle === "object") {
      try { await this.mapController.setDrawingsStyle(project.drawingsStyle); } catch { /* Default style. */ }
    }
    if (Array.isArray(project.drawings) && project.drawings.length) {
      try { await this.mapController.setDrawings(project.drawings); } catch (error) {
        this.events.publish("app:error", { message: `Could not restore drawings: ${error.message}` });
      }
    }
    try { this.mapController.setTextBoxes?.(Array.isArray(project.textBoxes) ? project.textBoxes : []); } catch (error) {
      this.events.publish("app:error", { message: `Could not restore text boxes: ${error.message}` });
    }
    await this.mapController.restoreView(project.view);
    this.events.publish("project:loaded", { project: this.current, missingFiles });
    return { project: this.current, missingFiles };
  }

  async #restoreLayerPresentation(layer, config) {
    this.mapController.setVisibility(layer.uid, config.visible !== false, { silent: true });
    this.mapController.setOpacity(layer.uid, Number.isFinite(config.opacity) ? config.opacity : 1, { silent: true });
    // A service's own style loads with the layer; only styles set in GISMap Online are restored.
    if (config.renderer && config.styled !== false) this.mapController.restoreRenderer(layer.uid, config.renderer);
    if (config.rendererSpec) this.mapController.recordRendererSpec(layer.uid, config.rendererSpec);
    if (config.spatialChart) await this.mapController.setSpatialChart(layer.uid, config.spatialChart);
    // A decorative effect is optional: an engine without it shows the layer plainly.
    if (config.animatedEffect && this.mapController.getCapabilities?.().includes("three-3d")) {
      try { await this.mapController.setLayerEffect(layer.uid, config.animatedEffect); } catch { /* Shown without the effect. */ }
    }
    if (config.definitionExpression != null) {
      this.mapController.setDefinitionExpression(layer.uid, config.definitionExpression);
    }
  }

  #serviceTypeFor(layer) {
    const type = layer.sourceType || layer.type;
    const lookup = {
      feature: "feature",
      "map-image": "map-image",
      imagery: "imagery",
      wms: "wms",
      kml: "kml",
      geojson: "geojson",
      wfs: "wfs",
      "vector-tiles": "vector-tiles",
    };
    return lookup[type] || "arcgis-auto";
  }

  /** The .gis project file, returned without downloading. */
  createFile() {
    const project = this.#shareableSnapshot();
    const mimeType = "application/vnd.gismap.online.project+json";
    return { fileName: `${this.#exportName(project)}.gis`, mimeType, blob: new Blob([JSON.stringify(project, null, 2)], { type: mimeType }) };
  }

  exportJson() {
    const { blob, fileName } = this.createFile();
    downloadBlob(blob, fileName);
    this.events.publish("project:exported", { kind: "json" });
  }

  /** With `download: false` the PNG is only returned (as `file`), for share dialogs. */
  /** With `visual` (a finished PNG Blob, such as a map template page) the map is not captured again. */
  async exportSmartImage({ width = 1600, height = 1000, download = true, visual: page = null, suffix = "smart-map", template = null } = {}) {
    const project = this.#shareableSnapshot();
    const capture = page ? null : await this.mapController.captureImage({ format: "png", width, height });
    if (!page && !capture?.dataUrl) throw new Error("The map is not ready to create a Smart Image.");
    const visual = page || await composeSmartImage({
      dataUrl: capture.dataUrl,
      title: project.name,
      layerCount: project.layers.length,
      sources: project.layers.map((layer) => layer.title || layer.fileName).filter(Boolean),
      width,
      height,
      skin: globalThis.document?.documentElement?.dataset.skin || project.presentation?.skin,
    });
    const blob = await embedProjectInPng(visual, project, { generator: "gismap-online", generatorName: BRAND.name, apiVersion: APP_VERSION, renderedBy: "app", template });
    const name = `${this.#exportName(project)}-${suffix}.png`;
    if (download) {
      downloadBlob(blob, name);
      this.events.publish("project:exported", { kind: "smart-image" });
    }
    return { blob, project, file: new File([blob], name, { type: "image/png" }) };
  }

  exportAtlas() {
    const project = this.#shareableSnapshot();
    const presentation = this.#presentation({ ...project.presentation, template: "atlas" });
    const tour = {
      ...project,
      presentation,
      application: null,
      tour: { schema: "https://gismap.online/guided-tour/v1", opensInAtlas: true },
    };
    const blob = new Blob([JSON.stringify(tour, null, 2)], {
      type: "application/vnd.gismap.online.guided-tour+json",
    });
    downloadBlob(blob, `${this.#exportName(project)}.gisatlas`);
    this.events.publish("project:exported", { kind: "atlas" });
  }

  /** The .gisx project package, returned without downloading. */
  async createPackage() {
    if (!globalThis.JSZip) throw new Error("The ZIP library did not load.");
    const project = this.#shareableSnapshot();
    const zip = new JSZip();
    for (const layer of this.mapController.getLayers()) {
      const asset = this.mapController.getLocalAsset(layer.uid);
      const config = this.mapController.getLayerConfig(layer);
      if (asset && config.projectPath) zip.file(config.projectPath, asset);
    }
    zip.file("project.json", JSON.stringify(project, null, 2));
    zip.file(
      "README.txt",
      "GISMap Online project package\nOpen https://gismap.online and choose Project > Import project file.\n",
    );
    const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
    return { fileName: `${this.#exportName(project)}.gisx`, mimeType: "application/zip", blob };
  }

  async exportPackage() {
    const { blob, fileName } = await this.createPackage();
    downloadBlob(blob, fileName);
    this.events.publish("project:exported", { kind: "package" });
  }

  async importFile(file) {
    if (file.type === "image/png" || /\.png$/i.test(file.name)) {
      const manifest = await readProjectFromPng(file);
      if (manifest.provenance.renderedBy !== "app") this.events.publish("project:smart-image-unverified", { fileName: file.name });
      return this.load(manifest.project);
    }
    if (/\.(?:zip|gisx|gmop|gismap)$/i.test(file.name)) {
      if (!globalThis.JSZip) throw new Error("The ZIP library did not load.");
      const zip = await JSZip.loadAsync(file);
      const projectEntry = zip.file("project.json");
      if (!projectEntry) throw new Error("The package does not contain project.json.");
      const project = JSON.parse(await projectEntry.async("text"));
      const packageFiles = new Map();
      await Promise.all(
        Object.values(zip.files)
          .filter((entry) => !entry.dir && entry.name !== "project.json" && entry.name !== "README.txt")
          .map(async (entry) => {
            const blob = await entry.async("blob");
            packageFiles.set(entry.name, new File([blob], entry.name.split("/").pop()));
          }),
      );
      return this.load(project, packageFiles);
    }
    return this.load(JSON.parse(await file.text()));
  }

  addBookmark(bookmark) {
    this.current.bookmarks ??= [];
    this.current.bookmarks.push({ id: makeId(), ...bookmark });
    this.events.publish("bookmarks:changed", { bookmarks: this.current.bookmarks });
    this.persistCurrentIfSaved();
    return this.current.bookmarks[this.current.bookmarks.length - 1];
  }

  updateBookmark(id, patch) {
    const bookmark = (this.current.bookmarks ?? []).find((item) => item.id === id);
    if (!bookmark) return null;
    Object.assign(bookmark, patch);
    this.events.publish("bookmarks:changed", { bookmarks: this.current.bookmarks });
    this.persistCurrentIfSaved();
    return bookmark;
  }

  setPresentation(presentation) {
    this.current.presentation = this.#presentation(presentation);
    this.current.application = null;
    this.events.publish("application:changed", { application: null });
    this.events.publish("presentation:changed", { presentation: structuredClone(this.current.presentation) });
    this.persistCurrentIfSaved();
    return this.current.presentation;
  }

  /**
   * Save presentation details that do not change the active mode (briefing
   * selection, per-mode titles). Unlike setPresentation, this does not
   * re-render the workspace, so in-progress lists and selections survive.
   */
  patchPresentation(patch = {}) {
    this.current.presentation = this.#presentation({ ...this.current.presentation, ...patch });
    this.persistCurrentIfSaved();
    return this.current.presentation;
  }

  setApplication(application) {
    this.current.application = normalizeApplicationConfig({ ...application, configured: true });
    this.current.presentation = this.#presentation(applicationToLegacyPresentation(this.current.application, this.current.presentation));
    this.events.publish("application:changed", { application: structuredClone(this.current.application) });
    this.events.publish("presentation:changed", { presentation: structuredClone(this.current.presentation) });
    this.persistCurrentIfSaved();
    return this.current.application;
  }

  setDataCatalog(catalog) {
    this.current.dataCatalog = normalizeDataCatalog(catalog);
    this.current.updatedAt = new Date().toISOString();
    this.persistCurrentIfSaved();
    this.events.publish("catalog:changed", { catalog: structuredClone(this.current.dataCatalog) });
    return structuredClone(this.current.dataCatalog);
  }

  setCharts(charts) {
    this.current.charts = normalizeCharts(charts);
    this.current.updatedAt = new Date().toISOString();
    this.persistCurrentIfSaved();
    this.events.publish("charts:changed", { charts: structuredClone(this.current.charts) });
    return structuredClone(this.current.charts);
  }

  setMobileWorkflow(mobile) {
    this.current.mobile = normalizeMobileWorkflow(mobile);
    this.current.updatedAt = new Date().toISOString();
    this.persistCurrentIfSaved();
    this.events.publish("mobile:workflow-changed", { mobile: structuredClone(this.current.mobile) });
    return structuredClone(this.current.mobile);
  }

  #presentation(value = {}) {
    const templates = new Set(["standard", "briefing", "explorer", "atlas", "ai-map", "cinematic"]);
    const template = templates.has(value.template) ? value.template : "standard";
    const title = String(value.title || "");
    // Each mode keeps its own title so Briefing and Tours never rename each other.
    const modeTitles = {};
    for (const mode of ["briefing", "explorer", "atlas", "cinematic"]) {
      const saved = value.modeTitles?.[mode];
      if (typeof saved === "string" && saved) modeTitles[mode] = saved;
    }
    if (template !== "standard" && template !== "ai-map" && title) modeTitles[template] = title;
    const selection = value.briefingSelection;
    return {
      schemaVersion: 1,
      template,
      skin: normalizeSkin(value.skin),
      skinColors: Object.fromEntries(Object.entries(value.skinColors && typeof value.skinColors === "object" ? value.skinColors : {}).filter(([id]) => normalizeSkin(id) === id).map(([id, colors]) => [id, normalizeSkinColors(colors)]).filter(([, colors]) => colors)),
      mapColors: Object.fromEntries(Object.entries(value.mapColors && typeof value.mapColors === "object" ? value.mapColors : {}).filter(([id]) => normalizeSkin(id) === id).map(([id, colors]) => [id, normalizeMapColors(colors)]).filter(([, colors]) => Object.keys(colors).length)),
      title,
      modeTitles,
      briefingSelection: selection && typeof selection === "object" ? {
        layerId: selection.layerId ? String(selection.layerId) : null,
        ids: Array.isArray(selection.ids) ? [...new Set(selection.ids.map(String))].slice(0, 500) : [],
        useAll: selection.useAll === true,
        // Attribute conditions from the Features tab: { field, op, value }, all must match.
        conditions: Array.isArray(selection.conditions) ? selection.conditions.filter((item) => item && typeof item.field === "string" && typeof item.op === "string").slice(0, 8).map(({ field, op, value }) => ({ field, op, value: value ?? "" })) : [],
      } : { layerId: null, ids: [], useAll: false, conditions: [] },
      // Slides for the briefing; a briefing without slides behaves exactly as before.
      briefing: normalizeBriefing(value.briefing),
      // A cinematic spec references existing layers only; invalid imported
      // drafts are omitted rather than allowed to corrupt project loading.
      cinematic: (() => {
        if (!value.cinematic || typeof value.cinematic !== "object") return null;
        try { return importCinematicSpec({ cinematic: value.cinematic }).cinematic; } catch { return null; }
      })(),
      // Clips are portable scene recipes, not media files. Keeping them beside
      // the cinematic draft lets Brief slides refer to a stable ID.
      cinematicClips: normalizeCinematicClips(value.cinematicClips),
      primaryLayerId: value.primaryLayerId || null,
      fieldMappings: value.fieldMappings && typeof value.fieldMappings === "object" ? value.fieldMappings : {},
      widgets: value.widgets && typeof value.widgets === "object" ? value.widgets : {},
      contextSettings: value.contextSettings && typeof value.contextSettings === "object" ? {
        dock: ["floating", "left", "right", "top", "bottom"].includes(value.contextSettings.dock) ? value.contextSettings.dock : "floating",
        perimeter: Math.min(1000, Math.max(0, Number(value.contextSettings.perimeter) || 10)),
        units: value.contextSettings.units === "miles" ? "miles" : "kilometers",
        sections: value.contextSettings.sections && typeof value.contextSettings.sections === "object" ? {
          overview: value.contextSettings.sections.overview !== false,
          surroundings: value.contextSettings.sections.surroundings !== false,
          ai: value.contextSettings.sections.ai !== false,
          sources: value.contextSettings.sections.sources !== false,
        } : { overview: true, surroundings: true, ai: true, sources: true },
        layerIds: Array.isArray(value.contextSettings.layerIds) ? value.contextSettings.layerIds.map(String) : [],
        sourceIds: Array.isArray(value.contextSettings.sourceIds) ? value.contextSettings.sourceIds.map(String) : [],
      } : undefined,
      playbackMode: value.playbackMode === "manual" ? "manual" : "auto",
      // These are authoring defaults for new chapters. A chapter keeps its own
      // settings once edited, so changing a default never rewrites a tour.
      tourDefaults: normalizeTourDefaults(value.tourDefaults),
      chapters: Array.isArray(value.chapters) ? value.chapters.map((chapter) => ({
        ...chapter,
        basemapId: typeof chapter?.basemapId === "string" ? chapter.basemapId : null,
        reverseAddress: typeof chapter?.reverseAddress === "string" ? chapter.reverseAddress : "",
        mediaUrl: /^https?:\/\//i.test(String(chapter?.mediaUrl || "")) ? String(chapter.mediaUrl) : "",
        layerVisibility: Array.isArray(chapter?.layerVisibility) ? chapter.layerVisibility.map((entry) => ({
          key: String(entry?.key || ""),
          visible: entry?.visible !== false,
        })).filter((entry) => entry.key) : null,
        lingerSeconds: Math.min(120, Math.max(1, Number(chapter?.lingerSeconds) || 4)),
        transitionMode: chapter?.transitionMode === "instant" ? "instant" : "smooth",
      })) : [],
    };
  }

  removeBookmark(id) {
    this.current.bookmarks = (this.current.bookmarks ?? []).filter((item) => item.id !== id);
    this.events.publish("bookmarks:changed", { bookmarks: this.current.bookmarks });
    this.persistCurrentIfSaved();
  }

  #readStore() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch {
      return {};
    }
  }

  #safeName(value) {
    return (value || "Project").replace(/[^a-z0-9]+/gi, "-").replace(/(^-|-$)/g, "");
  }

  #exportName(project) {
    const date = new Date(project.updatedAt || Date.now());
    const pad = (value) => String(value).padStart(2, "0");
    const timestamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}`;
    return `${timestamp}-${this.#safeName(project.name)}`;
  }
}
