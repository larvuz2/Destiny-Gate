import * as THREE from 'three/webgpu';
import { arc } from '../kit.js';

// Coach A — the believable third-class day coach (GDD 9.2 / 12.2 Phase A).
// Train axis is +X (towards the locomotive). All dimensions in metres.
export const A = { x0: 0, x1: 20, W: 1.45, SILL: 0.92, HEAD: 1.95, CORN: 2.14, DECK_Z: 0.78, DECK_Y: 2.42, CLER_Y: 2.66, CROWN: 2.75, PITCH: 1.9, BAYS: 10, BAY0: 0.5, PILLAR: 0.55 };

/** Ceiling lamp: brass rose and arms (batched) + an opal bowl mesh with its own emissive level. */
export function ceilingLamp(world, z, x, y, zz, { color = 0xffc98a, intensity = 16, range = 7.5, scale = 1 } = {}) {
  const b = z.b, s = scale;
  b.lathe('brass', x, y, zz, [[0.001, 0], [0.075 * s, 0], [0.085 * s, -0.012 * s], [0.06 * s, -0.035 * s], [0.022 * s, -0.05 * s], [0.018 * s, -0.11 * s], [0.03 * s, -0.125 * s], [0.001, -0.13 * s]], { seg: 14 });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5, c = Math.cos(a), sn = Math.sin(a);
    b.tube('brass', [[x + c * 0.02 * s, y - 0.1 * s, zz + sn * 0.02 * s], [x + c * 0.12 * s, y - 0.12 * s, zz + sn * 0.12 * s], [x + c * 0.2 * s, y - 0.2 * s, zz + sn * 0.2 * s], [x + c * 0.185 * s, y - 0.3 * s, zz + sn * 0.185 * s]], 0.008 * s, { seg: 6, tubular: 8 });
  }
  b.cyl('brass', x, y - 0.3 * s, zz, 0.192 * s, 0.022 * s, { seg: 20 });
  const mat = new THREE.MeshStandardNodeMaterial({ color: 0xd8cdb8, emissive: color, emissiveIntensity: 5, roughness: 0.55 });
  const bowl = new THREE.Mesh(ceilingLamp.geo ||= new THREE.SphereGeometry(0.185, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat);
  bowl.position.set(x, y - 0.3 * s, zz); bowl.scale.set(s, 0.62 * s, s);
  z.group.add(bowl);
  const lamp = world.lights.addLamp({ pos: [x, y - 0.42 * s, zz], color, intensity, range, zone: z.id, mat, emissive: 5.5, kind: 'ceiling' });
  z.lamps.push(lamp);
  return lamp;
}

export function buildCoachA(world) {
  const z = world.zone('A', A.x0 - 2, A.x1 + 1.2, 'A');
  const b = z.b;
  const { W, SILL, HEAD, CORN, DECK_Z, DECK_Y, CLER_Y, CROWN, PITCH, BAYS, BAY0, PILLAR } = A;
  const X0 = A.x0, X1 = A.x1;
  const bayX = (i) => BAY0 + i * PITCH;

  // --- floor -----------------------------------------------------------------------------------
  b.span('floor', X0, X1, -0.12, 0, -W - 0.1, W + 0.1, 'x');
  b.span('leather', X0 + 0.3, X1 - 0.3, 0, 0.006, -0.36, 0.36, 'x');           // aisle runner
  for (const s of [-1, 1]) b.span('brass', X0 + 0.3, X1 - 0.3, 0, 0.012, s * 0.36 - 0.012, s * 0.36 + 0.012, 'x');
  world.floor(X0 - 2, X1 + 1.2, -W, W, 0);

  for (const s of [-1, 1]) {
    // profile helper: (inset into the room, y) listed bottom → top; ordering fixed per side so normals face inward
    const prof = (pts) => { const p = pts.map(([inset, y]) => [s * (W - inset), y]); return s > 0 ? p.reverse() : p; };
    // --- wainscot with skirting and sill rail ---------------------------------------------------
    b.sweepX('walnutDark', prof([[0.055, 0], [0.055, 0.13], [0.03, 0.15]]), X0, X1);
    b.sweepX('walnut', prof([[0.03, 0.15], [0.03, 0.82]]), X0, X1);
    b.sweepX('walnutDark', prof([[0.03, 0.82], [0.06, 0.835], [0.075, 0.86], [0.075, 0.895], [0.06, SILL], [-0.1, SILL]]), X0, X1);
    // raised panel mouldings, two per bay
    for (let i = 0; i < BAYS; i++) for (const k of [0, 1]) {
      const px0 = bayX(i) + 0.08 + k * (PITCH / 2), px1 = px0 + PITCH / 2 - 0.16, zf = s * (W - 0.03 - 0.008);
      for (const [a0, a1, y0, y1] of [[px0, px1, 0.24, 0.265], [px0, px1, 0.715, 0.74], [px0, px0 + 0.025, 0.24, 0.74], [px1 - 0.025, px1, 0.24, 0.74]]) b.span('walnutDark', a0, a1, y0, y1, zf - 0.008, zf + 0.008, 'x');
    }
    // --- pillars, window reveals and glass ------------------------------------------------------
    for (let i = 0; i <= BAYS; i++) {
      const px = bayX(i);
      b.span('walnut', px - PILLAR / 2, px + PILLAR / 2, SILL, HEAD, s * (W - 0.03), s * (W + 0.12));
      b.span('walnutDark', px - PILLAR / 2 + 0.07, px + PILLAR / 2 - 0.07, SILL + 0.1, HEAD - 0.1, s * (W - 0.042), s * (W - 0.03)); // inset panel
      b.cyl('brass', px, 1.62, s * (W - 0.055), 0.012, 0.05, { axis: 'z', seg: 8 });                                             // coat hook boss
      b.tube('brass', [[px, 1.62, s * (W - 0.07)], [px, 1.6, s * (W - 0.11)], [px, 1.64, s * (W - 0.125)]], 0.006, { seg: 5, tubular: 5 });
    }
    for (let i = 0; i < BAYS; i++) {
      const wx0 = bayX(i) + PILLAR / 2, wx1 = bayX(i + 1) - PILLAR / 2;
      // reveal frame (4 thin boards) and a horizontal glazing bar
      b.span('walnutDark', wx0, wx1, HEAD - 0.045, HEAD, s * (W - 0.03), s * (W + 0.1), 'x');
      b.span('walnutDark', wx0, wx0 + 0.035, SILL, HEAD, s * (W - 0.01), s * (W + 0.1));
      b.span('walnutDark', wx1 - 0.035, wx1, SILL, HEAD, s * (W - 0.01), s * (W + 0.1));
      b.span('walnutDark', wx0, wx1, 1.50, 1.525, s * (W + 0.05), s * (W + 0.08), 'x');
      b.span('brass', (wx0 + wx1) / 2 - 0.05, (wx0 + wx1) / 2 + 0.05, SILL + 0.005, SILL + 0.03, s * (W + 0.0), s * (W + 0.04), 'x'); // sash lift
    }
    // one glass strip per side (windows are openings in front of it)
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0, HEAD - SILL), world.glassA ||= world.glassMaterial(0.22));
    glass.geometry.attributes.uv.array.forEach((v, k, arr) => { if (k % 2 === 0) arr[k] = v * 7; });
    glass.position.set((X0 + X1) / 2, (SILL + HEAD) / 2, s * (W + 0.07));
    glass.rotation.y = s > 0 ? Math.PI : 0;
    glass.renderOrder = 2;
    z.group.add(glass);

    // --- frieze, cornice and lower roof deck ----------------------------------------------------
    b.sweepX('walnut', prof([[0.03, HEAD], [0.03, CORN - 0.07]]), X0, X1);
    b.sweepX('walnutDark', prof([[0.03, CORN - 0.07], [0.055, CORN - 0.055], [0.07, CORN - 0.03], [0.07, CORN]]), X0, X1);
    const deck = arc(s * DECK_Z, CORN, W - DECK_Z - 0.07, 0, Math.PI / 2, 8).map(([a, y]) => [s * DECK_Z + (a - s * DECK_Z) * s, CORN + (y - CORN) * ((DECK_Y - CORN) / (W - DECK_Z - 0.07))]);
    b.sweepX('ceiling', s > 0 ? deck.slice().reverse() : deck, X0, X1, { smooth: true });
    // clerestory side with small lights
    b.sweepX('walnut', s < 0 ? [[s * DECK_Z, DECK_Y], [s * DECK_Z, CLER_Y]] : [[s * DECK_Z, CLER_Y], [s * DECK_Z, DECK_Y]], X0, X1);
    b.sweepX('walnutDark', s < 0 ? [[s * (DECK_Z + 0.03), DECK_Y], [s * DECK_Z, DECK_Y + 0.03]] : [[s * DECK_Z, DECK_Y + 0.03], [s * (DECK_Z + 0.03), DECK_Y]], X0, X1);
    for (let i = 0; i < BAYS; i++) {
      const cx = bayX(i) + PITCH / 2;
      b.span(world.mats.emissive('clerestory', 0x2c4468, 1.2), cx - 0.5, cx + 0.5, DECK_Y + 0.07, CLER_Y - 0.06, s * (DECK_Z - 0.004), s * (DECK_Z + 0.02), 'x');
    }
    // --- luggage rack ---------------------------------------------------------------------------
    for (const [inset, y] of [[0.1, 2.0], [0.22, 1.995], [0.34, 2.0]]) b.cyl('brass', (X0 + X1) / 2, y, s * (W - inset), 0.011, X1 - X0 - 0.5, { axis: 'x', seg: 6 });
    b.cyl('brass', (X0 + X1) / 2, 2.035, s * (W - 0.36), 0.014, X1 - X0 - 0.5, { axis: 'x', seg: 6 });
    for (let i = 0; i <= BAYS; i++) {
      const px = bayX(i);
      b.tube('brass', [[px, 1.8, s * (W - 0.03)], [px, 1.86, s * (W - 0.2)], [px, 1.98, s * (W - 0.33)], [px, 2.04, s * (W - 0.37)]], 0.011, { seg: 6, tubular: 8 });
      b.tube('brass', [[px, 2.0, s * (W - 0.03)], [px, 1.985, s * (W - 0.36)]], 0.008, { seg: 5, tubular: 2 });
    }
    // --- heater pipes along the wall base -------------------------------------------------------
    b.cyl('blackMetal', (X0 + X1) / 2, 0.2, s * (W - 0.1), 0.032, X1 - X0 - 0.6, { axis: 'x', seg: 8 });
    b.cyl('blackMetal', (X0 + X1) / 2, 0.29, s * (W - 0.1), 0.032, X1 - X0 - 0.6, { axis: 'x', seg: 8 });

    // --- exterior strip -------------------------------------------------------------------------
    const ext = new THREE.Mesh(new THREE.PlaneGeometry(240, 16), world.extMat ||= world.exteriorMaterial(0.3));
    ext.geometry.attributes.uv.array.forEach((v, k, arr) => { if (k % 2 === 0) arr[k] = v * 2.2 * s; });
    ext.position.set(X0 + 45, 3.2, s * 34);
    ext.rotation.y = s > 0 ? Math.PI : 0;
    z.group.add(ext);

    // gameplay: side walls + seat banks
    world.wall(X0 - 2, X1 + 2, s * W, s * (W + 1));
    world.wall(1.0, 19.0, s * 0.43, s * W, { h: 1.1, tag: 'seats' });
  }

  // --- upper ceiling and ribs --------------------------------------------------------------------
  const top = arc(0, CLER_Y - 0.6, Math.hypot(DECK_Z, 0.6) + 0.0, Math.atan2(0.6, DECK_Z), Math.PI - Math.atan2(0.6, DECK_Z), 8)
    .map(([a, y]) => [a, CLER_Y + (y - CLER_Y) * ((CROWN - CLER_Y) / (Math.hypot(DECK_Z, 0.6) - 0.6))]);
  b.sweepX('ceiling', top.slice().reverse(), X0, X1, { smooth: true });
  for (let i = 0; i <= BAYS; i++) {
    const px = bayX(i);
    const pts = [];
    for (const s of [1, -1]) {
      const d = arc(0, 0, 1, 0, Math.PI / 2, 5).map(([c, sn]) => [px, CORN + sn * (DECK_Y - CORN), s * (DECK_Z + c * (W - DECK_Z - 0.07))]);
      pts.push(s > 0 ? d : d.reverse());
    }
    b.tube('walnutDark', pts[0], 0.022, { seg: 6, tubular: 10 });
    b.tube('walnutDark', pts[1], 0.022, { seg: 6, tubular: 10 });
    b.span('walnutDark', px - 0.025, px + 0.025, CLER_Y + 0.02, CROWN + 0.02, -DECK_Z, DECK_Z, 'z');
  }

  // --- end walls -----------------------------------------------------------------------------------
  const DW = 0.44, DH = 2.02; // door half-width / height
  for (const [x, dir] of [[X0, 1], [X1, -1]]) {
    const xa = dir > 0 ? x - 0.12 : x, xb = dir > 0 ? x : x + 0.12;
    b.span('walnut', xa, xb, 0, CROWN + 0.05, DW + 0.06, W + 0.1);
    b.span('walnut', xa, xb, 0, CROWN + 0.05, -W - 0.1, -DW - 0.06);
    b.span('walnut', xa, xb, DH + 0.06, CROWN + 0.05, -DW - 0.06, DW + 0.06, 'z');
    // door casing
    const xc0 = x - 0.14, xc1 = x + 0.14;
    b.span('walnutDark', xc0, xc1, 0, DH + 0.06, DW, DW + 0.07);
    b.span('walnutDark', xc0, xc1, 0, DH + 0.06, -DW - 0.07, -DW);
    b.span('walnutDark', xc0, xc1, DH, DH + 0.07, -DW - 0.07, DW + 0.07, 'z');
    world.wall(x - 0.12, x + 0.12, DW, W);
    world.wall(x - 0.12, x + 0.12, -W, -DW);
  }
  world.wall(X0 - 2.2, X0 - 2, -W, W); // behind the rear vestibule

  // --- lamps -----------------------------------------------------------------------------------------
  for (let i = 0; i < 5; i++) ceilingLamp(world, z, bayX(1 + i * 2), CROWN - 0.005, 0);

  // --- seats (generated bench), two per row --------------------------------------------------------
  const rows = 18;
  for (let r = 0; r < rows; r++) {
    const x = 1.45 + r * 0.98;
    for (const s of [-1, 1]) z.pb.place('bench', x, 0, s * 0.94, { size: 0.98, fit: 'x', ry: Math.PI / 2, stretch: [1, 1.26, 1.12] });
  }

  world.markers.spawn = { x: 4.4, z: 0, facing: 1 };
  world.finishZone(z);
  return z;
}
