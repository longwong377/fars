import { test } from '@playwright/test';
// Camera-rig prototypes for §1.1 moments (fixed views; world state frozen via ?test&day&hour&weather).
const SHOTS: { n: string; day: number; hour: number; w: string; v: [number, number, number, number, number]; frames?: number }[] = [
  { n: 'dawn-stair-top', day: 0, hour: 5.85, w: 'clear', v: [-36.4, 122.45, 1.6, 251, -2] },
  { n: 'gate-dusk', day: 0, hour: 19.25, w: 'clear', v: [0.1, 118, 1.6, 341, 4] },
  { n: 'night-terrace', day: 5, hour: 22.5, w: 'clear', v: [0, 92, 1.6, 161, 6] },
  { n: 'brazier-close', day: 0, hour: 21.5, w: 'clear', v: [-36.4, 132, 1.6, 161, -8] },
  { n: 'apadana-hall-torch', day: 0, hour: 21, w: 'clear', v: [-8, 0, 4.6, 161, 6] },
  { n: 'rain-columns', day: 2, hour: 14, w: 'rain', v: [-20, 70, 1.6, 161, 4] },
  { n: 'apadana-enter', day: 25, hour: 11, w: 'clear', v: [1.9, 36, 1.6, 161, 2] },
  { n: 'reliefs-raking', day: 60, hour: 18.3, w: 'clear', v: [-20, 72, 1.6, 161, 2] },
  { n: 'scribe-at-work', day: 25, hour: 10, w: 'clear', v: [196, -80.5, 1.7, 206, -14] },
  { n: 'stair-climb', day: 25, hour: 8.5, w: 'clear', v: [-43.9, 128, 1.6, 341, 12] },
  { n: 'snow-terrace', day: 280, hour: 10, w: 'snow', v: [-20, 70, 1.6, 161, 4] },
];
test('moments', async ({ page }, info) => {
  const errs: string[] = []; page.on('pageerror', e => errs.push(String(e))); page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
  const only = process.env.ONLY?.split(',');
  for (const s of SHOTS) {
    if (only && !only.includes(s.n)) continue;
    await page.goto(`/?test&quality=${process.env.Q ?? 'test'}&day=${s.day}&hour=${s.hour}&weather=${s.w}`);
    await page.waitForFunction(() => (window as any).__parsa?.ready === true, null, { timeout: 600_000 });
    await page.evaluate(v => (window as any).__parsa.view(...v), s.v);
    for (let i = 0; i < (s.frames ?? 8); i++) await page.evaluate(() => (window as any).__parsa.renderOnce());
    await page.screenshot({ path: `shots/moment-${s.n}-${info.project.name}.png` });
  }
  console.log(errs.slice(0, 5).join('\n'));
});
