// Errors from the public API carry a stable code and a hint written for the
// person or agent calling it, so a caller can decide what to do next without
// parsing English messages.

/** Every code the public API uses, with the hint an agent should act on. */
export const ERROR_CODES = Object.freeze({
  INVALID_URL: "Pass a complete https:// URL to a service, layer or file.",
  HTTPS_REQUIRED: "Use the https:// form of the URL; GISMap Online only loads remote data over HTTPS.",
  CREDENTIAL_IN_URL: "Remove the token, key or password from the URL. Only public services can be shared.",
  UNSUPPORTED_LAYER_TYPE: "Use one of the layer types in map.layerTypes in capabilities.json.",
  TOO_MANY_LAYERS: "A map holds at most 10 data layers. Remove one with layers.remove before adding another.",
  LAYER_LOAD_FAILED: "Check the URL in a browser with ?f=pjson appended. The service may be down, private or not a layer URL.",
  CORS_BLOCKED: "The publisher does not allow browser access to this service. Use another source, or download the data and add it as a file.",
  SERVICE_ERROR: "The service answered with an error. Check the URL, the layer number and any filter for typos.",
  FIELD_NOT_FOUND: "Use a field name exactly as the service lists it; sources.inspect(url) returns the fields.",
  INVALID_SPEC: "Fix the listed issues; the schema in capabilities.json describes every property.",
  NOT_READY: "Await gisMapOnline.ready before calling this.",
  NOT_FOUND: "Call layers.list() to see the layers on the map and their ids.",
  PRINT_LAYERS_NOT_LOADED: "One or more layers did not load before the timeout. Check describe().state.issues, report which layers failed, and export a partial map (allowPartial: true) only if the user agrees.",
  PRINT_RENDER_TIMEOUT: "The map did not reach an idle render in time. Increase timeoutMs or reduce the extent.",
  PRINT_CANVAS_TAINTED: "A layer or basemap blocked pixel export (CORS). Switch basemaps or report the source.",
  WEBGL_UNAVAILABLE: "The browser has no WebGL, so the map cannot render. In headless Chromium, launch with --use-gl=angle --use-angle=swiftshader (or --enable-unsafe-swiftshader).",
  UNKNOWN_TEMPLATE: "Use an id from print.templates().",
  SPEC_TOO_LONG: "Shorten the spec (fewer layers, no raw ArcGIS renderers) or use the compressed #map= form from mapSpec.createLink, or host the JSON and link to it with ?spec=.",
});

export class GisMapError extends Error {
  /**
   * @param {string} code one of ERROR_CODES
   * @param {string} message what went wrong, for people
   * @param {{ details?: object, hint?: string, cause?: unknown }} [options]
   */
  constructor(code, message, { details = undefined, hint = undefined, cause = undefined } = {}) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "GisMapError";
    this.code = ERROR_CODES[code] ? code : "SERVICE_ERROR";
    this.hint = hint || ERROR_CODES[this.code];
    if (details !== undefined) this.details = details;
  }

  toJSON() {
    return { name: this.name, code: this.code, message: this.message, hint: this.hint, ...(this.details ? { details: this.details } : {}) };
  }
}

const PATTERNS = [
  [/must use HTTPS|https:\/\/ form/i, "HTTPS_REQUIRED"],
  [/credential parameter|username or password/i, "CREDENTIAL_IN_URL"],
  [/invalid URL|is required|not a valid URL/i, "INVALID_URL"],
  [/unsupported (shared )?layer type/i, "UNSUPPORTED_LAYER_TYPE"],
  [/at most \d+ (data )?layers/i, "TOO_MANY_LAYERS"],
  [/failed to fetch|networkerror|cors|cross-origin|could not be read/i, "CORS_BLOCKED"],
  [/field .* (does not exist|not found)|unknown field/i, "FIELD_NOT_FOUND"],
];

/** The same error as a GisMapError, classifying plain errors from the app's own messages. */
export function toGisMapError(error, fallbackCode = "SERVICE_ERROR", details = undefined) {
  if (error instanceof GisMapError) return error;
  const message = String(error?.message || error || "Something went wrong.");
  const code = PATTERNS.find(([pattern]) => pattern.test(message))?.[1] || fallbackCode;
  return new GisMapError(code, message, { details, cause: error });
}

/**
 * A failure while loading a URL that already passed GIS Map's own checks: the
 * server's wording ("Invalid URL" for a missing service) does not make it an
 * input error, so it is LAYER_LOAD_FAILED unless the browser blocked the request.
 */
export function layerLoadError(error, details = undefined) {
  const classified = toGisMapError(error, "LAYER_LOAD_FAILED", details);
  if (["CORS_BLOCKED", "TOO_MANY_LAYERS", "UNSUPPORTED_LAYER_TYPE", "CREDENTIAL_IN_URL", "HTTPS_REQUIRED"].includes(classified.code)) return classified;
  return new GisMapError("LAYER_LOAD_FAILED", classified.message, { details, cause: error });
}
