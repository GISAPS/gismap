// The portable spatialChart (js/spatial-chart.js) as an ArcGIS SceneView
// renderer (SDK autocast JSON) and layer elevationInfo. Heights are display
// metres, as on MapLibre; source geometry and attributes are not changed.
import { spatialChartColor } from "./spatial-chart.js?v=0.69.9-order";

const FIELD = /^[A-Za-z_][A-Za-z0-9_.]*$/;
const field = (name) => {
  if (!FIELD.test(String(name || ""))) throw new Error(`Unsafe field name ${name}.`);
  return `$feature[${JSON.stringify(name)}]`;
};
const literal = (value) => (typeof value === "number" && Number.isFinite(value) ? String(value) : JSON.stringify(String(value)));
const number = (value) => Number(Number(value).toFixed(6));

const extrude = (color, size = 0) => ({ type: "polygon-3d", symbolLayers: [{ type: "extrude", size, material: { color }, edges: { type: "solid", color: [255, 255, 255, 0.35], size: 0.5 } }] });

/** The size visual variable for a height field, capped at the slot when the chart stacks groups. */
function heightVariable(chart) {
  if (!chart.height.field) return null;
  const raw = `Max(0, DefaultValue(${field(chart.height.field)}, 0)) * ${number(chart.height.scale)}`;
  const expression = chart.mode === "attribute-extrusion" ? raw : `Min(${number(chart.height.slotMeters)}, Max(${number(chart.height.thicknessMeters)}, ${raw}))`;
  return { type: "size", valueExpression: expression, valueExpressionTitle: `${chart.height.field} × ${chart.height.scale}`, valueUnit: "meters" };
}

/**
 * palette: the layer's current style, read from the live renderer:
 * { type: "simple" | "class-breaks" | "unique-value", field, classBreaks: [{ minValue, maxValue, label, color }],
 *   uniqueValues: [{ value, label, color }], defaultColor, defaultLabel, visualVariables: [non-size variables] }.
 * Returns { renderer, elevationInfo }.
 */
export function spatialChartArcgis(chart, palette = {}) {
  if (!chart) throw new Error("No spatial chart to draw.");
  const fallback = palette.defaultColor || "#1b7f6a";
  const sizeVariable = heightVariable(chart);
  const thickness = chart.mode === "attribute-extrusion" ? 0 : number(chart.height.thicknessMeters);
  const keepStyle = chart.mode === "attribute-extrusion" || chart.color.strategy === "original";
  let renderer;
  if (keepStyle) {
    // The layer's own classes and colours, extruded.
    if (palette.type === "class-breaks" && palette.classBreaks?.length) {
      renderer = { type: "class-breaks", field: palette.field, classBreakInfos: palette.classBreaks.map((item) => ({ minValue: item.minValue, maxValue: item.maxValue, label: item.label, symbol: extrude(item.color, thickness) })) };
    } else if (palette.type === "unique-value" && palette.uniqueValues?.length) {
      renderer = { type: "unique-value", field: palette.field, uniqueValueInfos: palette.uniqueValues.map((item) => ({ value: item.value, label: item.label, symbol: extrude(item.color, thickness) })) };
    } else renderer = { type: "simple", symbol: extrude(fallback, thickness) };
    if (renderer.type !== "simple") Object.assign(renderer, { defaultSymbol: extrude(palette.defaultColor || [180, 180, 180, 0.8], thickness), defaultLabel: palette.defaultLabel || "Other" });
  } else {
    // One colour per group, matching the MapLibre chart and the legend's slots.
    renderer = {
      type: "unique-value",
      field: chart.groupBy,
      uniqueValueInfos: chart.groups.map((value, index) => ({ value, label: String(value), symbol: extrude(spatialChartColor(index, chart.groups.length), thickness) })),
    };
  }
  const variables = [...(keepStyle ? palette.visualVariables || [] : []).filter((variable) => variable?.type !== "size"), ...(sizeVariable ? [sizeVariable] : [])];
  if (variables.length) renderer.visualVariables = variables;
  if (chart.mode === "attribute-extrusion") return { renderer, elevationInfo: { mode: "on-the-ground" } };
  // Each group's slab sits at its slot: base = index × (slot + gap), as on MapLibre.
  const stride = number(chart.height.slotMeters + chart.height.gapMeters);
  const cases = chart.groups.flatMap((value, index) => [literal(value), String(number(index * stride))]);
  return {
    renderer,
    elevationInfo: { mode: "relative-to-ground", featureExpressionInfo: { expression: `Decode(${field(chart.groupBy)}, ${cases.join(", ")}, 0)` }, unit: "meters" },
  };
}
