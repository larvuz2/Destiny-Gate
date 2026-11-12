// Deterministic 2.5D collision (GDD 5.3): authored wall proxies + walkable floor rects.
// Actors are circles in XZ. Visual debris never decides gameplay.
export class Collision {
  constructor(world) { this.world = world; }

  /** Height of walkable floor under a point, or null over a void. */
  floorY(x, z) {
    let y = null;
    for (const f of this.world.floors) {
      if (!f.enabled) continue;
      if (x >= f.x0 && x <= f.x1 && z >= f.z0 && z <= f.z1 && (y === null || f.y > y)) y = f.y;
    }
    return y;
  }

  floorAt(x, z) {
    let best = null;
    for (const f of this.world.floors) {
      if (!f.enabled) continue;
      if (x >= f.x0 && x <= f.x1 && z >= f.z0 && z <= f.z1 && (!best || f.y > best.y)) best = f;
    }
    return best;
  }

  _push(p, r, who) {
    let hit = false;
    for (const w of this.world.walls) {
      if (!w.enabled || (w.only && w.only !== who) || (w.except && w.except === who)) continue;
      const cx = Math.max(w.x0, Math.min(p.x, w.x1));
      const cz = Math.max(w.z0, Math.min(p.z, w.z1));
      let dx = p.x - cx, dz = p.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      hit = true;
      if (d2 > 1e-10) {
        const d = Math.sqrt(d2), k = (r - d) / d;
        p.x += dx * k; p.z += dz * k;
      } else {
        // centre inside the box: exit through the nearest face
        const l = p.x - w.x0, rr = w.x1 - p.x, b = p.z - w.z0, t = w.z1 - p.z;
        const m = Math.min(l, rr, b, t);
        if (m === l) p.x = w.x0 - r; else if (m === rr) p.x = w.x1 + r; else if (m === b) p.z = w.z0 - r; else p.z = w.z1 + r;
      }
    }
    return hit;
  }

  /**
   * Move a circle with wall sliding and ledge guarding: an actor never walks off solid floor into a
   * void — it only falls when the floor beneath it is removed.
   */
  move(p, dx, dz, r, who = 'player') {
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / (r * 0.5)));
    let blocked = false;
    for (let i = 0; i < steps; i++) {
      const ox = p.x, oz = p.z;
      p.x += dx / steps; p.z += dz / steps;
      for (let k = 0; k < 3; k++) if (!this._push(p, r, who)) break; else blocked = true;
      if (this.floorY(ox, oz) !== null && this.floorY(p.x, p.z) === null) {
        // slide along the ledge
        if (this.floorY(p.x, oz) !== null) p.z = oz;
        else if (this.floorY(ox, p.z) !== null) p.x = ox;
        else { p.x = ox; p.z = oz; }
        blocked = true;
      }
    }
    return blocked;
  }

  /** Segment vs. walls at least `minH` tall (sight) or any wall (movement probes). Returns t in [0,1] or 1. */
  ray(x0, z0, x1, z1, minH = 0, who = null, physical = false) {
    let tMin = 1;
    const dx = x1 - x0, dz = z1 - z0;
    for (const w of this.world.walls) {
      if (!w.enabled || w.h < minH || (w.only && w.only !== who) || (who && w.except === who) || (w.noSight && !physical)) continue;
      let t0 = 0, t1 = tMin;
      if (Math.abs(dx) < 1e-9) { if (x0 < w.x0 || x0 > w.x1) continue; }
      else {
        let a = (w.x0 - x0) / dx, b = (w.x1 - x0) / dx;
        if (a > b) [a, b] = [b, a];
        t0 = Math.max(t0, a); t1 = Math.min(t1, b);
        if (t0 > t1) continue;
      }
      if (Math.abs(dz) < 1e-9) { if (z0 < w.z0 || z0 > w.z1) continue; }
      else {
        let a = (w.z0 - z0) / dz, b = (w.z1 - z0) / dz;
        if (a > b) [a, b] = [b, a];
        t0 = Math.max(t0, a); t1 = Math.min(t1, b);
        if (t0 > t1) continue;
      }
      if (t0 < tMin) tMin = t0;
    }
    return tMin;
  }

  los(x0, z0, x1, z1, minH = 1.5) { return this.ray(x0, z0, x1, z1, minH) >= 1; }
}
