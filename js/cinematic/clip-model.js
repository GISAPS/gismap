import { exportCinematicSpec, importCinematicSpec } from "./state.js?v=0.2.6";
import { PROVENANCE_STATUSES, normalizeTiming } from "./clock.js?v=0.1.0";

export const CINEMATIC_CLIP_SCHEMA = "gismap.cinematicClip";
export const CINEMATIC_CLIP_VERSION = 1;
const MAX_CLIPS = 40;
const MAX_CAPTIONS = 80;
const text = (value, max = 240) => String(value ?? "").trim().slice(0, max);
const finite = (value, fallback = null) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clone = (value) => structuredClone(value);

function newId() {
  const value = globalThis.crypto?.randomUUID?.().replaceAll("-", "").slice(0, 12) || Math.random().toString(36).slice(2, 14);
  return `clip-${value}`;
}

function safeUrl(value) {
  try {
    const url = new URL(String(value || ""));
    if (!["https:", "http:"].includes(url.protocol)) return null;
    // Project/clip sharing must never turn an authenticated service URL into a
    // portable credential. Keep ordinary query parameters when useful, but
    // drop names used by ArcGIS and common signed-resource providers.
    url.username = ""; url.password = ""; url.hash = "";
    for (const key of [...url.searchParams.keys()]) if (/^(?:token|access_?token|api_?key|key|signature|sig|client_?secret)$/i.test(key)) url.searchParams.delete(key);
    return url.href;
  } catch { return null; }
}

function camera(value) {
  const center = value?.center || [value?.longitude, value?.latitude];
  const longitude = finite(center?.[0]);
  const latitude = finite(center?.[1]);
  if (longitude == null || latitude == null || Math.abs(longitude) > 180 || Math.abs(latitude) > 90) return null;
  return { longitude, latitude, zoom: Math.min(24, Math.max(0, finite(value?.zoom, 12))), pitch: Math.min(85, Math.max(0, finite(value?.pitch ?? value?.tilt, 0))), bearing: finite(value?.bearing ?? value?.heading, 0) };
}

function normalizeTrack(track, durationMs) {
  if (!track || typeof track !== "object") return null;
  if (track.type === "caption") {
    const value = text(track.text, 500);
    return value ? { type: "caption", atMs: Math.min(durationMs, Math.max(0, finite(track.atMs, 0))), text: value } : null;
  }
  if (track.type === "temporalLayer" && text(track.layerRef, 2048)) {
    const animation = track.animation && typeof track.animation === "object" ? track.animation : {};
    const effect = animation.effect && typeof animation.effect === "object" ? animation.effect : null;
    const opacity = finite(animation.opacity);
    return {
      type: "temporalLayer", layerRef: text(track.layerRef, 2048), mode: track.mode === "cumulative" ? "cumulative" : "observed-steps",
      temporal: track.temporal && typeof track.temporal === "object" ? {
        kind: ["number", "none"].includes(track.temporal.kind) ? track.temporal.kind : "time",
        ...(track.temporal.kind === "number" && Number.isFinite(Number(track.temporal.steps)) ? { steps: Math.max(0, Math.min(5000, Math.round(Number(track.temporal.steps)))) } : {}),
        startField: text(track.temporal.startField, 160) || null, groupField: text(track.temporal.groupField, 160) || null,
        featureIdField: text(track.temporal.featureIdField, 160) || null,
      } : null,
      // How the layer looked when captured: its decorative effect and opacity.
      animation: {
        ...(effect ? { effect: { type: text(effect.type, 20) || "none", color: /^#[0-9a-f]{6}$/i.test(effect.color || "") ? effect.color : null, intensity: Math.min(2, Math.max(0.25, finite(effect.intensity, 1))), ...(text(effect.field, 160) ? { field: text(effect.field, 160) } : {}) } } : {}),
        ...(opacity == null ? {} : { opacity: Math.min(1, Math.max(0.05, opacity)) }),
        // Its motion on the master clock, and whether its effect was shown.
        // Default timing (continuous, ×1, no offset) is left out, as older Clips had none.
        ...(animation.timing && JSON.stringify(normalizeTiming(animation.timing)) !== JSON.stringify(normalizeTiming()) ? { timing: normalizeTiming(animation.timing) } : {}),
        ...(animation.visible === false ? { visible: false } : {}),
      },
      // What the track's progression was presented as (observed, modeled, illustrative…).
      ...(PROVENANCE_STATUSES.includes(track.provenance?.status) ? { provenance: { status: track.provenance.status } } : {}),
    };
  }
  return null;
}

/** A portable Clip recipe. It intentionally excludes credentials, data bytes and local Blob URLs. */
export function normalizeCinematicClip(value = {}) {
  const source = value && typeof value === "object" ? value : {};
  const durationMs = Math.min(120000, Math.max(5000, finite(source.playback?.durationMs, 20000)));
  const cameras = (Array.isArray(source.cameraTrack) ? source.cameraTrack : []).map((item) => {
    const point = camera(item?.camera);
    return point ? { atMs: Math.min(durationMs, Math.max(0, finite(item.atMs, 0))), camera: point } : null;
  }).filter(Boolean).sort((a, b) => a.atMs - b.atMs).slice(0, 24);
  const tracks = (Array.isArray(source.tracks) ? source.tracks : []).map((track) => normalizeTrack(track, durationMs)).filter(Boolean);
  const dependencies = (Array.isArray(source.dependencies) ? source.dependencies : []).map((entry) => {
    const url = safeUrl(entry?.url);
    return url ? { kind: text(entry.kind, 80) || "remote-layer", url, offlineIncluded: false } : null;
  }).filter(Boolean).slice(0, 50);
  const range = source.range && typeof source.range === "object" ? { start: text(source.range.start, 80), end: text(source.range.end, 80) } : { start: "", end: "" };
  // Scenario ranges are plain numbers; timeline ranges are ISO instants.
  const numeric = /^-?\d+(?:\.\d+)?$/.test(range.start) && /^-?\d+(?:\.\d+)?$/.test(range.end);
  const bound = (value) => (numeric ? Number(value) : Date.parse(value));
  if (range.start && range.end && bound(range.end) < bound(range.start)) throw new Error("A Clip range cannot end before it starts.");
  return {
    schema: CINEMATIC_CLIP_SCHEMA, version: CINEMATIC_CLIP_VERSION, id: /^[\w-]{3,80}$/.test(source.id || "") ? source.id : newId(),
    title: text(source.title, 160) || "Cinematic clip", createdAt: text(source.createdAt, 40) || new Date().toISOString(), updatedAt: text(source.updatedAt, 40) || new Date().toISOString(),
    source: { projectId: text(source.source?.projectId, 160) || null, cinematicId: text(source.source?.cinematicId, 160) || null }, range,
    playback: { durationMs, easing: source.playback?.easing === "ease-in-out" ? "ease-in-out" : "linear", loop: source.playback?.loop === true },
    cameraTrack: cameras, tracks,
    // The frame a poster (and a Brief slide before it plays) shows.
    posterMs: Math.min(durationMs, Math.max(0, finite(source.posterMs, 0))),
    composition: { aspectRatio: ["9:16", "1:1"].includes(source.composition?.aspectRatio) ? source.composition.aspectRatio : "16:9", titleOverlay: source.composition?.titleOverlay !== false, attribution: source.composition?.attribution !== false, legend: source.composition?.legend !== false },
    dependencies, renders: [],
  };
}

export function normalizeCinematicClips(value) {
  const seen = new Set();
  return (Array.isArray(value) ? value : []).map((clip) => {
    try { return normalizeCinematicClip(clip); } catch { return null; }
  }).filter((clip) => clip && !seen.has(clip.id) && seen.add(clip.id)).slice(0, MAX_CLIPS);
}

/** A range bound as stored: an ISO instant for a timeline, the number for a Scenario sweep, nothing for Ambient. */
const rangeValue = (value, kind) => (!Number.isFinite(value) || kind === "none" ? "" : kind === "number" ? String(value) : new Date(value).toISOString());

/**
 * Creates a clip from a loaded cinematic scene. Without options it captures
 * the whole timeline from the live camera; the capture dialog passes the
 * author's choices: { durationMs, range: { start, end }, startCamera,
 * endCamera, easing, captions: [{ atMs, text }], posterMs, aspectRatio, id }.
 */
export function createCinematicClip({ cinematic, projectId = null, camera: view = null, observationTimes = [], title = null, options = {} } = {}) {
  const spec = exportCinematicSpec(importCinematicSpec({ cinematic })).cinematic;
  const kind = spec.layers.find((layer) => layer.temporal?.kind !== "none")?.temporal.kind || (spec.layers.length ? "none" : "time");
  const durationMs = Math.min(120000, Math.max(5000, Math.round(finite(options.durationMs, Math.min(30000, Math.max(10000, spec.clock.durationSeconds * 1000))))));
  const at = [...observationTimes].filter(Number.isFinite).sort((a, b) => a - b);
  const startCamera = camera(options.startCamera || view);
  const endCamera = camera(options.endCamera) || startCamera;
  const tracks = spec.layers.map((layer) => ({ type: "temporalLayer", layerRef: layer.layerRef, mode: spec.clock.timeMode === "cumulative" ? "cumulative" : "observed-steps", temporal: layer.temporal, animation: { effect: layer.animation.effect, opacity: layer.animation.opacity, timing: layer.animation.timing, visible: layer.animation.visible }, provenance: layer.provenance ? { status: layer.provenance.status } : undefined }));
  const captions = (Array.isArray(options.captions) ? options.captions : []).slice(0, MAX_CAPTIONS).map((caption) => ({ type: "caption", atMs: caption.atMs, text: caption.text }));
  return normalizeCinematicClip({
    id: options.id || newId(), title: title || spec.title, source: { projectId, cinematicId: spec.id },
    range: { start: options.range?.start || rangeValue(at[0], kind) || spec.clock.start, end: options.range?.end || rangeValue(at.at(-1), kind) || spec.clock.end },
    playback: { durationMs, easing: options.easing === "ease-in-out" ? "ease-in-out" : "linear", loop: spec.clock.loop },
    cameraTrack: startCamera ? [{ atMs: 0, camera: startCamera }, { atMs: durationMs, camera: endCamera }] : [],
    tracks: [...tracks, ...captions],
    posterMs: options.posterMs ?? 0,
    composition: { aspectRatio: options.aspectRatio || "16:9", titleOverlay: true, attribution: true },
    dependencies: spec.provenance.sourceUrls.map((url) => ({ kind: "source", url })),
  });
}

/** Rebuilds the existing cinematic controller spec for interactive playback. */
export function clipToCinematicSpec(clip) {
  const normalized = normalizeCinematicClip(clip);
  const layers = normalized.tracks.filter((track) => track.type === "temporalLayer" && (track.temporal?.startField || track.temporal?.kind === "none")).map((track) => ({
    layerRef: track.layerRef, temporal: { ...track.temporal },
    animation: { template: "step-perimeter", transition: "step", ...(track.animation?.effect ? { effect: { ...track.animation.effect } } : {}), ...(track.animation?.opacity != null ? { opacity: track.animation.opacity } : {}), ...(track.animation?.timing ? { timing: { ...track.animation.timing } } : {}), ...(track.animation?.visible === false ? { visible: false } : {}) },
    ...(track.provenance ? { provenance: { ...track.provenance } } : {}),
  }));
  if (!layers.length) throw new Error("This Clip does not contain a playable temporal layer.");
  return importCinematicSpec({ cinematic: { id: normalized.source.cinematicId || normalized.id, title: normalized.title, clock: { start: normalized.range.start, end: normalized.range.end, durationSeconds: normalized.playback.durationMs / 1000, rate: 1, loop: normalized.playback.loop, timeMode: layers.some((layer) => normalized.tracks.find((track) => track.layerRef === layer.layerRef)?.mode === "cumulative") ? "cumulative" : "instant" }, layers } });
}

export function exportCinematicClip(clip) { return clone(normalizeCinematicClip(clip)); }

const durationText = (ms) => {
  const seconds = Math.round(ms / 1000);
  return seconds >= 60 ? `${Math.floor(seconds / 60)} min ${seconds % 60 ? `${seconds % 60} s` : ""}`.trim() : `${seconds}-second`;
};
const dateText = (value) => {
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString().replace("T", " ").replace(/:\d\d\.\d{3}Z$/, " UTC") : "the first observation";
};

/**
 * The Clip JSON people download: the Clip itself plus a `package` block that
 * says, in plain language, what it shows, who to credit, and what it needs
 * to play elsewhere. `layers` maps each layerRef to { title, url } as the
 * map knows it; `effectLabels` names each track's effect for the summary.
 * It is a portable recipe: it never contains data, credentials or local files.
 */
export function buildClipPackage(clip, { layers = {}, attribution = "", effectLabels = {}, appVersion = "", exportedAt = new Date().toISOString() } = {}) {
  const normalized = exportCinematicClip(clip);
  const temporal = normalized.tracks.filter((track) => track.type === "temporalLayer");
  const captions = normalized.tracks.filter((track) => track.type === "caption");
  const dependencies = temporal.map((track) => {
    const layer = layers[track.layerRef] || {};
    const url = safeUrl(layer.url);
    return url
      ? { kind: "remote-layer", layerRef: track.layerRef, title: text(layer.title, 160) || "Layer", url, timeField: track.temporal?.startField || null, offlineIncluded: false, note: "Loaded from its online service when the Clip plays." }
      : { kind: "local-layer", layerRef: track.layerRef, title: text(layer.title, 160) || "Layer", url: null, timeField: track.temporal?.startField || null, offlineIncluded: false, note: "A local file or drawn layer: not included, so the Clip will not play elsewhere until this data is added to the project." };
  });
  for (const extra of normalized.dependencies) if (!dependencies.some((item) => item.url === extra.url)) dependencies.push({ kind: extra.kind || "source", title: null, url: extra.url, offlineIncluded: false, note: "Cited source." });
  const titles = dependencies.filter((item) => item.layerRef).map((item) => item.title);
  const effects = [...new Set(temporal.map((track) => effectLabels[track.layerRef]).filter(Boolean))];
  const [start, end] = [normalized.cameraTrack[0]?.camera, normalized.cameraTrack.at(-1)?.camera];
  const moves = start && end && (start.longitude !== end.longitude || start.latitude !== end.latitude || start.zoom !== end.zoom || start.pitch !== end.pitch || start.bearing !== end.bearing);
  const summary = [
    `“${normalized.title}” is a ${durationText(normalized.playback.durationMs)} cinematic clip of ${titles.length ? titles.join(", ") : "map data"}, stepping through observed records from ${dateText(normalized.range.start)} to ${dateText(normalized.range.end)}.`,
    moves ? "The camera moves between two saved views." : "The camera holds one view.",
    captions.length ? `It has ${captions.length} caption${captions.length === 1 ? "" : "s"}.` : "",
    effects.length ? `Visual effects (${effects.join(", ")}) are decoration, not data.` : "",
  ].filter(Boolean).join(" ");
  const playable = dependencies.filter((item) => item.layerRef).every((item) => item.kind === "remote-layer");
  return {
    ...normalized,
    package: {
      kind: "portable-recipe",
      label: "Portable recipe: plays in GISMap Online when the online services below are reachable. It contains no data, credentials or video.",
      summary,
      attribution: text(attribution, 1000) || null,
      dependencies,
      playableElsewhere: playable,
      exportedAt: text(exportedAt, 40),
      createdWith: appVersion ? `GISMap Online ${text(appVersion, 40)}` : "GISMap Online",
    },
  };
}
