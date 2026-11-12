import * as THREE from 'three/webgpu';
import { bus } from '../core/events.js';
import { settings } from '../core/settings.js';

export const TUNE = {
  walk: 2.3, sprint: 4.0, focusWalk: 1.5, accel: 22, turn: 11, radius: 0.27,
  regen: 18, knockTime: 1.15, getupTime: 1.6, hitInvuln: 2.9,
};
const CLIPS = ['idle', 'walk', 'run', 'sit', 'sit_to_stand', 'swing', 'pull', 'hit', 'knockdown', 'getup', 'dead', 'fall', 'open_door', 'alert'];

const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };

// PlayerController owns input intent and Mitchell's simulation state (GDD 4, 20.1).
export class Player {
  static CLIPS = CLIPS;
  constructor(game) {
    this.game = game;
    this.pos = new THREE.Vector3(); this.prev = new THREE.Vector3(); this.vel = new THREE.Vector3();
    this.yaw = Math.PI / 2; this.speed = 0;
    this.state = 'normal'; this.stateT = 0;
    this.damaged = false; this.damageT = 0; this.invuln = 0;
    this.stride = 0; this.sprinting = false; this.sprintToggle = false;
    this.action = null; this.actionT = 0;        // upper-body action (swing / pull / cast)
    this.fallV = 0;
    this.frozen = false;                          // authored beats may hold input briefly
  }

  attach(char) { this.char = char; this.game.gfx.scene.add(char.root); }

  spawn(x, z, yaw = Math.PI / 2, state = 'normal') {
    this.pos.set(x, this.game.col.floorY(x, z) ?? 0, z); this.prev.copy(this.pos); this.vel.set(0, 0, 0);
    this.yaw = yaw; this.state = state; this.stateT = 0; this.speed = 0;
    this.damaged = false; this.damageT = 0; this.invuln = 0; this.action = null; this.fallV = 0; this.frozen = false;
    this.char?.play(state === 'seated' ? 'sit' : 'idle', { fade: 0 });
  }

  setState(s) { this.state = s; this.stateT = 0; }
  get alive() { return this.state !== 'dead' && this.state !== 'falling'; }
  get controllable() { return this.state === 'normal' && !this.frozen; }

  /** Madness connects. First clean hit knocks Mitchell down; a second before recovery is fatal. */
  hit(fromX, fromZ) {
    if (this.invuln > 0 || !this.alive || this.state === 'cinematic') return false;
    if (this.damaged) {
      this.setState('dead'); this.char.play('dead', { loop: false, fade: 0.12 });
      bus.emit('player.dead', { cause: 'madness' });
      return true;
    }
    this.damaged = true; this.damageT = 0; this.invuln = TUNE.hitInvuln;
    this.setState('knocked');
    this.yaw = Math.atan2(fromX - this.pos.x, fromZ - this.pos.z);
    this.char.play('knockdown', { loop: false, fade: 0.08, speed: 1.5 });
    this.action = null;
    bus.emit('player.hurt', {});
    return true;
  }

  startAction(name, clip, dur, speed = 1) {
    this.action = name; this.actionT = 0; this.actionDur = dur;
    this.char.playUpper(clip, { loop: false, fade: 0.08, speed, restart: true });
  }

  step(dt) {
    const g = this.game, input = g.input, col = g.col;
    this.prev.copy(this.pos);
    this.stateT += dt;
    if (this.invuln > 0) this.invuln -= dt;
    if (this.damaged && this.alive) { this.damageT += dt; if (this.damageT >= TUNE.regen) { this.damaged = false; bus.emit('player.recovered'); } }

    // floor check — the only way to fall is to lose the surface underfoot
    const fy = col.floorY(this.pos.x, this.pos.z);
    if (this.alive && this.state !== 'cinematic' && this.state !== 'seated' && fy === null) {
      this.setState('falling'); this.fallV = 0;
      this.char.play('fall', { loop: false, fade: 0.1, speed: 1.4 });
      bus.emit('player.dead', { cause: 'fall' });
    }
    if (this.state === 'falling') { this.fallV += 14 * dt; this.pos.y -= this.fallV * dt; return; }
    if (fy !== null && this.state !== 'seated') this.pos.y += (fy - this.pos.y) * Math.min(1, dt * 20);

    switch (this.state) {
      case 'seated':
        if (!this.frozen && (input.axis().y !== 0 || input.axis().x !== 0 || input.take('interact'))) {
          this.setState('standing'); this.char.play('sit_to_stand', { loop: false, fade: 0.25, speed: 1.25 });
          bus.emit('player.stand');
        }
        return;
      case 'standing': {
        // slide from the seat into the aisle while rising
        const k = Math.min(1, this.stateT / 1.9);
        this.pos.z += (0 - this.pos.z) * Math.min(1, dt * 2.2 * k * 2);
        this.pos.x += 0.28 * dt * (k > 0.35 ? 1 : 0);
        if (this.stateT > 1.9) { this.setState('normal'); this.char.play('idle', { fade: 0.35 }); }
        return;
      }
      case 'knocked':
        if (this.stateT > TUNE.knockTime) { this.setState('getup'); this.char.play('getup', { loop: false, fade: 0.2, speed: this.char.durations.getup / TUNE.getupTime }); }
        return;
      case 'getup':
        if (this.stateT > TUNE.getupTime) { this.setState('normal'); this.char.play('idle', { fade: 0.25 }); }
        return;
      case 'dead': case 'cinematic':
        return;
    }

    // --- locomotion -----------------------------------------------------------------------------
    const ax = this.frozen ? { x: 0, y: 0 } : input.axis();
    const focus = g.tools?.focusing;
    if (settings.controls.toggleSprint) { if (input.take('sprint')) this.sprintToggle = !this.sprintToggle; if (ax.x === 0 && ax.y === 0) this.sprintToggle = false; }
    const wantSprint = !this.frozen && (settings.controls.toggleSprint ? this.sprintToggle : input.held('sprint')) && ax.y > -0.1 && !focus && this.action !== 'pull';
    const max = focus || this.action === 'pull' ? TUNE.focusWalk : wantSprint ? TUNE.sprint : TUNE.walk;
    const cy = g.cam.yaw;
    const fx = Math.sin(cy), fz = Math.cos(cy);
    let wx = (fx * ax.y - fz * ax.x) * max, wz = (fz * ax.y + fx * ax.x) * max;
    if (this.action === 'pull' && this.actionT < this.actionDur) { wx = 0; wz = 0; }
    const dvx = wx - this.vel.x, dvz = wz - this.vel.z, dv = Math.hypot(dvx, dvz), step = TUNE.accel * dt;
    if (dv <= step) { this.vel.x = wx; this.vel.z = wz; } else { this.vel.x += (dvx / dv) * step; this.vel.z += (dvz / dv) * step; }
    const bx = this.pos.x, bz = this.pos.z;
    col.move(this.pos, this.vel.x * dt, this.vel.z * dt, TUNE.radius, 'player');
    const moved = Math.hypot(this.pos.x - bx, this.pos.z - bz);
    this.speed = moved / dt;
    this.sprinting = wantSprint && this.speed > TUNE.walk + 0.3;
    // facing: travel direction, or camera direction while focusing the lantern
    const wantYaw = focus ? cy : this.speed > 0.25 ? Math.atan2(this.vel.x, this.vel.z) : this.yaw;
    this.yaw += THREE.MathUtils.clamp(angDiff(wantYaw, this.yaw), -TUNE.turn * dt, TUNE.turn * dt);
    // footsteps drive both foley and the hunter's hearing
    this.stride += moved;
    const strideLen = this.sprinting ? 1.25 : 0.78;
    if (this.stride >= strideLen) { this.stride = 0; bus.emit('player.footstep', { x: this.pos.x, z: this.pos.z, sprint: this.sprinting, surface: col.floorAt(this.pos.x, this.pos.z)?.surface || 'wood' }); }

    // --- animation ------------------------------------------------------------------------------
    const c = this.char;
    const loco = this.speed < 0.3 ? 'idle' : this.speed > TUNE.walk + 0.5 ? 'run' : 'walk';
    const rate = loco === 'walk' ? THREE.MathUtils.clamp(this.speed / 1.55, 0.6, 1.7) : loco === 'run' ? THREE.MathUtils.clamp(this.speed / 3.7, 0.8, 1.25) : 1;
    c.playLower(loco, { fade: 0.18, speed: rate });
    if (this.action) {
      this.actionT += dt;
      if (this.actionT >= this.actionDur) { this.action = null; c.playUpper(loco, { fade: 0.22, speed: rate }); }
    } else { c.playUpper(loco, { fade: 0.18, speed: rate }); c.syncUpper(); }
  }

  /** Render-rate presentation. */
  present(dt, alpha) {
    const c = this.char;
    c.root.position.lerpVectors(this.prev, this.pos, alpha);
    c.root.rotation.y = this.yaw;
    c.update(dt);
  }
}
