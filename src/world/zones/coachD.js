import * as THREE from 'three/webgpu';
import { gangway } from './coachB.js';
import { ironHall, deck, railing, stilts, pit, hangLamp, lightShaft } from '../industrial.js';

// Coach D — the coupling rig (GDD 9.4, 10.5). A ring gallery around a central grating that hangs
// on two pins under a counterweight. Left walkway is broken (Watch), control deck holds the
// release pin (Wrench), the right-hand walkway holds the cable that springs the trap.
export const D = {
  x0: 76.5, x1: 92.5, W: 5, H: 4.4, CROWN: 7.2,
  PIT0: 79.5, PIT1: 89.5, G0: 82, G1: 86, GZ: 1.5, BRZ: 1.0, WK: 3.8,
};

export function buildCoachD(world) {
  const z = world.zone('D', 75.5, 92.5, 'D');
  const { x0, x1, W, H, CROWN, PIT0, PIT1, G0, G1, GZ, BRZ, WK } = D;
  z.ceiling = CROWN - 0.5; z.fog = { color: 0x040506, density: 0.03 }; z.exposure = 1.2;
  z.hemi = { sky: 0x5a6a80, ground: 0x1a1612, intensity: 0.6 };
  z.key = { pos: [84, 6.4, 0.6], target: [84, 0, 0], intensity: 420, angle: 0.78, color: 0xfff0d8, distance: 16 };
  const b = z.b;

  gangway(world, z, 74.62, 76.38, { top: 2.6 });
  ironHall(world, z, { x0, x1, W, H, crown: CROWN, ribEvery: 2.67, pad: [[77, 79, 1, 0.4, 3.0], [89.8, 92, -1, 0.4, 3.2], [84, 87, 1, 1.6, 3.6]] });
  for (const [x, dir] of [[x0, 1], [x1, -1]]) {
    const dw = 0.44, xa = dir > 0 ? x - 0.2 : x, xb = dir > 0 ? x : x + 0.2;
    b.span('ironDark', xa, xb, 0, CROWN, dw + 0.06, W + 0.1); b.span('ironDark', xa, xb, 0, CROWN, -W - 0.1, -dw - 0.06);
    b.span('ironDark', xa, xb, 2.08, CROWN, -dw - 0.06, dw + 0.06, 'z');
    b.span('iron', x - 0.22, x + 0.22, 0, 2.08, dw, dw + 0.09); b.span('iron', x - 0.22, x + 0.22, 0, 2.08, -dw - 0.09, -dw); b.span('iron', x - 0.22, x + 0.22, 2.02, 2.11, -dw - 0.09, dw + 0.09, 'z');
    world.wall(x - 0.2, x + 0.2, dw, W + 0.2); world.wall(x - 0.2, x + 0.2, -W - 0.2, -dw);
  }
  world.door(z, 'D_exit', x1, { locked: true });

  // --- platforms and the pit ---------------------------------------------------------------------
  deck(world, z, x0, PIT0, -W, W, { mat: 'iron' });
  deck(world, z, PIT1, x1, -W, W, { mat: 'iron' });
  pit(world, z, PIT0, PIT1, -W, W, { depth: 13 });

  // central line: west bridge → grating (panel) → east bridge
  deck(world, z, PIT0, G0, -BRZ, BRZ);
  deck(world, z, G1, PIT1, -BRZ, BRZ);
  world.panel({ id: 'D_grate', zone: 'D', x0: G0, x1: G1, z0: -GZ, z1: GZ, mat: 'grate', frags: 22, thickness: 0.07, autoFail: false, stressOnly: true, surface: 'metal', rewindable: false });
  // frame the grating hangs in, with the two pin housings
  for (const s of [-1, 1]) b.span('iron', G0 - 0.1, G1 + 0.1, -0.34, -0.02, s * GZ, s * (GZ + 0.14), 'x');
  for (const x of [G0 - 0.1, G1]) { b.span('iron', x, x + 0.1, -0.34, -0.02, -GZ, -BRZ, 'z'); b.span('iron', x, x + 0.1, -0.34, -0.02, BRZ, GZ, 'z'); }
  stilts(z, [[PIT0 + 0.3, -BRZ + 0.15], [PIT0 + 0.3, BRZ - 0.15], [PIT1 - 0.3, -BRZ + 0.15], [PIT1 - 0.3, BRZ - 0.15], [G0 - 0.25, -BRZ + 0.15], [G0 - 0.25, BRZ - 0.15], [G1 + 0.25, -BRZ + 0.15], [G1 + 0.25, BRZ - 0.15]], { depth: 13 });
  railing(z, [[PIT0, -BRZ], [G0, -BRZ]]); railing(z, [[PIT0, BRZ], [G0, BRZ]]); railing(z, [[G1, -BRZ], [PIT1, -BRZ]]); railing(z, [[G1, BRZ], [PIT1, BRZ]]);

  // left (−z) walkway: stub → broken span (panel) → control deck → east run
  deck(world, z, PIT0, 80.5, -W, -WK);
  world.panel({ id: 'D_walk', zone: 'D', x0: 80.5, x1: 83.5, z0: -W, z1: -WK, mat: 'grate', frags: 14, thickness: 0.06, autoFail: false, surface: 'metal', startFailed: true });
  deck(world, z, 83.5, 86.5, -W, -3.0);
  deck(world, z, 86.5, PIT1, -W, -WK);
  railing(z, [[PIT0, -WK], [80.5, -WK]]); railing(z, [[83.5, -3.0], [84.4, -3.0]]); railing(z, [[85.6, -3.0], [86.5, -3.0], [86.5, -WK], [PIT1, -WK]]);
  stilts(z, [[83.7, -3.2], [86.3, -3.2], [80.3, -WK - 0.15], [88, -WK - 0.15]], { depth: 13 });

  // right (+z) walkway: east platform → tip with the cable; crawl gap back to the west platform
  deck(world, z, G0, PIT1, WK, W);
  deck(world, z, PIT0, G0, 4.1, W, { mat: 'iron' });
  railing(z, [[G0 + 0.02, WK], [82.7, WK]]); railing(z, [[83.7, WK], [PIT1, WK]]);
  stilts(z, [[82.3, WK + 0.15], [85.5, WK + 0.15], [88.5, WK + 0.15]], { depth: 13 });
  // the crawl gap: a low arch of pipes only Mitchell fits under
  for (const x of [79.9, 80.7, 81.5]) { b.tube('rust', [[x, 0, 4.12], [x, 1.25, 4.15], [x, 1.5, 4.5], [x, 1.25, 4.92], [x, 0.9, W - 0.02]], 0.06, { seg: 6, tubular: 10 }); }
  b.span('ironDark', PIT0, G0, 1.5, 3.2, 4.05, 4.2, 'x');
  z.pb.place('valves', 80.8, 1.6, 4.0, { size: 1.0, fit: 'y', ry: Math.PI });
  world.wall(PIT0, G0, 4.1, W, { only: 'madness', tag: 'crawl' });
  world.markers.crawl = { x0: PIT0, x1: G0, z0: 4.1, z1: W };

  // --- trap hardware --------------------------------------------------------------------------------
  // overhead counterweight on chains above the grating
  const cw = z.pb.single('counterweight', { size: 2.6, fit: 'y' });
  cw.position.set(84, 3.2, 0); cw.scale.x *= 1.5; cw.scale.z *= 1.9;
  z.group.add(cw);
  world.counterweight = { group: cw, y0: 3.2, drop: 0, target: 0, sway: 0 };
  for (const [cx, cz] of [[G0 + 0.3, -GZ + 0.2], [G0 + 0.3, GZ - 0.2], [G1 - 0.3, -GZ + 0.2], [G1 - 0.3, GZ - 0.2]]) b.tube('iron', [[cx, 0.02, cz], [cx * 0.5 + 42, 3.0, cz * 0.4], [84, 5.6, 0]], 0.022, { seg: 5, tubular: 10 });
  b.span('iron', 83.2, 84.8, CROWN - 1.2, CROWN - 0.9, -0.5, 0.5); b.cyl('iron', 84, CROWN - 0.9, 0, 0.3, 0.5, { axis: 'z', seg: 14 });
  world.dynamic.push({ update: (dt, t) => {
    const c = world.counterweight;
    c.drop += (c.target - c.drop) * Math.min(1, dt * (c.target > 1 ? 9 : 3));
    cw.position.y = c.y0 - c.drop * 0.35 - Math.max(0, c.drop - 1) * 9;
    cw.rotation.z = Math.sin(t * 0.9) * 0.012 + c.sway * Math.sin(t * 7) * 0.03;
    c.sway = Math.max(0, c.sway - dt * 0.6);
  } });
  // release pin on the control deck (inner edge, facing the grating)
  const pin = z.pb.single('release_pin', { size: 0.42, fit: 'y' });
  pin.position.set(85.0, 0.0, -3.22); pin.rotation.y = Math.PI;
  z.group.add(pin);
  world.markers.pin = { x: 85.0, y: 0.5, z: -3.22, standX: 85.0, standZ: -3.75, obj: pin };
  // cable handle on the right-hand walkway rail
  b.cyl('iron', 83.2, 0.75, WK + 0.02, 0.04, 1.5, { seg: 8 });
  b.tube('rust', [[83.2, 1.5, WK], [83.4, 3.6, 2.4], [84, 5.4, 0.4]], 0.012, { seg: 5, tubular: 10 });
  const handle = z.pb.single('cable_handle', { size: 0.62, fit: 'y' });
  handle.position.set(83.2, 0.92, WK - 0.08); handle.rotation.y = Math.PI;
  z.group.add(handle);
  world.markers.handle = { x: 83.2, y: 1.2, z: WK - 0.05, standX: 83.2, standZ: WK + 0.55, obj: handle, y0: 0.92 };
  // red tension marks at the pin housings (focal hazard colour, GDD 12.3)
  const tm = new THREE.MeshStandardNodeMaterial({ color: 0x1a0705, emissive: 0xff3b1a, emissiveIntensity: 0, roughness: 0.6 });
  world.tension = { mat: tm, k: 0 };
  for (const x of [G0 - 0.06, G1 + 0.06]) for (const s of [-1, 1]) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.5), tm); m.position.set(x, 0.03, s * 1.22); z.group.add(m); }

  // --- props ---------------------------------------------------------------------------------------
  z.pb.place('crate', 77.4, 0, -4.2, { size: 1.1, fit: 'x', ry: 0.2 }); z.pb.place('crate', 77.5, 0.94, -4.25, { size: 0.9, fit: 'x', ry: -0.3 });
  world.wall(76.8, 78.1, -4.8, -3.6, { h: 1.8 });
  z.pb.place('heater', 91.9, 0.02, 2.8, { size: 2.0, fit: 'x', ry: Math.PI / 2 });
  z.pb.place('valves', 91.6, 0.9, -W + 0.14, { size: 1.2, fit: 'y' });
  z.pb.place('suitcase_b', 91.8, 0, 4.3, { size: 0.9, fit: 'y', ry: 2.2 });
  world.wall(91.35, 92.3, 3.85, 4.8, { h: 1.0 });

  // --- lamps: hard overhead key, deep side fill -------------------------------------------------
  z.arc = [hangLamp(world, z, 82.6, CROWN - 0.3, 0, { len: 1.2, intensity: 60, range: 13, color: 0xfff1dc, emissive: 12, priority: 60 }),
           hangLamp(world, z, 85.4, CROWN - 0.3, 0, { len: 1.2, intensity: 60, range: 13, color: 0xfff1dc, emissive: 12, priority: 60 })];
  lightShaft(world, z, 84, 0.0, CROWN - 1.6, 0, { r0: 0.5, r1: 2.6, power: 0.75, color: 0xfff1dc });
  hangLamp(world, z, 78, 4.4, 0, { len: 1.2, intensity: 22, range: 8 });
  hangLamp(world, z, 85, 4.2, -4.3, { len: 1.3, intensity: 18, range: 6.5 });
  hangLamp(world, z, 84.5, 4.2, 4.4, { len: 1.3, intensity: 18, range: 6.5 });
  hangLamp(world, z, 91, 4.4, 0, { len: 1.2, intensity: 22, range: 8, color: 0xbfd6ff });
  world.lights.addLamp({ pos: [84, -2.2, 0], color: 0x35557a, intensity: 30, range: 11, zone: 'D', kind: 'fill' });

  // --- markers ---------------------------------------------------------------------------------------
  world.markers.cp2 = { x: 77.4, z: 0, yaw: Math.PI / 2 };
  world.markers.madnessEntry = { x: 77.3, z: 0 };
  world.markers.grate = { x0: G0, x1: G1, z0: -GZ, z1: GZ, cx: (G0 + G1) / 2 };
  world.markers.lureZone = { x0: 82, x1: 85.5, z0: WK, z1: W };
  world.markers.patrolD = [[78, 0], [80.8, 0], [84, 0], [88, 0], [91, 0], [91, 3], [87, 4.4], [91, 0], [84, 0], [78, 0], [78, 3], [78, -3]];
  world.finishZone(z);
  return z;
}
