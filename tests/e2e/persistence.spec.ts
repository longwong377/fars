import { writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { test, expect } from '@playwright/test';
// Persistence in the browser (audit D M9; H workstream). Gates, each written as evidence {id, value, n, commit, tool} to
// REVIEWS/evidence/s8-h (or $EVIDENCE_DIR: the queue runs a snapshot of the tree):
//  - T-H3: the autosave interval (real minutes) and a save on visibilitychange (hidden), written to IndexedDB;
//  - T-H3r: save -> load -> save byte differences of the whole state (people with their memory, relations, chronicle and
//    walks, the visitor, the doors, the clock, the weather, the player), and the population and visitor as they were;
//  - T-H3s: the save's size (MB) after the test's world hours (not yet 100 bot-hours: n 0);
//  - T-H3v: a save of the previous build (without this session's fields) loads; unreadable and unknown saves are announced.
const EV = process.env.EVIDENCE_DIR ?? 'REVIEWS/evidence/s8-h';
const commit = () => { if (process.env.COMMIT) return process.env.COMMIT; try { return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim(); } catch { return 'unknown'; } };
const evidence = (id: string, value: number, n: number, extra: Record<string, unknown>) => { mkdirSync(EV, { recursive: true });
  writeFileSync(`${EV}/${id}.json`, JSON.stringify({ id, value, n, commit: commit(), tool: 'tests/e2e/persistence.spec.ts', ...extra }, null, 1) + '\n'); };

test('persistence: autosave on a timer and when hidden, IndexedDB, a byte-identical round trip, older saves', async ({ page }, info) => {
  test.skip(info.project.name !== 'webgpu', 'storage is backend-independent');
  test.setTimeout(3_000_000);
  const errs: string[] = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto('/?test&quality=test&autosave&day=25&hour=10');
  await page.waitForFunction(() => (window as any).__parsa?.ready === true, null, { timeout: 600_000 });
  // --- T-H3: the interval, and a save when the page is hidden
  const a0 = await page.evaluate(() => (window as any).__parsa.autosave());
  expect(a0.intervalMs).toBeLessThanOrEqual(5 * 60_000);
  await page.evaluate(() => { const w = (window as any).__parsa; w.walkMode(); w.teleport(-40, 122.45); w.simulate(3, 1 / 30); });
  // (the count is read again just before the page is hidden: the 60 s interval save may fire while a slow box simulates;
  // session 9's first browser run counted it: 2 saves for 1)
  const hidden = await page.evaluate(async () => { const w = (window as any).__parsa, before = w.autosave().saves;
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange'));
    const a = w.autosave(), flushed = await w.saveFlushed(), stored = await w.storedSave();
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    return { a, before, flushed, storedT: stored?.clockT, nowT: w.saveState().clockT }; });
  expect(hidden.a.saves).toBe(hidden.before + 1); expect(hidden.a.last.reason).toBe('hidden'); expect(hidden.flushed, 'written to IndexedDB').toBe(true);
  expect(hidden.storedT).toBeCloseTo(hidden.nowT, 9);
  evidence('T-H3', a0.intervalMs / 60_000, 1, { unit: 'real minutes', on_hidden: true, indexeddb: hidden.flushed });
  // --- T-H3r: a state with people walking, a door moved, the visitor; save → change everything → load → save
  const before = await page.evaluate(async () => { const w = (window as any).__parsa, P = w.world.people;
    w.setDoor('harem:W', false); w.setWeather('rain'); w.teleport(-60, 110); w.simulate(20, 1 / 30);
    P.view.settle(P.sim.t, [-60, 110]); const pop = w.popSample(80), people = w.people().agents, s = w.saveState(); w.save(); await w.saveFlushed(); return { pop, people, s }; });
  await page.evaluate(() => { const w = (window as any).__parsa; w.setTime(120, 3); w.setWeather('clear'); w.setDoor('harem:W', true); w.teleport(-300, 0); w.simulate(5, 1 / 30); });
  const after = await page.evaluate(() => { const w = (window as any).__parsa, P = w.world.people; const ok = w.load(); const s = w.saveState();
    P.view.settle(P.sim.t, [-60, 110]); return { ok, s, pop: w.popSample(80), people: w.people().agents }; });
  expect(after.ok).toBe(true);
  const strip = (s: any) => JSON.stringify({ ...s, savedAt: '' }), A = strip(before.s), B = strip(after.s);
  let diff = Math.abs(A.length - B.length); for (let i = 0; i < Math.min(A.length, B.length); i++) if (A[i] !== B[i]) diff++;
  const systems = { people: !!before.s.npc?.people?.agents?.length, memory: !!before.s.npc?.people?.memory, relations: !!before.s.npc?.people?.relations, events: Array.isArray(before.s.npc?.people?.events),
    routes: Array.isArray(before.s.npc?.people?.routes), visitor: !!before.s.npc?.visitor, doors: !!before.s.doors, clock: typeof before.s.clockT === 'number', weather: !!before.s.weatherOverride, player: !!before.s.player };
  evidence('T-H3r', diff, 1, { unit: 'bytes', bytes: A.length, systems, population_sample_equal: JSON.stringify(before.pop) === JSON.stringify(after.pop), people_equal: JSON.stringify(before.people) === JSON.stringify(after.people) });
  expect(diff, 'save → load → save byte differences').toBe(0);
  for (const [k, v] of Object.entries(systems)) expect(v, `the save holds ${k}`).toBe(true);
  expect(after.people).toEqual(before.people);
  expect(after.pop, 'the population out of doors as it was').toEqual(before.pop);
  // --- T-H3s: the save's size after some world hours
  const size = await page.evaluate(async () => { const w = (window as any).__parsa; w.advanceWorld(6 * 3600, 2); w.save(); await w.saveFlushed(); return w.autosave().bytes; });
  evidence('T-H3s', +(size / 1048576).toFixed(4), 0, { unit: 'MB', bytes: size, world_hours: 6, note: 'after 6 world hours of the test, not 100 bot-hours (n 0)' });
  expect(size).toBeLessThanOrEqual(2 * 1024 * 1024);
  // --- T-H3v: the previous build's save (this session's fields removed) loads; unreadable and unknown saves are announced
  const v = await page.evaluate(() => { const w = (window as any).__parsa, cur = w.saveState(), p = cur.npc.people;
    const old = { ...cur, npc: { ...cur.npc, people: { ...p, events: undefined, routes: undefined, near: undefined, agents: p.agents.map((a: any) => { const { path, pathI, walking, gait, legs, waitRoute, loadDay, kneadKey, emptyCarry, round, roundKey, ...rest } = a; return rest; }) } } };
    const n0 = w.notices.length, okOld = w.loadRaw(JSON.stringify(old)), n1 = w.notices.length;
    const okBad = w.loadRaw('{"v":1,"seed":'), n2 = w.notices.length, okFuture = w.loadRaw(JSON.stringify({ ...cur, v: 9 })), n3 = w.notices.length;
    return { okOld, silentOld: n1 === n0, okBad, announcedBad: n2 === n1 + 1, okFuture, announcedFuture: n3 === n2 + 1 }; });
  const failedSilently = (v.okOld ? 0 : v.silentOld ? 1 : 0) + (v.okBad || v.announcedBad ? 0 : 1) + (v.okFuture || v.announcedFuture ? 0 : 1);
  evidence('T-H3v', failedSilently, 1, { unit: 'saves', previous_build_loads: v.okOld, unreadable_announced: v.announcedBad, unknown_version_announced: v.announcedFuture });
  expect(v.okOld).toBe(true); expect(v.announcedBad).toBe(true); expect(v.announcedFuture).toBe(true);
  expect(errs).toEqual([]);
});
