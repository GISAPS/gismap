// The Map assistant: a chat with the AI model the user configured (Ollama, OpenAI,
// Anthropic or an OpenAI-compatible endpoint) that can build maps, briefings, tours
// and field tasks through tools. GISMap Online calls the model itself, so the
// model's instructions are simply the system message sent with every turn: written
// here from the app's own contracts and the live map state. Nothing is registered
// with the provider. Pure functions apart from the tool handlers, which call the
// in-page API (globalThis.gisMapOnline) and a few app hooks passed in as `host`.

import { describeArcgisLayer, describeFields, isArcgisLayerUrl, summarizeArcgisField } from "./layer-insight.js?v=0.50.0";
import { INTERFACE_SKINS } from "./skin-catalog.js?v=0.57.0-skins2";
import { DISPLAY_SETTINGS, guideOutline, searchGuide, validateDisplaySetting } from "./app-guide.js?v=0.65.0-paths";

const MAX_RESULT = 6000;
const STEP_LIMIT = 10;
const BASEMAPS = ["topo-3d", "navigation-3d", "navigation-dark-3d", "osm-3d", "gray-3d", "dark-gray-3d", "streets-3d", "streets-dark-3d", "topo-vector", "streets-vector", "navigation", "gray-vector", "dark-gray-vector", "osm", "satellite", "hybrid", "skin"];
const RELATIONS = ["intersects", "contains", "crosses", "envelope-intersects", "index-intersects", "overlaps", "touches", "within", "disjoint", "relation"];

const layerRef = { type: "string", description: "The layer's id (from get_map_state), service URL or title." };
const renderer = {
  type: "object",
  description: "A style. { \"type\": \"auto\", \"field\": \"FIELD\" } lets the app choose. Otherwise: { \"type\": \"choropleth\", \"field\", \"method\": \"auto\", \"ramp\": \"greens\", \"exclude\": [-1] }, { \"type\": \"graduated-symbols\", \"field\" }, { \"type\": \"categories\", \"field\" }, { \"type\": \"heatmap\" }, { \"type\": \"simple\", \"color\": \"#1b7f6a\" }. Field names must match the layer exactly.",
};

/** The tools, as JSON Schema function definitions (the same shape every provider takes). */
export const ASSISTANT_TOOLS = Object.freeze([
  { name: "get_map_state", description: "What is on the map now: layers (with their id, URL, style, filter and fields), basemap, camera, briefing and tour. Call it before changing existing layers.", parameters: { type: "object", properties: {} } },
  { name: "inspect_source", description: "Read a public data source's metadata before using it: fields (exact names and types), geometry type, feature count, codes that mean no data (sentinels), scale range and last edit date. For a service root it lists its layers.", parameters: { type: "object", required: ["url"], properties: { url: { type: "string", description: "HTTPS URL of an ArcGIS REST layer or service, GeoJSON, WMS, WFS or KML." } } } },
  { name: "describe_layer", description: "Everything known about a layer on the map: its service's description, summary, credits, licence, tags, last edit date, feature count, time field, and its schema (every field with type, alias, description and coded values). Use it to answer questions about the data.", parameters: { type: "object", required: ["layer"], properties: { layer: layerRef } } },
  { name: "summarize_field", description: "Summarize one field's values in a layer, computed by the service over all features: for numbers and dates min, max, mean and spread; for text and codes the most common values with counts. Use it to interpret what a field holds.", parameters: { type: "object", required: ["layer", "field"], properties: { layer: layerRef, field: { type: "string" }, where: { type: "string", description: "Optional SQL filter." } } } },
  { name: "search_datasets", description: "Search GISMap Online's curated public datasets by topic (wildfires, earthquakes, hurricanes, air quality, census…). Returns titles and layer URLs.", parameters: { type: "object", required: ["query"], properties: { query: { type: "string" } } } },
  { name: "add_layer", description: "Add a public layer to the map, optionally filtered and styled, and zoom to it.", parameters: { type: "object", required: ["url"], properties: { url: { type: "string" }, title: { type: "string" }, where: { type: "string", description: "Read-only SQL filter on the layer's fields, such as \"POP > 1000\"." }, renderer, opacity: { type: "number", minimum: 0, maximum: 1 } } } },
  { name: "update_layer", description: "Change a layer on the map: title, filter, style, opacity or visibility.", parameters: { type: "object", required: ["layer"], properties: { layer: layerRef, title: { type: "string" }, where: { type: ["string", "null"], description: "SQL filter; null clears it." }, renderer, opacity: { type: "number", minimum: 0, maximum: 1 }, visible: { type: "boolean" } } } },
  { name: "remove_layer", description: "Remove a layer from the map.", parameters: { type: "object", required: ["layer"], properties: { layer: layerRef } } },
  { name: "query_features", description: "Read features from a layer on the map: object IDs, chosen fields and a point (longitude, latitude) for each, filtered and sorted. Use it for real names, places and IDs for tours, briefing feature slides and field tasks, and for top-N questions, instead of guessing.", parameters: { type: "object", required: ["layer"], properties: { layer: layerRef, where: { type: "string", description: "SQL filter, such as \"STATE = 'CA'\"." }, fields: { type: "array", items: { type: "string" }, description: "Fields to return (exact names); the layer's display field is added." }, orderBy: { type: "string", description: "Such as \"CORN_SALES_IN_DOLLARS DESC\"." }, limit: { type: "integer", minimum: 1, maximum: 25 } } } },
  { name: "suggest_styles", description: "Rank the styles that suit one of a layer's fields, computed from its values. Apply one with update_layer and its pinnedSpec.", parameters: { type: "object", required: ["layer"], properties: { layer: layerRef, field: { type: "string" } } } },
  { name: "set_view", description: "Move the map: to a layer's data, or to a place by longitude and latitude.", parameters: { type: "object", properties: { layer: layerRef, longitude: { type: "number" }, latitude: { type: "number" }, zoom: { type: "number", description: "About 4 = a country, 10 = a city, 16 = a street." } } } },
  { name: "set_basemap", description: "Change the background map.", parameters: { type: "object", required: ["basemap"], properties: { basemap: { enum: BASEMAPS } } } },
  {
    name: "create_instant_dashboard",
    description: "Create a linked Instant Dashboard for one loaded feature layer. It applies a matching interface skin and basemap, adds a data-aware chart panel, and makes chart marks filter and select the corresponding map data. Inspect the layer first; use the Skin basemap when the selected skin should also colour the basemap.",
    parameters: { type: "object", required: ["layer"], properties: {
      layer: layerRef,
      title: { type: "string", description: "Short dashboard and chart title." },
      skin: { enum: INTERFACE_SKINS.map(({ id }) => id), description: "Choose a preset skin that supports the subject and audience." },
      basemap: { enum: BASEMAPS, description: "Use skin for a skin-coloured MapLibre basemap, otherwise choose a readable geographic basemap." },
    } },
  },
  {
    name: "load_map",
    description: "Open a whole map from one map-v1 spec: layers with styles and filters, basemap, camera, and optionally a briefing. Use it to build a complete map in one step. replace (default true) removes the current layers first.",
    parameters: { type: "object", required: ["spec"], properties: { spec: { type: "object", description: "{ \"version\": 1, \"title\", \"basemap\", \"layers\": [{ \"url\", \"title\", \"where\", \"renderer\", \"opacity\" }], \"camera\": { \"fit\": \"layers\" }, \"briefing\": { … } }" }, replace: { type: "boolean" } } },
  },
  {
    name: "create_briefing",
    description: "Make a briefing (slides that present the map) from a briefing document, and optionally present it. Slides: { \"template\": \"title\" | \"map-narrative\" | \"feature\" | \"key-numbers\" | \"actions\", \"title\", \"subtitle\", \"camera\": { \"center\": [lon, lat], \"zoom\" } or for a feature slide \"featureId\" (the feature's object ID as a string) with \"fit\": \"feature\", \"blocks\": [{ \"type\": \"text\", \"markdown\" } | { \"type\": \"facts\", \"fields\": [] } | { \"type\": \"stat\", \"stat\": \"count\" | \"sum\" | \"average\" | \"min\" | \"max\", \"field\", \"label\" } | { \"type\": \"list\", \"items\": [] } | { \"type\": \"links\", \"links\": [{ \"label\", \"url\" }] }], \"layers\": [{ \"layer\": url, \"visible\": true, \"relation\": { \"type\": \"intersects\" } }] }.",
    parameters: { type: "object", required: ["briefing"], properties: { briefing: { type: "object", description: "{ \"schemaVersion\": 1, \"layerId\": main layer URL, \"transition\": \"pan\" | \"cut\", \"slides\": [ … ] }" }, present: { type: "boolean", description: "Start presenting right away." } } },
  },
  { name: "generate_briefing", description: "Draft a briefing automatically from a layer as the map shows it (its style, filter and included features): a title slide, key numbers, feature slides and sources.", parameters: { type: "object", properties: { layer: layerRef } } },
  { name: "present_briefing", description: "Start presenting the current briefing.", parameters: { type: "object", properties: {} } },
  {
    name: "create_tour",
    description: "Make a guided tour: the 3D map flies from place to place with a title and a short caption at each stop. Opens Tours mode with the chapters added.",
    parameters: { type: "object", required: ["places"], properties: { title: { type: "string" }, places: { type: "array", maxItems: 50, items: { type: "object", required: ["title", "longitude", "latitude"], properties: { title: { type: "string" }, caption: { type: "string", description: "At most about 80 characters." }, longitude: { type: "number" }, latitude: { type: "number" }, zoom: { type: "number" }, tilt: { type: "number", minimum: 0, maximum: 80 }, heading: { type: "number" } } } } } },
  },
  {
    name: "draft_field_task",
    description: "Draft a field task (a checklist that sends someone to places on the map). It opens for the user to check, then save and share as a link or QR code.",
    parameters: { type: "object", required: ["title", "steps"], properties: { title: { type: "string" }, notes: { type: "string", description: "Instructions, at most 500 characters." }, steps: { type: "array", maxItems: 10, items: { type: "string" } }, location: { type: "string" }, longitude: { type: "number" }, latitude: { type: "number" }, features: { type: "array", maxItems: 5, items: { type: "object", required: ["layer", "objectId"], properties: { layer: layerRef, objectId: { type: ["number", "string"] }, label: { type: "string" } } } } } },
  },
  { name: "app_help", description: "Where a menu, setting or feature of GISMap Online is and what it does. Call it for any question about the app itself (how do I…, where is…, can I change…) before answering; never guess menu names.", parameters: { type: "object", required: ["question"], properties: { question: { type: "string" } } } },
  { name: "get_display_settings", description: "The current display settings (Map → Layout & display…): appearance, navigation, panel positions, and map click feedback such as the selection style.", parameters: { type: "object", properties: {} } },
  { name: "change_display_setting", description: "Change one display setting for the user, such as the selection style (highlightStyle: fill or outline), the feedback colour or dark mode.", parameters: { type: "object", required: ["setting", "value"], properties: { setting: { enum: Object.keys(DISPLAY_SETTINGS) }, value: { type: ["string", "boolean"], description: Object.entries(DISPLAY_SETTINGS).map(([key, definition]) => `${key}: ${Array.isArray(definition.values) ? definition.values.join("|") : definition.values}`).join("; ") } } } },
  { name: "set_mode", description: "Switch the app's mode: briefing (slides), tours (guided tours), tasks (field tasks) or map (the standard map).", parameters: { type: "object", required: ["mode"], properties: { mode: { enum: ["briefing", "tours", "tasks", "map"] } } } },
  { name: "set_skin", description: "Change the interface skin (the app's look, also used by the Skin basemap on MapLibre). Kept with the project.", parameters: { type: "object", required: ["skin"], properties: { skin: { enum: INTERFACE_SKINS.map(({ id }) => id), description: INTERFACE_SKINS.map(({ id, label, description }) => `${id} = ${label} (${description})`).join("; ") } } } },
  { name: "save_project", description: "Save the current map as a project in this browser, optionally under a new name.", parameters: { type: "object", properties: { name: { type: "string" } } } },
  { name: "open_share_menu", description: "Open the Share & export dialog for the user (links, QR code, exports).", parameters: { type: "object", properties: {} } },
  { name: "download", description: "Download the map for the user: pdf (Map PDF), smart-image (a PNG that opens as the project), gis (project file) or gisx (project package with local files).", parameters: { type: "object", required: ["format"], properties: { format: { enum: ["pdf", "smart-image", "gis", "gisx"] } } } },
  { name: "get_share_link", description: "A link (and whether it fits a QR code) that opens the map as it is now, with its briefing.", parameters: { type: "object", properties: {} } },
  { name: "get_map_embed", description: "Return a ready-to-paste iframe and embed URL for the currently configured public map. The embed preserves public layers, styles, filters, view, basemap and skin; local or credentialed data cannot be embedded.", parameters: { type: "object", properties: { title: { type: "string" }, height: { type: "integer", minimum: 280, maximum: 1200 } } } },
]);

/** The model's instructions: how GISMap Online works, the rules for using it well, and the map right now. */
export function buildAssistantInstructions({ state = null, textTools = false } = {}) {
  const lines = [
    "You are the Map assistant inside GISMap Online, a free browser GIS. You build and change the user's map with tools: interactive maps from public data, briefings (slides that present the map), guided tours, and field tasks.",
    "",
    "How to work:",
    "- A question is answered by reading, not by changing the map: for questions about the loaded data use get_map_state, describe_layer and summarize_field. Add, change or remove layers only when the user asks for it.",
    "- When explaining a layer: say what it is and who publishes it (description, credits), how current it is (last edited), how many features, and what its main fields mean (aliases, descriptions, coded values, value ranges). Quote the service's own words; do not invent meanings for fields the metadata does not explain, say they are undocumented.",
    "- Use real, public data only: HTTPS ArcGIS REST layers (FeatureServer/0, MapServer, ImageServer), GeoJSON, WMS, WFS or KML. If the user names a topic but no URL, call search_datasets; if nothing fits, ask for a URL. Never invent URLs.",
    "- Before styling or filtering a layer, learn its fields with inspect_source or get_map_state, and use field names exactly as listed. Never invent fields or numbers.",
    "- Sentinel codes (such as -1 for \"Not Disclosed\") are not measurements: add them to the style's exclude list.",
    "- For a number field prefer { \"type\": \"choropleth\", \"method\": \"auto\" } (points: \"graduated-symbols\"), or { \"type\": \"auto\", \"field\" } to let the app choose; suggest_styles explains the options.",
    "- A whole map in one step: load_map with a map-v1 spec. Small changes: add_layer, update_layer, set_view.",
    "- Charts and Instant Dashboards: after inspecting a loaded layer, create_instant_dashboard makes a linked chart workspace with an appropriate skin and basemap. Choose the skin and basemap deliberately: a skin basemap follows the selected skin on MapLibre, while the data renderer still needs its own readable colours. Chart marks select and filter the matching map records; never describe a chart aggregate as a geographic total without checking coverage.",
    "- Briefings: create_briefing for slides you write, generate_briefing for a quick draft from a layer. Present (present_briefing, or present: true) only when the user asks to present. Feature slides use the feature's object ID. Slides can show the briefing's other layers, limited to features related to the slide's feature (relation types: " + RELATIONS.join(", ") + ").",
    "- Places, IDs and facts come from data: use query_features on a layer (add one first if needed) for real names, coordinates and object IDs. Captions and slide text say only what the data shows or what you are certain of; never fill gaps with guesses.",
    "- Tours: create_tour with places (longitude, latitude), short captions, zoom about 15-17 and tilt about 45-60 for a 3D look.",
    "- Field tasks: draft_field_task. The user reviews it before it is shared.",
    "- When a tool returns an error, read its hint and fix the call; do not repeat the same call.",
    "- After acting, reply in two or three sentences: what you did, and anything the user should check (data caveats, missing fields, sample-based numbers). Offer get_share_link when the user wants to share, and get_map_embed when they want to publish the configured map on another site.",
    "- Questions about the app itself (menus, settings, where something is): call app_help and answer with the exact menu path it gives. Display settings (selection style, highlight colour, appearance, panel positions) can be changed for the user with change_display_setting; say where the setting lives too.",
    "- The app itself: set_mode switches modes, set_skin changes the look, save_project saves, open_share_menu opens Share & export, and download gives a Map PDF, Smart map image, .gis project file or .gisx package. Do these only when the user asks.",
    "- Keep the conversation in the user's language. Do not claim to have done something a tool did not do.",
    "",
    "The app's menus:",
    ...guideOutline(),
  ];
  if (textTools) {
    lines.push(
      "",
      "Tools: to use one, reply with a fenced block exactly like this, one block per call, and nothing after it:",
      "```tool",
      "{\"name\": \"add_layer\", \"arguments\": {\"url\": \"https://…/FeatureServer/0\"}}",
      "```",
      "You will receive each tool's result in the next message. Available tools:",
      ...ASSISTANT_TOOLS.map((tool) => `- ${tool.name}: ${tool.description} Arguments: ${JSON.stringify(tool.parameters.properties)}`),
    );
  }
  if (state) lines.push("", "The map right now:", JSON.stringify(state));
  return lines.join("\n");
}

const think = (text) => String(text || "").replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
const parseArguments = (value) => {
  if (value && typeof value === "object") return value;
  try { return JSON.parse(value || "{}"); } catch { return {}; }
};
let callCount = 0;
const callId = () => `call_${Date.now().toString(36)}_${(callCount += 1)}`;

/** Fenced ```tool {…}``` blocks from a model that cannot call tools natively. */
export function parseTextToolCalls(text) {
  const toolCalls = [];
  const content = String(text || "").replace(/```(?:tool|json)?\s*\n?(\{[\s\S]*?\})\s*```/g, (block, json) => {
    try {
      const call = JSON.parse(json);
      if (typeof call?.name === "string" && ASSISTANT_TOOLS.some((tool) => tool.name === call.name)) {
        toolCalls.push({ id: callId(), name: call.name, arguments: parseArguments(call.arguments) });
        return "";
      }
    } catch { /* Not a tool call: keep the text. */ }
    return block;
  });
  return { content: think(content), toolCalls };
}

/**
 * A provider request for the conversation so far. `messages` are provider-neutral:
 * { role: "user", content } · { role: "assistant", content, toolCalls: [{ id, name, arguments }] }
 * · { role: "tool", toolCallId, name, content }. With `textTools`, tools are described in the
 * instructions instead and results go back as user messages.
 */
export function toProviderRequest(provider, { model, system, messages, textTools = false }) {
  const tools = textTools ? null : ASSISTANT_TOOLS;
  if (textTools) {
    messages = messages.map((message) => (message.role === "tool"
      ? { role: "user", content: `Result of ${message.name}: ${message.content}` }
      : { role: message.role, content: message.content || "" }));
  }
  if (provider === "anthropic") {
    const converted = [];
    for (const message of messages) {
      if (message.role === "tool") {
        const block = { type: "tool_result", tool_use_id: message.toolCallId, content: message.content };
        const last = converted.at(-1);
        if (last?.role === "user" && Array.isArray(last.content) && last.content.every((item) => item.type === "tool_result")) last.content.push(block);
        else converted.push({ role: "user", content: [block] });
      } else if (message.role === "assistant") {
        const content = [...(message.content ? [{ type: "text", text: message.content }] : []), ...(message.toolCalls || []).map((call) => ({ type: "tool_use", id: call.id, name: call.name, input: call.arguments || {} }))];
        converted.push({ role: "assistant", content: content.length ? content : [{ type: "text", text: "…" }] });
      } else {
        converted.push({ role: message.role, content: message.content });
      }
    }
    return { path: "/messages", body: { model, max_tokens: 2048, system, messages: converted, ...(tools ? { tools: tools.map((tool) => ({ name: tool.name, description: tool.description, input_schema: tool.parameters })) } : {}) } };
  }
  const definitions = tools ? tools.map((tool) => ({ type: "function", function: { name: tool.name, description: tool.description, parameters: tool.parameters } })) : null;
  if (provider === "ollama") {
    const converted = messages.map((message) => {
      if (message.role === "tool") return { role: "tool", content: message.content, tool_name: message.name };
      if (message.role === "assistant") return { role: "assistant", content: message.content || "", ...(message.toolCalls?.length ? { tool_calls: message.toolCalls.map((call) => ({ function: { name: call.name, arguments: call.arguments || {} } })) } : {}) };
      return { role: message.role, content: message.content };
    });
    return { path: "/api/chat", body: { model, stream: false, messages: [{ role: "system", content: system }, ...converted], ...(definitions ? { tools: definitions } : {}) } };
  }
  // OpenAI and OpenAI-compatible endpoints: Chat Completions with function tools.
  const converted = messages.map((message) => {
    if (message.role === "tool") return { role: "tool", tool_call_id: message.toolCallId, content: message.content };
    if (message.role === "assistant") return { role: "assistant", content: message.content || null, ...(message.toolCalls?.length ? { tool_calls: message.toolCalls.map((call) => ({ id: call.id, type: "function", function: { name: call.name, arguments: JSON.stringify(call.arguments || {}) } })) } : {}) };
    return { role: message.role, content: message.content };
  });
  return { path: "/chat/completions", body: { model, messages: [{ role: "system", content: system }, ...converted], ...(definitions ? { tools: definitions } : {}) } };
}

/** The reply's text and tool calls, whatever the provider: { content, toolCalls: [{ id, name, arguments }] }. */
export function fromProviderResponse(provider, payload, { textTools = false } = {}) {
  let content = "";
  let toolCalls = [];
  if (provider === "anthropic") {
    content = (payload?.content || []).filter((item) => item.type === "text").map((item) => item.text).join("\n");
    toolCalls = (payload?.content || []).filter((item) => item.type === "tool_use").map((item) => ({ id: item.id, name: item.name, arguments: parseArguments(item.input) }));
  } else if (provider === "ollama") {
    content = payload?.message?.content || "";
    toolCalls = (payload?.message?.tool_calls || []).map((call) => ({ id: call.id || callId(), name: call.function?.name, arguments: parseArguments(call.function?.arguments) }));
  } else {
    const message = payload?.choices?.[0]?.message || {};
    content = message.content || "";
    toolCalls = (message.tool_calls || []).map((call) => ({ id: call.id || callId(), name: call.function?.name, arguments: parseArguments(call.function?.arguments) }));
  }
  if (textTools || !toolCalls.length) {
    const parsed = parseTextToolCalls(content);
    if (parsed.toolCalls.length) return parsed;
  }
  return { content: think(content), toolCalls: toolCalls.filter((call) => call.name) };
}

/** A tool result as the model sees it: JSON, cut to a size models handle well. */
export function compactResult(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? null);
  return text.length > MAX_RESULT ? `${text.slice(0, MAX_RESULT)}… (cut to ${MAX_RESULT} characters)` : text;
}

/**
 * One user turn: asks the model, runs the tools it calls, and asks again with the
 * results, until it answers in words (or after `maxSteps` rounds of tools).
 * `call(messages)` returns { content, toolCalls }; `execute(name, args)` runs a tool.
 * `messages` is extended in place. `onEvent` sees { type: "assistant" | "tool-start" | "tool-end", … }.
 */
export async function runAssistantTurn({ messages, call, execute, onEvent = () => {}, maxSteps = STEP_LIMIT, signal = null }) {
  for (let step = 0; step < maxSteps; step += 1) {
    if (signal?.aborted) throw new DOMException("Stopped.", "AbortError");
    const reply = await call(messages);
    messages.push({ role: "assistant", content: reply.content, toolCalls: reply.toolCalls });
    onEvent({ type: "assistant", content: reply.content, toolCalls: reply.toolCalls });
    if (!reply.toolCalls.length) return reply.content;
    for (const toolCall of reply.toolCalls) {
      if (signal?.aborted) throw new DOMException("Stopped.", "AbortError");
      onEvent({ type: "tool-start", call: toolCall });
      let result;
      let ok = true;
      try {
        result = await execute(toolCall.name, toolCall.arguments || {});
      } catch (error) {
        ok = false;
        result = { error: error?.message || String(error), ...(error?.code ? { code: error.code } : {}), ...(error?.hint ? { hint: error.hint } : {}) };
      }
      messages.push({ role: "tool", toolCallId: toolCall.id, name: toolCall.name, content: compactResult(result) });
      onEvent({ type: "tool-end", call: toolCall, result, ok });
    }
  }
  const stopped = `I stopped after ${maxSteps} rounds of map actions. Tell me how to continue.`;
  messages.push({ role: "assistant", content: stopped, toolCalls: [] });
  return stopped;
}

// ---------------------------------------------------------------------------
// Tool handlers.

const pick = (object, keys) => Object.fromEntries(keys.filter((key) => object?.[key] !== undefined && object[key] !== null).map((key) => [key, object[key]]));
const fieldList = (fields = []) => fields.slice(0, 60).map((field) => ({ name: field.name, type: String(field.type || "").replace(/^esriFieldType/, "").toLowerCase(), ...(field.alias && field.alias !== field.name ? { alias: field.alias } : {}) }));

/** A compact picture of the map for the model (also sent with every turn). */
export function summarizeMapState(api) {
  const state = api.describe().state || {};
  return {
    layers: (state.layers || []).map((layer) => {
      let fields = [];
      try { fields = fieldList(api.layers.metadata(layer.id)?.fields || []); } catch { /* Not an ArcGIS layer. */ }
      return {
        ...pick(layer, ["id", "title", "url", "type", "loadStatus", "visible", "where", "featureCount", "dataLastEditDate"]),
        ...(layer.renderer && layer.renderer.type !== "service" ? { renderer: pick(layer.renderer, ["type", "field", "method", "exclude"]) } : {}),
        ...(layer.sentinels?.length ? { sentinels: layer.sentinels.map(({ field, value, label }) => ({ field, value, label })) } : {}),
        ...(layer.visibleAtCurrentScale === false ? { hiddenAtThisScale: true } : {}),
        ...(fields.length ? { fields } : {}),
      };
    }),
    basemap: state.basemap || null,
    camera: state.camera ? { center: state.camera.center?.map((value) => Number(Number(value).toFixed(4))), zoom: Number(Number(state.camera.zoom).toFixed(1)) } : null,
    mode: state.mode || null,
    briefingSlides: state.briefingSlides || 0,
    ...(state.issues?.length ? { issues: state.issues.slice(0, 5) } : {}),
  };
}

/** A layer on the map by id, URL or title (case-insensitive). */
function findLayer(api, ref) {
  const layers = api.describe().state?.layers || [];
  const text = String(ref || "").trim().toLowerCase();
  const found = layers.find((layer) => String(layer.id).toLowerCase() === text || String(layer.url || "").toLowerCase().replace(/\/+$/, "") === text.replace(/\/+$/, ""))
    || layers.find((layer) => String(layer.title || "").toLowerCase() === text)
    || layers.find((layer) => text && String(layer.title || "").toLowerCase().includes(text));
  if (!found) throw Object.assign(new Error(`No layer "${ref}" on the map.`), { hint: `Layers: ${layers.map((layer) => `${layer.id} (${layer.title})`).join(", ") || "none"}.` });
  return found;
}

const words = (text) => String(text || "").toLowerCase().split(/[^a-z0-9.]+/).filter((word) => word.length > 2);

/**
 * Tool handlers bound to the app. `host`: { api (globalThis.gisMapOnline), catalog
 * (curated datasets), setBasemap(id), createTour(places, { title }),
 * featurePlace(layerRef, objectId) -> { longitude, latitude, layerUrl, label },
 * queryFeatures(layerRef, { where, fields, orderBy, limit }) -> [{ objectId, longitude, latitude, attributes }],
 * draftFieldTask(draft), presentBriefing() }.
 */
export function createAssistantTools(host) {
  const { api } = host;
  const layerInfo = (layer) => pick(layer, ["id", "title", "url", "type", "loadStatus", "where", "featureCount"]);
  return {
    get_map_state: () => summarizeMapState(api),
    async inspect_source({ url }) {
      const meta = await api.application.runTool("source.inspect", { url });
      return {
        ...pick(meta, ["kind", "title", "geometryType", "featureCount", "maxRecordCount", "dataLastEditDate", "minScale", "maxScale"]),
        fields: fieldList(meta.fields),
        ...(meta.sentinels?.length ? { sentinels: meta.sentinels.map(({ field, value, label, source }) => ({ field, value, label, source })) } : {}),
        ...(meta.layers?.length ? { layers: meta.layers.slice(0, 40).map((layer) => ({ ...layer, url: `${String(url).replace(/\/+$/, "")}/${layer.id}` })) } : {}),
      };
    },
    async describe_layer({ layer }) {
      const found = findLayer(api, layer);
      if (found.url && isArcgisLayerUrl(found.url)) return { id: found.id, ...(await describeArcgisLayer(found.url, { fetch: host.fetch })) };
      let fields = [];
      try { fields = api.layers.metadata(found.id)?.fields || []; } catch { /* No metadata. */ }
      return { ...pick(found, ["id", "title", "url", "type", "featureCount", "where", "dataLastEditDate"]), fields: describeFields(fields), note: "Not an ArcGIS REST layer: only its fields are known." };
    },
    async summarize_field({ layer, field, where }) {
      const found = findLayer(api, layer);
      if (found.url && isArcgisLayerUrl(found.url)) return summarizeArcgisField(found.url, field, { where, fetch: host.fetch });
      const suggestion = await api.layers.suggestStyles(found.id, { field });
      return { field: suggestion.field, stats: suggestion.stats, note: "Computed from the features loaded in the map." };
    },
    search_datasets({ query }) {
      const wanted = words(query);
      return (host.catalog || []).map((item) => {
        const text = words([item.title, item.description, item.category, item.provider, ...(item.tags || [])].join(" "));
        return { item, score: wanted.filter((word) => text.some((candidate) => candidate.startsWith(word) || word.startsWith(candidate))).length };
      }).filter((entry) => entry.score > 0).sort((a, b) => b.score - a.score).slice(0, 6).map(({ item }) => ({
        title: item.title, provider: item.provider, description: item.description, url: item.url,
        ...(item.layers?.length ? { layers: item.layers.map((layer) => ({ title: layer.title, url: layer.url })) } : {}),
      }));
    },
    async add_layer({ url, ...options }) {
      return layerInfo(await api.layers.add(url, pick(options, ["title", "where", "renderer", "opacity"])));
    },
    async update_layer({ layer, ...patch }) {
      // `where: null` clears the filter, so it is passed through rather than dropped.
      const changes = { ...pick(patch, ["title", "where", "renderer", "opacity", "visible"]), ...("where" in patch ? { where: patch.where } : {}) };
      return layerInfo(await api.layers.update(layer, changes));
    },
    remove_layer: ({ layer }) => ({ removed: api.layers.remove(layer) }),
    async query_features({ layer, where, fields, orderBy, limit = 10 }) {
      return host.queryFeatures(layer, { where, fields, orderBy, limit: Math.min(25, Math.max(1, Number(limit) || 10)) });
    },
    async suggest_styles({ layer, field }) {
      const suggestion = await api.layers.suggestStyles(layer, field ? { field } : {});
      return {
        field: suggestion.field,
        stats: pick(suggestion.stats, ["count", "excluded", "distinct", "min", "max", "median"]),
        options: suggestion.options.map((option) => ({ label: option.label, reason: option.reason, recommended: option.recommended, pinnedSpec: option.pinnedSpec })),
      };
    },
    async set_view({ layer, longitude, latitude, zoom }) {
      if (layer) await api.layers.zoomTo(layer);
      else if (Number.isFinite(longitude) && Number.isFinite(latitude)) await api.camera.set({ center: [longitude, latitude], zoom: Number.isFinite(zoom) ? zoom : 12 });
      else throw Object.assign(new Error("Give a layer, or a longitude and latitude."), { code: "INVALID_SPEC" });
      return { camera: summarizeMapState(api).camera };
    },
    set_basemap({ basemap }) {
      if (!BASEMAPS.includes(basemap)) throw Object.assign(new Error(`Unknown basemap "${basemap}".`), { hint: `Use one of: ${BASEMAPS.join(", ")}.` });
      host.setBasemap(basemap);
      return { basemap };
    },
    async create_instant_dashboard({ layer, title = "", skin = "gismap", basemap = "skin" }) {
      const found = findLayer(api, layer);
      const skinChoice = INTERFACE_SKINS.find(({ id }) => id === skin);
      if (!skinChoice) throw Object.assign(new Error(`Unknown skin "${skin}".`), { hint: `Use one of: ${INTERFACE_SKINS.map(({ id }) => id).join(", ")}.` });
      if (!BASEMAPS.includes(basemap)) throw Object.assign(new Error(`Unknown basemap "${basemap}".`), { hint: `Use one of: ${BASEMAPS.join(", ")}.` });
      if (typeof host.createInstantDashboard !== "function") throw Object.assign(new Error("Instant Dashboard is not available in this GISMap session."), { hint: "Open the map workspace and try again after it has finished loading." });
      return host.createInstantDashboard({ layer: found, title, skin: skinChoice.id, basemap });
    },
    async load_map({ spec, replace = true }) {
      const result = api.mapSpec.load(spec, { replace, showIssues: false });
      if (!result.spec) return { valid: false, issues: result.issues };
      const ready = await result.ready;
      return { layers: ready.layers.map(layerInfo), issues: ready.issues };
    },
    async create_briefing({ briefing, present = false }) {
      const result = api.briefing.load(briefing, { present });
      await result.ready;
      return { slides: result.document.slides.map((slide) => slide.title || slide.template), issues: result.issues };
    },
    async generate_briefing({ layer } = {}) {
      const document = await api.briefing.generate(layer ? { layerId: layer } : {});
      return { slides: document.slides.map((slide) => slide.title || slide.template) };
    },
    async present_briefing() {
      if (!api.briefing.get()?.slides?.length) throw Object.assign(new Error("There is no briefing to present yet."), { hint: "Call create_briefing or generate_briefing first." });
      await host.presentBriefing();
      return { presenting: true };
    },
    create_tour({ title = "", places = [] }) {
      const usable = places.filter((place) => Number.isFinite(place?.longitude) && Number.isFinite(place?.latitude));
      if (!usable.length) throw Object.assign(new Error("A tour needs places with longitude and latitude."), { code: "INVALID_SPEC" });
      host.createTour(usable.map((place) => ({ title: place.title, body: place.caption || "", longitude: place.longitude, latitude: place.latitude, zoom: place.zoom, tilt: place.tilt, heading: place.heading })), { title });
      return { chapters: usable.map((place) => place.title), opened: "Tours mode" };
    },
    async draft_field_task({ features = [], ...draft }) {
      const placed = [];
      for (const feature of features.slice(0, 5)) placed.push(await host.featurePlace(feature.layer, feature.objectId, feature.label));
      host.draftFieldTask({ ...draft, features: placed });
      return { drafted: draft.title, features: placed.map((feature) => feature.label), next: "The user checks the draft, then saves and shares it." };
    },
    app_help({ question }) {
      const matches = searchGuide(question);
      return matches.length ? { matches } : { matches: [], hint: "Nothing in the guide matches; say so rather than guessing a menu." };
    },
    get_display_settings() {
      return Object.fromEntries(Object.keys(DISPLAY_SETTINGS).map((key) => [key, host.getDisplaySettings?.()[key]]));
    },
    change_display_setting({ setting, value }) {
      const checked = validateDisplaySetting(setting, value);
      if (checked instanceof Error) throw checked;
      host.setDisplaySetting(checked.key, checked.value);
      return { [checked.key]: checked.value, where: "Map → Layout & display…" };
    },
    set_mode({ mode }) {
      if (!["briefing", "tours", "tasks", "map"].includes(mode)) throw Object.assign(new Error(`Unknown mode "${mode}".`), { hint: "Use briefing, tours, tasks or map." });
      host.setMode(mode);
      return { mode };
    },
    set_skin({ skin }) {
      const choice = INTERFACE_SKINS.find(({ id, label }) => id === skin || label.toLowerCase() === String(skin).toLowerCase());
      if (!choice) throw Object.assign(new Error(`Unknown skin "${skin}".`), { hint: `Use one of: ${INTERFACE_SKINS.map(({ id }) => id).join(", ")}.` });
      host.setSkin(choice.id);
      return { skin: choice.id, label: choice.label };
    },
    save_project({ name } = {}) {
      return { saved: host.saveProject(name || null) };
    },
    open_share_menu() {
      host.openShareMenu();
      return { opened: "Share & export" };
    },
    async download({ format }) {
      if (!["pdf", "smart-image", "gis", "gisx"].includes(format)) throw Object.assign(new Error(`Unknown format "${format}".`), { hint: "Use pdf, smart-image, gis or gisx." });
      await host.download(format);
      return { downloaded: format };
    },
    async get_share_link() {
      const { url, qr } = await api.mapSpec.createLink(api.mapSpec.fromCurrent());
      return { url, fitsQrCode: qr };
    },
    async get_map_embed({ title, height } = {}) {
      if (typeof host.createMapEmbed !== "function") throw Object.assign(new Error("Map embeds are not available in this GISMap session."), { hint: "Open Share & export to create a map link, then choose Embed." });
      return host.createMapEmbed({ title, height });
    },
  };
}
