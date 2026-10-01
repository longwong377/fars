// The outdoor light field (D-357): the sky each point of the Terrace and the town sees past the walls round it, and the
// light the sunlit and skylit walls, roofs and ground throw back into it (one bounce, colour kept), baked by ray tracing
// against the built world (outdoor_bake.ts) and sampled by every lit material and the post composite through the probe
// lookup (runtime.ts probeAmbient), so the shade of a lane, a court or a town room is lit by its own surroundings instead
// of by the open sky (the hemisphere light) or a screen-space guess.
//
// Layout (pure TypeScript: the bake, the tests and the shader read the same data):
//  • Regions: a rotated rectangle of square cells (the town's sites on their own 1 m cell grid, so its walls lie on the cell
//    edges; the Terrace on a 2 m grid along the world axes), each cell a column of L probes at heights y0 + k·dy above the
//    column's ground (the town: the house floor or the lane; the Terrace: the court datum 0).
//  • Per probe 4 RGBA8 texels (OUT_TEXELS):
//      0  S: the sky channel, irradiance per unit sky irradiance S (the hemisphere light's sky term): the sky seen directly
//         plus the light the sky puts on the surfaces the probe sees. L1, E_S(n) = a + b·n, stored as sqrt(a / A_S) and the
//         direction ratio r = b / 2a (|r| <= 1 for any non-negative radiance) as (r + 1) / 2.
//      1  U, morning: irradiance per unit horizontal direct sun irradiance U from the sunlit surfaces the probe sees, the sun
//         sampled over the year's mornings (sun east of the meridian); same encoding with A_U.
//      2  U, afternoon (sun west of the meridian). The shader blends the two by the sun's azimuth, so the bounce follows the
//         sun across the day (a west wall in the morning sun lights the lane's other side; in the afternoon the east one).
//      3  tint red, tint blue (luminance 1, so green follows; / TINT_MAX), the bounce fraction of S, validity (1 = a probe
//         in the open, 0 = inside a solid: such probes carry their neighbours' mean and are left out of the interpolation).
//  • Per column 1 texel: ground height (16 bits over the region's [gmin, gmin + grange]), wall flags (town: bit 0 a wall on
//    the cell's +i edge, bit 1 on its +j edge; the lookup never interpolates across a wall), the roof's underside above the
//    ground (0.025 m steps; 255 = open): a lookup point above it (a roof top) does not use that column's probes.
// Irradiance at a point, normal n (tint t, bounce fraction f, w_pm the afternoon weight):
//   E = S·mix(1, t, f)·max(0, E_S(n)) + U·t·max(0, mix(E_am, E_pm, w_pm)(n))
// In the open this is the hemisphere light's sky term plus the ground's bounce (L1 is exact for a hemisphere).

export const OUT_TEX_W = 4096;
export const OUT_TEXELS = 4;
export const A_S = 1.5, A_U = 2.5, TINT_MAX = 2.5;

export interface OutRegion {
  id: string; kind: 'town' | 'terrace';
  /** frame: local (u, v) → grid (e, n) = c + u·(cos θ, sin θ) + v·(−sin θ, cos θ); world x = e, z = −n */
  c: [number, number]; theta: number;
  /** cell (i, j) spans local u ∈ [u0 + i·cell, u0 + (i + 1)·cell), v likewise; W × H cells */
  u0: number; v0: number; cell: number; W: number; H: number;
  /** L probe layers at y_ground + y0 + k·dy */
  L: number; y0: number; dy: number;
  /** ground encoding: y = gmin + g16 / 65535 · grange */
  gmin: number; grange: number;
  /** the field's weight over the height above the column's ground: 0 below lo[0], 1 from lo[1] to hi[0], 0 above hi[1] */
  lo: [number, number]; hi: [number, number];
  /** weight fade (m) inside the rectangle's edge */ edge: number;
  /** texel offsets of the region's probes and columns in the atlas */
  probeBase: number; colBase: number;
  /** walls on the cell edges (the town) */ flags: boolean;
}
export interface OutMeta { tier: 'C'; note: string; built: string; width: number; height: number; regions: OutRegion[]; sunAm: [number, number]; sunPm: [number, number]; seconds?: number; rays?: { sky: number; bounce: number } }

/** probe (i, j, k) of a region → texel index of its texel t */
export const probeTexel = (R: OutRegion, i: number, j: number, k: number, t: number) => R.probeBase + (((k * R.H + j) * R.W + i) * OUT_TEXELS) + t;
export const colTexel = (R: OutRegion, i: number, j: number) => R.colBase + j * R.W + i;

/** encode one L1 (a, bx, by, bz) into 4 bytes */
export function encL1(a: number, bx: number, by: number, bz: number, A: number, out: Uint8Array, o: number) {
  const aa = Math.max(0, a), inv = aa > 1e-9 ? 1 / (2 * aa) : 0;
  let rx = bx * inv, ry = by * inv, rz = bz * inv; const m = Math.hypot(rx, ry, rz); if (m > 1) { rx /= m; ry /= m; rz /= m; }
  out[o] = Math.round(Math.min(1, Math.sqrt(aa / A)) * 255);
  out[o + 1] = Math.round((rx * 0.5 + 0.5) * 255); out[o + 2] = Math.round((ry * 0.5 + 0.5) * 255); out[o + 3] = Math.round((rz * 0.5 + 0.5) * 255);
}
/** decode 4 bytes (as 0..1 floats) into L1 (a, bx, by, bz) */
export function decL1(e0: number, e1: number, e2: number, e3: number, A: number): [number, number, number, number] {
  const a = e0 * e0 * A; return [a, (e1 * 2 - 1) * 2 * a, (e2 * 2 - 1) * 2 * a, (e3 * 2 - 1) * 2 * a];
}

/** world (x, z) → region-local (u, v) */
export function toRegion(R: OutRegion, x: number, z: number): [number, number] {
  const de = x - R.c[0], dn = -z - R.c[1], c = Math.cos(R.theta), s = Math.sin(R.theta);
  return [de * c + dn * s, -de * s + dn * c];
}
/** region-local (u, v) → world (x, z) */
export function fromRegion(R: OutRegion, u: number, v: number): [number, number] {
  const c = Math.cos(R.theta), s = Math.sin(R.theta);
  return [R.c[0] + u * c - v * s, -(R.c[1] + u * s + v * c)];
}

export interface OutSample { S: [number, number, number, number]; Uam: [number, number, number, number]; Upm: [number, number, number, number]; tint: [number, number]; fb: number; w: number }
/** CPU mirror of the shader lookup (outdoor_runtime.ts): the field at world p, the lookup point q = p + off·bias. The first
 *  region containing p wins; null outside every region. */
export function sampleOutdoor(meta: OutMeta, tex: Uint8Array, p: [number, number, number], off: [number, number, number] = [0, 0, 0], bias = OUT_BIAS): OutSample | null {
  for (const R of meta.regions) {
    const [pu, pv] = toRegion(R, p[0], p[2]);
    const fu = (pu - R.u0) / R.cell, fv = (pv - R.v0) / R.cell;
    if (fu < 0 || fv < 0 || fu > R.W || fv > R.H) continue;
    const [qu, qv] = toRegion(R, p[0] + off[0] * bias, p[2] + off[2] * bias), qy = p[1] + off[1] * bias;
    return lookupRegion(meta, tex, R, (pu - R.u0) / R.cell, (pv - R.v0) / R.cell, (qu - R.u0) / R.cell, (qv - R.v0) / R.cell, p[1], qy);
  }
  return null;
}
const byte = (tex: Uint8Array, t: number, c: number) => tex[t * 4 + c] / 255;
export function groundAt(R: OutRegion, tex: Uint8Array, i: number, j: number) {
  const t = colTexel(R, i, j); return R.gmin + ((tex[t * 4] * 256 + tex[t * 4 + 1]) / 65535) * R.grange;
}
export function flagsAt(R: OutRegion, tex: Uint8Array, i: number, j: number) { return tex[colTexel(R, i, j) * 4 + 2]; }
/** the height of the roof's underside over a column above its ground (Infinity: open to the sky) */
export function ceilAt(R: OutRegion, tex: Uint8Array, i: number, j: number) { const c = tex[colTexel(R, i, j) * 4 + 3]; return c === 255 ? Infinity : c * 0.025; }
/** the lookup inside one region; (fu, fv) the point's and (qu, qv) the lookup point's position in cell units */
export function lookupRegion(meta: OutMeta, tex: Uint8Array, R: OutRegion, fu: number, fv: number, qu: number, qv: number, py: number, qy: number): OutSample {
  const W = R.W, H = R.H, cl = (x: number, n: number) => Math.min(n - 1, Math.max(0, x));
  // the 2 × 2 block of columns round q (cell centres at i + 0.5)
  const gx = Math.min(Math.max(qu - 0.5, 0), W - 1.001), gz = Math.min(Math.max(qv - 0.5, 0), H - 1.001);
  const i0 = cl(Math.floor(gx), Math.max(1, W - 1)), j0 = cl(Math.floor(gz), Math.max(1, H - 1)), i1 = Math.min(i0 + 1, W - 1), j1 = Math.min(j0 + 1, H - 1);
  const tx = gx - i0, tz = gz - j0;
  // the column the point stands in (by p, not q: the wall it stands against decides the side)
  const ci = cl(Math.floor(fu), W) === i1 && i1 !== i0 ? 1 : 0, cj = cl(Math.floor(fv), H) === j1 && j1 !== j0 ? 1 : 0;
  let wallX0 = 0, wallX1 = 0, wallZ0 = 0, wallZ1 = 0; // the block's inner edges: x-edge at row j0 / j1, z-edge at column i0 / i1
  if (R.flags) { wallX0 = flagsAt(R, tex, i0, j0) & 1; wallX1 = flagsAt(R, tex, i0, j1) & 1; wallZ0 = (flagsAt(R, tex, i0, j0) >> 1) & 1; wallZ1 = (flagsAt(R, tex, i1, j0) >> 1) & 1; }
  const reach = (a: number, b: number) => { // corner (a, b) of the block from the point's corner (ci, cj)
    if (a === ci && b === cj) return 1;
    const xEdgeAt = (row: number) => (row ? wallX1 : wallX0), zEdgeAt = (col: number) => (col ? wallZ1 : wallZ0);
    if (b === cj) return xEdgeAt(cj) ? 0 : 1;
    if (a === ci) return zEdgeAt(ci) ? 0 : 1;
    return (!xEdgeAt(cj) && !zEdgeAt(a)) || (!zEdgeAt(ci) && !xEdgeAt(b)) ? 1 : 0;
  };
  const acc = { S: [0, 0, 0, 0], Uam: [0, 0, 0, 0], Upm: [0, 0, 0, 0], tr: 0, tb: 0, fb: 0, w: 0, g: 0, gw: 0 };
  for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
    const wb = (a ? tx : 1 - tx) * (b ? tz : 1 - tz) * reach(a, b); if (wb <= 0) continue;
    const i = a ? i1 : i0, j = b ? j1 : j0, g = groundAt(R, tex, i, j); acc.g += wb * g; acc.gw += wb;
    const hk = Math.min(Math.max((qy - g - R.y0) / R.dy, 0), R.L - 1), k0 = Math.min(Math.floor(hk), Math.max(0, R.L - 2)), k1 = Math.min(k0 + 1, R.L - 1), fk = hk - k0;
    for (const [k, wk] of [[k0, 1 - fk], [k1, fk]] as [number, number][]) {
      if (wk <= 0) continue;
      const t3 = probeTexel(R, i, j, k, 3), val = byte(tex, t3, 3) * (qy - g < ceilAt(R, tex, i, j) ? 1 : 0), w = wb * wk * val; if (w <= 0) continue;
      const dec = (t: number, A: number) => { const tt = probeTexel(R, i, j, k, t); return decL1(byte(tex, tt, 0), byte(tex, tt, 1), byte(tex, tt, 2), byte(tex, tt, 3), A); };
      const s = dec(0, A_S), am = dec(1, A_U), pm = dec(2, A_U);
      for (let c = 0; c < 4; c++) { acc.S[c] += w * s[c]; acc.Uam[c] += w * am[c]; acc.Upm[c] += w * pm[c]; }
      acc.tr += w * byte(tex, t3, 0) * TINT_MAX; acc.tb += w * byte(tex, t3, 1) * TINT_MAX; acc.fb += w * byte(tex, t3, 2); acc.w += w;
    }
  }
  const inv = acc.w > 1e-6 ? 1 / acc.w : 0, ground = acc.gw > 0 ? acc.g / acc.gw : 0, hy = py - ground;
  const ramp = (a: number, b: number, x: number) => (b - a > 1e-6 ? Math.min(1, Math.max(0, (x - a) / (b - a))) : x >= a ? 1 : 0);
  const eu = Math.min(fu, W - fu, fv, H - fv) * R.cell, we = R.edge > 0 ? Math.min(1, Math.max(0, eu / R.edge)) : 1;
  const wy = ramp(R.lo[0], R.lo[1], hy) * (1 - ramp(R.hi[0], R.hi[1], hy)), wv = ramp(OUT_VALID[0], OUT_VALID[1], acc.w);
  const m = (x: number[]) => x.map(v => v * inv) as [number, number, number, number];
  return { S: m(acc.S), Uam: m(acc.Uam), Upm: m(acc.Upm), tint: [acc.tr * inv, acc.tb * inv], fb: acc.fb * inv, w: we * wy * wv };
}
/** the summed validity weight below which the field gives way (a point whose every neighbour probe is inside a solid) */
export const OUT_VALID: [number, number] = [0.02, 0.1];
/** the lookup point stands this far off the surface along its geometric normal (m): the probe on the surface's own side */
export const OUT_BIAS = 0.35;
/** irradiance (per unit S and U) for normal n from a sample: [sky part, sun part] luminance, with wPm the afternoon weight */
export function outIrradiance(s: OutSample, n: [number, number, number], wPm: number): { sky: number; sun: number } {
  const l1 = (v: number[]) => Math.max(0, v[0] + v[1] * n[0] + v[2] * n[1] + v[3] * n[2]);
  const U = s.Uam.map((v, i) => v * (1 - wPm) + s.Upm[i] * wPm);
  return { sky: l1(s.S), sun: l1(U) };
}
/** the afternoon weight from the direction toward the sun (world): 0 with the sun east, 1 west, ½ on the meridian */
export function afternoonWeight(dx: number, dz: number, am: [number, number] = [1, 0], pm: [number, number] = [-1, 0]): number {
  const ax = pm[0] - am[0], az = pm[1] - am[1], l = Math.hypot(ax, az) || 1, h = Math.hypot(dx, dz);
  if (h < 1e-6) return 0.5;
  const t = ((dx / h) * ax + (dz / h) * az) / l; // −1 … 1
  return Math.min(1, Math.max(0, 0.5 + t * 0.9));
}
