import { describe, it, expect } from 'vitest';
import * as THREE from 'three/webgpu';
import { buildTerrace } from '../src/arch/terrace';
import { buildMeshes, InstancedLOD } from '../src/arch/meshes';
import type { Column } from '../src/arch/parts';
import { Construction } from '../src/people/construction';
import { ConstructionView } from '../src/world/construction';

// Phase 5: the Hall of 100 Columns follows the simulation's construction state (src/world/construction.ts)
describe('construction view (Hall of 100 Columns)', () => {
  const { parts } = buildTerrace();
  const lods = (g: THREE.Object3D, prefix: string) => { const out: InstancedLOD[] = []; g.traverse(o => { if (o instanceof InstancedLOD && o.name.startsWith(prefix)) out.push(o); }); return out; };
  /** instance heights (the LOD rule's `at` height) by position, from the view */
  const heights = (ls: InstancedLOD[]) => { const m = new Map<string, number>(); for (const l of ls) { const at = (l as any).at as Float32Array; for (let i = 0; i < at.length; i += 4) m.set(`${at[i].toFixed(2)},${at[i + 2].toFixed(2)}`, at[i + 3]); } return m; };

  it('at day 0 the view draws exactly the columns the architecture drew, shafts within half a drum', () => {
    const arch = buildMeshes(parts);
    const cols = parts.filter(p => p.type === 'column' && p.building === 'hall100') as Column[];
    const C = new Construction(1); const view = new ConstructionView(arch.group, () => C);
    expect(lods(arch.group, 'hall100:columns').length).toBe(0); // the static columns are gone
    const ha = heights(lods(view.group, 'hall100:construction'));
    expect(ha.size).toBe(cols.length); expect(C.columns.length).toBe(cols.length);
    const o = cols[0].order, shaftH = o.height - o.baseH - o.capitalH;
    let worst = 0;
    for (const p of cols) {
      const hit = [...ha].find(([k]) => { const [x, z] = k.split(',').map(Number); return Math.hypot(x - p.c[0], z + p.c[1]) < 0.05; });
      expect(hit, `${p.c}`).toBeTruthy();
      const drawn = hit![1] - (p.built >= 1 ? o.capitalH : 0), was = o.baseH + shaftH * p.built; // shaft tops
      worst = Math.max(worst, Math.abs(drawn - was));
    }
    console.log(`hall100: ${cols.length} columns → ${lods(view.group, 'hall100:construction').length} state groups; worst shaft-top difference ${worst.toFixed(2)} m (drum ${(shaftH / C.columns[0].drumsTotal).toFixed(2)} m)`);
    expect(worst).toBeLessThanOrEqual(shaftH / C.columns[0].drumsTotal / 2 + 1e-3);
  });
  it('rebuilds when the simulation raises drums, and only then', () => {
    const arch = buildMeshes(parts); const C = new Construction(1); const view = new ConstructionView(arch.group, () => C);
    expect(view.rebuilds).toBe(1); expect(view.sync()).toBe(false);
    const h0 = heights(lods(view.group, 'hall100:construction'));
    let set = 0;
    for (let d = 0; d < 120; d++) for (const e of C.step(d, { stone: 60, labour: 80, brick: 20, frost: false, wet: false, storm: false })) if (e.kind === 'drum_set') set++;
    expect(set).toBeGreaterThan(0);
    expect(view.sync()).toBe(true); expect(view.rebuilds).toBe(2);
    const h1 = heights(lods(view.group, 'hall100:construction'));
    let grew = 0; for (const [k, h] of h1) { expect(h, k).toBeGreaterThanOrEqual(h0.get(k)! - 1e-6); if (h > h0.get(k)! + 0.5) grew++; }
    console.log(`after 120 days: ${set} drums set, ${grew} column(s) visibly taller`);
    expect(grew).toBeGreaterThan(0);
  });
});
