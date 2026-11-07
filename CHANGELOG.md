# Changelog

All notable changes to GIS Map Online are documented here. This project follows
[Semantic Versioning](https://semver.org/), and this file follows the
[Keep a Changelog](https://keepachangelog.com/) format.

## Unreleased

- Stacked 3D charts can reverse their order: **Reverse stacking order** in the Style panel's 3D visualization (or `order: "descending"` on a `spatialChart`) puts the highest group at the bottom, such as the newest decade of fires, and the slab colours, legend and Cinematic Strata playback follow. The flat outlines on the ground under a 3D chart or Strata stack are now off by default; **Show outlines on the ground** (`groundOutlines: true`) brings them back. A year height field reads as 2025, not 2,025, in the legend.
- The Cinematic map timeline follows the Instant Dashboard skin: its font, heading, corners, border, shadow and accent colour now match the rest of the skin.
- The Cinematic timeline shows a year field as a year (1989), not a grouped number with its field name ("YEAR_ 1,989").
- California Historic Fire Perimeters is a plain data source in Popular data services (`?example=california-fire-perimeters`), and the 3D strata view of it, fires stacked by decade, is a map link on the [Discover examples page](https://gismap.online/discover/examples/). The two PM2.5 3D column examples are gone; the PM2.5 data entry stays.
- The Source panel shows a publisher's description as readable text. HTML descriptions, including ones stored entity-escaped such as CAL FIRE's, no longer show their markup.
- The product name now reads GISMap Online everywhere people, search engines and agents see it, including PDF and QR wordmarks and PDF metadata. Renamed installations keep their own name.
- Attribute table stripes, hover states, the insights overlay and connection panels now derive from each skin's colours, so text stays readable in every skin and theme. A contract test blocks hard-coded surfaces and low-contrast skins.
- Map links (map-v1) can open linked chart panels: a top-level `charts` list names each chart's type, fields, layer (by position or URL), style and placement, and opening the link adds them beside the map without changing the sidebar. `mapSpec.fromCurrent()` writes open chart panels back into `charts`. New worked example: [wildfires by state](https://gismap.online/examples/ai/wildfires-by-state-chart/).
- Cinematic mode has a **Strata timeline** effect: each step's polygons drop onto the top of a 3D stack, earliest at the bottom. A layer styled as a stacked 3D chart (for example Temporal strata) keeps its slots, colours and thickness; otherwise each playback step gets a slot. Choosing it turns on Build up.
- Cinematic mode no longer shows every record for a moment after it starts, before the first step.
- Rise, Reveal, Strata timeline and settled Cinematic edges now survive a basemap or skin change instead of disappearing until the next step.
- Added the `si-console` embed for the GISMap SI Query Console: results, query geometry, selection and map gestures over a versioned message channel pinned to GISMap SI origins.

## 0.54.0

- `gisMapOnline.print` gives agents the Print Editor: templates, options, previews, PDFs and branded Smart Images. Exports return files and fail rather than render a blank or partial map.
- `smartImages.createCurrent` now renders through the Print Editor. Smart Images record who rendered them, and importing one without that record shows a notice.
- `gisMapOnline.project.exportFile` and `exportPackage` return `.gis` and `.gisx` files. `briefing.exportProject` replaces `briefing.exportGmo`, which stays as a deprecated alias. Legacy `.gmo` and `.gmop` files still import.
- A browser without WebGL now reports `WEBGL_UNAVAILABLE` at startup.

## [Unreleased]

### Spatial analysis

- Add Tools > Spatial Analysis on both engines: measure, buffer, dissolve, hull, Voronoi, clusters, hexagons, nearest, select, join, count, clip and erase. Layers or shapes drawn on the map can be inputs, and results are added as layers. Agents can use `gisMapOnline.analysis`, the assistant's `spatial_analysis` tool, or `analysis` steps in a map spec.

### Spreadsheets

- Add CSV, TSV, XLSX, XLSM, ODS and public Google Sheets as point layers. X/Y, Long/Lat, Longitude/Latitude and other column names are recognized, and a dialog asks for the columns when they are not.

### Agent discovery

- Rewrite the agent skill (0.2.0) with a fastest path, a no-tools path and one reporting rule. Generate contract enums from the app's constants and check them, links and worked examples in CI.
- Add a "Made with" credit on embeds and shared links, the `via` link parameter, 15 prompt examples and JSON-LD. Use the name GISMap Online throughout.
- Fix `?tourOnly=1` tours opening with a zero-width map on desktop.

### Embedding

- `?layer=…&embed=1` now opens the chrome-free embedded map, as embedded `#map` links do. Embedded maps no longer show the mobile tool strip, and desktop-width embeds no longer render the map zero pixels wide. GISMap SI uses it to show a dataset inside its Dataset Studio. The map sends `{type: "gismap.ready"}` only to gismap.si parent pages.
- Add the Dataset Studio private-preview embed. `?embed=1&embedKind=si-preview` opens the same read-only, compact GISMap Online viewer and accepts a bounded GeoJSON snapshot only from its trusted GISMap SI parent. The snapshot never appears in a URL or creates a public service.

### Cartography Lab

- Add Tools › Cartography Lab: one panel that combines a layer's colour (single, categories, classes, size, heat map), 3D height (the four spatial chart modes) and a filter, with a live preview, on the MapLibre and ArcGIS engines.
- Save the combinations as reusable layer styles (`schemas/layer-style-v1.schema.json`): kept with the project and in the browser's style library, downloaded and imported as `.gismap-style.json` files.
- Make an interactive map link, briefing slides (title, flat map, 3D) or a tour of the top features from a style; add `gisMapOnline.layerStyles` for agents. Vector tile export is planned.
- Draw 3D spatial charts on the ArcGIS SceneView engine (extrude symbols, a meters size variable for height and `Decode()` base heights).

### three.js 3D layers

- Add `pointcloud` (LAS 1.0–1.4, LAZ via laz-perf, XYZ) and `model` (glTF/GLB, OBJ, PLY) layers on the MapLibre engine, drawn by a shared three.js custom layer. Point clouds reproject from the file's CRS (GeoTIFF keys or WKT; proj4, epsg.io for unknown codes), convert foot units, colour by RGB, ASPRS class, elevation or intensity, and filter classes for wires, towers and vegetation. Models are placed by anchor or from projected CAD coordinates.
- Portable `scene3d` options in map-v1, share links and projects; local LiDAR and CAD files from Add data; a 3D legend; zoom-to-layer lifts the camera onto the terrain.
- Add the GISMap animation clock and a point-cloud reveal effect as the first piece of the animation engine.
- Add the `lidar-and-3d-models` agent recipe and the 3D data skill reference.

### Agent recipes


- Publish the canonical agent recipes as `agent-recipe-v1` JSON (`/api/agent-recipes/`) and one page each (`/agent-recipes/`), linked from llms.txt, the skill, the agent guide, examples, capabilities and the manifest. Each example records what was actually checked.
- Document the standalone `tour-share.js` and `field-task-share.js` encoders so agents can create tour and field-task links without the app; add San Francisco tour, park inspection, California grape (2D and 3D) and Halloween colleges examples and six regression scenarios.
- Warn when a map spec asks for imagery that the engine replaces with a street map (satellite on MapLibre), and fix an exception when a map spec opens the MapLibre legend.
- Fix timeline frames for date-only values stored at UTC midnight (now a preview warning), reject spatial charts with more than 40 groups instead of dropping them, and cap magnitude slabs at their slot.
- The documentation smoke test now reports which crawler user agents the edge blocks.

### 3D spatial charts and Briefs

- Add MapLibre polygon charts for attribute extrusion, temporal strata, source-footprint stacks and exploded timelines, with explicit virtual-Z legends and portable `spatialChart` state in projects, map specs and share links.
- Add a five-scene 3D Spatial Chart Brief template—Overview, Magnitude, History, Accumulation and Conclusion—to the Brief authoring panel and experimental `briefing.generateTemplate` API.
- Add the `spatial-3d-chart` agent recipe and skill guidance. The first renderer is deliberately fast display: it preserves source footprints and does not claim exact overlap partitioning, unique affected area or analytical spatial columns.

### Briefing v2 (in development)

- Preserve more briefing state in full links, await shared layer readiness, and report unsupported styles instead of silently using a fallback. See `docs/briefing-v2-status.md` for known gaps.

### Tour and field-task navigation

- Link tour chapters and field-task locations to Google Maps using their existing coordinates.
- Make the tour control offer an exit to the GISMap workspace and keep its actions clear of the mobile control bar.

### Identity and version alignment

- Name the application GISMap Online: Free Geospatial Application in browser and social metadata, and describe its MapLibre and ArcGIS engines accurately in About this build.
- Align the current code's application and client API version at 0.52.9; project and interchange schema versions remain independent.

### 3D buildings on MapLibre

- Every MapLibre basemap now shows 3D buildings from zoom 14 (MapLibre zoom 13), extruded from OpenStreetMap building heights (as in MapLibre's 3D buildings example), under the labels; tilt the map to see them.
- On the Skin basemap the buildings take the skin's building colour, and recolour when you change skins.
- **Map → 3D buildings** turns them on or off on MapLibre (on unless you turn it off; remembered in this browser). The Map assistant's guide knows it.

### The Map assistant explains your data

- New `describe_layer` tool: a layer's service description, summary, credits, licence, tags, last edit date, feature count and time field, and its schema — every field with its type, alias, description and coded values — read from the ArcGIS layer, its service and its portal item.
- New `summarize_field` tool: a field's values computed by the service over all features — minimum, maximum, mean and spread for numbers and dates; the most common values with counts (and coded names) for text — so the assistant can interpret what a field holds.
- The assistant now answers questions about the data by reading it, and adds, changes or removes layers only when asked.

### The Map assistant knows the app

- The assistant has a built-in guide to GIS Map Online's menus, panels and settings (`js/app-guide.js`): its instructions list the menus, and a new `app_help` tool answers "where is…" and "how do I…" questions with the exact menu path.
- New `get_display_settings` and `change_display_setting` tools let the assistant read and change the Layout & display settings for you, such as switching the selection style to *Outline only*, the feedback colour or dark mode.
- A test checks that every menu item the guide names exists in the app.
- More assistant tools: `set_mode` (briefing, tours, field tasks, standard map), `set_skin` (every interface skin, also listed in the guide), `save_project`, `open_share_menu` (Share & export), and `download` (Map PDF, Smart map image, .gmo project file or .gmop package).

### Place search and addresses on MapLibre

- Place search and map-click addresses now work on the MapLibre engine, with open geocoders called straight from the browser: the US Census Geocoder for US street addresses, and Nominatim (OpenStreetMap) for everywhere else.
- In the US, a clicked point's details also list its state, county, census tract and block (with FIPS / GEOID codes).
- Nominatim's public server allows one request a second and no search-as-you-type, so on MapLibre place search runs when you press Enter instead of suggesting places while you type.

### Faster ArcGIS layers on MapLibre

- Large feature layers (for example WFIGS fire perimeters, 42,000+ polygons) draw within a few seconds: simplified overview geometry in 2000-feature pages, ten requests at a time, drawn as pages arrive.
- Polygons and lines appear first as coarse sketches (outlines generalized to about 2 km, only the fields the style reads) in about 2.5 seconds, then are replaced by the overview outlines page by page.
- Polygons and lines are refetched at full detail for the area in view as you zoom in.

### Selection highlight on MapLibre, filled or outline

- The feature selected in Map Insight, a briefing slide or the Explorer is now highlighted on the MapLibre engine too, above the data and kept across basemap changes.
- **Layout & display → Selection style**: *Filled polygon with outline* (as before) or *Outline only*, in the feedback colour, on both engines.

### MapLibre 3D terrain

- **MapLibre now draws real 3D terrain.** Its existing Terrain surface setting adds a key-free raster DEM from Mapterhorn, subtle hillshade and sky, with pitch up to 85°. Vector and ArcGIS feature layers stay draped on the terrain, and Smart image and briefing PDF captures include the same relief.
- Terrain is independent of the basemap and survives OpenFreeMap and skin-basemap changes. Projects keep `world-elevation`, `world-topobathymetry` or `flat`; the MapLibre menu makes clear that its open DEM covers land elevation rather than bathymetry, and Flat ground removes the DEM, hillshade and sky.
- MapLibre now advertises the shared `view-3d` and `ground` capabilities and is labelled **MapLibre — open 3D maps (preview)**. It still supports ordinary overhead maps at zero pitch.

### ArcGIS services on the MapLibre engine, and engine switching that holds

- **ArcGIS data works on MapLibre.** Feature layers (FeatureServer and MapServer layers that hold features) are fetched as GeoJSON in pages and keep their service's fields, field types, coded values, display field and **object IDs**, so tables, filters, briefings, slide features and field tasks refer to the same features as on ArcGIS. Layers bigger than 50,000 features are fetched already filtered (and fetched again when the filter changes). Map image services (cached tiles or drawn on request), image services and WMS draw as images; areas without data stay transparent, and WMS respects the server's layer limit and any `LAYERS=` in the link.
- **Styles carry over.** A layer's own service style, and GIS Map styles (choropleth, graduated symbols, categories, single colour, and ArcGIS renderer JSON from links and projects), are translated into MapLibre expressions (`js/engines/maplibre/arcgis-renderer.js`); codes such as -1 draw as "No data". Style suggestions, automatic classes and sentinel detection work as on ArcGIS. Heat maps still need the ArcGIS engine.
- **Spatial relationships are answered by the service** for ArcGIS layers (briefing slide layers such as "ballparks inside this state", surroundings counts), as on ArcGIS. Publisher scale ranges apply, with **Show anyway**.
- Polygons whose islands a service packs into one ring list draw correctly (islands as parts, lakes as holes), and layers spread over half the world zoom to their dense core, as on ArcGIS.
- **Choosing an engine switches at once** (no confirmation prompt that a browser could silence), and the reopened address names the engine, so the choice holds. MapLibre is no longer labelled 2D; with terrain enabled it is labelled "open 3D maps (preview)". A layer that fails to draw reports once every few seconds instead of once per tile.
- Still ArcGIS-only: WFS and KML, KMZ and shapefile files, measurement and the other widgets, place search, secured services, and terrain bathymetry.

### Clearer menus, and choosing an engine and its basemaps

- **Workflows is now Modes** (Briefing, Tours, Field tasks, Standard map), which fits the menu bar.
- **Every dropdown fits the side panel.** Menus open across the panel's width under the menu bar instead of under their button, so Map, Modes and Tools no longer run off the panel's edge.
- **Map** is about the map itself: **Map engine** (ArcGIS 3D globe or MapLibre open 3D preview), **Basemap**, **Terrain surface** (with engine-specific choices) and the Bookmarks and Draw panels.
- **Tools** holds the Map assistant and the **map tools**: Legend, Measurement, Elevation profile, Compass and the 3D basemap gallery (greyed out, with a note, when the MapLibre engine is drawing). **Project** gains the settings: Layout & display, ArcGIS connections, Configure AI, Load custom JavaScript tool and About this build.
- **The basemap list belongs to the engine.** ArcGIS lists its 3D, 2D and imagery basemaps; MapLibre lists the OpenFreeMap styles (Liberty, Bright, Positron, Dark); both offer Skin. The list shows the basemap actually on screen: a "3D Topographic" link opened with MapLibre shows Liberty. One catalog (`js/basemap-catalog.js`) gives each basemap its engine and its nearest match on the other, used by both engines, links (`basemap=open-positron` …), the map-v1 schema and the API docs.
- **Switching engines keeps the view and basemap**, also for a map without layers (it reopens with `basemap`, `center` and `scale`).

### Skin basemap: the map in the colours of the interface (phase 1)

- **A new basemap, "Skin — follows the look"** (basemap menu, Display settings, tours, and `basemap=skin` in links and map specs). With the MapLibre engine it is the open Positron style redrawn in the active skin's own colours: land in its paper, water and parks in its muted tone, roads, boundaries and labels from its ink and line colours, points of interest and road shields hidden so the data stands out. Highway gives the white, grey-water technical map that inspired it (with uppercase labels); Midnight, Velvet Orbit and Violet Circuit give dark maps; Pacific ’94 and Copperplate their teal and sepia papers. Changing the skin, or light and dark mode, redraws it at once. The ArcGIS engine shows its light or dark gray canvas for it.
- **Data takes the skin's accent.** With the MapLibre engine, layers without a style of their own are drawn in the skin's accent colour (Highway orange, Midnight cyan, GIS Map green); a style you choose is kept.
- How it works: `js/basemap-themes.js` derives a theme from a skin's CSS tokens (`--paper`, `--surface`, `--ink`, `--muted`, `--line`, `--green-2`), keeping every label at 4.5:1 contrast or better; `js/engines/maplibre/basemap-theme.js` gives every layer of the OpenMapTiles styles a role (water, roads, labels, …) and recolours by role, keeping the style's zoom ranges, filters, widths and dashes. Engines advertise it as the `basemap-themes` capability (`setBasemapTheme`).
- Tests (`tests/basemap-themes.test.mjs`) derive a theme for every skin from `css/app.css` and check contrast, and run the compiler over the three OpenFreeMap styles (`tests/fixtures/openfreemap-*.json`): every layer has a role, and structure is unchanged.
- The map status no longer says "Loading ArcGIS Maps SDK" while another engine loads.

### MapLibre engine preview (open basemaps, GeoJSON)

- **A second map engine, opt-in.** Open any link with `?engine=maplibre`, or choose **Map → Map engine → MapLibre** (also in **Project → Layout & display**), which saves the choice and reopens the current map from its link. ArcGIS stays the default; nothing changes unless you choose it.
- **What it does so far:** a map drawn with MapLibre GL JS 5.24.0 on key-free [OpenFreeMap](https://openfreemap.org) styles (GIS Map basemap ids map to Liberty, Bright, Positron or Dark, so links keep their basemap id); **GeoJSON layers** from URLs and files, with visibility, opacity, single-colour styles, attribute filters, the attribute table and search, identify, queries and briefings; the camera (centre, zoom, heading and tilt) in the same GIS Map zoom levels as ArcGIS, so map links, projects and tours open on the same view in either engine; navigation buttons; and image capture for Smart images and PDFs.
- **Not yet:** ArcGIS, WMS, WFS and KML services, KML/KMZ/shapefile files, class-based styles and style suggestions, exact spatial relationships (only "in view" and box queries), geocoding search, drawing, measurement and other widgets, highlights and tour or task pins. Each says it needs the ArcGIS engine instead of failing silently; address lookups are simply skipped.
- **Optional capabilities are optional.** `MapController` gives harmless defaults when an engine lacks them (no click marker, no tour pins, no address) and reports the missing capability for the rest. With MapLibre selected the ArcGIS runtime is never downloaded; saved ArcGIS sign-ins load it only when a connection is used.
- New pure modules with Node tests (`tests/maplibre-engine.test.mjs`): `js/engines/maplibre/where.js` evaluates GIS Map's SQL where clauses (comparisons, LIKE, IN, BETWEEN, IS NULL, AND/OR/NOT) against GeoJSON properties, `geojson.js` (object IDs, fields, bounds, representative points), `basemaps.js`, and `js/engine-preference.js`.
- Fixed: two places in the interface still read the old `mapController.widgets` map, so opening a utility panel (Style, Map assistant, Field tasks) or Show legend threw after the engine host refactor. The facade now has `widgetOpen(name)`, and the boundary test catches the pattern.

### One map engine interface (phase A of multi-engine support)

- **The ArcGIS Maps SDK now sits behind one engine.** `js/map.js` moved to `js/engines/arcgis/arcgis-engine.js` (and `auth.js` to `js/engines/arcgis/arcgis-auth.js`). A provider-neutral `MapController` selects the renderer through `engine-registry.js`, exposes the existing application API, and owns cross-engine workflows such as multi-view capture, field values, distinct values and feature framing. The smaller renderer contract in `engine-interface.js` is limited to map lifecycle, layers, queries, view/identify and capture primitives, so a MapLibre engine does not have to reproduce ArcGIS-only application behavior.
- **The selected map runtime loads on demand.** ArcGIS CSS and JavaScript are no longer unconditional tags in `index.html`; `arcgis-loader.js` loads them only when the ArcGIS engine is selected. The registry and factory make engine selection explicit while preserving ArcGIS as the current default.
- **No SDK objects outside the engine.** The rest of the app works with read-only **layer handles** (`getLayers()`, `getLayer(uid)`: `uid`, `title`, `url`, `fields`, `geometryType`, `objectIdField`, `visible`, `opacity`, `where`, `rendererSpec`, `renderer` JSON, and `queryable` / `countable` / `filterable` flags), **plain features** (attributes and geometry JSON) from `queryFeatures` / `queryFeatureCount` / `queryObjectIds`, and **view targets** for `setView` (center/zoom, a saved camera or viewpoint, a feature, several features, or a bounding box). Identify (`identify(screenPoint)`), feature filters (`setFeatureFilter`), view padding, captures (`captureImage`, `captureViews`) and geocoding (`search(text)`, `reverseGeocode({ longitude, latitude })`, ready for a separate geocoder router) are engine methods too. Engine events (`map:click`, `map:ready`, `view:pointer-move`, `view:scale-change`, `view:stationary`, `layer:added`) carry plain data.
- `gisMapOnline.map` / `.view` and custom tools' `map`, `view` and `getLayers()` still hand out the SDK's own objects, now through the engine's `native()` escape hatch. The in-page API, map-v1 links, briefing, tour and field-task links and project files are unchanged.
- `tests/engine-boundary.test.mjs` fails when a module outside `js/engines/arcgis/` imports the SDK, reads a view or calls SDK layer methods. It checks the ArcGIS adapter against the renderer contract, the controller against the application facade, and engine selection through an injected factory. The complete Node suite is green, and browser checks cover shared tours, field-task framing and briefing PDF generation.

### Map assistant: chat with your map

- **Tools → Map assistant**: a chat with the AI model connected in Configure AI (local Ollama, OpenAI, Anthropic or an OpenAI-compatible endpoint) that builds **interactive maps, briefings, guided tours and field tasks**. Each action it takes shows in the conversation as it happens (with its arguments and result), Stop cancels a turn, and field tasks open as drafts to check before sharing. The composable "AI Map Assistant" panel is now the same chat.
- **Instructions without registration**: the app writes the model's system message itself on every turn: how to work from data (inspect fields first, exclude sentinel codes, take names, places and IDs from the data, never invent URLs or numbers), the map, briefing, tour and task formats, and the live map state.
- **17 tools** (`js/map-assistant.js`) over the in-page API: map state, inspect a source, search the curated datasets, query features (real names, IDs and coordinates), add/update/remove layers, suggest styles, set the view or basemap, load a whole map spec, create, generate or present a briefing, create a tour, draft a field task, and get a share link.
- **Native tool calling** for Ollama (`/api/chat`), OpenAI and OpenAI-compatible endpoints (Chat Completions) and Anthropic (Messages); a model that rejects tools is guided through fenced JSON tool calls instead, for the rest of the session.
- Tested with a local `qwen3.8:27b` through Ollama: a styled corn map (fields inspected, -1 excluded, automatic classes), a drafted briefing, a five-ballpark tour built from the layer's own names, coordinates and capacities, and a two-site field task with real object IDs.
- *Make a briefing from this view* now recognises styles that draw from an Arcade expression (those that exclude codes like -1), so their field drives the class and feature slides.
- Tours made from places can carry tilt and heading.

### Slide facts skip IDs and geometry measurements

- Feature slides no longer list a layer's IDs and geometry measurements by default (OBJECTID, GlobalID, Shape__Area, Shape__Length, SHAPE_Leng, PERIMETER and fields typed as IDs or geometry), whether the slides come from Make a briefing from this view or from adding included features. They stay in the "Facts to show" list to tick by hand. One rule, `isRoutineField` in `briefing-document.js`, decides for both.

### Philadelphia example

- The Philadelphia AI example now uses a nine-slide, two-layer briefing (police divisions with the districts drawn over them, dark 3D basemap), drafted in GIS Map Online with Make a briefing from this view. Its prompt asks a chatbot for the same briefing, and its agent recipe is one map-v1 spec with both layers and the slides (`map.json`). New link, QR code and files.

### Tour and field task examples; readable pages in light and dark mode

- **[A guided tour of eight classic ballparks](https://gismap.online/examples/tours/classic-ballparks/)**: a tour-only link and QR code that fly the 3D map from Fenway Park to Petco Park, with how to make it by hand, how to generate it from a briefing or a field task, and the tour link format for agents.
- **[A field task and its report, sent as two links](https://gismap.online/examples/field-tasks/opening-day-wayfinding/)**: a two-ballpark check sent as a link or QR code, and a sample completed report (check-in, steps, places, notes) that comes back the same way.
- Both are on the Examples page under "Guided tours and field tasks", in `llms.txt` and `llms-full.txt`, and in the sitemap (`scripts/workflow-examples.mjs`, `tests/workflow-examples.test.mjs`).
- **Content pages pass WCAG AA contrast in both themes.** Dark mode: secondary buttons ("All AI examples", "Browse datasets") had near-black text. Light mode: amber labels and grey text were too faint. Page text now lines up with the hero instead of sitting in a centred column.

### AI examples

- **[/examples/ai/](https://gismap.online/examples/ai/)**: worked examples of chatbots and AI agents making GIS Map Online maps and briefings, each with the prompt, the agent's code, the finished link, a QR code, the source files and what to check before sharing:
  - *A seven-slide briefing from one chatbot prompt*: Philadelphia police divisions, from a tested chatbot run (link, QR code and briefing JSON), plus the gismap-core recipe that rebuilds the same link.
  - *A two-layer briefing with spatial queries, built by an agent*: U.S. states with only the Major League ballparks each state contains, using slide layers, a 1-mile grow where the Ohio River is the state line, `method: "auto"` and cut transitions; the agent's check of each spatial answer is part of the example.
  - *A styled map in one link, written by a chatbot*: the readable corn-sales link with `exclude: [-1]` and `method: "auto"`.
- The examples page, `llms.txt`, `llms-full.txt`, the sitemap and `capabilities.json` link them. Generated from `scripts/ai-examples.mjs`; `tests/ai-examples.test.mjs` decodes every link against its committed files and runs the core recipes.
- **`#map=` links that carry briefing slides open presenting them**, as `#briefing=` links do (`mapSpec.load` from the API still stays quiet).
- **Fixed:** a slide's other layers now change alongside the camera move, so an interrupted or slow move no longer leaves the previous slide's layers showing.

### Briefing Features tab

- **Add included features as slides** right from the Features tab, as soon as features are included (or "Use all matching features" is on); the new slides open in the Slides tab. Features that already have a slide are not added twice.
- On desktop the Features tab is the same double-wide workspace as Slides: search, filters and selection tools on the left, the feature list on the right, so switching tabs keeps the panel's size and leaves room for more filters.

### Briefings: other layers on each slide (0.28.0)

- A briefing keeps one **main layer**, and every other loaded layer can now be part of its slides. Each map slide's details have an **Other layers** section: tick the layers to show with the main layer on that slide (unticked ones are hidden while it shows).
- **Show only related features.** On a slide about one feature, each other layer can be limited to the features with a spatial relationship to it, as the ArcGIS REST query defines them: intersects, contains (inside the feature), within (containing it), crosses, overlaps, touches, envelope intersects, index intersects, disjoint, or a DE-9IM relation; optionally after growing the feature by a distance (for example, everything within 2 miles). The layer's own service answers the query, so the result matches the REST API exactly.
- Slides store this as `layers: [{ layer, visible, relation }]` (service URLs, so it travels in briefing links, QR codes and Smart images); schema and types updated. Slides without it change no other layer, and the layers return to how they were when the presentation or PDF ends.
- Saved map views show their zoom and tilt rounded.

### Filter values

- The filter dialog's **Value** box lists the field's values as you type (a coded-value domain shows its names), so a filter can be built without knowing the data beforehand. Values come from the service's distinct values (up to 200, sorted), or a sample when the service cannot list them; a hint says how many there are.

### Briefings, Map Insight and filters (0.27.0)

- **Cut or pan between slides.** A briefing-level "Between slides" choice: *Pan and zoom* (the default) flies from one view to the next; *Cut* jumps straight there, for briefings whose slides are far apart. Stored as `transition: "cut"` in the briefing document (schema updated) and carried by briefing links, QR codes and Smart images; documents without it behave as before.
- **Map Insight** scrolls its title away with the attributes and keeps the feature tabs pinned at the top, so long attribute lists get the room.
- **Compound filters.** The layer filter dialog takes several conditions, combined with *all* (AND) or *any* (OR); each is parenthesised. Reopening the dialog shows the conditions as built.

### Briefing authoring layout

- Briefing authoring now uses a desktop two-pane layout with an independently scrollable slide outline and selected-slide settings, adds confirmed delete controls to every slide row, and removes the duplicate header QR action in favor of the existing Share & PDF workflow.
- Mobile Briefing cards now prompt people to “Tap the map to explore” for clearer map-first guidance.

### Briefing export fidelity (0.27.0)

- Briefing PDF captures now apply the same selected-feature highlight as the live slide before taking each map snapshot.
- PDF covers, workflow shares and client-API exports use one branded QR card renderer.
- Agents can call `briefing.exportQrCard()` to receive the green-band briefing QR as a PNG instead of rebuilding a bare QR code.

### Style options (0.26.0)

- **Suggested styles**, computed in the browser from a field's values: `renderers.suggest` in gismap-core (pure, so any wrapper can use it) and `layers.suggestStyles(id, { field })` in the page rank the styles that suit a field. Each option has a label, a plain-language reason, its class breaks, a `spec` that re-decides from the data and a `pinnedSpec` with fixed breaks. Skewed values (such as corn sales) get quantile classes, clustered values natural breaks, even spreads equal intervals; points get sized symbols, a coloured-point and a heat-map option; few whole-number values also get a categories option; values running from negative to positive get a diverging ramp. Sentinel codes stay out of the statistics. Also the `layer.suggestStyles` application tool.
- **Style panel: Style options.** "Suggest styles for this field" lists the options with their classes and colours; "Use this style" applies one.
- **`"method": "auto"`** and **`{ "type": "auto", "field": … }`** in RendererSpec, map-v1 and `?layer=` links (`method=auto`, `style=auto`): the app chooses when it draws the layer, so a chat-only model only has to name the field. The documented Corn example now uses `method: "auto"`.
- **Explicit `breaks`** (class upper bounds) on choropleth and graduated symbols, in specs and as `breaks=` in links: fixed classes that look the same whenever the map opens. Values beyond the first or last bound join the end classes.
- **Pinning:** when the app resolves an `auto` style it records the result with its breaks, so saved projects, map specs from `fromCurrent` and shared links show the same classes to everyone. Hand-written `auto` links re-decide each time they open.
- No server: everything runs in the browser.

### LLM discoverability

- **`/llms.txt`** ([llmstxt.org](https://llmstxt.org/) format) and **`/llms-full.txt`** (the agent guide, map-v1 and RendererSpec properties, URL parameters, error codes, the in-page and briefing API, and the catalog in one file), generated from `capabilities.json`, the schemas, `share.js` and `catalog.js`.
- **`/api/url-parameters.json`** and **`/api/catalog.json`**: every link parameter with types, values and examples, and the curated datasets with `?example=` and `?layer=` links. `capabilities.json` links all of them under `documentation`.
- **[Making maps with an AI agent](https://gismap.online/guides/ai-agents/)**: recipes for a chat-only model (a `#map=json:` link, with why Corn's `-1` is excluded), a code-running agent (`sources.inspect`, `mapSpec.validate`, `createLink`, and Python), a browser-automation agent, the error codes, and data caveats. The recipes run in the test suite.
- The app page links `/llms.txt`, `capabilities.json` and the guide from its head, and has a visually hidden "For AI agents and developers" section and a useful `noscript`. Example pages show a `?layer=` link and a minimal map spec. The sitemap lists the new files, and a Cloudflare `_headers` file serves them (and `/schemas/*`, `/js/*`) with `Access-Control-Allow-Origin: *`.
- `scripts/build-examples.mjs` now writes every generated file from `scripts/site-outputs.mjs` and `scripts/agent-docs.mjs`; CI runs it with `--check`.

### Map spec (0.25.0)

- **map-v1** (`schemas/map-v1.schema.json`): a whole map as one JSON object (title, basemap, skin, camera, up to 10 layers with filters and RendererSpec styles, legend, optional briefing), with a description on every property. It is the readable form of a `#map=` link: `#map=json:<URI-encoded JSON>` can be written by hand, even by a chat-only model (up to 8,192 characters, else `SPEC_TOO_LONG`); `#map=z…` is the same JSON compressed; `?spec=<https URL>` opens a hosted file. Older app `#map=` links still open and decode to map-v1.
- **`mapSpec`** in gismap-core (`validate`, `encode`, `decode`, `createLink`) for headless callers, and in the page (`load`, `fromCurrent`, `issues`). A spec opens with whatever is valid: a bad layer is skipped, a misspelled field keeps the service's own style with a did-you-mean, and every problem is listed in an issues panel and in `describe().state.issues`.
- **Simple styling in `?layer=` links**, index-aligned with each layer: `title`, `where`, `style` (service, simple, choropleth, graduated, categories, heatmap), `field`, `classes`, `ramp`, `exclude`, `color`, `opacity`. `?layer=` and `?example=` links now load through the map spec, the one path for links.
- Share map offers the map as a **Map spec (JSON)** file.

### Fixed

- Catalog examples whose renderers use the SDK's autocast form (such as the PM2.5 3D columns) lost their symbols when loaded from a link; they are now applied as written.

### Agent API (0.24.0)

- **`gisMapOnline.layers`**: `add(url, options)` resolves with a LayerInfo once the layer has loaded (same pipeline as "Add ArcGIS REST service" and `?layer=`), plus `list`, `get`, `update`, `remove`, `zoomTo`, `extent` and `metadata`. Options: `type`, `title`, `where` (read-only filter), `outFields`, `renderer`, `opacity`, `visible`, `ignoreServiceScaleRange`, `zoomTo`. `list()` holds data layers only; lookups match the id, the service URL with or without `/0`, or the title. Adds are all-or-nothing, and the 10-layer limit holds even for concurrent calls (`TOO_MANY_LAYERS`).
- **RendererSpec** (`schemas/renderer-v1.schema.json`): `service`, `simple`, `choropleth`, `graduated-symbols`, `categories`, `heatmap`, or raw `arcgis` JSON. Class breaks (natural breaks, quantile, equal interval) are computed from the layer's data with named ramps; `exclude` values and nulls draw grey as "No data" and stay out of the breaks. Field names are checked with a did-you-mean (`CORN_SALES` → `CORN_SALES_IN_DOLLARS`).
- **Application tools**: `layer.add`, `layer.remove`, `layer.update`, `layer.style`, `layer.filter` and `map.zoomToLayer`, with JSON Schema inputs, for `application.runTool` and listed in capabilities.json.
- **`briefing.load` is honest**: the `layerId` layer loads even with `activate: false`; `ready` resolves with `{ layers }` or rejects with `LAYER_LOAD_FAILED`; without the app it returns a warning instead of silently doing nothing.
- **Readiness and self-description**: `gisMapOnline.ready`, a `gismap:ready` window event and `<html data-gismap-state="loading|ready|error">`; `describe()` returns the capabilities plus live layers, basemap, camera, skin, mode and AI status; `camera.get/set/fitTo`.
- **`GisMapError`** with a code and an actionable hint across the public API: `INVALID_URL`, `HTTPS_REQUIRED`, `CREDENTIAL_IN_URL`, `UNSUPPORTED_LAYER_TYPE`, `TOO_MANY_LAYERS`, `LAYER_LOAD_FAILED`, `CORS_BLOCKED`, `SERVICE_ERROR`, `FIELD_NOT_FOUND`, `INVALID_SPEC`, `NOT_READY`, `NOT_FOUND`.
- **Data caveats**: `sources.inspect` adds the scale range, WGS84 extent, edit dates, feature count, statistics support and **sentinels** (codes such as -1 = "Not Disclosed", from the publisher's renderer and domains; sample-based guesses are flagged only). Statistics leave sentinels out and report `excluded`; choropleths exclude them by default; the AI context lists them as codes, not measurements.
- capabilities.json and gismap-core.d.ts describe the whole in-page API (`InPageApi`) with stability levels; `map`, `view` and `events` are experimental escape hatches. VERSION, capabilities.json and gismap-core share one version, checked by a test.

### Fixed

- Links with `?layer=` open zoomed to the data (its dense core when it spreads over half the world, such as U.S. counties with Alaska and Hawaii) instead of the whole globe. `zoom=none` keeps the starting view; `center=lon,lat` with `scale=` or `level=` sets one.
- The basemap a link asks for (`?basemap=`, `#map=`) is the one the scene starts with, so the default is never drawn and swapped mid-draw ("Could not draw Topographic: … hasLayerViewModule"). Errors from a replaced basemap's layers are not reported, and repeated layer errors show once.
- Layers hidden by the publisher's scale range say so in the Layers panel ("Hidden at this zoom (publisher limit 1:144,447)") with **Show anyway**, which is kept in the project and in share links. The Layers panel also shows when the source data was last edited.

### Changed

- Smart images no longer carry a QR card on the map; the picture stays clean, and its hidden project data opens it as before.
- Adding an ArcGIS REST or GeoJSON service by URL suggests a layer title from the service name (…/California_Historic_Fire_Perimeters/FeatureServer/0 → "California Historic Fire Perimeters"); a title typed by hand is kept.
- Every standard panel (Places, Bookmarks, Draw, Intelligence, Layers) has a dock button in its header that moves it into a right-panel tab; closing the tab puts it back. This replaces the "Open in right panel ↗" buttons in Draw and Intelligence. Panel hints ("Click the map", "Search", "1 loaded") now sit beside the title.
- New dock icons, a two-tone north-arrow needle aimed where the panel goes: into the right panel, back to the left, or out of its frame into a floating window. They replace the plain arrows on panel headers, the right-panel "open as modal" button, dialog docking and the presentation dock.
- The Briefing feature list folds like a door and, when open, fills the panel down to the footer with its own scroll (up to 400 features listed). The search Clear is now an inline ×, and Group by sits in the chip row, so the list starts higher.

- Share links carry a layer's style only when it was set in GISMap (or is small); a service's own style, which often embeds symbol images, loads with the layer anyway. A wildfire briefing link went from 11 KB to about 700 characters and fits a QR code again.
- The Briefing Features tab chooses features in more ways: **In view** lists only features in the map view (fetching ones beyond the first records loaded), **Pick on map** includes or removes features with a click, **+ Filter** adds attribute conditions (is, contains, ranges, has a value; value suggestions from the data), and **Group by** shows a field's values with counts: tap one to filter to it, or + to include the whole group. Include shown and Clear act on the list. Filters are saved with the project and the map follows them.

- Briefing share links open the briefing itself: the slides start presenting (16:9 stage on desktop, swipeable cards on phones) at the linked slide, instead of opening the authoring view. Links carry the layers with their styles and filters, the skin, basemap and view, and the slides, compressed into the URL fragment (`#briefing=…`, with `&slide=` for a deep link). Briefings too large for a QR code still share as a link, and as a briefing file that opens from `?briefing=<file URL>`. Slide features beyond the first 500 records are fetched by ID.
- Export is now **Share & export** (layer card Share button, Data and Project menus): share a styled map link and QR, make a map PDF, create a briefing, start a tour here, or export data. It warns when data filters are on, and that links, PDFs and briefings keep them.
- Skins carry into everything shared: PDFs (header, headings, tables, map frame), QR cards, and the skin travels in map and briefing links.
- Briefing records with no name-like field are labelled by ID and date (for example MODIS hotspots) instead of a shared one-letter code.

- Both PDF reports share one branded look: a header band with the mark on green (no white box), teal "GIS MAP" over gold "ONLINE", and the same framed map (green border, mark, title, date, legend).
- On desktop, Field tasks opens as a tab in the right panel instead of a separate overlay, so docking a share dialog (the ↗ button) adds a tab beside it rather than covering it.

### Added

- Pictures open maps: drop a QR card, a screenshot or a photo of a GIS Map QR code on the map, or choose **Open from a photo or QR code…** (Project menu, and **Open from a photo** on the phone's More screen, which offers the photo library and camera). Smart images still open their whole project; any other picture is searched for a QR code, decoded with the browser's BarcodeDetector or the vendored jsQR 1.4.0 (Apache-2.0), and a GIS Map Online link (the site, its preview builds or this host) opens here in its mode: map, briefing, tour, field task or location. Other links are not followed.

- One-click briefings from the map: **Share as a briefing** (Share & export) and **Make a briefing from this view** (Features and Slides tabs) build slides from the layer's style and filter and the Features-tab choices: a title slide describing the style and filter, key numbers for the styled field (scoped to the filters), counts per category or class, the chosen features or the top five by the styled number (with rank and share of total), and a sources slide. Share as a briefing goes straight to the share dialog.
- With AI configured, generated briefings get short descriptions for the opening and each feature slide (also **Describe with AI** on the Slides tab), grounded in the features' attributes and marked in the presenter notes for review.

- Briefing PDF handout: landscape, a cover with the slide list and a QR code back to the live briefing, then one page per slide laid out like the stage, with a map snapshot at each slide's view in the briefing's skin colours. Offered with the QR card from Share & PDF on the Slides tab.
- Map links (`#map=…`) open the map exactly as shared: layers, renderers, filters, opacity, basemap, camera and skin. Map PDFs show the current view framed in the skin, a layer key (style and filter), the centre coordinates and a QR code back to the live map.
- The tools work together: a styled layer becomes a briefing in one step (title and key-numbers slides, its style kept); briefing slides become a guided tour; a briefing feature can join the tour or become a field task (+ Tour, Task); briefing action items become a field task's steps; field tasks become a tour of their places, a briefing on their features (with the steps as an Actions slide), or a PDF map with its QR link; and field task links carry the styles of the layers their features come from.
- An installable web app manifest: installed GIS Map Online opens `.gmo`, `.gmop` and `.gmoatlas` files and shows its icon on them.
- Added GISMap Smart Images: Project downloads can now produce a polished PNG with a compressed, checksummed project manifest that reopens through the standard project importer. Smart images are framed in the project's skin, are offered in Share & export and beside the Map PDF when sharing a map, and open by dropping them on the map.
- Added a versioned client-side Briefing API, published JSON Schema and capabilities manifest, compressed briefing links, source inspection, and a browser-global agent interface. `briefing.createLink` returns the same full link the app shares (layers, styles, filters, skin, view) when the map has a web layer; `{ documentOnly: true }` gives a slides-only `#briefing=b1.…` link, which the app opens on the layers the URL loads (`?layer=`). Both link forms are read by one reader. A briefing document now names its data: `layerId` (best as the layer's service URL, which GISMap loads when missing) and `selection.ids`; the app writes both into the briefing it saves and generates. `?briefing=<file URL>` opens a briefing document written to the schema (alone or inside a project) as well as the app's own briefing file. The API adds `briefing.generate` and `briefing.exportPdf`; capabilities, types and schema are at 0.23.0.
- Briefing player: on desktop, slides play in a 16:9 frame over a full-screen live map (dimmed outside the frame, still pannable), with map slides showing the map in their own window. It has thumbnails, presenter notes, Reset slide, Restart, fullscreen, keyboard navigation, and `#slide=` deep links. On phones, each slide is a full-screen card that swipes vertically, with the map showing through its top; tapping the map enters exploration until Done, and long text folds behind More. Nothing a viewer does changes the saved briefing.
- Briefing slides (first slice): a Slides tab in the Briefing panel builds an ordered briefing from Title, Feature, Map and narrative, Key numbers, and Actions slides. Features become slides from the context panel (+ Slide) or all at once; slides can be reordered, duplicated, hidden and deleted, keep a saved map view or frame their feature, and Key numbers compute from the briefing data with optional filters, labelled as a sample when not all features are loaded. Preview presents the slides over the live map with keyboard navigation. The briefing is saved in the project under presentation.briefing (js/briefing-document.js).
- Field task PDFs include the task's link as a QR code and are clickable: the header opens the site, the map and QR open the task, and each coordinate opens it zoomed to that place (`at=lat,lon`) or attached feature (`feature=N`). Location Intelligence PDFs link their map and coordinates the same way.
- Links with `#at=lat,lon` open the map pinned and zoomed to that place; field task report links now also load the features' layers so they can be inspected.
- Field workers can check in from the completion screen: their position, accuracy, date and time, and the reverse-geocoded address are recorded. Task locations are reverse-geocoded on save with the same details as Location Intelligence. Both addresses and the check-in travel in the share links and appear in the CSV (new address and recorded_at columns) and PDF.
- The field task PDF adds a Task data table of the CSV rows and frames its map in the GIS Map Online brand (green border, mark, task name and date, legend), showing the task location, features and check-in.
- Opening a field task link pins its places on the map and zooms to them; an open task keeps its pins after you return to the map.
- Field tasks produce a branded PDF report (map snapshot with pinned task places, steps, features, instructions, report and photos) and a CSV. Both are offered when a task is sent back, beside the QR code, and from the received report; Share attaches the PDF where the device allows. Field workers can attach photos while completing a task.
- Field task, briefing and other workflow share dialogs now show the branded GIS Map Online QR card used for tours, with Download image and image-aware Share.
- On phones, the Field tasks screens put their main buttons (New field task; Save & share / Save draft / Cancel; Send back / Save / Back) in the same docked bar, within thumb reach.
- On phones, Briefing and Tours keep their main actions (Connect / Add file / Example, then Context; Present / Add / Share) in a full-width bar docked above the bottom navigation, the same slot the Map tools use. Their sheets open at half the screen and drag up to the top bar.
- Field tasks can be tied to a latitude and longitude alone (typed, the map center, or picked on the map); attached features are optional. Zooming to a task on a phone pins the task and shows your own position.
- "My location" now marks where you are with a dot that follows the device.
- Field tasks can be written with custom steps and up to five attached feature service features (location and object ID), then shared as a link or QR code. The recipient opens a Tasks to complete view, checks off steps and features, adds a report, and sends a return link; opening it on the assigning device records the report on the original task.
- Places keeps a list of recent places below the search box; picking a place clears the input.
- Added a desktop Workflows menu with Instant presentations, Briefing mode, Tours mode, Field tasks, and a return to the standard map; these entries left the Map menu.

### Fixed

- Zooming to an attached feature now requests it in WGS84, so services that use custom coordinate systems still zoom correctly.
- Field task maps with more than one place now frame all of them (a plain extent was ignored by the map).
- Updated five source-text tests that still described the earlier mobile layout, QR card and map-tools toggle.
- On phones, Briefing's feature list and feature context are folding sections inside the Briefing sheet instead of a panel floating over it; Context opens and scrolls to its section. Share QR no longer overlaps the panel button in the Briefing header.
- Removed the gap under the mobile Tours sheet, the floating Briefing Context button, and the Map tool sheet showing behind the floating tool row; the tool row now spans the screen and sheets sit flush on it.
- Data added from an empty Briefing now becomes its dataset right away.
- Zooming to a layer, feature, search result, or your location now frames it from directly above instead of tilting the camera toward the horizon.

## [0.18.2] - 2026-10-14

### Changed

- The Location Intelligence PDF and the field task PDF share one small PDF writer (js/pdf-document.js); map snapshots in the location report keep their proportions.
- Consolidated mobile workflows under the Tools menu, made workflow and tool selection mutually exclusive, and standardized mobile sheets at 40–60% of the viewport.
- Restored the legacy SVG icon set for mobile Map tools and fitted all five tools into a fixed, non-scrolling tray.
- Simplified the public mobile experience around Map, Briefing, Tours, and Field Tasks; Map-only tool shortcuts no longer appear on desktop or over non-map workflows.
- Replaced duplicated dashboard controls with quick Instant Presentations and a clearly gated, account-oriented Dashboard Builder placeholder.
- Unified presentation and builder skin choices through one catalog, and added QR sharing for Briefings and Field Tasks alongside Tours.

## [0.16.0] - 2026-10-09

### Added

- Added an optional versioned data-catalog manifest with stable relation names, source metadata, schemas, geometry and time roles.
- Added a local DuckDB-Wasm SQL panel that lazily loads browser feature records or HTTPS Parquet/JSON/CSV relations and permits only reviewed read-only queries.
- Added a plain-language query assistant that produces visible SQL plans and explicit, validated map-filter actions instead of executing model output directly.
- Added separate compact bottom navigation and resizable, tabbed bottom workspace layouts, plus persisted left, right, bottom, and recoverable floating-panel placement.
- Added the Tidal ’95, Portolan, Velvet Orbit, and Violet Circuit token-based application themes.
- Added an AI Map preset with a persistent dockable assistant, reviewed tool actions, progress, cancellation, and undoable map navigation.
- Added an optional full-globe layout that reuses the composable panels and collapses to standard drawers on small screens.

### Changed

- Application Builder gallery entries now report Ready, Conditional, or Added status; singleton and unavailable tools are disabled with a reason.
- Restyled panel instances and secondary actions so enabled controls no longer look disabled, and reorder arrows disable only at list boundaries.
- Layout and appearance changes now preserve the map, data, selection, analysis state, and AI conversation independently.

### Fixed

- Center the full Earth with a level camera when entering the globe layout and reverse the side-rail contours so their inner edges curve around the map.

## [0.15.40] - 2026-10-07

### Added

- Added the versioned composable application foundation: shared actions and state, validated tool and panel registries, constrained dock layout management, reusable presets, and lifecycle cleanup.
- Added Map → Customize application with reversible previews, reusable panel instances, dataset bindings, audience visibility, Edit/Present modes, and save-as-copy support.
- Added registered Attributes, Charts, Chapters, and AI Chatbot panels alongside migrated Places, Bookmarks, Draw, Intelligence, and Layers panels.
- Added branch-only development preview deployment and focused architecture tests.

### Changed

- Projects now persist a versioned `application` configuration and migrate older presentation settings without losing unknown panels or existing project content.

## [0.15.39] - 2026-10-07

### Added

- Rework Explorer around configurable title, metric, unit, timestamp, category, and source roles, with synchronized map filtering, explicit loaded/matching/selected counts, geographic scope, zoom-to-results, measurement styling, and concise location details.
- Add a linked numeric histogram and range filter, readable timestamp formatting, source links, missing-value treatment, and loaded-sample coverage notes.

### Changed

- Configure the PM2.5 example as an Explorer workflow using only the PM2.5 layer, mass concentration as its metric, provider as its categorical filter, and the publisher's `lastUpdated` field with an explicit source-data limitation.

## [0.15.38] - 2026-10-07

### Added

- Save an explicit Atlas camera snapshot for every new chapter, including center coordinates, zoom, heading, tilt, and camera position, while retaining support for older viewpoint-only chapters.
- Show the active Atlas chapter title and message over the map with previous and next chapter controls during manual navigation and story playback.

## [0.15.37] - 2026-10-07

### Fixed

- Dock dialogs through the existing workspace-panel host and suppress the delayed close event that previously moved them back out of the panel.
- Load the wildfire example from its two explicit feature-layer endpoints when root service discovery is temporarily unavailable.

### Added

- Show a live layer-card notice when a visible layer is outside its configured scale range, including whether to zoom in or out and the target scale.

## [0.15.36] - 2026-10-07

### Fixed

- Move docked dialogs into the actual application grid instead of a non-existent child, so the right panel receives the dialog rather than leaving a blank column.

## [0.15.35] - 2026-10-07

### Added

- Atlas chapters now retain the active basemap and restore it when selected.
- Atlas presentation includes a playable story sequence, with an editable one-to-120 second linger period for each chapter.

## [0.15.34] - 2026-10-07

### Fixed

- Reset browser dialog positioning when a dialog is docked so it remains a visible, stretched grid panel instead of disappearing outside the application layout.

## [0.15.33] - 2026-10-07

### Fixed

- Place docked dialogs inside the application grid rather than beside it, fixing the empty right column and invisible/unresponsive docked dialog.

## [0.15.32] - 2026-10-07

### Fixed

- Docked dialogs now occupy an application-grid column and resize the map instead of floating above it; compact layouts retain a practical side sheet.

## [0.15.31] - 2026-10-07

### Fixed

- Reopen docked dialogs as non-modal panels, leaving the map and the rest of the workspace interactive while a dialog is docked.

## [0.15.30] - 2026-10-07

### Fixed

- Made presentation dashboards exclusively own the sidebar, removed duplicate presentation banners, and debounced Explorer search rendering so typing retains input focus.

## [0.15.29] - 2026-10-07

### Added

- Added reciprocal dialog and workspace-panel controls: any app dialog can dock to the right edge, and the active right-panel tool can open in the modal shell without duplicating its content or event bindings.

## [0.15.28] - 2026-10-07

### Added

- Added interactive presentation dashboards backed by the selected project layer: Explorer has record search, categories, counts, result cards, map highlighting, and selected-record details; Briefing and Atlas now use the same record workflow with source details and setup states.

## [0.15.27] - 2026-10-07

### Fixed

- Make presentation previews visibly switch the active sidebar panels immediately and clearly label that Apply persists the selected template.

## [0.15.26] - 2026-10-07

### Fixed

- Replaced the transient map presentation banner with template-specific sidebar context, dismissed onboarding during presentation views, and reduced each template to its audience-facing tools.

## [0.15.25] - 2026-10-06

### Added

- Added project-persisted Briefing, Explorer, Atlas, and Standard presentation choices with scoped Clean Light, Dark Analytical, and Retro Print skins.

## [0.15.24] - 2026-10-06

### Fixed

- Fixed a duplicate symbology-editor variable declaration that prevented the UI module from loading.

## [0.15.23] - 2026-10-06

### Fixed

- Issued a synchronized client asset revision after the Markdown renderer update so the application entry point and UI module cannot be loaded from mismatched cached revisions.

## [0.15.22] - 2026-10-06

### Fixed

- Render Markdown tables as accessible tables in AI insights and convert them to labelled rows in Location Intelligence PDFs.
- Preserve common measurement units and punctuation in PDF reports rather than replacing them with question marks.

## [0.15.21] - 2026-10-06

### Fixed

- Updated the PM2.5 3D examples and the symbology editor to use the mass-concentration `value` field, with compact columns, realistic height scaling, and capped outliers.
- Prevented Object ID fields from being offered for numeric styling or extrusion, and limited field-style samples to 1,000 records to respect public service query limits.

## [0.15.20] - 2026-10-06

### Fixed

- Switched the OpenAI adapter from the legacy chat-completions route to the Responses API, added OpenAI connection testing, and report provider error details in the setup dialog.

## [0.15.19] - 2026-10-06

### Fixed

- Restore catalog and project renderers through the layer autocaster so 3D point-column examples load without a renderer deserialization error.

## [0.15.18] - 2026-10-06

### Added

- Added ready-to-open PM2.5 3D column examples, including a graduated concentration variant, and enabled 3D cylinder extrusion for point layers.

## [0.15.17] - 2026-10-06

### Added

- Added simple, categorized, and graduated field renderers. Field styles sample the records matching the active layer filter and are stored with the project.
- Added polygon 3D extrusion from either a fixed height or a numeric attribute field.

## [0.15.16] - 2026-10-05

### Changed

- Store renderer JSON with each layer configuration and automatically persist symbology edits for projects already saved locally. Project-file and package exports include the same renderer state.

## [0.15.15] - 2026-10-05

### Added

- Added a 0–100% fill-opacity slider to polygon layer styling.

## [0.15.14] - 2026-10-05

### Added

- Added a polygon Style option for no fill, leaving only the configurable outline visible for boundary layers.

## [0.15.13] - 2026-10-05

### Fixed

- Format ArcGIS date fields as localized dates in Map Insight and attribute tables instead of raw epoch values.
- Preserve the current camera when adding data to an established view; only a fresh, globe-level view may receive an initial layer zoom.
- Reject near-global layer extents during Zoom, preventing broad or wrapped service extents from sending the camera across the world.

## [0.15.12] - 2026-09-11

### Changed

- Expanded the active mobile Places panel and made search suggestions part of the scrollable touch area, with 48px search controls and result rows.

## [0.15.11] - 2026-09-10

### Changed

- Made the Bookmarks and Draw sidebar sections optional; add or remove either panel from the Map menu, with the preference saved in the browser.

## [0.15.10] - 2026-09-10

### Added

- Allowed Location Intelligence Report PDFs to be downloaded without AI-generated text, including clicked-location context, selected Map Insight attributes, and the live map snapshot.

### Changed

- Hide Map Insight AI controls, including feature selection and the AI action, whenever no AI provider is configured.

## [0.15.9] - 2026-09-09

### Added

- Added the GIS Map Online mark and a captured live-map snapshot to Location Intelligence Report PDFs.
- Added USA Wildfires as a featured public example, plus Recent Hurricanes, NDFD Daily Temperature, and Historical Quakes to Popular Data Services.

### Fixed

- Reported map extents now use geographic longitude and latitude instead of Web Mercator meters.

## [0.15.8] - 2026-09-09

### Added

- Added an Add all layers action to multi-layer ArcGIS Feature Service dialogs.
- Added a Location Intelligence Report PDF download with the clicked location, extent, date, and generated AI insight.

### Changed

- Empty AI questions now request a location-and-current-extent summary, and the Workspace Panel shows progress while the model is responding.

## [0.15.7] - 2026-09-09

### Fixed

- Restored a highly visible fading crosshair and pulse at the location of every map click.

## [0.15.6] - 2026-09-09

### Fixed

- Reserved phone map-canvas gestures for GIS navigation and blocked accidental browser pinch or double-tap page zooming over the map.

## [0.15.5] - 2026-09-09

### Fixed

- Restored the full-width mobile top dock for Map Insights and attribute tables, including the responsive rule that had been placing docked insights at the bottom.
- Kept the welcome panel available when opening a shared example, so its example picker remains accessible until dismissed or an explicit data action begins.
- Removed the NAIP imagery example from the public catalog and sitemap.

## [0.15.4] - 2026-09-09

### Added

- Added a Dock top layout choice for Map Insights and attribute tables. Phone viewports automatically use this full-width top dock without changing the saved desktop layout.

## [0.15.3] - 2026-09-09

### Fixed

- Made the mobile bottom toolbar an independent, fixed viewport element outside the sidebar and map containers, visible from initial load regardless of drawer state.

## [0.15.2] - 2026-09-09

### Fixed

- Replaced the mobile drawer with a permanently visible six-button toolbar. Each tool toggles compact content above the bar; Menu takes over the same area.
- Added consistent SVG icons for Menu, Places, Bookmarks, Draw, Layers, and Details, and removed mobile panel titles and workspace-launch controls.
- Added GIS Map Online branding to the welcome card on all screen sizes.

## [0.15.1] - 2026-09-09

### Changed

- Refined the phone layout around a persistent bottom toolbar with active Places, Saved, Draw, Layers, and XY content presented directly above it.
- Moved Map Insight to a resizable top dock occupying between one quarter and two fifths of the viewport, with feature tabs along the dock's lower edge.
- Replaced the floating mobile compass and menu with the GIS Map mark, moved the application menu into the bottom toolbar, and kept Project controls inside that menu.
- Constrained active mobile tool content to its drawer track so the persistent toolbar remains reachable at every supported phone height.

## [0.15.0] - 2026-09-09

### Added

- A map-first mobile shell with a translucent heading-aware compass, compact
  application-menu control, and a collapsible frosted map-navigation rail.
- A unified mobile tool drawer with horizontally scrollable Menu, Places,
  Saved, Draw, Layers, and AI controls.
- Pull gestures and compact/half/full drawer states for keeping the map visible
  while making a selected tool the only interactive panel on screen.

### Changed

- Removed the persistent mobile header and reclaimed its vertical space for the
  map.
- Mobile Workspace tools now open as a contained bottom sheet above the compact
  tool strip, and hidden drawer content is removed from keyboard and assistive-
  technology navigation.

## [0.14.0] - 2026-09-07

### Added

- A Map-menu Legend widget hosted in the resizable Workspace Panel.
- A right-panel Draw workspace with the existing point, line, polygon,
  rectangle, clear, and multi-format export actions.
- Persistent layer styling workspaces opened directly from each layer card.

### Changed

- Workspace tools now use independent, closable tabs, allowing the Basemap
  Gallery, Elevation Profile, Legend, Draw, Style, and Intelligence tools to
  remain open together without discarding one another's state.
- The left Draw panel is hidden while Draw is hosted in the Workspace Panel and
  restored when its workspace tab closes.
- The welcome card now dismisses when a layer is added or any Workspace Panel
  tool is opened, keeping it from covering active map content.
- At tablet widths, the welcome card now fits within the map area beside the
  open sidebar and uses stacked actions; on phones it waits until the overlaying
  sidebar is closed.

### Fixed

- Prevented the map workspace from collapsing into a zero-width grid column
  when the sidebar is closed at tablet-sized viewport widths.
- Prevented the sidebar and Workspace Panel from consuming the entire tablet
  viewport: they now share a vertically stacked rail when both are open, while
  Workspace becomes a bottom sheet when the sidebar is closed.

## [0.13.1] - 2026-09-06

### Added

- A dedicated AI connection guide for local Ollama, OpenAI, Anthropic Claude,
  and OpenAI-compatible API-key providers, including privacy, CORS, exact model
  tag, origin configuration, and troubleshooting guidance.
- A direct link to the guide from the Configure intelligence provider dialog.
- Zoom-to-feature navigation when a user activates a Map Insight result tab.

## [0.13.0] - 2026-09-06

### Added

- A tabbed, resizable right-panel Intelligence workspace that can remain open
  alongside the Basemap Gallery even when the main sidebar is collapsed.
- A one-click AI Insights action in Map Insight for analyzing the currently
  selected features and their location context.
- An explicit Clear insights control for AI responses.
- Per-tab close controls in the extensible Workspace Panel and a visible query
  label above each AI response. Automatic Map Insight analysis is labeled
  “Selected data query.”

### Changed

- AI responses now persist across ordinary map clicks and are replaced only
  when a new query begins or the user clears them.

### Fixed

- Routed every AI inquiry to the right Intelligence panel in top-navigation
  mode, preventing long responses from expanding the navigation workspace.
- Prevented duplicate Intelligence interfaces by hiding its navigation panel
  while the right-panel Intelligence workspace is open and restoring it when
  that workspace tab closes.

## [0.12.0] - 2026-09-06

### Added

- In-memory AI feature selection in Map Insight. The active result is included
  by default, additional result tabs can be accumulated, and each result has an
  explicit Include in AI control.
- Selected feature layer names, compact attributes, bounded geometries, clicked
  location, geocoder details, and an identified-feature summary in AI context.

### Security

- AI selections remain in page memory, reset on the next map identification,
  and are not persisted in projects or browser storage. Attribute and geometry
  limits bound the context sent to configured providers.

## [0.11.1] - 2026-09-06

### Changed

- Moved the Elevation Profile widget into the resizable right utility panel so
  it reduces the map viewport instead of covering navigation controls and map
  content; smaller screens use a contained panel overlay.

## [0.11.0] - 2026-09-06

### Added

- Breadcrumb navigation and `BreadcrumbList`/`WebPage` structured data across
  examples and guides, plus a dedicated guide index and stronger internal links.
- Consistent indexability, canonical, Open Graph, and Twitter metadata for every
  generated content page.
- Automated technical SEO checks for unique metadata, valid structured data,
  sitemap coverage, and resolvable internal links.

### Fixed

- Normalized Web Mercator ArcGIS geometries to EPSG:4326 during vector export,
  including defensive detection when a service omits spatial-reference metadata.

## [0.10.2] - 2026-09-06

### Fixed

- Removed persisted intro-card dismissal so a previous close in the same browser
  tab cannot make the card flash and automatically disappear after reload.

## [0.10.1] - 2026-09-06

### Fixed

- Kept the first-use introduction visible while projects, shared URLs, and
  operational layers initialize; it now closes only through its dismiss button
  or one of its own actions.

## [0.10.0] - 2026-09-06

### Added

- A searchable public GIS examples index generated from the in-app service
  catalog, with category, publisher, service-type, and keyword filtering.
- Curated dataset pages for USGS NAIP imagery, recent MODIS hotspots, PM2.5
  observations, and the USGS 30-day earthquake GeoJSON feed.
- Practical viewer guides for ArcGIS REST services, FeatureServers, MapServers,
  GeoJSON, and browser-based 3D GIS.
- Structured catalog metadata for stable slugs, categories, source pages,
  attribution guidance, tags, featured examples, and future validation dates.
- Build and CI checks that keep generated example pages and the sitemap aligned
  with `js/catalog.js`.
- Sanitized Markdown rendering for intelligence responses, including headings,
  lists, emphasis, links, quotations, and code.
- Search-focused homepage metadata, canonical and social-card tags, and truthful
  SoftwareApplication/WebApplication structured data.
- A compact first-use introduction with direct actions for ArcGIS REST, GeoJSON,
  local files, and curated examples.
- Public `robots.txt` and `sitemap.xml` discovery files.
- Safe shareable URLs for public remote layers, catalog examples, and the active
  basemap, including automatic loading when a recipient opens the link.
- A Project menu action that copies the current map's share link.

### Changed

- Intelligence answers can supplement map evidence with clearly distinguished
  general model knowledge and now receive detailed reverse-geocoder attributes.

### Security

- Share links reject non-web URL schemes, embedded usernames and passwords, and
  common token, API-key, and credential query parameters. Local files are never
  included.

### Fixed

- Restored full-height sidebar scrolling for long layer lists and added subtle,
  theme-aware scrollbar styling.
- Suppressed expected ArcGIS camera-animation aborts when consecutive navigation
  controls replace an in-progress movement.
- Added a dismiss control to the first-use introduction and retained the choice
  for the current browser tab.
- Prevented the optional GIS Server Directory URL field from invoking browser
  validation and trapping users when the Popular Data Services dialog is closed.

## [0.9.0] - 2026-09-04

### Added

- Browser-based GeoJSON downloads for queryable vector layers.
- Filtered-layer, current-map-extent, and entire-source export scopes.
- Paginated feature retrieval with visible progress and cancellation.
- Background Web Worker conversion and packaging to keep the map responsive.
- EPSG:4326 geometry normalization, including multipart lines and polygons.
- USGS NAIP Plus imagery in the Popular data services catalog.
- Recent MODIS hotspots, active hurricanes, PM2.5 observations, USGS seismic
  activity, NDFD wind gusts, and NDFD precipitation in Popular data services.
- A GIS Server Directory link and live ArcGIS server-endpoint browser in Popular
  data services, without copying or indexing the external directory.
- KML, KMZ, and zipped Shapefile downloads for queryable vector layers.
- GeoJSON, KML, KMZ, and zipped Shapefile export for user-drawn points, lines,
  polygons, and rectangles, including an optional current-extent scope.

### Changed

- Separated Bookmarks from Places into its own top-level workspace panel.
- Removed the Places Search/Bookmarks switcher so place search remains directly
  accessible in every navigation layout.
- Added Bookmarks to the compact mobile panel navigation.

### Fixed

- Prevented Popular Data Service buttons from submitting the unrelated GIS
  Server Directory URL field.
- Added FeatureServer-root discovery so multi-layer ArcGIS services open a layer
  picker instead of failing when treated as an individual feature layer.
- Preserved ArcGIS geometry types when SDK `toJSON()` output omits the type,
  preventing valid features from failing export as unknown geometry.
- Versioned nested catalog and export-worker modules so deployments do not retain
  stale data or conversion code from the browser cache.
- Prevented place-search suggestions from being clipped by the inline panel in
  wide top-navigation mode.

## [0.8.0] - 2026-09-04

### Added

- Adaptive side-panel and top-navigation workspace layouts.
- System, light, and dark appearance modes with an optional matching dark basemap.
- Dockable, resizable Map Insight and attribute-table dashboard panels.
- A reusable, resizable utility panel for the 3D basemap gallery.
- Configurable feature highlighting, click-cross feedback, and highlight colors.
- ArcGIS Online and Enterprise Portal OAuth connections, standalone Server token
  and web-tier connections, federation discovery, and connection diagnostics.
- WFS 2.0 service loading with GeoJSON output and retained custom parameters.
- Layer filters for ArcGIS feature services and GeoJSON feeds.
- Search-as-you-type place suggestions.

### Changed

- Consolidated Project, Data, Map, and Tools into a compact menu in top-navigation
  mode.
- ArcGIS query URLs now retain `where` and `outFields` parameters while using the
  native layer endpoint.
- Map Insight and attribute tables share the same layout and docking preferences.

### Fixed

- Corrected spatial-reference handling and extent calculation for ArcGIS features.
- Corrected zoom-to-feature behavior from attribute-table rows.
- Removed stale attribute-table content when its source layer is removed.
- Prevented search suggestions from remaining open after selection.
- Reduced map and panel flicker during feature identification.

[Unreleased]: https://github.com/geolibrerian/gismap/compare/v0.18.2...HEAD
[0.18.2]: https://github.com/geolibrerian/gismap/compare/v0.16.0...v0.18.2
[0.16.0]: https://github.com/geolibrerian/gismap/compare/v0.15.40...v0.16.0
[0.15.40]: https://github.com/geolibrerian/gismap/compare/v0.15.39...v0.15.40
[0.15.39]: https://github.com/geolibrerian/gismap/compare/v0.15.38...v0.15.39
[0.15.38]: https://github.com/geolibrerian/gismap/compare/v0.15.37...v0.15.38
[0.15.37]: https://github.com/geolibrerian/gismap/compare/v0.15.36...v0.15.37
[0.15.36]: https://github.com/geolibrerian/gismap/compare/v0.15.35...v0.15.36
[0.15.35]: https://github.com/geolibrerian/gismap/compare/v0.15.34...v0.15.35
[0.15.34]: https://github.com/geolibrerian/gismap/compare/v0.15.33...v0.15.34
[0.15.33]: https://github.com/geolibrerian/gismap/compare/v0.15.32...v0.15.33
[0.15.32]: https://github.com/geolibrerian/gismap/compare/v0.15.31...v0.15.32
[0.15.31]: https://github.com/geolibrerian/gismap/compare/v0.15.30...v0.15.31
[0.15.30]: https://github.com/geolibrerian/gismap/compare/v0.15.29...v0.15.30
[0.15.29]: https://github.com/geolibrerian/gismap/compare/v0.15.28...v0.15.29
[0.15.28]: https://github.com/geolibrerian/gismap/compare/v0.15.27...v0.15.28
[0.15.27]: https://github.com/geolibrerian/gismap/compare/v0.15.26...v0.15.27
[0.15.26]: https://github.com/geolibrerian/gismap/compare/v0.15.25...v0.15.26
[0.15.25]: https://github.com/geolibrerian/gismap/compare/v0.15.24...v0.15.25
[0.15.24]: https://github.com/geolibrerian/gismap/compare/v0.15.23...v0.15.24
[0.15.23]: https://github.com/geolibrerian/gismap/compare/v0.15.22...v0.15.23
[0.15.22]: https://github.com/geolibrerian/gismap/compare/v0.15.21...v0.15.22
[0.15.21]: https://github.com/geolibrerian/gismap/compare/v0.15.20...v0.15.21
[0.15.20]: https://github.com/geolibrerian/gismap/compare/v0.15.19...v0.15.20
[0.15.19]: https://github.com/geolibrerian/gismap/compare/v0.15.18...v0.15.19
[0.15.18]: https://github.com/geolibrerian/gismap/compare/v0.15.17...v0.15.18
[0.15.17]: https://github.com/geolibrerian/gismap/compare/v0.15.16...v0.15.17
[0.15.16]: https://github.com/geolibrerian/gismap/compare/v0.15.15...v0.15.16
[0.15.15]: https://github.com/geolibrerian/gismap/compare/v0.15.14...v0.15.15
[0.15.14]: https://github.com/geolibrerian/gismap/compare/v0.15.13...v0.15.14
[0.15.13]: https://github.com/geolibrerian/gismap/compare/v0.15.12...v0.15.13
[0.15.12]: https://github.com/geolibrerian/gismap/compare/v0.15.11...v0.15.12
[0.15.11]: https://github.com/geolibrerian/gismap/compare/v0.15.10...v0.15.11
[0.15.10]: https://github.com/geolibrerian/gismap/compare/v0.15.9...v0.15.10
[0.15.9]: https://github.com/geolibrerian/gismap/compare/v0.15.8...v0.15.9
[0.15.8]: https://github.com/geolibrerian/gismap/compare/v0.15.7...v0.15.8
[0.15.7]: https://github.com/geolibrerian/gismap/compare/v0.15.6...v0.15.7
[0.15.6]: https://github.com/geolibrerian/gismap/compare/v0.15.5...v0.15.6
[0.15.5]: https://github.com/geolibrerian/gismap/compare/v0.15.4...v0.15.5
[0.15.4]: https://github.com/geolibrerian/gismap/compare/v0.15.3...v0.15.4
[0.15.3]: https://github.com/geolibrerian/gismap/compare/v0.15.2...v0.15.3
[0.15.2]: https://github.com/geolibrerian/gismap/compare/v0.15.1...v0.15.2
[0.15.1]: https://github.com/geolibrerian/gismap/compare/v0.15.0...v0.15.1
[0.15.0]: https://github.com/geolibrerian/gismap/compare/v0.14.0...v0.15.0
[0.14.0]: https://github.com/geolibrerian/gismap/compare/v0.13.1...v0.14.0
[0.13.1]: https://github.com/geolibrerian/gismap/compare/v0.13.0...v0.13.1
[0.13.0]: https://github.com/geolibrerian/gismap/compare/v0.12.0...v0.13.0
[0.12.0]: https://github.com/geolibrerian/gismap/compare/v0.11.1...v0.12.0
[0.11.1]: https://github.com/geolibrerian/gismap/compare/v0.11.0...v0.11.1
[0.11.0]: https://github.com/geolibrerian/gismap/compare/v0.10.2...v0.11.0
[0.10.2]: https://github.com/geolibrerian/gismap/compare/v0.10.1...v0.10.2
[0.10.1]: https://github.com/geolibrerian/gismap/compare/v0.10.0...v0.10.1
[0.10.0]: https://github.com/geolibrerian/gismap/compare/v0.9.0...v0.10.0
[0.9.0]: https://github.com/geolibrerian/gismap/compare/v0.8.0...v0.9.0
[0.8.0]: https://github.com/geolibrerian/gismap/releases/tag/v0.8.0
