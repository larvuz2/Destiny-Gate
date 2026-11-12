import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const UPPER = /^(Spine|Spine01|Spine02|neck|Head|LeftShoulder|LeftArm|LeftForeArm|LeftHand|RightShoulder|RightArm|RightForeArm|RightHand)\./;
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _t = new THREE.Vector3();
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _ax = new THREE.Vector3();
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _pq = new THREE.Quaternion();

/**
 * Skinned character with two animation layers (lower body / upper body) so tool actions can play
 * over locomotion, plus analytic two-bone arm IK for holding tools and reaching interactables.
 */
export class Character {
  static async load(name, clipNames, { height, onProgress } = {}) {
    const base = await loader.loadAsync(`assets/chars/${name}.glb`);
    const c = new Character();
    c.name = name;
    c.root = new THREE.Group();
    c.model = base.scene;
    c.root.add(c.model);
    c.model.traverse((o) => {
      if (o.isSkinnedMesh || o.isMesh) {
        o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
        const src = o.material;
        const m = new THREE.MeshStandardNodeMaterial({ map: src.map, normalMap: src.normalMap, roughnessMap: src.roughnessMap, metalnessMap: src.metalnessMap, roughness: src.roughness, metalness: src.metalness });
        if (m.map) m.map.anisotropy = 8;
        c.material = m; o.material = m; c.mesh = o;
      }
    });
    c.bones = {};
    c.model.traverse((o) => { if (o.isBone) c.bones[o.name] = o; });
    // normalise height
    c.model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(c.model);
    if (height) c.model.scale.multiplyScalar(height / (box.max.y - box.min.y));
    c.mixer = new THREE.AnimationMixer(c.model);
    c.lower = {}; c.upper = {}; c.durations = {};
    let n = 0;
    await Promise.all(clipNames.map(async (cn) => {
      const g = await loader.loadAsync(`assets/chars/${name}.${cn}.glb`);
      const clip = g.animations[0];
      // keep characters in place: gameplay owns translation
      for (const t of clip.tracks) {
        if (t.name === 'Hips.position') for (let i = 0; i < t.values.length; i += 3) { t.values[i] = 0; t.values[i + 2] = 0; }
      }
      clip.tracks = clip.tracks.filter((t) => !t.name.endsWith('.scale') && (t.name.startsWith('Hips.') || !t.name.endsWith('.position')));
      const up = new THREE.AnimationClip(cn + ':u', clip.duration, clip.tracks.filter((t) => UPPER.test(t.name)));
      const lo = new THREE.AnimationClip(cn + ':l', clip.duration, clip.tracks.filter((t) => !UPPER.test(t.name)));
      c.lower[cn] = c.mixer.clipAction(lo); c.upper[cn] = c.mixer.clipAction(up);
      c.durations[cn] = clip.duration;
      onProgress?.(++n / clipNames.length);
    }));
    c.cur = { lower: null, upper: null };
    c.ik = { left: { w: 0, target: new THREE.Vector3(), pole: new THREE.Vector3(0, -1, 0) }, right: { w: 0, target: new THREE.Vector3(), pole: new THREE.Vector3(0, -1, 0) } };
    return c;
  }

  _set(layer, name, { fade = 0.2, loop = true, speed = 1, restart = false, at = 0 } = {}) {
    const set = this[layer];
    const next = set[name];
    if (!next) return;
    const prev = this.cur[layer];
    next.timeScale = speed;
    if (prev === next && !restart) return;
    next.enabled = true;
    next.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    next.clampWhenFinished = !loop;
    if (prev !== next || restart) { next.reset(); if (at) next.time = at; }
    next.setEffectiveWeight(1);
    if (prev && prev !== next) next.crossFadeFrom(prev, fade, false); else next.fadeIn(prev ? 0 : fade);
    next.play();
    this.cur[layer] = next;
    this.cur[layer + 'Name'] = name;
  }

  /** Full-body clip. */
  play(name, opts) { this._set('lower', name, opts); this._set('upper', name, opts); }
  playLower(name, opts) { this._set('lower', name, opts); }
  playUpper(name, opts) { this._set('upper', name, opts); }
  time(layer = 'lower') { return this.cur[layer]?.time ?? 0; }
  /** Sync upper layer phase to lower (locomotion). */
  syncUpper() { if (this.cur.upper && this.cur.lower && this.cur.upperName === this.cur.lowerName) this.cur.upper.time = this.cur.lower.time; }

  update(dt) {
    this.mixer.update(dt);
    for (const side of ['left', 'right']) if (this.ik[side].w > 0.001) this._solveArm(side);
  }

  /** Analytic two-bone IK: bend the elbow to the required reach, then aim the upper arm. */
  _solveArm(side) {
    const P = side === 'left' ? 'Left' : 'Right';
    const upper = this.bones[P + 'Arm'], fore = this.bones[P + 'ForeArm'], hand = this.bones[P + 'Hand'];
    const { w, target, pole } = this.ik[side];
    upper.parent.updateWorldMatrix(true, false);
    upper.updateWorldMatrix(false, true);
    upper.getWorldPosition(_a); fore.getWorldPosition(_b); hand.getWorldPosition(_c);
    const lab = _a.distanceTo(_b), lcb = _b.distanceTo(_c);
    _t.copy(target);
    const reach = Math.min(_a.distanceTo(_t), (lab + lcb) * 0.999);
    // 1) elbow angle
    const cur = Math.acos(THREE.MathUtils.clamp(_v1.subVectors(_a, _b).normalize().dot(_v2.subVectors(_c, _b).normalize()), -1, 1));
    const want = Math.acos(THREE.MathUtils.clamp((lab * lab + lcb * lcb - reach * reach) / (2 * lab * lcb), -1, 1));
    _ax.crossVectors(_v1.subVectors(_b, _a), _v2.subVectors(_c, _b));
    if (_ax.lengthSq() < 1e-8) _ax.crossVectors(_v1, pole);
    _ax.normalize();
    const qForeOld = fore.quaternion.clone(), qUpperOld = upper.quaternion.clone();
    this._rotateWorld(fore, _ax, cur - want);
    // 2) aim
    upper.updateWorldMatrix(false, true);
    hand.getWorldPosition(_c);
    _v1.subVectors(_c, _a).normalize(); _v2.subVectors(_t, _a).normalize();
    _q.setFromUnitVectors(_v1, _v2);
    upper.parent.getWorldQuaternion(_pq);
    upper.getWorldQuaternion(_q2);
    _q2.premultiply(_q);
    upper.quaternion.copy(_pq.invert().multiply(_q2));
    // 3) swing the elbow toward the pole around the shoulder→target axis
    upper.updateWorldMatrix(false, true);
    fore.getWorldPosition(_b);
    _v1.subVectors(_b, _a); _ax.copy(_v2);
    _v1.addScaledVector(_ax, -_v1.dot(_ax));
    _c.copy(pole).addScaledVector(_ax, -pole.dot(_ax));
    if (_v1.lengthSq() > 1e-6 && _c.lengthSq() > 1e-6) {
      _v1.normalize(); _c.normalize();
      let ang = Math.acos(THREE.MathUtils.clamp(_v1.dot(_c), -1, 1));
      if (_t.crossVectors(_v1, _c).dot(_ax) < 0) ang = -ang;
      this._rotateWorld(upper, _ax, ang);
    }
    if (w < 0.999) { upper.quaternion.slerpQuaternions(qUpperOld, upper.quaternion.clone(), w); fore.quaternion.slerpQuaternions(qForeOld, fore.quaternion.clone(), w); }
    upper.updateWorldMatrix(false, true);
  }

  _rotateWorld(bone, axis, angle) {
    bone.parent.getWorldQuaternion(_pq);
    bone.getWorldQuaternion(_q2);
    _q.setFromAxisAngle(axis, angle);
    _q2.premultiply(_q);
    bone.quaternion.copy(_pq.invert().multiply(_q2));
  }
}
