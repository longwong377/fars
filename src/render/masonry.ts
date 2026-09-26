// D-232: the joint layout of the Terrace's retaining walls (and the Grand Stair's recess walls), measured on the site
// photographs instead of the regular hairline coursing the palaces keep (materials.ts HAIRLINE). SITE_SPEC terrace.r_masonry
// holds the numbers; this module turns them into the course table the shader reads and the CPU mirrors the tests measure.
//
// The layout (tier C, from REF-PHOTO-24 / REF-PHOTO-33; tools/dev/masonry_photo_d232.py):
//  - Courses laid level, their heights drawn from the photographed distribution (the quantiles `course_q`), quantised to
//    `quantum` m so a course table in `quantum` bins holds them exactly; one table per wall section (a face's plane picks one
//    of `sections`), and its own for the Grand Stair's recess walls.
//  - Blocks along a course: runs of `per` base cells of `base` m; the inner joints of a run present with probability
//    `joint_p`, each jittered ±`jitter` of a cell (blocks 1-4 cells long: the photographed long tail to ~7 m). The Grand
//    Stair's walls (#33): the head joints lean up to ±`oblique` (tan), and more blocks are split (jogged beds).
//  - A block in a tall course may be split into a thin and a thick piece (the photographed "blocks spanning two courses"
//    seen the other way round): courses ≥ `split.min_h`, share `split.p`, the thin piece `split.f` of the height.
//  - The foot: a zone of large irregular blocks and dressed bedrock (polygonal joints: a row-jittered Voronoi of `cell` ×
//    `row` m cells) up to `foot.height` above the plain (`foot.ground`), present along a share of the W- and S-facing walls
//    (a plan noise, placed to agree with #24 where it was seen); wider joints and rougher faces there.
import SPEC from '../data/site_spec.json';

export interface MasonrySpec {
  quantum: number; sections: number; y0: number; y1: number;
  course_q: number[];
  block: { base: number; per: number; joint_p: number; jitter: number };
  split: { min_h: number; p: number; f: [number, number] };
  stair: { oblique: number; split_p: number; f: [number, number]; box: [number, number, number, number] };
  foot: { ground: number; height: number; lambda: number; offset: [number, number]; theta: number; w: number; cell: number; row: number; jitter: [number, number];
    joint: number; lip: number; tilt: number };
}
export const MASONRY: MasonrySpec = (SPEC as any).terrace.r_masonry.v;

/** a deterministic uniform sampler (mulberry32) for the course tables */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** a course height from the photographed quantiles (piecewise linear between them) for a uniform u */
export function courseHeight(u: number, q = MASONRY.course_q): number {
  const k = u * (q.length - 1), i = Math.min(q.length - 2, Math.floor(k)); return q[i] + (q[i + 1] - q[i]) * (k - i);
}
/** the bed joints (m, descending from the top) of each course table: rows 0..sections-1 the Terrace's wall sections, row
 *  `sections` the Grand Stair's recess walls. Laid from the court datum (the top course's top) down to y0 */
export function courseTables(M = MASONRY): number[][] {
  const out: number[][] = [];
  for (let r = 0; r <= M.sections; r++) {
    const R = rng(0x5a17 + 977 * r), beds = [Math.round(M.y1 / M.quantum) * M.quantum];
    // above the datum (the table's top bins): one course to y1; below: courses to y0
    let z = 0; beds.push(0);
    while (z > M.y0) { z -= Math.max(M.quantum, Math.round(courseHeight(R()) / M.quantum) * M.quantum); beds.push(Math.round(z / M.quantum) * M.quantum); }
    out.push(beds);
  }
  return out;
}
export const TABLE_W = Math.round((MASONRY.y1 - MASONRY.y0) / MASONRY.quantum);
/** the course table as texels (RGBA float): per bin (y0 + (i + 0.5) × quantum), the bed below, the bed above and the course
 *  index (unique over the tables: row × 1000 + k) */
export function courseTexels(M = MASONRY): { data: Float32Array; w: number; h: number } {
  const T = courseTables(M), w = TABLE_W, h = T.length, data = new Float32Array(w * h * 4);
  for (let r = 0; r < h; r++) {
    const beds = T[r];
    for (let i = 0; i < w; i++) {
      const y = M.y0 + (i + 0.5) * M.quantum; let k = 0;
      while (k < beds.length - 2 && beds[k + 1] > y) k++;
      const o = (r * w + i) * 4; data[o] = beds[k + 1]; data[o + 1] = beds[k]; data[o + 2] = r * 1000 + k; data[o + 3] = beds[k] - beds[k + 1];
    }
  }
  return { data, w, h };
}
/** CPU mirror of the shader's course lookup: { below, above, c } at height y in table row r */
export function courseAt(y: number, r: number, tex = courseTexels()): { below: number; above: number; c: number } {
  const i = Math.min(tex.w - 1, Math.max(0, Math.floor((y - MASONRY.y0) / MASONRY.quantum))), o = (r * tex.w + i) * 4;
  return { below: tex.data[o], above: tex.data[o + 1], c: tex.data[o + 2] };
}
/** Hoskins' hash12 (as materials.ts) */
export function hash12(x: number, y: number): number {
  const fr = (a: number) => a - Math.floor(a);
  let p0 = fr(x * 0.1031), p1 = fr(y * 0.1031), p2 = fr(x * 0.1031);
  const d = p0 * (p1 + 33.33) + p1 * (p2 + 33.33) + p2 * (p0 + 33.33);
  p0 += d; p1 += d; p2 += d;
  return fr((p0 + p1) * p2);
}
/** CPU mirror of the shader's head joints along a course (retainingHeads in materials.ts): the joints (m, along `a`) of
 *  course c between a0 and a1, for a point at fraction `eta` (−0.5 bottom … 0.5 top) of the course height h (the Grand
 *  Stair's oblique joints lean with it) */
export function headJoints(c: number, a0: number, a1: number, stair = false, eta = 0, h = 1, M = MASONRY): number[] {
  const B = M.block, L = B.base, n = B.per, off = hash12(c, 3.71) * n * L, out: number[] = [];
  for (let k = Math.floor((a0 - off) / (n * L)) - 1; k <= Math.floor((a1 - off) / (n * L)) + 1; k++) {
    for (let i = 0; i < n; i++) {
      const g = k * n + i, present = i === 0 || hash12(c + 0.5, g) < B.joint_p;
      if (!present) continue;
      const jit = i === 0 ? 0 : (hash12(g, c + 0.25) - 0.5) * 2 * B.jitter;
      const lean = stair && i > 0 ? (hash12(g + 0.75, c) - 0.5) * 2 * M.stair.oblique * eta * h : 0; // (the runs' ends stand plumb)
      const x = off + (g + jit) * L + lean;
      if (x >= a0 && x <= a1) out.push(x);
    }
  }
  return out.sort((a, b) => a - b);
}
/** CPU mirror of materials.ts retainingCells for one point of a vertical face (previews and tests): `t` along the face, world
 *  (x, y, z), the face's horizontal unit normal (nx, nz); `noise3` = a mirror of mx_noise_float(vec3) (tests/lib). Returns
 *  the block's key (course and block index), the distance to the nearest joint (m) and whether the point is foot stone */
export function retainingAt(t: number, x: number, y: number, z: number, nx: number, nz: number, noise3: (a: number, b: number, c: number) => number, tex = courseTexels(), M = MASONRY) {
  const BL = M.block, L = BL.base, NB = BL.per, F = M.foot, SB = M.stair.box;
  const step = (e: number, v: number) => (v >= e ? 1 : 0);
  const smooth = (a: number, b: number, v: number) => { const q = Math.min(1, Math.max(0, (v - a) / (b - a))); return q * q * (3 - 2 * q); };
  const inStair = step(SB[0], x) * step(x, SB[1]) * step(-SB[3], z) * step(z, -SB[2]);
  const dPlane = x * nx + z * nz, head = Math.floor(Math.atan2(nz, nx) * 36 / Math.PI + 0.5);
  const sec = Math.min(M.sections - 1, Math.floor(hash12(Math.floor(dPlane + 0.5), head + 17.3) * M.sections));
  const row = inStair ? M.sections : sec;
  const C = courseAt(y, row, tex), hC = Math.max(0.02, C.above - C.below), c = C.c;
  const eta = (y - (C.below + C.above) / 2) / hC;
  const off = hash12(c, 3.71) * NB * L, u = (t - off) / L, k = Math.floor(u / NB), xl = u - k * NB;
  let left = 0, right = NB, leftIdx = 0;
  for (let i = 1; i < NB; i++) {
    const g = k * NB + i;
    if (!(BL.joint_p >= hash12(c + 0.5, g))) continue; // (the shader's step(hash, joint_p))
    const lean = (hash12(g + 0.75, c) - 0.5) * 2 * M.stair.oblique * eta * hC / L * inStair;
    const pos = i + (hash12(g, c + 0.25) - 0.5) * 2 * BL.jitter + lean;
    if (pos <= xl) { left = Math.max(left, pos); leftIdx = Math.max(leftIdx, i); } else right = Math.min(right, pos);
  }
  const dHead = Math.min(xl - left, right - xl) * L, blk = k * NB + leftIdx;
  const pSplit = inStair ? M.stair.split_p : M.split.p, isSplit = (pSplit >= hash12(blk + 0.31, c + 5.7)) && (hC >= M.split.min_h || inStair) ? 1 : 0;
  const fT = hash12(blk + 2.9, c + 0.61), f = inStair ? M.stair.f[0] + fT * (M.stair.f[1] - M.stair.f[0]) : M.split.f[0] + fT * (M.split.f[1] - M.split.f[0]);
  const zs = C.below + hC * (hash12(blk + 7.3, c + 1.9) >= 0.5 ? 1 - f : f);
  const upper = isSplit && y >= zs ? 1 : 0, below = upper ? zs : C.below, above = isSplit && !upper ? zs : C.above;
  const dBedC = Math.min(y - below, above - y), cU = c + upper * 0.5;
  const faceWS = Math.max(step(0.5, -nx), step(0.5, nz));
  const mask = smooth(F.theta - F.w, F.theta + F.w, noise3(x / F.lambda + F.offset[0], 0.5, z / F.lambda + F.offset[1]));
  const footTop = mask * faceWS * (1 - inStair) * F.height;
  const q = [t / F.cell, (y - F.ground) / F.row], qc = [Math.floor(q[0]), Math.floor(q[1])];
  const seedOf = (cx: number, cy: number) => [cx + 0.5 + (hash12(cx + 0.13, cy + 9.1) - 0.5) * 2 * F.jitter[0], cy + 0.5 + (hash12(cy + 4.7, cx + 0.37) - 0.5) * 2 * F.jitter[1]];
  let best = 1e9, s1 = [0, 0], c1 = [0, 0];
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const cc = [qc[0] + i, qc[1] + j], s = seedOf(cc[0], cc[1]), d2 = (q[0] - s[0]) ** 2 + (q[1] - s[1]) ** 2; if (d2 <= best) { best = d2; s1 = s; c1 = cc; } }
  const inFoot = s1[1] * F.row <= footTop ? 1 : 0;
  // (as the shader: every neighbour evaluated, the own seed's weight zero; mix(a, b, 0) = a + (b - a) × 0 is NaN if b is)
  let edge = 1e3, eDir = [0, 1];
  const mix = (a: number, b: number, t: number) => a + (b - a) * t;
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
    const s = seedOf(qc[0] + i, qc[1] + j), dd = [s1[0] - s[0], s1[1] - s[1]], ln = Math.hypot(dd[0], dd[1]), other = ln >= 1e-4 ? 1 : 0;
    const ns = [dd[0] / Math.max(ln, 1e-4), dd[1] / Math.max(ln, 1e-4)], dS = (q[0] - (s1[0] + s[0]) / 2) * ns[0] + (q[1] - (s1[1] + s[1]) / 2) * ns[1];
    const nm = [ns[0] / F.cell, ns[1] / F.row], nl = Math.hypot(nm[0], nm[1]), dM = dS / Math.max(nl, 1e-6);
    const counts = (inFoot || s[1] * F.row <= footTop ? 1 : 0) * other, dE = mix(1e3, dM, counts), m = (edge >= dE ? 1 : 0) * other;
    edge = Math.min(edge, dE); eDir = [mix(eDir[0], nm[0] / Math.max(nl, 1e-6), m), mix(eDir[1], nm[1] / Math.max(nl, 1e-6), m)];
  }
  const dJoint = inFoot ? edge : Math.min(dBedC, dHead, edge);
  return { key: inFoot ? `f${c1[0]},${c1[1]}` : `${cU},${blk}`, dJoint, inFoot, eDir };
}
