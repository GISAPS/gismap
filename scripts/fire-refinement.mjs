// Public fire-map refinement example. A generated URL is not evidence of rendering.
export const FIRE_SOURCE = 'https://services1.arcgis.com/jUJYIo9tSA7EHvfZ/ArcGIS/rest/services/California_Historic_Fire_Perimeters/FeatureServer/0';
export const FIRE_WHERE = 'YEAR_ >= 2000 AND YEAR_ <= 2010';
export const FIRE_BASE = { version: 1, title: 'Historical fires 2000–2010', basemap: 'gray-vector', camera: { center: [-120, 37.5], zoom: 5 }, legend: true, layers: [{ url: FIRE_SOURCE, type: 'feature', title: 'California historical fire perimeters', where: FIRE_WHERE, opacity: 0.8 }] };
const colors = ['#8e0152','#d73027','#f46d43','#fdae61','#fee08b','#66a61e','#1b9e77','#1f78b4','#6a3d9a','#a6761d','#4d4d4d'];
export const FIRE_YEAR = { ...FIRE_BASE, title: 'Fires by year 2000–2010', layers: FIRE_BASE.layers.map(layer => ({ ...layer, renderer: { type: 'categories', field: 'YEAR_', maxCategories: 11, colors: Object.fromEntries(colors.map((color, i) => [String(2000 + i), color])) } })) };
export const FIRE_ACRES = { ...FIRE_BASE, title: 'Fire acreage 2000–2010', layers: FIRE_BASE.layers.map(layer => ({ ...layer, renderer: { type: 'choropleth', field: 'GIS_ACRES', classes: 5, method: 'quantile', classColors: ['#ffffb2','#fecc5c','#fd8d3c','#f03b20','#bd0026'] } })) };
export const fireLink = spec => `https://gismap.online/#map=json:${encodeURIComponent(JSON.stringify(spec))}`;
export const FIRE_START_LINK = `https://gismap.online/?${new URLSearchParams({layer: FIRE_SOURCE, layerType: 'feature', where: FIRE_WHERE, basemap: 'gray-vector', center: '-120,37.5', level: '5'})}`;
// The Discover 3D strata example: fires of 1,000+ acres stacked by decade. Fires
// before 1950 have no DECADES value, so they have no slot in the stack.
const DECADES = ['1950-1959', '1960-1969', '1970-1979', '1980-1989', '1990-1999', '2000-2009', '2010-2019', '2020-2025'];
export const FIRE_STRATA = { version: 1, title: 'California fire perimeters in 3D by decade', basemap: 'open-dark', camera: { center: [-122.2, 38.8], zoom: 9.4, heading: 0, tilt: 55 }, layers: [{ url: FIRE_SOURCE, type: 'feature', title: 'California fire perimeters by decade', where: 'GIS_ACRES >= 1000 AND DECADES IS NOT NULL', opacity: 0.9, spatialChart: { type: 'spatial-3d-chart', mode: 'temporal-strata', groupBy: 'DECADES', groups: DECADES, height: { slotMeters: 4000, gapMeters: 500, thicknessMeters: 2500, scale: 1 }, color: { field: 'DECADES', strategy: 'sequential' } } }] };
export const FIRE_STRATA_LINK = fireLink(FIRE_STRATA);
