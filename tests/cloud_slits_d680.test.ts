// D-680: the cloud noise tiles every 7 km, so a view ray running along a lattice axis (world x or z) sampled one periodic
// column of it again and again: where that column was empty the deck showed a clear slit reaching the horizon, and such
// slits converged on the axis's horizon point (the night "fan of light streaks", cov-000). The base shapes' lookup is now
// warped by the weather field (CLOUD.warp). Measured over 40 observers, near-horizon rays (5-11 deg) within 2.3 deg of an
// axis vs 30 deg off: clear (T > 0.3) 5.4 % vs 1.9 % unwarped (2.9x), 3.3 % vs 2.7 % warped 12 km.
import { describe, it, expect } from 'vitest';
import { density, localCoverageUniform } from '../src/sky/cloudCover';
import coverTable from '../src/data/cloud_cover_table.json';

/** the deck's transmittance along a ray from (x, z) at azimuth az (rad from +z) and elevation el (rad), marched as the shader */
function trans(x: number, z: number, az: number, el: number, cov: number): number {
  const d = [Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)], t0 = 1500 / d[1], t1 = Math.min(3600 / d[1], t0 + 22000);
  let T = 1; for (let t = t0 + 60; t < t1 && T > 0.001; t += 120) T *= Math.exp(-density(x + d[0] * t, d[1] * t, z + d[2] * t, cov) * 120);
  return T;
}
describe('D-680 cloud slits along the noise lattice', () => {
  it('near-horizon rays along the world axes are not much clearer than rays 30 deg off them', () => {
    const cov = localCoverageUniform(0.25, (coverTable as any).dome, 1);
    const clear = (offDeg: number) => { let n = 0, c = 0;
      for (let k = 0; k < 40; k++) { const x = (k * 7919) % 46000 - 23000, z = (k * 104729) % 46000 - 23000;
        for (const ax of [0, 90, 180, 270]) for (let j = -20; j <= 20; j++) for (const el of [5, 8, 11]) {
          n++; if (trans(x, z, ((ax + offDeg) * Math.PI) / 180 + j * 0.002, (el * Math.PI) / 180, cov) > 0.3) c++; } }
      return c / n; };
    const onAxis = clear(0), offAxis = clear(30);
    expect(onAxis, `clear on axis ${onAxis.toFixed(4)}, off ${offAxis.toFixed(4)}`).toBeLessThan(offAxis * 1.6);
  }, 900_000);
});
