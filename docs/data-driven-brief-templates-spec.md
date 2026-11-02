> **Implementation status:** Timeline supports integer-year and date fields, timezone-aware calendar boundaries, interval/cumulative/rolling/validity filters, single-slide and slide-series playback, sampled slide statistics, editable draft descriptions, and PDF export of selected or all frames. The preview can optionally query complete ArcGIS feature-service counts and numeric aggregates using the layer definition filter, with bounded concurrent queries, a short-lived cache, and a count chart. Preview source queries ignore feature selections and search filters; slide statistics and narration still use loaded, included features. Playback prefetch and complete-source slide statistics and charts remain planned. Grid Atlas supports rows/columns or an approximate slide target, traversal, WGS84 point/line/polygon intersections, deterministic single-cell assignment, sample-based empty-cell elimination, fitted slides, and a schematic locator. Counts use only loaded, included features; boundary touches count as intersections. Non-point features are assigned to their first intersecting cell in row-major order. A fourth 3D Spatial Chart template now creates five MapLibre polygon scenes and uses the same portable spatialChart state as the Style panel and map-v1. Its temporal and footprint modes preserve source geometry and render up to 40 derived strata; this is fast display, not exact intersection partitioning or unique-area aggregation. Fixed metric grids, spatial columns, exact overlay stacking, drawn areas, clipping, complete-source statistics, and regeneration remain planned. Live-service and browser verification are still needed. The experimental in-page generateTemplate API uses at most 500 queried features and reports completeness as unknown. It is not a hosted API. The proposed v2 structure is a future design, not a current contract.

# GISMap Online Briefs: Data-Driven Slide Templates

The next evolution of Briefs should be data-driven slide generation: instead of manually building every slide, the author selects a feature dataset, chooses a template, and GISMap Online generates an interactive presentation by dividing the data into meaningful subsets.

This introduces three powerful templates:

[What’s Behind California’s Surge of Large Fires? - NASA Science](https://images.openai.com/static-rsc-4/GOOZE8tb6HU1j4pY-aCtqhqqIIFzLHC_xuJwkf1f36JcLMkrt2Dz4Wky5W_2OAYKYdaPhRXRUpj5RBVI1MFBaFdEZ_Nodyi8JJ9UPOg3DSz14iqMPjUYhKx9U01Rj01xVFeXzQYNIn3w-7kLl-hPmUPntj4NekE0LeTf5tJkTMs?purpose=inline)

1\. Filter Series

Generate slides using different filters against the same feature layer: year, category, numeric ranges, ranked values, or user-defined SQL-like expressions.

[Visualizing a Fire as It Unfolds — Development Seed](https://images.openai.com/static-rsc-4/fOHz0D7bhLFRSF0gsizrLX0Bv0h8miKYixy3ctAmJJg1LqXtPPKCFZIJFyINGC_lMPKNygTKKcOpGXm-awOLFPHxUn5jUzysgRB78m48A72725MvLvRdls06hEI38XDt47qO0gVpvwmWko1BqVYktAwDQSO9nKoQpcoEsCkrSjo?purpose=inline)

2\. Timeline

Turn a temporal dataset into a playable animation, either within one interactive slide or across a sequence of slides.

[Sarasota County Enterprise GIS](https://images.openai.com/static-rsc-4/N-U16bAy5tVYYsUtMXW4YM3u7cH5bTcGrUeY13JVaONSo7tzvSOt9TJHHTXvaA0-PSSjyXisU8tsuxBXZeJO2fiR_BLTNrT368h3ow94CL1Ds1f9KPEeFyA0wEd2sXQBf5wWQgSDQmc0KuQ-02d2g4H9Hbl2NlvmMV7Wz3qYFSA?purpose=inline)

3\. Spatial Grid Atlas

Divide a feature dataset's geographic extent into grid cells and automatically create a slide for each cell, with an interactive map and optional statistics.

## 1. The shared architecture: Data-Driven Briefs

These should not be implemented as three independent tools. They are different applications of the same Slide Generator.

Feature Dataset

ArcGIS Feature Service · GeoJSON · SHP · KML · GeoParquet

Slide Generator

Discover fields · Define subsets · Calculate extents · Choose style

Filters

Attributes and values

Timeline

Date and time

Grid Atlas

Spatial cells

Generated Interactive Brief

Desktop deck · Mobile swipe feed · Share URL / QR · PDF

The critical design principle is that each slide references the same underlying layer, but has its own data selection, viewpoint, and presentation properties.

### Slide-specific properties

| Property    | Example                             |
| ----------- | ----------------------------------- |
| Layer       | CAL FIRE historic perimeters        |
| Filter      | `YEAR_ = 2020`                      |
| Time window | Jan–Dec 2020                        |
| Extent      | California or filtered features     |
| Camera      | Center, zoom, tilt, rotation        |
| Symbology   | Acreage graduated colors            |
| Narrative   | "2020 was an exceptional fire year" |
| Statistics  | Number of fires, total acres        |
| Playback    | Duration, transition, loop          |

This also means the author can regenerate a series when source data changes, without losing their custom-written narrative or styling.

## 2. Template A: Filter Series

Interactive concept: California fire perimeter brief

Illustrative synthetic data, not observed fire records

Filter Series

Slide 3 of 5

# California Fires — 2020

1,530K

Illustrative acreage

Filter expression: YEAR\_ = 2020

&#x20;Previous

Next&#x20;

### Filter generation modes

The user chooses a field and one of the following methods:

| Mode               | Example             | Generated slides                      |
| ------------------ | ------------------- | ------------------------------------- |
| Unique values      | `LAND_USE`          | Residential, industrial, agricultural |
| Numeric bands      | `POPULATION`        | 0–10K, 10K–50K, 50K+                  |
| Chronological      | `YEAR_`             | One slide per year                    |
| Top N              | `ACRES`             | Ten largest fires                     |
| Custom expressions | `STATUS = 'Active'` | Author-defined selections             |
| Quantiles          | Median income       | Five equal-count value bands          |

Numeric bands should support equal intervals, quantiles, natural breaks where supported, and manual ranges.

A particularly useful setting is Compare using identical map extents and symbology. This maintains visual consistency and makes differences across slides apparent.

Another option is "Zoom to filtered features," appropriate for categories distributed across different areas.

## 3. Template B: Timeline

The Timeline template extends the filter engine but introduces time-driven playback and transitions.

There should be two authoring modes.

Single-slide animation

One map, one timeline controller. The viewer presses Play and features appear, disappear, or accumulate as time progresses.

[Six ways to visualize change over time in web maps](https://images.openai.com/static-rsc-4/DiFx23pEVQ59HoVlamoRjovTHEmQzjWybU21ReAQmqFip41hVZPh-Nk5kT4H-9uc285jnLjy7-EcvchNONdBdPXKfaDhBAI31ehiRWkMmal6PVi5wiRrVKv0NeFS5vYT5WCB9LjFS-E-2SXdfg_7NtAsZyxUuCBirpPKDS9uKgE?purpose=inline)

Multi-slide timeline

Each time interval gets its own slide, map, statistics, and commentary. The viewer can advance manually or autoplay through slides.

[The Historical Borders Map That Makes Every Country Look Temporary](https://images.openai.com/static-rsc-4/RVOvC3OoEp5NKgVFtKIVKuFN3IVBEcUqbIRhy6TFuuMLRg2tqR-hkX08FQw0gSXsVl5zn-hZoHRFKvqP0Kpr54n_AKohivQheG9jYD1FFERtHzxK08Ycmb_hYZt2_I_yMD2qd30LRcHop4r5DBMqc2i_KlLPqS9bp4aIyY8kdKQ?purpose=inline)

### Interactive timeline prototype

Wildfire history

Timeline preview

# 2018

Cumulative through year

2015

2024

&#x20;Next frame

Cumulative

This preview is step-controlled; production playback would advance frames automatically at the selected speed.

### Timeline-specific capabilities

- Temporal field discovery: Date, timestamp, start/end date, integer year.
- Intervals: Days, weeks, months, quarters, years, custom intervals.
- Playback: Speed, pause, reverse, loop, scrub, and optionally dwell at important dates.
- Display modes: Current interval, cumulative to date, rolling window.
- Feature lifecycle: Display features based on event dates or start/end validity periods.
- Statistics: Live counts, totals, mean, min/max, and optional charts.
- Narration: Auto-generated draft descriptions using changes between intervals, which authors can edit.

The engine must distinguish events from enduring features. A point event from 2019 should not automatically appear as a persistent object in 2024 unless cumulative mode is selected.

For very large services, query only the necessary intervals and cache the results. Don't download the entire source unnecessarily.

## 4. Template C: Spatial Grid Atlas

This could become an especially useful tool for engineering, utilities, agriculture, environmental assessments, field operations, and insurance.

The author selects a dataset, chooses a grid, and generates an interactive map deck covering the entire area.

Grid Atlas Preview

3 × 3 grid, illustrative feature counts

9 slides

All cellsNonempty only

Cell A

Cell B

Cell C

Cell D

Cell E

Cell F

Cell G

Cell H

Cell I

Slide: Cell E

Feature count: 8 · View extent: selected grid cell

### Grid construction

Support three choices initially:

1. Rows and columns: 3 × 3, 4 × 4, etc.
2. Fixed dimensions: 1 km, 5 km, 10 km grid squares.
3. Target slide count: Approximate 10, 20, or 50 spatial slides.

Later, add hexagons, administrative subdivisions, H3, or custom polygon index layers.

Essential options include:

- Grid based on dataset bounding box or a user-drawn area.
- Skip empty cells or generate all cells.
- Clip visible data to each cell, or show neighboring context.
- Choose whether intersecting features appear on multiple slides.
- Add a locator overview map with the active cell highlighted.
- Generate cell-specific feature counts and summary statistics.
- Define traversal order: row-major, column-major, snake, or optimized geographic progression.

Important: For metric grid dimensions, generate the grid in an appropriate projected coordinate system, rather than naively dividing longitude and latitude into equal-sized squares.

Also, avoid double-counting polygons that cross boundaries. Separate "features intersecting cell" from "features assigned to cell" in statistics, and make that rule explicit.

## 5. A unified Brief authoring interface

Instead of separate menus for every template, the authoring panel could offer a single creation workflow.

## Generate Brief

UI concept

Data layer

Template

Filter Series — One slide per data subset

Timeline — Playable temporal sequence

Grid Atlas — One slide per geographic cell

Filter fieldYEAR\_

Slide generation

Create a new slide for each distinct field value or numeric band.

Preview generated slides

Discover unique values, sample matching features, and estimate slide count.

Develop this template specification&#x20;

In the actual GISMap Online interface, the user should also be able to preview all generated slides before committing them. The preview should flag empty selections, excessive query counts, unsupported operators, or missing temporal values.

## 6. Codex implementation specification

### A. Extend the Brief schema

The existing Brief format should remain compatible with hand-authored slides. Add an optional `generator` object at the Brief level and `dataView` at the slide level.

```
{
  "schemaVersion": 2,
  "title": "California Wildfire History",
  "generator": {
    "type": "filter-series",
    "sourceLayerId": "fires",
    "field": "YEAR_",
    "method": "unique-values",
    "sort": "ascending",
    "cameraPolicy": "fixed",
    "stylePolicy": "shared",
    "refreshPolicy": "manual"
  },
  "slides": [
    {
      "id": "slide-2020",
      "title": "Fires in 2020",
      "dataView": {
        "layerId": "fires",
        "filter": {
          "operator": "eq",
          "field": "YEAR_",
          "value": 2020
        }
      },
      "camera": {
        "inherit": "brief-default"
      },
      "narrative": {
        "body": ""
      }
    }
  ]
}
```

The critical concepts are:

- Slides store a structured filter, not just a raw SQL string.
- Each slide can override map styling and camera independently.
- The generator retains enough information to reproduce the series.
- Manually edited titles, descriptions, and imagery survive regeneration.
- Shared links serialize the required presentation state.
- Existing Briefs without a `generator` continue working.

### B. Unified DataView executor

Create a common interface that resolves a slide into a map-ready selection.

```
resolveDataView({
  layer,
  filter,
  temporalWindow,
  spatialWindow,
  displayPolicy,
  statistics
});
```

Underlying execution may vary:

| Data source            | Preferred method                                                        |
| ---------------------- | ----------------------------------------------------------------------- |
| ArcGIS Feature Service | Server-side attribute/spatial query                                     |
| GeoJSON                | Client-side feature filtering                                           |
| Shapefile / KML        | Normalized client-side features                                         |
| GeoParquet             | DuckDB-Wasm SQL / spatial operations                                    |
| PMTiles vector source  | Render-time filtering where supported, with separate analytics strategy |

Build this as part of the existing unified data-query architecture rather than a second querying framework for Briefs.

ArcGIS SQL syntax, MapLibre filters, and DuckDB SQL are not identical; compile a structured filter into each adapter's supported syntax. Unsupported operations must be reported, not silently ignored.

### C. Timeline engine

Suggested API:

```
generateTimeline({
  layerId,
  timeField,
  start,
  end,
  interval,
  temporalMode: "interval",
  presentationMode: "single-slide",
  playback: {
    frameDurationMs: 1200,
    loop: true
  }
});
```

Supported temporal modes:

- `interval`
- `cumulative`
- `rolling`
- `validity-period`

Supported presentation modes:

- `single-slide`
- `slide-series`

Use half-open windows such as `date >= start AND date < end` to prevent overlap at time boundaries.

For interval windows, store times in UTC and apply the selected calendar timezone when constructing monthly or yearly frames.

### D. Spatial Grid engine

```
generateGridAtlas({
  layerId,
  extentSource: "layer",
  gridType: "rows-columns",
  rows: 4,
  columns: 4,
  skipEmpty: true,
  clipping: "intersects",
  cameraPolicy: "fit-cell",
  traversal: "row-major"
});
```

The grid generator needs to return:

- Cell identifier.
- Geographic polygon.
- Map extent.
- Intersecting feature count.
- Statistical summary.
- Corresponding slide identifier.

Use deterministic identifiers for generated cells, so regeneration can preserve authored annotations.

### E. Performance and sharing

For large datasets, build these capabilities into the common executor:

- Precalculate counts and statistics without transferring all geometries when the service supports aggregation.
- Cache repeated queries by source, filter, and extent.
- Prefetch nearby slides while a viewer advances.
- Cancel stale queries during rapid scrubbing.
- Limit generated slide counts with configurable warnings, rather than arbitrary silent truncation.
- Preserve source attribution, service URLs, and filter expressions in shared Brief manifests.
- Explicitly surface data-source errors and service authentication requirements.

For PDF output, render each selected frame as a static map image while retaining title, narrative, statistics, attribution, and a QR code linking to the interactive version.

For a timeline PDF, support exporting either selected keyframes or every interval, with a reasonable page-count preview.

## 7. Additional templates that naturally follow

Once the generator architecture is established, several more templates become inexpensive to implement.

| Future template      | Behavior                                                                    |
| -------------------- | --------------------------------------------------------------------------- |
| Top 10               | One slide per largest, highest, or most significant feature                 |
| Before / After       | Paired slides comparing different filters or time periods                   |
| Administrative Atlas | One slide per county, city, ZIP, or service territory                       |
| Compare              | Side-by-side or swipe comparison of two filtered views                      |
| Feature Tour         | One slide per selected feature, zoomed to its location                      |
| Change Detection     | Slides showing additions, removals, or attribute changes between periods    |
| Story by Attribute   | Group features by a chosen field, then generate a narrative slide per group |

These can all reuse the data selection, statistics, map state, and slide generation mechanisms.

## 8. Implementation priority

Phase 1 — Filter Series

Establish the `generator` and `dataView` schemas, structured filters, slide generation preview, and slide-specific map state. This is the foundation for the other templates.

Phase 2 — Timeline

Add temporal discovery, time windows, playback and scrubbing, cumulative display, and automatic slide generation.

Phase 3 — Grid Atlas

Implement spatial tessellation, intersection statistics, camera extents, empty-cell elimination, and overview locator maps.

Phase 4 — AI and API generation

Make every template accessible to external AI agents through a documented Brief-generation API.

## 9. The AI-agent opportunity

These templates are particularly compelling for the overall GISMap Online vision because an agent could interpret requests like:

> "Create an interactive briefing showing California fires between 2000 and 2025, one year per slide, with a timeline animation and the same map extent throughout."

Or:

> "Take this utility infrastructure layer, create a 5-kilometer grid atlas, generate one slide per occupied cell, summarize the infrastructure in each one, and create a QR code for the field team."

Or:

> "Build a briefing from this county demographic layer using five quantile classes, then make one slide for each population-density class."

The AI should generate the exact same template configuration used by the visual authoring interface. There should not be a separate implementation for agent-generated Briefs.

One further design recommendation: Make all three templates composable. A Grid Atlas could contain a Timeline for each cell. A Filter Series could contain an animated timeline for each category. That suggests a longer-term model where a Brief is a hierarchy of scenes and sequences, rather than strictly a flat list of slides.

For example, a wildfire Brief could have one chapter per decade, one slide per year, and a playable monthly timeline within selected years.

That is a meaningful differentiator for GISMap Online: the data itself determines the structure of the presentation, while the author or AI controls the story, styling, and level of detail.
