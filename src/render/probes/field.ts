// Light-probe field (D-110): per roofed building, a regular grid of probes over the roofed floor plus a margin, each
// holding the ambient (sky) irradiance that the building's openings let in, as a linear function of the surface normal.
// Pure TypeScript: the bake (bake.ts), the unit tests, the eye adaptation and the shader (runtime.ts) read the same data.
//
// Per probe, 12 values (PROBE_STRIDE):
//   0–3   S channel: irradiance per unit sky irradiance S (the hemisphere light's sky term): the sky seen through the
//         openings plus light the sky puts on surfaces that the probe sees (one and two bounces). E_S(n) = a + b·n.
//   4–7   U channel: irradiance per unit horizontal direct sun irradiance U (sun intensity × sin altitude): sunlit
//         surfaces seen by the probe (courts beyond the doorways, sun patches on floors), time-averaged over the year's
//         daylight (bake.ts). E_U(n) = a + b·n.
//   8, 9  bounce tint of the light arriving from above (red, blue; luminance 1, so green follows): the colour the bounced
//         light takes from the albedos, as an up-facing surface receives it (D-158; before, one tint for all directions).
//   10    bounce fraction of the S channel's mean (the rest is the sky itself, untinted).
//   11    validity: 1 = a real probe; 0.02 = inside a solid, carrying its neighbours' mean (bake.ts dilate), so it only
//         counts where no real probe is near; 0 = deep inside a solid, left out.
//   12–15 reach along +x, −x, +z, −z: the free distance from the probe to the first solid along that grid axis, as a
//         fraction of the spacing (1 = the neighbour is in sight; 0 inside a solid). The lookup drops the side of a cell
//         whose probes cannot reach the point (a wall between them: its light is on the other side), D-152.
//   16, 17 bounce tint of the light arriving from below (red, blue), as a down-facing surface receives it (D-158): under a
//         red floor the ceiling glows red; the floor itself is lit by the walls, columns and doorways.
// Ambient irradiance at a point, normal n:  tint(n) = mix(tint_below, tint_above, (1 + n_y)/2);
//   E = S·mix(1, tint(n), fb)·max(0, E_S(n)) + U·tint(n)·max(0, E_U(n)).
// In the open this reproduces the hemisphere light's sky term S·(1 + n_y)/2 exactly (L1 is exact for a hemisphere).
export const PROBE_STRIDE = 18;
/** first of the two slots of the tint from below (red, blue) */
export const TINT_DOWN = 16;
/** the slots a probe's value is made of (interpolated, dilated): the channels, both tints and the bounce fraction */
export const CARRIED = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 16, 17];
/** first of the four reach slots (+x, −x, +z, −z) */
export const REACH = 12;
/** the interpolation fraction along one axis after the reach test (D-152): f is the point's position between the cell's
 *  low probes (f = 0) and high probes (f = 1); lo0/lo1 are the two low corners' reach toward +, hi0/hi1 the two high
 *  corners' reach toward − (fractions of the spacing), and t the point's fraction along the other axis (0 at the "0"
 *  corners, 1 at the "1" corners). Each side reaches the point by the reach test of its two corners blended by t (so the
 *  corner nearer the point counts: beside a doorway, the probe in line with the opening does not light the wall's foot
 *  behind its jamb). A side that does not reach the point is left out (the point snaps to the other side); if both or
 *  neither side reaches it, the plain bilinear fraction stands. Probes without reach data (0: the bake's intermediate
 *  fields) never snap. The shader (runtime.ts) does the same with step()s. */
export function reachFrac(f: number, lo0: number, lo1: number, hi0: number, hi1: number, t = 0.5): number {
  // D-188: the reach test is a steep ramp (over 2 × REACH_SOFT of the spacing below the distance), not a step: round a column (an obstacle
  // inside a cell) the step snapped the lookup from one side to the other at a point, and the irradiance jumped ×3–8
  // within 1° of arc on the Hadish column bases (the "polygon facets" of the §8.2 rubric); walls are ≥ 0.5 spacing
  // thicker than the band, so nothing reaches through them
  // (one-sided, so a probe always reaches its own position (d = 0) and a reach of 1, the bake's cap, the whole cell: the
  // fraction stays 0 and 1 at the cell's faces, continuous with the next cell)
  const ok = (r: number, d: number) => sstep(d - 2 * REACH_SOFT, d, r);
  const lo = ok(lo0, f) * (1 - t) + ok(lo1, f) * t, hi = ok(hi0, 1 - f) * (1 - t) + ok(hi1, 1 - f) * t;
  const loOnly = lo * (1 - hi), hiOnly = hi * (1 - lo);
  return f * (1 - loOnly - hiOnly) + hiOnly;
}
/** the interpolated validity below which the field gives way to the plain skylight: only where every neighbour is inside a
 *  solid and was not reached by the dilation (bake.ts; dilated probes weigh 0.02) */
export const VALID_LO = 0.002, VALID_HI = 0.01;
/** half-width of the reach test's ramp, as a fraction of the probe spacing (D-188: 0.08 × 2 m = 16 cm) */
export const REACH_SOFT = 0.08;

export interface ProbeVolume {
  building: string;
  /** world position of probe (0, 0, 0): x = grid east, y = up, z = −grid north */
  origin: [number, number, number];
  /** probe spacing along x, y (layers), z (m) */
  spacing: [number, number, number];
  /** probe counts along x, y (layers), z */
  dims: [number, number, number];
  /** weight: 1 over the roofed footprint (+ `full` m), falling to 0 at the grid edge; below the floor it fades out over
   *  [yLo0, yLo1], above the ceiling over [yHi0, yHi1] (the roof slab: the roof's top face is outdoors) */
  roof: [number, number, number, number]; // world x0, x1, z0, z1 of the roofed footprint
  full: number;
  yLo: [number, number]; yHi: [number, number];
  /** index of the volume's first probe in the data (probes are layer-major: ix + nx·(iz + nz·iy)) */
  offset: number;
}
export interface ProbeField { volumes: ProbeVolume[]; data: Float32Array; count: number; normalBias: number; tier: string; note: string; partsHash?: string }

const sstep = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const gridExtent = (v: ProbeVolume) => ({
  x0: v.origin[0], x1: v.origin[0] + (v.dims[0] - 1) * v.spacing[0],
  y0: v.yLo[0], y1: v.yHi[1],
  z0: v.origin[2], z1: v.origin[2] + (v.dims[2] - 1) * v.spacing[2],
});
/** weight of the probe field at a point (0 outside the volume, 1 well inside the roofed space) */
export function volumeWeight(v: ProbeVolume, x: number, y: number, z: number): number {
  const g = gridExtent(v), [rx0, rx1, rz0, rz1] = v.roof, f = v.full;
  if (x < g.x0 || x > g.x1 || z < g.z0 || z > g.z1 || y < g.y0 || y > g.y1) return 0;
  const wx = sstep(g.x0, rx0 - f, x) * (1 - sstep(rx1 + f, g.x1, x));
  const wz = sstep(g.z0, rz0 - f, z) * (1 - sstep(rz1 + f, g.z1, z));
  return wx * wz * sstep(v.yLo[0], v.yLo[1], y) * (1 - sstep(v.yHi[0], v.yHi[1], y));
}
export function volumeAt(F: ProbeField, x: number, y: number, z: number): ProbeVolume | null {
  for (const v of F.volumes) { const g = gridExtent(v); if (x >= g.x0 && x <= g.x1 && y >= g.y0 && y <= g.y1 && z >= g.z0 && z <= g.z1) return v; }
  return null;
}
export const probePosition = (v: ProbeVolume, ix: number, iy: number, iz: number): [number, number, number] =>
  [v.origin[0] + ix * v.spacing[0], v.origin[1] + iy * v.spacing[1], v.origin[2] + iz * v.spacing[2]];
export const probeIndex = (v: ProbeVolume, ix: number, iy: number, iz: number) => v.offset + ix + v.dims[0] * (iz + v.dims[2] * iy);

/** the interpolated probe at a point: validity-weighted trilinear over the 8 surrounding probes (what the GPU computes with
 *  premultiplied, hardware-filtered textures). Returns null outside every volume. `out` receives the 12 values
 *  (validity-normalised) and the weight. */
export interface ProbeSample { w: number; v: number; s: Float64Array }
export function sampleField(F: ProbeField, x: number, y: number, z: number, nx = 0, ny = 0, nz = 0, out: ProbeSample = { w: 0, v: 0, s: new Float64Array(PROBE_STRIDE) }, data = F.data): ProbeSample | null {
  const vol = volumeAt(F, x, y, z); if (!vol) return null;
  const b = F.normalBias, qx = x + nx * b, qy = y + ny * b, qz = z + nz * b;
  const [n0, n1, n2] = vol.dims;
  const gx = Math.min(n0 - 1, Math.max(0, (qx - vol.origin[0]) / vol.spacing[0]));
  const gy = Math.min(n1 - 1, Math.max(0, (qy - vol.origin[1]) / vol.spacing[1]));
  const gz = Math.min(n2 - 1, Math.max(0, (qz - vol.origin[2]) / vol.spacing[2]));
  const ix = Math.min(n0 - 2, Math.floor(gx)), iy = Math.min(Math.max(0, n1 - 2), Math.floor(gy)), iz = Math.min(n2 - 2, Math.floor(gz));
  const fy = n1 > 1 ? gy - iy : 0;
  // reach test on the lower layer's four corners (both layers use its fractions, as the shader does)
  const R = (dx: number, dz: number, k: number) => data[probeIndex(vol, ix + dx, iy, iz + dz) * PROBE_STRIDE + REACH + k];
  const tx = gx - ix, tz = gz - iz;
  const fx = reachFrac(tx, R(0, 0, 0), R(0, 1, 0), R(1, 0, 1), R(1, 1, 1), tz);
  const fz = reachFrac(tz, R(0, 0, 2), R(1, 0, 2), R(0, 1, 3), R(1, 1, 3), tx);
  out.s.fill(0); let wsum = 0;
  for (let c = 0; c < 8; c++) {
    const dx = c & 1, dy = (c >> 1) & 1, dz = (c >> 2) & 1;
    if (n1 === 1 && dy) continue;
    const wt = (dx ? fx : 1 - fx) * (dy ? fy : 1 - fy) * (dz ? fz : 1 - fz); if (wt <= 0) continue;
    const o = probeIndex(vol, ix + dx, iy + dy, iz + dz) * PROBE_STRIDE, val = data[o + 11];
    if (val <= 0) continue;
    const k = wt * val; wsum += k;
    for (const j of CARRIED) out.s[j] += k * data[o + j];
  }
  out.v = wsum; // (the trilinear weights sum to 1, so this is the interpolated validity)
  if (wsum > 1e-6) for (const j of CARRIED) out.s[j] /= wsum;
  out.s[11] = wsum;
  out.w = volumeWeight(vol, x, y, z) * sstep(VALID_LO, VALID_HI, wsum);
  return out;
}
/** irradiance for normal n from a sample, per unit S and U (luminance; tint and fb are colour only):
 *  [sky part E_S, sun part E_U] */
export function evalSample(s: Float64Array, nx: number, ny: number, nz: number): [number, number] {
  return [Math.max(0, s[0] + s[1] * nx + s[2] * ny + s[3] * nz), Math.max(0, s[4] + s[5] * nx + s[6] * ny + s[7] * nz)];
}

/** the open-field reference the probes are compared with: a surface of normal n on open, level, sunlit ground of
 *  albedo `rho` sees the sky above (S (1 + n_y)/2) and the ground below, lit by sun and sky ((S + U) ρ (1 − n_y)/2) */
export function openField(ny: number, S: number, U: number, rho: number) { return S * (1 + ny) / 2 + (S + U) * rho * (1 - ny) / 2; }
/** directions over which a probe's "visibility" is averaged for the eye: up and the four horizontal axes */
const EYE_DIRS: [number, number, number][] = [[0, 1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]];
/** the open-field ambient irradiance averaged over the eye directions */
export function openAmbientMean(S: number, U: number, rho: number) { let o = 0; for (const d of EYE_DIRS) o += openField(d[1], S, U, rho); return o / EYE_DIRS.length; }
/** ambient light at a point relative to the open field (0 … ~1): the mean over the eye directions of the probe irradiance
 *  divided by the mean open-field irradiance, for sky S and sun U (luminance). Returns the field weight w too (0 outside
 *  the volumes, where vis is 1), so a caller blends it with its own estimate: w·vis + (1 − w)·other. */
export function fieldVisibility(F: ProbeField, x: number, y: number, z: number, S: number, U: number, rho: number): { vis: number; w: number } {
  const smp = sampleField(F, x, y, z); if (!smp || smp.w <= 0) return { vis: 1, w: 0 };
  let e = 0, o = 0;
  for (const [a, b, c] of EYE_DIRS) { const [es, eu] = evalSample(smp.s, a, b, c); e += S * es + U * eu; o += openField(b, S, U, rho); }
  return { vis: o > 0 ? Math.min(1, e / o) : 1, w: smp.w };
}

// ------------------------------------------------------------------ packing (file ↔ field ↔ texture atlas)
/** the atlas the GPU samples: per volume, its layers side by side as tiles of nx × nz texels, shelf-packed into rows of
 *  width ≤ maxW. Returns each volume's (u0, v0) texel origin and the atlas size. */
export function atlasLayout(vols: ProbeVolume[], maxW = 1024) {
  const order = vols.map((v, i) => i).sort((a, b) => vols[b].dims[2] - vols[a].dims[2]);
  const pos: [number, number][] = vols.map(() => [0, 0]);
  let x = 0, y = 0, rowH = 0, W = 0;
  for (const i of order) {
    const w = vols[i].dims[0] * vols[i].dims[1], h = vols[i].dims[2];
    if (w > maxW) throw new Error(`probe volume ${vols[i].building} is wider than the atlas (${w} > ${maxW})`);
    if (x + w > maxW) { y += rowH; x = 0; rowH = 0; }
    pos[i] = [x, y]; x += w; rowH = Math.max(rowH, h); W = Math.max(W, x);
  }
  return { pos, width: W, height: y + rowH };
}
/** five RGBA atlases of the field, all but T3 premultiplied by validity (so hardware bilinear filtering gives the
 *  validity-weighted mean): T0 = S channel (a, bx, by, bz), T1 = U channel, T2 = (tint above r, b, fb, 1) · v with v in
 *  alpha; T3 = the reach (+x, −x, +z, −z), read at texel centres (not filtered); T4 = (tint below r, b, 0, 1) · v */
export const ATLAS_BANDS = 5;
export function atlasData(F: ProbeField, maxW = 1024) {
  const L = atlasLayout(F.volumes, maxW), W = L.width, H = L.height;
  const T = Array.from({ length: ATLAS_BANDS }, () => new Float32Array(W * H * 4));
  F.volumes.forEach((v, vi) => {
    const [u0, v0] = L.pos[vi], [nx, ny, nz] = v.dims;
    for (let iy = 0; iy < ny; iy++) for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) {
      const o = probeIndex(v, ix, iy, iz) * PROBE_STRIDE, d = F.data, val = d[o + 11];
      const t = ((v0 + iz) * W + (u0 + iy * nx + ix)) * 4;
      for (let c = 0; c < 4; c++) { T[0][t + c] = d[o + c] * val; T[1][t + c] = d[o + 4 + c] * val; }
      T[2][t] = d[o + 8] * val; T[2][t + 1] = d[o + 9] * val; T[2][t + 2] = d[o + 10] * val; T[2][t + 3] = val;
      for (let c = 0; c < 4; c++) T[3][t + c] = d[o + REACH + c];
      T[4][t] = d[o + TINT_DOWN] * val; T[4][t + 1] = d[o + TINT_DOWN + 1] * val; T[4][t + 3] = val;
    }
  });
  return { width: W, height: H, pos: L.pos, textures: T };
}

// half floats (the file stores 16-bit values: ±65504, 11-bit mantissa, ample for irradiance ratios)
const f32 = new Float32Array(1), u32 = new Uint32Array(f32.buffer);
export function toHalf(v: number): number {
  f32[0] = v; const x = u32[0], s = (x >>> 16) & 0x8000; let e = ((x >>> 23) & 0xff) - 127 + 15, m = x & 0x7fffff;
  if (e <= 0) { if (e < -10) return s; m = (m | 0x800000) >> (1 - e); return s | ((m + 0x1000) >> 13); }
  if (e >= 31) return s | 0x7c00;
  const r = s | (e << 10) | ((m + 0x1000) >> 13); return r; // (rounding may carry into the exponent: still correct)
}
export function fromHalf(h: number): number {
  const s = h & 0x8000 ? -1 : 1, e = (h >> 10) & 0x1f, m = h & 0x3ff;
  if (e === 0) return s * m * 2 ** -24;
  if (e === 31) return m ? NaN : s * Infinity;
  return s * (1 + m / 1024) * 2 ** (e - 15);
}
export function encodeField(data: Float32Array): Uint16Array { const o = new Uint16Array(data.length); for (let i = 0; i < data.length; i++) o[i] = toHalf(data[i]); return o; }
export function decodeField(h: Uint16Array): Float32Array { const o = new Float32Array(h.length); for (let i = 0; i < h.length; i++) o[i] = fromHalf(h[i]); return o; }
