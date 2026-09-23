import { describe, it, expect } from 'vitest';
import { marchCPU, sunScatter, K_MS, ambientAt, layerRadiance } from '../src/sky/cloudLight';

// D-156 (triage item 12): the clouds' multiple-scattering octaves and their calibration, on the CPU mirror of the shader.
const D = Math.PI / 180;
describe('cloud light (D-156)', () => {
  it('K_MS makes a thick layer (τ 20) lit at 40° reflect like a Lambertian surface of albedo ~0.75 seen from the sunward side', () => {
    const lambert = Math.sin(40 * D) / Math.PI, ratios: string[] = []; let sum = 0, n = 0;
    for (const e of [-30, -60, -85]) for (const phi of [180, 120]) { const r = layerRadiance(0.02, 1000, 40, e, phi) / lambert; ratios.push(`e ${e} φ ${phi}: ${r.toFixed(2)}`); sum += r; n++; }
    const mean = sum / n;
    expect(mean, ratios.join(', ')).toBeGreaterThan(0.6); expect(mean, ratios.join(', ')).toBeLessThan(0.9);
  });
  it('the octaves carry light deeper than single scattering, and the calibration is not a flat factor on single scattering', () => {
    // deep in the cloud (optical depth 6 toward the sun) the octave sum keeps far more than e^-6 of the single-scatter light
    const single = (c: number, tau: number) => sunScatter(c, 0) * Math.exp(-tau);
    expect(sunScatter(-0.5, 6) / single(-0.5, 6)).toBeGreaterThan(10);
    expect(K_MS).toBeGreaterThan(1);
  });
  it('seen from below, the base of a thick layer is darker than its sunlit top (grey bases), and thin cloud lets the sky through', () => {
    const top = layerRadiance(0.02, 1000, 40, -60, 180), base = layerRadiance(0.02, 1000, 40, 60, 180, false);
    expect(base).toBeLessThan(top * 0.6);
    const thin = marchCPU({ t0: 0, t1: 200, cosT: 0, density: () => 0.002, densitySun: () => 0.002, hAt: () => 0.5, sunE: 1, skyL: 0, groundL: 0 });
    expect(thin.T).toBeGreaterThan(0.5);
  });
  it('the ambient is half the sky\'s radiance at the top of the layer and half the ground\'s at its base', () => {
    expect(ambientAt(1, 0.2, 0.1)).toBeCloseTo(0.1, 9); expect(ambientAt(0, 0.2, 0.1)).toBeCloseTo(0.05, 9);
  });
});
