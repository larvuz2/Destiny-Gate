// Packs FAL PBR map sets into runtime textures: <name>_c.webp (sRGB colour), <name>_n.webp (tangent normal),
// <name>_orm.webp (R = cavity AO from height, G = roughness, B = metalness).
import sharp from 'sharp';
import { readdirSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = resolve(import.meta.dirname, '../assets_src/raw/tex');
const OUT = resolve(import.meta.dirname, '../public/assets/tex');
mkdirSync(OUT, { recursive: true });
const SIZE = { default: 1024 };
const names = [...new Set(readdirSync(SRC).filter((f) => f.endsWith('_basecolor.png')).map((f) => f.replace('_basecolor.png', '')))];

for (const n of names) {
  const size = SIZE[n] || SIZE.default;
  const f = (m) => resolve(SRC, `${n}_${m}.png`);
  await sharp(f('basecolor')).resize(size, size).webp({ quality: 86 }).toFile(resolve(OUT, `${n}_c.webp`));
  await sharp(f('normal')).resize(size, size).webp({ quality: 93, smartSubsample: false }).toFile(resolve(OUT, `${n}_n.webp`));
  const grey = async (m, fallback) => existsSync(f(m))
    ? sharp(f(m)).resize(size, size).greyscale().raw().toBuffer()
    : Buffer.alloc(size * size, fallback);
  const rough = await grey('roughness', 180);
  const metal = await grey('metalness', 0);
  // Cavity AO: height minus its blur, biased so flat areas stay white.
  let aoBuf = Buffer.alloc(size * size, 255);
  if (existsSync(f('height'))) {
    const h = await sharp(f('height')).resize(size, size).greyscale().raw().toBuffer();
    const hb = await sharp(f('height')).resize(size, size).greyscale().blur(12).raw().toBuffer();
    for (let i = 0; i < aoBuf.length; i++) aoBuf[i] = Math.max(90, Math.min(255, 255 + (h[i] - hb[i]) * 3.2));
  }
  const orm = Buffer.alloc(size * size * 3);
  for (let i = 0; i < size * size; i++) { orm[i * 3] = aoBuf[i]; orm[i * 3 + 1] = rough[i]; orm[i * 3 + 2] = metal[i]; }
  await sharp(orm, { raw: { width: size, height: size, channels: 3 } }).webp({ quality: 88 }).toFile(resolve(OUT, `${n}_orm.webp`));
  console.log('tex', n);
}
