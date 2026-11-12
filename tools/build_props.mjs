// Optimises generated GLBs for runtime: weld/dedup, optional simplify, textures → WebP at a per-prop
// size budget (GDD 14.3), meshopt compression. Usage: node tools/build_props.mjs [name…]
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, weld, prune, textureCompress, meshopt, simplify, quantize } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import { readdirSync, mkdirSync, statSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = resolve(import.meta.dirname, '../assets_src/raw/prop');
const OUT = resolve(import.meta.dirname, '../public/assets/props');
mkdirSync(OUT, { recursive: true });
await MeshoptEncoder.ready; await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });

// texture edge in px; hero interactables get more.
const TEX = { default: 512, bench: 1024, bench_lo: 1024, lantern: 1024, watch: 1024, wrench: 1024, station_lantern: 1024, locomotive: 1024, coach_ext: 1024, counterweight: 1024, release_pin: 1024, door: 1024, passenger_a: 512, passenger_b: 512, suitcase_b: 1024 };
// repeated or distant props are decimated hard: fidelity where the player looks (GDD 0.2)
const ERR = { bench: 0.06, locomotive: 0.04, coach_ext: 0.04, station_lantern: 0.04, passenger_c: 0.03, passenger_d: 0.03, passenger_e: 0.03 };
const RATIO = { default: 1, bench: 0.2, passenger_c: 0.45, passenger_d: 0.45, passenger_e: 0.45, station_lantern: 0.4, locomotive: 0.35, coach_ext: 0.35, suitcase_b: 0.6, heater: 0.5, valves: 0.6, lantern: 0.6, rack: 0.5 };

const only = process.argv.slice(2);
for (const f of readdirSync(SRC).filter((f) => f.endsWith('.glb'))) {
  const name = f.replace('.glb', '');
  if (only.length && !only.includes(name)) continue;
  const out = resolve(OUT, f);
  if (name === 'bench' || name === 'passenger_a' || name === 'passenger_b' || name === 'rack' || name === 'sconce' || name === 'ceiling_lamp') continue; // superseded
  if (!only.length && existsSync(out) && statSync(out).mtimeMs > statSync(resolve(SRC, f)).mtimeMs) continue;
  const doc = await io.read(resolve(SRC, f));
  const size = TEX[name] || TEX.default;
  const steps = [dedup(), weld()];
  if ((RATIO[name] || 1) < 1) steps.push(simplify({ simplifier: MeshoptSimplifier, ratio: RATIO[name], error: ERR[name] || 0.012 }));
  steps.push(prune(), textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [size, size], quality: 84 }), quantize(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  await doc.transform(...steps);
  await io.write(out, doc);
  let tris = 0;
  for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) tris += (p.getIndices()?.getCount() || p.getAttribute('POSITION').getCount()) / 3;
  console.log(name.padEnd(18), `${tris | 0} tris`, `${(statSync(out).size / 1024) | 0} KB`);
}
