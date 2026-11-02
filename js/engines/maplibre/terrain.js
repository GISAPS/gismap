// Open terrain for the MapLibre renderer. Mapterhorn publishes a key-free
// raster-dem TileJSON endpoint and is the source used by MapLibre's official
// 3D terrain example.
export const TERRAIN_TILEJSON = "https://tiles.mapterhorn.com/tilejson.json";
export const TERRAIN_SOURCE_ID = "gismap-terrain-dem";

/** Whether a map error is one elevation tile failing, not the terrain source itself. */
export const isTerrainTileFailure = (event) => Boolean(event.tile) || Boolean(event.error?.url && event.error.url !== TERRAIN_TILEJSON);
export const HILLSHADE_SOURCE_ID = "gismap-terrain-hillshade-dem";
export const HILLSHADE_LAYER_ID = "gismap-terrain-hillshade";

export const MAPLIBRE_GROUNDS = Object.freeze([
  Object.freeze({ id: "world-elevation", label: "3D terrain", terrain: true, exaggeration: 1 }),
  // Keep the project value when a map authored with ArcGIS bathymetry opens in
  // MapLibre. The open DEM covers land elevation; its label makes that limit clear.
  Object.freeze({ id: "world-topobathymetry", label: "3D terrain — land elevation only", terrain: true, exaggeration: 1 }),
  Object.freeze({ id: "flat", label: "Flat ground", terrain: false, exaggeration: 0 }),
]);

export function maplibreGround(id) {
  return MAPLIBRE_GROUNDS.find((option) => option.id === id) || MAPLIBRE_GROUNDS[0];
}

export function terrainSource() {
  return { type: "raster-dem", url: TERRAIN_TILEJSON };
}

export function hillshadeLayer({ before = null } = {}) {
  return {
    id: HILLSHADE_LAYER_ID,
    type: "hillshade",
    source: HILLSHADE_SOURCE_ID,
    layout: { visibility: "visible" },
    paint: {
      "hillshade-shadow-color": "#26352f",
      "hillshade-highlight-color": "#f4ead1",
      "hillshade-accent-color": "#4f7468",
      "hillshade-exaggeration": 0.28,
    },
    ...(before ? { before } : {}),
  };
}
