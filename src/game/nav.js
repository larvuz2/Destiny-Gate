// Grid navigation for the hunter. Cells are derived from the same floors and wall proxies the
// player collides with, so AI, collision and fracture always agree (GDD 6.3, 20.3).
export class NavGrid {
  constructor(game, { x0, x1, z0, z1, cell = 0.25, radius = 0.5 }) {
    this.game = game; this.x0 = x0; this.z0 = z0; this.cell = cell; this.radius = radius;
    this.nx = Math.ceil((x1 - x0) / cell); this.nz = Math.ceil((z1 - z0) / cell);
    this.open = new Uint8Array(this.nx * this.nz);
    this.dirty = true;
    this.g = new Float32Array(this.nx * this.nz); this.from = new Int32Array(this.nx * this.nz); this.mark = new Uint32Array(this.nx * this.nz); this.stamp = 0;
  }
  idx(x, z) { const i = Math.floor((x - this.x0) / this.cell), k = Math.floor((z - this.z0) / this.cell); return i < 0 || k < 0 || i >= this.nx || k >= this.nz ? -1 : k * this.nx + i; }
  cx(id) { return this.x0 + ((id % this.nx) + 0.5) * this.cell; }
  cz(id) { return this.z0 + (Math.floor(id / this.nx) + 0.5) * this.cell; }

  rebuild() {
    const { world } = this.game, r = this.radius;
    const walls = world.walls.filter((w) => w.enabled && w.only !== 'player' && w.only !== 'camera' && w.except !== 'madness');
    for (let k = 0; k < this.nz; k++) for (let i = 0; i < this.nx; i++) {
      const x = this.x0 + (i + 0.5) * this.cell, z = this.z0 + (k + 0.5) * this.cell;
      let ok = false;
      for (const f of world.floors) {
        if (!f.enabled || x < f.x0 + 0.18 || x > f.x1 - 0.18 || z < f.z0 + 0.18 || z > f.z1 - 0.18) continue;
        if (f.panel && f.panel.state === 4) continue; // temporary restorations are not for the hunter
        ok = true; break;
      }
      // allow cells that straddle two adjoining floor rects
      if (!ok && this.game.col.floorY(x, z) !== null && this.game.col.floorY(x + 0.2, z) !== null && this.game.col.floorY(x - 0.2, z) !== null && this.game.col.floorY(x, z + 0.2) !== null && this.game.col.floorY(x, z - 0.2) !== null) {
        const f = this.game.col.floorAt(x, z); ok = !(f.panel && f.panel.state === 4);
      }
      if (ok) for (const w of walls) {
        const dx = x - Math.max(w.x0, Math.min(x, w.x1)), dz = z - Math.max(w.z0, Math.min(z, w.z1));
        if (dx * dx + dz * dz < r * r) { ok = false; break; }
      }
      this.open[k * this.nx + i] = ok ? 1 : 0;
    }
    this.dirty = false;
  }

  nearestOpen(x, z, maxR = 2.5) {
    let id = this.idx(x, z);
    if (id >= 0 && this.open[id]) return id;
    let best = -1, bd = 1e9;
    const n = Math.ceil(maxR / this.cell), ci = Math.floor((x - this.x0) / this.cell), ck = Math.floor((z - this.z0) / this.cell);
    for (let dk = -n; dk <= n; dk++) for (let di = -n; di <= n; di++) {
      const i = ci + di, k = ck + dk;
      if (i < 0 || k < 0 || i >= this.nx || k >= this.nz || !this.open[k * this.nx + i]) continue;
      const d = di * di + dk * dk;
      if (d < bd) { bd = d; best = k * this.nx + i; }
    }
    return best;
  }

  /** Straight walkability between two points (for string pulling). */
  clear(ax, az, bx, bz) {
    const d = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(d / (this.cell * 0.6)));
    for (let i = 0; i <= n; i++) { const t = i / n, id = this.idx(ax + (bx - ax) * t, az + (bz - az) * t); if (id < 0 || !this.open[id]) return false; }
    return true;
  }

  /** A* with octile heuristic. Returns [[x,z], …] or null. */
  path(ax, az, bx, bz) {
    if (this.dirty) this.rebuild();
    const s = this.nearestOpen(ax, az), e = this.nearestOpen(bx, bz);
    if (s < 0 || e < 0) return null;
    const { nx, nz, open, g, from, mark } = this;
    const stamp = ++this.stamp;
    const ex = e % nx, ez = Math.floor(e / nx);
    const heap = [], hcost = [];
    const push = (id, f) => { let i = heap.length; heap.push(id); hcost.push(f); while (i > 0) { const p = (i - 1) >> 1; if (hcost[p] <= f) break; heap[i] = heap[p]; hcost[i] = hcost[p]; i = p; } heap[i] = id; hcost[i] = f; };
    const pop = () => { const top = heap[0], lid = heap.pop(), lf = hcost.pop(); const n = heap.length; if (n) { let i = 0; for (;;) { let c = i * 2 + 1; if (c >= n) break; if (c + 1 < n && hcost[c + 1] < hcost[c]) c++; if (hcost[c] >= lf) break; heap[i] = heap[c]; hcost[i] = hcost[c]; i = c; } heap[i] = lid; hcost[i] = lf; } return top; };
    const h = (id) => { const dx = Math.abs((id % nx) - ex), dz = Math.abs(Math.floor(id / nx) - ez); return Math.max(dx, dz) + 0.4142 * Math.min(dx, dz); };
    g[s] = 0; from[s] = -1; mark[s] = stamp; push(s, h(s));
    let found = false, guard = 0;
    while (heap.length && guard++ < 40000) {
      const c = pop();
      if (c === e) { found = true; break; }
      const ci = c % nx, ck = Math.floor(c / nx);
      for (let dk = -1; dk <= 1; dk++) for (let di = -1; di <= 1; di++) {
        if (!di && !dk) continue;
        const i = ci + di, k = ck + dk;
        if (i < 0 || k < 0 || i >= nx || k >= nz) continue;
        const n = k * nx + i;
        if (!open[n]) continue;
        if (di && dk && (!open[ck * nx + i] || !open[k * nx + ci])) continue; // no corner cutting
        const ng = g[c] + (di && dk ? 1.4142 : 1);
        if (mark[n] === stamp && ng >= g[n]) continue;
        g[n] = ng; from[n] = c; mark[n] = stamp; push(n, ng + h(n));
      }
    }
    if (!found) return null;
    const raw = [];
    for (let c = e; c !== -1; c = from[c]) raw.push([this.cx(c), this.cz(c)]);
    raw.reverse();
    // string pulling
    const out = [raw[0]];
    let a = 0;
    while (a < raw.length - 1) {
      let b = raw.length - 1;
      while (b > a + 1 && !this.clear(raw[a][0], raw[a][1], raw[b][0], raw[b][1])) b--;
      out.push(raw[b]); a = b;
    }
    return out;
  }
}
