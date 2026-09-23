// Calibration of the volumetric cloud layer's cover (session 3, D-064). The shader's `coverage` uniform is not a sky
// fraction: measured, a weather cover of 0.76 drew a solid deck. This file ports the shader's density to the CPU (same
// noise volume, same trilinear wrap sampling, same height profile, weather field and erosion as src/sky/clouds.ts) and
// measures the fraction of vertical columns whose optical depth exceeds 1 over one weather tile, for a range of uniform
// values. The measured curve is stored (src/data/cloud_cover_table.json, tools/build_cloud_cover.ts) and inverted at
// runtime, so the weather's cloud fraction becomes the fraction of sky the layer actually covers (as vertical columns;
// the observed sky cover includes cloud sides seen near the horizon and is somewhat larger, C).
import { cloudNoiseVolume } from './cloudNoise';
import { airOptics, opticalDepth, type AirOptics } from './aerial';
import { marchDepth } from './cloudLight';

export const CLOUD = { base: 1500, top: 3600, baseTile: 7000, weatherTile: 46000, detailTile: 1400, n: 64 } as const;
const smooth = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const remap = (v: number, a: number, b: number, c: number, d: number) => ((v - a) / Math.max(b - a, 1e-4)) * (d - c) + c;

let VOL: Uint8Array | null = null;
/** trilinear wrap sample of the noise volume at uvw (period 1), texel centres at (i + 0.5) / n, as the shader's atlas does */
export function sample3(u: number, v: number, w: number): [number, number, number, number] {
  const n = CLOUD.n; VOL ??= cloudNoiseVolume(n);
  const f = (t: number) => { const x = (((t % 1) + 1) % 1) * n - 0.5, i = Math.floor(x); return [((i % n) + n) % n, (((i + 1) % n) + n) % n, x - i] as const; };
  const [x0, x1, fx] = f(u), [y0, y1, fy] = f(v), [z0, z1, fz] = f(w);
  const out: [number, number, number, number] = [0, 0, 0, 0];
  for (let c = 0; c < 4; c++) {
    const at = (x: number, y: number, z: number) => VOL![((z * n + y) * n + x) * 4 + c] / 255;
    const l = (a: number, b: number, t: number) => a + (b - a) * t;
    out[c] = l(l(l(at(x0, y0, z0), at(x1, y0, z0), fx), l(at(x0, y1, z0), at(x1, y1, z0), fx), fy), l(l(at(x0, y0, z1), at(x1, y0, z1), fx), l(at(x0, y1, z1), at(x1, y1, z1), fx), fy), fz);
  }
  return out;
}
/** the shader's density (per metre) at world (x, z) and height y above the observer, for the coverage uniform `cov` */
/** `fixedC`: use this effective cover everywhere instead of cov × the weather field (the local-cover calibration) */
export function density(x: number, y: number, z: number, cov: number, fixedC?: number): number {
  const h = clamp01((y - CLOUD.base) / (CLOUD.top - CLOUD.base));
  const lo = sample3(x / CLOUD.baseTile, y / CLOUD.baseTile, z / CLOUD.baseTile)[0];
  const weather = sample3(x / CLOUD.weatherTile, 0.37, z / CLOUD.weatherTile)[0];
  const top = 0.35 + lo * 0.6;
  const shape = smooth(0, 0.06, h) * (1 - smooth(top * 0.7, top, h));
  const c = fixedC !== undefined ? clamp01(fixedC) : clamp01(cov * (weather * 0.8 + 0.6));
  const base = clamp01(remap(lo * shape, 1 - c, 1, 0, 1)) * c;
  const hi = sample3(x / CLOUD.detailTile, y / CLOUD.detailTile, z / CLOUD.detailTile), hf = hi[1] * 0.625 + hi[2] * 0.25 + hi[3] * 0.125;
  const erode = (hf + ((1 - hf) - hf) * clamp01(h * 4)) * 0.35;
  return clamp01(remap(base, erode, 1, 0, 1)) * 0.02;
}
/** fraction of vertical columns with optical depth > 1, over one weather tile (grid × grid columns, `steps` samples each) */
export function columnCover(cov: number, grid = 64, steps = 32, fixedC?: number): number {
  let covered = 0; const dy = (CLOUD.top - CLOUD.base) / steps;
  for (let i = 0; i < grid; i++) for (let j = 0; j < grid; j++) {
    const x = ((i + 0.5) / grid) * CLOUD.weatherTile, z = ((j + 0.5) / grid) * CLOUD.weatherTile;
    let tau = 0; for (let k = 0; k < steps && tau <= 1; k++) tau += density(x, CLOUD.base + (k + 0.5) * dy, z, cov, fixedC) * dy;
    if (tau > 1) covered++;
  }
  return covered / (grid * grid);
}
/** Fraction of the sky DOME an observer sees covered (session 4, D-145), for a fixed effective cover c: rays uniform in
 *  solid angle above the shader's horizon cut (dir.y > 0.015), marched as the shader marches them (t0 = base / dir.y,
 *  t1 = min(top / dir.y, t0 + 22 km), `steps` samples) from `obs` observer positions spread over one weather tile; a ray is
 *  (marched as the shader marches it since D-156: fixed steps from the cloud base, a longer stride through empty air)
 *  covered when its opacity, times the transmittance of the air between the eye and the cloud base (the aerial perspective,
 *  aerial.ts, D-156: the shader weighs the cloud's own light by it), exceeds one half. This is how cloud
 *  cover is observed (the fraction of the celestial dome, in oktas): near the horizon the sides of many clouds overlap,
 *  so the dome cover is far larger than the vertical-column cover for the same layer. */
/** the clear-day air (the weather's clear-day haze 0.25) the calibration is measured through */
export const CLEAR_AIR = airOptics({ haze: 0.25 });
/** transmittance (550 nm) of the air from an eye on the Terrace (1,626.6 m asl) to the cloud base along a ray of
 *  elevation sine `sy` (the shader's fade, D-156) */
export const airToBase = (sy: number, air: AirOptics = CLEAR_AIR) => { const z0 = 1626.6; return Math.exp(-opticalDepth(air, z0, z0 + CLOUD.base, CLOUD.base / sy)[1]); };
export function domeCover(c: number, obs = 12, dirs = 24, steps = 32, air: AirOptics = CLEAR_AIR, quality = 'high'): number {
  let covered = 0, n = 0; const s0 = 0.015;
  for (let o = 0; o < obs; o++) {
    const ox = ((o * 0.618034) % 1) * CLOUD.weatherTile, oz = ((o * 0.414214 + 0.3) % 1) * CLOUD.weatherTile;
    for (let i = 0; i < dirs; i++) for (let j = 0; j < dirs; j++) {
      const sy = s0 + (1 - s0) * ((i + 0.5) / dirs), ch = Math.sqrt(1 - sy * sy), az = ((j + 0.5 + (i % 2) * 0.5) / dirs) * 2 * Math.PI;
      const dx = ch * Math.cos(az), dz = ch * Math.sin(az);
      const t0 = CLOUD.base / sy, t1 = Math.min(CLOUD.top / sy, t0 + 22000);
      const tau = marchDepth(t => density(ox + dx * t, sy * t, oz + dz * t, 0, c), t0, t1, quality); void steps; // the shader's march (D-156)
      const fade = airToBase(sy, air); n++;
      if ((1 - Math.exp(-tau)) * fade > 0.5) covered++;
    }
  }
  return covered / n;
}
/** dome cover seen by ONE observer at world (x, z) for the shader's coverage uniform `u` (the weather field varying) */
export function domeCoverAt(u: number, x: number, z: number, dirs = 20, steps = 24, air: AirOptics = CLEAR_AIR, quality = 'high'): number {
  let covered = 0, n = 0; const s0 = 0.015;
  for (let i = 0; i < dirs; i++) for (let j = 0; j < dirs; j++) {
    const sy = s0 + (1 - s0) * ((i + 0.5) / dirs), ch = Math.sqrt(1 - sy * sy), az = ((j + 0.5 + (i % 2) * 0.5) / dirs) * 2 * Math.PI;
    const dx = ch * Math.cos(az), dz = ch * Math.sin(az);
    const t0 = CLOUD.base / sy, t1 = Math.min(CLOUD.top / sy, t0 + 22000);
    const tau = marchDepth(t => density(x + dx * t, sy * t, z + dz * t, u), t0, t1, quality); void steps; // the shader's march (D-156)
    n++; if ((1 - Math.exp(-tau)) * airToBase(sy, air) > 0.5) covered++;
  }
  return covered / n;
}
/** uniform value that draws the sky fraction `f` (the weather's cloud cover), by inverting the measured table */
export function coverageUniform(f: number, table: { cov: number[]; frac: number[] }): number {
  const { cov, frac } = table; const t = clamp01(f);
  if (t <= frac[0]) return cov[0];
  for (let i = 1; i < frac.length; i++) if (t <= frac[i]) { const a = frac[i - 1], b = frac[i]; return cov[i - 1] + ((t - a) / Math.max(b - a, 1e-6)) * (cov[i] - cov[i - 1]); }
  return cov[cov.length - 1];
}

/** mean of the weather field's multiplier (weather × 0.8 + 0.6) over a disc of radius r around world (x, z), in the
 *  shader's drifted frame (x + wind × t): the local scale of the cover over the observer */
export function localWeatherFactor(x: number, z: number, r = 12000): number {
  let s = 0, n = 0;
  for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) {
    if (i * i + j * j > 5) continue; const px = x + (i / 2) * r, pz = z + (j / 2) * r;
    s += sample3(px / CLOUD.weatherTile, 0.37, pz / CLOUD.weatherTile)[0] * 0.8 + 0.6; n++;
  }
  return s / n;
}
/** the uniform that makes the sky over an observer draw the cover `f`: invert the fixed-effective-cover curve (the local
 *  cover depends on the effective cover c = uniform × local weather factor), then divide by the local weather factor */
export function localCoverageUniform(f: number, local: { c: number[]; frac: number[] }, weatherFactor: number): number {
  const ceff = coverageUniform(f, { cov: local.c, frac: local.frac });
  return Math.min(1.5, ceff / Math.max(0.3, weatherFactor));
}
/** fraction of columns with optical depth > 1 in a disc of radius r around (x, z) (the sky over one observer) */
export function discCover(cov: number, x: number, z: number, r = 8000, grid = 16, steps = 20): number {
  let covered = 0, n = 0; const dy = (CLOUD.top - CLOUD.base) / steps;
  for (let i = 0; i < grid; i++) for (let j = 0; j < grid; j++) {
    const u = ((i + 0.5) / grid) * 2 - 1, v = ((j + 0.5) / grid) * 2 - 1; if (u * u + v * v > 1) continue; n++;
    let tau = 0; for (let k = 0; k < steps && tau <= 1; k++) tau += density(x + u * r, CLOUD.base + (k + 0.5) * dy, z + v * r, cov) * dy;
    if (tau > 1) covered++;
  }
  return covered / n;
}
