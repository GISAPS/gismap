// Every place a person, search engine or agent reads the product's name says
// GISMap Online. Bare "GISMap" is only checked in HTML and llms*.txt: in JavaScript
// it cannot be told apart from comments and identifiers reliably enough.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import { BRAND, brandWordmark } from "../js/brand.js";

const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], { encoding: "utf8" }).split("\n");
const shipped = files.filter((file) => !file.startsWith("tmp/") && !file.includes("vendor") && !file.includes(".min.")
  && (/\.html$/.test(file) || /^llms(-full)?\.txt$/.test(file) || /^skills\/.*\.md$/.test(file) || /^api\/.*\.json$/.test(file)
    || file === "manifest.webmanifest" || /^(js|field)\/.*\.js$/.test(file)));
const WRONG = /GIS Map Online|GISMap\.[Oo]nline|GIS MAP|Gismap\b|\bGisMap\b(?!Error)|GIS-Map|(?<!Arc)GIS Map\b/g;
// "GISMap SI" is a separate product; the Field header wordmark draws "GISMap" beside "Online", and Discover over "ONLINE".
const clean = (text) => text.replace(/"alternateName":\s*\[[^\]]*\]/g, "").replace(/alternateName: Object\.freeze\(\[[^\]]*\]/g, "").replace(/GISMap SI\b/g, "").replace(/<span>GISMap(<\/span>|<small>)/g, "");
const BARE = /(?<![\w./:@-])GISMap(?![\w-]| Online|\.[a-z])/;
const text = (file) => clean(readFileSync(file, "utf8"));

test("shipped files use no retired spelling of the name", () => {
  const problems = shipped.flatMap((file) => (text(file).match(WRONG) || []).map((hit) => `${file}: ${hit}`));
  assert.deepEqual(problems, []);
});

test("pages and llms files never use the bare name", () => {
  const scripts = /<script\b(?![^>]*ld\+json)[\s\S]*?<\/script>/g;
  const problems = shipped.filter((file) => /\.(html|txt)$/.test(file) && BARE.test(text(file).replace(scripts, "").replace(/<!--[\s\S]*?-->/g, "")));
  assert.deepEqual(problems, []);
});

test("every page names its site GISMap Online", () => {
  for (const file of shipped.filter((name) => name.endsWith(".html"))) {
    const name = readFileSync(file, "utf8").match(/og:site_name" content="([^"]*)"/)?.[1];
    if (name) assert.equal(name, BRAND.name, file);
  }
});

test("the PDF wordmark and metadata carry the name, and an installation can rename them", () => {
  const pdf = readFileSync("js/pdf-document.js", "utf8");
  assert.doesNotMatch(pdf, /\(GIS MAP\)/);
  assert.match(pdf, /\/Creator \(\$\{name\}\) \/Producer \(\$\{name\}\)/);
  assert.deepEqual(brandWordmark(), { primary: "GISMap", secondary: "ONLINE" });
  assert.deepEqual(brandWordmark("Acme Maps"), { primary: "Acme Maps", secondary: "" });
});
