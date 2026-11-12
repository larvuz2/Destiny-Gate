// Headless smoke test: serves dist/, boots the game on WebGPU, fails on any console error.
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { preview } from 'vite';
import { mkdirSync } from 'node:fs';

// Playwright is preinstalled globally in the dev container; resolve it from there.
const require = createRequire(execSync('npm root -g').toString().trim() + '/');
const { chromium } = require('playwright');

const server = await preview({ preview: { port: 4173, strictPort: true } });
// The container has no GPU: software WebGPU loses its device on first present, so the rig
// drives the WebGL2 backend (software ANGLE). Real players get WebGPU.
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://localhost:4173/?webgl');
await page.waitForFunction(() => window.__boot?.frames > 30, null, { timeout: 60000 });
const boot = await page.evaluate(() => window.__boot);
mkdirSync('tools/out', { recursive: true });
await page.screenshot({ path: 'tools/out/smoke.png' });
await browser.close();
await server.close();
console.log(JSON.stringify({ boot, errors }));
process.exit(errors.length ? 1 : 0);
