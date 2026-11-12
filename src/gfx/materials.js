import * as THREE from 'three/webgpu';
import { texture, uv, vec3, mix, luminance, float } from 'three/tsl';

// Material library (GDD 14.2). Each entry references a packed PBR set (colour / normal / ORM) and
// declares its real-world tile size in metres so texel density stays coherent across the train.
const DEFS = {
  // alb = target mean albedo (linear). Gain is derived from the texture's measured luminance at load,
  // so every surface sits at a physically sensible reflectance whatever the source image looked like.
  walnut:      { tex: 'walnut',  tile: 1.1, tint: 0xf6cda6, desat: 0.55, alb: 0.085, rough: 0.9, normal: 0.8 },
  walnutDark:  { tex: 'walnut',  tile: 1.1, tint: 0xeec6a2, desat: 0.6, alb: 0.045, rough: 0.85, normal: 0.8 },
  floor:       { tex: 'floor',   tile: 1.6, tint: 0xfff2e2, desat: 0.1, alb: 0.11, rough: 1.0, normal: 1.2 },
  ceiling:     { tex: 'ceiling', tile: 1.2, tint: 0xfff0d2, desat: 0.1, alb: 0.42, rough: 1.0, normal: 0.7 },
  brass:       { tex: 'brass',   tile: 0.6, tint: 0xffdf9a, desat: 0.2, alb: 0.42, rough: 0.75, metal: 1, normal: 0.6 },
  wool:        { tex: 'wool',    tile: 0.7, tint: 0xffe0c0, desat: 0.3, alb: 0.12, rough: 1.0, normal: 1.0 },
  iron:        { tex: 'iron',    tile: 1.2, tint: 0xd6dde6, desat: 0.5, alb: 0.085, rough: 0.8, metal: 0.2, normal: 1.0 },
  rust:        { tex: 'rust',    tile: 1.4, tint: 0xffe6d6, desat: 0.25, alb: 0.12, rough: 1.0, metal: 0.3, normal: 1.0 },
  leather:     { tex: 'leather', tile: 0.6, tint: 0xd8b8a8, desat: 0.5, alb: 0.05, rough: 0.9, normal: 0.8 },
  steel:       { tex: 'steel',   tile: 0.5, tint: 0xc8d2e6, desat: 0.7, alb: 0.3, rough: 0.6, metal: 1, normal: 0.6 },
  stone:       { tex: 'stone',   tile: 3.0, tint: 0xd8e0f0, desat: 0.3, alb: 0.13, rough: 1.0, normal: 1.2 },
  grate:       { tex: 'grate',   tile: 0.8, tint: 0xe6e6e6, desat: 0.3, alb: 0.1, rough: 0.75, metal: 0.3, normal: 1.3 },
  gravel:      { tex: 'gravel',  tile: 1.5, tint: 0xdfe6f0, desat: 0.2, alb: 0.1, rough: 1.0, normal: 1.0 },
  canvas:      { tex: 'canvas',  tile: 1.3, tint: 0xf0e4cc, desat: 0.1, alb: 0.4, rough: 1.0, normal: 1.3 },
  canvasDark:  { tex: 'canvas',  tile: 1.3, tint: 0xd8cfc0, desat: 0.2, alb: 0.1, rough: 1.0, normal: 1.3 },
  blackMetal:  { tex: 'iron',    tile: 0.9, tint: 0xe0e4ea, desat: 0.7, alb: 0.03, rough: 0.6, metal: 0.4, normal: 0.6 },
  // Phase B — the same carriage materials drifting cold (GDD 12.3 'uncanny transition')
  petrolWood:  { tex: 'walnut',  tile: 1.1, tint: 0x9fc4cc, desat: 0.9, alb: 0.115, rough: 0.8, normal: 0.9 },
  petrolDark:  { tex: 'walnut',  tile: 1.1, tint: 0x86a8b0, desat: 0.9, alb: 0.06, rough: 0.75, normal: 0.9 },
  ashCeiling:  { tex: 'ceiling', tile: 1.2, tint: 0xc4d6ce, desat: 0.8, alb: 0.3, rough: 1.0, normal: 0.8 },
  coldFloor:   { tex: 'floor',   tile: 1.6, tint: 0xc0d2d6, desat: 0.6, alb: 0.11, rough: 0.9, normal: 1.3 },
  ironGreen:   { tex: 'iron',    tile: 1.2, tint: 0xb4ccc0, desat: 0.6, alb: 0.075, rough: 0.85, metal: 0.2, normal: 1.0 },
  coldBrass:   { tex: 'brass',   tile: 0.6, tint: 0xd6e2c0, desat: 0.5, alb: 0.34, rough: 0.7, metal: 1, normal: 0.6 },
  // Phase C — oxidised iron, torn canvas
  ironDark:    { tex: 'iron',    tile: 1.4, tint: 0xc6ccd6, desat: 0.5, alb: 0.055, rough: 0.86, metal: 0.2, normal: 1.1 },
  plank:       { tex: 'floor',   tile: 1.3, tint: 0xffe6c8, desat: 0.2, alb: 0.17, rough: 1.0, normal: 1.3 },
  cream:       { tex: 'ceiling', tile: 1.2, tint: 0xffeccc, desat: 0.1, alb: 0.34, rough: 0.9, normal: 0.5 },
};

export class Materials {
  constructor(gfx) {
    this.gfx = gfx;
    this.loader = new THREE.TextureLoader();
    this.sets = new Map();
    this.cache = new Map();
  }

  /** Mean linear RGB and luminance of an image (16×16 downsample). */
  static measure(img) {
    try {
      const c = document.createElement('canvas'); c.width = c.height = 16;
      const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, 16, 16);
      const d = g.getImageData(0, 0, 16, 16).data, rgb = [0, 0, 0];
      const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
      for (let i = 0; i < d.length; i += 4) { rgb[0] += lin(d[i]); rgb[1] += lin(d[i + 1]); rgb[2] += lin(d[i + 2]); }
      for (let i = 0; i < 3; i++) rgb[i] /= 256;
      return { rgb, lum: 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2] };
    } catch { return { rgb: [0.2, 0.2, 0.2], lum: 0.2 }; }
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
      this.sets.set(name, { c, n: nrm, orm, stats: Materials.measure(c.image) });
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
    {
      // re-key the albedo: desaturate the source, tint, then scale to the target reflectance
      const desat = d.desat ?? 0, tint = new THREE.Color(d.tint), st = set.stats;
      const mixed = [0, 1, 2].map((i) => st.rgb[i] * (1 - desat) + st.lum * desat);
      const lum = 0.2126 * mixed[0] * tint.r + 0.7152 * mixed[1] * tint.g + 0.0722 * mixed[2] * tint.b;
      const gain = d.alb ? d.alb / Math.max(lum, 1e-4) : 1;
      const t = texture(m.map, uv().mul(rep)).rgb;
      m.colorNode = mix(t, vec3(luminance(t)), desat).mul(vec3(tint.r, tint.g, tint.b)).mul(float(gain)).min(vec3(0.92));
      m.color.set(0xffffff);
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
