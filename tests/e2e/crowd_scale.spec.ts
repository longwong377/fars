import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
// The whole population drawn (D-143): the busiest scenes with the population view and impostors, measured. Every
// backend draw is counted (people's by pass), with the people shown and hidden in the same frame state; the crowd's own
// counts give the people in view per band (full / mid / far / farthest skinned, impostors by distance) and the CPU cost
// of the view and the pool. Two page loads (the queue's limit): day 25 (a working day: the Terrace forecourt and the
// Hall of 100 Columns site in the morning, a town lane at midday, the approach road at dawn), then day 0 with the court
// setting (?court=seasonal: the "court in full assembly" moment; D-003). Q=high by default (the budget); Q=test to iterate.
// ONLY=a,b picks scenes. Screenshots → shots/crowd-*.png; numbers → shots/crowd-scale.json.
const az = (gridDeg: number) => gridDeg - 19; // grid heading → true azimuth (view() takes true azimuths)
interface Scene { n: string; hour: number; v: [number, number, number, number, number]; note: string }
// Views chosen by the node scan of the sightlines (sightline.ts, tests/popview.test.ts): the named scenes of the brief at
// the view with the most people visible, and the hillside above the Terrace, where the most are (Kuh-e Rahmat's slope,
// 24-28°, walkable: the player climbs 42°).
const DAY25: Scene[] = [
  { n: 'hall-site-working-morning', hour: 10, v: [144, -12, 1.6, az(180), -3], note: 'inside the Hall of 100 Columns building site, among the workers, looking S across it: a working morning (day 25, 10:00)' },
  { n: 'terrace-from-hillside', hour: 10, v: [290, -20, 1.6, az(270), -8], note: 'the Terrace working morning from the hillside above it (26 m above the court), W over the hall site, the Terrace, the town and the plain (day 25, 10:00)' },
  { n: 'forecourt-morning', hour: 10, v: [20, 80, 1.6, az(135), -2], note: 'the Apadana forecourt, looking SE toward the Hall of 100 Columns site (day 25, 10:00)' },
  { n: 'town-lane-midday', hour: 12.2, v: [-422, -941, 1.6, az(28), 0], note: 'the main street of the lower town quarter q_s1, looking up the road toward the Terrace (day 25, 12:12)' },
  { n: 'approach-dawn', hour: 5.4, v: [-36.4, 122.45, 1.6, az(250), -3], note: 'the approach road and the plain W from the Grand Stair top at dawn, people going up to work (day 25, 05:24)' },
];
const COURT: Scene[] = [
  { n: 'court-forecourt', hour: 10, v: [20, 80, 1.6, az(135), -2], note: 'court setting, day 0 10:00 (the court in residence, D-003): the Apadana forecourt' },
  { n: 'court-from-hillside', hour: 10, v: [290, -20, 1.6, az(270), -8], note: 'court setting, day 0 10:00: the Terrace from the hillside above it' },
];
test('crowd scale: the population drawn, measured', async ({ page }, info) => {
  test.setTimeout(+(process.env.TIMEOUT ?? 1700) * 1000);
  const errs: string[] = []; page.on('pageerror', e => errs.push(String(e))); page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
  const q = process.env.Q ?? 'high', only = process.env.ONLY?.split(','), out: Record<string, any> = {};
  const f = 'shots/crowd-scale.json'; mkdirSync('shots', { recursive: true }); const all = existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : {};
  const counting = async () => page.evaluate(() => { const w = window as any, b = w.__parsa.renderer.backend; if (w.__dc) return;
    w.__dc = { total: 0, people: 0, view: 0, shadow: 0, tris: 0, byName: {} as Record<string, number> };
    const inPeople = (o: any) => { for (let x = o; x; x = x.parent) if (x.name === 'people') return true; return false; };
    const d = b.draw.bind(b); b.draw = (ro: any, ...a: any[]) => { if (ro.getDrawParameters?.() === null) return d(ro, ...a); const c = w.__dc; c.total++;
      if (inPeople(ro.object)) { c.people++; if (ro.camera?.isPerspectiveCamera) c.view++; else c.shadow++; const n = `${ro.object.name}${ro.camera?.isPerspectiveCamera ? '' : ' (shadow)'}`; c.byName[n] = (c.byName[n] ?? 0) + 1; }
      return d(ro, ...a); }; });
  const frame = async (people: boolean) => {
    await page.evaluate(p => { (window as any).__parsa.world.people.crowd.group.visible = p; }, people);
    await page.evaluate(() => { const w = window as any; w.__dc.total = w.__dc.people = w.__dc.view = w.__dc.shadow = 0; w.__dc.byName = {}; });
    await page.evaluate(() => (window as any).__parsa.renderOnce());
    return page.evaluate(() => { const w = window as any, s = w.__parsa.stats(); return { draws: w.__dc.total, drawCalls: s.drawCalls, triangles: s.triangles, people: { view: w.__dc.view, shadow: w.__dc.shadow, byName: w.__dc.byName } }; });
  };
  const measure = async (s: Scene) => {
    await page.evaluate(v => (window as any).__parsa.view(...v), s.v);
    // the view placed at once for a frozen test frame (a playing frame spreads this over frames: popview.ts budgets)
    const settle = await page.evaluate(v => { const w = window as any, P = w.__parsa.world.people; P.crowd.looksPerFrame = 1e9; const t0 = performance.now(); P.view.settle(P.sim.t, [v[0], v[1]]); P.crowd.resetPopinProbe(); return { ms: performance.now() - t0, stats: { ...P.view.stats }, popins0: P.crowd.impPerf.popins }; }, s.v);
    for (let i = 0; i < 3; i++) await page.evaluate(() => (window as any).__parsa.renderOnce()); // pipelines, shadows, impostor looks
    const withP = await frame(true), without = await frame(false); await page.evaluate(() => { (window as any).__parsa.world.people.crowd.group.visible = true; });
    await page.evaluate(() => (window as any).__parsa.renderOnce());
    await page.screenshot({ path: `shots/crowd-${s.n}-${q}-${info.project.name}.png` });
    // who of the people drawn can be seen: chest or head in front of the depth of the same frame without people
    const visible = await page.evaluate(async () => { const w = window as any; return w.__parsa.world.people.probe(w.__parsa.renderer); });
    const h = await page.evaluate(() => { const w = window as any, P = w.__parsa.world.people, st = P.crowd.stats(); return { byLod: st.byLod, people: st.people, impostors: st.impostors, draws: st.draws, triangles: st.triangles, shadowDraws: st.shadowDraws, shadowTriangles: st.shadowTriangles, placeholderActs: st.placeholderActs, props: st.props, propTriangles: st.propTriangles, propsDropped: st.propsDropped, things: st.things, animals: st.animals, perf: st.perf, impPerf: st.impPerf, view: st.view, attached: P.crowd.persons.size, clock: w.__parsa.clockLabel(), popins: (w.__parsa.popins ?? []).slice(-6) }; });
    const r = { scene: s.n, note: s.note, quality: q, project: info.project.name, clock: h.clock, inView: h.people + h.impostors, skinnedByLod: h.byLod, impostors: h.impostors, impostorBands: h.impPerf.bands, impostorWalking: h.impPerf.walking,
      frame: { withPeople: withP, withoutPeople: without, peopleDraws: withP.draws - without.draws, peopleTriangles: withP.triangles - without.triangles },
      visible,
      crowd: { draws: h.draws, triangles: h.triangles, shadowDraws: h.shadowDraws, shadowTriangles: h.shadowTriangles, attached: h.attached, placeholderActs: h.placeholderActs, placeholderImpostors: h.impPerf.placeholders, props: h.props, propTriangles: h.propTriangles, propsDropped: h.propsDropped, workObjects: { n: h.things.instances, draws: h.things.draws, triangles: h.things.triangles }, animals: { n: h.animals.instances, draws: h.animals.draws, triangles: h.animals.triangles }, poseMs: h.perf.ms, feedMs: h.impPerf.feedMs, impMs: h.impPerf.impMs, popins: h.impPerf.popins - settle.popins0, popinList: h.popins },
      view: h.view, settleMs: settle.ms };
    console.log(`crowd ${s.n} [${q}/${info.project.name}]`, JSON.stringify(r));
    out[s.n] = r; all[`${s.n}|${q}|${info.project.name}`] = r; writeFileSync(f, JSON.stringify(all, null, 1));
  };
  const load = async (day: number, hour: number, court: boolean) => {
    await page.goto(`/?test&quality=${q}&day=${day}&hour=${hour}&weather=clear${court ? '&court=seasonal' : ''}`);
    await page.waitForFunction(() => (window as any).__parsa?.ready === true || (window as any).__parsa?.error, null, { timeout: 900_000 });
    await page.evaluate(() => (window as any).__parsa.renderer.setAnimationLoop(null)); await counting();
  };
  const day25 = DAY25.filter(s => !only || only.includes(s.n)), court = COURT.filter(s => !only || only.includes(s.n));
  if (day25.length) { await load(25, day25[0].hour, false);
    for (const s of day25) { await page.evaluate(h => (window as any).__parsa.setTime(25, h), s.hour); await page.evaluate(() => (window as any).__parsa.renderOnce()); await measure(s); } }
  if (court.length) { await load(0, court[0].hour, true); for (const s of court) await measure(s); }
  console.log(errs.slice(0, 10).join('\n'));
  expect(errs).toEqual([]);
  for (const r of Object.values(out)) expect((r as any).inView, `${(r as any).scene}: people in view`).toBeGreaterThan(0);
});
