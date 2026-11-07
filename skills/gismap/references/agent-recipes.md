# Eight composable agent recipes and current analysis workflows

Choose every recipe needed for the user's request, not just one. Use **discover → inspect → plan → validate → execute → verify → share**. Start the first step at [GISMap Online Discover](https://gismap.online/discover/) and [Discover Examples](https://gismap.online/discover/examples/) when a user needs a starting point or a public demonstration. Use the current [Map engines guide](https://gismap.online/discover/engines/) for engine-specific decisions, then inspect the source and actual fields before reusing an example. Inspect the [capabilities](https://gismap.online/api/capabilities.json), [manifest](https://gismap.online/api/manifest.json), schemas and current engine first. Static HTTP documents, declarative URLs, standalone JavaScript utilities and an active, authorized `gisMapOnline` browser session are different execution environments; none implies a hosted authoring API. Report unavailable capabilities rather than inventing an API or silently substituting an output. Each recipe is also published as JSON at `https://gismap.online/api/agent-recipes/<id>.json` with its steps, interfaces, verification, limitations and checked examples; the catalog is `https://gismap.online/api/agent-recipes/index.json`.

<a id="interactive-map"></a>

<a id="interactive-map"></a>

## interactive-map — filtered, styled interactive map

**Prompt:** “Map this data and color it by population.” **Inputs:** source URL or local file, intended geography, field, filter, renderer, basemap and desired outputs. Inspect source metadata and real field types and values, construct an attribute or supported spatial filter, select a compatible renderer, then build a [map-v1](https://gismap.online/schemas/map-v1.schema.json) specification. `sources.inspect`, `renderers.validate`, `mapSpec.validate`, and `mapSpec.createLink` are standalone utilities; `gisMapOnline.layers` and `mapSpec.load` need a running browser. `mapSpec.prepareVerification` reports offline checks, not a rendered map. Verify source, filter, features, renderer, camera and reopening. Return the actual link and disclose unperformed checks. PDF, QR and Smart Map PNG outputs depend on the applicable UI and export support; a PDF is static, and Smart Map PNG embeds configuration, not all remote data. Keep the original PNG because image processing may strip metadata. See the [corn map example](https://gismap.online/examples/ai/corn-sales-one-link/) and [map spec](map-spec.md).

<a id="interactive-briefing"></a>

### Refine an existing map

Do not stop at instructions if the requested style is supported. From a simple URL use `parseShareParameters` from `https://gismap.online/js/share.js` and `mapSpec.fromShareParameters`; for `#map=` use `mapSpec.decode`, including compressed payloads. In an authorized page, use `gisMapOnline.mapSpec.fromCurrent()`. If decoding is unavailable, request the original JSON or an uncompressed `#map=json:` link. Clone the base for each result, update only the requested renderer or filter, validate, and return each actual share URL. Preserve unrelated settings and disclose unperformed checks. The [California fire refinement example](https://gismap.online/examples/ai/california-fire-refinement/) includes both JSON specifications and URLs. Check categories and quantile classes against the loaded data; a numeric year slider is not specified in map-v1.

<a id="interactive-briefing"></a>

## interactive-briefing — map-based briefing

**Prompt:** “Create slides about these districts.” **Inputs:** primary layer, stable feature IDs or selection, slide order, supporting layers, narratives, and desired outputs. Use [briefing-v1](https://gismap.online/schemas/briefing-v1.schema.json) and the documented `briefing` and `mapSpec` namespaces. Validate slide references and verify each slide's camera, selection and narrative in the browser. Verify spatial relationships with an actual supported query; an overlay alone does not establish containment, and sample counts are not complete counts. Test desktop/mobile navigation and link reopening, and inspect any requested PDF. See the [Philadelphia briefing](https://gismap.online/examples/ai/philadelphia-police-divisions/) (boundaries, not crime counts), [ballparks spatial briefing](https://gismap.online/examples/ai/mlb-ballparks-by-state/) and [briefing reference](briefs.md).

<a id="geographic-tour"></a>

<a id="geographic-tour"></a>

## geographic-tour — ordered geographic tour

**Prompt:** “Show me these locations in sequence.” **Inputs:** title, ordered verified locations, descriptions, basemap and optional cameras or duration. Resolve ambiguous places, retain the user's order, and use the guided-tour workflow and its supported link format. A camera flyover is not road routing and does not establish travel time. Verify every stop, transition, basemap, progression and reopening. The [ballparks tour](https://gismap.online/examples/tours/classic-ballparks/) supplies an actual example and link recipe; camera-only tour links do not carry data layers. See [tours](tours.md).

<a id="field-tasks"></a>

<a id="field-tasks"></a>

## field-tasks — location-based fieldwork

**Prompt:** “Inspect this location and complete these tasks.” **Inputs:** verified location, task title, instructions, requested tasks and evidence. When five tasks are requested, retain all five; for larger requests preserve every task and report how batches relate. Use the existing Field Tasks workflow rather than inventing a batch or hosted authoring API. A task and its steps are not necessarily five independently persisted tasks; disclose model limits. Check the location and task/step content, mobile workflow and reopened assignment. A check-in, photo or returned report is participant evidence, not independently verified completion. The [opening-day assignment and sample report](https://gismap.online/examples/field-tasks/opening-day-wayfinding/) show the current link workflow; never present the sample as real completed work. See [field tasks](field-tasks.md).

<a id="3d-extrusion"></a>

<a id="3d-extrusion"></a>

## 3d-extrusion — 3D extruded map

**Prompt:** “Make the county heights represent acreage.” **Inputs:** polygon source, verified numeric field or fixed height, height scaling and units, colors, engine and 3D camera. Inspect geometry, field type, nulls, sentinels, negatives and outliers. Use only the actual engine's supported renderer and 3D settings; do not invent a portable field or assume source units are meters. Verify visible heights and camera in the selected engine, and test whether the shared artifact restores them. Clearly report unsupported settings or dropped height configuration. See [styling and 3D](map-styling.md) and the [3D strata example](https://gismap.online/examples/ai/3d-extrusion/).

<a id="spatial-3d-chart"></a>

<a id="spatial-3d-chart"></a>

## spatial-3d-chart — height, chronological strata and footprint stacks

**Prompt:** “Separate these overlapping fire perimeters by year and make a five-part 3D Brief.” **Inputs:** polygon source; verified group/time field; optional nonnegative magnitude field and scale; slot, gap and slab sizes; the MapLibre or ArcGIS engine; camera; and whether to create a Brief. Inspect real geometry, field types, nulls, sentinels and group cardinality first. Apply a `spatialChart` with `type: "spatial-3d-chart"` and one of `attribute-extrusion`, `temporal-strata`, `stacked-footprints`, or `exploded-timeline`. Keep actual elevation, display Z offset and extrusion thickness separate, and include the Z-axis meaning in the narrative and legend.

Use `geometry: { strategy: "source-footprints", aggregation: "none" }` for the current fast-display renderer. It preserves original polygons and draws them as derived extrusion layers on MapLibre, or on ArcGIS as polygon-3d extrude symbols (height from a size visual variable in meters, colour from the layer's classes or one colour per group, and each group's base from a `Decode()` elevation expression); it does not partition overlaps, calculate unique affected area, or make an event-area sum equivalent to a geographic union. Do not call this analytical cumulative stacking. Group fields with more than 40 distinct values are rejected, not truncated; filter or use a coarser field, and disclose when the source sample may omit groups. For a five-scene presentation, call the experimental in-page API only after the layer is loaded:

```js
await gisMapOnline.briefing.generateTemplate({
  template: "spatial-3d-chart",
  layerId: "your-loaded-layer-id",
  groupBy: "YEAR_",
  heightField: "GIS_ACRES",
  slotMeters: 400,
  gapMeters: 100,
  scale: 1,
  previewOnly: true
});
```

Review the preview, then repeat with `previewOnly: false`. Verify the flat overview, attribute height, equal chronological slots, footprint-stack display, Z legend, tilted cameras, source-event identify, saved project, shared link and restoration after the Brief closes. The current implementation is MapLibre polygon fast display; spatial columns, exact polygon-overlay partitions, gridded analytical aggregation, mobile performance tuning and ArcGIS/Cesium parity are not implemented.

<a id="lidar-and-3d-models"></a>

<a id="lidar-and-3d-models"></a>

## lidar-and-3d-models — point clouds and CAD in 3D

**Prompt:** “Show only vegetation and conductor wires from this LAZ file.” **Inputs:** an HTTPS (CORS-enabled) LAS, LAZ or XYZ file, or a glTF/GLB, OBJ or PLY model; the CRS when the file has none; ASPRS classes; colour mode; for models an anchor or the CRS of their coordinates. Add a layer with `"type": "pointcloud"` or `"type": "model"` and `scene3d` options to a map-v1 link, or call `layers.add(url, { type, scene3d })` in an open page. This uses the MapLibre engine with three.js on the flat map. Large clouds are thinned to `maxPoints`; COPC/EPT streaming, picking, clearance analysis and IFC/DWG are not available yet. See [3D data](3d-data.md).

<a id="vibe-map"></a>

<a id="vibe-map"></a>

## vibe-map — coordinated themed map

**Prompt:** “Make the map feel like Halloween in California.” **Inputs:** dataset, geography, subject, intended audience, desired mood, preferred colors and engine. Plan the application skin, basemap colors and data renderer separately, choose readable contrasting colors and distinguish user-provided or official colors from inspired ones. Apply only supported settings and warn if a basemap cannot be recolored. Verify text contrast, legend, rendered colors and persistence on reopening; do not promise that an arbitrary custom theme is portable. Consult [capabilities](https://gismap.online/api/capabilities.json) and [styling](map-styling.md).

## Compose recipes and report evidence

For “a 3D map of California grape production using autumn colors, a five-slide briefing and a QR code,” combine `interactive-map`, `3d-extrusion`, `vibe-map` and `interactive-briefing` in one consistent project. Inspect the real acreage fields and values, validate the map and briefing, apply only compatible engine and theme settings, build five slides, then generate the QR using a supported workflow. Reopen and check the map, heights, theme and slides and scan the QR where possible. A QR code may open the interactive artifact; it does not itself prove the artifact works. State any unsupported output or unavailable verification.

Use **prepared** for a constructed artifact, **validated** for accepted static checks, **loaded** for observed loaded layers, **rendered** for observed visual output, and **verified** only for the intended behavior and reopened artifact actually checked. Also report partial or failed outcomes, warnings, errors, missing capabilities and source provenance. Never claim a later stage solely because a URL was generated.

## Dashboard, charts and animation are composable workflows

The recipe catalog has eight stable artifact recipes. Use [Dashboard, charts & animation](dashboard-chart-animation.md) with any of them when the user asks to compare values, build an Instant Dashboard, place mini-charts on a map, or animate a time-aware layer. Start by inspecting actual fields and source coverage. A normal chart is not the same as the geographic `spatial-3d-chart` recipe: the former aggregates rows; the latter is a virtual-Z display of source footprints with its own limitations.
