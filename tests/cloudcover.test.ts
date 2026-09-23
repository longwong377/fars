import { describe, it, expect } from 'vitest';
import { columnCover, coverageUniform, discCover, localWeatherFactor, localCoverageUniform, domeCover, domeCoverAt } from '../src/sky/cloudCover';
import table from '../src/data/cloud_cover_table.json';

// D-064: the cloud layer draws the weather's cloud fraction (the shader's coverage uniform, calibrated by measurement)
describe('cloud cover calibration', () => {
  it('the stored table matches a fresh coarse measurement of the shader density (±0.08) and is monotone', () => {
    for (const c of [0.35, 0.45, 0.55]) { const i = table.cov.indexOf(c); expect(i, `${c}`).toBeGreaterThan(0); expect(Math.abs(columnCover(c, 24, 20) - table.frac[i]), `${c}`).toBeLessThan(0.08); }
    for (let i = 1; i < table.frac.length; i++) expect(table.frac[i]).toBeGreaterThanOrEqual(table.frac[i - 1]);
  });
  it('the inverse draws the requested fraction: 0.2 scattered, 0.5 broken, 0.76 mostly cloudy, 0.95 overcast (±0.05)', () => {
    for (const f of [0.2, 0.5, 0.76, 0.95]) {
      const u = coverageUniform(f, table as any); const got = columnCover(u, 24, 20);
      expect(Math.abs(got - f), `cover ${f}: uniform ${u.toFixed(3)} drew ${got.toFixed(3)}`).toBeLessThan(0.05);
    }
    expect(coverageUniform(0, table as any)).toBe(0);
  });
  it('over an observer anywhere in the weather tile, the sky draws the requested cover (±0.08 on a disc of 12 km)', () => {
    let worst = 0;
    for (const [x, z] of [[0, 0], [9000, 17000], [23000, 5000], [31000, 38000], [41000, 12000]]) for (const f of [0.05, 0.3, 0.76]) {
      const u = localCoverageUniform(f, (table as any).local, localWeatherFactor(x, z)), got = discCover(u, x, z, 12000, 16, 16);
      worst = Math.max(worst, Math.abs(got - f));
    }
    console.log('worst local cover error', worst.toFixed(3)); expect(worst).toBeLessThan(0.08);
  });
  // D-145: the weather's cover is what an observer reports, the fraction of the sky DOME covered; near the horizon the sides
  // of many clouds overlap, so a clear sky needs a much lower column cover than the old (column) inversion gave
  it('the dome table matches a fresh coarse measurement (±0.08) and is monotone', () => {
    const D = (table as any).dome;
    for (const c of [0.38, 0.45, 0.55]) { const i = D.c.indexOf(c); expect(i, `${c}`).toBeGreaterThan(0); expect(Math.abs(domeCover(c, 4, 16, 20) - D.frac[i]), `${c}`).toBeLessThan(0.08); }
    for (let i = 1; i < D.frac.length; i++) expect(D.frac[i]).toBeGreaterThanOrEqual(D.frac[i - 1]);
  });
  it('a "clear" day (0.05) draws a nearly clear dome over an observer; 0.5 draws about half the dome (mean of five observers)', () => {
    const at = [[0, 0], [9000, 17000], [23000, 5000], [31000, 38000], [41000, 12000]];
    const mean = (f: number) => at.reduce((s, [x, z]) => s + domeCoverAt(localCoverageUniform(f, (table as any).dome, localWeatherFactor(x, z)), x, z, 16, 20), 0) / at.length;
    const clear = mean(0.05), half = mean(0.5);
    console.log('dome cover: clear', clear.toFixed(3), 'broken', half.toFixed(3));
    expect(clear).toBeLessThan(0.12); expect(Math.abs(half - 0.5)).toBeLessThan(0.15);
    // the old column inversion drew a quarter of the dome on a clear day
    expect(domeCoverAt(localCoverageUniform(0.05, (table as any).local, localWeatherFactor(0, 0)), 0, 0, 16, 20)).toBeGreaterThan(clear);
  });
});
