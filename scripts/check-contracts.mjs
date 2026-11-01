// Fails when the published contracts disagree: an enum value in one contract but
// not another, a link in the agent docs that leads nowhere, or a worked example
// that does not validate. Runs offline against the repository; add --live to also
// fetch every link. `checkContracts` takes readers, so a test can feed it a mismatch.
import { readFile, readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { CONTRACT_ENUMS } from "./contracts.mjs";
import { mapSpec } from "../js/gismap-core.js";

const SITE = "https://gismap.online";
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);

function checkEnums({ mapSchema, rendererSchema, parameters, capabilities, llms }, problems) {
  const compare = (where, actual, expected) => { if (!same(actual, expected)) problems.push(`${where} differs from the source: ${[...new Set([...(actual || []), ...expected])].filter((value) => !(actual || []).includes(value) || !expected.includes(value)).join(", ") || "order"}`); };
  const { layerTypes, renderers, styles, breakMethods, basemaps, ramps, skins, limits, errors } = CONTRACT_ENUMS;
  compare("map-v1 layer type", mapSchema.$defs.layer.properties.type.enum, layerTypes);
  compare("map-v1 basemap", mapSchema.properties.basemap.enum, basemaps);
  compare("map-v1 skin", mapSchema.properties.skin.enum, skins);
  compare("renderer-v1 type", rendererSchema.oneOf.map((variant) => variant.properties.type.const), renderers);
  compare("renderer-v1 method", rendererSchema.$defs.method.enum, breakMethods);
  compare("renderer-v1 ramp", rendererSchema.$defs.ramp.enum, ramps);
  compare("url-parameters layerType", parameters.query.layerType.values, layerTypes);
  compare("url-parameters style", parameters.query.style.values, styles);
  compare("url-parameters method", parameters.query.method.values, breakMethods);
  compare("url-parameters ramp", parameters.query.ramp.values, ramps);
  compare("url-parameters basemap", parameters.query.basemap.values, basemaps);
  for (const [key, expected] of Object.entries({ layerTypes, renderers, styles, breakMethods, basemaps, ramps, skins, errors })) compare(`capabilities map.${key}`, capabilities.map?.[key], expected);
  compare("capabilities layerTypes", capabilities.layerTypes, layerTypes);
  compare("capabilities errorCodes", Object.keys(capabilities.errorCodes || {}), errors);
  if (!same(capabilities.map?.limits, limits)) problems.push("capabilities map.limits differs from the source");
  if (parameters.limits.maxLayers !== limits.maxLayers || parameters.limits.readableMapSpecCharacters !== limits.readableSpecChars || parameters.limits.qrSafeUrlLength !== limits.qrSafeUrlLength) problems.push("url-parameters limits differ from the source");
  for (const [label, values] of [["Layer types", layerTypes], ["Renderer types", renderers], ["Basemaps", basemaps], ["Colour ramps", ramps]]) {
    const line = llms.match(new RegExp(`^- ${label}: (.+)\\.$`, "m"))?.[1];
    if (!line) problems.push(`llms.txt has no "${label}" line`);
    else compare(`llms.txt ${label}`, line.split(", "), values);
  }
}

const headingAnchor = (heading) => heading.trim().toLowerCase().replace(/[`*_]/g, "").replace(/&/g, "").replace(/[^\p{L}\p{N}\s-]/gu, "").replace(/\s/g, "-");
const anchorsIn = (path, text) => path.endsWith(".md")
  ? new Set([...[...text.matchAll(/^#{1,6}\s+(.+)$/gm)].map(([, heading]) => headingAnchor(heading)), ...[...text.matchAll(/<a id="([^"]+)">/g)].map(([, id]) => id)])
  : new Set([...text.matchAll(/\sid=["']([^"']+)["']/g)].map(([, id]) => id));

/** Every URL a document links to: markdown targets and bare site URLs, without trailing punctuation. */
function linksIn(text) {
  const links = new Set([...text.matchAll(/\]\(([^)\s]+)\)/g)].map(([, target]) => target));
  for (const [match] of text.matchAll(/https:\/\/gismap\.online[^\s)"'`<>|\]]*/g)) links.add(match.replace(/[.,;:]+$/, ""));
  return [...links].filter((link) => !/[<>…{}]/.test(link) && !/%3C/i.test(link) && !link.endsWith("json:") && !link.endsWith("/api/agent-recipes/"));
}

async function checkLink(source, link, { readText, redirects }, problems) {
  const base = new URL(source, `${SITE}/`);
  let url;
  try { url = new URL(link, base); } catch { return problems.push(`${source}: malformed link ${link}`); }
  if (url.origin !== SITE) return;
  const pathname = redirects.get(url.pathname.replace(/\/$/, "")) || url.pathname;
  const candidates = pathname.endsWith("/") ? [`${pathname.slice(1)}index.html`] : [pathname.slice(1), `${pathname.slice(1)}/index.html`];
  let path = null, text = null;
  for (const candidate of candidates) {
    try { text = await readText(candidate || "index.html"); path = candidate || "index.html"; break; } catch { /* the next form */ }
  }
  if (text === null) return problems.push(`${source}: ${link} has no file in the site`);
  const anchor = url.hash.slice(1);
  if (anchor && !anchor.includes("=") && !anchorsIn(path, text).has(decodeURIComponent(anchor))) problems.push(`${source}: ${link} has no #${anchor} anchor`);
}

function checkWorkedExamples(source, text, problems) {
  for (const [link] of text.matchAll(/https:\/\/gismap\.online\/[^\s)"'`<>]*#map=json:[^\s)"'`<>]+/g)) {
    if (/%3C|…|<|json:$|json:\{/i.test(link)) continue; // a template, not an example
    let spec;
    try { spec = JSON.parse(decodeURIComponent(link.split("#map=json:")[1])); } catch { problems.push(`${source}: a worked link does not decode`); continue; }
    const { valid, issues } = mapSpec.validate(spec);
    if (!valid) problems.push(`${source}: a worked link fails mapSpec.validate: ${issues.map((issue) => issue.message).join("; ")}`);
  }
}

/** Every problem found, as text. `docs` lists the agent documents to read for links. */
export async function checkContracts({ readText, docs }) {
  const problems = [];
  const json = async (path) => JSON.parse(await readText(path));
  const [mapSchema, rendererSchema, parameters, capabilities, llms, redirectsText] = await Promise.all([
    json("schemas/map-v1.schema.json"), json("schemas/renderer-v1.schema.json"), json("api/url-parameters.json"),
    json("api/capabilities.json"), readText("llms.txt"), readText("_redirects"),
  ]);
  checkEnums({ mapSchema, rendererSchema, parameters, capabilities, llms }, problems);
  const redirects = new Map([...redirectsText.matchAll(/^(\/\S*)\s+(\/\S*)\s+\d+/gm)].map(([, from, to]) => [from.replace(/\/$/, ""), to]));
  const known = new Set(CONTRACT_ENUMS.errors);
  for (const source of docs) {
    const text = await readText(source);
    await Promise.all(linksIn(text).map((link) => checkLink(`/${source}`, link, { readText, redirects }, problems)));
    checkWorkedExamples(source, text, problems);
    for (const [, code] of text.matchAll(/`([A-Z]+_[A-Z_]+)`/g)) if (!known.has(code) && /_(BLOCKED|FAILED|FOUND|LONG|LAYERS|URL|SPEC|TYPE|REQUIRED)$/.test(code)) problems.push(`${source}: ${code} is not an error code in capabilities.json`);
  }
  return problems;
}

async function liveProblems(docs, readText) {
  const links = new Set();
  for (const source of docs) for (const link of linksIn(await readText(source))) if (/^https:/.test(link)) links.add(link.split("#")[0]);
  const problems = [];
  for (const link of links) {
    const response = await fetch(link, { redirect: "follow" }).catch((error) => ({ status: error.message }));
    if (response.status !== 200) problems.push(`${link} returned ${response.status}`);
  }
  return problems;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const readText = (path) => readFile(resolve(root, path), "utf8");
  const references = (await readdir(resolve(root, "skills/gismap/references"))).map((name) => `skills/gismap/references/${name}`);
  const docs = ["llms.txt", "skills/gismap/SKILL.md", ...references];
  const problems = await checkContracts({ readText, docs });
  if (process.argv.includes("--live")) problems.push(...await liveProblems(docs, readText));
  for (const problem of problems) console.error(problem);
  if (problems.length) process.exit(1);
  console.log(`Contracts, links and worked examples agree across ${docs.length} documents.`);
}
