import assert from "node:assert/strict";
import { createShareUrl, parseShareParameters, sanitizeSharedResourceUrl } from "../js/share.js";

const service = "https://example.com/arcgis/rest/services/Fires/FeatureServer/0";
const geojson = "https://example.com/data/feed?format=geojson&limit=100";
const shared = createShareUrl({
  baseUrl: "https://gismap.online/?old=value#map",
  layers: [
    { url: service, sourceType: "feature" },
    { url: geojson, sourceType: "geojson" },
    { url: "blob:https://gismap.online/local", local: true },
  ],
  basemap: "gray-3d",
});
const parsed = parseShareParameters(new URL(shared).search);
assert.deepEqual(parsed.layers, [
  { url: service, serviceType: "feature" },
  { url: geojson, serviceType: "geojson" },
]);
assert.equal(parsed.basemap, "gray-3d");
assert.equal(new URL(shared).hash, "");

const renderer = { type: "simple", symbol: { type: "simple-marker", color: "#1b7f6a" } };
const rendererCatalog = [{ id: "styled", slug: "styled-example", title: "Styled example", serviceType: "feature", url: service, renderer }];
const styledExample = parseShareParameters("?example=styled-example", rendererCatalog).layers[0];
assert.deepEqual(styledExample.renderer, renderer);
assert.notEqual(styledExample.renderer, renderer);

const catalog = [{ id: "fires", slug: "active-fires", title: "Active fires", serviceType: "feature", url: service }];
assert.deepEqual(parseShareParameters("?example=active-fires", catalog).layers[0], {
  url: service,
  serviceType: "feature",
  title: "Active fires",
  refreshInterval: undefined,
});

const multiLayerCatalog = [{
  slug: "wildfires",
  title: "Wildfires",
  serviceType: "feature",
  url: "https://example.com/FeatureServer",
  layers: [
    { url: "https://example.com/FeatureServer/0", title: "Incidents" },
    { url: "https://example.com/FeatureServer/1", title: "Perimeters" },
  ],
}];
assert.deepEqual(parseShareParameters("?example=wildfires", multiLayerCatalog).layers.map(({ url, title }) => ({ url, title })), [
  { url: "https://example.com/FeatureServer/0", title: "Incidents" },
  { url: "https://example.com/FeatureServer/1", title: "Perimeters" },
]);

assert.throws(() => sanitizeSharedResourceUrl("javascript:alert(1)"), /HTTPS/);
assert.throws(() => sanitizeSharedResourceUrl("http://example.com/data"), /HTTPS/);
assert.equal(sanitizeSharedResourceUrl("http://localhost/data", { allowHttp: true }), "http://localhost/data");
assert.throws(() => sanitizeSharedResourceUrl("https://user:secret@example.com/data"), /username or password/);
for (const key of ["token", "access_token", "apiKey", "key", "client_secret", "password", "signature"]) {
  assert.throws(() => sanitizeSharedResourceUrl(`https://example.com/data?${key}=secret`), /credential parameter/);
}
assert.throws(() => parseShareParameters("?layer=not-a-url"), /invalid URL/);
assert.throws(() => parseShareParameters(`?layer=${encodeURIComponent(service)}&layerType=executable`), /Unsupported/);
assert.throws(() => parseShareParameters("?example=missing", catalog), /Unknown GISMap Online example/);
assert.throws(() => parseShareParameters("?basemap=untrusted-style"), /Unsupported shared basemap/);
assert.throws(() => createShareUrl({ baseUrl: "https://gismap.online/", layers: [{ url: `${service}?token=secret` }] }), /credential/);
assert.throws(() => createShareUrl({ baseUrl: "https://gismap.online/", layers: [{ local: true, url: "blob:x" }] }), /public remote layer/);
