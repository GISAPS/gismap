# Charting Tools 2.0

**Tools → Chart tools** has family entries for Line & Area, Bar & Column,
Scatter & Bubble, Distribution & Composition, 3D Charts, Map Charts, and the
Custom Chart Builder. They all open the same layer-aware Chart Builder. The
builder starts with a visual, data-aware gallery, keeps the live preview in
view, and moves field and presentation controls into progressive sections.

The builder stores a portable GISMap Online chart definition, then translates that
definition to Apache ECharts only at render time. ECharts is lazy-loaded from
the pinned 5.5.1 CDN build; the builder retains a keyboard-accessible HTML bar
fallback if it cannot be loaded.

## Data contract

`js/charting-tools.js` owns the versioned chart model and aggregation output.
Definitions are stored at `project.charts`, never with copied source records:

```json
{
  "schemaVersion": 1,
  "id": "chart-id",
  "type": "bar",
  "chartType": "bar",
  "source": { "layerId": "stable-layer-id", "scope": "filtered" },
  "data": {
    "layerId": "stable-layer-id",
    "scope": "filtered",
    "groupBy": "YEAR_",
    "series": [{ "field": "GIS_ACRES", "aggregation": "sum" }]
  },
  "dimension": { "field": "YEAR_", "interpretation": "category" },
  "measure": { "field": "GIS_ACRES", "aggregation": "sum" },
  "presentation": {
    "target": "dashboard",
    "targets": ["panel", "dashboard"],
    "renderMode": "standard",
    "size": "regular"
  },
  "interaction": { "mapHighlight": true, "crossFilter": false }
}
```

The query adapter uses the map controller rather than an engine-specific
renderer. `filtered` uses the layer’s active canonical definition expression;
`all` ignores it, and `viewport` adds the current map extent. When an engine
reports a transfer limit, the chart is marked partial and is not presented as
a complete aggregate.

`type`/`source` remain for saved-project compatibility; `chartType`/`data`
are the portable aliases used by new integrations. Existing saved charts load
as panel-target charts without migration prompts.

## Destinations, interaction, and dashboard

Clicking a chart mark publishes a shared selection containing the matching
features and asks the active map engine to highlight the representative
feature. A chart can target a panel, Instant Dashboard, Map Charts, and/or a
Brief. Selecting Instant Dashboard creates the existing `charts` panel with
the same stored chart definition, so it remains bound to the map layer after a
map-engine switch or project reload. Map and Brief destinations serialize now
and are intentionally renderer-independent.

The current panel renderer supports bar, column, line, area, histogram,
scatter, bubble, box plot, donut, and KPI charts. It does not turn a chart
click into a permanent layer filter: selection and filtering remain separate
operations.

## Colours, categories and looks

`chart.style` holds presentation choices that never change the aggregate:

```json
{ "palette": "inherit", "theme": "auto", "topN": 12, "other": "group", "sort": "auto", "hidden": ["Unknown"] }
```

- **palette** `inherit` (default) reads the layer's renderer JSON, the same way
  the map legend does: a chart grouped by the styled category field takes the
  map's category colours (unstyled categories take the map's default colour);
  classed and colour-ramp styles colour each mark along that ramp; a single
  symbol, including a 3D extrusion, draws in its symbol colour. `theme` uses
  the interface skin and `neon` the futuristic palette.
- **topN** is how many categories show (`0` shows all, `null` the type's
  default); **other** `group` folds the rest into one clickable "Other" mark and
  `hide` leaves them out. **hidden** lists categories left out by name; the
  chart panel's Categories menu edits it and keeps every category listed.
- **sort** `auto` ranks named categories largest first and keeps years and
  other numeric categories in order.
- **theme** `futuristic` draws a neon HUD (gradient marks with a glow, a faint
  grid, monospace numerals); `auto` uses it under the Violet Circuit, Velvet
  Orbit and Wavelength skins. Instant Dashboards accept `chartTheme`.

The chart fills its panel, so resizing the bottom strip or Workspace pane
resizes the chart; horizontal bars keep a readable row height and scroll past
it. Dashboard charts show headline numbers (total, groups, leading group and
its share) and drop them when the panel is short.

## Map Charts subsystem and implementation phases

`js/map-chart-tools.js` defines a renderer-neutral Map Charts contract:
compact SVG bar, sparkline, and donut glyphs; point, line-midpoint, and
polygon anchors; and display plans for collision avoidance, clustering, and
progressive rendering. It does not mount overlays yet. The deferred adapter
phase will project those plans through MapLibre marker APIs and ArcGIS view
overlays, retain group-to-feature selection links, and use the same persisted
chart specification.

Geographic 3D remains separate from ordinary 3D charts. Existing Spatial
Charts and Cinematic work already run through the map-engine/Three.js path;
the 3D Chart Tools entry routes users to that engine-aware styling flow rather
than trying to make ECharts render geographic geometry. Conventional 3D panel
plots are a subsequent renderer phase.
