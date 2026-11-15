// Keyboard + mouse + pointer lock. Edge-triggered presses are consumed once by main.
export function createInput(canvas, onLockChange) {
  const keys = new Set(), pressed = new Set();
  const state = { keys, locked: false, firing: false, ads: false, lookX: 0, lookY: 0 };
  window.addEventListener('keydown', (e) => {
    if (!e.repeat) pressed.add(e.code);
    keys.add(e.code);
    if (e.code === 'Space' || e.code === 'Tab') e.preventDefault();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => { keys.clear(); state.firing = false; state.ads = false; });
  window.addEventListener('mousemove', (e) => {
    if (!state.locked) return;
    state.lookX += e.movementX; state.lookY += e.movementY;
  });
  window.addEventListener('mousedown', (e) => {
    if (!state.locked) return;
    if (e.button === 0) state.firing = true;
    if (e.button === 2) state.ads = true;
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) state.firing = false;
    if (e.button === 2) state.ads = false;
  });
  window.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('pointerlockchange', () => {
    state.locked = document.pointerLockElement === canvas;
    if (!state.locked) { keys.clear(); state.firing = false; state.ads = false; }
    onLockChange(state.locked);
  });
  return {
    state,
    requestLock() { canvas.requestPointerLock(); },
    takeLook() { const x = state.lookX, y = state.lookY; state.lookX = 0; state.lookY = 0; return { x, y }; },
    consume(code) { if (pressed.has(code)) { pressed.delete(code); return true; } return false; },
    clearPressed() { pressed.clear(); },
  };
}
