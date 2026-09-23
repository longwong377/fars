// Skin bake for the human assets (D-020; tier C). MakeHuman's skin textures live in its separate asset repository,
// which is not reachable from the build sandbox, so the skin is generated: every body triangle is rasterised in UV
// space and each texel evaluates 3-D procedural functions at its bind-pose position on the reference body, so the map
// is seamless across UV islands and fits every variant (same topology and UVs).
//   skin.png   RGB = albedo of a reference mid tone (sRGB; the renderer rescales it to each person's tone),
//              A = eyebrow hair density
//   hair.png   R = beard density (men), G = scalp hair density, B = cavity occlusion (1 = open)
// The same region functions give per-vertex masks (beard, scalp) used by the runtime to build hair shells.
import { rasterTri } from './raster';

export interface SkinBakeInput {
  W: number; H: number; pos: Float64Array; orig: number[]; uv: number[]; tris: number[]; part: Uint8Array;
  joints: number[][]; tails: number[][]; bone: Record<string, number>; landmarks: Record<string, number>; ao: Float32Array;
}
/** reference skin tone the albedo map is authored for (sRGB 0..1); the renderer multiplies by tone / REF_TONE (linear) */
export const REF_TONE: [number, number, number] = [0.72, 0.53, 0.42];

// ---- noise (value noise, hashed lattice; deterministic)
const hash = (x: number, y: number, z: number) => { let h = (x * 374761393 + y * 668265263 + z * 1274126177) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
const sm = (t: number) => t * t * (3 - 2 * t);
export function vnoise(x: number, y: number, z: number) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = sm(x - xi), yf = sm(y - yi), zf = sm(z - zi);
  const l = (a: number, b: number, t: number) => a + (b - a) * t;
  const c = (dx: number, dy: number, dz: number) => hash(xi + dx, yi + dy, zi + dz);
  return l(l(l(c(0, 0, 0), c(1, 0, 0), xf), l(c(0, 1, 0), c(1, 1, 0), xf), yf), l(l(c(0, 0, 1), c(1, 0, 1), xf), l(c(0, 1, 1), c(1, 1, 1), xf), yf), zf) * 2 - 1;
}
const fbm = (x: number, y: number, z: number, o = 4) => { let s = 0, a = 0.5, f = 1; for (let i = 0; i < o; i++) { s += a * vnoise(x * f, y * f, z * f); a *= 0.5; f *= 2.03; } return s; };
const smooth = (e0: number, e1: number, x: number) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
const gauss = (d2: number, r: number) => Math.exp(-d2 / (r * r));

/** face frame measured on the reference body (bind pose: facing +Z, left = +X) */
export function faceFrame(inp: Pick<SkinBakeInput, 'pos' | 'joints' | 'bone' | 'landmarks' | 'part'>) {
  const J = (b: string) => inp.joints[inp.bone[b]]; const P = inp.pos;
  const eL = J('eye_l'), eR = J('eye_r'), eyeY = (eL[1] + eR[1]) / 2, eyeZ = (eL[2] + eR[2]) / 2, ipd = Math.abs(eL[0] - eR[0]);
  const nose = [P[inp.landmarks.nose_tip * 3], P[inp.landmarks.nose_tip * 3 + 1], P[inp.landmarks.nose_tip * 3 + 2]];
  const chin = [P[inp.landmarks.chin * 3], P[inp.landmarks.chin * 3 + 1], P[inp.landmarks.chin * 3 + 2]];
  // mouth line: the most recessed midline vertex between nose and chin (the lips' parting)
  let mouth = [0, (nose[1] + chin[1]) / 2, nose[2] - 0.02], lipZ = -1;
  { const y0 = chin[1] + 0.3 * (nose[1] - chin[1]), y1 = nose[1] - 0.3 * (nose[1] - chin[1]); let best = 1e9;
    for (let p = 0; p < 13380; p++) { if (inp.part[p] !== 0) continue; const x = P[p * 3], y = P[p * 3 + 1], z = P[p * 3 + 2];
      if (Math.abs(x) > 0.0025 || y < y0 || y > y1 || z < nose[2] - 0.045) continue;
      if (z < best) { best = z; mouth = [0, y, z]; } }
    for (let p = 0; p < 13380; p++) { if (inp.part[p] !== 0) continue; const x = P[p * 3], y = P[p * 3 + 1], z = P[p * 3 + 2];
      if (Math.abs(x) < 0.006 && Math.abs(y - mouth[1]) < 0.012) lipZ = Math.max(lipZ, z); } }
  // head extents at eye height
  let halfW = 0, backZ = 1e9, topY = 0;
  for (let p = 0; p < 13380; p++) { if (inp.part[p] !== 0) continue; const x = P[p * 3], y = P[p * 3 + 1], z = P[p * 3 + 2]; topY = Math.max(topY, y);
    if (Math.abs(y - eyeY) < 0.015) { halfW = Math.max(halfW, Math.abs(x)); backZ = Math.min(backZ, z); } }
  const head = J('head'), jaw = J('jaw');
  return { eL, eR, eyeY, eyeZ, ipd, nose, chin, mouth, lipZ, halfW, backZ, topY, head, jaw, midZ: (eyeZ + backZ) / 2 };
}
export type FaceFrame = ReturnType<typeof faceFrame>;

/** region masks at a bind-pose point (p, n) on the head/neck (0..1) */
export function faceMasks(F: FaceFrame, p: number[], n: number[], isHead: boolean, isNeck: boolean) {
  const [x, y, z] = p, ax = Math.abs(x);
  const out = { lips: 0, brow: 0, beard: 0, scalp: 0, cheek: 0, noseRed: 0, ear: 0, lid: 0 };
  if (!isHead && !isNeck) return out;
  const a = 0.8 * F.ipd / 2 + 0.004; // lip half-width
  // lips (vermilion): upper lip with a cupid's bow, fuller lower lip; front-facing, near the lip plane
  if (isHead && z > F.lipZ - 0.022 && n[2] > -0.2) {
    const u = ax / a; if (u < 1.15) {
      const w = Math.sqrt(Math.max(0, 1 - Math.min(1, u) ** 2));
      const bow = 1 - 0.18 * Math.exp(-((ax / 0.0035) ** 2)) + 0.08 * Math.exp(-(((ax - 0.006) / 0.004) ** 2));
      const up = 0.0085 * w * bow + 0.0006, lo = 0.0105 * w + 0.0006, dy = y - F.mouth[1];
      const inside = dy >= 0 ? 1 - smooth(up - 0.0012, up + 0.0008, dy) : 1 - smooth(lo - 0.0015, lo + 0.001, -dy);
      out.lips = inside * (1 - smooth(1.0, 1.12, u));
    }
  }
  const dxE = x > 0 ? x - F.eL[0] : x - F.eR[0], dyE = y - F.eyeY; // relative to the nearer eye centre
  // eyebrows: an arc over each eye, thick at the inner end; only on the front of the brow ridge
  if (isHead && z > F.eyeZ - 0.012 && n[2] > 0.05) {
    const s = (dxE * Math.sign(x) + 0.021) / 0.049; // 0 inner end (near the nose bridge) .. 1 outer end
    if (s > -0.05 && s < 1.05) {
      const cy = 0.0175 + 0.0065 * Math.sin(Math.min(1, Math.max(0, s)) * Math.PI * 0.85) - 0.003 * s, th = 0.0042 - 0.0024 * s;
      const d = Math.abs(dyE - cy);
      out.brow = (1 - smooth(th * 0.55, th, d)) * smooth(-0.05, 0.06, s) * (1 - smooth(0.93, 1.05, s));
    }
  }
  // eyelid / under-eye darkening
  if (isHead && z > F.eyeZ - 0.01) out.lid = gauss(dxE * dxE * 0.6 + dyE * dyE * 1.8, 0.016);
  out.cheek = isHead && z > F.eyeZ - 0.03 ? gauss((ax - 0.036) ** 2 + (y - (F.eyeY - 0.032)) ** 2, 0.022) : 0;
  out.noseRed = isHead ? gauss((x - F.nose[0]) ** 2 + (y - F.nose[1]) ** 2 + (z - F.nose[2]) ** 2, 0.014) : 0;
  // ears: lateral, around eye/nose height, behind the cheek
  if (isHead && ax > F.halfW - 0.022 && y < F.eyeY + 0.028 && y > F.nose[1] - 0.03 && z < F.eyeZ - 0.045 && z > F.backZ + 0.04) out.ear = 1;
  // scalp: hairline around the head (front high, temples, above the ears, down to the nape behind)
  if (isHead || isNeck) {
    const th = Math.atan2(x, z - F.midZ), ath = Math.abs(th); // 0 = front
    const front = F.eyeY + 0.052, temple = F.eyeY + 0.036, overEar = F.eyeY + 0.03, nape = F.jaw[1] - 0.035;
    const hl = ath < 0.9 ? front + (temple - front) * smooth(0.25, 0.9, ath) : ath < 1.75 ? temple + (overEar - temple) * smooth(0.9, 1.5, ath) : overEar + (nape - overEar) * smooth(1.75, 2.35, ath);
    out.scalp = smooth(hl - 0.004, hl + 0.006, y) * (1 - out.ear);
  }
  // beard (adult men): cheeks below the cheekbone line and in front of the ears, jaw, chin, upper lip; lips stay bare
  if ((isHead || isNeck) && z > F.backZ + 0.055) {
    const cheekLine = F.eyeY - 0.026 - 0.018 * smooth(0.06, 0.02, ax); // lower toward the nose
    const sideOK = smooth(F.halfW + 0.002, F.halfW - 0.008, ax) * (ax > F.halfW - 0.03 ? smooth(F.backZ + 0.07, F.backZ + 0.09, z) : 1);
    const moust = ax < a + 0.006 ? smooth(F.nose[1] - 0.012, F.nose[1] - 0.02, y) : 1; // below the nose base
    const neck = smooth(F.jaw[1] - 0.075, F.jaw[1] - 0.05, y);
    out.beard = (1 - smooth(cheekLine - 0.004, cheekLine + 0.004, y)) * sideOK * moust * neck * (1 - out.lips) * (1 - out.ear);
  }
  return out;
}

/** bake the skin albedo (+ brow alpha) and the hair/occlusion mask texture */
export function bakeSkin(inp: SkinBakeInput) {
  const { W, H, pos: P, orig, uv, tris, part } = inp;
  const F = faceFrame(inp);
  const NP = P.length / 3; const nrm = new Float64Array(NP * 3);
  for (let t = 0; t < tris.length; t += 3) { const a = orig[tris[t]] * 3, b = orig[tris[t + 1]] * 3, c = orig[tris[t + 2]] * 3;
    const u = [P[b] - P[a], P[b + 1] - P[a + 1], P[b + 2] - P[a + 2]], v = [P[c] - P[a], P[c + 1] - P[a + 1], P[c + 2] - P[a + 2]];
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    for (const i of [a, b, c]) for (let k = 0; k < 3; k++) nrm[i + k] += n[k]; }
  for (let i = 0; i < NP; i++) { const l = Math.hypot(nrm[i * 3], nrm[i * 3 + 1], nrm[i * 3 + 2]) || 1; for (let k = 0; k < 3; k++) nrm[i * 3 + k] /= l; }
  const J = (b: string) => inp.joints[inp.bone[b]], T = (b: string) => inp.tails[inp.bone[b]];
  const tips: number[][] = []; for (const s of ['l', 'r']) for (const f of ['thumb', 'index', 'middle', 'ring', 'pinky']) tips.push(T(`${f}_03_${s}`));
  const palmN: Record<string, number[]> = {};
  for (const s of ['l', 'r']) { const w = J(`hand_${s}`), i = J(`index_01_${s}`), q = J(`pinky_01_${s}`); const a = [i[0] - w[0], i[1] - w[1], i[2] - w[2]], b = [q[0] - w[0], q[1] - w[1], q[2] - w[2]];
    let n = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; const l = Math.hypot(...n); n = n.map(x => x / l * (s === 'l' ? -1 : 1)); palmN[s] = n; }
  const knees = [J('calf_l'), J('calf_r')], elbows = [J('lowerarm_l'), J('lowerarm_r')];

  const img = new Uint8Array(W * H * 4), hair = new Uint8Array((W / 2) * (H / 2) * 4), filled = new Uint8Array(W * H);
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4), srgb = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
  const base = REF_TONE.map(lin);
  const shade = (p: number[], n: number[], pt: number, ao: number) => {
    const isHead = pt === 0, isNeck = pt === 1; const m = faceMasks(F, p, n, isHead, isNeck);
    let r = base[0], g = base[1], b = base[2];
    // broad mottling (redness/melanin variation) and fine pores
    const mot = fbm(p[0] * 18, p[1] * 18, p[2] * 18, 3), red = fbm(p[0] * 9 + 7, p[1] * 9, p[2] * 9, 3);
    const pore = vnoise(p[0] * 900, p[1] * 900, p[2] * 900) * 0.5 + vnoise(p[0] * 2300, p[1] * 2300, p[2] * 2300) * 0.5;
    const k = 1 + 0.07 * mot - 0.035 * Math.max(0, pore - 0.35) * (isHead ? 1.4 : 1);
    r *= k * (1 + 0.05 * red); g *= k * (1 - 0.02 * red); b *= k * (1 - 0.03 * red);
    // regional tints (multiplicative, linear)
    const tint = (f: number, tr: number, tg: number, tb: number) => { r *= 1 + (tr - 1) * f; g *= 1 + (tg - 1) * f; b *= 1 + (tb - 1) * f; };
    tint(m.lips, 0.92, 0.55, 0.58); tint(m.cheek, 1.04, 0.9, 0.9); tint(m.noseRed, 1.05, 0.88, 0.88); tint(m.ear, 1.02, 0.84, 0.84);
    tint(m.lid * 0.7, 0.86, 0.8, 0.86);
    if (isHead) tint(smooth(F.eyeY + 0.03, F.eyeY + 0.08, p[1]) * 0.5, 1.03, 1.02, 0.97); // forehead a little yellower
    // hands and feet: palms/soles paler and pinker; knuckles, nails
    const side = p[0] > 0 ? 'l' : 'r';
    if (pt === 7 || pt === 10) { const pn = palmN[side], d = n[0] * pn[0] + n[1] * pn[1] + n[2] * pn[2]; tint(smooth(0.1, 0.6, d), 1.12, 1.02, 1.0); tint(smooth(-0.1, -0.6, d) * 0.5, 0.97, 0.9, 0.9); }
    if (pt === 13 || pt === 16) tint(smooth(-0.3, -0.7, n[1]), 1.15, 1.05, 1.02);
    for (const tp of tips) { const d2 = (p[0] - tp[0]) ** 2 + (p[1] - tp[1]) ** 2 + (p[2] - tp[2]) ** 2; if (d2 < 0.0002) { const pn = palmN[side]; const back = -(n[0] * pn[0] + n[1] * pn[1] + n[2] * pn[2]); tint(smooth(0.2, 0.5, back) * (1 - smooth(0.00004, 0.00012, d2)), 1.18, 1.1, 1.1); } }
    for (const kn of [...knees, ...elbows]) tint(gauss((p[0] - kn[0]) ** 2 + (p[1] - kn[1]) ** 2 + (p[2] - kn[2]) ** 2, 0.045) * 0.6, 0.93, 0.88, 0.86);
    // cavity occlusion darkens folds a little in the albedo too (the renderer applies the rest)
    const occ = 0.75 + 0.25 * ao; r *= occ; g *= occ; b *= occ;
    // brow hair: strands (short strokes along the brow) → alpha; the skin under the brow a little darker
    const strands = 0.55 + 0.45 * vnoise(p[0] * 700 + p[1] * 250, p[1] * 1400 - p[0] * 300, p[2] * 200);
    const brow = Math.max(0, Math.min(1, m.brow * (0.7 + 0.5 * strands)));
    tint(m.brow * 0.5, 0.85, 0.82, 0.8);
    return { rgb: [srgb(r), srgb(g), srgb(b)], a: brow, beard: m.beard, scalp: m.scalp };
  };
  const hw = W / 2, hh = H / 2;
  for (let t = 0; t < tris.length; t += 3) {
    const ids = [tris[t], tris[t + 1], tris[t + 2]], ps = ids.map(i => orig[i]);
    const pt = [part[ps[0]], part[ps[1]], part[ps[2]]].sort((a, b) => a - b)[1];
    const U = ids.map(i => [uv[i * 2] * W, (1 - uv[i * 2 + 1]) * H]);
    const each = (Wd: number, Hd: number, s: number, fn: (x: number, y: number, pp: number[], nn: number[], ao: number) => void) => rasterTri(Wd, Hd, U[0][0] * s, U[0][1] * s, U[1][0] * s, U[1][1] * s, U[2][0] * s, U[2][1] * s, (x, y, b0, b1, b2) => {
      const bw = [b0, b1, b2]; const pp = [0, 0, 0], nn = [0, 0, 0]; let ao = 0;
      for (let j = 0; j < 3; j++) { for (let k = 0; k < 3; k++) { pp[k] += bw[j] * P[ps[j] * 3 + k]; nn[k] += bw[j] * nrm[ps[j] * 3 + k]; } ao += bw[j] * inp.ao[ps[j]]; }
      fn(x, y, pp, nn, ao);
    }, 1.2);
    each(W, H, 1, (x, y, pp, nn, ao) => { const s = shade(pp, nn, pt, ao); const k = y * W + x; if (filled[k] === 2) return; filled[k] = 2;
      img[k * 4] = Math.round(s.rgb[0] * 255); img[k * 4 + 1] = Math.round(s.rgb[1] * 255); img[k * 4 + 2] = Math.round(s.rgb[2] * 255); img[k * 4 + 3] = Math.round(s.a * 255); });
    each(hw, hh, 0.5, (x, y, pp, nn, ao) => { const m = faceMasks(F, pp, nn, pt === 0, pt === 1); const k = y * hw + x;
      hair[k * 4] = Math.max(hair[k * 4], Math.round(m.beard * 255)); hair[k * 4 + 1] = Math.max(hair[k * 4 + 1], Math.round(m.scalp * 255)); hair[k * 4 + 2] = Math.round(ao * 255); hair[k * 4 + 3] = 255; });
  }
  // dilate into empty texels (mip/bilinear bleeding at UV seams)
  for (let pass = 0; pass < 6; pass++) {
    const src = img.slice();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const k = y * W + x; if (filled[k]) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue; const kk = yy * W + xx; if (filled[kk] && filled[kk] < 3 + pass) { img.set(src.subarray(kk * 4, kk * 4 + 4), k * 4); filled[k] = 3 + pass; break; } } }
  }
  for (let k = 0; k < W * H; k++) if (!filled[k]) img.set([Math.round(REF_TONE[0] * 255), Math.round(REF_TONE[1] * 255), Math.round(REF_TONE[2] * 255), 0], k * 4);
  // the mask texture: same dilation (alpha marks written texels)
  for (let pass = 0; pass < 4; pass++) {
    const src = hair.slice();
    for (let y = 0; y < hh; y++) for (let x = 0; x < hw; x++) { const k = y * hw + x; if (src[k * 4 + 3]) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= hw || yy >= hh) continue; const kk = yy * hw + xx; if (src[kk * 4 + 3]) { hair.set(src.subarray(kk * 4, kk * 4 + 4), k * 4); break; } } }
  }
  for (let k = 0; k < hw * hh; k++) if (!hair[k * 4 + 3]) hair.set([0, 0, 255, 255], k * 4);
  return { skin: img, hair, frame: F };
}

/** per-vertex masks for the runtime (beard, scalp), 0..255 */
export function vertexMasks(F: FaceFrame, P: Float64Array, nrm: Float64Array, part: Uint8Array, n: number) {
  const beard = new Uint8Array(n), scalp = new Uint8Array(n);
  for (let p = 0; p < n; p++) { const m = faceMasks(F, [P[p * 3], P[p * 3 + 1], P[p * 3 + 2]], [nrm[p * 3], nrm[p * 3 + 1], nrm[p * 3 + 2]], part[p] === 0, part[p] === 1);
    beard[p] = Math.round(m.beard * 255); scalp[p] = Math.round(m.scalp * 255); }
  return { beard, scalp };
}

/** cavity occlusion per vertex: fraction of short hemisphere rays (≤ maxD) that escape the mesh (uniform grid) */
export function cavityAO(P: Float64Array, nrm: Float64Array, tris: number[], orig: number[], n: number, maxD = 0.035, rays = 40): Float32Array {
  const cell = 0.02; const grid = new Map<string, number[]>();
  const keyOf = (x: number, y: number, z: number) => `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`;
  const T: number[][] = [];
  for (let t = 0; t < tris.length; t += 3) { const a = orig[tris[t]], b = orig[tris[t + 1]], c = orig[tris[t + 2]]; if (a === b || b === c || a === c) continue; const ti = T.length; T.push([a, b, c]);
    const lo = [0, 1, 2].map(k => Math.min(P[a * 3 + k], P[b * 3 + k], P[c * 3 + k])), hi = [0, 1, 2].map(k => Math.max(P[a * 3 + k], P[b * 3 + k], P[c * 3 + k]));
    for (let x = Math.floor(lo[0] / cell); x <= Math.floor(hi[0] / cell); x++) for (let y = Math.floor(lo[1] / cell); y <= Math.floor(hi[1] / cell); y++) for (let z = Math.floor(lo[2] / cell); z <= Math.floor(hi[2] / cell); z++) {
      const k = `${x},${y},${z}`; let l = grid.get(k); if (!l) grid.set(k, l = []); l.push(ti); } }
  // Fibonacci hemisphere directions (z up), rotated to each normal
  const dirs: number[][] = []; for (let i = 0; i < rays; i++) { const zc = (i + 0.5) / rays, r = Math.sqrt(1 - zc * zc), ph = i * 2.399963; dirs.push([r * Math.cos(ph), r * Math.sin(ph), zc]); }
  const out = new Float32Array(n).fill(1);
  const hit = (o: number[], d: number[], ti: number) => { const [a, b, c] = T[ti];
    const e1 = [P[b * 3] - P[a * 3], P[b * 3 + 1] - P[a * 3 + 1], P[b * 3 + 2] - P[a * 3 + 2]], e2 = [P[c * 3] - P[a * 3], P[c * 3 + 1] - P[a * 3 + 1], P[c * 3 + 2] - P[a * 3 + 2]];
    const pv = [d[1] * e2[2] - d[2] * e2[1], d[2] * e2[0] - d[0] * e2[2], d[0] * e2[1] - d[1] * e2[0]]; const det = e1[0] * pv[0] + e1[1] * pv[1] + e1[2] * pv[2]; if (Math.abs(det) < 1e-12) return false;
    const tv = [o[0] - P[a * 3], o[1] - P[a * 3 + 1], o[2] - P[a * 3 + 2]]; const u = (tv[0] * pv[0] + tv[1] * pv[1] + tv[2] * pv[2]) / det; if (u < 0 || u > 1) return false;
    const qv = [tv[1] * e1[2] - tv[2] * e1[1], tv[2] * e1[0] - tv[0] * e1[2], tv[0] * e1[1] - tv[1] * e1[0]]; const v = (d[0] * qv[0] + d[1] * qv[1] + d[2] * qv[2]) / det; if (v < 0 || u + v > 1) return false;
    const t = (e2[0] * qv[0] + e2[1] * qv[1] + e2[2] * qv[2]) / det; return t > 0.0015 && t < maxD; };
  for (let p = 0; p < n; p++) {
    const nz = [nrm[p * 3], nrm[p * 3 + 1], nrm[p * 3 + 2]]; if (!nz[0] && !nz[1] && !nz[2]) continue;
    const tx = Math.abs(nz[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]; const t1 = [nz[1] * tx[2] - nz[2] * tx[1], nz[2] * tx[0] - nz[0] * tx[2], nz[0] * tx[1] - nz[1] * tx[0]]; const l1 = Math.hypot(...t1); for (let k = 0; k < 3; k++) t1[k] /= l1;
    const t2 = [nz[1] * t1[2] - nz[2] * t1[1], nz[2] * t1[0] - nz[0] * t1[2], nz[0] * t1[1] - nz[1] * t1[0]];
    const o = [P[p * 3] + nz[0] * 0.0008, P[p * 3 + 1] + nz[1] * 0.0008, P[p * 3 + 2] + nz[2] * 0.0008]; let blocked = 0, wsum = 0;
    for (const dd of dirs) { const d = [0, 1, 2].map(k => t1[k] * dd[0] + t2[k] * dd[1] + nz[k] * dd[2]); const w = dd[2]; wsum += w;
      const seen = new Set<number>(); let hitAny = false;
      for (let s = 0; s <= maxD && !hitAny; s += cell * 0.5) { const l = grid.get(keyOf(o[0] + d[0] * s, o[1] + d[1] * s, o[2] + d[2] * s)); if (!l) continue;
        for (const ti of l) { if (seen.has(ti)) continue; seen.add(ti); if (hit(o, d, ti)) { hitAny = true; break; } } }
      if (hitAny) blocked += w; }
    out[p] = 1 - blocked / wsum;
  }
  return out;
}
