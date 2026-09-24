import { test, type Page } from '@playwright/test';
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { lumStats } from './lib/lum';
// D-187, second debug run (DBG=1), two page loads at quality high. Load A (day 25 11:00; 10:00 and 16:00 through setTime):
// the re-posed camera-rig views after the first run's quality-test renders, the entry sequence with the eye carried over
// (moments.spec's `carry`), and the Tachara lance-bearer at high (the old view's white seam). Load B (day 0 05:24): the
// dawn view from the Grand Stair, and what the black blobs on the NW hill (05:24) and the pale comb on the W horizon
// (05:51) are: picks by group at their pixels, and the blobs with the herds hidden.
type View = { n: string; day: number; hour: number; v: [number, number, number, number, number]; fov?: number; carry?: [string, number] };
const IN = 46;
const A: View[] = [
  { n: 'apadana-enter-court', day: 25, hour: 11, v: [1.9, 75, 1.6, 161, 2], fov: IN },
  { n: 'apadana-enter-portico', day: 25, hour: 11, v: [1.9, 36, 1.6, 161, 2], fov: IN },
  { n: 'apadana-enter-door', day: 25, hour: 11, v: [1.9, 31.0, 1.6, 161, 2], fov: IN, carry: ['apadana-enter-portico', 0] },
  { n: 'apadana-enter-hall', day: 25, hour: 11, v: [1.9, 23.0, 1.6, 161, 4], fov: IN, carry: ['apadana-enter-door', 6] },
  { n: 'apadana-hall-out', day: 25, hour: 11, v: [1.9, 18, 1.6, 341, 3], fov: IN },
  { n: 'scribe-at-work', day: 25, hour: 10, v: [189.4, -84.2, 1.0, 269, -12], fov: 50 },
  { n: 'reliefs-raking', day: 25, hour: 16, v: [8, 67, 1.6, 216, -3] },
  { n: 'tachara-lance-bearer-close', day: 25, hour: 16, v: [-28.4, -84.6, 1.6, 311, -10], fov: IN },
];
const B: View[] = [
  { n: 'dawn-stair-top', day: 0, hour: 5.40, v: [-36.4, 135.5, 1.6, 281, -8] },
  { n: 'dawn-stair-top-nw', day: 0, hour: 5.40, v: [-36.4, 134.8, 1.6, 311, -8] },
];
const out: Record<string, any> = {};
const save = () => { mkdirSync('shots', { recursive: true }); const f = 'shots/dbg-look.json', all = existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : {}; Object.assign(all, out); writeFileSync(f, JSON.stringify(all, null, 1)); };
const eye = new Map<string, number>();
async function load(page: Page, day: number, hour: number) {
  await page.goto(`/?test&quality=high&day=${day}&hour=${hour}&weather=clear`);
  await page.waitForFunction(() => (window as any).__parsa?.ready === true || (window as any).__parsa?.error, null, { timeout: 900_000 });
  await page.evaluate(() => (window as any).__parsa?.renderer?.setAnimationLoop(null));
}
async function shoot(page: Page, s: View, frames: number) {
  await page.evaluate(([d, h]) => { const p = (window as any).__parsa; p.setTime(d, h); p.setWeather('clear'); }, [s.day, s.hour]);
  await page.evaluate(c => (window as any).__parsa.carryEye(c ? c[0] : null, c ? c[1] : 0), s.carry ? [eye.get(s.carry[0]) ?? 0, s.carry[1]] as [number, number] : null);
  await page.evaluate(([v, f]) => (window as any).__parsa.view(...v, f), [s.v, s.fov ?? 40] as const);
  const t0 = Date.now();
  for (let i = 0; i < frames; i++) await page.evaluate(() => (window as any).__parsa.renderOnce());
  const png = await page.screenshot({ path: `shots/dbg-look2-${s.n}.png` });
  const e = await page.evaluate(() => (window as any).__parsa.exposureInfo()); eye.set(s.n, e.exposure);
  out[`${s.n}|high2`] = { lum: await lumStats(page, png), exposure: +e.exposure.toFixed(3), meterEV: +(e.meterEV ?? 0).toFixed(2), sunAlt: +e.sunAlt.toFixed(1), frameS: +((Date.now() - t0) / 1000 / frames).toFixed(1), ...(s.carry ? { carry: s.carry } : {}) };
  console.log(s.n, JSON.stringify(out[`${s.n}|high2`])); save();
}
const GROUPS = ['animals:work', 'people', 'wildlife-birds', 'wildlife-jackals', 'plain-trees-far', 'plain-trees-mid', 'plain-orchards-far', 'plain-villages', 'plain-quarries', 'plain', 'settlement', 'world'];
async function picks(page: Page, tag: string, pts: [number, number][]) {
  await page.evaluate(() => (window as any).__parsa.tick());
  const r = await page.evaluate(([pts, groups]) => { const p = (window as any).__parsa; const o: any = {};
    for (const [x, y] of pts as [number, number][]) { const k = `${x},${y}`; o[k] = {}; for (const g of groups as string[]) { const h = p.pick(x, y, g); if (h && !h.error) o[k][g] = { name: h.name, d: +h.d.toFixed(0), p: h.p.map((q: number) => +q.toFixed(1)) }; } }
    return o; }, [pts, GROUPS] as const);
  out[`picks|${tag}`] = r; console.log('picks', tag, JSON.stringify(r)); save();
}
test('look bugs, second run (D-187)', async ({ page }) => {
  test.setTimeout(+(process.env.TIMEOUT ?? 2850) * 1000);
  const errs: string[] = []; page.on('pageerror', e => errs.push(String(e))); page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
  const F = +(process.env.FRAMES ?? 2), loads = (process.env.LOADS ?? 'A,B').split(',');
  if (loads.includes('A')) { await load(page, 25, 11); for (const s of A) await shoot(page, s, F); }
  if (loads.includes('B')) {
    await load(page, 0, 5.40);
    for (const s of B) await shoot(page, s, F);
    // the blobs (dawn-stair-top-nw, pixels (901, 164) and (935, 155) of 960 × 540: NDC below); then the herds hidden
    await picks(page, 'dawn-nw-blobs', [[0.877, 0.393], [0.948, 0.426], [0.87, 0.39], [0.885, 0.4]]);
    const region = { x0: 0.85, y0: 0.27, x1: 0.99, y1: 0.33 };
    await page.evaluate(() => { const p = (window as any).__parsa, sc = p.world.root.parent ?? p.world.root; sc.traverse((o: any) => { if (o.name === 'animals:work') o.visible = false; }); });
    await page.evaluate(() => (window as any).__parsa.renderOnce());
    const png = await page.screenshot({ path: 'shots/dbg-look2-dawn-nw-no-animals.png' });
    out['dawn-nw|no-animals'] = { region: await lumStats(page, png, region) }; console.log('no animals', JSON.stringify(out['dawn-nw|no-animals'])); save();
    await page.evaluate(() => { const p = (window as any).__parsa, sc = p.world.root.parent ?? p.world.root; sc.traverse((o: any) => { if (o.name === 'animals:work') o.visible = true; }); });
    // the comb (dawn-sunrise's old pose at 05:51, pixels x 840–950, y 113–128): picks only (no render)
    await page.evaluate(() => (window as any).__parsa.setTime(0, 5.85));
    await page.evaluate(() => (window as any).__parsa.view(-40.2, 122.45, 1.6, 251, -12, 40));
    await picks(page, 'dawn-comb', [[0.83, 0.55], [0.85, 0.55], [0.875, 0.56], [0.9, 0.555], [0.93, 0.56], [0.96, 0.55]]);
  }
  console.log(errs.slice(0, 8).join('\n'));
});
