// Build the legend from the same ArcGIS renderer symbols used by MapLibre's
// paint adapter. The Mapbox legend plugin works on style layers, but GISMap Online
// creates several style layers per dataset and retains class labels here.
import { rendererToPaint, rendererValue, symbolColor, symbolPaint } from "./arcgis-renderer.js?v=0.42.0";

export function legendForLayer(record, fallbackColor) {
  if (record.kind === "raster") return { entries: [], note: "Legend unavailable for this image layer." };
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
    const entries = classes.map((info) => entry(info.label ?? info.value ?? `${info.minValue ?? renderer.minValue ?? ""} – ${info.maxValue ?? info.classMaxValue ?? ""}`, info.symbol));
    if (renderer.defaultSymbol) entries.push(entry(renderer.defaultLabel || "Other", renderer.defaultSymbol));
    return { field, entries };
  }
  return { entries: [entry(renderer.label || "", renderer.symbol || renderer.defaultSymbol)] };
}
