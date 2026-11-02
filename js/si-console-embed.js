// Map side of the GISMap SI Query Console. SI owns the query and the tools; this
// draws what SI sends and reports map gestures back. Nothing here is persisted,
// and messages are accepted only from the framing SI page.
export const SI_PARENT_ORIGINS = ["https://gismap.si", "https://www.gismap.si"];
const MAX_FEATURES = 20000;
export const COLLECTIONS = new Set(["results", "draw", "extent", "context"]);
const ACTIONS = new Set(["data", "select", "fit", "zoom", "center", "tool", "basemap"]);
const isBbox = (value) => Array.isArray(value) && value.length === 4 && value.every(Number.isFinite);

export function allowedParents(hostname, referrer = "") {
  if (hostname !== "localhost" && hostname !== "127.0.0.1") return SI_PARENT_ORIGINS;
  try { return [...SI_PARENT_ORIGINS, new URL(referrer).origin]; } catch { return SI_PARENT_ORIGINS; }
}

export function validConsoleMessage(message) {
  if (message?.type !== "gismap.si.console" || message.version !== 1 || !ACTIONS.has(message.action)) return false;
  if (message.action === "data") {
    const { name, data } = message;
    return COLLECTIONS.has(name) && data?.type === "FeatureCollection" && Array.isArray(data.features)
      && data.features.length <= MAX_FEATURES && data.features.every((item) => item?.type === "Feature" && item.geometry && typeof item.geometry.type === "string");
  }
  if (message.action === "fit") return isBbox(message.bbox);
  if (message.action === "center") return Array.isArray(message.center) && message.center.length === 2 && message.center.every(Number.isFinite);
  if (message.action === "zoom") return message.direction === "in" || message.direction === "out";
  if (message.action === "tool") return typeof message.tool === "string";
  if (message.action === "basemap") return typeof message.id === "string";
  return true;
}
