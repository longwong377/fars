// D-302 (T-A7, UD-17): every land cover the ground materials draw has its own scan, laid at a weight that reads (the
// threshold's anti-proxy: alb >= 0.3), with measured means; no cover is a procedural stand-in where a scan exists. Headless:
// the audit is over the code's tables (src/render/scans.ts GROUND, SCAN_USE; src/data/scans.json), not a render.
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { GROUND, SCAN_USE } from '../src/render/scans';
import SCANS from '../src/data/scans.json';

const META = SCANS as unknown as Record<string, { meanLinear: number[]; tileMetres?: number; meanDisp?: number }>;
const src = (f: string) => readFileSync(f, 'utf8');

describe('the ground layers (D-302)', () => {
  it('every cover names a scan on disk with its measured means', () => {
    for (const [cover, id] of Object.entries(GROUND)) {
      expect(existsSync(`public/textures/${id}/diff.jpg`), `${cover}: ${id}/diff.jpg`).toBe(true);
      expect(META[id]?.meanLinear?.length, `${cover}: ${id} in scans.json`).toBe(3);
      expect(Math.min(...META[id].meanLinear)).toBeGreaterThan(0);
    }
  });
  it('the terrain, the river banks, the canal banks and the tracks lay the ground scans (none left on the earth\'s single scan)', () => {
    for (const f of ['src/world/plain/terrainPlain.ts', 'src/world/plain/rivers.ts', 'src/world/plain/ribbons.ts']) {
      const s = src(f), mats = s.match(/surfaceMaterial\('earth'[^)]*variant: '(plain|riverbank|canalbank|track)'[^)]*\)/g) ?? [];
      for (const m of mats) expect(m, f).toContain('scan: false');
      expect(s).toContain('groundScan(');
    }
    // each of the plain's covers is used in the terrain material, at the shared weight (0.85) or more
    const t = src('src/world/plain/terrainPlain.ts');
    for (const cover of ['dust', 'stony', 'packed', 'straw', 'green', 'tilled', 'mud', 'cracked', 'rock', 'rockFar', 'scree']) expect(t, cover).toContain(`groundScan('${cover}'`);
    expect(t).toMatch(/const GW = 0\.85/);
  });
  it('every SCAN_USE surface lays its scan at a weight that reads (alb >= 0.3)', () => {
    for (const [name, u] of Object.entries(SCAN_USE)) { expect(u.alb, name).toBeGreaterThanOrEqual(0.3); expect(META[u.scan], `${name}: ${u.scan}`).toBeTruthy(); }
  });
  it('the earth is no longer the cracked dry-ground scan (the brief: cracks everywhere was wrong)', () => {
    expect(SCAN_USE.earth.scan).not.toBe('dry_ground_01');
  });
});
