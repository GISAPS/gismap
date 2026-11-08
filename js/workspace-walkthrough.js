// The workspace orientation is non-destructive; specialized guides may prepare a workspace.
export const WALKTHROUGH_STEPS = [
  { title: 'The map', desktop: '#viewDiv', mobile: '#viewDiv', description: 'Pan and zoom to explore. Select a feature on the map to inspect its details in Map Insight.' },
  { title: 'Menus', desktop: '.studio-header .menu-bar', mobile: '#mobile-menu-toggle', description: 'Project, Data, Map, Modes and Tools bring together saving, data sources, map settings and additional tools.' },
  { title: 'Find a place', desktop: '.studio-header__search', mobile: '[data-mobile-panel="places-panel"]', description: 'Use Places to search for a location and move the map there.' },
  { title: 'Workspaces', desktop: '.workspace-rail', mobile: '.mobile-panel-nav', description: 'Switch between the map, briefing, tours and other workflows. Your map stays available as you work.' },
  { title: 'Layers and data', desktop: '#layers-panel', mobile: '[data-mobile-panel="layers-panel"]', description: 'Layers holds your data. Add services, Geo URLs, local files or examples, then manage visibility, styling and the attribute table.' },
  { title: 'Notes, tasks and drawing', desktop: '.workspace-tabs', mobile: '.mobile-map-tool-strip', description: 'Use Notes & Tasks for observations and field work, and Draw for map annotations. On smaller screens these tools are in the map toolbar and menu.' },
  { title: 'Map controls', desktop: '#map-navigation-toggle', mobile: '#map-navigation-toggle', description: 'Use the map controls to zoom, reset north, switch to 3D and access camera tools. The chevron expands or hides the controls.' },
  { title: 'Project and sharing', desktop: '.studio-header__project', mobile: '#mobile-menu-toggle', description: 'Open Project to manage project details and save or export your work. Share provides the available map-sharing options.' },
  { title: 'Make something', desktop: '.workspace-rail__welcome, #welcome-panel', mobile: '#mobile-menu-toggle', description: 'Open Welcome from the workspace toolbar to start a briefing, tour or dashboard. You can revisit this walkthrough from the Tools menu.' },
];

// Examples are living public datasets, so the first guide concentrates on
// reading the map before suggesting any authoring tools.  It is generated from
// the catalog entry rather than being a one-off page for every example.
export function createExampleWalkthroughSteps(example = {}) {
  const title = String(example.title || "this example");
  const description = String(example.description || "a public dataset prepared for exploration");
  const whyUseful = String(example.whyUseful || "Inspect the source and symbols before drawing conclusions from a live dataset.");
  // A map or image service sends pictures, not features: there are no records to select or tabulate.
  const layers = example.layers?.length ? example.layers : [example];
  if (layers.every((layer) => ["map-image", "imagery"].includes(layer.serviceType || example.serviceType))) return [
    { title: `Welcome to ${title}`, desktop: ".example-guide", mobile: ".example-guide", description: `${description} ${whyUseful}` },
    { title: "Read the map", desktop: "#viewDiv", mobile: "#viewDiv", description: "This layer is a picture the publisher’s server draws for each view, so its colours are the publisher’s own. Zoom in for more detail; the server redraws as you go." },
    { id: "legend", title: "Read the legend", desktop: "#utility-legend-content", mobile: '[data-mobile-panel="layers-panel"]', description: "The Legend shows what each colour means, as published with the service. Map → Legend opens it again later." },
    { title: "Compare and adjust", desktop: '#layers-list .layer-card:first-of-type', mobile: '[data-mobile-panel="layers-panel"]', description: "Use the opacity slider to see the basemap underneath, or add other layers to compare. A picture layer has no records, so Table and filters do not apply." },
    { title: "Share it", desktop: ".studio-share", mobile: "#mobile-menu-toggle", description: "Share sends this map, its view and its layers to someone else as a link." },
  ];
  return [
    { title: `Welcome to ${title}`, desktop: ".example-guide", mobile: ".example-guide", description: `${description} ${whyUseful}` },
    { title: "Read the map", desktop: "#viewDiv", mobile: "#viewDiv", description: "Pan and zoom first. The example’s symbols make the published features easier to scan, but they do not add measurements or change the source data." },
    { title: "Inspect a feature", desktop: "#viewDiv", mobile: "#viewDiv", description: "Select a symbol on the map to see its attributes and location context. Check individual records when a pattern looks important." },
    { title: "Open the records", desktop: '#layers-list .layer-card:first-of-type [data-layer-action="table"]', mobile: '[data-mobile-panel="layers-panel"]', description: "Use Table to browse, sort and inspect the attributes that power this map. Live services can change between visits." },
    { title: "Make it your own", desktop: '#layers-list .layer-card:first-of-type [data-layer-action="style"]', mobile: '[data-mobile-panel="layers-panel"]', description: "Use Style to change the visual treatment, Filter map to focus the data, or Share when you are ready to send this configured map to someone else." },
  ];
}

// The briefing guide loads its example before the hands-on steps.
export const BRIEFING_WALKTHROUGH_STEPS = [
  { title: 'Create a briefing', desktop: '.presentation-empty', mobile: '.presentation-empty', description: 'A briefing combines an interactive map with a sequence of slides. This guide will add example layers and an editable briefing to your project.' },
  { title: 'Start with data', desktop: '[data-presentation-setup="data-popular"]', mobile: '[data-presentation-setup="data-popular"]', description: 'Find a dataset, connect a service, or add a file. Choose a feature layer with the places or events you want to explain.' },
  { title: 'Try a finished example', desktop: '[data-presentation-setup="example-briefing"]', mobile: '[data-presentation-setup="example-briefing"]', description: 'Next will load a filtered Historical Quakes Feature Service with finished slides, moving map views, and a clearly labelled seismic pulse. Existing slides are replaced only with your confirmation.' },
  { title: 'Choose your features', desktop: '#briefing-data-dock:not([hidden]), body:not(.briefing-v2) .briefing-select', mobile: '.briefing-select', description: 'Use the Data panel to search, filter, group, or select features. Use all matching features, or include only those you need.' },
  { title: 'Build your slides', desktop: '.briefing-new-slides, .briefing-slides__add', mobile: '.briefing-slides__add', description: 'Create slides from the map or your selected features, or start with a blank title, map, numbers or actions slide. Choose a slide in the list to edit its content and map view.' },
  { title: 'Arrange and review', desktop: '.briefing-slide-list', mobile: '.briefing-slide-list', description: 'Reorder, duplicate or hide slides in the list. Review each slide’s text, map view and layer visibility before presenting.' },
  { title: 'Preview and share', desktop: '.briefing-data-dock__actions:not([hidden]), body:not(.briefing-v2) .briefing-slides__actions', mobile: '.briefing-slides__actions', description: 'Use Preview slides to play the briefing. Share offers a link, QR code and PDF export. Exit the preview to keep editing.' },
];

// The finished Historical Quakes briefing is deliberately different from the
// blank-briefing guide above. It is a short, read-first walkthrough of the
// working example: where its data comes from, why the publisher renderer is
// preserved, how its M6.5+ scope stays legible, and how the slide deck turns
// those choices into a shareable story.
export const HISTORICAL_QUAKES_BRIEFING_TUTORIAL_STEPS = [
  { title: 'Start with the finished briefing', desktop: '.briefing-slide-list', mobile: '.briefing-slide-list', description: 'This example uses the stable Historical Quakes Feature Service. It is already a complete, editable briefing—not a screenshot or a separate demo.' },
  { title: 'Check the source', desktop: '#utility-source-content .layer-source', mobile: '#utility-source-content .layer-source, [data-mobile-panel="layers-panel"]', description: 'This step opens Source so you can see the publisher endpoint and metadata. The map keeps a direct link to the public Feature Service, so the provenance stays clear.' },
  { title: 'Keep the publisher’s symbols', desktop: '#utility-style-content .workspace-tool', mobile: '#utility-style-content .workspace-tool, [data-mobile-panel="layers-panel"]', description: 'This step opens Style to inspect or adjust the layer. This example starts with the service’s own magnitude renderer, preserving the colors and symbol sizes supplied by the publisher.' },
  { title: 'Focus the story', desktop: '.briefing-data-dock__filters', mobile: '.briefing-data-dock__filters, [data-mobile-panel="layers-panel"]', description: 'The Data controls show the scope of this briefing. Its source layer is already limited to magnitude 6.5 and above, keeping the global pattern readable while leaving the publisher service intact. Use Filter map later when you want to make an additional map filter.' },
  { title: 'Read the slide deck', desktop: '.briefing-slide-list', mobile: '.briefing-slide-list', description: 'The opening slides explain the archive and the source styling. The event slides are ordinary briefing slides, so you can rewrite them, reorder them, or add your own.' },
  { title: 'See the seismic pulse', desktop: '.briefing-slide-list li:nth-child(3) [data-slide-select]', mobile: '.briefing-slide-list li:nth-child(3) [data-slide-select]', description: 'The third slide uses a temporary MapLibre seismic pulse to make the source locations easier to scan. Ring size follows magnitude, but the effect is decorative: it does not model energy, add measurements, or predict earthquakes.' },
  { title: 'Preview, share, and adapt', desktop: '.briefing-data-dock__actions:not([hidden]), body:not(.briefing-v2) .briefing-slides__actions', mobile: '.briefing-slides__actions', description: 'Preview plays the briefing as your audience will see it. From Share, create a link, QR code, PDF, or embed—then return here to adapt the data, map view, and slides for your own story.' },
];

// "Create an animation": a hands-on Cinematic guide. Each step's `prepare`
// (supplied by the app) opens what it points at before the step shows.
export const CINEMATIC_WALKTHROUGH_STEPS = [
  { id: 'layer', title: 'Choose a layer', desktop: '[data-cinematic-layer]', mobile: '[data-cinematic-layer]', description: 'Cinematic mode animates a layer already on your map. Pick the one to bring to life. (If your map had no data, this guide added the USGS past-week earthquakes.)' },
  { id: 'kind', title: 'Choose how it moves', desktop: '[data-cinematic-kind]', mobile: '[data-cinematic-kind]', description: 'Timeline steps through a date field, observation by observation. A number field sweeps through values, lowest first (flood depth, acreage, year built). Nothing needs no field at all: every feature shows and its effect loops.' },
  { id: 'effect', title: 'Pick an effect', desktop: '[data-cinematic-effect]', mobile: '[data-cinematic-effect]', description: 'Auto picks from the layer (flames for fires, pulses for earthquakes, wind, water, flow, glow). Effects decorate the data; they never change it.' },
  { id: 'start', title: 'Start the animation', desktop: '#dialog-actions .button--primary', mobile: '#dialog-actions .button--primary', description: 'Next starts Cinematic mode with these choices. You can change them any time with Change mapping.' },
  { id: 'play', title: 'Play and scrub', desktop: '#cinematic-map-timeline, .cinematic-quick-controls', mobile: '.cinematic-quick-controls', description: 'Play runs the animation; ◀ ▶ step one observation; drag the bar to scrub. Focus flies to what is showing now.' },
  { id: 'tune', title: 'Tune the look', desktop: '.cinematic-controls', mobile: '.cinematic-controls', description: 'Build up keeps earlier records on the map. Speed, terrain, effect, Detail and opacity set the mood. Detail on Auto lightens effects for big scenes so playback stays smooth.' },
  { id: 'dates', title: 'Set the range', desktop: '.cinematic-dates', mobile: '.cinematic-dates', description: 'Play from and to limit playback to part of the data; Go to jumps straight to a date or value. (Ambient animations have no range.)' },
  { id: 'camera', title: 'Frame the shot', desktop: '#map-navigation', mobile: '#map-navigation-toggle', description: 'Move the map to your opening view. 3D tilts the camera over terrain; the camera tools rotate and tilt. A Clip glides between a start and end view you choose.' },
  { id: 'clip', title: 'Save a Clip', desktop: '[data-cinematic-create-clip]', mobile: '[data-cinematic-create-clip]', description: 'Present & export appears with the Present intent. Create Clip saves a reusable recipe: name, length, range, camera start and end, captions and a poster frame.' },
  { id: 'share', title: 'Export or present', desktop: '.cinematic-actions', mobile: '.cinematic-actions', description: 'Export movie renders an MP4 or WebM of exactly the Clip’s length. Add to Brief makes a live slide; Poster PNG and Clip JSON share it elsewhere. That’s it: your animation is ready.' },
];

export function waitForWalkthroughTarget(selector, { signal, timeout = 15000 } = {}) {
  return new Promise((resolve, reject) => {
    let observer, timer;
    const cleanup = () => { observer?.disconnect(); clearTimeout(timer); signal?.removeEventListener('abort', abort); };
    const abort = () => { cleanup(); reject(new Error('Walkthrough closed.')); };
    const check = () => {
      const target = [...document.querySelectorAll(selector)].find(element => element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden');
      if (target) { cleanup(); resolve(target); }
    };
    if (signal?.aborted) return abort();
    observer = new MutationObserver(check);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });
    signal?.addEventListener('abort', abort, { once: true });
    timer = setTimeout(() => { cleanup(); reject(new Error('The briefing controls did not become available. Select Next to try again.')); }, timeout);
    check();
  });
}

export function startWorkspaceWalkthrough({ mobile = () => false, steps = WALKTHROUGH_STEPS, label = 'Workspace walkthrough', beforeStep = null, preparingLabel = 'Preparing the briefing…' } = {}) {
  if (!steps.length) return;
  document.querySelector('.workspace-walkthrough')?.dispatchEvent(new Event('walkthrough:close'));
  const previousFocus = document.activeElement;
  const fallbackFocus = previousFocus?.closest?.('.menu')?.querySelector('.menu__trigger');
  let index = 0;
  let closed = false;
  let pending = false;
  const controller = new AbortController();
  const root = document.createElement('section');
  root.className = 'workspace-walkthrough';
  root.setAttribute('role', 'region');
  root.setAttribute('aria-label', label);
  const highlight = document.createElement('div');
  highlight.className = 'workspace-walkthrough__highlight';
  highlight.setAttribute('aria-hidden', 'true');
  const card = document.createElement('div');
  card.className = 'workspace-walkthrough__card';
  card.innerHTML = '<button class="workspace-walkthrough__close" type="button" aria-label="Close walkthrough">×</button><div class="workspace-walkthrough__content" aria-live="polite"><span class="workspace-walkthrough__count"></span><h2></h2><p></p><p class="workspace-walkthrough__status" role="status" hidden></p></div><div class="workspace-walkthrough__actions"><button type="button" data-walkthrough-back>Back</button><button type="button" data-walkthrough-next>Next</button></div>';
  root.append(highlight, card);
  document.body.append(root);
  const count = card.querySelector('.workspace-walkthrough__count');
  const title = card.querySelector('h2');
  const description = card.querySelector('p');
  const status = card.querySelector('.workspace-walkthrough__status');
  const back = card.querySelector('[data-walkthrough-back]');
  const next = card.querySelector('[data-walkthrough-next]');
  const position = () => {
    const step = steps[index];
    const target = [...document.querySelectorAll(mobile() ? step.mobile : step.desktop)].find(element => element.getClientRects().length);
    const bounds = target?.getBoundingClientRect();
    const visible = bounds && bounds.width && bounds.height && bounds.bottom > 0 && bounds.right > 0 && bounds.top < window.innerHeight && bounds.left < window.innerWidth && getComputedStyle(target).visibility !== 'hidden';
    highlight.hidden = !visible;
    card.classList.toggle('workspace-walkthrough__card--top', Boolean(visible && bounds.bottom > window.innerHeight * .6 && bounds.right > window.innerWidth * .5));
    if (visible) Object.assign(highlight.style, { left: `${Math.max(0, bounds.left - 4)}px`, top: `${Math.max(0, bounds.top - 4)}px`, width: `${Math.min(window.innerWidth, bounds.right + 4) - Math.max(0, bounds.left - 4)}px`, height: `${Math.min(window.innerHeight, bounds.bottom + 4) - Math.max(0, bounds.top - 4)}px` });
  };
  const render = () => {
    const step = steps[index];
    count.textContent = `Step ${index + 1} of ${steps.length}`;
    title.textContent = step.title;
    description.textContent = step.description;
    back.disabled = index === 0;
    next.textContent = index === steps.length - 1 ? 'Done' : 'Next';
    position();
  };
  const close = () => {
    if (closed) return;
    closed = true;
    controller.abort();
    window.removeEventListener('resize', position);
    window.removeEventListener('scroll', position, true);
    document.removeEventListener('keydown', onKey);
    root.remove();
    const focusTarget = previousFocus?.isConnected && previousFocus.getClientRects().length ? previousFocus : fallbackFocus;
    if (focusTarget?.isConnected && typeof focusTarget.focus === 'function') focusTarget.focus();
  };
  const onKey = (event) => { if (event.key === 'Escape') { event.preventDefault(); close(); } };
  const observer = new MutationObserver(() => { if (!closed) requestAnimationFrame(position); });
  observer.observe(document.body, { childList: true, subtree: true });
  controller.signal.addEventListener('abort', () => observer.disconnect(), { once: true });
  root.addEventListener('walkthrough:close', close, { once: true });
  card.querySelector('.workspace-walkthrough__close').addEventListener('click', close);
  const move = async (nextIndex) => {
    if (pending || closed) return;
    status.hidden = true;
    if (beforeStep) {
      pending = true;
      back.disabled = true;
      next.disabled = true;
      status.textContent = preparingLabel;
      status.hidden = false;
      try {
        const ready = await beforeStep(nextIndex, { signal: controller.signal });
        if (closed) return;
        if (ready === false) throw new Error('That step could not be prepared. Select Next to try again.');
      } catch (error) {
        if (closed) return;
        status.textContent = error.message || 'The briefing could not be prepared. Select Next to try again.';
        pending = false;
        back.disabled = index === 0;
        next.disabled = false;
        return;
      }
      pending = false;
      next.disabled = false;
      status.hidden = true;
    }
    index = nextIndex;
    render();
    const step = steps[index];
    [...document.querySelectorAll(mobile() ? step.mobile : step.desktop)].find(element => element.getClientRects().length)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    requestAnimationFrame(position);
  };
  back.addEventListener('click', () => { if (index > 0) void move(index - 1); });
  next.addEventListener('click', () => { if (index === steps.length - 1) close(); else void move(index + 1); });
  window.addEventListener('resize', position);
  window.addEventListener('scroll', position, true);
  document.addEventListener('keydown', onKey);
  render();
  next.focus();
}
