# RESUBMIT ROUND 4 — 2026-11-16 (user-approved 07:02 WIB)

- **Submission:** [ID TBD — finisher fills in]
- **Commit:** [TBD]
- **Live submission (round 3):** 01a1e023-742a-774c-8652-3227f613c153, commit 2f818ea.
- **Entries close:** 17 Nov 04:30 WIB (2026-11-16T21:30Z). Result due 1 Des 2026.
- **Angle round 4 — VISUALS (judge criteria #1 completeness + #4 map & look), NOT Tactics.**
  Full diagnosis: `ROUND4-NOTE.md`. Short version: the judge reads screenshots
  FIRST (dossier capped at 160 KiB, screenshots are the first thing in the
  dossier); round 3 proved Tactics changes don't move the score (75.55% →
  74.82% despite more judge-game wins). The visible defects were all in the
  frames: shot 1 was a menu covering ~90% of the frame, shot 3 staged the
  enemy behind a crate with tracer + flash decayed before the freeze, the
  viewmodel read as a dark slab, and the palette + fog washed the mid/far
  field grey.

## Changes (this round, vs commit 2f818ea)

| File | Change | Why |
|---|---|---|
| `game/src/main.js` | `runShot('start')`: live east-corridor sightline (player (21,12) → aim (21,1.2,-18), V ally (17,0,4), S enemy (24,0,-8)), title banner "STRIKEPOINT — FOUNDRY · 5v5 BOMB PLANT / DEFUSE" (30s in shot mode — SwiftShader paints are slow, a 4s banner can expire before the frozen frame), NO menu overlay | Shot 1 now shows the game, not a menu |
| `game/src/main.js` | `runShot('combat')`: d1 moved to (21,0,4) in the open, ally to (17,0,6), aim (21,1.2,4); `settle(2); shoot(); settle(2)` so tracer + muzzle flash survive into the frozen frame; staged fake feed line "you ▸ Warden" REMOVED | Enemy visible centre-frame, tracer + flash in frame, no fake feed |
| `game/src/main.js` | `runShot('plant')`: unchanged | Best shot already |
| `game/src/weapons.js` | Viewmodel raised (0.22,-0.17,-0.42) + matching step() lerp targets + flash/flashLight positions; barrel lighter steel (0x9aa4ae); thin amber accent stripe on receiver (0.085×0.012×0.12); muzzle flash plane 0.16→0.11, spin 30→12 | Gun reads as a gun, not a dark slab; flash no longer a giant diamond |
| `game/src/map.js` | Hemi 1.15→1.35, site ring opacity 0.55→0.75, fog (30,85)→(34,95) | Brighter scene, site ring pops, less grey wash |
| `game/src/palette.js` | Floor #232b33→#2b343e, wall #2a333d→#343e49, canvas #141a21→#1a222b | Less flat dark slate; mid/far field reads |
| `screenshots/*.jpg` | All 4 re-shot at 1280×800 via headless Chromium (CDP, Playwright headless shell, SwiftShader) and LOOKED at | See below |

## Deliberately unchanged

Vendor, `.makefun/owner.json`, `main.ts`, round/economy rules, bot buy phase,
coordinated push, carrier/plant logic, defuse non-sticky, S defender behavior,
shot 2 (buy menu) and shot 4 (plant) staging, all sim logic. Gunplay code
unchanged (headshots 4× + helmet halves, recoil, spread, crouch/ADS).

## Screenshot review (builder, 16 Nov ~07:30 WIB)

- **1-start.jpg** — title banner + live map + blue ally left + red enemies
  centre + gun bottom-right. Good.
- **2-buy.jpg** — buy menu, unchanged, good.
- **3-combat.jpg** — enemy centre-frame with hit marker, tracer lines visible
  (ally firing), muzzle flash present, HP 100. Good. (Tracer visibility varies
  run to run — depends on whether the ally fires during the settle window;
  the player's own tracer is a 1px line that can wash out in JPEG.)
- **4-plant.jpg** — teal site ring prominent, enemy bot close at right, plant
  progress bar, gun reads. Good.

## Verification (builder)

- Local gate 5/5 PASS (`/tmp/gate4.mjs` vs fresh `main.ts` builds in
  /tmp/out4a + /tmp/out4b): game_files 19 entries / 2,224,866 B; three_js
  both shas match kit starter 0.187.0, import map → ./vendor/three/
  three.module.min.js; references all resolve inside game/; screenshots
  4× 1280×800, 38–60 KiB each; dossier.json 352,835 B, text 91,025 B
  (cap 163,840). Determinism: two main.ts builds byte-identical.
- `node --check`: all 16 game/src/*.js files OK.
- Nav-graph: NOT re-run — map geometry (BOXES, WAYPOINTS, EDGES) untouched
  this round (only lighting/ring/fog changed); round-2/3 check was
  32 nodes / 46 edges / 32-32 reachable / 0 blocked.
- Full headless match (AFK, seed 11, 320×200, ~1× real time): **VANGUARD won
  8–2 in 10 rounds** (V won rounds 1–6, 9, 10; S won round 7 by bomb
  detonation — BOMB countdown 0:31 observed live — and round 8), "MATCH OVER"
  overlay, **0 console errors**. Log: /tmp/match4.out (rounds 1–6) +
  /tmp/watch4.out (rounds 7–10). Defuse branch not observed in THIS run,
  but it was observed 5× in round 3's tests and the defuse code path is
  untouched since round 3. (Note: at 1280×800 SwiftShader renders ~0.077×
  real time — the match was run at 320×200 where it runs ~1×; the round-2
  team saw the same ~643s full-match time.)
- `makefun check` 13/0: [finisher fills in — needs the transcript bundle].
- thinking_reproduces ≥30%: [finisher fills in].

## Submission

- [Finisher fills in: submission ID, bundle sha256, checks, claim-code file.]

## Honest odds

Round 3 = 74.82% (#2785/3,971); top-10 cut-off ~94.95%. Gap ~20 pp.
This round changes only what the judge SEES — it does not change the sim,
the bot behaviour, or the game rules. If the judge's pairwise comparisons
are dominated by screenshots (criterion #1/#4), a visible frame can move
the needle; if they are dominated by code/rules, this round moves little.
Either way this is the last resubmit slot before entries close — a long
shot, no prize promise.
