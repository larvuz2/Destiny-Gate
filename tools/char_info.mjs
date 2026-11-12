import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { getBounds } from '@gltf-transform/functions';
import { MeshoptDecoder } from 'meshoptimizer';
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
for (const c of ['mitchell', 'madness']) {
  const doc = await io.read(`public/assets/chars/${c}.glb`);
  const root = doc.getRoot();
  const b = getBounds(root.listScenes()[0]);
  console.log(c, 'bounds', b.min.map((v) => v.toFixed(2)), b.max.map((v) => v.toFixed(2)));
  const skin = root.listSkins()[0];
  console.log(' joints:', skin.listJoints().map((j) => j.getName()).join(' '));
  const top = root.listScenes()[0].listChildren().map((n) => `${n.getName()} s=${n.getScale().map((v) => v.toFixed(3))} r=${n.getRotation().map((v) => v.toFixed(2))}`);
  console.log(' roots:', top.join(' | '));
  for (const clip of c === 'mitchell' ? ['walk', 'run', 'idle', 'sit', 'sit_to_stand', 'knockdown', 'swing'] : ['walk', 'sprint', 'attack', 'charged', 'fall']) {
    const d = await io.read(`public/assets/chars/${c}.${clip}.glb`);
    const an = d.getRoot().listAnimations()[0];
    for (const ch of an.listChannels()) {
      if (ch.getTargetPath() !== 'translation') continue;
      const out = ch.getSampler().getOutput(); const n = out.getCount(); const a = out.getElement(0, []), z = out.getElement(n - 1, []);
      let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
      for (let i = 0; i < n; i++) { const e = out.getElement(i, []); for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], e[k]); mx[k] = Math.max(mx[k], e[k]); } }
      const range = mx.map((v, k) => (v - mn[k]));
      if (Math.max(...range) > 0.02) console.log(`  ${clip}: ${ch.getTargetNode().getName()} start=${a.map((v) => v.toFixed(2))} end=${z.map((v) => v.toFixed(2))} range=${range.map((v) => v.toFixed(2))}`);
    }
  }
}
