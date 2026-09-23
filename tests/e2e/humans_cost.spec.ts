import { test, expect } from '@playwright/test';
// The people's GPU cost at quality=high (the one final check; iterate at quality=test with QC=test): every backend draw is
// counted, and the people's by pass (view camera vs shadow cameras) and by mesh, with the people shown and hidden, same view,
// same frame state. 3 views, one frame each way (the first view warms up once): the shared queue's limits (≤ 4 views,
// < 15 min). Screenshots → shots/humans-cost-*.png.
const az = (gridDeg: number) => gridDeg - 19; // grid heading → true azimuth
// The people's cost in GPU draw commands and triangles, shadow passes included: every backend draw is counted (and the
// people's by pass: view camera vs shadow cameras), with the people shown and hidden, same view, same frame state.
// Views: the Grand Stair foot and the Apadana N court (the lead's budget views), and the 300-person forecourt load.
test('people draw cost (with and without people, shadow passes included)', async ({ page }, info) => {
  test.setTimeout(900_000);
  const errs: string[] = []; page.on('pageerror', e => errs.push(String(e))); page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
  const q = process.env.QC ?? 'high';
  await page.goto(`/?test&quality=${q}&day=0&hour=9`);
  await page.waitForFunction(() => (window as any).__parsa?.ready === true || (window as any).__parsa?.error, null, { timeout: 900_000 });
  await page.evaluate(() => { const w = window as any, b = w.__parsa.renderer.backend;
    w.__dc = { total: 0, people: 0, view: 0, shadow: 0, byName: {} as Record<string, number> };
    const inPeople = (o: any) => { for (let x = o; x; x = x.parent) if (x.name === 'people') return true; return false; };
    const d = b.draw.bind(b); b.draw = (ro: any, ...a: any[]) => { if (ro.getDrawParameters?.() === null) return d(ro, ...a); // skipped by the backend (0 instances)
      const c = w.__dc; c.total++;
      if (inPeople(ro.object)) { c.people++; if (ro.camera?.isPerspectiveCamera) c.view++; else c.shadow++; const n = `${ro.object.name}${ro.camera?.isPerspectiveCamera ? '' : ' (shadow)'}`; c.byName[n] = (c.byName[n] ?? 0) + 1; }
      return d(ro, ...a); }; });
  const frame = async (people: boolean, warm: boolean) => { // warm: one frame first (pipelines compile, shadows settle)
    await page.evaluate(p => { (window as any).__parsa.world.people.crowd.group.visible = p; }, people);
    if (warm) await page.evaluate(() => (window as any).__parsa.renderOnce());
    await page.evaluate(() => { const w = window as any; w.__dc.total = w.__dc.people = w.__dc.view = w.__dc.shadow = 0; w.__dc.byName = {}; });
    await page.evaluate(() => (window as any).__parsa.renderOnce());
    return page.evaluate(() => { const w = window as any, s = w.__parsa.stats(); return { draws: w.__dc.total, drawCalls: s.drawCalls, triangles: s.triangles, people: { ...w.__dc } }; });
  };
  let first = true;
  const measure = async (label: string, v: number[]) => {
    await page.evaluate(v => (window as any).__parsa.view(...v), v);
    const withP = await frame(true, first), without = await frame(false, false); first = false; await page.evaluate(() => { (window as any).__parsa.world.people.crowd.group.visible = true; });
    const h = await page.evaluate(() => (window as any).__parsa.humans());
    console.log(`cost ${label} [${q}]`, JSON.stringify({ with: withP, without, peopleDraws: withP.draws - without.draws, peopleTriangles: withP.triangles - without.triangles, crowd: { byLod: h.byLod, draws: h.draws, triangles: h.triangles, shadowDraws: h.shadowDraws, shadowTriangles: h.shadowTriangles, props: h.props, perf: h.perf } }));
    await page.screenshot({ path: `shots/humans-cost-${label}-${q}-${info.project.name}.png` });
  };
  await measure('stair-foot', [-60, 122, 1.6, 71, 10]);
  await measure('apadana-n-court', [0, 60, 1.6, 161, 5]);
  await page.evaluate(() => (window as any).__parsa.humanCrowd(300, 0, 88, 20));
  await measure('crowd300', [0, 114, 1.7, az(180), -3]);
  console.log(errs.slice(0, 10).join('\n'));
  expect(errs).toEqual([]);
});
