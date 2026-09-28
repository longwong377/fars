// Source meshes for the Blender bake of the columns' turned and boxed members and of the shaft tiles (D-328; BLENDER_PLAN
// rows 1 and 4). As protome.ts: nothing is drawn by hand in Blender, every number comes from the project's own model
// (src/arch/sculpt.ts, src/data/sculpture.json, SITE_SPEC's orders) and the carving and dressing from tools/blender/columns.json:
//  - high.ply: the member's smooth form (the same profile functions the game's lathes sample, evaluated densely) with the
//    photographed carving as relief (the bell base's scalloped tongues and corded pendant leaves, the palm's veined leaves and
//    the bead row at its neck, the calyx's grooved sepals and crown of tips, the collar's bead row, the torus's worked
//    arrises) and the dressing of the stone (polish with the unevenness of hand work, pits; square plinths' eased arrises and
//    setting nicks; the timber's adze scallops and checks; the shafts' hand-cut flute arrises, drum joints and chips, the
//    unfluted drums' tooling, the posts' floated plaster and hairline cracks);
//  - lod0.ply, lod1.ply: the game's own member of the reference order (sculpt.ts memberMesh, MEMBER_REF), the bake's targets
//    (Smart UV Project in Blender); for a shaft tile, a band of the reference shaft exactly as sculpt.ts shaftRows builds it,
//    three drums tall and the whole way round, with the tile coordinates the game uses (sculpt.ts shaftUV), so the map
//    repeats up every shaft of that kind.
// Usage: npx tsx tools/blender/sources/column_member.ts <outDir> <member|shaft kind> <spacing m>
import { mkdirSync, writeFileSync } from 'node:fs';
import S from '../../../src/data/sculpture.json';
import { SPEC } from '../../../src/arch/spec';
import { order } from '../../../src/arch/orders';
import { bellRadius, memberMesh, MEMBER_REF, srow, leaf, fluteDepth, shaftDrumH, SHAFT_TILE, bboxOf, type MemberName, type Lod } from '../../../src/arch/sculpt';
import { smoothstep } from '../../../src/arch/sdf';
import type { NormMesh } from '../../../src/arch/sdf';
import type { ColumnOrder } from '../../../src/arch/parts';
import { writePLYuv } from '../lib/ply_uv';
import CJ from '../columns.json';

const [out, what, spS] = process.argv.slice(2);
if (!out || !what || !spS) { console.error('usage: column_member.ts <outDir> <member> <spacing>'); process.exit(2); }
const SP = +spS, TAU = Math.PI * 2, C = CJ as any, P = (SPEC as any).global.r_column_proportions.v, SC = S as any;
mkdirSync(out, { recursive: true });
const t0 = Date.now();

// ------------------------------------------------------------------------------------------------ noise (deterministic)
function hash(i: number, j: number, k = 0, s = 0): number { // [0, 1)
  let h = Math.imul(i | 0, 0x8da6b343) ^ Math.imul(j | 0, 0xd8163841) ^ Math.imul(k | 0, 0xcb1ab31f) ^ Math.imul(s | 0, 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995); h ^= h >>> 15; h = Math.imul(h, 0x27d4eb2d); h ^= h >>> 16; return (h >>> 0) / 4294967296;
}
const fade = (t: number) => t * t * (3 - 2 * t);
/** value noise in [-1, 1] on a lattice periodic in u with period pu (and in v with pv when given): lattice units */
function pnoise(u: number, v: number, pu: number, pv = 0, s = 0): number {
  const iu = Math.floor(u), iv = Math.floor(v), fu = fade(u - iu), fv = fade(v - iv);
  const m = (a: number, p: number) => (p > 0 ? ((a % p) + p) % p : a);
  const g = (a: number, b: number) => hash(m(a, pu), m(b, pv), 7, s) * 2 - 1;
  const a = g(iu, iv), b = g(iu + 1, iv), c = g(iu, iv + 1), d = g(iu + 1, iv + 1);
  return (a + (b - a) * fu) + ((c + (d - c) * fu) - (a + (b - a) * fu)) * fv;
}
/** the stone's polish (columns.json stone): undulation octaves and rare pits, at surface coordinates (a, b) in metres; `pa`,
 *  `pb` > 0: periodic in a (b) with that length (the shaft tiles wrap round and repeat up) */
function dressing(a: number, b: number, pa = 0, pb = 0, s = 0): number {
  const St = C.stone; let r = 0;
  St.undulation.forEach(([L, A]: number[], o: number) => {
    const nu = pa > 0 ? Math.max(1, Math.round(pa / L)) : 0, nv = pb > 0 ? Math.max(1, Math.round(pb / L)) : 0;
    r += A * pnoise(pa > 0 ? (a / pa) * nu : a / L, pb > 0 ? (b / pb) * nv : b / L, nu, nv, s * 31 + o);
  });
  // pits: one chance per cell of the pit spacing
  const cell = 1 / Math.sqrt(St.pits.per_m2), ca = pa > 0 ? pa / Math.max(1, Math.round(pa / cell)) : cell, cb = pb > 0 ? pb / Math.max(1, Math.round(pb / cell)) : cell;
  const na = pa > 0 ? Math.round(pa / ca) : 0, nb = pb > 0 ? Math.round(pb / cb) : 0;
  const ia = Math.floor(a / ca), ib = Math.floor(b / cb);
  for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
    const I = ia + di, J = ib + dj, Iw = na ? ((I % na) + na) % na : I, Jw = nb ? ((J % nb) + nb) % nb : J;
    const px = (I + hash(Iw, Jw, 1, s)) * ca, py = (J + hash(Iw, Jw, 2, s)) * cb, R = St.pits.r_m[0] + (St.pits.r_m[1] - St.pits.r_m[0]) * hash(Iw, Jw, 3, s);
    const q = Math.hypot(a - px, b - py); if (q < R) r -= St.pits.depth_m * (1 - (q / R) ** 2);
  }
  return r;
}
/** a rounded bump of height h and radius w at distance d (0 beyond) */
const cord = (d: number, w: number, h: number) => (Math.abs(d) < w / 2 ? h * Math.sqrt(1 - (2 * d / w) ** 2) : 0);

// ------------------------------------------------------------------------------------------------ dense surfaces
interface Mesh { pos: number[]; idx: number[] }
const M: Mesh = { pos: [], idx: [] };
/** a lathe band: nu samples round (wrapping), rows at `ts`; profile(t) -> [y, r]; rel(theta, t, y, r) radial relief (m) */
function lathe(ts: number[], profile: (t: number) => [number, number], rel: (th: number, t: number, y: number, r: number) => number) {
  const rMax = Math.max(...ts.map(t => profile(t)[1])), nu = Math.max(64, Math.ceil((TAU * rMax) / SP)), o = M.pos.length / 3;
  // the relief stands along the profile's own normal (a shoulder or a torus is carved square to its surface, not radially)
  for (const t of ts) {
    const [y, r] = profile(t), e = 1e-4, p0 = profile(Math.max(0, t - e)), p1 = profile(Math.min(1, t + e)), dy = p1[0] - p0[0], dr = p1[1] - p0[1], l = Math.hypot(dy, dr) || 1, nr = dy / l, ny = -dr / l;
    for (let i = 0; i < nu; i++) { const th = (i / nu) * TAU, q = rel(th, t, y, r), R = Math.max(1e-4, r + q * nr); M.pos.push(R * Math.cos(th), y + q * ny, R * Math.sin(th)); }
  }
  for (let j = 0; j + 1 < ts.length; j++) for (let i = 0; i < nu; i++) {
    const a = o + j * nu + i, b = o + j * nu + ((i + 1) % nu), c = o + (j + 1) * nu + ((i + 1) % nu), d = o + (j + 1) * nu + i;
    M.idx.push(a, d, c, a, c, b);
  }
}
/** rows spaced at SP along the profile's own arc length (at least `min`) */
function rowsAlong(profile: (t: number) => [number, number], min = 8): number[] {
  const K = 400; let L = 0, prev = profile(0); const acc = [0];
  for (let k = 1; k <= K; k++) { const p = profile(k / K); L += Math.hypot(p[0] - prev[0], p[1] - prev[1]); acc.push(L); prev = p; }
  const n = Math.max(min, Math.ceil(L / SP)), ts: number[] = [];
  for (let j = 0; j <= n; j++) { const s = (j / n) * L; let k = 1; while (k < K && acc[k] < s) k++; const f = (s - acc[k - 1]) / Math.max(1e-12, acc[k] - acc[k - 1]); ts.push((k - 1 + f) / K); }
  return ts;
}
/** a flat annulus (disc when r0 = 0) at height y, facing up (+1) or down (-1) */
function disc(y: number, r0: number, r1: number, up: 1 | -1) {
  const nu = Math.max(64, Math.ceil((TAU * r1) / SP)), nr = Math.max(2, Math.ceil((r1 - r0) / SP)), o = M.pos.length / 3;
  for (let j = 0; j <= nr; j++) { const r = r0 + ((r1 - r0) * j) / nr; for (let i = 0; i < nu; i++) { const th = (i / nu) * TAU; M.pos.push(r * Math.cos(th), y + dressing(r * Math.cos(th), r * Math.sin(th), 0, 0, 5) * up, r * Math.sin(th)); } }
  for (let j = 0; j < nr; j++) for (let i = 0; i < nu; i++) {
    const a = o + j * nu + i, b = o + j * nu + ((i + 1) % nu), c = o + (j + 1) * nu + ((i + 1) % nu), d = o + (j + 1) * nu + i;
    if (up > 0) M.idx.push(a, c, d, a, b, c); else M.idx.push(a, d, c, a, c, b); // (radial x round points down: the up face winds the other way)
  }
}
/** a box (half extents h, centre c) with arrises rounded to `r`, the x and z half extents scaled by `taper(y)` (the plain
 *  capital's bolster), each face displaced along its normal by rel(face, a, b) (a, b: metres in the face) */
function roundedBox(c: number[], h: number[], r: number, rel: (face: number, a: number, b: number, n: number[]) => number, taper?: (y: number) => number) {
  const inner = h.map(x => Math.max(1e-4, x - r));
  const faces: [number, number, number, number][] = [[0, 1, 1, 2], [0, -1, 1, 2], [1, 1, 0, 2], [1, -1, 0, 2], [2, 1, 0, 1], [2, -1, 0, 1]]; // axis, sign, a-axis, b-axis
  faces.forEach(([ax, sg, aa, bb], fi) => {
    const na = Math.max(4, Math.ceil((2 * h[aa]) / SP)), nb = Math.max(4, Math.ceil((2 * h[bb]) / SP)), o = M.pos.length / 3;
    for (let j = 0; j <= nb; j++) for (let i = 0; i <= na; i++) {
      const p = [0, 0, 0]; p[ax] = sg * h[ax]; p[aa] = -h[aa] + (2 * h[aa] * i) / na; p[bb] = -h[bb] + (2 * h[bb] * j) / nb;
      const q = p.map((x, k) => Math.max(-inner[k], Math.min(inner[k], x))), d = p.map((x, k) => x - q[k]), l = Math.hypot(d[0], d[1], d[2]) || 1;
      const n = d.map(x => x / l), s = r + rel(fi, p[aa], p[bb], n), P = q.map((x, k) => x + n[k] * s);
      const ty = taper ? taper(P[1] + c[1]) : 1;
      M.pos.push(c[0] + P[0] * ty, c[1] + P[1], c[2] + P[2] * ty);
    }
    for (let j = 0; j < nb; j++) for (let i = 0; i < na; i++) {
      const a = o + j * (na + 1) + i, b = a + 1, cc = a + na + 2, d = a + na + 1;
      // outward winding: (a-axis x b-axis) . normal > 0
      const right = crossSign(aa, bb, ax) * sg > 0;
      if (right) M.idx.push(a, b, cc, a, cc, d); else M.idx.push(a, cc, b, a, d, cc);
    }
  });
}
function crossSign(a: number, b: number, n: number) { const e = [0, 0, 0], f = [0, 0, 0]; e[a] = 1; f[b] = 1; const x = [e[1] * f[2] - e[2] * f[1], e[2] * f[0] - e[0] * f[2], e[0] * f[1] - e[1] * f[0]]; return x[n]; }

// ------------------------------------------------------------------------------------------------ the members
const D0 = (o: ColumnOrder) => o.shaftD;
const tr = () => SC.lod.tessellation.v;
/** the torus of a base from yT to hB (sculpture.json base.torus), its flutes' arrises worked round */
function torus(o: ColumnOrder, yT: number) {
  const T = srow('base', 'torus'), D = D0(o), hB = o.baseH, rIn = T.r_in * D, rOut = T.r_out * D, F = T.flutes, w = (hB - yT) / F / 2, ar = C.torus.arris_r_m;
  const prof = (t: number): [number, number] => [yT + (hB - yT) * t, rIn + (rOut - rIn) * Math.sqrt(Math.max(0, 1 - (2 * t - 1) ** 2))];
  const dep = (t: number) => { const loc = (t * F - Math.floor(Math.min(t * F, F - 1e-9)) - 0.5) * 2 * w, a = w - Math.abs(loc); let d = fluteDepth(loc, w, T.sagitta * w); if (a < ar) { const sl = (fluteDepth(w - ar, w, T.sagitta * w) - fluteDepth(w - ar * 0.5, w, T.sagitta * w)) / (ar * 0.5); d += (ar * Math.abs(sl) / 2) * (1 - a / ar) ** 2; } return d; };
  const ts = rowsAlong(t => [prof(t)[0], prof(t)[1] - dep(t)], 60);
  lathe(ts, t => [prof(t)[0], Math.max(rIn, prof(t)[1] - dep(t))], (th, t, y, r) => dressing(th * r, y, TAU * r, 0, 11));
  disc(hB, 0, rIn, 1);
}
function baseHigh(o: ColumnOrder) {
  const D = D0(o), hB = o.baseH;
  if (o.base === 'bell') {
    const B = srow('base', 'bell'), K = C.base_bell, hf = B.foot_h * hB, hb = B.bell_h * hB, rb = o.baseW / 2, rBot = rb * (1 - B.lip), rTop = B.r_top * D, nL = K.leaves;
    disc(0, 0, rb, -1);
    lathe(rowsAlong(t => [hf * t, rb], 12), t => [hf * t, rb], (th, t, y, r) => dressing(th * r, y, TAU * r, 0, 1) - (t < 0.02 ? 0.002 * (1 - t / 0.02) : 0));
    disc(hf, rBot, rb, 1);
    const prof = (t: number): [number, number] => [hf + hb * t, bellRadius(B, t, rTop, rBot)];
    const rel = (th: number, t: number, y: number, r: number) => {
      const pitch = (TAU * r) / nL, hp = pitch / 2, u = (th / TAU) * nL, lu = u - Math.floor(u) - 0.5, x = lu * pitch; // x: m from the leaf's axis
      const s = 1 - t, sy = s * hb, hwL = hp * 0.9 * (0.66 + 0.34 * smoothstep(K.band, K.behind_tip + 0.1, s)), cw = K.cord_w * D, ch = K.cord_h * D;
      let rr = 0;
      // the pendant leaf: outline cord, crested face; sides straight to 60 % of the bell, then closing to a rounded point
      const s1 = 0.6, hw = s < s1 ? hwL : hwL * Math.sqrt(Math.max(0, 1 - ((s - s1) / (K.tip - s1)) ** 2)) * (s < K.tip ? 1 : 0);
      if (s < K.tip + 0.02) {
        const d = Math.abs(x) - hw;
        if (d < 0 && hw > 0) rr = Math.max(rr, K.face_h * D + K.crest_h * D * Math.max(0, 1 - Math.abs(x) / hw));
        rr = Math.max(rr, cord(d, cw, ch));
      }
      // the tongue over each gap, the upper band: straight sides, round bottom, outlined by its cord
      const Lt = K.band * hb, hwt = hp * 0.94, xt = Math.abs(x) - hp; // from the tongue's axis (the gap)
      if (sy < Lt + K.tongue_cord_w * D) {
        const dT = sy < Lt - hwt ? Math.abs(xt) - hwt : Math.hypot(xt, sy - (Lt - hwt)) - hwt;
        if (dT < 0) rr = Math.max(rr, K.tongue_h * D * (1 - 0.4 * (xt / hwt) ** 2));
        rr = Math.max(rr, cord(dT, K.tongue_cord_w * D, ch * 0.9));
      }
      // the pointed tip of the leaf behind, sunk in the gap below the tongue
      if (s > K.band && s < K.behind_tip) { const hwB = (hp - hwL - cw / 2) * (1 - (s - K.band) / (K.behind_tip - K.band)); if (Math.abs(xt) < hwB && rr <= 1e-6) rr = K.behind_h * D; }
      return rr + dressing(th * r, y, TAU * r, 0, 2);
    };
    lathe(rowsAlong(prof, 200), prof, rel);
    torus(o, hf + hb);
  } else if (o.base === 'square2') {
    const st = srow<{ step_h: number[] }>('base', 'square2').step_h, s2 = P.square2_lower_scale, K = C.square2, h0 = st[0] * hB, h1 = st[1] * hB;
    const nick = (fi: number, a: number, b: number, lowH: number, box: number) => { // setting nicks along the lower arrises (side faces)
      if (fi === 2 || fi === 3) return 0; const bLow = -lowH; let r = 0;
      const along = a, near = b - bLow; if (near > 0.06) return 0;
      const cell = 1 / K.nicks.per_m, i = Math.floor(along / cell);
      for (const k of [i - 1, i, i + 1]) { if (hash(k, fi, box, 9) > 0.6) continue; const c0 = (k + hash(k, fi, box, 10)) * cell, L = K.nicks.len_m[0] + (K.nicks.len_m[1] - K.nicks.len_m[0]) * hash(k, fi, box, 11);
        const q = ((along - c0) / (L / 2)) ** 2 + (near / (L * 0.4)) ** 2; if (q < 1) r = Math.min(r, -K.nicks.depth_m * (1 - q)); }
      return r;
    };
    // (face index: 0/1 +-x, 2/3 +-y, 4/5 +-z; a, b the face's own axes: for the side faces b is y on 0/1 (a = z) and 4/5 (a = x, b = y))
    const relB = (box: number, hy: number) => (fi: number, a: number, b: number) => dressing(a + fi * 7.3, b + box * 3.1, 0, 0, 20 + fi) + (fi === 0 || fi === 1 ? nick(fi, a, b, hy, box) : fi >= 4 ? nick(fi, a, b, hy, box) : 0);
    roundedBox([0, h0 / 2, 0], [(o.baseW * s2) / 2, h0 / 2, (o.baseW * s2) / 2], K.arris_r_m, relB(0, h0 / 2));
    roundedBox([0, h0 + h1 / 2, 0], [o.baseW / 2, h1 / 2, o.baseW / 2], K.arris_r_m, relB(1, h1 / 2));
    torus(o, h0 + h1);
  } else {
    const Pb = srow('base', 'plain'), pb = P.plain_base as number[], hd = Pb.drum_h * hB, r0 = (D / 2) * pb[1], r1 = (D / 2) * pb[0], ar = C.base_plain.arris_r_m;
    disc(0, 0, r0 - ar, -1);
    const prof = (t: number): [number, number] => [hd * t, r0 + (r1 - r0) * t];
    lathe(rowsAlong(prof, 40), prof, (th, t, y, r) => dressing(th * r, y, TAU * r, 0, 3) - (y < ar ? ar * (1 - Math.sqrt(Math.max(0, 1 - ((ar - y) / ar) ** 2))) : 0) - (hd - y < ar ? ar * (1 - Math.sqrt(Math.max(0, 1 - ((ar - (hd - y)) / ar) ** 2))) : 0));
    disc(hd, 0, r1 - ar, 1);
    torus(o, hd);
  }
}
function beadRing(th: number, y: number, r: number, yc: number, n0: number, br: number, bh: number, rRing = r) {
  // n0 = 0: as many as fit round the ring touching (a bead row is close-set on every photographed member)
  const n = n0 || Math.round((TAU * rRing) / (2.1 * br)), pitch = (TAU * r) / n, u = (th / TAU) * n, x = (u - Math.round(u)) * pitch, q = Math.hypot(x, y - yc);
  if (q >= br) return 0; const a = 1 - (q * q) / (br * br); return bh * a * Math.sqrt(a);
}
function bellsHigh(o: ColumnOrder) {
  const D = D0(o), H = o.capitalH, y0 = o.height - H, s = srow('capital', 'composite_split'), h1 = s.palm * H, h2 = s.calyx * H;
  const Pm = srow('capital', 'palm'), K = C.palm, rShaft = (D / 2) * P.shaft_top_ratio, nL = Pm.leaves;
  const pprof = (t: number): [number, number] => {
    if (t <= Pm.rim_h) return [y0 + h1 * t, rShaft + (Pm.r_rim * D - rShaft) * (t / Pm.rim_h) ** Pm.rim_pow];
    const q = (t - Pm.rim_h) / (1 - Pm.rim_h); return [y0 + h1 * t, Pm.r_neck * D + (Pm.r_rim - Pm.r_neck) * D * (1 - q ** Pm.bulge_pow)];
  };
  const sOf = (t: number) => (t <= Pm.rim_h ? Pm.tip : Pm.tip * (1 - (t - Pm.rim_h) / (1 - Pm.rim_h)));
  const bead = K.beads, yb = y0 + h1 - bead.r * D * 1.05;
  disc(y0, 0, rShaft, -1);
  lathe(rowsAlong(pprof, 160), pprof, (th, t, y, r) => {
    const u = (th / TAU) * nL, lu = u - Math.floor(u) - 0.5, sv = sOf(t);
    const env = leaf(lu, sv, Pm.leaf_w, Pm.leaf_edge, 0); // the leaf's body (0..1), as the game's lathe carries it
    let rr = K.leaf_h * D * env;
    if (env > 0) {
      const hw = Pm.leaf_w, a = Math.abs(lu) / hw; // across the leaf, 0 at the midrib, 1 at its edge
      rr += cord(lu * ((TAU * r) / nL), 0.012 * D, K.midrib_h * D) * env;
      for (let k = 1; k <= K.veins; k++) rr += cord(((a - k / (K.veins + 1)) * hw * TAU * r) / nL, 0.006 * D, K.vein_h * D) * env;
    }
    rr = Math.max(rr, beadRing(th, y, r, yb, bead.n, bead.r * D, bead.h * D, Pm.r_neck * D));
    return rr + dressing(th * r, y, TAU * r, 0, 4);
  });
  const Cx = srow('capital', 'calyx'), KC = C.calyx, yc0 = y0 + h1, nR = Cx.ribs;
  const cprof = (t: number): [number, number] => { const tf = Math.min(1, t / (1 - Cx.rim_h)); return [yc0 + h2 * t, (Cx.r_base + (Cx.r_rim - Cx.r_base) * tf ** Cx.flare_pow) * D]; };
  lathe(rowsAlong(cprof, 120), cprof, (th, t, y, r) => {
    const u = (th / TAU) * nR, lu = u - Math.floor(u) - 0.5;
    let rr = Cx.relief * D * (Math.cos(lu * TAU) * 0.5 + 0.5) ** Cx.rib_pow * (Cx.rib_base + (1 - Cx.rib_base) * t);
    const pitch = (TAU * r) / nR;
    rr -= cord((Math.abs(lu) - 0.2) * pitch, 0.05 * pitch, KC.groove_h * D);
    const tc = 1 - KC.crown; // the crown of sepal tips at the rim
    if (t > tc) { const q = (t - tc) / KC.crown, hwT = 0.46 * Math.sqrt(Math.max(0, 1 - q * q)); rr += Math.abs(lu) < hwT ? KC.crown_h * D * smoothstep(0, 0.04, hwT - Math.abs(lu)) : -KC.crown_h * D * 0.4; }
    return rr + dressing(th * r, y, TAU * r, 0, 6);
  });
  disc(yc0 + h2, 0, Cx.r_rim * D, 1);
}
function collarHigh(o: ColumnOrder) {
  const D = D0(o), H = o.capitalH, y0 = o.height - H, B = srow('capital', 'bull'), hc = B.collar_h * H, rc = B.collar_r * D, rs = (D / 2) * P.shaft_top_ratio, K = C.collar;
  const yf = y0 + hc * B.collar_flare, prof = (t: number): [number, number] => { const y = y0 + hc * t; return [y, y < yf ? rs + (rc - rs) * ((y - y0) / (yf - y0)) : rc]; };
  const yb = yf + (y0 + hc - yf) / 2;
  disc(y0, 0, rs, -1);
  lathe(rowsAlong(prof, 60), prof, (th, t, y, r) => Math.max(beadRing(th, y, r, yb, K.beads.n, K.beads.r * D, K.beads.h * D, rc), 0) + dressing(th * r, y, TAU * r, 0, 7));
  disc(y0 + hc, 0, rc, 1);
}
function plainCapHigh(o: ColumnOrder) {
  const D = D0(o), H = o.capitalH, y0 = o.height - H, top = o.height, Pl = srow('capital', 'plain'), wA = P.capital_boxes.plain * D, ha = Pl.abacus_h * H, hb = H - ha, K = C.capital_plain;
  const wood = (fi: number, a: number, b: number) => {
    let r = K.adze_h_m * (0.5 - 0.5 * Math.cos((TAU * (a + 0.3 * pnoise(b * 8, fi, 0))) / K.adze_pitch_m)) * (0.7 + 0.3 * pnoise(a * 10, b * 10 + fi * 5, 0));
    if (fi !== 2 && fi !== 3) for (let k = 0; k < K.checks.per_face; k++) { const bc = (hash(k, fi, 1, 3) - 0.5) * 0.8 * hb, wv = bc + 0.004 * pnoise(a * 12, k + fi * 3, 0); if (Math.abs(b - wv) < K.checks.w_m / 2 && Math.abs(a) < 0.3) r -= K.checks.depth_m; }
    return -r;
  };
  const bb = (Pl.bolster_bottom * D) / 2, sT = wA / (Pl.bolster_bottom * D);
  roundedBox([0, y0 + hb / 2, 0], [bb, hb / 2, bb], K.arris_r_m, wood, y => 1 + (sT - 1) * Math.max(0, Math.min(1, (y - y0) / hb)));
  roundedBox([0, top - ha / 2, 0], [wA / 2, ha / 2, wA / 2], K.arris_r_m, (fi, a, b) => wood(fi + 6, a, b));
}

// ------------------------------------------------------------------------------------------------ shaft tiles
const SHAFT_REF: Record<string, [string, Partial<ColumnOrder>, number]> = { // [building, order options, built]
  shaft_f48: ['apadana', { base: 'bell', capital: 'composite' }, 1], shaft_f40: ['hall100', { base: 'bell', capital: 'bull' }, 1],
  shaft_drums: ['hall100', { base: 'bell', capital: 'bull' }, 0.99], shaft_plaster: ['treasury', { base: 'square2', capital: 'plain', material: 'timber' }, 1],
};
interface Tile { o: ColumnOrder; y0: number; yT: number; H: number; drumH: number; R: (y: number) => number; N: number }
function tileOf(kind: string): Tile {
  const [b, opts] = SHAFT_REF[kind], o = order(b, opts), shaftH = o.height - o.baseH - o.capitalH, dH = shaftDrumH(o), nd = Math.round(shaftH / dH);
  const k0 = Math.max(0, Math.floor((nd - SHAFT_TILE.drums) / 2)), R0 = o.shaftD / 2, Rt = R0 * P.shaft_top_ratio;
  return { o, y0: o.baseH, yT: o.baseH + k0 * dH, H: SHAFT_TILE.drums * dH, drumH: dH, R: y => R0 + (Rt - R0) * ((y - o.baseH) / shaftH), N: o.flutes };
}
/** the game's shaft band at level `lod` between yT and yT + H with its tile coordinates (sculpt.ts shaftRows/shaftUV: same
 *  samples round, same flute section; rows only at the ends, as the game's shaft has none in between) */
function tileLow(kind: string, T: Tile, lod: Lod): { m: NormMesh; uv: Float32Array } {
  const TS = srow('shaft', 'tessellation'), F = srow('shaft', 'flutes'), fl = kind === 'shaft_f40' || kind === 'shaft_f48';
  const n = fl ? T.N * (lod ? TS.lod1_per_flute : TS.lod0_per_flute) : tr().shaft_plain[lod], ys = [T.yT, T.yT + T.H];
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (const y of ys) for (let i = 0; i <= n; i++) {
    const u = i / n, th = u * TAU, w = T.R(y) * Math.sin(Math.PI / T.N), x = (((u * T.N) % 1) - 0.5) * 2 * w;
    const r = T.R(y) - (fl ? fluteDepth(x, w, F.sagitta * w, 0) : 0); pos.push(r * Math.cos(th), y, r * Math.sin(th)); uv.push(u, (y - T.yT) / T.H);
  }
  const W = n + 1; for (let i = 0; i < n; i++) { const a = i, b = i + 1, c = W + i + 1, d = W + i; idx.push(a, d, c, a, c, b); }
  // normals: as creaseNormals would give them for this band (the crease angle of the lathes)
  const nrm = new Float32Array(pos.length), P3 = pos;
  const fn = (a: number, b: number, c: number) => { const ux = P3[b * 3] - P3[a * 3], uy = P3[b * 3 + 1] - P3[a * 3 + 1], uz = P3[b * 3 + 2] - P3[a * 3 + 2], vx = P3[c * 3] - P3[a * 3], vy = P3[c * 3 + 1] - P3[a * 3 + 1], vz = P3[c * 3 + 2] - P3[a * 3 + 2]; return [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx]; };
  for (let t = 0; t < idx.length; t += 3) { const f = fn(idx[t], idx[t + 1], idx[t + 2]); for (let k = 0; k < 3; k++) for (let q = 0; q < 3; q++) nrm[idx[t + k] * 3 + q] += f[q]; }
  for (let v = 0; v < nrm.length; v += 3) { const l = Math.hypot(nrm[v], nrm[v + 1], nrm[v + 2]) || 1; nrm[v] /= l; nrm[v + 1] /= l; nrm[v + 2] /= l; }
  return { m: { pos: new Float32Array(pos), nrm, idx: new Uint32Array(idx) }, uv: new Float32Array(uv) };
}
function shaftHigh(kind: string, T: Tile) {
  const F = srow('shaft', 'flutes'), margin = 0.06, ya = T.yT - margin, yb = T.yT + T.H + margin, Rm = T.R(T.yT + T.H / 2), circ = TAU * Rm;
  const fl = kind === 'shaft_f40' || kind === 'shaft_f48', K = fl ? C.shaft_fluted : kind === 'shaft_drums' ? C.shaft_drums : C.shaft_plaster;
  const nu = Math.ceil(circ / SP / (fl ? T.N : 1)) * (fl ? T.N : 1), nv = Math.ceil((yb - ya) / (SP * 0.7));
  const drum = (y: number) => Math.floor((y - T.yT) / T.drumH + 1e-9), drumW = (y: number) => ((drum(y) % SHAFT_TILE.drums) + SHAFT_TILE.drums) % SHAFT_TILE.drums;
  const joint = (y: number) => { const f = (y - T.yT) / T.drumH; return Math.abs(f - Math.round(f)) * T.drumH; }; // m to the nearest joint
  const vper = (y: number) => (((y - T.yT) % T.H) + T.H) % T.H; // periodic coordinate up the tile
  const rel = (th: number, y: number): number => {
    const r0 = T.R(y), a = th * Rm, b = vper(y); let r = dressing(a, b, circ, T.H, 12);
    const jd = joint(y);
    if (fl) {
      const w = r0 * Math.sin(Math.PI / T.N), u = (th / TAU) * T.N, fi = ((Math.floor(u) % T.N) + T.N) % T.N;
      const wander = (K.wander_m / w) * pnoise(b / 0.15, fi * 3.7, Math.round(T.H / 0.15), 0, 13) * 0.5; // the arris line wanders (flute units)
      const lu = u - Math.floor(u) - 0.5 + wander, x = lu * 2 * w, depth = 1 + K.depth_var * (hash(fi, 0, 0, 14) * 2 - 1);
      let d = fluteDepth(x, w, F.sagitta * w * depth);
      const ar = K.arris_r_m, e = w - Math.abs(x); if (e < ar) d += ar * 0.35 * (1 - e / ar) ** 2;
      r -= d;
      // setting chips at the arrises beside a joint (per joint of the tile, a few; periodic up the tile)
      const jn = ((Math.round((y - T.yT) / T.drumH) % SHAFT_TILE.drums) + SHAFT_TILE.drums) % SHAFT_TILE.drums;
      for (let c = 0; c < K.chips_per_joint; c++) {
        const cf = Math.floor(hash(jn, c, 1, 15) * T.N), up = hash(jn, c, 2, 15) > 0.5 ? 1 : -1, L = K.chip_len_m[0] + (K.chip_len_m[1] - K.chip_len_m[0]) * hash(jn, c, 3, 15);
        let du = u - cf; du -= Math.round(du / T.N) * T.N; const dx = du * 2 * w, dy = (y - (T.yT + Math.round((y - T.yT) / T.drumH) * T.drumH)) * up;
        if (dy < 0 || dy > L) continue; const q = (dx / (L * 0.35)) ** 2 + ((dy - L * 0.3) / (L * 0.7)) ** 2; if (q < 1) r -= K.chip_d_m * (1 - q);
      }
    } else if (kind === 'shaft_drums') {
      const tp = K.tool_pitch_m, nuT = Math.round(circ / tp), nvT = Math.round(T.H / tp);
      r += K.tool_h_m * (Math.abs(pnoise((a / circ) * nuT, (b / T.H) * nvT * 1.6, nuT, Math.round(nvT * 1.6), 16)) * 2 - 0.6);
      r += 0.0004 * (hash(drumW(y), 0, 0, 17) * 2 - 1); // a drum stands a fraction proud of the next
    } else {
      const [L, A] = K.float_m; r += A * pnoise((a / circ) * Math.round(circ / L), (b / T.H) * Math.round(T.H / L), Math.round(circ / L), Math.round(T.H / L), 18);
      for (let k = 0; k < K.cracks.vertical; k++) { const c0 = hash(k, 0, 0, 19) * circ, wv = 0.01 * pnoise(b / 0.2, k, Math.round(T.H / 0.2), 0, 20); let dd = a - c0 - wv; dd -= Math.round(dd / circ) * circ; const on = pnoise(b / 0.5, k + 9, Math.round(T.H / 0.5), 0, 21) > 0.1; if (on && Math.abs(dd) < K.cracks.w_m / 2) r -= K.cracks.depth_m; }
      for (let k = 0; k < K.cracks.rings; k++) { const yc = hash(k, 1, 0, 22) * T.H, wv = 0.006 * pnoise(a / 0.2, k, Math.round(circ / 0.2), 0, 23); let dd = b - yc - wv; dd -= Math.round(dd / T.H) * T.H; const on = pnoise(a / 0.4, k + 4, Math.round(circ / 0.4), 0, 24) > 0; if (on && Math.abs(dd) < K.cracks.w_m / 2) r -= K.cracks.depth_m; }
      return r; // plaster: no drum joints
    }
    // the joint: a hairline with a slight chamfer each side
    if (jd < K.joint_w_m / 2) r -= K.joint_d_m; else if (K.chamfer_m && jd < K.joint_w_m / 2 + K.chamfer_m) r -= (K.joint_w_m / 2 + K.chamfer_m - jd) * 0.5;
    return r;
  };
  const o = M.pos.length / 3;
  for (let j = 0; j <= nv; j++) { const y = ya + ((yb - ya) * j) / nv; for (let i = 0; i < nu; i++) { const th = (i / nu) * TAU, R = T.R(y) + rel(th, y); M.pos.push(R * Math.cos(th), y, R * Math.sin(th)); } }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = o + j * nu + i, b = o + j * nu + ((i + 1) % nu), c = o + (j + 1) * nu + ((i + 1) % nu), d = o + (j + 1) * nu + i; M.idx.push(a, d, c, a, c, b); }
  return { nu, nv };
}

// ------------------------------------------------------------------------------------------------ write
function highNormals(): NormMesh {
  const pos = new Float32Array(M.pos), idx = new Uint32Array(M.idx), nrm = new Float32Array(pos.length);
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3, ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2], vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; for (const q of [a, b, c]) { nrm[q] += nx; nrm[q + 1] += ny; nrm[q + 2] += nz; }
  }
  for (let v = 0; v < nrm.length; v += 3) { const l = Math.hypot(nrm[v], nrm[v + 1], nrm[v + 2]) || 1; nrm[v] /= l; nrm[v + 1] /= l; nrm[v + 2] /= l; }
  return { pos, nrm, idx };
}
const stats: Record<string, unknown> = { what, spacing: SP };
if (what.startsWith('shaft_')) {
  const T = tileOf(what); stats.tile = { order: T.o.id, yT: T.yT, H: T.H, drumH: T.drumH, N: T.N };
  stats.grid = shaftHigh(what, T);
  stats.high = writePLYuv(`${out}/high.ply`, highNormals());
  for (const l of [0, 1] as Lod[]) { const L = tileLow(what, T, l); stats[`lod${l}`] = writePLYuv(`${out}/lod${l}.ply`, L.m, L.uv); }
} else {
  const name = what as MemberName, [b, opts] = MEMBER_REF[name], o = order(b, opts);
  if (name.startsWith('base_')) baseHigh(o); else if (name === 'bells') bellsHigh(o); else if (name === 'collar') collarHigh(o); else plainCapHigh(o);
  stats.order = o.id; stats.high = writePLYuv(`${out}/high.ply`, highNormals());
  for (const l of [0, 1] as Lod[]) { const m = memberMesh(o, name, l)!; stats[`lod${l}`] = writePLYuv(`${out}/lod${l}.ply`, m); stats[`box${l}`] = bboxOf(m); }
}
stats.ms = Date.now() - t0;
writeFileSync(`${out}/source.json`, JSON.stringify(stats, null, 1));
console.log(JSON.stringify(stats));
