import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = name => readFile(path.join(root, name), 'utf8');
const featured = ['arcgis-feature-service-viewer/', 'geojson-viewer/', '3d-gis-viewer/'];

test('discovery pages expose unique titles, canonical URLs, questions and valid structured data in HTML', async () => {
  const titles = new Set();
  for (const route of featured) {
    const html = await read(`${route}index.html`);
    const title = html.match(/<title>([^<]+)<\/title>/i)?.[1];
    assert.ok(title && !titles.has(title), `${route} title`); titles.add(title);
    assert.ok(html.includes(`rel="canonical" href="https://gismap.online/${route}"`));
    assert.match(html, /<h1>[^<]+<\/h1><h2>[^<]+\?<\/h2><p>/);
    assert.ok(!/name="robots" content="[^"]*noindex/i.test(html));
    for (const match of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) assert.equal(JSON.parse(match[1])['@context'], 'https://schema.org');
  }
  const home = await read('index.html');
  assert.match(home, /GISMap Online is a free, open-source, browser-based GIS workspace/);
  assert.ok(JSON.parse(home.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]).isAccessibleForFree);
});

test('sitemap points to existing public resources and includes agent discovery', async () => {
  const xml = await read('sitemap.xml');
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  assert.equal(new Set(urls).size, urls.length);
  for (const entry of ['/skills/', '/api/explorer/', '/llms.txt', '/api/catalog.json']) assert.ok(urls.includes(`https://gismap.online${entry}`));
  for (const url of urls) {
    const parsed = new URL(url); assert.equal(parsed.origin, 'https://gismap.online');
    const relative = parsed.pathname.slice(1) + (parsed.pathname.endsWith('/') ? 'index.html' : '');
    assert.ok((await stat(path.join(root, relative))).isFile(), url);
  }
  for (const file of ['api/capabilities.json', 'api/manifest.json', 'schemas/map-v1.schema.json', 'schemas/briefing-v1.schema.json']) JSON.parse(await read(file));
});

test('explicit search crawler policies preserve public access', async () => {
  const robots = await read('robots.txt');
  for (const agent of ['*', 'meta-webindexer', 'OAI-SearchBot']) {
    const group = robots.split(/\n\s*\n/).find(part => part.toLowerCase().includes(`user-agent: ${agent}`.toLowerCase()));
    assert.ok(group && /allow:\s*\//i.test(group), agent);
  }
  assert.match(robots, /Sitemap: https:\/\/gismap\.online\/sitemap\.xml/);
});

// docs/crawler-policy.md: AI crawlers, training ones included, may read the whole site.
test('AI training and answer crawlers are not disallowed and content signals grant AI use', async () => {
  const robots = await read('robots.txt');
  for (const part of robots.split(/\n\s*\n/)) {
    const agents = [...part.matchAll(/^User-agent:\s*(\S+)/gim)].map(m => m[1]);
    if (agents.length) assert.doesNotMatch(part, /^Disallow:\s*\/\s*$/im, `${agents.join(', ')} is disallowed site-wide`);
  }
  for (const agent of ['GPTBot', 'ClaudeBot', 'Google-Extended', 'CCBot', 'Claude-User', 'ChatGPT-User', 'PerplexityBot']) assert.doesNotMatch(robots, new RegExp(`^User-agent:\\s*${agent}\\s*$`, 'im'), `${agent} needs no group of its own; * allows it`);
  assert.match(robots, /^Content-Signal:\s*search=yes,ai-input=yes,ai-train=yes$/m);
});

test('sitemap HTML pages have no missing local link targets', async () => {
  const xml = await read('sitemap.xml');
  for (const [, url] of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    const page = new URL(url);
    const filename = page.pathname.slice(1) + (page.pathname.endsWith('/') ? 'index.html' : '');
    if (!filename.endsWith('.html')) continue;
    const html = await read(filename);
    for (const [, href] of html.matchAll(/<a\b[^>]*\bhref=["']([^"']+)["']/gi)) {
      const target = new URL(href.replaceAll('&amp;', '&'), page);
      if (target.origin !== page.origin || target.pathname === page.pathname) continue;
      let local = path.join(root, decodeURIComponent(target.pathname));
      try { if ((await stat(local)).isDirectory()) local = path.join(local, 'index.html'); await stat(local); }
      catch { assert.fail(`${page.pathname} links to missing ${target.pathname}`); }
    }
  }
});
