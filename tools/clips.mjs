// Animation contact sheet: node tools/clips.mjs <mitchell|madness> clipA,clipB,…
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const require = createRequire(execSync('npm root -g').toString().trim() + '/');
const { chromium } = require('playwright');
const who = process.argv[2] || 'mitchell', clips = process.argv[3].split(','), T = [0.05, 0.3, 0.55, 0.8];
mkdirSync('tools/out/clips', { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 400, height: 400 } });
page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 300)));
await page.goto('http://localhost:5173/?test&preset=low&cp=cp2');
await page.waitForFunction(() => window.__ready, null, { timeout: 180000 });
await page.evaluate((who) => {
  const dg = window.__dg, g = dg.game;
  dg.step(70); dg.gfx.grade.fade.value = 0; g.director.fadeTarget = 0;
  if (who === 'madness') { g.madness.spawn(78.6, 0, Math.PI / 2, 'scripted', 'D'); g.player.pos.set(77.2, 0, -3); g.player.prev.copy(g.player.pos); }
  const x = who === 'madness' ? 78.6 : g.player.pos.x, z = who === 'madness' ? 0 : g.player.pos.z, h = who === 'madness' ? 1.35 : 1.0;
  // subject faces +X; camera in front, slightly to the side
  dg.cam(x + (who === 'madness' ? 4.4 : 3.2), h + 0.3, z + 1.2, x, h, z);
  dg.settle(8);
}, who);
for (const clip of clips) for (const [i, t] of T.entries()) {
  const dur = await page.evaluate(([who, clip, t]) => {
    const dg = window.__dg, c = who === 'madness' ? dg.game.madness.char : dg.game.player.char;
    if (!c.lower[clip]) return -1;
    c.play(clip, { fade: 0, restart: true });
    for (const a of [c.lower[clip], c.upper[clip]]) { a.paused = true; a.time = t * c.durations[clip]; a.setEffectiveWeight(1); }
    for (const k of Object.keys(c.lower)) if (k !== clip) { c.lower[k].setEffectiveWeight(0); c.upper[k].setEffectiveWeight(0); }
    c.mixer.update(0);
    dg.gfx.renderer._nodes.nodeFrame.update(); dg.gfx.render();
    return c.durations[clip];
  }, [who, clip, t]);
  if (dur < 0) { console.log(clip, 'missing'); break; }
  await page.screenshot({ path: `tools/out/clips/${who}_${clip}_${i}.png`, timeout: 60000 });
  if (i === 0) console.log(clip, dur.toFixed(2) + 's');
}
await browser.close();
