import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { checkContracts } from "../scripts/check-contracts.mjs";
import { MADE_WITH_TEXT, madeWithHtml, showsMadeWith } from "../js/made-with.js";
import { PROMPT_EXAMPLES } from "../scripts/ai-prompt-examples.mjs";
import { readShareLocation } from "../js/map-share.js";
import { mapSpec } from "../js/gismap-core.js";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const docs = ["llms.txt", "skills/gismap/SKILL.md", "skills/gismap/references/sharing.md"];
const mutated = (path, change) => (file) => read(file).then((text) => (file === path ? change(text) : text));

test("the published contracts agree", async () => {
  assert.deepEqual(await checkContracts({ readText: read, docs }), []);
});

test("the contract check fails on a value missing from one contract", async () => {
  const readText = mutated("schemas/map-v1.schema.json", (text) => text.replace('"geoparquet", ', ""));
  assert.match((await checkContracts({ readText, docs })).join("\n"), /map-v1 layer type differs.*geoparquet/);
});

test("the contract check fails on a broken link, a missing anchor and an invalid example", async () => {
  const broken = '[a](https://gismap.online/nowhere/) [b](https://gismap.online/skills/#no-such-anchor) https://gismap.online/#map=json:%7B%22version%22%3A1%7D';
  const problems = (await checkContracts({ readText: mutated("llms.txt", (text) => `${text}\n${broken}\n`), docs })).join("\n");
  assert.match(problems, /nowhere\/ has no file/);
  assert.match(problems, /no #no-such-anchor anchor/);
  assert.match(problems, /fails mapSpec.validate/);
});

test("capabilities names every value an error hint points agents to", async () => {
  const capabilities = JSON.parse(await read("api/capabilities.json"));
  assert.match(capabilities.errorCodes.UNSUPPORTED_LAYER_TYPE, /map\.layerTypes/);
  for (const value of ["geoparquet", "pointcloud", "model"]) assert.ok(capabilities.map.layerTypes.includes(value));
  assert.equal(capabilities.map.specSchema, "/schemas/map-v1.schema.json");
});

test("the skill description fits the Agent Skills limit and the no-tools path lists every curated dataset", async () => {
  const skill = await read("skills/gismap/SKILL.md");
  const description = skill.match(/^description: (.+)$/m)[1];
  assert.ok(description.length <= 1024 && !/[<>]/.test(description));
  const { datasets } = JSON.parse(await read("api/catalog.json"));
  for (const { slug } of datasets) assert.ok(skill.includes(`?example=${slug}`), slug);
  assert.ok((await read("llms.txt")).indexOf("## If you have no tools") < (await read("llms.txt")).indexOf("## Links a chatbot can write"));
});

test("the made-with credit shows on embeds and shared links of the original installation only", () => {
  assert.equal(showsMadeWith({ search: "?embed=1" }), true);
  assert.equal(showsMadeWith({ hash: "#map=json:%7B%7D" }), true);
  assert.equal(showsMadeWith({ search: "?via=claude", hash: "#tour=json:%7B%7D" }), true);
  assert.equal(showsMadeWith({}), false);
  assert.equal(showsMadeWith({ search: "?embed=1", applicationName: "Acme Maps" }), false);
  assert.match(madeWithHtml(), /href="https:\/\/gismap\.online\/ai\?ref=embed"/);
  assert.ok(madeWithHtml().includes(MADE_WITH_TEXT));
});

test("via never changes what a link opens", async () => {
  const hash = `#map=json:${encodeURIComponent(JSON.stringify({ version: 1, layers: [{ url: "https://example.org/a.geojson", type: "geojson" }] }))}`;
  const plain = await readShareLocation(new URL(`https://gismap.online/${hash}`));
  const credited = await readShareLocation(new URL(`https://gismap.online/?via=claude${hash}`));
  assert.deepEqual(credited, plain);
  assert.equal(JSON.parse(await read("api/url-parameters.json")).query.via.pattern, "^[a-z0-9-]{1,32}$");
});

test("there are 15 prompt examples, each with a screenshot and a valid map link", async () => {
  assert.equal(PROMPT_EXAMPLES.length, 15);
  for (const example of PROMPT_EXAMPLES) {
    const png = await readFile(new URL(`../examples/ai/${example.slug}/screenshot.png`, import.meta.url));
    assert.deepEqual([...png.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47], example.slug);
    const spec = example.link.split("#map=json:")[1];
    if (spec) assert.equal(mapSpec.validate(JSON.parse(decodeURIComponent(spec))).valid, true, example.slug);
  }
  assert.ok(PROMPT_EXAMPLES.some((example) => /CORS_BLOCKED/.test(example.title)));
});
