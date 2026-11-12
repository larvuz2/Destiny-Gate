import * as THREE from 'three/webgpu';
import { arc } from './kit.js';

// Parametric period carriage interior. Coach A uses it straight; Coach B feeds it stretched
// proportions and a colder material set (GDD 12.2: transform the same materials, do not replace them).
export const SHELL = { W: 1.45, SILL: 0.92, HEAD: 1.95, CORN: 2.14, DECK_Z: 0.78, DECK_Y: 2.42, CLER_Y: 2.66, CROWN: 2.75, PITCH: 1.9, PILLAR: 0.55 };

/** Ceiling lamp: brass rose and arms (batched) + an opal bowl mesh with its own emissive level. */
export function ceilingLamp(world, z, x, y, zz, { color = 0xffc98a, intensity = 16, range = 7.5, scale = 1, emissive = 5.5, brass = 'brass' } = {}) {
  const b = z.b, s = scale;
  b.lathe(brass, x, y, zz, [[0.001, 0], [0.075 * s, 0], [0.085 * s, -0.012 * s], [0.06 * s, -0.035 * s], [0.022 * s, -0.05 * s], [0.018 * s, -0.11 * s], [0.03 * s, -0.125 * s], [0.001, -0.13 * s]], { seg: 14 });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5, c = Math.cos(a), sn = Math.sin(a);
    b.tube(brass, [[x + c * 0.02 * s, y - 0.1 * s, zz + sn * 0.02 * s], [x + c * 0.12 * s, y - 0.12 * s, zz + sn * 0.12 * s], [x + c * 0.2 * s, y - 0.2 * s, zz + sn * 0.2 * s], [x + c * 0.185 * s, y - 0.3 * s, zz + sn * 0.185 * s]], 0.008 * s, { seg: 6, tubular: 8 });
  }
  b.cyl(brass, x, y - 0.3 * s, zz, 0.192 * s, 0.022 * s, { seg: 20 });
  const mat = new THREE.MeshStandardNodeMaterial({ color: 0xd8cdb8, emissive: color, emissiveIntensity: emissive, roughness: 0.55 });
  const bowl = new THREE.Mesh(ceilingLamp.geo ||= new THREE.SphereGeometry(0.185, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat);
  bowl.position.set(x, y - 0.3 * s, zz); bowl.scale.set(s, 0.62 * s, s);
  z.group.add(bowl);
  const lamp = world.lights.addLamp({ pos: [x, y - 0.42 * s, zz], color, intensity, range, zone: z.id, mat, emissive, kind: 'ceiling' });
  z.lamps.push(lamp);
  return lamp;
}

/**
 * opts: x0, x1, bay0 (x of first pillar), bays, ys (vertical stretch), mats { wall, trim, ceil, floor, metal, runner },
 * windows { left, right } (false = panelled blind side), glass, ext (exterior material or null), frost.
 */
export function coachShell(world, z, o) {
  const b = z.b;
  const ys = o.ys || 1;
  const { W, PITCH, PILLAR, DECK_Z } = SHELL;
  const SILL = SHELL.SILL, HEAD = SHELL.HEAD * ys, CORN = SHELL.CORN * ys, DECK_Y = SHELL.DECK_Y * ys, CLER_Y = SHELL.CLER_Y * ys, CROWN = SHELL.CROWN * ys;
  const M = { wall: 'walnut', trim: 'walnutDark', ceil: 'ceiling', floor: 'floor', metal: 'brass', runner: 'leather', pipe: 'blackMetal', ...o.mats };
  const X0 = o.x0, X1 = o.x1, BAYS = o.bays, bayX = (i) => o.bay0 + i * PITCH;
  const win = { left: true, right: true, ...o.windows };

  // --- floor -----------------------------------------------------------------------------------
  b.span(M.floor, X0, X1, -0.12, 0, -W - 0.1, W + 0.1, 'x');
  if (M.runner) {
    b.span(M.runner, X0 + 0.3, X1 - 0.3, 0, 0.006, -0.36, 0.36, 'x');
    for (const s of [-1, 1]) b.span(M.metal, X0 + 0.3, X1 - 0.3, 0, 0.012, s * 0.36 - 0.012, s * 0.36 + 0.012, 'x');
  }

  for (const s of [-1, 1]) {
    const hasWin = s > 0 ? win.right : win.left;
    // profile helper: (inset into the room, y) listed bottom → top; ordering fixed per side so normals face inward
    const prof = (pts) => { const p = pts.map(([inset, y]) => [s * (W - inset), y]); return s > 0 ? p.reverse() : p; };
    // --- wainscot with skirting and sill rail ---------------------------------------------------
    b.sweepX(M.trim, prof([[0.055, 0], [0.055, 0.13], [0.03, 0.15]]), X0, X1);
    b.sweepX(M.wall, prof([[0.03, 0.15], [0.03, 0.82]]), X0, X1);
    b.sweepX(M.trim, prof([[0.03, 0.82], [0.06, 0.835], [0.075, 0.86], [0.075, 0.895], [0.06, SILL], [-0.1, SILL]]), X0, X1);
    for (let i = 0; i < BAYS; i++) for (const k of [0, 1]) {
      const px0 = bayX(i) + 0.08 + k * (PITCH / 2), px1 = px0 + PITCH / 2 - 0.16, zf = s * (W - 0.03 - 0.008);
      for (const [a0, a1, y0, y1] of [[px0, px1, 0.24, 0.265], [px0, px1, 0.715, 0.74], [px0, px0 + 0.025, 0.24, 0.74], [px1 - 0.025, px1, 0.24, 0.74]]) b.span(M.trim, a0, a1, y0, y1, zf - 0.008, zf + 0.008, 'x');
    }
    // --- pillars, window reveals and glass ------------------------------------------------------
    if (hasWin) {
      for (let i = 0; i <= BAYS; i++) {
        const px = bayX(i);
        b.span(M.wall, px - PILLAR / 2, px + PILLAR / 2, SILL, HEAD, s * (W - 0.03), s * (W + 0.12));
        b.span(M.trim, px - PILLAR / 2 + 0.07, px + PILLAR / 2 - 0.07, SILL + 0.1, HEAD - 0.1, s * (W - 0.042), s * (W - 0.03));
        b.cyl(M.metal, px, 1.62, s * (W - 0.055), 0.012, 0.05, { axis: 'z', seg: 8 });
        b.tube(M.metal, [[px, 1.62, s * (W - 0.07)], [px, 1.6, s * (W - 0.11)], [px, 1.64, s * (W - 0.125)]], 0.006, { seg: 5, tubular: 5 });
      }
      // stub walls where the bays do not reach the ends
      if (bayX(0) - PILLAR / 2 > X0 + 0.01) b.span(M.wall, X0, bayX(0) - PILLAR / 2, SILL, HEAD, s * (W - 0.03), s * (W + 0.12));
      if (bayX(BAYS) + PILLAR / 2 < X1 - 0.01) b.span(M.wall, bayX(BAYS) + PILLAR / 2, X1, SILL, HEAD, s * (W - 0.03), s * (W + 0.12));
      for (let i = 0; i < BAYS; i++) {
        const wx0 = bayX(i) + PILLAR / 2, wx1 = bayX(i + 1) - PILLAR / 2;
        b.span(M.trim, wx0, wx1, HEAD - 0.045, HEAD, s * (W - 0.03), s * (W + 0.1), 'x');
        b.span(M.trim, wx0, wx0 + 0.035, SILL, HEAD, s * (W - 0.01), s * (W + 0.1));
        b.span(M.trim, wx1 - 0.035, wx1, SILL, HEAD, s * (W - 0.01), s * (W + 0.1));
        b.span(M.trim, wx0, wx1, SILL + (HEAD - SILL) * 0.56, SILL + (HEAD - SILL) * 0.56 + 0.025, s * (W + 0.05), s * (W + 0.08), 'x');
        b.span(M.metal, (wx0 + wx1) / 2 - 0.05, (wx0 + wx1) / 2 + 0.05, SILL + 0.005, SILL + 0.03, s * (W + 0.0), s * (W + 0.04), 'x');
      }
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0, HEAD - SILL), o.glass);
      glass.geometry.attributes.uv.array.forEach((v, k, arr) => { if (k % 2 === 0) arr[k] = v * ((X1 - X0) / 2.9); });
      glass.position.set((X0 + X1) / 2, (SILL + HEAD) / 2, s * (W + 0.07));
      glass.rotation.y = s > 0 ? Math.PI : 0;
      glass.renderOrder = 2;
      z.group.add(glass);
      if (o.ext) {
        const ext = new THREE.Mesh(new THREE.PlaneGeometry(240, 16), o.ext);
        ext.geometry.attributes.uv.array.forEach((v, k, arr) => { if (k % 2 === 0) arr[k] = v * 2.2 * s; });
        ext.position.set((X0 + X1) / 2, 3.2, s * 34);
        ext.rotation.y = s > 0 ? Math.PI : 0;
        z.group.add(ext);
      }
    } else {
      // blind side: full-height panelling with tall inset fields
      b.span(M.wall, X0, X1, SILL, HEAD, s * (W - 0.03), s * (W + 0.12));
      for (let i = 0; i < BAYS; i++) {
        const cx = bayX(i) + PITCH / 2;
        b.span(M.trim, cx - 0.62, cx + 0.62, SILL + 0.12, HEAD - 0.12, s * (W - 0.045), s * (W - 0.03));
        b.span(M.wall, cx - 0.54, cx + 0.54, SILL + 0.2, HEAD - 0.2, s * (W - 0.055), s * (W - 0.045));
      }
    }

    // --- frieze, cornice and lower roof deck ----------------------------------------------------
    b.sweepX(M.wall, prof([[0.03, HEAD], [0.03, CORN - 0.07]]), X0, X1);
    b.sweepX(M.trim, prof([[0.03, CORN - 0.07], [0.055, CORN - 0.055], [0.07, CORN - 0.03], [0.07, CORN]]), X0, X1);
    const deck = arc(0, 0, 1, 0, Math.PI / 2, 8).map(([c, sn]) => [s * (DECK_Z + c * (W - DECK_Z - 0.07)), CORN + sn * (DECK_Y - CORN)]);
    b.sweepX(M.ceil, s > 0 ? deck.slice().reverse() : deck, X0, X1, { smooth: true });
    b.sweepX(M.wall, s < 0 ? [[s * DECK_Z, DECK_Y], [s * DECK_Z, CLER_Y]] : [[s * DECK_Z, CLER_Y], [s * DECK_Z, DECK_Y]], X0, X1);
    b.sweepX(M.trim, s < 0 ? [[s * (DECK_Z + 0.03), DECK_Y], [s * DECK_Z, DECK_Y + 0.03]] : [[s * DECK_Z, DECK_Y + 0.03], [s * (DECK_Z + 0.03), DECK_Y]], X0, X1);
    if (o.clerestory !== false) for (let i = 0; i < BAYS; i++) {
      const cx = bayX(i) + PITCH / 2;
      b.span(world.mats.emissive(o.clerestory?.key || 'clerestory', o.clerestory?.color ?? 0x2c4468, o.clerestory?.power ?? 1.2), cx - 0.5, cx + 0.5, DECK_Y + 0.07 * ys, CLER_Y - 0.06 * ys, s * (DECK_Z - 0.004), s * (DECK_Z + 0.02), 'x');
    }
    // --- luggage rack ---------------------------------------------------------------------------
    if (o.racks !== false) {
      const ry = HEAD + 0.05;
      for (const [inset, y] of [[0.1, ry], [0.22, ry - 0.005], [0.34, ry]]) b.cyl(M.metal, (X0 + X1) / 2, y, s * (W - inset), 0.011, X1 - X0 - 0.5, { axis: 'x', seg: 6 });
      b.cyl(M.metal, (X0 + X1) / 2, ry + 0.035, s * (W - 0.36), 0.014, X1 - X0 - 0.5, { axis: 'x', seg: 6 });
      for (let i = 0; i <= BAYS; i++) {
        const px = bayX(i);
        b.tube(M.metal, [[px, ry - 0.2, s * (W - 0.03)], [px, ry - 0.14, s * (W - 0.2)], [px, ry - 0.02, s * (W - 0.33)], [px, ry + 0.04, s * (W - 0.37)]], 0.011, { seg: 6, tubular: 8 });
        b.tube(M.metal, [[px, ry, s * (W - 0.03)], [px, ry - 0.015, s * (W - 0.36)]], 0.008, { seg: 5, tubular: 2 });
      }
    }
    // --- heater pipes ---------------------------------------------------------------------------
    b.cyl(M.pipe, (X0 + X1) / 2, 0.2, s * (W - 0.1), 0.032, X1 - X0 - 0.6, { axis: 'x', seg: 8 });
    b.cyl(M.pipe, (X0 + X1) / 2, 0.29, s * (W - 0.1), 0.032, X1 - X0 - 0.6, { axis: 'x', seg: 8 });
    world.wall(X0, X1, s * W, s * (W + 1));
  }

  // --- upper ceiling and ribs --------------------------------------------------------------------
  const top = arc(0, 0, 1, 0, Math.PI, 8).map(([c, sn]) => [c * DECK_Z, CLER_Y + sn * (CROWN - CLER_Y)]);
  b.sweepX(M.ceil, top.slice().reverse(), X0, X1, { smooth: true });
  for (let i = 0; i <= BAYS; i++) {
    const px = bayX(i);
    for (const s of [1, -1]) {
      const d = arc(0, 0, 1, 0, Math.PI / 2, 5).map(([c, sn]) => [px, CORN + sn * (DECK_Y - CORN), s * (DECK_Z + c * (W - DECK_Z - 0.07))]);
      b.tube(M.trim, s > 0 ? d : d.reverse(), 0.022, { seg: 6, tubular: 10 });
    }
    b.span(M.trim, px - 0.025, px + 0.025, CLER_Y + 0.02, CROWN + 0.03, -DECK_Z, DECK_Z, 'z');
  }
  return { HEAD, CORN, DECK_Y, CLER_Y, CROWN, bayX, M };
}

/** End wall with a door opening. dir = +1 if the room lies on the +X side of the wall. */
export function endWall(world, z, x, dir, { W = SHELL.W, top = SHELL.CROWN + 0.05, DW = 0.44, DH = 2.02, mats = {} } = {}) {
  const b = z.b, M = { wall: 'walnut', trim: 'walnutDark', ...mats };
  const xa = dir > 0 ? x - 0.12 : x, xb = dir > 0 ? x : x + 0.12;
  b.span(M.wall, xa, xb, 0, top, DW + 0.06, W + 0.1);
  b.span(M.wall, xa, xb, 0, top, -W - 0.1, -DW - 0.06);
  b.span(M.wall, xa, xb, DH + 0.06, top, -DW - 0.06, DW + 0.06, 'z');
  const xc0 = x - 0.14, xc1 = x + 0.14;
  b.span(M.trim, xc0, xc1, 0, DH + 0.06, DW, DW + 0.07);
  b.span(M.trim, xc0, xc1, 0, DH + 0.06, -DW - 0.07, -DW);
  b.span(M.trim, xc0, xc1, DH, DH + 0.07, -DW - 0.07, DW + 0.07, 'z');
  world.wall(x - 0.12, x + 0.12, DW, W + 0.2);
  world.wall(x - 0.12, x + 0.12, -W - 0.2, -DW);
}
