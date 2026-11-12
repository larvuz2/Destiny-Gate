import * as THREE from 'three/webgpu';
import { bus } from './core/events.js';
import { settings } from './core/settings.js';
import { Input } from './core/input.js';
import { Loop } from './core/loop.js';
import { Gfx } from './gfx/renderer.js';
import { Materials } from './gfx/materials.js';
import { LightRig } from './gfx/lights.js';
import { PropLibrary, PropBatch } from './world/props.js';
import { World } from './world/level.js';
import { Game } from './game/game.js';
import { Director } from './game/director.js';
import { AudioDirector } from './audio/audio.js';
import { UI } from './ui/ui.js';

const Q = new URLSearchParams(location.search);
const TEST = Q.has('test');
const PROPS = ['bench_lo', 'passenger_c', 'passenger_d', 'passenger_e', 'suitcase_a', 'suitcase_b', 'sample_case', 'door', 'cabinet', 'cable_handle', 'counterweight', 'crate', 'heater', 'lantern', 'latch', 'release_pin', 'valves', 'watch', 'wrench', 'station_lantern', 'locomotive', 'coach_ext'];

// Application shell: owns the top-level state machine (title · playing · paused · inspect · ended).
class App {
  constructor() {
    this.state = 'loading'; this.testMode = TEST;
    this.audio = new AudioDirector();
    this.ui = new UI(this);
    this.fadeK = 0;
  }
  savedCheckpoint() { return Director.saved(); }

  async boot() {
    const ui = this.ui;
    // compatibility gate: a human-readable message, never a frozen black canvas (GDD 11.4)
    const probe = document.createElement('canvas').getContext('webgl2');
    if (!probe && !navigator.gpu) return ui.fatal('This browser cannot run Destiny Gate', 'WebGL 2 is not available. Please use a current desktop version of Chrome, Edge, Firefox or Safari with hardware acceleration enabled.');
    try {
      this.gfx = new Gfx(document.getElementById('app'));
      await this.gfx.init();
    } catch (e) {
      console.error(e);
      return ui.fatal('Graphics could not start', 'The graphics device failed to initialise. Try updating your browser or graphics driver, or switch the renderer back to WebGL 2 in Settings.');
    }
    const gfx = this.gfx;
    if (Q.has('preset')) gfx.setProfile(Q.get('preset'));
    gfx.scene.background = new THREE.Color(0x000000);
    this.input = new Input(gfx.renderer.domElement);
    const mats = new Materials(gfx), props = new PropLibrary(gfx), lights = new LightRig(gfx);
    this.world = new World({ gfx, mats, props, lights });
    this.lights = lights;
    const parts = { mats: 0, props: 0, chars: 0, audio: 0 };
    const tick = (what) => ui.progress(0.05 + 0.95 * (parts.mats * 0.2 + parts.props * 0.3 + parts.chars * 0.35 + parts.audio * 0.15), what);
    try {
      this.game = new Game({ gfx, world: this.world, lights, input: this.input });
      await Promise.all([
        mats.load((k) => { parts.mats = k; tick('Materials'); }),
        props.load(VIEW ? VIEW.split(',') : PROPS, (k) => { parts.props = k; tick('Carriages'); }),
        this.world.loadShared(),
        TEST ? Promise.resolve((parts.audio = 1)) : this.audio.loadEssential((k) => { parts.audio = k; tick('Sound'); }),
      ]);
      if (VIEW) return this.propViewer(props);
      this.world.build();
      await this.game.load((k) => { parts.chars = k; tick('Passengers'); });
    } catch (e) {
      console.error(e);
      return ui.fatal('The train could not be loaded', `Something failed while streaming the level (${String(e.message || e).slice(0, 120)}). <br><br><button class="btn primary" onclick="location.reload()">Retry</button>`);
    }
    this.audio.attach(this.game);
    gfx.lightsRig = lights;
    bus.on('graphics.profile_changed', ({ profile }) => lights.setProfile(profile));
    this.loop = new Loop({ step: (dt) => this.game.step(dt), render: (dt, a) => this.frame(dt, a) });
    this.loop.manual = TEST;
    this.wire();
    // warm the pipeline: draw every zone and both characters once so no shader compiles mid-chase
    this.game.start('start');
    ui.progress(1, 'Coupling the carriages');
    await new Promise((r) => setTimeout(r, 30));
    this.game.present(0, 1);
    const mad = this.game.madness.char.root, wasMad = mad.visible;
    for (const z of this.world.zones) z.group.visible = true;
    mad.visible = true; mad.position.set(6, 0, 0);
    try { gfx.render(); } catch (e) { console.warn('warm-up frame failed', e); }
    mad.visible = wasMad; this.world.active = null;
    this.game.present(0, 1); gfx.render();
    ui.progress(1, 'Ready'); ui.loaded();
    if (Q.has('cp') || TEST) { this.begin(Q.get('cp') || 'start', true); }
    else this.toTitle(true);
    this.loop.start();
  }

  wire() {
    const canvas = this.gfx.renderer.domElement;
    canvas.addEventListener('click', () => { if (this.state === 'playing') this.input.requestLock(); });
    addEventListener('pointerdown', () => { this.audio.unlock(); if (!TEST) this.audio.loadRest(); }, { capture: true });
    addEventListener('keydown', (e) => {
      this.audio.unlock();
      if (e.code === 'F11' || (e.code === 'KeyF' && e.altKey)) { e.preventDefault(); if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.().catch(() => {}); }
    }, { capture: true });
    // Escape always releases capture and opens Pause; focus loss pauses automatically (GDD 4.1)
    bus.on('input.lock', (locked) => { if (!locked && this.state === 'playing' && !TEST) this.pause(); });
    bus.on('input.escape', () => { if (this.state === 'playing') this.pause(); });
    bus.on('input.blur', () => { if (this.state === 'playing' && !TEST) this.pause(); });
    bus.on('game.end', (stats) => { this.state = 'ended'; this.loop.simPaused = true; this.input.enabled = false; this.input.releaseLock(); this.gfx.grade.fade.value = 1; this.ui.end(stats); });
    bus.on('game.reloaded', () => this.ui.resetHud());
    // context loss: stop cleanly and restore at the last checkpoint (GDD 22.3 B01)
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.loop.simPaused = true; this.ui.fatal('Graphics context lost', 'The browser reclaimed the graphics device. <br><br><button class="btn primary" onclick="location.reload()">Restore from last checkpoint</button>'); });
    // PerformanceGovernor: adaptive internal resolution, never touching gameplay (GDD 18.2)
    this.perf = { acc: 0, n: 0, slow: 0, fast: 0 };
  }

  toTitle(first = false) {
    this.state = 'title';
    this.loop.simPaused = true; this.input.enabled = false; this.input.releaseLock();
    this.game.start('start'); this.game.director.fadeTarget = 0; this.gfx.grade.fade.value = first ? 1 : this.gfx.grade.fade.value;
    this.titleT = 0; this.fadeTo = 0;
    this.audio.silenceGame?.(); this.audio.pause(false);
    this.ui.title();
  }

  /** Start or continue. skipNotice: replays begin directly (GDD 11.4). */
  begin(cp = 'start', skipNotice = false) {
    if (!skipNotice && !settings.seenNotice) return this.ui.notice(() => this.begin(cp, true));
    this.audio.unlock(); if (!TEST) { this.audio.ui('start'); this.audio.loadRest(); }
    this.ui.close();
    this.state = 'starting'; this.fadeTo = 1; this.startT = 0; this.pendingCp = cp;
    if (cp === 'start') Director.clearSave();
    this.input.requestLock();
    if (TEST) this._enter();
  }
  _enter() {
    this.game.cam.override = null;
    this.game.start(this.pendingCp);
    this.ui.resetHud(); this.ui.hudOn(true);
    this.state = 'playing'; this.loop.simPaused = false; this.input.enabled = true; this.input.clear();
    this.fadeTo = null;
  }
  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused'; this.loop.simPaused = true; this.input.enabled = false; this.input.releaseLock();
    this.audio.pause(true); this.ui.pause();
  }
  resume() {
    if (this.state !== 'paused') return;
    this.ui.close(); this.audio.pause(false);
    this.state = 'playing'; this.loop.simPaused = false; this.input.enabled = true; this.input.clear(); this.input.requestLock();
  }
  restartCheckpoint() { this.ui.close(); this.audio.pause(false); this.game.start(this.game.director.cp); this.ui.resetHud(); this.state = 'playing'; this.loop.simPaused = false; this.input.enabled = true; this.input.clear(); this.input.requestLock(); }

  frame(dt, alpha) {
    const g = this.game, gfx = this.gfx;
    if (this.input.padPause()) { if (this.state === 'playing') this.pause(); else if (this.state === 'paused') this.resume(); }
    if (this.state === 'title' || this.state === 'starting') {
      // live carriage behind the menu: a slow drift past Mitchell's seat
      this.titleT += dt;
      const t = this.titleT;
      g.cam.override = { pos: _a.set(2.75 + Math.sin(t * 0.07) * 0.25, 1.36 + Math.sin(t * 0.11) * 0.03, -0.52 + Math.sin(t * 0.05) * 0.08), look: _b.set(9.5, 1.12, 0.62), k: 1 };
      g.present(dt, 1);
      if (this.state === 'starting') {
        this.startT += dt;
        gfx.grade.fade.value = Math.min(1, this.startT / 0.9);
        if (this.startT > 1.15) this._enter();
      } else gfx.grade.fade.value += (0 - gfx.grade.fade.value) * Math.min(1, dt * 1.2);
      this.audio.frame(dt, g, 'title');
    } else {
      g.present(this.loop.simPaused ? 0 : dt, alpha);
      this.audio.frame(dt, g, 'game');
      this.ui.frame(dt, g);
    }
    gfx.render();
    this.govern(dt);
  }

  govern(dt) {
    if (!settings.graphics.adaptive || TEST || this.state !== 'playing' || dt <= 0) return;
    const p = this.perf;
    p.acc += dt; p.n++;
    if (p.acc < 1) return;
    const fps = p.n / p.acc; p.acc = 0; p.n = 0;
    const target = this.gfx.profileName === 'high' ? 54 : 29;
    if (fps < target * 0.86) { p.slow++; p.fast = 0; } else if (fps > target * 1.25) { p.fast++; p.slow = 0; } else { p.slow = 0; p.fast = 0; }
    if (p.slow >= 2) { this.gfx.setDynScale(Math.max(0.55, this.gfx.dynScale - 0.1)); p.slow = 0; }
    if (p.fast >= 5) { this.gfx.setDynScale(Math.min(1, this.gfx.dynScale + 0.05)); p.fast = 0; }
  }

  /** dev: prop turntable sheet (?view=name,name) */
  propViewer(props) {
    const gfx = this.gfx, pb = new PropBatch(props);
    VIEW.split(',').forEach((n, i) => { for (let k = 0; k < 4; k++) { const o = pb.single(n, { size: 1, fit: 'y' }); o.position.set(i * 3, 0, -k * 3); o.rotation.y = (k * Math.PI) / 2; gfx.scene.add(o); } });
    gfx.scene.add(new THREE.HemisphereLight(0xffffff, 0x666666, 2.5));
    const d = new THREE.DirectionalLight(0xffffff, 2); d.position.set(2, 4, 5); gfx.scene.add(d);
    gfx.scene.background = new THREE.Color(0x30343a);
    const cam = (Q.get('cam') || '4,3,6,4,0.3,-4').split(',').map(Number);
    gfx.camera.position.set(cam[0], cam[1], cam[2]); gfx.camera.lookAt(cam[3], cam[4], cam[5]);
    this.ui.loaded();
    window.__dg = { gfx, render: (n = 1) => { for (let i = 0; i < n; i++) gfx.render(); } };
    window.__ready = true;
  }
}
const _a = new THREE.Vector3(), _b = new THREE.Vector3();
const VIEW = Q.get('view');

const app = new App();
await app.boot();

// --- test hooks (headless QA and screenshots) -----------------------------------------------------
if (!VIEW && app.game) {
  const { game, gfx, world, lights, input, loop } = app;
  window.__dg = {
    app, gfx, world, lights, game, input, bus,
    step(n = 1) { loop.advance(n); },
    // three refreshes skinning once per browser frame; advance its node frame manually when rendering in a loop
    render(n = 1) { for (let i = 0; i < n; i++) { gfx.renderer._nodes.nodeFrame.update(); app.frame(1 / 30, 1); } },
    /** let lights/exposure converge cheaply, then draw two fully-updated frames */
    settle(n = 10) { for (let i = 0; i < n; i++) app.frame(0.2, 1); for (let i = 0; i < 2; i++) { gfx.renderer._nodes.nodeFrame.update(); app.frame(1 / 30, 1); } },
    hold(a, on = true) { on ? input.virtual.add(a) : input.virtual.delete(a); },
    press(a) { input.pressed.add(a); },
    look(yaw, pitch = 0.06) { game.cam.yaw = yaw; game.cam.pitch = pitch; },
    cam(x, y, z, tx, ty, tz) { game.cam.override = x === undefined ? null : { pos: new THREE.Vector3(x, y, z), look: new THREE.Vector3(tx, ty, tz), k: 1 }; },
    tp(x, z = 0) { const p = game.player; p.pos.set(x, 0, z); p.prev.copy(p.pos); },
    state() { const p = game.player, m = game.madness, d = game.director; return { t: +game.t.toFixed(2), p: [+p.pos.x.toFixed(2), +p.pos.z.toFixed(2)], ps: p.state, dmg: p.damaged, m: m.active ? [+m.pos.x.toFixed(2), +m.pos.z.toFixed(2), m.state] : null, cp: d.cp, obj: d.objKey, beat: d.beat, music: d.music, tools: { ...game.tools.has }, panels: Object.fromEntries(game.fracture.panels.map((q) => [q.id, q.state])), trap: d.trap, won: d.won, app: app.state }; },
  };
  if (TEST) { window.__dg.bot = await import('./debug/bot.js'); window.__dg.edge = await import('./debug/edge.js'); }
  window.__ready = true;
}
