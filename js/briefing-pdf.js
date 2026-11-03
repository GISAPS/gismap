// A briefing as a landscape PDF handout: a cover with the QR code back to the
// live briefing, then one page per slide laid out like the 16:9 stage (content
// column beside a map snapshot), in the colours of the briefing's skin.
import { PDF_COLORS, PdfDocument, brandedQrImage, imageToJpeg, loadBrandLogo, pdfColor, printPalette } from "./pdf-document.js?v=0.69.1-pdflinks";

const PAGE = { width: 792, height: 612, margin: 48 };

/** Markdown as plain paragraphs: headings, emphasis and link syntax removed. */
export function markdownToText(markdown) {
  return String(markdown ?? "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "- ")
    .replace(/[*_`~]+/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export const briefingFileStem = (title) => String(title || "briefing").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "briefing";

/**
 * `slides` are [{ content, mapImage }] where content comes from
 * BriefingSlides.slideContent and mapImage is an optional { dataUrl, width, height }.
 * `link` is the live briefing's share link; `qr` says whether it fits a QR code.
 */
export async function briefingPdf({ title = "Briefing", skin = null, slides = [], link = null, qr = true, date = new Date() }) {
  const palette = printPalette(skin);
  const logo = await loadBrandLogo(palette);
  const pdf = new PdfDocument({ heading: title.toUpperCase(), logo, palette, pageWidth: PAGE.width, pageHeight: PAGE.height, margin: PAGE.margin });
  const accent = pdf.colors.accent;
  const muted = PDF_COLORS.muted;
  const inner = PAGE.width - PAGE.margin * 2;
  const footer = (label) => {
    pdf.page.commands.push(`${pdfColor(palette.edge)} rg ${PAGE.margin} 34 ${inner} 1.2 re f`);
    pdf.addTextAt(label, { x: PAGE.margin, y: 22, width: inner, size: 8, color: muted, bottom: 0 });
    pdf.addSiteLink(22);
  };

  // Cover: title, date, slide count and the way back to the live briefing.
  let y = pdf.top - 30;
  y = pdf.addTextAt(title, { x: PAGE.margin, y, width: 430, size: 28, leading: 34, bold: true, color: accent });
  y = pdf.addTextAt(`${date.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })} - ${slides.length} slide${slides.length === 1 ? "" : "s"}`, { x: PAGE.margin, y: y - 6, width: 430, size: 12, color: muted });
  pdf.fillRect(PAGE.margin, y - 10, 64, 4, palette.edge);
  y -= 40;
  const outline = slides.slice(0, 14).map(({ content }, index) => `${index + 1}. ${content.title || "Untitled slide"}`).join("\n");
  y = pdf.addTextAt(outline, { x: PAGE.margin, y, width: 430, size: 11, leading: 17 });
  if (slides.length > 14) pdf.addTextAt(`and ${slides.length - 14} more`, { x: PAGE.margin, y, width: 430, size: 10, color: muted });
  if (link) {
    const code = qr ? await brandedQrImage(link, {
      title,
      lines: [`Scan to present ${slides.length} slide${slides.length === 1 ? "" : "s"}, or long-click the QR code`, "to open it in a browser."],
      footer: "Complete briefing encoded in this QR",
      palette,
    }).catch(() => null) : null;
    const boxX = 536;
    if (code) {
      pdf.addImageAt(code, { x: boxX, y: pdf.top + 4, width: 190, height: 240, link });
    } else {
      pdf.addTextAt("This briefing is too detailed for a QR code. Click to open the live briefing:", { x: boxX, y: pdf.top - 20, width: 200, size: 9, leading: 13, color: muted });
    }
    pdf.addTextAt("Open the live briefing", { x: boxX, y: pdf.top - (code ? 252 : 60), width: 190, size: 11, bold: true, link });
  }
  footer(title);

  for (const [index, { content, mapImage }] of slides.entries()) {
    pdf.newPage();
    const top = pdf.top;
    const map = mapImage?.dataUrl ? await imageToJpeg(mapImage.dataUrl, { maxSide: 1400, quality: 0.88 }) : null;
    const columnWidth = map ? 250 : inner;
    let cursor = pdf.addTextAt(`SLIDE ${index + 1} OF ${slides.length}`, { x: PAGE.margin, y: top, width: columnWidth, size: 8, color: muted, bold: true });
    cursor = pdf.addTextAt(content.title || "Untitled slide", { x: PAGE.margin, y: cursor - (map ? 12 : 18), width: columnWidth, size: map ? 18 : 24, leading: map ? 22 : 29, bold: true, color: accent });
    if (content.subtitle) cursor = pdf.addTextAt(content.subtitle, { x: PAGE.margin, y: cursor - 2, width: columnWidth, size: 11, leading: 15, color: muted });
    cursor -= 10;
    if (content.stats.length) {
      const perRow = map ? 2 : Math.min(4, content.stats.length);
      const cell = columnWidth / perRow;
      content.stats.forEach((stat, statIndex) => {
        const x = PAGE.margin + (statIndex % perRow) * cell;
        const rowY = cursor - Math.floor(statIndex / perRow) * 54;
        pdf.addTextAt(stat.value, { x, y: rowY - 18, width: cell - 8, size: 20, bold: true, color: accent });
        pdf.addTextAt(`${stat.label}${stat.sample ? " (sample)" : ""}`, { x, y: rowY - 34, width: cell - 8, size: 8, leading: 10, color: muted });
      });
      cursor -= Math.ceil(content.stats.length / perRow) * 54 + 6;
    }
    for (const [label, value] of content.facts) {
      cursor = pdf.addTextAt(label, { x: PAGE.margin, y: cursor, width: columnWidth, size: 7.5, color: muted, bold: true });
      cursor = pdf.addTextAt(value, { x: PAGE.margin, y: cursor + 2, width: columnWidth, size: 10, leading: 13 }) - 4;
    }
    for (const paragraph of content.paragraphs) cursor = pdf.addTextAt(paragraph, { x: PAGE.margin, y: cursor - 4, width: columnWidth, size: 10, leading: 14 }) - 4;
    for (const item of content.list) cursor = pdf.addTextAt(`- ${item}`, { x: PAGE.margin, y: cursor, width: columnWidth, size: 10, leading: 14 });
    for (const item of content.links) cursor = pdf.addTextAt(item.label || item.url, { x: PAGE.margin, y: cursor - 2, width: columnWidth, size: 10, leading: 14, link: item.url });
    if (content.missing) cursor = pdf.addTextAt("This slide's feature was not in the loaded data.", { x: PAGE.margin, y: cursor - 4, width: columnWidth, size: 9, color: muted });
    if (content.notes) {
      cursor -= 6;
      cursor = pdf.addTextAt("Notes", { x: PAGE.margin, y: cursor, width: columnWidth, size: 8, bold: true, color: muted });
      pdf.addTextAt(content.notes, { x: PAGE.margin, y: cursor, width: columnWidth, size: 8.5, leading: 12, color: muted, bottom: 48 });
    }
    if (map) {
      const box = { x: PAGE.margin + columnWidth + 20, y: top + 10, width: inner - columnWidth - 20, height: top - 40 };
      pdf.addImageAt(map, { ...box, border: palette.frame, link: link ? withSlide(link, content.id) : null });
    }
    footer(`${title} - slide ${index + 1} of ${slides.length}`);
  }
  return pdf.toBlob();
}

/** The share link, opened at one slide. */
export function withSlide(link, slideId) {
  if (!link || !slideId) return link;
  const url = new URL(link);
  const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
  hash.set("slide", slideId);
  url.hash = hash.toString();
  return url.href;
}
