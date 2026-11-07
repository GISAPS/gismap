// Portable configuration and MapLibre layer compilation for 3D spatial charts.
// Source geometries are never changed: these specs create derived render layers.

export const SPATIAL_CHART_MODES = Object.freeze([
  "attribute-extrusion",
  "temporal-strata",
  "stacked-footprints",
  "exploded-timeline",
]);

export const SPATIAL_CHART_TYPE = "spatial-3d-chart";
export const MAX_SPATIAL_CHART_GROUPS = 40;

const PALETTE = Object.freeze(["#2f7f73", "#4a9b78", "#77b66d", "#b7c85b", "#edbd51", "#ee8c42", "#d9573f", "#a83f55", "#70466e"]);
const FIELD_NAME = /^[A-Za-z_][A-Za-z0-9_.]*$/;
const finite = (value, fallback, min = 0, max = 1_000_000) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
};
const fieldName = (value) => {
  const name = String(value || "").trim();
  return FIELD_NAME.test(name) ? name : "";
};
const comparable = (a, b) => {
  const na = Number(a), nb = Number(b);
  if (Number.isFinite(na) && Number.isFinite(nb) && a !== "" && b !== "") return na - nb;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
};
// Too many groups is an error, not a silent slice: dropped groups would vanish from the map.
const uniqueValues = (values = [], field = "") => {
  const unique = [...new Map(values.filter((value) => value !== null && value !== undefined && value !== "").map((value) => [`${typeof value}:${String(value)}`, value])).values()].sort(comparable);
  if (unique.length > MAX_SPATIAL_CHART_GROUPS) throw new Error(`${field || "The group field"} has ${unique.length} distinct values; 3D spatial charts support at most ${MAX_SPATIAL_CHART_GROUPS}. Filter the layer or group by a coarser field.`);
  return unique;
};
const numericType = (type) => /integer|single|double|long|number|float|decimal/i.test(String(type || ""));

/** Validate and bound a chart configuration. Throws before anything is rendered. */
export function normalizeSpatialChart(input, { fields = [], geometryType = "polygon", groupValues = [] } = {}) {
  if (input == null || input === false) return null;
  if (!input || typeof input !== "object") throw new Error("The spatial chart configuration must be an object.");
  if (geometryType !== "polygon") throw new Error("3D spatial charts currently require polygon features.");
  const mode = SPATIAL_CHART_MODES.includes(input.mode) ? input.mode : "attribute-extrusion";
  const byName = new Map(fields.map((field) => [field.name, field]));
  const groupBy = fieldName(input.groupBy);
  const heightField = fieldName(input.height?.field);
  if (mode !== "attribute-extrusion" && (!groupBy || !byName.has(groupBy))) throw new Error("Choose a valid field for the chart's vertical groups.");
  if (mode === "attribute-extrusion" && (!heightField || !numericType(byName.get(heightField)?.type))) throw new Error("Choose a numeric height field for attribute extrusion.");
  if (heightField && (!byName.has(heightField) || !numericType(byName.get(heightField)?.type))) throw new Error("The chart height field must be numeric.");
  // Groups stack from the bottom up, lowest value first; "descending" puts the highest at the bottom.
  const order = mode !== "attribute-extrusion" && input.order === "descending" ? "descending" : "ascending";
  const sorted = mode === "attribute-extrusion" ? [] : uniqueValues(input.groups?.length ? input.groups : groupValues, groupBy);
  const groups = order === "descending" ? sorted.reverse() : sorted;
  if (mode !== "attribute-extrusion" && !groups.length) throw new Error(`No values were found in ${groupBy}.`);
  const heightMode = mode === "attribute-extrusion" ? "field" : heightField ? "magnitude" : "fixed-slot";
  return {
    type: SPATIAL_CHART_TYPE,
    mode,
    ...(groupBy ? { groupBy } : {}),
    ...(groups.length ? { groups } : {}),
    ...(order === "descending" ? { order } : {}),
    // The flat source outlines under the slabs are off unless asked for: they make a stack busy.
    ...(input.groundOutlines === true ? { groundOutlines: true } : {}),
    height: {
      mode: heightMode,
      ...(heightField ? { field: heightField } : {}),
      slotMeters: finite(input.height?.slotMeters, 400, 1),
      gapMeters: finite(input.height?.gapMeters, mode === "exploded-timeline" ? 300 : 80, 0),
      thicknessMeters: finite(input.height?.thicknessMeters, 120, 1),
      scale: finite(input.height?.scale, 1, 0, 100_000),
    },
    color: {
      field: fieldName(input.color?.field) || groupBy || heightField || null,
      strategy: input.color?.strategy === "original" ? "original" : "sequential",
    },
    geometry: { strategy: "source-footprints", aggregation: "none" },
    interaction: {
      hover: input.interaction?.hover !== false,
      select: input.interaction?.select !== false,
      explode: mode === "exploded-timeline" || input.interaction?.explode === true,
      scrubTimeline: ["temporal-strata", "exploded-timeline"].includes(mode) && input.interaction?.scrubTimeline !== false,
    },
  };
}

export function spatialChartColor(index, total) {
  if (total <= 1) return PALETTE[0];
  return PALETTE[Math.round(index * (PALETTE.length - 1) / (total - 1))];
}

/** Human-readable Z-axis semantics used by the legend, Briefs and agents. */
export function spatialChartAxis(chart) {
  if (!chart) return null;
  if (chart.mode === "attribute-extrusion") return { label: `Height: ${chart.height.field}`, detail: `Value × ${chart.height.scale.toLocaleString()} display meters` };
  const separation = chart.mode === "exploded-timeline" ? "exploded chronological slots" : chart.mode === "temporal-strata" ? "equal chronological slots" : "ordered event slots";
  const thickness = chart.height.field ? `; thickness: ${chart.height.field} × ${chart.height.scale.toLocaleString()}, capped at the ${chart.height.slotMeters.toLocaleString()} m slot` : "";
  return { label: `Z order: ${chart.groupBy}`, detail: `${separation}${thickness}. Heights are display offsets, not physical altitude.` };
}

/** Compile derived MapLibre fill-extrusion layers without modifying source data. */
export function spatialChartLayerSpecs({ chart, idPrefix, source, range = {}, visibility = "visible", opacity = 0.75, polygonFilter, featureFilter = null, originalColor = "#1b7f6a" }) {
  if (!chart) return [];
  const baseFilter = featureFilter ? ["all", polygonFilter, featureFilter] : polygonFilter;
  // A magnitude slab never grows past its slot, so it cannot cover the next group's slot.
  const fieldHeight = (base = 0) => ["+", base, ["min", chart.height.slotMeters, ["max", chart.height.thicknessMeters, ["*", ["max", 0, ["to-number", ["get", chart.height.field], 0]], chart.height.scale]]]];
  const paint = (base, height, color) => ({
    "fill-extrusion-color": color,
    "fill-extrusion-base": base,
    "fill-extrusion-height": height,
    "fill-extrusion-opacity": opacity,
  });
  if (chart.mode === "attribute-extrusion") {
    return [{ id: `${idPrefix}-spatial-chart-0`, type: "fill-extrusion", source, ...range, filter: baseFilter, layout: { visibility }, paint: paint(0, ["max", 0, ["*", ["to-number", ["get", chart.height.field], 0], chart.height.scale]], originalColor) }];
  }
  const stride = chart.height.slotMeters + chart.height.gapMeters;
  return chart.groups.map((value, index) => {
    const base = index * stride;
    const height = chart.height.field ? fieldHeight(base) : base + chart.height.thicknessMeters;
    const color = chart.color.strategy === "original" ? originalColor : spatialChartColor(index, chart.groups.length);
    const groupFilter = ["==", ["get", chart.groupBy], value];
    return { id: `${idPrefix}-spatial-chart-${index}`, type: "fill-extrusion", source, ...range, filter: ["all", baseFilter, groupFilter], layout: { visibility }, paint: paint(base, height, color) };
  });
}


const displayHeight = (meters) => (meters >= 1000 ? `${(meters / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} km` : `${Math.round(meters).toLocaleString()} m`);

/**
 * What a chart's legend shows: { heights: [{ value, label, ratio }], slots: [{ label, color }], usesRendererColors }.
 * `values` are the height field's values on the drawn features. Heights are display metres.
 */
export function spatialChartLegend(chart, values = []) {
  if (!chart) return null;
  const numbers = values.map(Number).filter((value) => Number.isFinite(value) && value > 0).sort((a, b) => a - b);
  const meters = (value) => (chart.mode === "attribute-extrusion" ? value * chart.height.scale : Math.min(chart.height.slotMeters, Math.max(chart.height.thicknessMeters, value * chart.height.scale)));
  const picks = numbers.length ? [...new Set([numbers.at(-1), numbers[Math.floor((numbers.length - 1) / 2)], numbers[0]])] : [];
  const top = picks.length ? meters(picks[0]) || 1 : 1;
  // A year (YEAR_, FIRE_YEAR) reads as 1989, not 1,989.
  const valueText = (value) => /year/i.test(chart.height.field || "") && Number.isInteger(value) ? String(value) : value.toLocaleString(undefined, { maximumFractionDigits: Math.abs(value) >= 100 ? 0 : Math.abs(value) >= 1 ? 2 : 4 });
  const heights = chart.height.field ? picks.map((value) => ({ value, label: `${valueText(value)} → ${displayHeight(meters(value))}`, ratio: Math.max(0.08, meters(value) / top) })) : [];
  const usesRendererColors = chart.mode === "attribute-extrusion" || chart.color.strategy === "original";
  // The highest slot is drawn on top, so the list reads top-down like the stack.
  const slots = chart.mode === "attribute-extrusion" ? [] : chart.groups.map((value, index) => ({
    label: `${value === "" ? "No value" : value}`,
    color: usesRendererColors ? null : spatialChartColor(index, chart.groups.length),
    base: index * (chart.height.slotMeters + chart.height.gapMeters),
  })).reverse();
  return { heights, slots, usesRendererColors };
}
