import * as THREE from 'three/webgpu';

// Fixed light budget (GDD 13.3): the shader always sees the same set of lights, so nothing
// recompiles mid-chase. Authored lamp fixtures are virtual; a small pool of real point lights is
// handed to the fixtures nearest the camera, cross-faded to hide reassignment.
const POOL = 6;
const _v = new THREE.Vector3();

export class LightRig {
  constructor(gfx) {
    this.gfx = gfx;
    const scene = gfx.scene;
    this.lamps = [];          // { id, pos, color, intensity, range, level, zone, mesh, mat, flicker }
    this.hemi = new THREE.HemisphereLight(0x9aa6bd, 0x3a2a1c, 0.55);
    scene.add(this.hemi);

    this.pool = [];
    for (let i = 0; i < POOL; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 8, 1.6);
      l.userData = { lamp: null, k: 0 };
      scene.add(l);
      this.pool.push(l);
    }

    // Shadow-casting key: rides above the player like the nearest ceiling fixture.
    this.key = new THREE.SpotLight(0xffd9a8, 0, 9, 1.05, 0.9, 1.4);
    this.key.castShadow = true;
    this.key.shadow.bias = -0.0006;
    this.key.shadow.normalBias = 0.02;
    this.key.shadow.camera.near = 0.3;
    this.key.shadow.camera.far = 9;
    scene.add(this.key, this.key.target);

    // Lantern (player) spot and Madness chest glow.
    this.lantern = new THREE.SpotLight(0xffc477, 0, 9, 0.6, 0.7, 1.3);
    this.lantern.shadow.bias = -0.0008;
    this.lantern.shadow.normalBias = 0.02;
    this.lantern.shadow.camera.near = 0.15;
    this.lantern.shadow.camera.far = 9;
    scene.add(this.lantern, this.lantern.target);
    this.lanternFill = new THREE.PointLight(0xffb866, 0, 4.5, 1.8);
    scene.add(this.lanternFill);
    this.chest = new THREE.PointLight(0xcfe4ff, 0, 5, 1.8);
    scene.add(this.chest);

    this.keySpec = { color: new THREE.Color(0xffd9a8), intensity: 30, height: 2.55, lead: 0.25 };
    this.setProfile(gfx.profile);
    this.t = 0;
  }

  setProfile(p) {
    this.key.shadow.mapSize.set(p.shadow, p.shadow);
    this.key.shadow.map?.dispose(); this.key.shadow.map = null;
    this.lantern.castShadow = !!p.lanternShadow;
    this.lantern.shadow.mapSize.set(1024, 1024);
  }

  addLamp(spec) {
    const lamp = { color: new THREE.Color(0xffc98a), intensity: 14, range: 7, level: 1, target: 1, flicker: 0, zone: null, mesh: null, emissive: 6, on: true, ...spec };
    lamp.pos = new THREE.Vector3(...spec.pos);
    if (!(lamp.color instanceof THREE.Color)) lamp.color = new THREE.Color(lamp.color);
    lamp.seed = this.lamps.length * 12.9898;
    this.lamps.push(lamp);
    return lamp;
  }

  /** focus: world position the budget is centred on (camera target). */
  update(dt, focus, zoneFilter) {
    this.t += dt;
    // 1) per-lamp level (threat flicker is written into lamp.flicker by the director)
    for (const l of this.lamps) {
      let lv = l.on ? l.target : 0;
      if (l.flicker > 0) {
        const n = Math.sin(this.t * 31 + l.seed) * Math.sin(this.t * 17.3 + l.seed * 2.1) + Math.sin(this.t * 7.1 + l.seed);
        lv *= 1 - l.flicker * (0.35 + 0.65 * (n > 0.4 ? 1 : n < -1.1 ? 0.9 : 0.15));
      }
      l.level += (lv - l.level) * Math.min(1, dt * 18);
      if (l.mat) l.mat.emissiveIntensity = l.emissive * l.level;
    }
    // 2) pick nearest lamps
    const cand = this.lamps.filter((l) => !zoneFilter || zoneFilter(l));
    for (const l of cand) l._d = l.pos.distanceToSquared(focus) - (l.priority || 0);
    cand.sort((a, b) => a._d - b._d);
    const want = cand.slice(0, POOL);
    // release pool entries whose lamp is no longer wanted (fade out first)
    for (const p of this.pool) {
      const keep = p.userData.lamp && want.includes(p.userData.lamp);
      p.userData.k += ((keep ? 1 : 0) - p.userData.k) * Math.min(1, dt * 6);
      if (!keep && p.userData.k < 0.02) p.userData.lamp = null;
    }
    for (const l of want) {
      if (this.pool.some((p) => p.userData.lamp === l)) continue;
      const free = this.pool.find((p) => !p.userData.lamp);
      if (free) { free.userData.lamp = l; free.userData.k = 0; }
    }
    for (const p of this.pool) {
      const l = p.userData.lamp;
      if (!l) { p.intensity = 0; continue; }
      p.position.copy(l.pos);
      p.color.copy(l.color);
      p.distance = l.range;
      p.intensity = l.intensity * l.level * p.userData.k;
    }
  }

  /** Key light follows the subject; `level` lets threat stages dim it. */
  updateKey(dt, subject, forwardX = 1, level = 1, fixed = null) {
    const s = this.keySpec, k = this.key;
    if (fixed) {
      // authored hero rig (Coach D, threshold): a stationary overhead key
      k.position.set(...fixed.pos); k.target.position.set(...fixed.target);
      k.color.set(fixed.color); k.angle = fixed.angle; k.distance = fixed.distance;
      k.shadow.camera.far = fixed.distance;
      k.intensity += (fixed.intensity * level - k.intensity) * Math.min(1, dt * 10);
      return;
    }
    k.angle = 1.05; k.distance = 9; k.shadow.camera.far = 9;
    _v.set(subject.x - forwardX * s.lead, Math.min(s.height, (this.ceiling || 3) - 0.2), subject.z * 0.35);
    k.position.lerp(_v, Math.min(1, dt * 4));
    k.target.position.set(subject.x + forwardX * 0.2, 0.6, subject.z);
    k.color.copy(s.color);
    k.intensity += (s.intensity * level - k.intensity) * Math.min(1, dt * 10);
  }
}
