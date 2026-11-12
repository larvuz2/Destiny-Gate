import * as THREE from 'three/webgpu';
import { bus } from '../core/events.js';
import { F } from './fracture.js';
import { B } from '../world/zones/coachB.js';
import { PropBatch } from '../world/props.js';

// EncounterDirector — authored beats, spawn legality, objectives and checkpoints (GDD 10, 11, 20.1).
// It only ever sets small deterministic flags; everything else is derived from them on reload.
const SAVE_KEY = 'destiny-gate.save.v1';
const OBJ = {
  conductor: 'Find the conductor.',
  front: 'Reach the front of the train.',
  latch: 'Force the jammed door.',
  service: 'Find a way through the service car.',
  cross: 'Restore the crossing.',
  hide: 'Do not let it see you.',
  out: 'Find the way out of the service car.',
  release: 'The door release is hidden. Use the lantern.',
  deck: 'Reach the control deck.',
  lure: 'Use the train against it.',
  leave: 'Leave the train.',
};
// Flags are cumulative: a later checkpoint implies every earlier beat has played.
const FL_A = { stood: true, line: true, announce: true, echo: true, wrong: true, stretched: true };
const FL_B = { ...FL_A, loops: 0, demo: true, latch: true };
const FL_C1 = { ...FL_B, inC: true, dropped: true, dropKick: true, crossed: true };
const FL_C2 = { ...FL_C1, revealed: true, revealGo: true, revealWalk: true, gateSnd: true };
const FL_D = { ...FL_C2, hintRelease: true, released: true, inD: true };
const ALL_TOOLS = { wrench: true, lantern: true, watch: true };
const CHECKPOINTS = {
  start: { marker: 'spawn', tools: {}, flags: {} },
  cp1: { marker: 'cp1', tools: {}, flags: FL_A, panels: {}, objective: 'front' },
  cp1b: { marker: 'softCheckpoint', tools: ALL_TOOLS, flags: FL_C1, panels: { B_demo: F.FAILED, C_bridge: F.FAILED }, objective: 'out' },
  // silent autosave once the first hunt has cooled: no replay of the reveal after a death in the loop
  cp1c: { marker: 'softCheckpoint', tools: ALL_TOOLS, flags: FL_C2, panels: { B_demo: F.FAILED, C_bridge: F.FAILED, C_reveal: F.FAILED }, objective: 'out' },
  cp2: { marker: 'cp2', tools: ALL_TOOLS, flags: FL_D, panels: { B_demo: F.FAILED, C_bridge: F.FAILED, C_reveal: F.FAILED, C_exit: F.FAILED }, objective: 'deck' },
};

export class Director {
  constructor(game) {
    this.game = game;
    this.flags = {}; this.cp = 'start'; this.objective = ''; this.beat = null; this.beatT = 0;
    this.scriptThreat = null; this.deadT = -1; this.endT = -1; this.won = false; this.music = 'M0';
    this.trap = { primed: false, busy: 0, sprung: false };
    this.stats = { deaths: 0, start: 0, watchUses: 0 };
    bus.on('player.dead', () => { if (this.deadT < 0) { this.deadT = 0; this.stats.deaths++; } });
    bus.on('madness.fell', () => this._onMadnessFell());
    bus.on('madness.state', (e) => this._onMadnessState(e));
    bus.on('inspect.close', () => { this.game.player.frozen = false; this.game.tools.useLock = 0.45; this.game.input.clear(); });
    bus.on('watch.rewind_start', (e) => { this.stats.watchUses++; if (e.panels.includes('C_bridge') && !this.flags.crossed) this.hint('Cross before it fails again.', null, 3.5); });
  }

  // --- setup: pickups, inspectables and mechanisms ----------------------------------------------
  setup() {
    const g = this.game, w = g.world, mk = w.markers, pb = new PropBatch(w.props);
    const zone = (id) => w.zones.find((z) => z.id === id).group;
    this.views = {};
    const paper = (tex, wd, ht) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(wd, ht), new THREE.MeshStandardNodeMaterial({ map: tex, roughness: 0.9, side: THREE.DoubleSide })); m.receiveShadow = true; return m; };

    // Coach A — memory objects (GDD 3.2): never keys, never consumables
    const photo = paper(w.tex.photo, 0.105, 0.13); photo.position.set(4.42, 0.56, 1.13); photo.rotation.set(-Math.PI / 2 + 0.25, 0, 0.3); zone('A').add(photo);
    w.interact({ id: 'photo', x: 4.5, z: 0.75, r: 1.25, wide: true, prompt: 'Look at the photograph', onUse: () => this.inspect('photo') });
    const order = paper(w.tex.order, 0.2, 0.27); order.position.set(10.3, 0.56, -0.74); order.rotation.set(-Math.PI / 2, 0, -0.5); zone('A').add(order);
    w.interact({ id: 'order', x: 10.3, z: -0.35, r: 1.0, wide: true, prompt: 'Read the sales order', onUse: () => this.inspect('order') });
    w.interact({ id: 'A_front', x: 19.75, z: 0, r: 1.15, prompt: 'Open the door', onUse: (it) => { w.doors.A_front.target = 1; it.enabled = false; bus.emit('door.open', { id: 'A_front', x: 20, z: 0 }); } });

    // Coach B — wrench, ticket, jammed latch
    const wr = pb.single('wrench', { size: 0.78, fit: 'x' }); wr.position.set(mk.wrench.x, mk.wrench.y - 0.07, mk.wrench.z); wr.rotation.set(0, 0, 0); zone('B').add(wr); this.views.wrench = wr;
    this.its = {};
    this.its.wrench = w.interact({ id: 'wrench', x: mk.wrench.x, z: mk.wrench.z - 0.35, r: 1.25, wide: true, prompt: 'Take the wrench', onUse: (it) => { it.enabled = false; wr.visible = false; g.tools.give('wrench'); this.hint('Strike or pull with the wrench', 'wrench', 5); } });
    const ticket = paper(w.tex.ticket, 0.16, 0.09); ticket.position.set(47.52, 0.515, 1.04); ticket.rotation.set(-Math.PI / 2, 0, 0.7); zone('B').add(ticket);
    w.interact({ id: 'ticket', x: 47.35, z: 0.55, r: 1.0, wide: true, prompt: 'Pick up the ticket', onUse: () => this.inspect('ticket') });
    this.its.latch = w.interact({ id: 'latch', kind: 'wrench', x: mk.latch.x - 0.25, z: mk.latch.z - 0.15, r: 1.5, prompt: 'Break the latch', onWrench: (it) => { it.enabled = false; this.flags.latch = true; const d = w.doors.B_end; d.locked = false; d.target = 1; d.speed = 2.6; bus.emit('door.open', { id: 'B_end', x: d.x, z: 0, forced: true }); this.setObjective('service'); } });

    // Coach C — lantern, watch, luggage, release
    const ln = pb.single('lantern', { size: 0.36, fit: 'y' }); ln.position.set(mk.lantern.x, mk.lantern.y - 0.36, mk.lantern.z); zone('C').add(ln); this.views.lantern = ln;
    this.pickupGlow = new THREE.PointLight(0xffc477, 2.2, 4.5, 1.8); this.pickupGlow.position.set(mk.lantern.x, mk.lantern.y - 0.15, mk.lantern.z); zone('C').add(this.pickupGlow);
    this.its.lantern = w.interact({ id: 'lantern', x: mk.lantern.x - 0.1, z: mk.lantern.z - 0.1, r: 1.3, wide: true, prompt: 'Take the lantern', onUse: (it) => { it.enabled = false; ln.visible = false; this.pickupGlow.intensity = 0; g.tools.give('lantern'); this.hint('Hold to focus the lantern', 'lantern', 5); } });
    const wt = pb.single('watch', { size: 0.13, fit: 'y' }); wt.position.set(mk.watch.x - 0.02, mk.watch.y - 0.1, mk.watch.z); wt.rotation.y = -Math.PI / 2; zone('C').add(wt); this.views.watch = wt;
    this.its.watch = w.interact({ id: 'watch', x: mk.watch.x - 0.3, z: mk.watch.z, r: 1.3, wide: true, prompt: "Take the conductor's watch", onUse: (it) => { it.enabled = false; wt.visible = false; g.tools.give('watch'); this.setObjective('cross'); this.hint('Face the broken crossing and rewind it', 'watch', 7); } });
    // luggage that snaps the bridge: extras of the bridge panel so the Watch lifts them back too
    const bridge = g.fracture.get('C_bridge');
    const d = mk.luggageDrop;
    [['crate', 0, 0, 0, 0.95, 0.2], ['suitcase_a', 0.15, 0.78, 0.1, 0.8, 1.1], ['suitcase_b', -0.5, 0.1, -0.35, 0.8, 2.0]].forEach(([n, ox, oy, oz, size, ry]) => {
      const m = pb.single(n, { size, fit: 'x' }); m.position.set(d.x + ox, d.y + oy, d.z + oz); m.rotation.y = ry;
      zone('C').add(m);
      const ex = bridge.addExtra(m, m.position.clone());
      ex.spinInit = [(ox + 0.3) * 2, 0.5, (oz - 0.2) * 3];
    });
    const flap = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.7), w.mats.get('canvas'));
    flap.geometry.translate(0, -0.35, 0);
    flap.position.set(mk.release.x - 0.07, 1.62, mk.release.z); flap.rotation.y = -Math.PI / 2; flap.castShadow = true;
    zone('C').add(flap); this.views.flap = flap; this.flapK = 0;
    w.dynamic.push({ update: (dt) => { const want = this.its.release.hidden ? Math.min(0.12, (this.its.release.reveal || 0) * 0.12) : 1; this.flapK += (want - this.flapK) * Math.min(1, dt * 5); flap.rotation.x = 0; flap.rotation.z = this.flapK * 2.3; flap.position.y = 1.62 + this.flapK * 0.05; } });
    this.its.release = w.interact({ id: 'release', kind: 'wrench', hidden: true, x: mk.release.x - 0.2, y: mk.release.y, z: mk.release.z, r: 1.6, prompt: 'Throw the release', onReveal: () => { bus.emit('subtitle', { text: 'A release, behind the canvas.', dur: 3 }); },
      onWrench: (it) => { it.enabled = false; this.flags.released = true; w.exitBar.target = 1; const dr = w.doors.C_exit; dr.locked = false; dr.target = 1; bus.emit('door.open', { id: 'C_exit', x: dr.x, z: 0, forced: true }); this.setObjective('out'); } });

    // Coach D — release pin and cable handle
    this.its.pin = w.interact({ id: 'pin', kind: 'wrench', pull: true, x: mk.pin.x, y: 0.45, z: mk.pin.z - 0.2, r: 1.5, prompt: 'Pull the release pin', onWrench: (it) => this._prime(it) });
    this.its.handle = w.interact({ id: 'handle', kind: 'wrench', pull: true, x: mk.handle.x, y: 1.15, z: mk.handle.z + 0.2, r: 1.5, prompt: 'Pull the cable', onWrench: () => this._pullCable() });
    this.passengers = g.world.passengers;
  }

  // --- small helpers -------------------------------------------------------------------------------
  setObjective(key) { if (this.objKey === key) return; this.objKey = key; this.objective = OBJ[key] || ''; bus.emit('objective.changed', { key, text: this.objective }); }
  hint(text, action = null, dur = 4.5) { bus.emit('hint', { text, action, dur }); }
  inspect(id) { this.game.player.frozen = true; this.flags['saw_' + id] = true; bus.emit('inspect.open', { id }); }
  setMusic(m) { if (this.music !== m) { this.music = m; bus.emit('music.state', { state: m }); } }
  startBeat(name) { this.beat = name; this.beatT = 0; }

  // --- checkpoints ---------------------------------------------------------------------------------
  commit(id) {
    if (this.cp === id) return;
    this.cp = id;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify({ cp: id, t: Date.now() })); } catch { /* storage unavailable */ }
    bus.emit('checkpoint.commit', { id });
  }
  static saved() { try { const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); return s && CHECKPOINTS[s.cp] && s.cp !== 'start' ? s.cp : null; } catch { return null; } }
  static clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ } }

  /** Rebuild the whole world state from a checkpoint's flags. */
  load(id = 'start') {
    const g = this.game, w = g.world, cp = CHECKPOINTS[id] || CHECKPOINTS.start, mk = w.markers[cp.marker];
    this.cp = id; this.flags = { loops: 3, ...cp.flags }; this.beat = null; this.beatT = 0; this.deadT = -1; this.endT = -1; this.won = false; this.scriptThreat = null;
    this.trap = { primed: false, busy: 0, sprung: false }; this._crawlSide = undefined;
    const f = this.flags;
    g.fracture.reset(cp.panels || {});
    g.tools.restore({ wrench: false, lantern: false, watch: false, ...cp.tools });
    g.madness.despawn();
    // doors & mechanisms
    const D = w.doors;
    const setDoor = (d, open, locked) => { d.open = d.target = open ? 1 : 0; d.locked = locked; d.pivot.rotation.y = d.open * 1.75 * d.swing; d.wall.enabled = !open; };
    w.navDirty = true;
    setDoor(D.A_front, id !== 'start', false); setDoor(D.B_end, !!f.latch, !f.latch); setDoor(D.C_exit, false, true); setDoor(D.D_exit, false, true);
    w.stretch.k = f.stretched ? 1 : 0;
    w.gate.open = w.gate.target = f.revealed ? 1 : 0; w.gate.burst = 0;
    w.exitBar.lift = w.exitBar.target = 0;
    w.counterweight.drop = w.counterweight.target = 0; w.tension.mat.emissiveIntensity = 0;
    w.markers.handle.obj.position.y = w.markers.handle.y0;
    // pickups / interactables
    const has = g.tools.has;
    this.views.wrench.visible = !has.wrench; this.its.wrench.enabled = !has.wrench;
    this.views.lantern.visible = !has.lantern; this.its.lantern.enabled = !has.lantern; this.pickupGlow.intensity = has.lantern ? 0 : 2.2;
    this.views.watch.visible = !has.watch; this.its.watch.enabled = !has.watch;
    this.its.latch.enabled = !f.latch;
    this.its.release.enabled = !f.released; this.its.release.hidden = true; this.its.release.reveal = 0;
    this.its.pin.enabled = true; this.its.handle.enabled = true;
    for (const it of w.interactables) if (it.id === 'A_front') it.enabled = id === 'start';
    if (w.passengers) w.passengers.visible = !f.wrong;
    for (const z of w.zones) for (const l of z.lamps) { l.flicker = 0; l.baseFlicker = 0; l.on = true; l.target = f.wrong && z.id === 'A' ? 0.82 : 1; }
    if (f.loops === 0) w.zones[1].rhythm[4].baseFlicker = 0.85;
    // player
    const p = g.player;
    p.spawn(mk.x, mk.z, mk.yaw ?? Math.PI / 2, id === 'start' ? 'seated' : 'normal');
    if (id === 'start') { p.frozen = true; this.startBeat('intro'); }
    g.cam.yaw = Math.PI / 2; g.cam.pitch = 0.06; g.cam.inited = false; g.cam.override = null;
    g.madness.nav.dirty = true;
    this.objKey = null;
    this.setObjective(cp.objective || 'conductor');
    this.setMusic(id === 'start' ? 'M0' : id === 'cp1c' ? 'M2' : 'M1');
    if (id === 'cp1c') this._spawnPatrolC();
    this.stats.start = this.stats.start || g.t;
    g.gfx.grade.fade.value = 1; this.fadeTarget = 0;
    bus.emit('checkpoint.loaded', { id });
  }

  _spawnPatrolC(search = false) {
    const m = this.game.madness, mk = this.game.world.markers;
    m.spawn(71, -2.8, Math.PI, 'patrol', 'C'); m.patrol = mk.patrolC; m.patrolI = 3;
  }

  // --- per-tick script -----------------------------------------------------------------------------
  step(dt) {
    const g = this.game, w = g.world, p = g.player, f = this.flags, m = g.madness, mk = w.markers, x = p.pos.x;
    this.beatT += dt;
    // fade handling (fail < 0.75 s, GDD 10.6)
    const fade = g.gfx.grade.fade;
    fade.value += Math.sign(this.fadeTarget - fade.value) * Math.min(Math.abs(this.fadeTarget - fade.value), dt / 0.6);
    if (this.deadT >= 0) {
      this.deadT += dt;
      if (this.deadT > 0.55) this.fadeTarget = 1;
      if (this.deadT > 1.35) { this.load(this.cp); bus.emit('game.reloaded', {}); }
      return;
    }
    if (this.endT >= 0) { this._endSequence(dt); return; }

    // ---------------- E01: ordinary world becoming wrong -----------------------------------------
    if (this.beat === 'intro') {
      if (this.beatT > 1.4 && !f.line) { f.line = true; bus.emit('dialogue', { id: 'mitchell_line', speaker: 'Mitchell', text: 'I have to get home. I have to stop myself.', dur: 4.2 }); }
      if (this.beatT > 2.6) { p.frozen = false; this.beat = null; this.hint('Move to stand', 'move', 6); }
    }
    if (!f.stood && p.state === 'normal') { f.stood = true; this.hint('Look around with the mouse', null, 4); }
    if (!f.announce && x > 7.5) { f.announce = true; this.startBeat('announce'); bus.emit('dialogue', { id: 'conductor_1', speaker: 'Conductor', text: 'Next station… Harlan Junction. Next station…', dur: 4.5 }); }
    if (this.beat === 'announce') {
      // the scenery stops for two seconds while the wheels keep thundering
      g.scrollRate = this.beatT > 1.6 && this.beatT < 3.6 ? 0 : 1;
      if (this.beatT > 3.0 && !f.echo) { f.echo = true; bus.emit('dialogue', { id: 'conductor_2', speaker: 'Conductor', text: '…next station… next… station…', dur: 4.5, echo: true }); }
      if (this.beatT > 4.2) { this.beat = null; g.scrollRate = 1; }
    }
    if (!f.wrong && x > 13.0) { f.wrong = true; this.startBeat('wrong'); this.setMusic('M1'); bus.emit('world.wrong', {}); }
    if (this.beat === 'wrong') {
      const k = this.beatT;
      for (const l of w.zones[0].lamps) l.target = k < 0.12 ? 1 : k < 0.5 ? 0.02 : k < 0.62 ? 0.9 : k < 0.8 ? 0.05 : 0.82;
      if (k > 0.2 && w.passengers?.visible) w.passengers.visible = false; // gone in the dark
      if (k > 1.2) { this.beat = null; g.scrollRate = 0.25; }
    }
    if (!f.stretched && x > 20.25) { f.stretched = true; this.startBeat('stretch'); bus.emit('world.stretch', { x: 22.5, z: 0 }); g.cam.kick(0.25); }
    if (this.beat === 'stretch') { const k = Math.min(1, this.beatT / 1.9); w.stretch.k = k * k * (3 - 2 * k); if (k >= 1) this.beat = null; }
    else if (f.stretched) w.stretch.k = 1;
    if (this.cp === 'start' && x > 22.95) { this.commit('cp1'); this.setObjective('front'); }

    // ---------------- Coach B: the aisle that will not end ---------------------------------------
    if (f.loops > 0 && x > B.LOOP_AT && Math.cos(g.cam.yaw - Math.PI / 2) > 0.35 && p.state === 'normal') {
      f.loops--;
      p.pos.x -= B.LOOP_LEN; p.prev.x -= B.LOOP_LEN; g.cam.pos.x -= B.LOOP_LEN; g.cam.camera.position.x -= B.LOOP_LEN;
      bus.emit('world.loop', { left: f.loops });
      if (f.loops === 0) w.zones[1].rhythm[4].baseFlicker = 0.85;
    }
    if (w.zones[1].sidelight) w.zones[1].sidelight.pos.x = 24 + ((g.t * 1.7) % 24);
    if (!f.demo && (g.tools.has.wrench ? x > 43.55 : x > 43.9) && x < 44.1) { f.demo = true; this.startBeat('demo'); p.frozen = true; bus.emit('madness.warning', { x: 45.5, z: -0.6, far: true }); }
    if (this.beat === 'demo') {
      const pn = g.fracture.get('B_demo'), k = this.beatT;
      this.scriptThreat = { x: 45.4, z: -0.6, stage: k < 1 ? 1 : 2 };
      g.cam.override = { pos: g.cam.pos, look: _v.set(45.6, 0.2, -0.5), k: Math.min(0.55, k * 0.8) * (k > 2.6 ? Math.max(0, 1 - (k - 2.6) * 2.5) : 1) };
      if (k < 2.05) pn.press(1); if (k > 0.95 && pn.state === F.STRESSED) pn.setState(F.CRITICAL, 'madness');
      if (k > 2.05 && pn.state !== F.FAILED) { pn.fail('madness', { x: 46.7, z: -1.4 }); g.cam.kick(0.5); }
      if (k > 3.0) { this.beat = null; p.frozen = false; g.cam.override = null; this.scriptThreat = null; this.setObjective('latch'); }
    }

    // ---------------- Coach C: lantern, watch, reveal, hunt -----------------------------------------
    if (!f.inC && x > 50.7) { f.inC = true; this.setObjective('service'); this.setMusic('M1'); }
    if (!f.dropped && x > 52.0) {
      f.dropped = true; this.startBeat('drop'); bus.emit('world.luggage', { x: 56, z: 0 });
      const pn = g.fracture.get('C_bridge');
      pn.fail('luggage', { x: 56, z: 0 }, { delay: 0.72, impulse: 2.5 });
      for (const e of pn.extras) { e.vel.set(0, -1.5, 0); e.spin.set(...(e.spinInit || [1, 0, 1])); }
    }
    if (this.beat === 'drop') {
      if (this.beatT > 0.72 && !f.dropKick) { f.dropKick = true; g.cam.kick(0.6); bus.emit('world.bridge_snap', { x: 56, z: 0 }); }
      if (this.beatT > 2.5) { this.beat = null; if (!g.tools.has.watch) this.hint('The crossing is gone. Look for another way.', null, 4); }
    }
    if (!f.crossed && x > 58.35) { f.crossed = true; this.commit('cp1b'); this.setObjective('out'); }
    if (!f.revealed && x > 59.2 && f.crossed) { f.revealed = true; this.startBeat('reveal'); this._startReveal(); }
    if (this.beat === 'reveal') this._reveal(dt);
    if (!f.hintRelease && f.revealed && this.beat !== 'reveal' && x > 69.5 && !f.released) { f.hintRelease = true; this.setObjective('release'); }
    if (f.released && !f.inD && x > 75.2) {
      // the hunt ends at the coupling: shut the door on it
      f.inD = true; m.despawn(); const dr = w.doors.C_exit; dr.target = 0; dr.locked = true; dr.speed = 3;
      bus.emit('door.slam', { x: dr.x, z: 0 });
    }
    if (f.inD && this.cp !== 'cp2' && x > 76.7) { this.commit('cp2'); this.setObjective('deck'); this.setMusic('M1'); }

    // ---------------- Coach D: the trap -----------------------------------------------------------
    this._trap(dt);

    // ---------------- Threshold --------------------------------------------------------------------
    if (this.won && x > mk.end.x && this.endT < 0) { this.endT = 0; p.frozen = true; bus.emit('game.ending', {}); }

    this._threatLighting(dt);
    this._musicFromThreat();
  }

  _startReveal() {
    const g = this.game, m = g.madness, mk = g.world.markers;
    m.spawn(mk.tableau.x, mk.tableau.z, -Math.PI / 2, 'scripted', 'C'); m.patrol = mk.patrolC;
    m.holdOnVoid = true;
    m.char.play('breathe_look', { fade: 0 });
    g.player.frozen = true;
    this.revealSeen = { x: g.player.pos.x, z: g.player.pos.z };
    this.setMusic('M2');
    bus.emit('madness.reveal', { x: m.pos.x, z: m.pos.z });
  }

  _reveal(dt) {
    const g = this.game, w = g.world, m = g.madness, p = g.player, k = this.beatT, pn = g.fracture.get('C_reveal'), f = this.flags;
    const look = _v.set(m.pos.x, 1.7, m.pos.z);
    if (k < 2.6) {
      // composed tableau: long enough to read the silhouette (GDD 8.3 Observe)
      g.cam.override = { pos: g.cam.pos, look, k: Math.min(0.8, k * 1.2) };
      w.zones[2].revealLamp.swing = 0.16 + Math.min(0.3, k * 0.2);
      pn.press(1); if (k > 1.1 && pn.state === F.STRESSED) pn.setState(F.CRITICAL, 'madness');
      this.scriptThreat = { x: m.pos.x, z: m.pos.z, stage: 2 };
      return;
    }
    if (!f.revealGo) {
      f.revealGo = true; p.frozen = false; this.setObjective('hide');
      this.hint('Hide behind cover, or run for the side passage', null, 4.5);
      m.char.play('stagger', { fade: 0.15, speed: 1.3 });
      pn.fail('madness', { x: m.pos.x + 0.6, z: 0 });      // the floor goes under its heel — it shares your danger
      bus.emit('madness.stumble', { x: m.pos.x, z: m.pos.z });
    }
    g.cam.override = k < 3.3 ? { pos: g.cam.pos, look, k: Math.max(0, 0.8 - (k - 2.6) * 1.2) } : null;
    this.scriptThreat = null;
    // step clear of the hole, then tear the gate open
    if (k < 3.5) { m.pos.x -= 1.3 * dt; m.yaw = -Math.PI / 2; return; }
    if (!f.revealWalk) { f.revealWalk = true; m.holdOnVoid = false; m.char.play('stalk', { fade: 0.3, speed: 1.5 }); }
    if (w.gate.target < 1) {
      const at = m.scriptMove(dt, 62.75, 0, 1.5);
      if (at) { w.gate.burst += dt; if (!f.gateSnd) { f.gateSnd = true; bus.emit('world.gate', { x: 62, z: 0 }); m.char.play('charged', { fade: 0.15, speed: 1.6 }); }
        if (w.gate.burst > 1.15) { w.gate.target = 1; w.gate.burst = 0; m.nav.dirty = true; g.cam.kick(0.4); } }
      return;
    }
    // through the gate: it either has you, or it starts looking
    m.lastKnown = { ...this.revealSeen };   // it goes to where it last saw him — not to where he hid
    m._animState = null;
    m.setState(m.canSee(p) ? 'notice' : 'search');
    this.beat = null;
  }

  _prime(it) {
    const g = this.game, w = g.world;
    if (this.trap.primed) return;
    it.enabled = false;
    this.trap.primed = true; this.trap.primeT = 0;
    w.counterweight.target = 1; w.counterweight.sway = 1;
    w.markers.pin.obj.position.z += 0.16;
    this.setObjective('lure'); this.setMusic('M4');
    bus.emit('trap.primed', { x: 85, z: -3.2 });
    this.hint('The cable on the far walkway will drop the grate.', null, 6);
  }

  _pullCable() {
    const g = this.game, w = g.world, t = this.trap, m = g.madness, gr = w.markers.grate;
    if (t.busy > 0 || t.sprung) return;
    w.markers.handle.obj.position.y = w.markers.handle.y0 - 0.22;
    if (!t.primed) { t.busy = 1.2; bus.emit('trap.locked', {}); this.hint('It will not move. A pin still holds the grate.', null, 4.5); return; }
    const on = m.active && m.state !== 'fall' && m.pos.x > gr.x0 + 0.15 && m.pos.x < gr.x1 - 0.15 && Math.abs(m.pos.z) < gr.z1;
    if (on) {
      t.sprung = true;
      w.counterweight.target = 2;
      g.fracture.get('D_grate').fail('trap', { x: m.pos.x, z: m.pos.z }, { impulse: 3 });
      m.nav.dirty = true;
      this.setMusic('M5'); g.cam.kick(1);
      bus.emit('trap.triggered', { x: gr.cx, z: 0 });
    } else {
      // premature or missed: the handle springs back and the trap stays armed (GDD 10.5 safeguard)
      t.busy = 5;
      bus.emit('trap.reset', { x: w.markers.handle.x, z: w.markers.handle.z });
    }
  }

  _trap(dt) {
    const g = this.game, w = g.world, t = this.trap, m = g.madness, p = g.player, gr = w.markers.grate;
    if (t.busy > 0) { t.busy -= dt; if (t.busy <= 0) { w.markers.handle.obj.position.y = w.markers.handle.y0; if (t.primed && !t.sprung) bus.emit('trap.rearmed', {}); } }
    if (!t.primed || t.sprung) { w.tension.mat.emissiveIntensity += (0 - w.tension.mat.emissiveIntensity) * Math.min(1, dt * 3); return; }
    t.primeT += dt;
    // the noise brings it: it arrives through the door Mitchell came in by
    // (when Mitchell reaches the cable walkway — or if he lingers too long on the deck)
    const atCable = p.pos.z > 3.6 && p.pos.x < 85.8;
    if (!t.knock && t.primeT > 1.6) { t.knock = true; bus.emit('madness.approach', { x: 76.5, z: 0 }); }
    if (!m.active && !t.spawned && t.primeT > 1.8 && (atCable || t.primeT > 14)) {
      t.spawned = true;
      m.spawn(w.markers.madnessEntry.x, 0, Math.PI / 2, 'hunt', 'D'); m.patrol = w.markers.patrolD; m.relentless = true; m.lastKnown = { x: p.pos.x, z: p.pos.z };
      bus.emit('madness.enter', { x: m.pos.x, z: 0 });
    }
    const on = m.active && m.pos.x > gr.x0 && m.pos.x < gr.x1 && Math.abs(m.pos.z) < gr.z1;
    const pn = g.fracture.get('D_grate');
    if (on) { pn.press(1); if (pn.state === F.STRESSED && pn.t > 0.35) pn.setState(F.CRITICAL, 'madness'); }
    const want = on ? 3.5 + Math.sin(g.t * 16) * 1.2 : 0.6;
    w.tension.mat.emissiveIntensity += (want - w.tension.mat.emissiveIntensity) * Math.min(1, dt * 8);
    if (on !== t.on) { t.on = on; bus.emit(on ? 'trap.loaded' : 'trap.unloaded', { x: gr.cx, z: 0 }); }
  }

  /** Where the hunter heads while Mitchell is somewhere it cannot follow: it circles to the other mouth. */
  huntGoal(m, p) {
    const c = this.game.world.markers.crawl;
    if (m.zone !== 'D' || p.pos.x < c.x0 - 0.1 || p.pos.x > c.x1 + 0.1 || p.pos.z < c.z0) return null;
    if (this._crawlSide === undefined || Math.hypot(m.pos.x - this._crawlGoal.x, m.pos.z - this._crawlGoal.z) < 0.8) {
      this._crawlSide = m.pos.x > 81 ? 'west' : 'east';
      this._crawlGoal = this._crawlSide === 'west' ? { x: 78.9, z: 4.5 } : { x: 82.75, z: 4.4 };
    }
    return this._crawlGoal;
  }

  _onMadnessFell() {
    if (!this.trap.sprung || this.game.player.state === 'dead') return;  // T02: a dead player never wins
    this.won = true;
    const w = this.game.world, d = w.doors.D_exit;
    d.locked = false; d.target = 1;
    for (const pn of this.game.fracture.panels) if (pn.state === F.STRESSED || pn.state === F.CRITICAL) pn.setState(F.STABLE, 'calm');
    this.setObjective('leave'); this.commit('cp2');
    bus.emit('game.victory', { x: d.x, z: 0 });
  }

  _onMadnessState({ state, prev }) {
    const f = this.flags;
    if (state === 'notice') bus.emit('madness.warning', { x: this.game.madness.pos.x, z: this.game.madness.pos.z });
    if (state === 'windup') bus.emit('madness.charge', { x: this.game.madness.pos.x, z: this.game.madness.pos.z });
    if (state === 'patrol' && f.revealed && !f.released && this.objKey === 'hide') this.setObjective('out');
    if (state === 'patrol' && f.revealed && this.cp === 'cp1b' && this.beat !== 'reveal' && this.game.player.alive && !this.game.player.damaged && this.game.player.pos.x < 62) this.commit('cp1c');
  }

  _endSequence(dt) {
    const g = this.game;
    this.endT += dt;
    // one breath of quiet, then the camera leans out over the station (GDD 3.4)
    const k = Math.min(1, this.endT / 6);
    g.cam.override = { pos: _v2.set(96.5 + k * 1.6, 1.9 + k * 0.5, 1.4 - k * 1.2), look: _v.set(125, -4 + k * 2, -8), k: Math.min(1, this.endT * 0.6) };
    if (this.endT > 6.4 && !this.flags.ended) { this.flags.ended = true; Director.clearSave(); bus.emit('game.end', { time: g.t - this.stats.start, deaths: this.stats.deaths, watchUses: this.stats.watchUses }); }
  }

  /** L1 instability → L2 smear → L3 lamps pop as fractures reach F2 (GDD 13.5). Seeded by lamp. */
  _threatLighting(dt) {
    const g = this.game, m = g.madness, z = g.world.active;
    if (!z) return;
    let sx = null, sz = 0, stage = 0;
    if (this.scriptThreat) ({ x: sx, z: sz, stage } = this.scriptThreat);
    else if (m.active) { sx = m.pos.x; sz = m.pos.z; stage = m.stage; }
    this.keyLevel = 1;
    for (const zn of g.world.zones) for (const l of zn.lamps) {
      if (l.kind !== 'ceiling' && l.kind !== 'hang') continue;
      let want = l.baseFlicker || 0;
      if (sx !== null && stage > 0 && zn === z) {
        const d = Math.hypot(l.pos.x - sx, l.pos.z - sz);
        const near = Math.max(0, 1 - d / 11);
        want = Math.max(want, [0, 0.12, 0.32, 0.8][stage] * (0.35 + 0.65 * near));
      }
      l.flicker += (want - l.flicker) * Math.min(1, dt * (want > l.flicker ? 6 : 0.7)); // calm returns slowly
    }
    if (sx !== null && stage >= 3) this.keyLevel = 0.72;
  }

  _musicFromThreat() {
    const m = this.game.madness;
    if (this.won || this.trap.sprung || this.beat === 'reveal') return;
    if (!m.active) { if (this.music === 'M2' || this.music === 'M3') this.setMusic(this.trap.primed ? 'M4' : 'M1'); return; }
    if (m.dangerous) this.setMusic('M3');
    else if (this.trap.primed) this.setMusic('M4');
    else if (this.music === 'M3' && (m.state === 'look' || m.state === 'search' || m.state === 'patrol') && m.stateT > 2.5) this.setMusic('M2');
    else if (this.music !== 'M3') this.setMusic('M2');
  }
}
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3();
