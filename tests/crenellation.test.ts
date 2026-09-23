// Stair-parapet crenellations (D-065, global.r_stair_crenellation): every listed stair carries merlons; each stands on a
// parapet block (on its mid-line, at the pitch) and never floats over a lower step; the mesh is one tiered instanced draw.
import { describe, it, expect } from 'vitest';
import { buildTerrace } from '../src/arch/terrace';
import { stairCrenellationPlan, buildStairCrenellations } from '../src/arch/decor';
import type { Box } from '../src/arch/parts';
import { v } from '../src/arch/spec';

const { parts } = buildTerrace();
const CR = v<any>('global', 'r_stair_crenellation');
const plan = stairCrenellationPlan(parts);
const blocks = parts.filter((p): p is Box => p.type === 'box' && p.kind === 'parapet' && !p.rot);

describe('stair crenellations', () => {
  it('every listed stair building carries merlons', () => {
    for (const b of CR.buildings) expect(plan.filter(q => q.building === b).length, b).toBeGreaterThan(8);
    expect(plan.some(q => q.building === 'terrace')).toBe(false); // the terrace edge stays plain (no source)
  });
  it('each merlon stands on the parapet under it: on its mid-line, never floating, never above the lowest block', () => {
    for (const q of plan) {
      const lat = 1 - q.axis, lo = q.c[q.axis] - CR.width / 2, hi = q.c[q.axis] + CR.width / 2;
      const under = blocks.filter(b => b.building === q.building && Math.abs(b.c[lat] - q.c[lat]) < 0.01
        && b.c[q.axis] + b.size[q.axis] / 2 > lo + 1e-3 && b.c[q.axis] - b.size[q.axis] / 2 < hi - 1e-3);
      expect(under.length, JSON.stringify(q)).toBeGreaterThan(0);
      const covered = under.reduce((s, b) => s + Math.min(hi, b.c[q.axis] + b.size[q.axis] / 2) - Math.max(lo, b.c[q.axis] - b.size[q.axis] / 2), 0);
      expect(covered, 'merlon over a gap').toBeGreaterThan(CR.width - 0.02);
      expect(q.y).toBeCloseTo(Math.min(...under.map(b => b.y1)), 6);
      expect(q.depth).toBeLessThanOrEqual(Math.min(under[0].size[lat], CR.max_depth) + 1e-9);
    }
  });
  it('merlons on one run are at the pitch and do not overlap', () => {
    const runs = new Map<string, number[]>();
    for (const q of plan) { const k = `${q.building}|${q.axis}|${q.c[1 - q.axis].toFixed(2)}`; (runs.get(k) ?? runs.set(k, []).get(k)!).push(q.c[q.axis]); }
    for (const [k, a] of runs) { a.sort((x, y) => x - y); for (let i = 1; i < a.length; i++) expect(a[i] - a[i - 1], k).toBeGreaterThanOrEqual(CR.width); }
  });
  it('one instanced draw, tier C with sources', () => {
    const m = buildStairCrenellations(parts)!;
    expect(m.count).toBe(plan.length);
    expect(m.userData.tier).toBe('C');
    m.geometry.computeBoundingBox(); const bb = m.geometry.boundingBox!;
    expect(bb.max.y - bb.min.y).toBeCloseTo(CR.height, 6); expect(bb.max.x - bb.min.x).toBeCloseTo(CR.width, 6);
    console.log(`merlons: ${plan.length} (${CR.buildings.map((b: string) => `${b} ${plan.filter(q => q.building === b).length}`).join(', ')}), ${m.geometry.index ? m.geometry.index.count / 3 : m.geometry.attributes.position.count / 3} tris each`);
  });
});
