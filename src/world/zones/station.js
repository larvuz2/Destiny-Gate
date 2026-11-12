import * as THREE from 'three/webgpu';
import { texture, uv, vec2, vec3, float, time, smoothstep, mix } from 'three/tsl';
import { deck, railing, stilts } from '../industrial.js';

// Threshold — the station vista (GDD 3.4, 9.2). Monumental scale from lightweight geometry: a matte
// backdrop, a few colossal lanterns and viaducts, and one still-rolling coach with a lit window.
export function buildStation(world) {
  const z = world.zone('S', 92.5, 140, 'S');
  z.ceiling = 30; z.fog = { color: 0x0a1220, density: 0.011 }; z.exposure = 1.25;
  z.hemi = { sky: 0x7f9cc8, ground: 0x1a2030, intensity: 1.0 };
  z.key = { pos: [93.5, 7, 3], target: [97, 0, -0.5], intensity: 200, angle: 0.8, color: 0xcfe0ff, distance: 20 };
  const b = z.b;

  // balcony
  deck(world, z, 92.5, 99, -3.5, 3.5, { mat: 'stone', surface: 'stone', beam: 'stone' });
  b.span('stone', 92.3, 92.5, -1, 9, -9, -0.5); b.span('stone', 92.3, 92.5, -1, 9, 0.5, 9); b.span('stone', 92.3, 92.5, 2.1, 9, -0.5, 0.5, 'z');
  for (const s of [-1, 1]) { b.span('stone', 92.5, 99.2, -8, 0.0, s * 3.5, s * 4.1, 'x'); world.wall(92.5, 99.5, s * 3.5, s * 4.5); }
  b.span('stone', 99, 99.5, -8, 0.0, -4.1, 4.1, 'z');
  railing(z, [[99, -3.5], [99, 3.5]], { h: 1.05, mat: 'iron' }); railing(z, [[92.6, -3.45], [99, -3.45]], { mat: 'iron' }); railing(z, [[92.6, 3.45], [99, 3.45]], { mat: 'iron' });
  world.wall(99, 99.6, -4, 4, { h: 1.05, noSight: true });
  stilts(z, [[98.6, -3.2], [98.6, 3.2]], { depth: 30, mat: 'stone' });

  // matte backdrop on a wide arc
  const mat = new THREE.MeshBasicNodeMaterial({ fog: false });
  mat.colorNode = texture(world.tex.station, uv()).rgb.mul(0.85);
  const arcGeo = new THREE.CylinderGeometry(150, 150, 130, 40, 1, true, Math.PI * 0.5 - 1.25, 2.5);
  const back = new THREE.Mesh(arcGeo, mat);
  back.scale.x = -1; back.rotation.y = Math.PI; back.position.set(110, 8, 0);
  z.group.add(back);

  // colossal lanterns
  const lanterns = [[118, -12, -16, 15], [132, -20, 20, 19], [150, -16, -6, 24], [124, -6, 34, 13]];
  for (const [x, y, zz, h] of lanterns) {
    z.pb.place('station_lantern', x, y, zz, { size: h, fit: 'y', ry: x });
    const glow = new THREE.Mesh(new THREE.SphereGeometry(h * 0.16, 12, 8), world.mats.emissive('stationGlow', 0xcfe2ff, 3.2));
    glow.position.set(x, y + h * 0.66, zz); glow.scale.y = 1.35; z.group.add(glow);
    world.lights.addLamp({ pos: [x, y + h * 0.66, zz], color: 0xcfe2ff, intensity: 2600, range: 70, zone: 'S', kind: 'station', priority: 400 });
  }
  // viaducts crossing in impossible directions: decks on arches with rails
  const via = (ax, ay, az, bx, by, bz, roll = 0) => {
    const g = new THREE.Group();
    const len = Math.hypot(bx - ax, by - ay, bz - az);
    const m = world.mats.get('ironDark'), r = world.mats.get('steel');
    const bed = new THREE.Mesh(new THREE.BoxGeometry(len, 0.6, 4.2), m); g.add(bed);
    for (const s of [-0.75, 0.75]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.14, 0.12), r); rail.position.set(0, 0.37, s); g.add(rail); }
    for (let q = -len / 2 + 4; q < len / 2; q += 9) { const pier = new THREE.Mesh(new THREE.BoxGeometry(1.6, 60, 2.6), world.mats.get('stone')); pier.position.set(q, -30.3, 0); g.add(pier); }
    g.position.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
    g.lookAt(bx, by, bz); g.rotateY(Math.PI / 2); g.rotateX(roll);
    z.group.add(g);
    return g;
  };
  via(100, -9, -30, 190, -4, 14);
  via(108, -22, 40, 170, -16, -46);
  via(126, 14, -44, 150, 8, 50, Math.PI);          // upside down overhead
  via(112, 4, 26, 180, 26, 2, Math.PI / 2);        // on its side
  // the still-rolling coach with Mitchell's ordinary self in a lit window
  const train = new THREE.Group();
  const coach = z.pb.single('coach_ext', { size: 22, fit: 'x' });
  train.add(coach);
  const coach2 = z.pb.single('coach_ext', { size: 22, fit: 'x' }); coach2.position.x = -22.6; train.add(coach2);
  const loco = z.pb.single('locomotive', { size: 21, fit: 'x' }); loco.position.x = 22.4; train.add(loco);
  const winMat = world.mats.emissive('trainWin', 0xffc27a, 2.6);
  for (const cx of [0, -22.6]) for (let i = -4; i <= 4; i++) { const w = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.75), winMat); w.position.set(cx + i * 1.9, 3.55, 1.72); train.add(w); }
  // silhouette of the man in the window (the ordinary Mitchell, seated)
  const sil = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.62), new THREE.MeshBasicNodeMaterial({ color: 0x120b06 }));
  sil.position.set(0, 3.47, 1.74); train.add(sil);
  const head = new THREE.Mesh(new THREE.CircleGeometry(0.16, 12), sil.material); head.position.set(0.02, 3.86, 1.74); train.add(head);
  train.rotation.y = Math.PI / 2 + 0.5;
  z.group.add(train);
  world.stationTrain = train;
  world.dynamic.push({ update: (dt, t) => { const k = ((t * 0.035) % 1); train.position.set(128 - 22 + k * 30, -9.25 + 0.3 + (-4 + 9) * 0, -30 + 44 * 0.25 + k * 14 - 6); train.position.y = -8.1; } });
  world.lights.addLamp({ pos: [112, -5, -6], color: 0xffc27a, intensity: 40, range: 16, zone: 'S', kind: 'pin' });

  // near balcony lamps
  world.lights.addLamp({ pos: [95, 3.2, 0], color: 0xbfd6ff, intensity: 30, range: 10, zone: 'S', kind: 'fill', priority: 100 });
  world.markers.end = { x: 97.2 };
  world.finishZone(z);
  return z;
}
