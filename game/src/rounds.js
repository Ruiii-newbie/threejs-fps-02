// Rounds: freeze/buy -> live -> planted -> round end; economy; match end at 8 wins / 15 rounds.
export function createRounds(S, hooks) {
  const WIN_TARGET = 8, MAX_ROUNDS = 15, ROUND_TIME = 100, FREEZE_TIME = 12, BOMB_TIME = 35;
  function startRound() {
    S.roundTime = ROUND_TIME; S.freezeTime = FREEZE_TIME; S.phase = 'freeze'; S.frozen = true;
    S.bomb = { state: 'none', site: null, pos: null, plantedAt: 0, planter: null, defuser: null, progress: 0 };
    S.roundKills = 0;
    hooks.onRoundStart(S.round);
  }
  function beginLive() { S.phase = 'live'; S.frozen = false; }
  function endRound(winner, reason) {
    if (S.phase === 'over') return;
    S.phase = 'over'; S.frozen = true;
    const vWon = winner === 'V';
    if (vWon) { S.scoreV++; S.money += 3250; S.lossStreak = 0; }
    else { S.scoreS++; const loss = Math.min(1500, 1400 + S.lossStreak * 500); S.money += loss; S.lossStreak++; }
    hooks.onRoundEnd(winner, reason);
    const matchOver = S.scoreV >= WIN_TARGET || S.scoreS >= WIN_TARGET || S.round >= MAX_ROUNDS;
    if (matchOver) {
      S.over = true; S.matchWinner = S.scoreV > S.scoreS ? 'V' : S.scoreS > S.scoreV ? 'S' : 'draw';
      hooks.onMatchEnd(S.matchWinner);
    } else {
      S.round++;
      setTimeout(() => { if (!S.over) startRound(); }, 4000);
    }
  }
  function step(dt) {
    if (S.over) return;
    if (S.phase === 'freeze') {
      S.freezeTime -= dt;
      if (S.freezeTime <= 0) beginLive();
    } else if (S.phase === 'live') {
      S.roundTime -= dt;
      if (S.roundTime <= 0) endRound('S', 'Time expired — no plant');
    } else if (S.phase === 'planted') {
      S.bombTime -= dt;
      if (S.bombTime <= 0) endRound('V', 'Bomb detonated');
    }
  }
  function checkEliminations(vAlive, sAlive) {
    if (S.phase !== 'live' && S.phase !== 'planted') return;
    if (sAlive === 0 && vAlive > 0) endRound('V', 'Enemy team eliminated');
    else if (vAlive === 0) {
      if (S.phase === 'planted') { /* bomb still ticks; defenders win only by defuse */ }
      else endRound('S', 'Your team was eliminated');
    }
  }
  function plant(site, planter) {
    S.bomb = { state: 'planted', site, pos: null, plantedAt: S.time, planter, defuser: null, progress: 0 };
    S.phase = 'planted'; S.bombTime = BOMB_TIME;
    hooks.onPlanted(site);
  }
  function defuse() { endRound('S', 'Bomb defused'); }
  return { startRound, beginLive, endRound, step, checkEliminations, plant, defuse, WIN_TARGET, MAX_ROUNDS };
}
