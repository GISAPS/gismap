// Skin-styled basemaps: themes derived from each skin's real tokens
// (css/app.css), the compiler run over the OpenFreeMap styles the MapLibre
// engine uses (tests/fixtures/openfreemap-*.json), and the "skin" basemap id
// in both engines, links and map specs.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { SKIN_BASEMAP, THEME_TOKENS, applyMapColors, normalizeMapColors, contrast, luminance, mix, parseColor, themeFromComputedStyle, themeFromTokens } from "../js/basemap-themes.js";
import { applyBasemapTheme, classifyLayer } from "../js/engines/maplibre/basemap-theme.js";
import { openBasemapFor } from "../js/engines/maplibre/basemaps.js";
import { MaplibreEngine } from "../js/engines/maplibre/maplibre-engine.js";
import { ArcGISEngine } from "../js/engines/arcgis/arcgis-engine.js";
import { INTERFACE_SKINS, skinIsDark } from "../js/skin-catalog.js";
import { parseShareParameters } from "../js/share.js";
import { validateMapSpec } from "../js/map-spec.js";

const css = await readFile(new URL("../css/app.css", import.meta.url), "utf8");
const fixture = async (name) => JSON.parse(await readFile(new URL(`./fixtures/openfreemap-${name}.json`, import.meta.url), "utf8"));
const STYLES = { liberty: await fixture("liberty"), positron: await fixture("positron"), dark: await fixture("dark") };

/** A skin's tokens as the browser computes them: :root defaults, then the skin's (and theme's) own block. */
function tokensFor(skin, theme = "light") {
  const tokens = {};
  const read = (block) => {
    for (const [, name, value] of block.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) if (THEME_TOKENS.includes(name)) tokens[name] = value.trim();
  };
  read(css.match(/^:root \{([\s\S]*?)\n\}/m)[1]);
  const own = css.match(new RegExp(`^:root\\[data-skin="${skin}"\\] \\{([^}]*)\\}`, "m"));
  if (own) read(own[1]);
  if (skin === "gismap" && theme === "dark") read(css.match(/^:root\[data-skin="gismap"\]\[data-theme="dark"\] \{([\s\S]*?)\n\}/m)[1]);
  return tokens;
}

const SKIN_CASES = [...INTERFACE_SKINS.map(({ id }) => ({ skin: id, theme: "light" })), { skin: "gismap", theme: "dark" }];

test("colour helpers parse, mix and measure contrast", () => {
  assert.deepEqual(parseColor("#f80"), { r: 255, g: 136, b: 0, a: 1 });
  assert.deepEqual(parseColor("rgb(24 48 78 / 13%)"), { r: 24, g: 48, b: 78, a: 0.13 });
  assert.equal(parseColor("var(--ink)"), null);
  assert.equal(mix("#000000", "#ffffff", 0.5), "#808080");
  assert.equal(Math.round(contrast("#000000", "#ffffff")), 21);
  assert.ok(luminance("#ffffff") > luminance("#777777"));
});

test("map color overrides affect basemap components and 3D buildings without changing the data accent", () => {
  const base = themeFromTokens(tokensFor("highway"), { skin: "highway" });
  const colors = { land: "#112233", water: "#224466", roads: "#abcdef", buildings: "#ff0000", vegetation: "#00aa00", labels: "#ffffff" };
  const theme = applyMapColors(base, colors);
  assert.equal(theme.accent, base.accent);
  const style = { layers: [
    { id: "ground", type: "background" },
    { id: "water", type: "fill", "source-layer": "water" },
    { id: "road_primary", type: "line", "source-layer": "transportation" },
    { id: "building", type: "fill", "source-layer": "building" },
    { id: "building-3d", type: "fill-extrusion", "source-layer": "building" },
    { id: "park", type: "fill", "source-layer": "park" },
    { id: "city", type: "symbol", "source-layer": "place" },
  ] };
  const layers = applyBasemapTheme(style, theme).layers;
  assert.equal(layers[0].paint["background-color"], colors.land);
  assert.equal(layers[1].paint["fill-color"], colors.water);
  assert.equal(layers[2].paint["line-color"], colors.roads);
  assert.equal(layers[3].paint["fill-color"], colors.buildings);
  assert.equal(layers[4].paint["fill-extrusion-color"], colors.buildings);
  assert.equal(layers[5].paint["fill-color"], colors.vegetation);
  assert.equal(layers[6].paint["text-color"], colors.labels);
  assert.deepEqual(normalizeMapColors({ buildings: "#ABCDEF", water: "red", bad: "#ffffff" }), { buildings: "#abcdef" });
  assert.deepEqual(applyMapColors(base, {}), base);
});

test("every skin's tokens give a complete, readable basemap theme in its own neutrals", () => {
  for (const { skin, theme: appearance } of SKIN_CASES) {
    const tokens = tokensFor(skin, appearance);
    assert.deepEqual(Object.keys(tokens).sort(), [...THEME_TOKENS].sort(), `${skin}: every theme token is defined`);
    const dark = skinIsDark(skin, appearance);
    const theme = themeFromTokens(tokens, { skin, dark });
    const name = `${skin} (${appearance})`;
    for (const [key, value] of Object.entries(theme)) {
      if (typeof value === "string" && !["skin", "labelTransform"].includes(key)) assert.match(value, /^#[0-9a-f]{6}$/, `${name}: ${key}`);
    }
    assert.equal(theme.accent, parseColor(tokens["green-2"]) && mix(tokens["green-2"], tokens["green-2"], 0), `${name}: data takes the skin's accent`);
    assert.equal(theme.land, mix(tokens.paper, tokens.paper, 0), `${name}: land is the skin's paper`);
    assert.equal(dark, luminance(theme.land) < 0.2, `${name}: a dark skin gets a dark map`);
    assert.ok(contrast(theme.label, theme.land) >= 4.5, `${name}: labels are readable (${contrast(theme.label, theme.land).toFixed(2)}:1)`);
    assert.ok(contrast(theme.labelStrong, theme.land) >= 4.5, `${name}: place names are readable`);
    assert.ok(contrast(theme.waterLabel, theme.water) >= 4.5, `${name}: water names are readable on water`);
    assert.ok(contrast(theme.water, theme.land) > 1.08, `${name}: water stands apart from land`);
    assert.ok(contrast(theme.roadMajor, theme.land) > 1.03, `${name}: roads show`);
    assert.equal(theme.showPoi, false, `${name}: the basemap stays quiet`);
  }
  assert.equal(themeFromTokens(tokensFor("highway"), { skin: "highway" }).labelTransform, "uppercase", "Highway labels read like its console");
});

test("the theme is read from computed styles as the browser has them", () => {
  const tokens = tokensFor("highway");
  const style = { getPropertyValue: (name) => ` ${tokens[name.slice(2)] ?? ""} ` };
  assert.deepEqual(themeFromComputedStyle(style, { skin: "highway" }), themeFromTokens(tokens, { skin: "highway" }));
});

test("every layer of the OpenFreeMap styles has a role", () => {
  for (const [name, style] of Object.entries(STYLES)) {
    const unknown = style.layers.filter((layer) => classifyLayer(layer) === "other").map((layer) => layer.id);
    assert.deepEqual(unknown, [], `${name} layers the theme would leave in their original colours`);
  }
  const roles = Object.fromEntries(STYLES.liberty.layers.map((layer) => [layer.id, classifyLayer(layer)]));
  assert.equal(roles.water, "water");
  assert.equal(roles.road_motorway, "road-major");
  assert.equal(roles.road_motorway_casing, "road-casing");
  assert.equal(roles.road_major_rail_hatching, "rail");
  assert.equal(roles.label_city, "place-label");
  assert.equal(roles["highway-shield-us-interstate"], "road-shield");
  assert.equal(roles.natural_earth, "relief");
});

test("the compiler recolours by role and leaves the style's structure alone", () => {
  const theme = themeFromTokens(tokensFor("highway"), { skin: "highway" });
  for (const [name, style] of Object.entries(STYLES)) {
    const before = JSON.stringify(style);
    const themed = applyBasemapTheme(style, theme);
    assert.equal(JSON.stringify(style), before, `${name}: the input style is not changed`);
    assert.deepEqual(themed.layers.map((layer) => layer.id), style.layers.map((layer) => layer.id), `${name}: same layers, same order`);
    assert.deepEqual(themed.sources, style.sources);
    assert.equal(themed.metadata["gismap:theme"], "highway");
    for (const [index, layer] of themed.layers.entries()) {
      const role = classifyLayer(layer);
      const original = style.layers[index];
      assert.deepEqual(layer.filter, original.filter, `${name} ${layer.id}: filter kept`);
      assert.equal(layer.minzoom, original.minzoom);
      if (role === "background") assert.equal(layer.paint["background-color"], theme.land);
      if (role === "water") assert.equal(layer.paint["fill-color"], theme.water);
      if (role === "road-major") assert.equal(layer.paint["line-color"], theme.roadMajor);
      if (/^(water|landcover|landuse|park|aeroway|road-area)$/.test(role)) assert.equal(layer.paint["fill-pattern"], undefined, `${name} ${layer.id}: patterns give way to theme colours`);
      if (["poi", "road-shield", "road-icon", "relief"].includes(role)) assert.equal(layer.layout.visibility, "none", `${name} ${layer.id}: hidden`);
      if (role === "place-label") {
        assert.ok([theme.label, theme.labelStrong].includes(layer.paint["text-color"]));
        assert.equal(layer.layout["text-transform"], "uppercase");
      }
      if (original.paint?.["line-width"] !== undefined) assert.deepEqual(layer.paint["line-width"], original.paint["line-width"], `${name} ${layer.id}: widths kept`);
    }
  }
});

test("the skin basemap is Positron themed by MapLibre, and the matching gray canvas in ArcGIS", () => {
  assert.equal(SKIN_BASEMAP, "skin");
  assert.deepEqual([openBasemapFor("skin").key, openBasemapFor("skin").themed], ["positron", true]);
  assert.equal(openBasemapFor("gray-vector").themed, false);
  const arcgis = new ArcGISEngine({ publish() {} });
  arcgis.map = { basemap: "topo-3d", allLayers: [] };
  arcgis.basemapId = "topo-3d";
  arcgis.setBasemap("skin");
  assert.deepEqual([arcgis.getBasemapId(), arcgis.map.basemap], ["skin", "gray-vector"]);
  arcgis.setBasemapTheme({ dark: true });
  assert.equal(arcgis.map.basemap, "dark-gray-vector", "a dark skin switches the canvas");
  assert.ok(!arcgis.getCapabilities().includes("basemap-themes"), "ArcGIS does not claim skin-styled basemaps");
});

test("links and map specs accept the skin basemap", () => {
  assert.equal(parseShareParameters("?basemap=skin&layer=https%3A%2F%2Fexample.org%2Fa.geojson").basemap, "skin");
  assert.equal(validateMapSpec({ version: 1, basemap: "skin", layers: [] }).valid, true);
});

/** A stand-in map recording styles and layer paint. */
function fakeMap() {
  const layers = new Map();
  return {
    layers, styles: [],
    addSource() {}, getSource: () => ({ setData() {} }),
    addLayer: (spec) => layers.set(spec.id, structuredClone(spec)),
    getLayer: (id) => layers.get(id),
    setFilter() {}, setLayoutProperty() {},
    setPaintProperty: (id, name, value) => { layers.get(id).paint[name] = value; },
    isStyleLoaded: () => true,
    setStyle(style, options) { this.styles.push({ style, options }); },
  };
}

test("MapLibre draws the skin basemap and unstyled data in the skin's colours, live", async () => {
  const engine = new MaplibreEngine({ publish() {} });
  engine.map = fakeMap();
  const realFetch = globalThis.fetch;
  const fetched = [];
  globalThis.fetch = async (url) => {
    fetched.push(String(url));
    return { ok: true, json: async () => (/positron$/.test(url) ? structuredClone(STYLES.positron) : { type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "Point", coordinates: [0, 0] }, properties: {} }] }) };
  };
  try {
    const plain = await engine.addService({ url: "https://example.org/plain.geojson" });
    const styled = await engine.addService({ url: "https://example.org/styled.geojson" });
    await engine.applyRendererSpec(styled.uid, { type: "simple", color: "#123456" });
    const circle = (layer) => engine.map.layers.get(`gismap-${layer.uid}-circle`).paint["circle-color"];
    assert.equal(circle(plain), "#1b7f6a", "GIS Map green before a skin is known");

    const highway = themeFromTokens(tokensFor("highway"), { skin: "highway" });
    engine.setBasemapTheme(highway);
    assert.equal(circle(plain), "#ff4b0b", "unstyled data takes Highway's orange");
    assert.equal(circle(styled), "#123456", "a chosen style is kept");
    assert.equal(engine.map.styles.length, 0, "a non-skin basemap is not restyled");

    engine.setBasemap("skin");
    await new Promise((resolve) => setTimeout(resolve, 0));
    const { style, options } = engine.map.styles.at(-1);
    assert.equal(style.metadata["gismap:theme"], "highway");
    assert.equal(style.layers.find((layer) => layer.type === "background").paint["background-color"], highway.land);
    assert.equal(options.diff, true, "only what changed is redrawn");
    const carried = options.transformStyle(null, style);
    assert.ok(carried.layers.some((layer) => layer.id === `gismap-${plain.uid}-circle`), "data layers ride along");
    assert.equal(carried.terrain, undefined, "flat ground adds no terrain");
    // A diff that changes terrain fails in MapLibre 5.24 and rebuilds the style from scratch.
    const dem = { type: "raster-dem", url: "https://example.org/dem.json" };
    const grounded = options.transformStyle({ terrain: { source: "gismap-terrain-dem", exaggeration: 1.2 }, sources: { "gismap-terrain-dem": dem }, layers: [] }, style);
    assert.deepEqual(grounded.terrain, { source: "gismap-terrain-dem", exaggeration: 1.2 }, "3D ground rides along");
    assert.deepEqual(grounded.sources["gismap-terrain-dem"], dem, "with the elevation source it draws from");

    const midnight = themeFromTokens(tokensFor("dark-analytical"), { skin: "dark-analytical", dark: true });
    engine.setBasemapTheme(midnight);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(engine.map.styles.at(-1).style.layers.find((layer) => layer.type === "background").paint["background-color"], midnight.land, "a skin change restyles the skin basemap");
    assert.equal(fetched.filter((url) => /positron$/.test(url)).length, 1, "the base style is fetched once");
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("3D buildings are added under the labels and follow the skin", async () => {
  const { withBuildings3d, applyBasemapTheme: theme } = await import("../js/engines/maplibre/basemap-theme.js");
  const { readFileSync } = await import("node:fs");
  const load = (name) => JSON.parse(readFileSync(new URL(`./fixtures/openfreemap-${name}.json`, import.meta.url), "utf8"));
  const positron = load("positron");
  const built = withBuildings3d(positron);
  const index = built.layers.findIndex((layer) => layer.id === "building-3d");
  assert.ok(index > built.layers.findIndex((layer) => layer.id === "building"));
  assert.ok(index < built.layers.findIndex((layer) => layer.type === "symbol"));
  assert.equal(built.layers[index].type, "fill-extrusion");
  assert.equal(built.layers[index].minzoom, 13);
  assert.equal(withBuildings3d(positron, { visible: false }).layers.find((layer) => layer.id === "building-3d").layout.visibility, "none");
  assert.equal(positron.layers.some((layer) => layer.id === "building-3d"), false, "the input is unchanged");
  const liberty = load("liberty");
  assert.deepEqual(withBuildings3d(liberty).layers.filter((layer) => layer.type === "fill-extrusion").map((layer) => layer.id), ["building-3d"], "a style with 3D buildings keeps its own");
  const skinned = theme(built, { skin: "highway", building: "#abcdef", buildingOutline: "#123456" });
  assert.equal(skinned.layers.find((layer) => layer.id === "building-3d").paint["fill-extrusion-color"], "#abcdef");
});
