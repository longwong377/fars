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

import { cloudNoiseAtlas } from '../src/sky/cloudNoise';
describe('cloud noise atlas (2-D flattening of the volume)', () => {
  it('bilinear sampling inside atlas tiles + slice blend equals periodic trilinear sampling of the volume', () => {
    const n = 16, vol = cloudNoiseVolume(n, 3), { data, width: W, tile: T } = cloudNoiseAtlas(vol, n, 8);
    const texel = (x: number, y: number) => data[(y * W + x) * 4]; // channel R
    const bilinear = (u: number, v: number) => { const x = u * W - 0.5, y = v * W - 0.5, x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
      return (texel(x0, y0) * (1 - fx) + texel(x0 + 1, y0) * fx) * (1 - fy) + (texel(x0, y0 + 1) * (1 - fx) + texel(x0 + 1, y0 + 1) * fx) * fy; };
    const fr = (a: number) => a - Math.floor(a);
    const viaAtlas = (u: number, v: number, w: number) => { const z = fr(w) * n - 0.5, z0 = ((Math.floor(z) % n) + n) % n, z1 = (z0 + 1) % n, fz = z - Math.floor(z);
      const at = (zz: number) => { const tx = zz % 8, ty = Math.floor(zz / 8); return bilinear((tx * T + fr(u) * n + 1) / W, (ty * T + fr(v) * n + 1) / W); };
      return at(z0) * (1 - fz) + at(z1) * fz; };
    const vox = (x: number, y: number, z: number) => vol[((((z % n) + n) % n * n + ((y % n) + n) % n) * n + ((x % n) + n) % n) * 4];
    const direct = (u: number, v: number, w: number) => { const x = fr(u) * n - 0.5, y = fr(v) * n - 0.5, z = fr(w) * n - 0.5, x0 = Math.floor(x), y0 = Math.floor(y), z0 = Math.floor(z), fx = x - x0, fy = y - y0, fz = z - z0;
      let s = 0; for (const [dx, wx] of [[0, 1 - fx], [1, fx]]) for (const [dy, wy] of [[0, 1 - fy], [1, fy]]) for (const [dz, wz] of [[0, 1 - fz], [1, fz]]) s += vox(x0 + dx, y0 + dy, z0 + dz) * wx * wy * wz; return s; };
    let worst = 0; for (let i = 0; i < 2000; i++) { const u = (i * 0.61803) % 3 - 1, v = (i * 0.41421) % 3 - 1, w = (i * 0.2718) % 3 - 1; worst = Math.max(worst, Math.abs(viaAtlas(u, v, w) - direct(u, v, w))); }
    expect(worst).toBeLessThan(1e-6);
  });
});
