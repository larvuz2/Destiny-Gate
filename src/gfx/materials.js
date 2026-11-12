import * as THREE from 'three/webgpu';
import { texture, uv, vec3, mix, luminance, color as tslColor, float } from 'three/tsl';

// Material library (GDD 14.2). Each entry references a packed PBR set (colour / normal / ORM) and
// declares its real-world tile size in metres so texel density stays coherent across the train.
const DEFS = {
  walnut:      { tex: 'walnut',  tile: 1.1, tint: 0xffd9b0, desat: 0.45, gain: 2.3, rough: 0.9, normal: 0.8 },
  walnutDark:  { tex: 'walnut',  tile: 1.1, tint: 0xf2c9a0, desat: 0.5, gain: 1.25, rough: 0.85, normal: 0.8 },
  floor:       { tex: 'floor',   tile: 1.6, tint: 0x8d857c, rough: 1.0, normal: 1.2 },
  ceiling:     { tex: 'ceiling', tile: 1.2, tint: 0xb9ab8e, rough: 1.0, normal: 0.7 },
  brass:       { tex: 'brass',   tile: 0.6, tint: 0xd6b36a, rough: 0.75, metal: 1, normal: 0.6 },
  wool:        { tex: 'wool',    tile: 0.7, tint: 0x9a7a5c, rough: 1.0, normal: 1.0, sheen: 0.6 },
  iron:        { tex: 'iron',    tile: 1.2, tint: 0x8a8f96, rough: 0.9, metal: 0.85, normal: 1.0 },
  rust:        { tex: 'rust',    tile: 1.4, tint: 0x9a8a80, rough: 1.0, metal: 0.5, normal: 1.0 },
  leather:     { tex: 'leather', tile: 0.6, tint: 0x6e4a40, rough: 0.9, normal: 0.8 },
  steel:       { tex: 'steel',   tile: 0.5, tint: 0x8793a8, rough: 0.8, metal: 1, normal: 0.6 },
  stone:       { tex: 'stone',   tile: 3.0, tint: 0x9aa0aa, rough: 1.0, normal: 1.2 },
  grate:       { tex: 'grate',   tile: 0.8, tint: 0xa0a0a0, rough: 0.8, metal: 0.9, normal: 1.3 },
  gravel:      { tex: 'gravel',  tile: 1.5, tint: 0x8a909a, rough: 1.0, normal: 1.0 },
  canvas:      { tex: 'canvas',  tile: 1.3, tint: 0xa89f8c, rough: 1.0, normal: 1.3 },
  canvasDark:  { tex: 'canvas',  tile: 1.3, tint: 0x5e5850, rough: 1.0, normal: 1.3 },
  blackMetal:  { tex: 'iron',    tile: 0.9, tint: 0x2a2c30, rough: 0.8, metal: 0.9, normal: 0.6 },
  // Phase B — the same carriage materials drifting cold (GDD 12.3 'uncanny transition')
  petrolWood:  { tex: 'walnut',  tile: 1.1, tint: 0x9fc4cc, desat: 0.9, gain: 4.2, rough: 0.8, normal: 0.9 },
  petrolDark:  { tex: 'walnut',  tile: 1.1, tint: 0x86a8b0, desat: 0.9, gain: 2.4, rough: 0.75, normal: 0.9 },
  ashCeiling:  { tex: 'ceiling', tile: 1.2, tint: 0x9fb0a8, desat: 0.8, gain: 1.0, rough: 1.0, normal: 0.8 },
  coldFloor:   { tex: 'floor',   tile: 1.6, tint: 0x9aa9ab, desat: 0.6, gain: 1.5, rough: 0.9, normal: 1.3 },
  ironGreen:   { tex: 'iron',    tile: 1.2, tint: 0x66756c, rough: 0.85, metal: 0.8, normal: 1.0 },
  coldBrass:   { tex: 'brass',   tile: 0.6, tint: 0x9aa58a, rough: 0.7, metal: 1, normal: 0.6 },
  // Phase C — oxidised iron, torn canvas
  ironDark:    { tex: 'iron',    tile: 1.4, tint: 0x565b63, rough: 0.9, metal: 0.85, normal: 1.1 },
  plank:       { tex: 'floor',   tile: 1.3, tint: 0x8a7a66, rough: 1.0, normal: 1.3 },
  cream:       { tex: 'ceiling', tile: 1.2, tint: 0xa3977c, rough: 0.9, normal: 0.5 },
};

export class Materials {
  constructor(gfx) {
    this.gfx = gfx;
    this.loader = new THREE.TextureLoader();
    this.sets = new Map();
    this.cache = new Map();
  }

  _tex(url, srgb) {
    return new Promise((res, rej) => this.loader.load(url, (t) => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.anisotropy = this.gfx.profile.aniso;
      res(t);
    }, undefined, () => rej(new Error('texture ' + url))));
  }

  async load(onProgress) {
    const names = [...new Set(Object.values(DEFS).map((d) => d.tex))];
    let n = 0;
    await Promise.all(names.map(async (name) => {
      const base = `assets/tex/${name}`;
      const [c, nrm, orm] = await Promise.all([this._tex(`${base}_c.webp`, true), this._tex(`${base}_n.webp`), this._tex(`${base}_orm.webp`)]);
      this.sets.set(name, { c, n: nrm, orm });
      onProgress?.(++n / names.length);
    }));
  }

  /** Shared environment material by key. Geometry UVs are authored in metres. */
  get(key) {
    if (this.cache.has(key)) return this.cache.get(key);
    const d = DEFS[key];
    if (!d) throw new Error('unknown material ' + key);
    const set = this.sets.get(d.tex);
    const rep = 1 / d.tile;
    const clone = (t) => { const c = t.clone(); c.repeat.set(rep, rep); c.needsUpdate = true; return c; };
    const m = new THREE.MeshStandardNodeMaterial({
      map: clone(set.c), normalMap: clone(set.n), roughnessMap: clone(set.orm), metalnessMap: clone(set.orm), aoMap: clone(set.orm),
      color: d.tint, roughness: d.rough ?? 1, metalness: d.metal ?? 0,
    });
    m.normalScale.setScalar(d.normal ?? 1);
    if (d.desat !== undefined) {
      // re-key the albedo: desaturate the source, then tint (keeps weave/grain while changing hue)
      const t = texture(m.map, uv().mul(rep)).rgb;
      m.colorNode = mix(t, vec3(luminance(t)), d.desat).mul(tslColor(d.tint)).mul(float(d.gain ?? 1));
    }
    m.name = key;
    this.cache.set(key, m);
    return m;
  }

  /** Untextured helpers. */
  emissive(key, color, intensity = 1) {
    const k = 'em:' + key;
    if (this.cache.has(k)) return this.cache.get(k);
    const m = new THREE.MeshStandardNodeMaterial({ color: 0x000000, emissive: color, emissiveIntensity: intensity, roughness: 0.4 });
    m.name = k;
    this.cache.set(k, m);
    return m;
  }
}
