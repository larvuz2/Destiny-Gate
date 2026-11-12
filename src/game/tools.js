import * as THREE from 'three/webgpu';
import { bus } from '../core/events.js';
import { settings } from '../core/settings.js';

// ToolManager — Wrench, Lantern, Conductor's Watch and plain interaction (GDD 6, 7, 20.1).
export const TOOL = {
  reach: 1.6, swing: 0.5, contact: [0.16, 0.32], staggerTime: 1.5, staggerLock: 5,
  lanternBurn: 4.5, lanternRefill: 9, revealRange: 3, revealTime: 0.55, shieldTime: 1.0,
  watchRadius: 3.5, watchCooldown: 12, watchCast: 0.42, watchRange: 8, noEchoCooldown: 2.2,
};
const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4();

export class ToolManager {
  constructor(game) {
    this.game = game;
    this.has = { wrench: false, lantern: false, watch: false };
    this.reservoir = 1; this.focusing = false; this.focusK = 0; this.depleted = false; this.focusToggle = false;
    this.swingT = -1; this.swingTarget = null; this.swingDone = false;
    this.watchCd = 0; this.castT = -1; this.castTarget = new THREE.Vector3(); this.field = null; this.watchUses = 0;
    this.prompt = null;
    this.lanternPos = new THREE.Vector3(); this.lanternDir = new THREE.Vector3(1, 0, 0);
  }

  buildViews(pb) {
    const scene = this.game.gfx.scene;
    this.wrench = pb.single('wrench', { size: 0.78, fit: 'x' }); this.wrench.visible = false; scene.add(this.wrench);
    this.wrenchSize = this.game.world.props.size('wrench');
    this.lantern = pb.single('lantern', { size: 0.36, fit: 'y' }); this.lantern.visible = false; scene.add(this.lantern);
    this.watch = pb.single('watch', { size: 0.11, fit: 'y' }); this.watch.visible = false; scene.add(this.watch);
    // liquid light core inside the lantern
    this.coreMat = new THREE.MeshBasicNodeMaterial({ color: 0xffd08a, fog: false });
    this.core = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), this.coreMat); this.core.position.y = 0.15; this.lantern.add(this.core);
    this.core.scale.setScalar(1 / this.lantern.scale.x);
  }

  give(tool) { if (this.has[tool]) return; this.has[tool] = true; bus.emit('tool.acquired', { tool }); }
  get watchReady() { return this.has.watch && this.watchCd <= 0 && this.castT < 0; }

  // -------------------------------------------------------------------------------------------------
  _facing(x, z, minDot = 0.2) {
    const p = this.game.player, dx = x - p.pos.x, dz = z - p.pos.z, d = Math.hypot(dx, dz) || 1e-6;
    const cy = this.game.cam.yaw;
    // either the body or the camera may face the target
    const dotCam = (dx * Math.sin(cy) + dz * Math.cos(cy)) / d, dotBody = (dx * Math.sin(p.yaw) + dz * Math.cos(p.yaw)) / d;
    return { d, ok: Math.max(dotCam, dotBody) >= minDot || d < 0.6 };
  }

  _nearest(kind) {
    let best = null, bd = 1e9;
    for (const it of this.game.world.interactables) {
      if (!it.enabled || it.hidden || it.kind !== kind) continue;
      const f = this._facing(it.x, it.z, it.wide ? -1 : 0.15);
      if (f.d <= it.r && f.ok && f.d < bd) { best = it; bd = f.d; }
    }
    return best;
  }

  step(dt) {
    const g = this.game, p = g.player, input = g.input;
    const can = p.controllable;
    if (this.watchCd > 0) this.watchCd = Math.max(0, this.watchCd - dt);

    // --- prompts ---------------------------------------------------------------------------------
    const use = can ? this._nearest('use') : null;
    const wr = can && this.has.wrench ? this._nearest('wrench') : null;
    this.prompt = use ? { action: 'interact', text: use.prompt, it: use } : wr ? { action: 'wrench', text: wr.prompt, it: wr } : null;

    // --- interact (E) ----------------------------------------------------------------------------
    if (can && input.take('interact') && use) { this.reach(use.x, use.y ?? 1.1, use.z, 0.55); bus.emit('player.interact_success', { id: use.id, it: use }); use.onUse?.(use); }

    // --- wrench (LMB) ----------------------------------------------------------------------------
    if (can && this.has.wrench && this.swingT < 0 && !this.focusing && this.castT < 0 && input.take('wrench')) {
      this.swingT = 0; this.swingDone = false; this.swingTarget = wr;
      // mechanisms: a braced pull with the hand brought to the fitting (IK); otherwise a swing
      const mech = !!wr, clip = mech ? 'open_door' : 'swing', dur = mech ? 0.9 : TOOL.swing;
      this.swingDur = dur; this.contactAt = mech ? 0.42 : TOOL.contact[0];
      p.startAction(mech ? 'pull' : 'swing', clip, dur + 0.15, mech ? 1.4 : p.char.durations[clip] / (dur + 0.25));
      if (mech) this.reach(wr.x, wr.y ?? 1.1, wr.z, dur + 0.1);
      if (wr) p.yaw = Math.atan2(wr.x - p.pos.x, wr.z - p.pos.z);
      bus.emit('wrench.swing', { pull: !!wr?.pull });
    } else input.pressed.delete('wrench');
    if (this.swingT >= 0) {
      this.swingT += dt;
      if (!this.swingDone && this.swingT >= this.contactAt) {
        this.swingDone = true;
        const t = this.swingTarget;
        if (t && t.enabled) { bus.emit('wrench.hit', { kind: 'mechanism', id: t.id, x: t.x, z: t.z }); bus.emit('player.interact_success', { id: t.id, it: t }); t.onWrench?.(t); g.noise(t.x, t.z, 11, 'lever'); }
        else if (g.madness?.tryStagger(p, TOOL)) { bus.emit('wrench.hit', { kind: 'madness' }); }
        else {
          // a clank against whatever is near — a deliberate lure when the player wants one
          const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
          const near = g.col.ray(p.pos.x, p.pos.z, p.pos.x + fx * 1.1, p.pos.z + fz * 1.1, 0.6, 'player') < 1;
          bus.emit('wrench.hit', { kind: near ? 'clank' : 'whiff', x: p.pos.x + fx, z: p.pos.z + fz });
          if (near) g.noise(p.pos.x, p.pos.z, 12, 'clank');
        }
      }
      if (this.swingT >= this.swingDur + 0.12) this.swingT = -1;
    }

    // --- lantern (RMB) ---------------------------------------------------------------------------
    let wantFocus = false;
    if (this.has.lantern && can) {
      if (settings.controls.toggleLantern) { if (input.take('lantern')) this.focusToggle = !this.focusToggle; wantFocus = this.focusToggle; }
      else wantFocus = input.held('lantern');
    } else this.focusToggle = false;
    if (this.depleted && this.reservoir > 0.25) this.depleted = false;
    const focusing = wantFocus && !this.depleted && this.swingT < 0 && this.castT < 0;
    if (focusing !== this.focusing) { this.focusing = focusing; bus.emit(focusing ? 'lantern.focus_start' : 'lantern.focus_end'); }
    if (this.focusing) {
      this.reservoir -= dt / TOOL.lanternBurn;
      if (this.reservoir <= 0) { this.reservoir = 0; this.depleted = true; this.focusToggle = false; bus.emit('lantern.depleted'); }
      // reveal hidden mechanisms
      for (const it of g.world.interactables) {
        if (!it.hidden || !it.enabled) continue;
        const f = this._facing(it.x, it.z, 0.72);
        if (f.d <= TOOL.revealRange && f.ok) { it.reveal = (it.reveal || 0) + dt / TOOL.revealTime; if (it.reveal >= 1) { it.hidden = false; bus.emit('lantern.revealed', { id: it.id, it }); it.onReveal?.(it); } }
      }
      g.madness?.lanternOn(p, this.game.cam.yaw, dt);
    } else this.reservoir = Math.min(1, this.reservoir + dt / TOOL.lanternRefill);

    // --- watch (Q) -------------------------------------------------------------------------------
    if (can && this.has.watch && input.take('watch')) {
      if (this.watchCd <= 0 && this.castT < 0 && this.swingT < 0) {
        this.castT = 0; this._aim();
        p.startAction('cast', 'open_door', TOOL.watchCast + 0.35, 1.2);
        bus.emit('watch.cast', { x: this.castTarget.x, z: this.castTarget.z });
      } else if (this.watchCd > 0) bus.emit('watch.denied', { cd: this.watchCd });
    }
    if (this.castT >= 0) {
      this.castT += dt;
      if (this.castT >= TOOL.watchCast) {
        this.castT = -1;
        const t = this.castTarget;
        const hit = g.fracture.rewindAt(t.x, t.z, TOOL.watchRadius);
        const caught = g.madness?.watchCaught(t.x, t.z, TOOL.watchRadius) || false;
        if (hit.length || caught) {
          this.watchCd = TOOL.watchCooldown; this.watchUses++;
          this.field = { x: t.x, y: t.y, z: t.z, t: 0, dur: 2.2, echo: true };
          bus.emit('watch.rewind_start', { x: t.x, z: t.z, panels: hit.map((h) => h.id), first: this.watchUses === 1 });
        } else {
          this.watchCd = TOOL.noEchoCooldown;
          this.field = { x: t.x, y: t.y, z: t.z, t: 0, dur: 0.9, echo: false };
          bus.emit('watch.no_echo', { x: t.x, z: t.z });
        }
      }
    }
    if (this.field) { this.field.t += dt; if (this.field.t >= this.field.dur) { if (this.field.echo) bus.emit('watch.rewind_end', {}); this.field = null; } }
  }

  /** Bring the right hand to a point for a moment (GDD 15.1: hands meet interactables). */
  reach(x, y, z, dur) { this.reachT = 0; this.reachDur = dur; (this.reachTo ||= new THREE.Vector3()).set(x, y, z); }

  /** Target the nearest eligible surface the player is roughly facing; otherwise the floor ahead. */
  _aim() {
    const g = this.game, p = g.player, cy = g.cam.yaw, fx = Math.sin(cy), fz = Math.cos(cy);
    let best = null, bd = 1e9;
    for (const pn of g.fracture.panels) {
      if (!pn.rewindEligible) continue;
      const tx = Math.max(pn.spec.x0, Math.min(p.pos.x, pn.spec.x1)), tz = Math.max(pn.spec.z0, Math.min(p.pos.z, pn.spec.z1));
      const dx = pn.cx - p.pos.x, dz = pn.cz - p.pos.z, d = Math.hypot(tx - p.pos.x, tz - p.pos.z), dl = Math.hypot(dx, dz) || 1;
      if (d <= TOOL.watchRange && (dx * fx + dz * fz) / dl > 0.35 && d < bd) { best = pn; bd = d; }
    }
    if (best) { this.castTarget.set(best.cx, best.spec.y, best.cz); return; }
    const d = THREE.MathUtils.clamp(4.2 - g.cam.pitch * 5, 1.8, 6.5);
    this.castTarget.set(p.pos.x + fx * d, p.pos.y, p.pos.z + fz * d);
  }

  /** Checkpoint restore. */
  restore(has) {
    Object.assign(this.has, has);
    this.reservoir = 1; this.focusing = false; this.depleted = false; this.focusToggle = false; this.swingT = -1; this.castT = -1; this.watchCd = 0; this.field = null;
  }

  // --- presentation: tool meshes follow the hands; IK raises the arm -----------------------------
  present(dt) {
    const g = this.game, p = g.player, c = p.char, L = g.lights;
    const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw), rx = -fz, rz = fx; // body forward / right
    const root = c.root.position;
    this.focusK += ((this.focusing ? 1 : 0) - this.focusK) * Math.min(1, dt * 9);
    const casting = this.castT >= 0 || (this.field && this.field.t < 0.5);
    this.castK = (this.castK || 0) + ((casting ? 1 : 0) - (this.castK || 0)) * Math.min(1, dt * 12);
    g.cam.focus = this.focusK;

    // left arm: lantern raise / watch raise
    const ik = c.ik.left;
    const raise = Math.max(this.focusK, this.castK);
    ik.w = p.state === 'normal' ? raise : 0;
    if (ik.w > 0.001) {
      const cyaw = g.cam.yaw, cfx = Math.sin(cyaw), cfz = Math.cos(cyaw);
      const h = this.castK > this.focusK ? 1.52 : 1.3 - g.cam.pitch * 0.25;
      ik.target.set(root.x + cfx * 0.42 - rx * 0.2, root.y + h, root.z + cfz * 0.42 - rz * 0.2);
      ik.pole.set(-rx * 0.6, -1, -rz * 0.6).normalize();
    }

    // right arm: reach toward the thing being used
    const ikr = c.ik.right;
    if (this.reachDur > 0 && this.reachT < this.reachDur && p.state === 'normal') {
      this.reachT += dt;
      const k = this.reachT / this.reachDur;
      ikr.w = Math.sin(Math.min(1, k) * Math.PI) ** 0.6;
      // stop a little short so the tool, not the wrist, meets the fitting
      _v.copy(this.reachTo).sub(root); const dist = Math.hypot(_v.x, _v.z) || 1; const s2 = Math.max(0, dist - 0.22) / dist;
      ikr.target.set(root.x + _v.x * s2, this.reachTo.y, root.z + _v.z * s2);
      ikr.pole.set(rx * 0.7, -1, rz * 0.7).normalize();
    } else ikr.w = 0;

    // wrench in the right hand
    if (this.wrench) {
      this.wrench.visible = this.has.wrench && p.state !== 'seated' && !g._nearHide;
      if (this.wrench.visible) {
        const hand = c.bones.RightHand;
        hand.getWorldPosition(this.wrench.position); hand.getWorldQuaternion(_q);
        this.wrench.quaternion.copy(_q).multiply(this._wq ||= new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -Math.PI / 2)));
        // grip sits ~30% along the shaft
        _v.set(0, 0.5 * 0.78 - 0.14, 0).applyQuaternion(_q); this.wrench.position.add(_v);
        _v.set(0, -0.02, 0.03).applyQuaternion(_q); this.wrench.position.add(_v);
      }
    }
    // lantern: hangs from the left hand, always upright
    if (this.lantern) {
      const vis = this.has.lantern && p.state !== 'seated';
      this.lantern.children.forEach((ch) => { if (ch !== this.core) ch.visible = !g._nearHide; });
      this.lantern.visible = vis;
      if (vis) {
        const hand = c.bones.LeftHand;
        hand.getWorldPosition(_v);
        const onBelt = this.castK > 0.3;
        if (onBelt) _v.set(root.x - rx * 0.2 - fx * 0.08, root.y + 0.72, root.z - rz * 0.2 - fz * 0.08);
        else _v.y -= 0.36;
        this.lantern.position.lerp(_v, onBelt ? 0.5 : 0.75);
        this.lantern.rotation.y = p.yaw;
        this.lanternPos.copy(this.lantern.position).y += 0.16;
        const cyaw = this.focusK > 0.05 ? g.cam.yaw : p.yaw;
        this.lanternDir.set(Math.sin(cyaw), -0.12 - g.cam.pitch * 0.5 * this.focusK, Math.cos(cyaw)).normalize();
        const flick = 0.92 + 0.08 * Math.sin(g.t * 13.7) * Math.sin(g.t * 7.3);
        const level = 0.35 + 0.65 * this.reservoir;
        L.lanternFill.position.copy(this.lanternPos);
        L.lanternFill.intensity = (2.4 + this.focusK * 1.4) * flick * level;
        L.lantern.position.copy(this.lanternPos);
        L.lantern.target.position.copy(this.lanternPos).addScaledVector(this.lanternDir, 4);
        L.lantern.intensity = this.focusK * 110 * flick * (0.4 + 0.6 * this.reservoir);
        this.core.scale.setScalar((0.55 + 0.45 * this.reservoir) / this.lantern.scale.x * (1 + this.focusK * 0.4));
        this.coreMat.color.setRGB(1.0 * (1 + this.focusK * 3), 0.78 * (1 + this.focusK * 3), 0.5 * (1 + this.focusK * 2));
      } else { L.lanternFill.intensity = 0; L.lantern.intensity = 0; }
    }
    // watch in the raised left hand while casting
    if (this.watch) {
      this.watch.visible = this.has.watch && this.castK > 0.3;
      if (this.watch.visible) { c.bones.LeftHand.getWorldPosition(this.watch.position); this.watch.position.y += 0.06; this.watch.rotation.set(-Math.PI / 2 + 0.4, p.yaw, 0, 'YXZ'); }
    }
  }
}
