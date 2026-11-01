// Prebuilt map page templates. Each one draws a whole page onto a canvas from
// the current map capture and a few project details; the same page becomes the
// preview, the PDF (as one full-page image plus link areas) and the Smart Image.
// Templates live here, not in project files: only the chosen id is remembered.

/** An image element once loaded (onload, not decode(): decode can stall in background tabs), or null. */
export function loadImage(source) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = source;
  });
}

export const IMAGE_ANCHORS = Object.freeze(["top-left", "top", "top-right", "left", "center", "right", "bottom-left", "bottom", "bottom-right"]);

const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const SERIF = "Georgia, 'Times New Roman', serif";

/* ---------------- Shared page elements ---------------- */

function font(size, weight = 400, family = FONT) { return `${weight} ${Math.round(size)}px ${family}`; }

function lines(context, text, width) {
  const output = [];
  for (const paragraph of String(text || "").split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (line && context.measureText(next).width > width) { output.push(line); line = word; } else line = next;
    }
    output.push(line);
  }
  return output;
}

/** Wrapped text from a top-left corner; returns the y below it. */
function text(context, value, x, y, width, { size, weight = 400, color = "#17201d", family = FONT, leading = 1.35, maxLines = 99, align = "left" }) {
  if (!value) return y;
  context.save();
  context.font = font(size, weight, family);
  context.fillStyle = color;
  context.textBaseline = "top";
  context.textAlign = align;
  const ax = align === "center" ? x + width / 2 : align === "right" ? x + width : x;
  const rows = lines(context, value, width).slice(0, maxLines);
  rows.forEach((row, index) => context.fillText(row, ax, y + index * size * leading));
  context.restore();
  return y + rows.length * size * leading;
}

function band(context, x, y, width, height, palette) {
  const gradient = context.createLinearGradient(x, y, x + width, y + height);
  gradient.addColorStop(0, palette.band);
  gradient.addColorStop(1, palette.frame);
  context.fillStyle = gradient;
  context.fillRect(x, y, width, height);
}

/** The GISMap Online mark and wordmark, `size` tall. */
// Links the page adds on its own (the wordmark, a centre coordinate), collected per render.
let pageLinks = [];

function brand(context, x, y, size, data, { light = true } = {}) {
  pageLinks.push({ x, y, w: size * 3.2, h: size, url: "https://gismap.online/" });
  if (data.logo) context.drawImage(data.logo, x, y, size, size);
  context.save();
  context.textBaseline = "alphabetic";
  context.fillStyle = light ? data.palette.brand : data.palette.accent;
  context.font = font(size * 0.36, 700);
  context.fillText("GIS MAP", x + size * 1.15, y + size * 0.48);
  context.fillStyle = data.palette.edge;
  context.font = font(size * 0.2, 700);
  if ("letterSpacing" in context) context.letterSpacing = `${size * 0.05}px`;
  context.fillText("ONLINE", x + size * 1.17, y + size * 0.82);
  context.restore();
}

/** The map capture covering a rectangle (the capture already has its shape). */
function map(context, rect, data) {
  context.save();
  context.fillStyle = "#e9ece9";
  context.fillRect(rect.x, rect.y, rect.w, rect.h);
  if (data.map) {
    const scale = Math.max(rect.w / data.map.width, rect.h / data.map.height);
    const w = data.map.width * scale;
    const h = data.map.height * scale;
    context.beginPath();
    context.rect(rect.x, rect.y, rect.w, rect.h);
    context.clip();
    context.drawImage(data.map, rect.x + (rect.w - w) / 2, rect.y + (rect.h - h) / 2, w, h);
  }
  context.restore();
}

function frame(context, rect, color, width) {
  context.save();
  context.strokeStyle = color;
  context.lineWidth = width;
  context.strokeRect(rect.x, rect.y, rect.w, rect.h);
  context.restore();
}

/** A translucent plate behind text drawn over the map. */
function plate(context, x, y, w, h, radius = 6, alpha = 0.88) {
  context.save();
  context.globalAlpha = alpha;
  context.fillStyle = "#ffffff";
  context.beginPath();
  context.roundRect ? context.roundRect(x, y, w, h, radius) : context.rect(x, y, w, h);
  context.fill();
  context.restore();
}

function swatch(context, entry, x, y, size) {
  context.save();
  context.fillStyle = entry.fill || "#2f7d6d";
  context.strokeStyle = entry.stroke || "rgba(0,0,0,.35)";
  context.lineWidth = Math.max(1, size / 12);
  if (entry.geometry === "point") {
    context.beginPath();
    context.arc(x + size / 2, y + size / 2, size * 0.32, 0, Math.PI * 2);
    context.fill();
    context.stroke();
  } else if (entry.geometry === "line") {
    context.strokeStyle = entry.fill || "#2f7d6d";
    context.lineWidth = Math.max(2, size / 5);
    context.beginPath();
    context.moveTo(x, y + size * 0.7);
    context.lineTo(x + size, y + size * 0.3);
    context.stroke();
  } else {
    context.fillRect(x, y + size * 0.1, size, size * 0.8);
    context.strokeRect(x, y + size * 0.1, size, size * 0.8);
  }
  context.restore();
}

/** Layer legend in a column; returns the y below it. `columns` > 1 flows entries across. */
function legend(context, data, x, y, width, { size, bottom = Infinity, columns = 1, heading = "Legend" }) {
  const layers = data.legend.length ? data.legend : data.layers.map((layer) => ({ title: layer.title, entries: [] }));
  if (!layers.length) return y;
  if (heading) y = text(context, heading, x, y, width, { size: size * 1.25, weight: 700, color: data.palette.accent }) + size * 0.4;
  const columnWidth = (width - (columns - 1) * size) / columns;
  const top = y;
  let column = 0;
  for (const layer of layers) {
    const needed = size * 1.4 * (1 + Math.min(layer.entries.length, 8));
    if (y + needed > bottom) {
      if (column + 1 >= columns) break;
      column += 1;
      y = top;
    }
    const left = x + column * (columnWidth + size);
    y = text(context, layer.title, left, y, columnWidth, { size, weight: 700, maxLines: 2 });
    for (const entry of layer.entries.slice(0, 8)) {
      swatch(context, entry, left, y + size * 0.15, size);
      y = text(context, entry.label || "Features", left + size * 1.5, y + size * 0.1, columnWidth - size * 1.5, { size: size * 0.9, color: "#3a4744", maxLines: 1 }) + size * 0.15;
    }
    y += size * 0.5;
  }
  return y;
}

const NICE = [1, 2, 5];
function niceDistance(meters) {
  const power = 10 ** Math.floor(Math.log10(meters));
  let best = power;
  for (const step of NICE) if (step * power <= meters) best = step * power;
  return best;
}

/** A two-segment scale bar at most `maxWidth` wide; skipped when the map is tilted. */
function scaleBar(context, data, rect, x, y, maxWidth, size, { light = false } = {}) {
  if (!showScale || !Number.isFinite(data.groundWidth) || data.groundWidth <= 0) return;
  const metersPerPx = data.groundWidth / rect.w;
  const meters = niceDistance(maxWidth * metersPerPx);
  const width = meters / metersPerPx;
  const label = meters >= 1000 ? `${meters / 1000} km` : `${meters} m`;
  const miles = meters / 1609.344;
  const ink = light ? "#ffffff" : "#17201d";
  context.save();
  context.fillStyle = ink;
  context.fillRect(x, y, width / 2, size * 0.35);
  context.fillStyle = light ? "transparent" : "#ffffff";
  context.fillRect(x + width / 2, y, width / 2, size * 0.35);
  context.strokeStyle = ink;
  context.lineWidth = Math.max(1, size / 14);
  context.strokeRect(x, y, width, size * 0.35);
  context.restore();
  text(context, `0`, x - size, y + size * 0.45, size * 2, { size: size * 0.8, align: "center", color: ink });
  text(context, `${label} (${miles >= 1 ? miles.toFixed(1) : (miles * 5280).toFixed(0)} ${miles >= 1 ? "mi" : "ft"})`, x + width - size * 6, y + size * 0.45, size * 12, { size: size * 0.8, align: "center", color: ink });
}

// Per-render switches from the editor (north arrow and scale bar on or off).
let showNorth = true;
let showScale = true;

function northArrow(context, cx, cy, size, heading = 0, { light = false } = {}) {
  if (!showNorth) return;
  const ink = light ? "#ffffff" : "#17201d";
  const paper = light ? "transparent" : "#ffffff";
  context.save();
  context.translate(cx, cy);
  context.rotate((-(Number(heading) || 0) * Math.PI) / 180);
  context.beginPath();
  context.moveTo(0, -size / 2);
  context.lineTo(size * 0.3, size * 0.4);
  context.lineTo(0, size * 0.22);
  context.closePath();
  context.fillStyle = ink;
  context.fill();
  context.beginPath();
  context.moveTo(0, -size / 2);
  context.lineTo(-size * 0.3, size * 0.4);
  context.lineTo(0, size * 0.22);
  context.closePath();
  context.fillStyle = paper;
  context.fill();
  context.strokeStyle = ink;
  context.lineWidth = Math.max(1, size / 20);
  context.stroke();
  context.font = font(size * 0.38, 700);
  context.fillStyle = ink;
  context.textAlign = "center";
  context.textBaseline = "bottom";
  context.fillText("N", 0, -size / 2 - size * 0.04);
  context.restore();
}

/** QR code with a caption; returns a link rectangle. */
function qr(context, data, x, y, size, { caption = "Open the live map", color = "#17201d" } = {}) {
  if (!data.qr) return null;
  context.fillStyle = "#ffffff";
  context.fillRect(x, y, size, size);
  context.drawImage(data.qr, x, y, size, size);
  if (caption) text(context, caption, x - size * 0.25, y + size + size * 0.06, size * 1.5, { size: size * 0.1, weight: 700, color, align: "center" });
  return data.linkUrl ? { x, y, w: size, h: size, url: data.linkUrl } : null;
}

/** Latitude/longitude ticks around a flat map, labelled at the outside edge. */
function graticule(context, data, rect, size) {
  const extent = data.extent;
  if (!extent) return;
  const ticks = (min, max) => {
    const step = niceDistance((max - min) / 4) || 1;
    const values = [];
    for (let value = Math.ceil(min / step) * step; value <= max; value += step) values.push(Number(value.toFixed(6)));
    return values;
  };
  const mercator = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
  const yFor = (lat) => rect.y + rect.h * (mercator(extent.north) - mercator(lat)) / (mercator(extent.north) - mercator(extent.south));
  const xFor = (lon) => rect.x + rect.w * (lon - extent.west) / (extent.east - extent.west);
  const label = (value, positive, negative) => `${Math.abs(value).toFixed(Math.abs(value) % 1 ? 2 : 0)}°${value >= 0 ? positive : negative}`;
  context.save();
  context.strokeStyle = "#17201d";
  context.lineWidth = Math.max(1, size / 12);
  for (const lon of ticks(extent.west, extent.east)) {
    const x = xFor(lon);
    context.beginPath(); context.moveTo(x, rect.y - size * 0.5); context.lineTo(x, rect.y); context.moveTo(x, rect.y + rect.h); context.lineTo(x, rect.y + rect.h + size * 0.5); context.stroke();
    text(context, label(lon, "E", "W"), x - size * 3, rect.y + rect.h + size * 0.6, size * 6, { size: size * 0.8, align: "center" });
  }
  for (const lat of ticks(extent.south, extent.north)) {
    const y = yFor(lat);
    context.beginPath(); context.moveTo(rect.x - size * 0.5, y); context.lineTo(rect.x, y); context.moveTo(rect.x + rect.w, y); context.lineTo(rect.x + rect.w + size * 0.5, y); context.stroke();
    context.save();
    context.translate(rect.x - size * 0.7, y);
    context.rotate(-Math.PI / 2);
    text(context, label(lat, "N", "S"), -size * 3, -size * 0.9, size * 6, { size: size * 0.8, align: "center" });
    context.restore();
  }
  context.restore();
}

/** The user's images placed on the map frame by anchor, size (% of map width) and opacity. */
function overlays(context, data, rect) {
  const pad = rect.w * 0.025;
  for (const item of data.images || []) {
    if (!item.image) continue;
    const width = rect.w * Math.min(1, Math.max(0.03, (Number(item.size) || 20) / 100));
    const height = width * (item.image.height / item.image.width);
    const [vertical, horizontal] = item.anchor === "center" ? ["center", "center"]
      : item.anchor === "top" || item.anchor === "bottom" ? [item.anchor, "center"]
        : item.anchor === "left" || item.anchor === "right" ? ["center", item.anchor]
          : String(item.anchor || "top-left").split("-");
    const x = horizontal === "left" ? rect.x + pad : horizontal === "right" ? rect.x + rect.w - pad - width : rect.x + (rect.w - width) / 2;
    const y = vertical === "top" ? rect.y + pad : vertical === "bottom" ? rect.y + rect.h - pad - height : rect.y + (rect.h - height) / 2;
    context.save();
    context.globalAlpha = Math.min(1, Math.max(0.05, Number(item.opacity ?? 1)));
    if (item.shadow !== false) { context.shadowColor = "rgba(0,0,0,.35)"; context.shadowBlur = width * 0.03; context.shadowOffsetY = width * 0.01; }
    context.drawImage(item.image, x, y, width, height);
    context.restore();
  }
}

function footer(context, data, x, y, width, size) {
  const credit = [data.credits, `Made with GISMap Online · ${data.date}`].filter(Boolean).join(" · ");
  text(context, credit, x, y, width, { size, color: "#5c6966", maxLines: 2 });
}

const centreText = (data) => (data.center ? `${data.center.latitude.toFixed(5)}, ${data.center.longitude.toFixed(5)}` : "");

/**
 * A large-format wall map: the poster layout scaled to the sheet. `p` is one
 * poster inch on this sheet, so type and spacing grow with the paper while the
 * map takes whatever height is left between the title band and legend strip.
 */
function wallMap(id, label, description, width, height) {
  const p = width / 11;
  const mapTop = 2.5 * p;
  // The legend/QR strip is left out when it would be empty, so the map takes the space.
  const strip = (compact) => (compact ? 0 : 2.6 * p);
  return {
    id,
    label,
    description,
    page: { width, height },
    mapRect: (k, { compact = false } = {}) => ({ x: 0.6 * p * k, y: mapTop * k, w: (width - 1.2 * p) * k, h: (height - mapTop - strip(compact) - 0.8 * p) * k }),
    draw(context, k, data) {
      const u = p * k;
      band(context, 0, 0, width * k, 2.2 * u, data.palette);
      context.fillStyle = data.palette.edge;
      context.fillRect(0, 2.2 * u, width * k, 0.08 * u);
      const y = text(context, data.title, 0.6 * u, 0.45 * u, width * k - 4.2 * u, { size: 0.7 * u, family: SERIF, weight: 700, color: "#ffffff", maxLines: 1 });
      text(context, data.subtitle, 0.6 * u, y + 0.05 * u, width * k - 4.2 * u, { size: 0.24 * u, color: "rgba(255,255,255,.85)", maxLines: 1 });
      brand(context, width * k - 3.1 * u, 0.6 * u, 0.85 * u, data);
      // Scale bar and north arrow sit in the title band, under the wordmark.
      scaleBar(context, data, this.mapRect(k, data), width * k - 3.3 * u, 1.62 * u, 1.6 * u, 0.13 * u, { light: true });
      northArrow(context, width * k - 0.95 * u, 1.72 * u, 0.36 * u, data.heading, { light: true });
      const rect = this.mapRect(k, data);
      map(context, rect, data);
      overlays(context, data, rect);
      frame(context, rect, data.palette.frame, 0.04 * u);
      const top = rect.y + rect.h + 0.35 * u;
      const right = width * k - 0.6 * u;
      let link = null;
      if (!data.compact) {
        legend(context, data, 0.6 * u, top, right - 2.4 * u, { size: 0.17 * u, bottom: top + 1.6 * u, columns: width > height ? 3 : 2 });
        link = qr(context, data, right - 1.5 * u, top, 1.5 * u, { caption: "" });
        if (data.description) text(context, data.description, 0.6 * u, top + 1.65 * u, right - 2.6 * u, { size: 0.13 * u, color: "#3a4744", maxLines: 2 });
      }
      footer(context, data, 0.6 * u, height * k - 0.4 * u, right - 0.6 * u, 0.12 * u);
      return [link, data.linkUrl && { ...rect, url: data.linkUrl }];
    },
  };
}

/* ---------------- Templates ---------------- */
// Sizes are in inches; `k` is pixels per inch at render time. `mapRect(k)` is
// the map frame, used both to shape the capture and to draw it.

const templates = [
  {
    id: "branded",
    label: "Branded landscape",
    description: "The classic GISMap page: framed map, layer key, centre and QR code.",
    page: { width: 11, height: 8.5 },
    mapRect: (k) => ({ x: 0.5 * k, y: 1.5 * k, w: 7.1 * k, h: 6.2 * k }),
    draw(context, k, data) {
      band(context, 0.5 * k, 0.45 * k, 10 * k, 0.75 * k, data.palette);
      context.fillStyle = data.palette.edge;
      context.fillRect(0.5 * k, 0.45 * k, 0.06 * k, 0.75 * k);
      brand(context, 0.7 * k, 0.53 * k, 0.6 * k, data);
      text(context, data.title, 3 * k, 0.6 * k, 7.3 * k, { size: 0.3 * k, family: SERIF, weight: 700, color: "#ffffff", align: "right", maxLines: 1 });
      text(context, data.subtitle, 3 * k, 0.95 * k, 7.3 * k, { size: 0.13 * k, color: "rgba(255,255,255,.85)", align: "right", maxLines: 1 });
      const rect = this.mapRect(k);
      map(context, rect, data);
      overlays(context, data, rect);
      frame(context, rect, data.palette.frame, 0.03 * k);
      const column = { x: 7.9 * k, w: 2.6 * k };
      let y = legend(context, data, column.x, 1.5 * k, column.w, { size: 0.13 * k, bottom: 4.7 * k, heading: "Layers" });
      if (data.center) {
        y = text(context, "Centre", column.x, y + 0.1 * k, column.w, { size: 0.13 * k, weight: 700 });
        const end = text(context, centreText(data), column.x, y, column.w, { size: 0.12 * k, color: "#0d6680" });
        if (data.centerUrl) pageLinks.push({ x: column.x, y, w: column.w * 0.7, h: end - y, url: data.centerUrl });
      }
      const link = qr(context, data, column.x, 5.45 * k, 1.5 * k);
      scaleBar(context, data, rect, column.x, 7.45 * k, 1.8 * k, 0.13 * k);
      northArrow(context, column.x + 2.35 * k, 7.55 * k, 0.36 * k, data.heading);
      footer(context, data, 0.5 * k, 7.85 * k, 7.1 * k, 0.1 * k);
      return [link, data.linkUrl && { ...rect, url: data.linkUrl }];
    },
  },
  {
    id: "full-bleed",
    label: "Full-bleed map",
    description: "Edge-to-edge map with a title plate, scale, north arrow and QR in the corners.",
    page: { width: 11, height: 8.5 },
    mapRect: (k) => ({ x: 0, y: 0, w: 11 * k, h: 8.5 * k }),
    draw(context, k, data) {
      const rect = this.mapRect(k);
      map(context, rect, data);
      overlays(context, data, rect);
      plate(context, 0.35 * k, 0.35 * k, 4.6 * k, (data.subtitle ? 1.0 : 0.75) * k, 0.08 * k);
      context.fillStyle = data.palette.edge;
      context.fillRect(0.35 * k, 0.35 * k, 0.06 * k, (data.subtitle ? 1.0 : 0.75) * k);
      const y = text(context, data.title, 0.55 * k, 0.48 * k, 4.3 * k, { size: 0.3 * k, family: SERIF, weight: 700, color: data.palette.accent, maxLines: 1 });
      text(context, data.subtitle, 0.55 * k, y + 0.04 * k, 4.3 * k, { size: 0.13 * k, color: "#3a4744", maxLines: 1 });
      const scaled = Number.isFinite(data.groundWidth);
      plate(context, 0.35 * k, 7.6 * k, (scaled ? 3.55 : 0.6) * k, 0.55 * k, 0.06 * k);
      if (scaled) scaleBar(context, data, rect, 0.6 * k, 7.72 * k, 1.9 * k, 0.13 * k);
      northArrow(context, (scaled ? 3.6 : 0.65) * k, 7.9 * k, 0.34 * k, data.heading);
      let link = null;
      if (data.qr) {
        plate(context, 9.35 * k, 6.45 * k, 1.3 * k, 1.7 * k, 0.08 * k, 0.94);
        link = qr(context, data, 9.45 * k, 6.55 * k, 1.1 * k);
      }
      plate(context, 4.1 * k, 7.91 * k, 5 * k, 0.24 * k, 0.04 * k, 0.75);
      footer(context, data, 4.2 * k, 7.95 * k, 4.8 * k, 0.1 * k);
      return [link];
    },
  },
  {
    id: "portrait-report",
    label: "Portrait report",
    description: "Letter portrait: title, map, a short description and a legend.",
    page: { width: 8.5, height: 11 },
    mapRect: (k) => ({ x: 0.6 * k, y: 2.15 * k, w: 7.3 * k, h: 5.3 * k }),
    draw(context, k, data) {
      band(context, 0, 0, 8.5 * k, 0.95 * k, data.palette);
      context.fillStyle = data.palette.edge;
      context.fillRect(0, 0.95 * k, 8.5 * k, 0.05 * k);
      brand(context, 0.6 * k, 0.17 * k, 0.6 * k, data);
      let y = text(context, data.title, 0.6 * k, 1.25 * k, 7.3 * k, { size: 0.36 * k, family: SERIF, weight: 700, color: data.palette.accent, maxLines: 1 });
      text(context, data.subtitle, 0.6 * k, y + 0.02 * k, 7.3 * k, { size: 0.14 * k, color: "#3a4744", maxLines: 1 });
      const rect = this.mapRect(k);
      map(context, rect, data);
      overlays(context, data, rect);
      frame(context, rect, "#c7cfcc", 0.015 * k);
      scaleBar(context, data, rect, 0.6 * k, 7.6 * k, 1.8 * k, 0.13 * k);
      northArrow(context, 7.65 * k, 7.78 * k, 0.36 * k, data.heading);
      y = text(context, data.description || "Describe what this map shows: its purpose, data sources and anything a reader should notice.", 0.6 * k, 8.25 * k, 4.4 * k, { size: 0.13 * k, color: data.description ? "#17201d" : "#8a9693", maxLines: 12 });
      legend(context, data, 5.3 * k, 8.25 * k, 2.6 * k, { size: 0.12 * k, bottom: 10.2 * k });
      const link = qr(context, data, 0.6 * k, 9.75 * k, 0.75 * k, { caption: "" });
      if (link) text(context, "Scan to open the live map", 1.5 * k, 9.95 * k, 3 * k, { size: 0.12 * k, weight: 700, color: "#0d6680" });
      footer(context, data, 0.6 * k, 10.6 * k, 7.3 * k, 0.1 * k);
      return [link, data.linkUrl && { ...rect, url: data.linkUrl }];
    },
  },
  {
    id: "poster",
    label: "Poster (tabloid)",
    description: "11 × 17 in portrait with a large title and a legend strip.",
    page: { width: 11, height: 17 },
    mapRect: (k) => ({ x: 0.6 * k, y: 2.5 * k, w: 9.8 * k, h: 11.3 * k }),
    draw(context, k, data) {
      band(context, 0, 0, 11 * k, 2.2 * k, data.palette);
      context.fillStyle = data.palette.edge;
      context.fillRect(0, 2.2 * k, 11 * k, 0.08 * k);
      const y = text(context, data.title, 0.6 * k, 0.45 * k, 9.8 * k, { size: 0.7 * k, family: SERIF, weight: 700, color: "#ffffff", maxLines: 1 });
      text(context, data.subtitle, 0.6 * k, y + 0.05 * k, 9.8 * k, { size: 0.24 * k, color: "rgba(255,255,255,.85)", maxLines: 1 });
      const rect = this.mapRect(k);
      map(context, rect, data);
      overlays(context, data, rect);
      frame(context, rect, data.palette.frame, 0.04 * k);
      legend(context, data, 0.6 * k, 14.15 * k, 6.9 * k, { size: 0.17 * k, bottom: 16.2 * k, columns: 2 });
      scaleBar(context, data, rect, 7.8 * k, 14.25 * k, 1.6 * k, 0.16 * k);
      northArrow(context, 7.95 * k, 15.35 * k, 0.45 * k, data.heading);
      const link = qr(context, data, 8.85 * k, 14.85 * k, 1.5 * k, { caption: "" });
      if (data.description) text(context, data.description, 0.6 * k, 16.2 * k, 7.5 * k, { size: 0.13 * k, color: "#3a4744", maxLines: 2 });
      footer(context, data, 0.6 * k, 16.6 * k, 9.8 * k, 0.12 * k);
      brand(context, 9.1 * k, 0.6 * k, 0.85 * k, data);
      return [link, data.linkUrl && { ...rect, url: data.linkUrl }];
    },
  },
  wallMap("wall-24x36", "Wall map (24 × 36)", "24 × 36 in portrait poster: large title, big map and a legend strip.", 24, 36),
  wallMap("wall-36x36", "Square wall map (36 × 36)", "36 × 36 in square print with a large title, map and legend strip.", 36, 36),
  {
    id: "field-sheet",
    label: "Field sheet",
    description: "Map with coordinate ticks, scale bar and north arrow, plus ruled space for notes.",
    page: { width: 8.5, height: 11 },
    mapRect: (k) => ({ x: 0.85 * k, y: 1.35 * k, w: 6.8 * k, h: 6.1 * k }),
    draw(context, k, data) {
      text(context, data.title, 0.6 * k, 0.4 * k, 5.6 * k, { size: 0.28 * k, weight: 700, color: data.palette.accent, maxLines: 1 });
      text(context, [data.date, centreText(data)].filter(Boolean).join(" · "), 0.6 * k, 0.8 * k, 5.6 * k, { size: 0.12 * k, color: "#3a4744", maxLines: 1 });
      brand(context, 6.5 * k, 0.35 * k, 0.5 * k, data, { light: false });
      const rect = this.mapRect(k);
      map(context, rect, data);
      overlays(context, data, rect);
      frame(context, rect, "#17201d", 0.02 * k);
      graticule(context, data, rect, 0.12 * k);
      scaleBar(context, data, rect, 0.85 * k, 7.95 * k, 2.2 * k, 0.14 * k);
      northArrow(context, 7.3 * k, 8.1 * k, 0.45 * k, data.heading);
      const link = qr(context, data, 4.35 * k, 7.85 * k, 0.65 * k, { caption: "" });
      text(context, "Notes", 0.6 * k, 8.7 * k, 3 * k, { size: 0.14 * k, weight: 700 });
      context.save();
      context.strokeStyle = "#b9c2bf";
      context.lineWidth = 0.01 * k;
      for (let line = 0; line < 6; line += 1) {
        const y = 9.2 * k + line * 0.3 * k;
        context.beginPath(); context.moveTo(0.6 * k, y); context.lineTo(7.9 * k, y); context.stroke();
      }
      context.restore();
      footer(context, data, 0.6 * k, 10.75 * k, 7.3 * k, 0.09 * k);
      return [link];
    },
  },
  {
    id: "slide",
    label: "Briefing slide (16:9)",
    description: "Widescreen title band and map, sized for presentations and screens.",
    page: { width: 13.333, height: 7.5 },
    mapRect: (k) => ({ x: 0, y: 1.1 * k, w: 13.333 * k, h: 6.4 * k }),
    draw(context, k, data) {
      band(context, 0, 0, 13.333 * k, 1.1 * k, data.palette);
      context.fillStyle = data.palette.edge;
      context.fillRect(0, 0, 0.1 * k, 1.1 * k);
      const y = text(context, data.title, 0.45 * k, 0.2 * k, 6.8 * k, { size: 0.42 * k, family: SERIF, weight: 700, color: "#ffffff", maxLines: 1 });
      text(context, data.subtitle, 0.45 * k, y, 6.8 * k, { size: 0.16 * k, color: "rgba(255,255,255,.85)", maxLines: 1 });
      scaleBar(context, data, this.mapRect(k), 7.6 * k, 0.42 * k, 2.1 * k, 0.15 * k, { light: true });
      northArrow(context, 10.6 * k, 0.6 * k, 0.5 * k, data.heading, { light: true });
      brand(context, 11.2 * k, 0.25 * k, 0.6 * k, data);
      const rect = this.mapRect(k);
      map(context, rect, data);
      overlays(context, data, rect);
      const layers = data.legend.length || data.layers.length;
      if (layers) {
        plate(context, 0.3 * k, 5.0 * k, 3.4 * k, 2.2 * k, 0.08 * k, 0.92);
        legend(context, data, 0.45 * k, 5.12 * k, 3.1 * k, { size: 0.13 * k, bottom: 7.05 * k });
      }
      let link = null;
      if (data.qr) {
        plate(context, 11.85 * k, 5.65 * k, 1.25 * k, 1.6 * k, 0.08 * k, 0.94);
        link = qr(context, data, 11.95 * k, 5.75 * k, 1.05 * k);
      }
      return [link];
    },
  },
  {
    id: "image-overlay",
    label: "Map with images",
    description: "A framed map you can place your own images on: logos, photos, insets or callouts.",
    page: { width: 11, height: 8.5 },
    images: true,
    mapRect: (k) => ({ x: 0.35 * k, y: 0.35 * k, w: 10.3 * k, h: 7.0 * k }),
    draw(context, k, data) {
      band(context, 0, 0, 11 * k, 8.5 * k, data.palette);
      const rect = this.mapRect(k);
      map(context, rect, data);
      overlays(context, data, rect);
      context.fillStyle = data.palette.edge;
      context.fillRect(rect.x, rect.y + rect.h, rect.w, 0.05 * k);
      brand(context, 0.4 * k, 7.55 * k, 0.65 * k, data);
      const y = text(context, data.title, 2.6 * k, 7.55 * k, 6.4 * k, { size: 0.3 * k, family: SERIF, weight: 700, color: "#ffffff", maxLines: 1 });
      text(context, data.subtitle, 2.6 * k, y, 6.4 * k, { size: 0.13 * k, color: "rgba(255,255,255,.85)", maxLines: 1 });
      if (data.qr) {
        context.fillStyle = "#ffffff";
        context.fillRect(9.85 * k, 7.5 * k, 0.8 * k, 0.8 * k);
      }
      const link = qr(context, data, 9.88 * k, 7.53 * k, 0.74 * k, { caption: "" });
      return [link];
    },
  },
];

export const MAP_TEMPLATES = Object.freeze(templates.map(({ id, label, description, page, images = false }) => Object.freeze({ id, label, description, page, images })));

export function getTemplate(id) {
  return templates.find((template) => template.id === id) || templates[0];
}

/** The map frame's width ÷ height, for shaping the capture. */
/** Whether a template's optional strip would be empty, so its map can grow (wall maps). */
export function templateCompact(data = {}) {
  const legendItems = (data.legend?.length || 0) + (data.layers?.length || 0);
  return !legendItems && !data.qr && !data.description;
}

export function templateMapAspect(id, options = {}) {
  const rect = getTemplate(id).mapRect(100, options);
  return rect.w / rect.h;
}

export const DEFAULT_PAGE_FRAME = Object.freeze({ margin: 0, marginColor: "#ffffff", borderWidth: 0, borderColor: "#17201d" });

/**
 * Draws a template page. `ppi` sets the resolution (150 for print, ~40 for a
 * preview). `frame` adds a margin (inches) around the design and a border
 * (points) at its edge; the design shrinks evenly to fit inside.
 * Returns { canvas, links: [{ x, y, w, h, url }] in canvas pixels }.
 */
export function renderTemplate(id, data, { ppi = 150, frame = DEFAULT_PAGE_FRAME } = {}) {
  const template = getTemplate(id);
  showNorth = frame.showNorth !== false;
  showScale = frame.showScale !== false;
  const { width, height } = template.page;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * ppi);
  canvas.height = Math.round(height * ppi);
  const context = canvas.getContext("2d");
  const margin = Math.min(Math.max(Number(frame.margin) || 0, 0), Math.min(width, height) / 4);
  const border = Math.min(Math.max(Number(frame.borderWidth) || 0, 0), 24) / 72;
  context.fillStyle = /^#[0-9a-f]{6}$/i.test(frame.marginColor || "") ? frame.marginColor : "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  // The design keeps its proportions inside the margin and border.
  const inset = margin + border;
  const scale = Math.min((width - inset * 2) / width, (height - inset * 2) / height);
  const k = ppi * scale;
  const offsetX = (canvas.width - width * k) / 2;
  const offsetY = (canvas.height - height * k) / 2;
  context.save();
  context.translate(offsetX, offsetY);
  context.beginPath();
  context.rect(0, 0, width * k, height * k);
  context.clip();
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width * k, height * k);
  const page = { legend: [], layers: [], images: [], ...data };
  pageLinks = [];
  const drawn = (template.draw(context, k, page) || []).filter((link) => link?.url);
  // Every page links its map to the live map, whatever the template returned.
  const mapRect = template.mapRect(k, page);
  if (page.linkUrl && !drawn.some((link) => link.x === mapRect.x && link.y === mapRect.y)) drawn.push({ ...mapRect, url: page.linkUrl });
  const links = frame.links === false ? [] : [...pageLinks, ...drawn]
    .map((link) => ({ ...link, x: link.x + offsetX, y: link.y + offsetY }));
  context.restore();
  if (border > 0) {
    const line = border * ppi;
    context.strokeStyle = /^#[0-9a-f]{6}$/i.test(frame.borderColor || "") ? frame.borderColor : "#17201d";
    context.lineWidth = line;
    context.strokeRect(offsetX - line / 2, offsetY - line / 2, width * k + line, height * k + line);
  }
  return { canvas, links, template };
}
