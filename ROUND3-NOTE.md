# STRIKEPOINT — round 3 note (bot buying + carrier/aim balance)

Date: 2026-11-15 (UTC). Old submission: 01a1deb0, commit 212cbea (round 2,
Development 75.5467% Provisional, 5W/7L, valid 1, rank #1853/3401).
New commit: (see git log — "Round 3: bot buying + carrier/aim balance").

## What the server score actually is (correction to the round-2 framing)

The "Matches 5W/7L" on the entry page are NOT in-game bot matches. Per
competition.yaml, the score is a Bradley–Terry win rate over JUDGE pairwise
games: an AI judge reads two dossiers at a time (screenshots + source text,
capped at 163,840 bytes) and picks the better game. The 12 provisional games
are vs the four house anchor dossiers + three ladder rungs. So no local sim
can reproduce the server number; the local sims below are a proxy for game
quality — and the judge's criterion 3 (Tactics) is exactly what this round
improves: bots that buy, follow routes, hold positions, push an objective,
plant/defuse, and react to sight and sound. The finalist review (top 5) also
plays the game live in desktop Chrome, so real gameplay quality matters there
too. Source grew ~5.5 KB (dossier 288,263 B, still < 1.5 MiB, text well under
the 160 KiB cap), so the judge still reads all of it.

## Diagnosis (all verified live or by code read before changing)

Baseline local matches, seed 11, 4x speed, Chromium headless (file://):
- AFK player: SPECTRE wins 8–0. 4 rounds lost on timeout ("no plant"),
  4 on elimination. 0 plants. Deaths V 24 vs S 26 (V bots kill nearly as
  many — they lose rounds, not duels). Money $800 → $12,700, unspent.
- Bot-player proxy (test-only autopilot: buys vk47+armor, follows waypoint
  path to the site, stands and fires at the nearest visible defender, holds
  E to plant): VANGUARD wins 8–0, 27 player kills / 1 death, 6 plants
  (all by the player), 1 detonation. The game is extremely player-skill
  sensitive; the bots decide the AFK result.

Root causes found in the code:
1. ASYMMETRY. S bots spawn with 25 armor, V bots with 0 (effective HP 125
   vs 100). S bots with even global index get a guaranteed VK-47 (3 of 5
   rifles); V bots are a 50/50 coin flip (MP9 does 19 dmg vs VK-47's 33).
2. NO BOT BUYING. Bots never spend; reset() re-rolled a random weapon each
   round while the team's money piled past $12,000.
3. SPLIT PUSH. V bots went 2 to the picked site, 2 to the other — two
   separate 2v2s against entrenched defenders plus their mid rotator.
4. CARRIER. Appointed only when the player dies; damagePlayer() forced the
   new carrier to site 'A' even when the squad pushed B; nearestCarrier()
   returned the first living V bot, who could be across the map at low HP.
5. PLANT NOT STICKY. The engage branch ran before the plant branch, so a
   planting bot that spotted an enemy abandoned the plant to duel.
6. POST-PLANT WANDER. After planting, V bots with no target held, then
   patrolled RANDOM nodes — wandering off the planted site while defenders
   rotated in to defuse.
7. STUCK MID PATROLLER (new find). Sable (S) spawns at (0,-16) and patrols
   to node 23 (0,-8) straight through the connector wall at z=-10; it sat
   at (0,-11) the whole match in every baseline run. nearestNode() snaps to
   the closest node as the crow flies, across the wall, and stuck-recovery
   re-pathed from the same snapped node, so it never escaped. S effectively
   played 4v5 too — and still won 8–0.
8. ELIMINATION RULE — already bomb-friendly (checkEliminations does NOT end
   a planted round when V is wiped; the bomb ticks and S must defuse). Left
   as-is. Freeze phase is clean. S defender behavior left as-is.

## Changes (all hand-written in this session)

- `game/src/bots.js` — buy phase: every bot buys VK-47 + 50 kevlar at round
  start (both teams; removes the S gear edge, V gains most: 0 armor + 50%
  MP9 → rifle + armor). V skill 0.62–0.92 vs S 0.55–0.85, V burst pause
  0.5+rand*0.6 vs S 0.7+rand*0.7 (attackers press harder to break holders).
- `game/src/bots.js` — coordinated push: all V bots hit S.attackSite (one
  site), escorts that reach it hold there instead of patrolling away.
- `game/src/bots.js` — carrier: nearestCarrier() picks the living V bot
  nearest the attack site (health tie-break); carrier hustles at 4.0 and
  re-routes when its current path ends elsewhere (stale patrol route);
  plant is sticky (plant branch before engage); after a plant, V bots
  converge on the planted site and hold it for the detonation.
- `game/src/bots.js` + `game/src/map.js` — setPath() starts from
  nearestNodeClear(), the nearest waypoint reachable in a straight line
  without crossing a solid box (new helper in map.js; falls back to
  nearestNode when no node has a clear segment). Fixes the stuck patroller.
- `game/src/main.js` + `game/src/state.js` — carrier handoff keeps pushing
  S.attackSite (stored on S at reset) instead of hardcoded 'A'.
- Deliberately NOT changed: vendor/makefun-threejs.ts, .makefun/owner.json,
  main.ts, round/economy rules, the elimination rule, defuse (left
  non-sticky: it helps S), S defender behavior, screenshots, freeze.

## Verification (all on the new code)

- Local gate replication (`/tmp/gate-check.mjs`, kit library): ALL 5 deciding
  rows PASS; dossier 288,263 B; two main.ts builds byte-identical
  (`diff -r` clean). All 16 shipped .js files pass `node --check`.
- Nav-graph check: 32 nodes, 46 edges, 32/32 reachable, 0 blocked.
- Full headless matches, Chromium (CDP, file://, SwiftShader, 320x200,
  speed 4x), 0 console errors/warnings in every run, 0 stuck events in
  every after-run:
  - AFK seed 11: **V wins 8–0** (was 0–8). All 8 rounds by elimination;
    timeouts 4 → 0; deaths V 14 vs S 40 (was 24 vs 26); player survived
    all 8 rounds; 0 plants (V wiped S before a plant was needed).
  - AFK seed 7 (robustness): **V wins 8–5** in 13 rounds — competitive,
    S still wins rounds; 1 plant (Dagger, round 4, defused by S); deaths
    V 30 vs S 55; 0 stuck.
  - Bot-player proxy seed 11: **V wins 8–1** (was 8–0). Player 18 kills /
    3 deaths; plants 2 (Dagger bot carrier round 2 site B; player round 8
    site B); S won round 2 by defuse — defenders still functional.
- Plant / detonation / defuse, dedicated plant run (test-only: player killed
  per round, carrier teleported to its site, first plant's V bots wiped to
  force a defuse): **plants 6** (Dagger/Havoc/Rook), **detonation 1**
  (round 4, V won by bomb detonation), **defuses 5** (S defused rounds 1,
  2, 3, 7, 9; defuse state seen 44 times). All three branches observed
  live on the new code. (The run's 1–8 match score is the test's own
  harshness — dead player + carriers teleported into 2 defenders — not a
  balance reading.)
- Test harness note: the local Chrome refused http://127.0.0.1 (Chrome 157
  Local Network Access check, ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS);
  matches ran over file:// with --allow-file-access-from-files plus the
  Hatch WebGL policy file (`hatch-webgl-all-origins-v1`). The shipped game
  is unaffected. The bot-player autopilot is test-copy-only code
  (/tmp/mksim.mjs injects it); shipped code was never modified for testing.

## Still not verified (honest gaps)

- The server score is judge verdicts, not sims — no local run can confirm
  the new grade; it comes from the next resubmission's grade watch.
- No Node 22 binary on this VM (only Node 24.22.1); main.ts + the .ts
  vendor import were not executed under the server's Node 22.23.4
  (same mitigation as round 2: the starter uses the identical mechanism).
- Resubmission itself is NOT done by this round (separate finisher step).
