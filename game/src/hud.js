// HUD: DOM readouts + minimap canvas + buy menu + overlays. Push-only: main.js feeds it
// numbers each frame; it never touches the simulation.
import { BUY_ITEMS } from './weapons.js';

export function createHud(S) {
  const $ = (id) => document.getElementById(id);
  const el = {
    overlay: $('overlay'), title: $('overlay-title'), copy: $('overlay-copy'), play: $('play'),
    ammoMag: $('ammo-mag'), ammoReserve: $('ammo-reserve'), ammo: $('ammo'),
    hp: $('hp-val'), armor: $('armor-val'), hpBar: $('hp-bar'), money: $('money-val'),
    scoreV: $('score-v'), scoreS: $('score-s'), round: $('round-val'), timer: $('timer-val'),
    cross: $('crosshair'), hit: $('hitmarker'), feed: $('feed'), banner: $('banner'),
    bomb: $('bomb-status'), progress: $('progress'), progressBar: $('progress-bar'),
    buy: $('buy'), buyList: $('buy-list'), buyMoney: $('buy-money'),
    minimap: $('minimap'), dmg: $('dmg-indicator'), flash: $('flash-overlay'),
    wname: $('weapon-name'), grenades: $('grenades'), hint: $('hint'),
  };
  const ctx = el.minimap.getContext('2d');
  let hitTimer = 0, bannerTimer = 0;
  const cache = {};
  function setText(node, key, v) { if (cache[key] !== v) { cache[key] = v; node.textContent = v; } }
  function fmtTime(s) { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }

  function drawMinimap() {
    const c = ctx, W = 150, H = 132;
    c.clearRect(0, 0, W, H);
    c.fillStyle = 'rgba(20,26,33,0.85)'; c.fillRect(0, 0, W, H);
    const sx = (x) => (x + 32) / 64 * W, sz = (z) => (z + 28) / 56 * H;
    c.strokeStyle = '#2fb8a6'; c.lineWidth = 2;
    c.strokeRect(sx(-25), sz(-21), (6 / 64) * W, (6 / 56) * H);
    c.strokeRect(sx(19), sz(-21), (6 / 64) * W, (6 / 56) * H);
    c.fillStyle = '#2fb8a6'; c.font = 'bold 11px sans-serif';
    c.fillText('A', sx(-25) + 2, sz(-21) + 12); c.fillText('B', sx(19) + 2, sz(-21) + 12);
    if (S.bomb.state === 'planted') {
      const s = S.bomb.site === 'A' ? [-22, -18] : [22, -18];
      c.fillStyle = '#f0a830'; c.beginPath(); c.arc(sx(s[0]), sz(s[1]), 5, 0, 7); c.fill();
    }
    for (const b of S.bots) {
      if (!b.alive) continue;
      c.fillStyle = b.team === 'V' ? '#3f8cff' : '#e0533d';
      c.beginPath(); c.arc(sx(b.pos.x), sz(b.pos.z), 3.5, 0, 7); c.fill();
    }
    const p = S.player;
    if (p.alive) {
      c.fillStyle = '#fff';
      c.save(); c.translate(sx(p.pos.x), sz(p.pos.z)); c.rotate(-p.yaw);
      c.beginPath(); c.moveTo(0, -6); c.lineTo(4.5, 5); c.lineTo(-4.5, 5); c.closePath(); c.fill(); c.restore();
    }
  }
  function buildBuy(onBuy) {
    el.buyList.innerHTML = '';
    for (const item of BUY_ITEMS) {
      const row = document.createElement('div');
      row.className = 'buy-row';
      row.innerHTML = `<span class="buy-name">${item.label}</span><span class="buy-desc">${item.desc}</span><span class="buy-price">$${item.price}</span>`;
      row.addEventListener('click', () => onBuy(item));
      el.buyList.appendChild(row);
    }
  }
  return {
    setAmmo(mag, reserve, name) {
      setText(el.ammoMag, 'mag', String(mag)); setText(el.ammoReserve, 'res', `/ ${reserve}`);
      setText(el.wname, 'wname', name); el.ammo.classList.toggle('empty', mag === 0);
    },
    setVitals(hp, armor, money, nades) {
      setText(el.hp, 'hp', String(Math.max(0, Math.ceil(hp))));
      setText(el.armor, 'ar', String(Math.max(0, Math.ceil(armor))));
      setText(el.money, 'money', `$${money}`);
      el.hpBar.style.width = `${Math.max(0, hp)}%`;
      el.hpBar.style.background = hp > 50 ? '#2fb8a6' : hp > 25 ? '#f0a830' : '#e0533d';
      setText(el.grenades, 'nades', `HE ${nades.he} · FL ${nades.flash} · SM ${nades.smoke}  [4/5/6 or G]`);
    },
    setRound(scoreV, scoreS, round, t, phase) {
      setText(el.scoreV, 'sv', String(scoreV)); setText(el.scoreS, 'ss', String(scoreS));
      setText(el.round, 'rd', `ROUND ${round}`);
      const label = phase === 'freeze' ? 'BUY' : phase === 'planted' ? 'BOMB' : '';
      setText(el.timer, 'tm', `${label ? label + ' ' : ''}${fmtTime(t)}`);
      el.timer.style.color = t <= 10 && phase !== 'freeze' ? '#e0533d' : '#e9e6df';
    },
    setCrosshair(gap, ads) {
      el.cross.style.setProperty('--gap', `${gap}px`);
      el.cross.classList.toggle('ads', ads);
    },
    hitMarker(killed, holdMs = 90) {
      el.hit.classList.add('on');
      el.hit.classList.toggle('kill', killed);
      clearTimeout(hitTimer);
      hitTimer = setTimeout(() => el.hit.classList.remove('on', 'kill'), holdMs);
    },
    addFeed(text) {
      const div = document.createElement('div'); div.textContent = text;
      el.feed.prepend(div);
      while (el.feed.children.length > 5) el.feed.lastChild.remove();
      setTimeout(() => div.remove(), 6000);
    },
    banner(text, ms = 2500) {
      el.banner.textContent = text; el.banner.hidden = false;
      clearTimeout(bannerTimer);
      bannerTimer = setTimeout(() => { el.banner.hidden = true; }, ms);
    },
    setBomb(text) { setText(el.bomb, 'bomb', text); el.bomb.hidden = !text; },
    setProgress(label, frac) {
      if (frac == null) { el.progress.hidden = true; return; }
      el.progress.hidden = false;
      el.progressBar.style.width = `${Math.round(frac * 100)}%`;
      el.progress.firstChild.textContent = label;
    },
    setHint(text) { setText(el.hint, 'hint', text); el.hint.hidden = !text; },
    setFlash(alpha) { el.flash.style.opacity = String(alpha); },
    setDamageDir(angle, alpha) {
      el.dmg.style.opacity = String(alpha);
      el.dmg.style.transform = `translate(-50%,-50%) rotate(${angle}rad)`;
    },
    showBuy(open, money) {
      el.buy.hidden = !open;
      setText(el.buyMoney, 'bmoney', `$${money}`);
      if (open) document.exitPointerLock?.();
    },
    isBuyOpen() { return !el.buy.hidden; },
    buildBuy,
    showOverlay(mode, extra = '') {
      const copy = {
        start: ['STRIKEPOINT', 'FOUNDRY — 5v5 bomb plant / defuse. First to 8 rounds. Click to play.', 'CLICK TO PLAY'],
        paused: ['STRIKEPOINT', 'Paused — click to resume.', 'CLICK TO RESUME'],
        dead: ['YOU ARE DOWN', 'Your team fights on. Next round starts soon.', 'CLICK TO CONTINUE'],
        end: ['MATCH OVER', extra, 'PLAY AGAIN'],
      }[mode];
      el.title.textContent = copy[0]; el.copy.textContent = copy[1]; el.play.textContent = copy[2];
      el.overlay.hidden = false; el.play.focus();
    },
    hideOverlay() { el.overlay.hidden = true; },
    onPlay(h) { el.play.addEventListener('click', h); },
    minimap: drawMinimap,
  };
}
