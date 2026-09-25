// Work cycles for the activities that had no performance (D-142): field and garden work, harvest, threshing,
// ploughing, herding and animal care, crafts, textiles, brick work, hauling, cleaning, cooking, washing, the magi
// holding the issued commodities, bearers of the dead, archery practice. Each cycle is a pure function of time (s) and a
// per-person seed k: the trunk is posed by angles, the hands and feet by targets (poseKit.ts IK on the reference body),
// so a hoe blade reaches the soil, a reaper's hand the stalks, a weaver's beater the fell of the cloth, and standing
// feet stay where they are. Tool contact points are stated in character space (the body faces +Z) and returned as prop
// hints (Pose.tip / at / show / ip) for the crowd's carried-prop placement (crowd.ts, props.ts GRIPS).
// Tempo and forms are reconstructions (C): no ancient source describes these motions; tools and their sizes are
// in props.ts with their tiers. PLACEHOLDER quality in the sense of anim.ts: hand-authored cycles, not motion capture.
import type { Pose, E3 } from './anim';
import { trunk, gripIK, legIK, stance, kneeOf, hip, headOf, ANKLE_Y, NOM, HS, v3, app, type Trunk } from './poseKit';
import { HARP_V, LYRE, DOUBLE_PIPE, MOUTH, harpVString, harpHString, lyreString } from './instrumentForms';

type V3 = [number, number, number];
export const WORK_ANIMS = ['hoe', 'irrigate', 'reap', 'bind', 'winnow', 'drive', 'plough', 'herd', 'groom', 'fodder', 'shear', 'butcher',
  'hold', 'hold_sack', 'hold_lead', 'sweep', 'weave', 'spin', 'gather', 'pat', 'stir', 'mould', 'lay', 'haul', 'pass', 'polish', 'adze',
  'pick', 'tread', 'stoke', 'mend', 'bier_l', 'bier_r', 'wash', 'archery', 'cook',
  // playing and singing (D-200)
  'harp_v', 'harp_h', 'lyre', 'frame_drum', 'double_pipe', 'reed_pipe', 'sing',
  // children's play (D-215: gap audit item 26) and the lame and the blind on the move (item 37)
  'ball', 'chase', 'pull_toy', 'rattle', 'limp', 'feel',
  // the magi and the dead (D-209): the barsom held before the fire, the kept fire fed, standing in mourning
  'barsom', 'feed_fire', 'mourn'] as const;
export type WorkAnim = typeof WORK_ANIMS[number];
/** how each cycle meets the ground (humanRig: planted feet, or the body resting on the ground) and whether it moves the
 *  performer's root along a path of its own (the ploughman along the furrow, the thresher turning with his team) */
export const WORK_META: Record<WorkAnim, { ground: 'feet' | 'seat'; path?: boolean; aside?: boolean; /** D-215: a walking or running cycle (its feet step, they are not planted) */ gait?: boolean }> = {
  hoe: { ground: 'feet' }, irrigate: { ground: 'feet' }, reap: { ground: 'feet' }, bind: { ground: 'feet' }, winnow: { ground: 'feet' },
  drive: { ground: 'feet', path: true }, plough: { ground: 'feet', path: true }, herd: { ground: 'feet' }, groom: { ground: 'feet' }, fodder: { ground: 'feet' },
  shear: { ground: 'seat', aside: true }, butcher: { ground: 'seat', aside: true }, hold: { ground: 'feet' }, hold_sack: { ground: 'feet' }, hold_lead: { ground: 'feet' },
  sweep: { ground: 'feet' }, weave: { ground: 'seat', aside: true }, spin: { ground: 'feet' }, gather: { ground: 'feet' }, pat: { ground: 'feet', aside: true },
  stir: { ground: 'feet' }, mould: { ground: 'feet', aside: true }, lay: { ground: 'feet' }, haul: { ground: 'feet' }, pass: { ground: 'feet' },
  polish: { ground: 'seat', aside: true }, adze: { ground: 'feet' }, pick: { ground: 'feet' }, tread: { ground: 'feet' }, stoke: { ground: 'feet', aside: true },
  mend: { ground: 'seat', aside: true }, bier_l: { ground: 'feet' }, bier_r: { ground: 'feet' },
  wash: { ground: 'seat', aside: true }, archery: { ground: 'feet', path: true }, cook: { ground: 'feet', aside: true },
  harp_v: { ground: 'feet' }, harp_h: { ground: 'feet' }, lyre: { ground: 'feet' }, frame_drum: { ground: 'feet' }, double_pipe: { ground: 'feet' },
  reed_pipe: { ground: 'seat', aside: true }, sing: { ground: 'feet' },
  ball: { ground: 'feet' }, chase: { ground: 'feet', path: true, gait: true }, pull_toy: { ground: 'feet', path: true, gait: true }, rattle: { ground: 'seat' }, limp: { ground: 'feet', gait: true }, feel: { ground: 'feet', gait: true },
  barsom: { ground: 'feet' }, feed_fire: { ground: 'feet' }, mourn: { ground: 'feet' },
};
/** D-215: the children's paths (C): running round after one another on a circle of 2.2 m at 2 m/s; walking round pulling
 *  a toy on a circle of 1.5 m at 0.5 m/s. Both start at the view's spot and come back to it */
export const PLAY_PATH = { chase: { r: 2.2, v: 2.0, cad: 1.45 }, pull_toy: { r: 1.5, v: 0.5, cad: 0.8 } } as const;
/** the play path's offset at time t (performer's frame: x left, z ahead; yaw) */
export function playPath(id: 'chase' | 'pull_toy', t: number, k: number): [number, number, number] {
  const P = PLAY_PATH[id], th = (P.v / P.r) * t + 2 * PI * fr(k * 0.37);
  return [P.r * Math.sin(th), P.r * (1 - Math.cos(th)), PI / 2 - th];
}

const S = Math.sin, C = Math.cos, PI = Math.PI;
const fr = (x: number) => x - Math.floor(x);
const cl = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const sm = (x: number) => { const t = cl(x); return t * t * (3 - 2 * t); };
/** 0 → 1 over [a, b] (smooth) */
const ramp = (x: number, a: number, b: number) => sm((x - a) / (b - a));
/** 1 inside [a, b] with smooth edges of width e */
const win = (x: number, a: number, b: number, e = 0.03) => ramp(x, a - e, a + e) * (1 - ramp(x, b - e, b + e));
/** smooth cyclic keyframes: K = [q, values][] with q ascending in [0, 1); interpolates to the next key (wrapping) */
function key(q: number, K: [number, number[]][]): number[] {
  const n = K.length; let i = n - 1; for (let j = 0; j < n; j++) if (q >= K[j][0]) i = j;
  const a = K[i], b = K[(i + 1) % n], q0 = a[0], q1 = b[0] <= q0 ? b[0] + 1 : b[0], qq = q < q0 ? q + 1 : q;
  const t = sm((qq - q0) / (q1 - q0)); return a[1].map((v, m) => v + (b[1][m] - v) * t);
}
/** smooth pseudo-random in [-1, 1] (fidgets) */
const wob = (t: number, k: number) => 0.6 * S(t * 0.37 + k * 1.7) + 0.4 * S(t * 0.91 + k * 4.1);
/** a per-cycle random in [0, 1) (varies each repetition of a cycle) */
const cyc = (t: number, period: number, k: number, salt = 0) => { const n = Math.floor(t / period + k * 0.37); return fr(Math.sin(n * 12.9898 + k * 78.233 + salt * 37.719) * 43758.5453); };

function blank(): Pose { return { rot: {}, hips: [0, 0, 0] }; }
/** trunk: pelvis pitch/yaw, spine and chest pitch/yaw, hips drop and shift (m, reference body) */
function body(p: Pose, o: { hp?: number; hy?: number; hr?: number; sp?: number; sy?: number; ch?: number; cy?: number; drop?: number; back?: number; side?: number }, t: number, k: number): Trunk {
  const br = 0.02 * S(t * 1.5 + k);
  p.rot.hips = [o.hp ?? 0, o.hy ?? 0, o.hr ?? 0]; p.rot.spine = [o.sp ?? 0, o.sy ?? 0, 0]; p.rot.chest = [(o.ch ?? 0) + br, o.cy ?? 0, 0];
  p.hips = [(o.side ?? 0) / HS, (o.drop ?? 0) / HS, (o.back ?? 0) / HS];
  return trunk(p);
}
/** head and neck turned toward a point (character space), clamped, split 40/60 over neck and head */
function look(p: Pose, T: Trunk, at: V3, extraPitch = 0) {
  const R = T.chestR, hp: V3 = [T.chestT[0] + R[1] * 0.43, T.chestT[1] + R[4] * 0.43, T.chestT[2] + R[7] * 0.43 + 0.05];
  const d = v3.sub(at, hp); const dc: V3 = [R[0] * d[0] + R[3] * d[1] + R[6] * d[2], R[1] * d[0] + R[4] * d[1] + R[7] * d[2], R[2] * d[0] + R[5] * d[1] + R[8] * d[2]];
  const pitch = cl(Math.atan2(-dc[1], Math.hypot(dc[0], dc[2])) + extraPitch, -0.5, 1.1), yaw = cl(Math.atan2(dc[0], Math.max(0.05, dc[2])), -1.1, 1.1);
  p.rot.neck = [0.4 * pitch, 0.4 * yaw, 0]; p.rot.head = [0.6 * pitch, 0.6 * yaw, 0];
}
const RP: V3 = [-0.7, -1, -0.25], LP: V3 = [0.7, -1, -0.25]; // default elbow poles: down, out, a little back
/** a point in the pelvis's frame (character space): where a basket rests on the hip moves with the hips */
const onPelvis = (T: Trunk, x: number, y: number, z: number): V3 => v3.add(T.pelvisT, app(T.pelvisR, [x, y, z]));
/** a hand braced on the thigh just above the knee (after the legs are posed) */
const onKnee = (p: Pose, T: Trunk, side: 'l' | 'r'): V3 => { const H = hip(T, side), K = kneeOf(p, T, side); return [H[0] + (K[0] - H[0]) * 0.82 + (side === 'l' ? 0.02 : -0.02), H[1] + (K[1] - H[1]) * 0.82 + 0.05, H[2] + (K[2] - H[2]) * 0.82 + 0.03]; };
/** a hand's grip (palm centre) at a point (character space), the elbow toward a pole; the forearm's twist turns the hand */
function grip(p: Pose, T: Trunk, side: 'l' | 'r', g: V3, pole: V3, twist = 0) { return gripIK(p, T, side, g, pole, twist); }
/** kneeling upright on both knees (shins on the ground behind), trunk lean; ground rest by humanRig's seat pass */
function kneelBody(p: Pose, t: number, k: number, lean: number, o: { sy?: number; drop?: number } = {}): Trunk {
  const T = body(p, { hp: 0.1 + lean * 0.3, sp: lean * 0.5, ch: lean * 0.2, sy: o.sy, drop: o.drop ?? -0.42, back: -0.03 }, t, k);
  // knees on the ground ~0.1 m apart each side, shins back along the ground, toes pointing back
  legIK(p, T, 'l', [0.13, 0.07, -0.42], [0.1, 0, 1], 0, 1.2); legIK(p, T, 'r', [-0.13, 0.07, -0.42], [-0.1, 0, 1], 0, 1.2);
  return T;
}
/** sitting cross-legged on the ground (the seat pass rests the buttocks on it), leaning forward by `lean` */
function sitBody(p: Pose, t: number, k: number, lean: number, sy = 0): Trunk {
  const T = body(p, { hp: 0.05, sp: lean * 0.7, ch: lean * 0.3, sy, drop: -0.76, back: -0.05 }, t, k);
  p.rot.l_thigh = [-1.45, 0, 0.75]; p.rot.r_thigh = [-1.45, 0, -0.75]; p.rot.l_shin = [2.35, 0, 0]; p.rot.r_shin = [2.35, 0, 0]; p.rot.l_foot = [-0.4, 0, 0]; p.rot.r_foot = [-0.4, 0, 0];
  return T;
}
/** a flat-footed squat (heels down; common for work at ground level): pelvis `h` m above the ground */
function squatBody(p: Pose, t: number, k: number, lean: number, h = 0.36, sy = 0): Trunk {
  const T = body(p, { hp: 0.35 + lean * 0.25, sp: lean * 0.6, ch: lean * 0.2, sy, drop: h - NOM.pelvis[1], back: -0.12 }, t, k);
  legIK(p, T, 'l', [0.16, ANKLE_Y, 0.12], [0.45, 0.2, 1], 0.3); legIK(p, T, 'r', [-0.16, ANKLE_Y, 0.12], [-0.45, 0.2, 1], -0.3);
  return T;
}
// ================================================================================================= cycles
/** hoeing (field, garden, canal; clay digging): two-handed hoe raised over the right shoulder, struck ~0.85 m ahead,
 *  drawn back. Right hand is the front hand (props.ts: hoe, front 'r', blade end 0.8 m beyond it) */
//                         R: x      y     z      L: x    y     z     hp    sp    ch    drop
const HOE: [number, number[]][] = [[0.00, [-0.05, 0.80, 0.36, 0.00, 1.06, 0.12, 0.26, 0.34, 0.10, -0.07]],
                                   [0.36, [-0.13, 1.50, 0.06, -0.02, 1.27, 0.30, 0.04, 0.02, -0.04, -0.02]],
                                   [0.50, [-0.05, 0.86, 0.48, 0.00, 1.15, 0.22, 0.28, 0.40, 0.12, -0.08]],
                                   [0.60, [-0.05, 0.80, 0.45, 0.00, 1.10, 0.19, 0.30, 0.40, 0.12, -0.09]],
                                   [0.84, [-0.05, 0.78, 0.36, 0.00, 1.05, 0.11, 0.27, 0.36, 0.10, -0.07]]];
/** leaning on the upright hoe (its blade on the ground ahead-right), the same layout as HOE */
const LEAN = [-0.15, 0.96, 0.4, -0.12, 1.07, 0.37, 0.13, 0.15, 0.05, -0.03];
function hoePose(v: number[], t: number, k: number, lookAt: V3): Pose {
  const p = blank(); const T = body(p, { hp: v[6], sp: v[7], ch: v[8], drop: v[9], back: -0.04, hy: -0.08 }, t, k);
  stance(p, T, { w: 0.14, zl: 0.17, zr: -0.13, out: 0.22 });
  grip(p, T, 'r', [v[0], v[1], v[2]], [-0.8, -1, -0.1], 0.6); grip(p, T, 'l', [v[3], v[4], v[5]], [0.8, -1, -0.4], -0.3);
  look(p, T, lookAt); p.grip = [1, 1]; return p;
}
function hoe(t: number, k: number): Pose {
  const q = fr(t / 1.8 + k * 0.13), p = hoePose(key(q, HOE), t, k, [-0.1, 0, 0.9]);
  p.hit = q >= 0.5 && q < 0.56; return p;
}
/** a turn of water: a few strokes to open or close the runnel, then leaning on the hoe watching the water run (one
 *  stance throughout; the lean blends in from the last stroke and back into the first) */
function irrigate(t: number, k: number): Pose {
  const P = 14, u = fr(t / P + k * 0.21) * P, s = ramp(u, 5.4, 6.4) * (1 - ramp(u, 13.3, 14));
  const h = key(u < 5.4 ? fr(u / 1.8) : 0, HOE), v = h.map((x, i) => x + (LEAN[i] - x) * s);
  const p = hoePose(v, t, k, s > 0.5 ? [-0.3 + 0.4 * wob(t * 0.3, k), 0, 1.6] : [-0.1, 0, 0.9]);
  p.hit = u < 5.4 && fr(u / 1.8) >= 0.5 && fr(u / 1.8) < 0.56; p.grip = [1 - 0.1 * s, 1]; return p;
}
/** reaping with a sickle: grasp a handful of stalks (left), cut below the hand with a pull stroke (right), lay the
 *  handful down behind on the left; deep stoop with bent knees */
function reap(t: number, k: number): Pose {
  const P = 3.2, q = fr(t / P + k * 0.17), p = blank(), j = cyc(t, P, k) - 0.5;
  //                 R: x      y     z      L: x    y     z
  const v = key(q, [[0.00, [-0.14, 0.42, 0.46, 0.08, 0.52, 0.56]],
                    [0.24, [0.0, 0.36, 0.6, 0.05, 0.5, 0.58]],
                    [0.40, [-0.2, 0.38, 0.44, 0.07, 0.48, 0.54]],
                    [0.52, [-0.16, 0.42, 0.42, 0.1, 0.52, 0.46]],
                    [0.72, [-0.14, 0.44, 0.42, 0.34, 0.3, 0.3]],
                    [0.88, [-0.14, 0.42, 0.46, 0.12, 0.5, 0.52]]]);
  const T = body(p, { hp: 0.66, sp: 0.5, ch: 0.16, drop: -0.24, back: -0.12, hy: 0.05 + 0.05 * j }, t, k);
  stance(p, T, { w: 0.2, zl: 0.13, zr: -0.1, out: 0.3 });
  grip(p, T, 'r', [v[0] + 0.05 * j, v[1], v[2]], [-0.9, -0.5, -0.2], 0.3); grip(p, T, 'l', [v[3], v[4], v[5]], [0.9, -0.4, -0.3]);
  look(p, T, [0.05, 0.3, 0.7]);
  const held = win(q, 0.2, 0.76); p.grip = [0.3 + 0.7 * held, 1]; p.hit = q >= 0.32 && q < 0.4;
  return p;
}
/** binding a sheaf on the ground with a twisted band of straw (women and children behind the reapers): kneeling at the
 *  sheaf, twisting and knotting the band, now and then rising to straighten the back */
function bind(t: number, k: number): Pose {
  const P = 7, q = fr(t / P + k * 0.23), p = blank(), tw = 2 * PI * t / 0.9;
  const up = win(q, 0.8, 0.97, 0.05), twist = 1 - up;
  const T = kneelBody(p, t, k, 1.15 - 0.8 * up);
  const R: V3 = [-0.12 + 0.05 * S(tw) * twist, 0.22 + 0.05 * C(tw) * twist + 0.35 * up, 0.48 - 0.15 * up], L: V3 = [0.12 - 0.05 * S(tw + 1) * twist, 0.22 - 0.05 * C(tw + 1) * twist + 0.35 * up, 0.48 - 0.15 * up];
  grip(p, T, 'r', R, [-0.9, -0.3, -0.3]); grip(p, T, 'l', L, [0.9, -0.3, -0.3]);
  look(p, T, [0, 0.1, 0.55]); p.grip = [0.8, 0.8]; return p;
}
/** winnowing with a wooden fork: scoop from the heap, lift, toss into the wind, watch the chaff blow off */
function winnow(t: number, k: number): Pose {
  const P = 3.6, q = fr(t / P + k * 0.11), p = blank();
  //                 R: x      y     z      L: x    y     z     hp    sp    drop
  const v = key(q, [[0.00, [-0.08, 0.66, 0.42, 0.06, 0.95, 0.10, 0.36, 0.32, -0.10]],
                    [0.30, [-0.06, 1.18, 0.38, 0.06, 1.02, 0.08, 0.08, 0.10, -0.05]],
                    [0.46, [0.00, 1.72, 0.22, 0.10, 1.46, -0.02, -0.12, -0.08, -0.035]],
                    [0.66, [0.00, 1.66, 0.20, 0.10, 1.42, -0.02, -0.10, -0.06, -0.035]],
                    [0.84, [-0.06, 0.96, 0.40, 0.06, 0.98, 0.10, 0.18, 0.18, -0.06]]]);
  const T = body(p, { hp: v[6], sp: v[7], ch: 0.05, drop: v[8], back: -0.05 }, t, k);
  stance(p, T, { w: 0.18, zl: 0.16, zr: -0.12, out: 0.3 });
  grip(p, T, 'r', [v[0], v[1], v[2]], [-0.9, -0.6, 0], 0.5); grip(p, T, 'l', [v[3], v[4], v[5]], [0.9, -0.8, -0.3], -0.3);
  look(p, T, q > 0.4 && q < 0.8 ? [0.2, 2.6, 1.8] : [-0.15, 0, 1.1]);
  p.grip = [1, 1]; return p;
}
/** threshing by treading: the driver stands by the post at the floor's centre with a stick, turning with the animals
 *  that walk round over the sheaves (animals.ts circle); one turn every TURN_S */
export const THRESH_TURN_S = 26;
function drive(t: number, k: number): Pose {
  const p = blank(), a = -2 * PI * fr(t / THRESH_TURN_S + k * 0.05), step = S(2 * PI * t / 1.3);
  const T = body(p, { hp: 0.04, sp: 0.04, drop: -0.03, hy: 0.08 * step }, t, k);
  // a shuffle as he turns: heels lift in turn
  legIK(p, T, 'l', [0.12, ANKLE_Y + 0.03 * Math.max(0, step), 0.02], [0.2, 0, 1], 0.15, -0.25 * Math.max(0, step));
  legIK(p, T, 'r', [-0.12, ANKLE_Y + 0.03 * Math.max(0, -step), -0.02], [-0.2, 0, 1], -0.15, -0.25 * Math.max(0, -step));
  const flick = win(fr(t / 5.5 + k), 0.1, 0.18, 0.04);
  grip(p, T, 'r', [-0.42, 1.18 + 0.12 * flick, 0.28], [-0.9, -0.6, -0.2], 0.3); grip(p, T, 'l', [0.22, 0.95, 0.18], LP);
  look(p, T, [-2.2, 0.6, 1.8]);
  p.root = [0, 0, a]; p.grip = [0.3, 1]; p.tip = [[-1.35, 0.35, 0.9], null]; return p;
}
/** ploughing: walking behind the ard along a furrow, left hand on the stilt, right hand with the goad; the root
 *  follows `ploughPath` (the team and the ard are placed from it in animals.ts / workObjects.ts) */
export const FURROW = { len: 16, speed: 0.62, turn: 7, gap: 1.1 } as const;
export function ploughPath(t: number, k: number): { dx: number; dz: number; yaw: number; s: number; turning: boolean } {
  const F = FURROW, tp = F.len / F.speed, Pp = 2 * (tp + F.turn), u = fr(t / Pp + k * 0.071) * Pp;
  const half = F.len / 2, r = F.gap / 2, arc = PI * r;
  const n = Math.floor(t / Pp + k * 0.071); // completed rounds: distance walked
  const base = n * 2 * (F.len + arc);
  if (u < tp) return { dx: 0, dz: -half + F.speed * u, yaw: 0, s: base + F.speed * u, turning: false };
  if (u < tp + F.turn) { const a = PI * (u - tp) / F.turn; return { dx: r - r * C(a), dz: half + r * S(a), yaw: a, s: base + F.len + arc * (u - tp) / F.turn, turning: true }; }
  if (u < 2 * tp + F.turn) { const w = u - tp - F.turn; return { dx: F.gap, dz: half - F.speed * w, yaw: PI, s: base + F.len + arc + F.speed * w, turning: false }; }
  const a = PI * (u - 2 * tp - F.turn) / F.turn; return { dx: r + r * C(a), dz: -half - r * S(a), yaw: PI + a, s: base + 2 * F.len + arc + arc * (u - 2 * tp - F.turn) / F.turn, turning: true };
}
function plough(t: number, k: number): Pose {
  const p = blank(), P = ploughPath(t, k), ph = 2 * PI * P.s / 1.1;
  // walking legs (as anim.ts legsWalk, shorter steps), a lean into the stilt
  const r = p.rot, amp = 0.3;
  r.l_thigh = [-amp * S(ph), 0, 0]; r.r_thigh = [amp * S(ph), 0, 0];
  r.l_shin = [0.1 + 0.9 * amp * Math.max(0, C(ph)) ** 1.5, 0, 0]; r.r_shin = [0.1 + 0.9 * amp * Math.max(0, -C(ph)) ** 1.5, 0, 0];
  r.l_foot = [-0.2 * S(ph), 0, 0]; r.r_foot = [0.2 * S(ph), 0, 0];
  const T = body(p, { hp: 0.1, hy: 0.06 * S(ph), sp: 0.14, ch: 0.04, drop: -0.03 + 0.018 * C(2 * ph), side: 0.018 * S(ph) }, t, k);
  const flick = win(fr(t / 4.3 + k), 0.1, 0.2, 0.04);
  grip(p, T, 'l', [0.12, 0.9 + 0.02 * S(2 * ph), 0.5], [0.8, -1, -0.3]); grip(p, T, 'r', [-0.3, 1.12 + 0.14 * flick, 0.34], [-0.9, -0.6, -0.2], 0.3);
  look(p, T, [0.3, 0.3, 3]);
  p.root = [P.dx, P.dz, P.yaw]; p.grip = [1, 1]; p.tip = [[-0.65, 1.5 + 0.2 * flick, 1.5], null]; return p;
}
/** herding: leaning on the staff, watching the flock; a call to the animals with a raised arm now and then */
function herd(t: number, k: number): Pose {
  const P = 26, u = fr(t / P + k * 0.13) * P, call = win(u, 18, 20.5, 0.4), p = blank();
  const T = body(p, { hp: 0.06, sp: 0.08, ch: 0.02, drop: -0.02, hy: 0.06 * wob(t * 0.2, k), hr: 0.03 * wob(t * 0.15, k + 2) }, t, k);
  stance(p, T, { w: 0.14, zl: 0.05, zr: -0.05, out: 0.25 });
  const top: V3 = [-0.2, 1.18, 0.42];
  grip(p, T, 'r', top, [-0.8, -1, -0.2], 0.4);
  grip(p, T, 'l', [top[0] + 0.05 + 0.5 * call, top[1] + 0.05 + 0.6 * call, top[2] - 0.05 - 0.1 * call], [0.8, -1, -0.3]);
  look(p, T, [6 * S(t * 0.11 + k), 0.3, 8 + 4 * C(t * 0.07 + k)]);
  p.grip = [1 - call, 1]; p.tip = [[-0.3, 0.0, 0.62], null]; return p;
}
/** grooming a horse, donkey or ox standing to the front-left: rubbing its flank with a wisp of straw, the other hand
 *  on its back */
function groom(t: number, k: number): Pose {
  const p = blank(), a = 2 * PI * t / 1.6, pause = win(fr(t / 11 + k), 0.7, 0.9, 0.05);
  const T = body(p, { hp: 0.08, sp: 0.1, ch: 0.02, drop: -0.03, hy: 0.35 }, t, k);
  stance(p, T, { w: 0.15, zl: 0.08, zr: -0.06, out: 0.2 });
  grip(p, T, 'r', [0.05 + 0.12 * C(a) * (1 - pause), 1.02 + 0.08 * S(a) * (1 - pause), 0.5], [-0.8, -1, -0.3], 0.5);
  grip(p, T, 'l', [0.35, 1.22, 0.44], [0.8, -1, -0.2]);
  look(p, T, [0.2, 1.0, 0.8]); p.grip = [0.4, 1]; return p;
}
/** feeding small stock: fodder scattered from a basket held on the left hip */
function fodder(t: number, k: number): Pose {
  const P = 3.4, q = fr(t / P + k * 0.2), p = blank();
  const v = key(q, [[0, [0.16, 0.98, 0.18, 0.1]], [0.3, [0.16, 0.96, 0.2, 0.15]], [0.5, [-0.12, 0.9, 0.62, 0.3]], [0.62, [-0.18, 0.95, 0.55, 0.3]], [0.85, [0.1, 1.0, 0.25, 0.12]]]);
  const T = body(p, { hp: v[3], sp: v[3], ch: 0.05, drop: -0.04 }, t, k);
  stance(p, T, { w: 0.14, zl: 0.1, zr: -0.08, out: 0.2 });
  grip(p, T, 'r', [v[0], v[1], v[2]], RP, 0.3); grip(p, T, 'l', onPelvis(T, 0.25, 0.05, 0.12), [1, -0.6, -0.4], -0.6);
  look(p, T, [-0.2, 0, 1.4]); p.grip = [1, q > 0.25 && q < 0.5 ? 0.9 : 0.3]; return p;
}
/** shearing: kneeling at a sheep lying on its side, a knife stroking along the fleece, the other hand holding it back */
function shear(t: number, k: number): Pose {
  const P = 1.7, q = fr(t / P + k * 0.3), p = blank(), j = cyc(t, P, k);
  const T = kneelBody(p, t, k, 0.95);
  const s = q < 0.45 ? ramp(q, 0, 0.45) : 1 - ramp(q, 0.45, 1);
  grip(p, T, 'r', [0.08 - 0.24 * s + 0.04 * j, 0.3 - 0.04 * s, 0.46 + 0.07 * s], [-0.8, -0.8, -0.4], 1.2);
  grip(p, T, 'l', [0.18, 0.34 + 0.03 * s, 0.44], [0.8, -0.8, -0.4]);
  look(p, T, [0, 0.2, 0.55]); p.grip = [0.9, 1]; return p;
}
/** butchery without spectacle: kneeling at a hide spread with the joints of a carcass already divided, cutting with a
 *  knife and laying the meat in a basket (PF 58-60: slaughter at the stockyard, hides to the Treasury) */
function butcher(t: number, k: number): Pose {
  const P = 4.2, q = fr(t / P + k * 0.27), p = blank(), cut = S(2 * PI * q * 3.2);
  const lift = win(q, 0.62, 0.92, 0.06);
  const T = kneelBody(p, t, k, 1.1, { sy: 0.25 * lift });
  grip(p, T, 'r', [-0.06 + 0.08 * cut * (1 - lift), 0.16 + 0.1 * lift, 0.5 - 0.08 * lift], [-0.8, -0.8, -0.4], 1.0);
  const Lp = key(q, [[0, [0.08, 0.18, 0.5]], [0.6, [0.08, 0.18, 0.5]], [0.7, [0.1, 0.2, 0.46]], [0.82, [0.32, 0.22, 0.3]], [0.92, [0.12, 0.2, 0.46]]]);
  grip(p, T, 'l', [Lp[0], Lp[1], Lp[2]], [0.8, -0.8, -0.4]);
  look(p, T, lift > 0.5 ? [0.4, 0.1, 0.3] : [0, 0.05, 0.55]); p.grip = [0.6 + 0.4 * lift, 1]; return p;
}
/** the magi at the offering place: standing still with the issued commodity held before them (the rite itself is not
 *  attested and is not shown: no gesture, no raising, no fire) */
function hold(t: number, k: number, what: 'jar' | 'sack' | 'lead'): Pose {
  const p = blank(), T = body(p, { hp: 0.02, sp: 0.03, drop: -0.01, hy: 0.02 * wob(t * 0.15, k) }, t, k);
  stance(p, T, { w: 0.12, zl: 0.02, zr: -0.02, out: 0.15 });
  if (what === 'jar') { grip(p, T, 'r', [-0.1, 1.0, 0.27], [-0.8, -1, -0.3], 0.9); grip(p, T, 'l', [0.1, 1.0, 0.27], [0.8, -1, -0.3], -0.9); }
  else if (what === 'sack') { grip(p, T, 'r', [-0.12, 1.12, 0.26], [-0.8, -1, -0.1], 0.9); grip(p, T, 'l', [0.12, 1.12, 0.26], [0.8, -1, -0.1], -0.9); }
  else { grip(p, T, 'r', [-0.22, 0.86, 0.16], RP, 0.2); grip(p, T, 'l', [0.1, 0.95, 0.2], [0.8, -1, -0.3], -0.6); }
  look(p, T, [0.3 * wob(t * 0.1, k + 1), 1.2, 6]);
  p.grip = what === 'lead' ? [0.5, 1] : [0.8, 0.8]; if (what === 'lead') p.tip = [[-0.62, 0.55, 0.55], null]; return p;
}
/** sweeping with a handleless twig broom, stooped over bent knees, the left hand on the knee */
function sweep(t: number, k: number): Pose {
  const P = 1.3, q = fr(t / P + k * 0.19), p = blank(), x = S(2 * PI * q);
  const T = body(p, { hp: 0.78, sp: 0.46, ch: 0.12, drop: -0.28, back: -0.16, hy: -0.12 * x }, t, k);
  stance(p, T, { w: 0.2, zl: 0.12, zr: -0.12, out: 0.3 });
  const R: V3 = [-0.14 + 0.18 * x, 0.3, 0.5]; grip(p, T, 'r', R, [-0.9, -0.4, -0.3], 0.8); grip(p, T, 'l', onKnee(p, T, 'l'), [0.9, -0.2, -0.4]);
  look(p, T, [R[0], 0, 0.85]);
  p.hit = Math.abs(x) < 0.25 && fr(q * 2) < 0.12; p.grip = [0.6, 1]; p.tip = [[R[0] + 0.14 * x - 0.05, 0.0, R[2] + 0.32], null]; return p;
}
/** weaving at a ground loom (horizontal, warp near the ground; D-142 chooses it over the warp-weighted loom, C):
 *  pass the weft, lift the heddle rod to change the shed, beat the weft home with the sword beater */
function weave(t: number, k: number): Pose {
  const P = 6.5, q = fr(t / P + k * 0.1), p = blank();
  const T = sitBody(p, t, k, 0.75);
  //                 R: x      y     z      L: x    y     z
  // the fell of the cloth at z ≈ 0.46 (the loom is placed 0.44 m ahead: activities.ts), the heddle rod at z ≈ 0.72
  const v = key(q, [[0.00, [-0.36, 0.12, 0.5, 0.12, 0.16, 0.44]],
                    [0.26, [0.16, 0.12, 0.5, 0.32, 0.14, 0.48]],
                    [0.33, [-0.2, 0.24, 0.72, 0.2, 0.24, 0.72]],
                    [0.42, [-0.2, 0.34, 0.72, 0.2, 0.34, 0.72]],
                    [0.50, [-0.22, 0.14, 0.64, 0.22, 0.14, 0.64]],
                    [0.58, [-0.22, 0.12, 0.49, 0.22, 0.12, 0.49]],
                    [0.66, [-0.22, 0.14, 0.62, 0.22, 0.14, 0.62]],
                    [0.72, [-0.22, 0.12, 0.49, 0.22, 0.12, 0.49]],
                    [0.86, [-0.3, 0.14, 0.5, 0.12, 0.16, 0.44]]]);
  grip(p, T, 'r', [v[0], v[1], v[2]], [-0.9, -0.5, -0.3], 0.5); grip(p, T, 'l', [v[3], v[4], v[5]], [0.9, -0.5, -0.3], -0.5);
  look(p, T, [(v[0] + v[3]) / 2, 0.05, 0.6]);
  p.hit = (q >= 0.56 && q < 0.6) || (q >= 0.7 && q < 0.74); p.grip = [0.9, 0.9]; p.show = [q > 0.46 && q < 0.8, false]; return p;
}
/** spinning with a drop spindle, standing: the distaff held up in the left hand, the right hand drafting the fibre
 *  while the spindle turns below; now and then the yarn is wound on. aux = the yarn's length below the hand (m) */
function spin(t: number, k: number): Pose {
  const P = 22, u = fr(t / P + k * 0.15) * P, p = blank();
  const wind = win(u, 17, 21.5, 0.6), draft = ramp(fr(u / 4.25), 0.1, 0.85) * (1 - wind);
  const T = body(p, { hp: 0.03, sp: 0.06, ch: 0.02, drop: -0.01, hy: 0.03 * wob(t * 0.2, k) }, t, k);
  stance(p, T, { w: 0.13, zl: 0.04, zr: -0.03, out: 0.18 });
  grip(p, T, 'l', [0.2, 1.3 - 0.35 * wind, 0.24 + 0.05 * wind], [0.9, -0.8, -0.3], -0.4);
  grip(p, T, 'r', [-0.02 - 0.04 * draft, 1.16 - 0.2 * draft - 0.3 * wind, 0.3 + 0.03 * draft], [-0.9, -0.8, -0.3], 0.4);
  look(p, T, [0, 1.0, 0.5]);
  p.grip = [0.9, 0.7]; p.aux = 0.3 + 0.35 * draft - 0.15 * wind; return p;
}
/** gathering dung and brushwood into a basket on the hip: stoop over bent knees, pick up, drop it in, look about */
function gather(t: number, k: number): Pose {
  const P = 4.4, q = fr(t / P + k * 0.23), p = blank(), j = cyc(t, P, k) - 0.5, down = win(q, 0.12, 0.5, 0.1);
  const T = body(p, { hp: 0.1 + 0.85 * down, sp: 0.05 + 0.45 * down, ch: 0.12 * down, drop: -0.02 - 0.34 * down, back: -0.18 * down, hy: 0.15 * j }, t, k);
  stance(p, T, { w: 0.17, zl: 0.1, zr: -0.08, out: 0.28 });
  const R = key(q, [[0, [0.12, 1.0, 0.2]], [0.3, [-0.14 + 0.16 * j, 0.14, 0.44]], [0.42, [-0.14 + 0.16 * j, 0.13, 0.43]], [0.58, [-0.02, 0.8, 0.3]], [0.68, [0.16, 1.02, 0.24]], [0.8, [0.16, 1.02, 0.22]]]);
  grip(p, T, 'r', [R[0], R[1], R[2]], RP, 0.3); grip(p, T, 'l', onPelvis(T, 0.25, 0.03, 0.12), [1, -0.6, -0.4], -0.6);
  look(p, T, down > 0.3 ? [R[0], 0, 0.55] : [2 * j, 0.8, 4]);
  p.grip = [1, q > 0.3 && q < 0.66 ? 1 : 0.3]; return p;
}
/** shaping dung cakes for fuel and setting them out to dry, squatting */
function pat(t: number, k: number): Pose {
  const P = 5, q = fr(t / P + k * 0.3), p = blank(), clap = S(2 * PI * t / 0.45), put = win(q, 0.6, 0.85, 0.05);
  const T = squatBody(p, t, k, 0.35 + 0.3 * put, 0.36, 0.45 * put);
  const c: V3 = [0.16 * put, 0.42 - 0.26 * put, 0.42 + 0.02 * put];
  grip(p, T, 'r', [c[0] - 0.06 - 0.02 * clap * (1 - put), c[1], c[2]], [-0.9, -0.6, -0.3], 1.2); grip(p, T, 'l', [c[0] + 0.06 + 0.02 * clap * (1 - put), c[1], c[2]], [0.9, -0.6, -0.3], -1.2);
  look(p, T, [c[0], 0, 0.55]); p.grip = [0.2, 0.2]; return p;
}
/** stirring the mash in a brewing vat with a long paddle (left hand low on the shaft, right hand at the top) */
function stir(t: number, k: number): Pose {
  const p = blank(), a = 2 * PI * t / 3.2 + k, lean = 0.2 + 0.05 * S(a);
  const T = body(p, { hp: lean, sp: lean + 0.1, ch: 0.06, drop: -0.05, hy: 0.1 * S(a) }, t, k);
  stance(p, T, { w: 0.15, zl: 0.12, zr: -0.1, out: 0.22 });
  const B: V3 = [0.1 * S(a), 0.36, 0.72 + 0.09 * C(a)]; // the blade in the mash
  const d = v3.nrm([0.02 - 0.3 * B[0], 0.62, -0.45 - 0.3 * (B[2] - 0.72)]);
  grip(p, T, 'l', v3.add(B, v3.scl(d, 0.5)), [0.8, -1, -0.3], -0.4); grip(p, T, 'r', v3.add(B, v3.scl(d, 0.88)), [-0.8, -1, -0.2], 0.4);
  look(p, T, [B[0], 0.5, B[2]]); p.grip = [1, 1]; return p;
}
/** moulding mud brick: fill the wooden mould in front, smooth it, carry it to the drying floor on the left, lift it off
 *  the brick, bring it back (slop moulding; the brick left behind joins the drying rows). Prop 1 (the mould) is placed
 *  explicitly (Pose.at) since it rests on the ground for half the cycle */
function mould(t: number, k: number): Pose {
  const P = 8, q = fr(t / P + k * 0.21), p = blank();
  // mould position [x, y (bottom), z] by phase: on the ground in front, carried left, set down, lifted off, carried back
  const M = key(q, [[0, [0, 0, 0.44]], [0.5, [0, 0, 0.44]], [0.56, [0.04, 0.16, 0.4]], [0.64, [0.22, 0.12, 0.34]], [0.68, [0.24, 0, 0.33]], [0.72, [0.24, 0, 0.33]],
    [0.77, [0.24, 0.18, 0.33]], [0.9, [0.02, 0.1, 0.42]], [0.95, [0, 0, 0.44]]]);
  const holding = win(q, 0.5, 0.94, 0.02), scoop = win(q, 0, 0.16, 0.05);
  const T = squatBody(p, t, k, 0.72 + 0.14 * holding, 0.33, 0.6 * ramp(M[0], 0, 0.24) - 0.45 * scoop);
  let R: V3, L: V3;
  if (holding > 0.5) { R = [M[0] - 0.225, M[1] + 0.08, M[2]]; L = [M[0] + 0.225, M[1] + 0.08, M[2]]; }
  else {
    const h = key(q, [[0, [-0.34, 0.16, 0.32, -0.2, 0.16, 0.38]], [0.12, [-0.3, 0.22, 0.32, -0.16, 0.22, 0.38]], [0.2, [-0.06, 0.2, 0.46, 0.06, 0.2, 0.46]],
      [0.26, [-0.06, 0.16, 0.46, 0.06, 0.16, 0.46]], [0.34, [-0.1, 0.15, 0.48, 0.1, 0.15, 0.42]], [0.42, [0.04, 0.15, 0.5, 0.14, 0.15, 0.44]], [0.48, [-0.24, 0.1, 0.46, 0.24, 0.1, 0.46]], [0.96, [-0.34, 0.16, 0.32, -0.2, 0.16, 0.38]]]);
    R = [h[0], h[1], h[2]]; L = [h[3], h[4], h[5]];
  }
  grip(p, T, 'r', R, [-0.9, -0.5, -0.3], 0.3); grip(p, T, 'l', L, [0.9, -0.5, -0.3], -0.3);
  look(p, T, [M[0], 0, M[2] + 0.05]);
  p.hit = q >= 0.24 && q < 0.28; p.grip = [0.7, 0.7]; p.at = [M[0], M[1], M[2], 0]; return p;
}
/** laying mud brick on the wall top, squatting on the course below: mortar scooped from the tub with the trowel and
 *  spread, a brick taken from the stack with the left hand and set, tapped down with the trowel's handle */
function lay(t: number, k: number): Pose {
  const P = 6.4, q = fr(t / P + k * 0.17), p = blank();
  const v = key(q, [[0.00, [-0.34, 0.24, 0.3, 0.14, 0.45, 0.3]], [0.14, [-0.36, 0.18, 0.32, 0.14, 0.45, 0.3]], [0.24, [-0.14, 0.16, 0.48, 0.14, 0.45, 0.32]],
    [0.34, [0.06, 0.16, 0.46, 0.18, 0.42, 0.34]], [0.44, [-0.1, 0.36, 0.4, 0.36, 0.3, 0.28]], [0.56, [-0.1, 0.36, 0.4, 0.34, 0.34, 0.3]],
    [0.68, [-0.06, 0.3, 0.44, 0.06, 0.2, 0.48]], [0.74, [0.02, 0.26, 0.48, 0.1, 0.2, 0.48]], [0.8, [0.02, 0.3, 0.48, 0.16, 0.42, 0.36]], [0.9, [-0.26, 0.3, 0.38, 0.14, 0.45, 0.3]]]);
  const tap = q > 0.72 && q < 0.82 ? 0.04 * Math.abs(S(2 * PI * q * 30)) : 0;
  const turn = -0.35 * win(q, 0, 0.18, 0.06) + 0.45 * win(q, 0.4, 0.6, 0.06);
  const T = squatBody(p, t, k, 0.7, 0.42, turn);
  grip(p, T, 'r', [v[0], v[1] + tap, v[2]], [-0.9, -0.4, -0.3], 0.9); grip(p, T, 'l', [v[3], v[4], v[5]], [0.9, -0.4, -0.3], -0.8);
  look(p, T, q > 0.38 && q < 0.6 ? [0.5, 0.2, 0.3] : [0, 0, 0.55]);
  p.hit = (q >= 0.74 && q < 0.76) || (q >= 0.78 && q < 0.8); p.grip = [1, 1]; p.show = [true, q > 0.44 && q < 0.7];
  p.tip = [[v[0], 0.02, v[2] + 0.16], null]; return p;
}
/** hauling on a rope in a line of men (column drums on a sledge up the ramp): heave leaning back, recover */
function haul(t: number, k: number): Pose {
  const P = 2.6, q = fr(t / P + k * 0.02), p = blank(), h = q < 0.38 ? ramp(q, 0, 0.38) : 1 - ramp(q, 0.38, 1);
  const T = body(p, { hp: -0.08 - 0.16 * h, sp: -0.02 - 0.06 * h, ch: 0.08, drop: -0.1 - 0.06 * h, back: -0.03 - 0.08 * h }, t, k);
  stance(p, T, { w: 0.13, zl: 0.28, zr: -0.22, out: 0.15 });
  grip(p, T, 'l', [0.02, 0.97 - 0.05 * h, 0.4 - 0.12 * h], [0.8, -1, -0.2], -1.2); grip(p, T, 'r', [-0.02, 0.95 - 0.05 * h, 0.16 - 0.12 * h], [-0.8, -1, -0.2], 1.2);
  look(p, T, [0, 0.8, 5]); p.grip = [1, 1]; return p;
}
/** passing bricks or baskets of earth along a chain of workers: take from the right, turn, hand on to the left */
function pass(t: number, k: number): Pose {
  const P = 2.6, q = fr(t / P + k * 0.5), p = blank();
  const turn = key(q, [[0, [-1]], [0.12, [-1]], [0.46, [1]], [0.6, [1]], [0.9, [-1]]])[0];
  const T = body(p, { hp: 0.15, hy: 0.28 * turn, sp: 0.12, sy: 0.3 * turn, cy: 0.12 * turn, drop: -0.08 }, t, k);
  stance(p, T, { w: 0.2, zl: 0.03, zr: -0.03, out: 0.3 });
  const x = 0.34 * turn, z = 0.26 + 0.05 * (1 - Math.abs(turn));
  grip(p, T, 'r', [x - 0.12, 0.92, z], [-0.8, -1, -0.3], 1.2); grip(p, T, 'l', [x + 0.12, 0.92, z], [0.8, -1, -0.3], -1.2);
  look(p, T, [x * 3, 0.9, 1.2]); p.grip = [0.8, 0.8]; p.show = [q < 0.52 || q > 0.94, false]; return p;
}
/** polishing gold and silver vessels, seated: the bowl on the left hand, a rag in the right rubbing in small circles */
function polish(t: number, k: number): Pose {
  const p = blank(), a = 2 * PI * t / 1.1, turn = win(fr(t / 9 + k), 0.8, 0.95, 0.03);
  const T = sitBody(p, t, k, 0.42);
  grip(p, T, 'l', [0.1, 0.38 + 0.03 * turn, 0.3], [0.9, -0.6, -0.3], -1.4 + 0.6 * turn);
  grip(p, T, 'r', [0.02 + 0.05 * C(a) * (1 - turn), 0.45 + 0.02 * S(a), 0.32 + 0.04 * S(a)], [-0.9, -0.6, -0.3], 0.8);
  look(p, T, [0.06, 0.35, 0.34]); p.grip = [0.3, 0.8]; return p;
}
/** dressing timber with an adze on a beam lying across two blocks; stooped, the left hand steadying on the beam */
function adze(t: number, k: number): Pose {
  const P = 1.15, q = fr(t / P + k * 0.13), p = blank(), j = cyc(t, P, k) - 0.5;
  const v = key(q, [[0, [-0.16, 1.2, 0.36]], [0.36, [-0.18, 1.32, 0.34]], [0.46, [-0.06 + 0.1 * j, 0.66, 0.5]], [0.56, [-0.06 + 0.1 * j, 0.66, 0.48]], [0.8, [-0.14, 0.95, 0.42]]]);
  const T = body(p, { hp: 0.42, sp: 0.36, ch: 0.1, drop: -0.12, back: -0.08, hy: -0.08 }, t, k);
  stance(p, T, { w: 0.2, zl: 0.14, zr: -0.12, out: 0.3 });
  grip(p, T, 'r', [v[0], v[1], v[2]], [-0.8, -1, -0.2], 0.6); grip(p, T, 'l', [0.22, 0.58, 0.44], [0.8, -0.8, -0.3]);
  look(p, T, [-0.06, 0.45, 0.55]);
  // the blade ~0.35 m beyond the grip: down onto the beam at the strike, back over the shoulder when raised
  const up = 1 - ramp(q, 0.38, 0.46) * (1 - ramp(q, 0.6, 0.85));
  p.tip = [[v[0] - 0.02, v[1] - 0.2 - 0.05 * (1 - up) + 0.35 * up, v[2] + 0.34 * (1 - up) - 0.2 * up], null];
  p.hit = q >= 0.45 && q < 0.5; p.grip = [0.4, 1]; return p;
}
/** picking grapes or figs: reach up into the foliage, pick, stoop to drop the fruit into the basket at the right foot */
function pick(t: number, k: number): Pose {
  const P = 3.6, q = fr(t / P + k * 0.31), p = blank(), j = cyc(t, P, k) - 0.5, j2 = cyc(t, P, k, 3) - 0.5;
  const down = win(q, 0.45, 0.72, 0.08);
  const T = body(p, { hp: 0.04 + 0.62 * down, sp: -0.04 + 0.4 * down, ch: -0.05 + 0.1 * down, drop: -0.02 - 0.2 * down, back: -0.12 * down, hy: -0.25 * down + 0.1 * j }, t, k);
  stance(p, T, { w: 0.15, zl: 0.1, zr: -0.08, out: 0.22 });
  const up: V3 = [-0.12 + 0.3 * j, 1.62 + 0.15 * j2, 0.42];
  const R = key(q, [[0, [up[0], up[1] - 0.2, up[2] - 0.05]], [0.22, up], [0.36, [up[0], up[1] - 0.05, up[2] - 0.05]], [0.56, [-0.28, 0.5, 0.38]], [0.66, [-0.28, 0.48, 0.38]], [0.86, [up[0], up[1] - 0.3, 0.3]]]);
  grip(p, T, 'r', [R[0], R[1], R[2]], [-0.8, -0.6, -0.3], 0.4); const Lu: V3 = [0.16 + 0.1 * j2, 1.55, 0.4], Lk = onKnee(p, T, 'l'); grip(p, T, 'l', [Lu[0] + (Lk[0] - Lu[0]) * down, Lu[1] + (Lk[1] - Lu[1]) * down, Lu[2] + (Lk[2] - Lu[2]) * down], [0.8, -0.6, -0.3]);
  look(p, T, down > 0.5 ? [-0.3, 0, 0.4] : [up[0], up[1], 0.6]);
  p.grip = [0.8, q > 0.2 && q < 0.6 ? 1 : 0.3]; return p;
}
/** treading grapes in the press: stamping in place, hands on the hips */
function tread(t: number, k: number): Pose {
  const p = blank(), ph = 2 * PI * t / 1.5 + k, lL = Math.max(0, S(ph)), lR = Math.max(0, -S(ph));
  const T = body(p, { hp: 0.06, sp: 0.04, drop: -0.05 - 0.03 * Math.abs(C(ph)), side: 0.03 * (lR - lL), hr: 0.04 * (lR - lL) }, t, k);
  legIK(p, T, 'l', [0.12, ANKLE_Y + 0.18 * lL, 0.03 + 0.05 * lL], [0.2, 0, 1], 0.15); legIK(p, T, 'r', [-0.12, ANKLE_Y + 0.18 * lR, -0.03 + 0.05 * lR], [-0.2, 0, 1], -0.15);
  grip(p, T, 'r', [-0.2, 1.0, 0.02], [-1, 0, -0.4], 0.8); grip(p, T, 'l', [0.2, 1.0, 0.02], [1, 0, -0.4], -0.8);
  look(p, T, [0, 0.2, 1.5]); p.grip = [0.3, 0.3]; return p;
}
/** feeding a kiln: crouched at the fire mouth, brushwood from the pile pushed in */
function stoke(t: number, k: number): Pose {
  const P = 5.5, q = fr(t / P + k * 0.4), p = blank();
  const R = key(q, [[0, [-0.32, 0.18, 0.32]], [0.14, [-0.33, 0.15, 0.32]], [0.4, [-0.06, 0.3, 0.52]], [0.52, [-0.02, 0.28, 0.58]], [0.7, [-0.1, 0.4, 0.38]], [0.9, [-0.34, 0.2, 0.3]]]);
  const T = squatBody(p, t, k, 0.6, 0.38, -0.5 * (1 - ramp(q, 0.2, 0.4)) - 0.5 * ramp(q, 0.8, 0.95));
  grip(p, T, 'r', [R[0], R[1], R[2]], [-0.9, -0.5, -0.3], 0.4); grip(p, T, 'l', onPelvis(T, 0.2, -0.05, 0.3), [0.9, -0.5, -0.3]);
  look(p, T, q < 0.25 ? [-0.4, 0.05, 0.3] : [0, 0.3, 0.8]);
  p.grip = [0.3, 1]; p.show = [q > 0.12 && q < 0.54, false]; return p;
}
/** mending a basket (or harness, sandals) seated: an awl pushed through and the thread drawn out */
function mend(t: number, k: number): Pose {
  const P = 3.1, q = fr(t / P + k * 0.35), p = blank(), out = win(q, 0.45, 0.85, 0.08);
  const T = sitBody(p, t, k, 0.45);
  grip(p, T, 'l', [0.08, 0.4, 0.3], [0.9, -0.6, -0.3], -0.9);
  grip(p, T, 'r', [-0.02 - 0.22 * out, 0.44 + 0.12 * out, 0.32 - 0.02 * out], [-0.9, -0.6, -0.3], 0.5);
  look(p, T, [0.04, 0.38, 0.32]); p.grip = [0.8, 1]; return p;
}
/** a bearer of the dead: walking (slow, even), the bier's pole on the shoulder held by that hand (the bier itself is
 *  placed once for the bearers together: workObjects.ts). side 'r': the pole on the right shoulder */
function bier(t: number, ph: number, k: number, side: 'l' | 'r'): Pose {
  const p = blank(), r = p.rot, amp = 0.26;
  r.l_thigh = [-amp * S(ph), 0, 0]; r.r_thigh = [amp * S(ph), 0, 0];
  r.l_shin = [0.1 + 0.9 * amp * Math.max(0, C(ph)) ** 1.5, 0, 0]; r.r_shin = [0.1 + 0.9 * amp * Math.max(0, -C(ph)) ** 1.5, 0, 0];
  r.l_foot = [-0.2 * S(ph), 0, 0]; r.r_foot = [0.2 * S(ph), 0, 0];
  const T = body(p, { hy: 0.05 * S(ph), sp: 0.03, drop: -0.025 + 0.015 * C(2 * ph), side: 0.015 * S(ph) }, t, k);
  const sg = side === 'r' ? -1 : 1;
  grip(p, T, side, [sg * 0.16, 1.47, 0.14], [sg * 0.9, -0.8, -0.2], -sg * 1.0);
  const o = side === 'r' ? 'l' : 'r'; grip(p, T, o, [-sg * 0.2, 0.86, 0.06 + 0.1 * S(ph) * -sg], [-sg, -1, -0.2]);
  look(p, T, [0, 1.2, 8], 0.15); p.grip = side === 'r' ? [0.3, 1] : [1, 0.3]; return p;
}
/** washing cloth or wool at the water: rinse, beat it on the stone, wring it (kneeling at the edge) */
function wash(t: number, k: number): Pose {
  const P = 7.5, q = fr(t / P + k * 0.12), p = blank();
  const beat = win(q, 0.4, 0.7, 0.04), wring = win(q, 0.72, 0.94, 0.02);
  const T = kneelBody(p, t, k, 1.2 - 0.15 * beat - 0.6 * wring);
  let R: V3, L: V3;
  if (q < 0.36) { const x = 0.08 * S(4 * PI * q / 0.36); R = [-0.12 + x, 0.1, 0.5]; L = [0.12 + x, 0.1, 0.5]; }
  else { const h = key(q, [[0.36, [0.08, 0.1, 0.5]], [0.46, [0.1, 0.52, 0.42]], [0.52, [0.1, 0.18, 0.48]], [0.58, [0.1, 0.5, 0.42]], [0.64, [0.1, 0.18, 0.48]], [0.72, [0.12, 0.52, 0.34]], [0.94, [0.12, 0.52, 0.34]], [0.99, [0.08, 0.1, 0.5]]]);
    R = [-h[0], h[1], h[2]]; L = [h[0], h[1], h[2]]; }
  const wr = wring * S(2 * PI * t / 0.8);
  grip(p, T, 'r', R, [-0.9, -0.6, -0.3], 0.6 + 0.8 * wr); grip(p, T, 'l', L, [0.9, -0.6, -0.3], -0.6 + 0.8 * wr);
  look(p, T, [0, 0.05, 0.55]);
  p.hit = (q >= 0.5 && q < 0.53) || (q >= 0.62 && q < 0.65); p.grip = [1, 1]; return p;
}
/** archery practice (train): stance side-on to the target (the shot goes along the performer's heading, +Z of the root:
 *  the body is turned by −90°), an arrow from the quiver, nocked, drawn to the cheek, loosed; ip = the draw */
// ------------------------------------------------------------------------------------------------ D-215: play; the lame, the blind
/** legs in a walking or running stride at phase ph (amplitude amp; `run`: a flight phase, the knees higher) */
function stride(p: Pose, ph: number, amp: number, run = 0) {
  const r = p.rot; r.l_thigh = [-amp * S(ph), 0, 0]; r.r_thigh = [amp * S(ph), 0, 0];
  r.l_shin = [0.1 + (0.9 + run) * amp * Math.max(0, C(ph)) ** 1.5, 0, 0]; r.r_shin = [0.1 + (0.9 + run) * amp * Math.max(0, -C(ph)) ** 1.5, 0, 0];
  r.l_foot = [-0.2 * S(ph), 0, 0]; r.r_foot = [0.2 * S(ph), 0, 0];
}
/** tossing a ball up and catching it (a child, standing): the ball's height above the hands is the second prop parameter */
function ball(t: number, k: number): Pose {
  const P = 1.9, q = fr(t / P + k * 0.21), p = blank(), up = S(PI * cl(q / 0.8)), crouch = win(q, 0.78, 1.02, 0.06);
  const T = body(p, { hp: 0.05 + 0.15 * crouch, sp: -0.06 * up, ch: -0.05 * up, drop: -0.02 - 0.05 * crouch }, t, k);
  stance(p, T, { w: 0.13, zl: 0.04, zr: -0.03, out: 0.2 });
  const hy = q < 0.08 ? 1.05 + 1.6 * q : q < 0.72 ? 1.18 + 0.12 * up : 1.1, hz = 0.28;
  grip(p, T, 'l', [0.08, hy, hz], [0.9, -0.8, -0.3], -0.6); grip(p, T, 'r', [-0.08, hy, hz], [-0.9, -0.8, -0.3], 0.6);
  look(p, T, [0, 1.2 + 1.2 * up, 0.6], -0.2); p.grip = [0.3, 0.3];
  p.aux = q < 0.8 ? 0.95 * S(PI * q / 0.8) : 0; p.at = [0, hy, hz, 0]; return p;
}
/** running round after the other children (the root on its circle: playPath) */
function chase(t: number, k: number): Pose {
  const P = PLAY_PATH.chase, ph = 2 * PI * P.cad * t + k, p = blank(); stride(p, ph, 0.62, 0.5);
  body(p, { hp: 0.12, sp: 0.08, drop: -0.04 + 0.03 * Math.abs(S(ph)), hy: 0.1 * S(ph), hr: -0.06 }, t, k); // leaning into the turn
  const r = p.rot; r.l_upper = [0.7 * S(ph), 0, 0.25]; r.r_upper = [-0.7 * S(ph), 0, -0.25]; r.l_fore = [-1.1, 0, 0]; r.r_fore = [-1.1, 0, 0];
  r.head = [0.05, 0.25 * S(t * 0.9 + k), 0]; return p;
}
/** walking round pulling a wheeled toy on a cord (the root on its circle; the cord in the right hand, behind) */
function pullToy(t: number, k: number): Pose {
  const P = PLAY_PATH.pull_toy, ph = 2 * PI * P.cad * t + k, p = blank(); stride(p, ph, 0.3);
  const T = body(p, { hp: 0.04, sp: 0.03, drop: -0.02 + 0.012 * C(2 * ph), hy: -0.12 }, t, k);
  grip(p, T, 'r', [-0.16, 0.86, -0.12], [-0.8, -1, 0.2], 0.3);
  const r = p.rot; r.l_upper = [0.25 * S(ph), 0, 0.08]; r.l_fore = [-0.3, 0, 0];
  look(p, T, [-0.6, 0.1, -0.6]); p.grip = [0.2, 1]; return p;
}
/** a small child sitting on the ground shaking a clay rattle */
function rattle(t: number, k: number): Pose {
  const p = blank(), sh = S(2 * PI * t * 3.2 + k) * (fr(t / 3 + k) < 0.7 ? 1 : 0.15);
  const T = sitBody(p, t, k, 0.1);
  grip(p, T, 'r', [-0.12, 0.62 + 0.05 * sh, 0.3], [-0.9, -0.6, -0.3], 0.3 + 0.4 * sh); grip(p, T, 'l', [0.1, 0.35, 0.28], [0.9, -0.8, -0.3]);
  look(p, T, [-0.1, 0.55, 0.35]); p.grip = [0.3, 1]; return p;
}
/** a lame man walking with a staff in his right hand: the right leg stiff and short in its step, the body dipping onto the
 *  staff as the right foot takes his weight (gait phase ph from the walk; C) */
function limp(t: number, ph: number, k: number): Pose {
  const p = blank(), r = p.rot, dip = Math.max(0, -S(ph));
  r.l_thigh = [-0.4 * S(ph), 0, 0]; r.r_thigh = [0.2 * S(ph), 0, -0.05]; r.l_shin = [0.1 + 0.36 * Math.max(0, C(ph)) ** 1.5, 0, 0]; r.r_shin = [0.05, 0, 0];
  r.l_foot = [-0.2 * S(ph), 0, 0]; r.r_foot = [0.05, 0, 0];
  const T = body(p, { hp: 0.08, sp: 0.06, drop: -0.03 - 0.04 * dip, side: -0.03 * dip, hr: 0.06 * dip, hy: 0.04 * S(ph) }, t, k);
  const G: V3 = [-0.26, 1.18 - 0.04 * dip, 0.36 + 0.08 * S(ph)]; grip(p, T, 'r', G, [-0.8, -1, -0.2], 0.3);
  r.l_upper = [0.2 * S(ph), 0, 0.08]; r.l_fore = [-0.3, 0, 0];
  look(p, T, [0, 0.6, 5]); p.grip = [0.2, 1]; p.tip = [[-0.3, 0, 0.45 + 0.15 * S(ph)], null]; return p;
}
/** a blind elder walking slowly, the staff held forward and down in the right hand, its foot sweeping the ground ahead,
 *  the left hand a little forward (gait phase ph; C) */
function feel(t: number, ph: number, k: number): Pose {
  const p = blank(); stride(p, ph, 0.22);
  const T = body(p, { hp: 0.1, sp: 0.1, drop: -0.04, hy: 0.03 * S(ph) }, t, k);
  const sw = S(t * 1.7 + k); grip(p, T, 'r', [-0.14, 1.0, 0.36], [-0.8, -1, -0.2], 0.3);
  grip(p, T, 'l', [0.16, 0.98, 0.3], [0.8, -1, -0.2]);
  look(p, T, [0, 1.5, 6], -0.25); p.grip = [0.3, 1]; p.tip = [[-0.14 + 0.35 * sw, 0, 1.0], null]; return p;
}
function archery(t: number, k: number): Pose {
  const P = 8, q = fr(t / P + k * 0.2), p = blank();
  // in the body frame the target lies along +X (the left); the root is turned −π/2 so +X becomes the heading
  const draw = ramp(q, 0.32, 0.46) * (1 - ramp(q, 0.6, 0.62)), up = ramp(q, 0.26, 0.4) * (1 - ramp(q, 0.76, 0.92));
  const T = body(p, { hp: 0.02, sp: -0.03 * up, ch: 0, drop: -0.03, hy: 0.1 * up, sy: 0.12 * up }, t, k);
  stance(p, T, { w: 0.19, zl: 0.0, zr: 0.0, out: 0.35 });
  const L: V3 = [0.26 + 0.37 * up, 1.02 + 0.37 * up, 0.18 - 0.12 * up];
  const Rk = key(q, [[0, [-0.14, 1.0, 0.2]], [0.1, [-0.22, 0.96, -0.12]], [0.18, [0.1, 1.2, 0.18]], [0.3, [0.2, 1.28, 0.14]], [0.46, [-0.02, 1.52, 0.1]], [0.6, [-0.02, 1.52, 0.1]], [0.63, [-0.14, 1.56, -0.06]], [0.74, [-0.14, 1.54, -0.04]], [0.78, [-0.3, 1.45, 0.25]], [0.84, [-0.32, 1.2, 0.2]], [0.9, [-0.14, 1.0, 0.2]]]);
  grip(p, T, 'l', L, [0.2, -1, -0.8], -1.4); grip(p, T, 'r', [Rk[0], Rk[1], Rk[2]], [-0.6, -0.2, -1], 1.2);
  look(p, T, up > 0.3 ? [25, 1.5, 0.3] : [0.4, 1.0, 1.2]);
  p.root = [0, 0, -PI / 2]; p.ip = draw; p.show = [true, q > 0.1 && q < 0.61]; p.grip = [1, 1];
  p.hit = q >= 0.6 && q < 0.64; return p;
}
/** cooking at the hearth, squatting: stirring the pot with a ladle, feeding sticks under it */
function cook(t: number, k: number): Pose {
  const P = 9, q = fr(t / P + k * 0.3), p = blank(), a = 2 * PI * t / 1.6;
  const feed = win(q, 0.32, 0.62, 0.04);
  const T = squatBody(p, t, k, 0.45 + 0.2 * feed, 0.37, -0.5 * win(q, 0.34, 0.48, 0.04));
  const Rf = key(q, [[0.3, [-0.08, 0.44, 0.46]], [0.38, [-0.34, 0.16, 0.3]], [0.46, [-0.3, 0.18, 0.32]], [0.56, [-0.05, 0.16, 0.44]], [0.64, [-0.08, 0.44, 0.46]]]);
  const R: V3 = feed > 0.02 ? [Rf[0], Rf[1], Rf[2]] : [-0.02 + 0.06 * C(a), 0.44 + 0.01 * S(a), 0.48 + 0.06 * S(a)];
  grip(p, T, 'r', R, [-0.9, -0.5, -0.3], 0.5); grip(p, T, 'l', onPelvis(T, 0.2, -0.02, 0.3), [0.9, -0.5, -0.3]);
  look(p, T, feed > 0.3 ? [R[0], 0.05, R[2]] : [0, 0.3, 0.55]);
  p.grip = [0.2, 1]; p.show = [feed < 0.3, feed >= 0.3 && q > 0.36 && q < 0.6]; p.tip = [[0, 0.32, 0.58], [0, 0.1, 0.62]]; return p;
}

// ================================================================================================= playing (D-200)
// The playing cycles: the instrument is framed against the body (Pose.inst, props.ts rule 'inst') or found at the lips
// (rule 'mouth'), and the hands are put on its strings, face or pipe from the same numbers (instrumentForms.ts), so a
// plucking hand is at a string. The strokes run on their own clock (C): they are not synchronised with the notes the
// music engine renders (the engine's piece is rendered in a worker; a stroke every 0.4-0.9 s reads as playing).
// Grips: the fingers close as a string is plucked or a hole stopped (the rig has one curl per hand: no finger of its own).
type IFrame = { o: V3; X: V3; Y: V3; Z: V3 };
/** an instrument's frame from its origin, main axis and up reference (as props.ts `frame`: X = Y × Z) */
export function iframe(o: V3, z: V3, y: V3): IFrame { const Z = v3.nrm(z), Y = v3.nrm(v3.sub(y, v3.scl(Z, v3.dot(y, Z)))); return { o, X: v3.crs(Y, Z), Y, Z }; }
/** a point of the instrument's own frame in character space */
export const iat = (F: IFrame, l: V3): V3 => v3.add(F.o, v3.add(v3.scl(F.X, l[0]), v3.add(v3.scl(F.Y, l[1]), v3.scl(F.Z, l[2]))));
const holdInst = (p: Pose, F: IFrame) => { p.inst = [F.o, F.Z, F.Y]; };
/** a seeded pick in [0, 1) for stroke n of a hand */
const pickU = (n: number, k: number, salt: number) => fr(Math.sin(n * 12.9898 + k * 78.233 + salt * 37.719) * 43758.5453);
/** a hand's strokes: every `P` s a new string of [lo, hi] (fractional while the hand moves to it in the first 35 % of the
 *  stroke), then the pluck (0 → 1 → 0 between 40 and 62 %) */
function strokes(t: number, k: number, P: number, off: number, lo: number, hi: number, salt: number) {
  const x = t / P + off + k * 0.37, n = Math.floor(x), u = x - n, s = (m: number) => lo + Math.floor(pickU(m, k, salt) * (hi - lo + 1));
  const a = s(n - 1), b = s(n); return { str: a + (b - a) * sm(u / 0.35), pluck: win(u, 0.4, 0.62, 0.06), u };
}
/** where the vertical harp's (fractional) string `si` is plucked (local frame): at 0.26 m above the rod, or lower on the
 *  short strings (two thirds of their height) */
export function harpVPluck(si: number): V3 {
  const n = HARP_V.strings, i0 = Math.max(0, Math.min(n - 1, Math.floor(si))), i1 = Math.min(n - 1, i0 + 1), w = si - i0, A = harpVString(i0), B = harpVString(i1);
  const z = A.foot[2] * (1 - w) + B.foot[2] * w, top = A.head[1] * (1 - w) + B.head[1] * w;
  return [0, Math.min(0.26, 0.65 * top), z];
}
/** the vertical angular harp, standing (the Madaktu harpists stand or walk: M-19): the soundbox against the chest on the
 *  left, the rod forward at the navel; the fingers of both hands pluck from either side of the strings, alternately (the
 *  right among the longer strings, the left among the shorter: C) */
export const HARP_V_HOLD: [V3, V3, V3] = [[0.15, 0.97, 0.18], [0.03, 0, 1], [0.14, 1, 0]]; // the soundbox beside the head, its top leaning a little out
function harpV(t: number, k: number): Pose {
  const p = blank(), T = body(p, { hp: 0.02, sp: 0.03, ch: 0.02, drop: -0.01, hy: 0.03 * wob(t * 0.2, k) }, t, k);
  stance(p, T, { w: 0.13, zl: 0.03, zr: -0.03, out: 0.15 });
  const o = HARP_V_HOLD[0], F = iframe([o[0] + 0.008 * wob(t * 0.3, k + 1), o[1], o[2]], HARP_V_HOLD[1], HARP_V_HOLD[2]); holdInst(p, F);
  const at = (si: number, side: 1 | -1, pull: number) => { const l = harpVPluck(si); return iat(F, [side * (0.05 + 0.018 * pull), l[1], l[2]]); };
  const R = strokes(t, k, 0.9, 0, 2, 10, 1), L = strokes(t, k, 0.9, 0.5, 0, 9, 2);
  grip(p, T, 'r', at(R.str, -1, R.pluck), [-0.8, -1, -0.2], 0.2); grip(p, T, 'l', at(L.str, 1, L.pluck), [0.8, -1, -0.2], -0.2);
  look(p, T, iat(F, [0, 0.25, 0.16])); p.grip = [0.35 + 0.45 * L.pluck, 0.35 + 0.45 * R.pluck]; return p;
}
/** the horizontal angular harp, standing: the soundbox level under the left forearm, pointing forward; the right hand
 *  strikes across the strings near their feet with a plectrum (M-21), the left hand's fingers on the strings from the far
 *  side (stopping them: C) */
function harpH(t: number, k: number): Pose {
  const p = blank(), T = body(p, { hp: 0.02, sp: 0.03, ch: 0.02, drop: -0.01, hy: 0.03 * wob(t * 0.2, k) }, t, k);
  stance(p, T, { w: 0.13, zl: 0.03, zr: -0.03, out: 0.15 });
  const F = iframe([0.15, 0.98, -0.1], [-0.15, 0.1, 1], [0, 1, 0]); holdInst(p, F); // the rear end behind the elbow
  const S = strokes(t, k, 0.6, 0, 0, 6, 3), zz = 0.3 + 0.02 * S.str; // across the strings nearest the player
  const fist: V3 = [-0.11 + 0.07 * S.pluck, 0.12, zz];
  grip(p, T, 'r', iat(F, fist), [-0.8, -1, -0.2], 0.4);
  p.tip = [null, iat(F, [fist[0] + 0.13, 0.11, zz + 0.01])];
  const Ls = strokes(t, k, 1.2, 0.3, 0, 5, 4), st = harpHString(Math.round(Ls.str)), lp = v3.add(st.foot, v3.scl(v3.sub(st.head, st.foot), 0.35));
  grip(p, T, 'l', iat(F, [0.055, lp[1], lp[2]]), [0.9, -1, -0.3], -0.3);
  look(p, T, iat(F, [0, 0.12, 0.4])); p.grip = [0.4 + 0.35 * Ls.pluck, 0.9]; return p;
}
/** the lyre, standing: held slanting out from the chest, its face forward; the right hand strikes across the strings over
 *  the bridge with a plectrum, the left hand's fingers touch the strings from behind (C) */
function lyre(t: number, k: number): Pose {
  const p = blank(), T = body(p, { hp: 0.02, sp: 0.03, ch: 0.02, drop: -0.01, hy: 0.03 * wob(t * 0.2, k) }, t, k);
  stance(p, T, { w: 0.13, zl: 0.03, zr: -0.03, out: 0.15 });
  const F = iframe([-0.02, 0.9, 0.18], [0.35, 1, 0.25], [-0.2, 0, 1]); holdInst(p, F);
  const S = strokes(t, k, 0.7, 0, 0, 4, 5), x = -LYRE.span * 1.5 + 3 * LYRE.span * S.pluck;
  grip(p, T, 'r', iat(F, [x - 0.03, LYRE.face + 0.05, 0.12]), [-0.8, -1, -0.2], 0.3);
  p.tip = [null, iat(F, [x + 0.02, LYRE.face, 0.17])];
  const Ls = strokes(t, k, 1.4, 0.3, 0, LYRE.strings - 1, 6), ls = lyreString(Math.round(Ls.str));
  grip(p, T, 'l', iat(F, [ls.foot[0] * 1.1, LYRE.face - 0.06, 0.4]), [0.9, -1, -0.3], -0.4);
  look(p, T, iat(F, [0, 0.05, 0.25])); p.grip = [0.4 + 0.35 * Ls.pluck, 0.9]; return p;
}
/** the frame drum, standing: held upright by its hoop in the left hand, the face turned to the right; the right hand
 *  strikes the middle (the low stroke) or the rim near the player (the high stroke) in a seeded pattern (C) */
function frameDrum(t: number, k: number): Pose {
  const p = blank(), T = body(p, { hp: 0.02, sp: 0.03, ch: 0.02, drop: -0.01, hy: 0.03 * wob(t * 0.2, k) }, t, k);
  stance(p, T, { w: 0.13, zl: 0.03, zr: -0.03, out: 0.15 });
  const F = iframe([0.1, 1.15, 0.3], [-0.7, 0.1, 0.7], [0, 1, 0]); holdInst(p, F);
  grip(p, T, 'l', iat(F, [-0.12, -0.12, -0.035]), [0.9, -1, -0.3], -0.3);
  const B = 0.36, x = t / B + k * 0.37, n = Math.floor(x), u = x - n, pat = Math.floor(pickU(Math.floor(n / 4), k, 7) * 4), beat = n % 4;
  const rim = (beat + pat) % 3 !== 0, rest = (beat + pat) % 4 === 3, hitW = rest ? 0 : win(u, 0.0, 0.18, 0.05);
  const face: V3 = rim ? [-0.13, 0.06, 0.03] : [0, 0.02, 0.035];
  grip(p, T, 'r', iat(F, [face[0], face[1], face[2] + 0.08 * (1 - hitW)]), [-0.8, -1, -0.2], 0.9);
  look(p, T, iat(F, [0, 0, 0.1])); p.grip = [0.85, 0.2]; return p;
}
/** pipes at the lips: the double pipe standing (one cane in each hand), the herder's single pipe sitting on the ground
 *  (both hands on the one cane); the fingers stop and open the holes (the grip changes with each note, C). The head is
 *  set, not turned to look (the pipe is at the lips) */
function pipes(t: number, k: number, double: boolean): Pose {
  const p = blank(), T = double ? body(p, { hp: 0.02, sp: 0.02, ch: 0.02, drop: -0.01, hy: 0.03 * wob(t * 0.2, k) }, t, k) : sitBody(p, t, k, 0.12);
  if (double) stance(p, T, { w: 0.13, zl: 0.03, zr: -0.03, out: 0.15 });
  p.rot.neck = [0.12, 0.05 * wob(t * 0.15, k), 0]; p.rot.head = [double ? 0.02 : 0.1, 0, 0];
  const H = headOf(p, T), M = v3.add(H.t, app(H.R, MOUTH)), D = v3.nrm(app(H.R, double ? [0, -0.6, 0.8] : [0, -0.72, 0.7])), side = app(H.R, [1, 0, 0]);
  if (double) { const d = 0.21, lat = d * Math.tan(DOUBLE_PIPE.splay / 2);
    grip(p, T, 'l', v3.add(v3.add(M, v3.scl(D, d)), v3.scl(side, lat)), [0.9, -1, -0.2], -0.2); grip(p, T, 'r', v3.add(v3.add(M, v3.scl(D, d)), v3.scl(side, -lat)), [-0.9, -1, -0.2], 0.2); }
  else { grip(p, T, 'l', v3.add(M, v3.scl(D, 0.15)), [0.9, -1, -0.2], -0.3); grip(p, T, 'r', v3.add(M, v3.scl(D, 0.24)), [-0.9, -1, -0.2], 0.3); }
  const n = Math.floor(t / 0.45 + k * 0.37); p.grip = [0.45 + 0.35 * pickU(n, k, 8), 0.45 + 0.35 * pickU(n, k, 9)];
  return p;
}
/** singing, standing: the hands loosely joined low in front, the head a little raised; the breath and the jaw follow the
 *  sung phrases in the crowd (crowd.ts: the notes of the piece) */
function sing(t: number, k: number): Pose {
  const p = blank(), T = body(p, { hp: 0.0, sp: -0.02, ch: -0.02, drop: -0.01, hy: 0.04 * wob(t * 0.15, k) }, t, k);
  stance(p, T, { w: 0.12, zl: 0.02, zr: -0.02, out: 0.14 });
  grip(p, T, 'r', [-0.03, 0.93, 0.16], [-0.8, -1, -0.2], 0.9); grip(p, T, 'l', [0.035, 0.94, 0.15], [0.8, -1, -0.2], -0.9);
  look(p, T, [0.4 * wob(t * 0.1, k + 3), 1.7, 5]); p.grip = [0.4, 0.4]; return p;
}

/** D-209: a magus standing with the barsom held upright before him in the right fist (a man in Median dress holding the
 *  barsom on the Oxus plaques: B; how it is held here C), the left hand laid over the right wrist, the head a little bowed
 *  toward the fire or the offering. At the offering and when he chants (the chant is the music system's: the jaw under the
 *  mouth-cover) */
function barsomPose(t: number, k: number): Pose {
  const p = blank(), T = body(p, { hp: 0.02, sp: 0.05, ch: 0.02, drop: -0.01, hy: 0.02 * wob(t * 0.12, k) }, t, k);
  stance(p, T, { w: 0.12, zl: 0.02, zr: -0.02, out: 0.14 });
  grip(p, T, 'r', [-0.05, 1.1, 0.3], [-0.8, -1, -0.2], 1.2); grip(p, T, 'l', [0.02, 1.04, 0.27], [0.8, -1, -0.2], -0.9);
  look(p, T, [0.1 * wob(t * 0.08, k + 2), 0.5, 2.6], 0.08); p.grip = [0.4, 1]; return p;
}
/** D-209: feeding the kept fire on the altar's top (about 1.2 m high, 0.9 m ahead): a stick taken from the bundle in the
 *  crook of the left arm and laid on the fire, leaning in, then back (C) */
function feedFire(t: number, k: number): Pose {
  const P = 6, q = fr(t / P + k * 0.21), p = blank(), reach = win(q, 0.3, 0.62, 0.1);
  const T = body(p, { hp: 0.05 + 0.14 * reach, sp: 0.05 + 0.12 * reach, drop: -0.01, hy: 0.03 * wob(t * 0.2, k) }, t, k);
  stance(p, T, { w: 0.13, zl: 0.08, zr: -0.06, out: 0.14 });
  const R = key(q, [[0, [-0.12, 0.98, 0.22]], [0.2, [0.06, 1.0, 0.24]], [0.45, [-0.02, 1.22, 0.62]], [0.6, [-0.02, 1.2, 0.64]], [0.8, [-0.14, 1.0, 0.25]]]);
  grip(p, T, 'r', [R[0], R[1], R[2]], [-0.8, -0.9, -0.3], 0.6); grip(p, T, 'l', [0.14, 1.0, 0.2], [0.8, -1, -0.2], -0.8);
  look(p, T, [0, 1.2, 0.9]); p.grip = [1, 1]; p.show = [q > 0.1 && q < 0.6, false]; return p;
}
/** D-209: standing in mourning at a grave: the head bowed, the hands joined low (C: no wailing or tearing is staged) */
function mourn(t: number, k: number): Pose {
  const p = blank(), T = body(p, { hp: 0.04, sp: 0.1, ch: 0.08, drop: -0.01, hy: 0.02 * wob(t * 0.1, k) }, t, k);
  stance(p, T, { w: 0.12, zl: 0.02, zr: -0.02, out: 0.14 });
  grip(p, T, 'r', [-0.03, 0.9, 0.14], [-0.8, -1, -0.2], 0.9); grip(p, T, 'l', [0.035, 0.91, 0.13], [0.8, -1, -0.2], -0.9);
  look(p, T, [0.2 * wob(t * 0.07, k), 0, 2.2], 0.25); p.grip = [0.4, 0.4]; return p;
}
/** a work cycle's pose. `ph`: the gait phase for walking cycles (bearers); `k`: per-person seed */
export function workPose(id: WorkAnim, t: number, ph: number, k: number): Pose {
  switch (id) {
    case 'hoe': return hoe(t, k);
    case 'irrigate': return irrigate(t, k);
    case 'reap': return reap(t, k);
    case 'bind': return bind(t, k);
    case 'winnow': return winnow(t, k);
    case 'drive': return drive(t, k);
    case 'plough': return plough(t, k);
    case 'herd': return herd(t, k);
    case 'groom': return groom(t, k);
    case 'fodder': return fodder(t, k);
    case 'shear': return shear(t, k);
    case 'butcher': return butcher(t, k);
    case 'hold': return hold(t, k, 'jar');
    case 'hold_sack': return hold(t, k, 'sack');
    case 'hold_lead': return hold(t, k, 'lead');
    case 'sweep': return sweep(t, k);
    case 'weave': return weave(t, k);
    case 'spin': return spin(t, k);
    case 'gather': return gather(t, k);
    case 'pat': return pat(t, k);
    case 'stir': return stir(t, k);
    case 'mould': return mould(t, k);
    case 'lay': return lay(t, k);
    case 'haul': return haul(t, k);
    case 'pass': return pass(t, k);
    case 'polish': return polish(t, k);
    case 'adze': return adze(t, k);
    case 'pick': return pick(t, k);
    case 'tread': return tread(t, k);
    case 'stoke': return stoke(t, k);
    case 'mend': return mend(t, k);
    case 'bier_l': return bier(t, ph, k, 'l');
    case 'bier_r': return bier(t, ph, k, 'r');
    case 'wash': return wash(t, k);
    case 'archery': return archery(t, k);
    case 'cook': return cook(t, k);
    case 'harp_v': return harpV(t, k);
    case 'harp_h': return harpH(t, k);
    case 'lyre': return lyre(t, k);
    case 'frame_drum': return frameDrum(t, k);
    case 'double_pipe': return pipes(t, k, true);
    case 'reed_pipe': return pipes(t, k, false);
    case 'sing': return sing(t, k);
    case 'ball': return ball(t, k);
    case 'chase': return chase(t, k);
    case 'pull_toy': return pullToy(t, k);
    case 'rattle': return rattle(t, k);
    case 'limp': return limp(t, ph, k);
    case 'feel': return feel(t, ph, k);
    case 'barsom': return barsomPose(t, k);
    case 'feed_fire': return feedFire(t, k);
    case 'mourn': return mourn(t, k);
  }
}
/** the root path of a path cycle at time t (called every frame by the crowd, also between pose refreshes) */
export function workRoot(id: WorkAnim, t: number, k: number): [number, number, number] | null {
  if (id === 'plough') { const P = ploughPath(t, k); return [P.dx, P.dz, P.yaw]; }
  if (id === 'drive') return [0, 0, -2 * PI * fr(t / THRESH_TURN_S + k * 0.05)];
  if (id === 'archery') return [0, 0, -PI / 2];
  if (id === 'chase' || id === 'pull_toy') return playPath(id, t, k);
  return null;
}
void (0 as unknown as E3);
