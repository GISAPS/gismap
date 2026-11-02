// Every basemap id GISMap Online knows, the engine that draws it natively, and its
// closest match on the other engine, so a link made with one engine opens on
// a sensible basemap with the other. Engine-neutral and pure.

export const BASEMAPS = Object.freeze([
  { id: "topo-3d", label: "3D Topographic", group: "3D basemaps", engine: "arcgis", maplibre: "open-liberty" },
  { id: "navigation-3d", label: "3D Navigation", group: "3D basemaps", engine: "arcgis", maplibre: "open-bright" },
  { id: "navigation-dark-3d", label: "3D Navigation — dark", group: "3D basemaps", engine: "arcgis", maplibre: "open-dark" },
  { id: "osm-3d", label: "3D OpenStreetMap", group: "3D basemaps", engine: "arcgis", maplibre: "open-bright" },
  { id: "gray-3d", label: "3D Light gray", group: "3D basemaps", engine: "arcgis", maplibre: "open-positron" },
  { id: "dark-gray-3d", label: "3D Dark gray", group: "3D basemaps", engine: "arcgis", maplibre: "open-dark" },
  { id: "streets-3d", label: "3D Streets", group: "3D basemaps", engine: "arcgis", maplibre: "open-bright" },
  { id: "streets-dark-3d", label: "3D Streets — dark", group: "3D basemaps", engine: "arcgis", maplibre: "open-dark" },
  { id: "topo-vector", label: "Topographic", group: "2D basemaps", engine: "arcgis", maplibre: "open-liberty" },
  { id: "streets-vector", label: "Streets", group: "2D basemaps", engine: "arcgis", maplibre: "open-bright" },
  { id: "navigation", label: "Navigation", group: "2D basemaps", engine: "arcgis", maplibre: "open-bright" },
  { id: "gray-vector", label: "Light gray", group: "2D basemaps", engine: "arcgis", maplibre: "open-positron" },
  { id: "dark-gray-vector", label: "Dark gray", group: "2D basemaps", engine: "arcgis", maplibre: "open-dark" },
  { id: "osm", label: "OpenStreetMap", group: "2D basemaps", engine: "arcgis", maplibre: "open-bright" },
  { id: "satellite", label: "Satellite", group: "Imagery", engine: "arcgis", maplibre: "open-liberty" },
  { id: "hybrid", label: "Satellite + labels", group: "Imagery", engine: "arcgis", maplibre: "open-liberty" },
  { id: "usgs-imagery", label: "USGS Aerial Imagery", group: "Imagery", engine: "maplibre", arcgis: "satellite" },
  { id: "usgs-imagery-topo", label: "USGS Imagery Topo — retiring Nov 16, 2026", group: "Imagery", engine: "maplibre", arcgis: "hybrid" },
  { id: "open-liberty", label: "Liberty — detailed", group: "OpenFreeMap", engine: "maplibre", arcgis: "topo-vector" },
  { id: "open-bright", label: "Bright — streets", group: "OpenFreeMap", engine: "maplibre", arcgis: "streets-vector" },
  { id: "open-positron", label: "Positron — light", group: "OpenFreeMap", engine: "maplibre", arcgis: "gray-vector" },
  { id: "open-dark", label: "Dark", group: "OpenFreeMap", engine: "maplibre", arcgis: "dark-gray-vector" },
  { id: "open-fiord", label: "Fiord", group: "OpenFreeMap", engine: "maplibre", arcgis: "dark-gray-vector" },
  { id: "skin", label: "Skin — follows the look", group: "Styled by the skin", engine: "any" },
].map((entry) => Object.freeze(entry)));

export const BASEMAP_IDS = Object.freeze(BASEMAPS.map(({ id }) => id));

export function basemapEntry(id) {
  return BASEMAPS.find((entry) => entry.id === id) || null;
}

/** The label people see for a basemap id (the id itself when unknown). */
export function basemapLabel(id) {
  return basemapEntry(id)?.label || String(id || "");
}

/** The basemaps an engine draws itself, in menu order. */
export function basemapsForEngine(engineId) {
  return BASEMAPS.filter((entry) => entry.engine === engineId || entry.engine === "any");
}

/**
 * The basemap an engine actually draws for an id: the id itself when the
 * engine has it, else the catalogued equivalent (an ArcGIS id on MapLibre, an
 * OpenFreeMap id on ArcGIS), else the engine's first basemap.
 */
export function basemapOnEngine(id, engineId) {
  const own = basemapsForEngine(engineId);
  if (own.some((entry) => entry.id === id)) return id;
  const equivalent = basemapEntry(id)?.[engineId];
  return own.some((entry) => entry.id === equivalent) ? equivalent : own[0]?.id ?? id;
}
