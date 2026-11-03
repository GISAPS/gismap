import test from "node:test";
import assert from "node:assert/strict";
import { ApplicationState } from "../js/application-state.js";
import { PanelRegistry, ToolRegistry } from "../js/application-registry.js";
import { APPLICATION_PRESETS, migratePresentationToApplication, normalizeApplicationConfig, presetApplication } from "../js/application-config.js";
import { normalizeDataCatalog, planNaturalLanguageQuery, validateReadOnlySQL } from "../js/data-catalog.js";
import { ProjectManager } from "../js/project.js";

test("selection is independent from project filters", () => {
  const state = new ApplicationState();
  state.dispatch("filters:set", { id: "chart:range", owner: "chart-1", layerId: "air", scope: "project", expression: { where: "value > 10" } });
  state.dispatch("selection:set", { layerId: "air", objectIds: [42], features: [{ attributes: { value: 11 } }] });
  assert.equal(Object.keys(state.value.filters).length, 1);
  assert.deepEqual(state.value.selection.objectIds, [42]);
});

test("unmount cleanup removes only temporary panel-local filters", () => {
  const state = new ApplicationState();
  state.dispatch("filters:set", { id: "local", owner: "chart-1", scope: "panel", temporary: true, expression: {} });
  state.dispatch("filters:set", { id: "shared", owner: "chart-1", scope: "project", expression: {} });
  state.releasePanel("chart-1");
  assert.equal(state.value.filters.local, undefined);
  assert.ok(state.value.filters.shared);
});

test("panel registry supports multiple instances and runs cleanup", () => {
  const registry = new PanelRegistry();
  let cleaned = 0;
  registry.register({ type: "chart", displayName: "Chart", placements: ["right"], mount: (_host, context) => context.onCleanup(() => cleaned += 1) });
  const host = { append() {}, ownerDocument: null };
  registry.mount({ instanceId: "chart-a", type: "chart", placement: { region: "right" } }, host);
  registry.mount({ instanceId: "chart-b", type: "chart", placement: { region: "right" } }, host);
  assert.ok(registry.getInstance("chart-a"));
  assert.ok(registry.getInstance("chart-b"));
  registry.unmountAll();
  assert.equal(cleaned, 2);
});

test("tool registry validates operations before execution", async () => {
  const registry = new ToolRegistry();
  registry.register({ id: "filter", displayName: "Filter", validate: (input) => input.field ? true : "field required", execute: (input) => input.field });
  await assert.rejects(() => registry.execute("filter", {}), /field required/);
  assert.equal(await registry.execute("filter", { field: "value" }), "value");
});

test("presets use one schema and retain independent chart instances", () => {
  for (const id of Object.keys(APPLICATION_PRESETS)) {
    const config = presetApplication(id);
    assert.equal(config.schemaVersion, 1);
    assert.equal(config.preset, id);
    assert.ok(config.panels.length > 0);
  }
  const explorer = presetApplication("explorer");
  explorer.panels.push({ ...structuredClone(explorer.panels.find((panel) => panel.type === "charts")), instanceId: "chart-second", title: "Second", settings: { field: "other" } });
  const normalized = normalizeApplicationConfig(explorer);
  assert.equal(normalized.panels.filter((panel) => panel.type === "charts").length, 2);
  assert.notDeepEqual(normalized.panels.at(-1).settings, normalized.panels.find((panel) => panel.type === "charts").settings);
});

test("AI Map and dock layouts retain independent persisted placement state", () => {
  const aiMap = presetApplication("ai-map");
  assert.equal(aiMap.layout.kind, "ai-map");
  assert.deepEqual(aiMap.panels.map((panel) => panel.type), ["ai-chatbot"]);
  const normalized = normalizeApplicationConfig({
    ...aiMap,
    layout: { kind: "bottom-workspace", bottomHeight: 418, activeBottomPanel: "ai-map-main", bottomCollapsed: true },
    panels: [{ ...aiMap.panels[0], placement: { region: "floating", order: 0, size: { width: 512, height: 384 }, position: { x: 91, y: 73 } } }],
  });
  assert.deepEqual(normalized.layout, { kind: "bottom-workspace", bottomHeight: 418, activeBottomPanel: "ai-map-main", bottomCollapsed: true, sidebar: "application" });
  assert.equal(normalizeApplicationConfig({ layout: { sidebar: "workspace" } }).layout.sidebar, "workspace");
  assert.deepEqual(normalized.panels[0].placement.size, { width: 512, height: 384 });
  assert.deepEqual(normalized.panels[0].placement.position, { x: 91, y: 73 });
});

test("operations board is a distinct three-region dashboard preset", () => {
  const operations = presetApplication("operations");
  assert.equal(operations.layout.kind, "bottom-workspace");
  assert.deepEqual(new Set(operations.panels.map((panel) => panel.placement.region)), new Set(["left", "right", "bottom"]));
});

test("orbital globe is a first-class dashboard preset", () => {
  const globe = presetApplication("globe");
  assert.equal(globe.layout.kind, "globe");
  assert.equal(globe.skin, "velvet-orbit");
  assert.deepEqual(new Set(globe.panels.map((panel) => panel.placement.region)), new Set(["left", "right"]));
});

test("old projects migrate to Standard and legacy Atlas chapters are retained", () => {
  assert.equal(migratePresentationToApplication({ layers: [] }).preset, "standard");
  const atlas = migratePresentationToApplication({ presentation: { template: "atlas", title: "Places", chapters: [{ title: "One", view: { zoom: 4 } }] } });
  assert.equal(atlas.preset, "atlas");
  assert.equal(atlas.title, "Places");
  assert.equal(atlas.panels.find((panel) => panel.type === "chapters").settings.chapters[0].title, "One");
});

test("Atlas chapter settings normalize safely without activating configurable panels", () => {
  const events = { publish() {} };
  const map = { getDefaultBasemapId: () => "topo-3d" };
  const manager = new ProjectManager(events, map);
  manager.current.application = presetApplication("atlas");
  const presentation = manager.setPresentation({
    template: "atlas",
    playbackMode: "manual",
    tourDefaults: { transitionMode: "instant", lingerSeconds: 999, heading: 999, tilt: -1 },
    chapters: [{
      title: "One",
      mediaUrl: "javascript:alert(1)",
      lingerSeconds: 999,
      transitionMode: "instant",
      layerVisibility: [{ key: "url:https://example.com/layer", visible: false }],
    }],
  });
  assert.equal(presentation.playbackMode, "manual");
  assert.deepEqual(presentation.tourDefaults, { transitionMode: "instant", lingerSeconds: 120, heading: 360, tilt: 0 });
  assert.equal(presentation.chapters[0].mediaUrl, "");
  assert.equal(presentation.chapters[0].lingerSeconds, 120);
  assert.equal(presentation.chapters[0].transitionMode, "instant");
  assert.deepEqual(presentation.chapters[0].layerVisibility, [{ key: "url:https://example.com/layer", visible: false }]);
  assert.equal(manager.current.application, null);
  const configured = manager.setApplication(presetApplication("standard"));
  assert.equal(configured.configured, true);
});

test("cinematic presentation stores a versioned layer reference without dataset bytes", () => {
  const manager = new ProjectManager({ publish() {} }, { getDefaultBasemapId: () => "topo-3d" });
  const presentation = manager.setPresentation({
    template: "cinematic",
    cinematic: { title: "Observed boundary", layers: [{ layerRef: "layer-1", temporal: { startField: "observed_at", featureIdField: "OBJECTID" } }] },
  });
  assert.equal(presentation.template, "cinematic");
  assert.equal(presentation.cinematic.layers[0].layerRef, "layer-1");
  assert.equal(presentation.cinematic.layers[0].temporal.startField, "observed_at");
});

test("unknown panel configuration survives normalization for repair UI", () => {
  const config = normalizeApplicationConfig({ preset: "custom", panels: [{ instanceId: "future-1", type: "timeline-replay", title: "Replay", settings: { speed: 2 }, placement: { region: "right", order: 0 } }] });
  assert.equal(config.panels[0].type, "timeline-replay");
  assert.deepEqual(config.panels[0].settings, { speed: 2 });
});

test("application configurations never serialize credentials", () => {
  const config = normalizeApplicationConfig({ preset: "explorer", token: "secret", panels: [{ instanceId: "a", type: "attributes", placement: { region: "right", order: 0 }, settings: { field: "value" } }] });
  assert.equal(config.token, undefined);
  assert.equal(JSON.stringify(config).includes("secret"), false);
});

test("catalog manifests keep stable relation metadata without credentials", () => {
  const catalog = normalizeDataCatalog({
    version: "2026-10-08",
    token: "never-store-this",
    relations: [{ name: "observations", source: { format: "parquet", url: "https://example.com/data.parquet" }, schema: [{ name: "value", type: "DOUBLE", unit: "µg/m³" }] }],
  });
  assert.equal(catalog.relations[0].name, "observations");
  assert.equal(catalog.relations[0].schema[0].unit, "µg/m³");
  assert.equal(JSON.stringify(catalog).includes("never-store-this"), false);
});

test("SQL workspace accepts one read-only query and rejects executable catalog changes", () => {
  assert.equal(validateReadOnlySQL("SELECT * FROM observations LIMIT 10;"), "SELECT * FROM observations LIMIT 10");
  assert.throws(() => validateReadOnlySQL("ATTACH 'https://example.com/catalog.duckdb' AS remote"), /Only read-only/);
  assert.throws(() => validateReadOnlySQL("SELECT 1; DROP TABLE observations"), /not permitted|one read-only/);
});

test("natural-language requests compile into reviewable SQL and optional map filters", () => {
  const catalog = normalizeDataCatalog({ relations: [{ name: "observations", source: { format: "json", layerId: "air" }, schema: [{ name: "value", type: "DOUBLE" }] }] });
  const plan = planNaturalLanguageQuery("Show observations where value is above 10", catalog);
  assert.match(plan.sql, /"value" > 10/);
  assert.equal(plan.filter.layerId, "air");
  assert.equal(plan.filter.value, 10);
});
