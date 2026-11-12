import * as THREE from 'three/webgpu';
import { coachShell, endWall, ceilingLamp, SHELL } from '../shell.js';

// Gangway A→B and Coach B — the impossible aisle (GDD 9.2, 10.1, 10.2 / Phase B "surreal infection").
export const B = { x0: 22.5, x1: 48.5, YS: 1.3, LOOP_AT: 30.45, LOOP_LEN: 3.8, SEATS_END: 41.6 };

/** Canvas-bellows vestibule between two coaches. */
export function gangway(world, z, x0, x1, { hw = 0.78, top = 2.3, floorMat = 'iron' } = {}) {
  const b = z.b;
  b.span(floorMat, x0, x1, -0.12, 0, -hw - 0.1, hw + 0.1, 'x');
  b.span('brass', x0 + 0.02, x0 + 0.1, 0, 0.014, -0.44, 0.44, 'z');
  b.span('brass', x1 - 0.1, x1 - 0.02, 0, 0.014, -0.44, 0.44, 'z');
  const n = Math.round((x1 - x0) / 0.16);
  for (const s of [-1, 1]) {
    // accordion profile swept vertically: build as thin ridged boxes
    for (let i = 0; i < n; i++) {
      const xa = x0 + ((x1 - x0) * i) / n, xb = x0 + ((x1 - x0) * (i + 1)) / n, deep = i % 2 ? 0.0 : 0.07;
      b.span('canvasDark', xa, xb, 0, top, s * (hw + deep), s * (hw + deep + 0.05));
    }
    world.wall(x0, x1, s * hw, s * (hw + 1));
  }
  for (let i = 0; i < n; i++) {
    const xa = x0 + ((x1 - x0) * i) / n, xb = x0 + ((x1 - x0) * (i + 1)) / n, deep = i % 2 ? 0.0 : 0.07;
    b.span('canvasDark', xa, xb, top + deep, top + deep + 0.05, -hw - 0.1, hw + 0.1, 'z');
  }
  world.floor(x0 - 0.16, x1 + 0.16, -0.44, 0.44, 0, { surface: 'metal' }); // overlaps both thresholds
  world.floor(x0, x1, -hw, hw, 0, { surface: 'metal' });
}

export function buildCoachB(world) {
  const z = world.zone('B', 21.2, 49.6, 'B');
  const { x0, x1, YS } = B;
  z.ceiling = SHELL.CROWN * YS; z.fog = { color: 0x060a0c, density: 0.06 }; z.exposure = 1.15;
  z.hemi = { sky: 0x6f9db0, ground: 0x1c2a2c, intensity: 1.1 };
  const mats = { wall: 'petrolWood', trim: 'petrolDark', ceil: 'ashCeiling', floor: 'coldFloor', metal: 'coldBrass', runner: null, pipe: 'ironGreen' };

  // --- vestibule A→B with the stretching doorway -------------------------------------------------
  gangway(world, z, 20.12, 22.38, { top: 2.95 });
  world.door(world.zones.find((q) => q.id === 'A'), 'A_front', 20.0, { open: 0, swing: 1 });
  const DH0 = 2.02, DH1 = DH0 * YS;
  endWall(world, z, x0, 1, { top: SHELL.CROWN * YS + 0.05, DH: DH1, mats });
  // lintel filler that rises as the frame stretches
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1, 0.96), world.mats.get('petrolDark'));
  lintel.position.set(x0, DH0 + (DH1 - DH0) / 2, 0);
  lintel.scale.y = DH1 - DH0;
  z.group.add(lintel);
  world.stretch = { k: 0, lintel, DH0, DH1 };
  world.dynamic.push({ update: () => {
    const k = world.stretch.k, h = (DH1 - DH0) * (1 - k);
    lintel.visible = h > 0.01; lintel.scale.y = Math.max(0.001, h); lintel.position.y = DH1 - h / 2;
  } });

  // --- shell ---------------------------------------------------------------------------------------
  const sh = coachShell(world, z, {
    x0, x1, bay0: x0 + 0.35, bays: 13, ys: YS, mats, windows: { left: false, right: true },
    glass: world.glass('B', 0.6), ext: null, clerestory: { key: 'clerB', color: 0x1d4a5c, power: 0.9 },
  });
  world.floor(x0, x1, -SHELL.W, SHELL.W, 0, { surface: 'wood', id: 'B_floor' });
  // cold glow behind the frosted windows
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, 2.2), world.mats.emissive('frostGlow', 0x3a6474, 0.3));
  glow.position.set((x0 + x1) / 2, 1.9, SHELL.W + 0.5); glow.rotation.y = Math.PI;
  z.group.add(glow);

  // lamps every two bays — identical through the looping section
  z.rhythm = [];
  for (let i = 0; i < 7; i++) z.rhythm.push(ceilingLamp(world, z, sh.bayX(1 + i * 2) - 0.0, sh.CROWN - 0.005, 0, { color: 0xffc27a, intensity: 26, range: 9, brass: 'coldBrass' }));
  // sliding cold sidelight outside the windows
  z.sidelight = world.lights.addLamp({ pos: [x0 + 4, 1.9, SHELL.W - 0.25], color: 0x7fb7d1, intensity: 16, range: 7, zone: 'B', kind: 'side', priority: 30 });

  // seats: pitch is a quarter of the loop length so every module is identical
  const tint = new THREE.Color(0x8fa0a0);
  for (let x = x0 + 0.95 / 2 + 0.3; x < B.SEATS_END; x += 0.95) for (const s of [-1, 1]) z.pb.place('bench', x, 0, s * 0.94, { size: 0.98, fit: 'x', ry: Math.PI / 2, stretch: [1, 1.26 * 1.12, 1.12], tint });
  for (const s of [-1, 1]) world.wall(x0 + 0.3, B.SEATS_END + 0.25, s * 0.43, s * SHELL.W, { h: 1.2, tag: 'seats' });

  // skewed door frames straddling the aisle — free-standing portals that lean a little more each time
  [[33.9, 0.05], [37.7, -0.09], [41.5, 0.14]].forEach(([px, tilt], i) => {
    const g = new THREE.Group();
    const m = world.mats.get('petrolDark');
    const post = new THREE.BoxGeometry(0.09, 2.5, 0.09), head = new THREE.BoxGeometry(0.1, 0.1, 1.06);
    for (const s of [-1, 1]) { const p = new THREE.Mesh(post, m); p.position.set(0, 1.25, s * 0.48); p.castShadow = true; g.add(p); }
    const hd = new THREE.Mesh(head, m); hd.position.set(0, 2.5, 0); g.add(hd);
    g.position.set(px, 0, 0); g.rotation.x = tilt; g.rotation.y = tilt * 0.35;
    z.group.add(g);
  });

  // --- the open end: wrench bracket, fracture demonstration, jammed door -------------------------
  const E0 = B.SEATS_END + 0.25;
  // toppled benches and luggage where the seating gives out
  z.pb.place('bench', 42.9, 0.42, -1.02, { size: 0.98, fit: 'x', ry: 1.2, rz: 1.35, stretch: [1, 1.4, 1.12], tint });
  z.pb.place('suitcase_b', 47.6, 0, -1.0, { size: 0.9, fit: 'y', ry: 0.5 });
  z.pb.place('suitcase_a', 47.5, 0, 1.05, { size: 0.5, fit: 'y', ry: -0.3 });
  world.wall(47.15, 48.05, -1.45, -0.6, { h: 1.0 }); world.wall(47.2, 47.9, 0.75, 1.45, { h: 0.6 });
  // wrench bracket on the right-hand wall
  const bx = 43.1, bz = SHELL.W - 0.06;
  z.b.span('coldBrass', bx - 0.5, bx + 0.5, 1.0, 1.42, bz - 0.01, bz + 0.03, 'x');
  for (const dx of [-0.3, 0.3]) z.b.tube('ironGreen', [[bx + dx, 1.3, bz], [bx + dx, 1.27, bz - 0.09], [bx + dx, 1.33, bz - 0.11]], 0.012, { seg: 6, tubular: 5 });
  world.markers.wrench = { x: bx, y: 1.3, z: bz - 0.07, standX: bx, standZ: 0.75 };

  // fracture demonstration panel: left two-thirds of the floor, a safe strip remains on the right
  world.floors.find((f) => f.id === 'B_floor').x1 = 44.2;
  world.floor(46.7, x1, -SHELL.W, SHELL.W, 0, { surface: 'wood' });
  world.floor(44.2, 46.7, 0.3, SHELL.W, 0, { surface: 'wood' });
  world.panel({ id: 'B_demo', zone: 'B', x0: 44.2, x1: 46.7, z0: -SHELL.W, z1: 0.3, mat: 'coldFloor', frags: 16, rewindable: true, autoFail: false });

  // end wall and jammed door
  endWall(world, z, x1, -1, { top: SHELL.CROWN * YS + 0.05, mats });
  world.door(z, 'B_end', x1, { open: 0, locked: true, swing: 1 });
  world.markers.latch = { x: x1 - 0.14, y: 1.05, z: 0.3 };
  z.pb.place('latch', x1 - 0.12, 0.94, 0.3, { size: 0.24, fit: 'y', ry: -Math.PI / 2 });

  world.markers.cp1 = { x: 23.4, z: 0, yaw: Math.PI / 2 };
  world.finishZone(z);
  return z;
}
