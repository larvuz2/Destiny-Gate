// Normalises generated audio for runtime: trims leading silence on one-shots, loudness-normalises
// by family (GDD 16.7), mono for positional sounds, stereo for beds and music.
import { execFileSync } from 'node:child_process';
import { readdirSync, mkdirSync, statSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
const SRC = resolve(import.meta.dirname, '../assets_src/raw/audio'), OUT = resolve(import.meta.dirname, '../public/assets/audio');
mkdirSync(OUT, { recursive: true });
const LOOPS = new Set(['watch_tick', 'lantern_hiss', 'mad_breath', 'breath_hurt', 'tension']);
let total = 0;
for (const f of readdirSync(SRC).filter((f) => f.endsWith('.mp3')).sort()) {
  const n = f.replace('.mp3', ''), out = resolve(OUT, f);
  if (existsSync(out) && statSync(out).mtimeMs > statSync(resolve(SRC, f)).mtimeMs) { total += statSync(out).size; continue; }
  const music = /^(m\d|title|sting)$/.test(n), amb = n.startsWith('amb_'), vo = n.startsWith('vo_'), loop = LOOPS.has(n);
  let af, ch, br;
  if (music) { af = 'loudnorm=I=-19:TP=-2:LRA=11'; ch = 2; br = '128k'; }
  else if (amb) { af = 'loudnorm=I=-23:TP=-3:LRA=7'; ch = 2; br = '112k'; }
  else if (vo) { af = 'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05,loudnorm=I=-18:TP=-2,afade=t=in:d=0.02'; ch = 1; br = '96k'; }
  else if (loop) { af = 'loudnorm=I=-22:TP=-3'; ch = 1; br = '96k'; }
  else { af = 'silenceremove=start_periods=1:start_threshold=-42dB:start_silence=0.01,loudnorm=I=-17:TP=-1.5:LRA=11,afade=t=in:d=0.004'; ch = 1; br = '96k'; }
  // loudnorm occasionally stalls on some clips: fall back to simpler chains rather than hang the build
  const chains = [af, af.replace(/silenceremove=[^,]+,/, ''), 'dynaudnorm=p=0.7:m=6', 'anull'];
  for (const [i, a] of chains.entries()) {
    try {
      execFileSync('ffmpeg', ['-nostdin', '-y', '-loglevel', 'error', '-i', resolve(SRC, f), '-af', a, '-ac', String(ch), '-ar', '44100', '-b:a', br, out], { stdio: ['ignore', 'ignore', 'ignore'], timeout: 25000 });
      if (statSync(out).size < 1500 && i < chains.length - 1) continue;   // trimmed to nothing
      if (i) console.log('  (fallback chain ' + i + ' for ' + n + ')');
      break;
    } catch { if (i === chains.length - 1) throw new Error('ffmpeg failed for ' + n); }
  }
  total += statSync(out).size;
  const dur = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', out]).toString().trim();
  console.log(n.padEnd(18), (+dur).toFixed(2) + 's', ((statSync(out).size / 1024) | 0) + 'KB');
}
console.log('total', (total / 1048576).toFixed(1), 'MB');
