import { basemapsForEngine, basemapEntry } from './basemap-catalog.js?v=0.53.0-gallery1';
import { createWorkspacePreferences } from './workspace-preferences.js?v=2';

// One icon family for the shell; all icon-only buttons also have accessible names.
const paths = {
  explore: '<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15m6-12v15"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5"/>',
  notes: '<path d="M5 3h14v18H5zM8 8h8M8 12h8M8 16h5"/>',
  draw: '<path d="m14 5 5 5M4 20l5-1L20 8a2 2 0 0 0-5-5L4 14Z"/>',
  briefs: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M12 17v4m-4 0h8M7 8h10M7 12h6"/>',
  tours: '<circle cx="6" cy="6" r="3"/><circle cx="18" cy="18" r="3"/><path d="M9 6h6a4 4 0 0 1 0 8H9a4 4 0 0 0-4 4h10"/>',
  cinematic: '<path d="M3 8h18v12H3zM3 8l3-5h3l-3 5m3 0 3-5h3l-3 5m3 0 3-5h3l-3 5M9 12l5 3-5 3z"/>',
  print: '<path d="M7 8V3h10v5M7 17H4v-7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v7h-3M7 14h10v7H7z"/>',
  ai: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/>',
  welcome: '<path d="m3 10 9-7 9 7v10H3zM9 20v-6h6v6"/>',
  settings: '<path d="M4 7h16M4 17h16"/><circle cx="8" cy="7" r="3"/><circle cx="16" cy="17" r="3"/>',
  moon: '<path d="M20 14A8 8 0 0 1 10 4a8 8 0 1 0 10 10Z"/>',
  north: '<path d="m12 3 6 17-6-4-6 4Z"/>',
};
export const workspaceIcon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.explore}</svg>`;
const read = (key, fallback) => { try { return localStorage.getItem(key) || fallback; } catch { return fallback; } };
const save = (key, value) => { try { localStorage.setItem(key, value); } catch { /* Private browsing still works. */ } };
const workspacePanels = { layers: ['layers-panel'], explore: ['places-panel', 'bookmarks-panel', 'intelligence-panel'], notes: ['observations-panel'], draw: ['draw-panel'] };

/** Reuses live controls rather than cloning forms, listeners or map canvases. */
export function initializeFieldworkWorkspace({ ui, action, showSidebar, theme, setPanelVisibility = () => {}, classic = () => false }) {
  const app = document.querySelector('#app');
  const sidebar = document.querySelector('#sidebar');
  const brand = sidebar.querySelector('.brand');
  const menu = sidebar.querySelector('.menu-bar');
  const discover = menu.querySelector('.menu-bar__discover');
  const discoverHome = discover ? (() => {
    const marker = document.createComment('discover control home');
    discover.before(marker);
    return { node: discover, marker };
  })() : null;
  const search = document.querySelector('.place-search-combobox');
  const homes = [brand, menu, search].map(node => { const marker = document.createComment('fieldwork control home'); node.before(marker); return { node, marker }; });
  const header = document.createElement('header');
  header.className = 'studio-header';
  header.setAttribute('aria-label', 'GISMap Online workspace');
  header.innerHTML = '<div class="studio-header__search"></div><button type="button" class="studio-header__project" title="Project details and export"></button><button type="button" class="studio-theme" title="Switch to Observatory" aria-label="Switch to Observatory">' + workspaceIcon('moon') + '</button><button type="button" class="studio-share button--primary">Share</button>';
  const rail = document.createElement('nav');
  rail.className = 'workspace-rail';
  rail.setAttribute('aria-label', 'Workspaces');
  rail.innerHTML = [['explore','Explore'],['layers','Layers'],['notes','Notes & tasks'],['draw','Draw'],['briefs','Briefings'],['tours','Tours'],['cinematic','Cinematic mode'],['print','Print Editor'],['ai','Ask GISMap Online']].map(([id,label]) => `<button type="button" data-workspace="${id}" aria-label="${label}" title="${label}" aria-pressed="false">${workspaceIcon(id)}<span>${label}</span></button>`).join('') + `<button type="button" class="workspace-rail__welcome" aria-label="Open welcome panel" title="Open welcome panel" aria-controls="welcome-panel" aria-expanded="false" hidden>${workspaceIcon('welcome')}<span>Welcome · open anytime</span></button><button type="button" class="workspace-rail__settings" aria-label="Display settings" title="Display settings">${workspaceIcon('settings')}<span>Settings</span></button>`;
  const tabs = document.createElement('nav');
  tabs.className = 'workspace-tabs';
  tabs.setAttribute('aria-label', 'Workspace panels');
  tabs.innerHTML = '<button type="button" data-workspace="layers">Layers</button><button type="button" data-workspace="notes">Notes & tasks</button><button type="button" data-workspace="explore">Explore</button><button type="button" class="workspace-collapse" aria-label="Collapse workspace" title="Collapse workspace">‹</button>';
  sidebar.prepend(tabs);
  const resizer = document.createElement('div');
  resizer.className = 'workspace-resizer';
  resizer.tabIndex = 0; resizer.setAttribute('role', 'separator'); resizer.setAttribute('aria-label', 'Resize workspace'); resizer.setAttribute('aria-orientation', 'vertical');
  sidebar.append(resizer);
  const layerActions = document.createElement('div');
  layerActions.className = 'workspace-layer-actions';
  layerActions.innerHTML = '<span>Your map layers</span>';
  document.querySelector('#layers-panel > .panel__body').prepend(layerActions);
  const basemaps = document.createElement('section');
  basemaps.className = 'workspace-basemaps';
  basemaps.innerHTML = '<label class="field"><span>Basemap</span><select aria-label="Basemap"></select></label>';
  document.querySelector('#layers-panel > .panel__body').append(basemaps);
  const basemapSelect = basemaps.querySelector('select');
  for (const item of basemapsForEngine(ui.mapController.getEngineId())) basemapSelect.add(new Option(item.label, item.id));
  basemapSelect.addEventListener('change', () => Promise.resolve(ui.mapController.setBasemap(basemapSelect.value)).catch(error => ui.error(error.message)));
  const syncBasemap = () => { const id = ui.mapController.getBasemapId(); const entry = basemapEntry(id); basemapSelect.value = [...basemapSelect.options].some(option => option.value === id) ? id : entry?.[ui.mapController.getEngineId()] || ''; };
  ['map:ready','map:basemap-changed'].forEach(event => ui.events.subscribe(event, syncBasemap));
  header.querySelector('.studio-share').addEventListener('click', () => action('share-export'));
  header.querySelector('.studio-header__project').addEventListener('click', () => action('project-details'));
  header.querySelector('.studio-theme').addEventListener('click', theme);
  rail.querySelector('.workspace-rail__settings').addEventListener('click', () => action('tools-display'));
  const welcomeButton = rail.querySelector('.workspace-rail__welcome');
  let welcomeIntroduced = false;
  let welcomeCueTimer;
  const syncWelcome = () => {
    const panel = document.querySelector('#welcome-panel');
    const dismissed = panel?.dataset.dismissed === 'true';
    welcomeButton.hidden = !dismissed;
    welcomeButton.setAttribute('aria-expanded', String(Boolean(panel && !panel.hidden)));
    if (dismissed && !welcomeIntroduced) {
      welcomeIntroduced = true;
      welcomeButton.classList.add('is-introduced');
      clearTimeout(welcomeCueTimer);
      welcomeCueTimer = setTimeout(() => welcomeButton.classList.remove('is-introduced'), 5000);
    }
  };
  welcomeButton.addEventListener('click', () => { welcomeButton.classList.remove('is-introduced'); action('welcome-toggle'); });
  ui.events.subscribe('welcome:visibility-changed', syncWelcome);
  tabs.querySelector('.workspace-collapse').addEventListener('click', () => showSidebar(false));
  document.body.append(header, rail);
  let storage = null;
  try { storage = globalThis.localStorage; } catch { /* Session-only layout. */ }
  const preferences = createWorkspacePreferences(storage, read('gismap:workspace', 'layers'));
  let selected = preferences.snapshot().selected;
  const layoutControls = document.createElement('details');
  layoutControls.className = 'workspace-layout-controls';
  layoutControls.innerHTML = '<summary>Workspace layout</summary><p>Pin panels to keep them visible as you switch workspaces.</p><button type="button" data-layout-restore>Previous workspace</button><button type="button" data-layout-reset>Reset workspace</button>';
  sidebar.querySelector('.sidebar__footer').before(layoutControls);
  const pinButtons = new Map();
  sidebar.querySelectorAll('.sidebar__scroll > .panel').forEach(panel => {
    const summary = panel.querySelector(':scope > summary');
    if (!summary || !Object.values(workspacePanels).flat().includes(panel.id)) return;
    const pin = document.createElement('button');
    pin.type = 'button'; pin.className = 'workspace-pin';
    pin.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path class="workspace-pin__head" d="M16 3 21 8l-3 1-3 5v3l-2 2-8-8 2-2h3l5-3z"/><path d="m9 15-5 5"/></svg>';
    pin.addEventListener('click', event => {
      event.preventDefault(); event.stopPropagation();
      const pinned = preferences.snapshot().pinned.includes(panel.id);
      preferences.pin(panel.id, !pinned);
      if (!pinned) panel.open = true;
      syncPanels();
    });
    summary.append(pin); pinButtons.set(panel.id, pin);
  });
  layoutControls.querySelector('[data-layout-restore]').addEventListener('click', () => {
    if (preferences.restore()) { selected = preferences.snapshot().selected; showSidebar(true); syncPanels(); }
  });
  layoutControls.querySelector('[data-layout-reset]').addEventListener('click', () => {
    preferences.reset(); selected = preferences.snapshot().selected; showSidebar(true); syncPanels();
  });
  const select = id => {
    // Choosing a workspace replaces the introduction, including one reopened from the rail.
    if (document.querySelector('#welcome-panel')?.hidden === false) action('welcome-dismiss');
    if (id === 'ai') { action('tools-assistant'); return; }
    if (id === 'print') { action('export-pdf-editor'); return; }
    if (id === 'briefs' || id === 'tours') {
      document.querySelector(`.desktop-workflows-menu [data-mobile-workflow="${id === 'briefs' ? 'briefing' : 'tours'}"]`)?.click();
      return;
    }
    if (id === 'cinematic') {
      if (app.dataset.presentation === 'cinematic') {
        showSidebar(true);
        document.querySelector('[data-cinematic-play]')?.focus();
      } else action('mode-cinematic');
      return;
    }
    if (!workspacePanels[id]) return;
    // Return from a narrative workspace through its existing router.
    if (app.dataset.presentation && app.dataset.presentation !== 'standard') document.querySelector('.desktop-workflows-menu [data-mobile-workflow="map"]')?.click();
    preferences.select(id); selected = preferences.snapshot().selected; save('gismap:workspace', selected);
    for (const panelId of workspacePanels[id]) if (document.getElementById(panelId)?.classList.contains('is-sidebar-optional-hidden')) setPanelVisibility(panelId, true, false);
    showSidebar(true);
    syncPanels();
    if (id === 'explore') document.querySelector('#place-query')?.focus();
  };
  [rail,tabs].forEach(nav => nav.querySelectorAll('[data-workspace]').forEach(button => button.addEventListener('click', () => select(button.dataset.workspace))));
  function syncPanels() {
    const active = document.body.classList.contains('fieldwork-desktop');
    if (active) document.body.dataset.navigationLayout = 'studio';
    const standard = !app.dataset.presentation || app.dataset.presentation === 'standard';
    const layout = preferences.snapshot();
    sidebar.dataset.workspace = selected;
    const own = workspacePanels[selected].map(id => document.getElementById(id)).filter(Boolean);
    const emptied = own.every(panel => panel.classList.contains('is-sidebar-optional-hidden'));
    sidebar.querySelectorAll('.sidebar__scroll > .panel').forEach(panel => {
      const pinned = layout.pinned.includes(panel.id);
      const visible = workspacePanels[selected].includes(panel.id) || pinned;
      panel.classList.toggle('workspace-hidden', active && standard && !visible);
      if (active && standard && visible && (pinned || emptied)) panel.classList.remove('is-sidebar-optional-hidden');
      if (active && standard && visible && !panel.classList.contains('is-sidebar-optional-hidden')) panel.open = true;
    });
    if (active) syncPanelMenu();
    pinButtons.forEach((button, id) => {
      const pinned = layout.pinned.includes(id);
      const label = sidebar.querySelector(`#${id} > summary > span`)?.textContent || 'panel';
      button.setAttribute('aria-pressed', String(pinned));
      button.setAttribute('aria-label', `${pinned ? 'Unpin' : 'Pin'} ${label}`);
      button.title = `${pinned ? 'Unpin' : 'Pin'} ${label}`;
    });
    layoutControls.querySelector('[data-layout-restore]').disabled = !layout.previous;
    ui.events.publish('context:workspace-changed', { workspace: selected, pinnedPanels: layout.pinned });
    const currentWorkspace = standard ? selected : app.dataset.presentation === 'briefing' ? 'briefs' : app.dataset.presentation === 'atlas' ? 'tours' : app.dataset.presentation === 'cinematic' ? 'cinematic' : '';
    [rail,tabs].forEach(nav => nav.querySelectorAll('[data-workspace]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.workspace === currentWorkspace))));
  }
  const sync = () => {
    // Classic mode keeps the pre-Fieldwork desktop layout: sidebar brand, menu bar and search.
    const active = !ui.mobileMedia.matches && app.dataset.applicationLayout !== 'globe' && !classic();
    document.body.classList.toggle('fieldwork-desktop', active);
    header.hidden = rail.hidden = tabs.hidden = resizer.hidden = !active;
    if (active) {
      header.prepend(brand, menu);
      header.querySelector('.studio-header__search').append(search);
      if (discoverHome) header.querySelector('.studio-share').before(discoverHome.node);
    } else {
      if (discoverHome) discoverHome.marker.after(discoverHome.node);
      homes.forEach(({node,marker}) => marker.after(node));
    }
    syncPanels();
    if (!active) syncPanelMenu(false);
    requestAnimationFrame(() => ui.mapController.resize());
  };
  ui.mobileMedia.addEventListener('change', sync);
  new MutationObserver(sync).observe(app, { attributes: true, attributeFilter: ['data-application-layout','data-presentation'] });
  const syncProject = () => { header.querySelector('.studio-header__project').textContent = document.querySelector('#project-name').textContent; };
  new MutationObserver(syncProject).observe(document.querySelector('#project-name'), { childList: true, subtree: true, characterData: true });
  const syncTheme = () => {
    const dark = document.documentElement.dataset.theme === 'dark';
    const button = header.querySelector('.studio-theme');
    const house = (document.documentElement.dataset.skin || 'gismap') === 'gismap';
    button.title = button.ariaLabel = house ? `Switch to ${dark ? 'Fieldwork' : 'Observatory'}` : `Switch to ${dark ? 'light' : 'dark'} mode`;
    button.setAttribute('aria-pressed', String(dark));
  };
  new MutationObserver(syncTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme','data-skin'] });
  const setWidth = value => {
    const width = Math.max(320, Math.min(480, window.innerWidth * .4, value));
    document.body.style.setProperty('--workspace-width', `${width}px`);
    resizer.setAttribute('aria-valuenow', String(Math.round(width)));
    resizer.setAttribute('aria-valuemin','320'); resizer.setAttribute('aria-valuemax',String(Math.min(480, Math.floor(window.innerWidth * .4))));
    save('gismap:workspace-width', String(width)); ui.mapController.resize();
  };
  setWidth(Number(read('gismap:workspace-width', '372')) || 372);
  resizer.addEventListener('pointerdown', event => { resizer.setPointerCapture(event.pointerId); });
  resizer.addEventListener('pointermove', event => { if (resizer.hasPointerCapture(event.pointerId)) setWidth(event.clientX); });
  resizer.addEventListener('pointerup', event => { if (resizer.hasPointerCapture(event.pointerId)) resizer.releasePointerCapture(event.pointerId); });
  resizer.addEventListener('keydown', event => { if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return; event.preventDefault(); const width = sidebar.getBoundingClientRect().width; setWidth(event.key === 'Home' ? 320 : event.key === 'End' ? 480 : width + (event.key === 'ArrowRight' ? 16 : -16)); });
  document.addEventListener('keydown', event => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k' && document.body.classList.contains('fieldwork-desktop')) { event.preventDefault(); document.querySelector('#place-query').focus(); }
    if (event.key === 'Escape') document.querySelectorAll('.map-camera-menu[open]').forEach(menu => { menu.open = false; menu.querySelector('summary').focus(); });
  });
  const dimension = document.querySelector('[data-camera-dimension]');
  const syncDimension = () => { const is3d = (ui.mapController.getViewState()?.tilt || 0) > 5; dimension.textContent = is3d ? '2D' : '3D'; dimension.title = dimension.ariaLabel = `Switch to ${is3d ? '2D' : '3D'} view`; dimension.setAttribute('aria-pressed', String(is3d)); };
  dimension.addEventListener('click', () => ui.mapController.setView({ tilt: (ui.mapController.getViewState()?.tilt || 0) > 5 ? 0 : 55 }, { animate: !matchMedia('(prefers-reduced-motion: reduce)').matches }).catch(error => ui.error(error.message)));
  ['view:stationary','map:ready'].forEach(event => ui.events.subscribe(event, syncDimension));
  syncProject(); syncTheme(); syncWelcome(); sync();
  // The Modes → Panels controls act on what the side panel shows: a panel from
  // another workspace is pinned here; one from this workspace is hidden in place.
  function panelShown(id) {
    const panel = document.getElementById(id);
    return Boolean(panel && !panel.hidden && !panel.classList.contains('workspace-hidden') && !panel.classList.contains('is-sidebar-optional-hidden'));
  }
  // On desktop, place search lives in the header; the Places panel only holds recent places.
  function syncPanelMenu(active = true) {
    document.querySelectorAll('[data-sidebar-panel-toggle]').forEach(button => {
      const id = button.dataset.sidebarPanelToggle;
      if (id === 'places-panel') {
        if (active) { button.dataset.mobileLabel ||= button.textContent; button.textContent = 'Search places'; button.removeAttribute('aria-pressed'); }
        else if (button.dataset.mobileLabel) { button.textContent = button.dataset.mobileLabel; delete button.dataset.mobileLabel; }
        return;
      }
      // Phones use the optional-panel model, so labels follow that flag there.
      const shown = active ? panelShown(id) && !document.body.classList.contains('sidebar-collapsed') : !document.getElementById(id)?.classList.contains('is-sidebar-optional-hidden');
      button.textContent = button.textContent.replace(/^(Add|Hide|Show) /, shown ? 'Hide ' : 'Add ');
      button.setAttribute('aria-pressed', String(shown));
    });
  }
  function togglePanel(id) {
    const panel = document.getElementById(id);
    if (!panel) return;
    if (id === 'places-panel') { showSidebar(true); document.querySelector('#place-query')?.focus(); return; }
    const pinned = preferences.snapshot().pinned.includes(id);
    if (panelShown(id) && !document.body.classList.contains('sidebar-collapsed')) {
      const others = [...sidebar.querySelectorAll('.sidebar__scroll > .panel')].filter(other => other.id !== id && other.id !== 'places-panel' && panelShown(other.id));
      if (pinned) preferences.pin(id, false);
      // Hiding the last visible panel would leave an empty dock; collapse it instead.
      if (!others.length && !pinned) { showSidebar(false); syncPanelMenu(); return; }
      if (workspacePanels[selected].includes(id) || !pinned) setPanelVisibility(id, false);
      syncPanels();
      return;
    }
    if (app.dataset.presentation && app.dataset.presentation !== 'standard') document.querySelector('.desktop-workflows-menu [data-mobile-workflow="map"]')?.click();
    if (!workspacePanels[selected].includes(id)) preferences.pin(id, true);
    setPanelVisibility(id, true);
    showSidebar(true);
    syncPanels();
    panel.open = true;
    requestAnimationFrame(() => panel.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }));
  }
  menu.querySelector('.desktop-workflows-menu > .menu__trigger')?.addEventListener('click', () => syncPanelMenu(document.body.classList.contains('fieldwork-desktop')));
  return { select, syncPanels, togglePanel, refresh: sync, layout: () => preferences.snapshot() };
}
