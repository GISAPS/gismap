// Suggest how to animate a layer, with the reason for each suggestion.
// Rules only (no AI): geometry, field names/types and the layer's title. A
// Timeline is offered only when a real date field exists; without one the
// suggestions are Ambient loops or a Scenario sweep, never an invented date.
import { CINEMATIC_EFFECTS, effectFields, suggestEffect, valueField } from "./cinematic-effects.js?v=0.70.3-geology";
import { numericFieldCandidates, temporalFieldCandidates } from "./temporal-adapter.js?v=0.4.0-sequence";

const geometryOf = (layer) => (/point/i.test(layer?.geometryType || "") ? "point" : /line/i.test(layer?.geometryType || "") ? "line" : /polygon/i.test(layer?.geometryType || "") ? "polygon" : "");
const plural = { point: "points", line: "lines", polygon: "areas" };

/**
 * Ranked suggestions for `layer` ({ title, geometryType, fields }), best first:
 * [{ id, kind: "time" | "number" | "none", order?, effect, field, timeMode, label, reason, provenance }].
 * `order` ("listed") marks a Sequence: the field's values played in the layer's 3D chart order.
 */
export function recommendAnimations(layer = {}, { sample = {} } = {}) {
  const geometry = geometryOf(layer);
  const fields = layer.fields || [];
  const title = String(layer.title || "");
  const dates = temporalFieldCandidates(layer);
  const numbers = numericFieldCandidates(layer);
  const found = effectFields(fields, sample);
  const themed = suggestEffect({ title, geometryType: layer.geometryType, fields, sample });
  const value = valueField(fields, sample);
  const things = plural[geometry] || "features";
  const out = [];
  const add = (item) => { if (!out.some((existing) => existing.id === item.id)) out.push(item); };

  if (dates.length) {
    const date = dates[0];
    const effect = themed === "extrude" ? "glow" : themed;
    add({ id: `timeline-${effect}`, kind: "time", field: date.name, effect, timeMode: geometry === "point" ? "cumulative" : "instant",
      label: `Timeline: play ${things} by ${date.label}`, provenance: "observed",
      reason: `${date.label} holds real dates, so playback can step through the recorded observations${geometry === "point" ? " and build them up" : ""}.` });
  }
  // A stacked 3D chart already says what order its groups go in: play them in it, bottom slab first.
  const chart = layer.spatialChart;
  if (chart?.groupBy && chart.groups?.length > 1 && chart.mode !== "attribute-extrusion") {
    const field = fields.find((item) => item.name === chart.groupBy);
    const name = field?.alias || chart.groupBy;
    add({ id: "sequence-strata", kind: "number", order: "listed", field: chart.groupBy, effect: "strata", timeMode: "cumulative",
      label: `Strata: build up by ${name}, in stacked order`, provenance: "observed",
      reason: `The layer is stacked by ${name}, so playback can drop each of its ${chart.groups.length} groups onto the stack in the chart's order, bottom first. The order is the chart's; the steps are not dates.` });
  }
  if (geometry === "line" && themed === "trains") {
    add({ id: "ambient-trains", kind: "none", effect: "trains", label: "Ambient: trains along the lines", provenance: "illustrative",
      reason: "A rail or transit network suits trains running both ways along each line. They are not real vehicle positions or timetables." });
  }
  if (geometry === "line" && themed === "electricity") {
    add({ id: "ambient-electricity", kind: "none", effect: "electricity", label: "Ambient: electric flow along the lines", provenance: "illustrative",
      reason: "Utility lines suit decorative energy pulses. They do not show measured voltage, load, direction, or outages." });
  }
  if (geometry === "line" && ["sailboats", "ships"].includes(themed)) {
    const vessel = themed === "sailboats" ? "sailboats" : "ships";
    add({ id: `ambient-${themed}`, kind: "none", effect: themed, label: `Ambient: ${vessel} along the routes`, provenance: "illustrative",
      reason: `The named water routes suit symbolic ${vessel}; they are not observed vessel positions, AIS tracks, or schedules.` });
  }
  if (geometry === "line" && ["birds", "drones", "airplanes", "helicopters"].includes(themed)) {
    add({ id: `ambient-${themed}`, kind: "none", effect: themed, label: `Ambient: ${themed} along the routes`, provenance: "illustrative",
      reason: `The line geometry can host symbolic ${themed}; their movement is decorative unless the layer is an observed track dataset.` });
  }
  if (geometry === "line" && themed === "traffic") {
    add({ id: "ambient-traffic", kind: "none", effect: "traffic", label: "Ambient: traffic along the roads", provenance: "illustrative",
      reason: "A road network suits car lights moving both ways along each road. Their speed and spacing are styling, not measured traffic." });
  }
  if (geometry === "line") {
    add({ id: "ambient-flow", kind: "none", effect: "flow", label: "Ambient: flow along the lines", provenance: "illustrative",
      reason: `Line data${found.direction || found.speed ? ` with ${[found.direction, found.speed].filter(Boolean).join(" and ")}` : ""} suits light moving along each line. The speed is styling, not a measured flow.` });
  }
  if (geometry === "polygon" && value) {
    add({ id: "ambient-extrude", kind: "none", effect: "extrude", field: value, label: `Ambient: areas rise to ${value}`, provenance: "observed",
      reason: `${value} is a number on every area, so heights can show it; the rise is the animation, the heights are the data.` });
  }
  if (geometry === "point") {
    const pulse = found.magnitude ? ` sized by ${found.magnitude}` : "";
    const effect = themed === "glow" || themed === "extrude" ? "pulse" : themed;
    const label = effect === "wind" ? "wind streaks" : ["snow", "rain", "fog", "lightning", "tornado", "hurricane", "storm"].includes(effect) ? CINEMATIC_EFFECTS?.[effect]?.label || effect : "pulsing points";
    add({ id: `ambient-${effect}`, kind: "none", effect, label: `Ambient: ${label}`, provenance: "illustrative",
      reason: `Points without a timeline can animate in place${pulse}, with a clear illustrative label.` });
  }
  if (numbers.length && !dates.length) {
    const sweep = numbers.find((field) => field.name === value) || numbers[0];
    add({ id: "scenario-sweep", kind: "number", field: sweep.name, effect: themed === "extrude" ? "glow" : themed, timeMode: "cumulative",
      label: `Scenario: sweep ${sweep.label} from low to high`, provenance: "illustrative",
      reason: `${sweep.label} is a number, so playback can step through its values (up to each value at a time); it is a sweep, not time.` });
  }
  if (themed !== "extrude" && !out.some((item) => item.kind === "none" && item.effect === themed)) {
    add({ id: `ambient-${themed}`, kind: "none", effect: themed, label: `Ambient: ${themed} on every feature`, provenance: "illustrative",
      reason: `The layer's name and shape suggest ${themed}; every feature shows at once with the effect looping.` });
  }
  add({ id: "ambient-reveal", kind: "none", effect: "reveal", field: value || null, label: value ? `Ambient: reveal in order of ${value}` : "Ambient: reveal one after another", provenance: "illustrative",
    reason: value ? `Features appear in order of ${value}, lowest first. The order is the data's; the pacing is styling.` : "Features appear in their stored order. That order is not a date and is labelled illustrative." });
  return out;
}
