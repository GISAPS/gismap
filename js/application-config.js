const PRESET_PANEL = (instanceId, type, title, region, order, extra = {}) => ({
  instanceId, type, title, placement: { region, order }, binding: { followActiveLayer: true }, settings: {}, audienceVisible: true, ...extra,
});

export const APPLICATION_PRESETS = Object.freeze({
  standard: {
    preset: "standard", title: "Standard workspace", skin: "clean-light",
    panels: [
      PRESET_PANEL("places-main", "places", "Places", "left", 0),
      PRESET_PANEL("bookmarks-main", "bookmarks", "Bookmarks", "left", 1, { audienceVisible: false }),
      PRESET_PANEL("draw-main", "draw", "Draw", "left", 2, { audienceVisible: false }),
      PRESET_PANEL("intelligence-main", "intelligence", "Intelligence", "left", 3),
      PRESET_PANEL("layers-main", "layers", "Layers", "left", 4),
    ],
  },
  explorer: {
    preset: "explorer", title: "Dataset explorer", skin: "clean-light",
    panels: [
      PRESET_PANEL("layers-main", "layers", "Layers", "left", 0),
      PRESET_PANEL("places-main", "places", "Places", "left", 1),
      PRESET_PANEL("attributes-main", "attributes", "Selected records", "right", 0, { binding: { followActiveLayer: true, followSelection: true } }),
      PRESET_PANEL("chart-main", "charts", "Distribution", "bottom", 0, { settings: { chartType: "histogram" } }),
    ],
  },
  briefing: {
    preset: "briefing", title: "Operational briefing", skin: "dark-analytical",
    panels: [
      PRESET_PANEL("intelligence-main", "intelligence", "Situation summary", "left", 0),
      PRESET_PANEL("attributes-main", "attributes", "Selected details", "right", 0, { binding: { followSelection: true } }),
      PRESET_PANEL("chart-main", "charts", "Category summary", "bottom", 0),
    ],
  },
  atlas: {
    preset: "atlas", title: "Guided atlas", skin: "clean-light",
    panels: [
      PRESET_PANEL("chapters-main", "chapters", "Chapters", "left", 0),
      PRESET_PANEL("bookmarks-main", "bookmarks", "Saved places", "left", 1),
      PRESET_PANEL("attributes-main", "attributes", "Place details", "right", 0, { binding: { followSelection: true } }),
    ],
  },
  "ai-map": {
    preset: "ai-map", title: "AI Map", skin: "violet-circuit", layout: { kind: "ai-map" },
    panels: [
      PRESET_PANEL("ai-map-main", "ai-chatbot", "AI Map Assistant", "right", 0, { binding: { followActiveLayer: true } }),
    ],
  },
  operations: {
    preset: "operations", title: "Operations board", skin: "dark-analytical", layout: { kind: "bottom-workspace" },
    panels: [
      PRESET_PANEL("layers-main", "layers", "Operational layers", "left", 0),
      PRESET_PANEL("intelligence-main", "intelligence", "Map intelligence", "left", 1),
      PRESET_PANEL("attributes-main", "attributes", "Selected feature", "right", 0, { binding: { followActiveLayer: true, followSelection: true } }),
      PRESET_PANEL("chart-main", "charts", "Live distribution", "bottom", 0, { settings: { chartType: "histogram" } }),
    ],
  },
  globe: {
    preset: "globe", title: "Orbital globe", skin: "velvet-orbit", layout: { kind: "globe" },
    panels: [
      PRESET_PANEL("places-main", "places", "Places", "left", 0),
      PRESET_PANEL("layers-main", "layers", "Layers", "left", 1),
      PRESET_PANEL("intelligence-main", "intelligence", "Map intelligence", "right", 0),
      PRESET_PANEL("bookmarks-main", "bookmarks", "Saved places", "right", 1, { audienceVisible: false }),
    ],
  },
});

const clone = (value) => structuredClone(value);

export function presetApplication(id = "standard") {
  const preset = APPLICATION_PRESETS[id] || APPLICATION_PRESETS.standard;
  return normalizeApplicationConfig({ schemaVersion: 1, ...clone(preset) });
}

export function normalizeApplicationConfig(value = {}) {
  const base = APPLICATION_PRESETS[value.preset] || APPLICATION_PRESETS.standard;
  const panels = Array.isArray(value.panels) ? value.panels : clone(base.panels);
  const used = new Set();
  return {
    schemaVersion: 1,
    configured: value.configured === true,
    preset: typeof value.preset === "string" ? value.preset : base.preset,
    title: String(value.title || base.title || "Map application"),
    skin: typeof value.skin === "string" ? value.skin : base.skin,
    mode: value.mode === "present" ? "present" : "edit",
    layout: {
      kind: ["workspace", "bottom-nav", "bottom-workspace", "globe", "ai-map"].includes(value.layout?.kind)
        ? value.layout.kind
        : (base.layout?.kind || "workspace"),
      bottomHeight: Number.isFinite(value.layout?.bottomHeight) ? Math.min(720, Math.max(180, value.layout.bottomHeight)) : 280,
      activeBottomPanel: typeof value.layout?.activeBottomPanel === "string" ? value.layout.activeBottomPanel : null,
      bottomCollapsed: value.layout?.bottomCollapsed === true,
      // "workspace": the sidebar panels (Places, Layers, …) stay in the user's
      // sidebar as they were; the application only adds its own panels.
      sidebar: value.layout?.sidebar === "workspace" ? "workspace" : "application",
    },
    panels: panels.map((panel, index) => {
      let instanceId = String(panel?.instanceId || `${panel?.type || "panel"}-${index + 1}`);
      while (used.has(instanceId)) instanceId = `${instanceId}-${index + 1}`;
      used.add(instanceId);
      const region = ["left", "right", "bottom", "floating"].includes(panel?.placement?.region) ? panel.placement.region : "left";
      return {
        instanceId,
        type: String(panel?.type || "unknown"),
        title: String(panel?.title || panel?.type || "Panel"),
        placement: {
          region,
          order: Number.isFinite(panel?.placement?.order) ? panel.placement.order : index,
          size: {
            width: Number.isFinite(panel?.placement?.size?.width) ? panel.placement.size.width : 360,
            height: Number.isFinite(panel?.placement?.size?.height) ? panel.placement.size.height : 300,
          },
          position: {
            x: Number.isFinite(panel?.placement?.position?.x) ? panel.placement.position.x : 24,
            y: Number.isFinite(panel?.placement?.position?.y) ? panel.placement.position.y : 80,
          },
          ...(panel?.placement || {}),
        },
        binding: clone(panel?.binding || { followActiveLayer: true }),
        settings: clone(panel?.settings || {}),
        audienceVisible: panel?.audienceVisible !== false,
        collapsed: panel?.collapsed === true,
      };
    }),
  };
}

export function migratePresentationToApplication(project = {}) {
  if (project.application) return normalizeApplicationConfig(project.application);
  const legacy = project.presentation || {};
  const application = presetApplication(legacy.template || "standard");
  application.title = legacy.title || application.title;
  application.skin = legacy.skin || application.skin;
  application.panels = application.panels.map((panel) => ({
    ...panel,
    binding: {
      ...panel.binding,
      ...(legacy.primaryLayerId && ["attributes", "charts", "intelligence", "ai-chatbot"].includes(panel.type) ? { layerId: legacy.primaryLayerId, followActiveLayer: false } : {}),
    },
    settings: panel.type === "chapters"
      ? { ...panel.settings, chapters: clone(legacy.chapters || []) }
      : panel.type === "charts"
        ? { ...panel.settings, field: legacy.fieldMappings?.metric || legacy.fieldMappings?.value || panel.settings?.field }
        : panel.settings,
  }));
  return normalizeApplicationConfig(application);
}

export function applicationToLegacyPresentation(application, previous = {}) {
  const config = normalizeApplicationConfig(application);
  const chapters = config.panels.find((panel) => panel.type === "chapters")?.settings?.chapters || previous.chapters || [];
  const fixedLayer = config.panels.map((panel) => panel.binding?.layerId).find(Boolean) || previous.primaryLayerId || null;
  return {
    ...previous,
    schemaVersion: 1,
    template: ["standard", "briefing", "explorer", "atlas", "ai-map"].includes(config.preset) ? config.preset : "standard",
    skin: config.skin,
    title: config.title,
    primaryLayerId: fixedLayer,
    chapters,
  };
}
