# 3D data: LiDAR point clouds and models

GISMap Online draws point clouds and 3D models with three.js on the MapLibre engine (`?engine=maplibre`, the default), on the flat map. They are map-v1 layers, so a chatbot can write them into a `#map=json:` link.

```json
{ "version": 1, "basemap": "gray-vector", "layers": [
  { "url": "https://example.org/survey/span-12.laz", "type": "pointcloud",
    "scene3d": { "crs": "EPSG:26910", "classes": [3, 4, 5, 13, 14], "colorBy": "classification", "pointSize": 2 } },
  { "url": "https://example.org/assets/lattice-tower.glb", "type": "model",
    "scene3d": { "anchor": [-122.41, 37.77, 0], "heading": 35, "scale": 1, "upAxis": "y" } }
] }
```

- **Point clouds:** LAS 1.0–1.4 (formats 0–10), LAZ (decoded with laz-perf), XYZ/PTS text. The CRS comes from the file (GeoTIFF keys or WKT) or `scene3d.crs` (`EPSG:<code>`, proj4 or WKT); units (metres, international or US survey feet) are converted. `colorBy`: `auto`, `rgb`, `classification` (ASPRS), `elevation`, `intensity`. `classes` keeps only listed ASPRS classes: 2 ground, 3–5 vegetation, 6 building, 13 guard wire, 14 conductor, 15 transmission tower, 16 wire-structure connector. `maxPoints` (default 1,500,000) thins large files evenly. `animate: { "type": "reveal", "durationMs": 8000, "loop": true }` reveals points from low to high on the shared animation clock.
- **Models:** glTF/GLB (preferred for CAD exports), OBJ, PLY. Place with `anchor` [lon, lat, altitude] plus `heading` (degrees clockwise from north), `scale` (model units to metres) and `upAxis` (`y` for glTF, often `z` for CAD); or give `crs` when the vertices are absolute projected coordinates.
- **Heights:** `heightReference: "ground"` (default) puts the data's ground level on the map's terrain; `"absolute"` keeps surveyed elevations. `zOffset` and `verticalExaggeration` adjust both.
- **In an open page:** `await gisMapOnline.layers.add(url, { type: "pointcloud", scene3d })`. Local files are added from Add data; they stay in the project and never go into links.

Limits: files must allow browser access (CORS); whole files load into memory, so very large surveys should be tiled or thinned first. Not yet available: COPC/EPT/3D Tiles streaming, point picking, clearance (vegetation-to-conductor) measurement, IFC, DWG and DXF (convert to glTF), the globe and the ArcGIS engine. Report these instead of claiming them.
