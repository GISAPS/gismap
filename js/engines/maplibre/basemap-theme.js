// Restyles an OpenMapTiles-schema style (the OpenFreeMap styles) with a
// basemap theme from ../../basemap-themes.js. Each style layer is given a
// role from its type, source layer and id (water, roads, labels, …), and the
// role decides which paint and layout properties the theme sets. Structure,
// zoom ranges, filters, widths and dashes stay as the style's authors made
// them; only colours, visibility and label treatment change. Pure.

/** The role of one style layer, or "other" when it is not recognised. */
export function classifyLayer(layer) {
  const id = String(layer?.id || "").toLowerCase();
  const sourceLayer = layer?.["source-layer"] || null;
  const { type } = layer || {};
  if (type === "background") return "background";
  if (type === "raster" || type === "hillshade" || type === "color-relief") return "relief";
  switch (sourceLayer) {
    case "water":
      return type === "fill" ? "water" : type === "line" ? "waterway" : "water-label";
    case "waterway":
      return type === "symbol" ? "water-label" : "waterway";
    case "water_name":
      return "water-label";
    case "landcover":
      return /ice|glacier|sand|beach|rock/.test(id) ? "landcover-bare" : "landcover";
    case "landuse":
      return "landuse";
    case "park":
      return type === "line" ? "park-outline" : "park";
    case "aeroway":
      return type === "fill" ? "aeroway" : "road-minor";
    case "building":
      return type === "fill-extrusion" ? "building-3d" : "building";
    case "boundary":
      return "boundary";
    case "place":
      return "place-label";
    case "poi":
    case "aerodrome_label":
      return "poi";
    case "transportation_name":
      return /shield/.test(id) ? "road-shield" : "road-label";
    case "transportation":
      if (type === "fill") return "road-area";
      if (type === "symbol") return "road-icon";
      if (/rail|transit/.test(id)) return "rail";
      if (/casing/.test(id)) return "road-casing";
      if (/motorway|trunk|primary/.test(id) && !/link/.test(id)) return "road-major";
      return "road-minor";
    default:
      return "other";
  }
}

/** Paint and layout changes for one role under a theme: { paint, layout, drop: [paint keys to remove] }. */
function changesFor(role, layer, theme) {
  const hidden = { layout: { visibility: "none" } };
  const label = (color) => ({
    paint: { "text-color": color, "text-halo-color": theme.labelHalo, "text-halo-width": 1.2, "text-halo-blur": 0.4 },
    layout: theme.labelTransform !== "none" || theme.labelLetterSpacing
      ? { "text-transform": theme.labelTransform, ...(theme.labelLetterSpacing ? { "text-letter-spacing": theme.labelLetterSpacing } : {}) }
      : {},
  });
  switch (role) {
    case "background": return { paint: { "background-color": theme.land }, drop: ["background-pattern"] };
    case "relief": return hidden;
    case "water": return { paint: { "fill-color": theme.water, "fill-outline-color": theme.water }, drop: ["fill-pattern"] };
    case "waterway": return { paint: { "line-color": theme.waterLine } };
    case "landcover": return { paint: { "fill-color": theme.landcover }, drop: ["fill-pattern"] };
    case "landcover-bare": return { paint: { "fill-color": theme.landcoverBare }, drop: ["fill-pattern"] };
    case "landuse": return { paint: { "fill-color": theme.landuse }, drop: ["fill-pattern"] };
    case "park": return { paint: { "fill-color": theme.park }, drop: ["fill-pattern"] };
    case "park-outline": return { paint: { "line-color": theme.park } };
    case "aeroway": return { paint: { "fill-color": theme.landuse }, drop: ["fill-pattern"] };
    case "road-area": return { paint: { "fill-color": theme.roadMinor }, drop: ["fill-pattern"] };
    case "road-casing": return { paint: { "line-color": theme.roadCasing } };
    case "road-major": return { paint: { "line-color": theme.roadMajor } };
    case "road-minor": return { paint: { "line-color": theme.roadMinor } };
    case "rail": return { paint: { "line-color": theme.rail } };
    case "boundary": return { paint: { "line-color": theme.boundary } };
    case "building": return { paint: { "fill-color": theme.building, "fill-outline-color": theme.buildingOutline } };
    case "building-3d": return { paint: { "fill-extrusion-color": theme.building } };
    case "poi":
    case "road-icon":
    case "road-shield":
      return theme.showPoi ? {} : hidden;
    case "place-label": {
      // Countries, states and cities read strongest; towns and villages recede.
      const strong = /country|state|city|capital/.test(String(layer.id).toLowerCase());
      return label(strong ? theme.labelStrong : theme.label);
    }
    case "road-label": return label(theme.label);
    case "water-label": return label(theme.waterLabel);
    default: return {};
  }
}

/**
 * The style with the theme applied (a new object; the input is not changed).
 * Style metadata records the theme's skin, so a reader can tell themed maps apart.
 */
export function applyBasemapTheme(style, theme) {
  const themed = structuredClone(style);
  themed.metadata = { ...(themed.metadata || {}), "gismap:theme": theme.skin || "custom" };
  themed.layers = (themed.layers || []).map((layer) => {
    const role = classifyLayer(layer);
    const { paint = {}, layout = {}, drop = [] } = changesFor(role, layer, theme);
    const next = { ...layer };
    if (Object.keys(paint).length || drop.length) {
      next.paint = { ...(layer.paint || {}), ...paint };
      for (const key of drop) delete next.paint[key];
      // A pattern hid the colour; with it gone, an opacity tuned for the pattern would wash the colour out.
      if (drop.some((key) => layer.paint?.[key]) && next.paint["fill-opacity"] !== undefined && role !== "landcover") next.paint["fill-opacity"] = 1;
    }
    if (Object.keys(layout).length) next.layout = { ...(layer.layout || {}), ...layout };
    return next;
  });
  return themed;
}

/**
 * The style with 3D buildings (a new object): an extruded "building-3d" layer
 * from the OpenMapTiles building heights, rising from zoom 13 (GISMap Online zoom 14) as in MapLibre's
 * 3D buildings example. Placed under the labels; a style that already has one
 * keeps it. Applied before a theme, so the skin recolours the buildings too.
 */
export function withBuildings3d(style, { visible = true } = {}) {
  const layers = (style.layers || []).map((layer) => (layer.type === "fill-extrusion" && layer["source-layer"] === "building" ? { ...layer, layout: { ...(layer.layout || {}), visibility: visible ? "visible" : "none" } } : layer));
  const flat = layers.find((layer) => layer.type === "fill" && layer["source-layer"] === "building");
  if (!flat || layers.some((layer) => layer.type === "fill-extrusion" && layer["source-layer"] === "building")) return { ...style, layers };
  const color = [flat.paint?.["fill-outline-color"], flat.paint?.["fill-color"]].find((value) => typeof value === "string") || "#d9d6d0";
  const rise = (property) => ["interpolate", ["linear"], ["zoom"], 13, 0, 13.5, ["coalesce", ["get", property], 0]];
  const building = {
    id: "building-3d", type: "fill-extrusion", source: flat.source, "source-layer": "building", minzoom: 13, layout: { visibility: visible ? "visible" : "none" },
    filter: ["!=", ["get", "hide_3d"], true],
    paint: { "fill-extrusion-color": color, "fill-extrusion-height": rise("render_height"), "fill-extrusion-base": rise("render_min_height"), "fill-extrusion-opacity": 0.8 },
  };
  const firstLabel = layers.findIndex((layer) => layer.type === "symbol");
  const at = firstLabel < 0 ? layers.length : firstLabel;
  return { ...style, layers: [...layers.slice(0, at), building, ...layers.slice(at)] };
}
