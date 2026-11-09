// The product's confirmed name, GISMap Online, for every default that shows it.
// A self-hosted installation's own applicationName wins (installation-config.js).
export const BRAND = Object.freeze({
  name: "GISMap Internal",
  url: "https://gisanalytics.utility.pge.com/webmaps/gismap/",
  logo: "assets/gis-map-online-mark-v2.png",
  alternateName: Object.freeze(["GIS Map Internal", "GISMap"]),
});

/** The configured application name, or the default. */
export const brandName = () => String(globalThis.GISMAP_INSTALLATION?.applicationName || BRAND.name).trim().slice(0, 80) || BRAND.name;

/** The drawn wordmark: "GISMap" over "ONLINE", or a renamed installation's name alone. */
export const brandWordmark = (name = brandName()) => name === BRAND.name ? { primary: "GISMap", secondary: "ONLINE" } : { primary: name, secondary: "" };
