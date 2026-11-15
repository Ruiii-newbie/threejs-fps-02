// FOUNDRY map data + build. Original industrial yard: two bomb sites (A Foundry west,
// B Depot east), a mid lane, a long east corridor, a connector, crates/containers as cover.
// All geometry is styled boxes; every box is a collider and a bullet stopper.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

// [w,h,d, x,y,z, material]  y = centre height
const BOXES = [
  // floor + perimeter (64 x 56)
  [64.4, 0.4, 56.4, 0, -0.2, 0, 'floor'],
  [0.5, 5.0, 56.4, -32.2, 2.5, 0, 'wall'], [0.5, 5.0, 56.4, 32.2, 2.5, 0, 'wall'],
  [64.4, 5.0, 0.5, 0, 2.5, -28.2, 'wall'], [64.4, 5.0, 0.5, 0, 2.5, 28.2, 'wall'],
  // site A structures (west-north)
  [8, 3.4, 1.2, -26, 1.7, -24, 'wall'], [1.2, 3.4, 8, -29.5, 1.7, -19, 'wall'],
  [4.5, 2.6, 2.2, -24, 1.3, -14.5, 'containerB'], [2.2, 1.2, 2.2, -18.5, 0.6, -21, 'crate'],
  [1.2, 1.2, 1.2, -21, 0.6, -16, 'crate'],
  // site B structures (east-north)
  [8, 3.4, 1.2, 26, 1.7, -24, 'wall'], [1.2, 3.4, 8, 29.5, 1.7, -19, 'wall'],
  [4.5, 2.6, 2.2, 24, 1.3, -14.5, 'container'], [2.2, 1.2, 2.2, 18.5, 0.6, -21, 'crate'],
  [1.2, 1.2, 1.2, 21, 0.6, -16, 'crate'],
  // mid lane walls (gaps to peek through)
  [1.4, 2.8, 7, -6, 1.4, -2, 'wall'], [1.4, 2.8, 7, 6, 1.4, -2, 'wall'],
  [10, 2.2, 1.2, 0, 1.1, 6, 'wall'], [3, 1.1, 3, 0, 0.55, 0, 'crate'],
  [2.4, 1.1, 1.2, -12, 0.55, 2, 'crate'], [2.4, 1.1, 1.2, 12, 0.55, 2, 'crate'],
  // long corridor east: divider + crates
  [1.2, 3.0, 14, 16, 1.5, -12, 'wall'], [1.2, 3.0, 10, 16, 1.5, 12, 'wall'],
  [2.2, 1.2, 2.2, 21, 0.6, -6, 'crate'], [2.2, 1.2, 2.2, 21, 0.6, 6, 'crate'],
  [4, 2.6, 2.2, 26, 1.3, 2, 'containerB'],
  // west lane + connector
  [1.2, 3.0, 12, -16, 1.5, -10, 'wall'], [1.2, 3.0, 8, -16, 1.5, 12, 'wall'],
  [2.2, 1.2, 2.2, -21, 0.6, -6, 'crate'], [2.2, 1.2, 2.2, -21, 0.6, 6, 'crate'],
  [4, 2.6, 2.2, -26, 1.3, 2, 'container'],
  // connector (centre-north) + spawn cover
  [12, 2.4, 1.2, 0, 1.2, -10, 'wall'], [3.6, 1.1, 1.2, -8, 0.55, -13, 'crate'],
  [3.6, 1.1, 1.2, 8, 0.55, -13, 'crate'],
  [2.4, 1.1, 1.2, -4, 0.55, 21, 'crate'], [2.4, 1.1, 1.2, 4, 0.55, 21, 'crate'],
  [1.2, 2.2, 1.2, 0, 1.1, 16, 'wall'],
  // furnace pillars at A, silo at B (tall landmarks)
  [2, 4.6, 2, -27, 2.3, -11, 'dark'], [2, 4.6, 2, 27, 2.3, -11, 'dark'],
  [6, 0.6, 6, -22, 0.3, -18, 'surface'], [6, 0.6, 6, 22, 0.3, -18, 'surface'],
];

export const SITES = {
  A: { x: -22, z: -18, r: 5.5, name: 'A · FOUNDRY' },
  B: { x: 22, z: -18, r: 5.5, name: 'B · DEPOT' },
};
export const SPAWNS = {
  V: [[0, 24], [-5, 25], [5, 25], [-10, 23], [10, 23]],
  S: [[-24, -20], [-18, -14], [24, -20], [18, -14], [0, -16]],
};
// Waypoint graph: nodes [x,z], edges as pairs. Bots pathfind with BFS over this.
export const WAYPOINTS = [
  [0, 24], [-10, 20], [10, 20], [-21, 12], [21, 12], [-10, 8], [10, 8], [0, 4],
  [-21, -2], [21, -2], [-10, -6], [10, -6], [0, -8], [-22, -14], [22, -14],
  [-22, -19], [22, -19], [-12, -16], [12, -16], [0, -16], [-26, -22], [26, -22],
  [-4, -20], [4, -20],
];
export const EDGES = [
  [0, 1], [0, 2], [1, 3], [2, 4], [1, 5], [2, 6], [3, 7], [4, 7], [5, 7], [6, 7],
  [3, 8], [4, 9], [5, 10], [6, 11], [7, 12], [8, 10], [9, 11], [10, 12], [11, 12],
  [10, 17], [11, 18], [12, 19], [13, 15], [14, 16], [13, 17], [14, 18],
  [15, 20], [16, 21], [17, 22], [18, 23], [19, 22], [19, 23], [8, 13], [9, 14],
  [12, 17], [12, 18], [0, 5], [0, 6],
];
export const ADJ = WAYPOINTS.map(() => []);
for (const [a, b] of EDGES) { ADJ[a].push(b); ADJ[b].push(a); }

export function nearestNode(x, z) {
  let best = 0, bd = 1e9;
  for (let i = 0; i < WAYPOINTS.length; i++) {
    const dx = WAYPOINTS[i][0] - x, dz = WAYPOINTS[i][1] - z, d = dx * dx + dz * dz;
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}
// BFS path (node ids) from node a to node b.
export function findPath(a, b) {
  if (a === b) return [a];
  const prev = new Int16Array(WAYPOINTS.length).fill(-1);
  const q = [a]; prev[a] = a;
  for (let h = 0; h < q.length; h++) {
    const n = q[h];
    for (const m of ADJ[n]) if (prev[m] === -1) { prev[m] = n; if (m === b) { const p = [b]; let c = b; while (c !== a) { c = prev[c]; p.unshift(c); } return p; } q.push(m); }
  }
  return [a];
}

export function createMap(scene) {
  const group = new THREE.Group(); scene.add(group);
  const mats = {};
  for (const n of Object.keys(PALETTE)) mats[n] = new THREE.MeshStandardMaterial({ color: PALETTE[n], roughness: n === 'accent' || n === 'teal' ? 0.5 : 0.92, metalness: 0.08 });
  const colliders = [], shootables = [];
  const geoCache = new Map();
  function box(w, h, d, x, y, z, mat) {
    const key = `${w}|${h}|${d}`;
    if (!geoCache.has(key)) geoCache.set(key, new THREE.BoxGeometry(w, h, d));
    const m = new THREE.Mesh(geoCache.get(key), mats[mat] || mats.wall);
    m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
    group.add(m); colliders.push(new THREE.Box3().setFromObject(m)); shootables.push(m);
    return m;
  }
  for (const b of BOXES) box(...b);
  // site pads: glowing teal rings (flat boxes, no collision)
  for (const s of Object.values(SITES)) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(s.r - 0.35, s.r, 40),
      new THREE.MeshBasicMaterial({ color: PALETTE.teal, transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(s.x, 0.65, s.z); group.add(ring);
    const label = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.85),
      new THREE.MeshBasicMaterial({ color: PALETTE.teal, transparent: true, opacity: 0.22, side: THREE.DoubleSide }));
    label.rotation.x = -Math.PI / 2; label.position.set(s.x, 0.62, s.z); group.add(label);
  }
  // amber strip lights along mid + site beacons
  const hemi = new THREE.HemisphereLight(PALETTE.surface, PALETTE.canvas, 1.15); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2dd, 2.0);
  sun.position.set(14, 22, 10); sun.target.position.set(0, 0, -4); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -36, right: 36, top: 32, bottom: -32, far: 60 });
  sun.shadow.bias = -0.0006; scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight(0x8fa8c8, 0.5); fill.position.set(-12, 10, 14); scene.add(fill);
  for (const [x, z, c] of [[-22, -18, 0x2fb8a6], [22, -18, 0x2fb8a6], [0, 4, 0xf0a830], [0, -16, 0xf0a830]]) {
    const p = new THREE.PointLight(c, 14, 16); p.position.set(x, 4.2, z); scene.add(p);
  }
  scene.fog = new THREE.Fog(PALETTE.canvas, 30, 85);
  return { colliders, shootables, group };
}
