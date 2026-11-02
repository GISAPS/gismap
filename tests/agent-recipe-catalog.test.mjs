// The agent recipe catalog: schema conformance, real API references, and discovery.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as tourShare from "../js/tour-share.js";
import * as fieldTaskShare from "../js/field-task-share.js";
import * as pointcloudLas from "../js/pointcloud-las.js";

const text = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const json = async (path) => JSON.parse(await text(path));
const CANONICAL = ["interactive-map", "interactive-briefing", "geographic-tour", "field-tasks", "3d-extrusion", "vibe-map"];
const schema = await json("schemas/agent-recipe-v1.schema.json");
const catalog = await json("api/agent-recipes/index.json");
const recipes = await Promise.all(catalog.recipes.map((entry) => json(`api/agent-recipes/${entry.id}.json`)));
const capabilities = await json("api/capabilities.json");

// A small subset of JSON Schema: required, const, enum, pattern, type, items, additionalProperties, $ref.
function check(value, rule, path = "$", errors = []) {
  if (rule.$ref) return check(value, schema.$defs[rule.$ref.split("/").pop()], path, errors);
  if ("const" in rule && value !== rule.const) errors.push(`${path} must be ${JSON.stringify(rule.const)}`);
  if (rule.enum && !rule.enum.includes(value)) errors.push(`${path} must be one of ${rule.enum.join(", ")}`);
  if (rule.pattern && !new RegExp(rule.pattern).test(value)) errors.push(`${path} must match ${rule.pattern}`);
  if (rule.type === "array") {
    if (!Array.isArray(value)) return errors.push(`${path} must be an array`), errors;
    if (rule.minItems && value.length < rule.minItems) errors.push(`${path} needs ${rule.minItems} items`);
    if (rule.items) value.forEach((item, index) => check(item, rule.items, `${path}[${index}]`, errors));
  }
  if (rule.type === "object" || rule.properties) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return errors.push(`${path} must be an object`), errors;
    for (const key of rule.required || []) if (!(key in value)) errors.push(`${path}.${key} is required`);
    for (const [key, item] of Object.entries(value)) {
      if (rule.properties?.[key]) check(item, rule.properties[key], `${path}.${key}`, errors);
      else if (rule.additionalProperties === false) errors.push(`${path}.${key} is not allowed`);
    }
  }
  if (rule.type === "string" && typeof value !== "string") errors.push(`${path} must be a string`);
  if (rule.type === "boolean" && typeof value !== "boolean") errors.push(`${path} must be a boolean`);
  return errors;
}

test("the catalog lists the six canonical recipes, each published and schema-valid", async () => {
  assert.deepEqual(CANONICAL.filter((id) => !catalog.recipes.some((entry) => entry.id === id)), []);
  for (const recipe of recipes) {
    assert.deepEqual(check(recipe, schema), [], recipe.id);
    if (CANONICAL.includes(recipe.id)) assert.equal(recipe.status, "available", recipe.id);
    assert.deepEqual([...new Set(recipe.steps.map((step) => step.stage))].filter((stage) => !["discover", "inspect", "plan", "validate", "execute", "verify", "share"].includes(stage)), []);
    assert.ok(recipe.examples.some((item) => item.url || item.page), `${recipe.id} has an example to open`);
    assert.match(await text(`agent-recipes/${recipe.id}/index.html`), new RegExp(`<link rel="canonical" href="https://gismap.online/agent-recipes/${recipe.id}/">`));
  }
  assert.deepEqual(catalog.resultStatuses, ["prepared", "validated", "loaded", "rendered", "verified", "partial", "failed"]);
});

test("recipe steps reference real API members and module exports, never a hosted endpoint", () => {
  const modules = { "tour-share.js": tourShare, "field-task-share.js": fieldTaskShare, "pointcloud-las.js": pointcloudLas };
  const namespaces = capabilities.namespaces;
  for (const recipe of recipes) for (const step of recipe.steps) for (const reference of step.references || []) {
    const member = /^([a-zA-Z]+)\.([a-zA-Z]+)$/.exec(reference);
    const exported = /^([\w-]+\.js)#(\w+)$/.exec(reference);
    if (member && namespaces[member[1]]) assert.ok(namespaces[member[1]].includes(member[2]), `${recipe.id}: ${reference} is not in capabilities.json`);
    if (exported) assert.ok(exported[2] in modules[exported[1]], `${recipe.id}: ${reference} is not exported`);
    if (step.interfaces.includes("in-browser-api")) assert.doesNotMatch(step.action, /\b(POST|GET|REST endpoint|HTTP API)\b/, `${recipe.id} ${step.stage}`);
  }
});

test("recipes are discoverable from every agent surface", async () => {
  const surfaces = ["llms.txt", "llms-full.txt", "skills/index.html", "skills/gismap/SKILL.md", "guides/ai-agents/index.html", "examples/index.html", "sitemap.xml"];
  for (const path of surfaces) assert.match(await text(path), /\/agent-recipes\//, path);
  assert.equal(capabilities.documentation.agentRecipes, "/api/agent-recipes/index.json");
  assert.equal(capabilities.schemas.agentRecipe, "/schemas/agent-recipe-v1.schema.json");
  assert.equal((await json("api/manifest.json")).discovery.agentRecipes, "/api/agent-recipes/index.json");
  assert.match(await text("llms.txt"), /## What can AI agents create with GISMap Online\?/);
  const sitemap = await text("sitemap.xml");
  for (const recipe of recipes) assert.ok(sitemap.includes(`https://gismap.online/agent-recipes/${recipe.id}/`), recipe.id);
});
