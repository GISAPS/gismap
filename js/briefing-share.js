import { normalizeBriefing } from "./briefing-document.js?v=0.70.4-sequence";

export const BRIEFING_SHARE_VERSION = 1;
export const BRIEFING_SHARE_LIMITS = Object.freeze({
  maxQrUrlLength: 2800,
  maxEncodedLength: 500_000,
  maxJsonBytes: 1_000_000,
});

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesToBase64Url(bytes) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64UrlToBytes(value) {
  const normalized = String(value || "").replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(normalized + "=".repeat((4 - normalized.length % 4) % 4));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function transform(bytes, format, mode) {
  const Constructor = mode === "compress" ? globalThis.CompressionStream : globalThis.DecompressionStream;
  if (!Constructor) return null;
  const stream = new Blob([bytes]).stream().pipeThrough(new Constructor(format));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Encode a normalized briefing for a URL fragment. Deflate is preferred, with a versioned JSON fallback. */
export async function encodeBriefing(briefing, { compress = true } = {}) {
  const json = encoder.encode(JSON.stringify(normalizeBriefing(briefing)));
  if (json.byteLength > BRIEFING_SHARE_LIMITS.maxJsonBytes) throw new Error("This briefing is too large for a link. Export a .gis file instead.");
  const compressed = compress ? await transform(json, "deflate-raw", "compress") : null;
  const value = compressed && compressed.byteLength < json.byteLength
    ? `b${BRIEFING_SHARE_VERSION}.${bytesToBase64Url(compressed)}`
    : `j${BRIEFING_SHARE_VERSION}.${bytesToBase64Url(json)}`;
  if (value.length > BRIEFING_SHARE_LIMITS.maxEncodedLength) throw new Error("This briefing is too large for a browser link. Export a .gis file instead.");
  return value;
}

/** Decode a versioned briefing fragment. Unknown versions and oversized documents fail closed. */
export async function decodeBriefing(value) {
  const encoded = String(value || "");
  if (encoded.length > BRIEFING_SHARE_LIMITS.maxEncodedLength) throw new Error("This briefing link is too large.");
  const match = /^([bj])(\d+)\.([A-Za-z0-9_-]+)$/.exec(encoded);
  if (!match || Number(match[2]) !== BRIEFING_SHARE_VERSION) throw new Error("This briefing link has an unsupported format or version.");
  let bytes = base64UrlToBytes(match[3]);
  if (match[1] === "b") {
    bytes = await transform(bytes, "deflate-raw", "decompress");
    if (!bytes) throw new Error("This browser cannot decompress the shared briefing.");
  }
  if (bytes.byteLength > BRIEFING_SHARE_LIMITS.maxJsonBytes) throw new Error("This briefing document is too large.");
  try {
    return normalizeBriefing(JSON.parse(decoder.decode(bytes)));
  } catch (error) {
    throw new Error("This briefing link does not contain valid JSON.", { cause: error });
  }
}

export async function createBriefingUrl({ baseUrl, briefing, qrSafe = false, compress = true }) {
  const url = new URL(baseUrl);
  url.hash = new URLSearchParams({ briefing: await encodeBriefing(briefing, { compress }) }).toString();
  if (qrSafe && url.href.length > BRIEFING_SHARE_LIMITS.maxQrUrlLength) {
    throw new Error("This briefing exceeds the QR-safe link limit. Copy a link or export a .gis file instead.");
  }
  return url.href;
}

export async function readBriefingHash(hash) {
  const value = new URLSearchParams(String(hash || "").replace(/^#/, "")).get("briefing");
  return value ? decodeBriefing(value) : null;
}
