// The enums and limits every published contract shares. The app's own constants
// are the single source: map-v1 and renderer-v1 get their enum lists from here,
// and the map block of api/capabilities.json is generated. Pure (no Node APIs),
// so scripts/build-examples.mjs writes the files and scripts/check-contracts.mjs
// can check them. Hand-written parts of those files are left alone.
import { SPATIAL_OPERATION_IDS } from "../js/spatial-analysis.js";
import { generateSkillMarkdown } from "./agent-docs.mjs";
import { ERROR_CODES } from "../js/gismap-errors.js";
import { MAP_SPEC_JSON_LIMIT, QR_SAFE_LENGTH } from "../js/map-share.js";
import { BREAK_METHODS, RAMPS, RENDERER_TYPES } from "../js/renderer-spec.js";
import { SHARE_BASEMAPS, SHARE_LAYER_TYPES, SHARE_LIMITS, SHARE_STYLE_NAMES } from "../js/share.js";
import { INTERFACE_SKINS } from "../js/skin-catalog.js";

export const CONTRACT_ENUMS = Object.freeze({
  layerTypes: [...SHARE_LAYER_TYPES],
  renderers: [...RENDERER_TYPES],
  styles: [...SHARE_STYLE_NAMES],
  breakMethods: [...BREAK_METHODS],
  basemaps: [...SHARE_BASEMAPS],
  ramps: Object.keys(RAMPS),
  skins: INTERFACE_SKINS.map(({ id }) => id),
  limits: { maxLayers: SHARE_LIMITS.maxLayers, readableSpecChars: MAP_SPEC_JSON_LIMIT, qrSafeUrlLength: QR_SAFE_LENGTH },
  errors: Object.keys(ERROR_CODES),
});

const enumLine = (values) => `"enum": [${values.map((value) => JSON.stringify(value)).join(", ")}]`;

/** Replaces the enum on the line after `"<key>": {` or on the `"<key>": {` line itself; the schemas stay hand-formatted. */
function replaceEnum(text, key, values) {
  const pattern = new RegExp(`("${key}": \\{(?:\\s*"type": "string",)?\\s*)"enum": \\[[^\\]]*\\]`);
  if (!pattern.test(text)) throw new Error(`No "${key}" enum to generate in a schema.`);
  return text.replace(pattern, `$1${enumLine(values)}`);
}

export function generateMapSchema(text) {
  return ["basemap", "skin", "type", "operation"].reduce((schema, key) => {
    const values = { basemap: CONTRACT_ENUMS.basemaps, skin: CONTRACT_ENUMS.skins, type: CONTRACT_ENUMS.layerTypes, operation: SPATIAL_OPERATION_IDS }[key];
    return replaceEnum(schema, key, values);
  }, text);
}

export function generateRendererSchema(text) {
  return replaceEnum(replaceEnum(text, "method", CONTRACT_ENUMS.breakMethods), "ramp", CONTRACT_ENUMS.ramps);
}

export function generateCapabilities(text) {
  const capabilities = JSON.parse(text);
  const { layerTypes, renderers, styles, breakMethods, basemaps, ramps, skins, limits, errors } = CONTRACT_ENUMS;
  const generated = {
    ...capabilities,
    errorCodes: { ...ERROR_CODES },
    layerTypes, rendererTypes: renderers, breakMethods, ramps, basemaps,
    map: { specSchema: "/schemas/map-v1.schema.json", layerTypes, renderers, styles, breakMethods, basemaps, ramps, skins, limits, errors, analysisOperations: [...SPATIAL_OPERATION_IDS] },
  };
  return `${JSON.stringify(generated, null, 2)}\n`;
}

/** Repository files whose contract parts are generated, with the function that does it. */
export const CONTRACT_FILES = Object.freeze({
  "schemas/map-v1.schema.json": generateMapSchema,
  "schemas/renderer-v1.schema.json": generateRendererSchema,
  "api/capabilities.json": generateCapabilities,
  "skills/gismap/SKILL.md": generateSkillMarkdown,
});
