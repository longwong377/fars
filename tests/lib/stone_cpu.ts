// CPU mirror of the dressed-stone shading of src/render/materials.ts (D-157 ashlar, D-218 stone detail and arrises), per
// pixel as the shader evaluates it (band limits by the pixel footprint, joints box-filtered over it), and a minimal render of
// a sunlit wall: Lambert sun + sky on the shading normal, AgX tone mapping (three r186, grey axis), linear Y out. It measures
// what the rubric measures on a screenshot (Ystd/Y over a patch of stone), so a change to the stone can be judged before a
// SwiftShader render. Not bit-exact where the shader uses Worley noise (the pits: a jittered grid with its own hash here,
// statistically the same).
import { mxNoise2, mxNoise3, hash12 } from './mx_noise_cpu';
import { SURFACES, TONE_OCTAVES, TONE_NORM, TONE_OFFSETS, LAMINAE, LAM_NORM, STYLO_SPACING, pitMean, styloMean, ARRIS_K, type Joints, type StoneDef, type SurfaceDef } from '../../src/render/materials';
import { srgbToLinear } from '../../src/core/colour';

const fract = (x: number) => x - Math.floor(x);
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
export const smoothstep = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const bandLimit = (fp: number, lambda: number) => 1 - smoothstep(0.15, 0.35, fp / lambda);
const bandCover = (d: number, px: number, hw: number) => { const h = px / 2; return clamp(Math.max(0, Math.min(hw, d + h) - Math.max(-hw, d - h)) / px, 0, 1); };
const step = (e: number, x: number) => (x >= e ? 1 : 0);
const memo = new Map<object, number>();
const cached = (o: object, fn: () => number) => { let v = memo.get(o); if (v === undefined) { v = fn(); memo.set(o, v); } return v; };

/** materials.ts ashlarCells + headCells */
export function ashlarCells(a: number, b: number, J: Joints) {
  const V = J.vary!, H = J.course * 2, k = Math.floor(b / H), f = b - k * H;
  const split = hash12(k, 7.13) * (V.course[1] - V.course[0]) + V.course[0], above = step(split, f), c = 2 * k + above;
  const dBelow = f - above * split, dAbove = (above ? H : split) - f;
  return { dBed: Math.min(dBelow, dAbove), sBed: dBelow <= dAbove ? 1 : -1, c, ...headCells(a, J.block, V.jitter, c) };
}
export function headCells(a: number, L: number, jitter: number, c: number) {
  const u = (a - hash12(c, 3.71) * L) / L, j0 = Math.floor(u);
  const u0 = j0 + (hash12(c, j0) - 0.5) * jitter * 0.5, u1 = j0 + 1 + (hash12(c, j0 + 1) - 0.5) * jitter * 0.5;
  const d0 = Math.abs(u - u0), d1 = Math.abs(u - u1), un = d1 >= d0 ? u0 : u1;
  return { dHead: Math.min(d0, d1) * L, sHead: Math.sign(u - un), blk: j0 - 1 + step(u0, u) + step(u1, u) };
}
/** materials.ts blockIds */
export function blockIds(blk: number, c: number) {
  const t1 = hash12(blk + 0.37, c + 11.3), w = hash12(c * 1.618 + 5.1, blk + 2.9), t2 = hash12(blk * 0.71 + 19.1, c + 3.3);
  const m = (x: number, y: number, z: number) => fract(t1 * x + w * y + t2 * z);
  return { t1, t2, w, a: m(97.1, 0, 13.3), b: m(61.7, 17.3, 0), c: m(0, 29.9, 43.1), d: m(71.3, 0, 11.7), e: m(7.1, 53.9, 0), f: m(5.9, 0, 23.3), g: m(0, 37.1, 19.7), h: m(13.7, 41.3, 3.1) };
}
export type Ids = ReturnType<typeof blockIds>;
/** materials.ts blockToneFactor, luminance (the warm/cool split's luminance share, 0.27 × wc) */
export function blockTone(J: Joints, d: SurfaceDef, id: Ids): number {
  const tri = J.blockSd !== undefined, dev = tri ? id.t1 + id.t2 - 1 : 2 * id.t1 - 1;
  const tone = 1 + dev * (tri ? J.blockSd! * Math.sqrt(6) : d.blockTone ?? 0.08), wc = (2 * id.w - 1) * (J.warmCool ?? 0);
  return tone * (1 + 0.2126 * wc + 0.7152 * 0.2 * wc - 0.0722 * 1.2 * wc);
}
/** materials.ts toneFactor (luminance: no chroma), fp = |fwidth(p)| */
export function tone(d: SurfaceDef, x: number, y: number, z: number, fp: number): number {
  let t = 0; TONE_OCTAVES.forEach(([lam, w], i) => { const o = TONE_OFFSETS[i]; t += w * mxNoise3(x / lam + o[0], y / lam + o[1], z / lam + o[2]) * bandLimit(fp, lam); });
  return Math.max(0.2, 1 + t * d.tone!.sd * TONE_NORM);
}
/** a jittered-grid Worley F1 distance (cell units): statistically as mx_worley_noise_float_2d */
function worley2(x: number, y: number) {
  const X = Math.floor(x), Y = Math.floor(y); let best = 1e9;
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const cx = X + i + hash12(X + i + 0.13, Y + j + 7.7), cy = Y + j + hash12(X + i + 3.1, Y + j + 0.9); best = Math.min(best, Math.hypot(cx - x, cy - y)); }
  return best;
}
/** materials.ts stoneDetail on a vertical face (vs = 1) or a bedding plane (vs = 0): albedo factor, face-frame tilt */
export function stoneDetail(S: StoneDef, qx: number, qy: number, vs: number, id: Ids, fp: number) {
  const amp = S.beds * LAM_NORM * (0.25 + 1.5 * id.c), wave = Math.sin(qx * 2.1 + id.d * 40) * 0.03, stretch = vs ? 0.12 : 0.6;
  let lam = 0; LAMINAE.forEach(([L, w], i) => { lam += mxNoise2((qy + wave) / L, (qx / L) * stretch + (i ? id.e : id.d) * 37.7) * w * bandLimit(fp, L); });
  let f = 1 + lam * amp;
  const present = step(id.f, S.stylo.share) * vs, sp = STYLO_SPACING[0] + id.g * STYLO_SPACING[1];
  const y2 = (x: number) => qy + Math.sin(x * 6.1 + id.g * 50) * 0.018 + Math.sin(x * 19.3 + id.a * 23) * 0.007 + Math.abs(fract(x / 0.008) * 2 - 1) * 0.003;
  const dist = (x: number, yy: number) => Math.abs(fract((yy + y2(x) - qy) / sp + id.c) - 0.5) * sp;
  const dd = dist(qx, qy), fw = Math.abs(dist(qx + fp / 1.414, qy) - dd) + Math.abs(dist(qx, qy + fp / 1.414) - dd); // fwidth(dist)
  f *= (1 - bandCover(dd, Math.max(fw, 1e-6), S.stylo.w / 2) * present * S.stylo.dark) / (vs ? cached(S.stylo, () => styloMean(S.stylo)) : 1);
  const r = S.pits.r * (0.3 + 1.4 * id.h), px = fp / 1.414 / S.pits.cell, near = 1 - smoothstep(0.25, 0.6, px * 1.414);
  const pitN = 1 - smoothstep(r * 0.75, r, worley2(qx / S.pits.cell, qy / S.pits.cell));
  const pit = (1 - near) * (1 - Math.exp(-Math.PI * r * r)) + near * pitN;
  f *= (1 - pit * S.pits.dark) / cached(S.pits, () => pitMean(S.pits));
  const ang = Math.PI / 4 + (id.b - 0.5) * 1.4, cs = Math.cos(ang), sn = Math.sin(ang), u = qx * cs + qy * sn, v = qy * cs - qx * sn;
  const iv = Math.floor(v / S.tool.w), iu = Math.floor(u / S.tool.l + hash12(iv, 1.7)), vis = 1 - smoothstep(0.15, 0.35, fp / S.tool.w);
  return { f, tx: (hash12(iu, iv + 5.5) - 0.5) * 2 * S.tool.tilt * vis, ty: (hash12(iv + 2.2, iu) - 0.5) * 2 * S.tool.tilt * vis };
}

/** AgX (three r186 agxToneMapping) on a grey input: linear Y in, linear Y out */
const M_IN = [[0.856627153315983, 0.137318972929847, 0.11189821299995], [0.0951212405381588, 0.761241990602591, 0.0767994186031903], [0.0482516061458583, 0.101439036467562, 0.811302368396859]];
const M_OUT = [[1.1271005818144368, -0.1413297634984383, -0.14132976349843826], [-0.11060664309660323, 1.157823702216272, -0.11060664309660294], [-0.016493938717834573, -0.016493938717834257, 1.2519364065950405]];
const agxC = (x: number) => { const x2 = x * x, x4 = x2 * x2; return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232; };
export function agxGrey(Y: number): number {
  // three's mat3(vec3 a, vec3 b, vec3 c) is column-major: out_i = Σ_j M[j][i] v_j
  const v = [0, 1, 2].map(i => M_IN[0][i] * Y + M_IN[1][i] * Y + M_IN[2][i] * Y);
  const t = v.map(c => agxC(clamp((Math.log2(Math.max(c, 1e-10)) + 12.47393) / (4.026069 + 12.47393), 0, 1)));
  const o = [0, 1, 2].map(i => Math.max(0, M_OUT[0][i] * t[0] + M_OUT[1][i] * t[1] + M_OUT[2][i] * t[2]) ** 2.2);
  return clamp(0.2126 * o[0] + 0.7152 * o[1] + 0.0722 * o[2], 0, 1);
}

export interface WallView {
  /** distance (m), vertical field of view (deg) and image rows: the pixel footprint on a frontal wall */
  dist: number; fovDeg?: number; rows?: number;
  /** sun direction in the wall's frame (x along the course, y up, z out of the wall), and sky/sun irradiance ratio */
  sun: [number, number, number]; sky?: number;
  /** output (tone-mapped) linear Y of the mean stone: the exposure is set to give it */
  outY: number;
  /** patch of wall (m): x0, y0, width, height; the face's out-of-plane coordinate z */
  patch: [number, number, number, number]; z?: number;
}
/** a stone surface definition in the "session-4" state (D-157), for before/after comparisons */
export function d157(d: SurfaceDef): SurfaceDef {
  return { ...d, stone: undefined, joints: { ...d.joints!, lip: 0.005, lipDark: 0.25, warmCool: 0.03, tilt: 0.0075, blockSd: undefined } };
}
/** albedo factor (× the surface albedo) and shading normal of the ashlar at a point of a vertical wall, per pixel of size px */
export function ashlarPixel(d: SurfaceDef, x: number, y: number, z: number, px: number) {
  const J = d.joints!, fp = px * Math.SQRT2, W = ashlarCells(x, y, J), ids = blockIds(W.blk, W.c);
  const hw = J.width / 2, lw = d.stone ? (J.lip ?? 0) * (0.5 + ids.b) + hw : (J.lip ?? 0) + hw;
  const slotB = bandCover(W.dBed, px, hw), slotH = bandCover(W.dHead, px, hw);
  const lipB = Math.max(0, bandCover(W.dBed, px, lw) - slotB), lipH = Math.max(0, bandCover(W.dHead, px, lw) - slotH);
  let f = (1 - Math.max(slotB, slotH) * J.dark - Math.max(lipB, lipH) * (J.lipDark ?? 0)) * blockTone(J, d, ids) * tone(d, x, y, z, fp);
  // the normal: + tangent tilts (x along the course, y up); D-218 draws the arris as a normal, D-157 did not (albedo only)
  let tx = 0, ty = 0;
  if (d.stone) { tx -= ARRIS_K * W.sHead * lipH; ty -= ARRIS_K * W.sBed * lipB; }
  if (J.tilt) { const a = d.stone ? ids.a : hash12(W.blk + 2.3, W.c + 9.1), e = d.stone ? ids.e : hash12(W.c + 4.4, W.blk + 6.6); tx += (2 * a - 1) * J.tilt; ty += (2 * e - 1) * J.tilt; }
  if (d.stone) { const s = stoneDetail(d.stone, x, y, 1, ids, fp); f *= s.f; tx += s.tx; ty += s.ty; }
  // the procedural bump's base octave (materials.ts layer(): mx_noise(p × freq) × amp, band-limited), as a slope
  if (d.bump) {
    const B = d.bump, k = B.freq, band = 1 - smoothstep(0.15, 0.35, fp * k), e = 1e-3;
    const hgt = (u: number, v: number) => mxNoise3(u * k, v * k, z * k) * B.amp * band;
    tx -= (hgt(x + e, y) - hgt(x - e, y)) / (2 * e); ty -= (hgt(x, y + e) - hgt(x, y - e)) / (2 * e);
  }
  const l = Math.hypot(tx, ty, 1);
  return { f, n: [tx / l, ty / l, 1 / l] as [number, number, number] };
}
/** render a patch of sunlit wall: per-pixel linear Y after AgX; returns the image and its mean and Ystd/Y */
export function renderWall(d: SurfaceDef, V: WallView) {
  const fov = ((V.fovDeg ?? 46) * Math.PI) / 180, rows = V.rows ?? 540, px = (2 * Math.tan(fov / 2) * V.dist) / rows;
  const [x0, y0, w, h] = V.patch, nx = Math.max(4, Math.round(w / px)), ny = Math.max(4, Math.round(h / px)), z = V.z ?? 0.37;
  const s = V.sun, sl = Math.hypot(...s), L = s.map(c => c / sl), sky = V.sky ?? 0.15, rho = srgbToLinear(d.albedo[1]);
  const lin: number[] = [];
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const P = ashlarPixel(d, x0 + (i + 0.5) * px, y0 + (j + 0.5) * px, z, px);
    lin.push(rho * P.f * (Math.max(0, P.n[0] * L[0] + P.n[1] * L[1] + P.n[2] * L[2]) + sky));
  }
  // exposure: the mean stone maps to V.outY
  const m = lin.reduce((a, b) => a + b, 0) / lin.length;
  let lo = 0.01, hi = 100; for (let it = 0; it < 60; it++) { const k = Math.sqrt(lo * hi); if (agxGrey(m * k) < V.outY) lo = k; else hi = k; }
  const k = Math.sqrt(lo * hi), out = lin.map(v => agxGrey(v * k));
  const mean = out.reduce((a, b) => a + b, 0) / out.length, sd = Math.sqrt(out.reduce((a, b) => a + (b - mean) ** 2, 0) / out.length);
  const lm = m, lsd = Math.sqrt(lin.reduce((a, b) => a + (b - lm) ** 2, 0) / lin.length);
  return { nx, ny, px, out, mean, flat: sd / mean, sceneFlat: lsd / lm };
}
export { SURFACES };
