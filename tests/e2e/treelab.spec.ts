import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
// Tree lab (dev page): the tree kit alone under the game's sky, tone mapping and pipeline. Screenshots find problems
// (shots/treelab-*.png); the r3 check measures: one tree of a species drawn as the near LOD1 and as the far impostor
// from the same camera at the near radius, each against an empty frame: silhouette area (pixels that differ) and the
// mean colour inside it (shots/treelab-r3.json). Env: Q (quality, default test), ONLY (comma list of shots; default all).
const { PNG } = createRequire(import.meta.url)('playwright-core/lib/utilsBundle');
const R3: Record<string, number> = { test: 160, low: 200, medium: 220, high: 250, ultra: 320 };
const BIG = ['plane', 'poplar', 'willow', 'cypress', 'mulberry'], SMALL = ['tamarisk', 'fig', 'apple', 'pear', 'pomegranate', 'oak', 'almond', 'pistachio', 'olive', 'vine'];
const rows = (lod: 0 | 1 | 'imp' = 0) => [...BIG.map((sp, i) => ({ sp, x: (i - 2) * 17, z: -22, lod })), ...SMALL.map((sp, i) => ({ sp, x: (i - 4.5) * 8, z: 0, lod }))];
// [name, day, hour, trees, camera, target]
const SHOTS: [string, number, number, any[], number[], number[]][] = [
  ['rows-summer', 80, 10, rows(), [0, 1.6, 34], [0, 5, -5]],
  ['rows-april', 0, 10, rows(), [0, 1.6, 34], [0, 5, -5]],
  ['rows-winter', 280, 11, rows(), [0, 1.6, 34], [0, 5, -5]],
  ['near-plane', 80, 10, [{ sp: 'plane', x: 0, z: 0, lod: 0 }], [3, 1.6, 11], [0, 9, 0]],
  ['near-apple-april', 0, 10, [{ sp: 'apple', x: 0, z: 0, lod: 0 }], [1, 1.6, 5.5], [0, 3, 0]],
  ['lod-trio', 80, 10, ['plane', 'poplar', 'apple'].flatMap((sp, i) => [0, 1, 'imp'].map((lod, j) => ({ sp, x: (j - 1) * 24 + (sp === 'apple' ? 0 : 0), z: -i * 30, lod }))), [0, 1.6, 45], [0, 6, -20]],
];
const decode = (buf: Buffer) => PNG.sync.read(buf) as { width: number; height: number; data: Buffer };
/** pixels inside the box that differ from the empty frame (sum of |dRGB| > 18) and their mean colour */
function maskStats(img: ReturnType<typeof decode>, empty: ReturnType<typeof decode>, box: number[]) {
  let n = 0; const c = [0, 0, 0]; const d = img.data, e = empty.data, W = img.width;
  for (let y = Math.max(0, box[1]); y <= Math.min(img.height - 1, box[3]); y++) for (let x = Math.max(0, box[0]); x <= Math.min(W - 1, box[2]); x++) { const i = (y * W + x) * 4;
    if (Math.abs(d[i] - e[i]) + Math.abs(d[i + 1] - e[i + 1]) + Math.abs(d[i + 2] - e[i + 2]) <= 18) continue; n++; c[0] += d[i]; c[1] += d[i + 1]; c[2] += d[i + 2]; }
  return { px: n, rgb: c.map(v => +(v / Math.max(1, n)).toFixed(1)) };
}
test('tree lab', async ({ page }, info) => {
  test.setTimeout(840_000);
  const errs: string[] = []; page.on('pageerror', e => errs.push(String(e))); page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(`${m.type()}: ${m.text().slice(0, 300)}`); });
  const Q = process.env.Q ?? 'test', only = process.env.ONLY?.split(',');
  await page.goto(`/treelab.html?test&quality=${Q}`);
  await page.waitForFunction(() => (window as any).__lab?.ready === true || (window as any).__lab?.error, null, { timeout: 600_000 });
  expect(await page.evaluate(() => (window as any).__lab.error ?? null)).toBeNull();
  console.log('load', JSON.stringify(await page.evaluate(() => ({ kit: (window as any).__lab.kitMs, total: (window as any).__lab.totalMs }))));
  const L = (fn: string, ...a: any[]) => page.evaluate(([f, args]) => (window as any).__lab[f as string](...(args as any[])), [fn, a] as [string, any[]]);
  for (const [n, day, hour, trees, c, t] of SHOTS) {
    if (only && !only.includes(n)) continue;
    await L('setTime', day, hour); await L('place', trees); await L('view', ...c, ...t); await L('render', 3);
    console.log(n, JSON.stringify(await L('stats')));
    await page.screenshot({ path: `shots/treelab-${n}-${Q}-${info.project.name}.png` });
  }
  // near/far at the near radius: the same tree as LOD1 (just inside r3) and as the impostor (just outside)
  if (!only || only.includes('r3')) {
    const r3 = R3[Q] ?? 160, out: Record<string, any> = {};
    for (const [sp, day] of [['plane', 80], ['poplar', 80], ['willow', 80], ['apple', 0], ['oak', 80], ['plane', 280], ['cypress', 80]] as [string, number][]) {
      await L('setTime', day, 10); await L('view', 0, 1.6, r3, 0, 6, 0);
      const shot = async (lod: any) => { await L('place', lod === null ? [] : [{ sp, x: 0, z: 0, lod }]); await L('render', 3); return decode(await page.screenshot()); };
      // the tree's box on screen (+4 px), and an empty frame right before each view (the clouds drift between frames)
      const sz = await L('size', sp), box = (await L('project', -sz.w * 0.75, -0.5, -sz.w * 0.75, sz.w * 0.75, sz.h * 1.1, sz.w * 0.75)) as number[];
      box[0] -= 4; box[1] -= 4; box[2] += 4; box[3] += 4;
      const e1 = await shot(null), near = await shot(1), e2 = await shot(null), far = await shot('imp');
      const a = maskStats(near, e1, box), b = maskStats(far, e2, box);
      const key = `${sp}@day${day}`; out[key] = { r3, lod1: a, impostor: b, areaRatio: +(b.px / Math.max(1, a.px)).toFixed(3), dRGB: a.rgb.map((v, k) => +(b.rgb[k] - v).toFixed(1)) };
      console.log('r3', key, JSON.stringify(out[key]));
      if (sp === 'plane' && day === 80) { const png = new PNG({ width: near.width * 2, height: near.height }); for (let y = 0; y < near.height; y++) { near.data.copy(png.data, y * near.width * 8, y * near.width * 4, (y + 1) * near.width * 4); far.data.copy(png.data, y * near.width * 8 + near.width * 4, y * near.width * 4, (y + 1) * near.width * 4); }
        writeFileSync(`shots/treelab-r3-plane-${Q}-${info.project.name}.png`, PNG.sync.write(png)); }
    }
    mkdirSync('shots', { recursive: true }); writeFileSync(`shots/treelab-r3-${Q}.json`, JSON.stringify(out, null, 1));
    // area for every case; mean colour for the leafy broadleaf crowns only. At test quality MSAA antialiases the near
    // LOD1's geometry edges (branch tubes, card quad edges at coarse mips) against the sky, while the impostor's
    // alpha-tested edges stay hard: a bare winter crown or a 5 px wide cypress is nearly all edge, and measured
    // 12-22/255 bluer as LOD1 (lab run 3). Measure those at high quality (TRAA treats both alike) before judging them.
    const leafy = ['plane@day80', 'poplar@day80', 'willow@day80', 'apple@day0', 'oak@day80'];
    for (const [k, v] of Object.entries(out)) { expect(Math.abs(v.areaRatio - 1), `${k} silhouette area impostor/LOD1`).toBeLessThan(0.2); if (leafy.includes(k)) for (const d of v.dRGB) expect(Math.abs(d), `${k} mean colour`).toBeLessThan(14); }
  }
  console.log(errs.slice(0, 20).join('\n'));
  expect(errs.filter(e => !e.startsWith('warning'))).toEqual([]);
});
