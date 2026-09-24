import { test, type Page } from '@playwright/test';
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { lumStats } from './lib/lum';
// D-187 (session-6 look bugs): one debug run in two page loads. Load H (quality high, day 25 11:00): the probe lookup and
// brazier fixes in the views the rubric flagged (floor speckle, black stands) and the new entry views; optional pipeline
// debug views (post=<name>); the scribes' room at 10:00 through setTime. Load T (quality test, day 25 10:00, other hours through setTime): the re-posed camera-rig
// views (composition only), what the black blobs on the dawn hills and the pale comb on the dawn horizon are (picks,
// objects hidden and shown). Debug spec: runs only with DBG=1. LOADS=H,T picks the loads; FRAMES_H frames at high.
type View = { n: string; day: number; hour: number; v: [number, number, number, number, number]; fov?: number; post?: string; carry?: [string, number]; frames?: number };
const IN = 46;
const H: View[] = [
  { n: 'hadish-hall', day: 25, hour: 11, v: [22, -150, 1.6, 161, 2], fov: IN },
  { n: 'apadana-hall-axis', day: 25, hour: 11, v: [1.9, 12, 1.6, 161, 6], fov: IN },
  { n: 'scribe-at-work-old', day: 25, hour: 10, v: [183.2, -83.9, 1.6, 60, -20], fov: 50 },
  { n: 'scribe-room-ne', day: 25, hour: 10, v: [190.9, -82.0, 1.7, 235, -15], fov: 50 },
];
const T: View[] = [
  { n: 'scribe-at-work', day: 25, hour: 10, v: [188.2, -84.0, 1.0, 280, -15], fov: 50 },
  { n: 'apadana-enter', day: 25, hour: 11, v: [1.9, 58, 1.6, 161, 4], fov: IN },
  { n: 'apadana-enter-court', day: 25, hour: 11, v: [1.9, 66, 1.6, 161, 8], fov: IN },
  { n: 'apadana-e-stair-raking', day: 25, hour: 10, v: [80, -14, 1.6, 300, 0] },
  { n: 'tachara-s-stair', day: 25, hour: 9.5, v: [-21, -112, 1.6, 341, 6] },
  { n: 'reliefs-raking', day: 25, hour: 16, v: [-30, 63.5, 1.6, 83, -3] },
  { n: 'tachara-lance-bearers', day: 25, hour: 16, v: [-26.9, -86.0, 1.6, 304, -4], fov: IN },
  { n: 'tachara-lance-bearer-close', day: 25, hour: 16, v: [-28.4, -84.6, 1.6, 311, -10], fov: IN },
  { n: 'dawn-stair-top', day: 0, hour: 5.40, v: [-36.4, 140.5, 1.6, 196, -8] },
  { n: 'dawn-stair-top-nw', day: 0, hour: 5.40, v: [-36.4, 134.8, 1.6, 311, -8] },
  { n: 'dawn-sunrise-old', day: 0, hour: 5.85, v: [-40.2, 122.45, 1.6, 251, -12] },
];
const out: Record<string, any> = {};
const save = () => { mkdirSync('shots', { recursive: true }); const f = 'shots/dbg-look.json', all = existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : {}; Object.assign(all, out); writeFileSync(f, JSON.stringify(all, null, 1)); };
async function load(page: Page, q: string, day: number, hour: number) {
  await page.goto(`/?test&quality=${q}&day=${day}&hour=${hour}&weather=clear`);
  await page.waitForFunction(() => (window as any).__parsa?.ready === true || (window as any).__parsa?.error, null, { timeout: 900_000 });
  await page.evaluate(() => (window as any).__parsa?.renderer?.setAnimationLoop(null));
}
async function shoot(page: Page, s: View, tag: string, frames: number) {
  await page.evaluate(([d, h]) => { const p = (window as any).__parsa; p.setTime(d, h); p.setWeather('clear'); }, [s.day, s.hour]);
  await page.evaluate(([v, f]) => (window as any).__parsa.view(...v, f), [s.v, s.fov ?? 40] as const);
  const t0 = Date.now();
  for (let i = 0; i < frames; i++) await page.evaluate(() => (window as any).__parsa.renderOnce());
  const png = await page.screenshot({ path: `shots/dbg-look-${s.n}-${tag}.png` });
  const e = await page.evaluate(() => (window as any).__parsa.exposureInfo());
  out[`${s.n}|${tag}`] = { lum: await lumStats(page, png), exposure: +e.exposure.toFixed(3), meterEV: +(e.meterEV ?? 0).toFixed(2), sunAlt: +e.sunAlt.toFixed(1), frameS: +((Date.now() - t0) / 1000 / frames).toFixed(1) };
  console.log(s.n, tag, JSON.stringify(out[`${s.n}|${tag}`])); save();
  return png;
}
test('look bugs (D-187)', async ({ page }) => {
  test.setTimeout(+(process.env.TIMEOUT ?? 2800) * 1000);
  const errs: string[] = []; page.on('pageerror', e => errs.push(String(e))); page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
  const loads = (process.env.LOADS ?? 'H,T').split(',');
  if (loads.includes('H')) {
    await load(page, 'high', 25, 11);
    const FH = +(process.env.FRAMES_H ?? 3);
    for (const s of H) await shoot(page, s, 'high', s.frames ?? FH);
    // pipeline debug views (POST=view:post,…; default: the Hadish floor's scene pass, i.e. before the composite, and the SSR
    // alone on the hall axis, the white sparkles), then back to the image
    for (const vp of (process.env.POST ?? 'hadish-hall:scene,apadana-hall-axis:ssr').split(',').filter(Boolean)) {
      const [vn, pv] = vp.split(':'), s = H.find(q => q.n === vn)!;
      await page.evaluate(v => (window as any).__parsaSurf.post(v), pv); await shoot(page, s, `post-${pv}`, 2); await page.evaluate(() => (window as any).__parsaSurf.post(''));
    }
  }
  if (loads.includes('T')) {
    await load(page, 'test', 25, 10);
    const FT = 1; // quality test: MSAA, no temporal accumulation, no meter: one frame per view
    for (const s of T) await shoot(page, s, 'test', FT);
    // the black blobs on the NW hill at 05:24: what is under them, and do they go with the jackals (active 18:36–05:48)?
    const nw = T.find(s => s.n === 'dawn-stair-top-nw')!;
    await page.evaluate(([d, h]) => (window as any).__parsa.setTime(d, h), [nw.day, nw.hour]);
    await page.evaluate(([v, f]) => (window as any).__parsa.view(...v, f), [nw.v, nw.fov ?? 40] as const);
    await page.evaluate(() => (window as any).__parsa.renderOnce());
    const probe = await page.evaluate(() => {
      const p = (window as any).__parsa, sc = p.renderer && (p.world.root.parent ?? p.world.root);
      const picks = [[0.877, 0.393], [0.87, 0.39], [0.885, 0.40], [0.86, 0.38]].map(([x, y]) => ({ at: [x, y], hit: p.pick(x, y) }));
      const jm = sc.getObjectByName('wildlife-jackals'); const js: any[] = [];
      if (jm) { const m = new (jm.matrix.constructor)(); for (let i = 0; i < jm.count; i++) { jm.getMatrixAt(i, m); js.push([m.elements[12], m.elements[13], m.elements[14]].map((x: number) => +x.toFixed(1))); } }
      const names: Record<string, number> = {}; sc.traverse((o: any) => { if (o.isInstancedMesh && o.visible && o.count) names[o.name || o.parent?.name || '?'] = o.count; });
      return { picks, jackals: js, jackalCount: jm?.count ?? null, instanced: names };
    });
    out['dawn-nw|probe'] = probe; console.log('dawn-nw probe', JSON.stringify(probe)); save();
    // hide the jackals, the birds and the animals in turn: which one takes the blobs away (region x 0.85–0.97, y 0.27–0.33)
    const region = { x0: 0.85, y0: 0.27, x1: 0.97, y1: 0.33 };
    for (const name of ['wildlife-jackals', 'wildlife-birds']) {
      await page.evaluate(n => { const p = (window as any).__parsa, sc = p.world.root.parent ?? p.world.root, o = sc.getObjectByName(n); if (o) o.visible = false; }, name);
      await page.evaluate(() => (window as any).__parsa.renderOnce());
      const png = await page.screenshot({ path: `shots/dbg-look-dawn-nw-no-${name}.png` });
      out[`dawn-nw|no-${name}`] = { region: await lumStats(page, png, region) }; console.log('no', name, JSON.stringify(out[`dawn-nw|no-${name}`])); save();
      await page.evaluate(n => { const p = (window as any).__parsa, sc = p.world.root.parent ?? p.world.root, o = sc.getObjectByName(n); if (o) o.visible = true; }, name);
    }
    // the pale comb on the dawn horizon: the town's smoke plumes? (dawn-sunrise-old region x 0.72–1, y 0.19–0.26)
    const sr = T.find(s => s.n === 'dawn-sunrise-old')!, rc = { x0: 0.72, y0: 0.19, x1: 1, y1: 0.26 };
    await page.evaluate(([d, h]) => (window as any).__parsa.setTime(d, h), [sr.day, sr.hour]);
    await page.evaluate(([v, f]) => (window as any).__parsa.view(...v, f), [sr.v, sr.fov ?? 40] as const);
    for (const hide of ['', 'settlement:smoke-plumes', 'settlement:haze']) {
      if (hide) await page.evaluate(n => { const p = (window as any).__parsa, sc = p.world.root.parent ?? p.world.root; sc.traverse((o: any) => { if (o.name === n) o.visible = false; }); }, hide);
      await page.evaluate(() => (window as any).__parsa.renderOnce());
      const png = await page.screenshot({ path: `shots/dbg-look-dawn-comb-${hide ? 'no-' + hide.replace(':', '_') : 'all'}.png` });
      out[`dawn-comb|${hide || 'all'}`] = { region: await lumStats(page, png, rc) }; console.log('comb', hide || 'all', JSON.stringify(out[`dawn-comb|${hide || 'all'}`])); save();
    }
  }
  console.log(errs.slice(0, 8).join('\n'));
});
