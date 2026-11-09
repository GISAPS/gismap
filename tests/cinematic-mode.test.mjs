import test from "node:test";
import assert from "node:assert/strict";
import { CinematicModeController } from "../js/cinematic/mode.js";

test("cinematic mode applies transient observed IDs and restores the prior filter", async () => {
  const applied = [];
  const effects = [];
  const opacity = [];
  const focused = [];
  const layer = { uid: "perimeters", title: "Perimeters", queryable: true, objectIdField: "OBJECTID", maxRecordCount: 100, opacity: 0.8 };
  const mapController = {
    getLayer: (id) => id === "perimeters" ? layer : null,
    getFeatureFilter: async () => ({ objectIds: [99] }),
    getViewExtent: () => ({ xmin: -0.1, ymin: -0.1, xmax: 1.1, ymax: 1.1 }),
    setFeatureFilter: async (_id, filter) => { applied.push(filter); return true; },
    setOpacity: async (_id, value) => { opacity.push(value); },
    goToFeatures: async (features, options) => { focused.push({ features, options }); },
    setCinematicEffect: async (_id, effect) => { effects.push(effect); return true; },
    clearCinematicEffect: () => { effects.push(null); },
    queryFeatures: async () => ({ features: [
      { attributes: { OBJECTID: 1, incident: "a", observed_at: "2024-08-14T00:00:00Z" }, geometry: { type: "LineString", coordinates: [[0, 0], [1, 1]] } },
      { attributes: { OBJECTID: 2, incident: "a", observed_at: "2024-08-15T00:00:00Z" }, geometry: { type: "LineString", coordinates: [[1, 1], [2, 2]] } },
    ] }),
  };
  const mode = new CinematicModeController({ mapController });
  await mode.load({ cinematic: { title: "Observed", layers: [{ layerRef: "perimeters", temporal: { startField: "observed_at", groupField: "incident", featureIdField: "OBJECTID" } }] } });
  assert.equal(mode.state().spec.cinematic.intent, "explore");
  mode.setIntent("investigate");
  assert.equal(mode.state().spec.cinematic.intent, "investigate");
  assert.equal(mode.state().layers[0].observedCount, 1);
  assert.deepEqual(applied.at(-1), { objectIds: [1] });
  await mode.focusCurrentObservation();
  assert.equal(focused.at(-1).features[0].attributes.OBJECTID, 1);
  mode.seekObservation(1);
  await mode.renderTask;
  assert.deepEqual(applied.at(-1), { objectIds: [2] });
  mode.setTimeMode("cumulative");
  await mode.renderTask;
  assert.deepEqual(applied.at(-1), { objectIds: [1, 2] });
  mode.setLocalWindow(true);
  await mode.renderTask;
  assert.equal(mode.state().localWindow, true);
  assert.equal(mode.state().timeline.ticks.length, 2);
  // Changing the local window intentionally resets playback to that window's start.
  assert.deepEqual(applied.at(-1), { objectIds: [1] });
  mode.seekObservation(1);
  await mode.renderTask;
  mode.setBoundaryGlow(true);
  await mode.renderTask;
  assert.equal(effects.at(-1).type, "observed-effect");
  assert.equal(effects.at(-1).effect, "glow");
  assert.equal(effects.at(-1).items.length, 2);
  // Only the record first observed at the current tick flares as new.
  assert.deepEqual(effects.at(-1).items.map((item) => item.fresh), [false, true]);
  mode.setEffect("fire");
  await mode.renderTask;
  assert.equal(effects.at(-1).effect, "fire");
  assert.equal(mode.state().layers[0].effect, "fire");
  mode.setBoundaryGlow(false);
  await mode.renderTask;
  assert.equal(effects.at(-1), null);
  await mode.setLayerOpacity(0.4);
  assert.equal(opacity.at(-1), 0.4);
  await mode.destroy();
  assert.deepEqual(applied.at(-1), { objectIds: [99] });
  assert.equal(opacity.at(-1), 0.8);
});

test("deleting a cinematic source clears its transient effects and ends a one-layer scene", async () => {
  let exists = true;
  const cleared = [];
  const layer = { uid: "fires", title: "Fires", queryable: true, objectIdField: "OBJECTID", fields: [] };
  const mapController = {
    getLayer: () => (exists ? layer : null), getFeatureFilter: async () => null,
    setFeatureFilter: async () => true, setOpacity: async () => {},
    queryFeatures: async () => ({ features: [{ attributes: { OBJECTID: 1 }, geometry: { type: "Point", coordinates: [0, 0] } }] }),
    setCinematicEffect: async () => true,
    clearCinematicEffect: (uid) => { cleared.push(uid); },
  };
  const mode = new CinematicModeController({ mapController });
  await mode.load({ cinematic: { id: "fire-scene", layers: [{ layerRef: "fires", temporal: { kind: "none" }, animation: { effect: { type: "fire" } } }] } });
  cleared.length = 0;
  exists = false;
  assert.equal(await mode.removeDeletedLayer("fires"), true);
  assert.deepEqual(cleared, ["cinematic:fire-scene:fires", "cinematic:fire-scene:fires:settled"]);
  assert.equal(mode.state().spec, null);
  assert.deepEqual(mode.state().layers, []);
});

test("a Clip can resolve its durable service URL after a shared Brief gives the layer a new uid", async () => {
  const url = "https://example.test/arcgis/rest/services/Historical_Quakes/FeatureServer/0";
  const layer = { uid: "new-session-uid", title: "Historical Quakes", url, queryable: true, objectIdField: "OBJECTID", opacity: 0.9 };
  const mapController = {
    getLayer: (ref) => ref === layer.uid ? layer : null,
    getLayers: () => [layer],
    getLayerConfig: () => ({ url }),
    getFeatureFilter: async () => null,
    setFeatureFilter: async () => true,
    setOpacity: async () => {},
    queryFeatures: async () => ({ features: [{ attributes: { OBJECTID: 1, time: Date.UTC(2026, 0, 1) }, geometry: { type: "Point", coordinates: [0, 0] } }] }),
  };
  const mode = new CinematicModeController({ mapController });
  await mode.load({ cinematic: { layers: [{ layerRef: url, temporal: { startField: "time" } }] } });
  assert.equal(mode.state().layers[0].uid, layer.uid);
  await mode.destroy();
});

test("cinematic mode loads every page so playback starts at the earliest record", async () => {
  // A newest-first feed of 25 records served 10 at a time.
  const rows = Array.from({ length: 25 }, (_, index) => ({ attributes: { OBJECTID: index + 1, time: Date.UTC(2026, 8, 1 + index) }, geometry: { type: "Point", coordinates: [0, 0] } })).reverse();
  const requests = [];
  const layer = { uid: "quakes", title: "Quakes", queryable: true, objectIdField: "OBJECTID", maxRecordCount: 10 };
  const mapController = {
    getLayer: (id) => id === "quakes" ? layer : null,
    getFeatureFilter: async () => null,
    setFeatureFilter: async () => true,
    setOpacity: async () => {},
    queryFeatures: async (_id, params) => {
      requests.push(params);
      const sorted = params.orderByFields?.[0] === "time ASC" ? [...rows].sort((a, b) => a.attributes.time - b.attributes.time) : rows;
      const page = sorted.slice(params.start || 0, (params.start || 0) + params.num);
      return { features: page, exceededTransferLimit: (params.start || 0) + params.num < rows.length };
    },
  };
  const mode = new CinematicModeController({ mapController });
  await mode.load({ cinematic: { layers: [{ layerRef: "quakes", temporal: { startField: "time" } }] } });
  assert.deepEqual(requests.map((params) => params.start), [0, 10, 20]);
  assert.equal(mode.state().timeline.ticks.length, 25);
  assert.equal(mode.state().timeline.observationTime, Date.UTC(2026, 8, 1));
  assert.equal(mode.state().layers[0].truncated, false);
  await mode.destroy();
});

test("a cinematic clock range limits playback to the observations inside it", async () => {
  const rows = [1, 2, 3, 4].map((day) => ({ attributes: { OBJECTID: day, time: Date.UTC(2026, 9, day) }, geometry: { type: "Point", coordinates: [0, 0] } }));
  const layer = { uid: "quakes", title: "Quakes", queryable: true, objectIdField: "OBJECTID" };
  const mapController = { getLayer: () => layer, getFeatureFilter: async () => null, setFeatureFilter: async () => true, setOpacity: async () => {}, queryFeatures: async () => ({ features: rows }) };
  const mode = new CinematicModeController({ mapController });
  await mode.load({ cinematic: { clock: { start: "2026-10-02T00:00:00Z", end: "2026-10-03T00:00:00Z" }, layers: [{ layerRef: "quakes", temporal: { startField: "time" } }] } });
  assert.deepEqual(mode.state().timeline.ticks, [Date.UTC(2026, 9, 2), Date.UTC(2026, 9, 3)]);
  await mode.destroy();
});

test("playback can be limited to a date range and jump to a date", async () => {
  const day = (n) => Date.UTC(2026, 9, n);
  const rows = [1, 2, 3, 4, 5].map((n) => ({ attributes: { OBJECTID: n, time: day(n) }, geometry: { type: "Point", coordinates: [0, 0] } }));
  const layer = { uid: "quakes", title: "Quakes", queryable: true, objectIdField: "OBJECTID" };
  const mapController = { getLayer: () => layer, getFeatureFilter: async () => null, setFeatureFilter: async () => true, setOpacity: async () => {}, queryFeatures: async () => ({ features: rows }) };
  const mode = new CinematicModeController({ mapController });
  await mode.load({ cinematic: { layers: [{ layerRef: "quakes", temporal: { startField: "time" } }] } });
  mode.seek(day(3));
  assert.equal(mode.setPlaybackRange(new Date(day(2)).toISOString(), day(4)), true);
  assert.deepEqual(mode.state().timeline.ticks, [day(2), day(3), day(4)]);
  // The current moment is kept when it is inside the new range, and the range is saved in the spec.
  assert.equal(mode.state().timeline.observationTime, day(3));
  assert.equal(mode.exportCinematicSpec().cinematic.clock.start, new Date(day(2)).toISOString());
  // Go to date: the latest observation on or before it, within the playing range.
  assert.equal(mode.goToTime(day(3) + 3600000), day(3));
  assert.equal(mode.goToTime(day(1)), day(2));
  assert.equal(mode.goToTime(day(9)), day(4));
  assert.equal(mode.goToTime("not a date"), null);
  assert.throws(() => mode.setPlaybackRange(day(4), day(2)), /after the start/);
  assert.throws(() => mode.setPlaybackRange(day(4) + 1000, day(4) + 2000), /No observations/);
  // Empty bounds play everything again.
  mode.setPlaybackRange("", "");
  assert.equal(mode.state().timeline.ticks.length, 5);
  await mode.destroy();
});

test("a large build-up redraws only its recent records each step and settles the rest occasionally", async () => {
  const rows = Array.from({ length: 1000 }, (_, n) => ({ attributes: { OBJECTID: n + 1, time: Date.UTC(2026, 0, 1) + n * 3600000 }, geometry: { type: "LineString", coordinates: [[n * 0.01, 0], [n * 0.01 + 0.005, 0.005]] } }));
  const layer = { uid: "fires", title: "Fires", queryable: true, objectIdField: "OBJECTID" };
  const calls = [];
  const mapController = {
    getLayer: () => layer, getFeatureFilter: async () => null, setFeatureFilter: async () => true, setOpacity: async () => {},
    queryFeatures: async () => ({ features: rows }), getViewState: () => ({ zoom: 8 }),
    setCinematicEffect: async (uid, effect) => { calls.push({ uid, count: effect.items.length, fresh: effect.items.filter((item) => item.fresh).length, quality: effect.quality, settled: effect.settled === true }); return true; },
    clearCinematicEffect: () => {},
  };
  const mode = new CinematicModeController({ mapController });
  await mode.load({ cinematic: { clock: { timeMode: "cumulative" }, layers: [{ layerRef: "fires", temporal: { startField: "time" }, animation: { effect: { type: "fire" } } }] } });
  calls.length = 0;
  for (let index = 600; index < 640; index += 1) { mode.seekObservation(index); await mode.renderTask; }
  const settled = calls.filter((call) => call.uid.endsWith(":settled"));
  const recent = calls.filter((call) => !call.uid.endsWith(":settled"));
  assert.equal(recent.length, 40, "the recent layer follows every step");
  assert.ok(settled.length <= 2, `settled rebuilds stay rare (${settled.length})`);
  assert.ok(recent.every((call) => call.count <= 241 && call.fresh === 1), "recent layers are small and include the new record");
  assert.equal(settled[0].quality, "eco");
  assert.equal(settled[0].settled, true, "settled records are flagged so the engine can draw them natively");
  // Stepping back re-settles from the new position.
  calls.length = 0;
  mode.seekObservation(300); await mode.renderTask;
  assert.equal(calls.filter((call) => call.uid.endsWith(":settled")).length, 1);
  await mode.destroy();
});

test("Scenario sweeps a numeric field and Ambient needs no field at all", async () => {
  const rows = [3, 1, 2, 2, 5].map((depth, n) => ({ attributes: { OBJECTID: n + 1, depth_ft: depth }, geometry: { type: "Point", coordinates: [n, 0] } }));
  const layer = { uid: "flood", title: "Flood", queryable: true, objectIdField: "OBJECTID" };
  const mapController = { getLayer: () => layer, getFeatureFilter: async () => null, setFeatureFilter: async () => true, setOpacity: async () => {}, queryFeatures: async () => ({ features: rows }) };
  const mode = new CinematicModeController({ mapController });
  await mode.load({ cinematic: { clock: { timeMode: "cumulative" }, layers: [{ layerRef: "flood", temporal: { kind: "number", startField: "depth_ft" } }] } });
  assert.equal(mode.valueKind(), "number");
  assert.deepEqual(mode.state().timeline.ticks, [1, 2, 3, 5]);
  mode.seekObservation(1); await mode.renderTask;
  assert.equal(mode.state().layers[0].observedCount, 3, "everything up to depth 2 is shown");
  assert.equal(mode.goToTime("2.5"), 2);
  mode.setPlaybackRange("2", "3");
  assert.deepEqual(mode.state().timeline.ticks, [2, 3]);
  assert.equal(mode.exportCinematicSpec().cinematic.clock.start, "2");
  await mode.destroy();
  // Ambient: no field; every feature is shown at once, and effects loop on their own.
  await mode.load({ cinematic: { layers: [{ layerRef: "flood", temporal: { kind: "none" } }] } });
  assert.equal(mode.valueKind(), "none");
  assert.deepEqual(mode.state().timeline.ticks, [0]);
  assert.equal(mode.state().layers[0].observedCount, 5);
  await mode.destroy();
});

test("the Create an animation guide walks every Cinematic step and is reachable from the menus", async () => {
  const { readFileSync } = await import("node:fs");
  const { CINEMATIC_WALKTHROUGH_STEPS } = await import("../js/workspace-walkthrough.js");
  const ui = readFileSync(new URL("../js/ui.js", import.meta.url), "utf8");
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.deepEqual(CINEMATIC_WALKTHROUGH_STEPS.map((step) => step.id), ["layer", "kind", "effect", "start", "play", "tune", "dates", "camera", "clip", "share"]);
  // Every step points at something the app draws.
  for (const step of CINEMATIC_WALKTHROUGH_STEPS) {
    for (const selector of step.desktop.split(",").map((item) => item.trim())) {
      const token = selector.match(/\[data-[\w-]+|#[\w-]+|\.[\w-]+/)?.[0]?.replace(/^\[/, "");
      assert.ok(ui.includes(token.replace(/^[#.]/, "")) || html.includes(token.replace(/^[#.]/, "")), `${step.id}: ${selector}`);
    }
  }
  assert.match(html, /data-action="guide-cinematic">Create an animation \(guide\)/);
  assert.match(ui, /case "guide-cinematic":[\s\S]*?this\.#startCinematicGuide\(\)/);
  // The setup dialog is reopened non-modally so the guide's own buttons stay usable.
  // The setup stays usable beside the guide: non-modal, floating over the map as a panel.
  assert.match(ui, /if \(this\.dialog\.matches\?\.\(":modal"\)\) \{ this\.dialog\.close\(\); this\.dialog\.show\(\); \}/);
  assert.match(ui, /classList\.add\("app-dialog--floating"\)/);
  // Cleared by the next ordinary dialog, not by a close listener: the swap's late close event
  // would otherwise strip it at step 1 and drop the setup off screen.
  assert.match(ui, /classList\.remove\("app-dialog--docked", "app-dialog--presentation-sheet", "app-dialog--floating"\)/);
  assert.doesNotMatch(ui, /addEventListener\("close", \(\) => this\.dialog\.classList\.remove\("app-dialog--floating"\)/);
  const css = readFileSync(new URL("../css/app.css", import.meta.url), "utf8");
  assert.match(css, /\.app-dialog--floating\[open\] \{ position:fixed;/);
  assert.match(css, /\.field\[hidden\] \{ display: none; \}/, "hidden setup fields (Steps, timestamp for Ambient) really hide");
});

test("Auto detail steps down a tier while playback stays slow, and never touches the data", async () => {
  globalThis.requestAnimationFrame ??= (callback) => setTimeout(() => callback(performance.now()), 2);
  globalThis.cancelAnimationFrame ??= (id) => clearTimeout(id);
  const rows = Array.from({ length: 400 }, (_, n) => ({ attributes: { OBJECTID: n + 1, time: Date.UTC(2026, 0, 1) + n * 3600000 }, geometry: { type: "LineString", coordinates: [[n * 0.01, 0], [n * 0.01 + 0.005, 0.005]] } }));
  const layer = { uid: "fires", title: "Fires", queryable: true, objectIdField: "OBJECTID" };
  const qualities = [], filters = [];
  let frameMs = 80, resets = 0;
  const mapController = {
    getLayer: () => layer, getFeatureFilter: async () => null, setOpacity: async () => {},
    setFeatureFilter: async (_id, filter) => { filters.push(filter.objectIds.length); return true; },
    queryFeatures: async () => ({ features: rows }), getViewState: () => ({ zoom: 8 }),
    setCinematicEffect: async (uid, effect) => { if (!uid.endsWith(":settled")) qualities.push(effect.quality); return true; },
    clearCinematicEffect: () => {},
    getCinematicEffectStats: ({ reset } = {}) => { if (reset) resets += 1; return { items: 1, vertices: 900, frameMs, fps: Math.round(1000 / frameMs), samples: 60 }; },
  };
  const mode = new CinematicModeController({ mapController });
  // 400 records is a "cinematic" scene for Auto by size alone.
  await mode.load({ cinematic: { clock: { timeMode: "instant", durationSeconds: 1, rate: 2 }, layers: [{ layerRef: "fires", temporal: { startField: "time" }, animation: { effect: { type: "fire" } } }] } });
  assert.equal(qualities.at(-1), "cinematic");
  mode.play();
  for (let wait = 0; wait < 300 && qualities.at(-1) !== "eco"; wait += 1) await new Promise((resolve) => setTimeout(resolve, 10));
  mode.pause(); await mode.renderTask;
  assert.equal(mode.state().detail.lightened, "eco");
  assert.ok(qualities.includes("balanced") && qualities.at(-1) === "eco", "steps down one tier at a time");
  assert.ok(resets >= 2);
  assert.ok(filters.every((count) => count === 1), "every observed record is still shown");
  // Choosing a tier by hand clears the adaptation.
  mode.setQuality("cinematic");
  assert.equal(mode.state().detail.lightened, null);
  await mode.destroy();
});

test("several tracks share one clock: Ambient tracks loop beside the timeline and can be added or removed", async () => {
  const quakes = Array.from({ length: 5 }, (_, n) => ({ attributes: { OBJECTID: n + 1, time: Date.UTC(2026, 0, 1 + n) }, geometry: { type: "Point", coordinates: [n, 0] } }));
  const lines = Array.from({ length: 3 }, (_, n) => ({ attributes: { OBJECTID: n + 1, kind: "main" }, geometry: { type: "LineString", coordinates: [[n, 1], [n + 1, 1]] } }));
  const trees = Array.from({ length: 2 }, (_, n) => ({ attributes: { OBJECTID: n + 1, planted: Date.UTC(2026, 0, 2 + n * 10) }, geometry: { type: "Point", coordinates: [n, 2] } }));
  const layers = {
    quakes: { uid: "quakes", title: "Quakes", queryable: true, objectIdField: "OBJECTID", fields: [{ name: "time", type: "date" }] },
    power: { uid: "power", title: "Power lines", queryable: true, objectIdField: "OBJECTID", fields: [] },
    trees: { uid: "trees", title: "Trees", queryable: true, objectIdField: "OBJECTID", fields: [{ name: "planted", type: "date" }] },
  };
  const rows = { quakes, power: lines, trees };
  const filters = {}, effects = [], restored = [];
  const mapController = {
    getLayer: (id) => layers[id], getFeatureFilter: async (id) => ({ restoreMe: id }), setOpacity: async () => {},
    setFeatureFilter: async (id, filter) => { filters[id] = filter; if (filter?.restoreMe) restored.push(id); return true; },
    queryFeatures: async (id) => ({ features: rows[id] }), getViewState: () => ({ zoom: 6 }),
    setCinematicEffect: async (uid, effect) => { effects.push({ uid, effect: effect.effect, count: effect.items.length, fresh: effect.items.filter((item) => item.fresh).length }); return true; },
    clearCinematicEffect: () => {},
  };
  const mode = new CinematicModeController({ mapController });
  await mode.load({ cinematic: { clock: { timeMode: "instant" }, layers: [
    { layerRef: "power", temporal: { kind: "none" }, animation: { effect: { type: "flow" } } },
    { layerRef: "quakes", temporal: { startField: "time" }, animation: { effect: { type: "pulse" } } },
  ] } });
  // The first stepping track leads, even when an Ambient track is listed first.
  assert.equal(mode.valueKind(), "time");
  assert.equal(mode.state().timeline.ticks.length, 5);
  assert.deepEqual(mode.state().layers.map((item) => [item.uid, item.ambient]), [["power", true], ["quakes", false]]);
  assert.equal(filters.power.objectIds.length, 3, "an Ambient track shows every feature");
  assert.equal(filters.quakes.objectIds.length, 1);
  const flowDraws = () => effects.filter((call) => call.uid.endsWith(":power")).length;
  const before = flowDraws();
  for (let index = 1; index < 5; index += 1) { mode.seekObservation(index); await mode.renderTask; }
  assert.equal(flowDraws(), before, "an Ambient track's effect isn't rebuilt each step");
  assert.equal(filters.power.objectIds.length, 3);
  // Each track keeps its own effect.
  mode.setEffect("glow", "power"); await mode.renderTask;
  assert.equal(effects.filter((call) => call.uid.endsWith(":power")).at(-1).effect, "glow");
  assert.equal(mode.state().layers.find((item) => item.uid === "quakes").effectType, "pulse");
  // A second timeline track adds its records to the same clock.
  await mode.addTrack({ layerRef: "trees", kind: "time", startField: "planted", effect: "glow" });
  assert.equal(mode.state().layers.length, 3);
  assert.equal(mode.state().timeline.ticks.length, 6, "Jan 12 joins the five quake days (Jan 2 is shared)");
  await assert.rejects(() => mode.addTrack({ layerRef: "trees", kind: "none" }), /already a track/);
  await mode.removeTrack("trees");
  assert.deepEqual(restored, ["trees"], "a removed track gets its layer back as it was");
  assert.equal(mode.state().timeline.ticks.length, 5);
  assert.equal(mode.exportCinematicSpec().cinematic.layers.length, 2);
  await mode.removeTrack("power");
  await assert.rejects(() => mode.removeTrack("quakes"), /at least one track/);
  await mode.destroy();
});

test("a scene can't mix date and number timelines", async () => {
  const { importCinematicSpec } = await import("../js/cinematic/state.js");
  assert.throws(() => importCinematicSpec({ cinematic: { layers: [{ layerRef: "a", temporal: { startField: "t" } }, { layerRef: "b", temporal: { kind: "number", startField: "n" } }] } }), /all step by dates or all by numbers/);
  const numeric = importCinematicSpec({ cinematic: { clock: { start: "2", end: "10" }, layers: [{ layerRef: "a", temporal: { kind: "none" } }, { layerRef: "b", temporal: { kind: "number", startField: "n" } }] } });
  assert.equal(numeric.cinematic.clock.end, "10", "the lead track's kind decides how the range is read");
});

test("Cinematic mode without data opens a guide to adding some instead of an error", async () => {
  const { readFileSync } = await import("node:fs");
  const ui = readFileSync(new URL("../js/ui.js", import.meta.url), "utf8");
  assert.doesNotMatch(ui, /Cinematic mode needs a queryable feature layer/);
  assert.match(ui, /if \(!layers\.length\) \{\s*this\.#openCinematicNeedsData\(\);/);
  for (const choice of ["data-popular", "guide", "data-arcgis", "data-geojson"]) assert.match(ui, new RegExp(`data-cinematic-needs="${choice}"`));
});

test("leaving Cinematic mode keeps each track's effect for its layer", async () => {
  const fires = [{ attributes: { OBJECTID: 1, ALARM_DATE: Date.UTC(2024, 7, 1) }, geometry: { type: "Polygon", coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] } }];
  const roads = [{ attributes: { OBJECTID: 1 }, geometry: { type: "LineString", coordinates: [[0, 0], [1, 1]] } }];
  const layers = {
    fires: { uid: "fires", title: "Wildfire perimeters", geometryType: "polygon", queryable: true, objectIdField: "OBJECTID", fields: [] },
    roads: { uid: "roads", title: "Roads", geometryType: "polyline", queryable: true, objectIdField: "OBJECTID", fields: [] },
  };
  const rows = { fires, roads };
  const mapController = {
    getLayer: (id) => layers[id], getFeatureFilter: async () => null, setFeatureFilter: async () => true, setOpacity: async () => {},
    queryFeatures: async (id) => ({ features: rows[id] }), setCinematicEffect: async () => true, clearCinematicEffect: () => {},
  };
  const mode = new CinematicModeController({ mapController });
  await mode.load({ cinematic: { layers: [
    { layerRef: "fires", temporal: { startField: "ALARM_DATE" }, animation: { effect: { type: "auto", intensity: 1.5 } } },
    { layerRef: "roads", temporal: { kind: "none" }, animation: { effect: { type: "none" } } },
  ] } });
  // "Auto" is kept as the effect it shows (flames for a wildfire layer); a track without an effect leaves its layer alone.
  assert.deepEqual(mode.effectsToKeep(), [{ uid: "fires", title: "Wildfire perimeters", effect: { type: "fire", intensity: 1.5, color: null } }]);
  const ui = (await import("node:fs")).readFileSync(new URL("../js/ui.js", import.meta.url), "utf8");
  assert.match(ui, /async #leaveCinematic\(\) \{[\s\S]*?effectsToKeep\(\)[\s\S]*?setLayerEffect\(uid, effect\)/);
  await mode.destroy();
});

test("tracks carry their own timing to the effect, can be hidden, and the effects clock saves with the scene", async () => {
  const lines = [{ attributes: { OBJECTID: 1 }, geometry: { type: "LineString", coordinates: [[0, 0], [1, 1]] } }];
  const layer = { uid: "lines", title: "Power lines", geometryType: "polyline", queryable: true, objectIdField: "OBJECTID", fields: [] };
  const drawn = [], cleared = [];
  let frames = 0;
  const mapController = {
    getLayer: () => layer, getFeatureFilter: async () => null, setFeatureFilter: async () => true, setOpacity: async () => {},
    queryFeatures: async () => ({ features: lines }), requestEffectFrame: () => { frames += 1; },
    setCinematicEffect: async (uid, effect) => { drawn.push(effect); return true; }, clearCinematicEffect: (uid) => { cleared.push(uid); },
  };
  const mode = new CinematicModeController({ mapController });
  await mode.load({ cinematic: { layers: [{ layerRef: "lines", temporal: { kind: "none" }, animation: { effect: { type: "flow" } } }] } });
  assert.equal(mode.valueKind(), "none", "an Ambient scene needs no date field");
  assert.equal(drawn.at(-1).timing.policy, "loop");
  mode.setTrackTiming("lines", { cycleSeconds: 6, policy: "pingPong" });
  await mode.renderTask;
  assert.deepEqual([drawn.at(-1).timing.cycleSeconds, drawn.at(-1).timing.policy], [6, "pingPong"]);
  mode.setTrackVisible("lines", false);
  await mode.renderTask;
  assert.ok(cleared.includes("cinematic:" + mode.state().spec.cinematic.id + ":lines"), "a hidden track's effect is removed");
  assert.equal(mode.state().layers[0].visible, false);
  mode.setEffectsPlaying(false);
  mode.setEffectsRate(2);
  assert.ok(frames >= 2, "a paused clock still gets a frame drawn after each change");
  assert.deepEqual([mode.state().effects.playing, mode.state().effects.rate], [false, 2]);
  const saved = mode.exportCinematicSpec().cinematic;
  assert.deepEqual([saved.clock.effectsPlaying, saved.clock.effectsRate, saved.layers[0].animation.visible, saved.layers[0].animation.timing.cycleSeconds], [false, 2, false, 6]);
  mode.setTrackProvenance("lines", "modeled");
  assert.equal(mode.state().layers[0].provenance, "modeled");
  await mode.destroy();
});

test("a listed Sequence takes its order from the layer's 3D chart and names its steps", async () => {
  const layer = { uid: "rocks", title: "Rocks", queryable: true, objectIdField: "OBJECTID", opacity: 1, fields: [], spatialChart: { mode: "temporal-strata", groupBy: "AGE", groups: ["Statherian", "Norian", "Holocene"] } };
  const mapController = {
    getLayer: (id) => (id === "rocks" ? layer : null),
    getFeatureFilter: async () => null, setFeatureFilter: async () => true, setOpacity: async () => {},
    setCinematicEffect: async () => true, clearCinematicEffect: () => {},
    queryFeatures: async () => ({ features: ["Holocene", "Statherian", "Norian"].map((age, index) => ({ attributes: { OBJECTID: index + 1, AGE: age }, geometry: { type: "Polygon", coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] } })) }),
  };
  const mode = new CinematicModeController({ mapController });
  await mode.load({ cinematic: { layers: [{ layerRef: "rocks", temporal: { kind: "number", startField: "AGE", order: "listed" } }] } });
  const state = mode.state();
  assert.deepEqual(state.timeline.ticks, [1, 2, 3]);
  assert.deepEqual(state.layers[0].labels, { 1: "Statherian", 2: "Norian", 3: "Holocene" });
  assert.equal(state.layers[0].order, "listed");
  assert.deepEqual(state.spec.cinematic.layers[0].temporal.values, ["Statherian", "Norian", "Holocene"], "the order is saved with the scene");
  await mode.destroy();
});
