// Skin bake for the human assets (D-020, D-155; tier C). MakeHuman's skin textures live in its separate asset repository,
// which is not reachable from the build sandbox, so the skin is generated: every body triangle is rasterised in UV
// space and each texel evaluates 3-D procedural functions at its bind-pose position on the reference body, so the map
// is seamless across UV islands and fits every variant (same topology and UVs).
//   skin.png   a 2:1 atlas. Left half: RGB = albedo of a reference mid tone (sRGB; the renderer rescales it to each
//              person's tone), A = eyebrow hair density. Right half (D-155): R = crease height, G = skin oil,
//              B = age-line height (RGB stored sRGB-encoded: the texture is decoded as sRGB), A = translucency (thin parts)
//   hair.png   R = beard density (men), G = scalp hair density, B = cavity occlusion (1 = open)
// The same region functions give per-vertex masks (beard, scalp) used by the runtime to build hair shells.
import { rasterTri } from './raster';

export interface SkinBakeInput {
  W: number; H: number; pos: Float64Array; orig: number[]; uv: number[]; tris: number[]; part: Uint8Array;
  joints: number[][]; tails: number[][]; bone: Record<string, number>; landmarks: Record<string, number>; ao: Float32Array;
  /** per position vertex skin indices/weights (4 each, bytes): when given, the mouth line is the upper/lower-lip weight split */
  skinIndex?: Uint8Array; skinWeight?: Uint8Array;
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
export function faceFrame(inp: Pick<SkinBakeInput, 'pos' | 'joints' | 'bone' | 'landmarks' | 'part' | 'skinIndex' | 'skinWeight'>) {
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
    // The most recessed point finds the mentolabial sulcus on MakeHuman's closed neutral mouth, 1.5–2 cm below the lips
    // (the first skin bake painted the lower lip on the chin). With skin weights, the mouth line is where the midline
    // front vertices change from head-weighted (upper lip) to jaw-weighted (lower lip).
    if (inp.skinIndex && inp.skinWeight) { const jb = inp.bone.jaw; let upLow = Infinity, loHigh = -Infinity;
      for (let p = 0; p < 13380; p++) { if (inp.part[p] !== 0) continue; const x = P[p * 3], y = P[p * 3 + 1], z = P[p * 3 + 2];
        if (Math.abs(x) > 0.0025 || y < chin[1] || y > nose[1] - 0.01 || z < nose[2] - 0.03) continue;
        let w = 0; for (let k = 0; k < 4; k++) if (inp.skinIndex[p * 4 + k] === jb) w = inp.skinWeight[p * 4 + k] / 255;
        if (w < 0.3) upLow = Math.min(upLow, y); else if (w > 0.5) loHigh = Math.max(loHigh, y); }
      if (Number.isFinite(upLow) && Number.isFinite(loHigh)) mouth = [0, (upLow + loHigh) / 2, mouth[2]]; }
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

/** Skin detail at a bind-pose point of the reference head (D-155; C: placed from the face frame, shaped after standard
 *  facial anatomy, not measured): crease height (m; grooves negative) of the lid creases, the nasolabial and alar
 *  grooves, the philtrum and the mentolabial sulcus; age-line height (m; scaled at runtime by the age decade) of forehead
 *  lines, glabellar lines, crow's feet, the tear trough, marionette lines and neck rings; skin oil 0..1 (sebaceous
 *  T-zone, wet lips). */
export const DETAIL_SCALE = { crease: 0.00045, age: 0.0004 }; // must match humanMaterial SKIN.crease / SKIN.age
export function faceDetail(F: FaceFrame, p: number[], n: number[], isHead: boolean, isNeck: boolean, lips: number) {
  const out = { crease: 0, age: 0, oil: 0.15 };
  if (!isHead && !isNeck) return out;
  const [x, y, z] = p, ax = Math.abs(x);
  const groove = (d: number, w: number) => Math.exp(-((d / w) ** 2));
  const front = smooth(0.05, 0.3, n[2]);
  out.oil = isHead ? 0.25 : 0.2;
  if (isHead) {
    const eye = x > 0 ? F.eL : F.eR, xl = (x - eye[0]) * Math.sign(x), dyE = y - F.eyeY; // xl > 0 toward the temple
    const onLid = z > F.eyeZ - 0.004 ? front : 0;
    // upper lid crease (~5 mm above the lid margin) and the fainter lower lid crease
    const upC = 0.0068 - 0.0045 * (xl / 0.015) ** 2, upF = smooth(-0.014, -0.011, xl) * (1 - smooth(0.015, 0.019, xl));
    out.crease -= onLid * upF * groove(dyE - upC, 0.0009) * 0.9 * DETAIL_SCALE.crease;
    const loC = -0.0095 + 0.003 * (xl / 0.015) ** 2, loF = smooth(-0.012, -0.008, xl) * (1 - smooth(0.012, 0.017, xl));
    out.crease -= onLid * loF * groove(dyE - loC, 0.001) * 0.45 * DETAIL_SCALE.crease;
    // curves in (|x|, y): distance to a quadratic Bézier
    const bez = (p0: number[], p1: number[], p2: number[]) => { let d = 9; for (let i = 0; i <= 24; i++) { const t = i / 24, a = (1 - t) * (1 - t), b = 2 * t * (1 - t), c = t * t;
      d = Math.min(d, Math.hypot(ax - (a * p0[0] + b * p1[0] + c * p2[0]), y - (a * p0[1] + b * p1[1] + c * p2[1]))); } return d; };
    const lipA = 0.8 * F.ipd / 2 + 0.004, nz = F.nose[2], ny = F.nose[1], my = F.mouth[1];
    const faceFront = z > nz - 0.05 ? front : 0;
    // nasolabial fold: from the nose wing to beside the mouth corner; alar groove around the nose wing
    const nl = bez([0.0165, ny + 0.003], [0.028, ny - 0.012], [lipA + 0.011, my - 0.008]);
    out.crease -= faceFront * groove(nl, 0.0022) * 0.5 * DETAIL_SCALE.crease; // soft in the young; the age channel deepens it
    out.age -= faceFront * groove(nl, 0.0026) * 0.9 * DETAIL_SCALE.age;
    const al = bez([0.0125, ny + 0.011], [0.0195, ny + 0.004], [0.0125, ny - 0.005]);
    out.crease -= faceFront * groove(al, 0.0011) * 0.7 * DETAIL_SCALE.crease;
    // philtrum: two columns and the groove between them; the mentolabial sulcus below the lower lip
    const phY = smooth(my + 0.003, my + 0.006, y) * (1 - smooth(ny - 0.008, ny - 0.004, y));
    out.crease += faceFront * phY * (groove(ax - 0.0045, 0.0012) * 0.4 - groove(ax, 0.0015) * 0.3) * DETAIL_SCALE.crease;
    out.crease -= faceFront * (1 - smooth(0.014, 0.02, ax)) * groove(y - (my - 0.0135 + 0.01 * (ax / 0.02) ** 2), 0.0022) * 0.45 * DETAIL_SCALE.crease;
    // age lines: forehead (wavy horizontals), glabella, crow's feet, tear trough, marionette lines
    const fh = (1 - smooth(0.035, 0.048, ax)) * (z > F.eyeZ - 0.02 ? front : 0);
    for (const k of [0.027, 0.036, 0.045]) out.age -= fh * groove(dyE - k - 0.0012 * Math.sin(x * 140 + k * 900), 0.0014) * (0.6 + 0.4 * Math.sin(x * 95 + k * 400)) * DETAIL_SCALE.age;
    out.age -= (z > F.eyeZ - 0.01 ? front : 0) * groove(ax - 0.0055, 0.0011) * smooth(0.008, 0.011, dyE) * (1 - smooth(0.02, 0.026, dyE)) * 0.45 * DETAIL_SCALE.age;
    for (const ang of [-0.6, -0.2, 0.25]) { const cx = 0.019, dx = xl - cx, dy = dyE; const along = dx * Math.cos(ang) + dy * Math.sin(ang), across = -dx * Math.sin(ang) + dy * Math.cos(ang);
      out.age -= smooth(0.0, 0.003, along) * (1 - smooth(0.01, 0.016, along)) * groove(across, 0.001) * 0.8 * DETAIL_SCALE.age; }
    out.age -= onLid * loF * groove(dyE - (-0.0135 + 0.004 * (xl / 0.015) ** 2), 0.0012) * 0.7 * DETAIL_SCALE.age;
    const mar = bez([lipA + 0.001, my - 0.001], [lipA + 0.004, my - 0.01], [lipA + 0.003, my - 0.022]);
    out.age -= faceFront * groove(mar, 0.0016) * 0.7 * DETAIL_SCALE.age;
    // oil: nose, forehead centre, chin; wet lips; dry lids
    const noseO = Math.exp(-((ax / 0.011) ** 2)) * smooth(ny - 0.01, ny, y) * (1 - smooth(F.eyeY - 0.005, F.eyeY + 0.005, y));
    const foreO = Math.exp(-((ax / 0.03) ** 2)) * smooth(F.eyeY + 0.012, F.eyeY + 0.03, y);
    const chinO = Math.exp(-((ax / 0.015) ** 2 + ((y - F.chin[1] - 0.012) / 0.012) ** 2));
    out.oil = Math.max(out.oil, 0.85 * noseO, 0.55 * foreO, 0.5 * chinO, 0.35 * front * (1 - smooth(0.05, 0.065, ax)));
    out.oil = out.oil * (1 - 0.6 * onLid * Math.exp(-(((dyE - 0.004) / 0.006) ** 2))) + (0.95 - out.oil) * lips;
  }
  if (isNeck || (isHead && y < F.jaw[1] - 0.015)) { // neck rings (front)
    const nf = smooth(-0.2, 0.3, n[2]) * (1 - smooth(0.03, 0.05, ax));
    for (const k of [0.03, 0.047]) out.age -= nf * groove(y - (F.jaw[1] - k) - 0.002 * Math.cos(x * 60), 0.0009) * 0.6 * DETAIL_SCALE.age;
  }
  return out;
}
/** thickness along −n to the far side of the body (m, capped): thin parts (ears, nostril wings, lids) transmit light */
export function thicknessPerVertex(P: Float64Array, nrm: Float64Array, tris: number[], orig: number[], n: number, part: Uint8Array, maxD = 0.02): Float32Array {
  const cell = 0.01; const grid = new Map<string, number[]>(); const T: number[][] = [];
  for (let t = 0; t < tris.length; t += 3) { const a = orig[tris[t]], b = orig[tris[t + 1]], c = orig[tris[t + 2]]; if (a === b || b === c || a === c) continue; const ti = T.length; T.push([a, b, c]);
    const lo = [0, 1, 2].map(k => Math.min(P[a * 3 + k], P[b * 3 + k], P[c * 3 + k])), hi = [0, 1, 2].map(k => Math.max(P[a * 3 + k], P[b * 3 + k], P[c * 3 + k]));
    for (let x = Math.floor(lo[0] / cell); x <= Math.floor(hi[0] / cell); x++) for (let y = Math.floor(lo[1] / cell); y <= Math.floor(hi[1] / cell); y++) for (let z = Math.floor(lo[2] / cell); z <= Math.floor(hi[2] / cell); z++) {
      const k = `${x},${y},${z}`; let l = grid.get(k); if (!l) grid.set(k, l = []); l.push(ti); } }
  const out = new Float32Array(n).fill(maxD);
  for (let p = 0; p < n; p++) {
    if (part[p] >= 17) continue; const d = [-nrm[p * 3], -nrm[p * 3 + 1], -nrm[p * 3 + 2]]; if (!d[0] && !d[1] && !d[2]) continue;
    const o = [P[p * 3] + d[0] * 0.0003, P[p * 3 + 1] + d[1] * 0.0003, P[p * 3 + 2] + d[2] * 0.0003]; let best = maxD; const seen = new Set<number>();
    for (let s = 0; s <= maxD; s += cell * 0.5) { const l = grid.get(`${Math.floor((o[0] + d[0] * s) / cell)},${Math.floor((o[1] + d[1] * s) / cell)},${Math.floor((o[2] + d[2] * s) / cell)}`); if (!l) continue;
      for (const ti of l) { if (seen.has(ti)) continue; seen.add(ti); const [a, b, c] = T[ti]; if (a === p || b === p || c === p) continue;
        const e1 = [P[b * 3] - P[a * 3], P[b * 3 + 1] - P[a * 3 + 1], P[b * 3 + 2] - P[a * 3 + 2]], e2 = [P[c * 3] - P[a * 3], P[c * 3 + 1] - P[a * 3 + 1], P[c * 3 + 2] - P[a * 3 + 2]];
        const pv = [d[1] * e2[2] - d[2] * e2[1], d[2] * e2[0] - d[0] * e2[2], d[0] * e2[1] - d[1] * e2[0]]; const det = e1[0] * pv[0] + e1[1] * pv[1] + e1[2] * pv[2]; if (Math.abs(det) < 1e-14) continue;
        const tv = [o[0] - P[a * 3], o[1] - P[a * 3 + 1], o[2] - P[a * 3 + 2]]; const u = (tv[0] * pv[0] + tv[1] * pv[1] + tv[2] * pv[2]) / det; if (u < 0 || u > 1) continue;
        const qv = [tv[1] * e1[2] - tv[2] * e1[1], tv[2] * e1[0] - tv[0] * e1[2], tv[0] * e1[1] - tv[1] * e1[0]]; const v = (d[0] * qv[0] + d[1] * qv[1] + d[2] * qv[2]) / det; if (v < 0 || u + v > 1) continue;
        const t = (e2[0] * qv[0] + e2[1] * qv[1] + e2[2] * qv[2]) / det; if (t > 0.0005 && t < best) best = t; }
      if (best < s) break; }
    out[p] = best;
  }
  return out;
}
/** translucency 0..1 from thickness (C: light through a few mm of tissue; ears 2–5 mm glow red against the sun) */
export const translucency = (t: number) => Math.exp(-t / 0.0035);

/** bake the skin atlas (2W × H: left albedo + brow alpha, right detail) and the hair/occlusion mask texture */
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

  const img = new Uint8Array(W * H * 4), det = new Uint8Array(W * H * 4), hair = new Uint8Array((W / 2) * (H / 2) * 4), filled = new Uint8Array(W * H);
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4), srgb = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
  const base = REF_TONE.map(lin);
  const thick = thicknessPerVertex(P, nrm, tris, orig, NP, part);
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
    tint(m.lips, 0.93, 0.7, 0.7); tint(m.cheek, 1.03, 0.93, 0.93); tint(m.noseRed, 1.04, 0.91, 0.91); tint(m.ear, 1.01, 0.91, 0.91); // lip and flush tints toned down (the first bake read as lipstick and sunburn; C)
    tint(m.lid * 0.7, 0.86, 0.8, 0.86);
    if (isHead) tint(smooth(F.eyeY + 0.03, F.eyeY + 0.08, p[1]) * 0.5, 1.03, 1.02, 0.97); // forehead a little yellower
    // sun exposure (D-155, C): the face's upper planes, the nose, the backs of the hands and forearms and the tops of the
    // feet a little darker and browner than skin kept under clothing
    const up = Math.max(0, n[1]), sun = isHead ? 0.5 + 0.5 * smooth(-0.2, 0.5, up + 0.3 * n[2]) : (pt >= 5 && pt <= 10) || pt === 13 || pt === 16 ? 0.6 : 0;
    tint(sun * 0.35, 0.95, 0.93, 0.9);
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
    const d = faceDetail(F, p, n, isHead, isNeck, m.lips);
    return { rgb: [srgb(r), srgb(g), srgb(b)], a: brow, beard: m.beard, scalp: m.scalp, det: d };
  };
  const hw = W / 2, hh = H / 2;
  for (let t = 0; t < tris.length; t += 3) {
    const ids = [tris[t], tris[t + 1], tris[t + 2]], ps = ids.map(i => orig[i]);
    const pt = [part[ps[0]], part[ps[1]], part[ps[2]]].sort((a, b) => a - b)[1];
    const U = ids.map(i => [uv[i * 2] * W, (1 - uv[i * 2 + 1]) * H]);
    const each = (Wd: number, Hd: number, s: number, fn: (x: number, y: number, pp: number[], nn: number[], ao: number, th: number) => void) => rasterTri(Wd, Hd, U[0][0] * s, U[0][1] * s, U[1][0] * s, U[1][1] * s, U[2][0] * s, U[2][1] * s, (x, y, b0, b1, b2) => {
      const bw = [b0, b1, b2]; const pp = [0, 0, 0], nn = [0, 0, 0]; let ao = 0, th = 0;
      for (let j = 0; j < 3; j++) { for (let k = 0; k < 3; k++) { pp[k] += bw[j] * P[ps[j] * 3 + k]; nn[k] += bw[j] * nrm[ps[j] * 3 + k]; } ao += bw[j] * inp.ao[ps[j]]; th += bw[j] * thick[ps[j]]; }
      fn(x, y, pp, nn, ao, th);
    }, 1.2);
    each(W, H, 1, (x, y, pp, nn, ao, th) => { const s = shade(pp, nn, pt, ao); const k = y * W + x; if (filled[k] === 2) return; filled[k] = 2;
      img[k * 4] = Math.round(s.rgb[0] * 255); img[k * 4 + 1] = Math.round(s.rgb[1] * 255); img[k * 4 + 2] = Math.round(s.rgb[2] * 255); img[k * 4 + 3] = Math.round(s.a * 255);
      // detail: data stored sRGB-encoded in RGB (the texture is decoded as sRGB, so the shader reads the linear value)
      det[k * 4] = Math.round(255 * srgb(Math.max(0, Math.min(1, 0.5 + s.det.crease / (2 * DETAIL_SCALE.crease)))));
      det[k * 4 + 1] = Math.round(255 * srgb(Math.max(0, Math.min(1, s.det.oil))));
      det[k * 4 + 2] = Math.round(255 * srgb(Math.max(0, Math.min(1, 0.5 + s.det.age / (2 * DETAIL_SCALE.age)))));
      det[k * 4 + 3] = Math.round(255 * translucency(th)); });
    each(hw, hh, 0.5, (x, y, pp, nn, ao) => { const m = faceMasks(F, pp, nn, pt === 0, pt === 1); const k = y * hw + x;
      hair[k * 4] = Math.max(hair[k * 4], Math.round(m.beard * 255)); hair[k * 4 + 1] = Math.max(hair[k * 4 + 1], Math.round(m.scalp * 255)); hair[k * 4 + 2] = Math.round(ao * 255); hair[k * 4 + 3] = 255; });
  }
  // dilate into empty texels (mip/bilinear bleeding at UV seams); the detail half the same way
  for (let pass = 0; pass < 6; pass++) {
    const src = img.slice(), srcD = det.slice();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const k = y * W + x; if (filled[k]) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue; const kk = yy * W + xx; if (filled[kk] && filled[kk] < 3 + pass) { img.set(src.subarray(kk * 4, kk * 4 + 4), k * 4); det.set(srcD.subarray(kk * 4, kk * 4 + 4), k * 4); filled[k] = 3 + pass; break; } } }
  }
  const neutral = [Math.round(255 * srgb(0.5)), Math.round(255 * srgb(0.15)), Math.round(255 * srgb(0.5)), 0];
  for (let k = 0; k < W * H; k++) if (!filled[k]) { img.set([Math.round(REF_TONE[0] * 255), Math.round(REF_TONE[1] * 255), Math.round(REF_TONE[2] * 255), 0], k * 4); det.set(neutral, k * 4); }
  // the mask texture: same dilation (alpha marks written texels)
  for (let pass = 0; pass < 4; pass++) {
    const src = hair.slice();
    for (let y = 0; y < hh; y++) for (let x = 0; x < hw; x++) { const k = y * hw + x; if (src[k * 4 + 3]) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= hw || yy >= hh) continue; const kk = yy * hw + xx; if (src[kk * 4 + 3]) { hair.set(src.subarray(kk * 4, kk * 4 + 4), k * 4); break; } } }
  }
  for (let k = 0; k < hw * hh; k++) if (!hair[k * 4 + 3]) hair.set([0, 0, 255, 255], k * 4);
  // the 2:1 atlas: albedo + brows | detail
  const atlas = new Uint8Array(2 * W * H * 4);
  for (let y = 0; y < H; y++) { atlas.set(img.subarray(y * W * 4, (y + 1) * W * 4), y * 2 * W * 4); atlas.set(det.subarray(y * W * 4, (y + 1) * W * 4), (y * 2 * W + W) * 4); }
  return { skin: atlas, skinW: 2 * W, skinH: H, albedo: img, detail: det, hair, frame: F, thickness: thick };
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
