// The folder GISMap Online is installed in. It may be a subfolder (example.com/app/),
// so links to the app's own pages resolve here, never from the server root.
export const APP_ROOT = new URL("../", import.meta.url).href;

/** A URL for one of the app's own pages or files, e.g. appUrl("examples/"). */
export const appUrl = (path = "") => new URL(String(path).replace(/^\/+/, ""), APP_ROOT).href;
