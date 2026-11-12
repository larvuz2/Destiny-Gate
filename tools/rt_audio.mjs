// Real-time audio probe: measures actual signal level on the master bus (title, gameplay, pause/resume).
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
const require = createRequire(execSync('npm root -g').toString().trim() + '/');
const pw = require('playwright');
const base = process.argv[2] || 'http://localhost:5173', engine = process.argv[3] || 'chromium';
const browser = await pw[engine].launch(engine === 'chromium' ? { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {});
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 300)));
page.on('pageerror', (e) => errors.push('[pageerror] ' + String(e.stack || e).slice(0, 500)));
await page.goto(`${base}/?preset=low`);
await page.waitForSelector('#title.in', { timeout: 180000 });
await page.evaluate(() => localStorage.setItem('destiny-gate.settings.v1', JSON.stringify({ seenNotice: true })));
await page.reload(); await page.waitForSelector('#title.in', { timeout: 180000 });
const level = (secs = 3) => page.evaluate(async (secs) => {
  const a = window.__dg.app.audio; if (!a.ctx) return { state: 'no context' };
  if (!a._probe) { a._probe = a.ctx.createAnalyser(); a._probe.fftSize = 2048; a.limiter.connect(a._probe); }
  const buf = new Float32Array(2048); let peak = 0, nan = false;
  for (let i = 0; i < secs * 10; i++) { await new Promise((r) => setTimeout(r, 100)); a._probe.getFloatTimeDomainData(buf); for (const v of buf) { if (Number.isNaN(v)) nan = true; peak = Math.max(peak, Math.abs(v)); } }
  return { state: a.ctx.state, peak: +peak.toFixed(4), nan, master: +a.master.gain.value.toFixed(2), music: a.musicKey, bed: a.bedKey, buffers: Object.keys(a.buffers).length };
}, secs);
const log = async (label) => console.log(label.padEnd(34), JSON.stringify(await level()));
await page.hover('button[data-a="settings"]'); await page.hover('button[data-a="credits"]');
await log('title, hover only (no gesture)');
await page.mouse.click(600, 40);
await page.waitForTimeout(2500);
await log('title after a click');
await page.click('button[data-a="settings"]'); await page.waitForTimeout(600); await page.evaluate(() => document.querySelector('button[data-a="back"]').click()); await page.waitForTimeout(600);
await log('title after settings');
await page.click('button[data-a="new"]');
for (let i = 0; i < 120; i++) { await page.waitForTimeout(500); if (await page.evaluate(() => window.__dg.state().app === 'playing' && window.__dg.state().t > 2)) break; }
await log('in game');
await page.keyboard.press('Escape'); await page.waitForTimeout(1500);
await log('paused');
await page.keyboard.press('Escape'); await page.waitForTimeout(2500);
await log('resumed with Esc');
if (errors.length) console.log([...new Set(errors)].slice(0, 8).join('\n'));
await browser.close();
