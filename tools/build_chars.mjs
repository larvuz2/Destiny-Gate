// Assembles runtime characters from Meshy rig results:
//   public/assets/chars/<char>.glb          skinned mesh, textures resized to WebP, meshopt
//   public/assets/chars/<char>.<clip>.glb   skeleton + one animation, no mesh
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, textureCompress, meshopt, dedup, resample } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const RES = resolve(ROOT, 'assets_src/_results');
const RAW = resolve(ROOT, 'assets_src/raw/char');
const OUT = resolve(ROOT, 'public/assets/chars');
mkdirSync(OUT, { recursive: true });
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });

const CLIPS = {
  0: 'idle', 2: 'alert', 30: 'walk', 14: 'run', 33: 'sit', 53: 'sit_to_stand', 219: 'swing', 283: 'pull', 285: 'open_door',
  178: 'hit', 187: 'knockdown', 344: 'getup', 8: 'dead', 366: 'fall', 559: 'sneak', 337: 'lantern_look', 341: 'walk_look',
  12: 'idle', 336: 'breathe_look', 112: 'walk', 119: 'stalk', 113: 'stagger', 509: 'sprint', 16: 'run', 4: 'attack',
  242: 'charged', 386: 'scream', 339: 'scan',
};
const CHARS = { mitchell: { tex: 1024, sets: ['r_mitchell_a', 'r_mitchell_b'] }, madness: { tex: 1024, sets: ['r_madness_a', 'r_madness_b'] } };

async function fetchTo(url, file) {
  if (existsSync(file)) return;
  const r = await fetch(url);
  if (!r.ok) throw new Error(r.status + ' ' + url);
  writeFileSync(file, Buffer.from(await r.arrayBuffer()));
}

for (const [name, cfg] of Object.entries(CHARS)) {
  const results = cfg.sets.filter((s) => existsSync(resolve(RES, s + '.json'))).map((s) => JSON.parse(readFileSync(resolve(RES, s + '.json'), 'utf8')));
  if (!results.length) continue;
  // base mesh from the first rig
  const baseRaw = resolve(RAW, `${name}_rig.glb`);
  await fetchTo(results[0].rigged_character_glb.url, baseRaw);
  const base = await io.read(baseRaw);
  for (const a of base.getRoot().listAnimations()) a.dispose();
  await base.transform(dedup(), prune(), textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [cfg.tex, cfg.tex], quality: 88 }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  await io.write(resolve(OUT, `${name}.glb`), base);
  let tris = 0;
  for (const m of base.getRoot().listMeshes()) for (const p of m.listPrimitives()) tris += p.getIndices().getCount() / 3;
  console.log(name, `${tris} tris`, `${(statSync(resolve(OUT, `${name}.glb`)).size / 1024) | 0} KB`, 'bones', base.getRoot().listSkins()[0]?.listJoints().length);

  const clips = [];
  for (const r of results) {
    for (const a of r.animations || []) {
      const clip = CLIPS[a.action_id] || 'a' + a.action_id;
      const raw = resolve(RAW, `${name}_anim_${clip}.glb`);
      await fetchTo(a.animation_glb.url, raw);
      const doc = await io.read(raw);
      const root = doc.getRoot();
      for (const n of root.listNodes()) { n.setMesh(null); n.setSkin(null); }
      for (const s of root.listSkins()) s.dispose();
      for (const m of root.listMeshes()) m.dispose();
      for (const m of root.listMaterials()) m.dispose();
      for (const t of root.listTextures()) t.dispose();
      const anims = root.listAnimations();
      anims.forEach((an, i) => (i === 0 ? an.setName(clip) : an.dispose()));
      await doc.transform(resample({ tolerance: 0.0005 }), prune({ keepLeaves: true }));
      const out = resolve(OUT, `${name}.${clip}.glb`);
      await io.write(out, doc);
      const dur = Math.max(...anims[0].listSamplers().map((s) => { const arr = s.getInput().getArray(); return arr[arr.length - 1]; }));
      clips.push(`${clip}(${dur.toFixed(2)}s ${(statSync(out).size / 1024) | 0}KB)`);
    }
  }
  console.log('  clips:', clips.join(' '));
}
