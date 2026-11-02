/**
 * Small, deterministic helpers for turning a normal GISMap Online share URL into a
 * website embed. The fragment stays intact: it is the authoritative,
 * self-contained map, briefing, or tour payload.
 */
const EMBED_KINDS = new Set(["map", "briefing", "tour"]);

export function createEmbedUrl(sharedUrl, { kind = "map" } = {}) {
  const url = new URL(sharedUrl);
  url.searchParams.set("embed", "1");
  url.searchParams.set("embedKind", EMBED_KINDS.has(kind) ? kind : "map");
  return url.href;
}

export function createEmbedIframe(sharedUrl, { title = "GISMap Online map", kind = "map", height = 600 } = {}) {
  const url = createEmbedUrl(sharedUrl, { kind });
  const escape = (value) => String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  const safeHeight = Math.min(1200, Math.max(280, Number(height) || 600));
  return `<iframe src="${escape(url)}" title="${escape(title || "GISMap Online map")}" loading="lazy" allow="fullscreen; geolocation" allowfullscreen style="width:100%;height:${safeHeight}px;border:0"></iframe>`;
}
