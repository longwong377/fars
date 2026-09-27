import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
// Portraits (D-304, session 11): the people seen close, at conversation distance, at the player's lens. Twenty people of
// every dress and class, each framed from 1.5 m in front at eye height, by day (10:00) and by a brazier's light at night
// (the world's brazier light model, fire.ts; humanLab `fire`), and three crowd views (the 300-person stress wedge 2-20 m,
// a crowd 20-120 m, the stress wedge by fire light). One page load (humanlab.html) for every view.
// Env: Q (quality, default high), FOV (vertical degrees, default 60 = the game's default setting), TAG (a prefix for the
// screenshot names: before/after runs), VARIANTS (below), ONLY (comma list of shot names), W, H (viewport, default 1920 × 1080).
// Screenshots → shots/portraits/<TAG->name.png, the lab's stats per shot → shots/portraits/<TAG->stats.json.
const PEOPLE: any[] = [
  { dress: 'persian', sex: 'm', role: 'official', seed: 11, origin: 'Persian' },
  { dress: 'persian', sex: 'm', role: 'official', seed: 36, origin: 'Persian', age: 'elder' },
  { dress: 'guard', sex: 'm', role: 'guard', seed: 12, origin: 'Persian' },
  { dress: 'median', sex: 'm', role: 'official', seed: 31, origin: 'Median' },
  { dress: 'median', sex: 'm', role: 'guard', seed: 13, origin: 'Median' },
  { dress: 'worker', sex: 'm', role: 'mason', seed: 14, origin: 'Persian' },
  { dress: 'worker', sex: 'm', role: 'porter', seed: 24, origin: 'Egyptian' },
  { dress: 'worker', sex: 'm', role: 'mason', seed: 51, origin: 'Babylonian', age: 'elder' },
  { dress: 'worker', sex: 'm', role: 'porter', seed: 52, origin: 'Thracian' },
  { dress: 'woman', sex: 'f', role: 'grinder', seed: 21, origin: 'Persian' },
  { dress: 'woman', sex: 'f', role: 'baker', seed: 22, origin: 'Elamite', age: 'elder' },
  { dress: 'woman', sex: 'f', role: 'grinder', seed: 53, origin: 'Ionian' },
  { dress: 'child', sex: 'm', role: 'child', seed: 23, origin: 'Persian' },
  { dress: 'child', sex: 'f', role: 'child', seed: 54, origin: 'Egyptian' },
  { dress: 'envoy', sex: 'm', role: 'envoy', seed: 55, delegation: 'lydians', origin: 'Lydian' },
  { dress: 'envoy_short', sex: 'm', role: 'envoy', seed: 56, delegation: 'scythians', origin: 'Scythian' },
  { dress: 'envoy_bare', sex: 'm', role: 'envoy', seed: 57, delegation: 'indians', origin: 'Indian' },
  { dress: 'envoy', sex: 'm', role: 'envoy', seed: 58, delegation: 'kushites', origin: 'Kushite' },
  { dress: 'king', sex: 'm', role: 'king', seed: 59, origin: 'Persian' },
  { dress: 'court_woman', sex: 'f', role: 'court', seed: 60, origin: 'Persian' },
];
const SPACING = 1.8, DIST = 1.5, DAY = 25, NIGHT_HOUR = 22;
const TAG0 = process.env.TAG ? `${process.env.TAG}-` : '';
// VARIANTS: comma list of page variants, each its own load in the same run ('noscans' = the procedural skin and weave, D-295's A/B)
const VARIANTS = (process.env.VARIANTS ?? 'scans').split(',');
const FOV = process.env.FOV && process.env.FOV !== 'game' ? +process.env.FOV : 60;
for (const VAR of VARIANTS) test(`portraits (${VAR}): 20 people at 1.5 m by day and by fire light, and crowds`, async ({ page }) => {
  const TAG = VARIANTS.length > 1 ? `${TAG0}${VAR}-` : TAG0;
  test.setTimeout(+(process.env.TIMEOUT ?? 3000) * 1000);
  mkdirSync('shots/portraits', { recursive: true });
  await page.setViewportSize({ width: +(process.env.W ?? 1920), height: +(process.env.H ?? 1080) });
  const t0 = Date.now(), el = () => `${((Date.now() - t0) / 1000).toFixed(0)} s`;
  const errs: string[] = []; page.on('pageerror', e => errs.push(String(e))); page.on('console', m => { if (m.type() === 'error') errs.push(`${m.type()}: ${m.text().slice(0, 300)}`); });
  await page.goto(`/humanlab.html?test&quality=${process.env.Q ?? 'high'}&hour=10&day=${DAY}&fov=${FOV}${VAR === 'noscans' ? '&noscans' : ''}`);
  await page.waitForFunction(() => (window as any).__lab?.ready === true || (window as any).__lab?.error, null, { timeout: 2_400_000 });
  expect(await page.evaluate(() => (window as any).__lab.error ?? null)).toBeNull();
  console.log('load', el());
  const only = process.env.ONLY?.split(',') ?? null;
  const stats: Record<string, any> = {};
  const shoot = async (n: string, frames = 10) => {
    await page.evaluate(f => (window as any).__lab.render(f), frames);
    stats[n] = await page.evaluate(() => (window as any).__lab.stats());
    await page.screenshot({ path: `shots/portraits/${TAG}${n}.png` });
    console.log(n, el());
  };
  const want = (n: string) => !only || only.some(o => n.startsWith(o));
  const lineup = async () => {
    await page.evaluate(() => (window as any).__lab.view(0, 1.5, 4, 0, 1.2, 0));
    const r = await page.evaluate(([s, sp]) => (window as any).__lab.lineup(s, sp), [PEOPLE, SPACING] as const);
    stats.lineup = r;
  };
  const portraits = async (tag: string, fire: boolean) => {
    for (let i = 0; i < PEOPLE.length; i++) {
      const p = PEOPLE[i], n = `${tag}-${String(i).padStart(2, '0')}-${p.dress}-${p.role}${p.age ? '-' + p.age : ''}`;
      if (!want(n)) continue;
      const f = await page.evaluate(([k, d]) => (window as any).__lab.frameFace(k, d, 0), [i, DIST] as const);
      // the brazier 1.3 m to the person's right and 0.9 m in front, its flame centre at 1.37 m (fire.ts: brazier)
      const x = (i - (PEOPLE.length - 1) / 2) * SPACING;
      await page.evaluate(([on, x]) => (window as any).__lab.fire(on ? [x - 1.3, 1.37, 0.9] : null), [fire, x] as const);
      stats[n] = { eyeY: f?.eyeY };
      await shoot(n);
    }
  };
  await lineup();
  await page.evaluate(([d]) => (window as any).__lab.setTime(d, 10), [DAY]);
  await portraits('day', false);
  const crowd = async (n: string, near: number, far: number, cam: number[], tgt: number[]) => {
    if (!want(n)) return;
    await page.evaluate(([c, t]) => (window as any).__lab.view(c[0], c[1], c[2], t[0], t[1], t[2]), [cam, tgt]);
    await page.evaluate(([a, b]) => { const L = (window as any).__lab, cr = L.crowd; cr.removeExtras();
      const dresses = ['guard', 'median', 'persian', 'worker', 'woman', 'child', 'worker', 'woman'], anims = ['walk', 'idle', 'talk', 'walk', 'idle', 'walk', 'carry_shoulder', 'talk'];
      for (let i = 0; i < 300; i++) { const dress = dresses[i % dresses.length], d = a + (b - a) * Math.sqrt((i + 0.5) / 300), ang = (((i * 0.618) % 1) - 0.5) * 1.2;
        cr.addExtra(`s${i}`, { id: -100 - i, sex: dress === 'woman' ? 'f' : 'm', role: dress === 'guard' ? 'guard' : dress === 'child' ? 'child' : dress === 'woman' ? 'grinder' : 'mason', dress, seed: 5000 + i, x: d * Math.sin(ang), y: 0, z: 4 - d * Math.cos(ang), yaw: i * 2.4, anim: anims[i % anims.length], look: null }); } }, [near, far]);
    await shoot(n, 12);
  };
  await crowd('crowd-near-day', 2, 20, [0, 1.6, 4], [0, 1.2, -10]);
  await crowd('crowd-far-day', 20, 120, [0, 1.6, 4], [0, 1.0, -40]);
  // by night: the lineup again, each by a brazier; then the near crowd round a brazier
  await page.evaluate(([d, h]) => (window as any).__lab.setTime(d, h), [DAY, NIGHT_HOUR]);
  await lineup();
  await portraits('fire', true);
  await page.evaluate(() => (window as any).__lab.fire([1.2, 1.37, -1]));
  await crowd('crowd-near-fire', 2, 20, [0, 1.6, 4], [0, 1.2, -10]);
  writeFileSync(`shots/portraits/${TAG}stats.json`, JSON.stringify(stats, null, 1));
  console.log('done', el());
  console.log(errs.slice(0, 20).join('\n'));
  expect(errs).toEqual([]);
});
