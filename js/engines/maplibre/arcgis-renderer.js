// ArcGIS renderers drawn by MapLibre. Both forms GISMap Online meets are read: the
// WebMap JSON services publish in drawingInfo ("uniqueValue", "esriSFS",
// colours as [r, g, b, 0–255]) and the autocast form renderer-spec.js
// compiles ("unique-value", "simple-fill", "#hex" or [r, g, b, 0–1]). The
// result is MapLibre paint for each layer kind, with data expressions for
// categories and class breaks. Pure: no DOM, no map SDK.

const POINTS_PER_PIXEL = 0.75;

/** A symbol colour as an rgba() string, or null. */
export function symbolColor(value, { webMap = false } = {}) {
  if (value == null) return null;
  if (typeof value === "string") return value;
  if (Array.isArray(value) && value.length >= 3) {
    const [r, g, b, a = webMap ? 255 : 1] = value;
    const alpha = webMap ? a / 255 : a;
    return `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${Math.max(0, Math.min(1, Number(alpha)))})`;
  }
  if (typeof value === "object" && Number.isFinite(value.r)) return `rgba(${value.r},${value.g},${value.b},${value.a ?? 1})`;
  return null;
}

/**
 * The paint properties one symbol stands for: { fill, outline, outlineWidth,
 * line, lineWidth, circle, radius, stroke, strokeWidth }, all optional.
 */
export function symbolPaint(symbol) {
  if (!symbol || typeof symbol !== "object") return {};
  const type = String(symbol.type || "");
  const webMap = type.startsWith("esri");
  const color = (value) => symbolColor(value, { webMap });
  const pixels = (points, fallback) => (Number.isFinite(Number(points)) ? Number(points) / POINTS_PER_PIXEL : fallback);
  switch (type) {
    case "esriSFS":
    case "simple-fill": {
      const empty = symbol.style === "esriSFSNull" || symbol.style === "none";
      return { fill: empty ? "rgba(0,0,0,0)" : color(symbol.color), outline: color(symbol.outline?.color), outlineWidth: pixels(symbol.outline?.width, 1) };
    }
    case "esriSLS":
    case "simple-line":
      return { line: color(symbol.color), lineWidth: pixels(symbol.width, 1.5), outline: color(symbol.color), outlineWidth: pixels(symbol.width, 1.5) };
    case "esriSMS":
    case "simple-marker":
      return { circle: color(symbol.color), radius: pixels(symbol.size, 8) / 2, stroke: color(symbol.outline?.color), strokeWidth: pixels(symbol.outline?.width, 1) };
    case "esriPMS":
    case "picture-marker":
      return { radius: pixels(symbol.width || symbol.size, 12) / 2 };
    case "esriPFS":
    case "picture-fill":
      return { outline: color(symbol.outline?.color), outlineWidth: pixels(symbol.outline?.width, 1) };
    default: {
      // 3D symbols (polygon-3d, point-3d, line-3d): the first layer's material colour.
      const layer = symbol.symbolLayers?.[0];
      const material = color(layer?.material?.color);
      if (!material) return {};
      return { fill: material, line: material, circle: material, outline: color(layer?.edges?.color) || material, radius: 5 };
    }
  }
}

/**
 * What a renderer is drawn from: { field, normalizeBy, exclude }. Arcade value
 * expressions are read only in the shape renderer-spec.js writes (one field,
 * optional normalisation, excluded codes); anything else gives no field.
 */
export function rendererValue(renderer) {
  if (renderer?.field) return { field: renderer.field, normalizeBy: renderer.normalizationField || null, exclude: [] };
  const expression = String(renderer?.valueExpression || "");
  const fields = [...expression.matchAll(/\$feature\[("(?:[^"\\]|\\.)*")\]/g)].map((match) => JSON.parse(match[1]));
  if (!fields.length) return { field: null, normalizeBy: null, exclude: [] };
  let exclude = [];
  const listed = expression.match(/Includes\((\[[^\]]*\]),\s*v\)/);
  if (listed) {
    try { exclude = JSON.parse(listed[1]); } catch { exclude = []; }
  }
  return { field: fields[0], normalizeBy: fields[1] || null, exclude };
}

/** The value expression for a renderer's field, null where the feature has no usable value. */
function valueOf({ field, normalizeBy, exclude }) {
  const raw = ["get", field];
  const excluded = exclude.length ? ["in", raw, ["literal", exclude]] : false;
  const missing = ["any", ["==", raw, null], ...(excluded ? [excluded] : [])];
  if (!normalizeBy) return { value: ["to-number", raw, 0], missing };
  const by = ["get", normalizeBy];
  return { value: ["/", ["to-number", raw, 0], ["to-number", by, 1]], missing: ["any", missing, ["==", by, null], ["==", by, 0]] };
}

const KEYS = ["fill", "outline", "outlineWidth", "line", "lineWidth", "circle", "radius", "stroke", "strokeWidth"];

/** One paint property across classes: a constant when every class agrees. */
function combine(key, defaultPaint, cases, build) {
  const fallback = defaultPaint[key] ?? null;
  const values = cases.map(({ paint }) => paint[key] ?? fallback);
  if (values.every((value) => value === null)) return undefined;
  if (values.every((value) => value === values[0]) && values[0] === fallback) return fallback ?? undefined;
  return build(values.map((value) => value ?? fallback ?? (/Width|radius/.test(key) ? 1 : "rgba(0,0,0,0)")), fallback ?? (/Width|radius/.test(key) ? 1 : "rgba(0,0,0,0)"));
}

/**
 * MapLibre paint for an ArcGIS renderer: { fill: {...}, line: {...}, circle: {...} }
 * keyed by layer kind, each holding MapLibre paint properties (colours carry
 * their own alpha, so opacities stay for the layer's opacity). Null for
 * renderers MapLibre cannot draw this way (heat maps, dot density).
 */
export function rendererToPaint(renderer, { transparency = 0 } = {}) {
  if (!renderer || typeof renderer !== "object") return null;
  const type = String(renderer.type || "");
  const visibility = 1 - Math.max(0, Math.min(100, Number(transparency) || 0)) / 100;
  let props;
  if (type === "simple") {
    props = symbolPaint(renderer.symbol);
  } else if (type === "uniqueValue" || type === "unique-value") {
    const { field } = rendererValue(renderer);
    const defaultPaint = symbolPaint(renderer.defaultSymbol);
    const seen = new Set();
    const cases = (renderer.uniqueValueInfos || [])
      .filter((info) => info?.value != null && !seen.has(String(info.value)) && seen.add(String(info.value)))
      .map((info) => ({ value: String(info.value), paint: symbolPaint(info.symbol) }));
    props = {};
    for (const key of KEYS) {
      const value = !field || !cases.length ? defaultPaint[key] : combine(key, defaultPaint, cases, (values, fallback) => ["match", ["to-string", ["get", field]], ...cases.flatMap((item, index) => [item.value, values[index]]), fallback]);
      if (value !== undefined && value !== null) props[key] = value;
    }
  } else if (type === "classBreaks" || type === "class-breaks") {
    const source = rendererValue(renderer);
    const defaultPaint = symbolPaint(renderer.defaultSymbol);
    let lower = Number.isFinite(renderer.minValue) ? renderer.minValue : -Infinity;
    const cases = (renderer.classBreakInfos || []).map((info) => {
      const min = Number.isFinite(info.minValue) ? info.minValue : lower;
      const max = Number.isFinite(info.maxValue) ? info.maxValue : Number(info.classMaxValue);
      lower = max;
      return { min, max, paint: symbolPaint(info.symbol) };
    });
    props = {};
    if (!source.field || !cases.length) props = { ...defaultPaint };
    else {
      const { value, missing } = valueOf(source);
      for (const key of KEYS) {
        const built = combine(key, defaultPaint, cases, (values, fallback) => ["case", missing, fallback,
          ...cases.flatMap((item, index) => [["all", Number.isFinite(item.min) ? [">=", value, item.min] : true, ["<=", value, item.max]], values[index]]),
          fallback]);
        if (built !== undefined && built !== null) props[key] = built;
      }
    }
  } else {
    return null;
  }
  // Colour visual variables (common in published services): an interpolation on the field.
  const colorInfo = (renderer.visualVariables || []).find((variable) => /^color(Info)?$/.test(variable.type) && variable.field && Array.isArray(variable.stops) && variable.stops.length);
  if (colorInfo) {
    const webMap = colorInfo.type === "colorInfo";
    const stops = colorInfo.stops.filter((stop) => Number.isFinite(stop.value)).sort((a, b) => a.value - b.value);
    const ramp = stops.length === 1
      ? symbolColor(stops[0].color, { webMap })
      : ["interpolate", ["linear"], ["to-number", ["get", colorInfo.field], stops[0].value], ...stops.flatMap((stop) => [stop.value, symbolColor(stop.color, { webMap })])];
    props.fill = ramp;
    props.line = ramp;
    props.circle = ramp;
  }
  return {
    fill: { ...(props.fill !== undefined ? { "fill-color": props.fill } : {}), "fill-opacity": visibility },
    outline: { ...(props.outline !== undefined ? { "line-color": props.outline } : {}), ...(props.outlineWidth !== undefined ? { "line-width": props.outlineWidth } : {}), "line-opacity": visibility },
    line: { ...(props.line !== undefined ? { "line-color": props.line } : {}), ...(props.lineWidth !== undefined ? { "line-width": props.lineWidth } : {}), "line-opacity": visibility },
    circle: {
      ...(props.circle !== undefined ? { "circle-color": props.circle } : {}),
      ...(props.radius !== undefined ? { "circle-radius": props.radius } : {}),
      ...(props.stroke !== undefined ? { "circle-stroke-color": props.stroke } : {}),
      ...(props.strokeWidth !== undefined ? { "circle-stroke-width": props.strokeWidth } : {}),
      "circle-opacity": visibility,
      "circle-stroke-opacity": visibility,
    },
  };
}
