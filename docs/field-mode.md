# Field Mode

Field Mode is GISMap Online's dedicated, mobile-first collector at `/field/`. It is a
separate installable PWA so a person can create and retain observations without
opening a map, loading a service, or having a network connection. It is the
offline workspace for Field Notes and imported Field Tasks. The existing Field
Notes surface remains map-centric; Field Mode is the map-optional field capture
and completion surface.

The local-only release stores records, imported tasks, and attachment blobs in IndexedDB.
It supports text, manual or device-GPS point locations, photos, voice recordings,
and freehand screen-space sketches. Sketches are explicitly not presented as
georeferenced geometry. Location permission is requested only after the person
taps **Use device GPS**.

## Offline spatial analysis

Field Mode includes a locally vendored, version-pinned **Turf.js 7.4.0** browser
bundle (MIT licensed) and a small shared adapter at `js/turf-offline.js`. The
initial offline Analysis tab can measure geodesic distance and bearing, create a
GeoJSON point buffer, inspect local GeoJSON bounds and polygon area, and find
nearby saved point observations. These calculations are all local, use WGS84
longitude/latitude coordinate order, and do not query DuckDB or any remote map
service. The Field service worker caches the bundle with the application shell.

## Data and transfer

Records use `gismap.field-record.v1` and retain the observation's geometry,
properties, notes, attachment references, relationships, and `local-only` sync
state. `.gisfield` packages use `gismap.field-package.v1`; they include local
record attachments. GeoJSON export deliberately contains only geometry and text
properties. Compact QR records carry one text/location observation and never
include audio, photos, or sketches.

Notes retain a stable ID, observation/creation/modification timestamps, revision
history, and explicit local registration state. Field reports contain those
details, photos, sketches, a compact QR, and a link that opens the saved
location in the desktop map. A desktop map-enhanced report needs a portable
package or a future registration service to recover local-only media.

No account, upload, background synchronization, or offline speech transcription
is implied by this phase. Device keyboard dictation is separate from browser
audio capture. Map-backed collection, cached map areas, sync conflict handling,
configurable forms, and a bridge to project notes remain later phases.
