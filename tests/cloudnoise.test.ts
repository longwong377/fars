import { describe, it, expect } from 'vitest';
import { cloudNoiseVolume, worleyTile, valueTile } from '../src/sky/cloudNoise';
describe('cloud noise volumes (tileable 3-D Perlin–Worley / Worley)', () => {
  it('tiles seamlessly: opposite faces agree to the same degree as neighbouring voxels', () => {
    for (const f of [(x: number, y: number, z: number) => worleyTile(x, y, z, 8, 3), (x: number, y: number, z: number) => valueTile(x, y, z, 8, 3)]) {
      let seam = 0, inner = 0; const n = 200, e = 1e-4;
      for (let i = 0; i < n; i++) { const y = (i * 0.618) % 1, z = (i * 0.414) % 1;
        seam = Math.max(seam, Math.abs(f(1 - e, y, z) - f(e, y, z))); inner = Math.max(inner, Math.abs(f(0.5 - e, y, z) - f(0.5 + e, y, z))); }
      expect(seam).toBeLessThan(0.01); expect(inner).toBeLessThan(0.01);
    }
  });
  it('builds a 64³ RGBA volume quickly, using the full value range in every channel', () => {
    const t0 = performance.now(); const v = cloudNoiseVolume(64); const ms = performance.now() - t0;
    console.log(`cloud noise 64³: ${ms.toFixed(0)} ms`);
    expect(v.length).toBe(64 ** 3 * 4); expect(ms).toBeLessThan(3000);
    for (let c = 0; c < 4; c++) { let lo = 255, hi = 0; for (let i = c; i < v.length; i += 4) { lo = Math.min(lo, v[i]); hi = Math.max(hi, v[i]); } expect(hi - lo, `channel ${c}`).toBeGreaterThan(120); }
  });
});
