// The "Made with" credit on embeds and shared-link views. It sits in the map's
// attribution row, so it never covers data, and links people to the place where
// they can make their own map. A renamed installation shows its own identity only.
import { BRAND } from "./brand.js";

export const MADE_WITH_URL = "https://gismap.online/ai?ref=embed";
export const MADE_WITH_TEXT = "Made with GISMap Online · Make your own with AI";
const DEFAULT_APPLICATION_NAME = BRAND.name;
const SHARED_HASH = /(?:^#|&)(?:map|briefing|tour|fieldTask|fieldNote)=/;
const SHARED_QUERY = ["embed", "layer", "spec", "briefing", "tour", "example"];

/** Whether this address is an embed or a shared link on the original installation. */
export function showsMadeWith({ search = "", hash = "", applicationName = DEFAULT_APPLICATION_NAME } = {}) {
  if (applicationName !== DEFAULT_APPLICATION_NAME) return false;
  const params = new URLSearchParams(search);
  return SHARED_HASH.test(hash) || SHARED_QUERY.some((key) => params.has(key));
}

export const madeWithForPage = () => showsMadeWith({
  search: globalThis.location?.search,
  hash: globalThis.location?.hash,
  applicationName: globalThis.GISMAP_INSTALLATION?.applicationName ?? DEFAULT_APPLICATION_NAME,
});

export const madeWithHtml = () => `<a class="gismap-made-with" href="${MADE_WITH_URL}" target="_blank" rel="noopener">${MADE_WITH_TEXT}</a>`;
