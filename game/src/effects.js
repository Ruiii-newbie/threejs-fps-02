// Effects: pooled tracers + impact particles + explosion flash. Fixed pools, zero
// allocation per frame in the hot path (reused vectors, pre-made Points buffers).
import * as THREE from 'three';
import { PALETTE } from './palette.js';

export function createEffects(scene) {
  // tracers: 24 reusable line segments
  const tracers = [];
  const tMat = new THREE.LineBasicMaterial({ color: PALETTE.accent, transparent: true, opacity: 0.9 });
  for (let i = 0; i < 24; i++) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    const line = new THREE.Line(g, tMat.clone()); line.visible = false; line.frustumCulled = false;
    scene.add(line); tracers.push({ line, life: 0 });
  }
  let tIdx = 0;
  // particles: one Points cloud, 240 slots, positions updated in place
  const P = 240;
  const pGeo = new THREE.BufferGeometry();
  const pPos = new Float32Array(P * 3);
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  const points = new THREE.Points(pGeo, new THREE.PointsMaterial({ color: PALETTE.accent, size: 0.09, transparent: true, opacity: 0.95 }));
  points.frustumCulled = false; scene.add(points);
  const pVel = new Float32Array(P * 3), pLife = new Float32Array(P);
  let pIdx = 0;
  const _v = new THREE.Vector3();
  function tracer(from, to) {
    const t = tracers[tIdx]; tIdx = (tIdx + 1) % tracers.length;
    const a = t.line.geometry.attributes.position.array;
    a[0] = from.x; a[1] = from.y; a[2] = from.z; a[3] = to.x; a[4] = to.y; a[5] = to.z;
    t.line.geometry.attributes.position.needsUpdate = true;
    t.line.visible = true; t.life = 0.07;
  }
  function burst(pos, n, color, speed = 3) {
    for (let k = 0; k < n; k++) {
      const i = pIdx; pIdx = (pIdx + 1) % P;
      pPos[i * 3] = pos.x; pPos[i * 3 + 1] = pos.y; pPos[i * 3 + 2] = pos.z;
      const th = Math.random() * Math.PI * 2, ph = Math.acos(Math.random() * 2 - 1), s = speed * (0.4 + Math.random() * 0.8);
      pVel[i * 3] = Math.sin(ph) * Math.cos(th) * s;
      pVel[i * 3 + 1] = Math.cos(ph) * s + 1;
      pVel[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * s;
      pLife[i] = 0.5 + Math.random() * 0.4;
    }
    points.material.color.set(color);
  }
  function explosion(pos) {
    burst(pos, 60, 0xff7733, 7);
    _v.copy(pos); _v.y += 0.5;
    burst(_v, 30, 0xffcc66, 4);
  }
  function step(dt) {
    for (const t of tracers) if (t.life > 0) { t.life -= dt; if (t.life <= 0) t.line.visible = false; }
    let any = false;
    for (let i = 0; i < P; i++) {
      if (pLife[i] <= 0) continue;
      any = true; pLife[i] -= dt;
      pPos[i * 3] += pVel[i * 3] * dt; pPos[i * 3 + 1] += pVel[i * 3 + 1] * dt; pPos[i * 3 + 2] += pVel[i * 3 + 2] * dt;
      pVel[i * 3 + 1] -= 6 * dt;
      if (pLife[i] <= 0) pPos[i * 3 + 1] = -100;
    }
    if (any) pGeo.attributes.position.needsUpdate = true;
  }
  return { tracer, burst, explosion, step };
}
