// Hero-shot capture (GDD 12.5 / 13.6): the same compositions on any preset.
// node tools/hero.mjs [preset] [only,comma,list]
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const require = createRequire(execSync('npm root -g').toString().trim() + '/');
const { chromium } = require('playwright');
const preset = process.argv[2] || 'high', only = process.argv[3]?.split(',');
const W = +(process.argv[4] || 1280), H = Math.round((W * 9) / 16);
const settle = 'dg.gfx.grade.fade.value = 0; dg.game.director.fadeTarget = 0; dg.settle(12);';
const SHOTS = {
  a_seat: `dg.app.begin('start', true); dg.step(200); dg.look(Math.PI/2 - 0.5, 0.05); ${settle}`,
  a_aisle: `dg.app.begin('start', true); dg.step(170); dg.hold('forward'); dg.step(260); dg.hold('forward', false); dg.step(20); dg.look(Math.PI/2, 0.04); ${settle}`,
  a_face: `dg.app.begin('start', true); dg.step(170); dg.hold('forward'); dg.step(200); dg.hold('forward', false); dg.step(30); const p = dg.game.player.pos; dg.cam(p.x + 1.5, 1.45, 0.35, p.x, 1.42, 0.0); ${settle}`,
  b_aisle: `dg.app.begin('cp1', true); dg.step(10); dg.tp(25.5, 0); dg.step(5); dg.look(Math.PI/2, 0.02); ${settle}`,
  b_end: `dg.app.begin('cp1', true); dg.game.director.flags.loops = 0; dg.tp(42.4, 0.3); dg.step(5); dg.look(Math.PI/2 + 0.1, 0.05); ${settle}`,
  b_demo: `dg.app.begin('cp1', true); dg.game.director.flags.loops = 0; dg.tp(43.7, 0.9); dg.step(140); ${settle}`,
  c_bridge: `dg.app.begin('cp1', true); dg.game.director.flags.loops = 0; dg.game.director.flags.latch = true; dg.tp(51.2, 0); dg.step(4); dg.look(Math.PI/2, 0.1); dg.hold('forward'); dg.step(70); dg.hold('forward', false); dg.step(50); ${settle}`,
  c_rewind: `dg.app.begin('cp1b', true); dg.game.director.flags.revealed = true; dg.tp(53.5, 0); dg.step(4); dg.look(-Math.PI/2 + Math.PI, 0.12); dg.game.tools.has.watch = true; dg.game.cam.yaw = Math.PI/2; dg.press('watch'); dg.step(70); dg.look(Math.PI/2, 0.16); ${settle}`,
  c_reveal: `dg.app.begin('cp1b', true); dg.tp(59.0, 0); dg.step(3); dg.hold('forward'); dg.step(10); dg.hold('forward', false); dg.step(110); ${settle}`,
  c_ring: `dg.app.begin('cp1c', true); dg.tp(63.4, 2.7); dg.step(4); dg.look(Math.PI/2, 0.05); dg.step(200); ${settle}`,
  c_exit: `dg.app.begin('cp1c', true); dg.tp(71.0, 0.2); dg.step(4); dg.look(Math.PI/2, 0.12); ${settle}`,
  d_entry: `dg.app.begin('cp2', true); dg.step(10); dg.tp(77.8, 0); dg.step(4); dg.look(Math.PI/2, 0.02); ${settle}`,
  d_trap: `dg.app.begin('cp2', true); dg.tp(83.3, 4.4); dg.step(4); const d = dg.game.director, m = dg.game.madness, w = dg.world; d._prime(d.its.pin); dg.step(140); for (let i = 0; i < 600 && !(m.active && m.pos.x > 82.8); i++) dg.step(1); dg.look(Math.PI * 0.93, 0.2); ${settle}`,
  d_collapse: `dg.app.begin('cp2', true); dg.tp(83.3, 4.4); dg.step(4); const d = dg.game.director, m = dg.game.madness; d._prime(d.its.pin); dg.step(140); for (let i = 0; i < 600 && !(m.active && m.pos.x > 83.2); i++) dg.step(1); d._pullCable(); dg.step(30); dg.look(Math.PI * 0.93, 0.24); ${settle}`,
  tools: `dg.app.begin('cp2', true); dg.tp(78.2, 1.0); dg.step(6); dg.look(Math.PI/2, 0.0); dg.hold('lantern'); dg.step(50); const p = dg.game.player.pos, t = dg.game.tools; dg.cam(p.x + 2.1, 1.35, p.z + 0.7, p.x, 1.1, p.z); ${settle} console.warn('TOOLS ' + JSON.stringify({ wv: t.wrench.visible, wp: t.wrench.position.toArray().map((v) => +v.toFixed(2)), ws: +t.wrench.scale.x.toFixed(3), lv: t.lantern.visible, lp: t.lantern.position.toArray().map((v) => +v.toFixed(2)), ls: +t.lantern.scale.x.toFixed(3), fk: +t.focusK.toFixed(2), ik: +dg.game.player.char.ik.left.w.toFixed(2) }));`,
  mad_close: `dg.app.begin('cp1c', true); const m = dg.game.madness; m.patrol = []; dg.tp(60.2, 0); m.pos.set(64.2, 0, 1.6); m.prev.copy(m.pos); m.yaw = -Math.PI/2; dg.step(30); dg.cam(61.4, 1.7, 2.6, 64.2, 1.5, 1.6); ${settle}`,
  mad_hunt: `dg.app.begin('cp1c', true); const m = dg.game.madness; dg.tp(63.2, 2.7); m.pos.set(69.5, 0, 2.7); m.prev.copy(m.pos); m.yaw = -Math.PI/2; dg.look(Math.PI/2, 0.02); dg.step(95); ${settle}`,
  s_end: `dg.app.begin('cp2', true); dg.game.director.won = true; dg.world.doors.D_exit.target = 1; dg.tp(96.9, 0.2); dg.step(30); dg.hold('forward'); dg.look(Math.PI/2, 0); dg.step(30); dg.hold('forward', false); dg.step(250); ${settle}`,
  knock: `dg.app.begin('cp1c', true); const m = dg.game.madness, p = dg.game.player; m.despawn(); dg.tp(60, -1); dg.step(5); p.hit(62, -1); dg.step(40); dg.look(Math.PI/2, 0.25); ${settle}`,
  ui_title: `dg.app.toTitle(); document.querySelector('#title').classList.add('in'); for (let i = 0; i < 14; i++) dg.app.frame(0.2, 1); dg.gfx.renderer._nodes.nodeFrame.update(); dg.app.frame(0.03, 1); await new Promise((r) => setTimeout(r, 2500));`,
  ui_inspect: `dg.app.begin('start', true); dg.step(200); dg.game.director.inspect('photo'); ${settle} await new Promise((r) => setTimeout(r, 900));`,
  ui_end: `dg.app.begin('cp2', true); dg.step(30); dg.bus.emit('game.end', { time: 742, deaths: 2, watchUses: 5 }); await new Promise((r) => setTimeout(r, 6500));`,
  idle: `dg.app.begin('cp2', true); dg.tp(78.2, 1.0); dg.step(90); const p = dg.game.player.pos; dg.cam(p.x + 2.6, 1.25, p.z + 0.5, p.x, 0.98, p.z); ${settle}`,
  idle_back: `dg.app.begin('start', true); dg.step(170); dg.hold('forward'); dg.step(220); dg.hold('forward', false); dg.step(90); ${settle}`,
  s_vista: `dg.app.begin('cp2', true); dg.game.director.won = true; dg.world.doors.D_exit.target = 1; dg.tp(95.6, 0.4); dg.step(60); dg.look(Math.PI/2 - 0.12, -0.06); ${settle}`,
};
mkdirSync('tools/out/hero', { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = [];
for (const [name, script] of Object.entries(SHOTS)) {
  if (only && !only.includes(name)) continue;
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  page.on('console', (m) => (m.type() === 'error' || m.text().startsWith('TOOLS')) && errors.push(`${name}: ${m.text().slice(0, 300)}`));
  page.on('pageerror', (e) => errors.push(`${name}: [pageerror] ${String(e.stack || e).slice(0, 400)}`));
  await page.goto(`http://localhost:5173/?test&preset=${preset}`);
  await page.waitForFunction(() => window.__ready, null, { timeout: 180000 });
  try {
    const info = await page.evaluate(async (src) => { const dg = window.__dg; await new Function('dg', `return (async () => { ${src} })()`)(dg); const i = dg.gfx.renderer.info.render; return { calls: i.drawCalls ?? i.calls, tris: i.triangles }; }, script);
    await page.screenshot({ path: `tools/out/hero/${preset}_${name}.png`, timeout: 120000 });
    console.log(name, JSON.stringify(info));
  } catch (e) { console.log(name, 'FAILED', String(e).slice(0, 300)); process.exitCode = 1; }
  await page.close();
}
if (errors.length) console.log([...new Set(errors)].join('\n'));
await browser.close();
