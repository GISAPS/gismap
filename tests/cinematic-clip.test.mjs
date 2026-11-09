import test from "node:test";
import assert from "node:assert/strict";
import { buildClipPackage, clipToCinematicSpec, createCinematicClip, normalizeCinematicClip, normalizeCinematicClips } from "../js/cinematic/clip-model.js";
import { createSlide, normalizeBriefing } from "../js/briefing-document.js";
import { supportedClipVideoMime } from "../js/cinematic/clip-export.js";

const cinematic = {
  id: "wildfire", title: "Fire perimeter evolution",
  clock: { start: "2026-10-01T00:00:00Z", end: "2026-10-02T00:00:00Z", durationSeconds: 20, timeMode: "cumulative" },
  layers: [{ layerRef: "fire-perimeters", temporal: { startField: "observed_at", groupField: "incident", featureIdField: "OBJECTID" } }],
  provenance: { sourceUrls: ["https://example.org/FeatureServer/0"] },
};

test("a Clip is a portable recipe without credentials or local render output", () => {
  const clip = createCinematicClip({ cinematic, projectId: "project-1", camera: { center: [-118.1, 34.2], zoom: 10, heading: 20, tilt: 65 }, observationTimes: [Date.parse("2026-10-01T00:00:00Z"), Date.parse("2026-10-02T00:00:00Z")] });
  assert.equal(clip.schema, "gismap.cinematicClip");
  assert.equal(clip.cameraTrack.length, 2);
  assert.equal(clip.tracks[0].layerRef, "fire-perimeters");
  assert.equal(clip.dependencies[0].url, "https://example.org/FeatureServer/0");
  assert.deepEqual(clip.renders, []);
  assert.equal(JSON.stringify(clip).includes("token"), false);
  const replay = clipToCinematicSpec(clip).cinematic;
  assert.equal(replay.layers[0].temporal.startField, "observed_at");
  assert.equal(replay.clock.timeMode, "cumulative");
});

test("Clip normalization rejects unsafe dependencies and bounds the recipe", () => {
  const clip = normalizeCinematicClip({ id: "clip-safe", title: "Safe", playback: { durationMs: 999999 }, cameraTrack: [{ atMs: -4, camera: { longitude: -118, latitude: 34 } }], dependencies: [{ url: "javascript:alert(1)" }, { url: "https://safe.example/data?token=not-stored-here" }], tracks: [{ type: "caption", atMs: 999999, text: "A caption" }] });
  assert.equal(clip.playback.durationMs, 120000);
  assert.equal(clip.cameraTrack[0].atMs, 0);
  assert.equal(clip.tracks[0].atMs, 120000);
  assert.equal(clip.dependencies.length, 1);
  assert.equal(clip.dependencies[0].url.includes("token="), false);
  assert.equal(normalizeCinematicClips([clip, clip]).length, 1);
});

test("Briefs retain an interactive Cinematic Clip slide reference", () => {
  const slide = createSlide("cinematic", { title: "Fire clip" });
  slide.clipRef = "clip-fire-001";
  const briefing = normalizeBriefing({ slides: [slide] });
  assert.equal(briefing.slides[0].template, "cinematic");
  assert.equal(briefing.slides[0].clipRef, "clip-fire-001");
  assert.equal(briefing.slides[0].presentation, "interactive");
});

test("video export offers only a WebM MIME the browser reports as supported", () => {
  const Recorder = { isTypeSupported: (type) => type === "video/webm;codecs=vp8" };
  assert.equal(supportedClipVideoMime(Recorder), "video/webm;codecs=vp8");
  assert.equal(supportedClipVideoMime({ isTypeSupported: () => false }), null);
});

test("the export timebase gives the same frame for the same time at any frame rate", async () => {
  const { cameraAt, clipFrameCount, clipStateAt, observationIndexAt } = await import("../js/cinematic/clip-export.js");
  // The movie is exactly the Clip's length: 20 s at 30 fps is 600 frames, at 24 fps 480.
  assert.equal(clipFrameCount(20000, 30), 600);
  assert.equal(clipFrameCount(20000, 24), 480);
  // Observations advance at a steady pace from the first to the last.
  assert.equal(observationIndexAt(0, 20000, 5), 0);
  assert.equal(observationIndexAt(10000, 20000, 5), 2);
  assert.equal(observationIndexAt(20000, 20000, 5), 4);
  assert.equal(observationIndexAt(5000, 20000, 1), 0);
  // Bearing turns the short way through north; easing holds the ends.
  const track = [{ atMs: 0, camera: { longitude: 0, latitude: 0, zoom: 4, pitch: 0, bearing: 350 } }, { atMs: 1000, camera: { longitude: 10, latitude: 0, zoom: 6, pitch: 60, bearing: 10 } }];
  const middle = cameraAt(track, 500);
  assert.equal(middle.heading, 360);
  assert.deepEqual(middle.center, [5, 0]);
  assert.equal(middle.zoom, 5);
  assert.ok(cameraAt(track, 100, "ease-in-out").zoom < cameraAt(track, 100).zoom);
  const clip = { playback: { durationMs: 20000 }, cameraTrack: track, tracks: [{ type: "caption", atMs: 5000, text: "Rapid expansion" }] };
  assert.deepEqual(clipStateAt(clip, 6000, 9), clipStateAt(clip, 6000, 9));
  assert.equal(clipStateAt(clip, 4999, 9).caption, "");
  assert.equal(clipStateAt(clip, 5000, 9).caption, "Rapid expansion");
});

test("movie formats are only those the browser genuinely encodes, frame-accurate first", async () => {
  const { availableVideoFormats } = await import("../js/cinematic/clip-export.js");
  const loader = async () => ({ canEncodeVideo: async (codec) => ["avc", "vp9"].includes(codec) });
  const recorder = { isTypeSupported: (type) => type === "video/webm;codecs=vp8" };
  const both = await availableVideoFormats({ loader, MediaRecorderClass: recorder, hasWebCodecs: true });
  assert.deepEqual(both.map((format) => [format.method, format.container, format.codec, format.extension]), [["webcodecs", "mp4", "avc", ".mp4"], ["webcodecs", "webm", "vp9", ".webm"]]);
  // Without WebCodecs: the recorder's own types, MP4 only when it really records MP4.
  const safari = await availableVideoFormats({ hasWebCodecs: false, MediaRecorderClass: { isTypeSupported: (type) => type === "video/mp4" } });
  assert.deepEqual(safari.map((format) => [format.method, format.mimeType, format.extension]), [["recorder", "video/mp4", ".mp4"]]);
  const webmOnly = await availableVideoFormats({ hasWebCodecs: false, MediaRecorderClass: recorder });
  assert.deepEqual(webmOnly.map((format) => format.extension), [".webm"]);
  assert.deepEqual(await availableVideoFormats({ hasWebCodecs: false, MediaRecorderClass: null }), []);
});

test("a Clip keeps each layer's effect and opacity, and replays at its own length", () => {
  const styled = { ...cinematic, layers: [{ ...cinematic.layers[0], animation: { opacity: 0.4, effect: { type: "fire", intensity: 1.5 } } }] };
  const clip = createCinematicClip({ cinematic: styled, observationTimes: [Date.parse("2026-10-01T00:00:00Z"), Date.parse("2026-10-02T00:00:00Z")] });
  assert.deepEqual(clip.tracks[0].animation, { effect: { type: "fire", color: null, intensity: 1.5 }, opacity: 0.4 });
  const replay = clipToCinematicSpec(clip).cinematic;
  assert.equal(replay.layers[0].animation.effect.type, "fire");
  assert.equal(replay.layers[0].animation.opacity, 0.4);
  // Rate 1: a 20-second Clip plays in 20 seconds, not four times longer at the default slow rate.
  assert.equal(replay.clock.rate, 1);
  assert.equal(replay.clock.start, "2026-10-01T00:00:00.000Z");
});

test("the capture dialog's choices become the Clip: range, length, cameras, easing, captions and poster", () => {
  const times = [Date.parse("2026-10-01T00:00:00Z"), Date.parse("2026-10-01T12:00:00Z"), Date.parse("2026-10-02T00:00:00Z")];
  const start = { longitude: -118, latitude: 34, zoom: 9, pitch: 0, bearing: 0 };
  const end = { longitude: -118.2, latitude: 34.1, zoom: 11, pitch: 60, bearing: 30 };
  const clip = createCinematicClip({ cinematic, observationTimes: times, title: "Afternoon run", options: {
    id: "clip-edit-1", durationMs: 45000, range: { start: "2026-10-01T06:00:00.000Z", end: "2026-10-02T00:00:00.000Z" },
    startCamera: start, endCamera: end, easing: "ease-in-out", posterMs: 30000,
    captions: [{ atMs: 2000, text: "Containment lines" }, { atMs: 99000, text: "Clamped to the end" }],
  } });
  assert.equal(clip.id, "clip-edit-1");
  assert.equal(clip.title, "Afternoon run");
  assert.equal(clip.playback.durationMs, 45000);
  assert.equal(clip.playback.easing, "ease-in-out");
  assert.deepEqual(clip.range, { start: "2026-10-01T06:00:00.000Z", end: "2026-10-02T00:00:00.000Z" });
  assert.deepEqual(clip.cameraTrack.map((point) => [point.atMs, point.camera.zoom]), [[0, 9], [45000, 11]]);
  assert.deepEqual(clip.tracks.filter((track) => track.type === "caption").map((track) => [track.atMs, track.text]), [[2000, "Containment lines"], [45000, "Clamped to the end"]]);
  assert.equal(clip.posterMs, 30000);
  // Lengths are bounded to 5–120 seconds; a poster cannot sit past the end.
  assert.equal(createCinematicClip({ cinematic, options: { durationMs: 1000 } }).playback.durationMs, 5000);
  assert.equal(normalizeCinematicClip({ playback: { durationMs: 8000 }, posterMs: 60000 }).posterMs, 8000);
  assert.equal(normalizeCinematicClip({ composition: { aspectRatio: "1:1" } }).composition.aspectRatio, "1:1");
});

test("a Cinematic slide carries its own Clip copy through a shared briefing link", async () => {
  const { encodeBriefing, decodeBriefing } = await import("../js/briefing-share.js");
  const clip = createCinematicClip({ cinematic, observationTimes: [Date.parse("2026-10-01T00:00:00Z"), Date.parse("2026-10-02T00:00:00Z")], options: { posterMs: 5000, captions: [{ atMs: 1000, text: "Ignition area" }] } });
  // A tampered copy may not smuggle credentials into a public link.
  const slide = { ...createSlide("cinematic", { title: "Fire" }), clipRef: "ignored-when-a-copy-exists", clip: { ...clip, dependencies: [{ url: "https://example.org/FeatureServer/0?token=SECRET" }] }, presentation: "poster", loop: true };
  const briefing = normalizeBriefing({ slides: [slide] });
  const stored = briefing.slides[0];
  assert.equal(stored.clipRef, clip.id);
  assert.equal(stored.presentation, "poster");
  assert.equal(stored.loop, true);
  assert.equal(stored.clip.posterMs, 5000);
  assert.equal(JSON.stringify(stored).includes("SECRET"), false);
  const shared = await decodeBriefing(await encodeBriefing(briefing));
  const opened = normalizeBriefing(shared).slides[0];
  assert.equal(opened.clip.id, clip.id);
  assert.equal(opened.clip.tracks.find((track) => track.type === "caption").text, "Ignition area");
  assert.equal(opened.clip.tracks[0].temporal.startField, "observed_at");
  // A slide with only a reference still works (older Briefs), and nothing at all is not a Cinematic slide yet.
  assert.equal(normalizeBriefing({ slides: [{ ...createSlide("cinematic"), clipRef: "clip-old-1" }] }).slides[0].presentation, "interactive");
  assert.equal(normalizeBriefing({ slides: [createSlide("cinematic")] }).slides[0].clip, undefined);
});

test("the downloaded Clip JSON is a labelled portable recipe with a summary, credits and dependency report", () => {
  const styled = { ...cinematic, layers: [{ ...cinematic.layers[0], animation: { effect: { type: "fire" } } }], provenance: { sourceUrls: [] } };
  const clip = createCinematicClip({ cinematic: styled, observationTimes: [Date.parse("2026-10-01T00:00:00Z"), Date.parse("2026-10-02T00:00:00Z")], title: "Fire run", options: { durationMs: 20000, startCamera: { longitude: -118, latitude: 34, zoom: 9 }, endCamera: { longitude: -118.2, latitude: 34.1, zoom: 11 }, captions: [{ atMs: 1000, text: "Ignition" }] } });
  const recipe = buildClipPackage(clip, {
    layers: { "fire-perimeters": { title: "Fire perimeters", url: "https://services.example.org/arcgis/rest/services/Fires/FeatureServer/0?token=SECRET" } },
    effectLabels: { "fire-perimeters": "Flames" }, attribution: "© Esri | Data: services.example.org", appVersion: "0.53.0", exportedAt: "2026-10-24T00:00:00.000Z",
  });
  assert.equal(recipe.schema, "gismap.cinematicClip");
  assert.equal(recipe.package.kind, "portable-recipe");
  assert.match(recipe.package.label, /no data, credentials or video/);
  assert.equal(recipe.package.summary, "“Fire run” is a 20-second cinematic clip of Fire perimeters, stepping through observed records from 2026-10-01 00:00 UTC to 2026-10-02 00:00 UTC. The camera moves between two saved views. It has 1 caption. Visual effects (Flames) are decoration, not data.");
  assert.equal(recipe.package.attribution, "© Esri | Data: services.example.org");
  assert.deepEqual(recipe.package.dependencies.map((item) => [item.kind, item.title, item.url, item.timeField]), [["remote-layer", "Fire perimeters", "https://services.example.org/arcgis/rest/services/Fires/FeatureServer/0", "observed_at"]]);
  assert.equal(recipe.package.playableElsewhere, true);
  assert.equal(JSON.stringify(recipe).includes("SECRET"), false);
  // A local layer is reported as not included, and the recipe says it will not play elsewhere.
  const local = buildClipPackage(clip, { layers: { "fire-perimeters": { title: "My perimeters.geojson" } } });
  assert.equal(local.package.dependencies[0].kind, "local-layer");
  assert.equal(local.package.playableElsewhere, false);
  // Importing the package back yields the plain Clip (the report is not part of the recipe itself).
  assert.equal(normalizeCinematicClip(recipe).package, undefined);
  assert.equal(normalizeCinematicClip(recipe).id, clip.id);
});

test("Scenario and Ambient scenes become Clips that replay the same way", () => {
  const scenario = { ...cinematic, layers: [{ layerRef: "flood", temporal: { kind: "number", steps: 50, startField: "depth_ft" } }] };
  const clip = createCinematicClip({ cinematic: scenario, observationTimes: [0.5, 2, 12] });
  assert.equal(clipToCinematicSpec(clip).cinematic.layers[0].temporal.steps, 50, "a Clip replays with the same Scenario steps");
  assert.deepEqual(clip.range, { start: "0.5", end: "12" });
  assert.equal(clip.tracks[0].temporal.kind, "number");
  assert.equal(clipToCinematicSpec(clip).cinematic.layers[0].temporal.kind, "number");
  assert.throws(() => normalizeCinematicClip({ range: { start: "12", end: "2" } }), /cannot end before/);
  const ambient = createCinematicClip({ cinematic: { ...cinematic, clock: {}, layers: [{ layerRef: "lines", temporal: { kind: "none" } }] }, observationTimes: [0] });
  assert.deepEqual(ambient.range, { start: "", end: "" });
  const replay = clipToCinematicSpec(ambient).cinematic.layers[0];
  assert.equal(replay.temporal.kind, "none");
  assert.equal(replay.temporal.startField, null);
});

test("a Clip keeps every track, including Ambient ones beside the timeline", () => {
  const scene = { ...cinematic, layers: [
    { layerRef: "power", temporal: { kind: "none" }, animation: { effect: { type: "flow" } } },
    { layerRef: "quakes", temporal: { startField: "time" }, animation: { effect: { type: "pulse" } } },
  ] };
  const clip = createCinematicClip({ cinematic: scene, observationTimes: [Date.UTC(2026, 0, 1), Date.UTC(2026, 0, 5)] });
  assert.match(clip.range.start, /^2026-01-01/, "the lead (date) track sets the range, not the Ambient track listed first");
  const replay = clipToCinematicSpec(clip).cinematic.layers;
  assert.deepEqual(replay.map((layer) => [layer.layerRef, layer.temporal.kind, layer.animation.effect.type]), [["power", "none", "flow"], ["quakes", "time", "pulse"]]);
});

test("a Clip keeps each track's timing, visibility and provenance", () => {
  const scene = { ...cinematic, clock: {}, layers: [{ layerRef: "lines", temporal: { kind: "none" }, provenance: { status: "modeled" }, animation: { effect: { type: "flow" }, visible: false, timing: { cycleSeconds: 6, policy: "pingPong" } } }] };
  const clip = createCinematicClip({ cinematic: scene, observationTimes: [0] });
  const layer = clipToCinematicSpec(clip).cinematic.layers[0];
  assert.deepEqual([layer.provenance.status, layer.animation.visible, layer.animation.timing.cycleSeconds, layer.animation.timing.policy], ["modeled", false, 6, "pingPong"]);
  assert.deepEqual(clip.range, { start: "", end: "" }, "an Ambient Clip has no invented dates");
});

test("a Clip keeps a Sequence's order and a sweep's label field", () => {
  const sequence = { ...cinematic, clock: { durationSeconds: 20 }, layers: [{ layerRef: "rocks", temporal: { kind: "number", startField: "AGE", order: "listed", values: ["Statherian", "Norian"] } }] };
  const clip = normalizeCinematicClip(createCinematicClip({ cinematic: sequence, observationTimes: [1, 2] }));
  const temporal = clip.tracks.find((track) => track.type === "temporalLayer").temporal;
  assert.equal(temporal.order, "listed");
  assert.deepEqual(temporal.values, ["Statherian", "Norian"]);
  assert.deepEqual(clipToCinematicSpec(clip).cinematic.layers[0].temporal.values, ["Statherian", "Norian"]);
});
