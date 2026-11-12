import * as THREE from 'three/webgpu';

// Tiny authored light-probe scenes turned into PMREM environments: cheap, stable image-based
// lighting that gives brass and varnish something period-plausible to reflect (GDD 13.3).
export function makeEnv(renderer, { walls = 0x1a120c, floor = 0x0c0907, ceil = 0x241c14, cards = [] }) {
  const s = new THREE.Scene();
  const room = new THREE.Mesh(new THREE.BoxGeometry(6, 3, 20), [
    new THREE.MeshBasicMaterial({ color: walls, side: THREE.BackSide }), new THREE.MeshBasicMaterial({ color: walls, side: THREE.BackSide }),
    new THREE.MeshBasicMaterial({ color: ceil, side: THREE.BackSide }), new THREE.MeshBasicMaterial({ color: floor, side: THREE.BackSide }),
    new THREE.MeshBasicMaterial({ color: walls, side: THREE.BackSide }), new THREE.MeshBasicMaterial({ color: walls, side: THREE.BackSide }),
  ]);
  s.add(room);
  for (const c of cards) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(c.w, c.h), new THREE.MeshBasicMaterial({ color: new THREE.Color(c.color).multiplyScalar(c.power ?? 1), side: THREE.DoubleSide }));
    m.position.set(...c.pos);
    m.lookAt(0, 0, 0);
    s.add(m);
  }
  const pm = new THREE.PMREMGenerator(renderer);
  const rt = pm.fromScene(s, 0.04, 0.1, 30);
  pm.dispose();
  room.geometry.dispose();
  return rt.texture;
}

export const ENV_SPECS = {
  // Coach A: warm ceiling practicals, cold window bands either side.
  A: { walls: 0x241509, floor: 0x0d0906, ceil: 0x3a2c1c, cards: [
    { pos: [0, 1.45, -6], w: 0.7, h: 0.7, color: 0xffc27a, power: 14 }, { pos: [0, 1.45, -2], w: 0.7, h: 0.7, color: 0xffc27a, power: 14 },
    { pos: [0, 1.45, 2], w: 0.7, h: 0.7, color: 0xffc27a, power: 14 }, { pos: [0, 1.45, 6], w: 0.7, h: 0.7, color: 0xffc27a, power: 14 },
    { pos: [2.95, 0.35, 0], w: 16, h: 0.8, color: 0x5b7fb5, power: 1.3 }, { pos: [-2.95, 0.35, 0], w: 16, h: 0.8, color: 0x5b7fb5, power: 1.3 },
  ] },
  // Coach B: one interrupted lamp rhythm, petrol blue sidelight.
  B: { walls: 0x10181a, floor: 0x070a0b, ceil: 0x162022, cards: [
    { pos: [0, 1.45, -5], w: 0.6, h: 0.6, color: 0xffc27a, power: 9 }, { pos: [0, 1.45, 4], w: 0.6, h: 0.6, color: 0xffc27a, power: 5 },
    { pos: [2.95, 0.3, 0], w: 18, h: 1.0, color: 0x3f6f86, power: 1.6 },
  ] },
  // Coach C: weak steel-blue bounce, warm shafts.
  C: { walls: 0x0d1114, floor: 0x060708, ceil: 0x101519, cards: [
    { pos: [1.5, 1.45, -4], w: 0.5, h: 0.5, color: 0xffb060, power: 8 }, { pos: [-2, 1.2, 5], w: 0.5, h: 0.5, color: 0xffb060, power: 6 },
    { pos: [0, 1.48, 0], w: 3, h: 6, color: 0x35506a, power: 0.6 },
  ] },
  // Coach D: hard overhead tungsten / arc key, deep fill.
  D: { walls: 0x0b0c0e, floor: 0x050505, ceil: 0x0d0e10, cards: [
    { pos: [0, 1.48, 0], w: 1.6, h: 1.6, color: 0xfff0d2, power: 16 }, { pos: [2.9, 0, 6], w: 3, h: 1.2, color: 0x2c3f55, power: 1.0 },
    { pos: [-2.9, -0.8, -5], w: 2, h: 0.6, color: 0xff5a2a, power: 1.5 },
  ] },
  // Threshold: expansive cool station glow, tiny warm pinlights.
  S: { walls: 0x141c28, floor: 0x06080c, ceil: 0x1b2738, cards: [
    { pos: [0, 0.6, -9.5], w: 5, h: 2.5, color: 0xbfd6ff, power: 3 }, { pos: [2.9, 0.9, -3], w: 1, h: 1, color: 0xdfeaff, power: 8 },
    { pos: [-2.9, -0.5, 5], w: 0.3, h: 0.3, color: 0xffb060, power: 10 },
  ] },
};
