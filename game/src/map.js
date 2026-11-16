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
  // site pads: flat visual slabs bots walk over, NOT colliders. They used to be
  // 0.6-high solid boxes, which covered the whole bot plant radius (d < 3 from the
  // site centre), so no bot could ever reach plant range at either site.
  [6, 0.12, 6, -22, 0.06, -18, 'surface'], [6, 0.12, 6, 22, 0.06, -18, 'surface'],
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
// Every edge was verified walkable: no segment crosses a solid box (checked with a
// 0.5-unit inflation, bot radius 0.34). The old graph had 25 of 38 edges crossing
// walls/crates, so bots walked into walls and never arrived. Lanes: west/east lanes
// run at x=-18/+18; the x=-16/+16 walls are crossed only in the z=-4..8 gap
// (nodes 8/9); the mid wall at (0,6) and connector wall at (0,-10) are crossed
// only around their ends (nodes 19/20/21/22); site pads are walkable (see createMap).
export const WAYPOINTS = [
  [0, 24], [0, 18], [-13, 18], [13, 18], [-18, 18], [18, 18],
  [-18, 12], [18, 12], [-18, 4], [18, 4], [-9, 4], [9, 4],
  [-6, 14], [6, 14], [-9, 12], [9, 12], [0, 4],
  [-18, 0], [18, 0], [-9, 2], [9, 2], [-9, -7], [9, -7],
  [0, -8], [-12, -8], [12, -8], [-18, -12], [18, -12],
  [-18, -18], [18, -18], [-21, -18], [21, -18],
];
export const EDGES = [
  [0, 1], [1, 2], [1, 3], [2, 4], [3, 5], [4, 6], [5, 7],
  [6, 8], [7, 9], [8, 10], [9, 11], [10, 14], [11, 15],
  [12, 14], [13, 15], [1, 12], [1, 13], [12, 13], [14, 10], [15, 11],
  [10, 16], [11, 16], [16, 19], [16, 20], [19, 21], [20, 22],
  [21, 23], [22, 23], [23, 24], [23, 25], [19, 24], [20, 25],
  [6, 17], [7, 18], [17, 8], [18, 9], [17, 26], [18, 27],
  [8, 26], [9, 27], [26, 28], [27, 29], [28, 30], [29, 31],
  [14, 12], [15, 13],
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
// Nearest waypoint reachable in a straight line from (x, z): the segment to it
// must not cross a solid box (0.34 inflation = bot radius). nearestNode() alone
// can snap to a node across a wall — observed live: the mid patroller spawning
// at (0,-16) snaps to node 23 (0,-8) straight through the connector wall at
// z=-10 and pushes into it forever, and stuck-recovery re-paths from the same
// snapped node, so it never escapes. Falls back to plain nearestNode when no
// node has a clear segment.
const SOLID_BOXES = BOXES.filter((b) => b[6] !== 'floor' && b[6] !== 'surface' && b[4] + b[1] / 2 > 0.5);
function segBlocked2D(x1, z1, x2, z2) {
  for (const b of SOLID_BOXES) {
    const w = b[0], d = b[2], cx = b[3], cz = b[5];
    const mnX = cx - w / 2 - 0.34, mxX = cx + w / 2 + 0.34, mnZ = cz - d / 2 - 0.34, mxZ = cz + d / 2 + 0.34;
    const dx = x2 - x1, dz = z2 - z1;
    let tmin = 0, tmax = 1, ok = true;
    for (const [o, dd, mn, mx] of [[x1, dx, mnX, mxX], [z1, dz, mnZ, mxZ]]) {
      if (Math.abs(dd) < 1e-9) { if (o < mn || o > mx) { ok = false; break; } }
      else {
        let t1 = (mn - o) / dd, t2 = (mx - o) / dd;
        if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
        if (t1 > tmin) tmin = t1;
        if (t2 < tmax) tmax = t2;
        if (tmin > tmax) { ok = false; break; }
      }
    }
    if (ok) return true;
  }
  return false;
}
export function nearestNodeClear(x, z) {
  let best = -1, bd = 1e9;
  for (let i = 0; i < WAYPOINTS.length; i++) {
    const dx = WAYPOINTS[i][0] - x, dz = WAYPOINTS[i][1] - z, d = dx * dx + dz * dz;
    if (d < bd && !segBlocked2D(x, z, WAYPOINTS[i][0], WAYPOINTS[i][1])) { bd = d; best = i; }
  }
  return best === -1 ? nearestNode(x, z) : best;
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
    group.add(m);
    // 'surface' pads are flat visuals (see BOXES): bots and the player walk over them.
    if (mat !== 'surface') colliders.push(new THREE.Box3().setFromObject(m));
    shootables.push(m);
    return m;
  }
  for (const b of BOXES) box(...b);
  // site pads: glowing teal rings (flat boxes, no collision)
  for (const s of Object.values(SITES)) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(s.r - 0.35, s.r, 40),
      new THREE.MeshBasicMaterial({ color: PALETTE.teal, transparent: true, opacity: 0.75, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(s.x, 0.65, s.z); group.add(ring);
    const label = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.85),
      new THREE.MeshBasicMaterial({ color: PALETTE.teal, transparent: true, opacity: 0.22, side: THREE.DoubleSide }));
    label.rotation.x = -Math.PI / 2; label.position.set(s.x, 0.62, s.z); group.add(label);
  }
  // amber strip lights along mid + site beacons
  // Round 4: hemi 1.15 -> 1.35 and fog pushed out (30/85 -> 34/95) so the
  // mid/far field stops washing grey in screenshots; site rings brighter.
  const hemi = new THREE.HemisphereLight(PALETTE.surface, PALETTE.canvas, 1.35); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2dd, 2.0);
  sun.position.set(14, 22, 10); sun.target.position.set(0, 0, -4); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -36, right: 36, top: 32, bottom: -32, far: 60 });
  sun.shadow.bias = -0.0006; scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight(0x8fa8c8, 0.5); fill.position.set(-12, 10, 14); scene.add(fill);
  for (const [x, z, c] of [[-22, -18, 0x2fb8a6], [22, -18, 0x2fb8a6], [0, 4, 0xf0a830], [0, -16, 0xf0a830]]) {
    const p = new THREE.PointLight(c, 14, 16); p.position.set(x, 4.2, z); scene.add(p);
  }
  scene.fog = new THREE.Fog(PALETTE.canvas, 34, 95);
  return { colliders, shootables, group };
}
