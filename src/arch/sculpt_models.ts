// Signed-distance models of the organic / carved pieces (D-018), polygonised offline by tools/build_sculpt.ts:
//  • the double-bull protome (unit: shaft diameter D; bull facing +x, mirrored), shared by composite and bull capitals,
//  • the vertical double-volute member of the composite capital (unit D),
//  • the Gate of All Nations doorway colossi (metres, reference box = sculpture.json colossus.reference_box): the W bulls
//    and the E human-headed winged bulls, carved from the jamb: fore-part in the round, flank in high relief.
// Every number is a row of src/data/sculpture.json (tier C shape proportions with notes); nothing here is attested
// measurement. Stylised Achaemenid forms, reconstructed from general knowledge of the type (RECOLLECTION, C).
import S from '../data/sculpture.json';
import { SPEC } from './spec';
import { SDF, Shape, shape, unionOf, smin, smax, clamp, smoothstep, sdEllipsoid, sdRoundCone, sdBox, sdSphere, sdCylY, sdTorus, sdSpiral2, extrude, sdBox2 } from './sdf';

type V3 = [number, number, number];
const SC = S as any;
const r = (g: string, k: string) => { const x = SC[g]?.[k]; if (!x || x.v === undefined) throw new Error(`sculpture.json missing ${g}.${k}`); return x.v; };
const dist = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const mid = (a: V3, b: V3): V3 => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];

// ------------------------------------------------------------------ bounded primitive constructors
export const ell = (c: V3, rr: V3): Shape => shape((x, y, z) => sdEllipsoid(x - c[0], y - c[1], z - c[2], rr[0], rr[1], rr[2]), c, Math.max(...rr));
export const cone = (a: V3, b: V3, r1: number, r2: number): Shape => shape((x, y, z) => sdRoundCone(x, y, z, a[0], a[1], a[2], b[0], b[1], b[2], r1, r2), mid(a, b), dist(a, b) / 2 + Math.max(r1, r2));
export const rbox = (c: V3, h: V3, rad: number): Shape => shape((x, y, z) => sdBox(x - c[0], y - c[1], z - c[2], h[0], h[1], h[2], rad), c, Math.hypot(...h));
/** squeeze a shape toward the plane z = zc by factor s ≥ 1 (elliptical cross-sections of bodies) */
export const squeezeZ = (sh: Shape, zc: number, s: number): Shape => shape((x, y, z) => sh.f(x, y, zc + (z - zc) * s) / s, sh.c, sh.R);
/** chain of round cones through points with radii */
export const chain = (pts: V3[], radii: number[]): Shape[] => pts.slice(1).map((p, i) => cone(pts[i], p, radii[i], radii[i + 1]));

/** smooth box mask (1 inside [a,b], soft edge e) */
const band = (x: number, a: number, b: number, e: number) => smoothstep(a - e, a + e, x) * (1 - smoothstep(b - e, b + e, x));

/** Snail curls (the lock convention of Achaemenid carving, D-018/D-029) in staggered rows in a 2D chart (u across, v
 *  along): each lock a rounded boss of radius `rad` cut by a spiral groove that coils `turns` times from the rim into the
 *  centre; neighbouring locks coil in opposite senses, as carved. Returns the relief in units of the boss height: 1 on the
 *  boss crown, 0 between locks, down to −gd in the groove (gw = groove half-width, fraction of rad). */
export function snail(u: number, v: number, pitch: number, rad: number, turns: number, gw: number, gd: number) {
  const row = Math.round(v / pitch); let best = Infinity, bu = 0, bv = 0, hand = 1;
  for (let rr = row - 1; rr <= row + 1; rr++) {
    const off = (rr & 1) ? pitch / 2 : 0, col = Math.round((u - off) / pitch), du = u - (col * pitch + off), dv = v - rr * pitch, d2 = du * du + dv * dv;
    if (d2 < best) { best = d2; bu = du; bv = dv; hand = (col + rr) & 1 ? 1 : -1; }
  }
  const r = Math.sqrt(best) / rad; if (r >= 1) return 0;
  const dome = Math.sqrt(1 - r * r);
  let a = Math.atan2(bv, bu) * hand; if (a < 0) a += 2 * Math.PI;
  let dm = Infinity; // distance (rad units) to the nearest arm of the Archimedean spiral r = θ / (2π·turns)
  for (let k = 0; k <= Math.ceil(turns); k++) { const th = a + 2 * Math.PI * k; if (th > turns * 2 * Math.PI) break; dm = Math.min(dm, Math.abs(r - th / (2 * Math.PI * turns))); }
  const g = Math.max(0, 1 - dm / gw);
  return dome - gd * g * g * (3 - 2 * g) * smoothstep(0.02, 0.2, r);
}
/** overlapping scale feathers (wing coverts) in staggered rows, tips down: each feather rises from the rounded lower rim it
 *  shows and slopes back under the row above. u across, v up (row pitch pv, feather pitch pu); 0..1 */
export function scales(u: number, v: number, pu: number, pv: number) {
  const row = Math.floor(v / pv), cu = ((u / pu + (row & 1 ? 0.5 : 0)) % 1 + 1) % 1 - 0.5, cv = v / pv - row;
  const rim = 0.45 * (2 * cu) ** 2; // the lower edge of the feather: lowest at its centre
  if (cv < rim) return 0.35 * (1 - (rim - cv) / Math.max(rim, 1e-6)); // the tip of the feather in the row below shows here
  return 1 - 0.75 * ((cv - rim) / (1 - rim));
}
/** the Achaemenid beard: horizontal bands of snail curls alternating with bands of long wavy locks, from the top (v = 0,
 *  measured downward) to the bottom row of curls. B = sculpture.json colossus.beard; returns the relief (units of amp) */
export function beardLocks(u: number, v: number, B: any) {
  const bands = B.bands as [string, number][];
  let top = 0, k = 0;
  for (; k < bands.length - 1; k++) { const h = bands[k][0] === 'curls' ? bands[k][1] * B.pitch : bands[k][1]; if (v < top + h) break; top += h; }
  const lv = v - top; // below the last band: its pattern continues to the beard's lower edge
  if (bands[k][0] === 'curls') return snail(u, lv - B.pitch / 2, B.pitch, B.rad, B.turns, B.groove_w, B.groove_d);
  const s = u + B.wave_amp * Math.sin((2 * Math.PI * lv) / B.wave_len), q = Math.cos((Math.PI * 2 * s) / B.strand_pitch) * 0.5 + 0.5;
  return 0.2 + 0.6 * Math.pow(q, 0.7);
}
/** the relief of whichever masked field has the largest mask (fields do not add: a groove in one is not hidden by a zero
 *  of another) */
const pick = (...fm: [number, number][]) => { let bi = -1, bm = 0; fm.forEach(([, m], i) => { if (m > bm) { bm = m; bi = i; } }); return bi < 0 ? 0 : fm[bi][0] * bm; };

// ================================================================== double-bull protome (unit D)
/** SDF of the double-bull protome in D units: x ∈ ±w/2 along the beam, y ∈ [0, h], z ∈ ±d/2 */
export function protomeSDF(): { f: SDF; min: V3; max: V3 } {
  const B = r('protome', 'body'), H = r('protome', 'head'), L = r('protome', 'legs'), C = r('protome', 'curls');
  const [pw, pd] = SPEC.global.r_column_proportions.v.capital_boxes.protome as number[], ph = r('protome', 'frame').h as number;
  const zs = [-1, 1];
  const parts: Shape[] = [
    rbox(B.block_c, B.block_h, B.block_r), rbox([0, B.support_h[1], 0], B.support_h, B.support_r),
    ell(B.chest_c, B.chest_r), ell(B.shoulder_c, B.shoulder_r), cone(B.neck[0], B.neck[1], B.neck[2], B.neck[3]),
    ell(H.skull_c, H.skull_r), cone(H.muzzle[0], H.muzzle[1], H.muzzle[2], H.muzzle[3]), ell(H.nose_c, H.nose_r),
  ], feats: Shape[] = [];
  for (const s of zs) {
    const m = (p: V3): V3 => [p[0], p[1], p[2] * s];
    feats.push(...chain(H.horn.map(m), H.horn_r), cone(m(H.ear[0]), m(H.ear[1]), H.ear[2], H.ear[3]), ell(m(H.eye_c), [H.eye_r, H.eye_r, H.eye_r]));
    parts.push(...chain(L.fore.map(m), L.fore_r), ell(m(L.hoof_c), L.hoof_r));
  }
  // horns, ears and eyes join the head with a small blend (B.blend would melt the horn roots into the skull, D-029)
  const bodyOnly = unionOf(parts, B.blend), featF = unionOf(feats, B.feature_blend);
  const body: SDF = (x, y, z) => smin(bodyOnly(x, y, z), featF(x, y, z), B.feature_blend);
  const f: SDF = (x, y, z) => {
    const X = Math.abs(x);
    let d = body(X, y, z);
    if (d < 0.08) {
      // relief bands of locks: dewlap/chest front (chart z, y), forelock tuft between the horns (chart x, z)
      const dew: [number, number] = [snail(z, y, C.pitch, C.rad, C.turns, C.groove_w, C.groove_d), band(y, C.dewlap_y[0], C.dewlap_y[1], 0.04) * smoothstep(C.dewlap_x - 0.05, C.dewlap_x + 0.05, X) * band(z, -C.dewlap_w, C.dewlap_w, 0.04)];
      const lock: [number, number] = [snail(X, z, C.pitch * C.forelock_scale, C.rad * C.forelock_scale, C.turns, C.groove_w, C.groove_d), band(X, C.forelock_x[0], C.forelock_x[1], 0.02) * smoothstep(C.forelock_y - 0.03, C.forelock_y + 0.03, y) * band(z, -C.forelock_w, C.forelock_w, 0.02)];
      d -= C.amp * pick(dew, lock);
      for (const s of zs) d = smax(d, -sdSphere(X - H.nostril_c[0], y - H.nostril_c[1], z - s * H.nostril_c[2], H.nostril_r), 0.01); // nostrils
    }
    return d;
  };
  const w = pw / 2 + 0.05, dd = pd / 2 + 0.05;
  return { f, min: [-w, -0.03, -dd], max: [w, ph + 0.05, dd] };
}

// ================================================================== vertical double-volute member (unit D)
/** SDF of the volute member: core with, on each of the four faces, two stacked pairs of spiral scrolls joined by stems
 *  and a reeded central band. x ∈ ±wx/2, z ∈ ±wz/2, y ∈ [0, hv]. */
export function voluteSDF(hv: number, wx: number, wz: number): { f: SDF; min: V3; max: V3 } {
  const V = r('volute', 'member');
  const t = V.relief * wx; // relief thickness (same absolute depth on all faces)
  const cx = wx / 2 - t, cz = wz / 2 - t;
  // 2D ornament of one face in (u across the face, v up), face width W
  const ornament = (u: number, v: number, W: number) => {
    const rs = Math.min(W * V.scroll_r, hv * V.scroll_r_max);
    const au = Math.abs(u), cu = W / 2 - rs;
    const top = v > hv / 2, cv = top ? hv - rs : rs;
    const du = au - cu, dv = top ? v - cv : cv - v; // mirrored left/right (|u|) and top/bottom
    const disc = Math.hypot(du, dv) - rs;
    const stemU = cu - rs + V.stem_w, stem = sdBox2(au - stemU, v - hv / 2, V.stem_w, hv / 2 - rs);
    const reedW = stemU - V.stem_w; // central band between the stems
    const reedPitch = (2 * reedW) / Math.max(2, Math.round((2 * reedW) / V.reed_pitch));
    const ru = (((u + reedW) % reedPitch) + reedPitch) % reedPitch - reedPitch / 2;
    const reeds = Math.max(sdBox2(u, v - hv / 2, reedW, hv / 2 - rs * V.reed_inset), Math.abs(ru) - reedPitch * 0.32);
    // the scroll is a rolled band (D-029): the stem rises on the inner side, enters the outer turn and coils over outward
    // and down (top scrolls; the bottom ones are the mirror image). Its height across the band is a half-round cushion
    // between V-shaped channels, so the coils read as a rolled volute rather than a flat disc cut by a thin groove
    const pitch = (rs * (1 - V.eye) * V.fill) / V.turns;
    const toCoil = sdSpiral2(du, dv, rs * V.eye, pitch, V.turns, 0, 1, V.phase); // distance to the band's centre line
    const q = Math.min(1, toCoil / (pitch / 2)), cushion = V.band_base + (1 - V.band_base) * Math.sqrt(Math.max(0, 1 - q * q));
    return { disc, cushion, stem, reeds, eye: Math.hypot(du, dv) - rs * V.eye };
  };
  const faceRelief = (u: number, v: number, w: number, W: number) => {
    const o = ornament(u, v, W);
    let d = Math.max(o.disc, w - t * o.cushion, -w); // the rolled scroll: a heightfield over the disc (w = 0 on the core face)
    d = Math.min(d, extrude(o.stem, w - t / 2, t / 2));
    d = Math.min(d, extrude(o.reeds, w - (t * V.reed_h) / 2, (t * V.reed_h) / 2));
    d = Math.min(d, extrude(o.eye, w - (t * (1 + V.eye_h)) / 2, (t * (1 + V.eye_h)) / 2)); // the eye stands proud of the coils
    return d;
  };
  const f: SDF = (x, y, z) => {
    let d = sdBox(x, y - hv / 2, z, cx, hv / 2, cz, V.core_r);
    if (d > t + 0.05) return d;
    // ±z faces (width wx), ±x faces (width wz): outward coordinate w measured from the core face
    d = Math.min(d, faceRelief(x, y, Math.abs(z) - cz, wx), faceRelief(z, y, Math.abs(x) - cx, wz));
    return Math.max(d, sdBox(x, y - hv / 2, z, wx / 2, hv / 2, wz / 2)); // clip to the member's box
  };
  return { f, min: [-wx / 2 - 0.03, -0.03, -wz / 2 - 0.03], max: [wx / 2 + 0.03, hv + 0.03, wz / 2 + 0.03] };
}

// ================================================================== doorway colossi (metres, reference box)
export type ColossusModel = 'bull' | 'lamassu';
/** SDF of a doorway colossus in its reference box: x ∈ ±L/2 (head at +x), y ∈ [0, H] (0 = plinth top),
 *  z ∈ ±W/2 (+z = the passage face carrying the relief). `front` = length (m) of the fore-part standing in the round
 *  in front of the jamb block (from the layout: how far the colossus box projects beyond the wall face).
 *  Body coordinates in sculpture.json are relative to the body's median plane z = body.zc. */
export function colossusSDF(model: ColossusModel, front: number): { f: SDF; min: V3; max: V3 } {
  const RB = r('colossus', 'reference_box'), J = r('colossus', 'jamb'), BD = r('colossus', 'body'), LG = r('colossus', 'legs'), CU = r('colossus', 'curls'), BE = r('colossus', 'beard');
  const L2 = RB.L / 2, W2 = RB.W / 2, Ht = RB.H, zc = BD.zc;
  const xf = L2 - front; // jamb block front face
  const zbg = W2 - J.relief_depth; // recessed background of the relief
  const Z = (p: V3, s = 1): V3 => [p[0], p[1], zc + p[2] * s];
  const P: Shape[] = [
    squeezeZ(cone(Z(BD.torso[0]), Z(BD.torso[1]), BD.torso[2], BD.torso[3]), zc, BD.squeeze),
    ell(Z(BD.withers_c), BD.withers_r), ell(Z(BD.rump_c), BD.rump_r), ell(Z(BD.chest_c), BD.chest_r),
    squeezeZ(cone(Z(BD.neck[0]), Z(BD.neck[1]), BD.neck[2], BD.neck[3]), zc, BD.neck_squeeze),
    ...chain(BD.tail.map((p: V3) => Z(p)), BD.tail_r), ell(Z(BD.tuft_c), BD.tuft_r),
  ];
  const leg = (dz: number, dx: number) => (p: V3): V3 => [p[0] + dx, p[1], zc + dz + p[2]];
  for (const m of [leg(LG.fore_dz, 0), leg(-LG.fore_dz, LG.fore_far_dx)]) P.push(...chain(LG.fore.map(m), LG.fore_r), rbox(m(LG.hoof_c), LG.hoof_h, LG.hoof_rad)); // forelegs, in the round
  for (const m of [leg(LG.hind_dz, 0), leg(-LG.hind_dz, LG.hind_far_dx)]) P.push(ell(m(LG.thigh_c), LG.thigh_r), ...chain(LG.hind.map(m), LG.hind_r), rbox(m(LG.hoof_hind_c), LG.hoof_h, LG.hoof_rad)); // hind legs, relief
  const HD = model === 'bull' ? r('colossus', 'bull_head') : null;
  const HM = model === 'lamassu' ? r('colossus', 'human_head') : null, CR = HM ? r('colossus', 'crown') : null, WG = HM ? r('colossus', 'wing') : null;
  // features (horns, ears, eyes, lids, nose, brows, moustache, beard and hair masses) join the head with a small blend: the
  // body blend (BD.blend, 0.12 m) would melt anything smaller than about a hand into the skull (D-029)
  const Fe: Shape[] = [];
  if (HD) {
    P.push(ell(Z(HD.skull_c), HD.skull_r), cone(Z(HD.muzzle[0]), Z(HD.muzzle[1]), HD.muzzle[2], HD.muzzle[3]), ell(Z(HD.nose_c), HD.nose_r));
    for (const s of [-1, 1]) Fe.push(...chain(HD.horn.map((p: V3) => Z(p, s)), HD.horn_r), cone(Z(HD.ear[0], s), Z(HD.ear[1], s), HD.ear[2], HD.ear[3]), ell(Z(HD.eye_c, s), [HD.eye_r, HD.eye_r, HD.eye_r]));
  }
  if (HM) {
    P.push(ell(Z(HM.face_c), HM.face_r));
    Fe.push(cone(Z(HM.nose[0]), Z(HM.nose[1]), HM.nose[2], HM.nose[3]), rbox(Z(HM.beard_c), HM.beard_h, HM.beard_rad), rbox(Z(HM.hair_c), HM.hair_h, HM.hair_rad));
    for (const s of [-1, 1]) Fe.push(ell(Z(HM.eye_c, s), HM.eye_r), cone(Z(HM.lid[0], s), Z(HM.lid[1], s), HM.lid[2], HM.lid[3]), cone(Z(HM.brow[0], s), Z(HM.brow[1], s), HM.brow[2], HM.brow[2]),
      cone(Z(HM.moustache[0], s), Z(HM.moustache[1], s), HM.moustache[2], HM.moustache[3]), cone(Z(HM.ear[0], s), Z(HM.ear[1], s), HM.ear[2], HM.ear[3]),
      ell(Z(HM.earring_c, s), [HM.earring_r, HM.earring_r * 1.3, HM.earring_r]));
  }
  const bodyOnly = unionOf(P, BD.blend), feats = unionOf(Fe, BD.feature_blend);
  const body: SDF = (x, y, z) => smin(bodyOnly(x, y, z), feats(x, y, z), BD.feature_blend);
  // wing (lamassu): relief slab over the upper flank between a lower and an upper edge curve; covert scales in front
  // of x_split, long primaries (bands parallel to the wing's length) behind it
  const wing = (x: number, y: number, z: number) => {
    const t = clamp((WG.x_front - x) / (WG.x_front - WG.x_back), 0, 1);
    const ylo = WG.lower[0] + (WG.lower[1] - WG.lower[0]) * t, yhi = WG.upper[0] + (WG.upper[1] - WG.upper[0]) * Math.pow(t, WG.upper_pow);
    let d2 = Math.max(ylo - y, y - yhi, x - WG.x_front, WG.x_back - x);
    d2 = Math.max(d2, Math.hypot(Math.max(0, x - (WG.x_front - WG.front_r)), Math.max(0, y - (yhi - WG.front_r))) - WG.front_r); // rounded shoulder
    const zs = W2 - WG.inset;
    let d = Math.max(d2, z - zs, zbg - WG.inset - z);
    if (d < 0.1) {
      const behind = smoothstep(WG.x_split + 0.06, WG.x_split - 0.06, x);
      const q = (y - ylo) / Math.max(0.05, yhi - ylo), n = WG.feathers, dq = (Math.abs(q * n - Math.round(q * n)) * (yhi - ylo)) / n;
      const groove = Math.max(dq - WG.groove_w, zs - WG.groove_d - z) + (1 - behind) * 0.2; // only behind x_split
      d = smax(d, -groove, 0.004);
      d -= WG.scale_amp * (1 - behind) * scales(x, y, WG.scale_pitch, WG.scale_row) * smoothstep(zs - 0.08, zs, z);
      d = smax(d, -Math.max(Math.abs(x - WG.x_split) - WG.groove_w, zs - WG.groove_d - z), 0.004); // coverts / primaries divide
    }
    return d;
  };
  const crown = (x: number, y: number, z: number) => {
    const px = x - CR.c, pz = z - zc;
    let d = sdCylY(px, y, pz, CR.r, CR.y[0], CR.y[1]);
    if (d > 0.15) return d;
    for (const yb of CR.horn_y) d = Math.min(d, sdTorus(px, y - yb, pz, CR.r, CR.horn_r)); // horn pairs as bands wrapping the tiara
    const a = Math.atan2(pz, px), rib = Math.abs(((((a / (2 * Math.PI)) * CR.ribs) % 1) + 1) % 1 - 0.5) * 2; // 0 at a rib centre
    if (y > CR.crest_y) d -= CR.rib_amp * smoothstep(0.5, 0, rib) * smoothstep(CR.crest_y, CR.crest_y + 0.04, y); // crest band of upright ribs
    return d;
  };
  const f: SDF = (x, y, z) => {
    // jamb block with the relief field recessed on the passage face (open at the front and at the foot)
    let block = sdBox(x - (-L2 + xf) / 2, y - Ht / 2, z, (xf + L2) / 2, Ht / 2, W2);
    const rx0 = -L2 + J.frame_back, rx1 = xf + 1, ry1 = Ht - J.frame_top;
    const rec = sdBox(x - (rx0 + rx1) / 2, y - (ry1 - 1) / 2, z - (zbg + W2 + 1) / 2, (rx1 - rx0) / 2, (ry1 + 1) / 2, (W2 + 1 - zbg) / 2, J.recess_r);
    block = Math.max(block, -rec);
    let d = body(x, y, z);
    if (HM) d = smin(Math.min(d, crown(x, y, z)), wing(x, y, z), J.fillet);
    if (d < 0.12) {
      // locks in relief: chest/dewlap front (chart z, y), belly fringe on the flank (chart x, y); bull: forelock;
      // lamassu: beard front and side, hair mass behind the head
      const sn = (u: number, v: number) => snail(u, v, CU.pitch, CU.rad, CU.turns, CU.groove_w, CU.groove_d);
      // lamassu: the chest curls stop a clear band below the beard, so beard and chest read as two things (D-029)
      const chestTop = HM ? Math.min(CU.chest_y[1], HM.beard_c[1] - HM.beard_h[1] - BE.chest_gap) : CU.chest_y[1];
      const fields: [number, number][] = [
        [sn(z, y), band(y, CU.chest_y[0], chestTop, 0.06) * smoothstep(CU.chest_x - 0.1, CU.chest_x + 0.1, x)],
        [sn(x, y), band(y, CU.belly_y[0], CU.belly_y[1], 0.05) * band(x, CU.belly_x[0], CU.belly_x[1], 0.1) * smoothstep(zc, zc + 0.3, z)],
      ];
      let amp = CU.amp;
      if (HM) {
        const by0 = HM.beard_c[1] - HM.beard_h[1], by1 = HM.face_c[1] - HM.face_r[1] * CU.beard_top, inBeard = band(y, by0, by1, 0.02);
        const nearFront = smoothstep(HM.beard_c[0] + 0.05, HM.beard_c[0] + 0.15, x) * band(z - zc, -HM.beard_h[2], HM.beard_h[2], 0.04);
        const nearSide = band(x, HM.beard_c[0] - HM.beard_h[0], HM.beard_c[0] + HM.beard_h[0], 0.03) * smoothstep(zc + HM.beard_h[2] * 0.6, zc + HM.beard_h[2], z);
        fields.push([beardLocks(z - zc, by1 - y, BE), inBeard * nearFront], [beardLocks(x, by1 - y, BE), inBeard * nearSide]);
        fields.push([snail(x, y, BE.pitch, BE.rad, BE.turns, BE.groove_w, BE.groove_d), band(y, HM.hair_c[1] - HM.hair_h[1], HM.hair_c[1] + HM.hair_h[1], 0.03) * band(x, HM.hair_c[0] - HM.hair_h[0], HM.hair_c[0] + HM.hair_h[0], 0.03) * smoothstep(zc, zc + HM.hair_h[2], z)]);
        if (inBeard * Math.max(nearFront, nearSide) > 0.5) amp = BE.amp;
      } else if (HD) {
        fields.push([snail(x, z - zc, CU.pitch * HD.forelock_scale, CU.rad * HD.forelock_scale, CU.turns, CU.groove_w, CU.groove_d), band(x, HD.forelock_x[0], HD.forelock_x[1], 0.03) * smoothstep(HD.forelock_y - 0.04, HD.forelock_y + 0.04, y) * band(z - zc, -HD.forelock_w, HD.forelock_w, 0.03)]);
      }
      d -= amp * pick(...fields);
      if (HD) for (const s of [-1, 1]) d = smax(d, -sdSphere(x - HD.nostril_c[0], y - HD.nostril_c[1], z - zc - s * HD.nostril_c[2], HD.nostril_r), 0.01);
      if (HM) d = smax(d, -sdBox(x - HM.mouth_c[0], y - HM.mouth_c[1], z - zc, HM.mouth_h[0], HM.mouth_h[1], HM.mouth_h[2], 0.005), 0.008);
    }
    d = smin(block, d, J.fillet);
    return Math.max(d, sdBox(x, y - Ht / 2, z, L2, Ht / 2, W2)); // never outside the jamb box (= the plinth footprint)
  };
  const m = 0.04;
  return { f, min: [-L2 - m, -m, -W2 - m], max: [L2 + m, Ht + m, W2 + m] };
}
