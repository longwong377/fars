// Pose authoring kit for the work cycles (D-142): the reference body's skeleton (MakeHuman m03, the body the other
// cycles were checked on), forward kinematics of the trunk exactly as humanRig.ts solves it, and analytic two-bone IK
// for the arms (a wrist to a target, the elbow toward a pole) and the legs (an ankle to a target, the knee toward a
// pole, the foot set flat). A cycle states where the hands and feet go; the kit turns that into the 17 pose channels of
// anim.ts. The channels then drive every body: other bodies are proportionally similar, so hands and feet land within a
// few cm of the same places, and the rig's plant / seat passes (humanRig.ts) keep the feet or the body on the ground.
// Units: character space (m), the body faces +Z, its left is +X, Y up. Hip offsets in a Pose are in authoring units
// (humanRig scales them by pelvis height / POSE_PELVIS_Y), converted here with HS.
import type { Pose, PoseBone, E3 } from './anim';

type V3 = [number, number, number];
/** bone heads of the reference body m03 in the bind pose (m; tests/performances.test.ts checks them against the asset) */
export const NOM: Record<string, V3> = {
  pelvis: [0, 0.898, 0.004], spine_01: [0, 0.984, -0.028], spine_02: [0, 1.053, -0.019], spine_03: [0, 1.111, -0.029],
  neck_01: [0, 1.445, 0.012], head: [0, 1.538, 0.046],
  clavicle_r: [-0.022, 1.372, 0.022], upperarm_r: [-0.183, 1.342, 0.017], lowerarm_r: [-0.209, 1.099, 0.012], hand_r: [-0.224, 0.851, 0.057], middle_01_r: [-0.224, 0.744, 0.084],
  clavicle_l: [0.022, 1.372, 0.022], upperarm_l: [0.183, 1.342, 0.017], lowerarm_l: [0.209, 1.099, 0.012], hand_l: [0.224, 0.851, 0.057], middle_01_l: [0.224, 0.744, 0.084],
  thigh_r: [-0.108, 0.891, -0.007], calf_r: [-0.113, 0.485, 0.016], foot_r: [-0.118, 0.065, -0.007], ball_r: [-0.115, 0, 0.115],
  thigh_l: [0.108, 0.891, -0.007], calf_l: [0.113, 0.485, 0.016], foot_l: [0.118, 0.065, -0.007], ball_l: [0.115, 0, 0.115],
};
/** pelvis height of the reference body over the authoring rig's (humanRig POSE_PELVIS_Y = 0.95): hip offsets × HS = metres */
export const HS = 0.898 / 0.95;
/** ankle height of the reference body above the sole (bind) */
export const ANKLE_Y = NOM.foot_l[1];

// ------------------------------------------------------------------------------------------------ 3×3 row-major
export type M3 = number[];
export const I3 = (): M3 => [1, 0, 0, 0, 1, 0, 0, 0, 1];
/** three.js 'XYZ' Euler: R = Rx·Ry·Rz (the rig's eulerXYZ) */
export function euler(x: number, y: number, z: number): M3 {
  const a = Math.cos(x), b = Math.sin(x), c = Math.cos(y), d = Math.sin(y), e = Math.cos(z), f = Math.sin(z);
  const ae = a * e, af = a * f, be = b * e, bf = b * f;
  return [c * e, -c * f, d, af + be * d, ae - bf * d, -b * c, bf - ae * d, be + af * d, a * c];
}
/** Euler XYZ of a rotation (as three.js Euler.setFromRotationMatrix, order 'XYZ') */
export function toEuler(m: M3): E3 {
  const y = Math.asin(Math.max(-1, Math.min(1, m[2])));
  if (Math.abs(m[2]) < 0.9999999) return [Math.atan2(-m[5], m[8]), y, Math.atan2(-m[1], m[0])];
  return [Math.atan2(m[7], m[4]), y, 0];
}
export const mul = (A: M3, B: M3): M3 => [
  A[0] * B[0] + A[1] * B[3] + A[2] * B[6], A[0] * B[1] + A[1] * B[4] + A[2] * B[7], A[0] * B[2] + A[1] * B[5] + A[2] * B[8],
  A[3] * B[0] + A[4] * B[3] + A[5] * B[6], A[3] * B[1] + A[4] * B[4] + A[5] * B[7], A[3] * B[2] + A[4] * B[5] + A[5] * B[8],
  A[6] * B[0] + A[7] * B[3] + A[8] * B[6], A[6] * B[1] + A[7] * B[4] + A[8] * B[7], A[6] * B[2] + A[7] * B[5] + A[8] * B[8]];
export const tr = (A: M3): M3 => [A[0], A[3], A[6], A[1], A[4], A[7], A[2], A[5], A[8]];
export const app = (A: M3, v: V3): V3 => [A[0] * v[0] + A[1] * v[1] + A[2] * v[2], A[3] * v[0] + A[4] * v[1] + A[5] * v[2], A[6] * v[0] + A[7] * v[1] + A[8] * v[2]];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scl = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const crs = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const nrm = (a: V3): V3 => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
/** a − (a·n) n, normalised (n unit); falls back to `alt` when a is (nearly) parallel to n */
const rej = (a: V3, n: V3, alt: V3): V3 => { const r = sub(a, scl(n, dot(a, n))); return len(r) > 1e-6 ? nrm(r) : nrm(sub(alt, scl(n, dot(alt, n)))); };
/** rotation taking the orthonormal pair (a1, b1) onto (a2, b2) */
function align(a1: V3, b1: V3, a2: V3, b2: V3): M3 {
  const c1 = crs(a1, b1), c2 = crs(a2, b2);
  // M = [a2 b2 c2] · [a1 b1 c1]^T
  const m = (r: number, c: number) => a2[r] * a1[c] + b2[r] * b1[c] + c2[r] * c1[c];
  return [m(0, 0), m(0, 1), m(0, 2), m(1, 0), m(1, 1), m(1, 2), m(2, 0), m(2, 1), m(2, 2)];
}

// per side: channel names and the bind vectors of the chains (computed once; the solvers run per person per frame)
type Side = 'l' | 'r';
const mkSide = (s: Side) => {
  const armU = sub(NOM[`lowerarm_${s}`], NOM[`upperarm_${s}`]), armF = sub(NOM[`hand_${s}`], NOM[`lowerarm_${s}`]);
  const legU = sub(NOM[`calf_${s}`], NOM[`thigh_${s}`]), legF = sub(NOM[`foot_${s}`], NOM[`calf_${s}`]);
  return { upper: `${s}_upper` as PoseBone, fore: `${s}_fore` as PoseBone, hand: `${s}_hand` as PoseBone, thigh: `${s}_thigh` as PoseBone, shin: `${s}_shin` as PoseBone, foot: `${s}_foot` as PoseBone,
    armU, armF, armMax: len(armU) + len(armF), legU, legF, legMax: len(legU) + len(legF),
    shoulderOff: sub(NOM[`upperarm_${s}`], NOM.spine_03), hipOff: sub(NOM[`thigh_${s}`], NOM.pelvis) };
};
const SIDE = { l: mkSide('l'), r: mkSide('r') };
const ZERO: E3 = [0, 0, 0];

// ------------------------------------------------------------------------------------------------ trunk FK
export interface Trunk { pelvisR: M3; pelvisT: V3; chestR: M3; chestT: V3 }
/** pelvis and chest (spine_03) world frames of the reference body for the pose's hips offset and trunk channels */
export function trunk(p: Pose): Trunk {
  const r = p.rot, h = r.hips ?? [0, 0, 0], s = r.spine ?? [0, 0, 0], c = r.chest ?? [0, 0, 0];
  const pelvisR = euler(h[0], h[1], h[2]); const pelvisT: V3 = add(NOM.pelvis, scl(p.hips, HS));
  const s1 = euler(s[0] * 0.5, s[1] * 0.5, s[2] * 0.5);
  const R1 = mul(pelvisR, s1), T1 = add(pelvisT, app(pelvisR, sub(NOM.spine_01, NOM.pelvis)));
  const R2 = mul(R1, s1), T2 = add(T1, app(R1, sub(NOM.spine_02, NOM.spine_01)));
  const R3 = mul(R2, euler(c[0], c[1], c[2])), T3 = add(T2, app(R2, sub(NOM.spine_03, NOM.spine_02)));
  return { pelvisR, pelvisT, chestR: R3, chestT: T3 };
}
/** shoulder (upper-arm head) in character space */
export function shoulder(T: Trunk, side: 'l' | 'r'): V3 { return add(T.chestT, app(T.chestR, SIDE[side].shoulderOff)); }
/** hip joint (thigh head) in character space */
export function hip(T: Trunk, side: 'l' | 'r'): V3 { return add(T.pelvisT, app(T.pelvisR, SIDE[side].hipOff)); }

/** solve a two-bone chain: the bind vectors u (upper), f (lower); the lower bone turns about its local X by ±θ.
 *  Returns θ ≥ 0 such that |u + R(θ) f| = d (clamped to reach). sign −1: Rx(−θ) (elbow), +1: Rx(+θ) (knee) */
function hinge(u: V3, f: V3, d: number, sign: 1 | -1) {
  // |u + Rx(sθ) f|² = |u|² + |f|² + 2 (a + b cos θ + c sin θ)
  const a = u[0] * f[0], b = u[1] * f[1] + u[2] * f[2], c = sign > 0 ? u[2] * f[1] - u[1] * f[2] : u[1] * f[2] - u[2] * f[1];
  const R = Math.hypot(b, c), del = Math.atan2(c, b);
  const want = (d * d - dot(u, u) - dot(f, f)) / 2 - a;
  const k = Math.max(-1, Math.min(1, want / (R || 1)));
  let th = del + Math.acos(k); // the branch that bends
  const alt = del - Math.acos(k);
  if (th < 0 || th > 2.9) th = alt >= 0 && alt <= 2.9 ? alt : Math.max(0, Math.min(2.9, th));
  return th;
}
const rotX = (t: number): M3 => [1, 0, 0, 0, Math.cos(t), -Math.sin(t), 0, Math.sin(t), Math.cos(t)];

/** arm IK: put the wrist (hand bone head) of `side` at `target` (character space) with the elbow toward `pole` (a
 *  direction); writes the upper-arm and forearm channels (the forearm keeps its twist `twist` about its own axis, which
 *  turns the hand without moving the wrist). Returns the reach error (m; 0 when reachable) */
export function armIK(p: Pose, T: Trunk, side: 'l' | 'r', target: V3, pole: V3, twist = 0): number {
  return armSolve(p, T, side, target, pole, twist, shoulder(T, side)).err;
}
/** armIK with the shoulder given; also returns the upper arm's world frame and the elbow angle (for gripIK's palm) */
function armSolve(p: Pose, T: Trunk, side: Side, target: V3, pole: V3, twist: number, S: V3) {
  // the forearm channel is Rx(−φ)·Ry(twist): the twist is applied to the forearm's bind vector first (exact)
  const K = SIDE[side], u = K.armU, f = twist ? app(euler(0, twist, 0), K.armF) : K.armF;
  const v = sub(target, S), lv = len(v), dmax = K.armMax - 1e-3, d = Math.max(0.05, Math.min(dmax, lv));
  const phi = hinge(u, f, d, -1);
  const w = add(u, app(rotX(-phi), f)); // wrist in the upper arm's local frame
  const a1 = nrm(w), b1 = rej(u, a1, [0, 0, -1]);
  const a2 = nrm(v), b2 = rej(pole, a2, [0, -1, 0]);
  const Wu = align(a1, b1, a2, b2);
  const Lu = mul(tr(T.chestR), Wu); // the clavicle is not driven: the upper arm's parent frame is the chest's
  p.rot[K.upper] = toEuler(Lu); p.rot[K.fore] = [-phi, twist, 0];
  return { Wu, phi, err: Math.max(0, lv - dmax) };
}
/** leg IK: the ankle of `side` at `target` (character space; the sole is ANKLE_Y below it when flat), the knee toward
 *  `pole`; the foot is set to the world yaw `footYaw` and pitch `footPitch` (0 = flat). Writes thigh, shin, foot */
export function legIK(p: Pose, T: Trunk, side: 'l' | 'r', target: V3, pole: V3 = [0, 0, 1], footYaw = 0, footPitch = 0): number {
  const K = SIDE[side], H = hip(T, side), u = K.legU, f = K.legF;
  const v = sub(target, H), dmax = K.legMax - 1e-4, d = Math.max(0.1, Math.min(dmax, len(v)));
  const kap = hinge(u, f, d, 1);
  const w = add(u, app(rotX(kap), f));
  const a1 = nrm(w), b1 = rej(u, a1, [0, 0, 1]);
  const a2 = nrm(v), b2 = rej(pole, a2, [0, 0, 1]);
  const Wt = align(a1, b1, a2, b2);
  const Lt = mul(tr(T.pelvisR), Wt);
  const Wc = mul(Wt, rotX(kap));
  const F = mul(euler(0, footYaw, 0), euler(footPitch, 0, 0));
  const Lf = mul(tr(Wc), F);
  p.rot[K.thigh] = toEuler(Lt); p.rot[K.shin] = [kap, 0, 0]; p.rot[K.foot] = toEuler(Lf);
  const e = Math.max(0, len(v) - dmax); if (e > IK_STATS.leg) IK_STATS.leg = e;
  return e;
}
/** both feet planted at the stance: ankles at (±halfWidth + dx, ANKLE_Y, z) with toes turned out by `out` (rad) */
export function stance(p: Pose, T: Trunk, o: { w?: number; zl?: number; zr?: number; out?: number; xl?: number; xr?: number } = {}) {
  const w = o.w ?? 0.118, out = o.out ?? 0.08;
  legIK(p, T, 'l', [w + (o.xl ?? 0), ANKLE_Y, o.zl ?? -0.007], [0.15, 0, 1], out);
  legIK(p, T, 'r', [-w + (o.xr ?? 0), ANKLE_Y, o.zr ?? -0.007], [-0.15, 0, 1], -out);
}
/** forward kinematics of an arm after IK (tests, tools): wrist position */
export function wristOf(p: Pose, T: Trunk, side: 'l' | 'r'): V3 {
  const K = SIDE[side], S = shoulder(T, side), Lu = p.rot[K.upper] ?? ZERO, Lf = p.rot[K.fore] ?? ZERO;
  const Wu = mul(T.chestR, euler(Lu[0], Lu[1], Lu[2])), Wf = mul(Wu, euler(Lf[0], Lf[1], Lf[2]));
  return add(add(S, app(Wu, K.armU)), app(Wf, K.armF));
}
/** the palm's grip centre relative to the wrist in the hand's bind frame (reference body; as props.ts gripPoint): across
 *  the palm at the knuckles, 2.2 cm out of the palm */
export const PALM: Record<'l' | 'r', V3> = { r: [0.022, -0.091, 0.023], l: [-0.022, -0.091, 0.023] };
/** forward kinematics of a hand after IK: the grip centre in character space */
export function palmOf(p: Pose, T: Trunk, side: 'l' | 'r'): V3 {
  const K = SIDE[side], Lu = p.rot[K.upper] ?? ZERO, Lf = p.rot[K.fore] ?? ZERO, Lh = p.rot[K.hand] ?? ZERO;
  const Wh = mul(mul(mul(T.chestR, euler(Lu[0], Lu[1], Lu[2])), euler(Lf[0], Lf[1], Lf[2])), euler(Lh[0], Lh[1], Lh[2]));
  return add(wristOf(p, T, side), app(Wh, PALM[side]));
}
/** arm IK to a grip: the palm (not the wrist) at `g`. The palm's offset turns with the hand, so the wrist target is
 *  corrected by the palm's error and solved again (three passes bring it within a millimetre when reachable) */
/** grip IK passes (the crowd lowers them for distant people, where a centimetre cannot be seen: D-142) */
export const IK_Q = { passes: 4 };
export function gripIK(p: Pose, T: Trunk, side: 'l' | 'r', g: V3, pole: V3, twist = 0, passes = IK_Q.passes): number {
  // the palm after each solve, from the solver's own frames (as palmOf, without the Euler round trip): the palm's offset
  // from the elbow in the forearm's frame is fixed while the hand channel is (q), so palm = S + Wu·(u + Rx(−φ)·q)
  const K = SIDE[side], S = shoulder(T, side), Lh = p.rot[K.hand] ?? ZERO;
  let q = add(K.armF, app(euler(Lh[0], Lh[1], Lh[2]), PALM[side])); if (twist) q = app(euler(0, twist, 0), q);
  let target: V3 = [g[0], g[1], g[2]], err = 0;
  for (let i = 0; i < passes; i++) { const r = armSolve(p, T, side, target, pole, twist, S); const palm = add(S, app(r.Wu, add(K.armU, app(rotX(-r.phi), q))));
    const e = sub(g, palm); err = len(e); if (err < 5e-4) break; target = add(target, e); }
  if (err > IK_STATS.grip) { IK_STATS.grip = err; IK_STATS.worst = { side, target: g, got: palmOf(p, T, side), shoulder: shoulder(T, side) }; }
  return err;
}
/** forward kinematics of a leg: knee position (after legIK) */
export function kneeOf(p: Pose, T: Trunk, side: 'l' | 'r'): V3 {
  const K = SIDE[side], Lt = p.rot[K.thigh] ?? ZERO, Wt = mul(T.pelvisR, euler(Lt[0], Lt[1], Lt[2]));
  return add(hip(T, side), app(Wt, K.legU));
}
/** forward kinematics of a leg: ankle position */
export function ankleOf(p: Pose, T: Trunk, side: 'l' | 'r'): V3 {
  const K = SIDE[side], H = hip(T, side), Lt = p.rot[K.thigh] ?? ZERO, Ls = p.rot[K.shin] ?? ZERO;
  const Wt = mul(T.pelvisR, euler(Lt[0], Lt[1], Lt[2])), Ws = mul(Wt, euler(Ls[0], Ls[1], Ls[2]));
  return add(add(H, app(Wt, K.legU)), app(Ws, K.legF));
}
export const v3 = { sub, add, scl, dot, crs, len, nrm };
/** the largest grip and leg reach errors since the last reset (m): tests check that every cycle's targets are reached */
export const IK_STATS = { grip: 0, leg: 0, worst: null as null | { side: string; target: V3; got: V3; shoulder: V3 }, reset() { this.grip = 0; this.leg = 0; this.worst = null; } };
