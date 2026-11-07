// Lazy engine discovery. The application asks for an engine by stable id and
// does not import a renderer implementation directly. Keeping loaders here
// lets a future MapLibre engine ship without downloading the ArcGIS runtime.
import { ENGINE_CAPABILITIES, ENGINE_METHODS } from "./engine-interface.js?v=0.54.2-anim1";
import { GisMapError } from "../gismap-errors.js?v=0.54.0-print";

const definitions = new Map();

export function registerEngine(definition) {
  const id = String(definition?.id || "").trim();
  if (!id || typeof definition?.load !== "function") throw new TypeError("An engine registration needs an id and load function.");
  const capabilities = [...new Set(definition.capabilities || [])];
  if (capabilities.some((name) => !ENGINE_CAPABILITIES.includes(name))) throw new TypeError(`Unknown capability registered for ${id}.`);
  definitions.set(id, Object.freeze({ id, label: definition.label || id, capabilities: Object.freeze(capabilities), load: definition.load }));
  return definitions.get(id);
}

registerEngine({
  id: "arcgis",
  label: "ArcGIS",
  capabilities: ENGINE_CAPABILITIES.filter((name) => !["view-2d", "three-3d", "basemap-themes", "buildings-3d"].includes(name)),
  load: async ({ events, authController }) => {
    const { ArcGISEngine } = await import("./arcgis/arcgis-engine.js?v=0.69.9-order");
    return new ArcGISEngine(events, authController);
  },
});

registerEngine({
  id: "maplibre",
  label: "MapLibre (preview)",
  // Kept in step with MAPLIBRE_CAPABILITIES in maplibre-engine.js (a test checks).
  capabilities: ["view-2d", "view-3d", "spatial-chart-3d", "three-3d", "basemaps", "basemap-themes", "ground", "layers-arcgis", "layers-files", "query", "feature-filter", "renderer-spec", "renderer-native", "identify", "highlight", "capture", "geocode", "buildings-3d", "draw", "measurement", "legend", "tour-markers", "native"],
  load: async ({ events }) => {
    const { MaplibreEngine } = await import("./maplibre/maplibre-engine.js?v=0.69.9-order");
    return new MaplibreEngine(events);
  },
});

export function listEngines() {
  return [...definitions.values()].map(({ load: _load, ...definition }) => definition);
}

export function getEngineDefinition(id) {
  const definition = definitions.get(String(id || ""));
  return definition ? { id: definition.id, label: definition.label, capabilities: [...definition.capabilities] } : null;
}

export async function createEngine(id, context = {}) {
  const definition = definitions.get(String(id || ""));
  if (!definition) throw new GisMapError("INVALID_SPEC", `Unknown map engine “${id}”.`, { details: { engine: id, available: [...definitions.keys()] } });
  const engine = await definition.load(context);
  for (const name of ENGINE_METHODS) {
    if (typeof engine?.[name] !== "function") throw new GisMapError("NOT_READY", `${definition.label} is missing the required engine method ${name}().`, { details: { engine: definition.id, method: name } });
  }
  return engine;
}

