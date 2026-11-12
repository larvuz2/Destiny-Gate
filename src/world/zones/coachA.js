import { coachShell, endWall, ceilingLamp, SHELL } from '../shell.js';
import { PropBatch } from '../props.js';

// Coach A — the believable third-class day coach (GDD 9.2 / 12.2 Phase A).
// Train axis is +X (towards the locomotive). All dimensions in metres.
export const A = { x0: 0, x1: 20 };

export function buildCoachA(world) {
  const z = world.zone('A', -2.2, 21.2, 'A');
  z.ceiling = SHELL.CROWN; z.fog = { color: 0x0b0806, density: 0.012 }; z.exposure = 1.0;
  z.hemi = { sky: 0x9aa6bd, ground: 0x4a3524, intensity: 0.7 };
  const sh = coachShell(world, z, { x0: A.x0, x1: A.x1, bay0: 0.5, bays: 10, glass: world.glass('A', 0.22), ext: world.exterior(0.3) });
  world.floor(-2.2, 21.2, -SHELL.W, SHELL.W, 0, { surface: 'wood' });
  endWall(world, z, A.x0, 1);
  endWall(world, z, A.x1, -1);
  world.wall(-0.3, -0.1, -SHELL.W, SHELL.W); // rear door stays shut
  z.b.span('walnutDark', -0.06, -0.02, 0, 2.02, -0.44, 0.44);

  for (let i = 0; i < 5; i++) ceilingLamp(world, z, sh.bayX(1 + i * 2), sh.CROWN - 0.005, 0);

  // seats (generated bench), two per row; seat banks are low cover, not sight blockers
  for (let r = 0; r < 18; r++) {
    const x = 1.45 + r * 0.98;
    for (const s of [-1, 1]) z.pb.place('bench', x, 0, s * 0.94, { size: 0.98, fit: 'x', ry: Math.PI / 2, stretch: [1, 1.26, 1.12] });
  }
  for (const s of [-1, 1]) world.wall(1.0, 19.0, s * 0.43, s * SHELL.W, { h: 1.1, tag: 'seats' });

  // fellow passengers — seen mostly from behind
  const pp = new PropBatch(world.props);
  const seat = (name, row, side, zz, h = 1.32) => pp.place(name, 1.45 + row * 0.98 + 0.06, 0.02, side * zz, { size: h, fit: 'y', ry: Math.PI / 2 });
  seat('passenger_c', 7, -1, 1.12); seat('passenger_d', 10, 1, 0.74); seat('passenger_e', 13, -1, 0.72, 1.28); seat('passenger_c', 15, 1, 1.14);
  world.passengers = pp.build('passengers'); z.group.add(world.passengers);
  z.pb.place('suitcase_a', 9.4, 2.02, -1.2, { size: 0.62, fit: 'x', ry: 0.1 });
  z.pb.place('sample_case', 3.2, 2.02, 1.2, { size: 0.42, fit: 'y', ry: Math.PI / 2 });

  world.markers.spawn = { x: 4.36, z: 0.7, yaw: Math.PI / 2 };
  world.markers.seatAisle = { x: 4.7, z: 0 };
  world.finishZone(z);
  return z;
}
