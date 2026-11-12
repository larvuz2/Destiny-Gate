import * as THREE from 'three/webgpu';
import {
  instancedDynamicBufferAttribute, instancedBufferAttribute, uv, vec2, vec3, vec4, float, time, sin, cos, fract, smoothstep, length, uniform, mix,
  positionWorld, positionLocal, normalWorld, cameraPosition, normalize, dot, abs, pow, texture,
} from 'three/tsl';
import { bus } from '../core/events.js';
import { settings } from '../core/settings.js';

// VFX stack (GDD 15.3): tied to art direction, pooled, and never part of gameplay.
const MAX = 420;

/** CPU particle pool drawn as one instanced sprite batch. */
class Particles {
  constructor(scene) {
    this.pos = new Float32Array(MAX * 3); this.col = new Float32Array(MAX * 4); this.size = new Float32Array(MAX);
    this.vel = new Float32Array(MAX * 3); this.life = new Float32Array(MAX); this.max = new Float32Array(MAX); this.grav = new Float32Array(MAX); this.drag = new Float32Array(MAX);
    this.base = new Float32Array(MAX * 4); this.grow = new Float32Array(MAX);
    this.n = 0; this.cursor = 0;
    this.aPos = new THREE.InstancedBufferAttribute(this.pos, 3); this.aCol = new THREE.InstancedBufferAttribute(this.col, 4); this.aSize = new THREE.InstancedBufferAttribute(this.size, 1);
    for (const a of [this.aPos, this.aCol, this.aSize]) a.setUsage(THREE.DynamicDrawUsage);
    const m = new THREE.SpriteNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    m.positionNode = instancedDynamicBufferAttribute(this.aPos);
    m.scaleNode = instancedDynamicBufferAttribute(this.aSize);
    const c = instancedDynamicBufferAttribute(this.aCol);
    const d = length(uv().sub(0.5)).mul(2);
    m.colorNode = c.rgb;
    m.opacityNode = c.a.mul(smoothstep(1.0, 0.15, d));
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), m);
    this.mesh.count = MAX; this.mesh.frustumCulled = false; this.mesh.renderOrder = 5;
    scene.add(this.mesh);
  }
  emit(x, y, z, vx, vy, vz, { life = 1, size = 0.1, r = 1, g = 0.9, b = 0.8, a = 0.5, grav = 0, drag = 1, grow = 0 } = {}) {
    const i = this.cursor; this.cursor = (this.cursor + 1) % MAX;
    this.pos.set([x, y, z], i * 3); this.vel.set([vx, vy, vz], i * 3);
    this.base.set([r, g, b, a], i * 4); this.life[i] = life; this.max[i] = life; this.size[i] = size; this.grav[i] = grav; this.drag[i] = drag; this.grow[i] = grow;
  }
  update(dt) {
    const { pos, vel, life, max, col, base, size } = this;
    for (let i = 0; i < MAX; i++) {
      if (life[i] <= 0) { if (col[i * 4 + 3] !== 0) col[i * 4 + 3] = 0; continue; }
      life[i] -= dt;
      const k = Math.max(0, life[i] / max[i]), d = Math.pow(this.drag[i], dt * 60);
      vel[i * 3] *= d; vel[i * 3 + 1] = vel[i * 3 + 1] * d - this.grav[i] * dt; vel[i * 3 + 2] *= d;
      pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      size[i] += this.grow[i] * dt;
      const fade = Math.min(1, k * 2.2) * Math.min(1, (1 - k) * 8);
      col[i * 4] = base[i * 4]; col[i * 4 + 1] = base[i * 4 + 1]; col[i * 4 + 2] = base[i * 4 + 2]; col[i * 4 + 3] = base[i * 4 + 3] * fade;
    }
    this.aPos.needsUpdate = true; this.aCol.needsUpdate = true; this.aSize.needsUpdate = true;
  }
}

export class Vfx {
  constructor(game) {
    this.game = game;
    const scene = game.gfx.scene;
    this.p = new Particles(scene);
    this.density = game.gfx.profile.particles;
    this.dropT = 0;
    this._buildWatchField(scene);
    this._buildMotes(game.world);
    this._wire();
  }

  rnd() { return Math.random(); } // presentation only — never feeds gameplay

  /** Watch field: a pale sphere whose rim marks affected props, and a brass ring that expands. */
  _buildWatchField(scene) {
    this.uField = { k: uniform(0), echo: uniform(1) };
    const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false });
    const view = normalize(cameraPosition.sub(positionWorld));
    const rim = pow(float(1).sub(abs(dot(normalWorld, view))), 2.4);
    const bands = sin(positionLocal.y.mul(26).sub(time.mul(9))).mul(0.5).add(0.5).mul(0.35).add(0.65);
    const col = mix(vec3(0.55, 0.55, 0.6), mix(vec3(0.62, 0.9, 1.0), vec3(1.0, 0.95, 0.8), rim), this.uField.echo);
    m.colorNode = col.mul(pow(rim, 1.6).mul(bands)).mul(this.uField.k).mul(0.38);
    this.field = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 24), m);
    this.field.visible = false; this.field.renderOrder = 6;
    scene.add(this.field);
    const rm = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false });
    rm.colorNode = mix(vec3(0.6, 0.6, 0.62), vec3(1.0, 0.78, 0.42), this.uField.echo).mul(this.uField.k).mul(2.2);
    this.ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.012, 6, 96), rm);
    this.ring.rotation.x = Math.PI / 2; this.ring.visible = false; this.ring.renderOrder = 6;
    scene.add(this.ring);
    // engraved tick marks riding the ring
    this.ring2 = new THREE.Mesh(new THREE.TorusGeometry(1, 0.006, 4, 12), rm);
    this.ring2.rotation.x = Math.PI / 2; this.ring2.visible = false; scene.add(this.ring2);
  }

  /** Dust motes drifting in the warm pools under lamps — GPU animated, one batch per zone. */
  _buildMotes(world) {
    for (const z of world.zones) {
      const lamps = z.lamps.filter((l) => l.kind === 'ceiling' || l.kind === 'hang');
      if (!lamps.length) continue;
      const per = Math.round(26 * this.density), n = lamps.length * per;
      if (!n) continue;
      const base = new Float32Array(n * 3), seed = new Float32Array(n * 4);
      let k = 0;
      for (const l of lamps) for (let i = 0; i < per; i++, k++) {
        const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * (l.kind === 'hang' ? 1.5 : 1.0), h = Math.random();
        base.set([l.pos.x + Math.cos(a) * r, 0.25 + h * (l.pos.y - 0.35), l.pos.z + Math.sin(a) * r * 0.9], k * 3);
        seed.set([Math.random() * 6.28, 0.25 + Math.random() * 0.6, Math.random(), 0.6 + Math.random() * 0.8], k * 4);
      }
      const aB = instancedBufferAttribute(new THREE.InstancedBufferAttribute(base, 3)), aS = instancedBufferAttribute(new THREE.InstancedBufferAttribute(seed, 4));
      const m = new THREE.SpriteNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
      const t = time.mul(aS.y).add(aS.x);
      m.positionNode = aB.add(vec3(sin(t).mul(0.16), sin(t.mul(0.6).add(aS.x)).mul(0.22), cos(t.mul(0.8)).mul(0.14)));
      m.scaleNode = float(0.012).mul(aS.w);
      const d = length(uv().sub(0.5)).mul(2);
      const tw = sin(time.mul(2.3).add(aS.x.mul(7))).mul(0.35).add(0.65);
      m.colorNode = vec3(1.0, 0.86, 0.66);
      m.opacityNode = smoothstep(1, 0.2, d).mul(tw).mul(0.5);
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), m);
      mesh.count = n; mesh.frustumCulled = false; mesh.renderOrder = 4;
      z.group.add(mesh);
    }
  }

  dust(x, y, z, n, { spread = 0.6, up = 0.5, size = 0.35, a = 0.1, life = 1.8, tint = [0.9, 0.82, 0.7] } = {}) {
    n = Math.max(1, Math.round(n * this.density));
    for (let i = 0; i < n; i++) this.p.emit(x + (this.rnd() - 0.5) * spread, y + this.rnd() * 0.15, z + (this.rnd() - 0.5) * spread, (this.rnd() - 0.5) * 0.7, this.rnd() * up, (this.rnd() - 0.5) * 0.7,
      { life: life * (0.6 + this.rnd() * 0.8), size: size * (0.5 + this.rnd() * 0.7), r: tint[0], g: tint[1], b: tint[2], a: a * 0.22, drag: 0.965, grow: 0.25 });
  }
  sparks(x, y, z, n = 10) {
    n = Math.max(2, Math.round(n * this.density));
    for (let i = 0; i < n; i++) this.p.emit(x, y, z, (this.rnd() - 0.5) * 4, this.rnd() * 3, (this.rnd() - 0.5) * 4, { life: 0.25 + this.rnd() * 0.35, size: 0.03, r: 1, g: 0.75, b: 0.35, a: 1, grav: 9, drag: 0.98 });
  }

  _wire() {
    const reduced = () => settings.access.reducedIntensity;
    bus.on('fracture.state_changed', ({ panel, state, prev }) => {
      const s = panel.spec, y = s.y;
      if (state === 1 && prev === 0) this.dust(panel.cx, y + 0.02, panel.cz, 6, { spread: Math.min(2, s.x1 - s.x0), up: 0.25, size: 0.2, a: 0.06 });
      if (state === 2) this.dust(panel.cx, y + 0.03, panel.cz, 14, { spread: Math.min(2.4, s.x1 - s.x0), up: 0.5, size: 0.25, a: 0.08 });
      if (state === 3) { this.dust(panel.cx, y, panel.cz, 46, { spread: Math.max(s.x1 - s.x0, s.z1 - s.z0) * 0.9, up: 1.6, size: 0.6, a: 0.11, life: 2.8 }); if (s.mat === 'grate') this.sparks(panel.cx, y + 0.1, panel.cz, 16); }
    });
    bus.on('fracture.rewind_start', ({ panel }) => {
      for (let i = 0; i < 40 * this.density; i++) this.p.emit(panel.spec.x0 + this.rnd() * (panel.spec.x1 - panel.spec.x0), panel.spec.y - 2 - this.rnd() * 2, panel.spec.z0 + this.rnd() * (panel.spec.z1 - panel.spec.z0), 0, 1.6 + this.rnd() * 1.4, 0, { life: 1.6, size: 0.05, r: 0.66, g: 0.9, b: 1, a: 0.8, drag: 0.99 });
    });
    bus.on('wrench.hit', (e) => { const p = this.game.player; const x = e.x ?? p.pos.x + Math.sin(p.yaw) * 0.8, z = e.z ?? p.pos.z + Math.cos(p.yaw) * 0.8; if (e.kind === 'clank' || e.kind === 'mechanism') this.sparks(x, 1.1, z, e.kind === 'clank' ? 12 : 7); if (e.kind === 'madness') this.dust(x, 1.5, z, 10, { size: 0.3, a: 0.12, tint: [0.8, 0.78, 0.72] }); });
    bus.on('world.bridge_snap', (e) => { this.dust(e.x, 0.1, e.z, 60, { spread: 3, up: 2.2, size: 0.7, a: 0.12, life: 3 }); });
    bus.on('world.gate', (e) => this.sparks(e.x, 1.2, e.z, 20));
    bus.on('trap.triggered', (e) => { this.dust(e.x, 0.2, e.z, 110, { spread: 4.5, up: 3.2, size: 1.1, a: reduced() ? 0.07 : 0.13, life: 4 }); this.sparks(e.x - 2, 0.2, 1.3, 24); this.sparks(e.x + 2, 0.2, -1.3, 24); });
    bus.on('trap.primed', (e) => { this.dust(84, 3.4, 0, 30, { spread: 2.4, up: -0.6, size: 0.4, a: 0.08, life: 2.6 }); this.sparks(e.x, 0.5, e.z, 10); });
    bus.on('madness.stumble', (e) => this.dust(e.x, 0.1, e.z, 26, { spread: 1.6, up: 1.2, size: 0.5 }));
    bus.on('lantern.revealed', ({ it }) => { for (let i = 0; i < 26; i++) this.p.emit(it.x, 1.0 + this.rnd() * 0.5, it.z + (this.rnd() - 0.5) * 0.5, (this.rnd() - 0.5) * 0.4, 0.2 + this.rnd() * 0.5, (this.rnd() - 0.5) * 0.4, { life: 1.2, size: 0.035, r: 1, g: 0.8, b: 0.45, a: 0.9, drag: 0.97 }); });
    bus.on('world.stretch', (e) => this.dust(e.x, 2.3, 0, 22, { spread: 1, up: -0.5, size: 0.3, a: 0.08 }));
  }

  update(dt) {
    const g = this.game, t = g.tools;
    this.p.update(dt);
    // watch field
    const f = t.field, casting = t.castT >= 0;
    if (f || casting) {
      const c = f || { x: t.castTarget.x, y: t.castTarget.y, z: t.castTarget.z, t: 0, dur: 1, echo: true };
      const grow = casting ? 0.12 + (t.castT / 0.42) * 0.2 : Math.min(1, 0.32 + (f.t / 0.35) * 0.68);
      const R = 3.5 * grow, fade = casting ? 0.6 : Math.min(1, (f.dur - f.t) / 0.6) * (f.echo ? 1 : 0.5);
      this.field.visible = this.ring.visible = this.ring2.visible = true;
      this.field.position.set(c.x, c.y + 0.3, c.z); this.field.scale.setScalar(R);
      this.ring.position.set(c.x, c.y + 0.06, c.z); this.ring.scale.setScalar(R);
      this.ring2.position.copy(this.ring.position); this.ring2.scale.setScalar(R * 0.82); this.ring2.rotation.z = -g.t * 2.6;
      this.uField.k.value = fade; this.uField.echo.value = c.echo ? 1 : 0;
    } else if (this.field.visible) this.field.visible = this.ring.visible = this.ring2.visible = false;
    // lantern: droplets of liquid light while focused (GDD 7.2)
    if (t.focusing) {
      this.dropT -= dt;
      if (this.dropT <= 0) { this.dropT = 0.07 / this.density; const l = t.lanternPos; this.p.emit(l.x + (this.rnd() - 0.5) * 0.05, l.y - 0.2, l.z + (this.rnd() - 0.5) * 0.05, (this.rnd() - 0.5) * 0.25, -0.2, (this.rnd() - 0.5) * 0.25, { life: 0.9, size: 0.03, r: 1, g: 0.78, b: 0.4, a: 1, grav: 4.5, drag: 0.99 }); }
    }
    // the hunter sheds dust where it treads on stressed floors
    const m = g.madness;
    if (m.active && m.dangerous && this.rnd() < dt * 6 * this.density) this.dust(m.pos.x, 0.05, m.pos.z, 1, { spread: 0.5, up: 0.3, size: 0.3, a: 0.06 });
  }
}
