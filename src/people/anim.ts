// Procedural animation for people (Phase 3). Each activity's performance is a pose function of time (and gait phase
// for moving activities): bone rotations (Euler XYZ, radians, relative to the bind pose) plus a hips offset.
// Conventions (bind pose: arms and legs hang down −Y, the body faces +Z): rotation.x < 0 swings a limb forward;
// a knee bends with shin.x > 0; an elbow bends with fore.x < 0; left arm abducts with +z, right arm with −z.
// D-333: walking, standing, talking and sitting on the ground are motion capture (mocap.ts: CMU takes retargeted onto this
// rig); the holds laid over them where a thing is carried or held (the jar on the shoulder, the spear, the basket) and
// the seated and kneeling crafts stay hand-authored (PLACEHOLDER in those channels only: flagged per activity by
// MOCAP_ANIMS below; the dev overlay reads it).
// The cycles drive 17 pose channels; src/people/humanRig.ts retargets them onto the 59-bone MakeHuman skeleton (D-090).
// The work cycles of the activities performed since D-142 (hoeing, reaping, weaving, …) are in workAnims.ts: they are
// authored from hand and foot targets (poseKit.ts IK) and return prop hints (tip, at, show, ip) for the carried props.
import { workPose, WORK_ANIMS, type WorkAnim } from './workAnims';
import { gaitPose, loopAt, pickOf, devAt, blendInto, CLIPS, IDLES, TALKS, type GaitStyle } from './mocap';
const TALK_DAMP = ['l_upper', 'l_fore', 'l_hand', 'r_upper', 'r_fore', 'r_hand'] as const;

/** pose channels (the Phase 3 rig's bones); RETARGET in humanRig.ts maps each onto the 59-bone skeleton */
export const POSE_BONES = ['hips', 'spine', 'chest', 'neck', 'head', 'l_upper', 'l_fore', 'l_hand', 'r_upper', 'r_fore', 'r_hand', 'l_thigh', 'l_shin', 'l_foot', 'r_thigh', 'r_shin', 'r_foot'] as const;
export type PoseBone = typeof POSE_BONES[number];
type BoneName = PoseBone;

export type AnimId = 'idle' | 'walk' | 'carry_shoulder' | 'carry_head' | 'carry_front' | 'guard' | 'guard_walk' | 'chisel' | 'grind' | 'knead'
  | 'bake' | 'draw_water' | 'write' | 'eat' | 'sleep' | 'talk' | 'sit' | 'dice' | 'inspect' | 'play' | 'enthroned' | 'ride'
  /** s18 C14 (D-790): the court's service: pouring from a jug, carrying and setting down a dish, a fly-whisk over the king
   *  (the bow is workAnims' proskynesis) */
  | 'pour' | 'serve' | 'fan' | WorkAnim;
export type E3 = [number, number, number];
export interface Pose { rot: Partial<Record<BoneName, E3>>; hips: E3; /** strike/impact event this frame (for tool sounds) */ hit?: boolean;
  /** D-255: the sound of this frame's strike when it is not the performance's own (the smith's bellows and the hiss of the
   *  quench between his hammer blows); a soundscape strike kind */
  hitKind?: string;
  /** the performer's root moved along a path of the cycle's own (m, m, rad in the performer's frame: the ploughman along
   *  the furrow, the thresher turning with his team, the archer side-on to the target) */
  root?: [number, number, number];
  /** finger grip per hand [left, right] (0 relaxed … 1 closed); overrides the prop's default grip */
  grip?: [number, number];
  /** props 1 and 2 shown this frame (a brick in the hand only while it is carried) */
  show?: [boolean, boolean];
  /** where a prop's working end points (character space): the staff's foot, the broom's end, the adze blade */
  tip?: [E3 | null, E3 | null];
  /** prop 1 placed at a point instead of in the hands (x, y, z, yaw in character space): the brick mould on the ground */
  at?: [number, number, number, number];
  /** a prop parameter: the bow's draw (0…1) */
  ip?: number;
  /** a second prop parameter: the spindle's drop below the hand (m) */
  aux?: number;
  /** an instrument held against the body (props.ts rule 'inst'): its frame in character space (reference body): origin,
   *  main axis (+Z of instrumentForms.ts) and up reference (+Y) */
  inst?: [E3, E3, E3];
  /** a load borne on the right shoulder (carry_shoulder): a jar is seated on the shoulder with its neck in the raised hand
   *  (props.ts), not hung from the palm (D-217) */
  shoulder?: boolean;
}

const S = Math.sin, C = Math.cos, PI = Math.PI;
const fr = (x: number) => x - Math.floor(x);
/** smooth pseudo-random in [-1,1] (for idle fidgets): sum of incommensurate sines */
const wob = (t: number, k: number) => 0.6 * S(t * 0.37 + k * 1.7) + 0.4 * S(t * 0.91 + k * 4.1);

function kneel(p: Pose, lean: number) {
  const r = p.rot; p.hips = [0, -0.45, -0.05];
  r.l_thigh = [-0.1, 0, 0.04]; r.r_thigh = [-0.1, 0, -0.04]; r.l_shin = [PI / 2 + 0.1, 0, 0]; r.r_shin = [PI / 2 + 0.1, 0, 0];
  r.l_foot = [0.9, 0, 0]; r.r_foot = [0.9, 0, 0]; r.spine = [lean * 0.5, 0, 0]; r.chest = [lean * 0.5, 0, 0]; r.neck = [-lean * 0.5, 0, 0];
}
function sitCross(p: Pose) {
  const r = p.rot; p.hips = [0, -0.8, -0.05];
  r.l_thigh = [-1.45, 0, 0.75]; r.r_thigh = [-1.45, 0, -0.75]; r.l_shin = [2.35, 0, 0]; r.r_shin = [2.35, 0, 0]; r.l_foot = [-0.4, 0, 0]; r.r_foot = [-0.4, 0, 0];
}

/** D-199: the enthroned pose's pelvis offset from standing (m: down, back; C, measured against the throne's seat) */
export const ENTHRONED = { drop: -0.3, back: -0.12 } as const;
/** D-210: the riding pose: the pelvis offset from standing (m), the thighs' forward and outward turn and the knees' bend
 *  (rad), and the seat's height above the root at scale 1 (the lowest pelvis or thigh point, m: measured on the rig,
 *  tests/fauna.test.ts); the crowd lifts a rider by the mount's seat height minus seat × the look's scale (C) */
export const RIDE = { drop: 0, back: -0.04, thigh: [-0.55, 0.58] as [number, number], shin: 0.7, shinIn: 0.22, seatK: 0.352 } as const;
/** pose for an animation at time t (s); `ph` = gait phase (radians) for moving anims; `k` = per-person seed */
/** D-333: how a person walks (the crowd passes it; default: a man at 1.2 m/s). v: the walking speed over the leg-length
 *  scale (m/s on the reference body), which picks and blends the paces of the motion-capture gaits */
export interface Gait { v: number; style: GaitStyle;
  /** s17 V3 (D-500): a skirt to the ankle (the women's dress, the Persian robe): the knee folds less in the swing, so the
   *  heel kicked up behind does not come out through the back of the skirt */
  skirt?: boolean;
  /** s18 C14 (D-790): a toddler's walk, 0 none .. 1 a child of one or two (the crowd sets it from the age: ledger u4) */
  toddler?: number }
/** s18 C14: the toddler's walk (C, from the common picture of early walking: a wide base, the arms held up and out for
 *  balance ("high guard"), short quick flat-footed steps, the trunk swaying side to side, now and then a plop down to sit
 *  and up again) */
export const TODDLER = { abduct: 0.2, armsUp: 0.9, armsOut: 0.55, stepK: 0.55, sway: 0.09, lean: 0.12, fallEvery: [35, 80] as [number, number], fallS: 2.4 };
/** s17 V3: knee flexion (rad) above which a skirted walker's swing is compressed, and the share kept above it (C) */
export const SKIRT_KNEE = { from: 0.32, keep: 0.45 };
export const GAIT0: Gait = { v: 1.2, style: 'man' };
/** D-333: the animations whose body is motion capture (whole, or under the authored arms of a held thing); the rest are
 *  hand-authored (PLACEHOLDER; the dev overlay's flag) */
export const MOCAP_ANIMS = new Set<string>(['idle', 'inspect', 'walk', 'carry_shoulder', 'carry_head', 'carry_front', 'guard', 'guard_walk', 'talk', 'sit', 'play']);
/** s18 C14 (D-790): a walk made a toddler's (w 0..1): the legs wider and the steps shorter, the arms up and out, the trunk
 *  rocking over each step, leaning a little forward; every 35-80 s (by the seed) a plop down onto the bottom for ~2.4 s and
 *  up again (the carer's picking up is the crowd's: ledger u4) */
export function toddle(p: Pose, t: number, ph: number, k: number, w: number) {
  const r = p.rot, T = TODDLER, mix3 = (a: [number, number, number] | undefined, b: [number, number, number]): [number, number, number] => { const q = a ?? [0, 0, 0]; return [q[0] + (b[0] - q[0]) * w, q[1] + (b[1] - q[1]) * w, q[2] + (b[2] - q[2]) * w]; };
  for (const [key, sd] of [['l_thigh', 1], ['r_thigh', -1]] as const) { const q = r[key] ?? [0, 0, 0]; r[key] = [q[0] * (1 - (1 - T.stepK) * w), q[1], q[2] + sd * T.abduct * w]; }
  for (const key of ['l_shin', 'r_shin'] as const) { const q = r[key] ?? [0, 0, 0]; r[key] = [q[0] * (1 - 0.4 * w), q[1], q[2]]; }
  r.l_upper = mix3(r.l_upper, [-T.armsUp, 0, T.armsOut]); r.r_upper = mix3(r.r_upper, [-T.armsUp, 0, -T.armsOut]);
  r.l_fore = mix3(r.l_fore, [-0.9, 0, -0.2]); r.r_fore = mix3(r.r_fore, [-0.9, 0, 0.2]);
  const hp = r.hips ?? [0, 0, 0]; r.hips = [hp[0], hp[1], hp[2] + T.sway * w * Math.sin(ph)];
  const sp = r.spine ?? [0, 0, 0]; r.spine = [sp[0] + T.lean * w, sp[1], sp[2] - 0.5 * T.sway * w * Math.sin(ph)];
  // the plop: down onto the bottom, a moment sitting, up again
  const P = T.fallEvery[0] + (T.fallEvery[1] - T.fallEvery[0]) * fr(k * 3.17), u = (t + fr(k * 7.1) * P) % P;
  if (u < T.fallS) { const a = Math.sin(Math.PI * Math.min(1, u / T.fallS)) ** 0.5 * w;
    p.hips = [p.hips[0], p.hips[1] - 0.22 * a, p.hips[2]];
    for (const key of ['l_thigh', 'r_thigh'] as const) { const q = r[key]!; r[key] = [q[0] + (-1.3 - q[0]) * a, q[1], q[2]]; }
    for (const key of ['l_shin', 'r_shin'] as const) { const q = r[key]!; r[key] = [q[0] + (0.4 - q[0]) * a, q[1], q[2]]; } }
}
export function pose(id: AnimId, t: number, ph: number, k: number, g: Gait = GAIT0): Pose {
  if (WORK.has(id)) return workPose(id as WorkAnim, t, ph, k, g);
  let p: Pose = { rot: {}, hips: [0, 0, 0] }; let r = p.rot;
  const breath = 0.025 * S(t * 1.5 + k);
  r.chest = [breath, 0, 0];
  switch (id) {
    case 'idle': case 'inspect': {
      // standing (D-333): a motion-capture idle, one of five per person (weight shifts, the head turning, the hands at rest)
      p = loopAt(IDLES[pickOf(k, IDLES.length, 5)], t, k, 0.9 + 0.2 * fr(k * 0.37)); r = p.rot;
      if (id === 'inspect') { r.l_upper = [0.25, 0, 0.12]; r.r_upper = [0.25, 0, -0.12]; r.l_fore = [-0.9, 0, -0.5]; r.r_fore = [-0.9, 0, 0.5]; } // hands clasped behind
      break;
    }
    case 'walk': case 'carry_shoulder': case 'carry_head': case 'carry_front': case 'guard_walk': {
      // walking (D-333): the motion-capture gaits of the walker's kind and pace (the basket before the body: the carrying
      // captures); the arms that hold a load are set over them below
      p = gaitPose(id === 'carry_front' ? 'carry' : g.style, ph, k, g.v); r = p.rot;
      if (g.skirt) for (const sh of [r.l_shin, r.r_shin]) if (sh && sh[0] > SKIRT_KNEE.from) sh[0] = SKIRT_KNEE.from + (sh[0] - SKIRT_KNEE.from) * SKIRT_KNEE.keep;
      if (g.toddler && id === 'walk') toddle(p, t, ph, k, g.toddler);
      // the right arm raised out to the side and over the load (D-217: searched with tools/dev/jar_search.ts so the shoulder
      // jar's neck lies in the hand and the arm and head stay clear of it; was [-2.7, 0, -0.35] / -1.1: the hand over the
      // crown, the jar through the forearm; C)
      if (id === 'carry_shoulder') { r.r_upper = [-2.4, 0, -0.85]; r.r_fore = [-0.9, 0, 0]; r.head = [0, 0.1, -0.12]; }
      if (id === 'carry_head') { r.l_upper = [-2.9, 0, 0.35]; r.l_fore = [-0.9, 0, 0]; r.neck = [0, 0, 0]; r.spine = [-0.03, 0, 0]; }
      if (id === 'carry_front') { r.l_upper = [-0.5, 0, 0.1]; r.r_upper = [-0.5, 0, -0.1]; r.l_fore = [-1.2, 0, -0.3]; r.r_fore = [-1.2, 0, 0.3]; }
      if (id === 'guard_walk') { r.r_upper = [-0.25, 0, -0.1]; r.r_fore = [-1.25, 0, 0]; }
      if (id !== 'walk') { if (id !== 'carry_head') r.r_hand = [0, 0, 0]; if (id === 'carry_front' || id === 'carry_head') r.l_hand = [0, 0, 0]; } // the held hands as authored
      // the head: the capture's own, turning a little now and then to look about
      const hd = r.head ?? [0, 0, 0]; r.head = [hd[0], hd[1] + 0.15 * wob(t * 0.4, k), hd[2]];
      // the shoulder jar's bearer holds the head turned and tilted away from the jar, the chest upright under it over the captured
      // pelvis (D-187: this line used to overwrite
      // the carry_shoulder head above, and the upright head sat hidden behind the jar from the bearer's right)
      if (id === 'carry_shoulder') { r.head = [0.04 * S(2 * ph), 0.1 + 0.1 * wob(t * 0.4, k), -0.12]; r.neck = [0, 0, 0]; const hp = r.hips ?? [0, 0, 0]; r.spine = [0.03 - hp[0], -0.6 * hp[1], -hp[2]]; r.chest = [breath, 0, 0]; p.shoulder = true; p.grip = [0.1, 0.6]; } // the hand round the jar's neck or the sack's mouth, not a closed fist (D-217)
      if (id === 'carry_head') { r.head = [0, 0, 0]; r.neck = [0, 0, 0]; } // the head held level under the jar
      break;
    }
    case 'guard': {
      // standing at his post (D-333): the quietest standing captures, the spear and shield arms held as authored
      p = loopAt(['idle_a', 'idle_c'][pickOf(k, 2, 6)], t, k, 0.8); r = p.rot;
      // (s18 C14, D-790: not one held pose for every guard (cov-042): each guard his own way of holding the spear and the
      // shield-side arm (three carriages: the spear well forward, nearer the body, the elbow out), the arms easing and
      // re-gripping on their own slow clock; C)
      const gv = pickOf(k, 3, 7), ease = 0.05 * S(t * 0.11 + 7 * k) + 0.03 * S(t * 0.37 + 3 * k);
      const RU = [[-0.25, -0.1], [-0.12, -0.16], [-0.32, -0.04]][gv], RF = [-1.25, -1.1, -1.38][gv], LU = [[-0.15, 0.12], [-0.05, 0.2], [-0.22, 0.08]][gv], LF = [-1.1, -0.85, -1.2][gv];
      r.r_upper = [RU[0] + ease, 0, RU[1]]; r.r_fore = [RF - 0.6 * ease, 0, 0]; r.l_upper = [LU[0] - 0.7 * ease, 0, LU[1]]; r.l_fore = [LF, 0, -0.35 + 0.08 * S(t * 0.07 + k)]; r.r_hand = [0, 0, 0]; r.l_hand = [0, 0, 0];
      break;
    }
    case 'chisel': {
      const q = fr(t * 1.25 + k), s = q < 0.78 ? q / 0.78 : 1 - (q - 0.78) / 0.22; p.hit = q < 0.03;
      p.hips = [0, -0.06, -0.05]; r.l_thigh = [-0.25, 0, 0.1]; r.r_thigh = [-0.25, 0, -0.1]; r.l_shin = [0.3, 0, 0]; r.r_shin = [0.3, 0, 0];
      r.spine = [0.3, 0, 0]; r.chest = [0.25 + breath, 0, 0]; r.neck = [-0.2, 0, 0]; r.head = [0.1, 0, 0];
      r.l_upper = [-0.6, 0, 0.15]; r.l_fore = [-0.7, 0, 0];
      r.r_upper = [-0.7 - 1.1 * s, 0, -0.2]; r.r_fore = [-0.6 - 0.6 * s, 0, 0]; break;
    }
    case 'grind': case 'knead': {
      const sp = id === 'grind' ? 0.9 : 0.6, s = S(t * sp * 2 * PI + k); kneel(p, 0.55 + 0.12 * s);
      r.l_upper = [-1.0 - 0.3 * s, 0, 0.12]; r.r_upper = [-1.0 - 0.3 * s, 0, -0.12]; r.l_fore = [-0.4 + 0.25 * s, 0, 0]; r.r_fore = [-0.4 + 0.25 * s, 0, 0];
      p.hit = id === 'grind' && fr(t * sp + k / (2 * PI)) < 0.03; break;
    }
    case 'bake': {
      const q = fr(t * 0.15 + k), reach = q < 0.3 ? S(q / 0.3 * PI) : 0; kneel(p, 0.35 + 0.3 * reach);
      r.r_upper = [-0.8 - 0.7 * reach, 0, -0.1]; r.r_fore = [-0.6 + 0.4 * reach, 0, 0]; r.l_upper = [-0.4, 0, 0.15]; r.l_fore = [-1.2, 0, 0]; break;
    }
    case 'draw_water': {
      const q = fr(t * 0.1 + k), dip = q < 0.5 ? S(q * 2 * PI) ** 2 : 0;
      p.hips = [0, -0.15 * dip, -0.1 * dip]; r.l_thigh = [-0.5 * dip, 0, 0]; r.r_thigh = [-0.5 * dip, 0, 0]; r.l_shin = [0.8 * dip, 0, 0]; r.r_shin = [0.8 * dip, 0, 0];
      r.spine = [0.6 * dip, 0, 0]; r.chest = [0.4 * dip, 0, 0]; r.l_upper = [-0.8 * dip - 0.2, 0, 0.1]; r.r_upper = [-0.8 * dip - 0.2, 0, -0.1]; r.l_fore = [-0.4, 0, -0.2]; r.r_fore = [-0.4, 0, 0.2]; break;
    }
    case 'write': {
      sitCross(p); r.spine = [0.25, 0, 0]; r.neck = [0.25, 0, 0]; r.head = [0.15, 0, 0];
      r.l_upper = [-0.4, 0, 0.1]; r.l_fore = [-1.3, 0, -0.2];
      const w = 0.05 * S(t * 7 + k) * (fr(t * 0.2 + k) < 0.8 ? 1 : 0); r.r_upper = [-0.45, 0, -0.1]; r.r_fore = [-1.35 + w, 0, 0.25 + w]; break;
    }
    case 'eat': {
      sitCross(p); const q = fr(t * 0.12 + k), bite = q < 0.25 ? S(q / 0.25 * PI) : 0;
      r.r_upper = [-0.4 - 0.5 * bite, 0, -0.15]; r.r_fore = [-0.8 - 1.2 * bite, 0, 0.2]; r.l_upper = [-0.3, 0, 0.1]; r.l_fore = [-1.0, 0, 0]; r.head = [0.1 * bite, 0.3 * wob(t * 0.3, k), 0]; break;
    }
    case 'sit': {
      // sitting on the ground (D-333): the capture of a man sitting at rest, the knees up, the hands on the knees or the ground
      p = loopAt('sit_a', t, k, 0.85 + 0.3 * fr(k * 0.41)); break;
    }
    case 'dice': {
      sitCross(p); r.l_upper = [-0.3, 0, 0.1]; r.r_upper = [-0.3, 0, -0.1]; r.l_fore = [-0.9, 0, 0]; r.r_fore = [-0.9, 0, 0]; r.spine = [0.12, 0, 0];
      r.head = [0.1, 0.35 * wob(t * 0.4, k), 0];
      if (id === 'dice') { const q = fr(t * 0.2 + k), th = q < 0.15 ? S(q / 0.15 * PI) : 0; p.hit = q > 0.14 && q < 0.16; r.spine = [0.35, 0, 0]; r.r_upper = [-0.9 - 0.4 * th, 0, -0.1]; r.r_fore = [-0.6 + 0.4 * th, 0, 0]; r.head = [0.3, 0, 0]; }
      break;
    }
    // D-199 (court setting): the king on the throne at an audience, as the Treasury audience relief carves him: upright,
    // the thighs level, the shins down to the footstool, the staff in the right hand and the lotus in the left; still
    // (breathing only). Not planted and not seated on the ground: the throne (workObjects 'throne') is built to this pose
    // (ENTHRONED: the seat under the buttocks, the footstool under the soles, measured on the rig: tests/court_king.test.ts)
    case 'enthroned': {
      p.hips = [0, ENTHRONED.drop, ENTHRONED.back]; r.hips = [0, 0, 0];
      r.l_thigh = [-1.52, 0, 0.05]; r.r_thigh = [-1.52, 0, -0.05]; r.l_shin = [1.42, 0, 0]; r.r_shin = [1.42, 0, 0]; r.l_foot = [0.1, 0, 0]; r.r_foot = [0.1, 0, 0];
      r.spine = [0.02, 0, 0]; r.r_upper = [-0.45, 0, -0.12]; r.r_fore = [-0.95, 0, 0.1]; r.l_upper = [-0.3, 0, 0.12]; r.l_fore = [-1.35, 0, -0.1];
      r.head = [0.02, 0, 0]; break;
    }
    // D-210: astride a horse or a donkey without stirrups (blocklist; the Apadana horses carry a saddle cloth only): upright,
    // the thighs forward and apart round the barrel, the lower legs hanging, the toes down, both hands forward low at the
    // reins (not drawn); a small rise and fall with the mount's walk. Not planted and not seated on the ground: the crowd
    // lifts the root so the seat (RIDE.seat, measured on the rig: tests/fauna.test.ts) rests on the mount's back
    case 'ride': {
      // (s18 C14, D-790: the seat follows the mount's gait from the rider's own speed (crowd gaitStep): a walk sways, a trot
      // bounces at the trot's beat, a gallop sits forward and rides the swing; C)
      const tr = Math.min(1, Math.max(0, (g.v - 1.6) / 0.5)), gl = Math.min(1, Math.max(0, (g.v - 2.2) / 0.2));
      const b = Math.abs(S(t * (3.3 + 2.2 * tr) + k)), lean = 0.22 * gl;
      p.hips = [0, RIDE.drop + (0.012 + 0.025 * tr * (1 - gl)) * b + 0.03 * gl, RIDE.back]; r.hips = [-0.06 + lean * 0.5, 0, 0];
      r.l_thigh = [RIDE.thigh[0], 0, RIDE.thigh[1]]; r.r_thigh = [RIDE.thigh[0], 0, -RIDE.thigh[1]]; r.l_shin = [RIDE.shin, 0, -RIDE.shinIn]; r.r_shin = [RIDE.shin, 0, RIDE.shinIn];
      r.l_foot = [0.5, 0, 0]; r.r_foot = [0.5, 0, 0]; r.spine = [0.06 + 0.02 * b + lean, 0, 0];
      r.l_upper = [-0.4, 0, 0.12]; r.l_fore = [-1.05, 0, -0.15]; r.r_upper = [-0.4, 0, -0.12]; r.r_fore = [-1.05, 0, 0.15];
      r.head = [0.04, 0.3 * wob(t * 0.25, k), 0]; break;
    }
    case 'sleep': { p.hips = [0, -0.83, 0]; r.hips = [-PI / 2, 0, 0]; r.l_upper = [0, 0, 0.1]; r.r_upper = [0, 0, -0.1]; r.head = [0.2, 0.2, 0]; r.chest = [breath * 0.6, 0, 0]; r.l_shin = [0.2, 0, 0]; r.r_shin = [0.1, 0, 0]; break; }
    case 'talk': {
      // in conversation (D-333): captures of people explaining with their hands, one of three per person
      p = loopAt(TALKS[pickOf(k, TALKS.length, 7)], t, k, 0.9 + 0.2 * fr(k * 0.29));
      // (s17 V3, D-500: the captured speakers lecture, a hand flung to head height every few seconds; at 10 m a lane of talkers
      // read as waving robots: the arms are taken 60 % of the way back to a standing capture's, the gesture kept, smaller; C)
      blendInto(p, loopAt(IDLES[pickOf(k, IDLES.length, 5)], t, k, 0.9 + 0.2 * fr(k * 0.37)), 0.6, TALK_DAMP); break;
    }
    // s18 C14 (D-790): keyed over the standing capture's body (LAYERED), all C
    case 'pour': { // a jug tipped two-handed over a cup held out below, every ~6 s; between pours the jug held before the chest
      p = loopAt(IDLES[pickOf(k, IDLES.length, 5)], t, k, 0.9); r = p.rot; const q = fr(t / (5.5 + fr(k * 1.7)) + k), tip = q < 0.35 ? Math.sin(Math.PI * q / 0.35) : 0;
      r.r_upper = [-0.75 - 0.25 * tip, 0, -0.18]; r.r_fore = [-1.0 + 0.35 * tip, 0, 0.2]; r.r_hand = [0, 0, -0.9 * tip]; r.l_upper = [-0.55, 0, 0.1]; r.l_fore = [-1.2 - 0.1 * tip, 0, -0.4];
      r.spine = [0.08 + 0.12 * tip, 0, 0]; r.head = [0.25 + 0.1 * tip, 0, 0]; p.grip = [0.6, 0.9]; break; }
    case 'serve': { // a dish carried forward in both hands, set down low and taken up again; the next
      p = loopAt(IDLES[pickOf(k, IDLES.length, 5)], t, k, 0.9); r = p.rot; const q = fr(t / (7 + 2 * fr(k * 2.3)) + k), down = q > 0.45 && q < 0.75 ? Math.sin(Math.PI * (q - 0.45) / 0.3) : 0;
      r.l_upper = [-0.6 + 0.25 * down, 0, 0.12]; r.r_upper = [-0.6 + 0.25 * down, 0, -0.12]; r.l_fore = [-1.1 + 0.5 * down, 0, -0.35]; r.r_fore = [-1.1 + 0.5 * down, 0, 0.35];
      r.spine = [0.05 + 0.45 * down, 0, 0]; r.chest = [0.1 * down, 0, 0]; r.head = [0.15 + 0.1 * down, 0, 0]; const h = p.hips; p.hips = [h[0], h[1] - 0.05 * down, h[2]]; p.grip = [0.5, 0.5]; break; }
    case 'fan': { // a fly-whisk swept over the king's head and shoulders from behind the throne, a towel over the other arm (the Treasury audience relief: B; the rhythm C)
      p = loopAt(IDLES[pickOf(k, IDLES.length, 5)], t, k, 0.8); r = p.rot; const w = Math.sin(t * 2.6 + k * 6);
      r.r_upper = [-1.9, 0.25 * w, -0.25 + 0.15 * w]; r.r_fore = [-0.7, 0, 0.15 * w]; r.r_hand = [0.2 * w, 0, 0.4 * w]; r.l_upper = [-0.35, 0, 0.12]; r.l_fore = [-1.35, 0, -0.5];
      r.head = [0.1, 0.1 * w, 0]; p.grip = [0.3, 1]; break; }
    case 'play': { // running about in place (children; D-333: a running capture)
      p = gaitPose('run', t * 7 + k, k, 2.8); break;
    }
  }
  // D-333: the hand-authored cycles here (the mason's chisel, the quern, the dough, the oven, the well, the scribe, the meal,
  // the knucklebones, the throne, the saddle) are performed over the motion-capture body layer, as the work cycles are
  // (workAnims.ts): a capture's deviation from its mean (standing, or seated for the seated ones) added to the upper body
  // (spine, chest, neck, head: the pelvis and legs as authored, so the feet and seat stay where they are)
  const Lw = LAYERED[id]; if (Lw) { const seat = SEATED_L.has(id), c = seat ? 'sit_a' : IDLES[pickOf(k, IDLES.length, 5)], d = devAt(DEV, c, (t * (0.9 + 0.2 * fr(k * 0.37))) / CLIPS[c].dur + fr(k * 0.618034));
    for (const [b, i] of [['spine', 3], ['chest', 6], ['neck', 9], ['head', 12]] as const) { const e = r[b] ?? [0, 0, 0]; r[b] = [e[0] + Math.max(-0.08, Math.min(0.08, d[i])) * Lw, e[1] + Math.max(-0.08, Math.min(0.08, d[i + 1])) * Lw, e[2] + Math.max(-0.08, Math.min(0.08, d[i + 2])) * Lw]; } }
  return p;
}
const DEV = new Float32Array(54);
/** the layer's weight per authored cycle (the king on his throne keeps nearly still: the relief's stillness, C) */
const LAYERED: Partial<Record<AnimId, number>> = { chisel: 0.6, draw_water: 0.6, grind: 0.35, knead: 0.35, bake: 0.35, write: 0.4, eat: 0.5, dice: 0.5, enthroned: 0.2, ride: 0.4, inspect: 0, pour: 0, serve: 0, fan: 0 };
const SEATED_L = new Set<AnimId>(['write', 'eat', 'dice']);
const WORK = new Set<string>(WORK_ANIMS);
export const ANIMS: AnimId[] = ['idle', 'walk', 'carry_shoulder', 'carry_head', 'carry_front', 'guard', 'guard_walk', 'chisel', 'grind', 'knead', 'bake', 'draw_water', 'write', 'eat', 'sleep', 'talk', 'sit', 'dice', 'inspect', 'play', 'enthroned', 'ride', 'pour', 'serve', 'fan', ...WORK_ANIMS];
