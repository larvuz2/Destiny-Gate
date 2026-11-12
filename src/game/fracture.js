import * as THREE from 'three/webgpu';
import { bus } from '../core/events.js';
import { TICK } from '../core/loop.js';

// FractureController — tagged fracture surfaces and their collision (GDD 5.2–5.4, 20.1).
//   F0 stable → F1 stressed → F2 critical → F3 failed → F4 rewound (temporarily restored)
// Fragments are deterministic rigid pieces. A failure is recorded into a fixed-tick RewindBuffer
// (≤ 4 s) so the Watch can play the same motion backwards; collision swaps atomically.
export const F = { STABLE: 0, STRESSED: 1, CRITICAL: 2, FAILED: 3, REWOUND: 4 };
export const FR = { RANGE: 9, T12: 2.0, T23: 1.0, WARN: 0.5, HISTORY: 4.0, RESTORE: 4.5, REPLAY_RATE: 2.0, CALM12: 3.0, CALM01: 4.0 };
const HIST = Math.round(FR.HISTORY / TICK);

function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }

/** Fixed-tick transform history for a set of rigid pieces. */
export class RewindBuffer {
  constructor(count, capacity = HIST) {
    this.count = count; this.capacity = capacity; this.len = 0;
    this.data = new Float32Array(count * capacity * 7);
  }
  clear() { this.len = 0; }
  push(pieces) {
    if (this.len >= this.capacity) return false;
    let o = this.len * this.count * 7;
    for (const p of pieces) { const d = this.data; d[o++] = p.pos.x; d[o++] = p.pos.y; d[o++] = p.pos.z; d[o++] = p.quat.x; d[o++] = p.quat.y; d[o++] = p.quat.z; d[o++] = p.quat.w; }
    this.len++;
    return true;
  }
  /** Sample at fractional frame index. */
  read(pieces, f) {
    const i0 = Math.max(0, Math.min(this.len - 1, Math.floor(f))), i1 = Math.min(this.len - 1, i0 + 1), t = Math.max(0, Math.min(1, f - i0));
    const d = this.data, n = this.count * 7;
    for (let k = 0; k < pieces.length; k++) {
      const a = i0 * n + k * 7, b = i1 * n + k * 7, p = pieces[k];
      p.pos.set(d[a] + (d[b] - d[a]) * t, d[a + 1] + (d[b + 1] - d[a + 1]) * t, d[a + 2] + (d[b + 2] - d[a + 2]) * t);
      _qa.set(d[a + 3], d[a + 4], d[a + 5], d[a + 6]); _qb.set(d[b + 3], d[b + 4], d[b + 5], d[b + 6]);
      p.quat.slerpQuaternions(_qa, _qb, t);
    }
  }
}
const _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3();

/** Prism from a convex polygon in XZ (local coordinates), UVs in metres. */
function prismGeo(poly, t) {
  const pos = [], nor = [], uv = [], idx = [];
  const n = poly.length;
  for (const [y, ny] of [[0, 1], [-t, -1]]) {
    const b = pos.length / 3;
    for (const [x, z] of poly) { pos.push(x, y, z); nor.push(0, ny, 0); uv.push(x, z); }
    for (let i = 1; i < n - 1; i++) ny > 0 ? idx.push(b, b + i + 1, b + i) : idx.push(b, b + i, b + i + 1);
  }
  for (let i = 0; i < n; i++) {
    const [ax, az] = poly[i], [bx, bz] = poly[(i + 1) % n];
    const dx = bx - ax, dz = bz - az, l = Math.hypot(dx, dz) || 1, nx = -dz / l, nz = dx / l;
    const b = pos.length / 3;
    pos.push(ax, 0, az, bx, 0, bz, bx, -t, bz, ax, -t, az);
    for (let k = 0; k < 4; k++) nor.push(-nx, 0, -nz);
    uv.push(0, 0, l, 0, l, t, 0, t);
    idx.push(b, b + 2, b + 1, b, b + 3, b + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

class Panel {
  constructor(ctrl, spec, index) {
    this.ctrl = ctrl; this.spec = spec; this.id = spec.id; this.index = index;
    this.state = F.STABLE; this.t = 0; this.calm = 0; this.pressure = 0; this.warned = false;
    this.cause = null; this.lastTransition = 0;
    this.rand = rng(index * 7919 + 17);
    this.t12 = FR.T12 * (0.85 + this.rand() * 0.3); this.t23 = FR.T23 * (0.85 + this.rand() * 0.3);
    this.cx = (spec.x0 + spec.x1) / 2; this.cz = (spec.z0 + spec.z1) / 2;
    this.floor = ctrl.world.floor(spec.x0, spec.x1, spec.z0, spec.z1, spec.y, { surface: spec.surface || 'wood', panel: this });
    this.extras = [];
    this.replay = null;          // { dir, f } while fragments play back / forward
    this.restoreT = 0;
    this._build();
    if (spec.startFailed) this._instantFail();
  }

  get solid() { return this.floor.enabled; }
  get rewindEligible() { return this.spec.rewindable && this.state === F.FAILED && !this.replay && this.buffer.len > 1; }
  contains(x, z, m = 0) { const s = this.spec; return x >= s.x0 - m && x <= s.x1 + m && z >= s.z0 - m && z <= s.z1 + m; }

  _build() {
    const s = this.spec, w = s.x1 - s.x0, d = s.z1 - s.z0, r = this.rand;
    const base = this.ctrl.world.mats.get(s.mat);
    this.material = base.clone();
    this.material.emissive = new THREE.Color(0x9fd8e6); this.material.emissiveIntensity = 0;
    this.group = new THREE.Group();
    this.group.position.set(s.x0, s.y, s.z0);
    const zone = this.ctrl.world.zones.find((q) => q.id === s.zone);
    zone.group.add(this.group);
    // cut: boards (plank) run across the walking axis; grates/floors break into jittered shards
    const polys = [];
    if (s.mat === 'plank') {
      const n = Math.max(4, Math.round(s.frags / 2)), bw = w / n;
      for (let i = 0; i < n; i++) {
        const cut = d * (0.3 + r() * 0.4), sk = (r() - 0.5) * 0.16;
        polys.push([[i * bw, 0], [(i + 1) * bw, 0], [(i + 1) * bw, cut + sk], [i * bw, cut - sk]]);
        polys.push([[i * bw, cut - sk], [(i + 1) * bw, cut + sk], [(i + 1) * bw, d], [i * bw, d]]);
      }
    } else {
      const nx = Math.max(2, Math.round(Math.sqrt((s.frags * w) / d))), nz = Math.max(2, Math.round(s.frags / nx));
      const P = [];
      for (let i = 0; i <= nx; i++) { P.push([]); for (let k = 0; k <= nz; k++) {
        const jx = i > 0 && i < nx ? (r() - 0.5) * (w / nx) * 0.55 : 0, jz = k > 0 && k < nz ? (r() - 0.5) * (d / nz) * 0.55 : 0;
        P[i].push([(i * w) / nx + jx, (k * d) / nz + jz]);
      } }
      for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) polys.push([P[i][k], P[i + 1][k], P[i + 1][k + 1], P[i][k + 1]]);
    }
    this.pieces = polys.map((poly) => {
      const cx = poly.reduce((a, p) => a + p[0], 0) / poly.length, cz = poly.reduce((a, p) => a + p[1], 0) / poly.length;
      const local = poly.map(([x, z]) => [x - cx, z - cz]);
      const mesh = new THREE.Mesh(prismGeo(local, s.thickness), this.material);
      mesh.castShadow = true; mesh.receiveShadow = true;
      // the top face needs world-aligned UVs so pieces continue each other's texture
      const uv = mesh.geometry.attributes.uv; for (let i = 0; i < local.length * 2; i++) uv.setXY(i, uv.getX(i) + cx + s.x0, uv.getY(i) + cz + s.z0);
      this.group.add(mesh);
      const home = new THREE.Vector3(cx, 0, cz);
      return { mesh, home, pos: home.clone(), quat: new THREE.Quaternion(), vel: new THREE.Vector3(), spin: new THREE.Vector3(), delay: 0, free: false, seed: r(), tilt: new THREE.Vector3((r() - 0.5), 0, (r() - 0.5)) };
    });
    // pale time-residue rim: marks Watch-eligible gaps (wayfinding anchor, GDD 9.3)
    this.rimMat = new THREE.MeshBasicNodeMaterial({ color: 0x9fd8e6, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    const rim = new THREE.Group();
    for (const [a, b2, c, e] of [[w / 2, 0.012, w, 0.035], [w / 2, d - 0.012, w, 0.035]]) { const m = new THREE.Mesh(new THREE.BoxGeometry(c, 0.012, e), this.rimMat); m.position.set(a, 0.004, b2); rim.add(m); }
    for (const [a, b2, c, e] of [[0.012, d / 2, 0.035, d], [w - 0.012, d / 2, 0.035, d]]) { const m = new THREE.Mesh(new THREE.BoxGeometry(c, 0.012, e), this.rimMat); m.position.set(a, 0.004, b2); rim.add(m); }
    this.group.add(rim); this.rim = rim;
    this.buffer = new RewindBuffer(this.pieces.length + 8);
  }

  /** Extra rigid props that share this panel's history (e.g. the luggage that breaks the bridge). */
  addExtra(mesh, home) {
    const local = home.clone().sub(this.group.position);
    this.group.attach(mesh);
    const p = { mesh, home: local, pos: local.clone(), quat: mesh.quaternion.clone(), homeQuat: mesh.quaternion.clone(), vel: new THREE.Vector3(), spin: new THREE.Vector3(), delay: 0, free: false, seed: 0.5, tilt: new THREE.Vector3(), extra: true };
    this.extras.push(p);
    return p;
  }
  get all() { return this._all && this._all.length === this.pieces.length + this.extras.length ? this._all : (this._all = [...this.pieces, ...this.extras]); }

  setState(st, cause) {
    if (st === this.state) return;
    const prev = this.state;
    this.state = st; this.t = 0; this.warned = false; this.cause = cause ?? this.cause; this.lastTransition = this.ctrl.game.t;
    bus.emit('fracture.state_changed', { panel: this, id: this.id, state: st, prev, cause: this.cause });
  }

  /** Called every tick the hunter (or a script) loads the surface. */
  press(amount = 1) { this.pressure = Math.max(this.pressure, amount); }

  /** Break now. origin: world {x,z} the tear radiates from. */
  fail(cause = 'script', origin = null, { impulse = null, delay = 0 } = {}) {
    if (this.state === F.FAILED || this.replay) return;
    const s = this.spec;
    const ox = (origin?.x ?? this.cx) - s.x0, oz = (origin?.z ?? this.cz) - s.z0;
    const r = rng(this.index * 131 + 7);
    for (const p of this.all) {
      const dist = Math.hypot(p.home.x - ox, p.home.z - oz);
      p.delay = p.extra ? 0 : delay + dist * 0.11 + r() * 0.05;
      p.free = false;
      p.pos.copy(p.extra ? p.pos : p.home);
      if (!p.extra) p.quat.identity();
      p.vel.set((r() - 0.5) * 0.9, -0.2 - r() * 0.6, (r() - 0.5) * 0.9);
      if (impulse && !p.extra) p.vel.y -= impulse * Math.max(0, 1 - dist / 2);
      p.spin.set((r() - 0.5) * 5, (r() - 0.5) * 2, (r() - 0.5) * 5);
    }
    this.buffer.clear();
    this.offAt = delay;                    // collision goes with the first tearing piece
    if (delay <= 0) this.floor.enabled = false;
    this.replay = { dir: 1, f: 0, sim: true };
    this.setState(F.FAILED, cause);
    this.ctrl.onPanelFailed(this);
  }

  _instantFail() {
    const r = rng(this.index * 131 + 7);
    for (const p of this.all) { p.delay = r() * 0.3; p.free = false; p.vel.set((r() - 0.5) * 0.9, -0.3, (r() - 0.5) * 0.9); p.spin.set((r() - 0.5) * 5, (r() - 0.5) * 2, (r() - 0.5) * 5); }
    this.buffer.clear(); this.floor.enabled = false; this.state = F.FAILED;
    this.replay = { dir: 1, f: 0, sim: true };
    for (let i = 0; i < HIST; i++) this._simTick();
    this.replay = null;
    this._apply();
  }

  /** Watch: play the recorded failure backwards. Returns false if there is nothing to restore. */
  rewind() {
    if (!this.rewindEligible) return false;
    this.replay = { dir: -1, f: this.buffer.len - 1, sim: false };
    this.setState(F.REWOUND, 'watch');
    this.restoreT = 0;
    bus.emit('fracture.rewind_start', { panel: this });
    return true;
  }

  _simTick() {
    let moving = false;
    const time = this.buffer.len * TICK;
    if (this.floor.enabled && time >= (this.offAt || 0)) this.floor.enabled = false;
    for (const p of this.all) {
      if (time >= p.delay) {
        p.free = true;
        p.vel.y -= 9.8 * TICK;
        p.pos.addScaledVector(p.vel, TICK);
        _e.set(p.spin.x * TICK, p.spin.y * TICK, p.spin.z * TICK);
        p.quat.multiply(_qa.setFromEuler(_e));
      }
      if (p.pos.y > -40) moving = true;
    }
    this.buffer.push(this.all);
    return moving && this.buffer.len < this.buffer.capacity;
  }

  step(dt) {
    this.t += dt;
    const st = this.state;
    // --- replay / simulation of pieces -----------------------------------------------------------
    if (this.replay) {
      const rp = this.replay;
      if (rp.sim) { if (!this._simTick()) this.replay = null; }
      else if (rp.dir < 0) {
        rp.f -= FR.REPLAY_RATE;
        if (rp.f <= 0) {
          // atomic snap at a safe phase boundary: pieces home, then collision on
          for (const p of this.all) { p.pos.copy(p.home); p.quat.copy(p.homeQuat || _qa.identity()); }
          this.replay = null; this.floor.enabled = true; this.restoreT = 0;
          bus.emit('fracture.rewind_end', { panel: this });
        } else this.buffer.read(this.all, rp.f);
      } else {
        rp.f += 1;
        if (rp.f >= this.buffer.len - 1) this.replay = null; else this.buffer.read(this.all, rp.f);
      }
    }
    // --- state machine -----------------------------------------------------------------------------
    const pressed = this.pressure > 0, strong = this.pressure >= (this.spec.fragile ? 0.12 : 0.3);
    if (st === F.STABLE) { if (pressed) this.setState(F.STRESSED, 'madness'); }
    else if (st === F.STRESSED) {
      if (pressed) { this.calm = 0; if (!strong) this.t = Math.min(this.t, this.t12 * 0.6); if (strong && this.t >= this.t12) this.setState(F.CRITICAL, 'madness'); }
      else { this.calm += dt; this.t = Math.max(0, this.t - dt * 0.5); if (this.calm >= FR.CALM01) { this.calm = 0; this.setState(F.STABLE, 'calm'); } }
    } else if (st === F.CRITICAL) {
      if (strong) {
        this.calm = 0;
        const canFail = this.spec.autoFail && !this.spec.stressOnly;
        if (canFail && !this.warned && this.t >= this.t23 - FR.WARN) { this.warned = true; bus.emit('fracture.warning', { panel: this }); }
        if (canFail && this.t >= this.t23) this.fail('madness', this.ctrl.pressOrigin);
      } else { this.calm += dt; this.t = Math.max(0, this.t - dt * 0.5); if (this.calm >= FR.CALM12) { this.calm = 0; this.setState(F.STRESSED, 'calm'); } }
    } else if (st === F.REWOUND && !this.replay) {
      this.restoreT += dt;
      if (!this.warned && this.restoreT >= FR.RESTORE - 0.8) { this.warned = true; bus.emit('fracture.warning', { panel: this, restore: true }); }
      if (this.restoreT >= FR.RESTORE) {
        // the restored state expires: replay the same failure forward
        this.offAt = 0; this.floor.enabled = false;
        this.replay = { dir: 1, f: 0, sim: false };
        this.setState(F.FAILED, 'expire');
        this.ctrl.onPanelFailed(this);
      }
    }
    this.pressure = 0;
  }

  /** Per-frame presentation: crack opening, trembling, time glow. */
  _apply(tNow = 0, lanternBoost = 0) {
    const st = this.state, moving = !!this.replay;
    // crack amount: geometric gaps that read on every graphics preset
    let crack = 0, shake = 0;
    if (st === F.STRESSED) crack = 0.35 + 0.25 * Math.min(1, this.t / this.t12);
    else if (st === F.CRITICAL) { crack = 0.75 + 0.25 * Math.min(1, this.t / this.t23); shake = 1; }
    else if (st === F.REWOUND && !moving) { const k = this.restoreT / FR.RESTORE; crack = 0.15 + 0.5 * k * k; shake = k > 0.82 ? 1 : 0; }
    this.crack = this.crack === undefined ? crack : this.crack + (crack - this.crack) * 0.2;
    const c = this.crack;
    for (const p of this.all) {
      const m = p.mesh;
      if (moving || st === F.FAILED) { m.position.copy(p.pos); m.quaternion.copy(p.quat); m.visible = p.pos.y > -30; if (!p.extra) m.scale.setScalar(1); continue; }
      m.visible = true;
      if (p.extra) { m.position.copy(p.home); m.quaternion.copy(p.homeQuat); continue; }
      const j = shake ? Math.sin(tNow * 47 + p.seed * 40) * 0.004 * shake : 0;
      m.position.set(p.home.x, -c * 0.018 * p.seed + j, p.home.z);
      m.rotation.set(p.tilt.x * c * 0.07, 0, p.tilt.z * c * 0.07);
      m.scale.set(1 - c * 0.045, 1, 1 - c * 0.045);
    }
    const glow = moving && st === F.REWOUND ? 1.6 : st === F.REWOUND ? 0.25 + 0.5 * Math.max(0, this.restoreT / FR.RESTORE - 0.6) * (0.5 + 0.5 * Math.sin(tNow * 22)) : 0;
    this.material.emissiveIntensity += (glow - this.material.emissiveIntensity) * 0.25;
    const rim = this.rewindEligible ? 0.16 + 0.1 * Math.sin(tNow * 2.4 + this.index) + lanternBoost * 0.7 : 0;
    this.rimMat.opacity += (rim - this.rimMat.opacity) * 0.1;
    this.rim.visible = this.rimMat.opacity > 0.01;
  }
}

export class FractureController {
  constructor(game) {
    this.game = game; this.world = game.world;
    this.panels = this.world.panels.map((spec, i) => new Panel(this, spec, i + 1));
    this.byId = Object.fromEntries(this.panels.map((p) => [p.id, p]));
    this.pressOrigin = null;
  }
  get(id) { return this.byId[id]; }
  onPanelFailed(panel) { this.game.onFloorChanged?.(panel); }

  /** The hunter's presence loads every tagged surface in range (visibility-gated by zone). */
  pressFrom(x, z, zoneId, strength = 1) {
    this.pressOrigin = { x, z };
    for (const p of this.panels) {
      if (p.spec.zone !== zoneId || p.state === F.FAILED || p.state === F.REWOUND) continue;
      const d = Math.hypot(Math.max(p.spec.x0 - x, 0, x - p.spec.x1), Math.max(p.spec.z0 - z, 0, z - p.spec.z1));
      if (d < FR.RANGE) p.press(strength * (1 - d / FR.RANGE) + 0.05);
    }
  }

  /** Watch field: rewind every eligible panel touching the sphere. Returns affected panels. */
  rewindAt(x, z, radius) {
    const hit = [];
    for (const p of this.panels) {
      const d = Math.hypot(Math.max(p.spec.x0 - x, 0, x - p.spec.x1), Math.max(p.spec.z0 - z, 0, z - p.spec.z1));
      if (d <= radius && p.rewind()) hit.push(p);
    }
    return hit;
  }
  eligibleNear(x, z, radius) {
    return this.panels.some((p) => p.rewindEligible && Math.hypot(Math.max(p.spec.x0 - x, 0, x - p.spec.x1), Math.max(p.spec.z0 - z, 0, z - p.spec.z1)) <= radius);
  }

  step(dt) { for (const p of this.panels) p.step(dt); }
  present(tNow, lanternPos, lanternFocus) {
    for (const p of this.panels) {
      let boost = 0;
      if (lanternFocus > 0.2 && lanternPos) boost = Math.max(0, 1 - Math.hypot(p.cx - lanternPos.x, p.cz - lanternPos.z) / 6) * lanternFocus;
      p._apply(tNow, boost);
    }
  }

  /** Checkpoint restore. */
  reset(states = {}) {
    for (const p of this.panels) {
      p.replay = null; p.pressure = 0; p.calm = 0; p.t = 0; p.warned = false; p.restoreT = 0; p.crack = 0;
      for (const q of p.all) { q.pos.copy(q.home); q.quat.copy(q.homeQuat || _qa.identity()); }
      p.floor.enabled = true; p.state = F.STABLE;
      const want = states[p.id] ?? (p.spec.startFailed ? F.FAILED : F.STABLE);
      if (want === F.FAILED) p._instantFail();
    }
  }
}
