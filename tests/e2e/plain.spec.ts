import { test } from '@playwright/test';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { lumStats } from './lib/lum';
// Phase 7 camera rig: the plain from the Terrace (the §1.1 dawn moment), the river bank close, a field in several seasons,
// a village, and Naqsh-e Rustam from 200 m; each view logs __parsa.stats() (draw calls, triangles) with the plain shown
// and hidden, so the plain's own share of the frame is measured (the Phase 7 gate: proxy performance at the plain vista).
// ONLY=name,name  Q=test|high  (views marked `budget` also run at Q=high when BUDGET=1)
const VIEWS: { n: string; day: number; hour: number; w: string; v: [number, number, number, number, number]; budget?: boolean }[] = [
  { n: 'stair-dawn-plain', day: 0, hour: 5.85, w: 'clear', v: [-36.4, 122.45, 1.6, 251, -2], budget: true },
  { n: 'stair-noon-plain', day: 0, hour: 11, w: 'clear', v: [-36.4, 122.45, 1.6, 251, -3] },
  { n: 'aerial-fields-diagnostic', day: 30, hour: 10, w: 'clear', v: [-3800, 1200, 150, 251, -14] }, // NOT a walkable view: 150 m up, to judge the field patchwork, canals and villages
  { n: 'apadana-north-nr', day: 0, hour: 9, w: 'clear', v: [1.9, 40, 1.6, 341, 1], budget: true },
  { n: 'stair-foot-east', day: 0, hour: 9, w: 'clear', v: [-60, 122, 1.6, 71, 10], budget: true }, // the lead's baseline view (the Terrace, plain behind the camera)
  { n: 'pulvar-bank-april', day: 0, hour: 10, w: 'clear', v: [-2505, 2700, 1.6, 341, -8] },
  { n: 'pulvar-bank-september', day: 150, hour: 10, w: 'clear', v: [-2505, 2700, 1.6, 341, -8] },
  { n: 'field-april', day: 0, hour: 10, w: 'clear', v: [-5205, 1611, 1.6, 251, -12] },
  { n: 'field-may', day: 30, hour: 10, w: 'clear', v: [-5205, 1611, 1.6, 251, -12] },
  { n: 'field-august', day: 120, hour: 10, w: 'clear', v: [-5205, 1611, 1.6, 251, -12] },
  { n: 'field-january', day: 280, hour: 11, w: 'clear', v: [-5205, 1611, 1.6, 251, -12] },
  { n: 'village-p22', day: 0, hour: 16, w: 'clear', v: [-973, 3287, 1.6, 341, 1] },
  { n: 'naqsh-200m', day: 0, hour: 15, w: 'clear', v: [592, 5924, 1.6, 341, 7] },
  { n: 'naqsh-kaba-40m', day: 0, hour: 15, w: 'clear', v: [520, 5980, 1.6, 20, 12] },
];
test('plain', async ({ page }, info) => {
  test.setTimeout(3_600_000);
  const errs: string[] = []; page.on('pageerror', e => errs.push(String(e))); page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text().slice(0, 300)); });
  const only = process.env.ONLY?.split(','), Q = process.env.Q ?? 'test';
  const out: Record<string, any> = {};
  for (const s of VIEWS) {
    if (only && !only.includes(s.n)) continue;
    if (Q !== 'test' && !s.budget) continue;
    await page.goto(`/?test&quality=${Q}&day=${s.day}&hour=${s.hour}&weather=${s.w}`);
    await page.waitForFunction(() => (window as any).__parsa?.ready === true || (window as any).__parsa?.error, null, { timeout: 900_000 });
    const err = await page.evaluate(() => (window as any).__parsa.error); if (err) throw new Error(err);
    await page.evaluate(v => (window as any).__parsa.view(...v), s.v);
    // one frame lets the plain build its lazy colliders around the camera (river corridor, village, trees); view again so
    // the eye stands on what is drawn (the heightfield alone is carved lower under the river corridor)
    await page.evaluate(() => (window as any).__parsa.renderOnce()); await page.evaluate(v => (window as any).__parsa.view(...v), s.v);
    for (let i = 0; i < (Q === 'test' ? 6 : 3); i++) await page.evaluate(() => (window as any).__parsa.renderOnce());
    const png = await page.screenshot({ path: `shots/plain-${s.n}-${Q}-${info.project.name}.png` });
    const withPlain = await page.evaluate(() => { const p = (window as any).__parsa; const st = p.stats(); return { drawCalls: st.drawCalls, triangles: st.triangles, terrainTris: st.terrain.tris, backend: st.backend, plain: p.world.plain?.stats() }; });
    await page.evaluate(() => { (window as any).__parsa.world.root.getObjectByName('plain').visible = false; });
    await page.evaluate(() => (window as any).__parsa.renderOnce());
    const without = await page.evaluate(() => { const st = (window as any).__parsa.stats(); return { drawCalls: st.drawCalls, triangles: st.triangles }; });
    await page.evaluate(() => { (window as any).__parsa.world.root.getObjectByName('plain').visible = true; });
    const lum = await lumStats(page, png);
    const pick = await page.evaluate(() => (window as any).__parsa.pick(0, 0));
    out[s.n] = { quality: Q, withPlain, withoutPlain: without, plainAdds: { drawCalls: withPlain.drawCalls - without.drawCalls, triangles: withPlain.triangles - without.triangles }, lum, centre: pick };
    console.log(s.n, JSON.stringify(out[s.n]));
  }
  mkdirSync('shots', { recursive: true }); const f = 'shots/plain-stats.json'; const all = existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : {};
  for (const [k, v] of Object.entries(out)) all[`${k}|${Q}|${info.project.name}`] = v; writeFileSync(f, JSON.stringify(all, null, 1));
  console.log('errors/warnings:', errs.slice(0, 12).join('\n'));
});
