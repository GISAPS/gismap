import test from "node:test";
import assert from "node:assert/strict";
import { normalizeTemporalFeatures, observedFeatureIdsAt, observedFeaturesAt, parseTemporalValue, quantileSteps, temporalFieldCandidates, temporalModelInExtent } from "../js/cinematic/temporal-adapter.js";
import { importCinematicSpec } from "../js/cinematic/state.js";

const features = [
  { attributes: { OBJECTID: 1, fire: "a", observed_at: "2024-08-14T00:00:00Z" } },
  { attributes: { OBJECTID: 2, fire: "a", observed_at: "2024-08-15T00:00:00Z" } },
  { attributes: { OBJECTID: 3, fire: "b", observed_at: "2024-08-14T00:00:00Z" } },
  { attributes: { OBJECTID: 4, fire: "b", observed_at: "2024-08-16T00:00:00Z" } },
  { attributes: { OBJECTID: 5, fire: "a", observed_at: "not a date" } },
];

test("cinematic temporal adapter keeps observed group snapshots and rejects invalid times", () => {
  const model = normalizeTemporalFeatures(features, { timeField: "observed_at", groupField: "fire", objectIdField: "OBJECTID" });
  assert.equal(model.ticks.length, 3);
  assert.equal(model.invalid.length, 1);
  assert.deepEqual(observedFeatureIdsAt(model, Date.parse("2024-08-14T12:00:00Z")), [1, 3]);
  assert.deepEqual(observedFeatureIdsAt(model, Date.parse("2024-08-15T12:00:00Z")), [2, 3]);
  assert.deepEqual(observedFeatureIdsAt(model, Date.parse("2024-08-16T00:00:00Z")), [2, 4]);
});

test("cinematic mode does not guess numeric years as dates", () => {
  assert.equal(parseTemporalValue(2024), null);
  assert.equal(parseTemporalValue(1723593600000), 1723593600000);
  assert.deepEqual(temporalFieldCandidates({ fields: [{ name: "YEAR", type: "integer" }, { name: "observed_at", type: "date" }] }).map((field) => field.name), ["observed_at"]);
});

test("cumulative mode retains every observed record through the selected time", () => {
  const model = normalizeTemporalFeatures(features, { timeField: "observed_at", groupField: "fire", objectIdField: "OBJECTID" });
  assert.deepEqual(observedFeatureIdsAt(model, Date.parse("2024-08-15T12:00:00Z"), { timeMode: "cumulative" }), [1, 2, 3]);
  assert.deepEqual(observedFeaturesAt(model, Date.parse("2024-08-15T12:00:00Z"), { timeMode: "instant" }).map((item) => item.id), [2, 3]);
});

test("cinematic specs require explicit layer and time mapping", () => {
  assert.throws(() => importCinematicSpec({ cinematic: { layers: [{ layerRef: "x", temporal: {} }] } }), /startField/);
  const spec = importCinematicSpec({ cinematic: { title: "Observed boundary", layers: [{ layerRef: "x", temporal: { startField: "observed_at", featureIdField: "OBJECTID" } }], provenance: { interpolated: true } } });
  assert.equal(spec.cinematic.provenance.interpolated, false);
  assert.equal(spec.cinematic.layers[0].animation.template, "step-perimeter");
  assert.equal(spec.cinematic.clock.timeMode, "instant");
});

test("local-window models retain only observations whose geometry overlaps the map extent", () => {
  const model = normalizeTemporalFeatures([
    { attributes: { OBJECTID: 1, observed_at: "2024-08-14T00:00:00Z" }, geometry: { type: "Point", coordinates: [-120, 35] } },
    { attributes: { OBJECTID: 2, observed_at: "2024-08-15T00:00:00Z" }, geometry: { type: "Polygon", coordinates: [[[-102, 29], [-96, 29], [-96, 35], [-102, 35], [-102, 29]]] } },
  ], { timeField: "observed_at", objectIdField: "OBJECTID" });
  const local = temporalModelInExtent(model, { xmin: -101, ymin: 30, xmax: -99, ymax: 32 });
  assert.deepEqual(local.observations.map((item) => item.id), [2]);
  assert.equal(local.start, Date.parse("2024-08-15T00:00:00Z"));
});

test("Scenario sweeps bin many distinct values into quantile steps", () => {
  assert.equal(quantileSteps([1, 2, 3], 5), null);
  const features = Array.from({ length: 1000 }, (_, i) => ({ attributes: { OBJECTID: i, acres: i * 1.5 } }));
  const model = normalizeTemporalFeatures(features, { timeField: "acres", objectIdField: "OBJECTID", kind: "number", steps: 50 });
  assert.equal(model.ticks.length, 50);
  assert.equal(model.ticks.at(-1), 999 * 1.5);
  // Every record sits at the first step at or above its own value.
  for (const item of model.observations) assert.ok(item.time >= item.value);
  const exact = normalizeTemporalFeatures(features, { timeField: "acres", objectIdField: "OBJECTID", kind: "number" });
  assert.equal(exact.ticks.length, 1000);
});

const rocks = [
  { attributes: { OBJECTID: 1, AGE: "Norian", MA: 227, ERA: "Triassic" } },
  { attributes: { OBJECTID: 2, AGE: "Statherian", MA: 1800, ERA: "Paleoproterozoic" } },
  { attributes: { OBJECTID: 3, AGE: "Holocene", MA: 0.0117, ERA: "Quaternary" } },
  { attributes: { OBJECTID: 4, AGE: "Norian", MA: 227, ERA: "Triassic" } },
  { attributes: { OBJECTID: 5, AGE: "Unlisted", MA: null, ERA: "" } },
];

test("a listed Sequence steps a text field in the given order and names each step", () => {
  const model = normalizeTemporalFeatures(rocks, { kind: "number", timeField: "AGE", objectIdField: "OBJECTID", order: "listed", values: ["Statherian", "Norian", "Holocene"], steps: 2 });
  assert.deepEqual(model.ticks, [1, 2, 3], "every value is a step, even past the sweep's step count");
  assert.deepEqual(model.labels, { 1: "Statherian", 2: "Norian", 3: "Holocene" });
  assert.deepEqual(observedFeatureIdsAt(model, 2, { timeMode: "cumulative" }), [1, 2, 4]);
  assert.deepEqual(model.invalid, [{ index: 4, reason: "invalid-time" }], "a value outside the order is left out, not guessed");
  assert.throws(() => normalizeTemporalFeatures(rocks, { kind: "number", timeField: "AGE", objectIdField: "OBJECTID", order: "listed" }), /no listed order for AGE/);
});

test("an A to Z Sequence sorts the values itself, numbers in text by value", () => {
  const model = normalizeTemporalFeatures(rocks, { kind: "number", timeField: "AGE", objectIdField: "OBJECTID", order: "alphabetical" });
  assert.deepEqual(Object.values(model.labels), ["Holocene", "Norian", "Statherian", "Unlisted"]);
  const units = normalizeTemporalFeatures([{ attributes: { OBJECTID: 1, U: "Unit 10" } }, { attributes: { OBJECTID: 2, U: "unit 9" } }], { kind: "number", timeField: "U", objectIdField: "OBJECTID", order: "alphabetical" });
  assert.deepEqual(Object.values(units.labels), ["unit 9", "Unit 10"]);
});

test("a number sweep can name its steps from a text field on the same rows", () => {
  const model = normalizeTemporalFeatures(rocks.slice(0, 4), { kind: "number", timeField: "MA", objectIdField: "OBJECTID", labelField: "ERA" });
  assert.deepEqual(model.ticks, [0.0117, 227, 1800]);
  assert.deepEqual(model.labels, { 0.0117: "Quaternary", 227: "Triassic", 1800: "Paleoproterozoic" });
  // Binned into quantile steps, a step takes the label of the row whose own value it is.
  const binned = normalizeTemporalFeatures([1, 2, 3, 4].map((value) => ({ attributes: { OBJECTID: value, V: value, NAME: `n${value}` } })), { kind: "number", timeField: "V", objectIdField: "OBJECTID", labelField: "NAME", steps: 2 });
  assert.deepEqual(binned.ticks, [2, 4]);
  assert.deepEqual(binned.labels, { 2: "n2", 4: "n4" });
  assert.equal(normalizeTemporalFeatures(rocks, { kind: "number", timeField: "MA", objectIdField: "OBJECTID" }).labels, null);
});

test("Sequence and label settings survive the saved scene, only on number playback", () => {
  const spec = importCinematicSpec({ cinematic: { layers: [{ layerRef: "rocks", temporal: { kind: "number", startField: "AGE", order: "listed", values: ["Statherian", "Norian", "Norian", ""], labelField: "ERA" } }] } });
  const temporal = spec.cinematic.layers[0].temporal;
  assert.equal(temporal.order, "listed");
  assert.deepEqual(temporal.values, ["Statherian", "Norian"]);
  assert.equal(temporal.labelField, undefined, "a Sequence is its own label");
  const sweep = importCinematicSpec({ cinematic: { layers: [{ layerRef: "rocks", temporal: { kind: "number", startField: "MA", labelField: "ERA", order: "sideways" } }] } }).cinematic.layers[0].temporal;
  assert.equal(sweep.labelField, "ERA");
  assert.equal(sweep.order, undefined);
  const timeline = importCinematicSpec({ cinematic: { layers: [{ layerRef: "rocks", temporal: { startField: "observed_at", order: "listed", labelField: "ERA" } }] } }).cinematic.layers[0].temporal;
  assert.equal(timeline.order, undefined);
  assert.equal(timeline.labelField, undefined);
});
