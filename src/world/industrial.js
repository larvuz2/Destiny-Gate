import * as THREE from 'three/webgpu';
import { texture, uv, vec2, vec3, float, positionLocal, smoothstep, mix, time } from 'three/tsl';
import { arc } from './kit.js';

// Phase C kit — "mechanical nightmare": oxidised iron, locomotive ribs, gratings over a void.

/** Iron hall: plated walls, arched roof and boiler-rib frames. Returns { H, crown }. */
export function ironHall(world, z, { x0, x1, W, H, crown, ribEvery = 2.4, wallMat = 'ironDark', ribMat = 'iron', colliders = true, pad = [] }) {
  const b = z.b;
  for (const s of [-1, 1]) {
    b.span(wallMat, x0, x1, -0.4, H, s * W, s * (W + 0.2), 'x');
    // plinth and riveted waist band
    b.span(ribMat, x0, x1, 0, 0.22, s * (W - 0.06), s * W, 'x');
    b.span(ribMat, x0, x1, 1.28, 1.42, s * (W - 0.035), s * W, 'x');
    if (colliders) world.wall(x0, x1, s * W, s * (W + 1));
  }
  // roof: one smooth barrel
  const roof = arc(0, 0, 1, 0, Math.PI, 14).map(([c, sn]) => [c * W, H + sn * (crown - H)]);
  b.sweepX(wallMat, roof.slice().reverse(), x0, x1, { smooth: true });
  // ribs
  const n = Math.round((x1 - x0) / ribEvery);
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n;
    for (const s of [-1, 1]) {
      b.span(ribMat, x - 0.11, x + 0.11, 0, H, s * (W - 0.16), s * W);
      b.span(ribMat, x - 0.16, x + 0.16, 0, 0.3, s * (W - 0.24), s * W);
      b.span(ribMat, x - 0.15, x + 0.15, H - 0.2, H + 0.05, s * (W - 0.26), s * W);
    }
    const pts = arc(0, 0, 1, 0, Math.PI, 12).map(([c, sn]) => [x, H + sn * (crown - H - 0.06), c * (W - 0.08)]);
    b.tube(ribMat, pts, 0.085, { seg: 6, tubular: 18 });
  }
  // padded-cell canvas showing through the plating
  for (const [px0, px1, side, y0 = 0.3, y1 = 2.4] of pad) b.span('canvas', px0, px1, y0, y1, side * (W - 0.05), side * (W - 0.01), 'x');
  return { H, crown };
}

/** Slab with edge beams. Registers the walkable rect unless floor === false. */
export function deck(world, z, x0, x1, z0, z1, { mat = 'grate', y = 0, t = 0.07, beam = 'iron', floor = true, surface = 'metal', id } = {}) {
  const b = z.b;
  b.span(mat, x0, x1, y - t, y, z0, z1, 'x');
  b.span(beam, x0, x1, y - 0.3, y - t, z0, z0 + 0.09, 'x');
  b.span(beam, x0, x1, y - 0.3, y - t, z1 - 0.09, z1, 'x');
  b.span(beam, x0, x0 + 0.09, y - 0.3, y - t, z0, z1, 'z');
  b.span(beam, x1 - 0.09, x1, y - 0.3, y - t, z0, z1, 'z');
  if (floor) return world.floor(x0, x1, z0, z1, y, { surface, id });
  return null;
}

/** Hand rail along a polyline of [x, z] points. Visual only — ledges are guarded by the collision system. */
export function railing(z, pts, { h = 1.02, y = 0, mat = 'blackMetal', every = 1.3 } = {}) {
  const b = z.b;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    const len = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(len / every));
    for (let k = 0; k <= n; k++) { const t = k / n; b.cyl(mat, ax + (bx - ax) * t, y + h / 2, az + (bz - az) * t, 0.022, h, { seg: 6 }); }
    for (const yy of [h, h * 0.55]) b.tube(mat, [[ax, y + yy, az], [bx, y + yy, bz]], 0.02, { seg: 6, tubular: 1 });
  }
}

/** Support columns dropping from a deck into the dark. */
export function stilts(z, list, { depth = 9, mat = 'iron' } = {}) {
  for (const [x, zz] of list) {
    z.b.span(mat, x - 0.12, x + 0.12, -depth, -0.3, zz - 0.12, zz + 0.12);
    z.b.span(mat, x - 0.2, x + 0.2, -0.42, -0.3, zz - 0.2, zz + 0.2);
  }
}

/** The void under the train: plated shaft walls and a rushing track bed far below. */
export function pit(world, z, x0, x1, z0, z1, { depth = 11 } = {}) {
  const b = z.b;
  b.span('ironDark', x0, x1, -depth, -0.3, z0 - 0.2, z0, 'x');
  b.span('ironDark', x0, x1, -depth, -0.3, z1, z1 + 0.2, 'x');
  b.span('ironDark', x0 - 0.2, x0, -depth, -0.3, z0, z1, 'z');
  b.span('ironDark', x1, x1 + 0.2, -depth, -0.3, z0, z1, 'z');
  const m = pit.mat ||= (() => {
    const mat = new THREE.MeshBasicNodeMaterial();
    const g = world.mats.sets.get('gravel').c;
    const u = vec2(uv().x.mul(3).add(time.mul(9)), uv().y.mul(1.2));
    const base = texture(g, u).rgb.mul(vec3(0.08, 0.1, 0.13));
    // two rails and blurred sleepers streaking past
    const rail = smoothstep(0.012, 0.0, uv().y.sub(0.38).abs()).add(smoothstep(0.012, 0.0, uv().y.sub(0.62).abs()));
    const sleeper = smoothstep(0.75, 1.0, uv().x.mul(26).add(time.mul(78)).fract()).mul(smoothstep(0.2, 0.0, uv().y.sub(0.5).abs().sub(0.2)));
    mat.colorNode = base.add(vec3(0.16, 0.2, 0.26).mul(rail)).add(vec3(0.03, 0.035, 0.04).mul(sleeper));
    return mat;
  })();
  const bed = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), m);
  bed.rotation.x = -Math.PI / 2; bed.position.set((x0 + x1) / 2, -depth, (z0 + z1) / 2);
  z.group.add(bed);
}

/** Caged industrial lamp on a chain. Returns the lamp; `swing` adds a pendulum the reveal uses. */
export function hangLamp(world, z, x, yTop, zz, { len = 1.0, color = 0xffb46a, intensity = 26, range = 8.5, swing = 0, emissive = 7, priority = 0 } = {}) {
  const g = new THREE.Group();
  g.position.set(x, yTop, zz);
  const metal = world.mats.get('blackMetal');
  const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, len, 5), metal); chain.position.y = -len / 2; g.add(chain);
  const shade = new THREE.Mesh(hangLamp.shade ||= new THREE.ConeGeometry(0.26, 0.2, 14, 1, true), metal); shade.material.side = THREE.DoubleSide; shade.position.y = -len - 0.06; g.add(shade);
  const mat = new THREE.MeshStandardNodeMaterial({ color: 0x2a2018, emissive: color, emissiveIntensity: emissive, roughness: 0.5 });
  const bulb = new THREE.Mesh(hangLamp.bulb ||= new THREE.SphereGeometry(0.085, 12, 8), mat); bulb.position.y = -len - 0.2; bulb.scale.y = 1.25; g.add(bulb);
  for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2; const bar = new THREE.Mesh(hangLamp.bar ||= new THREE.CylinderGeometry(0.006, 0.006, 0.26, 4), metal); bar.position.set(Math.cos(a) * 0.11, -len - 0.22, Math.sin(a) * 0.11); g.add(bar); }
  z.group.add(g);
  const lamp = world.lights.addLamp({ pos: [x, yTop - len - 0.25, zz], color, intensity, range, zone: z.id, mat, emissive, kind: 'hang', priority });
  lamp.group = g; lamp.swing = swing; lamp.len = len + 0.25; lamp.anchor = new THREE.Vector3(x, yTop, zz); lamp.phase = x * 1.7;
  if (swing) world.dynamic.push({ update: (dt, t) => {
    const a = Math.sin(t * 1.9 + lamp.phase) * lamp.swing;
    g.rotation.z = a;
    lamp.pos.set(lamp.anchor.x + Math.sin(a) * lamp.len, lamp.anchor.y - Math.cos(a) * lamp.len, lamp.anchor.z);
  } });
  z.lamps.push(lamp);
  return lamp;
}

/** Fake volumetric shaft: an additive cone whose density fades with height and view angle. */
export function lightShaft(world, z, x, y0, y1, zz, { r0 = 0.25, r1 = 1.2, color = 0xffc98a, power = 0.5 } = {}) {
  const h = y1 - y0;
  const geo = new THREE.CylinderGeometry(r0, r1, h, 20, 1, true);
  const m = lightShaft.mats?.[color + ':' + power] || ((lightShaft.mats ||= {})[color + ':' + power] = (() => {
    const mat = new THREE.MeshBasicNodeMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
    const v = uv().y; // 1 at the top
    const fall = smoothstep(0.0, 0.25, v).mul(smoothstep(1.0, 0.55, v).mul(0.6).add(0.4));
    const streak = texture(world.tex.grime, vec2(uv().x.mul(2.0).add(time.mul(0.01)), v.mul(0.35))).r.mul(0.6).add(0.55);
    mat.colorNode = vec3(new THREE.Color(color).r, new THREE.Color(color).g, new THREE.Color(color).b).mul(fall).mul(streak).mul(power * 0.16);
    return mat;
  })());
  const mesh = new THREE.Mesh(geo, m);
  mesh.position.set(x, (y0 + y1) / 2, zz);
  mesh.renderOrder = 3;
  z.group.add(mesh);
  return mesh;
}

/** A stack of cases/crates that acts as full cover. Registers a sight-blocking collider. */
export function luggageBank(world, z, x0, x1, z0, z1, { h = 2.1, seed = 1 } = {}) {
  let s = seed * 9301 + 49297;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const names = ['crate', 'suitcase_b', 'crate', 'suitcase_a', 'sample_case'];
  let y = 0;
  while (y < h - 0.2) {
    let x = x0;
    const rowH = 0.55 + rnd() * 0.2;
    while (x < x1 - 0.3) {
      const n = names[(rnd() * names.length) | 0];
      const w = Math.min(x1 - x, 0.7 + rnd() * 0.45);
      const fit = n === 'crate' ? 'x' : 'x';
      z.pb.place(n, x + w / 2, y, (z0 + z1) / 2 + (rnd() - 0.5) * 0.1, { size: w, fit, ry: (rnd() - 0.5) * 0.2, stretch: n === 'crate' ? [1, rowH / (w * 0.93), (z1 - z0) / (w * 1.25)] : null });
      x += w + 0.02;
    }
    y += rowH;
  }
  world.wall(x0, x1, z0, z1, { h, tag: 'cover' });
}
