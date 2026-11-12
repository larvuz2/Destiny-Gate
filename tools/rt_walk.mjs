// Real-time check (non-test mode): enter the game, stand, walk with real key events, screenshot.
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
const require = createRequire(execSync('npm root -g').toString().trim() + '/');
const { chromium } = require('playwright');
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 240)));
page.on('pageerror', (e) => errors.push('[pageerror] ' + String(e.stack || e).slice(0, 500)));
const shot = (n) => page.screenshot({ path: `tools/out/rt_${n}.png`, timeout: 120000 });
await page.goto('http://localhost:5173/?preset=low');
await page.waitForSelector('#title.in', { timeout: 180000 });
await page.evaluate(() => localStorage.setItem('destiny-gate.settings.v1', JSON.stringify({ seenNotice: true })));
await page.reload(); await page.waitForSelector('#title.in', { timeout: 180000 });
await page.click('button[data-a="new"]');
const st = () => page.evaluate(() => window.__dg.state());
for (let i = 0; i < 60; i++) { await page.waitForTimeout(1000); const s = await st(); if (s.app === 'playing' && s.t > 3) break; }
await page.keyboard.down('KeyW');
for (let i = 0; i < 90; i++) { await page.waitForTimeout(1000); const s = await st(); if (s.p[0] > 8) break; }
await shot('walk');
await page.keyboard.up('KeyW');
await page.waitForTimeout(6000);
await shot('idle');
console.log(JSON.stringify(await st()));
console.log(JSON.stringify(await page.evaluate(() => ({ audio: window.__dg.app.audio.ctx?.state, buffers: Object.keys(window.__dg.app.audio.buffers).length, music: window.__dg.app.audio.musicKey, bed: window.__dg.app.audio.bedKey }))));
if (errors.length) console.log([...new Set(errors)].slice(0, 8).join('\n'));
await browser.close();
