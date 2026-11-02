import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// Guards the colour contract: skins define tokens, components consume them.
// A surface must be readable under every skin's --ink, in light and dark.
const css = ["app", "fieldwork"].map((name) => fs.readFileSync(new URL(`../css/${name}.css`, import.meta.url), "utf8")).join("\n");

const TOKEN = /(--[\w-]+)\s*:\s*(#[0-9a-fA-F]{3,6})\b/g;
const tokens = (body) => Object.fromEntries([...body.matchAll(TOKEN)].map((match) => [match[1], match[2]]));
const collect = (pattern) => [...css.matchAll(pattern)].reduce((all, match) => Object.assign(all, tokens(match[1])), {});

const rootTokens = collect(/^:root \{([^}]*)\}/gm);
const skinIds = [...new Set([...css.matchAll(/^:root\[data-skin="([\w-]+)"\](?:\[data-theme="dark"\])? \{/gm)].map((match) => match[1]))];
const palettes = skinIds.flatMap((skin) => {
  const light = { ...rootTokens, ...collect(new RegExp(`^:root\\[data-skin="${skin}"\\] \\{([^}]*)\\}`, "gm")) };
  const dark = { ...light, ...collect(new RegExp(`^:root\\[data-skin="${skin}"\\]\\[data-theme="dark"\\] \\{([^}]*)\\}`, "gm")) };
  return [[`${skin}`, light], [`${skin}/dark`, dark]];
});

const rgb = (hex) => {
  const value = hex.length === 4 ? [...hex.slice(1)].map((c) => c + c).join("") : hex.slice(1);
  return [0, 2, 4].map((at) => parseInt(value.slice(at, at + 2), 16));
};
const mix = (a, amount, b) => rgb(a).map((channel, index) => channel * amount + rgb(b)[index] * (1 - amount));
const luminance = (channels) => {
  const [r, g, b] = channels.map((value) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

test("the contract covers the skins, including dark Highway", () => {
  assert.ok(palettes.length >= 20);
  assert.equal(Object.fromEntries(palettes)["highway/dark"]["--surface"], "#1a1f26");
});

test("derived surfaces stay readable under each skin's ink", () => {
  const failures = [];
  for (const [name, p] of palettes) {
    const surfaces = {
      surface: rgb(p["--surface"]),
      alt: mix(p["--ink"], 0.05, p["--surface"]),
      hover: mix(p["--green-2"], 0.16, p["--surface"]),
      tint: mix(p["--green-2"], 0.1, p["--surface"]),
    };
    for (const [label, fill] of Object.entries(surfaces)) {
      const ratio = contrast(rgb(p["--ink"]), fill);
      if (ratio < 4.5) failures.push(`${name} ink on ${label}: ${ratio.toFixed(2)}`);
    }
  }
  assert.deepEqual(failures, []);
});

test("table headers keep readable text on the accent", () => {
  const failures = [];
  for (const [name, p] of palettes) {
    if (name.startsWith("gismap")) continue; // uses --action-on-primary
    const ratio = contrast(rgb("#ffffff"), rgb(p["--green"]));
    if (ratio < 4) failures.push(`${name}: ${ratio.toFixed(2)}`);
  }
  assert.deepEqual(failures, []);
});

// Fills that are deliberately fixed: paper for images and QR codes, map chrome,
// and legend or marker swatches that carry no text.
const FIXED_FILLS = /canvas|img|map-note|map-workspace|map-templates__preview|explorer-legend|task-checkin|backdrop|utility-tab|si-embed-rail/;

test("component rules never set a literal background without pairing a text colour", () => {
  const offenders = [];
  for (const [, selector, body] of css.matchAll(/(?:^|\n)([^{}\n@]+)\{([^{}]*)\}/g)) {
    if (selector.includes("data-skin") || selector.includes("data-theme") || FIXED_FILLS.test(selector)) continue;
    if (!/background(?:-color)?:\s*(?:#|white\b|rgba?\()/.test(body)) continue;
    if (!/(?:^|[;\s])color:/.test(body)) offenders.push(selector.trim());
  }
  assert.deepEqual(offenders, []);
});
