import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
// D-276, the Terrace's room ranges: one page load (the queue's limit). The court setting on day 20 (the royal guard in
// residence, D-252): (1) the two Terrace budget views of crowd_scale (court-forecourt-w, court-apadana-n) at 10:00, every
// backend draw counted and the renderer's triangles, to compare with the same spec run on the commit before (ONLY=budget);
// (2) inside a Treasury store room at 11:00 (its door open in working hours); (3) the garrison's quarters at 23:00, the men
// asleep on their mats by the hearth. Screenshots → shots/rooms-*.png; numbers → shots/rooms-d276.json (keyed by COMMIT).
const az = (gridDeg: number) => gridDeg - 19; // grid heading → true azimuth (view() takes true azimuths)
interface Scene { n: string; hour: number; v: [number, number, number, number, number]; budget?: boolean }
const SCENES: Scene[] = [
  { n: 'court-forecourt-w', hour: 10, v: [-35, 85, 1.6, az(90), -2], budget: true },
  { n: 'court-apadana-n', hour: 10, v: [0, 55, 1.6, az(337.5), -2], budget: true },
  // w_stores:3 (x 142.6-152.0, y -126.6..-119.5; its doorway E at y -123.1): from inside the doorway looking W at the
  // benches of stored goods along the back and side walls
  { n: 'treasury-store', hour: 11, v: [151.2, -122.2, 1.6, az(258), -12] },
  // quarters_s:2 (x 191.5-213, y -41..-23.5; doorway W at y -32.3; hearth at 202.3, -32.3): from the NW corner looking SE
  // over the mats to the hearth
  { n: 'garrison-quarters-night', hour: 23, v: [193.2, -25.2, 1.6, az(122), -10] },
];
test('D-276 rooms: budgets and two interiors', async ({ page }, info) => {
  test.setTimeout(+(process.env.TIMEOUT ?? 2400) * 1000);
  const errs: string[] = []; page.on('pageerror', e => errs.push(String(e))); page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
  const q = process.env.Q ?? 'high', commit = process.env.COMMIT ?? 'unknown', only = process.env.ONLY === 'budget' ? SCENES.filter(s => s.budget) : SCENES;
  const f = 'shots/rooms-d276.json'; mkdirSync('shots', { recursive: true }); const all = existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : {};
  await page.goto(`/?test&quality=${q}&day=20&hour=${only[0].hour}&weather=clear&court=seasonal`);
  await page.waitForFunction(() => (window as any).__parsa?.ready === true || (window as any).__parsa?.error, null, { timeout: 1_200_000 });
  await page.evaluate(() => (window as any).__parsa.renderer.setAnimationLoop(null));
  await page.evaluate(() => { const w = window as any, b = w.__parsa.renderer.backend; w.__dc = { total: 0 };
    const d = b.draw.bind(b); b.draw = (ro: any, ...a: any[]) => { if (ro.getDrawParameters?.() !== null) w.__dc.total++; return d(ro, ...a); }; });
  for (const s of only) {
    await page.evaluate(h => (window as any).__parsa.setTime(20, h), s.hour);
    await page.evaluate(v => (window as any).__parsa.view(...v), s.v);
    await page.evaluate(v => { const P = (window as any).__parsa.world.people; if (P) { P.crowd.looksPerFrame = 1e9; P.view.settle(P.sim.t, [v[0], v[1]]); } }, s.v);
    for (let i = 0; i < 3; i++) await page.evaluate(() => (window as any).__parsa.renderOnce());
    await page.evaluate(() => { (window as any).__dc.total = 0; });
    await page.evaluate(() => (window as any).__parsa.renderOnce());
    const r = await page.evaluate(() => { const w = window as any, st = w.__parsa.stats(); return { draws: w.__dc.total, drawCalls: st.drawCalls, triangles: st.triangles, clock: w.__parsa.clock?.() ?? null }; });
    await page.screenshot({ path: `shots/rooms-${s.n}-${q}-${commit}.png` });
    console.log(`rooms ${s.n} [${q}/${commit}]`, JSON.stringify(r));
    all[`${s.n}|${q}|${commit}`] = { scene: s.n, v: s.v, hour: s.hour, ...r }; writeFileSync(f, JSON.stringify(all, null, 1));
  }
  console.log(errs.slice(0, 10).join('\n'));
  expect(errs).toEqual([]);
});
