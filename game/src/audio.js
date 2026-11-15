// Audio: synthesized WebAudio only. No files, no network. Created lazily on first gesture.
export function createAudio() {
  let ctx = null, master = null;
  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = 0.35; master.connect(ctx.destination);
      return true;
    } catch { return false; }
  }
  function noiseBuf(dur) {
    const b = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    return b;
  }
  function burst(dur, freq, type, vol, slideTo) {
    if (!ensure()) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = noiseBuf(dur);
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t);
    if (slideTo) f.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(master); src.start(t); src.stop(t + dur);
  }
  function tone(freq, dur, type, vol, slideTo) {
    if (!ensure()) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur);
  }
  return {
    unlock() { ensure(); },
    shot(kind, dist = 0) {
      const v = Math.max(0.08, 0.5 - dist * 0.012);
      if (kind === 'sniper') { burst(0.35, 900, 'lowpass', v, 120); tone(70, 0.25, 'sine', v * 0.8, 40); }
      else if (kind === 'rifle') burst(0.14, 1400, 'bandpass', v, 300);
      else if (kind === 'smg') burst(0.09, 1800, 'bandpass', v * 0.8, 400);
      else burst(0.1, 1000, 'bandpass', v * 0.9, 250);
    },
    dry() { tone(1800, 0.04, 'square', 0.12); },
    hit(kill) { tone(kill ? 1400 : 1000, 0.06, 'sine', 0.25, kill ? 700 : 900); },
    reload() { tone(500, 0.05, 'square', 0.12); setTimeout(() => tone(700, 0.05, 'square', 0.12), 220); },
    step() { burst(0.05, 400, 'lowpass', 0.08); },
    beep(n = 1) { for (let i = 0; i < n; i++) setTimeout(() => tone(880, 0.09, 'sine', 0.22), i * 160); },
    explosion() { burst(0.9, 300, 'lowpass', 0.9, 40); tone(50, 0.7, 'sine', 0.7, 28); },
    flash() { tone(2400, 0.4, 'sine', 0.2, 1800); },
    win() { [523, 659, 784].forEach((f, i) => setTimeout(() => tone(f, 0.18, 'triangle', 0.25), i * 140)); },
    lose() { [392, 330, 262].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'triangle', 0.25), i * 160)); },
    plant() { tone(660, 0.12, 'sine', 0.25); },
  };
}
