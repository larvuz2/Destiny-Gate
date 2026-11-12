import * as THREE from 'three/webgpu';
import { texture, uv, uniform, vec2, vec3, float, mix, smoothstep } from 'three/tsl';
import { Builder } from './kit.js';
import { PropBatch } from './props.js';
import { makeEnv, ENV_SPECS } from '../gfx/env.js';
import { buildCoachA } from './zones/coachA.js';
import { buildCoachB } from './zones/coachB.js';
import { buildCoachC } from './zones/coachC.js';
import { buildCoachD } from './zones/coachD.js';
import { buildStation } from './zones/station.js';

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
    this.markers = {};
    this.doors = {};      // named points: spawn, checkpoints, AI nodes…
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
    m.colorNode = mix(vec3(0.02, 0.03, 0.04), vec3(0.5, 0.58, 0.66), dirt);
    m.opacityNode = float(0.10).add(dirt.mul(0.85)).add(frost > 0.5 ? 0.35 : 0).clamp(0, 1);
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

  glass(key, frost) { return (this._glass ||= {})[key] ||= this.glassMaterial(frost); }
  exterior(brightness) { return (this._ext ||= {})[brightness] ||= this.exteriorMaterial(brightness); }

  build() {
    buildCoachA(this);
    buildCoachB(this);
    buildCoachC(this);
    buildCoachD(this);
    buildStation(this);
  }

  /** Hinged door built from the generated door prop. Opening is along Z, wall plane at x. */
  door(z, id, x, { z0 = -0.44, z1 = 0.44, h = 2.02, open = 0, locked = false, swing = 1, hinge = -1, tintless = false } = {}) {
    const pivot = new THREE.Group();
    const leaf = z.pb.single('door', { size: h, fit: 'y' });
    const w = z1 - z0, sz = leaf.userData.size;
    leaf.scale.x *= w / sz.x;              // fit the opening width exactly
    leaf.rotation.y = Math.PI / 2;         // prop faces +Z → make the leaf span Z
    leaf.position.set(0, 0, hinge < 0 ? w / 2 : -w / 2);
    pivot.add(leaf);
    pivot.position.set(x, 0, hinge < 0 ? z0 : z1);
    z.group.add(pivot);
    const wall = this.wall(x - 0.08, x + 0.08, z0, z1, { tag: 'door:' + id });
    const d = { id, x, z: (z0 + z1) / 2, pivot, wall, open, target: open, locked, swing: swing * (hinge < 0 ? 1 : -1), zone: z.id };
    const apply = () => { pivot.rotation.y = d.open * 1.75 * d.swing; const en = d.open < 0.5; if (wall.enabled !== en) { wall.enabled = en; this.navDirty = true; } };
    apply();
    this.doors[id] = d;
    this.dynamic.push({ update: (dt) => { if (Math.abs(d.target - d.open) > 0.001) { d.open += Math.sign(d.target - d.open) * Math.min(Math.abs(d.target - d.open), dt * (d.speed || 1.6)); apply(); } } });
    return d;
  }

  /** Register an interaction point. kind: 'use' (E) | 'wrench' (LMB with wrench). */
  interact(spec) {
    const it = { r: 1.3, kind: 'use', enabled: true, hidden: false, prompt: '', ...spec };
    this.interactables.push(it);
    return it;
  }

  /** Register a fracture panel (visuals are built by the FractureController). */
  panel(spec) {
    const p = { y: 0, thickness: 0.09, mat: 'plank', frags: 14, zone: null, state: 0, rewindable: true, autoFail: true, ...spec };
    this.panels.push(p);
    return p;
  }

  zoneAt(x) { return this.zones.find((z) => x >= z.x0 && x < z.x1) || (x < this.zones[0].x0 ? this.zones[0] : this.zones.at(-1)); }

  /** Show the current zone, plus a neighbour only when the player is close to the shared doorway. */
  setActiveZone(z, x = null) {
    const i = this.zones.indexOf(z);
    this.zones.forEach((o, k) => {
      let vis = k === i;
      if (Math.abs(k - i) === 1 && x !== null) vis = Math.abs(x - (k > i ? z.x1 : z.x0)) < (o.id === 'S' ? 40 : 11);
      o.group.visible = vis;
    });
    if (this.active === z) return;
    this.active = z;
    this.gfx.scene.environment = z.env;
  }

  update(dt, t) {
    this.uniforms.time.value = t;
    for (const d of this.dynamic) d.update(dt, t);
  }
}
