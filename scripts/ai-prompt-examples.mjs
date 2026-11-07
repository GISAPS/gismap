// Plain-language prompts and the links they should produce (/examples/ai/<slug>/).
// `status` is the one reached (a failing link stays prepared) by opening the link in headless Chrome with
// scripts/capture-prompt-examples.mjs, which also takes each screenshot; `checked`
// is the date of that run. Live services change, so a status is a dated observation.
import { CORN_LINK } from "./agent-docs.mjs";
import { FIRE_STRATA_LINK, FIRE_YEAR, fireLink } from "./fire-refinement.mjs";

const SITE = "https://gismap.online";
const STATES = "https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/USA_States_Generalized_Boundaries/FeatureServer/0";
const BALLPARKS = "https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/Major_League_Baseball_Stadiums/FeatureServer/0";
const PERIMETERS = "https://services9.arcgis.com/RHVPKKiFTONKtxq3/ArcGIS/rest/services/USA_Wildfires_v1/FeatureServer/1";
const QUAKES_WEEK = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.geojson";
const AUTZEN_LAS = "https://raw.githubusercontent.com/PDAL/PDAL/master/test/data/las/autzen_trim.las";
const json = (value) => encodeURIComponent(JSON.stringify(value));
const map = (spec, query = "") => `${SITE}/${query}#map=json:${json({ version: 1, ...spec })}`;
const tour = (spec) => `${SITE}/?tourOnly=1#tour=json:${json(spec)}`;
const stop = (name, caption, lat, lon) => ({ name, caption, lat, lon, zoom: 15, tilt: 45, heading: 0, basemap: "open-liberty", seconds: 6 });

export const PROMPT_EXAMPLES = Object.freeze([
  { slug: "trip-tour", title: "A trip as a guided tour", prompt: "Make me a map of our three days in Kyoto: Fushimi Inari, Kiyomizu-dera, then Kinkaku-ji.",
    link: tour({ title: "Three days in Kyoto", autoplay: true, stops: [stop("Fushimi Inari", "Day 1", 34.96714, 135.77267), stop("Kiyomizu-dera", "Day 2", 34.99485, 135.78504), stop("Kinkaku-ji", "Day 3", 35.03937, 135.72924)] }),
    reply: "Coordinates came from my own knowledge, so check each stop." },
  { slug: "coffee-crawl-tour", title: "A coffee crawl as a guided tour", prompt: "Plot a coffee crawl around Seattle's Pike Place and Capitol Hill.",
    link: tour({ title: "Seattle coffee crawl", autoplay: true, stops: [stop("Pike Place Market", "Start at the market", 47.60971, -122.34220), stop("Pine Street", "Walk uphill along Pine", 47.61490, -122.32840), stop("Capitol Hill", "Finish at Cal Anderson Park", 47.61740, -122.31950)] }),
    reply: "The stops are neighbourhood waypoints, not checked cafés; swap in the shops you want and check their coordinates." },
  { slug: "colour-states", title: "Colour states by a value", prompt: "Colour US states by population density.",
    link: map({ basemap: "gray-vector", layers: [{ url: STATES, renderer: { type: "choropleth", field: "POP_SQMI", method: "auto", ramp: "purples" } }] }),
    reply: "POP_SQMI is the publisher's density field; I did not check how recent its population figures are." },
  { slug: "earthquakes-this-week", title: "Earthquakes this week", prompt: "Show me this week's earthquakes on a map.",
    link: map({ basemap: "dark-gray-vector", layers: [{ url: QUAKES_WEEK, type: "geojson", title: "USGS earthquakes, past week", renderer: { type: "auto", field: "mag" } }] }),
    reply: "This is the USGS live feed, so the map changes each time it opens." },
  { slug: "wildfire-perimeters", title: "Wildfire perimeters", prompt: "Map the current US wildfire perimeters.",
    link: map({ basemap: "gray-vector", layers: [{ url: PERIMETERS, title: "Current wildfire perimeters", ignoreServiceScaleRange: true }] }),
    reply: "This is a live layer, so it depends on the season and can be sparse. It is not for safety decisions." },
  { slug: "county-choropleth-sentinels", title: "A county choropleth with sentinels", prompt: "Map corn sales by county, and don't let undisclosed counties skew the colours.",
    link: CORN_LINK, reply: "-1 means Not Disclosed at the source, so it is excluded from the classes and drawn as No data." },
  { slug: "two-layer-map", title: "A two-layer map", prompt: "Show state populations with the Major League ballparks on top.",
    link: map({ basemap: "gray-vector", layers: [{ url: STATES, opacity: 0.8, renderer: { type: "choropleth", field: "POPULATION", method: "auto", ramp: "blues" } }, { url: BALLPARKS, title: "Major League ballparks" }] }),
    reply: "The ballpark layer is a published snapshot; I did not check it against current stadiums." },
  { slug: "state-briefing", title: "A briefing", prompt: "Turn US state population density into a short presentation.",
    link: map({ basemap: "gray-vector", layers: [{ url: STATES, renderer: { type: "choropleth", field: "POP_SQMI", method: "auto", ramp: "purples" } }], briefing: { layerId: STATES, selection: { useAll: true }, slides: [{ template: "title", title: "US population density" }, { template: "key-numbers", title: "At a glance", blocks: [{ type: "stat", stat: "count", label: "States and DC" }] }] } }),
    reply: "The count is computed when the briefing opens, and I added no figures of my own." },
  { slug: "contact-page-embed", title: "A contact-page embed", prompt: "Add a map of Fenway Park to my contact page.",
    link: map({ basemap: "streets-vector", camera: { center: [-71.0972, 42.3467], zoom: 15 }, layers: [{ url: BALLPARKS, where: "TEAM = 'Boston Red Sox'", title: "Fenway Park" }] }, "?embed=1&embedKind=map"),
    reply: "Paste the link into an iframe src. I have not tested it on your site." },
  { slug: "3d-extrusion", title: "A 3D map", prompt: "Show California's big wildfires stacked in 3D by decade.",
    link: FIRE_STRATA_LINK, checked: "2026-11-07",
    reply: "Each decade is a layer, the 1950s at the bottom; height is display order, not altitude. Fires before 1950 have no decade, so they are left out." },
  { slug: "vibe-map", title: "A themed map", prompt: "Make a moody, late-night map of US state populations.",
    link: map({ basemap: "open-dark", skin: "velvet-orbit", layers: [{ url: STATES, opacity: 0.85, renderer: { type: "choropleth", field: "POPULATION", method: "auto", ramp: "magma" } }] }),
    reply: "The theme is a skin and basemap choice, and the data colours stay a real scale." },
  { slug: "lidar-view", title: "A LiDAR view", prompt: "Show this LiDAR file in 3D: autzen_trim.las from the PDAL samples.",
    link: map({ title: "Autzen Stadium LiDAR", basemap: "gray-vector", layers: [{ url: AUTZEN_LAS, type: "pointcloud", title: "Autzen Stadium LiDAR", scene3d: { colorBy: "rgb", pointSize: 2 } }] }),
    reply: "This is a sample file. A LiDAR layer needs WebGL and the MapLibre engine." },
  { slug: "field-task", title: "A field task", prompt: "Send a colleague to check the signs at Oracle Park's main gate.",
    link: `${SITE}/?workflow=tasks#fieldTask=json:${json({ title: "Check gate signage", location: "Oracle Park main gate", lat: 37.77859, lon: -122.38927, notes: "Photograph anything damaged.", steps: ["Signs are readable", "Access is clear", "Photos taken"] })}`,
    reply: "The coordinates came from my own knowledge, and the task is only done when your colleague sends the report back." },
  { slug: "refine-a-link", title: "A refinement of an existing link", prompt: "Take my California fire map and colour it by year, keeping the 2000 to 2010 filter.",
    link: fireLink(FIRE_YEAR), reply: "The source, filter, basemap and camera are unchanged; only the renderer is new." },
  { slug: "cors-blocked", title: "A failure: CORS_BLOCKED", prompt: "Put https://example.com/ on a map as GeoJSON.",
    link: map({ basemap: "gray-vector", layers: [{ url: "https://example.com/", type: "geojson", title: "Blocked source" }] }),
    reply: "This publisher does not allow browsers to read its data, so the layer can't load. Download the file and add it to GISMap Online, or send me another source." },
].map((example) => ({ status: example.slug === "cors-blocked" ? "prepared" : "loaded", checked: "2026-11-01", ...example })));

export const promptExamplePath = (example) => `/examples/ai/${example.slug}/`;
