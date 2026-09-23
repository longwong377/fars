import { test } from '@playwright/test';
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { lumStats } from './lib/lum';
// Camera-rig prototypes for §1.1 moments (fixed views; world state frozen via ?test&day&hour&weather).
const SHOTS: { n: string; day: number; hour: number; w: string; v: [number, number, number, number, number]; frames?: number }[] = [
  { n: 'dawn-stair-top', day: 0, hour: 5.85, w: 'clear', v: [-36.4, 122.45, 1.6, 251, -2] },
  { n: 'gate-dusk', day: 0, hour: 19.25, w: 'clear', v: [0.1, 118, 1.6, 341, 4] },
  { n: 'night-terrace', day: 5, hour: 22.5, w: 'clear', v: [0, 92, 1.6, 161, 6] },
  // moonless pre-dawn (day 1 = 18 Apr 467 BCE, the moon a thin crescent set in the evening): the Milky Way from Cygnus to
  // Sagittarius over the SE, seen from the Grand Stair top (D-047)
  { n: 'night-milkyway', day: 1, hour: 3.5, w: 'clear', v: [-36, 125, 1.6, 125, 28] },
  { n: 'brazier-close', day: 0, hour: 21.5, w: 'clear', v: [-36.4, 132, 1.6, 161, -8] },
  { n: 'apadana-hall-torch', day: 0, hour: 21, w: 'clear', v: [-8, 0, 4.6, 161, 6] },
  { n: 'rain-columns', day: 2, hour: 14, w: 'rain', v: [-20, 70, 1.6, 161, 4] },
  // §1.1 "rain moving across the plain toward the columns": day 12's rain episode reaches the Terrace at 06:01 from the
  // WSW (245°); at 05:40 its cell is ~6 km out over the plain (WeatherSystem.rainCell); seen from the Apadana W portico
  { n: 'rain-approach', day: 299, hour: 11.1, w: 'auto', v: [-38, -5, 1.6, 232, 3] }, // a heavy cell (14 mm) 15 km SW over the plain, seen out of the Apadana W portico, 50 min before it arrives (D-060, D-064)
  { n: 'apadana-enter', day: 25, hour: 11, w: 'clear', v: [1.9, 36, 1.6, 161, 2] },
  { n: 'reliefs-raking', day: 60, hour: 18.3, w: 'clear', v: [-30, 63.5, 1.6, 83, -3] }, // 4.5 m off the Apadana N stair façade, looking E along it: the low NW sun grazes the procession (session 3)
  { n: 'scribe-at-work', day: 25, hour: 10, w: 'clear', v: [196, -81.8, 1.7, 206, -14] },
  { n: 'stair-climb', day: 25, hour: 8.5, w: 'clear', v: [-43.9, 128, 1.6, 341, 12] },
  { n: 'snow-terrace', day: 280, hour: 10, w: 'snow', v: [-20, 70, 1.6, 161, 4] },
  // Phase 4: the rest of the Terrace
  { n: 'tachara-s-stair', day: 25, hour: 15.5, w: 'clear', v: [-21, -112, 1.6, 341, 6] },
  { n: 'hadish-hall', day: 25, hour: 11, w: 'clear', v: [22, -150, 1.6, 161, 2] },
  { n: 'hall100-site', day: 25, hour: 9.5, w: 'clear', v: [146, 45, 1.6, 161, 4] },
  { n: 'tripylon-n-stair', day: 25, hour: 16, w: 'clear', v: [82, -38, 1.6, 161, 6] },
  { n: 'harem-portico', day: 25, hour: 10, w: 'clear', v: [114, -114, 1.6, 161, 4] },
];
test('moments', async ({ page }, info) => {
  test.setTimeout(840_000); // under the 15-min watchdog; each view reloads the world for its date (≤ 3 views per run)
  const errs: string[] = []; page.on('pageerror', e => errs.push(String(e))); page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
  const only = process.env.ONLY?.split(',');
  for (const s of SHOTS) {
    if (only && !only.includes(s.n)) continue;
    await page.goto(`/?test&quality=${process.env.Q ?? 'test'}&day=${s.day}&hour=${s.hour}&weather=${s.w}`);
    await page.waitForFunction(() => (window as any).__parsa?.ready === true, null, { timeout: 600_000 });
    // the world is frozen in test mode: stop the animation loop, so the screenshot does not wait behind its frames under
    // SwiftShader (minutes each; the Phase 4 render helper found this, tests/e2e/lib/p4views.ts)
    await page.evaluate(() => (window as any).__parsa.renderer.setAnimationLoop(null));
    await page.evaluate(v => (window as any).__parsa.view(...v), s.v);
    for (let i = 0; i < (s.frames ?? 8); i++) await page.evaluate(() => (window as any).__parsa.renderOnce());
    const png = await page.screenshot({ path: `shots/moment-${s.n}-${info.project.name}.png` });
    // §8.3 luminance (display-referred sRGB luma): whole frame; appended to shots/moments-lum.json
    const lum = await lumStats(page, png); const exp = await page.evaluate(() => (window as any).__parsa.exposureInfo());
    mkdirSync('shots', { recursive: true }); const f = 'shots/moments-lum.json'; const all = existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : {};
    all[`${s.n}|${process.env.Q ?? 'test'}|${info.project.name}`] = { lum, exposure: +exp.exposure.toFixed(3), sunAlt: +exp.sunAlt.toFixed(1) }; writeFileSync(f, JSON.stringify(all, null, 1));
    console.log(s.n, JSON.stringify(lum));
  }
  console.log(errs.slice(0, 5).join('\n'));
});
