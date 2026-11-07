import { sanitizeSharedResourceUrl } from "./share.js?v=0.69.7-year";
import { brandedMapCanvas, printPalette } from "./pdf-document.js?v=0.69.1-pdflinks";

export const SMART_IMAGE_FORMAT = "gismap-smart-image";
export const SMART_IMAGE_VERSION = 1;
export const SMART_IMAGE_CHUNK = "giMp";
export const SMART_IMAGE_LIMITS = Object.freeze({
  maxImageBytes: 64 * 1024 * 1024,
  maxEncodedBytes: 10 * 1024 * 1024,
  maxProjectBytes: 25 * 1024 * 1024,
});

const PNG_SIGNATURE = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
const PAYLOAD_MAGIC = new TextEncoder().encode("GISMAP1\0");
const SENSITIVE_KEY = /^(?:token|oauth[_-]?token|access[_-]?token|api[_-]?key|apikey|key|client[_-]?secret|password|passwd|pwd|authorization|auth|signature|sig)$/i;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

let crcTable = null;

function getCrcTable() {
  if (crcTable) return crcTable;
  crcTable = new Uint32Array(256);
  for (let value = 0; value < 256; value += 1) {
    let crc = value;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc & 1) ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    crcTable[value] = crc >>> 0;
  }
  return crcTable;
}

function crc32(bytes) {
  const table = getCrcTable();
  let crc = 0xffffffff;
  for (const byte of bytes) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function concatBytes(parts) {
  const length = parts.reduce((sum, part) => sum + part.byteLength, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.byteLength;
  }
  return output;
}

function equalBytes(left, right) {
  return left.byteLength === right.byteLength && left.every((byte, index) => byte === right[index]);
}

function pngChunks(bytes) {
  if (bytes.byteLength < PNG_SIGNATURE.byteLength || !equalBytes(bytes.subarray(0, 8), PNG_SIGNATURE)) {
    throw new Error("This file is not a PNG image.");
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const chunks = [];
  let offset = PNG_SIGNATURE.byteLength;
  while (offset + 12 <= bytes.byteLength) {
    const length = view.getUint32(offset);
    const end = offset + 12 + length;
    if (length > SMART_IMAGE_LIMITS.maxImageBytes || end > bytes.byteLength) throw new Error("This PNG contains an invalid chunk.");
    const typeBytes = bytes.subarray(offset + 4, offset + 8);
    const type = String.fromCharCode(...typeBytes);
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    const storedCrc = view.getUint32(offset + 8 + length);
    chunks.push({ type, typeBytes, data, storedCrc, bytes: bytes.subarray(offset, end) });
    offset = end;
    if (type === "IEND") break;
  }
  if (!chunks.some((chunk) => chunk.type === "IEND")) throw new Error("This PNG is incomplete.");
  return chunks;
}

function makeChunk(type, data) {
  if (!/^[A-Za-z]{4}$/.test(type)) throw new Error("PNG chunk names must contain four ASCII letters.");
  const typeBytes = encoder.encode(type);
  const output = new Uint8Array(12 + data.byteLength);
  const view = new DataView(output.buffer);
  view.setUint32(0, data.byteLength);
  output.set(typeBytes, 4);
  output.set(data, 8);
  view.setUint32(8 + data.byteLength, crc32(concatBytes([typeBytes, data])));
  return output;
}

async function transform(bytes, mode, maxBytes) {
  const Constructor = mode === "compress" ? globalThis.CompressionStream : globalThis.DecompressionStream;
  if (!Constructor) return null;
  try {
    const stream = new Blob([bytes]).stream().pipeThrough(new Constructor("deflate-raw"));
    const reader = stream.getReader();
    const parts = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new Error("The embedded GISMap Online project exceeds the safe size limit.");
      }
      parts.push(value);
    }
    return concatBytes(parts);
  } catch (error) {
    if (error instanceof TypeError) return null;
    throw error;
  }
}

async function sha256(bytes) {
  if (!globalThis.crypto?.subtle) throw new Error("Smart Images require the browser's cryptography API.");
  return new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", bytes));
}

function assertSafeProject(project) {
  if (!project || project.version !== 1 || !Array.isArray(project.layers)) {
    throw new Error("The Smart Image does not contain a supported GISMap Online project.");
  }
  for (const layer of project.layers) {
    if (!layer?.url || layer.local) continue;
    const parsed = new URL(String(layer.url));
    const allowHttp = parsed.protocol === "http:" && ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
    sanitizeSharedResourceUrl(layer.url, { allowHttp });
    for (const key of Object.keys(layer.customParameters || {})) {
      if (SENSITIVE_KEY.test(key)) throw new Error(`Remove the credential parameter “${key}” before creating a Smart Image.`);
    }
  }
}

async function encodeManifest(project, provenance) {
  const safeProject = JSON.parse(JSON.stringify(project));
  assertSafeProject(safeProject);
  const json = encoder.encode(JSON.stringify({
    format: SMART_IMAGE_FORMAT,
    version: SMART_IMAGE_VERSION,
    createdAt: new Date().toISOString(),
    ...provenance,
    project: safeProject,
  }));
  if (json.byteLength > SMART_IMAGE_LIMITS.maxProjectBytes) {
    throw new Error("This project is too large for a Smart Image. Download a project package instead.");
  }
  const compressed = await transform(json, "compress", SMART_IMAGE_LIMITS.maxEncodedBytes);
  const useCompression = compressed && compressed.byteLength < json.byteLength;
  const body = useCompression ? compressed : json;
  if (body.byteLength > SMART_IMAGE_LIMITS.maxEncodedBytes) {
    throw new Error("This project is too large for a Smart Image. Download a project package instead.");
  }
  const header = new Uint8Array(45);
  header.set(PAYLOAD_MAGIC, 0);
  header[8] = useCompression ? 1 : 0;
  new DataView(header.buffer).setUint32(9, json.byteLength);
  header.set(await sha256(json), 13);
  return concatBytes([header, body]);
}

async function decodeManifest(data) {
  if (data.byteLength < 45 || !equalBytes(data.subarray(0, 8), PAYLOAD_MAGIC)) {
    throw new Error("The embedded GISMap Online project has an unknown format.");
  }
  const compression = data[8];
  const expectedLength = new DataView(data.buffer, data.byteOffset, data.byteLength).getUint32(9);
  if (expectedLength > SMART_IMAGE_LIMITS.maxProjectBytes || data.byteLength - 45 > SMART_IMAGE_LIMITS.maxEncodedBytes) {
    throw new Error("The embedded GISMap Online project exceeds the safe size limit.");
  }
  let json = data.subarray(45);
  if (compression === 1) {
    json = await transform(json, "decompress", Math.min(expectedLength + 1, SMART_IMAGE_LIMITS.maxProjectBytes));
    if (!json) throw new Error("This browser cannot decompress the embedded GISMap Online project.");
  } else if (compression !== 0) {
    throw new Error("The embedded GISMap Online project uses an unsupported compression method.");
  }
  if (json.byteLength !== expectedLength) throw new Error("The embedded GISMap Online project is incomplete.");
  if (!equalBytes(await sha256(json), data.subarray(13, 45))) throw new Error("The embedded GISMap Online project failed its integrity check.");
  let manifest;
  try { manifest = JSON.parse(decoder.decode(json)); } catch (error) { throw new Error("The embedded GISMap Online project is not valid JSON.", { cause: error }); }
  if (manifest?.format !== SMART_IMAGE_FORMAT || manifest?.version !== SMART_IMAGE_VERSION) {
    throw new Error("This Smart Image version is not supported.");
  }
  assertSafeProject(manifest.project);
  return manifest;
}

/** Insert or replace GISMap Online's private ancillary PNG chunk immediately before IEND. */
export async function embedProjectInPng(png, project, provenance = null) {
  const bytes = new Uint8Array(png instanceof Blob ? await png.arrayBuffer() : png);
  if (bytes.byteLength > SMART_IMAGE_LIMITS.maxImageBytes) throw new Error("The source map image is too large.");
  const chunks = pngChunks(bytes).filter((chunk) => chunk.type !== SMART_IMAGE_CHUNK);
  const iend = chunks.findIndex((chunk) => chunk.type === "IEND");
  chunks.splice(iend, 0, { bytes: makeChunk(SMART_IMAGE_CHUNK, await encodeManifest(project, provenance)) });
  return new Blob([concatBytes([PNG_SIGNATURE, ...chunks.map((chunk) => chunk.bytes)])], { type: "image/png" });
}

/** Read and authenticate a GISMap Online project from an original Smart Image PNG. */
export async function readProjectFromPng(png) {
  if (png instanceof Blob && png.size > SMART_IMAGE_LIMITS.maxImageBytes) throw new Error("This PNG is too large to inspect safely.");
  const bytes = new Uint8Array(png instanceof Blob ? await png.arrayBuffer() : png);
  const chunk = pngChunks(bytes).findLast((item) => item.type === SMART_IMAGE_CHUNK);
  if (!chunk) throw new Error("This PNG is an ordinary image; it does not contain a GISMap Online project.");
  if (crc32(concatBytes([chunk.typeBytes, chunk.data])) !== chunk.storedCrc) throw new Error("The embedded GISMap Online project is damaged.");
  return withProvenance(await decodeManifest(chunk.data));
}

/** Who rendered the image, as its manifest claims. Informational, not a signature. */
function withProvenance(manifest) {
  const { generator = null, apiVersion = null, renderedBy, template = null, createdAt = null } = manifest;
  return { ...manifest, provenance: { generator, apiVersion, renderedBy: renderedBy === "app" ? "app" : "unknown", template, createdAt } };
}

function canvasBlob(canvas) {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("The browser could not encode the Smart Image.")), "image/png"));
}

/** Turn a clean map capture into a polished, ordinary PNG before adding project data. */
export async function composeSmartImage({ dataUrl, title, layerCount = 0, sources = [], width = 1600, height = 1000, skin = null }) {
  if (!globalThis.document || !globalThis.Image) throw new Error("Smart Image rendering requires a browser document.");
  const displayTitle = String(title || "Untitled project").trim().slice(0, 72);
  const countLabel = `${layerCount} ${layerCount === 1 ? "layer" : "layers"}`;
  const sourceLabel = sources.length ? sources.slice(0, 3).join(" · ") : "Interactive project included";
  const canvas = await brandedMapCanvas(
    { dataUrl, width, height },
    {
      title: displayTitle,
      subtitle: `Smart map image · ${new Date().toLocaleString()}`,
      footerText: `${countLabel} · ${sourceLabel}`,
      mapWidth: 1200,
      // Framed in the project's skin, like its PDFs and QR cards.
      palette: printPalette(skin),
    },
  );
  if (!canvas) throw new Error("The captured map image could not be prepared.");
  return canvasBlob(canvas);
}

