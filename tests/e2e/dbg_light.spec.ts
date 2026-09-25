import { test, type Page } from '@playwright/test';
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { lumStats } from './lib/lum';
// D-216 (render pass 2, light and material bugs R3, R4, R5, R7, R10, R12 and rubric fix 4): one page load per scenario, the
// moments' cameras through setTime, each view rendered as the image (B) and with one thing switched off:
//   fires0      every fire's point light off (what lights a surface without the fires)
//   hallfires0  the point lights of fires inside a roofed hall's interior off (light through the walls?)
//   braziers0   the braziers' point lights off
//   ssr0 / env0 / gi0: the SSR, the sky specular, the SSGI bounce off (window.__parsaSurf switches)
//   post:<v>    a pipeline debug view (pipeline.ts: scene | gi | ssr | env | probe | direct …)
// plus picks (what is under an NDC point) and the fire lights in use. Debug spec: runs only with DBG=1.
// SCEN=night|day|plain (one per run), FRAMES=4, Q=high, TAG=suffix for the files (before/after runs)
type Variant = string;
type View = { n: string; day: number; hour: number; v: [number, number, number, number, number]; fov?: number; variants: Variant[]; picks?: [number, number][] };
const IN = 46, OUT = 40;
const SCEN: Record<string, { load: [number, number]; views: View[] }> = {
  night: { load: [0, 21.5], views: [
    { n: 'brazier-close', day: 0, hour: 21.5, v: [-36.4, 132, 1.6, 161, -8], fov: IN, variants: ['B', 'fires0', 'braziers0'],
      picks: [[0.6, 0.2], [0.8, 0.1], [0.9, -0.1], [0.7, -0.3], [0.95, -0.3], [0.5, 0.5], [0.2, 0.6]] },
    { n: 'night-terrace', day: 5, hour: 22.5, v: [0, 92, 1.6, 161, 6], fov: OUT, variants: ['B', 'hallfires0', 'braziers0', 'fires0'] },
  ] },
  dusk: { load: [0, 19.25], views: [
    { n: 'gate-dusk', day: 0, hour: 19.25, v: [-40, 124.6, 1.6, 90, 15], fov: OUT, variants: ['B', 'fires0', 'braziers0'] },
  ] },
  day: { load: [25, 10], views: [
    { n: 'scribe-room-ne', day: 25, hour: 10, v: [190.9, -82.0, 1.7, 235, -15], fov: 50, variants: ['B', 'ssr0', 'gi0', 'post:scene', 'post:gi', 'post:ssr'],
      picks: [[-0.6, -0.2], [-0.5, -0.3], [-0.3, -0.1], [-0.8, -0.6]] },
    { n: 'scribe-at-work', day: 25, hour: 10, v: [189.4, -84.2, 1.0, 269, -12], fov: 50, variants: ['B', 'ssr0', 'gi0', 'post:scene'] },
    { n: 'hadish-hall', day: 25, hour: 11, v: [22, -150, 1.6, 161, 2], fov: IN, variants: ['B', 'ssr0'] },
    { n: 'apadana-hall-axis', day: 25, hour: 11, v: [1.9, 12, 1.6, 161, 6], fov: IN, variants: ['B', 'ssr0'] },
    { n: 'tachara-lance-bearer-close', day: 25, hour: 16, v: [-28.4, -84.6, 1.6, 311, -10], fov: IN, variants: ['B', 'ssr0'] },
  ] },
  plain: { load: [0, 10], views: [
    { n: 'pulvar-bank-april', day: 0, hour: 10, v: [-2505, 2700, 1.6, 341, -8], fov: OUT, variants: ['B', 'ssr0', 'env0', 'post:ssr'], picks: [[0, 0.2], [0.5, 0.2], [-0.5, 0.2]] },
    { n: 'garden-paradise', day: 25, hour: 10, v: [-2475.4, 2365.5, 1.6, 290, 2], fov: OUT, variants: ['B', 'ssr0'], picks: [[0.1, -0.5], [0.05, -0.2]] },
  ] },
};
const out: Record<string, any> = {};
const save = () => { mkdirSync('shots', { recursive: true }); const f = 'shots/dbg-light.json', all = existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : {}; Object.assign(all, out); writeFileSync(f, JSON.stringify(all, null, 1)); };
/** the fire lights in use (position, intensity, cut-off) and the fires they stand for */
const lightsInUse = (page: Page) => page.evaluate(() => {
  const F = (window as any).__parsa.world.fire; if (!F) return null;
  return F.lights.filter((l: any) => l.visible && l.intensity > 0).map((l: any) => {
    const f = F.fires.find((q: any) => Math.hypot(q.pos.x - l.position.x, q.pos.z - l.position.z) < 1e-3);
    return { id: f?.id, note: f?.note?.slice(0, 60), e: +l.position.x.toFixed(1), n: +(-l.position.z).toFixed(1), y: +l.position.y.toFixed(2), I: +l.intensity.toFixed(2), cut: +l.distance.toFixed(1), decay: l.decay };
  });
});
/** switch fire lights off after each fire update: `which` = 'all' | 'brazier' | 'hall' (inside a roofed hall's interior box) */
const firesOff = (page: Page, which: string) => page.evaluate((w) => {
  const P = (window as any).__parsa, F = P.world.fire; if (!F) return;
  if (!F.__orig) F.__orig = F.update.bind(F);
  // the roofed halls' interiors (manifest rooms: centre e, n, size e, n; buildTerrace, session 7)
  const halls = [[0.135, 124.59, 24.74, 24.74], [1.9, -4.9, 60.5, 60.5], [-21.55, -80.7, 15.9, 15.7], [22, -159.5, 27, 27], [180.23, -120.745, 42, 50.4], [114.75, -142.5, 16.5, 16]];
  const inHall = (e: number, n: number) => halls.some((r: number[]) => Math.abs(e - r[0]) < r[2] / 2 && Math.abs(n - r[1]) < r[3] / 2);
  F.update = (...a: any[]) => { F.__orig(...a); if (w === 'none') return;
    for (const l of F.lights) { const f = F.fires.find((q: any) => Math.hypot(q.pos.x - l.position.x, q.pos.z - l.position.z) < 1e-3); if (!f) continue;
      if (w === 'all' || (w === 'brazier' && f.kind === 'brazier') || (w === 'hall' && inHall(f.pos.x, -f.pos.z))) l.intensity = 0; } };
}, which);
async function shoot(page: Page, s: View, tag: string, frames: number) {
  const t0 = Date.now();
  for (let i = 0; i < frames; i++) await page.evaluate(() => (window as any).__parsa.renderOnce());
  const frameS = +((Date.now() - t0) / 1000 / frames).toFixed(1);
  const T = process.env.TAG ? '-' + process.env.TAG : '';
  const png = await page.screenshot({ path: `shots/dbg-light-${s.n}-${tag.replace(':', '_')}${T}.png` });
  const e = await page.evaluate(() => (window as any).__parsa.exposureInfo());
  out[`${s.n}|${tag}${T}`] = { lum: await lumStats(page, png), exposure: +e.exposure.toFixed(3), meterEV: +(e.meterEV ?? 0).toFixed(2), sunAlt: +e.sunAlt.toFixed(1), hemiI: e.hemiI, gain: e.gain, frameS };
  console.log(s.n, tag, JSON.stringify(out[`${s.n}|${tag}${T}`])); save();
}
test('light and material bugs (D-216)', async ({ page }) => {
  test.setTimeout(+(process.env.TIMEOUT ?? 1380) * 1000);
  const errs: string[] = []; page.on('pageerror', e => errs.push(String(e))); page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
  const sc = SCEN[process.env.SCEN ?? 'night'], FR = +(process.env.FRAMES ?? 4), T = process.env.TAG ? '-' + process.env.TAG : '';
  const only = process.env.ONLY?.split(',');
  await page.goto(`/?test&quality=${process.env.Q ?? 'high'}&day=${sc.load[0]}&hour=${sc.load[1]}&weather=clear${process.env.URLX ?? ''}`);
  await page.waitForFunction(() => (window as any).__parsa?.ready === true || (window as any).__parsa?.error, null, { timeout: 900_000 });
  await page.evaluate(() => (window as any).__parsa?.renderer?.setAnimationLoop(null));
  for (const s of sc.views) {
    if (only && !only.includes(s.n)) continue;
    await page.evaluate(([d, h]) => { const p = (window as any).__parsa; p.setTime(d, h); p.setWeather('clear'); }, [s.day, s.hour]);
    await page.evaluate(([v, f]) => (window as any).__parsa.view(...v, f), [s.v, s.fov ?? OUT] as const);
    // one frame builds the lazy colliders round the camera (the plain's river corridor, trees); view again so the eye
    // stands on what is drawn (plain.spec)
    await page.evaluate(() => (window as any).__parsa.renderOnce()); await page.evaluate(([v, f]) => (window as any).__parsa.view(...v, f), [s.v, s.fov ?? OUT] as const);
    for (const vr of (process.env.VARIANTS?.split(',') ?? s.variants)) {
      const sw: Record<string, [string, number]> = { ssr0: ['ssr', 0], gi0: ['giDirect', 0], env0: ['env', 0] };
      if (vr.startsWith('post:')) await page.evaluate(v => (window as any).__parsaSurf.post(v), vr.slice(5));
      else if (sw[vr]) await page.evaluate(([k, x]) => { (window as any).__parsaSurf[k].value = x; }, sw[vr]);
      else if (vr !== 'B') await firesOff(page, { fires0: 'all', braziers0: 'brazier', hallfires0: 'hall' }[vr] ?? 'none');
      await shoot(page, s, vr, vr.startsWith('post:') ? 2 : FR);
      if (vr === 'B') { out[`${s.n}|lights${T}`] = await lightsInUse(page); save(); }
      // back to the image
      if (vr.startsWith('post:')) await page.evaluate(() => (window as any).__parsaSurf.post(''));
      else if (sw[vr]) await page.evaluate(([k]) => { (window as any).__parsaSurf[k].value = 1; }, sw[vr]);
      else if (vr !== 'B') await firesOff(page, 'none');
    }
    if (s.picks) { out[`${s.n}|picks${T}`] = await page.evaluate(ps => ps.map(([x, y]) => ({ at: [x, y], hit: (window as any).__parsa.pick(x, y) })), s.picks); save(); console.log(s.n, 'picks', JSON.stringify(out[`${s.n}|picks${T}`])); }
  }
  console.log(errs.slice(0, 8).join('\n'));
});
