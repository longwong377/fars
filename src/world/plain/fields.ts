// Field plots and land-use zones of the plain (Phase 7). The plot layout is reconstruction (C): "irregular small plots
// along canals ... never the modern rectangular grid" (plain.json fields_*). Plots are cells of an anisotropic Voronoi
// pattern (strips 22-52 m x 90-210 m) inside 800 m "districts" (blocks of strips sharing an orientation, bounded by
// tracks and ditches), evaluated per pixel in the terrain shader (terrainPlain.ts) and in JS here for the near crop
// instances. Both use the same 32-bit PCG integer hash, so a plot has the same crop on the GPU and in JS.
//
// The land-use zone texture (64 m texels, +-40.96 km) says what a plot is: irrigated (fields_irrigated_pulvar / _kur
// polygons), rain-fed (fields_rainfed rule: < 1,660 m asl and < 3 % regional slope), orchard (300 m ring around each
// village), woodland cover (woodland rule, thinned near the capital); settlement.json zones, the Terrace, river corridors,
// village cores and the Naqsh-e Rustam precinct are left as natural ground.
import { PLAIN, feature, pointInPolygon, settlementZones } from './data';
import { CROP_ROWS, CropRow, PLOT_OFFSET_DAYS } from './seasonal';
import type { Terrain } from '../../terrain/heightfield';
import { groundAt, TERRACE_BOX, type GroundMap } from './townGround';

// ---------------------------------------------------------------- hash (mirrored in TSL: terrainPlain.ts)
/** PCG hash (pcg-random.org via three's TSL `hash`): u32 -> u32 */
export function pcg(v: number): number {
  const s = (Math.imul(v >>> 0, 747796405) + 2891336453) >>> 0;
  const w = Math.imul(((s >>> ((s >>> 28) + 4)) ^ s) >>> 0, 277803737) >>> 0;
  return ((w >>> 22) ^ w) >>> 0;
}
export const hash2 = (ix: number, iy: number, salt: number) => pcg((ix + pcg((iy + pcg(salt)) >>> 0)) >>> 0);
/** u32 -> [0,1) using the top 24 bits (exact in float32, so the GPU gets the same value) */
export const unit = (h: number) => (h >>> 8) / 16777216;
/** cell index -> u32 (offset keeps it positive; |cell| < 32768 everywhere in the extent) */
export const cellU = (c: number) => (Math.floor(c) + 32768) >>> 0;

export const DISTRICT = 800;
/** salts (shared with the shader) */
export const SALT = { dx: 11, dz: 12, angle: 21, width: 22, length: 23, plotSalt: 24, rotation: 25, irrFallow: 26, px: 31, pz: 32, crop: 41, offset: 42, tree: 51, tx: 52, tz: 53, tsize: 54 } as const;
export const STRIP = { w: [22, 30], l: [90, 120] } as const; // width 22-52 m, length 90-210 m (C)

export interface Plot {
  /** district cell (integer), plot cell (integer, in the district's strip space) */ dc: [number, number]; pc: [number, number];
  /** plot hash (u32) and its seed in world x/z */ h: number; seed: [number, number];
  /** distance to the plot's edge and to the district's edge (m, approximate) */ edge: number; dEdge: number;
  angle: number; w: number; l: number; /** the district's seed (world x/z): origin of the strip frame */ dSeed: [number, number];
}
export function plotAt(x: number, z: number): Plot {
  // districts: jittered-grid Voronoi, 800 m
  const qx = x / DISTRICT, qz = z / DISTRICT, cx = Math.floor(qx), cz = Math.floor(qz);
  let f1 = Infinity, f2 = Infinity, bi = 0, bj = 0, bsx = 0, bsz = 0;
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
    const ux = cellU(cx + i), uz = cellU(cz + j);
    const sx = (cx + i + 0.1 + 0.8 * unit(hash2(ux, uz, SALT.dx))) * DISTRICT, sz = (cz + j + 0.1 + 0.8 * unit(hash2(ux, uz, SALT.dz))) * DISTRICT;
    const d = Math.hypot(x - sx, z - sz);
    if (d <= f1) { f2 = f1; f1 = d; bi = cx + i; bj = cz + j; bsx = sx; bsz = sz; } else if (d < f2) f2 = d;
  }
  const ux = cellU(bi), uz = cellU(bj);
  const angle = unit(hash2(ux, uz, SALT.angle)) * Math.PI;
  const w = STRIP.w[0] + STRIP.w[1] * unit(hash2(ux, uz, SALT.width)), l = STRIP.l[0] + STRIP.l[1] * unit(hash2(ux, uz, SALT.length));
  const salt = hash2(ux, uz, SALT.plotSalt);
  const ca = Math.cos(angle), sa = Math.sin(angle), dx = x - bsx, dz = z - bsz;
  const u = (dx * ca + dz * sa) / w, v = (-dx * sa + dz * ca) / l, cu = Math.floor(u), cv = Math.floor(v);
  let g1 = Infinity, g2 = Infinity, pi = 0, pj = 0, psu = 0, psv = 0;
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
    const a = cellU(cu + i), b = cellU(cv + j);
    const su = cu + i + 0.15 + 0.7 * unit(hash2(a, b, (salt + SALT.px) >>> 0)), sv = cv + j + 0.15 + 0.7 * unit(hash2(a, b, (salt + SALT.pz) >>> 0));
    const d = Math.hypot(u - su, v - sv);
    if (d <= g1) { g2 = g1; g1 = d; pi = cu + i; pj = cv + j; psu = su; psv = sv; } else if (d < g2) g2 = d;
  }
  const h = hash2(cellU(pi), cellU(pj), salt);
  const su = psu * w, sv = psv * l;
  const seed: [number, number] = [bsx + su * ca - sv * sa, bsz + su * sa + sv * ca];
  return { dc: [bi, bj], pc: [pi, pj], h, seed, edge: (g2 - g1) * 0.5 * w, dEdge: (f2 - f1) * 0.5, angle, w, l, dSeed: [bsx, bsz] };
}

// ---------------------------------------------------------------- land-use zones
export const ZONE = { half: 40960, cell: 64, n: 1280 } as const;
/** `ground`: the town's used ground (townGround.ts): where it says no field, no plot is cultivated (tested per pixel in
 *  the shader and per point here) */
export interface ZoneMap { data: Uint8Array; n: number; half: number; cell: number; ground?: GroundMap | null }
/** `ground` (D-190): with the town's ground map, the settlement zones' open ground between the built sites is cultivated
 *  (irrigated plots); without it the zones stay natural ground (the D-040 boundary, used by tests that build no town) */
export interface ZoneInputs { terrain: Terrain; rivers: { x: Float64Array; y: Float64Array; halfCorridor: number }[]; villages: { x: number; y: number; r: number }[]; seed?: number; ground?: GroundMap | null;
  /** the town's built sites (grid centre, frame angle, size): no field under or within 40 m of one, wherever it stands
   *  (the way-station at the Kur crossing lies outside every settlement zone, D-190) */
  sites?: { c: [number, number]; theta: number; W: number; H: number }[] }

/** fill a polygon (grid coords) into a mask of the zone grid (scanline, even-odd) */
function fillPolygon(mask: Uint8Array, poly: readonly (readonly number[])[], value: number) {
  const { n, half, cell } = ZONE;
  for (let r = 0; r < n; r++) {
    const zc = -half + (r + 0.5) * cell, y = -zc; // row r = world z (row 0 = grid north)
    const xs: number[] = [];
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > y) !== (yj > y)) xs.push(xi + ((y - yi) * (xj - xi)) / (yj - yi)); }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const c0 = Math.max(0, Math.ceil((xs[k] + half) / cell - 0.5)), c1 = Math.min(n - 1, Math.floor((xs[k + 1] + half) / cell - 0.5));
      for (let c = c0; c <= c1; c++) mask[r * n + c] = value;
    }
  }
}
/** smooth value noise on a coarse lattice (hash-based, deterministic), 0..1 */
function valueNoise(x: number, y: number, scale: number, salt: number) {
  const qx = x / scale, qy = y / scale, ix = Math.floor(qx), iy = Math.floor(qy), fx = qx - ix, fy = qy - iy;
  const s = (t: number) => t * t * (3 - 2 * t), a = (i: number, j: number) => unit(hash2(cellU(ix + i), cellU(iy + j), salt));
  return (a(0, 0) * (1 - s(fx)) + a(1, 0) * s(fx)) * (1 - s(fy)) + (a(0, 1) * (1 - s(fx)) + a(1, 1) * s(fx)) * s(fy);
}

export function buildZones(inp: ZoneInputs): ZoneMap {
  const { n, half, cell } = ZONE, N = n * n;
  const asl = new Float32Array(N);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) asl[r * n + c] = inp.terrain.aslAt(-half + (c + 0.5) * cell, -half + (r + 0.5) * cell);
  // regional slope: central differences over 2 texels of a 3x3-smoothed height
  const sm = new Float32Array(N);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) { let s = 0, k = 0;
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const rr = Math.min(n - 1, Math.max(0, r + i)), cc = Math.min(n - 1, Math.max(0, c + j)); s += asl[rr * n + cc]; k++; }
    sm[r * n + c] = s / k; }
  const slope = new Float32Array(N);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const at = (rr: number, cc: number) => sm[Math.min(n - 1, Math.max(0, rr)) * n + Math.min(n - 1, Math.max(0, cc))];
    slope[r * n + c] = Math.hypot(at(r, c + 1) - at(r, c - 1), at(r + 1, c) - at(r - 1, c)) / (2 * cell);
  }
  const irr = new Uint8Array(N), excl = new Uint8Array(N), orch = new Uint8Array(N);
  for (const id of ['fields_irrigated_pulvar', 'fields_irrigated_kur']) fillPolygon(irr, feature(id).polygon, 1);
  for (const z of settlementZones()) fillPolygon(excl, z, 1);
  const out = new Uint8Array(N * 4);
  const rf = feature('fields_rainfed').rule, wl = feature('woodland').rule, st = feature('steppe').rule;
  const thin = wl.thinning;
  const nr = PLAIN.naqsh_e_rustam.cliff;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const i = r * n + c, x = -half + (c + 0.5) * cell, y = half - (r + 0.5) * cell;
    const a = asl[i], s = slope[i];
    // the Terrace and its foot: before D-190 a 660 m square (the settlement zones covered the rest); with the town's ground
    // map, the Terrace + 150 m (its per-pixel mask cuts the approach, the sites, roads, water, camp and facilities out)
    const terrace = inp.ground ? Math.hypot(Math.max(TERRACE_BOX.e0 - x, 0, x - TERRACE_BOX.e1), Math.max(TERRACE_BOX.n0 - y, 0, y - TERRACE_BOX.n1)) < 150
      : Math.abs(x - 110) < 330 && Math.abs(y) < 330;
    const nearNR = x > nr.x_range[0] - 300 && x < nr.x_range[1] + 300 && y > nr.face_y - 350 && y < nr.face_y + 50;
    // the town's open ground: irrigated plots (the Kuh-e Rahmat canal, C), only where the ground map says where its sites are
    const town = !!excl[i] && !!inp.ground && Math.max(Math.abs(x), Math.abs(y)) < inp.ground.half - 2 * cell;
    const blocked = (excl[i] && !town) || terrace || nearNR;
    const plain = s < 0.06;
    let R = 0, G = 0;
    if (!blocked && plain && (irr[i] || town)) R = 255;
    else if (!blocked && a < rf.max_asl_m && s < rf.max_slope) G = 255;
    let A = 0;
    if (a > wl.min_asl_m && s > wl.min_slope) {
      const dist = Math.hypot(x, y) / 1000;
      const k = dist <= thin.min_factor_within_km ? thin.min_factor : dist >= thin.full_cover_from_km ? 1 : thin.min_factor + (1 - thin.min_factor) * (dist - thin.min_factor_within_km) / (thin.full_cover_from_km - thin.min_factor_within_km);
      const cover = wl.cover[0] + (wl.cover[1] - wl.cover[0]) * valueNoise(x, y, 1500, 61);
      A = Math.round(Math.min(1, (cover * k) / 0.5) * 255);
    } else if (a > st.asl_m[0] && a < st.asl_m[1] && s > wl.min_slope) {
      // upper steppe slopes: a few scattered pistachio-almond shrubs (C: 2 % cover)
      A = Math.round((0.02 / 0.5) * 255);
    }
    out[i * 4] = R; out[i * 4 + 1] = G; out[i * 4 + 2] = 0; out[i * 4 + 3] = A;
    void orch;
  }
  // the town's built sites, wherever they stand: natural ground under them and 40 m round (rows = -grid north)
  for (const st of inp.sites ?? []) {
    const hw = st.W / 2 + 40, hh = st.H / 2 + 40, R = Math.hypot(hw, hh), cs = Math.cos(st.theta), sn = Math.sin(st.theta);
    for (let r = Math.max(0, Math.floor((half - st.c[1] - R) / cell)); r <= Math.min(n - 1, Math.ceil((half - st.c[1] + R) / cell)); r++)
      for (let c = Math.max(0, Math.floor((st.c[0] + half - R) / cell)); c <= Math.min(n - 1, Math.ceil((st.c[0] + half + R) / cell)); c++) {
        const de = -half + (c + 0.5) * cell - st.c[0], dn = half - (r + 0.5) * cell - st.c[1];
        // the texel's own half-diagonal is added so a texel that touches the box is cleared
        if (Math.abs(de * cs + dn * sn) < hw + cell * 0.71 && Math.abs(-de * sn + dn * cs) < hh + cell * 0.71) { const i = r * n + c; out[i * 4] = 0; out[i * 4 + 1] = 0; out[i * 4 + 2] = 0; }
      }
  }
  // river corridors: no fields where the corridor mesh lies (and a strip of rough pasture along the banks)
  for (const rv of inp.rivers) {
    const rad = rv.halfCorridor + 40;
    for (let k = 0; k < rv.x.length; k += 2) {
      const cx = (rv.x[k] + half) / cell, cy = (half - rv.y[k]) / cell, rr = Math.ceil(rad / cell);
      for (let dr = -rr; dr <= rr; dr++) for (let dc = -rr; dc <= rr; dc++) {
        const r = Math.floor(cy) + dr, c = Math.floor(cx) + dc; if (r < 0 || c < 0 || r >= n || c >= n) continue;
        const x = -half + (c + 0.5) * cell, y = half - (r + 0.5) * cell;
        if (Math.hypot(x - rv.x[k], y - rv.y[k]) < rad) { const i = r * n + c; out[i * 4] = 0; out[i * 4 + 1] = 0; }
      }
    }
  }
  // villages: bare core; orchard ring (orchards_gardens rule: 300 m)
  const ring = feature('orchards_gardens').rule.ring_m;
  for (const v of inp.villages) {
    const R0 = v.r, R1 = v.r + ring, rr = Math.ceil(R1 / cell) + 1, cx = (v.x + half) / cell, cy = (half - v.y) / cell;
    for (let dr = -rr; dr <= rr; dr++) for (let dc = -rr; dc <= rr; dc++) {
      const r = Math.floor(cy) + dr, c = Math.floor(cx) + dc; if (r < 0 || c < 0 || r >= n || c >= n) continue;
      const x = -half + (c + 0.5) * cell, y = half - (r + 0.5) * cell, d = Math.hypot(x - v.x, y - v.y), i = r * n + c;
      if (excl[i] || slope[i] > 0.06) continue; // (a village never lies in a settlement zone)
      if (d < R0) { out[i * 4] = 0; out[i * 4 + 1] = 0; out[i * 4 + 2] = 0; }
      else if (d < R1) { out[i * 4] = 0; out[i * 4 + 1] = 0; out[i * 4 + 2] = 255; }
    }
  }
  return { data: out, n, half, cell, ground: inp.ground ?? null };
}
/** zone texel at world (x, z): [irrigated, rainfed, orchard, woodland] 0..255, nearest texel */
export function zoneAt(z: ZoneMap, x: number, wz: number): [number, number, number, number] {
  const c = Math.floor((x + z.half) / z.cell), r = Math.floor((wz + z.half) / z.cell);
  if (c < 0 || r < 0 || c >= z.n || r >= z.n) return [0, 0, 0, 0];
  const i = (r * z.n + c) * 4; return [z.data[i], z.data[i + 1], z.data[i + 2], z.data[i + 3]];
}

// ---------------------------------------------------------------- crop choice (plain.json crop_mix; mirrored in the shader)
/** cumulative crop thresholds of the irrigated mix: barley 0.5, wheat 0.15, emmer/spelt 0.1, sesame 0.05, fallow 0.2 */
export const IRR_STEPS = [0.5, 0.65, 0.75, 0.8];
export const RAINFED_BARLEY = 0.4; // fields_rainfed: barley 40 %, fallow/grazing 60 %
/** dry farming alternates crop and fallow years by block (C, D-190): half the districts are in their crop year (70 % of
 *  plots barley), half in fallow (10 %); the mean is the data's 40 %. From the Terrace the plain then reads as large
 *  blocks of green and of weedy fallow, as a dry-farmed plain does, not as one mean colour */
export const ROTATION = { crop: 0.7, fallow: 0.1 } as const;
export const rainfedThreshold = (dc: [number, number]) => (unit(hash2(cellU(dc[0]), cellU(dc[1]), SALT.rotation)) < 0.5 ? ROTATION.crop : ROTATION.fallow);
/** D-223: each district's irrigated land keeps its own fallow share, 20 % ± 12 % (uniform; the mean is the data's 20 %):
 *  the canals' command areas were worked and rested village by village, not as one field (C). The crop thresholds scale
 *  with it, so the crops keep their proportions. From the Terrace the irrigated plain then reads in 800 m blocks at any
 *  distance, as the rain-fed land does (rubric s7 pass 2 fix 9, the "empty sheet") */
export const IRR_FALLOW_SPREAD = 0.12;
export const irrigatedScale = (dc: [number, number]) => (IRR_STEPS[3] + IRR_FALLOW_SPREAD * (2 * unit(hash2(cellU(dc[0]), cellU(dc[1]), SALT.irrFallow)) - 1)) / IRR_STEPS[3];
export const VINE_SHARE = 0.3; // orchards_gardens: 30 % of orchard plots are vineyards
export function checkMixes() { // the thresholds above are the data's mixes (tests)
  const m = feature('fields_irrigated_pulvar').crop_mix, k = feature('fields_irrigated_kur').crop_mix, rf = feature('fields_rainfed').rule.crop_mix;
  return { irr: [m.barley, m.barley + m.wheat, m.barley + m.wheat + m.emmer_spelt, m.barley + m.wheat + m.emmer_spelt + m.sesame], kurSame: JSON.stringify(m) === JSON.stringify(k), rainBarley: rf.barley, vine: feature('orchards_gardens').rule.vine_share };
}
export type LandUse = 'irrigated' | 'rainfed' | 'orchard' | 'natural';
export interface PlotUse { use: LandUse; row: CropRow; rowIndex: number; offsetDays: number; plot: Plot }
/** what grows at world (x, z) (the same decision the terrain shader makes for the pixel) */
export function landUseAt(zm: ZoneMap, x: number, z: number): PlotUse {
  const plot = plotAt(x, z);
  const [R, G, B] = zoneAt(zm, plot.seed[0], plot.seed[1]);
  const hc = unit(hash2(plot.h, 7, SALT.crop)), ho = unit(hash2(plot.h, 9, SALT.offset));
  const offsetDays = Math.floor(ho * (2 * PLOT_OFFSET_DAYS + 1)) - PLOT_OFFSET_DAYS;
  let use: LandUse = 'natural', idx = 7;
  if (B > 127) { use = 'orchard'; idx = hc >= 1 - VINE_SHARE ? 6 : 5; }
  else if (R > 127) { use = 'irrigated'; const sc = irrigatedScale(plot.dc); idx = IRR_STEPS.reduce((k, t) => k + (hc >= Math.fround(t * sc) ? 1 : 0), 0); }
  else if (G > 127) { use = 'rainfed'; idx = hc >= rainfedThreshold(plot.dc) ? 4 : 0; }
  if (use !== 'natural' && zm.ground) { const g = groundAt(zm.ground, x, -z); if (g[2] < 0.5) { use = 'natural'; idx = 7; } }
  return { use, row: CROP_ROWS[idx], rowIndex: idx, offsetDays, plot };
}
export { pointInPolygon };
