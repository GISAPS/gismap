// The Discover geology strata example: Arizona's mapped rock units stacked by
// their oldest possible age (AGE_MAX) from the USGS State Geologic Map
// Compilation, oldest at the bottom. Ages are text such as "Phanerozoic -
// Paleozoic - Permian - Cisuralian - Kungurian" and do not sort, so the groups
// are listed in time order and the chart keeps that order.
export const GEOLOGY_SOURCE = 'https://services.arcgis.com/v01gqwM5QqNysAAi/ArcGIS/rest/services/SB_5888bf4fe4b05ccb964bab9d_USGS_SGMC_feature/FeatureServer/3';
export const GEOLOGY_WHERE = "STATE = 'AZ' AND AGE_MAX IS NOT NULL AND AGE_MAX <> ''";

// [AGE_MAX value, start of the stage in millions of years, period colour from the geologic time scale].
const AGES = [
  ['preCambrian-Proterozoic - Paleoproterozoic - Statherian', 1800, '#f74370'],
  ['preCambrian-Proterozoic - Mesoproterozoic - Calymmian', 1600, '#fdb462'],
  ['preCambrian-Proterozoic - Mesoproterozoic - Ectasian', 1400, '#fdb462'],
  ['preCambrian-Proterozoic - Mesoproterozoic - Stenian', 1200, '#fdb462'],
  ['preCambrian-Proterozoic - Neoproterozoic - Ediacaran', 635, '#feb342'],
  ['Phanerozoic - Paleozoic - Cambrian - Early-Cambrian', 538.8, '#7fa056'],
  ['Phanerozoic - Paleozoic - Carboniferous - Middle-Pennsylvanian - Moscovian', 315.2, '#67a599'],
  ['Phanerozoic - Paleozoic - Permian - Cisuralian - Kungurian', 283.5, '#f04028'],
  ['Phanerozoic - Mesozoic - Triassic - Middle-Triassic - Anisian', 247.2, '#812b92'],
  ['Phanerozoic - Mesozoic - Triassic - Middle-Triassic - Ladinian', 242, '#812b92'],
  ['Phanerozoic - Mesozoic - Triassic - Late-Triassic - Carnian', 237, '#812b92'],
  ['Phanerozoic - Mesozoic - Triassic - Late-Triassic - Norian', 227, '#812b92'],
  ['Phanerozoic - Mesozoic - Jurassic - Early-Jurassic - Hettangian', 201.4, '#34b2c9'],
  ['Phanerozoic - Mesozoic - Jurassic - Early-Jurassic - Toarcian', 184.2, '#34b2c9'],
  ['Phanerozoic - Mesozoic - Jurassic - Middle-Jurassic - Bajocian', 170.9, '#34b2c9'],
  ['Phanerozoic - Mesozoic - Jurassic - Middle-Jurassic - Callovian', 165.3, '#34b2c9'],
  ['Phanerozoic - Mesozoic - Jurassic - Late-Jurassic - Oxfordian', 161.5, '#34b2c9'],
  ['Phanerozoic - Mesozoic - Cretaceous - Late-Cretaceous - Cenomanian', 100.5, '#7fc64e'],
  ['Phanerozoic - Mesozoic - Cretaceous - Late-Cretaceous - Coniacian', 89.8, '#7fc64e'],
  ['Phanerozoic - Mesozoic - Cretaceous - Late-Cretaceous - Campanian', 83.6, '#7fc64e'],
  ['Phanerozoic - Cenozoic - Tertiary-Paleogene - Early-Paleocene - Danian', 66, '#fd9a52'],
  ['Phanerozoic - Cenozoic - Tertiary-Paleogene - Middle-Eocene - Bartonian', 41.2, '#fd9a52'],
  ['Phanerozoic - Cenozoic - Tertiary-Paleogene - Late-Eocene - Priabonian', 37.7, '#fd9a52'],
  ['Phanerozoic - Cenozoic - Tertiary-Paleogene - Early-Oligocene - Rupelian', 33.9, '#fd9a52'],
  ['Phanerozoic - Cenozoic - Tertiary-Paleogene - Late-Oligocene - Chattian', 27.8, '#fd9a52'],
  ['Phanerozoic - Cenozoic - Tertiary-Neogene - Early-Miocene - Burdigalian', 20.4, '#ffe619'],
  ['Phanerozoic - Cenozoic - Tertiary-Neogene - Middle-Miocene - Serravallian', 13.8, '#ffe619'],
  ['Phanerozoic - Cenozoic - Tertiary-Neogene - Late-Miocene - Tortonian', 11.6, '#ffe619'],
  ['Phanerozoic - Cenozoic - Tertiary-Neogene - Early-Pliocene - Zanclean', 5.33, '#ffe619'],
  ['Phanerozoic - Cenozoic - Tertiary-Neogene - Late-Pliocene - Piacenzian', 3.6, '#ffe619'],
  ['Phanerozoic - Cenozoic - Quaternary - Pleistocene - Gelasian', 2.58, '#f9f97f'],
  ['Phanerozoic - Cenozoic - Quaternary - Pleistocene - Middle-Pleistocene', 0.774, '#f9f97f'],
  ['Phanerozoic - Cenozoic - Quaternary - Holocene', 0.0117, '#f9f97f'],
];

// Stages of one period share its colour, each a little lighter than the one
// below, so neighbouring slabs stay apart.
const lighten = (hex, amount) => `#${[1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) + (255 - parseInt(hex.slice(i, i + 2), 16)) * amount).toString(16).padStart(2, '0')).join('')}`;
const colors = Object.fromEntries(AGES.map(([age, , color], index) => {
  const step = AGES.slice(0, index).filter(([, , previous]) => previous === color).length;
  return [age, lighten(color, Math.min(0.5, step * 0.14))];
}));

export const GEOLOGY_AGES = AGES.map(([age]) => age);
export const GEOLOGY_STRATA = { version: 1, title: 'Arizona geology in 3D by age', basemap: 'open-dark', camera: { center: [-112.3, 36.0], zoom: 7.6, heading: 200, tilt: 60 }, legend: true, layers: [{ url: GEOLOGY_SOURCE, type: 'feature', title: 'Arizona rock units by age', where: GEOLOGY_WHERE, opacity: 0.95, spatialChart: { type: 'spatial-3d-chart', mode: 'temporal-strata', groupBy: 'AGE_MAX', order: 'listed', groups: GEOLOGY_AGES, height: { slotMeters: 1500, gapMeters: 200, thicknessMeters: 1300, scale: 1 }, color: { field: 'AGE_MAX', strategy: 'sequential', colors } } }] };
export const GEOLOGY_STRATA_LINK = `https://gismap.online/#map=json:${encodeURIComponent(JSON.stringify(GEOLOGY_STRATA))}`;
