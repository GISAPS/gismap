import assert from "node:assert/strict";
import { test } from "node:test";
import { EXAMPLE_CATEGORIES, POPULAR_SERVICES } from "../js/catalog.js";
import { mapSpecFromShareParameters } from "../js/map-spec.js";
import { parseShareParameters } from "../js/share.js";

test("catalog entries have stable, complete discovery metadata", () => {
  const ids = new Set();
  const slugs = new Set();
  const required = ["id", "slug", "provider", "title", "category", "serviceType", "description", "whyUseful", "url", "sourceOrganization", "sourcePage", "licenseOrTerms"];
  for (const item of POPULAR_SERVICES) {
    for (const field of required) assert.ok(item[field], `${item.id || "catalog entry"} is missing ${field}`);
    assert.match(item.id, /^[a-z0-9-]+$/);
    assert.match(item.slug, /^[a-z0-9-]+$/);
    assert.ok(!ids.has(item.id), `duplicate id: ${item.id}`);
    assert.ok(!slugs.has(item.slug), `duplicate slug: ${item.slug}`);
    ids.add(item.id); slugs.add(item.slug);
    assert.ok(EXAMPLE_CATEGORIES.includes(item.category), `unknown category: ${item.category}`);
    assert.match(item.url, /^https:\/\//);
    assert.match(item.sourcePage, /^https:\/\//);
    assert.ok(Array.isArray(item.tags) && item.tags.length > 0);
    assert.ok(item.lastChecked === null || /^\d{4}-\d{2}-\d{2}$/.test(item.lastChecked));
    assert.equal(typeof item.featured, "boolean");
  }
});

test("catalog includes the documented service families", () => {
  const types = new Set(POPULAR_SERVICES.map((item) => item.serviceType));
  for (const type of ["feature", "map-image", "geojson"]) assert.ok(types.has(type), `missing ${type}`);
  assert.ok(POPULAR_SERVICES.some((item) => item.featured), "at least one example must be featured");
});

test("the 3D example stacks California fire perimeters by decade and opens at an angle", () => {
  assert.equal(POPULAR_SERVICES.some((item) => item.slug.startsWith("air-quality-pm25-3d-")), false, "PM2.5 points do not suit 3D; only the PM2.5 data entry stays");
  assert.ok(POPULAR_SERVICES.find((item) => item.slug === "air-quality-pm25"));
  const shared = parseShareParameters("?example=california-fire-perimeters-strata", POPULAR_SERVICES);
  const spec = mapSpecFromShareParameters(shared);
  const [layer] = spec.layers;
  assert.equal(layer.title, "California Historic Fire Perimeters");
  assert.equal(layer.where, "GIS_ACRES >= 1000 AND DECADES IS NOT NULL");
  assert.equal(layer.spatialChart.mode, "temporal-strata");
  assert.equal(layer.spatialChart.groupBy, "DECADES");
  assert.deepEqual([layer.spatialChart.groups[0], layer.spatialChart.groups.at(-1)], ["1950-1959", "2020-2025"], "earliest decade at the bottom");
  assert.equal(spec.camera.tilt, 55, "a stack reads best from an angle");
  assert.equal(spec.basemap, "open-dark");
  assert.deepEqual(mapSpecFromShareParameters(parseShareParameters("?example=california-fire-perimeters-strata&zoom=layers", POPULAR_SERVICES)).camera, { fit: "layers" }, "the link's own camera wins");
});

test("featured discovery examples carry a deliberate portable visual", () => {
  const examples = ["usa-wildfires", "modis-active-fires", "air-quality-pm25", "usgs-earthquakes"];
  for (const slug of examples) {
    const item = POPULAR_SERVICES.find((entry) => entry.slug === slug);
    assert.ok(item, `${slug} is in the catalog`);
    const layers = item.layers?.length ? item.layers : [item];
    assert.ok(layers.every((layer) => (layer.renderer || item.renderer)?.type === "simple"), `${slug} has a portable simple renderer`);
  }
  assert.equal(POPULAR_SERVICES.find((item) => item.slug === "usa-wildfires").layers[0].animatedEffect.type, "fire");
  assert.equal(POPULAR_SERVICES.find((item) => item.slug === "usgs-earthquakes").animatedEffect.type, "pulse");
});

test("example cinematic effects reach the launch map specification", () => {
  const shared = parseShareParameters("?example=usa-wildfires", POPULAR_SERVICES);
  const spec = mapSpecFromShareParameters(shared);
  assert.equal(spec.layers[0].animatedEffect.type, "fire");
  assert.equal(spec.layers[1].animatedEffect, undefined);
});
