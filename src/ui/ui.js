import '@fontsource/cormorant-garamond/300.css';
import '@fontsource/cormorant-garamond/400.css';
import '@fontsource/cormorant-garamond/400-italic.css';
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/jost/300.css';
import '@fontsource/jost/400.css';
import './styles.css';
import * as THREE from 'three/webgpu';
import { bus } from '../core/events.js';
import { settings, setSetting, resetSettings, DEFAULT_BINDINGS } from '../core/settings.js';
import { codeLabel } from '../core/input.js';
import { icon } from './icons.js';

const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const ACTION_NAMES = { forward: 'Move forward', back: 'Move back', left: 'Move left', right: 'Move right', sprint: 'Sprint', interact: 'Interact', wrench: 'Wrench', lantern: 'Focus lantern', watch: "Conductor's Watch", objective: 'Objective reminder' };
const INSPECT = {
  photo: { img: 'assets/img/photo.webp', cap: 'Studio portrait, 1929.' },
  order: { img: 'assets/img/order.webp', cap: 'The numbers will not hold still.' },
  ticket: { img: 'assets/img/ticket.webp', cap: 'There is no such station.' },
};
const _v = new THREE.Vector3();

export class UI {
  constructor(app) {
    this.app = app;
    const root = (this.root = document.getElementById('ui'));
    root.innerHTML = `
      <div id="hud" class="off">
        <div id="wedges"></div>
        <div id="objective"><div class="eyebrow">Objective</div><div class="text"></div><div class="rule"></div></div>
        <div id="toast"></div>
        <div id="hint"></div>
        <div id="prompt"></div>
        <div id="subs"></div>
        <div id="lantern"><i></i></div>
        <div id="watch">
          <svg viewBox="0 0 74 74"><circle class="ring" cx="37" cy="37" r="31"/><g class="ticks"></g><circle class="arc" cx="37" cy="37" r="26" transform="rotate(-90 37 37)" stroke-dasharray="163.4" stroke-dashoffset="0"/><line class="hand" x1="37" y1="37" x2="37" y2="17"/><circle cx="37" cy="37" r="1.6" fill="currentColor"/></svg>
          <span class="key k"></span>
        </div>
      </div>
      <div id="loading"><div class="mark">DESTINY GATE</div><div class="bar"><i></i></div><div class="what">Boarding</div></div>`;
    const ticks = root.querySelector('#watch .ticks');
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2, r0 = i % 3 ? 28.5 : 27, r1 = 31; ticks.insertAdjacentHTML('beforeend', `<line x1="${37 + Math.sin(a) * r0}" y1="${37 - Math.cos(a) * r0}" x2="${37 + Math.sin(a) * r1}" y2="${37 - Math.cos(a) * r1}"/>`); }
    this.el = Object.fromEntries(['hud', 'objective', 'toast', 'hint', 'prompt', 'subs', 'lantern', 'watch', 'loading', 'wedges'].map((k) => [k, root.querySelector('#' + k)]));
    this.screen = null; this.objT = 0; this.hintT = 0; this.subs = [];
    this.applyScale();
    bus.on('settings.changed', () => this.applyScale());
    bus.on('objective.changed', ({ text }) => { this.el.objective.querySelector('.text').textContent = text; this.objT = 5; });
    bus.on('hint', ({ text, action, dur }) => this.hint(text, action, dur));
    bus.on('dialogue', ({ speaker, text, dur }) => this.subtitle(speaker, text, dur));
    bus.on('subtitle', ({ speaker, text, dur }) => this.subtitle(speaker, text, dur));
    bus.on('caption', ({ text, dur }) => this.subtitle(null, text, dur || 2.2, true));
    bus.on('checkpoint.commit', () => this.toast('Checkpoint'));
    bus.on('inspect.open', ({ id }) => this.inspect(id));
    bus.on('tool.acquired', ({ tool }) => { if (tool === 'watch') this.el.watch.classList.add('on'); });
    addEventListener('keydown', (e) => this.key(e));
  }

  applyScale() { document.documentElement.style.setProperty('--ui-scale', settings.access.uiScale); }
  sfx(name) { this.app.audio?.ui(name); }
  bind(action) { return codeLabel(settings.controls.bindings[action]); }

  // ----------------------------------------------------------------------------------------------
  progress(k, what) { this.el.loading.querySelector('i').style.transform = `scaleX(${k})`; if (what) this.el.loading.querySelector('.what').textContent = what; }
  fatal(title, body) {
    this.el.loading.classList.remove('out');
    this.el.loading.innerHTML = `<div class="mark">DESTINY GATE</div><div class="eyebrow">${title}</div><div class="err">${body}</div>`;
  }
  loaded() { this.el.loading.classList.add('out'); setTimeout(() => this.el.loading.classList.add('hidden'), 1000); }

  open(el) { this.close(); this.screen = el; this.root.appendChild(el); const f = el.querySelector('.primary, .menu button, .btn'); f?.focus({ preventScroll: true }); return el; }
  close() { this.screen?.remove(); this.screen = null; }

  menuNav(el) {
    for (const b of el.querySelectorAll('button')) { b.addEventListener('mouseenter', () => { this.sfx('hover'); b.focus({ preventScroll: true }); }); b.addEventListener('click', () => this.sfx('select')); }
  }

  key(e) {
    if (this.listening) return;
    if (!this.screen) return;
    const items = [...this.screen.querySelectorAll('.menu button')];
    if (items.length && (e.code === 'ArrowDown' || e.code === 'ArrowUp' || e.code === 'KeyS' || e.code === 'KeyW')) {
      const i = items.indexOf(document.activeElement), n = (i + (e.code === 'ArrowDown' || e.code === 'KeyS' ? 1 : -1) + items.length) % items.length;
      items[i < 0 ? 0 : n].focus(); this.sfx('hover'); e.preventDefault();
    }
    if (e.code === 'Escape' && this.screen.dataset.back) { e.preventDefault(); e.stopImmediatePropagation(); this[this.screen.dataset.back](); }
    if (this.screen.id === 'inspect' && (e.code === 'KeyE' || e.code === 'Enter' || e.code === 'Space' || e.code === settings.controls.bindings.interact)) this.closeInspect();
  }

  // ---------------------------------------------------------------- title
  title() {
    const cont = this.app.savedCheckpoint();
    const el = h(`<div id="title">
      <div class="stamp">5:17 PM &nbsp;·&nbsp; December 24, 1932</div>
      <div class="col">
        <div class="eyebrow">Level 01 &nbsp;/&nbsp; Madness on the night train</div>
        <h1 class="wordmark"><span>DESTINY</span><span>GATE</span></h1>
        <div class="rule"></div>
        <div class="tag">A man rides home on Christmas Eve. Somewhere inside the train, something is breaking the world to reach him.</div>
        <nav class="menu">
          ${cont ? '<button class="primary" data-a="continue">Continue</button><button data-a="new">Enter the train <small>new journey</small></button>' : '<button class="primary" data-a="new">Enter the train</button>'}
          <button data-a="settings">Settings</button>
          <button data-a="credits">Credits</button>
        </nav>
      </div>
      <div class="foot">${icon('headphones')}Headphones recommended<br>Vertical slice &nbsp;·&nbsp; Keyboard &amp; mouse</div>
    </div>`);
    this.menuNav(el);
    el.addEventListener('click', (e) => {
      const a = e.target.closest('button')?.dataset.a; if (!a) return;
      if (a === 'new') this.app.begin('start'); else if (a === 'continue') this.app.begin(cont);
      else if (a === 'settings') this.settings('title'); else if (a === 'credits') this.credits();
    });
    this.open(el);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('in')));
    this.el.hud.classList.add('off');
  }

  // ---------------------------------------------------------------- content notice (GDD 17.2)
  notice(onDone) {
    const el = h(`<div class="veil"><div class="panel">
      <div class="eyebrow">Before you board</div><h2>Content notice</h2><div class="rule"></div>
      <p>Destiny Gate is <b>psychological horror</b>. It contains distressing imagery, <b>implied family violence and self-harm themes</b>, sudden sounds and flickering light.</p>
      <p>Pause is always available. A reduced-intensity mode softens flashes and loud peaks without changing the game.</p>
      <div class="opt"><label>Reduced intensity<small>Softer flashes, gentler volume peaks, less camera shake</small></label><div class="seg" data-s="access.reducedIntensity"><button data-v="false">Off</button><button data-v="true">On</button></div></div>
      <div class="opt"><label>Graphics<small>Changes fidelity only. Can be changed at any time.</small></label><div class="seg" data-s="graphics.preset"><button data-v="auto">Auto</button><button data-v="low">Low</button><button data-v="balanced">Balanced</button><button data-v="high">High</button></div></div>
      <div class="row-actions"><button class="btn primary" data-a="go">Enter the train</button><button class="btn" data-a="back">Back</button></div>
    </div></div>`);
    this.wireOptions(el);
    el.addEventListener('click', (e) => { const a = e.target.closest('button')?.dataset.a; if (a === 'go') { setSetting('seenNotice', true); this.sfx('select'); onDone(); } else if (a === 'back') this.title(); });
    el.dataset.back = 'title';
    this.open(el);
  }

  // ---------------------------------------------------------------- pause
  pause() {
    const el = h(`<div id="pause" class="veil"><div class="panel">
      <div class="eyebrow">Paused</div><h2>Destiny Gate</h2><div class="rule"></div>
      <div class="obj">${this.app.game.director.objective || ''}</div>
      <nav class="menu"><button class="primary" data-a="resume">Resume</button><button data-a="restart">Restart checkpoint</button><button data-a="settings">Settings</button><button data-a="quit">Quit to title</button></nav>
    </div></div>`);
    this.menuNav(el);
    el.addEventListener('click', (e) => {
      const a = e.target.closest('button')?.dataset.a; if (!a) return;
      if (a === 'resume') this.app.resume(); else if (a === 'restart') this.app.restartCheckpoint(); else if (a === 'settings') this.settings('pause'); else if (a === 'quit') this.app.toTitle();
    });
    el.dataset.back = 'resumeFromKey';
    this.open(el);
  }
  resumeFromKey() { this.app.resume(); }

  // ---------------------------------------------------------------- settings
  settings(from = 'title', tab = 'Graphics') {
    const sl = (path, min, max, step, pct = true) => `<div class="slider" data-s="${path}" data-pct="${pct}"><input type="range" min="${min}" max="${max}" step="${step}"><output></output></div>`;
    const sg = (path, opts) => `<div class="seg" data-s="${path}">${opts.map(([v, l]) => `<button data-v="${v}">${l}</button>`).join('')}</div>`;
    const tg = (path) => sg(path, [['false', 'Off'], ['true', 'On']]);
    const opt = (label, small, ctl) => `<div class="opt"><label>${label}${small ? `<small>${small}</small>` : ''}</label>${ctl}</div>`;
    const TABS = {
      Graphics: opt('Quality preset', 'Fidelity only — never collision, warnings or enemy rules', sg('graphics.preset', [['auto', 'Auto'], ['low', 'Low'], ['balanced', 'Balanced'], ['high', 'High']]))
        + opt('Render scale', 'Internal resolution', sl('graphics.renderScale', 0.5, 1, 0.05))
        + opt('Adaptive resolution', 'Lowers resolution briefly to protect frame rate', tg('graphics.adaptive'))
        + opt('Film grain', '', tg('graphics.filmGrain'))
        + opt('Renderer', 'WebGPU is experimental. Applies after reload.', sg('graphics.backend', [['webgl', 'WebGL 2'], ['webgpu', 'WebGPU']]))
        + opt('Brightness', 'Floor seams should stay visible in the dark', sl('access.brightness', 0.7, 1.5, 0.05)),
      Audio: opt('Master volume', '', sl('audio.master', 0, 1, 0.05)) + opt('Music', '', sl('audio.music', 0, 1, 0.05)) + opt('Sound effects', '', sl('audio.sfx', 0, 1, 0.05)) + opt('Dialogue', '', sl('audio.dialogue', 0, 1, 0.05))
        + opt('Reduced dynamic range', 'Keeps every warning audible without startling peaks', tg('audio.reducedRange')),
      Controls: opt('Look sensitivity', '', sl('controls.sensitivity', 0.3, 2.5, 0.05, false)) + opt('Invert vertical look', '', tg('controls.invertY')) + opt('Lantern focus', '', sg('controls.toggleLantern', [['false', 'Hold'], ['true', 'Toggle']])) + opt('Sprint', '', sg('controls.toggleSprint', [['false', 'Hold'], ['true', 'Toggle']]))
        + Object.keys(DEFAULT_BINDINGS).map((a) => opt(ACTION_NAMES[a], '', `<button class="bind" data-bind="${a}"></button>`)).join('')
        + opt('', '', `<div class="seg"><button data-a="resetBinds">Restore defaults</button></div>`),
      Accessibility: opt('Subtitles', 'With speaker and sound labels', tg('access.subtitles')) + opt('Interactable markers', 'High-contrast markers on things you can use', tg('access.outlines')) + opt('Persistent objective', 'Keep the objective on screen', tg('access.persistentHints'))
        + opt('Threat direction', 'Shows a wedge toward the hunter when it is close', tg('access.threatWedges')) + opt('Reduced camera motion', 'No camera shake', tg('access.reducedMotion')) + opt('Reduced intensity', 'Softer flashes and volume peaks', tg('access.reducedIntensity'))
        + opt('Interface size', '', sl('access.uiScale', 0.85, 1.4, 0.05)),
    };
    const el = h(`<div class="veil"><div class="panel">
      <div class="eyebrow">Settings</div><h2>${tab}</h2><div class="rule"></div>
      <div class="tabs">${Object.keys(TABS).map((t) => `<button class="${t === tab ? 'on' : ''}" data-tab="${t}">${t}</button>`).join('')}</div>
      <div class="opts">${TABS[tab]}</div>
      <div class="row-actions"><button class="btn primary" data-a="back">Back</button></div>
    </div></div>`);
    this.wireOptions(el);
    const back = () => (from === 'pause' ? this.pause() : this.title());
    this._settingsBack = back;
    el.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.tab) { this.sfx('select'); this.settings(from, b.dataset.tab); }
      else if (b.dataset.a === 'back') { this.sfx('select'); back(); }
      else if (b.dataset.a === 'resetBinds') { resetSettings('controls'); this.settings(from, 'Controls'); }
      else if (b.dataset.bind) {
        b.classList.add('listen'); b.textContent = 'Press a key'; this.listening = true;
        this.app.input.capture = (code) => {
          this.listening = false;
          if (code !== 'Escape') { const bd = settings.controls.bindings; for (const k of Object.keys(bd)) if (bd[k] === code && k !== b.dataset.bind) bd[k] = bd[b.dataset.bind]; setSetting(`controls.bindings.${b.dataset.bind}`, code); }
          this.settings(from, 'Controls');
        };
      }
    });
    el.dataset.back = 'settingsBack';
    this.open(el);
  }
  settingsBack() { this._settingsBack?.(); }

  wireOptions(el) {
    const get = (path) => path.split('.').reduce((o, k) => o[k], settings);
    for (const seg of el.querySelectorAll('.seg[data-s]')) {
      const path = seg.dataset.s, cur = String(get(path));
      for (const b of seg.children) { b.classList.toggle('on', b.dataset.v === cur); b.addEventListener('click', () => { const v = b.dataset.v === 'true' ? true : b.dataset.v === 'false' ? false : b.dataset.v; setSetting(path, v); for (const c of seg.children) c.classList.toggle('on', c === b); this.sfx('select'); }); }
    }
    for (const s of el.querySelectorAll('.slider[data-s]')) {
      const path = s.dataset.s, input = s.querySelector('input'), out = s.querySelector('output');
      const show = (v) => { out.textContent = s.dataset.pct === 'true' ? Math.round(v * 100) + '%' : (+v).toFixed(2); };
      input.value = get(path); show(input.value);
      input.addEventListener('input', () => { setSetting(path, +input.value); show(input.value); });
    }
    for (const b of el.querySelectorAll('[data-bind]')) b.textContent = this.bind(b.dataset.bind);
  }

  // ---------------------------------------------------------------- credits / rights notice
  credits() {
    const el = h(`<div class="veil"><div class="panel">
      <div class="eyebrow">Credits &amp; rights</div><h2>Destiny Gate</h2><div class="rule"></div>
      <div class="credits">
        <h3>Original concept</h3><p>Destiny Gate — Design Overview and Concept Overview &amp; Artwork © 2009 Paul Limon / Nick Creature. Characters, era, setting and core mechanics come from those documents. This build is an internal vertical-slice study.</p>
        <h3>Vertical slice</h3><p>Level 01 design specification: “Madness on the Night Train”. Level layout, puzzle sequencing, tuning and implementation were produced for this slice and are not claimed to appear in the originals.</p>
        <h3>Generated assets</h3><p>Characters, props, tiling materials, flat art, sound effects, music and voice were generated with models served through fal.ai (Nano Banana Pro, Meshy 7.1 and Meshy auto-rigging, PATINA materials, ElevenLabs sound effects, music and speech) and then processed for the browser. A full provenance ledger ships with the source repository.</p>
        <h3>Technology</h3><p>three.js WebGPURenderer and TSL, running on WebGL 2 by default. Cormorant Garamond and Jost typefaces (SIL Open Font License).</p>
        <h3>Notice</h3><p>Rights to the title, branding and the 2009 concept art must be confirmed before any public distribution.</p>
      </div>
      <div class="row-actions"><button class="btn primary" data-a="back">Back</button></div>
    </div></div>`);
    el.addEventListener('click', (e) => { if (e.target.closest('button')?.dataset.a === 'back') { this.sfx('select'); this.title(); } });
    el.dataset.back = 'title';
    this.open(el);
  }

  // ---------------------------------------------------------------- inspect
  inspect(id) {
    const d = INSPECT[id]; if (!d) return;
    const el = h(`<div id="inspect"><div class="frame"><img src="${d.img}" alt=""><div class="glint"></div></div><div class="cap">${d.cap}</div><div class="close"><span class="key">${this.bind('interact')}</span>Put it away</div></div>`);
    el.addEventListener('click', () => this.closeInspect());
    this.app.input.releaseLock?.();
    this.open(el);
    this.app.state = 'inspect';
  }
  closeInspect() { if (this.screen?.id !== 'inspect') return; this.close(); this.app.state = 'playing'; this.app.input.clear(); this.app.input.requestLock(); bus.emit('inspect.close', {}); }

  // ---------------------------------------------------------------- end card (hard cut)
  end({ time = 0, deaths = 0, watchUses = 0 } = {}) {
    const mm = Math.floor(time / 60), ss = String(Math.floor(time % 60)).padStart(2, '0');
    const el = h(`<div id="end">
      <h1 class="wordmark">DESTINY GATE</h1>
      <div class="tag">The train runs on. So does he.</div>
      <div class="stats"><div><b>${mm}:${ss}</b>Journey</div><div><b>${watchUses}</b>Rewinds</div><div><b>${deaths}</b>Failures</div></div>
      <div class="row-actions"><button class="btn primary" data-a="again">Continue the journey</button><button class="btn" data-a="title">Return to title</button></div>
    </div>`);
    el.addEventListener('click', (e) => { const a = e.target.closest('button')?.dataset.a; if (a === 'again') this.app.begin('start', true); else if (a === 'title') this.app.toTitle(); });
    this.el.hud.classList.add('off');
    this.open(el);
  }

  // ---------------------------------------------------------------- HUD pieces
  hint(text, action, dur = 4.5) {
    const keys = action === 'move' ? ['forward', 'left', 'back', 'right'].map((a) => `<span class="key">${this.bind(a)}</span>`).join('') : action ? `<span class="key">${this.bind(action)}</span>` : '';
    this.el.hint.innerHTML = `${keys}<span>${text}</span>`; this.el.hint.classList.add('on'); this.hintT = dur;
  }
  toast(text) { this.el.toast.textContent = text; this.el.toast.classList.add('on'); clearTimeout(this._tt); this._tt = setTimeout(() => this.el.toast.classList.remove('on'), 2600); }
  subtitle(speaker, text, dur = 3.5, sound = false) {
    if (!settings.access.subtitles) return;
    if (sound && this.subs.some((s) => s.text === text)) return;
    const el = h(`<div class="line${sound ? ' sound' : ''}">${speaker ? `<b>${speaker}</b>` : ''}${sound ? `[${text}]` : text}</div>`);
    this.el.subs.appendChild(el); this.subs.push({ el, t: dur, text });
    while (this.subs.length > 3) this.subs.shift().el.remove();
  }
  hudOn(on) { this.el.hud.classList.toggle('off', !on); }
  resetHud() { for (const s of this.subs) s.el.remove(); this.subs = []; this.el.hint.classList.remove('on'); this.el.watch.classList.toggle('on', !!this.app.game.tools.has.watch); }

  /** Per-frame HUD refresh. */
  frame(dt, game) {
    const t = game.tools, d = game.director, el = this.el;
    // prompt
    const p = this.app.state === 'playing' && game.player.controllable ? t.prompt : null;
    const key = p ? `${p.action}:${p.text}` : '';
    if (key !== this._pk) { this._pk = key; if (p) el.prompt.innerHTML = `<span class="key">${this.bind(p.action)}</span><span>${p.text}</span>`; el.prompt.classList.toggle('on', !!p); }
    // objective: on request, after change, or persistent
    if (this.objT > 0) this.objT -= dt;
    el.objective.classList.toggle('on', !!d.objective && (this.objT > 0 || settings.access.persistentHints || this.app.input.held('objective')));
    if (this.hintT > 0) { this.hintT -= dt; if (this.hintT <= 0) el.hint.classList.remove('on'); }
    for (let i = this.subs.length - 1; i >= 0; i--) { const s = this.subs[i]; s.t -= dt; if (s.t <= 0) { s.el.remove(); this.subs.splice(i, 1); } }
    // watch dial: blooms when available or charging (GDD 11.3)
    if (t.has.watch) {
      const cd = t.watchCd, full = t.field && !t.field.echo ? 2.2 : 12, k = cd > 0 ? 1 - Math.min(1, cd / full) : 1;
      const ready = cd <= 0;
      if (ready !== this._wr) { this._wr = ready; el.watch.classList.toggle('ready', ready); if (ready) { el.watch.classList.remove('ready'); void el.watch.offsetWidth; el.watch.classList.add('ready'); } }
      el.watch.querySelector('.arc').style.strokeDashoffset = String(163.4 * (1 - k));
      el.watch.querySelector('.hand').style.transform = `rotate(${k * 360}deg)`;
      el.watch.querySelector('.k').textContent = this.bind('watch');
      const show = !ready || this._watchShow > 0 || game.fracture.eligibleNear(game.player.pos.x, game.player.pos.z, 9);
      if (!ready) this._watchShow = 3; else if (this._watchShow > 0) this._watchShow -= dt;
      el.watch.classList.toggle('on', show);
    } else el.watch.classList.remove('on');
    // lantern reservoir: only while focusing or refilling low
    const showL = t.has.lantern && (t.focusing || t.reservoir < 0.98);
    el.lantern.classList.toggle('on', showL);
    if (showL) { el.lantern.firstElementChild.style.height = `${t.reservoir * 100}%`; el.lantern.classList.toggle('low', t.depleted); }
    this.markers(game);
  }

  /** Accessibility: interactable markers and threat wedge, projected to the screen. */
  markers(game) {
    const el = this.el.wedges, cam = game.gfx.camera, w = innerWidth, hh = innerHeight;
    let i = 0;
    const put = (x, y, rot, alpha, scale = 1) => {
      let m = el.children[i++]; if (!m) { m = document.createElement('i'); el.appendChild(m); }
      m.style.opacity = alpha; m.style.transform = `translate(${x - w / 2 - 9}px, ${y - hh / 2 - 10}px) rotate(${rot}rad) scale(${scale})`;
    };
    if (settings.access.outlines && this.app.state === 'playing') {
      for (const it of game.world.interactables) {
        if (!it.enabled || it.hidden) continue;
        const d = Math.hypot(it.x - game.player.pos.x, it.z - game.player.pos.z); if (d > 7) continue;
        _v.set(it.x, 1.15, it.z).project(cam); if (_v.z > 1) continue;
        put((_v.x * 0.5 + 0.5) * w, (-_v.y * 0.5 + 0.5) * hh, Math.PI, 0.85, 0.5);
      }
    }
    const m = game.madness;
    if (settings.access.threatWedges && m.active && this.app.state === 'playing') {
      const d = Math.hypot(m.pos.x - game.player.pos.x, m.pos.z - game.player.pos.z);
      if (d < 14) {
        const a = Math.atan2(m.pos.x - game.player.pos.x, m.pos.z - game.player.pos.z) - game.cam.yaw; // 0 = ahead
        const r = Math.min(w, hh) * 0.36;
        put(w / 2 - Math.sin(a) * r, hh / 2 - Math.cos(a) * r, -a, 0.25 + 0.6 * (1 - d / 14) + (m.dangerous ? 0.15 : 0), 1);
      }
    }
    for (; i < el.children.length; i++) el.children[i].style.opacity = 0;
  }
}
