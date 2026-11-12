import * as THREE from 'three/webgpu';
import { settings } from '../core/settings.js';

const _target = new THREE.Vector3(), _desired = new THREE.Vector3(), _dir = new THREE.Vector3();

// Over-the-right-shoulder spring arm (GDD 4.3): collision shortens the arm smoothly instead of
// cutting to first person; shake is additive and respects the reduced-motion setting.
export class FollowCamera {
  constructor(camera, collision) {
    this.camera = camera; this.col = collision;
    this.yaw = Math.PI / 2;      // looking along +X
    this.pitch = 0.06;
    this.arm = 2.2; this.armNow = 2.2;
    this.shoulder = 0.42; this.height = 1.52;
    this.fov = 46; this.fovNow = 46;
    this.shake = 0; this.shakeT = 0;
    this.ceiling = () => 2.5;
    this.pos = new THREE.Vector3(); this.look = new THREE.Vector3();
    this.override = null;        // { pos, look, k } for authored framing blends
    this.focus = 0;              // 0..1 lantern focus tightening
    this.inited = false;
  }

  /** Forward direction on the ground plane. */
  forward(out = new THREE.Vector3()) { return out.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)); }

  addLook(dx, dy) {
    const s = 0.0023 * settings.controls.sensitivity;
    this.yaw -= dx * s;
    this.pitch = THREE.MathUtils.clamp(this.pitch + dy * s * (settings.controls.invertY ? -1 : 1), -0.75, 0.95);
  }

  kick(amount) { if (!settings.access.reducedMotion) this.shake = Math.min(1, this.shake + amount); }

  update(dt, subject, { snap = false } = {}) {
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    const rx = -fz, rz = fx; // right vector
    const sh = this.shoulder * (1 - this.focus * 0.25);
    const arm = this.arm * (1 - this.focus * 0.28);
    _target.set(subject.x + rx * sh, subject.y + this.height, subject.z + rz * sh);
    // keep the pivot itself out of walls
    const tp = this.col.ray(subject.x, subject.z, _target.x, _target.z, 1.2, 'camera');
    if (tp < 1) { _target.x = subject.x + rx * sh * Math.max(0, tp - 0.25); _target.z = subject.z + rz * sh * Math.max(0, tp - 0.25); }
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    _dir.set(-fx * cp, sp, -fz * cp);
    // horizontal wall probe, plus two whiskers so the camera does not graze corners
    let t = 1;
    for (const off of [0, 0.22, -0.22]) {
      const ex = _target.x + _dir.x * arm + rx * off, ez = _target.z + _dir.z * arm + rz * off;
      t = Math.min(t, this.col.ray(_target.x, _target.z, ex, ez, 1.2, 'camera'));
    }
    let want = Math.max(0.35, arm * t - 0.18);
    // ceiling / floor
    const ceil = this.ceiling(_target.x + _dir.x * want, _target.z + _dir.z * want) - 0.14;
    if (_dir.y > 0.01) want = Math.min(want, Math.max(0.35, (ceil - _target.y) / _dir.y));
    if (_dir.y < -0.01) want = Math.min(want, Math.max(0.35, (0.25 - _target.y) / _dir.y));
    const k = snap || !this.inited ? 1 : Math.min(1, dt * (want < this.armNow ? 18 : 3.5));
    this.armNow += (want - this.armNow) * k;
    _desired.copy(_target).addScaledVector(_dir, this.armNow);
    this.pos.copy(_desired);
    this.look.copy(_target).addScaledVector(_dir, -6);
    if (this.override) {
      const o = this.override;
      this.pos.lerp(o.pos, o.k); this.look.lerp(o.look, o.k);
    }
    this.camera.position.copy(this.pos);
    if (this.shake > 0.001) {
      this.shakeT += dt * 38;
      const a = this.shake * this.shake * 0.05;
      this.camera.position.x += Math.sin(this.shakeT * 1.3) * a; this.camera.position.y += Math.sin(this.shakeT * 1.7 + 1) * a; this.camera.position.z += Math.sin(this.shakeT * 2.1 + 2) * a;
      this.shake = Math.max(0, this.shake - dt * 1.8);
    }
    this.camera.lookAt(this.look);
    const fov = this.fov - this.focus * 5;
    this.fovNow += (fov - this.fovNow) * Math.min(1, dt * 5);
    if (Math.abs(this.camera.fov - this.fovNow) > 0.01) { this.camera.fov = this.fovNow; this.camera.updateProjectionMatrix(); }
    this.inited = true;
  }
}
