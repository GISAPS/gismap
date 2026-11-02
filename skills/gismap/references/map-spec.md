# Map-v1

Canonical schema: https://gismap.online/schemas/map-v1.schema.json. Example:

```json
{"version":1,"title":"Example","basemap":"gray-vector","camera":{"center":[-75.16,39.95],"zoom":10},"layers":[{"url":"https://example.org/data.geojson","type":"geojson"}]}
```

Coordinates are `[longitude, latitude]` in degrees. Camera can instead use `{"fit":"layers"}` or `{"fit":"none"}`. A layer can include `where`, `renderer`, `opacity`, `visible` and popup fields. The example URL is illustrative, not a working dataset. See `assets/examples/` for published GISMap Online examples. The current map-v1 contract is not a complete project-v2, tour or task model. Unknown properties may be ignored with warnings; do not assume they survived. Run the core validator and inspect normalized state.
