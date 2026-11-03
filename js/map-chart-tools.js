// Renderer-neutral primitives for the future Map Charts layer.  This module
// intentionally has no MapLibre, ArcGIS, or ECharts imports: adapters project
// its anchor/display plans into their native overlay APIs.

export const MAP_CHART_MARKS = Object.freeze(["bar", "sparkline", "donut"]);
export const MAP_CHART_ANCHORS = Object.freeze(["point", "line-midpoint", "polygon-interior", "polygon-centroid", "feature"]);
export const MAP_CHART_DISPLAYS = Object.freeze(["all", "progressive", "clustered"]);
export const MAP_CHART_COLLISIONS = Object.freeze(["hide-overlap", "cluster", "reposition"]);

const finite = (value) => Number.isFinite(Number(value)) ? Number(value) : null;
const point = (value) => Array.isArray(value) && finite(value[0]) != null && finite(value[1]) != null ? [Number(value[0]), Number(value[1])] : null;
const text = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
const allowed = (value, values, fallback) => values.includes(value) ? value : fallback;

/** Normalizes only the geographic presentation portion of a common chart spec. */
export function normalizeMapChartPresentation(value = {}) {
  const source = value && typeof value === "object" ? value : {};
  return {
    target: "map",
    mark: allowed(source.mark || source.renderMode, MAP_CHART_MARKS, "bar"),
    renderMode: allowed(source.renderMode, ["svg", "html", "webgl"], "svg"),
    anchor: allowed(source.anchor, MAP_CHART_ANCHORS, "feature"),
    display: allowed(source.display, MAP_CHART_DISPLAYS, "progressive"),
    collision: allowed(source.collision, MAP_CHART_COLLISIONS, "hide-overlap"),
    size: allowed(source.size, ["compact", "regular", "expanded"], "compact"),
    minZoom: finite(source.minZoom),
    maxZoom: finite(source.maxZoom),
    // A compact map overlay should remain legible while panning.  Large maps
    // can opt into a larger explicit budget, but should not create hundreds of
    // DOM markers by default.
    maxVisible: Math.max(1, Math.min(2000, Math.floor(finite(source.maxVisible) ?? 80))),
    expandOnClick: source.expandOnClick !== false,
  };
}

const average = (coordinates) => {
  const points = coordinates.map(point).filter(Boolean);
  if (!points.length) return null;
  return [points.reduce((total, item) => total + item[0], 0) / points.length, points.reduce((total, item) => total + item[1], 0) / points.length];
};

const lineMidpoint = (coordinates) => {
  const vertices = coordinates.map(point).filter(Boolean);
  if (!vertices.length) return null;
  if (vertices.length === 1) return vertices[0];
  const lengths = vertices.slice(1).map((item, index) => Math.hypot(item[0] - vertices[index][0], item[1] - vertices[index][1]));
  const halfway = lengths.reduce((total, length) => total + length, 0) / 2;
  let passed = 0;
  for (let index = 0; index < lengths.length; index += 1) {
    if (passed + lengths[index] >= halfway) {
      const ratio = lengths[index] ? (halfway - passed) / lengths[index] : 0;
      return [vertices[index][0] + (vertices[index + 1][0] - vertices[index][0]) * ratio, vertices[index][1] + (vertices[index + 1][1] - vertices[index][1]) * ratio];
    }
    passed += lengths[index];
  }
  return vertices.at(-1);
};

const ringArea = (ring) => Math.abs(ring.slice(1).reduce((area, current, index) => area + ring[index][0] * current[1] - current[0] * ring[index][1], 0) / 2);
const largestRing = (rings) => [...rings].sort((a, b) => ringArea(b) - ringArea(a))[0] || [];

/** A stable geographic anchor for GeoJSON-style point, line, and polygon data. */
export function mapChartAnchor(geometry, requested = "feature") {
  if (!geometry || typeof geometry !== "object") return null;
  const type = geometry.type;
  const coordinates = geometry.coordinates;
  if (type === "Point") return point(coordinates);
  if (type === "MultiPoint") return point(coordinates?.[0]) || average(coordinates || []);
  if (type === "LineString") return lineMidpoint(coordinates || []);
  if (type === "MultiLineString") return lineMidpoint((coordinates || []).flat());
  const rings = type === "Polygon" ? coordinates : type === "MultiPolygon" ? largestRing((coordinates || []).map((polygon) => largestRing(polygon)).filter(Boolean)) : [];
  if (rings?.length) {
    const ring = type === "Polygon" ? largestRing(rings) : rings;
    // The vertex-average is deterministic; adapters may replace it with a true
    // interior point when their geometry library is available.
    return average(ring);
  }
  return requested === "feature" ? null : null;
}

/** Lightweight SVG glyphs; adapters can wrap these in a DOM marker or serialize them for export. */
export function renderMapChartSvg({ mark = "bar", values = [], label = "Map chart", width = 84, height = 52 } = {}) {
  const safeValues = values.map(finite).filter((value) => value != null).slice(0, 24);
  const safeWidth = Math.max(28, Math.min(240, Math.round(width)));
  const safeHeight = Math.max(22, Math.min(160, Math.round(height)));
  const max = Math.max(...safeValues.map(Math.abs), 1);
  let body = "";
  if (mark === "donut") {
    const total = safeValues.reduce((sum, value) => sum + Math.max(value, 0), 0) || 1;
    let offset = 0;
    body = safeValues.map((value, index) => { const dash = Math.max(value, 0) / total * 100; const segment = `<circle cx="${safeWidth / 2}" cy="${safeHeight / 2}" r="${Math.min(safeWidth, safeHeight) / 2 - 5}" fill="none" stroke="${["#1b7f6a", "#e0ad35", "#2f7f9d", "#b23f62"][index % 4]}" stroke-width="8" pathLength="100" stroke-dasharray="${dash} ${100 - dash}" stroke-dashoffset="${-offset}" transform="rotate(-90 ${safeWidth / 2} ${safeHeight / 2})"/>`; offset += dash; return segment; }).join("");
  } else if (mark === "sparkline") {
    const step = safeValues.length > 1 ? (safeWidth - 8) / (safeValues.length - 1) : 0;
    const points = safeValues.map((value, index) => `${4 + index * step},${safeHeight - 5 - (value / max) * (safeHeight - 12)}`).join(" ");
    body = `<polyline points="${points}" fill="none" stroke="#1b7f6a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;
  } else {
    const gap = 2; const barWidth = Math.max(2, (safeWidth - 8 - gap * Math.max(0, safeValues.length - 1)) / Math.max(safeValues.length, 1));
    body = safeValues.map((value, index) => { const barHeight = Math.max(2, Math.abs(value) / max * (safeHeight - 10)); return `<rect x="${4 + index * (barWidth + gap)}" y="${safeHeight - 4 - barHeight}" width="${barWidth}" height="${barHeight}" rx="1" fill="#1b7f6a"/>`; }).join("");
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${safeWidth} ${safeHeight}" role="img" aria-label="${text(label)}" width="${safeWidth}" height="${safeHeight}"><title>${text(label)}</title>${body || `<text x="${safeWidth / 2}" y="${safeHeight / 2}" text-anchor="middle" fill="#667085" font-size="10">No data</text>`}</svg>`;
}

/**
 * Screen-space display planning shared by MapLibre and ArcGIS adapters. Items
 * supply `screen: {x, y, width, height}`, selection/pinning state, and anchor.
 * The engine adapter performs projection; this function stays engine-neutral.
 */
export function planMapChartDisplay(items = [], presentation = {}) {
  const policy = normalizeMapChartPresentation(presentation);
  const ranked = items.filter((item) => item?.screen).sort((a, b) => Number(Boolean(b.selected)) - Number(Boolean(a.selected)) || Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || Number(b.priority || 0) - Number(a.priority || 0));
  const visible = []; const hidden = []; const boxes = [];
  for (const item of ranked) {
    if (visible.length >= policy.maxVisible && !item.selected && !item.pinned) { hidden.push({ ...item, reason: "budget" }); continue; }
    const screen = item.screen;
    const overlap = boxes.some((box) => screen.x < box.x + box.width && screen.x + screen.width > box.x && screen.y < box.y + box.height && screen.y + screen.height > box.y);
    if (overlap && ["hide-overlap", "cluster"].includes(policy.collision) && !item.selected && !item.pinned) {
      hidden.push({ ...item, reason: policy.collision === "cluster" ? "cluster" : "overlap" });
      continue;
    }
    visible.push(item); boxes.push(screen);
  }
  return { policy, visible, hidden, clustered: policy.display === "clustered" || policy.collision === "cluster" };
}

// Adapter contract (implemented in the deferred Map Charts MVP):
// { mount(plan), update(plan), destroy(), project(coordinate), onSelect(callback) }
export const MAP_CHART_ADAPTER_CONTRACT = Object.freeze(["mount", "update", "destroy", "project", "onSelect"]);

/**
 * Small, engine-neutral HTML/SVG overlay layer for the first Map Charts MVP.
 * The map controller projects anchors to the screen on either engine;
 * the chart data, anchors, collision plan, and DOM glyphs stay provider-neutral.
 */
export class MapChartOverlayController {
  constructor({ events, mapController, projectManager, onSelect = null, notify = null } = {}) {
    Object.assign(this, { events, mapController, projectManager, onSelect, notify });
    this.root = null;
    this.items = [];
    this.token = 0;
    this.queued = false;
  }

  initialize() {
    const refresh = () => this.schedule(true);
    ["map:ready", "charts:changed", "project:loaded", "layer:added", "layer:removed", "layer:changed", "layers:reset"].forEach((topic) => this.events?.subscribe?.(topic, refresh));
    ["view:stationary", "view:scale-change"].forEach((topic) => this.events?.subscribe?.(topic, () => this.schedule(false)));
    this.schedule(true);
  }

  schedule(requery = false) {
    if (requery) this.needsQuery = true;
    if (this.queued) return;
    this.queued = true;
    const frame = globalThis.requestAnimationFrame || ((callback) => setTimeout(callback, 0));
    frame(() => {
      this.queued = false;
      if (this.needsQuery) { this.needsQuery = false; void this.refresh(); }
      else this.render();
    });
  }

  async refresh() {
    const token = ++this.token;
    const charts = (this.projectManager?.current?.charts || []).filter((chart) => chart?.presentation?.targets?.includes("map") || chart?.presentation?.target === "map");
    if (!charts.length) { this.items = []; this.render(); return; }
    const { queryChart } = await import("./charting-tools.js?v=0.68.0-charts1");
    const next = [];
    for (const chart of charts) {
      const layer = this.mapController?.getLayer?.(chart.source?.layerId || chart.data?.layerId);
      if (!layer?.queryable || layer.visible === false) continue;
      try {
        const result = await queryChart(this.mapController, layer, chart);
        if (token !== this.token) return;
        const presentation = normalizeMapChartPresentation(chart.presentation);
        const mark = presentation.mark === "bar" && chart.type === "donut" ? "donut" : presentation.mark === "bar" && ["line", "area"].includes(chart.type) ? "sparkline" : presentation.mark;
        const fields = chart.encoding?.mapFields?.length ? chart.encoding.mapFields : [chart.measure?.field].filter(Boolean);
        result.features.forEach((feature, index) => {
          const anchor = mapChartAnchor(feature.geometry, presentation.anchor);
          if (!anchor) return;
          const values = fields.map((field) => finite(feature.attributes?.[field])).filter((value) => value != null);
          if (!values.length) values.push(chart.measure?.aggregation === "count" ? 1 : 0);
          const featureLabel = feature.attributes?.[chart.dimension?.field] ?? feature.attributes?.[layer.displayField] ?? `Feature ${index + 1}`;
          next.push({ id: `${chart.id}:${index}`, chart, layer, feature, anchor, values, label: `${chart.title} · ${featureLabel}`, presentation: { ...presentation, mark }, priority: values.reduce((sum, value) => sum + Math.abs(value), 0) });
        });
      } catch (error) {
        this.notify?.(`Map chart “${chart.title || "Untitled chart"}” could not update: ${error.message}`);
      }
    }
    if (token !== this.token) return;
    this.items = next;
    this.render();
  }

  // Engine-neutral: the map controller places points and reports the container and zoom.
  #surface() { try { return this.mapController?.getContainer?.() || null; } catch { return null; } }

  #screen(coordinate) {
    try {
      const projected = this.mapController?.mapToScreen?.([coordinate[0], coordinate[1]]);
      return projected && Number.isFinite(projected.x) ? { x: projected.x, y: projected.y } : null;
    } catch { return null; }
  }

  #zoom() { try { return Number(this.mapController?.getCamera?.()?.zoom); } catch { return NaN; } }

  #ensureRoot(surface) {
    if (!surface) return null;
    if (this.root?.parentElement === surface) return this.root;
    this.root?.remove();
    const root = document.createElement("div");
    root.className = "map-chart-overlay";
    surface.append(root);
    this.root = root;
    return root;
  }

  render() {
    const root = this.#ensureRoot(this.#surface());
    if (!root) return;
    const zoom = this.#zoom();
    const candidates = this.items.filter((item) => (item.presentation.minZoom == null || zoom >= item.presentation.minZoom) && (item.presentation.maxZoom == null || zoom <= item.presentation.maxZoom)).map((item) => {
      const size = item.presentation.size === "expanded" ? [112, 70] : item.presentation.size === "regular" ? [84, 52] : [62, 38];
      const screen = this.#screen(item.anchor);
      return { ...item, screen: screen && { x: screen.x - size[0] / 2, y: screen.y - size[1] - 10, width: size[0], height: size[1] }, glyphSize: size };
    }).filter((item) => item.screen);
    const grouped = new Map();
    candidates.forEach((item) => { const key = JSON.stringify(item.presentation); if (!grouped.has(key)) grouped.set(key, []); grouped.get(key).push(item); });
    const fragments = [];
    for (const items of grouped.values()) {
      const plan = planMapChartDisplay(items, items[0].presentation);
      plan.visible.forEach((item) => fragments.push(this.#glyph(item)));
      if (plan.clustered && plan.hidden.length) fragments.push(this.#cluster(plan.hidden[0], plan.hidden.length));
    }
    root.replaceChildren(...fragments);
  }

  #glyph(item) {
    const button = document.createElement("button");
    button.type = "button"; button.className = "map-chart-glyph";
    button.style.left = `${item.screen.x}px`; button.style.top = `${item.screen.y}px`;
    button.style.width = `${item.glyphSize[0]}px`; button.style.height = `${item.glyphSize[1]}px`;
    button.setAttribute("aria-label", item.label);
    button.innerHTML = renderMapChartSvg({ mark: item.presentation.mark, values: item.values, label: item.label, width: item.glyphSize[0], height: item.glyphSize[1] });
    button.addEventListener("click", () => this.onSelect?.(item));
    return button;
  }

  #cluster(item, count) {
    const button = document.createElement("button");
    button.type = "button"; button.className = "map-chart-cluster";
    button.style.left = `${item.screen.x + item.screen.width / 2}px`; button.style.top = `${item.screen.y + item.screen.height / 2}px`;
    button.textContent = `+${count}`; button.title = `${count} overlapping map charts`; button.setAttribute("aria-label", `${count} overlapping map charts`);
    button.addEventListener("click", () => this.onSelect?.(item));
    return button;
  }

  destroy() { this.root?.remove(); this.root = null; this.items = []; }
}
