import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { EventBus } from '../js/events.js';
import { IdentifyController } from '../js/identify.js';

function setup() {
  const events = new EventBus();
  let center = [10, 20];
  let resolveIdentify;
  const map = {
    getViewState: () => ({ center }),
    identify: () => new Promise((resolve) => { resolveIdentify = resolve; }),
    reverseGeocode: async () => ({ address: 'Example' }),
  };
  const identify = new IdentifyController(events, map); identify.initialize();
  const emitted = [];
  for (const name of ['identify:start', 'identify:complete', 'identify:cleared', 'insight:distance-exceeded']) events.subscribe(name, (payload) => emitted.push({ name, payload }));
  return { events, identify, emitted, setCenter: (value) => { center = value; }, complete: () => resolveIdentify([{ kind: 'feature', layerTitle: 'Places', attributes: { OBJECTID: 1 } }]) };
}
const click = { mapPoint: { longitude: 10, latitude: 20 }, x: 1, y: 1 };

test('panning clears only Intelligence and preserves an already completed Map Insight', async () => {
  const f = setup(); const request = f.identify.identify(click); f.complete(); await request;
  const original = f.emitted.find((event) => event.name === 'identify:complete').payload;
  f.setCenter([11, 20]); f.events.publish('view:stationary');
  assert.deepEqual(f.emitted.at(-1), { name: 'identify:cleared', payload: { scope: 'intelligence' } });
  assert.equal(original.results[0].attributes.OBJECTID, 1);
  const ui = await readFile(new URL('../js/ui.js', import.meta.url), 'utf8');
  const handler = ui.split('this.events.subscribe("identify:cleared", () => {')[1].split('this.events.subscribe("insight:distance-exceeded"')[0];
  assert.doesNotMatch(handler, /lastInsight\s*=|selectedInsightIndexes\.clear|clearFeatureHighlight|clearClickMarker|setInsightsOpen|clearInsightIsolation/);
  assert.match(handler, /this\.intelligenceInsight = null/);
});
test('a delayed identify still completes for Map Insight, but not for Intelligence after pan', async () => {
  const f = setup(); const request = f.identify.identify(click);
  f.setCenter([11, 20]); f.events.publish('view:stationary'); f.complete(); await request;
  const result = f.emitted.find((event) => event.name === 'identify:complete').payload;
  assert.equal(result.intelligenceCurrent, false);
  assert.equal(result.results.length, 1);
});
test('zoom or wrapped longitude without a pan does not clear Intelligence', async () => {
  const f = setup(); const request = f.identify.identify(click); f.complete(); await request;
  f.setCenter([370, 20]); f.events.publish('view:stationary');
  f.setCenter([10 + 1e-8, 20]); f.events.publish('view:stationary');
  assert.equal(f.emitted.filter((event) => event.name === 'identify:cleared').length, 0);
});

test('Map Insight closes only beyond its configured distance; disabling keeps it open', async () => {
  const f = setup(); const request = f.identify.identify(click); f.complete(); await request;
  f.events.publish('display:insight-dismiss-distance', { miles: 100 });
  f.setCenter([11, 20]); f.events.publish('view:stationary');
  assert.equal(f.emitted.filter((e) => e.name === 'insight:distance-exceeded').length, 0);
  f.setCenter([12, 20]); f.events.publish('view:stationary');
  assert.equal(f.emitted.filter((e) => e.name === 'insight:distance-exceeded').length, 1);
  const g = setup(); const next = g.identify.identify(click); g.complete(); await next;
  g.events.publish('display:insight-dismiss-distance', { miles: null });
  g.setCenter([50, 20]); g.events.publish('view:stationary');
  assert.equal(g.emitted.filter((e) => e.name === 'insight:distance-exceeded').length, 0);
});
test('feature-tab navigation keeps Map Insight open and reanchors its threshold', async () => {
  const f = setup(); const request = f.identify.identify(click); f.complete(); await request;
  f.events.publish('insight:navigation-start'); f.setCenter([50, 20]); f.events.publish('view:stationary');
  f.events.publish('insight:navigation-end'); f.events.publish('view:stationary');
  assert.equal(f.emitted.filter((e) => e.name === 'insight:distance-exceeded').length, 0);
  f.setCenter([53, 20]); f.events.publish('view:stationary');
  assert.equal(f.emitted.filter((e) => e.name === 'insight:distance-exceeded').length, 1);
});
test('late results after exceeding the limit do not reopen Map Insight', async () => {
  const f = setup(); const request = f.identify.identify(click);
  f.setCenter([40, 20]); f.events.publish('view:stationary'); f.complete(); await request;
  const result = f.emitted.find((event) => event.name === 'identify:complete').payload;
  assert.equal(result.intelligenceCurrent, false); assert.equal(result.insightCurrent, false);
});

test('menus organize existing actions and clearly mark unimplemented tools', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const menu = (name) => html.match(new RegExp(`<button class="menu__trigger" aria-expanded="false">${name}(?: <span>⌄</span>)?</button>[\\s\\S]*?<div class="menu__content" role="menu">([\\s\\S]*?)</div>`))[1];
  const project = menu('Project'), data = menu('Data'), map = menu('Map'), modes = menu('Modes'), tools = menu('Tools');
  assert.doesNotMatch(project, /tools-display|tools-connections|tools-ai|tools-custom/);
  assert.doesNotMatch(data, /data-duckdb|data-postgis/);
  assert.doesNotMatch(map, /tools-display|data-sidebar-panel-toggle/);
  assert.match(modes, /Panels/);
  for (const id of ['tools-display', 'places-panel', 'bookmarks-panel', 'draw-panel', 'intelligence-panel', 'layers-panel', 'data-panel-workspace', 'data-panel-top-nav']) assert.ok(modes.includes(id), id);
  for (const label of ['AI tools', 'Database tools', 'Map tools', 'Servers', 'Games', 'Custom tools']) assert.ok(tools.includes(label));
  for (const id of ['tools-assistant', 'tools-ai', 'data-duckdb', 'data-postgis', 'tools-connections', 'game-dragons', 'tools-custom']) assert.ok(tools.includes(id));
  assert.match(tools, /disabled[^>]*>Analysis assistant/);
  assert.match(tools, /data-action="tools-connections">Add a Server/);
});

test('suppressed Map Insight overlays still complete and render Intelligence', async () => {
  const ui = await readFile(new URL('../js/ui.js', import.meta.url), 'utf8');
  const handler = ui.split('this.events.subscribe("identify:complete", (payload) => {').at(-1).split('this.events.subscribe("identify:cleared"')[0];
  const assignment = handler.indexOf('this.intelligenceInsight = payload.intelligenceCurrent === false ? null : payload');
  const reset = handler.indexOf('this.identifyPending = false');
  const notes = handler.indexOf('this.dataMapNotesOpen');
  assert.ok(assignment >= 0 && assignment < notes);
  assert.ok(reset >= 0 && reset < notes);
  assert.match(handler, /this\.mapNotesModeActive[\s\S]*?this\.#renderIntelligenceContents\(\);[\s\S]*?this\.#setInsightsOpen\(false\)/);
  assert.match(handler, /field-task-picking[\s\S]*?this\.#renderIntelligenceContents\(\);[\s\S]*?this\.#setInsightsOpen\(false\)/);
});

test('identify errors clear the Intelligence loading indicator', async () => {
  const ui = await readFile(new URL('../js/ui.js', import.meta.url), 'utf8');
  const handler = ui.split('this.events.subscribe("identify:error", ({ error }) => {')[1].split('this.events.subscribe("ai:configured"')[0];
  assert.match(handler, /this\.identifyPending = false/);
  assert.match(handler, /this\.#renderIntelligenceContents\(\)/);
});
