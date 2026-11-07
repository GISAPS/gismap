import { initializeStudioTabs } from "./studio-tabs.js?v=0.55.0-fieldwork1";
// The Cartography Lab (Tools › Cartography Lab): one panel that combines a
// layer's colour, 3D height and filter, previews them on the map, saves the
// combination as a reusable layer style (js/layer-style.js), and makes an
// interactive map link, briefing slides or a tour from it.
import { RAMPS } from "./renderer-spec.js?v=0.29.1";
import { SPATIAL_CHART_TYPE } from "./spatial-chart.js?v=0.69.9-order";
import { createFilterBuilder } from "./filter-builder.js?v=0.1.0";
import { conditionsToWhere } from "./filter-sql.js?v=0.1.0";
import { describeLayerStyle, layerStyleFileName, layerStyleRankField } from "./layer-style.js?v=0.69.9-order";

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const NUMERIC = /^(?:small-integer|integer|single|double|long|esriFieldTypeSmallInteger|esriFieldTypeInteger|esriFieldTypeSingle|esriFieldTypeDouble|number)$/i;
const isNumeric = (field) => NUMERIC.test(field?.type || "") && !/^(?:oid|esriFieldTypeOID)$/i.test(field?.type || "");
const COLOR_MODES = [
  ["service", "The service's own style"],
  ["single", "One colour"],
  ["categories", "A colour per category"],
  ["classes", "Colour by value (classes)"],
  ["size", "Size by value"],
  ["heatmap", "Heat map"],
];
const CHART_MODES = [
  ["attribute-extrusion", "Height from a value"],
  ["temporal-strata", "Layers by group (strata)"],
  ["stacked-footprints", "Stacked footprints"],
  ["exploded-timeline", "Exploded timeline"],
];
const METHODS = [["natural-breaks", "Natural breaks"], ["quantile", "Quantile"], ["equal-interval", "Equal interval"]];
const LIVE_DELAY = 700;

/** A round multiplier that makes `max` about `target` metres tall. */
export function niceScale(max, target) {
  if (!(max > 0) || !(target > 0)) return 1;
  const raw = target / max;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].find((value) => raw <= value * power * 1.5) ?? 10;
  return Number((step * power).toPrecision(2));
}

export class CartographyLab {
  /**
   * host: { mapController, layers, camera, layerStyles, toast(message), error(message),
   *   filterMemory: Map(uid → { conditions, logic, expression }), openBriefing(briefing), getBriefing(),
   *   createTour(places, { title }) }
   */
  constructor(host) {
    this.host = host;
    this.pane = null;
    this.uid = null;
    this.builder = null;
    this.liveTimer = null;
    this.request = 0;
  }

  /** Lists the styleable layers; with none, says how to add one. */
  #candidates() {
    return this.host.mapController.getLayers().filter((layer) => layer.queryable && Array.isArray(layer.fields) && layer.fields.length);
  }

  render(pane, uid = null) {
    this.pane = pane;
    this.builder?.destroy();
    this.builder = null;
    const candidates = this.#candidates();
    const layer = candidates.find((item) => item.uid === uid) || candidates.find((item) => item.uid === this.uid) || candidates[0];
    this.uid = layer?.uid || null;
    if (!layer) {
      pane.innerHTML = `<div class="workspace-tool cartography-lab"><p class="form-note">Add a feature layer to start styling.</p></div>`;
      return;
    }
    const info = this.host.layers.get(layer.uid) || {};
    const fields = (layer.fields || []).filter((field) => field?.name && !/geometry|blob|raster/i.test(field.type || ""));
    const numeric = fields.filter(isNumeric);
    const polygon = /polygon/i.test(layer.geometryType || "");
    const point = /point/i.test(layer.geometryType || "");
    const can3d = polygon && this.host.mapController.getCapabilities().includes("spatial-chart-3d");
    const renderer = info.renderer || { type: "service" };
    const chart = info.spatialChart || null;
    const colorMode = ({ simple: "single", categories: "categories", choropleth: "classes", "graduated-symbols": "size", heatmap: "heatmap" })[renderer.type] || "service";
    const preferred = numeric.find((field) => !/(?:^|_)(?:id|fid|objectid)$/i.test(field.name))?.name || numeric[0]?.name || "";
    const remembered = this.host.filterMemory?.get(layer.uid);
    const savedFilter = remembered && remembered.expression === (info.where || null) ? remembered : null;
    this.keptWhere = !savedFilter && info.where ? info.where : null;
    const option = (value, label, selected) => `<option value="${escapeHtml(value)}"${value === selected ? " selected" : ""}>${escapeHtml(label)}</option>`;
    const fieldOptions = (list, selected, empty = "") => `${empty ? option("", empty, selected || "") : ""}${list.map((field) => option(field.name, field.alias && field.alias !== field.name ? `${field.alias} (${field.name})` : field.name, selected)).join("")}`;
    const ramps = (selected) => Object.keys(RAMPS).map((name) => option(name, name.replaceAll("-", " "), selected)).join("");
    const groupGuess = chart?.groupBy || fields.find((field) => /year|date|period|season|class|type/i.test(`${field.name} ${field.alias || ""}`))?.name || fields[0]?.name || "";
    // A grouped chart may have no height field (equal slabs); keep it that way.
    const heightField = chart ? chart.height?.field || "" : (["choropleth", "graduated-symbols"].includes(renderer.type) && isNumeric(fields.find((field) => field.name === renderer.field)) ? renderer.field : "") || preferred;
    pane.innerHTML = `<div class="workspace-tool cartography-lab" data-lab>
      <div class="field-grid">
        <label class="field"><span>Layer</span><select data-lab-layer>${candidates.map((item) => option(item.uid, item.title || item.uid, layer.uid)).join("")}</select></label>
        <div class="field"><span>View</span><div class="segmented cartography-lab__dimension" role="group" aria-label="2D or 3D">
          <button type="button" data-lab-dimension="2d" aria-pressed="${!chart}" class="${chart ? "" : "is-active"}">2D map</button>
          <button type="button" data-lab-dimension="3d" aria-pressed="${Boolean(chart)}" class="${chart ? "is-active" : ""}"${can3d ? "" : " disabled"}>3D chart</button>
        </div></div>
      </div>
      ${can3d ? "" : `<p class="form-note">${polygon ? "This map engine does not draw 3D charts. Open the map with the MapLibre or ArcGIS engine." : "3D charts need polygon features; this layer has " + escapeHtml(String(layer.geometryType || "other").toLowerCase()) + " features."}</p>`}

      <nav class="studio-tabs" role="tablist" aria-label="Layer style">
        <button type="button" data-studio-tab="color">Color</button>
        <button type="button" data-studio-tab="height"${chart ? "" : " disabled"} title="Switch to 3D chart to edit height">Height</button>
        <button type="button" data-studio-tab="filter">Filter</button>
        <button type="button" data-studio-tab="effects">Effects</button>
      </nav>
      <section class="cartography-lab__step" data-studio-pane="color" aria-labelledby="lab-colour">
        <h4 id="lab-colour"><span>1</span> Colour</h4>
        <div class="field-grid">
          <label class="field"><span>Colour by</span><select data-lab-color-mode>${COLOR_MODES.filter(([value]) => (value !== "size" || !polygon) && (value !== "heatmap" || point)).map(([value, label]) => option(value, label, colorMode)).join("")}</select></label>
          <label class="field" data-lab-when="field"><span>Field</span><select data-lab-color-field>${fieldOptions(fields, renderer.field || preferred)}</select></label>
          <label class="field" data-lab-when="single size"><span>Colour</span><input type="color" data-lab-color value="${escapeHtml(renderer.color || (colorMode === "size" ? "#d9951e" : "#1b7f6a"))}"></label>
          <label class="field" data-lab-when="single"><span>Outline</span><input type="color" data-lab-outline value="${escapeHtml(renderer.outline || "#ffffff")}"></label>
          <label class="field" data-lab-when="classes size"><span>Palette</span><select data-lab-ramp>${ramps(renderer.ramp || "oranges")}</select></label>
          <label class="field" data-lab-when="classes size"><span>Classes</span><select data-lab-classes>${[3, 4, 5, 6, 7, 8, 9].map((count) => option(String(count), String(count), String(renderer.classes || 5))).join("")}</select></label>
          <label class="field" data-lab-when="classes size"><span>Breaks</span><select data-lab-method>${METHODS.map(([value, label]) => option(value, label, renderer.method || "natural-breaks")).join("")}</select></label>
          <label class="display-checkbox" data-lab-when="classes size"><input type="checkbox" data-lab-reverse${renderer.reverseRamp ? " checked" : ""}> Reverse palette</label>
        </div>
      </section>

      <section class="cartography-lab__step" data-studio-pane="height" data-lab-3d aria-labelledby="lab-height"${chart ? "" : " hidden"}>
        <h4 id="lab-height"><span>2</span> Height <small>3D</small></h4>
        <div class="field-grid">
          <label class="field"><span>Chart</span><select data-lab-chart-mode>${CHART_MODES.map(([value, label]) => option(value, label, chart?.mode || "attribute-extrusion")).join("")}</select></label>
          <label class="field" data-lab-when-chart="grouped"><span>Group by</span><select data-lab-group>${fieldOptions(fields, groupGuess)}</select></label>
          <label class="field"><span data-lab-height-label>Height field</span><select data-lab-height-field>${fieldOptions(numeric, heightField, "None — equal slabs")}</select></label>
          <label class="field" data-lab-when-height><span>Multiplier <small>metres per unit</small></span><span class="cartography-lab__inline"><input type="number" min="0" step="any" data-lab-scale value="${escapeHtml(chart?.height?.scale ?? 1)}"><button type="button" class="link-button" data-lab-auto-scale>Fit to view</button></span></label>
          <label class="field" data-lab-when-chart="grouped"><span>Slot height <small>m</small></span><input type="number" min="1" step="50" data-lab-slot value="${escapeHtml(chart?.height?.slotMeters ?? 400)}"></label>
          <label class="field" data-lab-when-chart="grouped"><span>Gap <small>m</small></span><input type="number" min="0" step="25" data-lab-gap value="${escapeHtml(chart?.height?.gapMeters ?? 100)}"></label>
          <label class="field" data-lab-when-chart="grouped"><span>Slab thickness <small>m</small></span><input type="number" min="1" step="10" data-lab-thickness value="${escapeHtml(chart?.height?.thicknessMeters ?? 120)}"></label>
          <label class="field" data-lab-when-chart="grouped"><span>Stacking order</span><select data-lab-order>${option("ascending", "Lowest at the bottom", chart?.order || "ascending")}${option("descending", "Highest at the bottom", chart?.order || "ascending")}</select></label>
          <label class="display-checkbox"><input type="checkbox" data-lab-ground-outlines${chart?.groundOutlines ? " checked" : ""}><span>Show outlines on the ground</span></label>
          <label class="field" data-lab-when-chart="grouped"><span>Slab colours</span><select data-lab-chart-color>${option("sequential", "One colour per group", chart?.color?.strategy || "sequential")}${option("original", "Keep the layer colors", chart?.color?.strategy || "sequential")}</select></label>
        </div>
        <p class="form-note" data-lab-height-note></p>
      </section>

      <section class="cartography-lab__step" data-studio-pane="filter" aria-labelledby="lab-filter">
        <h4 id="lab-filter"><span data-lab-filter-step>2</span> Filter</h4>
        ${this.keptWhere ? `<p class="form-note cartography-lab__kept">Layer filter: <code>${escapeHtml(this.keptWhere)}</code> <button type="button" class="link-button" data-lab-clear-where>Remove</button></p>` : ""}
        <div data-lab-filter></div>
      </section>

      <section class="cartography-lab__step" data-studio-pane="effects" aria-labelledby="lab-look">
        <h4 id="lab-look"><span data-lab-look-step>3</span> Look</h4>
        <label class="opacity-row"><span>Opacity</span><input type="range" min="0.1" max="1" step="0.05" data-lab-opacity value="${escapeHtml(info.opacity ?? 1)}"><output>${Math.round((info.opacity ?? 1) * 100)}%</output></label>
      </section>
      <div class="cartography-lab__actions"><label class="display-checkbox"><input type="checkbox" data-lab-live checked> Live preview</label><button type="button" class="button--primary" data-lab-apply>Apply style</button><span class="form-note" data-lab-status aria-live="polite"></span></div>

      <section class="cartography-lab__step" aria-labelledby="lab-saved">
        <h4 id="lab-saved">Saved styles <small>for this layer</small></h4>
        <div class="cartography-lab__save"><label class="sr-only" for="lab-style-name">Style name</label><input id="lab-style-name" data-lab-name placeholder="Name this style" maxlength="120"><button type="button" class="button--secondary" data-lab-save>Save style</button></div>
        <ul class="cartography-lab__styles" data-lab-styles></ul>
        <label class="link-button cartography-lab__import">Import a style file…<input type="file" accept=".json,application/json" data-lab-import hidden></label>
      </section>

      <details class="studio-disclosure"><summary>Create &amp; share</summary>
        <div class="cartography-lab__outputs">
          <button type="button" class="button--secondary" data-lab-make="map">Interactive map link</button>
          <button type="button" class="button--secondary" data-lab-make="briefing">Briefing slides</button>
          <span class="cartography-lab__tour" title="Stops are the largest features by the height or colour field, when the style has one."><button type="button" class="button--secondary" data-lab-make="tour">Tour</button><label class="sr-only" for="lab-tour-count">Number of tour stops</label><input id="lab-tour-count" type="number" min="2" max="25" value="5" data-lab-tour-count><span>stops</span></span>
          <button type="button" class="button--secondary" disabled title="Coming soon">2D / 3D vector tiles · coming soon</button>
        </div>
        <div class="cartography-lab__result" data-lab-result aria-live="polite"></div>
      </details>
    </div>`;
    this.fields = fields;
    this.layer = layer;
    this.builder = createFilterBuilder({
      host: pane.querySelector("[data-lab-filter]"),
      fields,
      conditions: savedFilter?.conditions || [],
      logic: savedFilter?.logic || "and",
      addLabel: "Add a filter condition",
      valuesFor: async (name) => (await this.host.mapController.distinctValues(layer, name).catch(() => ({ values: [] }))).values || [],
      onChange: () => this.#scheduleLive(),
    });
    this.styleTabs = initializeStudioTabs(pane, { id: "layer-style" });
    this.#bind();
    this.#sync();
    this.#renderStyles();
  }

  #el(selector) { return this.pane.querySelector(selector); }

  #bind() {
    const pane = this.pane;
    this.#el("[data-lab-layer]").addEventListener("change", (event) => this.render(pane, event.target.value));
    pane.querySelectorAll("[data-lab-dimension]").forEach((button) => button.addEventListener("click", () => this.#setDimension(button.dataset.labDimension)));
    pane.addEventListener("input", (event) => {
      if (event.target.matches("[data-lab-opacity]")) event.target.nextElementSibling.value = `${Math.round(Number(event.target.value) * 100)}%`;
    });
    pane.addEventListener("change", (event) => {
      const target = event.target;
      if (target.closest("[data-lab-filter]") || target.matches("[data-lab-layer], [data-lab-live], [data-lab-name], [data-lab-import], [data-lab-tour-count]")) return;
      if (target.matches("[data-lab-height-field]") && target.value) void this.#autoScale(false);
      this.#sync();
      this.#scheduleLive();
    });
    this.#el("[data-lab-auto-scale]").addEventListener("click", () => void this.#autoScale(true));
    this.#el("[data-lab-clear-where]")?.addEventListener("click", (event) => { this.keptWhere = null; event.target.closest("p").remove(); this.#scheduleLive(); });
    this.#el("[data-lab-apply]").addEventListener("click", () => void this.apply());
    this.#el("[data-lab-save]").addEventListener("click", () => void this.#save());
    this.#el("[data-lab-import]").addEventListener("change", (event) => void this.#import(event.target));
    pane.querySelectorAll("[data-lab-make]").forEach((button) => button.addEventListener("click", () => void this.#make(button.dataset.labMake)));
  }

  #dimension() { return this.#el('[data-lab-dimension="3d"]').classList.contains("is-active") ? "3d" : "2d"; }

  #setDimension(dimension) {
    this.pane.querySelectorAll("[data-lab-dimension]").forEach((button) => {
      const active = button.dataset.labDimension === dimension;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    this.#sync();
    if (dimension === "3d" && !Number(this.#el("[data-lab-scale]").value)) void this.#autoScale(false);
    // Tilt to see heights, and back to flat for a 2D map.
    try {
      const tilt = this.host.camera.get().tilt;
      if (dimension === "3d" && tilt < 40) void this.host.camera.set({ tilt: 60 }).catch(() => {});
      if (dimension === "2d" && tilt > 5) void this.host.camera.set({ tilt: 0 }).catch(() => {});
    } catch { /* The map is not ready. */ }
    this.#scheduleLive(0);
  }

  /** Shows only the controls the current choices use. */
  #sync() {
    const mode = this.#el("[data-lab-color-mode]").value;
    this.pane.querySelectorAll("[data-lab-when]").forEach((control) => {
      const when = control.dataset.labWhen.split(" ");
      control.hidden = !(when.includes(mode) || (when.includes("field") && ["categories", "classes", "size", "heatmap"].includes(mode)));
    });
    // Classes and sizes need numbers; categories take any field.
    const numericOnly = ["classes", "size", "heatmap"].includes(mode);
    const fieldSelect = this.#el("[data-lab-color-field]");
    [...fieldSelect.options].forEach((item) => { item.disabled = numericOnly && !isNumeric(this.fields.find((field) => field.name === item.value)); });
    if (fieldSelect.selectedOptions[0]?.disabled) fieldSelect.value = [...fieldSelect.options].find((item) => !item.disabled)?.value || "";
    const is3d = this.#dimension() === "3d";
    this.#el('[data-studio-tab="height"]').disabled = !is3d;
    this.styleTabs?.refresh();
    this.#el("[data-lab-filter-step]").textContent = is3d ? "3" : "2";
    this.#el("[data-lab-look-step]").textContent = is3d ? "4" : "3";
    const chartMode = this.#el("[data-lab-chart-mode]").value;
    const grouped = chartMode !== "attribute-extrusion";
    this.pane.querySelectorAll('[data-lab-when-chart="grouped"]').forEach((control) => { control.hidden = !grouped; });
    const heightSelect = this.#el("[data-lab-height-field]");
    heightSelect.options[0].disabled = !grouped;
    if (!grouped && !heightSelect.value) heightSelect.value = heightSelect.options[1]?.value || "";
    this.#el("[data-lab-height-label]").textContent = grouped ? "Slab thickness from" : "Height field";
    this.#el("[data-lab-when-height]").hidden = !heightSelect.value;
    this.#el("[data-lab-height-note]").textContent = grouped
      ? "Each group gets its own vertical slot. Height shows order, not real elevation; overlapping footprints are drawn as they are, not merged."
      : "Height is a display value in metres (the field × the multiplier), not real elevation. The legend says what it means.";
  }

  async #autoScale(announce) {
    const field = this.#el("[data-lab-height-field]").value;
    if (!field) return;
    try {
      const values = (await this.host.mapController.fieldValues(this.uid, field)).map(Number).filter(Number.isFinite);
      const max = Math.max(...values);
      // About 4% of the view's width: tall enough to read, short enough to keep the map visible.
      const zoom = this.host.camera.get().zoom ?? 8;
      const scale = niceScale(max, (40_075_000 / 2 ** zoom) * 0.04);
      this.#el("[data-lab-scale]").value = String(scale);
      if (announce) this.#status(`The tallest feature will be about ${Math.round(max * scale).toLocaleString()} m.`);
      this.#scheduleLive();
    } catch (error) { if (announce) this.host.error(error.message); }
  }

  #status(message) { const status = this.#el("[data-lab-status]"); if (status) status.textContent = message; }

  #scheduleLive(delay = LIVE_DELAY) {
    clearTimeout(this.liveTimer);
    if (!this.#el("[data-lab-live]")?.checked) return;
    this.liveTimer = setTimeout(() => void this.apply({ quiet: true }), delay);
  }

  /** The settings as a layers.update patch: where, opacity, renderer and spatialChart. */
  settings() {
    const value = (selector) => this.#el(selector)?.value;
    const mode = value("[data-lab-color-mode]");
    const field = value("[data-lab-color-field]");
    const classed = { field, ramp: value("[data-lab-ramp]"), classes: Number(value("[data-lab-classes]")), method: value("[data-lab-method]"), ...(this.#el("[data-lab-reverse]").checked ? { reverseRamp: true } : {}) };
    const renderer = mode === "single" ? { type: "simple", color: value("[data-lab-color]"), outline: value("[data-lab-outline]") }
      : mode === "categories" ? { type: "categories", field }
      : mode === "classes" ? { type: "choropleth", ...classed }
      : mode === "size" ? { type: "graduated-symbols", ...classed, color: value("[data-lab-color]") }
      : mode === "heatmap" ? { type: "heatmap", ...(field ? { field } : {}) }
      : { type: "service" };
    let spatialChart = null;
    if (this.#dimension() === "3d") {
      const chartMode = value("[data-lab-chart-mode]");
      const grouped = chartMode !== "attribute-extrusion";
      const heightField = value("[data-lab-height-field]");
      const groupBy = value("[data-lab-group]");
      spatialChart = {
        type: SPATIAL_CHART_TYPE,
        mode: chartMode,
        ...(grouped ? { groupBy } : {}),
        ...(grouped && value("[data-lab-order]") === "descending" ? { order: "descending" } : {}),
        ...(this.#el("[data-lab-ground-outlines]")?.checked ? { groundOutlines: true } : {}),
        height: {
          ...(heightField ? { field: heightField } : {}),
          scale: Number(value("[data-lab-scale]")) || 1,
          slotMeters: Number(value("[data-lab-slot]")) || 400,
          gapMeters: Number(value("[data-lab-gap]")) || 0,
          thicknessMeters: Number(value("[data-lab-thickness]")) || 120,
        },
        color: grouped ? { field: groupBy, strategy: value("[data-lab-chart-color]") } : { field: heightField, strategy: "original" },
        geometry: { strategy: "source-footprints", aggregation: "none" },
        interaction: { hover: true, select: true, explode: chartMode === "exploded-timeline", scrubTimeline: ["temporal-strata", "exploded-timeline"].includes(chartMode) },
      };
    }
    const conditions = this.builder?.conditions || [];
    const built = conditionsToWhere(conditions, this.builder?.logic, this.fields);
    const where = [this.keptWhere, built].filter(Boolean).map((part, _, parts) => (parts.length > 1 ? `(${part})` : part)).join(" AND ") || null;
    return {
      renderer,
      spatialChart,
      where,
      filter: conditions.length ? { conditions, logic: this.builder.logic } : null,
      opacity: Number(value("[data-lab-opacity]")) || 1,
    };
  }

  /** Draws the layer with the settings: the filter first, so classes are computed from the filtered features. */
  async apply({ quiet = false } = {}) {
    if (!this.uid) return null;
    const request = ++this.request;
    let settings;
    try { settings = this.settings(); } catch (error) { if (!quiet) this.host.error(error.message); else this.#status(error.message); return null; }
    const before = this.host.layers.get(this.uid);
    this.#status("Updating the map…");
    try {
      if ((before?.where || null) !== settings.where) {
        await this.host.layers.update(this.uid, { where: settings.where || "" });
        await this.host.mapController.loadLayer(this.uid, { allowTruncated: true }).catch(() => null);
        if (settings.filter) this.host.filterMemory?.set(this.uid, { ...settings.filter, expression: settings.where });
        else this.host.filterMemory?.delete(this.uid);
      }
      if (request !== this.request) return null;
      const charts = this.host.mapController.getCapabilities().includes("spatial-chart-3d");
      const info = await this.host.layers.update(this.uid, {
        opacity: settings.opacity,
        renderer: settings.renderer,
        ...(charts ? { spatialChart: settings.spatialChart } : {}),
      });
      if (request === this.request) this.#status(settings.spatialChart ? "Showing the 3D chart. Drag with the right mouse button (or two fingers) to tilt." : "Showing the 2D style.");
      return info;
    } catch (error) {
      if (request === this.request) this.#status("");
      this.host.error(error.message);
      return null;
    }
  }

  /** The current settings as an unsaved style, after drawing them (so class breaks are pinned). */
  async #currentStyle(name) {
    const info = await this.apply();
    if (!info) throw new Error("Fix the settings before saving.");
    const settings = this.settings();
    return this.host.layerStyles.capture(this.uid, { name: name || `${info.title || "Layer"} · ${settings.spatialChart ? "3D" : "2D"}`, filter: settings.filter });
  }

  async #save() {
    const input = this.#el("[data-lab-name]");
    try {
      const style = this.host.layerStyles.save(await this.#currentStyle(input.value.trim()));
      input.value = "";
      this.#renderStyles(style.id);
      this.host.toast(`Saved “${style.name}”. It is kept with the project and in this browser’s style library.`);
    } catch (error) { this.host.error(error.message); }
  }

  #renderStyles(highlight = null) {
    const list = this.#el("[data-lab-styles]");
    if (!list) return;
    const styles = this.host.layerStyles.list(this.uid);
    list.innerHTML = styles.length
      ? styles.map((style) => `<li class="cartography-lab__style${style.id === highlight ? " is-new" : ""}">
          <div><strong>${escapeHtml(style.name)}</strong> <span class="cartography-lab__badge">${style.dimension.toUpperCase()}</span><small>${escapeHtml(describeLayerStyle(style))}</small></div>
          <div class="cartography-lab__style-actions"><button type="button" class="link-button" data-lab-style-apply="${escapeHtml(style.id)}">Apply</button><button type="button" class="link-button" data-lab-style-download="${escapeHtml(style.id)}">Download</button><button type="button" class="link-button" data-lab-style-delete="${escapeHtml(style.id)}" aria-label="Delete ${escapeHtml(style.name)}">Delete</button></div>
        </li>`).join("")
      : '<li class="form-note">No saved styles for this layer yet.</li>';
    list.querySelectorAll("[data-lab-style-apply]").forEach((button) => button.addEventListener("click", () => void this.#applySaved(button.dataset.labStyleApply)));
    list.querySelectorAll("[data-lab-style-download]").forEach((button) => button.addEventListener("click", () => this.#download(button.dataset.labStyleDownload)));
    list.querySelectorAll("[data-lab-style-delete]").forEach((button) => button.addEventListener("click", () => {
      const style = this.host.layerStyles.get(button.dataset.labStyleDelete);
      if (!globalThis.confirm(`Delete the style “${style.name}” from this project and this browser?`)) return;
      this.host.layerStyles.remove(style.id);
      this.#renderStyles();
    }));
  }

  async #applySaved(id, uid = this.uid) {
    try {
      const { style } = await this.host.layerStyles.apply(uid, id);
      if (style.filter) this.host.filterMemory?.set(uid, { ...style.filter, expression: style.where });
      if (style.spatialChart) { try { if (this.host.camera.get().tilt < 40) await this.host.camera.set({ tilt: style.camera?.tilt ?? 60, ...(style.camera?.heading != null ? { heading: style.camera.heading } : {}) }); } catch { /* Not ready. */ } }
      this.render(this.pane, uid);
      this.#status(`Applied “${style.name}”.`);
    } catch (error) { this.host.error(error.message); }
  }

  #download(id) {
    const style = this.host.layerStyles.get(id);
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([this.host.layerStyles.export(id)], { type: "application/json" }));
    link.download = layerStyleFileName(style);
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 5000);
  }

  async #import(input) {
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    try {
      const style = this.host.layerStyles.import(await file.text());
      const sameLayer = this.host.layerStyles.list(this.uid).some((item) => item.id === style.id);
      this.#renderStyles(style.id);
      this.host.toast(sameLayer ? `Imported “${style.name}”.` : `Imported “${style.name}”. It was made for ${style.source.title || style.source.url}; applying it here works when this layer has the same fields.`);
      if (!sameLayer && globalThis.confirm(`Apply “${style.name}” to ${this.layer.title}?`)) await this.#applySaved(style.id);
    } catch (error) { this.host.error(error.message); }
  }

  async #make(kind) {
    const result = this.#el("[data-lab-result]");
    try {
      const style = await this.#currentStyle(this.#el("[data-lab-name]").value.trim());
      if (kind === "map") {
        const link = await this.host.layerStyles.createLink(style);
        result.innerHTML = `<label class="field"><span>Interactive map link</span><input readonly value="${escapeHtml(link.url)}" data-lab-link></label><p class="cartography-lab__inline"><button type="button" class="button--secondary" data-lab-copy>Copy link</button><a class="button--secondary" href="${escapeHtml(link.url)}" target="_blank" rel="noopener">Open in a new tab</a></p><p class="form-note">The link carries the layer, its style${style.spatialChart ? ", the 3D chart" : ""}${style.where ? " and filter" : ""}, and this view. Anyone can open it; no account is needed.</p>`;
        result.querySelector("[data-lab-copy]").addEventListener("click", async () => { await navigator.clipboard?.writeText(link.url); this.host.toast("Link copied."); });
      } else if (kind === "briefing") {
        const existing = this.host.getBriefing?.();
        const briefing = this.host.layerStyles.toBriefing(style, { briefing: existing?.slides?.length ? existing : { title: style.name } });
        await this.host.openBriefing(briefing);
        result.innerHTML = `<p class="form-note">Added ${style.spatialChart ? 3 : 2} slides${existing?.slides?.length ? " to the current briefing" : ""}: a title, the map${style.spatialChart ? " and the 3D view" : ""}. Keep this style applied when presenting; slides switch the 3D chart on and off but use the layer’s colours.</p>`;
      } else if (kind === "tour") {
        await this.#makeTour(style);
        result.innerHTML = "";
      }
    } catch (error) { this.host.error(error.message); }
  }

  async #makeTour(style) {
    const count = Math.min(25, Math.max(2, Number(this.#el("[data-lab-tour-count]").value) || 5));
    const rank = layerStyleRankField(style);
    const layer = this.host.mapController.getLayer(this.uid);
    const label = layer.displayField || this.fields.find((field) => /name|title|label/i.test(field.name))?.name;
    const outFields = [...new Set([layer.objectIdField, label, rank].filter(Boolean))];
    const { features = [] } = await this.host.mapController.queryFeatures(this.uid, { where: layer.where || "1=1", outFields, returnGeometry: true, num: count, ...(rank ? { orderByFields: [`${rank} DESC`] } : {}) });
    const alias = this.fields.find((field) => field.name === rank)?.alias || rank;
    const places = features.map((feature, index) => {
      const point = this.host.mapController.geographicCoordinates(feature.geometry);
      const value = rank ? feature.attributes?.[rank] : null;
      return point && {
        title: String(feature.attributes?.[label] ?? `${layer.title || "Feature"} ${index + 1}`),
        body: value != null ? `${alias}: ${Number.isFinite(Number(value)) ? Number(value).toLocaleString() : value}` : "",
        latitude: point.latitude,
        longitude: point.longitude,
        zoom: 11,
        ...(style.spatialChart ? { tilt: style.camera?.tilt ?? 60 } : {}),
      };
    }).filter(Boolean);
    if (!places.length) throw new Error("No features with locations were found for the tour.");
    this.host.createTour(places, { title: rank ? `Top ${places.length} by ${alias}` : style.name });
  }
}
