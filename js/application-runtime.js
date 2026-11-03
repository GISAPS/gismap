import { releaseLayerAnalysis } from "./analysis-dataset.js?v=0.54.0-analysis1";
import { ApplicationState } from "./application-state.js?v=0.18.2";
import { PanelRegistry, ToolRegistry } from "./application-registry.js?v=0.27.1";
import { LayoutManager } from "./layout-manager.js?v=0.68.0-charts1";
import { normalizeApplicationConfig, presetApplication } from "./application-config.js?v=0.68.0-charts1";
import { DuckDBBrowserClient } from "./duckdb-client.js?v=0.54.0-analysis1";
import { normalizeDataCatalog, planNaturalLanguageQuery, validateReadOnlySQL } from "./data-catalog.js?v=0.18.2";
import { PanelManager } from "./panel-manager.js?v=0.18.2";
import { applyInterfaceSkin } from "./skin-catalog.js?v=0.57.0-skins2";
import { CHART_DEFAULT_TOP, chartCategories, chartColors, chartFilterForRow, chartOption, chartSummary, createChartSpec, displayChartRows, loadECharts, queryChart, renderChartFallback, resolveChartTheme } from "./charting-tools.js?v=0.68.0-charts1";

const STATIC_PANELS = {
  places: "places-panel",
  bookmarks: "bookmarks-panel",
  draw: "draw-panel",
  intelligence: "intelligence-panel",
  layers: "layers-panel",
};

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

export class ApplicationRuntime {
  constructor({ events, mapController, projectManager, aiController, panelManager = null, mobilePanelManager = null, documentRef = document }) {
    Object.assign(this, { events, mapController, projectManager, aiController, document: documentRef });
    this.panelManager = panelManager || new PanelManager({ documentRef });
    this.mobilePanelManager = mobilePanelManager;
    this.currentConfig = null;
    this.state = new ApplicationState();
    this.tools = new ToolRegistry();
    this.panels = new PanelRegistry();
    this.layout = new LayoutManager({
      registry: this.panels,
      state: this.state,
      mapController,
      documentRef,
      onConfigChange: (application) => {
        this.currentConfig = application;
        this.projectManager.setApplication(application);
      },
      hosts: {
        left: documentRef.querySelector("#application-left-dock"),
        right: documentRef.querySelector("#application-right-dock"),
        workspace: documentRef.querySelector('[data-utility-pane="workspace"]'),
        bottom: documentRef.querySelector("#application-bottom-dock"),
        floating: documentRef.querySelector("#application-floating-dock"),
      },
    });
    this.undoStack = [];
    this.mapUndoStack = [];
    this.panelSessions = new Map();
    this.duckdb = new DuckDBBrowserClient();
  }

  initialize() {
    this.#registerTools();
    this.#registerPanels();
    this.#bridgeState();
    this.mobilePanelManager?.media?.addEventListener?.("change", () => this.#syncResponsiveLayout());
  }

  apply(config, { preview = false } = {}) {
    if (preview) this.layout.beginPreview();
    const normalized = normalizeApplicationConfig(config);
    this.currentConfig = normalized;
    const previousLayout = this.layout.current?.layout?.kind;
    this.document.querySelector("#app").dataset.applicationPreset = normalized.preset;
    applyInterfaceSkin(normalized.skin, { documentRef: this.document, colors: this.projectManager.current.presentation?.skinColors?.[normalized.skin] });
    this.document.body.dataset.applicationMode = normalized.mode;
    this.document.querySelector("#application-edit-return").hidden = normalized.mode !== "present";
    let applied;
    if (this.mobilePanelManager?.compact) {
      this.layout.deactivate(this.#context());
      this.document.querySelector("#app").dataset.applicationLayout = "mobile";
      this.mobilePanelManager.enter();
      applied = structuredClone(normalized);
    } else {
      this.mobilePanelManager?.leave();
      applied = this.layout.apply(normalized, this.#context());
    }
    if (normalized.layout.kind === "globe" && previousLayout !== "globe") {
      this.mapController.restoreView({ center: [-20, 18], zoom: 2, heading: 0, tilt: 0 }).catch(() => {});
    }
    this.syncStaticPanelVisibility();
    const welcome = this.document.querySelector("#welcome-panel");
    if (welcome && normalized.preset !== "standard") welcome.hidden = true;
    return applied;
  }

  cancelPreview() { return this.layout.cancelPreview(this.#context()); }
  commitPreview() { this.layout.commitPreview(); }

  deactivate() {
    this.layout.deactivate(this.#context());
    this.currentConfig = null;
    if (this.mobilePanelManager?.compact) this.mobilePanelManager.enter();
    else this.mobilePanelManager?.leave();
    const app = this.document.querySelector("#app");
    delete app.dataset.applicationPreset;
    delete this.document.body.dataset.applicationMode;
    this.document.querySelector("#application-edit-return").hidden = true;
    this.syncStaticPanelVisibility();
  }

  syncStaticPanelVisibility() {
    if (this.mobilePanelManager?.compact) {
      this.mobilePanelManager.activePanelId
        ? this.mobilePanelManager.activate(this.mobilePanelManager.activePanelId, { toggle: false })
        : this.mobilePanelManager.close();
      return;
    }
    const config = this.layout.current;
    // Without an application, or when it leaves the sidebar to the workspace,
    // the sidebar panels keep whatever the workspace shows.
    const visibleTypes = config && config.layout?.sidebar !== "workspace" ? new Set(config.panels
      .filter((panel) => config.mode !== "present" || panel.audienceVisible)
      .map((panel) => panel.type)) : new Set(Object.keys(STATIC_PANELS));
    for (const [type, elementId] of Object.entries(STATIC_PANELS)) {
      const element = this.document.getElementById(elementId);
      if (!element) continue;
      const utilityOwnsContent = this.panelManager?.isOn(`content:${type}`, "utility");
      element.hidden = utilityOwnsContent || !visibleTypes.has(type);
    }
  }

  setMode(mode) {
    const next = { ...(this.currentConfig || this.layout.current || presetApplication()), mode: mode === "present" ? "present" : "edit" };
    return this.apply(next);
  }

  snapshot() { return normalizeApplicationConfig(this.currentConfig || this.layout.current || presetApplication()); }

  #syncResponsiveLayout() {
    if (this.currentConfig) this.apply(this.currentConfig);
    else if (this.mobilePanelManager?.compact) this.mobilePanelManager.enter();
    else this.mobilePanelManager?.leave();
  }

  async runTool(id, input, { preview = false } = {}) {
    if (preview) this.undoStack.push(this.snapshot());
    return this.tools.execute(id, input, this.#context());
  }

  undo() {
    const previousView = this.mapUndoStack.pop();
    if (previousView) {
      this.mapController.restoreView(previousView).catch(() => {});
      return true;
    }
    const previous = this.undoStack.pop();
    if (!previous) return false;
    this.apply(previous);
    return true;
  }

  planRequest(prompt) {
    const request = String(prompt || "").trim();
    if (!request) throw new Error("Describe the application you want to build.");
    let config = this.snapshot();
    const operations = [];
    const preset = ["briefing", "explorer", "atlas", "standard", "ai-map", "globe"].find((id) => new RegExp(`\\b${id.replace("-", "[ -]")}\\b`, "i").test(request));
    if (preset) {
      config = presetApplication(preset);
      operations.push({ tool: "application.preset.apply", input: { preset } });
    }
    const layer = this.mapController.getLayers().find((item) => request.toLowerCase().includes(String(item.title || "").toLowerCase()))
      || (/incident/i.test(request) ? this.mapController.getLayers().find((item) => /incident/i.test(item.title || "")) : null);
    if (/\bchart\b/i.test(request) && !config.panels.some((panel) => panel.type === "charts")) {
      config.panels.push({ instanceId: `charts-${Date.now()}`, type: "charts", title: /category/i.test(request) ? "Category chart" : "Chart", placement: { region: "bottom", order: config.panels.length }, binding: layer ? { layerId: layer.uid, followActiveLayer: false } : { followActiveLayer: true }, settings: { chartType: /category/i.test(request) ? "category" : "histogram" }, audienceVisible: true });
      operations.push({ tool: "application.chart.create", input: { layerId: layer?.uid || null } });
    }
    if (layer) config.panels = config.panels.map((panel) => ({ ...panel, binding: { ...panel.binding, layerId: layer.uid, followActiveLayer: false } }));
    return { summary: `Preview ${config.title}${layer ? ` with ${layer.title}` : ""}.`, operations, config: normalizeApplicationConfig(config) };
  }

  previewPlan(plan) {
    if (!plan?.config) throw new Error("A validated builder plan is required.");
    this.undoStack.push(this.snapshot());
    return this.apply(normalizeApplicationConfig(plan.config), { preview: true });
  }

  #context() {
    return { runtime: this, events: this.events, state: this.state, mapController: this.mapController, projectManager: this.projectManager, aiController: this.aiController };
  }

  #bridgeState() {
    this.events.subscribe("layer:added", ({ layer }) => this.state.dispatch("layer:activate", { layerId: layer?.uid }, { undoable: false }));
    this.events.subscribe("layer:removed", ({ uid }) => {
      releaseLayerAnalysis(this, uid);
      if (this.state.value.activeLayerId === uid) this.state.dispatch("layer:activate", { layerId: this.mapController.getLayers()[0]?.uid || null }, { undoable: false });
    });
    this.events.subscribe("layers:reset", () => releaseLayerAnalysis(this));
    this.events.subscribe("identify:complete", ({ results = [] }) => {
      const feature = results[0];
      this.state.dispatch("selection:set", {
        layerId: feature?.layerUid || null,
        objectIds: feature?.objectId == null ? [] : [feature.objectId],
        features: feature ? [{ attributes: feature.attributes || {}, geometry: feature.geometry || null, layerTitle: feature.layerTitle }] : [],
      }, { undoable: false });
    });
    this.events.subscribe("bookmarks:changed", ({ bookmarks }) => this.state.replace({ bookmarks: bookmarks || [] }, { undoable: false }));
    this.state.subscribe((filters) => {
      const layers = this.mapController.getLayers();
      for (const layer of layers) {
        const expressions = Object.values(filters)
          .filter((filter) => filter.layerId === layer.uid && typeof filter.expression?.where === "string")
          .map((filter) => `(${filter.expression.where})`);
        this.mapController.setDefinitionExpression?.(layer.uid, expressions.join(" AND ") || "");
      }
      this.events.publish("application:filters-changed", { filters });
    }, (state) => state.filters);
  }

  #registerTools() {
    const applicationChange = (id, displayName, transform) => this.tools.register({
      id, displayName,
      validate: (input) => input && typeof input === "object" ? true : "A configuration object is required.",
      execute: (input) => {
        const current = this.snapshot();
        // Adding a chart (or any panel) to the ordinary workspace adds just that
        // panel: the default preset's Places, Bookmarks, Draw… are not pulled
        // out of the sidebar and opened.
        if (!this.currentConfig && id !== "application.preset.apply") {
          current.layout.sidebar = "workspace";
          current.panels = current.panels.filter((panel) => !STATIC_PANELS[panel.type]);
        }
        return this.apply(transform(current, input));
      },
    });
    applicationChange("application.preset.apply", "Apply application preset", (_config, input) => {
      if (!["standard", "explorer", "briefing", "atlas", "ai-map", "operations", "globe"].includes(input.preset)) throw new Error(`Unknown application preset: ${input.preset}`);
      return presetApplication(input.preset);
    });
    applicationChange("application.panel.add", "Add panel", (config, input) => {
      const type = this.panels.get(input.type);
      if (!type) throw new Error(`Unknown panel type: ${input.type}`);
      const instanceId = input.instanceId || `${input.type}-${crypto.randomUUID?.() || Date.now()}`;
      config.panels.push({ instanceId, type: input.type, title: input.title || type.displayName, placement: { region: input.region || type.placements[0], order: config.panels.length }, binding: input.binding || { followActiveLayer: true }, settings: input.settings || {}, audienceVisible: input.audienceVisible !== false });
      return config;
    });
    applicationChange("application.panel.remove", "Remove panel", (config, input) => ({ ...config, panels: config.panels.filter((panel) => panel.instanceId !== input.instanceId) }));
    applicationChange("application.panel.configure", "Configure panel", (config, input) => ({ ...config, panels: config.panels.map((panel) => panel.instanceId === input.instanceId ? { ...panel, ...input.changes } : panel) }));
    applicationChange("application.panel.bind", "Bind dataset", (config, input) => ({ ...config, panels: config.panels.map((panel) => panel.instanceId === input.instanceId ? { ...panel, binding: { ...panel.binding, ...input.binding } } : panel) }));
    applicationChange("application.layout.change", "Change layout", (config, input) => ({ ...config, ...(input.layout ? { layout: { ...config.layout, ...input.layout } } : {}), panels: config.panels.map((panel) => panel.instanceId === input.instanceId ? { ...panel, placement: { ...panel.placement, ...input.placement } } : panel) }));
    applicationChange("application.layout.mode", "Change layout mode", (config, input) => ({ ...config, layout: { ...config.layout, kind: input.kind || "workspace" } }));
    applicationChange("application.skin.change", "Change skin", (config, input) => ({ ...config, skin: input.skin || config.skin }));
    applicationChange("application.chart.create", "Create chart", (config, input) => {
      const activeSkin = String(input.skin || this.document.documentElement.dataset.skin || "").trim();
      if (activeSkin) config.skin = activeSkin;
      config.panels.push({ instanceId: input.instanceId || `charts-${config.panels.filter((item) => item.type === "charts").length + 1}`, type: "charts", title: input.title || "Chart", placement: { region: input.region || "right", order: config.panels.length, ...(input.size ? { size: input.size } : {}), ...(input.position ? { position: input.position } : {}) }, binding: input.binding || { followActiveLayer: true }, settings: input.settings || {}, audienceVisible: true });
      return config;
    });
    this.tools.register({ id: "project.filter.apply", displayName: "Apply filter", execute: (input) => this.state.dispatch("filters:set", input) });
    this.tools.register({ id: "project.chapter.create", displayName: "Create chapter", execute: (input) => this.state.dispatch("chapter:create", input) });
    this.tools.register({ id: "map.navigate", displayName: "Navigate map", validate: (input) => ["home", "in", "out", "rotate-left", "rotate-right", "tilt-up", "tilt-down"].includes(input?.action) || "Unsupported map navigation action.", execute: (input) => {
      this.mapUndoStack.push(this.mapController.getViewState());
      return this.mapController.navigate(input.action);
    } });
    this.tools.register({ id: "map.basemap.change", displayName: "Change basemap", validate: (input) => typeof input?.id === "string" && input.id ? true : "Choose a basemap.", execute: (input) => this.mapController.setBasemap(input.id) });
  }

  #registerPanels() {
    for (const [type, elementId] of Object.entries(STATIC_PANELS)) {
      const staticElement = this.document.getElementById(elementId);
      this.panelManager?.register(`workspace:${type}`, staticElement);
      this.panels.register({
        type,
        displayName: type[0].toUpperCase() + type.slice(1),
        description: `Existing ${type} workspace tools.`,
        category: type === "intelligence" ? "Analysis" : "Workspace",
        placements: ["left", "right", "bottom", "floating"],
        multiple: false,
        mount: (host) => {
          const element = this.document.getElementById(elementId);
          if (!element) return;
          element.hidden = false;
          element.open = true;
          if (!this.panelManager?.move(`workspace:${type}`, host, { surface: "application" })) host.append(element);
          return { element };
        },
        unmount: (_host, mounted) => {
          const element = mounted?.element;
          if (!element) return;
          this.panelManager?.restore(`workspace:${type}`);
        },
      });
    }
    this.panels.register({
      type: "attributes", displayName: "Attributes", description: "Details for the shared selection.", category: "Data", bindings: ["active-layer", "fixed-layer", "shared-selection"], placements: ["left", "right", "bottom", "floating"], multiple: false,
      mount: (host, context) => {
        const render = (selection) => {
          const feature = selection.features?.[0];
          host.innerHTML = feature ? `<div class="composable-details"><span class="eyebrow">${escapeHtml(feature.layerTitle || "Selected feature")}</span><dl>${Object.entries(feature.attributes || {}).slice(0, 20).map(([key, value]) => `<div><dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}</dl></div>` : `<div class="panel-empty"><strong>No feature selected</strong><p>Select a feature on the map or in a linked panel.</p></div>`;
        };
        render(context.state.value.selection);
        const subscription = context.state.subscribe(render, (state) => state.selection);
        context.onCleanup(() => subscription.remove());
      },
    });
    this.panels.register({
      type: "charts", displayName: "Charts", description: "Computed summaries with linked filters.", category: "Analysis", bindings: ["active-layer", "fixed-layer", "shared-selection", "shared-time"], placements: ["left", "right", "bottom", "floating"],
      mount: (host, context) => {
        if (context.config.settings?.chart) return this.#mountConfiguredChartPanel(host, context);
        const id = context.config.instanceId;
        let bins = [];
        let layer = null;
        let field = null;
        const render = (filters) => {
          if (!bins.length || !layer || !field) return;
          const active = Boolean(filters[`${id}:range`]);
          const max = Math.max(...bins.map((bin) => bin.count), 1);
          host.innerHTML = `<div class="composable-chart"><span class="eyebrow">${escapeHtml(layer.title || "Active layer")}</span><strong>${escapeHtml(field.alias || field.name)} distribution</strong><div class="composable-chart__bars" aria-label="Distribution of ${escapeHtml(field.alias || field.name)}">${bins.map((bin, index) => `<button type="button" data-chart-bin="${index}" title="${bin.min.toLocaleString()}–${bin.max.toLocaleString()}: ${bin.count}"><i style="height:${Math.max(4, bin.count / max * 100)}%"></i></button>`).join("")}</div><p>${bins.reduce((sum, bin) => sum + bin.count, 0).toLocaleString()} loaded values${active ? " · linked range filter active" : ""}</p>${active ? `<button type="button" data-chart-clear>Clear this chart filter</button>` : ""}</div>`;
          host.querySelectorAll("[data-chart-bin]").forEach((button) => button.addEventListener("click", () => {
            const bin = bins[Number(button.dataset.chartBin)];
            const quoted = field.name.replaceAll('"', '""');
            context.dispatch("filters:set", { id: `${id}:range`, owner: id, scope: "project", layerId: layer.uid, expression: { kind: "range", field: field.name, min: bin.min, max: bin.max, where: `\"${quoted}\" >= ${bin.min} AND \"${quoted}\" <= ${bin.max}` } });
          }));
          host.querySelector("[data-chart-clear]")?.addEventListener("click", () => context.dispatch("filters:clear", { id: `${id}:range` }));
        };
        host.innerHTML = `<div class="panel-empty"><strong>Computing chart…</strong><p>Reading numeric values from the bound dataset.</p></div>`;
        void (async () => {
          layer = this.mapController.getLayer(context.config.binding?.layerId) || this.mapController.getLayer(context.state.value.activeLayerId) || this.mapController.getLayers()[0];
          if (!layer?.queryable) {
            host.innerHTML = `<div class="panel-empty"><strong>Choose a feature layer</strong><p>This chart needs a queryable dataset binding.</p></div>`;
            return;
          }
          layer = await this.mapController.loadLayer(layer.uid);
          field = layer.fields?.find((item) => item.name === context.config.settings?.field) || layer.fields?.find((item) => /(?:double|integer|small-integer|single|long|short)/i.test(item.type || "") && item.name !== layer.objectIdField);
          if (!field) {
            host.innerHTML = `<div class="panel-empty"><strong>Choose a numeric field</strong><p>${escapeHtml(layer.title || "This layer")} has no automatically detected numeric measure.</p></div>`;
            return;
          }
          const result = await this.mapController.queryFeatures(layer.uid, { where: layer.where || "1=1", outFields: [field.name], returnGeometry: false, num: 1000 }, { layerDefaults: false });
          const values = result.features.map((feature) => Number(feature.attributes?.[field.name])).filter(Number.isFinite);
          if (!values.length) {
            host.innerHTML = `<div class="panel-empty"><strong>No numeric values</strong><p>The selected field has no values in the loaded query.</p></div>`;
            return;
          }
          const min = Math.min(...values); const maxValue = Math.max(...values); const width = (maxValue - min || 1) / 8;
          bins = Array.from({ length: 8 }, (_, index) => ({ min: min + width * index, max: index === 7 ? maxValue : min + width * (index + 1), count: 0 }));
          values.forEach((value) => { bins[Math.min(7, Math.floor((value - min) / width))].count += 1; });
          render(context.state.value.filters);
        })().catch((error) => { host.innerHTML = `<div class="panel-empty"><strong>Chart unavailable</strong><p>${escapeHtml(error.message)}</p></div>`; });
        const subscription = context.state.subscribe(render, (state) => state.filters);
        context.onCleanup(() => subscription.remove());
      },
    });
    this.panels.register({
      type: "chapters", displayName: "Chapters", description: "Author and play guided map presentations.", category: "Presentation", bindings: ["shared-selection", "shared-time"], placements: ["left", "right", "bottom"], multiple: false, status: "conditional",
      availability: () => ({ available: Boolean(this.projectManager.current.presentation?.chapters?.length), reason: "Add an Atlas chapter first." }),
      mount: (host, context) => {
        const chapters = context.config.settings?.chapters || this.projectManager.current.presentation?.chapters || [];
        host.innerHTML = chapters.length ? `<ol class="composable-chapters">${chapters.map((chapter) => `<li><strong>${escapeHtml(chapter.title || "Chapter")}</strong><small>${escapeHtml(chapter.body || "Saved map view")}</small></li>`).join("")}</ol>` : `<div class="panel-empty"><strong>No chapters yet</strong><p>Capture a map view in Atlas edit mode to add the first chapter.</p></div>`;
      },
    });
    this.panels.register({
      type: "ai-chatbot", displayName: "AI Map Assistant", description: "Chat with your AI model to build maps, briefings, tours and field tasks.", category: "Analysis", bindings: ["active-layer", "shared-selection", "shared-time"], placements: ["left", "right", "bottom", "floating"], multiple: false,
      mount: (host, context) => this.#mountAIQueryPanel(host, context),
    });
    this.panels.register({
      type: "data-catalog", displayName: "Data Catalog", description: "Named, versioned analytical relations and source metadata.", category: "Data", bindings: ["active-layer", "fixed-layer"], placements: ["left", "right", "bottom"], multiple: false,
      mount: (host, context) => this.#mountCatalogPanel(host, context),
    });
    this.panels.register({
      type: "sql", displayName: "SQL Workspace", description: "Run validated read-only SQL locally with DuckDB-Wasm.", category: "Analysis", bindings: ["active-layer", "fixed-layer"], placements: ["left", "right", "bottom", "floating"], multiple: true,
      mount: (host, context) => this.#mountSQLPanel(host, context),
    });
  }

  #mountConfiguredChartPanel(host, context) {
    let spec = createChartSpec(context.config.settings.chart);
    const filterId = `${context.config.instanceId}:chart`;
    let result = null;
    let displayRows = [];
    let chartInstance = null;
    let resizeObserver = null;
    let request = 0;
    const root = this.document.documentElement;
    // The clicked group stays lit on the map; hovering another mark lights it
    // up until the pointer leaves the chart.
    let pinned = null;
    const lightUp = (row) => {
      const records = row && result ? result.selection(row) : [];
      if (!records.length) return;
      void this.mapController.highlightFeature({ kind: "feature", layerUid: result.layer.uid, layerTitle: result.layer.title, attributes: records[0].attributes || {}, geometry: records[0].geometry || null, features: records.slice(0, 2000).map((record) => ({ attributes: record.attributes || {}, geometry: record.geometry || null })) }, { pulse: false });
    };
    const restoreHighlight = () => {
      const row = pinned && displayRows.find((item) => item.label === pinned);
      if (row) lightUp(row);
      else this.mapController.clearFeatureHighlight?.();
    };
    const selectRow = (row) => {
      const records = result?.selection(row) || [];
      const ids = records.map((record) => record.attributes?.[result.layer.objectIdField]).filter((value) => value != null);
      context.dispatch("selection:set", { layerId: result.layer.uid, objectIds: ids, features: records.slice(0, 100).map((record) => ({ attributes: record.attributes || {}, geometry: record.geometry || null, layerTitle: result.layer.title })) }, { undoable: false });
      pinned = row.label;
      lightUp(row);
      // Frame the group so a click on a bar takes the map to that area.
      const located = records.filter((record) => record.geometry);
      if (located.length) void this.mapController.goToFeatures(located.slice(0, 2000), { animate: true }).catch(() => {});
      const note = host.querySelector("[data-dashboard-chart-selection]");
      if (note) note.textContent = `${records.length.toLocaleString()} matching feature${records.length === 1 ? "" : "s"} selected on the map.`;
    };
    const filterRow = (row) => {
      const expression = chartFilterForRow(result, row);
      selectRow(row);
      if (expression?.where) context.dispatch("filters:set", { id: filterId, owner: context.config.instanceId, scope: "project", layerId: result.layer.uid, expression });
    };
    // Style changes (top N, Other, hidden categories, look) are presentation
    // only: they are kept with the panel and redrawn without a new query.
    const restyle = (changes) => {
      spec = createChartSpec({ ...spec, style: { ...spec.style, ...changes } });
      this.#storeChartSpec(context.config.instanceId, spec);
      draw();
    };
    const tokens = () => {
      const style = getComputedStyle(root);
      const token = (name) => style.getPropertyValue(name).trim();
      return {
        tokens: { ink: token("--ink"), muted: token("--muted"), line: token("--line"), surface: token("--surface"), font: token("--ui-font") },
        palette: ["--green-2", "--amber", "--green", "--danger"].map(token).filter(Boolean),
      };
    };
    const categorical = () => ["bar", "column", "donut", "bar3d", "boxplot"].includes(spec.type);
    const toolbar = () => {
      if (!categorical()) return "";
      const all = chartCategories(result);
      const topN = spec.style.topN ?? CHART_DEFAULT_TOP[spec.type] ?? 0;
      const options = [...new Set([5, 8, 12, 16, 24, 40, topN])].filter((value) => value > 0).sort((a, b) => a - b);
      const hidden = new Set(spec.style.hidden);
      return `<div class="chart-dashboard__tools" role="group" aria-label="Chart categories"><label><span>Show</span><select data-chart-top>${options.map((value) => `<option value="${value}"${value === topN ? " selected" : ""}>Top ${value}</option>`).join("")}<option value="0"${topN === 0 ? " selected" : ""}>All ${all.length}</option></select></label><label><span>Rest</span><select data-chart-other><option value="group"${spec.style.other === "group" ? " selected" : ""}>Group as Other</option><option value="hide"${spec.style.other === "hide" ? " selected" : ""}>Leave out</option></select></label><details class="chart-dashboard__categories"><summary data-chart-category-count>${all.length - hidden.size}/${all.length}</summary><div class="chart-dashboard__category-list"><button type="button" data-chart-show-all>Show all</button>${all.map((item) => `<label title="${escapeHtml(item.label)}"><input type="checkbox" value="${escapeHtml(item.label)}"${hidden.has(String(item.label)) ? "" : " checked"} data-chart-category><span>${escapeHtml(item.label)}</span><small>${item.value.toLocaleString(undefined, { maximumFractionDigits: 1 })}</small></label>`).join("")}</div></details></div>`;
    };
    const stats = (summary, theme) => {
      if (!summary) return "";
      const number = (value) => Number(value).toLocaleString(undefined, { notation: Math.abs(value) >= 100000 ? "compact" : "standard", maximumFractionDigits: Math.abs(value) >= 100 ? 0 : 2 });
      const measure = summary.aggregation === "count" ? "Records" : `${summary.aggregation === "sum" ? "Total" : summary.aggregation === "avg" ? "Average" : summary.aggregation === "min" ? "Lowest" : "Highest"} ${summary.field || ""}`.trim();
      const tiles = [
        summary.total != null ? [measure, number(summary.total)] : ["Matching records", number(summary.records ?? 0)],
        ["Groups", `${summary.groups.toLocaleString()}${summary.shown < summary.groups ? `<small> · ${summary.shown} shown</small>` : ""}`],
        summary.top ? [`Leading ${spec.dimension?.field || "group"}`, `${escapeHtml(summary.top.label)}${summary.top.share != null ? `<small> · ${(summary.top.share * 100).toFixed(summary.top.share < .1 ? 1 : 0)}%</small>` : ""}`] : null,
      ].filter(Boolean);
      return `<dl class="chart-dashboard__stats chart-dashboard__stats--${theme}">${tiles.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${value}</dd></div>`).join("")}</dl>`;
    };
    const draw = async () => {
      if (!result) return;
      const token = request;
      const shell = host.querySelector(".chart-dashboard");
      if (!shell) return;
      const theme = resolveChartTheme(spec, root.dataset.skin);
      const chartResult = { ...result, chart: spec };
      displayRows = displayChartRows(chartResult);
      const { tokens: interfaceTokens, palette } = tokens();
      const colored = chartColors(chartResult, displayRows, { renderer: result.layer.renderer || this.mapController.getLayerConfig?.(result.layer.uid)?.renderer || null, palette: palette.length ? palette : undefined, theme });
      shell.className = `composable-chart chart-dashboard chart-dashboard--${theme}`;
      fit();
      shell.querySelector("[data-chart-stats]").innerHTML = stats(chartSummary(chartResult, displayRows), theme);
      const hidden = spec.style.hidden.length;
      const count = shell.querySelector("[data-chart-category-count]");
      if (count) count.textContent = `${chartCategories(chartResult).length - hidden}/${chartCategories(chartResult).length}`;
      shell.querySelector("[data-chart-colors]").textContent = [colored.note, hidden ? `${hidden} categor${hidden === 1 ? "y" : "ies"} left out.` : ""].filter(Boolean).join(" ");
      const plot = shell.querySelector("[data-chart-plot]");
      chartInstance?.dispose?.(); chartInstance = null;
      plot.innerHTML = renderChartFallback(chartResult, { rows: displayRows, colors: colored.colors });
      plot.querySelectorAll("[data-chart-row]").forEach((mark) => {
        const activate = () => filterRow(displayRows[Number(mark.dataset.chartRow)]);
        mark.addEventListener("click", activate);
        mark.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); activate(); } });
        const hover = () => lightUp(displayRows[Number(mark.dataset.chartRow)]);
        mark.addEventListener("mouseenter", hover);
        mark.addEventListener("focus", hover);
        mark.addEventListener("mouseleave", restoreHighlight);
        mark.addEventListener("blur", restoreHighlight);
      });
      try {
        const echarts = await loadECharts();
        if (token !== request || !displayRows.length || ["kpi", "bar3d", "scatter3d"].includes(spec.type)) return;
        const canvas = this.document.createElement("div"); canvas.className = "chart-builder__canvas";
        // Horizontal bars keep a readable row height; the plot scrolls past that.
        if (spec.type === "bar") canvas.style.minHeight = `${displayRows.length * 20 + 24}px`;
        plot.replaceChildren(canvas);
        chartInstance = echarts.init(canvas, null, { renderer: "canvas" });
        chartInstance.setOption(chartOption(chartResult, { rows: displayRows, colors: colored.colors, theme, tokens: interfaceTokens, palette: palette.length ? palette : undefined }));
        chartInstance.on("click", (event) => { const row = displayRows[event.dataIndex]; if (row) filterRow(row); });
        chartInstance.on("mouseover", (event) => lightUp(displayRows[event.dataIndex]));
        chartInstance.on("mouseout", restoreHighlight);
        chartInstance.on("globalout", restoreHighlight);
      } catch { /* Keep the accessible fallback chart. */ }
    };
    const query = async () => {
      const token = ++request;
      const layer = this.mapController.getLayer(spec.source.layerId) || this.mapController.getLayer(context.state.value.activeLayerId) || this.mapController.getLayers()[0];
      if (!layer?.queryable) { host.innerHTML = `<div class="panel-empty"><strong>Choose a feature layer</strong><p>This chart’s source is unavailable.</p></div>`; return; }
      if (!result) host.innerHTML = `<div class="panel-empty"><strong>Computing ${escapeHtml(spec.title)}…</strong><p>Applying the current layer filter.</p></div>`;
      try {
        const next = await queryChart(this.mapController, layer, { ...spec, source: { ...spec.source, layerId: layer.uid } });
        if (token !== request) return;
        result = next;
        const warning = result.quality.status === "complete" ? `${result.quality.processedRecords.toLocaleString()} matching records` : result.quality.warning;
        const activeFilter = context.state.value.filters[filterId];
        const filterHint = activeFilter?.expression?.label
          ? `Map filter active: ${activeFilter.expression.label}.`
          : "Click a chart mark to filter the map to that group.";
        host.innerHTML = `<div class="composable-chart chart-dashboard"><header class="chart-dashboard__head"><span class="eyebrow">${escapeHtml(result.layer.title || "Layer")} · linked</span>${toolbar()}</header><div data-chart-stats></div><div class="chart-dashboard__plot" data-chart-plot></div><footer class="chart-dashboard__notes"><p class="form-note">${escapeHtml(warning)} · <span data-dashboard-chart-filter>${escapeHtml(filterHint)}</span></p><p class="form-note" data-chart-colors></p><p data-dashboard-chart-selection class="form-note"></p>${activeFilter ? '<button type="button" class="chart-dashboard__clear" data-dashboard-chart-clear>Show all map data</button>' : ""}</footer></div>`;
        if (!activeFilter) pinned = null;
        host.querySelector("[data-dashboard-chart-clear]")?.addEventListener("click", () => { pinned = null; this.mapController.clearFeatureHighlight?.(); context.dispatch("filters:clear", { id: filterId }); });
        host.querySelector("[data-chart-top]")?.addEventListener("change", (event) => restyle({ topN: Number(event.target.value) }));
        host.querySelector("[data-chart-other]")?.addEventListener("change", (event) => restyle({ other: event.target.value }));
        host.querySelectorAll("[data-chart-category]").forEach((box) => box.addEventListener("change", () => {
          restyle({ hidden: [...host.querySelectorAll("[data-chart-category]")].filter((item) => !item.checked).map((item) => item.value) });
        }));
        host.querySelector("[data-chart-show-all]")?.addEventListener("click", () => {
          host.querySelectorAll("[data-chart-category]").forEach((item) => { item.checked = true; });
          restyle({ hidden: [] });
        });
        await draw();
      } catch (error) {
        if (token === request) host.innerHTML = `<div class="panel-empty"><strong>Chart unavailable</strong><p>${escapeHtml(error.message)}</p></div>`;
      }
    };
    // A short panel gives its height to the plot: the stats and colour note step aside.
    const fit = () => host.querySelector(".chart-dashboard")?.classList.toggle("is-short", host.clientHeight > 0 && host.clientHeight < 300);
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => { fit(); chartInstance?.resize?.(); });
      resizeObserver.observe(host);
    }
    // A new skin or light/dark switch redraws in the new colours.
    const appearance = typeof MutationObserver !== "undefined" ? new MutationObserver(() => void draw()) : null;
    appearance?.observe(root, { attributes: true, attributeFilter: ["data-skin", "data-theme", "style"] });
    // The layer's style can change after the chart is made; its colours follow.
    const styled = this.events.subscribe?.("layer:changed", ({ uid } = {}) => { if (result && uid === result.layer.uid) void draw(); });
    const subscription = context.state.subscribe(() => void query(), (state) => state.filters);
    context.onCleanup(() => { subscription.remove(); styled?.remove?.(); appearance?.disconnect(); resizeObserver?.disconnect(); chartInstance?.dispose?.(); });
    void query();
  }

  /** Keep a chart panel's edited definition without remounting the workspace. */
  #storeChartSpec(instanceId, chart) {
    for (const config of new Set([this.currentConfig, this.layout.current].filter(Boolean))) {
      const panel = config.panels?.find((item) => item.instanceId === instanceId);
      if (panel) panel.settings = { ...panel.settings, chart };
    }
    const charts = this.projectManager.current?.charts;
    if (Array.isArray(charts) && charts.some((item) => item.id === chart.id)) this.projectManager.setCharts?.(charts.map((item) => item.id === chart.id ? chart : item));
  }

  #catalogWithActiveLayer() {
    const stored = normalizeDataCatalog(this.projectManager.current.dataCatalog);
    if (stored.relations.length) return stored;
    const layer = this.mapController.getLayer(this.state.value.activeLayerId) || this.mapController.getLayers()[0];
    if (!layer) return stored;
    return normalizeDataCatalog({
      ...stored,
      relations: [{
        name: "active_layer", title: layer.title || "Active layer", description: "Browser-loaded feature records from the active map layer.",
        source: { format: "json", layerId: layer.uid },
        schema: (layer.fields || []).map((field) => ({ name: field.name, type: this.#duckType(field.type), unit: null })),
      }],
    });
  }

  #duckType(type) {
    if (/date/i.test(type || "")) return "TIMESTAMP";
    if (/double|single|float/i.test(type || "")) return "DOUBLE";
    if (/integer|small|long|short|oid/i.test(type || "")) return "BIGINT";
    return "VARCHAR";
  }

  async #layerRows(layerId) {
    const layer = this.mapController.getLayer(layerId);
    if (!layer?.queryable) throw new Error("The catalog relation is not bound to a queryable feature layer.");
    const result = await this.mapController.queryFeatures(layer.uid, { where: layer.where || "1=1", outFields: ["*"], returnGeometry: false, num: 5000 }, { layerDefaults: false });
    return result.features.map((feature) => feature.attributes || {});
  }

  #mountCatalogPanel(host, context) {
    const render = () => {
      const catalog = this.#catalogWithActiveLayer();
      host.innerHTML = `<div class="catalog-panel"><div><span class="eyebrow">Versioned data catalog</span><h3>${escapeHtml(catalog.title)}</h3><p>Stable relation names are stored with the project; source data remains external or in the active browser layer.</p></div>${catalog.relations.map((relation) => `<article><strong>${escapeHtml(relation.title)}</strong><code>${escapeHtml(relation.name)}</code><small>${escapeHtml(relation.description || `${relation.source.format} source`)}</small><span>${relation.schema.length} fields · ${escapeHtml(relation.source.format)}</span></article>`).join("") || `<div class="panel-empty"><strong>No catalog relations</strong><p>Add a queryable layer or import a catalog manifest.</p></div>`}<p class="form-note">View-only catalogs are analytical recipes, not access control. Readers still need permission to every referenced source.</p></div>`;
    };
    render();
    const subscription = this.events.subscribe("catalog:changed", render);
    context.onCleanup(() => subscription.remove());
  }

  #mountAIQueryPanel(host, context) {
    // The app's Map assistant (js/assistant-panel.js) when the UI provides it; the
    // rule-based query planner below remains for headless and test runtimes.
    if (this.mountAssistant) return this.mountAssistant(host, context);
    const catalog = this.#catalogWithActiveLayer();
    const session = this.panelSessions.get(context.config.instanceId) || { prompt: "", messages: [] };
    this.panelSessions.set(context.config.instanceId, session);
    host.innerHTML = `<form class="ai-query-panel"><div><span class="eyebrow">AI-native map</span><strong>Approved actions only</strong></div><div class="ai-query-panel__quick" aria-label="Quick map actions"><button type="button" data-ai-action="home">Full globe</button><button type="button" data-ai-action="in">Zoom in</button><button type="button" data-ai-action="out">Zoom out</button><button type="button" data-ai-tools>Other tools</button><button type="button" data-ai-undo>Undo</button></div><label class="field"><span>Ask about the map or catalog data</span><textarea rows="4" data-ai-query placeholder="Show active_layer records where value is above 10">${escapeHtml(session.prompt)}</textarea></label><div class="sql-panel__actions"><button type="submit">Build reviewed action</button><button type="button" class="button--quiet" data-ai-cancel disabled>Cancel</button></div><div data-ai-plan class="sql-status">${session.messages.length ? session.messages.map((message) => `<p>${escapeHtml(message)}</p>`).join("") : "Conversation stays available while layouts and themes change. Unsupported requests are explained instead of guessed."}</div></form>`;
    const form = host.querySelector("form");
    host.querySelectorAll("[data-ai-action]").forEach((button) => button.addEventListener("click", async () => {
      const action = button.dataset.aiAction;
      const output = host.querySelector("[data-ai-plan]");
      output.textContent = `Running ${action}…`;
      try { await context.runtime.runTool("map.navigate", { action }); session.messages.push(`Map action completed: ${action}.`); output.textContent = session.messages.at(-1); }
      catch (error) { output.textContent = `Unavailable: ${error.message}`; }
    }));
    host.querySelector("[data-ai-tools]").addEventListener("click", () => context.runtime.runTool("application.layout.mode", { kind: "workspace" }, { preview: true }));
    host.querySelector("[data-ai-undo]").addEventListener("click", () => { host.querySelector("[data-ai-plan]").textContent = context.runtime.undo() ? "Undid the last reversible application change." : "There is no reversible application change to undo."; });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const output = host.querySelector("[data-ai-plan]");
      const cancel = host.querySelector("[data-ai-cancel]");
      session.prompt = host.querySelector("[data-ai-query]").value;
      cancel.disabled = false;
      output.textContent = "Planning a constrained action…";
      try {
        const plan = planNaturalLanguageQuery(session.prompt, catalog);
        session.messages.push(plan.explanation);
        output.innerHTML = `<strong>${escapeHtml(plan.explanation)}</strong><code>${escapeHtml(plan.sql)}</code><div><button type="button" data-ai-run>Run in SQL workspace</button>${plan.filter ? `<button type="button" class="button--quiet" data-ai-filter>Apply map filter</button>` : ""}</div>`;
        output.querySelector("[data-ai-run]").addEventListener("click", () => context.runtime.runTool("application.panel.add", { type: "sql", title: "AI SQL query", region: "bottom", settings: { sql: plan.sql } }));
        output.querySelector("[data-ai-filter]")?.addEventListener("click", () => {
          const field = String(plan.filter.field).replaceAll('"', '""');
          context.dispatch("filters:set", { id: `${context.config.instanceId}:nlp`, owner: context.config.instanceId, scope: "project", layerId: plan.filter.layerId, expression: { kind: "comparison", ...plan.filter, where: `"${field}" ${plan.filter.operator} ${plan.filter.value}` } });
        });
      } catch (error) { output.textContent = `Unavailable: ${error.message}`; }
      finally { cancel.disabled = true; }
    });
    host.querySelector("[data-ai-cancel]").addEventListener("click", () => { host.querySelector("[data-ai-plan]").textContent = "Request cancelled. No map changes were applied."; });
  }

  #mountSQLPanel(host, context) {
    const initial = context.config.settings?.sql || "SELECT * FROM active_layer LIMIT 25";
    host.innerHTML = `<div class="sql-panel"><div class="sql-panel__heading"><span class="eyebrow">Local DuckDB-Wasm</span><strong>Read-only SQL</strong></div><label class="field"><span>Query</span><textarea data-sql rows="5" spellcheck="false">${escapeHtml(initial)}</textarea></label><p class="form-note sql-panel__tables" data-sql-tables></p><div class="sql-panel__actions"><button type="button" class="button--primary" data-sql-run>Run query</button><button type="button" class="button--secondary" data-sql-sample>Reset example</button></div><p class="form-note">One read-only statement; up to 500 rows are shown. DuckDB starts on the first run.</p><div data-sql-output class="sql-status" role="status" aria-live="polite"></div></div>`;
    const layer = this.mapController.getLayer(this.state.value.activeLayerId) || this.mapController.getLayers()[0];
    host.querySelector("[data-sql-tables]").innerHTML = layer ? `Table <code>active_layer</code> is <strong>${escapeHtml(layer.title || "the active layer")}</strong>.` : "Add a layer to the map to query it as <code>active_layer</code>.";
    // Not a <form>: hosts such as the app dialog are already forms, and nested forms are dropped by the parser.
    host.querySelector("[data-sql-sample]").addEventListener("click", () => { host.querySelector("[data-sql]").value = "SELECT * FROM active_layer LIMIT 25"; });
    const run = async () => {
      const output = host.querySelector("[data-sql-output]");
      const button = host.querySelector("[data-sql-run]");
      try {
        const sql = validateReadOnlySQL(host.querySelector("[data-sql]").value);
        button.disabled = true; output.textContent = "Loading catalog and running locally…";
        const catalog = this.#catalogWithActiveLayer();
        await this.duckdb.loadCatalog(catalog, (layerId) => this.#layerRows(layerId));
        const rows = (await this.duckdb.query(sql)).slice(0, 500);
        const fields = Object.keys(rows[0] || {});
        output.innerHTML = rows.length ? `<div class="sql-result"><table><thead><tr>${fields.map((field) => `<th>${escapeHtml(field)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${fields.map((field) => `<td>${escapeHtml(row[field])}</td>`).join("")}</tr>`).join("")}</tbody></table></div><p>${rows.length} rows shown.</p>` : "Query returned no rows.";
      } catch (error) { output.innerHTML = `<p class="sql-status__error"><strong>Query unavailable.</strong> ${escapeHtml(error.message)}</p>`; }
      finally { button.disabled = false; }
    };
    host.querySelector("[data-sql-run]").addEventListener("click", run);
    host.querySelector("[data-sql]").addEventListener("keydown", (event) => { if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) { event.preventDefault(); void run(); } });
  }
}
