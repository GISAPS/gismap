import { fromProviderResponse, toProviderRequest } from "./map-assistant.js?v=0.68.0-charts1";

const CONFIG_KEY = "gismap-online:ai-config:v2";
const LEGACY_CONFIG_KEY = "gismap-online:ai-config:v1";

const PROVIDER_DEFAULTS = {
  ollama: { endpoint: "http://localhost:11434", model: "llama3.2" },
  openai: { endpoint: "https://api.openai.com/v1", model: "gpt-6-astra" },
  anthropic: { endpoint: "https://api.anthropic.com/v1", model: "claude-sonnet-5" },
  "openai-compatible": { endpoint: "", model: "" },
};

export const AI_SYSTEM_PROMPT =
  "You are the GISMap Online spatial analysis assistant. Treat supplied map layers, identified features, " +
  "explicitly selected features, " +
  "coordinates, and geocoder details as the primary evidence. You may also use your general knowledge to " +
  "provide useful geographic, historical, and cultural context. Clearly distinguish map observations from " +
  "general-knowledge inference. Do not claim that a specific landmark or feature is at the clicked coordinates " +
  "unless the map context or geocoder confirms it. Say when a question requires current external research that " +
  "you cannot perform, and never invent missing map attributes.";

function compactAttributes(attributes) {
  return Object.fromEntries(Object.entries(attributes ?? {})
    .filter(([, value]) => ["string", "number", "boolean"].includes(typeof value) && value !== "")
    .slice(0, 40)
    .map(([key, value]) => [key, typeof value === "string" ? value.slice(0, 500) : value]));
}

function compactGeometry(geometry) {
  if (!geometry) return null;
  const source = geometry.toJSON?.() ?? geometry;
  const spatialReference = source.spatialReference || geometry.spatialReference;
  const reference = spatialReference
    ? { wkid: spatialReference.latestWkid || spatialReference.wkid || undefined }
    : undefined;
  if (Number.isFinite(source.x) && Number.isFinite(source.y)) {
    return { type: "point", x: source.x, y: source.y, ...(Number.isFinite(source.z) ? { z: source.z } : {}), spatialReference: reference };
  }
  const trimParts = (parts) => (parts ?? []).slice(0, 5).map((part) => part.slice(0, 100));
  if (source.points) return { type: "multipoint", points: source.points.slice(0, 100), spatialReference: reference };
  if (source.paths) return { type: "polyline", paths: trimParts(source.paths), spatialReference: reference };
  if (source.rings) return { type: "polygon", rings: trimParts(source.rings), spatialReference: reference };
  if (source.type && source.coordinates) {
    const budget = { remaining: 500 };
    const trimCoordinates = (value) => {
      if (!Array.isArray(value) || budget.remaining <= 0) return null;
      if (value.every((coordinate) => typeof coordinate === "number")) {
        budget.remaining -= 1;
        return value.slice(0, 3);
      }
      const trimmed = [];
      for (const child of value) {
        if (budget.remaining <= 0) break;
        const result = trimCoordinates(child);
        if (result !== null) trimmed.push(result);
      }
      return trimmed;
    };
    return { type: source.type, coordinates: trimCoordinates(source.coordinates) };
  }
  return null;
}

export function buildAIMapContext(context, loadedLayers = []) {
  if (!context) return { loadedLayers };
  const identified = context.results ?? [];
  const selected = Array.isArray(context.selectedResults)
    ? context.selectedResults
    : identified.slice(0, 1);
  const selectedFeatures = selected.slice(0, 10).map((result) => ({
    kind: result.kind || "feature",
    layer: result.layerTitle,
    attributes: compactAttributes(result.attributes),
    geometry: compactGeometry(result.geometry),
  }));
  return {
    coordinates: context.point
      ? { longitude: context.point.longitude, latitude: context.point.latitude }
      : null,
    address: context.address?.address ?? null,
    geocoderDetails: compactAttributes(context.address?.attributes),
    selectedFeatures,
    identifiedFeatureSummary: {
      count: identified.length,
      layers: [...new Set(identified.map((result) => result.layerTitle).filter(Boolean))].slice(0, 20),
    },
    mapExtent: context.mapExtent ?? null,
    loadedLayers,
    ...(loadedLayers.some((layer) => layer.sentinels?.length)
      ? { dataNotes: "Values listed under a layer's sentinels (such as -1 = Not Disclosed) are codes, not measurements: never sum, average or compare them as numbers." }
      : {}),
  };
}

export function getOpenAIResponseText(payload) {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) return payload.output_text;
  return (payload?.output ?? [])
    .flatMap((item) => item?.content ?? [])
    .filter((item) => item?.type === "output_text")
    .map((item) => item.text)
    .filter(Boolean)
    .join("\n");
}

async function responseError(response, provider) {
  let detail = "";
  try {
    const payload = await response.json();
    detail = payload?.error?.message || (typeof payload?.error === "string" ? payload.error : "") || payload?.message || "";
  } catch {
    // Some gateways return an empty or non-JSON error response.
  }
  return `${provider} returned ${response.status}${detail ? `: ${detail}` : "."}`;
}

export class AIController {
  constructor(events, mapController) {
    this.events = events;
    this.mapController = mapController;
    this.config = this.#readConfig();
    this.token = "";
    this.lastContext = null;
    // Remove credentials saved by the foundation build. Secrets now remain in memory only.
    sessionStorage.removeItem(LEGACY_CONFIG_KEY);
    this.events.subscribe("identify:complete", (payload) => {
      if (payload.intelligenceCurrent !== false) this.lastContext = payload;
    });
    this.events.subscribe("identify:cleared", () => { this.lastContext = null; });
  }

  configure(config) {
    const provider = config.provider || "ollama";
    const defaults = PROVIDER_DEFAULTS[provider] || PROVIDER_DEFAULTS.ollama;
    this.config = {
      provider,
      endpoint: (config.endpoint || defaults.endpoint).trim().replace(/\/$/, ""),
      model: (config.model || defaults.model).trim(),
    };
    this.token = config.token?.trim() || "";
    if (!this.config.endpoint) throw new Error("An AI endpoint URL is required.");
    if (!this.config.model) throw new Error("An AI model is required.");
    if (provider !== "ollama" && !this.token) {
      throw new Error("An API token is required for this online provider.");
    }
    localStorage.setItem(CONFIG_KEY, JSON.stringify(this.config));
    this.events.publish("ai:configured", { config: { ...this.config } });
  }

  async testConnection(config) {
    const endpoint = (config?.endpoint || PROVIDER_DEFAULTS.ollama.endpoint).trim().replace(/\/$/, "");
    const model = (config?.model || "").trim();
    const provider = config?.provider || "ollama";
    if (provider === "openai") {
      if (!config?.token?.trim()) throw new Error("Enter an OpenAI API token to test the connection.");
      const response = await fetch(`${endpoint}/models/${encodeURIComponent(model)}`, {
        headers: { Authorization: `Bearer ${config.token.trim()}` },
      });
      if (!response.ok) throw new Error(await responseError(response, "OpenAI"));
      return { endpoint, model };
    }
    if (provider !== "ollama") {
      throw new Error("Connection testing is available for Ollama and OpenAI. Other providers are checked when you send an insight request.");
    }
    const response = await this.#fetchOllama(`${endpoint}/api/tags`, {}, endpoint);
    if (!response.ok) throw new Error(`Ollama returned ${response.status} while listing models.`);
    const payload = await response.json();
    const models = (payload.models ?? []).map((item) => item.name || item.model).filter(Boolean);
    if (model && !models.includes(model)) {
      const suggestion = models.find((name) => name === model || name.startsWith(`${model}:`));
      const installed = models.length ? models.join(", ") : "none reported";
      throw new Error(
        suggestion
          ? `Connected to Ollama, but use the exact model tag “${suggestion}”.`
          : `Connected to Ollama, but “${model}” is not installed. Installed models: ${installed}.`,
      );
    }
    return { endpoint, models };
  }

  disable() {
    this.config = null;
    this.token = "";
    localStorage.removeItem(CONFIG_KEY);
    sessionStorage.removeItem(LEGACY_CONFIG_KEY);
    this.events.publish("ai:disabled");
  }

  isConfigured() {
    if (!this.config?.endpoint || !this.config?.model) return false;
    return this.config.provider === "ollama" || Boolean(this.token);
  }

  /** `quiet` answers without the Intelligence panel (for text the app writes into a briefing). */
  async ask(prompt, context = this.lastContext, { quiet = false } = {}) {
    if (!this.isConfigured()) throw new Error("Configure an AI provider from Tools first.");
    const system = AI_SYSTEM_PROMPT;
    const mapContext = this.#compactContext(context);
    const messages = [
      { role: "system", content: system },
      { role: "user", content: `Map context:\n${JSON.stringify(mapContext)}\n\nQuestion: ${prompt}` },
    ];
    if (!quiet) this.events.publish("ai:start", { context });
    try {
      let text;
      if (this.config.provider === "ollama") {
        const response = await this.#fetchOllama(`${this.config.endpoint}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: this.config.model, messages, stream: false }),
        }, this.config.endpoint, 120000);
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error(
              `Ollama could not find “${this.config.model}”. Open Project → Configure AI, use the exact installed model tag, and test again.`,
            );
          }
          throw new Error(`Ollama returned ${response.status}.`);
        }
        text = (await response.json()).message?.content;
      } else if (this.config.provider === "anthropic") {
        const response = await fetch(`${this.config.endpoint}/messages`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": this.token,
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true",
          },
          body: JSON.stringify({
            model: this.config.model,
            max_tokens: 1200,
            system,
            messages: [{ role: "user", content: messages[1].content }],
          }),
        });
        if (!response.ok) throw new Error(`Anthropic returned ${response.status}.`);
        const payload = await response.json();
        text = payload.content?.filter((item) => item.type === "text").map((item) => item.text).join("\n");
      } else if (this.config.provider === "openai") {
        const response = await fetch(`${this.config.endpoint}/responses`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.token}`,
          },
          body: JSON.stringify({
            model: this.config.model,
            instructions: system,
            input: messages[1].content,
            max_output_tokens: 1200,
          }),
        });
        if (!response.ok) throw new Error(await responseError(response, "OpenAI"));
        text = getOpenAIResponseText(await response.json());
      } else {
        const response = await fetch(`${this.config.endpoint}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.token}`,
          },
          body: JSON.stringify({ model: this.config.model, messages }),
        });
        if (!response.ok) throw new Error(await responseError(response, "AI endpoint"));
        text = (await response.json()).choices?.[0]?.message?.content;
      }
      if (!quiet) this.events.publish("ai:complete", { text: text || "No response returned.", context });
      return text;
    } catch (error) {
      if (!quiet) this.events.publish("ai:error", { error, context });
      throw error;
    }
  }

  /**
   * One round of the Map assistant's conversation (js/map-assistant.js): sends the
   * instructions, the messages and the tools, and returns { content, toolCalls }.
   * `instructions(textTools)` writes the system message. A model that rejects tools
   * is asked again with the tools described in text, and stays that way this session.
   */
  async chat(messages, { instructions, signal = null } = {}) {
    if (!this.isConfigured()) throw new Error("Configure an AI provider from Tools first.");
    const { provider, endpoint, model } = this.config;
    const send = async (textTools) => {
      const { path, body } = toProviderRequest(provider, { model, system: instructions(textTools), messages, textTools });
      const headers = { "Content-Type": "application/json" };
      if (provider === "anthropic") Object.assign(headers, { "x-api-key": this.token, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" });
      else if (provider !== "ollama") headers.Authorization = `Bearer ${this.token}`;
      const options = { method: "POST", headers, body: JSON.stringify(body), signal };
      const response = provider === "ollama"
        ? await this.#fetchOllama(`${endpoint}${path}`, options, endpoint, 300000)
        : await fetch(`${endpoint}${path}`, options);
      if (!response.ok) {
        const message = await responseError(response, provider === "ollama" ? "Ollama" : "The AI provider");
        return { error: message, status: response.status };
      }
      return { reply: fromProviderResponse(provider, await response.json(), { textTools }) };
    };
    let result = await send(this.textTools === true);
    if (result.error && !this.textTools && result.status === 400 && /tool|function/i.test(result.error)) {
      this.textTools = true;
      result = await send(true);
    }
    if (result.error) throw new Error(result.error);
    return result.reply;
  }

  async #fetchOllama(url, options, endpoint, timeoutMs = 8000) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    // A caller's signal (the assistant's Stop button) also cancels the request.
    options.signal?.addEventListener("abort", () => controller.abort(), { once: true });
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } catch (error) {
      const origin = globalThis.location?.origin || "this site";
      if (error?.name === "AbortError") {
        if (options.signal?.aborted) throw error;
        throw new Error(`Ollama at ${endpoint} did not respond before the connection timed out.`);
      }
      if (error instanceof TypeError || /failed to fetch|network/i.test(error?.message || "")) {
        throw new Error(
          `Ollama at ${endpoint} could not be reached from ${origin}. ` +
          `It may be offline or blocking this origin; open Project → Configure AI for setup instructions.`,
        );
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  #compactContext(context) {
    const layers = this.mapController.getLayers().map((layer) => {
      const { title, type, url } = this.mapController.getLayerConfig(layer);
      const metadata = this.mapController.layerMetadata?.(layer);
      const sentinels = (metadata?.sentinels || []).filter((item) => item.source !== "heuristic").map(({ field, value, label }) => ({ field, value, label }));
      return {
        title, type, url,
        ...(metadata?.dataLastEditDate ? { dataLastEditDate: metadata.dataLastEditDate } : {}),
        ...(sentinels.length ? { sentinels } : {}),
      };
    });
    return buildAIMapContext({ ...(context ?? {}), mapExtent: this.mapController.getCurrentExtentDetails?.() ?? null }, layers);
  }

  #readConfig() {
    try {
      return JSON.parse(localStorage.getItem(CONFIG_KEY));
    } catch {
      return null;
    }
  }
}
