import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

// Generated hero props. Each GLB is normalised at load (pivot at bottom-centre, unit bounding box
// recorded) and drawn through InstancedMesh so repeated fittings cost one draw call per zone.
const _box = new THREE.Box3();
const _v = new THREE.Vector3();

export class PropLibrary {
  constructor(gfx) {
    this.gfx = gfx;
    this.loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    this.defs = new Map();
  }

  async load(names, onProgress) {
    let n = 0;
    await Promise.all(names.map(async (name) => {
      try {
        const gltf = await this.loader.loadAsync(`assets/props/${name}.glb`);
        const parts = [];
        gltf.scene.updateMatrixWorld(true);
        gltf.scene.traverse((o) => {
          if (!o.isMesh) return;
          // Quantised (int16) attributes must be expanded before baking the node transform.
          const g = new THREE.BufferGeometry();
          for (const k of ['position', 'normal', 'uv']) {
            const a = o.geometry.attributes[k];
            if (!a) continue;
            const out = new Float32Array(a.count * a.itemSize);
            for (let i = 0; i < a.count; i++) for (let c = 0; c < a.itemSize; c++) out[i * a.itemSize + c] = a.getComponent(i, c);
            g.setAttribute(k, new THREE.BufferAttribute(out, a.itemSize));
          }
          g.setIndex(o.geometry.index);
          g.applyMatrix4(o.matrixWorld);
          const src = o.material;
          const m = new THREE.MeshStandardNodeMaterial({
            map: src.map, normalMap: src.normalMap, roughnessMap: src.roughnessMap, metalnessMap: src.metalnessMap,
            roughness: src.roughness, metalness: src.metalness, color: src.color,
          });
          for (const t of [m.map, m.normalMap, m.roughnessMap]) if (t) t.anisotropy = this.gfx.profile.aniso;
          m.name = 'prop:' + name;
          parts.push({ geometry: g, material: m });
        });
        _box.makeEmpty();
        for (const p of parts) { p.geometry.computeBoundingBox(); _box.union(p.geometry.boundingBox); }
        const size = _box.getSize(new THREE.Vector3());
        const c = _box.getCenter(_v);
        for (const p of parts) p.geometry.translate(-c.x, -_box.min.y, -c.z);
        this.defs.set(name, { parts, size });
      } catch (e) {
        console.warn('prop missing', name, e.message);
      }
      onProgress?.(++n / names.length);
    }));
  }

  has(name) { return this.defs.has(name); }
  size(name) { return this.defs.get(name)?.size; }
}

/** Collects placements for one zone and emits InstancedMeshes. */
export class PropBatch {
  constructor(lib) { this.lib = lib; this.items = new Map(); }

  /**
   * fit: which bbox axis `size` refers to ('x' | 'y' | 'z'); the prop is scaled uniformly.
   * ry: yaw in radians. tint: optional per-instance colour multiplier.
   */
  place(name, x, y, z, { size = 1, fit = 'y', ry = 0, rx = 0, rz = 0, stretch = null, tint = null } = {}) {
    const def = this.lib.defs.get(name);
    if (!def) return null;
    const s = size / def.size[fit];
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')),
      stretch ? new THREE.Vector3(s * stretch[0], s * stretch[1], s * stretch[2]) : new THREE.Vector3(s, s, s),
    );
    if (!this.items.has(name)) this.items.set(name, []);
    this.items.get(name).push({ m, tint });
    return { scale: s, size: def.size.clone().multiplyScalar(s) };
  }

  build(name = 'props') {
    const group = new THREE.Group();
    group.name = name;
    for (const [key, list] of this.items) {
      const def = this.lib.defs.get(key);
      for (const part of def.parts) {
        const mesh = new THREE.InstancedMesh(part.geometry, part.material, list.length);
        list.forEach((it, i) => {
          mesh.setMatrixAt(i, it.m);
          if (it.tint) mesh.setColorAt(i, it.tint);
        });
        mesh.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingSphere();
        mesh.castShadow = mesh.receiveShadow = true;
        mesh.name = `${name}:${key}`;
        group.add(mesh);
      }
    }
    return group;
  }

  /** Standalone (non-instanced) object for animated / interactive props. */
  single(name, { size = 1, fit = 'y' } = {}) {
    const def = this.lib.defs.get(name);
    const g = new THREE.Group();
    if (!def) return g;
    const s = size / def.size[fit];
    for (const part of def.parts) {
      const mesh = new THREE.Mesh(part.geometry, part.material);
      mesh.castShadow = mesh.receiveShadow = true;
      g.add(mesh);
    }
    g.scale.setScalar(s);
    g.userData.size = def.size.clone().multiplyScalar(s);
    return g;
  }
}
