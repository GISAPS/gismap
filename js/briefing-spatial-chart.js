import { createSlide, normalizeBriefing } from "./briefing-document.js?v=0.61.0-briefing-player";
import { normalizeSpatialChart, spatialChartAxis } from "./spatial-chart.js?v=0.69.9-order";

const MAX_NEW_SLIDES = 5;

/** Five-scene narrative that reuses the same portable spatialChart configuration as the map. */
export function generateSpatialChartBrief({ briefing = {}, layerRef, camera, fields = [], records = [], geometryType = "polygon", groupBy, heightField, slotMeters = 400, gapMeters = 100, scale = 1 } = {}) {
  const document = normalizeBriefing(briefing);
  if (document.slides.length + MAX_NEW_SLIDES > 60) throw new Error("The 3D Spatial Chart template needs five available slide slots.");
  const values = records.map((record) => record.attributes?.[groupBy]);
  const common = { type: "spatial-3d-chart", groupBy, groups: values, height: { slotMeters, gapMeters, scale }, geometry: { strategy: "source-footprints", aggregation: "none" } };
  const attribute = normalizeSpatialChart({ ...common, mode: "attribute-extrusion", height: { ...common.height, field: heightField } }, { fields, geometryType });
  const history = normalizeSpatialChart({ ...common, mode: "temporal-strata" }, { fields, geometryType, groupValues: values });
  const accumulation = normalizeSpatialChart({ ...common, mode: "stacked-footprints", height: { ...common.height, ...(heightField ? { field: heightField } : {}) } }, { fields, geometryType, groupValues: values });
  const make = (title, markdown, spatialChart, view = camera) => {
    const slide = createSlide("map-narrative", { title, camera: view });
    slide.blocks[0].markdown = markdown;
    slide.spatialChart = spatialChart;
    slide.generatedBy = { template: "spatial-3d-chart", version: 1, stage: title.toLowerCase().replace(/\W+/g, "-").replace(/^-|-$/g, ""), layer: layerRef };
    return slide;
  };
  const overview = make("Overview", "Original geographic footprints provide the flat spatial context before height is introduced.", null, { ...camera, tilt: 0 });
  const magnitude = make("Magnitude", `Height represents **${heightField}**. ${spatialChartAxis(attribute).detail}`, attribute, { ...camera, tilt: Math.max(55, camera?.tilt || 0) });
  const chronology = make("History", `Features occupy equal Z slots ordered by **${groupBy}**. Vertical position represents order, not magnitude.`, history, { ...camera, tilt: Math.max(60, camera?.tilt || 0) });
  const stacked = make("Accumulation", `Original footprints are shown as ordered slabs where overlaps remain visible. This is fast display mode, not an exact union or polygon-overlay calculation.`, accumulation, { ...camera, tilt: Math.max(65, camera?.tilt || 0), heading: (camera?.heading || 0) + 25 });
  const conclusion = make("Return to geography", "Return to the flat map to compare the 3D pattern with the original geography and inspect source events.", null, { ...camera, tilt: 20 });
  return {
    briefing: normalizeBriefing({ ...document, layerId: layerRef || document.layerId, selection: { ids: [], useAll: true }, slides: [...document.slides, overview, magnitude, chronology, stacked, conclusion] }),
    preview: { template: "spatial-3d-chart", slides: 5, groups: history.groups.length, groupBy, heightField, geometryStrategy: "source-footprints", aggregation: "none" },
  };
}

