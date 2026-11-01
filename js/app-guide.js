import { INTERFACE_SKINS } from "./skin-catalog.js?v=0.57.0-skins2";
/**
 * Where things are in GIS Map Online, for the Map assistant (and anyone else
 * answering "how do I…?"). Keep it in step with the menus in index.html and
 * the Layout & display dialog in ui.js: a test checks the menu labels.
 */

/** The display settings the assistant may change (Map → Layout & display…), with their allowed values. */
export const DISPLAY_SETTINGS = Object.freeze({
  appearance: { label: "Appearance", values: ["system", "light", "dark"] },
  navigationLayout: { label: "Application navigation", values: ["side", "top"] },
  insightPosition: { label: "Map Insight position", values: ["upper-left", "lower-left", "bottom", "dock-left", "dock-right", "dock-top", "dock-bottom"] },
  tablePosition: { label: "Attribute table position", values: ["overlay-bottom", "dock-left", "dock-right", "dock-top", "dock-bottom"] },
  darkBasemapEnabled: { label: "Use a dark basemap when dark mode is enabled", values: [true, false] },
  clickMarkerEnabled: { label: "Show a crosshair where the map is clicked", values: [true, false] },
  highlightEnabled: { label: "Highlight the feature selected in Map Insight", values: [true, false] },
  highlightStyle: { label: "Selection style", values: ["fill", "outline"], help: "fill = filled polygon with outline; outline = outline only" },
  highlightColor: { label: "Feedback color", values: "a #rrggbb colour" },
});

/** The guide: one entry per menu item or setting, with the words people use for it. */
export const APP_GUIDE = Object.freeze([
  // Project menu
  { path: "Project → Select project · Create project · Save project", keywords: "project open new save", text: "Projects keep layers, styles, views, briefings and tours. Save project stores the current map in this browser." },
  { path: "Project → Copy share link", keywords: "share link url copy", text: "Copies a link that opens the map as it is now." },
  { path: "Project → Dashboard Builder", keywords: "dashboard charts", text: "Builds a dashboard of charts and numbers from the map's layers." },
  { path: "Project → Share & export… · Share map link & QR… · Map PDF", keywords: "share export qr code pdf print image", text: "Share a link or QR code, or export the map as a PDF." },
  { path: "Project → Download project… · Import project, tour, or Smart Image · Export guided tour (.gisatlas)", keywords: "download import export file gmo gmop gmoatlas backup", text: "Save the project or a tour as a file, and open one again." },
  { path: "Project → Open from a photo or QR code…", keywords: "photo qr scan image", text: "Opens a map from a Smart Image or a photo of its QR code." },
  { path: "Map → Layout & display…", keywords: "settings layout display appearance dark mode light theme navigation top side panel insight table position dock selection highlight outline fill polygon colour color crosshair click marker default basemap engine", text: "Display settings: appearance (system, light, dark), navigation (side panel or top bar), Map Insight and attribute table positions, default basemap, map engine, dark basemap in dark mode, an optional Map Insight dismissal distance, and Map click feedback: crosshair on click, highlight of the selected feature, Selection style (Filled polygon with outline, or Outline only) and the feedback colour.", setting: true },
  { path: "Tools → Add a Server", keywords: "arcgis sign in login account portal enterprise token standalone", text: "Choose a Portal or standalone server configuration to use secured layers." },
  { path: "Tools → Connect to AI", keywords: "ai model ollama openai anthropic key provider assistant settings", text: "Choose the AI model the Map assistant uses: Ollama on this computer, or a provider with your own key." },
  { path: "Tools → Run JavaScript tool…", keywords: "custom tool javascript plugin script", text: "Loads your own JavaScript tool into the app." },
  { path: "Project → About", keywords: "about version build home gismap online", text: "Shows this installation's version and the GISMap Online home version." },
  // Data menu
  { path: "Data → Add local spatial file", keywords: "file upload kml kmz shapefile shp geojson local", text: "Adds a file from this computer." },
  { path: "Data → Add Geo URL", keywords: "geojson url feed", text: "Adds supported GeoJSON or GeoParquet from a web address." },
  { path: "Data → Add ArcGIS REST service", keywords: "arcgis rest featureserver mapserver imageserver service url layer add", text: "Adds an ArcGIS FeatureServer, MapServer or ImageServer layer by URL." },
  { path: "Data → Add WMS service · Add WFS service", keywords: "wms wfs ogc", text: "Adds an OGC WMS or WFS service." },
  { path: "Data → Popular data services", keywords: "popular datasets examples catalog public data", text: "Curated public datasets to add in one click." },
  // Map menu
  { path: "Map → Map engine", keywords: "engine arcgis maplibre 3d globe switch", text: "Switches between the ArcGIS engine (3D globe) and MapLibre. The page reloads with the same view." },
  { path: "Map → Basemap", keywords: "basemap background map satellite imagery streets topo dark", text: "Chooses the background map. Each engine has its own basemaps; on MapLibre, Skin follows the app's skin colours." },
  { path: "Map → Terrain surface", keywords: "terrain elevation ground 3d", text: "Chooses the 3D ground surface (ArcGIS engine)." },
  { path: "Map → 3D buildings", keywords: "buildings 3d extruded heights city skyline", text: "Shows or hides extruded 3D buildings on MapLibre basemaps (on by default; tilt the map and zoom to a city to see them). They take the skin's colours on the Skin basemap." },
  { path: "Map → Add Bookmarks panel · Add Draw panel", keywords: "bookmarks saved views draw sketch graphics", text: "Adds the Bookmarks or Draw panel to the side panel." },
  // Modes menu
  { path: "Modes → Instant Dashboard…", keywords: "dashboard presentation skin theme look style colours colors interface " + INTERFACE_SKINS.map(({ id, label }) => `${id} ${label}`).join(" ").toLowerCase(), text: `Dashboard skins change the app's look (on MapLibre the Skin basemap follows it): ${INTERFACE_SKINS.map(({ label, description }) => `${label} (${description})`).join(", ")}.` },
  { path: "Modes → Briefing mode · Tours mode · Field collection · Field tasks · Standard map", keywords: "briefing tour atlas field task offline observation data collection mode workflow", text: "Switches the app between its modes. Field collection opens the installable, offline-first observation collector; it can work without a map or network connection." },
  // Tools menu
  { path: "Tools → Map assistant", keywords: "assistant chat ai", text: "Opens this assistant." },
  { path: "Tools → Legend · Measurement · Elevation profile · Compass", keywords: "legend measure distance area elevation profile compass gallery widget", text: "Map tools; availability depends on the map engine." },
  // Panels
  { path: "Side panel → Places", keywords: "search address place find geocode go to coordinates", text: "Search for an address, place or longitude, latitude. On MapLibre, press Enter to search." },
  { path: "Side panel → Intelligence (Map Insight)", keywords: "click identify feature info popup insight attributes", text: "Click the map to see the features there and the address. The selected feature is highlighted, as set in Map → Layout & display…." },
  { path: "Side panel → Layers", keywords: "layers style symbology filter opacity table remove order", text: "Each layer's menu changes its style, filter and opacity, opens its attribute table, or removes it." },
]);

const words = (text) => String(text || "").toLowerCase().split(/[^a-z0-9#]+/).filter((word) => word.length > 2);

/** The guide entries that best match a question, best first. */
export function searchGuide(query, { limit = 4 } = {}) {
  const wanted = words(query);
  return APP_GUIDE.map((entry) => {
    const text = words(`${entry.path} ${entry.keywords} ${entry.text}`);
    return { entry, score: wanted.filter((word) => text.some((candidate) => candidate.startsWith(word) || word.startsWith(candidate))).length };
  }).filter(({ score }) => score > 0).sort((a, b) => b.score - a.score).slice(0, limit).map(({ entry }) => ({ where: entry.path, what: entry.text }));
}

/** One line per menu, for the assistant's instructions. */
export function guideOutline() {
  const menus = new Map();
  for (const { path } of APP_GUIDE) {
    const [menu, items] = path.split(" → ");
    menus.set(menu, [...(menus.get(menu) || []), items]);
  }
  return [...menus].map(([menu, items]) => `- ${menu}: ${items.join("; ")}`);
}

/** A display setting checked against DISPLAY_SETTINGS: { key, value } or an Error with a hint. */
export function validateDisplaySetting(setting, value) {
  const definition = DISPLAY_SETTINGS[setting];
  if (!definition) return Object.assign(new Error(`Unknown setting "${setting}".`), { hint: `Use one of: ${Object.keys(DISPLAY_SETTINGS).join(", ")}.` });
  if (setting === "highlightColor") {
    return /^#[0-9a-f]{6}$/i.test(String(value)) ? { key: setting, value: String(value).toLowerCase() } : Object.assign(new Error("The colour must be #rrggbb."), { hint: "Such as #00b8d9." });
  }
  const coerced = typeof definition.values[0] === "boolean" && typeof value === "string" ? value === "true" : value;
  return definition.values.includes(coerced) ? { key: setting, value: coerced } : Object.assign(new Error(`"${value}" is not a value of ${setting}.`), { hint: `Use one of: ${definition.values.join(", ")}.` });
}
