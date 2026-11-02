import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { googleMapsLink, googleMapsLinkForChapter } from "../js/google-maps-link.js";
import { encodeEmbeddedTour, decodeEmbeddedTour } from "../js/tour-share.js";
import { encodeFieldTask, decodeFieldTask } from "../js/field-task-share.js";

const basemaps = new Set(["topo-3d"]);
test("Google Maps links validate coordinates and default or clamp zoom", () => {
  assert.equal(googleMapsLink(41.900196, 12.488256), "https://www.google.com/maps/@41.900196,12.488256,14z");
  assert.equal(googleMapsLink(0, 0, 23), "https://www.google.com/maps/@0,0,21z");
  for (const [lat, lon] of [[null, null], [91, 0], [0, 181], [NaN, 1], ["1", 2]]) assert.equal(googleMapsLink(lat, lon), null);
});

test("links use the current chapter's shared coordinates, including legacy targets", () => {
  const presentation = { chapters: [{ title: "Rome", viewState: { center: [12.488256, 41.900196], zoom: 14, tilt: 0, heading: 0 }, lingerSeconds: 4 }] };
  const decoded = decodeEmbeddedTour(encodeEmbeddedTour(presentation, basemaps), basemaps);
  assert.equal(googleMapsLinkForChapter(decoded.chapters[0]), "https://www.google.com/maps/@41.9002,12.48826,14z");
  assert.equal(googleMapsLinkForChapter({ viewpoint: { targetGeometry: { x: 0, y: 0, spatialReference: { wkid: 3857 } } } }), "https://www.google.com/maps/@0,0,14z");
  assert.equal(googleMapsLinkForChapter({}), null);
  assert.equal(googleMapsLinkForChapter({ viewState: { center: [null, null] } }), null);
});

test("field task coordinates round trip without adding link data to the QR", () => {
  const task = { title: "Visit", latitude: 41.9, longitude: 12.48, features: [{ label: "Stop", latitude: 41.91, longitude: 12.49 }] };
  const decoded = decodeFieldTask(encodeFieldTask(task, "assign")).task;
  assert.equal(googleMapsLink(decoded.latitude, decoded.longitude), "https://www.google.com/maps/@41.9,12.48,14z");
  assert.equal(googleMapsLink(decoded.features[0].latitude, decoded.features[0].longitude), "https://www.google.com/maps/@41.91,12.49,14z");
  assert.equal(decoded.googleMapsUrl, undefined);
});

test("tour and task viewers expose links and tour exit without obscuring dialog actions", async () => {
  const [html, ui, router, css] = await Promise.all(["../index.html", "../js/ui.js", "../js/mobile-workflow-router.js", "../css/app.css"].map((p) => readFile(new URL(p, import.meta.url), "utf8")));
  assert.match(html, /id="atlas-chapter-google-maps"[^>]*target="_blank"[^>]*rel="noopener noreferrer"/);
  assert.match(ui, /googleMapsLinkForChapter\(chapter\)/);
  assert.match(ui, /End tour · Open GISMap Online[^\n]*#exitAtlasTour\(\)/);
  assert.match(router, /#mapsLink\(task\.latitude, task\.longitude\)/);
  assert.match(router, /#mapsLink\(feature\.latitude, feature\.longitude\)/);
  assert.match(css, /mobile-atlas-presenting:has\(.app-dialog[^\n]*\.mobile-presentation-controls \{ display:none/);
});
