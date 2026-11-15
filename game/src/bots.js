// Bots: 9 AI soldiers. Waypoint graph + BFS paths; states hold/patrol/push/engage/
// plant/defuse/retreat. Perception = FOV + LOS raycast + smoke + hearing (shots and
// explosions attract). Combat = burst fire, accuracy by range/skill/movement, strafing,
// cover at low HP. Attackers push a site and plant; defenders hold and rotate.
//
// Buy phase: every bot buys the VK-47 rifle + 50 kevlar at round start (see reset),
// so the squad fights fully geared instead of on a coin-flip loadout while the
// team's round money piles up unspent. The attack is coordinated: the whole V
// squad hits one site (S.attackSite), the carrier's job is to plant, and after a
// plant the attackers converge on the site and hold it for the detonation.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { moveCapsule, losBlocked } from './collision.js';
import { WAYPOINTS, SITES, SPAWNS, nearestNode, nearestNodeClear, findPath } from './map.js';
import { WEAPONS } from './weapons.js';

const NAMES_V = ['Rook', 'Iris', 'Dagger', 'Havoc'];
const NAMES_S = ['Warden', 'Onyx', 'Vex', 'Krait', 'Sable'];
const EYE = 1.55, FOV = 1.9, SEE_RANGE = 46;

export function createBots(S, scene, colliders, opts) {
  const bots = [];
  const mats = {
    V: new THREE.MeshStandardMaterial({ color: PALETTE.blue, roughness: 0.6 }),
    S: new THREE.MeshStandardMaterial({ color: PALETTE.red, roughness: 0.6 }),
    head: new THREE.MeshStandardMaterial({ color: 0xc9a37e, roughness: 0.7 }),
    helmet: new THREE.MeshStandardMaterial({ color: 0x2a2f36, roughness: 0.5, metalness: 0.4 }),
    gun: new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.5, metalness: 0.5 }),
  };
  const torsoGeo = new THREE.BoxGeometry(0.56, 0.82, 0.34);
  const headGeo = new THREE.SphereGeometry(0.16, 12, 10);
  const helmGeo = new THREE.SphereGeometry(0.185, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.55);
  const gunGeo = new THREE.BoxGeometry(0.07, 0.09, 0.55);
  const legGeo = new THREE.BoxGeometry(0.5, 0.7, 0.3);
  function makeBot(id, team, name) {
    const group = new THREE.Group();
    const torso = new THREE.Mesh(torsoGeo, mats[team]); torso.position.y = 1.02; torso.castShadow = true;
    const head = new THREE.Mesh(headGeo, mats.head); head.position.y = 1.58;
    const helm = new THREE.Mesh(helmGeo, mats.helmet); helm.position.y = 1.6;
    const legs = new THREE.Mesh(legGeo, mats.helmet); legs.position.y = 0.35;
    const gun = new THREE.Mesh(gunGeo, mats.gun); gun.position.set(0.2, 1.05, -0.3);
    group.add(torso, head, helm, legs, gun); scene.add(group);
    const bot = {
      id, team, name, group, torso, head, gun, hp: 100, armor: team === 'S' ? 25 : 0, alive: true,
      pos: new THREE.Vector3(), vel: new THREE.Vector3(), yaw: 0, state: 'hold', site: null,
      node: 0, path: [], pathIdx: 0, target: null, lastSeen: null, blindUntil: 0,
      burstLeft: 0, nextShot: 0, pauseUntil: 0, strafeDir: 1, strafeUntil: 0,
      // Attackers shoot a touch sharper and press harder between bursts: they
      // must break defenders who hold angles on the site.
      skill: (team === 'V' ? 0.62 : 0.55) + Math.random() * 0.3, weapon: 'vk47', progress: 0, thinkAt: Math.random() * 0.15,
      carrier: false, holdUntil: 0, home: new THREE.Vector3(),
      // stuck recovery: last position where the bot was seen making progress
      stuckX: 0, stuckZ: 0, stuckT: 0,
    };
    torso.userData.bot = bot; head.userData.bot = bot; head.userData.part = 'head'; torso.userData.part = 'body';
    bots.push(bot); return bot;
  }
  for (let i = 0; i < 4; i++) makeBot(i, 'V', NAMES_V[i]);
  for (let i = 0; i < 5; i++) makeBot(4 + i, 'S', NAMES_S[i]);

  function setPath(bot, nodeId) {
    // Start from the nearest node reachable in a straight line, not the nearest
    // as the crow flies: the latter can sit across a wall and trap the bot.
    bot.path = findPath(nearestNodeClear(bot.pos.x, bot.pos.z), nodeId);
    bot.pathIdx = 0;
  }
  function goTo(bot, x, z) { setPath(bot, nearestNode(x, z)); }
  function eyePos(b, out) { out.set(b.pos.x, b.pos.y + EYE, b.pos.z); return out; }
  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3();

  function canSee(bot, tx, ty, tz) {
    eyePos(bot, _a); _b.set(tx, ty, tz);
    _d.subVectors(_b, _a); const dist = _d.length();
    if (dist > SEE_RANGE) return false;
    if (dist > 6) {
      const fwd = new THREE.Vector3(-Math.sin(bot.yaw), 0, -Math.cos(bot.yaw));
      if (_d.clone().normalize().dot(fwd) < Math.cos(FOV / 2)) return false;
    }
    if (losBlocked(colliders, _a, _b)) return false;
    if (opts.smokeBlocks(_a, _b)) return false;
    return true;
  }
  function nearestEnemy(bot) {
    let best = null, bd = 1e9;
    const p = S.player;
    if (bot.team === 'S' && p.alive) { const d = bot.pos.distanceToSquared(p.pos); if (d < bd) { bd = d; best = 'player'; } }
    for (const o of bots) {
      if (!o.alive || o.team === bot.team) continue;
      const d = bot.pos.distanceToSquared(o.pos);
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }
  function perceive(bot) {
    if (S.time < bot.blindUntil) { bot.target = null; return; }
    // A dead target is not a target: without this, a bot keeps "engaging" a
    // corpse (strafing and firing tracers at it) and never falls through to
    // its other jobs — observed: during a planted round the last living
    // defender kept shooting a dead planter at site A instead of rotating to
    // the planted bomb at site B to defuse it.
    if (bot.target) {
      const targetAlive = bot.target === 'player' ? S.player.alive : bot.target.alive;
      if (!targetAlive) bot.target = null;
    }
    const e = nearestEnemy(bot);
    if (!e) { bot.target = null; return; }
    // The bomb carrier's job is to plant, not to duel: ignore enemies beyond
    // self-defence range so the carrier keeps pushing to the site instead of
    // standing mid-map trading shots until the round ends.
    if (bot.carrier) {
      const ep = e === 'player' ? S.player.pos : e.pos;
      if (bot.pos.distanceTo(ep) > 14) { bot.target = null; return; }
    }
    const ep = e === 'player' ? S.player.pos : e.pos;
    const ey = e === 'player' ? (S.player.crouching ? 1.0 : 1.55) : EYE;
    if (canSee(bot, ep.x, ep.y + ey, ep.z)) {
      bot.target = e; bot.lastSeen = { x: ep.x, z: ep.z, t: S.time };
    } else if (bot.target === e) bot.target = null;
    // hearing: recent loud events pull idle bots (never the carrier off its route)
    if (!bot.target && !bot.carrier && (bot.state === 'hold' || bot.state === 'patrol')) {
      for (const ev of S.events) {
        if (S.time - ev.t > 1.2) continue;
        const d = Math.hypot(ev.x - bot.pos.x, ev.z - bot.pos.z);
        if (d < ev.r) { goTo(bot, ev.x, ev.z); bot.state = 'patrol'; bot.holdUntil = S.time + 4; break; }
      }
    }
  }
  function fireAt(bot, target, dt) {
    if (S.time < bot.pauseUntil) return;
    const w = WEAPONS[bot.weapon] || WEAPONS.vk47;
    if (bot.burstLeft <= 0) {
      bot.burstLeft = 3 + Math.floor(Math.random() * 3);
      // Attackers press harder between bursts than defenders holding an angle.
      bot.pauseUntil = S.time + (bot.team === 'V' ? 0.5 + Math.random() * 0.6 : 0.7 + Math.random() * 0.7);
    }
    if (S.time < bot.nextShot) return;
    bot.nextShot = S.time + 0.11;
    bot.burstLeft--;
    const tp = target === 'player' ? S.player.pos : target.pos;
    const dist = bot.pos.distanceTo(tp);
    const moving = target === 'player' ? Math.hypot(S.player.vel.x, S.player.vel.z) : Math.hypot(target.vel.x, target.vel.z);
    let pHit = bot.skill * (1 - dist / 90) * (moving > 3 ? 0.55 : 1) * (S.player.crouching && target === 'player' ? 0.8 : 1);
    pHit = Math.max(0.08, Math.min(0.75, pHit));
    const head = Math.random() < 0.14;
    eyePos(bot, _a);
    const muzzle = _a.clone(); muzzle.y -= 0.15;
    _b.set(tp.x, tp.y + (head ? 1.58 : 1.0), tp.z);
    opts.tracer(muzzle, _b);
    opts.shotSound(w.sound, dist);
    S.events.push({ x: bot.pos.x, z: bot.pos.z, r: 28, kind: 'shot', t: S.time });
    if (Math.random() < pHit) {
      const dmg = w.dmg * (head ? 4 : 1) * (head && target !== 'player' ? 0.5 : 1) * (0.85 + Math.random() * 0.3);
      if (target === 'player') opts.damagePlayer(dmg, bot.pos, bot);
      else damage(target, dmg, bot);
    }
  }
  function damage(bot, amount, attacker) {
    if (!bot.alive) return false;
    let rem = amount;
    if (bot.armor > 0) { const ab = Math.min(bot.armor, rem * 0.5); bot.armor -= ab; rem -= ab; }
    bot.hp -= rem;
    if (bot.hp <= 0) { bot.alive = false; bot.hp = 0; bot.group.visible = false; opts.onBotDeath(bot, attacker); return true; }
    // hit reaction: face attacker, take cover at low HP
    if (attacker) { const ap = attacker === 'player' ? S.player.pos : attacker.pos; bot.yaw = Math.atan2(-(ap.x - bot.pos.x), -(ap.z - bot.pos.z)); }
    if (bot.hp < 30 && bot.state !== 'engage') { bot.state = 'retreat'; bot.holdUntil = S.time + 3; }
    return false;
  }
  function moveAlongPath(bot, dt, speed) {
    if (bot.pathIdx >= bot.path.length) return true;
    const n = WAYPOINTS[bot.path[bot.pathIdx]];
    const dx = n[0] - bot.pos.x, dz = n[1] - bot.pos.z, d = Math.hypot(dx, dz);
    if (d < 0.7) { bot.pathIdx++; return bot.pathIdx >= bot.path.length; }
    const vx = dx / d * speed, vz = dz / d * speed;
    bot.vel.set(vx, 0, vz);
    bot.yaw = Math.atan2(-vx, -vz);
    bot.vel.y -= 20 * dt;
    bot.onGround = moveCapsule(colliders, bot.pos, bot.vel, dt, 0.34, 1.72);
    if (bot.pos.y < 0) bot.pos.y = 0;
    return false;
  }
  function stepBot(bot, dt) {
    if (!bot.alive) return;
    // Freeze time is a buy phase: nobody moves, sees or shoots. Without this,
    // bots traded potshots across the map before the round started.
    if (S.phase === 'freeze') { bot.group.position.copy(bot.pos); bot.group.rotation.y = bot.yaw; return; }
    bot.thinkAt -= dt;
    if (bot.thinkAt <= 0) { bot.thinkAt = 0.15; perceive(bot); }
    const blind = S.time < bot.blindUntil;
    // Stuck recovery: a bot following a path that makes no progress (e.g. pressed
    // against a wall) abandons that route for a fresh one instead of pushing
    // forever. Only path-following states count; engaging/holding/planting bots
    // are not "stuck" for standing still.
    const followingPath = bot.pathIdx < bot.path.length && bot.state !== 'engage'
      && bot.state !== 'plant' && bot.state !== 'defuse' && bot.state !== 'hold';
    if (followingPath) {
      const moved = Math.hypot(bot.pos.x - bot.stuckX, bot.pos.z - bot.stuckZ);
      if (moved > 0.4) { bot.stuckX = bot.pos.x; bot.stuckZ = bot.pos.z; bot.stuckT = S.time; }
      else if (S.time - bot.stuckT > 1.5) {
        bot.stuckX = bot.pos.x; bot.stuckZ = bot.pos.z; bot.stuckT = S.time;
        setPath(bot, Math.floor(Math.random() * WAYPOINTS.length));
        bot.state = 'patrol'; bot.holdUntil = S.time + 2;
      }
    } else { bot.stuckX = bot.pos.x; bot.stuckZ = bot.pos.z; bot.stuckT = S.time; }
    // face target
    if (bot.target && !blind) {
      const tp = bot.target === 'player' ? S.player.pos : bot.target.pos;
      bot.yaw = Math.atan2(-(tp.x - bot.pos.x), -(tp.z - bot.pos.z));
    }
    if (bot.state === 'plant') {
      // Planting is a commitment: once the carrier is on the site it finishes
      // the plant instead of abandoning it to duel the first defender it sees
      // (the old order ran engage first, so a plant stalled whenever an enemy
      // peeked — the carrier died mid-map with the plant unstarted).
      bot.progress += dt;
      if (bot.progress >= 3) { bot.state = 'hold'; bot.progress = 0; opts.onPlanted(bot); }
    } else if (bot.target && !blind) {
      bot.state = 'engage';
      const tp = bot.target === 'player' ? S.player.pos : bot.target.pos;
      const dist = bot.pos.distanceTo(tp);
      // strafe sideways while engaging
      if (S.time > bot.strafeUntil) { bot.strafeDir *= -1; bot.strafeUntil = S.time + 0.8 + Math.random() * 0.8; }
      if (dist > 14) { // close distance
        bot.vel.set(-Math.sin(bot.yaw) * 3, 0, -Math.cos(bot.yaw) * 3);
      } else {
        const sx = Math.cos(bot.yaw) * bot.strafeDir * 2.2, sz = -Math.sin(bot.yaw) * bot.strafeDir * 2.2;
        bot.vel.set(sx, 0, sz);
      }
      bot.vel.y -= 20 * dt;
      moveCapsule(colliders, bot.pos, bot.vel, dt, 0.34, 1.72);
      fireAt(bot, bot.target, dt);
    } else if (bot.state === 'defuse') {
      bot.progress += dt;
      if (bot.progress >= 5) { bot.state = 'hold'; bot.progress = 0; opts.onDefused(bot); }
    } else if (S.bomb.state === 'planted' && bot.team === 'S') {
      // rotate to planted site
      const site = SITES[S.bomb.site];
      const d = Math.hypot(site.x - bot.pos.x, site.z - bot.pos.z);
      if (d < 3.5) { bot.state = 'defuse'; bot.progress = 0; }
      else if (bot.pathIdx >= bot.path.length) goTo(bot, site.x, site.z);
      else moveAlongPath(bot, dt, 4.2);
    } else if (S.bomb.state === 'planted' && bot.team === 'V') {
      // Bomb planted: attackers converge on the site and hold it for the
      // detonation instead of patrolling random nodes and letting defenders
      // walk back in unopposed.
      const site = SITES[S.bomb.site];
      const d = Math.hypot(site.x - bot.pos.x, site.z - bot.pos.z);
      if (d > 8) {
        const dest = bot.path.length ? WAYPOINTS[bot.path[bot.path.length - 1]] : null;
        if (!dest || Math.hypot(dest[0] - site.x, dest[1] - site.z) > 4) goTo(bot, site.x, site.z);
        else moveAlongPath(bot, dt, 4.2);
      } else { bot.state = 'hold'; bot.holdUntil = S.time + 2; }
    } else if (bot.carrier && S.bomb.state === 'none' && bot.team === 'V' && S.phase === 'live') {
      const site = SITES[bot.site || 'A'];
      const d = Math.hypot(site.x - bot.pos.x, site.z - bot.pos.z);
      if (d < 3) { bot.state = 'plant'; bot.progress = 0; }
      else {
        // Re-route when the current path ends elsewhere (e.g. a stale patrol
        // route from before the carrier was appointed); otherwise the carrier
        // walks its old route out before ever heading to the site.
        const dest = bot.path.length ? WAYPOINTS[bot.path[bot.path.length - 1]] : null;
        if (!dest || Math.hypot(dest[0] - site.x, dest[1] - site.z) > 4) goTo(bot, site.x, site.z);
        else moveAlongPath(bot, dt, 4.0);
      }
    } else if (bot.state === 'push' || bot.state === 'patrol' || bot.state === 'rotate') {
      if (moveAlongPath(bot, dt, 3.4)) {
        if (bot.state === 'push') { bot.state = 'hold'; bot.holdUntil = S.time + 2 + Math.random() * 3; }
        else { bot.state = 'hold'; bot.holdUntil = S.time + 3 + Math.random() * 4; }
      }
    } else if (bot.state === 'retreat') {
      // back toward own spawn / cover
      const home = bot.team === 'V' ? SPAWNS.V[0] : SPAWNS.S[4];
      if (bot.pathIdx >= bot.path.length) goTo(bot, home[0], home[1]);
      if (moveAlongPath(bot, dt, 4.5) || S.time > bot.holdUntil) bot.state = 'hold';
    } else { // hold
      bot.vel.set(0, 0, 0);
      if (S.time > bot.holdUntil) {
        // Attackers who reached their site hold it: patrolling away leaves
        // the carrier (or the plant) undefended while defenders rotate in.
        let stay = false;
        if (bot.team === 'V' && S.bomb.state === 'none' && bot.site) {
          const s = SITES[bot.site];
          if (Math.hypot(s.x - bot.pos.x, s.z - bot.pos.z) < 10) { bot.holdUntil = S.time + 3; stay = true; }
        }
        if (!stay) {
          bot.state = 'patrol';
          const n = Math.floor(Math.random() * WAYPOINTS.length);
          setPath(bot, n);
        }
      }
    }
    bot.group.position.copy(bot.pos);
    bot.group.rotation.y = bot.yaw;
    // crouch visual when holding low HP
    bot.group.scale.y = bot.hp < 30 ? 0.92 : 1;
  }
  function reset(round) {
    const sitePick = Math.random() < 0.5 ? 'A' : 'B';
    S.attackSite = sitePick; // the site the whole V squad hits this round
    bots.forEach((bot, i) => {
      const ti = bot.team === 'V' ? i : i - 4;
      const sp = bot.team === 'V' ? SPAWNS.V[ti] : SPAWNS.S[ti];
      bot.pos.set(sp[0], 0, sp[1]); bot.vel.set(0, 0, 0);
      bot.hp = 100; bot.alive = true;
      // Buy phase: every bot spends its round money on the VK-47 rifle and
      // 50 kevlar. Before this, bots fought on a coin-flip loadout (half of
      // them on the 19-damage MP9, V with no armor at all while S spawned
      // with 25) while the team's money piled up past $12,000 unspent.
      bot.armor = 50; bot.weapon = 'vk47';
      bot.group.visible = true; bot.group.position.copy(bot.pos);
      bot.yaw = bot.team === 'V' ? 0 : Math.PI; bot.target = null; bot.lastSeen = null;
      bot.state = 'hold'; bot.progress = 0; bot.blindUntil = 0; bot.burstLeft = 0;
      bot.stuckX = bot.pos.x; bot.stuckZ = bot.pos.z; bot.stuckT = S.time;
      bot.carrier = false; bot.site = null; bot.holdUntil = S.time + 1 + Math.random() * 2;
      bot.home.copy(bot.pos);
      if (bot.team === 'V') {
        // Coordinated push: the whole squad hits the one picked site instead
        // of splitting 2-and-2 into two separate 2v2s against entrenched
        // defenders (plus their mid rotator).
        bot.site = sitePick;
        bot.state = 'push';
        const s = SITES[bot.site]; goTo(bot, s.x, s.z);
      } else {
        bot.site = ti < 2 ? 'A' : ti < 4 ? 'B' : null;
        if (bot.site) { const s = SITES[bot.site]; goTo(bot, s.x + (Math.random() * 4 - 2), s.z + (Math.random() * 4 - 2)); bot.state = 'hold'; }
        else { bot.state = 'patrol'; setPath(bot, 23); } // node 23 (0,-8): mid-north patrol
      }
    });
    // one V bot is the carrier if the player is not carrying (player always carries at round start)
    bots[0].carrier = false;
  }
  return {
    bots, damage, reset,
    step(dt) { for (const b of bots) stepBot(b, dt); },
    aliveCount(team) { return bots.filter((b) => b.alive && b.team === team).length; },
    hitMeshes() { const m = []; for (const b of bots) if (b.alive) { m.push(b.torso, b.head); } return m; },
    setCarrier(bot) { for (const b of bots) b.carrier = false; if (bot) bot.carrier = true; },
    // Best carrier: the living V bot closest to the attack site, healthier
    // bots preferred — not just the first one in the list, who may be across
    // the map at low HP when the player (or the old carrier) goes down.
    nearestCarrier() {
      const site = SITES[S.attackSite || 'A'];
      let best = null, bd = 1e9;
      for (const b of bots) {
        if (!b.alive || b.team !== 'V') continue;
        const d = Math.hypot(site.x - b.pos.x, site.z - b.pos.z) - b.hp / 25;
        if (d < bd) { bd = d; best = b; }
      }
      return best || bots.find((b) => b.alive && b.team === 'V');
    },
  };
}
