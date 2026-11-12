// Deterministic playthrough bot for automated QA (GDD 20.3, 22). Drives real input actions through
// the fixed-tick simulation — no teleporting, no state pokes — and reports what happened.
export function makeBot(dg) {
  const g = dg.game, p = g.player, log = [];
  if (!dg._botLog) { dg._botLog = true; dg.bus.on('*', (type, e) => { if (/^(player\.dead|player\.hurt|trap\.|madness\.(falling|fell|enter|charge)|game\.|checkpoint\.)/.test(type)) (dg._sink || log).push(`    · ${type} ${JSON.stringify(e && (e.cause || e.id || e.hit) || '')} @${g.t.toFixed(2)}`); }); }
  dg._sink = log;
  const say = (m) => log.push(`[${g.t.toFixed(1)}s x=${p.pos.x.toFixed(1)} z=${p.pos.z.toFixed(1)}] ${m}`);
  const step = (n = 1) => dg.step(n);
  const face = (x, z) => { g.cam.yaw = Math.atan2(x - p.pos.x, z - p.pos.z); };
  const release = () => { for (const a of ['forward', 'sprint', 'lantern']) dg.hold(a, false); };
  const until = (cond, max = 600, label = '') => { for (let i = 0; i < max; i++) { if (cond()) return true; step(1); } say('TIMEOUT ' + label); return false; };
  const bot = {
    log, say, step, face, until,
    wait(n) { release(); step(n); },
    press(a, wait = 2) { dg.press(a); step(wait); },
    /** Walk in a straight line to a point using camera-relative input. */
    walk(x, z, { sprint = false, tol = 0.22, max = 900, stopIf = null } = {}) {
      let stuck = 0, lx = p.pos.x, lz = p.pos.z;
      for (let i = 0; i < max; i++) {
        if (!p.alive) { release(); say('died en route'); return false; }
        if (stopIf && stopIf()) { release(); return true; }
        const d = Math.hypot(x - p.pos.x, z - p.pos.z);
        if (d < tol) { release(); step(4); return true; }
        if (p.controllable) { face(x, z); dg.hold('forward'); dg.hold('sprint', sprint); }
        step(1);
        if (i % 30 === 29) { if (p.controllable && Math.hypot(p.pos.x - lx, p.pos.z - lz) < 0.05) { if (++stuck >= 3) { release(); say(`STUCK heading to ${x},${z}`); return false; } } else stuck = 0; lx = p.pos.x; lz = p.pos.z; }
      }
      release(); say(`walk timeout to ${x},${z}`); return false;
    },
    route(pts, o) { for (const [x, z] of pts) if (!bot.walk(x, z, o)) return false; return true; },
    state: () => dg.state(),
  };
  return bot;
}

/** Full intended critical path. Returns { ok, log, state }. */
export function fullRun(dg, { from = 'start' } = {}) {
  const b = makeBot(dg), g = dg.game, p = g.player, fr = g.fracture, d = g.director, m = g.madness;
  const need = (ok, what) => { if (!ok) { b.say('FAIL: ' + what); throw new Error(what); } b.say('ok: ' + what); };
  try {
    if (from === 'start') {
      b.wait(170);
      dg.hold('forward'); b.step(6); dg.hold('forward', false);
      need(b.until(() => p.state === 'normal', 240, 'stand'), 'stood up from the seat');
      b.walk(19.55, 0);
      need(d.flags.wrong && d.flags.announce, 'Coach A beats fired');
      b.press('interact'); b.wait(50);
      need(g.world.doors.A_front.open > 0.6, 'front door opened with E');
      b.walk(21.3, 0); b.walk(23.6, 0);
      need(d.cp === 'cp1' && g.world.stretch.k > 0.5, 'checkpoint 1 after the stretching doorway');
    }
    if (from === 'start' || from === 'cp1') {
      b.walk(43.1, 0.6, { max: 2400 });
      need(d.flags.loops === 0, 'looping aisle consumed (3 loops)');
      b.face(43.1, 1.4); b.press('interact'); b.wait(10);
      need(g.tools.has.wrench, 'took the wrench');
      b.walk(43.75, 0.9);
      need(b.until(() => d.flags.demo && d.beat !== 'demo', 400, 'demo'), 'fracture demonstration played');
      need(fr.get('B_demo').state === 3, 'demo panel failed; safe strip remains');
      b.route([[45.5, 0.95], [47.0, 0.35], [48.0, 0.2]]);
      b.face(48.4, 0.3); b.press('wrench'); b.wait(60);
      need(d.flags.latch && g.world.doors.B_end.open > 0.6, 'latch broken with the wrench');
      b.route([[49.5, 0], [51.4, 0], [52.3, 0.4]]);
      need(d.flags.dropped, 'luggage drop triggered');
      b.walk(52.75, 1.0); b.face(53.3, 1.22); b.press('interact'); b.wait(6);
      need(g.tools.has.lantern, 'took the lantern');
      b.walk(52.6, -1.3); b.face(53.1, -1.57); b.press('interact'); b.wait(6);
      need(g.tools.has.watch, 'took the watch');
      b.wait(120);
      need(fr.get('C_bridge').state === 3 && !fr.get('C_bridge').floor.enabled, 'bridge is failed and non-solid');
      b.walk(53.6, 0); b.face(56, 0); b.press('watch');
      need(b.until(() => fr.get('C_bridge').floor.enabled, 300, 'rewind'), 'watch restored the bridge (solid)');
      b.walk(58.7, 0, { sprint: true });
      need(d.cp === 'cp1b', 'crossed within the restoration window');
    }
    if (from !== 'cp2') {
      b.walk(59.4, 0);
      need(d.flags.revealed, 'reveal started');
      need(b.until(() => !p.frozen, 400, 'reveal'), 'control returned after the tableau');
      need(fr.get('C_reveal').state === 3, 'reveal panel collapsed under the hunter');
      b.route([[58.9, 3.4], [60.3, 3.62]], { sprint: true });
      b.say('hiding; madness ' + JSON.stringify(b.state().m));
      b.until(() => m.state === 'patrol' || !p.alive, 1500, 'wait for patrol');
      need(p.alive && !p.damaged, 'survived the first hunt unseen from cover');
      need(d.cp === 'cp1c', 'post-reveal autosave committed');
      // trail the patrol: enter while it walks the east corridor, keeping the cage block between us
      const eastSouthbound = () => m.state === 'patrol' && m.pos.x > 70.4 && m.pos.z < 1.6 && m.pos.z > -2.2;
      need(b.until(eastSouthbound, 3000, 'patrol east'), 'patrol reached the east corridor');
      b.route([[61.5, 0.4], [63.0, 1.2], [63.5, 2.7], [69.6, 2.7], [71.05, 2.7]], { sprint: false });
      need(p.alive && !p.damaged && !m.dangerous, 'reached the release unseen by trailing the patrol');
      b.face(71.8, 2.7); dg.hold('lantern');
      need(b.until(() => !d.its.release.hidden, 200, 'reveal release'), 'lantern revealed the hidden release');
      dg.hold('lantern', false); b.step(4);
      b.press('wrench'); b.wait(50);
      need(d.flags.released && g.world.doors.C_exit.open > 0.5, 'release thrown; exit door open');
      b.walk(71.7, 0.1, { sprint: true });
      b.say('exit panel state ' + fr.get('C_exit').state + ' madness ' + JSON.stringify(b.state().m));
      if (!fr.get('C_exit').floor.enabled) {
        b.face(73, 0);
        need(b.until(() => g.tools.watchReady, 800, 'watch cd'), 'watch ready');
        b.press('watch');
        need(b.until(() => fr.get('C_exit').floor.enabled || !p.alive, 300, 'rewind exit') && p.alive, 'watch restored the exit floor');
      } else b.say('exit floor still intact — crossing directly');
      b.route([[75.0, 0], [77.2, 0]], { sprint: true });
      need(d.cp === 'cp2' && !m.active, 'checkpoint 2; the hunt ended at the coupling');
    }
    // ---- Coach D ----
    b.walk(79.9, -4.4);
    b.face(82, -4.4);
    need(b.until(() => g.tools.watchReady, 900, 'watch cd'), 'watch ready for the walkway');
    b.press('watch');
    need(b.until(() => fr.get('D_walk').floor.enabled, 300, 'rewind walk'), 'watch restored the left walkway');
    b.walk(84.2, -4.4, { sprint: true });
    b.walk(85.0, -3.72);
    b.face(85, -3.2); b.press('wrench'); b.wait(70);
    need(d.trap.primed, 'release pin pulled — trap primed');
    // T01 — a premature pull must not consume the trap
    b.route([[88, -4.4], [90.4, -4.4], [90.4, 4.4], [83.25, 4.4]], { sprint: true });
    need(m.active, 'the hunter entered when Mitchell reached the cable walkway');
    b.face(83.2, 3.8); b.press('wrench'); b.wait(34);
    need(d.trap.primed && !d.trap.sprung && d.trap.busy > 0, 'premature pull did not consume the trap');
    const onGrate = () => m.active && m.pos.x > 82.3 && m.pos.x < 85.7 && Math.abs(m.pos.z) < 1.5;
    need(b.until(onGrate, 400, 'first crossing'), 'the hunter crossed the grating (missed attempt)');
    b.until(() => !onGrate(), 300);
    // escape through the crawl gap only Mitchell fits through; the hunter must go back around
    b.walk(80.7, 4.55);
    need(b.until(() => (onGrate() && d.trap.busy <= 0) || !p.alive, 1800, 'second crossing') && p.alive, 'trap re-armed and the hunter circled back over the grate');
    need(!p.damaged, 'the crawl gap kept Mitchell safe');
    b.walk(83.2, 4.4, { sprint: true, stopIf: () => !onGrate() });
    b.face(83.2, 3.8); b.press('wrench');
    need(b.until(() => d.trap.sprung, 80, 'spring'), 'cable pulled with the hunter on the grate');
    need(b.until(() => d.won, 400, 'fell'), 'the hunter fell — victory state');
    need(g.world.doors.D_exit.target === 1, 'station door unlocked');
    b.route([[89.8, 4.4], [91, 0.5], [93.2, 0], [97.6, 0]]);
    need(b.until(() => d.flags.ended, 600, 'end'), 'end sequence completed');
    return { ok: true, log: b.log, state: b.state() };
  } catch (e) {
    return { ok: false, error: String(e.message), log: b.log, state: b.state() };
  }
}
