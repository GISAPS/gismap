import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
// Pages link relative to themselves; these checks read them as root paths.
import { rootLinksHtml } from "../scripts/relative-links.mjs";
import { smokeLlms } from '../scripts/smoke-llms.mjs';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
const good = async url => {
  const path = new URL(url).pathname;
  if (path === '/llm.txt') return new Response('', { status: 301, headers: { location: '/llms.txt' } });
  if (path === '/robots.txt') return new Response(await read('robots.txt'), { headers: { 'content-type': 'text/plain; charset=utf-8' } });
  if (path === '/llms.txt' || path === '/llms-full.txt') return new Response(await read(path.slice(1)), { status: 200, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  if (path === '/skills/') return new Response(await read('skills/index.html'), { headers: { 'content-type': 'text/html' } });
  if (path === '/skills/gismap/SKILL.md' || path === '/skills/gismap/references/agent-recipes.md') return new Response(await read(path.slice(1)), { headers: { 'content-type': 'text/plain; charset=utf-8' } });
  if (path === '/skills/gismap.zip') return new Response(await readFile(new URL('skills/gismap.zip', root)), { headers: { 'content-type': 'application/zip' } });
  return new Response('Not found', { status: 404 });
};

test('Cloudflare static delivery config uses plain text and the canonical 301 alias', async () => {
  const headers = await read('_headers');
  for (const path of ['/llms.txt', '/llms-full.txt']) {
    assert.match(headers, new RegExp(`^${path.replace('.', '\\.')}\\n(?:  [^\\n]*\\n)*?  Content-Type: text/plain; charset=utf-8$`, 'm'));
  }
  assert.match(headers, /^\/skills\/\*\.md\n  Content-Type: text\/plain; charset=utf-8$/m);
  assert.match(await read('_redirects'), /^\/llm\.txt\s+\/llms\.txt\s+301\s*$/m);
  assert.match(rootLinksHtml('skills/index.html', await read('skills/index.html')), /href="\/llms\.txt"/);
});

test('deployment smoke test detects content type, stale content, redirects and fallbacks', async () => {
  await smokeLlms('https://preview.example/', { fetcher: good, matchLocal: true });
  await assert.rejects(smokeLlms('https://preview.example/', { fetcher: async url => new URL(url).pathname === '/llms.txt' ? new Response(await read('llms.txt'), { headers: { 'content-type': 'text/markdown' } }) : good(url) }), /plain text/);
  await assert.rejects(smokeLlms('https://preview.example/', { fetcher: async url => new URL(url).pathname === '/skills/gismap/SKILL.md' ? new Response(await read('skills/gismap/SKILL.md'), { headers: { 'content-type': 'text/markdown' } }) : good(url) }), /plain text/);
  await assert.rejects(smokeLlms('https://preview.example/', { fetcher: async url => new URL(url).pathname === '/skills/' ? new Response('<!doctype html><h1>Challenge</h1>', { headers: { 'content-type': 'text/html' } }) : good(url) }), /fallback or challenge/);
  await assert.rejects(smokeLlms('https://preview.example/', { fetcher: async url => new URL(url).pathname === '/skills/gismap.zip' ? new Response('<!doctype html>error', { headers: { 'content-type': 'application/zip' } }) : good(url) }), /ZIP/);
  await assert.rejects(smokeLlms('https://preview.example/', { fetcher: async url => new URL(url).pathname === '/llm.txt' ? new Response('', { status: 302, headers: { location: '/llms.txt' } }) : good(url) }), /permanent 301/);
  await assert.rejects(smokeLlms('https://preview.example/', { fetcher: async url => new URL(url).pathname === '/llms.txt' ? new Response('<!doctype html>', { headers: { 'content-type': 'text/plain; charset=utf-8' } }) : good(url) }), /heading/);
  await assert.rejects(smokeLlms('https://preview.example/', { fetcher: async url => new URL(url).pathname.includes('__gismap_nonexistent') ? new Response('app', { status: 200 }) : good(url) }), /real 404/);
  const beacon = '<script defer src="https://static.cloudflareinsights.com/beacon.min.js/v1" data-cf-beacon=\'{"token":"t"}\'></script>';
  await smokeLlms('https://preview.example/', { matchLocal: true, fetcher: async url => new URL(url).pathname === '/skills/' ? new Response((await read('skills/index.html')).replace('</body>', `${beacon}</body>`), { headers: { 'content-type': 'text/html' } }) : good(url) });
  const robotsAs = body => async url => new URL(url).pathname === '/robots.txt' ? new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8' } }) : good(url);
  await assert.rejects(smokeLlms('https://preview.example/', { fetcher: robotsAs('# BEGIN Cloudflare Managed content\nUser-agent: *\nAllow: /\n') }), /Bot Preference Sync/);
  await assert.rejects(smokeLlms('https://preview.example/', { fetcher: robotsAs('User-agent: GPTBot\nDisallow: /\n') }), /whole site/);
  await assert.rejects(smokeLlms('https://preview.example/', { fetcher: async (url, init) => /GPTBot/.test(init?.headers?.['User-Agent'] || '') ? new Response('Forbidden', { status: 403 }) : good(url) }), /blocked for GPTBot/);
  await assert.rejects(smokeLlms('https://preview.example/', { matchLocal: true, fetcher: async url => new URL(url).pathname === '/llms.txt' ? new Response((await read('llms.txt')) + '\nold cache', { headers: { 'content-type': 'text/plain; charset=utf-8' } }) : good(url) }), /stale cache/);
});
