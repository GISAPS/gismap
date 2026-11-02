# GISMap Online

[![GitHub release](https://img.shields.io/github/v/release/geolibrerian/gismap)](https://github.com/geolibrerian/gismap/releases/latest)
[![Tests](https://github.com/geolibrerian/gismap/actions/workflows/test.yml/badge.svg)](https://github.com/geolibrerian/gismap/actions/workflows/test.yml)
[![License](https://img.shields.io/github/license/geolibrerian/gismap)](LICENSE)

**[GISMap.online](https://gismap.online/) makes interactive web maps and map briefings from one link.** It's free and open source and runs in the browser: no account, API key or server. People build in the app; AI assistants write the link.

| Make | From | Example |
| --- | --- | --- |
| Styled, filtered web map | ArcGIS REST, GeoJSON, WMS, KML, GeoParquet, PMTiles, local files | [California grape production](https://gismap.online/agent-recipes/interactive-map/) |
| Map briefing (slides on a live map) | The same layers, one slide per area or time | [Philadelphia police divisions](https://gismap.online/examples/ai/philadelphia-police-divisions/) |
| Guided map tour | Places in order, with camera and captions | [San Francisco landmarks](https://gismap.online/agent-recipes/geographic-tour/) |
| Field task with check-in and report | A location and a checklist | [Park inspection](https://gismap.online/agent-recipes/field-tasks/) |
| 3D: extrusions, LiDAR, CAD models | Polygons; LAS/LAZ; glTF, OBJ, PLY | [LiDAR and 3D models](https://gismap.online/agent-recipes/lidar-and-3d-models/) |

### For AI assistants and agents

Every result is one link with readable JSON after `json:`. A chatbot can write it without running code:

```text
https://gismap.online/#map=json:{"version":1,"layers":[{"url":"<layer URL>","renderer":{"type":"choropleth","field":"<FIELD>"}}]}
https://gismap.online/?tourOnly=1#tour=json:{"title":"…","stops":[{"name":"…","lat":37.8,"lon":-122.4}]}
https://gismap.online/?workflow=tasks#fieldTask=json:{"title":"…","lat":37.76,"lon":-122.43,"steps":["…"]}
```

Briefings go inside the map JSON (`"briefing": {...}`). Start with [llms.txt](https://gismap.online/llms.txt), the [agent skill](https://gismap.online/skills/) (Claude Code, Codex), the [agent recipes](https://gismap.online/agent-recipes/) ([JSON](https://gismap.online/api/agent-recipes/index.json)) and the [map-v1 schema](https://gismap.online/schemas/map-v1.schema.json). In an open page, `globalThis.gisMapOnline` is the [in-page API](#agent-api).

### Under the hood

GISMap supports MapLibre (the default, with three.js for point clouds and models) and the ArcGIS Maps SDK. It uses native ES modules, local browser project storage and portable project packages; no application login or database is required. The interface uses a layered globe-and-analysis mark with an editable HTML wordmark and the descriptor “Spatial intelligence studio.”

## Explore and learn

- [Browse public GIS data examples](https://gismap.online/examples/), including
  curated ArcGIS REST services and GeoJSON feeds that open directly in GISMap.
- Take the [Historical Quakes briefing tutorial](https://gismap.online/?briefingExample=historical-quakes&tutorial=1): a finished, editable story that explains source provenance, publisher symbols, a focused map filter, slides, cinematic playback, and sharing.
- Browse the [viewer guide index](https://gismap.online/guides/) or read about [ArcGIS REST services](https://gismap.online/arcgis-rest-service-viewer/),
  [FeatureServers](https://gismap.online/arcgis-feature-service-viewer/),
  [MapServers](https://gismap.online/arcgis-map-service-viewer/),
  [GeoJSON](https://gismap.online/geojson-viewer/), and
  [3D GIS](https://gismap.online/3d-gis-viewer/).
- Follow the [AI connection guide](https://gismap.online/ai-connection-guide/) to configure local Ollama or an API-key provider.

The examples index and featured dataset pages are generated from `js/catalog.js`:

```bash
node scripts/build-examples.mjs
```

CI runs the same script with `--check` to keep the committed pages and sitemap in
sync with the application catalog.

## Share remote layers

Choose **Project > Copy share link** to copy a URL that reopens the current public
remote layers and basemap. Local files and credentials are never included. Shared
URLs use repeatable `layer` and `layerType` parameters; curated catalog entries may
also be opened with `?example=<slug>`. Only HTTPS resources are accepted in
production (HTTP is permitted for localhost development).

## Run locally

The SDK and browser module security require HTTP; do not open `index.html` directly from the filesystem.

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## White-label an installation

Branding belongs to the deployed installation, not to an individual browser or
project. Before deploying a company copy, add its logo under `assets/` and edit
[`installation-config.js`](installation-config.js):

```js
globalThis.GISMAP_INSTALLATION = Object.freeze({
  applicationName: "Acme Maps",
  logoUrl: "./assets/acme-maps-logo.png",
});
```

Deploy that file with the application. The Project → Installation branding menu
shows the active values and the same config snippet; it does not save identity
data in localStorage.

## Map assistant (chat with your map)

**Tools → Map assistant** is a chat with the AI model the user connects in **Project → Configure AI** (local Ollama, OpenAI, Anthropic or any OpenAI-compatible endpoint). It builds interactive maps, briefings, guided tours and field-task drafts through 17 tools (`js/map-assistant.js`): `get_map_state`, `inspect_source`, `search_datasets`, `query_features`, `add_layer`, `update_layer`, `remove_layer`, `suggest_styles`, `set_view`, `set_basemap`, `load_map`, `create_briefing`, `generate_briefing`, `present_briefing`, `create_tour`, `draft_field_task` and `get_share_link`. The app writes the model's instructions (how to work from data, the formats, the live map state) and sends them as the system message with every turn; nothing is registered with the provider. Models with tool calling use it natively (Ollama `/api/chat`, Chat Completions, Anthropic Messages); others fall back to fenced JSON tool calls. Everything runs in the browser.

## Agent API

Language models and agents start at [`/llms.txt`](https://gismap.online/llms.txt) (the whole reference is in [`/llms-full.txt`](https://gismap.online/llms-full.txt)) and the guide [Making maps with an AI agent](https://gismap.online/guides/ai-agents/), with recipes for a chat-only model, a code-running agent and a browser-driving agent. [Worked examples](https://gismap.online/examples/ai/) show chatbots and agents making real maps and briefings, with their prompts, code, links and QR codes. [`/api/url-parameters.json`](api/url-parameters.json) and [`/api/catalog.json`](api/catalog.json) list every link parameter and the curated datasets. These files are generated by `node scripts/build-examples.mjs` and readable from any origin.

Everything an agent needs is on `globalThis.gisMapOnline` once `await gisMapOnline.ready` resolves (also a `gismap:ready` event and `<html data-gismap-state="ready">`):

```js
const api = globalThis.gisMapOnline;
await api.ready;
const corn = await api.layers.add("https://services.arcgis.com/P3ePLMYs2RVChkJx/ArcGIS/rest/services/Corn/FeatureServer/0", {
  renderer: { type: "choropleth", field: "CORN_SALES_IN_DOLLARS", ramp: "greens" }, // -1 "Not Disclosed" goes to "No data"
});
await api.camera.fitTo(corn.id);
api.describe(); // capabilities + live layers, basemap, camera, skin, mode
await api.application.runTool("layer.filter", { layer: corn.id, where: "CORN_SALES_IN_DOLLARS >= 0" });
```

### A map from one JSON object (no code)

A chat-only model can make a map by writing a [map-v1](schemas/map-v1.schema.json) spec and URI-encoding it into a link:

```text
https://gismap.online/#map=json:{"version":1,"basemap":"gray-vector","layers":[{"url":"https://services.arcgis.com/P3ePLMYs2RVChkJx/ArcGIS/rest/services/Corn/FeatureServer/0","renderer":{"type":"choropleth","field":"CORN_SALES_IN_DOLLARS","method":"auto","ramp":"greens","exclude":[-1]}}]}
```

URI-encode the JSON (`encodeURIComponent`) when you can; the readable form holds up to 8,192 characters. `gisMapOnline.mapSpec.createLink(spec)` (or `mapSpec.createLink` from `js/gismap-core.js`) gives the compressed `#map=` form, and `?spec=<https URL>` opens a hosted spec. For one layer and one field there is no JSON at all: `?layer=<URL>&style=choropleth&field=<FIELD>&method=auto&ramp=greens&exclude=-1&basemap=gray-vector`. Invalid parts are skipped and listed in `describe().state.issues`.

`"method": "auto"` lets the app choose the class breaks from the data (quantile for skewed values, natural breaks for clusters, equal interval for even spreads), and `{ "type": "auto", "field": "…" }` (`style=auto`) lets it choose the whole style. `breaks: [1000, 50000, …]` fixes the classes. When the app resolves an `auto` style it records the result with its breaks, so saved projects and shared links look the same for everyone. `gisMapOnline.layers.suggestStyles(id, { field })` (and the Style options list in the style panel) ranks the styles that suit a field, each with a reason, its breaks and a `pinnedSpec` to apply; `renderers.suggest` in `js/gismap-core.js` does the same from values you pass in.

Errors are `GisMapError` with a `code` and a `hint` written for agents. The contracts are [`api/capabilities.json`](api/capabilities.json) (namespaces, stability, tools with input schemas, error codes, ramps, basemaps, URL parameters), [`schemas/renderer-v1.schema.json`](schemas/renderer-v1.schema.json) and [`js/gismap-core.d.ts`](js/gismap-core.d.ts) (`InPageApi`). A `?layer=` link zooms to its data unless it says `zoom=none` or gives `center=lon,lat&level=` / `&scale=`.

## Client-side Briefing API

GISMap exposes the same versioned Briefing functions to in-page agents and to ES-module callers. No GISMap server or account is required.

```js
const api = globalThis.gisMapOnline;
const slide = api.briefing.createSlide("map-narrative", {
  title: "Where improvements are planned",
});
const document = api.briefing.addSlide(api.briefing.create(), slide);

api.briefing.load(document); // opens the document in Briefing
// The same link the app shares: it opens the slides with the map's layers,
// styles, filters, skin and view. { documentOnly: true } gives a slides-only
// link (#briefing=b1.…) that applies to whatever layers the URL loads (?layer=…).
const link = await api.briefing.createLink(document, { qrSafe: true });
const project = api.briefing.exportProject(document); // { fileName, mimeType, text, blob }

// Build slides from the map as it looks (style, filter, chosen features), and render the PDF handout.
await api.briefing.generate({ layerId: "https://…/FeatureServer/0", ai: true });
const pdf = await api.briefing.exportPdf(); // File
const qrCard = await api.briefing.exportQrCard(); // branded PNG File
```

The experimental in-page `briefing.generateTemplate` API previews or appends Filter Series, Timeline, Grid Atlas, and 3D Spatial Chart slides from an already loaded layer. It queries at most 500 features and reports coverage as unknown; its statistics are not guaranteed complete. Set `previewOnly: true` to avoid saving. It is not a standalone core or HTTP API. See [data-driven briefing API](https://gismap.online/skills/gismap/references/briefs.md) for options, geometry limits, and verification guidance.

A briefing document can say which data it is about: `layerId` is best given as the layer's service URL, which GISMap loads if it is not already on the map, and `selection.ids` lists the chosen features. Host a document as JSON (CORS-enabled) and link to it as `https://gismap.online/?briefing=<file URL>`; GISMap opens it on that layer and starts presenting. The file may be a briefing document, a project that contains one, or the briefing file the share dialog downloads.

Headless agents can import the pure core without opening the app:

```js
import { briefing, sources } from "./js/gismap-core.js";

const metadata = await sources.inspect("https://example.org/arcgis/rest/services/Projects/FeatureServer/0");
const result = briefing.validate(document);
```

The machine-readable contracts are [`api/capabilities.json`](api/capabilities.json), [`schemas/briefing-v1.schema.json`](schemas/briefing-v1.schema.json), and the [`gismap-core` TypeScript declarations](js/gismap-core.d.ts). Filters, slides, blocks, cameras and styles are declarative data; credentials and temporary viewer state do not belong in a briefing. Browser source inspection remains subject to CORS. The library does not provide hosted links, access control, or background jobs.

### Smart map images

Project → Download project can create a **Smart map image**: a polished, standards-compliant PNG containing the complete editable project configuration in GISMap's private `giMp` ancillary chunk. The visible image opens normally anywhere; importing the original PNG through Project → Import restores its camera, basemap, public layer references, styling, bookmarks, workflows, and Briefing slides.

```js
const output = await gisMapOnline.smartImages.createCurrent();
const manifest = await gisMapOnline.smartImages.read(output.blob);
console.log(output.file.name, output.share?.url, output.share?.qr);

await gisMapOnline.smartImages.downloadCurrent();
```

`createCurrent()` gives an agent the PNG without forcing a browser download and also returns `share`, the equivalent live-map link with public layers, styles, filters, camera, basemap, and skin. `createShareLink()` returns that link directly. Its `qr` flag says whether it fits safely in GISMap's separate branded QR image. Keeping the QR as a separate artifact leaves the Smart Image clean while providing a reliable route back to the live map; GISMap can also reopen QR screenshots and photos.

The embedded payload is versioned, deflate-compressed when supported, protected by PNG CRC and SHA-256 integrity checks, and bounded by explicit input limits. Remote URLs containing credentials are rejected. Smart Images reference public services and do not make those services offline; use `.gisx` when local datasets must travel with the project. Keep the original PNG—social networks and image editors may resize it or remove ancillary metadata. When another service strips the private PNG chunk, share the companion live link or QR image alongside it.

### Composable application preview

Feature branches under `codex/**` run `.github/workflows/development-preview.yml`. Every run produces a 14-day static preview artifact after the complete test suite and JavaScript syntax checks pass. An isolated Cloudflare Pages development deployment is enabled only when the `development` GitHub environment defines `CLOUDFLARE_PAGES_PROJECT_DEV`, `CLOUDFLARE_API_TOKEN_DEV`, and `CLOUDFLARE_ACCOUNT_ID_DEV`. These names deliberately do not reuse production credentials or destinations, and the workflow has no production trigger.

The production site remains unchanged until its separate release process is explicitly invoked.

## Releases

The current application version is recorded in [`VERSION`](VERSION). Releases use
[Semantic Versioning](https://semver.org/) and `vX.Y.Z` Git tags. See the
[`CHANGELOG.md`](CHANGELOG.md) for feature-level history and the
[GitHub Releases page](https://github.com/geolibrerian/gismap/releases) for
published builds and generated release notes.

Keep `VERSION`, `js/version.js`, and `api/capabilities.json` in sync; tests check
their agreement. Asset cache-busting revisions and portable document schema
versions are independent and need not match the application version.

## Modules

- `js/map-controller.js` — the provider-neutral application facade: selects an engine and owns workflows that can be composed from common map primitives
- `js/engines/engine-registry.js` — lazy engine registration and factory; MapLibre is the default and additional renderers can register without changing application consumers
- `js/engines/engine-interface.js` — the small renderer contract plus the larger application facade, capabilities, events and plain-data types (layer handles, features, view targets)
- `js/engines/maplibre/maplibre-engine.js` — the MapLibre preview renderer (`?engine=maplibre` or Map → Map engine): OpenFreeMap basemaps and open raster-DEM 3D terrain; GeoJSON and ArcGIS feature layers held in the browser (filtered, queried and identified here, spatial relationships asked of the service); ArcGIS map image and imagery services and WMS as images; camera and capture. Beside it: `terrain.js`, `arcgis-service.js` (describing and paging ArcGIS services), `arcgis-renderer.js` (ArcGIS renderers as MapLibre paint), `where.js`, `geojson.js` and `basemaps.js`
- `js/basemap-themes.js` — basemap themes derived from a skin's design tokens (the "skin" basemap); `js/engines/maplibre/basemap-theme.js` applies one to an OpenMapTiles style by layer role
- `js/engine-preference.js` — which engine draws the map: the link's `?engine=`, then the saved Display settings choice, else MapLibre
- `js/engines/arcgis/arcgis-loader.js` — loads ArcGIS runtime CSS and JavaScript only when the ArcGIS renderer is selected
- `js/engines/arcgis/arcgis-engine.js` — the ArcGIS renderer adapter: 3D scene/camera lifecycle, elevation ground, layer adapters, queries, identify, drawing, refresh, rendering, navigation, capture and geocoding
- `js/identify.js` — popup-free identify results from the engine, de-duplicated across layer types
- `js/ui.js` — sidebar, menus, tabbed workspace tools, layer controls, places, and insight rendering
- `js/project.js` — local projects plus `.gis` project and `.gisx` package import/export (legacy JSON/ZIP files remain supported)
- `js/attribute-table.js` — searchable, paginated queryable layer table in a non-modal map drawer
- `js/ai.js` — optional Ollama, OpenAI, Anthropic, and OpenAI-compatible adapters; online tokens stay in memory only
- `js/tool-manager.js` — opt-in local JavaScript tool registration
- `js/events.js` — pub/sub event bus
- `js/application-state.js` — authoritative selections, filters, active layer, time, styling, navigation, bookmarks, and chapters
- `js/application-registry.js` — validated panel and tool extension contracts with lifecycle cleanup
- `js/application-config.js` — versioned application configuration, presets, and legacy presentation migration
- `js/layout-manager.js` — constrained dock placement and reversible previews around one map instance
- `js/application-runtime.js` — registered workspace/data/presentation panels and approved builder operations
- `js/data-catalog.js` — portable catalog schema, read-only SQL validation, and deterministic natural-language query planning
- `js/gismap-core.js` — pure client-side API for briefing documents, filters, statistics, source inspection, and share encoding
- `js/briefing-api.js` — binds the pure API to the active GISMap project and camera as `globalThis.gisMapOnline.briefing`
- `js/smart-image.js` — renders portable map PNGs and safely embeds or restores versioned GISMap project manifests
- `js/duckdb-client.js` — optional, lazily loaded DuckDB-Wasm execution for browser feature records and HTTPS analytical sources
- `js/catalog.js` — public data services plus categories, stable slugs, source
  metadata, reuse guidance, tags, and featured-example controls
- `scripts/build-examples.mjs` — generates the searchable examples index,
  featured dataset pages, viewer guides, and sitemap
- `js/share.js` — safe parsing and creation of shareable remote-layer URLs
- `js/markdown.js` — sanitized Markdown rendering for intelligence responses
- `js/enterprise-catalog.js` — live ArcGIS Enterprise service-directory browser
- `js/engines/arcgis/arcgis-auth.js` — ArcGIS Online/Enterprise OAuth, standalone Server token/web-tier registration, federation discovery, and connection diagnostics
- `js/export/` — paginated vector retrieval and background-worker GeoJSON/KML/KMZ/Shapefile conversion

## Browser and service constraints

- Remote GIS/AI services must allow this site's origin through CORS.
- DuckDB-Wasm is loaded only when a user runs SQL. The project stores catalog definitions and pinned source versions, not source credentials or downloaded rows. Remote Parquet, JSON, and CSV sources must use HTTPS and permit browser CORS requests. A view-only catalog is an analytical recipe, not an authorization boundary.
- SQL panels accept one read-only `SELECT`, `WITH`, `DESCRIBE`, `EXPLAIN`, `SHOW`, or `SUMMARIZE` statement at a time. Data-changing statements, extension loading, arbitrary attachment, imports, and exports are rejected before execution. AI-assisted requests always produce a visible plan for review and use the same validator.
- ArcGIS Online and Enterprise Portal connections use the Portal-hosted OAuth experience (PKCE where supported), so built-in, SAML, OIDC, and social logins remain controlled by the organization. Register both the displayed popup callback and full-page redirect URI in the Portal application.
- Federated ArcGIS Servers are discovered from `/rest/info` and associated with their owning Portal. Standalone Servers can use either a discovered token endpoint or explicitly configured browser-managed web-tier authentication (IWA, PKI, or reverse proxy).
- ArcGIS connection tests report version, authentication model, token endpoint, CORS reachability, federation, and owning Portal. Only connection metadata is exported with projects; credentials and tokens are never serialized.
- Map Insight and attribute tables can float over the map or dock to its left, right, or bottom as dashboard panels. Docked layouts resize the ArcGIS view and provide draggable, keyboard-accessible dividers whose sizes are remembered by the browser.
- The resizable Workspace Panel hosts independent, closable tabs for Basemap Gallery, Elevation Profile, Legend, Draw, layer Style, and Intelligence. Draw returns to the left sidebar when its workspace tab closes, and its graphics remain exportable as GeoJSON, KML, KMZ, or zipped Shapefiles.
- On phones, a fixed bottom bar offers Menu, Places, Bookmarks, Draw, Layers, and Details. Tap a button to show its controls above the bar, tap again to close, or tap another to switch. Map navigation stays in a collapsible side rail.
- Places and Bookmarks are independent workspace panels, keeping search and saved views directly accessible without an internal mode switcher.
- GeoJSON URLs load as native, queryable `GeoJSONLayer` instances and retain refresh, styling, and table settings in project files.
- ArcGIS MapServer sublayer URLs are detected automatically, including raster sublayers that must be loaded through their parent `MapImageLayer`.
- ArcGIS FeatureServer `/query` URLs are accepted and normalized to their layer endpoint; `where` and `outFields` are applied to the native feature layer. Layer zoom uses a live, filter-aware feature extent when supported, avoiding stale or malformed service extents.
- WFS 2.0 services with advertised GeoJSON output can be added from either a service endpoint or a full GetFeature URL; feature type names and nonstandard custom parameters are retained automatically.
- Queryable vector layers and user drawings can be downloaded as EPSG:4326 GeoJSON, KML, KMZ, or zipped Shapefiles. Layer exports can honor the active filter, use the current map extent, or retrieve the entire source; pagination, progress, and cancellation are handled without blocking the map.
- Vector operational layers are explicitly draped on the scene ground so Z-enabled feeds such as USGS earthquake data do not fall beneath terrain.
- AI controls appear in Intelligence only while a provider is fully configured. Intelligence can also be opened as a persistent right-panel tab alongside map tools such as the Basemap Gallery. The assistant uses map evidence and detailed reverse-geocoder context first, and may supplement it with clearly labeled general model knowledge. Map Insight selections are sent as bounded, in-memory feature JSON alongside the clicked location and are never saved in projects or browser storage. AI responses remain visible while exploring the map until another query starts or the user clears them. It does not have live web research unless a future research provider is explicitly configured. Online API tokens are never persisted or included in exports.
- Browser access to local Ollama is connection-tested before enabling AI. On macOS, allow only this site's origin with `launchctl setenv OLLAMA_ORIGINS "https://gismap.online"`, fully quit Ollama, and reopen it.
- Local KML/KMZ is converted to GeoJSON in the browser; uncommon KML extensions may not be preserved.
- A zipped shapefile must include its `.shp`, `.shx`, and `.dbf` components.
- Local project saves cannot reopen local files after a browser restart. Export a project package to bundle them.
- Public service URLs and provider usage terms should be reviewed before production deployment.
- Loading a custom JavaScript tool executes that file in the page origin. Only load trusted code.
