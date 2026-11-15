// Player movement: acceleration, friction, gravity, sprint/crouch/jump, capsule vs AABB.
// Writes into S.player.pos/vel; S.player mirrors yaw/pitch/eye for the camera.
import * as THREE from 'three';
import { moveCapsule, overlapsAt } from './collision.js';

const R = 0.34, STAND_H = 1.72, CROUCH_H = 1.12, STAND_EYE = 1.6, CROUCH_EYE = 1.02;
const WALK = 5.2, SPRINT = 7.0, CROUCH = 2.4, ADS = 3.1, GRAV = 20, JUMP = 6.4;

export function createPlayer(S, colliders) {
  const p = S.player;
  p.pos = new THREE.Vector3(0, 0, 24); p.vel = new THREE.Vector3();
  const wish = new THREE.Vector3();
  let stepAcc = 0;
  function look(dx, dy, sens = 0.0022) {
    p.yaw -= dx * sens;
    p.pitch = Math.max(-1.45, Math.min(1.45, p.pitch - dy * sens));
  }
  function recoil(pk, yk) { p.pitch = Math.min(1.45, p.pitch + pk); p.yaw += yk; }
  function step(dt, keys, ads) {
    if (!p.alive) { p.vel.x = 0; p.vel.z = 0; return 0; }
    const crouch = keys.has('ControlLeft') || keys.has('ControlRight') || keys.has('KeyC');
    if (crouch && !p.crouching) { p.crouching = true; p.height = CROUCH_H; }
    else if (!crouch && p.crouching && !overlapsAt(colliders, p.pos.x, p.pos.y, p.pos.z, R, STAND_H, 0.02)) { p.crouching = false; p.height = STAND_H; }
    p.eye += ((p.crouching ? CROUCH_EYE : STAND_EYE) - p.eye) * Math.min(1, dt * 12);
    const fwd = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
    const str = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
    wish.set(0, 0, 0);
    if (fwd || str) {
      const s = Math.sin(p.yaw), c = Math.cos(p.yaw);
      wish.set(-s * fwd + c * str, 0, -c * fwd - s * str).normalize();
    }
    const sprint = (keys.has('ShiftLeft') || keys.has('ShiftRight')) && fwd > 0 && !p.crouching && !ads;
    p.sprinting = sprint; p.ads = ads && !sprint;
    const speed = p.crouching ? CROUCH : p.ads ? ADS : sprint ? SPRINT : WALK;
    const blend = Math.min(1, (p.onGround ? 42 : 9) * dt / speed);
    p.vel.x += (wish.x * speed - p.vel.x) * blend;
    p.vel.z += (wish.z * speed - p.vel.z) * blend;
    if (p.onGround && !wish.lengthSq()) { const d = Math.max(0, 1 - 9 * dt); p.vel.x *= d; p.vel.z *= d; }
    if (keys.has('Space') && p.onGround) { p.vel.y = JUMP; p.onGround = false; }
    p.vel.y -= GRAV * dt;
    p.onGround = moveCapsule(colliders, p.pos, p.vel, dt, R, p.height);
    p.vel.y = Math.max(-30, p.vel.y);
    // footstep pacing for audio
    const gs = Math.hypot(p.vel.x, p.vel.z);
    if (p.onGround && gs > 2) { stepAcc += gs * dt; if (stepAcc > 2.2) { stepAcc = 0; return gs; } }
    return 0;
  }
  return {
    step, look, recoil,
    groundSpeed() { return Math.hypot(p.vel.x, p.vel.z); },
    reset(x, z) {
      p.pos.set(x, 0, z); p.vel.set(0, 0, 0); p.hp = 100; p.armor = 0; p.alive = true;
      p.yaw = 0; p.pitch = 0; p.crouching = false; p.height = STAND_H; p.eye = STAND_EYE;
      p.flashBlind = 0; p.plantProgress = 0; p.defuseProgress = 0; p.damageFlash = 0;
    },
  };
}
