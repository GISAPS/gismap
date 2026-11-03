# Map-v1

Canonical schema: https://gismap.online/schemas/map-v1.schema.json. Example:

```json
{"version":1,"title":"Example","basemap":"gray-vector","camera":{"center":[-75.16,39.95],"zoom":10},"layers":[{"url":"https://example.org/data.geojson","type":"geojson"}]}
```

Coordinates are `[longitude, latitude]` in degrees. Camera can instead use `{"fit":"layers"}` or `{"fit":"none"}`. A layer can include `where`, `renderer`, `opacity`, `visible` and popup fields. An optional top-level `charts` list (at most 6) opens linked chart panels beside the map: `{"type":"bar","title":"Incidents by state","layer":0,"dimension":"POOState","measure":{"field":"DailyAcres","aggregation":"sum"},"placement":"right","style":{"topN":10,"other":"group","palette":"inherit","theme":"futuristic","hidden":[]}}`. `layer` is a position in `layers` or one of their URLs (default 0); leave `measure` out to count features; `placement` is `right` or `bottom`. A chart carries field names only, never records or credentials; the numbers are computed from the layer when the link opens, and the sidebar is left as it is. A chart with an unknown type, a bad field name or a layer that does not load is left out with a warning. Worked example: https://gismap.online/examples/ai/wildfires-by-state-chart/. The example URL is illustrative, not a working dataset. See `assets/examples/` for published GISMap Online examples. The current map-v1 contract is not a complete project-v2, tour or task model. Unknown properties may be ignored with warnings; do not assume they survived. Run the core validator and inspect normalized state.
