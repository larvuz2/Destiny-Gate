import * as THREE from 'three/webgpu';
import { gangway } from './coachB.js';
import { ironHall, deck, railing, stilts, pit, hangLamp, lightShaft, luggageBank } from '../industrial.js';

// Coach C — baggage / maintenance car (GDD 9.2, 10.2–10.4). Watch discovery, the reversible
// crossing, the reveal behind a barrier and the first hunt around a narrow loop.
export const C = {
  x0: 50.5, x1: 74.5, W: 4, H: 3.1, CROWN: 4.7,
  GAP0: 54, GAP1: 58, GRILLE: 62, BLOCK0: 66, BLOCK1: 70, RING1: 72, NECK: 1.2,
};

export function buildCoachC(world) {
  const z = world.zone('C', 49.6, 75.5, 'C');
  const { x0, x1, W, H, CROWN, GAP0, GAP1, GRILLE, BLOCK0, BLOCK1, RING1, NECK } = C;
  z.ceiling = CROWN - 0.3; z.fog = { color: 0x05070a, density: 0.045 }; z.exposure = 1.0;
  z.hemi = { sky: 0x4f6f92, ground: 0x1c1610, intensity: 0.42 }; z.keyHeight = 3.6;
  const b = z.b;

  gangway(world, z, 48.62, 50.38, { top: 2.6 });
  ironHall(world, z, { x0, x1, W, H, crown: CROWN, ribEvery: 2.4, pad: [[51.2, 53.4, -1], [59, 61.6, 1, 0.4, 2.7], [62.6, 65.4, -1], [70.4, 71.8, 1, 0.5, 2.2]] });
  // end walls (iron) with door openings
  for (const [x, dir, dw] of [[x0, 1, 0.44], [x1, -1, 0.44]]) {
    const xa = dir > 0 ? x - 0.2 : x, xb = dir > 0 ? x : x + 0.2;
    b.span('ironDark', xa, xb, 0, CROWN, dw + 0.06, W + 0.1); b.span('ironDark', xa, xb, 0, CROWN, -W - 0.1, -dw - 0.06);
    b.span('ironDark', xa, xb, 2.08, CROWN, -dw - 0.06, dw + 0.06, 'z');
    b.span('iron', x - 0.22, x + 0.22, 0, 2.08, dw, dw + 0.09); b.span('iron', x - 0.22, x + 0.22, 0, 2.08, -dw - 0.09, -dw); b.span('iron', x - 0.22, x + 0.22, 2.02, 2.11, -dw - 0.09, dw + 0.09, 'z');
    world.wall(x - 0.2, x + 0.2, dw, W + 0.2); world.wall(x - 0.2, x + 0.2, -W - 0.2, -dw);
  }

  // --- landing 1: lantern post, conductor's cabinet -----------------------------------------------
  deck(world, z, x0, GAP0, -W, W, { mat: 'iron', surface: 'metal' });
  luggageBank(world, z, 50.9, 52.6, 2.5, 3.7, { h: 1.9, seed: 3 });
  luggageBank(world, z, 50.9, 52.2, -3.8, -2.7, { h: 1.4, seed: 5 });
  // lantern post (right of the bridge head)
  b.cyl('iron', 53.35, 0.95, 1.55, 0.045, 1.9, { seg: 8 });
  b.tube('iron', [[53.35, 1.85, 1.55], [53.33, 1.95, 1.4], [53.3, 1.88, 1.22]], 0.02, { seg: 6, tubular: 6 });
  world.markers.lantern = { x: 53.3, y: 1.46, z: 1.22, standX: 52.7, standZ: 1.0 };
  // cabinet pillar (left of the bridge head)
  b.span('iron', 53.2, 53.5, 0, 2.3, -1.75, -1.4);
  z.pb.place('cabinet', 53.16, 1.05, -1.575, { size: 0.62, fit: 'y', ry: -Math.PI / 2 });
  world.wall(53.15, 53.5, -1.78, -1.38, { h: 2.3 });
  world.markers.watch = { x: 53.1, y: 1.38, z: -1.575, standX: 52.55, standZ: -1.3 };

  // --- the gap and the service bridge ---------------------------------------------------------------
  pit(world, z, GAP0, GAP1, -W, W);
  world.panel({ id: 'C_bridge', zone: 'C', x0: GAP0, x1: GAP1, z0: -0.65, z1: 0.65, mat: 'plank', frags: 20, thickness: 0.08, autoFail: false, surface: 'wood' });
  for (const s of [-1, 1]) { // bridge-head posts and rope stubs
    for (const x of [GAP0 - 0.08, GAP1 + 0.08]) b.cyl('iron', x, 0.55, s * 0.72, 0.035, 1.1, { seg: 8 });
    b.tube('rust', [[GAP0 - 0.08, 1.05, s * 0.72], [GAP0 + 0.7, 0.86, s * 0.72], [GAP0 + 1.2, 0.5, s * 0.74]], 0.014, { seg: 5, tubular: 8 });
    b.tube('rust', [[GAP1 + 0.08, 1.05, s * 0.72], [GAP1 - 0.6, 0.88, s * 0.72], [GAP1 - 1.0, 0.45, s * 0.7]], 0.014, { seg: 5, tubular: 8 });
  }
  railing(z, [[GAP0, -W + 0.1], [GAP0, -0.75]]); railing(z, [[GAP0, 0.75], [GAP0, W - 0.1]]);
  railing(z, [[GAP1, -W + 0.1], [GAP1, -0.75]]); railing(z, [[GAP1, 0.75], [GAP1, W - 0.1]]);
  // luggage net overhead that will come down on the bridge
  world.markers.luggageDrop = { x: 56.0, y: 3.5, z: 0 };
  b.tube('rust', [[56, CROWN - 0.1, 0], [56, 3.9, 0]], 0.012, { seg: 5, tubular: 1 });

  // --- landing 2 ---------------------------------------------------------------------------------------
  deck(world, z, GAP1, GRILLE, -W, W, { mat: 'iron', surface: 'metal' });
  luggageBank(world, z, 59.3, 61.3, 2.0, 3.2, { h: 2.2, seed: 11 });
  z.pb.place('crate', 60.8, 0, -3.3, { size: 0.9, fit: 'x', ry: 0.3 });
  world.wall(60.3, 61.3, -3.8, -2.85, { h: 0.9 });
  world.markers.coverSpot = { x: 60.3, z: 3.62 }; // behind the luggage bank (between bank and wall)
  // the bank leaves a 0.4 m slot against the wall: widen the hiding pocket
  world.markers.softCheckpoint = { x: 58.9, z: 0, yaw: Math.PI / 2 };

  // --- cage grille with gate; side passage on the left ------------------------------------------
  const bars = (za, zb) => { for (let q = za; q <= zb + 1e-3; q += 0.16) b.cyl('blackMetal', GRILLE, 1.5, q, 0.014, 3.0, { seg: 5 }); };
  bars(-2.6, -0.72); bars(0.72, W - 0.1);
  for (const y of [0.05, 1.1, 2.2, 3.0]) { b.span('iron', GRILLE - 0.03, GRILLE + 0.03, y, y + 0.06, -2.6, -0.7, 'z'); b.span('iron', GRILLE - 0.03, GRILLE + 0.03, y, y + 0.06, 0.7, W, 'z'); }
  b.span('iron', GRILLE - 0.06, GRILLE + 0.06, 0, 3.06, -2.7, -2.58); b.span('iron', GRILLE - 0.06, GRILLE + 0.06, 0, 3.06, -0.76, -0.68); b.span('iron', GRILLE - 0.06, GRILLE + 0.06, 0, 3.06, 0.68, 0.76);
  b.span('iron', GRILLE - 0.05, GRILLE + 0.05, 2.2, 3.06, -0.7, 0.7, 'z');
  world.wall(GRILLE - 0.06, GRILLE + 0.06, -2.7, -0.7, { noSight: true, tag: 'grille' });
  world.wall(GRILLE - 0.06, GRILLE + 0.06, 0.7, W, { noSight: true, tag: 'grille' });
  // gate leaf (dynamic): barred frame hinged at +z
  const gate = new THREE.Group();
  const gm = world.mats.get('blackMetal'), fm = world.mats.get('iron');
  for (let q = -1.3; q <= -0.05; q += 0.155) { const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 2.1, 5), gm); bar.position.set(0, 1.1, q); gate.add(bar); }
  for (const y of [0.06, 1.1, 2.14]) { const r = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 1.38), fm); r.position.set(0, y, -0.69); gate.add(r); }
  gate.position.set(GRILLE, 0, 0.69);
  z.group.add(gate);
  const gateWall = world.wall(GRILLE - 0.06, GRILLE + 0.06, -0.7, 0.7, { noSight: true, tag: 'gate' });
  world.gate = { group: gate, wall: gateWall, open: 0, target: 0, burst: 0 };
  world.dynamic.push({ update: (dt) => {
    const g = world.gate;
    if (Math.abs(g.target - g.open) > 0.001) g.open += Math.sign(g.target - g.open) * Math.min(Math.abs(g.target - g.open), dt * 2.6);
    gate.rotation.y = -g.open * 1.9 + Math.sin(g.burst * 40) * 0.02 * (g.burst > 0 ? 1 : 0);
    const en = g.open < 0.4; if (gateWall.enabled !== en) { gateWall.enabled = en; world.navDirty = true; }
  } });

  // --- ring: reveal floor, central cage block, covers --------------------------------------------
  const RV = { x0: 64.1, x1: 65.9, z0: -0.9, z1: 0.9 };
  const fm2 = { mat: 'iron', surface: 'metal' };
  deck(world, z, GRILLE, RV.x0, -W, W, fm2); deck(world, z, RV.x1, RING1, -W, W, fm2);
  deck(world, z, RV.x0, RV.x1, -W, RV.z0, fm2); deck(world, z, RV.x0, RV.x1, RV.z1, W, fm2);
  world.panel({ id: 'C_reveal', zone: 'C', ...RV, mat: 'grate', frags: 12, thickness: 0.06, autoFail: false, surface: 'metal' });
  pit(world, z, RV.x0, RV.x1, RV.z0, RV.z1, { depth: 9 });
  // central block: a caged stack of hanging cases
  b.span('ironDark', BLOCK0, BLOCK1, 0, 0.5, -1.6, 1.6, 'x');
  for (const [cx, cz] of [[BLOCK0, -1.6], [BLOCK0, 1.6], [BLOCK1, -1.6], [BLOCK1, 1.6]]) b.span('iron', cx - 0.09, cx + 0.09, 0, H + 0.6, cz - 0.09, cz + 0.09);
  for (const y of [0.5, 1.6, 2.7]) { b.span('iron', BLOCK0, BLOCK1, y, y + 0.07, -1.64, -1.56, 'x'); b.span('iron', BLOCK0, BLOCK1, y, y + 0.07, 1.56, 1.64, 'x'); b.span('iron', BLOCK0 - 0.04, BLOCK0 + 0.04, y, y + 0.07, -1.6, 1.6, 'z'); b.span('iron', BLOCK1 - 0.04, BLOCK1 + 0.04, y, y + 0.07, -1.6, 1.6, 'z'); }
  for (let q = BLOCK0 + 0.25; q < BLOCK1; q += 0.25) for (const s of [-1, 1]) b.cyl('blackMetal', q, 1.85, s * 1.6, 0.011, 2.7, { seg: 4 });
  for (let q = -1.35; q < 1.5; q += 0.25) for (const x of [BLOCK0, BLOCK1]) b.cyl('blackMetal', x, 1.85, q, 0.011, 2.7, { seg: 4 });
  let k = 0;
  for (let x = BLOCK0 + 0.6; x < BLOCK1 - 0.3; x += 0.95) for (const zz of [-0.8, 0.1, 0.9]) {
    const n = ['suitcase_a', 'suitcase_b', 'crate', 'sample_case'][k++ % 4], y = 0.5 + ((k * 7) % 5) * 0.12;
    z.pb.place(n, x, y, zz, { size: 0.62 + (k % 3) * 0.14, fit: 'x', ry: k * 1.3 });
    if (k % 2) { z.pb.place('suitcase_a', x + 0.1, 2.0 + (k % 3) * 0.2, zz, { size: 0.6, fit: 'x', ry: k * 0.7, rz: 0.2 }); b.tube('rust', [[x + 0.1, H + 0.9, zz], [x + 0.1, 2.4 + (k % 3) * 0.2, zz]], 0.008, { seg: 4, tubular: 1 }); }
  }
  world.wall(BLOCK0, BLOCK1, -1.6, 1.6, { h: 3, tag: 'block' });
  luggageBank(world, z, 67.4, 68.8, 3.05, 3.85, { h: 2.0, seed: 21 });
  luggageBank(world, z, 67.2, 68.7, -3.85, -3.15, { h: 2.0, seed: 27 });
  z.pb.place('valves', 63.2, 0.6, W - 0.12, { size: 0.95, fit: 'y', ry: Math.PI });
  z.pb.place('heater', 71.2, 0.02, -W + 0.3, { size: 1.6, fit: 'x' });
  z.pb.place('valves', 69.3, 0.5, -W + 0.12, { size: 0.9, fit: 'y', ry: 0 });

  // --- neck to the exit: fragile floor, concealed release, barred door ---------------------------
  for (const s of [-1, 1]) {
    b.span('ironDark', RING1, x1, 0, CROWN, s * NECK, s * (NECK + 0.2), 'x');
    b.span('ironDark', RING1 - 0.2, RING1, 0, CROWN, s * NECK, s * W, 'z');
    world.wall(RING1 - 0.2, x1, s * NECK, s * W);
  }
  deck(world, z, RING1 - 0.2, 72.15, -NECK, NECK, fm2); deck(world, z, 74.2, x1, -NECK, NECK, fm2);
  world.panel({ id: 'C_exit', zone: 'C', x0: 72.15, x1: 74.2, z0: -NECK, z1: NECK, mat: 'grate', frags: 14, thickness: 0.06, autoFail: true, fragile: true, surface: 'metal' });
  pit(world, z, 72.15, 74.2, -NECK, NECK, { depth: 9 });
  world.door(z, 'C_exit', x1, { locked: true });
  // door bar (lifts when the release is thrown)
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 1.25), world.mats.get('iron'));
  bar.position.set(x1 - 0.13, 1.1, 0); bar.castShadow = true; z.group.add(bar);
  world.exitBar = { mesh: bar, lift: 0, target: 0 };
  world.dynamic.push({ update: (dt) => { const e = world.exitBar; e.lift += (e.target - e.lift) * Math.min(1, dt * 4); bar.position.y = 1.1 + e.lift * 0.95; bar.rotation.x = e.lift * 0.5; } });
  // concealed release on the ring's east wall (right-hand side). Hidden behind a canvas flap until lit.
  world.markers.release = { x: RING1 - 0.26, y: 1.2, z: 2.7, standX: 71.1, standZ: 2.7 };
  z.pb.place('latch', RING1 - 0.24, 1.02, 2.7, { size: 0.36, fit: 'y', ry: -Math.PI / 2 });
  b.tube('coldBrass', [[RING1 - 0.26, 1.2, 2.5], [RING1 - 0.26, 2.6, 2.3], [RING1 - 0.26, 2.9, 1.4], [RING1 - 0.26, 2.9, 0]], 0.02, { seg: 6, tubular: 14 }); // linkage to the door

  // --- lamps -----------------------------------------------------------------------------------------
  hangLamp(world, z, 52.2, CROWN - 0.15, 0, { len: 1.5, intensity: 30 });
  lightShaft(world, z, 52.2, 0.02, CROWN - 1.7, 0, { r0: 0.2, r1: 1.5, power: 0.5 });
  hangLamp(world, z, 60.0, CROWN - 0.2, -0.6, { len: 1.6, intensity: 24 });
  z.revealLamp = hangLamp(world, z, 64.0, CROWN - 0.15, 0, { len: 1.55, intensity: 110, range: 9, swing: 0.16, priority: 40 });
  // cold rim from behind the tableau so the silhouette separates from the cage (GDD 12.3 negative space)
  world.lights.addLamp({ pos: [66.2, 2.4, 0], color: 0x8fb4dc, intensity: 70, range: 6, zone: 'C', kind: 'rim', priority: 30 });
  lightShaft(world, z, 65.0, 0.02, CROWN - 1.6, 0, { r0: 0.3, r1: 1.7, power: 0.7, color: 0xffd2a0 });
  hangLamp(world, z, 68.2, CROWN - 0.5, 2.8, { len: 1.3, intensity: 18, range: 7 });
  hangLamp(world, z, 68.2, CROWN - 0.5, -2.8, { len: 1.3, intensity: 18, range: 7 });
  hangLamp(world, z, 71.0, CROWN - 0.4, -0.2, { len: 1.5, intensity: 22 });
  z.exitLamp = hangLamp(world, z, 73.2, CROWN - 0.2, 0, { len: 1.9, intensity: 20, color: 0xffa868 });
  // cold bounce from below the gap
  world.lights.addLamp({ pos: [56, -1.2, 0], color: 0x4f7fb0, intensity: 16, range: 9, zone: 'C', kind: 'fill' });

  // --- gameplay markers ---------------------------------------------------------------------------
  world.markers.tableau = { x: 65.0, z: 0 };
  world.markers.patrolC = [[63.1, 2.8], [66.6, 2.8], [71.0, 2.9], [71.0, -2.8], [66.6, -2.8], [63.1, -2.8]];
  world.markers.landingSearch = { x: 60.0, z: -0.4 };
  world.finishZone(z);
  return z;
}
