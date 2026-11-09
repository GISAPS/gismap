import assert from "node:assert/strict";
import { isArcGisDirectoryResponse, normalizeArcGisDirectoryUrl, probeArcGisDirectory, splitArcGisDirectoryUrl } from "../js/enterprise-catalog.js";

assert.equal(
  normalizeArcGisDirectoryUrl(" https://gis.example.gov/arcgis/rest/services/?f=pjson#top "),
  "https://gis.example.gov/arcgis/rest/services",
);
assert.equal(
  normalizeArcGisDirectoryUrl("http://gis.example.gov/REST/SERVICES"),
  "http://gis.example.gov/REST/SERVICES",
);
assert.throws(
  () => normalizeArcGisDirectoryUrl("https://gis.example.gov/arcgis/rest/services/Parcels/FeatureServer"),
  /top-level ArcGIS endpoint/,
);
assert.throws(() => normalizeArcGisDirectoryUrl("not a URL"), /valid ArcGIS server directory URL/);

// ?layer= links that name a services directory or folder open the layer picker.
const agol = "https://services7.arcgis.com/xcDZAIhbyblBfhsu/arcgis/rest/services";
assert.deepEqual(splitArcGisDirectoryUrl(agol), { rootUrl: agol, folder: "" });
assert.deepEqual(splitArcGisDirectoryUrl(`${agol}/Humboldt/?f=pjson`), { rootUrl: agol, folder: "Humboldt" });
assert.equal(splitArcGisDirectoryUrl(`${agol}/Parcels/FeatureServer`), null);
assert.equal(splitArcGisDirectoryUrl(`${agol}/Humboldt/Parcels/MapServer/3`), null);
assert.equal(splitArcGisDirectoryUrl("https://example.com/data.geojson"), null);
assert.equal(splitArcGisDirectoryUrl("not a URL"), null);

assert.equal(isArcGisDirectoryResponse({ currentVersion: 11.3, folders: [], services: [{ name: "A", type: "FeatureServer" }] }), true);
assert.equal(isArcGisDirectoryResponse({ folders: ["Humboldt"] }), true);
assert.equal(isArcGisDirectoryResponse({ services: [], layers: [] }), false);
assert.equal(isArcGisDirectoryResponse({ services: [], type: "Feature Layer" }), false);
assert.equal(isArcGisDirectoryResponse({ error: { code: 404 } }), false);

const requested = [];
const respond = (body, ok = true) => async (url) => { requested.push(url); return { ok, json: async () => body }; };
assert.deepEqual(await probeArcGisDirectory(`${agol}/Humboldt`, respond({ folders: [], services: [] })), { rootUrl: agol, folder: "Humboldt" });
assert.equal(requested.at(-1), `${agol}/Humboldt?f=json`);
assert.equal(await probeArcGisDirectory(`${agol}/Humboldt`, respond({ error: { code: 404 } })), null);
assert.equal(await probeArcGisDirectory(`${agol}/Humboldt`, respond({}, false)), null);
assert.equal(await probeArcGisDirectory(`${agol}/Parcels/FeatureServer/0`, respond({ folders: [] })), null);
assert.equal(requested.length, 3, "service URLs are not probed");
await assert.rejects(probeArcGisDirectory(agol, async () => { throw new TypeError("Failed to fetch"); }), /Failed to fetch/);

console.log("Enterprise catalog URL tests passed");
