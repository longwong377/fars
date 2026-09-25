// Weather you can see (D-219; rubric pass 2 weather 1/5, fix-list item 4, R6): wet stone, snow lying on what faces up, the
// ground under the approaching rain cell wet and in its cloud's shadow, rain streaks and snowflakes that resolve on screen.
// The math of each term, from the CPU mirrors the shaders follow (materials.ts, clouds.ts, weatherVfx.ts, skySystem.ts).
import { describe, it, expect } from 'vitest';
import { WeatherSystem } from '../src/weather/weatherState';
import { wetAlbedoFactor, snowMaskCPU, cellWetness } from '../src/render/materials';
import { minPixel, nearFade, densityPerM3, RAIN_VOL, SNOW_VOL, RAIN_W, FLAKE } from '../src/world/weatherVfx';
import { groundRho, GROUND_RHO } from '../src/sky/skySystem';
import { cellShadowAt, CLOUD_BASE } from '../src/sky/clouds';
import { azAltToWorld } from '../src/sky/ephemeris';

describe('wet surfaces', () => {
  it('a rain day (the forced rain of the rain-columns moment) darkens up-facing limestone by ~17 % and earth by ~45 %', () => {
    const W = new WeatherSystem(1); W.override = 'rain'; const c = W.conditions(2, 14);
    expect(c.wetness).toBe(1);
    expect(wetAlbedoFactor(c.wetness, 0.35, 1)).toBeCloseTo(0.825, 3); // limestone, porosity 0.35
    expect(wetAlbedoFactor(c.wetness, 0.9, 1)).toBeCloseTo(0.55, 3); // earth, porosity 0.9
    expect(wetAlbedoFactor(c.wetness, 0.35, 0)).toBeGreaterThan(wetAlbedoFactor(c.wetness, 0.35, 1)); // walls less than floors
    expect(wetAlbedoFactor(c.wetness, 0.35, 1, 1)).toBe(1); // dry under a roof
    expect(wetAlbedoFactor(0, 0.9, 1)).toBe(1); // dry day: unchanged
  });
  it('the ground is dry ahead of the day\'s rain and wet once it falls (rain-approach: day 299, the rain at 11:56)', () => {
    const W = new WeatherSystem(1);
    expect(W.conditions(299, 11.45).wetness).toBeLessThan(0.02); // yesterday dry: 0.48 before (wetted by the rain to come)
    expect(W.conditions(299, 13).wetness).toBe(1);
    expect(W.conditions(299, 23).wetness).toBeGreaterThan(0.9);
  });
  it('the ground under the approaching cell is wet out to its radius, dry beyond 1.2 R', () => {
    expect(cellWetness(0, 6000, 0.96)).toBeCloseTo(0.96, 6);
    expect(cellWetness(3000, 6000, 0.96)).toBeCloseTo(0.96, 6);
    expect(cellWetness(7300, 6000, 0.96)).toBe(0);
    expect(cellWetness(0, 6000, 0)).toBe(0); // no cell
  });
});

describe('the darkening front', () => {
  it('the rain cell\'s cloud shades the plain under it, displaced away from the sun; beyond 1.25 R the sun is back', () => {
    const W = new WeatherSystem(1), cell = W.rainCell(299, 11.45)!, [dx, , dz] = azAltToWorld(cell.bearingTrueDeg, 0);
    const C: [number, number, number, number] = [dx * cell.distanceM, dz * cell.distanceM, cell.radiusM, cell.intensity];
    const sun = azAltToWorld(180, 40), off = (CLOUD_BASE + 12) / Math.tan((40 * Math.PI) / 180); // the plain ~12 m under the court
    const under: [number, number, number] = [C[0] - sun[0] / Math.hypot(sun[0], sun[2]) * off, -12, C[1] - sun[2] / Math.hypot(sun[0], sun[2]) * off];
    expect(cellShadowAt(under, sun, C)).toBeLessThan(0.2);
    expect(cellShadowAt([C[0] + 2 * C[2], -12, C[1]], sun, C)).toBe(1);
    expect(cellShadowAt(under, sun, [C[0], C[1], C[2], 0])).toBe(1); // no cell
  });
});

describe('snow cover', () => {
  it('the snow moment lies on floors, merlon tops and ledges (≥ 60 %) and not on walls; none on a dry day', () => {
    const W = new WeatherSystem(1); W.override = 'snow'; const c = W.conditions(280, 10);
    expect(c.snowCover).toBeGreaterThanOrEqual(0.6);
    for (const n of [-1, 0, 1]) expect(snowMaskCPU(c.snowCover, 1, n)).toBeGreaterThanOrEqual(0.6); // flat, any noise
    expect(snowMaskCPU(c.snowCover, 0, 0)).toBe(0); // a wall
    expect(snowMaskCPU(c.snowCover, 1, 0, 1)).toBe(0); // under a roof
    W.override = 'clear'; expect(snowMaskCPU(W.conditions(150, 12).snowCover, 1, -1)).toBe(0);
  });
  it('snow on the ground whitens the light from below (the snow render\'s brown fill)', () => {
    const r0 = groundRho(0), r1 = groundRho(1);
    expect(r0).toEqual(GROUND_RHO);
    expect(Math.min(...r1)).toBeGreaterThan(0.8);
    expect(r1[2] / r1[0]).toBeGreaterThan(1); expect(r0[2] / r0[0]).toBeLessThan(1); // brown → faintly blue-white
  });
});

describe('streaks and flakes', () => {
  const pxAngle = (2 * Math.tan((46 * Math.PI) / 360)) / 540; // the rig's 24 mm lens at 540 lines
  it('never under a pixel on screen, with their light conserved', () => {
    for (const d of [1, 5, 12]) { const m = minPixel(RAIN_W, d, pxAngle); expect(RAIN_W * m.scale).toBeGreaterThanOrEqual(d * pxAngle - 1e-9); expect(m.scale * m.fade).toBeCloseTo(1, 9); }
    expect(minPixel(FLAKE, 1, pxAngle).scale).toBe(1); // a flake 1 m off is 7 px: drawn at its size
  });
  it('nothing lens-sized: no flake within 0.5 m, full from 1.5 m', () => {
    expect(nearFade(0.3)).toBe(0); expect(nearFade(1.5)).toBe(1); expect(nearFade(1)).toBeGreaterThan(0);
    // a flake at 0.5 m on a 540-line frame at 46°: 0.012 / (0.5 · pxAngle) ≈ 17 px — the old 0.03 m diamond at 0.1 m was ~200 px
    expect(FLAKE / (0.5 * pxAngle)).toBeLessThan(20);
  });
  it('denser than before: rain ≥ 4×, snow ≥ 10× per cubic metre at the same quality', () => {
    const n = 1500, old = densityPerM3(n, { R: 18, H: 14 });
    expect(densityPerM3(n, RAIN_VOL) / old).toBeGreaterThanOrEqual(4);
    expect(densityPerM3(2 * n, SNOW_VOL) / old).toBeGreaterThanOrEqual(10);
  });
});
