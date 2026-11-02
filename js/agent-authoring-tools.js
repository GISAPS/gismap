// Shared, deliberately small initial agent command surface. These tools delegate
// to the same public implementations as the browser API; they do not maintain
// another project model. Mutating/participant operations are not registered here
// until their permissions and reversible state transitions are defined.
import { GisMapError } from "./gismap-errors.js?v=0.54.0-print";

export const AUTHORING_TOOL_DEFINITIONS = Object.freeze([
  {
    id: "source.inspect", displayName: "Inspect source",
    description: "Read a public ArcGIS or GeoJSON source's metadata without adding it to the map.",
    inputSchema: { type: "object", additionalProperties: false, required: ["url"], properties: { url: { type: "string", minLength: 1, pattern: "\\S" }, sample: { type: "boolean" } } },
  },
  {
    id: "layer.list", displayName: "List map layers",
    description: "Read the layers in the current map.",
    inputSchema: { type: "object", additionalProperties: false, properties: {} },
  },
  {
    id: "map.camera.inspect", displayName: "Inspect map camera",
    description: "Read the current map camera.",
    inputSchema: { type: "object", additionalProperties: false, properties: {} },
  },
  {
    id: "briefing.inspect", displayName: "Inspect briefing",
    description: "Read the current briefing document without changing it.",
    inputSchema: { type: "object", additionalProperties: false, properties: {} },
  },
  {
    id: "briefing.validate", displayName: "Validate briefing",
    description: "Statically validate a briefing document; this does not verify the rendered map.",
    inputSchema: { type: "object", additionalProperties: false, required: ["document"], properties: { document: { type: "object" } } },
  },
]);

export function registerAuthoringTools(registry, { sources, briefing, layers, camera }) {
  const runners = {
    "source.inspect": ({ url, sample }) => sources.inspect(url, { sample: sample !== false }),
    "layer.list": () => layers.list(),
    "map.camera.inspect": () => camera.get(),
    "briefing.inspect": () => briefing.get(),
    "briefing.validate": ({ document }) => briefing.validate(document),
  };
  for (const definition of AUTHORING_TOOL_DEFINITIONS) {
    registry.register({
      ...definition,
      validate(input) {
        if (!input || typeof input !== "object" || Array.isArray(input)) throw new GisMapError("INVALID_SPEC", "Command input must be an object.");
        const { properties, required = [] } = definition.inputSchema;
        for (const key of Object.keys(input)) if (!Object.hasOwn(properties, key)) throw new GisMapError("INVALID_SPEC", `Unknown input property: ${key}.`);
        for (const key of required) if (!Object.hasOwn(input, key)) throw new GisMapError("INVALID_SPEC", `Missing required input: ${key}.`);
        for (const [key, value] of Object.entries(input)) {
          const type = properties[key].type;
          if (typeof value !== type || value === null || Array.isArray(value) || (key === "url" && !value.trim())) throw new GisMapError("INVALID_SPEC", `Invalid ${key}: expected ${type}.`);
        }
        return true;
      },
      execute: runners[definition.id],
    });
  }
}
