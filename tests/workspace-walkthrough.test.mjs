import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
// Pages link relative to themselves; these checks read them as root paths.
import { rootLinksHtml } from "../scripts/relative-links.mjs";
import { BRIEFING_WALKTHROUGH_STEPS, HISTORICAL_QUAKES_BRIEFING_TUTORIAL_STEPS, WALKTHROUGH_STEPS, createExampleWalkthroughSteps, waitForWalkthroughTarget } from '../js/workspace-walkthrough.js';

test('walkthrough has a concise desktop and mobile overview', () => {
  assert.ok(WALKTHROUGH_STEPS.length >= 5 && WALKTHROUGH_STEPS.length <= 10);
  for (const step of WALKTHROUGH_STEPS) {
    assert.ok(step.title && step.description && step.desktop && step.mobile);
  }
  for (const title of ['The map', 'Menus', 'Layers and data', 'Map controls', 'Project and sharing']) {
    assert.ok(WALKTHROUGH_STEPS.some(step => step.title === title));
  }
});

test('examples have a focused walkthrough that connects the map, records, and styling controls', () => {
  const steps = createExampleWalkthroughSteps({ title: 'Earthquakes — past 30 days', description: 'A live global feed.', whyUseful: 'Inspect magnitude and location.' });
  assert.equal(steps.length, 5);
  for (const title of ['Welcome to Earthquakes — past 30 days', 'Read the map', 'Inspect a feature', 'Open the records', 'Make it your own']) {
    assert.ok(steps.some((step) => step.title === title));
  }
  assert.match(steps[0].description, /live global feed/i);
  assert.match(steps.at(-1).description, /Style/);
});

test('map and image service examples skip records and point at the legend instead', () => {
  const steps = createExampleWalkthroughSteps({ title: 'Forest risk', description: 'Projected loss.', serviceType: 'map-image', layers: [{ serviceType: 'map-image' }] });
  assert.equal(steps.length, 5);
  assert.ok(steps.some((step) => step.title === 'Read the legend' && step.desktop === '#utility-legend-content'));
  assert.ok(!steps.some((step) => /table/i.test(step.desktop) || step.title === 'Open the records' || step.title === 'Inspect a feature'), 'a picture layer has no records to open');
  const mixed = createExampleWalkthroughSteps({ title: 'Mixed', serviceType: 'feature', layers: [{ serviceType: 'feature' }, { serviceType: 'map-image' }] });
  assert.ok(mixed.some((step) => step.title === 'Open the records'), 'feature layers keep the records step');
});

test('briefing guide covers the workflow without requiring a loaded dataset', async () => {
  assert.ok(BRIEFING_WALKTHROUGH_STEPS.length >= 5 && BRIEFING_WALKTHROUGH_STEPS.length <= 10);
  for (const title of ['Start with data', 'Try a finished example', 'Choose your features', 'Build your slides', 'Arrange and review', 'Preview and share']) {
    assert.ok(BRIEFING_WALKTHROUGH_STEPS.some(step => step.title === title));
  }
  const ui = await readFile(new URL('../js/ui.js', import.meta.url), 'utf8');
  assert.match(ui, /data-presentation-setup="briefing-guide"/);
  assert.match(ui, /steps: BRIEFING_WALKTHROUGH_STEPS/);
  assert.match(ui, /'Find a dataset'/);
  assert.match(ui, /beforeStep: async \(index, \{ signal \}\)/);
  assert.match(ui, /if \(index < 3\) return true/);
  assert.match(ui, /#openExampleHistoricalQuakesBriefing\(\{ signal, startTutorial = false, present = false, slide = null \}/);
  assert.match(ui, /waitForWalkthroughTarget\(this\.mobileMedia\.matches \? step\.mobile : step\.desktop/);
  assert.match(ui, /index === 3 \? 'features' : 'slides'/);
  assert.match(BRIEFING_WALKTHROUGH_STEPS[2].description, /Next will load/);
});

test('Historical Quakes has a finished-example walkthrough from source to share', async () => {
  assert.equal(HISTORICAL_QUAKES_BRIEFING_TUTORIAL_STEPS.length, 7);
  for (const title of ['Start with the finished briefing', 'Check the source', 'Keep the publisher’s symbols', 'Focus the story', 'Read the slide deck', 'See the seismic pulse', 'Preview, share, and adapt']) {
    assert.ok(HISTORICAL_QUAKES_BRIEFING_TUTORIAL_STEPS.some((step) => step.title === title));
  }
  assert.match(HISTORICAL_QUAKES_BRIEFING_TUTORIAL_STEPS[1].desktop, /utility-source-content/);
  assert.match(HISTORICAL_QUAKES_BRIEFING_TUTORIAL_STEPS[2].desktop, /utility-style-content/);
  assert.match(HISTORICAL_QUAKES_BRIEFING_TUTORIAL_STEPS[3].desktop, /briefing-data-dock__filters/);
  assert.match(HISTORICAL_QUAKES_BRIEFING_TUTORIAL_STEPS[5].desktop, /nth-child\(3\)/);
  assert.match(HISTORICAL_QUAKES_BRIEFING_TUTORIAL_STEPS[5].description, /MapLibre seismic pulse/i);
  const ui = await readFile(new URL('../js/ui.js', import.meta.url), 'utf8');
  assert.match(ui, /HISTORICAL_QUAKES_BRIEFING_TUTORIAL_STEPS/);
  assert.match(ui, /tutorial === "historical-quakes-briefing"/);
  assert.match(ui, /#startHistoricalQuakesBriefingTutorial\(\)/);
  assert.match(ui, /openHistoricalQuakesBriefingExample\(\{ startTutorial = false, present = false, slide = null \} = \{\}\)/);
  assert.match(ui, /data-presentation-setup="example-briefing-tutorial"/);
  assert.match(ui, /Opening the next part of the Historical Quakes briefing/);
  assert.match(ui, /this\.#openLayerSource\(layer\.uid\)/);
  assert.match(ui, /this\.#openSymbologyUtility\(layer\.uid\)/);
  assert.match(ui, /this\.#openBriefingInspector\(\);/);
});

test('walkthrough target waiting resolves on rendering and aborts or times out safely', async () => {
  const saved = { document: globalThis.document, MutationObserver: globalThis.MutationObserver, getComputedStyle: globalThis.getComputedStyle };
  let notify;
  let target = null;
  let disconnected = 0;
  try {
    globalThis.document = { body: {}, querySelectorAll: () => target ? [target] : [] };
    globalThis.MutationObserver = class { constructor(callback) { notify = callback; } observe() {} disconnect() { disconnected++; } };
    globalThis.getComputedStyle = () => ({ visibility: 'visible' });
    const waiting = waitForWalkthroughTarget('.target', { timeout: 100 });
    target = { getClientRects: () => [1] };
    notify();
    assert.equal(await waiting, target);
    target = null;
    const controller = new AbortController();
    const canceled = waitForWalkthroughTarget('.target', { signal: controller.signal, timeout: 100 });
    controller.abort();
    await assert.rejects(canceled, /closed/);
    await assert.rejects(waitForWalkthroughTarget('.target', { timeout: 1 }), /did not become available/);
    assert.equal(disconnected, 3);
  } finally {
    for (const [key, value] of Object.entries(saved)) value === undefined ? delete globalThis[key] : globalThis[key] = value;
  }
});

test('walkthrough can be started from suggestions or the Tools menu', async () => {
  const [ui, html] = await Promise.all([
    readFile(new URL('../js/ui.js', import.meta.url), 'utf8'),
    readFile(new URL('../index.html', import.meta.url), 'utf8').then((html) => rootLinksHtml('index.html', html)),
  ]);
  assert.match(ui, /Walk me through the tools and menus/);
  assert.match(ui, /case "tools-walkthrough"/);
  assert.match(html, /data-action="tools-walkthrough"/);
  assert.match(ui, /#startWorkspaceWalkthrough\(\)\s*\{\s*this\.#dismissWelcome\(\);\s*startWorkspaceWalkthrough/);
  assert.equal((ui.match(/this\.#startWorkspaceWalkthrough\(\)/g) || []).length, 2);
});

test('the compact welcome panel launches the separate discovery experience', async () => {
  const [ui, html, css] = await Promise.all([
    readFile(new URL('../js/ui.js', import.meta.url), 'utf8'),
    readFile(new URL('../index.html', import.meta.url), 'utf8').then((html) => rootLinksHtml('index.html', html)),
    readFile(new URL('../css/app.css', import.meta.url), 'utf8'),
  ]);
  const welcome = html.match(/<section id="welcome-panel"[\s\S]*?<\/section>/)[0];
  assert.equal((welcome.match(/<(?:a|button)\b/g) || []).length, 7); // Dismiss, start, catalog, and four discovery links.
  for (const label of ['Start mapping', 'Explore examples', 'Open starter catalog', 'Learn GISMap', 'Create with AI', 'About GISMap']) assert.ok(welcome.includes(label));
  assert.match(welcome, /data-action="data-popular"/);
  assert.match(welcome, /href="\/discover\/examples\/"/);
  assert.match(welcome, /id="welcome-suppress"/);
  assert.match(ui, /WELCOME_PREFERENCE_KEY = "gismap\.welcome\.v1"/);
  assert.match(ui, /#welcomeIsSharedLaunch\(\)/);
  assert.match(ui, /#welcomeIsExplicitlyRequested\(\)/);
  assert.match(ui, /get\("welcome"\) === "1"/);
  assert.match(ui, /#configureWelcomeStartup\(\)/);
  assert.match(ui, /activateExampleGuide\(example/);
  assert.match(ui, /host\.hidden = suppressed \|\| !context\.layer/);
  assert.match(css, /\.welcome-panel \{[^}]*top: 50%; left: 50%/);
});

test('the workspace rail offers a discoverable welcome toggle after dismissal', async () => {
  const [ui, workspace, css] = await Promise.all([
    readFile(new URL('../js/ui.js', import.meta.url), 'utf8'),
    readFile(new URL('../js/fieldwork-workspace.js', import.meta.url), 'utf8'),
    readFile(new URL('../css/fieldwork.css', import.meta.url), 'utf8'),
  ]);
  assert.match(workspace, /workspace-rail__welcome[^`]*aria-controls="welcome-panel"[^`]*hidden/);
  assert.match(workspace, /welcomeButton\.hidden = !dismissed/);
  assert.match(workspace, /welcome:visibility-changed/);
  assert.match(workspace, /action\('welcome-toggle'\)/);
  assert.match(workspace, /is-introduced/);
  assert.match(css, /\.workspace-rail button\[hidden\] \{ display:none/);
  assert.match(ui, /case "welcome-toggle":[\s\S]*?#toggleWelcome\(\)/);
  assert.match(ui, /panel\.dataset\.reopened = "true"/);
  assert.match(ui, /welcomePanel\.dataset\.reopened !== "true"/);
});
