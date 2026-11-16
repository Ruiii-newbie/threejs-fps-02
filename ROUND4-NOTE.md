# STRIKEPOINT — round 4 diagnosis + angle (before coding)

Date: 2026-11-16. Round 3 grade: 74.8224% provisional, 7W/5L, valid 1, rank
#2785/3971. Round 2: 75.5467%, 5W/7L, #1853/3401. Top-10 cut-off ~94.95%.
Entries close 17 Nov 04:30 WIB. One resubmit left.

## What the judge actually reads (competition.yaml, judge section)

- Dossier = screenshots (judge reads them FIRST) + source text (capped 160 KiB).
- Rubric, most important first:
  1. Complete game — FPS view, mouse look, movement, weapon fires/reloads/
     runs out of ammo, opponents move/see/shoot back, rounds end + restart,
     HUD (health, ammo, round timer, score). **Screenshots and code must agree;
     a screen with no code behind it counts for nothing.**
  2. Gunplay and movement — headshot damage, recoil/spread punishing firing
     on the move, acceleration, crouching, collision; stopping to aim pays.
  3. Tactics — bomb plant/defuse, money + buy menu, >1 weapon + grenade,
     opponents follow routes, hold positions, react to sight/sound.
  4. Map and look — original map with lanes/corners/sightlines, lighting and
     materials in a chosen palette, a scene that reads at a glance, own art or
     carefully styled geometry.
  5. Code — modules with one job each, fixed-step sim apart from rendering,
     no per-frame allocations in hot loops, single state store, no dead code.
- "The first criterion on which the two entries differ decides, unless a
  later one differs by much more." Pairs are decided by the HIGHEST-ranked
  criterion where the two dossiers visibly differ.

## Why round 3 (Tactics) lowered the score

- Round 3 changed only bot behaviour (buy, coordinated push, carrier). None
  of it is visible in the screenshots except the plant shot. The judge's
  pairwise call reads screenshots first; a behaviour change the screenshots
  don't show can only move criterion 3, and only if the judge infers it
  from code — while the opponent dossiers it faced may have differed on an
  earlier criterion. Win rate went 5W/7L -> 7W/5L but Bradley-Terry score
  fell 75.55% -> 74.82%: we beat weaker opponents, lost to stronger ones.
- Conclusion: repeating/deepening Tactics is the wrong lever. The untouched
  lever is the one the judge sees FIRST: the screenshots + the look
  (criteria 1 and 4). Rounds 1-3 never changed a rendered pixel except the
  favicon; the 4 screenshots are byte-identical since round 1 (15 Nov 02:27).

## What is actually weak in the dossier (looked at the images + code)

1. Shot 1 (`1-start.jpg`): a menu overlay covers ~90% of the frame. The
   judge's FIRST image — and the Feed cover — shows a menu, not the game.
   Criterion 1's "screenshots and code must agree" is satisfied, but the
   screenshot proves almost nothing about the game.
2. Shot 3 (`3-combat.jpg`): the staged enemy d1 at (21,0,0) stands BEHIND
   the crate at (21,0.6,6) from the player's (21,12) view — barely visible,
   half-occluded, ~12 units away. The frame reads as an empty grey room.
   No tracer/muzzle flash survives in the frozen frame (shoot() then
   settle(6) lets the tracer decay). No viewmodel gun reads in frame.
3. The scene palette is all dark slate (floor #232b33, wall #2a333d); the
   amber/teal accents are small. With fog 30-85 the mid/far field washes
   grey. The map DOES have sun 2.0 + shadows + hemi 1.15 + site point
   lights, but the screenshots still read flat and dark.
4. The viewmodel (receiver/barrel/stock/sight) is dark grey on a dark
   background, low-right; in the shots it reads as an unidentifiable slab,
   not a gun.
5. What is NOT weak: gunplay code (headshots 4x + helmet halves, recoil,
   spread punishes move/air, crouch 0.6x + ADS tighten — all in weapons.js,
   all inside the 88 KB dossier, nothing cut at the 160 KiB cap). Buy menu
   shot (2-buy.jpg) is good and stays. Plant shot (4-plant.jpg) is the best
   of the four and stays, with a small staging nudge.

## Round 4 angle: VISUALS — make the game look like a game (criteria 1 + 4)

- Restage the shots so every frame proves the game: start shows the live
  map + HUD (no menu overlay); combat puts a clearly visible enemy in the
  open at ~7 units with tracer + muzzle flash frozen mid-frame; plant
  keeps its staging with the defender closer in frame.
- Viewmodel: lighten receiver/barrel, amber accent stripe, raise slightly —
  must read as a gun in the frame.
- Scene readability: hemi 1.15 -> 1.35, site ring opacity 0.55 -> 0.75,
  floor/wall palette one notch brighter, amber trim on the two site
  containers. Small, verifiable changes only — no gameplay, balance, bot
  AI, economy, or rules changes (round 3's sim behaviour stays).
- Re-shoot all 4 screenshots from the live build via the ?shot= presets
  (same genuine mechanism as rounds 1-3), then re-verify gate 5/5, full
  headless match (all win branches), makefun check 13/0.

## Honest odds

- Gap to the prize line is ~20 points; no single change closes that.
  Visuals are the highest-leverage untouched criterion and the judge reads
  screenshots first, so this is the best remaining lever — but it is a long
  shot, not a promise. The entry stays valid 1 either way; the resubmit
  costs nothing but the day's quota.
