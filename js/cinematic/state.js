import { PROVENANCE_STATUSES, normalizeTiming } from "./clock.js?v=0.1.0";
import { normalizeSequence } from "./temporal-adapter.js?v=0.4.0-sequence";

// null and "" are "not set", not 0: a saved spec re-normalized must keep an unset opacity unset.
const finite = (value, fallback = null) => value !== null && value !== "" && Number.isFinite(Number(value)) ? Number(value) : fallback;
const string = (value, fallback = "") => typeof value === "string" ? value : fallback;
const EFFECTS = Object.freeze(["auto", "none", "glow", "fire", "pulse", "wind", "snow", "rain", "fog", "lightning", "tornado", "hurricane", "storm", "lava", "water", "water-flow", "flow", "electricity", "traffic", "trains", "sailboats", "ships", "walkers", "birds", "drones", "airplanes", "helicopters", "extrude", "reveal", "strata"]);

export const CINEMATIC_SCHEMA_VERSION = "0.1";
export const CINEMATIC_TEMPLATES = Object.freeze(["step-perimeter", "moving-track"]);

export function normalizeCinematicSpec(input = {}) {
  const source = input?.cinematic || input;
  const clock = source.clock || {};
  const start = string(clock.start);
  const end = string(clock.end);
  // A Scenario sweep's range is numbers; a timeline's is dates. The first
  // stepping track (not Ambient) leads; Ambient tracks loop alongside it.
  const lead = Array.isArray(source.layers) ? source.layers.find((layer) => layer?.temporal?.kind !== "none") : null;
  const numeric = lead?.temporal?.kind === "number";
  const bound = (value) => (numeric ? Number(value) : Date.parse(value));
  if (start && end && bound(end) < bound(start)) throw new Error("Cinematic clock end must not precede its start.");
  const layers = Array.isArray(source.layers) ? source.layers.map((layer) => {
    if (!string(layer?.layerRef)) throw new Error("Every cinematic layer needs a layerRef.");
    const kind = ["number", "none"].includes(layer?.temporal?.kind) ? layer.temporal.kind : "time";
    if (kind !== "none" && !string(layer?.temporal?.startField)) throw new Error("Every cinematic layer needs temporal.startField (or temporal.kind \"none\" for an ambient animation).");
    const template = CINEMATIC_TEMPLATES.includes(layer?.animation?.template) ? layer.animation.template : "step-perimeter";
    return {
      layerRef: layer.layerRef,
      temporal: {
        kind,
        // A Scenario sweep's number of steps (0 = every distinct value).
        steps: kind === "number" ? Math.max(0, Math.min(5000, Math.round(finite(layer.temporal.steps, 200)))) : 0,
        // A Sequence (a text field's values in a listed or A–Z order) or a sweep's step labels.
        ...normalizeSequence({ ...layer.temporal, kind }),
        startField: kind === "none" ? null : layer.temporal.startField,
        groupField: string(layer.temporal.groupField) || null,
        featureIdField: string(layer.temporal.featureIdField) || null,
        timezone: string(layer.temporal.timezone, "UTC") || "UTC",
        missingTime: layer.temporal.missingTime === "include" ? "include" : "exclude",
      },
      animation: {
        template,
        transition: layer.animation?.transition === "crossfade" ? "crossfade" : "step",
        opacity: finite(layer.animation?.opacity) == null ? null : Math.min(1, Math.max(0.05, finite(layer.animation.opacity))),
        outline: layer.animation?.outline && typeof layer.animation.outline === "object" ? { color: string(layer.animation.outline.color, "#ff8136"), glow: layer.animation.outline.glow === true } : undefined,
        effect: normalizeEffect(layer.animation),
        provenanceLabel: string(layer.animation?.provenanceLabel),
        // The track's own motion on the master clock (rate, cycle, offset, policy).
        timing: normalizeTiming(layer.animation?.timing),
        // A hidden track keeps its place (and its layer's filter) but draws no effect.
        visible: layer.animation?.visible !== false,
      },
      // What the displayed progression is. A Timeline shows observations; an
      // Ambient loop or a Scenario sweep is illustrative unless the author says otherwise.
      provenance: { status: PROVENANCE_STATUSES.includes(layer.provenance?.status) ? layer.provenance.status : kind === "time" ? "observed" : "illustrative", caption: string(layer.provenance?.caption).slice(0, 200) },
    };
  }) : [];
  const leadKind = layers.find((layer) => layer.temporal.kind !== "none")?.temporal.kind;
  if (layers.some((layer) => layer.temporal.kind !== "none" && layer.temporal.kind !== leadKind)) throw new Error("Tracks in one scene must all step by dates or all by numbers; Ambient tracks can join either.");
  return {
    schemaVersion: CINEMATIC_SCHEMA_VERSION,
    mode: "cinematic",
    cinematic: {
      id: string(source.id) || `cinematic-${Date.now()}`,
      title: string(source.title) || "Cinematic map",
      intent: ["explore", "investigate", "present"].includes(source.intent) ? source.intent : "explore",
      preferredEngine: ["maplibre", "arcgis"].includes(source.preferredEngine) ? source.preferredEngine : "maplibre",
      // Effect detail: "auto" sizes it to the scene; eco/balanced/cinematic fix it.
      quality: ["eco", "balanced", "cinematic"].includes(source.quality) ? source.quality : "auto",
      clock: { start, end, current: string(clock.current) || start, timeMode: clock.timeMode === "cumulative" ? "cumulative" : "instant", durationSeconds: Math.min(600, Math.max(1, finite(clock.durationSeconds, 120))), rate: Math.min(4, Math.max(0.1, finite(clock.rate, 0.25))), loop: clock.loop === true,
        // The master effects clock: its speed, and whether effects move (independent of the timeline).
        effectsRate: Math.min(8, Math.max(0.1, finite(clock.effectsRate, 1))), effectsPlaying: clock.effectsPlaying !== false },
      layers,
      events: Array.isArray(source.events) ? source.events.slice(0, 200) : [],
      scenes: Array.isArray(source.scenes) ? source.scenes.slice(0, 50) : [],
      provenance: { synthetic: source.provenance?.synthetic === true, sourceUrls: Array.isArray(source.provenance?.sourceUrls) ? source.provenance.sourceUrls.filter((url) => /^https:\/\//i.test(url)).slice(0, 50) : [], interpolated: false },
    },
  };
}

/**
 * A layer's decorative effect: { type, color?, intensity }. v0.1 specs only had
 * `outline.glow`, which maps to the glow effect.
 */
function normalizeEffect(animation = {}) {
  const effect = animation?.effect && typeof animation.effect === "object" ? animation.effect : {};
  const type = EFFECTS.includes(effect.type) ? effect.type : animation?.outline?.glow === true ? "glow" : "none";
  const color = /^#[0-9a-f]{6}$/i.test(string(effect.color)) ? effect.color : null;
  const opacity = Math.min(1, Math.max(0.05, finite(effect.opacity, 1)));
  const speed = Math.min(3, Math.max(0.1, finite(effect.speed, 1)));
  const density = Math.min(2.5, Math.max(0.25, finite(effect.density, 1)));
  const style = ["soft", "balanced", "crisp", "vivid"].includes(effect.style) ? effect.style : "balanced";
  // `field`: the attribute a Rise or a Reveal reads (null = chosen from the layer).
  const field = string(effect.field).slice(0, 160);
  return { type, color, intensity: Math.min(2, Math.max(0.25, finite(effect.intensity, 1))), opacity, speed, density, style, ...(field ? { field } : {}) };
}

export function exportCinematicSpec(spec) { return structuredClone(normalizeCinematicSpec(spec)); }
export function importCinematicSpec(spec) { return normalizeCinematicSpec(spec); }
