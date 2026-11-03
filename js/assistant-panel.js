// The Map assistant's chat panel: the conversation, each map action the model
// takes (shown as it happens), and the box to ask. The engine is
// js/map-assistant.js; the model call is AIController.chat (js/ai.js).
import { buildAssistantInstructions, runAssistantTurn } from "./map-assistant.js?v=0.68.0-charts1";
import { renderMarkdown } from "./markdown.js?v=0.18.2";

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const PROVIDER_NAMES = { ollama: "Ollama", openai: "OpenAI", anthropic: "Anthropic", "openai-compatible": "your AI endpoint" };
const MAX_HISTORY = 40;

// What a first-time user can try: a short label, and the fuller request it sends.
const STARTERS = [
  { label: "Map U.S. corn sales by county", prompt: "Map U.S. corn sales by county from https://services.arcgis.com/P3ePLMYs2RVChkJx/ArcGIS/rest/services/Corn/FeatureServer/0 on a gray basemap, keeping undisclosed counties out of the colours." },
  { label: "Show current U.S. wildfires and brief me", prompt: "Show current U.S. wildfire incidents and draft a short briefing about them." },
  { label: "A guided tour of five ballparks", prompt: "Add the Major League Baseball Stadiums layer (https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/Major_League_Baseball_Stadiums/FeatureServer/0) and make a guided tour of its five largest ballparks by capacity, tilted for a 3D look, with a short caption at each from the layer's data." },
  { label: "Draft a field task for features on the map", prompt: "Draft a field task to check three features of the main layer on the map, with a short checklist." },
];

/** What a tool call did, in a few words, for the conversation. */
export function describeToolCall(call, result, ok) {
  const args = call.arguments || {};
  if (!ok) return `${call.name.replaceAll("_", " ")} failed: ${result?.error || "error"}`;
  switch (call.name) {
    case "get_map_state": return "Read the map";
    case "inspect_source": return `Read ${result?.title || "the source"}'s fields${result?.fields ? ` (${result.fields.length})` : ""}`;
    case "search_datasets": return `Searched datasets for “${args.query}” (${Array.isArray(result) ? result.length : 0} found)`;
    case "add_layer": return `Added ${result?.title || "a layer"}`;
    case "update_layer": return `Updated ${result?.title || args.layer}`;
    case "remove_layer": return `Removed ${args.layer}`;
    case "query_features": return `Read ${Array.isArray(result) ? result.length : 0} features${args.orderBy ? ` by ${args.orderBy}` : ""}`;
    case "suggest_styles": return `Compared styles for ${result?.field || args.field || "a field"}`;
    case "set_view": return "Moved the map";
    case "set_basemap": return `Changed the basemap to ${args.basemap}`;
    case "load_map": return `Opened a map with ${result?.layers?.length ?? 0} layer${result?.layers?.length === 1 ? "" : "s"}${result?.issues?.length ? ` (${result.issues.length} issue${result.issues.length === 1 ? "" : "s"})` : ""}`;
    case "create_briefing": return `Made a briefing of ${result?.slides?.length ?? 0} slides`;
    case "generate_briefing": return `Drafted a briefing of ${result?.slides?.length ?? 0} slides`;
    case "present_briefing": return "Started presenting the briefing";
    case "create_tour": return `Made a tour of ${result?.chapters?.length ?? 0} places`;
    case "draft_field_task": return `Drafted the field task “${args.title}”`;
    case "get_share_link": return "Made a share link";
    default: return call.name;
  }
}

export class MapAssistantPanel {
  /**
   * `ai`: the AIController. `tools()`: the tool handlers (map-assistant.js
   * createAssistantTools). `state()`: the map summary for the instructions.
   * `configure()`: opens the AI settings.
   */
  constructor({ ai, tools, state, configure }) {
    Object.assign(this, { ai, getTools: tools, getState: state, configure });
    this.history = [];
    this.entries = [];
    this.busy = false;
    this.controller = null;
    this.host = null;
  }

  mount(host) {
    this.host = host;
    this.render();
  }

  render() {
    const host = this.host;
    if (!host) return;
    const config = this.ai.config;
    if (!this.ai.isConfigured()) {
      host.innerHTML = `<section class="assistant"><div class="assistant__setup"><span class="eyebrow">Map assistant</span><h3>Chat with your map</h3><p>Ask for a map, a briefing, a guided tour or a field task, and the assistant builds it with your data. It uses the AI model you connect: Ollama on your computer, or OpenAI, Anthropic or another provider with your own key.</p><button type="button" class="button--primary" data-assistant-configure>Connect an AI model</button></div></section>`;
      host.querySelector("[data-assistant-configure]").addEventListener("click", () => this.configure());
      return;
    }
    const provider = PROVIDER_NAMES[config.provider] || config.provider;
    host.innerHTML = `<section class="assistant">
      <header class="assistant__head"><div><span class="eyebrow">Map assistant</span><small>${escapeHtml(provider)} · ${escapeHtml(config.model)}</small></div><button type="button" class="link-button" data-assistant-new${this.entries.length ? "" : " hidden"}>New chat</button></header>
      <div class="assistant__log" data-assistant-log aria-live="polite"></div>
      <form class="assistant__form" data-assistant-form>
        <label class="sr-only" for="assistant-input">Message the Map assistant</label>
        <textarea id="assistant-input" rows="3" data-assistant-input placeholder="Ask for a map, a briefing, a tour or a field task…"></textarea>
        <div class="assistant__actions"><button type="submit" class="button--primary" data-assistant-send>Send</button><button type="button" data-assistant-stop hidden>Stop</button></div>
      </form>
      <p class="assistant__note">Your messages, the map's layers and the results of map actions go to ${escapeHtml(provider)}. <button type="button" class="link-button" data-assistant-configure>AI settings</button></p>
    </section>`;
    this.#renderLog();
    const form = host.querySelector("[data-assistant-form]");
    const input = host.querySelector("[data-assistant-input]");
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const text = input.value.trim();
      if (!text || this.busy) return;
      input.value = "";
      void this.send(text);
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
        event.preventDefault();
        form.requestSubmit();
      }
    });
    host.querySelector("[data-assistant-stop]").addEventListener("click", () => this.controller?.abort());
    host.querySelector("[data-assistant-new]").addEventListener("click", () => this.reset());
    host.querySelector("[data-assistant-configure]").addEventListener("click", () => this.configure());
    this.#syncBusy();
  }

  reset() {
    this.controller?.abort();
    this.history = [];
    this.entries = [];
    this.render();
  }

  async send(text) {
    const start = this.history.length;
    this.history.push({ role: "user", content: text });
    this.entries.push({ kind: "user", text });
    this.busy = true;
    this.controller = new AbortController();
    const { signal } = this.controller;
    this.#renderLog();
    this.#syncBusy();
    const tools = this.getTools();
    try {
      await runAssistantTurn({
        messages: this.history,
        signal,
        call: (messages) => this.ai.chat(messages, { instructions: (textTools) => buildAssistantInstructions({ state: this.#safeState(), textTools }), signal }),
        execute: async (name, args) => {
          const handler = tools[name];
          if (!handler) throw Object.assign(new Error(`There is no tool named ${name}.`), { hint: "Use one of the listed tools." });
          return handler(args);
        },
        onEvent: (event) => {
          if (event.type === "assistant" && event.content) this.entries.push({ kind: "assistant", text: event.content });
          if (event.type === "tool-start") this.entries.push({ kind: "tool", id: event.call.id, call: event.call, pending: true });
          if (event.type === "tool-end") {
            const entry = this.entries.find((item) => item.kind === "tool" && item.id === event.call.id);
            if (entry) Object.assign(entry, { pending: false, ok: event.ok, result: event.result });
          }
          this.#renderLog();
        },
      });
    } catch (error) {
      this.entries.push(error?.name === "AbortError" ? { kind: "note", text: "Stopped." } : { kind: "error", text: error.message });
      // A turn cut short is dropped from what the model sees (no half-answered tool calls);
      // whatever it changed on the map reaches the model with the next turn's map state.
      this.history.length = start;
    } finally {
      this.busy = false;
      this.controller = null;
      this.#trimHistory();
      this.#renderLog();
      this.#syncBusy();
    }
  }

  #safeState() {
    try { return this.getState(); } catch { return null; }
  }

  // Older turns are dropped whole (from a user message on), so tool calls and results stay paired.
  #trimHistory() {
    while (this.history.length > MAX_HISTORY) {
      const next = this.history.findIndex((message, index) => index > 0 && message.role === "user");
      if (next < 0) break;
      this.history.splice(0, next);
    }
  }

  #syncBusy() {
    const host = this.host;
    if (!host) return;
    const send = host.querySelector("[data-assistant-send]");
    const stop = host.querySelector("[data-assistant-stop]");
    const fresh = host.querySelector("[data-assistant-new]");
    if (send) send.disabled = this.busy;
    if (stop) stop.hidden = !this.busy;
    if (fresh) fresh.hidden = !this.entries.length;
  }

  #renderLog() {
    const log = this.host?.querySelector("[data-assistant-log]");
    if (!log) return;
    if (!this.entries.length) {
      log.innerHTML = `<div class="assistant__empty"><p>Ask for a map, a briefing, a guided tour or a field task. The assistant reads your data first, then builds it on the map, and you can keep refining it.</p><div class="assistant__starters">${STARTERS.map((starter, index) => `<button type="button" data-assistant-starter="${index}" title="${escapeHtml(starter.prompt)}">${escapeHtml(starter.label)}</button>`).join("")}</div></div>`;
      log.querySelectorAll("[data-assistant-starter]").forEach((button) => button.addEventListener("click", () => {
        if (!this.busy) void this.send(STARTERS[Number(button.dataset.assistantStarter)].prompt);
      }));
      return;
    }
    log.innerHTML = this.entries.map((entry) => {
      if (entry.kind === "user") return `<div class="assistant__message assistant__message--user">${escapeHtml(entry.text)}</div>`;
      if (entry.kind === "assistant") return `<div class="assistant__message assistant__message--assistant">${renderMarkdown(entry.text)}</div>`;
      if (entry.kind === "tool") {
        const label = entry.pending ? `${entry.call.name.replaceAll("_", " ")}…` : describeToolCall(entry.call, entry.result, entry.ok);
        const detail = entry.pending ? "" : `<pre>${escapeHtml(JSON.stringify({ arguments: entry.call.arguments, result: entry.result }, null, 2).slice(0, 4000))}</pre>`;
        return `<details class="assistant__tool${entry.pending ? " is-pending" : entry.ok ? " is-done" : " is-failed"}"><summary><span aria-hidden="true">${entry.pending ? "◌" : entry.ok ? "✓" : "!"}</span> ${escapeHtml(label)}</summary>${detail}</details>`;
      }
      return `<div class="assistant__message assistant__message--${entry.kind === "error" ? "error" : "note"}">${escapeHtml(entry.text)}</div>`;
    }).join("") + (this.busy && !this.entries.at(-1)?.pending ? `<div class="assistant__thinking" role="status">Thinking…</div>` : "");
    log.scrollTop = log.scrollHeight;
  }
}
