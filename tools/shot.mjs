// Dev screenshot rig: node tools/shot.mjs <name> "<query>" [frames] [width] [height]
// Talks to a running `vite` dev server (port 5173) using software WebGL2.
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const require = createRequire(execSync('npm root -g').toString().trim() + '/');
const { chromium } = require('playwright');
const [name = 'shot', query = '', script = '', w = '1280', h = '720'] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
const errors = [];
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errors.push(`[${m.type()}] ${m.text().slice(0, 300)}`));
page.on('pageerror', (e) => errors.push('[pageerror] ' + String(e.stack || e).slice(0, 600)));
await page.goto(`http://localhost:5173/?${query.includes('notest') ? '' : 'test&'}${query}`);
try {
  await page.waitForFunction(() => window.__ready, null, { timeout: 120000 });
  const t0 = Date.now();
  // script: JS run in the page with `dg` bound to the test hooks; default renders a few frames
  await page.evaluate(async (src) => { const dg = window.__dg; await new Function('dg', `return (async () => { ${src || ''}; dg.settle(6); })()`)(dg); }, script);
  const info = await page.evaluate(() => { const i = window.__dg.gfx.renderer.info.render; return { calls: i.drawCalls ?? i.calls, tris: i.triangles }; });
  mkdirSync('tools/out', { recursive: true });
  await page.screenshot({ path: `tools/out/${name}.png`, timeout: 120000 });
  console.log(JSON.stringify({ name, ms: Date.now() - t0, ...info }));
} catch (e) { console.log('FAILED', String(e).slice(0, 300)); }
if (errors.length) console.log([...new Set(errors)].slice(0, 12).join('\n'));
await browser.close();
