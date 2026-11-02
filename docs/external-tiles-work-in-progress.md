# External tiles: work in progress

**Not yet available in Add Data.** The source-discovery module on this branch is a foundation, not a complete implementation. Do not advertise these formats as supported or deploy this branch as a finished feature.

The discovery module can identify PMTiles, vector and raster XYZ templates, and TileJSON. The PMTiles browser library is loaded only when needed, pinned to 4.5.0, and its MapLibre protocol is registered once per library instance. PMTiles header and metadata discovery exposes bounds, zoom range and vector layer IDs and fields when provided. TileJSON may omit fields and XYZ alone has no metadata, so users will need to supply a source-layer name when one is unavailable.

## Provider requirements and safety

Providers must permit requests from the GISMap Online origin using CORS. PMTiles also requires HTTP byte-range requests: the discovery step checks for HTTP 206, and the library needs the host to serve byte ranges. See [Protomaps' hosting guidance](https://docs.protomaps.com/pmtiles/cloud-storage). A 401 or 403 indicates that the provider denied access; GISMap Online must not bypass access controls. GISMap Online's existing shareable-URL sanitizer rejects credentials and secret-looking query parameters; authenticated endpoints need a separate, carefully designed credential flow before they can be supported.

Metadata, including attribution, is **untrusted** and may contain HTML. Future UI integration must safely render attribution without inserting provider HTML into the DOM unsanitized, while retaining attribution required by each provider's terms. No remote styles or expressions are executed by the discovery module. Source availability, CORS configuration, licensing, and rate limits can change: verify terms and avoid heavy traffic before adding a public service to Examples.

## Candidate services for later Examples

These are test candidates, not GISMap Online Examples or assurances of service availability:

* [MapLibre's Firenze PMTiles example](https://maplibre.org/maplibre-gl-js/docs/examples/pmtiles/) — public vector PMTiles, with OpenStreetMap attribution.
* [MapLibre vector tile source example](https://maplibre.org/maplibre-gl-js/docs/examples/vector-source/) — demonstrates vector TileJSON and an MVT source.
* [OpenStreetMap standard raster tiles](https://operations.osmfoundation.org/policies/tiles/) — raster XYZ; subject to its tile usage policy and attribution requirements.

## Remaining implementation

Connect discovery and source-layer selection to the Add Data dialog and mobile menus. Add native MapLibre vector/raster source and layer records with visibility, opacity, styling, attribution, safe filters, picking and 3D extrusion. Tiled features are partial, clipped, zoom-dependent and may lack stable IDs: Explorer, statistics, and briefings must not present visible-tile results as complete datasets. Integrate the source configuration into existing project, map-spec, share-link, briefing and tour serialization, and handle engine switches without silently dropping sources. Add live browser tests of rendering, switching, sharing and mobile; unit-test failure paths and attribution sanitization. The ArcGIS engine and existing imports should remain unchanged.
