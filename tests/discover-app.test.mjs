import test from 'node:test';
import assert from 'node:assert/strict';
// Pages link relative to themselves; these checks read them as root paths.
import { rootLinksHtml } from "../scripts/relative-links.mjs";
import { readFile, stat } from 'node:fs/promises';

const routes = ['/', '/examples/', '/examples/3d-strata/', '/engines/', '/learn/', '/ai/', '/data/', '/demos/', '/embed/', '/about/', '/get-involved/'];

test('Discover is a standalone static application with all public routes', async () => {
  const root = new URL('../discover/', import.meta.url);
  await stat(new URL('discovery.css', root));
  for (const route of routes) {
    const file = route === '/' ? 'index.html' : `${route.slice(1)}index.html`;
    const page = rootLinksHtml(`discover/${file}`, await readFile(new URL(file, root), 'utf8'));
    assert.match(page, /<main(?:\s|>)/, route);
    assert.match(page, /\/discover\/discovery\.css/, route);
    // Discover loads no mapping libraries (it may still name them in its copy).
    assert.doesNotMatch(page, /<(?:script|link)\b[^>]*(?:src|href)="[^"]*(?:js\.arcgis\.com|maplibre|three\.module|duckdb)/i, route);
  }
});

test('Discover stays separate from the mapping workspace and is linked from it', async () => {
  const [workspace, sitemap, manifest, featured] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8').then((html) => rootLinksHtml('index.html', html)),
    readFile(new URL('../sitemap.xml', import.meta.url), 'utf8'),
    readFile(new URL('../discover/content/collections.json', import.meta.url), 'utf8'),
    readFile(new URL('../discover/content/featured.json', import.meta.url), 'utf8'),
  ]);
  assert.match(workspace, /class="menu-bar__discover" href="\/discover\/"/);
  assert.match(workspace, /target="_blank" rel="noopener"/);
  assert.match(sitemap, /https:\/\/gismap\.online\/discover\//);
  assert.equal(JSON.parse(manifest).version, 1);
  const entries = JSON.parse(featured);
  assert.equal(entries.version, 1);
  assert.ok(entries.featured.length >= 4);
  assert.ok(entries.featured.every((item) => item.title && item.href?.startsWith('/')));
});

test('Examples lead with visual, styled map starting points', async () => {
  const page = await readFile(new URL('../discover/examples/index.html', import.meta.url), 'utf8');
  assert.match(page, /example-art--fire/);
  assert.match(page, /Open styled map/);
  assert.match(page, /cinematic-ready/);
  assert.match(page, /engine=arcgis/);
  assert.match(page, /engine=maplibre/);
});

test('Map engine guide explains MapLibre basemap cartography without conflating it with data styling', async () => {
  const page = await readFile(new URL('../discover/engines/index.html', import.meta.url), 'utf8');
  assert.match(page, /MapLibre cartography/);
  assert.match(page, /Skin — follows the look/);
  assert.match(page, /Basemap controls never recolor your features/);
});

test('Embed guide distinguishes maps, briefings, and tours with public-source safeguards', async () => {
  const page = await readFile(new URL('../discover/embed/index.html', import.meta.url), 'utf8');
  assert.match(page, /Configured web map/);
  assert.match(page, /Briefing/);
  assert.match(page, /Guided tour/);
  assert.match(page, /Only public remote layers/);
  assert.match(page, /Keep the generated URL intact/);
});
