// The in-page `layerStyles` namespace: saved layer styles (js/layer-style.js)
// kept with the project and in a library in this browser, applied through the
// layers API so a style looks the same however it is applied.
import { GisMapError, toGisMapError } from "./gismap-errors.js?v=0.54.0-print";
import { LAYER_STYLE_TYPE, LAYER_STYLE_VERSION, layerStyleBriefing, layerStyleFromLayer, layerStyleMapSpec, mergeLayerStyles, normalizeLayerStyle, stylesForSource } from "./layer-style.js?v=0.69.9-order";

const LIBRARY_KEY = "gismap-online:layer-styles:v1";

// Stored styles keep their own timestamps; ones that no longer validate are skipped.
const valid = (list) => (Array.isArray(list) ? list : []).flatMap((item) => {
  try { return [normalizeLayerStyle(item, { now: new Date(Date.parse(item.updatedAt) || Date.now()) })]; } catch { return []; }
});

function readLibrary(storage) {
  try { return valid(JSON.parse(storage?.getItem(LIBRARY_KEY) || "[]")); } catch { return []; }
}

/**
 * project: { get(): style[], set(styles) } — the project's saved styles.
 * spatialCharts(): whether the engine draws 3D spatial charts.
 */
export function createLayerStylesApi({ layers, camera, mapSpec, project, spatialCharts = () => true, basemap = () => null, storage = globalThis.localStorage, events = null }) {
  const all = () => mergeLayerStyles(valid(project.get()), readLibrary(storage));
  const find = (styleOrId) => {
    if (styleOrId && typeof styleOrId === "object") return normalizeLayerStyle(styleOrId, { now: new Date(Date.parse(styleOrId.updatedAt) || Date.now()) });
    const style = all().find((item) => item.id === styleOrId);
    if (!style) throw new GisMapError("INVALID_SPEC", `No saved layer style has the id "${styleOrId}".`, { hint: "Use an id from layerStyles.list()." });
    return style;
  };
  const writeLibrary = (styles) => {
    try { storage?.setItem(LIBRARY_KEY, JSON.stringify(styles)); } catch { /* The project copy is kept. */ }
  };
  const changed = () => events?.publish?.("layer-styles:changed", { count: all().length });

  return Object.freeze({
    /** Saved styles, newest first; with a layer (id, URL or title), only the styles made for its source. */
    list(layerKey = null) {
      const styles = all();
      if (layerKey == null) return styles;
      const info = layers.get(String(layerKey));
      return stylesForSource(styles, info?.url || layerKey);
    },
    get: (id) => find(id),
    /** A style from how a layer is drawn now: its renderer, 3D chart, filter and opacity. Not saved until save(). */
    capture(layerKey, { name, description, filter, includeCamera = true, id } = {}) {
      const info = layers.get(String(layerKey));
      if (!info) throw new GisMapError("NOT_FOUND", `No layer on the map matches "${layerKey}".`);
      let view = null;
      try { view = camera.get(); } catch { /* Not ready. */ }
      return layerStyleFromLayer(info, { name, description, filter, id, camera: includeCamera && info.spatialChart && view ? { tilt: Math.round(view.tilt), heading: Math.round(view.heading) } : null });
    },
    /** Saves a style to the project and to this browser's style library; returns it. */
    save(input) {
      let style;
      try { style = normalizeLayerStyle({ type: LAYER_STYLE_TYPE, version: LAYER_STYLE_VERSION, ...input }); } catch (error) { throw toGisMapError(error, "INVALID_SPEC"); }
      project.set(mergeLayerStyles([style], project.get().filter((item) => item.id !== style.id)));
      writeLibrary(mergeLayerStyles([style], readLibrary(storage).filter((item) => item.id !== style.id)));
      changed();
      return style;
    },
    remove(id) {
      const before = all().length;
      project.set(project.get().filter((item) => item.id !== id));
      writeLibrary(readLibrary(storage).filter((item) => item.id !== id));
      changed();
      return all().length < before;
    },
    /** Draws a layer with a style (saved id or style object): filter, opacity, renderer, then the 3D chart. */
    async apply(layerKey, styleOrId) {
      const style = find(styleOrId);
      const info = layers.get(String(layerKey));
      if (!info) throw new GisMapError("NOT_FOUND", `No layer on the map matches "${layerKey}".`);
      if (style.spatialChart && !spatialCharts()) throw new GisMapError("UNSUPPORTED_LAYER_TYPE", "This map engine does not draw 3D spatial charts.", { hint: "Open the map with the MapLibre or ArcGIS engine." });
      const patch = {
        where: style.where || "",
        opacity: style.opacity,
        renderer: style.renderer || { type: "service" },
        ...(style.spatialChart || (info.spatialChart && spatialCharts()) ? { spatialChart: style.spatialChart } : {}),
      };
      const result = await layers.update(info.id, patch);
      return { layer: result, style };
    },
    /** A map-v1 spec of the layer drawn with the style, framed on the current view. */
    toMapSpec(styleOrId, { title } = {}) {
      const style = find(styleOrId);
      let view = null;
      try { view = camera.get(); } catch { /* Not ready. */ }
      const info = layers.list().find((item) => item.url && item.url.replace(/\/+$/, "").toLowerCase() === style.source.url.replace(/\/+$/, "").toLowerCase());
      return layerStyleMapSpec(style, { title, basemap: basemap(), camera: view, type: info?.type });
    },
    /** A shareable #map=json: link for the style (mapSpec.createLink). */
    async createLink(styleOrId, options = {}) {
      return mapSpec.createLink(this.toMapSpec(styleOrId, options), options);
    },
    /** Briefing slides for the style (title, flat map, and 3D when it has a chart), added to `briefing`. */
    toBriefing(styleOrId, { briefing } = {}) {
      const style = find(styleOrId);
      let view = null;
      try { view = camera.get(); } catch { /* Not ready. */ }
      return layerStyleBriefing(style, { briefing, camera: view ? { center: view.center, zoom: view.zoom, heading: view.heading, tilt: view.tilt } : null });
    },
    /** The style as a .gismap-style.json file's text. */
    export: (id) => JSON.stringify({ $schema: "https://gismap.online/schemas/layer-style-v1.schema.json", ...find(id) }, null, 2),
    /** Reads a style file's text (or object) and saves it. */
    import(input) {
      let parsed = input;
      if (typeof input === "string") {
        try { parsed = JSON.parse(input); } catch { throw new GisMapError("INVALID_SPEC", "The style file is not valid JSON."); }
      }
      const { $schema, ...style } = parsed || {};
      return this.save(style);
    },
  });
}
