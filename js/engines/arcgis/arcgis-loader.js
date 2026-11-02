// Loads the ArcGIS browser runtime only when the ArcGIS engine is selected.
// Another engine can therefore use the GISMap Online shell without downloading it.
const SDK_URL = "https://js.arcgis.com/5.0/";
const CSS_URL = "https://js.arcgis.com/5.0/esri/themes/light/main.css";
let loading = null;

function ensureStylesheet() {
  if (document.querySelector(`link[href="${CSS_URL}"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = CSS_URL;
  link.dataset.gismapArcgis = "";
  document.head.append(link);
}

export async function loadArcGISRuntime() {
  if (globalThis.$arcgis?.import) return globalThis.$arcgis;
  if (loading) return loading;
  if (typeof document === "undefined") throw new Error("The ArcGIS map engine needs a browser document.");
  ensureStylesheet();
  loading = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${SDK_URL}"]`);
    const script = existing || document.createElement("script");
    script.addEventListener("load", () => globalThis.$arcgis?.import
      ? resolve(globalThis.$arcgis)
      : reject(new Error("ArcGIS Maps SDK loaded without exposing its module importer.")), { once: true });
    script.addEventListener("error", () => reject(new Error("ArcGIS Maps SDK did not load. Check the network connection and CDN URL.")), { once: true });
    if (!existing) {
      script.type = "module";
      script.src = SDK_URL;
      script.dataset.gismapArcgis = "";
      document.head.append(script);
    }
  }).catch((error) => { loading = null; throw error; });
  return loading;
}

