import test from "node:test";
import assert from "node:assert/strict";
import { createEmbeddedTourUrl, decodeEmbeddedTour } from "../js/tour-share.js";
import { readFileSync } from "node:fs";

const basemaps = new Set(["topo-3d", "satellite"]);
const presentation = { title: "Lakes & cafés", skin: "portolan", playbackMode: "auto", chapters: [{ title: "São Paulo: café", lingerSeconds: 12, transitionMode: "instant", basemapId: "satellite", viewState: { center: [-46.6333, -23.5505], zoom: 8.25, tilt: 35, heading: 15 } }] };
const url = createEmbeddedTourUrl({ baseUrl: "https://gismap.online/?old=1", presentation, allowedBasemaps: basemaps, chapter: 1, autoplay: false });
const payload = new URL(url).hash.replace("#tour=", "");
const decoded = decodeEmbeddedTour(payload, basemaps);
assert.equal(decoded.title, "Lakes & cafés");
assert.equal(decoded.chapters[0].title, "São Paulo: café");
assert.deepEqual(decoded.chapters[0].viewState.center, [-46.6333, -23.5505]);
assert.equal(decoded.chapters[0].transitionMode, "instant");
assert.equal(new URL(url).searchParams.get("chapter"), "1");
const embedUrl = new URL(createEmbeddedTourUrl({ baseUrl: "https://gismap.online/", presentation, allowedBasemaps: basemaps, tourOnly: true, embed: true }));
assert.equal(embedUrl.searchParams.get("tourOnly"), "1");
assert.equal(embedUrl.searchParams.get("embed"), "1");
assert.ok(embedUrl.hash.startsWith("#tour="));
assert.throws(() => decodeEmbeddedTour("not-a-tour", basemaps), /not valid/);
const invalid = btoa(JSON.stringify({ v: 1, chapters: [{ name: "Nope", lat: 91, lon: 0, zoom: 1, tilt: 0, heading: 0, linger: 4 }] })).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
assert.throws(() => decodeEmbeddedTour(invalid, basemaps), /invalid camera/);

const ui = readFileSync(new URL("../js/ui.js", import.meta.url), "utf8");
const pdf = readFileSync(new URL("../js/pdf-document.js", import.meta.url), "utf8");
assert.match(ui, /data-atlas-title/);
assert.match(ui, /Tour name/);
assert.match(ui, /data-atlas-settings/);
assert.match(ui, /Add a chapter/);
assert.match(ui, /Share & export/);
assert.match(ui, /Download \.gisatlas/);
assert.match(ui, /#renderTourShareCard\(regularUrl, title\)/);
assert.match(ui, /title: title \|\| "Guided places",/, "Tour cards fall back to the default tour name.");
assert.match(ui, /const safeTitle = String\(title \|\| "GISMap Online"\)\.slice\(0, 54\)/);
assert.match(pdf, /context\.textAlign = "left"/);
assert.match(ui, /long-click the QR code/);

test("a hand-written json: tour link decodes with defaults and the same validation", async () => {
  const { decodeEmbeddedTour, createEmbeddedTourUrl } = await import("../js/tour-share.js");
  const written = { title: "Two stops", autoplay: true, stops: [{ name: "Coit Tower", caption: "Telegraph Hill", lat: 37.80238, lon: -122.40583, basemap: "usgs-imagery" }, { name: "Ferry Building", lat: 37.79555, lon: -122.39347, zoom: 17, tilt: 50 }] };
  const tour = decodeEmbeddedTour(`json:${encodeURIComponent(JSON.stringify(written))}`, new Set(["usgs-imagery"]));
  assert.equal(tour.playbackMode, "auto");
  assert.deepEqual(tour.chapters.map((chapter) => [chapter.title, chapter.basemapId, chapter.viewState.zoom, chapter.lingerSeconds]), [["Coit Tower", "usgs-imagery", 15, 6], ["Ferry Building", null, 17, 6]]);
  assert.throws(() => decodeEmbeddedTour(`json:${encodeURIComponent(JSON.stringify({ stops: [{ name: "Nowhere", lat: 95, lon: 0 }] }))}`, new Set()), /invalid camera/);
  assert.throws(() => decodeEmbeddedTour("json:{oops", new Set()), /not valid JSON/);
  const url = createEmbeddedTourUrl({ baseUrl: "https://gismap.online/", presentation: tour, allowedBasemaps: new Set(["usgs-imagery"]), readable: true });
  assert.match(url, /#tour=json:%7B/);
  assert.deepEqual(decodeEmbeddedTour(new URL(url).hash.slice(6), new Set(["usgs-imagery"])).chapters.map((chapter) => chapter.title), ["Coit Tower", "Ferry Building"]);
});
