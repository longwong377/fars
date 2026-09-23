import { describe, it, expect } from 'vitest';
import { dataItems, buildMapLayers, BuiltTown, BuiltPlain } from '../src/ui/mapLayers';
import settlement from '../src/data/settlement.json';
import plain from '../src/data/plain.json';
import { buildTownPlan } from '../src/world/settlement/plan';

// the out-of-world map (translation layer) draws what the world builds, tiered, and nothing absent in 467
describe('map layers', () => {
  const all = [...(settlement as any).features, ...(plain as any).features];
  it('every present feature with a point, line or area is on the map; no absent one is', () => {
    const ids = new Set(dataItems().map(i => i.id.split('#')[0]));
    for (const f of all) {
      const geo = f.xy || f.polygon || f.polyline || f.polylines;
      if (f.present_467 === true && geo) expect(ids.has(f.id), f.id).toBe(true);
      if (f.present_467 !== true) expect(ids.has(f.id), f.id).toBe(false);
    }
    expect(ids.has('istakhr')).toBe(false); expect(ids.has('frataraka_complex')).toBe(false);
  });
  it('every item carries a tier and finite grid coordinates within the far terrain', () => {
    for (const it of dataItems()) {
      expect(['A', 'B', 'C']).toContain(it.tier);
      for (const [e, n] of it.pts) { expect(Number.isFinite(e) && Number.isFinite(n), it.id).toBe(true); expect(Math.max(Math.abs(e), Math.abs(n)), it.id).toBeLessThan(72000); }
    }
  });
  it('built rivers, roads and villages replace the data ones; town plots become rectangles', () => {
    const town: BuiltTown = {
      sites: [{ id: 'q1', meta: { kind: 'quarter' }, u0: -5, v0: -5, grid: (u, v) => [1000 + u, 2000 + v], plots: [{ kind: 'house', rect: [0, 0, 4, 3] }] }],
      roads: [{ id: 'road_pasargadae', pts: [[0, 0], [10, 10]], width: 6 }], water: [],
    };
    const pl: BuiltPlain = { rivers: [{ id: 'river_pulvar', x: [0, 1, 2, 3, 4, 5], y: [0, 0, 0, 0, 0, 0] }], canals: [], villages: [{ id: 'v1', name: 'Tukrash', x: 5, y: 6, r: 80, tier: 'C' }] };
    const L = buildMapLayers({ town, plain: pl });
    expect(L.filter(i => i.id.startsWith('river_pulvar')).length).toBe(1); // the built course only
    expect(L.filter(i => i.id === 'road_pasargadae').length).toBe(1);
    expect(L.filter(i => i.style === 'village').map(i => i.id)).toEqual(['v1']);
    const plot = L.find(i => i.id === 'q1:house')!; expect(plot.pts).toEqual([[995, 1995], [999, 1995], [999, 1998], [995, 1998]]);
  });
  it('the real town plan draws (every plot a finite rectangle; roads and water as built)', () => {
    const L = buildMapLayers({ town: buildTownPlan() as any });
    const plotsDrawn = L.filter(i => i.id.includes(':') && i.kind === 'area');
    expect(plotsDrawn.length).toBeGreaterThan(1000);
    for (const it of plotsDrawn) for (const [e, n] of it.pts) expect(Number.isFinite(e) && Number.isFinite(n)).toBe(true);
    expect(L.some(i => i.style === 'road' && i.id.startsWith('road_'))).toBe(true);
  });
});
