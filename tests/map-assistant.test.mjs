import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { ASSISTANT_TOOLS, buildAssistantInstructions, createAssistantTools, fromProviderResponse, parseTextToolCalls, runAssistantTurn, summarizeMapState, toProviderRequest } from "../js/map-assistant.js";

const CORN = "https://services.arcgis.com/P3ePLMYs2RVChkJx/ArcGIS/rest/services/Corn/FeatureServer/0";
const conversation = [
  { role: "user", content: "Map corn sales" },
  { role: "assistant", content: "", toolCalls: [{ id: "c1", name: "inspect_source", arguments: { url: CORN } }, { id: "c2", name: "get_map_state", arguments: {} }] },
  { role: "tool", toolCallId: "c1", name: "inspect_source", content: "{\"fields\":[]}" },
  { role: "tool", toolCallId: "c2", name: "get_map_state", content: "{\"layers\":[]}" },
];

test("the instructions teach the model to work from data, and carry the live map", () => {
  const text = buildAssistantInstructions({ state: { layers: [{ id: "l1", title: "Corn" }] } });
  assert.match(text, /Never invent URLs/);
  assert.match(text, /use field names exactly/);
  assert.match(text, /Sentinel codes/);
  assert.match(text, /query_features/);
  assert.match(text, /Instant Dashboards/);
  assert.match(text, /get_map_embed/);
  assert.match(text, /only when the user asks to present/);
  assert.match(text, /"title":"Corn"/);
  assert.doesNotMatch(text, /```tool/, "native tool calling needs no text protocol");
  const fallback = buildAssistantInstructions({ textTools: true });
  assert.match(fallback, /```tool\n\{"name": "add_layer"/);
  for (const tool of ASSISTANT_TOOLS) assert.match(fallback, new RegExp(`- ${tool.name}:`));
});

test("every tool is a valid function definition with a handler", () => {
  const handlers = createAssistantTools({ api: {} });
  for (const tool of ASSISTANT_TOOLS) {
    assert.match(tool.name, /^[a-z_]+$/);
    assert.equal(tool.parameters.type, "object");
    assert.ok(tool.description.length > 20, tool.name);
    assert.equal(typeof handlers[tool.name], "function", tool.name);
  }
  assert.equal(Object.keys(handlers).length, ASSISTANT_TOOLS.length);
});

test("conversations translate to Ollama, OpenAI-style and Anthropic requests", () => {
  const ollama = toProviderRequest("ollama", { model: "qwen", system: "SYS", messages: conversation });
  assert.equal(ollama.path, "/api/chat");
  assert.equal(ollama.body.stream, false);
  assert.deepEqual(ollama.body.messages[0], { role: "system", content: "SYS" });
  assert.deepEqual(ollama.body.messages[2].tool_calls[0], { function: { name: "inspect_source", arguments: { url: CORN } } });
  assert.deepEqual(ollama.body.messages[3], { role: "tool", content: "{\"fields\":[]}", tool_name: "inspect_source" });
  assert.equal(ollama.body.tools.length, ASSISTANT_TOOLS.length);

  const openai = toProviderRequest("openai", { model: "gpt", system: "SYS", messages: conversation });
  assert.equal(openai.path, "/chat/completions");
  assert.deepEqual(openai.body.messages[2].tool_calls[0], { id: "c1", type: "function", function: { name: "inspect_source", arguments: JSON.stringify({ url: CORN }) } });
  assert.deepEqual(openai.body.messages[3], { role: "tool", tool_call_id: "c1", content: "{\"fields\":[]}" });
  assert.equal(openai.body.tools[0].type, "function");

  const anthropic = toProviderRequest("anthropic", { model: "claude", system: "SYS", messages: conversation });
  assert.equal(anthropic.path, "/messages");
  assert.equal(anthropic.body.system, "SYS");
  assert.deepEqual(anthropic.body.messages[1].content[0], { type: "tool_use", id: "c1", name: "inspect_source", input: { url: CORN } });
  assert.equal(anthropic.body.messages.length, 3, "both tool results go back in one user message");
  assert.deepEqual(anthropic.body.messages[2].content.map((block) => block.tool_use_id), ["c1", "c2"]);
  assert.ok(anthropic.body.tools[0].input_schema);

  const bedrock = toProviderRequest("bedrock", { model: "us.anthropic.claude-sonnet-5-5", system: "SYS", messages: conversation });
  assert.equal(bedrock.path, "/model/us.anthropic.claude-sonnet-5-5/converse");
  assert.deepEqual(bedrock.body.system, [{ text: "SYS" }]);
  assert.deepEqual(bedrock.body.messages[0], { role: "user", content: [{ text: "Map corn sales" }] });
  assert.deepEqual(bedrock.body.messages[1].content[0], { toolUse: { toolUseId: "c1", name: "inspect_source", input: { url: CORN } } });
  assert.equal(bedrock.body.messages.length, 3, "both tool results go back in one user message");
  assert.deepEqual(bedrock.body.messages[2].content.map((block) => block.toolResult.toolUseId), ["c1", "c2"]);
  assert.equal(bedrock.body.toolConfig.tools.length, ASSISTANT_TOOLS.length);
  assert.ok(bedrock.body.toolConfig.tools[0].toolSpec.inputSchema.json);

  const text = toProviderRequest("ollama", { model: "qwen", system: "SYS", messages: conversation, textTools: true });
  assert.equal(text.body.tools, undefined);
  assert.deepEqual(text.body.messages[3], { role: "user", content: "Result of inspect_source: {\"fields\":[]}" });
});

test("replies come back as text and tool calls, whatever the provider", () => {
  const ollama = fromProviderResponse("ollama", { message: { content: "<think>hmm</think>On it.", tool_calls: [{ function: { name: "add_layer", arguments: { url: CORN } } }] } });
  assert.equal(ollama.content, "On it.", "reasoning is stripped");
  assert.equal(ollama.toolCalls[0].name, "add_layer");
  assert.deepEqual(ollama.toolCalls[0].arguments, { url: CORN });
  assert.ok(ollama.toolCalls[0].id);
  const openai = fromProviderResponse("openai-compatible", { choices: [{ message: { content: null, tool_calls: [{ id: "x", function: { name: "set_basemap", arguments: "{\"basemap\":\"gray-vector\"}" } }] } }] });
  assert.deepEqual(openai.toolCalls, [{ id: "x", name: "set_basemap", arguments: { basemap: "gray-vector" } }]);
  const anthropic = fromProviderResponse("anthropic", { content: [{ type: "text", text: "Adding it." }, { type: "tool_use", id: "t", name: "add_layer", input: { url: CORN } }] });
  assert.equal(anthropic.content, "Adding it.");
  assert.deepEqual(anthropic.toolCalls, [{ id: "t", name: "add_layer", arguments: { url: CORN } }]);
  const bedrock = fromProviderResponse("bedrock", { output: { message: { role: "assistant", content: [{ text: "Adding it." }, { toolUse: { toolUseId: "b", name: "add_layer", input: { url: CORN } } }] } }, stopReason: "tool_use" });
  assert.equal(bedrock.content, "Adding it.");
  assert.deepEqual(bedrock.toolCalls, [{ id: "b", name: "add_layer", arguments: { url: CORN } }]);
});

test("a model without tool support can still call tools in fenced blocks", () => {
  const parsed = parseTextToolCalls(`I'll add it.\n\`\`\`tool\n{"name": "add_layer", "arguments": {"url": "${CORN}"}}\n\`\`\``);
  assert.equal(parsed.content, "I'll add it.");
  assert.deepEqual(parsed.toolCalls.map((call) => [call.name, call.arguments.url]), [["add_layer", CORN]]);
  assert.deepEqual(parseTextToolCalls("```json\n{\"name\": \"not_a_tool\"}\n```").toolCalls, [], "only real tools");
  assert.deepEqual(parseTextToolCalls("```json\n{\"rows\": 3}\n```").toolCalls, []);
  assert.equal(fromProviderResponse("ollama", { message: { content: `\`\`\`tool\n{"name": "get_map_state", "arguments": {}}\n\`\`\`` } }, { textTools: true }).toolCalls[0].name, "get_map_state");
});

test("a turn runs the tools the model calls, returns errors to it, and ends when it answers", async () => {
  const replies = [
    { content: "", toolCalls: [{ id: "a", name: "add_layer", arguments: { url: "bad" } }] },
    { content: "", toolCalls: [{ id: "b", name: "add_layer", arguments: { url: CORN } }] },
    { content: "Added the corn layer.", toolCalls: [] },
  ];
  const messages = [{ role: "user", content: "Map corn" }];
  const events = [];
  const answer = await runAssistantTurn({
    messages,
    call: async () => replies.shift(),
    execute: async (name, args) => {
      if (args.url === "bad") throw Object.assign(new Error("Not a URL."), { code: "INVALID_URL", hint: "Use https://…" });
      return { id: "layer-1", title: "Corn" };
    },
    onEvent: (event) => events.push(event.type),
  });
  assert.equal(answer, "Added the corn layer.");
  assert.deepEqual(messages.map((message) => message.role), ["user", "assistant", "tool", "assistant", "tool", "assistant"]);
  assert.deepEqual(JSON.parse(messages[2].content), { error: "Not a URL.", code: "INVALID_URL", hint: "Use https://…" });
  assert.equal(messages[2].toolCallId, "a");
  assert.deepEqual(events, ["assistant", "tool-start", "tool-end", "assistant", "tool-start", "tool-end", "assistant"]);

  const looping = await runAssistantTurn({ messages: [], maxSteps: 2, call: async () => ({ content: "", toolCalls: [{ id: "x", name: "get_map_state", arguments: {} }] }), execute: async () => ({}) });
  assert.match(looping, /stopped after 2 rounds/);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(runAssistantTurn({ messages: [], signal: controller.signal, call: async () => ({ content: "", toolCalls: [] }), execute: async () => ({}) }), { name: "AbortError" });
});

test("tool handlers call the in-page API and the app's hooks", async () => {
  const calls = [];
  const api = {
    describe: () => ({ state: { layers: [{ id: "l1", title: "Corn", url: CORN, renderer: { type: "choropleth", field: "SALES", method: "quantile", breaks: [1, 2] }, sentinels: [{ field: "SALES", value: -1, label: "Not Disclosed", source: "renderer" }] }], basemap: "gray-vector", camera: { center: [-93.123456, 41.98765], zoom: 4.234 } } }),
    layers: {
      metadata: () => ({ fields: [{ name: "SALES", type: "esriFieldTypeInteger", alias: "Sales" }] }),
      add: async (url, options) => { calls.push(["add", url, options]); return { id: "l1", title: "Corn", url }; },
      update: async (layer, patch) => { calls.push(["update", layer, patch]); return { id: layer, title: "Corn" }; },
    },
    mapSpec: { load: (spec) => ({ spec, issues: [], ready: Promise.resolve({ layers: [{ id: "l1", title: "Corn" }], issues: [] }) }) },
  };
  const host = {
    api,
    catalog: [{ title: "USA Wildfires", description: "Current wildfire incidents", tags: ["wildfire"], url: "https://w/FeatureServer", layers: [{ title: "Incidents", url: "https://w/FeatureServer/0" }] }],
    setBasemap: (id) => calls.push(["basemap", id]),
    createInstantDashboard: ({ layer, skin, basemap }) => ({ dashboard: "Corn dashboard", layer: layer.title, skin, basemap }),
    createMapEmbed: ({ title, height }) => ({ url: "https://gismap.online/?embed=1", iframe: `<iframe title="${title}" height="${height}"></iframe>` }),
    createTour: (places, options) => calls.push(["tour", places, options]),
    featurePlace: async (layer, objectId, label) => ({ layerUrl: CORN, objectId, latitude: 41, longitude: -93, label: label || "County" }),
    draftFieldTask: (draft) => calls.push(["task", draft]),
  };
  const tools = createAssistantTools(host);
  const state = summarizeMapState(api);
  assert.deepEqual(state.layers[0].renderer, { type: "choropleth", field: "SALES", method: "quantile" }, "breaks are left out to keep the prompt small");
  assert.deepEqual(state.layers[0].fields, [{ name: "SALES", type: "integer", alias: "Sales" }]);
  assert.deepEqual(state.camera, { center: [-93.1235, 41.9877], zoom: 4.2 });

  await tools.add_layer({ url: CORN, renderer: { type: "auto", field: "SALES" }, bogus: 1 });
  assert.deepEqual(calls.at(-1), ["add", CORN, { renderer: { type: "auto", field: "SALES" } }]);
  await tools.update_layer({ layer: "l1", where: null });
  assert.deepEqual(calls.at(-1), ["update", "l1", { where: null }], "where: null clears the filter");
  assert.throws(() => tools.set_basemap({ basemap: "moon" }), /Unknown basemap/);
  tools.set_basemap({ basemap: "gray-vector" });
  assert.deepEqual(calls.at(-1), ["basemap", "gray-vector"]);
  assert.deepEqual(await tools.create_instant_dashboard({ layer: "l1", skin: "gismap", basemap: "skin" }), { dashboard: "Corn dashboard", layer: "Corn", skin: "gismap", basemap: "skin" });
  assert.match((await tools.get_map_embed({ title: "Corn", height: 500 })).iframe, /iframe/);
  assert.deepEqual(tools.search_datasets({ query: "wildfires" }).map((item) => item.title), ["USA Wildfires"]);
  assert.deepEqual(await tools.load_map({ spec: { version: 1, layers: [{ url: CORN }] } }), { layers: [{ id: "l1", title: "Corn" }], issues: [] });
  tools.create_tour({ title: "Parks", places: [{ title: "Fenway Park", caption: "Opened 1912", longitude: -71.0977, latitude: 42.3462, tilt: 55 }, { title: "Nowhere" }] });
  assert.deepEqual(calls.at(-1), ["tour", [{ title: "Fenway Park", body: "Opened 1912", longitude: -71.0977, latitude: 42.3462, zoom: undefined, tilt: 55, heading: undefined }], { title: "Parks" }]);
  const task = await tools.draft_field_task({ title: "Check", steps: ["Look"], features: [{ layer: "l1", objectId: 7, label: "Polk" }] });
  assert.deepEqual(task.features, ["Polk"]);
  assert.deepEqual(calls.at(-1)[1].features, [{ layerUrl: CORN, objectId: 7, latitude: 41, longitude: -93, label: "Polk" }]);
});

test("the AI controller retries without tools when a model rejects them, and remembers", async () => {
  const store = new Map();
  globalThis.localStorage ??= { getItem: (key) => store.get(key) ?? null, setItem: (key, value) => store.set(key, value), removeItem: (key) => store.delete(key) };
  globalThis.sessionStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
  const { AIController } = await import("../js/ai.js");
  const ai = new AIController({ subscribe() {}, publish() {} }, {});
  ai.config = { provider: "ollama", endpoint: "http://localhost:11434", model: "small" };
  const bodies = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    const body = JSON.parse(options.body);
    bodies.push(body);
    if (body.tools) return { ok: false, status: 400, json: async () => ({ error: "registry.ollama.ai/library/small does not support tools" }) };
    return { ok: true, json: async () => ({ message: { content: "```tool\n{\"name\": \"get_map_state\", \"arguments\": {}}\n```" } }) };
  };
  try {
    const reply = await ai.chat([{ role: "user", content: "hi" }], { instructions: (textTools) => (textTools ? "TEXT" : "NATIVE") });
    assert.equal(reply.toolCalls[0].name, "get_map_state");
    assert.deepEqual(bodies.map((body) => [Boolean(body.tools), body.messages[0].content]), [[true, "NATIVE"], [false, "TEXT"]]);
    await ai.chat([{ role: "user", content: "again" }], { instructions: (textTools) => (textTools ? "TEXT" : "NATIVE") });
    assert.equal(bodies.length, 3, "the next turn goes straight to text tools");
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("the app offers the assistant in the Tools menu and the right panel", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /<button data-action="tools-assistant">Map assistant<\/button>/);
  assert.match(html, /id="utility-assistant-content"[^>]*data-utility-pane="assistant"/);
  const ui = await readFile(new URL("../js/ui.js", import.meta.url), "utf8");
  assert.match(ui, /case "tools-assistant":\s*this\.openAssistant\(\);/);
  assert.match(ui, /this\.applicationRuntime\.mountAssistant = \(host\) => this\.assistant\.mount\(host\);/);
});
