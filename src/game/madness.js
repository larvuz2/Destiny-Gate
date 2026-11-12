import * as THREE from 'three/webgpu';
import { bus } from '../core/events.js';
import { TICK } from '../core/loop.js';
import { NavGrid } from './nav.js';

// MadnessBrain — perception and action for the hunter (GDD 8.3–8.6, 20.1).
// States: dormant · scripted (observe) · patrol · notice · hunt · windup · lunge · recover ·
//         search · look (lose target) · stagger · shield · rewound · fall
export const MAD = {
  sight: 11, fovCos: Math.cos((64 * Math.PI) / 180), near: 2.3, hearSprint: 9, hearWalk: 2.0,
  walk: 1.25, search: 1.8, hunt: 3.3, grate: 0.52, radius: 0.45,
  attackRange: 2.5, anticipation: 0.72, lunge: 0.32, lungeDist: 2.8, hitRadius: 0.95, recover: 1.25,
  notice: 0.9, memory: 1.3, loseMin: 4, loseMax: 7, attackCooldown: 1.0,
};
export const CLIPS = ['walk', 'stalk', 'stagger', 'sprint', 'charged', 'scream', 'hit', 'fall', 'breathe_look', 'scan'];
const HIST = Math.round(4 / TICK);
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };

export class Madness {
  constructor(game) {
    this.game = game;
    this.pos = new THREE.Vector3(); this.prev = new THREE.Vector3();
    this.yaw = 0; this.active = false; this.state = 'dormant'; this.stateT = 0;
    this.path = null; this.pathI = 0; this.pathT = 0; this.goal = { x: 0, z: 0 };
    this.lastKnown = null; this.sees = false; this.unseenT = 99; this.lookFor = 5;
    this.threat = 0; this.stage = 0; this.speed = 0;
    this.shieldUsed = false; this.staggerLock = 0; this.attackCd = 0; this.lungeDir = { x: 1, z: 0 }; this.didHit = false;
    this.patrol = []; this.patrolI = 0; this.relentless = false; this.zone = 'C';
    this.hist = new Float32Array(HIST * 3); this.histN = 0; this.histI = 0; this.rewindLeft = 0;
    this.fallV = 0; this.seed = 1;
    this.nav = new NavGrid(game, { x0: 49.5, x1: 92.6, z0: -5.3, z1: 5.3, radius: MAD.radius + 0.07 });
    bus.on('player.footstep', (e) => this.hear(e.x, e.z, e.sprint ? MAD.hearSprint : MAD.hearWalk, 'step'));
  }

  attach(char) {
    this.char = char; char.root.visible = false; this.game.gfx.scene.add(char.root);
    // bone canvas, bruised grey — never a white glow (GDD 12.3 Threat palette)
    char.material.color.set(0x8f877c); char.material.roughness = 1;
  }
  rand() { this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0; return this.seed / 4294967296; }

  spawn(x, z, yaw, state = 'patrol', zone = 'C') {
    this.pos.set(x, 0, z); this.prev.copy(this.pos); this.yaw = yaw; this.active = true; this.zone = zone;
    this.path = null; this.lastKnown = null; this.sees = false; this.unseenT = 99; this.shieldUsed = false; this.staggerLock = 0; this.attackCd = 0;
    this.histN = 0; this.fallV = 0; this.relentless = false;
    this.char.root.visible = true;
    this.setState(state);
  }
  despawn() { this.active = false; this.state = 'dormant'; this.char.root.visible = false; this.threat = 0; this._stage(0); }

  setState(s) {
    if (this.state === s) return;
    const prev = this.state;
    this.state = s; this.stateT = 0;
    if (s === 'patrol') { this.shieldUsed = false; this.path = null; }
    bus.emit('madness.state', { state: s, prev });
  }
  get dangerous() { return this.active && ['hunt', 'windup', 'lunge', 'notice'].includes(this.state); }

  // --- perception ----------------------------------------------------------------------------------
  canSee(p) {
    if (!p.alive) return false;
    const dx = p.pos.x - this.pos.x, dz = p.pos.z - this.pos.z, d = Math.hypot(dx, dz);
    if (d > MAD.sight) return false;
    const facing = (dx * Math.sin(this.yaw) + dz * Math.cos(this.yaw)) / (d || 1);
    if (d > MAD.near && facing < MAD.fovCos) return false;
    return this.game.col.los(this.pos.x, this.pos.z, p.pos.x, p.pos.z, 1.5);
  }

  hear(x, z, radius, type) {
    if (!this.active || ['scripted', 'fall', 'rewound', 'stagger'].includes(this.state)) return;
    const d = Math.hypot(x - this.pos.x, z - this.pos.z);
    if (d > radius) return;
    // sound never crosses into another coach unless it is loud machinery
    this.lastKnown = { x, z };
    if (this.state === 'patrol' || this.state === 'look') { this.setState('search'); this.path = null; bus.emit('madness.heard', { type }); }
  }

  // --- tool reactions ------------------------------------------------------------------------------
  tryStagger(player, T) {
    if (!this.active || this.staggerLock > 0) return false;
    const dx = this.pos.x - player.pos.x, dz = this.pos.z - player.pos.z, d = Math.hypot(dx, dz);
    if (d > T.reach + 0.55) return false;
    if ((dx * Math.sin(player.yaw) + dz * Math.cos(player.yaw)) / (d || 1) < 0.3) return false;
    // "perfectly timed": during the visible coil, or just after a missed lunge
    if (!(this.state === 'windup' || this.state === 'recover' || (this.state === 'lunge' && this.stateT < 0.1))) return false;
    this.staggerLock = T.staggerLock; this.staggerFor = T.staggerTime;
    this.setState('stagger');
    return true;
  }
  lanternOn(player, camYaw, dt) {
    if (!this.active || this.shieldUsed || !(this.state === 'hunt' || this.state === 'windup')) return;
    const dx = this.pos.x - player.pos.x, dz = this.pos.z - player.pos.z, d = Math.hypot(dx, dz);
    if (d > 5.5 || (dx * Math.sin(camYaw) + dz * Math.cos(camYaw)) / (d || 1) < 0.82) return;
    if (!this.game.col.los(this.pos.x, this.pos.z, player.pos.x, player.pos.z, 1.5)) return;
    this.shieldUsed = true; this.setState('shield');
    bus.emit('madness.shield', {});
  }
  watchCaught(x, z, r) {
    if (!this.active || this.state === 'fall' || this.state === 'scripted') return false;
    if (Math.hypot(this.pos.x - x, this.pos.z - z) > r || this.histN < 10) return false;
    this.rewindLeft = Math.min(this.histN, Math.round(2 / TICK) * 2);
    this.setState('rewound');
    return true;
  }

  // --- movement ------------------------------------------------------------------------------------
  _pathTo(x, z, force = false) {
    if (!force && this.path && Math.hypot(this.goal.x - x, this.goal.z - z) < 0.7 && this.pathT < 0.6) return;
    this.goal.x = x; this.goal.z = z; this.pathT = 0;
    this.path = this.nav.path(this.pos.x, this.pos.z, x, z);
    this.pathI = 1;
  }
  /** Follow the current path. Returns true on arrival (or when no path exists). */
  _follow(dt, speed) {
    if (!this.path || this.pathI >= this.path.length) { this.speed = 0; return true; }
    let [tx, tz] = this.path[this.pathI];
    let dx = tx - this.pos.x, dz = tz - this.pos.z, d = Math.hypot(dx, dz);
    if (d < 0.22) { this.pathI++; if (this.pathI >= this.path.length) { this.speed = 0; return true; } [tx, tz] = this.path[this.pathI]; dx = tx - this.pos.x; dz = tz - this.pos.z; d = Math.hypot(dx, dz); }
    // slows on unstable gratings
    const f = this.game.col.floorAt(this.pos.x, this.pos.z);
    if (f?.panel?.spec.id === 'D_grate') speed *= MAD.grate;
    const step = Math.min(d, speed * dt);
    this.game.col.move(this.pos, (dx / d) * step, (dz / d) * step, MAD.radius, 'madness');
    this.yaw += THREE.MathUtils.clamp(angDiff(Math.atan2(dx, dz), this.yaw), -7 * dt, 7 * dt);
    this.speed = speed;
    return false;
  }
  _face(x, z, dt, rate = 8) { this.yaw += THREE.MathUtils.clamp(angDiff(Math.atan2(x - this.pos.x, z - this.pos.z), this.yaw), -rate * dt, rate * dt); }

  /** Director helper for authored beats. Returns true on arrival. */
  scriptMove(dt, x, z, speed) { this._pathTo(x, z); this.pathT += dt; if (this.pathT > 0.5) this._pathTo(x, z, true); return this._follow(dt, speed) || Math.hypot(this.pos.x - x, this.pos.z - z) < 0.3; }

  step(dt) {
    if (!this.active) return;
    const g = this.game, p = g.player;
    this.prev.copy(this.pos);
    this.stateT += dt; this.pathT += dt;
    if (this.staggerLock > 0) this.staggerLock -= dt;
    if (this.attackCd > 0) this.attackCd -= dt;
    const st = this.state;

    // losing the floor is as fatal for the hunter as for Mitchell
    if (st !== 'fall' && g.col.floorY(this.pos.x, this.pos.z) === null) {
      if (st === 'scripted' && this.holdOnVoid) { /* the director is staging a near-fall */ }
      else { this.setState('fall'); this.fallV = 0; bus.emit('madness.falling', { x: this.pos.x, z: this.pos.z }); }
    }
    if (this.state === 'fall') {
      this.fallV += 12 * dt; this.pos.y -= this.fallV * dt;
      if (this.stateT > 2.6) { bus.emit('madness.fell', {}); this.despawn(); }
      this._threat(dt, p); return;
    }
    if (st === 'rewound') {
      // replay recent motion backwards (two samples per tick)
      for (let k = 0; k < 2 && this.rewindLeft > 0 && this.histN > 0; k++) {
        this.histI = (this.histI - 1 + HIST) % HIST; this.histN--; this.rewindLeft--;
        this.pos.set(this.hist[this.histI * 3], 0, this.hist[this.histI * 3 + 1]); this.yaw = this.hist[this.histI * 3 + 2];
      }
      if (this.rewindLeft <= 0 || this.histN <= 0) { this.path = null; this.lastKnown = null; this.setState('look'); this.lookFor = 2.5; }
      this._threat(dt, p); return;
    }
    // history for the Watch
    this.hist[this.histI * 3] = this.pos.x; this.hist[this.histI * 3 + 1] = this.pos.z; this.hist[this.histI * 3 + 2] = this.yaw;
    this.histI = (this.histI + 1) % HIST; this.histN = Math.min(HIST, this.histN + 1);

    if (st === 'scripted') { this._threat(dt, p); return; }

    // perception
    const sees = this.canSee(p) || (this.relentless && p.alive);
    if (sees) { this.unseenT = 0; this.lastKnown = { x: p.pos.x, z: p.pos.z }; } else this.unseenT += dt;
    this.sees = sees;
    const dP = Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z);

    switch (this.state) {
      case 'patrol': {
        if (sees) { this.setState('notice'); break; }
        if (!this.patrol.length) { this.speed = 0; break; }
        const [tx, tz] = this.patrol[this.patrolI % this.patrol.length];
        this._pathTo(tx, tz);
        if (this._follow(dt, MAD.walk) || !this.path) { this.patrolI++; this.path = null; }
        break;
      }
      case 'notice':
        this.speed = 0; this._face(p.pos.x, p.pos.z, dt);
        if (this.stateT >= MAD.notice) this.setState('hunt');
        break;
      case 'hunt': {
        if (!p.alive) { this.setState('look'); this.lookFor = 3; break; }
        const hg = g.director.huntGoal(this, p);   // authored detours (e.g. circling the crawl gap)
        if (hg) this._pathTo(hg.x, hg.z);
        else if (this.unseenT < MAD.memory) this._pathTo(p.pos.x, p.pos.z);
        else if (this.lastKnown) this._pathTo(this.lastKnown.x, this.lastKnown.z);
        const arrived = this._follow(dt, MAD.hunt);
        if (sees && dP <= MAD.attackRange && this.attackCd <= 0 && g.col.ray(this.pos.x, this.pos.z, p.pos.x, p.pos.z, 0, 'madness', true) >= 1) { this.setState('windup'); break; }
        if (this.unseenT >= MAD.memory && (arrived || !this.path)) { this.setState('look'); this.lookFor = MAD.loseMin + this.rand() * (MAD.loseMax - MAD.loseMin); }
        break;
      }
      case 'windup':
        this.speed = 0;
        if (this.stateT < MAD.anticipation * 0.6) this._face(p.pos.x, p.pos.z, dt, 5);
        if (this.stateT >= MAD.anticipation) { this.lungeDir = { x: Math.sin(this.yaw), z: Math.cos(this.yaw) }; this.didHit = false; this.setState('lunge'); }
        break;
      case 'lunge': {
        const v = MAD.lungeDist / MAD.lunge;
        g.col.move(this.pos, this.lungeDir.x * v * dt, this.lungeDir.z * v * dt, MAD.radius, 'madness');
        if (!this.didHit && dP < MAD.hitRadius + 0.27 && g.col.ray(this.pos.x, this.pos.z, p.pos.x, p.pos.z, 0, 'madness', true) >= 1) { this.didHit = p.hit(this.pos.x, this.pos.z); }
        if (this.stateT >= MAD.lunge) { this.attackCd = MAD.attackCooldown; this.setState('recover'); bus.emit('madness.attack_end', { hit: this.didHit }); }
        break;
      }
      case 'recover':
        this.speed = 0;
        if (this.stateT >= MAD.recover + (this.didHit ? 1.3 : 0)) this.setState(this.didHit && !p.alive ? 'look' : 'hunt');
        break;
      case 'stagger':
        this.speed = 0;
        if (this.stateT >= (this.staggerFor || 1.5)) this.setState('hunt');
        break;
      case 'shield':
        this.speed = 0;
        if (this.stateT >= 1.0) this.setState('hunt');
        break;
      case 'search': {
        if (sees) { this.setState('notice'); break; }
        if (!this.lastKnown) { this.setState('patrol'); break; }
        this._pathTo(this.lastKnown.x, this.lastKnown.z);
        if (this._follow(dt, MAD.search) || !this.path) { this.setState('look'); this.lookFor = MAD.loseMin + this.rand() * (MAD.loseMax - MAD.loseMin); }
        break;
      }
      case 'look':
        // persists around the last known position, turning to scan, before giving up
        this.speed = 0;
        if (sees) { this.setState('notice'); break; }
        this.yaw += Math.sin(this.stateT * 1.3) * 1.4 * dt;
        if (this.stateT >= this.lookFor) { this.lastKnown = null; this.setState('patrol'); this._nearestPatrol(); bus.emit('madness.lost', {}); }
        break;
    }
    // pressure on tagged surfaces follows pursuit / proximity
    const strength = this.dangerous ? 1 : this.state === 'search' || this.state === 'look' ? 0.55 : 0.28;
    g.fracture.pressFrom(this.pos.x, this.pos.z, this.zone, strength);
    this._threat(dt, p);
  }

  _nearestPatrol() {
    let bi = 0, bd = 1e9;
    this.patrol.forEach(([x, z], i) => { const d = Math.hypot(x - this.pos.x, z - this.pos.z); if (d < bd) { bd = d; bi = i; } });
    this.patrolI = bi;
  }

  _threat(dt, p) {
    const d = Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z);
    let want = 0, stage = 0;
    if (this.active && this.state !== 'fall') {
      const prox = Math.max(0, 1 - d / 16);
      if (this.state === 'windup' || this.state === 'lunge') { want = 1; stage = 3; }
      else if (this.dangerous) { want = 0.75 + prox * 0.25; stage = d < 6 ? 3 : 2; }
      else if (this.state === 'search' || this.state === 'look') { want = 0.4 + prox * 0.3; stage = d < 8 ? 2 : 1; }
      else if (this.state === 'scripted') { want = 0.45; stage = 2; }
      else { want = prox * 0.5; stage = d < 7 ? 2 : d < 14 ? 1 : 0; }
    }
    this.threat += (want - this.threat) * Math.min(1, dt * (want > this.threat ? 3 : 0.45));
    this._stage(stage);
  }
  _stage(s) { if (s !== this.stage) { this.stage = s; bus.emit('madness.threat_changed', { stage: s, threat: this.threat }); } }

  // --- presentation --------------------------------------------------------------------------------
  present(dt, alpha) {
    if (!this.active) { this.game.lights.chest.intensity = 0; return; }
    const c = this.char;
    c.root.position.lerpVectors(this.prev, this.pos, alpha);
    c.root.rotation.y = this.yaw;
    const st = this.state;
    const A = (name, o) => c.play(name, o);
    if (st !== this._animState || this.speed !== this._animSpeed) {
      this._animSpeed = this.speed;
      const changed = st !== this._animState; this._animState = st;
      switch (st) {
        case 'patrol': A(this.speed > 0.1 ? 'stalk' : 'breathe_look', { fade: 0.45, speed: 1.3 }); break;
        case 'search': A(this.speed > 0.1 ? 'stagger' : 'breathe_look', { fade: 0.35, speed: 1.5 }); break;
        case 'look': A('scan', { fade: 0.5 }); break;
        case 'notice': if (changed) A('scream', { fade: 0.15, loop: false, speed: 1.6 }); break;
        case 'hunt': A(this.speed > 0.1 ? 'sprint' : 'breathe_look', { fade: 0.2, speed: this.speed < 2.4 ? 0.62 : 0.86 }); break;
        case 'windup': if (changed) A('charged', { fade: 0.1, loop: false, speed: c.durations.charged / (MAD.anticipation + MAD.lunge + MAD.recover * 0.8) }); break;
        case 'stagger': if (changed) A('hit', { fade: 0.08, loop: false, speed: c.durations.hit / 1.5 }); break;
        case 'shield': if (changed) A('hit', { fade: 0.08, loop: false, speed: 1.5 }); break;
        case 'fall': if (changed) A('fall', { fade: 0.1, loop: false, speed: 1.1 }); break;
        case 'rewound': A('stalk', { fade: 0.1, speed: -2 }); break;
        default: break;
      }
    }
    c.update(dt);
    const L = this.game.lights.chest;
    c.bones.Spine01.getWorldPosition(L.position);
    L.position.x += Math.sin(this.yaw) * 0.35; L.position.z += Math.cos(this.yaw) * 0.35;
    L.intensity = 0.5 + Math.sin(this.game.t * 3.1) * 0.15 + (st === 'windup' ? 2.5 * Math.min(1, this.stateT / MAD.anticipation) : 0);
  }
}
