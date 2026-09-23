// Signed-distance models of the organic / carved pieces (D-014), polygonised offline by tools/build_sculpt.ts:
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

/** staggered lattice of domes in a 2D chart (u, v): returns 0..1 (1 at a dome centre) */
export function domes(u: number, v: number, pitch: number, rad: number) {
  const row = Math.round(v / pitch); let best = Infinity;
  for (let rr = row - 1; rr <= row + 1; rr++) {
    const off = (rr & 1) ? pitch / 2 : 0, col = Math.round((u - off) / pitch), du = u - (col * pitch + off), dv = v - rr * pitch;
    const d2 = du * du + dv * dv; if (d2 < best) best = d2;
  }
  return Math.max(0, 1 - best / (rad * rad));
}
/** smooth box mask (1 inside [a,b], soft edge e) */
const band = (x: number, a: number, b: number, e: number) => smoothstep(a - e, a + e, x) * (1 - smoothstep(b - e, b + e, x));

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
  ];
  for (const s of zs) {
    const m = (p: V3): V3 => [p[0], p[1], p[2] * s];
    parts.push(...chain(H.horn.map(m), H.horn_r), cone(m(H.ear[0]), m(H.ear[1]), H.ear[2], H.ear[3]), ell(m(H.eye_c), [H.eye_r, H.eye_r, H.eye_r]));
    parts.push(...chain(L.fore.map(m), L.fore_r), ell(m(L.hoof_c), L.hoof_r));
  }
  const body = unionOf(parts, B.blend);
  const f: SDF = (x, y, z) => {
    const X = Math.abs(x);
    let d = body(X, y, z);
    if (d < 0.08) {
      // relief bands of locks: dewlap/chest front (chart z, y), forelock tuft between the horns (chart x, z)
      const dew = domes(z, y, C.pitch, C.rad) * band(y, C.dewlap_y[0], C.dewlap_y[1], 0.04) * smoothstep(C.dewlap_x - 0.05, C.dewlap_x + 0.05, X) * band(z, -C.dewlap_w, C.dewlap_w, 0.04);
      const lock = domes(X, z, C.pitch * 0.7, C.rad * 0.8) * band(X, C.forelock_x[0], C.forelock_x[1], 0.02) * smoothstep(C.forelock_y - 0.03, C.forelock_y + 0.03, y) * band(z, -C.forelock_w, C.forelock_w, 0.02);
      d -= C.amp * Math.max(dew, lock);
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
    // spiral channel: the stem rises on the inner side, enters the outer turn and curls over outward and down (top
    // scrolls; the bottom ones are the mirror image)
    const groove = sdSpiral2(du, dv, rs * V.eye, (rs * (1 - V.eye) * V.fill) / V.turns, V.turns, V.groove_w, 1, V.phase);
    return { raised: Math.min(disc, stem), reeds, groove, eye: Math.hypot(du, dv) - rs * V.eye };
  };
  const faceRelief = (u: number, v: number, w: number, W: number) => {
    const o = ornament(u, v, W);
    let d = extrude(o.raised, w - t / 2, t / 2);
    d = Math.min(d, extrude(o.reeds, w - (t * V.reed_h) / 2, (t * V.reed_h) / 2));
    d = smax(d, -extrude(o.groove, w - t, V.groove_d), 0.004); // spiral channel cut from the face
    d = Math.min(d, extrude(o.eye, w - t * 0.55, t * 0.55)); // raised eye
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
  const RB = r('colossus', 'reference_box'), J = r('colossus', 'jamb'), BD = r('colossus', 'body'), LG = r('colossus', 'legs'), CU = r('colossus', 'curls');
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
  if (HD) {
    P.push(ell(Z(HD.skull_c), HD.skull_r), cone(Z(HD.muzzle[0]), Z(HD.muzzle[1]), HD.muzzle[2], HD.muzzle[3]), ell(Z(HD.nose_c), HD.nose_r));
    for (const s of [-1, 1]) P.push(...chain(HD.horn.map((p: V3) => Z(p, s)), HD.horn_r), cone(Z(HD.ear[0], s), Z(HD.ear[1], s), HD.ear[2], HD.ear[3]), ell(Z(HD.eye_c, s), [HD.eye_r, HD.eye_r, HD.eye_r]));
  }
  if (HM) {
    P.push(ell(Z(HM.face_c), HM.face_r), cone(Z(HM.nose[0]), Z(HM.nose[1]), HM.nose[2], HM.nose[3]),
      rbox(Z(HM.beard_c), HM.beard_h, HM.beard_rad), rbox(Z(HM.hair_c), HM.hair_h, HM.hair_rad));
    for (const s of [-1, 1]) P.push(ell(Z(HM.eye_c, s), HM.eye_r), cone(Z(HM.brow[0], s), Z(HM.brow[1], s), HM.brow[2], HM.brow[2]),
      cone(Z(HM.moustache[0], s), Z(HM.moustache[1], s), HM.moustache[2], HM.moustache[3]), cone(Z(HM.ear[0], s), Z(HM.ear[1], s), HM.ear[2], HM.ear[3]),
      ell(Z(HM.earring_c, s), [HM.earring_r, HM.earring_r * 1.3, HM.earring_r]));
  }
  const body = unionOf(P, BD.blend);
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
      d -= WG.scale_amp * (1 - behind) * domes(x, y, WG.scale_pitch, WG.scale_r) * smoothstep(zs - 0.08, zs, z);
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
      const chest = domes(z, y, CU.pitch, CU.rad) * band(y, CU.chest_y[0], CU.chest_y[1], 0.06) * smoothstep(CU.chest_x - 0.1, CU.chest_x + 0.1, x);
      const belly = domes(x, y, CU.pitch, CU.rad) * band(y, CU.belly_y[0], CU.belly_y[1], 0.05) * band(x, CU.belly_x[0], CU.belly_x[1], 0.1) * smoothstep(zc, zc + 0.3, z);
      let hair = 0;
      if (HM) {
        const by0 = HM.beard_c[1] - HM.beard_h[1], by1 = HM.face_c[1] - HM.face_r[1] * CU.beard_top;
        const bf = domes(z, y, CU.beard_pitch, CU.beard_rad) * band(y, by0, by1, 0.03) * smoothstep(HM.beard_c[0] + 0.05, HM.beard_c[0] + 0.15, x) * band(z - zc, -HM.beard_h[2], HM.beard_h[2], 0.04);
        const bs = domes(x, y, CU.beard_pitch, CU.beard_rad) * band(y, by0, by1, 0.03) * band(x, HM.beard_c[0] - HM.beard_h[0], HM.beard_c[0] + HM.beard_h[0], 0.03) * smoothstep(zc + HM.beard_h[2] * 0.6, zc + HM.beard_h[2], z);
        const hr = domes(x, y, CU.beard_pitch, CU.beard_rad) * band(y, HM.hair_c[1] - HM.hair_h[1], HM.hair_c[1] + HM.hair_h[1], 0.03) * band(x, HM.hair_c[0] - HM.hair_h[0], HM.hair_c[0] + HM.hair_h[0], 0.03) * smoothstep(zc, zc + HM.hair_h[2], z);
        hair = Math.max(bf, bs, hr);
      } else if (HD) {
        hair = domes(x, z - zc, CU.pitch * 0.6, CU.rad * 0.7) * band(x, HD.forelock_x[0], HD.forelock_x[1], 0.03) * smoothstep(HD.forelock_y - 0.04, HD.forelock_y + 0.04, y) * band(z - zc, -HD.forelock_w, HD.forelock_w, 0.03);
      }
      d -= CU.amp * Math.max(chest, belly, hair);
      if (HD) for (const s of [-1, 1]) d = smax(d, -sdSphere(x - HD.nostril_c[0], y - HD.nostril_c[1], z - zc - s * HD.nostril_c[2], HD.nostril_r), 0.01);
      if (HM) d = smax(d, -sdBox(x - HM.mouth_c[0], y - HM.mouth_c[1], z - zc, HM.mouth_h[0], HM.mouth_h[1], HM.mouth_h[2], 0.005), 0.008);
    }
    d = smin(block, d, J.fillet);
    return Math.max(d, sdBox(x, y - Ht / 2, z, L2, Ht / 2, W2)); // never outside the jamb box (= the plinth footprint)
  };
  const m = 0.04;
  return { f, min: [-L2 - m, -m, -W2 - m], max: [L2 + m, Ht + m, W2 + m] };
}
