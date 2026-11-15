// Weapons: one table, one viewmodel. Hitscan; main.js owns the ray + damage.
// Spread punishes moving/airborne/sprinting; crouch + ADS tighten it; recoil kicks the view.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

export const WEAPONS = {
  p2000: { name: 'P2000', price: 0, dmg: 26, head: 4, rate: 0.14, mag: 13, reserve: 52, reload: 1.4, spread: 0.006, move: 0.020, auto: false, kick: 0.010, range: 40, sound: 'pistol' },
  mp9: { name: 'MP9', price: 1500, dmg: 19, head: 4, rate: 0.075, mag: 30, reserve: 120, reload: 2.0, spread: 0.011, move: 0.026, auto: true, kick: 0.008, range: 30, sound: 'smg' },
  vk47: { name: 'VK-47', price: 2700, dmg: 33, head: 4, rate: 0.10, mag: 30, reserve: 90, reload: 2.2, spread: 0.004, move: 0.024, auto: true, kick: 0.016, range: 60, sound: 'rifle' },
  longshot: { name: 'LONGSHOT', price: 4750, dmg: 95, head: 4, rate: 1.1, mag: 5, reserve: 15, reload: 3.2, spread: 0.001, move: 0.045, auto: false, kick: 0.045, range: 90, sound: 'sniper', zoom: 2.6 },
  // grenades are items, not guns; listed here only for the buy menu
};
export const BUY_ITEMS = [
  { id: 'mp9', kind: 'gun', label: 'MP9 SMG', price: 1500, desc: 'Fast, close-range spray' },
  { id: 'vk47', kind: 'gun', label: 'VK-47 Rifle', price: 2700, desc: 'Hard-hitting all-rounder' },
  { id: 'longshot', kind: 'gun', label: 'LONGSHOT Sniper', price: 4750, desc: 'One-shot body at range' },
  { id: 'armor', kind: 'armor', label: 'Kevlar Armor', price: 650, desc: 'Absorbs 50% damage, 100 pts' },
  { id: 'he', kind: 'nade', label: 'HE Grenade', price: 300, desc: 'Radius blast damage' },
  { id: 'flash', kind: 'nade', label: 'Flashbang', price: 200, desc: 'Blinds anyone facing it' },
  { id: 'smoke', kind: 'nade', label: 'Smoke Grenade', price: 300, desc: 'Blocks sight ~12s' },
];

export function createWeapons(S, camera) {
  const grip = new THREE.MeshStandardMaterial({ color: PALETTE.hairline, roughness: 0.7, metalness: 0.25 });
  const bodyM = new THREE.MeshStandardMaterial({ color: PALETTE.ink, roughness: 0.45, metalness: 0.4 });
  const darkM = new THREE.MeshStandardMaterial({ color: PALETTE.dark, roughness: 0.6, metalness: 0.3 });
  const model = new THREE.Group();
  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.1, 0.42), bodyM);
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.045, 0.42), grip);
  barrel.position.set(0, 0.025, -0.38);
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.08, 0.22), grip);
  stock.position.set(0, -0.02, 0.3);
  const sight = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.06, 0.08), darkM);
  sight.position.set(0, 0.08, -0.1);
  model.add(receiver, barrel, stock, sight);
  model.position.set(0.24, -0.2, -0.42);
  camera.add(model);
  const flash = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.16),
    new THREE.MeshBasicMaterial({ color: PALETTE.accent, transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide }));
  flash.position.set(0.24, -0.18, -0.95); flash.visible = false; camera.add(flash);
  const flashLight = new THREE.PointLight(PALETTE.accent, 0, 6);
  flashLight.position.set(0.24, -0.16, -0.6); camera.add(flashLight);

  const ammo = {}; // per-weapon {mag, reserve}
  for (const id of Object.keys(WEAPONS)) ammo[id] = { mag: WEAPONS[id].mag, reserve: WEAPONS[id].reserve };
  const st = { cooldown: 0, reloadLeft: 0, flash: 0, kick: 0, switching: 0 };
  function cur() { return WEAPONS[S.player.weapon]; }
  function curAmmo() { return ammo[S.player.weapon]; }
  function step(dt) {
    st.cooldown = Math.max(0, st.cooldown - dt);
    st.flash = Math.max(0, st.flash - dt);
    st.kick += (0 - st.kick) * Math.min(1, dt * 14);
    st.switching = Math.max(0, st.switching - dt);
    const ads = S.player.ads;
    model.position.x += ((ads ? 0 : 0.24) - model.position.x) * Math.min(1, dt * 12);
    model.position.y += ((ads ? -0.135 : -0.2) - model.position.y) * Math.min(1, dt * 12);
    model.position.z = -0.42 + st.kick + st.switching * 0.3;
    model.rotation.x = st.kick * 2.2 + (st.reloadLeft > 0 ? -0.5 * Math.min(1, (cur().reload - st.reloadLeft)) : 0);
    flash.visible = st.flash > 0; flash.rotation.z = st.flash * 30;
    flashLight.intensity = st.flash > 0 ? 16 : 0;
    if (st.reloadLeft > 0) {
      st.reloadLeft = Math.max(0, st.reloadLeft - dt);
      if (st.reloadLeft === 0) {
        const a = curAmmo(), need = cur().mag - a.mag, take = Math.min(need, a.reserve);
        a.mag += take; a.reserve -= take;
      }
    }
  }
  return {
    st, ammo, step,
    def() { return cur(); },
    mag() { return curAmmo().mag; },
    reserve() { return curAmmo().reserve; },
    ready() { return curAmmo().mag > 0 && st.cooldown === 0 && st.reloadLeft === 0 && st.switching === 0; },
    reloading() { return st.reloadLeft > 0; },
    takeRound() { const a = curAmmo(); if (a.mag <= 0) return false; a.mag -= 1; return true; },
    pullTrigger() { st.cooldown = cur().rate; st.flash = 0.06; st.kick = 0.055; },
    reload() { const a = curAmmo(); if (st.reloadLeft > 0 || a.mag === cur().mag || a.reserve === 0) return false; st.reloadLeft = cur().reload; return true; },
    switchTo(id) { if (!WEAPONS[id] || !S.player.owned[id] || S.player.weapon === id) return false; S.player.weapon = id; st.reloadLeft = 0; st.cooldown = 0; st.switching = 0.3; return true; },
    give(id) { if (!ammo[id]) ammo[id] = { mag: WEAPONS[id].mag, reserve: WEAPONS[id].reserve }; },
    refillAll() { for (const id of Object.keys(WEAPONS)) ammo[id] = { mag: WEAPONS[id].mag, reserve: WEAPONS[id].reserve }; },
    spread(speed, airborne) {
      const w = cur(), p = S.player;
      let s = w.spread + Math.min(1, speed / 5.2) * w.move + p.bloom * 0.02;
      if (airborne) s += 0.03;
      if (p.crouching) s *= 0.6;
      if (p.ads) s *= S.player.weapon === 'longshot' ? 0.15 : 0.45;
      if (p.sprinting) s *= 1.8;
      return s;
    },
  };
}
