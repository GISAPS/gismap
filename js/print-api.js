// gisMapOnline.print: the Print Editor for agents and scripts. Rendering stays in
// the UI's template path, so a button and an API call draw the same page; this
// module only resolves options, waits for the map and refuses partial exports.
import { GisMapError } from "./gismap-errors.js?v=0.54.0-print";

export const PRINT_LIMITS = Object.freeze({ minDpi: 48, maxDpi: 300, minTimeoutMs: 1000, maxTimeoutMs: 300000, defaultTimeoutMs: 30000 });
const COLOR = "^#[0-9a-fA-F]{6}$";

/** Input schema for the print tools; also the list of accepted option names. */
export const PRINT_OPTIONS_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  properties: {
    template: { type: "string", minLength: 1 },
    title: { type: "string", maxLength: 120 },
    subtitle: { type: "string", maxLength: 160 },
    description: { type: "string", maxLength: 900 },
    marginIn: { type: "number", minimum: 0, maximum: 3 },
    marginColor: { type: "string", pattern: COLOR },
    borderPt: { type: "number", minimum: 0, maximum: 24 },
    borderColor: { type: "string", pattern: COLOR },
    showQr: { type: "boolean" },
    showNorthArrow: { type: "boolean" },
    showScaleBar: { type: "boolean" },
    clickableLinks: { type: "boolean" },
    pages: { enum: ["current-view", "bookmarks"] },
    dpi: { type: "number", minimum: PRINT_LIMITS.minDpi, maximum: PRINT_LIMITS.maxDpi },
    waitFor: { enum: ["layers", "idle"] },
    timeoutMs: { type: "number", minimum: PRINT_LIMITS.minTimeoutMs, maximum: PRINT_LIMITS.maxTimeoutMs },
    allowPartial: { type: "boolean" },
  },
});

export function templateInfo({ id, label, description, page, supports }) {
  return { id, name: label, description, widthIn: page.width, heightIn: page.height, supports: { ...supports } };
}

/** Merges options over defaults, rejecting anything the Print Editor could not draw. */
export function resolvePrintOptions(input = {}, defaults, templates) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new GisMapError("INVALID_SPEC", "Print options must be an object.");
  const { properties } = PRINT_OPTIONS_SCHEMA;
  for (const [key, value] of Object.entries(input)) {
    const rule = properties[key];
    if (!rule) throw new GisMapError("INVALID_SPEC", `Unknown print option: ${key}.`);
    if (value === undefined) continue;
    const valid = rule.enum ? rule.enum.includes(value)
      : typeof value === rule.type && (rule.type !== "number" || (Number.isFinite(value) && value >= rule.minimum && value <= rule.maximum))
        && (!rule.pattern || new RegExp(rule.pattern).test(value)) && (rule.maxLength === undefined || value.length <= rule.maxLength);
    if (!valid) throw new GisMapError("INVALID_SPEC", `Invalid print option: ${key}.`);
  }
  const defined = Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
  const options = { ...defaults, ...defined };
  if (!templates.some((template) => template.id === options.template)) {
    throw new GisMapError("UNKNOWN_TEMPLATE", `Unknown print template: ${options.template}.`, { details: { templates: templates.map((template) => template.id) } });
  }
  return options;
}

/** The Print Editor's frame settings for a set of resolved options. */
export function printFrame(options) {
  return {
    margin: options.marginIn,
    marginColor: options.marginColor,
    borderWidth: options.borderPt,
    borderColor: options.borderColor,
    showQr: options.showQr,
    showNorth: options.showNorthArrow,
    showScale: options.showScaleBar,
    links: options.clickableLinks,
  };
}

export function hasWebgl(documentRef = globalThis.document) {
  try {
    const canvas = documentRef.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch { return false; }
}

export function webglIssue() {
  const error = new GisMapError("WEBGL_UNAVAILABLE", "This browser has no WebGL, so the map cannot render.");
  return { level: "error", code: error.code, message: error.message, hint: error.hint };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * `host` is the running app: webgl(), ready(), layers(), idle(), defaults(),
 * render(kind, options), open(options), isOpen(), read(blob).
 */
export function createPrintApi({ templates, host, now = Date.now, wait = sleep, poll = 100 }) {
  let chosen = {};
  const baseOptions = () => ({
    template: "branded", pages: "current-view", dpi: null, waitFor: "idle", timeoutMs: PRINT_LIMITS.defaultTimeoutMs, allowPartial: false,
    ...host.defaults(), ...chosen,
  });
  const resolve = (input) => resolvePrintOptions(input, baseOptions(), templates);
  const info = (id) => templateInfo(templates.find((template) => template.id === id));

  /** Waits for the layers and the render, or throws: never a blank or partial page. */
  async function settle(options) {
    if (!host.webgl()) throw new GisMapError("WEBGL_UNAVAILABLE", "This browser has no WebGL, so the map cannot render.");
    const deadline = now() + options.timeoutMs;
    const timedOut = Symbol("timeout");
    const started = await Promise.race([host.ready().then(() => true), wait(options.timeoutMs).then(() => timedOut)]);
    if (started === timedOut) throw new GisMapError("PRINT_RENDER_TIMEOUT", "The map did not start before the timeout.");
    const pendingLayers = () => host.layers().filter((layer) => layer.visible !== false && layer.loadStatus === "loading");
    while (pendingLayers().length && now() < deadline) await wait(poll);
    const missing = host.layers().filter((layer) => layer.visible !== false && layer.loadStatus !== "loaded");
    const warnings = [];
    if (missing.length) {
      const titles = missing.map((layer) => layer.title || layer.id);
      if (!options.allowPartial) throw new GisMapError("PRINT_LAYERS_NOT_LOADED", `${titles.length} layer${titles.length === 1 ? "" : "s"} did not load: ${titles.join(", ")}.`, { details: { layers: titles } });
      warnings.push(`Partial export: ${titles.join(", ")} did not load.`);
    }
    if (options.waitFor === "idle") {
      let calm = 0;
      while (calm < 2) {
        calm = host.idle() ? calm + 1 : 0;
        if (calm === 2) break;
        if (now() >= deadline) throw new GisMapError("PRINT_RENDER_TIMEOUT", "The map did not reach an idle render before the timeout.");
        await wait(poll);
      }
    }
    return warnings;
  }

  async function render(kind, input) {
    const options = resolve(input);
    if (kind === "smart-image" && options.pages === "bookmarks") throw new GisMapError("INVALID_SPEC", "A Smart Image holds one page. Use pages: \"current-view\".");
    const warnings = await settle(options);
    let output;
    try {
      output = await host.render(kind, { ...options, frame: printFrame(options) });
    } catch (error) {
      if (error?.name === "SecurityError" || /tainted/i.test(error?.message || "")) throw new GisMapError("PRINT_CANVAS_TAINTED", "A layer or basemap blocked pixel export.", { cause: error });
      throw error;
    }
    if (options.showQr && !output.share?.qr && kind !== "preview") warnings.push("No QR code on the page: the live-map link needs a public web layer or a text box, and must fit a QR code.");
    return { ...output, template: info(options.template), options, warnings };
  }

  return Object.freeze({
    templates: () => templates.map(templateInfo),
    getOptions: () => resolve({}),
    setOptions(input) {
      resolve(input);
      chosen = { ...chosen, ...Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) };
      const options = resolve({});
      if (host.isOpen()) host.open({ ...options, frame: printFrame(options) });
      return options;
    },
    preview: async (input) => (await render("preview", input)).blob,
    exportPdf: (input) => render("pdf", input),
    async exportSmartImage(input) {
      const result = await render("smart-image", input);
      return { ...result, manifest: await host.read(result.blob) };
    },
    open(input) {
      const options = resolve(input);
      host.open({ ...options, frame: printFrame(options) });
    },
  });
}

const PRINT_TOOLS = [
  ["print.templates", "List print templates", "Read the Print Editor's page templates and sizes.", { type: "object", additionalProperties: false, properties: {} }, (print) => print.templates()],
  ["print.options", "Read print options", "Read the options the next print export will use.", { type: "object", additionalProperties: false, properties: {} }, (print) => print.getOptions()],
  ["print.exportPdf", "Export map PDF", "Render the map as a branded PDF and return it without downloading.", PRINT_OPTIONS_SCHEMA, (print, input) => print.exportPdf(input)],
  ["print.exportSmartImage", "Export Smart Image", "Render the map as a branded Smart Image PNG and return it without downloading.", PRINT_OPTIONS_SCHEMA, (print, input) => print.exportSmartImage(input)],
];

export function registerPrintTools(registry, print) {
  for (const [id, displayName, description, inputSchema, run] of PRINT_TOOLS) {
    registry.register({ id, displayName, description, inputSchema, validate: () => true, execute: (input) => run(print, input || {}) });
  }
}
