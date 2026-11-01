// A small PDF writer for the app's reports: letter pages with the GISMap Online
// header band, wrapped Helvetica text, and JPEG images. No dependencies.
const textEncoder = new TextEncoder();

export const dataUrlBytes = (dataUrl) => Uint8Array.from(atob(String(dataUrl).split(",")[1] || ""), (character) => character.charCodeAt(0));

/**
 * Re-encodes an image as a JPEG asset for a PDF. With `width` and `height` the
 * image is letterboxed onto that canvas; with `maxSide` it keeps its own shape.
 */
export function imageToJpeg(source, { width, height, maxSide, quality = 0.92, background = "#ffffff" } = {}) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const natural = { width: image.naturalWidth || 1, height: image.naturalHeight || 1 };
      const scaleToFit = maxSide ? Math.min(1, maxSide / Math.max(natural.width, natural.height)) : 1;
      const canvasWidth = width ?? Math.round(natural.width * scaleToFit);
      const canvasHeight = height ?? Math.round(natural.height * scaleToFit);
      const canvas = document.createElement("canvas");
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      const context = canvas.getContext("2d");
      context.fillStyle = background;
      context.fillRect(0, 0, canvasWidth, canvasHeight);
      const scale = Math.min(canvasWidth / natural.width, canvasHeight / natural.height);
      const drawWidth = natural.width * scale;
      const drawHeight = natural.height * scale;
      context.drawImage(image, (canvasWidth - drawWidth) / 2, (canvasHeight - drawHeight) / 2, drawWidth, drawHeight);
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      resolve({ bytes: dataUrlBytes(dataUrl), width: canvasWidth, height: canvasHeight, dataUrl });
    };
    image.onerror = () => resolve(null);
    image.src = source;
  });
}

export const BRAND_LOGO = new URL("../assets/gis-map-online-mark-v2.png", import.meta.url).href;

/**
 * Print colours for each interface skin, so reports and briefings look like the
 * app they came from. `band` is the dark header and map frame, `accent` the
 * heading colour on white paper, `edge` the highlight stripe, `brand` the
 * wordmark on the band, and `soft` a light tint for table headers.
 */
export const PRINT_PALETTES = Object.freeze({
  gismap: { band: "#0f2921", frame: "#145b4e", accent: "#145d4d", edge: "#f3ae2b", brand: "#55cdb1", soft: "#e8f2ee" },
  "clean-light": { band: "#172033", frame: "#1d4f86", accent: "#145da0", edge: "#cf7b18", brand: "#7cc0f2", soft: "#e8f0f8" },
  "dark-analytical": { band: "#0c1217", frame: "#14454d", accent: "#176b77", edge: "#d7a64c", brand: "#52c4d1", soft: "#e5f1f3" },
  "tidal-95": { band: "#073b3a", frame: "#006d6b", accent: "#006d6b", edge: "#ef6f61", brand: "#8fe0d0", soft: "#e3f3ee" },
  portolan: { band: "#33251d", frame: "#5d4330", accent: "#8a5934", edge: "#c9a24f", brand: "#ead9b0", soft: "#f3ead4" },
  "velvet-orbit": { band: "#25102e", frame: "#5a1f63", accent: "#872f91", edge: "#f0bf61", brand: "#e06cef", soft: "#f4e6f6" },
  "violet-circuit": { band: "#080811", frame: "#2b1c4f", accent: "#5b3bb0", edge: "#35d7d0", brand: "#9a70ff", soft: "#ece8fb" },
  highway: { band: "#17202b", frame: "#2c3744", accent: "#d83b0b", edge: "#ff4b0b", brand: "#ffffff", soft: "#f0f2f3" },
  steeler: { band: "#303744", frame: "#4f5d73", accent: "#4f5d73", edge: "#b9b2bb", brand: "#dad5d2", soft: "#ebe7e4" },
  slice: { band: "#57332d", frame: "#704036", accent: "#9c4058", edge: "#e58b9d", brand: "#f8cbd0", soft: "#f9e7e3" },
  wavelength: { band: "#222326", frame: "#4b3030", accent: "#a83d2c", edge: "#ef804a", brand: "#ffb16e", soft: "#fff1e8" },
  connect: { band: "#063c40", frame: "#005963", accent: "#00656b", edge: "#f4cf22", brand: "#ffe45c", soft: "#fff6c9" },
});

export const printPalette = (skin) => PRINT_PALETTES[skin === "retro-print" ? "portolan" : skin] || PRINT_PALETTES.gismap;

/** "#rrggbb" as a PDF colour operand ("r g b"). */
export const pdfColor = (hex) => {
  const value = String(hex).replace("#", "");
  return [0, 2, 4].map((index) => (parseInt(value.slice(index, index + 2), 16) / 255).toFixed(3)).join(" ");
};

/** The GISMap Online mark as a JPEG asset that blends into the PDF header band. */
export const loadBrandLogo = (palette = PRINT_PALETTES.gismap) => imageToJpeg(BRAND_LOGO, { width: 120, height: 120, background: palette.band });

/** A QR code for a link, as a JPEG asset (the same encoding as the share cards). */
export async function qrAsset(url, { dark = "#072f2b" } = {}) {
  if (!url || !globalThis.QRCode?.toCanvas) return null;
  const canvas = document.createElement("canvas");
  await globalThis.QRCode.toCanvas(canvas, url, { width: 600, margin: 2, errorCorrectionLevel: "L", color: { dark, light: "#ffffff" } });
  const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
  return { bytes: dataUrlBytes(dataUrl), width: canvas.width, height: canvas.height };
}

const loadImage = (source) => new Promise((resolve) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => resolve(null);
  image.src = source;
});

/**
 * The branded QR card used by workflow sharing, API exports and PDF covers.
 * Keeping this in the document/export layer prevents each surface from drifting
 * into a different visual treatment.
 */
export async function brandedQrCanvas(url, {
  canvas = null,
  title = "GISMap Online",
  lines = [],
  footer = "Complete GISMap link encoded in this QR",
  palette = PRINT_PALETTES.gismap,
} = {}) {
  if (!url || !globalThis.QRCode?.toCanvas) return null;
  const target = canvas || document.createElement("canvas");
  target.width = 760;
  target.height = 960;
  const qrCanvas = document.createElement("canvas");
  await globalThis.QRCode.toCanvas(qrCanvas, url, { width: 520, margin: 2, errorCorrectionLevel: "L", color: { dark: palette.band, light: "#ffffff" } });
  const context = target.getContext("2d");
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, target.width, target.height);
  context.textAlign = "left";
  context.textBaseline = "alphabetic";
  const gradient = context.createLinearGradient(0, 0, target.width, target.height);
  gradient.addColorStop(0, palette.band);
  gradient.addColorStop(1, palette.frame);
  context.fillStyle = gradient;
  context.fillRect(0, 0, target.width, target.height);
  context.fillStyle = palette.edge;
  context.fillRect(0, 0, 12, target.height);
  const logo = await loadImage(BRAND_LOGO);
  if (logo) context.drawImage(logo, 48, 42, 118, 118);
  context.fillStyle = palette.brand;
  context.font = "700 34px system-ui, sans-serif";
  context.fillText("GIS MAP", 188, 87);
  context.fillStyle = palette.edge;
  context.font = "700 20px system-ui, sans-serif";
  context.letterSpacing = "6px";
  context.fillText("ONLINE", 190, 122);
  context.letterSpacing = "0px";
  context.fillStyle = "#ffffff";
  context.font = "700 38px Georgia, serif";
  context.fillText(String(title || "GISMap Online").slice(0, 54), 58, 218, 644);
  context.fillStyle = "rgb(255 255 255 / 72%)";
  context.font = "20px system-ui, sans-serif";
  lines.slice(0, 2).forEach((line, index) => context.fillText(String(line), 58, 250 + index * 28, 644));
  context.fillStyle = "#ffffff";
  context.fillRect(96, 300, 568, 568);
  context.drawImage(qrCanvas, 120, 324, 520, 520);
  context.fillStyle = "rgb(255 255 255 / 82%)";
  context.font = "16px system-ui, sans-serif";
  context.textAlign = "center";
  if (footer) context.fillText(String(footer), 380, 900, 680);
  context.fillStyle = palette.edge;
  context.font = "700 18px system-ui, sans-serif";
  context.fillText("gismap.online", 380, 930);
  context.textAlign = "left";
  return target;
}

export async function brandedQrImage(url, options = {}) {
  const canvas = await brandedQrCanvas(url, options);
  if (!canvas) return null;
  const dataUrl = canvas.toDataURL("image/jpeg", 0.94);
  return { bytes: dataUrlBytes(dataUrl), width: canvas.width, height: canvas.height };
}

export async function brandedQrFile(url, { fileName = "gismap-qr.png", ...options } = {}) {
  const canvas = await brandedQrCanvas(url, options);
  if (!canvas) return null;
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  return blob ? new File([blob], fileName, { type: "image/png" }) : null;
}

/**
 * Frames a map snapshot like the QR cards, for every PDF the app makes: a border
 * in the skin palette, the GISMap Online mark and name, a title and subtitle above, and an
 * optional pin legend below. `legend` items are { shape: "diamond" | "small-diamond"
 * | "circle", label }. `footerText` provides a plain left-aligned alternative
 * for exports, such as Smart Images, that do not have a truthful symbol legend.
 */
export async function brandedMapCanvas(mapImage, {
  title = "",
  subtitle = "",
  legend = [],
  footerText = "",
  mapWidth = 1200,
  palette = PRINT_PALETTES.gismap,
  brandText = "gismap.online",
} = {}) {
  const [map, logo] = await Promise.all([loadImage(mapImage.dataUrl), loadImage(BRAND_LOGO)]);
  if (!map) return null;
  const border = 18;
  const header = 118;
  const footer = 64;
  const mapHeight = Math.round(mapWidth * (mapImage.height / mapImage.width));
  const canvas = document.createElement("canvas");
  canvas.width = mapWidth + border * 2;
  canvas.height = header + mapHeight + footer + border;
  const context = canvas.getContext("2d");
  const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, palette.band);
  gradient.addColorStop(1, palette.frame);
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = palette.edge;
  context.fillRect(0, 0, 10, canvas.height);
  if (logo) context.drawImage(logo, border + 14, 18, 82, 82);
  context.textBaseline = "alphabetic";
  context.fillStyle = palette.brand;
  context.font = "700 26px system-ui, sans-serif";
  context.fillText("GIS MAP", border + 112, 50);
  context.fillStyle = palette.edge;
  context.font = "700 15px system-ui, sans-serif";
  context.fillText("O N L I N E", border + 114, 74);
  context.textAlign = "right";
  context.fillStyle = "#ffffff";
  context.font = "700 34px Georgia, serif";
  context.fillText(String(title).slice(0, 48), canvas.width - border - 10, 56, 760);
  context.fillStyle = "rgb(255 255 255 / 72%)";
  context.font = "20px system-ui, sans-serif";
  context.fillText(String(subtitle).slice(0, 90), canvas.width - border - 10, 90, 760);
  context.textAlign = "left";
  context.drawImage(map, border, header, mapWidth, mapHeight);
  context.strokeStyle = palette.brand;
  context.lineWidth = 3;
  context.strokeRect(border - 1.5, header - 1.5, mapWidth + 3, mapHeight + 3);
  const legendY = header + mapHeight + 40;
  let x = border + 10;
  const diamond = (cx, cy, size) => {
    context.fillStyle = "#d9951e";
    context.strokeStyle = "#ffffff";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(cx, cy - size); context.lineTo(cx + size, cy); context.lineTo(cx, cy + size); context.lineTo(cx - size, cy); context.closePath();
    context.fill(); context.stroke();
  };
  const shapes = {
    diamond: (cx, cy) => diamond(cx, cy, 10),
    "small-diamond": (cx, cy) => diamond(cx, cy, 7),
    circle: (cx, cy) => {
      context.fillStyle = "#0f8f6e";
      context.strokeStyle = "#ffffff";
      context.lineWidth = 3;
      context.beginPath(); context.arc(cx, cy, 9, 0, Math.PI * 2); context.fill(); context.stroke();
    },
  };
  legend.forEach(({ shape, label }) => {
    shapes[shape]?.(x + 12, legendY - 7);
    context.fillStyle = "#ffffff";
    context.font = "600 20px system-ui, sans-serif";
    context.fillText(label, x + 32, legendY);
    x += 44 + context.measureText(label).width;
  });
  if (!legend.length && footerText) {
    context.fillStyle = "#ffffff";
    context.font = "600 18px system-ui, sans-serif";
    context.fillText(String(footerText).slice(0, 92), x, legendY, canvas.width - border * 2 - 190);
  }
  context.fillStyle = palette.edge;
  context.font = "700 18px system-ui, sans-serif";
  context.textAlign = "right";
  context.fillText(brandText, canvas.width - border - 10, legendY);
  context.textAlign = "left";
  return canvas;
}

export async function brandedMapImage(mapImage, options = {}) {
  const canvas = await brandedMapCanvas(mapImage, options);
  if (!canvas) return null;
  const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
  return { bytes: dataUrlBytes(dataUrl), width: canvas.width, height: canvas.height };
}

// PDF strings escape backslashes and parentheses; URLs are otherwise plain ASCII here.
const pdfUri = (url) => String(url).replace(/[^\x20-\x7e]/g, "").replace(/[\\()]/g, "\\$&");

// The built-in PDF fonts use a limited encoding. Preserve the meaning of common
// map and measurement characters instead of emitting question marks.
export const pdfSafeText = (value) => String(value ?? "")
  .replace(/[µμ]/g, "u").replace(/³/g, "3").replace(/²/g, "2")
  .replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-").replace(/[·•]/g, "-")
  .replace(/[\\()]/g, "\\$&").replace(/[^\x20-\x7e]/g, "?");

const wrap = (value, maxChars) => String(value ?? "").split(/\n/).flatMap((paragraph) => {
  if (!paragraph.trim()) return [""];
  const words = paragraph.trim().split(/\s+/);
  const lines = [];
  let line = "";
  words.forEach((word) => {
    if (`${line} ${word}`.trim().length > maxChars && line) {
      lines.push(line);
      line = word;
    } else line = `${line} ${word}`.trim();
  });
  if (line) lines.push(line);
  return lines;
});

export const PDF_COLORS = Object.freeze({ ink: "0.09 0.16 0.14", muted: "0.36 0.44 0.41", accent: "0.08 0.36 0.30", link: "0.05 0.40 0.55" });

export class PdfDocument {
  /**
   * Letter portrait by default; pass pageWidth 792 / pageHeight 612 for
   * landscape. `palette` (see printPalette) colours the header and headings.
   */
  constructor({ heading, logo = null, homeUrl = "https://gismap.online/", pageWidth = 612, pageHeight = 792, margin = 48, palette = PRINT_PALETTES.gismap, header = true }) {
    Object.assign(this, { heading, logo, homeUrl, pageWidth, pageHeight, margin, palette, header });
    this.colors = { ...PDF_COLORS, accent: pdfColor(palette.accent), soft: pdfColor(palette.soft) };
    this.pages = [];
    this.page = null;
    this.y = 0;
    this.newPage();
  }

  /** The top of the page body, below the header band and page heading. */
  get top() {
    return this.pageHeight - 132;
  }

  newPage() {
    // The header band mirrors the QR cards: the skin's dark band, an edge stripe,
    // the mark, "GIS MAP" over a spaced "ONLINE". It links to the site.
    const { margin: left, pageWidth, pageHeight, palette } = this;
    if (!this.header) {
      // A bare page, for templates that draw their own design.
      this.page = { commands: [], images: [], links: [] };
      this.pages.push(this.page);
      this.y = pageHeight - this.margin;
      return;
    }
    const band = pageHeight - 88;
    this.page = { commands: [
      `${pdfColor(palette.band)} rg ${left} ${band} ${pageWidth - left * 2} 44 re f`,
      `${pdfColor(palette.edge)} rg ${left} ${band} 4 44 re f`,
      `${pdfColor(palette.brand)} rg BT /F2 15 Tf ${left + 52} ${band + 25} Td (GIS MAP) Tj ET`,
      `${pdfColor(palette.edge)} rg BT /F2 7.5 Tf 2.2 Tc ${left + 53} ${band + 11} Td (ONLINE) Tj ET 0 Tc`,
      `${this.colors.accent} rg BT /F2 11 Tf ${left} ${band - 22} Td (${pdfSafeText(this.heading)}) Tj ET`,
    ], images: [], links: [] };
    if (this.logo) {
      this.page.images.push({ name: "ImLogo", asset: this.logo });
      this.page.commands.push(`q 36 0 0 36 ${left + 12} ${band + 4} cm /ImLogo Do Q`);
    }
    if (this.homeUrl) this.addLink([left, band, left + 212, band + 44], this.homeUrl);
    this.pages.push(this.page);
    this.y = this.top;
  }

  /** Makes a rectangle [x1, y1, x2, y2] on the current page open a URL. */
  addLink(rect, url) {
    if (url) this.page.links.push({ rect: rect.map((value) => Number(value).toFixed(2)), url });
  }

  gap(points) {
    this.y -= points;
  }

  /** Wrapped text. With `link`, each line is underlined and opens the URL. */
  addLines(text, { size = 10, leading = 15, color = PDF_COLORS.ink, bold = false, maxChars = 91, link = null } = {}) {
    wrap(text, maxChars).forEach((line) => {
      if (this.y < this.margin + leading) this.newPage();
      const lineColor = link ? PDF_COLORS.link : color;
      this.page.commands.push(`${lineColor} rg BT /F${bold ? 2 : 1} ${size} Tf ${this.margin} ${this.y} Td (${pdfSafeText(line)}) Tj ET`);
      if (link) {
        // Helvetica averages about half the font size per character.
        const width = Math.min(this.pageWidth - this.margin * 2, line.length * size * 0.52);
        this.page.commands.push(`${lineColor} RG 0.6 w ${this.margin} ${this.y - 1.6} m ${(this.margin + width).toFixed(2)} ${this.y - 1.6} l S`);
        this.addLink([this.margin, this.y - 3, this.margin + width, this.y + size], link);
      }
      this.y -= leading;
    });
  }

  /** Wrapped text in a box of its own (a column of a landscape slide). Returns the y below it. */
  addTextAt(text, { x, y, width, size = 10, leading = size * 1.45, color = PDF_COLORS.ink, bold = false, link = null, bottom = this.margin } = {}) {
    const maxChars = Math.max(8, Math.floor(width / (size * 0.5)));
    let lineY = y;
    for (const line of wrap(text, maxChars)) {
      if (lineY < bottom) break;
      const lineColor = link ? PDF_COLORS.link : color;
      this.page.commands.push(`${lineColor} rg BT /F${bold ? 2 : 1} ${size} Tf ${x.toFixed(2)} ${lineY.toFixed(2)} Td (${pdfSafeText(line)}) Tj ET`);
      if (link) this.addLink([x, lineY - 3, x + Math.min(width, line.length * size * 0.52), lineY + size], link);
      lineY -= leading;
    }
    return lineY;
  }

  /** An image fitted inside a box, centred; returns the drawn rectangle. */
  addImageAt(asset, { x, y, width, height, link = null, border = null } = {}) {
    if (!asset?.bytes?.length) return null;
    const scale = Math.min(width / asset.width, height / asset.height);
    const drawWidth = asset.width * scale;
    const drawHeight = asset.height * scale;
    const left = x + (width - drawWidth) / 2;
    const bottom = y - height + (height - drawHeight) / 2;
    const name = `Im${this.pages.length}x${this.page.images.length}`;
    this.page.images.push({ name, asset });
    this.page.commands.push(`q ${drawWidth.toFixed(2)} 0 0 ${drawHeight.toFixed(2)} ${left.toFixed(2)} ${bottom.toFixed(2)} cm /${name} Do Q`);
    if (border) this.page.commands.push(`${pdfColor(border)} RG 1.5 w ${left.toFixed(2)} ${bottom.toFixed(2)} ${drawWidth.toFixed(2)} ${drawHeight.toFixed(2)} re S`);
    if (link) this.addLink([left, bottom, left + drawWidth, bottom + drawHeight], link);
    return { x: left, y: bottom, width: drawWidth, height: drawHeight };
  }

  /** A filled rectangle in a palette colour ("#rrggbb"). */
  fillRect(x, y, width, height, hex) {
    this.page.commands.push(`${pdfColor(hex)} rg ${x.toFixed(2)} ${y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re f`);
  }

  heading2(text) {
    this.addLines(text, { size: 13, leading: 18, color: this.colors.accent, bold: true });
  }

  /** Places an image at full text width (or narrower to respect maxHeight), starting a page if it does not fit. */
  addImage(asset, { maxHeight = 360, gapAfter = 18, link = null, maxWidth: widthLimit = null } = {}) {
    if (!asset?.bytes?.length) return;
    const maxWidth = widthLimit ?? this.pageWidth - (this.margin * 2);
    const ratio = asset.height / asset.width;
    const imageHeight = Math.min(maxHeight, maxWidth * ratio);
    const imageWidth = imageHeight / ratio;
    if (this.y - imageHeight < this.margin) this.newPage();
    const name = `Im${this.pages.length}x${this.page.images.length}`;
    this.page.images.push({ name, asset });
    this.page.commands.push(`q ${imageWidth.toFixed(2)} 0 0 ${imageHeight.toFixed(2)} ${this.margin} ${(this.y - imageHeight).toFixed(2)} cm /${name} Do Q`);
    if (link) this.addLink([this.margin, this.y - imageHeight, this.margin + imageWidth, this.y], link);
    this.y -= imageHeight + gapAfter;
  }

  /**
   * A ruled table. `columns` are { label, width } in points (summing to the text
   * width); cells wrap within their column and rows move to a new page whole,
   * repeating the header.
   */
  addTable(columns, rows, { size = 7, leading = 9, padding = 4 } = {}) {
    const charsFor = (width) => Math.max(4, Math.floor((width - padding * 2) / (size * 0.5)));
    const cellLines = (value, width) => wrap(value, charsFor(width)).flatMap((line) => {
      const max = charsFor(width);
      const chunks = [];
      for (let index = 0; index < line.length; index += max) chunks.push(line.slice(index, index + max));
      return chunks.length ? chunks : [""];
    });
    const drawRow = (cells, { header = false } = {}) => {
      const lines = cells.map((value, index) => cellLines(value, columns[index].width));
      const height = Math.max(...lines.map((cell) => cell.length)) * leading + padding * 2;
      if (this.y - height < this.margin) {
        this.newPage();
        if (!header) drawRow(columns.map((column) => column.label), { header: true });
      }
      const top = this.y;
      if (header) this.page.commands.push(`${this.colors.soft} rg ${this.margin} ${(top - height).toFixed(2)} ${this.pageWidth - this.margin * 2} ${height.toFixed(2)} re f`);
      let x = this.margin;
      lines.forEach((cell, index) => {
        cell.forEach((line, lineIndex) => {
          this.page.commands.push(`${header ? this.colors.accent : PDF_COLORS.ink} rg BT /F${header ? 2 : 1} ${size} Tf ${(x + padding).toFixed(2)} ${(top - padding - size - lineIndex * leading).toFixed(2)} Td (${pdfSafeText(line)}) Tj ET`);
        });
        x += columns[index].width;
      });
      this.page.commands.push(`0.75 0.80 0.78 RG 0.5 w ${this.margin} ${(top - height).toFixed(2)} m ${this.pageWidth - this.margin} ${(top - height).toFixed(2)} l S`);
      this.y = top - height;
    };
    drawRow(columns.map((column) => column.label), { header: true });
    rows.forEach((row) => drawRow(row.map((value) => String(value ?? ""))));
    this.y -= 12;
  }

  toBlob() {
    const objects = [null];
    const reserve = () => { objects.push(""); return objects.length - 1; };
    const setObject = (id, value) => { objects[id] = value; };
    const catalogId = reserve();
    const pagesId = reserve();
    const regularFontId = reserve();
    const boldFontId = reserve();
    setObject(regularFontId, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
    setObject(boldFontId, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
    const imageIds = new Map();
    const imageObject = (asset) => {
      if (imageIds.has(asset)) return imageIds.get(asset);
      const imageId = reserve();
      const header = textEncoder.encode(`<< /Type /XObject /Subtype /Image /Width ${asset.width} /Height ${asset.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${asset.bytes.length} >>\nstream\n`);
      const footer = textEncoder.encode("\nendstream");
      const bytes = new Uint8Array(header.length + asset.bytes.length + footer.length);
      bytes.set(header);
      bytes.set(asset.bytes, header.length);
      bytes.set(footer, header.length + asset.bytes.length);
      setObject(imageId, bytes);
      imageIds.set(asset, imageId);
      return imageId;
    };
    const pageIds = this.pages.map((currentPage) => {
      const stream = currentPage.commands.join("\n");
      const contentId = reserve();
      setObject(contentId, `<< /Length ${textEncoder.encode(stream).length} >>\nstream\n${stream}\nendstream`);
      const pageId = reserve();
      const xObjects = currentPage.images.map(({ name, asset }) => `/${name} ${imageObject(asset)} 0 R`).join(" ");
      const annotations = currentPage.links.map(({ rect, url }) => {
        const annotationId = reserve();
        setObject(annotationId, `<< /Type /Annot /Subtype /Link /Rect [${rect.join(" ")}] /Border [0 0 0] /A << /S /URI /URI (${pdfUri(url)}) >> >>`);
        return `${annotationId} 0 R`;
      });
      setObject(pageId, `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${this.pageWidth} ${this.pageHeight}] /Resources << /Font << /F1 ${regularFontId} 0 R /F2 ${boldFontId} 0 R >>${xObjects ? ` /XObject << ${xObjects} >>` : ""} >>${annotations.length ? ` /Annots [${annotations.join(" ")}]` : ""} /Contents ${contentId} 0 R >>`);
      return pageId;
    });
    setObject(pagesId, `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`);
    setObject(catalogId, `<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
    const chunks = [textEncoder.encode("%PDF-1.4\n%????\n")];
    let length = chunks[0].length;
    const offsets = [0];
    objects.slice(1).forEach((object, index) => {
      offsets[index + 1] = length;
      const head = textEncoder.encode(`${index + 1} 0 obj\n`);
      const body = typeof object === "string" ? textEncoder.encode(object) : object;
      const tail = textEncoder.encode("\nendobj\n");
      chunks.push(head, body, tail);
      length += head.length + body.length + tail.length;
    });
    const xrefOffset = length;
    chunks.push(textEncoder.encode(`xref\n0 ${objects.length}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`));
    return new Blob(chunks, { type: "application/pdf" });
  }
}
