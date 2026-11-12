import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { getBounds } from '@gltf-transform/functions';
import { MeshoptDecoder } from 'meshoptimizer';
import { readdirSync } from 'node:fs';
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
for (const f of readdirSync('public/assets/props')) {
  const doc = await io.read('public/assets/props/' + f);
  const { min, max } = getBounds(doc.getRoot().listScenes()[0]);
  console.log(f.padEnd(22), max.map((v, i) => (v - min[i]).toFixed(2)).join(' x '));
}
