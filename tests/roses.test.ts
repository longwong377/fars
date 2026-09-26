// Session 9 (WORLD_INVENTORY G73): roses along the paradise's axis channel, blooming in May-June.
import { describe, it, expect } from 'vitest';
import { buildTownPlan } from '../src/world/settlement/plan';
import { RoseBeds, roseBloom } from '../src/world/groundFlora';

describe('roses in the paradise (session 9)', () => {
  it('the paradise site exists with a frame; points along its axis lie inside the garden, clear of the axis trees', () => {
    const plan = buildTownPlan(), site = plan.sites.find(s => s.meta.id === 'paradise')!; expect(site).toBeTruthy();
    const a = site.grid(-133, 1.7), b = site.grid(137, -1.7); expect(Math.hypot(a[0] - b[0], a[1] - b[1])).toBeGreaterThan(260); expect(Math.hypot(a[0] - b[0], a[1] - b[1])).toBeLessThan(280);
    const trees = site.fittings.filter(f => f.kind === 'tree' && Math.abs(f.v) < 5);
    for (let u = -133; u < 139; u += 2) for (const v of [-1.7, 1.7]) for (const t of trees) expect(Math.hypot(t.u - u, t.v - v), `${u},${v}`).toBeGreaterThan(1.2);
  }, 60000);
  it('bloom in May-June, a little in October, none in winter', () => { expect(roseBloom(5)).toBe(1); expect(roseBloom(4)).toBeGreaterThan(0.5); expect(roseBloom(9)).toBeGreaterThan(0.2); expect(roseBloom(0)).toBe(0);
    const r = new RoseBeds([{ e: 0, n: 0, y: 0, size: 1, rot: 0 }, { e: 2, n: 0, y: 0, size: 0.7, rot: 1 }]); expect(r.mesh.count).toBe(2); });
});
