// §13.2 rendered plan overlay: top-down orthographic render of each building's generated outline vs its georeferenced
// footprint (OSM; Schmidt's plan unavailable — BLOCKERS B6). Pass: IoU ≥ 0.95 and centroid offset < 0.5 m.
import { test, expect } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
const FP = JSON.parse(readFileSync('src/data/geo/footprints.json', 'utf8'));
function pip(x: number, y: number, p: number[][]) { let ins = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const [xi, yi] = p[i], [xj, yj] = p[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) ins = !ins; } return ins; }
const CASES: [string, string, string[] | null][] = [
  ['apadana', 'apadana', ['platform']], ['gate_nations', 'gate_nations', ['wall', 'floor']], ['tachara', 'tachara', ['platform']], ['hadish', 'hadish', ['platform']],
  ['hall100', 'hall100', ['floor', 'wall']], ['tripylon', 'tripylon', ['platform']], ['treasury', 'treasury', ['floor']], ['harem', 'harem', ['floor']],
  ['garrison', 'garrison', ['floor']], ['grand_stair', 'grand_stair', ['step', 'landing', 'pavement', 'parapet']],
];
test('rendered plan overlay', async ({ page }, info) => {
  await page.goto(`/?test&quality=test${info.project.name === 'webgl2' ? '&webgl=1' : ''}`);
  await page.waitForFunction(() => (window as any).__parsa?.ready === true, null, { timeout: 300_000 });
  const results: any = { backend: await page.evaluate(() => (window as any).__parsa.backend), buildings: {} };
  for (const [b, fk, kinds] of CASES) {
    const m = await page.evaluate(([b, k]) => (window as any).__parsa.planMask(b, k), [b, kinds] as any);
    const poly = FP[fk].polygon;
    let inter = 0, uni = 0, ax = 0, ay = 0, an = 0, bx = 0, by = 0, bn = 0;
    for (let r = 0; r < m.H; r++) for (let c = 0; c < m.W; c++) {
      const x = m.x0 + (c + 0.5) * m.res, y = m.y1 - (r + 0.5) * m.res;
      const a = m.bits[r * m.W + c] === '1', f = pip(x, y, poly);
      if (a || f) uni++; if (a && f) inter++; if (a) { ax += x; ay += y; an++; } if (f) { bx += x; by += y; bn++; }
    }
    const iou = inter / uni, off = an ? Math.hypot(ax / an - bx / bn, ay / an - by / bn) : 999;
    results.buildings[b] = { iou: +iou.toFixed(4), offset: +off.toFixed(3) };
  }
  writeFileSync(`shots/plan-overlay-${info.project.name}.json`, JSON.stringify(results, null, 1));
  console.log(JSON.stringify(results));
  for (const [b, r] of Object.entries<any>(results.buildings)) { expect(r.iou, b).toBeGreaterThanOrEqual(0.95); expect(r.offset, b).toBeLessThan(0.5); }
});
