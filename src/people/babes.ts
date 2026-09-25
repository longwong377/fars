// Babies in arms and small children carried (D-215; gap audit item 4; D-207): the simulation already keeps every infant
// with the one minding it (population.ts `small()`: "carried on the mother's back", "at her front" for a twin, "in her
// lap", "nursed by the mother", "lying on a mat beside her while she works", a toddler "carried by" whoever minds it) and
// the view hides the child's own body (popview.ts `young`, D-143). This module turns the plan's own words into how the
// child is drawn on the carer: on the hip, in a back or front sling, cradled in the arms (nursing, or walking with a
// newborn), sitting in the lap, or put down beside her on a mat, or asleep in a basket cradle at home. Nothing here
// changes a plan; it reads them. Every form and pose is C (reconstruction by analogy: the Assyrian Lachish reliefs show
// deported women carrying children on the shoulder and hip, Egyptian tomb paintings show slings: RECOLLECTION, NOT SEEN;
// the plan's words are the simulation's own, C). The child's size follows its age (CHILD_H, a modern growth-chart median:
// C, Q-066); its skin is the carer's tone.
import type { Pose, AnimId } from './anim';
import { trunk, gripIK, type Trunk } from './poseKit';
import type { ActivityId } from './activities';
import { ACTIVITIES } from './activities';
import { HB } from './humanFormat';
import type { RigView } from './props';

export type BabeMode = 'hip' | 'back' | 'front' | 'arms' | 'nurse' | 'lap' | 'mat' | 'cradle';
export const BABE_MODES: BabeMode[] = ['hip', 'back', 'front', 'arms', 'nurse', 'lap', 'mat', 'cradle'];
/** what each way of holding is and its evidence (the dev overlay prints it; all C) */
export const BABE_NOTES: Record<BabeMode, string> = {
  hip: 'a baby or small child sitting astride the carer’s left hip, her forearm under it (the hip carry: Lachish reliefs, recollection, NOT SEEN; C)',
  back: 'carried on the back in a cloth sling knotted over the shoulders (the plan: “carried on her back”; slings in Egyptian tomb paintings, recollection, NOT SEEN; C)',
  front: 'a twin at the front in a cloth sling (the plan: “at her front”; C)',
  arms: 'cradled across the front in both arms (a newborn carried, or nursed standing; C)',
  nurse: 'nursed, cradled at the breast while she sits (the plan: “nursed by the mother”; C)',
  lap: 'sitting in the carer’s lap, held round the middle (the plan: “in her lap”; C)',
  mat: 'lying on a reed mat on the ground beside her while she works (the plan: “lying on a mat beside her”; C)',
  cradle: 'asleep in a shallow basket cradle on the ground beside her at home (gap audit item 4: a cradle or basket at home; the form C)',
};
/** anims whose arms are free to hold a child (the others keep their work: the child goes on the back) */
const FREE_ARMS = new Set<AnimId>(['walk', 'idle', 'talk', 'sit', 'inspect', 'dice']);
/** anims sitting on the ground (the child in the lap or nursed) */
const SITTING = new Set<AnimId>(['sit', 'eat', 'dice', 'write']);
/** how an infant (or a carried toddler) is held now: from its own plan's words (`why`, `act`) and what its carer does.
 *  `atHome`: the child's place is its home (a basket cradle there when it sleeps beside her) */
export function babeMode(why: string, act: ActivityId, carerAct: ActivityId, carerMoving: boolean, atHome: boolean): BabeMode {
  const a = ACTIVITIES[carerAct]?.anim ?? 'idle', moving = carerMoving || !!ACTIVITIES[carerAct]?.moving, free = FREE_ARMS.has(a) || (moving && a === 'walk');
  const asleep = act === 'sleep' || /^asleep|sleep near/.test(why);
  if (/front/.test(why)) return 'front';
  if (/back\b/.test(why)) return 'back';
  if (a === 'sleep') return atHome && asleep ? 'cradle' : 'mat'; // the carer lying down (ill, or asleep out of doors): the child beside her
  if (/mat beside|asleep beside|lying beside|sleep near/.test(why)) return moving ? (free ? 'hip' : 'back') : atHome && asleep ? 'cradle' : 'mat';
  if (/^nursed|softened bread|nursed with/.test(why) || act === 'eat') return moving ? (free ? 'arms' : 'back') : SITTING.has(a) ? 'nurse' : free ? 'arms' : 'back';
  if (/lap|knee/.test(why)) return SITTING.has(a) ? 'lap' : free ? 'hip' : 'back';
  if (moving) return free ? 'hip' : 'back';
  if (SITTING.has(a)) return 'lap';
  return free ? 'hip' : 'back';
}
/** the child's length (m) by age in months (C: growth-chart medians, 0.5 m at birth, 0.75 m at one, then CHILD_H) */
export const babeLength = (months: number) => months < 12 ? 0.5 + 0.25 * Math.max(0, months) / 12 : Math.min(0.96, 0.75 + (months - 12) * (0.87 - 0.76) / 12);
/** swaddled (a wrapped bundle) under this age in months (C: swaddling by analogy, Greek and Egyptian practice; Q-431) */
export const SWADDLED_MONTHS = 3;
/** the prop kind drawn for a child held in a mode (props.ts class 3), and the reference length its geometry is made at */
export function babeKind(mode: BabeMode, months: number): { kind: string; ref: number } {
  if (mode === 'mat') return { kind: 'babe_mat', ref: 0.55 };
  if (mode === 'cradle') return { kind: 'babe_cradle', ref: 0.55 };
  const wrapped = months < SWADDLED_MONTHS;
  if (mode === 'back' || mode === 'front') return wrapped ? { kind: 'babe_wrapped_sling', ref: 0.55 } : { kind: 'babe_sling', ref: 0.7 };
  return wrapped ? { kind: 'babe_wrapped', ref: 0.55 } : { kind: 'babe', ref: 0.7 };
}
type V3 = [number, number, number];
/** where the child sits in the carer's pelvis ('p') or chest ('c', spine_03) frame (reference body m03, m): its seat (the
 *  bottom), its up axis (toward the head) and its front (belly, face), the hand targets (palm centres) and the elbow
 *  poles. Measured on the rig (tests/people_children.test.ts). `null` hands: that arm keeps its pose. C */
export const HOLD: Record<Exclude<BabeMode, 'mat' | 'cradle'>, { frame: 'p' | 'c'; seat: V3; up: V3; front: V3; l: V3 | null; r: V3 | null; lp: V3; rp: V3 }> = {
  hip: { frame: 'p', seat: [0.19, 0.06, 0.03], up: [0.15, 1, 0], front: [-0.85, 0, 0.5], l: [0.2, 0.05, 0.14], r: null, lp: [0.8, -0.2, -0.6], rp: [-0.7, -1, -0.25] },
  back: { frame: 'c', seat: [0, -0.2, -0.17], up: [0, 1, -0.15], front: [0, 0, 1], l: null, r: null, lp: [0.7, -1, -0.25], rp: [-0.7, -1, -0.25] },
  front: { frame: 'c', seat: [0, -0.24, 0.15], up: [0, 1, 0.1], front: [0, 0, -1], l: null, r: null, lp: [0.7, -1, -0.25], rp: [-0.7, -1, -0.25] },
  arms: { frame: 'c', seat: [-0.13, -0.2, 0.2], up: [1, 0.35, 0], front: [0, 0, -1], l: [0.07, -0.16, 0.22], r: [-0.1, -0.25, 0.21], lp: [1, -0.8, -0.2], rp: [-1, -0.8, -0.2] },
  nurse: { frame: 'c', seat: [-0.13, -0.2, 0.2], up: [1, 0.35, 0], front: [0, 0, -1], l: [0.07, -0.16, 0.22], r: [-0.1, -0.25, 0.21], lp: [1, -0.8, -0.2], rp: [-1, -0.8, -0.2] },
  lap: { frame: 'p', seat: [0, 0.03, 0.2], up: [0, 1, 0], front: [0, 0, 1], l: [0.08, 0.14, 0.26], r: [-0.08, 0.14, 0.26], lp: [1, -0.5, -0.4], rp: [-1, -0.5, -0.4] },
};
/** where a child put down lies beside the carer (character space, m; yaw rad): to her left and a little ahead (C) */
export const DOWN_AT: [number, number, number, number] = [0.62, 0, 0.3, 0.35];
const M3v = (m: number[], v: V3): V3 => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
const addV = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
/** a point in the pose's pelvis or chest frame (reference body, character space) */
const inFrame = (T: Trunk, f: 'p' | 'c', v: V3): V3 => f === 'p' ? addV(T.pelvisT, M3v(T.pelvisR, v)) : addV(T.chestT, M3v(T.chestR, v));
/** the arms of a pose set to hold the child (grip IK to the hand targets; an arm the cycle needs keeps its pose: the
 *  eating hand, a walk's swing when the child is on the hip). Returns the largest reach error (m) */
export function holdBabe(po: Pose, mode: BabeMode, anim: AnimId): number {
  if (mode === 'mat' || mode === 'cradle' || mode === 'back' || mode === 'front') return 0;
  const H = HOLD[mode], T = trunk(po); let err = 0;
  if (H.l) err = Math.max(err, gripIK(po, T, 'l', inFrame(T, H.frame, H.l), H.lp, 0.3));
  if (H.r && anim !== 'eat') err = Math.max(err, gripIK(po, T, 'r', inFrame(T, H.frame, H.r), H.rp, -0.3));
  po.grip = [0.35, H.r && anim !== 'eat' ? 0.35 : po.grip?.[1] ?? 0];
  return err;
}
/** the arm held out to a small child walking beside (carer: the hand low at the side) or raised to hold the carer's
 *  hand (the child: `raise`, the arm's angle out from hanging, rad: popview handReach), on side `s` (C) */
export function holdHand(po: Pose, role: 1 | 2, side: 'l' | 'r', raise: number) {
  const sg = side === 'l' ? 1 : -1;
  if (role === 1) { po.rot[`${side}_upper`] = [0.05, 0, 0.22 * sg]; po.rot[`${side}_fore`] = [-0.25, 0, 0]; po.rot[`${side}_hand`] = [0, 0, 0]; }
  else { po.rot[`${side}_upper`] = [-0.12, 0, raise * sg]; po.rot[`${side}_fore`] = [-0.1, 0, 0]; }
  po.grip = side === 'l' ? [0.6, po.grip?.[1] ?? 0] : [po.grip?.[0] ?? 0, 0.6];
}
const _r = new Float64Array(9);
/** the child's transform in the carer's character space (solved rig, body scale `s`, the child's length `L` against its
 *  geometry's reference length `ref`): written to `out` (a THREE.Matrix4-like with makeBasis/setPosition/scale) */
export function placeBabe(mode: BabeMode, R: RigView, s: number, L: number, ref: number, out: { makeBasis(x: any, y: any, z: any): any; setPosition(x: number, y: number, z: number): any; scale(v: any): any }, V: new (x: number, y: number, z: number) => any) {
  const k = L / ref;
  if (mode === 'mat' || mode === 'cradle') { const [x, y, z, yaw] = DOWN_AT, c = Math.cos(yaw), sn = Math.sin(yaw); out.makeBasis(new V(c, 0, -sn), new V(0, 1, 0), new V(sn, 0, c)); out.setPosition(x * s, y, z * s); out.scale(new V(k, k, k)); return; }
  const H = HOLD[mode], b = H.frame === 'p' ? HB.pelvis : HB.spine_03, o = b * 9, w = R.wr;
  for (let i = 0; i < 9; i++) _r[i] = w[o + i];
  const at = (v: V3): V3 => [_r[0] * v[0] + _r[1] * v[1] + _r[2] * v[2], _r[3] * v[0] + _r[4] * v[1] + _r[5] * v[2], _r[6] * v[0] + _r[7] * v[1] + _r[8] * v[2]];
  const org = [R.wt[b * 3], R.wt[b * 3 + 1], R.wt[b * 3 + 2]] as V3, p = addV(org, at(H.seat));
  const nrm = (v: V3): V3 => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  const Y = nrm(at(H.up)); let Z = at(H.front); const d = Z[0] * Y[0] + Z[1] * Y[1] + Z[2] * Y[2]; Z = nrm([Z[0] - Y[0] * d, Z[1] - Y[1] * d, Z[2] - Y[2] * d]);
  const X: V3 = [Y[1] * Z[2] - Y[2] * Z[1], Y[2] * Z[0] - Y[0] * Z[2], Y[0] * Z[1] - Y[1] * Z[0]];
  out.makeBasis(new V(...X), new V(...Y), new V(...Z)); out.setPosition(p[0] * s, p[1] * s, p[2] * s); out.scale(new V(k, k, k));
}
/** the reference skin colour (linear) the child's geometry is painted with; the instance tints it by the carer's tone */
export const BABE_SKIN: V3 = [0.36, 0.2, 0.13];
export const tintFor = (skin: ArrayLike<number>) => { const l = (c: ArrayLike<number>) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; return Math.max(0.35, Math.min(1.6, l(skin) / l(BABE_SKIN))); };
