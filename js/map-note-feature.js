import { sanitizeSharedResourceUrl } from './share.js?v=0.70.3-geology';

// A generated renderer object ID is not a durable feature identity. Preserve
// only an advertised ID field and never copy a credential-bearing service URL.
export function noteFeatureReference(result, layer, config) {
  if (result?.kind !== 'feature' || !layer || !config) return null;
  let sourceUrl = null;
  try { if (result.source?.url || config.url) sourceUrl = sanitizeSharedResourceUrl(result.source?.url || config.url, { allowHttp: true }); } catch { /* Do not expose secrets in portable notes. */ }
  const datasetId = String((sourceUrl && sourceUrl.length <= 256 ? sourceUrl : config.id || layer.id || '')).slice(0, 256);
  if (!datasetId) return null;
  const field = result.source?.objectIdField || layer.objectIdField;
  const rawId = field && field !== '__OBJECTID' ? result.attributes?.[field] : null;
  const featureId = (typeof rawId === 'string' || typeof rawId === 'number') && String(rawId).trim() && String(rawId).length <= 256 ? String(rawId) : null;
  const common = { datasetId, ...(sourceUrl ? { sourceUrl } : {}), datasetTitle: String(result.layerTitle || layer.title || 'Layer').slice(0, 240) };
  return featureId ? { type: 'references_feature', targetType: 'feature', targetId: '', ...common, featureId } : { type: 'references_dataset', targetType: 'dataset', targetId: datasetId, ...common };
}
