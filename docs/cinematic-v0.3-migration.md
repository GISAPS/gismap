# Cinematic v0.3 — migration note and performance report

How the v0.3 adaptive-animation spec maps onto GISMap Online's Cinematic Mode, what
changed for saved scenes, what was measured, and what is deliberately left
for later. Read with `docs/cinematic-v0.3-plan.md` (the order of work).

## Scene JSON: additive, backward compatible

Existing v0.1/v0.2 scenes load unchanged; every new field has a default.
GISMap Online keeps its own schema (`cinematic.layers[]` is the track list) rather
than introducing a parallel `cinematic.v0.3` document.

| Spec contract (§2.5) | GISMap Online field | Default for old scenes |
|---|---|---|
| `experience`: ambient / timeline / scenario | derived: the first track whose `temporal.kind` isn't `none` leads (`time` → Timeline, `number` → Scenario); all-`none` → Ambient | `time` |
| `tracks[]` | `cinematic.layers[]` (one track per layer) | — |
| `track.clock.cycleSeconds / offsetSeconds / policy` | `layers[].animation.timing` `{ rate, cycleSeconds, offsetSeconds, policy }` (`loop`, `once`, `pingPong`, `hold`) | continuous, ×1, no offset, loop |
| `track.provenance.status` | `layers[].provenance.status` (observed, interpolated, modeled, forecast, illustrative) | Timeline → observed, Ambient/Scenario → illustrative |
| track toggle | `layers[].animation.visible` | `true` |
| `track.style.color` | `layers[].animation.effect.color` (else the skin's palette, else the effect's own) | `null` |
| `track.dataMapping` (value field) | `layers[].animation.effect.field` (Rise, Reveal) | chosen from the layer |
| `playback.rate`, play/pause | `clock.effectsRate`, `clock.effectsPlaying` (effects); `clock.rate` (timeline) | 1, playing |
| `timeMapping.field` | `layers[].temporal.startField` (+ `kind`, `steps`) | — |

Clips (`gismap.cinematicClip` v1) carry the same per-track fields; default
timing is omitted so ordinary Clip JSON is unchanged.

**Fix found while migrating:** re-normalizing a saved scene turned an unset
layer opacity (`null`) into 5%. Saved scenes now keep it unset.

## Clock and tracks (spec §2.3–2.4)

- `js/cinematic/clock.js`: `createEffectsClock()` is the master clock for
  every effect (play, pause, toggle, seek, setRate, reset, `frameAt`). Time is
  computed when read, so it adds no animation loop of its own.
- `trackTime(seconds, timing)` maps master seconds to a track's own time
  and phase; `seek(30)` gives the same state as playing to 30 s (tested with
  6 s and 12 s tracks).
- Observation dates (Timeline) and scenario values (Scenario) are separate
  from animation time; nothing turns playback seconds into dates.
- Movie export swaps in its frame clock and restores the master clock after.
- Paused effects stop repainting (measured: 90 paints in 1.5 s playing, 0
  paused). Native effects run one small loop only while one is still moving.

## Primitives and backends

| Primitive | GISMap Online effect | Backend |
|---|---|---|
| pulse | `pulse` | three.js shader |
| flow | `flow` | three.js shader |
| grow / extrude | `extrude` (Rise) — heights proportional to a field (value / max) | MapLibre `fill-extrusion` |
| reveal | `reveal` — by a field's order, or stored order (labelled; never a date) | MapLibre fill/line/circle |
| particleField | `wind` streaks, fire embers | three.js points |
| spread / accumulate | Timeline instant / build-up | map filter + effects |
| (settled edges) | older build-up outlines | MapLibre line + halo |

Recipes in the recommender (`js/cinematic/recommend.js`) compose these; none
runs its own animation loop.

## UX entry points

- **Layer → More layer tools → Animate**: ranked suggestions with the reason
  each was offered and its provenance; Ambient ones apply on the map without
  Cinematic mode, any can open in Cinematic.
- **Cinematic panel**: Ambient scenes show Play/Pause for the loop (no
  calendar controls); every scene has *Effects move* and *Effect speed*; each
  track has show/colour/speed/cycle/repeat/"shown as" under *Motion & label*;
  provenance badges sit above the description and in exported movies.
- Skins recolour effects that have no colour of their own (Dark analytical,
  Highway, Velvet orbit, Violet circuit, Portolan); values, dates and
  scenario values never change.

## Performance report (California Historic Fire Perimeters, 17,950–23,334 features)

| Scene | Before (v0.2) | After (v0.3) |
|---|---|---|
| Build-up step at state zoom | ~140,000 vertices, ~60 ms CPU per step, every outline rebuilt | ~660 vertices / ~1 ms for the recent layer; settled outlines native (19,030 lines, no custom GL) |
| Build-up near the end, regional | three.js for all outlines | 2,350 three.js vertices, 52 fps (preview pane) |
| Fire timeline, zoom 9.5, end of record | — | 11,610 vertices · 1 draw call · 1 native layer · 60 fps |
| Ambient flow, 5 lines | — | 30 vertices · 1 draw call · 60 fps; 0 repaints while paused |
| Layer effect on 23k perimeters, zoomed in | 800 outlines picked regardless of view (most visible ones bare) | only features near the view, full detail; rebuilt when the view leaves its area |
| Terrain heights | re-sampled each rebuild | cached (bounded, 250,000 entries) |

Measured in the Claude desktop browser pane on an Apple-silicon Mac; the
pane throttles when hidden, so frame rates are indicative, not benchmarks.
Auto detail steps down a tier after sustained slow frames and never touches
observed geometry or filters.

## Spec §14 tests: status

| # | Test | Status |
|---|---|---|
| 1 | No-date line layer: Ambient Flow, play, pause, speed, resume | automated (mode, recommend) + browser |
| 2 | 6 s and 12 s tracks equal after `seek(30)` | automated (`cinematic-clock`) |
| 3 | Timeline reads real ISO dates, not playback seconds | automated (temporal, mode) |
| 4 | Scenario sweep with no date | automated (mode, temporal) |
| 5 | No per-segment three.js explosion at regional extent | automated (settled split, ThreeHost) + native edges |
| 6 | Caches bounded; stale work cancelled | height cache bounded; worker prep deferred (see below) |
| 7 | Lower FPS lowers decoration only | automated (adaptive detail) |
| 8 | Reduced motion stills effects | existing behaviour (effects hold a still frame) |
| 9 | Skins change palettes only | automated (`effectColor`) |
| 10 | Pause, seek and export share track evaluation | shared `trackTime` + effect clock; export restores the master clock |
| 11 | Ambient Brief/Clip has no fictitious date | automated (clip) |
| 12 | Unavailable renderer/codec falls back with a warning | existing (engine capabilities, export probe) |
| 13 | Inspection/export use real data | effects never replace layer data; simplification is effect-only |
| 14 | Every effect labels its progression | provenance per track: panel badge, Animate cards, movie note |

## Deferred, by design

- Web Worker geometry preparation with cancellation (only if profiling on
  slow devices shows build time; the recent layer is small now).
- Three.js instancing / deck.gl renderers, `sway`, `shadow`/sun, `morph`.
- Demo scenes for hurricane track and flood depth (need agreed public data).
- A full diagnostics panel beyond the one-line readout (draw calls,
  triangles, native layers, fps are already reported).
