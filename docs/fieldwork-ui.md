# Fieldwork interface

This branch implements the Fieldwork brand guide as an update to the existing GISMap Online application. The map engine, project format, service adapters and public API remain the source of truth.

## Workspace

- A 56 px desktop header contains the existing menus, live place search, project name, appearance switch and sharing. Cmd/Ctrl+K focuses search.
- A 52 px rail opens Explore, Layers, Notes & Tasks, Draw, Briefings, Tours and the assistant. Layers is the initial workspace. Selection and dock width persist locally.
- The left dock starts at 372 px including the rail. Drag its edge, or focus the separator and use Left/Right/Home/End, to resize it. Collapsing leaves the rail available.
- Existing mobile routing and bottom sheets remain in use. The live search and menu nodes return to their mobile hosts when the viewport changes; forms and map canvases are not duplicated.
- Zoom, north reset and 2D/3D remain visible. Camera increments, locate, home and basemaps live in a disclosure. Escape closes the camera menu.

## Workflows

- **Add layer:** choose a local file, ArcGIS service, Geo URL or the data catalog.
- **Map Notes:** target and note first; optional metadata and map context use disclosures. Draft/session warnings and validation remain available. The existing right-panel separator handles resizing.
- **Style layer:** Color, Height, Filter and Effects tabs retain input values. Height is enabled for 3D charts. Live preview, apply, saved styles and sharing retain their existing behavior. Advanced style remains available under More layer tools.
- **ArcGIS service:** URL and optional title first; type, refresh and compatibility help under Advanced settings. Connection errors stay outside the disclosure.
- **DuckDB:** Local file, Remote URL and Advanced tabs. Import/load starts the existing runtime on demand. SQL, runtime controls and technical help remain in Advanced. Local data is still cleared on reload.
- Briefing and tour empty-state copy is shorter; their existing authoring workflows remain intact.

## Design system

`css/fieldwork.css` layers semantic surface, text, border, action, focus and map-overlay tokens over the existing skin variables. `gismap` remains the persisted house-skin ID for compatibility. It is labeled Fieldwork / Observatory; Light and Dark select the two reference appearances. New installations start in Fieldwork. Saved appearance preferences and other skins continue to work.

The interface uses Inter for controls, Newsreader for titles and IBM Plex Mono for coordinates. Controls use 36–40 px heights; icon targets are 40 px. Primary actions use a separate foreground token so Observatory does not place white text on pale green. UI palette changes do not replace explicit data renderers. Motion respects the reduced-motion preference.

The Fieldwork 1.1 block at the end of `css/fieldwork.css` completes the token set: the pine/mist/chalk/copper ramp, `--action-primary-hover`/`-pressed`, `--hover-fill`, `--selected-fill`/`--selected-ink`, `--border-strong` (3:1 control boundaries), `--status-*`, `--space-1…6`, `--radius-input/card/sheet` and `--motion-*`. Every former white-on-`--green` control reads `--action-on-primary`, so Observatory keeps 4.5:1 text. View switching (tabs, mobile nav, note modes) uses the selected fill rather than a filled primary button. Metadata is at least 11 px; controls are 13 px. These rules also match before `data-skin` is set, so nothing animates on load.

`js/fieldwork-workspace.js` owns shell composition; it calls existing UI actions and map-controller methods. `js/studio-tabs.js` supplies ARIA relationships, roving focus and arrow/Home/End navigation while keeping form nodes alive.

## Validation

Verified in Chrome at 1440×1000, 1024×768, 800×480 and 390×844, using the public USA Wildfires example:

- Light/dark workspace, camera controls, layer styling and tab input retention.
- Note creation and draft retention across compose/browse views.
- ArcGIS and DuckDB dialogs, remote URL retention, and responsive sheets.
- Keyboard resizing, collapse/reopen, Cmd+K, tab navigation and 2D/3D transitions.
- Briefing entry/return and desktop/mobile/desktop transitions with one live search field.
- No uncaught browser errors during these checks.

Full Node suite: 546 passed, 4 skipped, 6 failed. The same six failures reproduce from an untouched archive of the starting commit (543 passed before the three new tab tests): build-version expectation, menu structure, MapLibre engine boundary, mobile workflow menu, utility modal docking expectation, and the SEO test file. These failures are not introduced by this redesign. Generated-site checks and changed-module syntax checks also pass.

Preview locally with `python3 -m http.server 8080`, then open `http://localhost:8080/`. No deployment is part of this change.
