# STRIKEPOINT — fix note (post grade-0 diagnosis)

Date: 2026-11-15. Old submission: 01a1dd0c, commit 46e4135 (grade 0, "Fails the hidden
tests", no judge rate). New commit: d6abd48db15a96bf65ebbf2b7025b709169867c2.

## Root cause 1 (GATE — the grade-0 cause): `references` row failed on the favicon link

`game/index.html` held `<link rel="icon" href="data:,">`. The gate's rule
(competition.yaml, "The gate"): every `<link href>` in index.html must be relative
or mapped and resolve to a regular file inside game/. `data:,` has a URI scheme, so
the kit's own `isRelativeRef()` (vendor/makefun-threejs.ts) returns false for it and
it resolves to no file. The starter — the known-valid house game — has no `<link>`
at all. Local gate replication (kit library + spec) before the fix:

- game_files PASS, three_js PASS (both 0.187.0 shas match), screenshots PASS
  (4× 1280x800 JPEG ≤ 256 KiB), dossier_matches PASS (byte-identical rebuild),
  js_parses PASS (all 16 .js parse as ES modules)
- references FAIL — exactly one item: `link[rel=icon] href: not relative/mapped: "data:,"`
- main.ts run twice → byte-identical outputs (determinism OK)

Fix: removed the `data:,` link; added a real `game/favicon.svg` (amber/teal target
glyph in the game's palette) and `<link rel="icon" href="./favicon.svg"
type="image/svg+xml">`, which resolves inside game/. After the fix the local gate
replication passes all 5 deciding rows, and two main.ts runs are still byte-identical.

## Root cause 2 (GAMEPLAY — found by the headless full-match test): bots never fought

Two pre-fix headless runs (seeds 7 and 11, bot-vs-bot with an idle player) both played
round 1 to a 0-kill timeout (SPECTRE won on "Time expired — no plant"). A debug probe
showed why:

- (a) 25 of 38 waypoint edges crossed solid walls/crates (verified mechanically:
  segment-vs-AABB over the map's boxes). Bots followed BFS paths straight into
  walls; `moveCapsule` blocked them and there was no stuck detection, so they
  pushed into the same wall forever (observed: Rook/Iris frozen at (-15,12),
  Dagger/Havoc at (15,12) for 20+ sim-seconds, states stuck on 'patrol'/'push').
- (b) The two site pads were 0.6-high solid colliders covering the whole bot
  plant disc (d < 3 from the site centre is inside the 6x6 pad), so no bot could
  ever reach plant range — bot plants were geometrically impossible. (The player
  plants at d < 5.5, which is reachable from outside the pad, so only bots broke.)
- (c) Bots fought during freeze time: at t=3.4s of round 1 (still buy phase) a V bot
  was already engaging and an S bot was at 81 HP. The player could also shoot
  during freeze. Buy phase should be combat-free.

Fixes (all in the game, all hand-written in this session):

- `game/src/map.js` — rebuilt WAYPOINTS (24 -> 32 nodes) and EDGES (38 -> 46) so
  every edge is verified walkable (0 blocked with a 0.5-unit inflation, bot radius
  0.34; all 32 nodes reachable from spawn). Lanes run at x=-18/+18; the x=-16/+16
  walls are crossed only in the z=-4..8 gap; the (0,6) mid wall and (0,-10)
  connector wall are crossed only around their ends. Site nodes (-21,-18) /
  (21,-18) sit within plant (< 3) and defuse (< 3.5) range.
- `game/src/map.js` — site pads are now flat visual slabs (0.12 high) and are
  excluded from `colliders` (still bullet stoppers via `shootables`), so bots and
  the player walk over them and bots can reach the plant point.
- `game/src/bots.js` — stuck recovery: a bot following a path that makes < 0.4
  units of progress in 1.5 s abandons that route for a fresh random node
  (carrier bots re-route to their site via the existing carrier branch). Safety
  net in case any edge still proves bad in play.
- `game/src/bots.js` — freeze guard: during `freeze` bots hold position and do
  not perceive, move or fire.
- `game/src/bots.js` — S-bot patrol node updated 19 -> 23 (node 23 is (0,-8),
  the new mid-north patrol point).
- `game/src/main.js` — `shoot()` and `throwGrenade()` return early during
  `freeze`, matching the bot freeze guard (shot presets set phase `live` before
  shooting, so they are unaffected).
- `game/src/bots.js` — the bomb carrier pushes to the site instead of duelling:
  `perceive()` ignores enemies beyond 14 units for a carrier bot (close threats
  still trigger self-defence), and hearing events no longer pull the carrier off
  its route. Observed in run 2 (round 5): after the player died, Iris became
  carrier (`car:1`) but spent the rest of the round duelling mid-map and died
  before planting; the plant loop itself was reachable, the carrier just never
  got there. With the fix the carrier only fights close threats on the way in.
- `game/src/bots.js` — stale-target clearing in `perceive()` (root cause 3,
  found during the plant verification below): a bot whose target died kept the
  dead bot as its target — `nearestEnemy()` skips dead bots, but nothing
  cleared `bot.target`, so the bot stayed in 'engage' and fired tracers at a
  corpse instead of falling through to its other jobs. Observed live: during
  a planted round the last living defender (Warden, 100 HP, at site A) spent
  the whole bomb countdown shooting the dead planter's corpse instead of
  rotating to the planted bomb at site B to defuse. The fix clears the target
  when it is dead (player or bot) at the top of `perceive()`; the next
  `perceive()` tick then re-targets a living enemy or falls through to
  rotate/plant/defuse.

What was deliberately NOT changed: `vendor/makefun-threejs.ts` (byte-identical to
the kit, sha f9622210...), `.makefun/owner.json`, `main.ts`, the round/economy
rules, bot combat numbers, and the V-bot carrier design (the player is the
carrier by design; a bot takes over only if the player dies).

## Verification (evidence, not claims)

- Local gate replication (`/tmp/gate-check.mjs`, kit library): all 5 deciding
  rows PASS post-fix; `js_parses` all 16 files parse; two `main.ts` runs
  byte-identical (`diff -r` clean). Dossier 282,614 B (< 1.5 MiB). Re-run
  after every fix round, including after the stale-target fix.
- Nav-graph check (`/tmp/navcheck-repo.mjs`, parses the shipped map.js):
  32 nodes, 46 edges, 0 blocked, 32/32 reachable; site nodes within plant and
  defuse range at both sites.
- Headless Chrome full-match tests (CDP driver `/tmp/cdp-test.mjs`, SwiftShader,
  320x200): pre-fix, round 1 ended 0-1 on timeout with 0 kills in two seeds.
  Post-fix, same seeds: first blood at t=19.5 s (Krait killed by V bots); at
  t=99.8 s of round 1, 4 bots dead (Dagger, Havoc, Vex, Krait), Iris at 30 HP,
  live firefights mid-map; no freeze-phase damage (all HP 100 at t=14.3 s).
  Run 2 (fast copy, seed 11) reached round 6, score 0-5: round 1 timeout 0-1,
  round 2 elimination 0-2 (whole V team incl. the player wiped), rounds 3-5
  lost 0-3/0-4/0-5; carrier handoff verified in round 5 (Iris `car:1` after
  the player died). The player is AFK in these tests, so V losing is expected.
- Full match, run 3 (fast copy, seed 11, 2026-11-15 09:39-09:50 UTC):
  **MATCH OVER — SPECTRE wins 8-0.** All 8 rounds seen, `ended=true`,
  elapsed 643 s, zero console errors/warnings. Round outcomes: R1 timeout
  0-1 ("Time expired — no plant"), R2 elimination 0-2, R3 elimination 0-3,
  R4 elimination 0-4, R5 elimination 0-5, R6 elimination 0-6, R7 elimination
  0-7, R8 timeout 0-8. The match-end overlay rendered ("MATCH OVER /
  SPECTRE wins 8–0. PLAY AGAIN"). Money accumulated $800 → $12,700 via loss
  bonuses. Full HUD log: see VERIFY-2026-11-15.md.
- Plant / detonation / defuse, dedicated plant runs (carrier teleported to its
  site by a test watcher once per round; player killed early by a teleported
  S bot so a bot carrier is appointed — test-only interventions, shipped code
  untouched):
  - Plant #1 (round 1, site B): Rook (carrier, site A) was teleported to A,
    started planting, and was killed mid-plant by Warden; the carrier passed
    to Iris (site B), who pushed to B on her own — no teleport — and planted
    (bomb `planted`, bombT 35 → ticking). Round ended by elimination
    (aliveS 0) at bombT 1.1, score 1-0.
  - Plant #2 (round 5, site A): Rook teleported to A, planted; bomb ticked
    35 → 0 and the round ended **score 2-3 — V won by bomb detonation**
    ("Bomb detonated" branch in rounds.js fired).
  - Plant #3 (round 2, site A, after the stale-target fix): Rook teleported
    to A, planted (bombT 34.1). The last V bot died mid-countdown; the three
    living S bots rotated to A and **Vex (24 HP) and Krait (84 HP) both
    entered state `defuse` at the planted site** (target null — the fix
    working). The round ended on V elimination at bombT 17.4 before their
    5-second defuse hold completed, so the defuse-completion branch
    (`onDefused` → `rounds.defuse()` → `endRound('S', 'Bomb defused')`) is
    verified by code read only, not live — it is the same 3-line shape as the
    plant completion that was observed live twice.
- Screenshots unchanged (the fix touches no rendered pixels except the favicon,
  which is not visible in-game); dossier rebuilt from the fixed files.

## Observations not fixed (minor, out of scope)

- After the player dies, the start overlay ("YOU ARE DOWN — Your team fights
  on") stays up when the next round starts until the player clicks PLAY again
  (pointer lock is only re-requested on click). The sim keeps running behind
  it. Cosmetic; a human just clicks once per respawn.
- The AFK-player match is one-sided (SPECTRE won rounds 1-5 in run 2): the
  player never shoots, buys or plants, so V plays 4v5. That is the test's
  artifact, not a balance verdict.
- Elimination ends a round even with a planted bomb: if the planting team is
  wiped while the bomb is ticking, `checkEliminations` ends the round at once
  instead of letting the bomb detonate. Real tactical FPS lets the bomb play
  out, but this is the game's own round rule (it always ends with a winner
  and the next round starts cleanly), so it was left as-is — a design choice,
  not a deadlock.
- The defuse-completion branch (`Bomb defused` win) was not observed live:
  in the plant test after the stale-target fix, two S bots entered the
  `defuse` state at the planted site, but the round ended on V elimination
  before their 5-second hold finished. The branch is 3 lines mirroring the
  plant completion that was observed live twice.

## Still not verified (honest gaps)

- The sealed server scorer is not in the kit, so the gate verdict is a local
  replication from competition.yaml + the kit library, not the server itself.
  The one failing item it found is gone; no other gate risk was found.
- No Node 22 binary exists on this VM (only Node 24.22.1), so `main.ts` +
  the `.ts` vendor import were not executed under the server's Node 22.23.4.
  Mitigation: the starter uses the identical mechanism and is a known-valid
  house game; the vendor file uses only erasable TypeScript (no enums,
  namespaces or parameter properties — verified by grep).
- Resubmission itself is NOT done by this fix (separate finisher step).
