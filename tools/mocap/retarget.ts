// D-333: retarget a CMU take onto the game's 17 pose channels (see amc.ts for the method), on the reference body m03
// (poseKit.ts NOM). Per frame: the trunk, neck, head and arms by rotation (world-direction retarget), the legs by IK so
// the ankles land where the source's ankles are (scaled by the leg-length ratio): the feet then keep the source's contacts
// (a planted foot stays planted on the target body although its thigh-to-shin ratio differs), the knee toward the source
// knee, the foot turned as the source foot. Output channels are in the performer's own frame (the body faces +Z).
import { readASF, readAMC, fk, between, mul, tr, app, I3, type Skeleton, type Frame, type Posed, type M3, type V3 } from './amc';
import { readBVH } from './bvh';
import { NOM, HS, euler, toEuler, trunk, legIK, type M3 as PM3 } from '../../src/people/poseKit';
import type { Pose, PoseBone, E3 } from '../../src/people/anim';

const MOCAP = process.env.MOCAP_DIR ?? 'T:/fars-assets-s12/mocap/cmu';
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scl = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const pad = (n: number | string) => String(n).padStart(2, '0');

export interface Take { id: string; sk: Skeleton; frames: Frame[]; fps: number; k: number; /** vertical offset (m, target): the take's lowest ankle height (a foot flat on the floor) meets the reference ankle height */ dy: number }
const SK = new Map<string, Skeleton>();
/** a take: `07_01`; fps from the database's index (120 unless listed at 60) */
export function loadTake(id: string, fps: number): Take {
  let sk: Skeleton | undefined, frames: Frame[];
  // s18 C14 (D-790): a BVH take: `accad:Female1/Female1_B03_Walk1` (BVH_DIR, default under MOCAP_DIR/../accad) or
  // `style:<path under STYLE_DIR>` (100STYLE); its own frame rate
  const bm = /^(accad|style):(.+)$/.exec(id);
  if (bm) { const dir = bm[1] === 'accad' ? (process.env.ACCAD_DIR ?? `${MOCAP}/../accad`) : (process.env.STYLE_DIR ?? `${MOCAP}/../100style`);
    const B = readBVH(`${dir}/${bm[2]}.bvh`); sk = B.sk; frames = B.frames; fps = B.fps; }
  else { const [s, n] = id.split('_'); const S = pad(s);
    sk = SK.get(S); if (!sk) { sk = readASF(`${MOCAP}/${S}.asf`); SK.set(S, sk); }
    frames = readAMC(`${MOCAP}/${S}_${pad(n)}.amc`); }
  const b = (x: string) => sk!.bones.get(x)!;
  const srcLeg = (b('lfemur').len + b('ltibia').len) * sk.unitM;
  const tgtLeg = Math.hypot(...sub(NOM.calf_l, NOM.thigh_l)) + Math.hypot(...sub(NOM.foot_l, NOM.calf_l));
  const k = tgtLeg / srcLeg; let lo = Infinity;
  for (let i = 0; i < frames.length; i += 4) { const P = fk(sk, frames[i]); lo = Math.min(lo, P.tail.get('ltibia')![1], P.tail.get('rtibia')![1]); }
  return { id, sk, frames, fps, k, dy: NOM.foot_l[1] - k * lo };
}

/** target bind directions (reference body) and the source bones driving each channel */
const TD = (a: string, b: string): V3 => sub(NOM[b], NOM[a]);
const LIMB: Record<string, { src: string; d: V3 }> = {
  l_upper: { src: 'lhumerus', d: TD('upperarm_l', 'lowerarm_l') }, l_fore: { src: 'lwrist', d: TD('lowerarm_l', 'hand_l') }, l_hand: { src: 'lhand', d: TD('hand_l', 'middle_01_l') },
  r_upper: { src: 'rhumerus', d: TD('upperarm_r', 'lowerarm_r') }, r_fore: { src: 'rwrist', d: TD('lowerarm_r', 'hand_r') }, r_hand: { src: 'rhand', d: TD('hand_r', 'middle_01_r') },
  l_thigh: { src: 'lfemur', d: TD('thigh_l', 'calf_l') }, l_shin: { src: 'ltibia', d: TD('calf_l', 'foot_l') }, l_foot: { src: 'lfoot', d: TD('foot_l', 'ball_l') },
  r_thigh: { src: 'rfemur', d: TD('thigh_r', 'calf_r') }, r_shin: { src: 'rtibia', d: TD('calf_r', 'foot_r') }, r_foot: { src: 'rfoot', d: TD('foot_r', 'ball_r') },
};
/** the foot's rest direction in the source is not its flat standing direction: the ASF rest foot points ~13° down, the
 *  target's ankle-to-ball line 28°. The source direction is taken as pitched down by the difference, so a flat source
 *  foot makes a flat target foot (the ASF rest is the subject's calibration stance, standing flat) */
function footSrcDir(sk: Skeleton, name: string): V3 {
  const d = sk.bones.get(name)!.dir; const tgt = LIMB.l_foot.d; const pt = Math.atan2(-tgt[1], Math.hypot(tgt[0], tgt[2])), ps = Math.atan2(-d[1], Math.hypot(d[0], d[2]));
  const h = Math.hypot(d[0], d[2]), a = ps + (pt - ps), L = Math.hypot(d[0], d[1], d[2]);
  return [d[0] / h * Math.cos(a) * L, -Math.sin(a) * L, d[2] / h * Math.cos(a) * L];
}
function Q(sk: Skeleton, ch: string): M3 {
  const L = LIMB[ch]; const ds = ch.endsWith('_foot') ? footSrcDir(sk, L.src) : sk.bones.get(L.src)!.dir; return between(L.d, ds);
}
const QC = new Map<Skeleton, Record<string, M3>>();
function qs(sk: Skeleton) { let q = QC.get(sk); if (!q) { q = {}; for (const c in LIMB) q[c] = Q(sk, c); QC.set(sk, q); } return q; }

export interface Sample { pose: Pose; /** source points in the heading frame, scaled to the reference body (m) */ pts: Record<string, V3> }
/** yaw rotation (about +Y) */
export const rotY = (a: number): M3 => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 1, 0, -s, 0, c]; };
/** the pelvis's heading in a frame (rad, 0 = facing +Z) */
export function headingOf(P: Posed): number { const f = app(P.rootR, [0, 0, 1]); return Math.atan2(f[0], f[2]); }

/** retarget one frame. `yaw`: the performer's frame heading; `org`: its origin (source metres, only x and z used);
 *  options: legs by IK (default) */
export function retargetFrame(T: Take, P: Posed, yaw: number, org: V3, o: { legIK?: boolean } = {}): Sample {
  const sk = T.sk, H = rotY(-yaw), q = qs(sk), k = T.k;
  const W = (R: M3) => mul(H, R);
  const loc = (x: V3): V3 => { const v = scl(app(H, [x[0] - org[0], x[1], x[2] - org[2]]), k); v[1] += T.dy; return v; };
  const Wp = W(P.rootR), Wub = W(P.R.get('upperback')!), Wth = W(P.R.get('thorax')!), Wun = W(P.R.get('upperneck')!), Whd = W(P.R.get('head')!);
  const Wl: Record<string, M3> = {}; for (const c in LIMB) Wl[c] = mul(W(P.R.get(LIMB[c].src)!), q[c]);
  const rot: Partial<Record<PoseBone, E3>> = {};
  const L = (A: M3, B: M3) => toEuler(mul(tr(A), B) as PM3);
  rot.hips = toEuler(Wp as PM3);
  // the spine channel is shared by two vertebrae (each takes half its Euler angles): the half rotation, doubled
  const Sq = mul(tr(Wp), Wub), half = sqrtRot(Sq), e = toEuler(half as PM3); rot.spine = [2 * e[0], 2 * e[1], 2 * e[2]];
  const Wsp2 = mul(Wp, mul(euler(e[0], e[1], e[2]), euler(e[0], e[1], e[2])));
  rot.chest = L(Wsp2, Wth); const Wch = mul(Wsp2, euler(...rot.chest));
  rot.neck = L(Wch, Wun); rot.head = L(mul(Wch, euler(...rot.neck)), Whd);
  for (const s of ['l', 'r'] as const) {
    rot[`${s}_upper`] = L(Wch, Wl[`${s}_upper`]); rot[`${s}_fore`] = L(Wl[`${s}_upper`], Wl[`${s}_fore`]); rot[`${s}_hand`] = L(Wl[`${s}_fore`], Wl[`${s}_hand`]);
    rot[`${s}_thigh`] = L(Wp, Wl[`${s}_thigh`]); rot[`${s}_shin`] = L(Wl[`${s}_thigh`], Wl[`${s}_shin`]); rot[`${s}_foot`] = L(Wl[`${s}_shin`], Wl[`${s}_foot`]);
  }
  const pts: Record<string, V3> = {
    // the pelvis: the source's hip joints' midpoint (the ASF root sits ~10 cm above them; the target's pelvis bone head is at
    // its hip joints' height), moved by the target's own pelvis-to-hips offset
    root: (() => { const l = P.head.get('lfemur')!, r = P.head.get('rfemur')!, m = loc([(l[0] + r[0]) / 2, (l[1] + r[1]) / 2, (l[2] + r[2]) / 2]); const o = app(Wp, [NOM.pelvis[0] - (NOM.thigh_l[0] + NOM.thigh_r[0]) / 2, NOM.pelvis[1] - (NOM.thigh_l[1] + NOM.thigh_r[1]) / 2, NOM.pelvis[2] - (NOM.thigh_l[2] + NOM.thigh_r[2]) / 2]); return add(m, o); })(), l_ankle: loc(P.tail.get('ltibia')!), r_ankle: loc(P.tail.get('rtibia')!), l_knee: loc(P.tail.get('lfemur')!), r_knee: loc(P.tail.get('rfemur')!),
    l_ball: loc(P.tail.get('lfoot')!), r_ball: loc(P.tail.get('rfoot')!), l_toe: loc(P.tail.get('ltoes')!), r_toe: loc(P.tail.get('rtoes')!),
    l_wrist: loc(P.tail.get('lradius')!), r_wrist: loc(P.tail.get('rradius')!), l_hand: loc(P.tail.get('lhand')!), r_hand: loc(P.tail.get('rhand')!), head: loc(P.tail.get('head')!),
  };
  // the pelvis: the source root (the pelvis's centre) scaled; hips offset in authoring units (humanRig / poseKit HS)
  const pose: Pose = { rot, hips: scl(sub(pts.root, NOM.pelvis), 1 / HS) as E3 };
  if (o.legIK !== false) {
    const Tk = trunk(pose);
    for (const s of ['l', 'r'] as const) {
      legIK(pose, Tk, s, pts[`${s}_ankle`], sub(pts[`${s}_knee`], pts.root));
      // the foot as the source foot (world), in the IK'd shin's frame
      const th = pose.rot[`${s}_thigh`]!, sh = pose.rot[`${s}_shin`]!;
      const Wsh = mul(mul(Tk.pelvisR, euler(...th)), euler(...sh));
      pose.rot[`${s}_foot`] = toEuler(mul(tr(Wsh), Wl[`${s}_foot`]) as PM3);
    }
  }
  return { pose, pts };
}
/** the rotation's square root (half the angle about the same axis) */
export function sqrtRot(R: M3): M3 {
  const tr0 = R[0] + R[4] + R[8], ang = Math.acos(Math.max(-1, Math.min(1, (tr0 - 1) / 2)));
  if (ang < 1e-8) return I3();
  const ax: V3 = [R[7] - R[5], R[2] - R[6], R[3] - R[1]]; const s = Math.hypot(...ax);
  if (s < 1e-9) return I3();
  const x = ax[0] / s, y = ax[1] / s, z = ax[2] / s, h = ang / 2, c = Math.cos(h), sn = Math.sin(h), t = 1 - c;
  return [t * x * x + c, t * x * y - sn * z, t * x * z + sn * y, t * x * y + sn * z, t * y * y + c, t * y * z - sn * x, t * x * z - sn * y, t * y * z + sn * x, t * z * z + c];
}
export { fk, sub, add, scl };
