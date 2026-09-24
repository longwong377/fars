// Sub-DEM landform maps for the hills (D-190). The Copernicus GLO-30 surface (30 m, resampled to the 4 m near and 16 m
// mid rings, D-006) carries the hills' form but none of their texture: no gullies, rock bands or scree. This module
// derives, per ring sample, what the terrain shader needs to draw that texture where the DEM's own shape puts it, without
// moving a single height (the rings and every spot check are untouched):
//  - drainage: D8 flow over the ring plus a small fractal perturbation (within the DEM's own relative error: 1.5 m near,
//    3 m mid; GLO-30 relative vertical accuracy is quoted as < 2 m on slopes <= 20 % and < 4 m steeper, B), so flow on
//    the resampled planar facets converges into a dendritic net instead of running in parallel lines. Local pits (the
//    flat plain) end their flow; only the slopes use the result. Contributing area A (m²).
//  - gullies where the slope-area rule for channel heads holds: A·S² above a threshold (Montgomery & Dietrich 1988, B for
//    the form of the rule; the thresholds per ring are C, set so the 16 m mid ring draws only the larger ravines), only on
//    slopes (S > 0.12), widened over one sample.
//  - curvature: the Laplacian of the ring smoothed over one sample (convex ridges and spurs shed their soil and show
//    rock; concave hollows keep soil and collect scree), signed.
//  - slope at the ring's full resolution (the rendered LODs interpolate their vertex normals over up to 16 samples).
// Output: RGBA8 per sample: R gully 0..1, G curvature 128 + k·CURV_SCALE (convex > 128), B slope / 1.5, A log10 area.
// Everything but the DEM itself is C.
import type { Terrain } from './heightfield';
/** what the bake reads of a ring (a Ring, or its copy in a worker) */
export interface RingLike { h: Float32Array; n: number; cell: number; half: number }

export const CURV_SCALE = 3000; // (1/m) -> texel units: ±0.042 1/m spans the range
export interface DetailMap { data: Uint8Array; n: number; half: number; cell: number; ms: number; parts: number[] }
const now = () => (typeof performance !== 'undefined' ? performance.now() : 0);

/** deterministic lattice value noise, 0..1 (smoothstep interpolation) */
function vnoise(x: number, y: number, salt: number) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const h = (i: number, j: number) => { let v = Math.imul(i + 374761393 * salt | 0, 668265263) ^ Math.imul(j, 2246822519); v = Math.imul(v ^ (v >>> 13), 1274126177); return ((v ^ (v >>> 16)) >>> 0) / 4294967296; };
  const a = h(ix, iy), b = h(ix + 1, iy), c = h(ix, iy + 1), d = h(ix + 1, iy + 1);
  return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
}

/** per ring: perturbation amplitude (m) and wavelength (samples); A·S² (m²) from the first rill to a full gully (C) */
export const DETAIL_RING = { near: { perturb: 1.5, wave: 12, as2: [150, 1500] }, mid: { perturb: 3, wave: 8, as2: [2500, 25000] } } as const;
/** mean over a (2r+1)² window (separable running sums, edges clamped) */
function boxMean(a: Float32Array, n: number, r: number): Float32Array {
  const tmp = new Float32Array(n * n), out = new Float32Array(n * n), w = 2 * r + 1;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { let s = 0; for (let k = -r; k <= r; k++) s += a[y * n + Math.min(n - 1, Math.max(0, x + k))]; tmp[y * n + x] = s / w; }
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { let s = 0; for (let k = -r; k <= r; k++) s += tmp[Math.min(n - 1, Math.max(0, y + k)) * n + x]; out[y * n + x] = s / w; }
  return out;
}
/** the landform map of one ring */
export function bakeDetail(ring: RingLike, o: { perturb: number; wave: number; as2: readonly [number, number] }): DetailMap {
  const t0 = now();
  const n = ring.n, N = n * n, cell = ring.cell, half = ring.half;
  // perturbed surface: fBm from `wave` samples down, 4 octaves, each a smoothstep-interpolated lattice of hashed values
  const z = new Float32Array(N), f = new Float32Array(N);
  let amp = 1, norm = 0;
  for (let oct = 0; oct < 4; oct++) {
    const w = o.wave / 2 ** oct, m = Math.ceil(n / w) + 2, lat = new Float32Array(m * m);
    for (let j = 0; j < m; j++) for (let i = 0; i < m; i++) lat[j * m + i] = vnoise(i, j, 17 + oct) - 0.5; // lattice points: the hash itself
    for (let r = 0; r < n; r++) { const y = r / w, iy = Math.floor(y), fy = y - iy, sy = fy * fy * (3 - 2 * fy);
      for (let c = 0; c < n; c++) { const x = c / w, ix = Math.floor(x), fx = x - ix, sx = fx * fx * (3 - 2 * fx), q = iy * m + ix;
        const a0 = lat[q] + (lat[q + 1] - lat[q]) * sx, a1 = lat[q + m] + (lat[q + m + 1] - lat[q + m]) * sx;
        f[r * n + c] += (a0 + (a1 - a0) * sy) * amp; } }
    norm += amp * 0.5; amp *= 0.55;
  }
  for (let k = 0; k < N; k++) z[k] = ring.h[k] + o.perturb * f[k] / norm;
  const tA = now();
  // cells in descending height (a counting sort on 1 mm bins, O(N)); D8 receivers on the perturbed surface; accumulation
  // from the highest cell down. Local pits (the flat plain) end their flow there: only the slopes matter here
  let zmin = Infinity, zmax = -Infinity; for (let i = 0; i < N; i++) { zmin = Math.min(zmin, z[i]); zmax = Math.max(zmax, z[i]); }
  const nb = Math.ceil((zmax - zmin) * 1000) + 1, bin = new Int32Array(N), cnt = new Int32Array(nb + 1);
  for (let i = 0; i < N; i++) { bin[i] = Math.floor((z[i] - zmin) * 1000); cnt[bin[i] + 1]++; }
  for (let b = 0; b < nb; b++) cnt[b + 1] += cnt[b];
  const order = new Int32Array(N); for (let i = 0; i < N; i++) order[cnt[bin[i]]++] = i; // ascending
  const DR = [-1, -1, -1, 0, 0, 1, 1, 1], DC = [-1, 0, 1, -1, 1, -1, 0, 1], DL = DR.map((r, d) => (r && DC[d] ? Math.SQRT2 : 1));
  const area = new Float32Array(N).fill(cell * cell);
  for (let q = N - 1; q >= 0; q--) { const k = order[q], r = (k / n) | 0, c = k - r * n; let best = -1, bs = 0;
    for (let d = 0; d < 8; d++) { const rr = r + DR[d], cc = c + DC[d]; if (rr < 0 || cc < 0 || rr >= n || cc >= n) continue; const j = rr * n + cc;
      const s = (z[k] - z[j]) / DL[d]; if (s > bs) { bs = s; best = j; } }
    if (best >= 0) area[best] += area[k]; }
  const tB = now();
  // slope and curvature of the (unperturbed) ring
  const H = (r: number, c: number) => ring.h[Math.min(n - 1, Math.max(0, r)) * n + Math.min(n - 1, Math.max(0, c))];
  const sm = new Float32Array(N);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) { let s = 0; for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) s += H(r + i, c + j) * (i && j ? 1 : i || j ? 2 : 4); sm[r * n + c] = s / 16; }
  const S = (r: number, c: number) => sm[Math.min(n - 1, Math.max(0, r)) * n + Math.min(n - 1, Math.max(0, c))];
  const out = new Uint8Array(N * 4), gully = new Float32Array(N);
  const lg0 = Math.log(o.as2[0]), lg1 = Math.log(o.as2[1]);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const k = r * n + c;
    const dx = (H(r, c + 1) - H(r, c - 1)) / (2 * cell), dz = (H(r + 1, c) - H(r - 1, c)) / (2 * cell), slope = Math.hypot(dx, dz);
    const lap = (S(r, c + 1) + S(r, c - 1) + S(r + 1, c) + S(r - 1, c) - 4 * S(r, c)) / (cell * cell);
    const as2 = area[k] * slope * slope;
    const t = Math.min(1, Math.max(0, (Math.log(Math.max(1e-6, as2)) - lg0) / (lg1 - lg0)));
    gully[k] = t * t * (3 - 2 * t) * Math.min(1, Math.max(0, (slope - 0.12) / 0.1));
    out[k * 4 + 1] = Math.round(Math.min(255, Math.max(0, 128 - lap * CURV_SCALE))); // convex (lap < 0) > 128
    out[k * 4 + 2] = Math.round(Math.min(1, slope / 1.5) * 255);
    out[k * 4 + 3] = Math.round(Math.min(1, Math.log10(area[k]) / 8) * 255);
  }
  // a steep planar facet of the 30 m DEM still sends parallel threads (every other sample over the facet): where more than
  // a quarter of a 5 x 5 window is gully, the threads are the resampling's, not a net, and are thinned out; then the lines
  // widen over one sample (a gully's banks), the thalweg strongest
  const dense = boxMean(gully, n, 2), g2 = new Float32Array(N);
  for (let k = 0; k < N; k++) { const t = Math.min(1, Math.max(0, (dense[k] - 0.22) / 0.2)); g2[k] = gully[k] * (1 - t * t * (3 - 2 * t)); }
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) { let g = g2[r * n + c];
    for (let d = 0; d < 8; d++) { const rr = r + DR[d], cc = c + DC[d]; if (rr < 0 || cc < 0 || rr >= n || cc >= n) continue; g = Math.max(g, g2[rr * n + cc] * 0.55); }
    out[(r * n + c) * 4] = Math.round(g * 255); }
  const ms = now() - t0;
  return { data: out, n, half, cell, ms, parts: [tA - t0, tB - tA, now() - tB] };
}

export interface Detail { near: DetailMap; mid: DetailMap }
const plainRing = (r: RingLike): RingLike => ({ h: r.h, n: r.n, cell: r.cell, half: r.half });
/** both rings' maps: off the main thread in the browser (detail_worker.ts, started with the plain's build and awaited when
 *  the terrain material is made), in place in node */
export function bakeTerrainDetail(terrain: Terrain): Promise<Detail> {
  const job = { near: plainRing(terrain.near), mid: plainRing(terrain.mid) };
  const inPlace = (): Detail => ({ near: bakeDetail(job.near, DETAIL_RING.near), mid: bakeDetail(job.mid, DETAIL_RING.mid) });
  if (typeof Worker === 'undefined' || typeof window === 'undefined') return Promise.resolve(inPlace());
  return new Promise(resolve => {
    try {
      const w = new Worker(new URL('./detail_worker.ts', import.meta.url), { type: 'module' });
      w.onmessage = (e: MessageEvent) => { resolve(e.data as Detail); w.terminate(); };
      w.onerror = e => { console.warn('terrain detail worker failed; baking on the main thread', e.message); w.terminate(); resolve(inPlace()); };
      w.postMessage({ near: { ...job.near, h: job.near.h.slice() }, mid: { ...job.mid, h: job.mid.h.slice() } });
    } catch { resolve(inPlace()); }
  });
}
