// Stair-parapet crenellations (D-065, global.r_stair_crenellation): every listed stair carries merlons; each stands on a
// parapet block (on its mid-line, at the pitch) and never floats over a lower step; the mesh is one tiered instanced draw.
import { describe, it, expect } from 'vitest';
import { buildTerrace } from '../src/arch/terrace';
import { stairCrenellationPlan, buildStairCrenellations, crenellationGeometry, merlonSlot } from '../src/arch/decor';
import * as THREE from 'three/webgpu';
import spec from '../src/data/site_spec.json';
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

// D-230: the double-rebated vertical slot in each face of every merlon (apadana.r_merlon_slot, measured on photograph #29)
describe('merlon slot (D-230)', () => {
  const S = merlonSlot(), w = 0.9, h = 0.9, D = 0.45;
  const geo = crenellationGeometry(w, h, 4, D), mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  const hitZ = (x: number, y: number, front: boolean) => {
    const rc = new THREE.Raycaster(new THREE.Vector3(x, y, front ? 5 : -5), new THREE.Vector3(0, 0, front ? -1 : 1));
    const hit = rc.intersectObject(mesh)[0]; return hit ? hit.point.z : NaN;
  };
  it('is in the spec with its source and tier (widths, heights B from the photograph; depths C)', () => {
    const row = (spec as any).apadana.r_merlon_slot; expect(row.tier).toBe('B/C'); expect(row.src).toMatch(/REF-PHOTO-29/);
    expect(S.outer_w).toBeGreaterThan(S.inner_w); expect(S.outer_h).toBeGreaterThan(S.inner_h); expect(S.faces).toBe(2);
    expect(2 * (S.outer_d + S.inner_d)).toBeLessThan(0.8); // a web remains between the two faces' slots
  });
  it('rays into each face meet the face, the outer rebate and the inner slot at their depths; the outline is unchanged', () => {
    geo.computeBoundingBox(); const b = geo.boundingBox!;
    expect(b.max.x - b.min.x).toBeCloseTo(w, 5); expect(b.max.y - b.min.y).toBeCloseTo(h, 5); expect(b.max.z - b.min.z).toBeCloseTo(D, 5);
    const zo = S.outer_d * D, zi = (S.outer_d + S.inner_d) * D, xr = ((S.outer_w / 2 + S.inner_w / 2) * w) / 2;
    for (const front of [true, false]) {
      const face = (z: number) => (front ? D - z : z);
      expect(hitZ(0.3 * w, 0.2 * h, front), 'the face beside the slot').toBeCloseTo(face(0), 3);
      expect(hitZ(0, 0.8 * h, front), 'the face above the slot').toBeCloseTo(face(0), 3);
      expect(hitZ(xr, 0.2 * h, front), 'the outer rebate beside the inner slot').toBeCloseTo(face(zo), 4);
      expect(hitZ(0, ((S.inner_h + S.outer_h) / 2) * h, front), 'the outer rebate above the inner slot').toBeCloseTo(face(zo), 4);
      expect(hitZ(0, 0.5 * S.inner_h * h, front), 'the inner slot').toBeCloseTo(face(zi), 4);
      expect(hitZ(0, 0.02, front), 'open at the foot').toBeCloseTo(face(zi), 4);
    }
  });
  it('stays inside the merlons\' triangle budget', () => {
    const tris = (g: THREE.BufferGeometry) => (g.index ? g.index.count : g.attributes.position.count) / 3;
    const solid = tris(crenellationGeometry(w, h, 4, D, null)), slotted = tris(geo);
    console.log(`merlon triangles: ${solid} solid (D-188) → ${slotted} with the slot (D-230)`);
    expect(slotted).toBeLessThanOrEqual(240);
  });
});
