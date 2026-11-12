import { bus } from '../core/events.js';
import { settings } from '../core/settings.js';

// AudioDirector — maps systems to stems and events (GDD 16, 20.1).
// "The train is the pulse; the monster is the distortion of that pulse."
const ESSENTIAL = ['ui_hover', 'ui_select', 'ui_start', 'title', 'amb_train', 'amb_passengers', 'm0', 'vo_mitchell', 'fs_wood_1', 'fs_wood_2', 'fs_wood_3', 'fs_wood_4', 'cloth'];
const REST = ['amb_nightmare', 'amb_arena', 'amb_whispers', 'amb_station', 'amb_abyss', 'm1', 'm2', 'm3', 'm4', 'm5', 'sting', 'vo_conductor_1', 'vo_conductor_2',
  'fs_metal_1', 'fs_metal_2', 'fs_metal_3', 'fs_metal_4', 'fs_stone_1', 'fs_stone_2', 'door_open', 'door_forced', 'door_slam', 'stretch', 'lamp_flicker', 'blackout',
  'crack_tick_1', 'crack_tick_2', 'crack_tick_3', 'crack_stress', 'crack_critical', 'collapse_wood', 'collapse_metal', 'luggage_fall', 'settle',
  'watch_cast', 'watch_rewind', 'watch_tick', 'watch_noecho', 'watch_ready', 'watch_expire', 'wrench_swing', 'wrench_clank', 'wrench_latch', 'wrench_body', 'pin_pull', 'cable_pull', 'cable_return', 'locked',
  'lantern_pick', 'lantern_hiss', 'lantern_deplete', 'pickup', 'paper', 'reveal', 'mad_ticks', 'mad_breath', 'mad_charge', 'mad_lunge', 'mad_scream', 'mad_step_1', 'mad_step_2', 'mad_step_3',
  'mad_stagger', 'mad_stumble', 'mad_gate', 'mad_fall', 'mad_pound', 'hurt', 'breath_hurt', 'fall_yell', 'tension', 'collapse_trap', 'victory_whistle'];
// per-zone beds: [stem, level]
const BEDS = {
  title: [['amb_train', 0.5]],
  A: [['amb_train', 0.75], ['amb_passengers', 0.5]],
  A2: [['amb_train', 0.6], ['amb_nightmare', 0.25]],
  B: [['amb_nightmare', 0.8], ['amb_whispers', 0.35]],
  C: [['amb_nightmare', 0.6], ['amb_abyss', 0.45], ['amb_whispers', 0.15]],
  D: [['amb_arena', 0.85], ['amb_abyss', 0.5]],
  S: [['amb_station', 0.9]],
};
const MUSIC = { title: ['title', 0.8], M0: ['m0', 0.55], M1: ['m1', 0.55], M2: ['m2', 0.6], M3: ['m3', 0.62], M4: ['m4', 0.6], M5: ['m5', 0.7] };
const REVERB = { A: ['small', 0.12], B: ['long', 0.42], C: ['iron', 0.34], D: ['iron', 0.5], S: ['vast', 0.6] };
const LOUD = new Set(['collapse_trap', 'mad_scream', 'collapse_metal', 'collapse_wood', 'luggage_fall', 'door_forced', 'blackout', 'mad_fall']);

class Loop {
  constructor(a, name, dest, { fade = 0.6, panner = null } = {}) {
    this.a = a; this.name = name; this.fade = fade; this.next = 0; this.vol = 0; this.live = [];
    this.gain = a.ctx.createGain(); this.gain.gain.value = 0;
    this.gain.connect(panner || dest); if (panner) panner.connect(dest);
  }
  set(v, time = 1.2) {
    const ctx = this.a.ctx;
    this.vol = v;
    this.gain.gain.cancelScheduledValues(ctx.currentTime);
    this.gain.gain.setTargetAtTime(v, ctx.currentTime, Math.max(0.01, time / 3));
  }
  /** Schedule overlapping iterations so compressed loops have no gap. */
  tick() {
    const ctx = this.a.ctx, buf = this.a.buffers[this.name];
    if (!buf) return;
    if (this.vol <= 0.0005 && this.gain.gain.value < 0.001) { this.next = 0; return; }
    const now = ctx.currentTime;
    if (this.next < now - 0.2) this.next = now + 0.02;
    while (this.next < now + 1.2) {
      const s = ctx.createBufferSource(), g = ctx.createGain(), f = Math.min(this.fade, buf.duration * 0.25), t0 = this.next;
      s.buffer = buf; s.connect(g); g.connect(this.gain);
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(1, t0 + f);
      g.gain.setValueAtTime(1, t0 + buf.duration - f); g.gain.linearRampToValueAtTime(0, t0 + buf.duration);
      s.start(t0); s.stop(t0 + buf.duration + 0.05);
      this.next = t0 + buf.duration - f;
    }
  }
}

export class AudioDirector {
  constructor() {
    this.buffers = {}; this.loops = {}; this.ready = false; this.zone = null; this.bedKey = null; this.musicKey = null; this.oneShotVoices = 0;
    this.madStride = 0; this.lastCap = {};
  }

  /** Must be called from a user gesture at least once (browser audio policy). */
  unlock() {
    if (!this.ctx) this._build();
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  _build() {
    const ctx = (this.ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' }));
    this.limiter = ctx.createDynamicsCompressor();
    this.master = ctx.createGain(); this.master.connect(this.limiter); this.limiter.connect(ctx.destination);
    this.music = ctx.createGain(); this.sfx = ctx.createGain(); this.dialogue = ctx.createGain(); this.beds = ctx.createGain();
    this.duck = ctx.createGain(); // music + beds duck under hazard cues
    this.music.connect(this.duck); this.beds.connect(this.duck); this.duck.connect(this.master);
    this.sfx.connect(this.master); this.dialogue.connect(this.master); this.beds.gain.value = 1;
    // four small convolution spaces
    this.verbs = {};
    for (const [k, len, decay, tone] of [['small', 0.5, 3.2, 5200], ['long', 2.8, 1.7, 2600], ['iron', 2.2, 2.0, 3800], ['vast', 5.5, 1.3, 2200]]) {
      const c = ctx.createConvolver(); c.buffer = this._ir(len, decay);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = tone;
      const g = ctx.createGain(); g.gain.value = 0;
      c.connect(lp); lp.connect(g); g.connect(this.master);
      this.verbs[k] = { c, g };
    }
    this.send = ctx.createGain(); this.send.gain.value = 1;
    for (const v of Object.values(this.verbs)) this.send.connect(v.c);
    this.sfx.connect(this.send); this.dialogue.connect(this.send);
    // conductor echo line
    this.echo = ctx.createDelay(1.5); this.echo.delayTime.value = 0.62; this.echoFb = ctx.createGain(); this.echoFb.gain.value = 0.58;
    this.echo.connect(this.echoFb); this.echoFb.connect(this.echo); this.echo.connect(this.dialogue);
    this.applySettings();
    this._timer = setInterval(() => { for (const l of Object.values(this.loops)) l.tick(); }, 200);
    this._wire();
  }

  _ir(seconds, decay) {
    const ctx = this.ctx, n = Math.floor(seconds * ctx.sampleRate), buf = ctx.createBuffer(2, n, ctx.sampleRate);
    let seed = 1234567;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
    for (let ch = 0; ch < 2; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < n; i++) d[i] = rnd() * Math.pow(1 - i / n, decay) * (i < 400 ? i / 400 : 1); }
    return buf;
  }

  applySettings() {
    if (!this.ctx) return;
    const a = settings.audio, t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(a.master, t, 0.05); this.music.gain.setTargetAtTime(a.music, t, 0.05);
    this.sfx.gain.setTargetAtTime(a.sfx, t, 0.05); this.dialogue.gain.setTargetAtTime(a.dialogue, t, 0.05);
    const L = this.limiter, tight = a.reducedRange || settings.access.reducedIntensity;
    L.threshold.value = tight ? -26 : -10; L.ratio.value = tight ? 7 : 4; L.knee.value = 14; L.attack.value = 0.004; L.release.value = 0.22;
  }

  async _load(name) {
    if (this.buffers[name]) return;
    try {
      const r = await fetch(`assets/audio/${name}.mp3`);
      if (!r.ok) throw new Error(r.status);
      const ab = await r.arrayBuffer();
      this.buffers[name] = await (this.ctx || (this._dctx ||= new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(2, 2, 44100))).decodeAudioData(ab);
    } catch (e) { console.warn('audio missing', name, e.message); } // gameplay never depends on a sound (GDD 20.3)
  }
  async loadEssential(onProgress) { let n = 0; await Promise.all(ESSENTIAL.map((s) => this._load(s).then(() => onProgress?.(++n / ESSENTIAL.length)))); }
  loadRest() { return (this._rest ||= (async () => { for (let i = 0; i < REST.length; i += 6) await Promise.all(REST.slice(i, i + 6).map((s) => this._load(s))); this.ready = true; })()); }

  // --- playback ------------------------------------------------------------------------------------
  loop(name, opts) { return (this.loops[name] ||= new Loop(this, name, opts?.dest || this.beds, opts)); }

  /** One-shot. pos: {x, y?, z} for spatial; opts: vol, rate, bus, lp (occlusion), dry. */
  play(name, pos = null, { vol = 1, rate = 1, bus: to = 'sfx', lp = 0, when = 0, echo = false } = {}) {
    const ctx = this.ctx, buf = this.buffers[name];
    if (!ctx || !buf || ctx.state !== 'running') return null;
    if (this.oneShotVoices > 28 && vol < 0.5) return null; // ambience details lose first (GDD 16.7)
    if (settings.access.reducedIntensity && LOUD.has(name)) vol *= 0.55;
    const s = ctx.createBufferSource(); s.buffer = buf; s.playbackRate.value = rate;
    const g = ctx.createGain(); g.gain.value = vol;
    let node = s;
    if (lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; node.connect(f); node = f; }
    node.connect(g); node = g;
    if (pos) {
      const p = ctx.createPanner(); p.panningModel = 'equalpower'; p.distanceModel = 'inverse'; p.refDistance = 2.2; p.maxDistance = 40; p.rolloffFactor = 1.1;
      p.positionX.value = pos.x; p.positionY.value = pos.y ?? 1.2; p.positionZ.value = pos.z;
      node.connect(p); node = p;
    }
    node.connect(echo ? this.echo : this[to] || this.sfx);
    this.oneShotVoices++;
    s.onended = () => { this.oneShotVoices--; };
    s.start(ctx.currentTime + when);
    return s;
  }
  pick(base, n) { return `${base}_${1 + Math.floor(Math.random() * n)}`; }
  ui(kind) { this.unlock(); this.play(kind === 'hover' ? 'ui_hover' : kind === 'start' ? 'ui_start' : 'ui_select', null, { vol: kind === 'hover' ? 0.35 : 0.6 }); }
  caption(text, dur) { const now = performance.now(); if (now - (this.lastCap[text] || 0) < 2500) return; this.lastCap[text] = now; bus.emit('caption', { text, dur }); }
  /** Briefly pull music and beds down so a hazard cue is unmistakable. */
  duckFor(seconds = 1.2, depth = 0.35) { const t = this.ctx.currentTime, g = this.duck.gain; g.cancelScheduledValues(t); g.setTargetAtTime(depth, t, 0.04); g.setTargetAtTime(1, t + seconds, 0.5); }

  setMusic(key, fade = 2.5) {
    if (!this.ctx || this.musicKey === key) return;
    this.musicKey = key;
    for (const [k, [stem]] of Object.entries(MUSIC)) this.loop('mus:' + stem, { dest: this.music, fade: 2.5 }).set(k === key ? MUSIC[k][1] : 0, fade);
  }
  setBed(key, fade = 1.8) {
    if (!this.ctx || this.bedKey === key) return;
    this.bedKey = key;
    const want = Object.fromEntries(BEDS[key] || []);
    for (const stem of ['amb_train', 'amb_passengers', 'amb_nightmare', 'amb_whispers', 'amb_abyss', 'amb_arena', 'amb_station']) this.loop('bed:' + stem, { fade: 1.5 }).set(want[stem] || 0, fade);
    const rv = REVERB[key[0]] || REVERB.A;
    for (const [k, v] of Object.entries(this.verbs)) v.g.gain.setTargetAtTime(k === rv[0] ? rv[1] : 0, this.ctx.currentTime, 0.6);
  }
  pause(on) { if (!this.ctx) return; if (on) this.ctx.suspend(); else this.ctx.resume(); }
  silenceGame() { for (const k of ['mad_breath', 'tension', 'lantern_hiss', 'breath_hurt', 'watch_tick']) this.loops['fx:' + k]?.set(0, 0.3); }

  // --- per-frame: listener, zone beds, continuous threat layers -----------------------------------
  frame(dt, game, mode) {
    const ctx = this.ctx;
    if (!ctx) return;
    const cam = game.gfx.camera, L = ctx.listener, t = ctx.currentTime;
    if (L.positionX) {
      L.positionX.setTargetAtTime(cam.position.x, t, 0.03); L.positionY.setTargetAtTime(cam.position.y, t, 0.03); L.positionZ.setTargetAtTime(cam.position.z, t, 0.03);
      const e = cam.matrixWorld.elements;
      L.forwardX.setTargetAtTime(-e[8], t, 0.03); L.forwardY.setTargetAtTime(-e[9], t, 0.03); L.forwardZ.setTargetAtTime(-e[10], t, 0.03);
      L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0;
    } else { const e = cam.matrixWorld.elements; L.setPosition(cam.position.x, cam.position.y, cam.position.z); L.setOrientation(-e[8], -e[9], -e[10], 0, 1, 0); }
    if (mode === 'title') { this.setBed('title'); this.setMusic('title'); return; }
    const zone = game.world.active?.id || 'A';
    this.zone = zone;
    this.setBed(zone === 'A' && game.director.flags.wrong ? 'A2' : zone);
    this.setMusic(game.director.music);
    // the hunter: breath bed follows it, footsteps from its stride
    const m = game.madness, fxDest = { dest: this.sfx };
    const breath = this._spatialLoop('mad_breath');
    if (m.active && m.state !== 'fall') {
      breath.p.positionX.setTargetAtTime(m.pos.x, t, 0.05); breath.p.positionZ.setTargetAtTime(m.pos.z, t, 0.05);
      breath.l.set(0.9, 0.4);
      this.madStride += Math.hypot(m.pos.x - m.prev.x, m.pos.z - m.prev.z) * (dt > 0 ? 1 : 0);
      if (this.madStride > (m.dangerous ? 1.5 : 0.95)) { this.madStride = 0; this.play(this.pick('mad_step', 3), { x: m.pos.x, y: 0.2, z: m.pos.z }, { vol: m.dangerous ? 0.95 : 0.6, rate: 0.9 + Math.random() * 0.15 }); }
    } else breath.l.set(0, 0.6);
    // watch readiness tick
    const ready = game.tools.has.watch && game.tools.watchCd <= 0;
    if (ready && this._wasReady === false) this.play('watch_ready', null, { vol: 0.6 });
    this._wasReady = ready;
    this.loop('fx:watch_tick', fxDest).set(game.tools.field?.echo ? 0.5 : 0, 0.2);
    this.loop('fx:lantern_hiss', fxDest).set(game.tools.focusing ? 0.42 * (0.4 + 0.6 * game.tools.reservoir) : 0, 0.15);
    this.loop('fx:breath_hurt', fxDest).set(game.player.damaged && game.player.alive ? 0.5 : 0, 0.5);
  }
  _spatialLoop(name) {
    if (this['_sl_' + name]) return this['_sl_' + name];
    const p = this.ctx.createPanner(); p.panningModel = 'equalpower'; p.distanceModel = 'inverse'; p.refDistance = 2.5; p.maxDistance = 40; p.rolloffFactor = 1.3; p.positionY.value = 1.6;
    const l = (this.loops['fx:' + name] = new Loop(this, name, this.sfx, { panner: p, fade: 0.8 }));
    return (this['_sl_' + name] = { p, l });
  }

  // --- event wiring --------------------------------------------------------------------------------
  _wire() {
    const P = (n, pos, o) => this.play(n, pos, o);
    const on = (ev, fn) => bus.on(ev, (e) => { if (this.ctx?.state === 'running') fn(e || {}); });
    bus.on('settings.changed', () => this.applySettings());
    on('player.footstep', (e) => { const s = e.surface === 'metal' ? ['fs_metal', 4] : e.surface === 'stone' ? ['fs_stone', 2] : ['fs_wood', 4]; P(this.pick(...s), null, { vol: e.sprint ? 0.55 : 0.3, rate: (e.sprint ? 1.06 : 0.96) + Math.random() * 0.08 }); if (Math.random() < 0.3) P('cloth', null, { vol: 0.18 }); });
    on('player.stand', () => P('cloth', null, { vol: 0.5 }));
    on('player.hurt', () => { P('hurt', null, { vol: 0.9 }); P('wrench_body', null, { vol: 0.8, rate: 0.8 }); });
    on('player.dead', (e) => { if (e.cause === 'fall') P('fall_yell', null, { vol: 0.8 }); else P('hurt', null, { vol: 1, rate: 0.85 }); });
    on('dialogue', (e) => { if (e.id === 'mitchell_line') P('vo_mitchell', null, { bus: 'dialogue' }); else if (e.id === 'conductor_1') P('vo_conductor_1', { x: 19, y: 2, z: 0 }, { bus: 'dialogue', lp: 2400, vol: 1.4 }); else if (e.id === 'conductor_2') P('vo_conductor_2', null, { bus: 'dialogue', lp: 1500, rate: 0.86, echo: true, vol: 0.9 }); });
    on('tool.acquired', (e) => P(e.tool === 'lantern' ? 'lantern_pick' : 'pickup', null, { vol: 0.8 }));
    on('inspect.open', () => P('paper', null, { vol: 0.7 }));
    on('door.open', (e) => P(e.forced ? 'door_forced' : 'door_open', e, { vol: 0.9 }));
    on('door.slam', (e) => { P('door_slam', e, { vol: 1 }); this.caption('door slams', 2); });
    on('world.wrong', () => { P('blackout', null, { vol: 0.8 }); });
    on('world.stretch', (e) => { P('stretch', e, { vol: 1 }); this.caption('wood groaning', 2.5); });
    on('world.loop', () => P('lamp_flicker', null, { vol: 0.3, rate: 0.8 }));
    on('world.luggage', () => {});
    on('world.bridge_snap', (e) => { this.duckFor(1.4); P('luggage_fall', e); P('collapse_wood', e, { when: 0.15 }); this.caption('luggage crashes through the bridge', 2.5); });
    on('world.gate', (e) => { P('mad_gate', e); this.caption('metal tearing', 2); });
    // fracture language: stress → critical chain → failure
    on('fracture.state_changed', (e) => {
      const pn = e.panel, pos = { x: pn.cx, y: 0, z: pn.cz }, metal = pn.spec.mat === 'grate';
      if (e.state === 1 && e.prev === 0) { P(this.pick('crack_tick', 3), pos, { vol: 0.9 }); P('crack_stress', pos, { vol: 0.7, when: 0.15 }); this.caption('floor creaking', 2); }
      else if (e.state === 2) { this.duckFor(0.9, 0.5); P('crack_critical', pos, { vol: 1, rate: metal ? 0.82 : 1 }); this.caption('sharp cracking', 2); }
      else if (e.state === 3) { this.duckFor(1.4); if (e.cause !== 'luggage') P(metal ? 'collapse_metal' : 'collapse_wood', pos, { vol: 1 }); this.caption(e.cause === 'expire' ? 'the floor fails again' : 'floor collapses', 2.2); }
      else if (e.state === 0 && e.prev > 0) P('settle', pos, { vol: 0.35 });
    });
    on('fracture.warning', (e) => { const pn = e.panel, pos = { x: pn.cx, y: 0, z: pn.cz }; if (e.restore) { P('watch_expire', pos, { vol: 0.9 }); this.caption('ticking accelerates', 1.6); } else { P('crack_critical', pos, { vol: 1.1, rate: 1.25 }); P(this.pick('crack_tick', 3), null, { vol: 0.5, rate: 1.3 }); } });
    on('fracture.rewind_start', (e) => P('watch_rewind', { x: e.panel.cx, y: 0.5, z: e.panel.cz }, { vol: 1 }));
    on('wrench.swing', () => P('wrench_swing', null, { vol: 0.7 }));
    on('wrench.hit', (e) => { if (e.kind === 'mechanism') P('wrench_latch', null, { vol: 0.9 }); else if (e.kind === 'clank') { P('wrench_clank', null, { vol: 1 }); this.caption('wrench rings on iron', 1.6); } else if (e.kind === 'madness') { P('wrench_body', null, { vol: 1 }); P('mad_stagger', null, { vol: 0.9, when: 0.05 }); } });
    on('watch.cast', () => P('watch_cast', null, { vol: 0.8 }));
    on('watch.no_echo', () => { P('watch_noecho', null, { vol: 0.8 }); this.caption('no echo', 1.5); });
    on('watch.denied', () => P('watch_noecho', null, { vol: 0.3, rate: 1.4 }));
    on('lantern.depleted', () => P('lantern_deplete', null, { vol: 0.6 }));
    on('lantern.revealed', (e) => P('reveal', { x: e.it.x, y: 1.2, z: e.it.z }, { vol: 0.8 }));
    // the hunter's signature language (GDD 16.5)
    on('madness.warning', (e) => { this.duckFor(1.6, 0.4); P('mad_ticks', e.far ? { x: e.x, y: 0, z: e.z } : null, { vol: 1 }); this.caption('three ticks — cloth tightening', 2.5); });
    on('madness.reveal', (e) => { P('mad_ticks', null, { vol: 0.9 }); P('mad_scream', e, { vol: 0.5, when: 1.4, lp: 1800 }); });
    on('madness.stumble', (e) => { P('mad_stumble', e, { vol: 1 }); this.caption('it loses its footing', 2); });
    on('madness.charge', (e) => { this.duckFor(1.0, 0.3); P('mad_charge', e, { vol: 1 }); P('mad_charge', null, { vol: 0.4 }); this.caption('buckle snaps — sharp inhale', 1.4); }); // non-spatial safety layer (GDD 16.6)
    on('madness.state', (e) => { const m = this._game?.madness; if (!m) return; if (e.state === 'lunge') P('mad_lunge', { x: m.pos.x, y: 1.4, z: m.pos.z }); if (e.state === 'shield') P('mad_stagger', { x: m.pos.x, y: 1.6, z: m.pos.z }, { rate: 1.2 }); });
    on('madness.approach', (e) => { P('mad_pound', e, { vol: 1, lp: 1400 }); this.caption('pounding behind the door', 2.4); });
    on('madness.enter', (e) => { P('door_forced', e); P('mad_scream', e, { vol: 0.9, when: 0.2 }); });
    on('madness.falling', (e) => { P('mad_fall', e, { vol: 1 }); });
    on('trap.primed', (e) => { P('pin_pull', e, { vol: 1 }); this.caption('counterweight shifts overhead', 2.5); });
    on('trap.locked', () => P('locked', null, { vol: 0.9 }));
    on('trap.reset', (e) => { P('cable_pull', e); P('cable_return', e, { when: 0.5 }); this.caption('the cable springs back', 2); });
    on('trap.rearmed', () => P('watch_ready', null, { vol: 0.5, rate: 0.7 }));
    on('trap.loaded', () => { this.loop('fx:tension', { dest: this.sfx }).set(0.9, 0.2); this.caption('cable straining', 2); });
    on('trap.unloaded', () => this.loops['fx:tension']?.set(0, 0.5));
    on('trap.triggered', (e) => { this.loops['fx:tension']?.set(0, 0.1); this.duckFor(4, 0.05); P('cable_pull', null, { vol: 1 }); P('collapse_trap', e, { vol: 1, when: 0.1 }); this.caption('the rig collapses', 3); });
    on('game.victory', () => { P('victory_whistle', null, { vol: 0.8 }); P('settle', null, { vol: 0.7, when: 1.5 }); });
    on('game.end', () => { P('sting', null, { bus: 'music', vol: 0.9 }); this.setMusic('none', 0.4); });
    on('checkpoint.loaded', () => this.silenceGame());
  }
  attach(game) { this._game = game; }
}
