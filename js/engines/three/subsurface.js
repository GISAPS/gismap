// A below-ground layer (js/subsurface.js) as a ThreeHost item: pipes, shafts and
// bedrock units under the map. The item is drawn in x-ray (ThreeHost clears the
// depth buffer first), so terrain and buildings do not hide what is under them.
import { localFrame } from "../../geo-frame.js?v=0.1.0";
import { buildSubsurfaceGeometry, featuresBounds } from "../../subsurface.js?v=0.71.0-subsurface";

/**
 * { item, info } for ThreeHost, or null when nothing can be drawn. `elevationAt(lon, lat)`
 * is the drawn terrain height (null while its tile is loading); `colorOf(properties)` gives [r, g, b] in 0–1.
 */
export function buildSubsurfaceItem(THREE, features, config, { elevationAt = () => 0, colorOf } = {}) {
  const bounds = featuresBounds(features);
  if (!bounds) return null;
  const center = [(bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2];
  const frame = localFrame(center);
  // The host stands the item on the terrain at its centre each frame; vertices carry the relief around it.
  const anchor = elevationAt(...center);
  let missing = false;
  const groundAt = (lon, lat) => {
    const height = elevationAt(lon, lat);
    if (!Number.isFinite(height) || !Number.isFinite(anchor)) { missing = true; return 0; }
    return height - anchor;
  };
  const triangulate = (contour, holes) => THREE.ShapeUtils.triangulateShape(contour.map(([x, y]) => new THREE.Vector2(x, y)), holes.map((ring) => ring.map(([x, y]) => new THREE.Vector2(x, y))));
  const built = buildSubsurfaceGeometry(features, config, { frame, groundAt, colorOf, triangulate });
  if (!built.positions.length) return null;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(built.positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(built.normals, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(built.colors, 3));
  const material = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(geometry, material));
  // Light from above and a soft fill from below, so tube undersides still read.
  scene.add(new THREE.HemisphereLight(0xffffff, 0x6b5a48, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.4);
  sun.position.set(0.4, 0.6, 1);
  scene.add(sun);
  return {
    item: { scene, origin: frame.mercatorOrigin, scale: frame.mercatorScale, bounds, onTerrain: true, lngLat: center, xray: true },
    info: { features: built.drawn, deepest: built.deepest, triangles: built.positions.length / 9, terrainPending: missing },
  };
}
