// Exact high-risk edge cases from GDD 22.3, run against the real simulation.
import { F, FR } from '../game/fracture.js';
import { makeBot } from './bot.js';

export function edgeCases(dg) {
  const g = dg.game, p = g.player, fr = g.fracture, d = g.director, m = g.madness, t = g.tools, b = makeBot(dg);
  const out = [];
  const test = (id, name, fn) => { try { const r = fn(); out.push({ id, name, pass: r === true, note: r === true ? '' : String(r) }); } catch (e) { out.push({ id, name, pass: false, note: 'threw: ' + e.message }); } };
  const load = (cp) => { dg.app.begin(cp, true); dg.step(80); };

  test('W01', 'Rewind a panel while Mitchell stands on its boundary: no void, no penetration', () => {
    load('cp1b'); m.despawn(); d.flags.revealed = true;
    const pn = fr.get('C_bridge');
    b.walk(58.25, 0, { tol: 0.08 }); // heels on the far lip of the gap
    b.face(56, 0); b.press('watch');
    let minY = 1e9, fell = false;
    for (let i = 0; i < 700; i++) { dg.step(1); minY = Math.min(minY, p.pos.y); if (!p.alive) fell = true; }
    return !fell && minY > -0.02 && pn.state === F.FAILED ? true : `fell=${fell} minY=${minY.toFixed(3)} state=${pn.state}`;
  });

  test('W02', 'Watch near Madness, then actor leaves the radius mid-replay: deterministic exit', () => {
    load('cp1c'); m.despawn(); dg.tp(59.8, -0.6); dg.step(4);
    m.spawn(62.9, -0.6, Math.PI / 2, 'patrol', 'C'); m.patrol = [];   // standing with its back to Mitchell, inside the field of the nearest eligible panel
    dg.step(90);
    if (m.state !== 'patrol') return 'setup: hunter noticed the player (' + m.state + ')';
    b.face(62.9, -0.6); dg.step(2); b.press('watch'); dg.step(28);
    const caught = m.state === 'rewound';
    b.walk(58.6, -2.5, { sprint: true });                              // move off while it replays
    dg.step(400);
    return caught && m.active && Number.isFinite(m.pos.x) && m.state !== 'rewound' && p.alive ? true : `caught=${caught} state=${m.state}`;
  });

  test('W03', 'Press Q with 0.01 s of cooldown left, twice in one tick: no double cast', () => {
    load('cp1b'); m.despawn(); d.flags.revealed = true;
    dg.tp(53.6, 0); b.face(56, 0); dg.step(2);
    let casts = 0; const off = dg.bus.on('watch.cast', () => casts++);
    t.watchCd = 0.01; dg.press('watch'); dg.step(1);            // still cooling: denied
    dg.press('watch'); dg.press('watch'); dg.step(1);            // ready now: exactly one
    dg.press('watch'); dg.step(1); dg.press('watch'); dg.step(40); // mid-cast and on cooldown: ignored
    off();
    return casts === 1 && t.watchCd > 0 ? true : `casts=${casts} cd=${t.watchCd}`;
  });

  test('F01', 'Destroy the same panel five times across checkpoints: pieces reset every time', () => {
    for (let i = 0; i < 5; i++) {
      load('cp1b'); m.despawn(); d.flags.revealed = true;
      const pn = fr.get('C_exit');
      if (pn.state !== F.STABLE || !pn.floor.enabled) return `run ${i}: not reset (state ${pn.state})`;
      if (pn.pieces.some((q) => q.pos.distanceTo(q.home) > 1e-6)) return `run ${i}: pieces not home`;
      pn.fail('script'); dg.step(260);
      if (pn.state !== F.FAILED || pn.floor.enabled || pn.replay) return `run ${i}: did not fail cleanly`;
    }
    return true;
  });

  test('A01', 'Monster sees the player through an opening it cannot path through: recovers, never wall-clips', () => {
    load('cp2'); dg.step(10);
    d._prime(d.its.pin); dg.tp(80.8, 4.55); dg.step(130);       // Mitchell inside the crawl gap
    if (!m.active) { m.spawn(77.3, 0, Math.PI / 2, 'hunt', 'D'); m.patrol = dg.world.markers.patrolD; m.relentless = true; }
    const c = dg.world.markers.crawl; let clipped = false, hits = 0;
    const off = dg.bus.on('player.hurt', () => hits++);
    for (let i = 0; i < 1500; i++) { dg.step(1); if (m.active && m.pos.x > c.x0 + 0.1 && m.pos.x < c.x1 - 0.1 && m.pos.z > c.z0 + 0.1) clipped = true; }
    off();
    return !clipped && hits === 0 && p.alive ? true : `clipped=${clipped} hits=${hits}`;
  });

  test('A02', 'Enemy delayed outside the trap while the player primes and leaves: still completable', () => {
    load('cp2'); dg.step(10);
    d._prime(d.its.pin); dg.tp(78.2, -2); dg.step(60 * 15);      // linger far from the cable for 15 s
    if (!m.active) return 'hunter never arrived';
    dg.tp(80.8, 4.55); dg.step(5);
    const onGrate = () => m.active && m.pos.x > 82.3 && m.pos.x < 85.7 && Math.abs(m.pos.z) < 1.5;
    if (!b.until(() => onGrate() && d.trap.busy <= 0, 3000, 'grate')) return 'hunter never crossed the grate again';
    dg.tp(83.2, 4.4); d._pullCable(); dg.step(300);
    return d.won ? true : 'no victory';
  });

  test('T01', 'Trigger release before the monster reaches the grate: trap stays armed and reusable', () => {
    load('cp2'); dg.step(10);
    d._prime(d.its.pin); d.trap.spawned = true;                  // keep the hunter out of this one
    dg.tp(83.2, 4.4); dg.step(4);
    d._pullCable();
    if (d.trap.sprung || !d.trap.primed || fr.get('D_grate').state === F.FAILED) return 'trap consumed';
    dg.step(310);
    if (d.trap.busy > 0) return 'did not re-arm in 5 s';
    d._pullCable(); dg.step(310); d._pullCable();              // spam: still safe
    return d.trap.primed && !d.trap.sprung ? true : 'state corrupted by repeated pulls';
  });

  test('T02', 'Monster falls while the player is hit: resolution is deterministic', () => {
    load('cp2'); dg.step(10);
    d._prime(d.its.pin); dg.tp(83.2, 4.4); dg.step(150);
    const onGrate = () => m.active && m.pos.x > 82.6 && m.pos.x < 85.4 && Math.abs(m.pos.z) < 1.5;
    if (!b.until(onGrate, 900, 'grate')) return 'hunter never on grate';
    d._pullCable();
    p.hit(m.pos.x, m.pos.z);                                     // knocked down the same tick it drops
    dg.step(400);
    if (!(d.won && p.alive)) return `knockdown case: won=${d.won} alive=${p.alive}`;
    // …and the lethal variant: a dead player never wins
    load('cp2'); dg.step(10);
    d._prime(d.its.pin); dg.tp(83.2, 4.4); dg.step(150);
    if (!b.until(onGrate, 900, 'grate')) return 'hunter never on grate (2)';
    d._pullCable(); p.damaged = true; p.invuln = 0; p.hit(m.pos.x, m.pos.z);
    let reloaded = false; const off = dg.bus.on('game.reloaded', () => (reloaded = true));
    dg.step(400); off();
    return reloaded && !d.won && d.cp === 'cp2' && fr.get('D_grate').state === F.STABLE ? true : `lethal case: reloaded=${reloaded} won=${d.won}`;
  });

  test('B02', 'Change graphics preset during the collapse: no missing collision or materials', () => {
    load('cp2'); dg.step(10);
    d._prime(d.its.pin); dg.tp(83.2, 4.4); dg.step(150);
    const onGrate = () => m.active && m.pos.x > 82.6 && m.pos.x < 85.4 && Math.abs(m.pos.z) < 1.5;
    if (!b.until(onGrate, 900, 'grate')) return 'hunter never on grate';
    d._pullCable(); dg.step(10);
    for (const pr of ['low', 'high', 'balanced', 'low']) { dg.gfx.setProfile(pr); dg.step(12); dg.render(1); }
    dg.step(300);
    const pn = fr.get('D_grate');
    return d.won && !pn.floor.enabled && pn.pieces.every((q) => q.mesh.material === pn.material) && g.col.floorY(84, 0) === null && g.col.floorY(84, 4.4) === 0 ? true : 'state mismatch after preset changes';
  });

  test('B03', 'Repeat the trap five times without a refresh: no listener or audio multiplication', () => {
    const count = () => [...dg.bus.map.values()].reduce((a, s) => a + s.size, 0);
    const before = count(); let fired = 0; const off = dg.bus.on('trap.triggered', () => fired++);
    for (let i = 0; i < 5; i++) {
      load('cp2'); dg.step(10); d._prime(d.its.pin); dg.tp(83.2, 4.4); dg.step(150);
      const onGrate = () => m.active && m.pos.x > 82.6 && m.pos.x < 85.4 && Math.abs(m.pos.z) < 1.5;
      if (!b.until(onGrate, 900, 'grate')) return `run ${i}: hunter never on grate`;
      d._pullCable(); dg.step(260);
      if (!d.won) return `run ${i}: no victory`;
    }
    off();
    return fired === 5 && count() === before ? true : `fired=${fired} listeners ${before}→${count()}`;
  });

  test('CP', 'Death and fall reload the right checkpoint with tools and a legal world state', () => {
    load('cp1c'); dg.step(10);
    const pn = fr.get('C_exit'); dg.tp(73, 0); dg.step(2); pn.fail('script'); dg.step(140);
    if (!(d.cp === 'cp1c' && p.alive && p.pos.x < 60 && t.has.watch && pn.state <= F.STRESSED && pn.floor.enabled && m.active)) return `after fall: cp=${d.cp} x=${p.pos.x.toFixed(1)} panel=${pn.state}`;
    p.damaged = true; p.invuln = 0; p.hit(0, 0); dg.step(140);
    return d.cp === 'cp1c' && p.alive && !p.damaged ? true : 'after death: bad state';
  });

  test('FR', 'Fracture timings: F1→F2 1.5–2.5 s, F2→F3 0.8–1.2 s, with a warning before collapse', () => {
    load('cp1c'); m.despawn(); dg.step(5);
    fr.reset({ C_bridge: F.FAILED, C_reveal: F.FAILED });
    const pn = fr.get('C_exit'); pn.spec.fragile = false;
    let t1 = -1, t2 = -1, t3 = -1, warn = -1, n = 0;
    const o1 = dg.bus.on('fracture.warning', (e) => { if (e.panel === pn && warn < 0) warn = n; });
    for (; n < 400 && pn.state !== F.FAILED; n++) { pn.press(1); dg.step(1); if (pn.state === F.STRESSED && t1 < 0) t1 = n; if (pn.state === F.CRITICAL && t2 < 0) t2 = n; }
    t3 = n; o1(); pn.spec.fragile = true;
    const a = (t2 - t1) / 60, c = (t3 - t2) / 60, w = (t3 - warn) / 60;
    return a >= 1.5 && a <= 2.5 && c >= 0.8 && c <= 1.25 && warn > 0 && w >= 0.4 && w <= 0.6 ? true : `F1→F2 ${a.toFixed(2)}s F2→F3 ${c.toFixed(2)}s warn ${w.toFixed(2)}s before`;
  });

  test('WT', 'Watch tuning: history ≤ 4 s, restoration 4.5 s, cooldown 12 s, identical at any frame rate', () => {
    load('cp1b'); m.despawn(); d.flags.revealed = true;
    const pn = fr.get('C_bridge');
    dg.tp(53.6, 0); b.face(56, 0); dg.step(2); b.press('watch');
    let solidAt = -1, failAt = -1, n = 0;
    for (; n < 900; n++) { dg.step(1); if (pn.floor.enabled && solidAt < 0) solidAt = n; if (solidAt >= 0 && !pn.floor.enabled) { failAt = n; break; } }
    const restore = (failAt - solidAt) / 60, hist = pn.buffer.len / 60, cdLeft = t.watchCd + n / 60;
    return hist <= 4.01 && Math.abs(restore - FR.RESTORE) < 0.05 && Math.abs(cdLeft - 12) < 0.6 ? true : `hist ${hist.toFixed(2)} restore ${restore.toFixed(2)} cd ${cdLeft.toFixed(2)}`;
  });
  return out;
}
