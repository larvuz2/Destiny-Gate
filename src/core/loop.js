// Fixed-tick simulation with bounded catch-up (GDD 18.6). Rendering interpolates with `alpha`.
export const TICK = 1 / 60;
const MAX_STEPS = 5;

export class Loop {
  constructor({ step, render }) {
    this.step = step;
    this.render = render;
    this.acc = 0;
    this.last = 0;
    this.running = false;
    this.simPaused = true;
    this.tick = 0;
    this.manual = false; // test rig drives the loop itself
    this._frame = this._frame.bind(this);
  }
  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    if (!this.manual) requestAnimationFrame(this._frame);
  }
  _frame(now) {
    if (!this.running) return;
    const dt = Math.min((now - this.last) / 1000, 0.25);
    this.last = now;
    if (!this.simPaused) {
      this.acc += dt;
      let n = 0;
      while (this.acc >= TICK && n < MAX_STEPS) { this.step(TICK); this.tick++; this.acc -= TICK; n++; }
      if (n === MAX_STEPS) this.acc = 0; // drop time rather than spiral
    }
    this.render(dt, this.simPaused ? 1 : this.acc / TICK);
    if (!this.manual) requestAnimationFrame(this._frame);
  }
  /** Deterministic stepping for tests. */
  advance(ticks) {
    for (let i = 0; i < ticks; i++) { this.step(TICK); this.tick++; }
  }
}
