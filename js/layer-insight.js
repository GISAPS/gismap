/**
 * What a layer is: its service's metadata (description, credits, licence,
 * last edit), its schema (fields with aliases, descriptions and coded values)
 * and summaries of a field's values, read straight from public ArcGIS REST
 * services. Used by the Map assistant to answer questions about the data.
 */

const ARCGIS_LAYER = /\/(FeatureServer|MapServer)\/\d+\/?$/i;
const TEXT_LIMIT = 1200;

export const isArcgisLayerUrl = (url) => ARCGIS_LAYER.test(String(url || "").split("?")[0]);

/** Plain text from the HTML ArcGIS descriptions often hold, shortened. */
export function plainText(html, limit = TEXT_LIMIT) {
  let source = String(html || "");
  // Some services store their HTML entity-escaped (&lt;p&gt;…); read it as the markup it is.
  if (!/<[a-z!/]/i.test(source) && /&lt;\/?[a-z]/i.test(source)) source = decodeEntities(source);
  const text = decodeEntities(source
    .replace(/<(br|\/p|\/div|\/li|\/h\d)\b[^>]*>/gi, "\n").replace(/<[^>]+>/g, " "))
    .replace(/[ \t\u00a0]+/g, " ").replace(/\s*\n\s*/g, "\n").trim();
  return text.length > limit ? `${text.slice(0, limit).replace(/\s+\S*$/, "")}…` : text;
}

function decodeEntities(text) {
  return text.replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&#39;/g, "'").replace(/&amp;/g, "&");
}

const fieldType = (type) => String(type || "").replace(/^esriFieldType/, "").toLowerCase();
const NUMERIC = new Set(["integer", "smallinteger", "biginteger", "double", "single", "oid"]);
const isNumeric = (field) => NUMERIC.has(fieldType(field?.type));
const isDate = (field) => /date/.test(fieldType(field?.type));

/** A field's own description: ArcGIS keeps it as JSON text ({ value, fieldValueType }) or plain text. */
function fieldDescription(field) {
  const raw = field.description;
  if (!raw) return {};
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return { ...(parsed.value ? { description: plainText(parsed.value, 300) } : {}), ...(parsed.fieldValueType ? { valueType: parsed.fieldValueType } : {}) };
  } catch {
    return { description: plainText(raw, 300) };
  }
}

/** The fields, for the model: name, type, alias, description and coded values. */
export function describeFields(fields = [], { limit = 120 } = {}) {
  return fields.slice(0, limit).map((field) => ({
    name: field.name,
    type: fieldType(field.type),
    ...(field.alias && field.alias !== field.name ? { alias: field.alias } : {}),
    ...fieldDescription(field),
    ...(field.length && fieldType(field.type) === "string" ? { length: field.length } : {}),
    ...(field.domain?.type === "codedValue" ? { codes: field.domain.codedValues.slice(0, 30).map(({ code, name }) => ({ code, name })) } : {}),
    ...(field.domain?.type === "range" ? { range: field.domain.range } : {}),
  }));
}

async function json(fetchFn, url) {
  const response = await fetchFn(url);
  if (!response.ok) throw new Error(`The service answered ${response.status}.`);
  const body = await response.json();
  if (body?.error) throw new Error(body.error.message || "The service returned an error.");
  return body;
}
const withQuery = (url, parameters) => {
  const target = new URL(url);
  Object.entries(parameters).forEach(([key, value]) => target.searchParams.set(key, value));
  return target.href;
};
const date = (value) => (Number.isFinite(Number(value)) && Number(value) > 0 ? new Date(Number(value)).toISOString().slice(0, 10) : undefined);
const compact = (object) => Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined && value !== null && value !== "" && !(Array.isArray(value) && !value.length)));

/**
 * Everything the service says about an ArcGIS layer: the layer, its service
 * and (for hosted layers) the portal item's summary, description, tags and licence.
 */
export async function describeArcgisLayer(url, { fetch: fetchFn = globalThis.fetch?.bind(globalThis) } = {}) {
  const layerUrl = String(url).split("?")[0].replace(/\/+$/, "");
  const serviceUrl = layerUrl.replace(/\/\d+$/, "");
  const [layer, service, item, count] = await Promise.all([
    json(fetchFn, withQuery(layerUrl, { f: "json" })),
    json(fetchFn, withQuery(serviceUrl, { f: "json" })).catch(() => ({})),
    json(fetchFn, withQuery(`${serviceUrl}/info/itemInfo`, { f: "json" })).catch(() => ({})),
    json(fetchFn, withQuery(`${layerUrl}/query`, { where: "1=1", returnCountOnly: "true", f: "json" })).then((body) => body.count).catch(() => undefined),
  ]);
  return compact({
    title: layer.name,
    url: layerUrl,
    summary: plainText(item.snippet, 400),
    description: plainText(layer.description) || plainText(item.description) || plainText(service.serviceDescription || service.description),
    credits: plainText(layer.copyrightText || item.accessInformation || service.copyrightText, 400),
    license: plainText(item.licenseInfo, 400),
    tags: item.tags?.slice(0, 15),
    geometryType: String(layer.geometryType || "").replace(/^esriGeometry/, "").toLowerCase() || (layer.type === "Table" ? "table" : undefined),
    featureCount: count,
    lastEdited: date(layer.editingInfo?.dataLastEditDate ?? layer.editingInfo?.lastEditDate),
    timeField: layer.timeInfo?.startTimeField,
    timeExtent: layer.timeInfo?.timeExtent?.map(date),
    displayField: layer.displayField,
    objectIdField: layer.objectIdField,
    spatialReference: layer.extent?.spatialReference?.latestWkid ?? layer.extent?.spatialReference?.wkid,
    scaleRange: layer.minScale || layer.maxScale ? { minScale: layer.minScale || 0, maxScale: layer.maxScale || 0 } : undefined,
    maxRecordCount: layer.maxRecordCount,
    capabilities: layer.capabilities,
    relationships: layer.relationships?.map(({ name, relatedTableId }) => ({ name, relatedTableId })),
    fields: describeFields(layer.fields || []),
  });
}

/**
 * A field's values, summarized by the service: for numbers and dates the
 * minimum, maximum, mean and spread; for text and codes the most common values
 * with their counts (and the coded names). `where` narrows the features.
 */
export async function summarizeArcgisField(url, fieldName, { where = "1=1", top = 15, fetch: fetchFn = globalThis.fetch?.bind(globalThis) } = {}) {
  const layerUrl = String(url).split("?")[0].replace(/\/+$/, "");
  const layer = await json(fetchFn, withQuery(layerUrl, { f: "json" }));
  const field = (layer.fields || []).find((candidate) => candidate.name.toLowerCase() === String(fieldName).toLowerCase());
  if (!field) {
    throw Object.assign(new Error(`The layer has no field "${fieldName}".`), { hint: `Fields: ${(layer.fields || []).map(({ name }) => name).slice(0, 60).join(", ")}.` });
  }
  const query = (parameters) => json(fetchFn, withQuery(`${layerUrl}/query`, { where: where || "1=1", returnGeometry: "false", f: "json", ...parameters }));
  const base = { field: field.name, type: fieldType(field.type), ...(field.alias && field.alias !== field.name ? { alias: field.alias } : {}), ...fieldDescription(field) };
  const nulls = await query({ where: `(${where || "1=1"}) AND ${field.name} IS NULL`, returnCountOnly: "true" }).then((body) => body.count).catch(() => undefined);
  const codes = field.domain?.type === "codedValue" ? new Map(field.domain.codedValues.map(({ code, name }) => [String(code), name])) : null;
  if ((isNumeric(field) || isDate(field)) && !codes) {
    const statistics = ["min", "max", "avg", "stddev", "count"].map((type) => ({ statisticType: type, onStatisticField: field.name, outStatisticFieldName: `s_${type}` }));
    const body = await query({ outStatistics: JSON.stringify(statistics) });
    const values = body.features?.[0]?.attributes || {};
    const read = (key) => values[key] ?? values[key.toUpperCase()];
    const format = isDate(field) ? date : (value) => (Number.isFinite(Number(value)) ? Number(Number(value).toPrecision(6)) : undefined);
    return compact({ ...base, count: read("s_count"), nulls, min: format(read("s_min")), max: format(read("s_max")), ...(isDate(field) ? {} : { mean: format(read("s_avg")), stddev: format(read("s_stddev")) }) });
  }
  const body = await query({
    groupByFieldsForStatistics: field.name,
    outStatistics: JSON.stringify([{ statisticType: "count", onStatisticField: layer.objectIdField || field.name, outStatisticFieldName: "n" }]),
    orderByFields: "n DESC",
  });
  const groups = (body.features || []).map(({ attributes }) => {
    const value = attributes[field.name] ?? Object.entries(attributes).find(([key]) => key.toLowerCase() === field.name.toLowerCase())?.[1];
    return compact({ value, ...(codes?.has(String(value)) ? { name: codes.get(String(value)) } : {}), count: attributes.n ?? attributes.N });
  });
  return compact({ ...base, distinct: groups.length, nulls, top: groups.slice(0, top) });
}
