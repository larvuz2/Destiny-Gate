import * as THREE from 'three/webgpu';
import { texture, uv, uniform, vec2, vec3, float, mix, smoothstep } from 'three/tsl';
import { Builder } from './kit.js';
import { PropBatch } from './props.js';
import { makeEnv, ENV_SPECS } from '../gfx/env.js';
import { buildCoachA } from './zones/coachA.js';

// World container: zones own their render groups; gameplay data (colliders, floor panels, lamps,
// interactables, nav hints) is registered into flat lists the simulation reads.
export class World {
  constructor({ gfx, mats, props, lights }) {
    this.gfx = gfx; this.mats = mats; this.props = props; this.lights = lights;
    this.root = new THREE.Group();
    gfx.scene.add(this.root);
    this.zones = [];
    this.walls = [];        // { x0, x1, z0, z1, h, enabled, tag }
    this.floors = [];       // walkable rects { x0, x1, z0, z1, y }
    this.panels = [];       // fracture panel specs (consumed by FractureController)
    this.interactables = [];
    this.markers = {};      // named points: spawn, checkpoints, AI nodes…
    this.dynamic = [];      // objects needing per-frame update: { update(dt, t) }
    this.uniforms = { scroll: uniform(0), time: uniform(0) };
    this.tex = {};
  }

  async loadShared() {
    const L = new THREE.TextureLoader();
    const load = (name, srgb = true, repeat = false) => L.loadAsync(`assets/img/${name}.webp`).then((t) => {
      t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = 4;
      this.tex[name] = t;
    });
    await Promise.all([load('exterior', true, true), load('grime', false, true), load('station'), load('photo'), load('ticket'), load('order')]);
  }

  /** Shared window glass: grime + frost over a faint cold reflection. `frost` grows in nightmare zones. */
  glassMaterial(frost = 0.25) {
    const m = new THREE.MeshStandardNodeMaterial({ transparent: true, roughness: 0.08, metalness: 0, depthWrite: false });
    const g = texture(this.tex.grime, uv()).r;
    const dirt = smoothstep(0.05, 0.9, g).mul(frost * 2.2).clamp(0, 1);
    m.colorNode = mix(vec3(0.02, 0.03, 0.04), vec3(0.62, 0.7, 0.78), dirt);
    m.opacityNode = float(0.10).add(dirt.mul(0.85)).clamp(0, 1);
    m.name = 'glass';
    return m;
  }

  /** Night landscape strip sliding past the windows. */
  exteriorMaterial(brightness = 0.55) {
    const m = new THREE.MeshBasicNodeMaterial({ fog: false });
    const t = texture(this.tex.exterior, vec2(uv().x.add(this.uniforms.scroll), uv().y));
    m.colorNode = t.rgb.mul(brightness);
    m.name = 'exterior';
    return m;
  }

  zone(id, x0, x1, envKey) {
    const z = {
      id, x0, x1, group: new THREE.Group(), b: new Builder(), pb: new PropBatch(this.props),
      env: makeEnv(this.gfx.renderer, ENV_SPECS[envKey]), lamps: [],
    };
    z.group.name = 'zone:' + id;
    this.zones.push(z);
    this.root.add(z.group);
    return z;
  }

  finishZone(z) {
    z.group.add(z.b.build((k) => this.mats.get(k), { name: z.id }));
    z.group.add(z.pb.build(z.id + ':props'));
    z.group.traverse((o) => { if (o.isMesh && !o.matrixAutoUpdate) o.updateMatrix(); });
  }

  wall(x0, x1, z0, z1, opts = {}) {
    const w = { x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1), h: 3, enabled: true, ...opts };
    this.walls.push(w);
    return w;
  }
  floor(x0, x1, z0, z1, y = 0, opts = {}) {
    const f = { x0, x1, z0, z1, y, enabled: true, ...opts };
    this.floors.push(f);
    return f;
  }

  build() {
    buildCoachA(this);
  }

  zoneAt(x) { return this.zones.find((z) => x >= z.x0 && x < z.x1) || (x < this.zones[0].x0 ? this.zones[0] : this.zones.at(-1)); }

  /** Show only the current zone and its neighbours; swap IBL. */
  setActiveZone(z) {
    if (this.active === z) return;
    this.active = z;
    const i = this.zones.indexOf(z);
    this.zones.forEach((o, k) => { o.group.visible = Math.abs(k - i) <= 1; });
    this.gfx.scene.environment = z.env;
  }

  update(dt, t) {
    this.uniforms.time.value = t;
    for (const d of this.dynamic) d.update(dt, t);
  }
}
