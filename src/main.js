import * as THREE from 'three/webgpu';
import { Gfx } from './gfx/renderer.js';
import { Materials } from './gfx/materials.js';
import { LightRig } from './gfx/lights.js';
import { PropLibrary } from './world/props.js';
import { World } from './world/level.js';

const Q = new URLSearchParams(location.search);
const gfx = new Gfx(document.getElementById('app'));
await gfx.init();
const mats = new Materials(gfx);
const props = new PropLibrary(gfx);
const lights = new LightRig(gfx);
const world = new World({ gfx, mats, props, lights });
const VIEW = Q.get('view');
const PROPS = ['bench', 'passenger_c', 'passenger_d', 'passenger_e', 'suitcase_a', 'suitcase_b', 'sample_case', 'door', 'cabinet', 'cable_handle', 'counterweight', 'crate', 'heater', 'lantern', 'latch', 'release_pin', 'sconce', 'valves', 'watch', 'wrench', 'rack', 'station_lantern', 'locomotive', 'coach_ext'];
await Promise.all([mats.load(), props.load(VIEW ? VIEW.split(',') : PROPS), world.loadShared()]);
if (VIEW) {
  // dev: prop turntable sheet
  const { PropBatch } = await import('./world/props.js');
  const pb = new PropBatch(props);
  const names = VIEW.split(',');
  names.forEach((n, i) => {
    for (let k = 0; k < 4; k++) { const o = pb.single(n, { size: 1, fit: 'y' }); o.position.set(i * 3, 0, -k * 3); o.rotation.y = k * Math.PI / 2; gfx.scene.add(o); }
  });
  gfx.scene.add(new THREE.HemisphereLight(0xffffff, 0x666666, 2.5));
  const d = new THREE.DirectionalLight(0xffffff, 2); d.position.set(2, 4, 5); gfx.scene.add(d);
  const ax = new THREE.AxesHelper(0.6); ax.position.set(-1.2, 0, 1.2); gfx.scene.add(ax);
  gfx.scene.background = new THREE.Color(0x30343a); gfx.scene.userData.view = true;
} else {
world.build();
world.setActiveZone(world.zones[0]);
}

import('./core/input.js');
const { Input } = await import('./core/input.js');
const { Game } = await import('./game/game.js');
const { Loop, TICK } = await import('./core/loop.js');
const input = new Input(gfx.renderer.domElement);
let game = null, loop = null;
gfx.scene.background = new THREE.Color(0x020304);
if (Q.has('preset')) gfx.setProfile(Q.get('preset'));
if (!VIEW) {
  game = new Game({ gfx, world, lights, input });
  await game.load();
  game.start(Q.get('cp') || 'start');
  input.enabled = true;
  loop = new Loop({ step: (dt) => game.step(dt), render: (dt, a) => { game.present(loop.simPaused ? 0 : dt, a); gfx.render(); } });
  loop.simPaused = false;
  loop.manual = Q.has('test');
  loop.start();
  gfx.renderer.domElement.addEventListener('click', () => input.requestLock());
} else {
  const cam = (Q.get('cam') || '2.2,1.55,0.0,12,1.2,0').split(',').map(Number);
  gfx.camera.position.set(cam[0], cam[1], cam[2]); gfx.camera.lookAt(cam[3], cam[4], cam[5]);
}
// --- test hooks ---------------------------------------------------------------------------------
const { bus } = await import('./core/events.js');
window.__dg = {
  gfx, world, lights, game, input, bus,
  /** advance the sim n ticks (no rendering) */
  step(n = 1) { loop.advance(n); },
  /** render one frame; dt only drives presentation smoothing */
  render(n = 1) { for (let i = 0; i < n; i++) { if (game) game.present(1 / 30, 1); gfx.render(); } },
  hold(a, on = true) { on ? input.virtual.add(a) : input.virtual.delete(a); },
  press(a) { input.pressed.add(a); },
  tp(x, z = 0) { const p = game.player; p.pos.set(x, 0, z); p.prev.copy(p.pos); },
  state() { const p = game.player, m = game.madness, d = game.director; return { t: +game.t.toFixed(2), p: [+p.pos.x.toFixed(2), +p.pos.z.toFixed(2)], ps: p.state, dmg: p.damaged, m: m.active ? [+m.pos.x.toFixed(2), +m.pos.z.toFixed(2), m.state] : null, cp: d.cp, obj: d.objKey, beat: d.beat, music: d.music, tools: { ...game.tools.has }, panels: Object.fromEntries(game.fracture.panels.map((q) => [q.id, q.state])), trap: d.trap, won: d.won }; },
  look(yaw, pitch = 0.06) { game.cam.yaw = yaw; game.cam.pitch = pitch; },
  cam(x, y, z, tx, ty, tz) { game.cam.override = x === undefined ? null : { pos: new THREE.Vector3(x, y, z), look: new THREE.Vector3(tx, ty, tz), k: 1 }; },
};
if (Q.has('test')) { const bot = await import('./debug/bot.js'); window.__dg.bot = bot; }
window.__ready = true;
