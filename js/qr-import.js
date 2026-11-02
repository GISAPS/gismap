// Opening GISMap Online links from pictures: a QR card, a screenshot or a photo of
// one. The browser's own BarcodeDetector is used where it exists (Chrome,
// Android); elsewhere (Safari, Firefox) the vendored jsQR decoder is loaded on
// first use. Only links to GISMap Online itself are opened.

const JSQR_URL = new URL("./vendor/jsqr-1.4.0.js", import.meta.url).href;
// Photos are scaled down for speed first; a small QR in a large photo gets a second, sharper pass.
const PASSES = [1400, 2800];
let jsQrLoading = null;

/**
 * jsQR is a UMD bundle. On this page ArcGIS's AMD loader defines `define`, which
 * would capture it, so the vendored file runs with its own CommonJS `module`.
 */
function loadJsQr() {
  if (globalThis.jsQR) return Promise.resolve(globalThis.jsQR);
  jsQrLoading ||= fetch(JSQR_URL)
    .then((response) => {
      if (!response.ok) throw new Error(`The QR reader could not be loaded (${response.status}).`);
      return response.text();
    })
    .then((source) => {
      const module = { exports: {} };
      new Function("module", "exports", "define", source)(module, module.exports, undefined);
      const jsQR = typeof module.exports === "function" ? module.exports : module.exports.default;
      if (typeof jsQR !== "function") throw new Error("The QR reader did not load.");
      globalThis.jsQR = jsQR;
      return jsQR;
    })
    .catch((error) => { jsQrLoading = null; throw error; });
  return jsQrLoading;
}

async function nativeDetect(bitmap) {
  if (typeof globalThis.BarcodeDetector !== "function") return null;
  try {
    const formats = await globalThis.BarcodeDetector.getSupportedFormats?.();
    if (formats && !formats.includes("qr_code")) return null;
    const codes = await new globalThis.BarcodeDetector({ formats: ["qr_code"] }).detect(bitmap);
    return codes.find((code) => code.rawValue)?.rawValue || null;
  } catch {
    return null;
  }
}

/** The text of the first QR code in an image file, or null when there is none. */
export async function decodeQrFromImage(file) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("This image could not be read. Try a PNG or JPEG screenshot of the QR code.");
  }
  try {
    const native = await nativeDetect(bitmap);
    if (native) return native;
    const jsQR = await loadJsQr();
    const largest = Math.max(bitmap.width, bitmap.height);
    for (const side of PASSES) {
      const scale = Math.min(1, side / largest);
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      context.drawImage(bitmap, 0, 0, width, height);
      const code = jsQR(context.getImageData(0, 0, width, height).data, width, height, { inversionAttempts: "attemptBoth" });
      if (code?.data) return code.data;
      if (scale === 1) break;
    }
    return null;
  } finally {
    bitmap.close?.();
  }
}

const GISMAP_HOSTS = /^(?:www\.)?gismap\.online$|(?:^|[.-])gismap\.silasmerlin\.workers\.dev$|^localhost$|^127\.0\.0\.1$/i;

/**
 * A QR's text as a link to open in this copy of the app: links to GISMap Online
 * (the site, its preview builds or this host) keep their path, query and
 * fragment but open here. Anything else returns null and is never followed.
 */
export function gisMapLinkFrom(text, { here = globalThis.location } = {}) {
  let url;
  try {
    url = new URL(String(text || "").trim());
  } catch {
    return null;
  }
  if (!["https:", "http:"].includes(url.protocol)) return null;
  if (url.hostname !== here.hostname && !GISMAP_HOSTS.test(url.hostname)) return null;
  // A QR card may have been created from an http:// visit before the host
  // upgraded the page. Never follow that address: only reuse its path, query
  // and fragment on this app's current (normally HTTPS) origin. The hostname
  // above is already restricted to GISMap Online hosts, so this keeps import safe
  // while making existing share cards portable.
  return new URL(`${url.pathname}${url.search}${url.hash}`, here.origin).href;
}

/** What a GISMap Online link opens, for the message shown while it loads. */
export function describeGisMapLink(href) {
  const url = new URL(href);
  const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
  if (hash.has("briefing") || url.searchParams.has("briefing")) return "briefing";
  if (hash.has("map")) return "map";
  if (hash.has("tour")) return "tour";
  if (hash.has("fieldTask")) return "field task";
  if (hash.has("fieldNote")) return "observation";
  if (hash.has("at")) return "location";
  return url.searchParams.has("layer") || url.searchParams.has("example") ? "map" : "link";
}

/** Opens a GISMap Online link here. A fragment-only change still reloads, since the app reads the address once at start. */
export function openGisMapLink(href, { here = globalThis.location } = {}) {
  const target = new URL(href);
  const samePage = target.pathname === here.pathname && target.search === here.search;
  here.assign(target.href);
  if (samePage) here.reload();
}
