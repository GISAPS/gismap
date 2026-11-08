// Build the legend from the same ArcGIS renderer symbols used by MapLibre's
// paint adapter. The Mapbox legend plugin works on style layers, but GISMap Online
// creates several style layers per dataset and retains class labels here.
import { rendererToPaint, rendererValue, symbolColor, symbolPaint } from "./arcgis-renderer.js?v=0.42.0";

export function legendForLayer(record, fallbackColor) {
  // A map or image service draws its own pictures; its published legend swatches stand in for symbols.
  if (record.kind === "raster") return record.serviceLegend?.length ? { entries: [], images: record.serviceLegend } : { entries: [], note: "Legend unavailable for this image layer." };
  const renderer = record.renderer || record.serviceRenderer;
  const usable = renderer && rendererToPaint(renderer);
  const geometry = /point/i.test(record.geometryType || "") ? "point" : /line/i.test(record.geometryType || "") ? "line" : "polygon";
  const fallback = geometry === "point" ? { circle: fallbackColor } : geometry === "line" ? { line: fallbackColor } : { fill: fallbackColor, outline: fallbackColor };
  const defaultPaint = { ...fallback, ...Object.fromEntries(Object.entries(symbolPaint(renderer?.defaultSymbol)).filter(([, value]) => value != null)) };
  const entry = (label, symbol) => ({ label: String(label ?? ""), geometry, paint: { ...defaultPaint, ...Object.fromEntries(Object.entries(symbolPaint(symbol)).filter(([, value]) => value != null)) } });
  if (!usable) return { entries: [entry("", null)] };
  const colorVariable = (renderer.visualVariables || []).find((item) => /^color(Info)?$/.test(item.type) && item.field && item.stops?.length);
  if (colorVariable) {
    const stops = colorVariable.stops.filter((stop) => Number.isFinite(stop.value)).sort((a, b) => a.value - b.value);
    if (stops.length) return { field: colorVariable.field, entries: stops.map((stop) => {
      const item = entry(stop.label ?? stop.value, renderer.symbol);
      const color = symbolColor(stop.color, { webMap: colorVariable.type === "colorInfo" }) || fallbackColor;
      item.paint[geometry === "point" ? "circle" : geometry === "line" ? "line" : "fill"] = color;
      return item;
    }) };
  }
  const field = renderer.valueExpressionTitle || rendererValue(renderer).field;
  const classes = renderer.uniqueValueInfos || renderer.classBreakInfos;
  if (Array.isArray(classes) && classes.length && rendererValue(renderer).field) {
    const matches = classMatches(renderer);
    const entries = classes.map((info, index) => ({ ...entry(info.label ?? info.value ?? `${info.minValue ?? renderer.minValue ?? ""} – ${info.maxValue ?? info.classMaxValue ?? ""}`, info.symbol), ...(matches[index] ? { match: matches[index] } : {}) }));
    if (renderer.defaultSymbol) entries.push({ ...entry(renderer.defaultLabel || "Other", renderer.defaultSymbol), ...(matches.length && matches.every(Boolean) ? { match: ["!", ["any", ...matches]] } : {}) });
    return { field, entries };
  }
  return { entries: [entry(renderer.label || "", renderer.symbol || renderer.defaultSymbol)] };
}

/**
 * Each class's MapLibre filter, as the paint adapter draws it, so a legend row
 * can pick out its features. Null for a class it cannot express.
 */
function classMatches(renderer) {
  const { field, normalizeBy, exclude } = rendererValue(renderer);
  if (!field) return [];
  const raw = ["get", field];
  if (renderer.uniqueValueInfos) return renderer.uniqueValueInfos.map((info) => info?.value != null ? ["==", ["to-string", raw], String(info.value)] : null);
  const value = normalizeBy ? ["/", ["to-number", raw, 0], ["to-number", ["get", normalizeBy], 1]] : ["to-number", raw, 0];
  const present = ["all", ["!=", raw, null], ...(exclude.length ? [["!", ["in", raw, ["literal", exclude]]]] : []), ...(normalizeBy ? [["!=", ["get", normalizeBy], null], ["!=", ["get", normalizeBy], 0]] : [])];
  let lower = Number.isFinite(renderer.minValue) ? renderer.minValue : -Infinity;
  let previous = null;
  return renderer.classBreakInfos.map((info) => {
    const min = Number.isFinite(info.minValue) ? info.minValue : lower;
    const max = Number.isFinite(info.maxValue) ? info.maxValue : Number(info.classMaxValue);
    // The paint takes the first class that fits, so a shared boundary belongs to the lower class.
    const above = min === previous ? ">" : ">=";
    previous = lower = max;
    if (!Number.isFinite(max)) return null;
    return ["all", present, ...(Number.isFinite(min) ? [[above, value, min]] : []), ["<=", value, max]];
  });
}
