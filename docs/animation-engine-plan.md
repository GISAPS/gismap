> **Status:** Plan, 2026-10-20; updated 2026-10-21. Built so far: the GISMap-owned clock (`js/animation-clock.js`), the MapLibre + three.js host (`js/engines/three/three-host.js`) with a per-layer `update(time)` hook, and one clock-driven effect (point-cloud reveal). The rest of this document is not implemented. Do not advertise any field, template or capability below in `skills/`, `llms*.txt` or `api/` until it ships with tests (see SPEC §9.9 in the data-driven briefs agent pack).

# GISMap Online Animation Engine — next phase plan

Goal: FireTrace-style cinematic stories (3D terrain, a growing glowing perimeter, a synchronized chart, a moving camera, pause-and-inspect) as a **reusable data-driven Brief capability**, not a wildfire one-off. The animation runs deterministically from geographic data. AI chooses the storytelling settings; it never draws the data.

## 1. Decision: MapLibre + three.js first, ArcGIS second, Cesium later

| | MapLibre + three.js | ArcGIS Maps SDK 5.0 (SceneView) |
|---|---|---|
| Already in GISMap Online | Default engine; keyless terrain (`terrain.js`, Mapterhorn DEM); `buildings-3d` exists only here; `spatial-chart-3d` as derived extrusion layers | Full engine adapter; `spatial-chart-3d` as SceneView extrude symbols (since 2026-10-21) |
| Time | No native model; we own the clock (we want that anyway) | Native `timeExtent` and `FeatureFilter.timeExtent` |
| Custom effects | Custom layer shares MapLibre's WebGL context; three.js renders into it | `RenderNode` (replaces the external renderer); heavier and less documented |
| Camera | `flyTo`/`easeTo`/`FreeCameraOptions`; orbit by bearing | `view.goTo(Camera)`, very good |
| Cost/keys | None | None for open layers; some basemaps/elevation have terms |

**Recommendation:** build the engine-neutral clock and the first template on MapLibre with native layers, add three.js only for effects native layers cannot do, and then write an ArcGIS adapter that maps the same animation spec to `timeExtent` and `goTo`. Defer deck.gl (MapLibre's `line-gradient` + `line-progress` covers trails for now) and Cesium (revisit only if photorealistic 3D Tiles become a requirement; Google's tiles need a key and attribution, which conflicts with keyless share links).

## 2. What exists to build on (from the branch audit)

- `BriefingPlayer` already has timeline playback: play/pause, scrub, speed, reverse, loop, per-frame `dwellMs` (`js/briefing-player.js`). It steps **discrete** frames with `setTimeout` and swaps a structured filter per frame through `setFeatureFilter`.
- Slide-level `timeline.frames[]` with portable filters, `generatedBy`, and PDF keyframe export (`briefing-timeline-pdf.js`).
- Half-open, timezone-aware frame construction (`briefing-timeline-dates.js`), DST tested.
- Portable per-slide `spatialChart` that is applied on enter and restored on exit (`briefing-slides.js` `#applySlideLayersNow`).
- `prefers-reduced-motion` checks exist in tours and the atlas.
- Engine capability matrix and `METHOD_CAPABILITIES` gating (`engine-interface.js`).

Issues to settle **before** building on top:
1. Date-only values stored at UTC midnight (CAL FIRE `ALARM_DATE` is 100% 00:00 UTC) shift day-1 events into the previous frame under a local timezone. This branch now warns; the animation clock should go further, with a `dateSemantics: "instant" | "civil-date"` option on the time config.
2. MapLibre playback filters **loaded** features, and service loads are capped (`truncated`). Animation must load the whole time range once (or tile it) and fail visibly when truncated, not animate a partial history.
3. ~~ArcGIS shows nothing for `spatialChart` slides.~~ Done 2026-10-21: ArcGIS draws them with extrude symbols (`js/spatial-chart-arcgis.js`).

## 3. Architecture

```
Animation spec (slide.animation, JSON, agent-writable)
        │
AnimationClock  (pure module, GISMap-owned: t, play/pause/seek/speed/loop/reverse, reduced-motion step mode)
        │ onTick(t)                         ▲ events: pause-at, chart cursor, narrative
Engine animation adapter (capability "animation")
   ├─ MapLibre native: time-filtered + glow line layers, camera keyframes
   ├─ MapLibre + three.js: custom layer (particles, embers, smoke, flow arrows)   capability "animation-effects"
   └─ ArcGIS: view.timeExtent / FeatureFilter.timeExtent, view.goTo keyframes      (RenderNode effects later)
```

- **The clock is not in any engine.** The adapter only receives `applyAnimationFrame(uid, { t, progress, camera })`. The same spec means the same thing on every engine; unsupported parts are reported, not dropped silently.
- The current discrete timeline becomes a special case: `interpolation: "none"` with one keyframe per frame. `BriefingPlayer` drives `AnimationClock` instead of its own `setTimeout` loop, so existing timeline Briefs keep working.
- **Continuous time on MapLibre without per-frame re-filtering:** load features once with a numeric `__t` (ms) property, then update paint expressions each tick (`["case", ["<=", ["get","__t"], T], visible, hidden]`) with `setPaintProperty`, throttled to the display rate. Glow = 2–3 stacked `line` layers (wide blurred + core) on the "active" subset (`T - window < __t <= T`). Paths use `lineMetrics: true` + `line-gradient` over `line-progress` for trails.
- **three.js layer:** lazy `import()` of a pinned ESM build (same pattern as `maplibre-loader.js`), one custom layer per animated slide, `uTime` uniform, elevations from `map.queryTerrainElevation`. Mercator only at first (disable under globe projection until the custom-layer matrix under globe is proven). WebGL2 check, particle budget scaled down on mobile, and off for reduced motion.

## 4. Proposed slide spec (draft)

```json
{
  "animation": {
    "version": 1,
    "template": "spreading-footprint",
    "layer": "<layer ref>",
    "time": { "field": "PERIM_TIME", "endField": null, "dateSemantics": "instant", "timeZone": "UTC", "start": "2020-08-16", "end": "2020-09-30" },
    "playback": { "durationMs": 20000, "loop": false },
    "interpolation": "none",
    "effects": [{ "type": "glow-edge", "activeWindow": "P1D" }, { "type": "embers", "density": "low" }],
    "camera": { "mode": "keyframes", "keyframes": [{ "at": 0, "center": [-122.4, 38.6], "zoom": 9, "pitch": 60, "bearing": -20 }] },
    "events": [{ "at": "2020-08-19", "title": "Complex merges", "pause": true }],
    "chart": { "type": "cumulative", "stat": "sum", "field": "GIS_ACRES" }
  }
}
```

Rules: `interpolation` other than `"none"` is labelled on screen as a visual approximation and never replaces an observed perimeter at its timestamp. A per-polygon morph is not offered; a later `"raster-sdf"` transition is the only interpolation in scope. Share links must stay within the existing budgets (`MAX_SPATIAL_CHART`-style cap, QR_SAFE_LENGTH 2800).

Templates, in build order: `changing-values` (choropleth/columns over time; 2D-friendly, mobile-safe) → `spreading-footprint` → `sequential-reveal` → `moving-phenomenon` (paths/points with trails) → `flow-network`.

## 5. Phases

| Phase | Work | Done when |
|---|---|---|
| **A0** Foundations | `js/animation-clock.js` (pure, unit tested); `BriefingPlayer` refactored onto it with no behaviour change; `dateSemantics`; truncation guard; ArcGIS 3D-chart notice | Existing timeline tests pass unchanged; new clock tests for seek, reverse, loop, speed, reduced-motion step mode |
| **A1** MapLibre native animation | `animation` capability; time-paint adapter; glow edges; trails; camera keyframes + orbit; chart cursor synced to `t`; `animated-map` slide type | CAL FIRE year-by-year spreading-footprint on 3D terrain plays smoothly at 60 fps on desktop and ≥30 fps on a mid phone; scrub is instant |
| **A2** three.js effects | Lazy three.js custom layer; embers/smoke/flow arrows; LOD + WebGL checks | Effects follow the geometry on terrain; turning them off leaves an identical data picture |
| **A3** Authoring + agents | Animated Map authoring panel (template, time field, effect, duration, camera); `briefing.generateTemplate({ template: "animated-map" })` with `previewOnly`; schema; PDF keyframes; share round-trip; skill recipe + capability flag flipped to available | Agent can produce the FireTrace-style Brief from a prompt and the share link reopens identically |
| **A4** ArcGIS adapter | Same spec on SceneView: `timeExtent`, `goTo` keyframes, native glow approximations; RenderNode effects only if justified | Engine switch keeps meaning; unsupported effects listed in the UI |
| **A5** Recommendations | Data-to-template suggestions (perimeters → spreading footprint, tracks → moving phenomenon, yearly stats → changing values) and matching skins | Suggestions are explainable from schema + geometry |

## 6. Demo data (verify in A0)

- Annual: CAL FIRE historic perimeters (`California_Historic_Fire_Perimeters/FeatureServer/0`), already used in examples. Good for year-by-year, but these are **final** perimeters, not daily growth.
- Daily/sub-daily progression for the FireTrace look: candidate sources are NASA FEDS fire-event perimeters (via VEDA OGC API) and VIIRS/MODIS active-fire points (FIRMS). Confirm licence, CORS, and keyless access before choosing; do not ship a demo whose source needs a private key in the share link.

## 7. Risks

- **Polygon morphing artifacts**: avoided by default (`"none"`); SDF transitions are a later, labelled option.
- **Feature volume**: whole-range loads can exceed the engine cap; fall back to yearly/monthly aggregates with disclosure.
- **MapLibre globe + custom layers**: effects mercator-only until proven.
- **Motion sickness and accessibility**: reduced motion → step mode, no orbit, no particles; keyboard scrub; text table of per-frame counts.
- **Scope creep into a simulation**: no fire-spread prediction, flame height or smoke physics (SPEC §1 out of scope).
