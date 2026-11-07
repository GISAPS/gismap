import {
  BRIEFING_SCHEMA_VERSION,
  MAX_SLIDES,
  SLIDE_TEMPLATES,
  STAT_TYPES,
  addSlide,
  computeStat,
  createSlide,
  duplicateSlide,
  matchesFilter,
  moveSlide,
  normalizeBriefing,
  normalizeFilter,
  removeSlide,
  safeUrl,
  updateBlock,
  updateSlide,
  validateBriefing,
} from "./briefing-document.js?v=0.61.0-briefing-player";
import {
  BRIEFING_SHARE_LIMITS,
  BRIEFING_SHARE_VERSION,
  createBriefingUrl,
  decodeBriefing,
  encodeBriefing,
  readBriefingHash,
} from "./briefing-share.js?v=0.60.0-media1";
import { SENTINEL_LABEL, detectSentinels, inspectSource } from "./source-inspector.js?v=0.70.0-ground";
import { BREAK_METHODS, RAMPS, RENDERER_TYPES, chooseBreakMethod, chooseStyleField, closestField, compileRenderer, computeBreaks, describeValues, rampColors, resolveRendererSpec, suggestRenderers, validateRendererSpec } from "./renderer-spec.js?v=0.29.0";
import { ERROR_CODES, GisMapError, toGisMapError } from "./gismap-errors.js?v=0.54.0-print";
import { LAYER_TOOL_DEFINITIONS, checkToolInput } from "./layer-tools.js?v=0.29.0";
import { MAP_SPEC_JSON_LIMIT, MAP_SPEC_VERSION, createMapSpecLink, decodeMapSpec, encodeMapSpec, prepareMapVerification, mapSpecFromShareParameters, rendererSpecFromParameters, validateMapSpec } from "./map-spec.js?v=0.70.0-ground";
import { SHARE_BASEMAPS, SHARE_LAYER_TYPES, SHARE_LIMITS } from "./share.js?v=0.70.0-ground";
import {
  SMART_IMAGE_CHUNK,
  SMART_IMAGE_FORMAT,
  SMART_IMAGE_LIMITS,
  SMART_IMAGE_VERSION,
  embedProjectInPng,
  readProjectFromPng,
} from "./smart-image.js?v=0.70.0-ground";

import { AUTHORING_TOOL_DEFINITIONS } from "./agent-authoring-tools.js?v=0.53.0";
import { APP_VERSION } from "./version.js?v=0.54.0-print";
export const GISMAP_CORE_VERSION = APP_VERSION;

export const capabilities = Object.freeze({
  apiVersion: GISMAP_CORE_VERSION,
  briefingSchemaVersion: BRIEFING_SCHEMA_VERSION,
  briefingTemplateGeneration: { scope: "in-page", stability: "experimental", method: "briefing.generateTemplate", templates: ["filter-series", "timeline", "grid-atlas", "spatial-3d-chart"], maxQueriedFeatures: 500, completeSourceGuaranteed: false },
  briefingSchema: "https://gismap.online/schemas/briefing-v1.schema.json",
  execution: "client",
  authoringCommands: AUTHORING_TOOL_DEFINITIONS,
  authoringCommandSchema: "https://gismap.online/schemas/agent-command-v1.schema.json",
  sourceTypes: ["arcgis-rest", "geojson", "loaded-records"],
  outputs: ["briefing-json", "briefing-link", "briefing-pdf", "briefing-qr-png", "gis-project", "smart-image-png"],
  filters: ["eq", "neq", "gt", "gte", "lt", "lte", "in", "not_in", "contains", "starts_with", "is_null", "is_not_null", "and", "or", "not", "feature_ids"],
  limits: { maxSlides: MAX_SLIDES, maxLayers: SHARE_LIMITS.maxLayers, readableMapSpecCharacters: MAP_SPEC_JSON_LIMIT, ...BRIEFING_SHARE_LIMITS },
  layerTypes: [...SHARE_LAYER_TYPES],
  basemaps: [...SHARE_BASEMAPS],
  rendererTypes: [...RENDERER_TYPES],
  breakMethods: [...BREAK_METHODS],
  ramps: Object.keys(RAMPS),
  errorCodes: Object.keys(ERROR_CODES),
  unavailableWithoutHost: ["hosted-links", "private-access-control", "background-jobs", "webhooks", "scheduled-runs"],
});

/** Return both the normalized document and actionable validation issues. */
export function validateBriefingDocument(value, options = {}) {
  const document = normalizeBriefing(value);
  const issues = validateBriefing(document, options);
  return { valid: !issues.some((issue) => issue.level === "error"), document, issues };
}

export const briefing = Object.freeze({
  schemaVersion: BRIEFING_SCHEMA_VERSION,
  templates: SLIDE_TEMPLATES,
  statTypes: STAT_TYPES,
  create: normalizeBriefing,
  migrate: normalizeBriefing,
  validate: validateBriefingDocument,
  createSlide,
  addSlide,
  updateSlide,
  moveSlide,
  duplicateSlide,
  removeSlide,
  updateBlock,
  encode: encodeBriefing,
  decode: decodeBriefing,
  createLink: createBriefingUrl,
  readHash: readBriefingHash,
});

export const queries = Object.freeze({
  normalize: normalizeFilter,
  matches: matchesFilter,
  statistic: computeStat,
});

export const sources = Object.freeze({ inspect: inspectSource, detectSentinels, sentinelLabel: SENTINEL_LABEL });

/** RendererSpec helpers: validate a style against a layer's fields, compute class breaks, compile to ArcGIS JSON. */
export const renderers = Object.freeze({
  types: RENDERER_TYPES,
  methods: BREAK_METHODS,
  ramps: RAMPS,
  validate: validateRendererSpec,
  computeBreaks,
  compile: compileRenderer,
  rampColors,
  closestField,
  suggest: suggestRenderers,
  resolve: resolveRendererSpec,
  describeValues,
  chooseMethod: chooseBreakMethod,
  chooseField: chooseStyleField,
});

/**
 * Whole maps as one JSON object (schemas/map-v1.schema.json). createLink returns
 * { url, payload, qr }; { compress: false } gives a readable #map=json: link.
 */
export const mapSpec = Object.freeze({
  version: MAP_SPEC_VERSION,
  jsonLimit: MAP_SPEC_JSON_LIMIT,
  validate: validateMapSpec,
  prepareVerification: prepareMapVerification,
  encode: encodeMapSpec,
  decode: decodeMapSpec,
  createLink: createMapSpecLink,
  fromShareParameters: mapSpecFromShareParameters,
  rendererFromParameters: rendererSpecFromParameters,
});

export const errors = Object.freeze({ codes: ERROR_CODES, GisMapError, from: toGisMapError });

/** The application tools for layers, with their input schemas (registered by the app). */
export const tools = Object.freeze({ definitions: LAYER_TOOL_DEFINITIONS, checkInput: checkToolInput });

export const smartImages = Object.freeze({
  format: SMART_IMAGE_FORMAT,
  version: SMART_IMAGE_VERSION,
  chunk: SMART_IMAGE_CHUNK,
  limits: SMART_IMAGE_LIMITS,
  // The public embed never stamps provenance: only the app's own export does.
  embed: (png, project) => embedProjectInPng(png, project),
  read: readProjectFromPng,
});

export const utilities = Object.freeze({ safeUrl });

export default Object.freeze({ version: GISMAP_CORE_VERSION, capabilities, briefing, mapSpec, queries, sources, renderers, errors, tools, smartImages, utilities });

export {
  validateMapSpec,
  encodeMapSpec,
  decodeMapSpec,
  createMapSpecLink,
  ERROR_CODES,
  GisMapError,
  validateRendererSpec,
  compileRenderer,
  computeBreaks,
  suggestRenderers,
  resolveRendererSpec,
  detectSentinels,
  BRIEFING_SCHEMA_VERSION,
  BRIEFING_SHARE_LIMITS,
  BRIEFING_SHARE_VERSION,
  MAX_SLIDES,
  SLIDE_TEMPLATES,
  STAT_TYPES,
  addSlide,
  computeStat,
  createBriefingUrl,
  createSlide,
  decodeBriefing,
  duplicateSlide,
  encodeBriefing,
  inspectSource,
  embedProjectInPng,
  matchesFilter,
  moveSlide,
  normalizeBriefing,
  normalizeFilter,
  readBriefingHash,
  readProjectFromPng,
  removeSlide,
  safeUrl,
  updateBlock,
  updateSlide,
  validateBriefing,
};
