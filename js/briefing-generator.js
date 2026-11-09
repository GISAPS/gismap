// Builds a briefing from what the map already shows: the layer's style (its
// themed field, categories or classes), its filter, the loaded features and any
// chosen ones. Pure functions, so the result is plain briefing JSON
// (briefing-document.js) that the author can edit before sharing.
import { createSlide, isRoutineField, newId, normalizeBriefing } from "./briefing-document.js?v=0.70.4-sequence";

const MAX_FEATURE_SLIDES = 12;
const TOP_FEATURES = 5;
const MAX_CATEGORY_STATS = 4;

const finite = (value) => (value == null || value === "" ? NaN : Number(value));
const number = (value) => (Number.isFinite(value) ? value.toLocaleString(undefined, { maximumFractionDigits: Math.abs(value) >= 100 ? 0 : 2 }) : "–");

/**
 * What a renderer says about the data: the field it themes on, how
 * (categories, classes or a continuous ramp/size), and its categories or classes.
 * Accepts renderer JSON as layer.renderer.toJSON() writes it.
 */
// Styles that keep codes like -1 out of their classes draw from an Arcade expression
// ($feature["FIELD"]) instead of naming the field; the field is read from it.
const expressionField = (renderer) => String(renderer?.valueExpression || "").match(/\$feature\[(?:"([^"]+)"|'([^']+)')\]|\$feature\.([A-Za-z_]\w*)/)?.slice(1).find(Boolean) || null;

export function rendererTheme(renderer) {
  if (!renderer || typeof renderer !== "object") return { kind: "none", field: null };
  const variable = (renderer.visualVariables || []).find((item) => item?.field);
  if (renderer.type === "uniqueValue" && renderer.field1) {
    return { kind: "categories", field: renderer.field1, categories: (renderer.uniqueValueInfos || []).map((info) => ({ value: info.value, label: info.label || String(info.value) })) };
  }
  if (renderer.type === "classBreaks" && (renderer.field || expressionField(renderer))) {
    let lower = Number.isFinite(renderer.minValue) ? renderer.minValue : -Infinity;
    const classes = (renderer.classBreakInfos || []).map((info) => {
      const min = Number.isFinite(info.classMinValue) ? info.classMinValue : lower;
      const max = info.classMaxValue;
      lower = max;
      return { min, max, label: info.label || `${number(min)} – ${number(max)}` };
    });
    return { kind: "classes", field: renderer.field || expressionField(renderer), classes };
  }
  if (variable) return { kind: variable.type === "sizeInfo" ? "size" : "ramp", field: variable.field };
  if (renderer.type === "heatmap") return { kind: "heat", field: renderer.field || null };
  return { kind: "single", field: null };
}

/** Plain-language form of a simple SQL filter ("acres > 10 AND state = 'CA'"), for slide subtitles. */
export function describeWhere(where, alias = (name) => name) {
  const text = String(where ?? "").trim();
  if (!text || /^(1\s*=\s*1|true)$/i.test(text)) return "";
  const words = { ">=": "at least", "<=": "at most", "<>": "is not", "!=": "is not", ">": "over", "<": "under", "=": "is" };
  return text
    .replace(/\b([A-Za-z_][\w]*)\s*(>=|<=|<>|!=|>|<|=)\s*('(?:[^']|'')*'|[-\d.]+)/g, (_, field, op, value) => `${alias(field)} ${words[op]} ${value.replace(/^'|'$/g, "").replaceAll("''", "'")}`)
    .replace(/\bAND\b/gi, "and").replace(/\bOR\b/gi, "or")
    .slice(0, 160);
}

/**
 * The briefing for a styled, filtered layer.
 *   layerTitle, title, where (the layer filter), renderer (JSON), url (source)
 *   records: loaded features ({ attributes, geometry }); total: features in the layer
 *   fields: [{ name, alias, type }]; idField; label(record) -> display name
 *   camera: { center, zoom, heading, tilt } for the overview slides
 *   selectedIds: chosen features (these become the feature slides when given)
 *   scope / scopeText: a briefing filter (briefing-document filter JSON) already
 *   narrowing the features, e.g. from the Features tab; every number respects it
 */
export function generateBriefing({ layerTitle = "Features", title = "", where = "", renderer = null, url = "", records = [], total = null, fields = [], idField = null, label = (record) => String(record?.attributes?.[idField] ?? "Feature"), camera = null, selectedIds = [], scope = null, scopeText = "", date = new Date() }) {
  const field = (name) => fields.find((item) => item.name === name);
  const alias = (name) => field(name)?.alias || name;
  const theme = rendererTheme(renderer);
  const themeIsNumber = theme.field && records.some((record) => Number.isFinite(finite(record.attributes?.[theme.field])));
  const filterText = [describeWhere(where, alias), scopeText].filter(Boolean).join(" and ");
  const count = Number.isFinite(total) ? total : records.length;
  const heading = title || `${layerTitle} briefing`;
  const queries = {};
  const scoped = scope ? (filter) => (filter ? { op: "and", args: [scope, filter] } : scope) : (filter) => filter;
  if (scope) queries.scope = scope;
  const scopeRef = scope ? "scope" : null;
  const slides = [];

  // 1. Title: what is shown, how it is styled and filtered.
  const subtitle = [`${count.toLocaleString()} ${layerTitle}`, filterText, date.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })].filter(Boolean).join(" · ");
  const titleSlide = createSlide("title", { title: heading, subtitle, camera, date });
  const how = theme.field
    ? `The map styles **${layerTitle}** by **${alias(theme.field)}**${theme.kind === "categories" ? ` in ${theme.categories.length} categories` : theme.kind === "classes" ? ` in ${theme.classes.length} classes` : ""}.`
    : `The map shows **${layerTitle}**.`;
  titleSlide.blocks = [{ id: newId("b"), type: "text", markdown: `${how}${filterText ? ` Only features where ${filterText} are included.` : ""}` }];
  slides.push(titleSlide);

  // 2. Key numbers: the count, and totals of the themed number.
  const numbers = createSlide("key-numbers", { title: "At a glance", subtitle: filterText ? `Where ${filterText}` : "" });
  numbers.blocks = [{ id: newId("b"), type: "stat", stat: "count", queryRef: scopeRef, label: layerTitle }];
  if (themeIsNumber) {
    numbers.blocks.push(
      { id: newId("b"), type: "stat", stat: "sum", field: theme.field, queryRef: scopeRef, label: `Total ${alias(theme.field)}` },
      { id: newId("b"), type: "stat", stat: "average", field: theme.field, queryRef: scopeRef, label: `Average ${alias(theme.field)}` },
      { id: newId("b"), type: "stat", stat: "max", field: theme.field, queryRef: scopeRef, label: `Highest ${alias(theme.field)}` },
    );
  }
  slides.push(numbers);

  // 3. The style's own story: counts per category, or per class.
  if (theme.kind === "categories") {
    const counts = new Map();
    records.forEach((record) => { const value = record.attributes?.[theme.field]; counts.set(value, (counts.get(value) || 0) + 1); });
    const top = theme.categories.map((category) => ({ ...category, count: counts.get(category.value) || 0 })).sort((a, b) => b.count - a.count).slice(0, MAX_CATEGORY_STATS);
    if (top.length) {
      const slide = createSlide("key-numbers", { title: `By ${alias(theme.field)}` });
      slide.blocks = top.map((category, index) => {
        const ref = `category-${index + 1}`;
        queries[ref] = scoped({ op: "eq", field: theme.field, value: category.value });
        return { id: newId("b"), type: "stat", stat: "count", queryRef: ref, label: String(category.label).slice(0, 80) };
      });
      slides.push(slide);
    }
  } else if (theme.kind === "classes" && theme.classes.length) {
    const slide = createSlide("map-narrative", { title: `How ${alias(theme.field)} is classed`, camera });
    const items = theme.classes.map((range) => {
      const inClass = records.filter((record) => { const value = finite(record.attributes?.[theme.field]); return value > range.min && value <= range.max || (value === range.min && range.min === theme.classes[0].min); }).length;
      return `${range.label}: ${inClass.toLocaleString()} feature${inClass === 1 ? "" : "s"}`;
    });
    slide.blocks = [{ id: newId("b"), type: "text", markdown: `Features are coloured by **${alias(theme.field)}** in ${theme.classes.length} classes.` }, { id: newId("b"), type: "list", items }];
    slides.push(slide);
  }

  // 4. Features: the chosen ones, or the top few by the themed number.
  const idOf = (record) => (idField && record.attributes?.[idField] != null ? String(record.attributes[idField]) : null);
  const chosen = new Set(selectedIds.map(String));
  let featured = chosen.size ? records.filter((record) => chosen.has(idOf(record))) : [];
  let ranked = [];
  if (themeIsNumber) ranked = records.filter((record) => Number.isFinite(finite(record.attributes?.[theme.field]))).sort((a, b) => finite(b.attributes[theme.field]) - finite(a.attributes[theme.field]));
  if (!featured.length) featured = ranked.slice(0, TOP_FEATURES);
  const sum = ranked.reduce((total, record) => total + finite(record.attributes[theme.field]), 0);
  const otherFacts = fields.filter((item) => item.name !== theme.field && !isRoutineField(item, { idField })).map((item) => item.name);
  for (const record of featured.slice(0, MAX_FEATURE_SLIDES)) {
    const id = idOf(record);
    if (!id) continue;
    const facts = [theme.field, ...otherFacts.filter((name) => record.attributes?.[name] != null && record.attributes[name] !== "")].filter(Boolean).slice(0, 5);
    const slide = createSlide("feature", { title: label(record), featureId: id, fields: facts });
    const rank = ranked.indexOf(record);
    if (themeIsNumber && rank >= 0) {
      const value = finite(record.attributes[theme.field]);
      const share = sum > 0 ? ` (${(value / sum * 100).toFixed(1)}% of the total)` : "";
      slide.blocks.find((block) => block.type === "text").markdown = `Ranks **#${rank + 1}** of ${ranked.length.toLocaleString()} by ${alias(theme.field)}, with **${number(value)}**${share}.`;
    }
    slides.push(slide);
  }

  // 5. Sources, so a shared briefing points back to its data.
  if (url) {
    const sources = createSlide("actions", { title: "Next steps and sources" });
    sources.blocks = [{ id: newId("b"), type: "list", items: [] }, { id: newId("b"), type: "links", links: [{ label: `Data: ${layerTitle}`, url }] }];
    slides.push(sources);
  }
  return normalizeBriefing({ queries, slides });
}

/**
 * The prompt asking a model for short, attribute-grounded descriptions, and the
 * reader for its answer. The model returns JSON; anything else is ignored.
 */
export function aiDescriptionPrompt({ briefing, layerTitle, filterText = "", themeField = "", records = {} }) {
  const features = briefing.slides.filter((slide) => slide.template === "feature" && records[slide.id]).slice(0, MAX_FEATURE_SLIDES).map((slide) => ({
    slide: slide.id,
    name: slide.title,
    attributes: Object.fromEntries(Object.entries(records[slide.id].attributes || {}).filter(([, value]) => value != null && value !== "").slice(0, 16)),
  }));
  return [
    "Write short text for a map briefing. Use only the attributes given plus well-established general knowledge, and say nothing you cannot support.",
    "Return JSON only, no prose around it, in this shape:",
    '{"summary": "2-3 sentences for the opening slide", "features": {"<slide>": "1-2 sentences about that feature"}}',
    `Layer: ${layerTitle}${themeField ? `; styled by ${themeField}` : ""}${filterText ? `; filtered to ${filterText}` : ""}.`,
    `Features: ${JSON.stringify(features)}`,
  ].join("\n");
}

export function readAiDescriptions(text) {
  const raw = String(text || "");
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1));
    const features = parsed.features && typeof parsed.features === "object" ? Object.fromEntries(Object.entries(parsed.features).filter(([, value]) => typeof value === "string").map(([key, value]) => [key, value.trim().slice(0, 600)])) : {};
    return { summary: typeof parsed.summary === "string" ? parsed.summary.trim().slice(0, 800) : "", features };
  } catch {
    return null;
  }
}

/** Puts AI text into the briefing, marked as AI-written in the presenter notes. */
export function applyAiDescriptions(briefing, descriptions) {
  if (!descriptions) return briefing;
  const note = "AI-written description: check it before sharing.";
  const slides = briefing.slides.map((slide, index) => {
    const text = index === 0 && slide.template === "title" ? descriptions.summary : descriptions.features[slide.id];
    if (!text) return slide;
    const blocks = slide.blocks.some((block) => block.type === "text")
      ? slide.blocks.map((block) => (block.type === "text" ? { ...block, markdown: [block.markdown, text].filter((part) => part && part.trim()).join("\n\n") } : block))
      : [...slide.blocks, { id: newId("b"), type: "text", markdown: text }];
    return { ...slide, blocks, notes: [slide.notes, note].filter(Boolean).join("\n") };
  });
  return normalizeBriefing({ ...briefing, slides });
}
