// dev: a CPU mirror of the human material (src/people/humanMaterial.ts, D-155) for node-side previews of faces, hair and
// dress (tools/dev/face_preview.ts). It evaluates the same formulas with the same constants (imported from the
// material), the same MaterialX Perlin noise (ported bit-exactly from three's MaterialXNoise), the same lighting model
// (wrapped diffuse, two GGX lobes, Kajiya–Kay, sheen, the sky-reflection proxy) and three's AgX tone mapping.
// It is a verification aid: the browser render is the judgement (screenshots find problems; tests measure).
import { SKIN, EYE, IRIS, LASH, HAIR, REF_TONE, SAG_MAX, DRAPE, KOHL } from '../../src/people/humanMaterial';
import { MAT, EYE_UNIT, SKIN_CURV_MAX, LOOK_BITS, PRM_UPPER } from '../../src/people/humanFormat';

export type V3 = [number, number, number];
// ------------------------------------------------------------------ MaterialX Perlin noise (three r186 MaterialXNoise)
const rotl = (x: number, k: number) => ((x << k) | (x >>> (32 - k))) >>> 0;
function bjfinal(a: number, b: number, c: number) {
  c = (c ^ b) >>> 0; c = (c - rotl(b, 14)) >>> 0; a = (a ^ c) >>> 0; a = (a - rotl(c, 11)) >>> 0; b = (b ^ a) >>> 0; b = (b - rotl(a, 25)) >>> 0;
  c = (c ^ b) >>> 0; c = (c - rotl(b, 16)) >>> 0; a = (a ^ c) >>> 0; a = (a - rotl(c, 4)) >>> 0; b = (b ^ a) >>> 0; b = (b - rotl(a, 14)) >>> 0;
  c = (c ^ b) >>> 0; c = (c - rotl(b, 24)) >>> 0; return c;
}
const SEED3 = (0xdeadbeef + (3 << 2) + 13) >>> 0;
const hash3 = (x: number, y: number, z: number) => bjfinal((SEED3 + (x >>> 0)) >>> 0, (SEED3 + (y >>> 0)) >>> 0, (SEED3 + (z >>> 0)) >>> 0);
const grad3 = (h: number, x: number, y: number, z: number) => { h &= 15; const u = h < 8 ? x : y, v = h < 4 ? y : h === 12 || h === 14 ? x : z; return ((h & 1) ? -u : u) + ((h & 2) ? -v : v); };
const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
export function mxNoise(px: number, py: number, pz: number) {
  const X = Math.floor(px), Y = Math.floor(py), Z = Math.floor(pz), fx = px - X, fy = py - Y, fz = pz - Z;
  const u = fade(fx), v = fade(fy), w = fade(fz);
  const g = (dx: number, dy: number, dz: number) => grad3(hash3(X + dx, Y + dy, Z + dz), fx - dx, fy - dy, fz - dz);
  const l = (a: number, b: number, t: number) => a * (1 - t) + b * t;
  return 0.982 * l(l(l(g(0, 0, 0), g(1, 0, 0), u), l(g(0, 1, 0), g(1, 1, 0), u), v), l(l(g(0, 0, 1), g(1, 0, 1), u), l(g(0, 1, 1), g(1, 1, 1), u), v), w);
}
// ------------------------------------------------------------------ small math
export const clamp = (x: number, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const sstep = (e0: number, e1: number, x: number) => { const t = clamp((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const mix3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const is = (m: number, k: number) => (Math.abs(m - k) < 0.5 ? 1 : 0);
const fract = (x: number) => x - Math.floor(x);
const mod = (x: number, y: number) => x - y * Math.floor(x / y);
export const dot3 = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const norm3 = (a: V3): V3 => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
export const cross3 = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const REF_LIN: V3 = [lin(REF_TONE[0]), lin(REF_TONE[1]), lin(REF_TONE[2])];
const bits = (pat: number, k: keyof typeof LOOK_BITS) => { const [lo, n] = LOOK_BITS[k]; return mod(Math.floor(pat / 2 ** lo), 2 ** n); };

/** the skin atlas (RGBA8, 2:1): albedo sRGB-decoded to linear, detail RGB stored sRGB-encoded (decoded here as the GPU
 *  does), alpha linear */
export interface Tex { w: number; h: number; data: Uint8Array; linRGB: Float32Array }
export function makeTex(w: number, h: number, data: Uint8Array): Tex {
  const L = new Float32Array(256); for (let i = 0; i < 256; i++) L[i] = lin(i / 255);
  const linRGB = new Float32Array(w * h * 4); for (let i = 0; i < w * h; i++) { linRGB[i * 4] = L[data[i * 4]]; linRGB[i * 4 + 1] = L[data[i * 4 + 1]]; linRGB[i * 4 + 2] = L[data[i * 4 + 2]]; linRGB[i * 4 + 3] = data[i * 4 + 3] / 255; }
  return { w, h, data, linRGB };
}
/** bilinear sample (clamp to edge); uv with v up (three's flipY texture convention) */
export function sample(T: Tex, u: number, v: number, out: number[] = [0, 0, 0, 0]) {
  const x = clamp(u, 0, 1) * T.w - 0.5, y = (1 - clamp(v, 0, 1)) * T.h - 0.5;
  const x0 = Math.max(0, Math.floor(x)), y0 = Math.max(0, Math.floor(y)), x1 = Math.min(T.w - 1, x0 + 1), y1 = Math.min(T.h - 1, y0 + 1), fx = clamp(x - x0), fy = clamp(y - y0);
  for (let c = 0; c < 4; c++) { const a = T.linRGB[(y0 * T.w + x0) * 4 + c], b = T.linRGB[(y0 * T.w + x1) * 4 + c], d = T.linRGB[(y1 * T.w + x0) * 4 + c], e = T.linRGB[(y1 * T.w + x1) * 4 + c];
    out[c] = (a * (1 - fx) + b * fx) * (1 - fy) + (d * (1 - fx) + e * fx) * fy; }
  return out;
}

/** the skirt's hem folds (D-189; the material's vertex stage and its shading): displacement (m) along the radial
 *  direction at skirt parameter t (0 waist … 1 hem), angle th, for the wear texel's z (amplitude mm + phase) and fit, at a
 *  camera distance camD; fit = 0 gives the fold field alone (the shading height) */
export function skirtFold(t: number, th: number, ampPh: number, fit: number, camD: number) {
  const amp = Math.floor(ampPh) * 0.001, ph = (ampPh - Math.floor(ampPh)) * Math.PI * 2;
  const low = Math.sin(th * DRAPE.foldLow[0] + ph) * 0.55 + Math.sin(th * DRAPE.foldLow[1] + ph * 1.7 + 1) * 0.45;
  const high = (Math.sin(th * DRAPE.foldHigh[0] + ph * 2.3) * 0.6 + Math.sin(th * DRAPE.foldHigh[1] + ph * 3.1 + 2) * 0.4) * (1 - sstep(DRAPE.highNear[0], DRAPE.highNear[1], camD));
  return t * t * (fit + amp * (0.6 + low * 0.7 + high * 0.6));
}
/** interpolated fragment inputs (the material's varyings plus uv and view-space position/normal); ext = [slack, cut-line
 *  ramp, bind normal y, the garment's fading susceptibility]; wear = [garment age, joint bend, fold amp + phase, hem soil] */
export interface Frag {
  color: V3; hair: V3; mat: [number, number, number, number]; bind: V3; aux: [number, number, number, number]; ext: number[];
  wear?: number[]; uv: [number, number]; posV: V3; nrmV: V3;
}
/** what the surface stage produces (the material's colorNode, roughness, metalness, height, masks and lighting inputs) */
export interface Surf {
  alb: V3; rough: number; metal: number; h: number; ao: number; keep: boolean; f0: number; micro: number; microK: number;
  wrap: V3; trans: V3; roughB: number; lobeB: number; kHair: number; kkEdge: number; hairTilt: number; sheenCol: V3; sheenRough: number; specOcc: number; roughEnv: number; envMask: number;
}
/** the surface stage for one fragment (fw = metres per pixel on the surface, as length(fwidth(P)); nb = the bind-space
 *  facet normal from dFdx/dFdy of P; silh = 1 − |n_geom · v|) */
export function surface(f: Frag, fw: number, nb: V3, silh: number, skinTex: Tex | null): Surf {
  const m = f.mat[0], prm = f.mat[1], pat = Math.floor(f.mat[2] + 0.5), grime = f.mat[3], e1 = f.ext[0], e2 = f.ext[1], P = f.bind, U = f.uv;
  const kSkin = is(m, MAT.skin), kEye = is(m, MAT.eye), kHair = is(m, MAT.hair), kTeeth = is(m, MAT.teeth), kMouth = is(m, MAT.mouth);
  const kLeather = is(m, MAT.leather), kFelt = is(m, MAT.felt), kMetal = is(m, MAT.metal), kLash = is(m, MAT.lash), kWood = is(m, MAT.wood), kWicker = is(m, MAT.wicker);
  const kCloth = is(m, MAT.cloth_main) + is(m, MAT.cloth_second) + is(m, MAT.cloth_trim);
  const band = (fq: number) => 1 - sstep(0.12, 0.35, Math.max(fw, 1e-6) * fq);
  const hairStyle = bits(pat, 'hairStyle'), kCourt = is(hairStyle, 1), kStraight = is(hairStyle, 2);
  const isBeard = (prm >= 1.5 ? 1 : 0) * kHair, isMass = is(prm, 3) * kHair;
  const age01 = clamp((bits(pat, 'age') - 2) / 4);
  const ex = (e1 - 0.5) * 2 * EYE_UNIT, ey = (e2 - 0.5) * 2 * EYE_UNIT, er = Math.hypot(ex, ey), et = er / EYE.irisR, eang = Math.atan2(ey, ex);
  // shared noise
  const other = Math.max(0, 1 - kSkin - kHair - kLash - kCloth - kFelt - kLeather);
  const fr = (skin: V3, hair: V3, cloth: V3, felt: V3, leather: V3, oth: V3): V3 => [0, 1, 2].map(i => skin[i] * kSkin + hair[i] * (kHair + kLash) + cloth[i] * kCloth + felt[i] * kFelt + leather[i] * kLeather + oth[i] * other) as V3;
  const s3 = (x: number): V3 => [x, x, x];
  const hairF1 = mix3([900, 300, 900], [700, 40, 700], kStraight), hairF2 = mix3(mix3([260, 170, 260], [190, 110, 190], isBeard), [120, 15, 120], kStraight);
  const q1 = fr(s3(SKIN.pores[0][0]), hairF1, s3(160), s3(900), s3(200), s3(60)), q2 = fr(s3(SKIN.pores[1][0]), hairF2, [14, 5, 14], s3(250), s3(60), s3(40)), q3 = fr(s3(30), s3(40), s3(9), s3(40), s3(20), s3(40));
  const i1: V3 = kEye ? [Math.cos(eang) * 6, Math.sin(eang) * 6, et * 3.2] : [P[0] * q1[0], P[1] * q1[1], P[2] * q1[2]];
  const i2: V3 = kEye ? [ex * 900, ey * 900, P[0] * 900] : [P[0] * q2[0], P[1] * q2[1], P[2] * q2[2]];
  const pv = (k: number) => fract(Math.sin((f.color[0] + f.hair[0]) * (12.9898 + k) + (f.color[1] + f.hair[1]) * 78.233 + (f.color[2] + f.hair[2]) * (37.719 + 2 * k)) * 43758.5453);
  const n1 = mxNoise(i1[0], i1[1], i1[2]), n2 = mxNoise(i2[0], i2[1], i2[2]), n3 = mxNoise(P[0] * q3[0] + pv(0) * 57 * kSkin, P[1] * q3[1] + pv(1) * 31 * kSkin, P[2] * q3[2] + pv(2) * 13 * kSkin);
  const u1 = n1 * 0.5 + 0.5, u2 = n2 * 0.5 + 0.5, u3 = n3 * 0.5 + 0.5;
  // skin
  const sA = skinTex && kSkin ? sample(skinTex, U[0] * 0.5, U[1]) : [0.5, 0.35, 0.28, 0], sD = skinTex && kSkin ? sample(skinTex, U[0] * 0.5 + 0.5, U[1]) : [0.214, 0, 0.214, 0];
  const tone: V3 = [f.color[0] / REF_LIN[0], f.color[1] / REF_LIN[1], f.color[2] / REF_LIN[2]];
  const stub = f.aux[2], roots = stub >= 1.5 ? 1 : 0, stubV = Math.min(stub, 1) * (1 - roots);
  const fineM = 1 + n2 * 0.035 * band(SKIN.pores[1][0]);
  let skinAlb: V3 = [sA[0] * tone[0] * (1 + 0.05 * n3) * fineM, sA[1] * tone[1] * (1 + 0.03 * n3) * fineM, sA[2] * tone[2] * (1 + 0.025 * n3) * fineM];
  const browA = sstep(pv(3) * 0.4, 1 - pv(4) * 0.3, sA[3]);
  skinAlb = mix3(skinAlb, [f.hair[0] * 0.9, f.hair[1] * 0.9, f.hair[2] * 0.9], browA * (pv(5) * 0.25 + 0.7));
  skinAlb = mix3(skinAlb, skinAlb.map((x, i) => x * Math.min(f.hair[i] * 2.2 + 0.35, 1)) as V3, f.aux[1] * stubV * 0.55);
  skinAlb = mix3(skinAlb, [f.hair[0] * 0.7, f.hair[1] * 0.7, f.hair[2] * 0.7], f.aux[1] * roots * 0.9);
  skinAlb = mix3(skinAlb, [f.hair[0] * 0.55, f.hair[1] * 0.55, f.hair[2] * 0.55], e1 * kSkin * bits(pat, 'wearsHair') * 0.9);
  const oil = sD[1], transl = sD[3];
  const poreH = n1 * SKIN.pores[0][1] * band(SKIN.pores[0][0]) + n2 * SKIN.pores[1][1] * band(SKIN.pores[1][0]);
  const skinH = (sD[0] - 0.5) * 2 * SKIN.crease + (sD[2] - 0.5) * 2 * SKIN.age * age01 + poreH;
  // eye
  const irisI = bits(pat, 'iris'); const irisBase = IRIS[Math.min(IRIS.length - 1, irisI)];
  const collar = Math.exp(-(((et - 0.42) / 0.08) ** 2));
  let iris: V3 = irisBase.map(c => c * (u1 * 0.55 + 0.7) * (collar * 0.4 + 1)) as V3;
  iris = iris.map(c => c * (1 - sstep(0.78, 0.98, et) * 0.5)) as V3;
  const pr = EYE.pupilR / EYE.irisR; iris = mix3(iris, [0.005, 0.005, 0.005], 1 - sstep(pr - 0.04, pr + 0.04, et));
  const irisM = 1 - sstep(0.97, 1.04, et);
  const nasal = sstep(0.009, 0.0135, -ex * Math.sign(P[0]));
  const veins = sstep(0.62, 0.9, u2) * sstep(0.007, 0.012, Math.abs(ex)) * 0.35;
  let sclera = mix3(EYE.sclera, [EYE.sclera[0], EYE.sclera[1] * 0.62, EYE.sclera[2] * 0.58], veins);
  sclera = mix3(sclera, EYE.caruncle, nasal * 0.8);
  const lidSh = 1 - sstep(-0.0015, 0.0018, ey) * EYE.lidShadow;
  const eyeAlb = mix3(sclera, iris, irisM).map(c => c * lidSh) as V3;
  // hair
  const ridge = 1 - Math.abs(n2), natural = ridge * ridge * 0.75 + u1 * 0.25;
  const arc = Math.atan2(P[0], P[2] - 0.02) * 0.085, hx = mix(arc, P[0], isBeard), rowC = P[1] / HAIR.row, ri = Math.floor(rowC);
  const cellX = hx / HAIR.row + mod(ri, 2) * 0.5, ci = Math.floor(cellX), hsh = (a: number, b: number, c: number) => fract(Math.sin(ri * a + ci * b) * c);
  const h1 = hsh(12.9898, 78.233, 43758.5453), h2 = hsh(39.3468, 11.135, 24634.6345);
  const cu = fract(cellX) - 0.5 + (h1 - 0.5) * 0.3, cv = fract(rowC) - 0.5 + (h2 - 0.5) * 0.3, rr = Math.hypot(cu, cv) * (h1 * 0.3 + 1.7), th = Math.atan2(cv, cu) + h2 * Math.PI * 2;
  const tuft = clamp(1 - rr * rr) * (Math.sin(th + rr * 8) * 0.25 + 0.75);
  let court = mix(natural, tuft * (u1 * 0.4 + 0.6), 0.6);
  const lockPh = P[1] * 150 + n3 * 4, lc = (P[0] + Math.sin(lockPh) * 0.0022 + n2 * 0.001) / 0.0075;
  const lf = (fract(lc) - 0.5) * 2, lh = fract(Math.sin(Math.floor(lc) * 91.345) * 47453.5453);
  const locks = Math.max(1 - lf * lf, 0) * (lh * 0.25 + 0.6) * ((1 - Math.abs(n1)) * 0.4 + 0.6) + 0.15;
  const lockZone = isMass * sstep(0.2, 0.3, U[1]) * (1 - sstep(0.86, 0.94, U[1]));
  court = mix(court, locks, lockZone);
  const straight = u1 * 0.6 + u2 * 0.4;
  const curls = mix(mix(natural, court, kCourt), straight, kStraight);
  const hairAlb = f.color.map(c => c * (curls * 0.75 + 0.42) * (u3 * 0.2 + 0.9)) as V3;
  const hairH = curls * mix(HAIR.bump, HAIR.bumpStraight, kStraight) * band(mix(200, 120, kCourt));
  const kohlK = bits(pat, 'kohl') * (1 - sstep(KOHL.band * 0.7, KOHL.band * 1.3, e1)); // D-215
  const lashAlb = f.hair.map((c, i) => mix(c * 0.45, KOHL.alb[i], kohlK)) as V3;
  // cloth
  const lb = bits(pat, 'linen');
  const isLinen = is(m, MAT.cloth_main) * mod(lb, 2) + is(m, MAT.cloth_second) * mod(Math.floor(lb / 2), 2) + is(m, MAT.cloth_trim) * Math.floor(lb / 4);
  const pat0 = mod(bits(pat, 'motif'), 2);
  const cx = fract((P[0] + P[2] * 0.7) * 22) - 0.5, cy = fract(P[1] * 22) - 0.5, rose = (1 - sstep(0.18, 0.26, Math.hypot(cx, cy))) * pat0 * is(m, MAT.cloth_main);
  let clothAlb = f.color.map(c => c * (1 + n3 * 0.05 + n1 * 0.035)) as V3;
  clothAlb = mix3(clothAlb, f.hair, rose);
  const upF = sstep(-0.25, 0.75, f.ext[2] ?? 0) * sstep(0.66, 0.8, f.aux[0]) * (n3 * 0.3 + 0.85);
  const W4 = f.wear ?? [0, 0, 0, 0], fadeAmt = clamp(W4[0] * (f.ext[3] ?? 0) * upF * DRAPE.fade, 0, 0.8), cLum = clothAlb[0] * 0.2126 + clothAlb[1] * 0.7152 + clothAlb[2] * 0.0722;
  clothAlb = mix3(clothAlb, clothAlb.map(c => Math.min(0.8, mix(cLum, c, 0.4) * 1.25 + 0.012)) as V3, fadeAmt);
  const ax = Math.abs(nb[0]), az = Math.abs(nb[2]), sH = (P[0] * az + P[2] * ax) / (ax + az + 1e-4);
  const fq = mix(700, 1500, isLinen);
  const weaveH = Math.sin(P[1] * fq * Math.PI * 2) * Math.sin(sH * fq * Math.PI * 2) * mix(0.00012, 0.00006, isLinen) * band(fq);
  const thB = Math.atan2(P[0], P[2] - 0.02), sideS = sstep(0.35, 0.9, Math.abs(Math.sin(thB)));
  const pleatT = Math.abs(fract(thB * 26 / (Math.PI * 2) + P[1] * 9 * Math.sign(thB) * sideS) - 0.5) * 2;
  const pleatH = (pleatT - 0.5) * 0.003 * is(prm, 1) * band(21);
  const foldH = skirtFold(U[1], Math.atan2(P[0], P[2] - 0.02), W4[2], 0, Math.hypot(...f.posV)) * f.aux[1] * kCloth;
  const wrinkleH = Math.sin(P[1] * DRAPE.wrinkleF * Math.PI * 2 + n2 * 3) * DRAPE.wrinkle * W4[1] * band(DRAPE.wrinkleF);
  // D-206: hems and the gathers above the belt
  const hem = Math.max((1 - sstep(0, DRAPE.hemBand, e2)) * (1 - f.aux[1]), f.aux[1] * sstep(0.93, 0.99, U[1])) * kCloth;
  const hemH = Math.sin(hem * Math.PI) * DRAPE.hemRoll;
  const gz = (1 - sstep(0, DRAPE.gatherH, U[1])) * (U[1] >= -0.03 ? 1 : 0) * is(prm, PRM_UPPER) * kCloth;
  const gatherH = Math.sin(thB * DRAPE.gatherN + n2 * 1.5) * DRAPE.gather * gz * band(DRAPE.gatherN / 0.9);
  clothAlb = clothAlb.map(c => c * (1 - hem * DRAPE.hemDark)) as V3;
  const clothH = n2 * mix(0.003, 0.0012, is(prm, 4)) + n1 * mix(0.00025, 0.00012, isLinen) + weaveH + pleatH + foldH + wrinkleH + hemH + gatherH;
  // felt, leather, metal, wood, wicker
  const feltAlb = f.color.map(c => c * (1 + n3 * 0.1 + n1 * 0.05)) as V3;
  const seam = Math.exp(-((P[0] / 0.0022) ** 2)) * 0.00045 * is(prm, 0);
  const feltH = n1 * 0.00008 * band(900) + n2 * 0.00015 * band(250) + seam;
  const leatherAlb = f.color.map(c => c * (1 + n2 * 0.08)) as V3, leatherH = n1 * 0.0002 * band(200);
  const metalAlb = mix3(mix3([0.62, 0.43, 0.24], [0.8, 0.8, 0.78], is(prm, 1)), [0.9, 0.7, 0.32], is(prm, 2)).map(c => c * (1 - is(prm, 3) * 0.5)) as V3;
  const woodAlb = [0.36, 0.25, 0.15].map(c => c * (1 + Math.sin(P[1] * 900 + n3 * 3) * 0.06)) as V3;
  const wickerAlb = [0.6, 0.5, 0.3].map(c => c * (0.85 + Math.abs(Math.sin(P[0] * 300)) * 0.15)) as V3;
  const parts: [V3, number][] = [[skinAlb, kSkin], [eyeAlb, kEye], [hairAlb, kHair], [[0.7, 0.66, 0.58], kTeeth], [[0.32, 0.1, 0.09], kMouth], [leatherAlb, kLeather], [feltAlb, kFelt], [metalAlb, kMetal], [lashAlb, kLash], [woodAlb, kWood], [wickerAlb, kWicker], [clothAlb, kCloth]];
  let alb: V3 = [0, 0, 0]; for (const [c, k] of parts) if (k) { alb[0] += c[0] * k; alb[1] += c[1] * k; alb[2] += c[2] * k; }
  const gl = f.aux[3], grimeCol: V3 = [gl, gl * 0.97, gl * 0.9];
  const low = 1 - sstep(0.1, 0.9, P[1]), feet = 1 - sstep(0.02, 0.14, P[1]);
  const zone = bits(pat, 'grimeZone'), zHands = is(zone, 1) + is(zone, 2), zFront = is(zone, 2), zLoad = is(zone, 3);
  const arms = sstep(0.15, 0.2, Math.abs(P[0])) * (1 - sstep(1.02, 1.12, P[1]));
  const front = sstep(0.02, 0.08, P[2]) * sstep(0.72, 0.8, P[1]) * (1 - sstep(1.2, 1.3, P[1])) * (1 - sstep(0.14, 0.18, Math.abs(P[0])));
  const load = sstep(1.28, 1.36, P[1]) * Math.max(sstep(0.06, 0.1, Math.abs(P[0])), 1 - sstep(-0.05, 0.0, P[2]));
  const where = Math.max(low, arms * zHands, front * zFront, load * zLoad * 0.8);
  const grimeMask = grime * where * (kCloth + kSkin * Math.max(feet * 0.65 + 0.35, arms * zHands) + kLeather * 0.8 + kFelt * 0.3) * (u3 * 0.6 + 0.7);
  alb = mix3(alb, grimeCol, grimeMask * 0.35);
  const hemBand = Math.max(1 - sstep(0.03, 0.3, P[1]), f.aux[1] * kCloth * sstep(0.72, 1, U[1]) * 0.7);
  const soilMask = clamp(W4[3] * hemBand * (kCloth + kLeather * 0.8 + kSkin * feet * 0.6) * (u2 * 0.8 + 0.6) * DRAPE.soil, 0, 0.75);
  alb = mix3(alb, DRAPE.dust, soilMask);
  const rough = Math.min(1, soilMask * 0.15 + kSkin * (SKIN.roughSheen - oil * 0.08 + n1 * 0.06 * band(SKIN.pores[0][0])) + kEye * mix(0.1, 0.035, irisM) + kHair * 0.5 + kTeeth * 0.25 + kMouth * 0.3 + kLeather * 0.55 + kFelt * 0.95 + kMetal * 0.32 + kLash * 0.6 + kWood * 0.55 + kWicker * 0.85 + kCloth * mix(0.92, 0.8, isLinen) + grimeMask * 0.2);
  const f0 = 0.04 - kSkin * (0.04 - SKIN.f0) - kEye * (0.04 - EYE.f0) + kHair * 0.006;
  const ao = mix(1, f.aux[0], 0.85 - kEye * 0.45) * mix(1, curls * 0.45 + 0.55, kHair);
  const h = hairH * kHair + skinH * kSkin + clothH * kCloth + feltH * kFelt + leatherH * kLeather;
  const curv = e2 * SKIN_CURV_MAX;
  const wrap = [0, 1, 2].map(i => (Math.min(SKIN.scatter[i] * curv, SKIN.wrapMax) + SKIN.wrapBase[i]) * kSkin + kHair * 0.25 + kFelt * 0.1 + kCloth * 0.05) as V3;
  const trans = SKIN.transTint.map(c => c * transl * kSkin * SKIN.trans) as V3;
  const sheenBase = mix3([1, 1, 1], clothAlb.map(c => Math.min(1, c * 2)) as V3, 0.5), sheenK = kCloth * mix(0.22, 0.14, isLinen) + kFelt * 0.25;
  // alpha test
  const cover = sstep(0, 0.7 + bits(pat, 'beard') * 0.35 * isBeard, e2), frayPat = mix(curls * 0.55 + u1 * 0.35, u1 * 0.75 + curls * 0.15, isBeard * (1 - kCourt));
  const speckle = isBeard * (1 - kCourt) * (0.92 - bits(pat, 'beard') * 0.1 <= u1 ? 1 : 0);
  const edgeCut = Math.max(cover * 1.15 <= frayPat ? 1 : 0, speckle);
  const silCut = curls + 0.3 <= (silh - 0.45) * 2.8 ? 1 : 0;
  const along = (U[0] - LASH.u0) / (LASH.u1 - LASH.u0), tl = e1;
  const clumpC = Math.abs(fract(along * mix(LASH.clumps, LASH.clumps * 0.6, e2) + n1 * 0.35) - 0.5) * 2, lashW = ((1 - tl) * Math.sqrt(Math.max(0, 1 - tl)) * 0.8 + 0.1) * mix(1, 0.7, e2);
  const lashCut = Math.max(lashW <= clumpC ? 1 : 0, 0.9 <= tl ? 1 : 0) * (1 - bits(pat, 'kohl') * (tl <= KOHL.band ? 1 : 0));
  const keep = 1 - kHair * Math.max(edgeCut, silCut) - kLash * lashCut > 0.5;
  return { alb, rough, metal: kMetal, h, ao, keep, f0, micro: f.aux[0], microK: (kSkin + kCloth + kFelt + kLeather + kHair * 0.5) * DRAPE.micro, wrap, trans, roughB: SKIN.roughOil, lobeB: kSkin * mix(SKIN.oilLobe[0], SKIN.oilLobe[1], oil), kHair, kkEdge: sstep(0.3, 1, e2), hairTilt: mix((curls - 0.5) * 1.6, Math.cos(lockPh) * 0.33, lockZone * kCourt),
    sheenCol: sheenBase.map(c => c * sheenK) as V3, sheenRough: kCloth * mix(0.55, 0.35, isLinen) + kFelt * 0.7 + (1 - kCloth - kFelt) * 0.5,
    specOcc: mix(1, f.aux[0], kSkin * 0.5) * mix(1, curls * 0.6 + 0.4, kHair),
    roughEnv: kSkin * 0.45 + kEye * 0.04 + kHair * 0.5 + kTeeth * 0.3 + kMouth * 0.3 + kLeather * 0.55 + kMetal * 0.32 + kWood * 0.6 + kWicker * 0.8 + (kCloth + kFelt + kLash) * 0.9,
    envMask: kSkin + kEye * 1.2 + kHair * 0.2 + kTeeth * 0.6 + kMouth * 0.4 + kLeather * 0.6 + kMetal + kWood * 0.3 + kWicker * 0.2 };
}

// ------------------------------------------------------------------ lighting (view space)
const D_GGX = (a: number, nh: number) => { const a2 = a * a, d = nh * nh * (a2 - 1) + 1; return a2 / (Math.PI * d * d); };
const V_SC = (a: number, nl: number, nv: number) => { const a2 = a * a, gv = nl * Math.sqrt(a2 + (1 - a2) * nv * nv), gl = nv * Math.sqrt(a2 + (1 - a2) * nl * nl); return 0.5 / Math.max(gv + gl, 1e-6); };
const schlick = (f0: number, f90: number, vh: number) => { const f = (1 - vh) ** 5; return f0 * (1 - f) + f90 * f; };
/** three's BRDF_GGX (roughness → alpha = r²; Schlick F, height-correlated Smith V, GGX D) */
function ggx(f0: V3, r: number, N: V3, L: V3, V: V3): V3 {
  const H = norm3([L[0] + V[0], L[1] + V[1], L[2] + V[2]]), nl = clamp(dot3(N, L)), nv = clamp(dot3(N, V)), nh = clamp(dot3(N, H)), vh = clamp(dot3(V, H)), a = r * r;
  const dv = D_GGX(a, nh) * V_SC(a, nl, nv); return f0.map(c => schlick(c, 1, vh) * dv) as V3;
}
export interface Light { dirV: V3; color: V3; shadow: number }
export interface Env { upV: V3; lights: Light[]; irradiance: (nV: V3) => V3 }
/** outgoing radiance of a fragment: the material's direct() for each light, then indirect() */
export function shade(s: Surf, N: V3, V: V3, env: Env): V3 {
  const diffC: V3 = s.alb.map(c => c * (1 - s.metal)) as V3, f0: V3 = s.alb.map(c => mix(s.f0, c, s.metal)) as V3;
  const roughAA = Math.max(0.0525, s.rough);
  const out: V3 = [0, 0, 0];
  for (const Lt of env.lights) {
    const L = Lt.dirV, lc = Lt.color.map(c => c * Lt.shadow) as V3; const ndl = dot3(N, L), nl = clamp(ndl);
    const H = norm3([L[0] + V[0], L[1] + V[1], L[2] + V[2]]), vh = clamp(dot3(V, H)), nh = clamp(dot3(N, H)), nv = clamp(dot3(N, V));
    const F = schlick(s.f0, 1, vh), ms = mix(1, clamp(Math.abs(ndl) + 2 * s.micro * s.micro - 1), s.microK);
    for (let i = 0; i < 3; i++) { const w = s.wrap[i]; const prof = clamp((ndl + w) / (w + 1)) ** (w + 1); out[i] += lc[i] * prof * diffC[i] / Math.PI * (1 - F) * ms; }
    const back = clamp((-ndl + 0.25) / 1.25); for (let i = 0; i < 3; i++) out[i] += lc[i] * diffC[i] * s.trans[i] * back * back / Math.PI;
    const sa = ggx(f0, roughAA, N, L, V), sb = ggx(f0, s.roughB, N, L, V);
    let spec = mix3(sa, sb, s.lobeB);
    if (s.kHair) {
      const down: V3 = [-env.upV[0], -env.upV[1], -env.upV[2]]; const t0 = norm3([down[0] - N[0] * dot3(N, down) + 1e-3, down[1] - N[1] * dot3(N, down), down[2] - N[2] * dot3(N, down)]), b0 = cross3(N, t0);
      const T = norm3([t0[0] + b0[0] * s.hairTilt, t0[1] + b0[1] * s.hairTilt, t0[2] + b0[2] * s.hairTilt]);
      const kk = (shift: number, e: number) => { const ts = norm3([T[0] + N[0] * shift, T[1] + N[1] * shift, T[2] + N[2] * shift]), t = dot3(ts, H); return sstep(-1, 0, t) * Math.sqrt(clamp(1 - t * t)) ** e; };
      const k1 = kk(-0.08, 80) * HAIR.kk[0] * s.kkEdge, k2 = kk(0.1, 14) * HAIR.kk[1]; const kkS: V3 = s.alb.map(c => k1 + Math.min(1, c * 6) * k2) as V3;
      spec = mix3(spec, kkS, s.kHair);
    }
    const invA = 1 / s.sheenRough, sin2 = Math.max(1 - nh * nh, 0.0078125), Dc = (2 + invA) * sin2 ** (0.5 * invA) / (2 * Math.PI), Vn = clamp(1 / (Math.max(nl + nv - nl * nv, 0.001) * 4));
    for (let i = 0; i < 3; i++) out[i] += lc[i] * nl * (spec[i] * s.specOcc * ms + s.sheenCol[i] * Dc * Vn);
  }
  // indirect: Lambert on the irradiance, the sky-reflection proxy, then AO (three's ambientOcclusion)
  const irr = env.irradiance(N), nv = clamp(dot3(N, V));
  const R: V3 = [2 * nv * N[0] - V[0], 2 * nv * N[1] - V[1], 2 * nv * N[2] - V[2]], skyW = mix(0.55, 1.4, sstep(-0.15, 0.35, dot3(R, env.upV)));
  const f5 = 1 - nv, f = f5 ** 5, r = s.roughEnv;
  const ind: V3 = [0, 0, 0], indS: V3 = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    ind[i] = irr[i] * diffC[i] / Math.PI * (1 - s.f0);
    const env_ = (f0[i] + (Math.max(1 - r, f0[i]) - f0[i]) * f) * (1 - r * r * 0.6);
    indS[i] = irr[i] / Math.PI * skyW * (env_ * s.envMask + s.sheenCol[i] * (f5 * f5 * f5 * 0.6 + 0.12));
  }
  const aoExp = 2 ** -(-16 * s.rough - 1), aoS = clamp(s.ao - (1 - (nv + s.ao) ** aoExp));
  for (let i = 0; i < 3; i++) out[i] += ind[i] * s.ao + indS[i] * aoS;
  return out;
}

// ------------------------------------------------------------------ tone mapping (three AgX) and sRGB
const M = (a: number[], v: V3): V3 => [a[0] * v[0] + a[3] * v[1] + a[6] * v[2], a[1] * v[0] + a[4] * v[1] + a[7] * v[2], a[2] * v[0] + a[5] * v[1] + a[8] * v[2]]; // column-major mat3 × v
const S2R = [0.6274, 0.0691, 0.0164, 0.3293, 0.9195, 0.0880, 0.0433, 0.0113, 0.8956], R2S = [1.6605, -0.1246, -0.0182, -0.5876, 1.1329, -0.1006, -0.0728, -0.0083, 1.1187];
const INSET = [0.856627153315983, 0.137318972929847, 0.11189821299995, 0.0951212405381588, 0.761241990602591, 0.0767994186031903, 0.0482516061458583, 0.101439036467562, 0.811302368396859];
const OUTSET = [1.1271005818144368, -0.1413297634984383, -0.14132976349843826, -0.11060664309660323, 1.157823702216272, -0.11060664309660294, -0.016493938717834573, -0.016493938717834257, 1.2519364065950405];
export function agx(c: V3, exposure: number): V3 {
  let v: V3 = [c[0] * exposure, c[1] * exposure, c[2] * exposure];
  v = M(INSET, M(S2R, v)); v = v.map(x => clamp((Math.log2(Math.max(x, 1e-10)) + 12.47393) / (4.026069 + 12.47393))) as V3;
  v = v.map(x => { const x2 = x * x, x4 = x2 * x2; return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232; }) as V3;
  v = M(OUTSET, v); v = v.map(x => Math.max(0, x) ** 2.2) as V3; v = M(R2S, v); return v.map(x => clamp(x)) as V3;
}
export const toSRGB8 = (x: number) => Math.round(255 * clamp(x <= 0.0031308 ? x * 12.92 : 1.055 * x ** (1 / 2.4) - 0.055));
export { SAG_MAX };
