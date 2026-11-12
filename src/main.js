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
await Promise.all([mats.load(), props.load(VIEW ? VIEW.split(',') : ['bench']), world.loadShared()]);
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
  gfx.scene.background = new THREE.Color(0x30343a);
} else {
world.build();
world.setActiveZone(world.zones[0]);
}

const cam = (Q.get('cam') || '2.2,1.55,0.0,12,1.2,0').split(',').map(Number);
gfx.camera.position.set(cam[0], cam[1], cam[2]);
gfx.camera.lookAt(cam[3], cam[4], cam[5]);
if (!VIEW) gfx.scene.background = new THREE.Color(0x020304);
if (Q.has('preset')) gfx.setProfile(Q.get('preset'));

let frames = 0, t = 0;
const subject = new THREE.Vector3(cam[0] + 2.5, 0, 0);
function frame(dt) {
  t += dt;
  world.uniforms.scroll.value = t * 0.02;
  world.update(dt, t);
  if (!VIEW) { lights.update(dt, subject); lights.updateKey(dt, subject); }
  gfx.render();
  frames++;
}
window.__dg = { gfx, world, lights, frames: () => frames, render: (n = 1) => { for (let i = 0; i < n; i++) frame(1 / 30); return frames; }, errors: [] };
if (!Q.has('test')) { let last = performance.now(); const loop = (now) => { frame(Math.min(0.1, (now - last) / 1000)); last = now; requestAnimationFrame(loop); }; requestAnimationFrame(loop); }
window.__ready = true;
