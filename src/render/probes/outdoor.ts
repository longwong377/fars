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
//  • Per probe 6 RGBA8 texels (OUT_TEXELS) holding three ambient cubes in the region's own axes (+u, −u, +v, −v, +y, −y:
//    the irradiance on a surface facing each; exact for walls along the axes, which the town's and the Terrace's all are),
//    each face as sqrt(E / A):
//      S: the sky channel, irradiance per unit sky irradiance S (the hemisphere light's sky term): the sky seen directly plus
//         the light the sky puts on the surfaces the probe sees (the open sky: +y 1, the sides ½).
//      U morning: irradiance per unit horizontal direct sun irradiance U from the sunlit surfaces the probe sees, the sun
//         sampled over the year's mornings (sun east of the meridian); U afternoon likewise (west). The shader blends the two
//         by the sun's azimuth, so the bounce follows the sun across the day.
//      texel 0: S ±u ±v · 1: S +y −y, tint red, tint blue (luminance 1, so green follows; / TINT_MAX) · 2: U am ±u ±v ·
//      3: U am +y −y, U pm +y −y · 4: U pm ±u ±v · 5: the bounce fraction of S, validity (1 = a probe in the open, 0 = inside
//      a solid: such probes carry their neighbours' mean and are left out of the interpolation), 0, 0.
//    (An L1 field put 40–50 % too much sky on the walls of a 2 m lane against Cycles, tools/blender/lightmap_check.py.)
//  • Per column 1 texel: ground height (16 bits over the region's [gmin, gmin + grange]), wall flags (town: bit 0 a wall on
//    the cell's +i edge, bit 1 on its +j edge; the lookup never interpolates across a wall), the roof's underside above the
//    ground (0.025 m steps; 255 = open): a lookup point above it (a roof top) does not use that column's probes.
// Irradiance at a point, normal n (tint t, bounce fraction f, w_pm the afternoon weight; a cube read for n as
// Σ n_a² · face(sign n_a), a over the region's axes):
//   E = S·mix(1, t, f)·E_S(n) + U·t·mix(E_am, E_pm, w_pm)(n)

export const OUT_TEX_W = 4096;
export const OUT_TEXELS = 6;
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
  /** the step (m) of the column's roof-underside height (255 steps: the town 0.025, the Terrace's halls 0.1) */ cstep: number;
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

/** cubes as [+u, −u, +v, −v, +y, −y] */
export interface OutSample { S: number[]; Uam: number[]; Upm: number[]; tint: [number, number]; fb: number; w: number; theta: number }
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
void decL1;
export function groundAt(R: OutRegion, tex: Uint8Array, i: number, j: number) {
  const t = colTexel(R, i, j); return R.gmin + ((tex[t * 4] * 256 + tex[t * 4 + 1]) / 65535) * R.grange;
}
export function flagsAt(R: OutRegion, tex: Uint8Array, i: number, j: number) { return tex[colTexel(R, i, j) * 4 + 2]; }
/** the height of the roof's underside over a column above its ground (Infinity: open to the sky) */
export function ceilAt(R: OutRegion, tex: Uint8Array, i: number, j: number) { const c = tex[colTexel(R, i, j) * 4 + 3]; return c === 255 ? Infinity : c * R.cstep; }
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
  const acc = { S: [0, 0, 0, 0, 0, 0], Uam: [0, 0, 0, 0, 0, 0], Upm: [0, 0, 0, 0, 0, 0], tr: 0, tb: 0, fb: 0, w: 0, g: 0, gw: 0 };
  for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
    const wb = (a ? tx : 1 - tx) * (b ? tz : 1 - tz) * reach(a, b); if (wb <= 0) continue;
    const i = a ? i1 : i0, j = b ? j1 : j0, g = groundAt(R, tex, i, j); acc.g += wb * g; acc.gw += wb;
    const hk = Math.min(Math.max((qy - g - R.y0) / R.dy, 0), R.L - 1), k0 = Math.min(Math.floor(hk), Math.max(0, R.L - 2)), k1 = Math.min(k0 + 1, R.L - 1), fk = hk - k0;
    for (const [k, wk] of [[k0, 1 - fk], [k1, fk]] as [number, number][]) {
      if (wk <= 0) continue;
      const T = (t: number, c: number) => byte(tex, probeTexel(R, i, j, k, t), c), val = T(5, 1) * (qy - g < ceilAt(R, tex, i, j) ? 1 : 0), w = wb * wk * val; if (w <= 0) continue;
      const sq = (x: number, A: number) => x * x * A;
      const S = [T(0, 0), T(0, 1), T(0, 2), T(0, 3), T(1, 0), T(1, 1)].map(x => sq(x, A_S));
      const am = [T(2, 0), T(2, 1), T(2, 2), T(2, 3), T(3, 0), T(3, 1)].map(x => sq(x, A_U)), pm = [T(4, 0), T(4, 1), T(4, 2), T(4, 3), T(3, 2), T(3, 3)].map(x => sq(x, A_U));
      for (let c = 0; c < 6; c++) { acc.S[c] += w * S[c]; acc.Uam[c] += w * am[c]; acc.Upm[c] += w * pm[c]; }
      acc.tr += w * T(1, 2) * TINT_MAX; acc.tb += w * T(1, 3) * TINT_MAX; acc.fb += w * T(5, 0); acc.w += w;
    }
  }
  const inv = acc.w > 1e-6 ? 1 / acc.w : 0, ground = acc.gw > 0 ? acc.g / acc.gw : 0, hy = py - ground;
  const ramp = (a: number, b: number, x: number) => (b - a > 1e-6 ? Math.min(1, Math.max(0, (x - a) / (b - a))) : x >= a ? 1 : 0);
  const eu = Math.min(fu, W - fu, fv, H - fv) * R.cell, we = R.edge > 0 ? Math.min(1, Math.max(0, eu / R.edge)) : 1;
  const wy = ramp(R.lo[0], R.lo[1], hy) * (1 - ramp(R.hi[0], R.hi[1], hy)), wv = ramp(OUT_VALID[0], OUT_VALID[1], acc.w);
  const m = (x: number[]) => x.map(v => v * inv);
  return { S: m(acc.S), Uam: m(acc.Uam), Upm: m(acc.Upm), tint: [acc.tr * inv, acc.tb * inv], fb: acc.fb * inv, w: we * wy * wv, theta: R.theta };
}
/** the summed validity weight below which the field gives way (a point whose every neighbour probe is inside a solid) */
export const OUT_VALID: [number, number] = [0.02, 0.1];
/** the lookup point stands this far off the surface along its geometric normal (m): the probe on the surface's own side */
export const OUT_BIAS = 0.35;
/** a cube [+u, −u, +v, −v, +y, −y] read for world normal n in a region turned by theta */
export function cubeAt(cube: number[], n: [number, number, number], theta: number): number {
  const c = Math.cos(theta), s = Math.sin(theta), nu = n[0] * c - n[2] * s, nv = -n[0] * s - n[2] * c, ny = n[1];
  return nu * nu * (nu >= 0 ? cube[0] : cube[1]) + nv * nv * (nv >= 0 ? cube[2] : cube[3]) + ny * ny * (ny >= 0 ? cube[4] : cube[5]);
}
/** irradiance (per unit S and U) for normal n from a sample: [sky part, sun part], with wPm the afternoon weight */
export function outIrradiance(s: OutSample, n: [number, number, number], wPm: number): { sky: number; sun: number } {
  const U = s.Uam.map((v, i) => v * (1 - wPm) + s.Upm[i] * wPm);
  return { sky: cubeAt(s.S, n, s.theta), sun: cubeAt(U, n, s.theta) };
}
/** D-680 (s18 reset, "house-interior cov-204 ~90 % black at 10:00"): the eye's ambient relative to the open field from the
 *  outdoor field, as field.ts fieldVisibility does for the halls (the mean over up and the four horizontal axes of the
 *  field's irradiance over the open field's, `open(ny)` its law), and the weight with which the eye's adaptation takes it:
 *  the field's own weight × how enclosed the point is (0 in an open lane or court, where the upward rays and the outdoor law
 *  stay as they were; 1 under a roof or deep in a doorway, where the eye used to keep the outdoor exposure in every town
 *  room: the rays test only the Terrace's architecture). `roofed` (0..1): how far the sky straight up is shut off (the +y
 *  sky face), for the eye's test of direct sun (C). */
/** the least eye visibility the field answers (a room whose bake saw no opening: a door it missed, a probe at a wall): the
 *  eye in such a room opens ~6.6 EV, as in a dim interior, not without bound */
export const VIS_MIN = 0.01;
export function outdoorEyeVisibility(s: OutSample | null, S: number, U: number, wPm: number, open: (ny: number) => number): { vis: number; w: number; roofed: number } {
  if (!s || s.w <= 0) return { vis: 1, w: 0, roofed: 0 };
  let e = 0, o = 0;
  for (const n of [[0, 1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]] as [number, number, number][]) { const r = outIrradiance(s, n, wPm); e += S * r.sky + U * r.sun; o += open(n[1]); }
  const vis = o > 0 ? Math.min(1, Math.max(VIS_MIN, e / o)) : 1, t = Math.min(1, Math.max(0, (0.55 - vis) / 0.3)), enc = t * t * (3 - 2 * t);
  return { vis, w: s.w * enc, roofed: Math.min(1, Math.max(0, (0.7 - s.S[4]) / 0.4)) };
}
/** the afternoon weight from the direction toward the sun (world): 0 with the sun east, 1 west, ½ on the meridian */
export function afternoonWeight(dx: number, dz: number, am: [number, number] = [1, 0], pm: [number, number] = [-1, 0]): number {
  const ax = pm[0] - am[0], az = pm[1] - am[1], l = Math.hypot(ax, az) || 1, h = Math.hypot(dx, dz);
  if (h < 1e-6) return 0.5;
  const t = ((dx / h) * ax + (dz / h) * az) / l; // −1 … 1
  return Math.min(1, Math.max(0, 0.5 + t * 0.9));
}
