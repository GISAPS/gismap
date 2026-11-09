export const ENTERPRISE_CATALOGS = [
  {
    id: "santa-clara",
    title: "City of Santa Clara GIS",
    rootUrl: "https://map.santaclaraca.gov/maps/rest/services",
    version: "ArcGIS Enterprise 10.91",
  },
];

export function normalizeArcGisDirectoryUrl(value) {
  let url;
  try {
    url = new URL(String(value ?? "").trim());
  } catch {
    throw new Error("Enter a valid ArcGIS server directory URL.");
  }
  if (!/^https?:$/.test(url.protocol)) {
    throw new Error("The server directory must use HTTP or HTTPS.");
  }
  url.pathname = url.pathname.replace(/\/+$/, "");
  url.search = "";
  url.hash = "";
  if (!/\/rest\/services$/i.test(url.pathname)) {
    throw new Error("Use the top-level ArcGIS endpoint ending in /rest/services.");
  }
  return url.toString().replace(/\/$/, "");
}

/**
 * The /rest/services root and folder of an ArcGIS services directory or folder
 * URL, or null for anything else (a service, a layer, another site).
 */
export function splitArcGisDirectoryUrl(value) {
  let url;
  try {
    url = new URL(String(value ?? "").trim());
  } catch {
    return null;
  }
  const match = url.pathname.replace(/\/+$/, "").match(/^(.*\/rest\/services)((?:\/[^/]+)*)$/i);
  if (!match) return null;
  const folder = match[2].replace(/^\//, "");
  if (/(?:^|\/)[A-Za-z]*Server(?:\/|$)/.test(folder)) return null;
  return { rootUrl: `${url.origin}${match[1]}`, folder };
}

/** Whether an ?f=json response describes a services directory or folder rather than a service. */
export function isArcGisDirectoryResponse(payload) {
  if (!payload || typeof payload !== "object") return false;
  return (Array.isArray(payload.folders) || Array.isArray(payload.services)) && !("layers" in payload) && !("type" in payload);
}

/**
 * Reads a URL's ?f=json and returns its { rootUrl, folder } when it is a services
 * directory or folder. A blocked or failed request rejects, so the caller can
 * load the URL as before and show that error.
 */
export async function probeArcGisDirectory(value, fetchImpl = fetch) {
  const location = splitArcGisDirectoryUrl(value);
  if (!location) return null;
  const response = await fetchImpl(`${location.rootUrl}${location.folder ? `/${location.folder}` : ""}?f=json`);
  if (!response.ok) return null;
  const payload = await response.json().catch(() => null);
  return isArcGisDirectoryResponse(payload) ? location : null;
}

export class EnterpriseCatalog {
  constructor(definition) {
    this.definition = {
      ...definition,
      rootUrl: normalizeArcGisDirectoryUrl(definition.rootUrl),
    };
  }

  async browse(folder = "") {
    const folderPath = folder.replace(/^\/+|\/+$/g, "");
    const url = `${this.definition.rootUrl}${folderPath ? `/${folderPath}` : ""}`;
    const response = await fetch(`${url}?f=json`);
    if (!response.ok) throw new Error(`Service directory returned ${response.status}.`);
    const payload = await response.json();
    if (payload.error) throw new Error(payload.error.message || "Could not read the service directory.");
    return {
      folder: folderPath,
      folders: payload.folders ?? [],
      services: (payload.services ?? []).map((service) => ({
        ...service,
        url: `${this.definition.rootUrl}/${service.name}/${service.type}`,
        serviceType: this.#serviceType(service.type),
      })),
    };
  }

  #serviceType(type) {
    if (type === "MapServer") return "map-image";
    if (type === "FeatureServer") return "feature";
    if (type === "ImageServer") return "imagery";
    return "arcgis-auto";
  }
}
