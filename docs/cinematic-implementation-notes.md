# Cinematic Mode implementation notes

## Architecture checkpoint — 2026-10-23

- Presentation modes are normalized in `js/project.js` and rendered by `UIController` in `js/ui.js`; the current mode list is template-based rather than a standalone registry.
- `js/animation-clock.js` already owns an engine-neutral requestAnimationFrame clock. Cinematic wraps it rather than allowing a renderer-specific clock.
- Both current renderers expose the same transient `setFeatureFilter()`/`getFeatureFilter()` contract through `MapController`. MapLibre filters loaded vector features; ArcGIS sets `LayerView.filter`. This is the Phase 1 rendering seam.
- Existing time code is briefing-specific (`js/briefing-timeline*.js`) and produces slides. It is not reused for cinematic playback because Cinematic needs timestamped observation steps, not generated intervals.
- Projects persist `presentation` via `ProjectManager`; the initial cinematic spec is deliberately separate and versioned under `presentation.cinematic` in the next UI integration step. It references existing layer IDs and does not duplicate layer bytes.

## Chosen first slice

`js/cinematic/temporal-adapter.js` validates explicit time-field selection and creates a bounded normalized observation model from queried features. It declines numeric-year inference and rows without valid time or stable identity. `timeline-controller.js` maps a shared clock over the observed range. `mode.js` applies only transient object-ID filters, restoring the prior filter on destroy. Polygon snapshots step between observed states; no geometry interpolation is performed.

Playback advances uniformly between observation indexes instead of mapping animation velocity directly to calendar time. This prevents clusters of closely timestamped records from flashing by after a long quiet interval. The initial UI uses a 120-second base duration at the saved **Slow** rate (0.25×); authors can change speed during playback. The time label reserves two lines and uses tabular numerals, so a wrapped date cannot move the controls.

The **Cumulative** display mode explicitly retains all observed records from the first timestamp through the active timestamp. It remains a display choice—not an assertion that individual phenomena persisted or that any geometry was interpolated—and its label states that distinction.

## Optional Three.js visual effects

MapLibre can opt into a decorative effect per cinematic layer (`animation.effect.type`): `glow`, `fire` (flame curtain, burning edge and embers), `pulse` (seismic rings sized by a magnitude field), `wind` (streaks blowing along a direction field, faster with a speed field), `water` (moving caustics inside polygons) and `flow` (comets travelling along lines). `auto` picks one from the layer title, geometry and fields; v0.1 specs with `outline.glow: true` load as `glow`. The catalogue and geometry live in `js/cinematic/cinematic-effects.js`; the shaders in `js/cinematic/effects-three.js`.

Effects never change observed geometry: every vertex sits on an exact source coordinate, and widths, heights and motion are applied on the GPU in screen pixels (so a glow is the same width at any zoom). Features first observed at the current tick are flagged `fresh` and flare as they appear; older ones in a build-up settle. Motion reads one continuous clock, so stepping observations never restarts an animation, and `prefers-reduced-motion` freezes it.

On terrain, heights are sampled per vertex rather than once per effect (the v0.1 glow used the first vertex's height for the whole outline, which floated or sank the rest and drew the offset "halo"). A terrain lookup costs about 20 µs, so at most ~5,000 are taken per geometry and heights between samples are interpolated along the path; they refresh while terrain tiles load and after zoom-level changes. Budgets: 2,500 paths / 150,000 vertices / 8,000 points per snapshot. Items are disposed whenever a snapshot is replaced or Cinematic Mode exits. ArcGIS keeps the same feature-filter playback without an effect.

## Strata timeline

`strata` is a native effect (plain MapLibre `fill-extrusion` layers) offered only in Cinematic mode (`cinematicOnly` in the catalogue), because it needs a timeline. `strataData()` in `js/cinematic/cinematic-effects.js` builds one GeoJSON source from every observation of the track, keyed by the observation's `index`. When the layer has a stacked 3D chart (`temporal-strata`, `stacked-footprints` or `exploded-timeline`), the chart's groups, slot separation, gap, thickness field and colours decide each slab, so playback matches the static Style-panel view. Otherwise each playback tick gets a slot, binned to at most 40 and earliest lowest. Records whose group value is not one of the chart's groups are not stacked; their outlines still show.

The source is built once per track. Each step only changes two filters: settled slabs, and the step's new slabs, which fall about four slots onto the stack and fade in over 1.2 s on the effects clock. A paused effects clock or reduced motion shows them already landed. While the effect draws, the engine hides the layer's own chart and fill (`record.strataEffect`) so slabs are not drawn twice; outlines stay as ground footprints, and clearing the effect gives the chart back. Choosing Strata timeline switches the scene to Build up (cumulative), since the stack is the build-up.

