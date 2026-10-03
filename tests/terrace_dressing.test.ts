// D-750 (C10, s18): the Terrace at 100-300 m: the stepped merlons on every palace roof line and the Terrace's edge, the
// glazed bands under the palaces' string courses, the porticoes' hangings and the royal standards. Render geometry only.
import { describe, it, expect } from 'vitest';
import { buildTerrace } from '../src/arch/terrace';
import { roofEdges, CROWN_SKIP } from '../src/arch/roofedge';
import { crownPlan } from '../src/arch/decor';
import { palaceBandFaces, buildGlazedFrieze } from '../src/arch/glazed';
import { buildDressings, porchBays, standardPlaces } from '../src/arch/dressings';

const { parts } = buildTerrace();
const R = roofEdges(parts);

describe('D-750 the Terrace dressed for distance', () => {
  it('every palace roof line and the Terrace edge carry merlons; the fortification, garrison and Treasury do not', () => {
    const cp = crownPlan(parts), by = new Set(cp.map(c => c.building));
    for (const b of ['gate_nations', 'apadana', 'tachara', 'hadish', 'terrace']) expect(by.has(b), b).toBe(true);
    expect(cp.some(c => CROWN_SKIP.test(c.building))).toBe(false);
    expect(cp.length).toBeGreaterThan(2500); expect(cp.length).toBeLessThan(4500); // the triangle budget: ~204 tris each at the near level
    // no two merlons of one building overlap (the pitch, the corners kept clear)
    const g = new Map<string, typeof cp>(); for (const c of cp) (g.get(c.building) ?? g.set(c.building, []).get(c.building)!).push(c);
    for (const [b, list] of g) { let close = 0; for (let i = 0; i < list.length; i++) for (let j = i + 1; j < Math.min(list.length, i + 400); j++)
      if (Math.abs(list[i].y - list[j].y) < 0.5 && Math.hypot(list[i].e - list[j].e, list[i].n - list[j].n) < 0.85) close++;
      expect(close, b).toBe(0); }
    expect(roofEdges(parts)).toBe(R); // cached per parts array
  });
  it('the glazed bands sit under the string course of the palaces\' wall runs', () => {
    const f = palaceBandFaces(parts); expect(f.length).toBeGreaterThan(8);
    for (const x of f) { expect(x.y1 - x.y0).toBeGreaterThan(1.5); expect(['gate_nations', 'tachara', 'hadish']).toContain(x.tower); }
  });
  it('the porticoes carry hangings between their front-row columns and the standards fly over the gate and the halls', () => {
    const bays = porchBays(parts); expect(bays.filter(b => b.building === 'apadana').length).toBe(15);
    for (const b of bays) { expect(b.yTop).toBeGreaterThan(b.y0 + 3); expect(Math.hypot(b.b.c[0] - b.a.c[0], b.b.c[1] - b.a.c[1])).toBeLessThan(12); }
    const st = standardPlaces(parts); expect(st.filter(s => s.building === 'gate_nations').length).toBe(4); expect(st.filter(s => s.building === 'apadana').length).toBe(4);
    const g = buildDressings(parts)!; let tris = 0; g.traverse((o: any) => { if (o.isMesh) { tris += o.userData.tris; expect(o.userData.tier).toBe('C'); } });
    expect(tris).toBeLessThan(40000); expect(g.userData.windows).toBeGreaterThan(30);
    const f = buildGlazedFrieze(parts)!; expect(f.getObjectByName('c10:dressings')).toBeTruthy(); expect(f.getObjectByName('palace-glazed-bands')).toBeTruthy();
    for (const p of parts) expect(['c10:dressings'].includes((p as any).kind)).toBe(false);
  });
});
