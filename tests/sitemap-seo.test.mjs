import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFile(resolve(root, path), "utf8");
const decode = (text) => text.replace(/&quot;/g, '"').replace(/&#0?39;|&#x27;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const entries = async () => [...(await read("sitemap.xml")).matchAll(/<url><loc>([^<]+)<\/loc>(?:<lastmod>([^<]+)<\/lastmod>)?<\/url>/g)].map(([, loc, lastmod]) => ({ loc, lastmod }));
const fileFor = (loc) => `${new URL(loc).pathname.slice(1)}index.html`;

// Deliberately outside the sitemap.
const EXCLUDED = new Set([
  "dragons/index.html", // A hidden page.
]);
const SKIPPED_DIRS = new Set(["tests", "docs", "node_modules", "tmp", ".git", ".claude", ".wrangler"]);

async function indexPages(directory = root) {
  const pages = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && !SKIPPED_DIRS.has(entry.name)) pages.push(...await indexPages(join(directory, entry.name)));
    else if (entry.name === "index.html") pages.push(relative(root, join(directory, entry.name)));
  }
  return pages;
}

test("every sitemap page has complete, well-sized metadata", async () => {
  const titles = new Set();
  const list = await entries();
  assert.ok(list.length > 60);
  for (const { loc, lastmod } of list) {
    assert.match(lastmod || "", /^\d{4}-\d{2}-\d{2}$/, `${loc} needs a lastmod`);
    if (!loc.endsWith("/")) continue;
    const html = await read(fileFor(loc));
    const title = decode(html.match(/<title>([^<]+)<\/title>/)?.[1] || "");
    const description = decode(html.match(/<meta\s+name="description"\s+content="([^"]+)"/)?.[1] || "");
    assert.ok(title && title.length <= 65, `${loc} title: ${title}`);
    assert.ok(!titles.has(title), `duplicate title: ${title}`);
    titles.add(title);
    assert.ok(description.length >= 70 && description.length <= 160, `${loc} description is ${description.length} characters`);
    assert.equal(html.match(/<link\s+rel="canonical"\s+href="([^"]+)"/)?.[1], loc);
    assert.doesNotMatch(html, /<meta\s+name="robots"[^>]*noindex/);
    for (const name of ["og:title", "og:description", "og:url", "og:image"]) assert.match(html, new RegExp(`property="${name}"`), `${loc} needs ${name}`);
    assert.match(html, /name="twitter:card"/, `${loc} needs a Twitter card`);
  }
});

test("every page is in the sitemap or deliberately excluded", async () => {
  const listed = new Set((await entries()).filter(({ loc }) => loc.endsWith("/")).map(({ loc }) => fileFor(loc)));
  for (const page of await indexPages()) assert.ok(page === "index.html" || listed.has(page) || EXCLUDED.has(page), `${page} is not in the sitemap`);
});

test("robots.txt points at the sitemap and every group repeats each Disallow", async () => {
  const robots = await read("robots.txt");
  assert.match(robots, /^Sitemap: https:\/\/gismap\.online\/sitemap\.xml$/m);
  const groups = robots.split(/^(?=User-agent:)/m).filter((group) => group.startsWith("User-agent:"));
  const rules = (group) => group.match(/^Disallow:.*$/gm) || [];
  const shared = rules(groups.find((group) => group.startsWith("User-agent: *")));
  for (const group of groups) for (const rule of shared) assert.ok(rules(group).includes(rule), `${group.split("\n")[0]} lacks ${rule}`);
});
