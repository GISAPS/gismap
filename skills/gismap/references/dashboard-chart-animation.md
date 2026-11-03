# Dashboard, charts & animation

## Instant Dashboard

An Instant Dashboard is a configured map workspace: a public data layer, one or more linked chart panels, a selected interface skin and a readable basemap. In an active assistant session, use `create_instant_dashboard` after inspecting the target layer. It selects a data-aware count/sum chart, applies the requested skin and basemap, and makes a linked chart panel. Each chart mark selects and filters the matching map features; use **Show all map data** to clear the chart's filter.

Before creating one, inspect the layer's real geometry, field types, domain values, nulls/sentinels, service filter and record coverage. Choose a categorical or temporal field for grouping and a numeric field for sum/average/min/max. Use a count when no valid numeric measure exists. A dense layer benefits from a quiet high-contrast basemap; a `skin` basemap follows the skin palette on MapLibre but never replaces a layer renderer. Keep the data renderer legible and preserve official category colours where they carry meaning.

The standard Chart Builder also supports bar, column, line, area, histogram, scatter, bubble, box, donut, metric, conventional 3D bar/scatter and map-chart presets. Its destinations are Chart panel, Instant Dashboard, On the map and Brief slide. Map charts need suitable feature geometry and can use compact SVG or engine-backed displays; they are not automatically analytical spatial aggregation. The chart preview works from the selected data scope (`filtered`, `all`, `viewport` or `selected`) and may use a bounded browser query; label sample/partial coverage rather than presenting it as a complete-source statistic.

### Verification

1. Open the saved chart panel at its chosen placement and confirm title, field aliases, aggregation and source scope.
2. Click or keyboard-activate a bar, donut segment or other grouped mark. Confirm that the map shows the matching features and reports the linked selection/filter.
3. Clear the chart filter and confirm that the layer returns to its prior visible data.
4. Reopen the project/share URL and verify skin, basemap, chart panel and no-data behavior.

### Charts in a map link

A map-v1 link carries chart panels in its top-level `charts` list (see [map-spec.md](map-spec.md)): type, dimension, measure, the layer by position or URL, `style` (palette, theme, topN, other, hidden) and placement (`right` or `bottom`). Opening the link adds each chart beside the map, linked to its layer, without changing the sidebar. In a running page `gisMapOnline.mapSpec.fromCurrent()` writes open chart panels back into `charts`, and `mapSpec.createLink` turns them into a link. Example: https://gismap.online/examples/ai/wildfires-by-state-chart/.

The link does not carry other application panels, floating positions or pixel sizes, or the skin an Instant Dashboard picked unless `skin` is set in the spec; the app's Share menu link carries no charts. Reopen the link and check every chart before calling a dashboard shared.

## Cinematic animation

Cinematic mode is for **observed records or explicit numeric scenarios**. It does not model unobserved movement, fire spread, routing or causality. Begin with a loaded layer that has a confirmed date/time or numeric field. Choose the intended time range, then use the controls to play/pause, move to the previous/next observation, scrub, set a range, focus the current observation, adjust speed, choose instant versus cumulative build-up, and optionally constrain playback to the current map window.

The visual effect is decorative annotation on the source layer. Use an effect that helps the reader understand the subject (for example, a restrained fire/heat treatment for real incident points or perimeter boundaries), inspect it at local scale and reduce its detail or opacity for dense nationwide data. Effects have their own pause/speed controls, separate from time playback. Never use animation to imply values or locations that the data does not contain; say when the effect is ambient or purely visual.

`Explore` is for browsing, `Investigate` surfaces observed evidence, and `Present` enables clips, poster PNG, adding a clip to a Brief and browser-based movie export. A saved Clip records a chosen range and presentation settings; it is not a new dataset. Review every frame range, label temporal semantics, test reduced-motion behavior and disclose that large effects may be automatically simplified for performance. Animated effects are primarily a MapLibre capability; another engine may show the underlying data without the effect.

### Animation checklist

1. Confirm the time/numeric field and its units/time zone from source metadata.
2. Use actual source timestamps and distinguish instant, cumulative, rolling or scenario semantics in narration.
3. Preview at a local and overview scale; tune effect, quality, opacity and map terrain without hiding the base data.
4. Pause or remove the effect before removing a layer. Verify the layer no longer has an active effect and that no derived/ghost overlay remains.
5. Reopen the project and test playback, focus, clipping/export and any share flow before calling the result verified.
