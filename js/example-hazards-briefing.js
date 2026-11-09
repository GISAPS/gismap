import { createSlide, normalizeBriefing } from './briefing-document.js?v=0.70.4-sequence';

// This example intentionally uses one stable, publisher-hosted FeatureServer.
// Its definition query keeps a global historical archive legible and makes the
// cinematic timeline small enough to play comfortably on a laptop or phone.
export const HISTORICAL_QUAKES_WHERE = 'mag >= 6.5';
export const HISTORICAL_QUAKES_SOURCE = 'https://rhvpkkiftonktxq3.svcs9.arcgis.com/RHVPKKiFTONKtxq3/ArcGIS/rest/services/Historical_Quakes/FeatureServer/0';

// The service publishes a useful scale range. A globe-wide view can therefore
// be perfectly valid cartographically while hiding every earthquake symbol.
// These opening views create a small visual journey before the record slides:
// north-east Pacific, west-coast archive, then a closer seismic view.
const overviewCamera = { center: [-142, 47], zoom: 3.75, heading: -8, tilt: 20 };
const archiveCamera = { center: [-130, 42], zoom: 4.7, heading: 12, tilt: 26 };
const pulseCamera = { center: [-119, 34], zoom: 5.7, heading: -16, tilt: 30 };
const ringOfFireCamera = { center: [-112, 24], zoom: 5.8, heading: -22, tilt: 34 };

const finite = (value) => Number.isFinite(Number(value)) ? Number(value) : null;
const attribute = (feature, field) => feature?.attributes?.[field];
const pointCamera = (feature) => {
  const x = finite(feature?.geometry?.x ?? feature?.geometry?.longitude);
  const y = finite(feature?.geometry?.y ?? feature?.geometry?.latitude);
  return x == null || y == null ? overviewCamera : { center: [x, y], zoom: 6.8, heading: 0, tilt: 20 };
};
const sourceLayer = (layer) => [{ layer, visible: true }];
const exampleSlide = (id, slide, mapEngine = 'arcgis') => ({ ...slide, id, mapEngine });

function narrative(title, markdown, { id, quakeRef, camera = overviewCamera, mapEngine = 'arcgis' } = {}) {
  const slide = createSlide('map-narrative', { title, camera });
  slide.blocks = [{ type: 'text', markdown }];
  slide.layers = sourceLayer(quakeRef);
  return exampleSlide(id, slide, mapEngine);
}

function featureSlide(feature, quakeRef, index) {
  const title = String(attribute(feature, 'title') || attribute(feature, 'place') || 'Recorded earthquake').slice(0, 160);
  const slide = createSlide('feature', {
    title,
    featureId: attribute(feature, 'OBJECTID'),
    camera: pointCamera(feature),
    fields: ['mag', 'time', 'place', 'depth', 'sig'],
  });
  slide.layers = sourceLayer(quakeRef);
  const magnitude = finite(attribute(feature, 'mag'));
  const depth = finite(attribute(feature, 'depth'));
  slide.blocks[1].markdown = [
    magnitude == null ? 'A recorded event from the Historical Quakes Feature Service.' : `Magnitude **${magnitude.toFixed(1)}** recorded by the source service.`,
    depth == null ? '' : `Depth: **${depth.toFixed(1)} km**.`,
    'Use the facts and Source panel to inspect the original record and its publisher metadata.',
  ].filter(Boolean).join(' ');
  return exampleSlide(`historical-quakes-event-${index + 1}`, slide);
}

/** A completed, editable briefing based on the stable Historical Quakes FeatureServer. */
export function createHistoricalQuakesExampleBriefing({ quakeRef, featuredEvents = [] } = {}) {
  if (!quakeRef) throw new Error('The Historical Quakes layer is required.');
  const title = exampleSlide('historical-quakes-title', createSlide('title', {
    title: 'Historical earthquakes',
    subtitle: 'A finished briefing built from a stable ArcGIS Feature Service',
    camera: overviewCamera,
  }));
  title.layers = sourceLayer(quakeRef);

  const pulse = narrative('Where the archive is most active', 'This focused view uses a **seismic pulse** to make the source locations easier to scan. The rings are a presentation-only MapLibre effect: their size follows the magnitude field, but they do not add measurements, model energy, or predict future earthquakes.', { id: 'historical-quakes-pulse', quakeRef, camera: pulseCamera, mapEngine: 'maplibre' });
  // A presentation-only effect is restored as soon as the viewer advances.
  // The Feature Service remains the sole source of locations and magnitudes.
  pulse.mapEffect = { layer: quakeRef, type: 'pulse', color: '#ff4a3d', intensity: 1.25, opacity: 0.88, speed: 0.8, density: 0.8, style: 'balanced' };

  const closing = exampleSlide('historical-quakes-actions', createSlide('actions', { title: 'Explore the source', camera: ringOfFireCamera }));
  closing.layers = sourceLayer(quakeRef);
  closing.blocks = [
    { type: 'list', items: [
      'Open a record to inspect its place, magnitude, depth, significance, and UTC event time.',
      'Use Filter map to change the magnitude threshold, then save your own briefing or map.',
      'The service is an archive: check the publisher’s metadata before using it for operational decisions.',
    ] },
    { type: 'links', links: [{ label: 'Open the Historical Quakes Feature Service', url: HISTORICAL_QUAKES_SOURCE }] },
  ];

  return normalizeBriefing({
    layerId: quakeRef,
    playerSettings: { basemap: 'topo-vector', animations: true, motion: 'fly', mapDetails: 'slide' },
    slides: [
      title,
      narrative('A reliable archive, styled by its source', 'This example uses the **Historical Quakes** ArcGIS Feature Service rather than a changing hazard feed. It shows magnitude **6.5 and larger** events so the Pacific pattern remains readable. The next slide adds a clearly labelled MapLibre pulse for presentation; it never changes the source records.', { id: 'historical-quakes-archive', quakeRef, camera: archiveCamera }),
      pulse,
      ...featuredEvents.slice(0, 3).map((feature, index) => featureSlide(feature, quakeRef, index)),
      narrative('Read patterns carefully', 'The animation orders recorded events by the service’s **Event Time** field in UTC. It is a visual way to explore an archive, not a forecast or an alert feed. Dense areas can reflect both seismic activity and the archive’s historical coverage; inspect individual records and source metadata before drawing conclusions.', { id: 'historical-quakes-patterns', quakeRef, camera: ringOfFireCamera }),
      closing,
    ],
  });
}
