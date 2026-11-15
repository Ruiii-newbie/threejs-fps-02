// Grenades: arced physics, HE blast, flashbang blindness, smoke clouds that block LOS.
// One shared pool; no allocation in the hot loop (fixed arrays, reused vectors).
import * as THREE from 'three';
import { moveCapsule } from './collision.js';
import { losBlocked } from './collision.js';

const MAX = 12;
export function createGrenades(S, scene, colliders) {
  const pool = [];
  const geo = new THREE.SphereGeometry(0.09, 10, 8);
  const matHE = new THREE.MeshStandardMaterial({ color: 0x3a3f45, roughness: 0.5, metalness: 0.6 });
  const matFlash = new THREE.MeshStandardMaterial({ color: 0xd8d8d8, roughness: 0.4, metalness: 0.3 });
  const matSmoke = new THREE.MeshStandardMaterial({ color: 0x2e6b62, roughness: 0.7, metalness: 0.1 });
  for (let i = 0; i < MAX; i++) {
    const mesh = new THREE.Mesh(geo, matHE); mesh.visible = false; scene.add(mesh);
    pool.push({ active: false, kind: 'he', mesh, pos: new THREE.Vector3(), vel: new THREE.Vector3(), fuse: 0, bounced: 0 });
  }
  const smokes = []; // {x,y,z,r,until}
  const smokeMat = new THREE.MeshStandardMaterial({ color: 0x9aa4ad, transparent: true, opacity: 0.82, roughness: 1, depthWrite: false });
  const smokeGeo = new THREE.SphereGeometry(1, 12, 10);
  const smokeMeshes = [];
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(smokeGeo, smokeMat); m.visible = false; scene.add(m); smokeMeshes.push(m);
  }
  function throwNade(kind, origin, dir) {
    const g = pool.find((p) => !p.active); if (!g) return false;
    g.active = true; g.kind = kind; g.fuse = kind === 'he' ? 1.6 : kind === 'flash' ? 1.2 : 1.4;
    g.pos.copy(origin); g.vel.copy(dir).multiplyScalar(13); g.vel.y += 3.5; g.bounced = 0;
    g.mesh.material = kind === 'he' ? matHE : kind === 'flash' ? matFlash : matSmoke;
    g.mesh.visible = true; g.mesh.position.copy(g.pos);
    return true;
  }
  function smokeBlocks(a, b) {
    for (const s of smokes) {
      if (S.time > s.until) continue;
      // segment-sphere test
      const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
      const fx = a.x - s.x, fy = a.y - s.y, fz = a.z - s.z;
      const A = dx * dx + dy * dy + dz * dz, B = 2 * (fx * dx + fy * dy + fz * dz), C = fx * fx + fy * fy + fz * fz - s.r * s.r;
      const disc = B * B - 4 * A * C;
      if (disc < 0) continue;
      const t = (-B - Math.sqrt(disc)) / (2 * A);
      if (t >= 0 && t <= 1) return true;
    }
    return false;
  }
  // detonate: returns {kind,pos} for main to apply damage/flash/smoke + effects + sound
  function step(dt, onDetonate) {
    for (const g of pool) {
      if (!g.active) continue;
      g.fuse -= dt;
      g.vel.y -= 14 * dt;
      moveCapsule(colliders, g.pos, g.vel, dt, 0.09, 0.18);
      if ((g.vel.x === 0 || g.vel.z === 0) && g.bounced < 2) { g.bounced++; }
      if (g.pos.y <= 0.02 && Math.abs(g.vel.y) > 1) { g.vel.y *= -0.35; g.vel.x *= 0.7; g.vel.z *= 0.7; g.pos.y = 0.02; }
      g.mesh.position.copy(g.pos);
      if (g.fuse <= 0) {
        g.active = false; g.mesh.visible = false;
        if (g.kind === 'smoke') {
          smokes.push({ x: g.pos.x, y: 1.2, z: g.pos.z, r: 3.2, until: S.time + 12 });
          if (smokes.length > 6) smokes.shift();
        }
        onDetonate(g.kind, g.pos);
      }
    }
    // refresh smoke meshes (reuse 6 meshes)
    let mi = 0;
    for (const s of smokes) {
      if (S.time > s.until || mi >= 6) continue;
      const m = smokeMeshes[mi++];
      m.visible = true; m.position.set(s.x, s.y, s.z);
      const grow = Math.min(1, (s.until - S.time) / 2 + 0.4);
      m.scale.setScalar(s.r * (1.2 - grow * 0.2));
      m.material.opacity = 0.82 * Math.min(1, (s.until - S.time) / 2);
    }
    for (; mi < 6; mi++) smokeMeshes[mi].visible = false;
    if (smokes.length && smokes[0].until < S.time) smokes.shift();
  }
  return {
    throwNade, step, smokeBlocks,
    clear() { for (const g of pool) { g.active = false; g.mesh.visible = false; } smokes.length = 0; },
  };
}
