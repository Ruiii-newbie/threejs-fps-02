// AABB vs capsule (player/bot) collision. One job: move a vertical capsule through boxes.
import * as THREE from 'three';
const probe = new THREE.Box3();
export function overlapsAt(colliders, x, y, z, r, h, lift) {
  probe.min.set(x - r, y + lift, z - r);
  probe.max.set(x + r, y + h - lift, z + r);
  for (const c of colliders) if (probe.intersectsBox(c)) return c;
  return null;
}
// Move pos (Vector3, feet) by vel*dt, axis by axis. Returns {onGround}.
export function moveCapsule(colliders, pos, vel, dt, r, h) {
  let onGround = false;
  const nx = pos.x + vel.x * dt;
  if (!overlapsAt(colliders, nx, pos.y, pos.z, r, h, 0.04)) pos.x = nx; else vel.x = 0;
  const nz = pos.z + vel.z * dt;
  if (!overlapsAt(colliders, pos.x, pos.y, nz, r, h, 0.04)) pos.z = nz; else vel.z = 0;
  pos.y += vel.y * dt;
  const hit = overlapsAt(colliders, pos.x, pos.y, pos.z, r, h, 0);
  if (hit && vel.y <= 0) { pos.y = hit.max.y; vel.y = 0; onGround = true; }
  else if (hit) { pos.y = hit.min.y - h; vel.y = 0; }
  if (pos.y < 0) { pos.y = 0; vel.y = 0; onGround = true; }
  return onGround;
}
// Segment vs AABB list: true if blocked. Used for line-of-sight.
const _d = new THREE.Vector3(), _o = new THREE.Vector3();
export function losBlocked(colliders, a, b) {
  _d.subVectors(b, a);
  const len = _d.length();
  if (len < 0.001) return false;
  _d.multiplyScalar(1 / len);
  // slab test per box, cheap and allocation-free
  for (const c of colliders) {
    let tmin = 0, tmax = len, ok = true;
    for (let i = 0; i < 3; i++) {
      const o = i === 0 ? a.x : i === 1 ? a.y : a.z;
      const d = i === 0 ? _d.x : i === 1 ? _d.y : _d.z;
      const mn = i === 0 ? c.min.x : i === 1 ? c.min.y : c.min.z;
      const mx = i === 0 ? c.max.x : i === 1 ? c.max.y : c.max.z;
      if (Math.abs(d) < 1e-9) { if (o < mn || o > mx) { ok = false; break; } }
      else {
        let t1 = (mn - o) / d, t2 = (mx - o) / d;
        if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
        if (t1 > tmin) tmin = t1;
        if (t2 < tmax) tmax = t2;
        if (tmin > tmax) { ok = false; break; }
      }
    }
    if (ok && tmin <= len && tmax >= 0) return true;
  }
  return false;
}
