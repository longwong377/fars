import { test, expect } from '@playwright/test';
// §13.8 walkthrough bot for the Phase 3 slice: every walkable area on the route (plain → Grand Stair N half → top landing →
// Gate of All Nations W, E and S doors → forecourt → Apadana N stair → portico → hall → W and E doors → back → Grand Stair
// S half → plain). The route between targets comes from the walkable grid (avoiding people standing still); the player
// walks it with the normal controller at walking pace, people live around it. Fails on page errors, falls > 0.6 m,
// stuck legs (after 2 re-plans) and people popping in within 50 m in view.
import { SLICE, BEYOND } from './lib/routes';
const TARGETS = SLICE.targets;
test('walkthrough bot: the whole Phase 3 slice on foot', async ({ page }, info) => {
  test.skip(info.project.name !== 'webgpu', 'physics/nav are backend-independent');
  test.setTimeout(1_800_000);
  const errs: string[] = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto(`/?test&quality=test&day=25&hour=${process.env.HOUR ?? 9.5}`);
  await page.waitForFunction(() => (window as any).__parsa?.ready === true, null, { timeout: 300_000 });
  await page.evaluate(() => { const w = (window as any).__parsa; w.walkMode(); w.teleport(-175, 122.45); w.simulate(1, 1 / 60); w.resetFalls(); });
  const legs: any[] = []; let pos: [number, number] = [-175, 122.45]; let totalT = 0;
  for (const [e, n, what] of TARGETS) {
    let ok = false, tries = 0, last: any = null;
    while (!ok && tries < 3) {
      tries++;
      const path: [number, number][] | null = await page.evaluate(([a, b]) => (window as any).__parsa.navPath(a, b), [pos, [e, n]]);
      expect(path, `no walkable route to ${what}`).not.toBeNull();
      ok = true;
      for (const [we, wn] of path!.slice(1)) {
        last = await page.evaluate(([we, wn]) => (window as any).__parsa.walkTo(we, wn, 240, 0.5, 1 / 30), [we, wn]);
        totalT += last.t; pos = [last.state.x, -last.state.z];
        if (!last.reached) { ok = false; break; }
      }
    }
    legs.push({ what, ok, tries, e: +pos[0].toFixed(1), n: +pos[1].toFixed(1), y: +last.state.feetY.toFixed(2), maxFall: +last.state.maxFall.toFixed(2) });
    if (!ok) break;
  }
  const popins = await page.evaluate(() => (window as any).__parsa.popins);
  console.log(JSON.stringify(legs)); console.log(`walked ${(totalT / 60).toFixed(1)} min of game time; pop-ins ${JSON.stringify(popins)}; errors ${errs.length}`);
  for (const l of legs) expect(l.ok, `leg: ${l.what}`).toBe(true);
  expect(legs.length).toBe(TARGETS.length);
  expect(legs[legs.length - 1].maxFall).toBeLessThan(0.6);
  expect(legs.find(l => l.what === 'hall centre')!.y).toBeCloseTo(3, 1);
  expect(popins).toEqual([]);
  expect(errs).toEqual([]);
});

// H workstream (audit D M1, M2): a town lane into a house court, the fields and Kuh-e Rahmat across the old collider seam,
// on foot with the population drawn and solid (people and animals within reach: src/world/solids.ts). Fails on page
// errors, a waypoint not reached, feet more than 0.3 m under the drawn ground, the safety net firing (a collider bug), or
// people popping in within 50 m in view. One page load for the three routes.
test('walkthrough bot: town lane into a house court, the fields, Kuh-e Rahmat across the old collider seam', async ({ page }, info) => {
  test.skip(info.project.name !== 'webgpu', 'physics/nav are backend-independent');
  test.setTimeout(3_000_000);
  const errs: string[] = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto(`/?test&quality=test&day=25&hour=${process.env.HOUR ?? 10}`);
  await page.waitForFunction(() => (window as any).__parsa?.ready === true, null, { timeout: 600_000 });
  const out: any[] = [];
  for (const [name, R] of Object.entries(BEYOND)) {
    await page.evaluate(([e, n]) => { const w = (window as any).__parsa; w.walkMode(); w.teleport(e, n); w.simulate(1, 1 / 60); w.resetFalls(); }, R.start);
    for (const [e, n, what] of R.targets) {
      const r = await page.evaluate(([e, n]) => (window as any).__parsa.walkTo(e, n, 240, 0.5, 1 / 30), [e, n]);
      const st = r.state; out.push({ route: name, what, reached: r.reached, stuck: r.stuck, t: +r.t.toFixed(1), e: +st.x.toFixed(1), n: +(-st.z).toFixed(1), feetVsGround: +(st.feetY - st.ground).toFixed(2), maxFall: +st.maxFall.toFixed(2), rescues: st.rescues, colliders: st.terrainColliders });
      if (!r.reached) break;
    }
  }
  const solid = await page.evaluate(() => (window as any).__parsa.world.summary().match(/solid near the player[^·]*/)?.[0] ?? null);
  const popins = await page.evaluate(() => (window as any).__parsa.popins);
  console.log(JSON.stringify(out)); console.log(`solids: ${solid}; pop-ins ${JSON.stringify(popins)}; errors ${errs.length}`);
  for (const o of out) { expect(o.reached, `${o.route}: ${o.what}`).toBe(true); expect(o.feetVsGround, `${o.route}: ${o.what}: feet under the drawn ground`).toBeGreaterThan(-0.3); expect(o.rescues, 'the safety net fired').toBe(0); }
  expect(out.length).toBe(Object.values(BEYOND).reduce((a, r) => a + r.targets.length, 0));
  expect(popins).toEqual([]);
  expect(errs).toEqual([]);
});
