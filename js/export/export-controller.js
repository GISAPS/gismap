import { graphicToGeoJSONFeature, safeExportName } from "./export-core.js?v=0.18.2";

const DRAWINGS_UID = "__gismap_drawings__";
const FORMAT_DETAILS = {
  geojson: { extension: "geojson", label: "GeoJSON" },
  kml: { extension: "kml", label: "KML" },
  kmz: { extension: "kmz", label: "KMZ" },
  shapefile: { extension: "zip", label: "zipped Shapefile" },
};

function downloadBlob(blob, fileName) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 5000);
}

export class ExportController {
  constructor(events, mapController) {
    this.events = events;
    this.mapController = mapController;
    this.activeJob = null;
  }

  listExportableLayers() {
    const layers = this.mapController.getLayers().map((root) => {
      const layer = this.mapController.getQueryableLayer(root.uid);
      return layer ? { uid: root.uid, title: layer.title || root.title || "Untitled layer", kind: "layer" } : null;
    }).filter(Boolean);
    if (this.mapController.hasDrawings()) {
      layers.unshift({ uid: DRAWINGS_UID, title: "Drawings", kind: "drawings" });
    }
    return layers;
  }

  cancel() {
    const job = this.activeJob;
    if (!job) return false;
    job.abortController.abort();
    job.worker.postMessage({ type: "cancel", id: job.id });
    job.worker.terminate();
    this.activeJob = null;
    this.events.publish("export:cancelled", { id: job.id });
    return true;
  }

  async exportLayer({ uid, scope = "filtered", fileName, format = "geojson" } = {}) {
    if (this.activeJob) throw new Error("Another export is already running.");
    const formatDetails = FORMAT_DETAILS[format];
    if (!formatDetails) throw new Error("That export format is not supported.");
    const drawings = uid === DRAWINGS_UID;
    const root = drawings ? null : this.mapController.getLayer(uid);
    let layer = drawings || !root ? null : this.mapController.getQueryableLayer(uid);
    if (!drawings && !layer) throw new Error("This layer does not expose queryable vector features.");
    if (layer) layer = await this.mapController.loadLayer(layer.uid);

    const id = globalThis.crypto?.randomUUID?.() ?? `export-${Date.now()}`;
    const worker = new Worker(new URL("./export-worker.js?v=0.18.2", import.meta.url), { type: "module" });
    const abortController = new AbortController();
    const title = drawings ? "Drawings" : layer.title || root?.title || "layer";
    const baseName = safeExportName(fileName || title);
    const outputName = `${baseName}.${formatDetails.extension}`;
    const job = { id, worker, abortController };
    this.activeJob = job;
    this.events.publish("export:start", { id, title, scope, format });

    try {
      worker.postMessage({ type: "start", id, metadata: { name: title }, format });
      let retrieved = 0;
      let total = 0;

      if (drawings) {
        const features = this.mapController.getDrawGraphicsForExport(scope).map(graphicToGeoJSONFeature);
        retrieved = features.length;
        total = features.length;
        worker.postMessage({ type: "batch", id, features });
        this.events.publish("export:progress", { id, stage: "retrieving", completed: retrieved, total });
      } else {
        const query = { outFields: ["*"], returnGeometry: true, outSpatialReference: { wkid: 4326 } };
        if (scope === "source") query.where = "1=1";
        if (scope === "extent") {
          // The extent when the export starts: moving the map meanwhile does not change what is exported.
          query.geometry = this.mapController.getViewExtent();
          query.spatialRelationship = "intersects";
        }

        const options = { signal: abortController.signal };
        const objectIds = layer.objectIdQueryable
          ? ((await this.mapController.queryObjectIds(layer.uid, query, options)) ?? [])
          : null;
        total = objectIds
          ? objectIds.length
          : (layer.countable ? await this.mapController.queryFeatureCount(layer.uid, query, options) : 0);
        const batchSize = Math.max(100, Math.min(2000, layer.maxRecordCount || 1000));

        if (objectIds) {
          for (let start = 0; start < objectIds.length; start += batchSize) {
            this.#assertActive(job);
            const pageQuery = { ...query, objectIds: objectIds.slice(start, start + batchSize) };
            const result = await this.mapController.queryFeatures(layer.uid, pageQuery, options);
            const features = (result.features ?? []).map(graphicToGeoJSONFeature);
            retrieved += features.length;
            worker.postMessage({ type: "batch", id, features });
            this.events.publish("export:progress", { id, stage: "retrieving", completed: retrieved, total });
          }
        } else {
          let start = 0;
          do {
            this.#assertActive(job);
            const pageQuery = { ...query, start, num: batchSize };
            const result = await this.mapController.queryFeatures(layer.uid, pageQuery, options);
            const features = (result.features ?? []).map(graphicToGeoJSONFeature);
            retrieved += features.length;
            worker.postMessage({ type: "batch", id, features });
            this.events.publish("export:progress", { id, stage: "retrieving", completed: retrieved, total });
            start += features.length;
            if (!features.length || (!result.exceededTransferLimit && features.length < batchSize)) break;
          } while (true);
        }
      }

      this.#assertActive(job);
      this.events.publish("export:progress", { id, stage: "packaging", completed: retrieved, total: retrieved });
      const completed = new Promise((resolve, reject) => {
        worker.addEventListener("message", (event) => {
          if (event.data?.id !== id) return;
          if (event.data.type === "complete") resolve(event.data);
        });
        worker.addEventListener("error", (event) => reject(new Error(event.message || "The export worker failed.")), { once: true });
      });
      worker.postMessage({ type: "finish", id });
      const result = await completed;
      this.#assertActive(job);
      const blob = await this.#packageResult(result, format, baseName);
      downloadBlob(blob, outputName);
      this.events.publish("export:complete", { id, title, format, formatLabel: formatDetails.label, fileName: outputName, featureCount: result.featureCount });
      return result;
    } catch (error) {
      if (error?.name === "AbortError" || this.activeJob !== job) return null;
      this.events.publish("export:error", { id, error });
      throw error;
    } finally {
      worker.terminate();
      if (this.activeJob === job) this.activeJob = null;
    }
  }

  #assertActive(job) {
    if (this.activeJob !== job || job.abortController.signal.aborted) {
      throw new DOMException("Export cancelled", "AbortError");
    }
  }

  async #packageResult(result, format, baseName) {
    if (format === "geojson" || format === "kml") return result.blob;
    if (format === "kmz") {
      if (!globalThis.JSZip) throw new Error("KMZ packaging library is unavailable.");
      const archive = new globalThis.JSZip();
      archive.file("doc.kml", await result.blob.text());
      return archive.generateAsync({ type: "blob", compression: "DEFLATE" });
    }
    if (!globalThis.shpwrite?.zip) throw new Error("Shapefile export library is unavailable.");
    const output = await globalThis.shpwrite.zip(result.collection, {
      folder: baseName,
      filename: baseName,
      outputType: "blob",
      compression: "STORE",
      types: { point: "points", polygon: "polygons", polyline: "lines" },
    });
    return output instanceof Blob ? output : new Blob([output], { type: "application/zip" });
  }
}
