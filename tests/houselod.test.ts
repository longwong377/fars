// D-324: the house kit finished and the houses' levels of detail (houses.ts, kit.ts, build.ts, villagehouses.ts). Headless:
//  - the kit's D-324 pieces exist at their triangle counts (the budgets were set on them), the eave pole keeps its end's relief
//    in radius units (yr), whatever its length;
//  - the middle ring (lod 1) is cheaper than the full near level on every tile, the full level holds the brick losses;
//  - the far level carries the parts it now draws (dark windows, the eave), for the town and the villages.
import { describe, it, expect, beforeAll } from 'vitest';
import { FireSystem } from '../src/world/fire';
import { Settlement } from '../src/world/settlement/build';
import { newHB, P } from '../src/world/settlement/houses';
import { KIT, kitNames } from '../src/world/settlement/kit';
import { loadTerrain } from './plainLib';
import { registerScanStandIns, VESSEL_IDS } from './lib/scanStandIns';
// Q-960: the houses' scan vessels at the triangles the browser draws (node cannot load the GLBs)
registerScanStandIns(VESSEL_IDS);

let town: Settlement;
beforeAll(() => { town = new Settlement(null, loadTerrain(), new FireSystem(0), 'test'); }, 300_000);

describe('the kit (D-324)', () => {
  it('every new piece in its variants at its triangle count; the eave pole carries its end in radius units', () => {
    const want: Record<string, [number, number]> = { plog: [3, 24], crestL: [3, 14], pebble: [3, 18], stone: [4, 56], sill: [2, 56], bench: [2, 82], rung: [2, 24], jamb: [2, 62], bpl: [3, 64], bbr: [3, 102] };
    for (const [k, [n, tris]] of Object.entries(want)) { const ns = kitNames(k); expect(ns.length, k).toBe(n); for (const q of ns) expect(KIT[q].tris, q).toBe(tris); }
    expect(kitNames('crest').length).toBe(3); // (crestL is its own piece, not a crest variant)
    for (const q of kitNames('plog')) { const yr = KIT[q].yr!; expect(yr.length).toBe(KIT[q].nv); expect(Math.min(...yr)).toBeLessThan(-0.1); expect(Math.max(...yr)).toBeLessThan(0.2); }
  });
});

describe('the near levels (D-324)', () => {
  it('the middle ring costs less than the full level on every tile of three quarters; the full level lays brick losses', () => {
    let full = 0, mid = 0, worse = 0; const hsList = town.houses.filter(h => ['q_s1', 'q_s3', 'q_w1'].includes(h.s.id));
    for (const hs of hsList) for (const t of hs.tiles.keys()) { const A = newHB(), B = newHB(); hs.buildTile(t, A, 0, 0); hs.buildTile(t, B, 0, 1);
      const a = Object.values(A).reduce((x, b) => x + b.tris, 0), b = Object.values(B).reduce((x, q) => x + q.tris, 0); full += a; mid += b; if (a > 2000 && b >= a) worse++; }
    const losses = hsList.reduce((x, h) => x + h.losses.size, 0);
    console.log(`[houselod] full ${(full / 1e3).toFixed(0)} k, middle ring ${(mid / 1e3).toFixed(0)} k (${(100 * mid / full).toFixed(0)} %), brick losses ${losses}`);
    expect(worse).toBe(0); expect(mid / full).toBeLessThan(0.85); expect(losses).toBeGreaterThan(100);
  }, 600_000);
});

describe('the far level (D-324)', () => {
  it('draws the windows dark and the eave with its pole band, on every quarter', () => {
    const parts = new Map<number, number>();
    town.group.traverse((o: any) => { if (!o.isMesh || !o.geometry?.getAttribute?.('tileId')) return; const n = o.geometry.index.count / 3;
      for (let f = 0; f < n; f++) { const d = o.userData.describe({ faceIndex: f }); if (d) parts.set(d.part ?? 0, (parts.get(d.part ?? 0) ?? 0) + 1); } });
    console.log(`[houselod] far parts: ${[...parts].map(([k, v]) => `${k}:${v}`).join(' ')}`);
    expect(parts.get(P.window) ?? 0).toBeGreaterThan(2000); expect(parts.get(P.eave) ?? 0).toBeGreaterThan(20000); expect(parts.get(P.fixture) ?? 0).toBeGreaterThan(1000);
  }, 300_000);
});
