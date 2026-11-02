// Validate the deployed HTTP response, not just the source files. No browser or dependencies required.
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { inflateRawSync } from 'node:zlib';

// Inspect the ZIP directory and decompress/check every entry. Reject HTML, truncation and corrupt archives.
function validateSkillZip(bytes) {
  assert.ok(bytes.length <= 10_000_000, 'Skill ZIP is unexpectedly large');
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (bytes.readUInt32LE(i) === 0x06054b50 && i + 22 + bytes.readUInt16LE(i + 20) === bytes.length) { eocd = i; break; }
  }
  assert.ok(eocd >= 0, 'Skill ZIP missing end-of-directory record');
  const count = bytes.readUInt16LE(eocd + 10), directorySize = bytes.readUInt32LE(eocd + 12), directoryOffset = bytes.readUInt32LE(eocd + 16);
  assert.ok(count > 0 && count < 1000 && directoryOffset + directorySize === eocd, 'Invalid ZIP directory');
  const names = new Set(); let pos = directoryOffset;
  for (let i = 0; i < count; i++) {
    assert.ok(pos + 46 <= eocd && bytes.readUInt32LE(pos) === 0x02014b50, 'Invalid ZIP entry');
    const method = bytes.readUInt16LE(pos + 10), crc = bytes.readUInt32LE(pos + 16), packed = bytes.readUInt32LE(pos + 20), size = bytes.readUInt32LE(pos + 24);
    const n = bytes.readUInt16LE(pos + 28), extra = bytes.readUInt16LE(pos + 30), comment = bytes.readUInt16LE(pos + 32), local = bytes.readUInt32LE(pos + 42);
    assert.ok(pos + 46 + n + extra + comment <= eocd && local + 30 <= directoryOffset && size <= 10_000_000, 'Invalid ZIP bounds');
    const name = bytes.subarray(pos + 46, pos + 46 + n).toString('utf8'); names.add(name);
    assert.equal(bytes.readUInt32LE(local), 0x04034b50, 'Invalid ZIP local header');
    const start = local + 30 + bytes.readUInt16LE(local + 26) + bytes.readUInt16LE(local + 28);
    assert.ok(start + packed <= directoryOffset, 'Truncated ZIP data');
    const data = bytes.subarray(start, start + packed);
    assert.ok(method === 0 || method === 8, 'Unsupported ZIP compression');
    const unpacked = method === 8 ? inflateRawSync(data, { maxOutputLength: 10_000_000 }) : data;
    assert.equal(unpacked.length, size, 'Incorrect ZIP entry size');
    let checksum = 0xffffffff;
    for (const byte of unpacked) { checksum ^= byte; for (let bit = 0; bit < 8; bit++) checksum = (checksum >>> 1) ^ (0xedb88320 & -(checksum & 1)); }
    assert.equal((checksum ^ 0xffffffff) >>> 0, crc, 'Corrupt ZIP entry');
    pos += 46 + n + extra + comment;
  }
  assert.equal(pos, eocd, 'Invalid ZIP directory size');
  for (const name of ['gismap/SKILL.md', 'gismap/references/agent-recipes.md']) assert.ok(names.has(name), `Skill ZIP missing ${name}`);
}

export async function smokeLlms(base, { matchLocal = false, fetcher = fetch } = {}) {
  const origin = new URL(base);
  if (!['https:', 'http:'].includes(origin.protocol) || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) throw new Error('Supply a deployment origin such as https://preview.example.pages.dev');
  const request = async (path, { binary = false } = {}) => {
    const response = await fetcher(new URL(path, origin), { redirect: 'manual', signal: AbortSignal.timeout(30000), headers: { Accept: binary ? 'application/zip' : path === '/skills/' ? 'text/html' : 'text/plain' } });
    const bytes = Buffer.from(await response.arrayBuffer());
    const content = binary ? bytes : bytes.toString('utf8');
    console.log(`${path}: HTTP ${response.status}; Content-Type: ${response.headers.get('content-type') || '(missing)'}; CF-Cache-Status: ${response.headers.get('cf-cache-status') || '(not reported)'}; Cache-Control: ${response.headers.get('cache-control') || '(missing)'}; ETag: ${response.headers.get('etag') || '(missing)'}; Last-Modified: ${response.headers.get('last-modified') || '(missing)'}; Expires: ${response.headers.get('expires') || '(missing)'}`);
    return { response, content };
  };
  for (const path of ['/llms.txt', '/llms-full.txt']) {
    const { response, content } = await request(path);
    assert.equal(response.status, 200, `${path} must be served directly`);
    assert.match(response.headers.get('content-type') || '', /^text\/plain\s*;\s*charset\s*=\s*utf-8\s*$/i, `${path} must be UTF-8 plain text`);
    assert.match(content, /^# GISMap Online\r?\n/, `${path} must start with the GISMap Online heading`);
    assert.doesNotMatch(content, /^\s*(?:<!doctype\s+html|<html\b)/i, `${path} must not be an HTML fallback`);
    for (const reference of ['/schemas/map-v1.schema.json', '/api/capabilities.json', '/skills/']) assert.ok(content.includes(reference), `${path} is missing ${reference}`);
    if (matchLocal) assert.equal(content, await readFile(new URL(`..${path}`, import.meta.url), 'utf8'), `${path} differs from the checked-out deployment artifact (stale cache or wrong deployment)`);
  }
  const skillPage = await request('/skills/');
  assert.equal(skillPage.response.status, 200, 'Skill page must be served directly');
  assert.match(skillPage.response.headers.get('content-type') || '', /^text\/html(?:\s*;|$)/i, 'Skill page must be HTML');
  assert.match(skillPage.content, /<h1>GISMap Online Agent Skill<\/h1>/, 'Skill page must not be a fallback or challenge');
  for (const id of ['interactive-map', 'interactive-briefing', 'geographic-tour', 'field-tasks', '3d-extrusion', 'spatial-3d-chart', 'lidar-and-3d-models', 'vibe-map']) assert.ok(skillPage.content.includes(`recipe-${id}`), `Skill page missing ${id}`);
  if (matchLocal) assert.equal(skillPage.content, await readFile(new URL('../skills/index.html', import.meta.url), 'utf8'), 'Skill page differs from checkout (stale cache or wrong deployment)');
  for (const [path, heading] of [['/skills/gismap/SKILL.md', /^---\r?\nname: gismap\r?\n/], ['/skills/gismap/references/agent-recipes.md', /^# Eight composable agent recipes\b/]]) {
    const { response, content } = await request(path);
    assert.equal(response.status, 200, `${path} must be served directly`);
    assert.match(response.headers.get('content-type') || '', /^text\/plain\s*;\s*charset\s*=\s*utf-8\s*$/i, `${path} must be UTF-8 plain text`);
    assert.match(content, heading, `${path} must contain the expected Markdown`);
    assert.doesNotMatch(content, /^\s*(?:<!doctype\s+html|<html\b)/i, `${path} must not be an HTML fallback`);
    if (matchLocal) assert.equal(content, await readFile(new URL(`..${path}`, import.meta.url), 'utf8'), `${path} differs from checkout (stale cache or wrong deployment)`);
  }
  const zip = await request('/skills/gismap.zip', { binary: true });
  assert.equal(zip.response.status, 200, 'Skill ZIP must be served directly');
  assert.match(zip.response.headers.get('content-type') || '', /^application\/zip(?:\s*;|$)/i, 'Skill ZIP must be application/zip');
  validateSkillZip(zip.content);
  if (matchLocal) assert.deepEqual(zip.content, await readFile(new URL('../skills/gismap.zip', import.meta.url)), 'Skill ZIP differs from checkout (stale cache or wrong deployment)');
  const alias = await request('/llm.txt');
  assert.equal(alias.response.status, 301, 'The singular alias must be a permanent 301');
  assert.equal(new URL(alias.response.headers.get('location') || '', origin).href, new URL('/llms.txt', origin).href, 'The alias must point to the canonical endpoint on the same origin');
  const missing = await request('/__gismap_nonexistent_documentation_smoke_test__.txt');
  assert.equal(missing.response.status, 404, 'Missing documents must return a real 404');
  // Edge bot rules act on the user agent before robots.txt. Search and user-initiated
  // readers must get through; training crawlers are reported, since blocking them may be deliberate.
  // A spoofed user agent cannot prove what a verified crawler (checked by IP) receives.
  const crawlers = { required: ['bingbot/2.0', 'Googlebot/2.1', 'OAI-SearchBot/1.0', 'ChatGPT-User/1.0', 'Claude-User/1.0', 'Claude-SearchBot/1.0', 'PerplexityBot/1.0'], reported: ['ClaudeBot/1.0', 'GPTBot/1.0', 'CCBot/2.0', 'Amazonbot/0.1'] };
  for (const [group, agents] of Object.entries(crawlers)) for (const agent of agents) for (const path of ['/skills/', '/llms.txt']) {
    const response = await fetcher(new URL(path, origin), { redirect: 'manual', signal: AbortSignal.timeout(30000), headers: { 'User-Agent': agent } });
    await response.arrayBuffer();
    console.log(`${path} as ${agent}: HTTP ${response.status}`);
    if (group === 'required') assert.equal(response.status, 200, `${path} is blocked for ${agent}; check Cloudflare bot rules`);
  }
  console.log('Documentation smoke test passed.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const base = process.argv[2];
  if (!base) { console.error('Usage: node scripts/smoke-llms.mjs https://deployment.example [--match-local]'); process.exitCode = 2; }
  else smokeLlms(base, { matchLocal: process.argv.includes('--match-local') }).catch(error => { console.error(`Documentation smoke test failed: ${error.message}`); process.exitCode = 1; });
}
