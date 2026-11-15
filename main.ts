// STRIKEPOINT — entry program for make.fun (Node 22, standard library only).
//
// The game itself is the static files in game/ next to this file: the browser
// loads them as ES modules, with three.js resolved by the import map. This
// program is the hand-in step — it copies game/ and screenshots/ into the
// output directory the grader provides and writes dossier.json there, the
// summary the judge reads, built with the vendored make.fun library.
//
// Local play: run `node serve.ts` and open http://localhost:8080.
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output, e.g.
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-threejs.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Caps from the scorer's reference/gate.json. text_max_bytes is the only one
// that shapes bytes; the rest refuse an entry the scorer would refuse: more
// than 4 screenshots or one over 256 KiB, more than 993 files in game/ or
// 48 MiB of game files in all (game/ counts beside /output's own 1000-entry
// cap, its screenshots/ and dossier.json).
const LIMITS = {
  textMaxBytes: 163840,
  shotMax: 4,
  shotMaxBytes: 262144,
  gameMaxFiles: 993,
  gameMaxBytes: 50331648,
};

function copyTree(from, to) {
  fs.cpSync(from, to, { recursive: true });
}

function main() {
  fs.mkdirSync(outDir, { recursive: true });
  copyTree(path.join(repoRoot, 'game'), path.join(outDir, 'game'));
  const shotsOut = path.join(outDir, 'screenshots');
  fs.mkdirSync(shotsOut, { recursive: true });
  const shotsSrc = path.join(repoRoot, 'screenshots');
  if (fs.existsSync(shotsSrc)) copyTree(shotsSrc, shotsOut);
  const dossier = buildDossier(outDir, {
    text_max_bytes: LIMITS.textMaxBytes,
    screenshots: { max: LIMITS.shotMax, max_bytes: LIMITS.shotMaxBytes },
    game_max_files: LIMITS.gameMaxFiles,
    game_max_bytes: LIMITS.gameMaxBytes,
  });
  fs.writeFileSync(path.join(outDir, 'dossier.json'), dossier);
}

main();
