import { describe, it, expect } from 'vitest';
import { airLightRadiance, hgPhase, HALL_DUST_SIGMA, HALL_DUST_G } from '../src/render/airlight';

// D-156 (triage item 15): sunlit dust in the halls' air (CPU mirror of the pass's in-scatter).
describe('hall air light (D-156)', () => {
  it('the dust is within the brief\'s range for halls and scatters forward', () => {
    expect(HALL_DUST_SIGMA).toBeGreaterThanOrEqual(1e-4); expect(HALL_DUST_SIGMA).toBeLessThanOrEqual(5e-4);
    expect(hgPhase(Math.cos(0.3), HALL_DUST_G)).toBeGreaterThan(10 * hgPhase(Math.cos(2.5), HALL_DUST_G));
    // the phase function is normalised over the sphere
    let s = 0; const N = 2000; for (let i = 0; i < N; i++) { const t = ((i + 0.5) / N) * Math.PI; s += hgPhase(Math.cos(t), HALL_DUST_G) * 2 * Math.PI * Math.sin(t) * (Math.PI / N); }
    expect(s).toBeCloseTo(1, 2);
  });
  it('at a hall\'s adapted exposure a sunbeam shows against the shaded hall, far below the sunlit floor patch it falls on', () => {
    // noon sun (renderer units, D-115) and the Apadana hall's adapted exposure (D-141: 241–295 in the session-4 renders)
    const sunE = 2.4, X = 260, floorPatch = (0.2 * sunE * 0.9) / Math.PI;
    const side = X * airLightRadiance(sunE, 0, 4), toward = X * airLightRadiance(sunE, Math.cos(20 * Math.PI / 180), 10);
    const hallShade = X * (0.2 * 0.8 * 0.003) / Math.PI; // a hall floor under ~0.3 % of the open-ground skylight (D-110)
    expect(side).toBeGreaterThan(0.2 * hallShade); expect(side).toBeLessThan(0.05 * X * floorPatch);
    expect(toward).toBeGreaterThan(5 * side);
  });
});
