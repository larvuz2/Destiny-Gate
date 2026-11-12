import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Procedural modelling kit. Every primitive emits UVs in metres, so one tiling material keeps a
// constant texel density on any part. Geometry is batched per material and merged once per zone.
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();

/** Box with per-face planar UVs in metres. grain: 'x'|'y'|'z' = world axis the texture V runs along. */
export function boxGeo(sx, sy, sz, grain = 'y') {
  const hx = sx / 2, hy = sy / 2, hz = sz / 2;
  const pos = [], nor = [], uv = [], idx = [];
  const face = (n, a, b, c, d, w, h, flip) => {
    const i = pos.length / 3;
    for (const p of [a, b, c, d]) { pos.push(...p); nor.push(...n); }
    const U = flip ? [[0, 0], [0, w], [h, w], [h, 0]] : [[0, 0], [w, 0], [w, h], [0, h]];
    for (const t of U) uv.push(...t);
    idx.push(i, i + 1, i + 2, i, i + 2, i + 3);
  };
  // ±X faces span (z, y); ±Y span (x, z); ±Z span (x, y)
  face([1, 0, 0], [hx, -hy, hz], [hx, -hy, -hz], [hx, hy, -hz], [hx, hy, hz], sz, sy, grain === 'z');
  face([-1, 0, 0], [-hx, -hy, -hz], [-hx, -hy, hz], [-hx, hy, hz], [-hx, hy, -hz], sz, sy, grain === 'z');
  face([0, 1, 0], [-hx, hy, hz], [hx, hy, hz], [hx, hy, -hz], [-hx, hy, -hz], sx, sz, grain === 'x');
  face([0, -1, 0], [-hx, -hy, -hz], [hx, -hy, -hz], [hx, -hy, hz], [-hx, -hy, hz], sx, sz, grain === 'x');
  face([0, 0, 1], [-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz], sx, sy, grain === 'x');
  face([0, 0, -1], [hx, -hy, -hz], [-hx, -hy, -hz], [-hx, hy, -hz], [hx, hy, -hz], sx, sy, grain === 'x');
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/**
 * Extrude a 2D profile [(a, y), …] along an axis. For axis 'x' the profile lives in (z, y);
 * for axis 'z' it lives in (x, y). Smooth = share normals along the profile (curved surfaces).
 */
export function extrudeGeo(profile, len, { smooth = false, closed = false, caps = false } = {}) {
  const pts = closed ? [...profile, profile[0]] : profile;
  const pos = [], nor = [], uv = [], idx = [];
  // cumulative length for U
  const acc = [0];
  for (let i = 1; i < pts.length; i++) acc.push(acc[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const segN = (i) => {
    const dx = pts[i + 1][0] - pts[i][0], dy = pts[i + 1][1] - pts[i][1];
    const l = Math.hypot(dx, dy) || 1;
    return [dy / l, -dx / l]; // right-hand normal of the segment in profile space
  };
  const vertN = (i) => {
    const a = segN(Math.max(0, Math.min(pts.length - 2, i - 1)));
    const b = segN(Math.max(0, Math.min(pts.length - 2, i)));
    let n = closed && (i === 0 || i === pts.length - 1) ? [segN(0)[0] + segN(pts.length - 2)[0], segN(0)[1] + segN(pts.length - 2)[1]] : [a[0] + b[0], a[1] + b[1]];
    const l = Math.hypot(n[0], n[1]) || 1;
    return [n[0] / l, n[1] / l];
  };
  for (let i = 0; i < pts.length - 1; i++) {
    const n0 = smooth ? vertN(i) : segN(i), n1 = smooth ? vertN(i + 1) : segN(i);
    const b = pos.length / 3;
    const quad = [[pts[i], 0, n0, acc[i]], [pts[i + 1], 0, n1, acc[i + 1]], [pts[i + 1], len, n1, acc[i + 1]], [pts[i], len, n0, acc[i]]];
    for (const [p, l, n, u] of quad) { pos.push(l, p[1], p[0]); nor.push(0, n[1], n[0]); uv.push(l, u); }
    idx.push(b, b + 2, b + 1, b, b + 3, b + 2);
  }
  if (caps && closed) {
    const shape = THREE.ShapeUtils.triangulateShape(profile.map((p) => new THREE.Vector2(p[0], p[1])), []);
    for (const [l, nx, flip] of [[0, -1, false], [len, 1, true]]) {
      const b = pos.length / 3;
      for (const p of profile) { pos.push(l, p[1], p[0]); nor.push(nx, 0, 0); uv.push(p[0], p[1]); }
      for (const t of shape) flip ? idx.push(b + t[0], b + t[2], b + t[1]) : idx.push(b + t[0], b + t[1], b + t[2]);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

function scaleUV(g, s, sv = s) {
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * s, uv.getY(i) * sv);
  return g;
}

export class Builder {
  constructor() { this.parts = new Map(); this.tris = 0; }

  add(mat, geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1) {
    if (!geo.attributes.uv) throw new Error('kit geometry needs uv');
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    _m.compose(new THREE.Vector3(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), typeof s === 'number' ? new THREE.Vector3(s, s, s) : new THREE.Vector3(...s));
    g.applyMatrix4(_m);
    if (!this.parts.has(mat)) this.parts.set(mat, []);
    this.parts.get(mat).push(g);
    this.tris += g.attributes.position.count / 3;
    return this;
  }

  /** Box given by min corner + size is error-prone; this takes centre + size. */
  box(mat, x, y, z, sx, sy, sz, grain = 'y', ry = 0) { return this.add(mat, boxGeo(sx, sy, sz, grain), x, y, z, 0, ry, 0); }
  /** Box from bounds. */
  span(mat, x0, x1, y0, y1, z0, z1, grain = 'y') {
    return this.box(mat, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0), grain);
  }
  /** Profile in (z, y) swept along +X from x0 to x1. */
  sweepX(mat, profile, x0, x1, opts) { return this.add(mat, extrudeGeo(profile, x1 - x0, opts), x0, 0, 0); }
  /** Profile in (x, y) swept along +Z from z0 to z1. */
  sweepZ(mat, profile, z0, z1, opts) {
    // extrudeGeo emits (len, y, a); rotate so len → z and a → x.
    const g = extrudeGeo(profile.map(([a, y]) => [-a, y]), z1 - z0, opts);
    return this.add(mat, g, 0, 0, z0, 0, -Math.PI / 2, 0);
  }
  cyl(mat, x, y, z, r, h, { axis = 'y', seg = 12, r2 = r } = {}) {
    const g = new THREE.CylinderGeometry(r2, r, h, seg, 1);
    scaleUV(g, 2 * Math.PI * r, h);
    return this.add(mat, g, x, y, z, axis === 'z' ? Math.PI / 2 : 0, 0, axis === 'x' ? Math.PI / 2 : 0);
  }
  sphere(mat, x, y, z, r, { seg = 14, sy = 1, phiLen = Math.PI, thetaStart = 0, thetaLen = Math.PI } = {}) {
    const g = new THREE.SphereGeometry(r, seg, Math.max(4, seg >> 1), 0, Math.PI * 2, thetaStart, thetaLen);
    scaleUV(g, 2 * Math.PI * r, Math.PI * r);
    return this.add(mat, g, x, y, z, 0, 0, 0, [1, sy, 1]);
  }
  /** Tube through points. */
  tube(mat, pts, r, { seg = 8, closed = false, tubular } = {}) {
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), closed, 'catmullrom', 0.4);
    const len = curve.getLength();
    const g = new THREE.TubeGeometry(curve, tubular || Math.max(4, Math.ceil(len / 0.12)), r, seg, closed);
    scaleUV(g, len, 2 * Math.PI * r);
    return this.add(mat, g);
  }
  lathe(mat, x, y, z, profile, { seg = 16, rx = 0 } = {}) {
    const g = new THREE.LatheGeometry(profile.map((p) => new THREE.Vector2(p[0], p[1])), seg);
    scaleUV(g, 1, 1);
    return this.add(mat, g, x, y, z, rx, 0, 0);
  }

  /** Merge into one mesh per material. materials: key → Material resolver. */
  build(resolve, { cast = true, receive = true, name = 'zone' } = {}) {
    const group = new THREE.Group();
    group.name = name;
    for (const [key, list] of this.parts) {
      const geo = mergeGeometries(list, false);
      for (const g of list) g.dispose();
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, typeof key === 'string' ? resolve(key) : key);
      mesh.name = `${name}:${typeof key === 'string' ? key : key.name}`;
      mesh.castShadow = cast; mesh.receiveShadow = receive;
      mesh.matrixAutoUpdate = false;
      group.add(mesh);
    }
    return group;
  }
}

/** Arc profile helper: points on a circle arc in (a, y). */
export function arc(cx, cy, r, a0, a1, n = 10) {
  const out = [];
  for (let i = 0; i <= n; i++) { const a = a0 + ((a1 - a0) * i) / n; out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
  return out;
}
