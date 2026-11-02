// The in-page `mapSpec` namespace: applies a map-v1 spec to the live map
// through the `layers` and `camera` APIs, and exports the current map as one.
// Issues (from the schema, and from loading: a misspelled field, a service that
// will not load) are collected so describe() and the issues panel can show them.
import { MAP_SPEC_VERSION, createMapSpecLink, decodeMapSpec, encodeMapSpec, prepareMapVerification, validateMapSpec } from "./map-spec.js?v=0.66.0-analysis1";
import { GisMapError, toGisMapError } from "./gismap-errors.js?v=0.54.0-print";
import { basemapEntry, basemapLabel, basemapOnEngine } from "./basemap-catalog.js?v=0.53.0-gallery1";

const within = (promise, seconds) => Promise.race([promise, new Promise((resolve) => setTimeout(resolve, seconds * 1000))]);

/**
 * host: { setBasemap(id), applySkin(id), setTitle(text), showLegend(), showIssues(issues), loadBriefing(doc) }
 * issues: the shared list describe() reports (replaced on each load).
 */
export function createMapSpecApi({ layers, camera, mapController, analysis = null, host = {}, issues = [], allowHttp = false }) {
  const popups = new Map();

  /**
   * Applies a spec. Returns { valid, issues, spec, ready } at once; `ready`
   * resolves with { layers, issues } when everything that can load has loaded.
   * The map opens with whatever is valid; problems are listed in `issues`.
   * `replace` (default true) removes the current data layers first.
   */
  function load(input, { replace = true, showIssues = true } = {}) {
    const { valid, issues: found, spec } = validateMapSpec(input, { allowHttp });
    issues.splice(0, issues.length, ...found);
    const ready = (async () => {
      if (!spec) throw new GisMapError("INVALID_SPEC", found[0]?.message || "The map spec cannot be used.", { details: { issues: found } });
      if (replace) layers.list().forEach((layer) => layers.remove(layer.id));
      if (spec.basemap) {
        host.setBasemap?.(spec.basemap);
        // Vector stand-ins are close enough; imagery replaced by a street map is not.
        const engineId = mapController?.getEngineId?.();
        const shown = engineId ? basemapOnEngine(spec.basemap, engineId) : spec.basemap;
        if (basemapEntry(spec.basemap)?.group === "Imagery" && basemapEntry(shown)?.group !== "Imagery") {
          issues.push({ level: "warning", code: "INVALID_SPEC", path: "basemap", message: `${basemapLabel(spec.basemap)} imagery is not available on the ${engineId} engine; ${basemapLabel(shown)} is shown instead.`, hint: engineId === "maplibre" ? "Use usgs-imagery for aerial imagery in the United States, or open the link with ?engine=arcgis." : undefined });
        }
      }
      if (spec.skin) host.applySkin?.(spec.skin);
      if (spec.title) host.setTitle?.(spec.title);
      const loaded = [];
      for (const [index, entry] of spec.layers.entries()) {
        const path = `layers[${index}]`;
        let info;
        try {
          info = await layers.add(entry.url, {
            type: entry.type,
            title: entry.title,
            where: entry.where,
            opacity: entry.opacity,
            visible: entry.visible,
            ignoreServiceScaleRange: entry.ignoreServiceScaleRange,
            refreshInterval: entry.refreshInterval,
            // A chart goes on after the style (below): restyling a layer ends its chart on some engines.
            spatialChart: entry.renderer ? undefined : entry.spatialChart,
            scene3d: entry.scene3d,
            zoomTo: false,
          });
        } catch (error) {
          const problem = toGisMapError(error, "LAYER_LOAD_FAILED");
          issues.push({ level: "error", code: problem.code, path, message: `${entry.title || entry.url}: ${problem.message}`, hint: problem.hint });
          continue;
        }
        // The style is applied once the layer's fields are known; a bad field keeps the service's style.
        if (entry.renderer) {
          try {
            info = await layers.update(info.id, { renderer: entry.renderer });
          } catch (error) {
            const problem = toGisMapError(error, "INVALID_SPEC");
            issues.push({ level: "error", code: problem.code, path: `${path}.renderer`, message: `${problem.message} The service's own style is shown instead.`, hint: problem.hint });
          }
          if (entry.spatialChart) {
            try { info = await layers.update(info.id, { spatialChart: entry.spatialChart }); } catch (error) {
              const problem = toGisMapError(error, "INVALID_SPEC");
              issues.push({ level: "warning", code: problem.code, path: `${path}.spatialChart`, message: `${problem.message} The 3D chart was not drawn.` });
            }
          }
        }
        // A decorative animated effect (MapLibre); another engine shows the layer without it.
        if (entry.animatedEffect) {
          try { info = await layers.update(info.id, { animatedEffect: entry.animatedEffect }); } catch (error) {
            const problem = toGisMapError(error, "UNSUPPORTED");
            issues.push({ level: "warning", code: problem.code, path: `${path}.animatedEffect`, message: `${problem.message} The layer is shown without its animated effect.` });
          }
        }
        if (entry.popup) popups.set(info.id, entry.popup);
        loaded.push(info);
      }
      for (const [index, step] of (spec.analysis || []).entries()) {
        const source = (value) => Number.isInteger(value) ? spec.layers[value] && loaded.find((item) => item.url === spec.layers[value].url)?.id : value;
        try {
          await analysis?.run(step.operation, { ...step, input: source(step.input), overlay: source(step.overlay) });
        } catch (error) {
          issues.push({ level: "warning", code: "INVALID_SPEC", path: `analysis[${index}]`, message: `${step.operation}: ${error.message}` });
        }
      }
      if (spec.camera?.center) {
        await within(camera.set(spec.camera, { animate: false }).catch(() => null), 8);
      } else if (spec.camera?.fit !== "none" && loaded.length) {
        await within(layers.zoomTo(null, { animate: false }).catch(() => null), 8);
      }
      if (spec.legend) host.showLegend?.();
      if (spec.briefing) {
        try { await host.loadBriefing?.(spec.briefing); } catch (error) {
          const problem = toGisMapError(error, "INVALID_SPEC");
          issues.push({ level: "warning", code: problem.code, path: "briefing", message: problem.message });
        }
      }
      if (showIssues && issues.some((item) => item.level === "error")) host.showIssues?.(issues.slice());
      return { layers: layers.list(), issues: issues.slice() };
    })();
    ready.catch(() => {});
    return { valid, issues: found, spec, ready };
  }

  /** The current map as a map-v1 spec (styles set in GISMap included; service styles left to the service). */
  function fromCurrent({ title = host.getTitle?.() || "" } = {}) {
    const spec = { version: MAP_SPEC_VERSION };
    if (title) spec.title = title;
    const basemap = mapController.getBasemapId?.();
    if (basemap) spec.basemap = basemap;
    const skin = host.getSkin?.();
    if (skin) spec.skin = skin;
    try {
      const current = camera.get();
      spec.camera = { center: current.center, zoom: current.zoom, heading: current.heading, tilt: current.tilt };
    } catch {
      spec.camera = { fit: "layers" };
    }
    spec.layers = layers.list().filter((layer) => layer.url && !/^blob:/.test(layer.url)).map((layer) => ({
      url: layer.url,
      type: layer.type,
      title: layer.title,
      ...(layer.where ? { where: layer.where } : {}),
      ...(layer.renderer && layer.renderer.type !== "service" ? { renderer: layer.renderer } : {}),
      ...(layer.spatialChart ? { spatialChart: layer.spatialChart } : {}),
      ...(layer.animatedEffect ? { animatedEffect: layer.animatedEffect } : {}),
      ...(layer.scene3d ? { scene3d: layer.scene3d } : {}),
      ...(layer.opacity < 1 ? { opacity: layer.opacity } : {}),
      ...(layer.visible === false ? { visible: false } : {}),
      ...(layer.ignoreServiceScaleRange ? { ignoreServiceScaleRange: true } : {}),
      ...(popups.has(layer.id) ? { popup: popups.get(layer.id) } : {}),
    }));
    const briefing = host.getBriefing?.();
    if (briefing?.slides?.length) spec.briefing = briefing;
    return spec;
  }

  return Object.freeze({
    validate: (spec) => validateMapSpec(spec, { allowHttp }),
    prepareVerification: (spec, options = {}) => prepareMapVerification(spec, { baseUrl: globalThis.location?.href || "https://gismap.online/", ...options, allowHttp }),
    encode: encodeMapSpec,
    decode: decodeMapSpec,
    createLink: (spec, options = {}) => createMapSpecLink(spec, { baseUrl: globalThis.location?.href || "https://gismap.online/", ...options }),
    load,
    fromCurrent,
    /** Issues from the last load (also in describe().state.issues). */
    issues: () => issues.slice(),
  });
}
