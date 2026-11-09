// Restores a shared layer only after its data and configuration are ready.
export async function loadSharedLayer(mapController, config) {
  const rootUrl = config.url.replace(/\/+$/, "");
  if (/\/FeatureServer$/i.test(new URL(rootUrl).pathname)) {
    const layers = await mapController.discoverFeatureServiceLayers(rootUrl);
    if (!layers.length) throw new Error("The shared FeatureServer does not advertise any feature layers.");
    const added = await Promise.all(layers.map((layer) => mapController.addService({
      ...config,
      url: layer.url,
      title: layers.length === 1 ? config.title : layer.name,
      serviceType: "feature",
    })));
    await Promise.all(added.map((layer) => mapController.loadLayer(layer)));
    if (config.renderer && added.length !== 1) throw new Error("A shared renderer cannot be applied to multiple service layers.");
    if (config.renderer) mapController.restoreRenderer(added[0], config.renderer);
    if (config.spatialChart && added.length !== 1) throw new Error("A shared 3D spatial chart cannot be applied to multiple service layers.");
    if (config.spatialChart) await mapController.setSpatialChart(added[0], config.spatialChart);
    if (config.subsurface && added.length === 1) await mapController.setSubsurface(added[0], config.subsurface);
    await applyAnimatedEffect(mapController, added.length === 1 ? added[0] : null, config.animatedEffect);
    return added;
  }
  const added = await mapController.addService(config);
  await mapController.loadLayer(added);
  if (config.renderer) {
    mapController.restoreRenderer(added, config.renderer);
    if (!mapController.getLayerConfig(added)?.renderer) throw new Error("The requested layer style could not be restored.");
  }
  if (config.spatialChart) await mapController.setSpatialChart(added, config.spatialChart);
  if (config.subsurface) await mapController.setSubsurface(added, config.subsurface);
  if (config.definitionExpression && mapController.getLayerConfig(added)?.definitionExpression !== config.definitionExpression) throw new Error("The requested layer filter could not be restored.");
  await applyAnimatedEffect(mapController, added, config.animatedEffect);
  return [added];
}

/** A decorative effect is optional: an engine without it shows the layer plainly. */
async function applyAnimatedEffect(mapController, layer, effect) {
  if (!layer || !effect || !mapController.getCapabilities?.().includes("three-3d")) return;
  try { await mapController.setLayerEffect(layer, effect); } catch { /* Shown without the effect. */ }
}

