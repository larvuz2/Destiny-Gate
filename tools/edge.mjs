// Runs the GDD 22.3 edge-case suite headlessly: node tools/edge.mjs [base]
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
const require = createRequire(execSync('npm root -g').toString().trim() + '/');
const { chromium } = require('playwright');
const base = process.argv[2] || 'http://localhost:5173';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 480, height: 270 } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 300)));
page.on('pageerror', (e) => errors.push('[pageerror] ' + String(e.stack || e).slice(0, 600)));
await page.goto(`${base}/?test&preset=low`);
await page.waitForFunction(() => window.__ready, null, { timeout: 180000 });
const res = await page.evaluate(() => window.__dg.edge.edgeCases(window.__dg));
for (const r of res) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.id.padEnd(4)} ${r.name}${r.note ? '\n        → ' + r.note : ''}`);
if (errors.length) console.log('ERRORS:\n' + [...new Set(errors)].join('\n'));
await browser.close();
process.exit(res.every((r) => r.pass) && !errors.length ? 0 : 1);
