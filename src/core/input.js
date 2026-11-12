import { bus } from './events.js';
import { settings } from './settings.js';

// Unified input: keyboard, mouse and (partial) gamepad mapped onto named actions.
export class Input {
  constructor(el) {
    this.el = el;
    this.down = new Set();     // physical codes currently held
    this.pressed = new Set();  // actions pressed since last consume
    this.virtual = new Set();  // actions held by the test rig
    this.look = { x: 0, y: 0 };
    this.locked = false;
    this.enabled = false;      // gameplay input gate
    this.capture = null;       // rebinding callback

    addEventListener('keydown', (e) => this._key(e, true));
    addEventListener('keyup', (e) => this._key(e, false));
    el.addEventListener('mousedown', (e) => this._code('Mouse' + e.button, true, e));
    addEventListener('mouseup', (e) => this._code('Mouse' + e.button, false, e));
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('mousemove', (e) => {
      if (!this.locked || !this.enabled) return;
      this.look.x += e.movementX;
      this.look.y += e.movementY;
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === el;
      bus.emit('input.lock', this.locked);
    });
    addEventListener('blur', () => { this.down.clear(); bus.emit('input.blur'); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) { this.down.clear(); bus.emit('input.blur'); } });
  }

  _key(e, isDown) {
    if (e.code === 'Tab' || (this.enabled && ['Space', 'ArrowUp', 'ArrowDown'].includes(e.code))) e.preventDefault();
    if (isDown && e.repeat) return;
    this._code(e.code, isDown, e);
  }

  _code(code, isDown, e) {
    if (isDown && this.capture) {
      const cb = this.capture; this.capture = null;
      e?.preventDefault?.();
      cb(code);
      return;
    }
    if (isDown) {
      this.down.add(code);
      if (code === 'Escape') bus.emit('input.escape');
      const action = this.actionFor(code);
      if (action) this.pressed.add(action);
      bus.emit('input.any', code);
    } else this.down.delete(code);
  }

  actionFor(code) {
    const b = settings.controls.bindings;
    for (const k of Object.keys(b)) if (b[k] === code) return k;
    return null;
  }

  held(action) {
    if (!this.enabled) return false;
    return this.virtual.has(action) || this.down.has(settings.controls.bindings[action]) || this._padHeld(action);
  }

  /** True once per press. */
  take(action) {
    if (!this.enabled) { this.pressed.delete(action); return false; }
    const had = this.pressed.delete(action);
    return had || this._padTake(action);
  }

  axis() {
    let x = 0, y = 0;
    if (this.held('forward')) y += 1;
    if (this.held('back')) y -= 1;
    if (this.held('right')) x += 1;
    if (this.held('left')) x -= 1;
    const p = this._pad();
    if (p && this.enabled) {
      const dz = (v) => (Math.abs(v) < 0.18 ? 0 : v);
      x += dz(p.axes[0] || 0); y -= dz(p.axes[1] || 0);
    }
    const l = Math.hypot(x, y);
    if (l > 1) { x /= l; y /= l; }
    return { x, y };
  }

  consumeLook() {
    const out = { x: this.look.x, y: this.look.y };
    this.look.x = this.look.y = 0;
    const p = this._pad();
    if (p && this.enabled) {
      const dz = (v) => (Math.abs(v) < 0.15 ? 0 : v * Math.abs(v));
      out.x += dz(p.axes[2] || 0) * 14; out.y += dz(p.axes[3] || 0) * 10;
    }
    return out;
  }

  // --- gamepad (standard mapping) -------------------------------------------------------------
  _pad() { const pads = navigator.getGamepads?.() || []; for (const p of pads) if (p && p.mapping === 'standard') return p; return null; }
  _padBtn(action) { return { interact: 0, wrench: 7, lantern: 6, watch: 5, sprint: 10, objective: 12 }[action]; }
  _padHeld(action) { const p = this._pad(); const i = this._padBtn(action); return !!(p && i != null && p.buttons[i]?.pressed); }
  _padTake(action) {
    this._padPrev ||= {};
    const now = this._padHeld(action); const was = this._padPrev[action]; this._padPrev[action] = now;
    return now && !was;
  }
  padPause() {
    this._padPrev ||= {};
    const p = this._pad(); const now = !!p?.buttons[9]?.pressed; const was = this._padPrev.__pause; this._padPrev.__pause = now;
    return now && !was;
  }

  requestLock() {
    if (this.locked) return;
    try { const r = this.el.requestPointerLock?.(); r?.catch?.(() => {}); } catch { /* needs a gesture */ }
  }
  releaseLock() { if (document.pointerLockElement) document.exitPointerLock(); }
  clear() { this.pressed.clear(); this.look.x = this.look.y = 0; }
}

export function codeLabel(code) {
  if (!code) return '—';
  if (code.startsWith('Mouse')) return ['LMB', 'MMB', 'RMB'][+code.slice(5)] || code;
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  return ({ ShiftLeft: 'Shift', ShiftRight: 'R Shift', ControlLeft: 'Ctrl', Space: 'Space', Tab: 'Tab', Escape: 'Esc', AltLeft: 'Alt' })[code] || code;
}
