// The canonical agent recipes as data: /api/agent-recipes/*.json and the
// /agent-recipes/ pages are generated from this file (scripts/site-outputs.mjs).
// Recipes point at existing interfaces only. An example's status records what
// was actually observed when its link was opened; a URL alone is "prepared".
import { readableLink } from "./agent-docs.mjs";
import { FIRE_ACRES, FIRE_SOURCE, FIRE_YEAR } from "./fire-refinement.mjs";
import { createEmbeddedTourUrl } from "../js/tour-share.js";
import { createFieldTaskUrl } from "../js/field-task-share.js";
import { BASEMAP_IDS } from "../js/basemap-catalog.js";

const SITE = "https://gismap.online";
export const AGENT_RECIPE_SCHEMA = `${SITE}/schemas/agent-recipe-v1.schema.json`;
export const RESULT_STATUSES = Object.freeze(["prepared", "validated", "loaded", "rendered", "verified", "partial", "failed"]);
const CHECKED_ON = "2026-10-21";
const CHECKED_VERSION = "0.53.0";
const MAP_SCHEMA = `${SITE}/schemas/map-v1.schema.json`;
const MLB = "https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/Major_League_Baseball_Stadiums/FeatureServer/0";

export const GRAPE_URL = "https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/USDA_Census_of_Agriculture_2022_Grape_Production/FeatureServer/0";
export const GRAPE_WHERE = "STATE_ABBR = 'CA' AND GRAPES_ACRES_BEAR_NON_BEAR_TOT > 1000";
const GRAPE_LAYER = { url: GRAPE_URL, type: "feature", title: "California grape acreage (USDA 2022)", where: GRAPE_WHERE };
const CA_CAMERA = { center: [-120.2, 37.4], zoom: 5.4 };

export const GRAPE_MAP = Object.freeze({
  version: 1, title: "California grape production, counties over 1,000 acres", basemap: "gray-vector", camera: CA_CAMERA, legend: true,
  layers: [{ ...GRAPE_LAYER, opacity: 0.85, renderer: { type: "choropleth", field: "GRAPES_ACRES_BEAR_NON_BEAR_TOT", classes: 5, method: "quantile", ramp: "purples" } }],
});

const PURPLES = ["#dadaeb", "#bcbddc", "#9e9ac8", "#6a51a3", "#4a1486"];
const GRAPE_BREAKS = [[1000, 5000], [5000, 15000], [15000, 40000], [40000, 80000], [80000, 170000]];
export const GRAPE_3D = Object.freeze({
  version: 1, title: "California grape acreage in 3D (acres × 0.01 m)", basemap: "gray-3d", camera: { center: [-120.1, 36.3], zoom: 7.2, tilt: 60, heading: 20 }, legend: true,
  layers: [{ ...GRAPE_LAYER, opacity: 0.9, renderer: { type: "arcgis", json: {
    type: "classBreaks", field: "GRAPES_ACRES_BEAR_NON_BEAR_TOT",
    classBreakInfos: GRAPE_BREAKS.map(([minValue, maxValue], index) => ({ minValue, maxValue, label: `${minValue.toLocaleString("en-US")}–${maxValue.toLocaleString("en-US")} acres`, symbol: { type: "PolygonSymbol3D", symbolLayers: [{ type: "Extrude", material: { color: PURPLES[index] } }] } })),
    visualVariables: [{ type: "sizeInfo", valueExpression: '$feature["GRAPES_ACRES_BEAR_NON_BEAR_TOT"] * 0.01' }],
  } } }],
});

/** A briefing written by hand inside a map link, as a chatbot without code would. */
export const GRAPE_BRIEFING = Object.freeze({
  ...GRAPE_MAP, title: "California grape counties", camera: undefined,
  briefing: { layerId: GRAPE_URL, selection: { useAll: true }, slides: [
    { template: "title", title: "California grape country", subtitle: "USDA Census of Agriculture 2022" },
    { template: "key-numbers", title: "At a glance", blocks: [{ type: "stat", stat: "count", label: "Counties over 1,000 acres" }, { type: "stat", stat: "sum", field: "GRAPES_ACRES_BEAR_NON_BEAR_TOT", label: "Grape acres" }] },
    { template: "feature", title: "Fresno County", featureId: "212", fit: "feature", blocks: [{ type: "facts", fields: ["NAME", "GRAPES_ACRES_BEAR_NON_BEAR_TOT"] }, { type: "text", markdown: "The largest grape acreage in the state: 160,324 acres." }] },
    { template: "feature", title: "Napa County", featureId: "230", fit: "feature", blocks: [{ type: "facts", fields: ["NAME", "GRAPES_ACRES_BEAR_NON_BEAR_TOT"] }, { type: "text", markdown: "57,780 acres, mostly wine grapes." }] },
  ] },
});

export const AUTZEN_LAS = "https://raw.githubusercontent.com/PDAL/PDAL/master/test/data/las/autzen_trim.las";
export const LIDAR_MAP = Object.freeze({ version: 1, title: "Autzen Stadium LiDAR", basemap: "gray-vector", legend: true, layers: [{ url: AUTZEN_LAS, type: "pointcloud", title: "Autzen Stadium LiDAR (PDAL sample)", scene3d: { colorBy: "rgb", pointSize: 2 } }] });
export const LIDAR_GROUND = Object.freeze({ version: 1, title: "Autzen ground surface", basemap: "gray-vector", legend: true, layers: [{ url: AUTZEN_LAS, type: "pointcloud", title: "Ground returns (class 2)", scene3d: { classes: [2], colorBy: "elevation", pointSize: 3, animate: { type: "reveal", durationMs: 6000, loop: true } } }] });

export const COLLEGES_URL = "https://services2.arcgis.com/FiaPA4ga0iQKduv3/arcgis/rest/services/Colleges_and_Universities_View/FeatureServer/0";
export const HALLOWEEN_COLLEGES = Object.freeze({
  version: 1, title: "California four-year colleges, Halloween edition", basemap: "skin", skin: "velvet-orbit", camera: CA_CAMERA, legend: true,
  layers: [{ url: COLLEGES_URL, type: "feature", title: "Four-year colleges and universities", where: "STABBR = 'CA' AND ICLEVEL = 1",
    renderer: { type: "categories", field: "CONTROL", colors: { 1: "#ffb000", 2: "#ff7518", 3: "#7cfc00" } } }],
});

const SF_STOPS = [
  ["Golden Gate Bridge", "1937 suspension bridge across the Golden Gate strait", 37.80745, -122.47596, 14.8, 60, 340],
  ["Palace of Fine Arts", "Built for the 1915 Panama-Pacific Exposition", 37.80292, -122.4484, 17, 55, 30],
  ["Coit Tower", "Art Deco tower on Telegraph Hill, opened 1933", 37.80238, -122.40583, 17, 55, 200],
  ["Ferry Building", "1898 terminal and marketplace on the Embarcadero", 37.79555, -122.39347, 17, 55, 300],
  ["Bay Bridge", "San Francisco–Oakland Bay Bridge, opened 1936", 37.81995, -122.34462, 14.4, 55, 240],
];
export const SF_TOUR = Object.freeze({
  title: "San Francisco landmarks", skin: "clean-light", playbackMode: "manual",
  chapters: SF_STOPS.map(([title, body, lat, lon, zoom, tilt, heading], index) => ({ id: `sf-${index + 1}`, title, body, basemapId: "usgs-imagery", lingerSeconds: 6, transitionMode: "smooth", viewState: { center: [lon, lat], zoom, tilt, heading } })),
});

export const PARK_TASK = Object.freeze({
  id: "dolores-park-inspection",
  title: "Mission Dolores Park inspection",
  location: "Mission Dolores Park, San Francisco",
  latitude: 37.75972, longitude: -122.42713,
  notes: "Check in on arrival. Note where each problem is in the report and add photos there. Report anything unsafe to park staff right away.",
  steps: ["Inspect playground structures", "Photograph damaged equipment", "Check drinking fountains", "Inspect pedestrian paths", "Document litter and maintenance needs"].map((text) => ({ text, done: false })),
});

const PHILLY_PAGE = `${SITE}/examples/ai/philadelphia-police-divisions/`;
const SOURCES = {
  grape: { label: "USDA Census of Agriculture 2022 grape production (Esri)", url: GRAPE_URL },
  fires: { label: "California historic fire perimeters (CAL FIRE)", url: FIRE_SOURCE },
  colleges: { label: "Colleges and Universities (HIFLD / IPEDS)", url: COLLEGES_URL },
  mlb: { label: "Major League Baseball Stadiums", url: MLB },
  osm: { label: "OpenStreetMap Nominatim (place coordinates)", url: "https://nominatim.openstreetmap.org/" },
  autzen: { label: "PDAL sample LiDAR: Autzen Stadium, Eugene, Oregon (LAS 1.2, RGB)", url: AUTZEN_LAS },
};

const common = {
  discover: { stage: "discover", action: "Read llms.txt, this recipe and api/capabilities.json; note the engine and execution environment you actually have.", interfaces: ["declarative-url"], references: [`${SITE}/llms.txt`, `${SITE}/api/capabilities.json`, `${SITE}/api/manifest.json`] },
  inspectSource: { stage: "inspect", action: "Read the source metadata: geometry type, field names and types, spatial reference, extent, sentinels and query support. Query real values before filtering; never invent fields.", interfaces: ["declarative-url", "standalone-js", "in-browser-api"], references: ["<layer URL>?f=pjson", "sources.inspect", "sources.detectSentinels", "layers.metadata"] },
};

/** The links each example opens, computed with the same encoders the app uses. */
export function agentRecipeLinks({ phillyLink, ballparksLink, openingDayLink }) {
  const basemaps = new Set(BASEMAP_IDS);
  return {
    grape: readableLink(GRAPE_MAP),
    grape3d: readableLink(GRAPE_3D),
    fireYear: readableLink(FIRE_YEAR),
    fireAcres: readableLink(FIRE_ACRES),
    halloween: readableLink(HALLOWEEN_COLLEGES),
    sfTour: createEmbeddedTourUrl({ baseUrl: `${SITE}/`, presentation: SF_TOUR, allowedBasemaps: basemaps, tourOnly: true }),
    sfTourReadable: createEmbeddedTourUrl({ baseUrl: `${SITE}/`, presentation: SF_TOUR, allowedBasemaps: basemaps, tourOnly: true, readable: true }),
    parkTask: createFieldTaskUrl({ baseUrl: `${SITE}/`, task: PARK_TASK }),
    parkTaskReadable: createFieldTaskUrl({ baseUrl: `${SITE}/`, task: PARK_TASK, readable: true }),
    lidar: readableLink(LIDAR_MAP),
    lidarGround: readableLink(LIDAR_GROUND),
    grapeBriefing: readableLink(Object.fromEntries(Object.entries(GRAPE_BRIEFING).filter(([, value]) => value !== undefined))),
    philly: phillyLink, ballparks: ballparksLink, openingDay: openingDayLink,
  };
}

export function agentRecipes(links) {
  const example = (fields) => ({ checkedOn: CHECKED_ON, checkedVersion: CHECKED_VERSION, ...fields });
  return [
    {
      id: "interactive-map", title: "Interactive map with filtering, symbology and sharing", status: "available",
      question: "Can an AI agent turn a public dataset into a filtered, styled map I can share?",
      answer: "Yes. The agent inspects the source, writes one map-v1 JSON object with the filter, renderer, basemap and camera, validates it, and returns a #map=json: link that opens the finished map. No account or server call is needed.",
      triggers: ["Map this data and color it by population", "Filter these counties and make a choropleth I can share", "Make one map colored by year and another by acreage, and give me two links"],
      inputTypes: ["ArcGIS FeatureServer/MapServer layer", "GeoJSON", "WMS", "WFS", "KML"],
      inputs: {
        required: [{ name: "source", description: "HTTPS URL of a public layer (or a sublayer index)." }],
        optional: [{ name: "where", description: "Read-only SQL attribute filter on real field names." }, { name: "renderer", description: "RendererSpec: simple, categories, choropleth, graduated-symbols, heatmap, or auto." }, { name: "basemap", description: "One of the map-v1 basemap ids." }, { name: "camera", description: "Center, zoom, tilt, heading, or fit to layers." }, { name: "outputs", description: "Link, QR card, Smart Map PNG, PDF." }],
      },
      capabilities: ["layers-arcgis", "query", "renderer-spec", "legend", "mapSpec", "smartImages"],
      engines: ["maplibre", "arcgis"],
      steps: [
        common.discover, common.inspectSource,
        { stage: "plan", action: "Choose the simplest level that can express the request: a ?layer= URL for one layer with a basic style; a map-v1 spec for categories, class breaks, colors, camera or several layers; the in-page API only to change a map already open. Keep attribute filters (where) separate from spatial ones.", interfaces: ["declarative-url", "standalone-js", "in-browser-api"], references: [MAP_SCHEMA, `${SITE}/api/url-parameters.json`, "renderers.suggest", "layers.suggestStyles"] },
        { stage: "validate", action: "Validate the spec and renderer against the real fields. Treat warnings as unfinished work.", interfaces: ["standalone-js", "in-browser-api"], references: ["mapSpec.validate", "renderers.validate", "mapSpec.prepareVerification"] },
        { stage: "execute", action: "Write the link: https://gismap.online/#map=json:<URI-encoded map-v1>. For follow-ups, decode the existing link (mapSpec.decode or mapSpec.fromShareParameters), clone it, change only what was asked, and write a new link per variant.", interfaces: ["declarative-url", "standalone-js", "in-browser-api"], references: ["mapSpec.createLink", "mapSpec.decode", "mapSpec.fromShareParameters", "mapSpec.load"] },
        { stage: "verify", action: "Open the link, wait for gisMapOnline.ready and the layers, then check describe().state.issues, layers.list() (loaded, feature count, renderer, where) and mapSpec.fromCurrent().", interfaces: ["in-browser-api"], references: ["ready", "describe", "layers.list", "mapSpec.fromCurrent", "mapSpec.issues"] },
        { stage: "share", action: "Return the actual link. Optional: a Smart Map PNG (smartImages.downloadCurrent) or the app's Map PDF and QR card (Share & export, in the UI).", interfaces: ["declarative-url", "in-browser-api"], references: ["mapSpec.createLink", "smartImages.createShareLink", "smartImages.downloadCurrent"] },
      ],
      artifact: { type: "map", schema: MAP_SCHEMA, structure: "One map-v1 object: layers (url, where, renderer, opacity), basemap, skin, camera, legend." },
      outputs: [
        { format: "Interactive map link (#map=json: or compressed #map=)", interface: "declarative-url", interactive: true, reference: "mapSpec.createLink" },
        { format: "Smart Map PNG (image with the project embedded)", interface: "in-browser-api", interactive: false, reference: "smartImages.downloadCurrent", notes: "Keep the original file: image services and messengers can strip the embedded data. Remote layers are referenced, not embedded." },
        { format: "Map PDF and QR card", interface: "external-adapter", interactive: false, notes: "Made in the app with Share & export (no in-page method yet). A PDF is a static picture of the map." },
      ],
      verification: ["Source loaded with a nonzero feature count", "Filter applied (layer where matches)", "Renderer type and field applied; legend shown", "Camera and basemap as requested", "Share link reopens to the same spec (mapSpec.fromCurrent)", "Each requested export exists"],
      limitations: ["Readable #map=json: links are limited to 8,192 characters; use mapSpec.createLink for compressed links.", "A year slider is not part of map-v1; use a timeline briefing for year-by-year playback.", "Map PDF and map QR card have no in-page API; briefing.exportPdf and briefing.exportQrCard cover briefings."],
      recovery: ["If a field is missing, re-read ?f=pjson and use the exact name and case.", "If validation warns about a renderer, the service style is used; fix the renderer rather than shipping the warning.", "If a compressed link cannot be decoded in your environment, ask for the original JSON or a #map=json: link."],
      examples: [
        example({ title: "California grape production (purple choropleth)", prompt: "Create a California grape production map, counties over 1,000 acres, with a purple choropleth, and give me a link.", dataset: [SOURCES.grape], url: links.grape, spec: GRAPE_MAP, status: "rendered", checks: ["Opened headless on the branch preview: 26 counties loaded, filter and choropleth on GRAPES_ACRES_BEAR_NON_BEAR_TOT applied, camera and basemap as specified, screenshot inspected.", "PDF, QR card and Smart Map PNG were not generated for this example."] }),
        example({ title: "Fires by year (follow-up refinement, map A)", prompt: "Make one map colored by fire year and another showing fire acreage with graduated colors. Keep the 2000–2010 filter and give me two links.", dataset: [SOURCES.fires], url: links.fireYear, spec: FIRE_YEAR, page: `${SITE}/examples/ai/california-fire-refinement/`, status: "loaded", checks: ["Opened headless: 3,112 features loaded with the 2000–2010 filter; categories on YEAR_ applied; camera and basemap preserved (read from map state, no screenshot).", "Opening the legend threw an exception on MapLibre; fixed on this branch."] }),
        example({ title: "Fires by acreage (follow-up refinement, map B)", prompt: "Same request, second link.", dataset: [SOURCES.fires], url: links.fireAcres, spec: FIRE_ACRES, page: `${SITE}/examples/ai/california-fire-refinement/`, status: "loaded", checks: ["Opened headless: 3,112 features loaded; quantile choropleth on GIS_ACRES applied; filter, camera and basemap preserved (read from map state, no screenshot)."] }),
      ],
    },
    {
      id: "interactive-briefing", title: "Interactive geographic briefing", status: "available",
      question: "Can an AI agent build a slide briefing with one map slide per area and context from another layer?",
      answer: "Yes. A chatbot can write the whole briefing into one link: a map-v1 JSON with a briefing-v1 document in its briefing property, after #map=json:. The link opens presenting, as a desktop deck or a mobile swipe feed. In an open GISMap page, agents can also build, generate and export briefings through the in-page API, including relations to a context layer.",
      triggers: ["Create slides about these districts", "Build an interactive crime briefing for Philadelphia", "Make a presentation with one slide per county"],
      inputTypes: ["ArcGIS FeatureServer polygon layer", "Supporting point or polygon layer"],
      inputs: {
        required: [{ name: "primaryLayer", description: "The layer whose features become slides." }, { name: "selection", description: "Feature IDs, a filter, or 'all', plus the slide order." }],
        optional: [{ name: "contextLayer", description: "A second layer shown and related per slide (spatialRel, distance)." }, { name: "narrative", description: "Titles and text grounded in inspected data." }, { name: "skin", description: "Presentation look." }, { name: "template", description: "filter-series, timeline, grid-atlas or spatial-3d-chart for data-driven slides." }],
      },
      capabilities: ["briefing", "layers-arcgis", "query", "highlight"],
      engines: ["maplibre", "arcgis"],
      steps: [
        common.discover, common.inspectSource,
        { stage: "plan", action: "Pick stable feature IDs and the slide order. For context layers, decide the spatial relationship; an overlay alone is not evidence that points fall inside a polygon.", interfaces: ["in-browser-api"], references: [`${SITE}/schemas/briefing-v1.schema.json`, "briefing.create", "briefing.createSlide"] },
        { stage: "validate", action: "Validate the document statically before loading it.", interfaces: ["standalone-js", "in-browser-api"], references: ["briefing.validate", "briefing.migrate"] },
        { stage: "execute", action: "Without code: put the briefing in map-v1 (\"briefing\": { layerId, selection, slides }) and write a #map=json: link; feature slides use the layer's OBJECTID as featureId. In an open page: load or generate the briefing. Slide layers with a relation query the context layer's service per slide, so counts come from the service, not from the drawing.", interfaces: ["declarative-url", "in-browser-api"], references: ["briefing.load", "briefing.generate", "briefing.generateTemplate", "briefing.addSlide", "briefing.updateSlide"] },
        { stage: "verify", action: "Step through every slide on desktop and in a narrow (mobile) viewport: selected feature, highlight, camera, context layer, narrative numbers. State whether counts are complete, filtered or sampled.", interfaces: ["in-browser-api"], references: ["briefing.get", "describe"] },
        { stage: "share", action: "Create the link, then reopen it. Optional PDF handout and QR card.", interfaces: ["in-browser-api"], references: ["briefing.createLink", "briefing.exportPdf", "briefing.exportQrCard", "briefing.exportProject"] },
      ],
      artifact: { type: "briefing", schema: `${SITE}/schemas/briefing-v1.schema.json`, structure: "A briefing-v1 document: layerId, selection, ordered slides (template, camera, blocks, layers with relations, optional dataView/timeline/spatialChart), shared with the map's layers, styles and skin." },
      outputs: [
        { format: "Interactive briefing link (#briefing=)", interface: "in-browser-api", interactive: true, reference: "briefing.createLink" },
        { format: "Desktop deck and mobile swipe feed", interface: "declarative-url", interactive: true, notes: "The same document; the layout follows the screen." },
        { format: "PDF handout", interface: "in-browser-api", interactive: false, reference: "briefing.exportPdf" },
        { format: "QR card (PNG)", interface: "in-browser-api", interactive: false, reference: "briefing.exportQrCard" },
        { format: "Project file (.gis)", interface: "in-browser-api", interactive: true, reference: "briefing.exportProject" },
      ],
      verification: ["Slide count matches the request", "Each slide frames and highlights the intended feature", "Context layer loaded and related by a real spatial query", "Narrative numbers match queried values", "Desktop and mobile navigation work", "The shared link reopens to the same slides"],
      limitations: ["Readable #map=json: links hold 8,192 characters, enough for roughly ten short slides; longer briefings need the in-page API (briefing.createLink) or a hosted ?briefing= file.", "Links hold at most 60 slides and must fit the URL budget; large documents use ?briefing=<hosted JSON>.", "Data-driven templates sample at most 500 features (generateTemplate coverage is 'unknown')."],
      recovery: ["If a relation query fails, the slide notes it; show both layers and say the analysis is incomplete.", "If the link is too long, host the JSON and use ?briefing=<URL>, or export a .gis project."],
      examples: [
        example({ title: "California grape counties, written by a chatbot", prompt: "Make a four-slide briefing about California grape counties: a title, the totals, then Fresno and Napa.", dataset: [SOURCES.grape], url: links.grapeBriefing, spec: Object.fromEntries(Object.entries(GRAPE_BRIEFING).filter(([, value]) => value !== undefined)), status: "rendered", checks: ["Written by hand as #map=json: with an inline briefing (no code).", "Opened headless: briefing mode, four slides in order, presenting from slide 1; no issues reported."] }),
        example({ title: "Philadelphia police divisions and districts", prompt: "Build a briefing with one slide per Philadelphia police division showing the districts inside it.", dataset: [{ label: "Philadelphia Police Divisions and Districts (City of Philadelphia)", url: PHILLY_PAGE }], url: links.philly, page: PHILLY_PAGE, status: "loaded", checks: ["Opened headless: both layers loaded and the deck started at slide 1 of 9.", "Per-slide highlight, mobile swipe and PDF were not rechecked in this pass.", "The spec's crime-incident example (crime points per district) is not yet published."] }),
      ],
    },
    {
      id: "geographic-tour", title: "Guided geographic tour", status: "available",
      question: "Can an AI agent create a guided map tour of places in a set order?",
      answer: "Yes, without code. The tour is one link: a chatbot writes https://gismap.online/?tourOnly=1#tour=json:<URI-encoded JSON> with an ordered list of stops (name, caption, lat, lon, zoom, tilt, heading, basemap, seconds). Code-running agents can use the standalone tour-share module for a shorter, QR-safe link.",
      triggers: ["Create a tour of San Francisco landmarks", "Show me these locations in sequence", "Fly between these places with a caption at each"],
      inputTypes: ["Place names or addresses", "Coordinates", "Features of a public layer"],
      inputs: {
        required: [{ name: "title", description: "Tour title (up to 120 characters)." }, { name: "stops", description: "Ordered places with verified coordinates." }],
        optional: [{ name: "captions", description: "Up to 80 characters per stop." }, { name: "camera", description: "Zoom, tilt and heading per stop." }, { name: "basemap", description: "A basemap id: usgs-imagery for aerial imagery on MapLibre (United States), satellite on ArcGIS." }, { name: "linger", description: "Seconds per stop (1–120)." }, { name: "autoplay", description: "Start playing on open." }],
      },
      capabilities: ["view-3d", "basemaps"],
      engines: ["maplibre", "arcgis"],
      steps: [
        common.discover,
        { stage: "inspect", action: "Resolve every place to coordinates with a real geocoder or layer; ask when a name is ambiguous. Keep the user's order unless asked to reorder.", interfaces: ["external-adapter", "in-browser-api"], references: ["https://nominatim.openstreetmap.org/", "layers.list"] },
        { stage: "plan", action: "Write the chapters: title, caption, viewState {center:[lon,lat], zoom, tilt, heading}, basemapId, lingerSeconds, transitionMode.", interfaces: ["standalone-js"], references: ["tour-share.js#serializeEmbeddedTour"] },
        { stage: "execute", action: "Without code: write https://gismap.online/?tourOnly=1#tour=json:<encodeURIComponent(JSON)> with { title, autoplay, stops: [{ name, caption, lat, lon, zoom, tilt, heading, basemap, seconds }] }. With code (browser or Deno): import { createEmbeddedTourUrl } from \"https://gismap.online/js/tour-share.js\" for a compact, QR-safe link.", interfaces: ["declarative-url", "standalone-js"], references: ["#tour=json:<payload>", "tour-share.js#createEmbeddedTourUrl", "tour-share.js#readableTourPayload", "tour-share.js#decodeEmbeddedTour"] },
        { stage: "verify", action: "Decode the link (decodeEmbeddedTour) and compare every stop; with a browser, open it and step through each chapter's camera and basemap.", interfaces: ["standalone-js", "in-browser-api"], references: ["tour-share.js#decodeEmbeddedTour", "describe"] },
        { stage: "share", action: "Return the link; add &autoplay=1 to start playing. Longer tours export as .gisatlas from the app.", interfaces: ["declarative-url"], references: ["#tour=<payload>", "?tourOnly=1", "&autoplay=1"] },
      ],
      artifact: { type: "tour", structure: "A camera-only tour: { title, skin, playbackMode, chapters[{ title, body, viewState, basemapId, lingerSeconds, transitionMode }] } carried in #tour=." },
      outputs: [
        { format: "Tour link (#tour=, optionally tour-only)", interface: "standalone-js", interactive: true, reference: "tour-share.js#createEmbeddedTourUrl" },
        { format: "QR code", interface: "external-adapter", interactive: false, notes: "Links are kept under 2,800 characters so any QR encoder can carry them; the app's Share tour dialog also draws one." },
        { format: ".gisatlas file", interface: "external-adapter", interactive: true, notes: "Exported in the app (Export guided tour) when a tour is too long for a link." },
      ],
      verification: ["Every stop present in the requested order", "Coordinates match the geocoded places", "Camera (zoom, tilt, heading) and basemap per stop", "Back/Next and Play work", "Decoded link equals the authored tour"],
      limitations: ["A tour moves the camera only; it carries no data layers (use a briefing for data).", "A flyover is not road routing and gives no travel times.", "Captions are cut to 80 characters and links to 2,800 characters.", "On the MapLibre engine (the default), satellite and hybrid are drawn as an OpenFreeMap street map; usgs-imagery is real aerial imagery for the United States."],
      recovery: ["If the link exceeds 2,800 characters, shorten captions or split the tour, or export .gisatlas.", "An unknown basemap id is dropped and the stop falls back to the current basemap; use ids from map-v1."],
      examples: [
        example({ title: "San Francisco landmarks", prompt: "Create a guided tour of Golden Gate Bridge, Palace of Fine Arts, Coit Tower, Ferry Building and Bay Bridge, on satellite imagery.", dataset: [SOURCES.osm, { label: "USGS The National Map orthoimagery", url: "https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer" }], url: links.sfTour, status: "rendered", checks: ["Coordinates from OpenStreetMap Nominatim on 2026-10-21.", "Opened headless on MapLibre: chapter 1 of 5 with its caption, camera and USGS aerial imagery; screenshot inspected. Stops 2–5 were checked by decoding the link, not by stepping through them."] }),
        example({ title: "San Francisco landmarks, readable link", prompt: "Same tour, as a link a chatbot can write without code.", dataset: [SOURCES.osm], url: links.sfTourReadable, status: "rendered", checks: ["#tour=json: form; opened headless from this branch (local server): chapter 1 of 5 over USGS imagery (screenshot inspected).", "Longer than the compact link and not QR-safe."] }),
        example({ title: "Eight classic ballparks", prompt: "Make a 3D tour of the oldest major-league ballparks.", dataset: [SOURCES.mlb], url: links.ballparks, page: `${SITE}/examples/tours/classic-ballparks/`, status: "partial", checks: ["Opened headless: tour mode at Fenway Park (tilt 55, heading 40).", "Its stops ask for satellite, which the default MapLibre engine draws as a street map; open with ?engine=arcgis for imagery."] }),
      ],
    },
    {
      id: "field-tasks", title: "Location-based field tasks", status: "available",
      question: "Can an AI agent create a field inspection checklist for a place that someone can open on their phone?",
      answer: "Yes, without code. A chatbot writes https://gismap.online/?workflow=tasks#fieldTask=json:<URI-encoded JSON> with the title, location, coordinates, notes and up to ten steps. The person in the field checks in, ticks off steps and sends back a report link. No account or server is involved.",
      triggers: ["Make a field inspection checklist for this park", "Create five tasks to do on site at this address", "Send someone to check these locations"],
      inputTypes: ["Address or coordinates", "Features of a public layer (by object ID)"],
      inputs: {
        required: [{ name: "location", description: "Verified coordinates or an address." }, { name: "title", description: "Task package title." }, { name: "tasks", description: "The things to do; five per package by default." }],
        optional: [{ name: "instructions", description: "Notes for the person (up to 500 characters)." }, { name: "features", description: "Up to five features to visit, by layer URL and object ID." }],
      },
      capabilities: ["view-2d", "query"],
      engines: ["maplibre", "arcgis"],
      steps: [
        common.discover,
        { stage: "inspect", action: "Resolve the location to coordinates (or pick features by object ID from a real layer).", interfaces: ["external-adapter", "standalone-js"], references: ["https://nominatim.openstreetmap.org/", "<layer URL>/query"] },
        { stage: "plan", action: "Write the task: id, title, location, latitude, longitude, notes, steps [{ text }], optional features [{ layerUrl, objectId, latitude, longitude, label }]. Requests for more than five tasks become several packages ('… 1 of 2') with the same id prefix; never drop one.", interfaces: ["standalone-js"], references: ["field-task-share.js#serializeFieldTask", "field-task-share.js#FIELD_TASK_LIMITS"] },
        { stage: "execute", action: "Without code: write https://gismap.online/?workflow=tasks#fieldTask=json:<encodeURIComponent(JSON)> with { title, location, lat, lon, notes, steps: [\"…\"], features: [{ layerUrl, objectId, lat, lon, label }] }. With code: createFieldTaskUrl from \"https://gismap.online/js/field-task-share.js\" for a compact, QR-safe link.", interfaces: ["declarative-url", "standalone-js"], references: ["#fieldTask=json:<payload>", "field-task-share.js#createFieldTaskUrl", "field-task-share.js#readableFieldTaskPayload"] },
        { stage: "verify", action: "Decode the link (decodeFieldTask) and compare title, location and every step; with a browser, open it and confirm the task panel, map location and check-in button.", interfaces: ["standalone-js", "in-browser-api"], references: ["field-task-share.js#decodeFieldTask", "describe"] },
        { stage: "share", action: "Return the assignment link (QR-safe). The completed report comes back as a separate link made by the person in the field.", interfaces: ["declarative-url"], references: ["?workflow=tasks#fieldTask=<payload>"] },
      ],
      artifact: { type: "field-task", structure: "One task package: title, location, coordinates, notes, steps (checklist), features to visit; returned reports add check-in, steps done, notes, who and when." },
      outputs: [
        { format: "Assignment link (#fieldTask=)", interface: "standalone-js", interactive: true, reference: "field-task-share.js#createFieldTaskUrl" },
        { format: "QR code", interface: "external-adapter", interactive: false, notes: "Links are kept under 2,800 characters; the app's Share dialog draws one." },
        { format: "Completion report link", interface: "declarative-url", interactive: true, notes: "Created by the field worker in the app, never by the agent." },
      ],
      verification: ["Correct location on the map", "All requested tasks present, five per package", "Steps, title and notes decode unchanged", "Mobile task panel opens with check-in and steps"],
      limitations: ["Each task is a checklist step: steps have text only, not separate IDs, evidence types or completion rules.", "Photos stay on the field device and go into the PDF report; links never carry them. A check-in records place and time, not proof that the work was done.", "Up to 10 steps, 5 features and 500 characters of notes per package; progress persists only in the report link the worker sends back."],
      recovery: ["If the link is too long, shorten notes and step text or split the package.", "Never fabricate a check-in, photo or completed report."],
      examples: [
        example({ title: "Mission Dolores Park inspection", prompt: "Create five inspection tasks for a city park: playground structures, damaged equipment photos, drinking fountains, pedestrian paths, litter and maintenance.", dataset: [SOURCES.osm], url: links.parkTask, status: "rendered", checks: ["Coordinates from OpenStreetMap Nominatim on 2026-10-21.", "Opened headless: the task panel showed the title, location, five steps and check-in; screenshot inspected.", "No check-in or report was made: those belong to a real field visit."] }),
        example({ title: "Mission Dolores Park inspection, readable link", prompt: "Same task, as a link a chatbot can write without code.", dataset: [SOURCES.osm], url: links.parkTaskReadable, status: "rendered", checks: ["#fieldTask=json: form; opened headless from this branch (local server): task panel with five steps and check-in (screenshot inspected)."] }),
        example({ title: "Opening-day wayfinding check (with report)", prompt: "Send someone to check accessible entrances at the Philadelphia and Pittsburgh ballparks.", dataset: [SOURCES.mlb], url: links.openingDay, page: `${SITE}/examples/field-tasks/opening-day-wayfinding/`, status: "loaded", checks: ["Opened headless: task panel with both ballparks, steps and check-in."] }),
      ],
    },
    {
      id: "3d-extrusion", title: "Numeric or fixed-height 3D extrusion", status: "available",
      question: "Can an AI agent make a 3D map where each area's height shows a number?",
      answer: "Yes. The agent checks that the layer has polygons and a numeric field, then writes a map-v1 spec whose ArcGIS renderer extrudes each polygon by $feature[\"FIELD\"] × a multiplier (or a fixed height), with a tilted camera. The link reopens the same 3D view.",
      triggers: ["Make a 3D map of grape production in California", "Make the county heights represent acreage", "Extrude these buildings by height"],
      inputTypes: ["Polygon FeatureServer layer", "Polygon GeoJSON"],
      inputs: {
        required: [{ name: "source", description: "A polygon layer." }, { name: "height", description: "A numeric field with a multiplier, or a fixed height in meters." }],
        optional: [{ name: "where", description: "Filter." }, { name: "color", description: "Uniform, categories or class breaks." }, { name: "camera", description: "Tilt 45–65° and a heading." }, { name: "basemap", description: "A *-3d basemap." }],
      },
      capabilities: ["view-3d", "renderer-native"],
      engines: ["maplibre", "arcgis"],
      steps: [
        common.discover, common.inspectSource,
        { stage: "plan", action: "Confirm polygon geometry and a numeric field; check nulls, negatives, sentinels and outliers. Source units are not meters: pick a multiplier so the tallest feature is readable, and say so.", interfaces: ["standalone-js"], references: ["sources.inspect", "renderers.describeValues"] },
        { stage: "validate", action: "Validate the spec; an unsupported extrusion expression is reported, not ignored.", interfaces: ["standalone-js", "in-browser-api"], references: ["mapSpec.validate"] },
        { stage: "execute", action: "Use renderer { type: \"arcgis\", json } with PolygonSymbol3D Extrude symbols and visualVariables [{ type: \"sizeInfo\", valueExpression: '$feature[\"FIELD\"] * k' }] (or a fixed Extrude size), plus a camera with tilt.", interfaces: ["declarative-url", "standalone-js"], references: [MAP_SCHEMA, "mapSpec.createLink"] },
        { stage: "verify", action: "Open the link and confirm the extrusion is drawn (MapLibre fill-extrusion or ArcGIS SceneView), the colors and the tilted camera.", interfaces: ["in-browser-api"], references: ["layers.list", "mapSpec.fromCurrent"] },
        { stage: "share", action: "Return the link; a Smart Map PNG keeps a picture with the project.", interfaces: ["declarative-url", "in-browser-api"], references: ["mapSpec.createLink", "smartImages.downloadCurrent"] },
      ],
      artifact: { type: "map", schema: MAP_SCHEMA, structure: "map-v1 with an ArcGIS renderer using Extrude symbol layers and a sizeInfo expression, and a tilted camera." },
      outputs: [
        { format: "Interactive 3D map link", interface: "declarative-url", interactive: true, reference: "mapSpec.createLink" },
        { format: "Smart Map PNG", interface: "in-browser-api", interactive: false, reference: "smartImages.downloadCurrent" },
      ],
      verification: ["Polygon geometry confirmed", "Height = field × multiplier (or fixed) on the drawn features", "Colors match the legend", "Camera tilted", "Settings survive the share link"],
      limitations: ["MapLibre supports only $feature[\"FIELD\"] * number expressions; other Arcade is refused with an error.", "Heights are display meters, not the data's units; label the multiplier.", "Points become columns only in some engines; polygon extrusion is the portable case."],
      recovery: ["If the extrusion is refused, simplify the expression to field × number.", "If tall outliers hide the rest, lower the multiplier or filter outliers and say so."],
      examples: [
        example({ title: "California grape acreage in 3D", prompt: "Use county grape production, filter to California counties over 1,000 acres, extrude by acres × 0.01 with a purple ramp, tilt the camera, and give me a link.", dataset: [SOURCES.grape], url: links.grape3d, spec: GRAPE_3D, status: "rendered", checks: ["Opened headless on MapLibre: 26 counties loaded with purple class breaks; at the tilted camera the extrusion walls are visible on the tallest counties (screenshot inspected). At acres × 0.01 the tallest is about 1.6 km, so zoom in to see the relief.", "ArcGIS SceneView was not checked in this pass."] }),
      ],
    },
    {
      id: "spatial-3d-chart", title: "3D spatial chart (strata, footprint stacks)", status: "experimental",
      question: "Can an AI agent separate overlapping events by year in 3D?",
      answer: "On the MapLibre engine, yes: a spatialChart lifts each group (such as a year) into its own virtual-Z slot, or extrudes by a measure, without changing the source polygons. It is a display technique, not overlay analysis.",
      triggers: ["Separate overlapping fire perimeters by year", "Stack these events in 3D by year", "Make a five-part 3D brief of fire history"],
      inputTypes: ["Polygon layer with a group (year) field"],
      inputs: {
        required: [{ name: "source", description: "Polygon layer." }, { name: "groupBy", description: "Field with at most 40 distinct values." }],
        optional: [{ name: "heightField", description: "Nonnegative numeric field." }, { name: "slotMeters", description: "Slot height." }, { name: "gapMeters", description: "Gap between slots." }],
      },
      capabilities: ["spatial-chart-3d"],
      engines: ["maplibre", "arcgis"],
      steps: [
        common.discover, common.inspectSource,
        { stage: "execute", action: "Add spatialChart to the map-v1 layer, or call briefing.generateTemplate({ template: \"spatial-3d-chart\" }) in the page.", interfaces: ["declarative-url", "in-browser-api"], references: [MAP_SCHEMA, "briefing.generateTemplate"] },
        { stage: "verify", action: "Check the Z legend, the strata order and source-event identify.", interfaces: ["in-browser-api"], references: ["layers.list"] },
      ],
      artifact: { type: "map", schema: MAP_SCHEMA, structure: "map-v1 layer.spatialChart, or briefing slides with spatialChart." },
      outputs: [{ format: "Interactive map or briefing link", interface: "declarative-url", interactive: true }],
      verification: ["Z legend states the meaning", "Groups ordered", "Restored after the briefing closes"],
      limitations: ["MapLibre and ArcGIS engines; the ArcGIS SceneView draws extrude symbols with a meters size variable and Decode() base heights.", "Fast display: no exact overlap partition or unique-area totals.", "At most 40 groups."],
      recovery: ["Filter the layer or use a coarser group field when there are more than 40 values."],
      examples: [example({ title: "See the skill reference", prompt: "Separate these overlapping fire perimeters by year.", dataset: [SOURCES.fires], page: `${SITE}/skills/gismap/references/briefs.md`, status: "prepared", checks: ["No published link yet."] })],
    },
    {
      id: "lidar-and-3d-models", title: "LiDAR point clouds and 3D models (utility and vegetation data)", status: "experimental",
      question: "Can an AI agent put a LiDAR point cloud or a CAD model on a shareable 3D map?",
      answer: "Yes, on the MapLibre engine. A pointcloud layer reads LAS or LAZ (with its CRS) or XYZ text; a model layer reads glTF/GLB, OBJ or PLY placed at an anchor or from projected coordinates. Both draw with three.js on the map and travel in a #map=json: link, colored by RGB, ASPRS class, elevation or intensity, with a class filter for wires, towers and vegetation.",
      triggers: ["Show this LiDAR LAZ file on a map", "Show only vegetation and conductor wires from this point cloud", "Place this glTF transmission tower model at these coordinates", "Put the CAD model of this substation on the map in 3D"],
      inputTypes: ["LAS 1.0–1.4 (point formats 0–10)", "LAZ (LASzip)", "XYZ / PTS text", "glTF / GLB", "OBJ", "PLY"],
      inputs: {
        required: [{ name: "source", description: "HTTPS URL of the file (the host must allow browser access, CORS), or a local file added in the app." }],
        optional: [{ name: "crs", description: "EPSG:<code>, proj4 or WKT; needed when the file carries none (XYZ, some LAS, CAD in projected coordinates)." }, { name: "classes", description: "ASPRS classes to show, such as [3, 4, 5] vegetation, [13, 14] wires, [15] towers." }, { name: "colorBy", description: "auto, rgb, classification, elevation or intensity." }, { name: "anchor", description: "Model placement [lon, lat, altitude]; heading, scale and upAxis adjust it." }, { name: "heightReference", description: "ground (default, set on the terrain) or absolute (surveyed elevations)." }, { name: "animate", description: "{ type: \"reveal\" } shows points from low to high on the shared clock." }],
      },
      capabilities: ["three-3d", "view-3d"],
      engines: ["maplibre"],
      steps: [
        common.discover,
        { stage: "inspect", action: "Check the file type, size and that its host allows browser access. For LAS/LAZ the header gives the point count and usually the CRS; ask for the CRS when it is missing rather than guessing.", interfaces: ["declarative-url", "standalone-js"], references: ["pointcloud-las.js#readLasHeader", "pointcloud-las.js#lasCrs"] },
        { stage: "plan", action: "Choose colorBy and classes for the question (vegetation encroachment: classes 3–5 with 13–14; structures: 6, 15), a point size, and for models an anchor or the CRS of their coordinates.", interfaces: ["declarative-url"], references: [MAP_SCHEMA] },
        { stage: "validate", action: "Validate the spec; bad scene3d options are reported and ignored.", interfaces: ["standalone-js", "in-browser-api"], references: ["mapSpec.validate"] },
        { stage: "execute", action: "Write #map=json: with layers [{ url, type: \"pointcloud\" | \"model\", scene3d: {...} }], or call layers.add(url, { type, scene3d }) in an open page.", interfaces: ["declarative-url", "in-browser-api"], references: ["mapSpec.createLink", "layers.add"] },
        { stage: "verify", action: "Open the link on the MapLibre engine: the legend reports points shown of total, CRS and colour mode; tilt the map to see heights.", interfaces: ["in-browser-api"], references: ["layers.list", "mapSpec.fromCurrent"] },
        { stage: "share", action: "Return the link. Local files need a project package (.gisx); links only reference public URLs.", interfaces: ["declarative-url"], references: ["mapSpec.createLink"] },
      ],
      artifact: { type: "map", schema: MAP_SCHEMA, structure: "map-v1 with pointcloud or model layers and their scene3d options." },
      outputs: [{ format: "Interactive 3D map link", interface: "declarative-url", interactive: true, reference: "mapSpec.createLink" }, { format: "Project with local LiDAR or CAD files (.gisx)", interface: "external-adapter", interactive: true, notes: "Made in the app; local files never go into links." }],
      verification: ["Points or model visible where expected on the basemap", "Legend: points shown of total, CRS, colour mode", "Class filter and colours as requested", "Heights plausible when tilted"],
      limitations: ["MapLibre engine only, flat (Mercator) map; the globe and the ArcGIS engine do not draw these layers.", "Whole files load into the browser: large clouds are thinned to maxPoints (default 1.5 million). Streaming formats (COPC, EPT, 3D Tiles) are not supported yet.", "No point picking, clearance measurement or IFC/DWG/DXF yet; convert CAD to glTF.", "LAZ decoding loads laz-perf (WebAssembly) and reprojection loads proj4; unknown EPSG codes are looked up on epsg.io."],
      recovery: ["\"does not say which coordinate system\": add scene3d.crs.", "Points in the wrong place: check the CRS and its units (US survey feet vs metres).", "Nothing visible: open with ?engine=maplibre and switch off the globe."],
      examples: [
        example({ title: "Autzen Stadium LiDAR (true colour)", prompt: "Show this LAS file on a 3D map: https://raw.githubusercontent.com/PDAL/PDAL/master/test/data/las/autzen_trim.las", dataset: [SOURCES.autzen], url: links.lidar, spec: LIDAR_MAP, status: "rendered", checks: ["Opened headless from this branch (local server): 110,000 points reprojected from the file's WKT (Oregon Lambert, international feet) to Eugene, Oregon; true-colour trees and ground visible when tilted (screenshot inspected).", "Placed on the terrain at the cloud's ground level."] }),
        example({ title: "Ground returns only, revealed by height", prompt: "Show only the ground points, coloured by elevation, and animate them.", dataset: [SOURCES.autzen], url: links.lidarGround, spec: LIDAR_GROUND, status: "loaded", checks: ["Loaded through layers.add with classes [2] and the reveal animation running on the shared clock (mid-reveal screenshot).", "This sample has only unclassified and ground classes; vegetation and wire classes need a classified utility survey."] }),
      ],
    },
    {
      id: "print-map", title: "Print-ready PDF and branded Smart Image", status: "experimental",
      question: "Can an AI agent make a branded PDF, poster or Smart Map Image?",
      answer: "Yes, from a running GISMap page. gisMapOnline.print renders the Print Editor's templates and returns the file. Exports wait for the map and fail rather than return a blank or partial page. Agents never draw their own Smart Image.",
      triggers: ["Make a printable map of this data", "Make a poster of this map", "Make a Smart Map Image"],
      inputTypes: ["A map open in GISMap", "A map-v1 link"],
      inputs: {
        required: [{ name: "map", description: "A running GISMap page with the map loaded." }],
        optional: [{ name: "template", description: "An id from print.templates()." }, { name: "title", description: "The page title; the project title by default." }, { name: "pages", description: "current-view, or bookmarks for a PDF with one page per bookmark." }],
      },
      capabilities: ["print"],
      engines: ["maplibre", "arcgis"],
      steps: [
        common.discover,
        { stage: "execute", action: "Open the map in a browser with WebGL, await gisMapOnline.ready, then call print.exportPdf or print.exportSmartImage with a template from print.templates().", interfaces: ["in-browser-api"], references: ["print.templates", "print.exportPdf", "print.exportSmartImage"] },
        { stage: "verify", action: "Open the file and check the title, legend and QR target. Pass on any warnings.", interfaces: ["in-browser-api"], references: [`${SITE}/skills/gismap/references/print.md`] },
        { stage: "share", action: "Return the file with the live share link. If export fails, report the error code and return the link alone.", interfaces: ["in-browser-api"], references: ["smartImages.createShareLink"] },
      ],
      artifact: { type: "map", schema: MAP_SCHEMA, structure: "A static page of the current map; a Smart Image also embeds the project." },
      outputs: [
        { format: "Map PDF", interface: "in-browser-api", interactive: false, reference: "print.exportPdf" },
        { format: "Smart Image (PNG)", interface: "in-browser-api", interactive: false, reference: "print.exportSmartImage", notes: "Importing the PNG restores the project." },
      ],
      verification: ["The page shows the requested map, title and legend", "The QR opens the live map", "smartImages.read restores the project and reports renderedBy: app"],
      limitations: ["Needs a browser with WebGL; there is no hosted rendering.", "Wall maps are capped at about 6000 pixels on the long side.", "Static outputs keep no live GIS interaction."],
      recovery: ["In headless Chromium without WebGL, launch with --use-gl=angle --use-angle=swiftshader.", "If a layer does not load, report it; use allowPartial only if the user agrees.", "If export fails, return the live share link and the error code."],
      examples: [
        example({ title: "California grape acreage poster", prompt: "Make a poster of California grape acreage.", dataset: [SOURCES.grape], url: links.grape, status: "prepared", checks: ["The link opens the map to print; the export itself runs in the page."] }),
      ],
    },
    {
      id: "vibe-map", title: "Vibe-matched map and presentation skin", status: "available",
      question: "Can an AI agent make a map whose look matches the subject, like a Halloween map of California colleges?",
      answer: "Yes, within the preset skins. The agent picks an interface skin, draws the basemap in the skin's colors (basemap \"skin\" on MapLibre) and colors the data with its own renderer. In an active map session it can also create an Instant Dashboard with linked chart filtering, then share a public-map embed when the map is ready.",
      triggers: ["Make the map feel like Halloween in California", "Theme this map in team colors", "Give this forest map an autumn look", "Create an instant dashboard with a skin and basemap that suit this data"],
      inputTypes: ["Any styled layer"],
      inputs: {
        required: [{ name: "source", description: "The data layer." }, { name: "theme", description: "Subject, place, season or mood." }],
        optional: [{ name: "colors", description: "Preferred colors; say whether they are official, user-provided or merely inspired." }, { name: "parts", description: "Apply skin, basemap theme and data colors together or separately." }],
      },
      capabilities: ["basemap-themes", "renderer-spec"],
      engines: ["maplibre", "arcgis"],
      steps: [
        common.discover, common.inspectSource,
        { stage: "plan", action: "Write a semantic palette (background, land, water, roads, labels, highlights, data colors, panel accent), then map it onto: a preset skin (map-v1 skin), the skin basemap, and the data renderer's colors. Check text and data contrast.", interfaces: ["declarative-url"], references: [MAP_SCHEMA, "map-v1 skin", "map-v1 basemap: skin"] },
        { stage: "validate", action: "Validate the spec; an unknown skin or basemap is reported.", interfaces: ["standalone-js", "in-browser-api"], references: ["mapSpec.validate"] },
        { stage: "execute", action: "Write the #map=json: link with skin, basemap \"skin\" and the renderer colors. In an active assistant session, use create_instant_dashboard after inspecting a loaded queryable layer when the requested outcome includes a dashboard; it creates a linked chart panel, skin and basemap.", interfaces: ["declarative-url", "standalone-js", "in-browser-api"], references: ["mapSpec.createLink", "create_instant_dashboard"] },
        { stage: "verify", action: "Open the link: skin applied to panels, basemap drawn in skin colors (MapLibre), symbols in the requested colors, labels readable. For an Instant Dashboard, activate a grouped chart mark, verify the matching map filter/selection, then clear it.", interfaces: ["in-browser-api"], references: ["describe", "mapSpec.fromCurrent", "create_instant_dashboard"] },
        { stage: "share", action: "Return the link; say which palette parts were approximated by a preset. If the user wants a web embed, use get_map_embed or createEmbedIframe only for public layers, then test the iframe in its destination page.", interfaces: ["declarative-url", "in-browser-api"], references: ["mapSpec.createLink", "get_map_embed", "embed-share.js"] },
      ],
      artifact: { type: "map", schema: MAP_SCHEMA, structure: "map-v1 with skin, basemap (often \"skin\") and renderer colors." },
      outputs: [
        { format: "Themed interactive map link", interface: "declarative-url", interactive: true, reference: "mapSpec.createLink" },
        { format: "Project file with custom colors", interface: "external-adapter", interactive: true, notes: "Custom skin and basemap palettes made in the app's skin editor are saved in projects but not in links." },
        { format: "Public map embed iframe", interface: "in-browser-api", interactive: true, reference: "get_map_embed", notes: "Preserves public map configuration; local, private and credentialed sources cannot be embedded." },
      ],
      verification: ["Skin applied", "Basemap themed where supported (MapLibre skin basemap)", "Data colors and legend match", "Labels and data readable", "Theme persists on reopening", "Instant Dashboard chart selection filters and clears matching map data when requested", "Embed tested in the destination page when requested", "Unsupported parts reported"],
      limitations: ["Links carry only the 12 preset skins; exact custom panel and basemap colors are not portable yet.", "The ArcGIS engine draws the skin basemap as light or dark gray.", "Raster basemaps (satellite, hybrid) cannot be recolored.", "Map labels are not configurable in map-v1.", "Category legends show coded values; RendererSpec categories have no labels."],
      recovery: ["If a requested color cannot be matched, choose the closest preset skin and state the difference.", "On ArcGIS, switch to MapLibre for a themed basemap or accept the gray canvas."],
      examples: [
        example({ title: "Halloween California colleges", prompt: "Create a Halloween-themed map of California colleges: midnight purple background, pumpkin orange accents, amber college symbols, green highlights, and a matching skin.", dataset: [SOURCES.colleges], url: links.halloween, spec: HALLOWEEN_COLLEGES, status: "rendered", checks: ["Opened headless on MapLibre: 288 four-year colleges loaded; Velvet Orbit skin and the midnight-purple skin basemap (applied a few seconds after load); amber, pumpkin and green symbols by CONTROL; screenshot inspected.", "The legend lists the coded values (1 Public, 2 Private not-for-profit, 3 Private for-profit) rather than their names.", "Midnight purple and pumpkin orange come from the preset skin; exact custom colors and green label highlights are not expressible in links."] }),
      ],
    },
  ].map((recipe) => ({ $schema: AGENT_RECIPE_SCHEMA, schemaVersion: 1, ...recipe, lastTestedVersion: CHECKED_VERSION, resultStatuses: [...RESULT_STATUSES] }));
}
