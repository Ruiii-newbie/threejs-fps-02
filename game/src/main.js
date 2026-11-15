// STRIKEPOINT — bootstrap + fixed 60 Hz sim + render. Owns the shooting ray, plant/defuse,
// buy handling and screenshot presets. ?shot=start|buy|combat|plant&seed=N stages a
// deterministic frame, renders twice, freezes, sets window.__shotReady.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { createState } from './state.js';
import { createMap, SITES, SPAWNS } from './map.js';
import { createInput } from './input.js';
import { createPlayer } from './player.js';
import { createWeapons, WEAPONS, BUY_ITEMS } from './weapons.js';
import { createGrenades } from './grenades.js';
import { createBots } from './bots.js';
import { createRounds } from './rounds.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { createEffects } from './effects.js';
import { losBlocked } from './collision.js';

const FIXED_STEP = 1 / 60;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seed = Number.parseInt(params.get('seed') ?? '1', 10) || 1;
function mulberry32(a) { return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const random = mulberry32(seed);

const S = createState(); S.rngSeed = seed;
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('game').appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.canvas);
const camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.05, 160);
scene.add(camera);

const map = createMap(scene);
const effects = createEffects(scene);
const audio = createAudio();
const hud = createHud(S);
const input = createInput(renderer.domElement, onLockChange);
const player = createPlayer(S, map.colliders);
const weapons = createWeapons(S, camera);
const grenades = createGrenades(S, scene, map.colliders);
const raycaster = new THREE.Raycaster(); raycaster.far = 120;
const dir = new THREE.Vector3(), muzzle = new THREE.Vector3(), eyeV = new THREE.Vector3();
let frozen = false, started = false, accumulator = 0, lastTime = performance.now();
let nadeSlot = 'he';

const bots = createBots(S, scene, map.colliders, {
  smokeBlocks: (a, b) => grenades.smokeBlocks(a, b),
  tracer: (a, b) => effects.tracer(a, b),
  shotSound: (k, d) => audio.shot(k, d),
  damagePlayer: (dmg, fromPos, bot) => damagePlayer(dmg, fromPos, bot),
  onBotDeath: (bot, killer) => onBotDeath(bot, killer),
  onPlanted: (bot) => { rounds.plant(bot.site || 'A', bot); hud.banner('BOMB PLANTED — defend it!'); audio.beep(3); },
  onDefused: () => { rounds.defuse(); },
});
S.bots = bots.bots;

const rounds = createRounds(S, {
  onRoundStart: (r) => {
    player.reset(...SPAWNS.V[0]); weapons.refillAll();
    S.player.weapon = 'p2000'; if (!S.player.owned.p2000) S.player.owned = { p2000: true };
    S.player.grenades = { he: 0, flash: 0, smoke: 0 };
    bots.reset(r); grenades.clear();
    hud.banner(`ROUND ${r} — BUY PHASE (B)`, 3000);
    hud.showBuy(false, S.money);
  },
  onRoundEnd: (winner, reason) => {
    hud.banner(winner === 'V' ? `ROUND WON — ${reason}` : `ROUND LOST — ${reason}`, 3800);
    if (winner === 'V') audio.win(); else audio.lose();
    hud.showBuy(false, S.money);
  },
  onMatchEnd: (w) => {
    hud.showOverlay('end', w === 'V' ? `VANGUARD wins ${S.scoreV}–${S.scoreS}.` : w === 'S' ? `SPECTRE wins ${S.scoreS}–${S.scoreV}.` : `Draw ${S.scoreV}–${S.scoreS}.`);
    if (document.pointerLockElement) document.exitPointerLock();
  },
  onPlanted: (site) => { hud.setBomb(`BOMB PLANTED · SITE ${site} · ${Math.ceil(S.bombTime)}s`); },
});

function onLockChange(locked) {
  if (shot) return;
  if (locked) { started = true; S.started = true; audio.unlock(); hud.hideOverlay(); hud.showBuy(false, S.money); }
  else if (!S.over) hud.showOverlay(started ? (S.player.alive ? 'paused' : 'dead') : 'start');
}
hud.onPlay(() => {
  if (shot) return;
  if (S.over) { location.reload(); return; }
  audio.unlock(); input.requestLock();
});
hud.buildBuy(buyItem);

function buyItem(item) {
  if (S.phase !== 'freeze' || S.money < item.price) return;
  if (item.kind === 'gun') {
    if (S.player.owned[item.id]) return;
    S.money -= item.price; S.player.owned[item.id] = true; weapons.give(item.id); weapons.switchTo(item.id);
  } else if (item.kind === 'armor') {
    if (S.player.armor >= 100) return;
    S.money -= item.price; S.player.armor = 100;
  } else {
    S.money -= item.price; S.player.grenades[item.id]++;
  }
  hud.showBuy(true, S.money); audio.beep(1);
}
function damagePlayer(dmg, fromPos, attacker) {
  const p = S.player; if (!p.alive || S.phase === 'freeze') return;
  let rem = dmg;
  if (p.armor > 0) { const ab = Math.min(p.armor, rem * 0.5); p.armor -= ab; rem -= ab; }
  p.hp -= rem; p.damageFlash = 1;
  const ang = Math.atan2(fromPos.x - p.pos.x, fromPos.z - p.pos.z);
  p.lastDamageDir = ang - p.yaw;
  if (p.hp <= 0) {
    p.hp = 0; p.alive = false; S.deaths++;
    hud.addFeed(`${attacker ? attacker.name : 'SPECTRE'} ▸ you`);
    hud.banner('YOU ARE DOWN', 2500);
    if (document.pointerLockElement) document.exitPointerLock();
    // bomb carrier falls: nearest living V bot takes the carrier role
    const c = bots.nearestCarrier(); if (c) { bots.setCarrier(c); c.site = 'A'; }
    checkRoundEnd();
  }
}
function onBotDeath(bot, killer) {
  const killerName = killer === 'player' ? 'you' : killer ? killer.name : '?';
  hud.addFeed(`${killerName} ▸ ${bot.name}`);
  if (killer === 'player') { S.kills++; S.roundKills++; S.money += 300; }
  if (bot.team === 'V' && bot.carrier) { const c = bots.nearestCarrier(); if (c) bots.setCarrier(c); }
  checkRoundEnd();
}
function checkRoundEnd() {
  const vAlive = (S.player.alive ? 1 : 0) + bots.aliveCount('V');
  const sAlive = bots.aliveCount('S');
  rounds.checkEliminations(vAlive, sAlive);
}
function siteAt(x, z) {
  for (const [k, s] of Object.entries(SITES)) if (Math.hypot(s.x - x, s.z - z) < s.r) return k;
  return null;
}
function shoot() {
  const w = weapons.def();
  if (!weapons.takeRound()) { audio.dry(); weapons.reload(); return; }
  camera.getWorldDirection(dir);
  const spread = weapons.spread(player.groundSpeed(), !S.player.onGround);
  dir.x += (random() * 2 - 1) * spread; dir.y += (random() * 2 - 1) * spread; dir.z += (random() * 2 - 1) * spread;
  dir.normalize();
  eyeV.copy(camera.position);
  muzzle.copy(eyeV).addScaledVector(dir, 0.6);
  scene.updateMatrixWorld(true);
  raycaster.set(eyeV, dir);
  const targets = bots.hitMeshes().concat(map.shootables);
  const hit = raycaster.intersectObjects(targets, false)[0];
  const end = hit ? hit.point : eyeV.clone().addScaledVector(dir, 80);
  effects.tracer(muzzle, end);
  audio.shot(w.sound, 0);
  S.events.push({ x: S.player.pos.x, z: S.player.pos.z, r: 30, kind: 'shot', t: S.time });
  S.player.bloom = Math.min(1, S.player.bloom + (w.auto ? 0.09 : 0.14));
  player.recoil(w.kick * (0.8 + random() * 0.4), (random() * 2 - 1) * w.kick * 0.35);
  weapons.pullTrigger();
  if (hit) {
    effects.burst(hit.point, 6, 0xd8c98a, 2.5);
    const bot = hit.object.userData.bot;
    if (bot && bot.alive) {
      const isHead = hit.object.userData.part === 'head';
      let dmg = w.dmg * (isHead ? w.head : 1);
      if (isHead && bot.armor > 0) dmg *= 0.5; // helmet halves headshot damage
      const dist = hit.distance;
      if (dist > w.range) dmg *= Math.max(0.4, 1 - (dist - w.range) / 60);
      const killed = bots.damage(bot, dmg, 'player');
      hud.hitMarker(killed, shot ? 4000 : 120);
      audio.hit(killed);
      if (killed) hud.addFeed(`you ▸ ${bot.name}${isHead ? ' (headshot)' : ''}`);
    }
  }
}
function throwGrenade(kind) {
  const p = S.player;
  if (p.grenades[kind] <= 0) return;
  p.grenades[kind]--;
  camera.getWorldDirection(dir);
  eyeV.copy(camera.position);
  grenades.throwNade(kind, eyeV, dir);
  audio.beep(1);
}
function detonate(kind, pos) {
  if (kind === 'he') {
    effects.explosion(pos); audio.explosion();
    S.events.push({ x: pos.x, z: pos.z, r: 45, kind: 'boom', t: S.time });
    const hurt = (bp, isPlayer, bot) => {
      const d = Math.hypot(bp.x - pos.x, bp.z - pos.z) + Math.abs(bp.y + 1 - pos.y) * 0.5;
      if (d > 9) return;
      const dmg = 110 * (1 - d / 10);
      if (isPlayer) damagePlayer(dmg, pos, null);
      else bots.damage(bot, dmg, 'player');
    };
    if (S.player.alive) hurt(S.player.pos, true);
    for (const b of bots.bots) if (b.alive) hurt(b.pos, false, b);
  } else if (kind === 'flash') {
    audio.flash();
    const blind = (bp, isPlayer, bot) => {
      const d = Math.hypot(bp.x - pos.x, bp.z - pos.z);
      if (d > 22) return;
      // facing the flash?
      const dx = pos.x - bp.x, dz = pos.z - bp.z;
      const yaw = isPlayer ? S.player.yaw : bot.yaw;
      const facing = (-Math.sin(yaw) * dx + -Math.cos(yaw) * dz) / (d || 1);
      if (facing > -0.2) {
        const dur = Math.max(0.8, 3.5 * (1 - d / 24));
        if (isPlayer) S.player.flashBlind = dur; else bot.blindUntil = S.time + dur;
      }
    };
    if (S.player.alive) blind(S.player.pos, true);
    for (const b of bots.bots) if (b.alive) blind(b.pos, false, b);
  } else {
    audio.beep(2); // smoke pops
  }
}
function step(dt) {
  S.time += dt; S.tick++;
  rounds.step(dt);
  if (S.phase === 'freeze' && input.state.keys.has('KeyB')) hud.showBuy(true, S.money);
  // plant / defuse progress (hold E)
  const p = S.player;
  const nearSite = siteAt(p.pos.x, p.pos.z);
  const bombPos = S.bomb.state === 'planted' ? (S.bomb.site === 'A' ? SITES.A : SITES.B) : null;
  const nearBomb = bombPos && Math.hypot(bombPos.x - p.pos.x, bombPos.z - p.pos.z) < 3.5;
  const holdingE = input.state.keys.has('KeyE') && p.alive && !S.frozen && S.phase !== 'over';
  if (holdingE && S.phase === 'live' && nearSite && S.bomb.state === 'none') {
    p.plantProgress += dt / 3;
    hud.setProgress('PLANTING BOMB', p.plantProgress);
    if (Math.floor(p.plantProgress * 10) !== Math.floor((p.plantProgress - dt / 3) * 10)) audio.beep(1);
    if (p.plantProgress >= 1) {
      p.plantProgress = 0; hud.setProgress(null);
      rounds.plant(nearSite, 'player'); audio.plant();
      hud.banner(`BOMB PLANTED AT SITE ${nearSite} — 35s`, 3000);
      S.events.push({ x: p.pos.x, z: p.pos.z, r: 45, kind: 'boom', t: S.time });
    }
  } else if (holdingE && S.phase === 'planted' && nearBomb) {
    p.defuseProgress += dt / 5;
    hud.setProgress('DEFUSING', p.defuseProgress);
    if (p.defuseProgress >= 1) { p.defuseProgress = 0; hud.setProgress(null); rounds.defuse(); }
  } else {
    p.plantProgress = 0; p.defuseProgress = 0; hud.setProgress(null);
  }
  // hints
  hud.setHint(
    S.phase === 'freeze' ? 'BUY PHASE — press B for the buy menu' :
    S.phase === 'live' && nearSite && S.bomb.state === 'none' ? 'Hold E to plant the bomb' :
    S.phase === 'planted' && nearBomb ? 'Hold E to defuse (defenders only — you are attacking, hold the site!)' : '',
  );
  // input edges
  if (input.consume('KeyR')) { if (weapons.reload()) audio.reload(); }
  if (input.consume('Digit1')) weapons.switchTo('p2000');
  if (input.consume('Digit2')) weapons.switchTo('mp9');
  if (input.consume('Digit3')) weapons.switchTo('vk47');
  if (input.consume('Digit4')) { nadeSlot = 'he'; throwGrenade('he'); }
  if (input.consume('Digit5')) { nadeSlot = 'flash'; throwGrenade('flash'); }
  if (input.consume('Digit6')) { nadeSlot = 'smoke'; throwGrenade('smoke'); }
  if (input.consume('KeyG')) throwGrenade(nadeSlot);
  if (input.consume('KeyB') && S.phase === 'freeze') hud.showBuy(!hud.isBuyOpen(), S.money);
  if (input.consume('Escape') && hud.isBuyOpen()) hud.showBuy(false, S.money);
  // movement + shooting
  const stepSpeed = player.step(dt, input.state.keys, input.state.ads);
  if (stepSpeed > 0) audio.step();
  weapons.step(dt);
  if (input.state.firing && p.alive && !hud.isBuyOpen() && weapons.ready()) shoot();
  else if (input.state.firing && p.alive && weapons.mag() === 0 && weapons.ready()) { audio.dry(); weapons.reload(); }
  bots.step(dt);
  grenades.step(dt, detonate);
  effects.step(dt);
  // decay
  p.bloom = Math.max(0, p.bloom - dt * 1.4);
  p.flashBlind = Math.max(0, p.flashBlind - dt);
  p.damageFlash = Math.max(0, p.damageFlash - dt * 2);
  if (S.events.length > 40) S.events.splice(0, S.events.length - 40);
  // ADS zoom
  const targetFov = p.ads && S.player.weapon === 'longshot' ? 74 / 2.6 : p.ads ? 58 : 74;
  if (Math.abs(camera.fov - targetFov) > 0.1) { camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 14); camera.updateProjectionMatrix(); }
}
function syncCamera() {
  const p = S.player;
  camera.position.set(p.pos.x, p.pos.y + p.eye, p.pos.z);
  camera.rotation.set(p.pitch, p.yaw, 0, 'YXZ');
}
function syncHud() {
  const p = S.player, w = weapons.def();
  hud.setAmmo(weapons.mag(), weapons.reserve(), w.name);
  hud.setVitals(p.hp, p.armor, S.money, p.grenades);
  const t = S.phase === 'freeze' ? S.freezeTime : S.phase === 'planted' ? S.bombTime : S.roundTime;
  hud.setRound(S.scoreV, S.scoreS, S.round, t, S.phase);
  const spread = weapons.spread(player.groundSpeed(), !p.onGround);
  hud.setCrosshair(4 + spread * 260 + p.bloom * 14, p.ads);
  hud.setFlash(p.flashBlind > 0 ? Math.min(1, p.flashBlind) : p.damageFlash * 0.35);
  hud.setDamageDir(p.lastDamageDir, p.damageFlash * 0.9);
  if (S.bomb.state === 'planted') hud.setBomb(`BOMB PLANTED · SITE ${S.bomb.site} · ${Math.ceil(S.bombTime)}s — DEFEND IT`);
  else if (S.phase === 'live') hud.setBomb('');
  hud.minimap();
}
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - lastTime) / 1000, 0.1); lastTime = now;
  if (!frozen) {
    const look = input.takeLook();
    player.look(look.x, look.y);
    accumulator += dt;
    let steps = 0;
    while (accumulator >= FIXED_STEP && steps < 5) { step(FIXED_STEP); accumulator -= FIXED_STEP; steps++; }
    if (accumulator > FIXED_STEP * 5) accumulator = 0;
    syncCamera(); syncHud();
  }
  renderer.render(scene, camera);
}
function settle(n) { for (let i = 0; i < n; i++) step(FIXED_STEP); }
function aimAt(x, y, z) {
  const p = S.player;
  const dx = x - p.pos.x, dy = y - (p.pos.y + p.eye), dz = z - p.pos.z;
  const len = Math.hypot(dx, dy, dz) || 1;
  p.yaw = Math.atan2(-dx, -dz); p.pitch = Math.asin(Math.max(-1, Math.min(1, dy / len)));
  syncCamera();
}
function paintTwiceThenReady() {
  let painted = 0;
  function paint() {
    requestAnimationFrame(paint);
    syncCamera(); syncHud(); renderer.render(scene, camera);
    if (++painted === 2) { window.__shotReady = true; frozen = true; }
  }
  requestAnimationFrame(paint);
}
function runShot(name) {
  S.started = true; started = true;
  hud.hideOverlay();
  document.getElementById('banner').hidden = true; // staged shots: no transient banner
  if (name === 'start') {
    player.reset(0, 24); aimAt(0, 1.5, -10); settle(10);
    hud.showOverlay('start');
  } else if (name === 'buy') {
    player.reset(0, 24); aimAt(0, 1.5, -10); settle(10);
    S.money = 4700; hud.showBuy(true, S.money);
  } else if (name === 'combat') {
    rounds.beginLive(); S.phase = 'live'; S.frozen = false;
    player.reset(21, 12); aimAt(21, 1.2, 0); settle(6);
    // stage two defenders in the long east corridor, one hit already
    const d1 = bots.bots.find((b) => b.team === 'S');
    const d2 = bots.bots.filter((b) => b.team === 'S')[1];
    d1.pos.set(21, 0, 0); d1.yaw = Math.PI; d1.group.position.copy(d1.pos);
    d2.pos.set(25, 0, -3); d2.yaw = Math.PI * 0.8; d2.group.position.copy(d2.pos);
    d1.hp = 45; // visibly damaged
    const ally = bots.bots.find((b) => b.team === 'V');
    ally.pos.set(17, 0, 14); ally.group.position.copy(ally.pos);
    S.player.owned.vk47 = true; weapons.switchTo('vk47');
    aimAt(21, 1.2, 0);
    // fire one tracer shot at d1 for the muzzle/tracer visual
    settle(4); shoot(); settle(6);
    hud.addFeed('you ▸ Warden'); hud.hitMarker(false, 4000);
  } else if (name === 'plant') {
    rounds.beginLive(); S.phase = 'live'; S.frozen = false;
    player.reset(-18, -11); aimAt(-22, 1.2, -18); settle(6);
    S.player.plantProgress = 0.62; hud.setProgress('PLANTING BOMB', 0.62);
    const d1 = bots.bots.find((b) => b.team === 'S');
    d1.pos.set(-24, 0, -20); d1.yaw = Math.PI * 0.6; d1.group.position.copy(d1.pos);
    const ally = bots.bots.find((b) => b.team === 'V');
    ally.pos.set(-26, 0, -12); ally.group.position.copy(ally.pos);
    S.player.hp = 100; // staged defender may have landed shots during settle
    hud.setBomb('SITE A · FOUNDRY — hold E to plant');
  }
  syncCamera(); syncHud();
  paintTwiceThenReady();
}
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
rounds.startRound();
syncCamera(); syncHud();
if (shot) runShot(shot); else requestAnimationFrame(frame);
