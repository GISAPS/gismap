import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { AI_EXAMPLES, CORN_EXAMPLE_SPEC, WILDFIRE_CHART_SPEC, aiExampleLinks } from "../scripts/ai-examples.mjs";
import { CORN_LINK } from "../scripts/agent-docs.mjs";
import { mapSpec } from "../js/gismap-core.js";
import { normalizeBriefing } from "../js/briefing-document.js";
// Pages link relative to themselves; these checks read them as root paths.
import { rootLinksHtml } from "../scripts/relative-links.mjs";
import { readShareLocation } from "../js/map-share.js";

const text = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8").then((text) => (path.endsWith(".html") ? rootLinksHtml(path, text) : text));
const json = async (path) => JSON.parse(await text(path));
const example = (slug) => AI_EXAMPLES.find((item) => item.slug === slug);
const links = await aiExampleLinks(text);
// Specs compare without the block IDs normalizing assigns, and regardless of key order.
const canonical = (value) => Array.isArray(value) ? value.map(canonical)
  : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).filter((key) => !(key === "id" && /^b-/.test(value.id))).sort().map((key) => [key, canonical(value[key])]))
  : value;

test("every AI example has its files, a gismap.online link and a QR code", async () => {
  for (const item of AI_EXAMPLES) {
    assert.match(links[item.slug], /^https:\/\/gismap\.online\//, item.slug);
    for (const file of item.files) await text(`examples/ai/${item.slug}/${file.file}`);
    const png = await readFile(new URL(`../examples/ai/${item.slug}/${item.qr.file}`, import.meta.url));
    assert.deepEqual([...png.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47], `${item.slug} QR is a PNG`);
    assert.ok(item.chat.prompt.length > 100 && item.agent.code.length > 100);
  }
  const index = await text("examples/index.html");
  assert.match(index, /href="\/examples\/ai\/"/);
  assert.match(await text("llms.txt"), /## Worked examples\n/);
});

test("the Philadelphia link opens nine slides on divisions and districts, and the agent's spec makes the same briefing", async () => {
  const doc = await json("examples/ai/philadelphia-police-divisions/briefing.json");
  const opened = await readShareLocation(new URL(links["philadelphia-police-divisions"]));
  assert.equal(opened.kind, "briefing");
  assert.deepEqual(opened.layers.map((layer) => layer.url.replace(/.*FeatureServer\//, "")), ["1", "2"], "divisions and districts, not crime incidents (layer 0)");
  assert.equal(opened.layers[opened.primary].url, doc.layerId);
  assert.deepEqual(canonical(opened.briefing.slides), canonical(normalizeBriefing(doc).slides));
  assert.equal(doc.slides.length, 9);
  assert.deepEqual(doc.slides.filter((slide) => slide.template === "feature").map((slide) => slide.featureId), ["1", "2", "3", "4", "5", "6"]);

  // The code-running recipe on the page: one map-v1 spec with both layers and the slides.
  const file = await json("examples/ai/philadelphia-police-divisions/map.json");
  const { valid, issues, spec } = mapSpec.validate(file);
  assert.equal(valid, true, JSON.stringify(issues));
  assert.deepEqual(spec.layers.map((layer) => layer.url), opened.layers.map((layer) => layer.url));
  assert.equal(spec.layers[1].opacity, 0.75);
  assert.deepEqual(canonical(spec.briefing.slides), canonical(normalizeBriefing(doc).slides));
  const { url, qr } = await mapSpec.createLink(file);
  assert.equal(qr, true);
  const reopened = await mapSpec.decode(url.split("#map=")[1]);
  assert.equal(reopened.briefing.slides.length, 9);
});

test("the ballparks link is the committed spec: two layers, one contains query per state, Ohio grown by a mile", async () => {
  const file = await json("examples/ai/mlb-ballparks-by-state/map.json");
  const { valid, issues, spec } = mapSpec.validate(file);
  assert.equal(valid, true, JSON.stringify(issues));
  const decoded = await mapSpec.decode(links["mlb-ballparks-by-state"].split("#map=")[1]);
  assert.deepEqual(canonical(mapSpec.validate(decoded).spec), canonical(spec));
  const [states, parks] = spec.layers.map((layer) => layer.url);
  assert.equal(spec.briefing.layerId, states);
  assert.equal(spec.briefing.transition, "cut");
  assert.equal(spec.layers[0].renderer.method, "auto");
  const stateSlides = spec.briefing.slides.filter((slide) => slide.template === "feature");
  assert.deepEqual(stateSlides.map((slide) => slide.featureId), spec.briefing.selection.ids);
  for (const slide of stateSlides) {
    const [entry] = slide.layers;
    assert.equal(entry.layer, parks);
    assert.equal(entry.relation.type, "contains");
    // Verified against the services: only Ohio needs growing; Illinois grown by a mile would take St. Louis's ballpark.
    assert.deepEqual(entry.relation.distance ? [slide.title, entry.relation.distance, entry.relation.units] : [slide.title], slide.title === "Ohio" ? ["Ohio", 1, "miles"] : [slide.title]);
  }
});

test("the corn example is the documented readable link a chat-only model can write", async () => {
  assert.equal(links["corn-sales-one-link"], CORN_LINK);
  assert.deepEqual(await json("examples/ai/corn-sales-one-link/map.json"), CORN_EXAMPLE_SPEC);
  assert.match(CORN_LINK, /#map=json:/);
  assert.equal(mapSpec.validate(CORN_EXAMPLE_SPEC).valid, true);
});

test("the wildfire example is a readable link whose charts follow the map's categories", async () => {
  assert.deepEqual(await json("examples/ai/wildfires-by-state-chart/map.json"), WILDFIRE_CHART_SPEC);
  const decoded = await mapSpec.decode(links["wildfires-by-state-chart"].split("#map=")[1]);
  const { valid, issues, spec } = mapSpec.validate(decoded);
  assert.equal(valid, true, JSON.stringify(issues));
  assert.deepEqual(issues, []);
  assert.equal(spec.charts.length, 2);
  const [bar, column] = spec.charts;
  assert.equal(bar.dimension, spec.layers[0].renderer.field, "the bar chart groups by the field the map colours by");
  assert.equal(bar.style.topN, spec.layers[0].renderer.maxCategories);
  assert.equal(bar.style.palette, undefined, "inherit (the default) takes the map's colours");
  assert.deepEqual([bar.placement, column.placement], ["right", "bottom"]);
  assert.deepEqual(column.measure, { field: "DailyAcres", aggregation: "sum" });
});
