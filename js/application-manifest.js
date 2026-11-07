// Additive, privacy-first projection of the existing registries and state stores.
// This is not a project serializer: feature data, URLs and free text are excluded.
import { APPLICATION_PRESETS } from './application-config.js?v=0.68.0-charts1';
import { INTERFACE_SKINS } from './skin-catalog.js?v=0.57.0-skins2';
import { listEngines } from './engines/engine-registry.js?v=0.69.9-order';
import { LAYER_TOOL_DEFINITIONS } from './layer-tools.js?v=0.29.0';
import { AUTHORING_TOOL_DEFINITIONS } from './agent-authoring-tools.js?v=0.53.0';

export const MANIFEST_VERSION = '1.0.0';
const objectSchema = { type: 'object' };
export const PUBLIC_STATE_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://gismap.online/schemas/application-state-v1.schema.json',
  title: 'GISMap Online privacy-preserving application state',
  type: 'object',
  required: ['revision', 'version', 'status', 'engine', 'basemap', 'skin', 'application', 'activeLayerId', 'selection', 'layers'],
  properties: {
    revision: { type: 'integer', minimum: 0 }, version: { const: 1 }, status: { type: 'string' }, engine: { type: 'string' },
    basemap: { type: ['string', 'null'] }, skin: { type: ['string', 'null'] }, activeLayerId: { type: ['string', 'null'] },
    application: { type: 'object', required: ['preset', 'mode', 'layout', 'panels'] },
    selection: { type: 'object', required: ['active', 'count'], properties: { active: { type: 'boolean' }, count: { type: 'integer', minimum: 0 } } },
    layers: { type: 'array', items: { type: 'object', required: ['id', 'type', 'visible', 'opacity', 'metadata', 'filters', 'styling', 'capabilities'] } },
  }, additionalProperties: false,
};
export const describeAction = (tool) => ({ id: tool.id, displayName: tool.displayName, description: tool.description || '', inputSchema: tool.inputSchema || null, outputSchema: tool.outputSchema || null, validatedExecution: Boolean(tool.inputSchema) });

export function buildManifest({ tools = [...LAYER_TOOL_DEFINITIONS, ...AUTHORING_TOOL_DEFINITIONS], panels = [] } = {}) {
  return {
    manifestVersion: MANIFEST_VERSION,
    scope: 'in-page',
    description: 'GISMap Online browser API. Runtime registry may contain additional tools and panels.',
    discovery: { runtime: 'gisMapOnline.manifest()', state: 'gisMapOnline.state.snapshot()', stateSchema: '/schemas/application-state-v1.schema.json', explorer: '/api/explorer/', aiArcgisMapGuide: '/ai-arcgis-map-generator/', agentRecipes: '/api/agent-recipes/index.json', agentRecipeSchema: '/schemas/agent-recipe-v1.schema.json' },
    privacy: 'The state projection excludes feature records, coordinates, source URLs, filter expressions, credentials and user-entered text.',
    actions: tools.map(describeAction),
    panels: panels.map((p) => ({ type: p.type, displayName: p.displayName, category: p.category, placements: p.placements, status: p.status, multiple: p.multiple })),
    presets: Object.keys(APPLICATION_PRESETS),
    layouts: ['workspace', 'bottom-nav', 'bottom-workspace', 'globe', 'ai-map'],
    modes: ['edit', 'present'],
    skins: INTERFACE_SKINS.map(({ id, label, tone }) => ({ id, label, tone })),
    engines: listEngines(),
    stateMutations: [{ id: 'layer.activate', inputSchema: { type: 'object', required: ['layerId'], additionalProperties: false, properties: { layerId: { type: ['string', 'null'] } } }, outputSchema: objectSchema, undo: true }],
    limitations: ['Static actions cover exported tool definitions; call manifest() for the live registry.', 'Some existing registered tools do not yet declare input or output schemas.', 'State is a privacy-preserving projection, not a complete project export.', 'Only layer.activate is supported by the validated mutation facade.'],
  };
}

// Snapshot contents are deliberately allowlisted; never copy raw source objects.
export function projectPublicState({ runtime, mapController, documentRef }) {
  const app = runtime.state.value;
  const config = runtime.snapshot();
  const layers = mapController.isReady() ? mapController.getLayers() : [];
  return {
    version: 1,
    status: documentRef.documentElement.dataset.gismapState || 'loading',
    engine: mapController.getEngineId(),
    basemap: mapController.getBasemapId() || null,
    skin: documentRef.documentElement.dataset.skin || null,
    application: { preset: config.preset, mode: config.mode, layout: config.layout.kind, panels: config.panels.map((p) => ({ type: p.type, region: p.placement.region, audienceVisible: p.audienceVisible })) },
    activeLayerId: app.activeLayerId,
    selection: { active: Boolean(app.selection?.layerId), count: app.selection?.objectIds?.length || 0 },
    layers: layers.map((layer) => {
      const c = mapController.getLayerConfig(layer) || {};
      return { id: layer.uid, type: c.sourceType || layer.type || null, visible: layer.visible !== false, opacity: Number.isFinite(layer.opacity) ? layer.opacity : null,
        metadata: { fieldCount: Array.isArray(layer.fields) ? layer.fields.length : null },
        filters: { active: Boolean(c.definitionExpression) || Object.values(app.filters || {}).some((f) => f.layerId === layer.uid) },
        styling: { customized: Boolean(c.rendererSpec || c.styled) },
        capabilities: { query: Boolean(layer.queryable), filter: Boolean(layer.filterable), count: Boolean(layer.countable) } };
    }),
  };
}

export function createPublicStateApi({ runtime, mapController, documentRef, events }) {
  let revision = 0;
  let current = projectPublicState({ runtime, mapController, documentRef });
  const listeners = new Set();
  const refresh = () => {
    const next = projectPublicState({ runtime, mapController, documentRef });
    const changes = Object.keys(next).filter((key) => JSON.stringify(current[key]) !== JSON.stringify(next[key]));
    if (!changes.length) return;
    const previousRevision = revision++;
    current = next;
    const diff = changes.map((key) => ({ op: 'replace', path: `/${key}`, value: structuredClone(next[key]) }));
    for (const listener of listeners) {
      try { listener({ revision, previousRevision, diff: structuredClone(diff), state: snapshot() }); } catch (error) { console.error('State subscriber failed', error); }
    }
  };
  const snapshot = () => ({ revision, ...structuredClone(current) });
  const scheduledRefresh = () => queueMicrotask(refresh);
  runtime.state.subscribe(scheduledRefresh);
  for (const topic of ['map:ready', 'map:basemap-changed', 'layer:added', 'layer:removed', 'layer:changed', 'layers:reset', 'application:changed', 'presentation:changed', 'project:loaded', 'view:stationary']) events.subscribe(topic, scheduledRefresh);
  return Object.freeze({
    snapshot() { refresh(); return snapshot(); },
    subscribe(listener) { if (typeof listener !== 'function') throw new TypeError('A listener is required.'); listeners.add(listener); return { remove: () => listeners.delete(listener) }; },
    mutate(id, input) {
      if (id !== 'layer.activate') throw new Error(`Unsupported state mutation: ${id}`);
      if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some((k) => k !== 'layerId') || !Object.hasOwn(input, 'layerId') || (input.layerId !== null && (typeof input.layerId !== 'string' || !mapController.getLayers().some((l) => l.uid === input.layerId)))) throw new Error('layerId must be null or the id of an existing layer.');
      runtime.state.dispatch('layer:activate', { layerId: input.layerId });
      refresh();
      return snapshot();
    },
    undo() { const changed = runtime.state.undo(); refresh(); return changed; },
  });
}
