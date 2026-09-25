// D-223 (rubric s7 pass 2, fix 9): the plain seen from the Terrace. The worn paths as a branching net instead of a star of
// ruled lines to the stair foot; the irrigated land's fallow share by district (800 m blocks at any distance); what the
// stair-noon-plain view holds (tools/dev/plain_view_census.ts). Headless.
import { describe, it, expect } from 'vitest';
import { buildTownPlan } from '../src/world/settlement/plan';
import { desireLines, laneExtras } from '../src/world/plain/townGround';
import { plotAt, irrigatedScale, IRR_STEPS, IRR_FALLOW_SPREAD, unit, hash2 } from '../src/world/plain/fields';
import { census } from '../tools/dev/plain_view_census';

describe('worn paths merge into a net (townGround.ts desireLines)', () => {
  const plan = buildTownPlan(), L = desireLines(plan), stair = laneExtras()[0];
  it('at most two runs end at the stair foot (the D-190 star had twelve); the rest join the approach, the roads or another path', () => {
    const atStair = L.filter(l => Math.hypot(l.b[0] - stair[0], l.b[1] - stair[1]) < 1 || Math.hypot(l.a[0] - stair[0], l.a[1] - stair[1]) < 1);
    console.log({ runs: L.length, atStair: atStair.length });
    expect(atStair.length).toBeLessThanOrEqual(2);
    expect(L.length).toBeGreaterThan(15); expect(L.length).toBeLessThan(120);
  });
  it('in the stair-noon-plain view (grid W ±33° from the landing) no run points at the camera (radial within 12°)', () => {
    const cam = [-36.4, 122.45]; let radial = 0, inView = 0;
    for (const l of L) { const mx = (l.a[0] + l.b[0]) / 2 - cam[0], my = (l.a[1] + l.b[1]) / 2 - cam[1];
      const bearing = Math.atan2(my, -mx) * 180 / Math.PI; if (Math.abs(bearing) > 33 || Math.hypot(mx, my) > 3000) continue; inView++;
      const dx = l.b[0] - l.a[0], dy = l.b[1] - l.a[1], c = Math.abs(dx * mx + dy * my) / (Math.hypot(dx, dy) * Math.hypot(mx, my));
      if (c > Math.cos(12 * Math.PI / 180) && Math.hypot(dx, dy) > 150) radial++; }
    console.log({ inView, radial }); expect(radial).toBe(0);
  });
});

describe('irrigated fallow by district (fields.ts irrigatedScale)', () => {
  it('the fallow share keeps the data mean (20 %) over the plain and ranges 8-32 % between districts', () => {
    let fallow = 0, n = 0; const perD = new Map<string, Map<number, number>>();
    for (let i = 0; i < 120000; i++) { const x = -6000 + ((i * 7919) % 12000) + (i % 7) * 0.37, z = -6000 + ((i * 104729) % 12000) + (i % 11) * 0.53, p = plotAt(x, z);
      const hc = unit(hash2(p.h, 7, 41)), f = hc >= Math.fround(IRR_STEPS[3] * irrigatedScale(p.dc)) ? 1 : 0; fallow += f; n++;
      const k = p.dc.join(','), q = perD.get(k) ?? new Map<number, number>(); q.set(p.h, f); perD.set(k, q); } // each plot once per district
    expect(Math.abs(fallow / n - (1 - IRR_STEPS[3]))).toBeLessThan(0.01);
    // each district's expected share is 1 − 0.8 × its scale: 8-32 %; the plots drawn follow it (correlation over districts)
    const rows = [...perD.entries()].filter(([, q]) => q.size > 30).map(([k, q]) => { const dc = k.split(',').map(Number) as [number, number];
      return [1 - IRR_STEPS[3] * irrigatedScale(dc), [...q.values()].reduce((a, b) => a + b, 0) / q.size]; });
    const ex = rows.map(r => r[0]), ob = rows.map(r => r[1]), m = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
    const me = m(ex), mo = m(ob), cov = m(rows.map(r => (r[0] - me) * (r[1] - mo))), sd = (a: number[], mu: number) => Math.sqrt(m(a.map(v => (v - mu) ** 2)));
    const corr = cov / (sd(ex, me) * sd(ob, mo));
    console.log({ districts: rows.length, expected: [Math.min(...ex).toFixed(3), Math.max(...ex).toFixed(3)], corr: corr.toFixed(2) });
    expect(Math.min(...ex)).toBeGreaterThanOrEqual(1 - IRR_STEPS[3] - IRR_FALLOW_SPREAD - 1e-9); expect(Math.max(...ex)).toBeLessThanOrEqual(1 - IRR_STEPS[3] + IRR_FALLOW_SPREAD + 1e-9);
    expect(Math.max(...ex) - Math.min(...ex)).toBeGreaterThan(0.18); expect(corr).toBeGreaterThan(0.4);
  });
});

describe('the stair-noon-plain view (plain_view_census.ts)', () => {
  it('fields hold most of the plain\'s ground out to 2.5 km and keep their plots\' contrast to 1 km; worn paths are a sliver; the town\'s houses are resolved', () => {
    const c = census(['stair-noon-plain'])['stair-noon-plain'];
    console.log(JSON.stringify(c));
    const sum = (o: Record<string, number> | undefined) => Object.values(o ?? {}).reduce((a, b) => a + b, 0);
    const fields = sum(c.classes['field:irrigated']) + sum(c.classes['field:rainfed']) + sum(c.classes['field:orchard']);
    const ground = Object.entries(c.classes).filter(([k]) => k !== 'terrace' && k !== 'hill').reduce((a, [, v]) => a + sum(v as any), 0);
    expect(fields / ground).toBeGreaterThan(0.4);
    expect(c.plotKeep['200-500']).toBeGreaterThan(0.9); expect(c.plotKeep['500-1k']).toBeGreaterThan(0.8);
    expect(sum(c.classes['worn path']) / ground).toBeLessThan(0.01);
    const [n, res] = (c.objects['town roofed plot']['500-1k'] as string).split('/').map(Number); expect(n).toBeGreaterThan(100); expect(res).toBe(n);
  }, 180_000);
});
