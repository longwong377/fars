import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { SCAN_USE, scanIds } from '../src/render/scans';
import SCANS from '../src/data/scans.json';
// D-303 (T-A7 on the town and the villages, node side): every surface the town's and villages' meshes are drawn with has a
// scan applied at a strength that reads (T-A7's anti-proxy: alb >= 0.3), and every scan it names is shipped and measured.
// The pixel share on renders is tests/e2e/town_real.spec.ts (shots/town-real-stats.json, TA7).
const TOWN_SURFACES = ['house_plaster', 'house_socle', 'house_timber', 'house_brick', 'mud_plaster', 'stone_plain', 'takht_stone', 'refuse', 'road', 'bank', 'baked_brick', 'litter'];
describe('scans: the town and the villages (D-303)', () => {
  it('every surface of the town and villages has a scan at alb >= 0.3', () => {
    for (const s of TOWN_SURFACES) { const u = SCAN_USE[s]; expect(u, s).toBeTruthy(); expect(u.alb, s).toBeGreaterThanOrEqual(0.3); if (u.top) expect(u.top.alb, s + ' top').toBeGreaterThanOrEqual(0.3); }
  });
  it('the source surfaces use them (surfaceMaterial names in settlement/ and plain/village*)', () => {
    const src = ['src/world/settlement/build.ts', 'src/world/settlement/water.ts', 'src/world/settlement/ajori.ts', 'src/world/settlement/towndoors.ts', 'src/world/plain/villagehouses.ts'].map(f => readFileSync(f, 'utf8')).join('\n');
    const used = new Set([...src.matchAll(/surfaceMaterial\('(\w+)'/g)].map(m => m[1]));
    for (const s of used) expect(TOWN_SURFACES, `${s} (add it to TOWN_SURFACES and give it a scan)`).toContain(s);
  });
  it('every scan named is shipped (diff, arm; nor where used) and measured in scans.json', () => {
    const meta = SCANS as Record<string, { meanLinear: number[] }>;
    for (const { id, col, nor } of scanIds()) {
      if (col) { expect(existsSync(`public/textures/${id}/diff.jpg`), id).toBe(true); expect(existsSync(`public/textures/${id}/arm.jpg`), id).toBe(true); expect(meta[id]?.meanLinear?.length, id).toBe(3); }
      if (nor) expect(existsSync(`public/textures/${id}/nor.jpg`), id + ' nor').toBe(true);
    }
  });
});
